import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import {
  buildDefaultStimulus,
  generateExperimentConfig,
  generateExperimentFilename,
  getDefaultAnalysis,
  resolveStimulus,
  type ContextFileInfo,
  type ExperimentConfig,
  type ExperimentConfigInput,
} from './experiment-config-generator'
import type { ParsedTemplate } from '@/types/template'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockInvestorTemplate: ParsedTemplate = {
  id: 'investor-pitch-evaluation',
  version: '1.0',
  name: 'Investor Pitch Evaluation',
  description:
    'Test investor interest in your pitch with 10 realistic VC/angel personas',
  category: 'investors',
  configurationFlow: [
    {
      id: 'stage',
      question: 'What funding stage are you at?',
      type: 'select',
      required: true,
      options: [
        { value: 'pre-seed', label: 'Pre-seed ($100K-$500K)' },
        { value: 'seed', label: 'Seed ($500K-$2M)' },
        { value: 'series-a', label: 'Series A ($2M-$10M)' },
      ],
      default: 'seed',
    },
    {
      id: 'funding_target',
      question: 'How much are you raising?',
      type: 'number',
      required: true,
      unit: 'USD',
      min: 100000,
      max: 10000000,
      default: 2000000,
    },
    {
      id: 'industry',
      question: 'What industry are you in?',
      type: 'text',
      required: true,
      placeholder: 'e.g., developer tools, fintech, healthcare',
    },
    {
      id: 'current_mrr',
      question: "What's your current MRR?",
      type: 'number',
      required: false,
      unit: 'USD',
      min: 0,
    },
    {
      id: 'pitch_summary',
      question: 'Summarize your pitch (2-3 sentences)',
      type: 'textarea',
      required: true,
      placeholder: "We're building X to solve Y. We have Z traction...",
      maxLength: 500,
    },
  ],
}

const mockInvestorTemplateRaw: Record<string, unknown> = {
  id: 'investor-pitch-evaluation',
  version: '1.0',
  name: 'Investor Pitch Evaluation',
  description:
    'Test investor interest in your pitch with 10 realistic VC/angel personas',
  category: 'investors',
  configurationFlow: mockInvestorTemplate.configurationFlow,
  personaGeneration: {
    type: 'standard',
    count: 10,
    archetypes: [
      { id: 'seed_vc_partner', name: 'Seed VC Partner', count: 3 },
      { id: 'angel_investor', name: 'Angel Investor', count: 3 },
      { id: 'series_a_vc_principal', name: 'Series A VC Principal', count: 2 },
      { id: 'corporate_vc', name: 'Corporate VC', count: 2 },
    ],
  },
}

const mockPricingTemplate: ParsedTemplate = {
  id: 'pricing-strategy-evaluation',
  version: '1.0',
  name: 'Pricing Strategy Evaluation',
  description: 'Test different pricing models with target customer personas',
  category: 'pricing',
  configurationFlow: [
    {
      id: 'product_name',
      question: 'What is your product called?',
      type: 'text',
      required: true,
    },
    {
      id: 'product_description',
      question: 'Describe your product briefly',
      type: 'textarea',
      required: true,
      maxLength: 300,
    },
    {
      id: 'pricing_models',
      question: 'Which pricing models do you want to test?',
      type: 'multiselect',
      required: true,
      options: [
        { value: 'freemium', label: 'Freemium (free tier + paid)' },
        { value: 'subscription', label: 'Subscription (monthly/annual)' },
        { value: 'usage-based', label: 'Usage-based (pay per use)' },
        { value: 'tiered', label: 'Tiered (good/better/best)' },
      ],
    },
    {
      id: 'price_range_low',
      question: 'Minimum price point to test?',
      type: 'number',
      required: true,
      unit: 'USD',
      min: 0,
      default: 10,
    },
    {
      id: 'price_range_high',
      question: 'Maximum price point to test?',
      type: 'number',
      required: true,
      unit: 'USD',
      min: 0,
      default: 100,
    },
  ],
}

const mockPricingTemplateRaw: Record<string, unknown> = {
  id: 'pricing-strategy-evaluation',
  version: '1.0',
  name: 'Pricing Strategy Evaluation',
  category: 'pricing',
  configurationFlow: mockPricingTemplate.configurationFlow,
  personaGeneration: {
    type: 'fromContext',
    count: 8,
    archetypes: [
      { id: 'price_sensitive', name: 'Price-Sensitive Buyer', count: 3 },
      { id: 'value_buyer', name: 'Value-Focused Buyer', count: 3 },
      { id: 'premium_buyer', name: 'Premium Buyer', count: 2 },
    ],
  },
}

