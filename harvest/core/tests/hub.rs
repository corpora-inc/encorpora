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
use harvest_core::sync::{DeviceKey, HubLink, LinkTransport, Upload};
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

/// The fleet hub's key (taken before any call that locks the hub).
fn hub_keys(f: &Fleet) -> Vec<harvest_core::TrustedKey> {
    vec![f.hub.lock().unwrap().trusted_key()]
}

/// The hub's key, as the device trusts it.
fn hk(l: &LocalLink) -> Vec<harvest_core::TrustedKey> {
    vec![l.hub.lock().unwrap().trusted_key()]
}

fn key(n: u8) -> DeviceKey {
    DeviceKey::from_seed(&[n; 32])
}

/// Deliver `items` as device `k`, enrolling it first.
fn recv(h: &Hub, k: &DeviceKey, items: &[Upload]) -> harvest_core::hub::ReceiveReport {
    h.enroll(&k.public_base64(), None, "Admin").unwrap();
    h.receive(&k.deliver(items).unwrap()).unwrap()
}

static NEXT: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(100);

/// A device enrolled with the fleet's hub.
fn device(f: &Fleet) -> (Records, LocalLink) {
    let rec = Records::in_memory().unwrap();
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&f.pack), &reg).unwrap();
    let k = key(NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed));
    f.hub
        .lock()
        .unwrap()
        .enroll(&k.public_base64(), Some("test unit"), "Admin")
        .unwrap();
    (
        rec,
        LocalLink {
            hub: f.hub.clone(),
            key: k,
            link: Default::default(),
        },
    )
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
    let ka = key(1);
    let r1 = recv(&hub, &ka, &batch);
    assert_eq!((r1.stored, r1.duplicates), (2, 0));
    let r2 = recv(&hub, &ka, &batch);
    assert_eq!((r2.stored, r2.duplicates), (0, 2));
    assert_eq!(r1.receipts, r2.receipts, "the same receipt every time");
    let mut bad = batch[0].clone();
    bad.payload.push(' ');
    assert_eq!(recv(&hub, &ka, &[bad]).refused, 1, "hash mismatch");
    let mut other: Upload = batch[0].clone();
    other.payload = "{}".into();
    other.payload_sha256 = {
        use sha2::{Digest, Sha256};
        format!("{:x}", Sha256::digest(b"{}"))
    };
    assert_eq!(
        recv(&hub, &ka, &[other]).refused,
        1,
        "same id, other content"
    );
    assert_eq!(hub.status().unwrap().items, 2);
    assert!(hub.verify_audit().unwrap().ok);
    drop(hub);
    // The device's flush acknowledges everything through the link.
    let r = rec
        .flush(
            &LinkTransport {
                link: &link,
                keys: &hk(&link),
            },
            10,
        )
        .unwrap();
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
    let (ka, kb) = (key(1), key(2));
    // a then b, and b then a (each from its own unit).
    let h1 = Hub::in_memory(hub_key(), "s")
        .unwrap()
        .with_skew_bound_minutes(10);
    recv(&h1, &ka, &ua);
    recv(&h1, &kb, &ub);
    let h2 = Hub::in_memory(hub_key(), "s")
        .unwrap()
        .with_skew_bound_minutes(10);
    recv(&h2, &kb, &ub);
    recv(&h2, &ka, &ua);
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
            [
                (ka.device_id().as_str(), "lost"),
                (kb.device_id().as_str(), "current")
            ],
            "the losing edit is kept and shown"
        );
        assert_eq!(h.conflicts().unwrap()[0].rule, "newest updated_at");
    }
    // A version arriving after review reopens the lesson.
    h1.approve(&id, "Reviewer A", None, None, None).unwrap();
    let kc = key(3);
    let (_c, uc) = lesson_upload(&f, Some(&id), "Strainer screen torn", "2026-03-02T08:00");
    recv(&h1, &kc, &uc);
    let q = h1.queue(Some("pending")).unwrap();
    assert!(q[0].reopened);
    assert_eq!(q[0].reviews.len(), 1);
    // The same time on two units: the larger device id wins, both ways.
    let (_d, ud) = lesson_upload(&f, Some(&id), "Same minute, unit d", "2026-03-03T09:00");
    let (_e, ue) = lesson_upload(&f, Some(&id), "Same minute, unit e", "2026-03-03T09:00");
    let (kd, ke) = (key(4), key(5));
    let want = if kd.device_id() > ke.device_id() {
        "Same minute, unit d"
    } else {
        "Same minute, unit e"
    };
    for order in [[(&kd, &ud), (&ke, &ue)], [(&ke, &ue), (&kd, &ud)]] {
        let h = Hub::in_memory(hub_key(), "s")
            .unwrap()
            .with_skew_bound_minutes(0);
        for (k, u) in order {
            recv(&h, k, u);
        }
        assert_eq!(h.queue(None).unwrap()[0].current.cause, want);
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
    rec.flush(
        &LinkTransport {
            link: &link,
            keys: &hk(&link),
        },
        50,
    )
    .unwrap();
    {
        let hub = f.hub.lock().unwrap();
        assert!(
            matches!(
                hub.approve(&l1, " ", None, None, None),
                Err(Error::Invalid(_))
            ),
            "a reviewer is named"
        );
        hub.approve(&l1, "Reviewer A", None, None, None).unwrap();
        hub.approve(
            &l2,
            "Reviewer B",
            Some(NoteEdit {
                text: Some("Replace relay K1; check the connector for corrosion.".into()),
                scope: None,
            }),
            Some("worded for the fleet"),
            None,
        )
        .unwrap();
        hub.reject(&l3, "Reviewer A", Some("Not a repair")).unwrap();
        assert!(matches!(
            hub.approve(&l3, "Reviewer A", None, None, None),
            Err(Error::Invalid(_))
        ));
        let b = hub.publish(false, "Publisher A").unwrap().unwrap();
        assert_eq!(b["seq"], 1);
        assert_eq!(b["notes"].as_array().unwrap().len(), 2);
        let doc = hub.fleet_document().unwrap().unwrap();
        assert_eq!(doc["summary"]["jobs"][0]["jobs"], 3);
        assert_eq!(doc["sha256"], b["fleet_sha256"]);
        let k1 = b["notes"][0]["counts"].clone();
        assert_eq!(k1["attempts"], 2, "two lessons with this action");
        assert_eq!(k1["resolved"], 2);
        assert_eq!(k1["units"], 2);
        assert!(
            hub.publish(false, "Publisher A").unwrap().is_none(),
            "nothing new"
        );
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
        key: key(9),
        link: Default::default(),
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
mod http {
    use super::*;
    use harvest_core::api::{Host, serve};
    use harvest_core::hub::auth::TokenFile;
    use std::io::{Read, Write};

    const TOKENS: &str = r#"[
        {"name": "Reviewer A", "token": "reviewer-token-0001", "roles": ["reviewer"]},
        {"name": "Publisher P", "token": "publisher-token-001", "roles": ["publisher"]},
        {"name": "Admin Z", "token": "admin-token-0000001", "roles": ["admin"]}
    ]"#;

    fn call(
        addr: std::net::SocketAddr,
        token: Option<&str>,
        method: &str,
        params: serde_json::Value,
    ) -> (u16, serde_json::Value) {
        let body = params.to_string();
        let auth = token
            .map(|t| format!("Authorization: Bearer {t}\r\n"))
            .unwrap_or_default();
        let mut s = std::net::TcpStream::connect(addr).unwrap();
        write!(
            s,
            "POST /api/{method} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nContent-Type: application/json\r\n{auth}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
            addr.port(),
            body.len()
        )
        .unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        let status = out.split_whitespace().nth(1).unwrap().parse().unwrap();
        let json = out.split("\r\n\r\n").nth(1).unwrap_or("null");
        (
            status,
            serde_json::from_str(json).unwrap_or(serde_json::Value::Null),
        )
    }

    #[test]
    fn a_device_syncs_with_harvest_hub_over_http_and_people_act_by_role() {
        let f = fleet();
        let hub_host = Arc::new(
            Host::new(vec![f.pack.clone()], Records::in_memory().unwrap())
                .with_hub(f.hub.clone())
                .with_identity(Arc::new(TokenFile::parse(TOKENS).unwrap())),
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
        let addr = running.addr();
        let base = format!("http://127.0.0.1:{}", addr.port());
        let (rec, _) = device(&f);
        let k = key(77);
        // Not enrolled yet: refused, and the device keeps everything.
        let link = harvest_core::hub::http::HttpHubLink::new(
            &base,
            DeviceKey::from_seed(&k.seed()),
            std::time::Duration::from_secs(10),
        )
        .unwrap();
        let lesson = fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
        let r = rec
            .flush(
                &LinkTransport {
                    link: &link,
                    keys: &hub_keys(&f),
                },
                50,
            )
            .unwrap();
        assert_eq!(r.acked, 0);
        assert!(r.error.unwrap().contains("403"));
        // Enrollment is an administrator's.
        let enroll = json!({"public_key": k.public_base64(), "name": "Pump 101 tablet"});
        assert_eq!(
            call(
                addr,
                Some("reviewer-token-0001"),
                "hub.enroll",
                enroll.clone()
            )
            .1["error"]["code"],
            "forbidden"
        );
        let (_, e) = call(addr, Some("admin-token-0000001"), "hub.enroll", enroll);
        assert_eq!(e["result"]["device_id"], k.device_id().as_str());
        assert_eq!(e["result"]["enrolled_by"], "Admin Z");
        let r = rec
            .flush(
                &LinkTransport {
                    link: &link,
                    keys: &hub_keys(&f),
                },
                50,
            )
            .unwrap();
        assert_eq!(r.acked, 2);
        // No token, a bad token: refused before any method runs.
        assert_eq!(
            call(addr, None, "hub.queue", json!({})).1["error"]["code"],
            "unauthenticated"
        );
        assert_eq!(
            call(addr, Some("not-a-real-token-xx"), "hub.queue", json!({})).0,
            401
        );
        let (_, q) = call(
            addr,
            Some("reviewer-token-0001"),
            "hub.queue",
            json!({"status": "pending"}),
        );
        assert_eq!(q["result"][0]["lesson_id"], lesson.as_str());
        // Roles: a publisher cannot approve, a reviewer cannot publish.
        let approve = json!({"lesson_id": lesson});
        assert_eq!(
            call(
                addr,
                Some("publisher-token-001"),
                "hub.approve",
                approve.clone()
            )
            .1["error"]["code"],
            "forbidden"
        );
        let (_, a) = call(addr, Some("reviewer-token-0001"), "hub.approve", approve);
        assert_eq!(a["result"]["approver"], "Reviewer A");
        assert_eq!(
            call(addr, Some("reviewer-token-0001"), "hub.publish", json!({})).1["error"]["code"],
            "forbidden"
        );
        assert_eq!(
            call(addr, Some("publisher-token-001"), "hub.publish", json!({})).1["result"]["seq"],
            1
        );
        let keys = [f.hub.lock().unwrap().trusted_key()];
        let p = rec.pull(&link, &keys).unwrap();
        assert_eq!(p.installed, [1]);
        assert!(p.fleet_updated && p.fleet_bytes > 0, "{p:?}");
        // Every action names who did it, in the hub's chain.
        let (_, audit) = call(addr, Some("admin-token-0000001"), "hub.audit", json!({}));
        let text = audit.to_string();
        for who in ["Admin Z", "Reviewer A", "Publisher P"] {
            assert!(text.contains(who), "{who} in the audit");
        }
        // Revoked: nothing more is accepted.
        call(
            addr,
            Some("admin-token-0000001"),
            "hub.revoke",
            json!({"device_id": k.device_id(), "reason": "lost tablet"}),
        );
        fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
        let r = rec
            .flush(
                &LinkTransport {
                    link: &link,
                    keys: &hub_keys(&f),
                },
                50,
            )
            .unwrap();
        assert_eq!(r.acked, 0);
        assert_eq!(rec.outbox_status().unwrap().pending, 2);
        running.stop();
    }
}

#[test]
fn unenrolled_revoked_and_forged_deliveries_are_refused() {
    let f = fleet();
    let hub = f.hub.lock().unwrap();
    let (rec, _) = (Records::in_memory().unwrap(), ());
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&f.pack), &reg).unwrap();
    drop(hub);
    fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    let items = rec.pending(10).unwrap();
    let hub = f.hub.lock().unwrap();
    let stranger = key(50);
    assert!(matches!(
        hub.receive(&stranger.deliver(&items).unwrap()),
        Err(Error::Signature(_))
    ));
    let k = key(51);
    hub.enroll(&k.public_base64(), None, "Admin").unwrap();
    // Signed by another key in this device's name.
    let mut forged = stranger.deliver(&items).unwrap();
    forged.device_id = k.device_id();
    assert!(matches!(hub.receive(&forged), Err(Error::Signature(_))));
    // An item swapped after signing.
    let mut swapped = k.deliver(&items).unwrap();
    swapped.items[0].payload_sha256 = "0".repeat(64);
    assert!(matches!(hub.receive(&swapped), Err(Error::Signature(_))));
    assert_eq!(hub.receive(&k.deliver(&items).unwrap()).unwrap().stored, 2);
    hub.revoke(&k.device_id(), "Admin", Some("lost")).unwrap();
    assert!(matches!(
        hub.receive(&k.deliver(&items).unwrap()),
        Err(Error::Signature(_))
    ));
    assert!(
        matches!(
            hub.enroll(&k.public_base64(), None, "Admin"),
            Err(Error::Invalid(_))
        ),
        "a revoked key stays revoked"
    );
    let refusals = hub
        .audit_records()
        .unwrap()
        .into_iter()
        .filter(|r| matches!(r, harvest_core::audit::AuditRecord::Event { event, .. } if event.event == "hub.refuse"))
        .count();
    // Stranger, revoked, and two forgeries with the same error: the second
    // forgery within the hour is not written again.
    assert_eq!(refusals, 3);
    assert_eq!(hub.status().unwrap().items, 2);
}

