//! Device records for troubleshooting: assets, jobs walked by code,
//! audited corrections, lessons, field notes, the repeat flag, and the API
//! and HTTP transport over them.

use harvest_core::api::{self, Host};
use harvest_core::fixture::{self, signing_key};
use harvest_core::fixture_maint;
use harvest_core::maint::search::Observation;
use harvest_core::records::{
    AssetRegistry, EntryKind, JobAnswer, JobClose, JobStart, LessonFilter, LessonInput,
    LessonStatus, Records, ResolutionKind,
};
use harvest_core::sync::DirTransport;
use harvest_core::{Error, Pack};
use serde_json::{Value, json};
use std::sync::Arc;

struct Env {
    _tmp: tempfile::TempDir,
    dir: std::path::PathBuf,
    pack: Arc<Pack>,
    rec: Records,
}

fn env() -> Env {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build(&dir, "2026.3.1-1").unwrap();
    let pack = Arc::new(Pack::open(&dir, &[fixture::trusted_key()]).unwrap());
    let rec = Records::in_memory().unwrap();
    let reg: AssetRegistry = serde_json::from_value(fixture_maint::asset_registry()).unwrap();
    rec.import_assets(Some(&pack), &reg).unwrap();
    Env {
        _tmp: tmp,
        dir,
        pack,
        rec,
    }
}

fn start(e: &Env, s: JobStart) -> harvest_core::records::Job {
    e.rec.start_job(&e.pack, &s).unwrap()
}

fn ans(node: &str, outcome: &str) -> JobAnswer {
    JobAnswer {
        node_id: node.into(),
        outcome: Some(outcome.into()),
        ..Default::default()
    }
}

fn val(node: &str, v: f64) -> JobAnswer {
    JobAnswer {
        node_id: node.into(),
        value: Some(v),
        unit: Some("V".into()),
        ..Default::default()
    }
}

fn symptom_job(e: &Env, asset: &str) -> harvest_core::records::Job {
    start(
        e,
        JobStart {
            symptom_id: Some("s-nocrank".into()),
            asset_id: Some(asset.into()),
            level: "technician".into(),
            query: Some("nothing happens when I turn the key".into()),
            ..Default::default()
        },
    )
}

#[test]
fn a_job_walks_the_tree_by_the_recorded_results() {
    let e = env();
    let job = symptom_job(&e, "unit-101");
    assert_eq!(job.entered_by, EntryKind::Symptom);
    assert_eq!(
        job.equip_id.as_deref(),
        Some("pump40-diesel"),
        "from the asset"
    );
    assert_eq!(job.current_node, "nc.0");
    let id = job.job_id.clone();
    let at = |a: JobAnswer| e.rec.answer_job(&e.pack, &id, &a).unwrap().current_node;
    assert_eq!(at(ans("nc.0", "done")), "nc.1");
    assert_eq!(at(ans("nc.1", "yes")), "nc.2");
    assert_eq!(at(val("nc.2", 12.1)), "nc.2b");
    assert_eq!(at(ans("nc.2b", "done")), "nc.2", "the retry loop back");
    assert_eq!(at(val("nc.2", 12.7)), "nc.3");
    assert_eq!(at(ans("nc.3", "yes")), "nc.4");
    assert_eq!(at(ans("nc.4", "fail")), "nc.4f");
    let j = e.rec.job(&id).unwrap().unwrap();
    assert_eq!(j.steps.len(), 7);
    assert_eq!(j.steps[2].label, "11.5 V to 12.5 V");
    // The end of the path records nothing.
    assert!(matches!(
        e.rec.answer_job(&e.pack, &id, &ans("nc.4f", "done")),
        Err(Error::Invalid(_))
    ));
}

#[test]
fn a_stale_or_unfit_answer_is_refused_and_changes_nothing() {
    let e = env();
    let job = symptom_job(&e, "unit-101");
    let id = &job.job_id;
    e.rec.answer_job(&e.pack, id, &ans("nc.0", "done")).unwrap();
    // The same submit again (the job is no longer at nc.0).
    assert!(matches!(
        e.rec.answer_job(&e.pack, id, &ans("nc.0", "done")),
        Err(Error::Invalid(_))
    ));
    assert!(matches!(
        e.rec.answer_job(&e.pack, id, &ans("nc.1", "perhaps")),
        Err(Error::Invalid(_))
    ));
    assert!(matches!(
        e.rec.answer_job(&e.pack, id, &val("nc.1", 3.0)),
        Err(Error::Invalid(_))
    ));
    let j = e.rec.job(id).unwrap().unwrap();
    assert_eq!(j.steps.len(), 1);
    assert_eq!(j.current_node, "nc.1");
}

