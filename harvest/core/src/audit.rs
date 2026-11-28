//! The on-device audit log: one append-only, hash-chained row per query.
//!
//! Each row holds the JSON of an [`AuditEntry`] and
//! `hash = SHA-256(prev_hash ‖ "\n" ‖ entry)`, with 64 zeros before the first
//! row. Triggers refuse UPDATE and DELETE; [`verify_chain`] recomputes every
//! hash, so an edit made around the triggers is detected.

use crate::answer::{AskResponse, AskTrace, Mode};
use crate::crypt::{self, RecordKey};
use crate::error::{Error, Result};
use crate::packs::hex_encode;
use rusqlite::{Connection, OptionalExtension, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

const GENESIS: &str = "0000000000000000000000000000000000000000000000000000000000000000";

const DDL: &str = "
CREATE TABLE IF NOT EXISTS audit (
  seq       INTEGER PRIMARY KEY,
  ts        TEXT NOT NULL,
  entry     TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash      TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit
  BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit
  BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
";

/// One retrieved chunk as the log keeps it.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AuditChunk {
    pub chunk_id: String,
    pub lexical: f64,
    pub dense: f64,
    pub score: f64,
}

/// What one query did.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AuditEntry {
    pub ts: String,
    pub query: String,
    pub normalized: String,
    pub expansions: Vec<String>,
    pub chunks: Vec<AuditChunk>,
    pub pack_id: String,
    pub pack_version: String,
    pub model: Option<String>,
    pub mode: Mode,
    /// `supported` | `partially_supported` (the checker dropped segments) |
    /// `declined` | `clarify`.
    pub verdict: String,
    pub answer_id: Option<String>,
    pub citations: Vec<String>,
    pub dropped: usize,
    pub elapsed_ms: u64,
}

impl AuditEntry {
    /// The entry for an answer.
    pub fn from_answer(pack_id: &str, query: &str, resp: &AskResponse, trace: &AskTrace) -> Self {
        let verdict = match resp.mode {
            Mode::Declined => "declined",
            Mode::Clarify => "clarify",
            _ if resp.check.dropped > 0 || !resp.check.quotes_ok || !resp.check.cites_ok => {
                "partially_supported"
            }
            _ => "supported",
        };
        Self {
            ts: now_rfc3339(),
            query: query.to_string(),
            normalized: trace.normalized.clone(),
            expansions: trace.expansions.clone(),
            chunks: resp
                .retrieved
                .iter()
                .map(|r| AuditChunk {
                    chunk_id: r.chunk_id.clone(),
                    lexical: r.lexical,
                    dense: r.dense,
                    score: r.score,
                })
                .collect(),
            pack_id: pack_id.to_string(),
            pack_version: resp.pack_version.clone(),
            model: resp.model.clone(),
            mode: resp.mode,
            verdict: verdict.to_string(),
            answer_id: resp.answer_id.clone(),
            citations: resp.citations.clone(),
            dropped: resp.check.dropped,
            elapsed_ms: resp.elapsed_ms,
        }
    }
}

/// One recorded action that is not a question: a troubleshooting job's
/// start, answer, correction and close, a lesson, a field-note install.
/// It chains like an answer entry.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AuditEvent {
    pub ts: String,
    /// `job.start` | `job.answer` | `job.back` | `job.close` | `lesson.create` | `field.install` | ….
    pub event: String,
    pub pack_id: Option<String>,
    pub pack_version: Option<String>,
    /// What the event is about (a job id, a lesson id, a bundle stream).
    pub subject: String,
    /// The node the job was at.
    #[serde(default)]
    pub node_id: Option<String>,
    /// What was asked there: the node's verbatim text.
    #[serde(default)]
    pub asked: Option<String>,
    /// What was recorded.
    #[serde(default)]
    pub result: Option<serde_json::Value>,
    /// Where code sent the job next.
    #[serde(default)]
    pub next_node: Option<String>,
    #[serde(default)]
    pub detail: serde_json::Value,
}

impl AuditEvent {
    pub fn new(event: &str, subject: &str) -> Self {
        Self {
            ts: now_rfc3339(),
            event: event.to_string(),
            pack_id: None,
            pack_version: None,
            subject: subject.to_string(),
            node_id: None,
            asked: None,
            result: None,
            next_node: None,
            detail: serde_json::Value::Null,
        }
    }
}

