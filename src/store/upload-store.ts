import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type UploadStatus = 'parsing' | 'copying' | 'committing' | 'complete' | 'error'

export interface UploadFileState {
  originalFilename: string
  status: UploadStatus
  percent: number
  error?: string
}

interface UploadState {
  files: Record<string, UploadFileState>

  addFile: (id: string, filename: string) => void
  updateFile: (id: string, status: UploadStatus, percent: number, error?: string) => void
  removeFile: (id: string) => void
  clearCompleted: () => void
}

export const useUploadStore = create<UploadState>()(
  devtools(
    set => ({
      files: {},

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
          state => ({
            files: {
              ...state.files,
              [id]: {
                ...state.files[id]!,
                status,
                percent,
                error,
              },
            },
          }),
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
                ([_, file]) => file.status !== 'complete' && file.status !== 'error'
              )
            ),
          }),
          undefined,
          'clearCompleted'
        ),
    }),
    {
      name: 'upload-store',
    }
  )
)
