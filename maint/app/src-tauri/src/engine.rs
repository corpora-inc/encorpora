//! Opening the engine in process: the same parts `harvest serve` assembles,
//! from the app's own folders and keys, with no server.
//!
//! - **Packs**: the signed packs this build ships (`resources/packs/<pack>/`)
//!   are installed into `<data>/packs` with `harvest_core::packs::install_dir`
//!   (signature against the compiled-in keys, every file hashed), then each
//!   current version is opened with `Verify::InstallStamp`.
//! - **Records**: `<data>/records.db`, encrypted with the records key from the
//!   keychain (`secrets`).
//! - **Search by meaning** (optional): when `config.json` names an embedding
//!   model and a `llama-server` binary, a managed helper serves it on a
//!   loopback port (`helper`) and each pack gets the engine's server embedder.
//!   Without it, search is lexical and no socket is ever opened.
//! - **Hub** (optional): when `config.json` names a hub, the device's HTTP link,
//!   signed with the device key from the keychain. Without it, no network.

use crate::{config::Config, helper::EmbedHelper, pack_keys, secrets};
use harvest_core::api::{self, Host};
use harvest_core::{Pack, TrustedKey, Verify, packs};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

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

/// The open engine: the API host, and the helper process when one runs.
pub struct Engine {
    host: Host,
    helper: Mutex<Option<EmbedHelper>>,
}

impl Engine {
    /// Open everything the app needs, from `paths` and `config.json` there.
    pub fn open(paths: &Paths) -> Result<Self, String> {
        let config = Config::load(&paths.data)?;
        Self::open_with(paths, &config, &secrets::Store::platform(&paths.data))
    }

    /// Open with explicit settings and key store (tests use a file store).
    pub fn open_with(
        paths: &Paths,
        config: &Config,
        store: &secrets::Store,
    ) -> Result<Self, String> {
        std::fs::create_dir_all(&paths.data).map_err(|e| e.to_string())?;
        let keys = parse_keys(&pack_keys::packs())?;
        let root = paths.data.join("packs");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        if let Some(src) = &paths.bundled {
            install_bundled(&root, src, &keys)?;
        }
        let opened = open_installed(&root, &keys)?;
        if opened.is_empty() {
            return Err("this build carries no manual pack".into());
        }

        let records_key = store.records_key()?;
        let records = harvest_core::records::Records::open_with_key(
            &paths.data.join("records.db"),
            Some(&records_key),
        )
        .map_err(|e| format!("records: {e}"))?;
        let mut host =
            Host::new(opened.clone(), records).with_field_keys(parse_keys(&pack_keys::field())?);

        // Search by meaning, through the managed helper when it is configured.
        let mut helper = None;
        if let Some(emb) = &config.embedder {
            match EmbedHelper::start(emb, &paths.data.join("helper.pid")) {
                Ok(h) => {
                    for p in &opened {
                        match harvest_core::embed::ServerEmbedder::for_pack(
                            h.url(),
                            p,
                            h.model_sha256(),
                            std::time::Duration::from_secs(60),
                        ) {
                            Ok(e) => host = host.with_embedder(p.pack_id(), Arc::new(e)),
                            Err(e) => eprintln!(
                                "maint: {}: search by meaning stays off: {e}",
                                p.pack_id()
                            ),
                        }
                    }
                    helper = Some(h);
                }
                Err(e) => eprintln!(
                    "maint: the embedding helper did not start, search stays lexical: {e}"
                ),
            }
        }

        // The hub link, only when a hub is configured: otherwise nothing ever leaves the device.
        if let Some(url) = &config.hub {
            let device = harvest_core::sync::DeviceKey::from_seed(&store.device_seed()?);
            let link = harvest_core::hub::http::HttpHubLink::new(
                url,
                device,
                std::time::Duration::from_secs(60),
            );
            host = host.with_hub_link(Arc::new(link), Some(root.clone()), keys.clone());
        }
        Ok(Self {
            host,
            helper: Mutex::new(helper),
        })
    }

    /// One API call: the envelope `{ok, result | error}`.
    pub fn call(&self, method: &str, params: Value) -> Value {
        api::envelope(api::call(&self.host, method, params))
    }

    /// The host, for the asset protocol.
    pub fn host(&self) -> &Host {
        &self.host
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

/// Every installed pack's current version, verified.
fn open_installed(root: &Path, keys: &[TrustedKey]) -> Result<Vec<Arc<Pack>>, String> {
    let mut names: Vec<String> = std::fs::read_dir(root)
        .map_err(|e| e.to_string())?
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        .collect();
    names.sort();
    let mut out = Vec::new();
    for name in names {
        if let Some(dir) = packs::current(root, &name).map_err(|e| e.to_string())? {
            out.push(Arc::new(
                Pack::open_with(&dir, keys, Verify::InstallStamp)
                    .map_err(|e| format!("pack {name}: {e}"))?,
            ));
        }
    }
    Ok(out)
}
