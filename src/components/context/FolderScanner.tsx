import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, FileIcon, CheckIcon } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useProjectStore } from '@/store/project-store'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import {
  useUploadContext,
  queueUploads,
  useConvexRetry,
} from '@/services/context'

type ProjectFile = {
  path: string
  name: string
  extension: string
  size: number
  isSupported: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FolderScanner() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const { mutate: uploadFile } = useUploadContext(currentProject?._id ?? null)
  useConvexRetry()

  const scanFolder = async () => {
    if (!currentProject?.localPath) return

    setIsScanning(true)
    try {
      logger.info('Scanning project folder', { path: currentProject.localPath })
      const result = await commands.listProjectFiles(currentProject.localPath)

      if (result.status === 'ok') {
        const supportedFiles = result.data.filter(f => f.isSupported)
        setFiles(supportedFiles)
        logger.info('Found files', { count: supportedFiles.length })
      } else {
        logger.error('Failed to scan folder', { error: result.error })
      }
    } catch (error) {
      logger.error('Error scanning folder', { error })
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    if (currentProject?.localPath) {
      scanFolder()
    }
  }, [currentProject?.localPath])

  const handleToggleFile = (filePath: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  const handleToggleAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(files.map(f => f.path)))
    }
  }

  const handleUploadSelected = async () => {
    if (!currentProject?.localPath || selectedFiles.size === 0) return

    setIsUploading(true)
    try {
      const filePaths = Array.from(selectedFiles).map(
        relativePath => `${currentProject.localPath}/${relativePath}`
      )

      logger.info('Uploading selected files', { count: filePaths.length })
      queueUploads(filePaths, currentProject.localPath, uploadFile)

      // Clear selection after queuing
      setSelectedFiles(new Set())
    } catch (error) {
      logger.error('Error uploading files', { error })
    } finally {
      setIsUploading(false)
    }
  }

  if (!currentProject) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {t(
              'context.folder.noProject',
              'Select a project to scan for files'
            )}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold">
              {t('context.folder.title', 'Project Files')}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {t(
                'context.folder.description',
                'Select files from your project folder to load into context'
              )}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={scanFolder}
            disabled={isScanning}
            className="shrink-0 cursor-pointer border-border/60 hover:bg-accent transition-colors"
          >
            <RefreshCw
              className={`size-3.5 ${isScanning ? 'animate-spin' : ''}`}
            />
            <span className="text-sm font-medium">
              {t('context.folder.refresh', 'Refresh')}
            </span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">
              {isScanning
                ? t('context.folder.scanning', 'Scanning folder...')
                : t(
                    'context.folder.noFiles',
                    'No supported files found (CSV, PDF, Excel)'
                  )}
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  checked={
                    selectedFiles.size === files.length && files.length > 0
                  }
                  onCheckedChange={handleToggleAll}
                  className="cursor-pointer"
                />
                <span className="text-sm text-muted-foreground font-medium">
                  {selectedFiles.size} of {files.length} selected
                </span>
              </div>
              <Button
                onClick={handleUploadSelected}
                disabled={selectedFiles.size === 0 || isUploading}
                size="sm"
                className="cursor-pointer"
              >
                <span className="text-sm font-medium">
                  {isUploading
                    ? 'Uploading...'
                    : `Load ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}`}
                </span>
              </Button>
            </div>

            <div className="space-y-1.5 max-h-96 overflow-auto">
              {files.map(file => (
                <div
                  key={file.path}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-accent/50 hover:border-border transition-all cursor-pointer"
                  onClick={() => handleToggleFile(file.path)}
                >
                  <Checkbox
                    checked={selectedFiles.has(file.path)}
                    onCheckedChange={() => handleToggleFile(file.path)}
                    className="cursor-pointer"
                  />
                  <FileIcon className="size-4 text-muted-foreground/70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {file.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {file.path} • {formatFileSize(file.size)}
                    </div>
                  </div>
                  {selectedFiles.has(file.path) && (
                    <CheckIcon className="size-4 text-primary flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
