use once_cell::sync::OnceCell;
use rusqlite::Connection;
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::PathBuf};
use tauri::{AppHandle, Manager};

/// Embed your prebuilt SQLite at compile time
const EMBEDDED_DB: &[u8] = include_bytes!("../../../djpanko/db.sqlite3");
static DB_PATH: OnceCell<PathBuf> = OnceCell::new();

/// Returns a writable copy of the embedded DB,
/// re‐writing it if it’s missing or the hash changed.
fn get_db_path(app: &AppHandle) -> Result<&PathBuf, String> {
    DB_PATH.get_or_try_init(|| {
        // 1. If shipping a resource file on desktop, use it:
        let resource_db = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to get resource dir: {}", e))?
            .join("resources/db.sqlite3");
        if resource_db.exists() && !resource_db.to_string_lossy().starts_with("asset://") {
            return Ok(resource_db);
        }

        // 2. Otherwise write embedded DB into app_data_dir
        let data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        let out_path = data_dir.join("db.sqlite3");

        // Compute SHA256 of embedded bytes
        let mut hasher = Sha256::new();
        hasher.update(EMBEDDED_DB);
        let embedded_hash = format!("{:x}", hasher.finalize_reset());

        // Compare with existing on‐disk copy
        let needs_write = if let Ok(disk_bytes) = fs::read(&out_path) {
            hasher.update(&disk_bytes);
            let disk_hash = format!("{:x}", hasher.finalize());
            embedded_hash != disk_hash
        } else {
            true
        };

        if needs_write {
            let mut f = fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create {}: {}", out_path.display(), e))?;
            f.write_all(EMBEDDED_DB)
                .map_err(|e| format!("Failed to write embedded DB: {}", e))?;
        }

        Ok(out_path)
    })
}

/// Open a rusqlite::Connection to that on‐disk copy
pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = get_db_path(app)?;
    Connection::open(path).map_err(|e| e.to_string())
}
