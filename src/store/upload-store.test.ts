import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Id } from '../../convex/_generated/dataModel'
import type { ContextFileRecord } from '@/lib/bindings'

// Define types inline to avoid persist middleware issues in tests
type UploadStatus =
  | 'parsing'
  | 'copying'
  | 'committing'
  | 'syncing'
  | 'complete'
  | 'error'
  | 'unsynced'

interface UploadFileState {
  originalFilename: string
  status: UploadStatus
  percent: number
  error?: string
}

interface RetryQueueItem {
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

// Create test store without persist middleware to avoid localStorage issues
function createTestUploadStore() {
  return create<UploadState>()(
    devtools(
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
                    file.status !== 'complete' &&
                    file.status !== 'error' &&
                    file.status !== 'unsynced'
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
        name: 'upload-store-test',
      }
    )
  )
}

describe('upload store - retry queue', () => {
  let useUploadStore: ReturnType<typeof createTestUploadStore>
  const mockProjectId = 'test-project-id' as Id<'projects'>

  const createMockRecord = (filename: string): ContextFileRecord => ({
    originalFilename: filename,
    storedFilename: filename,
    fileType: 'csv',
    detectedType: null,
    rows: null,
    columns: null,
    preview: null,
    pages: null,
    textPreview: null,
    sizeBytes: 1024,
    relativeFilePath: `context/${filename}`,
    isLfs: false,
  })

  beforeEach(() => {
    useUploadStore = createTestUploadStore()
  })

  it('adds item to retry queue', () => {
    useUploadStore.getState().addToRetryQueue({
      id: '/path/to/test.csv',
      projectId: mockProjectId,
      record: createMockRecord('test.csv'),
      uploadedAt: Date.now(),
    })

    const { retryQueue } = useUploadStore.getState()
    expect(retryQueue.length).toBe(1)
    expect(retryQueue[0]?.id).toBe('/path/to/test.csv')
    expect(retryQueue[0]?.attempts).toBe(0)
  })

  it('removes item from retry queue', () => {
    useUploadStore.getState().addToRetryQueue({
      id: '/path/to/test.csv',
      projectId: mockProjectId,
      record: createMockRecord('test.csv'),
      uploadedAt: Date.now(),
    })

    expect(useUploadStore.getState().retryQueue.length).toBe(1)

    useUploadStore.getState().removeFromRetryQueue('/path/to/test.csv')

    expect(useUploadStore.getState().retryQueue.length).toBe(0)
  })

  it('updates retry attempt count', () => {
    useUploadStore.getState().addToRetryQueue({
      id: '/path/to/test.csv',
      projectId: mockProjectId,
      record: createMockRecord('test.csv'),
      uploadedAt: Date.now(),
    })

    expect(useUploadStore.getState().retryQueue[0]?.attempts).toBe(0)

    useUploadStore.getState().updateRetryAttempt('/path/to/test.csv')

    expect(useUploadStore.getState().retryQueue[0]?.attempts).toBe(1)
  })

  it('tracks multiple items in retry queue', () => {
    useUploadStore.getState().addToRetryQueue({
      id: '/path/to/test1.csv',
      projectId: mockProjectId,
      record: createMockRecord('test1.csv'),
      uploadedAt: Date.now(),
    })

    useUploadStore.getState().addToRetryQueue({
      id: '/path/to/test2.csv',
      projectId: mockProjectId,
      record: createMockRecord('test2.csv'),
      uploadedAt: Date.now(),
    })

    expect(useUploadStore.getState().retryQueue.length).toBe(2)
  })
})

describe('upload store - file status', () => {
  let useUploadStore: ReturnType<typeof createTestUploadStore>

  beforeEach(() => {
    useUploadStore = createTestUploadStore()
  })

  it('adds file with parsing status', () => {
    useUploadStore.getState().addFile('/path/to/test.csv', 'test.csv')

    const { files } = useUploadStore.getState()
    expect(files['/path/to/test.csv']).toBeDefined()
    expect(files['/path/to/test.csv']?.originalFilename).toBe('test.csv')
    expect(files['/path/to/test.csv']?.status).toBe('parsing')
    expect(files['/path/to/test.csv']?.percent).toBe(0)
  })

  it('updates file status and percent', () => {
    useUploadStore.getState().addFile('/path/to/test.csv', 'test.csv')
    useUploadStore.getState().updateFile('/path/to/test.csv', 'copying', 50)

    const file = useUploadStore.getState().files['/path/to/test.csv']
    expect(file?.status).toBe('copying')
    expect(file?.percent).toBe(50)
  })

  it('updates file with error status and message', () => {
    useUploadStore.getState().addFile('/path/to/test.csv', 'test.csv')
    useUploadStore
      .getState()
      .updateFile('/path/to/test.csv', 'error', 0, 'Parse failed')

    const file = useUploadStore.getState().files['/path/to/test.csv']
    expect(file?.status).toBe('error')
    expect(file?.error).toBe('Parse failed')
  })

  it('updates file to unsynced status', () => {
    useUploadStore.getState().addFile('/path/to/test.csv', 'test.csv')
    useUploadStore
      .getState()
      .updateFile(
        '/path/to/test.csv',
        'unsynced',
        100,
        'Failed to sync to cloud'
      )

    const file = useUploadStore.getState().files['/path/to/test.csv']
    expect(file?.status).toBe('unsynced')
    expect(file?.error).toBe('Failed to sync to cloud')
  })

  it('removes file from store', () => {
    useUploadStore.getState().addFile('/path/to/test.csv', 'test.csv')
    expect(useUploadStore.getState().files['/path/to/test.csv']).toBeDefined()

    useUploadStore.getState().removeFile('/path/to/test.csv')
    expect(useUploadStore.getState().files['/path/to/test.csv']).toBeUndefined()
  })

  it('clears completed and error files', () => {
    useUploadStore.getState().addFile('/path/to/test1.csv', 'test1.csv')
    useUploadStore.getState().updateFile('/path/to/test1.csv', 'complete', 100)

    useUploadStore.getState().addFile('/path/to/test2.csv', 'test2.csv')
    useUploadStore.getState().updateFile('/path/to/test2.csv', 'error', 0)

    useUploadStore.getState().addFile('/path/to/test3.csv', 'test3.csv')
    useUploadStore.getState().updateFile('/path/to/test3.csv', 'copying', 50)

    useUploadStore.getState().addFile('/path/to/test4.csv', 'test4.csv')
    useUploadStore.getState().updateFile('/path/to/test4.csv', 'unsynced', 100)

    expect(Object.keys(useUploadStore.getState().files).length).toBe(4)

    useUploadStore.getState().clearCompleted()

    const { files } = useUploadStore.getState()
    expect(Object.keys(files).length).toBe(1)
    expect(files['/path/to/test3.csv']).toBeDefined()
  })

  it('tracks all status types', () => {
    const statuses: UploadStatus[] = [
      'parsing',
      'copying',
      'committing',
      'syncing',
      'complete',
      'error',
      'unsynced',
    ]

    statuses.forEach((status, index) => {
      const id = `/path/to/test${index}.csv`
      useUploadStore.getState().addFile(id, `test${index}.csv`)
      useUploadStore.getState().updateFile(id, status, 100)

      const file = useUploadStore.getState().files[id]
      expect(file?.status).toBe(status)
    })
  })
})
