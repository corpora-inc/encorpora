// Generated from harvest/api/api.schema.json by harvest-core (`harvest api-schema`).
// Do not edit: change the Rust types and regenerate.

export const API_VERSION = "harvest-api/1" as const;

/** An API error: a stable code and a message for the technician's screen. */
export interface ApiError {
  /**
   * `bad_params` | `unknown_method` | `invalid` | `pack` | `signature` |
   * `integrity` | `crypto` | `sync` | `internal`.
   */
  code: string;
  message: string;
}

export interface AskParams {
  equip_id?: string | null;
  /** A level of the pack; the first when absent. */
  level?: string | null;
  pack_id?: string | null;
  question: string;
  scope?: Scope | null;
}

/** The `ask --json` object of CONTRACT. */
export interface AskResponse {
  answer_id: string | null;
  body: Segment[];
  check: Check;
  citations: string[];
  elapsed_ms: number;
  mode: Mode;
  model: string | null;
  nearest: string[];
  pack_version: string;
  retrieved: Retrieved[];
  /** The deterministic gate's view of the question (all modes). */
  support: Support;
  /**
   * The deterministic tool that answered first, if any
   * (`range_table:<section_id>`).
   */
  tool?: string | null;
}

/** A physical unit. */
export interface Asset {
  asset_id: string;
  attrs: Record<string, unknown>;
  created_at: string;
  equip_id: string | null;
  hours: number | null;
  miles: number | null;
  name: string | null;
  serial: string | null;
  updated_at: string;
}

export interface AssetCreateParams {
  asset: AssetInput;
  /** The pack whose equipment ids are checked. */
  pack_id?: string | null;
}

/** A registry event as stored. */
export interface AssetEvent {
  asset_id: string;
  date: string;
  symptom_id: string | null;
  system: string | null;
  text: string | null;
  tree_id: string | null;
}

/** A past maintenance event from the fleet registry. */
export interface AssetEventInput {
  /** `YYYY-MM-DD` or an RFC 3339 time. */
  date: string;
  symptom_id?: string | null;
  system?: string | null;
  text?: string | null;
  tree_id?: string | null;
}

/**
 * An asset's history: its own jobs and registry events, the pack's fleet
 * history and failure modes for its variant, and the repeat flag.
 */
export interface AssetHistory {
  asset: Asset;
  events: AssetEvent[];
  failure_modes: FailureMode[];
  fleet_history: HistoryEvent[];
  /** Newest first. */
  jobs: HistoryJob[];
  /** True when the newest job repeats an earlier one within the window. */
  repeat: boolean;
}

export interface AssetHistoryParams {
  asset_id: string;
  pack_id?: string | null;
}

export interface AssetIdParams {
  asset_id: string;
}

export interface AssetImportParams {
  pack_id?: string | null;
  registry: AssetRegistry;
}

/** A physical unit, as entered or imported. */
export interface AssetInput {
  /** The fleet's own id (unit number). Generated when absent. */
  asset_id?: string | null;
  attrs?: Record<string, unknown>;
  equip_id?: string | null;
  hours?: number | null;
  miles?: number | null;
  name?: string | null;
  serial?: string | null;
}

/** An asset registry file (`harvest-assets/1`), to preload a fleet. */
export interface AssetRegistry {
  assets: RegistryAsset[];
  format: string;
}

export interface AssetUpdateParams {
  asset_id: string;
  /** Fields given replace the stored ones; `attrs` merge. */
  changes: AssetInput;
  pack_id?: string | null;
}

/** One retrieved chunk as the log keeps it. */
export interface AuditChunk {
  chunk_id: string;
  dense: number;
  lexical: number;
  score: number;
}

/** What one query did. */
export interface AuditEntry {
  answer_id: string | null;
  chunks: AuditChunk[];
  citations: string[];
  dropped: number;
  elapsed_ms: number;
  expansions: string[];
  mode: Mode;
  model: string | null;
  normalized: string;
  pack_id: string;
  pack_version: string;
  query: string;
  ts: string;
  /**
   * `supported` | `partially_supported` (the checker dropped segments) |
   * `declined` | `clarify`.
   */
  verdict: string;
}

/**
 * One recorded action that is not a question: a troubleshooting job's
 * start, answer, correction and close, a lesson, a field-note install.
 * It chains like an answer entry.
 */
export interface AuditEvent {
  /** What was asked there: the node's verbatim text. */
  asked: string | null;
  detail: unknown;
  /** `job.start` | `job.answer` | `job.back` | `job.close` | `lesson.create` | `field.install` | …. */
  event: string;
  /** Where code sent the job next. */
  next_node: string | null;
  /** The node the job was at. */
  node_id: string | null;
  pack_id: string | null;
  pack_version: string | null;
  /** What was recorded. */
  result: unknown;
  /** What the event is about (a job id, a lesson id, a bundle stream). */
  subject: string;
  ts: string;
}

export interface AuditListParams {
  /** Only entries after this sequence number. */
  after_seq?: number | null;
  /** At most this many (default 200). */
  limit?: number | null;
}

/** One row of the log, as read back. */
export type AuditRecord = {
  entry: AuditEntry;
  seq: number;
  type: "answer";
} | {
  event: AuditEvent;
  seq: number;
  type: "event";
};

/** What a deficiency rests on (CONTRACT "Procedure step deficiency"). */
export type Basis = "rule" | "practice";

