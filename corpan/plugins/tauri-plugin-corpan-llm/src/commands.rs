//! Tauri command handlers. These are the IPC surface a pack JS can invoke.
//!
//! On desktop (Linux/macOS), the actual inference runs through `llama-cpp-2`
//! via the `runtime` module. On iOS/Android, the same commands are dispatched
//! to the native Swift/Kotlin bridge through Tauri's plugin mobile pattern.
//!
//! The polish-machine work is to fill in the mobile bridges; this scaffold has
//! the Rust signatures + desktop implementation + clear stubs marked TODO.

use tauri::{command, AppHandle, Emitter, Runtime, State};

use crate::error::{Error, Result};
use crate::models::{
    ChatArgs, DoneEvent, ErrorEvent, LoadArgs, QueryPackDbArgs, StatusResponse, StopArgs,
    TokenEvent,
};
use crate::state::LlmState;

#[command]
pub async fn llm_status<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, LlmState>,
) -> Result<StatusResponse> {
    Ok(state.status())
}

#[command]
pub async fn llm_load<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LlmState>,
    args: LoadArgs,
) -> Result<()> {
    state.load_model(app, args).await
}

/// Begin streaming generation. Returns a `sessionId`; the caller subscribes to
/// `llm-token:{sessionId}` / `llm-done:{sessionId}` / `llm-error:{sessionId}`
/// events to consume the stream.
#[command]
pub async fn llm_chat<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, LlmState>,
    args: ChatArgs,
) -> Result<String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    let app_clone = app.clone();
    let session_for_task = session_id.clone();
    let state_handle = state.handle();

    // Spawn the generation off the IPC thread; it streams tokens via events.
    tauri::async_runtime::spawn(async move {
        let result = state_handle
            .stream_chat(args, &session_for_task, |tok| {
                let _ = app_clone.emit(
                    &format!("llm-token:{session_for_task}"),
                    TokenEvent {
                        session_id: session_for_task.clone(),
                        token: tok,
                    },
                );
            })
            .await;

        match result {
            Ok(stats) => {
                let _ = app_clone.emit(
                    &format!("llm-done:{session_for_task}"),
                    DoneEvent {
                        session_id: session_for_task.clone(),
                        total_tokens: stats.total_tokens,
                        elapsed_ms: stats.elapsed_ms,
                    },
                );
            }
            Err(e) => {
                let (code, msg) = match &e {
                    Error::ModelNotLoaded => ("MODEL_NOT_LOADED", e.to_string()),
                    Error::InsufficientMemory => ("INSUFFICIENT_MEMORY", e.to_string()),
                    Error::LlamaCpp(_) => ("LLAMA_CPP_ERROR", e.to_string()),
                    _ => ("INTERNAL_ERROR", e.to_string()),
                };
                let _ = app_clone.emit(
                    &format!("llm-error:{session_for_task}"),
                    ErrorEvent {
                        session_id: session_for_task.clone(),
                        code: code.to_string(),
                        error: msg,
                    },
                );
            }
        }
    });

    Ok(session_id)
}

#[command]
pub async fn llm_stop<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, LlmState>,
    args: StopArgs,
) -> Result<()> {
    state.stop(&args.session_id)
}

#[command]
pub async fn llm_unload<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, LlmState>,
) -> Result<()> {
    state.unload()
}

/// Sqlite passthrough for packs to query their bundled RAG DBs.
/// Mirrors `HostApi.queryPackDb` shape so packs can use either path.
#[command]
pub async fn llm_query_pack_db<R: Runtime>(
    _app: AppHandle<R>,
    state: State<'_, LlmState>,
    args: QueryPackDbArgs,
) -> Result<serde_json::Value> {
    state.query_pack_db(&args).await
}
