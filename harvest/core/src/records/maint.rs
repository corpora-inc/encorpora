//! Device records for troubleshooting: physical assets (a fleet registry),
//! jobs walked through a pack's fault trees, lessons captured at close-out,
//! and reviewer-approved field notes received from the hub.
//!
//! The next node of a job is chosen by [`crate::maint::branch::choose`] from
//! the recorded result. Every job event appends to the hash-chained audit
//! log in the same transaction as the write. A job is recorded against its
//! tree as it was when the job began: a pack update that changes the tree
//! refuses further answers on that job, like a run.

use super::{Records, new_id};
use crate::audit::{AuditEvent, now_rfc3339};
use crate::error::{Error, Result};
use crate::maint::branch::{self, RecordedResult};
use crate::maint::search::{self, Observation};
use crate::maint::view::{self, NodeView};
use crate::maint::{FailureMode, HistoryEvent, Tree};
use crate::pack::Pack;
use crate::packs::{TrustedKey, valid_id};
use crate::records::PhotoRef;
use crate::sync;
use rusqlite::{Connection, OptionalExtension, params};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) const DDL: &str = "
CREATE TABLE IF NOT EXISTS asset (
  asset_id   TEXT PRIMARY KEY,
  equip_id   TEXT,
  serial     TEXT,
  name       TEXT,
  attrs      TEXT NOT NULL,
  hours      REAL,
  miles      REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS asset_event (
  seq        INTEGER PRIMARY KEY,
  asset_id   TEXT NOT NULL REFERENCES asset(asset_id),
  date       TEXT NOT NULL,
  system     TEXT,
  symptom_id TEXT,
  tree_id    TEXT,
  text       TEXT,
  source     TEXT NOT NULL CHECK (source IN ('import'))
);
CREATE TABLE IF NOT EXISTS job (
  job_id       TEXT PRIMARY KEY,
  pack_id      TEXT NOT NULL,
  pack_version TEXT NOT NULL,
  tree_id      TEXT NOT NULL,
  tree_sha256  TEXT NOT NULL,         -- the tree when the job began
  system       TEXT,
  entry_node   TEXT NOT NULL,
  entered_by   TEXT NOT NULL CHECK (entered_by IN ('symptom', 'signals', 'chosen')),
  symptom_id   TEXT,
  entry_detail TEXT,                  -- sealed json {query, signals}
  asset_id     TEXT,
  equip_id     TEXT,
  level        TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at    TEXT NOT NULL,
  closed_at    TEXT,
  current_node TEXT NOT NULL,
  resolution   TEXT                   -- sealed json
);
CREATE INDEX IF NOT EXISTS job_asset ON job (asset_id, opened_at);
CREATE TABLE IF NOT EXISTS job_step (
  job_id        TEXT NOT NULL REFERENCES job(job_id),
  seq           INTEGER NOT NULL,
  node_id       TEXT NOT NULL,
  outcome       TEXT,
  value         REAL,
  unit          TEXT,
  label         TEXT NOT NULL,        -- the branch taken
  note          TEXT,                 -- sealed
  photos        TEXT NOT NULL,        -- sealed json
  next_node     TEXT NOT NULL,
  at            TEXT NOT NULL,
  superseded_at TEXT,                 -- set when the technician went back
  PRIMARY KEY (job_id, seq)
);
CREATE TABLE IF NOT EXISTS lesson (
  lesson_id   TEXT PRIMARY KEY,
  pack_id     TEXT,
  pack_version TEXT,
  job_id      TEXT,
  asset_id    TEXT,
  equip_id    TEXT,
  tree_id     TEXT,
  symptom_id  TEXT,
  node_id     TEXT,
  cause       TEXT NOT NULL,          -- sealed
  action      TEXT NOT NULL,          -- sealed
  parts       TEXT NOT NULL,          -- sealed json
  minutes     INTEGER,
  note        TEXT,                   -- sealed
  photos      TEXT NOT NULL,          -- sealed json
  level       TEXT,
  status      TEXT NOT NULL CHECK (status IN ('local', 'queued', 'approved', 'edited', 'rejected')),
  review_note TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS field_stream (
  stream       TEXT PRIMARY KEY,
  seq          INTEGER NOT NULL,
  key_id       TEXT NOT NULL,
  installed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS field_note (
  note_id     TEXT PRIMARY KEY,
  stream      TEXT NOT NULL,
  seq         INTEGER NOT NULL,
  pack_id     TEXT,
  equip_id    TEXT,
  tree_id     TEXT,
  node_id     TEXT,
  symptom_id  TEXT,
  text        TEXT NOT NULL,
  counts      TEXT NOT NULL,
  approver    TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  supersedes  TEXT,
  lang        TEXT,
  active      INTEGER NOT NULL,
  received_at TEXT NOT NULL
);
";

/// Columns added after the first stores were made.
pub(crate) fn migrate(conn: &Connection) -> Result<()> {
    for (table, column, ty) in [
        ("job", "tree_shas", "TEXT"),
        ("job_step", "tree_id", "TEXT"),
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
    Ok(())
}

/// The asset registry file format.
pub const ASSET_REGISTRY_FORMAT: &str = "harvest-assets/1";
/// The job report format (the queued `job` upload).
pub const JOB_REPORT_FORMAT: &str = "harvest-job/1";
/// The lesson upload format.
pub const LESSON_FORMAT: &str = "harvest-lesson/1";
/// Default least interval between fleet-summary fetches.
pub const DEFAULT_FLEET_EVERY_HOURS: f64 = 24.0;

/// Milliseconds since 1970 of an RFC 3339 time as this crate writes it.
pub(crate) fn parse_rfc3339_ms(t: &str) -> Option<i64> {
    let day = day_number(t)?;
    let h: i64 = t.get(11..13)?.parse().ok()?;
    let mi: i64 = t.get(14..16)?.parse().ok()?;
    let se: i64 = t.get(17..19)?.parse().ok()?;
    let ms: i64 = t.get(20..23).and_then(|m| m.parse().ok()).unwrap_or(0);
    Some(day * 86_400_000 + h * 3_600_000 + mi * 60_000 + se * 1000 + ms)
}

/// The signed fleet summary document format.
pub const FLEET_FORMAT: &str = "harvest-fleet/1";

/// The SHA-256 a bundle announces for a fleet summary: canonical JSON of
/// the summary with `generated_at` blank (the numbers, not the time).
pub fn fleet_sha256(f: &FleetSummary) -> Result<String> {
    let mut f = f.clone();
    f.generated_at = String::new();
    let bytes = crate::canon::to_vec(&serde_json::to_value(&f)?)?;
    use sha2::Digest;
    Ok(crate::packs::hex_encode(&sha2::Sha256::digest(&bytes)))
}

/// The field-note bundle format.
pub const FIELD_FORMAT: &str = "harvest-field/1";

// ---------------------------------------------------------------- assets

/// A physical unit, as entered or imported.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AssetInput {
    /// The fleet's own id (unit number). Generated when absent.
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub attrs: BTreeMap<String, Value>,
    #[serde(default)]
    pub hours: Option<f64>,
    #[serde(default)]
    pub miles: Option<f64>,
}

/// A physical unit.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Asset {
    pub asset_id: String,
    pub equip_id: Option<String>,
    pub serial: Option<String>,
    pub name: Option<String>,
    pub attrs: BTreeMap<String, Value>,
    pub hours: Option<f64>,
    pub miles: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
}

/// A past maintenance event from the fleet registry.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AssetEventInput {
    /// `YYYY-MM-DD` or an RFC 3339 time.
    pub date: String,
    #[serde(default)]
    pub system: Option<String>,
    #[serde(default)]
    pub symptom_id: Option<String>,
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
}

/// One entry of an asset registry.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RegistryAsset {
    pub asset_id: String,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub attrs: BTreeMap<String, Value>,
    #[serde(default)]
    pub hours: Option<f64>,
    #[serde(default)]
    pub miles: Option<f64>,
    #[serde(default)]
    pub events: Vec<AssetEventInput>,
}

/// An asset registry file (`harvest-assets/1`), to preload a fleet.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AssetRegistry {
    pub format: String,
    pub assets: Vec<RegistryAsset>,
}

/// What an import did.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ImportReport {
    pub created: u64,
    pub updated: u64,
    pub events: u64,
}

/// A registry event as stored.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct AssetEvent {
    pub asset_id: String,
    pub date: String,
    pub system: Option<String>,
    pub symptom_id: Option<String>,
    pub tree_id: Option<String>,
    pub text: Option<String>,
}

// ------------------------------------------------------------------ jobs

/// How a job was entered.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    /// From a reported symptom (typed, spoken or picked from a search).
    Symptom,
    /// From signals read from the machine.
    Signals,
    /// The technician chose the tree.
    Chosen,
}

impl EntryKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::Symptom => "symptom",
            Self::Signals => "signals",
            Self::Chosen => "chosen",
        }
    }
    fn parse(s: &str) -> Result<Self> {
        Ok(match s {
            "symptom" => Self::Symptom,
            "signals" => Self::Signals,
            "chosen" => Self::Chosen,
            o => return Err(Error::Invalid(format!("unknown entry {o:?}"))),
        })
    }
}

/// Start a troubleshooting job. Give a `symptom_id`, `signals`, or a
/// `tree_id` (with an optional entry `node_id`).
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct JobStart {
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub symptom_id: Option<String>,
    /// The technician's words (kept with the job).
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub signals: Vec<Observation>,
    /// Start here instead of the tree's entry (must be in the tree).
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    /// The variant; the asset's when absent.
    #[serde(default)]
    pub equip_id: Option<String>,
    /// A level of the pack (`pack.info` lists them).
    pub level: String,
}

/// One recorded answer.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct JobStep {
    pub seq: i64,
    pub node_id: String,
    pub outcome: Option<String>,
    pub value: Option<f64>,
    pub unit: Option<String>,
    /// The branch code took.
    pub label: String,
    pub note: Option<String>,
    pub photos: Vec<PhotoRef>,
    pub next_node: String,
    pub at: String,
    /// When the technician went back over it (the step is kept, audited).
    pub superseded_at: Option<String>,
    /// The tree the node belongs to (a job can follow a goto into another).
    pub tree_id: String,
}

/// How a job ended.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionKind {
    /// The fault is corrected.
    Fixed,
    /// Handed to a higher level of maintenance.
    Escalated,
    /// Continued in another tree or task.
    Redirected,
    /// Stopped without a fix.
    Unresolved,
    Abandoned,
}

/// The close-out.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Resolution {
    pub kind: ResolutionKind,
    /// The node the job ended at.
    pub node_id: String,
    pub note: Option<String>,
}

