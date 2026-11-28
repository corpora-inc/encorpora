//! The device record store: guided procedure runs, step results,
//! deficiencies and misses, captured offline.
//!
//! One SQLite file per device (`records.db`), separate from the read-only
//! pack. It also holds the audit log ([`crate::audit`]) and the upload outbox
//! ([`crate::sync`]). A finished run, a deficiency and a declined question
//! each become one outbox item, so captured outcomes reach the review queue
//! that feeds the next bake when a link returns.

use crate::audit::now_rfc3339;
use crate::crypt::{self, RecordKey};
use crate::error::{Error, Result};
use crate::pack::{Deficiency, Pack, ProcStep};
use crate::packs::hex_encode;
use crate::sync;
use rusqlite::{Connection, OptionalExtension, Transaction, TransactionBehavior, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

pub mod maint;
pub use maint::*;

const DDL: &str = "
CREATE TABLE IF NOT EXISTS records_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS proc_run (
  run_id       TEXT PRIMARY KEY,
  pack_id      TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  proc_id      TEXT NOT NULL,
  equip_id     TEXT,
  asset        TEXT,
  role         TEXT NOT NULL,
  steps_sha256 TEXT NOT NULL,         -- the procedure's steps when the run began
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('open', 'complete', 'abandoned'))
);
CREATE TABLE IF NOT EXISTS step_result (
  run_id      TEXT NOT NULL REFERENCES proc_run(run_id),
  ord         INTEGER NOT NULL,
  result      TEXT NOT NULL CHECK (result IN ('pass', 'fail', 'na', 'value', 'note', 'photo')),
  value       TEXT,
  note        TEXT,
  photos      TEXT NOT NULL,
  structured  TEXT,
  deficiency  INTEGER NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (run_id, ord)
);
";

/// How a step came out.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Pass,
    Fail,
    /// Not applicable to this machine or job.
    Na,
    Value,
    Note,
    Photo,
}

impl Outcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "pass",
            Self::Fail => "fail",
            Self::Na => "na",
            Self::Value => "value",
            Self::Note => "note",
            Self::Photo => "photo",
        }
    }
    fn parse(s: &str) -> Result<Self> {
        Ok(match s {
            "pass" => Self::Pass,
            "fail" => Self::Fail,
            "na" => Self::Na,
            "value" => Self::Value,
            "note" => Self::Note,
            "photo" => Self::Photo,
            other => return Err(Error::Invalid(format!("unknown step result {other:?}"))),
        })
    }
}

/// A photo the host stored; the record keeps its path and hash.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct PhotoRef {
    pub path: String,
    pub sha256: String,
}

/// What the user entered for one step.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct StepInput {
    pub outcome: Outcome,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub photos: Vec<PhotoRef>,
    /// A structured note (e.g. [`crate::notes::StructuredNote`]) as JSON.
    #[serde(default)]
    pub structured: Option<serde_json::Value>,
}

impl StepInput {
    pub fn outcome(outcome: Outcome) -> Self {
        Self {
            outcome,
            value: None,
            note: None,
            photos: Vec::new(),
            structured: None,
        }
    }
}

/// A recorded step.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct StepRecord {
    pub ord: i64,
    #[serde(flatten)]
    pub input: StepInput,
    pub deficiency: bool,
    pub recorded_at: String,
}

/// What recording a step returns: the guidance to show when it failed.
#[derive(Debug, Clone, Serialize, PartialEq, JsonSchema)]
pub struct StepOutcome {
    pub record: StepRecord,
    /// The pack's guidance for a failed step. `quote_verified` says whether
    /// its quote is verbatim in the cited section (a bake bug otherwise; the
    /// app then shows the citation without the quote).
    pub guidance: Option<Guidance>,
}

#[derive(Debug, Clone, Serialize, PartialEq, JsonSchema)]
pub struct Guidance {
    #[serde(flatten)]
    pub deficiency: Deficiency,
    pub citation: Option<String>,
    pub quote_verified: bool,
}

/// One procedure run.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct Run {
    pub run_id: String,
    pub pack_id: String,
    pub pack_version: String,
    pub proc_id: String,
    pub equip_id: Option<String>,
    /// The specific machine (unit number, serial), as the user entered it.
    pub asset: Option<String>,
    pub role: String,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub status: String,
    pub steps: Vec<StepRecord>,
}

