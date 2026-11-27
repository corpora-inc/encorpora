//! The bundled speech model.
//!
//! The release bundles one whisper.cpp model (`voice-model.json`, fetched by
//! `scripts/fetch-voice-model.sh` into the `voice/` resource folder), so voice
//! input works offline from the first launch with no download. On launch a
//! background thread copies it, once, into the folder tauri-plugin-stt reads
//! models from, checking its size and SHA-256. The frontend awaits
//! [`voice_model`] at boot, so the microphone is shown (or not) before the
//! first screen renders and never pops in later.
//!
//! Desktop builds have no on-device speech recognition in the plugin, so they
//! report `missing` and the app shows no microphone.

use serde::{Deserialize, Serialize};
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
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
        *self.status.lock().expect("voice state") = Some(status);
        self.changed.notify_all();
    }

    fn wait(&self) -> Status {
        let mut s = self.status.lock().expect("voice state");
        while s.is_none() {
            s = self.changed.wait(s).expect("voice state");
        }
        s.expect("set above")
    }
}

/// Start installing the bundled model in the background.
pub fn start(app: &AppHandle) {
    app.manage(VoiceState::default());
    let app = app.clone();
    std::thread::spawn(move || {
        let status = match install(&app) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("[voice] bundled model not installed: {e}");
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

/// The bundled model's state, once the install thread has finished.
#[tauri::command]
pub async fn voice_model(app: AppHandle) -> Result<ModelInfo, String> {
    let file = manifest().file;
    let status = tauri::async_runtime::spawn_blocking(move || app.state::<VoiceState>().wait())
        .await
        .map_err(|e| e.to_string())?;
    Ok(ModelInfo { status, file })
}

/// tauri-plugin-stt's model folder: `Documents/whisper-cpp/models` on iOS,
/// `filesDir/whisper-cpp/models` on Android (`filesDir` is `dataDir/files`).
fn models_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
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
    // Fast path: already installed (the plugin also validates the ggml header).
    if std::fs::metadata(&dest)
        .map(|md| md.len() == m.bytes)
        .unwrap_or(false)
    {
        return Ok(Status::Ready);
    }
    let src = app
        .path()
        .resolve(
            format!("voice/{}", m.file),
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| e.to_string())?;
    // On Android the resource is an APK asset; tauri-plugin-fs opens it.
    let input = {
        use tauri_plugin_fs::{FsExt, OpenOptions};
        match app.fs().open(src, OpenOptions::new().read(true).clone()) {
            Ok(f) => f,
            Err(e) => {
                eprintln!("[voice] no bundled model in this build: {e}");
                return Ok(Status::Missing);
            }
        }
    };
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let part = dir.join(format!("{}.part", m.file));
    let result = copy_verified(input, &part, &m);
    match result {
        Ok(()) => {
            std::fs::rename(&part, &dest).map_err(|e| e.to_string())?;
            Ok(Status::Ready)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&part);
            Err(e)
        }
    }
}

/// Stream `input` to `part`, then require the manifest's size and SHA-256.
fn copy_verified(
    mut input: impl std::io::Read,
    part: &std::path::Path,
    m: &Model,
) -> Result<(), String> {
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

    #[test]
    fn the_shipped_manifest_is_well_formed() {
        let m = manifest();
        check_manifest(&m).unwrap();
        assert!(m.file.starts_with("ggml-") && m.file.ends_with(".bin"));
        assert!(m.url.ends_with(&m.file));
    }

    #[test]
    fn copies_verify_size_and_hash() {
        let dir = std::env::temp_dir().join(format!("crane-voice-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
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
    fn status_waits_until_set() {
        let s = std::sync::Arc::new(VoiceState::default());
        let s2 = s.clone();
        let t = std::thread::spawn(move || s2.wait());
        std::thread::sleep(std::time::Duration::from_millis(20));
        s.set(Status::Ready);
        assert_eq!(t.join().unwrap(), Status::Ready);
    }
}
