import { useTranslation } from 'react-i18next'
import { Loader2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAttioStore } from '@/store/attio-store'
import { useCohortStore } from '@/store/cohort-store'
import { useProjectStore } from '@/store/project-store'
import { useCreateAttioImport } from '@/services/attio'
import { commands } from '@/lib/bindings'
import type { AttioRecord } from '@/lib/attio-client'
import { getRecordName } from '@/lib/attio-client'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'unnamed'
}

interface AttioImportButtonProps {
  records: AttioRecord[]
  objectType: 'company' | 'person' | 'list_entry'
}

export function AttioImportButton({ records, objectType }: AttioImportButtonProps) {
  const { t } = useTranslation()
  const importStatus = useAttioStore(state => state.importStatus)
  const importProgress = useAttioStore(state => state.importProgress)
  const selectedRecordIds = useAttioStore(state => state.selectedRecordIds)
  const currentProject = useProjectStore(state => state.currentProject)
  const createImport = useCreateAttioImport()

  const selectedCount = selectedRecordIds.length
  const isImporting = importStatus === 'importing'
  const isComplete = importStatus === 'complete'

  const handleImport = async () => {
    const { selectedRecordIds: ids } = useAttioStore.getState()
    const project = useProjectStore.getState().currentProject
    if (ids.length === 0 || !project) return

    const selectedRecords = records.filter(r => ids.includes(r.id.record_id))
    const store = useAttioStore.getState()
    store.startImport(selectedRecords.length)

    try {
      // Build batch entries
      const entries = selectedRecords.map(record => {
        const name = getRecordName(record)
        const filename = slugify(name)
        const jsonData = {
          source: 'attio',
          importedAt: new Date().toISOString(),
          attioRecordId: record.id.record_id,
          attioWebUrl: record.web_url,
          objectType,
          name,
          attributes: record.values,
        }
        return {
          object_type: objectType,
          record_id: record.id.record_id,
          filename,
          json_content: JSON.stringify(jsonData, null, 2),
        }
      })

      // Single batch Rust command
      const result = await commands.batchSaveAttioImports(project.localPath, entries)

      if (result.status !== 'ok') {
        throw new Error(result.error)
      }

      // Create Convex records for each
      const importedConvexIds: string[] = []
      for (let i = 0; i < selectedRecords.length; i++) {
        const record = selectedRecords[i]!
        const filePath = result.data[i]!

        const convexId = await createImport.mutateAsync({
          projectId: project._id,
          attioRecordId: record.id.record_id,
          attioObjectType: objectType,
          name: getRecordName(record),
          attioWebUrl: record.web_url,
          localFilePath: filePath,
          attributes: record.values,
          importedAt: Date.now(),
          syncStatus: 'synced',
        })
        importedConvexIds.push(convexId as string)
        useAttioStore.getState().updateImportProgress(i + 1)
      }

      useAttioStore.getState().completeImport()
      toast.success(t('attio.importComplete'))
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('attio.importError')
      useAttioStore.getState().failImport(msg)
      toast.error(t('attio.importError'), { description: msg })
    }
  }

  const handleSaveAsCohort = () => {
    // The recently imported record IDs are the selected ones before import cleared them
    // We use the records currently visible + their Convex IDs
    // For now, open the create dialog -- caller can pass IDs from the import
    useCohortStore.getState().openCreateDialog()
  }

  return (
    <div className="flex items-center gap-2">
      {isComplete && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveAsCohort}
        >
          <Users className="size-4" />
          {t('cohorts.saveAsCohort')}
        </Button>
      )}
      <Button
        onClick={() => void handleImport()}
        disabled={selectedCount === 0 || isImporting || !currentProject}
        size="sm"
      >
        {isImporting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t('attio.importProgress', {
              current: importProgress.current,
              total: importProgress.total,
            })}
          </>
        ) : (
          t('attio.importCount', { count: selectedCount })
        )}
      </Button>
    </div>
  )
}
