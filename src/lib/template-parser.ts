/**
 * YAML template parser.
 *
 * Parses template YAML content from Convex into a structured ParsedTemplate object.
 * Validates the structure and returns null if parsing fails.
 *
 * Used by ConfigWizard to extract configuration questions from templates.
 */

import { load } from 'js-yaml'
import type { ParsedTemplate, TemplateQuestion } from '@/types/template'
import { logger } from '@/lib/logger'

/**
 * Parse YAML template content into structured format.
 * Returns null if parsing fails or required fields are missing.
 *
 * @param yamlContent - Raw YAML string from template.yamlContent
 * @returns Parsed template or null if invalid
 */
export function parseTemplateYaml(yamlContent: string): ParsedTemplate | null {
  try {
    const parsed = load(yamlContent) as Record<string, unknown>

    // Validate required top-level fields
    // Note: description and category are optional
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.name !== 'string' ||
      typeof parsed.version !== 'string' ||
      !Array.isArray(parsed.configurationFlow)
    ) {
      logger.error('Invalid template YAML: missing required fields', { parsed })
      return null
    }

    // Return early if no questions
    if (parsed.configurationFlow.length === 0) {
      logger.warn('Template has no configuration questions')
      return null
    }

    // Parse configuration questions
    const questions: TemplateQuestion[] = []
    for (const q of parsed.configurationFlow) {
      if (typeof q !== 'object' || q === null) {
        logger.warn('Invalid question in configurationFlow', { q })
        continue
      }

      const question = q as Record<string, unknown>

      // Validate required question fields
      if (
        typeof question.id !== 'string' ||
        typeof question.question !== 'string' ||
        typeof question.type !== 'string'
      ) {
        logger.warn('Question missing required fields', { question })
        continue
      }

      // Parse options for select/multiselect
      let options: TemplateQuestion['options']
      if (Array.isArray(question.options)) {
        options = question.options.map(opt => {
          if (typeof opt === 'string') {
            return opt
          }
          if (
            typeof opt === 'object' &&
            opt !== null &&
            typeof (opt as { value?: unknown }).value === 'string' &&
            typeof (opt as { label?: unknown }).label === 'string'
          ) {
            return {
              value: (opt as { value: string }).value,
              label: (opt as { label: string }).label,
            }
          }
          return String(opt)
        })
      }

      // Parse validation for text fields
      let validation: TemplateQuestion['validation']
      if (
        typeof question.validation === 'object' &&
        question.validation !== null
      ) {
        const v = question.validation as Record<string, unknown>
        if (typeof v.pattern === 'string') {
          validation = {
            pattern: v.pattern,
            message: typeof v.message === 'string' ? v.message : '',
          }
        }
      }

      questions.push({
        id: question.id,
        question: question.question,
        type: question.type as TemplateQuestion['type'],
        required: question.required === true,
        placeholder:
          typeof question.placeholder === 'string'
            ? question.placeholder
            : undefined,
        default: question.default,
        options,
        validation,
        maxLength:
          typeof question.maxLength === 'number'
            ? question.maxLength
            : undefined,
        min: typeof question.min === 'number' ? question.min : undefined,
        max: typeof question.max === 'number' ? question.max : undefined,
        unit: typeof question.unit === 'string' ? question.unit : undefined,
      })
    }

    return {
      id: parsed.id,
      version: parsed.version,
      name: parsed.name,
      description:
        typeof parsed.description === 'string' ? parsed.description : '',
      category: typeof parsed.category === 'string' ? parsed.category : '',
      configurationFlow: questions,
    }
  } catch (error) {
    logger.error('Failed to parse template YAML', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Get a specific question from a parsed template by ID.
 */
export function getQuestionById(
  template: ParsedTemplate,
  questionId: string
): TemplateQuestion | null {
  return template.configurationFlow.find(q => q.id === questionId) || null
}
