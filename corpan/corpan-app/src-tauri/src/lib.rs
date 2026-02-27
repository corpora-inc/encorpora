#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod content_packs;
mod db;
mod pack_db;

use rusqlite::{params_from_iter, Connection, ToSql};
use rusqlite::types::{Value as SqlValue, ValueRef};
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::collections::HashSet;
use std::collections::HashMap;
use tauri::{command, AppHandle, Manager, State};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_opener;
use crate::content_packs::{
    download_and_install, get_manifest_url, list_installed, ContentPackInfo,
    ContentPackInstallResult,
};
use crate::pack_db::{open_pack_connection, resolve_pack_db_path, PackDbState};

const PACK_DB_DEFAULT_MAX_ROWS: usize = 500;
const PACK_DB_HARD_MAX_ROWS: usize = 2000;

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

#[derive(Serialize)]
struct PackDbQueryResult {
    columns: Vec<String>,
    rows: Vec<HashMap<String, JsonValue>>,
}

fn escape_like(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn strip_leading_comments(mut input: &str) -> &str {
    loop {
        let trimmed = input.trim_start();
        if trimmed.starts_with("--") {
            if let Some(idx) = trimmed.find('\n') {
                input = &trimmed[idx + 1..];
                continue;
            }
            return "";
        }
        if trimmed.starts_with("/*") {
            if let Some(end) = trimmed.find("*/") {
                input = &trimmed[end + 2..];
                continue;
            }
            return "";
        }
        return trimmed;
    }
}

fn ensure_readonly_sql(sql: &str) -> Result<(), String> {
    let trimmed = strip_leading_comments(sql);
    if trimmed.is_empty() {
        return Err("SQL query is empty".to_string());
    }
    if trimmed.contains(';') {
        return Err("Only a single SQL statement is allowed".to_string());
    }
    let keyword = trimmed
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_ascii_uppercase();
    match keyword.as_str() {
        "SELECT" | "WITH" | "PRAGMA" | "EXPLAIN" => Ok(()),
        _ => Err("Only SELECT/WITH/PRAGMA/EXPLAIN statements are allowed".to_string()),
    }
}

fn json_to_sql_value(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(num) => {
            if let Some(i) = num.as_i64() {
                SqlValue::Integer(i)
            } else if let Some(f) = num.as_f64() {
                SqlValue::Real(f)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        JsonValue::Array(_) | JsonValue::Object(_) => SqlValue::Text(value.to_string()),
    }
}

fn blob_to_hex(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write;
        let _ = write!(out, "{:02x}", b);
    }
    out
}

fn sql_value_ref_to_json(value: ValueRef<'_>) -> JsonValue {
    match value {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(i) => JsonValue::from(i),
        ValueRef::Real(f) => JsonValue::from(f),
        ValueRef::Text(bytes) => {
            JsonValue::from(String::from_utf8_lossy(bytes).to_string())
        }
        ValueRef::Blob(bytes) => JsonValue::from(format!("0x{}", blob_to_hex(bytes))),
    }
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

/// Search for entries whose translation text contains the requested substring.
#[command]
fn search_entries_by_translation_text(
    state: State<'_, db::DbState>,
    text: String,
    language_codes: Option<Vec<String>>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<EntryOut>, String> {
    let needle = text.trim();
    if needle.is_empty() {
        return Ok(vec![]);
    }
    let limit = limit.unwrap_or(50).max(1).min(200);
    let offset = offset.unwrap_or(0).max(0);
    let search_langs = match &language_codes {
        Some(codes) if !codes.is_empty() => codes.clone(),
        _ => vec!["zh-Hans".to_string(), "zh-Hant".to_string()],
    };

    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let lang_placeholders = vec!["?"; search_langs.len()].join(",");
    let sql = format!(
        r#"SELECT DISTINCT t.entry_id
         FROM cor_translation t
         JOIN cor_language l ON l.id = t.language_id
         WHERE l.code IN ({lang_placeholders})
           AND t.text LIKE ? ESCAPE '\'
         ORDER BY t.entry_id
         LIMIT ? OFFSET ?"#
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![];
    for lang in &search_langs {
        params.push(Box::new(lang.clone()));
    }
    let pattern = format!("%{}%", escape_like(needle));
    params.push(Box::new(pattern));
    params.push(Box::new(limit));
    params.push(Box::new(offset));

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query(params_from_iter(params.iter().map(|p| &**p)))
        .map_err(|e| e.to_string())?;

    let allowed_langs: Option<HashSet<String>> =
        language_codes.map(|v| v.into_iter().collect());
    let mut results = vec![];
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let entry_id: i64 = row.get(0).map_err(|e| e.to_string())?;
        let entry = fetch_entry_with_translations(&conn, entry_id, allowed_langs.as_ref())?;
        results.push(entry);
    }
    Ok(results)
}

/// Count entries whose translation text contains the requested substring.
#[command]
fn search_entries_by_translation_text_count(
    state: State<'_, db::DbState>,
    text: String,
    language_codes: Option<Vec<String>>,
) -> Result<i64, String> {
    let needle = text.trim();
    if needle.is_empty() {
        return Ok(0);
    }
    let search_langs = match &language_codes {
        Some(codes) if !codes.is_empty() => codes.clone(),
        _ => vec!["zh-Hans".to_string(), "zh-Hant".to_string()],
    };

    let conn = state.conn.lock().map_err(|_| "DB lock poisoned".to_string())?;

    let lang_placeholders = vec!["?"; search_langs.len()].join(",");
    let sql = format!(
        r#"SELECT COUNT(DISTINCT t.entry_id)
         FROM cor_translation t
         JOIN cor_language l ON l.id = t.language_id
         WHERE l.code IN ({lang_placeholders})
           AND t.text LIKE ? ESCAPE '\'"#
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![];
    for lang in &search_langs {
        params.push(Box::new(lang.clone()));
    }
    let pattern = format!("%{}%", escape_like(needle));
    params.push(Box::new(pattern));

    let total: i64 = conn
        .query_row(
            &sql,
            params_from_iter(params.iter().map(|p| &**p)),
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(total)
}

#[command]
fn content_packs_query_db(
    app: AppHandle,
    state: State<'_, PackDbState>,
    pack_id: String,
    db_name: Option<String>,
    sql: String,
    params: Option<Vec<JsonValue>>,
    max_rows: Option<usize>,
) -> Result<PackDbQueryResult, String> {
    ensure_readonly_sql(&sql)?;

    let db_path = resolve_pack_db_path(&app, &pack_id, db_name.as_deref())?;
    let key = format!("{}::{}", pack_id, db_name.unwrap_or_else(|| "main".to_string()));
    let mut connections = state
        .connections
        .lock()
        .map_err(|_| "Pack DB lock poisoned".to_string())?;

    if !connections.contains_key(&key) {
        let conn = open_pack_connection(&db_path)?;
        connections.insert(key.clone(), conn);
    }
    let conn = connections
        .get_mut(&key)
        .ok_or_else(|| "Failed to open pack DB".to_string())?;

    let mut stmt = conn.prepare_cached(&sql).map_err(|e| e.to_string())?;
    let columns = stmt
        .column_names()
        .iter()
        .map(|c| c.to_string())
        .collect::<Vec<_>>();

    let mut sql_params: Vec<SqlValue> = vec![];
    if let Some(values) = params {
        for value in values {
            sql_params.push(json_to_sql_value(&value));
        }
    }

    let mut rows = stmt
        .query(params_from_iter(sql_params.iter()))
        .map_err(|e| e.to_string())?;
    let mut out_rows: Vec<HashMap<String, JsonValue>> = vec![];
    let cap = max_rows
        .unwrap_or(PACK_DB_DEFAULT_MAX_ROWS)
        .min(PACK_DB_HARD_MAX_ROWS);
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut map = HashMap::new();
        for (idx, col) in columns.iter().enumerate() {
            let value = row.get_ref(idx).map_err(|e| e.to_string())?;
            map.insert(col.clone(), sql_value_ref_to_json(value));
        }
        out_rows.push(map);
        if out_rows.len() >= cap {
            break;
        }
    }

    Ok(PackDbQueryResult {
        columns,
        rows: out_rows,
    })
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
async fn content_packs_fetch_text(app: AppHandle, url: String) -> Result<String, String> {
    content_packs::fetch_text(&app, url).await
}

#[command]
fn content_packs_fetch_bytes(app: AppHandle, url: String) -> Result<tauri::ipc::Response, String> {
    content_packs::fetch_bytes(&app, url).map(tauri::ipc::Response::new)
}

#[command]
fn content_packs_list_installed(app: AppHandle) -> Result<Vec<ContentPackInfo>, String> {
    list_installed(&app)
}

#[command]
fn content_packs_get_manifest_url(app: AppHandle, pack_id: String) -> Result<String, String> {
    get_manifest_url(&app, pack_id)
}

/// Open Apple's Feedback Assistant app using the 'open' command (macOS/iOS)
#[command]
fn open_apple_feedback(#[allow(unused_variables)] app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        // Try URL scheme first
        let result = Command::new("open")
            .arg("applefeedback://")
            .output();

        match result {
            Ok(output) if output.status.success() => return Ok(()),
            _ => {
                // Fallback to direct app path
                let app_result = Command::new("open")
                    .arg("/System/Library/CoreServices/Applications/Feedback Assistant.app")
                    .output();

                match app_result {
                    Ok(output) if output.status.success() => return Ok(()),
                    Ok(output) => return Err(format!("Failed to open Feedback Assistant: {}",
                        String::from_utf8_lossy(&output.stderr))),
                    Err(e) => return Err(format!("Failed to execute open command: {}", e)),
                }
            }
        }
    }

    #[cfg(target_os = "ios")]
    {
        use tauri_plugin_opener::OpenerExt;

        // On iOS, try multiple options in order of preference:
        // 1. Feedback app (if installed via TestFlight/Beta program)
        // 2. Apple Support app (most users have this)
        // 3. Web feedback form as fallback
        let urls = vec![
            "applefeedback://new",           // Feedback app (Beta users)
            "applefeedback://",              // Feedback app (alternative)
            "applesupport://",               // Apple Support app
            "https://www.apple.com/feedback/", // Web fallback
        ];

        for url in urls {
            if let Ok(_) = app.opener().open_url(url, None::<&str>) {
                return Ok(());
            }
        }

        Err("Could not open Apple Feedback. Please install the Apple Support app from the App Store.".to_string())
    }

    #[cfg(not(any(target_os = "macos", target_os = "ios")))]
    {
        Err("Feedback Assistant is only available on Apple platforms".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pack_db_state = PackDbState::new();
    tauri::Builder::default()
        .manage(pack_db_state)
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_game_packs::init())
        .invoke_handler(tauri::generate_handler![
            get_random_entry_with_translations,
            get_random_entries_with_translations,
            get_entry_by_id_with_translations,
            search_entries_by_translation_text,
            search_entries_by_translation_text_count,
            content_packs_query_db,
            content_packs_install_from_url,
            content_packs_fetch_text,
            content_packs_fetch_bytes,
            content_packs_list_installed,
            content_packs_get_manifest_url,
            open_apple_feedback
        ])
        .plugin(tauri_plugin_safe_area_insets_css::init())
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_audio_keepalive::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed to resolve app data dir: {}", e))?;
            let db_state = db::DbState::new(data_dir)
                .map_err(|e| format!("failed to initialize database: {}", e))?;
            app.manage(db_state);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
