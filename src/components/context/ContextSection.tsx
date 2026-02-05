import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileIcon, CheckCircle2, PlusIcon, RefreshCw } from 'lucide-react'
import { useProjectStore } from '@/store/project-store'
import {
  useContextFiles,
  useUploadContext,
  queueUploads,
  useConvexRetry,
} from '@/services/context'
import { commands } from '@/lib/tauri-bindings'
import { logger } from '@/lib/logger'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

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

/**
 * ContextSection displays files from the project folder.
 * Files can be added to context for processing.
 * Follows minimal design with + pattern.
 */

export function ContextSection() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const contextFiles = useContextFiles(currentProject?._id)

  const [folderFiles, setFolderFiles] = useState<ProjectFile[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [isScanning, setIsScanning] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  const { mutate: uploadFile } = useUploadContext(currentProject?._id ?? null)
  useConvexRetry()

  // Scan folder for files
  const scanFolder = async () => {
    if (!currentProject?.localPath) return

    setIsScanning(true)
    try {
      logger.info('Scanning project folder', { path: currentProject.localPath })
      const result = await commands.listProjectFiles(currentProject.localPath)

      if (result.status === 'ok') {
        const supportedFiles = result.data.filter(f => f.isSupported)
        setFolderFiles(supportedFiles)
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
    logger.debug('Toggling file selection', { filePath })
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        logger.debug('Removing file from selection', { filePath })
        next.delete(filePath)
      } else {
        logger.debug('Adding file to selection', { filePath })
        next.add(filePath)
      }
      logger.debug('New selection state', {
        count: next.size,
        files: Array.from(next),
      })
      return next
    })
  }

  const handleAddSelected = async () => {
    if (!currentProject?.localPath || selectedFiles.size === 0) return

    setIsAdding(true)
    try {
      const filePaths = Array.from(selectedFiles).map(
        relativePath => `${currentProject.localPath}/${relativePath}`
      )

      logger.info('Adding selected files to context', {
        count: filePaths.length,
      })
      queueUploads(filePaths, currentProject.localPath, uploadFile)

      // Clear selection after queuing
      setSelectedFiles(new Set())
    } catch (error) {
      logger.error('Error adding files', { error })
    } finally {
      setIsAdding(false)
    }
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileIcon className="size-12 text-foreground/20 mb-4" />
        <p className="text-sm text-foreground/40">
          {t('context.folder.noProject', 'Select a project to view files')}
        </p>
      </div>
    )
  }

  // Get processed file paths for comparison
  const processedPaths = new Set(
    contextFiles?.map(f => f.storedFilename.replace(/^context\//, '')) || []
  )

  // Debug logging
  useEffect(() => {
    if (folderFiles.length > 0) {
      logger.debug('File comparison debug', {
        folderFiles: folderFiles.map(f => f.path),
        processedPaths: Array.from(processedPaths),
        contextFiles: contextFiles?.map(f => f.storedFilename),
      })
    }
  }, [folderFiles, processedPaths, contextFiles])

  return (
    <div className="flex flex-col h-full">
      {/* Section header with + button and refresh */}
      <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between">
        <h2 className="text-[11px] font-medium tracking-wider uppercase text-foreground/40">
          {t('context.files.title', 'Context Files')}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={scanFolder}
            disabled={isScanning}
            className="size-4 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors cursor-pointer disabled:opacity-30"
            title={t('context.folder.refresh', 'Refresh')}
          >
            <RefreshCw
              className={cn('size-3.5', isScanning && 'animate-spin')}
            />
          </button>
          <button
            onClick={() => {
              logger.info('Add button clicked', {
                selectedCount: selectedFiles.size,
                selectedPaths: Array.from(selectedFiles),
              })
              handleAddSelected()
            }}
            disabled={selectedFiles.size === 0 || isAdding}
            className={cn(
              'size-4 flex items-center justify-center transition-colors cursor-pointer',
              selectedFiles.size === 0 || isAdding
                ? 'text-foreground/20 cursor-not-allowed'
                : 'text-foreground/40 hover:text-foreground'
            )}
            title={
              selectedFiles.size > 0
                ? t('context.add', `Add ${selectedFiles.size} file(s)`)
                : t('context.addFiles', 'Add files')
            }
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Files list */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {folderFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileIcon className="size-10 text-foreground/20 mb-3" />
            <p className="text-xs text-foreground/40">
              {isScanning
                ? t('context.folder.scanning', 'Scanning folder...')
                : t('context.folder.noFiles', 'No supported files found')}
            </p>
            <p className="text-xs text-foreground/30 mt-1">
              CSV, PDF, Excel (.xlsx, .xls)
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {folderFiles.map(file => {
              const isProcessed = processedPaths.has(file.path)
              const isSelected = selectedFiles.has(file.path)

              return (
                <div
                  key={file.path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all',
                    isProcessed
                      ? 'text-foreground/50 cursor-default'
                      : isSelected
                        ? 'bg-foreground/8 text-foreground cursor-pointer'
                        : 'text-foreground/70 hover:bg-foreground/4 hover:text-foreground cursor-pointer'
                  )}
                  onClick={() => {
                    if (!isProcessed) {
                      logger.debug('File row clicked', {
                        path: file.path,
                        isProcessed,
                        isSelected,
                      })
                      handleToggleFile(file.path)
                    }
                  }}
                >
                  {!isProcessed && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={checked => {
                        logger.debug('Checkbox changed', {
                          path: file.path,
                          checked,
                        })
                        handleToggleFile(file.path)
                      }}
                      className="cursor-pointer"
                      onClick={e => e.stopPropagation()}
                    />
                  )}

                  <FileIcon className="size-3.5 flex-shrink-0 opacity-50" />

                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium truncate">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-foreground/40 truncate">
                      {formatFileSize(file.size)}
                    </div>
                  </div>

                  {isProcessed && (
                    <CheckCircle2 className="size-3.5 text-green-500/70 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selection summary at bottom */}
      {selectedFiles.size > 0 && (
        <div className="px-6 py-3 border-t border-border/40 bg-accent/30">
          <p className="text-xs text-foreground/60">
            {selectedFiles.size} file{selectedFiles.size !== 1 ? 's' : ''}{' '}
            selected
          </p>
        </div>
      )}
    </div>
  )
}
