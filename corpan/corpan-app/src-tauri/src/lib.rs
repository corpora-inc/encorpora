#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;

use rusqlite::params_from_iter;
use serde::Serialize;
use tauri::{command, AppHandle};

/// Return type for each translation
#[derive(Serialize)]
struct TranslationOut {
    language_code: String,
    text: String,
}

/// Return type for the random entry with all translations
#[derive(Serialize)]
struct EntryOut {
    entry_id: i64,
    en_text: String,
    level: String,
    domains: Vec<String>,
    translations: Vec<TranslationOut>,
}

/// Get one random entry matching given filters, with all translations
#[command]
fn get_random_entry_with_translations(
    app: AppHandle,
    level: Option<String>,               // e.g. "A1"
    domain: Option<String>,              // e.g. "health"
    language_codes: Option<Vec<String>>, // Only return these translations
) -> Result<EntryOut, String> {
    let conn = db::open_connection(&app)?;

    // -- Build WHERE clauses
    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(lv) = &level {
        where_clauses.push("e.level = ?");
        params.push(Box::new(lv));
    }

    if let Some(dom) = &domain {
        // Join with entry_domains and domains
        where_clauses.push("d.code = ?");
        params.push(Box::new(dom));
    }

    // -- Build query with optional domain join
    let sql = format!(
        "SELECT e.id, e.en_text, e.level, group_concat(d.code) AS domains
         FROM cor_entry e
         LEFT JOIN cor_entry_domains ced ON ced.entry_id = e.id
         LEFT JOIN cor_domain d ON d.id = ced.domain_id
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY RANDOM()
         LIMIT 1",
         domain_join = if domain.is_some() { "LEFT JOIN cor_entry_domains ced2 ON ced2.entry_id = e.id LEFT JOIN domain d2 ON d2.id = ced2.domain_id" } else { "" },
         where = if !where_clauses.is_empty() {
             format!("WHERE {}", where_clauses.join(" AND "))
         } else {
             "".to_string()
         }
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or("No entries found for these criteria")?;

    let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
    let en_text: String = row.get(1).map_err(|e| e.to_string())?;
    let level: String = row.get(2).map_err(|e| e.to_string())?;
    let domain_str: Option<String> = row.get(3).ok();

    // Domains as vec
    let domains = domain_str
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    // Get all translations for this entry
    let mut translation_stmt = conn
        .prepare(
            "SELECT l.code, t.text
         FROM cor_translation t
         JOIN cor_language l ON l.id = t.language_id
         WHERE t.entry_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let translation_rows = translation_stmt
        .query_map([entry_id], |row| {
            let lang_code: String = row.get(0)?;
            let text: String = row.get(1)?;
            Ok((lang_code, text))
        })
        .map_err(|e| e.to_string())?;

    // Optionally filter by languages
    let allowed_langs: Option<std::collections::HashSet<String>> =
        language_codes.map(|v| v.into_iter().collect());

    let mut translations = vec![];
    for res in translation_rows {
        let (lang, text) = res.map_err(|e| e.to_string())?;
        if allowed_langs
            .as_ref()
            .map_or(true, |set| set.contains(&lang))
        {
            translations.push(TranslationOut {
                language_code: lang,
                text,
            });
        }
    }

    Ok(EntryOut {
        entry_id,
        en_text,
        level,
        domains,
        translations,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_random_entry_with_translations])
        .plugin(tauri_plugin_tts::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
