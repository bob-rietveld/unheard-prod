import { useMutation } from '@tanstack/react-query'
import { useQuery as useConvexQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import { commands } from '@/lib/tauri-bindings'
import type { UploadProgress } from '@/lib/bindings'
import { useUploadStore } from '@/store/upload-store'
import { Channel } from '@tauri-apps/api/core'
import type { Id } from '../../convex/_generated/dataModel'

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.csv', '.pdf', '.xlsx', '.xls']

// Maximum concurrent uploads
const MAX_CONCURRENT_UPLOADS = 5

// Upload queue state (module-level to persist across hook instances)
let activeUploads = 0
const uploadQueue: Array<() => void> = []

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
 */
export function useUploadContext() {
  const addFile = useUploadStore(state => state.addFile)
  const updateFile = useUploadStore(state => state.updateFile)

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
            updateFile(uploadId, 'complete', 100)
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

        logger.info('Context file uploaded successfully', {
          filename: result.data.originalFilename,
        })

        return result.data
      } finally {
        // Mark upload complete in queue
        activeUploads--
        processQueue()
      }
    },
    onSuccess: data => {
      toast.success('File uploaded successfully', {
        description: data.originalFilename,
      })
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
