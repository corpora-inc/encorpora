//! The pack runtime: where a pack lives, how it gets there, and how it is
//! served.
//!
//! Everything a pack can reach on this device passes through this module, so it
//! is written as though every input is hostile — because two of them are. The
//! archive comes off the network, and the paths inside it were chosen by
//! whoever built it.
//!
//! Four properties, each enforced here rather than upstream:
//!
//! 1. **A pack cannot escape its directory.** Every served path is resolved
//!    against a canonicalised root and rejected unless it is still inside it
//!    afterwards, which is a check that `..`-in-the-string is not: a symlink
//!    committed into an archive passes the string test and fails this one.
//! 2. **A pack cannot reach the network.** The document is served with a CSP
//!    that admits only this scheme. The WebView enforces it; nothing has to
//!    remember to.
//! 3. **A pack cannot be swapped for something else.** The archive is verified
//!    against the SHA-256 in the manifest the catalogue was signed off on,
//!    before a single byte is extracted.
//! 4. **A pack that is removed is gone.** `packs_remove` is registered — the
//!    frontend invoking a command the backend never registered is how Corpán's
//!    uninstalled packs came to live on disk forever.
//!
//! The scheme name `dynawalla-pack` is baked into the built JavaScript of every
//! pack ever published. It is a public API from the first release and it can
//! never be renamed.

use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::http::{Request as HttpRequest, Response, StatusCode, header};
use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

/// Public API from the first release. Renaming it breaks every installed pack
/// at runtime while compiling perfectly. See the module docs.
pub const PACK_SCHEME: &str = "dynawalla-pack";

/// The one origin a pack may be downloaded from, pinned in native code so that
/// nothing in the WebView — including a pack — can point the installer
/// somewhere else. Changing this is a release decision, not a configuration.
const PACK_ORIGIN: &str = "https://encorpora.io/dynawalla/packs/";

/// Mirrors `MAX_DOWNLOAD_BYTES` in the SDK's manifest schema. Restated rather
/// than shared because this side must hold even if a manifest lies.
const MAX_DOWNLOAD_BYTES: u64 = 256 * 1024 * 1024;
/// Mirrors `MAX_INSTALLED_BYTES`. The decompression bomb ceiling.
const MAX_INSTALLED_BYTES: u64 = 512 * 1024 * 1024;
/// Mirrors `MAX_FILES`.
const MAX_FILES: usize = 20_000;

/// Progress is reported at most this often, so a fast download does not post
/// one message per TCP segment into the WebView.
const PROGRESS_STEP_BYTES: u64 = 256 * 1024;

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstalledPack {
    pub id: String,
    pub version: String,
    /// The manifest verbatim, parsed and validated by the SDK on the JS side.
    /// Rust reads two fields out of it and takes no view on the rest, so the
    /// schema can grow without a native release.
    pub manifest: String,
    pub bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub pack_id: String,
    pub version: String,
    pub url: String,
    pub sha256: String,
    pub bytes: u64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "phase", rename_all = "camelCase")]
pub enum Progress {
    #[serde(rename_all = "camelCase")]
    Downloading {
        received: u64,
        total: u64,
    },
    Verifying,
    Extracting,
    Installing,
}

/// What the manifest inside the archive must agree with the catalogue about.
#[derive(Debug, Deserialize)]
struct ManifestIdentity {
    id: String,
    version: String,
}

// ─── Layout ──────────────────────────────────────────────────────────────────

fn pack_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("no app data directory: {e}"))?
        .join("packs");
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create pack root: {e}"))?;
    Ok(dir)
}

/// A pack id is a directory name on three operating systems. It is validated
/// against the same shape the manifest schema states, here as well as there,
/// because this is the side that turns it into a path.
fn valid_pack_id(id: &str) -> bool {
    if id.is_empty() || id.len() > 64 {
        return false;
    }
    let mut previous_separator = true;
    for byte in id.bytes() {
        match byte {
            b'a'..=b'z' | b'0'..=b'9' => previous_separator = false,
            b'.' | b'-' => {
                if previous_separator {
                    return false;
                }
                previous_separator = true;
            }
            _ => return false,
        }
    }
    // Must start with a letter and must not end with a separator.
    !previous_separator
        && id
            .as_bytes()
            .first()
            .is_some_and(|b| b.is_ascii_lowercase())
}

