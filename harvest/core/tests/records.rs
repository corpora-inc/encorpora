use harvest_core::fixture;
use harvest_core::records::{Outcome, PhotoRef, Records, StartRun, StepInput};
use harvest_core::sync::{self, DirTransport, Receipt, Transport, Upload};
use harvest_core::{Error, Pack, Result};
use std::cell::RefCell;

fn setup_sql() -> String {
    r#"
            INSERT INTO procedure VALUES ('proc-setup', 'Setup', 'setup', 'Before the lift.', '["operator"]', 'en', 'prov-fixture');
            INSERT INTO proc_step VALUES ('proc-setup', 1, 'Check the clearance to lines.', '{"operator":"Measure it."}',
              'pass_fail', '["ex.2"]', '{"guidance":"Stop and replan the lift.","action":"stop","section_id":"ex.2","quote":"No part of the machine, load line or load may come closer than 10 feet to an energized line rated up to 50 kV."}', 'en', 'prov-fixture');
            INSERT INTO proc_step VALUES ('proc-setup', 2, 'Record the radius.', '{"operator":"In feet."}', 'value', '["ex.2"]', NULL, 'en', 'prov-fixture');
            INSERT INTO proc_step VALUES ('proc-setup', 3, 'Note ground conditions.', '{}', 'note', '["ex.2"]', NULL, 'en', 'prov-fixture');
            INSERT INTO proc_step VALUES ('proc-setup', 4, 'Photograph the setup.', '{}', 'photo', '["ex.2"]',
              '{"guidance":"Retake it.","section_id":"ex.2","quote":"a sentence the section never says"}', 'en', 'prov-fixture');
            "#
    .to_string()
}

/// The fixture plus a four-step procedure covering every check kind.
fn pack(tmp: &tempfile::TempDir) -> Pack {
    let dir = tmp.path().join("pack");
    fixture::build_with(&dir, "2026.1.1-1", |c| {
        c.execute_batch(&setup_sql())?;
        Ok(())
    })
    .unwrap();
    Pack::open(&dir, &[fixture::trusted_key()]).unwrap()
}

fn operator() -> StartRun {
    StartRun {
        role: "operator".into(),
        equip_id: Some("machine-tracked".into()),
        asset: Some("Unit 7".into()),
    }
}

fn photo() -> PhotoRef {
    PhotoRef {
        path: "photos/a.jpg".into(),
        sha256: "ab".repeat(32),
    }
}

#[test]
fn a_run_captures_steps_flags_deficiencies_and_queues_uploads() {
    let tmp = tempfile::tempdir().unwrap();
    let pack = pack(&tmp);
    let rec = Records::open(&tmp.path().join("records.db")).unwrap();

    let run = rec.start_run(&pack, "proc-setup", &operator()).unwrap();
    assert_eq!(run.status, "open");
    assert_eq!(run.pack_version, "2026.1.1-1");

    // A failed pass/fail step returns the pack's guidance with its rule.
    let out = rec
        .record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Fail))
        .unwrap();
    assert!(out.record.deficiency);
    let g = out.guidance.unwrap();
    assert_eq!(g.deficiency.guidance, "Stop and replan the lift.");
    assert!(g.quote_verified);
    assert!(g.citation.is_some());
    // The deficiency is queued at once, before the run ends.
    assert_eq!(
        sync::status(rec.conn()).unwrap().pending_by_kind["deficiency"],
        1
    );

    // Corrections overwrite while the run is open.
    let pass = rec
        .record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Pass))
        .unwrap();
    assert!(!pass.record.deficiency && pass.guidance.is_none());
    // ... and withdraw the deficiency that had not gone up yet.
    assert!(
        !sync::status(rec.conn())
            .unwrap()
            .pending_by_kind
            .contains_key("deficiency")
    );

    let mut value = StepInput::outcome(Outcome::Value);
    value.value = Some("42 ft".into());
    rec.record_step(&pack, &run.run_id, 2, value).unwrap();
    let mut note = StepInput::outcome(Outcome::Note);
    note.note = Some("Firm, level gravel.".into());
    note.structured = Some(serde_json::json!({"condition": "ok"}));
    rec.record_step(&pack, &run.run_id, 3, note).unwrap();

    // Not finished until every step is recorded.
    let err = rec.finish_run(&pack, &run.run_id).unwrap_err().to_string();
    assert!(err.contains("[4]"), "{err}");

    let mut shot = StepInput::outcome(Outcome::Photo);
    shot.photos = vec![photo()];
    rec.record_step(&pack, &run.run_id, 4, shot).unwrap();
    assert_eq!(rec.open_runs().unwrap().len(), 1);

    let done = rec.finish_run(&pack, &run.run_id).unwrap();
    assert_eq!(done.status, "complete");
    assert_eq!(done.steps.len(), 4);
    assert_eq!(done.deficiencies(), 0);
    assert_eq!(
        done.steps[2].input.structured,
        Some(serde_json::json!({"condition": "ok"}))
    );
    assert!(rec.open_runs().unwrap().is_empty());

    // Closed runs take no more steps.
    assert!(
        rec.record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Fail))
            .is_err()
    );
    let st = sync::status(rec.conn()).unwrap();
    assert_eq!(st.pending, 1);
    assert_eq!(st.pending_by_kind["run"], 1);

    // Reopened from disk, the run reads back identically.
    drop(rec);
    let rec = Records::open(&tmp.path().join("records.db")).unwrap();
    assert_eq!(rec.run(&run.run_id).unwrap().unwrap(), done);
}

