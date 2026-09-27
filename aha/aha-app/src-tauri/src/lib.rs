mod storage;
use std::sync::Mutex;
use tauri::Manager;

struct Database(Mutex<rusqlite::Connection>);
#[tauri::command]
fn local_repository(
    database: tauri::State<'_, Database>,
    request: storage::Request,
) -> Result<serde_json::Value, String> {
    let mut connection = database
        .0
        .lock()
        .map_err(|_| "Local database unavailable")?;
    storage::execute(&mut connection, request)
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            std::fs::create_dir_all(&directory)?;
            let connection = storage::open(&directory.join("learning.sqlite3"))
                .map_err(std::io::Error::other)?;
            app.manage(Database(Mutex::new(connection)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![local_repository])
        .run(tauri::generate_context!())
        .expect("AHA could not open its native application");
}
