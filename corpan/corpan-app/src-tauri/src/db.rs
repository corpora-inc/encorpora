use rusqlite::{ffi, Connection};
use std::convert::TryInto;
use std::ffi::CString;
use tauri::AppHandle;

/// Embed your prebuilt SQLite at compile time.
const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/release.sqlite3");

pub fn open_connection(_: &AppHandle) -> Result<Connection, String> {
    // 1) Open an in-memory connection.
    let conn =
        Connection::open_in_memory().map_err(|e| format!("failed to open in-memory DB: {}", e))?;

    // 2) Deserialize the embedded bytes into "main" (zero-copy, read-only).
    unsafe {
        let db_handle = conn.handle();
        let name = CString::new("main").unwrap();

        let ptr = EMBEDDED_DB.as_ptr() as *mut std::os::raw::c_uchar;
        let read_bytes: i64 = EMBEDDED_DB.len().try_into().unwrap();
        let alloc_bytes: i64 = EMBEDDED_DB.len().try_into().unwrap();

        // READONLY: SQLite will not modify or resize our buffer.
        // Do NOT pass FREEONCLOSE for include_bytes!() data.
        let rc = ffi::sqlite3_deserialize(
            db_handle,
            name.as_ptr(),
            ptr,
            read_bytes,
            alloc_bytes,
            ffi::SQLITE_DESERIALIZE_READONLY,
        );
        if rc != ffi::SQLITE_OK {
            return Err(format!("sqlite3_deserialize failed: code {}", rc));
        }
    }

    // 3) Read-only + small, predictable cache & temp settings.
    //    (Size-neutral; helps low-end devices.)
    conn.execute_batch(
        r#"
        PRAGMA query_only=ON;        -- defensive: reject writes at SQL layer
        PRAGMA temp_store=MEMORY;    -- no temp files
        PRAGMA cache_size=-4096;     -- ~4 MiB page cache (tune: -2048..-8192)
        PRAGMA case_sensitive_like=ON;
        "#,
    )
    .map_err(|e| e.to_string())?;

    // Optionally: try a modest mmap for platforms where it helps (N/A for in-memory),
    // left here harmlessly:
    // conn.execute_batch("PRAGMA mmap_size=0;").ok();

    Ok(conn)
}
