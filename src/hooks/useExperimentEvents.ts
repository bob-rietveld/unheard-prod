import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { useExperimentStore, type PersonaResult } from '@/store/experiment-store'
import { logger } from '@/lib/logger'

interface ExperimentStatusPayload {
  experimentId: string
  status: string
  totalPersonas: number
}

interface PersonaCompletePayload {
  experimentId: string
  personaId: string
  name: string
  archetype: string
  response: string
  sentiment: number
}

interface ExperimentCompletePayload {
  experimentId: string
}

interface ExperimentErrorPayload {
  experimentId: string
  error: string
}

/**
 * Hook to listen for Tauri experiment events and update the experiment store.
 *
 * Listens to:
 * - `experiment:status` - Status phase changes
 * - `experiment:persona-complete` - Individual persona result
 * - `experiment:complete` - Experiment finished
 * - `experiment:error` - Experiment failed
 */
export function useExperimentEvents() {
  useEffect(() => {
    let isMounted = true
    const unlisteners: (() => void)[] = []

    const setup = async () => {
      const unlistenStatus = await listen<ExperimentStatusPayload>(
        'experiment:status',
        event => {
          if (!isMounted) return
          const { setStatus, updateProgress } = useExperimentStore.getState()
          const { status, totalPersonas } = event.payload

          logger.info('Experiment status update', { status, totalPersonas })

          if (status === 'running' || status === 'generating_personas') {
            setStatus(status)
          }
          if (totalPersonas > 0) {
            const { completedPersonas } = useExperimentStore.getState()
            updateProgress(completedPersonas, totalPersonas)
          }
        }
      )
      unlisteners.push(unlistenStatus)

      const unlistenPersona = await listen<PersonaCompletePayload>(
        'experiment:persona-complete',
        event => {
          if (!isMounted) return
          const { addPersonaResult } = useExperimentStore.getState()
          const { personaId, name, archetype, response, sentiment } =
            event.payload

          logger.info('Persona complete', { personaId, name, sentiment })

          const result: PersonaResult = {
            personaId,
            name,
            archetype,
            response,
            sentiment,
            completedAt: Date.now(),
          }
          addPersonaResult(result)
        }
      )
      unlisteners.push(unlistenPersona)

      const unlistenComplete = await listen<ExperimentCompletePayload>(
        'experiment:complete',
        event => {
          if (!isMounted) return
          const { completeExperiment } = useExperimentStore.getState()

          logger.info('Experiment complete', {
            experimentId: event.payload.experimentId,
          })
          completeExperiment()
        }
      )
      unlisteners.push(unlistenComplete)

      const unlistenError = await listen<ExperimentErrorPayload>(
        'experiment:error',
        event => {
          if (!isMounted) return
          const { failExperiment } = useExperimentStore.getState()

          logger.error('Experiment error', { error: event.payload.error })
          failExperiment(event.payload.error)
        }
      )
      unlisteners.push(unlistenError)
    }

    setup().catch(err => {
      logger.error('Failed to setup experiment event listeners', { error: err })
    })

    return () => {
      isMounted = false
      for (const unlisten of unlisteners) {
        unlisten()
      }
    }
  }, [])
}
