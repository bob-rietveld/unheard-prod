/**
 * ErrorMessage component displays inline error messages with retry capabilities.
 *
 * Features:
 * - Context-specific error messages based on error type
 * - Retry button for transient errors
 * - Rate limit countdown timer with auto-retry
 * - Offline banner with queue status
 * - Config error modal trigger
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AlertCircle, WifiOff, Clock } from 'lucide-react'
import type { ChatError } from '@/lib/bindings'
import { analyzeChatError } from '@/lib/error-handlers'
import { logger } from '@/lib/logger'

interface ErrorMessageProps {
  /** The error to display */
  error: ChatError
  /** Callback when user clicks "Try Again" */
  onRetry?: () => void
  /** Whether a retry is currently in progress */
  retrying?: boolean
  /** Show as banner instead of inline message */
  banner?: boolean
}

/**
 * Display an error message with appropriate retry UI.
 */
export function ErrorMessage({
  error,
  onRetry,
  retrying = false,
  banner = false,
}: ErrorMessageProps) {
  const { t } = useTranslation()
  const analysis = analyzeChatError(error)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Rate limit countdown timer
  useEffect(() => {
    if (!analysis.isRateLimit || !analysis.retryAfter) return

    let remaining = Math.ceil(analysis.retryAfter / 1000) // Convert to seconds
    setCountdown(remaining)

    const interval = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)

      if (remaining <= 0) {
        clearInterval(interval)
        setCountdown(null)
        // Auto-retry after countdown
        if (onRetry) {
          logger.debug('Auto-retrying after rate limit')
          onRetry()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [analysis.isRateLimit, analysis.retryAfter, onRetry])

  // Banner style for persistent errors (offline, rate limit)
  if (banner) {
    return (
      <div
        className="border-b border-warning/20 bg-warning/10 px-6 py-3"
        role="alert"
        aria-live="polite"
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            {error.type === 'NetworkError' ? (
              <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
            ) : analysis.isRateLimit ? (
              <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
            ) : (
              <AlertCircle className="h-4 w-4 text-warning" aria-hidden="true" />
            )}
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-warning-foreground">
                {analysis.userMessage}
              </p>
              {countdown !== null && (
                <span className="text-xs text-muted-foreground">
                  ({countdown}s)
                </span>
              )}
            </div>
          </div>

          {analysis.canRetry && onRetry && countdown === null && (
            <Button
              onClick={onRetry}
              disabled={retrying}
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              {retrying ? t('chat.error.retrying') : t('chat.error.tryAgain')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // Inline style for message-specific errors
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5"
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle
        className="h-5 w-5 text-destructive shrink-0 mt-0.5"
        aria-hidden="true"
      />
      <div className="flex-1 space-y-2">
        <p className="text-sm text-destructive">{analysis.userMessage}</p>

        {/* Rate limit countdown */}
        {analysis.isRateLimit && countdown !== null && (
          <p className="text-xs text-muted-foreground">
            {t('chat.error.retryIn', { seconds: countdown })}
          </p>
        )}

        {/* Retry button */}
        {analysis.canRetry && onRetry && countdown === null && (
          <Button
            onClick={onRetry}
            disabled={retrying}
            size="sm"
            variant="outline"
            className="mt-2"
          >
            {retrying ? (
              <>
                <span className="inline-block w-3 h-3 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {t('chat.error.retrying')}
              </>
            ) : (
              t('chat.error.tryAgain')
            )}
          </Button>
        )}

        {/* Config error: Show setup instructions */}
        {error.type === 'ConfigError' && (
          <p className="text-xs text-muted-foreground mt-2">
            {t('chat.error.configHelp')}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * OfflineBanner shows a persistent banner when the browser is offline.
 */
interface OfflineBannerProps {
  queuedCount: number
}

export function OfflineBanner({ queuedCount }: OfflineBannerProps) {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div
      className="border-b border-warning/20 bg-warning/10 px-6 py-3"
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <WifiOff className="h-4 w-4 text-warning" aria-hidden="true" />
          <p className="text-sm font-medium text-warning-foreground">
            {t('chat.offline.message')}
          </p>
        </div>
        {queuedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('chat.offline.queued', { count: queuedCount })}
          </span>
        )}
      </div>
    </div>
  )
}
