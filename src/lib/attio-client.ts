/**
 * HTTP client for the Attio CRM REST API v2.
 *
 * All functions accept an API key and make authenticated requests to Attio.
 * Rate limit (429) responses are retried once after respecting the Retry-After header.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueryOpts {
  limit?: number
  offset?: number
  filter?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  nextOffset: number
}

export interface AttioRecordId {
  record_id: string
  object_id: string
  workspace_id: string
}

export interface AttioRecord {
  id: AttioRecordId
  created_at: string
  web_url: string
  values: Record<string, AttioAttributeValue[]>
}

export interface AttioAttributeValue {
  active_from: string
  active_until: string | null
  value: unknown
  attribute_type: string
}

export interface AttioList {
  id: { list_id: string; workspace_id: string }
  api_slug: string
  name: string
  parent_object: string[]
  created_at: string
}

export interface AttioListEntry {
  id: { entry_id: string; list_id: string }
  parent_record_id: string
  parent_object: string
  created_at: string
  entry_values: Record<string, AttioAttributeValue[]>
}

export class AttioApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AttioApiError'
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = 'https://api.attio.com/v2'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }
}

/**
 * Make an authenticated request to the Attio API.
 * Handles 429 rate limits by waiting for the Retry-After period and retrying once.
 */
async function attioFetch(
  apiKey: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  const opts: RequestInit = {
    ...options,
    headers: {
      ...headers(apiKey),
      ...(options.headers as Record<string, string> | undefined),
    },
  }

  let response = await fetch(url, opts)

  // Handle rate limit: retry once after Retry-After delay
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After')
    const waitMs = retryAfter ? Number(retryAfter) * 1000 : 1000
    await new Promise((resolve) => setTimeout(resolve, waitMs))
    response = await fetch(url, opts)
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new AttioApiError(
      `Attio API error (${response.status}): ${errorText}`,
      response.status
    )
  }

  return response
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Test connectivity by calling GET /v2/self.
 * Returns true if the API key is valid, false otherwise.
 */
export async function testConnection(apiKey: string): Promise<boolean> {
  try {
    await attioFetch(apiKey, '/self')
    return true
  } catch {
    return false
  }
}

/**
 * Query company records from Attio.
 */
export async function fetchCompanies(
  apiKey: string,
  opts?: QueryOpts
): Promise<PaginatedResponse<AttioRecord>> {
  const body: Record<string, unknown> = {}
  if (opts?.limit != null) body.limit = opts.limit
  if (opts?.offset != null) body.offset = opts.offset
  if (opts?.filter != null) body.filter = opts.filter

  const response = await attioFetch(apiKey, '/objects/companies/records/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const json = (await response.json()) as { data: AttioRecord[] }
  const limit = opts?.limit ?? 500
  const offset = opts?.offset ?? 0

  return {
    data: json.data,
    hasMore: json.data.length >= limit,
    nextOffset: offset + json.data.length,
  }
}

/**
 * Query people records from Attio.
 */
export async function fetchPeople(
  apiKey: string,
  opts?: QueryOpts
): Promise<PaginatedResponse<AttioRecord>> {
  const body: Record<string, unknown> = {}
  if (opts?.limit != null) body.limit = opts.limit
  if (opts?.offset != null) body.offset = opts.offset
  if (opts?.filter != null) body.filter = opts.filter

  const response = await attioFetch(apiKey, '/objects/people/records/query', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const json = (await response.json()) as { data: AttioRecord[] }
  const limit = opts?.limit ?? 500
  const offset = opts?.offset ?? 0

  return {
    data: json.data,
    hasMore: json.data.length >= limit,
    nextOffset: offset + json.data.length,
  }
}

/**
 * Fetch all lists from the Attio workspace.
 */
export async function fetchLists(apiKey: string): Promise<AttioList[]> {
  const response = await attioFetch(apiKey, '/lists')
  const json = (await response.json()) as { data: AttioList[] }
  return json.data
}

/**
 * Query entries for a specific list.
 */
export async function fetchListEntries(
  apiKey: string,
  listSlug: string,
  opts?: QueryOpts
): Promise<PaginatedResponse<AttioListEntry>> {
  const body: Record<string, unknown> = {}
  if (opts?.limit != null) body.limit = opts.limit
  if (opts?.offset != null) body.offset = opts.offset
  if (opts?.filter != null) body.filter = opts.filter

  const response = await attioFetch(apiKey, `/lists/${listSlug}/entries/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  })

  const json = (await response.json()) as { data: AttioListEntry[] }
  const limit = opts?.limit ?? 500
  const offset = opts?.offset ?? 0

  return {
    data: json.data,
    hasMore: json.data.length >= limit,
    nextOffset: offset + json.data.length,
  }
}

// ---------------------------------------------------------------------------
// Bulk fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all records of a given type, automatically paginating through all pages.
 * Uses the maximum page size of 500 records per request.
 */
export async function fetchAllRecords(
  apiKey: string,
  objectType: 'companies' | 'people',
  opts?: { filter?: Record<string, unknown> }
): Promise<AttioRecord[]> {
  const all: AttioRecord[] = []
  let offset = 0
  const limit = 500 // Attio max page size
  const fetchFn = objectType === 'companies' ? fetchCompanies : fetchPeople

  let hasMore = true
  while (hasMore) {
    const result = await fetchFn(apiKey, { limit, offset, filter: opts?.filter })
    all.push(...result.data)
    hasMore = result.hasMore
    offset = result.nextOffset
  }

  return all
}

/**
 * Build an Attio filter object for searching records by name.
 * Uses the Attio filter format: { attribute, condition, value }.
 */
export function buildNameFilter(searchTerm: string): Record<string, unknown> {
  return {
    filter: {
      attribute: 'name',
      condition: 'contains',
      value: searchTerm,
    },
  }
}

// ---------------------------------------------------------------------------
// Record helpers
// ---------------------------------------------------------------------------

/**
 * Extract a display name from an Attio record.
 * Tries values.name first, then first_name + last_name, falls back to 'Unnamed'.
 */
export function getRecordName(record: AttioRecord): string {
  // Try "name" attribute (companies)
  const nameValues = record.values.name
  if (nameValues?.[0]?.value != null) {
    const val = nameValues[0].value
    if (typeof val === 'string') return val
    if (typeof val === 'object' && val !== null && 'value' in val) {
      return String((val as { value: unknown }).value)
    }
  }

  // Try first_name + last_name (people)
  const firstName = record.values.first_name?.[0]?.value
  const lastName = record.values.last_name?.[0]?.value
  if (firstName != null || lastName != null) {
    return [firstName, lastName].filter(Boolean).join(' ') || 'Unnamed'
  }

  return 'Unnamed'
}

/**
 * Extract the primary domain from an Attio record, or null if none.
 */
export function getRecordDomain(record: AttioRecord): string | null {
  const domains = record.values.domains
  if (!domains?.[0]?.value) return null

  const val = domains[0].value
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val !== null && 'domain' in val) {
    return String((val as { domain: unknown }).domain)
  }

  return null
}

/**
 * Extract the primary email from an Attio record, or null if none.
 */
export function getRecordEmail(record: AttioRecord): string | null {
  const emails = record.values.email_addresses
  if (!emails?.[0]?.value) return null

  const val = emails[0].value
  if (typeof val === 'string') return val
  if (typeof val === 'object' && val !== null && 'email_address' in val) {
    return String((val as { email_address: unknown }).email_address)
  }

  return null
}
