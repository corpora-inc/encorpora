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
//!    uninstalled packs came to live on disk forever. And a pack the *company*
//!    removed is gone too: `retired-packs.json` names the ids this build must
//!    uninstall, and [`remove_retired`] runs down that list at every launch.
//!    Dropping a game from `games/` only stops shipping it; without the ledger
//!    it stays installed and playable on every device that ever had it, which
//!    is how a retired game turned up in a catalogue a release after it was
//!    scrapped.
//!
//! The scheme name `dynawalla-pack` is baked into the built JavaScript of every
//! pack ever published. It is a public API from the first release and it can
//! never be renamed.

use std::collections::BTreeMap;
use std::fs;
use std::io::{Read, Seek};
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

/// What the manifest inside the archive must agree with the catalogue about,
/// plus the digest of the content it was built from. Everything else in a
/// manifest is the SDK schema's business, on the JS side.
#[derive(Debug, Deserialize)]
struct ManifestIdentity {
    id: String,
    version: String,
    /// Optional here and required by the schema, which is not a contradiction:
    /// the schema is enforced by `dw-pack check` at build time and this is the
    /// side that has to survive a file that got past it anyway.
    #[serde(default)]
    download: Option<ManifestDownload>,
}

/// `packs/build.mjs` computes `download.sha256` over every file of the built
/// pack except `manifest.json` itself — the manifest carries the digest, so
/// hashing it would be a fixed point nothing could compute. Path and length go
/// into the hash beside the bytes, so a renamed or truncated file moves it as
/// surely as a flipped bit does.
///
/// That is what makes it the right thing to compare a bundled pack against: it
/// is a fact about the content, and a version is a product decision.
#[derive(Debug, Deserialize)]
struct ManifestDownload {
    #[serde(default)]
    sha256: Option<String>,
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

// ─── Packs that ship with the app ────────────────────────────────────────────

/// Entries under this prefix in an APK are the packs bundled with the build.
///
/// `assets/` because `tauri android build` copies everything named in
/// `bundle.resources` into `gen/android/app/src/main/assets/` verbatim, and
/// `packs` because that is the single resource `tauri.conf.json` declares.
const APK_PACK_PREFIX: &str = "assets/packs/";

/// Every file this process has mapped. A named constant so the parsing below
/// can be exercised against a fixture rather than against this process.
const PROC_SELF_MAPS: &str = "/proc/self/maps";

/// Where the packs bundled with this build are, in the form the platform
/// actually keeps them in.
enum Bundled {
    /// A directory whose children are pack directories.
    Directory(PathBuf),
    /// An APK. The packs are ZIP entries under [`APK_PACK_PREFIX`].
    Apk(PathBuf),
}

/// Find them, or say — loudly — that there are none.
///
/// Three answers, and each is the only right answer on a platform this app
/// ships to.
///
/// * **A desktop or iOS release** — the packs are a Tauri resource and sit
///   under `resource_dir()` as an ordinary directory.
/// * **`npm run tauri dev`** — there is no bundle. `packs/build.mjs` stages
///   them into `src-tauri/packs/`, a compile-time constant of this crate, so
///   the dev loop needs no environment variable, no symlink and no manual
///   install step.
/// * **Android** — there is no directory anywhere on the device.
///   `resource_dir()` hands back the literal string `asset://localhost/`: an
///   Android asset URI, not a path, because `tauri android build` puts the
///   resources INSIDE the APK, where the platform reaches them only through its
///   AssetManager. `is_dir()` on that URI is false, and that single false is
///   why the Android build installed ZERO packs and printed nothing about it.
///
///   An APK is a ZIP and this crate already links a ZIP reader, so the packs
///   are read straight out of it. Locating the APK needs neither JNI nor a new
///   dependency: the dynamic linker mapped this very library out of the APK, or
///   out of a split of it, and `/proc/self/maps` names every file the process
///   has mapped.
///
/// Every branch that fails names the path or URI it tried. A bundled pack that
/// does not arrive is a child opening an empty app, and the version of this
/// function that shipped returned `None` in complete silence.
fn bundled_source<R: Runtime>(app: &AppHandle<R>) -> Option<Bundled> {
    match app.path().resource_dir() {
        Ok(dir) => {
            let candidate = dir.join("packs");
            if candidate.is_dir() {
                return Some(Bundled::Directory(candidate));
            }
            eprintln!(
                "[packs] the resource directory has no packs directory in it: {}",
                candidate.display()
            );
        }
        Err(problem) => eprintln!("[packs] there is no resource directory: {problem}"),
    }

    #[cfg(debug_assertions)]
    {
        let candidate = Path::new(env!("CARGO_MANIFEST_DIR")).join("packs");
        if candidate.is_dir() {
            return Some(Bundled::Directory(candidate));
        }
        eprintln!(
            "[packs] nothing staged for the dev loop at {} — run `npm run packs`",
            candidate.display()
        );
    }

    let maps = match fs::read_to_string(PROC_SELF_MAPS) {
        Ok(maps) => maps,
        Err(problem) => {
            eprintln!("[packs] cannot read {PROC_SELF_MAPS}: {problem}");
            String::new()
        }
    };
    let mut examined = vec![];
    for apk in apk_candidates(&maps, own_code_address()) {
        match holds_bundled_packs(&apk) {
            Ok(true) => return Some(Bundled::Apk(apk)),
            Ok(false) => examined.push(format!("{} (no {APK_PACK_PREFIX})", apk.display())),
            Err(problem) => examined.push(format!("{}: {problem}", apk.display())),
        }
    }

    eprintln!(
        "[packs] NO BUNDLED PACKS FOUND — this build has none installed and will show an empty \
         app. Archives examined: {}",
        if examined.is_empty() {
            "none".to_string()
        } else {
            examined.join("; ")
        }
    );
    None
}

/// The address of a byte of this library's own code.
///
/// Used to pick our own mapping out of `/proc/self/maps`, where it is one line
/// among hundreds. Casting a function to `usize` is the whole trick and it needs
/// nothing linked: whatever address it produces is inside the file this code was
/// loaded from, which is the file we are looking for.
fn own_code_address() -> usize {
    own_code_address as *const () as usize
}

/// Every APK this process might have been loaded from, best guess first.
///
/// A line of `/proc/self/maps` ends in the path of the mapped file, and on
/// Android at least one mapping always points inside the installed application:
/// either the APK itself — `extractNativeLibs=false` is the modern default, and
/// then the linker maps the library straight out of the archive — or the
/// extracted copy at `<install>/lib/<abi>/lib*.so`.
///
/// Two orderings, both load-bearing.
///
/// The mapping that *contains `own_code`* is tried first. An Android app
/// process has other applications' APKs mapped into it — the system WebView's
/// above all, which is hundreds of megabytes with a central directory to match —
/// and opening one of those first would cost real milliseconds before the first
/// window, every launch, for nothing. The address of our own code is in exactly
/// one of these ranges and that range names our own file.
///
/// Within a mapping, `base.apk` beside it comes before the mapped file itself.
/// A Play install of an app bundle is SPLIT: the native library is in
/// `split_config.arm64_v8a.apk` and every asset is in `base.apk` next to it. The
/// mapping names the split; the packs are in the sibling.
fn apk_candidates(maps: &str, own_code: usize) -> Vec<PathBuf> {
    let mut ours: Vec<PathBuf> = vec![];
    let mut ours_direct: Vec<PathBuf> = vec![];
    let mut preferred: Vec<PathBuf> = vec![];
    let mut fallback: Vec<PathBuf> = vec![];

    for line in maps.lines() {
        // Only the pathname column can hold a slash: the address range,
        // permissions, offset, device and inode never do.
        let Some(start) = line.find('/') else {
            continue;
        };
        let mapped = mapped_range(&line[..start])
            .is_some_and(|(low, high)| own_code >= low && own_code < high);

        let path = line[start..].trim_end();
        let path = path.strip_suffix(" (deleted)").unwrap_or(path);
        // `…/base.apk!/lib/arm64-v8a/libdynawalla_lib.so` is how a library
        // mapped out of an uncompressed APK is named on some releases.
        // Everything from the `!` on is a path INSIDE the archive.
        let path = match path.find(".apk") {
            Some(end) => &path[..end + ".apk".len()],
            None => path,
        };

        let (sibling, itself) = if path.ends_with(".apk") {
            let apk = Path::new(path);
            (
                apk.parent().map(|directory| directory.join("base.apk")),
                Some(apk.to_path_buf()),
            )
        } else if path.ends_with(".so") {
            // `<install>/lib/<abi>/lib*.so` → `<install>`. The `lib` component
            // is checked rather than assumed so that an ordinary Linux desktop,
            // whose maps are full of shared objects, proposes nothing.
            let lib = Path::new(path).parent().and_then(Path::parent);
            let install = lib
                .and_then(Path::file_name)
                .is_some_and(|name| name == "lib")
                .then(|| lib.and_then(Path::parent))
                .flatten();
            (install.map(|install| install.join("base.apk")), None)
        } else {
            (None, None)
        };

        if mapped {
            ours.extend(sibling);
            ours_direct.extend(itself);
        } else {
            preferred.extend(sibling);
            fallback.extend(itself);
        }
    }

    let mut candidates: Vec<PathBuf> = vec![];
    for candidate in ours
        .into_iter()
        .chain(ours_direct)
        .chain(preferred)
        .chain(fallback)
    {
        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }
    candidates
}

/// The `low-high` address range a `/proc/self/maps` line opens with.
fn mapped_range(head: &str) -> Option<(usize, usize)> {
    let mut bounds = head.split_whitespace().next()?.split('-');
    let low = usize::from_str_radix(bounds.next()?, 16).ok()?;
    let high = usize::from_str_radix(bounds.next()?, 16).ok()?;
    Some((low, high))
}

/// Whether this archive is the one carrying the app's packs.
///
/// Cheap on purpose: it reads the ZIP central directory and not one entry body,
/// so proposing a wrong APK costs a few kilobytes of I/O rather than a decode.
fn holds_bundled_packs(apk: &Path) -> Result<bool, String> {
    let file = fs::File::open(apk).map_err(|e| e.to_string())?;
    let archive = zip::ZipArchive::new(std::io::BufReader::new(file)).map_err(|e| e.to_string())?;
    Ok(archive
        .file_names()
        .any(|name| name.starts_with(APK_PACK_PREFIX)))
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    fs::create_dir_all(to)?;
    for entry in fs::read_dir(from)? {
        let entry = entry?;
        let kind = entry.file_type()?;
        let target = to.join(entry.file_name());
        if kind.is_dir() {
            copy_tree(&entry.path(), &target)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), &target)?;
        }
        // Symlinks are skipped rather than followed: a bundled pack is built by
        // this repository's own pipeline, and a link in one is a mistake at
        // best.
    }
    Ok(())
}

