//! The hub: where devices' uploads land when a link returns.
//!
//! It stores outbox items idempotently by `item_id` and answers with the
//! receipt shape devices already check (CONTRACT "Records and uploads").
//! Lessons wait in a review queue; a reviewer approves (optionally edited)
//! or rejects each, and every action is audited in the hub's own hash
//! chain. Approved lessons become field notes, published as signed
//! `harvest-field/1` bundles with an increasing `seq`, each carrying the
//! fleet summary aggregated across units. The hub also offers the newest
//! pack, or a delta from the version a device holds.
//!
//! Two versions of one lesson (edited on two units, or twice on one)
//! resolve by a fixed rule: the newest `updated_at` wins, then the larger
//! device id, then the larger item id. Every version is kept; the reviewer
//! sees which one won and which lost. A version that displaces an already
//! reviewed lesson reopens it.

pub mod auth;
#[cfg(feature = "hub")]
pub mod http;

use crate::audit::{AuditEvent, now_rfc3339};
use crate::error::{Error, Result};
use crate::packs::{self, FileEntry, TrustedKey, hex_encode};
use crate::records::maint::{
    FieldNoteIn, FleetAction, FleetCause, FleetCauses, FleetJobs, FleetRepeat, FleetSummary,
    LessonStatus, NoteCounts, NoteScope, day_number,
};
use crate::records::{JOB_REPORT_FORMAT, LESSON_FORMAT, Lesson};
use crate::sync::{
    Delivery, DeviceKey, Hello, HelloReply, HubLink, PackOffer, Receipt, Refusal, Upload,
};
use ed25519_dalek::SigningKey;
use rusqlite::{Connection, OptionalExtension, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

const DDL: &str = "
CREATE TABLE IF NOT EXISTS hub_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS item (
  seq            INTEGER PRIMARY KEY,
  item_id        TEXT NOT NULL UNIQUE,
  device_id      TEXT NOT NULL,
  kind           TEXT NOT NULL,
  payload        TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  received_at    TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS device (
  device_id  TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL,
  last_seen  TEXT NOT NULL,
  items      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS job (
  job_id      TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  pack_id     TEXT NOT NULL,
  tree_id     TEXT NOT NULL,
  symptom_id  TEXT,
  equip_id    TEXT,
  asset_id    TEXT,
  system      TEXT,
  resolution  TEXT,
  opened_at   TEXT NOT NULL,
  closed_at   TEXT
);
CREATE TABLE IF NOT EXISTS lesson (
  lesson_id    TEXT PRIMARY KEY,
  current_item TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reopened     INTEGER NOT NULL DEFAULT 0,
  needs_reviewer INTEGER NOT NULL DEFAULT 0,
  first_received_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lesson_version (
  item_id     TEXT PRIMARY KEY,
  lesson_id   TEXT NOT NULL,
  device_id   TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS lesson_version_lesson ON lesson_version (lesson_id);
CREATE TABLE IF NOT EXISTS review (
  seq        INTEGER PRIMARY KEY,
  lesson_id  TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  action     TEXT NOT NULL CHECK (action IN ('approved', 'edited', 'rejected')),
  reviewer   TEXT NOT NULL,
  at         TEXT NOT NULL,
  note       TEXT,
  bundle_seq INTEGER
);
CREATE TABLE IF NOT EXISTS note (
  note_id     TEXT PRIMARY KEY,
  lesson_id   TEXT NOT NULL,
  scope       TEXT NOT NULL,
  text        TEXT NOT NULL,
  approver    TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  active      INTEGER NOT NULL,
  bundle_seq  INTEGER,
  revoke_seq  INTEGER,
  published   INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS bundle (
  seq       INTEGER PRIMARY KEY,
  issued_at TEXT NOT NULL,
  body      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enrolled (
  device_id   TEXT PRIMARY KEY,
  public_key  TEXT NOT NULL,
  name        TEXT,
  enrolled_at TEXT NOT NULL,
  enrolled_by TEXT NOT NULL,
  revoked_at  TEXT,
  revoked_by  TEXT,
  reason      TEXT
);
CREATE TABLE IF NOT EXISTS fleet_doc (
  seq       INTEGER PRIMARY KEY,
  sha256    TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  body      TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conflict (
  seq       INTEGER PRIMARY KEY,
  lesson_id TEXT NOT NULL,
  winner    TEXT NOT NULL,
  loser     TEXT NOT NULL,
  rule      TEXT NOT NULL,
  at        TEXT NOT NULL,
  class     TEXT NOT NULL DEFAULT 'auto',
  resolved_by TEXT
);
";

/// Default clock-skew bound for lesson conflicts.
pub const DEFAULT_SKEW_BOUND_MINUTES: i64 = 30;

/// How the hub stands.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct HubStatus {
    pub stream: String,
    pub key_id: String,
    pub devices: u64,
    pub items: u64,
    pub jobs: u64,
    pub lessons_pending: u64,
    pub lessons_approved: u64,
    pub lessons_rejected: u64,
    pub bundles: u64,
    pub latest_bundle: u64,
    pub conflicts: u64,
}

/// A device the hub accepts uploads from (or no longer does).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct EnrolledDevice {
    pub device_id: String,
    /// base64 ed25519 public key.
    pub public_key: String,
    pub name: Option<String>,
    pub enrolled_at: String,
    pub enrolled_by: String,
    pub revoked_at: Option<String>,
    pub revoked_by: Option<String>,
    pub reason: Option<String>,
    pub last_seen: Option<String>,
    pub items: u64,
}

fn decode_key(b64: &str) -> Result<[u8; 32]> {
    use base64::Engine as _;
    let raw = base64::engine::general_purpose::STANDARD
        .decode(b64.trim())
        .map_err(|_| Error::Signature("device key is not base64".into()))?;
    let arr: [u8; 32] = raw
        .try_into()
        .map_err(|_| Error::Signature("device key must be 32 bytes".into()))?;
    ed25519_dalek::VerifyingKey::from_bytes(&arr)
        .map_err(|e| Error::Signature(format!("device key: {e}")))?;
    Ok(arr)
}

/// What one delivery did.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ReceiveReport {
    pub receipts: Vec<Receipt>,
    /// Newly stored.
    pub stored: u64,
    /// Already stored with the same hash: answered with the same receipt.
    pub duplicates: u64,
    /// Not stored: a payload that does not match its hash, or an item id
    /// already stored with different content.
    pub refused: u64,
}

/// One stored version of a lesson.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct LessonVersion {
    pub item_id: String,
    pub device_id: String,
    pub updated_at: String,
    pub received_at: String,
    /// `current` (the winner), `superseded` (an earlier version from the
    /// winner's unit) or `lost` (another unit's version that lost the rule).
    pub state: String,
    pub lesson: Lesson,
}

/// A review action as recorded.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ReviewRecord {
    pub action: String,
    pub reviewer: String,
    pub at: String,
    pub note: Option<String>,
    pub item_id: String,
}

/// A lesson in the review queue, with every version.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ReviewItem {
    pub lesson_id: String,
    /// `pending` | `approved` | `rejected`.
    pub status: String,
    /// True when a newer version arrived after a review.
    pub reopened: bool,
    pub current: Lesson,
    pub versions: Vec<LessonVersion>,
    pub reviews: Vec<ReviewRecord>,
    pub first_received_at: String,
    /// Two units edited it within the clock-skew bound: approving it needs
    /// the reviewer to choose a version.
    pub needs_reviewer: bool,
}

/// A reviewer's changes when approving.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NoteEdit {
    /// The field note's text; from the lesson when absent.
    #[serde(default)]
    pub text: Option<String>,
    /// Where it shows; the lesson's variant, tree and symptom when absent.
    #[serde(default)]
    pub scope: Option<NoteScope>,
}

/// A conflict between two units' versions of a lesson and how it resolved.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Conflict {
    pub lesson_id: String,
    pub winner: String,
    pub loser: String,
    pub rule: String,
    pub at: String,
    /// `auto` (the rule decided) or `needs_reviewer` (the edits were within
    /// the clock-skew bound; a reviewer chooses the version).
    pub class: String,
    /// The reviewer who chose, for a `needs_reviewer` conflict.
    pub resolved_by: Option<String>,
}

