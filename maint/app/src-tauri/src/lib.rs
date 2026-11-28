//! The maintenance app's native shell.
//!
//! Every screen is the web frontend in `../src`; this shell only hosts it and
//! puts the engine in the same process. No logic lives here:
//!
//! - `engine_call` forwards `{method, params}` to harvest-core's API
//!   dispatcher (`harvest_core::api::call`, the one `harvest serve` uses) and
//!   returns its `{ok, result | error}` envelope unchanged.
//! - `maint-asset://localhost/<pack>/<asset>` serves a pack's figures and page
//!   images from the installed, verified pack.
//! - `voice_model` reports the on-device speech model for the shared voice
//!   hook (none on desktop yet: the microphone stays hidden).
//!
//! Opening the engine (packs, records, keys, optional embedding helper and
//! hub link) is in `engine`; it takes plain paths and settings, so a test can
//! open exactly what the app opens without a window.

pub mod assets;
pub mod config;
pub mod engine;
pub mod helper;
pub mod pack_keys;
pub mod secrets;
pub mod storage;

use std::sync::Arc;
use tauri::Manager;

/// The engine, opened once at startup (or why it could not be).
pub struct EngineState(pub Result<Arc<engine::Engine>, String>);

/// One API call, in process: the same envelope `POST /api/<method>` returns.
#[tauri::command]
async fn engine_call(
    state: tauri::State<'_, EngineState>,
    method: String,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let engine = match &state.0 {
        Ok(e) => e.clone(),
        Err(why) => {
            return Ok(
                serde_json::json!({ "ok": false, "error": { "code": storage::OPEN_FAILED, "message": why } }),
            );
        }
    };
    // MAINT_TRACE=1: one stderr line per call, method and outcome (never params), to check a build.
    let trace = std::env::var_os("MAINT_TRACE").is_some();
    tauri::async_runtime::spawn_blocking(move || {
        let out = engine.call(&method, params);
        if trace {
            eprintln!(
                "maint: {method} ok={} {}",
                out["ok"],
                out["error"]["code"].as_str().unwrap_or("")
            );
        }
        out
    })
    .await
    .map_err(|e| e.to_string())
}

/// What opening the engine found (warnings in plain words), for Records.
#[tauri::command]
fn shell_report(state: tauri::State<'_, EngineState>) -> serde_json::Value {
    match &state.0 {
        Ok(e) => e.report(),
        Err(why) => serde_json::json!({ "warnings": [why], "device_id": null }),
    }
}

/// The bundled speech model. Desktop builds carry none and tauri-plugin-stt
/// has no desktop speech yet, so the answer is `missing` and the app shows no microphone.
#[tauri::command]
fn voice_model() -> serde_json::Value {
    serde_json::json!({ "status": "missing", "file": "" })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // One copy at a time on a desktop: a second launch focuses the first and exits, so two
    // engines never share (or move) the same records.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        if let Some(w) = app.webview_windows().values().next() {
            let _ = w.unminimize();
            let _ = w.show();
            let _ = w.set_focus();
        }
    }));
    builder
        .plugin(tauri_plugin_tts::init())
        .plugin(tauri_plugin_stt::init())
        .register_uri_scheme_protocol(assets::SCHEME, |ctx, request| {
            let state = ctx.app_handle().state::<EngineState>();
            match &state.0 {
                Ok(engine) => assets::respond(engine, &request),
                Err(_) => assets::not_found(),
            }
        })
        .setup(|app| {
            let paths = engine::Paths::for_app(app.handle()).map_err(|e| e.to_string())?;
            // What the person sees is plain words with what to do; the detail goes to the log.
            let opened = engine::Engine::open(&paths).map(Arc::new).map_err(|e| {
                eprintln!("maint: the engine did not open: {e}");
                storage::opening_message(&e)
            });
            app.manage(EngineState(opened));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine_call,
            shell_report,
            voice_model
        ])
        .build(tauri::generate_context!())
        .expect("error while building the maintenance app")
        .run(|app, event| {
            // The managed embedding helper is a child process: stop it with the app.
            if let tauri::RunEvent::Exit = event
                && let Some(EngineState(Ok(engine))) = app.try_state::<EngineState>().as_deref()
            {
                engine.shutdown();
            }
        });
}
