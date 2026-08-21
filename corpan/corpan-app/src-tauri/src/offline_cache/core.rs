// src/offline_cache/core.rs — D12 offline image cache, PURE std+sha2 core
// (no Tauri / no reqwest imports) so the path/atomicity/containment logic is
// unit-testable on any host — including this build box, where the full Tauri
// dep tree needs system GTK/WebKit headers. Command glue lives in ./mod.rs;
// the streaming download lives in ./net.rs (reqwest-only, also host-testable).
//
// (Journey W2, docs/journey/specs/offline-cache.md §5.)
//
// Layout (sibling of W1's blob_store subtree — never collides with blob/):
//   app_data_dir/corpan-packs/.offline-cache/img/<hex(sha256(url))>.<ext>
//   app_data_dir/corpan-packs/.offline-cache/tmp/<pid>-<nanos>-<n>
//
// The root lives INSIDE corpan-packs/ on purpose: the already-registered
// `corpan-pack://` protocol treats the first path segment as a directory
// under the pack root, so every cached image is directly servable to
// `<img src>` with correct MIME as
//   corpan-pack://localhost/.offline-cache/img/<hash>.<ext>
// (or http://corpan-pack.localhost/… on Android/Windows), zero protocol
// changes. `validate_pack_id` (content_packs.rs) rejects `.offline-cache`
// as a RESERVED dir so no catalog entry can ever claim it as a pack id.
//
// Safety invariants:
//   - The only caller-controlled input that reaches a path component is the
//     sha256 hex of the URL plus a content-type-derived extension from a
//     fixed allowlist charset — traversal is impossible by construction on
//     the write path.
//   - Deletes take rel paths from JS (the LRU index) and are shape-validated
//     by `validate_cache_rel`: exactly `img/<single-component>` with a
//     conservative charset, so a hostile rel can never escape the cache dir.
//   - Downloads stream to tmp/ then `fs::rename` into img/ — atomic on the
//     same volume, so a crash mid-download never leaves a half-file at a
//     servable path. Stale tmp entries are swept opportunistically.
//
// Error style follows content_packs.rs: Result<_, String>, non-leaky.

use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

/// The image cache's subtree under `.offline-cache/` (blob_store owns `blob/`).
pub const IMG_SUBDIR: &str = "img";
/// In-flight downloads land here first, then rename into `img/`.
pub const TMP_SUBDIR: &str = "tmp";

/// Default per-image ceiling. Covers are ~100 KB; anything bigger than 8 MiB
/// is a config error upstream, not a legitimate cover (offline-cache.md §5).
pub const DEFAULT_MAX_IMAGE_BYTES: u64 = 8 * 1024 * 1024;

/// tmp/ entries older than this are crash leftovers — sweep them.
pub const TMP_SWEEP_MAX_AGE_SECS: u64 = 60 * 60;

pub struct CommittedImage {
    pub rel_path: String,
    pub size: u64,
}

pub struct CacheEntry {
    pub rel_path: String,
    pub size: u64,
    pub modified_ms: i64,
}