#[test]
fn the_fleet_summary_moves_only_when_it_changes() {
    let f = fleet();
    let (rec, link) = device(&f);
    let l = fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    rec.flush(
        &LinkTransport {
            link: &link,
            keys: &hk(&link),
        },
        50,
    )
    .unwrap();
    let keys = [f.hub.lock().unwrap().trusted_key()];
    {
        let hub = f.hub.lock().unwrap();
        hub.approve(&l, "Reviewer A", None, None, None).unwrap();
        let b = hub.publish(false, "Publisher A").unwrap().unwrap();
        assert!(b.get("fleet").is_none(), "bundles carry only the hash");
        assert!(b["fleet_sha256"].is_string());
    }
    let p1 = rec.pull(&link, &keys).unwrap();
    assert!(p1.fleet_updated && p1.fleet_bytes > 0);
    assert_eq!(rec.fleet_summary().unwrap().unwrap().jobs[0].jobs, 1);
    // Nothing changed in the fleet: the next bundle announces the same hash.
    f.hub.lock().unwrap().publish(true, "Publisher A").unwrap();
    let p2 = rec.pull(&link, &keys).unwrap();
    assert_eq!(p2.installed, [2]);
    assert_eq!((p2.fleet_updated, p2.fleet_bytes), (false, 0));
    // A fleet document that does not match its hash is refused.
    let mut doc = f.hub.lock().unwrap().fleet_document().unwrap().unwrap();
    doc["summary"]["units"] = json!(99);
    assert!(rec.install_fleet(&doc, &keys).is_err());
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
    s.forge_prob = 0.2;
    s.rogue_device = true;
    s.revoke = vec![harvest_core::sim::ScriptedRevoke {
        device: 2,
        day: 2.0,
    }];
    s.photos = Some(harvest_core::sim::PhotoSpec {
        per_lesson: 1.0,
        median_kb: 400.0,
        sigma: 0.5,
        small_ratio: 0.08,
        byte_scale: 100,
    });
    let m = harvest_core::sim::run(&s, None).unwrap();
    assert!(m.invariants.ok, "{:#?}", m.invariants);
    // Someone on the link forged receipts, hello replies and `held`:
    // nothing was marked sent that the hub does not hold.
    assert!(m.link.forged_replies > 20, "{}", m.link.forged_replies);
    assert!(m.invariants.nothing_lost && m.invariants.no_attachment_marked_sent_without_hub);
    assert_eq!(m.delivery.lost, 0);
    assert!(
        m.delivery.delivered_of_deliverable > 0.99,
        "{:?}",
        m.delivery
    );
    assert!(m.link.failed_requests > 0 && m.link.duplicates_suppressed > 0);
    assert!(m.bundles.tampered_in_transit > 0);
    assert_eq!(
        m.bundles.refused, m.bundles.tampered_in_transit,
        "every tampered bundle refused"
    );
    assert_eq!(m.conflicts.len(), 1);
    assert!(m.invariants.no_upload_from_unenrolled_or_revoked);
    assert!(m.link.refused_hellos > 0, "the rogue device tried");
    assert!(m.invariants.refused_traffic_bounded);
    assert!(
        m.bytes.refused > 0 && m.bytes.refused < 100_000,
        "{}",
        m.bytes.refused
    );
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
    assert_eq!(m.delivery.delivered_of_captured, 1.0);
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

#[test]
fn edits_within_the_clock_skew_bound_wait_for_a_reviewer() {
    let f = fleet();
    let (_a, ua) = lesson_upload(&f, None, "Weed in the strainer", "2026-03-01T10:00");
    let id = serde_json::from_str::<serde_json::Value>(&ua[0].payload).unwrap()["lesson_id"]
        .as_str()
        .unwrap()
        .to_string();
    let (_b, ub) = lesson_upload(&f, Some(&id), "Silt in the strainer", "2026-03-01T10:12");
    let h = Hub::in_memory(hub_key(), "s")
        .unwrap()
        .with_skew_bound_minutes(20);
    let (ka, kb) = (key(1), key(2));
    recv(&h, &ka, &ua);
    recv(&h, &kb, &ub);
    let q = h.queue(Some("pending")).unwrap();
    assert!(q[0].needs_reviewer);
    let c = &h.conflicts().unwrap()[0];
    assert_eq!(c.class, "needs_reviewer");
    // The clocks cannot order them: approving needs a chosen version.
    assert!(matches!(
        h.approve(&id, "Reviewer A", None, None, None),
        Err(Error::Invalid(_))
    ));
    let pick = q[0]
        .versions
        .iter()
        .find(|v| v.lesson.cause == "Weed in the strainer")
        .unwrap()
        .item_id
        .clone();
    let n = h
        .approve(&id, "Reviewer A", None, None, Some(&pick))
        .unwrap();
    assert!(n.text.contains("Weed in the strainer"));
    let c = &h.conflicts().unwrap()[0];
    assert_eq!(c.resolved_by.as_deref(), Some("Reviewer A"));
    assert_eq!(
        h.queue(None).unwrap()[0].current.cause,
        "Weed in the strainer"
    );
    // Outside the bound the rule decides.
    let h2 = Hub::in_memory(hub_key(), "s")
        .unwrap()
        .with_skew_bound_minutes(5);
    recv(&h2, &ka, &ua);
    recv(&h2, &kb, &ub);
    assert_eq!(h2.conflicts().unwrap()[0].class, "auto");
    assert!(!h2.queue(None).unwrap()[0].needs_reviewer);
}

#[test]
fn a_refused_device_sends_only_hellos_and_backs_off() {
    let f = fleet();
    let rec = Records::in_memory().unwrap();
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&f.pack), &reg).unwrap();
    let k = key(60);
    let pk = k.public_base64();
    let link = LocalLink {
        hub: f.hub.clone(),
        key: k,
        link: Default::default(),
    };
    fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    harvest_core::audit::set_clock(Some(ms("2026-03-01T10:00")));
    let r = rec.flush_to_hub(&link, &hk(&link), 50, false).unwrap();
    assert_eq!(
        r.hello.as_ref().unwrap().refused,
        Some(harvest_core::sync::Refusal::Unenrolled)
    );
    assert!(r.flush.is_none(), "no payload after a refusal");
    let st = rec.sync_state().unwrap();
    assert_eq!(
        (st.reachable, st.refused),
        (Some(true), Some(harvest_core::sync::Refusal::Unenrolled))
    );
    // Within the back-off nothing at all is sent.
    harvest_core::audit::set_clock(Some(ms("2026-03-01T10:02")));
    assert!(
        rec.flush_to_hub(&link, &hk(&link), 50, false)
            .unwrap()
            .skipped_until
            .is_some()
    );
    // The back-off doubles.
    harvest_core::audit::set_clock(Some(ms("2026-03-01T10:06")));
    let r2 = rec.flush_to_hub(&link, &hk(&link), 50, false).unwrap();
    assert!(r2.hello.is_some());
    let until = r2.skipped_until.unwrap();
    assert!(until.starts_with("2026-03-01T10:16"), "{until}");
    // Once enrolled, a forced try goes through at once.
    f.hub.lock().unwrap().enroll(&pk, None, "Admin").unwrap();
    let r3 = rec.flush_to_hub(&link, &hk(&link), 50, true).unwrap();
    assert_eq!(r3.flush.unwrap().acked, 2);
    assert_eq!(rec.sync_state().unwrap().refused, None);
    harvest_core::audit::set_clock(None);
    let refusals = f
        .hub
        .lock()
        .unwrap()
        .audit_records()
        .unwrap()
        .into_iter()
        .filter(|r| matches!(r, harvest_core::audit::AuditRecord::Event { event, .. } if event.event == "hub.refuse"))
        .count();
    assert_eq!(
        refusals, 1,
        "two hellos refused within the hour: audited once; no deliveries"
    );
}

