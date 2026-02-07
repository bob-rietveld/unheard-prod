/**
 * Experiment config YAML generation utilities.
 *
 * Generates YAML experiment config files that serve as the bridge between
 * the chat/wizard UI and the cloud execution engine (Modal).
 * These files are self-contained, Git-friendly, and version-controlled.
 */

import { dump } from 'js-yaml'
import type { ParsedTemplate } from '@/types/template'
import { sanitizeFilename } from '@/lib/decision-generator'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Information about a context file uploaded by the user. */
export interface ContextFileInfo {
  path: string
  originalFilename: string
  fileType: string
  detectedType?: string
  rows?: number
  columns?: string[]
  pages?: number
  sizeBytes: number
}

/** Cohort data for real persona sourcing. */
export interface CohortData {
  cohortId: string
  cohortName: string
  members: {
    importId: string
    name: string
    objectType: 'company' | 'person' | 'list_entry'
    attributes: Record<string, unknown>
  }[]
}

/** Input required to generate an experiment config YAML. */
export interface ExperimentConfigInput {
  /** Parsed template from template-parser.ts */
  template: ParsedTemplate
  /** Full parsed YAML object (includes personaGeneration, stimulusTemplate, etc.) */
  templateRaw: Record<string, unknown>
  /** Template slug from Convex */
  templateSlug: string
  /** User's wizard answers keyed by question ID */
  answers: Record<string, unknown>
  /** User-provided decision title */
  decisionTitle: string
  /** Generated decision ID (e.g., "dec-2026-02-06-seed-fundraising") */
  decisionId: string
  /** Relative path to the decision log markdown */
  markdownPath: string
  /** Context files from Convex */
  contextFiles: ContextFileInfo[]
  /** Optional cohort data for real persona sourcing */
  cohortData?: CohortData
}

/** Persona archetype within the experiment config. */
interface Archetype {
  id: string
  name: string
  count: number
}

/** Analysis metric definition. */
interface AnalysisMetric {
  id: string
  name: string
  description?: string
  calculation: string
}

/** Analysis insight definition. */
interface AnalysisInsight {
  id: string
  name: string
  description?: string
  extraction?: string
  groupBy?: string
  limit?: number
}

/** Full experiment config structure matching the YAML schema. */
export interface ExperimentConfig {
  metadata: {
    id: string
    version: string
    created: string
    template: {
      id: string
      slug: string
      version: string
      name: string
    }
    decision: {
      id: string
      title: string
      markdownPath: string
    }
  }
  configuration: Record<string, unknown>
  context: {
    files: ContextFileInfo[]
  }
  personas: {
    generationType: string
    count: number
    archetypes?: Archetype[]
    cohortId?: string
    cohortName?: string
    members?: { id: string; name: string; type: string; attributes: Record<string, unknown> }[]
  }
  stimulus: {
    template: string
  }
  execution: {
    provider: string
    model: string
    temperature: number
    maxTokens: number
    timeout: number
    parallelization: boolean
  }
  analysis: {
    metrics: AnalysisMetric[]
    insights: AnalysisInsight[]
  }
  output: {
    format: string
    resultsPath: string
    gitAutoCommit: boolean
  }
}

// ---------------------------------------------------------------------------
// Default analysis by category
// ---------------------------------------------------------------------------

