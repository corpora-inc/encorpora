//! Signed delta packs: a small download that turns the installed version
//! into the next one, byte for byte.
//!
//! A delta directory holds:
//!
//! - `manifest.json`: signed, with `base_version`, listing the two files
//!   below with their hashes;
//! - `<target database path>.bsdiff`: a BSDIFF40 patch from the base
//!   version's SQLite file to the target's;
//! - `target.manifest.json`: the target version's own signed full manifest,
//!   exactly as the full pack ships it.
//!
//! Installing applies the patch to the installed base and then trusts the
//! result only as a full pack: the target manifest's signature and every
//! file hash are checked before the `current` pointer moves. A delta can
//! therefore never produce anything the full pack would not. Files other
//! than the database must be unchanged from the base (they are copied).
//! The patcher holds the base database in memory while it writes the target.

use crate::error::{Error, Result};
use crate::packs::{
    self, Installed, MANIFEST, Manifest, Staging, TrustedKey, commit, current, read_manifest,
    refuse_downgrade, sha256_file, stamp_matches, verify_files,
};
use serde_json::{Value, json};
use sha2::Digest;
use std::fs;
use std::path::Path;

/// The target manifest's file name inside a delta.
pub const TARGET_MANIFEST: &str = "target.manifest.json";
/// The patch file suffix.
pub const PATCH_SUFFIX: &str = ".bsdiff";

/// Install the delta in `delta_dir` onto the installed version of its pack.
pub fn install_delta(root: &Path, delta_dir: &Path, keys: &[TrustedKey]) -> Result<Installed> {
    let delta = read_manifest(delta_dir, keys)?;
    let base_version = delta
        .base_version
        .clone()
        .ok_or_else(|| Error::Pack("not a delta pack (no base_version)".into()))?;
    verify_files(delta_dir, &delta)?;
    let listed = |name: &str| delta.files.iter().any(|f| f.path == name);
    if !listed(TARGET_MANIFEST) {
        return Err(Error::Pack(format!(
            "delta does not list {TARGET_MANIFEST}"
        )));
    }

    // The target as the full pack states it.
    let staging = Staging::new(root, &delta.pack_id)?;
    fs::copy(delta_dir.join(TARGET_MANIFEST), staging.path.join(MANIFEST))?;
    let target = read_manifest(&staging.path, keys)?;
    if target.is_delta() || target.pack_id != delta.pack_id || target.version != delta.version {
        return Err(Error::Pack(format!(
            "target manifest is {} {}, delta says {} {}",
            target.pack_id, target.version, delta.pack_id, delta.version
        )));
    }
    if let Some(done) = refuse_downgrade(root, &target)? {
        return Ok(done);
    }

    // The installed base, verified.
    let base_dir = current(root, &delta.pack_id)?.ok_or_else(|| {
        Error::Pack(format!(
            "delta to {} needs {} {base_version} installed; install the full pack",
            delta.version, delta.pack_id
        ))
    })?;
    let base = read_manifest(&base_dir, keys)?;
    if base.version != base_version {
        return Err(Error::Pack(format!(
            "delta to {} needs base {base_version}; {} is installed; install the full pack",
            delta.version, base.version
        )));
    }
    if !stamp_matches(&base_dir, &base)? {
        verify_files(&base_dir, &base)?;
    }

    let target_db = target.database()?.clone();
    let base_db = base.database()?;
    // The delta names the exact base bytes it patches; a re-baked base of the
    // same version gets the full pack, not a failed patch.
    let want_base = delta.raw["base_sha256"].as_str().unwrap_or_default();
    if !want_base.eq_ignore_ascii_case(&base_db.sha256) {
        return Err(Error::Pack(format!(
            "delta to {} was made from a different {base_version} build; install the full pack",
            delta.version
        )));
    }
    let patch_name = format!("{}{PATCH_SUFFIX}", target_db.path);
    let patch_entry = delta
        .files
        .iter()
        .find(|f| f.path == patch_name)
        .ok_or_else(|| Error::Pack(format!("delta does not list {patch_name}")))?;
    // Read the patch once and check those exact bytes, so nothing unsigned is
    // ever parsed even if the folder changes under us.
    let patch = read_verified(&delta_dir.join(&patch_name), patch_entry)?;
    for f in &target.files {
        let to = staging.path.join(packs::safe_relative(&f.path)?);
        if let Some(parent) = to.parent() {
            fs::create_dir_all(parent)?;
        }
        if f.path == target_db.path {
            patch_file(&base_dir.join(&base_db.path), &patch, &to, f.bytes)?;
            if !sha256_file(&to)?.eq_ignore_ascii_case(&f.sha256) {
                return Err(Error::Integrity(format!(
                    "{}: patched database does not match the target manifest",
                    f.path
                )));
            }
        } else {
            let same = base
                .files
                .iter()
                .find(|b| b.path == f.path && b.sha256.eq_ignore_ascii_case(&f.sha256));
            if same.is_none() {
                return Err(Error::Pack(format!(
                    "{} changed but the delta carries no patch for it; install the full pack",
                    f.path
                )));
            }
            fs::copy(base_dir.join(&f.path), &to)?;
            fs::File::open(&to)?.sync_all()?;
        }
    }
    commit(root, staging, keys, &target)
}

