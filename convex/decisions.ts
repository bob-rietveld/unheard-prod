/**
 * Convex mutations and queries for decisions.
 * Manages decision records in the database, including metadata and file paths.
 */

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUserClerkId } from './auth'

/**
 * Update an existing decision with decision log metadata.
 * Creates a new decision if one doesn't exist.
 *
 * This mutation is called after the decision log markdown file is created and committed to Git.
 */
export const updateWithLog = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    templateId: v.optional(v.id('experimentTemplates')),
    configData: v.optional(v.any()),
    markdownFilePath: v.optional(v.string()),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)
    const now = Date.now()

    // Try to find existing decision by title and user
    const existing = await ctx.db
      .query('decisions')
      .withIndex('by_user', q => q.eq('clerkUserId', clerkUserId))
      .filter(q => q.eq(q.field('title'), args.title))
      .first()

    if (existing) {
      // Update existing decision
      await ctx.db.patch(existing._id, {
        description: args.description,
        templateId: args.templateId,
        configData: args.configData,
        markdownFilePath: args.markdownFilePath,
        projectId: args.projectId,
        status: 'ready',
        updatedAt: now,
      })
      return existing._id
    }

    // Create new decision
    const id = await ctx.db.insert('decisions', {
      title: args.title,
      description: args.description,
      status: 'ready',
      projectId: args.projectId,
      clerkUserId,
      createdAt: now,
      templateId: args.templateId,
      configData: args.configData,
      markdownFilePath: args.markdownFilePath,
      updatedAt: now,
    })

    return id
  },
})

/**
 * Get all decisions for a user.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    return await ctx.db
      .query('decisions')
      .withIndex('by_user', q => q.eq('clerkUserId', clerkUserId))
      .order('desc')
      .collect()
  },
})

/**
 * Get decisions by project.
 */
export const byProject = query({
  args: {
    projectId: v.id('projects'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    return await ctx.db
      .query('decisions')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

/**
 * Get decisions by template.
 */
export const byTemplate = query({
  args: {
    templateId: v.id('experimentTemplates'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Only return decisions owned by the authenticated user
    const decisions = await ctx.db
      .query('decisions')
      .withIndex('by_template', q => q.eq('templateId', args.templateId))
      .order('desc')
      .collect()

    return decisions.filter(d => d.clerkUserId === clerkUserId)
  },
})

/**
 * Get a single decision by ID.
 */
export const get = query({
  args: {
    id: v.id('decisions'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const decision = await ctx.db.get(args.id)
    if (!decision) {
      throw new Error('Decision not found')
    }
    if (decision.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this decision')
    }

    return decision
  },
})
