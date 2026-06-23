use tauri::{AppHandle, Manager};

mod db;
mod photos;
mod export;
mod import;
mod filetype;
mod platform;

// Database commands
#[tauri::command]
fn init_db_command(app: AppHandle) -> Result<(), String> {
    db::init_db(&app)
}

#[tauri::command]
fn get_settings_command(app: AppHandle) -> Result<db::Settings, String> {
    db::get_settings(&app)
}

#[tauri::command]
fn update_settings_command(app: AppHandle, settings: db::Settings) -> Result<(), String> {
    db::update_settings(&app, settings)
}

#[tauri::command]
fn get_day(app: AppHandle, student_id: i64, date: String) -> Result<Option<db::Day>, String> {
    db::get_day(&app, &date, student_id)
}

#[tauri::command]
fn get_days_in_month_command(app: AppHandle, student_id: i64, year: i32, month: u32) -> Result<Vec<db::Day>, String> {
    db::get_days_in_month(&app, student_id, year, month)
}

#[tauri::command]
fn update_day(app: AppHandle, student_id: i64, date: String, updates: db::DayUpdate) -> Result<db::Day, String> {
    db::update_day(&app, student_id, &date, updates)
}

// Photo commands
#[tauri::command]
fn add_photo_command(app: AppHandle, student_id: i64, date: String, source_path: String, original_filename: Option<String>) -> Result<db::Photo, String> {
    let file_path = photos::add_photo_file(&app, &date, &source_path)?;
    db::add_photo(&app, student_id, &date, &file_path, original_filename)
}

#[tauri::command]
fn add_photo_from_bytes_command(
    app: AppHandle,
    student_id: i64,
    date: String,
    bytes: Vec<u8>,
    extension: String,
    original_filename: Option<String>,
) -> Result<db::Photo, String> {
    eprintln!("add_photo_from_bytes_command: {} bytes, claimed extension: {}", bytes.len(), extension);

    // Auto-detect extension from magic bytes if the provided extension is unreliable
    let final_extension = if extension == "bin" || extension.is_empty() {
        eprintln!("Extension is unreliable ({}), detecting from magic bytes...", extension);
        match filetype::detect_extension_from_bytes(&bytes) {
            Some(detected) => {
                eprintln!("Detected extension from magic bytes: {}", detected);
                detected.to_string()
            }
            None => {
                eprintln!("Could not detect extension from magic bytes, using provided: {}", extension);
                extension
            }
        }
    } else {
        eprintln!("Using provided extension: {}", extension);
        extension
    };

    eprintln!("Final extension: {}", final_extension);
    let file_path = photos::add_photo_from_bytes(&app, &date, bytes, &final_extension)?;
    db::add_photo(&app, student_id, &date, &file_path, original_filename)
}

#[tauri::command]
fn delete_photo_command(app: AppHandle, id: i64) -> Result<(), String> {
    let file_path = db::delete_photo(&app, id)?;
    photos::delete_photo_file(&app, &file_path)
}

#[tauri::command]
fn get_photos_for_date(app: AppHandle, student_id: i64, date: String) -> Result<Vec<db::Photo>, String> {
    eprintln!("get_photos_for_date called for student {} date: {}", student_id, date);
    let photos = db::get_photos_for_date(&app, student_id, &date)?;
    eprintln!("Found {} photos in database", photos.len());

    // Convert file paths to full paths for the frontend
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    eprintln!("App data directory: {:?}", app_data_dir);

    let photos_with_full_paths: Vec<db::Photo> = photos.into_iter().map(|mut photo| {
        let relative_path = photo.file_path.clone();
        let full_path = app_data_dir.join(&photo.file_path);
        photo.file_path = full_path.to_string_lossy().to_string();
        eprintln!("Converted path: {} -> {}", relative_path, photo.file_path);

        // Verify the file exists
        if !full_path.exists() {
            eprintln!("WARNING: Photo file does not exist at {:?}", full_path);
        } else {
            eprintln!("Photo file exists, size: {:?}", full_path.metadata().map(|m| m.len()));
        }

        photo
    }).collect();

    eprintln!("Returning {} photos with full paths", photos_with_full_paths.len());
    Ok(photos_with_full_paths)
}

#[tauri::command]
fn get_photo_counts_for_month_command(app: AppHandle, student_id: i64, year: i32, month: i32) -> Result<std::collections::HashMap<String, i64>, String> {
    db::get_photo_counts_for_month(&app, student_id, year, month)
}

// Student commands
#[tauri::command]
fn get_students_command(app: AppHandle) -> Result<Vec<db::Student>, String> {
    db::get_students(&app)
}

#[tauri::command]
fn add_student_command(app: AppHandle, name: String) -> Result<db::Student, String> {
    db::add_student(&app, &name)
}

