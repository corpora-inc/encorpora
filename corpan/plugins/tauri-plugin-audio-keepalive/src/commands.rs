use crate::{
    models::{NowPlayingArgs, StartKeepAliveArgs},
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
