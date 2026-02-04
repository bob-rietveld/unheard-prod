# Claude Code Instructions

## Quick Start

- **Architecture & Patterns**: Read @AGENTS.md for all development instructions
- **Implementation Plan**: See `.claude/plans/` for complete 8-week roadmap
- **Local Status**: @CLAUDE.local.md (if exists)

## Implementation Plans

The `.claude/plans/` directory contains comprehensive implementation documentation:

### Start Here (Priority Order)

1. **plans/README.md** - Complete overview, tech stack, architecture diagram
2. **plans/IMPLEMENTATION-PRIORITY.md** - Master guide with day-by-day tasks for all 5 phases
3. **plans/FINAL-SUMMARY.md** - Executive summary, metrics, market opportunity

### Core Specifications

4. **plans/architecture-decision.md** - Why Tauri, Claude SDK, Modal, Git (ADR)
5. **plans/template-system-spec.md** - Template-driven system details
6. **plans/git-integration-spec.md** - Git/GitHub integration workflows
7. **plans/data-models-spec.md** - Convex schemas, TypeScript types
8. **plans/vertical-slice-implementation.md** - Detailed phase breakdowns with code examples

### Supporting Documentation

- **plans/enhanced-assistant-spec.md** - Claude SDK agent implementation
- **plans/context-pipeline-implementation.md** - Context upload/parsing system
- **plans/dataset-extraction-spec.md** - Data extraction methodology
- **plans/architecture-diagrams.md** - Visual architecture documentation

### Legacy/Reference

- **plans/unheard-electron-plan.md** - Original Electron plan (superseded by Tauri)
- **plans/unheard-ux-first-plan.md** - UX-first approach (incorporated)
- **plans/eager-percolating-star.md**, **plans/SLICE-9-startup-screening.md** - Earlier iterations

## Development Strategy

**8 Weeks, 5 Phases, Vertical Slices**:

```
Phase 1 (Weeks 1-2): Context Upload → Working end-to-end
Phase 2 (Weeks 3-4): Chat Interface + Agent → Demo-able decision flow
Phase 3 (Weeks 5-6): Cloud Execution → Parallel experiments working
Phase 4 (Week 7): Results & Visualization → Insights + export
Phase 5 (Week 8): Iteration & Polish → Team collaboration + follow-ups
```

**Always have working software. Demo every 2 weeks.**

## When Working on Implementation

1. **Check current phase**: See plans/IMPLEMENTATION-PRIORITY.md for week/day tasks
2. **Follow architecture**: Use patterns from @AGENTS.md
3. **Reference specs**: plans/*.md files have detailed schemas and flows
4. **Demo regularly**: Each phase has success criteria and demo scripts
