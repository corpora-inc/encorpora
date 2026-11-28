//! The one JSON API the app calls: `call(host, method, params) -> result`.
//!
//! Every request and response is a typed struct here or in the modules it
//! draws on; [`schema`] derives a JSON Schema for each and emits the
//! TypeScript types the app compiles against (`harvest/api/`). Transports
//! (the local HTTP server in [`serve`], Tauri commands in the app) only
//! carry `(method, params)` in and the result out: no logic lives in them.

pub mod schema;
#[cfg(feature = "serve")]
pub mod serve;

use crate::answer::{AskOptions, AskResponse, Engine, Role};
use crate::audit::{AuditRecord, ChainReport};
use crate::content::PackInfo;
use crate::embed::Embedder;
use crate::error::{Error, Result};
use crate::llm::Llm;
use crate::maint::graph::{self, GraphReport};
use crate::maint::resolve::{self, Plate, Resolved};
use crate::maint::search::{self, Observation, SignalMatch, SymptomHit};
use crate::maint::view::{self, Citation, Guard, LevelText, TaskView};
use crate::maint::{FacetDef, FaultTree, Level, PackAsset, SectionLoc, SignalKind, Tree};
use crate::pack::{Equipment, Pack, Section};
use crate::packs::TrustedKey;
use crate::records::{
    self, Asset, AssetHistory, AssetInput, AssetRegistry, ImportReport, Job, JobAnswer, JobClose,
    JobReport, JobStart, JobSummary, JobView, Lesson, LessonFilter, LessonInput, Outcome, PhotoRef,
    Records, ResolutionKind, Run, RunReport, StartRun, StepInput, StepOutcome,
};
use crate::records::{FieldInstall, FieldNote};
use crate::retrieval::{SearchOptions, SearchResult};
use crate::sync::{FlushReport, OutboxStatus};
use schemars::JsonSchema;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

/// The API's version; bumped on any breaking change to a method.
pub const API_VERSION: &str = "harvest-api/1";

/// Everything the API serves from: verified packs, the device's records,
/// optional embedders (per pack), an optional model, the hub's trusted keys
/// for field-note bundles, and where `sync.flush` writes.
pub struct Host {
    packs: BTreeMap<String, Arc<Pack>>,
    records: Mutex<Records>,
    embedders: BTreeMap<String, Arc<dyn Embedder>>,
    llm: Option<Arc<dyn Llm>>,
    field_keys: Vec<TrustedKey>,
    outbox_dir: Option<PathBuf>,
}

impl Host {
    pub fn new(packs: Vec<Arc<Pack>>, records: Records) -> Self {
        Self {
            packs: packs
                .into_iter()
                .map(|p| (p.pack_id().to_string(), p))
                .collect(),
            records: Mutex::new(records),
            embedders: BTreeMap::new(),
            llm: None,
            field_keys: Vec::new(),
            outbox_dir: None,
        }
    }
    /// The embedder for one pack (dense retrieval runs only when it matches).
    pub fn with_embedder(mut self, pack_id: &str, e: Arc<dyn Embedder>) -> Self {
        self.embedders.insert(pack_id.to_string(), e);
        self
    }
    pub fn with_llm(mut self, llm: Arc<dyn Llm>) -> Self {
        self.llm = Some(llm);
        self
    }
    /// Keys a field-note bundle must be signed with.
    pub fn with_field_keys(mut self, keys: Vec<TrustedKey>) -> Self {
        self.field_keys = keys;
        self
    }
    /// The folder `sync.flush` writes the outbox into (a removable drive,
    /// a shared folder). Without it `sync.flush` is refused.
    pub fn with_outbox_dir(mut self, dir: PathBuf) -> Self {
        self.outbox_dir = Some(dir);
        self
    }

    pub fn packs(&self) -> impl Iterator<Item = &Arc<Pack>> {
        self.packs.values()
    }

    /// A pack by id, or the only one when `None`.
    pub fn pack(&self, id: Option<&str>) -> Result<&Arc<Pack>> {
        match id {
            Some(id) => self
                .packs
                .get(id)
                .ok_or_else(|| Error::Invalid(format!("no pack {id:?} is loaded"))),
            None if self.packs.len() == 1 => Ok(self.packs.values().next().expect("one pack")),
            None if self.packs.is_empty() => Err(Error::Invalid("no pack is loaded".into())),
            None => Err(Error::Invalid(format!(
                "more than one pack is loaded; name one with pack_id: {:?}",
                self.packs.keys().collect::<Vec<_>>()
            ))),
        }
    }

    fn records(&self) -> MutexGuard<'_, Records> {
        // A panic while writing rolls the transaction back; the store stays valid.
        self.records.lock().unwrap_or_else(|p| p.into_inner())
    }

    fn embedder(&self, pack: &Pack) -> Option<&dyn Embedder> {
        self.embedders.get(pack.pack_id()).map(|e| e.as_ref())
    }
}

