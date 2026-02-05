import { query, mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * List all published templates.
 * Optionally filter by category.
 */
export const list = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let templatesQuery = ctx.db
      .query('experimentTemplates')
      .withIndex('by_category')

    if (args.category) {
      templatesQuery = templatesQuery.filter(q =>
        q.and(
          q.eq(q.field('category'), args.category),
          q.eq(q.field('isPublished'), true)
        )
      )
    } else {
      templatesQuery = templatesQuery.filter(q =>
        q.eq(q.field('isPublished'), true)
      )
    }

    return await templatesQuery.order('desc').collect()
  },
})

/**
 * Get a specific template by ID.
 */
export const get = query({
  args: { id: v.id('experimentTemplates') },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }
    return template
  },
})

/**
 * Get a template by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const template = await ctx.db
      .query('experimentTemplates')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .first()

    if (!template) {
      throw new Error('Template not found')
    }

    return template
  },
})

/**
 * Create a new template.
 * Only for admin/system use.
 */
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    category: v.string(),
    description: v.string(),
    yamlContent: v.string(),
    version: v.string(),
    isPublished: v.boolean(),
  },
  handler: async (ctx, args) => {
    // Check if slug already exists
    const existing = await ctx.db
      .query('experimentTemplates')
      .withIndex('by_slug', q => q.eq('slug', args.slug))
      .first()

    if (existing) {
      throw new Error(`Template with slug "${args.slug}" already exists`)
    }

    const now = Date.now()
    return await ctx.db.insert('experimentTemplates', {
      ...args,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update a template.
 * Only for admin/system use.
 */
export const update = mutation({
  args: {
    id: v.id('experimentTemplates'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    yamlContent: v.optional(v.string()),
    version: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }

    const updates: Partial<typeof template> = {
      updatedAt: Date.now(),
    }
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description
    if (args.yamlContent !== undefined) updates.yamlContent = args.yamlContent
    if (args.version !== undefined) updates.version = args.version
    if (args.isPublished !== undefined) updates.isPublished = args.isPublished

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Publish a template (set isPublished to true).
 */
export const publish = mutation({
  args: { id: v.id('experimentTemplates') },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }

    await ctx.db.patch(args.id, {
      isPublished: true,
      updatedAt: Date.now(),
    })
  },
})
