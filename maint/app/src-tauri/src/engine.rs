//! Opening the engine in process through `harvest_core::shell::open_host`:
//! the same host `harvest serve` builds, from the app's own folders and keys,
//! with no server.
//!
//! The shell's part is small: install the signed packs this build ships
//! (`resources/packs/<pack>/`) into `<data>/packs` with
//! `harvest_core::packs::install_dir` (signature against the compiled-in keys,
//! every file hashed), keep the secrets in the keychain (`secrets`), start the
//! optional embedding helper (`helper`), and hand the core a `HostConfig`.
//! Without a hub address and without a helper, the engine opens no socket.

use crate::{config::Config, helper::EmbedHelper, pack_keys, secrets};
use harvest_core::api::{self, Host};
use harvest_core::shell::{self, HostConfig, HostReport, KeyStore};
use harvest_core::{TrustedKey, packs};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// Where the app keeps things.
#[derive(Debug, Clone)]
pub struct Paths {
    /// App data: installed packs, records, config.json.
    pub data: PathBuf,
    /// The signed packs the build ships (one folder per pack).
    pub bundled: Option<PathBuf>,
}

impl Paths {
    pub fn for_app(app: &tauri::AppHandle) -> Result<Self, String> {
        use tauri::Manager;
        let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let bundled = app
            .path()
            .resource_dir()
            .ok()
            .map(|r| r.join("resources").join("packs"));
        Ok(Self { data, bundled })
    }
}

/// The open engine: the API host, what opening it found, and the helper process when one runs.
pub struct Engine {
    host: Host,
    report: HostReport,
    helper: Mutex<Option<EmbedHelper>>,
}

impl Engine {
    /// Open everything the app needs, from `paths` and `config.json` there.
    pub fn open(paths: &Paths) -> Result<Self, String> {
        let config = Config::load(&paths.data)?;
        let store = secrets::Store::platform(&paths.data);
        Self::open_with(paths, &config, &store)
    }

    /// Open with explicit settings and key store (tests use a file store).
    pub fn open_with(paths: &Paths, config: &Config, store: &dyn KeyStore) -> Result<Self, String> {
        std::fs::create_dir_all(&paths.data).map_err(|e| e.to_string())?;
        let keys = parse_keys(&pack_keys::packs())?;
        let root = paths.data.join("packs");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        if let Some(src) = &paths.bundled {
            install_bundled(&root, src, &keys)?;
        }

        // Search by meaning, through the managed helper when it is configured.
        let mut helper = None;
        let mut warnings = Vec::new();
        if let Some(emb) = &config.embedder {
            match EmbedHelper::start(emb, &paths.data.join("helper.pid")) {
                Ok(h) => helper = Some(h),
                Err(e) => warnings.push(format!(
                    "Search by meaning is off: the embedding helper did not start ({e})."
                )),
            }
        }

        let cfg = HostConfig {
            packs_root: root.clone(),
            records_path: paths.data.join("records.db"),
            pack_keys: keys,
            field_keys: parse_keys(&pack_keys::field())?,
            encrypt_records: true,
            embedder_url: helper.as_ref().map(|h| h.url().to_string()),
            embedder_sha256: helper.as_ref().map(|h| h.model_sha256().to_string()),
            hub_url: config.hub.clone(),
            install_root: Some(root),
            ..Default::default()
        };
        let (host, mut report) = shell::open_host(&cfg, store).map_err(|e| e.to_string())?;
        if report.packs.is_empty() {
            return Err("this build carries no manual pack".into());
        }
        report.warnings.extend(warnings);
        Ok(Self {
            host,
            report,
            helper: Mutex::new(helper),
        })
    }

    /// One API call: the envelope `{ok, result | error}`.
    pub fn call(&self, method: &str, params: Value) -> Value {
        api::envelope(api::call(&self.host, method, params))
    }

    /// A pack's figure or page image, re-hashed by the core: (media type, bytes).
    pub fn asset(
        &self,
        pack_id: &str,
        asset_id: &str,
    ) -> Result<Option<(String, Vec<u8>)>, String> {
        self.host
            .asset(pack_id, asset_id)
            .map_err(|e| e.to_string())
    }

    /// What opening found, for Records: warnings in plain words.
    pub fn report(&self) -> Value {
        json!({ "warnings": self.report.warnings, "device_id": self.report.device_id })
    }

    /// Stop the helper process, if one runs.
    pub fn shutdown(&self) {
        if let Some(h) = self.helper.lock().unwrap_or_else(|p| p.into_inner()).take() {
            h.stop();
        }
    }

    /// The helper's loopback address, when one runs (tests).
    pub fn helper_url(&self) -> Option<String> {
        self.helper
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .as_ref()
            .map(|h| h.url().to_string())
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn parse_keys(keys: &[&str]) -> Result<Vec<TrustedKey>, String> {
    keys.iter()
        .map(|k| TrustedKey::parse(k).map_err(|e| format!("key: {e}")))
        .collect()
}

/// Each bundled pack folder holds one version (manifest.json and its files),
/// or the installed layout (`<version>/` plus `current`). Install it when newer.
fn install_bundled(root: &Path, bundled: &Path, keys: &[TrustedKey]) -> Result<(), String> {
    let Ok(entries) = std::fs::read_dir(bundled) else {
        return Ok(());
    };
    for entry in entries.flatten() {
        let dir = entry.path();
        if !dir.is_dir() {
            continue;
        }
        let src = if dir.join(packs::MANIFEST).is_file() {
            dir
        } else {
            let name = dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default()
                .to_string();
            match packs::current(bundled, &name).map_err(|e| e.to_string())? {
                Some(d) => d,
                None => continue,
            }
        };
        packs::install_dir(root, &src, keys)
            .map_err(|e| format!("pack install {}: {e}", src.display()))?;
    }
    Ok(())
}