/// An API error: a stable code and a message for the technician's screen.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq)]
pub struct ApiError {
    /// `bad_params` | `unknown_method` | `invalid` | `pack` | `signature` |
    /// `integrity` | `crypto` | `sync` | `internal`.
    pub code: String,
    pub message: String,
}

impl From<Error> for ApiError {
    fn from(e: Error) -> Self {
        let code = match &e {
            Error::Invalid(_) => "invalid",
            Error::Pack(_) => "pack",
            Error::Signature(_) => "signature",
            Error::Integrity(_) => "integrity",
            Error::Crypto(_) => "crypto",
            Error::Sync(_) => "sync",
            Error::Downgrade { .. } => "invalid",
            _ => "internal",
        };
        Self {
            code: code.into(),
            message: e.to_string(),
        }
    }
}

fn bad_params(method: &str, e: serde_json::Error) -> ApiError {
    ApiError {
        code: "bad_params".into(),
        message: format!("{method}: {e}"),
    }
}

fn parse<T: DeserializeOwned>(method: &str, params: Value) -> std::result::Result<T, ApiError> {
    let params = if params.is_null() {
        Value::Object(Default::default())
    } else {
        params
    };
    serde_json::from_value(params).map_err(|e| bad_params(method, e))
}

/// Call one method. `params` is the method's params object (`null` for
/// none); the result is its result object.
pub fn call(host: &Host, method: &str, params: Value) -> std::result::Result<Value, ApiError> {
    dispatch(host, method, params)
}

/// [`call`] over JSON text: always returns the envelope
/// `{"ok":true,"result":…}` or `{"ok":false,"error":{code,message}}`.
pub fn call_json(host: &Host, method: &str, params: &str) -> String {
    let params = if params.trim().is_empty() {
        Ok(Value::Null)
    } else {
        serde_json::from_str(params).map_err(|e| bad_params(method, e))
    };
    let out = params.and_then(|p| call(host, method, p));
    envelope(out).to_string()
}

/// The response envelope.
pub fn envelope(out: std::result::Result<Value, ApiError>) -> Value {
    match out {
        Ok(result) => serde_json::json!({"ok": true, "result": result}),
        Err(e) => serde_json::json!({"ok": false, "error": e}),
    }
}

macro_rules! methods {
    ($( $name:literal => $handler:ident($params:ty) -> $result:ty ),* $(,)?) => {
        fn dispatch(host: &Host, method: &str, params: Value) -> std::result::Result<Value, ApiError> {
            match method {
                $( $name => {
                    let p: $params = parse(method, params)?;
                    let r: $result = $handler(host, p)?;
                    serde_json::to_value(r).map_err(|e| ApiError::from(Error::from(e)))
                } )*
                other => Err(ApiError {
                    code: "unknown_method".into(),
                    message: format!("unknown method {other:?}"),
                }),
            }
        }

        /// Every method name, in declaration order.
        pub const METHODS: &[&str] = &[$($name),*];

        /// `(method, params schema, result schema)` for every method.
        pub(crate) fn method_schemas(
            params: &mut schemars::SchemaGenerator,
            results: &mut schemars::SchemaGenerator,
        ) -> Vec<(&'static str, schemars::Schema, schemars::Schema)> {
            vec![$( ($name, params.subschema_for::<$params>(), results.subschema_for::<$result>()) ),*]
        }
    };
}