/// One troubleshooting session on an asset.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Job {
    pub job_id: String,
    pub pack_id: String,
    pub pack_version: String,
    pub tree_id: String,
    pub system: Option<String>,
    pub entry_node: String,
    pub entered_by: EntryKind,
    pub symptom_id: Option<String>,
    pub query: Option<String>,
    pub signals: Vec<Observation>,
    pub asset_id: Option<String>,
    pub equip_id: Option<String>,
    pub level: String,
    /// `open` | `closed`.
    pub status: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub current_node: String,
    pub resolution: Option<Resolution>,
    /// Every recorded step, superseded ones included, in order.
    pub steps: Vec<JobStep>,
}

impl Job {
    /// Steps still in force, in order.
    pub fn path(&self) -> Vec<&JobStep> {
        self.steps
            .iter()
            .filter(|s| s.superseded_at.is_none())
            .collect()
    }
}

/// What the technician recorded at the current node.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct JobAnswer {
    /// The node being answered; must be the job's current node (a stale or
    /// repeated submit is refused).
    pub node_id: String,
    /// `yes` | `no` | `pass` | `fail` | a choice option | `done`.
    #[serde(default)]
    pub outcome: Option<String>,
    /// A measured value, with its `unit`.
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub photos: Vec<PhotoRef>,
}

impl JobAnswer {
    /// The result as branching reads it.
    pub fn result(&self) -> RecordedResult {
        RecordedResult {
            outcome: self.outcome.clone(),
            value: self.value,
            unit: self.unit.clone(),
        }
    }
}

/// Close a job.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct JobClose {
    pub resolution: ResolutionKind,
    #[serde(default)]
    pub note: Option<String>,
    /// The lesson captured at close-out, when there is one.
    #[serde(default)]
    pub lesson: Option<LessonInput>,
}

/// One answered step on the path, for the screen.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct PathEntry {
    pub seq: i64,
    pub node_id: String,
    pub text: Option<String>,
    pub outcome: Option<String>,
    pub value: Option<f64>,
    pub unit: Option<String>,
    pub label: String,
    pub next_node: String,
    pub at: String,
}

/// The step view: the manual's content at the current node, the path so
/// far, and field knowledge kept apart from the manual.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct StepView {
    #[serde(flatten)]
    pub node: NodeView,
    pub path: Vec<PathEntry>,
    /// Reviewer-approved field notes for this context. Field knowledge,
    /// never the manual's text.
    pub field_notes: Vec<FieldNote>,
}

/// A job and the screen for its current node.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct JobView {
    pub job: Job,
    /// `None` when the tree changed since the job began (`tree_changed`).
    pub step: Option<StepView>,
    pub tree_changed: bool,
    pub repeat: RepeatFlag,
    pub lesson_ids: Vec<String>,
}

/// A job in a list.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct JobSummary {
    pub job_id: String,
    pub pack_id: String,
    pub tree_id: String,
    /// The tree's title in the pack (when the pack is at hand).
    pub tree_title: Option<String>,
    pub symptom_id: Option<String>,
    pub system: Option<String>,
    pub asset_id: Option<String>,
    pub equip_id: Option<String>,
    pub status: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub current_node: String,
    pub resolution: Option<ResolutionKind>,
}

/// Why a job (or event) counts toward a repeat discrepancy.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct RepeatMatch {
    /// `job` | `event`.
    pub kind: String,
    pub job_id: Option<String>,
    pub date: String,
    pub symptom_id: Option<String>,
    pub system: Option<String>,
    /// `same_symptom` | `same_system`.
    pub reason: String,
    pub days_before: i64,
}

/// Repeat discrepancy: the same asset with the same symptom or system again
/// within the pack's window.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct RepeatFlag {
    pub flag: bool,
    pub window_days: i64,
    pub matches: Vec<RepeatMatch>,
}

/// A job in an asset's history, with its own repeat flag.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct HistoryJob {
    #[serde(flatten)]
    pub job: JobSummary,
    pub repeat: RepeatFlag,
}

/// An asset's history: its own jobs and registry events, the pack's fleet
/// history and failure modes for its variant, and the repeat flag.
#[derive(Debug, Clone, Serialize, JsonSchema, PartialEq)]
pub struct AssetHistory {
    pub asset: Asset,
    /// Newest first.
    pub jobs: Vec<HistoryJob>,
    pub events: Vec<AssetEvent>,
    pub fleet_history: Vec<HistoryEvent>,
    pub failure_modes: Vec<FailureMode>,
    /// True when the newest job repeats an earlier one within the window.
    pub repeat: bool,
}

/// The job as uploaded (`harvest-job/1`).
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct JobReport {
    pub format: String,
    pub pack_id: String,
    pub pack_version: String,
    pub job_id: String,
    pub tree_id: String,
    pub tree_title: Option<String>,
    pub system: Option<String>,
    pub entered_by: EntryKind,
    pub entry_node: String,
    pub symptom_id: Option<String>,
    pub query: Option<String>,
    pub signals: Vec<Observation>,
    pub asset_id: Option<String>,
    pub serial: Option<String>,
    pub equip_id: Option<String>,
    pub level: String,
    pub status: String,
    pub opened_at: String,
    pub closed_at: Option<String>,
    pub resolution: Option<Resolution>,
    /// False when the tree changed since the job began (node texts absent).
    pub tree_known: bool,
    pub steps: Vec<ReportJobStep>,
    pub lesson_ids: Vec<String>,
}

/// One step of a job report.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ReportJobStep {
    #[serde(flatten)]
    pub step: JobStep,
    pub text: Option<String>,
}

// --------------------------------------------------------------- lessons

/// A part used.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct PartUsed {
    pub text: String,
    #[serde(default)]
    pub ident: Option<String>,
    #[serde(default)]
    pub qty: Option<String>,
}

/// What fixed it, in the technician's words.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LessonInput {
    /// The lesson's id when it continues one begun on another unit (its
    /// edits then meet at the hub); new when absent.
    #[serde(default)]
    pub lesson_id: Option<String>,
    /// Fills asset, equipment, tree, symptom and node when they are absent.
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub symptom_id: Option<String>,
    /// The node it applies to.
    #[serde(default)]
    pub node_id: Option<String>,
    /// The verified cause.
    pub cause: String,
    /// The corrective action.
    pub action: String,
    #[serde(default)]
    pub parts: Vec<PartUsed>,
    #[serde(default)]
    pub minutes: Option<u32>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub photos: Vec<PhotoRef>,
    /// The technician's level.
    #[serde(default)]
    pub level: Option<String>,
    /// Queue it for upload now (default) or keep it on the device.
    #[serde(default = "yes")]
    pub submit: bool,
}

fn yes() -> bool {
    true
}

/// Where a lesson is.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LessonStatus {
    Local,
    Queued,
    Uploaded,
    Approved,
    Edited,
    Rejected,
}

/// A captured lesson.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct Lesson {
    pub lesson_id: String,
    pub pack_id: Option<String>,
    pub pack_version: Option<String>,
    pub job_id: Option<String>,
    pub asset_id: Option<String>,
    pub equip_id: Option<String>,
    pub tree_id: Option<String>,
    pub symptom_id: Option<String>,
    pub node_id: Option<String>,
    pub cause: String,
    pub action: String,
    pub parts: Vec<PartUsed>,
    pub minutes: Option<u32>,
    pub note: Option<String>,
    pub photos: Vec<PhotoRef>,
    pub level: Option<String>,
    pub status: LessonStatus,
    pub review_note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Which lessons to list.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LessonFilter {
    #[serde(default)]
    pub job_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub tree_id: Option<String>,
}

// ----------------------------------------------------------- field notes

/// What a field note is about: any of these; every one given must match.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NoteScope {
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub symptom_id: Option<String>,
}

impl NoteScope {
    fn is_empty(&self) -> bool {
        self.equip_id.is_none()
            && self.tree_id.is_none()
            && self.node_id.is_none()
            && self.symptom_id.is_none()
    }
}

/// Counts behind a note.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct NoteCounts {
    /// Units it was seen on.
    #[serde(default)]
    pub units: Option<u64>,
    /// Times it resolved the fault …
    #[serde(default)]
    pub resolved: Option<u64>,
    /// … of times it was tried.
    #[serde(default)]
    pub attempts: Option<u64>,
}

/// A reviewer-approved field note as the hub sends it.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FieldNoteIn {
    pub note_id: String,
    pub scope: NoteScope,
    pub text: String,
    #[serde(default)]
    pub counts: NoteCounts,
    pub approver: String,
    pub approved_at: String,
    /// The note this one replaces.
    #[serde(default)]
    pub supersedes: Option<String>,
    #[serde(default)]
    pub lang: Option<String>,
}

/// A hub's review of a lesson this device sent.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct LessonReview {
    pub lesson_id: String,
    /// `approved` | `edited` | `rejected`.
    pub status: LessonStatus,
    #[serde(default)]
    pub note: Option<String>,
}

/// A signed field-note bundle (`harvest-field/1`). The signature is
/// ed25519 over the canonical JSON without `signature`, as for packs.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FieldBundle {
    pub format: String,
    /// The hub's stream; `seq` increases within it.
    pub stream: String,
    #[serde(default)]
    pub pack_id: Option<String>,
    pub seq: u64,
    pub issued_at: String,
    #[serde(default)]
    pub notes: Vec<FieldNoteIn>,
    /// Note ids withdrawn.
    #[serde(default)]
    pub revoke: Vec<String>,
    #[serde(default)]
    pub reviews: Vec<LessonReview>,
    /// The SHA-256 of the hub's fleet summary as of this bundle; the device
    /// fetches the signed summary (`harvest-fleet/1`) when it holds another.
    #[serde(default)]
    pub fleet_sha256: Option<String>,
    pub signature: Value,
}

