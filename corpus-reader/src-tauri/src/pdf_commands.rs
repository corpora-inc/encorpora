use lopdf::{Document, Object};
use serde::Serialize;


#[derive(Serialize, Debug)]
pub struct PdfMetadata {
    pub title: String,
    pub author: String,
    pub creator: String,
    pub producer: String,
    pub creation_date: String,
    pub modification_date: String,
    pub page_count: u32,
}
pub fn extract_pdf_metadata(file_path: &str) -> Result<PdfMetadata, Box<dyn std::error::Error>> {
    println!("Loading pdf file");

    let super_doc = Document::load(file_path);

    let doc = match super_doc {
        Ok(document) => document,
        Err(e) => {
            println!("Error: {}", e);
            panic!("Failed to load document");
        }
    };
    println!("Loaded");

    let metadata = PdfMetadata {
        title: get_metadata_string(&doc, "Title"),
        author: get_metadata_string(&doc, "Author"),
        creator: get_metadata_string(&doc, "Creator"),
        producer: get_metadata_string(&doc, "Producer"),
        creation_date: get_metadata_string(&doc, "CreationDate"),
        modification_date: get_metadata_string(&doc, "ModDate"),
        page_count: doc.get_pages().len() as u32,
    };
    Ok(metadata)
}

fn get_metadata_string(doc: &Document, key: &str) -> String {
    println!("Getting, {}", key);
    doc.trailer
        .get(b"Info")
        .ok()
        .and_then(|info| doc.get_object(info.as_reference().unwrap()).ok())
        .and_then(|info_obj| info_obj.as_dict().ok())
        .and_then(|info_dict| info_dict.get(key.as_bytes()).ok())
        .and_then(|value| match value {
            Object::String(s, _) => Some(String::from_utf8_lossy(s).to_string()),
            _ => None,
        })
        .unwrap_or_else(|| "not defined".to_string())
}
