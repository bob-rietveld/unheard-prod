/**
 * Loading skeleton for ChatList.
 * Matches the new minimal ChatList layout with + button.
 */

export function ChatListSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Section header skeleton with + button */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="h-3 w-12 bg-foreground/10 rounded animate-pulse" />
        <div className="size-3.5 bg-foreground/10 rounded animate-pulse" />
      </div>

      {/* Chat list skeleton */}
      <div className="px-2 pb-3 space-y-0.5">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 rounded-md animate-pulse"
          >
            {/* Icon skeleton */}
            <div className="size-3.5 bg-foreground/10 rounded flex-shrink-0" />

            {/* Title skeleton */}
            <div
              className="flex-1 h-3 bg-foreground/10 rounded"
              style={{
                width: `${60 + Math.random() * 30}%`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
