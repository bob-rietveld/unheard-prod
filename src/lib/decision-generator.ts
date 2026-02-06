/**
 * Decision log markdown generation utilities.
 *
 * Generates markdown files with YAML frontmatter for decision logs.
 * These files are committed to Git and tracked in Convex.
 */

import type { ParsedTemplate } from '@/types/template'

/**
 * Configuration data for a decision log.
 * This represents the user's answers to the template configuration wizard.
 */
export interface DecisionConfig {
  /** Template ID from Convex */
  templateId: string

  /** Template slug (e.g., 'investor-evaluation-v1') */
  templateSlug: string

  /** Template category (e.g., 'investor-evaluation') */
  category: string

  /** User-provided decision title */
  title: string

  /** Optional user-provided context description */
  context?: string

  /** Configuration answers (key-value pairs from wizard) */
  answers: Record<string, unknown>

  /** List of context files that were used (relative paths) */
  contextFiles?: string[]
}

/**
 * Metadata for the decision log markdown file.
 * This is serialized to YAML frontmatter.
 */
export interface DecisionLogMetadata {
  id: string
  title: string
  category: string
  template: string
  status: 'ready' | 'running' | 'completed'
  created: string
}

/**
 * Generate a unique decision log ID.
 * Format: dec-YYYY-MM-DD-{slug}
 */
export function generateDecisionId(title: string): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const slug = sanitizeFilename(title)
  return `dec-${date}-${slug}`
}

/**
 * Sanitize a title to create a valid filename slug.
 * - Lowercase
 * - Replace spaces with hyphens
 * - Remove special characters
 * - Truncate to 50 characters
 */
export function sanitizeFilename(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, 50) // Truncate to 50 characters
}

/**
 * Generate a filename for the decision log.
 * Format: YYYY-MM-DD-{slug}.md
 *
 * If a duplicate check function is provided, append a numeric suffix.
 */
export function generateFilename(
  title: string,
  checkDuplicate?: (filename: string) => boolean
): string {
  const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  const slug = sanitizeFilename(title)
  let filename = `${date}-${slug}.md`

  // Handle duplicates by appending -2, -3, etc.
  if (checkDuplicate) {
    let counter = 2
    while (checkDuplicate(filename)) {
      filename = `${date}-${slug}-${counter}.md`
      counter++
    }
  }

  return filename
}

/**
 * Generate YAML frontmatter for the decision log.
 */
export function generateFrontmatter(metadata: DecisionLogMetadata): string {
  return [
    '---',
    `id: ${metadata.id}`,
    `title: ${metadata.title}`,
    `category: ${metadata.category}`,
    `template: ${metadata.template}`,
    `status: ${metadata.status}`,
    `created: ${metadata.created}`,
    '---',
  ].join('\n')
}

/**
 * Format configuration answers as markdown key-value list.
 */
export function formatConfigAnswers(
  answers: Record<string, unknown>,
  template?: ParsedTemplate
): string {
  const lines: string[] = []

  for (const [key, value] of Object.entries(answers)) {
    // Find the question label from template if available
    const question = template?.configurationFlow.find(q => q.id === key)
    const label = question?.question || key

    // Format value
    let formattedValue: string
    if (Array.isArray(value)) {
      formattedValue = value.join(', ')
    } else if (typeof value === 'object' && value !== null) {
      formattedValue = JSON.stringify(value)
    } else {
      formattedValue = String(value)
    }

    lines.push(`- **${label}**: ${formattedValue}`)
  }

  return lines.join('\n')
}

/**
 * Generate the full decision log markdown content.
 *
 * @param config - Decision configuration from wizard answers
 * @param template - Optional parsed template for question labels
 * @param markdownPath - Optional path to the markdown file (used to derive experiment config path)
 */
export function generateDecisionLog(
  config: DecisionConfig,
  template?: ParsedTemplate,
  markdownPath?: string
): string {
  const id = generateDecisionId(config.title)
  const created = new Date().toISOString()

  const metadata: DecisionLogMetadata = {
    id,
    title: config.title,
    category: config.category,
    template: config.templateSlug,
    status: 'ready',
    created,
  }

  const sections: string[] = []

  // YAML frontmatter
  sections.push(generateFrontmatter(metadata))
  sections.push('')

  // Title
  sections.push(`# ${config.title}`)
  sections.push('')

  // Context section
  sections.push('## Context')
  sections.push('')
  sections.push(config.context || 'No context provided')
  sections.push('')

  // Configuration section
  sections.push('## Configuration')
  sections.push('')
  sections.push(formatConfigAnswers(config.answers, template))
  sections.push('')

  // Experiment Plan section
  sections.push('## Experiment Plan')
  sections.push('')
  if (config.contextFiles && config.contextFiles.length > 0) {
    sections.push(`- **Generated from**: ${config.contextFiles.join(', ')}`)
  } else {
    sections.push('- **Generated from**: No context files')
  }
  // Derive experiment config path from markdown path
  if (markdownPath) {
    const experimentConfigPath = markdownPath
      .replace(/^decisions\//, 'experiments/')
      .replace(/\.md$/, '.yaml')
    sections.push(`- **Experiment config**: ${experimentConfigPath}`)
  }
  sections.push('')

  // Results section (placeholder)
  sections.push('## Results')
  sections.push('')
  sections.push('(To be filled after experiment runs)')
  sections.push('')

  // Decision section (placeholder)
  sections.push('## Decision')
  sections.push('')
  sections.push('(To be made after reviewing results)')
  sections.push('')

  // Footer
  sections.push('---')
  sections.push('')
  sections.push('Auto-generated by Unheard v2 | Phase 2')

  return sections.join('\n')
}
