//! One way for a native shell (Tauri or any other host) to build the API
//! host in process: [`open_host`] takes a [`HostConfig`] and a [`KeyStore`]
//! (the shell keeps the records key and the device key in the OS keychain)
//! and returns a [`crate::api::Host`]; the shell then calls
//! [`crate::api::call`] (or `call_json`) and [`crate::api::Host::asset`].
//! No logic lives here that the HTTP transport does not also use.
//!
//! With `default-features = false` the library has no HTTP client; turn on
//! the `net` feature for an embedding server URL or a hub address.

use crate::api::Host;
use crate::error::{Error, Result};
use crate::pack::DenseStatus;
use crate::packs::TrustedKey;
use crate::records::Records;
use crate::sync::{DeviceKey, LinkClass};
use std::path::PathBuf;
use std::sync::Arc;

/// Where the shell keeps secrets. `load` returns `None` when the name was
/// never stored; the engine then generates the secret and calls `store`
/// once. Names: [`RECORDS_KEY`] (32 bytes) and [`DEVICE_KEY`] (a 32-byte
/// ed25519 seed).
pub trait KeyStore: Send + Sync {
    fn load(&self, name: &str) -> Result<Option<Vec<u8>>>;
    fn store(&self, name: &str, secret: &[u8]) -> Result<()>;
}

/// The records-at-rest key.
pub const RECORDS_KEY: &str = "harvest.records-key";
/// The device's signing seed (its identity at the hub).
pub const DEVICE_KEY: &str = "harvest.device-key";

/// A key store in a directory (files readable by the owner only), for
/// development and tests. A shipping shell uses the OS keychain.
pub struct FileKeyStore(pub PathBuf);

impl KeyStore for FileKeyStore {
    fn load(&self, name: &str) -> Result<Option<Vec<u8>>> {
        match std::fs::read(self.0.join(name)) {
            Ok(b) => Ok(Some(b)),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.into()),
        }
    }
    fn store(&self, name: &str, secret: &[u8]) -> Result<()> {
        std::fs::create_dir_all(&self.0)?;
        let path = self.0.join(name);
        std::fs::write(&path, secret)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }
}

/// A key store in memory (tests).
#[derive(Default)]
pub struct MemoryKeyStore(std::sync::Mutex<std::collections::BTreeMap<String, Vec<u8>>>);

impl KeyStore for MemoryKeyStore {
    fn load(&self, name: &str) -> Result<Option<Vec<u8>>> {
        Ok(self
            .0
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .get(name)
            .cloned())
    }
    fn store(&self, name: &str, secret: &[u8]) -> Result<()> {
        self.0
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .insert(name.to_string(), secret.to_vec());
        Ok(())
    }
}

/// What the shell knows at start.
#[derive(Debug, Clone, Default)]
pub struct HostConfig {
    /// A root of installed packs (`<root>/<pack_id>/current`), or one pack.
    pub packs_root: PathBuf,
    /// The device records database (created when absent).
    pub records_path: PathBuf,
    /// Keys a pack's manifest must be signed by.
    pub pack_keys: Vec<TrustedKey>,
    /// Keys a field-note bundle must be signed by (the hub's); the pack
    /// keys when empty.
    pub field_keys: Vec<TrustedKey>,
    /// Encrypt the records at rest with the key store's records key.
    pub encrypt_records: bool,
    /// An embedding server (`/v1/embeddings`), feature `net`. The GGUF it
    /// loaded is found and hashed unless `embedder_sha256` names it.
    pub embedder_url: Option<String>,
    pub embedder_sha256: Option<String>,
    /// The hub, feature `net`: `https://` (or `http://` to this machine).
    pub hub_url: Option<String>,
    /// Trust only this PEM (the hub's CA) for the hub: a pin. Else the
    /// platform's store (`hub_platform_roots`, feature `platform-roots`), else
    /// Mozilla's roots.
    pub hub_ca_pem: Option<Vec<u8>>,
    pub hub_platform_roots: bool,
    /// Plain HTTP to a hub on another machine (development only).
    pub allow_insecure_http: bool,
    /// The link the device is on (the hub's attachment policy follows it).
    pub link: LinkClass,
    /// Where installed pack updates go (`packs_root` when absent).
    pub install_root: Option<PathBuf>,
    /// Where `sync.export` writes for a removable drive.
    pub outbox_dir: Option<PathBuf>,
    /// A local OpenAI-compatible model server (`…/v1`, JSON-schema output),
    /// feature `net`; and its model name (the first it lists when absent).
    pub llm_url: Option<String>,
    pub llm_model: Option<String>,
    /// The fields `lesson.prefill` may fill on this device class (default
    /// minutes and parts).
    pub prefill_policy: Option<crate::assist::PrefillPolicy>,
}

