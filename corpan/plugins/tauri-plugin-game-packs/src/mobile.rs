use serde::{de::DeserializeOwned, Deserialize};
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

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ListPacksResponse {
    Packs(Vec<GamePackInfo>),
    Wrapped { packs: Vec<GamePackInfo> },
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ManifestUrlResponse {
    Url(String),
    Wrapped { url: String },
}

impl<R: Runtime> GamePacks<R> {
    pub fn list_packs(&self) -> Result<Vec<GamePackInfo>> {
        let response = self
            .0
            .run_mobile_plugin::<ListPacksResponse>("listPacks", Some(()))?;
        Ok(match response {
            ListPacksResponse::Packs(packs) => packs,
            ListPacksResponse::Wrapped { packs } => packs,
        })
    }

    pub fn get_manifest_url(&self, pack_id: String) -> Result<String> {
        let payload = serde_json::json!({ "packId": pack_id });
        let response = self
            .0
            .run_mobile_plugin::<ManifestUrlResponse>("getManifestUrl", Some(payload))?;
        Ok(match response {
            ManifestUrlResponse::Url(url) => url,
            ManifestUrlResponse::Wrapped { url } => url,
        })
    }
}
