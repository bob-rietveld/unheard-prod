import { useMutation } from '@tanstack/react-query'
import {
  useQuery as useConvexQuery,
  useMutation as useConvexMutation,
} from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { commands } from '@/lib/tauri-bindings'
import type { UploadProgress } from '@/lib/bindings'
import { useUploadStore } from '@/store/upload-store'
import { Channel } from '@tauri-apps/api/core'
import type { Id } from '../../convex/_generated/dataModel'
import { useEffect } from 'react'

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.csv', '.pdf', '.xlsx', '.xls']

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 5

// Upload queue state (module-level to persist across hook instances)
let activeUploads = 0
const uploadQueue: (() => void)[] = []

/**
 * Process the next upload in the queue.
 */
function processQueue() {
  if (uploadQueue.length === 0 || activeUploads >= MAX_CONCURRENT_UPLOADS) {
    return
  }

  const nextUpload = uploadQueue.shift()
  if (nextUpload) {
    activeUploads++
    nextUpload()
  }
}

/**
 * Query hook to get all context files for a project from Convex.
 */
export function useContextFiles(projectId: Id<'projects'> | null | undefined) {
  return useConvexQuery(
    api.contexts.listByProject,
    projectId ? { projectId } : 'skip'
  )
}

/**
 * Hook to upload context files with progress tracking.
 * Handles file upload, progress updates via Tauri channels, and state management.
 * After successful Rust upload, syncs metadata to Convex.
 */
export function useUploadContext(projectId: Id<'projects'> | null) {
  const addFile = useUploadStore(state => state.addFile)
  const updateFile = useUploadStore(state => state.updateFile)
  const addToRetryQueue = useUploadStore(state => state.addToRetryQueue)
  const convexCreate = useConvexMutation(api.contexts.create)

  return useMutation({
    mutationFn: async ({
      path,
      projectPath,
    }: {
      path: string
      projectPath: string
    }) => {
      logger.info('Starting context file upload', { path, projectPath })

      // Generate upload ID (use path as unique identifier)
      const uploadId = path

      // Extract filename
      const filename = path.split('/').pop() || path

      // Check file extension
      const extension = filename
        .toLowerCase()
        .substring(filename.lastIndexOf('.'))
      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        throw new Error(
          `Unsupported file type: ${extension}. Supported types: ${SUPPORTED_EXTENSIONS.join(', ')}`
        )
      }

      // Add to upload store
      addFile(uploadId, filename)

      // Create progress channel
      const channel = new Channel<UploadProgress>()

      // Listen to channel messages
      channel.onmessage = (progress: UploadProgress) => {
        logger.debug('Upload progress event', { progress, uploadId })

        switch (progress.type) {
          case 'Parsing':
            updateFile(uploadId, 'parsing', progress.percent || 0)
            break
          case 'Copying':
            updateFile(uploadId, 'copying', progress.percent || 0)
            break
          case 'Committing':
            updateFile(uploadId, 'committing', progress.percent || 0)
            break
          case 'Complete':
            // Don't mark complete yet - need to sync to Convex first
            updateFile(uploadId, 'syncing', 100)
            break
          case 'Error':
            updateFile(
              uploadId,
              'error',
              0,
              progress.message || 'Upload failed'
            )
            break
        }
      }

      try {
        // Invoke Rust command with channel
        const result = await commands.uploadContextFile(
          path,
          projectPath,
          channel
        )

        if (result.status === 'error') {
          throw new Error(result.error)
        }

        logger.info('Context file uploaded successfully (local)', {
          filename: result.data.originalFilename,
        })

        // Sync to Convex if project ID is available
        if (projectId) {
          try {
            await convexCreate({
              projectId,
              originalFilename: result.data.originalFilename,
              storedFilename: result.data.storedFilename,
              fileType: result.data.fileType,
              detectedType: result.data.detectedType ?? undefined,
              rows: result.data.rows ?? undefined,
              columns: result.data.columns ?? undefined,
              preview: result.data.preview ?? undefined,
              pages: result.data.pages ?? undefined,
              textPreview: result.data.textPreview ?? undefined,
              sizeBytes: result.data.sizeBytes,
              relativeFilePath: result.data.relativeFilePath,
              isLFS: result.data.isLfs,
              uploadedAt: Date.now(),
              syncStatus: 'synced',
            })

            logger.info('Context file synced to Convex', {
              filename: result.data.originalFilename,
            })

            // Mark as complete after successful sync
            updateFile(uploadId, 'complete', 100)
          } catch (convexError) {
            logger.error('Failed to sync to Convex, queuing for retry', {
              error:
                convexError instanceof Error
                  ? convexError.message
                  : String(convexError),
              filename: result.data.originalFilename,
            })

            // Add to retry queue
            addToRetryQueue({
              id: uploadId,
              projectId,
              record: result.data,
              uploadedAt: Date.now(),
            })

            // Mark as unsynced but locally complete
            updateFile(uploadId, 'unsynced', 100, 'Failed to sync to cloud')
          }
        } else {
          // No project ID - mark complete anyway (local only)
          updateFile(uploadId, 'complete', 100)
          logger.warn('No project ID provided, file stored locally only', {
            filename: result.data.originalFilename,
          })
        }

        return result.data
      } finally {
        // Mark upload complete in queue
        activeUploads--
        processQueue()
      }
    },
    onSuccess: (data, variables) => {
      const uploadId = variables.path
      const file = useUploadStore.getState().files[uploadId]

      if (file?.status === 'unsynced') {
        toast.warning('File uploaded locally but not synced', {
          description: `${data.originalFilename} - will retry automatically`,
        })
      } else {
        toast.success('File uploaded successfully', {
          description: data.originalFilename,
        })
      }

      logger.info('Upload completed', { filename: data.originalFilename })
    },
    onError: (error: Error, variables) => {
      const filename = variables.path.split('/').pop() || variables.path
      logger.error('Failed to upload context file', {
        error: error.message,
        path: variables.path,
      })
      toast.error('Failed to upload file', {
        description: `${filename}: ${error.message}`,
      })
    },
  })
}

