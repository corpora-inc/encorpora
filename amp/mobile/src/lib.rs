/// Native host for the AMP web interface. No purchase or authentication bridge is installed.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Unable to start AMP native preview");
}
