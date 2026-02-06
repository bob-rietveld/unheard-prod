# Attio CRM Integration Plan

## Overview

Allow users to connect their Attio CRM workspace, browse companies/people/lists, and import selected records as local JSON files with metadata tracked in Convex. Imported contacts can later be used for persona enrichment and experiment assignment.

## Attio API Reference

- **Base URL**: `https://api.attio.com/v2`
- **Auth**: `Authorization: Bearer <api_key>` header
- **Pagination**: `limit` (default/max 500) + `offset`
- **Key Endpoints**:
  - `GET /v2/lists` - List all lists (scope: `list_configuration:read`)
  - `POST /v2/objects/companies/records/query` - Query companies (scope: `record_permission:read`, `object_configuration:read`)
  - `POST /v2/objects/people/records/query` - Query people (same scopes)
  - `POST /v2/lists/{list}/entries/query` - Query list entries (scope: `list_entry:read`, `list_configuration:read`)
  - `GET /v2/objects/{object}/attributes` - List attributes for an object

## Architecture

Follows existing patterns exactly:

```
UI (AttioDialog) → TanStack Query hooks → attio-client.ts (fetch) → Attio REST API
                 → Tauri command (save JSON files + git commit)
                 → Convex mutation (store metadata)
```

### Design Decisions

1. **API calls from TypeScript** (like `modal-client.ts`) - follows existing pattern
2. **API key stored in preferences** (via existing Tauri preferences system in `.env.local`)
3. **Imported data stored as JSON files** in `attio/{type}/` directory within project
4. **Metadata in Convex** in new `attioImports` table for querying/selection
5. **Zustand store** for connection state and UI (selector syntax only)

## File Plan

### New Files (10)

| File | Purpose |
|------|---------|
| `src/lib/attio-client.ts` | REST API client (fetch-based, typed responses) |
| `src/store/attio-store.ts` | Zustand store: connection state, selected items, import progress |
| `src/services/attio.ts` | TanStack Query hooks (useConvex pattern) |
| `convex/attio.ts` | Convex functions: create/list/get imports, link to experiments |
| `src/components/attio/AttioConnectDialog.tsx` | API key input + connection test dialog |
| `src/components/attio/AttioBrowser.tsx` | Tabbed browser: Companies / People / Lists |
| `src/components/attio/AttioRecordTable.tsx` | Selectable table for records with checkbox selection |
| `src/components/attio/AttioImportButton.tsx` | Import selected records button with progress |
| `src-tauri/src/commands/attio.rs` | Save imported JSON to project dir + git commit |
| `src/lib/__tests__/attio-client.test.ts` | Unit tests for API client |

### Modified Files (7)

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `attioImports` table |
| `src-tauri/src/commands/mod.rs` | Register `attio` command module |
| `src-tauri/src/lib.rs` | Register attio commands with Tauri |
| `locales/en.json` | Add `attio.*` translation strings |
| `locales/fr.json` | Add `attio.*` translation strings |
| `locales/ar.json` | Add `attio.*` translation strings |
| `src/components/layout/LeftSideBar.tsx` | Add Attio nav item / entry point |

## Detailed Specs

### 1. Convex Schema Addition (`convex/schema.ts`)

```typescript
attioImports: defineTable({
  clerkUserId: v.string(),
  projectId: v.id('projects'),
  attioRecordId: v.string(),         // Attio's record UUID
  attioObjectType: v.union(
    v.literal('company'),
    v.literal('person'),
    v.literal('list_entry')
  ),
  name: v.string(),                   // Display name
  attioWebUrl: v.optional(v.string()), // Link back to Attio
  localFilePath: v.string(),          // Relative path to JSON file
  attributes: v.optional(v.any()),    // Key attributes snapshot
  listSlug: v.optional(v.string()),   // If from a list
  importedAt: v.number(),
  syncStatus: v.union(
    v.literal('synced'),
    v.literal('pending'),
    v.literal('error')
  ),
  // Future: link to experiments
  experimentIds: v.optional(v.array(v.id('experiments'))),
})
  .index('by_user', ['clerkUserId'])
  .index('by_project', ['projectId'])
  .index('by_object_type', ['projectId', 'attioObjectType'])
  .index('by_attio_id', ['attioRecordId']),
```

### 2. Attio API Client (`src/lib/attio-client.ts`)

```typescript
// Typed client for Attio REST API v2
// - fetchCompanies(apiKey, filter?, limit?, offset?) → AttioCompanyRecord[]
// - fetchPeople(apiKey, filter?, limit?, offset?) → AttioPersonRecord[]
// - fetchLists(apiKey) → AttioList[]
// - fetchListEntries(apiKey, listSlug, limit?, offset?) → AttioListEntry[]
// - fetchAttributes(apiKey, objectSlug) → AttioAttribute[]
// - testConnection(apiKey) → boolean
//
// All functions throw AttioApiError with status code and message
// Rate limit handling: respect 429 with Retry-After header
```

