use crate::config::LIBRARY_DIRECTORY;
use crate::db_commands::{add_book_to_db, get_db};
use crate::epub_commands::{create_epub_cover, get_epub_metadata};
use crate::pdf_commands::extract_pdf_metadata;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_fs::FsExt;

use mime_guess::MimeGuess;

fn media_subtype(mime: &str) -> &str {
    mime.rsplit('/')
        .next()
        .and_then(|s| s.split('+').next())
        .unwrap_or("")
}

fn mime_from_path(path_like: &str) -> Option<String> {
    MimeGuess::from_path(path_like)
        .first()
        .map(|m| m.essence_str().to_owned()) // e.g. "application/pdf"
}

fn sniff_bytes(bytes: &[u8]) -> Option<String> {
    infer::get(bytes).map(|k| k.mime_type().to_owned())
}

/// Return the MIME type of whatever the user picked.
///
/// 1. Try to guess from the last path segment.
/// 2. If that fails (Android `content://…`), read the file and sniff its header.
fn mime_of_file(app: &AppHandle, fp: &FilePath) -> Result<String, String> {
    // ── 1. Try extension based detection ──────────────────────────────────────
    if let Some(mt) = match fp {
        FilePath::Path(buf) => {
            let path_buf = buf.as_path();
            let extension = path_buf
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("");
            Some(extension.to_string())
        },
        FilePath::Url(url) => mime_from_path(url.path()),
    } {
        return Ok(mt);
    }

    // ── 2. Fallback: read a few KB and sniff ──────────────────────────────────
    // app.fs().read() will work for both real paths and Android/iOS content URIs
    let bytes = app
        .fs()
        .read(fp.clone())
        .map_err(|e| format!("cannot read file: {e}"))?;

    if let Some(mt) = sniff_bytes(&bytes) {
        let extension = media_subtype(&mt);
        return Ok(extension.to_string());
    }

    // Final fallback
    Ok("application/octet-stream".into())
}

#[derive(Serialize, Deserialize)]
pub struct FileProcessResult {
    pub message: String,
    pub file_path: Option<String>,
}