fn hash_url(url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(url.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Derive the on-disk extension: response Content-Type first (fixed map),
/// then the URL path extension (conservative charset, <= 5 chars), then
/// "bin". The result is always [a-z0-9]+, safe as a path suffix.
pub fn ext_for(content_type: Option<&str>, url: &str) -> String {
    if let Some(ct) = content_type {
        // Strip parameters ("image/png; charset=…") and normalize.
        let ct = ct
            .split(';')
            .next()
            .unwrap_or("")
            .trim()
            .to_ascii_lowercase();
        let mapped = match ct.as_str() {
            "image/png" => Some("png"),
            "image/jpeg" | "image/jpg" => Some("jpg"),
            "image/webp" => Some("webp"),
            "image/gif" => Some("gif"),
            "image/svg+xml" => Some("svg"),
            "image/avif" => Some("avif"),
            "image/bmp" => Some("bmp"),
            "image/x-icon" | "image/vnd.microsoft.icon" => Some("ico"),
            _ => None,
        };
        if let Some(ext) = mapped {
            return ext.to_string();
        }
    }
    // Fallback: the URL path's extension (query string stripped).
    let path = url.split(['?', '#']).next().unwrap_or("");
    if let Some((_, ext)) = path.rsplit_once('.') {
        let ext = ext.to_ascii_lowercase();
        if !ext.is_empty()
            && ext.len() <= 5
            && !ext.contains('/')
            && ext.chars().all(|c| c.is_ascii_alphanumeric())
        {
            return ext;
        }
    }
    "bin".to_string()
}

/// `img/<sha256(url)>.<ext>` — the rel path a committed image lives at.
pub fn img_rel_path(url: &str, ext: &str) -> String {
    format!("{IMG_SUBDIR}/{}.{ext}", hash_url(url))
}

/// Platform-correct display URL for a cache rel path. `url_base` is
/// `pack_url_base()` from content_packs.rs so JS never branches on platform.
pub fn served_url(url_base: &str, offline_cache_dir: &str, rel_path: &str) -> String {
    format!("{url_base}{offline_cache_dir}/{rel_path}")
}

/// Shape-validate a caller-supplied cache rel path (from the JS LRU index)
/// before it is joined onto the cache root: exactly `img/<name>` where
/// `<name>` is one component of [A-Za-z0-9._-], no traversal, no separators,
/// no tmp/meta suffixes hiding behind dots. Containment by construction —
/// no canonicalize() needed because no separator can survive validation.
pub fn validate_cache_rel(rel: &str) -> Result<PathBuf, String> {
    let name = rel
        .strip_prefix(&format!("{IMG_SUBDIR}/"))
        .ok_or_else(|| "Invalid cache path".to_string())?;
    if name.is_empty() || name.len() > 128 || name == "." || name == ".." {
        return Err("Invalid cache path".to_string());
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err("Invalid cache path".to_string());
    }
    if !name
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
    {
        return Err("Invalid cache path".to_string());
    }
    if name.starts_with('.') {
        return Err("Invalid cache path".to_string());
    }
    Ok(PathBuf::from(IMG_SUBDIR).join(name))
}

/// Idempotency probe: any committed file for this URL, regardless of the
/// extension it landed with (`img/<hash>.*`). Returns (rel_path, size).
pub fn find_existing(root: &Path, url: &str) -> Option<CommittedImage> {
    let hash = hash_url(url);
    let prefix = format!("{hash}.");
    let dir = root.join(IMG_SUBDIR);
    let entries = fs::read_dir(dir).ok()?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(&prefix) && !name.ends_with(".tmp") {
            if let Ok(md) = entry.metadata() {
                if md.is_file() {
                    return Some(CommittedImage {
                        rel_path: format!("{IMG_SUBDIR}/{name}"),
                        size: md.len(),
                    });
                }
            }
        }
    }
    None
}

static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// A collision-safe path under tmp/ for an in-flight download. The parent
/// dir is created; the file is not.
pub fn new_tmp_path(root: &Path) -> Result<PathBuf, String> {
    let dir = root.join(TMP_SUBDIR);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let n = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    Ok(dir.join(format!("{}-{nanos}-{n}.part", std::process::id())))
}

/// Atomically promote a fully-written tmp file to its servable img/ path.
/// Same-volume rename: a crash before this leaves only tmp litter (swept),
/// never a partial file at a servable path.
pub fn commit_tmp(root: &Path, tmp: &Path, url: &str, ext: &str) -> Result<CommittedImage, String> {
    let rel = img_rel_path(url, ext);
    let final_path = root.join(&rel);
    if let Some(parent) = final_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let size = fs::metadata(tmp).map_err(|e| e.to_string())?.len();
    fs::rename(tmp, &final_path).map_err(|e| {
        let _ = fs::remove_file(tmp);
        e.to_string()
    })?;
    Ok(CommittedImage {
        rel_path: rel,
        size,
    })
}

/// Delete committed cache files by rel path. Every path is shape-validated
/// (an invalid one errors — that's a caller bug, not a miss); MISSING files
/// are not errors (idempotent). Returns the number actually removed.
pub fn core_delete(root: &Path, rel_paths: &[String]) -> Result<u32, String> {
    let mut safe = Vec::with_capacity(rel_paths.len());
    // Validate everything first so a bad batch deletes nothing.
    for rel in rel_paths {
        safe.push(validate_cache_rel(rel)?);
    }
    let mut removed = 0u32;
    for rel in safe {
        if fs::remove_file(root.join(rel)).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

/// List committed files under img/ (orphan sweeps / budget audits).
pub fn core_list(root: &Path) -> Vec<CacheEntry> {
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join(IMG_SUBDIR)) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy().to_string();
            if name.ends_with(".tmp") || name.ends_with(".part") {
                continue;
            }
            if let Ok(md) = entry.metadata() {
                if md.is_file() {
                    let modified_ms = md
                        .modified()
                        .ok()
                        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                        .map(|d| d.as_millis() as i64)
                        .unwrap_or(0);
                    out.push(CacheEntry {
                        rel_path: format!("{IMG_SUBDIR}/{name}"),
                        size: md.len(),
                        modified_ms,
                    });
                }
            }
        }
    }
    out.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    out
}

