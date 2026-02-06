import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useCohortStore } from '@/store/cohort-store'
import { useCohort, useCohortMembers, useRemoveCohortMembers, useDeleteCohort } from '@/services/cohorts'
import { CohortMemberRow } from './CohortMemberRow'
import type { Id } from '../../../convex/_generated/dataModel'

export function CohortDetail() {
  const { t } = useTranslation()
  const cohortDetailOpen = useCohortStore(state => state.cohortDetailOpen)
  const selectedCohortId = useCohortStore(state => state.selectedCohortId)

  const { data: cohort } = useCohort(selectedCohortId as Id<'cohorts'> | null)
  const { data: members } = useCohortMembers(selectedCohortId as Id<'cohorts'> | null)
  const removeMembersMutation = useRemoveCohortMembers()
  const deleteCohortMutation = useDeleteCohort()

  const handleClose = () => {
    useCohortStore.getState().closeDetail()
  }

  const handleRemoveMember = (memberId: string) => {
    if (!cohort) return
    removeMembersMutation.mutate({
      id: cohort._id,
      projectId: cohort.projectId,
      memberIds: [memberId as Id<'attioImports'>],
    })
  }

  const handleDelete = () => {
    if (!cohort) return
    if (!window.confirm(t('cohorts.deleteConfirm'))) return
    deleteCohortMutation.mutate(
      { id: cohort._id, projectId: cohort.projectId },
      {
        onSuccess: () => {
          toast.success(t('cohorts.deleted'))
          useCohortStore.getState().closeDetail()
        },
      }
    )
  }

  return (
    <Sheet open={cohortDetailOpen} onOpenChange={open => !open && handleClose()}>
      <SheetContent side="right" className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{cohort?.name}</SheetTitle>
          <SheetDescription>
            {cohort?.description || t('cohorts.noDescription')}
            {' · '}
            {cohort?.memberCount} {t('cohorts.members')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {members?.map(member => (
            <CohortMemberRow
              key={member._id}
              member={member}
              onRemove={() => handleRemoveMember(member._id)}
            />
          ))}
          {members?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">{t('cohorts.empty')}</p>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteCohortMutation.isPending}
          >
            {t('cohorts.delete')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