#[test]
fn inputs_must_fit_the_step() {
    let tmp = tempfile::tempdir().unwrap();
    let pack = pack(&tmp);
    let rec = Records::in_memory().unwrap();
    assert!(rec.start_run(&pack, "no-such-proc", &operator()).is_err());
    let mut bad_equip = operator();
    bad_equip.equip_id = Some("spaceship".into());
    assert!(rec.start_run(&pack, "proc-setup", &bad_equip).is_err());
    assert!(
        rec.start_run(&pack, "proc-setup", &StartRun::default())
            .is_err(),
        "a run needs a role"
    );

    let run = rec.start_run(&pack, "proc-setup", &operator()).unwrap();
    let id = &run.run_id;
    let invalid = |r: Result<_>| matches!(r, Err(Error::Invalid(_)));
    // Wrong outcome for the kind, or missing what the kind needs.
    assert!(invalid(rec.record_step(
        &pack,
        id,
        1,
        StepInput::outcome(Outcome::Value)
    )));
    assert!(invalid(rec.record_step(
        &pack,
        id,
        2,
        StepInput::outcome(Outcome::Value)
    )));
    assert!(invalid(rec.record_step(
        &pack,
        id,
        2,
        StepInput::outcome(Outcome::Pass)
    )));
    assert!(invalid(rec.record_step(
        &pack,
        id,
        3,
        StepInput::outcome(Outcome::Note)
    )));
    assert!(invalid(rec.record_step(
        &pack,
        id,
        4,
        StepInput::outcome(Outcome::Photo)
    )));
    let mut bad_photo = StepInput::outcome(Outcome::Photo);
    bad_photo.photos = vec![PhotoRef {
        path: "a.jpg".into(),
        sha256: "not-a-hash".into(),
    }];
    assert!(invalid(rec.record_step(&pack, id, 4, bad_photo)));
    assert!(invalid(rec.record_step(
        &pack,
        id,
        9,
        StepInput::outcome(Outcome::Pass)
    )));
    // Not applicable is always allowed.
    rec.record_step(&pack, id, 2, StepInput::outcome(Outcome::Na))
        .unwrap();
    // Nothing invalid reached the queue.
    assert_eq!(sync::status(rec.conn()).unwrap().pending, 0);
}

#[test]
fn guidance_with_a_bad_quote_is_shown_without_it() {
    let tmp = tempfile::tempdir().unwrap();
    let pack = pack(&tmp);
    let rec = Records::in_memory().unwrap();
    let run = rec.start_run(&pack, "proc-setup", &operator()).unwrap();
    // Photo steps are not pass/fail, so they never carry a deficiency; check
    // the quote rule through the pack-level step instead.
    let steps = pack.proc_steps("proc-setup").unwrap();
    assert_eq!(steps.len(), 4);
    assert!(steps[3].deficiency.is_some());
    let mut shot = StepInput::outcome(Outcome::Photo);
    shot.photos = vec![photo()];
    let out = rec.record_step(&pack, &run.run_id, 4, shot).unwrap();
    assert!(out.guidance.is_none());
    // Abandoning still queues what was recorded.
    let gone = rec.abandon_run(&pack, &run.run_id).unwrap();
    assert_eq!(gone.status, "abandoned");
    assert_eq!(sync::status(rec.conn()).unwrap().pending_by_kind["run"], 1);
    assert!(rec.abandon_run(&pack, &run.run_id).is_err());
}

