# fn-1-phase-1-context-upload-git-integration.4 File upload UI with drag-and-drop

## Description

File upload UI using Tauri window.onFileDrop events with Channel progress tracking.

**Size:** M
**Files:** `src/components/context/ContextUploader.tsx`, `src/store/upload-store.ts`

## Approach

**Tauri File Drop** (NO react-dropzone - Codex critical fix):

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'

useEffect(() => {
  const unlisten = getCurrentWindow().onFileDrop(event => {
    if (event.payload.type === 'drop') {
      const paths: string[] = event.payload.paths
      handleFilePaths(paths)
    }
  })

  return () => {
    unlisten.then(fn => fn())
  }
}, [])
```

**Upload Flow**:

1. Tauri event provides filesystem paths
2. Filter by extension (.csv, .pdf, .xlsx)
3. Invoke `commands.uploadContextFile(path, projectId)` with Channel
4. Listen to Channel for progress updates (UploadProgress enum)
5. Update upload-store with status

**ContextUploader Component**: Use shadcn Card from `src/components/ui/card.tsx`:

- Drop zone visual (dashed border card)
- File icon + text: "Drag files or click to upload"
- List of supported formats (.csv, .pdf, .xlsx)
- Real-time progress bars for each file
- Error messages from Rust

**Upload State** (Zustand): Create `src/store/upload-store.ts`:

```typescript
{
  [fileId]: {
    originalFilename: string,
    status: 'parsing' | 'copying' | 'committing' | 'complete' | 'error',
    percent: number,
    error?: string,
  }
}
```

**Service Layer**: Create `src/services/context.ts`:

- `useUploadContext()` hook - Handles upload + progress streaming
- Listen to Tauri Channel events
- Update upload-store as progress arrives
- NO Convex mutation here (Task 7)

**Tauri Capabilities**: Ensure window events enabled in `src-tauri/tauri.conf.json`

## Key Context

- **NO react-dropzone**: Use Tauri window.onFileDrop API (Codex critical fix)
- **Channel listening**: Use Tauri event system for progress updates
- **Concurrent uploads**: Limit to 5 concurrent uploads
- **Error toasts**: Use existing toast notification pattern
- **i18n**: All strings from translation keys (not hardcoded English)
- **State pattern**: Use Zustand selectors, not destructuring

## Acceptance

- [ ] window.onFileDrop handler implemented
- [ ] File paths received from event
- [ ] upload_context_file invoked with Channel
- [ ] Progress updates via Channel events
- [ ] upload-store tracks status per file
- [ ] Progress bars shown
- [ ] Error toasts for failures
- [ ] 5 concurrent upload limit
- [ ] Tauri capabilities configured for window events

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
