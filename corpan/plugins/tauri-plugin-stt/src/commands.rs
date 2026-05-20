use crate::{
    models::{
        CancelSessionArgs, PrepareArgs, PrepareResult, StartSessionArgs, StartSessionResult,
        StatusResult, StopSessionArgs, TranscriptionResult,
    },
    Result, SttExt,
};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn prepare<R: Runtime>(
    app: AppHandle<R>,
    args: PrepareArgs,
) -> Result<PrepareResult> {
    println!("[NATIVE_STT:DEBUG] prepare invoked: model={:?}", args.model);
    app.stt().prepare(args.model)
}

#[command]
pub(crate) async fn start_session<R: Runtime>(
    app: AppHandle<R>,
    args: StartSessionArgs,
) -> Result<StartSessionResult> {
    println!(
        "[NATIVE_STT:DEBUG] start_session invoked: session_id={}, language={}, expected='{}', params={}, scoring={}",
        args.session_id,
        args.language,
        args.expected_text.chars().take(60).collect::<String>(),
        if args.whisper_params.is_some() { "yes" } else { "(none)" },
        if args.scoring_params.is_some() { "yes" } else { "(none)" }
    );
    app.stt().start_session(
        args.session_id,
        args.language,
        args.expected_text,
        args.whisper_params,
        args.scoring_params,
    )
}

#[command]
pub(crate) async fn stop_session<R: Runtime>(
    app: AppHandle<R>,
    args: StopSessionArgs,
) -> Result<TranscriptionResult> {
    println!(
        "[NATIVE_STT:DEBUG] stop_session invoked: session_id={}",
        args.session_id
    );
    app.stt().stop_session(args.session_id)
}

#[command]
pub(crate) async fn cancel_session<R: Runtime>(
    app: AppHandle<R>,
    args: CancelSessionArgs,
) -> Result<()> {
    println!(
        "[NATIVE_STT:DEBUG] cancel_session invoked: session_id={}",
        args.session_id
    );
    app.stt().cancel_session(args.session_id)
}

#[command]
pub(crate) async fn is_available<R: Runtime>(app: AppHandle<R>) -> Result<bool> {
    app.stt().is_available()
}

#[command]
pub(crate) async fn get_status<R: Runtime>(app: AppHandle<R>) -> Result<StatusResult> {
    app.stt().get_status()
}
