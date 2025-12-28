use std::fs;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime};

use super::{Error, GamePackInfo, Result};

#[derive(Debug, Deserialize)]
struct ManifestMeta {
    id: String,
    name: Option<String>,
    version: Option<String>,
}

pub struct GamePacks<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> GamePacks<R> {
    pub fn init(app: &AppHandle<R>) -> Result<Self> {
        Ok(Self { app: app.clone() })
    }

    pub fn list_packs(&self) -> Result<Vec<GamePackInfo>> {
        let root = pack_root(&self.app)?;
        if !root.exists() {
            return Ok(vec![]);
        }

        let mut packs = vec![];
        for entry in fs::read_dir(root)? {
            let entry = entry?;
            if !entry.file_type()?.is_dir() {
                continue;
            }
            let pack_dir = entry.path();
            let manifest_path = pack_dir.join("manifest.json");
            if !manifest_path.exists() {
                continue;
            }
            let contents = fs::read_to_string(&manifest_path)?;
            let manifest: ManifestMeta = serde_json::from_str(&contents)?;
            packs.push(GamePackInfo {
                id: manifest.id.clone(),
                name: manifest.name.unwrap_or(manifest.id),
                version: manifest.version,
            });
        }

        packs.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(packs)
    }

    pub fn get_manifest_url(&self, pack_id: String) -> Result<String> {
        let root = pack_root(&self.app)?;
        let manifest_path = root.join(&pack_id).join("manifest.json");
        if !manifest_path.exists() {
            return Err(Error(format!("Pack not installed: {}", pack_id)));
        }
        Ok(build_manifest_url(&pack_id))
    }
}

pub fn pack_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| Error(e.to_string()))?;
    Ok(base.join("corpan-packs"))
}

pub fn build_manifest_url(pack_id: &str) -> String {
    #[cfg(any(target_os = "android", target_os = "windows"))]
    {
        format!("http://corpan-pack.localhost/{}/manifest.json", pack_id)
    }
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    {
        format!("corpan-pack://localhost/{}/manifest.json", pack_id)
    }
}

pub fn safe_join(root: &Path, rel_path: &str) -> Option<PathBuf> {
    if rel_path.contains("..") || rel_path.is_empty() {
        return None;
    }
    let rel = rel_path.trim_start_matches('/');
    Some(root.join(rel))
}
