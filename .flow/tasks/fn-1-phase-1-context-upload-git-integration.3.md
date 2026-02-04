# fn-1-phase-1-context-upload-git-integration.3 Rust file parsing commands (CSV, PDF, Excel)

## Description
Implement upload_context_file command with spawn_blocking, Channels, and ContextFileRecord return.

**Size:** M
**Files:** `src-tauri/src/commands/context.rs`, `src-tauri/src/types.rs`, `src-tauri/src/bindings.rs`

## Approach

**ContextFileRecord Type**: Add to `src-tauri/src/types.rs`:
```rust
#[derive(Type)]
pub struct ContextFileRecord {
    pub original_filename: String,
    pub stored_filename: String,  // Sanitized (slugified)
    pub file_type: String,
    pub detected_type: Option<String>,
    pub rows: Option<usize>,
    pub columns: Option<Vec<String>>,
    pub preview: Option<String>,  // 500 chars max
    pub pages: Option<usize>,
    pub text_preview: Option<String>,
    pub size_bytes: u64,
    pub relative_file_path: String,  // "context/file-2.csv"
    pub is_lfs: bool,  // true if >10MB
}

#[derive(Type, Clone, Serialize)]
#[serde(tag = "type")]
pub enum UploadProgress {
    Parsing { percent: u8 },
    Copying { percent: u8 },
    Committing { percent: u8 },
    Complete { record: ContextFileRecord },
    Error { message: String },
}
```

**Command with Channel**: Create `src-tauri/src/commands/context.rs`:
```rust
#[tauri::command]
#[specta::specta]
pub async fn upload_context_file(
    path: String,
    project_id: String,
    on_progress: Channel<UploadProgress>
) -> Result<ContextFileRecord, String> {
    // spawn_blocking for heavy I/O (mandatory per Codex)
    let record = tokio::task::spawn_blocking(move || {
        on_progress.send(UploadProgress::Parsing { percent: 10 });
        let metadata = parse_file(&path)?;
        // ... copy file, git commit
    }).await??;

    Ok(record)
}
```

**CSV Parsing**: Use csv crate with `.flexible(true)`:
- Extract headers as `Vec<String>`
- Count rows with `.records().count()`
- First 10 rows for preview
- Detect type from column names heuristic

**PDF Parsing**: Use lopdf with stability handling:
- Wrap in `catch_unwind(AssertUnwindSafe(...))` per practice-scout
- Extract page count + first 500 chars
- Return empty text if extraction fails (image-based PDF)

**Excel Parsing**: Use calamine `open_workbook_auto`:
- First sheet only
- Similar metadata to CSV (rows, columns)

**Filename Sanitization**:
- Create `sanitize_filename()` helper
- Preserve originalFilename separately
- Slugify for storedFilename (lowercase, hyphens, no spaces/parens)

## Key Context

- **Threading**: ALL file parsing in spawn_blocking (mandatory per Codex)
- **Channels**: Use Tauri Channel for progress, not events (per best practices)
- **Error handling**: catch_unwind for lopdf stability, descriptive errors
- **Command registration**: Update bindings.rs AND mod.rs
- **Modern Rust**: Use `format!("{variable}")` not `format!("{}", variable)`
## Acceptance
- [ ] ContextFileRecord struct defined
- [ ] UploadProgress enum with Parsing/Copying/Committing/Complete/Error
- [ ] upload_context_file uses Channel parameter
- [ ] Parsing runs in spawn_blocking
- [ ] Progress emitted at key steps
- [ ] CSV/PDF/Excel parsing works
- [ ] Filename sanitization (slugify)
- [ ] isLFS flag set for >10MB
- [ ] Registered in bindings.rs
- [ ] TypeScript bindings updated
- [ ] Tests cover all parsers
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
