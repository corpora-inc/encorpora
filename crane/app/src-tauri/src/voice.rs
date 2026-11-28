//! The bundled speech model.
//!
//! The release bundles one whisper.cpp model (`voice-model.json`, fetched by
//! `scripts/fetch-voice-model.sh` into the `voice/` resource folder), so voice
//! input works offline from the first launch with no download. A background
//! thread copies it, once, into the folder tauri-plugin-stt reads models from,
//! checking its size and SHA-256:
//!
//! - iOS: from `<App>.app/assets/voice/` to `Documents/whisper-cpp/models/`,
//!   marked do-not-back-up (it can always be recreated from the bundle).
//! - Android: streamed from the APK asset through the NDK asset manager on the
//!   install thread (never the UI thread, no extra cache copy) to
//!   `filesDir/whisper-cpp/models/`.
//!
//! Boot does not wait for the copy: [`voice_model`] with `wait: false` answers
//! at once (`installing` counts as available, so the microphone is decided
//! before the first render and never pops in), and the first tap waits for it
//! with `wait: true` while the button says it is starting.
//!
//! A build without the model (dev) and desktop builds (no on-device speech in
//! the plugin) report `missing`, and the app shows no microphone.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Condvar, Mutex};
use tauri::{AppHandle, Manager};

/// The model the app ships, as `voice-model.json` states it.
#[derive(Debug, Clone, Deserialize)]
pub struct Model {
    pub file: String,
    pub url: String,
    pub bytes: u64,
    pub sha256: String,
}

pub fn manifest() -> Model {
    serde_json::from_str(include_str!("../voice-model.json")).expect("voice-model.json is valid")
}

/// Whether this build carries the model (set by build.rs when
/// `voice/<file>` exists at compile time).
const BUNDLED: bool = option_env!("CRANE_VOICE_BUNDLED").is_some();

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    /// The copy is still running.
    Installing,
    /// The model is in the plugin's folder and verified.
    Ready,
    /// This build or platform has no bundled model (dev build, desktop).
    Missing,
    /// The bundled model could not be installed (logged).
    Failed,
}

#[derive(Default)]
pub struct VoiceState {
    /// `None` until the install thread finishes.
    status: Mutex<Option<Status>>,
    changed: Condvar,
}

impl VoiceState {
    fn set(&self, status: Status) {
        *self.status.lock().unwrap_or_else(|e| e.into_inner()) = Some(status);
        self.changed.notify_all();
    }

    fn now(&self) -> Status {
        self.status
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .unwrap_or(Status::Installing)
    }

    fn wait(&self) -> Status {
        let mut s = self.status.lock().unwrap_or_else(|e| e.into_inner());
        while s.is_none() {
            s = self.changed.wait(s).unwrap_or_else(|e| e.into_inner());
        }
        s.unwrap_or(Status::Failed)
    }
}

/// Start installing the bundled model in the background.
pub fn start(app: &AppHandle) {
    app.manage(VoiceState::default());
    if !BUNDLED || models_dir(app).is_none() {
        app.state::<VoiceState>().set(Status::Missing);
        return;
    }
    let app = app.clone();
    std::thread::spawn(move || {
        // A panic must never leave the first tap waiting forever.
        let status = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| install(&app)))
        {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => {
                eprintln!("[voice] bundled model not installed: {e}");
                Status::Failed
            }
            Err(_) => {
                eprintln!("[voice] bundled model install panicked");
                Status::Failed
            }
        };
        app.state::<VoiceState>().set(status);
    });
}

#[derive(Serialize)]
pub struct ModelInfo {
    status: Status,
    file: String,
}

/// The bundled model's state. `wait: true` blocks until the install has
/// finished (the first tap); `wait: false` answers at once (boot).
#[tauri::command]
pub async fn voice_model(app: AppHandle, wait: Option<bool>) -> Result<ModelInfo, String> {
    let file = manifest().file;
    let status = if wait.unwrap_or(false) {
        tauri::async_runtime::spawn_blocking(move || app.state::<VoiceState>().wait())
            .await
            .map_err(|e| e.to_string())?
    } else {
        app.state::<VoiceState>().now()
    };
    Ok(ModelInfo { status, file })
}

/// tauri-plugin-stt's model folder: `Documents/whisper-cpp/models` on iOS,
/// `filesDir/whisper-cpp/models` on Android (`filesDir` is `dataDir/files`).
fn models_dir(app: &AppHandle) -> Option<PathBuf> {
    #[cfg(target_os = "ios")]
    return app
        .path()
        .document_dir()
        .ok()
        .map(|d| d.join("whisper-cpp/models"));
    #[cfg(target_os = "android")]
    return app
        .path()
        .data_dir()
        .ok()
        .map(|d| d.join("files/whisper-cpp/models"));
    #[cfg(not(any(target_os = "ios", target_os = "android")))]
    {
        let _ = app;
        None
    }
}