/// Whether the bundled copy of a pack has to be written over what is installed.
///
/// **By digest, not by version.** A pack's version is a product decision; a
/// content fix is not, and most content fixes keep the version exactly where it
/// was. Comparing versions therefore means a corrected pack sits inside the
/// binary while the device goes on running the broken one *forever*: there is
/// no later event that notices, because every subsequent launch compares the
/// same two equal versions and skips again. `download.sha256` is a fact about
/// the bytes, so it moves whenever any of them do.
///
/// The version comparison survives only as the fallback for a manifest with no
/// digest in it. The schema requires one and `dw-pack check` gates it, so a
/// pack arriving here without one is a defect in the pipeline and says so.
fn bundled_pack_differs(pack_id: &str, installed: Option<&str>, bundled: &str) -> bool {
    let Some(bundled) = manifest_identity(bundled) else {
        // Unreadable. Let the caller attempt the install and fail out loud
        // there rather than quietly deciding there is nothing to do.
        return true;
    };
    let Some(installed) = installed.and_then(manifest_identity) else {
        return true;
    };

    let installed_digest = installed.download.and_then(|download| download.sha256);
    let bundled_digest = bundled.download.and_then(|download| download.sha256);
    match (installed_digest, bundled_digest) {
        (Some(installed_digest), Some(bundled_digest)) => {
            !installed_digest.eq_ignore_ascii_case(&bundled_digest)
        }
        _ => {
            eprintln!(
                "[packs] {pack_id} has no download.sha256 in one of its manifests, so a content \
                 fix that keeps version {} cannot be seen; falling back to the version",
                bundled.version
            );
            installed.version != bundled.version
        }
    }
}

