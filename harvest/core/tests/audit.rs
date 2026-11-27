mod common;

use harvest_core::AskOptions;
use harvest_core::audit::{self, AuditEntry};
use rusqlite::Connection;

#[test]
fn chain_appends_verifies_and_detects_tampering() {
    let b = common::pack();
    let e = common::engine(&b);
    let tmp = tempfile::tempdir().unwrap();
    let db = tmp.path().join("records.db");
    let conn = Connection::open(&db).unwrap();
    for q in [
        "How close can the machine get to a power line?",
        "Who must inspect the machine each shift?",
        "best pizza recipe",
    ] {
        let (r, t) = e.ask_traced(q, &AskOptions::default()).unwrap();
        audit::append(&conn, &AuditEntry::from_answer(b.pack.pack_id(), q, &r, &t)).unwrap();
    }
    let rep = audit::verify_chain(&conn).unwrap();
    assert!(rep.ok);
    assert_eq!(rep.entries, 3);
    assert_eq!(rep.modes.get("baked"), Some(&1));
    assert_eq!(rep.modes.get("declined"), Some(&1));
    assert!((rep.bake_hit_rate.unwrap() - 1.0 / 3.0).abs() < 1e-9);

    let entries = audit::entries(&conn).unwrap();
    assert_eq!(entries[0].1.verdict, "supported");
    assert_eq!(entries[2].1.verdict, "declined");
    assert_eq!(entries[0].1.pack_version, "2026.1.1-1");
    assert!(!entries[1].1.chunks.is_empty());

    // Append-only: the triggers refuse edits and deletes.
    assert!(
        conn.execute("UPDATE audit SET entry = 'x' WHERE seq = 2", [])
            .is_err()
    );
    assert!(conn.execute("DELETE FROM audit WHERE seq = 1", []).is_err());

    // Around the triggers, an edit breaks the chain at that entry.
    conn.execute_batch("DROP TRIGGER audit_no_update;").unwrap();
    conn.execute(
        "UPDATE audit SET entry = replace(entry, 'pizza', 'pasta') WHERE seq = 3",
        [],
    )
    .unwrap();
    let rep = audit::verify_chain(&conn).unwrap();
    assert!(!rep.ok);
    assert_eq!(rep.first_bad, Some(3));
}

#[test]
fn deleting_a_middle_row_breaks_the_link() {
    let tmp = tempfile::tempdir().unwrap();
    let conn = Connection::open(tmp.path().join("r.db")).unwrap();
    let b = common::pack();
    let e = common::engine(&b);
    for q in ["a power line", "shift inspection", "wind"] {
        let (r, t) = e.ask_traced(q, &AskOptions::default()).unwrap();
        audit::append(&conn, &AuditEntry::from_answer("fixture", q, &r, &t)).unwrap();
    }
    conn.execute_batch("DROP TRIGGER audit_no_delete; DELETE FROM audit WHERE seq = 2;")
        .unwrap();
    let rep = audit::verify_chain(&conn).unwrap();
    assert_eq!(rep.first_bad, Some(3));
}

#[test]
fn rfc3339_formatting() {
    assert_eq!(audit::rfc3339(0, 0), "1970-01-01T00:00:00.000Z");
    assert_eq!(
        audit::rfc3339(1_795_700_000, 123),
        "2026-11-26T13:33:20.123Z"
    );
    assert_eq!(audit::rfc3339(951_782_400, 0), "2000-02-29T00:00:00.000Z");
}