methods! {
    "pack.info" => pack_info(PackParams) -> PackInfoView,
    "pack.validate" => pack_validate(PackParams) -> GraphReport,
    "equip.list" => equip_list(PackParams) -> Vec<EquipView>,
    "equip.resolve" => equip_resolve(EquipResolveParams) -> Resolved,
    "asset.list" => asset_list(NoParams) -> Vec<Asset>,
    "asset.get" => asset_get(AssetIdParams) -> Asset,
    "asset.create" => asset_create(AssetCreateParams) -> Asset,
    "asset.update" => asset_update(AssetUpdateParams) -> Asset,
    "asset.import" => asset_import(AssetImportParams) -> ImportReport,
    "asset.history" => asset_history(AssetHistoryParams) -> AssetHistory,
    "symptom.search" => symptom_search(SymptomSearchParams) -> SymptomSearch,
    "signal.match" => signal_match(SignalMatchParams) -> SignalMatch,
    "tree.list" => tree_list(TreeListParams) -> Vec<FaultTree>,
    "tree.get" => tree_get(TreeGetParams) -> Tree,
    "job.start" => job_start(JobStartParams) -> JobView,
    "job.get" => job_get(JobGetParams) -> JobView,
    "job.answer" => job_answer(JobAnswerParams) -> JobView,
    "job.back" => job_back(JobIdParams) -> JobView,
    "job.close" => job_close(JobCloseParams) -> JobClosed,
    "job.list" => job_list(JobListParams) -> Vec<JobSummary>,
    "job.report" => job_report(JobIdParams) -> JobReport,
    "task.list" => task_list(TaskListParams) -> Vec<TaskSummary>,
    "task.get" => task_get(TaskGetParams) -> TaskView,
    "run.start" => run_start(RunStartParams) -> Run,
    "run.record" => run_record(RunRecordParams) -> StepOutcome,
    "run.finish" => run_finish(RunIdParams) -> Run,
    "run.abandon" => run_abandon(RunIdParams) -> Run,
    "run.report" => run_report(RunIdParams) -> RunReport,
    "manual.section" => manual_section(SectionParams) -> SectionView,
    "manual.children" => manual_children(ChildrenParams) -> Vec<SectionRef>,
    "manual.search" => manual_search(ManualSearchParams) -> ManualSearch,
    "ask" => ask(AskParams) -> AskResponse,
    "lesson.create" => lesson_create(LessonCreateParams) -> Lesson,
    "lesson.list" => lesson_list(LessonFilter) -> Vec<Lesson>,
    "field.install" => field_install(FieldInstallParams) -> FieldInstall,
    "field.list" => field_list(NoParams) -> Vec<FieldNote>,
    "sync.status" => sync_status(NoParams) -> SyncStatus,
    "sync.flush" => sync_flush(NoParams) -> FlushReport,
    "audit.list" => audit_list(AuditListParams) -> Vec<AuditRecord>,
    "audit.verify" => audit_verify(NoParams) -> ChainReport,
}

// ------------------------------------------------------------ params

/// No parameters.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct NoParams {}