/** Category-specific default metrics. */
const DEFAULT_METRICS: Record<string, AnalysisMetric[]> = {
  investor: [
    {
      id: 'investment_rate',
      name: 'Investment Interest Rate',
      description: 'Percentage of investors interested or investing',
      calculation: "COUNT(decision IN ['INTERESTED', 'INVEST']) / TOTAL",
    },
    {
      id: 'pass_rate',
      name: 'Pass Rate',
      calculation: "COUNT(decision = 'PASS') / TOTAL",
    },
    {
      id: 'avg_sentiment',
      name: 'Average Sentiment',
      calculation: 'AVG(sentiment_score)',
    },
  ],
  pricing: [
    {
      id: 'preferred_model',
      name: 'Preferred Pricing Model',
      description: 'Which model was most popular',
      calculation: 'MODE(preferred_model)',
    },
    {
      id: 'avg_willingness_to_pay',
      name: 'Average Willingness to Pay',
      calculation: 'AVG(price_point)',
    },
    {
      id: 'churn_risk',
      name: 'Churn Risk Factors',
      calculation: 'COUNT(churn_reason) GROUP BY reason',
    },
  ],
  roadmap: [
    {
      id: 'feature_ranking',
      name: 'Feature Priority Ranking',
      description: 'Average rank across all personas',
      calculation: 'AVG(rank) GROUP BY feature',
    },
    {
      id: 'must_have_rate',
      name: 'Must-Have Rate',
      description: 'Percentage of personas ranking feature in top 2',
      calculation: 'COUNT(rank <= 2) / TOTAL GROUP BY feature',
    },
  ],
  'van-westendorp': [
    {
      id: 'optimal_price_point',
      name: 'Optimal Price Point',
      description: 'Intersection of Too Cheap and Too Expensive curves',
      calculation: 'INTERSECT(too_cheap_cumulative, too_expensive_cumulative)',
    },
    {
      id: 'indifference_price_point',
      name: 'Indifference Price Point',
      description: 'Intersection of Expensive and Bargain curves',
      calculation: 'INTERSECT(expensive_cumulative, bargain_cumulative)',
    },
    {
      id: 'acceptable_price_range',
      name: 'Acceptable Price Range',
      description: 'Range between Point of Marginal Cheapness and Point of Marginal Expensiveness',
      calculation: 'RANGE(point_marginal_cheapness, point_marginal_expensiveness)',
    },
    {
      id: 'point_of_marginal_cheapness',
      name: 'Point of Marginal Cheapness',
      description: 'Intersection of Too Cheap and Expensive curves',
      calculation: 'INTERSECT(too_cheap_cumulative, expensive_cumulative)',
    },
    {
      id: 'point_of_marginal_expensiveness',
      name: 'Point of Marginal Expensiveness',
      description: 'Intersection of Too Expensive and Bargain curves',
      calculation: 'INTERSECT(too_expensive_cumulative, bargain_cumulative)',
    },
  ],
}

/** Category-specific default insights. */
const DEFAULT_INSIGHTS: Record<string, AnalysisInsight[]> = {
  investor: [
    {
      id: 'top_concerns',
      name: 'Top Concerns',
      description: 'Most frequently mentioned concerns',
      extraction: 'keyword_extraction',
      limit: 5,
    },
    {
      id: 'investor_type_breakdown',
      name: 'Interest by Investor Type',
      description: 'Which investor types are most interested',
      groupBy: 'archetype',
    },
    {
      id: 'key_questions',
      name: 'Common Questions',
      description: 'Questions investors would ask',
      extraction: 'question_extraction',
      limit: 10,
    },
  ],
  pricing: [
    {
      id: 'model_preference_by_segment',
      name: 'Model Preference by Buyer Type',
      description: 'Which segments prefer which models',
      groupBy: 'archetype',
    },
    {
      id: 'price_sensitivity',
      name: 'Price Sensitivity Analysis',
      description: 'Price points where demand drops',
      extraction: 'keyword_extraction',
      limit: 5,
    },
  ],
  roadmap: [
    {
      id: 'segment_preferences',
      name: 'Preferences by User Type',
      description: 'How different user types prioritize differently',
      groupBy: 'archetype',
    },
    {
      id: 'upgrade_drivers',
      name: 'Upgrade Drivers',
      description: 'Features most likely to drive upgrades',
      extraction: 'keyword_extraction',
      limit: 5,
    },
  ],
  'van-westendorp': [
    {
      id: 'segment_price_sensitivity',
      name: 'Price Sensitivity by Segment',
      description: 'How price sensitivity varies across buyer archetypes',
      groupBy: 'archetype',
    },
    {
      id: 'price_resistance_factors',
      name: 'Price Resistance Factors',
      description: 'Key reasons personas cite for price resistance',
      extraction: 'keyword_extraction',
      limit: 5,
    },
    {
      id: 'value_perception_drivers',
      name: 'Value Perception Drivers',
      description: 'Factors that influence how personas perceive value relative to price',
      extraction: 'keyword_extraction',
      limit: 5,
    },
  ],
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get default analysis metrics and insights for a template category.
 * Falls back to generic defaults if the category is not recognized.
 */
export function getDefaultAnalysis(category: string): {
  metrics: AnalysisMetric[]
  insights: AnalysisInsight[]
} {
  const normalizedCategory = category.toLowerCase().replace(/s$/, '')
  const metrics = DEFAULT_METRICS[normalizedCategory] ?? [
    {
      id: 'response_summary',
      name: 'Response Summary',
      description: 'Overall summary of persona responses',
      calculation: 'AGGREGATE(responses)',
    },
  ]
  const insights = DEFAULT_INSIGHTS[normalizedCategory] ?? [
    {
      id: 'key_themes',
      name: 'Key Themes',
      description: 'Most common themes across responses',
      extraction: 'keyword_extraction',
      limit: 5,
    },
    {
      id: 'segment_breakdown',
      name: 'Breakdown by Archetype',
      description: 'How different archetypes responded',
      groupBy: 'archetype',
    },
  ]
  return { metrics, insights }
}

/**
 * Resolve variable placeholders in a stimulus template string.
 *
 * Substitutes `{{variable_name}}` with the corresponding value from answers.
 * - Arrays are joined with ", "
 * - Booleans become "Yes" / "No"
 * - Missing optional values become "N/A"
 * - Unknown variables are left as-is with a warning logged
 */
export function resolveStimulus(
  template: string,
  answers: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, variable: string) => {
    if (!(variable in answers)) {
      logger.warn(`Unknown stimulus variable: {{${variable}}}`)
      return `{{${variable}}}`
    }

    const value = answers[variable]

    if (value === undefined || value === null || value === '') {
      return 'N/A'
    }
    if (Array.isArray(value)) {
      return value.join(', ')
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    return String(value)
  })
}

