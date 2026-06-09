use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// Hard ceiling on a single pack/module download. These are first-party signed
/// ZIPs, but LLM base-model packs (e.g. `llm-base-qwen3-4b-v1`, a ~2.5 GB GGUF
/// on S3 that Tutomaton `dependsOn`) are multi-gigabyte — the old 1 GiB ceiling
/// rejected them ("Download exceeded size limit"). 8 GiB clears current models
/// with headroom while still bounding a malicious/misconfigured runaway stream.
const DOWNLOAD_MAX_BYTES: u64 = 8 * 1024 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct InstallProgressEvent {
    pub pack_id: String,
    pub stage: String,
    pub progress: u64,
    pub total: u64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContentPackInfo {
    pub id: String,
    pub name: Option<String>,
    pub version: Option<String>,
    pub manifest_url: String,
    pub installed_at: i64,
}

#[derive(Debug, Serialize)]
pub struct ContentPackInstallResult {
    pub pack: ContentPackInfo,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ContentPackIndex {
    packs: HashMap<String, ContentPackInfo>,
}

pub fn pack_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("corpan-packs"))
        .map_err(|e| e.to_string())
}

fn index_path(root: &Path) -> PathBuf {
    root.join("index.json")
}

fn load_index(root: &Path) -> ContentPackIndex {
    let path = index_path(root);
    if let Ok(raw) = fs::read_to_string(path) {
        if let Ok(index) = serde_json::from_str::<ContentPackIndex>(&raw) {
            return index;
        }
    }
    ContentPackIndex::default()
}

fn save_index(root: &Path, index: &ContentPackIndex) -> Result<(), String> {
    let path = index_path(root);
    let raw = serde_json::to_string_pretty(index).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

/// Base URL prefix under which the `corpan-pack` custom URI-scheme protocol
/// handler (registered by `tauri-plugin-game-packs`) is actually reachable from
/// the WebView, which differs by platform. Per the Tauri 2 docs for
/// `register_uri_scheme_protocol`:
///
/// - macOS, iOS, Linux: `corpan-pack://localhost/<path>`
/// - **Windows, Android**: `http://corpan-pack.localhost/<path>`
///
/// This matters for DIRECT asset URLs that the WebView resolves itself —
/// `<img src>`, `@font-face`, CSS `url(...)`, `<audio>`/`<video>` — because
/// those never go through the `content_packs_fetch_*` commands (only the
/// manifest + entry JS/CSS are command-fetched and inlined by ContentPackHost).
/// On Android, a pack-built `corpan-pack://localhost/...` URL hits an
/// UNREGISTERED scheme and silently fails to load; the served form is
/// `http://corpan-pack.localhost/...`. Emitting the platform-correct base here
/// lets the registered protocol handler serve every pack file natively.
fn pack_url_base() -> &'static str {
    if cfg!(any(target_os = "android", target_os = "windows")) {
        "http://corpan-pack.localhost/"
    } else {
        "corpan-pack://localhost/"
    }
}

fn manifest_url_for(pack_id: &str) -> String {
    format!("{}{pack_id}/manifest.json", pack_url_base())
}

/// Split a pack asset URL (either custom-scheme form) into `(pack_id, rel_path)`.
/// Accepts BOTH `corpan-pack://localhost/<pack>/<path>` (desktop/iOS) and
/// `http://corpan-pack.localhost/<pack>/<path>` (Android/Windows) so the
/// `content_packs_fetch_*` commands resolve a pack URL regardless of which
/// platform-specific form the front-end built it as. Query string is stripped.
/// Returns `None` for any URL that is not a corpan-pack URL.
fn parse_pack_url(url: &str) -> Option<(&str, &str)> {
    let no_query = url.split('?').next().unwrap_or(url);
    let path_part = no_query
        .strip_prefix("corpan-pack://localhost/")
        .or_else(|| no_query.strip_prefix("http://corpan-pack.localhost/"))
        .or_else(|| no_query.strip_prefix("https://corpan-pack.localhost/"))?;
    let mut parts = path_part.splitn(2, '/');
    let pack_id = parts.next().filter(|s| !s.is_empty())?;
    let rel_path = parts.next().filter(|s| !s.is_empty())?;
    Some((pack_id, rel_path))
}

