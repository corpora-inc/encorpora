use crate::{models::ImpactArgs, HapticsExt, Result};
use tauri::{command, AppHandle, Runtime};

#[command]
pub(crate) async fn impact<R: Runtime>(app: AppHandle<R>, args: ImpactArgs) -> Result<()> {
    app.haptics().impact(args)
}
