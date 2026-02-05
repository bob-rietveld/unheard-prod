import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useChatStore } from '@/store/chat-store'

/**
 * ChatInput component handles message input and submission.
 *
 * Features:
 * - Auto-expanding textarea (up to 5 lines, then scrolls)
 * - Enter key sends message (Shift+Enter for new line)
 * - Escape key clears input or stops streaming
 * - Send button disabled when input empty or streaming
 * - Focus management: Focus input after send
 *
 * Keyboard Shortcuts:
 * - Enter: Send message (if not shift+enter)
 * - Shift+Enter: New line
 * - Escape: Clear input (if empty) or stop streaming (if streaming)
 */

interface ChatInputProps {
  onSend: (message: string) => void
  onStopStreaming?: () => void
}

export function ChatInput({ onSend, onStopStreaming }: ChatInputProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isStreaming = useChatStore(state => state.isStreaming)

  // Auto-resize textarea up to 5 lines
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      const lineHeight = 24 // Approximate line height in pixels
      const maxHeight = lineHeight * 5
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight)
      textareaRef.current.style.height = `${newHeight}px`
    }
  }, [input])

  const handleSend = () => {
    const trimmedInput = input.trim()
    if (!trimmedInput || isStreaming) return

    onSend(trimmedInput)
    setInput('')

    // Focus input after send
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter without Shift sends message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
      return
    }

    // Escape clears input or stops streaming
    if (e.key === 'Escape') {
      e.preventDefault()
      if (input.trim() === '' && isStreaming) {
        onStopStreaming?.()
      } else {
        setInput('')
      }
    }
  }

  // Queue message if user types while streaming
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    // If streaming and user types, queue the message
    if (isStreaming && e.target.value.trim()) {
      const { queueMessage } = useChatStore.getState()
      queueMessage(e.target.value.trim())
    }
  }

  return (
    <div className="border-t border-border/60 bg-background/50 backdrop-blur-sm">
      <div className="flex items-end gap-3 px-6 py-4 max-w-4xl mx-auto">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming
              ? t('chat.input.streamingPlaceholder')
              : t('chat.input.placeholder')
          }
          disabled={isStreaming}
          className="resize-none min-h-[48px] max-h-[120px] bg-input/50 border-border/60 focus:bg-input focus:border-border transition-colors"
          aria-label={t('chat.input.ariaLabel')}
        />
        <Button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className="shrink-0 h-12 px-5"
          aria-label={t('chat.input.sendButton')}
        >
          <span className="text-sm font-medium">{t('chat.input.send')}</span>
        </Button>
      </div>
    </div>
  )
}
