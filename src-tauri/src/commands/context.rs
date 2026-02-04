//! Context file upload and parsing commands.
//!
//! Handles uploading and parsing CSV, PDF, and Excel files to project context directory.
//! Uses spawn_blocking for heavy I/O operations and Tauri channels for progress updates.

use crate::types::{ContextFileRecord, UploadProgress};
use calamine::{open_workbook_auto, Reader};
use csv::ReaderBuilder;
use git2::Repository;
use lopdf::Document;
use std::fs;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::{Path, PathBuf};
use tauri::ipc::Channel;

/// Maximum size for preview text (500 characters as per spec)
const MAX_PREVIEW_CHARS: usize = 500;

/// Large File Storage threshold (10MB)
const LFS_THRESHOLD_BYTES: u64 = 10_485_760;

/// Sanitize a filename for safe filesystem storage.
/// Converts to lowercase, replaces spaces/special chars with hyphens.
fn sanitize_filename(filename: &str) -> String {
    // Extract extension
    let path = Path::new(filename);
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().unwrap_or_default().to_string_lossy();

    // Slugify the stem (lowercase, replace non-alphanumeric with hyphens)
    let slugified = stem
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        // Remove consecutive hyphens
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    // Add extension back
    if ext.is_empty() {
        slugified
    } else {
        format!("{slugified}.{ext}")
    }
}

/// Parse CSV file and extract metadata.
fn parse_csv(path: &Path) -> Result<ContextFileRecord, String> {
    log::debug!("Parsing CSV file: {path:?}");

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read CSV file: {e}"))?;

    let mut reader = ReaderBuilder::new()
        .flexible(true) // Handle variable column counts
        .from_reader(content.as_bytes());

    // Extract headers
    let headers = reader
        .headers()
        .map_err(|e| format!("Failed to read CSV headers: {e}"))?;

    let columns: Vec<String> = headers.iter().map(|h| h.to_string()).collect();

    // Count rows (excluding header)
    let rows = reader.records().count() as u32;

    // Generate preview (first 10 rows)
    let mut preview_reader = ReaderBuilder::new()
        .flexible(true)
        .from_reader(content.as_bytes());

    let mut preview_lines = Vec::new();

    // Add header
    if let Ok(headers) = preview_reader.headers() {
        preview_lines.push(headers.iter().collect::<Vec<_>>().join(","));
    }

    // Add up to 10 data rows
    for record in preview_reader.records().take(10).flatten() {
        preview_lines.push(record.iter().collect::<Vec<_>>().join(","));
    }

    let preview = preview_lines.join("\n");
    let preview = if preview.len() > MAX_PREVIEW_CHARS {
        format!("{}...", &preview[..MAX_PREVIEW_CHARS])
    } else {
        preview
    };

    // Detect type from column names (simple heuristic)
    let detected_type = detect_csv_type(&columns);

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {e}"))?;

    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let stored_filename = sanitize_filename(&filename);

    Ok(ContextFileRecord {
        original_filename: filename,
        stored_filename: stored_filename.clone(),
        file_type: "csv".to_string(),
        detected_type,
        rows: Some(rows),
        columns: Some(columns),
        preview: Some(preview),
        pages: None,
        text_preview: None,
        size_bytes: metadata.len(),
        relative_file_path: format!("context/{stored_filename}"),
        is_lfs: metadata.len() > LFS_THRESHOLD_BYTES,
    })
}

/// Simple heuristic to detect CSV data type from column names.
fn detect_csv_type(columns: &[String]) -> Option<String> {
    let cols_lower: Vec<String> = columns.iter().map(|c| c.to_lowercase()).collect();

    if cols_lower
        .iter()
        .any(|c| c.contains("customer") || c.contains("user"))
    {
        Some("customer_data".to_string())
    } else if cols_lower
        .iter()
        .any(|c| c.contains("sale") || c.contains("revenue"))
    {
        Some("sales_data".to_string())
    } else if cols_lower.iter().any(|c| c.contains("product")) {
        Some("product_data".to_string())
    } else {
        None
    }
}

