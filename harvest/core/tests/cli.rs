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

/// A one-thread OpenAI-compatible server answering from a script.
fn mock_server(contents: Vec<String>) -> (String, std::thread::JoinHandle<Vec<String>>) {
    use std::io::{BufRead, BufReader, Read, Write};
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let base = format!("http://{}/v1", listener.local_addr().unwrap());
    let handle = std::thread::spawn(move || {
        let mut queue: std::collections::VecDeque<String> = contents.into();
        let mut seen = Vec::new();
        // /models + one request per scripted completion.
        for _ in 0..queue.len() + 1 {
            let (stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut line = String::new();
            reader.read_line(&mut line).unwrap();
            let path = line.split_whitespace().nth(1).unwrap_or("").to_string();
            let mut len = 0usize;
            loop {
                let mut h = String::new();
                reader.read_line(&mut h).unwrap();
                if h == "\r\n" || h.is_empty() {
                    break;
                }
                if let Some(v) = h.to_ascii_lowercase().strip_prefix("content-length:") {
                    len = v.trim().parse().unwrap();
                }
            }
            let mut body = vec![0u8; len];
            reader.read_exact(&mut body).unwrap();
            seen.push(format!("{path} {}", String::from_utf8_lossy(&body)));
            let reply = if path.ends_with("/models") {
                serde_json::json!({"data": [{"id": "mock-model"}]})
            } else {
                serde_json::json!({"choices": [{"message": {"content": queue.pop_front().unwrap()}}]})
            }
            .to_string();
            let mut s = stream;
            write!(
                s,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                reply.len(),
                reply
            )
            .unwrap();
        }
        seen
    });
    (base, handle)
}

#[test]
fn ask_with_an_openai_compatible_server_and_audit() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("fx");
    let d = dir.to_str().unwrap();
    let (_, out, _) = harvest(&["fixture", d, "--json"]);
    let key = serde_json::from_str::<Value>(&out).unwrap()["pubkey"]
        .as_str()
        .unwrap()
        .to_string();
    let (base, server) = mock_server(vec![
        serde_json::json!({"queries": ["shift inspection competent person"], "ambiguous": false, "clarify": null}).to_string(),
        serde_json::json!({"section_ids": ["ex.3", "ex.999"]}).to_string(),
        serde_json::json!({"segments": [
            {"t": "text", "text": "A competent person inspects before each shift."},
            {"t": "quote", "section_id": "ex.3", "text": "A competent person must inspect the machine each shift before use."}
        ]})
        .to_string(),
    ]);
    let db = tmp.path().join("records.db");
    let (code, out, err) = harvest(&[
        "ask",
        d,
        "who checks the machine every shift",
        "--llm",
        &base,
        "--audit",
        db.to_str().unwrap(),
        "--pubkey",
        &key,
        "--json",
    ]);
    assert_eq!(code, 0, "{err}");
    let a: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(a["mode"], "composed");
    assert_eq!(a["model"], "mock-model", "{err}");
    assert_eq!(a["citations"], serde_json::json!(["ex.3"]));
    let seen = server.join().unwrap();
    assert!(seen[0].starts_with("/v1/models"));
    assert!(seen[1].contains("\"json_schema\"") && seen[1].contains("\"expansion\""));
    // Reasoning is switched off per request, as `--reasoning-budget 0` does.
    let sent: Value = serde_json::from_str(seen[1].split_once(' ').unwrap().1).unwrap();
    assert_eq!(sent["reasoning_budget_tokens"], 0, "{}", seen[1]);
    assert!(seen[2].contains("\"selection\""));
    assert!(seen[3].contains("answer_segments"));
    // Only the selected section was offered to compose.
    assert!(
        seen[3].contains("competent person must inspect") && !seen[3].contains("Tracked machines")
    );

    let (code, out, err) = harvest(&["audit", db.to_str().unwrap(), "--json"]);
    assert_eq!(code, 0, "{err}");
    let r: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(r["ok"], true);
    assert_eq!(r["entries"], 1);
    assert_eq!(r["modes"]["composed"], 1);

    let (code, _, _) = harvest(&["audit", tmp.path().join("missing.db").to_str().unwrap()]);
    assert_eq!(code, 1);
}

#[test]
fn a_declined_question_is_queued_and_the_outbox_flushes_to_a_folder() {
    let tmp = tempfile::tempdir().unwrap();
    let dir = tmp.path().join("fx");
    let d = dir.to_str().unwrap();
    let (_, out, _) = harvest(&["fixture", d, "--json"]);
    let key = serde_json::from_str::<Value>(&out).unwrap()["pubkey"]
        .as_str()
        .unwrap()
        .to_string();
    let db = tmp.path().join("records.db");
    let db = db.to_str().unwrap();
    let (code, out, err) = harvest(&[
        "ask",
        d,
        "best pizza recipe",
        "--audit",
        db,
        "--pubkey",
        &key,
        "--json",
    ]);
    assert_eq!(code, 0, "{err}");
    assert_eq!(
        serde_json::from_str::<Value>(&out).unwrap()["mode"],
        "declined"
    );

    let (code, out, err) = harvest(&["outbox", db, "--json"]);
    assert_eq!(code, 0, "{err}");
    let s: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(s["status"]["pending_by_kind"]["miss"], 1);

    let drive = tmp.path().join("drive");
    let (code, out, err) = harvest(&["outbox", db, "--to", drive.to_str().unwrap(), "--json"]);
    assert_eq!(code, 0, "{err}");
    let s: Value = serde_json::from_str(&out).unwrap();
    assert_eq!(s["flush"]["acked"], 1);
    assert_eq!(s["status"]["pending"], 0);
    assert_eq!(std::fs::read_dir(&drive).unwrap().count(), 1);

    // The audit log in the same file still verifies.
    let (code, out, _) = harvest(&["audit", db, "--json"]);
    assert_eq!(code, 0);
    assert_eq!(
        serde_json::from_str::<Value>(&out).unwrap()["modes"]["declined"],
        1
    );
}
