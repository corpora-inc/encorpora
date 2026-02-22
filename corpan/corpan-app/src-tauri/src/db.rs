use rusqlite::Connection;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Embed the prebuilt SQLite database at compile time.
const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/release.sqlite3");

pub struct DbState {
    pub conn: Mutex<Connection>,
}

impl DbState {
    /// Write the compiled-in DB to disk (first launch or after app update),
    /// then open it read-only with mmap.  This avoids the 82 MB
    /// `sqlite3_deserialize` allocation that caused startup ANRs / SIGABRT.
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        let db_path = data_dir.join("release.sqlite3");

        // Write or update when file is missing or size differs (app update).
        let needs_write = match std::fs::metadata(&db_path) {
            Ok(meta) => meta.len() != EMBEDDED_DB.len() as u64,
            Err(_) => true,
        };

        if needs_write {
            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed to create data dir: {}", e))?;
            std::fs::write(&db_path, EMBEDDED_DB)
                .map_err(|e| format!("failed to write DB to {}: {}", db_path.display(), e))?;
        }

        Ok(Self {
            conn: Mutex::new(open_connection(&db_path)?),
        })
    }
}

fn open_connection(path: &Path) -> Result<Connection, String> {
    let flags = rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY
        | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX;

    let conn = Connection::open_with_flags(path, flags)
        .map_err(|e| format!("failed to open DB at {}: {}", path.display(), e))?;

    conn.execute_batch(
        r#"
        PRAGMA query_only=ON;
        PRAGMA temp_store=MEMORY;
        PRAGMA cache_size=-4096;
        PRAGMA case_sensitive_like=ON;
        PRAGMA mmap_size=67108864;
        "#,
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}
