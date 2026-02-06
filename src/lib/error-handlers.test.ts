/**
 * Tests for error handling utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ChatError } from '@/lib/bindings'
import {
  analyzeChatError,
  calculateBackoff,
  delay,
  withRetry,
  isOnline,
  waitForOnline,
} from './error-handlers'

describe('analyzeChatError', () => {
  it('should analyze ConfigError as non-retryable', () => {
    const error: ChatError = {
      type: 'ConfigError',
      message: 'API key not configured',
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(false)
    expect(analysis.isRateLimit).toBe(false)
    expect(analysis.errorType).toBe('ConfigError')
    expect(analysis.userMessage).toBe('API key not configured')
  })

  it('should analyze RateLimitError as retryable with delay', () => {
    const error: ChatError = {
      type: 'RateLimitError',
      retry_after: 5000,
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(true)
    expect(analysis.isRateLimit).toBe(true)
    expect(analysis.retryAfter).toBe(5000)
    expect(analysis.errorType).toBe('RateLimitError')
  })

  it('should analyze NetworkError as retryable', () => {
    const error: ChatError = {
      type: 'NetworkError',
      message: 'Connection failed',
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(true)
    expect(analysis.isRateLimit).toBe(false)
    expect(analysis.errorType).toBe('NetworkError')
  })

  it('should analyze TimeoutError as retryable', () => {
    const error: ChatError = {
      type: 'TimeoutError',
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(true)
    expect(analysis.errorType).toBe('TimeoutError')
  })

  it('should analyze ApiError as retryable', () => {
    const error: ChatError = {
      type: 'ApiError',
      message: 'Server error',
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(true)
    expect(analysis.errorType).toBe('ApiError')
  })

  it('should analyze ParseError as non-retryable', () => {
    const error: ChatError = {
      type: 'ParseError',
      message: 'Invalid SSE format',
    }

    const analysis = analyzeChatError(error)

    expect(analysis.canRetry).toBe(false)
    expect(analysis.errorType).toBe('ParseError')
  })
})

describe('calculateBackoff', () => {
  it('should calculate exponential backoff correctly', () => {
    expect(calculateBackoff(0)).toBe(1000) // 1s
    expect(calculateBackoff(1)).toBe(2000) // 2s
    expect(calculateBackoff(2)).toBe(4000) // 4s
    expect(calculateBackoff(3)).toBe(8000) // 8s
    expect(calculateBackoff(4)).toBe(16000) // 16s
  })
})

describe('delay', () => {
  it('should wait for specified duration', async () => {
    const start = Date.now()
    await delay(100)
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(95) // Allow 5ms tolerance
    expect(elapsed).toBeLessThan(150)
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success')

    const result = await withRetry(fn)

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, { maxRetries: 3 })

    // Fast-forward through retries
    await vi.runAllTimersAsync()

    const result = await promise

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('should throw after max retries', async () => {
    vi.useRealTimers() // Use real timers for this test to avoid unhandled promise rejection

    const fn = vi.fn().mockRejectedValue(new Error('persistent failure'))

    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toThrow('persistent failure')
    expect(fn).toHaveBeenCalledTimes(1) // Initial only, no retries
  })

  it('should call onRetry callback', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const onRetry = vi.fn()

    const promise = withRetry(fn, { maxRetries: 2, onRetry })

    await vi.runAllTimersAsync()

    await promise

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledWith(1, 1000) // attempt 1, 1s delay
  })

  it('should use custom retry delay', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')

    const promise = withRetry(fn, { maxRetries: 2, retryAfter: 5000 })

    await vi.runAllTimersAsync()

    await promise

    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('isOnline', () => {
  it('should return navigator.onLine status', () => {
    // Note: In test environment, navigator.onLine is true by default
    expect(isOnline()).toBe(navigator.onLine)
  })
})

describe('waitForOnline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve immediately if already online', async () => {
    // Mock navigator.onLine as true
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)

    const result = await waitForOnline()

    expect(result).toBe(true)
  })

  it('should wait for online event', async () => {
    // Mock navigator.onLine as false
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const promise = waitForOnline(5000)

    // Simulate online event after 1 second
    setTimeout(() => {
      window.dispatchEvent(new Event('online'))
    }, 1000)

    vi.advanceTimersByTime(1000)

    const result = await promise

    expect(result).toBe(true)
  })

  it('should timeout if not online within timeout', async () => {
    // Mock navigator.onLine as false
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)

    const promise = waitForOnline(1000)

    // Fast-forward past timeout
    await vi.advanceTimersByTimeAsync(1500)

    const result = await promise

    expect(result).toBe(false)
  })
})
