/**
 * Experiment orchestration: reads YAML config, creates Convex record,
 * calls Modal, streams updates, writes results, and git-commits.
 */

import { emit } from '@tauri-apps/api/event'
import { load } from 'js-yaml'
import { commands, unwrapResult } from '@/lib/tauri-bindings'
import {
  runExperiment as callModal,
  type ModalExperimentRequest,
  type ModalStreamEvent,
} from '@/lib/modal-client'
import { useExperimentStore } from '@/store/experiment-store'
import { logger } from '@/lib/logger'
import type { ConvexReactClient } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed experiment config YAML structure. */
interface ExperimentConfigYaml {
  metadata: {
    id: string
    version: string
    created: string
    template: {
      id: string
      slug: string
      version: string
      name: string
    }
    decision: {
      id: string
      title: string
      markdownPath: string
    }
  }
  configuration: Record<string, unknown>
  context: {
    files: {
      path: string
      originalFilename: string
      fileType: string
      sizeBytes: number
    }[]
  }
  personas: {
    generationType: string
    count: number
    archetypes: {
      id: string
      name: string
      count: number
    }[]
  }
  stimulus: {
    template: string
  }
  execution: {
    provider: string
    model: string
    temperature: number
    maxTokens: number
    timeout: number
    parallelization: boolean
  }
  analysis: {
    metrics: Record<string, unknown>[]
    insights: Record<string, unknown>[]
  }
  output: {
    format: string
    resultsPath: string
    gitAutoCommit: boolean
  }
}

export interface ExecuteExperimentOptions {
  /** Full YAML filename (e.g., "2026-02-06-seed-fundraising.yaml") */
  yamlFilename: string
  /** Absolute path to the project root (Git repo) */
  projectPath: string
  /** Convex project ID */
  projectId: Id<'projects'>
  /** Optional Convex decision ID to link */
  decisionId?: Id<'decisions'>
  /** Convex client for mutations */
  convex: ConvexReactClient
}

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

/**
 * Execute an experiment end-to-end:
 * 1. Read experiment YAML from disk
 * 2. Create experiment record in Convex
 * 3. Update decision status to 'running'
 * 4. Call Modal API and stream updates
 * 5. Write results JSON to disk
 * 6. Git auto-commit results
 * 7. Complete experiment in Convex
 */