// --------------------------------------------------------- attachments

fn photo(n: usize, seed: u8) -> Vec<u8> {
    (0..n).map(|i| (i as u8).wrapping_mul(31) ^ seed).collect()
}

#[test]
fn attachments_move_by_content_resume_and_follow_the_link_policy() {
    use harvest_core::sync::{AttachmentMode, LinkClass};
    let f = fleet();
    f.hub.lock().unwrap().set_attachment_policy(
        AttachmentMode::Downscaled,
        AttachmentMode::Full,
        1024,
    );
    let (rec, normal) = device(&f);
    let low = LocalLink {
        hub: f.hub.clone(),
        key: DeviceKey::from_seed(&normal.key.seed()),
        link: LinkClass::Low,
    };
    let full = photo(5000, 1);
    let small = photo(300, 2);
    let r = rec
        .add_attachment(&full, "image/jpeg", Some(&small))
        .unwrap();
    // The same bytes again: one attachment.
    assert_eq!(rec.add_attachment(&full, "image/jpeg", None).unwrap(), r);
    assert_eq!(rec.attachments().unwrap().len(), 1);
    assert_eq!(rec.attachment_bytes(&r.sha256, "full").unwrap(), full);

    // Records first: nothing moves while the outbox holds anything.
    fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    assert!(rec.outbox_status().unwrap().pending > 0);
    let rep = rec
        .send_attachments(&normal, &hk(&normal), &|| false)
        .unwrap();
    assert!(rep.yielded && rep.chunks == 0);
    rec.flush_to_hub(&normal, &hk(&normal), 50, false).unwrap();
    assert_eq!(rec.outbox_status().unwrap().pending, 0);

    // A low link sends the downscaled copy only.
    let rep = rec.send_attachments(&low, &hk(&low), &|| false).unwrap();
    assert_eq!(rep.mode, Some(AttachmentMode::Downscaled));
    assert_eq!(rep.bytes, 300);
    let small_sha = rec.attachments().unwrap()[0].small_sha256.clone().unwrap();
    assert!(f.hub.lock().unwrap().has_attachment(&small_sha).unwrap());
    assert!(!f.hub.lock().unwrap().has_attachment(&r.sha256).unwrap());
    assert_eq!(
        rec.attachment_backlog(AttachmentMode::Downscaled).unwrap(),
        0
    );
    assert_eq!(rec.attachment_backlog(AttachmentMode::Full).unwrap(), 5000);
    let st = rec.attachment_status().unwrap();
    assert_eq!(st.mode, Some(AttachmentMode::Downscaled));
    assert_eq!(
        (st.pending, st.pending_bytes, st.sent, st.sent_downscaled),
        (0, 0, 0, 1)
    );
    assert!(st.last_attempt_at.is_some() && st.failing.is_none());

    // On a normal link the full file follows, cut short and resumed.
    let calls = std::cell::Cell::new(0);
    let rep = rec
        .send_attachments(&normal, &hk(&normal), &|| {
            calls.set(calls.get() + 1);
            calls.get() > 4
        })
        .unwrap();
    assert!(rep.yielded && rep.chunks == 2, "{rep:?}");
    assert_eq!(
        f.hub
            .lock()
            .unwrap()
            .attachment_offset(&r.sha256, 5000)
            .unwrap(),
        2048
    );
    let rep = rec
        .send_attachments(&normal, &hk(&normal), &|| false)
        .unwrap();
    assert_eq!(
        (rep.resumed, rep.resumed_bytes, rep.bytes),
        (1, 2048, 5000 - 2048)
    );
    assert!(f.hub.lock().unwrap().has_attachment(&r.sha256).unwrap());
    assert_eq!(rec.attachments().unwrap()[0].sent, "full");
    assert_eq!(rec.attachment_backlog(AttachmentMode::Full).unwrap(), 0);

    // Another device with the same file sends nothing: the hub has it.
    let (rec2, link2) = device(&f);
    rec2.add_attachment(&full, "image/jpeg", None).unwrap();
    let rep = rec2
        .send_attachments(&link2, &hk(&link2), &|| false)
        .unwrap();
    assert_eq!((rep.chunks, rep.completed), (0, 1));

    // References only: nothing moves.
    f.hub
        .lock()
        .unwrap()
        .set_attachment_policy(AttachmentMode::Refs, AttachmentMode::Refs, 1024);
    rec.add_attachment(&photo(900, 9), "image/jpeg", None)
        .unwrap();
    let rep = rec
        .send_attachments(&normal, &hk(&normal), &|| false)
        .unwrap();
    assert_eq!(
        (rep.mode, rep.chunks, rep.backlog_bytes),
        (Some(AttachmentMode::Refs), 0, 0)
    );
}

