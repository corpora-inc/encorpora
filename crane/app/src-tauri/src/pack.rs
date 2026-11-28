//! The knowledge pack, opened in-process through harvest-core.
//!
//! The release bundles the signed pack in `resources/pack/` (manifest.json
//! plus its files; release-crane.yml places it). On first launch, and after
//! an update that ships a newer pack, it is installed into the app's data
//! directory with `harvest_core::packs::install_dir`, which checks the
//! manifest signature against the compiled-in keys ([`crate::pack_keys::trusted`])
//! and the SHA-256 of every file. Later launches open it with
//! `Verify::InstallStamp`: the signature always, the files re-hashed only
//! when they changed since the install.
//!
//! `pack_show` hands the frontend everything harvest-core's read API returns,
//! in the `harvest-show/1` shape the browser build reads from
//! `public/pack/crane-us.browser.json` (crane/content/build-pack.sh), so the
//! web engine is the same in both. A build without a bundled pack says so.

use harvest_core::{Pack, TrustedKey, Verify, packs};
use serde_json::json;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

/// Where `bundle.resources` puts the pack, relative to the resource directory.
const BUNDLED: &str = "resources/pack";

/// The compiled-in keys this build accepts a pack from.
pub fn keys() -> Result<Vec<TrustedKey>, String> {
    crate::pack_keys::trusted()
        .into_iter()
        .map(|k| TrustedKey::parse(k).map_err(|e| format!("pack key: {e}")))
        .collect()
}

/// The JSON is built once per launch: the pack does not change while the app runs.
static SHOW: OnceLock<Result<String, String>> = OnceLock::new();

/// Everything the read API returns, as `harvest-show/1` JSON text.
#[tauri::command]
pub async fn pack_show(app: AppHandle) -> Result<String, String> {
    let app2 = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        SHOW.get_or_init(|| open(&app2).and_then(|p| show(&p)))
            .clone()
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Install the bundled pack when it is newer than the installed one, then open it.
fn open(app: &AppHandle) -> Result<Pack, String> {
    let keys = keys()?;
    let root = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("packs");
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    let src = bundled_dir(app, &root)?
        .ok_or("this build carries no knowledge pack (resources/pack/ is empty)")?;
    install_and_open(&root, &src, &keys)
}

/// Install `src` under `root` (a no-op when that version is already current;
/// an older bundled pack never replaces a newer installed one), then open the
/// current version: signature always, files re-hashed when changed.
fn install_and_open(root: &Path, src: &Path, keys: &[TrustedKey]) -> Result<Pack, String> {
    let installed =
        packs::install_dir(root, src, keys).map_err(|e| format!("pack install: {e}"))?;
    let dir = packs::current(root, &installed.pack_id)
        .map_err(|e| e.to_string())?
        .unwrap_or(installed.dir);
    Pack::open_with(&dir, keys, Verify::InstallStamp).map_err(|e| format!("pack open: {e}"))
}

/// The bundled pack's directory, or `None` when this build has none.
#[cfg(not(target_os = "android"))]
fn bundled_dir(app: &AppHandle, _root: &Path) -> Result<Option<PathBuf>, String> {
    let dir = app
        .path()
        .resolve(BUNDLED, tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    Ok(dir.join(packs::MANIFEST).is_file().then_some(dir))
}

/// Android keeps resources inside the APK: the files are copied out of the
/// assets into a staging directory first (once per pack version).
#[cfg(target_os = "android")]
fn bundled_dir(_app: &AppHandle, root: &Path) -> Result<Option<PathBuf>, String> {
    use std::io::Read;
    let Some(mut m) = crate::voice::android_asset::open(&format!("{BUNDLED}/{}", packs::MANIFEST))?
    else {
        return Ok(None);
    };
    let mut text = String::new();
    m.read_to_string(&mut text).map_err(|e| e.to_string())?;
    let manifest: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("bundled manifest: {e}"))?;
    let version = manifest["version"]
        .as_str()
        .ok_or("bundled manifest has no version")?;
    if !packs::valid_version(version) {
        return Err(format!("bundled manifest version {version:?}"));
    }
    let stage = root.join(".bundled").join(version);
    if !stage.join(packs::MANIFEST).is_file() {
        let part = root.join(".bundled").join(format!("{version}.part"));
        let _ = std::fs::remove_dir_all(&part);
        std::fs::create_dir_all(&part).map_err(|e| e.to_string())?;
        for f in manifest["files"]
            .as_array()
            .ok_or("bundled manifest lists no files")?
        {
            let name = f["path"]
                .as_str()
                .ok_or("bundled manifest file without a path")?;
            if name.contains('/') || name.contains("..") {
                return Err(format!("bundled pack file {name:?}"));
            }
            let mut input = crate::voice::android_asset::open(&format!("{BUNDLED}/{name}"))?
                .ok_or_else(|| format!("bundled pack file {name} missing"))?;
            let mut out = std::fs::File::create(part.join(name)).map_err(|e| e.to_string())?;
            std::io::copy(&mut input, &mut out).map_err(|e| e.to_string())?;
        }
        std::fs::write(part.join(packs::MANIFEST), &text).map_err(|e| e.to_string())?;
        let _ = std::fs::remove_dir_all(&stage);
        std::fs::rename(&part, &stage).map_err(|e| e.to_string())?;
    }
    Ok(Some(stage))
}

/// The `harvest-show/1` document: the same lists `harvest show` prints.
pub fn show(pack: &Pack) -> Result<String, String> {
    let e = |e: harvest_core::Error| e.to_string();
    let doc = json!({
        "format": "harvest-show/1",
        "info": pack.info().map_err(e)?,
        "sections": pack.sections().map_err(e)?,
        "topics": pack.topics().map_err(e)?,
        "skills": pack.skills().map_err(e)?,
        "lessons": pack.lessons().map_err(e)?,
        "terms": pack.terms().map_err(e)?,
        "diagrams": pack.diagrams().map_err(e)?,
        "questions": pack.questions().map_err(e)?,
        "procedures": pack.procedures().map_err(e)?,
        "exams": pack.exams().map_err(e)?,
        "prereqs": pack.prereqs().map_err(e)?,
    });
    serde_json::to_string(&doc).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn the_fixture_pack_reads_as_harvest_show() {
        let dir = std::env::temp_dir().join(format!("crane-pack-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let built = harvest_core::fixture::build(&dir, "2026.1.1-1").expect("fixture pack");
        let pack = Pack::open(&built.dir, &[harvest_core::fixture::trusted_key()]).expect("open");
        let doc: Value = serde_json::from_str(&show(&pack).expect("show")).expect("json");
        assert_eq!(doc["format"], "harvest-show/1");
        for list in [
            "sections",
            "topics",
            "skills",
            "lessons",
            "terms",
            "diagrams",
            "questions",
            "procedures",
        ] {
            assert!(doc[list].is_array(), "{list}");
        }
        assert!(doc["sections"].as_array().unwrap().len() >= 5);
        assert!(doc["procedures"][0]["steps"].is_array());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_bundled_pack_installs_once_then_opens_from_the_install() {
        let tmp = std::env::temp_dir().join(format!("crane-pack-install-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        let built =
            harvest_core::fixture::build(&tmp.join("bundle"), "2026.1.1-1").expect("fixture pack");
        let keys = [harvest_core::fixture::trusted_key()];
        let root = tmp.join("packs");
        let first = install_and_open(&root, &built.dir, &keys).expect("first launch");
        assert_eq!(first.version(), "2026.1.1-1");
        // A second launch opens the installed copy; the bundle is not needed again.
        drop(first);
        let again = install_and_open(&root, &built.dir, &keys).expect("second launch");
        assert!(show(&again).is_ok());
        // A tampered installed file is caught: its stamp no longer matches, so it is re-hashed.
        let installed = packs::current(&root, "fixture").unwrap().unwrap();
        drop(again);
        let db = installed.join(harvest_core::fixture::DB_FILE);
        let mut bytes = std::fs::read(&db).unwrap();
        let last = bytes.len() - 1;
        bytes[last] ^= 0xff;
        std::fs::write(&db, bytes).unwrap();
        assert!(Pack::open_with(&installed, &keys, Verify::InstallStamp).is_err());
        let _ = std::fs::remove_dir_all(&tmp);
    }

    #[test]
    fn a_pack_signed_by_an_unknown_key_is_refused() {
        let dir = std::env::temp_dir().join(format!("crane-pack-key-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let built = harvest_core::fixture::build(&dir, "2026.1.1-1").expect("fixture pack");
        // The fixture key is public and test-only: no build of this app trusts it.
        assert!(Pack::open(&built.dir, &keys().unwrap()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