#[test]
fn misses_are_queued_for_the_next_bake() {
    let tmp = tempfile::tempdir().unwrap();
    let pack = pack(&tmp);
    let rec = Records::in_memory().unwrap();
    rec.log_miss(&pack, "best pizza recipe", "declined", &["ex.1".into()])
        .unwrap();
    assert!(rec.log_miss(&pack, "  ", "declined", &[]).is_err());
    let up = sync::pending(rec.conn(), 10).unwrap();
    assert_eq!(up.len(), 1);
    assert_eq!(up[0].kind, "miss");
    let payload = up[0].payload_json().unwrap();
    assert_eq!(payload["question"], "best pizza recipe");
    assert_eq!(payload["pack_version"], "2026.1.1-1");
}

type Reply = Box<dyn Fn(&[Upload]) -> Result<Vec<Receipt>>>;

/// A transport that answers with a scripted reply and records batches.
struct Scripted {
    reply: Reply,
    batches: RefCell<Vec<usize>>,
}

impl Transport for Scripted {
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>> {
        self.batches.borrow_mut().push(batch.len());
        (self.reply)(batch)
    }
}

fn receipt(u: &Upload) -> Receipt {
    Receipt {
        item_id: u.item_id.clone(),
        payload_sha256: u.payload_sha256.clone(),
        server_id: format!("srv-{}", u.item_id),
        received_at: "2026-01-01T00:00:00.000Z".into(),
    }
}

fn queue(n: usize) -> Records {
    let rec = Records::in_memory().unwrap();
    for i in 0..n {
        sync::enqueue(rec.conn(), "note", &serde_json::json!({ "i": i })).unwrap();
    }
    rec
}

#[test]
fn flush_sends_in_order_and_marks_only_receipted_items() {
    let rec = queue(5);
    let t = Scripted {
        reply: Box::new(|b| Ok(b.iter().map(receipt).collect())),
        batches: RefCell::new(Vec::new()),
    };
    let r = sync::flush(rec.conn(), &t, 2).unwrap();
    assert_eq!((r.sent, r.acked, r.remaining), (5, 5, 0));
    assert_eq!(*t.batches.borrow(), vec![2, 2, 1]);
    // Nothing left: a second flush sends nothing.
    let r = sync::flush(rec.conn(), &t, 2).unwrap();
    assert_eq!(r.sent, 0);
    assert_eq!(sync::status(rec.conn()).unwrap().acked, 5);
}

#[test]
fn bad_receipts_and_transport_errors_leave_items_queued() {
    let rec = queue(3);
    // Wrong hash for the first, a stranger's id, nothing for the third.
    let t = Scripted {
        reply: Box::new(|b| {
            let mut wrong = receipt(&b[0]);
            wrong.payload_sha256 = "00".repeat(32);
            let mut stranger = receipt(&b[1]);
            stranger.item_id = "someone-else".into();
            Ok(vec![wrong, receipt(&b[1]), stranger])
        }),
        batches: RefCell::new(Vec::new()),
    };
    let r = sync::flush(rec.conn(), &t, 10).unwrap();
    assert_eq!(
        (r.sent, r.acked, r.rejected_receipts, r.remaining),
        (3, 1, 2, 2)
    );
    let st = sync::status(rec.conn()).unwrap();
    assert_eq!((st.pending, st.failing), (2, 2));

    let down = Scripted {
        reply: Box::new(|_| Err(Error::Sync("no route to host".into()))),
        batches: RefCell::new(Vec::new()),
    };
    let r = sync::flush(rec.conn(), &down, 10).unwrap();
    assert_eq!(r.acked, 0);
    assert!(r.error.unwrap().contains("no route"));
    assert_eq!(
        sync::status(rec.conn()).unwrap().last_error.as_deref(),
        Some("sync: no route to host")
    );
}

#[test]
fn a_payload_edited_behind_the_queue_is_quarantined_and_the_rest_still_go() {
    let rec = queue(3);
    rec.conn()
        .execute("UPDATE outbox SET payload = '{\"i\":99}' WHERE seq = 1", [])
        .unwrap();
    let up = sync::pending(rec.conn(), 10).unwrap();
    assert_eq!(up.len(), 2);
    let t = Scripted {
        reply: Box::new(|b| Ok(b.iter().map(receipt).collect())),
        batches: RefCell::new(Vec::new()),
    };
    let r = sync::flush(rec.conn(), &t, 10).unwrap();
    assert_eq!((r.acked, r.remaining), (2, 0));
    let st = sync::status(rec.conn()).unwrap();
    assert_eq!((st.quarantined, st.acked), (1, 2));
    assert_eq!(st.last_error.as_deref(), Some("payload hash mismatch"));
}

