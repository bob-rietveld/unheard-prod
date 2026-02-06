import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    localPath: v.string(),
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
      v.literal('decided'),
      v.literal('ready'),
      v.literal('running'),
      v.literal('completed')
    ),
    projectId: v.optional(v.id('projects')),
    clerkUserId: v.string(),
    createdAt: v.number(),
    templateId: v.optional(v.id('experimentTemplates')),
    configData: v.optional(v.any()),
    markdownFilePath: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId'])
    .index('by_template', ['templateId']),

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

  chats: defineTable({
    projectId: v.id('projects'),
    clerkUserId: v.string(),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    archived: v.boolean(),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId'])
    .index('by_project_active', ['projectId', 'archived']),

  messages: defineTable({
    chatId: v.id('chats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    timestamp: v.number(),
    status: v.optional(
      v.union(
        v.literal('sending'),
        v.literal('streaming'),
        v.literal('complete'),
        v.literal('error')
      )
    ),
    metadata: v.optional(v.any()),
  }).index('by_chat', ['chatId']),

  experimentTemplates: defineTable({
    name: v.string(),
    slug: v.string(),
    category: v.string(),
    description: v.string(),
    yamlContent: v.string(),
    version: v.string(),
    isPublished: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_slug', ['slug'])
    .index('by_category', ['category', 'isPublished']),

  experiments: defineTable({
    clerkUserId: v.string(),
    projectId: v.id('projects'),
    decisionId: v.optional(v.id('decisions')),
    name: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('generating_personas'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed')
    ),
    templateSlug: v.optional(v.string()),
    configYamlPath: v.optional(v.string()),
    resultsJsonPath: v.optional(v.string()),
    personaCount: v.number(),
    completedPersonas: v.number(),
    results: v.optional(v.any()),
    insights: v.optional(v.any()),
    executionTimeMs: v.optional(v.number()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId'])
    .index('by_decision', ['decisionId'])
    .index('by_status', ['status']),
})