/** A branch the technician can take, as code will take it. */
export interface Branch {
  cond: Cond | null;
  label: string;
  /**
   * The outcome to send for a categorical branch (`yes`, `fail`, an
   * option, `done`); `None` for a measured value.
   */
  outcome: string | null;
  retry: boolean;
  to_node: string;
}

/** A variant the observation points at. */
export interface Candidate {
  /** Rules of this variant the observation contradicts (a rejected one). */
  contradicted: IdentMatch[];
  equip_id: string;
  matched: IdentMatch[];
  name: string;
}

/** The result of [`verify_chain`]. */
export interface ChainReport {
  /** `baked / (all answers)`; `None` with no answers. */
  bake_hit_rate: number | null;
  entries: number;
  /** Events (not answers) per event name. */
  events: Record<string, number>;
  /** The first sequence number whose hash or link is wrong. */
  first_bad: number | null;
  /**
   * The hash of the newest entry. The chain detects edits but cannot see
   * its own newest rows removed: a host that needs that anchors
   * `(entries, head_hash)` outside the database (an upload, a signature).
   */
  head_hash: string | null;
  /** Answers per mode (`sealed` counts entries read without the key). */
  modes: Record<string, number>;
  ok: boolean;
}

/** The `check` object of CONTRACT's `ask --json`. */
export interface Check {
  /** Every cite in the input named an existing section. */
  cites_ok: boolean;
  /** Segments removed (bad quotes, bad cites, unsupported claims). */
  dropped: number;
  /** Every quote in the input was verbatim and named an existing section. */
  quotes_ok: boolean;
}

export interface ChildrenParams {
  equip_id?: string | null;
  pack_id?: string | null;
  /** The parent; the manual's top level when absent. */
  section_id?: string | null;
}

/**
 * A citation down to the page: manual, edition, the section path
 * (chapter, paragraph …), page and figure.
 */
export interface Citation {
  citation: string;
  edition: string;
  figure_label: string | null;
  heading: string | null;
  page_index: number | null;
  page_label: string | null;
  /** Root first, ending with this section. */
  path: CitePart[];
  publisher: string;
  section_id: string;
  source_id: string;
  source_title: string;
}

/** One level of a citation path. */
export interface CitePart {
  citation: string;
  heading: string | null;
  section_id: string;
}

/**
 * A numeric predicate over a measured value (`fault_edge.cond`):
 * `{"op":"<","value":11.5}` or `{"op":"between","min":11.5,"max":13}`.
 */
export interface Cond {
  max: number | null;
  min: number | null;
  op: CondOp;
  value: number | null;
}

/** A numeric comparison operator. */
export type CondOp = "<" | "<=" | ">" | ">=" | "==" | "between";

/** Why the dense half did or did not run. */
export type DenseStatus = "used" | "no_embedder" | {
  mismatch: {
    embedder: string;
    pack: string | null;
  };
} | "no_vectors";

/** How a job was entered. */
export type EntryKind = "symptom" | "signals" | "chosen";

/** Where the signals suggest starting. */
export interface EntryPoint {
  /** The node to start at (the tree's entry when the rule names none). */
  node_id: string;
  tree_id: string;
}

export interface EquipResolveParams {
  firmware?: string | null;
  model?: string | null;
  pack_id?: string | null;
  params?: Record<string, string>;
  serial?: string | null;
  text?: string | null;
}

/** A variant with its inherited attributes. */
export interface EquipView {
  aliases: string[];
  attrs: Record<string, string>;
  equip_id: string;
  name: string;
  parent_id: string | null;
}

/** An equipment variant. */
export interface Equipment {
  aliases: string[];
  equip_id: string;
  name: string;
  parent_id: string | null;
}

/** How a result is recorded at a node (`fault_node.expect`). */
export type Expect = {
  kind: "yes_no";
} | {
  kind: "pass_fail";
} | {
  kind: "choice";
  options: string[];
} | {
  kind: "value";
  max: number | null;
  min: number | null;
  unit: string;
} | {
  kind: "ack";
};

/**
 * One verbatim facet text of a node (`reason`, `known`, `possible`,
 * `test_option`, …: the pack names them; the core treats them as opaque).
 */
export interface Facet {
  facet: string;
  node_id: string;
  ord: number;
  section_id: string;
  text: string;
}

/**
 * A node's facet (`reason`, `known`, `possible`, `test_option`, …), in
 * order, and whether the level opens it.
 */
export interface FacetGroup {
  expanded: boolean;
  facet: string;
  texts: FacetText[];
}

/** One verbatim facet text. */
export interface FacetText {
  section_id: string;
  text: string;
}

/** How a variant fails across the fleet. */
export interface FailureMode {
  count: number;
  equip_id: string;
  examples: string[];
  mode_id: string;
  share: number | null;
  system: string | null;
  title: string;
  tree_id: string | null;
}

/** One branch out of a node, chosen by code from the recorded result. */
export interface FaultEdge {
  /** A numeric predicate; `None` matches by label equality. */
  cond: Cond | null;
  from_node: string;
  label: string;
  ord: number;
  /** An explicit loop back (re-test after an adjustment). */
  retry: boolean;
  to_node: string;
}