#[tauri::command]
fn update_student_command(app: AppHandle, id: i64, name: String) -> Result<(), String> {
    db::update_student(&app, id, &name)
}

#[tauri::command]
fn delete_student_command(app: AppHandle, id: i64) -> Result<(), String> {
    db::delete_student(&app, id)
}

#[tauri::command]
fn get_total_homeschool_days_command(app: AppHandle, student_id: i64) -> Result<i64, String> {
    db::get_total_homeschool_days(&app, student_id)
}

// Export/Import commands (async to prevent blocking main thread)
#[tauri::command]
async fn export_data_command(app: AppHandle, dest_path: String) -> Result<(), String> {
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        export::export_data(&app_clone, &dest_path)
    })
    .await
    .map_err(|e| format!("Failed to spawn export task: {}", e))?
}

#[tauri::command]
async fn export_data_to_bytes_command(app: AppHandle) -> Result<Vec<u8>, String> {
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        export::export_data_to_bytes(&app_clone)
    })
    .await
    .map_err(|e| format!("Failed to spawn export task: {}", e))?
}

#[cfg(target_os = "android")]
#[tauri::command]
async fn export_data_to_external_command(app: AppHandle) -> Result<String, String> {
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        export::export_data_to_external(&app_clone)
    })
    .await
    .map_err(|e| format!("Failed to spawn export task: {}", e))?
}

#[cfg(target_os = "ios")]
#[tauri::command]
async fn export_data_to_ios_documents_command(app: AppHandle) -> Result<String, String> {
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        export::export_data_to_ios_documents(&app_clone)
    })
    .await
    .map_err(|e| format!("Failed to spawn export task: {}", e))?
}

#[tauri::command]
async fn import_data_command(app: AppHandle, source_path: String) -> Result<(), String> {
    // Run the blocking I/O work in a background thread to prevent iOS from killing the app
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        import::import_data(&app_clone, &source_path)
    })
    .await
    .map_err(|e| format!("Failed to spawn import task: {}", e))?
}

#[tauri::command]
async fn import_data_from_bytes_command(app: AppHandle, bytes: Vec<u8>) -> Result<(), String> {
    // Run the blocking I/O work in a background thread to prevent iOS from killing the app
    let app_clone = app.clone();
    tokio::task::spawn_blocking(move || {
        import::import_data_from_bytes(&app_clone, bytes)
    })
    .await
    .map_err(|e| format!("Failed to spawn import task: {}", e))?
}

// Re-export async commands and platform commands
#[cfg(any(target_os = "android", target_os = "ios"))]
use export::export_data_async;

#[cfg(any(target_os = "android", target_os = "ios"))]
use import::import_data_async;

#[cfg(target_os = "android")]
use platform::android::{android_share_file, android_write_content_uri};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_ios_share::init());

    // Platform-specific command registration
    #[cfg(target_os = "android")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            init_db_command,
            get_settings_command,
            update_settings_command,
            get_day,
            get_days_in_month_command,
            update_day,
            add_photo_command,
            add_photo_from_bytes_command,
            delete_photo_command,
            get_photos_for_date,
            get_photo_counts_for_month_command,
            get_students_command,
            add_student_command,
            update_student_command,
            delete_student_command,
            get_total_homeschool_days_command,
            export_data_command,
            export_data_to_bytes_command,
            export_data_to_external_command,
            import_data_command,
            import_data_from_bytes_command,
            export_data_async,
            import_data_async,
            android_share_file,
            android_write_content_uri,
        ]);
    }

    #[cfg(target_os = "ios")]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            init_db_command,
            get_settings_command,
            update_settings_command,
            get_day,
            get_days_in_month_command,
            update_day,
            add_photo_command,
            add_photo_from_bytes_command,
            delete_photo_command,
            get_photos_for_date,
            get_photo_counts_for_month_command,
            get_students_command,
            add_student_command,
            update_student_command,
            delete_student_command,
            get_total_homeschool_days_command,
            export_data_command,
            export_data_to_bytes_command,
            export_data_to_ios_documents_command,
            import_data_command,
            import_data_from_bytes_command,
            export_data_async,
            import_data_async,
        ]);
    }

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.invoke_handler(tauri::generate_handler![
            init_db_command,
            get_settings_command,
            update_settings_command,
            get_day,
            get_days_in_month_command,
            update_day,
            add_photo_command,
            add_photo_from_bytes_command,
            delete_photo_command,
            get_photos_for_date,
            get_photo_counts_for_month_command,
            get_students_command,
            add_student_command,
            update_student_command,
            delete_student_command,
            get_total_homeschool_days_command,
            export_data_command,
            export_data_to_bytes_command,
            import_data_command,
            import_data_from_bytes_command,
        ]);
    }

    builder.run(tauri::generate_context!())
        .expect("error while running tauri application");
}
