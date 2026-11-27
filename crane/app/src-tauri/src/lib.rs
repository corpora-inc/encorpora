//! The crane app's native shell.
//!
//! It registers the three shared plugins and nothing else. Every screen is the
//! web frontend in `../src`; it works in a plain browser too, and with each
//! plugin absent or unavailable it hides the control rather than offering one
//! that cannot work:
//!
//! - `tts` (read-aloud) — platform speech, no download.
//! - `stt` (voice questions) — whisper.cpp on device. The frontend offers the
//!   microphone only when `validate_model` says the model is installed and
//!   valid (`is_available` alone is true on iOS with no model).
//! - `corpan-llm` (on-device assistant) — llama.cpp; optional, off unless a
//!   model is installed. Answers come from the verified pack either way.
//!
//! Registering a plugin is half the wiring. The other half is a single-command
//! grant in `capabilities/default.json`; without it the ACL denies the invoke
//! at runtime and nothing at build time says so. `src/lib/native.test.ts`
//! asserts that every command the frontend invokes is granted there and
//! exists in the plugin.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_stt::init())
        .plugin(tauri_plugin_corpan_llm::init())
        .run(tauri::generate_context!())
        .expect("error while running the crane app");
}
