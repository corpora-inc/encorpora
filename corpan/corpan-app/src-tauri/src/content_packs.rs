use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, Runtime};

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

fn manifest_url_for(pack_id: &str) -> String {
    format!("corpan-pack://localhost/{pack_id}/manifest.json")
}

fn now_epoch_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn safe_extract_zip(data: &[u8], dest: &Path) -> Result<(), String> {
    let reader = Cursor::new(data);
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

fn hash_bytes_sha256(bytes: &[u8]) -> String {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    let result = hasher.finalize();
    result
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<Vec<_>>()
        .join("")
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
    eprintln!("[fetch_text] Fetching URL: {}", url);

    // Handle corpan-pack:// URLs by reading from local filesystem
    if url.starts_with("corpan-pack://") {
        eprintln!("[fetch_text] Handling corpan-pack:// URL");
        // Parse: corpan-pack://localhost/pack_id/path/to/file
        // Strip query parameters (e.g., ?dev=timestamp)
        let url_without_query = url.split('?').next().unwrap_or(&url);
        let path_part = url_without_query.strip_prefix("corpan-pack://localhost/")
            .ok_or("Invalid corpan-pack URL format")?;
        let mut parts = path_part.splitn(2, '/');
        let pack_id = parts.next().ok_or("Missing pack ID in corpan-pack URL")?;
        let rel_path = parts.next().ok_or("Missing file path in corpan-pack URL")?;

        eprintln!("[fetch_text] Pack ID: {}, Rel path: {}", pack_id, rel_path);

        // Use Tauri's proper API to get app data directory - works across all platforms
        let pack_root = app.path()
            .app_data_dir()
            .map(|dir| dir.join("corpan-packs"))
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        eprintln!("[fetch_text] Pack root: {:?}", pack_root);
        let file_path = pack_root.join(pack_id).join(rel_path);
        eprintln!("[fetch_text] Reading file: {:?}", file_path);

        let content = fs::read_to_string(&file_path)
            .map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
        eprintln!("[fetch_text] Successfully read {} bytes from disk", content.len());
        return Ok(content);
    }

    let parsed = reqwest::Url::parse(&url).map_err(|e| e.to_string())?;
    let scheme = parsed.scheme();
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
    eprintln!("[fetch_text] Response status: {}", status);
    if !status.is_success() {
        return Err(format!("Request failed ({status})"));
    }
    let text = res.text().await.map_err(|e| {
        eprintln!("[fetch_text] Text decode error: {}", e);
        e.to_string()
    })?;
    eprintln!("[fetch_text] Successfully fetched {} bytes", text.len());
    Ok(text)
}

pub async fn download_and_install<R: Runtime>(
    app: &AppHandle<R>,
    pack_id: String,
    download_url: String,
    expected_sha256: Option<String>,
) -> Result<ContentPackInstallResult, String> {
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
    let mut downloaded: u64 = 0;
    let mut buf = Vec::with_capacity(total as usize);
    let mut stream = res.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| {
            emit_progress("error", downloaded, total, &format!("Download read failed: {e}"));
            format!("Download read failed: {e}")
        })?;
        downloaded += chunk.len() as u64;
        buf.extend_from_slice(&chunk);
        emit_progress("downloading", downloaded, total, "Downloading");
    }

    let bytes = buf;
    eprintln!(
        "[pack-install] Downloaded {} bytes for {}",
        bytes.len(),
        pack_id
    );

    emit_progress("verifying", downloaded, total, "Verifying integrity");

    if let Some(expected) = expected_sha256 {
        let actual = hash_bytes_sha256(&bytes);
        if actual != expected {
            emit_progress("error", 0, 0, "Pack hash mismatch");
            return Err("Pack hash mismatch".to_string());
        }
    }

    emit_progress("extracting", 0, 0, "Extracting pack");

    let root = pack_root(app)?;
    fs::create_dir_all(&root)
        .map_err(|e| {
            emit_progress("error", 0, 0, &format!("Failed to create pack root: {e}"));
            format!("Failed to create pack root: {e}")
        })?;

    let staging = root.join(format!(".{pack_id}.staging"));
    if staging.exists() {
        let _ = fs::remove_dir_all(&staging);
    }
    fs::create_dir_all(&staging)
        .map_err(|e| {
            emit_progress("error", 0, 0, &format!("Failed to create staging dir: {e}"));
            format!("Failed to create staging dir: {e}")
        })?;

    safe_extract_zip(&bytes, &staging).map_err(|e| {
        emit_progress("error", 0, 0, &format!("Extract failed: {e}"));
        e
    })?;

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

    if pack_root_dir == staging {
        fs::rename(&staging, &final_dir)
            .map_err(|e| {
                emit_progress("error", 0, 0, &format!("Failed to finalize pack install: {e}"));
                format!("Failed to finalize pack install: {e}")
            })?;
    } else {
        fs::rename(&pack_root_dir, &final_dir)
            .map_err(|e| {
                emit_progress("error", 0, 0, &format!("Failed to finalize pack install: {e}"));
                format!("Failed to finalize pack install: {e}")
            })?;
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

pub fn fetch_bytes<R: Runtime>(app: &AppHandle<R>, url: String) -> Result<Vec<u8>, String> {
    eprintln!("[fetch_bytes] Fetching URL: {}", url);

    if !url.starts_with("corpan-pack://") {
        return Err("fetch_bytes only supports corpan-pack:// URLs".to_string());
    }

    let url_without_query = url.split('?').next().unwrap_or(&url);
    let path_part = url_without_query
        .strip_prefix("corpan-pack://localhost/")
        .ok_or("Invalid corpan-pack URL format")?;
    let mut parts = path_part.splitn(2, '/');
    let pack_id = parts.next().ok_or("Missing pack ID in corpan-pack URL")?;
    let rel_path = parts.next().ok_or("Missing file path in corpan-pack URL")?;

    eprintln!("[fetch_bytes] Pack ID: {}, Rel path: {}", pack_id, rel_path);

    let pack_root = app
        .path()
        .app_data_dir()
        .map(|dir| dir.join("corpan-packs"))
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let file_path = pack_root.join(pack_id).join(rel_path);
    eprintln!("[fetch_bytes] Reading file: {:?}", file_path);

    let content = fs::read(&file_path)
        .map_err(|e| format!("Failed to read file {:?}: {}", file_path, e))?;
    eprintln!("[fetch_bytes] Successfully read {} bytes from disk", content.len());
    Ok(content)
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