const mockRoadmapTemplate: ParsedTemplate = {
  id: 'product-roadmap-prioritization',
  version: '1.0',
  name: 'Product Roadmap Prioritization',
  description: 'Get feedback from customer personas on feature priorities',
  category: 'roadmap',
  configurationFlow: [
    {
      id: 'product_context',
      question: 'What is your product?',
      type: 'textarea',
      required: true,
      maxLength: 300,
    },
    {
      id: 'feature_list',
      question: 'List features to prioritize (one per line)',
      type: 'textarea',
      required: true,
      maxLength: 1000,
    },
    {
      id: 'timeframe',
      question: 'What timeframe are you prioritizing for?',
      type: 'select',
      required: true,
      options: [
        { value: 'next-month', label: 'Next Month (sprint)' },
        { value: 'next-quarter', label: 'Next Quarter (3 months)' },
        { value: 'next-year', label: 'Next Year (annual planning)' },
      ],
      default: 'next-quarter',
    },
    {
      id: 'user_segment',
      question: 'Which user segment should we focus on?',
      type: 'text',
      required: false,
    },
  ],
}

const mockRoadmapTemplateRaw: Record<string, unknown> = {
  id: 'product-roadmap-prioritization',
  version: '1.0',
  name: 'Product Roadmap Prioritization',
  category: 'roadmap',
  configurationFlow: mockRoadmapTemplate.configurationFlow,
  personaGeneration: {
    type: 'fromContext',
    count: 10,
    archetypes: [
      { id: 'power_user', name: 'Power User', count: 3 },
      { id: 'casual_user', name: 'Casual User', count: 3 },
      { id: 'enterprise_admin', name: 'Enterprise Admin', count: 2 },
      { id: 'new_user', name: 'New User', count: 2 },
    ],
  },
}

const mockContextFiles: ContextFileInfo[] = [
  {
    path: 'context/customers.csv',
    originalFilename: 'customers.csv',
    fileType: 'csv',
    detectedType: 'customer_data',
    rows: 500,
    columns: ['name', 'email', 'plan', 'mrr', 'signup_date'],
    sizeBytes: 45200,
  },
  {
    path: 'context/pitch-deck.pdf',
    originalFilename: 'pitch-deck.pdf',
    fileType: 'pdf',
    pages: 12,
    sizeBytes: 2340000,
  },
]

function makeInvestorInput(
  overrides?: Partial<ExperimentConfigInput>
): ExperimentConfigInput {
  return {
    template: mockInvestorTemplate,
    templateRaw: mockInvestorTemplateRaw,
    templateSlug: 'investor-evaluation',
    answers: {
      stage: 'seed',
      funding_target: 2000000,
      industry: 'developer tools',
      current_mrr: 50000,
      pitch_summary: 'We are building AI decision support for founders.',
    },
    decisionTitle: 'Seed Fundraising Decision',
    decisionId: 'dec-2026-02-06-seed-fundraising',
    markdownPath: 'decisions/2026-02-06-seed-fundraising.md',
    contextFiles: mockContextFiles,
    ...overrides,
  }
}

function makePricingInput(
  overrides?: Partial<ExperimentConfigInput>
): ExperimentConfigInput {
  return {
    template: mockPricingTemplate,
    templateRaw: mockPricingTemplateRaw,
    templateSlug: 'pricing-strategy',
    answers: {
      product_name: 'DataPipe',
      product_description: 'Real-time data pipeline tool.',
      pricing_models: ['freemium', 'usage-based', 'tiered'],
      price_range_low: 29,
      price_range_high: 299,
    },
    decisionTitle: 'Pricing Evaluation',
    decisionId: 'dec-2026-02-06-pricing-evaluation',
    markdownPath: 'decisions/2026-02-06-pricing-evaluation.md',
    contextFiles: [],
    ...overrides,
  }
}

function makeRoadmapInput(
  overrides?: Partial<ExperimentConfigInput>
): ExperimentConfigInput {
  return {
    template: mockRoadmapTemplate,
    templateRaw: mockRoadmapTemplateRaw,
    templateSlug: 'product-roadmap',
    answers: {
      product_context: 'B2B analytics platform for e-commerce.',
      feature_list: 'Feature 1: Analytics\nFeature 2: Mobile',
      timeframe: 'next-quarter',
      user_segment: 'SMBs',
    },
    decisionTitle: 'Q2 Roadmap Prioritization',
    decisionId: 'dec-2026-02-06-roadmap-prioritization',
    markdownPath: 'decisions/2026-02-06-roadmap-prioritization.md',
    contextFiles: [],
    ...overrides,
  }
}

