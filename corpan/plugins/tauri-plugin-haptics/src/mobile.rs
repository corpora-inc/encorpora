use crate::models::ImpactArgs;
use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_haptics);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<Haptics<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin("com.corpora.haptics", "HapticsPlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_haptics)?;
    Ok(Haptics(handle))
}

/// Access to the haptics APIs on mobile (Android/iOS).
pub struct Haptics<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Haptics<R> {
    pub fn impact(&self, args: ImpactArgs) -> crate::Result<()> {
        self.0
            .run_mobile_plugin::<()>("impact", Some(args))
            .map_err(|e| {
                println!("[HAPTICS] impact error: {:?}", e);
                e.into()
            })
    }
}