impl Run {
    pub fn deficiencies(&self) -> usize {
        self.steps.iter().filter(|s| s.deficiency).count()
    }
}

/// The outbox's last contact with the other side.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct SyncState {
    /// When an item was last acknowledged.
    pub last_synced_at: Option<String>,
    /// When the last upload was attempted, and whether it got through.
    pub last_attempt_at: Option<String>,
    pub last_attempt_ok: Option<bool>,
    pub last_error: Option<String>,
}

/// The run report format id.
pub const RUN_REPORT_FORMAT: &str = "harvest-run/1";

/// A run as it is exported and uploaded (`harvest-run/1`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct RunReport {
    pub format: String,
    pub pack_id: String,
    pub pack_version: String,
    pub run_id: String,
    pub proc_id: String,
    /// The procedure's title, when the pack was at hand.
    pub title: Option<String>,
    pub role: String,
    pub equip_id: Option<String>,
    pub asset: Option<String>,
    /// `open` | `complete` | `abandoned`.
    pub status: String,
    /// True when the steps come from the pack (texts, sections, every step
    /// listed); false when the procedure changed and only the records are
    /// known.
    pub steps_known: bool,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub steps: Vec<ReportStep>,
}

/// One step of a report: the pack's step (when known) and what was recorded
/// (`outcome` is null when the step was not recorded).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, JsonSchema)]
pub struct ReportStep {
    pub ord: i64,
    pub text: Option<String>,
    pub section_ids: Vec<String>,
    pub check_kind: Option<String>,
    pub outcome: Option<Outcome>,
    pub value: Option<String>,
    pub note: Option<String>,
    pub photos: Vec<PhotoRef>,
    pub structured: Option<serde_json::Value>,
    pub deficiency: bool,
    pub recorded_at: Option<String>,
}

impl RunReport {
    fn build(run: &Run, steps: Option<(&Pack, &Vec<ProcStep>)>) -> Result<Self> {
        let known = steps.is_some();
        let recorded = |ord: i64| run.steps.iter().find(|s| s.ord == ord);
        let from = |ord: i64, step: Option<&ProcStep>| {
            let r = recorded(ord);
            ReportStep {
                ord,
                text: step.map(|s| s.text.clone()),
                section_ids: step.map(|s| s.section_ids.clone()).unwrap_or_default(),
                check_kind: step.map(|s| s.check_kind.clone()),
                outcome: r.map(|r| r.input.outcome),
                value: r.and_then(|r| r.input.value.clone()),
                note: r.and_then(|r| r.input.note.clone()),
                photos: r.map(|r| r.input.photos.clone()).unwrap_or_default(),
                structured: r.and_then(|r| r.input.structured.clone()),
                deficiency: r.is_some_and(|r| r.deficiency),
                recorded_at: r.map(|r| r.recorded_at.clone()),
            }
        };
        let (title, steps) = match steps {
            Some((pack, steps)) => (
                pack.procedure(&run.proc_id)?.map(|p| p.title),
                steps.iter().map(|s| from(s.ord, Some(s))).collect(),
            ),
            None => (None, run.steps.iter().map(|s| from(s.ord, None)).collect()),
        };
        Ok(Self {
            format: RUN_REPORT_FORMAT.into(),
            pack_id: run.pack_id.clone(),
            pack_version: run.pack_version.clone(),
            run_id: run.run_id.clone(),
            proc_id: run.proc_id.clone(),
            title,
            role: run.role.clone(),
            equip_id: run.equip_id.clone(),
            asset: run.asset.clone(),
            status: run.status.clone(),
            steps_known: known,
            started_at: run.started_at.clone(),
            finished_at: run.finished_at.clone(),
            steps,
        })
    }
}

/// Who is running a procedure, on what.
#[derive(Debug, Clone, Default)]
pub struct StartRun {
    pub role: String,
    pub equip_id: Option<String>,
    pub asset: Option<String>,
}

/// The device record store.
pub struct Records {
    conn: Connection,
    key: Option<RecordKey>,
}

const KEY_CHECK: &str = "harvest-records-v1";