/// Which pack (the only one loaded when absent).
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PackParams {
    #[serde(default)]
    pub pack_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct EquipResolveParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub serial: Option<String>,
    #[serde(default)]
    pub firmware: Option<String>,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetIdParams {
    pub asset_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetCreateParams {
    /// The pack whose equipment ids are checked.
    #[serde(default)]
    pub pack_id: Option<String>,
    pub asset: AssetInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetUpdateParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub asset_id: String,
    /// Fields given replace the stored ones; `attrs` merge.
    pub changes: AssetInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetImportParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub registry: AssetRegistry,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetHistoryParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub asset_id: String,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SymptomSearchParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    /// The technician's words.
    #[serde(default)]
    pub text: Option<String>,
    /// Signals read from the machine.
    #[serde(default)]
    pub observations: Vec<Observation>,
    #[serde(default)]
    pub equip_id: Option<String>,
    /// The asset (its variant when `equip_id` is absent).
    #[serde(default)]
    pub asset_id: Option<String>,
    /// Results (default 10).
    #[serde(default)]
    pub k: Option<usize>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SignalMatchParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub observations: Vec<Observation>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TreeListParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TreeGetParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub tree_id: String,
}

/// Start a job: give `symptom_id`, `signals`, or `tree_id`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobStartParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub symptom_id: Option<String>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(default)]
    pub signals: Vec<Observation>,
    #[serde(default)]
    pub node_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    pub level: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobIdParams {
    pub job_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobGetParams {
    pub job_id: String,
    /// Show the step at another level than the job's.
    #[serde(default)]
    pub level: Option<String>,
}

/// Record the result at the job's current node.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobAnswerParams {
    pub job_id: String,
    /// The node answered: must be the job's current node.
    pub node_id: String,
    /// `yes` | `no` | `pass` | `fail` | a choice option | `done`.
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub photos: Vec<PhotoRef>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobCloseParams {
    pub job_id: String,
    pub resolution: ResolutionKind,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub lesson: Option<LessonInput>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct JobListParams {
    #[serde(default)]
    pub asset_id: Option<String>,
    /// `open` | `closed`.
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TaskListParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TaskGetParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub proc_id: String,
    #[serde(default)]
    pub equip_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RunStartParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub proc_id: String,
    /// The level (or role) the task is done at.
    pub role: String,
    #[serde(default)]
    pub equip_id: Option<String>,
    /// The unit (an asset id or what the technician typed).
    #[serde(default)]
    pub asset: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RunIdParams {
    pub run_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct RunRecordParams {
    pub run_id: String,
    pub ord: i64,
    pub outcome: Outcome,
    #[serde(default)]
    pub value: Option<String>,
    #[serde(default)]
    pub note: Option<String>,
    #[serde(default)]
    pub photos: Vec<PhotoRef>,
    #[serde(default)]
    pub structured: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SectionParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub section_id: String,
    #[serde(default)]
    pub equip_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ChildrenParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    /// The parent; the manual's top level when absent.
    #[serde(default)]
    pub section_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
}

/// Limit a question or a search to part of the manual.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct Scope {
    #[serde(default)]
    pub tree_id: Option<String>,
    #[serde(default)]
    pub proc_id: Option<String>,
    /// Every tree of this system.
    #[serde(default)]
    pub system: Option<String>,
    /// Sections (and everything under them).
    #[serde(default)]
    pub section_ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ManualSearchParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub query: String,
    #[serde(default)]
    pub k: Option<usize>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub scope: Option<Scope>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AskParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub question: String,
    /// A level of the pack; the first when absent.
    #[serde(default)]
    pub level: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub scope: Option<Scope>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LessonCreateParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub lesson: LessonInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct FieldInstallParams {
    /// The signed bundle (`harvest-field/1`) as received.
    pub bundle: Value,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AuditListParams {
    /// Only entries after this sequence number.
    #[serde(default)]
    pub after_seq: Option<i64>,
    /// At most this many (default 200).
    #[serde(default)]
    pub limit: Option<usize>,
}

// ----------------------------------------------------------- results

/// What a pack is and how to talk to it.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct PackInfoView {
    pub api_version: String,
    #[serde(flatten)]
    pub info: PackInfo,
    /// Depth levels, most guidance first.
    pub levels: Vec<Level>,
    pub equipment: Vec<Equipment>,
    pub has_fault_trees: bool,
    /// The systems the trees cover.
    pub systems: Vec<String>,
    /// Facet headings, in the manual's order.
    pub facets: Vec<FacetDef>,
    /// The signal kinds the pack maps, with a label and an example.
    pub signal_kinds: Vec<SignalKind>,
    pub repeat_window_days: i64,
    /// Every loaded pack id.
    pub packs: Vec<String>,
}

/// Where the upload destination stands: configured, and reachable as of
/// the last attempt (never probed live).
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct HubState {
    pub configured: bool,
    /// `folder` (a removable drive or shared folder) or `hub`.
    pub destination: Option<String>,
    /// As of the last attempt; `None` before any.
    pub reachable: Option<bool>,
    pub last_attempt_at: Option<String>,
    pub last_error: Option<String>,
}

/// The outbox and the link.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SyncStatus {
    #[serde(flatten)]
    pub outbox: OutboxStatus,
    /// When an item was last acknowledged.
    pub last_synced_at: Option<String>,
    pub hub: HubState,
}

/// A variant with its inherited attributes.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct EquipView {
    #[serde(flatten)]
    pub equipment: Equipment,
    pub attrs: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SymptomSearch {
    /// The best hit's confidence; `none` with no hit.
    pub confidence: search::Confidence,
    pub hits: Vec<SymptomHit>,
    /// True when the dense half ran.
    pub dense: bool,
    /// The variant the search was filtered to.
    pub equip_id: Option<String>,
    /// The signal match, when observations were given.
    pub signals: Option<SignalMatch>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct JobClosed {
    pub job: Job,
    pub lesson: Option<Lesson>,
}

/// A task in a list.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TaskSummary {
    pub proc_id: String,
    pub title: String,
    pub kind: String,
    pub summary: String,
    pub applies_to: Vec<String>,
}

/// A section in a list.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SectionRef {
    pub section_id: String,
    pub kind: String,
    pub citation: String,
    pub heading: Option<String>,
    pub has_children: bool,
    pub applies_to: Vec<String>,
}

/// One section of the manual, ready to show.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SectionView {
    pub section: Section,
    pub citation: Citation,
    pub loc: SectionLoc,
    pub guards: Vec<Guard>,
    pub assets: Vec<PackAsset>,
    pub children: Vec<SectionRef>,
    pub applies_to: Vec<String>,
    pub detail: Vec<LevelText>,
}

/// One search hit with its text and citation.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ManualHit {
    pub chunk_id: String,
    pub ref_kind: String,
    pub ref_id: String,
    pub section_id: Option<String>,
    pub citation: Option<String>,
    pub heading: Option<String>,
    pub text: String,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ManualSearch {
    pub query: String,
    pub hits: Vec<ManualHit>,
    /// The engine's search result (scores, dense status, readings).
    pub search: SearchResult,
}

// ---------------------------------------------------------- handlers

type R<T> = std::result::Result<T, ApiError>;

fn nz(s: &Option<String>) -> Option<&str> {
    s.as_deref().map(str::trim).filter(|s| !s.is_empty())
}

fn pack_info(h: &Host, p: PackParams) -> R<PackInfoView> {
    let pack = h.pack(nz(&p.pack_id))?;
    let mut systems: Vec<String> = pack
        .fault_trees(None)?
        .into_iter()
        .filter_map(|t| t.system)
        .collect();
    systems.sort();
    systems.dedup();
    Ok(PackInfoView {
        api_version: API_VERSION.into(),
        info: pack.info()?,
        levels: pack.levels()?,
        equipment: pack.equipment().to_vec(),
        has_fault_trees: pack.has_fault_trees()?,
        systems,
        facets: pack.facet_defs()?,
        signal_kinds: pack.signal_kinds()?,
        repeat_window_days: pack.repeat_window_days(),
        packs: h.packs.keys().cloned().collect(),
    })
}

fn pack_validate(h: &Host, p: PackParams) -> R<GraphReport> {
    Ok(graph::validate(h.pack(nz(&p.pack_id))?)?)
}

fn equip_list(h: &Host, p: PackParams) -> R<Vec<EquipView>> {
    let pack = h.pack(nz(&p.pack_id))?;
    pack.equipment()
        .iter()
        .map(|e| {
            Ok(EquipView {
                attrs: pack.equip_attrs(&e.equip_id)?,
                equipment: e.clone(),
            })
        })
        .collect()
}

fn equip_resolve(h: &Host, p: EquipResolveParams) -> R<Resolved> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(resolve::resolve(
        pack,
        &Plate {
            model: p.model,
            serial: p.serial,
            firmware: p.firmware,
            params: p.params,
            text: p.text,
        },
    )?)
}

fn asset_list(h: &Host, _: NoParams) -> R<Vec<Asset>> {
    Ok(h.records().assets()?)
}

fn asset_get(h: &Host, p: AssetIdParams) -> R<Asset> {
    Ok(h.records()
        .asset(&p.asset_id)?
        .ok_or_else(|| Error::Invalid(format!("no asset {:?}", p.asset_id)))?)
}

fn optional_pack<'a>(h: &'a Host, id: &Option<String>) -> R<Option<&'a Arc<Pack>>> {
    match nz(id) {
        Some(id) => Ok(Some(h.pack(Some(id))?)),
        None => Ok(h.pack(None).ok()),
    }
}

