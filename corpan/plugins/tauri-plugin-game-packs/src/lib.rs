use std::fs;
use std::path::{Path, PathBuf};

use tauri::{
    http::{header, Response, StatusCode},
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;
mod models;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

pub use error::{Error, Result};
pub use models::GamePackInfo;

#[cfg(desktop)]
use desktop::GamePacks;
#[cfg(mobile)]
use mobile::GamePacks;

/// Extensions to access game pack APIs.
pub trait GamePacksExt<R: Runtime> {
    fn game_packs(&self) -> &GamePacks<R>;
}

impl<R: Runtime, T: Manager<R>> GamePacksExt<R> for T {
    fn game_packs(&self) -> &GamePacks<R> {
        self.state::<GamePacks<R>>().inner()
    }
}

/// Initializes the plugin.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("game_packs")
        .invoke_handler(tauri::generate_handler![
            commands::list_game_packs,
            commands::get_game_pack_manifest_url
        ])
        .register_uri_scheme_protocol("corpan-pack", |ctx, request| {
            let pack_root = match app_pack_root(ctx.app_handle()) {
                Ok(root) => root,
                Err(msg) => {
                    return Response::builder()
                        .status(StatusCode::INTERNAL_SERVER_ERROR)
                        .header(header::CONTENT_TYPE, "text/plain")
                        .body(msg.to_string().into_bytes())
                        .unwrap();
                }
            };

            let path = request.uri().path();
            let trimmed = path.trim_start_matches('/');
            let mut parts = trimmed.splitn(2, '/');
            let pack_id = match parts.next() {
                Some(id) if !id.is_empty() => id,
                _ => {
                    return Response::builder()
                        .status(StatusCode::BAD_REQUEST)
                        .header(header::CONTENT_TYPE, "text/plain")
                        .body(b"Missing pack id".to_vec())
                        .unwrap();
                }
            };
            let rel_path = parts.next().unwrap_or("");
            let pack_dir = pack_root.join(pack_id);
            let file_path = match safe_join(&pack_dir, rel_path) {
                Some(path) => path,
                None => {
                    return Response::builder()
                        .status(StatusCode::FORBIDDEN)
                        .header(header::CONTENT_TYPE, "text/plain")
                        .body(b"Invalid path".to_vec())
                        .unwrap();
                }
            };

            match fs::read(&file_path) {
                Ok(data) => {
                    let content_type = content_type_for_path(&file_path);
                    Response::builder()
                        .status(StatusCode::OK)
                        .header(header::CONTENT_TYPE, content_type)
                        .body(data)
                        .unwrap()
                }
                Err(_) => Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(header::CONTENT_TYPE, "text/plain")
                    .body(b"Not found".to_vec())
                    .unwrap(),
            }
        })
        .setup(|app, api| {
            #[cfg(mobile)]
            {
                let packs = mobile::init(app, api)?;
                app.manage(packs);
            }

            #[cfg(desktop)]
            {
                let packs = desktop::GamePacks::init(app)?;
                app.manage(packs);
            }

            Ok(())
        })
        .build()
}

fn app_pack_root<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("corpan-packs"))
        .map_err(|e| e.to_string().into())
}

fn safe_join(root: &Path, rel_path: &str) -> Option<PathBuf> {
    if rel_path.contains("..") || rel_path.is_empty() {
        return None;
    }
    let rel = rel_path.trim_start_matches('/');
    Some(root.join(rel))
}

fn content_type_for_path(path: &Path) -> &'static str {
    match path.extension().and_then(|ext| ext.to_str()).unwrap_or("") {
        "js" => "text/javascript",
        "mjs" => "text/javascript",
        "css" => "text/css",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "wasm" => "application/wasm",
        "glb" => "model/gltf-binary",
        "gltf" => "model/gltf+json",
        _ => "application/octet-stream",
    }
}