/// One row of the log, as read back.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AuditRecord {
    Answer { seq: i64, entry: AuditEntry },
    Event { seq: i64, event: AuditEvent },
}

/// Create the audit table and triggers if absent.
pub fn init(conn: &Connection) -> Result<()> {
    conn.execute_batch(DDL)?;
    Ok(())
}

/// The stored bytes of an entry; the chain hashes exactly these.
fn entry_bytes(entry: &AuditEntry) -> Result<String> {
    Ok(serde_json::to_string(entry)?)
}

fn chain_hash(prev: &str, entry: &str) -> String {
    let mut h = Sha256::new();
    h.update(prev.as_bytes());
    h.update(b"\n");
    h.update(entry.as_bytes());
    hex_encode(&h.finalize())
}

/// Append one entry; returns its sequence number.
pub fn append(conn: &Connection, entry: &AuditEntry) -> Result<i64> {
    init(conn)?;
    // IMMEDIATE takes the write lock before reading the tip, so two writers
    // on separate connections cannot both chain onto the same row.
    let tx = rusqlite::Transaction::new_unchecked(conn, rusqlite::TransactionBehavior::Immediate)?;
    let seq = append_locked(&tx, entry)?;
    tx.commit()?;
    Ok(seq)
}

/// Append inside a transaction the caller already holds with the write lock
/// (`BEGIN IMMEDIATE`), to commit the entry together with other writes.
pub fn append_locked(tx: &Connection, entry: &AuditEntry) -> Result<i64> {
    append_locked_with(tx, None, entry)
}

fn entry_aad(prev_hash: &str) -> String {
    format!("audit.entry:{prev_hash}")
}

/// [`append_locked`] for a store encrypted with `key`: the entry is sealed
/// (bound to its place in the chain) and the chain hashes the sealed text, so
/// the chain verifies without the key.
pub fn append_locked_with(
    tx: &Connection,
    key: Option<&RecordKey>,
    entry: &AuditEntry,
) -> Result<i64> {
    append_text_locked(tx, key, &entry.ts, &entry_bytes(entry)?)
}

/// Append an event inside a transaction holding the write lock.
pub fn append_event_locked_with(
    tx: &Connection,
    key: Option<&RecordKey>,
    event: &AuditEvent,
) -> Result<i64> {
    append_text_locked(tx, key, &event.ts, &serde_json::to_string(event)?)
}

fn append_text_locked(
    tx: &Connection,
    key: Option<&RecordKey>,
    ts: &str,
    text: &str,
) -> Result<i64> {
    // A keyless append to an encrypted store (or a wrong key) is refused.
    crate::records::check_key(tx, key)?;
    let prev: String = tx
        .query_row(
            "SELECT hash FROM audit ORDER BY seq DESC LIMIT 1",
            [],
            |r| r.get(0),
        )
        .optional()?
        .unwrap_or_else(|| GENESIS.to_string());
    let bytes = crypt::seal_opt(key, &entry_aad(&prev), text)?;
    let hash = chain_hash(&prev, &bytes);
    tx.execute(
        "INSERT INTO audit (ts, entry, prev_hash, hash) VALUES (?1, ?2, ?3, ?4)",
        params![ts, bytes, prev, hash],
    )?;
    Ok(tx.last_insert_rowid())
}

/// The result of [`verify_chain`].
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ChainReport {
    pub ok: bool,
    pub entries: u64,
    /// The first sequence number whose hash or link is wrong.
    pub first_bad: Option<i64>,
    /// Answers per mode (`sealed` counts entries read without the key).
    pub modes: BTreeMap<String, u64>,
    /// `baked / (all answers)`; `None` with no answers.
    pub bake_hit_rate: Option<f64>,
    /// Events (not answers) per event name.
    #[serde(default)]
    pub events: BTreeMap<String, u64>,
    /// The hash of the newest entry. The chain detects edits but cannot see
    /// its own newest rows removed: a host that needs that anchors
    /// `(entries, head_hash)` outside the database (an upload, a signature).
    pub head_hash: Option<String>,
}