/// Resolve `rel` inside `pack_dir`, or refuse.
///
/// The refusal is by canonicalised prefix, not by looking for `..` in the
/// string. Both are needed: the lexical pass rejects a traversal before the
/// filesystem is touched, and the canonical pass is what actually catches a
/// symlink, which no amount of string inspection can see.
fn resolve_asset(pack_dir: &Path, rel: &str) -> Option<PathBuf> {
    if rel.is_empty() || rel.contains('\0') || rel.contains('\\') {
        return None;
    }
    let mut candidate = pack_dir.to_path_buf();
    for segment in rel.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return None;
        }
        candidate.push(segment);
    }
    let real_root = pack_dir.canonicalize().ok()?;
    let real = candidate.canonicalize().ok()?;
    if !real.starts_with(&real_root) {
        return None;
    }
    if !real.is_file() {
        return None;
    }
    Some(real)
}

/// The same rule applied to a path coming out of a ZIP entry, before it exists.
///
/// `zip` yields an attacker-chosen string. `../../../.ssh/authorized_keys` and
/// `/etc/passwd` and `C:\Windows\x` all have to die here, and so does anything
/// with a prefix or root component on any platform.
fn safe_entry_path(name: &str) -> Option<PathBuf> {
    if name.is_empty() || name.contains('\0') {
        return None;
    }
    let normalised = name.replace('\\', "/");
    if normalised.starts_with('/') {
        return None;
    }
    // `Path::components` is platform-dependent: on Unix `C:/Windows/evil.js`
    // has no `Prefix` component at all and would extract into a directory
    // literally named `C:`, which is harmless here and is an absolute path the
    // moment the same archive is opened on Windows. A colon is not a legal
    // filename character on Windows anyway, so refusing it everywhere makes the
    // rule identical on every target instead of merely usually identical.
    if normalised.contains(':') {
        return None;
    }
    let mut out = PathBuf::new();
    for component in Path::new(&normalised).components() {
        match component {
            Component::Normal(part) => out.push(part),
            // CurDir is harmless but pointless; everything else is an escape.
            Component::CurDir => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => return None,
        }
    }
    if out.as_os_str().is_empty() {
        None
    } else {
        Some(out)
    }
}

fn directory_bytes(dir: &Path) -> u64 {
    let mut total = 0;
    let Ok(entries) = fs::read_dir(dir) else {
        return 0;
    };
    for entry in entries.flatten() {
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            total += directory_bytes(&entry.path());
        } else if kind.is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

fn read_installed(pack_dir: &Path) -> Option<InstalledPack> {
    let manifest = fs::read_to_string(pack_dir.join("manifest.json")).ok()?;
    let identity: ManifestIdentity = serde_json::from_str(&manifest).ok()?;
    Some(InstalledPack {
        id: identity.id,
        version: identity.version,
        manifest,
        bytes: directory_bytes(pack_dir),
    })
}

// ─── Serving ─────────────────────────────────────────────────────────────────

/// Sources the pack document may load from: this scheme, in the two forms Tauri
/// serves it under (`http://<scheme>.localhost` on Android and Windows, the
/// scheme itself everywhere else). Both are listed unconditionally so the
/// policy string does not depend on the build target.
const SCHEME_SOURCES: &str = "dynawalla-pack: http://dynawalla-pack.localhost";

/// The policy a pack runs under.
///
/// `default-src 'none'` and then only what a game genuinely needs. There is no
/// remote origin in it at any position, which is what makes "a pack cannot
/// reach the network" a property of the WebView rather than a promise.
///
/// `'self'` is deliberately absent: the frame is sandboxed *without*
/// `allow-same-origin`, so its origin is opaque and `'self'` would match
/// nothing at all — a policy that looks strict and denies everything, including
/// the pack's own scripts. Naming the scheme is the form that works.
fn pack_csp() -> String {
    format!(
        "default-src 'none'; \
         script-src {sources} 'wasm-unsafe-eval'; \
         style-src {sources} 'unsafe-inline'; \
         img-src {sources} data: blob:; \
         media-src {sources} blob:; \
         font-src {sources}; \
         connect-src {sources}; \
         worker-src {sources} blob:; \
         frame-src 'none'; \
         child-src 'none'; \
         object-src 'none'; \
         base-uri 'none'; \
         form-action 'none'",
        sources = SCHEME_SOURCES
    )
}

fn content_type_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "avif" => "image/avif",
        "ktx2" => "image/ktx2",
        "woff2" => "font/woff2",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "opus" => "audio/opus",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "wasm" => "application/wasm",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        "bin" => "application/octet-stream",
        _ => "application/octet-stream",
    }
}

