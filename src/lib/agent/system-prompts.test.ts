import { describe, it, expect } from 'vitest'
import {
  buildSystemPrompt,
  buildGreetingMessage,
  buildErrorMessage,
} from './system-prompts'
import type { Doc } from '@/convex/_generated/dataModel'
import type { Id } from '@/convex/_generated/dataModel'

describe('System Prompts', () => {
  const mockTemplates: Doc<'experimentTemplates'>[] = [
    {
      _id: 'tmpl1' as Id<'experimentTemplates'>,
      _creationTime: Date.now(),
      name: 'Investor Evaluation',
      slug: 'investor-evaluation',
      category: 'investor',
      description: 'Test investor interest in your pitch',
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
      description: 'Test different pricing models',
      yamlContent: 'yaml',
      version: '1.0',
      isPublished: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  describe('buildSystemPrompt', () => {
    it('includes role definition', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('Decision Support Assistant')
      expect(prompt).toContain('helping founders make data-driven decisions')
    })

    it('includes all templates with descriptions', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('Investor Evaluation')
      expect(prompt).toContain('investor-evaluation')
      expect(prompt).toContain('Test investor interest in your pitch')

      expect(prompt).toContain('Pricing Strategy')
      expect(prompt).toContain('pricing-strategy')
      expect(prompt).toContain('Test different pricing models')
    })

    it('includes conversation guidelines', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('Conversation Guidelines')
      expect(prompt).toContain('First Message')
      expect(prompt).toContain('clarifying questions')
    })

    it('includes output format instructions', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('Output Format')
      expect(prompt).toContain('Natural Language')
      expect(prompt).toContain('JSON Tool Calls')
    })

    it('numbers templates correctly', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('1. **Investor Evaluation**')
      expect(prompt).toContain('2. **Pricing Strategy**')
    })

    it('handles empty template list', () => {
      const prompt = buildSystemPrompt([])

      // Should still have base structure
      expect(prompt).toContain('Decision Support Assistant')
      expect(prompt).toContain('Available Templates')
      expect(prompt).toContain('Conversation Guidelines')
    })

    it('formats templates with category labels', () => {
      const prompt = buildSystemPrompt(mockTemplates)

      expect(prompt).toContain('(investor)')
      expect(prompt).toContain('(pricing)')
    })
  })

  describe('buildGreetingMessage', () => {
    it('includes friendly greeting', () => {
      const greeting = buildGreetingMessage()

      expect(greeting).toContain('Hello')
      expect(greeting).toContain('Decision Support Assistant')
    })

    it('includes example prompts', () => {
      const greeting = buildGreetingMessage()

      expect(greeting).toContain('Should I raise seed funding')
      expect(greeting).toContain('How should I price')
      expect(greeting).toContain('Which features should I prioritize')
    })

    it('encourages user input', () => {
      const greeting = buildGreetingMessage()

      expect(greeting).toContain('What decision are you facing')
      expect(greeting).toContain('describe your decision')
    })
  })

  describe('buildErrorMessage', () => {
    it('provides generic user-friendly error', () => {
      const error = buildErrorMessage()

      expect(error).toContain('trouble')
      expect(error).toContain('try again')
      expect(error).not.toContain('error')
      expect(error).not.toContain('exception')
      expect(error).not.toContain('stack trace')
    })

    it('is short and actionable', () => {
      const error = buildErrorMessage()

      // Should be 1-2 sentences (split by period gives empty string after last period)
      const sentences = error.split('.').filter(s => s.trim().length > 0)
      expect(sentences.length).toBeLessThanOrEqual(2)
    })
  })
})