/// Parse PDF file and extract metadata.
/// Uses catch_unwind for stability as PDFs can be unpredictable.
fn parse_pdf(path: &Path) -> Result<ContextFileRecord, String> {
    log::debug!("Parsing PDF file: {path:?}");

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {e}"))?;

    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let stored_filename = sanitize_filename(&filename);

    // Wrap PDF parsing in catch_unwind for stability
    let parse_result = catch_unwind(AssertUnwindSafe(|| Document::load(path)));

    let (pages, text_preview) = match parse_result {
        Ok(Ok(doc)) => {
            let page_count = doc.get_pages().len() as u32;

            // Try to extract text from first page
            let text = extract_pdf_text(&doc).unwrap_or_default();
            let preview = if text.len() > MAX_PREVIEW_CHARS {
                format!("{}...", &text[..MAX_PREVIEW_CHARS])
            } else if text.is_empty() {
                "(Image-based PDF, no text extracted)".to_string()
            } else {
                text
            };

            (Some(page_count), Some(preview))
        }
        Ok(Err(e)) => {
            log::warn!("Failed to parse PDF: {e}");
            (None, Some("(Failed to parse PDF)".to_string()))
        }
        Err(_) => {
            log::warn!("PDF parsing panicked, likely corrupted file");
            (None, Some("(Corrupted PDF)".to_string()))
        }
    };

    Ok(ContextFileRecord {
        original_filename: filename,
        stored_filename: stored_filename.clone(),
        file_type: "pdf".to_string(),
        detected_type: None,
        rows: None,
        columns: None,
        preview: None,
        pages,
        text_preview,
        size_bytes: metadata.len(),
        relative_file_path: format!("context/{stored_filename}"),
        is_lfs: metadata.len() > LFS_THRESHOLD_BYTES,
    })
}

/// Extract text from PDF document (best effort).
fn extract_pdf_text(doc: &Document) -> Result<String, String> {
    let mut text = String::new();

    for (_page_num, page_id) in doc.get_pages().iter().take(1) {
        // Only extract from first page
        // page_id is a tuple (object_id, generation), we need just the first element
        if let Ok(content) = doc.extract_text(&[page_id.0]) {
            text.push_str(&content);
        }
    }

    Ok(text)
}

/// Parse Excel file and extract metadata.
fn parse_excel(path: &Path) -> Result<ContextFileRecord, String> {
    log::debug!("Parsing Excel file: {path:?}");

    let mut workbook =
        open_workbook_auto(path).map_err(|e| format!("Failed to open Excel file: {e}"))?;

    // Get first sheet
    let sheet_names = workbook.sheet_names().to_vec();
    if sheet_names.is_empty() {
        return Err("Excel file has no sheets".to_string());
    }

    let sheet_name = &sheet_names[0];
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|e| format!("Failed to read sheet {sheet_name}: {e}"))?;

    // Extract dimensions
    let (rows, cols) = range.get_size();

    // Extract headers (first row)
    let mut columns = Vec::new();
    if rows > 0 {
        for col_idx in 0..cols {
            if let Some(cell) = range.get_value((0_u32, col_idx as u32)) {
                columns.push(cell.to_string());
            }
        }
    }

    // Generate preview (first 10 rows)
    let mut preview_lines = Vec::new();
    for row_idx in 0..rows.min(10) {
        let mut row_values = Vec::new();
        for col_idx in 0..cols {
            if let Some(cell) = range.get_value((row_idx as u32, col_idx as u32)) {
                row_values.push(cell.to_string());
            } else {
                row_values.push(String::new());
            }
        }
        preview_lines.push(row_values.join(","));
    }

    let preview = preview_lines.join("\n");
    let preview = if preview.len() > MAX_PREVIEW_CHARS {
        format!("{}...", &preview[..MAX_PREVIEW_CHARS])
    } else {
        preview
    };

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to read file metadata: {e}"))?;

    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let stored_filename = sanitize_filename(&filename);

    // Detect type from column names
    let detected_type = if !columns.is_empty() {
        detect_csv_type(&columns)
    } else {
        None
    };

    Ok(ContextFileRecord {
        original_filename: filename,
        stored_filename: stored_filename.clone(),
        file_type: "excel".to_string(),
        detected_type,
        rows: Some((rows.saturating_sub(1)) as u32), // Exclude header row
        columns: Some(columns),
        preview: Some(preview),
        pages: None,
        text_preview: None,
        size_bytes: metadata.len(),
        relative_file_path: format!("context/{stored_filename}"),
        is_lfs: metadata.len() > LFS_THRESHOLD_BYTES,
    })
}