fn refuse(status: StatusCode, message: &'static str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CONTENT_SECURITY_POLICY, "default-src 'none'")
        .body(message.as_bytes().to_vec())
        .expect("static response")
}

pub fn serve<R: Runtime>(app: &AppHandle<R>, request: &HttpRequest<Vec<u8>>) -> Response<Vec<u8>> {
    // Only reads. A pack has no write verb, and refusing here means one does
    // not appear by accident later.
    if request.method() != tauri::http::Method::GET && request.method() != tauri::http::Method::HEAD
    {
        return refuse(StatusCode::METHOD_NOT_ALLOWED, "read only");
    }

    let Ok(root) = pack_root(app) else {
        return refuse(StatusCode::INTERNAL_SERVER_ERROR, "no pack root");
    };

    let path = request.uri().path().trim_start_matches('/');
    let mut parts = path.splitn(2, '/');
    let pack_id = parts.next().unwrap_or("");
    let rel = parts.next().unwrap_or("");
    if !valid_pack_id(pack_id) {
        return refuse(StatusCode::BAD_REQUEST, "bad pack id");
    }

    let Some(file) = resolve_asset(&root.join(pack_id), rel) else {
        return refuse(StatusCode::NOT_FOUND, "not found");
    };
    let Ok(bytes) = fs::read(&file) else {
        return refuse(StatusCode::NOT_FOUND, "not found");
    };

    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type_for(&file))
        .header("X-Content-Type-Options", "nosniff")
        // The frame is opaque-origin, so every subresource it loads is a
        // cross-origin request against this scheme. Without this the pack
        // cannot fetch its own level data.
        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
        .header("Cross-Origin-Resource-Policy", "cross-origin")
        // A pack directory is replaced in place on upgrade, so a cached asset
        // from the previous version would be indistinguishable from the new
        // one. Packs are local; there is nothing to save.
        .header(header::CACHE_CONTROL, "no-store");

    if file.extension().and_then(|e| e.to_str()) == Some("html") {
        builder = builder.header(header::CONTENT_SECURITY_POLICY, pack_csp());
    }

    builder
        .body(bytes)
        .unwrap_or_else(|_| refuse(StatusCode::INTERNAL_SERVER_ERROR, "response"))
}

// ─── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn packs_list<R: Runtime>(app: AppHandle<R>) -> Result<Vec<InstalledPack>, String> {
    let root = pack_root(&app)?;
    let mut packs = vec![];
    for entry in fs::read_dir(&root).map_err(|e| e.to_string())?.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !valid_pack_id(&name) {
            // `.staging` and `.trash` live here too, and anything else is not
            // a pack whatever it claims inside.
            continue;
        }
        // The directory name and the manifest's id must agree, or two ids could
        // serve the same files at two different pack URLs.
        if let Some(pack) = read_installed(&entry.path())
            && pack.id == name
        {
            packs.push(pack);
        }
    }
    packs.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(packs)
}

/// The URL the host frames. Built here so the platform difference between the
/// custom scheme and the localhost form is decided once, in the place that
/// registered the scheme.
#[tauri::command]
pub fn packs_entry_url(pack_id: String, entry: String) -> Result<String, String> {
    if !valid_pack_id(&pack_id) {
        return Err("bad pack id".into());
    }
    for segment in entry.split('/') {
        if segment.is_empty() || segment == "." || segment == ".." {
            return Err("bad entry path".into());
        }
    }
    #[cfg(any(target_os = "android", target_os = "windows"))]
    let url = format!("http://{PACK_SCHEME}.localhost/{pack_id}/{entry}");
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    let url = format!("{PACK_SCHEME}://localhost/{pack_id}/{entry}");
    Ok(url)
}

