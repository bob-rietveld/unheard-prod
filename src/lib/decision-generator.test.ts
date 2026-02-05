import { describe, expect, it } from 'vitest'
import {
  formatConfigAnswers,
  generateDecisionId,
  generateDecisionLog,
  generateFilename,
  generateFrontmatter,
  sanitizeFilename,
  type DecisionConfig,
  type DecisionLogMetadata,
} from './decision-generator'
import type { ParsedTemplate } from '@/types/template'

describe('sanitizeFilename', () => {
  it('converts to lowercase', () => {
    expect(sanitizeFilename('Test Title')).toBe('test-title')
  })

  it('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('multiple word title')).toBe('multiple-word-title')
  })

  it('removes special characters', () => {
    expect(sanitizeFilename('Title!@#$%^&*()123')).toBe('title123')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('title---with---hyphens')).toBe(
      'title-with-hyphens'
    )
  })

  it('removes leading and trailing hyphens', () => {
    expect(sanitizeFilename('-leading-and-trailing-')).toBe(
      'leading-and-trailing'
    )
  })

  it('truncates to 50 characters', () => {
    const longTitle =
      'this is a very long title that exceeds fifty characters in length'
    const result = sanitizeFilename(longTitle)
    expect(result.length).toBeLessThanOrEqual(50)
  })

  it('handles empty string', () => {
    expect(sanitizeFilename('')).toBe('')
  })

  it('handles string with only special characters', () => {
    expect(sanitizeFilename('!@#$%^&*()')).toBe('')
  })
})

describe('generateFilename', () => {
  it('generates filename with date prefix and slug', () => {
    const filename = generateFilename('Test Decision')
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-test-decision\.md$/)
  })

  it('handles duplicate detection by appending -2', () => {
    const date = new Date().toISOString().split('T')[0] // Current date
    const checkDuplicate = (fn: string) => fn === `${date}-test.md`
    const filename = generateFilename('Test', checkDuplicate)
    expect(filename).toBe(`${date}-test-2.md`)
  })

  it('handles multiple duplicates by incrementing counter', () => {
    const date = new Date().toISOString().split('T')[0] // Current date
    const existingFiles = new Set([
      `${date}-test.md`,
      `${date}-test-2.md`,
    ])
    const checkDuplicate = (fn: string) => existingFiles.has(fn)
    const filename = generateFilename('Test', checkDuplicate)
    expect(filename).toBe(`${date}-test-3.md`)
  })

  it('does not append suffix when no duplicates', () => {
    const checkDuplicate = () => false
    const filename = generateFilename('Unique Title', checkDuplicate)
    expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-unique-title\.md$/)
    expect(filename).not.toContain('-2')
  })
})

describe('generateDecisionId', () => {
  it('generates ID with dec prefix, date, and slug', () => {
    const id = generateDecisionId('Test Decision')
    expect(id).toMatch(/^dec-\d{4}-\d{2}-\d{2}-test-decision$/)
  })

  it('sanitizes title in ID', () => {
    const id = generateDecisionId('Title with Special!@#')
    expect(id).toMatch(/^dec-\d{4}-\d{2}-\d{2}-title-with-special$/)
  })
})

describe('generateFrontmatter', () => {
  it('generates valid YAML frontmatter', () => {
    const metadata: DecisionLogMetadata = {
      id: 'dec-2026-02-04-test',
      title: 'Test Decision',
      category: 'investor-evaluation',
      template: 'investor-evaluation-v1',
      status: 'ready',
      created: '2026-02-04T14:30:00Z',
    }

    const frontmatter = generateFrontmatter(metadata)

    expect(frontmatter).toContain('---')
    expect(frontmatter).toContain('id: dec-2026-02-04-test')
    expect(frontmatter).toContain('title: Test Decision')
    expect(frontmatter).toContain('category: investor-evaluation')
    expect(frontmatter).toContain('template: investor-evaluation-v1')
    expect(frontmatter).toContain('status: ready')
    expect(frontmatter).toContain('created: 2026-02-04T14:30:00Z')
  })
})