fn install(app: &AppHandle) -> Result<Status, String> {
    let m = manifest();
    check_manifest(&m)?;
    let Some(dir) = models_dir(app) else {
        return Ok(Status::Missing);
    };
    let dest = dir.join(&m.file);
    let marker = dir.join(format!("{}.sha256", m.file));
    // Fast path: installed and verified before (size plus the recorded hash).
    let installed = std::fs::metadata(&dest)
        .map(|md| md.len() == m.bytes)
        .unwrap_or(false)
        && std::fs::read_to_string(&marker)
            .map(|s| s.trim() == m.sha256)
            .unwrap_or(false);
    if installed {
        return Ok(Status::Ready);
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let Some(input) = open_bundled(app, &m.file)? else {
        return Ok(Status::Missing);
    };
    let part = dir.join(format!("{}.part", m.file));
    if let Err(e) = copy_verified(input, &part, &m) {
        let _ = std::fs::remove_file(&part);
        return Err(e);
    }
    std::fs::rename(&part, &dest).map_err(|e| e.to_string())?;
    std::fs::write(&marker, &m.sha256).map_err(|e| e.to_string())?;
    exclude_from_backup(&dest);
    remove_stale(&dir, &m.file);
    Ok(Status::Ready)
}

/// The bundled model as a stream, or `None` when this build has none.
#[cfg(target_os = "android")]
fn open_bundled(_app: &AppHandle, file: &str) -> Result<Option<Box<dyn std::io::Read>>, String> {
    android_asset::open(&format!("voice/{file}"))
}

#[cfg(not(target_os = "android"))]
fn open_bundled(app: &AppHandle, file: &str) -> Result<Option<Box<dyn std::io::Read>>, String> {
    let src = app
        .path()
        .resolve(
            format!("voice/{file}"),
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| e.to_string())?;
    match std::fs::File::open(&src) {
        Ok(f) => Ok(Some(Box::new(f))),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(target_os = "android")]
mod android_asset {
    //! Read an APK asset through the NDK's AAssetManager, on the calling
    //! (background) thread.
    use jni::objects::JObject;
    use std::ffi::CString;
    use std::io::Read;

    pub fn open(path: &str) -> Result<Option<Box<dyn Read>>, String> {
        let ctx = ndk_context::android_context();
        // SAFETY: ndk_context hands out the process's JavaVM and Android
        // context, both valid for the life of the app.
        let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
        let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
        // SAFETY: the context pointer is a live android.content.Context.
        let context = unsafe { JObject::from_raw(ctx.context().cast()) };
        let assets = env
            .call_method(
                &context,
                "getAssets",
                "()Landroid/content/res/AssetManager;",
                &[],
            )
            .and_then(|v| v.l())
            .map_err(|e| e.to_string())?;
        // Keep the Java AssetManager alive while the native one is in use.
        let assets = env.new_global_ref(assets).map_err(|e| e.to_string())?;
        // SAFETY: a valid JNIEnv and a live android.content.res.AssetManager.
        let raw = unsafe {
            ndk_sys::AAssetManager_fromJava(env.get_raw().cast(), assets.as_obj().as_raw().cast())
        };
        let Some(ptr) = std::ptr::NonNull::new(raw) else {
            return Err("no AAssetManager".into());
        };
        // SAFETY: the pointer came from AAssetManager_fromJava above and the
        // global ref keeps its Java owner alive.
        let manager = unsafe { ndk::asset::AssetManager::from_ptr(ptr) };
        let name = CString::new(path).map_err(|e| e.to_string())?;
        Ok(manager.open(&name).map(|asset| {
            Box::new(AssetReader {
                asset,
                _owner: assets,
            }) as Box<dyn Read>
        }))
    }

    struct AssetReader {
        asset: ndk::asset::Asset,
        _owner: jni::objects::GlobalRef,
    }

    impl Read for AssetReader {
        fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
            self.asset.read(buf)
        }
    }
}

/// iOS backs up Documents to iCloud; a file the app can recreate from its own
/// bundle must be excluded (Apple's iOS Data Storage Guidelines).
fn exclude_from_backup(path: &Path) {
    #[cfg(target_os = "ios")]
    {
        use std::os::unix::ffi::OsStrExt;
        let name = c"com.apple.metadata:com_apple_backup_excludeItem";
        let value = b"com.apple.backupd";
        if let Ok(p) = std::ffi::CString::new(path.as_os_str().as_bytes()) {
            // SAFETY: NUL-terminated path and name; value pointer and length match.
            let rc = unsafe {
                libc::setxattr(
                    p.as_ptr(),
                    name.as_ptr(),
                    value.as_ptr().cast(),
                    value.len(),
                    0,
                    0,
                )
            };
            if rc != 0 {
                eprintln!(
                    "[voice] could not mark the model do-not-back-up: {}",
                    std::io::Error::last_os_error()
                );
            }
        }
    }
    #[cfg(not(target_os = "ios"))]
    let _ = path;
}

/// Remove models, hash markers and partial files from earlier versions.
fn remove_stale(dir: &Path, keep: &str) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let keep_marker = format!("{keep}.sha256");
    for e in entries.flatten() {
        let name = e.file_name().to_string_lossy().into_owned();
        let ours = name.starts_with("ggml-")
            && (name.ends_with(".bin") || name.ends_with(".part") || name.ends_with(".sha256"));
        if ours
            && name != keep
            && name != keep_marker
            && let Err(err) = std::fs::remove_file(e.path())
        {
            eprintln!("[voice] could not remove old model {name}: {err}");
        }
    }
}