export async function executeExperiment(
  options: ExecuteExperimentOptions
): Promise<void> {
  const { yamlFilename, projectPath, projectId, decisionId, convex } = options

  const { startExperiment } = useExperimentStore.getState()

  let experimentId: Id<'experiments'> | null = null
  const startTime = Date.now()

  try {
    // 1. Read experiment config YAML from disk
    logger.info('Reading experiment config', { yamlFilename })
    const yamlContent = unwrapResult(
      await commands.readExperimentConfig(projectPath, yamlFilename)
    )
    const config = load(yamlContent) as ExperimentConfigYaml

    // 2. Create experiment record in Convex
    logger.info('Creating experiment record in Convex')
    experimentId = await convex.mutation(api.experiments.createExperiment, {
      projectId,
      decisionId,
      name: config.metadata.decision.title,
      templateSlug: config.metadata.template.slug,
      configYamlPath: `experiments/${yamlFilename}`,
      personaCount: config.personas.count,
    })

    // Update local store
    startExperiment(experimentId, config.personas.count)

    // 3. Update decision status to 'running'
    if (decisionId) {
      await convex.mutation(api.decisions.updateStatus, {
        id: decisionId,
        status: 'running',
      })
    }

    // Emit status event
    await emit('experiment:status', {
      experimentId,
      status: 'generating_personas',
      totalPersonas: config.personas.count,
    })

    // Update Convex status
    await convex.mutation(api.experiments.updateExperimentStatus, {
      id: experimentId,
      status: 'generating_personas',
      startedAt: startTime,
    })

    // 4. Build Modal request and call it
    const modalRequest: ModalExperimentRequest = {
      experiment_id: experimentId,
      personas: config.personas,
      stimulus: config.stimulus,
      execution: config.execution,
      context: config.context,
    }

    let completedCount = 0
    const allResults: {
      persona_id: string
      persona_name: string
      archetype: string
      response: string
      sentiment: number
    }[] = []
    let finalMetrics: Record<string, unknown> = {}

    await callModal(modalRequest, async (event: ModalStreamEvent) => {
      switch (event.type) {
        case 'status':
          logger.info('Modal status', { message: event.message })
          if (event.message.includes('running')) {
            await emit('experiment:status', {
              experimentId,
              status: 'running',
              totalPersonas: config.personas.count,
            })
            if (experimentId) {
              await convex.mutation(
                api.experiments.updateExperimentStatus,
                {
                  id: experimentId,
                  status: 'running',
                }
              )
            }
          }
          break

        case 'persona_generated':
          logger.info('Persona generated', {
            personaId: event.persona_id,
            name: event.name,
          })
          break

        case 'response_complete': {
          completedCount++
          allResults.push({
            persona_id: event.persona_id,
            persona_name: event.persona_name,
            archetype: event.archetype_name,
            response: event.response,
            sentiment: event.sentiment,
          })

          // Emit persona-complete event for the UI
          await emit('experiment:persona-complete', {
            experimentId,
            personaId: event.persona_id,
            name: event.persona_name,
            archetype: event.archetype_name,
            response: event.response,
            sentiment: event.sentiment,
          })

          // Update progress in Convex
          if (experimentId) {
            await convex.mutation(
              api.experiments.updateExperimentStatus,
              {
                id: experimentId,
                status: 'running',
                completedPersonas: completedCount,
              }
            )
          }
          break
        }

        case 'experiment_complete':
          allResults.length = 0
          allResults.push(
            ...event.results.map(r => ({
              persona_id: r.persona_id,
              persona_name: r.persona_name,
              archetype: r.archetype_name,
              response: r.response,
              sentiment: r.sentiment,
            }))
          )
          finalMetrics = event.metrics
          break
      }
    })

    // 5. Write results JSON to disk
    const resultsPath = config.output.resultsPath
    const resultsFilename = resultsPath.replace('experiments/', '')
    const resultsData = {
      experimentId,
      configPath: `experiments/${yamlFilename}`,
      completedAt: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      results: allResults,
      metrics: finalMetrics,
    }

    // Write results file via Tauri FS plugin (JSON, not YAML)
    const resultsJson = JSON.stringify(resultsData, null, 2)
    const resultsFullPath = `${projectPath}/experiments/${resultsFilename}`
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(resultsFullPath, resultsJson)

    logger.info('Results written to disk', { resultsPath })

    // 6. Git auto-commit results if configured
    if (config.output.gitAutoCommit) {
      const commitResult = await commands.gitAutoCommit(
        projectPath,
        [resultsPath],
        `[unheard] Add experiment results: ${config.metadata.decision.title}`
      )
      if (commitResult.status === 'ok') {
        logger.info('Results committed to Git', {
          commitHash: commitResult.data,
        })
      } else {
        logger.warn('Git commit failed for results', {
          error: commitResult.error,
        })
      }
    }

    // 7. Complete experiment in Convex
    if (experimentId) {
      await convex.mutation(api.experiments.completeExperiment, {
        id: experimentId,
        results: allResults,
        insights: finalMetrics,
        resultsJsonPath: resultsPath,
        executionTimeMs: Date.now() - startTime,
      })
    }

    // Update decision status to 'completed'
    if (decisionId) {
      await convex.mutation(api.decisions.updateStatus, {
        id: decisionId,
        status: 'completed',
      })
    }

    // Emit completion event
    await emit('experiment:complete', { experimentId })

    logger.info('Experiment completed successfully', {
      experimentId,
      executionTimeMs: Date.now() - startTime,
      resultCount: allResults.length,
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)

    logger.error('Experiment execution failed', { error: errorMessage })

    // Update Convex with failure
    if (experimentId) {
      try {
        await convex.mutation(api.experiments.failExperiment, {
          id: experimentId,
          error: errorMessage,
        })
      } catch (convexError) {
        logger.error('Failed to record experiment failure in Convex', {
          error: String(convexError),
        })
      }
    }

    // Update decision status back if possible
    if (decisionId) {
      try {
        await convex.mutation(api.decisions.updateStatus, {
          id: decisionId,
          status: 'ready',
        })
      } catch {
        // Best effort
      }
    }

    // Emit error event
    await emit('experiment:error', {
      experimentId: experimentId ?? 'unknown',
      error: errorMessage,
    })

    // Update local store
    const { failExperiment } = useExperimentStore.getState()
    failExperiment(errorMessage)

    throw error
  }
}