describe('formatConfigAnswers', () => {
  it('formats simple key-value pairs', () => {
    const answers = {
      stage: 'Seed',
      amount: '$2M',
    }

    const result = formatConfigAnswers(answers)

    expect(result).toContain('- **stage**: Seed')
    expect(result).toContain('- **amount**: $2M')
  })

  it('uses question labels from template', () => {
    const answers = {
      stage: 'Seed',
    }

    const template: ParsedTemplate = {
      id: 'test',
      version: '1',
      name: 'Test',
      description: 'Test template',
      category: 'test',
      configurationFlow: [
        {
          id: 'stage',
          question: 'What stage are you at?',
          type: 'select',
          required: true,
          options: ['Seed', 'Series A'],
        },
      ],
    }

    const result = formatConfigAnswers(answers, template)

    expect(result).toContain('- **What stage are you at?**: Seed')
  })

  it('handles array values', () => {
    const answers = {
      industries: ['SaaS', 'Developer Tools'],
    }

    const result = formatConfigAnswers(answers)

    expect(result).toContain('- **industries**: SaaS, Developer Tools')
  })

  it('handles object values as JSON', () => {
    const answers = {
      metadata: { key: 'value', count: 42 },
    }

    const result = formatConfigAnswers(answers)

    expect(result).toContain('- **metadata**: {"key":"value","count":42}')
  })

  it('handles boolean values', () => {
    const answers = {
      hasTraction: true,
    }

    const result = formatConfigAnswers(answers)

    expect(result).toContain('- **hasTraction**: true')
  })

  it('handles number values', () => {
    const answers = {
      mrr: 50000,
    }

    const result = formatConfigAnswers(answers)

    expect(result).toContain('- **mrr**: 50000')
  })
})

describe('generateDecisionLog', () => {
  it('generates complete markdown with all sections', () => {
    const config: DecisionConfig = {
      templateId: 'abc123',
      templateSlug: 'investor-evaluation-v1',
      category: 'investor-evaluation',
      title: 'Seed Fundraising Decision',
      context: 'Evaluating investor interest for $2M seed round',
      answers: {
        stage: 'Seed',
        amount: '$2M',
      },
      contextFiles: ['context/customers.csv', 'context/pitch-deck.pdf'],
    }

    const markdown = generateDecisionLog(config)

    // YAML frontmatter
    expect(markdown).toContain('---')
    expect(markdown).toContain('title: Seed Fundraising Decision')
    expect(markdown).toContain('category: investor-evaluation')
    expect(markdown).toContain('template: investor-evaluation-v1')
    expect(markdown).toContain('status: ready')

    // Title
    expect(markdown).toContain('# Seed Fundraising Decision')

    // Context section
    expect(markdown).toContain('## Context')
    expect(markdown).toContain('Evaluating investor interest for $2M seed round')

    // Configuration section
    expect(markdown).toContain('## Configuration')
    expect(markdown).toContain('- **stage**: Seed')
    expect(markdown).toContain('- **amount**: $2M')

    // Experiment Plan section
    expect(markdown).toContain('## Experiment Plan')
    expect(markdown).toContain('context/customers.csv')
    expect(markdown).toContain('context/pitch-deck.pdf')

    // Results section (placeholder)
    expect(markdown).toContain('## Results')
    expect(markdown).toContain('(To be filled after experiment runs)')

    // Decision section (placeholder)
    expect(markdown).toContain('## Decision')
    expect(markdown).toContain('(To be made after reviewing results)')

    // Footer
    expect(markdown).toContain('Auto-generated by Unheard v2 | Phase 2')
  })

  it('handles missing context gracefully', () => {
    const config: DecisionConfig = {
      templateId: 'abc123',
      templateSlug: 'test-v1',
      category: 'test',
      title: 'Test Decision',
      answers: {},
    }

    const markdown = generateDecisionLog(config)

    expect(markdown).toContain('No context provided')
  })

  it('handles empty context files', () => {
    const config: DecisionConfig = {
      templateId: 'abc123',
      templateSlug: 'test-v1',
      category: 'test',
      title: 'Test Decision',
      answers: {},
      contextFiles: [],
    }

    const markdown = generateDecisionLog(config)

    expect(markdown).toContain('No context files')
  })

  it('uses template for question labels', () => {
    const config: DecisionConfig = {
      templateId: 'abc123',
      templateSlug: 'test-v1',
      category: 'test',
      title: 'Test Decision',
      answers: {
        q1: 'Answer 1',
      },
    }

    const template: ParsedTemplate = {
      id: 'test',
      version: '1',
      name: 'Test',
      description: 'Test template',
      category: 'test',
      configurationFlow: [
        {
          id: 'q1',
          question: 'First Question?',
          type: 'text',
          required: true,
        },
      ],
    }

    const markdown = generateDecisionLog(config, template)

    expect(markdown).toContain('- **First Question?**: Answer 1')
  })
})
