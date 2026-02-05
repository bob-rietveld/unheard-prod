//! Decision log creation and Git commit commands.
//!
//! Handles automatic creation of decision log markdown files and Git commits.

use crate::commands::git::git_auto_commit;
use std::fs;
use std::path::PathBuf;

/// Create a decision log markdown file and commit it to Git.
///
/// # Arguments
/// * `content` - Markdown content with YAML frontmatter
/// * `filename` - Filename (e.g., "2026-02-04-investor-eval.md")
/// * `project_path` - Path to the project root (Git repository)
///
/// # Returns
/// The full relative path to the created file (e.g., "decisions/2026-02-04-investor-eval.md")
#[tauri::command]
#[specta::specta]
pub fn create_decision_log(
    content: String,
    filename: String,
    project_path: PathBuf,
) -> Result<String, String> {
    log::info!("Creating decision log: {filename} in {project_path:?}");

    // Validate inputs
    if content.trim().is_empty() {
        return Err("Content cannot be empty".to_string());
    }

    if filename.trim().is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if !filename.ends_with(".md") {
        return Err("Filename must end with .md".to_string());
    }

    // Create decisions directory if it doesn't exist
    let decisions_dir = project_path.join("decisions");
    if !decisions_dir.exists() {
        log::debug!("Creating decisions directory: {decisions_dir:?}");
        fs::create_dir_all(&decisions_dir).map_err(|e| {
            log::error!("Failed to create decisions directory: {e}");
            format!("Failed to create decisions directory: {e}")
        })?;
    }

    // Write file
    let file_path = decisions_dir.join(&filename);
    log::debug!("Writing decision log to: {file_path:?}");

    fs::write(&file_path, content).map_err(|e| {
        log::error!("Failed to write decision log: {e}");
        format!("Failed to write decision log: {e}")
    })?;

    // Relative path for Git commit
    let relative_path = format!("decisions/{filename}");

    // Commit to Git
    let commit_message = format!("Create decision: {filename}");
    match git_auto_commit(project_path, vec![relative_path.clone()], commit_message) {
        Ok(commit_hash) => {
            log::info!("Decision log committed: {commit_hash}");
        }
        Err(e) => {
            log::error!("Git commit failed: {e}");
            log::warn!("Decision log saved but not committed");
            // Don't fail the operation - file was saved successfully
        }
    }

    Ok(relative_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::{Repository, Signature};
    use std::fs;
    use tempfile::TempDir;

    /// Create a test repository
    fn create_test_repo() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize repo
        let repo = Repository::init(&repo_path).unwrap();

        // Create .gitkeep for initial commit
        fs::write(repo_path.join(".gitkeep"), "").unwrap();

        // Initial commit
        let mut index = repo.index().unwrap();
        index
            .add_all(["."], git2::IndexAddOption::DEFAULT, None)
            .unwrap();
        index.write().unwrap();

        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let signature = Signature::now("Test User", "test@example.com").unwrap();

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Initial commit",
            &tree,
            &[],
        )
        .unwrap();

        (temp_dir, repo_path)
    }

    #[test]
    fn test_create_decision_log_success() {
        let (_temp_dir, repo_path) = create_test_repo();

        let content = r#"---
id: dec-test-1
title: Test Decision
status: ready
---

# Test Decision

This is a test decision log.
"#;

        let result = create_decision_log(
            content.to_string(),
            "2026-02-04-test-decision.md".to_string(),
            repo_path.clone(),
        );

        assert!(result.is_ok());
        let relative_path = result.unwrap();
        assert_eq!(relative_path, "decisions/2026-02-04-test-decision.md");

        // Verify file exists
        let file_path = repo_path.join(&relative_path);
        assert!(file_path.exists());

        // Verify content
        let saved_content = fs::read_to_string(file_path).unwrap();
        assert_eq!(saved_content, content);

        // Verify Git commit
        let repo = Repository::open(repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(
            commit.message().unwrap(),
            "Create decision: 2026-02-04-test-decision.md"
        );
    }

    #[test]
    fn test_create_decision_log_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize repo without decisions directory
        Repository::init(&repo_path).unwrap();

        let result = create_decision_log(
            "# Test".to_string(),
            "test.md".to_string(),
            repo_path.clone(),
        );

        // Should succeed even though decisions directory didn't exist
        assert!(result.is_ok());

        // Verify decisions directory was created
        let decisions_dir = repo_path.join("decisions");
        assert!(decisions_dir.exists());
        assert!(decisions_dir.is_dir());
    }

    #[test]
    fn test_create_decision_log_empty_content() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = create_decision_log(
            "   ".to_string(),
            "test.md".to_string(),
            repo_path,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Content cannot be empty"));
    }

    #[test]
    fn test_create_decision_log_empty_filename() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = create_decision_log("# Test".to_string(), "".to_string(), repo_path);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Filename cannot be empty"));
    }

    #[test]
    fn test_create_decision_log_invalid_extension() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = create_decision_log(
            "# Test".to_string(),
            "test.txt".to_string(),
            repo_path,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must end with .md"));
    }

    #[test]
    fn test_create_decision_log_git_failure_does_not_fail() {
        let temp_dir = TempDir::new().unwrap();
        let non_repo_path = temp_dir.path().to_path_buf();

        // Create decisions directory manually
        fs::create_dir_all(non_repo_path.join("decisions")).unwrap();

        let result = create_decision_log(
            "# Test".to_string(),
            "test.md".to_string(),
            non_repo_path.clone(),
        );

        // Should succeed even though Git commit fails
        assert!(result.is_ok());

        // Verify file was still created
        let file_path = non_repo_path.join("decisions/test.md");
        assert!(file_path.exists());
    }
}