/** One node of a tree. `text` is the manual's own words. */
export interface FaultNode {
  applies_to: string[];
  expect: Expect | null;
  kind: NodeKind;
  node_id: string;
  /** The procedure whose steps tell how to answer this node's question. */
  proc_id: string | null;
  section_id: string;
  target: Target | null;
  text: string;
  tree_id: string;
}

/** A troubleshooting tree. */
export interface FaultTree {
  /** Equipment the tree is limited to (empty: all). */
  applies_to: string[];
  entry_node: string;
  lang: string;
  section_ids: string[];
  system: string | null;
  title: string;
  tree_id: string;
}

/** What installing a bundle did. */
export interface FieldInstall {
  installed: number;
  reviews: number;
  revoked: number;
  seq: number;
  stream: string;
  superseded: number;
}

export interface FieldInstallParams {
  /** The signed bundle (`harvest-field/1`) as received. */
  bundle: unknown;
}

/** A field note as stored and shown: field knowledge, never manual text. */
export interface FieldNote {
  approved_at: string;
  approver: string;
  counts: NoteCounts;
  note_id: string;
  received_at: string;
  scope: NoteScope;
  seq: number;
  /** Always `field`: the host shows it apart from the manual. */
  source: string;
  stream: string;
  supersedes: string | null;
  text: string;
}

/** What one [`flush`] did. */
export interface FlushReport {
  acked: number;
  /** The transport's error, when a batch failed. */
  error: string | null;
  /** Receipts that named no item of the batch or the wrong hash. */
  rejected_receipts: number;
  remaining: number;
  sent: number;
}

/** Whether a test procedure opens expanded or collapsed at a level. */
export type Fold = "expanded" | "collapsed";

/** What was checked. */
export interface GraphCounts {
  assets: number;
  edges: number;
  facets: number;
  guards: number;
  nodes: number;
  requirements: number;
  signals: number;
  symptoms: number;
  trees: number;
}

/** The validation report. */
export interface GraphReport {
  counts: GraphCounts;
  ok: boolean;
  violations: Violation[];
}

/** A warning, caution or note, verbatim. */
export interface Guard {
  applies_to: string[];
  citation: Citation;
  heading: string | null;
  /** `warning` | `caution` | `note`. */
  kind: string;
  section_id: string;
  text: string;
}

/** What to do when a step fails, and the rule behind it when there is one. */
export interface Guidance {
  action: string | null;
  /**
   * `rule` or `practice`. A pack row without it is a rule when it cites a
   * section and practice when it does not; the reader always fills it in.
   */
  basis: Basis | null;
  citation: string | null;
  guidance: string;
  quote: string | null;
  quote_verified: boolean;
  section_id: string | null;
}

/** A fleet history event baked in the pack. */
export interface HistoryEvent {
  attrs: unknown;
  date: string;
  equip_id: string;
  event_id: string;
  source_id: string | null;
  system: string | null;
  text: string;
}

/** A job in an asset's history, with its own repeat flag. */
export interface HistoryJob {
  asset_id: string | null;
  closed_at: string | null;
  current_node: string;
  equip_id: string | null;
  job_id: string;
  opened_at: string;
  repeat: RepeatFlag;
  resolution: ResolutionKind | null;
  status: string;
  symptom_id: string | null;
  system: string | null;
  tree_id: string;
}

/**
 * One retrieved chunk. `lexical` is the BM25 score (higher is better, 0 when
 * the lexical list missed it), `dense` the cosine (0 when not compared),
 * `score` the fused (or reranked) score the list is sorted by.
 */
export interface Hit {
  chunk_id: string;
  dense: number;
  lexical: number;
  ref_id: string;
  ref_kind: string;
  score: number;
  section_id?: string | null;
}

/** One rule that matched. */
export interface IdentMatch {
  kind: string;
  observed: string;
  pattern: string;
}

/** What an import did. */
export interface ImportReport {
  created: number;
  events: number;
  updated: number;
}

/** One troubleshooting session on an asset. */
export interface Job {
  asset_id: string | null;
  closed_at: string | null;
  current_node: string;
  entered_by: EntryKind;
  entry_node: string;
  equip_id: string | null;
  job_id: string;
  level: string;
  opened_at: string;
  pack_id: string;
  pack_version: string;
  query: string | null;
  resolution: Resolution | null;
  signals: Observation[];
  /** `open` | `closed`. */
  status: string;
  /** Every recorded step, superseded ones included, in order. */
  steps: JobStep[];
  symptom_id: string | null;
  system: string | null;
  tree_id: string;
}

/** Record the result at the job's current node. */
export interface JobAnswerParams {
  job_id: string;
  /** The node answered: must be the job's current node. */
  node_id: string;
  note?: string | null;
  /** `yes` | `no` | `pass` | `fail` | a choice option | `done`. */
  outcome?: string | null;
  photos?: PhotoRef[];
  unit?: string | null;
  value?: number | null;
}

export interface JobCloseParams {
  job_id: string;
  lesson?: LessonInput | null;
  note?: string | null;
  resolution: ResolutionKind;
}

export interface JobClosed {
  job: Job;
  lesson: Lesson | null;
}

export interface JobGetParams {
  job_id: string;
  /** Show the step at another level than the job's. */
  level?: string | null;
}

export interface JobIdParams {
  job_id: string;
}

export interface JobListParams {
  asset_id?: string | null;
  /** `open` | `closed`. */
  status?: string | null;
}

