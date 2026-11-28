//! Signed packs: verify, install atomically, locate the current version.
//!
//! A pack is a directory holding `manifest.json` and the files it lists. The
//! manifest is signed with ed25519 over its canonical JSON without the
//! `signature` member ([`crate::canon`]). Nothing in a pack is used until the
//! signature verifies against a key the host trusts and every listed file
//! matches its size and SHA-256.
//!
//! Installed layout, one directory per pack id under a host-chosen root:
//!
//! ```text
//! <root>/<pack_id>/current             # the active version, one line
//! <root>/<pack_id>/<version>/          # a verified pack directory
//! <root>/<pack_id>/.staging-*/         # an install in progress (never read)
//! ```
//!
//! An install copies or extracts into a staging directory, verifies it there,
//! renames it into place and then swaps `current` with a rename. The previous
//! version stays on disk until a newer one has verified and become current; at
//! most the current and the previous version are kept.

use crate::canon;
use crate::error::{Error, Result};
use base64::Engine as _;
use ed25519_dalek::{Signature as EdSignature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};

/// The only manifest file name.
pub const MANIFEST: &str = "manifest.json";
/// Schema versions this core reads.
pub const SUPPORTED_SCHEMA: &[u32] = &[1];
/// A manifest larger than this is refused before parsing.
const MAX_MANIFEST_BYTES: u64 = 4 << 20;

/// One file a manifest lists.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, schemars::JsonSchema)]
pub struct FileEntry {
    pub path: String,
    pub sha256: String,
    pub bytes: u64,
}

/// The signature member of a manifest.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManifestSignature {
    pub alg: String,
    pub key_id: String,
    pub sig: String,
}

/// A parsed manifest. `raw` is the exact JSON the signature was checked over.
#[derive(Debug, Clone)]
pub struct Manifest {
    pub pack_id: String,
    pub version: String,
    pub schema_version: u32,
    pub files: Vec<FileEntry>,
    /// Present on a delta pack: the version it applies to.
    pub base_version: Option<String>,
    pub raw: Value,
}

#[derive(Deserialize)]
struct ManifestFields {
    pack_id: String,
    version: String,
    schema_version: u32,
    files: Vec<FileEntry>,
    #[serde(default)]
    base_version: Option<String>,
}

impl Manifest {
    /// The SQLite file of a full pack: the one listed file ending in `.sqlite`.
    pub fn database(&self) -> Result<&FileEntry> {
        let mut dbs = self.files.iter().filter(|f| f.path.ends_with(".sqlite"));
        match (dbs.next(), dbs.next()) {
            (Some(db), None) => Ok(db),
            (None, _) => Err(Error::Pack("manifest lists no .sqlite file".into())),
            _ => Err(Error::Pack(
                "manifest lists more than one .sqlite file".into(),
            )),
        }
    }

    /// True for a delta pack.
    pub fn is_delta(&self) -> bool {
        self.base_version.is_some()
    }
}

/// A public key the host trusts to sign packs.
#[derive(Debug, Clone)]
pub struct TrustedKey {
    pub key_id: String,
    pub key: VerifyingKey,
}

impl TrustedKey {
    /// From the raw 32-byte ed25519 public key. The key id is the lowercase hex
    /// of the first 8 bytes of SHA-256 over those 32 bytes.
    pub fn from_bytes(bytes: &[u8; 32]) -> Result<Self> {
        let key = VerifyingKey::from_bytes(bytes)
            .map_err(|e| Error::Signature(format!("bad public key: {e}")))?;
        Ok(Self {
            key_id: key_id_for(bytes),
            key,
        })
    }

    /// From base64 (standard alphabet) or 64 hex characters.
    pub fn parse(text: &str) -> Result<Self> {
        let text = text.trim();
        let bytes = if text.len() == 64 && text.chars().all(|c| c.is_ascii_hexdigit()) {
            hex_decode(text)?
        } else {
            base64::engine::general_purpose::STANDARD
                .decode(text)
                .map_err(|e| Error::Signature(format!("public key is not base64 or hex: {e}")))?
        };
        let arr: [u8; 32] = bytes
            .try_into()
            .map_err(|_| Error::Signature("public key must be 32 bytes".into()))?;
        Self::from_bytes(&arr)
    }
}

