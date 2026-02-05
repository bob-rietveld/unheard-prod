//! Project management and Git initialization commands.
//!
//! Handles project initialization with Git, LFS detection, and directory structure setup.

use git2::Repository;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::fs;
use std::ops::Not;
use std::path::PathBuf;
use std::process::Command;

/// Result of Git initialization.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct GitInitResult {
    pub success: bool,
    pub path: String,
    pub lfs_available: bool,
    pub commit_hash: Option<String>,
}

/// Initialize a Git repository for a project with proper directory structure.
///
/// Creates the following structure:
/// - context/ - for uploaded files
/// - decisions/ - for decision records
/// - experiments/ - for experiment results
/// - .gitattributes - LFS rules for PDF and Excel files
/// - README.md - initial project documentation
#[tauri::command]
#[specta::specta]
pub fn initialize_git(path: PathBuf) -> Result<GitInitResult, String> {
    log::info!("Initializing Git repository at {path:?}");

    // Validate directory is safe to initialize
    if !path.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // Check if .git already exists
    if path.join(".git").exists() {
        return Err("Directory already contains a Git repository (.git exists)".to_string());
    }

    // Check if directory is empty or only contains hidden files
    let entries: Vec<_> = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read directory entry: {e}"))?
        .into_iter()
        .filter(|entry| {
            // Allow hidden files/folders (starting with .)
            entry.file_name().to_string_lossy().starts_with('.').not()
        })
        .collect();

    if !entries.is_empty() {
        log::warn!("Directory is not empty: {path:?}");
        return Err(format!(
            "Directory must be empty to initialize a new project. Found {} file(s)/folder(s).",
            entries.len()
        ));
    }

    // Initialize Git repository
    let repo = Repository::init(&path).map_err(|e| {
        log::error!("Failed to initialize Git repository: {e}");
        format!("Failed to initialize Git repository: {e}")
    })?;

    // Create directory structure
    let directories = ["context", "decisions", "experiments"];
    for dir in directories {
        let dir_path = path.join(dir);
        fs::create_dir_all(&dir_path).map_err(|e| {
            log::error!("Failed to create directory {dir}: {e}");
            format!("Failed to create directory {dir}: {e}")
        })?;
        log::debug!("Created directory: {dir_path:?}");
    }

    // Create .gitattributes with LFS rules (PDF and Excel only, NOT CSV)
    let gitattributes_content = r#"# Git LFS tracking for large files
context/**/*.pdf filter=lfs diff=lfs merge=lfs -text
context/**/*.xlsx filter=lfs diff=lfs merge=lfs -text
"#;

    let gitattributes_path = path.join(".gitattributes");
    fs::write(&gitattributes_path, gitattributes_content).map_err(|e| {
        log::error!("Failed to write .gitattributes: {e}");
        format!("Failed to write .gitattributes: {e}")
    })?;
    log::debug!("Created .gitattributes at {gitattributes_path:?}");

    // Create README.md
    let readme_content = r#"# Unheard Project

This directory contains context files, decisions, and experiment results for your project.

## Directory Structure

- `context/` - Uploaded context files (CSV, PDF, Excel)
- `decisions/` - Decision records and analysis
- `experiments/` - Experiment configurations and results

## Git LFS

This project uses Git LFS for large files (PDF and Excel files in context/).
If you don't have Git LFS installed, you can continue without it, but large files
may impact repository performance.

Install Git LFS: https://git-lfs.github.com/
"#;

    let readme_path = path.join("README.md");
    fs::write(&readme_path, readme_content).map_err(|e| {
        log::error!("Failed to write README.md: {e}");
        format!("Failed to write README.md: {e}")
    })?;
    log::debug!("Created README.md at {readme_path:?}");

    // Check if LFS is available
    let lfs_available = detect_git_lfs().unwrap_or(false);
    if !lfs_available {
        log::warn!("Git LFS not detected, continuing without LFS support");
    }

    // Stage all files
    let mut index = repo.index().map_err(|e| {
        log::error!("Failed to get repository index: {e}");
        format!("Failed to get repository index: {e}")
    })?;

    index
        .add_all(["."], git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| {
            log::error!("Failed to stage files: {e}");
            format!("Failed to stage files: {e}")
        })?;

    index.write().map_err(|e| {
        log::error!("Failed to write index: {e}");
        format!("Failed to write index: {e}")
    })?;

    // Create initial commit
    let tree_id = index.write_tree().map_err(|e| {
        log::error!("Failed to write tree: {e}");
        format!("Failed to write tree: {e}")
    })?;

    let tree = repo.find_tree(tree_id).map_err(|e| {
        log::error!("Failed to find tree: {e}");
        format!("Failed to find tree: {e}")
    })?;

    // Try to get signature from Git config, fall back to default if not configured
    let signature = repo
        .signature()
        .or_else(|_| {
            log::warn!("Git user not configured, using default signature");
            git2::Signature::now("Unheard User", "user@unheard.local")
        })
        .map_err(|e| {
            log::error!("Failed to create signature: {e}");
            format!("Failed to create signature: {e}")
        })?;

    let commit_id = repo
        .commit(
            Some("HEAD"),
            &signature,
            &signature,
            "Initial commit: Set up project structure",
            &tree,
            &[],
        )
        .map_err(|e| {
            log::error!("Failed to create commit: {e}");
            format!("Failed to create commit: {e}")
        })?;

    let commit_hash = commit_id.to_string();
    log::info!("Created initial commit: {commit_hash}");

    Ok(GitInitResult {
        success: true,
        path: path.to_string_lossy().to_string(),
        lfs_available,
        commit_hash: Some(commit_hash),
    })
}