/** The job as uploaded (`harvest-job/1`). */
export interface JobReport {
  asset_id: string | null;
  closed_at: string | null;
  entered_by: EntryKind;
  entry_node: string;
  equip_id: string | null;
  format: string;
  job_id: string;
  lesson_ids: string[];
  level: string;
  opened_at: string;
  pack_id: string;
  pack_version: string;
  query: string | null;
  resolution: Resolution | null;
  serial: string | null;
  signals: Observation[];
  status: string;
  steps: ReportJobStep[];
  symptom_id: string | null;
  system: string | null;
  tree_id: string;
  /** False when the tree changed since the job began (node texts absent). */
  tree_known: boolean;
  tree_title: string | null;
}

/** Start a job: give `symptom_id`, `signals`, or `tree_id`. */
export interface JobStartParams {
  asset_id?: string | null;
  equip_id?: string | null;
  level: string;
  node_id?: string | null;
  pack_id?: string | null;
  query?: string | null;
  signals?: Observation[];
  symptom_id?: string | null;
  tree_id?: string | null;
}

/** One recorded answer. */
export interface JobStep {
  at: string;
  /** The branch code took. */
  label: string;
  next_node: string;
  node_id: string;
  note: string | null;
  outcome: string | null;
  photos: PhotoRef[];
  seq: number;
  /** When the technician went back over it (the step is kept, audited). */
  superseded_at: string | null;
  unit: string | null;
  value: number | null;
}

/** A job in a list. */
export interface JobSummary {
  asset_id: string | null;
  closed_at: string | null;
  current_node: string;
  equip_id: string | null;
  job_id: string;
  opened_at: string;
  resolution: ResolutionKind | null;
  status: string;
  symptom_id: string | null;
  system: string | null;
  tree_id: string;
}

/** A job and the screen for its current node. */
export interface JobView {
  job: Job;
  lesson_ids: string[];
  repeat: RepeatFlag;
  /** `None` when the tree changed since the job began (`tree_changed`). */
  step: StepView | null;
  tree_changed: boolean;
}

/** A captured lesson. */
export interface Lesson {
  action: string;
  asset_id: string | null;
  cause: string;
  created_at: string;
  equip_id: string | null;
  job_id: string | null;
  lesson_id: string;
  level: string | null;
  minutes: number | null;
  node_id: string | null;
  note: string | null;
  pack_id: string | null;
  pack_version: string | null;
  parts: PartUsed[];
  photos: PhotoRef[];
  review_note: string | null;
  status: LessonStatus;
  symptom_id: string | null;
  tree_id: string | null;
  updated_at: string;
}

export interface LessonCreateParams {
  lesson: LessonInput;
  pack_id?: string | null;
}

/** Which lessons to list. */
export interface LessonFilter {
  asset_id?: string | null;
  job_id?: string | null;
  tree_id?: string | null;
}

/** What fixed it, in the technician's words. */
export interface LessonInput {
  /** The corrective action. */
  action: string;
  asset_id?: string | null;
  /** The verified cause. */
  cause: string;
  equip_id?: string | null;
  /** Fills asset, equipment, tree, symptom and node when they are absent. */
  job_id?: string | null;
  /** The technician's level. */
  level?: string | null;
  minutes?: number | null;
  /** The node it applies to. */
  node_id?: string | null;
  note?: string | null;
  parts?: PartUsedInput[];
  photos?: PhotoRef[];
  /** Queue it for upload now (default) or keep it on the device. */
  submit?: boolean;
  symptom_id?: string | null;
  tree_id?: string | null;
}

/** Where a lesson is. */
export type LessonStatus = "local" | "queued" | "uploaded" | "approved" | "edited" | "rejected";

/** A depth level, from `pack_meta.levels` (ordered, most guidance first). */
export interface Level {
  /**
   * Facets shown expanded at this level; `None`: all of them. Warnings,
   * cautions and notes are not facets and are shown at every level.
   */
  facets: string[] | null;
  id: string;
  label: string;
  /** How a node's test procedure opens. */
  test_steps: Fold;
}

/** Baked detail text for a level (the section's explanation). */
export interface LevelText {
  label: string;
  level: string;
  text: string;
}

/** One search hit with its text and citation. */
export interface ManualHit {
  chunk_id: string;
  citation: string | null;
  heading: string | null;
  ref_id: string;
  ref_kind: string;
  score: number;
  section_id: string | null;
  text: string;
}

export interface ManualSearch {
  hits: ManualHit[];
  query: string;
  /** The engine's search result (scores, dense status, readings). */
  search: SearchResult;
}

export interface ManualSearchParams {
  equip_id?: string | null;
  k?: number | null;
  pack_id?: string | null;
  query: string;
  scope?: Scope | null;
}

/** How a pattern matched. */
export type MatchKind = "exact" | "glob" | "prefix" | "regex";

/** How an answer was produced. */
export type Mode = "baked" | "composed" | "declined" | "clarify";

/** No parameters. */
export type NoParams = Record<string, never>;

/** What a fault-tree node is. */
export type NodeKind = "symptom" | "check" | "action" | "goto" | "escalate" | "end";

/** Counts behind a note. */
export interface NoteCounts {
  /** … of times it was tried. */
  attempts: number | null;
  /** Times it resolved the fault … */
  resolved: number | null;
  /** Units it was seen on. */
  units: number | null;
}

/** What a field note is about: any of these; every one given must match. */
export interface NoteScope {
  equip_id: string | null;
  node_id: string | null;
  symptom_id: string | null;
  tree_id: string | null;
}

