//! A tiny, fictional, signed schema-v1 pack for tests and for hosts that need
//! a pack before a real one exists (`harvest fixture <dir>`).
//!
//! The corpus ("Example Machinery Rules") is invented. The signing key is
//! derived from a public string: it proves nothing and must never be trusted
//! outside tests.

use crate::embed::{Embedder, HashingEmbedder, quantize_i8};
use crate::error::Result;
use crate::pack::SCHEMA_V1;
use crate::packs::{self, TrustedKey};
use ed25519_dalek::SigningKey;
use rusqlite::{Connection, params};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub const PACK_ID: &str = "fixture";
pub const DB_FILE: &str = "fixture.sqlite";
/// The fixture's embedder (vectors are baked with it).
pub const EMBED_DIM: usize = 256;

/// The fixture signing key: SHA-256 of a public string. Test use only.
pub fn signing_key() -> SigningKey {
    let seed: [u8; 32] =
        Sha256::digest(b"harvest-core fixture signing key (public, test only)").into();
    SigningKey::from_bytes(&seed)
}

/// The fixture's trusted key.
pub fn trusted_key() -> TrustedKey {
    TrustedKey::from_bytes(signing_key().verifying_key().as_bytes()).expect("valid key")
}

/// The fixture public key as base64.
pub fn public_key_base64() -> String {
    use base64::Engine as _;
    base64::engine::general_purpose::STANDARD.encode(signing_key().verifying_key().as_bytes())
}

/// A built fixture.
#[derive(Debug, Clone)]
pub struct Fixture {
    pub dir: PathBuf,
    pub version: String,
}

/// Build the fixture pack at `dir` (created; must not hold another pack).
pub fn build(dir: &Path, version: &str) -> Result<Fixture> {
    build_with(dir, version, |_| Ok(()))
}

/// Build, letting `edit` change the database before it is sealed and signed.
pub fn build_with(
    dir: &Path,
    version: &str,
    edit: impl FnOnce(&Connection) -> Result<()>,
) -> Result<Fixture> {
    fs::create_dir_all(dir)?;
    let db = dir.join(DB_FILE);
    if db.exists() {
        fs::remove_file(&db)?;
    }
    {
        let conn = Connection::open(&db)?;
        conn.pragma_update(None, "journal_mode", "DELETE")?;
        conn.execute_batch(SCHEMA_V1)?;
        populate(&conn, version)?;
        edit(&conn)?;
        seal(&conn)?;
    }
    write_manifest(dir, PACK_ID, version, &[DB_FILE], None, &signing_key())?;
    Ok(Fixture {
        dir: dir.to_path_buf(),
        version: version.to_string(),
    })
}

/// Write and sign `manifest.json` for `files` in `dir`.
pub fn write_manifest(
    dir: &Path,
    pack_id: &str,
    version: &str,
    files: &[&str],
    base_version: Option<&str>,
    key: &SigningKey,
) -> Result<()> {
    let mut entries = Vec::new();
    for f in files {
        let p = dir.join(f);
        entries.push(json!({
            "path": f,
            "sha256": packs::sha256_file(&p)?,
            "bytes": fs::metadata(&p)?.len(),
        }));
    }
    let mut manifest = json!({
        "pack_id": pack_id,
        "version": version,
        "schema_version": 1,
        "files": entries,
    });
    if let Some(b) = base_version {
        manifest["base_version"] = json!(b);
    }
    packs::sign_manifest(&mut manifest, key)?;
    fs::write(
        dir.join(packs::MANIFEST),
        serde_json::to_vec_pretty(&manifest)?,
    )?;
    Ok(())
}