fn asset_create(h: &Host, p: AssetCreateParams) -> R<Asset> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records()
        .create_asset(pack.map(|p| p.as_ref()), p.asset)?)
}

fn asset_update(h: &Host, p: AssetUpdateParams) -> R<Asset> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records()
        .update_asset(pack.map(|p| p.as_ref()), &p.asset_id, p.changes)?)
}

fn asset_import(h: &Host, p: AssetImportParams) -> R<ImportReport> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records()
        .import_assets(pack.map(|p| p.as_ref()), &p.registry)?)
}

fn asset_history(h: &Host, p: AssetHistoryParams) -> R<AssetHistory> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(h.records().asset_history(pack, &p.asset_id)?)
}

/// The variant to filter by: given, else the asset's.
fn equip_for(h: &Host, equip: &Option<String>, asset: &Option<String>) -> R<Option<String>> {
    if let Some(e) = nz(equip) {
        return Ok(Some(e.to_string()));
    }
    match nz(asset) {
        Some(a) => Ok(h
            .records()
            .asset(a)?
            .ok_or_else(|| Error::Invalid(format!("no asset {a:?}")))?
            .equip_id),
        None => Ok(None),
    }
}

fn symptom_search(h: &Host, p: SymptomSearchParams) -> R<SymptomSearch> {
    let pack = h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let (hits, dense) = search::symptom_search(
        pack,
        nz(&p.text),
        &p.observations,
        equip.as_deref(),
        h.embedder(pack),
        p.k.unwrap_or(10),
    )?;
    let signals = if p.observations.is_empty() {
        None
    } else {
        Some(search::signal_match(
            pack,
            &p.observations,
            equip.as_deref(),
        )?)
    };
    Ok(SymptomSearch {
        confidence: hits
            .first()
            .map_or(search::Confidence::None, |h| h.confidence),
        hits,
        dense,
        equip_id: equip,
        signals,
    })
}

fn signal_match(h: &Host, p: SignalMatchParams) -> R<SignalMatch> {
    let pack = h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    Ok(search::signal_match(
        pack,
        &p.observations,
        equip.as_deref(),
    )?)
}

fn tree_list(h: &Host, p: TreeListParams) -> R<Vec<FaultTree>> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(pack
        .fault_trees(nz(&p.equip_id))?
        .into_iter()
        .filter(|t| nz(&p.system).is_none_or(|s| t.system.as_deref() == Some(s)))
        .collect())
}

fn tree_get(h: &Host, p: TreeGetParams) -> R<Tree> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(pack
        .fault_tree(&p.tree_id)?
        .ok_or_else(|| Error::Invalid(format!("no tree {:?}", p.tree_id)))?)
}

fn job_pack<'a>(h: &'a Host, rec: &Records, job_id: &str) -> R<&'a Arc<Pack>> {
    let job = rec
        .job(job_id)?
        .ok_or_else(|| Error::Invalid(format!("no job {job_id:?}")))?;
    Ok(h.pack(Some(&job.pack_id))?)
}