fn manifest_identity(manifest: &str) -> Option<ManifestIdentity> {
    serde_json::from_str(manifest).ok()
}

/// The verbatim manifest of the pack directory at `dir`, if it has one.
fn manifest_at(dir: &Path) -> Option<String> {
    fs::read_to_string(dir.join("manifest.json")).ok()
}

/// Whether this pack should be written over the installed one, given both
/// manifests — the digest rule, plus the dev-loop override.
///
/// A debug build re-copies unconditionally, so editing a pack and restarting is
/// the entire dev loop.
fn should_install(pack_id: &str, destination: &Path, bundled: &str) -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    bundled_pack_differs(pack_id, manifest_at(destination).as_deref(), bundled)
}

/// Install the packs that ship with this build, if the installed copy is not
/// already byte-for-byte the same pack.
///
/// Called at setup, before any window is shown, so the front door is never
/// empty on a first launch and never stale in development.
///
/// Failures are logged and swallowed. A bundled pack that will not copy is a
/// pack the child does not get; it is not a reason for the app not to open. It
/// is emphatically a reason to print something: this function used to return in
/// silence on Android, which is how an entire platform shipped with no packs.
pub fn sync_bundled<R: Runtime>(app: &AppHandle<R>) {
    let root = match pack_root(app) {
        Ok(root) => root,
        Err(problem) => {
            eprintln!(
                "[packs] no pack root ({problem}); bundled packs were NOT installed and retired \
                 packs were NOT removed"
            );
            return;
        }
    };

    sync_into(&root, || bundled_source(app));
}

