import { describe, it, expect } from 'vitest'
import {
  validateText,
  validateSelect,
  validateMultiselect,
  validateNumber,
  validateBoolean,
  validateAnswer,
} from './config-validator'
import type { TemplateQuestion } from '@/types/template'

describe('validateText', () => {
  it('validates required text field - fails when empty', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: true,
    }

    expect(validateText(question, undefined).isValid).toBe(false)
    expect(validateText(question, '').isValid).toBe(false)
    expect(validateText(question, '  ').isValid).toBe(false)
  })

  it('validates required text field - passes when filled', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: true,
    }

    expect(validateText(question, 'valid text').isValid).toBe(true)
  })

  it('validates optional text field - passes when empty', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: false,
    }

    expect(validateText(question, undefined).isValid).toBe(true)
    expect(validateText(question, '').isValid).toBe(true)
  })

  it('validates maxLength constraint', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: false,
      maxLength: 10,
    }

    expect(validateText(question, '12345').isValid).toBe(true)
    expect(validateText(question, '1234567890').isValid).toBe(true)
    expect(validateText(question, '12345678901').isValid).toBe(false)
  })

  it('validates regex pattern', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: false,
      validation: {
        pattern: '^\\$[0-9]+(M|K)$',
        message: 'Enter amount like $2M or $500K',
      },
    }

    expect(validateText(question, '$2M').isValid).toBe(true)
    expect(validateText(question, '$500K').isValid).toBe(true)
    expect(validateText(question, '2M').isValid).toBe(false)
    expect(validateText(question, '$2m').isValid).toBe(false)
  })

  it('returns custom error message for regex validation', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: false,
      validation: {
        pattern: '^[A-Z]+$',
        message: 'Only uppercase letters allowed',
      },
    }

    const result = validateText(question, 'abc')
    expect(result.isValid).toBe(false)
    expect(result.error).toBe('Only uppercase letters allowed')
  })
})

describe('validateSelect', () => {
  it('validates required select - fails when empty', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'select',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateSelect(question, undefined).isValid).toBe(false)
  })

  it('validates required select - passes with valid option', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'select',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateSelect(question, 'a').isValid).toBe(true)
    expect(validateSelect(question, 'b').isValid).toBe(true)
  })

  it('validates select with object options', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'select',
      required: true,
      options: [
        { value: 'seed', label: 'Seed' },
        { value: 'series-a', label: 'Series A' },
      ],
    }

    expect(validateSelect(question, 'seed').isValid).toBe(true)
    expect(validateSelect(question, 'series-a').isValid).toBe(true)
    expect(validateSelect(question, 'invalid').isValid).toBe(false)
  })

  it('fails with invalid option', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'select',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateSelect(question, 'z').isValid).toBe(false)
  })
})

describe('validateMultiselect', () => {
  it('validates required multiselect - fails when empty', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'multiselect',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateMultiselect(question, undefined).isValid).toBe(false)
    expect(validateMultiselect(question, []).isValid).toBe(false)
  })

  it('validates required multiselect - passes with valid options', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'multiselect',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateMultiselect(question, ['a']).isValid).toBe(true)
    expect(validateMultiselect(question, ['a', 'b']).isValid).toBe(true)
    expect(validateMultiselect(question, ['a', 'b', 'c']).isValid).toBe(true)
  })

  it('fails with invalid option in selection', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'multiselect',
      required: true,
      options: ['a', 'b', 'c'],
    }

    expect(validateMultiselect(question, ['a', 'z']).isValid).toBe(false)
  })
})

describe('validateNumber', () => {
  it('validates required number - fails when undefined', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: true,
    }

    expect(validateNumber(question, undefined).isValid).toBe(false)
  })

  it('validates required number - passes with valid number', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: true,
    }

    expect(validateNumber(question, 0).isValid).toBe(true)
    expect(validateNumber(question, 42).isValid).toBe(true)
    expect(validateNumber(question, -10).isValid).toBe(true)
  })

  it('validates min constraint', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: false,
      min: 10,
    }

    expect(validateNumber(question, 5).isValid).toBe(false)
    expect(validateNumber(question, 10).isValid).toBe(true)
    expect(validateNumber(question, 15).isValid).toBe(true)
  })

  it('validates max constraint', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: false,
      max: 100,
    }

    expect(validateNumber(question, 50).isValid).toBe(true)
    expect(validateNumber(question, 100).isValid).toBe(true)
    expect(validateNumber(question, 101).isValid).toBe(false)
  })

  it('validates min and max constraints together', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: false,
      min: 10,
      max: 100,
    }

    expect(validateNumber(question, 5).isValid).toBe(false)
    expect(validateNumber(question, 10).isValid).toBe(true)
    expect(validateNumber(question, 50).isValid).toBe(true)
    expect(validateNumber(question, 100).isValid).toBe(true)
    expect(validateNumber(question, 101).isValid).toBe(false)
  })

  it('fails with NaN', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: false,
    }

    expect(validateNumber(question, Number.NaN).isValid).toBe(false)
  })
})

describe('validateBoolean', () => {
  it('validates required boolean - fails when undefined', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'boolean',
      required: true,
    }

    expect(validateBoolean(question, undefined).isValid).toBe(false)
  })

  it('validates required boolean - passes with true/false', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'boolean',
      required: true,
    }

    expect(validateBoolean(question, true).isValid).toBe(true)
    expect(validateBoolean(question, false).isValid).toBe(true)
  })

  it('validates optional boolean - passes when undefined', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'boolean',
      required: false,
    }

    expect(validateBoolean(question, undefined).isValid).toBe(true)
  })
})

describe('validateAnswer (dispatcher)', () => {
  it('dispatches to validateText for text type', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'text',
      required: true,
    }

    expect(validateAnswer(question, 'valid').isValid).toBe(true)
    expect(validateAnswer(question, '').isValid).toBe(false)
  })

  it('dispatches to validateSelect for select type', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'select',
      required: true,
      options: ['a', 'b'],
    }

    expect(validateAnswer(question, 'a').isValid).toBe(true)
    expect(validateAnswer(question, 'z').isValid).toBe(false)
  })

  it('dispatches to validateNumber for number type', () => {
    const question: TemplateQuestion = {
      id: 'test',
      question: 'Test',
      type: 'number',
      required: true,
    }

    expect(validateAnswer(question, 42).isValid).toBe(true)
    expect(validateAnswer(question, undefined).isValid).toBe(false)
  })
})
