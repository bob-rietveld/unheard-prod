import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Cohort management UI store.
 *
 * Usage:
 *   // GOOD: Selector syntax
 *   const selectedCohortId = useCohortStore(state => state.selectedCohortId)
 *
 *   // BAD: Destructuring (banned by ast-grep)
 *   const { selectedCohortId } = useCohortStore()
 *
 *   // GOOD: Use getState() in callbacks
 *   const handleClick = () => {
 *     const { pendingMemberIds } = useCohortStore.getState()
 *   }
 */
export interface CohortState {
  // UI State
  selectedCohortId: string | null
  cohortDetailOpen: boolean
  createDialogOpen: boolean
  pendingMemberIds: string[] // IDs to add when creating cohort

  // Actions
  selectCohort: (id: string | null) => void
  openDetail: (id: string) => void
  closeDetail: () => void
  openCreateDialog: (memberIds?: string[]) => void
  closeCreateDialog: () => void
  setPendingMemberIds: (ids: string[]) => void
  reset: () => void
}

const initialState = {
  selectedCohortId: null as string | null,
  cohortDetailOpen: false,
  createDialogOpen: false,
  pendingMemberIds: [] as string[],
}

export const useCohortStore = create<CohortState>()(
  devtools(
    (set): CohortState => ({
      ...initialState,

      selectCohort: id =>
        set({ selectedCohortId: id }, undefined, 'selectCohort'),

      openDetail: id =>
        set(
          { selectedCohortId: id, cohortDetailOpen: true },
          undefined,
          'openDetail'
        ),

      closeDetail: () =>
        set({ cohortDetailOpen: false }, undefined, 'closeDetail'),

      openCreateDialog: (memberIds?: string[]) =>
        set(
          {
            createDialogOpen: true,
            pendingMemberIds: memberIds ?? [],
          },
          undefined,
          'openCreateDialog'
        ),

      closeCreateDialog: () =>
        set(
          { createDialogOpen: false, pendingMemberIds: [] },
          undefined,
          'closeCreateDialog'
        ),

      setPendingMemberIds: ids =>
        set({ pendingMemberIds: ids }, undefined, 'setPendingMemberIds'),

      reset: () => set(initialState, undefined, 'reset'),
    }),
    {
      name: 'cohort-store',
    }
  )
)
