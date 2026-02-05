/**
 * Loading skeleton for ProjectSelector.
 * Matches the actual ProjectSelector layout.
 */

export function ProjectSelectorSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      {/* Select skeleton */}
      <div className="flex-1 h-10 bg-foreground/10 rounded-lg" />

      {/* Button skeleton */}
      <div className="size-10 bg-foreground/10 rounded-lg flex-shrink-0" />
    </div>
  )
}
