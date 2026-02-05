import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ChatState } from '../types/chat'

/**
 * Zustand store for chat state management.
 *
 * This store follows the established Zustand pattern with:
 * - create<T>()() with devtools middleware
 * - Selector syntax mandatory (ast-grep enforced - no destructuring)
 * - Actions use set() for state updates
 * - Message state includes streaming status
 *
 * Usage:
 *   // ✅ GOOD: Selector syntax
 *   const messages = useChatStore(state => state.messages)
 *
 *   // ❌ BAD: Destructuring (banned by ast-grep)
 *   const { messages } = useChatStore()
 *
 *   // ✅ GOOD: Use getState() in callbacks
 *   const handleSave = () => {
 *     const { messages } = useChatStore.getState()
 *     // ...
 *   }
 */
export const useChatStore = create<ChatState>()(
  devtools(
    (set): ChatState => ({
      // ===== Initial State =====
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      currentTemplateId: null,
      configAnswers: {},
      error: null,
      queuedMessage: null,

      // ===== Actions =====

      addMessage: message =>
        set(
          state => ({
            messages: [...state.messages, message],
          }),
          undefined,
          'addMessage'
        ),

      updateStreamingMessage: (id, content) =>
        set(
          state => ({
            messages: state.messages.map(msg =>
              msg.id === id
                ? { ...msg, content, status: 'streaming' as const }
                : msg
            ),
          }),
          undefined,
          'updateStreamingMessage'
        ),

      completeStreaming: id =>
        set(
          state => ({
            messages: state.messages.map(msg =>
              msg.id === id ? { ...msg, status: 'complete' as const } : msg
            ),
            isStreaming: false,
            streamingMessageId: null,
          }),
          undefined,
          'completeStreaming'
        ),

      setError: error => set({ error }, undefined, 'setError'),

      setTemplate: templateId =>
        set({ currentTemplateId: templateId }, undefined, 'setTemplate'),

      updateConfigAnswer: (key, value) =>
        set(
          state => ({
            configAnswers: {
              ...state.configAnswers,
              [key]: value,
            },
          }),
          undefined,
          'updateConfigAnswer'
        ),

      resetConversation: () =>
        set(
          {
            messages: [],
            isStreaming: false,
            streamingMessageId: null,
            currentTemplateId: null,
            configAnswers: {},
            error: null,
            queuedMessage: null,
          },
          undefined,
          'resetConversation'
        ),

      queueMessage: message =>
        set({ queuedMessage: message }, undefined, 'queueMessage'),

      dequeueMessage: () => {
        const state = useChatStore.getState()
        const message = state.queuedMessage
        set({ queuedMessage: null }, undefined, 'dequeueMessage')
        return message
      },
    }),
    {
      name: 'chat-store',
    }
  )
)