/// Whether a URL targets the corpan-pack custom scheme in any platform form.
fn is_pack_url(url: &str) -> bool {
    url.starts_with("corpan-pack://")
        || url.starts_with("http://corpan-pack.localhost/")
        || url.starts_with("https://corpan-pack.localhost/")
}

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Extract a ZIP that lives in a file on disk. We read it through a buffered
/// File reader (`Read + Seek`) rather than an in-memory `Cursor<&[u8]>` so a
/// multi-GB archive (e.g. an LLM base-model pack) never has to be resident in
/// RAM — only the zip's per-entry decompression window + an 8 KiB copy buffer
/// are. Same path-traversal safety as before (`enclosed_name()`), and each
/// entry streams straight to its output file via `std::io::copy`.
fn safe_extract_zip_file(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| e.to_string())?;
    let reader = std::io::BufReader::new(file);
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => return Err("Invalid zip entry".to_string()),
        };
        let out_path = dest.join(name);
        if file.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Stream an HTTP response body to `tmp_path` on disk, hashing as bytes arrive
/// and enforcing the `DOWNLOAD_MAX_BYTES` ceiling. Returns the hex sha256 of the
/// streamed bytes.
///
/// CRITICAL: this never accumulates the body in memory. The old code pushed
/// every chunk into a `Vec<u8>` and only then hashed/extracted it — fine for a
/// few-MB phrase pack, but a ~2.5 GB LLM base-model pack buffered in RAM
/// OOM/jetsam-killed the app on iOS. Writing straight to disk (like the STT
/// plugin's `URLSession` download for Parlometron's whisper models) keeps peak
/// memory flat regardless of model size.
async fn stream_body_to_file<F: Fn(&str, u64, u64, &str)>(
    res: reqwest::Response,
    tmp_path: &Path,
    total: u64,
    emit_progress: &F,
) -> Result<String, String> {
    use sha2::Digest;
    use std::io::Write;

    if let Some(parent) = tmp_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create download dir: {e}"))?;
    }
    let file = fs::File::create(tmp_path)
        .map_err(|e| format!("Failed to create download file: {e}"))?;
    let mut writer = std::io::BufWriter::new(file);
    let mut hasher = sha2::Sha256::new();
    let mut downloaded: u64 = 0;
    let mut stream = res.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| {
            emit_progress("error", downloaded, total, &format!("Download read failed: {e}"));
            format!("Download read failed: {e}")
        })?;
        downloaded += chunk.len() as u64;
        if downloaded > DOWNLOAD_MAX_BYTES {
            emit_progress("error", downloaded, total, "Download exceeded size limit");
            return Err(format!(
                "Download exceeded size limit ({DOWNLOAD_MAX_BYTES} bytes)"
            ));
        }
        hasher.update(&chunk);
        writer.write_all(&chunk).map_err(|e| {
            emit_progress("error", downloaded, total, &format!("Disk write failed: {e}"));
            format!("Disk write failed: {e}")
        })?;
        emit_progress("downloading", downloaded, total, "Downloading");
    }
    writer
        .flush()
        .map_err(|e| format!("Failed to flush download: {e}"))?;

    let digest = hasher.finalize();
    Ok(digest
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join(""))
}

fn find_pack_root(staging: &Path) -> Option<PathBuf> {
    let manifest = staging.join("manifest.json");
    if manifest.exists() {
        return Some(staging.to_path_buf());
    }
    let mut children = vec![];
    if let Ok(entries) = fs::read_dir(staging) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                children.push(path);
            }
        }
    }
    if children.len() == 1 {
        let candidate = children.remove(0);
        if candidate.join("manifest.json").exists() {
            return Some(candidate);
        }
    }
    None
}

fn read_manifest_info(path: &Path) -> Result<(String, Option<String>, Option<String>), String> {
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let json = serde_json::from_str::<serde_json::Value>(&raw).map_err(|e| e.to_string())?;
    let id = json
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or("Manifest missing id")?
        .to_string();
    let name = json.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let version = json
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    Ok((id, name, version))
}

