/**
 * Offline message queue with localStorage persistence.
 *
 * When the browser goes offline, messages are queued in localStorage.
 * When connectivity is restored, messages are sent in order.
 *
 * Storage Key: 'unheard:message-queue'
 * Max Queue Size: 50 messages
 * Max Age: 24 hours
 */

import { logger } from './logger'

const QUEUE_STORAGE_KEY = 'unheard:message-queue'
const MAX_QUEUE_SIZE = 50
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * A message waiting to be sent
 */
export interface QueuedMessage {
  /** Unique identifier for the message */
  id: string
  /** Message content */
  message: string
  /** Unix timestamp when message was queued */
  timestamp: number
  /** Number of retry attempts */
  retries: number
  /** Last error message (if any) */
  lastError?: string
}

/**
 * Load the message queue from localStorage.
 */
function loadQueue(): QueuedMessage[] {
  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY)
    if (!stored) return []

    const parsed = JSON.parse(stored) as QueuedMessage[]

    // Filter out expired messages
    const now = Date.now()
    const valid = parsed.filter(msg => now - msg.timestamp < MAX_AGE_MS)

    // Save back if we filtered any
    if (valid.length !== parsed.length) {
      saveQueue(valid)
    }

    return valid
  } catch (error) {
    logger.error('Failed to load message queue', { error })
    return []
  }
}

/**
 * Save the message queue to localStorage.
 */
function saveQueue(queue: QueuedMessage[]): void {
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  } catch (error) {
    logger.error('Failed to save message queue', { error })
  }
}

/**
 * Add a message to the queue.
 *
 * @param message - Message content to queue
 * @returns The queued message ID
 */
export function enqueueMessage(message: string): string {
  const queue = loadQueue()

  // Enforce max queue size
  if (queue.length >= MAX_QUEUE_SIZE) {
    logger.warn('Message queue full, dropping oldest message')
    queue.shift() // Remove oldest
  }

  const queuedMessage: QueuedMessage = {
    id: `queued-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    message,
    timestamp: Date.now(),
    retries: 0,
  }

  queue.push(queuedMessage)
  saveQueue(queue)

  logger.debug('Message enqueued', { id: queuedMessage.id })
  return queuedMessage.id
}

/**
 * Get the next message from the queue without removing it.
 *
 * @returns The next message, or null if queue is empty
 */
export function peekMessage(): QueuedMessage | null {
  const queue = loadQueue()
  return queue[0] ?? null
}

/**
 * Remove a message from the queue.
 *
 * @param id - Message ID to remove
 */
export function dequeueMessage(id: string): void {
  const queue = loadQueue()
  const filtered = queue.filter(msg => msg.id !== id)
  saveQueue(filtered)
  logger.debug('Message dequeued', { id })
}

/**
 * Update a message's retry count and error.
 *
 * @param id - Message ID to update
 * @param error - Error message
 */
export function markMessageFailed(id: string, error: string): void {
  const queue = loadQueue()
  const message = queue.find(msg => msg.id === id)

  if (message) {
    message.retries += 1
    message.lastError = error
    saveQueue(queue)
    logger.debug('Message marked as failed', { id, retries: message.retries })
  }
}

/**
 * Get all queued messages.
 *
 * @returns Array of queued messages
 */
export function getAllQueuedMessages(): QueuedMessage[] {
  return loadQueue()
}

/**
 * Clear all queued messages.
 */
export function clearQueue(): void {
  localStorage.removeItem(QUEUE_STORAGE_KEY)
  logger.debug('Message queue cleared')
}

/**
 * Get the number of messages in the queue.
 *
 * @returns Queue size
 */
export function getQueueSize(): number {
  return loadQueue().length
}
