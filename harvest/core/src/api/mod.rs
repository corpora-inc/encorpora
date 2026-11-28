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
use crate::hub::auth::{Identify, Principal, Role as HubRole};
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
use crate::sync::OutboxStatus;
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
/// for field-note bundles, the upload destination (a hub link or a
/// folder), and, on a hub, the hub's store.
pub struct Host {
    packs: std::sync::RwLock<BTreeMap<String, Arc<Pack>>>,
    records: Mutex<Records>,
    embedders: BTreeMap<String, Arc<dyn Embedder>>,
    llm: Option<Arc<dyn Llm>>,
    field_keys: Vec<TrustedKey>,
    pack_keys: Vec<TrustedKey>,
    outbox_dir: Option<PathBuf>,
    hub_link: Option<Arc<dyn crate::sync::HubLink + Send + Sync>>,
    packs_root: Option<PathBuf>,
    hub: Option<Arc<Mutex<crate::hub::Hub>>>,
    identity: Option<Arc<dyn Identify>>,
}

impl Host {
    pub fn new(packs: Vec<Arc<Pack>>, records: Records) -> Self {
        Self {
            packs: std::sync::RwLock::new(
                packs
                    .into_iter()
                    .map(|p| (p.pack_id().to_string(), p))
                    .collect(),
            ),
            records: Mutex::new(records),
            embedders: BTreeMap::new(),
            llm: None,
            field_keys: Vec::new(),
            pack_keys: Vec::new(),
            outbox_dir: None,
            hub_link: None,
            packs_root: None,
            hub: None,
            identity: None,
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
    /// a shared folder), when there is no hub link.
    pub fn with_outbox_dir(mut self, dir: PathBuf) -> Self {
        self.outbox_dir = Some(dir);
        self
    }
    /// The device's link to its hub: `sync.flush` sends through it and
    /// `sync.pull` fetches bundles and pack updates. With `packs_root`
    /// (the installed layout) and the publisher's `pack_keys`, a newer pack
    /// is installed and replaces the loaded one.
    pub fn with_hub_link(
        mut self,
        link: Arc<dyn crate::sync::HubLink + Send + Sync>,
        packs_root: Option<PathBuf>,
        pack_keys: Vec<TrustedKey>,
    ) -> Self {
        self.hub_link = Some(link);
        self.packs_root = packs_root;
        self.pack_keys = pack_keys;
        self
    }
    /// The hub's store, for the `hub.*` methods and the device routes of
    /// `harvest hub`.
    pub fn with_hub(mut self, hub: Arc<Mutex<crate::hub::Hub>>) -> Self {
        self.hub = Some(hub);
        self
    }

    /// How the transport identifies people (reviewers, publishers,
    /// administrators) for the `hub.*` methods.
    pub fn with_identity(mut self, id: Arc<dyn Identify>) -> Self {
        self.identity = Some(id);
        self
    }

    /// The identity provider, when one is set.
    pub fn identity(&self) -> Option<&Arc<dyn Identify>> {
        self.identity.as_ref()
    }

    /// The hub's store, when this host is a hub.
    pub fn hub(&self) -> Option<&Arc<Mutex<crate::hub::Hub>>> {
        self.hub.as_ref()
    }

    fn hub_store(&self) -> Result<MutexGuard<'_, crate::hub::Hub>> {
        let h = self
            .hub
            .as_ref()
            .ok_or_else(|| Error::Invalid("this host is not a hub".into()))?;
        Ok(h.lock().unwrap_or_else(|p| p.into_inner()))
    }

    /// The loaded packs.
    pub fn packs(&self) -> Vec<Arc<Pack>> {
        self.packs
            .read()
            .unwrap_or_else(|p| p.into_inner())
            .values()
            .cloned()
            .collect()
    }

    /// A pack by id, or the only one when `None`.
    pub fn pack(&self, id: Option<&str>) -> Result<Arc<Pack>> {
        let packs = self.packs.read().unwrap_or_else(|p| p.into_inner());
        match id {
            Some(id) => packs
                .get(id)
                .cloned()
                .ok_or_else(|| Error::Invalid(format!("no pack {id:?} is loaded"))),
            None if packs.len() == 1 => Ok(packs.values().next().expect("one pack").clone()),
            None if packs.is_empty() => Err(Error::Invalid("no pack is loaded".into())),
            None => Err(Error::Invalid(format!(
                "more than one pack is loaded; name one with pack_id: {:?}",
                packs.keys().collect::<Vec<_>>()
            ))),
        }
    }

    fn replace_pack(&self, pack: Arc<Pack>) {
        self.packs
            .write()
            .unwrap_or_else(|p| p.into_inner())
            .insert(pack.pack_id().to_string(), pack);
    }

    /// Run `f` on the device records (a host's own sync loop, tests).
    pub fn with_records<T>(&self, f: impl FnOnce(&Records) -> T) -> T {
        f(&self.records())
    }

    fn records(&self) -> MutexGuard<'_, Records> {
        // A panic while writing rolls the transaction back; the store stays valid.
        self.records.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// A pack asset's bytes and media type, re-hashed against the signed
    /// manifest before they are returned; `None` for an unknown pack or
    /// asset.
    pub fn asset(&self, pack_id: &str, asset_id: &str) -> Result<Option<(String, Vec<u8>)>> {
        let Ok(pack) = self.pack(Some(pack_id)) else {
            return Ok(None);
        };
        let Some((a, path)) = pack.asset_file(asset_id)? else {
            return Ok(None);
        };
        let bytes = std::fs::read(&path)?;
        use sha2::{Digest, Sha256};
        if !crate::packs::hex_encode(&Sha256::digest(&bytes)).eq_ignore_ascii_case(&a.sha256) {
            return Err(crate::error::Error::Integrity(format!(
                "asset {asset_id}: sha256 mismatch"
            )));
        }
        Ok(Some((a.media_type, bytes)))
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
    dispatch(host, None, method, params)
}

/// [`call`] on behalf of an identified person (the transport identified
/// them; `hub.*` methods check their roles and record their name).
pub fn call_as(
    host: &Host,
    who: Option<&Principal>,
    method: &str,
    params: Value,
) -> std::result::Result<Value, ApiError> {
    dispatch(host, who, method, params)
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
        fn dispatch(host: &Host, who: Option<&Principal>, method: &str, params: Value) -> std::result::Result<Value, ApiError> {
            match method {
                $( $name => {
                    let p: $params = parse(method, params)?;
                    let r: $result = $handler(host, who, p)?;
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
    "pack.list" => pack_list(NoParams) -> Vec<PackSummary>,
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
    "signal.decode" => signal_decode(SignalDecodeParams) -> SignalDecode,
    "tree.list" => tree_list(TreeListParams) -> Vec<FaultTree>,
    "tree.get" => tree_get(TreeGetParams) -> Tree,
    "job.start" => job_start(JobStartParams) -> JobView,
    "job.get" => job_get(JobGetParams) -> JobView,
    "job.answer" => job_answer(JobAnswerParams) -> JobView,
    "job.back" => job_back(JobIdParams) -> JobView,
    "job.follow" => job_follow(JobIdParams) -> JobView,
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
    "sync.attachments" => sync_attachments(SyncAttachmentsParams) -> crate::records::AttachReport,
    "sync.flush" => sync_flush(SyncFlushParams) -> crate::records::HubFlush,
    "device.info" => device_info(NoParams) -> DeviceInfo,
    "sync.pull" => sync_pull(NoParams) -> SyncPull,
    "lesson.update" => lesson_update(LessonUpdateParams) -> Lesson,
    "fleet.summary" => fleet_summary(NoParams) -> Option<crate::records::FleetSummary>,
    "audit.list" => audit_list(AuditListParams) -> Vec<AuditRecord>,
    "audit.verify" => audit_verify(NoParams) -> ChainReport,
    "table.list" => table_list(ScopeParams) -> Vec<crate::maint::table::TableSummary>,
    "table.get" => table_get(TableGetParams) -> crate::maint::table::TableView,
    "table.lookup" => table_lookup(TableLookupParams) -> Vec<crate::maint::table::RowHit>,
    "asset.attrs" => asset_attrs(AssetAttrsParams) -> AssetAttrs,
    "asset.set_attrs" => asset_set_attrs(AssetSetAttrsParams) -> AssetAttrs,
    "practice.items" => practice_items(PracticeItemsParams) -> crate::practice::PracticeItems,
    "practice.record" => practice_record(PracticeRecordParams) -> crate::records::PracticeAttempt,
    "practice.history" => practice_history(PackParams) -> Vec<crate::records::PracticeAttempt>,
    "hub.practice" => hub_practice(HubPracticeParams) -> crate::hub::PracticeExport,
    "hub.status" => hub_status(NoParams) -> crate::hub::HubStatus,
    "hub.queue" => hub_queue(HubQueueParams) -> Vec<crate::hub::ReviewItem>,
    "hub.approve" => hub_approve(HubApproveParams) -> crate::records::FieldNoteIn,
    "hub.reject" => hub_reject(HubRejectParams) -> crate::hub::HubStatus,
    "hub.publish" => hub_publish(HubPublishParams) -> Option<Value>,
    "hub.bundles" => hub_bundles(HubBundlesParams) -> Vec<Value>,
    "hub.fleet" => hub_fleet(NoParams) -> crate::records::FleetSummary,
    "hub.conflicts" => hub_conflicts(PageParams) -> Vec<crate::hub::Conflict>,
    "hub.audit" => hub_audit(AuditListParams) -> Vec<AuditRecord>,
    "hub.devices" => hub_devices(PageParams) -> Vec<crate::hub::EnrolledDevice>,
    "hub.enroll" => hub_enroll(HubEnrollParams) -> crate::hub::EnrolledDevice,
    "hub.revoke" => hub_revoke(HubRevokeParams) -> crate::hub::EnrolledDevice,
    "hub.whoami" => hub_whoami(NoParams) -> Principal,
}

// ------------------------------------------------------------ params

/// No parameters.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct NoParams {}

/// One pass of the attachment lane (after `sync.flush`; it sends nothing
/// while records are queued).
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SyncAttachmentsParams {
    /// Stop starting chunks after this long (default 10, at most 300). The
    /// records store is held only for each read or write, never while a
    /// chunk is on the wire.
    #[serde(default)]
    pub max_seconds: Option<u64>,
}

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
    /// Overrides of the pack's ranking rule (for calibration).
    #[serde(default)]
    pub ranking: Option<search::RankingParams>,
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

/// Raw vehicle data to decode into observations.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SignalDecodeParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub format: crate::decode::Format,
    /// The text: log lines, frames, hex messages, or the typed code.
    pub input: String,
    /// For a display code: its signal kind (`pump40.code`); any kind when absent.
    #[serde(default)]
    pub signal_kind: Option<String>,
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
    /// The asset: its variant (when `equip_id` is absent) and its attribute
    /// values for applicability.
    #[serde(default)]
    pub asset_id: Option<String>,
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
    /// The asset (its variant when `equip_id` is absent; its attributes
    /// for the rows that apply).
    #[serde(default)]
    pub asset_id: Option<String>,
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

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct SyncFlushParams {
    /// Try now even while backing off after a refusal (an operator retrying
    /// after the device was enrolled).
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct LessonUpdateParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub lesson_id: String,
    pub lesson: LessonInput,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubQueueParams {
    /// `pending` | `approved` | `rejected`; all when absent.
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub offset: usize,
    /// At most this many (default 100, at most 500).
    #[serde(default)]
    pub limit: Option<usize>,
}

/// A pack read for a variant or an asset (its variant and attributes).
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct ScopeParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TableGetParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub table_id: String,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct TableLookupParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    #[serde(default)]
    pub equip_id: Option<String>,
    #[serde(default)]
    pub asset_id: Option<String>,
    /// Only this table.
    #[serde(default)]
    pub table_id: Option<String>,
    /// Exact: a key, code, pattern or item cell equal to it (folded).
    #[serde(default)]
    pub key: Option<String>,
    /// Words: rows holding the query's meaningful words.
    #[serde(default)]
    pub query: Option<String>,
    /// Results (default 10).
    #[serde(default)]
    pub k: Option<usize>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetAttrsParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub asset_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AssetSetAttrsParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub asset_id: String,
    /// Attribute id → value (`null` clears it).
    #[serde(default)]
    pub values: BTreeMap<String, Option<String>>,
    /// `typed` (default), `plate` or `vehicle`.
    #[serde(default)]
    pub source: Option<crate::records::ValueSource>,
    /// A data plate or a vehicle's version message: the attributes the pack
    /// declares with that source are taken from it.
    #[serde(default)]
    pub plate: Option<crate::maint::resolve::Plate>,
}

/// An asset's attributes: what the pack declares and what the asset has.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct AssetAttrs {
    pub declared: Vec<crate::maint::applic::AttrDef>,
    pub values: Vec<crate::records::AttrValue>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PracticeItemsParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    /// The variant (questions that do not apply to it are left out).
    #[serde(default)]
    pub equip_id: Option<String>,
    /// The asset (its variant and attributes).
    #[serde(default)]
    pub asset_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PracticeRecordParams {
    #[serde(default)]
    pub pack_id: Option<String>,
    pub q_id: String,
    /// The choice index as text (mc), the value (numeric) or the text
    /// written (free_text).
    pub chosen: String,
    pub correct: bool,
    /// Milliseconds from showing the question to the answer.
    pub ms: u64,
    /// When it was answered (RFC 3339); now when absent.
    #[serde(default)]
    pub at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubPracticeParams {
    /// Statements after this hub sequence (`next_since` of the last page).
    #[serde(default)]
    pub since: i64,
    /// At most this many (default 500, at most 5000).
    #[serde(default)]
    pub limit: Option<usize>,
}

/// A page of a hub list: skip `offset`, return at most `limit` (default
/// 100, at most 500). Fewer than `limit` means the end.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct PageParams {
    #[serde(default)]
    pub offset: usize,
    #[serde(default)]
    pub limit: Option<usize>,
}

fn page<T>(all: Vec<T>, offset: usize, limit: Option<usize>) -> Vec<T> {
    all.into_iter()
        .skip(offset)
        .take(limit.unwrap_or(100).clamp(1, 500))
        .collect()
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubApproveParams {
    pub lesson_id: String,
    /// The version to approve (an item id from the queue); required when
    /// the lesson `needs_reviewer`.
    #[serde(default)]
    pub version: Option<String>,
    /// Edit before approving: the note's text and/or scope.
    #[serde(default)]
    pub edit: Option<crate::hub::NoteEdit>,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubRejectParams {
    pub lesson_id: String,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubPublishParams {
    /// Publish a bundle (with the fleet summary) even when no note changed.
    #[serde(default)]
    pub always: bool,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubEnrollParams {
    /// The device's ed25519 public key, base64.
    pub public_key: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubRevokeParams {
    pub device_id: String,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct HubBundlesParams {
    #[serde(default)]
    pub since: u64,
    /// At most this many (default 50, at most 200), in seq order.
    #[serde(default)]
    pub limit: Option<usize>,
}

// ----------------------------------------------------------- results

/// A pack replaced by a newer one from the hub.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct PackUpdate {
    pub pack_id: String,
    pub from: String,
    pub to: String,
    /// `full` | `delta`.
    pub kind: String,
    pub bytes: u64,
}

/// What `sync.pull` did.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SyncPull {
    pub bundles: crate::records::PullReport,
    pub packs: Vec<PackUpdate>,
    /// A pack the hub offered that could not be installed, and why.
    pub pack_errors: Vec<String>,
}

/// One installed pack, for choosing among several.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct PackSummary {
    pub pack_id: String,
    /// `pack_meta.title`, else the first source's title, else the id.
    pub title: String,
    pub version: String,
    /// The top of each equipment tree (no parent).
    pub equipment_roots: Vec<Equipment>,
    /// The sources' licenses, each once.
    pub licenses: Vec<String>,
    pub has_fault_trees: bool,
    /// Whether dense search runs for this pack on this host, and why not.
    pub dense: crate::pack::DenseStatus,
}

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
    /// Whether dense search runs for this pack on this host, and why not.
    pub dense: crate::pack::DenseStatus,
}

/// Where the upload destination stands: configured, and reachable as of
/// the last attempt (never probed live).
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct HubState {
    pub configured: bool,
    /// `folder` (a removable drive or shared folder) or `hub`.
    pub destination: Option<String>,
    /// Whether the hub answered on the last attempt (a refusal is an
    /// answer); `None` before any. Never probed live.
    pub reachable: Option<bool>,
    /// Why the hub refused this device: `unenrolled`, `revoked` or
    /// `signature`; `None` when accepted or not yet asked.
    pub refused: Option<crate::sync::Refusal>,
    /// No upload is tried before this time (backing off after a refusal).
    pub backoff_until: Option<String>,
    pub last_attempt_at: Option<String>,
    pub last_error: Option<String>,
}

/// This device as the hub knows it.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct DeviceInfo {
    /// `dev-<key id>`; `None` when no hub link (and so no device key) is set.
    pub device_id: Option<String>,
    /// The base64 ed25519 public key an administrator enrolls.
    pub public_key: Option<String>,
}

/// The outbox and the link.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SyncStatus {
    #[serde(flatten)]
    pub outbox: OutboxStatus,
    /// When an item was last acknowledged.
    pub last_synced_at: Option<String>,
    pub hub: HubState,
    /// The attachment lane, apart from the records.
    pub attachments: crate::records::AttachmentStatus,
}

/// Decoded data and what it matches in the pack.
#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SignalDecode {
    pub decoded: crate::decode::Decoded,
    #[serde(rename = "match")]
    pub matched: SignalMatch,
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
    /// Every value of the ranking and confidence rule this search applied
    /// (the pack's, with the call's overrides) and whether dense was
    /// active: with each hit's inputs, the result can be replayed.
    pub thresholds: search::Ranking,
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
    /// For a reference-table row (`ref_kind` `ref_row`): the row, as it
    /// applies.
    pub row: Option<crate::maint::table::RowView>,
    /// The hit's statements, when it has any (a hit that does not apply to
    /// the asset is left out; one not determined is flagged).
    pub applicability: Option<crate::maint::applic::Applicability>,
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

fn pack_list(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<Vec<PackSummary>> {
    let mut out = Vec::new();
    for pack in h.packs() {
        let info = pack.info()?;
        let mut licenses: Vec<String> = info.sources.iter().map(|s| s.license.clone()).collect();
        licenses.sort();
        licenses.dedup();
        out.push(PackSummary {
            title: pack
                .meta("title")
                .map(str::to_string)
                .or_else(|| info.sources.first().map(|s| s.title.clone()))
                .unwrap_or_else(|| pack.pack_id().to_string()),
            pack_id: pack.pack_id().to_string(),
            version: pack.version().to_string(),
            equipment_roots: pack
                .equipment()
                .iter()
                .filter(|e| e.parent_id.is_none())
                .cloned()
                .collect(),
            licenses,
            has_fault_trees: pack.has_fault_trees()?,
            dense: pack.dense_status(h.embedder(&pack))?,
        });
    }
    out.sort_by(|a, b| a.pack_id.cmp(&b.pack_id));
    Ok(out)
}

fn pack_info(h: &Host, _who: Option<&Principal>, p: PackParams) -> R<PackInfoView> {
    let pack = &h.pack(nz(&p.pack_id))?;
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
        packs: h.packs().iter().map(|p| p.pack_id().to_string()).collect(),
        dense: pack.dense_status(h.embedder(pack))?,
    })
}

fn pack_validate(h: &Host, _who: Option<&Principal>, p: PackParams) -> R<GraphReport> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(graph::validate(&pack)?)
}

fn equip_list(h: &Host, _who: Option<&Principal>, p: PackParams) -> R<Vec<EquipView>> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn equip_resolve(h: &Host, _who: Option<&Principal>, p: EquipResolveParams) -> R<Resolved> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn asset_list(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<Vec<Asset>> {
    Ok(h.records().assets()?)
}

fn asset_get(h: &Host, _who: Option<&Principal>, p: AssetIdParams) -> R<Asset> {
    Ok(h.records()
        .asset(&p.asset_id)?
        .ok_or_else(|| Error::Invalid(format!("no asset {:?}", p.asset_id)))?)
}

fn optional_pack(h: &Host, id: &Option<String>) -> R<Option<Arc<Pack>>> {
    match nz(id) {
        Some(id) => Ok(Some(h.pack(Some(id))?)),
        None => Ok(h.pack(None).ok()),
    }
}

fn asset_create(h: &Host, _who: Option<&Principal>, p: AssetCreateParams) -> R<Asset> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records().create_asset(pack.as_deref(), p.asset)?)
}

fn asset_update(h: &Host, _who: Option<&Principal>, p: AssetUpdateParams) -> R<Asset> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records()
        .update_asset(pack.as_deref(), &p.asset_id, p.changes)?)
}

fn asset_import(h: &Host, _who: Option<&Principal>, p: AssetImportParams) -> R<ImportReport> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records().import_assets(pack.as_deref(), &p.registry)?)
}

