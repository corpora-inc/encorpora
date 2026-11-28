//! The live vehicle link (`vehicle.connect`, `vehicle.status`,
//! `vehicle.disconnect`) against an in-process vehicle on loopback, and a
//! recording replayed through the same path. No simulator, no outside
//! network.

use harvest_core::Pack;
use harvest_core::api::{self, Host};
use harvest_core::decode::mavlink::{self, Next};
use harvest_core::fixture;
use harvest_core::fixture_maint;
use harvest_core::records::{AssetRegistry, Records};
use serde_json::{Value, json};
use std::io::{Read, Write};
use std::net::{TcpListener, UdpSocket};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

fn host() -> (tempfile::TempDir, Host) {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build_with(&dir, "2026.3.1-1", |c| {
        c.execute_batch(
            r"INSERT INTO signal_map VALUES ('mavlink.statustext', 're:^PreArm: Compass \d+ not healthy$', 'Compass not healthy', NULL, NULL, 'm40.3-2.codes', NULL, 'prov-pump40', NULL);
              INSERT INTO signal_map VALUES ('mavlink.statustext', 're:^PreArm: Battery below minimum arming voltage$', 'Battery below minimum arming voltage', NULL, NULL, 'm40.3-2.codes', NULL, 'prov-pump40', NULL);",
        )?;
        Ok(())
    })
    .unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let rec = Records::in_memory().unwrap();
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&pack), &reg).unwrap();
    (tmp, Host::new(vec![pack], rec))
}

fn ok(h: &Host, method: &str, params: Value) -> Value {
    match api::call(h, method, params) {
        Ok(v) => v,
        Err(e) => panic!("{method}: {e:?}"),
    }
}

/// Poll `vehicle.status` until `done` holds (or fail after `secs`).
fn wait(h: &Host, secs: u64, done: impl Fn(&Value) -> bool) -> Value {
    let t0 = Instant::now();
    loop {
        let t = Instant::now();
        let s = ok(h, "vehicle.status", json!({}));
        assert!(
            t.elapsed() < Duration::from_secs(1),
            "a status read never waits on the vehicle"
        );
        if done(&s) {
            return s;
        }
        assert!(
            t0.elapsed() < Duration::from_secs(secs),
            "timed out: {}",
            serde_json::to_string_pretty(&s).unwrap()
        );
        std::thread::sleep(Duration::from_millis(50));
    }
}

// ------------------------------------------------- a vehicle on loopback

fn heartbeat() -> Vec<u8> {
    // custom_mode, type 11 (surface boat), autopilot 3 (ArduPilot), base
    // mode, system status 3 (standby), MAVLink 3.
    let mut p = 0u32.to_le_bytes().to_vec();
    p.extend_from_slice(&[11, 3, 0x01, 3, 3]);
    p
}

fn sys_status(prearm_ok: bool) -> Vec<u8> {
    // Present and enabled: 3d_mag (bit 2) and prearm_check (bit 28).
    let present: u32 = (1 << 2) | (1 << 28);
    let health: u32 = if prearm_ok { present } else { 0 };
    let mut p = Vec::new();
    p.extend_from_slice(&present.to_le_bytes());
    p.extend_from_slice(&present.to_le_bytes());
    p.extend_from_slice(&health.to_le_bytes());
    p.extend_from_slice(&100u16.to_le_bytes()); // load
    p.extend_from_slice(&12_600u16.to_le_bytes()); // mV
    p.extend_from_slice(&(-1i16).to_le_bytes());
    p.extend_from_slice(&[0; 12]);
    p.push(80);
    p
}

fn autopilot_version() -> Vec<u8> {
    let mut p = vec![0u8; 60];
    p[16..20].copy_from_slice(&((4u32 << 24) | (7 << 16) | (3 << 8) | 255).to_le_bytes());
    p[28..32].copy_from_slice(&0x0001_0032u32.to_le_bytes());
    p[32..34].copy_from_slice(&0x1209u16.to_le_bytes());
    p[34..36].copy_from_slice(&0x5741u16.to_le_bytes());
    p[36..44].copy_from_slice(b"d9c5097c");
    p
}