/// Rebuild the FTS indexes and the vectors from the current rows.
pub fn seal(conn: &Connection) -> Result<()> {
    conn.execute("INSERT INTO chunk_fts(chunk_fts) VALUES('rebuild')", [])?;
    conn.execute("INSERT INTO alias_fts(alias_fts) VALUES('rebuild')", [])?;
    conn.execute("DELETE FROM chunk_vec", [])?;
    let embedder = HashingEmbedder::new(EMBED_DIM);
    let chunks: Vec<(String, String)> = {
        let mut stmt = conn.prepare("SELECT chunk_id, text FROM chunk ORDER BY chunk_id")?;
        stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?
    };
    for (id, text) in chunks {
        let v = embedder.embed_document(&text)?;
        let (q, scale) = quantize_i8(&v);
        let blob: Vec<u8> = q.iter().map(|&b| b as u8).collect();
        conn.execute(
            "INSERT INTO chunk_vec (chunk_id, vec, scale) VALUES (?1, ?2, ?3)",
            params![id, blob, scale as f64],
        )?;
    }
    // Course-tree nodes, when the pack has the table (a test may drop it to
    // stand in for an older pack).
    let has_nodes = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE name = 'course_node_vec'")?
        .exists([])?;
    if has_nodes {
        conn.execute("DELETE FROM course_node_vec", [])?;
        let nodes: Vec<(String, String)> = {
            let mut stmt = conn.prepare(
                "SELECT node_id, title || char(10) || summary || char(10) || hard || char(10) ||
                        mistakes || char(10) || exam FROM course_node ORDER BY node_id",
            )?;
            stmt.query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?
        };
        for (id, text) in nodes {
            let v = embedder.embed_document(&text)?;
            let (q, scale) = quantize_i8(&v);
            let blob: Vec<u8> = q.iter().map(|&b| b as u8).collect();
            conn.execute(
                "INSERT INTO course_node_vec (node_id, vec, scale) VALUES (?1, ?2, ?3)",
                params![id, blob, scale as f64],
            )?;
        }
    }
    Ok(())
}

const PROV: &str = "prov-fixture";

fn sha(s: &str) -> String {
    packs::hex_encode(&Sha256::digest(s.as_bytes()))
}

/// Sections: (id, parent, citation, heading, text).
pub const SECTIONS: &[(&str, Option<&str>, &str, &str, &str)] = &[
    (
        "ex.1",
        None,
        "§1",
        "Scope",
        "These rules apply to lifting machines used in construction work.",
    ),
    (
        "ex.2",
        None,
        "§2",
        "Clearance from energized lines",
        "Before work begins, the controlling party must identify energized lines within the work zone. No part of the machine, load line or load may come closer than 10 feet to an energized line rated up to 50 kV. For lines rated over 50 kV, the minimum clearance increases as listed in Table A.",
    ),
    (
        "ex.2(a)",
        Some("ex.2"),
        "§2(a)",
        "Spotter",
        "A dedicated spotter must be used when any part of the machine could come within the minimum clearance distance of an energized line.",
    ),
    (
        "ex.3",
        None,
        "§3",
        "Inspection intervals",
        "A competent person must inspect the machine each shift before use. A qualified person must perform a periodic inspection at least once every 12 months.",
    ),
    (
        "ex.4",
        None,
        "§4",
        "Stabilizers",
        "When stabilizers are used, they must be fully extended or deployed as specified in the load chart. Capacity with stabilizers retracted is limited to the on-rubber rating.",
    ),
    (
        "ex.5",
        None,
        "§5",
        "Ground for tracked travel",
        "Tracked machines must travel only on ground that is firm, drained and graded to support the machine and its load.",
    ),
    (
        "ex.6",
        None,
        "§6",
        "Wind",
        "Operations must stop when wind speed exceeds the limit set by the manufacturer.",
    ),
];

