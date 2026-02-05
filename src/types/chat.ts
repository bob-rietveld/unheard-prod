/**
 * Chat-related TypeScript types for the AI-powered decision support chat interface.
 * These types support streaming responses, message state tracking, and template configuration.
 */

import type { Id } from '../../convex/_generated/dataModel'

/**
 * Possible roles in a chat conversation.
 * - 'user': Message sent by the user
 * - 'assistant': Message sent by the AI assistant
 */
export type ChatRole = 'user' | 'assistant'

/**
 * Status of a chat message in its lifecycle.
 * - 'sending': Message is being sent to the backend
 * - 'streaming': Message is actively receiving streamed tokens
 * - 'complete': Message has been fully received and is complete
 * - 'error': Message encountered an error during transmission or receipt
 */
export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error'

/**
 * A chat session within a project.
 * Each chat has its own message history and can be thought of as an experiment or conversation thread.
 */
export interface Chat {
  /** Unique identifier from Convex */
  _id: Id<'chats'>

  /** Project this chat belongs to */
  projectId: Id<'projects'>

  /** Owner of the chat */
  clerkUserId: string

  /** User-defined title for the chat */
  title: string

  /** Unix timestamp (milliseconds) when created */
  createdAt: number

  /** Unix timestamp (milliseconds) when last updated */
  updatedAt: number

  /** Whether this chat is archived (soft deleted) */
  archived: boolean
}

/**
 * A single message in a chat conversation.
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string

  /** Role of the message sender */
  role: ChatRole

  /** Full text content of the message */
  content: string

  /** Unix timestamp (milliseconds) when the message was created */
  timestamp: number

  /** Optional status of the message (useful for streaming and error states) */
  status?: MessageStatus

  /** Optional metadata for additional message information */
  metadata?: Record<string, unknown>
}

/**
 * The full state of the chat store.
 * This includes messages, streaming state, template configuration, and error handling.
 */
export interface ChatState {
  // ===== State =====

  /** ID of the currently active chat (null if no chat selected) */
  currentChatId: Id<'chats'> | null

  /** Array of all messages in the current conversation */
  messages: ChatMessage[]

  /** Whether a message is currently being streamed */
  isStreaming: boolean

  /** ID of the message that is currently streaming (null if not streaming) */
  streamingMessageId: string | null

  /** ID of the currently selected experiment template (null if no template selected) */
  currentTemplateId: string | null

  /** Configuration answers for the current template (key-value pairs) */
  configAnswers: Record<string, unknown>

  /** Current error message (null if no error) */
  error: string | null

  /** Message queued for sending after current stream completes (null if no queued message) */
  queuedMessage: string | null

  // ===== Actions =====

  /** Set the current active chat */
  setCurrentChat: (chatId: Id<'chats'> | null) => void

  /** Add a new message to the conversation */
  addMessage: (message: ChatMessage) => void

  /** Update the content of a streaming message (accumulate tokens) */
  updateStreamingMessage: (id: string, content: string) => void

  /** Mark a streaming message as complete */
  completeStreaming: (id: string) => void

  /** Set or clear the current error state */
  setError: (error: string | null) => void

  /** Set or clear the current template */
  setTemplate: (templateId: string | null) => void

  /** Update a single configuration answer */
  updateConfigAnswer: (key: string, value: unknown) => void

  /** Reset the entire conversation (clear all messages, state, and config) */
  resetConversation: () => void

  /** Queue a message for sending after the current stream completes */
  queueMessage: (message: string) => void

  /** Dequeue and return the queued message (returns null if no message queued) */
  dequeueMessage: () => string | null
}