fn status_text(sev: u8, text: &str) -> Vec<u8> {
    let mut p = vec![0u8; 54];
    p[0] = sev;
    p[1..1 + text.len()].copy_from_slice(text.as_bytes());
    p
}

/// What the vehicle heard from the link.
#[derive(Default)]
struct Heard {
    gcs_heartbeat: AtomicBool,
    asked_version: AtomicBool,
    asked_prearm: AtomicBool,
    asked_streams: AtomicBool,
}

fn listen(heard: &Heard, buf: &mut Vec<u8>) {
    loop {
        let f = match mavlink::next_frame(buf) {
            Next::Need => return,
            Next::Skip(k) => {
                buf.drain(..k.clamp(1, buf.len()));
                continue;
            }
            Next::Frame(f, used) => {
                buf.drain(..used);
                f
            }
        };
        if f.sysid != 255 {
            continue;
        }
        match f.msgid {
            0 => heard.gcs_heartbeat.store(true, Ordering::SeqCst),
            66 => heard.asked_streams.store(true, Ordering::SeqCst),
            76 => {
                let cmd = u16::from_le_bytes([f.payload[28], f.payload[29]]);
                let p1 = f32::from_le_bytes(f.payload[0..4].try_into().unwrap());
                if cmd == 512 && p1 == 148.0 {
                    heard.asked_version.store(true, Ordering::SeqCst);
                }
                if cmd == 401 {
                    heard.asked_prearm.store(true, Ordering::SeqCst);
                }
            }
            _ => {}
        }
    }
}