/// What the fleet shows, aggregated by the hub across every unit.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetSummary {
    pub generated_at: String,
    /// Units that reported.
    pub units: u64,
    /// Jobs per symptom (or tree, when entered without one) and variant.
    pub jobs: Vec<FleetJobs>,
    /// Corrective actions: how often each resolved the fault it was tried on.
    pub actions: Vec<FleetAction>,
    /// The same asset with the same symptom or system again within the window.
    pub repeats: Vec<FleetRepeat>,
    /// The most frequent verified causes per symptom.
    pub top_causes: Vec<FleetCauses>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetJobs {
    pub tree_id: String,
    pub symptom_id: Option<String>,
    pub equip_id: Option<String>,
    pub jobs: u64,
    pub fixed: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetAction {
    pub tree_id: Option<String>,
    pub action: String,
    pub attempts: u64,
    pub resolved: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetRepeat {
    pub asset_id: String,
    pub symptom_id: Option<String>,
    pub system: Option<String>,
    pub jobs: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetCauses {
    pub symptom_id: String,
    pub causes: Vec<FleetCause>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct FleetCause {
    pub cause: String,
    pub count: u64,
}

/// What one pull from the hub did.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct PullReport {
    /// Bundles installed, in order.
    pub installed: Vec<u64>,
    /// The bundle that was refused (and why); the pull stops there and the
    /// next one asks for it again.
    pub refused: Option<RefusedBundle>,
    pub notes: u64,
    pub fleet_updated: bool,
    /// Bytes of bundles received.
    pub bytes: u64,
    /// Bytes of the fleet summary received (fetched only when it changed).
    pub fleet_bytes: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct RefusedBundle {
    pub seq: Option<u64>,
    pub error: String,
}

/// A field note as stored and shown: field knowledge, never manual text.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FieldNote {
    pub note_id: String,
    /// Always `field`: the host shows it apart from the manual.
    pub source: String,
    pub stream: String,
    pub seq: u64,
    pub scope: NoteScope,
    pub text: String,
    pub counts: NoteCounts,
    pub approver: String,
    pub approved_at: String,
    pub supersedes: Option<String>,
    pub received_at: String,
}

/// What installing a bundle did.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct FieldInstall {
    pub stream: String,
    pub seq: u64,
    pub installed: u64,
    pub superseded: u64,
    pub revoked: u64,
    pub reviews: u64,
}

// ------------------------------------------------------------------ util

fn opt(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

/// Days since 1970-01-01 of a `YYYY-MM-DD…` date.
pub fn day_number(date: &str) -> Option<i64> {
    let d = date.get(..10)?;
    let mut it = d.split('-');
    let y: i64 = it.next()?.parse().ok()?;
    let m: i64 = it.next()?.parse().ok()?;
    let dd: i64 = it.next()?.parse().ok()?;
    if !(1..=12).contains(&m) || !(1..=31).contains(&dd) {
        return None;
    }
    // Days from civil (Howard Hinnant).
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + dd - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe - 719_468)
}

impl Records {
    fn audit_event(&self, tx: &Connection, ev: &AuditEvent) -> Result<i64> {
        crate::audit::append_event_locked_with(tx, self.key(), ev)
    }

    fn check_equip(pack: Option<&Pack>, equip: Option<&str>) -> Result<()> {
        if let (Some(p), Some(e)) = (pack, equip)
            && !p.equipment().iter().any(|x| x.equip_id == e)
        {
            return Err(Error::Invalid(format!("no equipment {e:?} in the pack")));
        }
        Ok(())
    }

    // ------------------------------------------------------------ assets

    /// Add an asset.
    pub fn create_asset(&self, pack: Option<&Pack>, input: AssetInput) -> Result<Asset> {
        let equip = opt(input.equip_id.clone());
        Self::check_equip(pack, equip.as_deref())?;
        let id = match opt(input.asset_id.clone()) {
            Some(id) => id,
            None => new_id("asset", &[input.serial.as_deref().unwrap_or("")]),
        };
        if self.asset(&id)?.is_some() {
            return Err(Error::Invalid(format!("asset {id:?} exists; update it")));
        }
        let now = now_rfc3339();
        let a = Asset {
            asset_id: id,
            equip_id: equip,
            serial: opt(input.serial),
            name: opt(input.name),
            attrs: input.attrs,
            hours: input.hours,
            miles: input.miles,
            created_at: now.clone(),
            updated_at: now,
        };
        self.put_asset(&self.conn, &a)?;
        Ok(a)
    }

    fn put_asset(&self, conn: &Connection, a: &Asset) -> Result<()> {
        conn.execute(
            "INSERT INTO asset (asset_id, equip_id, serial, name, attrs, hours, miles, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT (asset_id) DO UPDATE SET equip_id = excluded.equip_id,
               serial = excluded.serial, name = excluded.name, attrs = excluded.attrs,
               hours = excluded.hours, miles = excluded.miles, updated_at = excluded.updated_at",
            params![
                a.asset_id,
                a.equip_id,
                a.serial,
                a.name,
                serde_json::to_string(&a.attrs)?,
                a.hours,
                a.miles,
                a.created_at,
                a.updated_at
            ],
        )?;
        Ok(())
    }

    /// Change an asset: every field given replaces the stored one.
    pub fn update_asset(
        &self,
        pack: Option<&Pack>,
        asset_id: &str,
        input: AssetInput,
    ) -> Result<Asset> {
        let mut a = self
            .asset(asset_id)?
            .ok_or_else(|| Error::Invalid(format!("no asset {asset_id:?}")))?;
        if input.asset_id.as_deref().is_some_and(|i| i != asset_id) {
            return Err(Error::Invalid("an asset id cannot change".into()));
        }
        if let Some(e) = opt(input.equip_id) {
            Self::check_equip(pack, Some(&e))?;
            a.equip_id = Some(e);
        }
        if let Some(s) = opt(input.serial) {
            a.serial = Some(s);
        }
        if let Some(n) = opt(input.name) {
            a.name = Some(n);
        }
        if !input.attrs.is_empty() {
            a.attrs.extend(input.attrs);
        }
        if input.hours.is_some() {
            a.hours = input.hours;
        }
        if input.miles.is_some() {
            a.miles = input.miles;
        }
        a.updated_at = now_rfc3339();
        self.put_asset(&self.conn, &a)?;
        Ok(a)
    }

    /// One asset.
    pub fn asset(&self, asset_id: &str) -> Result<Option<Asset>> {
        let row = self
            .conn
            .query_row(
                "SELECT asset_id, equip_id, serial, name, attrs, hours, miles, created_at, updated_at
                 FROM asset WHERE asset_id = ?1",
                [asset_id],
                asset_row,
            )
            .optional()?;
        row.map(|(a, attrs)| finish_asset(a, &attrs)).transpose()
    }

    /// Every asset, by name then id.
    pub fn assets(&self) -> Result<Vec<Asset>> {
        let rows: Vec<(Asset, String)> = self
            .conn
            .prepare(
                "SELECT asset_id, equip_id, serial, name, attrs, hours, miles, created_at, updated_at
                 FROM asset ORDER BY name, asset_id",
            )?
            .query_map([], asset_row)?
            .collect::<rusqlite::Result<_>>()?;
        rows.into_iter()
            .map(|(a, attrs)| finish_asset(a, &attrs))
            .collect()
    }

    /// Preload a fleet from a registry (`harvest-assets/1`). Assets are
    /// created or updated by id; each asset's registry events are replaced.
    pub fn import_assets(&self, pack: Option<&Pack>, reg: &AssetRegistry) -> Result<ImportReport> {
        if reg.format != ASSET_REGISTRY_FORMAT {
            return Err(Error::Invalid(format!(
                "registry format {:?}, expected {ASSET_REGISTRY_FORMAT}",
                reg.format
            )));
        }
        let tx = self.write_tx()?;
        let mut report = ImportReport {
            created: 0,
            updated: 0,
            events: 0,
        };
        let now = now_rfc3339();
        for r in &reg.assets {
            let id = r.asset_id.trim();
            if id.is_empty() {
                return Err(Error::Invalid("a registry asset needs asset_id".into()));
            }
            let equip = opt(r.equip_id.clone());
            Self::check_equip(pack, equip.as_deref())?;
            let existing = self.asset(id)?;
            let a = Asset {
                asset_id: id.to_string(),
                equip_id: equip,
                serial: opt(r.serial.clone()),
                name: opt(r.name.clone()),
                attrs: r.attrs.clone(),
                hours: r.hours,
                miles: r.miles,
                created_at: existing
                    .as_ref()
                    .map_or_else(|| now.clone(), |e| e.created_at.clone()),
                updated_at: now.clone(),
            };
            if existing.is_some() {
                report.updated += 1;
            } else {
                report.created += 1;
            }
            self.put_asset(&tx, &a)?;
            tx.execute(
                "DELETE FROM asset_event WHERE asset_id = ?1 AND source = 'import'",
                [id],
            )?;
            for e in &r.events {
                if day_number(&e.date).is_none() {
                    return Err(Error::Invalid(format!(
                        "asset {id}: event date {:?} is not YYYY-MM-DD",
                        e.date
                    )));
                }
                tx.execute(
                    "INSERT INTO asset_event (asset_id, date, system, symptom_id, tree_id, text, source)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'import')",
                    params![id, e.date, e.system, e.symptom_id, e.tree_id, e.text],
                )?;
                report.events += 1;
            }
        }
        let mut ev = AuditEvent::new("asset.import", ASSET_REGISTRY_FORMAT);
        ev.detail = serde_json::to_value(&report)?;
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        Ok(report)
    }

    fn asset_events(&self, asset_id: &str) -> Result<Vec<AssetEvent>> {
        Ok(self
            .conn
            .prepare(
                "SELECT asset_id, date, system, symptom_id, tree_id, text FROM asset_event
                 WHERE asset_id = ?1 ORDER BY date DESC, seq DESC",
            )?
            .query_map([asset_id], |r| {
                Ok(AssetEvent {
                    asset_id: r.get(0)?,
                    date: r.get(1)?,
                    system: r.get(2)?,
                    symptom_id: r.get(3)?,
                    tree_id: r.get(4)?,
                    text: r.get(5)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?)
    }

    // -------------------------------------------------------------- jobs

    /// Start a job. The tree, entry node and how it was entered come from
    /// the symptom, the signals or the chosen tree.
    pub fn start_job(&self, pack: &Pack, req: &JobStart) -> Result<Job> {
        let asset = match opt(req.asset_id.clone()) {
            Some(id) => Some(
                self.asset(&id)?
                    .ok_or_else(|| Error::Invalid(format!("no asset {id:?}")))?,
            ),
            None => None,
        };
        let equip =
            opt(req.equip_id.clone()).or_else(|| asset.as_ref().and_then(|a| a.equip_id.clone()));
        Self::check_equip(Some(pack), equip.as_deref())?;
        let level = pack.level(req.level.trim())?;
        let mut tree_id = opt(req.tree_id.clone());
        let mut entry_node = opt(req.node_id.clone());
        let mut entered_by = EntryKind::Chosen;
        let symptom_id = opt(req.symptom_id.clone());
        if let Some(sid) = &symptom_id {
            let s = pack
                .symptoms(equip.as_deref())?
                .into_iter()
                .find(|s| &s.symptom_id == sid)
                .ok_or_else(|| Error::Invalid(format!("no symptom {sid:?} for this equipment")))?;
            if tree_id.as_ref().is_some_and(|t| t != &s.tree_id) {
                return Err(Error::Invalid(format!(
                    "symptom {sid} leads to tree {}, not {}",
                    s.tree_id,
                    tree_id.unwrap_or_default()
                )));
            }
            tree_id = Some(s.tree_id);
            entered_by = EntryKind::Symptom;
        }
        if !req.signals.is_empty() {
            let m = search::signal_match(pack, &req.signals, equip.as_deref())?;
            let hit = match &tree_id {
                Some(t) => m.hits.iter().find(|h| &h.rule.tree_id == t).map(|h| {
                    crate::maint::search::EntryPoint {
                        tree_id: h.rule.tree_id.clone(),
                        node_id: h.rule.node_id.clone().unwrap_or_default(),
                    }
                }),
                None => m.suggested.clone(),
            };
            match hit {
                Some(h) => {
                    if entry_node.is_none() && !h.node_id.is_empty() {
                        entry_node = Some(h.node_id);
                    }
                    tree_id = Some(h.tree_id);
                    if entered_by == EntryKind::Chosen {
                        entered_by = EntryKind::Signals;
                    }
                }
                None if tree_id.is_none() => {
                    return Err(Error::Invalid(
                        "no signal rule matches these signals; pick a symptom or a tree".into(),
                    ));
                }
                None => {}
            }
        }
        let tree_id = tree_id
            .ok_or_else(|| Error::Invalid("a job needs a symptom, signals or a tree".into()))?;
        if !pack
            .fault_trees(equip.as_deref())?
            .iter()
            .any(|t| t.tree_id == tree_id)
        {
            return Err(Error::Invalid(format!(
                "tree {tree_id:?} does not exist or does not apply to {}",
                equip.as_deref().unwrap_or("this equipment")
            )));
        }
        let tree = pack
            .fault_tree(&tree_id)?
            .ok_or_else(|| Error::Invalid(format!("no tree {tree_id:?}")))?;
        let entry = entry_node.unwrap_or_else(|| tree.tree.entry_node.clone());
        if tree.node(&entry).is_none() {
            return Err(Error::Invalid(format!(
                "node {entry:?} is not in tree {tree_id}"
            )));
        }
        let job_id = new_id("job", &[pack.pack_id(), &tree_id]);
        let query = opt(req.query.clone());
        let detail =
            serde_json::to_string(&serde_json::json!({"query": query, "signals": req.signals}))?;
        let opened_at = now_rfc3339();
        let tx = self.write_tx()?;
        tx.execute(
            "INSERT INTO job (job_id, pack_id, pack_version, tree_id, tree_sha256, system, entry_node,
                              entered_by, symptom_id, entry_detail, asset_id, equip_id, level, status,
                              opened_at, current_node)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'open', ?14, ?7)",
            params![
                job_id,
                pack.pack_id(),
                pack.version(),
                tree_id,
                tree.sha256()?,
                tree.tree.system,
                entry,
                entered_by.as_str(),
                symptom_id,
                self.seal(&format!("job.entry_detail:{job_id}"), Some(&detail))?,
                asset.as_ref().map(|a| a.asset_id.clone()),
                equip,
                level.id,
                opened_at
            ],
        )?;
        let mut ev = AuditEvent::new("job.start", &job_id);
        ev.pack_id = Some(pack.pack_id().into());
        ev.pack_version = Some(pack.version().into());
        ev.node_id = Some(entry.clone());
        ev.asked = tree.node(&entry).map(|n| n.text.clone());
        ev.detail = serde_json::json!({
            "tree_id": tree_id, "entered_by": entered_by, "symptom_id": symptom_id,
            "signals": req.signals, "asset_id": asset.as_ref().map(|a| &a.asset_id), "equip_id": equip,
        });
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        self.job(&job_id)?
            .ok_or_else(|| Error::Invalid(format!("job {job_id} vanished")))
    }

    /// The tree a job is recorded against, refused when the pack changed it.
    fn tree_for(&self, job: &Job, pack: &Pack) -> Result<Tree> {
        if job.pack_id != pack.pack_id() {
            return Err(Error::Invalid(format!(
                "job {} belongs to pack {}, not {}",
                job.job_id,
                job.pack_id,
                pack.pack_id()
            )));
        }
        let (first, shas): (String, Option<String>) = self.conn.query_row(
            "SELECT tree_sha256, tree_shas FROM job WHERE job_id = ?1",
            [&job.job_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        let shas: BTreeMap<String, String> = shas
            .map(|s| serde_json::from_str(&s))
            .transpose()?
            .unwrap_or_default();
        let began = shas.get(&job.tree_id).cloned().unwrap_or(first);
        let tree = pack.fault_tree(&job.tree_id)?;
        match tree {
            Some(t) if t.sha256()? == began => Ok(t),
            _ => Err(Error::Invalid(format!(
                "tree {} changed in pack {} since job {} began on {}; close it or start a new job",
                job.tree_id,
                pack.version(),
                job.job_id,
                job.pack_version
            ))),
        }
    }

    fn open_job(&self, job_id: &str) -> Result<Job> {
        let job = self
            .job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("no job {job_id:?}")))?;
        if job.status != "open" {
            return Err(Error::Invalid(format!("job {job_id} is {}", job.status)));
        }
        Ok(job)
    }

    /// Record the result at the current node. Code chooses the branch; the
    /// job moves to its node. Returns the updated job.
    pub fn answer_job(&self, pack: &Pack, job_id: &str, ans: &JobAnswer) -> Result<Job> {
        for p in &ans.photos {
            super::check_photo(p)?;
        }
        let tx = self.write_tx()?;
        let job = self.open_job(job_id)?;
        let tree = self.tree_for(&job, pack)?;
        if ans.node_id != job.current_node {
            return Err(Error::Invalid(format!(
                "job {job_id} is at {}, not {}; reload it",
                job.current_node, ans.node_id
            )));
        }
        let node = tree
            .node(&job.current_node)
            .ok_or_else(|| Error::Pack(format!("node {} vanished", job.current_node)))?;
        let edges = tree.edges_from(&node.node_id);
        let result = ans.result();
        let edge = branch::choose(node, &edges, &result)?;
        let seq: i64 = tx.query_row(
            "SELECT COALESCE(MAX(seq), 0) + 1 FROM job_step WHERE job_id = ?1",
            [job_id],
            |r| r.get(0),
        )?;
        let outcome = result.outcome.as_deref().map(branch::fold);
        let at = now_rfc3339();
        let aad = |col: &str| format!("job_step.{col}:{job_id}#{seq}|{}|{at}", node.node_id);
        tx.execute(
            "INSERT INTO job_step (job_id, seq, node_id, outcome, value, unit, label, note, photos,
                                   next_node, at, tree_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                job_id,
                seq,
                node.node_id,
                outcome,
                result.value,
                result.unit,
                edge.label,
                self.seal(&aad("note"), opt(ans.note.clone()).as_deref())?,
                self.seal(&aad("photos"), Some(&serde_json::to_string(&ans.photos)?))?,
                edge.to_node,
                at,
                job.tree_id
            ],
        )?;
        tx.execute(
            "UPDATE job SET current_node = ?2 WHERE job_id = ?1",
            params![job_id, edge.to_node],
        )?;
        let mut ev = AuditEvent::new("job.answer", job_id);
        ev.pack_id = Some(job.pack_id.clone());
        ev.pack_version = Some(pack.version().into());
        ev.node_id = Some(node.node_id.clone());
        ev.asked = Some(node.text.clone());
        ev.result = Some(serde_json::json!({
            "outcome": outcome, "value": result.value, "unit": result.unit, "label": edge.label,
        }));
        ev.next_node = Some(edge.to_node.clone());
        ev.detail = serde_json::json!({"seq": seq, "retry": edge.retry});
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        self.job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("job {job_id} vanished")))
    }

    /// At a `goto` into another tree: continue there (its entry, or the
    /// node the manual names), keeping the path. The jump is a step of its
    /// own (outcome `goto`), so going back returns to the goto node. The new
    /// tree is held to its state at the jump, like the first.
    pub fn follow_job(&self, pack: &Pack, job_id: &str) -> Result<Job> {
        let tx = self.write_tx()?;
        let job = self.open_job(job_id)?;
        let tree = self.tree_for(&job, pack)?;
        let node = tree
            .node(&job.current_node)
            .ok_or_else(|| Error::Pack(format!("node {} vanished", job.current_node)))?;
        let Some(crate::maint::Target::Tree {
            id: to_tree,
            node_id,
        }) = &node.target
        else {
            return Err(Error::Invalid(format!(
                "node {} does not lead into another tree",
                node.node_id
            )));
        };
        if !pack
            .fault_trees(job.equip_id.as_deref())?
            .iter()
            .any(|t| &t.tree_id == to_tree)
        {
            return Err(Error::Invalid(format!(
                "tree {to_tree} does not apply to {}",
                job.equip_id.as_deref().unwrap_or("this equipment")
            )));
        }
        let next = pack
            .fault_tree(to_tree)?
            .ok_or_else(|| Error::Invalid(format!("no tree {to_tree:?}")))?;
        let entry = node_id
            .clone()
            .unwrap_or_else(|| next.tree.entry_node.clone());
        if next.node(&entry).is_none() {
            return Err(Error::Pack(format!(
                "node {entry} is not in tree {to_tree}"
            )));
        }
        let seq: i64 = tx.query_row(
            "SELECT COALESCE(MAX(seq), 0) + 1 FROM job_step WHERE job_id = ?1",
            [job_id],
            |r| r.get(0),
        )?;
        let at = now_rfc3339();
        let aad = |col: &str| format!("job_step.{col}:{job_id}#{seq}|{}|{at}", node.node_id);
        let label = format!("Go to {}", next.tree.title);
        tx.execute(
            "INSERT INTO job_step (job_id, seq, node_id, outcome, value, unit, label, note, photos,
                                   next_node, at, tree_id)
             VALUES (?1, ?2, ?3, 'goto', NULL, NULL, ?4, NULL, ?5, ?6, ?7, ?8)",
            params![
                job_id,
                seq,
                node.node_id,
                label,
                self.seal(&aad("photos"), Some("[]"))?,
                entry,
                at,
                job.tree_id
            ],
        )?;
        let shas: Option<String> = tx.query_row(
            "SELECT tree_shas FROM job WHERE job_id = ?1",
            [job_id],
            |r| r.get(0),
        )?;
        let mut shas: BTreeMap<String, String> = shas
            .map(|s| serde_json::from_str(&s))
            .transpose()?
            .unwrap_or_default();
        shas.entry(job.tree_id.clone()).or_insert(tree.sha256()?);
        shas.entry(to_tree.clone()).or_insert(next.sha256()?);
        tx.execute(
            "UPDATE job SET tree_id = ?2, current_node = ?3, tree_shas = ?4 WHERE job_id = ?1",
            params![job_id, to_tree, entry, serde_json::to_string(&shas)?],
        )?;
        let mut ev = AuditEvent::new("job.goto", job_id);
        ev.pack_id = Some(job.pack_id.clone());
        ev.pack_version = Some(pack.version().into());
        ev.node_id = Some(node.node_id.clone());
        ev.asked = Some(node.text.clone());
        ev.next_node = Some(entry.clone());
        ev.detail = serde_json::json!({"from_tree": job.tree_id, "to_tree": to_tree, "seq": seq});
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        self.job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("job {job_id} vanished")))
    }

    /// Go back over the last answer: it is kept, marked superseded, audited,
    /// and the job returns to its node to be answered again.
    pub fn back_job(&self, pack: &Pack, job_id: &str) -> Result<Job> {
        let tx = self.write_tx()?;
        let job = self.open_job(job_id)?;
        let tree = self.tree_for(&job, pack)?;
        let Some(last) = job.path().last().map(|s| (*s).clone()) else {
            return Err(Error::Invalid(format!(
                "job {job_id} has no answer to go back over"
            )));
        };
        let at = now_rfc3339();
        tx.execute(
            "UPDATE job_step SET superseded_at = ?3 WHERE job_id = ?1 AND seq = ?2",
            params![job_id, last.seq, at],
        )?;
        tx.execute(
            "UPDATE job SET current_node = ?2, tree_id = ?3 WHERE job_id = ?1",
            params![job_id, last.node_id, last.tree_id],
        )?;
        let tree = if last.tree_id == tree.tree.tree_id {
            tree
        } else {
            pack.fault_tree(&last.tree_id)?
                .ok_or_else(|| Error::Invalid(format!("tree {} vanished", last.tree_id)))?
        };
        let mut ev = AuditEvent::new("job.back", job_id);
        ev.pack_id = Some(job.pack_id.clone());
        ev.pack_version = Some(pack.version().into());
        ev.node_id = Some(last.node_id.clone());
        ev.asked = tree.node(&last.node_id).map(|n| n.text.clone());
        ev.result = Some(serde_json::json!({
            "superseded_seq": last.seq, "outcome": last.outcome, "value": last.value, "unit": last.unit,
            "label": last.label,
        }));
        ev.next_node = Some(last.node_id.clone());
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        self.job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("job {job_id} vanished")))
    }

    /// Close a job: its report is queued (`job`, `harvest-job/1`), the
    /// lesson (when given) is captured, and the close is audited.
    pub fn close_job(
        &self,
        pack: &Pack,
        job_id: &str,
        close: &JobClose,
    ) -> Result<(Job, Option<Lesson>)> {
        let tx = self.write_tx()?;
        let mut job = self.open_job(job_id)?;
        let resolution = Resolution {
            kind: close.resolution,
            node_id: job.current_node.clone(),
            note: opt(close.note.clone()),
        };
        let closed_at = now_rfc3339();
        tx.execute(
            "UPDATE job SET status = 'closed', closed_at = ?2, resolution = ?3 WHERE job_id = ?1",
            params![
                job_id,
                closed_at,
                self.seal(
                    &format!("job.resolution:{job_id}"),
                    Some(&serde_json::to_string(&resolution)?)
                )?
            ],
        )?;
        let lesson = match &close.lesson {
            Some(l) => {
                let mut l = l.clone();
                l.job_id = Some(job_id.to_string());
                Some(self.insert_lesson(&tx, Some(pack), &job_or_none(&job), l)?)
            }
            None => None,
        };
        job.status = "closed".into();
        job.closed_at = Some(closed_at);
        job.resolution = Some(resolution.clone());
        let report = self.job_report_with(&job, Some(pack), &tx)?;
        sync::enqueue_ref(
            &tx,
            self.key(),
            "job",
            Some(job_id),
            &serde_json::to_value(&report)?,
        )?;
        let mut ev = AuditEvent::new("job.close", job_id);
        ev.pack_id = Some(job.pack_id.clone());
        ev.pack_version = Some(pack.version().into());
        ev.node_id = Some(job.current_node.clone());
        ev.result = Some(serde_json::to_value(&resolution)?);
        ev.detail = serde_json::json!({"lesson_id": lesson.as_ref().map(|l| &l.lesson_id)});
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        Ok((job, lesson))
    }

    /// A job with its steps.
    pub fn job(&self, job_id: &str) -> Result<Option<Job>> {
        type J = (
            String,
            String,
            String,
            String,
            Option<String>,
            String,
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
            String,
            String,
            Option<String>,
            String,
            Option<String>,
        );
        let row: Option<J> = self
            .conn
            .query_row(
                "SELECT job_id, pack_id, pack_version, tree_id, system, entry_node, entered_by, symptom_id,
                        entry_detail, asset_id, equip_id, level, status, opened_at, closed_at,
                        current_node, resolution
                 FROM job WHERE job_id = ?1",
                [job_id],
                |r| {
                    Ok((
                        r.get(0)?,
                        r.get(1)?,
                        r.get(2)?,
                        r.get(3)?,
                        r.get(4)?,
                        r.get(5)?,
                        r.get(6)?,
                        r.get(7)?,
                        r.get(8)?,
                        r.get(9)?,
                        r.get(10)?,
                        r.get(11)?,
                        r.get(12)?,
                        r.get(13)?,
                        r.get(14)?,
                        r.get(15)?,
                        r.get(16)?,
                    ))
                },
            )
            .optional()?;
        let Some((
            job_id,
            pack_id,
            pack_version,
            tree_id,
            system,
            entry_node,
            entered_by,
            symptom_id,
            detail,
            asset_id,
            equip_id,
            level,
            status,
            opened_at,
            closed_at,
            current_node,
            resolution,
        )) = row
        else {
            return Ok(None);
        };
        let detail: Value = match self.unseal(&format!("job.entry_detail:{job_id}"), detail)? {
            Some(d) => serde_json::from_str(&d)?,
            None => Value::Null,
        };
        let resolution: Option<Resolution> = self
            .unseal(&format!("job.resolution:{job_id}"), resolution)?
            .map(|r| serde_json::from_str(&r))
            .transpose()?;
        type S = (
            i64,
            String,
            Option<String>,
            Option<f64>,
            Option<String>,
            String,
            Option<String>,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
        );
        let rows: Vec<S> = self
            .conn
            .prepare_cached(
                "SELECT seq, node_id, outcome, value, unit, label, note, photos, next_node, at, superseded_at,
                        tree_id
                 FROM job_step WHERE job_id = ?1 ORDER BY seq",
            )?
            .query_map([&job_id], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                    r.get(9)?,
                    r.get(10)?,
                    r.get(11)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;
        let mut steps = Vec::new();
        for (
            seq,
            node_id,
            outcome,
            value,
            unit,
            label,
            note,
            photos,
            next_node,
            at,
            superseded_at,
            step_tree,
        ) in rows
        {
            let aad = |col: &str| format!("job_step.{col}:{job_id}#{seq}|{node_id}|{at}");
            steps.push(JobStep {
                note: self.unseal(&aad("note"), note)?,
                photos: serde_json::from_str(
                    &self
                        .unseal(&aad("photos"), Some(photos))?
                        .unwrap_or_default(),
                )?,
                seq,
                node_id,
                outcome,
                value,
                unit,
                label,
                next_node,
                at,
                superseded_at,
                // Steps recorded before trees could change are the job's tree's.
                tree_id: step_tree.unwrap_or_else(|| tree_id.clone()),
            });
        }
        Ok(Some(Job {
            query: detail
                .get("query")
                .and_then(Value::as_str)
                .map(str::to_string),
            signals: detail
                .get("signals")
                .cloned()
                .map(serde_json::from_value)
                .transpose()?
                .unwrap_or_default(),
            entered_by: EntryKind::parse(&entered_by)?,
            job_id,
            pack_id,
            pack_version,
            tree_id,
            system,
            entry_node,
            symptom_id,
            asset_id,
            equip_id,
            level,
            status,
            opened_at,
            closed_at,
            current_node,
            resolution,
            steps,
        }))
    }

    /// Jobs, newest first, optionally for one asset and/or status.
    pub fn jobs(&self, asset_id: Option<&str>, status: Option<&str>) -> Result<Vec<JobSummary>> {
        let ids: Vec<String> = self
            .conn
            .prepare(
                "SELECT job_id FROM job WHERE (?1 IS NULL OR asset_id = ?1) AND (?2 IS NULL OR status = ?2)
                 ORDER BY opened_at DESC, job_id DESC",
            )?
            .query_map(params![asset_id, status], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        ids.iter()
            .filter_map(|id| self.job(id).transpose())
            .map(|j| j.map(|j| summary(&j)))
            .collect()
    }

    /// The job and the screen for its current node, at `level` (the job's
    /// own level when `None`).
    pub fn job_view(&self, pack: &Pack, job_id: &str, level: Option<&str>) -> Result<JobView> {
        let job = self
            .job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("no job {job_id:?}")))?;
        let repeat = self.repeat_for(pack, &job)?;
        let lesson_ids = self.lesson_ids_for_job(job_id)?;
        let tree = match self.tree_for(&job, pack) {
            Ok(t) => t,
            Err(Error::Invalid(_)) => {
                return Ok(JobView {
                    job,
                    step: None,
                    tree_changed: true,
                    repeat,
                    lesson_ids,
                });
            }
            Err(e) => return Err(e),
        };
        let lvl = match level {
            Some(l) => pack.level(l)?,
            None => pack.level(&job.level).or_else(|_| {
                pack.levels()?
                    .into_iter()
                    .next()
                    .ok_or_else(|| Error::Pack("the pack declares no levels".into()))
            })?,
        };
        let path_ids: Vec<String> = job.path().iter().map(|s| s.node_id.clone()).collect();
        let node = view::node_view(
            pack,
            &tree,
            &job.current_node,
            &lvl,
            job.equip_id.as_deref(),
            &path_ids,
        )?;
        let texts = step_texts(pack, &tree, &job.steps);
        let path = job
            .path()
            .iter()
            .map(|s| PathEntry {
                seq: s.seq,
                node_id: s.node_id.clone(),
                text: texts.get(&s.seq).cloned(),
                outcome: s.outcome.clone(),
                value: s.value,
                unit: s.unit.clone(),
                label: s.label.clone(),
                next_node: s.next_node.clone(),
                at: s.at.clone(),
            })
            .collect();
        let field_notes = self.field_notes_for(
            pack,
            job.equip_id.as_deref(),
            Some(&job.tree_id),
            Some(&job.current_node),
            job.symptom_id.as_deref(),
        )?;
        Ok(JobView {
            step: Some(StepView {
                node,
                path,
                field_notes,
            }),
            job,
            tree_changed: false,
            repeat,
            lesson_ids,
        })
    }

    /// The job report (`harvest-job/1`).
    pub fn job_report(&self, pack: &Pack, job_id: &str) -> Result<JobReport> {
        let job = self
            .job(job_id)?
            .ok_or_else(|| Error::Invalid(format!("no job {job_id:?}")))?;
        self.job_report_with(&job, Some(pack), &self.conn)
    }

    fn job_report_with(
        &self,
        job: &Job,
        pack: Option<&Pack>,
        conn: &Connection,
    ) -> Result<JobReport> {
        let tree = pack.and_then(|p| self.tree_for(job, p).ok());
        let serial = match &job.asset_id {
            Some(a) => conn
                .query_row("SELECT serial FROM asset WHERE asset_id = ?1", [a], |r| {
                    r.get(0)
                })
                .optional()?
                .flatten(),
            None => None,
        };
        let lesson_ids: Vec<String> = conn
            .prepare("SELECT lesson_id FROM lesson WHERE job_id = ?1 ORDER BY created_at")?
            .query_map([&job.job_id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(JobReport {
            format: JOB_REPORT_FORMAT.into(),
            pack_id: job.pack_id.clone(),
            pack_version: job.pack_version.clone(),
            job_id: job.job_id.clone(),
            tree_id: job.tree_id.clone(),
            tree_title: tree.as_ref().map(|t| t.tree.title.clone()),
            system: job.system.clone(),
            entered_by: job.entered_by,
            entry_node: job.entry_node.clone(),
            symptom_id: job.symptom_id.clone(),
            query: job.query.clone(),
            signals: job.signals.clone(),
            asset_id: job.asset_id.clone(),
            serial,
            equip_id: job.equip_id.clone(),
            level: job.level.clone(),
            status: job.status.clone(),
            opened_at: job.opened_at.clone(),
            closed_at: job.closed_at.clone(),
            resolution: job.resolution.clone(),
            tree_known: tree.is_some(),
            steps: {
                let texts = match (pack, &tree) {
                    (Some(p), Some(t)) => step_texts(p, t, &job.steps),
                    _ => BTreeMap::new(),
                };
                job.steps
                    .iter()
                    .map(|s| ReportJobStep {
                        text: texts.get(&s.seq).cloned(),
                        step: s.clone(),
                    })
                    .collect()
            },
            lesson_ids,
        })
    }

    // ------------------------------------------------- history and repeat

    /// The repeat flag for a job: earlier jobs and registry events on the
    /// same asset with the same symptom or system within the window.
    pub fn repeat_for(&self, pack: &Pack, job: &Job) -> Result<RepeatFlag> {
        let window = pack.repeat_window_days();
        let mut flag = RepeatFlag {
            flag: false,
            window_days: window,
            matches: Vec::new(),
        };
        let Some(asset) = &job.asset_id else {
            return Ok(flag);
        };
        let Some(at) = day_number(&job.opened_at) else {
            return Ok(flag);
        };
        let reason = |sym: &Option<String>, sys: &Option<String>| -> Option<&'static str> {
            if job.symptom_id.is_some() && sym == &job.symptom_id {
                Some("same_symptom")
            } else if job.system.is_some() && sys == &job.system {
                Some("same_system")
            } else {
                None
            }
        };
        let priors: Vec<(String, String, Option<String>, Option<String>)> = self
            .conn
            .prepare(
                "SELECT job_id, opened_at, symptom_id, system FROM job
                 WHERE asset_id = ?1 AND job_id != ?2 AND opened_at <= ?3
                 ORDER BY opened_at DESC",
            )?
            .query_map(params![asset, job.job_id, job.opened_at], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))
            })?
            .collect::<rusqlite::Result<_>>()?;
        for (id, opened, sym, sys) in priors {
            let Some(d) = day_number(&opened) else {
                continue;
            };
            let days = at - d;
            if (0..=window).contains(&days)
                && let Some(r) = reason(&sym, &sys)
            {
                flag.matches.push(RepeatMatch {
                    kind: "job".into(),
                    job_id: Some(id),
                    date: opened,
                    symptom_id: sym,
                    system: sys,
                    reason: r.into(),
                    days_before: days,
                });
            }
        }
        for e in self.asset_events(asset)? {
            let Some(d) = day_number(&e.date) else {
                continue;
            };
            let days = at - d;
            if (0..=window).contains(&days)
                && let Some(r) = reason(&e.symptom_id, &e.system)
            {
                flag.matches.push(RepeatMatch {
                    kind: "event".into(),
                    job_id: None,
                    date: e.date,
                    symptom_id: e.symptom_id,
                    system: e.system,
                    reason: r.into(),
                    days_before: days,
                });
            }
        }
        flag.matches.sort_by_key(|m| m.days_before);
        flag.flag = !flag.matches.is_empty();
        Ok(flag)
    }

    /// An asset's history.
    pub fn asset_history(&self, pack: &Pack, asset_id: &str) -> Result<AssetHistory> {
        let asset = self
            .asset(asset_id)?
            .ok_or_else(|| Error::Invalid(format!("no asset {asset_id:?}")))?;
        let mut jobs = Vec::new();
        for mut s in self.jobs(Some(asset_id), None)? {
            if s.pack_id == pack.pack_id() {
                s.tree_title = pack
                    .fault_trees(None)?
                    .into_iter()
                    .find(|t| t.tree_id == s.tree_id)
                    .map(|t| t.title);
            }
            let job = self
                .job(&s.job_id)?
                .ok_or_else(|| Error::Invalid(format!("job {} vanished", s.job_id)))?;
            jobs.push(HistoryJob {
                repeat: self.repeat_for(pack, &job)?,
                job: s,
            });
        }
        let equip = asset.equip_id.as_deref();
        Ok(AssetHistory {
            repeat: jobs.first().is_some_and(|j| j.repeat.flag),
            events: self.asset_events(asset_id)?,
            fleet_history: pack.history_for(equip)?,
            failure_modes: pack.failure_modes_for(equip)?,
            jobs,
            asset,
        })
    }

    // ----------------------------------------------------------- lessons

    /// Capture a lesson; queued for upload unless `submit` is false.
    pub fn create_lesson(&self, pack: Option<&Pack>, input: LessonInput) -> Result<Lesson> {
        let job = match input.job_id.as_deref() {
            Some(id) => Some(
                self.job(id)?
                    .ok_or_else(|| Error::Invalid(format!("no job {id:?}")))?,
            ),
            None => None,
        };
        let tx = self.write_tx()?;
        let l = self.insert_lesson(&tx, pack, &job, input)?;
        tx.commit()?;
        Ok(l)
    }

    fn insert_lesson(
        &self,
        tx: &Connection,
        pack: Option<&Pack>,
        job: &Option<Job>,
        input: LessonInput,
    ) -> Result<Lesson> {
        let cause = input.cause.trim().to_string();
        let action = input.action.trim().to_string();
        if cause.is_empty() || action.is_empty() {
            return Err(Error::Invalid(
                "a lesson needs the verified cause and the corrective action".into(),
            ));
        }
        for p in &input.photos {
            super::check_photo(p)?;
        }
        let level = opt(input.level.clone()).or_else(|| job.as_ref().map(|j| j.level.clone()));
        if let (Some(p), Some(l)) = (pack, &level) {
            p.level(l)?;
        }
        let equip = opt(input.equip_id).or_else(|| job.as_ref().and_then(|j| j.equip_id.clone()));
        Self::check_equip(pack, equip.as_deref())?;
        let now = now_rfc3339();
        let lesson_id = match opt(input.lesson_id.clone()) {
            Some(id) if valid_id(&id) && id.starts_with("lesson-") => id,
            Some(id) => return Err(Error::Invalid(format!("lesson id {id:?}"))),
            None => new_id("lesson", &[&cause, &action]),
        };
        let exists: bool = tx.query_row(
            "SELECT EXISTS (SELECT 1 FROM lesson WHERE lesson_id = ?1)",
            [&lesson_id],
            |r| r.get(0),
        )?;
        if exists {
            return Err(Error::Invalid(format!(
                "lesson {lesson_id} exists; update it"
            )));
        }
        let l = Lesson {
            lesson_id: lesson_id.clone(),
            pack_id: pack
                .map(|p| p.pack_id().to_string())
                .or_else(|| job.as_ref().map(|j| j.pack_id.clone())),
            pack_version: pack.map(|p| p.version().to_string()),
            job_id: job.as_ref().map(|j| j.job_id.clone()),
            asset_id: opt(input.asset_id).or_else(|| job.as_ref().and_then(|j| j.asset_id.clone())),
            equip_id: equip,
            tree_id: opt(input.tree_id).or_else(|| job.as_ref().map(|j| j.tree_id.clone())),
            symptom_id: opt(input.symptom_id)
                .or_else(|| job.as_ref().and_then(|j| j.symptom_id.clone())),
            node_id: opt(input.node_id).or_else(|| job.as_ref().map(|j| j.current_node.clone())),
            cause,
            action,
            parts: input.parts,
            minutes: input.minutes,
            note: opt(input.note),
            photos: input.photos,
            level,
            status: if input.submit {
                LessonStatus::Queued
            } else {
                LessonStatus::Local
            },
            review_note: None,
            created_at: now.clone(),
            updated_at: now,
        };
        let aad = |col: &str| format!("lesson.{col}:{lesson_id}");
        tx.execute(
            "INSERT INTO lesson (lesson_id, pack_id, pack_version, job_id, asset_id, equip_id, tree_id,
                                 symptom_id, node_id, cause, action, parts, minutes, note, photos, level,
                                 status, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?18)",
            params![
                l.lesson_id,
                l.pack_id,
                l.pack_version,
                l.job_id,
                l.asset_id,
                l.equip_id,
                l.tree_id,
                l.symptom_id,
                l.node_id,
                self.seal(&aad("cause"), Some(&l.cause))?,
                self.seal(&aad("action"), Some(&l.action))?,
                self.seal(&aad("parts"), Some(&serde_json::to_string(&l.parts)?))?,
                l.minutes,
                self.seal(&aad("note"), l.note.as_deref())?,
                self.seal(&aad("photos"), Some(&serde_json::to_string(&l.photos)?))?,
                l.level,
                if input.submit { "queued" } else { "local" },
                l.created_at
            ],
        )?;
        if input.submit {
            let mut payload = serde_json::to_value(&l)?;
            payload["format"] = Value::String(LESSON_FORMAT.into());
            sync::enqueue_ref(tx, self.key(), "lesson", Some(&l.lesson_id), &payload)?;
        }
        let mut ev = AuditEvent::new("lesson.create", &l.lesson_id);
        ev.pack_id = l.pack_id.clone();
        ev.pack_version = l.pack_version.clone();
        ev.node_id = l.node_id.clone();
        ev.detail = serde_json::json!({"job_id": l.job_id, "submit": input.submit});
        self.audit_event(tx, &ev)?;
        Ok(l)
    }

    fn lesson_ids_for_job(&self, job_id: &str) -> Result<Vec<String>> {
        Ok(self
            .conn
            .prepare("SELECT lesson_id FROM lesson WHERE job_id = ?1 ORDER BY created_at")?
            .query_map([job_id], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?)
    }

    /// Lessons, newest first. A queued lesson whose upload was acknowledged
    /// reads as `uploaded`.
    pub fn lessons(&self, f: &LessonFilter) -> Result<Vec<Lesson>> {
        type L = (
            String,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
            String,
            String,
            Option<u32>,
            Option<String>,
            String,
            Option<String>,
            String,
            Option<String>,
            String,
            String,
            bool,
        );
        let rows: Vec<L> = self
            .conn
            .prepare(
                "SELECT l.lesson_id, l.pack_id, l.pack_version, l.job_id, l.asset_id, l.equip_id, l.tree_id,
                        l.symptom_id, l.node_id, l.cause, l.action, l.parts, l.minutes, l.note, l.photos,
                        l.level, l.status, l.review_note, l.created_at, l.updated_at,
                        EXISTS (SELECT 1 FROM outbox o WHERE o.kind = 'lesson' AND o.ref = l.lesson_id
                                AND o.acked_at IS NOT NULL)
                 FROM lesson l
                 WHERE (?1 IS NULL OR l.job_id = ?1) AND (?2 IS NULL OR l.asset_id = ?2)
                   AND (?3 IS NULL OR l.tree_id = ?3)
                 ORDER BY l.created_at DESC, l.lesson_id",
            )?
            .query_map(params![f.job_id, f.asset_id, f.tree_id], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                    r.get(9)?,
                    r.get(10)?,
                    r.get(11)?,
                    r.get(12)?,
                    r.get(13)?,
                    r.get(14)?,
                    r.get(15)?,
                    r.get(16)?,
                    r.get(17)?,
                    r.get(18)?,
                    r.get(19)?,
                    r.get(20)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;
        rows.into_iter()
            .map(|r| {
                let id = r.0.clone();
                let aad = |col: &str| format!("lesson.{col}:{id}");
                let status = match (r.16.as_str(), r.20) {
                    ("queued", true) => LessonStatus::Uploaded,
                    ("queued", false) => LessonStatus::Queued,
                    ("local", _) => LessonStatus::Local,
                    ("approved", _) => LessonStatus::Approved,
                    ("edited", _) => LessonStatus::Edited,
                    ("rejected", _) => LessonStatus::Rejected,
                    (o, _) => return Err(Error::Invalid(format!("lesson {id}: status {o:?}"))),
                };
                Ok(Lesson {
                    cause: self.unseal(&aad("cause"), Some(r.9))?.unwrap_or_default(),
                    action: self.unseal(&aad("action"), Some(r.10))?.unwrap_or_default(),
                    parts: serde_json::from_str(
                        &self.unseal(&aad("parts"), Some(r.11))?.unwrap_or_default(),
                    )?,
                    note: self.unseal(&aad("note"), r.13)?,
                    photos: serde_json::from_str(
                        &self.unseal(&aad("photos"), Some(r.14))?.unwrap_or_default(),
                    )?,
                    lesson_id: r.0,
                    pack_id: r.1,
                    pack_version: r.2,
                    job_id: r.3,
                    asset_id: r.4,
                    equip_id: r.5,
                    tree_id: r.6,
                    symptom_id: r.7,
                    node_id: r.8,
                    minutes: r.12,
                    level: r.15,
                    status,
                    review_note: r.17,
                    created_at: r.18,
                    updated_at: r.19,
                })
            })
            .collect()
    }

    // ------------------------------------------------------- field notes

    /// Verify and install a field-note bundle. Refused unless its signature
    /// verifies against a trusted key, its format is `harvest-field/1`, and
    /// its `seq` is newer than the stream's installed one.
    pub fn install_field_bundle(
        &self,
        bundle: &Value,
        keys: &[TrustedKey],
    ) -> Result<FieldInstall> {
        crate::packs::verify_signature(bundle, keys)?;
        let b: FieldBundle = serde_json::from_value(bundle.clone())
            .map_err(|e| Error::Invalid(format!("field bundle: {e}")))?;
        if b.format != FIELD_FORMAT {
            return Err(Error::Invalid(format!(
                "field bundle format {:?}, expected {FIELD_FORMAT}",
                b.format
            )));
        }
        if !valid_id(&b.stream) {
            return Err(Error::Invalid(format!(
                "field bundle stream {:?}",
                b.stream
            )));
        }
        let key_id = b
            .signature
            .get("key_id")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        for n in &b.notes {
            if n.note_id.trim().is_empty() || n.note_id.len() > 128 {
                return Err(Error::Invalid("a field note needs a note_id".into()));
            }
            if n.scope.is_empty() {
                return Err(Error::Invalid(format!(
                    "field note {}: empty scope",
                    n.note_id
                )));
            }
            if n.text.trim().is_empty() || n.approver.trim().is_empty() {
                return Err(Error::Invalid(format!(
                    "field note {}: needs text and an approver",
                    n.note_id
                )));
            }
        }
        let tx = self.write_tx()?;
        let installed: Option<i64> = tx
            .query_row(
                "SELECT seq FROM field_stream WHERE stream = ?1",
                [&b.stream],
                |r| r.get(0),
            )
            .optional()?;
        if let Some(prev) = installed
            && (b.seq as i64) <= prev
        {
            return Err(Error::Invalid(format!(
                "field bundle {} seq {} is not newer than the installed seq {prev}",
                b.stream, b.seq
            )));
        }
        let now = now_rfc3339();
        let mut out = FieldInstall {
            stream: b.stream.clone(),
            seq: b.seq,
            installed: 0,
            superseded: 0,
            revoked: 0,
            reviews: 0,
        };
        for n in &b.notes {
            tx.execute(
                "INSERT INTO field_note (note_id, stream, seq, pack_id, equip_id, tree_id, node_id, symptom_id,
                                         text, counts, approver, approved_at, supersedes, lang, active, received_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1, ?15)
                 ON CONFLICT (note_id) DO UPDATE SET stream = excluded.stream, seq = excluded.seq,
                   pack_id = excluded.pack_id, equip_id = excluded.equip_id, tree_id = excluded.tree_id,
                   node_id = excluded.node_id, symptom_id = excluded.symptom_id, text = excluded.text,
                   counts = excluded.counts, approver = excluded.approver,
                   approved_at = excluded.approved_at, supersedes = excluded.supersedes,
                   lang = excluded.lang, active = 1, received_at = excluded.received_at",
                params![
                    n.note_id,
                    b.stream,
                    b.seq as i64,
                    b.pack_id,
                    n.scope.equip_id,
                    n.scope.tree_id,
                    n.scope.node_id,
                    n.scope.symptom_id,
                    n.text,
                    serde_json::to_string(&n.counts)?,
                    n.approver,
                    n.approved_at,
                    n.supersedes,
                    n.lang,
                    now
                ],
            )?;
            out.installed += 1;
            if let Some(old) = &n.supersedes {
                out.superseded += tx.execute(
                    "UPDATE field_note SET active = 0 WHERE note_id = ?1 AND note_id != ?2",
                    params![old, n.note_id],
                )? as u64;
            }
        }
        for id in &b.revoke {
            out.revoked +=
                tx.execute("UPDATE field_note SET active = 0 WHERE note_id = ?1", [id])? as u64;
        }
        for r in &b.reviews {
            let status = match r.status {
                LessonStatus::Approved => "approved",
                LessonStatus::Edited => "edited",
                LessonStatus::Rejected => "rejected",
                other => {
                    return Err(Error::Invalid(format!(
                        "review of {}: {other:?} is not approved, edited or rejected",
                        r.lesson_id
                    )));
                }
            };
            out.reviews += tx.execute(
                "UPDATE lesson SET status = ?2, review_note = ?3, updated_at = ?4 WHERE lesson_id = ?1",
                params![r.lesson_id, status, r.note, now],
            )? as u64;
        }
        if let Some(f) = &b.fleet_sha256 {
            tx.execute(
                "INSERT INTO records_meta (key, value) VALUES ('fleet_announced', ?1)
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                [f],
            )?;
        }
        tx.execute(
            "INSERT INTO field_stream (stream, seq, key_id, installed_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (stream) DO UPDATE SET seq = excluded.seq, key_id = excluded.key_id,
               installed_at = excluded.installed_at",
            params![b.stream, b.seq as i64, key_id, now],
        )?;
        let mut ev = AuditEvent::new("field.install", &b.stream);
        ev.pack_id = b.pack_id.clone();
        ev.detail = serde_json::json!({
            "seq": b.seq, "key_id": key_id, "installed": out.installed, "superseded": out.superseded,
            "revoked": out.revoked, "reviews": out.reviews,
        });
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        Ok(out)
    }

    /// Active field notes whose every scope field matches the context.
    pub fn field_notes_for(
        &self,
        pack: &Pack,
        equip: Option<&str>,
        tree_id: Option<&str>,
        node_id: Option<&str>,
        symptom_id: Option<&str>,
    ) -> Result<Vec<FieldNote>> {
        let all = self.field_notes()?;
        Ok(all
            .into_iter()
            .filter(|n| {
                let s = &n.scope;
                let equip_ok = s
                    .equip_id
                    .as_ref()
                    .is_none_or(|e| pack.applies(std::slice::from_ref(e), equip));
                let eq = |want: &Option<String>, have: Option<&str>| {
                    want.as_deref().is_none_or(|w| have == Some(w))
                };
                equip_ok
                    && eq(&s.tree_id, tree_id)
                    && eq(&s.node_id, node_id)
                    && eq(&s.symptom_id, symptom_id)
            })
            .collect())
    }

    /// Every active field note.
    pub fn field_notes(&self) -> Result<Vec<FieldNote>> {
        type F = (
            String,
            String,
            i64,
            Option<String>,
            Option<String>,
            Option<String>,
            Option<String>,
            String,
            String,
            String,
            String,
            Option<String>,
            String,
        );
        let rows: Vec<F> = self
            .conn
            .prepare(
                "SELECT note_id, stream, seq, equip_id, tree_id, node_id, symptom_id, text, counts, approver,
                        approved_at, supersedes, received_at
                 FROM field_note WHERE active = 1 ORDER BY approved_at DESC, note_id",
            )?
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                    r.get(9)?,
                    r.get(10)?,
                    r.get(11)?,
                    r.get(12)?,
                ))
            })?
            .collect::<rusqlite::Result<_>>()?;
        rows.into_iter()
            .map(|r| {
                Ok(FieldNote {
                    note_id: r.0,
                    source: "field".into(),
                    stream: r.1,
                    seq: r.2 as u64,
                    scope: NoteScope {
                        equip_id: r.3,
                        tree_id: r.4,
                        node_id: r.5,
                        symptom_id: r.6,
                    },
                    text: r.7,
                    counts: serde_json::from_str(&r.8)?,
                    approver: r.9,
                    approved_at: r.10,
                    supersedes: r.11,
                    received_at: r.12,
                })
            })
            .collect()
    }
}

