# fn-2-phase-2-chat-interface-agent.1 Zustand chat store + TypeScript types

## Description
Create Zustand store for chat state management with TypeScript types following codebase patterns.

**Size:** M
**Files:**
- `src/store/chat-store.ts` (new)
- `src/store/chat-store.test.ts` (new)
- `src/types/chat.ts` (new)

## Approach

Follow existing Zustand pattern from `src/store/ui-store.ts:1-86`:
- Use `create<T>()()` with devtools middleware
- Selector syntax mandatory (ast-grep enforced - no destructuring)
- Actions use `set()` for state updates
- Message state includes streaming status

## Key Context

**Streaming State Pattern** (from practice-scout):
- Track `streamingMessageId` separately from messages array
- Use `status` field per message: 'sending' | 'streaming' | 'complete' | 'error'
- `updateStreamingMessage()` accumulates tokens without full re-render

**getState() Pattern** (from architecture guide):
- Use in callbacks/event handlers to avoid stale closures
- Example: `const { messages } = useChatStore.getState()`

**Type Safety**:
- All actions return `void`
- Messages have required `id`, `role`, `content`, `timestamp`
- Optional fields: `status`, `metadata`

## References

- Pattern: `src/store/ui-store.ts:1-86`
- Testing pattern: follow `src/store/ui-store.test.ts` if it exists
- Architecture: `docs/developer/state-management.md`
## Acceptance
- [ ] `useChatStore` created with devtools middleware
- [ ] Store exports: messages, isStreaming, streamingMessageId, currentTemplateId, configAnswers, error
- [ ] Actions: addMessage, updateStreamingMessage, completeStreaming, setError, setTemplate, updateConfigAnswer, resetConversation
- [ ] TypeScript types exported from `src/types/chat.ts`
- [ ] Types include: ChatMessage, ChatRole, MessageStatus, ChatState
- [ ] Unit tests cover all actions (>80% coverage)
- [ ] Test: Adding message appends to array
- [ ] Test: Updating streaming message replaces content at correct ID
- [ ] Test: resetConversation clears all state
- [ ] ast-grep passes (no destructuring in store usage)
- [ ] Documentation: Update `docs/developer/state-management.md` with chat store example
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
