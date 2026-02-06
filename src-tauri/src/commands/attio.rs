//! Attio CRM import commands.
//!
//! Handles saving imported Attio records as JSON files and auto-committing to Git.

use crate::commands::git::git_auto_commit;
use std::fs;
use std::path::PathBuf;

/// Save an Attio CRM record as a JSON file and commit it to Git.
///
/// # Arguments
/// * `project_path` - Path to the project root (Git repository)
/// * `object_type` - Attio object type: "company", "person", or "list_entry"
/// * `record_id` - Attio record UUID (for logging)
/// * `filename` - Filename without extension (e.g., "acme-corp")
/// * `json_content` - JSON content to write
///
/// # Returns
/// The relative file path on success (e.g., "attio/company/acme-corp.json")
#[tauri::command]
#[specta::specta]
pub fn save_attio_import(
    project_path: String,
    object_type: String,
    record_id: String,
    filename: String,
    json_content: String,
) -> Result<String, String> {
    log::info!("Saving Attio import: type={object_type}, id={record_id}, file={filename}");

    // Validate object_type
    if !["company", "person", "list_entry"].contains(&object_type.as_str()) {
        return Err(format!("Invalid object type: {object_type}"));
    }

    if filename.trim().is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if json_content.trim().is_empty() {
        return Err("JSON content cannot be empty".to_string());
    }

    let base_path = PathBuf::from(&project_path);
    let dir_path = base_path.join("attio").join(&object_type);
    let relative_path = format!("attio/{object_type}/{filename}.json");
    let file_path = base_path.join(&relative_path);

    // Create directory
    if !dir_path.exists() {
        log::debug!("Creating attio directory: {dir_path:?}");
        fs::create_dir_all(&dir_path).map_err(|e| {
            log::error!("Failed to create directory: {e}");
            format!("Failed to create directory: {e}")
        })?;
    }

    // Write JSON file
    log::debug!("Writing Attio import to: {file_path:?}");
    fs::write(&file_path, &json_content).map_err(|e| {
        log::error!("Failed to write file: {e}");
        format!("Failed to write file: {e}")
    })?;

    log::info!("Written Attio import to {relative_path}");

    // Git commit
    let commit_message = format!("Import Attio {object_type}: {filename}");
    match git_auto_commit(base_path, vec![relative_path.clone()], commit_message) {
        Ok(commit_hash) => {
            log::info!("Attio import committed: {commit_hash}");
        }
        Err(e) => {
            log::error!("Git commit failed: {e}");
            log::warn!("Attio import saved but not committed");
            // Don't fail the operation - file was saved successfully
        }
    }

    Ok(relative_path)
}

/// A single entry in a batch Attio import operation.
#[derive(Debug, Clone, serde::Deserialize, specta::Type)]
pub struct AttioImportEntry {
    pub object_type: String,
    pub record_id: String,
    pub filename: String,
    pub json_content: String,
}

