//! The hub: idempotent receipts, the lesson review queue and its conflict
//! rule, signed bundles, fleet aggregates, pack offers; devices syncing
//! with it in process and over HTTP; and the fleet simulation.

use harvest_core::fixture;
use harvest_core::fixture_maint;
use harvest_core::hub::{Hub, LocalLink, NoteEdit};
use harvest_core::records::{
    AssetRegistry, JobAnswer, JobClose, JobStart, LessonFilter, LessonInput, LessonStatus, Records,
    ResolutionKind,
};
use harvest_core::sync::{HubLink, LinkTransport, Upload};
use harvest_core::{Error, Pack};
use serde_json::json;
use std::sync::{Arc, Mutex};

fn hub_key() -> ed25519_dalek::SigningKey {
    ed25519_dalek::SigningKey::from_bytes(&[0x42; 32])
}

struct Fleet {
    _tmp: tempfile::TempDir,
    pack: Arc<Pack>,
    hub: Arc<Mutex<Hub>>,
}

fn fleet() -> Fleet {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build(&dir, "2026.3.1-1").unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let hub = Arc::new(Mutex::new(
        Hub::in_memory(hub_key(), "pump40-fleet").unwrap(),
    ));
    Fleet {
        _tmp: tmp,
        pack,
        hub,
    }
}

fn device(f: &Fleet) -> (Records, LocalLink) {
    let rec = Records::in_memory().unwrap();
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&f.pack), &reg).unwrap();
    let link = LocalLink {
        hub: f.hub.clone(),
        device_id: rec.device_id().unwrap(),
    };
    (rec, link)
}

/// A fixed job ending in a lesson; returns the lesson id.
fn fixed_job(f: &Fleet, rec: &Records, asset: &str, action: &str) -> String {
    let job = rec
        .start_job(
            &f.pack,
            &JobStart {
                symptom_id: Some("s-nocrank".into()),
                asset_id: Some(asset.into()),
                level: "technician".into(),
                ..Default::default()
            },
        )
        .unwrap();
    for (node, outcome, value) in [
        ("nc.0", Some("done"), None),
        ("nc.1", Some("yes"), None),
        ("nc.2", None, Some(12.8)),
        ("nc.3", Some("yes"), None),
        ("nc.4", Some("fail"), None),
    ] {
        rec.answer_job(
            &f.pack,
            &job.job_id,
            &JobAnswer {
                node_id: node.into(),
                outcome: outcome.map(str::to_string),
                value,
                unit: value.map(|_| "V".to_string()),
                ..Default::default()
            },
        )
        .unwrap();
    }
    let (_, l) = rec
        .close_job(
            &f.pack,
            &job.job_id,
            &JobClose {
                resolution: ResolutionKind::Fixed,
                note: None,
                lesson: Some(LessonInput {
                    cause: "Relay K1 contacts burnt".into(),
                    action: action.into(),
                    submit: true,
                    ..Default::default()
                }),
            },
        )
        .unwrap();
    l.unwrap().lesson_id
}

#[test]
fn receipts_are_idempotent_and_bad_items_are_refused() {
    let f = fleet();
    let (rec, link) = device(&f);
    fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    let batch = rec.pending(10).unwrap();
    let hub = f.hub.lock().unwrap();
    let r1 = hub.receive("dev-a", &batch).unwrap();
    assert_eq!((r1.stored, r1.duplicates), (2, 0));
    let r2 = hub.receive("dev-a", &batch).unwrap();
    assert_eq!((r2.stored, r2.duplicates), (0, 2));
    assert_eq!(r1.receipts, r2.receipts, "the same receipt every time");
    let mut bad = batch[0].clone();
    bad.payload.push(' ');
    assert_eq!(
        hub.receive("dev-a", &[bad]).unwrap().refused,
        1,
        "hash mismatch"
    );
    let mut other: Upload = batch[0].clone();
    other.payload = "{}".into();
    other.payload_sha256 = {
        use sha2::{Digest, Sha256};
        format!("{:x}", Sha256::digest(b"{}"))
    };
    assert_eq!(
        hub.receive("dev-a", &[other]).unwrap().refused,
        1,
        "same id, other content"
    );
    assert_eq!(hub.status().unwrap().items, 2);
    assert!(hub.verify_audit().unwrap().ok);
    drop(hub);
    // The device's flush acknowledges everything through the link.
    let r = rec.flush(&LinkTransport(&link), 10).unwrap();
    assert_eq!((r.acked, r.remaining), (2, 0));
}