fn is_private_host(host: &str) -> bool {
    host == "localhost"
        || host == "127.0.0.1"
        || host.starts_with("10.")
        || host.starts_with("192.168.")
        || host.starts_with("172.16.")
        || host.starts_with("172.17.")
        || host.starts_with("172.18.")
        || host.starts_with("172.19.")
        || host.starts_with("172.2")
        || host.starts_with("172.30.")
        || host.starts_with("172.31.")
}

pub async fn fetch_text<R: Runtime>(app: &AppHandle<R>, url: String) -> Result<String, String> {
    #[cfg(debug_assertions)]
    eprintln!("[fetch_text] Fetching URL: {}", url);

    // Handle corpan-pack URLs (either platform form) by reading from disk.
    if is_pack_url(&url) {
        #[cfg(debug_assertions)]
        eprintln!("[fetch_text] Handling corpan-pack URL");
        // Parse: corpan-pack://localhost/pack_id/path  OR
        //        http://corpan-pack.localhost/pack_id/path (Android/Windows).
        // Query parameters (e.g. ?dev=timestamp) are stripped by the parser.
        let (pack_id, rel_path) =
            parse_pack_url(&url).ok_or("Invalid corpan-pack URL format")?;

        #[cfg(debug_assertions)]
        eprintln!("[fetch_text] Pack ID: {}, Rel path: {}", pack_id, rel_path);

        // Use Tauri's proper API to get app data directory - works across all platforms
        let pack_root = app.path()
            .app_data_dir()
            .map(|dir| dir.join("corpan-packs"))
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        #[cfg(debug_assertions)]
        eprintln!("[fetch_text] Pack root: {:?}", pack_root);
        // SECURITY: sanitize BOTH segments so a corpan-pack:// URL cannot escape
        // the pack root via `..` (arbitrary file read in the app sandbox). Mirror
        // resolve_pack_db_path: reject traversal, canonicalize, verify containment.
        let safe_pack = sanitize_rel(pack_id)?;
        let safe_rel = sanitize_rel(rel_path)?;
        let file_path = pack_root.join(&safe_pack).join(&safe_rel);
        let root_canon = pack_root
            .canonicalize()
            .map_err(|e| format!("pack root unavailable: {e}"))?;
        let file_canon = file_path
            .canonicalize()
            .map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
        if !file_canon.starts_with(&root_canon) {
            return Err("path escapes pack root".to_string());
        }
        #[cfg(debug_assertions)]
        eprintln!("[fetch_text] Reading file: {:?}", file_canon);

        let content = fs::read_to_string(&file_canon)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_canon, e))?;
        #[cfg(debug_assertions)]
        eprintln!("[fetch_text] Successfully read {} bytes from disk", content.len());
        return Ok(content);
    }

    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let scheme = parsed.scheme();
    #[cfg(debug_assertions)]
    eprintln!("[fetch_text] URL scheme: {}", scheme);
    if scheme != "https" && scheme != "http" {
        eprintln!("[fetch_text] Unsupported URL scheme: {}", scheme);
        return Err("Unsupported URL scheme".to_string());
    }
    if scheme == "http" {
        let host = parsed.host_str().unwrap_or("");
        if !is_private_host(host) {
            eprintln!("[fetch_text] Insecure HTTP not allowed for host: {}", host);
            return Err("Insecure HTTP is only allowed for localhost/private hosts".to_string());
        }
    }
    let client = reqwest::Client::new();
    let res = client.get(parsed).send().await.map_err(|e| {
        eprintln!("[fetch_text] Request error: {}", e);
        e.to_string()
    })?;
    let status = res.status();
    #[cfg(debug_assertions)]
    eprintln!("[fetch_text] Response status: {}", status);
    if !status.is_success() {
        return Err(format!("Request failed ({status})"));
    }
    let text = res.text().await.map_err(|e| {
        eprintln!("[fetch_text] Text decode error: {}", e);
        e.to_string()
    })?;
    #[cfg(debug_assertions)]
    eprintln!("[fetch_text] Successfully fetched {} bytes", text.len());
    Ok(text)
}

