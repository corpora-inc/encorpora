//! End to end against a simulated boat: ArduPilot Rover software-in-the-loop
//! (`motorboat` frame), a separate process built from the ArduPilot source.
//! Skips unless the simulator binary and the pre-arm pack are present:
//!
//! - `HARVEST_SITL_BIN` (default `~/.cache/harvest/raw/ardupilot-src/build/sitl/bin/ardurover`)
//! - `HARVEST_SITL_PACK`: the `ardupilot-prearm` pack directory (default: the
//!   `current` version under `~/.cache/harvest/packs/maint-dev/root`)
//! - `HARVEST_SITL_PUBKEY`: its signing public key, or a file holding it
//!   (default `~/.cache/harvest/packs/maint-dev/pack.pub`)
//! - `HARVEST_SITL_REPORT`: write what each failure produced, as JSON
//!
//! Each failure is injected through the simulation's own parameters over
//! MAVLink, the firmware's real `PreArm:` text is read through
//! `vehicle.status`, and the text must resolve to a pack entry. Real texts
//! that match no pattern are reported (the pack's patterns were derived from
//! documentation).

use harvest_core::api::{self, Host};
use harvest_core::decode::mavlink::{self, Next};
use harvest_core::records::Records;
use harvest_core::{Pack, TrustedKey};
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// A simulator instance of its own (ports 5760 + 10 * I), away from a
/// development boat on the default ports.
const INSTANCE: u16 = 7;

fn home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default())
}

fn env_path(var: &str, default: PathBuf) -> PathBuf {
    std::env::var(var).map(PathBuf::from).unwrap_or(default)
}

struct Sim(Child);