/// Stream `input` to `part`, then require the manifest's size and SHA-256.
fn copy_verified(mut input: impl std::io::Read, part: &Path, m: &Model) -> Result<(), String> {
    use sha2::{Digest, Sha256};
    use std::io::Write;
    let mut out = std::fs::File::create(part).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    let mut total = 0u64;
    loop {
        let n = input.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        out.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        total += n as u64;
    }
    out.sync_all().map_err(|e| e.to_string())?;
    let sha = hex(&hasher.finalize());
    if total != m.bytes || sha != m.sha256 {
        return Err(format!(
            "{} does not match voice-model.json ({total} bytes, sha256 {sha})",
            m.file
        ));
    }
    Ok(())
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// The manifest names a plain file (no path) with a SHA-256 and a size.
fn check_manifest(m: &Model) -> Result<(), String> {
    let plain = !m.file.is_empty()
        && !m.file.starts_with('.')
        && m.file
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'));
    let sha = m.sha256.len() == 64
        && m.sha256
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase());
    if plain && sha && m.bytes > 0 && m.url.starts_with("https://") {
        Ok(())
    } else {
        Err("voice-model.json is malformed".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("crane-voice-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn the_shipped_manifest_is_well_formed() {
        let m = manifest();
        check_manifest(&m).unwrap();
        assert!(m.file.starts_with("ggml-") && m.file.ends_with(".bin"));
        assert!(m.url.ends_with(&m.file));
    }

    #[test]
    fn copies_verify_size_and_hash() {
        let dir = temp_dir("copy");
        let data = b"ggml model bytes".to_vec();
        use sha2::{Digest, Sha256};
        let good = Model {
            file: "ggml-test.bin".into(),
            url: "https://example.invalid/ggml-test.bin".into(),
            bytes: data.len() as u64,
            sha256: hex(&Sha256::digest(&data)),
        };
        let part = dir.join("ggml-test.bin.part");
        copy_verified(&data[..], &part, &good).unwrap();
        assert_eq!(std::fs::read(&part).unwrap(), data);
        let bad = Model {
            sha256: "0".repeat(64),
            ..good.clone()
        };
        assert!(copy_verified(&data[..], &part, &bad).is_err());
        let short = Model { bytes: 3, ..good };
        assert!(copy_verified(&data[..], &part, &short).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn manifests_with_paths_or_bad_hashes_are_refused() {
        let ok = manifest();
        for bad in [
            Model {
                file: "../x.bin".into(),
                ..ok.clone()
            },
            Model {
                file: ".x.bin".into(),
                ..ok.clone()
            },
            Model {
                sha256: "ABC".into(),
                ..ok.clone()
            },
            Model {
                url: "http://x/y.bin".into(),
                ..ok.clone()
            },
            Model {
                bytes: 0,
                ..ok.clone()
            },
        ] {
            assert!(check_manifest(&bad).is_err(), "{bad:?}");
        }
    }

    #[test]
    fn stale_models_and_partials_are_removed_and_nothing_else() {
        let dir = temp_dir("stale");
        for f in [
            "ggml-new.bin",
            "ggml-new.bin.sha256",
            "ggml-old.bin",
            "ggml-old.bin.sha256",
            "ggml-new.bin.part",
            "notes.txt",
        ] {
            std::fs::write(dir.join(f), b"x").unwrap();
        }
        remove_stale(&dir, "ggml-new.bin");
        let mut left: Vec<String> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        left.sort();
        assert_eq!(left, ["ggml-new.bin", "ggml-new.bin.sha256", "notes.txt"]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn status_answers_at_once_or_waits_until_set() {
        let s = std::sync::Arc::new(VoiceState::default());
        assert_eq!(s.now(), Status::Installing);
        let s2 = s.clone();
        let t = std::thread::spawn(move || s2.wait());
        std::thread::sleep(std::time::Duration::from_millis(20));
        s.set(Status::Ready);
        assert_eq!(t.join().unwrap(), Status::Ready);
        assert_eq!(s.now(), Status::Ready);
    }
}
