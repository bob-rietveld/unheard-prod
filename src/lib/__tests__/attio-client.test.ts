/**
 * Tests for Attio CRM API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  testConnection,
  fetchCompanies,
  fetchPeople,
  fetchLists,
  fetchListEntries,
  fetchAllRecords,
  buildNameFilter,
  getRecordName,
  getRecordDomain,
  getRecordEmail,
  AttioApiError,
} from '../attio-client'
import type { AttioRecord, AttioList, AttioListEntry } from '../attio-client'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_API_KEY = 'test-api-key-123'

function makeRecord(overrides: Partial<AttioRecord> = {}): AttioRecord {
  return {
    id: {
      record_id: 'rec-1',
      object_id: 'obj-companies',
      workspace_id: 'ws-1',
    },
    created_at: '2026-01-15T10:00:00Z',
    web_url: 'https://app.attio.com/record/rec-1',
    values: {},
    ...overrides,
  }
}

function makeList(overrides: Partial<AttioList> = {}): AttioList {
  return {
    id: { list_id: 'list-1', workspace_id: 'ws-1' },
    api_slug: 'target-companies',
    name: 'Target Companies',
    parent_object: ['companies'],
    created_at: '2026-01-10T08:00:00Z',
    ...overrides,
  }
}

function makeListEntry(overrides: Partial<AttioListEntry> = {}): AttioListEntry {
  return {
    id: { entry_id: 'entry-1', list_id: 'list-1' },
    parent_record_id: 'rec-1',
    parent_object: 'companies',
    created_at: '2026-01-20T12:00:00Z',
    entry_values: {},
    ...overrides,
  }
}

function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })
}

function textResponse(text: string, status: number, headers?: Record<string, string>): Response {
  return new Response(text, {
    status,
    statusText: 'Error',
    headers: headers,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('attio-client', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // -------------------------------------------------------------------------
  // testConnection
  // -------------------------------------------------------------------------

  describe('testConnection', () => {
    it('should return true when API key is valid', async () => {
      fetchSpy.mockResolvedValue(
        jsonResponse({ data: { workspace: { name: 'My Workspace' } } })
      )

      const result = await testConnection(TEST_API_KEY)

      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://api.attio.com/v2/self')
      expect(opts.headers.Authorization).toBe(`Bearer ${TEST_API_KEY}`)
    })

    it('should return false when API key is invalid', async () => {
      fetchSpy.mockResolvedValue(
        textResponse('Unauthorized', 401)
      )

      const result = await testConnection('bad-key')

      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'))

      const result = await testConnection(TEST_API_KEY)

      expect(result).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // fetchCompanies
  // -------------------------------------------------------------------------

  describe('fetchCompanies', () => {
    it('should POST to companies query endpoint and return parsed data', async () => {
      const companies = [makeRecord(), makeRecord({ id: { ...makeRecord().id, record_id: 'rec-2' } })]
      fetchSpy.mockResolvedValue(jsonResponse({ data: companies }))

      const result = await fetchCompanies(TEST_API_KEY)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://api.attio.com/v2/objects/companies/records/query')
      expect(opts.method).toBe('POST')
      expect(result.data).toHaveLength(2)
      expect(result.data[0]!.id.record_id).toBe('rec-1')
    })

    it('should pass limit, offset, and filter in request body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ data: [] }))

      await fetchCompanies(TEST_API_KEY, {
        limit: 10,
        offset: 20,
        filter: { name: 'Acme' },
      })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string)
      expect(body.limit).toBe(10)
      expect(body.offset).toBe(20)
      expect(body.filter).toEqual({ name: 'Acme' })
    })

    it('should set hasMore=true when data length equals limit', async () => {
      const companies = Array.from({ length: 10 }, (_, i) =>
        makeRecord({ id: { ...makeRecord().id, record_id: `rec-${i}` } })
      )
      fetchSpy.mockResolvedValue(jsonResponse({ data: companies }))

      const result = await fetchCompanies(TEST_API_KEY, { limit: 10 })

      expect(result.hasMore).toBe(true)
      expect(result.nextOffset).toBe(10)
    })

    it('should set hasMore=false when data length is less than limit', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ data: [makeRecord()] }))

      const result = await fetchCompanies(TEST_API_KEY, { limit: 10 })

      expect(result.hasMore).toBe(false)
      expect(result.nextOffset).toBe(1)
    })

    it('should throw AttioApiError on non-OK response', async () => {
      fetchSpy.mockResolvedValue(textResponse('Forbidden', 403))

      await expect(fetchCompanies(TEST_API_KEY)).rejects.toThrow(AttioApiError)
      await expect(fetchCompanies(TEST_API_KEY)).rejects.toThrow(
        'Attio API error (403)'
      )
    })
  })

  // -------------------------------------------------------------------------
  // fetchPeople
  // -------------------------------------------------------------------------

  describe('fetchPeople', () => {
    it('should POST to people query endpoint and return parsed data', async () => {
      const people = [makeRecord({ id: { ...makeRecord().id, object_id: 'obj-people' } })]
      fetchSpy.mockResolvedValue(jsonResponse({ data: people }))

      const result = await fetchPeople(TEST_API_KEY)

      const [url] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://api.attio.com/v2/objects/people/records/query')
      expect(result.data).toHaveLength(1)
    })

    it('should pass query options to the request body', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ data: [] }))

      await fetchPeople(TEST_API_KEY, { limit: 5, offset: 10 })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string)
      expect(body.limit).toBe(5)
      expect(body.offset).toBe(10)
    })
  })

  // -------------------------------------------------------------------------
  // fetchLists
  // -------------------------------------------------------------------------

  describe('fetchLists', () => {
    it('should GET lists and return parsed data', async () => {
      const lists = [makeList(), makeList({ api_slug: 'investors', name: 'Investors' })]
      fetchSpy.mockResolvedValue(jsonResponse({ data: lists }))

      const result = await fetchLists(TEST_API_KEY)

      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://api.attio.com/v2/lists')
      expect(opts.method).toBeUndefined() // GET is default
      expect(result).toHaveLength(2)
      expect(result[0]!.api_slug).toBe('target-companies')
      expect(result[1]!.name).toBe('Investors')
    })
  })

  // -------------------------------------------------------------------------
  // fetchListEntries
  // -------------------------------------------------------------------------

  describe('fetchListEntries', () => {
    it('should POST to list entries query endpoint', async () => {
      const entries = [makeListEntry()]
      fetchSpy.mockResolvedValue(jsonResponse({ data: entries }))

      const result = await fetchListEntries(TEST_API_KEY, 'target-companies')

      const [url, opts] = fetchSpy.mock.calls[0]!
      expect(url).toBe('https://api.attio.com/v2/lists/target-companies/entries/query')
      expect(opts.method).toBe('POST')
      expect(result.data).toHaveLength(1)
      expect(result.data[0]!.id.entry_id).toBe('entry-1')
    })

    it('should handle pagination with hasMore and nextOffset', async () => {
      const entries = Array.from({ length: 25 }, (_, i) =>
        makeListEntry({ id: { entry_id: `entry-${i}`, list_id: 'list-1' } })
      )
      fetchSpy.mockResolvedValue(jsonResponse({ data: entries }))

      const result = await fetchListEntries(TEST_API_KEY, 'my-list', {
        limit: 25,
        offset: 50,
      })

      expect(result.hasMore).toBe(true)
      expect(result.nextOffset).toBe(75)
    })

    it('should set hasMore=false when fewer entries than limit', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ data: [makeListEntry()] }))

      const result = await fetchListEntries(TEST_API_KEY, 'my-list', { limit: 25 })

      expect(result.hasMore).toBe(false)
      expect(result.nextOffset).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  // Rate limit handling (429)
  // -------------------------------------------------------------------------

  describe('rate limit handling', () => {
    it('should retry once after 429 with Retry-After header', async () => {
      vi.useFakeTimers()

      const rateLimitResponse = textResponse('Rate limited', 429, {
        'Retry-After': '2',
      })
      const successResponse = jsonResponse({ data: { workspace: { name: 'Test' } } })

      fetchSpy
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse)

      const promise = testConnection(TEST_API_KEY)

      // Advance past the 2-second retry delay
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise

      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should default to 1 second wait when Retry-After header is missing', async () => {
      vi.useFakeTimers()

      const rateLimitResponse = new Response('Rate limited', {
        status: 429,
        statusText: 'Too Many Requests',
      })
      const successResponse = jsonResponse({ data: { workspace: { name: 'Test' } } })

      fetchSpy
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(successResponse)

      const promise = testConnection(TEST_API_KEY)

      await vi.advanceTimersByTimeAsync(1000)

      const result = await promise

      expect(result).toBe(true)
      expect(fetchSpy).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should throw if still rate limited after retry', async () => {
      vi.useFakeTimers()

      const rateLimitResponse1 = textResponse('Rate limited', 429, {
        'Retry-After': '1',
      })
      const rateLimitResponse2 = textResponse('Still rate limited', 429)

      fetchSpy
        .mockResolvedValueOnce(rateLimitResponse1)
        .mockResolvedValueOnce(rateLimitResponse2)

      const promise = fetchCompanies(TEST_API_KEY).catch((e: unknown) => e)

      await vi.advanceTimersByTimeAsync(1000)

      const error = await promise

      expect(error).toBeInstanceOf(AttioApiError)
      expect((error as AttioApiError).status).toBe(429)

      vi.useRealTimers()
    })
  })

  // -------------------------------------------------------------------------
  // getRecordName
  // -------------------------------------------------------------------------

  describe('getRecordName', () => {
    it('should extract name from values.name string', () => {
      const record = makeRecord({
        values: {
          name: [{ active_from: '', active_until: null, value: 'Acme Corp', attribute_type: 'text' }],
        },
      })

      expect(getRecordName(record)).toBe('Acme Corp')
    })

    it('should extract name from values.name object with value field', () => {
      const record = makeRecord({
        values: {
          name: [{ active_from: '', active_until: null, value: { value: 'Nested Name' }, attribute_type: 'text' }],
        },
      })

      expect(getRecordName(record)).toBe('Nested Name')
    })

    it('should combine first_name and last_name for people', () => {
      const record = makeRecord({
        values: {
          first_name: [{ active_from: '', active_until: null, value: 'Jane', attribute_type: 'text' }],
          last_name: [{ active_from: '', active_until: null, value: 'Doe', attribute_type: 'text' }],
        },
      })

      expect(getRecordName(record)).toBe('Jane Doe')
    })

    it('should handle only first_name present', () => {
      const record = makeRecord({
        values: {
          first_name: [{ active_from: '', active_until: null, value: 'Jane', attribute_type: 'text' }],
        },
      })

      expect(getRecordName(record)).toBe('Jane')
    })

    it('should return "Unnamed" when no name attributes exist', () => {
      const record = makeRecord({ values: {} })

      expect(getRecordName(record)).toBe('Unnamed')
    })

    it('should prefer name over first_name/last_name', () => {
      const record = makeRecord({
        values: {
          name: [{ active_from: '', active_until: null, value: 'Company X', attribute_type: 'text' }],
          first_name: [{ active_from: '', active_until: null, value: 'John', attribute_type: 'text' }],
        },
      })

      expect(getRecordName(record)).toBe('Company X')
    })
  })

  // -------------------------------------------------------------------------
  // getRecordDomain
  // -------------------------------------------------------------------------

  describe('getRecordDomain', () => {
    it('should extract domain string', () => {
      const record = makeRecord({
        values: {
          domains: [{ active_from: '', active_until: null, value: 'acme.com', attribute_type: 'domain' }],
        },
      })

      expect(getRecordDomain(record)).toBe('acme.com')
    })

    it('should extract domain from object with domain field', () => {
      const record = makeRecord({
        values: {
          domains: [{ active_from: '', active_until: null, value: { domain: 'example.com' }, attribute_type: 'domain' }],
        },
      })

      expect(getRecordDomain(record)).toBe('example.com')
    })

    it('should return null when no domains exist', () => {
      const record = makeRecord({ values: {} })

      expect(getRecordDomain(record)).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // getRecordEmail
  // -------------------------------------------------------------------------

  describe('getRecordEmail', () => {
    it('should extract email string', () => {
      const record = makeRecord({
        values: {
          email_addresses: [{ active_from: '', active_until: null, value: 'jane@acme.com', attribute_type: 'email' }],
        },
      })

      expect(getRecordEmail(record)).toBe('jane@acme.com')
    })

    it('should extract email from object with email_address field', () => {
      const record = makeRecord({
        values: {
          email_addresses: [{ active_from: '', active_until: null, value: { email_address: 'bob@example.com' }, attribute_type: 'email' }],
        },
      })

      expect(getRecordEmail(record)).toBe('bob@example.com')
    })

    it('should return null when no email addresses exist', () => {
      const record = makeRecord({ values: {} })

      expect(getRecordEmail(record)).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // fetchAllRecords
  // -------------------------------------------------------------------------

  describe('fetchAllRecords', () => {
    it('should paginate through all pages for companies', async () => {
      const page1 = Array.from({ length: 500 }, (_, i) =>
        makeRecord({ id: { ...makeRecord().id, record_id: `rec-${i}` } })
      )
      const page2 = Array.from({ length: 500 }, (_, i) =>
        makeRecord({ id: { ...makeRecord().id, record_id: `rec-${500 + i}` } })
      )
      const page3 = Array.from({ length: 123 }, (_, i) =>
        makeRecord({ id: { ...makeRecord().id, record_id: `rec-${1000 + i}` } })
      )

      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ data: page1 }))
        .mockResolvedValueOnce(jsonResponse({ data: page2 }))
        .mockResolvedValueOnce(jsonResponse({ data: page3 }))

      const result = await fetchAllRecords(TEST_API_KEY, 'companies')

      expect(result).toHaveLength(1123)
      expect(fetchSpy).toHaveBeenCalledTimes(3)

      // Verify all 3 calls went to the companies endpoint
      for (const call of fetchSpy.mock.calls) {
        expect(call[0]).toBe('https://api.attio.com/v2/objects/companies/records/query')
      }

      // Verify offset progression
      const body1 = JSON.parse(fetchSpy.mock.calls[0]![1].body as string)
      const body2 = JSON.parse(fetchSpy.mock.calls[1]![1].body as string)
      const body3 = JSON.parse(fetchSpy.mock.calls[2]![1].body as string)
      expect(body1.offset).toBe(0)
      expect(body2.offset).toBe(500)
      expect(body3.offset).toBe(1000)
    })

    it('should use people endpoint for people objectType', async () => {
      const records = [makeRecord()]
      fetchSpy.mockResolvedValueOnce(jsonResponse({ data: records }))

      const result = await fetchAllRecords(TEST_API_KEY, 'people')

      expect(result).toHaveLength(1)
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://api.attio.com/v2/objects/people/records/query'
      )
    })

    it('should pass filter option through to fetch calls', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }))

      const filter = { attribute: 'name', condition: 'contains', value: 'Acme' }
      await fetchAllRecords(TEST_API_KEY, 'companies', { filter })

      const body = JSON.parse(fetchSpy.mock.calls[0]![1].body as string)
      expect(body.filter).toEqual(filter)
    })

    it('should return empty array when no records exist', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ data: [] }))

      const result = await fetchAllRecords(TEST_API_KEY, 'companies')

      expect(result).toHaveLength(0)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })

    it('should handle single page (fewer than limit records)', async () => {
      const records = Array.from({ length: 50 }, (_, i) =>
        makeRecord({ id: { ...makeRecord().id, record_id: `rec-${i}` } })
      )
      fetchSpy.mockResolvedValueOnce(jsonResponse({ data: records }))

      const result = await fetchAllRecords(TEST_API_KEY, 'companies')

      expect(result).toHaveLength(50)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // buildNameFilter
  // -------------------------------------------------------------------------

  describe('buildNameFilter', () => {
    it('should return correct Attio filter format', () => {
      const filter = buildNameFilter('Acme')

      expect(filter).toEqual({
        filter: {
          attribute: 'name',
          condition: 'contains',
          value: 'Acme',
        },
      })
    })

    it('should handle empty string', () => {
      const filter = buildNameFilter('')

      expect(filter).toEqual({
        filter: {
          attribute: 'name',
          condition: 'contains',
          value: '',
        },
      })
    })

    it('should preserve special characters in search term', () => {
      const filter = buildNameFilter('O\'Reilly & Partners')

      expect(filter.filter).toEqual({
        attribute: 'name',
        condition: 'contains',
        value: 'O\'Reilly & Partners',
      })
    })
  })

  // -------------------------------------------------------------------------
  // AttioApiError
  // -------------------------------------------------------------------------

  describe('AttioApiError', () => {
    it('should have correct name, message, and status', () => {
      const error = new AttioApiError('Not found', 404)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(AttioApiError)
      expect(error.name).toBe('AttioApiError')
      expect(error.message).toBe('Not found')
      expect(error.status).toBe(404)
    })

    it('should be catchable as Error', () => {
      const error = new AttioApiError('Server error', 500)

      expect(() => {
        throw error
      }).toThrow(Error)
    })
  })
})
