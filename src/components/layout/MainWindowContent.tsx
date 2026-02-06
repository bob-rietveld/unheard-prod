import { cn } from '@/lib/utils'
import { ProjectTabs } from '@/components/projects/ProjectTabs'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { ErrorBoundary } from '@/components/chat/ErrorBoundary'
import { useProjectStore } from '@/store/project-store'
import { useChatStore } from '@/store/chat-store'
import { MessageSquareIcon } from 'lucide-react'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

/**
 * MainWindowContent shows either ChatInterface or ProjectTabs.
 * Clean, minimal layout following Dieter Rams principles.
 */

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  const currentProject = useProjectStore(state => state.currentProject)
  const currentChatId = useChatStore(state => state.currentChatId)

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <>
          {currentChatId ? (
            // Show chat interface when a chat is selected
            <ErrorBoundary>
              <ChatInterface />
            </ErrorBoundary>
          ) : currentProject ? (
            // Show project tabs when project selected but no chat
            <ProjectTabs />
          ) : (
            // Show empty state when no project selected
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <MessageSquareIcon className="size-12 text-foreground/20" />
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-foreground/60">
                  Select or create a project to get started
                </p>
                <p className="text-xs text-foreground/40">
                  Then create a chat to begin your conversation
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
