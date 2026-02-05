import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from './chat-store'
import type { ChatMessage } from '../types/chat'

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useChatStore.setState({
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      currentTemplateId: null,
      configAnswers: {},
      error: null,
      queuedMessage: null,
    })
  })

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.isStreaming).toBe(false)
      expect(state.streamingMessageId).toBeNull()
      expect(state.currentTemplateId).toBeNull()
      expect(state.configAnswers).toEqual({})
      expect(state.error).toBeNull()
      expect(state.queuedMessage).toBeNull()
    })
  })

  describe('addMessage', () => {
    it('adds a message to the messages array', () => {
      const { addMessage } = useChatStore.getState()
      const message: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'Hello, world!',
        timestamp: Date.now(),
      }

      addMessage(message)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]).toEqual(message)
    })

    it('appends multiple messages in order', () => {
      const { addMessage } = useChatStore.getState()
      const message1: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'First message',
        timestamp: Date.now(),
      }
      const message2: ChatMessage = {
        id: '2',
        role: 'assistant',
        content: 'Second message',
        timestamp: Date.now(),
      }

      addMessage(message1)
      addMessage(message2)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(2)
      expect(state.messages[0]).toEqual(message1)
      expect(state.messages[1]).toEqual(message2)
    })

    it('adds messages with status and metadata', () => {
      const { addMessage } = useChatStore.getState()
      const message: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: 'Streaming message',
        timestamp: Date.now(),
        status: 'streaming',
        metadata: { templateId: 'test-template' },
      }

      addMessage(message)

      const state = useChatStore.getState()
      expect(state.messages[0]?.status).toBe('streaming')
      expect(state.messages[0]?.metadata).toEqual({
        templateId: 'test-template',
      })
    })
  })

  describe('updateStreamingMessage', () => {
    it('updates content of streaming message by ID', () => {
      const { addMessage, updateStreamingMessage } = useChatStore.getState()
      const message: ChatMessage = {
        id: 'streaming-1',
        role: 'assistant',
        content: 'Initial',
        timestamp: Date.now(),
      }

      addMessage(message)
      updateStreamingMessage('streaming-1', 'Initial + more tokens')

      const state = useChatStore.getState()
      expect(state.messages[0]?.content).toBe('Initial + more tokens')
      expect(state.messages[0]?.status).toBe('streaming')
    })

    it('only updates the message with matching ID', () => {
      const { addMessage, updateStreamingMessage } = useChatStore.getState()
      const message1: ChatMessage = {
        id: '1',
        role: 'user',
        content: 'User message',
        timestamp: Date.now(),
      }
      const message2: ChatMessage = {
        id: '2',
        role: 'assistant',
        content: 'Assistant message',
        timestamp: Date.now(),
      }

      addMessage(message1)
      addMessage(message2)
      updateStreamingMessage('2', 'Updated assistant message')

      const state = useChatStore.getState()
      expect(state.messages[0]?.content).toBe('User message')
      expect(state.messages[1]?.content).toBe('Updated assistant message')
      expect(state.messages[1]?.status).toBe('streaming')
    })

    it('accumulates tokens without full re-render', () => {
      const { addMessage, updateStreamingMessage } = useChatStore.getState()
      const message: ChatMessage = {
        id: 'stream',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      }

      addMessage(message)
      updateStreamingMessage('stream', 'Hello')
      updateStreamingMessage('stream', 'Hello, world')
      updateStreamingMessage('stream', 'Hello, world!')

      const state = useChatStore.getState()
      expect(state.messages[0]?.content).toBe('Hello, world!')
    })
  })

  describe('completeStreaming', () => {
    it('marks message as complete and clears streaming state', () => {
      const { addMessage, completeStreaming } = useChatStore.getState()
      const message: ChatMessage = {
        id: 'streaming-1',
        role: 'assistant',
        content: 'Complete message',
        timestamp: Date.now(),
        status: 'streaming',
      }

      // Manually set streaming state for test
      useChatStore.setState({
        isStreaming: true,
        streamingMessageId: 'streaming-1',
      })
      addMessage(message)

      completeStreaming('streaming-1')

      const state = useChatStore.getState()
      expect(state.messages[0]?.status).toBe('complete')
      expect(state.isStreaming).toBe(false)
      expect(state.streamingMessageId).toBeNull()
    })

    it('only updates the message with matching ID', () => {
      const { addMessage, completeStreaming } = useChatStore.getState()
      const message1: ChatMessage = {
        id: '1',
        role: 'assistant',
        content: 'First',
        timestamp: Date.now(),
        status: 'streaming',
      }
      const message2: ChatMessage = {
        id: '2',
        role: 'assistant',
        content: 'Second',
        timestamp: Date.now(),
        status: 'streaming',
      }

      useChatStore.setState({ isStreaming: true, streamingMessageId: '2' })
      addMessage(message1)
      addMessage(message2)

      completeStreaming('2')

      const state = useChatStore.getState()
      expect(state.messages[0]?.status).toBe('streaming')
      expect(state.messages[1]?.status).toBe('complete')
    })
  })

  describe('setError', () => {
    it('sets error message', () => {
      const { setError } = useChatStore.getState()

      setError('Something went wrong')

      const state = useChatStore.getState()
      expect(state.error).toBe('Something went wrong')
    })

    it('clears error message when null', () => {
      const { setError } = useChatStore.getState()

      setError('Error')
      setError(null)

      const state = useChatStore.getState()
      expect(state.error).toBeNull()
    })
  })

  describe('setTemplate', () => {
    it('sets template ID', () => {
      const { setTemplate } = useChatStore.getState()

      setTemplate('template-123')

      const state = useChatStore.getState()
      expect(state.currentTemplateId).toBe('template-123')
    })

    it('clears template ID when null', () => {
      const { setTemplate } = useChatStore.getState()

      setTemplate('template-123')
      setTemplate(null)

      const state = useChatStore.getState()
      expect(state.currentTemplateId).toBeNull()
    })
  })

  describe('updateConfigAnswer', () => {
    it('adds a configuration answer', () => {
      const { updateConfigAnswer } = useChatStore.getState()

      updateConfigAnswer('stage', 'seed')

      const state = useChatStore.getState()
      expect(state.configAnswers.stage).toBe('seed')
    })

    it('updates multiple configuration answers', () => {
      const { updateConfigAnswer } = useChatStore.getState()

      updateConfigAnswer('stage', 'seed')
      updateConfigAnswer('amount', 2000000)
      updateConfigAnswer('industry', 'developer-tools')

      const state = useChatStore.getState()
      expect(state.configAnswers).toEqual({
        stage: 'seed',
        amount: 2000000,
        industry: 'developer-tools',
      })
    })

    it('overwrites existing configuration answer', () => {
      const { updateConfigAnswer } = useChatStore.getState()

      updateConfigAnswer('stage', 'seed')
      updateConfigAnswer('stage', 'series-a')

      const state = useChatStore.getState()
      expect(state.configAnswers.stage).toBe('series-a')
    })

    it('handles complex values (objects, arrays)', () => {
      const { updateConfigAnswer } = useChatStore.getState()

      updateConfigAnswer('personas', ['VC', 'Angel', 'Strategic'])
      updateConfigAnswer('metadata', { foo: 'bar', count: 42 })

      const state = useChatStore.getState()
      expect(state.configAnswers.personas).toEqual(['VC', 'Angel', 'Strategic'])
      expect(state.configAnswers.metadata).toEqual({ foo: 'bar', count: 42 })
    })
  })

  describe('resetConversation', () => {
    it('clears all state', () => {
      const {
        addMessage,
        setTemplate,
        updateConfigAnswer,
        setError,
        queueMessage,
        resetConversation,
      } = useChatStore.getState()

      // Populate store with data
      addMessage({
        id: '1',
        role: 'user',
        content: 'Test',
        timestamp: Date.now(),
      })
      setTemplate('template-123')
      updateConfigAnswer('key', 'value')
      setError('Error occurred')
      queueMessage('Queued message')
      useChatStore.setState({ isStreaming: true, streamingMessageId: '1' })

      resetConversation()

      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.isStreaming).toBe(false)
      expect(state.streamingMessageId).toBeNull()
      expect(state.currentTemplateId).toBeNull()
      expect(state.configAnswers).toEqual({})
      expect(state.error).toBeNull()
      expect(state.queuedMessage).toBeNull()
    })
  })

  describe('queueMessage', () => {
    it('stores message for later', () => {
      const { queueMessage } = useChatStore.getState()

      queueMessage('Queued for after stream')

      const state = useChatStore.getState()
      expect(state.queuedMessage).toBe('Queued for after stream')
    })

    it('overwrites previously queued message', () => {
      const { queueMessage } = useChatStore.getState()

      queueMessage('First')
      queueMessage('Second')

      const state = useChatStore.getState()
      expect(state.queuedMessage).toBe('Second')
    })
  })

  describe('dequeueMessage', () => {
    it('retrieves and clears queued message', () => {
      const { queueMessage, dequeueMessage } = useChatStore.getState()

      queueMessage('Queued message')
      const message = dequeueMessage()

      expect(message).toBe('Queued message')
      expect(useChatStore.getState().queuedMessage).toBeNull()
    })

    it('returns null when no message queued', () => {
      const { dequeueMessage } = useChatStore.getState()

      const message = dequeueMessage()

      expect(message).toBeNull()
    })

    it('can be called multiple times safely', () => {
      const { queueMessage, dequeueMessage } = useChatStore.getState()

      queueMessage('Message')
      const first = dequeueMessage()
      const second = dequeueMessage()

      expect(first).toBe('Message')
      expect(second).toBeNull()
    })
  })

  describe('Streaming workflow integration', () => {
    it('supports full streaming lifecycle', () => {
      const { addMessage, updateStreamingMessage, completeStreaming } =
        useChatStore.getState()

      // Start streaming
      const streamId = 'stream-123'
      useChatStore.setState({ isStreaming: true, streamingMessageId: streamId })
      addMessage({
        id: streamId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'streaming',
      })

      // Accumulate tokens
      updateStreamingMessage(streamId, 'Hello')
      updateStreamingMessage(streamId, 'Hello, world')
      updateStreamingMessage(streamId, 'Hello, world!')

      // Complete streaming
      completeStreaming(streamId)

      const state = useChatStore.getState()
      expect(state.messages).toHaveLength(1)
      expect(state.messages[0]?.content).toBe('Hello, world!')
      expect(state.messages[0]?.status).toBe('complete')
      expect(state.isStreaming).toBe(false)
      expect(state.streamingMessageId).toBeNull()
    })

    it('supports concurrent input queuing during streaming', () => {
      const { queueMessage, dequeueMessage } = useChatStore.getState()

      // Simulate user typing while streaming
      useChatStore.setState({
        isStreaming: true,
        streamingMessageId: 'stream-1',
      })
      queueMessage('User typed while streaming')

      // Stream completes
      useChatStore.setState({ isStreaming: false, streamingMessageId: null })

      // Retrieve queued message
      const queued = dequeueMessage()
      expect(queued).toBe('User typed while streaming')
    })
  })
})
