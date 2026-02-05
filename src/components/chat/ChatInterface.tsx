import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Channel } from '@tauri-apps/api/core'
import { commands, type StreamEvent } from '@/lib/bindings'
import { useChatStore } from '@/store/chat-store'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import type { ChatMessage as FrontendChatMessage } from '@/types/chat'

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
  const { t } = useTranslation()
  const messages = useChatStore(state => state.messages)
  const isStreaming = useChatStore(state => state.isStreaming)
  const error = useChatStore(state => state.error)

  // Process queued messages after streaming completes
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
      setError,
    } = useChatStore.getState()

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
        setError(event.message)
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

    // Call Tauri command
    try {
      const result = await commands.sendChatMessage(
        content,
        historyForBackend,
        null, // system_prompt (will be added in later task)
        channel
      )

      if (result.status === 'error') {
        setError(
          result.error.type === 'RateLimitError'
            ? t('chat.error.rateLimit')
            : result.error.type === 'TimeoutError'
              ? t('chat.error.timeout')
              : result.error.type === 'NetworkError'
                ? t('chat.error.network')
                : t('chat.error.generic')
        )
        completeStreaming(assistantMessageId)
      }
    } catch (err) {
      setError(t('chat.error.generic'))
      completeStreaming(assistantMessageId)
      console.error('Chat error:', err)
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
      {/* Error banner - refined, minimal */}
      {error && (
        <div className="border-b border-destructive/20 bg-destructive/5 px-6 py-3">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => useChatStore.getState().setError(null)}
              className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              aria-label={t('chat.error.dismiss')}
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>
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
