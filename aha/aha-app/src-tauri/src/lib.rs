mod documents;
mod f2z;
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
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init());
    #[cfg(target_os = "ios")]
    let builder = builder.plugin(tauri_plugin_ios_share::init());
    f2z::configure(builder)
        .setup(|app| {
            #[cfg(target_os = "ios")]
            {
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
            documents::pick_backup,
            documents::share_backup,
            f2z::app_readiness,
            f2z::open_free2z_account
        ])
        .run(tauri::generate_context!())
        .expect("AHA could not open its native application");
}
