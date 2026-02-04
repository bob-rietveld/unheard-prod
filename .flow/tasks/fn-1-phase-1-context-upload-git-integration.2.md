# fn-1-phase-1-context-upload-git-integration.2 Minimal project creation & selection

## Description

Use EXISTING Convex projects table for project management. Add Git init command with LFS detection. Creates `.gitattributes` in PROJECT repo for large files only.

**Size:** M
**Files:** `src/store/project-store.ts`, `src-tauri/src/commands/projects.rs`, `src/components/projects/ProjectSelector.tsx`, `src-tauri/src/bindings.rs`

## Approach

**Use Existing Schema**: Repo has `projects` table with userId in Convex (auth added in Task 1) - use it directly

**Zustand Store**: Create `src/store/project-store.ts` following pattern at `src/store/ui-store.ts`:

- `currentProject: Project | null`
- `setCurrentProject(project: Project)`
- Load from Convex query via TanStack Query
- Use selector pattern (not destructuring)

**Tauri Commands**: Add `src-tauri/src/commands/projects.rs` following pattern at `src-tauri/src/commands/preferences.rs:41`:

- `#[tauri::command]` + `#[specta::specta]` annotations
- `initialize_git(path: PathBuf) -> Result<GitInitResult, String>`
- `detect_git_lfs() -> Result<bool, String>` - Check for `git-lfs` binary

**Git Initialization Flow** (creates .gitattributes in PROJECT repo):

1. `Repository::init(path)`
2. Create directories: `context/`, `decisions/`, `experiments/`
3. **Create `.gitattributes` in project root** with LFS rules for large files only:
   ```
   context/**/*.pdf filter=lfs diff=lfs merge=lfs -text
   context/**/*.xlsx filter=lfs diff=lfs merge=lfs -text
   ```
   (CSV excluded - rarely >10MB, avoid LFS overhead)
4. Check LFS availability with `detect_git_lfs()`
5. Initial commit with README

**Command Registration** (critical per Codex review):

- Add modules to `src-tauri/src/commands/mod.rs`
- **MUST** register in `src-tauri/src/bindings.rs` collect_commands! macro
- Run `cargo test export_bindings -- --ignored` to generate TS types

**React UI**: Use shadcn Dialog from `src/components/ui/dialog.tsx`:

- Project selector dropdown (loads from Convex projects query)
- Name input validation (required, max 50 chars)
- Location picker using `@tauri-apps/plugin-dialog`
- LFS status indicator after Git initialization

**Service Layer**: Create `src/services/projects.ts` with TanStack Query:

- `useCurrentProject()` query from Convex
- `useCreateProject()` mutation (Convex + Git init)
- Follow wrapper pattern from `src/services/convex-wrapper.ts`

## Key Context

<!-- Updated by plan-sync: fn-1.1 used Clerk auth (clerkUserId: v.string()) not @convex-dev/auth -->
- **Convex Integration**: Use existing projects table (clerkUserId now available via Clerk from Task 1 - use `useUser()` hook to get `user.id`)
- **.gitattributes location**: Created in PROJECT repo during git init (NOT repo root)
- **LFS rules**: PDF and Excel only (CSV excluded to avoid LFS overhead for small files)
- **LFS detection**: Use `Command::new("git-lfs").arg("version")` to check availability
- **Command registration**: MUST update bindings.rs, not just mod.rs (Codex critical issue)
- **Git initialization**: Use git2 `Repository::init()` per github-scout findings

## Acceptance

- [ ] project-store loads from EXISTING Convex projects table
- [ ] initialize_git command creates directories + .gitattributes IN PROJECT REPO
- [ ] .gitattributes has LFS rules for PDF and Excel only (NOT CSV)
- [ ] detect_git_lfs checks for git-lfs binary
- [ ] Commands registered in bindings.rs
- [ ] TypeScript bindings generated
- [ ] Project selector UI uses Convex query
- [ ] LFS warning shown if not installed
- [ ] Initial commit created successfully

## Done summary
Implemented minimal project creation with Git initialization. Created Zustand project store following selector pattern, Rust commands with directory validation, Convex queries/mutations with proper auth, and ProjectSelector UI with TanStack Query integration. Fixed auth config, added empty directory validation, and optimized creation flow (Convex first, then Git).
## Evidence
- Commits:
- Tests:
- PRs:
