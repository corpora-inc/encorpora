mod common;

use harvest_core::AskOptions;
use harvest_core::Error;
use harvest_core::crypt::{RecordKey, is_sealed};
use harvest_core::records::{Outcome, Records, StartRun, StepInput};
use harvest_core::sync::{DirTransport, Upload};
use rusqlite::Connection;
use std::process::Command;

const KEY: [u8; 32] = [7u8; 32];

fn operator() -> StartRun {
    StartRun {
        role: "operator".into(),
        ..Default::default()
    }
}

#[test]
fn seal_and_open_bind_the_key_and_the_place() {
    let k = RecordKey::from_bytes(&KEY);
    let a = k.seal("t.c:1", "hook throat cracked").unwrap();
    let b = k.seal("t.c:1", "hook throat cracked").unwrap();
    assert!(is_sealed(&a) && a != b, "fresh nonce each time");
    assert_eq!(k.open("t.c:1", &a).unwrap(), "hook throat cracked");
    // Moved to another row, opened with another key, or changed: refused.
    assert!(matches!(k.open("t.c:2", &a), Err(Error::Crypto(_))));
    let other = RecordKey::from_bytes(&[8u8; 32]);
    assert!(matches!(other.open("t.c:1", &a), Err(Error::Crypto(_))));
    let mut bytes = a.into_bytes();
    let last = bytes.len() - 2;
    bytes[last] = if bytes[last] == b'A' { b'B' } else { b'A' };
    assert!(k.open("t.c:1", &String::from_utf8(bytes).unwrap()).is_err());
    assert_ne!(
        RecordKey::generate().unwrap(),
        RecordKey::generate().unwrap()
    );
}

#[test]
fn an_encrypted_store_keeps_what_people_wrote_off_the_disk() {
    let b = common::pack();
    let tmp = tempfile::tempdir().unwrap();
    let path = tmp.path().join("records.db");
    let rec = Records::open_with_key(&path, Some(&KEY)).unwrap();
    let run = rec.start_run(&b.pack, "proc-shift", &operator()).unwrap();
    let mut fail = StepInput::outcome(Outcome::Fail);
    fail.note = Some("Load line has a birdcage near the drum".into());
    rec.record_step(&b.pack, &run.run_id, 1, fail).unwrap();
    rec.finish_run(&b.pack, &run.run_id).unwrap();
    let e = common::engine(&b);
    let (resp, trace) = e
        .ask_traced("best pizza recipe in the depot", &AskOptions::default())
        .unwrap();
    rec.record_answer(&b.pack, "best pizza recipe in the depot", &resp, &trace)
        .unwrap();

    // Reads back in the clear through the store.
    let back = rec.run(&run.run_id).unwrap().unwrap();
    assert_eq!(
        back.steps[0].input.note.as_deref(),
        Some("Load line has a birdcage near the drum")
    );
    let report = rec.verify_audit().unwrap();
    assert!(report.ok);
    assert_eq!(report.modes.get("declined"), Some(&1));
    assert_eq!(
        rec.audit_entries().unwrap()[0].1.query,
        "best pizza recipe in the depot"
    );
    drop(rec);

    // On disk, none of it is readable.
    let raw = std::fs::read(&path).unwrap();
    let hay = String::from_utf8_lossy(&raw);
    assert!(!hay.contains("birdcage"));
    assert!(!hay.contains("pizza"));
    let conn = Connection::open(&path).unwrap();
    let note: String = conn
        .query_row("SELECT note FROM step_result", [], |r| r.get(0))
        .unwrap();
    assert!(is_sealed(&note));
    let payloads: Vec<String> = conn
        .prepare("SELECT payload FROM outbox")
        .unwrap()
        .query_map([], |r| r.get(0))
        .unwrap()
        .collect::<Result<_, _>>()
        .unwrap();
    assert_eq!(payloads.len(), 3); // deficiency, run, miss
    assert!(payloads.iter().all(|p| is_sealed(p)));

    // Without the key the chain still verifies, but nothing is read.
    let clear = harvest_core::audit::verify_chain(&conn).unwrap();
    assert!(clear.ok);
    assert_eq!(clear.modes.get("sealed"), Some(&1));
    assert_eq!(clear.bake_hit_rate, None);
    drop(conn);

    // Uploads go up in the clear, with the hash of the clear payload.
    let rec = Records::open_with_key(&path, Some(&KEY)).unwrap();
    let drive = tmp.path().join("drive");
    let r = rec.flush(&DirTransport::new(&drive), 10).unwrap();
    assert_eq!(r.acked, 3);
    let mut found = false;
    for f in std::fs::read_dir(&drive).unwrap() {
        let u: Upload = serde_json::from_slice(&std::fs::read(f.unwrap().path()).unwrap()).unwrap();
        found |= u.payload.contains("birdcage");
    }
    assert!(found);
}

#[test]
fn the_key_must_match_the_store() {
    let tmp = tempfile::tempdir().unwrap();
    let enc = tmp.path().join("enc.db");
    drop(Records::open_with_key(&enc, Some(&KEY)).unwrap());
    let crypto = |r: harvest_core::Result<Records>| matches!(r, Err(Error::Crypto(_)));
    assert!(crypto(Records::open_with_key(&enc, Some(&[9u8; 32]))));
    assert!(crypto(Records::open(&enc)));
    Records::open_with_key(&enc, Some(&KEY)).unwrap();

    let clear = tmp.path().join("clear.db");
    let b = common::pack();
    let rec = Records::open(&clear).unwrap();
    rec.log_miss(&b.pack, "anything", "declined", &[]).unwrap();
    drop(rec);
    assert!(crypto(Records::open_with_key(&clear, Some(&KEY))));
}

