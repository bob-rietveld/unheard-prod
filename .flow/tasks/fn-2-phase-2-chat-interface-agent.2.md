# fn-2-phase-2-chat-interface-agent.2 Claude SDK Tauri streaming command

## Description
Implement Tauri command that calls Claude SDK with streaming responses via Channel.

**Size:** M
**Files:**
- `src-tauri/src/commands/chat.rs` (new)
- `src-tauri/src/lib.rs` (register command)
- `src-tauri/Cargo.toml` (add dependencies)
- `src/lib/tauri-bindings.ts` (update with new command)

## Approach

**Tauri Streaming Pattern** (from architecture guide):
- Use `tauri::ipc::Channel` for token streaming (no UI freeze)
- Spawn blocking task for async HTTP calls
- Emit progress events: `{type: 'token', content: string}`, `{type: 'done'}`, `{type: 'error', message: string}`

**Rust Dependencies**:
```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio-stream = "0.1"
serde_json = "1.0"
```

**API Key Strategy** (from gap analysis):
- Read from environment variable `ANTHROPIC_API_KEY`
- Return clear error if missing: "ANTHROPIC_API_KEY not configured"

**Follow Pattern**: `src-tauri/src/commands/preferences.rs:1-50`

## Key Context

**Claude SDK Streaming** (from docs-scout):
- POST to `https://api.anthropic.com/v1/messages`
- Headers: `anthropic-version: 2023-06-01`, `x-api-key`, `content-type: application/json`
- Body: `{ model, max_tokens, messages, stream: true, system }`
- Response: Server-sent events (SSE) stream
- Event format: `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"token"}}`

**Error Handling**:
- 429 Rate Limit → return `RateLimitError` with retry-after
- 500 Server Error → return `ApiError` with message
- Timeout (60s) → return `TimeoutError`

## References

- Tauri Channel: `https://v2.tauri.app/reference/javascript/api/ipc/#channel`
- Claude API: `https://platform.claude.com/docs/en/api/messages-streaming`
- Pattern: `src-tauri/src/commands/preferences.rs`
## Acceptance
- [ ] Rust command `send_chat_message` accepts: message (String), history (Vec<ChatMessage>), system_prompt (String), channel (Channel)
- [ ] Command returns `Result<ChatResponse, ChatError>`
- [ ] Streams tokens via channel as received from API
- [ ] Emits final `done` event when stream completes
- [ ] Emits `error` event on API failures
- [ ] Error types: RateLimitError, ApiError, TimeoutError, ConfigError (missing API key)
- [ ] Command registered in `lib.rs` and bindings updated via `tauri-specta`
- [ ] Unit tests: Mock API responses and verify event emission
- [ ] Test: Valid API key returns streaming tokens
- [ ] Test: Missing API key returns ConfigError
- [ ] Test: Rate limit (429) returns RateLimitError with retry-after
- [ ] Test: Network timeout returns TimeoutError
- [ ] cargo clippy passes with no warnings
- [ ] Documentation: Update `docs/developer/tauri-commands.md` with streaming command pattern
- [ ] Documentation: Create `docs/developer/claude-sdk-integration.md` (new)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
