# Phase 2: Chat Interface + Agent

## Overview

Enable founders to make decisions through conversational AI. Users describe their decision in natural language, and a Claude-powered agent guides them through template selection and configuration, then automatically creates a decision log ready for experimentation.

**Duration**: Weeks 3-4 (14 days, follows Phase 1)
**Stack**: React 19, Tauri v2, Rust (reqwest for HTTP), Zustand v5, TanStack Query, Convex, shadcn/ui components

**Goal**: Conversational decision-making works end-to-end (user describes problem → agent configures experiment → decision log created).

## Scope

### In Scope

- **Chat UI**: Claude Desktop-style interface with message bubbles, streaming responses, input area
- **Claude API Integration**: Rust backend calls Claude API via reqwest with streaming (SSE)
- **Agent System**: Intent classification, template recommendation, guided configuration wizard
- **Template Library**: 3 core templates in Convex (Investor Evaluation, Pricing Strategy, Product Roadmap)
- **Decision Log Generation**: Auto-create markdown in `/decisions/`, Git auto-commit
- **State Management**: New `useChatStore` (Zustand) for ephemeral conversation state
- **Context Integration**: Agent accesses uploaded context files from Phase 1
- **Error Handling**: API failures, rate limits, offline mode, validation errors
- **Internationalization**: UI strings use i18n keys (English translations only for Phase 2)

### Out of Scope (Phase 3+)

- Multi-user conversations
- Conversation persistence in Convex (Phase 4)
- Voice input
- Advanced markdown rendering (code syntax highlighting, LaTeX)
- Template marketplace or custom template builder (Phase 5)
- Conversation search
- Export to formats other than markdown
- Mobile-optimized chat UI
- Multi-language translations (English only in Phase 2, infrastructure ready for Phase 3)
- E2E test automation (manual scripts only in Phase 2)
- Debug mode UI (logs only)
- **Template customization UI** (Phase 3)
- **Conditional template logic** (Phase 3)
- **Configuration resume after crashes** (Phase 3)
- **Ambiguous input interpretation options** (Phase 3)
- **Sensitive data scanning** (Phase 3)
- **Conversation export** (Phase 4 with persistence)
- **Context file summary on demand** (Phase 3)
- **Configuration history sidebar** (Phase 3)
- **Filename conflict prompts** (Phase 3 - auto-append for Phase 2)
- **Manual file edit detection** (Phase 3)

### Key Assumptions (from Gap Analysis)

1. **API Key Security**: API key stored in Rust backend (read from environment variable). Tauri command proxies all Claude API calls.
2. **Chat Entry**: Chat replaces `MainWindowContent` as primary view (not modal/sidebar)
3. **Conversation Persistence**: Ephemeral for Phase 2 (Zustand only). **No `conversations` table** in Phase 2. Convex persistence deferred to Phase 4.
4. **Template Count**: 3 templates for MVP (Investor, Pricing, Roadmap). Others in Phase 5.
5. **Streaming Responses**: Yes, stream token-by-token for better UX via Rust SSE parser
6. **Context Access**: Agent automatically accesses ALL uploaded context files (full content, not summarized)
7. **Error Recovery**: "Try Again" button inline in chat messages
8. **Configuration Progress**: No back-button - users confirm each step before proceeding

## Approach

**Architecture Pattern**:

```
User types message in ChatInput
  ↓
useChatStore adds message (role: user)
  ↓
Call Tauri command: send_chat_message(message, conversationHistory)
  ↓ Rust backend
Rust: Build Claude API request with ANTHROPIC_API_KEY from env
Rust: POST to api.anthropic.com/v1/messages (stream: true) via reqwest
Rust: Parse SSE stream, emit tokens via Tauri Channel
  ↓ emit progress events to frontend
Frontend: Accumulate tokens in useChatStore (streaming state)
  ↓
ChatMessages component re-renders with new tokens
  ↓
On stream complete: Analyze if agent selected template
  ↓ If template selected → show TemplateConfigWizard
Configuration flow: Agent asks questions → user answers → validate
  ↓ All questions answered
Generate config object + decision summary
  ↓
Create markdown file via Tauri command: create_decision_log(config)
  ↓ Rust: write to /decisions/, git commit (reuse Phase 1 git_auto_commit)
Update Convex: mutation api.decisions.updateWithLog(decisionData)
  ↓
Agent: "Decision log created! View at decisions/2026-02-04-investor-evaluation.md"
```

**Key Technical Decisions**:

1. **API Key Location**: Rust backend only. Read from `ANTHROPIC_API_KEY` environment variable. Frontend never sees the key.