#[test]
fn going_back_keeps_the_superseded_answer_and_audits_it() {
    let e = env();
    let job = symptom_job(&e, "unit-101");
    let id = &job.job_id;
    for a in [
        ans("nc.0", "done"),
        ans("nc.1", "yes"),
        val("nc.2", 13.0),
        ans("nc.3", "no"),
    ] {
        e.rec.answer_job(&e.pack, id, &a).unwrap();
    }
    assert_eq!(e.rec.job(id).unwrap().unwrap().current_node, "nc.3n");
    let back = e.rec.back_job(&e.pack, id).unwrap();
    assert_eq!(back.current_node, "nc.3");
    let fixed = e.rec.answer_job(&e.pack, id, &ans("nc.3", "yes")).unwrap();
    assert_eq!(fixed.current_node, "nc.4");
    assert_eq!(fixed.steps.len(), 5, "the superseded step is kept");
    let superseded: Vec<_> = fixed
        .steps
        .iter()
        .filter(|s| s.superseded_at.is_some())
        .collect();
    assert_eq!(superseded.len(), 1);
    assert_eq!(superseded[0].outcome.as_deref(), Some("no"));
    assert_eq!(fixed.path().len(), 4);
    // Audit: start, five answers, one back; the chain verifies.
    let events: Vec<String> = harvest_core::audit::records_with(e.rec.conn(), None)
        .unwrap()
        .into_iter()
        .filter_map(|r| match r {
            harvest_core::audit::AuditRecord::Event { event, .. } if event.subject == *id => {
                Some(event.event)
            }
            _ => None,
        })
        .collect();
    assert_eq!(
        events,
        [
            "job.start",
            "job.answer",
            "job.answer",
            "job.answer",
            "job.answer",
            "job.back",
            "job.answer"
        ]
    );
    let chain = e.rec.verify_audit().unwrap();
    assert!(chain.ok);
    assert_eq!(chain.events["job.answer"], 5);
    // The answer entry names the node, its verbatim text, the result, the next node and the pack version.
    let all = harvest_core::audit::records_with(e.rec.conn(), None).unwrap();
    let harvest_core::audit::AuditRecord::Event { event, .. } = &all[all.len() - 1] else {
        panic!()
    };
    assert_eq!(event.node_id.as_deref(), Some("nc.3"));
    assert!(
        event
            .asked
            .as_deref()
            .unwrap()
            .starts_with("Is more than 10 V present")
    );
    assert_eq!(event.next_node.as_deref(), Some("nc.4"));
    assert_eq!(event.pack_version.as_deref(), Some("2026.3.1-1"));
    assert_eq!(event.result.as_ref().unwrap()["outcome"], "yes");
}