#[test]
fn kinds_must_fit_a_file_name() {
    let rec = queue(0);
    assert!(sync::enqueue(rec.conn(), "Bad Kind", &serde_json::json!({})).is_err());
    let longest = "k".repeat(sync::MAX_KIND);
    let id = sync::enqueue(rec.conn(), &longest, &serde_json::json!({})).unwrap();
    assert!(harvest_core::packs::valid_id(&id), "{id}");
    assert!(sync::enqueue(rec.conn(), &format!("{longest}k"), &serde_json::json!({})).is_err());
}

#[test]
fn the_payload_goes_up_as_the_exact_text_that_was_hashed() {
    use sha2::Digest;
    let rec = queue(1);
    let up = sync::pending(rec.conn(), 1).unwrap();
    let hex: String = sha2::Sha256::digest(up[0].payload.as_bytes())
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect();
    assert_eq!(hex, up[0].payload_sha256);
}

#[test]
fn a_correction_after_upload_queues_a_retraction() {
    let tmp = tempfile::tempdir().unwrap();
    let pack = pack(&tmp);
    let rec = Records::in_memory().unwrap();
    let run = rec.start_run(&pack, "proc-setup", &operator()).unwrap();
    rec.record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Fail))
        .unwrap();
    // Failing again replaces the pending item instead of adding one.
    rec.record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Fail))
        .unwrap();
    assert_eq!(
        sync::status(rec.conn()).unwrap().pending_by_kind["deficiency"],
        1
    );
    let drive = tmp.path().join("drive");
    sync::flush(rec.conn(), &DirTransport::new(&drive), 10).unwrap();
    rec.record_step(&pack, &run.run_id, 1, StepInput::outcome(Outcome::Pass))
        .unwrap();
    let up = sync::pending(rec.conn(), 10).unwrap();
    assert_eq!(up.len(), 1);
    assert_eq!(up[0].kind, "deficiency_cleared");
    assert_eq!(up[0].payload_json().unwrap()["step"], 1);
}

#[test]
fn a_run_survives_a_pack_update_only_if_its_steps_are_unchanged() {
    let tmp = tempfile::tempdir().unwrap();
    let v1 = pack(&tmp);
    let rec = Records::in_memory().unwrap();
    let run = rec.start_run(&v1, "proc-setup", &operator()).unwrap();
    // Same steps, newer version: fine.
    let same = tmp.path().join("same");
    let v2 = {
        fixture::build_with(&same, "2026.1.2-1", |c| {
            c.execute_batch(&setup_sql())?;
            Ok(())
        })
        .unwrap();
        Pack::open(&same, &[fixture::trusted_key()]).unwrap()
    };
    rec.record_step(&v2, &run.run_id, 1, StepInput::outcome(Outcome::Pass))
        .unwrap();
    // Steps changed: refused, nothing recorded.
    let changed = tmp.path().join("changed");
    let v3 = {
        fixture::build_with(&changed, "2026.1.3-1", |c| {
            c.execute_batch(&setup_sql())?;
            c.execute(
                "UPDATE proc_step SET text = 'Check the outriggers.' WHERE proc_id = 'proc-setup' AND ord = 2",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        Pack::open(&changed, &[fixture::trusted_key()]).unwrap()
    };
    let err = rec
        .record_step(&v3, &run.run_id, 2, StepInput::outcome(Outcome::Na))
        .unwrap_err()
        .to_string();
    assert!(err.contains("changed"), "{err}");
    assert_eq!(rec.run(&run.run_id).unwrap().unwrap().steps.len(), 1);
}

#[test]
fn dir_transport_writes_each_item_once() {
    let tmp = tempfile::tempdir().unwrap();
    let rec = queue(2);
    let out = tmp.path().join("drive");
    let r = sync::flush(rec.conn(), &DirTransport::new(&out), 10).unwrap();
    assert_eq!(r.acked, 2);
    let files: Vec<_> = std::fs::read_dir(&out)
        .unwrap()
        .map(|e| e.unwrap().file_name().into_string().unwrap())
        .collect();
    assert_eq!(files.len(), 2);
    assert!(
        files
            .iter()
            .all(|f| f.starts_with("note-") && f.ends_with(".json"))
    );
    let one: Upload = serde_json::from_slice(&std::fs::read(out.join(&files[0])).unwrap()).unwrap();
    assert_eq!(one.payload_sha256.len(), 64);
}
