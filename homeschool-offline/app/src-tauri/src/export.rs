use std::fs::File;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;
use serde_json::json;

use crate::db;

/// Export all data to a ZIP file
pub fn export_data(app: &AppHandle, dest_path: &str) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = db::get_db_path(app)?;
    let photos_dir = app_data_dir.join("photos");

    // Create ZIP file
    let file = File::create(dest_path)
        .map_err(|e| format!("Failed to create ZIP file: {}", e))?;

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Add database file
    if db_path.exists() {
        let mut db_file = File::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        zip.start_file("data.sqlite3", options)
            .map_err(|e| format!("Failed to add database to ZIP: {}", e))?;

        let mut buffer = Vec::new();
        db_file.read_to_end(&mut buffer)
            .map_err(|e| format!("Failed to read database: {}", e))?;

        zip.write_all(&buffer)
            .map_err(|e| format!("Failed to write database to ZIP: {}", e))?;
    }

    // Add photos directory recursively
    if photos_dir.exists() {
        add_directory_to_zip(&mut zip, &photos_dir, &photos_dir, options)?;
    }

    // Create manifest
    let manifest = create_manifest(app)?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to add manifest to ZIP: {}", e))?;

    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest to ZIP: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finish ZIP: {}", e))?;

    Ok(())
}

/// Add a directory recursively to ZIP
fn add_directory_to_zip(
    zip: &mut ZipWriter<File>,
    base_path: &Path,
    current_path: &Path,
    options: SimpleFileOptions,
) -> Result<(), String> {
    let entries = std::fs::read_dir(current_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() {
            let relative_path = path.strip_prefix(base_path)
                .map_err(|e| format!("Failed to get relative path: {}", e))?;

            let zip_path = format!("photos/{}", relative_path.display());

            let mut file = File::open(&path)
                .map_err(|e| format!("Failed to open file: {}", e))?;

            zip.start_file(zip_path, options)
                .map_err(|e| format!("Failed to add file to ZIP: {}", e))?;

            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            zip.write_all(&buffer)
                .map_err(|e| format!("Failed to write file to ZIP: {}", e))?;
        } else if path.is_dir() {
            add_directory_to_zip(zip, base_path, &path, options)?;
        }
    }

    Ok(())
}

/// Create export manifest
fn create_manifest(app: &AppHandle) -> Result<serde_json::Value, String> {
    let settings = db::get_settings(app)?;
    let conn = db::get_connection(app)?;

    // Get statistics
    let total_days: i64 = conn.query_row(
        "SELECT COUNT(*) FROM days",
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    let total_photos: i64 = conn.query_row(
        "SELECT COUNT(*) FROM photos",
        [],
        |row| row.get(0)
    ).unwrap_or(0);

    let earliest_date: Option<String> = conn.query_row(
        "SELECT MIN(date) FROM days",
        [],
        |row| row.get(0)
    ).ok();

    let latest_date: Option<String> = conn.query_row(
        "SELECT MAX(date) FROM days",
        [],
        |row| row.get(0)
    ).ok();

    let now = chrono::Utc::now();

    Ok(json!({
        "version": "1.0",
        "exported_at": now.to_rfc3339(),
        "app_version": "0.1.0",
        "parent_name": settings.parent_name,
        "total_days": total_days,
        "total_photos": total_photos,
        "date_range": {
            "earliest": earliest_date.unwrap_or_else(|| "".to_string()),
            "latest": latest_date.unwrap_or_else(|| "".to_string())
        }
    }))
}
