import { useEffect, useState } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { commands, type StreamEvent, type ChatError } from '@/lib/bindings'
import { useChatStore } from '@/store/chat-store'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ErrorMessage, OfflineBanner } from './ErrorMessage'
import type { ChatMessage as FrontendChatMessage } from '@/types/chat'
import {
  analyzeChatError,
  withRetry,
  isOnline,
} from '@/lib/error-handlers'
import {
  enqueueMessage,
  peekMessage,
  dequeueMessage as removeFromQueue,
  getQueueSize,
} from '@/lib/retry-queue'
import { logger } from '@/lib/logger'

/**
 * ChatInterface is the main container for the chat UI.
 *
 * Component Structure:
 * ```
 * ChatInterface (container)
 * ├── ChatMessages (scroll area with message list)
 * │   └── ChatBubble (individual message bubble)
 * └── ChatInput (textarea + send button)
 * ```
 *
 * State Connection:
 * - Uses useChatStore with selector pattern (ast-grep enforced)
 * - Manages streaming state via Tauri Channel
 * - Accumulates tokens in real-time
 *
 * Flow:
 * 1. User types message in ChatInput
 * 2. addMessage (user role) added to store
 * 3. sendChatMessage Tauri command called with Channel
 * 4. Streaming tokens accumulated via StreamEvent::Token
 * 5. StreamEvent::Done completes message
 * 6. StreamEvent::Error shows error state
 */

export function ChatInterface() {
  const messages = useChatStore(state => state.messages)
  const isStreaming = useChatStore(state => state.isStreaming)
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)

  // Update queued message count
  useEffect(() => {
    const updateCount = () => setQueuedCount(getQueueSize())
    updateCount()

    // Listen for online/offline events
    window.addEventListener('online', updateCount)
    window.addEventListener('offline', updateCount)

    return () => {
      window.removeEventListener('online', updateCount)
      window.removeEventListener('offline', updateCount)
    }
  }, [])

  // Process offline queue when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      logger.info('Browser is back online, processing queue')

      // Process all queued messages
      while (getQueueSize() > 0) {
        const queued = peekMessage()
        if (!queued) break

        try {
          await handleSendMessage(queued.message)
          removeFromQueue(queued.id)
          setQueuedCount(getQueueSize())
        } catch (error) {
          logger.error('Failed to send queued message', { error, queued })
          break // Stop processing on error
        }
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Process in-memory queued messages after streaming completes
  useEffect(() => {
    if (!isStreaming) {
      const { dequeueMessage } = useChatStore.getState()
      const queuedMsg = dequeueMessage()
      if (queuedMsg) {
        handleSendMessage(queuedMsg)
      }
    }
  }, [isStreaming])

  const handleSendMessage = async (content: string) => {
    const { addMessage, updateStreamingMessage, completeStreaming } =
      useChatStore.getState()

    // Check if offline - queue message
    if (!isOnline()) {
      logger.info('Offline detected, queueing message')
      enqueueMessage(content)
      setQueuedCount(getQueueSize())
      return
    }

    // Add user message
    const userMessage: FrontendChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    }
    addMessage(userMessage)

    // Create assistant message placeholder for streaming
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: FrontendChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    }
    addMessage(assistantMessage)

    // Clear previous error
    setChatError(null)

    // Set up streaming channel
    const channel = new Channel<StreamEvent>()
    let accumulatedContent = ''

    channel.onmessage = (event: StreamEvent) => {
      if (event.type === 'Token') {
        accumulatedContent += event.content
        updateStreamingMessage(assistantMessageId, accumulatedContent)
      } else if (event.type === 'Done') {
        completeStreaming(assistantMessageId)
      } else if (event.type === 'Error') {
        // Update message with error status
        const { messages: currentMessages } = useChatStore.getState()
        const errorMessage = currentMessages.find(
          m => m.id === assistantMessageId
        )
        if (errorMessage) {
          errorMessage.status = 'error'
          errorMessage.metadata = { error: event.message }
        }
        completeStreaming(assistantMessageId)
      }
    }

    // Convert frontend messages to backend format
    const historyForBackend = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    // Send with retry logic
    try {
      const sendWithRetry = async () => {
        const result = await commands.sendChatMessage(
          content,
          historyForBackend,
          null, // system_prompt (will be added in later task)
          channel
        )

        if (result.status === 'error') {
          const analysis = analyzeChatError(result.error)

          // Store error for display
          setChatError(result.error)

          // Throw for retry logic
          if (analysis.canRetry) {
            throw new Error(analysis.userMessage)
          }
        }

        return result
      }

      // Attempt with retry for transient errors
      await withRetry(sendWithRetry, {
        maxRetries: 5,
        onRetry: (attempt, delay) => {
          logger.info('Retrying message send', { attempt, delay })
          setRetrying(true)
        },
      })

      setRetrying(false)
    } catch (err) {
      setRetrying(false)
      logger.error('Chat error after retries', { error: err })
      completeStreaming(assistantMessageId)

      // Update message with error
      const { messages: currentMessages } = useChatStore.getState()
      const errorMessage = currentMessages.find(
        m => m.id === assistantMessageId
      )
      if (errorMessage) {
        errorMessage.status = 'error'
        errorMessage.metadata = {
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    }
  }

  const handleRetry = () => {
    if (!chatError) return

    // Find the last user message and retry
    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user')

    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content)
    }
  }

  const handleStopStreaming = () => {
    // Stop streaming: discard partial response
    const { completeStreaming, streamingMessageId: currentStreamingId } =
      useChatStore.getState()
    if (currentStreamingId) {
      completeStreaming(currentStreamingId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Offline banner */}
      <OfflineBanner queuedCount={queuedCount} />

      {/* Error banner with retry */}
      {chatError && (
        <ErrorMessage
          error={chatError}
          onRetry={handleRetry}
          retrying={retrying}
          banner={true}
        />
      )}

      {/* Messages area */}
      <ChatMessages />

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        onStopStreaming={handleStopStreaming}
      />
    </div>
  )
}
