# Phase 2: Chat Interface + Agent

## Overview

Enable founders to make decisions through conversational AI. Users describe their decision in natural language, and a Claude-powered agent guides them through template selection and configuration, then automatically creates a decision log ready for experimentation.

**Duration**: Weeks 3-4 (14 days, follows Phase 1)
**Stack**: React 19, Claude SDK (@anthropic-ai/sdk), Zustand v5, TanStack Query, Convex, shadcn/ui components

**Goal**: Conversational decision-making works end-to-end (user describes problem → agent configures experiment → decision log created).

## Scope

### In Scope

- **Chat UI**: Claude Desktop-style interface with message bubbles, streaming responses, input area
- **Claude SDK Integration**: Streaming responses via `.stream()` API with token-by-token rendering
- **Agent System**: Intent classification, template recommendation, guided configuration wizard
- **Template Library**: 3 core templates in Convex (Investor Evaluation, Pricing Strategy, Product Roadmap)
- **Decision Log Generation**: Auto-create markdown in `/decisions/`, Git auto-commit
- **State Management**: New `useChatStore` (Zustand) for conversation state, TanStack Query for persistence
- **Context Integration**: Agent accesses uploaded context files from Phase 1
- **Error Handling**: API failures, rate limits, offline mode, validation errors

### Out of Scope

- Multi-user conversations (future phase)
- Voice input (future)
- Advanced markdown rendering (code syntax highlighting, LaTeX) - basic markdown only
- Template marketplace or custom template builder (Phase 5)
- Conversation search (future)
- Export to formats other than markdown (future)
- Mobile-optimized chat UI (future)
- Multi-language agent responses (English only for Phase 2)

### Key Assumptions (from Gap Analysis)

1. **API Key Security**: For MVP, API key stored in `.env` (frontend). Rust-based proxy for production in Phase 5.
2. **Chat Entry**: Chat replaces `MainWindowContent` as primary view (not modal/sidebar)
3. **Conversation Persistence**: Ephemeral for Phase 2 (Zustand only). Convex persistence in Phase 4.
4. **Template Count**: 3 templates for MVP (Investor, Pricing, Roadmap). Others in Phase 5.
5. **Streaming Responses**: Yes, stream token-by-token for better UX
6. **Context Access**: Agent automatically accesses ALL uploaded context files
7. **Error Recovery**: "Try Again" button inline in chat messages
8. **Configuration Progress**: No back-button - users confirm each step before proceeding

## Approach

**Architecture Pattern**:
```
User types message in ChatInput
  ↓
useChatStore adds message (role: user)
  ↓
Call Claude SDK stream API [Rust command for security]
  ↓ Tauri command: send_chat_message(message, conversationHistory)
Rust: anthropic.messages.stream({ messages, system: AGENT_PROMPT })
  ↓ emit progress via Tauri Channel
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
  ↓ Rust: write to /decisions/, git commit
Update Convex: mutation api.decisions.create(decisionData)
  ↓
Agent: "Decision log created! View at decisions/2026-02-04-investor-evaluation.md"
```

**Key Technical Decisions**:

1. **Chat State**: Zustand store with selector pattern (ast-grep enforced)
   ```typescript
   const messages = useChatStore(state => state.messages) // GOOD
   const { messages } = useChatStore() // BAD - banned
   ```

2. **Streaming Implementation**: Use Tauri command with Channel for token streaming (no UI freeze)
   ```rust
   #[command]
   async fn send_chat_message(
       message: String,
       history: Vec<ChatMessage>,
       channel: Channel,
   ) -> Result<ChatResponse>
   ```

3. **Template Storage**: Templates stored as YAML in Convex `experimentTemplates` table. Agent fetches via `api.templates.list()` query.

4. **Decision Log Format**: Markdown with YAML frontmatter (similar to Obsidian). See data models below.

5. **Error Boundaries**: React error boundaries catch rendering errors. API errors shown inline with retry.

6. **Agent Prompts**: Modular system prompt with 4 sections:
   - Role definition (decision support assistant)
   - Available templates (dynamic from Convex)
   - Conversation guidelines (clarifying questions, validation)
   - Output format (JSON for tool calls, natural language for chat)

**Reuse Patterns** (from repo-scout):

- **Zustand devtools**: Follow `src/store/ui-store.ts:1-86` pattern
- **TanStack Query**: Follow `src/services/preferences.ts:1-64` pattern (queryKeys, hooks)
- **Tauri commands**: Use `tauri-specta` bindings from `src/lib/tauri-bindings.ts`
- **Git commands**: Extend `git_auto_commit` from Phase 1 for decision logs
- **Convex mutations**: Follow `convex/schema.ts` patterns with indexes

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