/**
 * A normalized machine observation (protocol decoding happens before
 * this): `{"signal_kind": "j1939.dm1", "value": "spn:110/fmi:0"}`,
 * `{"signal_kind": "obd2.dtc", "value": "P0217"}`.
 */
export interface Observation {
  signal_kind: string;
  value: string;
}

/** Queue counts. */
export interface OutboxStatus {
  acked: number;
  /** Pending items that have failed at least once. */
  failing: number;
  last_error: string | null;
  pending: number;
  /** Pending items per kind. */
  pending_by_kind: Record<string, number>;
  /** Items whose stored payload no longer matches its hash; never sent. */
  quarantined: number;
}

/** How a step came out. */
export type Outcome = "pass" | "fail" | "value" | "note" | "photo" | "na";

/** A file of the signed pack (a figure crop or a page image). */
export interface PackAsset {
  asset_id: string;
  bytes: number;
  height: number | null;
  media_type: string;
  /** Relative to the pack directory, listed in the signed manifest. */
  path: string;
  /** `figure` | `page` (absent when read by id). */
  role: string | null;
  sha256: string;
  width: number | null;
}

/** What a pack is and how to talk to it. */
export interface PackInfoView {
  api_version: string;
  built_at: string | null;
  corpus_id: string | null;
  equipment: Equipment[];
  has_fault_trees: boolean;
  /** Depth levels, most guidance first. */
  levels: Level[];
  pack_id: string;
  /** Every loaded pack id. */
  packs: string[];
  repeat_window_days: number;
  row_counts: Record<string, number>;
  schema_version: number;
  sources: Source[];
  /** The systems the trees cover. */
  systems: string[];
  version: string;
}

/** Which pack (the only one loaded when absent). */
export interface PackParams {
  pack_id?: string | null;
}

/** A part used. */
export interface PartUsed {
  ident: string | null;
  qty: string | null;
  text: string;
}

/** A part used. */
export interface PartUsedInput {
  ident?: string | null;
  qty?: string | null;
  text: string;
}

/** One answered step on the path, for the screen. */
export interface PathEntry {
  at: string;
  label: string;
  next_node: string;
  node_id: string;
  outcome: string | null;
  seq: number;
  text: string | null;
  unit: string | null;
  value: number | null;
}

/** A photo the host stored; the record keeps its path and hash. */
export interface PhotoRef {
  path: string;
  sha256: string;
}

/** How a query word the pack does not hold as typed was read. */
export interface Reading {
  /** The indexed words it was read as. */
  as: string[];
  /** "spelling", "split", "typo" or "join". */
  via: string;
  /** The word as typed. */
  word: string;
}

/** How to record the result here. `expect` is `None` at the end of a path. */
export interface RecordHow {
  branches: Branch[];
  expect: Expect | null;
}

/** One entry of an asset registry. */
export interface RegistryAsset {
  asset_id: string;
  attrs?: Record<string, unknown>;
  equip_id?: string | null;
  events?: AssetEventInput[];
  hours?: number | null;
  miles?: number | null;
  name?: string | null;
  serial?: string | null;
}

/**
 * Repeat discrepancy: the same asset with the same symptom or system again
 * within the pack's window.
 */
export interface RepeatFlag {
  flag: boolean;
  matches: RepeatMatch[];
  window_days: number;
}

/** Why a job (or event) counts toward a repeat discrepancy. */
export interface RepeatMatch {
  date: string;
  days_before: number;
  job_id: string | null;
  /** `job` | `event`. */
  kind: string;
  /** `same_symptom` | `same_system`. */
  reason: string;
  symptom_id: string | null;
  system: string | null;
}

/** One step of a job report. */
export interface ReportJobStep {
  at: string;
  /** The branch code took. */
  label: string;
  next_node: string;
  node_id: string;
  note: string | null;
  outcome: string | null;
  photos: PhotoRef[];
  seq: number;
  /** When the technician went back over it (the step is kept, audited). */
  superseded_at: string | null;
  text: string | null;
  unit: string | null;
  value: number | null;
}

/**
 * One step of a report: the pack's step (when known) and what was recorded
 * (`outcome` is null when the step was not recorded).
 */
export interface ReportStep {
  check_kind: string | null;
  deficiency: boolean;
  note: string | null;
  ord: number;
  outcome: Outcome | null;
  photos: PhotoRef[];
  recorded_at: string | null;
  section_ids: string[];
  structured: unknown;
  text: string | null;
  value: string | null;
}

/** What a task, tree or node needs. */
export interface Requirement {
  /** Part number, tool number or document number. */
  ident: string | null;
  /** `tool` | `part` | `consumable` | `personnel` | `condition` | `reference`. */
  kind: string;
  ord: number;
  qty: string | null;
  ref_id: string;
  ref_kind: string;
  section_id: string | null;
  text: string;
  /** True when `text` is verbatim in `section_id`'s text. */
  verbatim: boolean;
}

/** The close-out. */
export interface Resolution {
  kind: ResolutionKind;
  /** The node the job ended at. */
  node_id: string;
  note: string | null;
}

/** How a job ended. */
export type ResolutionKind = "abandoned" | "fixed" | "escalated" | "redirected" | "unresolved";