fn has_table(conn: &Connection) -> Result<bool> {
    Ok(conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'audit'",
            [],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

/// Recompute every link. Reads only: a database with no audit table is an
/// empty, valid log.
pub fn verify_chain(conn: &Connection) -> Result<ChainReport> {
    verify_chain_with(conn, None)
}

/// [`verify_chain`] for a store encrypted with `key`. Without the key the
/// links still verify; modes count as `sealed` and there is no hit rate.
pub fn verify_chain_with(conn: &Connection, key: Option<&RecordKey>) -> Result<ChainReport> {
    let mut report = ChainReport {
        ok: true,
        entries: 0,
        first_bad: None,
        modes: BTreeMap::new(),
        bake_hit_rate: None,
        head_hash: None,
        events: BTreeMap::new(),
    };
    let mut answers = 0u64;
    if !has_table(conn)? {
        return Ok(report);
    }
    let mut stmt = conn.prepare("SELECT seq, entry, prev_hash, hash FROM audit ORDER BY seq")?;
    let mut rows = stmt.query([])?;
    let mut prev = GENESIS.to_string();
    while let Some(r) = rows.next()? {
        let seq: i64 = r.get(0)?;
        let entry: String = r.get(1)?;
        let prev_hash: String = r.get(2)?;
        let hash: String = r.get(3)?;
        report.entries += 1;
        if report.ok && (prev_hash != prev || chain_hash(&prev_hash, &entry) != hash) {
            report.ok = false;
            report.first_bad = Some(seq);
        }
        if key.is_none() && crypt::is_sealed(&entry) {
            *report.modes.entry("sealed".into()).or_insert(0) += 1;
            prev = hash;
            continue;
        }
        let opened = crypt::open_opt(key, &entry_aad(&prev_hash), &entry).ok();
        let answer = opened
            .as_deref()
            .and_then(|t| serde_json::from_str::<AuditEntry>(t).ok());
        let event = opened
            .as_deref()
            .filter(|_| answer.is_none())
            .and_then(|t| serde_json::from_str::<AuditEvent>(t).ok());
        if let Some(e) = answer {
            answers += 1;
            let mode = serde_json::to_value(e.mode)?
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            *report.modes.entry(mode).or_insert(0) += 1;
        } else if let Some(ev) = event {
            *report.events.entry(ev.event).or_insert(0) += 1;
        } else if report.ok {
            report.ok = false;
            report.first_bad = Some(seq);
        }
        prev = hash;
    }
    if report.entries > 0 {
        report.head_hash = Some(prev);
        if !report.modes.contains_key("sealed") && answers > 0 {
            let baked = *report.modes.get("baked").unwrap_or(&0) as f64;
            report.bake_hit_rate = Some(baked / answers as f64);
        }
    }
    Ok(report)
}

/// Entries, oldest first (for review export).
pub fn entries(conn: &Connection) -> Result<Vec<(i64, AuditEntry)>> {
    entries_with(conn, None)
}

/// [`entries`] for a store encrypted with `key`. Answer entries only;
/// events are read with [`records_with`].
pub fn entries_with(conn: &Connection, key: Option<&RecordKey>) -> Result<Vec<(i64, AuditEntry)>> {
    Ok(records_with(conn, key)?
        .into_iter()
        .filter_map(|r| match r {
            AuditRecord::Answer { seq, entry } => Some((seq, entry)),
            AuditRecord::Event { .. } => None,
        })
        .collect())
}

/// Every row of the log, answers and events, oldest first.
pub fn records_with(conn: &Connection, key: Option<&RecordKey>) -> Result<Vec<AuditRecord>> {
    if !has_table(conn)? {
        return Ok(Vec::new());
    }
    let mut stmt = conn.prepare("SELECT seq, entry, prev_hash FROM audit ORDER BY seq")?;
    let rows = stmt
        .query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    rows.into_iter()
        .map(|(s, e, prev)| {
            let text = crypt::open_opt(key, &entry_aad(&prev), &e)?;
            if let Ok(entry) = serde_json::from_str::<AuditEntry>(&text) {
                return Ok(AuditRecord::Answer { seq: s, entry });
            }
            serde_json::from_str::<AuditEvent>(&text)
                .map(|event| AuditRecord::Event { seq: s, event })
                .map_err(|e| Error::Pack(format!("audit {s}: {e}")))
        })
        .collect()
}

/// UTC now as `YYYY-MM-DDTHH:MM:SS.mmmZ`.
pub fn now_rfc3339() -> String {
    let d = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    rfc3339(d.as_secs() as i64, d.subsec_millis())
}

/// Civil-from-days (Howard Hinnant's algorithm).
pub fn rfc3339(secs: i64, millis: u32) -> String {
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!(
        "{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}.{millis:03}Z",
        rem / 3600,
        (rem / 60) % 60,
        rem % 60
    )
}