/**
 * Build a default stimulus prompt when the template lacks an explicit stimulusTemplate.
 *
 * Constructs a category-aware prompt from the template category and all user answers.
 */
export function buildDefaultStimulus(
  category: string,
  answers: Record<string, unknown>
): string {
  const lines: string[] = []

  const categoryIntros: Record<string, string> = {
    investor:
      'You are evaluating a startup for investment.',
    pricing:
      'You are evaluating a product and its pricing.',
    'van-westendorp':
      'You are evaluating a product and providing price sensitivity feedback using the Van Westendorp method.',
    roadmap:
      'You are a user providing feedback on product feature priorities.',
  }

  const normalizedCategory = category.toLowerCase().replace(/s$/, '')
  lines.push(categoryIntros[normalizedCategory] ?? 'You are providing feedback on a business decision.')
  lines.push('')

  // Add all answers as context
  for (const [key, value] of Object.entries(answers)) {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    let formatted: string
    if (Array.isArray(value)) {
      formatted = value.join(', ')
    } else if (typeof value === 'boolean') {
      formatted = value ? 'Yes' : 'No'
    } else {
      formatted = String(value ?? 'N/A')
    }
    lines.push(`${label}: ${formatted}`)
  }

  lines.push('')

  // Add category-specific instructions
  const categoryInstructions: Record<string, string> = {
    investor: [
      'Based on your investment criteria and experience, provide:',
      '1. Your investment decision (PASS, INTERESTED, or INVEST)',
      '2. Your reasoning (2-3 key points)',
      '3. Your biggest concern',
      '4. One question you would ask the founders',
    ].join('\n'),
    pricing: [
      'Based on your role and budget constraints, provide:',
      '1. Which pricing model you prefer and why',
      '2. What price point feels right for your use case',
      '3. What would make you upgrade to a higher tier',
      '4. What would cause you to churn',
    ].join('\n'),
    'van-westendorp': [
      'Based on your role and budget, answer these four price sensitivity questions:',
      '1. TOO EXPENSIVE: At what price would you NOT consider buying it?',
      '2. BARGAIN: At what price would you buy it immediately?',
      '3. EXPENSIVE: At what price does it start to feel expensive but still possible?',
      '4. TOO CHEAP: At what price would you question its quality?',
      '',
      'Provide your answers in this exact format:',
      'TOO_EXPENSIVE: $XX',
      'TOO_CHEAP: $XX',
      'EXPENSIVE: $XX',
      'BARGAIN: $XX',
    ].join('\n'),
    roadmap: [
      'For each feature listed, provide:',
      '1. Priority rank (where 1 is most important)',
      '2. Why this matters to you',
      '3. Would this feature alone justify staying/upgrading?',
    ].join('\n'),
  }

  lines.push(
    categoryInstructions[normalizedCategory] ??
      [
        'Please provide your honest feedback:',
        '1. Your overall assessment',
        '2. Key concerns or considerations',
        '3. What additional information would you need',
      ].join('\n')
  )

  return lines.join('\n')
}