/// Upload a context file to the project.
///
/// Parses the file (CSV/PDF/Excel), copies it to the project's context directory,
/// and commits it to Git. Sends progress updates via channel.
#[tauri::command]
#[specta::specta]
pub async fn upload_context_file(
    path: String,
    project_id: String,
    on_progress: Channel<UploadProgress>,
) -> Result<ContextFileRecord, String> {
    log::info!("Uploading context file: {path} to project {project_id}");

    // Spawn blocking task for heavy I/O
    let result = tokio::task::spawn_blocking(move || {
        // Progress: Start parsing
        let _ = on_progress.send(UploadProgress::Parsing { percent: 10 });

        let source_path = PathBuf::from(&path);
        if !source_path.exists() {
            return Err("File does not exist".to_string());
        }

        // Parse file based on extension
        let extension = source_path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();

        let record = match extension.as_str() {
            "csv" => parse_csv(&source_path)?,
            "pdf" => parse_pdf(&source_path)?,
            "xlsx" | "xls" => parse_excel(&source_path)?,
            _ => return Err(format!("Unsupported file type: {extension}")),
        };

        let _ = on_progress.send(UploadProgress::Parsing { percent: 50 });

        // Copy file to project context directory
        // For now, assume project_id is the directory path
        // TODO: Once project management is implemented, look up project path from ID
        let project_path = PathBuf::from(&project_id);
        let context_dir = project_path.join("context");

        if !context_dir.exists() {
            return Err(format!(
                "Project context directory does not exist: {context_dir:?}"
            ));
        }

        let dest_path = context_dir.join(&record.stored_filename);

        // Check if file already exists
        if dest_path.exists() {
            return Err(format!(
                "File {} already exists in project context",
                record.stored_filename
            ));
        }

        let _ = on_progress.send(UploadProgress::Copying { percent: 60 });

        // Copy file
        fs::copy(&source_path, &dest_path)
            .map_err(|e| format!("Failed to copy file to project: {e}"))?;

        log::debug!("Copied file to {dest_path:?}");

        let _ = on_progress.send(UploadProgress::Copying { percent: 80 });

        // Git commit
        let _ = on_progress.send(UploadProgress::Committing { percent: 90 });

        let repo = Repository::open(&project_path)
            .map_err(|e| format!("Failed to open Git repository: {e}"))?;

        let mut index = repo
            .index()
            .map_err(|e| format!("Failed to get repository index: {e}"))?;

        // Stage the new file
        let relative_path = format!("context/{}", record.stored_filename);
        index
            .add_path(Path::new(&relative_path))
            .map_err(|e| format!("Failed to stage file: {e}"))?;

        index
            .write()
            .map_err(|e| format!("Failed to write index: {e}"))?;

        // Create commit
        let tree_id = index
            .write_tree()
            .map_err(|e| format!("Failed to write tree: {e}"))?;

        let tree = repo
            .find_tree(tree_id)
            .map_err(|e| format!("Failed to find tree: {e}"))?;

        let signature = repo
            .signature()
            .or_else(|_| git2::Signature::now("Unheard User", "user@unheard.local"))
            .map_err(|e| format!("Failed to create signature: {e}"))?;

        let parent_commit = repo
            .head()
            .and_then(|head| head.peel_to_commit())
            .map_err(|e| format!("Failed to get HEAD commit: {e}"))?;

        let commit_message = format!(
            "Add context file: {}\n\nFile type: {}\nSize: {} bytes",
            record.original_filename, record.file_type, record.size_bytes
        );

        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            &commit_message,
            &tree,
            &[&parent_commit],
        )
        .map_err(|e| format!("Failed to create commit: {e}"))?;

        log::info!(
            "Created commit for context file: {}",
            record.original_filename
        );

        let _ = on_progress.send(UploadProgress::Complete {
            record: record.clone(),
        });

        Ok(record)
    })
    .await
    .map_err(|e| format!("Task panicked: {e}"))??;

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("My File (1).csv"), "my-file-1.csv");
        assert_eq!(sanitize_filename("Report 2024.pdf"), "report-2024.pdf");
        assert_eq!(sanitize_filename("data__test.xlsx"), "data-test.xlsx");
        assert_eq!(sanitize_filename("simple.csv"), "simple.csv");
    }

    #[test]
    fn test_parse_csv_basic() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("test.csv");

        let csv_content = "name,age,city\nAlice,30,NYC\nBob,25,SF\nCharlie,35,LA\n";
        fs::write(&csv_path, csv_content).unwrap();

        let record = parse_csv(&csv_path).unwrap();

        assert_eq!(record.file_type, "csv");
        assert_eq!(record.rows, Some(3));
        assert_eq!(
            record.columns,
            Some(vec![
                "name".to_string(),
                "age".to_string(),
                "city".to_string()
            ])
        );
        assert!(record.preview.is_some());
        assert_eq!(record.is_lfs, false);
    }

    #[test]
    fn test_parse_csv_with_detection() {
        let temp_dir = TempDir::new().unwrap();
        let csv_path = temp_dir.path().join("customers.csv");

        let csv_content = "customer_id,customer_name,email\n1,Alice,alice@example.com\n";
        fs::write(&csv_path, csv_content).unwrap();

        let record = parse_csv(&csv_path).unwrap();

        assert_eq!(record.detected_type, Some("customer_data".to_string()));
    }

    #[test]
    fn test_parse_pdf_basic() {
        // Note: This test would need a valid PDF file to fully test
        // For now, just test error handling with a non-PDF file
        let temp_dir = TempDir::new().unwrap();
        let pdf_path = temp_dir.path().join("test.pdf");

        fs::write(&pdf_path, "Not a real PDF").unwrap();

        let record = parse_pdf(&pdf_path).unwrap();

        assert_eq!(record.file_type, "pdf");
        assert!(record.text_preview.is_some());
    }

    #[test]
    fn test_lfs_threshold() {
        let temp_dir = TempDir::new().unwrap();
        let large_csv_path = temp_dir.path().join("large.csv");

        // Create a file larger than 10MB
        let mut file = fs::File::create(&large_csv_path).unwrap();
        let large_data = vec![b'A'; (LFS_THRESHOLD_BYTES + 1000) as usize];
        file.write_all(&large_data).unwrap();

        let record = parse_csv(&large_csv_path).unwrap();

        assert_eq!(record.is_lfs, true);
    }

    #[test]
    fn test_detect_csv_type() {
        let customer_cols = vec!["customer_id".to_string(), "name".to_string()];
        assert_eq!(
            detect_csv_type(&customer_cols),
            Some("customer_data".to_string())
        );

        let sales_cols = vec!["date".to_string(), "revenue".to_string()];
        assert_eq!(detect_csv_type(&sales_cols), Some("sales_data".to_string()));

        let product_cols = vec!["product_id".to_string(), "price".to_string()];
        assert_eq!(
            detect_csv_type(&product_cols),
            Some("product_data".to_string())
        );

        let generic_cols = vec!["id".to_string(), "value".to_string()];
        assert_eq!(detect_csv_type(&generic_cols), None);
    }
}
