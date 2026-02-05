import { describe, it, expect } from 'vitest'
import { parseTemplateYaml, getQuestionById } from './template-parser'

describe('parseTemplateYaml', () => {
  it('parses valid template YAML', () => {
    const yaml = `
id: test-template
version: "1.0"
name: Test Template
description: A test template
category: testing

configurationFlow:
  - id: question1
    question: What is your name?
    type: text
    required: true
  - id: question2
    question: Select an option
    type: select
    required: false
    options:
      - value: a
        label: Option A
      - value: b
        label: Option B
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    expect(result?.id).toBe('test-template')
    expect(result?.version).toBe('1.0')
    expect(result?.name).toBe('Test Template')
    expect(result?.description).toBe('A test template')
    expect(result?.category).toBe('testing')
    expect(result?.configurationFlow).toHaveLength(2)
  })

  it('parses text question with validation', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: amount
    question: Enter amount
    type: text
    required: true
    placeholder: e.g., $2M
    maxLength: 50
    validation:
      pattern: "^\\\\$[0-9]+(M|K)$"
      message: Enter amount like $2M or $500K
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.id).toBe('amount')
    expect(question?.type).toBe('text')
    expect(question?.required).toBe(true)
    expect(question?.placeholder).toBe('e.g., $2M')
    expect(question?.maxLength).toBe(50)
    expect(question?.validation?.pattern).toBe('^\\$[0-9]+(M|K)$')
    expect(question?.validation?.message).toBe('Enter amount like $2M or $500K')
  })

  it('parses select question with string options', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: stage
    question: Select stage
    type: select
    required: true
    options:
      - seed
      - series-a
      - series-b
    default: seed
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.id).toBe('stage')
    expect(question?.type).toBe('select')
    expect(question?.options).toEqual(['seed', 'series-a', 'series-b'])
    expect(question?.default).toBe('seed')
  })

  it('parses select question with object options', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: stage
    question: Select stage
    type: select
    required: true
    options:
      - value: seed
        label: Seed Stage
      - value: series-a
        label: Series A
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.options).toEqual([
      { value: 'seed', label: 'Seed Stage' },
      { value: 'series-a', label: 'Series A' },
    ])
  })

  it('parses number question with constraints', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: target
    question: Funding target
    type: number
    required: true
    min: 100000
    max: 10000000
    unit: USD
    default: 2000000
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.type).toBe('number')
    expect(question?.min).toBe(100000)
    expect(question?.max).toBe(10000000)
    expect(question?.unit).toBe('USD')
    expect(question?.default).toBe(2000000)
  })

  it('parses textarea question', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: description
    question: Describe your product
    type: textarea
    required: true
    placeholder: Tell us about it...
    maxLength: 500
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.type).toBe('textarea')
    expect(question?.maxLength).toBe(500)
  })

  it('parses multiselect question', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: models
    question: Select pricing models
    type: multiselect
    required: true
    options:
      - value: freemium
        label: Freemium
      - value: subscription
        label: Subscription
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.type).toBe('multiselect')
    expect(question?.options).toHaveLength(2)
  })

  it('parses boolean question', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: agreed
    question: Do you agree?
    type: boolean
    required: true
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.type).toBe('boolean')
    expect(question?.required).toBe(true)
  })

  it('returns null for invalid YAML', () => {
    const yaml = 'invalid: yaml: structure: {'

    const result = parseTemplateYaml(yaml)

    expect(result).toBeNull()
  })

  it('returns null when required fields missing', () => {
    const yaml = `
name: Test Template
description: Missing id and version
configurationFlow: []
`

    const result = parseTemplateYaml(yaml)

    expect(result).toBeNull()
  })

  it('returns null when configurationFlow is not an array', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow: "not an array"
`

    const result = parseTemplateYaml(yaml)

    expect(result).toBeNull()
  })

  it('skips invalid questions in configurationFlow', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: valid
    question: Valid question
    type: text
    required: true
  - invalid_structure
  - id: also-valid
    question: Another valid question
    type: select
    required: false
    options: [a, b]
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    expect(result?.configurationFlow).toHaveLength(2)
    expect(result?.configurationFlow[0]?.id).toBe('valid')
    expect(result?.configurationFlow[1]?.id).toBe('also-valid')
  })

  it('handles missing optional fields gracefully', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: minimal
    question: Minimal question
    type: text
    required: true
`

    const result = parseTemplateYaml(yaml)

    expect(result).not.toBeNull()
    const question = result?.configurationFlow[0]
    expect(question?.placeholder).toBeUndefined()
    expect(question?.default).toBeUndefined()
    expect(question?.options).toBeUndefined()
    expect(question?.validation).toBeUndefined()
  })
})

describe('getQuestionById', () => {
  it('finds question by id', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: q1
    question: Question 1
    type: text
    required: true
  - id: q2
    question: Question 2
    type: select
    required: false
    options: [a, b]
`

    const template = parseTemplateYaml(yaml)
    expect(template).not.toBeNull()
    if (!template) return

    const question = getQuestionById(template, 'q2')
    expect(question).not.toBeNull()
    expect(question?.id).toBe('q2')
    expect(question?.question).toBe('Question 2')
  })

  it('returns null for non-existent id', () => {
    const yaml = `
id: test
version: "1.0"
name: Test
configurationFlow:
  - id: q1
    question: Question 1
    type: text
    required: true
`

    const template = parseTemplateYaml(yaml)
    expect(template).not.toBeNull()
    if (!template) return

    const question = getQuestionById(template, 'non-existent')
    expect(question).toBeNull()
  })
})
