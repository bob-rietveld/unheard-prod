import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useUser } from '@clerk/clerk-react'
import { ProjectSelector } from '@/components/projects/ProjectSelector'
import { ContextUploader } from '@/components/context/ContextUploader'
import { ContextLibrary } from '@/components/context/ContextLibrary'
import { useProjectStore } from '@/store/project-store'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

export function MainWindowContent({
  children,
  className,
}: MainWindowContentProps) {
  const lastQuickPaneEntry = useUIStore(state => state.lastQuickPaneEntry)
  const { user } = useUser()
  const currentProject = useProjectStore(state => state.currentProject)

  const greeting = user
    ? `Hello ${user.firstName || user.username || 'there'}`
    : 'Hello World'

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <div className="flex h-full flex-col">
          {/* Header with greeting and project selector */}
          <div className="border-b border-border p-4">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-foreground">
                {lastQuickPaneEntry
                  ? `Last entry: ${lastQuickPaneEntry}`
                  : greeting}
              </h1>
            </div>
            <ProjectSelector />
          </div>

          {/* Main content area */}
          <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
            {currentProject ? (
              <>
                <ContextUploader />
                <ContextLibrary />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                <p>Select or create a project to get started</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