fn lesson_upload(
    f: &Fleet,
    device_lesson_id: Option<&str>,
    cause: &str,
    at: &str,
) -> (Records, Vec<Upload>) {
    let (rec, _) = device(f);
    harvest_core::audit::set_clock(Some(ms(at)));
    rec.create_lesson(
        Some(&f.pack),
        LessonInput {
            lesson_id: device_lesson_id.map(str::to_string),
            tree_id: Some("t-hot".into()),
            symptom_id: Some("s-hot".into()),
            cause: cause.into(),
            action: "Cleaned the intake strainer".into(),
            submit: true,
            ..Default::default()
        },
    )
    .unwrap();
    harvest_core::audit::set_clock(None);
    let p = rec.pending(10).unwrap();
    (rec, p)
}

fn ms(t: &str) -> i64 {
    let d = harvest_core::records::maint::day_number(t).unwrap();
    let h: i64 = t[11..13].parse().unwrap();
    let m: i64 = t[14..16].parse().unwrap();
    d * 86_400_000 + h * 3_600_000 + m * 60_000
}

#[test]
fn two_units_editing_one_lesson_resolve_the_same_way_in_any_order() {
    let f = fleet();
    let (_a, ua) = lesson_upload(&f, None, "Weed in the strainer", "2026-03-01T10:00");
    let id = serde_json::from_str::<serde_json::Value>(&ua[0].payload).unwrap()["lesson_id"]
        .as_str()
        .unwrap()
        .to_string();
    let (_b, ub) = lesson_upload(
        &f,
        Some(&id),
        "Silt and weed in the strainer",
        "2026-03-01T10:30",
    );
    // a then b, and b then a (each from its own unit).
    let h1 = Hub::in_memory(hub_key(), "s").unwrap();
    h1.receive("dev-a", &ua).unwrap();
    h1.receive("dev-b", &ub).unwrap();
    let h2 = Hub::in_memory(hub_key(), "s").unwrap();
    h2.receive("dev-b", &ub).unwrap();
    h2.receive("dev-a", &ua).unwrap();
    for h in [&h1, &h2] {
        let q = h.queue(None).unwrap();
        assert_eq!(q.len(), 1);
        assert_eq!(
            q[0].current.cause, "Silt and weed in the strainer",
            "the newer edit wins"
        );
        let states: Vec<(&str, &str)> = q[0]
            .versions
            .iter()
            .map(|v| (v.device_id.as_str(), v.state.as_str()))
            .collect();
        assert_eq!(
            states,
            [("dev-a", "lost"), ("dev-b", "current")],
            "the losing edit is kept and shown"
        );
        assert_eq!(h.conflicts().unwrap()[0].rule, "newest updated_at");
    }
    // A version arriving after review reopens the lesson.
    h1.approve(&id, "Reviewer A", None, None).unwrap();
    let (_c, uc) = lesson_upload(&f, Some(&id), "Strainer screen torn", "2026-03-02T08:00");
    h1.receive("dev-c", &uc).unwrap();
    let q = h1.queue(Some("pending")).unwrap();
    assert!(q[0].reopened);
    assert_eq!(q[0].reviews.len(), 1);
    // The same time on two units: the larger device id wins, both ways.
    let (_d, ud) = lesson_upload(&f, Some(&id), "Same minute, unit d", "2026-03-03T09:00");
    let (_e, ue) = lesson_upload(&f, Some(&id), "Same minute, unit e", "2026-03-03T09:00");
    for order in [
        [("dev-d", &ud), ("dev-e", &ue)],
        [("dev-e", &ue), ("dev-d", &ud)],
    ] {
        let h = Hub::in_memory(hub_key(), "s").unwrap();
        for (dev, u) in order {
            h.receive(dev, u).unwrap();
        }
        assert_eq!(
            h.queue(None).unwrap()[0].current.cause,
            "Same minute, unit e"
        );
        assert_eq!(
            h.conflicts().unwrap()[0].rule,
            "same time: larger device id"
        );
    }
}

