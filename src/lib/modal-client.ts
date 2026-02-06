/**
 * HTTP client for calling the Modal experiment execution endpoint.
 *
 * Sends experiment config and parses streaming newline-delimited JSON responses.
 */

import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Modal API request body. */
export interface ModalExperimentRequest {
  experiment_id: string
  personas: {
    generationType: string
    count: number
    archetypes?: {
      id: string
      name: string
      count: number
    }[]
    cohortId?: string
    cohortName?: string
    members?: { id: string; name: string; type: string; attributes: Record<string, unknown> }[]
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
  context: {
    files: {
      path: string
      originalFilename: string
      fileType: string
      sizeBytes: number
    }[]
  }
}

/** Streaming event types from Modal. */
export type ModalStreamEvent =
  | { type: 'status'; message: string }
  | {
      type: 'persona_generated'
      persona_id: string
      name: string
      role: string
      archetype_id: string
      archetype_name: string
    }
  | {
      type: 'response_complete'
      persona_id: string
      persona_name: string
      archetype_id: string
      archetype_name: string
      response: string
      sentiment: number
      tokens?: { input: number; output: number }
      error?: string
    }
  | {
      type: 'experiment_complete'
      results: {
        persona_id: string
        persona_name: string
        archetype_id: string
        archetype_name: string
        response: string
        sentiment: number
        tokens?: { input: number; output: number }
        error?: string
      }[]
      metrics: Record<string, unknown>
    }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODAL_TIMEOUT_MS = 300_000 // 5 minutes for full experiment

function getModalEndpointUrl(): string {
  return (
    import.meta.env.VITE_MODAL_ENDPOINT_URL ??
    'http://localhost:8000'
  )
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Run an experiment on Modal, streaming events as they arrive.
 *
 * @param request - Experiment configuration for Modal
 * @param onEvent - Callback for each streaming event
 * @throws On network errors, HTTP errors, or timeout
 */
export async function runExperiment(
  request: ModalExperimentRequest,
  onEvent: (event: ModalStreamEvent) => void
): Promise<void> {
  const url = `${getModalEndpointUrl()}/run-experiment`

  logger.info('Starting Modal experiment', {
    experimentId: request.experiment_id,
    url,
    personaCount: request.personas.count,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), MODAL_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(
        `Modal API error (${response.status}): ${errorText}`
      )
    }

    if (!response.body) {
      throw new Error('Modal response has no body')
    }

    await parseStream(response.body, onEvent)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        `Modal experiment timed out after ${MODAL_TIMEOUT_MS / 1000}s`
      )
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Parse a newline-delimited JSON stream from Modal.
 */
async function parseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: ModalStreamEvent) => void
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length === 0) continue

        try {
          const event = JSON.parse(trimmed) as ModalStreamEvent
          onEvent(event)
        } catch (parseError) {
          logger.warn('Failed to parse Modal stream line', {
            line: trimmed,
            error: String(parseError),
          })
        }
      }
    }

    // Process any remaining buffer content
    const remaining = buffer.trim()
    if (remaining.length > 0) {
      try {
        const event = JSON.parse(remaining) as ModalStreamEvent
        onEvent(event)
      } catch (parseError) {
        logger.warn('Failed to parse final Modal stream line', {
          line: remaining,
          error: String(parseError),
        })
      }
    }
  } finally {
    reader.releaseLock()
  }
}
