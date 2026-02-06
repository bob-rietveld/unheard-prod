/**
 * Loading state components for chat interface.
 *
 * Provides various loading indicators:
 * - TypingIndicator: Animated dots during streaming
 * - MessageSkeleton: Placeholder for loading messages
 * - SendingIndicator: Inline "Sending..." status
 * - DecisionSavingOverlay: Full-screen overlay during decision log creation
 */

import { useTranslation } from 'react-i18next'

/**
 * TypingIndicator shows animated dots during streaming.
 */
export function TypingIndicator() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2" role="status" aria-live="polite">
      <div className="flex gap-1">
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '1s' }}
        />
        <div
          className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '1s' }}
        />
      </div>
      <span className="sr-only">{t('chat.loading.typing')}</span>
    </div>
  )
}

/**
 * MessageSkeleton shows placeholder UI while loading messages.
 */
export function MessageSkeleton() {
  return (
    <div className="flex w-full mb-6 justify-start" role="status" aria-busy="true">
      <div className="flex flex-col max-w-[75%] gap-2 animate-pulse">
        {/* Role indicator skeleton */}
        <div className="h-3 w-16 bg-muted rounded" />

        {/* Message bubble skeleton */}
        <div className="space-y-2 px-4 py-3 rounded-lg bg-card border border-border">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
        </div>

        <span className="sr-only">Loading message...</span>
      </div>
    </div>
  )
}

/**
 * SendingIndicator shows inline "Sending..." status.
 */
export function SendingIndicator() {
  const { t } = useTranslation()

  return (
    <div
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      <span>{t('chat.loading.sending')}</span>
    </div>
  )
}

/**
 * DecisionSavingOverlay shows full-screen loading during decision log creation.
 */
interface DecisionSavingOverlayProps {
  visible: boolean
}

export function DecisionSavingOverlay({ visible }: DecisionSavingOverlayProps) {
  const { t } = useTranslation()

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saving-title"
    >
      <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border border-border shadow-lg">
        {/* Spinner */}
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />

        {/* Status text */}
        <div className="text-center space-y-1">
          <p id="saving-title" className="font-medium text-foreground">
            {t('chat.loading.savingDecision')}
          </p>
          <p className="text-sm text-muted-foreground">
            {t('chat.loading.savingDescription')}
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * WizardLoadingSkeleton shows skeleton UI for wizard questions.
 */
export function WizardLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" role="status" aria-busy="true">
      {/* Question label skeleton */}
      <div className="space-y-2">
        <div className="h-4 w-48 bg-muted rounded" />
        <div className="h-3 w-64 bg-muted/70 rounded" />
      </div>

      {/* Input field skeleton */}
      <div className="h-10 w-full bg-muted rounded" />

      {/* Button skeleton */}
      <div className="h-10 w-24 bg-muted rounded" />

      <span className="sr-only">Loading configuration wizard...</span>
    </div>
  )
}