/** The outcome. */
export interface Resolved {
  /** True when more than one unrelated variant fits. */
  ambiguous: boolean;
  /** Attributes of `equip_id`, inherited from its ancestors. */
  attrs: Record<string, string>;
  /** Variants that fit, most specific first. */
  candidates: Candidate[];
  /**
   * The most specific variant, or the deepest common ancestor when the
   * evidence points at more than one; `None` when nothing matched.
   */
  equip_id: string | null;
  name: string | null;
  /** Variants a rule matched but another of its rules contradicted. */
  rejected: Candidate[];
}

/** A retrieved chunk as `ask --json` reports it. */
export interface Retrieved {
  chunk_id: string;
  dense: number;
  lexical: number;
  ref_id: string;
  score: number;
}

/** One procedure run. */
export interface Run {
  /** The specific machine (unit number, serial), as the user entered it. */
  asset: string | null;
  equip_id: string | null;
  finished_at: string | null;
  pack_id: string;
  pack_version: string;
  proc_id: string;
  role: string;
  run_id: string;
  started_at: string;
  status: string;
  steps: StepRecord[];
}

export interface RunIdParams {
  run_id: string;
}

export interface RunRecordParams {
  note?: string | null;
  ord: number;
  outcome: Outcome;
  photos?: PhotoRef[];
  run_id: string;
  structured?: unknown;
  value?: string | null;
}

/** A run as it is exported and uploaded (`harvest-run/1`). */
export interface RunReport {
  asset: string | null;
  equip_id: string | null;
  finished_at: string | null;
  format: string;
  pack_id: string;
  pack_version: string;
  proc_id: string;
  role: string;
  run_id: string;
  started_at: string;
  /** `open` | `complete` | `abandoned`. */
  status: string;
  steps: ReportStep[];
  /**
   * True when the steps come from the pack (texts, sections, every step
   * listed); false when the procedure changed and only the records are
   * known.
   */
  steps_known: boolean;
  /** The procedure's title, when the pack was at hand. */
  title: string | null;
}

export interface RunStartParams {
  /** The unit (an asset id or what the technician typed). */
  asset?: string | null;
  equip_id?: string | null;
  pack_id?: string | null;
  proc_id: string;
  /** The level (or role) the task is done at. */
  role: string;
}

/** Limit a question or a search to part of the manual. */
export interface Scope {
  proc_id?: string | null;
  /** Sections (and everything under them). */
  section_ids?: string[];
  /** Every tree of this system. */
  system?: string | null;
  tree_id?: string | null;
}

/** A search result. */
export interface SearchResult {
  dense: DenseStatus;
  expansions: string[];
  hits: Hit[];
  normalized: string;
  query: string;
  /** Query words the pack does not hold as typed, and what they were read as. */
  readings?: Reading[];
  reranker?: string | null;
}

/** One section of the corpus. */
export interface Section {
  citation: string;
  depth: number;
  heading: string | null;
  kind: string;
  lang: string;
  ord: number;
  parent_id: string | null;
  section_id: string;
  source_id: string;
  text: string;
}

/** Printed location of a section. */
export interface SectionLoc {
  figure_label: string | null;
  page_index: number | null;
  page_label: string | null;
}

export interface SectionParams {
  equip_id?: string | null;
  pack_id?: string | null;
  section_id: string;
}

/** A section in a list. */
export interface SectionRef {
  applies_to: string[];
  citation: string;
  has_children: boolean;
  heading: string | null;
  kind: string;
  section_id: string;
}

/** One section of the manual, ready to show. */
export interface SectionView {
  applies_to: string[];
  assets: PackAsset[];
  children: SectionRef[];
  citation: Citation;
  detail: LevelText[];
  guards: Guard[];
  loc: SectionLoc;
  section: Section;
}

/** One segment of an answer or lesson body. */
export type Segment = {
  t: "text";
  text: string;
} | {
  section_id: string;
  t: "quote";
  text: string;
} | {
  section_id: string;
  t: "cite";
} | {
  diagram_id: string;
  t: "diagram";
} | {
  answer: string;
  question: string;
  t: "check";
};

/** One signal rule an observation matched. */
export interface SignalHit {
  /** The rule's section citation, when it cites one. */
  citation: string | null;
  matched: MatchKind;
  observed: Observation;
  rule: SignalRule;
}

/** The result of matching observations. */
export interface SignalMatch {
  /** True when the hits lead to more than one tree. */
  ambiguous: boolean;
  /** Most specific first: exact, glob, prefix, regex; then observation order. */
  hits: SignalHit[];
  suggested: EntryPoint | null;
  /** Observations no rule matched. */
  unmatched: Observation[];
}

export interface SignalMatchParams {
  asset_id?: string | null;
  equip_id?: string | null;
  observations: Observation[];
  pack_id?: string | null;
}

/** A machine signal pattern and the entry point it leads to. */
export interface SignalRule {
  node_id: string | null;
  /**
   * Exact (case and spacing folded), or `prefix:…`, `glob:…` (`*`, `?`),
   * `re:…` (a regular expression).
   */
  pattern: string;
  quote: string | null;
  /** True when `quote` is verbatim in `section_id`. */
  quote_verified: boolean;
  section_id: string | null;
  signal_kind: string;
  title: string;
  tree_id: string;
}

export interface Source {
  edition: string;
  license: string;
  media_type: string;
  publisher: string;
  retrieved_at: string;
  sha256: string;
  source_id: string;
  title: string;
  url: string;
}

