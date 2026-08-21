// src/offline_cache/mod.rs — Tauri command glue for the D12 offline image
// cache (docs/journey/specs/offline-cache.md §5). Pure logic lives in
// ./core.rs; the streaming download in ./net.rs — both host-testable without
// Tauri. The JS caller is corpan-app/src/lib/offlineCache/native.ts.
//
// Three additive commands, registered in lib.rs:
//   offline_cache_put(url, max_bytes?)  — download into the cache (idempotent)
//   offline_cache_delete(rel_paths)     — LRU eviction / repair
//   offline_cache_list()                — orphan sweeps / budget audits
//
// Serving needs zero protocol changes: files land under
// corpan-packs/.offline-cache/img/ and the existing corpan-pack:// protocol
// (tauri-plugin-game-packs) serves them to <img src> with correct MIME.

mod core;
mod net;

pub use self::core::{
    core_delete, core_list, ext_for, img_rel_path, new_tmp_path, served_url, sweep_tmp,
    validate_cache_rel, DEFAULT_MAX_IMAGE_BYTES, IMG_SUBDIR, TMP_SUBDIR, TMP_SWEEP_MAX_AGE_SECS,
};

use serde::Serialize;
use std::path::PathBuf;
use std::sync::Once;
use tauri::AppHandle;

use crate::blob_store::OFFLINE_CACHE_DIR;
use crate::content_packs::{download_client, pack_root, pack_url_base};

/// app_data_dir/corpan-packs/.offline-cache (img/ + tmp/ live under it;
/// W1's blob_store owns the sibling blob/ subtree).
fn cache_root<R: tauri::Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(pack_root(app)?.join(OFFLINE_CACHE_DIR))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineCachePutResult {
    /// "img/<sha256(url)>.<ext>"
    pub rel_path: String,
    /// pack_url_base() + ".offline-cache/" + rel_path — platform-correct,
    /// directly usable as <img src>.
    pub served_url: String,
    pub size: u64,
    pub content_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfflineCacheEntry {
    pub rel_path: String,
    pub size: u64,
    pub modified_ms: i64,
}

static TMP_SWEEP: Once = Once::new();

/// Download `url` (https, or http for private hosts) into the image cache.
/// Streams to tmp/ then renames atomically; enforces `max_bytes` (default
/// 8 MiB). Idempotent: if a committed file for this URL already exists, it
/// is returned without a network hit.
#[tauri::command]
pub async fn offline_cache_put(
    app: AppHandle,
    url: String,
    max_bytes: Option<u64>,
) -> Result<OfflineCachePutResult, String> {
    let root = cache_root(&app)?;

    // First invocation sweeps crash-leftover tmp entries older than 1 h.
    TMP_SWEEP.call_once(|| sweep_tmp(&root, TMP_SWEEP_MAX_AGE_SECS));

    // Immutable-by-URL: an existing committed file wins, no network.
    if let Some(existing) = self::core::find_existing(&root, &url) {
        let ext = existing
            .rel_path
            .rsplit('.')
            .next()
            .unwrap_or("bin")
            .to_string();
        return Ok(OfflineCachePutResult {
            served_url: served_url(pack_url_base(), OFFLINE_CACHE_DIR, &existing.rel_path),
            rel_path: existing.rel_path,
            size: existing.size,
            content_type: ext,
        });
    }

    let ceiling = max_bytes.unwrap_or(DEFAULT_MAX_IMAGE_BYTES);
    let client = download_client()?;
    let tmp = new_tmp_path(&root)?;
    let downloaded = net::download_to_file(&client, &url, &tmp, ceiling).await?;

    let content_type = downloaded
        .content_type
        .clone()
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let ext = ext_for(downloaded.content_type.as_deref(), &url);
    let committed = self::core::commit_tmp(&root, &tmp, &url, &ext)?;

    Ok(OfflineCachePutResult {
        served_url: served_url(pack_url_base(), OFFLINE_CACHE_DIR, &committed.rel_path),
        rel_path: committed.rel_path,
        size: committed.size,
        content_type,
    })
}

/// Delete cached files by rel path (LRU eviction, repair, orphan sweeps).
/// Every rel path is shape-validated before any delete; missing files are
/// not errors. Returns the number actually removed.
#[tauri::command]
pub fn offline_cache_delete(app: AppHandle, rel_paths: Vec<String>) -> Result<u32, String> {
    core_delete(&cache_root(&app)?, &rel_paths)
}

/// List committed cache files (orphan sweeps / budget audits).
#[tauri::command]
pub fn offline_cache_list(app: AppHandle) -> Result<Vec<OfflineCacheEntry>, String> {
    Ok(core_list(&cache_root(&app)?)
        .into_iter()
        .map(|e| OfflineCacheEntry {
            rel_path: e.rel_path,
            size: e.size,
            modified_ms: e.modified_ms,
        })
        .collect())
}
