# Phase 1: Context Upload & Git Integration

## Overview

Enable users to upload company context files (CSV, PDF, Excel) via drag-and-drop, automatically parse metadata, store files in version control (Git), and sync metadata to Convex cloud backend. This is the foundational feature for the entire Unheard decision support platform.

**Duration**: Weeks 1-2 (14 days)
**Stack**: Tauri v2 (Rust), React 19, Zustand, TanStack Query, Convex, Clerk Auth, git2, csv crate

## Scope

### In Scope

- File upload UI using Tauri file-drop events (CSV, PDF, Excel support)
- Rust commands for file parsing (CSV/PDF/Excel metadata extraction)
- Context library UI for browsing uploaded files
- Git auto-commit with LFS support for large files (PDF, Excel >10MB)
- Convex database storage for file metadata with Clerk authentication
- Error handling for parse failures and duplicate files
- Project foundation using EXISTING Convex projects table
- Filename sanitization and duplicate resolution (dash-separated format)
- Clerk authentication integration via tauri-plugin-clerk

### Out of Scope

- Full OAuth flows (Clerk limitation in Tauri - Phase 2)
- File deletion UI (covered in Phase 5)
- Advanced PDF features (OCR, annotations)
- File versioning/history UI (Git history exists but no UI)
- Template system integration (Phase 2)
- Cloud execution (Phase 3)

## Approach

Follow vertical slice strategy: complete working feature end-to-end before moving to next phase.

**Architecture Pattern**:

```
User authenticated via Clerk (tauri-plugin-clerk)
  ↓ Clerk session stored in Tauri storage
User drops file via Tauri window.onFileDrop
  ↓ Tauri event provides filesystem path
invoke upload_context_file(path, projectId) [Rust]
  ↓ spawn_blocking thread
1. Read file bytes + compute size
2. Parse metadata → FileParseResult
3. Generate safe storedFilename (slugify original)
4. Check for duplicates → append -2 if needed (dash separator)
5. Atomic copy to {project}/context/{storedFilename}
6. Git add + commit (LFS via .gitattributes if >10MB)
  ↓ emit progress events via Tauri Channel
7. Return ContextFileRecord to frontend
  ↓
Frontend: Add projectId + uploadedAt + clerkUserId
  ↓
Convex mutation api.contexts.create(record) [clerkUserId mapped to userId]
  ↓ on failure: mark "unsynced", queue retry
React ContextLibrary refreshes → Display file card
```

**Key Technical Decisions**:

1. **Tauri file-drop events** - window.onFileDrop for reliable paths
2. **Files stored locally** in `{project_path}/context/`
3. **Git LFS configured** via `.gitattributes` in PROJECT repo (PDF, Excel only)
4. **Metadata in Convex** - uses EXISTING projects table, Clerk auth for Phase 1
5. **Tauri Channels mandatory** - stream progress, no UI freeze
6. **Filename strategy**: originalFilename + storedFilename (slugified, dash-separated for duplicates)
7. **Auth strategy**: Clerk via tauri-plugin-clerk, email/password for Phase 1, OAuth in Phase 2
8. **Duplicate format**: `file.csv` exists → `file-2.csv` (dash separator, NOT spaces)
9. **Upload state machine**: pending_copy → pending_git → pending_convex → synced
10. **LFS files**: PDF and Excel only (CSV excluded to avoid LFS overhead)

**Dependencies Resolution**:

- Day 0: Rust crates (git2, csv, lopdf, calamine with xlsb, tauri-plugin-clerk, tauri-plugin-http, tauri-plugin-store)
- Day 0: npm install @clerk/clerk-react tauri-plugin-clerk
- Day 0: Set up Clerk app and get publishable key
- Day 0: Deploy Convex schema (contextFiles WITH clerkUserId)
- Day 0: Initialize Clerk in main.tsx with ClerkProvider
- Day 0: Configure Clerk capabilities and permissions in tauri.conf.json
- Day 0: Project git init creates `.gitattributes` for LFS tracking (PDF, Excel only)
- Day 0: Detect git-lfs; warn if missing
- Day 0: Use EXISTING Convex projects table (no new table needed)

## Quick commands

