//! Chat command handlers for Claude API integration.
//!
//! Handles streaming chat messages via the Claude API with SSE parsing.

use serde::{Deserialize, Serialize};
use specta::Type;
use std::env;
use tauri::ipc::Channel;

/// Maximum timeout for Claude API requests (60 seconds)
const CLAUDE_API_TIMEOUT_SECS: u64 = 60;

/// Claude API endpoint
const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";

/// Claude API version header
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Default model to use
const DEFAULT_MODEL: &str = "claude-sonnet-4-5-20250929";

/// Default max tokens
const DEFAULT_MAX_TOKENS: u32 = 4096;

// ============================================================================
// Types
// ============================================================================

/// A single chat message in the conversation history
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Response from the chat command
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct ChatResponse {
    pub success: bool,
}

/// Error types for chat operations
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
#[allow(clippy::enum_variant_names)]
pub enum ChatError {
    /// API key not configured in environment
    ConfigError { message: String },
    /// Rate limit exceeded (429)
    RateLimitError { retry_after: Option<u64> },
    /// API server error (5xx)
    ApiError { message: String },
    /// Request timeout
    TimeoutError,
    /// Network or HTTP error
    NetworkError { message: String },
    /// SSE parsing error
    ParseError { message: String },
}

impl std::fmt::Display for ChatError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ChatError::ConfigError { message } => write!(f, "Configuration error: {message}"),
            ChatError::RateLimitError { retry_after } => {
                if let Some(seconds) = retry_after {
                    write!(f, "Rate limit exceeded. Retry after {seconds} seconds")
                } else {
                    write!(f, "Rate limit exceeded")
                }
            }
            ChatError::ApiError { message } => write!(f, "API error: {message}"),
            ChatError::TimeoutError => write!(f, "Request timeout"),
            ChatError::NetworkError { message } => write!(f, "Network error: {message}"),
            ChatError::ParseError { message } => write!(f, "Parse error: {message}"),
        }
    }
}

/// Progress event emitted during streaming
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum StreamEvent {
    Token { content: String },
    Done,
    Error { message: String },
}

// ============================================================================
// API Request/Response Types (internal)
// ============================================================================

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    max_tokens: u32,
    messages: Vec<ChatMessage>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ClaudeEvent {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    delta: Option<DeltaContent>,
}

#[derive(Debug, Deserialize)]
struct DeltaContent {
    #[serde(rename = "type")]
    delta_type: String,
    #[serde(default)]
    text: Option<String>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Helper to emit an error event on the channel before returning an error.
/// Best-effort: ignores channel send failures.
fn emit_error(channel: &Channel<StreamEvent>, error: &ChatError) {
    let message = error.to_string();
    let _ = channel.send(StreamEvent::Error { message });
}

// ============================================================================
// Command
// ============================================================================

/// Sends a chat message to Claude API with streaming responses.
///
/// # Arguments
/// * `message` - The user's message
/// * `history` - Previous conversation messages
/// * `system_prompt` - Optional system prompt for context
/// * `channel` - Tauri channel for streaming token events
///
/// # Streaming Events
/// - `StreamEvent::Token { content }` - Each token as received
/// - `StreamEvent::Done` - Stream completed successfully
/// - `StreamEvent::Error { message }` - Error occurred during streaming
///
/// # Errors
/// Returns `ChatError` for API failures, configuration issues, or network errors.
#[tauri::command]
#[specta::specta]
pub async fn send_chat_message(
    message: String,
    history: Vec<ChatMessage>,
    system_prompt: Option<String>,
    channel: Channel<StreamEvent>,
) -> Result<ChatResponse, ChatError> {
    log::info!("Sending chat message to Claude API");

    // Get API key from environment
    let api_key = env::var("ANTHROPIC_API_KEY").map_err(|_| {
        let error = ChatError::ConfigError {
            message: "ANTHROPIC_API_KEY not configured".to_string(),
        };
        emit_error(&channel, &error);
        error
    })?;

    // Build message history with new message
    let mut messages = history;
    messages.push(ChatMessage {
        role: "user".to_string(),
        content: message,
    });

    // Build request
    let request = ClaudeRequest {
        model: DEFAULT_MODEL.to_string(),
        max_tokens: DEFAULT_MAX_TOKENS,
        messages,
        stream: true,
        system: system_prompt,
    };

    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(CLAUDE_API_TIMEOUT_SECS))
        .build()
        .map_err(|e| {
            let error = ChatError::NetworkError {
                message: format!("Failed to create HTTP client: {e}"),
            };
            emit_error(&channel, &error);
            error
        })?;

    // Send request
    let response = client
        .post(CLAUDE_API_URL)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .header("x-api-key", api_key)
        .header("content-type", "application/json")
        .json(&request)
        .send()
        .await
        .map_err(|e| {
            let error = if e.is_timeout() {
                ChatError::TimeoutError
            } else {
                ChatError::NetworkError {
                    message: format!("HTTP request failed: {e}"),
                }
            };
            emit_error(&channel, &error);
            error
        })?;