/// The key id convention for a raw public key.
pub fn key_id_for(public_key: &[u8; 32]) -> String {
    hex_encode(&Sha256::digest(public_key)[..8])
}

/// Parse and signature-check the manifest in `dir`. Does not hash files.
pub fn read_manifest(dir: &Path, keys: &[TrustedKey]) -> Result<Manifest> {
    let path = dir.join(MANIFEST);
    let meta = fs::metadata(&path).map_err(|e| Error::Pack(format!("{}: {e}", path.display())))?;
    if meta.len() > MAX_MANIFEST_BYTES {
        return Err(Error::Pack("manifest too large".into()));
    }
    let raw: Value = serde_json::from_slice(&fs::read(&path)?)?;
    verify_signature(&raw, keys)?;
    let fields: ManifestFields = serde_json::from_value(raw.clone())
        .map_err(|e| Error::Pack(format!("manifest fields: {e}")))?;
    if !valid_id(&fields.pack_id) {
        return Err(Error::Pack(format!("invalid pack_id {:?}", fields.pack_id)));
    }
    if !valid_version(&fields.version) {
        return Err(Error::Pack(format!("invalid version {:?}", fields.version)));
    }
    if let Some(base) = &fields.base_version
        && !valid_version(base)
    {
        return Err(Error::Pack(format!("invalid base_version {base:?}")));
    }
    if !SUPPORTED_SCHEMA.contains(&fields.schema_version) {
        return Err(Error::Pack(format!(
            "schema_version {} not supported (this core reads {:?})",
            fields.schema_version, SUPPORTED_SCHEMA
        )));
    }
    for f in &fields.files {
        safe_relative(&f.path)?;
        if f.path == MANIFEST {
            return Err(Error::Pack("manifest lists itself".into()));
        }
    }
    Ok(Manifest {
        pack_id: fields.pack_id,
        version: fields.version,
        schema_version: fields.schema_version,
        files: fields.files,
        base_version: fields.base_version,
        raw,
    })
}

/// Check `raw.signature` against the canonical manifest without it.
pub fn verify_signature(raw: &Value, keys: &[TrustedKey]) -> Result<()> {
    if keys.is_empty() {
        return Err(Error::Signature("no trusted public key supplied".into()));
    }
    let obj = raw
        .as_object()
        .ok_or_else(|| Error::Pack("manifest is not a JSON object".into()))?;
    let sig: ManifestSignature = serde_json::from_value(
        obj.get("signature")
            .cloned()
            .ok_or_else(|| Error::Signature("manifest is unsigned".into()))?,
    )
    .map_err(|e| Error::Signature(format!("signature member: {e}")))?;
    if sig.alg != "ed25519" {
        return Err(Error::Signature(format!("unsupported alg {:?}", sig.alg)));
    }
    let key = keys
        .iter()
        .find(|k| k.key_id == sig.key_id)
        .ok_or_else(|| Error::Signature(format!("key_id {:?} is not trusted", sig.key_id)))?;
    let sig_bytes = base64::engine::general_purpose::STANDARD
        .decode(sig.sig.trim())
        .map_err(|e| Error::Signature(format!("sig is not base64: {e}")))?;
    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| Error::Signature("sig must be 64 bytes".into()))?;
    let mut unsigned = obj.clone();
    unsigned.remove("signature");
    let message = canon::to_vec(&Value::Object(unsigned))?;
    key.key
        .verify(&message, &EdSignature::from_bytes(&sig_arr))
        .map_err(|_| Error::Signature("signature does not verify".into()))
}

/// Sign a manifest value in place (pipeline and tests). Replaces any signature.
pub fn sign_manifest(raw: &mut Value, key: &ed25519_dalek::SigningKey) -> Result<()> {
    use ed25519_dalek::Signer;
    let obj = raw
        .as_object_mut()
        .ok_or_else(|| Error::Pack("manifest is not a JSON object".into()))?;
    obj.remove("signature");
    let message = canon::to_vec(&Value::Object(obj.clone()))?;
    let sig = key.sign(&message);
    let key_id = key_id_for(key.verifying_key().as_bytes());
    obj.insert(
        "signature".into(),
        serde_json::json!({
            "alg": "ed25519",
            "key_id": key_id,
            "sig": base64::engine::general_purpose::STANDARD.encode(sig.to_bytes()),
        }),
    );
    Ok(())
}

