import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Id } from '../../convex/_generated/dataModel'
import type { ContextFileRecord } from '@/lib/bindings'

export type UploadStatus =
  | 'parsing'
  | 'copying'
  | 'committing'
  | 'syncing'
  | 'complete'
  | 'error'
  | 'unsynced'

export interface UploadFileState {
  originalFilename: string
  status: UploadStatus
  percent: number
  error?: string
}

export interface RetryQueueItem {
  id: string
  projectId: Id<'projects'>
  record: ContextFileRecord
  uploadedAt: number
  attempts: number
  lastAttempt: number
}

interface UploadState {
  files: Record<string, UploadFileState>
  retryQueue: RetryQueueItem[]

  addFile: (id: string, filename: string) => void
  updateFile: (
    id: string,
    status: UploadStatus,
    percent: number,
    error?: string
  ) => void
  removeFile: (id: string) => void
  clearCompleted: () => void
  addToRetryQueue: (
    item: Omit<RetryQueueItem, 'attempts' | 'lastAttempt'>
  ) => void
  removeFromRetryQueue: (id: string) => void
  updateRetryAttempt: (id: string) => void
}

export const useUploadStore = create<UploadState>()(
  devtools(
    persist(
      set => ({
        files: {},
        retryQueue: [],

        addFile: (id, filename) =>
          set(
            state => ({
              files: {
                ...state.files,
                [id]: {
                  originalFilename: filename,
                  status: 'parsing',
                  percent: 0,
                },
              },
            }),
            undefined,
            'addFile'
          ),

        updateFile: (id, status, percent, error) =>
          set(
            state => {
              const existingFile = state.files[id]
              if (!existingFile) return state
              return {
                files: {
                  ...state.files,
                  [id]: {
                    ...existingFile,
                    status,
                    percent,
                    error,
                  },
                },
              }
            },
            undefined,
            'updateFile'
          ),

        removeFile: id =>
          set(
            state => {
              const { [id]: _, ...rest } = state.files
              return { files: rest }
            },
            undefined,
            'removeFile'
          ),

        clearCompleted: () =>
          set(
            state => ({
              files: Object.fromEntries(
                Object.entries(state.files).filter(
                  ([_, file]) =>
                    file.status !== 'complete' && file.status !== 'error'
                )
              ),
            }),
            undefined,
            'clearCompleted'
          ),

        addToRetryQueue: item =>
          set(
            state => ({
              retryQueue: [
                ...state.retryQueue,
                {
                  ...item,
                  attempts: 0,
                  lastAttempt: Date.now(),
                },
              ],
            }),
            undefined,
            'addToRetryQueue'
          ),

        removeFromRetryQueue: id =>
          set(
            state => ({
              retryQueue: state.retryQueue.filter(item => item.id !== id),
            }),
            undefined,
            'removeFromRetryQueue'
          ),

        updateRetryAttempt: id =>
          set(
            state => ({
              retryQueue: state.retryQueue.map(item =>
                item.id === id
                  ? {
                      ...item,
                      attempts: item.attempts + 1,
                      lastAttempt: Date.now(),
                    }
                  : item
              ),
            }),
            undefined,
            'updateRetryAttempt'
          ),
      }),
      {
        name: 'upload-store',
        partialize: state => ({ retryQueue: state.retryQueue }),
      }
    ),
    {
      name: 'upload-store',
    }
  )
)