2. **No @anthropic-ai/sdk**: Use Rust `reqwest` with SSE parsing. No Node.js SDK dependency.

3. **Chat State**: Zustand store with selector pattern (ast-grep enforced)

   ```typescript
   const messages = useChatStore(state => state.messages) // GOOD
   const { messages } = useChatStore() // BAD - banned
   ```

4. **Streaming Implementation**: Tauri command with Channel for token streaming (no UI freeze)

   ```rust
   #[command]
   async fn send_chat_message(
       message: String,
       history: Vec<ChatMessage>,
       system_prompt: String,
       channel: Channel,
   ) -> Result<ChatResponse>
   ```

5. **Template Storage**: Templates stored as YAML in Convex `experimentTemplates` table. Agent fetches via `api.templates.list()` query.

6. **Decision Log Storage**: Extend existing Convex `decisions` table with new fields (backward compatible). New fields: `markdownFilePath`, `templateId`, `configData`. Existing status values preserved, new ones added.

7. **Error Boundaries**: React error boundaries catch rendering errors. API errors shown inline with retry.

8. **Agent Prompts**: Modular system prompt in separate version-controlled file (`prompts/agent-system.md`) with 4 sections:
   - Role definition (decision support assistant)
   - Available templates (dynamic from Convex)
   - Conversation guidelines (clarifying questions, validation)
   - Output format (JSON for tool calls, natural language for chat)

9. **Command Registration**: All Tauri commands registered in `src-tauri/src/bindings.rs` using `tauri-specta` pattern.

10. **Internationalization**: All UI strings use i18n keys via `useTranslation()` hook and `locales/en.json`. English-only translations in Phase 2, infrastructure ready for Phase 3+ languages.

**Reuse Patterns** (from repo-scout):

- **Zustand devtools**: Follow `src/store/ui-store.ts:1-86` pattern
- **TanStack Query**: Follow `src/services/preferences.ts:1-64` pattern (queryKeys, hooks)
- **Tauri commands**: Register in `src-tauri/src/bindings.rs`, use `tauri-specta` bindings from `src/lib/tauri-bindings.ts`
- **Git commands**: Extend `git_auto_commit` from Phase 1 for decision logs
- **Convex mutations**: Follow `convex/schema.ts` patterns with indexes
- **i18n**: Follow existing `src/i18n/config.ts` pattern with `useTranslation()` hook

## Key Decisions (from Interview) - Phase 2 Core

### User Experience (Core MVP)

1. **Concurrent Input**: Allow typing while streaming, queue message for after stream completes
2. **Stream Cancellation**: Discard partial response and clear (simple approach for Phase 2)
3. **Progress Indication**: Show typing indicator (animated dots) + estimated time remaining during streaming
4. **Stream Recovery**: On errors, discard partial response and auto-retry
5. **Template Flexibility**: Allow free-form decisions without selecting a template
6. **Template Presentation**: Agent suggests 1-2 best matches based on user description
7. **Empty State**: Greeting with suggested prompts: "Hello! I can help you with decisions. Try asking about..."
8. **Conversation Reset**: Confirm before clearing if unsaved changes exist

### Configuration Flow (Core MVP)

9. **Simple Linear Wizard**: Questions asked sequentially, no edit-previous capability in Phase 2
10. **Validation Errors**: Agent explains conversationally with specific examples
11. **No Resume Support**: If app crashes, conversation lost (ephemeral Zustand only)

### Security & Data (Core MVP)

12. **Context Passing**: Pass full context file content to Claude API (simple approach for Phase 2, summarization deferred to Phase 3)

### Error Handling & Resilience (Core MVP)

13. **API Rate Limits**: Auto-retry with exponential backoff (1s, 2s, 4s...)
14. **Opaque Errors**: Show generic retry prompt without technical details
15. **Offline Mode**: Block decision creation with clear error (queuing deferred to Phase 3)
16. **Git Failures**: Show error message, decision log file saved but not committed (degraded mode)
17. **Filename Conflicts**: Auto-append numeric suffix silently (e.g., "Investor Evaluation 2")
18. **Duplicate Titles**: Auto-append numeric suffix (e.g., "Investor Evaluation 2")
19. **Large Files**: No size limit in Phase 2 (trust Git, warn deferred to Phase 3)
20. **Template YAML Errors**: Validate on seed, block publish of malformed templates

### Quality & Testing (Core MVP)