/// Hash every listed file in `dir` and compare size and SHA-256.
pub fn verify_files(dir: &Path, manifest: &Manifest) -> Result<()> {
    for f in &manifest.files {
        let path = dir.join(&f.path);
        let meta = fs::symlink_metadata(&path)
            .map_err(|e| Error::Integrity(format!("{}: {e}", f.path)))?;
        if !meta.file_type().is_file() {
            return Err(Error::Integrity(format!(
                "{} is not a regular file",
                f.path
            )));
        }
        if meta.len() != f.bytes {
            return Err(Error::Integrity(format!(
                "{}: {} bytes, manifest says {}",
                f.path,
                meta.len(),
                f.bytes
            )));
        }
        let got = sha256_file(&path)?;
        if !got.eq_ignore_ascii_case(&f.sha256) {
            return Err(Error::Integrity(format!("{}: sha256 mismatch", f.path)));
        }
    }
    Ok(())
}

/// Signature, then every file hash. The full check `harvest verify` runs.
pub fn verify_dir(dir: &Path, keys: &[TrustedKey]) -> Result<Manifest> {
    let manifest = read_manifest(dir, keys)?;
    if manifest.is_delta() {
        return Err(Error::Pack(
            "this is a delta pack; install it onto its base version".into(),
        ));
    }
    manifest.database()?;
    verify_files(dir, &manifest)?;
    Ok(manifest)
}

/// SHA-256 of a file as lowercase hex, streamed.
pub fn sha256_file(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(hex_encode(&hasher.finalize()))
}

/// Compare two pack versions by their numeric fields: `2026.11.27-1` <
/// `2026.11.27-2` < `2026.11.28-1`. Non-numeric text compares as text.
pub fn compare_versions(a: &str, b: &str) -> Ordering {
    let parts = |s: &str| -> Vec<std::result::Result<u64, String>> {
        s.split(|c: char| !c.is_ascii_alphanumeric())
            .filter(|p| !p.is_empty())
            .map(|p| p.parse::<u64>().map_err(|_| p.to_string()))
            .collect()
    };
    let (pa, pb) = (parts(a), parts(b));
    for (x, y) in pa.iter().zip(pb.iter()) {
        let ord = match (x, y) {
            (Ok(x), Ok(y)) => x.cmp(y),
            (Err(x), Err(y)) => x.cmp(y),
            (Ok(_), Err(_)) => Ordering::Greater,
            (Err(_), Ok(_)) => Ordering::Less,
        };
        if ord != Ordering::Equal {
            return ord;
        }
    }
    pa.len().cmp(&pb.len())
}

/// The installed, active version directory of `pack_id`, if any.
pub fn current(root: &Path, pack_id: &str) -> Result<Option<PathBuf>> {
    if !valid_id(pack_id) {
        return Err(Error::Invalid(format!("invalid pack_id {pack_id:?}")));
    }
    let pointer = root.join(pack_id).join("current");
    match fs::read_to_string(&pointer) {
        Ok(v) => {
            let v = v.trim();
            if !valid_version(v) {
                return Err(Error::Pack(format!("corrupt current pointer {v:?}")));
            }
            Ok(Some(root.join(pack_id).join(v)))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// The installed, active version string of `pack_id`, if any.
pub fn current_version(root: &Path, pack_id: &str) -> Result<Option<String>> {
    Ok(current(root, pack_id)?
        .and_then(|p| p.file_name().map(|n| n.to_string_lossy().into_owned())))
}

/// What an install did.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Installed {
    pub pack_id: String,
    pub version: String,
    pub dir: PathBuf,
    pub previous: Option<String>,
    /// False when this exact version was already current (nothing changed).
    pub changed: bool,
}

/// Install a full pack from an unpacked directory (copied; `src` untouched).
pub fn install_dir(root: &Path, src: &Path, keys: &[TrustedKey]) -> Result<Installed> {
    let offered = read_manifest(src, keys)?;
    if offered.is_delta() {
        return Err(Error::Pack("delta pack offered to a full install".into()));
    }
    offered.database()?;
    if let Some(done) = refuse_downgrade(root, &offered)? {
        return Ok(done);
    }
    let staging = Staging::new(root, &offered.pack_id)?;
    for f in &offered.files {
        let to = staging.path.join(&f.path);
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent)?;
        }
        copy_file(&src.join(&f.path), &to)?;
    }
    copy_file(&src.join(MANIFEST), &staging.path.join(MANIFEST))?;
    commit(root, staging, keys, &offered)
}

