import { useEffect, useRef, useState } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { commands, type StreamEvent, type ChatError } from '@/lib/bindings'
import { useChatStore } from '@/store/chat-store'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ErrorMessage, OfflineBanner } from './ErrorMessage'
import type { ChatMessage as FrontendChatMessage } from '@/types/chat'
import {
  useChatMessages,
  useAddMessage,
} from '@/services/chats'
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
 * Persistence flow:
 * - On chat selection, messages are loaded from Convex into the Zustand store
 * - User messages are saved to Convex immediately when sent
 * - Assistant messages are saved to Convex after streaming completes
 * - Zustand store serves as the real-time cache for streaming
 */

export function ChatInterface() {
  const messages = useChatStore(state => state.messages)
  const isStreaming = useChatStore(state => state.isStreaming)
  const currentChatId = useChatStore(state => state.currentChatId)
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)

  // Convex persistence hooks
  const persistedMessages = useChatMessages(currentChatId)
  const addMessageToConvex = useAddMessage()

  // Track which chat's history we last loaded to avoid re-loading on every render
  const loadedChatIdRef = useRef<string | null>(null)

  // When the chat changes, reset the loaded ref so we reload from Convex
  useEffect(() => {
    loadedChatIdRef.current = null
  }, [currentChatId])

  // Load persisted messages into the Zustand store when Convex data arrives
  useEffect(() => {
    if (!currentChatId || persistedMessages === undefined) return
    if (loadedChatIdRef.current === currentChatId) return

    loadedChatIdRef.current = currentChatId

    const { addMessage } = useChatStore.getState()
    // Only populate if the store was already reset (ChatList calls resetConversation on switch)
    // and Convex has messages to load
    if (persistedMessages.length === 0) return

    for (const msg of persistedMessages) {
      const frontendMsg: FrontendChatMessage = {
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        status: msg.status ?? 'complete',
        metadata: msg.metadata as Record<string, unknown> | undefined,
      }
      addMessage(frontendMsg)
    }

    logger.info('Loaded chat history from Convex', {
      chatId: currentChatId,
      messageCount: persistedMessages.length,
    })
  }, [currentChatId, persistedMessages])

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
    const {
      addMessage,
      updateStreamingMessage,
      completeStreaming,
      updateMessageStatus,
      currentChatId: chatId,
    } = useChatStore.getState()

    // Check if offline - queue message
    if (!isOnline()) {
      logger.info('Offline detected, queueing message')
      enqueueMessage(content)
      setQueuedCount(getQueueSize())
      return
    }

    // Add user message to store
    const userMessage: FrontendChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    }
    addMessage(userMessage)

    // Persist user message to Convex
    if (chatId) {
      try {
        await addMessageToConvex({
          chatId,
          role: 'user',
          content,
          status: 'complete',
        })
      } catch (err) {
        logger.error('Failed to persist user message to Convex', { error: err })
      }
    }

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

        // Persist completed assistant message to Convex
        if (chatId) {
          addMessageToConvex({
            chatId,
            role: 'assistant',
            content: accumulatedContent,
            status: 'complete',
          }).catch(err => {
            logger.error('Failed to persist assistant message to Convex', {
              error: err,
            })
          })
        }
      } else if (event.type === 'Error') {
        // Update message with error status via store action
        updateMessageStatus(assistantMessageId, 'error', { error: event.message })
        completeStreaming(assistantMessageId)

        // Persist error message to Convex
        if (chatId && accumulatedContent) {
          addMessageToConvex({
            chatId,
            role: 'assistant',
            content: accumulatedContent,
            status: 'error',
            metadata: { error: event.message },
          }).catch(err => {
            logger.error('Failed to persist error message to Convex', {
              error: err,
            })
          })
        }
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

      // Update message with error via store action
      updateMessageStatus(assistantMessageId, 'error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      })
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
      <ChatMessages onSendPrompt={handleSendMessage} />

      {/* Input area */}
      <ChatInput
        onSend={handleSendMessage}
        onStopStreaming={handleStopStreaming}
      />
    </div>
  )
}
