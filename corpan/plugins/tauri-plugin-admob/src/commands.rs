use crate::{
    models::{AdResult, AdUnitArgs, InitArgs},
    AdmobExt, Result,
};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn init_admob<R: Runtime>(
    app: AppHandle<R>,
    args: InitArgs,
) -> Result<()> {
    app.admob().init_admob(args)
}

#[command]
pub(crate) async fn load_interstitial<R: Runtime>(
    app: AppHandle<R>,
    args: AdUnitArgs,
) -> Result<()> {
    app.admob().load_interstitial(args)
}

#[command]
pub(crate) async fn show_interstitial<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AdResult> {
    app.admob().show_interstitial()
}

#[command]
pub(crate) async fn load_rewarded<R: Runtime>(
    app: AppHandle<R>,
    args: AdUnitArgs,
) -> Result<()> {
    app.admob().load_rewarded(args)
}

#[command]
pub(crate) async fn show_rewarded<R: Runtime>(
    app: AppHandle<R>,
) -> Result<AdResult> {
    app.admob().show_rewarded()
}