/// Limits for archive extraction.
#[derive(Debug, Clone, Copy)]
pub struct ArchiveLimits {
    pub max_entries: usize,
    pub max_total_bytes: u64,
}

impl Default for ArchiveLimits {
    fn default() -> Self {
        Self {
            max_entries: 256,
            max_total_bytes: 16 << 30,
        }
    }
}

/// Install a full pack from a zip archive. Entries that would escape the
/// staging directory, symlinks, and archives over `limits` are refused; the
/// byte limit counts bytes actually written, not the sizes the archive claims.
pub fn install_zip(
    root: &Path,
    archive: &Path,
    keys: &[TrustedKey],
    limits: ArchiveLimits,
) -> Result<Installed> {
    fs::create_dir_all(root)?;
    let scratch = Staging::new_anonymous(root)?;
    extract_zip(archive, &scratch.path, limits)?;
    let offered = read_manifest(&scratch.path, keys)?;
    if offered.is_delta() {
        return Err(Error::Pack("delta pack offered to a full install".into()));
    }
    offered.database()?;
    if let Some(done) = refuse_downgrade(root, &offered)? {
        return Ok(done);
    }
    let staging = scratch.adopt(root, &offered.pack_id)?;
    commit(root, staging, keys, &offered)
}

/// Extract `archive` into the empty directory `dest` under `limits`.
pub fn extract_zip(archive: &Path, dest: &Path, limits: ArchiveLimits) -> Result<()> {
    let file = fs::File::open(archive)?;
    let mut zip =
        zip::ZipArchive::new(file).map_err(|e| Error::Archive(format!("not a zip: {e}")))?;
    if zip.len() > limits.max_entries {
        return Err(Error::Archive(format!(
            "{} entries exceeds the limit of {}",
            zip.len(),
            limits.max_entries
        )));
    }
    let mut written: u64 = 0;
    for i in 0..zip.len() {
        let mut entry = zip
            .by_index(i)
            .map_err(|e| Error::Archive(format!("entry {i}: {e}")))?;
        let name = entry.name().to_string();
        if entry.is_dir() {
            continue;
        }
        if entry.is_symlink() {
            return Err(Error::Archive(format!("{name}: symlinks are refused")));
        }
        let rel =
            safe_relative(&name).map_err(|_| Error::Archive(format!("{name}: unsafe path")))?;
        let out_path = dest.join(rel);
        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut out = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&out_path)
            .map_err(|e| Error::Archive(format!("{name}: {e}")))?;
        let budget = limits.max_total_bytes - written;
        // Read one byte past the budget so an overrun is detected, not truncated.
        let copied = std::io::copy(&mut (&mut entry).take(budget.saturating_add(1)), &mut out)?;
        if copied > budget {
            return Err(Error::Archive(format!(
                "uncompressed size exceeds the limit of {} bytes",
                limits.max_total_bytes
            )));
        }
        written += copied;
        out.sync_all()?;
    }
    Ok(())
}

/// Returns `Some` when the offered version is already current (a no-op).
pub(crate) fn refuse_downgrade(root: &Path, offered: &Manifest) -> Result<Option<Installed>> {
    if let Some(installed) = current_version(root, &offered.pack_id)? {
        match compare_versions(&offered.version, &installed) {
            Ordering::Greater => {}
            Ordering::Equal => {
                return Ok(Some(Installed {
                    pack_id: offered.pack_id.clone(),
                    version: installed.clone(),
                    dir: root.join(&offered.pack_id).join(&installed),
                    previous: None,
                    changed: false,
                }));
            }
            Ordering::Less => {
                return Err(Error::Downgrade {
                    installed,
                    offered: offered.version.clone(),
                });
            }
        }
    }
    Ok(None)
}