fn job_start(h: &Host, p: JobStartParams) -> R<JobView> {
    let pack = h.pack(nz(&p.pack_id))?;
    let rec = h.records();
    let job = rec.start_job(
        pack,
        &JobStart {
            tree_id: p.tree_id,
            symptom_id: p.symptom_id,
            query: p.query,
            signals: p.signals,
            node_id: p.node_id,
            asset_id: p.asset_id,
            equip_id: p.equip_id,
            level: p.level,
        },
    )?;
    Ok(rec.job_view(pack, &job.job_id, None)?)
}

fn job_get(h: &Host, p: JobGetParams) -> R<JobView> {
    let rec = h.records();
    let pack = job_pack(h, &rec, &p.job_id)?;
    Ok(rec.job_view(pack, &p.job_id, nz(&p.level))?)
}

fn job_answer(h: &Host, p: JobAnswerParams) -> R<JobView> {
    let rec = h.records();
    let pack = job_pack(h, &rec, &p.job_id)?;
    rec.answer_job(
        pack,
        &p.job_id,
        &JobAnswer {
            node_id: p.node_id,
            outcome: p.outcome,
            value: p.value,
            unit: p.unit,
            note: p.note,
            photos: p.photos,
        },
    )?;
    Ok(rec.job_view(pack, &p.job_id, None)?)
}

fn job_back(h: &Host, p: JobIdParams) -> R<JobView> {
    let rec = h.records();
    let pack = job_pack(h, &rec, &p.job_id)?;
    rec.back_job(pack, &p.job_id)?;
    Ok(rec.job_view(pack, &p.job_id, None)?)
}

fn job_close(h: &Host, p: JobCloseParams) -> R<JobClosed> {
    let rec = h.records();
    let pack = job_pack(h, &rec, &p.job_id)?;
    let (job, lesson) = rec.close_job(
        pack,
        &p.job_id,
        &JobClose {
            resolution: p.resolution,
            note: p.note,
            lesson: p.lesson,
        },
    )?;
    Ok(JobClosed { job, lesson })
}

fn job_list(h: &Host, p: JobListParams) -> R<Vec<JobSummary>> {
    let mut jobs = h.records().jobs(nz(&p.asset_id), nz(&p.status))?;
    let mut titles: BTreeMap<(String, String), String> = BTreeMap::new();
    for pack in h.packs() {
        for t in pack.fault_trees(None)? {
            titles.insert((pack.pack_id().to_string(), t.tree_id), t.title);
        }
    }
    for j in &mut jobs {
        if j.tree_title.is_none() {
            j.tree_title = titles.get(&(j.pack_id.clone(), j.tree_id.clone())).cloned();
        }
    }
    Ok(jobs)
}

fn job_report(h: &Host, p: JobIdParams) -> R<JobReport> {
    let rec = h.records();
    let pack = job_pack(h, &rec, &p.job_id)?;
    Ok(rec.job_report(pack, &p.job_id)?)
}

fn task_list(h: &Host, p: TaskListParams) -> R<Vec<TaskSummary>> {
    let pack = h.pack(nz(&p.pack_id))?;
    let mut out = Vec::new();
    for t in pack.procedures()? {
        let applies_to = pack.applies_to("procedure", &t.procedure.proc_id)?;
        if pack.applies(&applies_to, nz(&p.equip_id)) {
            out.push(TaskSummary {
                proc_id: t.procedure.proc_id,
                title: t.procedure.title,
                kind: t.procedure.kind,
                summary: t.procedure.summary,
                applies_to,
            });
        }
    }
    Ok(out)
}

fn task_get(h: &Host, p: TaskGetParams) -> R<TaskView> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(view::task_view(pack, &p.proc_id, nz(&p.equip_id))?
        .ok_or_else(|| Error::Invalid(format!("no task {:?}", p.proc_id)))?)
}

fn run_pack<'a>(h: &'a Host, rec: &Records, run_id: &str) -> R<&'a Arc<Pack>> {
    let run = rec
        .run(run_id)?
        .ok_or_else(|| Error::Invalid(format!("no run {run_id:?}")))?;
    Ok(h.pack(Some(&run.pack_id))?)
}

fn run_start(h: &Host, p: RunStartParams) -> R<Run> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(h.records().start_run(
        pack,
        &p.proc_id,
        &StartRun {
            role: p.role,
            equip_id: p.equip_id,
            asset: p.asset,
        },
    )?)
}

fn run_record(h: &Host, p: RunRecordParams) -> R<StepOutcome> {
    let rec = h.records();
    let pack = run_pack(h, &rec, &p.run_id)?;
    Ok(rec.record_step(
        pack,
        &p.run_id,
        p.ord,
        StepInput {
            outcome: p.outcome,
            value: p.value,
            note: p.note,
            photos: p.photos,
            structured: p.structured,
        },
    )?)
}

