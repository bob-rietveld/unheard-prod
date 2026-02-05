import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { getCurrentUserClerkId } from './auth'

/**
 * Get all chats for a specific project.
 * Returns chats ordered by most recently updated.
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
      .query('chats')
      .withIndex('by_project_active', q =>
        q.eq('projectId', args.projectId).eq('archived', false)
      )
      .order('desc')
      .collect()
  },
})

/**
 * Get a specific chat by ID.
 */
export const get = query({
  args: { id: v.id('chats') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const chat = await ctx.db.get(args.id)
    if (!chat) {
      throw new Error('Chat not found')
    }
    if (chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this chat')
    }

    return chat
  },
})

/**
 * Get all messages for a specific chat.
 */
export const getMessages = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the chat
    const chat = await ctx.db.get(args.chatId)
    if (!chat || chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Chat not found or not owned by user')
    }

    return await ctx.db
      .query('messages')
      .withIndex('by_chat', q => q.eq('chatId', args.chatId))
      .order('asc')
      .collect()
  },
})

/**
 * Create a new chat.
 */
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the project
    const project = await ctx.db.get(args.projectId)
    if (!project || project.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Project not found or not owned by user')
    }

    const now = Date.now()
    return await ctx.db.insert('chats', {
      projectId: args.projectId,
      clerkUserId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
      archived: false,
    })
  },
})

/**
 * Update chat metadata (title, updatedAt timestamp).
 */
export const update = mutation({
  args: {
    id: v.id('chats'),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const chat = await ctx.db.get(args.id)
    if (!chat) {
      throw new Error('Chat not found')
    }
    if (chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this chat')
    }

    const updates: Partial<typeof chat> = {
      updatedAt: Date.now(),
    }
    if (args.title !== undefined) updates.title = args.title

    await ctx.db.patch(args.id, updates)
  },
})

/**
 * Archive a chat (soft delete).
 */
export const archive = mutation({
  args: { id: v.id('chats') },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const chat = await ctx.db.get(args.id)
    if (!chat) {
      throw new Error('Chat not found')
    }
    if (chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: You do not own this chat')
    }

    await ctx.db.patch(args.id, { archived: true })
  },
})

/**
 * Add a message to a chat.
 * Updates the chat's updatedAt timestamp.
 */
export const addMessage = mutation({
  args: {
    chatId: v.id('chats'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    status: v.optional(
      v.union(
        v.literal('sending'),
        v.literal('streaming'),
        v.literal('complete'),
        v.literal('error')
      )
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    // Verify user owns the chat
    const chat = await ctx.db.get(args.chatId)
    if (!chat || chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Chat not found or not owned by user')
    }

    // Insert message
    const messageId = await ctx.db.insert('messages', {
      chatId: args.chatId,
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
      status: args.status,
      metadata: args.metadata,
    })

    // Update chat's updatedAt timestamp
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() })

    return messageId
  },
})

/**
 * Update message content and status (for streaming updates).
 */
export const updateMessage = mutation({
  args: {
    messageId: v.id('messages'),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal('sending'),
        v.literal('streaming'),
        v.literal('complete'),
        v.literal('error')
      )
    ),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const clerkUserId = await getCurrentUserClerkId(ctx)

    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error('Message not found')
    }

    // Verify user owns the chat
    const chat = await ctx.db.get(message.chatId)
    if (!chat || chat.clerkUserId !== clerkUserId) {
      throw new Error('Unauthorized: Chat not found or not owned by user')
    }

    const updates: Partial<typeof message> = {}
    if (args.content !== undefined) updates.content = args.content
    if (args.status !== undefined) updates.status = args.status
    if (args.metadata !== undefined) updates.metadata = args.metadata

    await ctx.db.patch(args.messageId, updates)
  },
})