fn asset_history(h: &Host, _who: Option<&Principal>, p: AssetHistoryParams) -> R<AssetHistory> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn symptom_search(h: &Host, _who: Option<&Principal>, p: SymptomSearchParams) -> R<SymptomSearch> {
    let pack = &h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let ranking = search::Ranking::for_pack(pack)?.with(&p.ranking.unwrap_or_default())?;
    let (hits, dense) = search::symptom_search_with(
        pack,
        nz(&p.text),
        &p.observations,
        equip.as_deref(),
        h.embedder(pack),
        p.k.unwrap_or(10),
        &ranking,
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
    let mut thresholds = ranking;
    thresholds.dense_active = dense;
    Ok(SymptomSearch {
        thresholds,
        confidence: hits
            .first()
            .map_or(search::Confidence::None, |h| h.confidence),
        hits,
        dense,
        equip_id: equip,
        signals,
    })
}

fn signal_match(h: &Host, _who: Option<&Principal>, p: SignalMatchParams) -> R<SignalMatch> {
    let pack = &h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let values = h.records().attr_values(nz(&p.asset_id))?;
    Ok(search::signal_match_with(
        pack,
        &p.observations,
        equip.as_deref(),
        &values,
    )?)
}

fn signal_decode(h: &Host, _who: Option<&Principal>, p: SignalDecodeParams) -> R<SignalDecode> {
    let pack = &h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let decoded = crate::decode::decode(p.format, &p.input, nz(&p.signal_kind));
    let matched = search::signal_match(pack, &decoded.observations, equip.as_deref())?;
    Ok(SignalDecode { decoded, matched })
}

fn tree_list(h: &Host, _who: Option<&Principal>, p: TreeListParams) -> R<Vec<FaultTree>> {
    let pack = &h.pack(nz(&p.pack_id))?;
    Ok(pack
        .fault_trees(nz(&p.equip_id))?
        .into_iter()
        .filter(|t| nz(&p.system).is_none_or(|s| t.system.as_deref() == Some(s)))
        .collect())
}

fn tree_get(h: &Host, _who: Option<&Principal>, p: TreeGetParams) -> R<Tree> {
    let pack = &h.pack(nz(&p.pack_id))?;
    Ok(pack
        .fault_tree(&p.tree_id)?
        .ok_or_else(|| Error::Invalid(format!("no tree {:?}", p.tree_id)))?)
}

fn job_pack(h: &Host, rec: &Records, job_id: &str) -> R<Arc<Pack>> {
    let job = rec
        .job(job_id)?
        .ok_or_else(|| Error::Invalid(format!("no job {job_id:?}")))?;
    Ok(h.pack(Some(&job.pack_id))?)
}

fn job_start(h: &Host, _who: Option<&Principal>, p: JobStartParams) -> R<JobView> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn job_get(h: &Host, _who: Option<&Principal>, p: JobGetParams) -> R<JobView> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
    Ok(rec.job_view(pack, &p.job_id, nz(&p.level))?)
}

