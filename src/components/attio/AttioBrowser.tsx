import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Users, List, Settings, Loader2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAttioStore } from '@/store/attio-store'
import { useUIStore } from '@/store/ui-store'
import { useProjectStore } from '@/store/project-store'
import type { AttioTab } from '@/store/attio-store'
import {
  fetchCompanies,
  fetchPeople,
  fetchLists,
  fetchAllRecords,
  buildNameFilter,
  getRecordName,
} from '@/lib/attio-client'
import type { AttioRecord, AttioList as AttioListType } from '@/lib/attio-client'
import { usePreferences } from '@/services/preferences'
import { useAttioImports, useCreateAttioImport } from '@/services/attio'
import { commands } from '@/lib/bindings'
import { AttioRecordTable } from './AttioRecordTable'
import { AttioImportButton } from './AttioImportButton'
import { CohortCreateDialog } from '../cohorts/CohortCreateDialog'

const PAGE_SIZE = 50

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'unnamed'
}

interface AttioBrowserProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AttioBrowser({ open, onOpenChange }: AttioBrowserProps) {
  const { t } = useTranslation()
  const isConnected = useAttioStore(state => state.isConnected)
  const activeTab = useAttioStore(state => state.activeTab)
  const importStatus = useAttioStore(state => state.importStatus)
  const [offset, setOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [isBulkImporting, setIsBulkImporting] = useState(false)
  const { data: preferences } = usePreferences()
  const currentProject = useProjectStore(state => state.currentProject)
  const { data: existingImports } = useAttioImports(currentProject?._id ?? null)
  const createImport = useCreateAttioImport()

  const apiKey = preferences?.attio_api_key ?? ''

  // Debounce search query
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setOffset(0)
    }, 300)
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [searchQuery])

  const searchFilter = debouncedSearch ? buildNameFilter(debouncedSearch) : undefined

  const companiesQuery = useQuery({
    queryKey: ['attio', 'companies', offset, debouncedSearch],
    queryFn: () => fetchCompanies(apiKey, { limit: PAGE_SIZE, offset, filter: searchFilter?.filter as Record<string, unknown> | undefined }),
    enabled: isConnected && activeTab === 'companies' && open,
  })

  const peopleQuery = useQuery({
    queryKey: ['attio', 'people', offset, debouncedSearch],
    queryFn: () => fetchPeople(apiKey, { limit: PAGE_SIZE, offset, filter: searchFilter?.filter as Record<string, unknown> | undefined }),
    enabled: isConnected && activeTab === 'people' && open,
  })

  const listsQuery = useQuery({
    queryKey: ['attio', 'lists'],
    queryFn: () => fetchLists(apiKey),
    enabled: isConnected && activeTab === 'lists' && open,
  })

  const handleTabChange = (value: string) => {
    if (value) {
      useAttioStore.getState().setActiveTab(value as AttioTab)
      useAttioStore.getState().clearSelection()
      setOffset(0)
      setSearchQuery('')
      setDebouncedSearch('')
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      useAttioStore.getState().clearSelection()
      setOffset(0)
      setSearchQuery('')
      setDebouncedSearch('')
    }
    onOpenChange(nextOpen)
  }

  const currentQuery = activeTab === 'companies' ? companiesQuery : activeTab === 'people' ? peopleQuery : null
  const hasMore = currentQuery?.data?.hasMore ?? false
  const hasPrevious = offset > 0

  // Build a records array for the lists tab from AttioList data
  const listRecords: AttioRecord[] = (listsQuery.data ?? []).map((list: AttioListType) => ({
    id: { record_id: list.id.list_id, object_id: 'list', workspace_id: list.id.workspace_id },
    created_at: list.created_at,
    web_url: '',
    values: {
      name: [{ active_from: '', active_until: null, value: list.name, attribute_type: 'text' }],
    },
  }))

  const records: AttioRecord[] =
    activeTab === 'companies'
      ? (companiesQuery.data?.data ?? [])
      : activeTab === 'people'
        ? (peopleQuery.data?.data ?? [])
        : listRecords

  const isLoading =
    activeTab === 'companies'
      ? companiesQuery.isLoading
      : activeTab === 'people'
        ? peopleQuery.isLoading
        : listsQuery.isLoading

  const objectType = activeTab === 'companies' ? 'company' as const : activeTab === 'people' ? 'person' as const : 'list_entry' as const
  const tableType = activeTab === 'lists' ? 'list' as const : objectType

  // Bulk import: fetch all matching, filter out already-imported, batch save
  const handleBulkImport = async () => {
    const project = useProjectStore.getState().currentProject
    if (!project || activeTab === 'lists') return

    const bulkObjectType = activeTab === 'companies' ? 'companies' as const : 'people' as const
    const importObjectType = activeTab === 'companies' ? 'company' as const : 'person' as const

    setIsBulkImporting(true)
    useAttioStore.getState().startImport(0)

    try {
      // Fetch all matching records
      const filter = debouncedSearch ? buildNameFilter(debouncedSearch).filter as Record<string, unknown> : undefined
      const allRecords = await fetchAllRecords(apiKey, bulkObjectType, { filter })

      // Filter out already-imported
      const importedRecordIds = new Set(
        existingImports?.map(imp => imp.attioRecordId) ?? []
      )
      const newRecords = allRecords.filter(r => !importedRecordIds.has(r.id.record_id))

      if (newRecords.length === 0) {
        useAttioStore.getState().completeImport()
        toast.success(t('attio.importComplete'))
        setIsBulkImporting(false)
        return
      }

      useAttioStore.getState().startImport(newRecords.length)

      // Build batch entries
      const entries = newRecords.map(record => {
        const name = getRecordName(record)
        const filename = slugify(name)
        const jsonData = {
          source: 'attio',
          importedAt: new Date().toISOString(),
          attioRecordId: record.id.record_id,
          attioWebUrl: record.web_url,
          objectType: importObjectType,
          name,
          attributes: record.values,
        }
        return {
          object_type: importObjectType,
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

      // Create Convex records
      const importedConvexIds: string[] = []
      for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i]!
        const filePath = result.data[i]!
        const convexId = await createImport.mutateAsync({
          projectId: project._id,
          attioRecordId: record.id.record_id,
          attioObjectType: importObjectType,
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
    } finally {
      setIsBulkImporting(false)
    }
  }

  const isImporting = importStatus === 'importing'

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="flex flex-col sm:max-w-lg w-full">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {t('attio.title')}
              <span
                className={`size-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              />
            </SheetTitle>
            <SheetDescription>
              {isConnected ? t('attio.connected') : t('attio.notConnected')}
            </SheetDescription>
          </SheetHeader>

          {!isConnected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
              <p className="text-center text-sm text-muted-foreground">
                {t('attio.connectPrompt')}
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  useUIStore.getState().setPreferencesOpen(true)
                }}
              >
                <Settings className="size-4" />
                {t('attio.openPreferences')}
              </Button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="px-4">
                <ToggleGroup
                  type="single"
                  value={activeTab}
                  onValueChange={handleTabChange}
                  variant="outline"
                  className="w-full"
                >
                  <ToggleGroupItem value="companies" className="flex-1 gap-1.5">
                    <Building2 className="size-3.5" />
                    {t('attio.companies')}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="people" className="flex-1 gap-1.5">
                    <Users className="size-3.5" />
                    {t('attio.people')}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lists" className="flex-1 gap-1.5">
                    <List className="size-3.5" />
                    {t('attio.lists')}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              {/* Search bar (companies/people only) */}
              {activeTab !== 'lists' && (
                <div className="px-4 pb-2">
                  <Input
                    placeholder={t('attio.search')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-8"
                  />
                </div>
              )}

              {/* Results count when searching */}
              {debouncedSearch && activeTab !== 'lists' && (
                <div className="px-4 pb-1 text-xs text-muted-foreground">
                  {t('attio.resultsCount', { count: records.length })}
                </div>
              )}

              {/* Record table */}
              <div className="flex-1 overflow-y-auto px-4">
                <AttioRecordTable
                  records={records}
                  type={tableType}
                  isLoading={isLoading}
                />
              </div>

              {/* Pagination + Import */}
              <SheetFooter className="flex-row items-center justify-between border-t border-border/20 pt-2">
                <div className="flex items-center gap-2">
                  {activeTab !== 'lists' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasPrevious}
                        onClick={() => setOffset(prev => Math.max(0, prev - PAGE_SIZE))}
                      >
                        {t('attio.previous')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!hasMore}
                        onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                      >
                        {t('attio.next')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleBulkImport()}
                        disabled={isImporting || isBulkImporting || !isConnected || !currentProject}
                      >
                        {isBulkImporting ? (
                          <>
                            <Loader2 className="size-4 animate-spin" />
                            {t('attio.fetchingRecords')}
                          </>
                        ) : (
                          t('attio.importAll')
                        )}
                      </Button>
                    </>
                  )}
                </div>
                <AttioImportButton records={records} objectType={objectType} />
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <CohortCreateDialog />
    </>
  )
}
