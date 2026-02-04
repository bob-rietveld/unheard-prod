# fn-1-phase-1-context-upload-git-integration.6 Context library UI for browsing files

## Description

Context library UI to display uploaded files. NO delete UI (out of scope).

**Size:** M
**Files:** `src/components/context/ContextLibrary.tsx`, `src/components/context/ContextFileCard.tsx`

## Approach

**ContextLibrary Component**: Grid layout for file cards:

- Load files with `useConvexQuery(api.contexts.listByProject, { projectId })`
- Display grid of ContextFileCard components
- Empty state with ContextUploader when no files
- Search/filter bar (optional for Phase 1)

**ContextFileCard Component**: shadcn Card from `src/components/ui/card.tsx`:

- File icon based on type (lucide-react icons):
  - CSV → Table icon
  - PDF → Document icon
  - Excel → Spreadsheet icon
- Filename as card title
- Metadata: "{rows} rows • {columns} columns" for CSV
- Upload timestamp (formatted with date utility)
- Badge for detected_type (variant="secondary")
- Sync status indicator (synced/pending/error)

**Responsive Grid**:

- 1 column mobile
- 2 columns tablet
- 3 columns desktop

**Convex Integration**: Extend `src/services/context.ts`:

- `useContextFiles(projectId)` query
- Follow wrapper pattern from `src/services/convex-wrapper.ts`

**NO Delete UI**: Out of scope per epic (Phase 1 is upload-only)

## Key Context

- **Grid responsive**: 1 col mobile, 2 cols tablet, 3 cols desktop
- **Date formatting**: Use existing utility from src/lib/
- **Badge colors**: Use variant="secondary" for metadata badges
- **Empty state**: Encourage first upload with clear CTA
- **Sync status**: Show badge for pending/error states (from syncStatus field)

## Acceptance

- [ ] ContextLibrary renders file grid
- [ ] Files loaded from Convex by_project index
- [ ] Cards show filename, metadata, LFS badge
- [ ] Sync status indicator (synced/pending/error)
- [ ] Responsive grid layout
- [ ] NO delete action in UI

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
