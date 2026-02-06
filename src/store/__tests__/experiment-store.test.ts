import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { useExperimentStore } from '../experiment-store'
import type { PersonaResult } from '../experiment-store'

describe('ExperimentStore', () => {
  beforeEach(() => {
    useExperimentStore.getState().reset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ===== Initial State =====

  describe('initial state', () => {
    it('has idle status', () => {
      const state = useExperimentStore.getState()
      expect(state.status).toBe('idle')
    })

    it('has null currentExperimentId', () => {
      const state = useExperimentStore.getState()
      expect(state.currentExperimentId).toBeNull()
    })

    it('has zero totals and empty arrays', () => {
      const state = useExperimentStore.getState()
      expect(state.totalPersonas).toBe(0)
      expect(state.completedPersonas).toBe(0)
      expect(state.personaResults).toEqual([])
    })

    it('has null error and timestamps', () => {
      const state = useExperimentStore.getState()
      expect(state.error).toBeNull()
      expect(state.startedAt).toBeNull()
      expect(state.completedAt).toBeNull()
    })
  })

  // ===== startExperiment =====

  describe('startExperiment', () => {
    it('sets currentExperimentId and totalPersonas', () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00Z'))

      useExperimentStore.getState().startExperiment('exp-123', 10)

      const state = useExperimentStore.getState()
      expect(state.currentExperimentId).toBe('exp-123')
      expect(state.totalPersonas).toBe(10)
    })

    it('sets status to generating_personas', () => {
      useExperimentStore.getState().startExperiment('exp-123', 10)

      expect(useExperimentStore.getState().status).toBe('generating_personas')
    })

    it('resets completedPersonas to 0', () => {
      // First add some progress
      useExperimentStore.getState().startExperiment('exp-old', 5)
      useExperimentStore.getState().updateProgress(3, 5)
      expect(useExperimentStore.getState().completedPersonas).toBe(3)

      // Starting new experiment resets
      useExperimentStore.getState().startExperiment('exp-new', 8)
      expect(useExperimentStore.getState().completedPersonas).toBe(0)
    })

    it('clears personaResults', () => {
      useExperimentStore.getState().startExperiment('exp-old', 5)
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      expect(useExperimentStore.getState().personaResults).toHaveLength(1)

      useExperimentStore.getState().startExperiment('exp-new', 8)
      expect(useExperimentStore.getState().personaResults).toEqual([])
    })

    it('sets startedAt to current time', () => {
      const now = new Date('2026-01-15T10:00:00Z')
      vi.setSystemTime(now)

      useExperimentStore.getState().startExperiment('exp-123', 10)

      expect(useExperimentStore.getState().startedAt).toBe(now.getTime())
    })

    it('clears completedAt', () => {
      useExperimentStore.getState().startExperiment('exp-old', 5)
      useExperimentStore.getState().completeExperiment()
      expect(useExperimentStore.getState().completedAt).not.toBeNull()

      useExperimentStore.getState().startExperiment('exp-new', 8)
      expect(useExperimentStore.getState().completedAt).toBeNull()
    })

    it('clears error', () => {
      useExperimentStore.getState().failExperiment('something broke')
      expect(useExperimentStore.getState().error).toBe('something broke')

      useExperimentStore.getState().startExperiment('exp-retry', 5)
      expect(useExperimentStore.getState().error).toBeNull()
    })
  })

  // ===== setStatus =====

  describe('setStatus', () => {
    it('updates the status field', () => {
      useExperimentStore.getState().setStatus('running')
      expect(useExperimentStore.getState().status).toBe('running')
    })

    it('can set any valid status', () => {
      const statuses = ['idle', 'generating_personas', 'running', 'complete', 'error'] as const

      for (const status of statuses) {
        useExperimentStore.getState().setStatus(status)
        expect(useExperimentStore.getState().status).toBe(status)
      }
    })
  })

  // ===== updateProgress =====

  describe('updateProgress', () => {
    it('updates completedPersonas and totalPersonas', () => {
      useExperimentStore.getState().updateProgress(5, 20)

      const state = useExperimentStore.getState()
      expect(state.completedPersonas).toBe(5)
      expect(state.totalPersonas).toBe(20)
    })

    it('can update progress multiple times', () => {
      useExperimentStore.getState().updateProgress(1, 10)
      expect(useExperimentStore.getState().completedPersonas).toBe(1)

      useExperimentStore.getState().updateProgress(5, 10)
      expect(useExperimentStore.getState().completedPersonas).toBe(5)

      useExperimentStore.getState().updateProgress(10, 10)
      expect(useExperimentStore.getState().completedPersonas).toBe(10)
    })
  })

  // ===== addPersonaResult =====

  describe('addPersonaResult', () => {
    it('appends to personaResults array', () => {
      const result1 = makePersonaResult('p1')
      const result2 = makePersonaResult('p2')

      useExperimentStore.getState().addPersonaResult(result1)
      expect(useExperimentStore.getState().personaResults).toEqual([result1])

      useExperimentStore.getState().addPersonaResult(result2)
      expect(useExperimentStore.getState().personaResults).toEqual([result1, result2])
    })

    it('increments completedPersonas by 1', () => {
      expect(useExperimentStore.getState().completedPersonas).toBe(0)

      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      expect(useExperimentStore.getState().completedPersonas).toBe(1)

      useExperimentStore.getState().addPersonaResult(makePersonaResult('p2'))
      expect(useExperimentStore.getState().completedPersonas).toBe(2)

      useExperimentStore.getState().addPersonaResult(makePersonaResult('p3'))
      expect(useExperimentStore.getState().completedPersonas).toBe(3)
    })

    it('preserves existing results when adding new ones', () => {
      const results = Array.from({ length: 5 }, (_, i) =>
        makePersonaResult(`p${i}`)
      )

      for (const result of results) {
        useExperimentStore.getState().addPersonaResult(result)
      }

      expect(useExperimentStore.getState().personaResults).toHaveLength(5)
      expect(useExperimentStore.getState().personaResults).toEqual(results)
    })
  })

  // ===== completeExperiment =====

  describe('completeExperiment', () => {
    it('sets status to complete', () => {
      useExperimentStore.getState().startExperiment('exp-123', 5)
      useExperimentStore.getState().setStatus('running')
      useExperimentStore.getState().completeExperiment()

      expect(useExperimentStore.getState().status).toBe('complete')
    })

    it('sets completedAt to current time', () => {
      const now = new Date('2026-01-15T12:30:00Z')
      vi.setSystemTime(now)

      useExperimentStore.getState().startExperiment('exp-123', 5)
      useExperimentStore.getState().completeExperiment()

      expect(useExperimentStore.getState().completedAt).toBe(now.getTime())
    })
  })

  // ===== failExperiment =====

  describe('failExperiment', () => {
    it('sets status to error', () => {
      useExperimentStore.getState().startExperiment('exp-123', 5)
      useExperimentStore.getState().failExperiment('Network timeout')

      expect(useExperimentStore.getState().status).toBe('error')
    })

    it('sets error message', () => {
      useExperimentStore.getState().failExperiment('Modal API rate limited')

      expect(useExperimentStore.getState().error).toBe('Modal API rate limited')
    })

    it('preserves other state fields', () => {
      useExperimentStore.getState().startExperiment('exp-123', 10)
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      useExperimentStore.getState().failExperiment('something broke')

      const state = useExperimentStore.getState()
      expect(state.currentExperimentId).toBe('exp-123')
      expect(state.totalPersonas).toBe(10)
      expect(state.personaResults).toHaveLength(1)
      expect(state.completedPersonas).toBe(1)
    })
  })

  // ===== reset =====

  describe('reset', () => {
    it('returns all state to initial values', () => {
      // Dirty up the state
      useExperimentStore.getState().startExperiment('exp-123', 10)
      useExperimentStore.getState().setStatus('running')
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p2'))
      useExperimentStore.getState().failExperiment('something broke')

      // Reset
      useExperimentStore.getState().reset()

      const state = useExperimentStore.getState()
      expect(state.currentExperimentId).toBeNull()
      expect(state.status).toBe('idle')
      expect(state.totalPersonas).toBe(0)
      expect(state.completedPersonas).toBe(0)
      expect(state.personaResults).toEqual([])
      expect(state.error).toBeNull()
      expect(state.startedAt).toBeNull()
      expect(state.completedAt).toBeNull()
    })

    it('resets after a completed experiment', () => {
      useExperimentStore.getState().startExperiment('exp-123', 3)
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p2'))
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p3'))
      useExperimentStore.getState().completeExperiment()

      useExperimentStore.getState().reset()

      const state = useExperimentStore.getState()
      expect(state.status).toBe('idle')
      expect(state.completedAt).toBeNull()
      expect(state.personaResults).toEqual([])
    })
  })

  // ===== Full lifecycle =====

  describe('full experiment lifecycle', () => {
    it('runs through start -> running -> results -> complete', () => {
      const startTime = new Date('2026-01-15T10:00:00Z')
      vi.setSystemTime(startTime)

      // Start
      useExperimentStore.getState().startExperiment('exp-lifecycle', 3)
      expect(useExperimentStore.getState().status).toBe('generating_personas')
      expect(useExperimentStore.getState().startedAt).toBe(startTime.getTime())

      // Transition to running
      useExperimentStore.getState().setStatus('running')
      expect(useExperimentStore.getState().status).toBe('running')

      // Add results
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p2'))
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p3'))
      expect(useExperimentStore.getState().completedPersonas).toBe(3)
      expect(useExperimentStore.getState().personaResults).toHaveLength(3)

      // Complete
      const endTime = new Date('2026-01-15T10:05:00Z')
      vi.setSystemTime(endTime)
      useExperimentStore.getState().completeExperiment()

      const state = useExperimentStore.getState()
      expect(state.status).toBe('complete')
      expect(state.completedAt).toBe(endTime.getTime())
      expect(state.startedAt).toBe(startTime.getTime())
    })

    it('handles start -> error -> retry -> complete', () => {
      // First attempt fails
      useExperimentStore.getState().startExperiment('exp-retry', 5)
      useExperimentStore.getState().setStatus('running')
      useExperimentStore.getState().addPersonaResult(makePersonaResult('p1'))
      useExperimentStore.getState().failExperiment('API timeout')

      expect(useExperimentStore.getState().status).toBe('error')
      expect(useExperimentStore.getState().error).toBe('API timeout')

      // Retry with new experiment
      useExperimentStore.getState().startExperiment('exp-retry-2', 5)
      expect(useExperimentStore.getState().status).toBe('generating_personas')
      expect(useExperimentStore.getState().error).toBeNull()
      expect(useExperimentStore.getState().personaResults).toEqual([])

      // Succeeds this time
      useExperimentStore.getState().setStatus('running')
      for (let i = 0; i < 5; i++) {
        useExperimentStore.getState().addPersonaResult(makePersonaResult(`p${i}`))
      }
      useExperimentStore.getState().completeExperiment()

      const state = useExperimentStore.getState()
      expect(state.status).toBe('complete')
      expect(state.completedPersonas).toBe(5)
      expect(state.personaResults).toHaveLength(5)
      expect(state.error).toBeNull()
    })
  })
})

// ===== Helpers =====

function makePersonaResult(personaId: string): PersonaResult {
  return {
    personaId,
    name: `Persona ${personaId}`,
    archetype: 'early-adopter',
    response: `Response from ${personaId}`,
    sentiment: 0.75,
    completedAt: Date.now(),
  }
}