/// Detect if Git LFS is installed and available.
///
/// Returns true if `git-lfs version` command succeeds.
#[tauri::command]
#[specta::specta]
pub fn detect_git_lfs() -> Result<bool, String> {
    log::debug!("Detecting Git LFS availability");

    match Command::new("git-lfs").arg("version").output() {
        Ok(output) => {
            let available = output.status.success();
            if available {
                log::info!("Git LFS detected");
            } else {
                log::warn!("Git LFS command failed");
            }
            Ok(available)
        }
        Err(e) => {
            log::debug!("Git LFS not found: {e}");
            Ok(false)
        }
    }
}

/// Information about a file in the project directory.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectFile {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub is_supported: bool,
}

/// List all files in a project directory recursively.
///
/// Filters for supported file types (CSV, PDF, XLSX, XLS) and returns
/// file metadata for display and selection.
#[tauri::command]
#[specta::specta]
pub fn list_project_files(project_path: PathBuf) -> Result<Vec<ProjectFile>, String> {
    log::info!("Listing files in project directory: {project_path:?}");

    if !project_path.exists() {
        return Err("Project directory does not exist".to_string());
    }

    if !project_path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let supported_extensions = vec!["csv", "pdf", "xlsx", "xls"];
    let mut files = Vec::new();

    fn scan_directory(
        dir: &PathBuf,
        base_path: &PathBuf,
        supported_exts: &[&str],
        files: &mut Vec<ProjectFile>,
    ) -> Result<(), String> {
        let entries = fs::read_dir(dir)
            .map_err(|e| format!("Failed to read directory {dir:?}: {e}"))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
            let path = entry.path();

            // Skip hidden files and directories
            if let Some(name) = path.file_name() {
                if name.to_string_lossy().starts_with('.') {
                    continue;
                }
            }

            if path.is_dir() {
                // Recursively scan subdirectories
                scan_directory(&path, base_path, supported_exts, files)?;
            } else if path.is_file() {
                let extension = path
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| s.to_lowercase())
                    .unwrap_or_default();

                let is_supported = supported_exts.contains(&extension.as_str());

                // Get relative path from project root
                let relative_path = path
                    .strip_prefix(base_path)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                let name = path
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                let size = fs::metadata(&path)
                    .map(|m| m.len())
                    .unwrap_or(0);

                files.push(ProjectFile {
                    path: relative_path,
                    name,
                    extension,
                    size,
                    is_supported,
                });
            }
        }

        Ok(())
    }

    scan_directory(&project_path, &project_path, &supported_extensions, &mut files)?;

    log::info!("Found {} files in project", files.len());
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_initialize_git_creates_structure() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_path_buf();

        let result = initialize_git(project_path.clone()).unwrap();

        assert!(result.success);
        assert!(project_path.join("context").exists());
        assert!(project_path.join("decisions").exists());
        assert!(project_path.join("experiments").exists());
        assert!(project_path.join(".gitattributes").exists());
        assert!(project_path.join("README.md").exists());
        assert!(project_path.join(".git").exists());
    }

    #[test]
    fn test_gitattributes_content() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_path_buf();

        initialize_git(project_path.clone()).unwrap();

        let gitattributes = fs::read_to_string(project_path.join(".gitattributes")).unwrap();
        assert!(gitattributes.contains("context/**/*.pdf filter=lfs"));
        assert!(gitattributes.contains("context/**/*.xlsx filter=lfs"));
        assert!(!gitattributes.contains("*.csv")); // CSV should NOT be in LFS
    }

    #[test]
    fn test_detect_git_lfs_returns_bool() {
        // This test just verifies the function returns without error
        // Actual availability depends on system configuration
        let result = detect_git_lfs();
        assert!(result.is_ok());
    }

    #[test]
    fn test_initialize_git_creates_commit() {
        let temp_dir = TempDir::new().unwrap();
        let project_path = temp_dir.path().to_path_buf();

        let result = initialize_git(project_path.clone()).unwrap();

        assert!(result.commit_hash.is_some());
        assert!(!result.commit_hash.unwrap().is_empty());

        // Verify we can open the repo and read the commit
        let repo = Repository::open(project_path).unwrap();
        let head = repo.head().unwrap();
        assert!(head.is_branch());
    }
}
