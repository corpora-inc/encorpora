use rusqlite::ffi;
use rusqlite::Connection;
use std::convert::TryInto;
use std::ffi::CString;
use tauri::AppHandle;

/// Embed your prebuilt SQLite at compile time.
/// Make sure the path is correct relative to db.rs!
const EMBEDDED_DB: &[u8] = include_bytes!("../../../dja/db.sqlite3");

pub fn open_connection(_: &AppHandle) -> Result<Connection, String> {
    // Open an in-memory database.
    let conn =
        Connection::open_in_memory().map_err(|e| format!("failed to open in-memory DB: {}", e))?;

    // Copy the embedded DB bytes into "main".
    unsafe {
        let db_handle = conn.handle();
        let name = CString::new("main").unwrap();
        let ptr = EMBEDDED_DB.as_ptr() as *mut _;
        let len = EMBEDDED_DB.len();

        let read_bytes: i64 = len.try_into().unwrap();
        let alloc_bytes: i64 = len.try_into().unwrap();

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

    Ok(conn)
}
