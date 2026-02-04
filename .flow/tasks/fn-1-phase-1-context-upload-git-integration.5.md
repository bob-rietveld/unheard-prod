# fn-1-phase-1-context-upload-git-integration.5 Git auto-commit implementation

## Description

Git auto-commit with LFS tracking for files >10MB via .gitattributes.

**Size:** M
**Files:** `src-tauri/src/commands/git.rs`, `src-tauri/src/bindings.rs`

## Approach

**Git Commands**: Create `src-tauri/src/commands/git.rs` following github-scout pattern (simeg/eureka):

```rust
#[tauri::command]
#[specta::specta]
pub fn git_auto_commit(
    repo_path: PathBuf,
    files: Vec<String>,
    message: String
) -> Result<String, String>
```

**Git Auto-Commit Flow** (per git-integration-spec.md):

1. Open repository with `Repository::open()`
2. Get index with `repo.index()`
3. Add files with `index.add_path()` for each file
4. **Critical**: Call `index.write()` before `write_tree()` (from practice-scout pitfall)
5. Write tree with `index.write_tree()`
6. Get parent commit (if exists) - handle first commit vs subsequent
7. Create commit with `repo.signature()`, fallback `Signature::now("Unheard User", "user@unheard.local")`
8. Return commit ID

**Commit Message Format**:

- Single file: "Add context: {filename}"
- Multiple files: "Add context files: {file1}, {file2}, ..."
- Follow format from git-integration-spec.md

**LFS Integration**:

- LFS tracking handled via `.gitattributes` rules (created in Task 2)
- Files >10MB automatically tracked by Git LFS via pattern rules
- No explicit `git lfs track` needed in commit flow
- Git honors .gitattributes automatically during add/commit

**GitStatus Type**: Add to `src-tauri/src/types.rs`:

```rust
pub struct GitStatus {
    pub uncommitted_changes: usize,
    pub synced: bool,
}
```

## Key Context

- **Error handling**: Handle missing repo, locked index, empty commits gracefully
- **Signature**: Use `repo.signature()` first (respects Git config), fallback to `Signature::now("Unheard User", "user@unheard.local")` for consistency with initialize_git
<!-- Updated by plan-sync: fn-1.2 used repo.signature() with fallback to "Unheard User"/"user@unheard.local" not "Unheard"/"auto@unheard.local" -->
- **Parent commit**: Handle first commit (no parent) vs subsequent commits
- **Command registration**: Update bindings.rs AND mod.rs
- **LFS tracking**: Automatic via .gitattributes, no manual track command

## Acceptance

- [ ] git_auto_commit command implemented
- [ ] LFS tracking via .gitattributes (files >10MB auto-tracked)
- [ ] index.write called before write_tree
- [ ] Commit created with message
- [ ] Commit ID returned
- [ ] Error handling for missing repo
- [ ] Registered in bindings.rs
- [ ] Tests cover LFS and non-LFS commits

## Done summary
Implemented git_auto_commit command with LFS support via .gitattributes. Command handles single/multiple file commits, calls index.write() before write_tree(), and supports both first and subsequent commits.
## Evidence
- Commits: 7055f87fe444ffaac5b7c56a3ffd088bbfeb1802
- Tests: cargo test --lib commands::git::tests, cargo test --lib
- PRs: