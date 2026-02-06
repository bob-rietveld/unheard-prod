/**
 * Tests for experiment-runner orchestration.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports that use them)
// ---------------------------------------------------------------------------

const mockEmit = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/api/event', () => ({
  emit: (...args: unknown[]) => mockEmit(...args),
}))

const mockWriteTextFile = vi.fn().mockResolvedValue(undefined)
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: (...args: unknown[]) => mockWriteTextFile(...args),
}))

const mockReadExperimentConfig = vi.fn()
const mockGitAutoCommit = vi.fn()
const mockUnwrapResult = vi.fn((result: unknown) => {
  const r = result as { status: string; data?: unknown; error?: unknown }
  if (r.status === 'ok') return r.data
  throw r.error
})
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    readExperimentConfig: (...args: unknown[]) => mockReadExperimentConfig(...args),
    gitAutoCommit: (...args: unknown[]) => mockGitAutoCommit(...args),
  },
  unwrapResult: (result: unknown) => mockUnwrapResult(result),
}))

const mockRunExperiment = vi.fn()
vi.mock('@/lib/modal-client', () => ({
  runExperiment: (...args: unknown[]) => mockRunExperiment(...args),
}))

const mockStartExperiment = vi.fn()
const mockFailExperiment = vi.fn()
vi.mock('@/store/experiment-store', () => ({
  useExperimentStore: {
    getState: () => ({
      startExperiment: mockStartExperiment,
      failExperiment: mockFailExperiment,
    }),
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

const mockYamlLoad = vi.fn()
vi.mock('js-yaml', () => ({
  load: (...args: unknown[]) => mockYamlLoad(...args),
}))

const mockConvexMutation = vi.fn()
vi.mock('convex/react', () => ({
  ConvexReactClient: vi.fn(),
}))

// Mock the Convex api import
vi.mock('../../../convex/_generated/api', () => ({
  api: {
    experiments: {
      createExperiment: 'experiments:createExperiment',
      updateExperimentStatus: 'experiments:updateExperimentStatus',
      completeExperiment: 'experiments:completeExperiment',
      failExperiment: 'experiments:failExperiment',
    },
    decisions: {
      updateStatus: 'decisions:updateStatus',
    },
  },
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { executeExperiment } from '../experiment-runner'
import type { ExecuteExperimentOptions } from '../experiment-runner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a valid ExperimentConfigYaml-shaped object. */
function makeConfig(overrides?: Record<string, unknown>) {
  return {
    metadata: {
      id: 'exp-2026-02-06-test',
      version: '1.0',
      created: '2026-02-06T12:00:00Z',
      template: {
        id: 'investor-pitch-evaluation',
        slug: 'investor-evaluation',
        version: '1.0',
        name: 'Investor Pitch Evaluation',
      },
      decision: {
        id: 'dec-123',
        title: 'Test Decision',
        markdownPath: 'decisions/2026-02-06-test.md',
      },
    },
    configuration: { stage: 'seed', funding_target: 2000000 },
    context: {
      files: [
        {
          path: 'context/data.csv',
          originalFilename: 'data.csv',
          fileType: 'csv',
          sizeBytes: 1024,
        },
      ],
    },
    personas: {
      generationType: 'standard',
      count: 3,
      archetypes: [
        { id: 'vc_partner', name: 'VC Partner', count: 2 },
        { id: 'angel', name: 'Angel Investor', count: 1 },
      ],
    },
    stimulus: {
      template: 'You are evaluating a startup for investment.',
    },
    execution: {
      provider: 'modal',
      model: 'qwen2.5:32b',
      temperature: 0.7,
      maxTokens: 500,
      timeout: 60,
      parallelization: true,
    },
    analysis: {
      metrics: [{ id: 'avg_sentiment', type: 'average' }],
      insights: [{ id: 'top_concerns', type: 'extraction' }],
    },
    output: {
      format: 'yaml',
      resultsPath: 'experiments/2026-02-06-test-results.json',
      gitAutoCommit: true,
      ...((overrides?.output as Record<string, unknown>) ?? {}),
    },
    ...overrides,
  }
}

const FAKE_EXPERIMENT_ID = 'exp_abc123' as string

