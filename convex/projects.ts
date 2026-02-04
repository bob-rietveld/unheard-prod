import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getCurrentUserClerkId } from './auth'

/**
 * Get all projects for the current authenticated user.
 */
export const list = query({
  handler: async ctx => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    return await ctx.db
      .query('projects')
      .withIndex('by_user', q => q.eq('clerkUserId', clerkUserId))
      .filter(q => q.eq(q.field('archived'), false))
      .order('desc')
      .collect()
  },
})

/**
 * Get a specific project by ID.
 * Ensures the user owns the project.
 */
export const get = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    if (project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this project')
    }

    return project
  },
})

/**
 * Create a new project.
 * Server-side derives clerkUserId from authenticated user.
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    localPath: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    return await ctx.db.insert('projects', {
      ...args,
      clerkUserId,
      archived: false,
      createdAt: Date.now(),
    })
  },
})

/**
 * Update project metadata (name, description).
 */
export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    if (project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this project')
    }

    const updates: Partial<typeof project> = {}
    if (args.name !== undefined) updates.name = args.name
    if (args.description !== undefined) updates.description = args.description

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Archive a project (soft delete).
 */
export const archive = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    if (project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this project')
    }

    await ctx.db.patch(args.id, { archived: true })
  },
})
