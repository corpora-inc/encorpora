use rusqlite::ffi;
use rusqlite::Connection;
use std::convert::TryInto;
use std::ffi::CString;
use tauri::AppHandle;

/// Embed your prebuilt SQLite at compile time
const EMBEDDED_DB: &[u8] = include_bytes!("../../../djpanko/db.sqlite3");

/// Open an in-RAM SQLite DB populated from our embedded bytes.
pub fn open_connection(_: &AppHandle) -> Result<Connection, String> {
    // 1) open an in-memory database
    let conn =
        Connection::open_in_memory().map_err(|e| format!("failed to open in-memory DB: {}", e))?;

    // 2) copy the embedded blob into the "main" database
    unsafe {
        let db_handle = conn.handle(); // *mut sqlite3
        let name = CString::new("main").unwrap(); // target DB name
        let ptr = EMBEDDED_DB.as_ptr() as *mut _; // raw pointer
        let len = EMBEDDED_DB.len();

        // Convert usize → i64 for sqlite3_deserialize
        let read_bytes: i64 = len.try_into().unwrap();
        let alloc_bytes: i64 = len.try_into().unwrap();

        let rc = ffi::sqlite3_deserialize(
            db_handle,
            name.as_ptr(),
            ptr,
            read_bytes,  // number of bytes to read
            alloc_bytes, // number of bytes to allocate
            ffi::SQLITE_DESERIALIZE_READONLY,
        );
        if rc != ffi::SQLITE_OK {
            return Err(format!("sqlite3_deserialize failed: code {}", rc));
        }
    }

    Ok(conn)
}
