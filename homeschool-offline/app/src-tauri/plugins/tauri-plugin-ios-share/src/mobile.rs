use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ios_share);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<IOSShare<R>, Box<dyn std::error::Error>> {
    let handle = api.register_ios_plugin(init_plugin_ios_share)?;
    Ok(IOSShare(handle))
}

/// Access to the iOS Share APIs.
pub struct IOSShare<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> IOSShare<R> {
    pub fn share_file(&self, file_path: String) -> Result<(), Box<dyn std::error::Error>> {
        self.0
            .run_mobile_plugin::<()>("shareFile", file_path)
            .map_err(|e| e.into())
    }
}