/** Parse YAML output and return the typed config object. */
function parseYaml(yamlStr: string): ExperimentConfig {
  return load(yamlStr) as ExperimentConfig
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateExperimentConfig', () => {
  it('generates valid YAML with all sections for investor template', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.metadata).toBeDefined()
    expect(config.configuration).toBeDefined()
    expect(config.context).toBeDefined()
    expect(config.personas).toBeDefined()
    expect(config.stimulus).toBeDefined()
    expect(config.execution).toBeDefined()
    expect(config.analysis).toBeDefined()
    expect(config.output).toBeDefined()
  })

  it('generates valid YAML with all sections for pricing template', () => {
    const yaml = generateExperimentConfig(makePricingInput())
    const config = parseYaml(yaml)

    expect(config.metadata).toBeDefined()
    expect(config.metadata.template.slug).toBe('pricing-strategy')
    expect(config.metadata.template.name).toBe('Pricing Strategy Evaluation')
    expect(config.configuration).toBeDefined()
    expect(config.personas.generationType).toBe('fromContext')
    expect(config.personas.count).toBe(8)
    expect(config.personas.archetypes).toHaveLength(3)
  })

  it('generates valid YAML with all sections for roadmap template', () => {
    const yaml = generateExperimentConfig(makeRoadmapInput())
    const config = parseYaml(yaml)

    expect(config.metadata).toBeDefined()
    expect(config.metadata.template.slug).toBe('product-roadmap')
    expect(config.metadata.template.name).toBe(
      'Product Roadmap Prioritization'
    )
    expect(config.personas.generationType).toBe('fromContext')
    expect(config.personas.count).toBe(10)
    expect(config.personas.archetypes).toHaveLength(4)
  })

  it('handles minimal input with no context files and basic answers', () => {
    const input = makeInvestorInput({
      answers: { stage: 'seed' },
      contextFiles: [],
    })
    const yaml = generateExperimentConfig(input)
    const config = parseYaml(yaml)

    expect(config.context.files).toHaveLength(0)
    expect(config.configuration).toEqual({ stage: 'seed' })
  })

  it('generates metadata with correct format', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    // id format: exp-YYYY-MM-DD-slug
    expect(config.metadata.id).toMatch(
      /^exp-\d{4}-\d{2}-\d{2}-seed-fundraising-decision$/
    )
    expect(config.metadata.version).toBe('1.0')
    // ISO 8601 timestamp
    expect(config.metadata.created).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
    )
    // template ref
    expect(config.metadata.template.id).toBe('investor-pitch-evaluation')
    expect(config.metadata.template.slug).toBe('investor-evaluation')
    expect(config.metadata.template.version).toBe('1.0')
    expect(config.metadata.template.name).toBe('Investor Pitch Evaluation')
    // decision ref
    expect(config.metadata.decision.id).toBe(
      'dec-2026-02-06-seed-fundraising'
    )
    expect(config.metadata.decision.title).toBe('Seed Fundraising Decision')
    expect(config.metadata.decision.markdownPath).toBe(
      'decisions/2026-02-06-seed-fundraising.md'
    )
  })

  it('maps answers correctly into configuration section', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.configuration.stage).toBe('seed')
    expect(config.configuration.funding_target).toBe(2000000)
    expect(config.configuration.industry).toBe('developer tools')
    expect(config.configuration.current_mrr).toBe(50000)
    expect(config.configuration.pitch_summary).toBe(
      'We are building AI decision support for founders.'
    )
  })

  it('extracts archetypes from templateRaw personaGeneration', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.personas.generationType).toBe('standard')
    expect(config.personas.count).toBe(10)
    expect(config.personas.archetypes).toHaveLength(4)
    expect(config.personas.archetypes[0]).toEqual({
      id: 'seed_vc_partner',
      name: 'Seed VC Partner',
      count: 3,
    })
    expect(config.personas.archetypes[1]).toEqual({
      id: 'angel_investor',
      name: 'Angel Investor',
      count: 3,
    })
  })

  it('generates default stimulus when no stimulusTemplate in templateRaw', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    // Should use buildDefaultStimulus since templateRaw has no stimulusTemplate
    expect(config.stimulus.template).toContain(
      'You are evaluating a startup for investment.'
    )
    expect(config.stimulus.template).toContain('Stage: seed')
    expect(config.stimulus.template).toContain('Funding Target: 2000000')
  })

  it('resolves stimulusTemplate when present in templateRaw', () => {
    const input = makeInvestorInput({
      templateRaw: {
        ...mockInvestorTemplateRaw,
        stimulusTemplate:
          'Evaluate {{industry}} startup raising {{funding_target}} at {{stage}} stage.',
      },
    })
    const yaml = generateExperimentConfig(input)
    const config = parseYaml(yaml)

    expect(config.stimulus.template).toBe(
      'Evaluate developer tools startup raising 2000000 at seed stage.'
    )
  })

  it('applies execution defaults correctly', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.execution.provider).toBe('modal')
    expect(config.execution.model).toBe('qwen2.5:32b')
    expect(config.execution.temperature).toBe(0.7)
    expect(config.execution.maxTokens).toBe(500)
    expect(config.execution.timeout).toBe(60)
    expect(config.execution.parallelization).toBe(true)
  })

  it('derives output paths from decision filename slug', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.output.format).toBe('yaml')
    expect(config.output.resultsPath).toMatch(
      /^experiments\/\d{4}-\d{2}-\d{2}-seed-fundraising-decision-results\.json$/
    )
    expect(config.output.gitAutoCommit).toBe(true)
  })

  it('includes context files with optional fields', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    expect(config.context.files).toHaveLength(2)

    const csvFile = config.context.files[0]!
    expect(csvFile.path).toBe('context/customers.csv')
    expect(csvFile.originalFilename).toBe('customers.csv')
    expect(csvFile.fileType).toBe('csv')
    expect(csvFile.detectedType).toBe('customer_data')
    expect(csvFile.rows).toBe(500)
    expect(csvFile.columns).toEqual([
      'name',
      'email',
      'plan',
      'mrr',
      'signup_date',
    ])
    expect(csvFile.sizeBytes).toBe(45200)

    const pdfFile = config.context.files[1]!
    expect(pdfFile.path).toBe('context/pitch-deck.pdf')
    expect(pdfFile.pages).toBe(12)
    expect(pdfFile.sizeBytes).toBe(2340000)
    // Should not have rows/columns since not provided
    expect(pdfFile.rows).toBeUndefined()
    expect(pdfFile.columns).toBeUndefined()
  })

  it('handles templateRaw with no personaGeneration', () => {
    const input = makeInvestorInput({
      templateRaw: { id: 'test', version: '1.0', name: 'Test' },
    })
    const yaml = generateExperimentConfig(input)
    const config = parseYaml(yaml)

    expect(config.personas.generationType).toBe('standard')
    expect(config.personas.count).toBe(10)
    expect(config.personas.archetypes).toHaveLength(0)
  })
})

describe('generateExperimentFilename', () => {
  it('generates YYYY-MM-DD-slug.yaml format', () => {
    const filename = generateExperimentFilename('Seed Fundraising')
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-seed-fundraising\.yaml$/)
  })

  it('sanitizes special characters', () => {
    const filename = generateExperimentFilename('Title!@#$%^&*() Test')
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-title-test\.yaml$/)
  })

  it('truncates long titles', () => {
    const longTitle =
      'this is a very long title that definitely exceeds fifty characters in total length'
    const filename = generateExperimentFilename(longTitle)
    // slug portion (without date prefix and .yaml) should be <= 50 chars
    const parts = filename.split('.yaml')[0]!.split('-')
    // Remove date parts (YYYY, MM, DD)
    const slugParts = parts.slice(3)
    const slug = slugParts.join('-')
    expect(slug.length).toBeLessThanOrEqual(50)
  })
})

describe('resolveStimulus', () => {
  it('substitutes string values', () => {
    const result = resolveStimulus('Industry: {{industry}}', {
      industry: 'fintech',
    })
    expect(result).toBe('Industry: fintech')
  })

  it('substitutes number values', () => {
    const result = resolveStimulus('Amount: {{amount}}', { amount: 2000000 })
    expect(result).toBe('Amount: 2000000')
  })

  it('substitutes array values joined with comma', () => {
    const result = resolveStimulus('Models: {{models}}', {
      models: ['freemium', 'subscription', 'tiered'],
    })
    expect(result).toBe('Models: freemium, subscription, tiered')
  })

  it('substitutes boolean values as Yes/No', () => {
    const resultTrue = resolveStimulus('Has traction: {{has_traction}}', {
      has_traction: true,
    })
    expect(resultTrue).toBe('Has traction: Yes')

    const resultFalse = resolveStimulus('Has traction: {{has_traction}}', {
      has_traction: false,
    })
    expect(resultFalse).toBe('Has traction: No')
  })

  it('replaces missing optional variable (null/undefined/empty) with N/A', () => {
    expect(
      resolveStimulus('MRR: {{mrr}}', { mrr: undefined })
    ).toBe('MRR: N/A')
    expect(resolveStimulus('MRR: {{mrr}}', { mrr: null })).toBe('MRR: N/A')
    expect(resolveStimulus('MRR: {{mrr}}', { mrr: '' })).toBe('MRR: N/A')
  })

  it('leaves unknown variables as-is', () => {
    const result = resolveStimulus(
      'Company: {{company_name}}',
      { industry: 'fintech' }
    )
    expect(result).toBe('Company: {{company_name}}')
  })

  it('handles multiple substitutions in one template', () => {
    const result = resolveStimulus(
      '{{name}} in {{industry}} raising {{amount}}',
      { name: 'Acme', industry: 'SaaS', amount: 1000000 }
    )
    expect(result).toBe('Acme in SaaS raising 1000000')
  })
})