/// What [`open_host`] found, for the shell to log or show.
#[derive(Debug, Clone)]
pub struct HostReport {
    pub packs: Vec<String>,
    /// Per pack, whether dense search runs and why not.
    pub dense: Vec<(String, DenseStatus)>,
    pub device_id: String,
    pub device_public_key: String,
    /// Things that did not stop the host (an embedder that does not fit a
    /// pack).
    pub warnings: Vec<String>,
}

fn secret32(
    keys: &dyn KeyStore,
    name: &str,
    make: impl FnOnce() -> Result<[u8; 32]>,
) -> Result<[u8; 32]> {
    match keys.load(name)? {
        Some(b) => b
            .as_slice()
            .try_into()
            .map_err(|_| Error::Invalid(format!("key store {name}: not 32 bytes"))),
        None => {
            let k = make()?;
            keys.store(name, &k)?;
            Ok(k)
        }
    }
}

/// The device's key, created and stored on first use.
pub fn device_key(keys: &dyn KeyStore) -> Result<DeviceKey> {
    let seed = secret32(keys, DEVICE_KEY, || Ok(DeviceKey::generate()?.seed()))?;
    Ok(DeviceKey::from_seed(&seed))
}

/// Build the API host the HTTP transport and a native shell share.
pub fn open_host(cfg: &HostConfig, keys: &dyn KeyStore) -> Result<(Host, HostReport)> {
    let packs = crate::packs::load_root(&cfg.packs_root, &cfg.pack_keys)?;
    let records_key = if cfg.encrypt_records {
        Some(secret32(
            keys,
            RECORDS_KEY,
            crate::crypt::RecordKey::generate,
        )?)
    } else {
        None
    };
    let records = Records::open_with_key(&cfg.records_path, records_key.as_ref())?;
    let dk = device_key(keys)?;
    let mut report = HostReport {
        packs: packs.iter().map(|p| p.pack_id().to_string()).collect(),
        dense: Vec::new(),
        device_id: dk.device_id(),
        device_public_key: dk.public_base64(),
        warnings: Vec::new(),
    };
    let field_keys = if cfg.field_keys.is_empty() {
        cfg.pack_keys.clone()
    } else {
        cfg.field_keys.clone()
    };
    let mut host = Host::new(packs.clone(), records).with_field_keys(field_keys);
    if let Some(d) = &cfg.outbox_dir {
        host = host.with_outbox_dir(d.clone());
    }
    for p in &packs {
        let e = embedder_for(cfg, p, &mut report)?;
        report
            .dense
            .push((p.pack_id().to_string(), p.dense_status(e.as_deref())?));
        if let Some(e) = e {
            host = host.with_embedder(p.pack_id(), e);
        }
    }
    host = with_hub(host, cfg, dk)?;
    host = with_llm(host, cfg, &mut report)?;
    if let Some(p) = &cfg.prefill_policy {
        p.check()?;
        host = host.with_prefill_policy(p.clone());
    }
    Ok((host, report))
}

