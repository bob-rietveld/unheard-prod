/**
 * Convex mutations and queries for experiments.
 * Manages experiment lifecycle: creation, status tracking, results, and completion.
 */

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUserClerkId } from './auth'

/**
 * Create a new experiment record.
 */
export const createExperiment = mutation({
  args: {
    projectId: v.id('projects'),
    decisionId: v.optional(v.id('decisions')),
    cohortId: v.optional(v.id('cohorts')),
    name: v.string(),
    templateSlug: v.optional(v.string()),
    configYamlPath: v.optional(v.string()),
    personaCount: v.number(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    // If decisionId provided, verify user owns the decision
    if (args.decisionId) {
      const decision = await ctx.db.get(args.decisionId)
      if (!decision || decision.clerkUserId !== clerkUserId) {
        throw new Error('Unauthorized: Decision not found or not owned by user')
      }
    }

    // If cohortId provided, verify user owns the cohort
    if (args.cohortId) {
      const cohort = await ctx.db.get(args.cohortId)
      if (!cohort || cohort.clerkUserId !== clerkUserId) {
        throw new Error('Unauthorized: Cohort not found or not owned by user')
      }
    }

    const id = await ctx.db.insert('experiments', {
      clerkUserId,
      projectId: args.projectId,
      decisionId: args.decisionId,
      cohortId: args.cohortId,
      name: args.name,
      status: 'pending',
      templateSlug: args.templateSlug,
      configYamlPath: args.configYamlPath,
      personaCount: args.personaCount,
      completedPersonas: 0,
      createdAt: Date.now(),
    })

    return id
  },
})

/**
 * Update experiment status and progress.
 */
export const updateExperimentStatus = mutation({
  args: {
    id: v.id('experiments'),
    status: v.union(
      v.literal('pending'),
      v.literal('generating_personas'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    completedPersonas: v.optional(v.number()),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const experiment = await ctx.db.get(args.id)
    if (!experiment) {
      throw new Error('Experiment not found')
    }
    if (experiment.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this experiment')
    }

    const updates: Record<string, unknown> = {
      status: args.status,
    }
    if (args.completedPersonas !== undefined) {
      updates.completedPersonas = args.completedPersonas
    }
    if (args.startedAt !== undefined) {
      updates.startedAt = args.startedAt
    }

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Complete an experiment with results and insights.
 */
export const completeExperiment = mutation({
  args: {
    id: v.id('experiments'),
    results: v.any(),
    insights: v.optional(v.any()),
    resultsJsonPath: v.optional(v.string()),
    executionTimeMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const experiment = await ctx.db.get(args.id)
    if (!experiment) {
      throw new Error('Experiment not found')
    }
    if (experiment.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this experiment')
    }

    await ctx.db.patch(args.id, {
      status: 'completed',
      results: args.results,
      insights: args.insights,
      resultsJsonPath: args.resultsJsonPath,
      executionTimeMs: args.executionTimeMs,
      completedPersonas: experiment.personaCount,
      completedAt: Date.now(),
    })
  },
})

/**
 * Mark an experiment as failed with an error message.
 */
export const failExperiment = mutation({
  args: {
    id: v.id('experiments'),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const experiment = await ctx.db.get(args.id)
    if (!experiment) {
      throw new Error('Experiment not found')
    }
    if (experiment.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this experiment')
    }

    await ctx.db.patch(args.id, {
      status: 'failed',
      error: args.error,
      completedAt: Date.now(),
    })
  },
})

/**
 * Get a single experiment by ID.
 */
export const getExperiment = query({
  args: { id: v.id('experiments') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const experiment = await ctx.db.get(args.id)
    if (!experiment) {
      throw new Error('Experiment not found')
    }
    if (experiment.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this experiment')
    }

    return experiment
  },
})

/**
 * List experiments for a project, ordered by most recent first.
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
      .query('experiments')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .order('desc')
      .collect()
  },
})

/**
 * Get the experiment linked to a specific decision.
 */
export const getByDecision = query({
  args: { decisionId: v.id('decisions') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the decision
    const decision = await ctx.db.get(args.decisionId)
    if (!decision || decision.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Decision not found or not owned by user')
    }

    return await ctx.db
      .query('experiments')
      .withIndex('by_decision', q => q.eq('decisionId', args.decisionId))
      .order('desc')
      .first()
  },
})
