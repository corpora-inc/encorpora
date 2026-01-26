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
/// Uses read+write instead of copy to handle iOS temporary file paths
pub fn add_photo_file(
    app: &AppHandle,
    date: &str,
    source_path: &str,
) -> Result<String, String> {
    // Log the source path for debugging
    eprintln!("add_photo_file called with source_path: {}", source_path);

    let photos_dir = get_photos_dir(app)?;
    let date_dir = photos_dir.join(date);

    fs::create_dir_all(&date_dir)
        .map_err(|e| format!("Failed to create date directory: {}", e))?;

    // Handle URL-encoded paths or file:// URLs
    let decoded_path = if source_path.starts_with("file://") {
        // Remove file:// prefix
        eprintln!("Removing file:// prefix from: {}", source_path);
        source_path.trim_start_matches("file://")
    } else {
        source_path
    };

    // URL decode the path (handles %20 for spaces, etc.)
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

    // Resolve the source path
    let source = Path::new(decoded_path.as_ref());
    eprintln!("Checking if file exists at: {:?}", source);

    // Check if the file exists
    if !source.exists() {
        eprintln!("ERROR: File does not exist at {:?}", source);
        // Try to list the parent directory to debug
        if let Some(parent) = source.parent() {
            eprintln!("Parent directory: {:?}", parent);
            if parent.exists() {
                match fs::read_dir(parent) {
                    Ok(entries) => {
                        eprintln!("Contents of parent directory:");
                        for entry in entries.flatten() {
                            eprintln!("  - {:?}", entry.path());
                        }
                    }
                    Err(e) => eprintln!("Failed to read parent directory: {}", e),
                }
            } else {
                eprintln!("Parent directory does not exist");
            }
        }
        return Err(format!(
            "Source file does not exist: '{}' (decoded: '{}'). Make sure the file picker returned a valid path.",
            source_path,
            decoded_path
        ));
    }

    eprintln!("File exists! Size: {:?}", source.metadata().map(|m| m.len()));

    // Generate unique filename using timestamp
    let timestamp = chrono::Utc::now().timestamp_millis();
    let extension = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let filename = format!("{}.{}", timestamp, extension);
    let dest_path = date_dir.join(&filename);

    eprintln!("Reading file from: {:?}", source);

    // Read the file content first, then write it
    // This handles iOS temporary paths better than fs::copy
    let content = match fs::read(source) {
        Ok(c) => {
            eprintln!("Successfully read {} bytes", c.len());
            c
        }
        Err(e) => {
            eprintln!("ERROR reading file: {} (kind: {:?})", e, e.kind());
            return Err(format!("Failed to read source file '{}': {} (error kind: {:?})", source_path, e, e.kind()));
        }
    };

    eprintln!("Writing {} bytes to: {:?}", content.len(), dest_path);

    match fs::write(&dest_path, &content) {
        Ok(_) => eprintln!("Successfully wrote file to {:?}", dest_path),
        Err(e) => {
            eprintln!("ERROR writing file: {} (kind: {:?})", e, e.kind());
            return Err(format!("Failed to write photo to {:?}: {} (error kind: {:?})", dest_path, e, e.kind()));
        }
    }

    // Verify the file was written
    if !dest_path.exists() {
        eprintln!("ERROR: File was not created at {:?}", dest_path);
        return Err(format!("File was not created at {:?}", dest_path));
    }

    eprintln!("Verified file exists at {:?}, size: {:?}", dest_path, dest_path.metadata().map(|m| m.len()));

    // Return relative path
    let relative_path = format!("photos/{}/{}", date, filename);
    eprintln!("Successfully added photo: {}", relative_path);
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
