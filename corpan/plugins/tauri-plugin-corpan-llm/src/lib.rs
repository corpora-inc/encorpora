//! tauri-plugin-corpan-llm
//!
//! On-device LLM runtime for Corpán. Vendored llama.cpp with platform-native
//! GPU backends (Metal on iOS, Vulkan on Android, CPU fallback). Streaming
//! inference. Designed to be consumed by ANY pack — the Spanish tutor is the
//! first consumer, more language tutors and future packs will tap in.
//!
//! Public IPC surface:
//!   - `plugin:corpan-llm|llm_status` → StatusResponse
//!   - `plugin:corpan-llm|llm_load` → ()
//!   - `plugin:corpan-llm|llm_chat` → sessionId (streams events)
//!   - `plugin:corpan-llm|llm_stop` → ()
//!   - `plugin:corpan-llm|llm_unload` → ()
//!   - `plugin:corpan-llm|llm_query_pack_db` → rows
//!
//! Events emitted while a chat is streaming:
//!   - `llm-token:{sessionId}` → { token: string }
//!   - `llm-done:{sessionId}`  → { totalTokens, elapsedMs }
//!   - `llm-error:{sessionId}` → { code, error }

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
pub mod error;
pub mod models;
mod state;

use state::LlmState;

/// Init the plugin. Add this to `tauri::Builder` in `src-tauri/src/lib.rs`:
///
/// ```ignore
/// .plugin(tauri_plugin_corpan_llm::init())
/// ```
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("corpan-llm")
        .invoke_handler(tauri::generate_handler![
            commands::llm_status,
            commands::llm_load,
            commands::llm_chat,
            commands::llm_stop,
            commands::llm_unload,
            commands::llm_query_pack_db,
        ])
        .setup(|app, _api| {
            app.manage(LlmState::new());
            Ok(())
        })
        .build()
}

/// Re-export for callers that want typed access.
pub use error::{Error, Result};
pub use models::*;
