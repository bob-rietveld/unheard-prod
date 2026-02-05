//! Tauri command handlers organized by domain.
//!
//! Each submodule contains related commands and their helper functions.
//! Import specific commands via their submodule (e.g., `commands::preferences::greet`).

pub mod chat;
pub mod context;
pub mod decisions;
pub mod git;
pub mod notifications;
pub mod preferences;
pub mod projects;
pub mod quick_pane;
pub mod recovery;