#[test]
fn the_hub_refuses_chunks_from_strangers_and_out_of_place_or_damaged() {
    let f = fleet();
    let h = f.hub.lock().unwrap();
    let data = photo(100, 3);
    let sha = {
        use sha2::Digest;
        sha2::Sha256::digest(&data)
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    };
    let stranger = key(77);
    let c = stranger.chunk(&sha, "full", 100, 0, &data).unwrap();
    assert!(matches!(h.put_chunk(&c), Err(Error::Signature(_))));
    let k = key(78);
    h.enroll(&k.public_base64(), None, "Admin").unwrap();
    // A forged chunk (data changed after signing).
    let mut bad = k.chunk(&sha, "full", 100, 0, &data[..50]).unwrap();
    bad.data = k.chunk(&sha, "full", 100, 0, &data[50..]).unwrap().data;
    assert!(matches!(h.put_chunk(&bad), Err(Error::Signature(_))));
    // Out of place: the hub answers where it is.
    assert_eq!(
        h.put_chunk(&k.chunk(&sha, "full", 100, 50, &data[50..]).unwrap())
            .unwrap(),
        0
    );
    // Bytes that do not hash to the name are dropped whole.
    let wrong = photo(100, 4);
    assert_eq!(
        h.put_chunk(&k.chunk(&sha, "full", 100, 0, &wrong).unwrap())
            .unwrap(),
        0
    );
    assert!(!h.has_attachment(&sha).unwrap());
    assert_eq!(
        h.put_chunk(&k.chunk(&sha, "full", 100, 0, &data[..60]).unwrap())
            .unwrap(),
        60
    );
    assert_eq!(
        h.put_chunk(&k.chunk(&sha, "full", 100, 60, &data[60..]).unwrap())
            .unwrap(),
        100
    );
    assert!(h.has_attachment(&sha).unwrap());
    assert!(h.verify_audit().unwrap().ok);
}

