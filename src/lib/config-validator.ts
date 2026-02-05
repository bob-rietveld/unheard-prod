/**
 * Configuration validation utilities for template wizard.
 *
 * Validates user input against template question requirements:
 * - Required field validation
 * - Type-specific validation (text, select, number, boolean)
 * - Regex pattern validation for text fields
 * - Min/max validation for number fields
 *
 * Used by ConfigWizard to validate answers before allowing progression.
 */

import type { TemplateQuestion, ValidationResult } from '@/types/template'

/**
 * Validate a text input answer.
 * Checks required, length constraints, and optional regex pattern.
 */
export function validateText(
  question: TemplateQuestion,
  value: string | undefined
): ValidationResult {
  // Required check
  if (question.required && (!value || value.trim() === '')) {
    return {
      isValid: false,
      error: `This field is required`,
    }
  }

  // If not required and empty, it's valid
  if (!value || value.trim() === '') {
    return { isValid: true }
  }

  // Max length check
  if (question.maxLength && value.length > question.maxLength) {
    return {
      isValid: false,
      error: `Maximum ${question.maxLength} characters allowed`,
    }
  }

  // Regex pattern validation (if specified)
  if (question.validation?.pattern) {
    const regex = new RegExp(question.validation.pattern)
    if (!regex.test(value)) {
      return {
        isValid: false,
        error:
          question.validation.message ||
          `Value does not match the required format`,
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate a select input answer.
 * Ensures value is one of the allowed options.
 */
export function validateSelect(
  question: TemplateQuestion,
  value: string | undefined
): ValidationResult {
  // Required check
  if (question.required && !value) {
    return {
      isValid: false,
      error: `Please select an option`,
    }
  }

  // If not required and empty, it's valid
  if (!value) {
    return { isValid: true }
  }

  // Ensure value is in options
  if (question.options) {
    const validValues = question.options.map(opt =>
      typeof opt === 'string' ? opt : opt.value
    )
    if (!validValues.includes(value)) {
      return {
        isValid: false,
        error: `Invalid selection`,
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate a multiselect input answer.
 * Ensures all values are valid options.
 */
export function validateMultiselect(
  question: TemplateQuestion,
  value: string[] | undefined
): ValidationResult {
  // Required check
  if (question.required && (!value || value.length === 0)) {
    return {
      isValid: false,
      error: `Please select at least one option`,
    }
  }

  // If not required and empty, it's valid
  if (!value || value.length === 0) {
    return { isValid: true }
  }

  // Ensure all values are in options
  if (question.options) {
    const validValues = question.options.map(opt =>
      typeof opt === 'string' ? opt : opt.value
    )
    const invalidValues = value.filter(v => !validValues.includes(v))
    if (invalidValues.length > 0) {
      return {
        isValid: false,
        error: `Invalid selections: ${invalidValues.join(', ')}`,
      }
    }
  }

  return { isValid: true }
}

/**
 * Validate a number input answer.
 * Checks required, min, and max constraints.
 */
export function validateNumber(
  question: TemplateQuestion,
  value: number | undefined
): ValidationResult {
  // Required check
  if (question.required && (value === undefined || value === null)) {
    return {
      isValid: false,
      error: `This field is required`,
    }
  }

  // If not required and empty, it's valid
  if (value === undefined || value === null) {
    return { isValid: true }
  }

  // Type check
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return {
      isValid: false,
      error: `Please enter a valid number`,
    }
  }

  // Min check
  if (question.min !== undefined && value < question.min) {
    return {
      isValid: false,
      error: `Value must be at least ${question.min}${question.unit ? ` ${question.unit}` : ''}`,
    }
  }

  // Max check
  if (question.max !== undefined && value > question.max) {
    return {
      isValid: false,
      error: `Value must be at most ${question.max}${question.unit ? ` ${question.unit}` : ''}`,
    }
  }

  return { isValid: true }
}

/**
 * Validate a boolean input answer.
 * Always valid since it's a toggle (true/false/undefined).
 */
export function validateBoolean(
  question: TemplateQuestion,
  value: boolean | undefined
): ValidationResult {
  // Required check
  if (question.required && value === undefined) {
    return {
      isValid: false,
      error: `Please select Yes or No`,
    }
  }

  return { isValid: true }
}

/**
 * Main validation dispatcher.
 * Routes to appropriate validator based on question type.
 */
export function validateAnswer(
  question: TemplateQuestion,
  value: unknown
): ValidationResult {
  switch (question.type) {
    case 'text':
    case 'textarea':
      return validateText(question, value as string | undefined)

    case 'select':
      return validateSelect(question, value as string | undefined)

    case 'multiselect':
      return validateMultiselect(question, value as string[] | undefined)

    case 'number':
      return validateNumber(question, value as number | undefined)

    case 'boolean':
      return validateBoolean(question, value as boolean | undefined)

    default:
      return {
        isValid: false,
        error: `Unknown question type: ${(question as TemplateQuestion).type}`,
      }
  }
}
