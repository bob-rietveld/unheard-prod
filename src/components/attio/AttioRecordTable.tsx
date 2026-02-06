import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useAttioStore } from '@/store/attio-store'
import { useAttioImports } from '@/services/attio'
import { useProjectStore } from '@/store/project-store'
import type { AttioRecord } from '@/lib/attio-client'
import { getRecordName, getRecordDomain, getRecordEmail } from '@/lib/attio-client'

interface AttioRecordTableProps {
  records: AttioRecord[]
  type: 'company' | 'person' | 'list'
  isLoading: boolean
}

export function AttioRecordTable({ records, type, isLoading }: AttioRecordTableProps) {
  const { t } = useTranslation()
  const selectedRecordIds = useAttioStore(state => state.selectedRecordIds)
  const currentProject = useProjectStore(state => state.currentProject)
  const { data: existingImports } = useAttioImports(currentProject?._id ?? null)

  const importedRecordIds = new Set(
    existingImports?.map(imp => imp.attioRecordId) ?? []
  )

  const allRecordIds = records.map(r => r.id.record_id)
  const allSelected = records.length > 0 && allRecordIds.every(id => selectedRecordIds.includes(id))
  const someSelected = allRecordIds.some(id => selectedRecordIds.includes(id))

  const handleSelectAll = () => {
    if (allSelected) {
      useAttioStore.getState().clearSelection()
    } else {
      useAttioStore.getState().selectAll(allRecordIds)
    }
  }

  const handleToggle = (recordId: string) => {
    useAttioStore.getState().toggleRecordSelection(recordId)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        {t('attio.noRecords')}
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {/* Header row */}
      <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={handleSelectAll}
          aria-label={t('attio.selectAll')}
        />
        <span className="flex-1">{type === 'person' ? t('attio.people') : type === 'company' ? t('attio.companies') : t('attio.lists')}</span>
        {type === 'company' && <span className="w-32 text-end">Domain</span>}
        {type === 'person' && <span className="w-40 text-end">Email</span>}
      </div>

      {/* Record rows */}
      {records.map(record => {
        const recordId = record.id.record_id
        const isSelected = selectedRecordIds.includes(recordId)
        const isImported = importedRecordIds.has(recordId)
        const name = getRecordName(record)

        return (
          <div
            key={recordId}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => handleToggle(recordId)}
              aria-label={name}
            />
            <div className="flex flex-1 items-center gap-2 min-w-0">
              <span className="truncate text-sm">{name}</span>
              {isImported && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {t('attio.alreadyImported')}
                </Badge>
              )}
            </div>
            {type === 'company' && (
              <span className="w-32 truncate text-end text-xs text-muted-foreground">
                {getRecordDomain(record) ?? ''}
              </span>
            )}
            {type === 'person' && (
              <span className="w-40 truncate text-end text-xs text-muted-foreground">
                {getRecordEmail(record) ?? ''}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