/// The catalogue, fetched natively from the pinned origin.
///
/// The WebView never makes this request: `tauri.conf.json` keeps `connect-src`
/// closed, so the app's own document cannot reach the network at all and the
/// only URL that can be asked for is the one compiled in here. The body is
/// returned as text and validated by the SDK's schema on the JS side, which is
/// the single copy of that logic.
#[tauri::command]
pub async fn packs_catalog() -> Result<String, String> {
    let client = reqwest::Client::builder()
        .https_only(true)
        .user_agent(concat!("Dynawalla/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("cannot build a client: {e}"))?;
    let response = client
        .get(format!("{PACK_ORIGIN}catalog.json"))
        .send()
        .await
        .map_err(|e| format!("catalogue unreachable: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("catalogue unreachable: HTTP {}", response.status()));
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("catalogue unreadable: {e}"))?;
    if body.len() > 4 * 1024 * 1024 {
        return Err("catalogue is implausibly large".into());
    }
    Ok(body)
}

#[tauri::command]
pub async fn packs_remove<R: Runtime>(app: AppHandle<R>, pack_id: String) -> Result<(), String> {
    if !valid_pack_id(&pack_id) {
        return Err("bad pack id".into());
    }
    let dir = pack_root(&app)?.join(&pack_id);
    if !dir.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&dir).map_err(|e| format!("cannot remove {pack_id}: {e}"))
}

/// Download, verify, extract, swap.
///
/// Nothing touches the live pack directory until the archive has been verified
/// and fully extracted somewhere else, so a failure at any step leaves the
/// installed pack exactly as it was. An interrupted install is a wasted
/// download, never a broken pack.
#[tauri::command]
pub async fn packs_install<R: Runtime>(
    app: AppHandle<R>,
    request: InstallRequest,
    progress: Channel<Progress>,
) -> Result<InstalledPack, String> {
    if !valid_pack_id(&request.pack_id) {
        return Err("bad pack id".into());
    }
    if request.sha256.len() != 64 || !request.sha256.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("sha256 must be 64 hex characters".into());
    }
    // Origin pinning. A URL is data from a catalogue file; this is the check
    // that keeps it from being an instruction.
    if !request.url.starts_with(PACK_ORIGIN) {
        return Err(format!("refusing an origin that is not {PACK_ORIGIN}"));
    }
    if request.bytes == 0 || request.bytes > MAX_DOWNLOAD_BYTES {
        return Err("declared download size is out of range".into());
    }

    let root = pack_root(&app)?;
    let staging = root
        .join(".staging")
        .join(format!("{}-{}", request.pack_id, request.version));
    let _ = fs::remove_dir_all(&staging);
    fs::create_dir_all(&staging).map_err(|e| format!("cannot stage: {e}"))?;

    let archive = download(&request, &progress).await.inspect_err(|_| {
        let _ = fs::remove_dir_all(&staging);
    })?;

    let _ = progress.send(Progress::Extracting);
    let staging_for_task = staging.clone();
    let extracted =
        tauri::async_runtime::spawn_blocking(move || extract(&archive, &staging_for_task))
            .await
            .map_err(|e| format!("extract task failed: {e}"))?;

    if let Err(problem) = extracted {
        let _ = fs::remove_dir_all(&staging);
        return Err(problem);
    }

    // The archive says who it is. The catalogue said who it should be. Drift
    // between them means the download is not the update the parent agreed to,
    // and it is recorded as a failure rather than as a success with a surprise
    // in it.
    let installed = read_installed(&staging).ok_or_else(|| {
        let _ = fs::remove_dir_all(&staging);
        "archive has no readable manifest.json at its root".to_string()
    })?;
    if installed.id != request.pack_id || installed.version != request.version {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!(
            "archive declares {}@{} but the catalogue promised {}@{}",
            installed.id, installed.version, request.pack_id, request.version
        ));
    }

    let _ = progress.send(Progress::Installing);
    let final_dir = root.join(&request.pack_id);
    if final_dir.exists() {
        let trash = root
            .join(".trash")
            .join(format!("{}-{}", request.pack_id, now_millis()));
        fs::create_dir_all(trash.parent().unwrap_or(&root)).map_err(|e| e.to_string())?;
        fs::rename(&final_dir, &trash).map_err(|e| format!("cannot retire the old pack: {e}"))?;
        let _ = fs::remove_dir_all(&trash);
    }
    fs::rename(&staging, &final_dir).map_err(|e| format!("cannot install: {e}"))?;

    read_installed(&final_dir).ok_or_else(|| "installed pack is unreadable".to_string())
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Stream the archive into memory, hashing as it goes, refusing to grow past
/// what the manifest declared.
///
/// In memory rather than to a file so that a failed verification leaves nothing
/// on disk to clean up, and because the ceiling is already bounded by
/// `MAX_DOWNLOAD_BYTES`.
async fn download(
    request: &InstallRequest,
    progress: &Channel<Progress>,
) -> Result<Vec<u8>, String> {
    let client = reqwest::Client::builder()
        .https_only(true)
        .user_agent(concat!("Dynawalla/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| format!("cannot build a client: {e}"))?;

    let mut response = client
        .get(&request.url)
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("download failed: HTTP {}", response.status()));
    }

    let mut body = Vec::with_capacity(request.bytes.min(8 * 1024 * 1024) as usize);
    let mut hasher = Sha256::new();
    let mut announced = 0u64;
    let _ = progress.send(Progress::Downloading {
        received: 0,
        total: request.bytes,
    });

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("download interrupted: {e}"))?
    {
        if body.len() as u64 + chunk.len() as u64 > request.bytes {
            return Err("download is larger than the manifest declared".into());
        }
        hasher.update(&chunk);
        body.extend_from_slice(&chunk);
        if body.len() as u64 - announced >= PROGRESS_STEP_BYTES {
            announced = body.len() as u64;
            let _ = progress.send(Progress::Downloading {
                received: announced,
                total: request.bytes,
            });
        }
    }

    if body.len() as u64 != request.bytes {
        return Err("download is shorter than the manifest declared".into());
    }

    let _ = progress.send(Progress::Verifying);
    let digest = hasher.finalize();
    let actual = digest
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect::<String>();
    if actual != request.sha256.to_ascii_lowercase() {
        // Deliberately not logged with the URL: this is the interesting failure
        // and the message is what a support reply quotes.
        return Err(format!(
            "integrity check failed: expected {}, got {actual}",
            request.sha256
        ));
    }
    Ok(body)
}

