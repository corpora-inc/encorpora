use std::path::{Path, PathBuf};
use std::fs;
use tauri::{AppHandle, Manager};

/// Get the photos directory path
pub fn get_photos_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let photos_dir = app_data_dir.join("photos");
    fs::create_dir_all(&photos_dir)
        .map_err(|e| format!("Failed to create photos dir: {}", e))?;

    Ok(photos_dir)
}

/// Add a photo by copying it to the managed directory
/// Handles both regular file paths and Android content:// URIs
pub fn add_photo_file(
    app: &AppHandle,
    date: &str,
    source_path: &str,
) -> Result<String, String> {
    eprintln!("add_photo_file called with source_path: {}", source_path);

    let photos_dir = get_photos_dir(app)?;
    let date_dir = photos_dir.join(date);

    fs::create_dir_all(&date_dir)
        .map_err(|e| format!("Failed to create date directory: {}", e))?;

    // Check if this is an Android content URI - return error so frontend can handle it
    if source_path.starts_with("content://") {
        eprintln!("Detected Android content URI - frontend should handle this");
        return Err("CONTENT_URI:Use add_photo_from_bytes_command instead for content URIs".to_string());
    }

    // Handle regular file paths
    handle_regular_file_path(source_path, &date_dir, date)
}

fn handle_regular_file_path(
    source_path: &str,
    date_dir: &Path,
    date: &str,
) -> Result<String, String> {
    // Handle URL-encoded paths or file:// URLs
    let decoded_path = if source_path.starts_with("file://") {
        eprintln!("Removing file:// prefix from: {}", source_path);
        source_path.trim_start_matches("file://")
    } else {
        source_path
    };

    // URL decode the path
    let decoded_path = match urlencoding::decode(decoded_path) {
        Ok(p) => {
            eprintln!("Successfully decoded path: {}", p);
            p
        }
        Err(e) => {
            eprintln!("Failed to decode path: {}", e);
            return Err(format!("Failed to decode path '{}': {}", decoded_path, e));
        }
    };

    let source = Path::new(decoded_path.as_ref());
    eprintln!("Checking if file exists at: {:?}", source);

    if !source.exists() {
        eprintln!("ERROR: File does not exist at {:?}", source);
        return Err(format!(
            "Source file does not exist: '{}' (decoded: '{}')",
            source_path,
            decoded_path
        ));
    }

    eprintln!("File exists! Size: {:?}", source.metadata().map(|m| m.len()));

    // Generate unique filename
    let timestamp = chrono::Utc::now().timestamp_millis();
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let filename = format!("{}.{}", timestamp, extension);
    let dest_path = date_dir.join(&filename);

    // Read and write file
    let content = fs::read(source)
        .map_err(|e| format!("Failed to read source file: {}", e))?;

    eprintln!("Writing {} bytes to: {:?}", content.len(), dest_path);

    fs::write(&dest_path, &content)
        .map_err(|e| format!("Failed to write photo: {}", e))?;

    eprintln!("Successfully wrote file to {:?}", dest_path);

    let relative_path = format!("photos/{}/{}", date, filename);
    Ok(relative_path)
}

/// Delete a photo file
pub fn delete_photo_file(app: &AppHandle, file_path: &str) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let full_path = app_data_dir.join(file_path);

    if full_path.exists() {
        fs::remove_file(&full_path)
            .map_err(|e| format!("Failed to delete photo file: {}", e))?;
    }

    Ok(())
}

/// Get the full path for a photo to use with asset protocol
pub fn get_photo_full_path(app: &AppHandle, file_path: &str) -> Result<String, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let full_path = app_data_dir.join(file_path);

    full_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}

/// Add a photo from raw bytes (for Android content URIs handled in frontend)
pub fn add_photo_from_bytes(
    app: &AppHandle,
    date: &str,
    bytes: Vec<u8>,
    extension: &str,
) -> Result<String, String> {
    eprintln!("add_photo_from_bytes called with {} bytes, extension: {}", bytes.len(), extension);

    let photos_dir = get_photos_dir(app)?;
    let date_dir = photos_dir.join(date);

    fs::create_dir_all(&date_dir)
        .map_err(|e| format!("Failed to create date directory: {}", e))?;

    // Generate unique filename
    let timestamp = chrono::Utc::now().timestamp_millis();
    let filename = format!("{}.{}", timestamp, extension);
    let dest_path = date_dir.join(&filename);

    eprintln!("Writing {} bytes to: {:?}", bytes.len(), dest_path);

    fs::write(&dest_path, &bytes)
        .map_err(|e| format!("Failed to write photo: {}", e))?;

    eprintln!("Successfully wrote file to {:?}", dest_path);

    let relative_path = format!("photos/{}/{}", date, filename);
    Ok(relative_path)
}
