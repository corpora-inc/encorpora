use crate::config::LIBRARY_DIRECTORY;
use crate::db_commands::add_book_to_db;
use crate::epub_commands::{create_epub_cover, get_epub_metadata};
use regex::Regex;
use std::{fs, path::PathBuf};
use tauri::Manager;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::FsExt;

const TEMPORAL_EPUB_PATH: &str = "temporal.epub";

#[tauri::command]
pub async fn pick_file(app: tauri::AppHandle) -> Result<String, String> {
    create_directory_if_not_exist(app.clone(), LIBRARY_DIRECTORY);

    let resource_dir = app.path().app_local_data_dir().unwrap();
    let temp_file_path = resource_dir.join(TEMPORAL_EPUB_PATH);

    let file_path_option = app.dialog().file().blocking_pick_file();

    let path = match file_path_option {
        Some(p) => p,
        None => {
            println!("No file selected by the user.");
            return Ok("No file selected by the user.".to_string());
        }
    };

    let file_content = match app.fs().read(path) {
        Ok(content) => content,
        Err(e) => {
            println!("failed to read file: {}", e);
            return Err(format!("Failed to read file: {}", e));
        }
    };

    let _ = match fs::write(temp_file_path.clone(), file_content) {
        Ok(path) => path,
        Err(e) => {
            println!("failed to write file: {}", e);
            return Err(format!("Failed to write file: {}", e));
        }
    };

    let (epub_title, epub_identifier, epub_creator, epub_language, epub_publisher, epub_pubdate) =
        match get_epub_metadata(&temp_file_path) {
            Ok(metadata) => metadata,
            Err(e) => {
                println!("Failed to extract EPUB metadata: {}", e);
                return Err(format!("Failed to extract EPUB metadata: {}", e));
            }
        };

    let epub_file_name_stem = create_file_name(epub_title.clone(), epub_identifier);
    let final_epub_filename = format!("{}.epub", epub_file_name_stem);
    let library_path = resource_dir.join(LIBRARY_DIRECTORY);
    let new_file_path = library_path.join(final_epub_filename.clone());
    
    // Create cover image with error handling
    let cover_path = library_path
        .join(format!("{}.png", epub_file_name_stem))
        .to_str()
        .unwrap()
        .to_string();
    
    if let Err(e) = create_epub_cover(&temp_file_path, cover_path.clone()) {
        println!("Warning: Failed to create cover image: {}", e);
        // Continue without cover image - this is not a fatal error
    }

    if check_if_file_exists(&new_file_path) {
        let _ = fs::remove_file(&temp_file_path);
        println!(
            "File {} already exists",
            new_file_path.to_str().unwrap().to_string()
        );
        return Ok("File already exists".to_string());
    }
    let _ = fs::rename(&temp_file_path, new_file_path.clone());
    add_book_to_db(
        app,
        epub_title,
        epub_creator,
        library_path
            .join(format!("{}.png", epub_file_name_stem))
            .to_str()
            .unwrap()
            .to_string(),
        epub_language,
        new_file_path.to_str().unwrap().to_string(),
        epub_publisher,
        epub_pubdate,
    )
    .await;

    Ok("File processed successfully".to_string())
}





#[tauri::command]
pub fn create_directory_if_not_exist(app: tauri::AppHandle, directory_name: &str) {
    let resource_dir = app.path().app_local_data_dir().unwrap();
    let directory_path = resource_dir.join(directory_name);

    let directory_exists = fs::exists(&directory_path).unwrap();
    if directory_exists {
        println!("Directory '{}' already exists", directory_name);
    } else {
        let _ = fs::create_dir(&directory_path);
        println!("Directory '{}' created", directory_name);
    }
}

fn check_if_file_exists(file_path: &PathBuf) -> bool {
    fs::exists(file_path).unwrap()
}

fn create_file_name(s1: String, s2: String) -> String {
    let non_alphanumeric_regex = Regex::new(r"[^a-z0-9]+").expect("Failed to compile regex");
    let trim_underscores_regex = Regex::new(r"^_|_+$").expect("Failed to compile regex");

    let s1_sanitized = s1.to_lowercase();
    let s2_sanitized = s2.to_lowercase();

    let s1_sanitized = non_alphanumeric_regex.replace_all(&s1_sanitized, "_");
    let s1_sanitized = trim_underscores_regex.replace_all(&s1_sanitized, "");

    let s2_sanitized = non_alphanumeric_regex.replace_all(&s2_sanitized, "_");
    let s2_sanitized = trim_underscores_regex.replace_all(&s2_sanitized, "");

    format!("{}{}", s1_sanitized, s2_sanitized)
}