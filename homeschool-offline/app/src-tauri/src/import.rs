use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Path;
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

use crate::db;

/// Import data from a ZIP file
pub fn import_data(app: &AppHandle, source_path: &str) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create backup of current data
    backup_current_data(app)?;

    // Open ZIP file
    let file = File::open(source_path)
        .map_err(|e| format!("Failed to open ZIP file: {}", e))?;

    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP archive: {}", e))?;

    // Validate ZIP structure
    validate_zip_structure(&mut archive)?;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        let outpath = match file.enclosed_name() {
            Some(path) => app_data_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            // Directory
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // File
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }

            let mut outfile = File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;

            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file from ZIP: {}", e))?;

            outfile.write_all(&buffer)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
    }

    Ok(())
}

/// Validate ZIP structure
fn validate_zip_structure(archive: &mut ZipArchive<File>) -> Result<(), String> {
    let mut has_database = false;
    let mut has_manifest = false;

    for i in 0..archive.len() {
        let file = archive.by_index(i)
            .map_err(|e| format!("Failed to read ZIP entry: {}", e))?;

        if file.name() == "data.sqlite3" {
            has_database = true;
        } else if file.name() == "manifest.json" {
            has_manifest = true;
        }
    }

    if !has_database {
        return Err("Invalid backup file: missing database".to_string());
    }

    if !has_manifest {
        return Err("Invalid backup file: missing manifest".to_string());
    }

    Ok(())
}

/// Backup current data before import
fn backup_current_data(app: &AppHandle) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_dir = app_data_dir.join(format!("backup_{}", timestamp));

    fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    // Backup database
    let db_path = db::get_db_path(app)?;
    if db_path.exists() {
        let backup_db = backup_dir.join("data.sqlite3");
        fs::copy(&db_path, &backup_db)
            .map_err(|e| format!("Failed to backup database: {}", e))?;
    }

    // Backup photos
    let photos_dir = app_data_dir.join("photos");
    if photos_dir.exists() {
        let backup_photos = backup_dir.join("photos");
        copy_dir_all(&photos_dir, &backup_photos)?;
    }

    Ok(())
}

/// Recursively copy directory
fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

    for entry in fs::read_dir(src)
        .map_err(|e| format!("Failed to read directory: {}", e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_all(&path, &dest_path)?;
        } else {
            fs::copy(&path, &dest_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}
