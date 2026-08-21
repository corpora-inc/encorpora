// src/blob_store/core.rs — FS-BLOB tier core, PURE std+serde+sha2 (no
// Tauri imports) so the logic is unit-testable on any host — including this
// build box, where the full Tauri dep tree needs system GTK/WebKit headers.
// Command glue lives in ./mod.rs.
//
// (Journey W1,
// docs/journey/specs/storage-analytics.md §3.6, absorbing the offline-cache
// substrate ruling from specs/offline-cache.md).
//
// Layout: app_data_dir/corpan-packs/.offline-cache/blob/<ns>/<hex(sha256(key))>
// plus a `<hash>.meta.json` sidecar `{ key, createdAt, expiresAt? }`. The
// file's mtime is the LRU touch stamp (reads touch it).
//
// The root lives INSIDE corpan-packs/ on purpose: the already-registered
// `corpan-pack://` protocol (plugins/tauri-plugin-game-packs) treats the
// first path segment as a directory under the pack root and only rejects
// `..`, so every stored blob is directly servable to <img>/<audio> as
//   corpan-pack://localhost/.offline-cache/blob/<ns>/<hash>
// (or the http://corpan-pack.localhost/… form on Android/Windows) with zero
// protocol changes. `validate_pack_id` rejects `.offline-cache` as a
// RESERVED dir so no catalog entry can ever claim it as a pack id.
//
// Safety: `ns` is validated to [a-z0-9-]{1,64} and the on-disk file name is
// always the sha256 hex of the caller's key — path traversal is impossible
// by construction (no caller-controlled bytes reach a path component).
//
// Error style follows content_packs.rs: Result<_, String>, non-leaky
// messages. Writes are tmp+rename atomic so a crash never leaves a partial
// file at a servable path.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// Top-level reserved dir under corpan-packs/ (shared with the D12 image
/// cache, which uses `.offline-cache/img/`).
pub const OFFLINE_CACHE_DIR: &str = ".offline-cache";
/// The blob store's subtree under the reserved dir.
pub const BLOB_SUBDIR: &str = "blob";

#[derive(Serialize)]
pub struct BlobNsStats {
    pub ns: String,
    pub files: u64,
    pub bytes: u64,
}

#[derive(Serialize, Deserialize)]
struct BlobMeta {
    key: String,
    created_at: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    expires_at: Option<u64>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Namespaces are flat directory names minted by the app (namespaces.ts),
/// never free-form user input. Conservative charset, no dots.
fn validate_ns(ns: &str) -> Result<&str, String> {
    if ns.is_empty() || ns.len() > 64 {
        return Err("Invalid blob namespace".to_string());
    }
    if !ns
        .chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
        return Err("Invalid blob namespace".to_string());
    }
    Ok(ns)
}

fn hash_key(key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(key.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn blob_path(root: &Path, ns: &str, hash: &str) -> PathBuf {
    root.join(ns).join(hash)
}

fn meta_path(root: &Path, ns: &str, hash: &str) -> PathBuf {
    root.join(ns).join(format!("{hash}.meta.json"))
}

fn read_meta(path: &Path) -> Option<BlobMeta> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

/* ------------------------------ core (testable) --------------------------- */
// Every function below takes the root path so unit tests run on a temp dir
// with no Tauri runtime.

pub fn core_write(
    root: &Path,
    ns: &str,
    key: &str,
    bytes: &[u8],
    ttl_ms: Option<u64>,
) -> Result<(), String> {
    let ns = validate_ns(ns)?;
    let hash = hash_key(key);
    let dir = root.join(ns);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // tmp + rename: atomic on the same volume, never a partial servable file.
    let tmp = dir.join(format!("{hash}.tmp"));
    fs::write(&tmp, bytes).map_err(|e| e.to_string())?;
    fs::rename(&tmp, blob_path(root, ns, &hash)).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })?;

    let meta = BlobMeta {
        key: key.to_string(),
        created_at: now_ms(),
        expires_at: ttl_ms.map(|t| now_ms() + t),
    };
    let raw = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    fs::write(meta_path(root, ns, &hash), raw).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn core_read(root: &Path, ns: &str, key: &str) -> Result<Option<Vec<u8>>, String> {
    let ns = validate_ns(ns)?;
    let hash = hash_key(key);
    let path = blob_path(root, ns, &hash);
    if !path.exists() {
        return Ok(None);
    }
    // TTL: an expired blob reads as absent and is reaped lazily.
    if let Some(meta) = read_meta(&meta_path(root, ns, &hash)) {
        if let Some(exp) = meta.expires_at {
            if now_ms() > exp {
                let _ = fs::remove_file(&path);
                let _ = fs::remove_file(meta_path(root, ns, &hash));
                return Ok(None);
            }
        }
    }
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    // Touch the LRU stamp (best-effort).
    if let Ok(f) = fs::File::options().write(true).open(&path) {
        let _ = f.set_modified(SystemTime::now());
    }
    Ok(Some(bytes))
}

pub fn core_has(root: &Path, ns: &str, key: &str) -> Result<bool, String> {
    let ns = validate_ns(ns)?;
    let hash = hash_key(key);
    Ok(blob_path(root, ns, &hash).exists())
}

pub fn core_delete(root: &Path, ns: &str, key: &str) -> Result<(), String> {
    let ns = validate_ns(ns)?;
    let hash = hash_key(key);
    // Missing files are not errors (idempotent).
    let _ = fs::remove_file(blob_path(root, ns, &hash));
    let _ = fs::remove_file(meta_path(root, ns, &hash));
    Ok(())
}

fn is_payload(name: &str) -> bool {
    !name.ends_with(".meta.json") && !name.ends_with(".tmp")
}

fn ns_stats(root: &Path, ns: &str) -> BlobNsStats {
    let mut files = 0u64;
    let mut bytes = 0u64;
    if let Ok(entries) = fs::read_dir(root.join(ns)) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if !is_payload(&name) {
                continue;
            }
            if let Ok(md) = entry.metadata() {
                if md.is_file() {
                    files += 1;
                    bytes += md.len();
                }
            }
        }
    }
    BlobNsStats {
        ns: ns.to_string(),
        files,
        bytes,
    }
}