/// The launch sequence, with only the platform-specific hunt for the bundle
/// left to the caller.
///
/// A seam rather than an inlined body: locating the bundle needs an `AppHandle`
/// and a real installation, and everything that matters happens after it. The
/// tests drive *this* function, so what they exercise is the order the app
/// runs in rather than an approximation of it.
///
/// **Retirement goes first, and outside the match.** Two reasons, both
/// load-bearing:
///
/// * It does not depend on the bundle. `bundled_source` returns `None` on a
///   build that cannot find its own packs, and a retirement that only happens
///   when the bundle is readable is a retirement that does not happen.
/// * Going first means an id that was somehow both retired and bundled would
///   end the launch *installed*. That is the safe direction for a
///   contradiction — a child keeps a playable game rather than losing one —
///   and the contradiction cannot be shipped anyway, because
///   `retired-packs.json` is checked against `games/` by both test suites and
///   `packs/build.mjs` refuses to build a retired id.
fn sync_into(root: &Path, locate: impl FnOnce() -> Option<Bundled>) {
    remove_retired(root, &retired_ids());

    match locate() {
        Some(Bundled::Directory(source)) => sync_from_directory(&source, root),
        Some(Bundled::Apk(apk)) => match fs::File::open(&apk) {
            Ok(file) => match zip::ZipArchive::new(std::io::BufReader::new(file)) {
                Ok(mut archive) => sync_from_zip(&mut archive, root),
                Err(problem) => eprintln!(
                    "[packs] {} is not readable as an archive: {problem}",
                    apk.display()
                ),
            },
            Err(problem) => eprintln!("[packs] cannot open {}: {problem}", apk.display()),
        },
        // `bundled_source` has already named everything it tried.
        None => {}
    }
}

fn sync_from_directory(source: &Path, root: &Path) {
    let entries = match fs::read_dir(source) {
        Ok(entries) => entries,
        Err(problem) => {
            eprintln!(
                "[packs] cannot read the bundled packs at {}: {problem}",
                source.display()
            );
            return;
        }
    };

    let mut found = 0usize;
    for entry in entries.flatten() {
        if !entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !valid_pack_id(&name) {
            continue;
        }
        found += 1;
        let Some(manifest) = manifest_at(&entry.path()) else {
            eprintln!("[packs] bundled {name} has no readable manifest.json");
            continue;
        };
        let Some(identity) = manifest_identity(&manifest) else {
            eprintln!("[packs] bundled {name} has an unparseable manifest.json");
            continue;
        };
        if identity.id != name {
            eprintln!("[packs] bundled {name} calls itself {}", identity.id);
            continue;
        }

        let destination = root.join(&name);
        if !should_install(&name, &destination, &manifest) {
            continue;
        }

        let _ = fs::remove_dir_all(&destination);
        if let Err(problem) = copy_tree(&entry.path(), &destination) {
            eprintln!("[packs] could not install bundled {name}: {problem}");
            let _ = fs::remove_dir_all(&destination);
        }
    }

    if found == 0 {
        eprintln!(
            "[packs] {} exists but holds no pack directories; nothing was installed",
            source.display()
        );
    }
}

