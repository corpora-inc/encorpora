//! Tauri command handlers — the IPC surface a pack JS can invoke.
//!
//! Inference itself runs on the plugin's actor thread (see `state.rs`). These
//! handlers are thin: they validate, hand work to the actor, and (for load/
//! unload) await its completion. `llm_chat` returns a `sessionId` immediately;
//! the actor streams `llm-token:{id}` / `llm-done:{id}` / `llm-error:{id}`.
//!
//! The plugin is Wry-concrete (corpan-app always uses Wry) so the actor thread
//! can store an `AppHandle<Wry>` in its command queue to emit stream events.

use tauri::{command, AppHandle, State, Wry};

use crate::error::Result;
use crate::models::{ChatArgs, LoadArgs, QueryPackDbArgs, StatusResponse, StopArgs};
use crate::state::LlmState;

#[command]
pub async fn llm_status(_app: AppHandle<Wry>, state: State<'_, LlmState>) -> Result<StatusResponse> {
    Ok(state.status())
}

#[command]
pub async fn llm_load(
    app: AppHandle<Wry>,
    state: State<'_, LlmState>,
    args: LoadArgs,
) -> Result<()> {
    state.load_model(app, args).await
}

/// Begin streaming generation. Returns a `sessionId`; the caller subscribes to
/// `llm-token:{sessionId}` / `llm-done:{sessionId}` / `llm-error:{sessionId}`.
#[command]
pub async fn llm_chat(
    app: AppHandle<Wry>,
    state: State<'_, LlmState>,
    args: ChatArgs,
) -> Result<String> {
    let session_id = uuid::Uuid::new_v4().to_string();
    state.start_chat(app, session_id.clone(), args)?;
    Ok(session_id)
}

#[command]
pub async fn llm_stop(
    _app: AppHandle<Wry>,
    state: State<'_, LlmState>,
    args: StopArgs,
) -> Result<()> {
    state.stop(&args.session_id)
}

#[command]
pub async fn llm_unload(_app: AppHandle<Wry>, state: State<'_, LlmState>) -> Result<()> {
    state.unload().await
}

/// Sqlite passthrough placeholder — packs use `HostApi.queryPackDb` instead.
#[command]
pub async fn llm_query_pack_db(
    _app: AppHandle<Wry>,
    state: State<'_, LlmState>,
    args: QueryPackDbArgs,
) -> Result<serde_json::Value> {
    state.query_pack_db(&args).await
}
