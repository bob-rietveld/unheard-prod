import { useTranslation } from 'react-i18next'
import { type ChatMessage } from '@/types/chat'

/**
 * ChatBubble component displays an individual message in the chat interface.
 *
 * Styling:
 * - User messages: right-aligned, blue background
 * - Assistant messages: left-aligned, gray background
 * - Streaming messages: show typing indicator (animated cursor)
 *
 * Follows shadcn/ui Card component pattern for consistent styling.
 */

interface ChatBubbleProps {
  message: ChatMessage
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  return (
    <div
      className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className="flex flex-col max-w-[75%] gap-2">
        {/* Role indicator - subtle, functional */}
        <div
          className={`text-xs font-medium tracking-wide uppercase ${
            isUser
              ? 'text-end text-muted-foreground'
              : 'text-start text-muted-foreground'
          }`}
        >
          {isUser ? t('chat.you', 'You') : t('chat.assistant', 'Assistant')}
        </div>

        {/* Message bubble */}
        <div
          className={`
            px-4 py-3 rounded-lg
            ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border'
            }
            ${isError ? 'border-destructive bg-destructive/5' : ''}
            transition-all duration-200
          `}
        >
          {/* Message content */}
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            <>{String(message.content)}</>
            {isStreaming && (
              <span
                className="inline-block w-1.5 h-4 ml-1.5 bg-current rounded-sm animate-pulse"
                aria-label={t('chat.typing')}
              />
            )}
          </div>

          {/* Error state */}
          {isError && message.metadata?.error && (
            <div className="mt-3 pt-3 border-t border-destructive/20 text-sm text-destructive">
              {typeof message.metadata.error === 'string'
                ? message.metadata.error
                : t('chat.error.generic', 'An error occurred')}
            </div>
          )}
        </div>

        {/* Timestamp - subtle, unobtrusive */}
        {message.status === 'complete' && (
          <div
            className={`text-xs text-muted-foreground/60 ${
              isUser ? 'text-end' : 'text-start'
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        )}
      </div>
    </div>
  )
}
