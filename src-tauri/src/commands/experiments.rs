//! Experiment config creation and Git commit commands.
//!
//! Handles writing experiment config YAML files and auto-committing to Git.

use crate::commands::git::git_auto_commit;
use std::fs;
use std::path::PathBuf;

/// Write an experiment config YAML file and commit it to Git.
///
/// # Arguments
/// * `project_path` - Path to the project root (Git repository)
/// * `filename` - Filename (e.g., "2026-02-06-seed-fundraising.yaml")
/// * `yaml_content` - YAML content to write
///
/// # Returns
/// The relative file path on success (e.g., "experiments/2026-02-06-seed-fundraising.yaml")
#[tauri::command]
#[specta::specta]
pub fn write_experiment_config(
    project_path: String,
    filename: String,
    yaml_content: String,
) -> Result<String, String> {
    log::info!("Writing experiment config: {filename} in {project_path}");

    // Validate inputs
    if yaml_content.trim().is_empty() {
        return Err("YAML content cannot be empty".to_string());
    }

    if filename.trim().is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if !filename.ends_with(".yaml") {
        return Err("Filename must end with .yaml".to_string());
    }

    let project = PathBuf::from(&project_path);

    // Create experiments directory if it doesn't exist
    let experiments_dir = project.join("experiments");
    if !experiments_dir.exists() {
        log::debug!("Creating experiments directory: {experiments_dir:?}");
        fs::create_dir_all(&experiments_dir).map_err(|e| {
            log::error!("Failed to create experiments directory: {e}");
            format!("Failed to create experiments directory: {e}")
        })?;
    }

    // Handle duplicate filenames by appending -2, -3, etc.
    let final_filename = resolve_unique_filename(&experiments_dir, &filename);
    let file_path = experiments_dir.join(&final_filename);

    log::debug!("Writing experiment config to: {file_path:?}");

    fs::write(&file_path, &yaml_content).map_err(|e| {
        log::error!("Failed to write experiment config: {e}");
        format!("Failed to write experiment config: {e}")
    })?;

    // Relative path for Git commit
    let relative_path = format!("experiments/{final_filename}");

    // Commit to Git
    let commit_message = format!("[unheard] Add experiment config: {final_filename}");
    match git_auto_commit(project, vec![relative_path.clone()], commit_message) {
        Ok(commit_hash) => {
            log::info!("Experiment config committed: {commit_hash}");
        }
        Err(e) => {
            log::error!("Git commit failed: {e}");
            log::warn!("Experiment config saved but not committed");
            // Don't fail the operation - file was saved successfully
        }
    }

    Ok(relative_path)
}

