/**
 * Tests for offline message queue.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  enqueueMessage,
  peekMessage,
  dequeueMessage,
  markMessageFailed,
  getAllQueuedMessages,
  clearQueue,
  getQueueSize,
} from './retry-queue'

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

vi.stubGlobal('localStorage', localStorageMock)

describe('retry-queue', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('enqueueMessage', () => {
    it('should add a message to the queue', () => {
      const id = enqueueMessage('Hello, world!')

      expect(id).toMatch(/^queued-/)
      expect(getQueueSize()).toBe(1)

      const message = peekMessage()
      expect(message).not.toBeNull()
      expect(message?.message).toBe('Hello, world!')
      expect(message?.retries).toBe(0)
    })

    it('should enforce max queue size', () => {
      // Enqueue 51 messages (max is 50)
      for (let i = 0; i < 51; i++) {
        enqueueMessage(`Message ${i}`)
      }

      expect(getQueueSize()).toBe(50)

      // First message should be dropped
      const messages = getAllQueuedMessages()
      expect(messages[0]?.message).toBe('Message 1')
    })

    it('should generate unique IDs', () => {
      const id1 = enqueueMessage('Message 1')
      const id2 = enqueueMessage('Message 2')

      expect(id1).not.toBe(id2)
    })
  })

  describe('peekMessage', () => {
    it('should return the first message without removing it', () => {
      enqueueMessage('First')
      enqueueMessage('Second')

      const message = peekMessage()

      if (!message) throw new Error('Message should exist')
      expect(message.message).toBe('First')
      expect(getQueueSize()).toBe(2)
    })

    it('should return null when queue is empty', () => {
      const message = peekMessage()

      expect(message).toBeNull()
    })
  })

  describe('dequeueMessage', () => {
    it('should remove a message from the queue', () => {
      const id = enqueueMessage('Test message')

      dequeueMessage(id)

      expect(getQueueSize()).toBe(0)
      expect(peekMessage()).toBeNull()
    })

    it('should not affect other messages', () => {
      const id1 = enqueueMessage('Message 1')
      const id2 = enqueueMessage('Message 2')
      const id3 = enqueueMessage('Message 3')

      dequeueMessage(id2)

      expect(getQueueSize()).toBe(2)

      const messages = getAllQueuedMessages()
      expect(messages[0]?.id).toBe(id1)
      expect(messages[1]?.id).toBe(id3)
    })

    it('should handle non-existent ID gracefully', () => {
      enqueueMessage('Test')

      dequeueMessage('nonexistent-id')

      expect(getQueueSize()).toBe(1)
    })
  })

  describe('markMessageFailed', () => {
    it('should increment retry count and store error', () => {
      const id = enqueueMessage('Test message')

      markMessageFailed(id, 'Network error')

      const message = peekMessage()
      expect(message).not.toBeNull()
      expect(message!.retries).toBe(1)
      expect(message!.lastError).toBe('Network error')
    })

    it('should increment retry count on multiple failures', () => {
      const id = enqueueMessage('Test message')

      markMessageFailed(id, 'Error 1')
      markMessageFailed(id, 'Error 2')

      const message = peekMessage()
      expect(message).not.toBeNull()
      expect(message!.retries).toBe(2)
      expect(message!.lastError).toBe('Error 2')
    })

    it('should handle non-existent ID gracefully', () => {
      enqueueMessage('Test')

      expect(() => {
        markMessageFailed('nonexistent-id', 'Error')
      }).not.toThrow()
    })
  })

  describe('getAllQueuedMessages', () => {
    it('should return all messages in order', () => {
      enqueueMessage('First')
      enqueueMessage('Second')
      enqueueMessage('Third')

      const messages = getAllQueuedMessages()

      expect(messages).toHaveLength(3)
      expect(messages[0]?.message).toBe('First')
      expect(messages[1]?.message).toBe('Second')
      expect(messages[2]?.message).toBe('Third')
    })

    it('should return empty array when queue is empty', () => {
      const messages = getAllQueuedMessages()

      expect(messages).toEqual([])
    })

    it('should filter expired messages', () => {
      // Add a message with old timestamp (25 hours ago)
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000
      const queue = [
        {
          id: 'old-message',
          message: 'Old message',
          timestamp: oldTimestamp,
          retries: 0,
        },
      ]
      localStorage.setItem('unheard:message-queue', JSON.stringify(queue))

      // Add a new message
      enqueueMessage('New message')

      // Old message should be filtered out
      const messages = getAllQueuedMessages()
      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toBe('New message')
    })
  })

  describe('clearQueue', () => {
    it('should remove all messages', () => {
      enqueueMessage('Message 1')
      enqueueMessage('Message 2')
      enqueueMessage('Message 3')

      clearQueue()

      expect(getQueueSize()).toBe(0)
      expect(getAllQueuedMessages()).toEqual([])
    })

    it('should handle empty queue gracefully', () => {
      expect(() => clearQueue()).not.toThrow()
    })
  })

  describe('getQueueSize', () => {
    it('should return correct queue size', () => {
      expect(getQueueSize()).toBe(0)

      enqueueMessage('Message 1')
      expect(getQueueSize()).toBe(1)

      enqueueMessage('Message 2')
      expect(getQueueSize()).toBe(2)

      const id = enqueueMessage('Message 3')
      expect(getQueueSize()).toBe(3)

      dequeueMessage(id)
      expect(getQueueSize()).toBe(2)
    })
  })

  describe('localStorage persistence', () => {
    it('should persist queue across page reloads', () => {
      enqueueMessage('Persisted message')

      // Simulate page reload by reading directly from localStorage
      const stored = localStorage.getItem('unheard:message-queue')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored ?? '[]')
      expect(parsed).toHaveLength(1)
      expect(parsed[0]?.message).toBe('Persisted message')
    })

    it('should handle corrupted localStorage gracefully', () => {
      // Corrupt the localStorage data
      localStorage.setItem('unheard:message-queue', 'invalid json')

      // Should return empty queue without throwing
      expect(() => getAllQueuedMessages()).not.toThrow()
      expect(getQueueSize()).toBe(0)
    })
  })
})