/// A parameter: name, the value that injects the failure, the value that
/// restores it.
type Param = (&'static str, f32, f32);

impl Drop for Sim {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn param_set(s: &mut TcpStream, seq: &mut u8, name: &str, value: f32) {
    let mut p = Vec::with_capacity(23);
    p.extend_from_slice(&value.to_le_bytes());
    p.extend_from_slice(&[1, 1]);
    let mut id = [0u8; 16];
    id[..name.len()].copy_from_slice(name.as_bytes());
    p.extend_from_slice(&id);
    p.push(9); // REAL32
    *seq = seq.wrapping_add(1);
    s.write_all(&mavlink::encode_v2(*seq, 254, 191, 23, &p))
        .unwrap();
}

/// Set a parameter and wait for the vehicle to echo the new value.
fn set(s: &mut TcpStream, seq: &mut u8, name: &str, value: f32) {
    let t0 = Instant::now();
    let mut buf = Vec::new();
    let mut chunk = [0u8; 4096];
    let mut last_send = None::<Instant>;
    loop {
        if last_send.is_none_or(|t| t.elapsed() > Duration::from_secs(1)) {
            param_set(s, seq, name, value);
            last_send = Some(Instant::now());
        }
        assert!(t0.elapsed() < Duration::from_secs(15), "{name} was not set");
        if let Ok(n) = s.read(&mut chunk) {
            buf.extend_from_slice(&chunk[..n]);
        }
        loop {
            match mavlink::next_frame(&buf) {
                Next::Need => break,
                Next::Skip(k) => {
                    buf.drain(..k.clamp(1, buf.len()));
                }
                Next::Frame(f, used) => {
                    buf.drain(..used);
                    if f.msgid == 22 {
                        let v = f32::from_le_bytes(f.payload[0..4].try_into().unwrap());
                        let id: String = f.payload[8..24]
                            .iter()
                            .take_while(|b| **b != 0)
                            .map(|b| *b as char)
                            .collect();
                        if id == name && (v - value).abs() < 1e-3 {
                            return;
                        }
                    }
                }
            }
        }
    }
}

fn status(h: &Host) -> Value {
    api::call(h, "vehicle.status", json!({})).unwrap()
}

/// The active pre-arm texts and how each resolved.
fn prearm(s: &Value) -> Vec<(String, Option<String>)> {
    let hits = s["matched"]["hits"].as_array().cloned().unwrap_or_default();
    s["link"]["prearm"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| {
            let t = p["text"].as_str().unwrap().to_string();
            let hit = hits
                .iter()
                .find(|h| h["observed"]["value"] == t.as_str())
                .map(|h| h["rule"]["title"].as_str().unwrap_or("").to_string());
            (t, hit)
        })
        .collect()
}

#[test]
fn a_simulated_boat_reports_real_prearm_failures_that_resolve_in_the_pack() {
    let bin = env_path(
        "HARVEST_SITL_BIN",
        home().join(".cache/harvest/raw/ardupilot-src/build/sitl/bin/ardurover"),
    );
    let dev = home().join(".cache/harvest/packs/maint-dev");
    let pack_dir = std::env::var("HARVEST_SITL_PACK")
        .map(PathBuf::from)
        .ok()
        .or_else(|| {
            let root = dev.join("root/ardupilot-prearm");
            let v = std::fs::read_to_string(root.join("current")).ok()?;
            Some(root.join(v.trim()))
        });
    let key = env_path("HARVEST_SITL_PUBKEY", dev.join("pack.pub"));
    let Some(pack_dir) = pack_dir.filter(|d| d.is_dir() && bin.is_file()) else {
        eprintln!(
            "skipped: no simulator at {} or no pre-arm pack",
            bin.display()
        );
        return;
    };
    let key_text =
        std::fs::read_to_string(&key).unwrap_or_else(|_| key.to_string_lossy().into_owned());
    let pack = Arc::new(Pack::open(&pack_dir, &[TrustedKey::parse(&key_text).unwrap()]).unwrap());
    let pack_id = pack.pack_id().to_string();
    let h = Host::new(vec![pack], Records::in_memory().unwrap());

    // The simulator's defaults live next to its source.
    let src = bin.ancestors().nth(4).unwrap().to_path_buf();
    let defaults = ["rover.parm", "motorboat.parm"]
        .map(|f| {
            src.join("Tools/autotest/default_params")
                .join(f)
                .to_string_lossy()
                .into_owned()
        })
        .join(",");
    let work = tempfile::tempdir().unwrap();
    // The simulator exits when a client hangs up mid-write unless SIGPIPE is
    // ignored; this test process stays its parent (it exits with its parent).
    let child = Command::new("sh")
        .args(["-c", r#"trap "" PIPE; exec nice -n 10 "$@""#, "sh"])
        .arg(&bin)
        .args(["--model", "motorboat", "--defaults", &defaults])
        .arg(format!("-I{INSTANCE}"))
        .current_dir(work.path())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .unwrap();
    let _sim = Sim(child);
    let app_port = 5760 + 10 * INSTANCE;
    let tool_port = app_port + 2;

    // The simulator waits for the app's connection on serial 0.
    let t0 = Instant::now();
    while TcpStream::connect(("127.0.0.1", app_port)).is_err() {
        assert!(
            t0.elapsed() < Duration::from_secs(20),
            "the simulator did not start"
        );
        std::thread::sleep(Duration::from_millis(100));
    }
    // That probe was a connection; the simulator takes the next one too.
    api::call(
        &h,
        "vehicle.connect",
        json!({"address": format!("tcp:127.0.0.1:{app_port}"), "pack_id": pack_id}),
    )
    .unwrap();
    let t0 = Instant::now();
    loop {
        let s = status(&h);
        if s["link"]["state"] == "connected" && !s["link"]["identity"]["firmware"].is_null() {
            assert_eq!(s["link"]["identity"]["vehicle_type"], "surface_boat");
            assert_eq!(s["link"]["identity"]["autopilot"], "ardupilotmega");
            break;
        }
        assert!(
            t0.elapsed() < Duration::from_secs(60),
            "no identity: {}",
            serde_json::to_string_pretty(&s).unwrap()
        );
        std::thread::sleep(Duration::from_millis(200));
    }
    let mut tool = None;
    let t0 = Instant::now();
    while tool.is_none() {
        tool = TcpStream::connect(("127.0.0.1", tool_port)).ok();
        assert!(t0.elapsed() < Duration::from_secs(20), "no second port");
        std::thread::sleep(Duration::from_millis(100));
    }
    let mut tool = tool.unwrap();
    tool.set_read_timeout(Some(Duration::from_millis(100)))
        .unwrap();
    let mut seq = 0u8;

    // What the boat reports before anything is injected (it settles first).
    std::thread::sleep(Duration::from_secs(5));
    let baseline: Vec<String> = prearm(&status(&h)).into_iter().map(|(t, _)| t).collect();

    // failure, parameters, what the text must say, whether it must resolve.
    let failures: [(&str, &[Param], &str); 4] = [
        ("compass", &[("SIM_MAG1_FAIL", 1.0, 0.0)], "Compass"),
        ("rc", &[("SIM_RC_FAIL", 1.0, 0.0)], "Radio"),
        (
            "gps",
            &[("SIM_GPS1_ENABLE", 0.0, 1.0), ("ARMING_NEED_LOC", 1.0, 0.0)],
            "GPS",
        ),
        (
            "battery",
            &[
                ("SIM_BATT_VOLTAGE", 9.0, 12.6),
                ("BATT_ARM_VOLT", 11.0, 0.0),
            ],
            "Battery",
        ),
    ];
    let mut report = Vec::new();
    for (name, params, word) in failures {
        for (p, v, _) in params {
            set(&mut tool, &mut seq, p, *v);
        }
        let t0 = Instant::now();
        let seen = loop {
            let s = status(&h);
            let now = prearm(&s);
            if let Some(hit) = now.iter().find(|(t, _)| t.contains(word)) {
                break (hit.clone(), now);
            }
            assert!(
                t0.elapsed() < Duration::from_secs(40),
                "{name}: no PreArm text: {}",
                serde_json::to_string_pretty(&s["link"]["texts"]).unwrap()
            );
            std::thread::sleep(Duration::from_millis(250));
        };
        for (p, _, restore) in params {
            set(&mut tool, &mut seq, p, *restore);
        }
        eprintln!("{name}: {:?} -> {:?}", seen.0.0, seen.0.1);
        report.push(json!({
            "failure": name,
            "text": seen.0.0,
            "resolves_to": seen.0.1,
            "active": seen.1.iter().map(|(t, m)| json!({"text": t, "resolves_to": m})).collect::<Vec<_>>(),
        }));
    }
    let unmatched: std::collections::BTreeSet<String> = report
        .iter()
        .flat_map(|r| r["active"].as_array().unwrap().clone())
        .chain(
            baseline
                .iter()
                .map(|t| json!({"text": t, "resolves_to": null})),
        )
        .filter(|a| a["resolves_to"].is_null())
        .map(|a| a["text"].as_str().unwrap().to_string())
        .collect();
    let out = json!({
        "firmware": status(&h)["link"]["identity"],
        "baseline": baseline,
        "failures": report,
        "unmatched": unmatched,
    });
    eprintln!("{}", serde_json::to_string_pretty(&out).unwrap());
    if let Ok(p) = std::env::var("HARVEST_SITL_REPORT") {
        std::fs::write(p, serde_json::to_string_pretty(&out).unwrap()).unwrap();
    }
    // The compass failure is the proof: the real text resolves to its entry.
    let compass = &out["failures"][0];
    assert_eq!(compass["text"], "PreArm: Compass 1 not healthy");
    assert_eq!(compass["resolves_to"], "Compass X not healthy");
    api::call(&h, "vehicle.disconnect", json!({})).unwrap();
}
