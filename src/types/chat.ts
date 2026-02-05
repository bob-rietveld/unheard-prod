/**
 * Chat-related TypeScript types for the AI-powered decision support chat interface.
 * These types support streaming responses, message state tracking, and template configuration.
 */

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