/// The hub's store and key.
pub struct Hub {
    conn: Connection,
    key: SigningKey,
    stream: String,
    packs_root: Option<PathBuf>,
    pack_keys: Vec<TrustedKey>,
    repeat_window_days: i64,
    fleet_every_hours: f64,
    skew_bound_ms: i64,
}

fn fold(s: &str) -> String {
    s.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_end_matches('.')
        .to_lowercase()
}

impl Hub {
    /// Open (or create) a hub store.
    pub fn open(path: &Path, key: SigningKey, stream: &str) -> Result<Self> {
        Self::init(Connection::open(path)?, key, stream)
    }

    /// An in-memory hub (tests, simulation).
    pub fn in_memory(key: SigningKey, stream: &str) -> Result<Self> {
        Self::init(Connection::open_in_memory()?, key, stream)
    }

    fn init(conn: Connection, key: SigningKey, stream: &str) -> Result<Self> {
        if !packs::valid_id(stream) {
            return Err(Error::Invalid(format!("hub stream {stream:?}")));
        }
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch(DDL)?;
        for (table, column, ty) in [
            ("lesson", "needs_reviewer", "INTEGER NOT NULL DEFAULT 0"),
            ("conflict", "class", "TEXT NOT NULL DEFAULT 'auto'"),
            ("conflict", "resolved_by", "TEXT"),
        ] {
            let n: i64 = conn.query_row(
                "SELECT count(*) FROM pragma_table_info(?1) WHERE name = ?2",
                [table, column],
                |r| r.get(0),
            )?;
            if n == 0 {
                conn.execute_batch(&format!("ALTER TABLE {table} ADD COLUMN {column} {ty}"))?;
            }
        }
        crate::audit::init(&conn)?;
        let key_id = packs::key_id_for(key.verifying_key().as_bytes());
        let stored: Option<String> = conn
            .query_row("SELECT value FROM hub_meta WHERE key = 'key_id'", [], |r| {
                r.get(0)
            })
            .optional()?;
        match stored {
            None => {
                conn.execute(
                    "INSERT INTO hub_meta (key, value) VALUES ('key_id', ?1), ('stream', ?2)",
                    params![key_id, stream],
                )?;
            }
            Some(k) if k == key_id => {}
            Some(k) => {
                return Err(Error::Signature(format!(
                    "this hub store was made with key {k}, not {key_id}"
                )));
            }
        }
        Ok(Self {
            conn,
            key,
            stream: stream.to_string(),
            packs_root: None,
            pack_keys: Vec::new(),
            repeat_window_days: crate::maint::DEFAULT_REPEAT_WINDOW_DAYS,
            fleet_every_hours: crate::records::maint::DEFAULT_FLEET_EVERY_HOURS,
            skew_bound_ms: DEFAULT_SKEW_BOUND_MINUTES * 60_000,
        })
    }

    /// Where the packs it offers live: `<root>/<pack_id>/<version>/` full
    /// packs and `<root>/<pack_id>/delta-<base>-<target>/` deltas, checked
    /// against `keys` before they are offered.
    pub fn with_packs(mut self, root: PathBuf, keys: Vec<TrustedKey>) -> Self {
        self.packs_root = Some(root);
        self.pack_keys = keys;
        self
    }

    /// How often devices fetch a changed fleet summary (they learn it at
    /// every hello).
    pub fn with_fleet_every_hours(mut self, hours: f64) -> Self {
        self.fleet_every_hours = if hours.is_finite() && hours > 0.0 {
            hours
        } else {
            24.0
        };
        self
    }

    /// Two units' edits of one lesson closer in time than this are not
    /// ordered by their clocks: the lesson waits for a reviewer to choose.
    pub fn with_skew_bound_minutes(mut self, minutes: i64) -> Self {
        self.skew_bound_ms = minutes.max(0) * 60_000;
        self
    }

    pub fn with_repeat_window_days(mut self, days: i64) -> Self {
        self.repeat_window_days = days.max(1);
        self
    }

    /// The public key devices trust for this hub's bundles.
    pub fn trusted_key(&self) -> TrustedKey {
        TrustedKey::from_bytes(self.key.verifying_key().as_bytes()).expect("valid key")
    }

    pub fn stream(&self) -> &str {
        &self.stream
    }

    /// The store's connection (read-only uses: audits, sizes).
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    fn audit(&self, tx: &Connection, ev: &AuditEvent) -> Result<()> {
        crate::audit::append_event_locked_with(tx, None, ev)?;
        Ok(())
    }