static COUNTER: AtomicU64 = AtomicU64::new(0);

/// A fresh, unguessable-enough local id: SHA-256 over the parts, the clock
/// and a process counter, 32 hex.
pub(crate) fn new_id(prefix: &str, parts: &[&str]) -> String {
    let mut h = Sha256::new();
    for p in parts {
        h.update(p.as_bytes());
        h.update([0]);
    }
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    h.update(t.as_nanos().to_le_bytes());
    h.update(COUNTER.fetch_add(1, Ordering::Relaxed).to_le_bytes());
    h.update(std::process::id().to_le_bytes());
    format!("{prefix}-{}", &hex_encode(&h.finalize())[..32])
}

impl Records {
    /// Open (or create) an unencrypted store at `path`.
    pub fn open(path: &Path) -> Result<Self> {
        Self::init(Connection::open(path)?, None)
    }

    /// Open (or create) the store at `path`, encrypted at rest with `key`
    /// (32 bytes from the platform keystore; see [`crate::crypt`]). A store
    /// is encrypted or not from its creation: the wrong key, a key for a
    /// clear store, or no key for an encrypted one is an error.
    pub fn open_with_key(path: &Path, key: Option<&[u8; 32]>) -> Result<Self> {
        Self::init(Connection::open(path)?, key.map(RecordKey::from_bytes))
    }

