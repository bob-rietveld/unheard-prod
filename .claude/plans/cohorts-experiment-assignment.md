# Cohorts & Experiment Assignment

## Overview

Enable users to select Attio CRM records via smart filters, bulk-import them, organize into reusable **cohorts** (named groups), and assign cohorts to experiments as real persona data sources.

## Key Concept: Cohort

A **cohort** is a named, reusable group of imported Attio records (companies and/or people). Think of it as a saved audience segment that can be assigned to multiple experiments.

Examples:
- "Series A Investors" — 50 VC partners from Attio
- "Enterprise Customers" — 120 companies from a specific list
- "Beta Testers" — 30 people tagged in Attio

## Architecture

### Data Flow

```
Attio API (smart filter/query)
    ↓ fetchAllRecords() auto-pagination
Bulk Import (batch Tauri command, single git commit)
    ↓ attio/{type}/{name}.json files + Convex metadata
"Save as Cohort" — user names the group
    ↓ cohorts table in Convex (memberIds → attioImports)
Assign Cohort to Experiment
    ↓ cohortId on experiment, personas.source = 'cohort'
Modal reads cohort member data as real personas
```

### New Files

```
convex/cohorts.ts                              — Convex CRUD functions
src/store/cohort-store.ts                      — Zustand UI state
src/services/cohorts.ts                        — TanStack Query hooks
src/components/cohorts/CohortList.tsx           — Sidebar cohort list
src/components/cohorts/CohortDetail.tsx         — View/edit cohort members
src/components/cohorts/CohortCreateDialog.tsx   — Name + create cohort
src/components/cohorts/CohortSelector.tsx       — Pick cohort for experiment
src-tauri/src/commands/attio.rs                — Add batch_save_attio_imports
```

### Modified Files

```
convex/schema.ts           — Add cohorts table, add cohortId to experiments
src/lib/attio-client.ts    — Add fetchAllRecords(), search helpers
src/components/attio/AttioBrowser.tsx       — Search bar, bulk import, save-as-cohort
src/components/attio/AttioImportButton.tsx  — Batch mode using new Rust command
src/components/layout/LeftSideBar.tsx       — Add CohortList section
src/lib/experiment-config-generator.ts      — Support cohort-sourced personas
src/lib/experiment-runner.ts                — Pass cohort data to Modal
locales/en.json, fr.json, ar.json           — New i18n keys
```

## Detailed Specs

### 1. Enhanced Attio API Client

```typescript
// New: auto-paginate to fetch ALL matching records
export async function fetchAllRecords(
  apiKey: string,
  objectType: 'companies' | 'people',
  opts?: { filter?: Record<string, unknown> }
): Promise<AttioRecord[]>

// New: simple name search filter builder
export function buildNameFilter(query: string): Record<string, unknown>
```

- `fetchAllRecords` iterates with limit=500 until `hasMore=false`
- Returns flat array of all records (handles 100s efficiently)
- `buildNameFilter` creates Attio filter object for name-contains search

### 2. Batch Tauri Command

```rust
#[tauri::command]
#[specta::specta]
pub fn batch_save_attio_imports(
    project_path: String,
    imports: Vec<AttioImportEntry>,  // {object_type, record_id, filename, json_content}
) -> Result<Vec<String>, String>     // Returns vec of relative paths
```

- Writes all files first, then single git commit with all paths
- Much faster than N individual saves + N commits for 100s of records
- Falls back gracefully if git fails (files still saved)

### 3. Convex Schema: cohorts Table

```typescript
cohorts: defineTable({
  clerkUserId: v.string(),
  projectId: v.id('projects'),
  name: v.string(),
  description: v.optional(v.string()),
  memberIds: v.array(v.id('attioImports')),  // References to imported records
  memberCount: v.number(),                    // Denormalized for display
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_user', ['clerkUserId'])
  .index('by_project', ['projectId'])
```