#[test]
fn reviews_become_signed_bundles_that_devices_install() {
    let f = fleet();
    let (rec, link) = device(&f);
    let l1 = fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    let l2 = fixed_job(&f, &rec, "unit-102", "Replaced relay K1");
    let l3 = fixed_job(&f, &rec, "unit-102", "Hit the starter with a hammer");
    rec.flush(&LinkTransport(&link), 50).unwrap();
    {
        let hub = f.hub.lock().unwrap();
        assert!(
            matches!(hub.approve(&l1, " ", None, None), Err(Error::Invalid(_))),
            "a reviewer is named"
        );
        hub.approve(&l1, "Reviewer A", None, None).unwrap();
        hub.approve(
            &l2,
            "Reviewer B",
            Some(NoteEdit {
                text: Some("Replace relay K1; check the connector for corrosion.".into()),
                scope: None,
            }),
            Some("worded for the fleet"),
        )
        .unwrap();
        hub.reject(&l3, "Reviewer A", Some("Not a repair")).unwrap();
        assert!(matches!(
            hub.approve(&l3, "Reviewer A", None, None),
            Err(Error::Invalid(_))
        ));
        let b = hub.publish(false).unwrap().unwrap();
        assert_eq!(b["seq"], 1);
        assert_eq!(b["notes"].as_array().unwrap().len(), 2);
        assert_eq!(b["fleet"]["jobs"][0]["jobs"], 3);
        let k1 = b["notes"][0]["counts"].clone();
        assert_eq!(k1["attempts"], 2, "two lessons with this action");
        assert_eq!(k1["resolved"], 2);
        assert_eq!(k1["units"], 2);
        assert!(hub.publish(false).unwrap().is_none(), "nothing new");
        let events: Vec<String> = hub
            .audit_records()
            .unwrap()
            .into_iter()
            .filter_map(|r| match r {
                harvest_core::audit::AuditRecord::Event { event, .. } => Some(event.event),
                _ => None,
            })
            .collect();
        for e in [
            "hub.receive",
            "hub.approve",
            "hub.edit_approve",
            "hub.reject",
            "hub.publish",
        ] {
            assert!(events.contains(&e.to_string()), "{e} audited: {events:?}");
        }
        assert!(hub.verify_audit().unwrap().ok);
    }
    let keys = [f.hub.lock().unwrap().trusted_key()];
    // A device that trusts another key refuses the bundle.
    assert!(
        rec.pull(&link, &[fixture::trusted_key()])
            .unwrap()
            .refused
            .is_some()
    );
    let p = rec.pull(&link, &keys).unwrap();
    assert_eq!(p.installed, [1]);
    assert!(p.fleet_updated);
    assert_eq!(rec.field_notes().unwrap().len(), 2);
    let statuses: Vec<(String, LessonStatus)> = rec
        .lessons(&LessonFilter::default())
        .unwrap()
        .into_iter()
        .map(|l| (l.lesson_id, l.status))
        .collect();
    assert!(statuses.contains(&(l2.clone(), LessonStatus::Edited)));
    assert!(statuses.contains(&(l3.clone(), LessonStatus::Rejected)));
    assert!(rec.fleet_summary().unwrap().is_some());
    // Pulling again installs nothing.
    assert!(rec.pull(&link, &keys).unwrap().installed.is_empty());
}

#[test]
fn the_hub_offers_the_newest_pack_or_a_delta() {
    let tmp = tempfile::tempdir().unwrap();
    let root = tmp.path().join("hub-packs");
    let keys = vec![fixture::trusted_key()];
    let v1 = root.join("pump40").join("2026.3.1-1");
    let v2 = root.join("pump40").join("2026.3.2-1");
    fixture_maint::build(&v1, "2026.3.1-1").unwrap();
    fixture_maint::build_with(&v2, "2026.3.2-1", |c| {
        c.execute_batch(
            "UPDATE section SET text = text || ' Revision D.' WHERE section_id = 'm40.1';",
        )?;
        Ok(())
    })
    .unwrap();
    let hub = Arc::new(Mutex::new(
        Hub::in_memory(hub_key(), "s")
            .unwrap()
            .with_packs(root.clone(), keys.clone()),
    ));
    let link = LocalLink {
        hub: hub.clone(),
        device_id: "dev-1".into(),
    };
    let full = link
        .pack_offer("pump40", Some("2026.3.1-1"))
        .unwrap()
        .unwrap();
    assert_eq!(
        (full.kind.as_str(), full.version.as_str()),
        ("full", "2026.3.2-1")
    );
    assert!(
        link.pack_offer("pump40", Some("2026.3.2-1"))
            .unwrap()
            .is_none(),
        "current"
    );
    harvest_core::delta::make_delta(
        &v1,
        &v2,
        &root.join("pump40").join("delta-2026.3.1-1-2026.3.2-1"),
        &keys,
        Some(&fixture::signing_key()),
    )
    .unwrap();
    let delta = link
        .pack_offer("pump40", Some("2026.3.1-1"))
        .unwrap()
        .unwrap();
    assert_eq!(delta.kind, "delta");
    assert!(delta.bytes < full.bytes);
    // A device installs v1, then the delta through the link.
    let dev_root = tmp.path().join("dev");
    harvest_core::packs::install_dir(&dev_root, &v1, &keys).unwrap();
    let inst = harvest_core::sync::install_offer(&dev_root, &link, &delta, &keys).unwrap();
    assert_eq!(inst.version, "2026.3.2-1");
    assert!(Pack::open(&inst.dir, &keys).is_ok());
    // An offer whose file does not match is refused.
    let mut lie = full.clone();
    lie.files[0].sha256 = "0".repeat(64);
    assert!(
        harvest_core::sync::install_offer(&tmp.path().join("dev2"), &link, &lie, &keys).is_err()
    );
    // Nothing outside the offered directory is served.
    let mut escape = full.clone();
    escape.dir = "../../etc".into();
    assert!(link.fetch(&escape, "manifest.json").is_err());
    assert!(link.fetch(&full, "../2026.3.1-1/manifest.json").is_err());
}