pub async fn download_and_install<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: String,
    download_url: String,
    expected_sha256: Option<String>,
) -> Result<ContentPackInstallResult, String> {
    #[cfg(debug_assertions)]
    eprintln!(
        "[pack-install] Starting install pack_id={}, url={}",
        pack_id, download_url
    );

    let emit_progress = |stage: &str, progress: u64, total: u64, message: &str| {
        let _ = app.emit(
            "pack-install-progress",
            InstallProgressEvent {
                pack_id: pack_id.clone(),
                stage: stage.to_string(),
                progress,
                total,
                message: message.to_string(),
            },
        );
    };

    emit_progress("downloading", 0, 0, "Starting download");

    let client = reqwest::Client::new();
    let res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| {
            emit_progress("error", 0, 0, &format!("Download request failed: {e}"));
            format!("Download request failed: {e}")
        })?;
    let status = res.status();
    if !status.is_success() {
        let msg = format!("Download failed ({status})");
        emit_progress("error", 0, 0, &msg);
        return Err(msg);
    }

    let total = res.content_length().unwrap_or(0);

    let root = pack_root(app)?;
    fs::create_dir_all(&root).map_err(|e| {
        emit_progress("error", 0, 0, &format!("Failed to create pack root: {e}"));
        format!("Failed to create pack root: {e}")
    })?;

    // Stream straight to a temp file on disk (never buffer the whole archive in
    // RAM — a multi-GB model pack would OOM/jetsam the app). Hash is computed
    // incrementally as bytes arrive; the size ceiling is enforced in the helper.
    let tmp_zip = root.join(format!(".{pack_id}.download.zip"));
    let actual_sha256 = match stream_body_to_file(res, &tmp_zip, total, &emit_progress).await {
        Ok(h) => h,
        Err(e) => {
            let _ = fs::remove_file(&tmp_zip);
            return Err(e);
        }
    };
    #[cfg(debug_assertions)]
    eprintln!("[pack-install] Downloaded archive to {:?} for {}", tmp_zip, pack_id);

    emit_progress("verifying", total, total, "Verifying integrity");
    if let Some(expected) = expected_sha256 {
        if actual_sha256 != expected {
            let _ = fs::remove_file(&tmp_zip);
            emit_progress("error", 0, 0, "Pack hash mismatch");
            return Err("Pack hash mismatch".to_string());
        }
    }

    emit_progress("extracting", 0, 0, "Extracting pack");

    let staging = root.join(format!(".{pack_id}.staging"));
    if staging.exists() {
        let _ = fs::remove_dir_all(&staging);
    }
    fs::create_dir_all(&staging).map_err(|e| {
        let _ = fs::remove_file(&tmp_zip);
        emit_progress("error", 0, 0, &format!("Failed to create staging dir: {e}"));
        format!("Failed to create staging dir: {e}")
    })?;

    if let Err(e) = safe_extract_zip_file(&tmp_zip, &staging) {
        let _ = fs::remove_file(&tmp_zip);
        emit_progress("error", 0, 0, &format!("Extract failed: {e}"));
        return Err(e);
    }
    // Archive extracted — reclaim its disk space before the finalize/move so we
    // never hold the download ZIP and the unpacked copy at once any longer than
    // necessary.
    let _ = fs::remove_file(&tmp_zip);

    let pack_root_dir = find_pack_root(&staging).ok_or_else(|| {
        emit_progress("error", 0, 0, "Manifest not found in pack");
        "Manifest not found in pack".to_string()
    })?;
    let manifest_path = pack_root_dir.join("manifest.json");
    let (manifest_id, name, version) =
        read_manifest_info(&manifest_path).map_err(|e| {
            emit_progress("error", 0, 0, &format!("Invalid manifest: {e}"));
            format!("Invalid manifest: {e}")
        })?;
    if manifest_id != pack_id {
        emit_progress("error", 0, 0, "Pack id mismatch");
        return Err("Pack id mismatch".to_string());
    }

    emit_progress("finalizing", 0, 0, "Finalizing install");

    let final_dir = root.join(&pack_id);
    let backup_dir = root.join(format!(".{pack_id}.backup"));
    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }
    if final_dir.exists() {
        fs::rename(&final_dir, &backup_dir)
            .map_err(|e| {
                emit_progress("error", 0, 0, &format!("Failed to backup existing pack: {e}"));
                format!("Failed to backup existing pack: {e}")
            })?;
    }

    // The source dir to move into place (staging itself, or the nested pack root).
    let move_from = if pack_root_dir == staging {
        &staging
    } else {
        &pack_root_dir
    };
    if let Err(e) = fs::rename(move_from, &final_dir) {
        // CRITICAL: the old pack was already moved to backup_dir. If the swap-in
        // fails now, restore the backup so the user isn't left with NO pack (the
        // index.json still points at final_dir). Without this, a failed upgrade
        // bricks the installed pack.
        if backup_dir.exists() && !final_dir.exists() {
            if let Err(re) = fs::rename(&backup_dir, &final_dir) {
                eprintln!(
                    "[pack-install] CRITICAL: finalize failed ({e}) AND backup restore failed ({re}); pack {pack_id} left at {backup_dir:?}"
                );
            } else {
                eprintln!("[pack-install] finalize failed ({e}); restored previous pack from backup");
            }
        }
        let _ = fs::remove_dir_all(&staging);
        emit_progress("error", 0, 0, &format!("Failed to finalize pack install: {e}"));
        return Err(format!("Failed to finalize pack install: {e}"));
    }
    if pack_root_dir != staging {
        let _ = fs::remove_dir_all(&staging);
    }

    if backup_dir.exists() {
        let _ = fs::remove_dir_all(&backup_dir);
    }

    let manifest_url = manifest_url_for(&pack_id);
    let mut index = load_index(&root);
    let info = ContentPackInfo {
        id: pack_id.clone(),
        name,
        version,
        manifest_url: manifest_url.clone(),
        installed_at: now_epoch_ms(),
    };
    index.packs.insert(info.id.clone(), info.clone());
    save_index(&root, &index)?;
    #[cfg(debug_assertions)]
    eprintln!(
        "[pack-install] Installed {} ({:?})",
        info.id, info.version
    );

    emit_progress("complete", 0, 0, "Installation complete");

    Ok(ContentPackInstallResult { pack: info })
}

