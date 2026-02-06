import { useTranslation } from 'react-i18next'
import { Users, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/project-store'
import { useCohortStore } from '@/store/cohort-store'
import { useProjectCohorts } from '@/services/cohorts'
import type { Id } from '../../../convex/_generated/dataModel'

export function CohortList() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const { data: cohorts } = useProjectCohorts(
    (currentProject?._id as Id<'projects'>) ?? null
  )

  if (!currentProject || !cohorts?.length) return null

  const handleOpenDetail = (cohortId: string) => {
    useCohortStore.getState().openDetail(cohortId)
  }

  const handleOpenCreate = () => {
    useCohortStore.getState().openCreateDialog()
  }

  return (
    <div className="border-t border-border/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t('cohorts.title')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={handleOpenCreate}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="space-y-0.5">
        {cohorts.map(cohort => (
          <button
            key={cohort._id}
            onClick={() => handleOpenDetail(cohort._id)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Users className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{cohort.name}</span>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {cohort.memberCount}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}