/// Extract, with every limit the manifest schema promises enforced again here.
///
/// A ZIP is a list of paths chosen by whoever built it. Three things are
/// refused: a path that leaves the destination, a file count above `MAX_FILES`,
/// and a total uncompressed size above `MAX_INSTALLED_BYTES` — the last being
/// the difference between a large pack and a 42-kilobyte archive that fills the
/// device.
fn extract(archive: &[u8], destination: &Path) -> Result<(), String> {
    extract_within(archive, destination, MAX_FILES, MAX_INSTALLED_BYTES)
}

/// The limits are parameters so a test can prove the ceiling refuses rather
/// than assert that 512 MB is a number. Production has exactly one caller.
fn extract_within(
    archive: &[u8],
    destination: &Path,
    max_files: usize,
    max_bytes: u64,
) -> Result<(), String> {
    let cursor = std::io::Cursor::new(archive);
    let mut zip = zip::ZipArchive::new(cursor).map_err(|e| format!("not a zip archive: {e}"))?;
    if zip.len() > max_files {
        return Err(format!("archive has more than {max_files} entries"));
    }

    let mut written: u64 = 0;
    for index in 0..zip.len() {
        let mut entry = zip
            .by_index(index)
            .map_err(|e| format!("unreadable entry: {e}"))?;
        let raw_name = entry.name().to_string();
        if entry.is_dir() {
            continue;
        }
        let Some(relative) = safe_entry_path(&raw_name) else {
            return Err(format!(
                "archive entry escapes the pack directory: {raw_name}"
            ));
        };
        let target = destination.join(&relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("cannot create {parent:?}: {e}"))?;
        }

        // Read through a limited reader so a lying header cannot be believed:
        // the cap is on the bytes actually produced, not on `entry.size()`.
        let remaining = max_bytes.saturating_sub(written);
        let mut buffer = Vec::new();
        let read = entry
            .by_ref()
            .take(remaining + 1)
            .read_to_end(&mut buffer)
            .map_err(|e| format!("cannot read {raw_name}: {e}"))? as u64;
        if read > remaining {
            return Err("archive expands past the installed-size limit".into());
        }
        written += read;
        fs::write(&target, &buffer).map_err(|e| format!("cannot write {target:?}: {e}"))?;
    }

    if written == 0 {
        return Err("archive is empty".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests;
