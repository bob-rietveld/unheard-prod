/**
 * Convex mutations and queries for Attio CRM imports.
 * Manages imported records: creation, listing, linking to experiments, and deletion.
 */

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUserClerkId } from './auth'

/**
 * Create a new Attio import record.
 */
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    attioRecordId: v.string(),
    attioObjectType: v.union(
      v.literal('company'),
      v.literal('person'),
      v.literal('list_entry')
    ),
    name: v.string(),
    attioWebUrl: v.optional(v.string()),
    localFilePath: v.string(),
    attributes: v.optional(v.any()),
    listSlug: v.optional(v.string()),
    importedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    return await ctx.db.insert('attioImports', { ...args, clerkUserId })
  },
})

/**
 * List all imports for a project.
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
      .query('attioImports')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .collect()
  },
})

/**
 * List imports filtered by object type within a project.
 */
export const listByType = query({
  args: {
    projectId: v.id('projects'),
    objectType: v.union(
      v.literal('company'),
      v.literal('person'),
      v.literal('list_entry')
    ),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    return await ctx.db
      .query('attioImports')
      .withIndex('by_object_type', q =>
        q.eq('projectId', args.projectId).eq('attioObjectType', args.objectType)
      )
      .collect()
  },
})

/**
 * Get a single import by ID.
 */
export const get = query({
  args: { id: v.id('attioImports') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const record = await ctx.db.get(args.id)
    if (!record || record.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Import not found or not owned by user')
    }

    return record
  },
})

/**
 * Link an import to an experiment by adding the experiment ID to experimentIds array.
 */
export const linkToExperiment = mutation({
  args: {
    id: v.id('attioImports'),
    experimentId: v.id('experiments'),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const record = await ctx.db.get(args.id)
    if (!record || record.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Import not found or not owned by user')
    }

    const currentIds = record.experimentIds ?? []
    if (!currentIds.includes(args.experimentId)) {
      await ctx.db.patch(args.id, {
        experimentIds: [...currentIds, args.experimentId],
      })
    }
  },
})

/**
 * Delete an import record.
 */
export const remove = mutation({
  args: { id: v.id('attioImports') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const record = await ctx.db.get(args.id)
    if (!record || record.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Import not found or not owned by user')
    }

    await ctx.db.delete(args.id)
  },
})