#[test]
fn a_tcp_vehicle_gives_identity_prearm_failures_and_a_match() {
    let (_tmp, h) = host();
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    let heard = Arc::new(Heard::default());
    let healthy = Arc::new(AtomicBool::new(false));
    let stop = Arc::new(AtomicBool::new(false));
    let (hv, hl, st) = (heard.clone(), healthy.clone(), stop.clone());
    let vehicle = std::thread::spawn(move || {
        let (mut s, _) = listener.accept().unwrap();
        s.set_read_timeout(Some(Duration::from_millis(50))).unwrap();
        let mut seq = 0u8;
        let mut send = |s: &mut std::net::TcpStream, id: u32, p: &[u8]| {
            seq = seq.wrapping_add(1);
            let _ = s.write_all(&mavlink::encode_v2(seq, 1, 1, id, p));
        };
        let mut buf = Vec::new();
        let mut chunk = [0u8; 1024];
        while !st.load(Ordering::SeqCst) {
            if let Ok(n) = s.read(&mut chunk) {
                if n == 0 {
                    return;
                }
                buf.extend_from_slice(&chunk[..n]);
                listen(&hv, &mut buf);
            }
            // Noise between frames, and a message the link does not decode.
            let _ = s.write_all(&[0x00, 0x55]);
            send(&mut s, 30, &[0u8; 28]);
            send(&mut s, 0, &heartbeat());
            let ok = hl.load(Ordering::SeqCst);
            send(&mut s, 1, &sys_status(ok));
            if hv.asked_version.load(Ordering::SeqCst) {
                send(&mut s, 148, &autopilot_version());
            }
            if hv.asked_prearm.load(Ordering::SeqCst) && !ok {
                send(
                    &mut s,
                    253,
                    &status_text(2, "PreArm: Compass 1 not healthy"),
                );
                send(&mut s, 253, &status_text(2, "PreArm: Gyros inconsistent"));
            }
        }
    });

    // Nothing is open before a person asks.
    let none = ok(&h, "vehicle.status", json!({}));
    assert!(none["link"].is_null() && none["matched"].is_null());

    let c = ok(
        &h,
        "vehicle.connect",
        json!({"address": format!("tcp:127.0.0.1:{port}"), "asset_id": "unit-101"}),
    );
    assert_eq!(c["link"]["target"], format!("tcp:127.0.0.1:{port}"));
    assert_eq!(c["asset_id"], "unit-101");

    let s = wait(&h, 15, |s| {
        s["link"]["state"] == "connected"
            && s["link"]["identity"]["firmware"] == "4.7.3"
            && s["link"]["prearm"].as_array().is_some_and(|p| p.len() == 2)
    });
    let link = &s["link"];
    assert_eq!(link["identity"]["firmware_type"], "official");
    assert_eq!(link["identity"]["firmware_hash"], "d9c5097c");
    assert_eq!(link["identity"]["vendor_id"], 0x1209);
    assert_eq!(link["identity"]["autopilot"], "ardupilotmega");
    assert_eq!(link["armed"], false);
    assert_eq!(link["unhealthy"], json!(["3d_mag", "prearm_check"]));
    assert_eq!(link["prearm_ttl_ms"], 75_000);
    let texts: Vec<&str> = link["prearm"]
        .as_array()
        .unwrap()
        .iter()
        .map(|p| p["text"].as_str().unwrap())
        .collect();
    assert!(texts.contains(&"PreArm: Compass 1 not healthy"));
    assert!(texts.contains(&"PreArm: Gyros inconsistent"));
    assert!(
        link["observations"]
            .as_array()
            .unwrap()
            .contains(&json!({"signal_kind": "mavlink.sensor_unhealthy", "value": "3d_mag"}))
    );
    // The link asked for what a ground station asks for.
    for (what, flag) in [
        ("heartbeat", &heard.gcs_heartbeat),
        ("streams", &heard.asked_streams),
        ("version", &heard.asked_version),
        ("pre-arm run", &heard.asked_prearm),
    ] {
        assert!(flag.load(Ordering::SeqCst), "the link sent no {what}");
    }

    // The compass text resolves; the gyro text is unmatched.
    let m = &s["matched"];
    assert_eq!(
        m["hits"][0]["observed"]["value"],
        "PreArm: Compass 1 not healthy"
    );
    assert_eq!(m["hits"][0]["rule"]["title"], "Compass not healthy");
    assert!(
        m["unmatched"]
            .as_array()
            .unwrap()
            .iter()
            .any(|o| o["value"] == "PreArm: Gyros inconsistent")
    );

    // The identity is on the asset, from the vehicle, written once.
    assert_eq!(s["attrs_written"], json!(["firmware"]));
    assert!(
        s["attrs_undeclared"]
            .as_array()
            .unwrap()
            .contains(&json!("firmware_hash"))
    );
    let attrs = ok(&h, "asset.attrs", json!({"asset_id": "unit-101"}));
    let fw = attrs["values"]
        .as_array()
        .unwrap()
        .iter()
        .find(|v| v["attr"] == "firmware")
        .unwrap();
    assert_eq!(
        (fw["value"].as_str(), fw["source"].as_str()),
        (Some("4.7.3"), Some("vehicle"))
    );
    let again = ok(&h, "vehicle.status", json!({}));
    assert_eq!(again["attrs_written"], json!([]));

    // Other calls run while the link reads.
    ok(&h, "pack.info", json!({}));

    // The autopilot reports the checks pass: the list clears.
    healthy.store(true, Ordering::SeqCst);
    let s = wait(&h, 10, |s| s["link"]["prearm"] == json!([]));
    assert_eq!(s["link"]["unhealthy"], json!([]));

    let d = ok(&h, "vehicle.disconnect", json!({}));
    assert_eq!(d["link"]["state"], "closed");
    assert!(ok(&h, "vehicle.status", json!({}))["link"].is_null());
    stop.store(true, Ordering::SeqCst);
    vehicle.join().unwrap();
}

