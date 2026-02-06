import { cn } from '@/lib/utils'
import { ProjectList } from '@/components/projects/ProjectList'
import { ChatList } from '@/components/chat/ChatList'
import { CohortList } from '@/components/cohorts/CohortList'
import { CohortDetail } from '@/components/cohorts/CohortDetail'
import { useProjectStore } from '@/store/project-store'

interface LeftSideBarProps {
  children?: React.ReactNode
  className?: string
}

/**
 * LeftSideBar with peaceful, minimal design.
 * Shows projects list at top, chats list below (when project selected).
 * Follows Dieter Rams principles: less but better.
 */

export function LeftSideBar({ children, className }: LeftSideBarProps) {
  const currentProject = useProjectStore(state => state.currentProject)

  return (
    <div
      className={cn(
        'flex h-full flex-col border-r border-border/30 bg-sidebar',
        className
      )}
    >
      {children || (
        <>
          {/* Projects section - always visible */}
          <div className="border-b border-border/20">
            <ProjectList />
          </div>

          {/* Chats section - only when project selected */}
          {currentProject && (
            <div className="flex-1 overflow-hidden">
              <ChatList />
            </div>
          )}

          {/* Cohorts section - only when project selected */}
          {currentProject && <CohortList />}
        </>
      )}

      {/* Cohort detail sheet (overlay, outside layout flow) */}
      <CohortDetail />
    </div>
  )
}
