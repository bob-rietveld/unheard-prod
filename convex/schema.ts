import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    clerkUserId: v.string(),
    archived: v.boolean(),
    createdAt: v.number(),
  }).index('by_user', ['clerkUserId']),

  decisions: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('analyzing'),
      v.literal('decided')
    ),
    projectId: v.optional(v.id('projects')),
    clerkUserId: v.string(),
    createdAt: v.number(),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId']),

  analyses: defineTable({
    decisionId: v.id('decisions'),
    type: v.string(),
    parameters: v.any(),
    results: v.any(),
    clerkUserId: v.string(),
    createdAt: v.number(),
  }).index('by_decision', ['decisionId']),

  syntheticDatasets: defineTable({
    name: v.string(),
    schema: v.any(),
    data: v.any(),
    clerkUserId: v.string(),
    createdAt: v.number(),
  }).index('by_user', ['clerkUserId']),

  contextFiles: defineTable({
    clerkUserId: v.string(),
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
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId']),
})