    /// An in-memory store, for tests.
    pub fn in_memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?, None)
    }

    /// An encrypted in-memory store, for tests.
    pub fn in_memory_with_key(key: &[u8; 32]) -> Result<Self> {
        Self::init(
            Connection::open_in_memory()?,
            Some(RecordKey::from_bytes(key)),
        )
    }

    fn init(conn: Connection, key: Option<RecordKey>) -> Result<Self> {
        conn.pragma_update(None, "foreign_keys", true)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        conn.execute_batch(DDL)?;
        conn.execute_batch(maint::DDL)?;
        crate::audit::init(&conn)?;
        sync::init(&conn)?;
        let mode: Option<String> = conn
            .query_row(
                "SELECT value FROM records_meta WHERE key = 'encryption'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        match (mode, &key) {
            (None, _) => {
                let used: bool = conn.query_row(
                    "SELECT EXISTS (SELECT 1 FROM proc_run) OR EXISTS (SELECT 1 FROM outbox)
                            OR EXISTS (SELECT 1 FROM audit) OR EXISTS (SELECT 1 FROM job)
                            OR EXISTS (SELECT 1 FROM asset) OR EXISTS (SELECT 1 FROM lesson)",
                    [],
                    |r| r.get(0),
                )?;
                if used && key.is_some() {
                    return Err(Error::Crypto(
                        "these records were written unencrypted; a key cannot be added in place"
                            .into(),
                    ));
                }
                let value = match &key {
                    Some(k) => k.seal("records_meta.encryption", KEY_CHECK)?,
                    None => "none".to_string(),
                };
                conn.execute(
                    "INSERT INTO records_meta (key, value) VALUES ('encryption', ?1)",
                    [value],
                )?;
            }
            (Some(v), None) if v == "none" => {}
            (Some(_), None) => {
                return Err(Error::Crypto(
                    "the records are encrypted; open them with the key".into(),
                ));
            }
            (Some(v), Some(_)) if v == "none" => {
                return Err(Error::Crypto(
                    "these records are not encrypted; open them without a key".into(),
                ));
            }
            (Some(v), Some(k)) => {
                if k.open("records_meta.encryption", &v)? != KEY_CHECK {
                    return Err(Error::Crypto("wrong records key".into()));
                }
            }
        }
        Ok(Self { conn, key })
    }

    /// The store's key, when it is encrypted.
    pub fn key(&self) -> Option<&RecordKey> {
        self.key.as_ref()
    }

    /// Append an audit entry (sealed when the store is encrypted).
    pub fn append_audit(&self, entry: &crate::audit::AuditEntry) -> Result<i64> {
        let tx = self.write_tx()?;
        let seq = crate::audit::append_locked_with(&tx, self.key(), entry)?;
        tx.commit()?;
        Ok(seq)
    }

    /// Verify the audit chain and read its modes.
    pub fn verify_audit(&self) -> Result<crate::audit::ChainReport> {
        crate::audit::verify_chain_with(&self.conn, self.key())
    }

    /// The audit entries, oldest first.
    pub fn audit_entries(&self) -> Result<Vec<(i64, crate::audit::AuditEntry)>> {
        crate::audit::entries_with(&self.conn, self.key())
    }

    /// Pending uploads, opened.
    pub fn pending(&self, limit: usize) -> Result<Vec<sync::Upload>> {
        sync::pending_with(&self.conn, self.key(), limit)
    }

    /// Send the outbox through `transport`.
    pub fn flush(
        &self,
        transport: &dyn sync::Transport,
        batch_size: usize,
    ) -> Result<sync::FlushReport> {
        let out = sync::flush_with(&self.conn, self.key(), transport, batch_size);
        // Remember how the last attempt went (never a live probe).
        let state = match &out {
            Ok(r) => {
                serde_json::json!({"at": now_rfc3339(), "ok": r.error.is_none(), "error": r.error})
            }
            Err(e) => serde_json::json!({"at": now_rfc3339(), "ok": false, "error": e.to_string()}),
        };
        // The flush's own result wins; failing to note it is only logged.
        if let Err(e) = self.conn.execute(
            "INSERT INTO records_meta (key, value) VALUES ('sync_last_attempt', ?1)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value",
            [state.to_string()],
        ) {
            eprintln!("harvest: could not note the sync attempt: {e}");
        }
        out
    }

    /// When the outbox last reached the other side, and how the last
    /// attempt went.
    pub fn sync_state(&self) -> Result<SyncState> {
        let last_synced_at: Option<String> =
            self.conn
                .query_row("SELECT MAX(acked_at) FROM outbox", [], |r| r.get(0))?;
        let last: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM records_meta WHERE key = 'sync_last_attempt'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        let last: Option<serde_json::Value> = last.and_then(|l| serde_json::from_str(&l).ok());
        let get = |k: &str| last.as_ref().and_then(|v| v.get(k)).cloned();
        Ok(SyncState {
            last_synced_at,
            last_attempt_at: get("at").and_then(|v| v.as_str().map(str::to_string)),
            last_attempt_ok: get("ok").and_then(|v| v.as_bool()),
            last_error: get("error").and_then(|v| v.as_str().map(str::to_string)),
        })
    }

    /// Queue counts.
    pub fn outbox_status(&self) -> Result<sync::OutboxStatus> {
        sync::status(&self.conn)
    }

    fn seal(&self, aad: &str, v: Option<&str>) -> Result<Option<String>> {
        v.map(|v| crypt::seal_opt(self.key(), aad, v)).transpose()
    }

    fn unseal(&self, aad: &str, v: Option<String>) -> Result<Option<String>> {
        v.map(|v| crypt::open_opt(self.key(), aad, &v)).transpose()
    }

    /// The connection, for the audit log and the outbox.
    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    /// Start a run of `proc_id`.
    pub fn start_run(&self, pack: &Pack, proc_id: &str, who: &StartRun) -> Result<Run> {
        let proc = pack
            .procedure(proc_id)?
            .ok_or_else(|| Error::Invalid(format!("no procedure {proc_id:?} in the pack")))?;
        if let Some(e) = &who.equip_id
            && !pack.equipment().iter().any(|x| &x.equip_id == e)
        {
            return Err(Error::Invalid(format!("no equipment {e:?} in the pack")));
        }
        let role = who.role.trim();
        if role.is_empty() {
            return Err(Error::Invalid("a run needs a role".into()));
        }
        let steps_sha = steps_sha256(&pack.proc_steps(&proc.proc_id)?)?;
        let run = Run {
            run_id: new_id("run", &[pack.pack_id(), &proc.proc_id, role]),
            pack_id: pack.pack_id().to_string(),
            pack_version: pack.version().to_string(),
            proc_id: proc.proc_id,
            equip_id: who.equip_id.clone(),
            asset: who.asset.clone().filter(|a| !a.trim().is_empty()),
            role: role.to_string(),
            started_at: now_rfc3339(),
            finished_at: None,
            status: "open".into(),
            steps: Vec::new(),
        };
        self.conn.execute(
            "INSERT INTO proc_run (run_id, pack_id, pack_version, proc_id, equip_id, asset, role,
                                   steps_sha256, started_at, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'open')",
            params![
                run.run_id,
                run.pack_id,
                run.pack_version,
                run.proc_id,
                run.equip_id,
                self.seal(
                    &format!("proc_run.asset:{}", run.run_id),
                    run.asset.as_deref()
                )?,
                run.role,
                steps_sha,
                run.started_at
            ],
        )?;
        Ok(run)
    }

    /// Record (or correct) one step of an open run. The input must fit the
    /// step's `check_kind`. A failed `pass_fail` step is a deficiency: it is
    /// queued for review at once and its guidance is returned.
    pub fn record_step(
        &self,
        pack: &Pack,
        run_id: &str,
        ord: i64,
        input: StepInput,
    ) -> Result<StepOutcome> {
        // The write lock first: the run cannot close between the check and
        // the write.
        let tx = self.write_tx()?;
        let run = self.open_run(run_id)?;
        let steps = self.steps_for(&run, pack)?;
        let step = steps
            .iter()
            .find(|s| s.ord == ord)
            .ok_or_else(|| Error::Invalid(format!("{} has no step {ord}", run.proc_id)))?;
        validate(step, &input)?;
        let deficiency = input.outcome == Outcome::Fail;
        let record = StepRecord {
            ord,
            deficiency,
            recorded_at: now_rfc3339(),
            input,
        };
        let guidance = if deficiency {
            step.deficiency
                .clone()
                .map(|d| guidance(pack, d))
                .transpose()?
        } else {
            None
        };
        let row: StepRow = (
            record.input.outcome.as_str(),
            deficiency,
            record.recorded_at.as_str(),
        );
        tx.execute(
            "INSERT INTO step_result (run_id, ord, result, value, note, photos, structured,
                                      deficiency, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT (run_id, ord) DO UPDATE SET
               result = excluded.result, value = excluded.value, note = excluded.note,
               photos = excluded.photos, structured = excluded.structured,
               deficiency = excluded.deficiency, recorded_at = excluded.recorded_at",
            params![
                run_id,
                ord,
                record.input.outcome.as_str(),
                self.seal(
                    &step_aad("value", run_id, ord, &row),
                    record.input.value.as_deref()
                )?,
                self.seal(
                    &step_aad("note", run_id, ord, &row),
                    record.input.note.as_deref()
                )?,
                self.seal(
                    &step_aad("photos", run_id, ord, &row),
                    Some(&serde_json::to_string(&record.input.photos)?)
                )?,
                self.seal(
                    &step_aad("structured", run_id, ord, &row),
                    record
                        .input
                        .structured
                        .as_ref()
                        .map(serde_json::to_string)
                        .transpose()?
                        .as_deref()
                )?,
                deficiency,
                record.recorded_at
            ],
        )?;
        // One live deficiency per step: a correction withdraws the pending
        // one, and retracts one already sent.
        let item_ref = format!("{run_id}#{ord}");
        let (_, sent) = sync::supersede(&tx, "deficiency", &item_ref)?;
        if !deficiency && sent {
            sync::enqueue_ref(
                &tx,
                self.key(),
                "deficiency_cleared",
                Some(&item_ref),
                &serde_json::json!({"run_id": run_id, "step": ord, "record": record}),
            )?;
        }
        if deficiency {
            sync::enqueue_ref(
                &tx,
                self.key(),
                "deficiency",
                Some(&item_ref),
                &serde_json::json!({
                    "run_id": run_id,
                    "pack_id": run.pack_id,
                    "pack_version": run.pack_version,
                    "proc_id": run.proc_id,
                    "equip_id": run.equip_id,
                    "asset": run.asset,
                    "step": step.ord,
                    "step_text": step.text,
                    "section_ids": step.section_ids,
                    "record": record,
                }),
            )?;
        }
        tx.commit()?;
        Ok(StepOutcome { record, guidance })
    }

    /// Finish a run. Every step must be recorded; the finished run is queued
    /// for upload.
    pub fn finish_run(&self, pack: &Pack, run_id: &str) -> Result<Run> {
        let tx = self.write_tx()?;
        let run = self.open_run(run_id)?;
        let steps = self.steps_for(&run, pack)?;
        let missing: Vec<i64> = steps
            .iter()
            .map(|s| s.ord)
            .filter(|o| !run.steps.iter().any(|r| r.ord == *o))
            .collect();
        if !missing.is_empty() {
            return Err(Error::Invalid(format!(
                "steps not recorded yet: {missing:?}"
            )));
        }
        let run = self.close(&tx, run, "complete", Some((pack, &steps)))?;
        tx.commit()?;
        Ok(run)
    }

    /// Stop a run without finishing it. What was recorded is still queued.
    /// It works even after a pack update changed the procedure (the report
    /// then carries the records without the step texts).
    pub fn abandon_run(&self, pack: &Pack, run_id: &str) -> Result<Run> {
        let tx = self.write_tx()?;
        let run = self.open_run(run_id)?;
        let steps = self.steps_for(&run, pack).ok();
        let run = self.close(&tx, run, "abandoned", steps.as_ref().map(|s| (pack, s)))?;
        tx.commit()?;
        Ok(run)
    }

    fn close(
        &self,
        tx: &Connection,
        mut run: Run,
        status: &str,
        steps: Option<(&Pack, &Vec<ProcStep>)>,
    ) -> Result<Run> {
        run.status = status.to_string();
        run.finished_at = Some(now_rfc3339());
        tx.execute(
            "UPDATE proc_run SET status = ?2, finished_at = ?3 WHERE run_id = ?1",
            params![run.run_id, status, run.finished_at],
        )?;
        let report = RunReport::build(&run, steps)?;
        sync::enqueue_ref(
            tx,
            self.key(),
            "run",
            Some(&run.run_id),
            &serde_json::to_value(&report)?,
        )?;
        Ok(run)
    }

    /// The run as a report (`harvest-run/1`): the format of the queued `run`
    /// upload and of the app's export. With the pack the run began on (or
    /// one whose procedure steps are unchanged), every step carries its text,
    /// sections and check kind, recorded or not.
    pub fn report(&self, pack: &Pack, run_id: &str) -> Result<RunReport> {
        let run = self
            .run(run_id)?
            .ok_or_else(|| Error::Invalid(format!("no run {run_id:?}")))?;
        let steps = self.steps_for(&run, pack).ok();
        RunReport::build(&run, steps.as_ref().map(|s| (pack, s)))
    }

    /// `BEGIN IMMEDIATE` on the store's connection.
    fn write_tx(&self) -> Result<Transaction<'_>> {
        Ok(Transaction::new_unchecked(
            &self.conn,
            TransactionBehavior::Immediate,
        )?)
    }

    /// The steps `run` is recorded against. The pack may have been updated
    /// since the run began: that is fine while the procedure's steps are
    /// unchanged, and refused otherwise, so a result never lands on a
    /// different step than the one the user saw.
    fn steps_for(&self, run: &Run, pack: &Pack) -> Result<Vec<ProcStep>> {
        if run.pack_id != pack.pack_id() {
            return Err(Error::Invalid(format!(
                "run {} belongs to pack {}, not {}",
                run.run_id,
                run.pack_id,
                pack.pack_id()
            )));
        }
        let steps = pack.proc_steps(&run.proc_id)?;
        let began: String = self.conn.query_row(
            "SELECT steps_sha256 FROM proc_run WHERE run_id = ?1",
            [&run.run_id],
            |r| r.get(0),
        )?;
        if steps_sha256(&steps)? != began {
            return Err(Error::Invalid(format!(
                "{} changed in pack {} since run {} began on {}; finish it on that version or abandon it",
                run.proc_id,
                pack.version(),
                run.run_id,
                run.pack_version
            )));
        }
        Ok(steps)
    }

    fn open_run(&self, run_id: &str) -> Result<Run> {
        let run = self
            .run(run_id)?
            .ok_or_else(|| Error::Invalid(format!("no run {run_id:?}")))?;
        if run.status != "open" {
            return Err(Error::Invalid(format!("run {run_id} is {}", run.status)));
        }
        Ok(run)
    }

    /// A run with its recorded steps.
    pub fn run(&self, run_id: &str) -> Result<Option<Run>> {
        let run = self
            .conn
            .query_row(
                "SELECT run_id, pack_id, pack_version, proc_id, equip_id, asset, role, started_at,
                        finished_at, status
                 FROM proc_run WHERE run_id = ?1",
                [run_id],
                |r| {
                    Ok(Run {
                        run_id: r.get(0)?,
                        pack_id: r.get(1)?,
                        pack_version: r.get(2)?,
                        proc_id: r.get(3)?,
                        equip_id: r.get(4)?,
                        asset: r.get(5)?,
                        role: r.get(6)?,
                        started_at: r.get(7)?,
                        finished_at: r.get(8)?,
                        status: r.get(9)?,
                        steps: Vec::new(),
                    })
                },
            )
            .optional()?;
        let Some(mut run) = run else { return Ok(None) };
        run.asset = self.unseal(&format!("proc_run.asset:{}", run.run_id), run.asset.take())?;
        let mut stmt = self.conn.prepare_cached(
            "SELECT ord, result, value, note, photos, structured, deficiency, recorded_at
             FROM step_result WHERE run_id = ?1 ORDER BY ord",
        )?;
        type Row = (
            i64,
            String,
            Option<String>,
            Option<String>,
            String,
            Option<String>,
            bool,
            String,
        );
        let rows: Vec<Row> = stmt
            .query_map([run_id], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;
        for (ord, result, value, note, photos, structured, deficiency, recorded_at) in rows {
            let row: StepRow = (result.as_str(), deficiency, recorded_at.as_str());
            run.steps.push(StepRecord {
                ord,
                input: StepInput {
                    outcome: Outcome::parse(&result)?,
                    value: self.unseal(&step_aad("value", run_id, ord, &row), value)?,
                    note: self.unseal(&step_aad("note", run_id, ord, &row), note)?,
                    photos: serde_json::from_str(
                        &self
                            .unseal(&step_aad("photos", run_id, ord, &row), Some(photos))?
                            .unwrap_or_default(),
                    )?,
                    structured: self
                        .unseal(&step_aad("structured", run_id, ord, &row), structured)?
                        .map(|s| serde_json::from_str(&s))
                        .transpose()?,
                },
                deficiency,
                recorded_at,
            });
        }
        Ok(Some(run))
    }

    /// Runs not yet finished or abandoned, newest first (to resume).
    pub fn open_runs(&self) -> Result<Vec<Run>> {
        let ids: Vec<String> = self
            .conn
            .prepare("SELECT run_id FROM proc_run WHERE status = 'open' ORDER BY started_at DESC")?
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        ids.iter()
            .map(|id| {
                self.run(id)?
                    .ok_or_else(|| Error::Invalid(format!("run {id} vanished")))
            })
            .collect()
    }

    /// Record one answer: its audit row, and for a decline a queued miss, in
    /// one transaction.
    pub fn record_answer(
        &self,
        pack: &Pack,
        question: &str,
        resp: &crate::answer::AskResponse,
        trace: &crate::answer::AskTrace,
    ) -> Result<i64> {
        let tx = self.write_tx()?;
        let entry = crate::audit::AuditEntry::from_answer(pack.pack_id(), question, resp, trace);
        let seq = crate::audit::append_locked_with(&tx, self.key(), &entry)?;
        if resp.mode == crate::answer::Mode::Declined {
            self.queue_miss(&tx, pack, question, "declined", &resp.nearest)?;
        }
        tx.commit()?;
        Ok(seq)
    }

    /// Queue a question the pack could not answer (declined, or answered
    /// with nothing supported) so the next bake covers it.
    pub fn log_miss(
        &self,
        pack: &Pack,
        question: &str,
        mode: &str,
        nearest: &[String],
    ) -> Result<String> {
        self.queue_miss(&self.conn, pack, question, mode, nearest)
    }

    fn queue_miss(
        &self,
        conn: &Connection,
        pack: &Pack,
        question: &str,
        mode: &str,
        nearest: &[String],
    ) -> Result<String> {
        if question.trim().is_empty() {
            return Err(Error::Invalid("empty question".into()));
        }
        sync::enqueue_ref(
            conn,
            self.key(),
            "miss",
            None,
            &serde_json::json!({
                "pack_id": pack.pack_id(),
                "pack_version": pack.version(),
                "question": question,
                "mode": mode,
                "nearest": nearest,
                "at": now_rfc3339(),
            }),
        )
    }
}