```bash
# Setup dependencies
cd src-tauri && cargo add git2 csv lopdf "calamine@0.26" --features xlsb tauri-plugin-clerk tauri-plugin-http tauri-plugin-store
npm install @clerk/clerk-react tauri-plugin-clerk

# Project git init creates .gitattributes (Task 2)
# Format:
#   context/**/*.pdf filter=lfs diff=lfs merge=lfs -text
#   context/**/*.xlsx filter=lfs diff=lfs merge=lfs -text

# Deploy Convex schema
npx convex dev

# Run tests
npm run test src/components/context/ContextUploader.test.tsx
cargo test --lib commands::context::tests

# Manual test
npm run tauri:dev
```

## Acceptance

- [ ] User can create project via EXISTING Convex projects table
- [ ] Project init creates `.gitattributes` in project repo (PDF, Excel LFS only)
- [ ] Clerk plugin initialized in Tauri
- [ ] ClerkProvider wraps app in main.tsx
- [ ] User can sign in via email/password (Clerk)
- [ ] Clerk session persists across app restarts
- [ ] Tauri file-drop handler receives paths
- [ ] CSV/PDF/Excel parsing in spawn_blocking with progress
- [ ] Filename sanitization: originalFilename + storedFilename (slugified)
- [ ] Duplicates use dash format: `file.csv` → `file-2.csv`
- [ ] Atomic copy to context/
- [ ] Git LFS tracking via .gitattributes (PDF, Excel >10MB only)
- [ ] Channel emits progress events
- [ ] Frontend sends ContextFileRecord with clerkUserId
- [ ] Convex failure → retry queue
- [ ] Context library shows files with progress
- [ ] LFS badge for >10MB files
- [ ] 5 concurrent uploads work
- [ ] All error paths tested

## Data Model Changes

**Convex Schema** (with Clerk user ID):

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  contextFiles: defineTable({
    clerkUserId: v.string(), // Clerk user ID from frontend
    projectId: v.id('projects'), // Use EXISTING projects table
    originalFilename: v.string(),
    storedFilename: v.string(), // Slugified, dash-separated for duplicates
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    preview: v.optional(v.string()),
    pages: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    sizeBytes: v.number(),
    relativeFilePath: v.string(),
    isLFS: v.boolean(),
    uploadedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  })
    .index('by_user', ['clerkUserId'])
    .index('by_project', ['projectId']),
})
```

**Convex Mutation** (accepts clerkUserId from frontend):

```typescript
// convex/contexts.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

export const create = mutation({
  args: {
    clerkUserId: v.string(), // From frontend via Clerk
    projectId: v.id('projects'),
    originalFilename: v.string(),
    storedFilename: v.string(),
    fileType: v.string(),
    detectedType: v.optional(v.string()),
    rows: v.optional(v.number()),
    columns: v.optional(v.array(v.string())),
    preview: v.optional(v.string()),
    pages: v.optional(v.number()),
    textPreview: v.optional(v.string()),
    sizeBytes: v.number(),
    relativeFilePath: v.string(),
    isLFS: v.boolean(),
    uploadedAt: v.number(),
    syncStatus: v.union(
      v.literal('synced'),
      v.literal('pending'),
      v.literal('error')
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('contextFiles', args)
  },
})
```

**Clerk Setup** (tauri-plugin-clerk):

```typescript
// src/main.tsx
import { ClerkProvider } from '@clerk/clerk-react';
import { initClerk } from 'tauri-plugin-clerk';

const clerkPromise = initClerk();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      Clerk={clerkPromise}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
```

## Risks & Mitigations

| Risk                       | Mitigation                                                                 |
| -------------------------- | -------------------------------------------------------------------------- |
| **LFS not installed**      | Detect on project init; warn user; continue without LFS                    |
| **Filename sanitization**  | Preserve originalFilename; sanitize storedFilename with dashes             |
| **UI freeze**              | Mandatory spawn_blocking + Channels                                        |
| **Convex failures**        | Retry queue with localStorage                                              |
| **Clerk OAuth limitation** | Use email/password for Phase 1; OAuth in Phase 2 after Clerk plugin update |

## References

- Tauri command registration: `src-tauri/src/bindings.rs` (NOT just mod.rs)
- Window events: [Tauri v2 onFileDrop](https://v2.tauri.app/reference/javascript/api/namespacewindow/#onfiledrop)
- Existing patterns: `src-tauri/src/commands/preferences.rs`, `src/store/ui-store.ts`
- Clerk Tauri Plugin: [tauri-plugin-clerk](https://github.com/Nipsuli/tauri-plugin-clerk)