#[test]
fn underway_attachment_traffic_never_delays_a_record() {
    let s = harvest_core::sim::named("underway-two-weeks").unwrap();
    let m = harvest_core::sim::run(&s, None).unwrap();
    let a = m.attachments.as_ref().unwrap();
    assert!(m.invariants.ok, "{:?}", m.invariants.details);
    assert!(a.never_delayed_a_record && m.invariants.attachments_never_delay_records);
    assert_eq!(a.records_latency_with, a.records_latency_without);
    assert!(
        a.photos > 0 && a.full_at_hub == a.photos,
        "every photo in full after port"
    );
    // Underway the downscaled copies keep up; the full files wait.
    let mid = &a.backlog[a.backlog.len() / 2];
    assert!(mid.full_bytes > 10 * mid.downscaled_bytes);
    assert_eq!(a.backlog.last().unwrap().full_bytes, 0);
}

#[test]
fn the_queue_carries_the_note_an_unedited_approval_publishes() {
    let f = fleet();
    let h = Hub::in_memory(hub_key(), "s").unwrap();
    let (_a, ua) = lesson_upload(&f, None, "Weed in the strainer.", "2026-03-01T10:00");
    recv(&h, &key(9), &ua);
    let item = h.queue(Some("pending")).unwrap().remove(0);
    assert_eq!(
        item.suggested_note,
        format!(
            "Verified cause: Weed in the strainer. Corrective action: {}.",
            item.current.action.trim_end_matches('.')
        )
    );
    assert_eq!(item.suggested_scope.equip_id, item.current.equip_id);
    h.approve(&item.lesson_id, "Reviewer A", None, None, None)
        .unwrap();
    let b = h.publish(false, "Reviewer A").unwrap().unwrap();
    assert_eq!(b["notes"][0]["text"], item.suggested_note);
}

