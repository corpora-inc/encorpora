//! Protocol decoders over the sample inputs in `tests/data/decode/`.

use harvest_core::decode::{self, Format, j1939};
use serde_json::json;

fn sample(name: &str) -> String {
    std::fs::read_to_string(format!(
        "{}/tests/data/decode/{name}",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap()
}

fn values(d: &decode::Decoded) -> Vec<(Option<String>, String)> {
    d.observations
        .iter()
        .map(|o| (o.signal_kind.clone(), o.value.clone()))
        .collect()
}

#[test]
fn j1939_dm1_single_and_multi_packet() {
    let d = decode::decode(Format::J1939Candump, &sample("j1939-dm1.candump.log"), None);
    assert!(d.errors.is_empty(), "{:?}", d.errors);
    // Three DM1s: the engine, the transmission (reassembled), and a node with none.
    assert_eq!(d.dm1.len(), 3);
    let engine = &d.dm1[0];
    assert_eq!(engine.source, 0x00);
    assert_eq!(engine.lamps.amber_warning, j1939::Lamp::On);
    assert_eq!(engine.lamps.malfunction, j1939::Lamp::Off);
    assert_eq!(
        (
            engine.dtcs[0].spn,
            engine.dtcs[0].fmi,
            engine.dtcs[0].occurrences
        ),
        (110, 0, 1)
    );
    let trans = &d.dm1[1];
    assert_eq!(trans.source, 0x03);
    assert_eq!(trans.lamps.malfunction, j1939::Lamp::On);
    assert_eq!(trans.dtcs.len(), 2);
    assert_eq!(
        (
            trans.dtcs[1].spn,
            trans.dtcs[1].fmi,
            trans.dtcs[1].occurrences
        ),
        (168, 1, 1)
    );
    assert!(d.dm1[2].dtcs.is_empty(), "no active codes");
    // One observation per distinct code.
    assert_eq!(
        values(&d),
        [
            (Some("j1939.dm1".into()), "spn:110/fmi:0".into()),
            (Some("j1939.dm1".into()), "spn:168/fmi:1".into())
        ]
    );
    let classic = decode::decode(Format::J1939Candump, &sample("j1939-dm1.classic.log"), None);
    assert_eq!(classic.dm1, d.dm1[..1]);
}

#[test]
fn j1939_frames_and_broken_input() {
    let d = decode::decode(
        Format::J1939Frames,
        "18FECA00 04FF6E000001FFFF\nnot a frame\n18FECA00 04FF",
        None,
    );
    assert_eq!(d.dm1.len(), 1);
    assert_eq!(d.errors.len(), 2, "{:?}", d.errors);
    // A data packet with no session, and one out of sequence.
    let d = decode::decode(
        Format::J1939Frames,
        "1CEBFF03 0140FF6E000002A8\n1CECFF03 200A0002FFCAFE00\n1CEBFF03 02000101FFFFFFFF",
        None,
    );
    assert_eq!(d.errors.len(), 2, "{:?}", d.errors);
    assert!(d.dm1.is_empty());
}

#[test]
fn j1587_pid194() {
    let d = decode::decode(Format::J1587, &sample("j1587-pid194.hex"), None);
    assert!(d.errors.is_empty(), "{:?}", d.errors);
    assert_eq!(d.j1587.len(), 3);
    assert_eq!(d.j1587[0].occurrences, Some(3));
    assert!(!d.j1587[1].active && d.j1587[1].sid);
    assert_eq!(
        values(&d),
        [
            (Some("j1587.dtc".into()), "mid:128/pid:110/fmi:0".into()),
            (Some("j1587.dtc".into()), "mid:130/pid:177/fmi:4".into())
        ]
    );
}

#[test]
fn a_typed_display_code_matches_without_naming_its_kind() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    harvest_core::fixture_maint::build(&dir, "2026.3.1-1").unwrap();
    let pack = harvest_core::Pack::open(&dir, &[harvest_core::fixture::trusted_key()]).unwrap();
    let h = harvest_core::api::Host::new(
        vec![std::sync::Arc::new(pack)],
        harvest_core::records::Records::in_memory().unwrap(),
    );
    let r = harvest_core::api::call(
        &h,
        "signal.decode",
        json!({"format": "display", "input": " e21 "}),
    )
    .unwrap();
    assert_eq!(r["decoded"]["observations"][0]["value"], "E21");
    assert_eq!(r["match"]["suggested"]["node_id"], "oh.1");
    let r = harvest_core::api::call(
        &h,
        "signal.decode",
        json!({"format": "j1939_candump", "input": sample("j1939-dm1.candump.log"), "equip_id": "pump40-diesel"}),
    )
    .unwrap();
    assert_eq!(r["match"]["suggested"]["tree_id"], "t-hot");
    assert!(
        r["match"]["ambiguous"].as_bool().unwrap(),
        "both trees are hit"
    );
    let bad = harvest_core::api::call(
        &h,
        "signal.decode",
        json!({"format": "display", "input": "E21-3-4"}),
    )
    .unwrap();
    assert_eq!(bad["decoded"]["errors"].as_array().unwrap().len(), 1);
}

#[test]
fn mavlink_tlog_messages_observations_and_plate() {
    let bytes = std::fs::read(format!(
        "{}/tests/data/decode/mavlink-sample.tlog",
        env!("CARGO_MANIFEST_DIR")
    ))
    .unwrap();
    let d = decode::mavlink::decode(&bytes, true);
    assert_eq!(d.stats.frames, 10, "{:?}", d.stats);
    assert_eq!(
        (d.stats.bad_crc, d.stats.unknown, d.stats.signed),
        (1, 1, 1)
    );
    let h = &d.heartbeats[0];
    assert_eq!(
        (h.vehicle_type.as_str(), h.armed, h.custom_mode),
        ("quadrotor", true, 4)
    );
    let s = &d.sys_status[0];
    assert_eq!(s.unhealthy, ["gps"]);
    assert!(s.present.contains(&"battery".to_string()));
    assert_eq!(
        (s.battery_voltage, s.battery_remaining),
        (Some(11.87), Some(62))
    );
    let texts: Vec<&str> = d.status_texts.iter().map(|t| t.text.as_str()).collect();
    assert_eq!(
        texts,
        [
            "PreArm: Battery below minimum arming voltage",
            "EKF3 IMU0 forced reset after a large magnetometer innovation; check compass calibration"
        ]
    );
    assert_eq!(d.status_texts[1].severity, "error");
    let v = &d.autopilot_versions[0];
    assert_eq!(
        (
            v.firmware.as_str(),
            v.firmware_type.as_str(),
            v.git_hash.as_str()
        ),
        ("4.5.7", "official", "abc1234d")
    );
    assert_eq!((v.vendor_id, v.product_id), (0x1209, 0x5741));
    let b = &d.batteries[0];
    assert_eq!(b.cells.len(), 4);
    assert_eq!(b.voltage, Some(15.834));
    assert_eq!(b.temperature, Some(30.5));
    assert_eq!(d.params["BATT_CAPACITY"], 5200.0);
    let kinds: Vec<(String, String)> = d
        .observations
        .iter()
        .map(|o| (o.signal_kind.clone().unwrap(), o.value.clone()))
        .collect();
    assert!(kinds.contains(&("mavlink.sensor_unhealthy".into(), "gps".into())));
    assert!(kinds.contains(&(
        "mavlink.statustext".into(),
        "PreArm: Battery below minimum arming voltage".into()
    )));
    assert!(kinds.contains(&("mavlink.firmware".into(), "4.5.7".into())));
    assert_eq!(d.plate.firmware.as_deref(), Some("4.5.7"));
    assert_eq!(d.plate.params["ARMING_CHECK"], "1");
    assert_eq!(d.plate.params["vehicle_type"], "quadrotor");
    // The same bytes without the tlog timestamps, and through the API's base64 form.
    use base64::Engine as _;
    let api = decode::decode(
        Format::MavlinkTlog,
        &base64::engine::general_purpose::STANDARD.encode(&bytes),
        None,
    );
    assert_eq!(api.mavlink.unwrap().status_texts.len(), 2);
    assert_eq!(api.errors.len(), 1, "the broken frame is reported");
}
