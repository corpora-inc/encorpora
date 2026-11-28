//! The checked-in API contract (`harvest/api/`) is generated from the Rust
//! types; this fails when it is stale. Regenerate with
//! `cargo run -- api-schema ../api` (or `HARVEST_API_BLESS=1 cargo test`).

use harvest_core::api::schema;
use std::path::Path;

#[test]
fn checked_in_api_files_are_current() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../api");
    let files = [
        (schema::SCHEMA_FILE, schema::schema_text()),
        (schema::TS_FILE, schema::typescript()),
    ];
    if std::env::var_os("HARVEST_API_BLESS").is_some() {
        std::fs::create_dir_all(&dir).unwrap();
        for (name, text) in &files {
            std::fs::write(dir.join(name), text).unwrap();
        }
    }
    for (name, text) in &files {
        let on_disk = std::fs::read_to_string(dir.join(name)).unwrap_or_default();
        assert!(
            &on_disk == text,
            "harvest/api/{name} is stale: run `cargo run -- api-schema ../api` in harvest/core"
        );
    }
}

#[test]
fn every_method_has_a_schema_and_a_type() {
    let s = schema::schema();
    let ts = schema::typescript();
    for m in harvest_core::api::METHODS {
        assert!(s["methods"][m]["params"].is_object(), "{m} params");
        let r = &s["methods"][m]["result"];
        assert!(
            r.is_object() || r == &serde_json::Value::Bool(true),
            "{m} result"
        );
        assert!(
            ts.contains(&format!("\"{m}\": {{ params:")),
            "{m} in types.ts"
        );
    }
    // Every reference resolves.
    let text = s.to_string();
    for r in text.split("\"#/$defs/").skip(1) {
        let name = r.split('"').next().unwrap();
        assert!(
            s["$defs"][name].is_object() || s["$defs"][name].is_boolean(),
            "dangling ref {name}"
        );
    }
}
