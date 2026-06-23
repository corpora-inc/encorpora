use crate::{
    models::{NowPlayingArgs, RegisterListenerArgs, RemoveListenerArgs, StartKeepAliveArgs, TraceEventArgs},
    AudioKeepAliveExt, Result,
};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn start_audio_keepalive<R: Runtime>(
    app: AppHandle<R>,
    args: StartKeepAliveArgs,
) -> Result<()> {
    println!(
        "[AUDIO_KEEPALIVE] start: title={:?}, artist={:?}",
        args.title, args.artist
    );
    app.audio_keepalive().start(args)
}

#[command]
pub(crate) async fn stop_audio_keepalive<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[AUDIO_KEEPALIVE] stop");
    app.audio_keepalive().stop()
}

#[command]
pub(crate) async fn update_now_playing<R: Runtime>(
    app: AppHandle<R>,
    args: NowPlayingArgs,
) -> Result<()> {
    app.audio_keepalive().update_now_playing(args)
}

#[command]
pub(crate) async fn pause_audio_keepalive<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[AUDIO_KEEPALIVE] pause");
    app.audio_keepalive().pause()
}

#[command]
pub(crate) async fn resume_audio_keepalive<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[AUDIO_KEEPALIVE] resume");
    app.audio_keepalive().resume()
}

#[command]
pub(crate) async fn register_listener<R: Runtime>(
    app: AppHandle<R>,
    args: RegisterListenerArgs,
) -> Result<()> {
    app.audio_keepalive().register_listener(args)
}

#[command]
pub(crate) async fn remove_listener<R: Runtime>(
    app: AppHandle<R>,
    args: RemoveListenerArgs,
) -> Result<()> {
    app.audio_keepalive().remove_listener(args)
}

#[command]
pub(crate) async fn trace_event<R: Runtime>(
    app: AppHandle<R>,
    args: TraceEventArgs,
) -> Result<()> {
    app.audio_keepalive().trace_event(args)
}