/// Install every pack an APK carries under `assets/packs/`.
///
/// Compiled on every target rather than hidden behind
/// `#[cfg(target_os = "android")]`, so the tests below exercise it on the
/// machine you are reading this on. Only the *discovery* of the APK is
/// Android-shaped, and everywhere else it proposes nothing to open.
fn sync_from_zip<S: Read + Seek>(archive: &mut zip::ZipArchive<S>, root: &Path) {
    // The names are taken first and owned: `by_name` needs `&mut archive`, so
    // the borrow `file_names` hands out cannot survive the reads below.
    let mut by_pack: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for name in archive.file_names() {
        if name.ends_with('/') {
            continue;
        }
        let Some(rest) = name.strip_prefix(APK_PACK_PREFIX) else {
            continue;
        };
        let mut parts = rest.splitn(2, '/');
        let (Some(id), Some(relative)) = (parts.next(), parts.next()) else {
            continue;
        };
        if relative.is_empty() || !valid_pack_id(id) {
            continue;
        }
        by_pack
            .entry(id.to_string())
            .or_default()
            .push((name.to_string(), relative.to_string()));
    }

    if by_pack.is_empty() {
        eprintln!("[packs] this archive holds no {APK_PACK_PREFIX} entries; nothing was installed");
        return;
    }

    for (id, entries) in by_pack {
        let manifest_entry = format!("{APK_PACK_PREFIX}{id}/manifest.json");
        let Some(manifest) = zip_entry_string(archive, &manifest_entry) else {
            eprintln!("[packs] bundled {id} has no readable {manifest_entry}");
            continue;
        };
        let Some(identity) = manifest_identity(&manifest) else {
            eprintln!("[packs] bundled {id} has an unparseable manifest.json");
            continue;
        };
        if identity.id != id {
            eprintln!("[packs] bundled {id} calls itself {}", identity.id);
            continue;
        }

        let destination = root.join(&id);
        if !should_install(&id, &destination, &manifest) {
            continue;
        }

        let _ = fs::remove_dir_all(&destination);
        if let Err(problem) = unpack_into(archive, &entries, &destination) {
            eprintln!("[packs] could not install bundled {id}: {problem}");
            let _ = fs::remove_dir_all(&destination);
        }
    }
}

fn zip_entry_string<S: Read + Seek>(
    archive: &mut zip::ZipArchive<S>,
    name: &str,
) -> Option<String> {
    let mut entry = archive.by_name(name).ok()?;
    let mut body = String::new();
    entry.read_to_string(&mut body).ok()?;
    Some(body)
}

/// Write one pack's entries out of the archive and into `destination`.
///
/// `safe_entry_path` is applied even though this archive was built by our own
/// pipeline. The rule already exists, it costs a string walk per file, and an
/// APK is still a ZIP whose entry names are strings — the property "a pack
/// cannot escape its directory" should not quietly acquire an exception for the
/// one code path nobody can test on a device.
fn unpack_into<S: Read + Seek>(
    archive: &mut zip::ZipArchive<S>,
    entries: &[(String, String)],
    destination: &Path,
) -> Result<(), String> {
    for (name, relative) in entries {
        let Some(relative) = safe_entry_path(relative) else {
            return Err(format!("entry escapes the pack directory: {name}"));
        };
        let target = destination.join(relative);
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("cannot create {parent:?}: {e}"))?;
        }
        let mut entry = archive
            .by_name(name)
            .map_err(|e| format!("unreadable entry {name}: {e}"))?;
        let mut body = Vec::new();
        entry
            .read_to_end(&mut body)
            .map_err(|e| format!("cannot read {name}: {e}"))?;
        fs::write(&target, &body).map_err(|e| format!("cannot write {target:?}: {e}"))?;
    }
    Ok(())
}

