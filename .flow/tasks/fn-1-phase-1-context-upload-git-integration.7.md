# fn-1-phase-1-context-upload-git-integration.7 Convex integration & error handling

## Description

Convex integration with retry queue for failed mutations. Uses Clerk user ID from frontend.

**Size:** M
**Files:** `src/services/context.ts` (extend existing), `src/store/upload-store.ts` (extend existing), `convex/contexts.ts`
<!-- Updated by plan-sync: fn-1.4 created context.ts with useUploadContext() hook and upload-store.ts with UploadFileState -->

## Approach

**Full Upload Flow Integration**:

1. User drops file → ContextUploader (Task 4)
2. Validate file (type, size) → Show error if invalid
3. Invoke `commands.uploadContextFile(path, projectPath, channel)` with Channel → Returns ContextFileRecord
<!-- Updated by plan-sync: fn-1.4 used projectPath (string) not projectId (Convex Id) -->
4. **Convex Mutation**: After Rust completes (file copied + committed):

   ```typescript
   import { useUser } from '@clerk/clerk-react'

   const { user } = useUser()
   const uploadMutation = useConvexMutation(api.contexts.create)

   const convexRecord = {
     clerkUserId: user!.id, // Clerk user ID from hook
     projectId: currentProject._id, // Convex uses _id not id
<!-- Updated by plan-sync: fn-1.2 project store uses Convex Id<'projects'> accessed via _id -->
     ...rustRecord, // ContextFileRecord from Rust
     uploadedAt: Date.now(),
     syncStatus: 'pending',
   }

   try {
     await uploadMutation(convexRecord)
     // Mark synced in upload-store
   } catch (error) {
     // Add to retry queue
     queueRetry(convexRecord)
     // Show warning toast
   }
   ```

**Error Handling Strategy**:

- Parse failure → Toast error, don't proceed
- Git commit failure → Log warning, continue (file still local)
- Convex failure → Queue retry, mark unsynced badge
- Duplicate file → Auto-rename with counter in Rust (dash format)

**Duplicate Resolution** - Rust-side with dash format:

- Check existing files in `{project}/context/` directory
- Append `-N` before extension if duplicate
- Logic: `file.csv` exists → `file-2.csv` (dash separator, NOT spaces)
- All duplicate resolution happens in Rust during upload_context_file

**Retry Queue** (localStorage persistence):

```typescript
const retryQueue = useUploadStore(state => state.retryQueue)

// Periodic retry (every 30s)
useEffect(() => {
  const interval = setInterval(() => {
    retryQueue.forEach(record => attemptRetry(record))
  }, 30000)
  return () => clearInterval(interval)
}, [])
```

**Network Resilience**:

- Convex mutation failure doesn't block local operations
- Queue failed mutations for retry
- Show unsynced badge on files in error state

**Testing Strategy**:

- Unit tests for duplicate filename logic (in Rust)
- Mock Tauri commands with `vi.fn()`
- Test Convex failure + retry logic
- E2E test with fixture files

## Key Context

<!-- Updated by plan-sync: fn-1.4 established these patterns in context.ts -->
- **Existing hook**: `useUploadContext()` returns TanStack Query mutation - extend `onSuccess` to add Convex mutation
- **Existing store**: `useUploadStore` has `addFile`, `updateFile`, `removeFile`, `clearCompleted` - add `retryQueue` state
- **Existing queue**: `queueUploads(paths, projectPath, uploadFn)` handles concurrency - Convex retry is separate concern
- **Zero data loss**: File saved locally even if Convex fails
- **Retry persistence**: Queue survives app restarts (localStorage)
- **Transactional boundaries**: Clear separation of copy/git/convex steps
- **Atomic operations**: File copy should be atomic (tmp file + rename)
- **User feedback**: Clear progress and error states for all scenarios
- **Duplicate format**: Dash separator (`file-2.csv`), NOT spaces
- **Duplicate resolution**: Happens in Rust, not Convex
- **Clerk user ID**: Get from useUser() hook, pass to Convex mutation

## Acceptance

- [ ] Convex mutation accepts clerkUserId from frontend
- [ ] Frontend gets clerkUserId via useUser() hook
- [ ] Retry queue in localStorage
- [ ] Periodic retry (30s interval)
- [ ] State machine tracked in upload-store
- [ ] Unsynced badge shown on failure
- [ ] Duplicate files use dash format: file.csv → file-2.csv
- [ ] Tests cover success + Convex failure paths
- [ ] Test coverage >80%

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
