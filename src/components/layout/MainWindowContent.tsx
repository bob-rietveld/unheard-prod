import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { useUser } from '@clerk/clerk-react'

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

  const greeting = user
    ? `Hello ${user.firstName || user.username || 'there'}`
    : 'Hello World'

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children || (
        <div className="flex flex-1 flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-foreground">
            {lastQuickPaneEntry
              ? `Last entry: ${lastQuickPaneEntry}`
              : greeting}
          </h1>
        </div>
      )}
    </div>
  )
}