/// Read `path` and check its size and SHA-256 against `entry`.
fn read_verified(path: &Path, entry: &packs::FileEntry) -> Result<Vec<u8>> {
    if fs::metadata(path)?.len() != entry.bytes {
        return Err(Error::Integrity(format!("{}: size changed", entry.path)));
    }
    let bytes = fs::read(path)?;
    let sha = packs::hex_encode(&sha2::Sha256::digest(&bytes));
    if bytes.len() as u64 != entry.bytes || !sha.eq_ignore_ascii_case(&entry.sha256) {
        return Err(Error::Integrity(format!("{}: sha256 mismatch", entry.path)));
    }
    Ok(bytes)
}

/// Apply `patch` to `base` into `out`, writing at most `expected` bytes.
fn patch_file(base: &Path, patch: &[u8], out: &Path, expected: u64) -> Result<()> {
    let patcher =
        qbsdiff::Bspatch::new(patch).map_err(|e| Error::Integrity(format!("bad patch: {e}")))?;
    if patcher.hint_target_size() != expected {
        return Err(Error::Integrity(
            "patch does not produce the target's size".into(),
        ));
    }
    let source = fs::read(base)?;
    let mut file = Capped {
        inner: std::io::BufWriter::new(fs::File::create(out)?),
        left: expected,
    };
    patcher
        .apply(&source, &mut file)
        .map_err(|e| Error::Integrity(format!("patch failed: {e}")))?;
    let file = file
        .inner
        .into_inner()
        .map_err(|e| Error::Io(e.into_error()))?;
    file.sync_all()?;
    Ok(())
}

/// A writer that refuses to grow past the size the signed manifest states.
struct Capped<W> {
    inner: W,
    left: u64,
}

impl<W: std::io::Write> std::io::Write for Capped<W> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        if buf.len() as u64 > self.left {
            return Err(std::io::Error::other(
                "patch output exceeds the target size",
            ));
        }
        let n = self.inner.write(buf)?;
        self.left -= n as u64;
        Ok(n)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.inner.flush()
    }
}

/// Write a delta from the full pack in `base_dir` to the full pack in
/// `target_dir` into `out_dir`. The manifest is signed when `key` is given;
/// otherwise it is written unsigned for the bake's own signer. Both packs
/// must verify against `keys` first.
pub fn make_delta(
    base_dir: &Path,
    target_dir: &Path,
    out_dir: &Path,
    keys: &[TrustedKey],
    key: Option<&ed25519_dalek::SigningKey>,
) -> Result<Manifest> {
    let base = packs::verify_dir(base_dir, keys)?;
    let target = packs::verify_dir(target_dir, keys)?;
    if base.pack_id != target.pack_id {
        return Err(Error::Invalid("base and target are different packs".into()));
    }
    if packs::compare_versions(&target.version, &base.version) != std::cmp::Ordering::Greater {
        return Err(Error::Invalid("target must be newer than base".into()));
    }
    let target_db = target.database()?;
    for f in &target.files {
        if f.path != target_db.path
            && !base
                .files
                .iter()
                .any(|b| b.path == f.path && b.sha256.eq_ignore_ascii_case(&f.sha256))
        {
            return Err(Error::Invalid(format!(
                "{} differs from the base; a delta patches only the database",
                f.path
            )));
        }
    }
    fs::create_dir_all(out_dir)?;
    let patch_name = format!("{}{PATCH_SUFFIX}", target_db.path);
    if let Some(parent) = out_dir.join(&patch_name).parent() {
        fs::create_dir_all(parent)?;
    }
    {
        let source = fs::read(base_dir.join(&base.database()?.path))?;
        let dest = fs::read(target_dir.join(&target_db.path))?;
        let mut out = std::io::BufWriter::new(fs::File::create(out_dir.join(&patch_name))?);
        qbsdiff::Bsdiff::new(&source, &dest)
            .compare(&mut out)
            .map_err(|e| Error::Pack(format!("diff failed: {e}")))?;
        out.into_inner()
            .map_err(|e| Error::Io(e.into_error()))?
            .sync_all()?;
    }
    fs::copy(target_dir.join(MANIFEST), out_dir.join(TARGET_MANIFEST))?;
    let mut files = Vec::new();
    for name in [patch_name.as_str(), TARGET_MANIFEST] {
        let p = out_dir.join(name);
        files.push(
            json!({"path": name, "sha256": sha256_file(&p)?, "bytes": fs::metadata(&p)?.len()}),
        );
    }
    let mut manifest: Value = json!({
        "pack_id": target.pack_id,
        "version": target.version,
        "schema_version": target.schema_version,
        "base_version": base.version,
        "base_sha256": base.database()?.sha256,
        "files": files,
    });
    if let Some(k) = key {
        packs::sign_manifest(&mut manifest, k)?;
    }
    packs::write_atomic(
        &out_dir.join(MANIFEST),
        &serde_json::to_vec_pretty(&manifest)?,
    )?;
    if key.is_some() {
        read_manifest(out_dir, keys)
    } else {
        Ok(Manifest {
            pack_id: target.pack_id,
            version: target.version,
            schema_version: target.schema_version,
            files: serde_json::from_value(manifest["files"].clone())?,
            base_version: Some(base.version),
            raw: manifest,
        })
    }
}