function makeOptions(overrides?: Partial<ExecuteExperimentOptions>): ExecuteExperimentOptions {
  return {
    yamlFilename: '2026-02-06-test.yaml',
    projectPath: '/home/user/projects/test-project',
    projectId: 'proj_123' as ExecuteExperimentOptions['projectId'],
    decisionId: 'dec_456' as ExecuteExperimentOptions['decisionId'],
    convex: { mutation: mockConvexMutation } as unknown as ExecuteExperimentOptions['convex'],
    ...overrides,
  }
}

/**
 * Set up the default happy-path mocks. Individual tests override specific mocks as needed.
 */
function setupHappyPath() {
  const config = makeConfig()

  mockReadExperimentConfig.mockResolvedValue({ status: 'ok', data: 'yaml-content' })
  mockUnwrapResult.mockReturnValue('yaml-content')
  mockYamlLoad.mockReturnValue(config)
  mockConvexMutation.mockResolvedValue(FAKE_EXPERIMENT_ID)
  mockEmit.mockResolvedValue(undefined)
  mockWriteTextFile.mockResolvedValue(undefined)
  mockGitAutoCommit.mockResolvedValue({ status: 'ok', data: 'abc1234' })

  // callModal invokes the callback with a sequence of stream events then resolves
  mockRunExperiment.mockImplementation(
    async (
      _request: unknown,
      onEvent: (event: unknown) => Promise<void>
    ) => {
      await onEvent({ type: 'status', message: 'Personas generated, running experiment' })
      await onEvent({
        type: 'persona_generated',
        persona_id: 'p1',
        name: 'Alice VC',
        role: 'Investor',
        archetype_id: 'vc_partner',
        archetype_name: 'vc_partner',
      })
      await onEvent({
        type: 'response_complete',
        persona_id: 'p1',
        persona_name: 'Alice VC',
        archetype_id: 'vc_partner',
        archetype_name: 'vc_partner',
        response: 'I would invest.',
        sentiment: 0.9,
      })
      await onEvent({
        type: 'experiment_complete',
        results: [
          {
            persona_id: 'p1',
            persona_name: 'Alice VC',
            archetype_id: 'vc_partner',
            archetype_name: 'vc_partner',
            response: 'I would invest.',
            sentiment: 0.9,
          },
        ],
        metrics: { avg_sentiment: 0.9 },
      })
    }
  )

  return config
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeExperiment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // =========================================================================
  // Happy path
  // =========================================================================

  describe('happy path', () => {
    it('reads YAML config via commands.readExperimentConfig', async () => {
      setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockReadExperimentConfig).toHaveBeenCalledWith(
        opts.projectPath,
        opts.yamlFilename
      )
    })

    it('creates experiment in Convex via api.experiments.createExperiment', async () => {
      const config = setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'experiments:createExperiment',
        {
          projectId: opts.projectId,
          decisionId: opts.decisionId,
          name: config.metadata.decision.title,
          templateSlug: config.metadata.template.slug,
          configYamlPath: `experiments/${opts.yamlFilename}`,
          personaCount: config.personas.count,
        }
      )
    })

    it('calls startExperiment on experiment store', async () => {
      const config = setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockStartExperiment).toHaveBeenCalledWith(
        FAKE_EXPERIMENT_ID,
        config.personas.count
      )
    })

    it('updates decision status to running when decisionId provided', async () => {
      setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'decisions:updateStatus',
        { id: opts.decisionId, status: 'running' }
      )
    })

    it('emits experiment:status event with generating_personas', async () => {
      const config = setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockEmit).toHaveBeenCalledWith('experiment:status', {
        experimentId: FAKE_EXPERIMENT_ID,
        status: 'generating_personas',
        totalPersonas: config.personas.count,
      })
    })

    it('updates experiment status in Convex to generating_personas', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'experiments:updateExperimentStatus',
        expect.objectContaining({
          id: FAKE_EXPERIMENT_ID,
          status: 'generating_personas',
        })
      )
    })

    it('calls Modal API via runExperiment', async () => {
      const config = setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockRunExperiment).toHaveBeenCalledWith(
        {
          experiment_id: FAKE_EXPERIMENT_ID,
          personas: config.personas,
          stimulus: config.stimulus,
          execution: config.execution,
          context: config.context,
        },
        expect.any(Function)
      )
    })

    it('processes status stream events and emits running status', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      // The mock sends a status event with "running" in the message
      expect(mockEmit).toHaveBeenCalledWith('experiment:status', {
        experimentId: FAKE_EXPERIMENT_ID,
        status: 'running',
        totalPersonas: 3,
      })
    })

    it('processes response_complete events and emits persona-complete', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockEmit).toHaveBeenCalledWith('experiment:persona-complete', {
        experimentId: FAKE_EXPERIMENT_ID,
        personaId: 'p1',
        name: 'Alice VC',
        archetype: 'vc_partner',
        response: 'I would invest.',
        sentiment: 0.9,
      })
    })

    it('updates progress in Convex on response_complete', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'experiments:updateExperimentStatus',
        {
          id: FAKE_EXPERIMENT_ID,
          status: 'running',
          completedPersonas: 1,
        }
      )
    })

    it('writes results JSON to disk via writeTextFile', async () => {
      setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockWriteTextFile).toHaveBeenCalledWith(
        `${opts.projectPath}/experiments/2026-02-06-test-results.json`,
        expect.any(String)
      )

      // Verify the written JSON structure
      const writtenJson = JSON.parse(mockWriteTextFile.mock.calls[0]![1] as string) as Record<string, unknown>
      expect(writtenJson).toHaveProperty('experimentId', FAKE_EXPERIMENT_ID)
      expect(writtenJson).toHaveProperty('configPath', `experiments/${opts.yamlFilename}`)
      expect(writtenJson).toHaveProperty('completedAt')
      expect(writtenJson).toHaveProperty('executionTimeMs')
      expect(writtenJson).toHaveProperty('results')
      expect(writtenJson).toHaveProperty('metrics')
    })

    it('calls gitAutoCommit when config.output.gitAutoCommit is true', async () => {
      setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockGitAutoCommit).toHaveBeenCalledWith(
        opts.projectPath,
        ['experiments/2026-02-06-test-results.json'],
        '[unheard] Add experiment results: Test Decision'
      )
    })

    it('completes experiment in Convex', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'experiments:completeExperiment',
        expect.objectContaining({
          id: FAKE_EXPERIMENT_ID,
          results: expect.any(Array),
          insights: expect.any(Object),
          resultsJsonPath: 'experiments/2026-02-06-test-results.json',
          executionTimeMs: expect.any(Number),
        })
      )
    })

    it('updates decision status to completed', async () => {
      setupHappyPath()
      const opts = makeOptions()

      await executeExperiment(opts)

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'decisions:updateStatus',
        { id: opts.decisionId, status: 'completed' }
      )
    })

    it('emits experiment:complete event', async () => {
      setupHappyPath()

      await executeExperiment(makeOptions())

      expect(mockEmit).toHaveBeenCalledWith('experiment:complete', {
        experimentId: FAKE_EXPERIMENT_ID,
      })
    })
  })

  // =========================================================================
  // Error handling
  // =========================================================================

  describe('error handling', () => {
    it('calls failExperiment in Convex on failure', async () => {
      setupHappyPath()
      mockRunExperiment.mockRejectedValue(new Error('Modal crashed'))

      await expect(executeExperiment(makeOptions())).rejects.toThrow('Modal crashed')

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'experiments:failExperiment',
        {
          id: FAKE_EXPERIMENT_ID,
          error: 'Modal crashed',
        }
      )
    })

    it('reverts decision status to ready on failure', async () => {
      setupHappyPath()
      const opts = makeOptions()
      mockRunExperiment.mockRejectedValue(new Error('Modal crashed'))

      await expect(executeExperiment(opts)).rejects.toThrow('Modal crashed')

      expect(mockConvexMutation).toHaveBeenCalledWith(
        'decisions:updateStatus',
        { id: opts.decisionId, status: 'ready' }
      )
    })

    it('emits experiment:error event on failure', async () => {
      setupHappyPath()
      mockRunExperiment.mockRejectedValue(new Error('Modal crashed'))

      await expect(executeExperiment(makeOptions())).rejects.toThrow('Modal crashed')

      expect(mockEmit).toHaveBeenCalledWith('experiment:error', {
        experimentId: FAKE_EXPERIMENT_ID,
        error: 'Modal crashed',
      })
    })

    it('calls failExperiment on experiment store on failure', async () => {
      setupHappyPath()
      mockRunExperiment.mockRejectedValue(new Error('Modal crashed'))

      await expect(executeExperiment(makeOptions())).rejects.toThrow('Modal crashed')

      expect(mockFailExperiment).toHaveBeenCalledWith('Modal crashed')
    })

    it('re-throws the error', async () => {
      setupHappyPath()
      const error = new Error('Something broke')
      mockRunExperiment.mockRejectedValue(error)

      await expect(executeExperiment(makeOptions())).rejects.toThrow('Something broke')
    })

    it('handles Convex failExperiment failure gracefully', async () => {
      setupHappyPath()
      mockRunExperiment.mockRejectedValue(new Error('Modal crashed'))

      // Make the Convex failExperiment call throw
      let callCount = 0
      mockConvexMutation.mockImplementation(async (ref: string) => {
        // First calls succeed (createExperiment, updateStatus, updateExperimentStatus)
        // Then callModal fails, and we try failExperiment mutation
        if (ref === 'experiments:failExperiment') {
          throw new Error('Convex is down')
        }
        if (ref === 'experiments:createExperiment') {
          return FAKE_EXPERIMENT_ID
        }
        callCount++
        return undefined
      })

      // Should still throw the original error, not the Convex error
      await expect(executeExperiment(makeOptions())).rejects.toThrow('Modal crashed')

      // failExperiment on store should still be called
      expect(mockFailExperiment).toHaveBeenCalledWith('Modal crashed')
    })

    it('emits experiment:error with "unknown" when experimentId is null', async () => {
      setupHappyPath()
      // Make createExperiment throw so experimentId is never assigned
      mockConvexMutation.mockRejectedValue(new Error('Convex create failed'))

      await expect(executeExperiment(makeOptions())).rejects.toThrow('Convex create failed')

      expect(mockEmit).toHaveBeenCalledWith('experiment:error', {
        experimentId: 'unknown',
        error: 'Convex create failed',
      })
    })

    it('handles non-Error thrown values', async () => {
      setupHappyPath()
      mockRunExperiment.mockRejectedValue('string error')

      await expect(executeExperiment(makeOptions())).rejects.toBe('string error')

      expect(mockEmit).toHaveBeenCalledWith('experiment:error', {
        experimentId: FAKE_EXPERIMENT_ID,
        error: 'string error',
      })
    })
  })

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('skips decision status updates when no decisionId provided', async () => {
      setupHappyPath()
      const opts = makeOptions({ decisionId: undefined })

      await executeExperiment(opts)

      // Should NOT have called updateStatus for decisions at all
      const decisionCalls = mockConvexMutation.mock.calls.filter(
        (call: unknown[]) => call[0] === 'decisions:updateStatus'
      )
      expect(decisionCalls).toHaveLength(0)
    })

    it('skips git commit when gitAutoCommit is false', async () => {
      const config = makeConfig({ output: { format: 'yaml', resultsPath: 'experiments/results.json', gitAutoCommit: false } })
      setupHappyPath()
      mockYamlLoad.mockReturnValue(config)

      await executeExperiment(makeOptions())

      expect(mockGitAutoCommit).not.toHaveBeenCalled()
    })

    it('logs warning but does not throw when git commit fails', async () => {
      setupHappyPath()
      mockGitAutoCommit.mockResolvedValue({ status: 'error', error: 'git not found' })
      const { logger } = await import('@/lib/logger')

      await executeExperiment(makeOptions())

      // Should still complete successfully
      expect(mockEmit).toHaveBeenCalledWith('experiment:complete', {
        experimentId: FAKE_EXPERIMENT_ID,
      })
      expect(logger.warn).toHaveBeenCalledWith(
        'Git commit failed for results',
        { error: 'git not found' }
      )
    })

    it('replaces allResults with experiment_complete results', async () => {
      setupHappyPath()
      const finalResults = [
        {
          persona_id: 'p1',
          persona_name: 'Alice VC',
          archetype_id: 'vc_partner',
          archetype_name: 'vc_partner',
          response: 'Final response',
          sentiment: 0.95,
        },
        {
          persona_id: 'p2',
          persona_name: 'Bob Angel',
          archetype_id: 'angel',
          archetype_name: 'angel',
          response: 'Also good',
          sentiment: 0.85,
        },
      ]
      const finalMetrics = { avg_sentiment: 0.9, pass_rate: 0.1 }

      mockRunExperiment.mockImplementation(
        async (_request: unknown, onEvent: (event: unknown) => Promise<void>) => {
          await onEvent({
            type: 'response_complete',
            persona_id: 'p1',
            persona_name: 'Alice VC',
            archetype_id: 'vc_partner',
            archetype_name: 'vc_partner',
            response: 'Interim response',
            sentiment: 0.8,
          })
          await onEvent({
            type: 'experiment_complete',
            results: finalResults,
            metrics: finalMetrics,
          })
        }
      )

      await executeExperiment(makeOptions())

      // The completeExperiment call should use the experiment_complete results
      const completeCall = mockConvexMutation.mock.calls.find(
        (call: unknown[]) => call[0] === 'experiments:completeExperiment'
      )!
      expect(completeCall).toBeDefined()
      // The runner maps archetype_name -> archetype when processing experiment_complete
      const expectedMapped = finalResults.map(r => ({
        persona_id: r.persona_id,
        persona_name: r.persona_name,
        archetype: r.archetype_name,
        response: r.response,
        sentiment: r.sentiment,
      }))
      expect((completeCall[1] as Record<string, unknown>).results).toEqual(expectedMapped)
      expect((completeCall[1] as Record<string, unknown>).insights).toEqual(finalMetrics)
    })

    it('handles status event without "running" in message', async () => {
      setupHappyPath()
      mockRunExperiment.mockImplementation(
        async (_request: unknown, onEvent: (event: unknown) => Promise<void>) => {
          await onEvent({ type: 'status', message: 'Initializing personas' })
          await onEvent({ type: 'experiment_complete', results: [], metrics: {} })
        }
      )

      await executeExperiment(makeOptions())

      // Should NOT emit a 'running' status event from the stream handler
      const statusCalls = mockEmit.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === 'experiment:status' &&
          (call[1] as Record<string, unknown>).status === 'running'
      )
      expect(statusCalls).toHaveLength(0)
    })

    it('handles persona_generated event (logs only)', async () => {
      setupHappyPath()
      const { logger } = await import('@/lib/logger')

      mockRunExperiment.mockImplementation(
        async (_request: unknown, onEvent: (event: unknown) => Promise<void>) => {
          await onEvent({
            type: 'persona_generated',
            persona_id: 'p1',
            name: 'Alice VC',
            archetype: 'vc_partner',
          })
          await onEvent({ type: 'experiment_complete', results: [], metrics: {} })
        }
      )

      await executeExperiment(makeOptions())

      expect(logger.info).toHaveBeenCalledWith('Persona generated', {
        personaId: 'p1',
        name: 'Alice VC',
      })
    })

    it('accumulates multiple response_complete events', async () => {
      setupHappyPath()
      mockRunExperiment.mockImplementation(
        async (_request: unknown, onEvent: (event: unknown) => Promise<void>) => {
          await onEvent({
            type: 'response_complete',
            persona_id: 'p1',
            persona_name: 'Alice',
            archetype_id: 'arc-1',
            archetype_name: 'Early Adopter',
            response: 'Response 1',
            sentiment: 0.8,
          })
          await onEvent({
            type: 'response_complete',
            persona_id: 'p2',
            persona_name: 'Bob',
            archetype_id: 'arc-2',
            archetype_name: 'Skeptic',
            response: 'Response 2',
            sentiment: 0.6,
          })
          // No experiment_complete event, so allResults from response_complete is used
        }
      )

      await executeExperiment(makeOptions())

      // Check that progress was updated twice
      const progressCalls = mockConvexMutation.mock.calls.filter(
        (call: unknown[]) =>
          call[0] === 'experiments:updateExperimentStatus' &&
          (call[1] as Record<string, unknown>).completedPersonas !== undefined
      )
      expect(progressCalls).toHaveLength(2)
      expect((progressCalls[0]![1] as Record<string, unknown>).completedPersonas).toBe(1)
      expect((progressCalls[1]![1] as Record<string, unknown>).completedPersonas).toBe(2)
    })
  })
})