Also add to experiments table:
```typescript
cohortId: v.optional(v.id('cohorts'))  // Links experiment to a cohort
```

### 4. Convex Functions: cohorts.ts

- `create(name, description, projectId, memberIds)` — Create cohort
- `listByProject(projectId)` — List all cohorts for project
- `get(id)` — Get cohort with member details
- `getMembers(id)` — Get full attioImport records for all members
- `addMembers(id, memberIds)` — Add imports to cohort
- `removeMembers(id, memberIds)` — Remove imports from cohort
- `update(id, name?, description?)` — Update metadata
- `remove(id)` — Delete cohort (not the imports)

### 5. Cohort Store (Zustand)

```typescript
interface CohortState {
  selectedCohortId: string | null
  cohortDetailOpen: boolean
  createDialogOpen: boolean
  // Actions
  selectCohort: (id: string | null) => void
  openDetail: (id: string) => void
  closeDetail: () => void
  openCreateDialog: () => void
  closeCreateDialog: () => void
}
```

### 6. Cohort Service (TanStack Query)

```typescript
cohortKeys = {
  all: ['cohorts'],
  byProject: (projectId) => [...all, 'byProject', projectId],
  detail: (id) => [...all, id],
  members: (id) => [...all, id, 'members'],
}

useProjectCohorts(projectId)     — List cohorts
useCohort(id)                    — Single cohort
useCohortMembers(id)             — Members with full data
useCreateCohort()                — Create mutation
useUpdateCohort()                — Update mutation
useAddCohortMembers()            — Add members mutation
useRemoveCohortMembers()         — Remove members mutation
useDeleteCohort()                — Delete mutation
```

### 7. UI: Enhanced AttioBrowser

Add to existing AttioBrowser:
- **Search bar** at top of record list — filters via Attio API (debounced 300ms)
- **"Import All Filtered"** button — imports all matching records (auto-paginates)
- **"Save as Cohort"** button — appears after successful bulk import, opens CohortCreateDialog pre-populated with just-imported record IDs
- Import progress bar for bulk operations (X of Y)

### 8. UI: Cohort Management

**CohortList** (in LeftSideBar, below ChatList):
- Shows cohort name + member count badge
- Click opens CohortDetail sheet
- "New Cohort" button

**CohortDetail** (Sheet, slides from right):
- Header: name, description, member count
- Member table with name, type, domain/email
- Remove member button per row
- "Add from Attio" button → opens AttioBrowser
- Edit name/description inline

**CohortCreateDialog** (Dialog):
- Name input (required)
- Description input (optional)
- Shows count of members being added
- Create button

### 9. Experiment Integration

**CohortSelector** component:
- Dropdown showing project cohorts with member counts
- Selected cohort preview (first 5 members)
- Placed in experiment setup flow (after wizard, before run)

**Config Generator Update**:
```typescript
// When cohort is assigned:
personas: {
  generationType: 'cohort',
  cohortId: 'convex-id',
  count: 50,  // = cohort member count
  members: [
    { name: 'Alice Johnson', type: 'person', attributes: {...} },
    { name: 'Acme Corp', type: 'company', attributes: {...} },
  ]
}
```

**Experiment Runner Update**:
- If `personas.generationType === 'cohort'`, skip synthetic generation
- Pass member data directly to Modal as persona profiles
- Each cohort member becomes one persona in the experiment

## Task Breakdown

| # | Task | Depends On | Agent |
|---|------|-----------|-------|
| 1 | Enhanced Attio API + Batch Rust Command | — | api-builder |
| 2 | Convex Cohorts Schema + Store + Service | — | data-builder |
| 3 | Enhanced AttioBrowser + Bulk Import UI | 1, 2 | browser-builder |
| 4 | Cohort Management UI (List + Detail) | 2 | ui-builder |
| 5 | Experiment Integration + i18n | 2, 4 | integration-builder |

Tasks 1 and 2 run in parallel. Then 3 and 4 run in parallel. Then 5.
