import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

/**
 * Experiment execution status phases.
 */
export type ExperimentStatus =
  | 'idle'
  | 'generating_personas'
  | 'running'
  | 'complete'
  | 'error'

/**
 * A single persona's experiment result.
 */
export interface PersonaResult {
  personaId: string
  name: string
  archetype: string
  response: string
  sentiment: number
  completedAt: number
}

/**
 * The full state of the experiment store.
 *
 * Usage:
 *   // GOOD: Selector syntax
 *   const status = useExperimentStore(state => state.status)
 *
 *   // BAD: Destructuring (banned by ast-grep)
 *   const { status } = useExperimentStore()
 *
 *   // GOOD: Use getState() in callbacks
 *   const handleClick = () => {
 *     const { status } = useExperimentStore.getState()
 *   }
 */
export interface ExperimentState {
  // ===== State =====
  currentExperimentId: string | null
  status: ExperimentStatus
  totalPersonas: number
  completedPersonas: number
  personaResults: PersonaResult[]
  error: string | null
  startedAt: number | null
  completedAt: number | null

  // ===== Actions =====
  startExperiment: (experimentId: string, totalPersonas: number) => void
  setStatus: (status: ExperimentStatus) => void
  updateProgress: (completed: number, total: number) => void
  addPersonaResult: (result: PersonaResult) => void
  completeExperiment: () => void
  failExperiment: (error: string) => void
  reset: () => void
}

const initialState = {
  currentExperimentId: null,
  status: 'idle' as ExperimentStatus,
  totalPersonas: 0,
  completedPersonas: 0,
  personaResults: [],
  error: null,
  startedAt: null,
  completedAt: null,
}

export const useExperimentStore = create<ExperimentState>()(
  devtools(
    (set): ExperimentState => ({
      ...initialState,

      // ===== Actions =====

      startExperiment: (experimentId, totalPersonas) =>
        set(
          {
            currentExperimentId: experimentId,
            status: 'generating_personas',
            totalPersonas,
            completedPersonas: 0,
            personaResults: [],
            error: null,
            startedAt: Date.now(),
            completedAt: null,
          },
          undefined,
          'startExperiment'
        ),

      setStatus: status => set({ status }, undefined, 'setStatus'),

      updateProgress: (completed, total) =>
        set(
          { completedPersonas: completed, totalPersonas: total },
          undefined,
          'updateProgress'
        ),

      addPersonaResult: result =>
        set(
          state => ({
            personaResults: [...state.personaResults, result],
            completedPersonas: state.completedPersonas + 1,
          }),
          undefined,
          'addPersonaResult'
        ),

      completeExperiment: () =>
        set(
          { status: 'complete', completedAt: Date.now() },
          undefined,
          'completeExperiment'
        ),

      failExperiment: error =>
        set({ status: 'error', error }, undefined, 'failExperiment'),

      reset: () => set(initialState, undefined, 'reset'),
    }),
    {
      name: 'experiment-store',
    }
  )
)