21. **Test Coverage**: >80% unit test coverage for chat store, agent logic, and utilities
22. **Test Strategy**: Use real APIs (Claude, Convex) in integration tests with test accounts
23. **E2E Tests**: Manual test script only (defer automated E2E to Phase 3+)

### Localization & Accessibility (Core MVP)

24. **i18n**: Use i18n keys for all UI strings, English translations only for Phase 2
25. **Keyboard Navigation**: Arrow keys navigate message history, Tab through fields, Escape cancels streaming, Cmd/Ctrl+Enter sends
26. **Screen Readers**: Full ARIA annotations for proper screen reader support
27. **Performance**: Initial agent response < 3 seconds (show loading indicator)

## Data Model Changes

### Convex Schema Updates

```typescript
// convex/schema.ts - ADD these tables

experimentTemplates: defineTable({
  name: v.string(),
  slug: v.string(),
  category: v.string(), // 'investor' | 'pricing' | 'roadmap' | 'hiring' | 'operations'
  description: v.string(),
  yamlContent: v.string(), // Full YAML template definition
  version: v.string(),
  isPublished: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_slug', ['slug'])
  .index('by_category', ['category', 'isPublished']),

// NOTE: conversations table NOT added in Phase 2 (deferred to Phase 4)
// Conversations are ephemeral in Zustand only

// EXTEND existing decisions table (backward compatible)
decisions: defineTable({
  title: v.string(),
  description: v.optional(v.string()),
  status: v.union(
    v.literal('draft'),
    v.literal('analyzing'),
    v.literal('decided'),
    // NEW Phase 2 statuses (backward compatible):
    v.literal('ready'),
    v.literal('running'),
    v.literal('completed')
  ),
  projectId: v.optional(v.id('projects')),
  clerkUserId: v.string(), // Existing field from Phase 1 - preserved for Clerk auth
  createdAt: v.number(),
  // NEW Phase 2 fields:
  templateId: v.optional(v.id('experimentTemplates')),
  configData: v.optional(v.any()), // JSON configuration from template wizard
  markdownFilePath: v.optional(v.string()), // Relative path: decisions/2026-02-04-slug.md
  updatedAt: v.optional(v.number()),
})
  .index('by_user', ['clerkUserId'])
  .index('by_project', ['projectId'])
  .index('by_template', ['templateId']), // NEW index
```

### Decision Log Markdown Format

```markdown
---
id: dec-2026-02-04-investor-eval
title: Seed Fundraising Decision
category: investor-evaluation
template: investor-evaluation-v1
status: ready
created: 2026-02-04T14:30:00Z
---

# Seed Fundraising Decision

## Context

Evaluating investor interest for seed round ($2M raise).

## Configuration

- **Stage**: Seed
- **Amount**: $2M
- **Industry**: Developer Tools
- **Current MRR**: $50K
- **Pitch Summary**: AI-powered decision support for founders...

## Experiment Plan

- **Personas**: 10 investors (5 Seed VCs, 3 Angels, 2 Strategic)
- **Generated from**: customers.csv (500 rows), pitch-deck.pdf

## Results

(To be filled after experiment runs)

## Decision

(To be made after reviewing results)

---

Auto-generated by Unheard v2 | Phase 2
```

### Zustand Store

```typescript
// src/store/chat-store.ts - NEW file

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status?: 'sending' | 'streaming' | 'complete' | 'error'
}

interface ChatState {
  // State
  messages: ChatMessage[]
  isStreaming: boolean
  streamingMessageId: string | null
  currentTemplateId: string | null
  configAnswers: Record<string, any>
  error: string | null
  queuedMessage: string | null // For concurrent input handling

  // Actions
  addMessage: (message: ChatMessage) => void
  updateStreamingMessage: (id: string, content: string) => void
  completeStreaming: (id: string) => void
  setError: (error: string | null) => void
  setTemplate: (templateId: string | null) => void
  updateConfigAnswer: (key: string, value: any) => void
  resetConversation: () => void
  queueMessage: (message: string) => void
  dequeueMessage: () => string | null
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      messages: [],
      isStreaming: false,
      streamingMessageId: null,
      currentTemplateId: null,
      configAnswers: {},
      error: null,
      queuedMessage: null,

      addMessage: message =>
        set(s => ({
          messages: [...s.messages, message],
        })),

      // ... other actions
    }),
    { name: 'chat-store' }
  )
)
```

## Edge Cases Discovered (Phase 2 Scope)

