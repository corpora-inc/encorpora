//! Native document access. The WebView supplies only an account id, never a path.
use crate::{Database, storage};
#[cfg(not(target_os = "ios"))]
use std::io::Write;
use std::{
    io::Read,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_fs::{FsExt, OpenOptions};

/// Upper bound for a WebView-built problem report (matches the WebView's limit).
pub const MAX_REPORT: usize = 64 * 1024;

struct ExportKind {
    // The iOS share sheet has no file-type filter.
    #[cfg_attr(target_os = "ios", allow(dead_code))]
    filter: &'static str,
    extension: &'static str,
    stem: &'static str,
}
const BACKUP: ExportKind = ExportKind {
    filter: "AHA learning backup",
    extension: "json",
    stem: "aha-learning-backup",
};
const REPORT: ExportKind = ExportKind {
    filter: "AHA problem report",
    extension: "txt",
    stem: "aha-problem-report",
};

static DOCUMENT_OPEN: AtomicBool = AtomicBool::new(false);
struct DocumentGuard;
impl DocumentGuard {
    fn acquire() -> Result<Self, String> {
        DOCUMENT_OPEN
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map(|_| Self)
            .map_err(|_| "A document dialog is already open".into())
    }
}
impl Drop for DocumentGuard {
    fn drop(&mut self) {
        DOCUMENT_OPEN.store(false, Ordering::Release);
    }
}

#[tauri::command]
pub async fn pick_backup(
    app: tauri::AppHandle,
    account_id: String,
) -> Result<Option<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DocumentGuard::acquire()?;
        let Some(path) = app
            .dialog()
            .file()
            .add_filter("AHA learning backup", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };
        let file = app
            .fs()
            .open(path, OpenOptions::new().read(true).clone())
            .map_err(|e| e.to_string())?;
        let mut text = String::new();
        file.take((storage::MAX_BACKUP + 1) as u64)
            .read_to_string(&mut text)
            .map_err(|e| e.to_string())?;
        storage::preview(&account_id, &text).map(Some)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn share_backup(
    app: tauri::AppHandle,
    database: tauri::State<'_, Database>,
    account_id: String,
) -> Result<bool, String> {
    let database = Arc::clone(&database.0);
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DocumentGuard::acquire()?;
        let text = {
            let mut conn = database.lock().map_err(|_| "Local database unavailable")?;
            storage::export(&mut conn, &account_id)?
        };
        export_document(&app, &text, &BACKUP)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Share a plain-text problem report the WebView built. Only text crosses the
/// bridge; the destination is always chosen by the person in a system dialog.
#[tauri::command]
pub async fn share_report(app: tauri::AppHandle, report: String) -> Result<bool, String> {
    check_report(&report)?;
    tauri::async_runtime::spawn_blocking(move || {
        let _guard = DocumentGuard::acquire()?;
        export_document(&app, &report, &REPORT)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn check_report(report: &str) -> Result<(), String> {
    if report.len() > MAX_REPORT {
        return Err("The report is too large to share.".into());
    }
    Ok(())
}

#[cfg(not(target_os = "ios"))]
fn export_document(app: &tauri::AppHandle, text: &str, kind: &ExportKind) -> Result<bool, String> {
    let Some(path) = app
        .dialog()
        .file()
        .add_filter(kind.filter, &[kind.extension])
        .set_file_name(format!("{}.{}", kind.stem, kind.extension))
        .blocking_save_file()
    else {
        return Ok(false);
    };
    // FsExt resolves Android content:// URIs through ContentResolver. Never
    // convert them to filesystem paths or request broad storage permissions.
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
    file.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    file.flush().map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(target_os = "ios")]
fn export_document(app: &tauri::AppHandle, text: &str, kind: &ExportKind) -> Result<bool, String> {
    use tauri::Manager;
    use tauri_plugin_ios_share::IOSShareExt;
    let folder = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .join("backup-shares");
    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    // Reports share this folder so the launch-time cleanup removes them too.
    let path = folder.join(format!("{}-{stamp}.{}", kind.stem, kind.extension));
    std::fs::write(&path, text).map_err(|e| e.to_string())?;
    // The sheet reads lazily, so retain this temporary file until next launch.
    // true means the sheet was presented, not that a user completed export.
    app.ios_share()
        .share_file(path.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn document_dialogs_do_not_overlap() {
        let guard = DocumentGuard::acquire().unwrap();
        assert!(DocumentGuard::acquire().is_err());
        drop(guard);
        assert!(DocumentGuard::acquire().is_ok());
    }
    #[test]
    fn reports_are_bounded_text_files() {
        assert!(check_report(&"x".repeat(MAX_REPORT)).is_ok());
        assert!(check_report(&"x".repeat(MAX_REPORT + 1)).is_err());
        assert_eq!(REPORT.extension, "txt");
        assert_ne!(REPORT.stem, BACKUP.stem);
    }
}
