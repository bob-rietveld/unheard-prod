/**
 * Template-related TypeScript types for the configuration wizard.
 * These types model the YAML template structure stored in Convex.
 */

/**
 * Question types supported by the configuration wizard.
 */
export type QuestionType =
  | 'text' // Single-line text input
  | 'textarea' // Multi-line text input
  | 'select' // Single selection dropdown
  | 'multiselect' // Multiple selection checkboxes
  | 'number' // Numeric input with optional min/max
  | 'boolean' // Yes/No toggle

/**
 * Option for select/multiselect questions.
 * Can be a simple string or an object with value/label.
 */
export type QuestionOption =
  | string
  | {
      value: string
      label: string
    }

/**
 * Validation rules for text inputs.
 */
export interface TextValidation {
  pattern: string // Regex pattern
  message: string // Error message if pattern doesn't match
}

/**
 * A single question in the template configuration flow.
 */
export interface TemplateQuestion {
  id: string // Unique question ID (used as key in configAnswers)
  question: string // Question text displayed to user
  type: QuestionType
  required: boolean
  placeholder?: string
  default?: unknown
  options?: QuestionOption[] // For select/multiselect
  validation?: TextValidation // For text/textarea
  maxLength?: number // For text/textarea
  min?: number // For number
  max?: number // For number
  unit?: string // For number (e.g., 'USD', 'days')
}

/**
 * Parsed template structure from YAML.
 */
export interface ParsedTemplate {
  id: string
  version: string
  name: string
  description: string
  category: string
  configurationFlow: TemplateQuestion[]
}

/**
 * Result of validation.
 */
export interface ValidationResult {
  isValid: boolean
  error?: string
}
