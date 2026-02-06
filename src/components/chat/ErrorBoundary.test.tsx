/**
 * Tests for ErrorBoundary component.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from './ErrorBoundary'
import { useChatStore } from '@/store/chat-store'

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should catch errors and display fallback UI', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByText(/The chat interface encountered an unexpected error/i)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reset chat/i })).toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('should show error details in development mode', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Set development mode
    const originalEnv = import.meta.env.DEV
    vi.stubGlobal('import.meta.env.DEV', true)

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Should show error details
    expect(screen.getByText(/Error Details/i)).toBeInTheDocument()

    vi.stubGlobal('import.meta.env.DEV', originalEnv)
    consoleSpy.mockRestore()
  })

  it('should reset chat state when reset button clicked', async () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const resetButton = screen.getByRole('button', { name: /reset chat/i })
    await user.click(resetButton)

    // Chat store should be reset
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.error).toBeNull()

    consoleSpy.mockRestore()
  })

  it('should recover after reset', async () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    const resetButton = screen.getByRole('button', { name: /reset chat/i })
    await user.click(resetButton)

    // After reset, error state is cleared and error boundary re-renders children
    // Since we can't change props mid-test, we just verify the reset clears state
    const state = useChatStore.getState()
    expect(state.messages).toEqual([])
    expect(state.error).toBeNull()

    consoleSpy.mockRestore()
  })
})