pub fn core_stats(root: &Path, ns: Option<&str>) -> Result<Vec<BlobNsStats>, String> {
    match ns {
        Some(ns) => {
            let ns = validate_ns(ns)?;
            Ok(vec![ns_stats(root, ns)])
        }
        None => {
            let mut out = Vec::new();
            if let Ok(entries) = fs::read_dir(root) {
                for entry in entries.flatten() {
                    if entry.path().is_dir() {
                        let name = entry.file_name();
                        let name = name.to_string_lossy().to_string();
                        out.push(ns_stats(root, &name));
                    }
                }
            }
            out.sort_by(|a, b| a.ns.cmp(&b.ns));
            Ok(out)
        }
    }
}

/// LRU prune by mtime until the namespace is at or under `max_bytes`.
/// Returns bytes freed. `max_bytes = 0` clears the namespace.
pub fn core_prune(root: &Path, ns: &str, max_bytes: u64) -> Result<u64, String> {
    let ns = validate_ns(ns)?;
    let dir = root.join(ns);
    let mut entries: Vec<(PathBuf, u64, SystemTime)> = Vec::new();
    let mut total = 0u64;
    if let Ok(rd) = fs::read_dir(&dir) {
        for entry in rd.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy().to_string();
            if !is_payload(&name) {
                continue;
            }
            if let Ok(md) = entry.metadata() {
                if md.is_file() {
                    let mtime = md.modified().unwrap_or(UNIX_EPOCH);
                    total += md.len();
                    entries.push((entry.path(), md.len(), mtime));
                }
            }
        }
    }
    if total <= max_bytes {
        return Ok(0);
    }
    // Oldest-touched first.
    entries.sort_by_key(|(_, _, mtime)| *mtime);
    let mut freed = 0u64;
    for (path, size, _) in entries {
        if total - freed <= max_bytes {
            break;
        }
        if fs::remove_file(&path).is_ok() {
            freed += size;
            let mut meta = path.as_os_str().to_owned();
            meta.push(".meta.json");
            let _ = fs::remove_file(PathBuf::from(meta));
        }
    }
    Ok(freed)
}

/// Platform-correct corpan-pack URL for an existing blob (None when absent).
/// This is the substrate seam the D12 offline-image cache renders from.
pub fn core_served_url(
    root: &Path,
    url_base: &str,
    ns: &str,
    key: &str,
) -> Result<Option<String>, String> {
    let ns = validate_ns(ns)?;
    let hash = hash_key(key);
    if !blob_path(root, ns, &hash).exists() {
        return Ok(None);
    }
    Ok(Some(format!(
        "{url_base}{OFFLINE_CACHE_DIR}/{BLOB_SUBDIR}/{ns}/{hash}"
    )))
}

