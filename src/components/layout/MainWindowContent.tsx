import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ErrorBoundary } from '@/components/chat/ErrorBoundary'
import { useProjectStore } from '@/store/project-store'
import { useChatStore } from '@/store/chat-store'
import { useChats, useCreateChat } from '@/services/chats'
import { useTranslation } from 'react-i18next'
import { MessageSquareIcon, LoaderIcon } from 'lucide-react'
import { logger } from '@/lib/logger'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

/**
 * MainWindowContent shows ChatInterface or empty state.
 * Auto-creates/selects a chat when a project is selected.
 */

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const currentChatId = useChatStore(state => state.currentChatId)

  const projectId = currentProject?._id ?? null
  const chats = useChats(projectId)
  const createChat = useCreateChat()

  // Track which project we've already auto-chatted for
  const autoChatProjectRef = useRef<string | null>(null)

  // Auto-select or create a chat when a project is selected but no chat is active
  useEffect(() => {
    if (!projectId || currentChatId) return
    if (chats === undefined) return // Still loading
    if (autoChatProjectRef.current === projectId) return // Already handled

    autoChatProjectRef.current = projectId

    const { setCurrentChat, resetConversation } = useChatStore.getState()

    if (chats.length > 0) {
      // Auto-select the most recent chat
      const mostRecent = chats[0]!
      setCurrentChat(mostRecent._id)
      resetConversation()
      logger.info('Auto-selected existing chat', { chatId: mostRecent._id })
    } else {
      // Create a new chat automatically
      createChat.mutateAsync({
        projectId,
        title: 'New Chat',
      }).then(result => {
        setCurrentChat(result.chatId)
        resetConversation()
        logger.info('Auto-created chat', { chatId: result.chatId })
      }).catch(err => {
        logger.error('Failed to auto-create chat', { error: err })
      })
    }
  }, [projectId, currentChatId, chats, createChat])

  // Reset auto-chat tracking when project changes
  useEffect(() => {
    if (!projectId) {
      autoChatProjectRef.current = null
    }
  }, [projectId])

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <>
          {currentChatId ? (
            <ErrorBoundary>
              <ChatInterface />
            </ErrorBoundary>
          ) : currentProject ? (
            // Loading: auto-selecting or auto-creating chat
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <LoaderIcon className="size-8 animate-spin text-foreground/30" />
              <p className="text-sm text-foreground/50">
                {t('chat.autoCreate.loading')}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <MessageSquareIcon className="size-12 text-foreground/20" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground/60">
                  {t('chat.noProject.title')}
                </p>
                <p className="text-xs text-foreground/40">
                  {t('chat.noProject.subtitle')}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
