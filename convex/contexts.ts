import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getCurrentUserClerkId } from './auth'

/**
 * Get all context files for a specific project.
 * Ensures the user owns the project.
 */
export const listByProject = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error('Project not found')
    }
    if (project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this project')
    }

    return await ctx.db
      .query('contextFiles')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: {
    // NOTE: clerkUserId is NOT accepted from client for security
    // It is derived server-side from the authenticated user's identity
    projectId: v.id('projects'),
    originalFilename: v.string(),
    storedFilename: v.string(),
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    preview: v.optional(v.string()),
    pages: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    sizeBytes: v.number(),
    relativeFilePath: v.string(),
    isLFS: v.boolean(),
    uploadedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  },
  handler: async (ctx, args) => {
    // Get authenticated user's Clerk ID from server-side auth context
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error('Project not found')
    }
    if (project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this project')
    }

    return await ctx.db.insert('contextFiles', {
      ...args,
      clerkUserId,
    })
  },
})