pub fn list_installed<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<ContentPackInfo>, String> {
    let root = pack_root(app)?;
    if !root.exists() {
        return Ok(vec![]);
    }
    let index = load_index(&root);
    if !index.packs.is_empty() {
        return Ok(index.packs.values().cloned().collect());
    }
    let mut packs = vec![];
    let entries = fs::read_dir(&root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("manifest.json");
        if !manifest_path.exists() {
            continue;
        }
        let (id, name, version) = read_manifest_info(&manifest_path)?;
        let info = ContentPackInfo {
            id: id.clone(),
            name,
            version,
            manifest_url: manifest_url_for(&id),
            installed_at: now_epoch_ms(),
        };
        packs.push(info);
    }
    Ok(packs)
}

pub async fn fetch_bytes<R: Runtime>(app: &AppHandle<R>, url: String) -> Result<Vec<u8>, String> {
    #[cfg(debug_assertions)]
    eprintln!("[fetch_bytes] Fetching URL: {}", url);

    // Handle corpan-pack URLs (either platform form) by reading from disk.
    if is_pack_url(&url) {
        let (pack_id, rel_path) =
            parse_pack_url(&url).ok_or("Invalid corpan-pack URL format")?;

        #[cfg(debug_assertions)]
        eprintln!("[fetch_bytes] Pack ID: {}, Rel path: {}", pack_id, rel_path);

        let pack_root = app
            .path()
            .app_data_dir()
            .map(|dir| dir.join("corpan-packs"))
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        // SECURITY: sanitize + canonicalize-contain, same as fetch_text — block
        // `..` traversal out of the pack root (arbitrary file read in sandbox).
        let safe_pack = sanitize_rel(pack_id)?;
        let safe_rel = sanitize_rel(rel_path)?;
        let file_path = pack_root.join(&safe_pack).join(&safe_rel);
        let root_canon = pack_root
            .canonicalize()
            .map_err(|e| format!("pack root unavailable: {e}"))?;
        let file_canon = file_path
            .canonicalize()
            .map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
        if !file_canon.starts_with(&root_canon) {
            return Err("path escapes pack root".to_string());
        }
        #[cfg(debug_assertions)]
        eprintln!("[fetch_bytes] Reading file: {:?}", file_canon);

        let content = fs::read(&file_canon)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_canon, e))?;
        #[cfg(debug_assertions)]
        eprintln!("[fetch_bytes] Successfully read {} bytes from disk", content.len());
        return Ok(content);
    }

    // Handle HTTP/HTTPS URLs via reqwest (no CORS restrictions)
    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let scheme = parsed.scheme();
    #[cfg(debug_assertions)]
    eprintln!("[fetch_bytes] URL scheme: {}", scheme);
    if scheme != "https" && scheme != "http" {
        eprintln!("[fetch_bytes] Unsupported URL scheme: {}", scheme);
        return Err("Unsupported URL scheme".to_string());
    }
    if scheme == "http" {
        let host = parsed.host_str().unwrap_or("");
        if !is_private_host(host) {
            eprintln!("[fetch_bytes] Insecure HTTP not allowed for host: {}", host);
            return Err("Insecure HTTP is only allowed for localhost/private hosts".to_string());
        }
    }
    let client = reqwest::Client::new();
    let res = client.get(parsed).send().await.map_err(|e| {
        eprintln!("[fetch_bytes] Request error: {}", e);
        e.to_string()
    })?;
    let status = res.status();
    #[cfg(debug_assertions)]
    eprintln!("[fetch_bytes] Response status: {}", status);
    if !status.is_success() {
        return Err(format!("Request failed ({status})"));
    }
    let bytes = res.bytes().await.map_err(|e| {
        eprintln!("[fetch_bytes] Bytes decode error: {}", e);
        e.to_string()
    })?;
    #[cfg(debug_assertions)]
    eprintln!("[fetch_bytes] Successfully fetched {} bytes", bytes.len());
    Ok(bytes.to_vec())
}

