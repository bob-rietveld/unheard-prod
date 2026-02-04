# fn-2-phase-2-chat-interface-agent.7 Error handling, retry logic, and polish

## Description
Implement comprehensive error handling, retry logic, and UX polish for chat system.

**Size:** M
**Files:**
- `src/components/chat/ErrorBoundary.tsx` (new)
- `src/components/chat/ErrorMessage.tsx` (new)
- `src/lib/error-handlers.ts` (new)
- `src/lib/retry-queue.ts` (new - localStorage queue)
- `src/components/chat/LoadingStates.tsx` (new)

## Approach

**Error Types** (from gap analysis):
- **API Key Missing**: Show config guide modal
- **Rate Limit (429)**: Show countdown timer, auto-retry after delay
- **Network Offline**: Show "You're offline" banner, queue messages
- **API Timeout**: Show "Try Again" button inline
- **Validation Error**: Show field-specific error message
- **Git/Convex Failure**: Show warning, continue with degraded functionality

**Retry Strategy**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 retries for transient errors (5xx, network)
- No retry for permanent errors (4xx except 429, validation)
- Rate limit: Wait for `retry-after` header duration

**Offline Queue**:
- Store messages in localStorage when offline
- On reconnect: Sync queued messages in order
- Show "Sending..." indicator for queued messages

**Loading States**:
- Streaming: Animated typing indicator (3 dots)
- Sending: "Sending..." text in message bubble
- Template loading: Skeleton UI for wizard questions
- Decision saving: "Creating decision log..." overlay

**React Error Boundary**:
- Catch rendering errors in chat components
- Show friendly "Something went wrong" with "Reset Chat" button
- Log error to console (future: send to monitoring)

## Key Context

**Error Display Pattern** (from error-handling.md):
- Inline errors: Show below input/button (field validation)
- Toast errors: Non-critical, auto-dismiss (Convex sync failure)
- Modal errors: Critical, requires action (API key missing)
- Banner errors: Persistent until resolved (offline mode)

**localStorage Queue Schema**:
```typescript
interface QueuedMessage {
  id: string
  message: string
  timestamp: number
  retries: number
  lastError?: string
}
```

**Polish Items**:
- Empty state: "Start by describing your decision"
- Loading skeleton for messages while fetching history
- Smooth animations: message slide-in, fade-in
- Focus management: Auto-focus input after send
- Keyboard shortcuts documented in UI (hover tooltip)

## References

- Error handling: `docs/developer/error-handling.md`
- Notifications: `src/lib/notifications.ts`
- Task 3: Chat UI components
- Task 4: Agent system (error scenarios)
- Task 6: Decision log (failure modes)
## Acceptance
- [ ] React error boundary wraps ChatInterface
- [ ] Error boundary shows "Something went wrong" + "Reset Chat" button
- [ ] ErrorMessage component displays inline errors with "Try Again" button
- [ ] API key missing error shows modal with setup instructions
- [ ] Rate limit error shows countdown timer and auto-retries after delay
- [ ] Network offline shows banner: "You're offline. Messages will send when you reconnect."
- [ ] Offline queue stores messages in localStorage
- [ ] On reconnect, queued messages sync in order
- [ ] Retry logic: Exponential backoff with max 5 attempts
- [ ] Loading states: Typing indicator (animated dots) during streaming
- [ ] Loading states: "Sending..." for outgoing messages
- [ ] Loading states: Skeleton UI for wizard questions
- [ ] Loading states: Overlay with "Creating decision log..." during save
- [ ] Empty state: Friendly message when no conversations
- [ ] Animations: Smooth message slide-in (CSS transitions)
- [ ] Focus management: Input focused after message sent
- [ ] Keyboard shortcuts tooltip on input hover
- [ ] Unit tests: Error handlers, retry logic, queue sync
- [ ] Test: Rate limit triggers exponential backoff
- [ ] Test: Offline queue persists across app restarts
- [ ] Test: Error boundary catches and displays errors
- [ ] E2E test: Full flow with simulated API failure and recovery
- [ ] Documentation: Update `docs/developer/error-handling.md` with chat-specific patterns
- [ ] Documentation: Update `README.md` with Phase 2 features
- [ ] Documentation: Update `docs/developer/README.md` index with new guides
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
