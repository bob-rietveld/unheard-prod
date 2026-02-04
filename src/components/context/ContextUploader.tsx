import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { listen } from '@tauri-apps/api/event'
import { FileUp, X } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useProjectStore } from '@/store/project-store'
import { useUploadStore } from '@/store/upload-store'
import { useUploadContext, queueUploads } from '@/services/context'
import { logger } from '@/lib/logger'

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.csv', '.pdf', '.xlsx', '.xls']

export function ContextUploader() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const files = useUploadStore(state => state.files)
  const clearCompleted = useUploadStore(state => state.clearCompleted)
  const [isDragging, setIsDragging] = useState(false)

  const { mutate: uploadFile } = useUploadContext()

  useEffect(() => {
    if (!currentProject) {
      return
    }

    logger.debug('Setting up file drop handler')

    // Listen for file drop events
    const unlistenDrop = listen<string[]>('tauri://drag-drop', event => {
      const paths = event.payload
      logger.info('Files dropped', { count: paths.length, paths })

      // Filter by supported extensions
      const supportedPaths = paths.filter(path => {
        const ext = path.toLowerCase().substring(path.lastIndexOf('.'))
        return SUPPORTED_EXTENSIONS.includes(ext)
      })

      if (supportedPaths.length === 0) {
        logger.warn('No supported files in drop', { paths })
        return
      }

      if (supportedPaths.length < paths.length) {
        logger.info('Filtered out unsupported files', {
          total: paths.length,
          supported: supportedPaths.length,
        })
      }

      // Queue uploads with concurrency control
      queueUploads(supportedPaths, currentProject.localPath, uploadFile)
      setIsDragging(false)
    })

    const unlistenEnter = listen('tauri://drag-enter', () => {
      setIsDragging(true)
    })

    const unlistenLeave = listen('tauri://drag-leave', () => {
      setIsDragging(false)
    })

    return () => {
      void Promise.all([unlistenDrop, unlistenEnter, unlistenLeave]).then(fns =>
        fns.forEach(fn => fn())
      )
    }
  }, [currentProject, uploadFile])

  // Reset dragging state when drag leaves
  useEffect(() => {
    if (isDragging) {
      const timer = setTimeout(() => setIsDragging(false), 500)
      return () => clearTimeout(timer)
    }
  }, [isDragging])

  if (!currentProject) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{t('context.upload.noProject')}</p>
        </CardContent>
      </Card>
    )
  }

  const fileEntries = Object.entries(files)
  const hasFiles = fileEntries.length > 0
  const completedCount = fileEntries.filter(
    ([_, file]) => file.status === 'complete' || file.status === 'error'
  ).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t('context.upload.title')}</CardTitle>
          <CardDescription>{t('context.upload.supportedFormats')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
            }`}
          >
            <FileUp className="size-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{t('context.upload.dropZone')}</p>
              <p className="text-muted-foreground text-xs">
                {t('context.upload.supportedFormats')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {hasFiles && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {t('context.upload.uploading', { count: fileEntries.length })}
              </CardTitle>
              {completedCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearCompleted()}
                >
                  {t('context.upload.clearCompleted')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fileEntries.map(([id, file]) => (
                <FileUploadItem
                  key={id}
                  id={id}
                  file={file}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

interface FileUploadItemProps {
  id: string
  file: {
    originalFilename: string
    status: 'parsing' | 'copying' | 'committing' | 'complete' | 'error'
    percent: number
    error?: string
  }
}

function FileUploadItem({ id, file }: FileUploadItemProps) {
  const { t } = useTranslation()
  const removeFile = useUploadStore(state => state.removeFile)

  const statusText = {
    parsing: t('context.upload.status.parsing'),
    copying: t('context.upload.status.copying'),
    committing: t('context.upload.status.committing'),
    complete: t('context.upload.status.complete'),
    error: t('context.upload.status.error'),
  }[file.status]

  const statusColor = {
    parsing: 'bg-blue-500',
    copying: 'bg-yellow-500',
    committing: 'bg-purple-500',
    complete: 'bg-green-500',
    error: 'bg-red-500',
  }[file.status]

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{file.originalFilename}</p>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs">{statusText}</span>
            {(file.status === 'complete' || file.status === 'error') && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeFile(id)}
              >
                <X className="size-3" />
              </Button>
            )}
          </div>
        </div>

        {file.status !== 'complete' && file.status !== 'error' && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full transition-all duration-300 ${statusColor}`}
              style={{ width: `${file.percent}%` }}
            />
          </div>
        )}

        {file.status === 'error' && file.error && (
          <p className="text-xs text-destructive">{file.error}</p>
        )}
      </div>
    </div>
  )
}
