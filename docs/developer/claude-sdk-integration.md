# Claude SDK Integration

This document describes how Unheard integrates with the Claude API using a Rust-based approach.

## Architecture

**NO Node.js SDK**: Unheard does not use the `@anthropic-ai/sdk` package. All Claude API calls are made from the Rust backend using `reqwest` with SSE streaming.

**Why Rust?**

- Security: API key never exposed to frontend
- Performance: Native HTTP/2 and streaming support
- Type safety: Full type checking across the boundary
- Tauri integration: Native Channels for streaming

## API Key Management

API keys are stored in environment variables and read exclusively by the Rust backend.

**Environment Variable**:

```bash
ANTHROPIC_API_KEY=sk-ant-api...
```

**Reading in Rust**:

```rust
use std::env;

let api_key = env::var("ANTHROPIC_API_KEY")
    .map_err(|_| ChatError::ConfigError {
        message: "ANTHROPIC_API_KEY not configured".to_string(),
    })?;
```

**Never in Frontend**: The frontend never has access to the API key. All requests are proxied through Tauri commands.

## Streaming Architecture

Claude API responses stream via Server-Sent Events (SSE). We use Tauri Channels for real-time token delivery.

### Flow

```
Frontend                 Rust Backend              Claude API
   |                          |                         |
   |--send_chat_message()---->|                         |
   |                          |---POST /messages------->|
   |                          |<---SSE stream-----------|
   |<--StreamEvent::Token-----|                         |
   |<--StreamEvent::Token-----|                         |
   |<--StreamEvent::Token-----|                         |
   |<--StreamEvent::Done------|                         |
```

### Tauri Channel Pattern

```rust
#[tauri::command]
#[specta::specta]
pub async fn send_chat_message(
    message: String,
    history: Vec<ChatMessage>,
    system_prompt: Option<String>,
    channel: Channel<StreamEvent>,
) -> Result<ChatResponse, ChatError> {
    // Stream tokens as they arrive
    while let Some(token) = stream.next().await {
        channel.send(StreamEvent::Token { content: token })?;
    }
    channel.send(StreamEvent::Done)?;
}
```

### Frontend Usage

```typescript
import { commands } from '@/lib/tauri-bindings'
import { Channel } from '@tauri-apps/api/core'

const channel = new Channel<StreamEvent>()
channel.onmessage = event => {
  if (event.type === 'Token') {
    console.log('Token:', event.content)
  } else if (event.type === 'Done') {
    console.log('Stream complete')
  }
}

const result = await commands.sendChatMessage('Hello Claude', [], null, channel)
```

## SSE Parsing

We use the `eventsource-stream` crate for reliable SSE parsing.

**Dependencies** (Cargo.toml):

```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio-stream = "0.1"
eventsource-stream = "0.2"
futures = "0.3"
```

**Parsing Logic**:

```rust
use eventsource_stream::Eventsource;
use futures::stream::StreamExt;

let mut stream = response.bytes_stream().eventsource();

while let Some(event) = stream.next().await {
    match event {
        Ok(event) => {
            if event.data == "[DONE]" {
                channel.send(StreamEvent::Done)?;
                break;
            }
            let claude_event: ClaudeEvent = serde_json::from_str(&event.data)?;
            // Extract tokens...
        }
        Err(e) => {
            channel.send(StreamEvent::Error { message: e.to_string() })?;
        }
    }
}
```

## Error Handling

All errors are typed and propagated to the frontend.

### Error Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum ChatError {
    ConfigError { message: String },      // Missing API key
    RateLimitError { retry_after: Option<u64> }, // 429
    ApiError { message: String },         // 5xx or other API errors
    TimeoutError,                         // 60s timeout
    NetworkError { message: String },     // Connection issues
    ParseError { message: String },       // SSE parsing failures
}
```

### Rate Limiting

Claude API rate limits (429 status) are detected and the `retry-after` header is extracted:

```rust
let status = response.status();
if status.as_u16() == 429 {
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok());
    return Err(ChatError::RateLimitError { retry_after });
}
```

Frontend should implement exponential backoff based on `retry_after`.

### Timeouts

HTTP requests have a 60-second timeout:

```rust
const CLAUDE_API_TIMEOUT_SECS: u64 = 60;

let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(CLAUDE_API_TIMEOUT_SECS))
    .build()?;
```

## Testing

### Unit Tests

All types and serialization are unit tested:

```bash
cargo test --lib commands::chat::tests
```

### Integration Tests

**Manual testing required** for full API integration:

1. Set `ANTHROPIC_API_KEY` environment variable
2. Run the dev server: `npm run tauri:dev`
3. Send a test message through the chat UI
4. Verify streaming tokens appear in real-time
5. Check error handling (remove API key, test rate limits)

**Note**: Automated integration tests with real API calls are intentionally excluded to avoid:

- API quota consumption in CI
- Flaky tests due to network issues
- Credential management complexity

## Claude API Reference

**Endpoint**: `https://api.anthropic.com/v1/messages`

**Headers**:

- `anthropic-version: 2023-06-01`
- `x-api-key: <API_KEY>`
- `content-type: application/json`

**Request Body**:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "max_tokens": 4096,
  "messages": [{ "role": "user", "content": "Hello" }],
  "stream": true,
  "system": "Optional system prompt"
}
```

**SSE Event Types**:

- `content_block_delta`: Contains text tokens in `delta.text`
- `message_stop`: Signals end of stream
- `[DONE]`: Alternative end-of-stream marker

## Adding New Commands

See `docs/developer/tauri-commands.md` for the general pattern.

**Chat-specific considerations**:

1. All chat commands should go in `src-tauri/src/commands/chat.rs`
2. Use `Channel<T>` for streaming responses
3. Return `Result<T, ChatError>` for proper error typing
4. Register in `src-tauri/src/bindings.rs`
5. Generate TypeScript bindings: `cargo test export_bindings -- --ignored`

## References

- [Claude API Docs](https://platform.claude.com/docs/en/api/messages-streaming)
- [Tauri Channels](https://v2.tauri.app/reference/javascript/api/ipc/#channel)
- [eventsource-stream Docs](https://docs.rs/eventsource-stream/)
- [reqwest Docs](https://docs.rs/reqwest/)
