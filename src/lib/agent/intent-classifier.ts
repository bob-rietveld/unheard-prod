import type { Doc } from '@/convex/_generated/dataModel'

/**
 * Template suggestion with confidence score.
 */
export interface TemplateSuggestion {
  template: Doc<'experimentTemplates'>
  confidence: number
  matchedKeywords: string[]
}

/**
 * Intent classification result.
 */
export interface IntentClassification {
  suggestions: TemplateSuggestion[]
  keywords: string[]
}

/**
 * Keyword patterns for each template category.
 * Simple keyword matching for MVP (Phase 2).
 * More sophisticated ML-based classification deferred to Phase 3+.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  investor: [
    'fundrais',
    'investor',
    'pitch',
    'vc',
    'angel',
    'seed',
    'series',
    'capital',
    'funding',
    'raise',
    'investment',
  ],
  pricing: [
    'pric',
    'cost',
    'monetiz',
    'revenue',
    'subscription',
    'freemium',
    'tier',
    'plan',
    'payment',
    'pay',
  ],
  roadmap: [
    'feature',
    'roadmap',
    'priorit',
    'backlog',
    'product',
    'develop',
    'build',
    'release',
    'sprint',
  ],
}

/**
 * Normalize text for keyword matching.
 * - Lowercase
 * - Remove punctuation
 * - Tokenize by whitespace
 */
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Check if a keyword pattern matches any token in the text.
 * Uses prefix matching (e.g., "pric" matches "price", "pricing", "priced").
 */
function matchesKeyword(tokens: string[], keyword: string): boolean {
  return tokens.some(token => token.startsWith(keyword))
}

/**
 * Calculate confidence score based on keyword matches.
 * Returns a score between 0 and 1.
 */
function calculateConfidence(matchCount: number, totalKeywords: number): number {
  // Simple linear scoring for MVP
  // More sophisticated scoring (TF-IDF, etc.) in Phase 3+
  return Math.min(matchCount / Math.max(totalKeywords * 0.3, 1), 1)
}

/**
 * Classify user message intent and suggest relevant templates.
 *
 * @param message - User's message text
 * @param templates - Available templates to match against
 * @returns Classification result with template suggestions
 *
 * Example:
 *   const result = classifyIntent("Should I raise seed funding?", templates)
 *   // result.suggestions[0].template.slug === "investor-evaluation"
 *   // result.suggestions[0].confidence === 0.8
 */
export function classifyIntent(
  message: string,
  templates: Doc<'experimentTemplates'>[]
): IntentClassification {
  const tokens = normalizeText(message)
  const suggestions: TemplateSuggestion[] = []

  // Score each template category
  const categoryScores = new Map<string, { count: number; keywords: string[] }>()

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matchedKeywords = keywords.filter(keyword => matchesKeyword(tokens, keyword))

    if (matchedKeywords.length > 0) {
      categoryScores.set(category, {
        count: matchedKeywords.length,
        keywords: matchedKeywords,
      })
    }
  }

  // Match templates to categories with scores
  for (const template of templates) {
    const score = categoryScores.get(template.category)

    if (score) {
      const confidence = calculateConfidence(
        score.count,
        CATEGORY_KEYWORDS[template.category]?.length || 1
      )

      suggestions.push({
        template,
        confidence,
        matchedKeywords: score.keywords,
      })
    }
  }

  // Sort by confidence (highest first)
  suggestions.sort((a, b) => b.confidence - a.confidence)

  // Return top 2 suggestions for Phase 2 (as per spec)
  const topSuggestions = suggestions.slice(0, 2)

  // Collect all matched keywords
  const allKeywords = Array.from(categoryScores.values()).flatMap(score => score.keywords)

  return {
    suggestions: topSuggestions,
    keywords: [...new Set(allKeywords)],
  }
}

/**
 * Check if a message likely requires template suggestion.
 * Returns true if message contains decision/question indicators.
 */
export function requiresTemplateHelp(message: string): boolean {
  const questionIndicators = ['should', 'how', 'what', 'which', 'decide', 'decision', '?']
  const normalized = message.toLowerCase()

  return questionIndicators.some(indicator => normalized.includes(indicator))
}