/** What recording a step returns: the guidance to show when it failed. */
export interface StepOutcome {
  /**
   * The pack's guidance for a failed step. `quote_verified` says whether
   * its quote is verbatim in the cited section (a bake bug otherwise; the
   * app then shows the citation without the quote).
   */
  guidance: Guidance | null;
  record: StepRecord;
}

/** A recorded step. */
export interface StepRecord {
  deficiency: boolean;
  note: string | null;
  ord: number;
  outcome: Outcome;
  photos: PhotoRef[];
  recorded_at: string;
  /** A structured note (e.g. [`crate::notes::StructuredNote`]) as JSON. */
  structured: unknown;
  value: string | null;
}

/**
 * The step view: the manual's content at the current node, the path so
 * far, and field knowledge kept apart from the manual.
 */
export interface StepView {
  assets: PackAsset[];
  citation: Citation;
  detail: LevelText[];
  facets: FacetGroup[];
  /**
   * Reviewer-approved field notes for this context. Field knowledge,
   * never the manual's text.
   */
  field_notes: FieldNote[];
  /** Warnings, cautions and notes guarding this node, manual order. */
  guards: Guard[];
  level: Level;
  node: FaultNode;
  pack_id: string;
  pack_version: string;
  path: PathEntry[];
  /**
   * The candidate causes still open at this point (the node's `possible`
   * facet, else the nearest one earlier on the path).
   */
  possible_open: string[];
  record: RecordHow;
  /** What this node itself needs. */
  requirements: Requirement[];
  /** The tree's initial setup (conditions, tools, references, personnel). */
  setup: Requirement[];
  target: TargetView | null;
  /** True when no branch leaves this node (the path ends here). */
  terminal: boolean;
  test_procedure: TestProcedure | null;
  tree: TreeSummary;
}

/**
 * How the deterministic answer gate saw the question: enough to replay the
 * decision offline for any threshold. A section is kept when its coverage
 * reaches `threshold` and is within `window` of the best; the first
 * `max_sections` kept are composed; none kept means decline.
 */
export interface Support {
  /** Best answer-cache similarity, and the threshold a hit needs. */
  cache_similarity: number;
  cache_threshold: number;
  /** Retrieved sections in retrieval order, with their coverage. */
  candidates: SupportCandidate[];
  /** The question's content concepts (stems), in order. */
  concepts: string[];
  /**
   * How many retrieved chunks the gate looked at: `candidates` and
   * `top_dense` come from these (`retrieved` lists the first `k`).
   */
  depth: number;
  max_sections: number;
  /** The dense floor applied, when the dense gate was in force. */
  min_dense: number | null;
  /** Best coverage over the candidates (the value the gate compares). */
  score: number;
  threshold: number;
  /** Best dense cosine among the `depth` chunks (0 without dense). */
  top_dense: number;
  window: number;
}

/** One section the gate considered. */
export interface SupportCandidate {
  /**
   * Share of `concepts` the section (with its retrieved chunks and the
   * role's explanation) covers.
   */
  coverage: number;
  /** The concepts it covers. */
  covered: string[];
  /** 1-based rank of its first retrieved chunk. */
  rank: number;
  /** Best fused retrieval score among its chunks. */
  retrieval: number;
  section_id: string;
}

/** A symptom a technician reports, the way into a tree. */
export interface Symptom {
  applies_to: string[];
  lang: string;
  symptom_id: string;
  synonyms: string[];
  system: string | null;
  title: string;
  tree_id: string;
}

/** One ranked symptom. */
export interface SymptomHit {
  score: number;
  symptom: Symptom;
  why: Why[];
}

export interface SymptomSearch {
  /** True when the dense half ran. */
  dense: boolean;
  /** The variant the search was filtered to. */
  equip_id: string | null;
  hits: SymptomHit[];
  /** The signal match, when observations were given. */
  signals: SignalMatch | null;
}

export interface SymptomSearchParams {
  /** The asset (its variant when `equip_id` is absent). */
  asset_id?: string | null;
  equip_id?: string | null;
  /** Results (default 10). */
  k?: number | null;
  /** Signals read from the machine. */
  observations?: Observation[];
  pack_id?: string | null;
  /** The technician's words. */
  text?: string | null;
}

/** Where a `goto` (or an `action` that is a task) leads. */
export type Target = {
  id: string;
  kind: "tree";
} | {
  id: string;
  kind: "procedure";
};

/** Where a `goto` or task action leads. */
export interface TargetView {
  target: Target;
  title: string | null;
}

export interface TaskGetParams {
  equip_id?: string | null;
  pack_id?: string | null;
  proc_id: string;
}

export interface TaskListParams {
  equip_id?: string | null;
  pack_id?: string | null;
}

/** One step of a task or test procedure. */
export interface TaskStep {
  applies: boolean;
  /**
   * Equipment the step is limited to (empty: all), and whether it
   * applies to the equipment asked about.
   */
  applies_to: string[];
  assets: PackAsset[];
  check_kind: string;
  citation: Citation | null;
  /** Detail per level, as baked. */
  detail: Record<string, string>;
  /** Shown before the step, in manual order, at every level. */
  guards: Guard[];
  ord: number;
  section_ids: string[];
  /** Verbatim from the manual. */
  text: string;
}

/** A task in a list. */
export interface TaskSummary {
  applies_to: string[];
  kind: string;
  proc_id: string;
  summary: string;
  title: string;
}