#[test]
fn a_udp_link_answers_whoever_sends() {
    let (_tmp, h) = host();
    // A free port for the link to listen on.
    let port = UdpSocket::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    ok(
        &h,
        "vehicle.connect",
        json!({"address": format!("udp:127.0.0.1:{port}")}),
    );
    let v = UdpSocket::bind("127.0.0.1:0").unwrap();
    v.set_read_timeout(Some(Duration::from_millis(100)))
        .unwrap();
    let heard = Heard::default();
    let t0 = Instant::now();
    let mut seq = 0u8;
    while !heard.gcs_heartbeat.load(Ordering::SeqCst) {
        assert!(t0.elapsed() < Duration::from_secs(10), "no answer");
        seq = seq.wrapping_add(1);
        v.send_to(
            &mavlink::encode_v2(seq, 1, 1, 0, &heartbeat()),
            ("127.0.0.1", port),
        )
        .unwrap();
        let mut b = [0u8; 2048];
        if let Ok((n, _)) = v.recv_from(&mut b) {
            listen(&heard, &mut b[..n].to_vec());
        }
    }
    let s = wait(&h, 5, |s| s["link"]["state"] == "connected");
    assert_eq!(s["link"]["identity"]["vehicle_type"], "surface_boat");
    ok(&h, "vehicle.disconnect", json!({}));
}

#[test]
fn a_recording_replays_through_the_same_path() {
    let (_tmp, h) = host();
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/data/decode/mavlink-sample.tlog"
    );
    ok(
        &h,
        "vehicle.connect",
        json!({"address": format!("file:{path}"), "asset_id": "unit-102"}),
    );
    let s = wait(&h, 5, |s| s["link"]["state"] == "finished");
    let link = &s["link"];
    assert_eq!(link["identity"]["firmware"], "4.5.7");
    assert_eq!(link["unhealthy"], json!(["gps"]));
    let texts: Vec<&str> = link["texts"]
        .as_array()
        .unwrap()
        .iter()
        .map(|t| t["text"].as_str().unwrap())
        .collect();
    assert_eq!(
        texts,
        [
            "PreArm: Battery below minimum arming voltage",
            "EKF3 IMU0 forced reset after a large magnetometer innovation; check compass calibration"
        ]
    );
    assert_eq!(link["prearm"][0]["text"], texts[0]);
    assert_eq!(
        s["matched"]["hits"][0]["rule"]["title"],
        "Battery below minimum arming voltage"
    );
    assert_eq!(s["attrs_written"], json!(["firmware"]));
}

#[test]
fn a_link_that_cannot_open_says_so() {
    let (_tmp, h) = host();
    // Nothing listens on a port just released.
    let port = TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port();
    ok(
        &h,
        "vehicle.connect",
        json!({"address": format!("tcp:127.0.0.1:{port}")}),
    );
    let s = wait(&h, 10, |s| s["link"]["state"] == "failed");
    assert!(
        s["link"]["error"]
            .as_str()
            .unwrap()
            .contains(&port.to_string())
    );
    // Bad addresses, packs and assets are refused before anything opens.
    for bad in [
        json!({"address": "serial:/dev/ttyUSB0"}),
        json!({"address": "tcp:127.0.0.1:5760", "asset_id": "nope"}),
        json!({"address": "tcp:127.0.0.1:5760", "pack_id": "nope"}),
    ] {
        assert!(api::call(&h, "vehicle.connect", bad).is_err());
    }
    // The failed link is still the one reported.
    assert_eq!(
        ok(&h, "vehicle.status", json!({}))["link"]["state"],
        "failed"
    );
}

#[test]
fn a_hub_never_opens_a_vehicle_link() {
    let (_tmp, h) = host();
    let hub = harvest_core::hub::Hub::in_memory(
        ed25519_dalek::SigningKey::from_bytes(&[0x42; 32]),
        "pump40-fleet",
    )
    .unwrap();
    let h = h.with_hub(Arc::new(std::sync::Mutex::new(hub)));
    let e = api::call(
        &h,
        "vehicle.connect",
        json!({"address": "tcp:127.0.0.1:5760"}),
    )
    .unwrap_err();
    assert_eq!(e.code, "forbidden");
}
