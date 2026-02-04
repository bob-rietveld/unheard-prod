//! Git auto-commit commands.
//!
//! Handles automatic Git commits for uploaded context files.
//! LFS tracking is handled via .gitattributes rules (created during project initialization).

use git2::{Repository, Signature};
use std::path::PathBuf;

/// Auto-commit files to Git repository with proper LFS handling.
///
/// LFS tracking is automatic via .gitattributes rules created during project init.
/// Files matching .gitattributes patterns (PDF, Excel >10MB) are automatically tracked by Git LFS.
///
/// # Arguments
/// * `repo_path` - Path to the Git repository
/// * `files` - List of file paths relative to repo root (e.g., "context/file.csv")
/// * `message` - Commit message
///
/// # Returns
/// The commit ID (SHA) as a string
#[tauri::command]
#[specta::specta]
pub fn git_auto_commit(
    repo_path: PathBuf,
    files: Vec<String>,
    message: String,
) -> Result<String, String> {
    log::info!("Auto-committing {} files to {repo_path:?}", files.len());

    // Validate inputs
    if files.is_empty() {
        return Err("No files provided to commit".to_string());
    }

    if message.trim().is_empty() {
        return Err("Commit message cannot be empty".to_string());
    }

    // Open repository
    let repo = Repository::open(&repo_path).map_err(|e| {
        log::error!("Failed to open Git repository at {repo_path:?}: {e}");
        format!("Failed to open Git repository: {e}")
    })?;

    // Get index
    let mut index = repo.index().map_err(|e| {
        log::error!("Failed to get repository index: {e}");
        format!("Failed to get repository index: {e}")
    })?;

    // Add each file to the index
    for file in &files {
        let file_path = std::path::Path::new(file);
        log::debug!("Adding file to index: {file_path:?}");

        index.add_path(file_path).map_err(|e| {
            log::error!("Failed to add {file_path:?} to index: {e}");
            format!("Failed to add {file} to index: {e}")
        })?;
    }

    // CRITICAL: Write index before creating tree (from practice-scout pitfall)
    index.write().map_err(|e| {
        log::error!("Failed to write index: {e}");
        format!("Failed to write index: {e}")
    })?;

    // Write tree from index
    let tree_id = index.write_tree().map_err(|e| {
        log::error!("Failed to write tree: {e}");
        format!("Failed to write tree: {e}")
    })?;

    let tree = repo.find_tree(tree_id).map_err(|e| {
        log::error!("Failed to find tree: {e}");
        format!("Failed to find tree: {e}")
    })?;

    // Get signature (respects Git config, fallback to default)
    let signature = repo
        .signature()
        .or_else(|_| {
            log::debug!("Git user not configured, using default signature");
            Signature::now("Unheard User", "user@unheard.local")
        })
        .map_err(|e| {
            log::error!("Failed to create signature: {e}");
            format!("Failed to create signature: {e}")
        })?;

    // Get parent commit (if exists)
    let parent_commit = repo
        .head()
        .ok()
        .and_then(|head| head.target().and_then(|oid| repo.find_commit(oid).ok()));

    // Create commit
    let commit_id = if let Some(parent) = parent_commit {
        // Subsequent commit with parent
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &message,
            &tree,
            &[&parent],
        )
    } else {
        // First commit (no parent)
        repo.commit(Some("HEAD"), &signature, &signature, &message, &tree, &[])
    }
    .map_err(|e| {
        log::error!("Failed to create commit: {e}");
        format!("Failed to create commit: {e}")
    })?;

    let commit_hash = commit_id.to_string();
    log::info!("Created commit: {commit_hash}");

    Ok(commit_hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    /// Create a test repository with .gitattributes
    fn create_test_repo() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize repo
        let repo = Repository::init(&repo_path).unwrap();

        // Create context directory
        fs::create_dir_all(repo_path.join("context")).unwrap();

        // Create .gitattributes with LFS rules
        let gitattributes_content = r#"# Git LFS tracking for large files
context/**/*.pdf filter=lfs diff=lfs merge=lfs -text
context/**/*.xlsx filter=lfs diff=lfs merge=lfs -text
"#;
        fs::write(repo_path.join(".gitattributes"), gitattributes_content).unwrap();

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
    fn test_git_auto_commit_single_file() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Create a CSV file
        let csv_path = repo_path.join("context/test.csv");
        fs::write(&csv_path, "name,age\nAlice,30\nBob,25").unwrap();

        // Commit the file
        let result = git_auto_commit(
            repo_path.clone(),
            vec!["context/test.csv".to_string()],
            "Add context: test.csv".to_string(),
        );

        assert!(result.is_ok());
        let commit_hash = result.unwrap();
        assert!(!commit_hash.is_empty());
        assert_eq!(commit_hash.len(), 40); // Git SHA is 40 characters

        // Verify commit was created
        let repo = Repository::open(repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(commit.message().unwrap(), "Add context: test.csv");
    }

    #[test]
    fn test_git_auto_commit_multiple_files() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Create multiple files
        fs::write(repo_path.join("context/file1.csv"), "name,age\nAlice,30").unwrap();
        fs::write(repo_path.join("context/file2.csv"), "name,score\nBob,95").unwrap();

        // Commit multiple files
        let result = git_auto_commit(
            repo_path.clone(),
            vec![
                "context/file1.csv".to_string(),
                "context/file2.csv".to_string(),
            ],
            "Add context files: file1.csv, file2.csv".to_string(),
        );

        assert!(result.is_ok());

        // Verify commit message
        let repo = Repository::open(repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(
            commit.message().unwrap(),
            "Add context files: file1.csv, file2.csv"
        );
    }

    #[test]
    fn test_git_auto_commit_empty_files() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Try to commit with empty file list
        let result = git_auto_commit(repo_path, vec![], "Empty commit".to_string());

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No files provided"));
    }

    #[test]
    fn test_git_auto_commit_empty_message() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Create a file
        fs::write(repo_path.join("context/test.csv"), "data").unwrap();

        // Try to commit with empty message
        let result = git_auto_commit(
            repo_path,
            vec!["context/test.csv".to_string()],
            "   ".to_string(),
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Commit message cannot be empty"));
    }

    #[test]
    fn test_git_auto_commit_missing_repo() {
        let temp_dir = TempDir::new().unwrap();
        let non_repo_path = temp_dir.path().to_path_buf();

        let result = git_auto_commit(
            non_repo_path,
            vec!["test.csv".to_string()],
            "Test commit".to_string(),
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .contains("Failed to open Git repository"));
    }

    #[test]
    fn test_git_auto_commit_index_write_called() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Create a file
        fs::write(repo_path.join("context/test.csv"), "data").unwrap();

        // Commit should succeed (index.write() is called before write_tree())
        let result = git_auto_commit(
            repo_path,
            vec!["context/test.csv".to_string()],
            "Test commit".to_string(),
        );

        assert!(result.is_ok());
    }

    #[test]
    fn test_git_auto_commit_lfs_file() {
        let (_temp_dir, repo_path) = create_test_repo();

        // Create a PDF file (LFS-tracked via .gitattributes)
        // Note: Actual LFS tracking requires git-lfs to be installed
        // This test verifies the commit succeeds regardless of LFS availability
        let pdf_path = repo_path.join("context/test.pdf");
        fs::write(&pdf_path, b"%PDF-1.4\nMock PDF content").unwrap();

        let result = git_auto_commit(
            repo_path,
            vec!["context/test.pdf".to_string()],
            "Add context: test.pdf".to_string(),
        );

        // Should succeed even if LFS is not installed (Git falls back to normal storage)
        assert!(result.is_ok());
    }
}