/** A task (procedure) ready to show. */
export interface TaskView {
  applies_to: string[];
  kind: string;
  proc_id: string;
  requirements: Requirement[];
  roles: string[];
  steps: TaskStep[];
  summary: string;
  title: string;
}

/** The test procedure that answers a node's question. */
export interface TestProcedure {
  /** Whether it opens expanded at this level. */
  expanded: boolean;
  proc_id: string;
  requirements: Requirement[];
  steps: TaskStep[];
  title: string;
}

/** A whole tree, checked: every node passed and its text is verbatim. */
export interface Tree {
  edges: FaultEdge[];
  facets: Facet[];
  nodes: FaultNode[];
  tree: FaultTree;
}

export interface TreeGetParams {
  pack_id?: string | null;
  tree_id: string;
}

export interface TreeListParams {
  equip_id?: string | null;
  pack_id?: string | null;
  system?: string | null;
}

/** The tree a node belongs to. */
export interface TreeSummary {
  applies_to: string[];
  system: string | null;
  title: string;
  tree_id: string;
}

/** One broken rule. */
export interface Violation {
  detail: string;
  node_id: string | null;
  /** A stable rule code, e.g. `edge.coverage`. */
  rule: string;
  tree_id: string | null;
}

/** Why a symptom matched. */
export type Why = {
  kind: "words";
  phrase: string;
  words: string[];
} | {
  kind: "signal";
  pattern: string;
  signal_kind: string;
  value: string;
} | {
  cosine: number;
  kind: "dense";
};

/** Every method: its params and its result. */
export interface Methods {
  "pack.info": { params: PackParams; result: PackInfoView };
  "pack.validate": { params: PackParams; result: GraphReport };
  "equip.list": { params: PackParams; result: EquipView[] };
  "equip.resolve": { params: EquipResolveParams; result: Resolved };
  "asset.list": { params: NoParams; result: Asset[] };
  "asset.get": { params: AssetIdParams; result: Asset };
  "asset.create": { params: AssetCreateParams; result: Asset };
  "asset.update": { params: AssetUpdateParams; result: Asset };
  "asset.import": { params: AssetImportParams; result: ImportReport };
  "asset.history": { params: AssetHistoryParams; result: AssetHistory };
  "symptom.search": { params: SymptomSearchParams; result: SymptomSearch };
  "signal.match": { params: SignalMatchParams; result: SignalMatch };
  "tree.list": { params: TreeListParams; result: FaultTree[] };
  "tree.get": { params: TreeGetParams; result: Tree };
  "job.start": { params: JobStartParams; result: JobView };
  "job.get": { params: JobGetParams; result: JobView };
  "job.answer": { params: JobAnswerParams; result: JobView };
  "job.back": { params: JobIdParams; result: JobView };
  "job.close": { params: JobCloseParams; result: JobClosed };
  "job.list": { params: JobListParams; result: JobSummary[] };
  "job.report": { params: JobIdParams; result: JobReport };
  "task.list": { params: TaskListParams; result: TaskSummary[] };
  "task.get": { params: TaskGetParams; result: TaskView };
  "run.start": { params: RunStartParams; result: Run };
  "run.record": { params: RunRecordParams; result: StepOutcome };
  "run.finish": { params: RunIdParams; result: Run };
  "run.abandon": { params: RunIdParams; result: Run };
  "run.report": { params: RunIdParams; result: RunReport };
  "manual.section": { params: SectionParams; result: SectionView };
  "manual.children": { params: ChildrenParams; result: SectionRef[] };
  "manual.search": { params: ManualSearchParams; result: ManualSearch };
  "ask": { params: AskParams; result: AskResponse };
  "lesson.create": { params: LessonCreateParams; result: Lesson };
  "lesson.list": { params: LessonFilter; result: Lesson[] };
  "field.install": { params: FieldInstallParams; result: FieldInstall };
  "field.list": { params: NoParams; result: FieldNote[] };
  "sync.status": { params: NoParams; result: OutboxStatus };
  "sync.flush": { params: NoParams; result: FlushReport };
  "audit.list": { params: AuditListParams; result: AuditRecord[] };
  "audit.verify": { params: NoParams; result: ChainReport };
}

export type Method = keyof Methods;
export type Params<M extends Method> = Methods[M]["params"];
export type Result<M extends Method> = Methods[M]["result"];
/** What every transport returns. */
export type Envelope<T> = { ok: true; result: T } | { ok: false; error: ApiError };

export const METHODS = [
  "pack.info",
  "pack.validate",
  "equip.list",
  "equip.resolve",
  "asset.list",
  "asset.get",
  "asset.create",
  "asset.update",
  "asset.import",
  "asset.history",
  "symptom.search",
  "signal.match",
  "tree.list",
  "tree.get",
  "job.start",
  "job.get",
  "job.answer",
  "job.back",
  "job.close",
  "job.list",
  "job.report",
  "task.list",
  "task.get",
  "run.start",
  "run.record",
  "run.finish",
  "run.abandon",
  "run.report",
  "manual.section",
  "manual.children",
  "manual.search",
  "ask",
  "lesson.create",
  "lesson.list",
  "field.install",
  "field.list",
  "sync.status",
  "sync.flush",
  "audit.list",
  "audit.verify",
] as const satisfies readonly Method[];
