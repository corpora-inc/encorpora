#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod db;

use rusqlite::params_from_iter;
use serde::Serialize;
use tauri::{command, AppHandle};
use tauri_plugin_opener;

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
    levels: Option<Vec<String>>,  // plural now
    domains: Option<Vec<String>>, // plural now
    language_codes: Option<Vec<String>>,
) -> Result<EntryOut, String> {
    // log
    // println!("🚨 get_random_entry_with_translations called");

    let conn = db::open_connection(&app)?;

    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Handle levels
    if let Some(ref lv_vec) = levels {
        if !lv_vec.is_empty() {
            let q = format!("e.level IN ({})", vec!["?"; lv_vec.len()].join(","));
            where_clauses.push(q);
            for lv in lv_vec {
                params.push(Box::new(lv.clone()));
            }
        }
    }

    // Handle domains (join only if domains specified)
    let (domain_join, domain_where) = if let Some(ref dom_vec) = domains {
        if !dom_vec.is_empty() {
            // Only entries that have at least one domain in dom_vec
            let q = format!("d.code IN ({})", vec!["?"; dom_vec.len()].join(","));
            // This join is required to filter for domain codes
            (
                "INNER JOIN cor_entry_domains ced ON ced.entry_id = e.id
                 INNER JOIN cor_domain d ON d.id = ced.domain_id",
                Some(q),
            )
        } else {
            ("", None)
        }
    } else {
        ("", None)
    };

    // Add domain filter (if present) to where_clauses
    if let Some(q) = domain_where {
        where_clauses.push(q);
        if let Some(dom_vec) = &domains {
            for dom in dom_vec {
                params.push(Box::new(dom.clone()));
            }
        }
    }

    let where_str = if where_clauses.is_empty() {
        "".to_string()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let sql = format!(
        "SELECT e.id, e.en_text, e.level, group_concat(DISTINCT d2.code) AS domains
         FROM cor_entry e
         LEFT JOIN cor_entry_domains ced2 ON ced2.entry_id = e.id
         LEFT JOIN cor_domain d2 ON d2.id = ced2.domain_id
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY RANDOM()
         LIMIT 1",
         domain_join = domain_join,
         where = where_str
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
    let domains_vec = domain_str
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
        domains: domains_vec,
        translations,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_random_entry_with_translations])
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
