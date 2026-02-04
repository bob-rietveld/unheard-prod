# fn-2-phase-2-chat-interface-agent.2 Claude SDK Tauri streaming command

## Description
Implement Tauri command that calls Claude API via Rust reqwest with SSE streaming via Channel.

**Size:** M
**Files:**
- `src-tauri/src/commands/chat.rs` (new)
- `src-tauri/src/bindings.rs` (register command)
- `src-tauri/Cargo.toml` (add dependencies)
- `src/lib/tauri-bindings.ts` (auto-updated by tauri-specta)

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
eventsource-stream = "0.2"
```

**API Key Strategy**:
- Read from environment variable `ANTHROPIC_API_KEY`
- Return clear error if missing: "ANTHROPIC_API_KEY not configured"
- **NO frontend SDK** - all Claude API calls go through Rust

**Command Registration** (CRITICAL):
- Register command in `src-tauri/src/bindings.rs` using `tauri-specta`
- Pattern: Add `chat` to module imports, then add commands to `collect_commands![]` macro
- Run `cargo test export_bindings -- --ignored` to generate TypeScript bindings

**Follow Pattern**: `src-tauri/src/bindings.rs:1-48`

## Key Context

**Claude API Streaming** (from docs-scout):
- POST to `https://api.anthropic.com/v1/messages`
- Headers: `anthropic-version: 2023-06-01`, `x-api-key`, `content-type: application/json`
- Body: `{ model, max_tokens, messages, stream: true, system }`
- Response: Server-sent events (SSE) stream
- Event format: `data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"token"}}`

**SSE Parsing**:
- Use `eventsource-stream` crate for reliable parsing
- Parse each event line starting with `data: `
- Extract `delta.text` from JSON events
- Handle `message_stop` event to complete stream

**Error Handling**:
- 429 Rate Limit → return `RateLimitError` with retry-after
- 500 Server Error → return `ApiError` with message
- Timeout (60s) → return `TimeoutError`

## References

- Tauri Channel: `https://v2.tauri.app/reference/javascript/api/ipc/#channel`
- Claude API: `https://platform.claude.com/docs/en/api/messages-streaming`
- Bindings pattern: `src-tauri/src/bindings.rs`
- eventsource-stream: `https://docs.rs/eventsource-stream/`
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
- [ ] Command calls Claude API via `reqwest` (NO @anthropic-ai/sdk)
- [ ] API key read from `ANTHROPIC_API_KEY` environment variable
- [ ] SSE stream parsed via `eventsource-stream` crate
- [ ] Streams tokens via channel as received from API
- [ ] Emits final `done` event when stream completes
- [ ] Emits `error` event on API failures
- [ ] Error types: RateLimitError, ApiError, TimeoutError, ConfigError (missing API key)
- [ ] Command registered in `src-tauri/src/bindings.rs` using `tauri-specta` pattern
- [ ] Module `chat` added to imports in bindings.rs
- [ ] Commands added to `collect_commands![]` macro
- [ ] Bindings generated via `cargo test export_bindings -- --ignored`
- [ ] TypeScript bindings auto-updated in `src/lib/tauri-bindings.ts`
- [ ] Unit tests: Mock API responses and verify event emission
- [ ] Test: Valid API key returns streaming tokens
- [ ] Test: Missing API key returns ConfigError
- [ ] Test: Rate limit (429) returns RateLimitError with retry-after
- [ ] Test: Network timeout returns TimeoutError
- [ ] Test: SSE parsing handles all event types correctly
- [ ] cargo clippy passes with no warnings
- [ ] Documentation: Update `docs/developer/tauri-commands.md` with streaming command pattern
- [ ] Documentation: Create `docs/developer/claude-sdk-integration.md` (document Rust approach, not Node SDK)
## Done summary
TBD

## Evidence
- Commits:
- Tests:
- PRs:
