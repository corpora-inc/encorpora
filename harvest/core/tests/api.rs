//! The JSON API over the device records and a maintenance pack, and its
//! HTTP transport.

use harvest_core::Pack;
use harvest_core::api::{self, Host};
use harvest_core::fixture;
use harvest_core::fixture_maint;
use harvest_core::records::{AssetRegistry, Records};
use serde_json::{Value, json};
use std::sync::Arc;

struct Env {
    _tmp: tempfile::TempDir,
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
        pack,
        rec,
    }
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
    let bad = api::call(
        &h,
        "run.record",
        json!({"run_id": rid, "ord": 5, "outcome": "value", "value": "2611"}),
    )
    .unwrap_err();
    assert!(
        bad.message
            .contains("send outcome note with a non-empty note"),
        "{}",
        bad.message
    );
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
    assert_eq!(f["flush"]["acked"], 1);
    let s = ok(&h, "sync.status", json!({}));
    assert_eq!(s["hub"]["reachable"], true);
    assert!(s["last_synced_at"].is_string());
    assert_eq!(s["pending"], 0);
}

#[test]
fn pack_list_names_every_installed_pack() {
    let Env { _tmp, pack, rec } = env();
    let crane_dir = _tmp.path().join("crane");
    fixture::build(&crane_dir, "2026.1.0-1").unwrap();
    let crane = Arc::new(Pack::open(&crane_dir, &[fixture::trusted_key()]).unwrap());
    let h = Host::new(vec![pack, crane.clone()], rec);
    let list = ok(&h, "pack.list", json!({}));
    let list = list.as_array().unwrap();
    assert_eq!(list.len(), 2);
    let ids: Vec<&str> = list
        .iter()
        .map(|p| p["pack_id"].as_str().unwrap())
        .collect();
    assert!(ids.windows(2).all(|w| w[0] < w[1]), "sorted by id");
    let pump = list.iter().find(|p| p["pack_id"] == "pump40").unwrap();
    assert_eq!(pump["version"], "2026.3.1-1");
    assert_eq!(pump["has_fault_trees"], true);
    assert!(!pump["title"].as_str().unwrap().is_empty());
    assert!(!pump["licenses"].as_array().unwrap().is_empty());
    let roots = pump["equipment_roots"].as_array().unwrap();
    assert!(!roots.is_empty() && roots.iter().all(|e| e["parent_id"].is_null()));
    let c = list
        .iter()
        .find(|p| p["pack_id"] == crane.pack_id())
        .unwrap();
    assert_eq!(c["has_fault_trees"], false);
}