impl Records {
    /// The newest fleet summary this device verified.
    pub fn fleet_summary(&self) -> Result<Option<FleetSummary>> {
        let raw: Option<String> = self
            .conn
            .query_row(
                "SELECT value FROM records_meta WHERE key = 'fleet_summary'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        raw.map(|r| serde_json::from_str(&r).map_err(Error::from))
            .transpose()
    }

    /// Verify and keep a signed fleet summary (`harvest-fleet/1`): a
    /// trusted signature, and the summary hashing to the stated SHA-256.
    pub fn install_fleet(&self, doc: &Value, keys: &[TrustedKey]) -> Result<()> {
        crate::packs::verify_signature(doc, keys)?;
        if doc.get("format").and_then(Value::as_str) != Some(FLEET_FORMAT) {
            return Err(Error::Invalid("not a harvest-fleet/1 document".into()));
        }
        let summary: FleetSummary =
            serde_json::from_value(doc.get("summary").cloned().unwrap_or(Value::Null))
                .map_err(|e| Error::Invalid(format!("fleet summary: {e}")))?;
        let sha = fleet_sha256(&summary)?;
        if doc.get("sha256").and_then(Value::as_str) != Some(sha.as_str()) {
            return Err(Error::Integrity(
                "the fleet summary does not match its hash".into(),
            ));
        }
        let tx = self.write_tx()?;
        for (k, v) in [
            ("fleet_summary", serde_json::to_string(&summary)?),
            ("fleet_sha256", sha),
            ("fleet_fetched_at", now_rfc3339()),
        ] {
            tx.execute(
                "INSERT INTO records_meta (key, value) VALUES (?1, ?2)
                 ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                params![k, v],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// The highest bundle seq installed (across streams).
    pub fn installed_bundle_seq(&self) -> Result<u64> {
        let n: Option<i64> = self
            .conn
            .query_row("SELECT MAX(seq) FROM field_stream", [], |r| r.get(0))?;
        Ok(n.unwrap_or(0).max(0) as u64)
    }

    /// Fetch the bundles the hub published since the newest installed one
    /// and install them in order. The first refused bundle stops the pull
    /// (the next pull asks for it again); a link error is reported, never
    /// a partial install.
    pub fn pull(&self, link: &dyn crate::sync::HubLink, keys: &[TrustedKey]) -> Result<PullReport> {
        self.pull_with(link, keys, DEFAULT_FLEET_EVERY_HOURS)
    }

    /// [`Records::pull`], fetching a changed fleet summary at most every
    /// `fleet_every_hours` (it is the least urgent thing on the link).
    pub fn pull_with(
        &self,
        link: &dyn crate::sync::HubLink,
        keys: &[TrustedKey],
        fleet_every_hours: f64,
    ) -> Result<PullReport> {
        let mut report = PullReport::default();
        let since = self.installed_bundle_seq()?;
        let bundles = match link.bundles_since(since) {
            Ok(b) => b,
            Err(e) => {
                report.error = Some(e.to_string());
                return Ok(report);
            }
        };
        for b in bundles {
            report.bytes += serde_json::to_vec(&b)?.len() as u64;
            let seq = b.get("seq").and_then(Value::as_u64);
            if seq.is_some_and(|s| s <= self.installed_bundle_seq().unwrap_or(0)) {
                continue; // a duplicate delivery: already installed
            }
            match self.install_field_bundle(&b, keys) {
                Ok(r) => {
                    report.installed.push(r.seq);
                    report.notes += r.installed;
                }
                Err(e) => {
                    report.refused = Some(RefusedBundle {
                        seq,
                        error: e.to_string(),
                    });
                    break;
                }
            }
        }
        // Last and least: the fleet summary, only when the hub announced
        // one this device does not hold.
        let meta = |k: &str| -> Result<Option<String>> {
            Ok(self
                .conn
                .query_row("SELECT value FROM records_meta WHERE key = ?1", [k], |r| {
                    r.get(0)
                })
                .optional()?)
        };
        let announced = meta("fleet_announced")?;
        let due = match meta("fleet_fetched_at")? {
            None => true,
            Some(at) => {
                let now = crate::sim_clock_ms();
                parse_rfc3339_ms(&at)
                    .is_none_or(|t| (now - t) as f64 >= fleet_every_hours * 3_600_000.0)
            }
        };
        if report.refused.is_none()
            && due
            && announced.is_some()
            && announced != meta("fleet_sha256")?
        {
            match link.fleet() {
                Ok(Some(doc)) => {
                    report.fleet_bytes = serde_json::to_vec(&doc)?.len() as u64;
                    match self.install_fleet(&doc, keys) {
                        Ok(()) => report.fleet_updated = true,
                        Err(e) => report.error = Some(format!("fleet summary: {e}")),
                    }
                }
                Ok(None) => {}
                Err(e) => report.error = Some(e.to_string()),
            }
        }
        Ok(report)
    }

    /// Change a lesson that is still on the device or already sent: its
    /// content is replaced, a pending upload is withdrawn and the new
    /// version queued (the hub keeps every version).
    pub fn update_lesson(
        &self,
        pack: Option<&Pack>,
        lesson_id: &str,
        input: LessonInput,
    ) -> Result<Lesson> {
        let current = self
            .lessons(&LessonFilter::default())?
            .into_iter()
            .find(|l| l.lesson_id == lesson_id)
            .ok_or_else(|| Error::Invalid(format!("no lesson {lesson_id:?}")))?;
        let cause = input.cause.trim().to_string();
        let action = input.action.trim().to_string();
        if cause.is_empty() || action.is_empty() {
            return Err(Error::Invalid(
                "a lesson needs the verified cause and the corrective action".into(),
            ));
        }
        for p in &input.photos {
            super::check_photo(p)?;
        }
        let tx = self.write_tx()?;
        let now = now_rfc3339();
        let l = Lesson {
            cause,
            action,
            parts: input.parts,
            minutes: input.minutes.or(current.minutes),
            note: opt(input.note).or(current.note),
            photos: if input.photos.is_empty() {
                current.photos
            } else {
                input.photos
            },
            node_id: opt(input.node_id).or(current.node_id),
            status: if input.submit {
                LessonStatus::Queued
            } else {
                LessonStatus::Local
            },
            review_note: None,
            updated_at: now.clone(),
            pack_version: pack
                .map(|p| p.version().to_string())
                .or(current.pack_version),
            ..current
        };
        let aad = |col: &str| format!("lesson.{col}:{lesson_id}");
        tx.execute(
            "UPDATE lesson SET cause = ?2, action = ?3, parts = ?4, minutes = ?5, note = ?6, photos = ?7,
                    node_id = ?8, status = ?9, review_note = NULL, updated_at = ?10, pack_version = ?11
             WHERE lesson_id = ?1",
            params![
                lesson_id,
                self.seal(&aad("cause"), Some(&l.cause))?,
                self.seal(&aad("action"), Some(&l.action))?,
                self.seal(&aad("parts"), Some(&serde_json::to_string(&l.parts)?))?,
                l.minutes,
                self.seal(&aad("note"), l.note.as_deref())?,
                self.seal(&aad("photos"), Some(&serde_json::to_string(&l.photos)?))?,
                l.node_id,
                if input.submit { "queued" } else { "local" },
                now,
                l.pack_version
            ],
        )?;
        sync::supersede(&tx, "lesson", lesson_id)?;
        if input.submit {
            let mut payload = serde_json::to_value(&l)?;
            payload["format"] = Value::String(LESSON_FORMAT.into());
            sync::enqueue_ref(&tx, self.key(), "lesson", Some(lesson_id), &payload)?;
        }
        let mut ev = AuditEvent::new("lesson.update", lesson_id);
        ev.pack_id = l.pack_id.clone();
        ev.pack_version = l.pack_version.clone();
        ev.detail = serde_json::json!({"submit": input.submit});
        self.audit_event(&tx, &ev)?;
        tx.commit()?;
        Ok(l)
    }
}

/// Each step's node text, from the tree it was recorded in.
fn step_texts(pack: &Pack, current: &Tree, steps: &[JobStep]) -> BTreeMap<i64, String> {
    let mut trees: BTreeMap<String, Option<Tree>> = BTreeMap::new();
    trees.insert(current.tree.tree_id.clone(), Some(current.clone()));
    let mut out = BTreeMap::new();
    for s in steps {
        let t = trees
            .entry(s.tree_id.clone())
            .or_insert_with(|| pack.fault_tree(&s.tree_id).ok().flatten());
        if let Some(n) = t.as_ref().and_then(|t| t.node(&s.node_id)) {
            out.insert(s.seq, n.text.clone());
        }
    }
    out
}

fn job_or_none(job: &Job) -> Option<Job> {
    Some(job.clone())
}

fn summary(j: &Job) -> JobSummary {
    JobSummary {
        job_id: j.job_id.clone(),
        pack_id: j.pack_id.clone(),
        tree_id: j.tree_id.clone(),
        tree_title: None,
        symptom_id: j.symptom_id.clone(),
        system: j.system.clone(),
        asset_id: j.asset_id.clone(),
        equip_id: j.equip_id.clone(),
        status: j.status.clone(),
        opened_at: j.opened_at.clone(),
        closed_at: j.closed_at.clone(),
        current_node: j.current_node.clone(),
        resolution: j.resolution.as_ref().map(|r| r.kind),
    }
}

fn asset_row(r: &rusqlite::Row) -> rusqlite::Result<(Asset, String)> {
    Ok((
        Asset {
            asset_id: r.get(0)?,
            equip_id: r.get(1)?,
            serial: r.get(2)?,
            name: r.get(3)?,
            attrs: BTreeMap::new(),
            hours: r.get(5)?,
            miles: r.get(6)?,
            created_at: r.get(7)?,
            updated_at: r.get(8)?,
        },
        r.get(4)?,
    ))
}

fn finish_asset(mut a: Asset, attrs: &str) -> Result<Asset> {
    a.attrs = serde_json::from_str(attrs)?;
    Ok(a)
}

#[cfg(test)]
mod tests {
    #[test]
    fn days() {
        assert_eq!(super::day_number("1970-01-01"), Some(0));
        assert_eq!(super::day_number("2026-03-01T10:00:00.000Z"), Some(20_513));
        assert_eq!(
            super::day_number("2026-03-01").unwrap() - super::day_number("2026-01-30").unwrap(),
            30
        );
        assert_eq!(super::day_number("2026-13-01"), None);
    }
}
