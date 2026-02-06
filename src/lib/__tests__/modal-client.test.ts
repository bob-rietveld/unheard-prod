/**
 * Tests for Modal experiment HTTP client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ModalExperimentRequest, ModalStreamEvent } from '../modal-client'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid ModalExperimentRequest. */
function makeRequest(
  overrides: Partial<ModalExperimentRequest> = {}
): ModalExperimentRequest {
  return {
    experiment_id: 'exp-001',
    personas: {
      generationType: 'archetype',
      count: 2,
      archetypes: [{ id: 'arc-1', name: 'Early Adopter', count: 2 }],
    },
    stimulus: { template: 'How would you evaluate {{product}}?' },
    execution: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      temperature: 0.7,
      maxTokens: 1024,
      timeout: 60,
      parallelization: true,
    },
    context: { files: [] },
    ...overrides,
  }
}

/** Encode a string as a Uint8Array chunk for ReadableStream. */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/** Create a ReadableStream that yields the given chunks sequentially. */
function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let index = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]!)
        index++
      } else {
        controller.close()
      }
    },
  })
}

/** Build a successful Response with a streaming body. */
function makeResponse(
  chunks: Uint8Array[],
  status = 200
): Response {
  return new Response(makeStream(chunks), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('modal-client', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    // Default: no env var set
    vi.stubEnv('VITE_MODAL_ENDPOINT_URL', '')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  // -------------------------------------------------------------------------
  // runExperiment - fetch call correctness
  // -------------------------------------------------------------------------

  describe('runExperiment', () => {
    it('should call fetch with correct URL, method, headers, and body', async () => {
      const statusEvent: ModalStreamEvent = {
        type: 'status',
        message: 'Starting',
      }
      fetchSpy.mockResolvedValue(
        makeResponse([encode(JSON.stringify(statusEvent) + '\n')])
      )

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()
      const request = makeRequest()

      await runExperiment(request, onEvent)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, options] = fetchSpy.mock.calls[0]!
      expect(url).toContain('/run-experiment')
      expect(options.method).toBe('POST')
      expect(options.headers).toEqual({ 'Content-Type': 'application/json' })
      expect(JSON.parse(options.body)).toEqual(request)
      expect(options.signal).toBeInstanceOf(AbortSignal)
    })

    it('should use VITE_MODAL_ENDPOINT_URL from env when set', async () => {
      vi.stubEnv('VITE_MODAL_ENDPOINT_URL', 'https://modal.example.com')

      // Re-import to pick up fresh env
      vi.resetModules()
      vi.mock('@/lib/logger', () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
        },
      }))
      const { runExperiment } = await import('../modal-client')

      fetchSpy.mockResolvedValue(
        makeResponse([
          encode(JSON.stringify({ type: 'status', message: 'ok' }) + '\n'),
        ])
      )

      await runExperiment(makeRequest(), vi.fn())

      const [url] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://modal.example.com/run-experiment')
    })

    it('should fall back to http://localhost:8000 when env var not set', async () => {
      // Remove the env var entirely so ?? picks up the fallback
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (import.meta.env as Record<string, unknown>)
        .VITE_MODAL_ENDPOINT_URL

      vi.resetModules()
      vi.mock('@/lib/logger', () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn(),
          trace: vi.fn(),
        },
      }))
      const { runExperiment } = await import('../modal-client')

      fetchSpy.mockResolvedValue(
        makeResponse([
          encode(JSON.stringify({ type: 'status', message: 'ok' }) + '\n'),
        ])
      )

      await runExperiment(makeRequest(), vi.fn())

      const [url] = fetchSpy.mock.calls[0]!
      expect(url).toBe('http://localhost:8000/run-experiment')
    })

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    it('should throw on non-OK HTTP response with status code and error text', async () => {
      const errorBody = 'Internal Server Error details'
      fetchSpy.mockResolvedValue(
        new Response(errorBody, { status: 500, statusText: 'Internal Server Error' })
      )

      const { runExperiment } = await import('../modal-client')

      await expect(runExperiment(makeRequest(), vi.fn())).rejects.toThrow(
        'Modal API error (500): Internal Server Error details'
      )
    })

    it('should throw with "Unknown error" when error text reading fails', async () => {
      const resp = {
        ok: false,
        status: 502,
        text: () => Promise.reject(new Error('read failed')),
        body: null,
      } as unknown as Response

      fetchSpy.mockResolvedValue(resp)

      const { runExperiment } = await import('../modal-client')

      await expect(runExperiment(makeRequest(), vi.fn())).rejects.toThrow(
        'Modal API error (502): Unknown error'
      )
    })

    it('should throw on missing response body', async () => {
      const resp = new Response(null, { status: 200 })
      // Force body to null
      Object.defineProperty(resp, 'body', { value: null })
      fetchSpy.mockResolvedValue(resp)

      const { runExperiment } = await import('../modal-client')

      await expect(runExperiment(makeRequest(), vi.fn())).rejects.toThrow(
        'Modal response has no body'
      )
    })

    it('should throw on timeout with descriptive message', async () => {
      vi.useFakeTimers()

      try {
        // Simulate a fetch that never resolves until abort fires
        fetchSpy.mockImplementation(
          (_url: string, options: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              options.signal?.addEventListener('abort', () => {
                const abortError = new DOMException(
                  'The operation was aborted.',
                  'AbortError'
                )
                reject(abortError)
              })
            })
        )

        const { runExperiment } = await import('../modal-client')

        // Attach catch immediately to avoid unhandled rejection
        const promise = runExperiment(makeRequest(), vi.fn()).catch(
          (e: unknown) => e
        )

        // Advance past the 5-minute timeout
        await vi.advanceTimersByTimeAsync(300_001)

        const error = await promise
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(
          'Modal experiment timed out after 300s'
        )
      } finally {
        vi.useRealTimers()
      }
    })

    it('should clear timeout on success', async () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

      fetchSpy.mockResolvedValue(
        makeResponse([
          encode(JSON.stringify({ type: 'status', message: 'done' }) + '\n'),
        ])
      )

      const { runExperiment } = await import('../modal-client')

      await runExperiment(makeRequest(), vi.fn())

      expect(clearTimeoutSpy).toHaveBeenCalled()
      clearTimeoutSpy.mockRestore()
    })

    it('should re-throw non-abort errors as-is', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))

      const { runExperiment } = await import('../modal-client')

      await expect(runExperiment(makeRequest(), vi.fn())).rejects.toThrow(
        'Failed to fetch'
      )
    })
  })

  // -------------------------------------------------------------------------
  // parseStream (tested through runExperiment)
  // -------------------------------------------------------------------------

  describe('parseStream (via runExperiment)', () => {
    it('should parse a single NDJSON line correctly', async () => {
      const event: ModalStreamEvent = {
        type: 'status',
        message: 'Initializing experiment',
      }

      fetchSpy.mockResolvedValue(
        makeResponse([encode(JSON.stringify(event) + '\n')])
      )

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith(event)
    })

    it('should parse multiple NDJSON lines', async () => {
      const events: ModalStreamEvent[] = [
        { type: 'status', message: 'Starting' },
        {
          type: 'persona_generated',
          persona_id: 'p-1',
          name: 'Alice',
          role: 'User',
          archetype_id: 'arc-1',
          archetype_name: 'Early Adopter',
        },
        {
          type: 'response_complete',
          persona_id: 'p-1',
          persona_name: 'Alice',
          archetype_id: 'arc-1',
          archetype_name: 'Early Adopter',
          response: 'Looks great!',
          sentiment: 0.8,
        },
      ]

      const ndjson = events.map((e) => JSON.stringify(e)).join('\n') + '\n'

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(3)
      expect(onEvent).toHaveBeenNthCalledWith(1, events[0])
      expect(onEvent).toHaveBeenNthCalledWith(2, events[1])
      expect(onEvent).toHaveBeenNthCalledWith(3, events[2])
    })

    it('should handle chunked data (line split across multiple reads)', async () => {
      const event: ModalStreamEvent = {
        type: 'status',
        message: 'Processing batch',
      }

      const fullLine = JSON.stringify(event)
      // Split the JSON line in the middle
      const midpoint = Math.floor(fullLine.length / 2)
      const chunk1 = fullLine.slice(0, midpoint)
      const chunk2 = fullLine.slice(midpoint) + '\n'

      fetchSpy.mockResolvedValue(
        makeResponse([encode(chunk1), encode(chunk2)])
      )

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith(event)
    })

    it('should handle empty lines between events', async () => {
      const event1: ModalStreamEvent = { type: 'status', message: 'first' }
      const event2: ModalStreamEvent = { type: 'status', message: 'second' }

      const ndjson =
        JSON.stringify(event1) + '\n\n\n' + JSON.stringify(event2) + '\n'

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(2)
      expect(onEvent).toHaveBeenNthCalledWith(1, event1)
      expect(onEvent).toHaveBeenNthCalledWith(2, event2)
    })

    it('should call onEvent for each parsed event', async () => {
      const events: ModalStreamEvent[] = [
        { type: 'status', message: 'Starting' },
        {
          type: 'persona_generated',
          persona_id: 'p-1',
          name: 'Bob',
          role: 'User',
          archetype_id: 'arc-1',
          archetype_name: 'Skeptic',
        },
        {
          type: 'response_complete',
          persona_id: 'p-1',
          persona_name: 'Bob',
          archetype_id: 'arc-1',
          archetype_name: 'Skeptic',
          response: 'Not sure about this.',
          sentiment: -0.3,
        },
        {
          type: 'experiment_complete',
          results: [
            {
              persona_id: 'p-1',
              persona_name: 'Bob',
              archetype_id: 'arc-1',
              archetype_name: 'Skeptic',
              response: 'Not sure about this.',
              sentiment: -0.3,
            },
          ],
          metrics: { avgSentiment: -0.3 },
        },
      ]

      const ndjson = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(4)
      for (let i = 0; i < events.length; i++) {
        expect(onEvent).toHaveBeenNthCalledWith(i + 1, events[i])
      }
    })

    it('should handle all 4 event types: status, persona_generated, response_complete, experiment_complete', async () => {
      const statusEvent: ModalStreamEvent = {
        type: 'status',
        message: 'Generating personas',
      }
      const personaEvent: ModalStreamEvent = {
        type: 'persona_generated',
        persona_id: 'p-2',
        name: 'Carol',
        role: 'User',
        archetype_id: 'arc-2',
        archetype_name: 'Power User',
      }
      const responseEvent: ModalStreamEvent = {
        type: 'response_complete',
        persona_id: 'p-2',
        persona_name: 'Carol',
        archetype_id: 'arc-2',
        archetype_name: 'Power User',
        response: 'I love it!',
        sentiment: 0.95,
      }
      const completeEvent: ModalStreamEvent = {
        type: 'experiment_complete',
        results: [
          {
            persona_id: 'p-2',
            persona_name: 'Carol',
            archetype_id: 'arc-2',
            archetype_name: 'Power User',
            response: 'I love it!',
            sentiment: 0.95,
          },
        ],
        metrics: { totalResponses: 1 },
      }

      const ndjson = [statusEvent, personaEvent, responseEvent, completeEvent]
        .map((e) => JSON.stringify(e))
        .join('\n') + '\n'

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(4)
      expect(onEvent.mock.calls[0]![0]).toHaveProperty('type', 'status')
      expect(onEvent.mock.calls[1]![0]).toHaveProperty('type', 'persona_generated')
      expect(onEvent.mock.calls[2]![0]).toHaveProperty('type', 'response_complete')
      expect(onEvent.mock.calls[3]![0]).toHaveProperty('type', 'experiment_complete')
    })

    it('should log warning for malformed JSON lines without throwing', async () => {
      const { logger } = await import('@/lib/logger')
      const validEvent: ModalStreamEvent = {
        type: 'status',
        message: 'ok',
      }

      const ndjson =
        'this is not json\n' + JSON.stringify(validEvent) + '\n'

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      // Should NOT throw
      await runExperiment(makeRequest(), onEvent)

      // Only the valid event should be emitted
      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith(validEvent)

      // Logger should have been called for the malformed line
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to parse Modal stream line',
        expect.objectContaining({ line: 'this is not json' })
      )
    })

    it('should handle remaining buffer content after stream ends', async () => {
      const event: ModalStreamEvent = {
        type: 'status',
        message: 'final event',
      }

      // No trailing newline - data left in buffer when stream closes
      const ndjson = JSON.stringify(event)

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(1)
      expect(onEvent).toHaveBeenCalledWith(event)
    })

    it('should handle remaining buffer with malformed JSON after stream ends', async () => {
      const { logger } = await import('@/lib/logger')

      // Incomplete JSON left in buffer when stream closes
      const ndjson = '{"type":"status","mess'

      fetchSpy.mockResolvedValue(makeResponse([encode(ndjson)]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      // Should NOT throw
      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalledWith(
        'Failed to parse final Modal stream line',
        expect.objectContaining({ line: '{"type":"status","mess' })
      )
    })

    it('should handle multiple chunks building up multiple events', async () => {
      const event1: ModalStreamEvent = { type: 'status', message: 'chunk1' }
      const event2: ModalStreamEvent = { type: 'status', message: 'chunk2' }
      const event3: ModalStreamEvent = { type: 'status', message: 'chunk3' }

      // Distribute events across 3 chunks with splits in awkward places
      const line1 = JSON.stringify(event1) + '\n'
      const line2 = JSON.stringify(event2) + '\n'
      const line3 = JSON.stringify(event3) + '\n'

      // Chunk 1: all of event1 + start of event2
      const chunk1 = line1 + line2.slice(0, 10)
      // Chunk 2: rest of event2 + start of event3
      const chunk2 = line2.slice(10) + line3.slice(0, 5)
      // Chunk 3: rest of event3
      const chunk3 = line3.slice(5)

      fetchSpy.mockResolvedValue(
        makeResponse([encode(chunk1), encode(chunk2), encode(chunk3)])
      )

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).toHaveBeenCalledTimes(3)
      expect(onEvent).toHaveBeenNthCalledWith(1, event1)
      expect(onEvent).toHaveBeenNthCalledWith(2, event2)
      expect(onEvent).toHaveBeenNthCalledWith(3, event3)
    })

    it('should handle empty stream body', async () => {
      fetchSpy.mockResolvedValue(makeResponse([]))

      const { runExperiment } = await import('../modal-client')
      const onEvent = vi.fn()

      await runExperiment(makeRequest(), onEvent)

      expect(onEvent).not.toHaveBeenCalled()
    })
  })
})
