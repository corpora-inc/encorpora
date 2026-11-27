//! Export a file the WebView built (a run report bundle) to a place the person
//! chooses. The WebView supplies only a file name and the bytes, never a path.
//!
//! - Desktop and Android: the system save dialog, written through
//!   `tauri-plugin-fs` so Android's `content://` URIs resolve through the
//!   ContentResolver (no broad storage permission).
//! - iOS: the file goes to a private cache folder and the share sheet opens on
//!   it (Save to Files, AirDrop, Mail). The sheet reads lazily, so the file
//!   stays until the next launch clears the folder.

use std::sync::atomic::{AtomicBool, Ordering};

/// Largest bundle accepted: a long run with many photos at 1600 px is well under this.
pub const MAX_BYTES: usize = 256 * 1024 * 1024;
const NAME_HEADER: &str = "x-file-name";
#[cfg_attr(not(target_os = "ios"), allow(dead_code))]
const SHARE_DIR: &str = "exports";

static DIALOG_OPEN: AtomicBool = AtomicBool::new(false);
struct DialogGuard;
impl DialogGuard {
    fn acquire() -> Result<Self, String> {
        DIALOG_OPEN
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self)
            .map_err(|_| "An export is already open".to_string())
    }
}
impl Drop for DialogGuard {
    fn drop(&mut self) {
        DIALOG_OPEN.store(false, Ordering::Release);
    }
}

/// A file name the WebView may ask for: `[A-Za-z0-9._-]`, not starting with a
/// dot or dash, at most 120 bytes, ending in one of the allowed extensions.
pub fn check_name(name: &str) -> Result<(), String> {
    let ok_chars = name
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'.' | b'_' | b'-'));
    let ok_start = !name.starts_with('.') && !name.starts_with('-');
    let ok_ext = name.len() > 4 && name.ends_with(".zip");
    if ok_chars && ok_start && ok_ext && name.len() <= 120 {
        Ok(())
    } else {
        Err(format!("Not an allowed export file name: {name:?}"))
    }
}

fn check_size(len: usize) -> Result<(), String> {
    match len {
        0 => Err("The export is empty".into()),
        n if n > MAX_BYTES => Err("The export is too large".into()),
        _ => Ok(()),
    }
}

/// Save or share the bytes in the request body under the name in the
/// `x-file-name` header. Returns `"saved"` (desktop, Android), `"shared"`
/// (iOS: the share sheet opened) or `"cancelled"` (the dialog was dismissed).
#[tauri::command]
pub async fn export_file(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
) -> Result<&'static str, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("The export must be sent as raw bytes".into());
    };
    let name = request
        .headers()
        .get(NAME_HEADER)
        .and_then(|v| v.to_str().ok())
        .ok_or("The export has no file name")?
        .to_string();
    check_name(&name)?;
    check_size(bytes.len())?;
    let bytes = bytes.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DialogGuard::acquire()?;
        write_out(&app, &name, &bytes)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(not(target_os = "ios"))]
fn write_out(app: &tauri::AppHandle, name: &str, bytes: &[u8]) -> Result<&'static str, String> {
    use std::io::Write;
    use tauri_plugin_dialog::DialogExt;
    use tauri_plugin_fs::{FsExt, OpenOptions};
    let Some(path) = app
        .dialog()
        .file()
        .add_filter("Run report", &["zip"])
        .set_file_name(name)
        .blocking_save_file()
    else {
        return Ok("cancelled");
    };
    let mut file = app
        .fs()
        .open(
            path,
            OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .clone(),
        )
        .map_err(|e| e.to_string())?;
    file.write_all(bytes).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok("saved")
}

#[cfg(target_os = "ios")]
fn write_out(app: &tauri::AppHandle, name: &str, bytes: &[u8]) -> Result<&'static str, String> {
    use tauri::Manager;
    use tauri_plugin_ios_share::IOSShareExt;
    let folder = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join(SHARE_DIR);
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let path = folder.join(name);
    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;
    app.ios_share()
        .share_file(path.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())?;
    Ok("shared")
}

/// Remove files a previous launch handed to the share sheet.
pub fn clear_shared(app: &tauri::AppHandle) {
    #[cfg(target_os = "ios")]
    {
        use tauri::Manager;
        if let Ok(dir) = app.path().app_cache_dir() {
            let dir = dir.join(SHARE_DIR);
            if dir.exists()
                && let Err(e) = std::fs::remove_dir_all(&dir)
            {
                eprintln!("[export] could not clear {}: {e}", dir.display());
            }
        }
    }
    #[cfg(not(target_os = "ios"))]
    let _ = app;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_are_plain_zip_files() {
        assert!(check_name("shift-inspection-2026-11-27-abc123.zip").is_ok());
        for bad in [
            "../x.zip",
            "a/b.zip",
            ".hidden.zip",
            "-rf.zip",
            "run.json",
            ".zip",
            "a b.zip",
            "ü.zip",
            "",
        ] {
            assert!(check_name(bad).is_err(), "{bad:?}");
        }
        assert!(check_name(&format!("{}.zip", "a".repeat(117))).is_err());
        assert!(check_name(&format!("{}.zip", "a".repeat(116))).is_ok());
    }

    #[test]
    fn sizes_are_bounded() {
        assert!(check_size(0).is_err());
        assert!(check_size(1).is_ok());
        assert!(check_size(MAX_BYTES).is_ok());
        assert!(check_size(MAX_BYTES + 1).is_err());
    }

    #[test]
    fn exports_do_not_overlap() {
        let guard = DialogGuard::acquire().unwrap();
        assert!(DialogGuard::acquire().is_err());
        drop(guard);
        assert!(DialogGuard::acquire().is_ok());
    }
}