/// Remove crash-leftover tmp entries older than `max_age_secs`.
pub fn sweep_tmp(root: &Path, max_age_secs: u64) {
    let dir = root.join(TMP_SUBDIR);
    let now = SystemTime::now();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let stale = entry
                .metadata()
                .ok()
                .and_then(|md| md.modified().ok())
                .and_then(|t| now.duration_since(t).ok())
                .map(|age| age.as_secs() >= max_age_secs)
                .unwrap_or(true);
            if stale {
                let _ = fs::remove_file(entry.path());
            }
        }
    }
}

/* ---------------------------------- tests --------------------------------- */

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let root = std::env::temp_dir().join(format!(
            "corpan-offline-cache-test-{tag}-{}-{nanos}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    #[test]
    fn ext_inference_content_type_then_url_then_bin() {
        assert_eq!(ext_for(Some("image/png"), "https://x/a"), "png");
        assert_eq!(
            ext_for(Some("image/jpeg; charset=binary"), "https://x/a"),
            "jpg"
        );
        assert_eq!(ext_for(Some("IMAGE/WEBP"), "https://x/a"), "webp");
        assert_eq!(ext_for(Some("image/svg+xml"), "https://x/a"), "svg");
        // Unknown content type falls back to the URL path extension.
        assert_eq!(
            ext_for(Some("application/octet-stream"), "https://x/cover.PNG?v=2"),
            "png"
        );
        assert_eq!(ext_for(None, "https://x/assets/atom-avatar.png"), "png");
        // Hostile / useless extensions collapse to bin.
        assert_eq!(ext_for(None, "https://x/no-extension"), "bin");
        assert_eq!(ext_for(None, "https://x/weird.tar.gz.longext"), "bin");
        assert_eq!(ext_for(None, "https://x/a.b/c"), "bin");
    }

    #[test]
    fn rel_path_is_hash_dot_ext_and_served_url_is_protocol_servable() {
        let rel = img_rel_path("https://encorpora.io/assets/atom-avatar.png", "png");
        assert!(rel.starts_with("img/"));
        let name = rel.strip_prefix("img/").unwrap();
        let (hash, ext) = name.rsplit_once('.').unwrap();
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(ext, "png");

        let url = served_url("corpan-pack://localhost/", ".offline-cache", &rel);
        assert!(url.starts_with("corpan-pack://localhost/.offline-cache/img/"));
        // Android/Windows form.
        let url2 = served_url("http://corpan-pack.localhost/", ".offline-cache", &rel);
        assert!(url2.starts_with("http://corpan-pack.localhost/.offline-cache/img/"));
    }

    #[test]
    fn validate_cache_rel_rejects_traversal_and_foreign_shapes() {
        for bad in [
            "",
            "img/",
            "img/..",
            "img/.",
            "img/../../etc/passwd",
            "img/a/b",
            "img/a\\b",
            "../img/a",
            "blob/cover-cache/abc",
            "img/.hidden",
            "img/a b",
            "img/a\0b",
            "tmp/x.part",
            "abc.png",
        ] {
            assert!(validate_cache_rel(bad).is_err(), "should reject {bad:?}");
        }
        let ok = validate_cache_rel("img/abc123.png").unwrap();
        assert_eq!(ok, PathBuf::from("img").join("abc123.png"));
    }

    #[test]
    fn commit_is_atomic_and_idempotency_probe_finds_it() {
        let root = temp_root("commit");
        let url = "https://encorpora.io/assets/cover.png";
        assert!(find_existing(&root, url).is_none());

        let tmp = new_tmp_path(&root).unwrap();
        fs::write(&tmp, b"PNGBYTES").unwrap();
        let committed = commit_tmp(&root, &tmp, url, "png").unwrap();
        assert_eq!(committed.size, 8);
        assert!(!tmp.exists(), "tmp promoted, not copied");
        assert!(root.join(&committed.rel_path).exists());

        let found = find_existing(&root, url).expect("probe finds committed file");
        assert_eq!(found.rel_path, committed.rel_path);
        assert_eq!(found.size, 8);
        // A different URL is not found.
        assert!(find_existing(&root, "https://encorpora.io/other.png").is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn failed_download_leaves_no_servable_partial() {
        let root = temp_root("partial");
        let url = "https://encorpora.io/assets/cover.png";
        // Simulate a crash mid-download: tmp written, never committed.
        let tmp = new_tmp_path(&root).unwrap();
        fs::write(&tmp, b"HALF").unwrap();
        assert!(find_existing(&root, url).is_none(), "img/ stays clean");
        assert!(core_list(&root).is_empty());
        // The sweep reclaims it once stale (age 0 = everything is stale).
        sweep_tmp(&root, 0);
        assert!(!tmp.exists(), "stale tmp swept");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn delete_validates_batch_first_and_missing_is_not_an_error() {
        let root = temp_root("delete");
        let url = "https://encorpora.io/assets/a.png";
        let tmp = new_tmp_path(&root).unwrap();
        fs::write(&tmp, b"X").unwrap();
        let committed = commit_tmp(&root, &tmp, url, "png").unwrap();

        // A batch containing a hostile rel errors and deletes NOTHING.
        let err = core_delete(
            &root,
            &[committed.rel_path.clone(), "img/../../evil".to_string()],
        );
        assert!(err.is_err());
        assert!(
            root.join(&committed.rel_path).exists(),
            "atomic batch: no partial delete"
        );

        // A clean batch removes the file; a repeat is a 0-count no-op.
        assert_eq!(
            core_delete(&root, &[committed.rel_path.clone()]).unwrap(),
            1
        );
        assert_eq!(
            core_delete(&root, &[committed.rel_path.clone()]).unwrap(),
            0
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn list_reports_committed_files_only() {
        let root = temp_root("list");
        for (i, url) in ["https://x/a.png", "https://x/b.jpg"].iter().enumerate() {
            let tmp = new_tmp_path(&root).unwrap();
            fs::write(&tmp, vec![0u8; 10 * (i + 1)]).unwrap();
            commit_tmp(&root, &tmp, url, if i == 0 { "png" } else { "jpg" }).unwrap();
        }
        // In-flight tmp files are invisible to list.
        let inflight = new_tmp_path(&root).unwrap();
        fs::write(&inflight, b"partial").unwrap();

        let listed = core_list(&root);
        assert_eq!(listed.len(), 2);
        assert!(listed.iter().all(|e| e.rel_path.starts_with("img/")));
        assert_eq!(listed.iter().map(|e| e.size).sum::<u64>(), 30);
        assert!(listed.iter().all(|e| e.modified_ms > 0));
        let _ = fs::remove_dir_all(&root);
    }
}
