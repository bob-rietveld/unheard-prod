import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChatBubble } from './ChatBubble'
import { useChatStore } from '@/store/chat-store'

/**
 * ChatMessages component displays the message history with auto-scroll behavior.
 *
 * Features:
 * - Auto-scroll to bottom on new messages (if user is near bottom)
 * - "Scroll to bottom" button appears when user scrolls up >100px
 * - ARIA live region for screen reader support
 * - Empty state with welcome message
 *
 * Auto-scroll Pattern:
 * - Only auto-scroll if user is within 100px of bottom
 * - Show "New messages ↓" button if user scrolled up
 * - Button click scrolls to bottom and hides button
 */

interface ChatMessagesProps {
  onSendPrompt?: (message: string) => void
}

export function ChatMessages({ onSendPrompt }: ChatMessagesProps) {
  const { t } = useTranslation()
  const messages = useChatStore(state => state.messages)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)

  // Check if user is near bottom of scroll area
  const isNearBottom = () => {
    if (!scrollAreaRef.current) return true
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    return scrollHeight - scrollTop - clientHeight < 100
  }

  // Scroll to bottom
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
    setShowScrollButton(false)
  }

  // Auto-scroll on new messages (if near bottom)
  useEffect(() => {
    if (messages.length > 0 && isNearBottom()) {
      scrollToBottom('smooth')
    } else if (messages.length > 0 && !isNearBottom()) {
      setShowScrollButton(true)
    }
  }, [messages])

  // Handle scroll event to show/hide scroll button
  const handleScroll = () => {
    if (isNearBottom()) {
      setShowScrollButton(false)
    } else {
      setShowScrollButton(true)
    }
  }

  // Empty state - refined, minimal
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 py-16">
        <div className="max-w-md text-center space-y-6">
          <div className="space-y-3">
            <h2 className="text-foreground">{t('chat.empty.title')}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('chat.empty.description')}
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <p className="text-xs uppercase tracking-wider font-medium text-muted-foreground/70">
              {t('chat.empty.suggestedPrompts')}
            </p>
            <div className="space-y-2 text-sm text-start">
              {(['chat.empty.prompt1', 'chat.empty.prompt2', 'chat.empty.prompt3'] as const).map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSendPrompt?.(t(key))}
                  className="flex w-full items-start gap-2 rounded-lg border border-border/50 px-3 py-2.5 text-start text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-primary mt-0.5 shrink-0">→</span>
                  <span>{t(key)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <ScrollArea
        ref={scrollAreaRef}
        onScroll={handleScroll}
        className="h-full px-4 py-6"
      >
        {/* ARIA live region for screen readers */}
        <div
          role="log"
          aria-live="polite"
          aria-label={t('chat.messages.ariaLabel')}
        >
          {messages.map(message => (
            <ChatBubble key={message.id} message={message} />
          ))}
        </div>
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Scroll to bottom button - refined floating action */}
      {showScrollButton && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
          <Button
            onClick={() => scrollToBottom('smooth')}
            variant="outline"
            size="sm"
            className="shadow-sm border-border/60 bg-card/95 backdrop-blur-sm hover:shadow-md transition-all"
            aria-label={t('chat.scrollToBottom')}
          >
            <span className="text-xs font-medium">{t('chat.newMessages')}</span>
            <span className="ml-1.5">↓</span>
          </Button>
        </div>
      )}
    </div>
  )
}