#[test]
fn jobs_enter_from_signals_or_a_chosen_tree_for_the_variant() {
    let e = env();
    let sig = start(
        &e,
        JobStart {
            signals: vec![Observation {
                signal_kind: Some("pump40.code".into()),
                value: "E21".into(),
            }],
            asset_id: Some("unit-201".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    assert_eq!(sig.entered_by, EntryKind::Signals);
    assert_eq!(
        (sig.tree_id.as_str(), sig.current_node.as_str()),
        ("t-hot", "oh.1")
    );
    assert_eq!(sig.signals.len(), 1);
    let chosen = start(
        &e,
        JobStart {
            tree_id: Some("t-hot".into()),
            equip_id: Some("pump40-electric".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    assert_eq!(chosen.entered_by, EntryKind::Chosen);
    assert_eq!(chosen.current_node, "oh.0");
    // The diesel tree does not apply to an electric unit.
    let refused = e.rec.start_job(
        &e.pack,
        &JobStart {
            tree_id: Some("t-nocrank".into()),
            asset_id: Some("unit-201".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    assert!(matches!(refused, Err(Error::Invalid(_))));
    let no_level = e.rec.start_job(
        &e.pack,
        &JobStart {
            tree_id: Some("t-hot".into()),
            level: "operator".into(),
            ..Default::default()
        },
    );
    assert!(
        matches!(no_level, Err(Error::Invalid(_))),
        "levels are the pack's"
    );
    let nothing = e.rec.start_job(
        &e.pack,
        &JobStart {
            level: "expert".into(),
            ..Default::default()
        },
    );
    assert!(matches!(nothing, Err(Error::Invalid(_))));
}

#[test]
fn a_job_is_held_to_its_tree_as_it_began() {
    let e = env();
    let job = symptom_job(&e, "unit-101");
    e.rec
        .answer_job(&e.pack, &job.job_id, &ans("nc.0", "done"))
        .unwrap();
    // A newer pack changes the voltage bands.
    let dir2 = e.dir.with_file_name("pump40-v2");
    fixture_maint::build_with(&dir2, "2026.3.2-1", |c| {
        c.execute_batch(r#"UPDATE fault_edge SET cond = '{"op":"<","value":11.8}' WHERE from_node = 'nc.2' AND ord = 1;
                           UPDATE fault_edge SET cond = '{"op":"between","min":11.8,"max":12.5}' WHERE from_node = 'nc.2' AND ord = 2;"#)?;
        Ok(())
    })
    .unwrap();
    let p2 = Pack::open(&dir2, &[fixture::trusted_key()]).unwrap();
    assert!(harvest_core::maint::graph::validate(&p2).unwrap().ok);
    let r = e.rec.answer_job(&p2, &job.job_id, &ans("nc.1", "yes"));
    assert!(matches!(r, Err(Error::Invalid(m)) if m.contains("changed")));
    let v = e.rec.job_view(&p2, &job.job_id, None).unwrap();
    assert!(v.tree_changed && v.step.is_none());
    // The same pack version keeps working, and the job can still be closed.
    e.rec
        .answer_job(&e.pack, &job.job_id, &ans("nc.1", "yes"))
        .unwrap();
    e.rec
        .close_job(
            &p2,
            &job.job_id,
            &JobClose {
                resolution: ResolutionKind::Unresolved,
                note: None,
                lesson: None,
            },
        )
        .unwrap();
}

#[test]
fn closing_queues_the_job_report_and_the_lesson() {
    let e = env();
    let job = symptom_job(&e, "unit-102");
    let id = job.job_id.clone();
    for a in [
        ans("nc.0", "done"),
        ans("nc.1", "yes"),
        val("nc.2", 12.9),
        ans("nc.3", "yes"),
        ans("nc.4", "fail"),
    ] {
        e.rec.answer_job(&e.pack, &id, &a).unwrap();
    }
    let (closed, lesson) = e
        .rec
        .close_job(
            &e.pack,
            &id,
            &JobClose {
                resolution: ResolutionKind::Fixed,
                note: Some("ran 20 minutes after".into()),
                lesson: Some(LessonInput {
                    cause: "Relay K1 contacts burnt".into(),
                    action: "Replaced relay K1".into(),
                    parts: vec![
                        serde_json::from_value(
                            json!({"text": "Relay K1", "ident": "40-221", "qty": "1"}),
                        )
                        .unwrap(),
                    ],
                    minutes: Some(35),
                    submit: true,
                    ..Default::default()
                }),
            },
        )
        .unwrap();
    assert_eq!(closed.status, "closed");
    let lesson = lesson.unwrap();
    assert_eq!(lesson.node_id.as_deref(), Some("nc.4f"));
    assert_eq!(lesson.tree_id.as_deref(), Some("t-nocrank"));
    assert_eq!(lesson.symptom_id.as_deref(), Some("s-nocrank"));
    assert_eq!(lesson.level.as_deref(), Some("technician"));
    assert_eq!(lesson.status, LessonStatus::Queued);
    let pending = e.rec.pending(10).unwrap();
    let kinds: Vec<&str> = pending.iter().map(|u| u.kind.as_str()).collect();
    assert_eq!(kinds, ["lesson", "job"]);
    let report = pending[1].payload_json().unwrap();
    assert_eq!(report["format"], "harvest-job/1");
    assert_eq!(report["serial"], "P40D-3115");
    assert_eq!(report["steps"].as_array().unwrap().len(), 5);
    assert_eq!(
        report["steps"][2]["text"],
        "What is the battery voltage at terminals B+ and B- with the key OFF?"
    );
    assert_eq!(report["resolution"]["kind"], "fixed");
    assert_eq!(report["lesson_ids"][0], lesson.lesson_id.as_str());
    assert_eq!(
        pending[0].payload_json().unwrap()["format"],
        "harvest-lesson/1"
    );
    // Closed is closed.
    assert!(matches!(
        e.rec.answer_job(&e.pack, &id, &ans("nc.4f", "done")),
        Err(Error::Invalid(_))
    ));
    // Upload: the lesson reads as uploaded once its receipt came back.
    let out = tempfile::tempdir().unwrap();
    let r = e.rec.flush(&DirTransport::new(out.path()), 10).unwrap();
    assert_eq!(r.acked, 2);
    let ls = e.rec.lessons(&LessonFilter::default()).unwrap();
    assert_eq!(ls[0].status, LessonStatus::Uploaded);
    // A lesson kept on the device is not queued.
    let local = e
        .rec
        .create_lesson(
            Some(&e.pack),
            LessonInput {
                cause: "c".into(),
                action: "a".into(),
                submit: false,
                ..Default::default()
            },
        )
        .unwrap();
    assert_eq!(local.status, LessonStatus::Local);
    assert_eq!(e.rec.outbox_status().unwrap().pending, 0);
    assert!(
        e.rec
            .create_lesson(
                None,
                LessonInput {
                    cause: " ".into(),
                    action: "a".into(),
                    submit: true,
                    ..Default::default()
                }
            )
            .is_err()
    );
}

fn days_ago(n: i64) -> String {
    let today =
        harvest_core::records::maint::day_number(&harvest_core::audit::now_rfc3339()).unwrap();
    harvest_core::audit::rfc3339((today - n) * 86_400, 0)[..10].to_string()
}

#[test]
fn the_same_asset_and_symptom_again_within_the_window_is_a_repeat() {
    let e = env();
    let reg: AssetRegistry = serde_json::from_value(json!({
        "format": "harvest-assets/1",
        "assets": [
            {"asset_id": "unit-301", "equip_id": "pump40-diesel", "serial": "P40D-4001",
             "events": [{"date": days_ago(10), "symptom_id": "s-nocrank", "system": "starting"},
                        {"date": days_ago(45), "system": "cooling"}]},
            {"asset_id": "unit-302", "equip_id": "pump40-diesel",
             "events": [{"date": days_ago(60), "symptom_id": "s-nocrank"}]}
        ]
    }))
    .unwrap();
    e.rec.import_assets(Some(&e.pack), &reg).unwrap();
    let j = symptom_job(&e, "unit-301");
    let v = e.rec.job_view(&e.pack, &j.job_id, None).unwrap();
    assert!(v.repeat.flag);
    assert_eq!(v.repeat.window_days, 30);
    assert_eq!(
        v.repeat.matches.len(),
        1,
        "the cooling event is another system and outside the window"
    );
    assert_eq!(
        (
            v.repeat.matches[0].reason.as_str(),
            v.repeat.matches[0].days_before
        ),
        ("same_symptom", 10)
    );
    // Outside the window: no flag.
    let old = symptom_job(&e, "unit-302");
    assert!(
        !e.rec
            .job_view(&e.pack, &old.job_id, None)
            .unwrap()
            .repeat
            .flag
    );
    // A second job on the same unit the same day repeats the first; a
    // different tree on the same system repeats by system.
    let again = symptom_job(&e, "unit-302");
    let r = e.rec.job_view(&e.pack, &again.job_id, None).unwrap().repeat;
    assert!(r.flag);
    assert_eq!(r.matches[0].job_id.as_deref(), Some(old.job_id.as_str()));
    let hot1 = start(
        &e,
        JobStart {
            tree_id: Some("t-hot".into()),
            asset_id: Some("unit-301".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    let hot2 = start(
        &e,
        JobStart {
            tree_id: Some("t-hot".into()),
            asset_id: Some("unit-301".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    let r = e.rec.job_view(&e.pack, &hot2.job_id, None).unwrap().repeat;
    assert_eq!(r.matches[0].reason, "same_system");
    assert_eq!(r.matches[0].job_id.as_deref(), Some(hot1.job_id.as_str()));
    // A pack can set its own window.
    let h = e.rec.asset_history(&e.pack, "unit-302").unwrap();
    assert!(h.repeat);
    assert_eq!(h.jobs.len(), 2);
    assert_eq!(
        h.fleet_history.len(),
        2,
        "the model's and the diesel's events"
    );
    assert_eq!(h.failure_modes[0].mode_id, "fm-strainer");
}

fn bundle(seq: u64) -> Value {
    fixture_maint::field_bundle(seq).unwrap()
}

#[test]
fn field_notes_install_only_when_signed_and_newer() {
    let e = env();
    let keys = [fixture::trusted_key()];
    // Tampered after signing.
    let mut bad = bundle(1);
    bad["notes"][0]["text"] = json!("Skip the relay test.");
    assert!(matches!(
        e.rec.install_field_bundle(&bad, &keys),
        Err(Error::Signature(_))
    ));
    // Signed by a key the device does not trust.
    let other = ed25519_dalek::SigningKey::from_bytes(&[7u8; 32]);
    let mut foreign = bundle(1);
    harvest_core::packs::sign_manifest(&mut foreign, &other).unwrap();
    assert!(matches!(
        e.rec.install_field_bundle(&foreign, &keys),
        Err(Error::Signature(_))
    ));
    let mut unsigned = bundle(1);
    unsigned.as_object_mut().unwrap().remove("signature");
    assert!(e.rec.install_field_bundle(&unsigned, &keys).is_err());
    assert!(
        e.rec.field_notes().unwrap().is_empty(),
        "nothing from a refused bundle"
    );
    let ok = e.rec.install_field_bundle(&bundle(1), &keys).unwrap();
    assert_eq!(ok.installed, 2);
    // Replay and rollback are refused.
    assert!(matches!(
        e.rec.install_field_bundle(&bundle(1), &keys),
        Err(Error::Invalid(_))
    ));
    // A newer bundle supersedes one note and revokes the other.
    let mut b2 = json!({
        "format": "harvest-field/1", "stream": "pump40-fleet", "pack_id": "pump40", "seq": 2,
        "issued_at": "2026-04-01T00:00:00.000Z",
        "notes": [{"note_id": "fn-relay-bracket-2", "scope": {"equip_id": "pump40-diesel", "node_id": "nc.4"},
                   "text": "From serial P40D-3000 remove the filter bracket before testing the relay.",
                   "approver": "Fleet maintenance reviewer", "approved_at": "2026-03-30",
                   "supersedes": "fn-relay-bracket"}],
        "revoke": ["fn-strainer-silt"]
    });
    harvest_core::packs::sign_manifest(&mut b2, &signing_key()).unwrap();
    let r = e.rec.install_field_bundle(&b2, &keys).unwrap();
    assert_eq!((r.superseded, r.revoked), (1, 1));
    let ids: Vec<String> = e
        .rec
        .field_notes()
        .unwrap()
        .into_iter()
        .map(|n| n.note_id)
        .collect();
    assert_eq!(ids, ["fn-relay-bracket-2"]);
    let chain = e.rec.verify_audit().unwrap();
    assert_eq!(chain.events["field.install"], 2);
}

#[test]
fn field_notes_show_apart_from_the_manual_for_their_scope_only() {
    let e = env();
    e.rec
        .install_field_bundle(&bundle(1), &[fixture::trusted_key()])
        .unwrap();
    let job = symptom_job(&e, "unit-101");
    let id = &job.job_id;
    for a in [
        ans("nc.0", "done"),
        ans("nc.1", "yes"),
        val("nc.2", 12.9),
        ans("nc.3", "yes"),
    ] {
        e.rec.answer_job(&e.pack, id, &a).unwrap();
    }
    let v = e.rec.job_view(&e.pack, id, None).unwrap();
    let step = v.step.unwrap();
    assert_eq!(step.node.node.node_id, "nc.4");
    assert_eq!(step.field_notes.len(), 1);
    assert_eq!(step.field_notes[0].source, "field");
    // Never mixed into the manual's words.
    assert!(!step.node.node.text.contains("bracket"));
    assert!(step.node.guards.iter().all(|g| !g.text.contains("bracket")));
    // An electric unit never sees the diesel note; the tree note shows on every node of its tree.
    let hot = start(
        &e,
        JobStart {
            tree_id: Some("t-hot".into()),
            asset_id: Some("unit-201".into()),
            level: "expert".into(),
            ..Default::default()
        },
    );
    let notes: Vec<String> = e
        .rec
        .job_view(&e.pack, &hot.job_id, None)
        .unwrap()
        .step
        .unwrap()
        .field_notes
        .into_iter()
        .map(|n| n.note_id)
        .collect();
    assert_eq!(notes, ["fn-strainer-silt"]);
}

#[test]
fn a_hub_review_moves_the_lesson_status() {
    let e = env();
    let l = e
        .rec
        .create_lesson(
            Some(&e.pack),
            LessonInput {
                cause: "c".into(),
                action: "a".into(),
                submit: true,
                ..Default::default()
            },
        )
        .unwrap();
    let mut b = json!({
        "format": "harvest-field/1", "stream": "pump40-fleet", "seq": 5, "issued_at": "2026-04-01T00:00:00.000Z",
        "reviews": [{"lesson_id": l.lesson_id, "status": "edited", "note": "Cause reworded."}]
    });
    harvest_core::packs::sign_manifest(&mut b, &signing_key()).unwrap();
    assert_eq!(
        e.rec
            .install_field_bundle(&b, &[fixture::trusted_key()])
            .unwrap()
            .reviews,
        1
    );
    let got = e.rec.lessons(&LessonFilter::default()).unwrap();
    assert_eq!(got[0].status, LessonStatus::Edited);
    assert_eq!(got[0].review_note.as_deref(), Some("Cause reworded."));
}

#[test]
fn job_records_are_sealed_at_rest() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("pump40");
    fixture_maint::build(&dir, "2026.3.1-1").unwrap();
    let pack = Pack::open(&dir, &[fixture::trusted_key()]).unwrap();
    let db = tmp.path().join("records.db");
    let key = [9u8; 32];
    let id = {
        let rec = Records::open_with_key(&db, Some(&key)).unwrap();
        let job = rec
            .start_job(
                &pack,
                &JobStart {
                    tree_id: Some("t-hot".into()),
                    query: Some("smells hot near the motor".into()),
                    level: "expert".into(),
                    ..Default::default()
                },
            )
            .unwrap();
        rec.answer_job(
            &pack,
            &job.job_id,
            &JobAnswer {
                note: Some("strainer full of weed".into()),
                ..ans("oh.0", "done")
            },
        )
        .unwrap();
        rec.create_lesson(
            Some(&pack),
            LessonInput {
                job_id: Some(job.job_id.clone()),
                cause: "weed in the strainer".into(),
                action: "cleaned it".into(),
                submit: true,
                ..Default::default()
            },
        )
        .unwrap();
        job.job_id
    };
    let raw = std::fs::read(&db).unwrap();
    for secret in [
        "smells hot",
        "strainer full of weed",
        "weed in the strainer",
        "cleaned it",
    ] {
        assert!(
            !raw.windows(secret.len()).any(|w| w == secret.as_bytes()),
            "{secret} in the clear"
        );
    }
    let rec = Records::open_with_key(&db, Some(&key)).unwrap();
    let job = rec.job(&id).unwrap().unwrap();
    assert_eq!(job.query.as_deref(), Some("smells hot near the motor"));
    assert_eq!(job.steps[0].note.as_deref(), Some("strainer full of weed"));
    assert_eq!(
        rec.lessons(&LessonFilter::default()).unwrap()[0].cause,
        "weed in the strainer"
    );
    assert!(Records::open_with_key(&db, Some(&[1u8; 32])).is_err());
}

// ------------------------------------------------------------- the API

fn host(e: Env) -> (tempfile::TempDir, Host) {
    let Env {
        _tmp, pack, rec, ..
    } = e;
    let h = Host::new(vec![pack], rec)
        .with_field_keys(vec![fixture::trusted_key()])
        .with_embedder(
            "pump40",
            Arc::new(harvest_core::HashingEmbedder::new(fixture::EMBED_DIM)),
        );
    (_tmp, h)
}

fn ok(h: &Host, method: &str, params: Value) -> Value {
    match api::call(h, method, params) {
        Ok(v) => v,
        Err(e) => panic!("{method}: {e:?}"),
    }
}

#[test]
fn the_api_walks_a_job_end_to_end() {
    let (_tmp, h) = host(env());
    let info = ok(&h, "pack.info", json!({}));
    assert_eq!(info["api_version"], api::API_VERSION);
    assert_eq!(info["levels"][0]["id"], "apprentice");
    assert_eq!(info["systems"], json!(["cooling", "starting"]));
    let found = ok(
        &h,
        "symptom.search",
        json!({"text": "starter does nothing", "asset_id": "unit-101"}),
    );
    assert_eq!(found["dense"], true);
    let sid = found["hits"][0]["symptom"]["symptom_id"]
        .as_str()
        .unwrap()
        .to_string();
    let v = ok(
        &h,
        "job.start",
        json!({"symptom_id": sid, "asset_id": "unit-101", "level": "apprentice"}),
    );
    let job = v["job"]["job_id"].as_str().unwrap().to_string();
    let mut node = v["step"]["node"]["node_id"].as_str().unwrap().to_string();
    // Answer with what each screen offers: the branch's outcome, or a value.
    for (pick, value) in [(0, None), (0, None), (0, Some(12.8)), (0, None), (1, None)] {
        let step = ok(&h, "job.get", json!({"job_id": job}))["step"].clone();
        let b = &step["record"]["branches"][pick];
        let params = match value {
            Some(x) => {
                json!({"job_id": job, "node_id": node, "value": x, "unit": step["record"]["expect"]["unit"]})
            }
            None => json!({"job_id": job, "node_id": node, "outcome": b["outcome"]}),
        };
        let next = ok(&h, "job.answer", params);
        node = next["step"]["node"]["node_id"]
            .as_str()
            .unwrap()
            .to_string();
    }
    assert_eq!(node, "nc.4f");
    let v = ok(&h, "job.get", json!({"job_id": job, "level": "expert"}));
    assert_eq!(v["step"]["terminal"], true);
    assert_eq!(v["step"]["level"]["id"], "expert");
    assert_eq!(v["step"]["path"].as_array().unwrap().len(), 5);
    let closed = ok(
        &h,
        "job.close",
        json!({"job_id": job, "resolution": "fixed",
        "lesson": {"cause": "Relay K1 failed", "action": "Replaced relay K1", "minutes": 30}}),
    );
    assert_eq!(closed["lesson"]["status"], "queued");
    assert_eq!(ok(&h, "sync.status", json!({}))["pending"], 2);
    assert_eq!(
        api::call(&h, "sync.flush", json!({})).unwrap_err().code,
        "sync"
    );
    assert_eq!(ok(&h, "audit.verify", json!(null))["ok"], true);
    let listed = ok(&h, "audit.list", json!({"limit": 3}));
    assert_eq!(listed.as_array().unwrap().len(), 3);
    assert_eq!(
        ok(&h, "job.list", json!({"asset_id": "unit-101"}))
            .as_array()
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn the_api_refuses_unknown_methods_and_fields() {
    let (_tmp, h) = host(env());
    assert_eq!(
        api::call(&h, "job.teleport", json!({})).unwrap_err().code,
        "unknown_method"
    );
    assert_eq!(
        api::call(&h, "job.start", json!({"tree": "t-hot", "level": "expert"}))
            .unwrap_err()
            .code,
        "bad_params"
    );
    assert_eq!(
        api::call(&h, "job.get", json!({"job_id": "job-nope"}))
            .unwrap_err()
            .code,
        "invalid"
    );
    let text = api::call_json(&h, "pack.info", "{not json");
    assert!(text.contains("\"ok\":false") && text.contains("bad_params"));
    assert!(api::call_json(&h, "pack.info", "").contains("\"ok\":true"));
    let bad = api::call(
        &h,
        "field.install",
        json!({"bundle": {"format": "harvest-field/1"}}),
    )
    .unwrap_err();
    assert_eq!(bad.code, "signature");
}

#[test]
fn the_api_reads_the_manual_tasks_and_variants() {
    let (_tmp, h) = host(env());
    let r = ok(&h, "equip.resolve", json!({"serial": "P40E-1450"}));
    assert_eq!(r["equip_id"], "pump40-electric");
    let tasks = ok(&h, "task.list", json!({"equip_id": "pump40-electric"}));
    assert!(
        tasks.as_array().unwrap().is_empty(),
        "both tasks are diesel only"
    );
    let t = ok(&h, "task.get", json!({"proc_id": "proc-battery"}));
    assert_eq!(t["requirements"][2]["ident"], "P40-118");
    let run = ok(
        &h,
        "run.start",
        json!({"proc_id": "proc-battery", "role": "technician", "equip_id": "pump40-diesel"}),
    );
    let rid = run["run_id"].as_str().unwrap();
    let rec = ok(
        &h,
        "run.record",
        json!({"run_id": rid, "ord": 1, "outcome": "pass"}),
    );
    assert_eq!(rec["record"]["ord"], 1);
    assert_eq!(
        ok(&h, "run.report", json!({"run_id": rid}))["format"],
        "harvest-run/1"
    );
    let top = ok(&h, "manual.children", json!({}));
    assert_eq!(top.as_array().unwrap().len(), 3);
    let sec = ok(&h, "manual.section", json!({"section_id": "m40.3-1.q2"}));
    assert_eq!(sec["citation"]["page_asset_id"], "page-3-2");
    assert_eq!(sec["detail"].as_array().unwrap().len(), 2);
    let elec_children = ok(
        &h,
        "manual.children",
        json!({"section_id": "m40.3", "equip_id": "pump40-electric"}),
    );
    assert!(
        elec_children
            .as_array()
            .unwrap()
            .iter()
            .all(|c| c["section_id"] != "m40.3-1")
    );
    let found = ok(
        &h,
        "manual.search",
        json!({"query": "battery weighs", "k": 3}),
    );
    assert!(found["hits"][0]["text"].as_str().unwrap().contains("28 kg"));
    // Scoped to the cooling tree, the battery task does not come up.
    let scoped = ok(
        &h,
        "manual.search",
        json!({"query": "battery", "scope": {"tree_id": "t-hot"}}),
    );
    assert!(
        scoped["hits"]
            .as_array()
            .unwrap()
            .iter()
            .all(|x| x["section_id"].as_str().unwrap().starts_with("m40.3-2"))
    );
    let a = ok(
        &h,
        "ask",
        json!({"question": "How much does the battery weigh?", "level": "apprentice"}),
    );
    assert!(
        a["citations"]
            .as_array()
            .unwrap()
            .iter()
            .any(|c| c == "m40.4-3.w1"),
        "{a}"
    );
    let scoped = ok(
        &h,
        "ask",
        json!({"question": "How much does the battery weigh?", "scope": {"system": "cooling"}}),
    );
    assert!(
        scoped["citations"]
            .as_array()
            .unwrap()
            .iter()
            .all(|c| c.as_str().unwrap().starts_with("m40.3-2")),
        "{scoped}"
    );
    assert_eq!(
        api::call(&h, "ask", json!({"question": "x", "level": "operator"}))
            .unwrap_err()
            .code,
        "invalid"
    );
    let tree = ok(&h, "tree.get", json!({"tree_id": "t-hot"}));
    assert_eq!(tree["nodes"].as_array().unwrap().len(), 7);
    assert!(ok(&h, "pack.validate", json!({}))["ok"].as_bool().unwrap());
}

#[cfg(feature = "serve")]
mod http {
    use super::*;
    use harvest_core::api::serve::{ServeConfig, start};
    use std::io::{Read, Write};

    fn raw(addr: std::net::SocketAddr, req: &str) -> (u16, String) {
        let mut s = std::net::TcpStream::connect(addr).unwrap();
        s.write_all(req.as_bytes()).unwrap();
        let mut out = String::new();
        s.read_to_string(&mut out).unwrap();
        let status = out.split_whitespace().nth(1).unwrap().parse().unwrap();
        let body = out.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
        (status, body)
    }

    fn post(
        addr: std::net::SocketAddr,
        host: &str,
        path: &str,
        ct: &str,
        origin: Option<&str>,
        body: &str,
    ) -> (u16, String) {
        let origin = origin
            .map(|o| format!("Origin: {o}\r\n"))
            .unwrap_or_default();
        raw(
            addr,
            &format!(
                "POST {path} HTTP/1.1\r\nHost: {host}\r\nContent-Type: {ct}\r\n{origin}Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            ),
        )
    }

    #[test]
    fn serve_carries_calls_and_refuses_other_sites() {
        let (_tmp, h) = host(env());
        let running = start(
            Arc::new(h),
            ServeConfig {
                bind: "127.0.0.1:0".parse().unwrap(),
                static_dir: None,
                allow_origins: vec!["http://localhost:5173".into()],
            },
        )
        .unwrap();
        let a = running.addr();
        let me = format!("127.0.0.1:{}", a.port());
        let (s, body) = post(a, &me, "/api/pack.info", "application/json", None, "{}");
        assert_eq!(s, 200);
        assert!(body.contains("\"ok\":true"));
        let (s, body) = post(
            a,
            &me,
            "/api",
            "application/json",
            None,
            r#"{"method":"tree.list","params":{"equip_id":"pump40-electric"}}"#,
        );
        assert_eq!(s, 200);
        assert!(body.contains("t-hot") && !body.contains("t-nocrank"));
        let (_, body) = post(
            a,
            &me,
            "/api/job.get",
            "application/json",
            None,
            r#"{"job_id":"nope"}"#,
        );
        assert!(body.contains("\"ok\":false"));
        // DNS rebinding, a foreign page, a form post.
        assert_eq!(
            post(
                a,
                &format!("evil.example:{}", a.port()),
                "/api/pack.info",
                "application/json",
                None,
                "{}"
            )
            .0,
            403
        );
        assert_eq!(
            post(
                a,
                &me,
                "/api/pack.info",
                "application/json",
                Some("https://evil.example"),
                "{}"
            )
            .0,
            403
        );
        assert_eq!(
            post(a, &me, "/api/pack.info", "text/plain", None, "{}").0,
            415
        );
        assert_eq!(
            post(
                a,
                &me,
                "/api/pack.info",
                "application/json",
                Some("http://localhost:5173"),
                "{}"
            )
            .0,
            200
        );
        assert_eq!(
            post(
                a,
                &me,
                "/api/pack.info",
                "application/json",
                Some(&format!("http://{me}")),
                "{}"
            )
            .0,
            200
        );
        let (s, body) = raw(
            a,
            &format!(
                "GET /asset/pump40/fig-3-1 HTTP/1.1\r\nHost: {me}\r\nConnection: close\r\n\r\n"
            ),
        );
        assert_eq!(s, 200);
        assert!(body.starts_with("<svg"));
        assert_eq!(
            raw(
                a,
                &format!(
                    "GET /asset/pump40/nope HTTP/1.1\r\nHost: {me}\r\nConnection: close\r\n\r\n"
                )
            )
            .0,
            404
        );
        let (s, body) = raw(
            a,
            &format!("GET /api HTTP/1.1\r\nHost: {me}\r\nConnection: close\r\n\r\n"),
        );
        assert_eq!(s, 200);
        assert!(body.contains("job.answer"));
        running.stop();
    }
}

#[test]
fn the_api_reports_signal_kinds_sync_state_and_tree_titles() {
    let e = env();
    let out = tempfile::tempdir().unwrap();
    let Env {
        _tmp, pack, rec, ..
    } = e;
    let h = Host::new(vec![pack], rec).with_outbox_dir(out.path().join("drive"));
    let info = ok(&h, "pack.info", json!({}));
    assert_eq!(info["signal_kinds"][1]["example"], "E21");
    assert_eq!(info["facets"][1]["label"], "Reason for question");
    // A code typed off a display, kind unknown.
    let m = ok(
        &h,
        "signal.match",
        json!({"observations": [{"value": "e21"}]}),
    );
    assert_eq!(m["suggested"]["node_id"], "oh.1");
    assert_eq!(m["hits"][0]["rule"]["signal_kind"], "pump40.code");
    let s = ok(&h, "sync.status", json!({}));
    assert_eq!(s["hub"]["configured"], true);
    assert_eq!(s["hub"]["reachable"], Value::Null);
    assert_eq!(s["last_synced_at"], Value::Null);
    let v = ok(
        &h,
        "job.start",
        json!({"tree_id": "t-hot", "level": "expert"}),
    );
    let job = v["job"]["job_id"].as_str().unwrap();
    ok(
        &h,
        "job.close",
        json!({"job_id": job, "resolution": "abandoned"}),
    );
    assert_eq!(
        ok(&h, "job.list", json!({}))[0]["tree_title"],
        "Pump overheats"
    );
    let f = ok(&h, "sync.flush", json!({}));
    assert_eq!(f["acked"], 1);
    let s = ok(&h, "sync.status", json!({}));
    assert_eq!(s["hub"]["reachable"], true);
    assert!(s["last_synced_at"].is_string());
    assert_eq!(s["pending"], 0);
}
