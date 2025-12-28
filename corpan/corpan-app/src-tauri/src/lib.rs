#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod content_packs;
mod db;

use rusqlite::{params_from_iter, Connection, ToSql};
use serde::Serialize;
use std::collections::HashSet;
use tauri::{command, AppHandle, State};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_opener;
use crate::content_packs::{
    download_and_install, get_manifest_url, list_installed, ContentPackInfo,
    ContentPackInstallResult,
};

/// Return type for each translation
#[derive(Serialize)]
struct TranslationOut {
    language_code: String,
    text: String,
    romanization: String, // kept as String for the API; we coalesce NULL -> ""
}

/// Return type for an entry with all translations
#[derive(Serialize)]
struct EntryOut {
    entry_id: i64,
    level: String,
    domains: Vec<String>,
    translations: Vec<TranslationOut>,
}

fn fetch_entry_with_translations(
    conn: &Connection,
    entry_id: i64,
    allowed_langs: Option<&HashSet<String>>,
) -> Result<EntryOut, String> {
    let mut stmt = conn
        .prepare_cached(
            "SELECT e.id, e.level, group_concat(DISTINCT d.code) AS domains
             FROM cor_entry e
             LEFT JOIN cor_entry_domains ced ON ced.entry_id = e.id
             LEFT JOIN cor_domain d ON d.id = ced.domain_id
             WHERE e.id = ?
             GROUP BY e.id",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt.query([entry_id]).map_err(|e| e.to_string())?;
    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or("Entry not found")?;

    let id: i64 = row.get(0).map_err(|e| e.to_string())?;
    let level: String = row.get(1).map_err(|e| e.to_string())?;
    let domain_str: Option<String> = row.get(2).ok();

    let domains_vec = domain_str
        .unwrap_or_default()
        .split(',')
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    let mut tstmt = conn
        .prepare_cached(
            "SELECT l.code, t.text, t.romanization
             FROM cor_translation t
             JOIN cor_language l ON l.id = t.language_id
             WHERE t.entry_id = ?",
        )
        .map_err(|e| e.to_string())?;

    let trows = tstmt
        .query_map([id], |row| {
            let lang_code: String = row.get(0)?;
            let text: String = row.get(1)?;
            let romanization: Option<String> = row.get(2)?;
            Ok((lang_code, text, romanization.unwrap_or_default()))
        })
        .map_err(|e| e.to_string())?;

    let mut translations = vec![];
    for res in trows {
        let (lang, text, romanization) = res.map_err(|e| e.to_string())?;
        if allowed_langs
            .map_or(true, |set| set.contains(&lang))
        {
            translations.push(TranslationOut {
                language_code: lang,
                text,
                romanization,
            });
        }
    }

    Ok(EntryOut {
        entry_id: id,
        level,
        domains: domains_vec,
        translations,
    })
}

/// Get one random entry matching given filters, with all translations
#[command]
fn get_random_entry_with_translations(
    state: State<'_, db::DbState>,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
) -> Result<EntryOut, String> {
    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    // Levels filter
    if let Some(ref lv_vec) = levels {
        if !lv_vec.is_empty() {
            let q = format!("e.level IN ({})", vec!["?"; lv_vec.len()].join(","));
            where_clauses.push(q);
            for lv in lv_vec {
                params.push(Box::new(lv.clone()));
            }
        }
    }

    // Domain filter (join only if domains specified)
    let (domain_join, domain_where) = if let Some(ref dom_vec) = domains {
        if !dom_vec.is_empty() {
            let q = format!("d.code IN ({})", vec!["?"; dom_vec.len()].join(","));
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

    let count_sql = format!(
        "SELECT COUNT(DISTINCT e.id)
         FROM cor_entry e
         {domain_join}
         {where}",
        domain_join = domain_join,
        where = where_str
    );

    let total: i64 = conn
        .query_row(
            &count_sql,
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if total <= 0 {
        return Err("No entries found for these criteria".to_string());
    }

    let allowed_langs: Option<HashSet<String>> = language_codes.map(|v| v.into_iter().collect());
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .subsec_nanos() as i64;
    let offset = (nanos % total).abs();

    let sql = format!(
        "SELECT e.id
         FROM cor_entry e
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY e.id
         LIMIT 1 OFFSET ?",
        domain_join = domain_join,
        where = where_str
    );

    let mut params_with_offset = params;
    params_with_offset.push(Box::new(offset));

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params_with_offset.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let row = rows
        .next()
        .map_err(|e| e.to_string())?
        .ok_or("No entries found for these criteria")?;

    let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
    fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())
}

/// Get multiple random entries matching given filters, with all translations
#[command]
fn get_random_entries_with_translations(
    state: State<'_, db::DbState>,
    count: i64,
    levels: Option<Vec<String>>,
    domains: Option<Vec<String>>,
    language_codes: Option<Vec<String>>,
) -> Result<Vec<EntryOut>, String> {
    if count <= 0 {
        return Ok(vec![]);
    }

    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let mut where_clauses = vec![];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(ref lv_vec) = levels {
        if !lv_vec.is_empty() {
            let q = format!("e.level IN ({})", vec!["?"; lv_vec.len()].join(","));
            where_clauses.push(q);
            for lv in lv_vec {
                params.push(Box::new(lv.clone()));
            }
        }
    }

    let (domain_join, domain_where) = if let Some(ref dom_vec) = domains {
        if !dom_vec.is_empty() {
            let q = format!("d.code IN ({})", vec!["?"; dom_vec.len()].join(","));
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

    let count_sql = format!(
        "SELECT COUNT(DISTINCT e.id)
         FROM cor_entry e
         {domain_join}
         {where}",
        domain_join = domain_join,
        where = where_str
    );

    let total: i64 = conn
        .query_row(
            &count_sql,
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if total <= 0 {
        return Err("No entries found for these criteria".to_string());
    }

    let take = std::cmp::min(count, total) as usize;
    let mut offsets = HashSet::new();
    let mut seed =
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .subsec_nanos() as u64;
    let max_attempts = (take * 6).max(take + 4);
    let mut attempts = 0;
    while offsets.len() < take && attempts < max_attempts {
        seed = seed.wrapping_mul(1664525).wrapping_add(1013904223);
        let offset = (seed % total as u64) as i64;
        offsets.insert(offset);
        attempts += 1;
    }
    if offsets.len() < take {
        for i in 0..total {
            if offsets.len() >= take {
                break;
            }
            offsets.insert(i);
        }
    }

    let sql = format!(
        "SELECT e.id
         FROM cor_entry e
         {domain_join}
         {where}
         GROUP BY e.id
         ORDER BY e.id
         LIMIT 1 OFFSET ?",
        domain_join = domain_join,
        where = where_str
    );

    let allowed_langs: Option<HashSet<String>> = language_codes.map(|v| v.into_iter().collect());
    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut entries = Vec::with_capacity(offsets.len());
    for offset in offsets {
        let mut params_ref: Vec<&dyn ToSql> = params.iter().map(|p| &**p).collect();
        params_ref.push(&offset);
        let mut rows = stmt
            .query(params_from_iter(params_ref))
            .map_err(|e| e.to_string())?;
        let row = rows
            .next()
            .map_err(|e| e.to_string())?
            .ok_or("No entries found for these criteria")?;
        let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
        let entry = fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())?;
        entries.push(entry);
    }

    Ok(entries)
}

/// Fetch a specific entry by ID with all translations (optionally filtered by language codes)
#[command]
fn get_entry_by_id_with_translations(
    state: State<'_, db::DbState>,
    entry_id: i64,
    language_codes: Option<Vec<String>>,
) -> Result<EntryOut, String> {
    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;
    let allowed_langs: Option<HashSet<String>> = language_codes.map(|v| v.into_iter().collect());
    fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())
}

#[command]
async fn content_packs_install_from_url(
    app: AppHandle,
    pack_id: String,
    download_url: String,
    expected_sha256: Option<String>,
) -> Result<ContentPackInstallResult, String> {
    download_and_install(&app, pack_id, download_url, expected_sha256).await
}

#[command]
fn content_packs_list_installed(app: AppHandle) -> Result<Vec<ContentPackInfo>, String> {
    list_installed(&app)
}

#[command]
fn content_packs_get_manifest_url(app: AppHandle, pack_id: String) -> Result<String, String> {
    get_manifest_url(&app, pack_id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state =
        db::DbState::new().expect("failed to initialize embedded database");
    tauri::Builder::default()
        .manage(db_state)
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_game_packs::init())
        .invoke_handler(tauri::generate_handler![
            get_random_entry_with_translations,
            get_random_entries_with_translations,
            get_entry_by_id_with_translations,
            content_packs_install_from_url,
            content_packs_list_installed,
            content_packs_get_manifest_url
        ])
        .plugin(tauri_plugin_safe_area_insets_css::init())
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