fn job_answer(h: &Host, _who: Option<&Principal>, p: JobAnswerParams) -> R<JobView> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
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

fn job_back(h: &Host, _who: Option<&Principal>, p: JobIdParams) -> R<JobView> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
    rec.back_job(pack, &p.job_id)?;
    Ok(rec.job_view(pack, &p.job_id, None)?)
}

fn job_follow(h: &Host, _who: Option<&Principal>, p: JobIdParams) -> R<JobView> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
    rec.follow_job(pack, &p.job_id)?;
    Ok(rec.job_view(pack, &p.job_id, None)?)
}

fn job_close(h: &Host, _who: Option<&Principal>, p: JobCloseParams) -> R<JobClosed> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
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

fn job_list(h: &Host, _who: Option<&Principal>, p: JobListParams) -> R<Vec<JobSummary>> {
    let mut jobs = h.records().jobs(nz(&p.asset_id), nz(&p.status))?;
    let mut titles: BTreeMap<(String, String), String> = BTreeMap::new();
    for pack in &h.packs() {
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

fn job_report(h: &Host, _who: Option<&Principal>, p: JobIdParams) -> R<JobReport> {
    let rec = h.records();
    let pack = &job_pack(h, &rec, &p.job_id)?;
    Ok(rec.job_report(pack, &p.job_id)?)
}

fn task_list(h: &Host, _who: Option<&Principal>, p: TaskListParams) -> R<Vec<TaskSummary>> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn task_get(h: &Host, _who: Option<&Principal>, p: TaskGetParams) -> R<TaskView> {
    let pack = &h.pack(nz(&p.pack_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let values = h.records().attr_values(nz(&p.asset_id))?;
    Ok(
        view::task_view(pack, &p.proc_id, equip.as_deref(), &values)?
            .ok_or_else(|| Error::Invalid(format!("no task {:?}", p.proc_id)))?,
    )
}

fn run_pack(h: &Host, rec: &Records, run_id: &str) -> R<Arc<Pack>> {
    let run = rec
        .run(run_id)?
        .ok_or_else(|| Error::Invalid(format!("no run {run_id:?}")))?;
    Ok(h.pack(Some(&run.pack_id))?)
}

fn run_start(h: &Host, _who: Option<&Principal>, p: RunStartParams) -> R<Run> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn run_record(h: &Host, _who: Option<&Principal>, p: RunRecordParams) -> R<StepOutcome> {
    let rec = h.records();
    let pack = &run_pack(h, &rec, &p.run_id)?;
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

fn run_finish(h: &Host, _who: Option<&Principal>, p: RunIdParams) -> R<Run> {
    let rec = h.records();
    let pack = &run_pack(h, &rec, &p.run_id)?;
    Ok(rec.finish_run(pack, &p.run_id)?)
}

fn run_abandon(h: &Host, _who: Option<&Principal>, p: RunIdParams) -> R<Run> {
    let rec = h.records();
    let pack = &run_pack(h, &rec, &p.run_id)?;
    Ok(rec.abandon_run(pack, &p.run_id)?)
}

fn run_report(h: &Host, _who: Option<&Principal>, p: RunIdParams) -> R<RunReport> {
    let rec = h.records();
    let pack = &run_pack(h, &rec, &p.run_id)?;
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

fn manual_section(h: &Host, _who: Option<&Principal>, p: SectionParams) -> R<SectionView> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn manual_children(h: &Host, _who: Option<&Principal>, p: ChildrenParams) -> R<Vec<SectionRef>> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn manual_search(h: &Host, _who: Option<&Principal>, p: ManualSearchParams) -> R<ManualSearch> {
    let pack = &h.pack(nz(&p.pack_id))?;
    let values = h.records().attr_values(nz(&p.asset_id))?;
    let equip = equip_for(h, &p.equip_id, &p.asset_id)?;
    let mut r = crate::retrieval::Retriever::new(pack);
    r.embedder = h.embedder(pack);
    let result = r.search(
        &p.query,
        &SearchOptions {
            k: p.k.unwrap_or(10),
            equip: equip.clone(),
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
        let mut row = None;
        let applicability = match hit.ref_kind.as_str() {
            "ref_row" => match pack.ref_row(&hit.ref_id)? {
                Some(r) => {
                    match crate::maint::table::row_view(pack, &r, equip.as_deref(), &values)? {
                        Some(v) => {
                            let a = v.applicability.clone();
                            row = Some(v);
                            a
                        }
                        None => continue, // the row does not apply
                    }
                }
                None => continue, // a row that did not pass is not shown
            },
            // Steps, questions and the rest: their own statements and their
            // section's.
            kind @ ("proc_step" | "question" | "procedure") => pack.applicability_with_section(
                kind,
                &hit.ref_id,
                hit.section_id.as_deref(),
                &values,
            )?,
            _ => match &hit.section_id {
                Some(s) => pack.applicability("section", s, &values)?,
                None => None,
            },
        };
        if !crate::maint::applic::Applicability::shown(&applicability) {
            continue;
        }
        hits.push(ManualHit {
            row,
            applicability,
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

fn ask(h: &Host, _who: Option<&Principal>, p: AskParams) -> R<AskResponse> {
    let pack = &h.pack(nz(&p.pack_id))?;
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

fn lesson_create(h: &Host, _who: Option<&Principal>, p: LessonCreateParams) -> R<Lesson> {
    let rec = h.records();
    let pack = match nz(&p.pack_id) {
        Some(id) => Some(h.pack(Some(id))?),
        None => match p.lesson.job_id.as_deref() {
            Some(j) => Some(job_pack(h, &rec, j)?),
            None => h.pack(None).ok(),
        },
    };
    Ok(rec.create_lesson(pack.as_deref(), p.lesson)?)
}

fn lesson_list(h: &Host, _who: Option<&Principal>, p: LessonFilter) -> R<Vec<Lesson>> {
    Ok(h.records().lessons(&p)?)
}

fn field_install(h: &Host, _who: Option<&Principal>, p: FieldInstallParams) -> R<FieldInstall> {
    if h.field_keys.is_empty() {
        return Err(Error::Signature("no trusted key for field-note bundles".into()).into());
    }
    Ok(h.records().install_field_bundle(&p.bundle, &h.field_keys)?)
}

fn field_list(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<Vec<FieldNote>> {
    Ok(h.records().field_notes()?)
}

fn sync_status(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<SyncStatus> {
    let rec = h.records();
    let state = rec.sync_state()?;
    let destination = if h.hub_link.is_some() {
        Some("hub".to_string())
    } else {
        h.outbox_dir.as_ref().map(|_| "folder".to_string())
    };
    Ok(SyncStatus {
        outbox: rec.outbox_status()?,
        last_synced_at: state.last_synced_at,
        hub: HubState {
            configured: destination.is_some(),
            destination,
            reachable: state.reachable,
            refused: state.refused,
            backoff_until: state.backoff_until,
            last_attempt_at: state.last_attempt_at,
            last_error: state.last_error,
        },
        attachments: rec.attachment_status()?,
    })
}

fn sync_attachments(
    h: &Host,
    _who: Option<&Principal>,
    p: SyncAttachmentsParams,
) -> R<crate::records::AttachReport> {
    let link = h
        .hub_link
        .as_ref()
        .ok_or_else(|| Error::Invalid("no hub is configured".into()))?;
    let secs = p.max_seconds.unwrap_or(10).clamp(1, 300);
    let until = std::time::Instant::now() + std::time::Duration::from_secs(secs);
    // The store is locked per read or write, not for the whole pass.
    Ok(crate::records::send_attachments_shared(
        &|f| f(&h.records()),
        link.as_ref(),
        &h.field_keys,
        &|| std::time::Instant::now() >= until,
    )?)
}

fn sync_flush(
    h: &Host,
    _who: Option<&Principal>,
    p: SyncFlushParams,
) -> R<crate::records::HubFlush> {
    if let Some(link) = &h.hub_link {
        return Ok(h
            .records()
            .flush_to_hub(link.as_ref(), &h.field_keys, 50, p.force)?);
    }
    let dir = h
        .outbox_dir
        .as_ref()
        .ok_or_else(|| Error::Sync("no upload destination is configured on this device".into()))?;
    Ok(crate::records::HubFlush {
        hello: None,
        flush: Some(
            h.records()
                .flush(&crate::sync::DirTransport::new(dir), 50)?,
        ),
        skipped_until: None,
        error: None,
    })
}

fn device_info(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<DeviceInfo> {
    Ok(DeviceInfo {
        device_id: h.hub_link.as_ref().map(|l| l.device_id()),
        public_key: h.hub_link.as_ref().map(|l| l.public_key()),
    })
}

fn sync_pull(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<SyncPull> {
    let link = h
        .hub_link
        .as_ref()
        .ok_or_else(|| Error::Sync("no hub is configured on this device".into()))?;
    if h.field_keys.is_empty() {
        return Err(Error::Signature("no trusted key for field-note bundles".into()).into());
    }
    let bundles = h.records().pull(link.as_ref(), &h.field_keys)?;
    let mut packs = Vec::new();
    let mut pack_errors = Vec::new();
    if let Some(root) = &h.packs_root {
        for pack in h.packs() {
            let offer = match link.pack_offer(pack.pack_id(), Some(pack.version())) {
                Ok(Some(o)) => o,
                Ok(None) => continue,
                Err(e) => {
                    pack_errors.push(format!("{}: {e}", pack.pack_id()));
                    continue;
                }
            };
            let installed = crate::sync::install_offer(root, link.as_ref(), &offer, &h.pack_keys)
                .and_then(|i| {
                    let p = Pack::open(&i.dir, &h.pack_keys)?;
                    Ok((i, p))
                });
            match installed {
                Ok((i, p)) => {
                    packs.push(PackUpdate {
                        pack_id: i.pack_id,
                        from: pack.version().to_string(),
                        to: i.version,
                        kind: offer.kind.clone(),
                        bytes: offer.bytes,
                    });
                    h.replace_pack(Arc::new(p));
                }
                Err(e) => pack_errors.push(format!("{} {}: {e}", offer.pack_id, offer.version)),
            }
        }
    }
    Ok(SyncPull {
        bundles,
        packs,
        pack_errors,
    })
}

fn lesson_update(h: &Host, _who: Option<&Principal>, p: LessonUpdateParams) -> R<Lesson> {
    let pack = optional_pack(h, &p.pack_id)?;
    Ok(h.records()
        .update_lesson(pack.as_deref(), &p.lesson_id, p.lesson)?)
}

fn fleet_summary(
    h: &Host,
    _who: Option<&Principal>,
    _: NoParams,
) -> R<Option<crate::records::FleetSummary>> {
    Ok(h.records().fleet_summary()?)
}

/// The principal, who must hold `role` (any identified person when `None`).
fn need(who: Option<&Principal>, role: Option<HubRole>) -> R<&Principal> {
    let p = who.ok_or_else(|| ApiError {
        code: "unauthenticated".into(),
        message: "hub methods need an identified person".into(),
    })?;
    if let Some(r) = role
        && !p.has(r)
    {
        return Err(ApiError {
            code: "forbidden".into(),
            message: format!("{} does not hold the {r:?} role", p.name).to_lowercase(),
        });
    }
    Ok(p)
}

fn hub_status(h: &Host, who: Option<&Principal>, _: NoParams) -> R<crate::hub::HubStatus> {
    need(who, None)?;
    Ok(h.hub_store()?.status()?)
}

fn scope(
    h: &Host,
    equip: &Option<String>,
    asset: &Option<String>,
) -> R<(Option<String>, crate::maint::applic::AttrValues)> {
    let e = equip_for(h, equip, asset)?;
    let v = h.records().attr_values(nz(asset))?;
    Ok((e, v))
}

fn table_list(
    h: &Host,
    _who: Option<&Principal>,
    p: ScopeParams,
) -> R<Vec<crate::maint::table::TableSummary>> {
    let pack = h.pack(nz(&p.pack_id))?;
    let (equip, values) = scope(h, &p.equip_id, &p.asset_id)?;
    let mut out = Vec::new();
    for t in pack.ref_tables()? {
        let v = crate::maint::table::table_view(&pack, &t.table_id, equip.as_deref(), &values)?;
        out.push(crate::maint::table::TableSummary {
            rows: v.map_or(0, |v| v.rows.len()),
            table: t,
        });
    }
    Ok(out)
}

fn table_get(
    h: &Host,
    _who: Option<&Principal>,
    p: TableGetParams,
) -> R<crate::maint::table::TableView> {
    let pack = h.pack(nz(&p.pack_id))?;
    let (equip, values) = scope(h, &p.equip_id, &p.asset_id)?;
    Ok(
        crate::maint::table::table_view(&pack, &p.table_id, equip.as_deref(), &values)?
            .ok_or_else(|| Error::Invalid(format!("no table {:?}", p.table_id)))?,
    )
}

fn table_lookup(
    h: &Host,
    _who: Option<&Principal>,
    p: TableLookupParams,
) -> R<Vec<crate::maint::table::RowHit>> {
    let pack = h.pack(nz(&p.pack_id))?;
    let (equip, values) = scope(h, &p.equip_id, &p.asset_id)?;
    Ok(crate::maint::table::lookup(
        &pack,
        nz(&p.table_id),
        nz(&p.key),
        nz(&p.query),
        equip.as_deref(),
        &values,
        p.k.unwrap_or(10),
    )?)
}

fn asset_attrs(h: &Host, _who: Option<&Principal>, p: AssetAttrsParams) -> R<AssetAttrs> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(AssetAttrs {
        declared: pack.attribute_defs()?,
        values: h.records().asset_attrs(&p.asset_id)?,
    })
}

fn asset_set_attrs(h: &Host, _who: Option<&Principal>, p: AssetSetAttrsParams) -> R<AssetAttrs> {
    use crate::maint::applic::AttrSource;
    use crate::records::ValueSource;
    let pack = h.pack(nz(&p.pack_id))?;
    let defs = pack.attribute_defs()?;
    // Values taken from a plate are the plate's unless the host says the
    // vehicle sent them.
    let source = p.source.unwrap_or(if p.plate.is_some() {
        ValueSource::Plate
    } else {
        ValueSource::Typed
    });
    let mut values = p.values.clone();
    if let Some(plate) = &p.plate {
        let from = match source {
            ValueSource::Vehicle => AttrSource::Vehicle,
            _ => AttrSource::Plate,
        };
        for (k, v) in crate::records::plate_values(&defs, plate, from) {
            values.entry(k).or_insert(Some(v));
        }
    }
    let rec = h.records();
    rec.set_asset_attrs(&p.asset_id, &values, source, Some(&defs))?;
    Ok(AssetAttrs {
        declared: defs,
        values: rec.asset_attrs(&p.asset_id)?,
    })
}

fn practice_items(
    h: &Host,
    _who: Option<&Principal>,
    p: PracticeItemsParams,
) -> R<crate::practice::PracticeItems> {
    let pack = h.pack(nz(&p.pack_id))?;
    let (equip, values) = scope(h, &p.equip_id, &p.asset_id)?;
    Ok(crate::practice::items(&pack, equip.as_deref(), &values)?)
}

fn practice_record(
    h: &Host,
    _who: Option<&Principal>,
    p: PracticeRecordParams,
) -> R<crate::records::PracticeAttempt> {
    let pack = h.pack(nz(&p.pack_id))?;
    let input = crate::records::PracticeInput {
        q_id: p.q_id,
        chosen: p.chosen,
        correct: p.correct,
        ms: p.ms,
        at: p.at,
    };
    Ok(h.records().record_practice(&pack, &input)?)
}

fn practice_history(
    h: &Host,
    _who: Option<&Principal>,
    p: PackParams,
) -> R<Vec<crate::records::PracticeAttempt>> {
    let pack = h.pack(nz(&p.pack_id))?;
    Ok(h.records().practice_history(pack.pack_id())?)
}

fn hub_practice(
    h: &Host,
    who: Option<&Principal>,
    p: HubPracticeParams,
) -> R<crate::hub::PracticeExport> {
    need(who, None)?;
    Ok(h.hub_store()?
        .practice_statements(p.since, p.limit.unwrap_or(500).clamp(1, 5000))?)
}

fn hub_queue(
    h: &Host,
    who: Option<&Principal>,
    p: HubQueueParams,
) -> R<Vec<crate::hub::ReviewItem>> {
    need(who, None)?;
    Ok(page(
        h.hub_store()?.queue(nz(&p.status))?,
        p.offset,
        p.limit,
    ))
}

fn hub_approve(
    h: &Host,
    who: Option<&Principal>,
    p: HubApproveParams,
) -> R<crate::records::FieldNoteIn> {
    let who = need(who, Some(HubRole::Reviewer))?;
    Ok(h.hub_store()?.approve(
        &p.lesson_id,
        &who.name,
        p.edit,
        p.note.as_deref(),
        p.version.as_deref(),
    )?)
}

fn hub_reject(h: &Host, who: Option<&Principal>, p: HubRejectParams) -> R<crate::hub::HubStatus> {
    let who = need(who, Some(HubRole::Reviewer))?;
    let hub = h.hub_store()?;
    hub.reject(&p.lesson_id, &who.name, p.reason.as_deref())?;
    Ok(hub.status()?)
}

fn hub_publish(h: &Host, who: Option<&Principal>, p: HubPublishParams) -> R<Option<Value>> {
    let who = need(who, Some(HubRole::Publisher))?;
    Ok(h.hub_store()?.publish(p.always, &who.name)?)
}

fn hub_bundles(h: &Host, who: Option<&Principal>, p: HubBundlesParams) -> R<Vec<Value>> {
    need(who, None)?;
    Ok(h.hub_store()?
        .bundles_page(p.since, p.limit.unwrap_or(50).clamp(1, 200))?)
}

fn hub_fleet(h: &Host, who: Option<&Principal>, _: NoParams) -> R<crate::records::FleetSummary> {
    need(who, None)?;
    Ok(h.hub_store()?.fleet()?)
}

fn hub_conflicts(h: &Host, who: Option<&Principal>, p: PageParams) -> R<Vec<crate::hub::Conflict>> {
    need(who, None)?;
    Ok(page(h.hub_store()?.conflicts()?, p.offset, p.limit))
}

fn hub_devices(
    h: &Host,
    who: Option<&Principal>,
    p: PageParams,
) -> R<Vec<crate::hub::EnrolledDevice>> {
    need(who, None)?;
    Ok(page(h.hub_store()?.devices()?, p.offset, p.limit))
}

fn hub_enroll(
    h: &Host,
    who: Option<&Principal>,
    p: HubEnrollParams,
) -> R<crate::hub::EnrolledDevice> {
    let who = need(who, Some(HubRole::Admin))?;
    Ok(h.hub_store()?
        .enroll(&p.public_key, p.name.as_deref(), &who.name)?)
}

fn hub_revoke(
    h: &Host,
    who: Option<&Principal>,
    p: HubRevokeParams,
) -> R<crate::hub::EnrolledDevice> {
    let who = need(who, Some(HubRole::Admin))?;
    Ok(h.hub_store()?
        .revoke(&p.device_id, &who.name, p.reason.as_deref())?)
}

fn hub_whoami(_h: &Host, who: Option<&Principal>, _: NoParams) -> R<Principal> {
    Ok(need(who, None)?.clone())
}

fn hub_audit(h: &Host, who: Option<&Principal>, p: AuditListParams) -> R<Vec<AuditRecord>> {
    need(who, None)?;

    let all = h.hub_store()?.audit_records()?;
    let after = p.after_seq.unwrap_or(0);
    Ok(all
        .into_iter()
        .filter(|r| match r {
            AuditRecord::Answer { seq, .. } | AuditRecord::Event { seq, .. } => *seq > after,
        })
        .take(p.limit.unwrap_or(200).clamp(1, 1000))
        .collect())
}

fn audit_list(h: &Host, _who: Option<&Principal>, p: AuditListParams) -> R<Vec<AuditRecord>> {
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

fn audit_verify(h: &Host, _who: Option<&Principal>, _: NoParams) -> R<ChainReport> {
    Ok(h.records().verify_audit()?)
}

// Keep the records module's public names reachable from here for hosts.
pub use records::{FieldBundle, LessonStatus, NoteScope};
