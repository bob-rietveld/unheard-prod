import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjectCohorts } from '@/services/cohorts'
import type { Id } from '../../../convex/_generated/dataModel'

interface CohortSelectorProps {
  projectId: string
  selectedCohortId: string | null
  onSelect: (cohortId: string | null) => void
}

export function CohortSelector({
  projectId,
  selectedCohortId,
  onSelect,
}: CohortSelectorProps) {
  const { t } = useTranslation()
  const { data: cohorts } = useProjectCohorts(projectId as Id<'projects'>)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {t('cohorts.selectForExperiment')}
      </label>
      <Select
        value={selectedCohortId ?? ''}
        onValueChange={v => onSelect(v || null)}
      >
        <SelectTrigger>
          <SelectValue placeholder={t('cohorts.selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="synthetic">
            {t('cohorts.syntheticPersonas')}
          </SelectItem>
          {cohorts?.map(cohort => (
            <SelectItem key={cohort._id} value={cohort._id}>
              {cohort.name} ({cohort.memberCount})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedCohortId && selectedCohortId !== 'synthetic' && (
        <p className="text-xs text-muted-foreground">
          {t('cohorts.cohortWillBeUsed')}
        </p>
      )}
    </div>
  )
}