#[test]
fn refusals_are_audited_once_an_hour_and_only_for_plausible_ids() {
    let h = Hub::in_memory(hub_key(), "s").unwrap();
    let audit_len = |h: &Hub| h.audit_records().unwrap().len();
    let before = audit_len(&h);
    let stranger = key(55);
    for _ in 0..5 {
        assert!(
            !h.hello(&stranger.hello(Default::default()).unwrap())
                .unwrap()
                .accepted
        );
    }
    assert_eq!(audit_len(&h), before + 1, "one row for five refusals");
    let mut junk = stranger.hello(Default::default()).unwrap();
    junk.device_id = "x".repeat(10_000);
    assert!(!h.hello(&junk).unwrap().accepted);
    assert_eq!(
        audit_len(&h),
        before + 1,
        "an implausible id is not written"
    );
}

#[test]
fn a_device_pulls_by_the_hubs_own_stream() {
    let f = fleet();
    *f.hub.lock().unwrap() = Hub::in_memory(hub_key(), "fleet-b").unwrap();
    let (rec, link) = device(&f);
    // A bundle from another stream, at a high seq, installed by hand.
    let other = fixture_maint::field_bundle(40).unwrap();
    rec.install_field_bundle(&other, &[fixture::trusted_key()])
        .unwrap();
    assert_eq!(rec.installed_bundle_seq().unwrap(), 40);
    // The hub's stream is at seq 1; the device still gets it.
    let (_a, ua) = lesson_upload(&f, None, "Weed in the strainer.", "2026-03-01T10:00");
    {
        let h = f.hub.lock().unwrap();
        recv(&h, &key(60), &ua);
        let id = h.queue(Some("pending")).unwrap()[0].lesson_id.clone();
        h.approve(&id, "Reviewer A", None, None, None).unwrap();
        h.publish(false, "Reviewer A").unwrap().unwrap();
    }
    let keys = vec![f.hub.lock().unwrap().trusted_key()];
    let p = rec.pull(&link, &keys).unwrap();
    assert_eq!(p.installed, vec![1], "{p:?}");
    // And not twice.
    assert!(rec.pull(&link, &keys).unwrap().installed.is_empty());
}

