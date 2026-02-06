/**
 * Error handling utilities for chat operations with retry logic.
 *
 * Implements exponential backoff retry strategy for transient errors.
 * Max retries: 5, backoff: 1s, 2s, 4s, 8s, 16s
 *
 * Error Categories:
 * - Transient: Network, Timeout, ApiError (5xx), RateLimitError → Retry
 * - Permanent: ConfigError, ParseError, ApiError (4xx) → No retry
 */

import type { ChatError } from '@/lib/bindings'
import { logger } from './logger'

/**
 * Maximum retry attempts for transient errors
 */
const MAX_RETRIES = 5

/**
 * Initial backoff delay in milliseconds
 */
const INITIAL_BACKOFF_MS = 1000

/**
 * Result of an error analysis
 */
export interface ErrorAnalysis {
  /** Error message suitable for display to users */
  userMessage: string
  /** Whether this error is retryable */
  canRetry: boolean
  /** Whether this is a rate limit error */
  isRateLimit: boolean
  /** Suggested retry delay in milliseconds (for rate limits) */
  retryAfter?: number
  /** Error type for tracking */
  errorType: string
}

/**
 * Analyze a ChatError and determine retry strategy.
 *
 * @param error - The error from the chat command
 * @returns Error analysis with retry strategy
 */
export function analyzeChatError(error: ChatError): ErrorAnalysis {
  switch (error.type) {
    case 'ConfigError':
      return {
        userMessage: error.message,
        canRetry: false,
        isRateLimit: false,
        errorType: 'ConfigError',
      }

    case 'RateLimitError':
      return {
        userMessage: 'Rate limit exceeded. Please wait before sending more messages.',
        canRetry: true,
        isRateLimit: true,
        retryAfter: error.retry_after ?? undefined,
        errorType: 'RateLimitError',
      }

    case 'ApiError':
      return {
        userMessage: 'The service is temporarily unavailable. Please try again.',
        canRetry: true,
        isRateLimit: false,
        errorType: 'ApiError',
      }

    case 'TimeoutError':
      return {
        userMessage: 'Request timed out. Please try again.',
        canRetry: true,
        isRateLimit: false,
        errorType: 'TimeoutError',
      }

    case 'NetworkError':
      return {
        userMessage: 'Network connection failed. Please check your internet connection.',
        canRetry: true,
        isRateLimit: false,
        errorType: 'NetworkError',
      }

    case 'ParseError':
      return {
        userMessage: 'Failed to process the response. Please try again.',
        canRetry: false,
        isRateLimit: false,
        errorType: 'ParseError',
      }

    default:
      logger.error('Unknown error type', { error })
      return {
        userMessage: 'An unexpected error occurred. Please try again.',
        canRetry: true,
        isRateLimit: false,
        errorType: 'Unknown',
      }
  }
}

/**
 * Calculate exponential backoff delay.
 *
 * @param retryCount - Number of retries attempted (0-indexed)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(retryCount: number): number {
  return INITIAL_BACKOFF_MS * Math.pow(2, retryCount)
}

/**
 * Wait for a specified duration.
 *
 * @param ms - Milliseconds to wait
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number
  /** Custom retry after delay (for rate limits) */
  retryAfter?: number
  /** Callback invoked before each retry */
  onRetry?: (attempt: number, delay: number) => void
}

/**
 * Execute a function with automatic retry on transient errors.
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries exhausted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = MAX_RETRIES, retryAfter, onRetry } = options
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      logger.debug('Retry attempt failed', { attempt, error })

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay
      const delayMs = retryAfter ?? calculateBackoff(attempt)

      // Notify caller
      if (onRetry) {
        onRetry(attempt + 1, delayMs)
      }

      // Wait before retry
      await delay(delayMs)
    }
  }

  // All retries exhausted
  throw lastError
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Wait until the browser is back online.
 *
 * @param timeoutMs - Maximum time to wait (default: 30 seconds)
 * @returns True if online, false if timeout
 */
export function waitForOnline(timeoutMs = 30000): Promise<boolean> {
  return new Promise(resolve => {
    if (isOnline()) {
      resolve(true)
      return
    }

    let timeout: ReturnType<typeof setTimeout> | undefined
    const handleOnline = () => {
      if (timeout) clearTimeout(timeout)
      window.removeEventListener('online', handleOnline)
      resolve(true)
    }

    window.addEventListener('online', handleOnline)

    timeout = setTimeout(() => {
      window.removeEventListener('online', handleOnline)
      resolve(false)
    }, timeoutMs)
  })
}
