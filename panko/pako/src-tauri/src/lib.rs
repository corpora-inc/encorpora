#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;

use serde::Serialize;
use tauri::{command, AppHandle};

#[derive(Serialize)]
struct Sentence {
    text_korean: String,
    text_english: String,
}

#[command]
fn get_random_sentence(app: AppHandle) -> Result<Sentence, String> {
    // Open the embedded DB
    let conn = db::open_connection(&app)?;

    // Query one random sentence
    let mut stmt = conn
        .prepare(
            "SELECT text_korean, text_english
             FROM kore_sentence
             WHERE cefr_level = 'A1'
             ORDER BY RANDOM()
             LIMIT 1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Sentence {
            text_korean: row.get(0).map_err(|e| e.to_string())?,
            text_english: row.get(1).map_err(|e| e.to_string())?,
        })
    } else {
        Err("No sentences found".into())
    }
}

#[tauri::command]
async fn speak(text: String, lang: Option<String>) -> Result<(), String> {
  // Create the cross-platform TTS engine
  let mut engine = tts::Tts::default().map_err(|e| e.to_string())?;
  engine
    .set_language(lang.as_deref().unwrap_or("en-US"))
    .map_err(|e| e.to_string())?;
  // false = don't block until finished
  engine.speak(text, false).map_err(|e| e.to_string())?;
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_random_sentence, speak])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