describe('buildDefaultStimulus', () => {
  it('generates investment-focused prompt for investor category', () => {
    const result = buildDefaultStimulus('investor', { stage: 'seed' })
    expect(result).toContain(
      'You are evaluating a startup for investment.'
    )
    expect(result).toContain('Stage: seed')
    expect(result).toContain('Your investment decision (PASS, INTERESTED, or INVEST)')
  })

  it('generates pricing-focused prompt for pricing category', () => {
    const result = buildDefaultStimulus('pricing', {
      product_name: 'DataPipe',
    })
    expect(result).toContain('You are evaluating a product and its pricing.')
    expect(result).toContain('Product Name: DataPipe')
    expect(result).toContain('Which pricing model you prefer and why')
  })

  it('generates prioritization-focused prompt for roadmap category', () => {
    const result = buildDefaultStimulus('roadmap', {
      timeframe: 'next-quarter',
    })
    expect(result).toContain(
      'You are a user providing feedback on product feature priorities.'
    )
    expect(result).toContain('Timeframe: next-quarter')
    expect(result).toContain('Priority rank (where 1 is most important)')
  })

  it('generates generic prompt for unknown category', () => {
    const result = buildDefaultStimulus('custom', { question: 'answer' })
    expect(result).toContain(
      'You are providing feedback on a business decision.'
    )
    expect(result).toContain('Question: answer')
    expect(result).toContain('Your overall assessment')
  })

  it('normalizes category with trailing s (e.g., "investors")', () => {
    const result = buildDefaultStimulus('investors', { stage: 'seed' })
    expect(result).toContain(
      'You are evaluating a startup for investment.'
    )
  })

  it('formats array answer values joined with comma', () => {
    const result = buildDefaultStimulus('pricing', {
      models: ['freemium', 'tiered'],
    })
    expect(result).toContain('Models: freemium, tiered')
  })

  it('formats boolean answer values as Yes/No', () => {
    const result = buildDefaultStimulus('investor', { has_traction: true })
    expect(result).toContain('Has Traction: Yes')
  })

  it('formats null answer values as N/A', () => {
    const result = buildDefaultStimulus('investor', { mrr: null })
    expect(result).toContain('Mrr: N/A')
  })
})

