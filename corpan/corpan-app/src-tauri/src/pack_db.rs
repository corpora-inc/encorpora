use crate::content_packs;
use rusqlite::{Connection, OpenFlags};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Runtime};

const CACHE_PAGES: i64 = -2048; // ~2 MiB page cache for pack DBs

#[derive(Default)]
pub struct PackDbState {
    pub connections: Mutex<HashMap<String, Connection>>,
}

impl PackDbState {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Deserialize)]
struct ContentPackManifestLite {
    id: String,
    databases: Option<HashMap<String, String>>,
}

pub fn resolve_pack_db_path<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: &str,
    db_name: Option<&str>,
) -> Result<PathBuf, String> {
    let root = content_packs::pack_root(app)?;
    let pack_dir = root.join(pack_id);
    let manifest_path = pack_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Err("Pack not installed".to_string());
    }
    let raw = fs::read_to_string(&manifest_path).map_err(|e| e.to_string())?;
    let manifest: ContentPackManifestLite =
        serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if manifest.id != pack_id {
        return Err("Pack id mismatch".to_string());
    }
    let dbs = manifest
        .databases
        .ok_or_else(|| "Pack manifest missing databases map".to_string())?;
    let key = db_name.unwrap_or("main");
    let rel = dbs
        .get(key)
        .ok_or_else(|| format!("Unknown database '{key}'"))?;
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() {
        return Err("Database path must be relative".to_string());
    }
    let full = pack_dir.join(rel_path);
    if !full.exists() {
        return Err(format!("Database file not found: {}", full.display()));
    }
    let pack_canon = pack_dir.canonicalize().map_err(|e| e.to_string())?;
    let full_canon = full.canonicalize().map_err(|e| e.to_string())?;
    if !full_canon.starts_with(&pack_canon) {
        return Err("Database path escapes pack root".to_string());
    }
    Ok(full_canon)
}

pub fn open_pack_connection(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|e| format!("failed to open pack DB: {}", e))?;
    conn.execute_batch(&format!(
        r#"
        PRAGMA query_only=ON;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size={CACHE_PAGES};
        PRAGMA case_sensitive_like=ON;
        "#
    ))
    .map_err(|e| e.to_string())?;
    Ok(conn)
}
