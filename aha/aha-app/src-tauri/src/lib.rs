mod documents;
mod f2z;
#[cfg(target_os = "ios")]
mod ios_webview;
mod storage;
use std::sync::{Arc, Mutex};
use tauri::Manager;

struct Database(Arc<Mutex<rusqlite::Connection>>);
#[tauri::command]
async fn local_repository(
    database: tauri::State<'_, Database>,
    request: storage::Request,
) -> Result<serde_json::Value, String> {
    let database = Arc::clone(&database.0);
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = database.lock().map_err(|_| "Local database unavailable")?;
        storage::execute(&mut connection, request)
    })
    .await
    .map_err(|error| error.to_string())?
}
/// The main window is declared in tauri.conf.json (`create: false`) and built here so iOS can drop
/// the keyboard's form toolbar (previous/next/Done): the studio has one field per screen, its own
/// Check button above the keyboard, and the dock closes the keyboard with a tap or a swipe.
fn create_main_window<R: tauri::Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .cloned()
        .ok_or_else(|| std::io::Error::other("tauri.conf.json declares no main window"))?;
    let builder = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)?;
    #[cfg(target_os = "ios")]
    let builder = builder.with_input_accessory_view_builder(|_webview| None);
    builder.build()?;
    Ok(())
}
/// The focus loop holds the page still while the software keyboard is open (iOS; elsewhere the
/// page never scrolls on focus and this does nothing).
#[tauri::command]
fn pin_page_scroll<R: tauri::Runtime>(
    webview: tauri::Webview<R>,
    pinned: bool,
) -> Result<(), String> {
    #[cfg(target_os = "ios")]
    return ios_webview::pin(&webview, pinned).map_err(|error| error.to_string());
    #[cfg(not(target_os = "ios"))]
    {
        let _ = (webview, pinned);
        Ok(())
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_haptics::init());
    #[cfg(target_os = "ios")]
    let builder = builder.plugin(tauri_plugin_ios_share::init());
    f2z::configure(builder)
        .on_page_load(|_webview, payload| {
            // A (re)loaded page starts unpinned; the focus loop pins it again when it mounts.
            #[cfg(target_os = "ios")]
            if payload.event() == tauri::webview::PageLoadEvent::Started
                && let Err(error) = ios_webview::pin(_webview, false)
            {
                eprintln!("AHA could not release the page scroll pin: {error}");
            }
            #[cfg(not(target_os = "ios"))]
            let _ = payload;
        })
        .setup(|app| {
            create_main_window(app)?;
            #[cfg(target_os = "ios")]
            {
                ios_webview::configure(app)?;
                let shares = app.path().app_cache_dir()?.join("backup-shares");
                if shares.exists() {
                    std::fs::remove_dir_all(shares)?;
                }
            }
            let directory = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = storage::open(&directory.join("learning.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(Database(Arc::new(Mutex::new(connection))));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            local_repository,
            pin_page_scroll,
            documents::pick_backup,
            documents::share_backup,
            documents::share_report,
            f2z::app_readiness,
            f2z::open_free2z_account
        ])
        .run(tauri::generate_context!())
        .expect("AHA could not open its native application");
}

#[cfg(test)]
#[path = "../build_support/android_bridge.rs"]
mod build_android_bridge;
