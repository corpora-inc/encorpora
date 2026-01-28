use std::fs::File;
use std::io::{Cursor, Read, Write};
use std::path::Path;
use tauri::{AppHandle, Manager};

#[cfg(any(target_os = "android", target_os = "ios"))]
use tauri::{Emitter, Window};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;
use serde_json::json;
#[cfg(any(target_os = "android", target_os = "ios"))]
use std::thread;

use crate::db;

/// Export all data to bytes (in-memory ZIP)
pub fn export_data_to_bytes(app: &AppHandle) -> Result<Vec<u8>, String> {
    eprintln!("export_data_to_bytes called");

    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = db::get_db_path(app)?;
    let photos_dir = app_data_dir.join("photos");

    eprintln!("DB path: {:?}", db_path);
    eprintln!("DB exists: {}", db_path.exists());
    eprintln!("Photos dir: {:?}", photos_dir);
    eprintln!("Photos dir exists: {}", photos_dir.exists());

    // Create ZIP in memory
    let mut buffer = Vec::new();
    {
        let cursor = Cursor::new(&mut buffer);
        let mut zip = ZipWriter::new(cursor);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Add database file
        if db_path.exists() {
            eprintln!("Adding database to ZIP...");
            let mut db_file = File::open(&db_path)
                .map_err(|e| format!("Failed to open database: {}", e))?;

            zip.start_file("data.sqlite3", options)
                .map_err(|e| format!("Failed to add database to ZIP: {}", e))?;

            let mut db_buffer = Vec::new();
            db_file.read_to_end(&mut db_buffer)
                .map_err(|e| format!("Failed to read database: {}", e))?;

            eprintln!("Database size: {} bytes", db_buffer.len());

            zip.write_all(&db_buffer)
                .map_err(|e| format!("Failed to write database to ZIP: {}", e))?;
        } else {
            eprintln!("WARNING: Database file does not exist!");
        }

        // Add photos directory recursively
        if photos_dir.exists() {
            eprintln!("Adding photos directory...");
            add_directory_to_zip(&mut zip, &photos_dir, &photos_dir, options)?;
        } else {
            eprintln!("Photos directory does not exist (this is OK if no photos)");
        }

        // Create manifest
        eprintln!("Creating manifest...");
        let manifest = create_manifest(app)?;
        zip.start_file("manifest.json", options)
            .map_err(|e| format!("Failed to add manifest to ZIP: {}", e))?;

        let manifest_json = serde_json::to_string_pretty(&manifest)
            .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

        zip.write_all(manifest_json.as_bytes())
            .map_err(|e| format!("Failed to write manifest to ZIP: {}", e))?;

        eprintln!("Finishing ZIP...");
        zip.finish()
            .map_err(|e| format!("Failed to finish ZIP: {}", e))?;
    }

    eprintln!("ZIP created, buffer size: {} bytes", buffer.len());

    if buffer.is_empty() {
        return Err("Created ZIP is empty - this should never happen!".to_string());
    }

    Ok(buffer)
}