pub fn get_manifest_url<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: String,
) -> Result<String, String> {
    let root = pack_root(app)?;
    let manifest_path = root.join(&pack_id).join("manifest.json");
    if !manifest_path.exists() {
        return Err("Pack not installed".to_string());
    }
    Ok(manifest_url_for(&pack_id))
}

/// Sanitize a caller-supplied relative path before joining it onto a pack
/// directory. Rejects absolute paths and `..` traversal, and strips root/prefix
/// components, mirroring the `enclosed_name()` defense used by `safe_extract_zip`.
/// Returns an error on any traversal attempt rather than silently swallowing it.
fn sanitize_rel(rel: &str) -> Result<PathBuf, String> {
    use std::path::Component;
    let mut out = PathBuf::new();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(part) => out.push(part),
            // Drop redundant `.` segments.
            Component::CurDir => {}
            // Anything that could escape the pack root is a hard error.
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_) => {
                return Err(format!("Unsafe relative path: {rel}"));
            }
        }
    }
    if out.as_os_str().is_empty() {
        return Err(format!("Empty relative path: {rel}"));
    }
    Ok(out)
}

/// Download a module ZIP and extract it into a subpath of an already-installed
/// pack's on-disk directory (e.g. a tutor pack's per-language data). Reuses the
/// same streaming download + sha256 verify + `safe_extract_zip` path as
/// `download_and_install`, emitting `pack-install-progress` events with the same
/// stages. If `pack_manifest` is provided AND no `manifest.json` already exists
/// at the pack root, it is written there so `pack_db.rs` can later resolve the
/// pack's `databases` map. An existing manifest is never overwritten.
pub async fn install_module<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: String,
    sub_path: String,
    download_url: String,
    expected_sha256: Option<String>,
    pack_manifest: Option<String>,
) -> Result<(), String> {
    #[cfg(debug_assertions)]
    eprintln!(
        "[pack-module] Starting module install pack_id={}, sub_path={}, url={}",
        pack_id, sub_path, download_url
    );

    let emit_progress = |stage: &str, progress: u64, total: u64, message: &str| {
        let _ = app.emit(
            "pack-install-progress",
            InstallProgressEvent {
                pack_id: pack_id.clone(),
                stage: stage.to_string(),
                progress,
                total,
                message: message.to_string(),
            },
        );
    };

    // Resolve (and validate) the destination before any network work so a
    // traversal attempt fails fast and loud.
    let rel = sanitize_rel(&sub_path).map_err(|e| {
        emit_progress("error", 0, 0, &e);
        e
    })?;
    let pack_dir = pack_root(app)?.join(&pack_id);
    let dest = pack_dir.join(&rel);

    emit_progress("downloading", 0, 0, "Starting download");

    let client = reqwest::Client::new();
    let res = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| {
            emit_progress("error", 0, 0, &format!("Download request failed: {e}"));
            format!("Download request failed: {e}")
        })?;
    let status = res.status();
    if !status.is_success() {
        let msg = format!("Download failed ({status})");
        emit_progress("error", 0, 0, &msg);
        return Err(msg);
    }

    let total = res.content_length().unwrap_or(0);

    // Stream to a temp file on disk (never buffer the whole module in RAM); the
    // helper creates the parent dir, hashes incrementally, and caps the size.
    let tmp_zip = pack_dir.join(format!(".module-{}.download.zip", now_epoch_ms()));
    let actual_sha256 = match stream_body_to_file(res, &tmp_zip, total, &emit_progress).await {
        Ok(h) => h,
        Err(e) => {
            let _ = fs::remove_file(&tmp_zip);
            return Err(e);
        }
    };
    #[cfg(debug_assertions)]
    eprintln!(
        "[pack-module] Downloaded archive to {:?} for {}/{}",
        tmp_zip, pack_id, sub_path
    );

    emit_progress("verifying", total, total, "Verifying integrity");
    if let Some(expected) = expected_sha256 {
        if actual_sha256 != expected {
            let _ = fs::remove_file(&tmp_zip);
            emit_progress("error", 0, 0, "Module hash mismatch");
            return Err("Module hash mismatch".to_string());
        }
    }

    emit_progress("extracting", 0, 0, "Extracting module");

    fs::create_dir_all(&dest).map_err(|e| {
        let _ = fs::remove_file(&tmp_zip);
        emit_progress("error", 0, 0, &format!("Failed to create module dir: {e}"));
        format!("Failed to create module dir: {e}")
    })?;

    if let Err(e) = safe_extract_zip_file(&tmp_zip, &dest) {
        let _ = fs::remove_file(&tmp_zip);
        emit_progress("error", 0, 0, &format!("Extract failed: {e}"));
        return Err(e);
    }
    let _ = fs::remove_file(&tmp_zip);

    // Write the pack manifest only if one isn't already present — never clobber
    // an existing manifest (the parent pack may already be installed).
    if let Some(manifest) = pack_manifest {
        let manifest_path = pack_dir.join("manifest.json");
        if !manifest_path.exists() {
            fs::create_dir_all(&pack_dir).map_err(|e| {
                emit_progress("error", 0, 0, &format!("Failed to create pack dir: {e}"));
                format!("Failed to create pack dir: {e}")
            })?;
            fs::write(&manifest_path, manifest).map_err(|e| {
                emit_progress("error", 0, 0, &format!("Failed to write manifest: {e}"));
                format!("Failed to write manifest: {e}")
            })?;
            #[cfg(debug_assertions)]
            eprintln!("[pack-module] Wrote manifest at {:?}", manifest_path);
        }
    }

    #[cfg(debug_assertions)]
    eprintln!(
        "[pack-module] Installed module {} into {:?}",
        pack_id, dest
    );

    emit_progress("complete", 0, 0, "Module installation complete");

    Ok(())
}

/// Whether `corpan-packs/<pack_id>/<rel_path>` exists on disk as a file.
pub fn module_file_exists<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: String,
    rel_path: String,
) -> Result<bool, String> {
    let rel = sanitize_rel(&rel_path)?;
    let path = pack_root(app)?.join(&pack_id).join(rel);
    Ok(path.is_file())
}
