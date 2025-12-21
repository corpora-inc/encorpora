use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use super::{GamePackInfo, Result};

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_game_packs);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<GamePacks<R>> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(
        "com.corpora.tauri.gamepacks",
        "GamePacksPlugin",
    )?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_game_packs)?;
    Ok(GamePacks(handle))
}

pub struct GamePacks<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> GamePacks<R> {
    pub fn list_packs(&self) -> Result<Vec<GamePackInfo>> {
        let packs = self
            .0
            .run_mobile_plugin::<Vec<GamePackInfo>>("listPacks", Some(()))?;
        Ok(packs)
    }

    pub fn get_manifest_url(&self, pack_id: String) -> Result<String> {
        let payload = serde_json::json!({ "packId": pack_id });
        let url = self
            .0
            .run_mobile_plugin::<String>("getManifestUrl", Some(payload))?;
        Ok(url)
    }
}