/// Verify the staged copy, rename it into place, swap `current`, prune.
pub(crate) fn commit(
    root: &Path,
    staging: Staging,
    keys: &[TrustedKey],
    offered: &Manifest,
) -> Result<Installed> {
    // Re-read the staged manifest: the bytes in place are what gets trusted.
    let staged = read_manifest(&staging.path, keys)?;
    if staged.pack_id != offered.pack_id || staged.version != offered.version {
        return Err(Error::Pack("staged manifest differs from the offer".into()));
    }
    verify_files(&staging.path, &staged)?;
    let pack_dir = root.join(&staged.pack_id);
    let previous = current_version(root, &staged.pack_id)?;
    let final_dir = pack_dir.join(&staged.version);
    if final_dir.exists() {
        // A leftover from an interrupted install of this version; never current
        // (refuse_downgrade returned early for the current version).
        fs::remove_dir_all(&final_dir)?;
    }
    fs::rename(&staging.path, &final_dir)?;
    staging.disarm();
    write_stamp(&final_dir, &staged)?;
    write_atomic(&pack_dir.join("current"), staged.version.as_bytes())?;
    prune(&pack_dir, &staged.version, previous.as_deref())?;
    Ok(Installed {
        pack_id: staged.pack_id,
        version: staged.version,
        dir: final_dir,
        previous,
        changed: true,
    })
}

/// The install stamp: proof this directory's files were hashed when installed.
const STAMP: &str = ".verified.json";

#[derive(Serialize, Deserialize, PartialEq, Eq)]
struct Stamp {
    manifest_sha256: String,
    files: Vec<StampFile>,
}

#[derive(Serialize, Deserialize, PartialEq, Eq)]
struct StampFile {
    path: String,
    bytes: u64,
    mtime_ns: u128,
}

fn stamp_for(dir: &Path, manifest: &Manifest) -> Result<Stamp> {
    let mut files = Vec::with_capacity(manifest.files.len());
    for f in &manifest.files {
        let meta = fs::symlink_metadata(dir.join(&f.path))?;
        let mtime_ns = meta
            .modified()?
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        files.push(StampFile {
            path: f.path.clone(),
            bytes: meta.len(),
            mtime_ns,
        });
    }
    Ok(Stamp {
        manifest_sha256: hex_encode(&Sha256::digest(canon::to_vec(&manifest.raw)?)),
        files,
    })
}

/// Record that `dir`'s files matched `manifest` just now.
pub(crate) fn write_stamp(dir: &Path, manifest: &Manifest) -> Result<()> {
    let stamp = stamp_for(dir, manifest)?;
    write_atomic(&dir.join(STAMP), &serde_json::to_vec(&stamp)?)
}

/// True when the stamp in `dir` names this manifest and every file still has
/// the size and modification time it had when it was hashed.
pub fn stamp_matches(dir: &Path, manifest: &Manifest) -> Result<bool> {
    let Ok(bytes) = fs::read(dir.join(STAMP)) else {
        return Ok(false);
    };
    let Ok(stamp) = serde_json::from_slice::<Stamp>(&bytes) else {
        return Ok(false);
    };
    Ok(stamp_for(dir, manifest)
        .map(|now| now == stamp)
        .unwrap_or(false))
}

/// Keep `keep` and `previous`; remove other version directories and stale
/// staging directories.
fn prune(pack_dir: &Path, keep: &str, previous: Option<&str>) -> Result<()> {
    for entry in fs::read_dir(pack_dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if name == "current" || name == keep || Some(name.as_str()) == previous {
            continue;
        }
        if entry.file_type()?.is_dir() && (valid_version(&name) || name.starts_with(".staging-")) {
            fs::remove_dir_all(entry.path())?;
        }
    }
    Ok(())
}

/// A staging directory removed on drop unless committed.
pub(crate) struct Staging {
    pub(crate) path: PathBuf,
    armed: bool,
}

impl Staging {
    pub(crate) fn new(root: &Path, pack_id: &str) -> Result<Self> {
        let dir = root.join(pack_id);
        fs::create_dir_all(&dir)?;
        Self::create_in(&dir)
    }

    fn new_anonymous(root: &Path) -> Result<Self> {
        Self::create_in(root)
    }

