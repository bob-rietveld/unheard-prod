import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/store/project-store'
import { useContextFiles } from '@/services/context'
import { ContextFileCard } from './ContextFileCard'
import { ContextUploader } from './ContextUploader'
import { Card, CardContent } from '@/components/ui/card'

export function ContextLibrary() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)

  // Query files from Convex (automatically subscribes to updates)
  // Returns undefined when projectId is null/undefined ('skip' mode)
  const files = useContextFiles(currentProject?._id)

  // Show message if no project selected
  if (!currentProject) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            {t('context.library.noProject')}
          </p>
        </CardContent>
      </Card>
    )
  }

  // If files is undefined (loading) or empty array, show upload UI
  if (!files || files.length === 0) {
    return <ContextUploader />
  }

  return (
    <div className="space-y-6">
      {/* File grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {files.map(file => (
          <ContextFileCard
            key={file._id}
            originalFilename={file.originalFilename}
            storedFilename={file.storedFilename}
            fileType={file.fileType}
            detectedType={file.detectedType}
            rows={file.rows}
            columns={file.columns}
            pages={file.pages}
            sizeBytes={file.sizeBytes}
            isLFS={file.isLFS}
            uploadedAt={file.uploadedAt}
            syncStatus={file.syncStatus}
          />
        ))}
      </div>

      {/* Upload UI below existing files */}
      <ContextUploader />
    </div>
  )
}