/// Save multiple Attio CRM records as JSON files in a single batch operation.
///
/// Validates all entries first, writes all files, then creates a single Git commit.
/// If git fails, returns the paths anyway (files are still saved).
///
/// # Arguments
/// * `project_path` - Path to the project root (Git repository)
/// * `imports` - Vector of import entries to save
///
/// # Returns
/// A vector of relative file paths on success (e.g., ["attio/company/acme.json", ...])
#[tauri::command]
#[specta::specta]
pub fn batch_save_attio_imports(
    project_path: String,
    imports: Vec<AttioImportEntry>,
) -> Result<Vec<String>, String> {
    log::info!("Batch saving {} Attio imports", imports.len());

    if imports.is_empty() {
        return Err("No imports provided".to_string());
    }

    // Phase 1: Validate all entries before writing any files
    for (i, entry) in imports.iter().enumerate() {
        if !["company", "person", "list_entry"].contains(&entry.object_type.as_str()) {
            return Err(format!(
                "Entry {i}: invalid object type: {}",
                entry.object_type
            ));
        }
        if entry.filename.trim().is_empty() {
            return Err(format!("Entry {i}: filename cannot be empty"));
        }
        if entry.json_content.trim().is_empty() {
            return Err(format!("Entry {i}: JSON content cannot be empty"));
        }
    }

    let base_path = PathBuf::from(&project_path);
    let mut relative_paths: Vec<String> = Vec::with_capacity(imports.len());

    // Phase 2: Write all files
    for entry in &imports {
        let dir_path = base_path.join("attio").join(&entry.object_type);
        let relative_path = format!("attio/{}/{}.json", entry.object_type, entry.filename);
        let file_path = base_path.join(&relative_path);

        // Create directory if needed
        if !dir_path.exists() {
            log::debug!("Creating attio directory: {dir_path:?}");
            fs::create_dir_all(&dir_path).map_err(|e| {
                log::error!("Failed to create directory: {e}");
                format!("Failed to create directory: {e}")
            })?;
        }

        // Write JSON file
        log::debug!("Writing Attio import to: {file_path:?}");
        fs::write(&file_path, &entry.json_content).map_err(|e| {
            log::error!("Failed to write file: {e}");
            format!("Failed to write file {relative_path}: {e}")
        })?;

        relative_paths.push(relative_path);
    }

    log::info!("Written {} Attio import files", relative_paths.len());

    // Phase 3: Single git commit with all paths
    let commit_message = format!("Import {} Attio records", imports.len());
    match git_auto_commit(base_path, relative_paths.clone(), commit_message) {
        Ok(commit_hash) => {
            log::info!("Batch Attio import committed: {commit_hash}");
        }
        Err(e) => {
            log::error!("Git commit failed: {e}");
            log::warn!("Attio imports saved but not committed");
            // Don't fail the operation - files were saved successfully
        }
    }

    Ok(relative_paths)
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
    fn test_save_attio_import_success() {
        let (_temp_dir, repo_path) = create_test_repo();

        let json_content = r#"{"source":"attio","objectType":"company","name":"Acme Corp"}"#;

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "company".to_string(),
            "uuid-123".to_string(),
            "acme-corp".to_string(),
            json_content.to_string(),
        );

        assert!(result.is_ok());
        let relative_path = result.unwrap();
        assert_eq!(relative_path, "attio/company/acme-corp.json");

        // Verify file exists
        let file_path = repo_path.join(&relative_path);
        assert!(file_path.exists());

        // Verify content
        let saved_content = fs::read_to_string(file_path).unwrap();
        assert_eq!(saved_content, json_content);

        // Verify Git commit
        let repo = Repository::open(repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(
            commit.message().unwrap(),
            "Import Attio company: acme-corp"
        );
    }

    #[test]
    fn test_save_attio_import_creates_directory() {
        let temp_dir = TempDir::new().unwrap();
        let repo_path = temp_dir.path().to_path_buf();

        // Initialize repo without attio directory
        Repository::init(&repo_path).unwrap();

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "person".to_string(),
            "uuid-456".to_string(),
            "jane-doe".to_string(),
            r#"{"name":"Jane Doe"}"#.to_string(),
        );

        // Should succeed even though attio directory didn't exist
        assert!(result.is_ok());

        // Verify directory was created
        let attio_dir = repo_path.join("attio/person");
        assert!(attio_dir.exists());
        assert!(attio_dir.is_dir());
    }

    #[test]
    fn test_save_attio_import_invalid_object_type() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "invalid_type".to_string(),
            "uuid-123".to_string(),
            "test".to_string(),
            r#"{"name":"Test"}"#.to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Invalid object type"));
    }

    #[test]
    fn test_save_attio_import_empty_filename() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "company".to_string(),
            "uuid-123".to_string(),
            "".to_string(),
            r#"{"name":"Test"}"#.to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Filename cannot be empty"));
    }

    #[test]
    fn test_save_attio_import_empty_content() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "company".to_string(),
            "uuid-123".to_string(),
            "test".to_string(),
            "   ".to_string(),
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("JSON content cannot be empty"));
    }

    #[test]
    fn test_save_attio_import_list_entry_type() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = save_attio_import(
            repo_path.to_string_lossy().to_string(),
            "list_entry".to_string(),
            "uuid-789".to_string(),
            "top-prospects-entry-1".to_string(),
            r#"{"name":"Entry 1"}"#.to_string(),
        );

        assert!(result.is_ok());
        assert_eq!(
            result.unwrap(),
            "attio/list_entry/top-prospects-entry-1.json"
        );
    }

    #[test]
    fn test_save_attio_import_git_failure_does_not_fail() {
        let temp_dir = TempDir::new().unwrap();
        let non_repo_path = temp_dir.path().to_path_buf();

        // Create attio directory manually (no Git repo)
        fs::create_dir_all(non_repo_path.join("attio/company")).unwrap();

        let result = save_attio_import(
            non_repo_path.to_string_lossy().to_string(),
            "company".to_string(),
            "uuid-123".to_string(),
            "test".to_string(),
            r#"{"name":"Test"}"#.to_string(),
        );

        // Should succeed even though Git commit fails
        assert!(result.is_ok());

        // Verify file was still created
        let file_path = non_repo_path.join("attio/company/test.json");
        assert!(file_path.exists());
    }

    // -----------------------------------------------------------------------
    // batch_save_attio_imports tests
    // -----------------------------------------------------------------------

    fn make_entry(object_type: &str, filename: &str, record_id: &str) -> AttioImportEntry {
        AttioImportEntry {
            object_type: object_type.to_string(),
            record_id: record_id.to_string(),
            filename: filename.to_string(),
            json_content: format!(r#"{{"id":"{record_id}","name":"{filename}"}}"#),
        }
    }

    #[test]
    fn test_batch_save_success() {
        let (_temp_dir, repo_path) = create_test_repo();

        let imports = vec![
            make_entry("company", "acme-corp", "uuid-1"),
            make_entry("company", "globex", "uuid-2"),
            make_entry("person", "jane-doe", "uuid-3"),
        ];

        let result = batch_save_attio_imports(
            repo_path.to_string_lossy().to_string(),
            imports,
        );

        assert!(result.is_ok());
        let paths = result.unwrap();
        assert_eq!(paths.len(), 3);
        assert_eq!(paths[0], "attio/company/acme-corp.json");
        assert_eq!(paths[1], "attio/company/globex.json");
        assert_eq!(paths[2], "attio/person/jane-doe.json");

        // Verify all files exist
        for path in &paths {
            assert!(repo_path.join(path).exists());
        }

        // Verify single git commit (not 3 separate commits)
        let repo = Repository::open(&repo_path).unwrap();
        let head = repo.head().unwrap();
        let commit = head.peel_to_commit().unwrap();
        assert_eq!(commit.message().unwrap(), "Import 3 Attio records");

        // Parent should be the initial commit, not another import commit
        assert_eq!(commit.parent_count(), 1);
        let parent = commit.parent(0).unwrap();
        assert_eq!(parent.message().unwrap(), "Initial commit");
    }

    #[test]
    fn test_batch_save_empty_vec() {
        let (_temp_dir, repo_path) = create_test_repo();

        let result = batch_save_attio_imports(
            repo_path.to_string_lossy().to_string(),
            vec![],
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No imports provided"));
    }

    #[test]
    fn test_batch_save_validation_invalid_type() {
        let (_temp_dir, repo_path) = create_test_repo();

        let imports = vec![
            make_entry("company", "acme", "uuid-1"),
            make_entry("invalid", "bad", "uuid-2"),
        ];

        let result = batch_save_attio_imports(
            repo_path.to_string_lossy().to_string(),
            imports,
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.contains("Entry 1"));
        assert!(err.contains("invalid object type"));

        // Verify no files were written (validation fails before writing)
        assert!(!repo_path.join("attio/company/acme.json").exists());
    }

    #[test]
    fn test_batch_save_validation_empty_filename() {
        let (_temp_dir, repo_path) = create_test_repo();

        let imports = vec![AttioImportEntry {
            object_type: "company".to_string(),
            record_id: "uuid-1".to_string(),
            filename: "  ".to_string(),
            json_content: r#"{"name":"Test"}"#.to_string(),
        }];

        let result = batch_save_attio_imports(
            repo_path.to_string_lossy().to_string(),
            imports,
        );

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("filename cannot be empty"));
    }

    #[test]
    fn test_batch_save_git_failure_still_returns_paths() {
        let temp_dir = TempDir::new().unwrap();
        let non_repo_path = temp_dir.path().to_path_buf();

        // No git repo, but create base directory
        let imports = vec![make_entry("company", "acme", "uuid-1")];

        let result = batch_save_attio_imports(
            non_repo_path.to_string_lossy().to_string(),
            imports,
        );

        // Should succeed (files saved) even though git fails
        assert!(result.is_ok());
        let paths = result.unwrap();
        assert_eq!(paths.len(), 1);

        // Verify file was still created
        assert!(non_repo_path.join("attio/company/acme.json").exists());
    }
}