conversations: defineTable({
  clerkUserId: v.string(),
  projectId: v.id('projects'),
  messages: v.array(v.object({
    id: v.string(),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    timestamp: v.number(),
  })),
  status: v.union(
    v.literal('active'),
    v.literal('completed'),
    v.literal('abandoned')
  ),
  relatedDecisionId: v.optional(v.id('decisions')),
  relatedTemplateId: v.optional(v.id('experimentTemplates')),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_user', ['clerkUserId'])
  .index('by_project', ['projectId']),

decisions: defineTable({
  clerkUserId: v.string(),
  projectId: v.id('projects'),
  title: v.string(),
  category: v.string(),
  templateId: v.optional(v.id('experimentTemplates')),
  configData: v.any(), // JSON configuration from template wizard
  markdownFilePath: v.string(), // Relative path in Git: decisions/2026-02-04-slug.md
  status: v.union(
    v.literal('draft'),
    v.literal('ready'),
    v.literal('running'),
    v.literal('completed')
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index('by_user', ['clerkUserId'])
  .index('by_project', ['projectId'])
  .index('by_template', ['templateId']),
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
  
  // Actions
  addMessage: (message: ChatMessage) => void
  updateStreamingMessage: (id: string, content: string) => void
  completeStreaming: (id: string) => void
  setError: (error: string | null) => void
  setTemplate: (templateId: string | null) => void
  updateConfigAnswer: (key: string, value: any) => void
  resetConversation: () => void
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
      
      addMessage: (message) => set((s) => ({
        messages: [...s.messages, message]
      })),
      
      // ... other actions
    }),
    { name: 'chat-store' }
  )
)
```

## Quick commands

```bash
# Install Claude SDK
npm install @anthropic-ai/sdk

# Add Rust dependencies
cd src-tauri && cargo add reqwest tokio-stream serde_json

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
```

## Acceptance

**Phase 2 Complete When**:

- [ ] Chat UI renders with message list and input area
- [ ] User can type message and send (Enter key or button)
- [ ] Claude SDK integrated via Tauri command (API key in env)
- [ ] Streaming responses render token-by-token (no full-text delay)
- [ ] Agent analyzes user input and suggests template
- [ ] Template library displays 3 core templates
- [ ] User can select template from agent suggestion
- [ ] Configuration wizard renders questions one-by-one
- [ ] User answers validated before proceeding to next question
- [ ] All questions answered → decision summary generated
- [ ] Decision log markdown file created in `/decisions`
- [ ] Git auto-commits decision log (reuses Phase 1 command)
- [ ] Convex mutation saves decision metadata
- [ ] Error states: API failure shows "Try Again" button
- [ ] Error states: Rate limit shows clear message with retry countdown
- [ ] Error states: Network offline shows queued state
- [ ] Conversation resets with "New Decision" button
- [ ] ast-grep passes (Zustand selectors enforced)
- [ ] All unit tests pass (>80% coverage for chat logic)
- [ ] Manual E2E test passes: full flow from greeting to decision log
- [ ] Documentation: 3 new docs created (see docs-gap-scout findings)
- [ ] Documentation: 10 docs updated with Phase 2 patterns

**Demo Script** (for stakeholder review):
```
1. Open Unheard → Chat is primary view
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
17. Check: Convex dashboard shows new decision entry
Total time: <3 minutes
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Claude API rate limits** | Users blocked mid-conversation | Implement exponential backoff, show retry countdown, cache responses |
| **API key in frontend** | Security concern for production | Document as MVP limitation, plan Rust proxy for Phase 5 |
| **Token context overflow** | Long conversations exceed Claude limits | Implement sliding window (keep last 20 messages), summarize older context |
| **Streaming interruptions** | Partial responses, corrupted state | Implement abort controller, retry logic, partial content recovery |
| **Template YAML errors** | Agent cannot parse templates | Validate YAML on seed, unit tests for parser, fallback to default template |
| **Git conflicts** | Concurrent decision log writes | Use unique filenames (timestamp + slug), atomic file writes |
| **Convex mutation failures** | Decision saved to Git but not cloud | Implement retry queue in localStorage, background sync |
| **UI freeze during streaming** | Poor UX, app feels slow | Mandatory Tauri Channels, debounced React re-renders |
| **ast-grep violations** | Destructuring Zustand in new code | Pre-commit hook runs ast-grep, CI gate blocks PRs |

## References

**Existing Patterns**:
- Zustand store: `src/store/ui-store.ts:1-86`
- TanStack Query: `src/services/preferences.ts:1-64`
- Tauri commands: `src-tauri/src/commands/preferences.rs:1-50`
- Git commands: Phase 1 spec `git_auto_commit` (fn-1, task 5)
- Error handling: `docs/developer/error-handling.md`
- State management: `docs/developer/state-management.md`

**External Docs**:
- [Claude SDK Streaming](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/examples/streaming.ts)
- [React 19 Hooks](https://react.dev/blog/2024/12/05/react-19)
- [Zustand v5 Selectors](https://zustand.docs.pmnd.rs/guides/auto-generating-selectors)
- [Convex Real-time](https://docs.convex.dev/realtime)
- [Template System Spec](.claude/plans/template-system-spec.md)

**Implementation Plans**:
- Detailed day-by-day: `.claude/plans/IMPLEMENTATION-PRIORITY.md` lines 266-548
- Enhanced agent spec: `.claude/plans/enhanced-assistant-spec.md`
- Data models: `.claude/plans/data-models-spec.md`

## Open Questions

1. **Multi-tab behavior**: If user opens 2 tabs, should conversations sync via Convex real-time or stay independent?
2. **Template seeding**: Should templates be code-committed or admin-only via Convex dashboard?
3. **Conversation limits**: Should there be max messages per conversation (e.g., 100) before archival?
4. **Keyboard shortcuts**: Should Cmd+Enter send message, Escape cancel streaming?
5. **Context visibility**: Should context files appear in a sidebar during chat, or hidden until agent uses them?