fn run_finish(h: &Host, p: RunIdParams) -> R<Run> {
    let rec = h.records();
    let pack = run_pack(h, &rec, &p.run_id)?;
    Ok(rec.finish_run(pack, &p.run_id)?)
}

fn run_abandon(h: &Host, p: RunIdParams) -> R<Run> {
    let rec = h.records();
    let pack = run_pack(h, &rec, &p.run_id)?;
    Ok(rec.abandon_run(pack, &p.run_id)?)
}

fn run_report(h: &Host, p: RunIdParams) -> R<RunReport> {
    let rec = h.records();
    let pack = run_pack(h, &rec, &p.run_id)?;
    Ok(rec.report(pack, &p.run_id)?)
}

fn section_ref(pack: &Pack, s: &Section) -> Result<SectionRef> {
    Ok(SectionRef {
        has_children: !pack.children(&s.section_id)?.is_empty(),
        applies_to: pack.section_applies_to(&s.section_id)?,
        section_id: s.section_id.clone(),
        kind: s.kind.clone(),
        citation: s.citation.clone(),
        heading: s.heading.clone(),
    })
}

fn manual_section(h: &Host, p: SectionParams) -> R<SectionView> {
    let pack = h.pack(nz(&p.pack_id))?;
    let section = pack
        .section(&p.section_id)?
        .ok_or_else(|| Error::Invalid(format!("no section {:?}", p.section_id)))?;
    let equip = nz(&p.equip_id);
    let mut children = Vec::new();
    for c in pack.children(&section.section_id)? {
        let r = section_ref(pack, &c)?;
        if pack.applies(&r.applies_to, equip) {
            children.push(r);
        }
    }
    let mut detail = Vec::new();
    for l in pack.levels()? {
        if let Some(text) = pack.explanation(&section.section_id, &l.id, &section.lang)? {
            detail.push(LevelText {
                level: l.id,
                label: l.label,
                text,
            });
        }
    }
    Ok(SectionView {
        citation: view::citation(pack, &section.section_id)?,
        loc: pack.section_loc_inherited(&section.section_id)?,
        guards: view::guards(pack, std::slice::from_ref(&section.section_id), equip)?,
        assets: view::assets_for(pack, &section.section_id)?,
        applies_to: pack.section_applies_to(&section.section_id)?,
        children,
        detail,
        section,
    })
}

fn manual_children(h: &Host, p: ChildrenParams) -> R<Vec<SectionRef>> {
    let pack = h.pack(nz(&p.pack_id))?;
    let rows: Vec<Section> = match nz(&p.section_id) {
        Some(id) => pack.children(id)?,
        None => pack
            .sections()?
            .into_iter()
            .filter(|s| s.parent_id.is_none())
            .collect(),
    };
    let mut out = Vec::new();
    for s in rows {
        let r = section_ref(pack, &s)?;
        if pack.applies(&r.applies_to, nz(&p.equip_id)) {
            out.push(r);
        }
    }
    Ok(out)
}

/// The sections a scope stands for.
fn scope_sections(pack: &Pack, scope: &Option<Scope>) -> Result<Vec<String>> {
    let Some(s) = scope else {
        return Ok(Vec::new());
    };
    let mut out: Vec<String> = s.section_ids.clone();
    if let Some(t) = nz(&s.tree_id) {
        let tree = pack
            .fault_tree(t)?
            .ok_or_else(|| Error::Invalid(format!("no tree {t:?}")))?;
        out.extend(tree.tree.section_ids.clone());
        out.extend(tree.nodes.iter().map(|n| n.section_id.clone()));
    }
    if let Some(sys) = nz(&s.system) {
        let trees: Vec<FaultTree> = pack
            .fault_trees(None)?
            .into_iter()
            .filter(|t| t.system.as_deref() == Some(sys))
            .collect();
        if trees.is_empty() {
            return Err(Error::Invalid(format!("no tree covers system {sys:?}")));
        }
        for t in trees {
            out.extend(t.section_ids);
        }
    }
    if let Some(pid) = nz(&s.proc_id) {
        let steps = pack.proc_steps(pid)?;
        if pack.procedure(pid)?.is_none() {
            return Err(Error::Invalid(format!("no task {pid:?}")));
        }
        for st in steps {
            out.extend(st.section_ids);
        }
    }
    out.sort();
    out.dedup();
    Ok(out)
}

