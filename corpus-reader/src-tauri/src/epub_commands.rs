use epub::doc::EpubDoc;
use std::{fs, path::PathBuf};

/// Validates that a file path exists and is a readable file
fn validate_file_path(file_path: &PathBuf, file_type: &str) -> Result<(), String> {
    if !file_path.exists() {
        return Err(format!("{} file does not exist: {}", file_type, file_path.display()));
    }
    
    if !file_path.is_file() {
        return Err(format!("Path is not a file: {}", file_path.display()));
    }
    
    Ok(())
}

/// Extracts metadata from an EPUB file with comprehensive error handling
pub fn get_epub_metadata(file_path: &PathBuf) -> Result<(String, String, String, String, String, String), String> {
    validate_file_path(file_path, "EPUB")?;

    let doc = EpubDoc::new(&file_path).map_err(|e| format!("Failed to open EPUB file: {}", e))?;
    
    let epub_title = doc.mdata("title")
        .unwrap_or_else(|| "Unknown Title".to_string());
    
    let epub_creator = doc.mdata("creator")
        .unwrap_or_else(|| "Unknown Author".to_string());
    
    let epub_language = doc.mdata("language")
        .unwrap_or_else(|| "en".to_string());
    
    let epub_publisher = doc.mdata("publisher")
        .unwrap_or_else(|| "Unknown Publisher".to_string());
    
    let epub_identifier = doc.mdata("identifier")
        .unwrap_or_else(|| "Unknown Identifier".to_string());
    
    let epub_pubdate = doc.mdata("date")
        .unwrap_or_else(|| "Unknown Date".to_string());

    println!("Successfully extracted metadata from: {}", file_path.display());
    
    Ok((
        epub_title,
        epub_identifier,
        epub_creator,
        epub_language,
        epub_publisher,
        epub_pubdate,
    ))
}

/// Extracts and saves the cover image from an EPUB file
pub fn create_epub_cover(epub_file_path: &PathBuf, epub_cover_name: String) -> Result<(), String> {
    validate_file_path(epub_file_path, "EPUB")?;

    // Validate output directory exists
    if let Some(parent_dir) = PathBuf::from(&epub_cover_name).parent() {
        if !parent_dir.exists() {
            fs::create_dir_all(parent_dir)
                .map_err(|e| format!("Failed to create cover directory {}: {}", parent_dir.display(), e))?;
        }
    }

    let doc = EpubDoc::new(&epub_file_path)
        .map_err(|e| format!("Failed to open EPUB file for cover extraction: {}", e))?;
    
    let mut epub_file = doc;

    let cover_image = epub_file.get_cover()
        .map_err(|e| format!("Failed to extract cover image: {}. The EPUB may not have a cover image.", e))?;
    
    // Validate that we actually got image data
    if cover_image.is_empty() {
        return Err("Cover image data is empty".to_string());
    }
    
    println!("Saving cover image ({} bytes) to: {}", cover_image.len(), epub_cover_name);

    fs::write(&epub_cover_name, cover_image)
        .map_err(|e| format!("Failed to write cover image to {}: {}", epub_cover_name, e))?;
    
    println!("Cover image saved successfully to: {}", epub_cover_name);
    Ok(())
}