#[cfg(feature = "hub")]
#[test]
fn a_device_syncs_with_harvest_hub_over_http() {
    use harvest_core::api::{self, Host, serve};
    let f = fleet();
    let hub_host = Arc::new(
        Host::new(vec![f.pack.clone()], Records::in_memory().unwrap()).with_hub(f.hub.clone()),
    );
    let running = serve::start(
        hub_host.clone(),
        serve::ServeConfig {
            bind: "127.0.0.1:0".parse().unwrap(),
            static_dir: None,
            allow_origins: vec![],
        },
    )
    .unwrap();
    let base = format!("http://127.0.0.1:{}", running.addr().port());
    let (rec, _) = device(&f);
    let id = rec.device_id().unwrap();
    let link =
        harvest_core::hub::http::HttpHubLink::new(&base, &id, std::time::Duration::from_secs(10));
    let lesson = fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    let r = rec.flush(&LinkTransport(&link), 50).unwrap();
    assert_eq!(r.acked, 2);
    // The reviewer works through the API on the hub.
    let q = api::call(&hub_host, "hub.queue", json!({"status": "pending"})).unwrap();
    assert_eq!(q[0]["lesson_id"], lesson.as_str());
    api::call(
        &hub_host,
        "hub.approve",
        json!({"lesson_id": lesson, "reviewer": "Reviewer A"}),
    )
    .unwrap();
    assert_eq!(
        api::call(&hub_host, "hub.publish", json!({})).unwrap()["seq"],
        1
    );
    let keys = [f.hub.lock().unwrap().trusted_key()];
    let p = rec.pull(&link, &keys).unwrap();
    assert_eq!(p.installed, [1]);
    assert_eq!(
        api::call(&hub_host, "hub.status", json!({})).unwrap()["devices"],
        1
    );
    running.stop();
}

#[test]
fn the_simulation_keeps_its_invariants_and_repeats_itself() {
    let mut s = harvest_core::sim::named("flapping").unwrap();
    s.days = 4.0;
    s.devices = 3;
    s.conflicts = vec![harvest_core::sim::ScriptedConflict {
        day: 1.0,
        device: 0,
        other: 1,
        gap_minutes: 20.0,
    }];
    s.tamper_prob = 0.3;
    let m = harvest_core::sim::run(&s, None).unwrap();
    assert!(m.invariants.ok, "{:#?}", m.invariants);
    assert_eq!(m.delivery.lost, 0);
    assert!(m.delivery.rate > 0.99, "{:?}", m.delivery);
    assert!(m.link.failed_requests > 0 && m.link.duplicates_suppressed > 0);
    assert!(m.bundles.tampered_in_transit > 0);
    assert_eq!(
        m.bundles.refused, m.bundles.tampered_in_transit,
        "every tampered bundle refused"
    );
    assert_eq!(m.conflicts.len(), 1);
    assert!(m.conflicts[0].losing_version_visible);
    let again = harvest_core::sim::run(&s, None).unwrap();
    assert_eq!(
        serde_json::to_string(&m).unwrap(),
        serde_json::to_string(&again).unwrap()
    );
}

#[test]
fn a_long_outage_then_one_sync_delivers_everything_and_a_pack_update() {
    let mut s = harvest_core::sim::named("disconnected-180").unwrap();
    s.days = 20.0;
    s.link.initial_down_days = 20.0;
    s.pack_update_day = Some(5.0);
    let m = harvest_core::sim::run(&s, None).unwrap();
    assert!(m.invariants.ok, "{:#?}", m.invariants);
    assert_eq!(m.delivery.rate, 1.0);
    assert!(m.capture_to_hub_hours.max.unwrap() > 24.0 * 14.0);
    assert_eq!(m.packs.installed, s.devices as u64);
    assert_eq!(m.packs.kinds.get("delta"), Some(&(s.devices as u64)));
}

#[test]
fn the_checked_in_scenarios_are_the_named_ones() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../sim");
    for name in [
        "pier-daily",
        "underway-two-weeks",
        "disconnected-180",
        "flapping",
    ] {
        let want = harvest_core::sim::named(name).unwrap();
        let path = dir.join(format!("{name}.json"));
        if std::env::var_os("HARVEST_API_BLESS").is_some() {
            std::fs::create_dir_all(&dir).unwrap();
            std::fs::write(&path, serde_json::to_string_pretty(&want).unwrap() + "\n").unwrap();
        }
        let got: harvest_core::sim::Scenario =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(got, want, "{name}");
    }
}
