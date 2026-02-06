/**
 * Convex mutations and queries for cohort management.
 * Cohorts group attioImport records for use in experiments.
 */

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUserClerkId } from './auth'

/**
 * Create a new cohort.
 */
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id('attioImports')),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    const now = Date.now()
    return await ctx.db.insert('cohorts', {
      clerkUserId,
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      memberIds: args.memberIds,
      memberCount: args.memberIds.length,
      createdAt: now,
      updatedAt: now,
    })
  },
})

/**
 * Update cohort metadata (name, description).
 */
export const update = mutation({
  args: {
    id: v.id('cohorts'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    if (args.name !== undefined) patch.name = args.name
    if (args.description !== undefined) patch.description = args.description

    await ctx.db.patch(args.id, patch)
  },
})

/**
 * Add members to a cohort (deduplicates).
 */
export const addMembers = mutation({
  args: {
    id: v.id('cohorts'),
    memberIds: v.array(v.id('attioImports')),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    const existingSet = new Set(cohort.memberIds)
    for (const id of args.memberIds) {
      existingSet.add(id)
    }
    const updatedIds = [...existingSet]

    await ctx.db.patch(args.id, {
      memberIds: updatedIds,
      memberCount: updatedIds.length,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Remove members from a cohort.
 */
export const removeMembers = mutation({
  args: {
    id: v.id('cohorts'),
    memberIds: v.array(v.id('attioImports')),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    const removeSet = new Set<string>(args.memberIds)
    const updatedIds = cohort.memberIds.filter(id => !removeSet.has(id))

    await ctx.db.patch(args.id, {
      memberIds: updatedIds,
      memberCount: updatedIds.length,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Delete a cohort (does NOT delete the attioImport records).
 */
export const remove = mutation({
  args: { id: v.id('cohorts') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    await ctx.db.delete(args.id)
  },
})

/**
 * List all cohorts for a project.
 */
export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    return await ctx.db
      .query('cohorts')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .collect()
  },
})

/**
 * Get a single cohort by ID.
 */
export const get = query({
  args: { id: v.id('cohorts') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    return cohort
  },
})

/**
 * Get all member records for a cohort.
 * Fetches the full attioImport records for each member ID.
 */
export const getMembers = query({
  args: { id: v.id('cohorts') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const cohort = await ctx.db.get(args.id)
    if (!cohort || cohort.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Cohort not found or not owned by user')
    }

    const members = await Promise.all(
      cohort.memberIds.map(memberId => ctx.db.get(memberId))
    )

    // Filter out any null results (deleted records)
    return members.filter(m => m !== null)
  },
})