/* ---------------------------------- tests --------------------------------- */

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(tag: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "corpan-blob-test-{tag}-{}-{}",
            std::process::id(),
            now_ms()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn write_read_roundtrip_and_has() {
        let root = temp_root("rw");
        core_write(&root, "cover-cache", "https://cdn/x.png", b"PNGDATA", None).unwrap();
        assert!(core_has(&root, "cover-cache", "https://cdn/x.png").unwrap());
        let back = core_read(&root, "cover-cache", "https://cdn/x.png").unwrap();
        assert_eq!(back.as_deref(), Some(b"PNGDATA".as_ref()));
        assert_eq!(core_read(&root, "cover-cache", "missing").unwrap(), None);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ns_validation_rejects_traversal_shapes() {
        let root = temp_root("ns");
        for bad in [
            "",
            "..",
            "a/b",
            "a\\b",
            "UPPER",
            "dots.dots",
            ".offline-cache",
            "a b",
        ] {
            assert!(
                core_write(&root, bad, "k", b"x", None).is_err(),
                "should reject {bad:?}"
            );
            assert!(core_read(&root, bad, "k").is_err());
        }
        // Keys with hostile bytes are safe: only their sha256 hex hits disk.
        core_write(&root, "cover-cache", "../../etc/passwd", b"safe", None).unwrap();
        let stats = core_stats(&root, Some("cover-cache")).unwrap();
        assert_eq!(stats[0].files, 1);
        let entries: Vec<_> = fs::read_dir(root.join("cover-cache"))
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert!(entries.iter().all(|n| n
            .chars()
            .all(|c| c.is_ascii_hexdigit() || n.ends_with(".meta.json"))));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_is_idempotent_and_removes_sidecar() {
        let root = temp_root("del");
        core_write(&root, "cover-cache", "k1", b"abc", None).unwrap();
        core_delete(&root, "cover-cache", "k1").unwrap();
        core_delete(&root, "cover-cache", "k1").unwrap(); // missing = not an error
        assert!(!core_has(&root, "cover-cache", "k1").unwrap());
        let leftover = fs::read_dir(root.join("cover-cache")).unwrap().count();
        assert_eq!(leftover, 0, "payload + sidecar both removed");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn ttl_expiry_reads_as_absent_and_reaps() {
        let root = temp_root("ttl");
        core_write(&root, "cover-cache", "k", b"x", Some(0)).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(5));
        assert_eq!(core_read(&root, "cover-cache", "k").unwrap(), None);
        assert!(!core_has(&root, "cover-cache", "k").unwrap());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn prune_is_lru_by_mtime_and_returns_bytes_freed() {
        let root = temp_root("prune");
        core_write(&root, "cover-cache", "old", &[0u8; 100], None).unwrap();
        // Ensure distinct mtimes, oldest first.
        std::thread::sleep(std::time::Duration::from_millis(20));
        core_write(&root, "cover-cache", "mid", &[0u8; 100], None).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        core_write(&root, "cover-cache", "new", &[0u8; 100], None).unwrap();
        let freed = core_prune(&root, "cover-cache", 250).unwrap();
        assert_eq!(freed, 100, "one victim frees exactly its size");
        assert!(
            !core_has(&root, "cover-cache", "old").unwrap(),
            "oldest evicted"
        );
        assert!(
            core_has(&root, "cover-cache", "new").unwrap(),
            "newest kept"
        );
        // max_bytes = 0 clears the namespace.
        let freed_all = core_prune(&root, "cover-cache", 0).unwrap();
        assert_eq!(freed_all, 200);
        assert_eq!(core_stats(&root, Some("cover-cache")).unwrap()[0].files, 0);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn stats_cover_all_namespaces_and_skip_sidecars() {
        let root = temp_root("stats");
        core_write(&root, "cover-cache", "a", &[0u8; 10], None).unwrap();
        core_write(&root, "audio-cache", "b", &[0u8; 20], None).unwrap();
        let all = core_stats(&root, None).unwrap();
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].ns, "audio-cache");
        assert_eq!(all[0].bytes, 20);
        assert_eq!(all[1].ns, "cover-cache");
        assert_eq!(all[1].files, 1);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn served_url_shape_is_protocol_servable() {
        let root = temp_root("url");
        core_write(&root, "cover-cache", "https://cdn/c.png", b"img", None).unwrap();
        let url = core_served_url(
            &root,
            "corpan-pack://localhost/",
            "cover-cache",
            "https://cdn/c.png",
        )
        .unwrap()
        .unwrap();
        assert!(url.starts_with("corpan-pack://localhost/.offline-cache/blob/cover-cache/"));
        let hash = url.rsplit('/').next().unwrap();
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(
            core_served_url(&root, "corpan-pack://localhost/", "cover-cache", "missing").unwrap(),
            None
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn write_is_atomic_no_tmp_left_behind() {
        let root = temp_root("atomic");
        core_write(&root, "cover-cache", "k", &[7u8; 64], None).unwrap();
        let names: Vec<_> = fs::read_dir(root.join("cover-cache"))
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().to_string())
            .collect();
        assert!(names.iter().all(|n| !n.ends_with(".tmp")));
        let _ = fs::remove_dir_all(&root);
    }
}