/// A link that strips or replaces the hub's signatures.
struct Forger {
    inner: LocalLink,
    /// Sign with this key instead of passing the hub's signature through.
    key: Option<ed25519_dalek::SigningKey>,
}

impl Forger {
    fn resign<T: serde::Serialize>(&self, t: &T) -> Option<serde_json::Value> {
        self.key
            .as_ref()
            .map(|k| harvest_core::sync::hub_sign(t, k).unwrap())
    }
}

impl HubLink for Forger {
    fn device_id(&self) -> String {
        self.inner.device_id()
    }
    fn send(&self, batch: &[Upload]) -> harvest_core::Result<harvest_core::sync::ReceiptSet> {
        let mut r = self.inner.send(batch)?;
        r.signature = self.resign(&r);
        Ok(r)
    }
    fn bundles_since(&self, since: u64) -> harvest_core::Result<Vec<serde_json::Value>> {
        self.inner.bundles_since(since)
    }
    fn pack_offer(
        &self,
        pack_id: &str,
        have: Option<&str>,
    ) -> harvest_core::Result<Option<harvest_core::sync::PackOffer>> {
        self.inner.pack_offer(pack_id, have)
    }
    fn fetch(
        &self,
        offer: &harvest_core::sync::PackOffer,
        path: &str,
    ) -> harvest_core::Result<Vec<u8>> {
        self.inner.fetch(offer, path)
    }
    fn fleet(&self) -> harvest_core::Result<Option<serde_json::Value>> {
        self.inner.fleet()
    }
    fn hello(&self) -> harvest_core::Result<harvest_core::sync::HelloReply> {
        let mut r = self.inner.hello()?;
        r.signature = self.resign(&r);
        Ok(r)
    }
    fn public_key(&self) -> String {
        self.inner.public_key()
    }
    fn attachment_offset(
        &self,
        sha256: &str,
        total: u64,
    ) -> harvest_core::Result<harvest_core::sync::Held> {
        let mut h = self.inner.attachment_offset(sha256, total)?;
        h.held = total;
        h.signature = self.resign(&h);
        Ok(h)
    }
    fn put_chunk(
        &self,
        sha256: &str,
        variant: &str,
        total: u64,
        offset: u64,
        data: &[u8],
    ) -> harvest_core::Result<harvest_core::sync::Held> {
        let mut h = self.inner.put_chunk(sha256, variant, total, offset, data)?;
        h.signature = self.resign(&h);
        Ok(h)
    }
}

