import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCohortStore } from '@/store/cohort-store'
import { useProjectStore } from '@/store/project-store'
import { useCreateCohort } from '@/services/cohorts'
import type { Id } from '../../../convex/_generated/dataModel'

export function CohortCreateDialog() {
  const { t } = useTranslation()
  const createDialogOpen = useCohortStore(state => state.createDialogOpen)
  const pendingMemberIds = useCohortStore(state => state.pendingMemberIds)
  const currentProject = useProjectStore(state => state.currentProject)
  const createCohort = useCreateCohort()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      useCohortStore.getState().closeCreateDialog()
      setName('')
      setDescription('')
    }
  }

  const handleCreate = async () => {
    const project = useProjectStore.getState().currentProject
    const memberIds = useCohortStore.getState().pendingMemberIds
    if (!project || !name.trim()) return

    try {
      await createCohort.mutateAsync({
        projectId: project._id,
        name: name.trim(),
        description: description.trim() || undefined,
        memberIds: memberIds as Id<'attioImports'>[],
      })
      toast.success(t('cohorts.created'))
      handleOpenChange(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('toast.error.generic')
      toast.error(msg)
    }
  }

  return (
    <Dialog open={createDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cohorts.create')}</DialogTitle>
          <DialogDescription>
            {t('cohorts.createDescription', { count: pendingMemberIds.length })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder={t('cohorts.namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
          <Input
            placeholder={t('cohorts.descriptionPlaceholder')}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => void handleCreate()}
            disabled={!name.trim() || !currentProject || createCohort.isPending}
          >
            {t('cohorts.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