1. **Concurrent Input**: User types while agent streams → queue message in `useChatStore`, send after stream completes
2. **Stream Interruption**: Network drops mid-stream → discard partial, show auto-retry with exponential backoff
3. **Template Rejection**: User rejects template → allow free-form decision creation
4. **Filename Collision**: Two decisions with same title → append numeric suffix automatically (Title 2, Title 3)
5. **Offline Decision Creation**: No network during creation → show clear error, block action (no queueing in Phase 2)
6. **Rate Limit Cascade**: Multiple requests hit rate limit → exponential backoff per request, don't cascade
7. **Template YAML Corruption**: Admin uploads malformed YAML → validate on seed, block publish with clear error
8. **Git Commit Failure**: .git directory missing or locked → show error, file saved but not committed
9. **Context File Access**: Agent needs context → pass all files to API in system prompt (no summarization in Phase 2)
10. **Empty State Navigation**: First-time user clicks chat → show greeting + 3 example prompts

## Quick commands

```bash
# NO npm install @anthropic-ai/sdk (Rust handles API calls)

# Add Rust dependencies
cd src-tauri && cargo add reqwest tokio-stream serde_json eventsource-stream

# Seed templates to Convex
npx convex run seed:templates

# Run chat component tests
npm run test src/components/chat/ChatInterface.test.tsx
npm run test src/store/chat-store.test.ts

# Test Tauri chat command
cargo test --lib commands::chat::tests

# Manual smoke test
npm run tauri:dev
# 1. Click "New Decision" in UI
# 2. Type: "Should I raise seed or bootstrap?"
# 3. Verify streaming response appears
# 4. Select template when offered
# 5. Answer configuration questions
# 6. Verify decision log created in /decisions
# 7. Check Git: git log --oneline (should see auto-commit)
# 8. Check Convex dashboard: decisions table has new entry
```

## Acceptance (Phase 2 MVP)

**Phase 2 Complete When**:

- [ ] Chat UI renders with message list and input area
- [ ] User can type message and send (Enter key or button)
- [ ] Cmd/Ctrl+Enter keyboard shortcut sends message
- [ ] Arrow keys navigate message history for editing
- [ ] Rust command `send_chat_message` calls Claude API (API key from env)
- [ ] Streaming responses render token-by-token via Tauri Channel
- [ ] Progress indicator: typing dots + estimated time remaining
- [ ] Concurrent input: typing while streaming queues message
- [ ] Escape key cancels streaming, discards partial response
- [ ] Agent analyzes user input and suggests template
- [ ] Template library displays 3 core templates from Convex
- [ ] User can select template from agent suggestion
- [ ] User can skip template and create free-form decision
- [ ] Configuration wizard renders questions sequentially
- [ ] Validation errors explained conversationally with specific examples
- [ ] User answers validated before proceeding to next question
- [ ] All questions answered → decision summary generated
- [ ] Decision log markdown file created in `/decisions`
- [ ] Duplicate titles auto-append numeric suffix silently (Title 2, Title 3)
- [ ] Git auto-commits decision log (reuses Phase 1 `git_auto_commit`)
- [ ] Git failures: show error message (degraded mode)
- [ ] Convex mutation updates `decisions` table with new fields
- [ ] Offline mode: clear error blocks decision creation
- [ ] Empty state: greeting with suggested example prompts
- [ ] "New Decision" button confirms if unsaved changes exist
- [ ] Error states: API failure shows "Try Again" button (generic message)
- [ ] Error states: Rate limit auto-retries with exponential backoff
- [ ] Conversation resets with "New Decision" button
- [ ] Full ARIA annotations for screen reader support
- [ ] Performance: initial agent response < 3 seconds
- [ ] Template YAML validation on seed (blocks malformed templates)
- [ ] System prompt in version-controlled file (`prompts/agent-system.md`)
- [ ] Context files passed fully to API (no summarization in Phase 2)
- [ ] All UI strings use i18n keys from `locales/en.json`
- [ ] ast-grep passes (Zustand selectors enforced)
- [ ] All unit tests pass (>80% coverage for chat logic)
- [ ] Manual E2E test passes: full flow from greeting to decision log
- [ ] Documentation: Chat UI patterns added to `docs/developer/`
- [ ] Documentation: i18n keys documented for Phase 2 strings

**Demo Script** (for stakeholder review):

