//! The app's own files, kept safe from what happens around a running app.
//!
//! - `check_writable`: the records folder must take a write before the engine
//!   opens there; otherwise the person is told which folder and what to do.
//! - `RecordsGuard`: the records file the engine opened must still be the one
//!   at its path. If another copy of the app, an update or a person moved or
//!   replaced it while this one was open, SQLite would refuse every write
//!   ("readonly database"); the guard says it in plain words instead, before
//!   the engine is asked.
//! - `seal_packs`: installed pack files are made read-only, so nothing can
//!   write to a pack database (the engine also opens them read-only).

use std::io;
use std::path::{Path, PathBuf};

/// The error code the frontend shows once, as a restart request.
pub const RESTART: &str = "restart_needed";
/// The error code when the engine could not open (its message is written for a person).
pub const OPEN_FAILED: &str = "open_failed";
const CANNOT_SAVE: &str = "Maintenance Associate cannot save its records in";

/// What a person is told when the engine did not open: the records folder's own message, or a
/// plain one for anything else (the detail is in the log).
pub fn opening_message(detail: &str) -> String {
    if detail.starts_with(CANNOT_SAVE) {
        detail.to_string()
    } else {
        "Maintenance Associate could not open its manuals or its records. Quit it and open it again; if this keeps happening, reinstall the app.".to_string()
    }
}

pub const RESTART_MESSAGE: &str = "Maintenance Associate's records file was moved or replaced while the app was open (another copy of the app, an update, or a cleanup). Quit Maintenance Associate and open it again.";

/// A plain description of an IO failure for a person.
fn plain(e: &io::Error) -> &'static str {
    match e.kind() {
        io::ErrorKind::PermissionDenied => "this account is not allowed to write there",
        io::ErrorKind::ReadOnlyFilesystem => "the disk is read-only",
        io::ErrorKind::StorageFull => "the disk is full",
        io::ErrorKind::NotFound => "the folder does not exist and could not be made",
        _ => "the folder could not be written",
    }
}

/// The records folder takes a write, or the message says which folder, why and what to do.
pub fn check_writable(dir: &Path) -> Result<(), String> {
    let fail = |e: io::Error| {
        eprintln!("maint: records folder {}: {e}", dir.display());
        format!(
            "{CANNOT_SAVE} {}: {}. Make sure the folder exists, that you can write to it and that the disk has free space, then open the app again.",
            dir.display(),
            plain(&e)
        )
    };
    std::fs::create_dir_all(dir).map_err(fail)?;
    let probe = dir.join(".write-check");
    std::fs::write(&probe, b"ok").map_err(fail)?;
    std::fs::remove_file(&probe).map_err(fail)?;
    Ok(())
}

/// The identity of a file: device and inode on Unix, its creation time and length elsewhere.
#[cfg(unix)]
fn identity(path: &Path) -> io::Result<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    let m = std::fs::metadata(path)?;
    Ok((m.dev(), m.ino()))
}
#[cfg(not(unix))]
fn identity(path: &Path) -> io::Result<(u64, u64)> {
    let m = std::fs::metadata(path)?;
    let created = m
        .created()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    Ok((created, 0))
}

/// The records file as the engine opened it.
pub struct RecordsGuard {
    path: PathBuf,
    opened: Option<(u64, u64)>,
}

impl RecordsGuard {
    /// Taken right after the engine opened (and created) the file.
    pub fn new(path: PathBuf) -> Self {
        let opened = identity(&path).ok();
        Self { path, opened }
    }

    /// Whether the file at the path is still the one the engine has open.
    pub fn intact(&self) -> bool {
        match self.opened {
            Some(id) => identity(&self.path).map(|now| now == id).unwrap_or(false),
            None => true,
        }
    }
}

/// Make every installed pack database read-only (folders stay writable, so a newer version
/// installs beside it and an old one can still be pruned).
pub fn seal_packs(root: &Path) {
    fn walk(dir: &Path) {
        let Ok(entries) = std::fs::read_dir(dir) else {
            return;
        };
        for entry in entries.flatten() {
            let p = entry.path();
            let Ok(meta) = std::fs::symlink_metadata(&p) else {
                continue;
            };
            if meta.is_dir() {
                walk(&p);
            } else if meta.is_file() && p.extension().is_some_and(|x| x == "sqlite") {
                let mut perms = meta.permissions();
                if !perms.readonly() {
                    perms.set_readonly(true);
                    if let Err(e) = std::fs::set_permissions(&p, perms) {
                        eprintln!("maint: could not make {} read-only: {e}", p.display());
                    }
                }
            }
        }
    }
    walk(root);
}