#[test]
fn a_sealed_value_moved_to_another_step_does_not_open() {
    let b = common::pack();
    let rec = Records::in_memory_with_key(&KEY).unwrap();
    let mk = |note: &str| {
        let run = rec.start_run(&b.pack, "proc-shift", &operator()).unwrap();
        let mut s = StepInput::outcome(Outcome::Pass);
        s.note = Some(note.into());
        rec.record_step(&b.pack, &run.run_id, 1, s).unwrap();
        run.run_id
    };
    let (a, z) = (mk("all good"), mk("cracked sheave"));
    // Copy run z's sealed note over run a's.
    rec.conn()
        .execute(
            "UPDATE step_result SET note = (SELECT note FROM step_result WHERE run_id = ?2)
             WHERE run_id = ?1",
            [&a, &z],
        )
        .unwrap();
    assert!(matches!(rec.run(&a), Err(Error::Crypto(_))));
    assert!(rec.run(&z).is_ok());
}

#[test]
fn cli_reads_encrypted_records_only_with_the_key() {
    let b = common::pack();
    let tmp = tempfile::tempdir().unwrap();
    let key_file = tmp.path().join("records.key");
    std::fs::write(&key_file, "07".repeat(32)).unwrap();
    let db = tmp.path().join("records.db");
    let key = harvest_core::fixture::public_key_base64();
    let run = |args: &[&str]| {
        let out = Command::new(env!("CARGO_BIN_EXE_harvest"))
            .args(args)
            .env("HARVEST_PUBKEY", &key)
            .output()
            .unwrap();
        (
            out.status.code().unwrap_or(-1),
            String::from_utf8_lossy(&out.stdout).into_owned(),
        )
    };
    let (d, db_s, k) = (
        b.dir.to_str().unwrap(),
        db.to_str().unwrap(),
        key_file.to_str().unwrap(),
    );
    let (code, _) = run(&[
        "ask",
        d,
        "best pizza recipe",
        "--audit",
        db_s,
        "--records-key",
        k,
        "--json",
    ]);
    assert_eq!(code, 0);
    // Without the key the chain still verifies; nothing is read.
    let (code, out) = run(&["audit", db_s, "--json"]);
    assert_eq!(code, 0);
    let r: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(r["modes"]["sealed"], 1);
    let (code, _) = run(&["outbox", db_s]);
    assert_ne!(code, 0, "the outbox needs the key");
    let (code, out) = run(&["audit", db_s, "--records-key", k, "--json"]);
    assert_eq!(code, 0);
    let r: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(r["modes"]["declined"], 1);
    let (code, out) = run(&["outbox", db_s, "--records-key", k, "--json"]);
    assert_eq!(code, 0);
    let s: serde_json::Value = serde_json::from_str(&out).unwrap();
    assert_eq!(s["status"]["pending_by_kind"]["miss"], 1);
}

#[test]
fn no_path_writes_clear_text_into_an_encrypted_store_or_quarantines_on_a_wrong_key() {
    let b = common::pack();
    let rec = Records::in_memory_with_key(&KEY).unwrap();
    rec.log_miss(&b.pack, "anything at all", "declined", &[])
        .unwrap();
    // Keyless writers are refused.
    assert!(matches!(
        harvest_core::sync::enqueue(rec.conn(), "note", &serde_json::json!({"x": 1})),
        Err(Error::Crypto(_))
    ));
    let e = common::engine(&b);
    let (resp, trace) = e.ask_traced("anything", &AskOptions::default()).unwrap();
    let entry =
        harvest_core::audit::AuditEntry::from_answer(b.pack.pack_id(), "anything", &resp, &trace);
    assert!(matches!(
        harvest_core::audit::append(rec.conn(), &entry),
        Err(Error::Crypto(_))
    ));
    // A wrong key is an error, and nothing is quarantined.
    let wrong = RecordKey::from_bytes(&[9u8; 32]);
    assert!(matches!(
        harvest_core::sync::pending_with(rec.conn(), Some(&wrong), 10),
        Err(Error::Crypto(_))
    ));
    let st = rec.outbox_status().unwrap();
    assert_eq!((st.pending, st.quarantined), (1, 0));
    // Sealed rows keep no clear hash; the upload still carries the real one.
    let stored: String = rec
        .conn()
        .query_row("SELECT payload_sha256 FROM outbox", [], |r| r.get(0))
        .unwrap();
    assert_eq!(stored, "sealed");
    assert_eq!(rec.pending(10).unwrap()[0].payload_sha256.len(), 64);
}

#[test]
fn flipping_a_clear_outcome_breaks_the_row() {
    let b = common::pack();
    let rec = Records::in_memory_with_key(&KEY).unwrap();
    let run = rec.start_run(&b.pack, "proc-shift", &operator()).unwrap();
    let mut fail = StepInput::outcome(Outcome::Fail);
    fail.note = Some("sheave flange cracked".into());
    rec.record_step(&b.pack, &run.run_id, 1, fail).unwrap();
    rec.conn()
        .execute("UPDATE step_result SET result = 'pass', deficiency = 0", [])
        .unwrap();
    assert!(matches!(rec.run(&run.run_id), Err(Error::Crypto(_))));
}