```
1. Open Unheard → Chat is primary view with greeting
2. Type: "I need to decide if I should raise seed funding or bootstrap"
3. Agent streams response: "I can help with that..."
4. Agent suggests: "Investor Evaluation template"
5. User clicks "Use This Template"
6. Agent asks: "What stage are you at?"
7. User answers: "Seed, raising $2M"
8. Agent asks: "What's your industry?"
9. User answers: "Developer tools"
10. Agent asks: "Current MRR?"
11. User answers: "$50K"
12. Agent asks: "Summarize your pitch in 2-3 sentences"
13. User provides pitch
14. Agent: "Great! I've created a decision log and configured an experiment..."
15. Check: decision log exists in decisions/ directory
16. Check: Git log shows auto-commit
17. Check: Convex dashboard shows updated decision entry
Total time: <3 minutes
```

## Risks & Mitigations

| Risk                           | Impact                                  | Mitigation                                                                 |
| ------------------------------ | --------------------------------------- | -------------------------------------------------------------------------- |
| **Claude API rate limits**     | Users blocked mid-conversation          | Auto-retry with exponential backoff, no user-facing countdown              |
| **SSE parsing complexity**     | Streaming bugs, missed tokens           | Use battle-tested `eventsource-stream` crate, comprehensive tests          |
| **Token context overflow**     | Long conversations exceed Claude limits | Implement sliding window (keep last 20 messages), summarize older context  |
| **Streaming interruptions**    | Partial responses, corrupted state      | Discard partial, auto-retry                                                |
| **Template YAML errors**       | Agent cannot parse templates            | Validate YAML on seed, unit tests for parser, block publish                |
| **Git conflicts**              | Concurrent decision log writes          | Use unique filenames (timestamp + slug), atomic file writes                |
| **Convex schema migration**    | Breaking existing decisions             | Backward compatible fields (all new fields optional), migration plan       |
| **UI freeze during streaming** | Poor UX, app feels slow                 | Mandatory Tauri Channels, debounced React re-renders                       |
| **ast-grep violations**        | Destructuring Zustand in new code       | Pre-commit hook runs ast-grep, CI gate blocks PRs                          |
| **i18n key conflicts**         | Duplicate or missing keys               | Validate i18n keys in tests, lint check for missing translations           |

## References

**Existing Patterns**:

- Zustand store: `src/store/ui-store.ts:1-86`
- TanStack Query: `src/services/preferences.ts:1-64`
- Tauri bindings: `src-tauri/src/bindings.rs:1-48`
- Git commands: Phase 1 spec `git_auto_commit` (fn-1, task 5)
- Error handling: `docs/developer/error-handling.md`
- State management: `docs/developer/state-management.md`
- Convex schema: `convex/schema.ts` (existing decisions table)
- i18n patterns: `src/i18n/config.ts`, `locales/en.json`

**External Docs**:

- [Claude API Streaming](https://platform.claude.com/docs/en/api/messages-streaming)
- [React 19 Hooks](https://react.dev/blog/2024/12/05/react-19)
- [Zustand v5 Selectors](https://zustand.docs.pmnd.rs/guides/auto-generating-selectors)
- [Convex Real-time](https://docs.convex.dev/realtime)
- [Template System Spec](.claude/plans/template-system-spec.md)
- [Tauri v2 IPC Channels](https://v2.tauri.app/reference/javascript/api/ipc/#channel)
- [Rust eventsource-stream](https://docs.rs/eventsource-stream/)

**Implementation Plans**:

- Detailed day-by-day: `.claude/plans/IMPLEMENTATION-PRIORITY.md` lines 266-548
- Enhanced agent spec: `.claude/plans/enhanced-assistant-spec.md`
- Data models: `.claude/plans/data-models-spec.md`

## Phase 3 Features (Deferred from Interview)

These features were identified in the interview but are out of scope for Phase 2 MVP:

1. **Template Customization**: AI agent-guided template customization UI
2. **Conditional Questions**: `depends_on` logic in template YAML
3. **Configuration Resume**: localStorage persistence across crashes
4. **Ambiguous Input Options**: Multiple interpretation buttons
5. **Sensitive Data Scanning**: Detect and warn about API keys/secrets
6. **Conversation Export**: JSON export for reimport
7. **Context File Summarization**: Metadata-only passing with on-demand fetch
8. **Configuration History Sidebar**: Collapsible panel showing previous answers with edit capability
9. **Filename Conflict Prompts**: User choice to rename or overwrite
10. **Manual File Edit Detection**: Git status check with re-sync option
11. **Large File Warnings**: Truncate prompt for >10K line decision logs
12. **Offline Queueing**: localStorage queue with sync when connection restored
13. **Answer Editing**: Edit previous configuration answers during wizard
14. **Template Rejection Tracking**: Offer free-form after 2 rejections
15. **Context Hints**: Subtle template suggestions based on uploaded files