Key types:
```typescript
interface AttioRecord {
  id: { record_id: string; object_id: string; workspace_id: string }
  created_at: string
  web_url: string
  values: Record<string, AttioAttributeValue[]>
}

interface AttioList {
  id: { list_id: string; workspace_id: string }
  api_slug: string
  name: string
  parent_object: string[]
}

interface AttioListEntry {
  id: { entry_id: string; list_id: string }
  parent_record_id: string
  parent_object: string
  entry_values: Record<string, AttioAttributeValue[]>
}
```

### 3. Zustand Store (`src/store/attio-store.ts`)

```typescript
interface AttioState {
  // Connection
  isConnected: boolean
  isConnecting: boolean
  connectionError: string | null

  // Browse state
  activeTab: 'companies' | 'people' | 'lists'
  selectedRecordIds: Set<string>

  // Import progress
  importStatus: 'idle' | 'importing' | 'complete' | 'error'
  importProgress: { current: number; total: number }
  importError: string | null

  // Actions
  setConnected: (connected: boolean) => void
  setActiveTab: (tab: 'companies' | 'people' | 'lists') => void
  toggleRecordSelection: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  startImport: (total: number) => void
  updateImportProgress: (current: number) => void
  completeImport: () => void
  failImport: (error: string) => void
  reset: () => void
}
```

### 4. Tauri Command (`src-tauri/src/commands/attio.rs`)

```rust
#[tauri::command]
#[specta::specta]
pub async fn save_attio_import(
    project_path: String,
    object_type: String,    // "company" | "person" | "list_entry"
    record_id: String,
    filename: String,
    json_content: String,
) -> Result<String, String> {
    // 1. Create attio/{object_type}/ directory if not exists
    // 2. Write JSON to attio/{object_type}/{filename}.json
    // 3. Git commit the file
    // 4. Return relative file path
}
```

### 5. UI Components

**AttioConnectDialog**: Modal dialog with:
- API key input (password field)
- "Test Connection" button
- Success/error feedback
- Save to preferences

**AttioBrowser**: Full-page or dialog with:
- Three tabs: Companies | People | Lists
- Each tab shows a table with checkbox selection
- Search/filter bar at top
- "Import Selected (N)" button at bottom
- Pagination controls

**AttioRecordTable**: Reusable table with:
- Checkbox column for selection
- Name, key attributes columns
- Link to Attio web URL
- Already-imported badge for duplicates

### 6. Import Flow

1. User opens Attio browser from left sidebar
2. If no API key → show connect dialog
3. Browse companies/people/lists with pagination
4. Select records with checkboxes
5. Click "Import Selected"
6. For each selected record:
   a. Extract key attributes into simplified JSON
   b. Call Tauri command to save JSON file + git commit
   c. Call Convex mutation to store metadata
   d. Update progress in Zustand store
7. Toast notification on completion
8. Imported records visible in context library and available for experiments

### 7. Data File Format

Each imported record stored as `attio/{type}/{name-slug}.json`:

```json
{
  "source": "attio",
  "importedAt": "2026-02-06T12:00:00Z",
  "attioRecordId": "uuid-here",
  "attioWebUrl": "https://app.attio.com/...",
  "objectType": "company",
  "name": "Acme Corp",
  "attributes": {
    "domains": ["acme.com"],
    "description": "Enterprise software company",
    "employee_range": "50-100",
    "primary_location": "San Francisco, CA",
    "categories": ["SaaS", "B2B"],
    "estimated_arr_usd": 5000000
  }
}
```

### 8. Future: Persona Enrichment & Experiment Assignment

The `attioImports` table has an `experimentIds` field. When running experiments:
- User can select imported Attio records as persona sources
- Records' attributes inform persona generation
- Results link back to the Attio record for follow-up

This is wired up via the existing experiment flow but the actual enrichment UI is Phase 4+ work.

## Implementation Tasks (ordered by dependency)

1. **T1: Attio API Client + Types** - `src/lib/attio-client.ts` + tests
2. **T2: Convex Schema + Functions** - `convex/schema.ts` + `convex/attio.ts`
3. **T3: Zustand Store** - `src/store/attio-store.ts`
4. **T4: Tauri Command** - `src-tauri/src/commands/attio.rs` + registration
5. **T5: Service Layer** - `src/services/attio.ts` (TanStack Query hooks)
6. **T6: UI - Connect Dialog** - `src/components/attio/AttioConnectDialog.tsx`
7. **T7: UI - Browser + Table** - `AttioBrowser.tsx` + `AttioRecordTable.tsx`
8. **T8: UI - Import Button + Flow** - `AttioImportButton.tsx` + sidebar entry
9. **T9: i18n** - Translation strings for all 3 locales
10. **T10: Integration Test** - End-to-end flow verification

## Security Notes

- API key stored locally only (never sent to Convex)
- All Convex functions validate `clerkUserId` server-side
- Attio data stored in user's local project directory
- API key read from `.env.local` or preferences (both gitignored)