    fn create_in(dir: &Path) -> Result<Self> {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let path = dir.join(format!(".staging-{}-{nanos}", std::process::id()));
        fs::create_dir(&path)?;
        Ok(Self { path, armed: true })
    }

    /// Move an anonymous staging dir under its pack id once the id is known.
    fn adopt(mut self, root: &Path, pack_id: &str) -> Result<Self> {
        let dir = root.join(pack_id);
        fs::create_dir_all(&dir)?;
        let target = dir.join(self.path.file_name().expect("staging has a name"));
        fs::rename(&self.path, &target)?;
        self.armed = false;
        Ok(Self {
            path: target,
            armed: true,
        })
    }

    fn disarm(mut self) {
        self.armed = false;
    }
}

impl Drop for Staging {
    fn drop(&mut self) {
        if self.armed {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}

pub(crate) fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = path.with_extension("tmp");
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    Ok(())
}

fn copy_file(from: &Path, to: &Path) -> Result<()> {
    let meta =
        fs::symlink_metadata(from).map_err(|e| Error::Pack(format!("{}: {e}", from.display())))?;
    if !meta.file_type().is_file() {
        return Err(Error::Pack(format!(
            "{} is not a regular file",
            from.display()
        )));
    }
    fs::copy(from, to)?;
    fs::File::open(to)?.sync_all()?;
    Ok(())
}

/// A relative path that stays inside its base: no root, no `..`, no
/// backslashes or drive prefixes, no empty components.
pub(crate) fn safe_relative(path: &str) -> Result<PathBuf> {
    if path.is_empty() || path.contains('\\') || path.contains('\0') || path.contains(':') {
        return Err(Error::Pack(format!("unsafe path {path:?}")));
    }
    let p = Path::new(path);
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::Normal(s) => out.push(s),
            _ => return Err(Error::Pack(format!("unsafe path {path:?}"))),
        }
    }
    if out.as_os_str().is_empty() {
        return Err(Error::Pack(format!("unsafe path {path:?}")));
    }
    Ok(out)
}

/// Pack ids: lowercase ASCII letters, digits, `.`, `_`, `-`; starts alphanumeric.
pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.as_bytes()[0].is_ascii_alphanumeric()
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"._-".contains(&b))
}

/// Versions: ASCII letters, digits, `.`, `_`, `-`, `+`; starts with a digit.
pub fn valid_version(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.as_bytes()[0].is_ascii_digit()
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._-+".contains(&b))
}

pub(crate) fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0xf) as usize] as char);
    }
    s
}

pub(crate) fn hex_decode(s: &str) -> Result<Vec<u8>> {
    if !s.len().is_multiple_of(2) {
        return Err(Error::Invalid("odd-length hex".into()));
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| Error::Invalid("bad hex".into())))
        .collect()
}

#[cfg(test)]
mod tests;

/// Open every installed pack under `root` (`<root>/<pack_id>/current`, or
/// plain pack directories), or `root` itself when it is a pack. Install
/// stamps are trusted (a pack is fully verified at install).
pub fn load_root(
    root: &Path,
    keys: &[TrustedKey],
) -> Result<Vec<std::sync::Arc<crate::pack::Pack>>> {
    let open = |dir: &Path| -> Result<std::sync::Arc<crate::pack::Pack>> {
        Ok(std::sync::Arc::new(crate::pack::Pack::open_with(
            dir,
            keys,
            crate::pack::Verify::InstallStamp,
        )?))
    };
    if root.join(MANIFEST).is_file() {
        return Ok(vec![open(root)?]);
    }
    let mut entries: Vec<std::path::PathBuf> = std::fs::read_dir(root)
        .map_err(|e| Error::Invalid(format!("{}: {e}", root.display())))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.is_dir())
        .collect();
    entries.sort();
    let mut out = Vec::new();
    for sub in entries {
        let name = sub
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if sub.join("current").is_file() {
            if let Some(dir) = current(root, &name)? {
                out.push(open(&dir)?);
            }
        } else if sub.join(MANIFEST).is_file() {
            out.push(open(&sub)?);
        }
    }
    if out.is_empty() {
        return Err(Error::Invalid(format!(
            "no pack under {} (a pack directory, or a root of packs)",
            root.display()
        )));
    }
    Ok(out)
}