describe('getDefaultAnalysis', () => {
  it('returns investor-specific metrics including investment_rate and pass_rate', () => {
    const { metrics } = getDefaultAnalysis('investor')
    const ids = metrics.map(m => m.id)
    expect(ids).toContain('investment_rate')
    expect(ids).toContain('pass_rate')
    expect(ids).toContain('avg_sentiment')
  })

  it('returns investor-specific insights', () => {
    const { insights } = getDefaultAnalysis('investor')
    const ids = insights.map(i => i.id)
    expect(ids).toContain('top_concerns')
    expect(ids).toContain('investor_type_breakdown')
    expect(ids).toContain('key_questions')
  })

  it('returns pricing-specific metrics including preferred_model and willingness_to_pay', () => {
    const { metrics } = getDefaultAnalysis('pricing')
    const ids = metrics.map(m => m.id)
    expect(ids).toContain('preferred_model')
    expect(ids).toContain('avg_willingness_to_pay')
    expect(ids).toContain('churn_risk')
  })

  it('returns pricing-specific insights', () => {
    const { insights } = getDefaultAnalysis('pricing')
    const ids = insights.map(i => i.id)
    expect(ids).toContain('model_preference_by_segment')
    expect(ids).toContain('price_sensitivity')
  })

  it('returns roadmap-specific metrics including feature_ranking and must_have_rate', () => {
    const { metrics } = getDefaultAnalysis('roadmap')
    const ids = metrics.map(m => m.id)
    expect(ids).toContain('feature_ranking')
    expect(ids).toContain('must_have_rate')
  })

  it('returns roadmap-specific insights', () => {
    const { insights } = getDefaultAnalysis('roadmap')
    const ids = insights.map(i => i.id)
    expect(ids).toContain('segment_preferences')
    expect(ids).toContain('upgrade_drivers')
  })

  it('returns generic analysis for unknown category', () => {
    const { metrics, insights } = getDefaultAnalysis('custom')
    expect(metrics).toHaveLength(1)
    expect(metrics[0]!.id).toBe('response_summary')
    expect(insights).toHaveLength(2)
    expect(insights[0]!.id).toBe('key_themes')
    expect(insights[1]!.id).toBe('segment_breakdown')
  })

  it('normalizes category with trailing s (e.g., "investors")', () => {
    const { metrics } = getDefaultAnalysis('investors')
    const ids = metrics.map(m => m.id)
    expect(ids).toContain('investment_rate')
  })
})

describe('YAML validity', () => {
  it('produces valid YAML that can be parsed', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    expect(() => load(yaml)).not.toThrow()
  })

  it('parsed YAML matches ExperimentConfig interface structure', () => {
    const yaml = generateExperimentConfig(makeInvestorInput())
    const config = parseYaml(yaml)

    // metadata
    expect(typeof config.metadata.id).toBe('string')
    expect(typeof config.metadata.version).toBe('string')
    expect(typeof config.metadata.created).toBe('string')
    expect(typeof config.metadata.template.id).toBe('string')
    expect(typeof config.metadata.template.slug).toBe('string')
    expect(typeof config.metadata.template.version).toBe('string')
    expect(typeof config.metadata.template.name).toBe('string')
    expect(typeof config.metadata.decision.id).toBe('string')
    expect(typeof config.metadata.decision.title).toBe('string')
    expect(typeof config.metadata.decision.markdownPath).toBe('string')

    // configuration
    expect(typeof config.configuration).toBe('object')

    // context
    expect(Array.isArray(config.context.files)).toBe(true)

    // personas
    expect(typeof config.personas.generationType).toBe('string')
    expect(typeof config.personas.count).toBe('number')
    expect(Array.isArray(config.personas.archetypes)).toBe(true)
    for (const arch of config.personas.archetypes) {
      expect(typeof arch.id).toBe('string')
      expect(typeof arch.name).toBe('string')
      expect(typeof arch.count).toBe('number')
    }

    // stimulus
    expect(typeof config.stimulus.template).toBe('string')

    // execution
    expect(typeof config.execution.provider).toBe('string')
    expect(typeof config.execution.model).toBe('string')
    expect(typeof config.execution.temperature).toBe('number')
    expect(typeof config.execution.maxTokens).toBe('number')
    expect(typeof config.execution.timeout).toBe('number')
    expect(typeof config.execution.parallelization).toBe('boolean')

    // analysis
    expect(Array.isArray(config.analysis.metrics)).toBe(true)
    expect(Array.isArray(config.analysis.insights)).toBe(true)

    // output
    expect(typeof config.output.format).toBe('string')
    expect(typeof config.output.resultsPath).toBe('string')
    expect(typeof config.output.gitAutoCommit).toBe('boolean')
  })

  it('produces valid YAML for pricing template', () => {
    const yaml = generateExperimentConfig(makePricingInput())
    expect(() => load(yaml)).not.toThrow()
    const config = parseYaml(yaml)
    expect(config.configuration.pricing_models).toEqual([
      'freemium',
      'usage-based',
      'tiered',
    ])
  })

  it('produces valid YAML for roadmap template', () => {
    const yaml = generateExperimentConfig(makeRoadmapInput())
    expect(() => load(yaml)).not.toThrow()
    const config = parseYaml(yaml)
    expect(config.configuration.timeframe).toBe('next-quarter')
  })
})
