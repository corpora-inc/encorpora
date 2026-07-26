//! Dynawalla's native shell.
//!
//! Deliberately empty of plugins. The V1 native surface is haptics and TTS
//! (ARCHITECTURE L8, ADR-0004) and neither is needed to render a screen, so
//! nothing is registered here yet — every plugin added later also has to be
//! granted a per-command permission in `capabilities/default.json`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running dynawalla");
}
