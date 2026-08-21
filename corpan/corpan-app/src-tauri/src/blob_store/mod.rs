// src/blob_store/mod.rs — Tauri command glue over the pure core (./core.rs).
// Error style follows content_packs.rs: Result<_, String>, non-leaky messages.
// Registered in lib.rs. The JS caller is corpan-app/src/lib/storage/blob.ts.

mod core;

pub use self::core::{
    core_delete, core_has, core_prune, core_read, core_served_url, core_stats, core_write,
    BlobNsStats, BLOB_SUBDIR, OFFLINE_CACHE_DIR,
};

use std::path::PathBuf;
use tauri::AppHandle;

use crate::content_packs::{pack_root, pack_url_base};

/// app_data_dir/corpan-packs/.offline-cache/blob
fn blob_root<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(pack_root(app)?.join(OFFLINE_CACHE_DIR).join(BLOB_SUBDIR))
}

/* -------------------------------- commands -------------------------------- */

#[tauri::command]
pub fn blob_store_read(app: AppHandle, ns: String, key: String) -> Result<Option<Vec<u8>>, String> {
    core_read(&blob_root(&app)?, &ns, &key)
}

#[tauri::command]
pub fn blob_store_write(
    app: AppHandle,
    ns: String,
    key: String,
    bytes: Vec<u8>,
    ttl_ms: Option<u64>,
) -> Result<(), String> {
    core_write(&blob_root(&app)?, &ns, &key, &bytes, ttl_ms)
}

#[tauri::command]
pub fn blob_store_delete(app: AppHandle, ns: String, key: String) -> Result<(), String> {
    core_delete(&blob_root(&app)?, &ns, &key)
}

#[tauri::command]
pub fn blob_store_has(app: AppHandle, ns: String, key: String) -> Result<bool, String> {
    core_has(&blob_root(&app)?, &ns, &key)
}

#[tauri::command]
pub fn blob_store_stats(app: AppHandle, ns: Option<String>) -> Result<Vec<BlobNsStats>, String> {
    core_stats(&blob_root(&app)?, ns.as_deref())
}

#[tauri::command]
pub fn blob_store_prune(app: AppHandle, ns: String, max_bytes: u64) -> Result<u64, String> {
    core_prune(&blob_root(&app)?, &ns, max_bytes)
}

#[tauri::command]
pub fn blob_store_served_url(
    app: AppHandle,
    ns: String,
    key: String,
) -> Result<Option<String>, String> {
    core_served_url(&blob_root(&app)?, pack_url_base(), &ns, &key)
}
