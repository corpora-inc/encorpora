use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use super::Result;

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_subscriptions);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<Subscriptions<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(
        "com.corpora.tauri.subscriptions",
        "SubscriptionsPlugin",
    )?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_subscriptions)?;
    Ok(Subscriptions(handle))
}

pub struct Subscriptions<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Subscriptions<R> {
    /// Open the platform's native subscription-management sheet.
    /// iOS: `StoreKit.AppStore.showManageSubscriptions(in:)` — renders inline
    /// over the app with cancel / pricing change / billing controls.
    /// Android: deep-links to the Play Store subscriptions page for this app.
    pub fn show_manage_subscriptions(&self) -> Result<()> {
        self.0
            .run_mobile_plugin::<serde_json::Value>("showManageSubscriptions", Some(()))?;
        Ok(())
    }
}