/// Export to external storage and return the path (Android)
#[cfg(target_os = "android")]
pub fn export_data_to_external(app: &AppHandle) -> Result<String, String> {
    eprintln!("export_data_to_external called");

    let bytes = export_data_to_bytes(app)?;

    eprintln!("Got {} bytes", bytes.len());

    if bytes.is_empty() {
        return Err("Created ZIP is empty!".to_string());
    }

    // Use /sdcard (external storage) which is accessible
    // This maps to /storage/emulated/0/
    let external_storage = std::path::PathBuf::from("/sdcard");
    let downloads_dir = external_storage.join("Download");

    eprintln!("Using external storage: {:?}", external_storage);
    eprintln!("Downloads directory: {:?}", downloads_dir);

    // Create Downloads directory if it doesn't exist
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Failed to create Downloads directory: {}", e))?;

    let filename = format!("homeschool-backup-{}.zip",
        chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let output_path = downloads_dir.join(&filename);

    eprintln!("Writing to: {:?}", output_path);

    std::fs::write(&output_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Verify file was written
    let metadata = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to verify file: {}", e))?;

    eprintln!("File written successfully, size: {} bytes", metadata.len());

    if metadata.len() == 0 {
        return Err("Written file is empty!".to_string());
    }

    if metadata.len() != bytes.len() as u64 {
        return Err(format!("File size mismatch! Expected {}, got {}", bytes.len(), metadata.len()));
    }

    Ok(output_path.to_string_lossy().to_string())
}

/// Export to iOS Documents directory (accessible via Files app)
#[cfg(target_os = "ios")]
pub fn export_data_to_ios_documents(app: &AppHandle) -> Result<String, String> {
    eprintln!("export_data_to_ios_documents called");

    let bytes = export_data_to_bytes(app)?;

    if bytes.is_empty() {
        return Err("Created ZIP is empty!".to_string());
    }

    // iOS: Save to temp directory - Share Sheet will handle final destination
    // This is the modern iOS approach: app creates file, user chooses where to save it
    let temp_dir = app.path().temp_dir()
        .map_err(|e| format!("Failed to get temp dir: {}", e))?;

    let filename = format!("homeschool-backup-{}.zip",
        chrono::Local::now().format("%Y%m%d-%H%M%S"));
    let output_path = temp_dir.join(&filename);

    eprintln!("[export_data_to_ios_documents] Writing to temp: {:?}", output_path);

    std::fs::write(&output_path, &bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    // Verify file was written
    let metadata = std::fs::metadata(&output_path)
        .map_err(|e| format!("Failed to verify file: {}", e))?;

    eprintln!("[export_data_to_ios_documents] File written successfully, size: {} bytes", metadata.len());

    if metadata.len() == 0 {
        return Err("Written file is empty!".to_string());
    }

    if metadata.len() != bytes.len() as u64 {
        return Err(format!("File size mismatch! Expected {}, got {}",
            bytes.len(), metadata.len()));
    }

    Ok(output_path.to_string_lossy().to_string())
}

/// Export all data to a ZIP file (uses in-memory export and writes to disk)
pub fn export_data(app: &AppHandle, dest_path: &str) -> Result<(), String> {
    let bytes = export_data_to_bytes(app)?;

    std::fs::write(dest_path, bytes)
        .map_err(|e| format!("Failed to write ZIP file: {}", e))?;

    Ok(())
}

/// Add a directory recursively to ZIP (generic over writer type)
fn add_directory_to_zip<W: Write + std::io::Seek>(
    zip: &mut ZipWriter<W>,
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

/// Progress struct for event serialization
#[cfg(any(target_os = "android", target_os = "ios"))]
#[derive(Clone, serde::Serialize)]
struct ExportProgress {
    percent: u8,
    status: String,
}

/// Async export with progress events (for mobile platforms)
#[cfg(any(target_os = "android", target_os = "ios"))]
#[tauri::command]
pub async fn export_data_async(app: AppHandle, window: Window) -> Result<String, String> {
    let app_clone = app.clone();
    let window_clone = window.clone();

    // Spawn background thread so Tauri can continue processing events
    thread::spawn(move || {
        match export_with_progress(&app_clone, &window_clone) {
            Ok(path) => {
                let _ = window_clone.emit("export_complete", path);
            }
            Err(e) => {
                let _ = window_clone.emit("export_error", e);
            }
        }
    });

    Ok("Export started".to_string())
}

/// Export with progress events
#[cfg(any(target_os = "android", target_os = "ios"))]
fn export_with_progress(app: &AppHandle, window: &Window) -> Result<String, String> {
    // Emit: Starting
    let _ = window.emit("export_progress", ExportProgress {
        percent: 0,
        status: "Preparing backup...".to_string()
    });

    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = db::get_db_path(app)?;
    let photos_dir = app_data_dir.join("photos");

    // Determine output location based on platform
    let output_path = if cfg!(target_os = "android") {
        // On Android, use app's document directory (accessible to user via file picker)
        // This doesn't require special permissions and is accessible through
        // Android's native file picker / document provider
        let doc_dir = match app.path().document_dir() {
            Ok(dir) => {
                eprintln!("Using document directory: {:?}", dir);
                dir
            }
            Err(e) => {
                eprintln!("Failed to get document dir: {}, falling back to app data dir", e);
                app.path().app_data_dir()
                    .map_err(|e2| format!("Failed to get app data dir: {}", e2))?
            }
        };

        let filename = format!("homeschool-backup-{}.zip",
            chrono::Local::now().format("%Y%m%d-%H%M%S"));
        let path = doc_dir.join(&filename);
        eprintln!("Will create backup at: {:?}", path);
        path
    } else if cfg!(target_os = "ios") {
        app.path().app_data_dir()
            .map_err(|e| format!("Failed to get data dir: {}", e))?
            .join(format!("homeschool-backup-{}.zip",
                chrono::Local::now().format("%Y%m%d-%H%M%S")))
    } else {
        return Err("Desktop export should use export_data_command".to_string());
    };

    // Ensure the directory exists
    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    // Create ZIP file
    eprintln!("Creating ZIP file at: {:?}", output_path);
    let file = File::create(&output_path)
        .map_err(|e| {
            eprintln!("Failed to create file at {:?}: {}", output_path, e);
            format!("Failed to create ZIP at {:?}: {}", output_path, e)
        })?;
    eprintln!("ZIP file created successfully");

    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // Emit: Database (25%)
    let _ = window.emit("export_progress", ExportProgress {
        percent: 25,
        status: "Adding database...".to_string()
    });

    // Add database
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

    // Emit: Photos (50%)
    let _ = window.emit("export_progress", ExportProgress {
        percent: 50,
        status: "Adding photos...".to_string()
    });

    // Add photos
    if photos_dir.exists() {
        add_directory_to_zip(&mut zip, &photos_dir, &photos_dir, options)?;
    }

    // Emit: Manifest (90%)
    let _ = window.emit("export_progress", ExportProgress {
        percent: 90,
        status: "Finalizing...".to_string()
    });

    // Add manifest
    let manifest = create_manifest(app)?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to add manifest to ZIP: {}", e))?;
    let manifest_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;
    zip.write_all(manifest_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest to ZIP: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finish ZIP: {}", e))?;

    // Verify file was created and get its size
    match std::fs::metadata(&output_path) {
        Ok(metadata) => {
            eprintln!("Backup created successfully at: {:?}", output_path);
            eprintln!("File size: {} bytes", metadata.len());
        }
        Err(e) => {
            eprintln!("Warning: Could not verify file: {}", e);
        }
    }

    // Emit: Complete (100%)
    let _ = window.emit("export_progress", ExportProgress {
        percent: 100,
        status: "Complete!".to_string()
    });

    Ok(output_path.to_string_lossy().to_string())
}