fn manual_search(h: &Host, p: ManualSearchParams) -> R<ManualSearch> {
    let pack = h.pack(nz(&p.pack_id))?;
    let mut r = crate::retrieval::Retriever::new(pack);
    r.embedder = h.embedder(pack);
    let result = r.search(
        &p.query,
        &SearchOptions {
            k: p.k.unwrap_or(10),
            equip: nz(&p.equip_id).map(str::to_string),
            within: scope_sections(pack, &p.scope)?,
            ..SearchOptions::default()
        },
    )?;
    let mut hits = Vec::new();
    for hit in &result.hits {
        let sec = match &hit.section_id {
            Some(s) => pack.section(s)?,
            None => None,
        };
        hits.push(ManualHit {
            chunk_id: hit.chunk_id.clone(),
            ref_kind: hit.ref_kind.clone(),
            ref_id: hit.ref_id.clone(),
            section_id: hit.section_id.clone(),
            citation: sec.as_ref().map(|s| s.citation.clone()),
            heading: sec.and_then(|s| s.heading),
            text: hit.text.clone(),
            score: hit.score,
        });
    }
    Ok(ManualSearch {
        query: p.query,
        hits,
        search: result,
    })
}

fn ask(h: &Host, p: AskParams) -> R<AskResponse> {
    let pack = h.pack(nz(&p.pack_id))?;
    let level = match nz(&p.level) {
        Some(l) => pack.level(l)?,
        None => pack
            .levels()?
            .into_iter()
            .next()
            .ok_or_else(|| Error::Pack("the pack declares no levels".into()))?,
    };
    let mut engine = Engine::new(pack.clone());
    if let Some(e) = h.embedders.get(pack.pack_id()) {
        engine = engine.with_embedder(e.clone());
    }
    if let Some(l) = &h.llm {
        engine = engine.with_llm(l.clone());
    }
    let opts = AskOptions {
        role: Role::parse(&level.id).unwrap_or_default(),
        level: Some(level.id.clone()),
        equip: nz(&p.equip_id).map(str::to_string),
        within: scope_sections(pack, &p.scope)?,
        ..AskOptions::for_pack(pack)
    };
    let (resp, trace) = engine.ask_traced(&p.question, &opts)?;
    h.records()
        .record_answer(pack, &p.question, &resp, &trace)?;
    Ok(resp)
}

fn lesson_create(h: &Host, p: LessonCreateParams) -> R<Lesson> {
    let rec = h.records();
    let pack = match nz(&p.pack_id) {
        Some(id) => Some(h.pack(Some(id))?),
        None => match p.lesson.job_id.as_deref() {
            Some(j) => Some(job_pack(h, &rec, j)?),
            None => h.pack(None).ok(),
        },
    };
    Ok(rec.create_lesson(pack.map(|p| p.as_ref()), p.lesson)?)
}

fn lesson_list(h: &Host, p: LessonFilter) -> R<Vec<Lesson>> {
    Ok(h.records().lessons(&p)?)
}

fn field_install(h: &Host, p: FieldInstallParams) -> R<FieldInstall> {
    if h.field_keys.is_empty() {
        return Err(Error::Signature("no trusted key for field-note bundles".into()).into());
    }
    Ok(h.records().install_field_bundle(&p.bundle, &h.field_keys)?)
}

fn field_list(h: &Host, _: NoParams) -> R<Vec<FieldNote>> {
    Ok(h.records().field_notes()?)
}

fn sync_status(h: &Host, _: NoParams) -> R<SyncStatus> {
    let rec = h.records();
    let state = rec.sync_state()?;
    Ok(SyncStatus {
        outbox: rec.outbox_status()?,
        last_synced_at: state.last_synced_at,
        hub: HubState {
            configured: h.outbox_dir.is_some(),
            destination: h.outbox_dir.as_ref().map(|_| "folder".to_string()),
            reachable: state.last_attempt_ok,
            last_attempt_at: state.last_attempt_at,
            last_error: state.last_error,
        },
    })
}

fn sync_flush(h: &Host, _: NoParams) -> R<FlushReport> {
    let dir = h
        .outbox_dir
        .as_ref()
        .ok_or_else(|| Error::Sync("no upload destination is configured on this device".into()))?;
    Ok(h.records()
        .flush(&crate::sync::DirTransport::new(dir), 50)?)
}

fn audit_list(h: &Host, p: AuditListParams) -> R<Vec<AuditRecord>> {
    let rec = h.records();
    let all = crate::audit::records_with(rec.conn(), rec.key())?;
    let after = p.after_seq.unwrap_or(0);
    Ok(all
        .into_iter()
        .filter(|r| match r {
            AuditRecord::Answer { seq, .. } | AuditRecord::Event { seq, .. } => *seq > after,
        })
        .take(p.limit.unwrap_or(200))
        .collect())
}

fn audit_verify(h: &Host, _: NoParams) -> R<ChainReport> {
    Ok(h.records().verify_audit()?)
}

// Keep the records module's public names reachable from here for hosts.
pub use records::{FieldBundle, LessonStatus, NoteScope};