#[test]
fn a_device_acts_only_on_replies_the_hub_signed() {
    let f = fleet();
    let (rec, link) = device(&f);
    let keys = hk(&link);
    fixed_job(&f, &rec, "unit-101", "Replaced relay K1");
    rec.add_attachment(&photo(3000, 7), "image/jpeg", None)
        .unwrap();
    for key in [
        None,
        Some(ed25519_dalek::SigningKey::from_bytes(&[0x66; 32])),
    ] {
        let forger = Forger {
            inner: LocalLink {
                hub: f.hub.clone(),
                key: DeviceKey::from_seed(&link.key.seed()),
                link: Default::default(),
            },
            key,
        };
        // The hub stores the items, but the receipts do not verify: the
        // device keeps them queued (they go again, as duplicates).
        let r = rec.flush_to_hub(&forger, &keys, 50, true).unwrap();
        assert!(r.hello.is_none() && r.error.is_some(), "{r:?}");
        let r = rec
            .flush(
                &LinkTransport {
                    link: &forger,
                    keys: &keys,
                },
                50,
            )
            .unwrap();
        assert_eq!(r.acked, 0, "{r:?}");
        assert!(rec.outbox_status().unwrap().pending > 0);
    }
    // The real hub's receipts do.
    let r = rec.flush_to_hub(&link, &keys, 50, false).unwrap();
    assert!(r.flush.unwrap().acked > 0);
    assert_eq!(rec.outbox_status().unwrap().pending, 0);
    // A forged "you have it all" for a file the hub never got: not marked sent.
    let forger = Forger {
        inner: LocalLink {
            hub: f.hub.clone(),
            key: DeviceKey::from_seed(&link.key.seed()),
            link: Default::default(),
        },
        key: Some(ed25519_dalek::SigningKey::from_bytes(&[0x66; 32])),
    };
    let rep = rec.send_attachments(&forger, &keys, &|| false).unwrap();
    assert_eq!(rep.completed, 0, "{rep:?}");
    assert_eq!(rec.attachments().unwrap()[0].sent, "none");
    // A reply for another device does not count either.
    let other = harvest_core::sync::verify_hub_reply(
        &f.hub
            .lock()
            .unwrap()
            .held_for("dev-00", &"a".repeat(64), 10)
            .unwrap(),
        harvest_core::sync::HELD_FORMAT,
        &link.device_id(),
        &keys,
    );
    assert!(other.is_err());
}