/// Check `key` against a store without writing to it (for read-only tools).
/// A database that never held records accepts no key.
pub fn check_key(conn: &Connection, key: Option<&RecordKey>) -> Result<()> {
    let has_meta: bool = conn.query_row(
        "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'records_meta')",
        [],
        |r| r.get(0),
    )?;
    let mode: Option<String> = if has_meta {
        conn.query_row(
            "SELECT value FROM records_meta WHERE key = 'encryption'",
            [],
            |r| r.get(0),
        )
        .optional()?
    } else {
        None
    };
    match (mode.as_deref(), key) {
        (None | Some("none"), None) => Ok(()),
        (None | Some("none"), Some(_)) => Err(Error::Crypto(
            "these records are not encrypted; open them without a key".into(),
        )),
        (Some(_), None) => Err(Error::Crypto(
            "the records are encrypted; open them with the key".into(),
        )),
        (Some(v), Some(k)) => {
            if k.open("records_meta.encryption", v)? == KEY_CHECK {
                Ok(())
            } else {
                Err(Error::Crypto("wrong records key".into()))
            }
        }
    }
}

/// What a sealed step column is bound to: its row and the clear evidence
/// beside it (outcome, deficiency flag, time), so flipping a clear `fail`
/// to `pass`, or replaying an older value, makes the row fail to open.
fn step_aad(column: &str, run_id: &str, ord: i64, row: &StepRow) -> String {
    format!(
        "step_result.{column}:{run_id}#{ord}|{}|{}|{}",
        row.0, row.1 as u8, row.2
    )
}