fn populate(conn: &Connection, version: &str) -> Result<()> {
    let meta = [
        ("pack_id", PACK_ID.to_string()),
        ("version", version.to_string()),
        ("schema_version", "1".to_string()),
        ("built_at", "2026-01-01T00:00:00Z".to_string()),
        ("corpus_id", "example-rules".to_string()),
        (
            "embedder_id",
            HashingEmbedder::new(EMBED_DIM).id().to_string(),
        ),
        ("embed_dim", EMBED_DIM.to_string()),
        ("bake_backends", "[\"deterministic\"]".to_string()),
        ("source_count", "1".to_string()),
    ];
    for (k, v) in meta {
        conn.execute(
            "INSERT INTO pack_meta (key, value) VALUES (?1, ?2)",
            params![k, v],
        )?;
    }
    conn.execute(
        "INSERT INTO provenance VALUES (?1, 'deterministic', 'none', 'fixture', '1', ?2, ?2, ?2,
         '2026-01-01T00:00:00Z', 'fixture', 'pass', NULL)",
        params![PROV, sha("fixture")],
    )?;
    conn.execute(
        "INSERT INTO source VALUES ('ex-rules', 'Example Machinery Rules', 'Harvest test fixture',
         'https://example.invalid/rules', '2026-01-01', '2026-01-01T00:00:00Z', ?1,
         'text/plain', 'fixture')",
        [sha("ex-rules")],
    )?;
    for (ord, (id, parent, citation, heading, text)) in SECTIONS.iter().enumerate() {
        conn.execute(
            "INSERT INTO section VALUES (?1, 'ex-rules', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'en')",
            params![
                id,
                parent,
                ord as i64,
                if parent.is_some() { 2 } else { 1 },
                if parent.is_some() {
                    "paragraph"
                } else {
                    "section"
                },
                citation,
                heading,
                text,
                sha(text)
            ],
        )?;
        conn.execute(
            "INSERT INTO chunk VALUES (?1, 'section', ?2, ?3, 'en')",
            params![format!("c-{id}"), id, format!("{heading}. {text}")],
        )?;
    }
    conn.execute_batch(
        r#"
        INSERT INTO equipment VALUES ('machine', NULL, 'lifting machine', '["machine"]');
        INSERT INTO equipment VALUES ('machine-wheeled', 'machine', 'wheeled machine', '["truck mounted","mobile machine"]');
        INSERT INTO equipment VALUES ('machine-tracked', 'machine', 'tracked machine', '["crawler"]');
        INSERT INTO applies_to VALUES ('section', 'ex.4', 'machine-wheeled');
        INSERT INTO applies_to VALUES ('section', 'ex.5', 'machine-tracked');
        INSERT INTO term VALUES ('t-spotter', 'spotter', 'A person who watches clearance and warns the operator.', 'ex.2(a)', 'A dedicated spotter must be used', 'en', 'prov-fixture');
        INSERT INTO chunk VALUES ('c-t-spotter', 'term', 't-spotter', 'spotter: A person who watches clearance and warns the operator.', 'en');
        INSERT INTO fact VALUES ('f-clear-10', 'ex.2', 'clearance', 'Keep the machine at least 10 feet from lines rated up to 50 kV.',
          'No part of the machine, load line or load may come closer than 10 feet to an energized line rated up to 50 kV', '10', 'feet', 'en', 'prov-fixture');
        INSERT INTO fact VALUES ('f-int-12', 'ex.3', 'interval', 'A periodic inspection is due at least every 12 months.',
          'at least once every 12 months', '12', 'months', 'en', 'prov-fixture');
        INSERT INTO fact VALUES ('f-int-shift', 'ex.3', 'interval', 'Inspect each shift before use.',
          'inspect the machine each shift before use', NULL, NULL, 'en', 'prov-fixture');
        INSERT INTO chunk VALUES ('c-f-clear-10', 'fact', 'f-clear-10', 'Keep the machine at least 10 feet from lines rated up to 50 kV.', 'en');
        INSERT INTO chunk VALUES ('c-f-int-12', 'fact', 'f-int-12', 'A periodic inspection is due at least every 12 months.', 'en');
        INSERT INTO explanation VALUES ('ex.2', 'trainee', 'Power lines can arc to a machine that gets close. Keep every part of the machine and load well away, and use a spotter.', 'en', 'prov-fixture');
        INSERT INTO explanation VALUES ('ex.2', 'operator', 'Identify lines before work; hold the minimum clearance for the line voltage.', 'en', 'prov-fixture');
        INSERT INTO explanation VALUES ('ex.2', 'inspector', 'Check that lines were identified and the clearance for the voltage was planned.', 'en', 'prov-fixture');
        INSERT INTO chunk VALUES ('e:ex.2:trainee', 'explanation', 'ex.2:trainee', 'Power lines can arc to a machine that gets close. Keep every part of the machine and load well away, and use a spotter.', 'en');
        INSERT INTO topic VALUES ('topic-lines', NULL, 1, 'Energized lines', 'Clearance and spotters.', 'en');
        INSERT INTO skill VALUES ('skill-clearance', 'topic-lines', 'Minimum clearance', 'en');
        INSERT INTO lesson VALUES ('lesson-lines', 'topic-lines', 1, 'Clearance basics',
          '[{"t":"text","text":"Clearance depends on voltage."},{"t":"cite","section_id":"ex.2"}]', 'en', 'prov-fixture');
        INSERT INTO diagram VALUES ('dia-clearance', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'Clearance zone', 'A circle around a line', '["ex.2"]', 'en', 'prov-fixture');
        INSERT INTO question VALUES ('q-clear-1', 'skill-clearance', NULL, 'mc', 'Minimum clearance from a 40 kV line?',
          '["5 feet","10 feet","15 feet","20 feet"]', '1', '["Too close","Stated in §2","More than required","More than required"]', '["ex.2"]', 0.3, 'en', 'prov-fixture');
        INSERT INTO procedure VALUES ('proc-shift', 'Shift inspection', 'inspection', 'Before each shift.', '["operator","inspector"]', 'en', 'prov-fixture');
        INSERT INTO proc_step VALUES ('proc-shift', 1, 'Check the load line for damage.', '{"trainee":"Look along the whole line.","operator":"Inspect the line.","inspector":"Record findings."}',
          'pass_fail', '["ex.3"]', '{"guidance":"Remove from service until repaired.","action":"tag out","section_id":"ex.3","quote":"A competent person must inspect the machine each shift before use."}', 'en', 'prov-fixture');
        INSERT INTO chunk VALUES ('c-step-shift-1', 'proc_step', 'proc-shift#1', 'Shift inspection: check the load line for damage.', 'en');
        INSERT INTO answer VALUES ('a-clearance', 'How close can the machine get to a power line?',
          '[{"t":"text","text":"For lines rated up to 50 kV:"},{"t":"quote","section_id":"ex.2","text":"No part of the machine, load line or load may come closer than 10 feet to an energized line rated up to 50 kV."},{"t":"cite","section_id":"ex.2"}]',
          '["ex.2"]', NULL, 'en', 'prov-fixture');
        INSERT INTO answer_alias VALUES ('how close can the machine get to a power line', 'a-clearance', 'en');
        INSERT INTO answer_alias VALUES ('minimum clearance from power lines', 'a-clearance', 'en');
        INSERT INTO answer_alias VALUES ('how far from an energized line must the machine stay', 'a-clearance', 'en');
        INSERT INTO answer VALUES ('a-periodic-op', 'How often is a periodic inspection required?',
          '[{"t":"text","text":"Periodic inspection:"},{"t":"quote","section_id":"ex.3","text":"A qualified person must perform a periodic inspection at least once every 12 months."},{"t":"cite","section_id":"ex.3"}]',
          '["ex.3"]', 'operator', 'en', 'prov-fixture');
        INSERT INTO answer VALUES ('a-periodic-tr', 'How often is a periodic inspection required?',
          '[{"t":"text","text":"A qualified person checks the machine thoroughly at least once a year:"},{"t":"quote","section_id":"ex.3","text":"at least once every 12 months"},{"t":"cite","section_id":"ex.3"}]',
          '["ex.3"]', 'trainee', 'en', 'prov-fixture');
        INSERT INTO answer_alias VALUES ('how often is a periodic inspection required', 'a-periodic-op', 'en');
        INSERT INTO answer_alias VALUES ('how often is a periodic inspection required', 'a-periodic-tr', 'en');
        INSERT INTO answer_alias VALUES ('periodic inspection interval', 'a-periodic-op', 'en');
        CREATE TABLE synonym (phrase TEXT NOT NULL, canonical TEXT NOT NULL, lang TEXT NOT NULL);
        INSERT INTO synonym VALUES ('power line', 'energized line', 'en');
        INSERT INTO synonym VALUES ('outriggers', 'stabilizers', 'en');
        INSERT INTO synonym VALUES ('stick', 'boom', 'en');
        "#,
    )?;
    let counts = json!({"section": SECTIONS.len()});
    conn.execute(
        "INSERT INTO pack_meta (key, value) VALUES ('row_counts', ?1)",
        [counts.to_string()],
    )?;
    Ok(())
}
