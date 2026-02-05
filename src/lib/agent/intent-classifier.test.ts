import { describe, it, expect } from 'vitest'
import { classifyIntent, requiresTemplateHelp } from './intent-classifier'
import type { Doc } from '../../../convex/_generated/dataModel'
import type { Id } from '../../../convex/_generated/dataModel'

describe('Intent Classifier', () => {
  const mockTemplates: Doc<'experimentTemplates'>[] = [
    {
      _id: 'tmpl1' as Id<'experimentTemplates'>,
      _creationTime: Date.now(),
      name: 'Investor Evaluation',
      slug: 'investor-evaluation',
      category: 'investor',
      description: 'Test investor interest',
      yamlContent: 'yaml',
      version: '1.0',
      isPublished: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      _id: 'tmpl2' as Id<'experimentTemplates'>,
      _creationTime: Date.now(),
      name: 'Pricing Strategy',
      slug: 'pricing-strategy',
      category: 'pricing',
      description: 'Test pricing',
      yamlContent: 'yaml',
      version: '1.0',
      isPublished: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      _id: 'tmpl3' as Id<'experimentTemplates'>,
      _creationTime: Date.now(),
      name: 'Product Roadmap',
      slug: 'product-roadmap',
      category: 'roadmap',
      description: 'Prioritize features',
      yamlContent: 'yaml',
      version: '1.0',
      isPublished: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  describe('classifyIntent', () => {
    it('identifies investor-related intent', () => {
      const message = 'Should I raise seed funding from VCs or angels?'
      const result = classifyIntent(message, mockTemplates)

      expect(result.suggestions.length).toBeGreaterThan(0)
      const firstSuggestion = result.suggestions[0]
      expect(firstSuggestion).toBeDefined()
      expect(firstSuggestion?.template.slug).toBe('investor-evaluation')
      expect(firstSuggestion?.confidence).toBeGreaterThan(0)
      // Check that some investor-related keywords were matched
      expect(firstSuggestion?.matchedKeywords.length).toBeGreaterThan(0)
      // Could be 'seed', 'vc', 'angel', etc. - all are valid matches
    })

    it('identifies pricing-related intent', () => {
      const message = 'How should I price my SaaS subscription tiers?'
      const result = classifyIntent(message, mockTemplates)

      expect(result.suggestions.length).toBeGreaterThan(0)
      const firstSuggestion = result.suggestions[0]
      expect(firstSuggestion).toBeDefined()
      expect(firstSuggestion?.template.slug).toBe('pricing-strategy')
      expect(firstSuggestion?.confidence).toBeGreaterThan(0)
      expect(firstSuggestion?.matchedKeywords).toContain('pric')
    })

    it('identifies roadmap-related intent', () => {
      const message = 'Which features should I prioritize in my product roadmap?'
      const result = classifyIntent(message, mockTemplates)

      expect(result.suggestions.length).toBeGreaterThan(0)
      const firstSuggestion = result.suggestions[0]
      expect(firstSuggestion).toBeDefined()
      expect(firstSuggestion?.template.slug).toBe('product-roadmap')
      expect(firstSuggestion?.confidence).toBeGreaterThan(0)
      expect(firstSuggestion?.matchedKeywords.length).toBeGreaterThan(0)
    })

    it('returns empty suggestions for unrelated messages', () => {
      const message = 'Hello, how are you?'
      const result = classifyIntent(message, mockTemplates)

      expect(result.suggestions.length).toBe(0)
      expect(result.keywords.length).toBe(0)
    })

    it('handles multiple keyword matches', () => {
      const message = 'Should I raise funding and what pricing strategy should I use?'
      const result = classifyIntent(message, mockTemplates)

      // Should match both investor and pricing templates
      expect(result.suggestions.length).toBe(2)
      expect(result.keywords.length).toBeGreaterThan(0)
    })

    it('returns top 2 suggestions only', () => {
      const message =
        'Should I raise funding with good pricing and prioritize roadmap features?'
      const result = classifyIntent(message, mockTemplates)

      // Maximum 2 suggestions per spec
      expect(result.suggestions.length).toBeLessThanOrEqual(2)
    })

    it('normalizes text case-insensitively', () => {
      const lowerCase = 'should i raise funding?'
      const upperCase = 'SHOULD I RAISE FUNDING?'
      const mixedCase = 'ShOuLd I rAiSe FuNdInG?'

      const result1 = classifyIntent(lowerCase, mockTemplates)
      const result2 = classifyIntent(upperCase, mockTemplates)
      const result3 = classifyIntent(mixedCase, mockTemplates)

      expect(result1.suggestions[0]?.template.slug).toBe(
        result2.suggestions[0]?.template.slug
      )
      expect(result2.suggestions[0]?.template.slug).toBe(
        result3.suggestions[0]?.template.slug
      )
    })

    it('handles punctuation correctly', () => {
      const message = 'Should I raise funding? Or price differently!'
      const result = classifyIntent(message, mockTemplates)

      expect(result.suggestions.length).toBeGreaterThan(0)
      // Should still match keywords despite punctuation
    })
  })

  describe('requiresTemplateHelp', () => {
    it('detects question indicators', () => {
      expect(requiresTemplateHelp('Should I raise funding?')).toBe(true)
      expect(requiresTemplateHelp('How do I price my product?')).toBe(true)
      expect(requiresTemplateHelp('What features should I build?')).toBe(true)
      expect(requiresTemplateHelp('Which strategy is best?')).toBe(true)
    })

    it('detects decision indicators', () => {
      expect(requiresTemplateHelp('I need to decide on pricing')).toBe(true)
      expect(requiresTemplateHelp('Help me make a decision about features')).toBe(true)
    })

    it('returns false for statements', () => {
      expect(requiresTemplateHelp('Hello')).toBe(false)
      expect(requiresTemplateHelp('Thank you')).toBe(false)
      expect(requiresTemplateHelp('I understand')).toBe(false)
    })

    it('is case-insensitive', () => {
      expect(requiresTemplateHelp('SHOULD I RAISE FUNDING?')).toBe(true)
      expect(requiresTemplateHelp('should i raise funding?')).toBe(true)
    })
  })
})