/**
 * Queue multiple file uploads with concurrency control.
 */
export function queueUploads(
  paths: string[],
  projectPath: string,
  uploadFn: ReturnType<typeof useUploadContext>['mutate']
) {
  paths.forEach(path => {
    const startUpload = () => {
      uploadFn({ path, projectPath })
    }

    if (activeUploads < MAX_CONCURRENT_UPLOADS) {
      activeUploads++
      startUpload()
    } else {
      uploadQueue.push(startUpload)
    }
  })
}

/**
 * Hook to automatically retry failed Convex syncs.
 * Runs every 30 seconds and attempts to sync items in the retry queue.
 */
export function useConvexRetry() {
  const retryQueue = useUploadStore(state => state.retryQueue)
  const removeFromRetryQueue = useUploadStore(
    state => state.removeFromRetryQueue
  )
  const updateRetryAttempt = useUploadStore(state => state.updateRetryAttempt)
  const updateFile = useUploadStore(state => state.updateFile)
  const convexCreate = useConvexMutation(api.contexts.create)

  useEffect(() => {
    if (retryQueue.length === 0) {
      return
    }

    const interval = setInterval(async () => {
      const now = Date.now()

      for (const item of retryQueue) {
        // Skip if attempted too recently (less than 30s ago)
        if (now - item.lastAttempt < 30000) {
          continue
        }

        // Skip if too many attempts (max 10)
        if (item.attempts >= 10) {
          logger.warn('Max retry attempts reached, removing from queue', {
            id: item.id,
            attempts: item.attempts,
          })
          removeFromRetryQueue(item.id)
          continue
        }

        logger.info('Retrying Convex sync', {
          id: item.id,
          attempt: item.attempts + 1,
        })

        try {
          await convexCreate({
            projectId: item.projectId,
            originalFilename: item.record.originalFilename,
            storedFilename: item.record.storedFilename,
            fileType: item.record.fileType,
            detectedType: item.record.detectedType ?? undefined,
            rows: item.record.rows ?? undefined,
            columns: item.record.columns ?? undefined,
            preview: item.record.preview ?? undefined,
            pages: item.record.pages ?? undefined,
            textPreview: item.record.textPreview ?? undefined,
            sizeBytes: item.record.sizeBytes,
            relativeFilePath: item.record.relativeFilePath,
            isLFS: item.record.isLfs,
            uploadedAt: item.uploadedAt,
            syncStatus: 'synced',
          })

          logger.info('Retry successful, synced to Convex', { id: item.id })

          // Remove from retry queue and update file status
          removeFromRetryQueue(item.id)
          updateFile(item.id, 'complete', 100)

          toast.success('File synced to cloud', {
            description: item.record.originalFilename,
          })
        } catch (error) {
          logger.error('Retry failed', {
            id: item.id,
            error: error instanceof Error ? error.message : String(error),
          })
          updateRetryAttempt(item.id)
        }
      }
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [
    retryQueue,
    convexCreate,
    removeFromRetryQueue,
    updateRetryAttempt,
    updateFile,
  ])
}
