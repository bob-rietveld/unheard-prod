import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

export type AttioTab = 'companies' | 'people' | 'lists'
export type ImportStatus = 'idle' | 'importing' | 'complete' | 'error'

/**
 * Attio CRM integration store.
 *
 * Usage:
 *   // GOOD: Selector syntax
 *   const isConnected = useAttioStore(state => state.isConnected)
 *
 *   // BAD: Destructuring (banned by ast-grep)
 *   const { isConnected } = useAttioStore()
 *
 *   // GOOD: Use getState() in callbacks
 *   const handleClick = () => {
 *     const { selectedRecordIds } = useAttioStore.getState()
 *   }
 */
export interface AttioState {
  // ===== Connection =====
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null

  // ===== Browse State =====
  activeTab: AttioTab
  selectedRecordIds: string[]

  // ===== Import Progress =====
  importStatus: ImportStatus
  importProgress: { current: number; total: number }
  importError: string | null

  // ===== Actions =====
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void
  setConnectionError: (error: string | null) => void
  setActiveTab: (tab: AttioTab) => void
  toggleRecordSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  startImport: (total: number) => void
  updateImportProgress: (current: number) => void
  completeImport: () => void
  failImport: (error: string) => void
  reset: () => void
}

const initialState = {
  isConnected: false,
  isConnecting: false,
  connectionError: null,

  activeTab: 'companies' as AttioTab,
  selectedRecordIds: [] as string[],

  importStatus: 'idle' as ImportStatus,
  importProgress: { current: 0, total: 0 },
  importError: null,
}

export const useAttioStore = create<AttioState>()(
  devtools(
    (set): AttioState => ({
      ...initialState,

      // ===== Connection Actions =====

      setConnected: connected =>
        set({ isConnected: connected }, undefined, 'setConnected'),

      setConnecting: connecting =>
        set({ isConnecting: connecting }, undefined, 'setConnecting'),

      setConnectionError: error =>
        set({ connectionError: error }, undefined, 'setConnectionError'),

      // ===== Browse Actions =====

      setActiveTab: tab =>
        set({ activeTab: tab }, undefined, 'setActiveTab'),

      toggleRecordSelection: id =>
        set(
          state => ({
            selectedRecordIds: state.selectedRecordIds.includes(id)
              ? state.selectedRecordIds.filter(rid => rid !== id)
              : [...state.selectedRecordIds, id],
          }),
          undefined,
          'toggleRecordSelection'
        ),

      selectAll: ids =>
        set({ selectedRecordIds: ids }, undefined, 'selectAll'),

      clearSelection: () =>
        set({ selectedRecordIds: [] }, undefined, 'clearSelection'),

      // ===== Import Actions =====

      startImport: total =>
        set(
          {
            importStatus: 'importing',
            importProgress: { current: 0, total },
            importError: null,
          },
          undefined,
          'startImport'
        ),

      updateImportProgress: current =>
        set(
          state => ({
            importProgress: { ...state.importProgress, current },
          }),
          undefined,
          'updateImportProgress'
        ),

      completeImport: () =>
        set(
          { importStatus: 'complete', selectedRecordIds: [] },
          undefined,
          'completeImport'
        ),

      failImport: error =>
        set(
          { importStatus: 'error', importError: error },
          undefined,
          'failImport'
        ),

      reset: () => set(initialState, undefined, 'reset'),
    }),
    {
      name: 'attio-store',
    }
  )
)
