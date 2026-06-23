use tauri::{command, AppHandle, Runtime};

use super::{GamePackInfo, GamePacksExt};

#[command]
pub(crate) async fn list_game_packs<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<GamePackInfo>, String> {
    app.game_packs().list_packs().map_err(|e| e.to_string())
}

#[command]
pub(crate) async fn get_game_pack_manifest_url<R: Runtime>(
    app: AppHandle<R>,
    pack_id: String,
) -> Result<String, String> {
    app.game_packs()
        .get_manifest_url(pack_id)
        .map_err(|e| e.to_string())
}
