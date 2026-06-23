use tauri::{command, AppHandle, Runtime};

use super::SubscriptionsExt;

#[command]
pub(crate) async fn show_manage_subscriptions<R: Runtime>(
    app: AppHandle<R>,
) -> Result<(), String> {
    app.subscriptions()
        .show_manage_subscriptions()
        .map_err(|e| e.to_string())
}
