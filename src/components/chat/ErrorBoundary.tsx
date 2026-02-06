/**
 * React Error Boundary for chat interface.
 *
 * Catches rendering errors in chat components and displays a fallback UI
 * with the option to reset the chat state.
 *
 * Note: Error boundaries do NOT catch:
 * - Errors in event handlers (use try-catch)
 * - Async code (use try-catch or .catch())
 * - Errors thrown in the error boundary itself
 */

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'
import { useChatStore } from '@/store/chat-store'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error Boundary component that catches React rendering errors.
 *
 * When an error is caught:
 * 1. Log error details to console
 * 2. Display user-friendly error UI
 * 3. Provide "Reset Chat" button to clear state and recover
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  // @ts-expect-error - getDerivedStateFromError is a static lifecycle method
  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error('React error boundary caught error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    })
  }

  handleReset = (): void => {
    // Reset chat store state
    useChatStore.getState().resetConversation()

    // Clear error boundary state
    this.setState({
      hasError: false,
      error: null,
    })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full px-8 py-16">
          <div className="max-w-md text-center space-y-6">
            <div className="space-y-3">
              <h2 className="text-destructive">Something went wrong</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The chat interface encountered an unexpected error. You can reset
                the chat to continue.
              </p>
            </div>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <details className="text-start text-xs text-muted-foreground bg-muted/50 p-4 rounded-lg">
                <summary className="cursor-pointer font-medium mb-2">
                  Error Details
                </summary>
                <pre className="whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex justify-center gap-3">
              <Button onClick={this.handleReset} variant="default">
                Reset Chat
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