    // Check status code
    let status = response.status();
    if !status.is_success() {
        let error = match status.as_u16() {
            429 => {
                // Try to extract retry-after header
                let retry_after = response
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok());
                ChatError::RateLimitError { retry_after }
            }
            500..=599 => {
                let error_text = response.text().await.unwrap_or_default();
                ChatError::ApiError {
                    message: format!("Server error ({}): {error_text}", status.as_u16()),
                }
            }
            _ => {
                let error_text = response.text().await.unwrap_or_default();
                ChatError::ApiError {
                    message: format!("API error ({}): {error_text}", status.as_u16()),
                }
            }
        };
        emit_error(&channel, &error);
        return Err(error);
    }

    // Parse SSE stream
    log::debug!("Starting SSE stream parsing");
    stream_response(response, channel).await?;

    log::info!("Chat message completed successfully");
    Ok(ChatResponse { success: true })
}

/// Streams the SSE response, emitting tokens as they arrive.
async fn stream_response(
    response: reqwest::Response,
    channel: Channel<StreamEvent>,
) -> Result<(), ChatError> {
    use eventsource_stream::Eventsource;
    use futures::stream::StreamExt;

    let mut stream = response.bytes_stream().eventsource();
    let mut sent_done = false;

    while let Some(event) = stream.next().await {
        match event {
            Ok(event) => {
                // Parse the event data
                if event.data == "[DONE]" {
                    log::debug!("Stream completed");
                    channel
                        .send(StreamEvent::Done)
                        .map_err(|e| ChatError::ParseError {
                            message: format!("Failed to send done event: {e}"),
                        })?;
                    sent_done = true;
                    break;
                }

                // Parse JSON event
                match serde_json::from_str::<ClaudeEvent>(&event.data) {
                    Ok(claude_event) => {
                        // Extract text from content_block_delta events
                        if claude_event.event_type == "content_block_delta" {
                            if let Some(delta) = claude_event.delta {
                                if delta.delta_type == "text_delta" {
                                    if let Some(text) = delta.text {
                                        channel
                                            .send(StreamEvent::Token { content: text })
                                            .map_err(|e| ChatError::ParseError {
                                                message: format!("Failed to send token: {e}"),
                                            })?;
                                    }
                                }
                            }
                        } else if claude_event.event_type == "message_stop" {
                            log::debug!("Message stop event received");
                            channel
                                .send(StreamEvent::Done)
                                .map_err(|e| ChatError::ParseError {
                                    message: format!("Failed to send done event: {e}"),
                                })?;
                            sent_done = true;
                            break;
                        }
                    }
                    Err(e) => {
                        log::warn!("Failed to parse SSE event: {e}, data: {}", event.data);
                        // Continue processing other events instead of failing
                    }
                }
            }
            Err(e) => {
                log::error!("SSE stream error: {e}");
                channel
                    .send(StreamEvent::Error {
                        message: format!("Stream error: {e}"),
                    })
                    .ok(); // Ignore channel send errors here
                return Err(ChatError::NetworkError {
                    message: format!("SSE stream error: {e}"),
                });
            }
        }
    }

    // If stream ended without explicit done event, send one now (best-effort)
    if !sent_done {
        log::debug!("Stream ended without explicit done event, sending fallback");
        let _ = channel.send(StreamEvent::Done);
    }

    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_message_serialization() {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        };

        let json = serde_json::to_string(&msg).unwrap();
        assert!(json.contains("user"));
        assert!(json.contains("Hello"));
    }

    #[test]
    fn test_stream_event_serialization() {
        let event = StreamEvent::Token {
            content: "test".to_string(),
        };

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("Token"));
        assert!(json.contains("test"));
    }

    #[test]
    fn test_chat_error_display() {
        let error = ChatError::ConfigError {
            message: "Missing key".to_string(),
        };
        assert!(error.to_string().contains("Configuration error"));

        let error = ChatError::RateLimitError {
            retry_after: Some(60),
        };
        assert!(error.to_string().contains("Rate limit"));
        assert!(error.to_string().contains("60"));

        let error = ChatError::TimeoutError;
        assert!(error.to_string().contains("timeout"));
    }

    #[test]
    fn test_claude_request_serialization() {
        let request = ClaudeRequest {
            model: "claude-sonnet-4-5-20250929".to_string(),
            max_tokens: 1024,
            messages: vec![ChatMessage {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            stream: true,
            system: Some("You are helpful".to_string()),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("claude-sonnet-4-5"));
        assert!(json.contains("Hello"));
        assert!(json.contains("helpful"));
    }

    #[test]
    fn test_claude_event_deserialization() {
        let json = r#"{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.event_type, "content_block_delta");
        assert_eq!(event.delta.unwrap().text.unwrap(), "Hello");
    }

    #[test]
    fn test_claude_event_message_stop() {
        let json = r#"{"type":"message_stop"}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        assert_eq!(event.event_type, "message_stop");
        assert!(event.delta.is_none());
    }

    // Note: Integration tests with real API require ANTHROPIC_API_KEY
    // These are intentionally left as unit tests only.
    // Manual testing required for full API integration.
}