// ─── Packs this build has retired ────────────────────────────────────────────

/// The ledger of pack ids this build must uninstall, verbatim.
///
/// **Compiled in, not read from the bundle.** It has to be true on a device
/// whose bundle cannot be located at all — `bundled_source` returns `None` on a
/// broken build and on a platform whose resource directory has moved, and a
/// retirement conditional on finding the bundle is a retirement that does not
/// happen on exactly the devices least able to recover.
///
/// The file sits beside `Cargo.toml` rather than in `packs/` so that editing it
/// changes something under a `src-tauri/` path, which is what CI path-gates the
/// native and app jobs on. A ledger whose edits ran no gate would be a ledger
/// nothing checks.
const RETIRED_LEDGER: &str = include_str!("../../retired-packs.json");

#[derive(Debug, Deserialize)]
struct RetiredLedger {
    retired: Vec<RetiredEntry>,
}

/// One retirement. Only the id is read here; `name`, `retiredIn` and `why` are
/// there for the human deciding whether a line may be deleted.
#[derive(Debug, Deserialize)]
struct RetiredEntry {
    id: String,
}

/// The ids named by a ledger, or none and a loud complaint.
///
/// A ledger that will not parse retires nothing. That is the wrong answer and
/// it is the least wrong one available: the alternative — guessing, or
/// panicking at setup — either deletes a directory nobody named or stops the
/// app from opening. Both test suites parse this file, so a malformed ledger
/// fails a gate long before a device sees it.
fn retired_ids_in(ledger: &str) -> Vec<String> {
    match serde_json::from_str::<RetiredLedger>(ledger) {
        Ok(ledger) => ledger.retired.into_iter().map(|entry| entry.id).collect(),
        Err(problem) => {
            eprintln!(
                "[packs] retired-packs.json is unreadable ({problem}); NO retired pack was \
                 removed, and every device keeps every game this build meant to pull"
            );
            Vec::new()
        }
    }
}

fn retired_ids() -> Vec<String> {
    retired_ids_in(RETIRED_LEDGER)
}

/// Uninstall the packs this build has retired, wherever they came from.
///
/// **By name, one lookup per retired id — it never reads the directory.** A
/// pack that is not on the list is not merely spared here, it is unreachable
/// from here, and that is the whole design.
///
/// The obvious rule — "delete anything the bundle does not carry" — is wrong
/// and destructive. The pack root is not a mirror of the bundle: it is also
/// where `packs_install` puts everything downloaded from the catalogue, so that
/// rule would uninstall every downloaded pack at every launch, silently, on
/// every device. `sync_from_directory` stays additive for that reason and a
/// test pins it there. A retirement is a decision about *named* packs, so it is
/// expressed as a list of names.
///
/// Cheap and idempotent: three `is_dir` calls on a launch where nothing is
/// retired, and nothing at all to do on the launch after the first.
///
/// Returns the ids actually removed, which is what the tests assert on and what
/// keeps "it removed something" from being confused with "it looked".
fn remove_retired(root: &Path, retired: &[String]) -> Vec<String> {
    let mut removed = Vec::new();
    for id in retired {
        // The ledger is data, and this is the step that turns it into a path.
        // `..`, an absolute path, and anything else that is not a pack id names
        // no pack and is refused before `join` sees it.
        if !valid_pack_id(id) {
            eprintln!(
                "[packs] the retirement ledger names {id:?}, which is not a pack id; ignored"
            );
            continue;
        }
        let directory = root.join(id);
        if !directory.is_dir() {
            continue;
        }
        match fs::remove_dir_all(&directory) {
            Ok(()) => {
                eprintln!("[packs] {id} has been retired; it is no longer installed");
                removed.push(id.clone());
            }
            // Logged rather than propagated: a pack that will not delete is not
            // a reason for the app not to open, and the next launch tries
            // again.
            Err(problem) => eprintln!("[packs] could not remove retired {id}: {problem}"),
        }
    }
    removed
}

#[cfg(test)]
mod tests;