/// Resolve a unique filename by appending -2, -3, etc. if the file already exists.
///
/// Given "2026-02-06-seed-fundraising.yaml", checks if it exists and returns
/// "2026-02-06-seed-fundraising-2.yaml" if so, incrementing until a unique name is found.
fn resolve_unique_filename(dir: &PathBuf, filename: &str) -> String {
    let candidate = dir.join(filename);
    if !candidate.exists() {
        return filename.to_string();
    }

    // Split filename into stem and extension
    let stem = filename.trim_end_matches(".yaml");
    let mut counter = 2;

    loop {
        let candidate_name = format!("{stem}-{counter}.yaml");
        let candidate_path = dir.join(&candidate_name);
        if !candidate_path.exists() {
            return candidate_name;
        }
        counter += 1;
    }
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
    fn test_write_experiment_config_success() {
        let (_temp_dir, repo_path) = create_test_repo();

        let yaml_content = r#"metadata:
  id: exp-2026-02-06-test
  version: "1.0"
  created: "2026-02-06T14:30:00Z"
"#;

        let result = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "2026-02-06-test.yaml".to_string(),
            yaml_content.to_string(),
        );

        assert!(result.is_ok());
        let relative_path = result.unwrap();
        assert_eq!(relative_path, "experiments/2026-02-06-test.yaml");

        // Verify file exists
        let file_path = repo_path.join(&relative_path);
        assert!(file_path.exists());

        // Verify content
        let saved_content = fs::read_to_string(file_path).unwrap();
        assert_eq!(saved_content, yaml_content);

        // Verify Git commit
        let repo = Repository::open(repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(
            commit.message().unwrap(),
            "[unheard] Add experiment config: 2026-02-06-test.yaml"
        );
    }

    #[test]
    fn test_write_experiment_config_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize repo without experiments directory
        Repository::init(&repo_path).unwrap();

        let result = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "test.yaml".to_string(),
            "metadata: {id: test}".to_string(),
        );

        // Should succeed even though experiments directory didn't exist
        assert!(result.is_ok());

        // Verify experiments directory was created
        let experiments_dir = repo_path.join("experiments");
        assert!(experiments_dir.exists());
        assert!(experiments_dir.is_dir());
    }

    #[test]
    fn test_write_experiment_config_duplicate_handling() {
        let (_temp_dir, repo_path) = create_test_repo();

        let yaml_content = "metadata: {id: test}";

        // Write first file
        let result1 = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "2026-02-06-test.yaml".to_string(),
            yaml_content.to_string(),
        );
        assert!(result1.is_ok());
        assert_eq!(result1.unwrap(), "experiments/2026-02-06-test.yaml");

        // Write second file with same name - should get -2 suffix
        let result2 = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "2026-02-06-test.yaml".to_string(),
            yaml_content.to_string(),
        );
        assert!(result2.is_ok());
        assert_eq!(result2.unwrap(), "experiments/2026-02-06-test-2.yaml");

        // Write third file with same name - should get -3 suffix
        let result3 = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "2026-02-06-test.yaml".to_string(),
            yaml_content.to_string(),
        );
        assert!(result3.is_ok());
        assert_eq!(result3.unwrap(), "experiments/2026-02-06-test-3.yaml");

        // Verify all files exist
        assert!(repo_path
            .join("experiments/2026-02-06-test.yaml")
            .exists());
        assert!(repo_path
            .join("experiments/2026-02-06-test-2.yaml")
            .exists());
        assert!(repo_path
            .join("experiments/2026-02-06-test-3.yaml")
            .exists());
    }

    #[test]
    fn test_write_experiment_config_empty_content() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "test.yaml".to_string(),
            "   ".to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("YAML content cannot be empty"));
    }

    #[test]
    fn test_write_experiment_config_empty_filename() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "".to_string(),
            "metadata: {id: test}".to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Filename cannot be empty"));
    }

    #[test]
    fn test_write_experiment_config_invalid_extension() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = write_experiment_config(
            repo_path.to_string_lossy().to_string(),
            "test.yml".to_string(),
            "metadata: {id: test}".to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("must end with .yaml"));
    }

    #[test]
    fn test_write_experiment_config_git_failure_does_not_fail() {
        let temp_dir = TempDir::new().unwrap();
        let non_repo_path = temp_dir.path().to_path_buf();

        // Create experiments directory manually (no Git repo)
        fs::create_dir_all(non_repo_path.join("experiments")).unwrap();

        let result = write_experiment_config(
            non_repo_path.to_string_lossy().to_string(),
            "test.yaml".to_string(),
            "metadata: {id: test}".to_string(),
        );

        // Should succeed even though Git commit fails
        assert!(result.is_ok());

        // Verify file was still created
        let file_path = non_repo_path.join("experiments/test.yaml");
        assert!(file_path.exists());
    }

    #[test]
    fn test_resolve_unique_filename_no_conflict() {
        let temp_dir = TempDir::new().unwrap();
        let dir = temp_dir.path().to_path_buf();

        let result = resolve_unique_filename(&dir, "test.yaml");
        assert_eq!(result, "test.yaml");
    }

    #[test]
    fn test_resolve_unique_filename_with_conflict() {
        let temp_dir = TempDir::new().unwrap();
        let dir = temp_dir.path().to_path_buf();

        // Create existing file
        fs::write(dir.join("test.yaml"), "existing").unwrap();

        let result = resolve_unique_filename(&dir, "test.yaml");
        assert_eq!(result, "test-2.yaml");
    }

    #[test]
    fn test_resolve_unique_filename_multiple_conflicts() {
        let temp_dir = TempDir::new().unwrap();
        let dir = temp_dir.path().to_path_buf();

        // Create existing files
        fs::write(dir.join("test.yaml"), "existing").unwrap();
        fs::write(dir.join("test-2.yaml"), "existing").unwrap();
        fs::write(dir.join("test-3.yaml"), "existing").unwrap();

        let result = resolve_unique_filename(&dir, "test.yaml");
        assert_eq!(result, "test-4.yaml");
    }
}