#[tauri::command]
pub async fn pick_file(app: tauri::AppHandle) -> Result<FileProcessResult, String> {
    let resource_dir = app.path().app_local_data_dir().unwrap();

    let file_path_option = app
        .dialog()
        .file()
        // .add_filter("Only EPubs and PDF'S", &["epub", "pdf"])
        .blocking_pick_file();

    let path = match file_path_option {
        Some(p) => p,
        None => {
            println!("No file selected by the user.");
            return Ok(FileProcessResult {
                message: "No file selected by the user.".to_string(),
                file_path: None,
            });
        }
    };

    let file_content = match app.fs().read(path.clone()) {
        Ok(content) => content,
        Err(e) => {
            println!("failed to read file: {}", e);
            return Err(format!("Failed to read file: {}", e));
        }
    };

    let extension = mime_of_file(&app, &path)?;

    let temp_file_path = resource_dir.join(format!("temporal.{}", extension));
    println!("My temp file is called: {:#?}", temp_file_path);

    create_directory_if_not_exist(app.clone(), LIBRARY_DIRECTORY);

    let _ = match fs::write(temp_file_path.clone(), file_content) {
        Ok(path) => path,
        Err(e) => {
            println!("failed to write file: {}", e);
            return Err(format!("Failed to write file: {}", e));
        }
    };

    if extension == "epub" {
        let (
            epub_title,
            epub_identifier,
            epub_creator,
            epub_language,
            epub_publisher,
            epub_pubdate,
        ) = match get_epub_metadata(&temp_file_path) {
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
        }

        if check_if_file_exists(&new_file_path) {
            let _ = fs::remove_file(&temp_file_path);
            println!(
                "File {} already exists",
                new_file_path.to_str().unwrap().to_string()
            );
            return Ok(FileProcessResult {
                message: "File already exists".to_string(),
                file_path: Some(new_file_path.to_str().unwrap().to_string()),
            });
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

        return Ok(FileProcessResult {
            message: "EPUB processed successfully".to_string(),
            file_path: Some(new_file_path.to_str().unwrap().to_string()),
        });

    } else if extension == "pdf" {
        let metadata = extract_pdf_metadata(&temp_file_path.as_path().to_str().unwrap()).unwrap();

        let epub_file_name_stem =
            create_file_name(metadata.title.clone(), metadata.creation_date.clone());
        let final_epub_filename = format!("{}.pdf", epub_file_name_stem);
        let library_path = resource_dir.join(LIBRARY_DIRECTORY);
        let new_file_path = library_path.join(final_epub_filename.clone());
        print!("done");

        if check_if_file_exists(&new_file_path) {
            let _ = fs::remove_file(&temp_file_path);
            println!(
                "File {} already exists",
                new_file_path.to_str().unwrap().to_string()
            );
            return Ok(FileProcessResult {
                message: "File already exists".to_string(),
                file_path: Some(new_file_path.to_str().unwrap().to_string()),
            });
        }

        let _ = fs::rename(&temp_file_path, new_file_path.clone());
        add_book_to_db(
            app,
            metadata.title,
            metadata.author,
            library_path
                .join(format!("{}.png", epub_file_name_stem))
                .to_str()
                .unwrap()
                .to_string(),
            "None".to_string(),
            new_file_path.to_str().unwrap().to_string(),
            metadata.producer,
            metadata.creation_date,
        )
        .await;

        return Ok(FileProcessResult {
            message: "PDF processed successfully".to_string(),
            file_path: Some(new_file_path.to_str().unwrap().to_string()),
        });
    }

    Ok(FileProcessResult {
        message: "File processed successfully".to_string(),
        file_path: None,
    })
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

#[tauri::command]
pub async fn delete_book(app: tauri::AppHandle, book_id: i64) -> Result<String, String> {
    println!("Attempting to delete book with ID: {}", book_id);
    
    // Get database connection
    let db = match get_db(app.clone()).await {
        Ok(db) => db,
        Err(e) => {
            println!("Failed to get database connection: {}", e);
            return Err(format!("Failed to get database connection: {}", e));
        }
    };

    // First, get the book information to know which files to delete
    let book_query = "SELECT path, cover_path FROM books WHERE id = $1";
    let book_result = match sqlx::query_as::<_, (String, Option<String>)>(book_query)
        .bind(book_id)
        .fetch_optional(&db)
        .await
    {
        Ok(result) => result,
        Err(e) => {
            println!("Failed to fetch book information: {}", e);
            return Err(format!("Failed to fetch book information: {}", e));
        }
    };

    let (book_path, cover_path) = match book_result {
        Some((path, cover)) => (path, cover),
        None => {
            println!("Book with ID {} not found in database", book_id);
            return Err(format!("Book with ID {} not found", book_id));
        }
    };

    // Delete the book file from filesystem
    if check_if_file_exists(&PathBuf::from(&book_path)) {
        if let Err(e) = fs::remove_file(&book_path) {
            println!("Failed to delete book file {}: {}", book_path, e);
            return Err(format!("Failed to delete book file: {}", e));
        }
        println!("Successfully deleted book file: {}", book_path);
    } else {
        println!("Book file {} does not exist on filesystem", book_path);
    }

    // Delete the cover image if it exists
    if let Some(cover) = cover_path {
        if check_if_file_exists(&PathBuf::from(&cover)) {
            if let Err(e) = fs::remove_file(&cover) {
                println!("Failed to delete cover file {}: {}", cover, e);
                // Don't return error here, as the main book deletion should proceed
            } else {
                println!("Successfully deleted cover file: {}", cover);
            }
        } else {
            println!("Cover file {} does not exist on filesystem", cover);
        }
    }

    // Delete the book from database (this will cascade delete related records)
    let delete_query = "DELETE FROM books WHERE id = $1";
    match sqlx::query(delete_query)
        .bind(book_id)
        .execute(&db)
        .await
    {
        Ok(result) => {
            if result.rows_affected() > 0 {
                println!("Successfully deleted book with ID {} from database", book_id);
                Ok(format!("Book successfully deleted"))
            } else {
                println!("No rows affected when deleting book ID {}", book_id);
                Err(format!("Book with ID {} not found in database", book_id))
            }
        }
        Err(e) => {
            println!("Failed to delete book from database: {}", e);
            Err(format!("Failed to delete book from database: {}", e))
        }
    }
}