    fn tx(&self) -> Result<rusqlite::Transaction<'_>> {
        Ok(rusqlite::Transaction::new_unchecked(
            &self.conn,
            rusqlite::TransactionBehavior::Immediate,
        )?)
    }

    /// Store a device's signed delivery. Refused whole unless the device is
    /// enrolled, not revoked, and its key signed it. Every item stored (now
    /// or before, with the same hash) gets a receipt; nothing is applied
    /// twice.
    pub fn receive(&self, d: &Delivery) -> Result<ReceiveReport> {
        let device_id = d.device_id.as_str();
        let batch = d.items.as_slice();
        if let Err((why, e)) = self.check_device(device_id, |k| d.verify(k)) {
            self.refuse(device_id, why, &e, batch.len())?;
            return Err(Error::Signature(format!("{}: {e}", why.as_str())));
        }
        let tx = self.tx()?;
        let now = now_rfc3339();
        let mut report = ReceiveReport::default();
        for u in batch {
            let actual = hex_encode(&Sha256::digest(u.payload.as_bytes()));
            if !packs::valid_id(&u.item_id) || !actual.eq_ignore_ascii_case(&u.payload_sha256) {
                report.refused += 1;
                continue;
            }
            let existing: Option<(i64, String, String)> = tx
                .query_row(
                    "SELECT seq, payload_sha256, received_at FROM item WHERE item_id = ?1",
                    [&u.item_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .optional()?;
            if let Some((seq, sha, at)) = existing {
                if sha.eq_ignore_ascii_case(&actual) {
                    report.duplicates += 1;
                    report.receipts.push(Receipt {
                        item_id: u.item_id.clone(),
                        payload_sha256: actual,
                        server_id: format!("hub:{seq}"),
                        received_at: at,
                    });
                } else {
                    report.refused += 1;
                }
                continue;
            }
            tx.execute(
                "INSERT INTO item (item_id, device_id, kind, payload, payload_sha256, created_at, received_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![u.item_id, device_id, u.kind, u.payload, actual, u.created_at, now],
            )?;
            let seq = tx.last_insert_rowid();
            self.apply(&tx, device_id, u, &now)?;
            report.stored += 1;
            report.receipts.push(Receipt {
                item_id: u.item_id.clone(),
                payload_sha256: actual,
                server_id: format!("hub:{seq}"),
                received_at: now.clone(),
            });
        }
        tx.execute(
            "INSERT INTO device (device_id, first_seen, last_seen, items) VALUES (?1, ?2, ?2, ?3)
             ON CONFLICT (device_id) DO UPDATE SET last_seen = excluded.last_seen,
               items = items + excluded.items",
            params![device_id, now, report.stored as i64],
        )?;
        if report.stored > 0 || report.refused > 0 {
            let mut ev = AuditEvent::new("hub.receive", device_id);
            ev.detail = json!({"stored": report.stored, "duplicates": report.duplicates, "refused": report.refused});
            self.audit(&tx, &ev)?;
        }
        tx.commit()?;
        Ok(report)
    }

    /// Is the device enrolled, not revoked, and did its key sign this?
    fn check_device(
        &self,
        device_id: &str,
        verify: impl FnOnce(&[u8; 32]) -> Result<()>,
    ) -> std::result::Result<(), (Refusal, String)> {
        let enrolled: Option<(String, Option<String>)> = self
            .conn
            .query_row(
                "SELECT public_key, revoked_at FROM enrolled WHERE device_id = ?1",
                [device_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()
            .map_err(|e| (Refusal::Unenrolled, e.to_string()))?;
        match &enrolled {
            None => Err((
                Refusal::Unenrolled,
                format!("device {device_id} is not enrolled"),
            )),
            Some((_, Some(at))) => Err((
                Refusal::Revoked,
                format!("device {device_id} was revoked at {at}"),
            )),
            Some((key, None)) => decode_key(key)
                .and_then(|k| verify(&k))
                .map_err(|e| (Refusal::Signature, e.to_string())),
        }
    }

    fn refuse(&self, device_id: &str, why: Refusal, detail: &str, items: usize) -> Result<()> {
        let tx = self.tx()?;
        let mut ev = AuditEvent::new("hub.refuse", device_id);
        ev.detail = json!({"items": items, "refused": why.as_str(), "why": detail});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        Ok(())
    }

    /// Answer a device's hello: accepted, or why not. A refusal is audited.
    pub fn hello(&self, h: &Hello) -> Result<HelloReply> {
        let verdict = self.check_device(&h.device_id, |k| h.verify(k));
        let refused = match verdict {
            Ok(()) => None,
            Err((why, e)) => {
                self.refuse(&h.device_id, why, &e, 0)?;
                Some(why)
            }
        };
        Ok(HelloReply {
            accepted: refused.is_none(),
            refused,
            fleet_every_hours: self.fleet_every_hours,
            hub_time: now_rfc3339(),
        })
    }

    /// Enroll a device by its public key (base64). Returns its id.
    pub fn enroll(
        &self,
        public_key: &str,
        name: Option<&str>,
        actor: &str,
    ) -> Result<EnrolledDevice> {
        let key = decode_key(public_key)?;
        let device_id = crate::sync::device_id_for(&key);
        let now = now_rfc3339();
        let tx = self.tx()?;
        let existing: Option<Option<String>> = tx
            .query_row(
                "SELECT revoked_at FROM enrolled WHERE device_id = ?1",
                [&device_id],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(Some(_)) = existing {
            return Err(Error::Invalid(format!(
                "device {device_id} was revoked; a revoked key is not enrolled again"
            )));
        }
        tx.execute(
            "INSERT INTO enrolled (device_id, public_key, name, enrolled_at, enrolled_by) VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT (device_id) DO UPDATE SET name = excluded.name",
            params![device_id, public_key.trim(), name, now, actor],
        )?;
        let mut ev = AuditEvent::new("hub.enroll", &device_id);
        ev.detail = json!({"by": actor, "name": name, "public_key": public_key.trim()});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        self.device(&device_id)?
            .ok_or_else(|| Error::Invalid("enrollment vanished".into()))
    }

    /// Revoke a device: nothing it sends is accepted from now on.
    pub fn revoke(
        &self,
        device_id: &str,
        actor: &str,
        reason: Option<&str>,
    ) -> Result<EnrolledDevice> {
        let now = now_rfc3339();
        let tx = self.tx()?;
        let n = tx.execute(
            "UPDATE enrolled SET revoked_at = ?2, revoked_by = ?3, reason = ?4 WHERE device_id = ?1 AND revoked_at IS NULL",
            params![device_id, now, actor, reason],
        )?;
        if n == 0 {
            return Err(Error::Invalid(format!(
                "no enrolled device {device_id:?} to revoke"
            )));
        }
        let mut ev = AuditEvent::new("hub.revoke", device_id);
        ev.detail = json!({"by": actor, "reason": reason});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        self.device(device_id)?
            .ok_or_else(|| Error::Invalid("enrollment vanished".into()))
    }

    fn device(&self, device_id: &str) -> Result<Option<EnrolledDevice>> {
        Ok(self
            .devices()?
            .into_iter()
            .find(|d| d.device_id == device_id))
    }

    /// Enrolled devices.
    pub fn devices(&self) -> Result<Vec<EnrolledDevice>> {
        Ok(self
            .conn
            .prepare(
                "SELECT e.device_id, e.public_key, e.name, e.enrolled_at, e.enrolled_by, e.revoked_at,
                        e.revoked_by, e.reason, d.last_seen, COALESCE(d.items, 0)
                 FROM enrolled e LEFT JOIN device d ON d.device_id = e.device_id ORDER BY e.enrolled_at, e.device_id",
            )?
            .query_map([], |r| {
                Ok(EnrolledDevice {
                    device_id: r.get(0)?,
                    public_key: r.get(1)?,
                    name: r.get(2)?,
                    enrolled_at: r.get(3)?,
                    enrolled_by: r.get(4)?,
                    revoked_at: r.get(5)?,
                    revoked_by: r.get(6)?,
                    reason: r.get(7)?,
                    last_seen: r.get(8)?,
                    items: r.get::<_, i64>(9)? as u64,
                })
            })?
            .collect::<rusqlite::Result<_>>()?)
    }

    fn apply(&self, tx: &Connection, device_id: &str, u: &Upload, now: &str) -> Result<()> {
        let v: Value = match serde_json::from_str(&u.payload) {
            Ok(v) => v,
            Err(_) => return Ok(()), // kept as received; nothing to index
        };
        match u.kind.as_str() {
            "job" if v.get("format").and_then(Value::as_str) == Some(JOB_REPORT_FORMAT) => {
                let s = |k: &str| v.get(k).and_then(Value::as_str).map(str::to_string);
                tx.execute(
                    "INSERT OR IGNORE INTO job (job_id, item_id, device_id, pack_id, tree_id, symptom_id,
                        equip_id, asset_id, system, resolution, opened_at, closed_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                    params![
                        s("job_id"),
                        u.item_id,
                        device_id,
                        s("pack_id"),
                        s("tree_id"),
                        s("symptom_id"),
                        s("equip_id"),
                        s("asset_id"),
                        s("system"),
                        v.pointer("/resolution/kind").and_then(Value::as_str),
                        s("opened_at"),
                        s("closed_at"),
                    ],
                )?;
            }
            "lesson" if v.get("format").and_then(Value::as_str) == Some(LESSON_FORMAT) => {
                let lesson: Lesson = match serde_json::from_value(strip_format(v)) {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!(
                            "harvest hub: lesson item {}: {e}; kept unindexed",
                            u.item_id
                        );
                        return Ok(());
                    }
                };
                self.add_version(tx, device_id, u, &lesson, now)?;
            }
            _ => {}
        }
        Ok(())
    }

    fn add_version(
        &self,
        tx: &Connection,
        device_id: &str,
        u: &Upload,
        l: &Lesson,
        now: &str,
    ) -> Result<()> {
        tx.execute(
            "INSERT INTO lesson_version (item_id, lesson_id, device_id, updated_at, received_at, payload)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![u.item_id, l.lesson_id, device_id, l.updated_at, now, u.payload],
        )?;
        let current: Option<(String, String)> = tx
            .query_row(
                "SELECT current_item, status FROM lesson WHERE lesson_id = ?1",
                [&l.lesson_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let Some((cur_item, status)) = current else {
            tx.execute(
                "INSERT INTO lesson (lesson_id, current_item, status, first_received_at)
                 VALUES (?1, ?2, 'pending', ?3)",
                params![l.lesson_id, u.item_id, now],
            )?;
            return Ok(());
        };
        let key_of = |item: &str| -> Result<(String, String, String)> {
            Ok(tx.query_row(
                "SELECT updated_at, device_id, item_id FROM lesson_version WHERE item_id = ?1",
                [item],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )?)
        };
        let old = key_of(&cur_item)?;
        let new = (
            l.updated_at.clone(),
            device_id.to_string(),
            u.item_id.clone(),
        );
        let (winner, loser) = if new > old {
            (&new, &old)
        } else {
            (&old, &new)
        };
        let rule = if new.0 != old.0 {
            "newest updated_at"
        } else if new.1 != old.1 {
            "same time: larger device id"
        } else {
            "same time and unit: larger item id"
        };
        // Two units within the clock-skew bound of each other: their clocks
        // cannot order the edits, so a reviewer chooses.
        let close = match (
            crate::records::maint::parse_rfc3339_ms(&new.0),
            crate::records::maint::parse_rfc3339_ms(&old.0),
        ) {
            (Some(a), Some(b)) => (a - b).abs() < self.skew_bound_ms,
            _ => true,
        };
        let needs_reviewer = old.1 != new.1 && close;
        let (rule, class) = if needs_reviewer {
            (
                "within the clock-skew bound: a reviewer chooses",
                "needs_reviewer",
            )
        } else {
            (rule, "auto")
        };
        if old.1 != new.1 {
            tx.execute(
                "INSERT INTO conflict (lesson_id, winner, loser, rule, at, class) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![l.lesson_id, winner.2, loser.2, rule, now, class],
            )?;
        }
        if winner.2 != cur_item || needs_reviewer {
            let reopen = status != "pending";
            tx.execute(
                "UPDATE lesson SET current_item = ?2, status = 'pending',
                        reopened = CASE WHEN ?3 THEN 1 ELSE reopened END,
                        needs_reviewer = CASE WHEN ?4 THEN 1 ELSE needs_reviewer END
                 WHERE lesson_id = ?1",
                params![l.lesson_id, winner.2, reopen, needs_reviewer],
            )?;
        }
        Ok(())
    }

    fn lesson_at(&self, item_id: &str) -> Result<Lesson> {
        let payload: String = self.conn.query_row(
            "SELECT payload FROM lesson_version WHERE item_id = ?1",
            [item_id],
            |r| r.get(0),
        )?;
        Ok(serde_json::from_value(strip_format(serde_json::from_str(
            &payload,
        )?))?)
    }

    /// The review queue (`status` `pending` | `approved` | `rejected`, or
    /// all), oldest first.
    pub fn queue(&self, status: Option<&str>) -> Result<Vec<ReviewItem>> {
        let rows: Vec<(String, String, String, bool, String, bool)> = self
            .conn
            .prepare(
                "SELECT lesson_id, current_item, status, reopened, first_received_at, needs_reviewer FROM lesson
                 WHERE (?1 IS NULL OR status = ?1) ORDER BY first_received_at, lesson_id",
            )?
            .query_map([status], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        rows.into_iter()
            .map(|(lesson_id, cur, status, reopened, first, needs_reviewer)| {
                let current = self.lesson_at(&cur)?;
                let winner_dev: String = self.conn.query_row(
                    "SELECT device_id FROM lesson_version WHERE item_id = ?1",
                    [&cur],
                    |r| r.get(0),
                )?;
                let vs: Vec<(String, String, String, String)> = self
                    .conn
                    .prepare(
                        "SELECT item_id, device_id, updated_at, received_at FROM lesson_version
                         WHERE lesson_id = ?1 ORDER BY updated_at, device_id, item_id",
                    )?
                    .query_map([&lesson_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
                    .collect::<rusqlite::Result<_>>()?;
                let mut versions = Vec::new();
                for (item_id, device_id, updated_at, received_at) in vs {
                    let state = if item_id == cur {
                        "current"
                    } else if device_id == winner_dev {
                        "superseded"
                    } else {
                        "lost"
                    };
                    versions.push(LessonVersion {
                        lesson: self.lesson_at(&item_id)?,
                        state: state.into(),
                        item_id,
                        device_id,
                        updated_at,
                        received_at,
                    });
                }
                let reviews = self
                    .conn
                    .prepare(
                        "SELECT action, reviewer, at, note, item_id FROM review WHERE lesson_id = ?1 ORDER BY seq",
                    )?
                    .query_map([&lesson_id], |r| {
                        Ok(ReviewRecord {
                            action: r.get(0)?,
                            reviewer: r.get(1)?,
                            at: r.get(2)?,
                            note: r.get(3)?,
                            item_id: r.get(4)?,
                        })
                    })?
                    .collect::<rusqlite::Result<_>>()?;
                Ok(ReviewItem {
                    lesson_id,
                    status,
                    reopened,
                    current,
                    versions,
                    reviews,
                    first_received_at: first,
                    needs_reviewer,
                })
            })
            .collect()
    }

    fn pending_item(&self, lesson_id: &str) -> Result<String> {
        let row: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT current_item, status FROM lesson WHERE lesson_id = ?1",
                [lesson_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        match row {
            None => Err(Error::Invalid(format!(
                "no lesson {lesson_id:?} at the hub"
            ))),
            Some((item, s)) if s == "pending" => Ok(item),
            Some((_, s)) => Err(Error::Invalid(format!(
                "lesson {lesson_id} is {s}, not pending"
            ))),
        }
    }

    /// Approve a pending lesson, as it is or edited: it becomes a field
    /// note in the next bundle. Returns the note.
    pub fn approve(
        &self,
        lesson_id: &str,
        reviewer: &str,
        edit: Option<NoteEdit>,
        note: Option<&str>,
        version: Option<&str>,
    ) -> Result<FieldNoteIn> {
        let reviewer = reviewer.trim();
        if reviewer.is_empty() {
            return Err(Error::Invalid("a review names its reviewer".into()));
        }
        let mut item = self.pending_item(lesson_id)?;
        let needs: bool = self.conn.query_row(
            "SELECT needs_reviewer FROM lesson WHERE lesson_id = ?1",
            [lesson_id],
            |r| r.get(0),
        )?;
        match version {
            Some(v) => {
                let of: Option<String> = self
                    .conn
                    .query_row(
                        "SELECT lesson_id FROM lesson_version WHERE item_id = ?1",
                        [v],
                        |r| r.get(0),
                    )
                    .optional()?;
                if of.as_deref() != Some(lesson_id) {
                    return Err(Error::Invalid(format!(
                        "{v} is not a version of lesson {lesson_id}"
                    )));
                }
                item = v.to_string();
            }
            None if needs => {
                return Err(Error::Invalid(format!(
                    "two units edited lesson {lesson_id} within the clock-skew bound; choose a version"
                )));
            }
            None => {}
        }
        let l = self.lesson_at(&item)?;
        let edited = edit
            .as_ref()
            .is_some_and(|e| e.text.is_some() || e.scope.is_some());
        let edit = edit.unwrap_or_default();
        let text = match edit.text.as_deref().map(str::trim) {
            Some(t) if !t.is_empty() => t.to_string(),
            Some(_) => return Err(Error::Invalid("an edited note needs text".into())),
            None => format!(
                "Verified cause: {}. Corrective action: {}.",
                l.cause.trim_end_matches('.'),
                l.action.trim_end_matches('.')
            ),
        };
        let scope = edit.scope.unwrap_or(NoteScope {
            equip_id: l.equip_id.clone(),
            tree_id: l.tree_id.clone(),
            node_id: None,
            symptom_id: l.symptom_id.clone(),
        });
        if scope.equip_id.is_none()
            && scope.tree_id.is_none()
            && scope.node_id.is_none()
            && scope.symptom_id.is_none()
        {
            return Err(Error::Invalid("a field note needs a scope".into()));
        }
        let now = now_rfc3339();
        let note_id = format!("fn-{lesson_id}");
        let action = if edited { "edited" } else { "approved" };
        let tx = self.tx()?;
        tx.execute(
            "INSERT INTO note (note_id, lesson_id, scope, text, approver, approved_at, active, bundle_seq, revoke_seq)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, NULL, NULL)
             ON CONFLICT (note_id) DO UPDATE SET scope = excluded.scope, text = excluded.text,
               approver = excluded.approver, approved_at = excluded.approved_at, active = 1,
               bundle_seq = NULL, revoke_seq = NULL",
            params![note_id, lesson_id, serde_json::to_string(&scope)?, text, reviewer, now],
        )?;
        tx.execute(
            "UPDATE lesson SET status = 'approved', reopened = 0, needs_reviewer = 0, current_item = ?2
             WHERE lesson_id = ?1",
            params![lesson_id, item],
        )?;
        if needs {
            tx.execute(
                "UPDATE conflict SET resolved_by = ?2 WHERE lesson_id = ?1 AND class = 'needs_reviewer'
                   AND resolved_by IS NULL",
                params![lesson_id, reviewer],
            )?;
        }
        tx.execute(
            "INSERT INTO review (lesson_id, item_id, action, reviewer, at, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![lesson_id, item, action, reviewer, now, note],
        )?;
        let mut ev = AuditEvent::new(
            &format!("hub.{}", if edited { "edit_approve" } else { "approve" }),
            lesson_id,
        );
        ev.result =
            Some(json!({"note_id": note_id, "text": text, "scope": scope, "item_id": item}));
        ev.detail = json!({"reviewer": reviewer, "before": {"cause": l.cause, "action": l.action}, "note": note});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        Ok(FieldNoteIn {
            note_id,
            scope,
            text,
            counts: NoteCounts::default(),
            approver: reviewer.to_string(),
            approved_at: now,
            supersedes: None,
            lang: None,
        })
    }

    /// Reject a pending lesson. A note it had already become is revoked in
    /// the next bundle.
    pub fn reject(&self, lesson_id: &str, reviewer: &str, reason: Option<&str>) -> Result<()> {
        let reviewer = reviewer.trim();
        if reviewer.is_empty() {
            return Err(Error::Invalid("a review names its reviewer".into()));
        }
        let item = self.pending_item(lesson_id)?;
        let now = now_rfc3339();
        let tx = self.tx()?;
        tx.execute(
            "UPDATE lesson SET status = 'rejected', reopened = 0 WHERE lesson_id = ?1",
            [lesson_id],
        )?;
        tx.execute(
            "INSERT INTO review (lesson_id, item_id, action, reviewer, at, note) VALUES (?1, ?2, 'rejected', ?3, ?4, ?5)",
            params![lesson_id, item, reviewer, now, reason],
        )?;
        tx.execute(
            "UPDATE note SET active = 0, revoke_seq = NULL WHERE lesson_id = ?1 AND active = 1",
            [lesson_id],
        )?;
        let mut ev = AuditEvent::new("hub.reject", lesson_id);
        ev.detail = json!({"reviewer": reviewer, "reason": reason, "item_id": item});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        Ok(())
    }

    /// Publish what changed since the last bundle (approved notes, revoked
    /// ones, review outcomes) as the next signed bundle, with the fleet
    /// summary. `None` when nothing changed and `always` is false.
    pub fn publish(&self, always: bool, actor: &str) -> Result<Option<Value>> {
        type N = (String, String, String, String, String, String);
        let notes: Vec<N> = self
            .conn
            .prepare(
                "SELECT note_id, lesson_id, scope, text, approver, approved_at FROM note
                 WHERE active = 1 AND bundle_seq IS NULL ORDER BY approved_at, note_id",
            )?
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;
        let revoke: Vec<String> = self
            .conn
            .prepare("SELECT note_id FROM note WHERE active = 0 AND revoke_seq IS NULL AND published = 1 ORDER BY note_id")?
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        let reviews: Vec<(i64, String, String, Option<String>)> = self
            .conn
            .prepare("SELECT seq, lesson_id, action, note FROM review WHERE bundle_seq IS NULL ORDER BY seq")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)))?
            .collect::<rusqlite::Result<_>>()?;
        if notes.is_empty() && revoke.is_empty() && reviews.is_empty() && !always {
            return Ok(None);
        }
        let fleet = self.fleet()?;
        let fleet_sha = crate::records::maint::fleet_sha256(&fleet)?;
        let held: Option<String> = self
            .conn
            .query_row(
                "SELECT sha256 FROM fleet_doc ORDER BY seq DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        let new_fleet = held.as_deref() != Some(fleet_sha.as_str());
        let counts = |lesson_id: &str| -> Result<NoteCounts> { self.counts_for(lesson_id, &fleet) };
        let mut note_values = Vec::new();
        for (note_id, lesson_id, scope, text, approver, approved_at) in &notes {
            note_values.push(serde_json::to_value(FieldNoteIn {
                note_id: note_id.clone(),
                scope: serde_json::from_str(scope)?,
                text: text.clone(),
                counts: counts(lesson_id)?,
                approver: approver.clone(),
                approved_at: approved_at.clone(),
                supersedes: None,
                lang: None,
            })?);
        }
        let seq: i64 =
            self.conn
                .query_row("SELECT COALESCE(MAX(seq), 0) + 1 FROM bundle", [], |r| {
                    r.get(0)
                })?;
        let now = now_rfc3339();
        let mut body = json!({
            "format": crate::records::maint::FIELD_FORMAT,
            "stream": self.stream,
            "seq": seq,
            "issued_at": now,
            "notes": note_values,
            "revoke": revoke,
            "reviews": reviews.iter().map(|(_, l, a, n)| json!({"lesson_id": l, "status": a, "note": n})).collect::<Vec<_>>(),
            "fleet_sha256": fleet_sha,
        });
        packs::sign_manifest(&mut body, &self.key)?;
        let tx = self.tx()?;
        if new_fleet {
            let mut doc = json!({
                "format": crate::records::maint::FLEET_FORMAT,
                "stream": self.stream,
                "sha256": fleet_sha,
                "issued_at": now,
                "summary": fleet,
            });
            packs::sign_manifest(&mut doc, &self.key)?;
            tx.execute(
                "INSERT INTO fleet_doc (sha256, issued_at, body) VALUES (?1, ?2, ?3)",
                params![fleet_sha, now, doc.to_string()],
            )?;
        }
        tx.execute(
            "INSERT INTO bundle (seq, issued_at, body) VALUES (?1, ?2, ?3)",
            params![seq, now, body.to_string()],
        )?;
        for (note_id, ..) in &notes {
            tx.execute(
                "UPDATE note SET bundle_seq = ?2, published = 1 WHERE note_id = ?1",
                params![note_id, seq],
            )?;
        }
        for n in &revoke {
            tx.execute(
                "UPDATE note SET revoke_seq = ?2 WHERE note_id = ?1",
                params![n, seq],
            )?;
        }
        for (rseq, ..) in &reviews {
            tx.execute(
                "UPDATE review SET bundle_seq = ?2 WHERE seq = ?1",
                params![rseq, seq],
            )?;
        }
        let mut ev = AuditEvent::new("hub.publish", &self.stream);
        ev.detail = json!({"seq": seq, "by": actor, "notes": notes.len(), "revoke": revoke.len(), "reviews": reviews.len(), "fleet_sha256": fleet_sha, "new_fleet": new_fleet});
        self.audit(&tx, &ev)?;
        tx.commit()?;
        Ok(Some(body))
    }

    /// The newest signed fleet summary (`harvest-fleet/1`).
    pub fn fleet_document(&self) -> Result<Option<Value>> {
        let body: Option<String> = self
            .conn
            .query_row(
                "SELECT body FROM fleet_doc ORDER BY seq DESC LIMIT 1",
                [],
                |r| r.get(0),
            )
            .optional()?;
        body.map(|b| Ok(serde_json::from_str(&b)?)).transpose()
    }

    /// Bundles with `seq` above `since`, in order.
    pub fn bundles_since(&self, since: u64) -> Result<Vec<Value>> {
        let rows: Vec<String> = self
            .conn
            .prepare("SELECT body FROM bundle WHERE seq > ?1 ORDER BY seq")?
            .query_map([since as i64], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        rows.iter().map(|b| Ok(serde_json::from_str(b)?)).collect()
    }

    /// Every conflict and how it resolved.
    pub fn conflicts(&self) -> Result<Vec<Conflict>> {
        Ok(self
            .conn
            .prepare("SELECT lesson_id, winner, loser, rule, at, class, resolved_by FROM conflict ORDER BY seq")?
            .query_map([], |r| {
                Ok(Conflict {
                    lesson_id: r.get(0)?,
                    winner: r.get(1)?,
                    loser: r.get(2)?,
                    rule: r.get(3)?,
                    at: r.get(4)?,
                    class: r.get(5)?,
                    resolved_by: r.get(6)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?)
    }

    pub fn status(&self) -> Result<HubStatus> {
        let n = |sql: &str| -> Result<u64> {
            Ok(self.conn.query_row(sql, [], |r| r.get::<_, i64>(0))? as u64)
        };
        Ok(HubStatus {
            stream: self.stream.clone(),
            key_id: self.trusted_key().key_id,
            devices: n("SELECT count(*) FROM device")?,
            items: n("SELECT count(*) FROM item")?,
            jobs: n("SELECT count(*) FROM job")?,
            lessons_pending: n("SELECT count(*) FROM lesson WHERE status = 'pending'")?,
            lessons_approved: n("SELECT count(*) FROM lesson WHERE status = 'approved'")?,
            lessons_rejected: n("SELECT count(*) FROM lesson WHERE status = 'rejected'")?,
            bundles: n("SELECT count(*) FROM bundle")?,
            latest_bundle: n("SELECT COALESCE(MAX(seq), 0) FROM bundle")?,
            conflicts: n("SELECT count(*) FROM conflict")?,
        })
    }

    /// Is an item stored (for invariants)?
    pub fn has_item(&self, item_id: &str) -> Result<bool> {
        Ok(self
            .conn
            .prepare_cached("SELECT 1 FROM item WHERE item_id = ?1")?
            .exists([item_id])?)
    }

    /// The current version of every lesson with its job's resolution.
    fn current_lessons(&self) -> Result<Vec<(Lesson, Option<String>, String)>> {
        let rows: Vec<(String, String)> = self
            .conn
            .prepare("SELECT current_item, status FROM lesson ORDER BY lesson_id")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        let mut out = Vec::new();
        for (item, status) in rows {
            let l = self.lesson_at(&item)?;
            let res: Option<String> = match &l.job_id {
                Some(j) => self
                    .conn
                    .query_row("SELECT resolution FROM job WHERE job_id = ?1", [j], |r| {
                        r.get(0)
                    })
                    .optional()?
                    .flatten(),
                None => None,
            };
            out.push((l, res, status));
        }
        Ok(out)
    }

    fn counts_for(&self, lesson_id: &str, fleet: &FleetSummary) -> Result<NoteCounts> {
        let item: String = self.conn.query_row(
            "SELECT current_item FROM lesson WHERE lesson_id = ?1",
            [lesson_id],
            |r| r.get(0),
        )?;
        let l = self.lesson_at(&item)?;
        let a = fold(&l.action);
        let action = fleet
            .actions
            .iter()
            .find(|x| x.action == a && x.tree_id == l.tree_id);
        let units: BTreeSet<String> = self
            .current_lessons()?
            .into_iter()
            .filter(|(x, _, _)| fold(&x.action) == a && x.tree_id == l.tree_id)
            .filter_map(|(x, _, _)| x.asset_id)
            .collect();
        Ok(NoteCounts {
            units: Some(units.len() as u64),
            resolved: action.map(|x| x.resolved),
            attempts: action.map(|x| x.attempts),
        })
    }

    /// The fleet summary: jobs per symptom and variant, resolved of
    /// attempts per corrective action, repeat discrepancies, top causes.
    #[allow(clippy::type_complexity)]
    pub fn fleet(&self) -> Result<FleetSummary> {
        type J = (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
        );
        let jobs: Vec<J> = self
            .conn
            .prepare("SELECT tree_id, symptom_id, equip_id, resolution, asset_id, system, opened_at FROM job ORDER BY opened_at, job_id")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?, r.get(6)?)))?
            .collect::<rusqlite::Result<_>>()?;
        let mut per: BTreeMap<(String, Option<String>, Option<String>), (u64, u64)> =
            BTreeMap::new();
        for (tree, sym, equip, res, ..) in &jobs {
            let e = per
                .entry((tree.clone(), sym.clone(), equip.clone()))
                .or_default();
            e.0 += 1;
            if res.as_deref() == Some("fixed") {
                e.1 += 1;
            }
        }
        let mut repeats: BTreeMap<(String, Option<String>, Option<String>), u64> = BTreeMap::new();
        let window = self.repeat_window_days;
        for (i, (_, sym, _, _, asset, sys, at)) in jobs.iter().enumerate() {
            let Some(asset) = asset else { continue };
            let Some(d) = day_number(at) else { continue };
            let repeat = jobs[..i].iter().any(|(_, s2, _, _, a2, y2, at2)| {
                a2.as_deref() == Some(asset.as_str())
                    && ((sym.is_some() && s2 == sym)
                        || (sym.is_none() && sys.is_some() && y2 == sys))
                    && day_number(at2).is_some_and(|d2| (0..=window).contains(&(d - d2)))
            });
            if repeat {
                *repeats
                    .entry((asset.clone(), sym.clone(), sys.clone()))
                    .or_default() += 1;
            }
        }
        let mut actions: BTreeMap<(Option<String>, String), (u64, u64)> = BTreeMap::new();
        let mut causes: BTreeMap<String, BTreeMap<String, u64>> = BTreeMap::new();
        for (l, res, status) in self.current_lessons()? {
            if status == "rejected" {
                continue;
            }
            let e = actions
                .entry((l.tree_id.clone(), fold(&l.action)))
                .or_default();
            e.0 += 1;
            if res.as_deref() == Some("fixed") {
                e.1 += 1;
            }
            if let Some(s) = &l.symptom_id {
                *causes
                    .entry(s.clone())
                    .or_default()
                    .entry(fold(&l.cause))
                    .or_default() += 1;
            }
        }
        let units: i64 =
            self.conn
                .query_row("SELECT count(DISTINCT device_id) FROM job", [], |r| {
                    r.get(0)
                })?;
        Ok(FleetSummary {
            generated_at: now_rfc3339(),
            units: units as u64,
            jobs: per
                .into_iter()
                .map(
                    |((tree_id, symptom_id, equip_id), (jobs, fixed))| FleetJobs {
                        tree_id,
                        symptom_id,
                        equip_id,
                        jobs,
                        fixed,
                    },
                )
                .collect(),
            actions: actions
                .into_iter()
                .map(|((tree_id, action), (attempts, resolved))| FleetAction {
                    tree_id,
                    action,
                    attempts,
                    resolved,
                })
                .collect(),
            repeats: repeats
                .into_iter()
                .map(|((asset_id, symptom_id, system), jobs)| FleetRepeat {
                    asset_id,
                    symptom_id,
                    system,
                    jobs,
                })
                .collect(),
            top_causes: causes
                .into_iter()
                .map(|(symptom_id, m)| {
                    let mut c: Vec<FleetCause> = m
                        .into_iter()
                        .map(|(cause, count)| FleetCause { cause, count })
                        .collect();
                    c.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.cause.cmp(&b.cause)));
                    c.truncate(5);
                    FleetCauses {
                        symptom_id,
                        causes: c,
                    }
                })
                .collect(),
        })
    }

    /// The newest pack for `pack_id`, or a delta from `have` when the hub
    /// holds one; `None` when the device is current or the hub has none.
    pub fn pack_offer(&self, pack_id: &str, have: Option<&str>) -> Result<Option<PackOffer>> {
        let Some(root) = &self.packs_root else {
            return Ok(None);
        };
        if !packs::valid_id(pack_id) {
            return Err(Error::Invalid(format!("pack id {pack_id:?}")));
        }
        let dir = root.join(pack_id);
        if !dir.is_dir() {
            return Ok(None);
        }
        let mut best: Option<(String, PathBuf)> = None;
        let mut entries: Vec<PathBuf> = std::fs::read_dir(&dir)?
            .filter_map(|e| e.ok().map(|e| e.path()))
            .collect();
        entries.sort();
        for p in &entries {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if name.starts_with('.') || name.starts_with("delta-") || !packs::valid_version(name) {
                continue;
            }
            if packs::read_manifest(p, &self.pack_keys).is_err() {
                eprintln!("harvest hub: {} does not verify; not offered", p.display());
                continue;
            }
            if best
                .as_ref()
                .is_none_or(|(v, _)| packs::compare_versions(name, v).is_gt())
            {
                best = Some((name.to_string(), p.clone()));
            }
        }
        let Some((version, full)) = best else {
            return Ok(None);
        };
        if let Some(h) = have
            && !packs::compare_versions(&version, h).is_gt()
        {
            return Ok(None);
        }
        let delta = have
            .map(|h| dir.join(format!("delta-{h}-{version}")))
            .filter(|d| d.is_dir());
        let (kind, path, base) = match delta {
            Some(d) if packs::read_manifest(&d, &self.pack_keys).is_ok() => {
                ("delta", d, have.map(str::to_string))
            }
            _ => ("full", full, None),
        };
        let manifest = packs::read_manifest(&path, &self.pack_keys)?;
        let files: Vec<FileEntry> = manifest.files.clone();
        let bytes = files.iter().map(|f| f.bytes).sum::<u64>()
            + std::fs::metadata(path.join(packs::MANIFEST))?.len();
        Ok(Some(PackOffer {
            pack_id: pack_id.to_string(),
            version,
            kind: kind.into(),
            base_version: base,
            dir: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            files,
            bytes,
        }))
    }

    /// One file of an offer.
    pub fn fetch(&self, offer: &PackOffer, path: &str) -> Result<Vec<u8>> {
        let root = self
            .packs_root
            .as_ref()
            .ok_or_else(|| Error::Invalid("the hub serves no packs".into()))?;
        if !packs::valid_id(&offer.pack_id)
            || offer.dir.contains('/')
            || offer.dir.contains("..")
            || offer.dir.is_empty()
        {
            return Err(Error::Invalid("bad offer".into()));
        }
        let rel = packs::safe_relative(path)?;
        let dir = root.join(&offer.pack_id).join(&offer.dir);
        let listed = path == packs::MANIFEST
            || packs::read_manifest(&dir, &self.pack_keys)?
                .files
                .iter()
                .any(|f| f.path == path);
        if !listed {
            return Err(Error::Invalid(format!("{path} is not in the offer")));
        }
        Ok(std::fs::read(dir.join(rel))?)
    }

    /// Verify the hub's audit chain.
    pub fn verify_audit(&self) -> Result<crate::audit::ChainReport> {
        crate::audit::verify_chain(&self.conn)
    }

    /// The hub's audit records.
    pub fn audit_records(&self) -> Result<Vec<crate::audit::AuditRecord>> {
        crate::audit::records_with(&self.conn, None)
    }
}

fn strip_format(mut v: Value) -> Value {
    if let Some(m) = v.as_object_mut() {
        m.remove("format");
    }
    v
}

/// A device's link straight to an in-process hub (tests, one-box setups).
pub struct LocalLink {
    pub hub: Arc<Mutex<Hub>>,
    pub key: DeviceKey,
}

impl LocalLink {
    fn hub(&self) -> std::sync::MutexGuard<'_, Hub> {
        self.hub.lock().unwrap_or_else(|p| p.into_inner())
    }
}

impl HubLink for LocalLink {
    fn device_id(&self) -> String {
        self.key.device_id()
    }
    fn send(&self, batch: &[Upload]) -> Result<Vec<Receipt>> {
        let d = self.key.deliver(batch)?;
        Ok(self.hub().receive(&d)?.receipts)
    }
    fn bundles_since(&self, since: u64) -> Result<Vec<Value>> {
        self.hub().bundles_since(since)
    }
    fn pack_offer(&self, pack_id: &str, have: Option<&str>) -> Result<Option<PackOffer>> {
        self.hub().pack_offer(pack_id, have)
    }
    fn fetch(&self, offer: &PackOffer, path: &str) -> Result<Vec<u8>> {
        self.hub().fetch(offer, path)
    }
    fn fleet(&self) -> Result<Option<Value>> {
        self.hub().fleet_document()
    }
    fn hello(&self) -> Result<HelloReply> {
        let h = self.key.hello()?;
        self.hub().hello(&h)
    }
    fn public_key(&self) -> String {
        self.key.public_base64()
    }
}

/// `LessonStatus` the hub's review actions map to on the device.
pub fn device_status(action: &str) -> Option<LessonStatus> {
    match action {
        "approved" => Some(LessonStatus::Approved),
        "edited" => Some(LessonStatus::Edited),
        "rejected" => Some(LessonStatus::Rejected),
        _ => None,
    }
}
