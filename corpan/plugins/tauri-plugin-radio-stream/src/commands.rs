use crate::{
    models::{PlayArgs, RegisterListenerArgs, RemoveListenerArgs, SetVolumeArgs},
    RadioStreamExt, Result,
};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn play<R: Runtime>(app: AppHandle<R>, args: PlayArgs) -> Result<()> {
    println!(
        "[RADIO_STREAM] play: url={} station={:?}",
        args.url, args.station_name
    );
    app.radio_stream().play(args)
}

#[command]
pub(crate) async fn pause<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[RADIO_STREAM] pause");
    app.radio_stream().pause()
}

#[command]
pub(crate) async fn resume<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[RADIO_STREAM] resume");
    app.radio_stream().resume()
}

#[command]
pub(crate) async fn stop<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    println!("[RADIO_STREAM] stop");
    app.radio_stream().stop()
}

#[command]
pub(crate) async fn set_volume<R: Runtime>(app: AppHandle<R>, args: SetVolumeArgs) -> Result<()> {
    app.radio_stream().set_volume(args)
}

#[command]
pub(crate) async fn register_listener<R: Runtime>(
    app: AppHandle<R>,
    args: RegisterListenerArgs,
) -> Result<()> {
    app.radio_stream().register_listener(args)
}

#[command]
pub(crate) async fn remove_listener<R: Runtime>(
    app: AppHandle<R>,
    args: RemoveListenerArgs,
) -> Result<()> {
    app.radio_stream().remove_listener(args)
}