/**
 * Generate a filename for the experiment config YAML.
 *
 * Format: `YYYY-MM-DD-{slug}.yaml`
 */
export function generateExperimentFilename(title: string): string {
  const date = new Date().toISOString().split('T')[0]
  const slug = sanitizeFilename(title)
  return `${date}-${slug}.yaml`
}

/**
 * Generate an experiment config YAML string from the given input.
 *
 * Builds all sections (metadata, configuration, context, personas, stimulus,
 * execution, analysis, output) and serializes to YAML via js-yaml.
 */
export function generateExperimentConfig(input: ExperimentConfigInput): string {
  const {
    template,
    templateRaw,
    templateSlug,
    answers,
    decisionTitle,
    decisionId,
    markdownPath,
    contextFiles,
    cohortData,
  } = input

  const date = new Date().toISOString().split('T')[0]
  const slug = sanitizeFilename(decisionTitle)

  // --- Metadata ---
  const metadata = {
    id: `exp-${date}-${slug}`,
    version: '1.0',
    created: new Date().toISOString(),
    template: {
      id: template.id,
      slug: templateSlug,
      version: template.version,
      name: template.name,
    },
    decision: {
      id: decisionId,
      title: decisionTitle,
      markdownPath,
    },
  }

  // --- Configuration (user answers) ---
  const configuration: Record<string, unknown> = { ...answers }

  // --- Context ---
  const context = {
    files: contextFiles.map(f => {
      const entry: ContextFileInfo = {
        path: f.path,
        originalFilename: f.originalFilename,
        fileType: f.fileType,
        sizeBytes: f.sizeBytes,
      }
      if (f.detectedType) entry.detectedType = f.detectedType
      if (f.rows !== undefined) entry.rows = f.rows
      if (f.columns !== undefined) entry.columns = f.columns
      if (f.pages !== undefined) entry.pages = f.pages
      return entry
    }),
  }

  // --- Personas ---
  const personaGeneration = templateRaw.personaGeneration as
    | Record<string, unknown>
    | undefined
  const archetypes: Archetype[] = []
  let personaCount = 10
  let generationType = 'standard'

  if (personaGeneration) {
    generationType =
      typeof personaGeneration.type === 'string'
        ? personaGeneration.type
        : 'standard'
    personaCount =
      typeof personaGeneration.count === 'number'
        ? personaGeneration.count
        : 10

    if (Array.isArray(personaGeneration.archetypes)) {
      for (const arch of personaGeneration.archetypes) {
        const a = arch as Record<string, unknown>
        if (typeof a.id === 'string' && typeof a.name === 'string') {
          archetypes.push({
            id: a.id,
            name: a.name,
            count: typeof a.count === 'number' ? a.count : 1,
          })
        }
      }
    }
  }

  // If cohort is provided, use real data instead of archetypes
  const personas: ExperimentConfig['personas'] = cohortData
    ? {
        generationType: 'cohort',
        count: cohortData.members.length,
        cohortId: cohortData.cohortId,
        cohortName: cohortData.cohortName,
        members: cohortData.members.map(m => ({
          id: m.importId,
          name: m.name,
          type: m.objectType,
          attributes: m.attributes,
        })),
      }
    : {
        generationType,
        count: personaCount,
        archetypes,
      }

  // --- Stimulus ---
  const rawStimulus = templateRaw.stimulusTemplate
  let stimulusText: string
  if (typeof rawStimulus === 'string' && rawStimulus.trim().length > 0) {
    stimulusText = resolveStimulus(rawStimulus, answers)
  } else {
    stimulusText = buildDefaultStimulus(template.category, answers)
  }

  const stimulus = { template: stimulusText }

  // --- Execution defaults ---
  const execution = {
    provider: 'modal',
    model: 'claude-haiku-4-5-20251001',
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 60,
    parallelization: true,
  }

  // --- Analysis ---
  const analysis = getDefaultAnalysis(template.category)

  // --- Output ---
  const resultsPath = `experiments/${date}-${slug}-results.json`
  const output = {
    format: 'yaml',
    resultsPath,
    gitAutoCommit: true,
  }

  // --- Build full config object ---
  const config: ExperimentConfig = {
    metadata,
    configuration,
    context,
    personas,
    stimulus,
    execution,
    analysis,
    output,
  }

  // Serialize to YAML
  return dump(config, {
    lineWidth: 120,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  })
}
