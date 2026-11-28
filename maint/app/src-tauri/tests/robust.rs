//! What happens around a running app, tested on the path the app runs
//! (`Engine::open_with` and `engine.call`, no window):
//!
//! - the records file moved or replaced while the engine is open (another copy,
//!   an update, a cleanup): every call answers `restart_needed` in plain words,
//!   never a database error;
//! - a records folder that cannot be written: opening says which folder, why and
//!   what to do;
//! - installed pack databases are read-only and no call, read or write, changes a byte of them.

use maint_lib::{
    config::Config,
    engine::{Engine, Paths},
    secrets::Store,
    storage,
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

fn temp(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("maint-robust-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn bundle(dir: &Path) -> PathBuf {
    let bundled = dir.join("bundled");
    std::fs::create_dir_all(&bundled).unwrap();
    harvest_core::fixture_maint::build(&bundled.join("pump40"), "2026.1.1-1")
        .expect("fixture pack");
    bundled
}

fn open(dir: &Path) -> Engine {
    let paths = Paths {
        data: dir.join("data"),
        bundled: Some(bundle(dir)),
        file_secrets: true,
    };
    Engine::open_with(
        &paths,
        &Config::default(),
        &Store::Files(dir.join("secrets")),
    )
    .expect("engine opens")
}

fn ok(v: Value) -> Value {
    assert_eq!(v["ok"], json!(true), "{v}");
    v["result"].clone()
}

fn pack_id(engine: &Engine) -> String {
    ok(engine.call("pack.list", json!({})))[0]["pack_id"]
        .as_str()
        .unwrap()
        .to_string()
}

#[test]
fn records_moved_under_a_running_engine_asks_for_a_restart() {
    let dir = temp("moved");
    let engine = open(&dir);
    let pack = pack_id(&engine);
    ok(engine.call("asset.create", json!({ "pack_id": pack, "asset": { "asset_id": "unit-1", "name": "Pump 1", "equip_id": "pump40-diesel" } })));
    // A cleanup moves the records file away while the app is open.
    let records = dir.join("data").join("records.db");
    std::fs::rename(&records, dir.join("moved.db")).unwrap();
    for (method, params) in [
        (
            "symptom.search",
            json!({ "pack_id": pack, "asset_id": "unit-1", "text": "engine does not crank" }),
        ),
        (
            "job.start",
            json!({ "pack_id": pack, "asset_id": "unit-1", "symptom_id": "s-nocrank", "level": "apprentice" }),
        ),
    ] {
        let v = engine.call(method, params);
        assert_eq!(v["error"]["code"], json!(storage::RESTART), "{method}: {v}");
        let msg = v["error"]["message"].as_str().unwrap();
        assert!(
            !msg.to_lowercase().contains("sqlite") && !msg.contains("database"),
            "{msg}"
        );
        assert!(
            msg.contains("Quit") && msg.contains("open it again"),
            "{msg}"
        );
    }
    // Replaced by a new file of the same name (another copy of the app made one): the same.
    std::fs::write(&records, b"").unwrap();
    assert_eq!(
        engine.call("asset.list", json!({}))["error"]["code"],
        json!(storage::RESTART)
    );
}

#[cfg(unix)]
#[test]
fn a_records_folder_that_cannot_be_written_is_named_with_what_to_do() {
    use std::os::unix::fs::PermissionsExt;
    let dir = temp("readonly");
    let data = dir.join("data");
    std::fs::create_dir_all(&data).unwrap();
    std::fs::set_permissions(&data, std::fs::Permissions::from_mode(0o500)).unwrap();
    let paths = Paths {
        data: data.clone(),
        bundled: Some(bundle(&dir)),
        file_secrets: true,
    };
    let err = Engine::open_with(
        &paths,
        &Config::default(),
        &Store::Files(dir.join("secrets")),
    )
    .err()
    .expect("refused");
    std::fs::set_permissions(&data, std::fs::Permissions::from_mode(0o700)).unwrap();
    assert!(
        err.starts_with("Maintenance Associate cannot save its records in"),
        "{err}"
    );
    assert!(
        err.contains(&data.display().to_string()) && err.contains("then open the app again"),
        "{err}"
    );
    assert_eq!(
        storage::opening_message(&err),
        err,
        "the folder's message reaches the person as is"
    );
    assert!(!storage::opening_message("sqlite: disk I/O error").contains("sqlite"));
}

#[test]
fn pack_databases_are_read_only_and_never_written() {
    let dir = temp("sealed");
    let engine = open(&dir);
    let root = dir.join("data").join("packs");
    let dbs = sqlite_files(&root);
    assert!(!dbs.is_empty(), "the fixture pack is installed");
    let before: Vec<Vec<u8>> = dbs.iter().map(|p| std::fs::read(p).unwrap()).collect();
    for p in &dbs {
        assert!(
            std::fs::metadata(p).unwrap().permissions().readonly(),
            "{} is writable",
            p.display()
        );
    }
    let pack = pack_id(&engine);
    ok(engine.call("asset.create", json!({ "pack_id": pack, "asset": { "asset_id": "unit-1", "name": "Pump 1", "equip_id": "pump40-diesel" } })));
    for (method, params) in [
        (
            "symptom.search",
            json!({ "pack_id": pack, "asset_id": "unit-1", "text": "engine does not crank" }),
        ),
        (
            "manual.search",
            json!({ "pack_id": pack, "query": "battery voltage" }),
        ),
        ("table.list", json!({ "pack_id": pack })),
        ("tree.list", json!({ "pack_id": pack })),
        ("task.list", json!({ "pack_id": pack })),
        (
            "job.start",
            json!({ "pack_id": pack, "asset_id": "unit-1", "symptom_id": "s-nocrank", "level": "apprentice" }),
        ),
        (
            "asset.set_attrs",
            json!({ "pack_id": pack, "asset_id": "unit-1", "values": { "firmware": "2.6" } }),
        ),
    ] {
        ok(engine.call(method, params));
    }
    drop(engine);
    let after: Vec<Vec<u8>> = dbs.iter().map(|p| std::fs::read(p).unwrap()).collect();
    assert!(before == after, "a pack database changed");
}

fn sqlite_files(dir: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for e in std::fs::read_dir(dir).unwrap().flatten() {
        let p = e.path();
        if p.is_dir() {
            out.extend(sqlite_files(&p));
        } else if p.extension().is_some_and(|x| x == "sqlite") {
            out.push(p);
        }
    }
    out
}