#[cfg(feature = "net")]
fn embedder_for(
    cfg: &HostConfig,
    pack: &crate::pack::Pack,
    report: &mut HostReport,
) -> Result<Option<Arc<dyn crate::embed::Embedder>>> {
    let Some(url) = &cfg.embedder_url else {
        return hashing_for(pack);
    };
    if pack.meta("embedder_id").is_none() {
        return Ok(None);
    }
    let sha = match &cfg.embedder_sha256 {
        Some(s) => s.clone(),
        None => crate::embed::served_model_sha256(url)?,
    };
    match crate::embed::ServerEmbedder::for_pack(
        url,
        pack,
        &sha,
        std::time::Duration::from_secs(60),
    ) {
        Ok(e) => Ok(Some(Arc::new(e))),
        Err(e) => {
            report.warnings.push(format!("{}: {e}", pack.pack_id()));
            Ok(None)
        }
    }
}

#[cfg(not(feature = "net"))]
fn embedder_for(
    cfg: &HostConfig,
    pack: &crate::pack::Pack,
    _: &mut HostReport,
) -> Result<Option<Arc<dyn crate::embed::Embedder>>> {
    if cfg.embedder_url.is_some() {
        return Err(Error::Invalid(
            "an embedder URL needs harvest-core's `net` feature".into(),
        ));
    }
    hashing_for(pack)
}

/// The built-in hashing embedder, for a pack baked with it.
fn hashing_for(pack: &crate::pack::Pack) -> Result<Option<Arc<dyn crate::embed::Embedder>>> {
    let dim = pack.meta("embed_dim").and_then(|d| d.parse::<usize>().ok());
    Ok(match (pack.meta("embedder_id"), dim) {
        (Some(id), Some(dim)) if id == format!("hashing-v1-{dim}") => {
            Some(Arc::new(crate::embed::HashingEmbedder::new(dim)))
        }
        _ => None,
    })
}

#[cfg(feature = "net")]
fn with_hub(host: Host, cfg: &HostConfig, dk: DeviceKey) -> Result<Host> {
    let Some(url) = &cfg.hub_url else {
        return Ok(host);
    };
    let tls = crate::hub::http::HubTls {
        roots: match &cfg.hub_ca_pem {
            Some(pem) => crate::hub::http::HubRoots::Pem(pem.clone()),
            None if cfg.hub_platform_roots => crate::hub::http::HubRoots::Platform,
            None => crate::hub::http::HubRoots::Mozilla,
        },
        allow_insecure_http: cfg.allow_insecure_http,
    };
    let link =
        crate::hub::http::HttpHubLink::with_tls(url, dk, std::time::Duration::from_secs(60), &tls)?
            .with_link(cfg.link);
    let root = cfg
        .install_root
        .clone()
        .unwrap_or_else(|| cfg.packs_root.clone());
    Ok(host.with_hub_link(Arc::new(link), Some(root), cfg.pack_keys.clone()))
}

#[cfg(not(feature = "net"))]
fn with_hub(host: Host, cfg: &HostConfig, _: DeviceKey) -> Result<Host> {
    if cfg.hub_url.is_some() {
        return Err(Error::Invalid(
            "a hub address needs harvest-core's `net` feature".into(),
        ));
    }
    Ok(host)
}

#[cfg(feature = "net")]
fn with_llm(host: Host, cfg: &HostConfig, report: &mut HostReport) -> Result<Host> {
    let Some(url) = &cfg.llm_url else {
        return Ok(host);
    };
    match crate::llm::OpenAiCompatible::new(
        url,
        cfg.llm_model.as_deref(),
        std::time::Duration::from_secs(60),
    ) {
        Ok(l) => Ok(host.with_llm(Arc::new(l))),
        // Not fatal: the model methods answer with the model off.
        Err(e) => {
            report.warnings.push(format!("model off: {e}"));
            Ok(host)
        }
    }
}

#[cfg(not(feature = "net"))]
fn with_llm(host: Host, cfg: &HostConfig, _: &mut HostReport) -> Result<Host> {
    if cfg.llm_url.is_some() {
        return Err(Error::Invalid(
            "a model URL needs harvest-core's `net` feature".into(),
        ));
    }
    Ok(host)
}
