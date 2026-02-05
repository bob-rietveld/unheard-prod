# fn-2-phase-2-chat-interface-agent.3 Chat UI components (messages, input, bubbles)

## Description

Build chat UI components with streaming message rendering and input handling.

**Size:** M
**Files:**

- `src/components/chat/ChatInterface.tsx` (new)
- `src/components/chat/ChatMessages.tsx` (new)
- `src/components/chat/ChatInput.tsx` (new)
- `src/components/chat/ChatBubble.tsx` (new)
- `src/components/chat/ChatInterface.test.tsx` (new)

## Approach

**Component Structure**:

```
ChatInterface (container)
├── ChatMessages (scroll area with message list)
│   └── ChatBubble (individual message bubble)
└── ChatInput (textarea + send button)
```

**Reuse shadcn/ui primitives**:

- `ScrollArea` from `src/components/ui/scroll-area.tsx`
- `Card` from `src/components/ui/card.tsx` (for message bubbles)
- `Textarea` from `src/components/ui/textarea.tsx`
- `Button` from `src/components/ui/button.tsx`

**Streaming Rendering** (from practice-scout):
<!-- Updated by plan-sync: fn-2-phase-2-chat-interface-agent.2 - documented StreamEvent types -->

- Use `useEffect` to subscribe to streaming channel events via Tauri Channel
- StreamEvent types from `src/lib/bindings.ts`: `Token { content }`, `Done`, `Error { message }`
- Accumulate tokens in local state or directly update useChatStore
- Auto-scroll to bottom on new messages (with "scroll to bottom" button if user scrolled up)

**State Connection** (CRITICAL):

```typescript
// GOOD - selector pattern
const messages = useChatStore(state => state.messages)
const isStreaming = useChatStore(state => state.isStreaming)

// BAD - destructuring (ast-grep will fail)
const { messages, isStreaming } = useChatStore()
```

## Key Context

**Auto-scroll Pattern** (from github-scout):

- Track scroll position with `useRef`
- Only auto-scroll if user is near bottom (<100px from bottom)
- Show "New messages ↓" button if user scrolled up

**Keyboard Shortcuts**:

- Enter: Send message (if not shift+enter)
- Shift+Enter: New line
- Escape: Clear input (if empty) or stop streaming (if streaming)

**Accessibility** (from practice-scout):

- Add `aria-live="polite"` to message container
- Role="log" for message list
- Focus management: Focus input after send

## References

- State pattern: `docs/developer/state-management.md`
- UI patterns: `docs/developer/ui-patterns.md`
- Task 1: Frontend types from `src/types/chat.ts` (ChatMessage with id, role, content, timestamp, status, metadata)
- Task 2: Rust API types from `src/lib/bindings.ts` (ChatMessage, StreamEvent, ChatError, ChatResponse)
<!-- Updated by plan-sync: fn-2-phase-2-chat-interface-agent.2 - clarified two type sources for ChatMessage -->

## Acceptance

- [ ] ChatInterface component renders with message list and input
- [ ] ChatMessages displays messages from useChatStore
- [ ] ChatBubble styles: user messages (right-aligned, blue), assistant (left-aligned, gray)
- [ ] Streaming messages show typing indicator (animated dots or cursor)
- [ ] Auto-scroll to bottom on new messages (unless user scrolled up)
- [ ] "Scroll to bottom" button appears when user scrolls up >100px
- [ ] ChatInput textarea expands up to 5 lines, then scrolls
- [ ] Send button disabled when input empty or streaming
- [ ] Enter key sends message (Shift+Enter for new line)
- [ ] Escape key clears input or stops streaming
- [ ] Empty state: Show welcome message when no messages
- [ ] Component tests: Rendering, user interactions, streaming updates
- [ ] Test: Messages render in correct order
- [ ] Test: Streaming message updates in real-time
- [ ] Test: Send button triggers addMessage action
- [ ] Test: Enter key sends message
- [ ] ast-grep passes (Zustand selectors, no destructuring)
- [ ] Documentation: Update `docs/developer/ui-patterns.md` with chat component patterns
- [ ] Documentation: Create `docs/developer/chat-system.md` (new)

## Done summary

TBD

## Evidence

- Commits:
- Tests:
- PRs:
