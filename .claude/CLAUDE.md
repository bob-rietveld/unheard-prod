# Claude Code Instructions

## Quick Start

- **Architecture & Patterns**: Read @AGENTS.md for all development instructions
- **Implementation Plan**: See `.claude/plans/` for complete 8-week roadmap
- **Task Tracking**: See `.flow/` for epics, tasks, and specs
- **Developer Docs**: See `docs/developer/` for patterns and guides
- **Local Status**: @CLAUDE.local.md (if exists)

## Current Project Status

**Phases 1-2 of 5 are complete.** Phase 3 (Cloud Execution) is next.

```
Phase 1 (Weeks 1-2): Context Upload        ✅ Done (7/7 tasks)
Phase 2 (Weeks 3-4): Chat + Agent           ✅ Done (7/7 tasks)
Phase 3 (Weeks 5-6): Cloud Execution        ⬜ Not started
Phase 4 (Week 7):    Results & Viz          ⬜ Not started
Phase 5 (Week 8):    Iteration & Polish     ⬜ Not started
```

### What Works Today

- **Auth**: Clerk sign-in integrated with Convex
- **Projects**: Create, select, persist selection across sessions
- **Chat**: Streaming Claude API responses, message history persisted to Convex
- **Context Upload**: Drag-and-drop CSV/PDF/Excel, Rust parsing, Convex sync
- **Templates**: 3 seed templates (investor, pricing, roadmap), intent classification
- **Config Wizard**: Sequential question flow with validation
- **Decision Logs**: Markdown generation with YAML frontmatter, git auto-commit
- **Experiment Config**: YAML generation from template + wizard answers (new)
- **Error Handling**: Error boundaries, retry logic, offline queue
- **i18n**: English, French, Arabic with RTL support
- **Preferences**: Theme (light/dark/system), language, keyboard shortcuts

### Key Integration Flow

```
Chat → Intent Classifier → Template Selection → ConfigWizard
  → Decision Log (.md) + Experiment Config (.yaml) → Git commit → Convex
```

## Implementation Plans

The `.claude/plans/` directory contains implementation documentation:

### Core Documents (Current Architecture)

1. **plans/README.md** - Overview, tech stack, architecture diagram
2. **plans/IMPLEMENTATION-PRIORITY.md** - Master guide with day-by-day tasks
3. **plans/FINAL-SUMMARY.md** - Executive summary, metrics, market opportunity
4. **plans/architecture-decision.md** - Why Tauri, Claude SDK, Modal, Git (ADR)
5. **plans/template-system-spec.md** - Template-driven system details
6. **plans/git-integration-spec.md** - Git/GitHub integration workflows
7. **plans/data-models-spec.md** - Convex schemas, TypeScript types
8. **plans/vertical-slice-implementation.md** - Detailed phase breakdowns

### Reference Documents (Moved Here for Context)

- **plans/DESIGN_IMPROVEMENTS.md** - Dieter Rams design system notes
- **plans/MULTI_CHAT_SYSTEM.md** - Multi-chat implementation record
- **plans/SODT_PATTERNS_APPLIED.md** - SODT design patterns reference

### Legacy Documents (Superseded - Banners Added)

These reference old architecture (Electron/Mastra/GPT-4o). Each has a legacy banner.

- plans/enhanced-assistant-spec.md
- plans/context-pipeline-implementation.md
- plans/architecture-diagrams.md
- plans/context-system-addendum.md
- plans/dataset-extraction-spec.md
- plans/complete-data-pipeline.md
- plans/eager-percolating-star.md
- plans/unheard-electron-plan.md
- plans/unheard-ux-first-plan.md

## Developer Documentation

Key docs in `docs/developer/`:

- **architecture-guide.md** - Mental models, security, anti-patterns
- **experiment-config-spec.md** - YAML experiment config schema (new)
- **state-management.md** - State onion, getState() pattern
- **chat-system.md** - Chat architecture and streaming
- **tauri-commands.md** - Adding new Rust commands
- **static-analysis.md** - Linting tools and quality gates
- **design-system.md** - Dieter Rams-inspired UI patterns

## Known Issues & Tech Debt

### Pre-existing Lint Errors (29 total, not blocking)

Most are in Phase 2 code and should be addressed before Phase 3:
- `ContextSection.tsx` - Conditional hook call, type vs interface
- `ChatListSkeleton.tsx` - Math.random in render (impure function)
- `ErrorMessage.tsx` - setState in effect
- `ChatMessages.tsx` - setState in effect
- `ErrorBoundary.test.tsx` - Empty arrow functions
- `retry-queue.test.ts` - Non-null assertions, dynamic delete
- `error-handlers.ts` - prefer-const
- `services/decisions.ts` - Non-null assertions

### Architecture Notes

- **ConfigWizard is wired up** but only triggers when `currentTemplateId` is set in the chat store. The template selection flow from chat → wizard needs the agent to set this.
- **Right sidebar toggle is hidden** until Phase 4 adds content.
- **Experiment config YAML** is generated but not yet consumed (Phase 3 Modal integration).
- **3 different Convex data patterns** in services/ (raw hooks, TanStack+useConvex, TanStack+useConvexMutation) - should standardize.

## When Working on Implementation

1. **Check .flow/**: See `.flow/epics/` for current phase status, `.flow/tasks/` for task details
2. **Follow architecture**: Use patterns from @AGENTS.md
3. **Reference specs**: `docs/developer/` has detailed patterns and guides
4. **Run checks**: `npm run check:all` after significant changes
5. **Demo regularly**: Each phase has success criteria and demo scripts
