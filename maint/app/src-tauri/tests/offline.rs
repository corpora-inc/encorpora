//! The offline claim, tested on the engine path the app runs (no window, no
//! server): `Engine::open_with` as the shell calls it, then a whole job through
//! `engine.call`, the same dispatcher `engine_call` forwards to.
//!
//! - With no hub and no helper configured, this process holds **no internet
//!   socket at any moment** (`lsof -a -p <pid> -i`, polled every 20 ms from
//!   before the engine opens until after the last call, sync included).
//!   `scripts/native-offline.sh` also runs these tests under `sandbox-exec`
//!   with all networking denied.
//! - With the embedding helper configured (and `llama-server` plus the model
//!   present on this machine), the only sockets are the helper's listener on
//!   127.0.0.1 and this process's connections to it.

use maint_lib::{
    config::{Config, EmbedderConfig},
    engine::{Engine, Paths},
    secrets::Store,
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

fn temp(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("maint-offline-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

/// This process's internet sockets, one lsof line each (empty: none).
fn sockets(pid: u32) -> Vec<String> {
    let out = Command::new("lsof")
        .args(["-nP", "-a", "-p", &pid.to_string(), "-i"])
        .output()
        .expect("lsof runs");
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .skip(1)
        .map(str::to_string)
        .collect()
}

/// Watch this process's sockets on a thread until stopped; every line ever seen.
struct Watch {
    stop: Arc<AtomicBool>,
    seen: Arc<Mutex<Vec<String>>>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl Watch {
    fn start() -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let seen = Arc::new(Mutex::new(Vec::new()));
        let (s, v) = (stop.clone(), seen.clone());
        let pid = std::process::id();
        let thread = std::thread::spawn(move || {
            while !s.load(Ordering::Relaxed) {
                v.lock().unwrap().extend(sockets(pid));
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
        });
        Self {
            stop,
            seen,
            thread: Some(thread),
        }
    }
    fn finish(mut self) -> Vec<String> {
        self.stop.store(true, Ordering::Relaxed);
        self.thread.take().unwrap().join().unwrap();
        let mut v = self.seen.lock().unwrap().clone();
        v.extend(sockets(std::process::id()));
        v
    }
}

fn ok(v: Value) -> Value {
    assert_eq!(v["ok"], json!(true), "{v}");
    v["result"].clone()
}

/// A whole job on the fixture pump: search, start, answer, a measured value, close with a lesson, sync.
fn run_job(engine: &Engine) {
    let packs = ok(engine.call("pack.list", json!({})));
    let pack_id = packs[0]["pack_id"].as_str().unwrap().to_string();
    ok(engine.call("asset.create", json!({ "pack_id": pack_id, "asset": { "asset_id": "unit-1", "name": "Pump 1", "equip_id": "pump40-diesel" } })));
    let found = ok(engine.call(
        "symptom.search",
        json!({ "pack_id": pack_id, "asset_id": "unit-1", "text": "engine does not crank" }),
    ));
    let symptom = found["hits"][0]["symptom"]["symptom_id"]
        .as_str()
        .expect("a symptom")
        .to_string();
    let mut view = ok(engine.call("job.start", json!({ "pack_id": pack_id, "asset_id": "unit-1", "symptom_id": symptom, "level": "apprentice" })));
    let job = view["job"]["job_id"].as_str().unwrap().to_string();
    for input in [
        json!({ "outcome": "done" }),
        json!({ "outcome": "yes" }),
        json!({ "value": 10.8, "unit": "V" }),
    ] {
        let node = view["step"]["node"]["node_id"]
            .as_str()
            .unwrap()
            .to_string();
        let mut p = json!({ "job_id": job, "node_id": node });
        p.as_object_mut()
            .unwrap()
            .extend(input.as_object().unwrap().clone());
        view = ok(engine.call("job.answer", p));
    }
    assert_eq!(
        view["step"]["terminal"],
        json!(true),
        "the low-voltage branch ends at the corrective action"
    );
    ok(engine.call("job.close", json!({ "job_id": job, "resolution": "fixed", "lesson": { "job_id": job, "cause": "Battery discharged", "action": "Replaced the battery", "submit": true } })));
    // With no hub, sync says so and sends nothing anywhere.
    let flushed = engine.call("sync.flush", json!({ "force": true }));
    let status = ok(engine.call("sync.status", json!({})));
    assert_eq!(status["hub"]["configured"], json!(false), "{status}");
    assert!(
        status["pending"].as_u64().unwrap() >= 1,
        "the job and lesson wait on the device: {status} / {flushed}"
    );
}

fn fixture_bundle(dir: &Path) -> PathBuf {
    let bundled = dir.join("bundled");
    std::fs::create_dir_all(&bundled).unwrap();
    harvest_core::fixture_maint::build(&bundled.join("pump40"), "2026.1.1-1")
        .expect("fixture pack");
    bundled
}

#[test]
fn no_socket_at_all_without_hub_or_helper() {
    let dir = temp("plain");
    let paths = Paths {
        data: dir.join("data"),
        bundled: Some(fixture_bundle(&dir)),
    };
    let watch = Watch::start();
    let engine = Engine::open_with(
        &paths,
        &Config::default(),
        &Store::Files(dir.join("secrets")),
    )
    .expect("engine opens");
    run_job(&engine);
    drop(engine);
    let seen = watch.finish();
    assert!(
        seen.is_empty(),
        "internet sockets seen with no hub and no helper: {seen:#?}"
    );
}

#[test]
fn with_the_helper_only_loopback() {
    let model = dirs_home().join(".cache/harvest/models/embeddinggemma-2-Q8_0.gguf");
    let server = [
        "/opt/homebrew/bin/llama-server",
        "/usr/local/bin/llama-server",
    ]
    .into_iter()
    .map(PathBuf::from)
    .find(|p| p.is_file());
    let (true, Some(server)) = (model.is_file(), server) else {
        eprintln!("skipped: no llama-server or embedding model on this machine");
        return;
    };
    // The real packs carry the model's vectors; the fixture does not (it proves the sockets only).
    let real = dirs_home().join(".cache/harvest/packs/maint-dev/root");
    let dir = temp("helper");
    let bundled = if real.is_dir() {
        real.clone()
    } else {
        fixture_bundle(&dir)
    };
    let paths = Paths {
        data: dir.join("data"),
        bundled: Some(bundled),
    };
    let config = Config {
        hub: None,
        embedder: Some(EmbedderConfig { model, server }),
    };
    let engine = Engine::open_with(&paths, &config, &Store::Files(dir.join("secrets")))
        .expect("engine opens");
    let url = engine.helper_url().expect("the helper runs");
    let port = url.rsplit(':').next().unwrap().to_string();
    if real.is_dir() {
        let packs = ok(engine.call("pack.list", json!({})));
        for p in packs.as_array().unwrap() {
            assert_eq!(
                p["dense"]["active"],
                json!(true),
                "search by meaning runs through the helper: {p}"
            );
        }
        let found = ok(engine.call("symptom.search", json!({ "pack_id": "pump40v2-proof", "equip_id": "model-40-diesel", "text": "the starter does nothing when I turn the key" })));
        assert!(!found["hits"].as_array().unwrap().is_empty(), "{found}");
    } else {
        run_job(&engine);
    }
    let lines = sockets(std::process::id());
    assert!(!lines.is_empty(), "the engine talked to the helper");
    for line in lines {
        assert!(
            line.contains(&format!("127.0.0.1:{port}")) && !line.contains("(LISTEN)"),
            "this process may only talk to the helper: {line}"
        );
    }
    drop(engine);
    assert!(
        sockets(std::process::id()).is_empty(),
        "the helper's connections close with the engine"
    );
}

fn dirs_home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").expect("HOME"))
}