/// `(result, deficiency, recorded_at)` of a step row.
type StepRow<'a> = (&'a str, bool, &'a str);

/// SHA-256 of a procedure's steps as the pack states them.
fn steps_sha256(steps: &[ProcStep]) -> Result<String> {
    Ok(hex_encode(&Sha256::digest(
        serde_json::to_string(steps)?.as_bytes(),
    )))
}

fn validate(step: &ProcStep, input: &StepInput) -> Result<()> {
    let has = |s: &Option<String>| s.as_deref().is_some_and(|v| !v.trim().is_empty());
    let ok = match (step.check_kind.as_str(), input.outcome) {
        ("pass_fail", Outcome::Pass | Outcome::Fail | Outcome::Na) => true,
        ("value", Outcome::Value) => has(&input.value),
        ("value", Outcome::Na) => true,
        ("note", Outcome::Note) => has(&input.note),
        ("note", Outcome::Na) => true,
        ("photo", Outcome::Photo) => !input.photos.is_empty(),
        ("photo", Outcome::Na) => true,
        ("pass_fail" | "value" | "note" | "photo", _) => false,
        (other, _) => {
            return Err(Error::Pack(format!(
                "step {}#{} has unknown check_kind {other:?}",
                step.proc_id, step.ord
            )));
        }
    };
    if !ok {
        return Err(Error::Invalid(format!(
            "step {} expects {} (with its value, note or photo), got {:?}",
            step.ord, step.check_kind, input.outcome
        )));
    }
    for p in &input.photos {
        check_photo(p)?;
    }
    Ok(())
}

/// A photo reference needs a path and a SHA-256.
pub(crate) fn check_photo(p: &PhotoRef) -> Result<()> {
    if p.path.trim().is_empty()
        || p.sha256.len() != 64
        || !p.sha256.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(Error::Invalid(format!(
            "photo {:?} needs a path and a SHA-256",
            p.path
        )));
    }
    Ok(())
}

fn guidance(pack: &Pack, d: Deficiency) -> Result<Guidance> {
    // Practice guidance has no rule: no citation, and nothing to verify.
    let section = match d.section_id.as_deref() {
        Some(id) if d.is_rule() => pack.section(id)?,
        _ => None,
    };
    let quote_verified = match (&section, &d.quote) {
        (Some(s), Some(q)) => crate::check::quote_in(q, &s.text),
        _ => false,
    };
    Ok(Guidance {
        citation: section.map(|s| s.citation),
        quote_verified,
        deficiency: d,
    })
}
