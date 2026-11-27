mod common;

use serde_json::Value;
use std::process::Command;

fn harvest(args: &[&str]) -> (i32, String, String) {
    let out = Command::new(env!("CARGO_BIN_EXE_harvest"))
        .args(args)
        .env_remove("HARVEST_PUBKEY")
        .output()
        .unwrap();
    (
        out.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&out.stdout).into_owned(),
        String::from_utf8_lossy(&out.stderr).into_owned(),
    )
}

#[test]
fn fixture_verify_search_ask_json() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("fx");
    let d = dir.to_str().unwrap();
    let (code, out, _) = harvest(&["fixture", d, "--json"]);
    assert_eq!(code, 0);
    let fx: Value = serde_json::from_str(&out).unwrap();
    let key = fx["pubkey"].as_str().unwrap().to_string();

    let (code, out, err) = harvest(&["verify", d, "--pubkey", &key, "--json"]);
    assert_eq!(code, 0, "{err}");
    let v: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(v["ok"], true);
    assert_eq!(v["pack_id"], "fixture");

    // No key: refused.
    let (code, _, err) = harvest(&["verify", d]);
    assert_eq!(code, 1);
    assert!(err.contains("no trusted public key"), "{err}");

    let (code, out, err) = harvest(&[
        "search",
        d,
        "clearance from energized lines",
        "--k",
        "3",
        "--pubkey",
        &key,
        "--json",
    ]);
    assert_eq!(code, 0, "{err}");
    let s: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(s["hits"].as_array().unwrap().len(), 3);
    assert_eq!(s["hits"][0]["section_id"], "ex.2");

    let (code, out, err) = harvest(&[
        "ask",
        d,
        "How close can the machine get to a power line?",
        "--role",
        "operator",
        "--llm",
        "off",
        "--pubkey",
        &key,
        "--json",
    ]);
    assert_eq!(code, 0, "{err}");
    let a: Value = serde_json::from_str(&out).unwrap();
    for k in [
        "mode",
        "answer_id",
        "body",
        "citations",
        "retrieved",
        "check",
        "nearest",
        "pack_version",
        "model",
        "elapsed_ms",
    ] {
        assert!(a.get(k).is_some(), "missing {k}");
    }
    assert_eq!(a["mode"], "baked");
    assert_eq!(
        a["check"],
        serde_json::json!({"quotes_ok": true, "cites_ok": true, "dropped": 0})
    );
    let r0 = &a["retrieved"][0];
    for k in ["chunk_id", "ref_id", "lexical", "dense", "score"] {
        assert!(r0.get(k).is_some(), "retrieved missing {k}");
    }
    assert!(a["model"].is_null());

    // Tamper → verify fails with exit 1.
    let db = dir.join("fixture.sqlite");
    let mut bytes = std::fs::read(&db).unwrap();
    bytes[200] ^= 1;
    std::fs::write(&db, bytes).unwrap();
    let (code, out, _) = harvest(&["verify", d, "--pubkey", &key, "--json"]);
    assert_eq!(code, 1);
    assert!(out.contains("\"ok\":false"));
}

#[test]
fn usage_errors_exit_2() {
    assert_eq!(harvest(&[]).0, 2);
    assert_eq!(harvest(&["frobnicate"]).0, 2);
    assert_eq!(harvest(&["search", "x", "q", "--bogus", "1"]).0, 2);
}
