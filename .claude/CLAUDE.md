# Claude Code Instructions

## Quick Start

- **Architecture & Patterns**: Read @AGENTS.md for all development instructions
- **Implementation Plan**: See `.claude/plans/` for complete 8-week roadmap
- **Task Tracking**: See `.flow/` for epics, tasks, and specs
- **Developer Docs**: See `docs/developer/` for patterns and guides
- **Local Status**: @CLAUDE.local.md (if exists)

## Current Project Status

**Phases 1-3 of 5 are complete.** Phase 4 (Results & Viz) is next.

```
Phase 1 (Weeks 1-2): Context Upload        ✅ Done (7/7 tasks)
Phase 2 (Weeks 3-4): Chat + Agent           ✅ Done (7/7 tasks)
Phase 3 (Weeks 5-6): Cloud Execution        ✅ Done (Modal + flow wiring)
Phase 4 (Week 7):    Results & Viz          ⬜ Not started
Phase 5 (Week 8):    Iteration & Polish     ⬜ Not started
```

### What Works Today

- **Auth**: Clerk sign-in integrated with Convex
- **Projects**: Create, select, persist selection across sessions
- **Chat**: Streaming Claude API responses with context-aware system prompt, message history persisted to Convex
- **Auto-Chat**: Chat auto-creates/selects when project is selected (no dead-end screens)
- **Intent Classification**: Keyword-based detection of decision questions, template suggestions shown inline
- **Context Upload**: Drag-and-drop CSV/PDF/Excel, Rust parsing, Convex sync
- **Templates**: 3 seed templates (investor, pricing, roadmap), intent classification
- **Config Wizard**: Sequential question flow with validation
- **Decision Logs**: Markdown generation with YAML frontmatter, git auto-commit
- **Experiment Config**: YAML generation from template + wizard answers
- **Experiment Execution**: Modal API integration with NDJSON streaming, real-time progress UI
- **Experiment Results**: Sentiment breakdown, persona results, execution stats
- **Error Handling**: Error boundaries, retry logic, offline queue
- **i18n**: English, French, Arabic with RTL support
- **Preferences**: Theme (light/dark/system), language, keyboard shortcuts

### Key Integration Flow (End-to-End)

```
Project Selected → Auto-create Chat → User types decision question
  → Claude responds (system prompt with templates)
  → Intent Classifier → Template Suggestion card
  → User clicks "Start Template" → ConfigWizard
  → Decision Log (.md) + Experiment Config (.yaml) → Git commit → Convex
  → "Run Experiment" → Modal API → Streaming progress
  → ExperimentSummary with sentiment breakdown
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

- **Right sidebar toggle is hidden** until Phase 4 adds content.
- **3 different Convex data patterns** in services/ (raw hooks, TanStack+useConvex, TanStack+useConvexMutation) - should standardize.
- **Seed templates required**: Run `npx convex run seed:templates` to populate Convex DB. Without templates, system prompt and intent classifier have nothing to work with.

## Integration-First Development (CRITICAL)

**Every feature MUST be wired into the user-facing workflow before it is considered complete.**

This rule exists because Phase 2 built many components (intent classifier, system prompts, templates, config wizard) that were never connected to the chat flow. The code existed but was unreachable by users. This wasted significant time in later phases to diagnose and fix.

### The Rule

When building a new feature:

1. **Trace the user path**: Before writing code, identify exactly how a user reaches this feature. What do they click? What triggers it? What do they see?
2. **Wire it in the same PR**: The feature code AND its integration into the existing UI/workflow must ship together. Never merge a feature that can only be triggered from a test or debug console.
3. **Verify with a walkthrough**: After implementation, manually trace the flow from app launch to the new feature. If any step requires setting state manually or calling a function from devtools, the wiring is incomplete.
4. **No orphaned exports**: If you build `classifyIntent()`, it must be called somewhere in the app. If you build `buildSystemPrompt()`, it must be passed to the API. If you build a component, it must be rendered in a route or parent component.

### Anti-Patterns to Avoid

```typescript
// ❌ BAD: Feature exists but is never triggered
export function classifyIntent(...) { ... }  // Built in Phase 2
// ... but never called from ChatInterface until Phase 3 fix

// ❌ BAD: Passing null/placeholder where real data should go
commands.sendChatMessage(content, history, null, channel)  // system_prompt = null

// ❌ BAD: Store action exists but is only called with null
setTemplate(null)  // setTemplate(templateId) never called with a real ID

// ❌ BAD: Component built but parent never renders it
export function TemplateSuggestion(...) { ... }  // Exists but never imported

// ✅ GOOD: Feature + integration in the same change
// 1. Build classifyIntent()
// 2. Call it in ChatInterface after streaming completes
// 3. Render TemplateSuggestion when suggestions found
// 4. Wire "Start Template" to setTemplate(id)
// All in one PR.
```

### Checklist for Each Feature

- [ ] User can reach this feature through normal app usage (no devtools)
- [ ] Data flows from source to destination (no null placeholders)
- [ ] UI components are rendered in the component tree (not just exported)
- [ ] Store actions are called with real values (not just null/undefined)
- [ ] Event handlers are connected (onClick, onComplete, etc.)
- [ ] Test the flow: launch app → reach feature in < 5 clicks

## When Working on Implementation

1. **Check .flow/**: See `.flow/epics/` for current phase status, `.flow/tasks/` for task details
2. **Follow architecture**: Use patterns from @AGENTS.md
3. **Reference specs**: `docs/developer/` has detailed patterns and guides
4. **Run checks**: `npm run check:all` after significant changes
5. **Demo regularly**: Each phase has success criteria and demo scripts
6. **Verify integration**: Trace the user path from app launch to the new feature before marking done
