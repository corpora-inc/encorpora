/**
 * PROVISIONAL. The engine's JSON API types, written by hand from the API
 * list until the engine lane pushes the generated `harvest/api/types.ts`.
 * This is the only file that may define them; it is deleted the day the
 * generated file lands, and every import switches to that file.
 *
 * Field names follow the engine's Rust structs where they already exist
 * (harvest/core/src/maint): snake_case, ids as strings, optional as null.
 */

// ---------------------------------------------------------------- shared

/** Where a piece of manual text comes from, down to the page. */
export interface Citation {
  manual: string;
  edition: string;
  section_id: string;
  /** Section titles from the top of the manual down, e.g. ["4 Troubleshooting", "4.3 Low discharge pressure"]. */
  section_path: string[];
  page: string | null;
  figure: string | null;
}

export type GuardKind = "warning" | "caution" | "note";

/** A WARNING, CAUTION or NOTE block, verbatim, in manual order. */
export interface Guard {
  kind: GuardKind;
  text: string;
  citation: Citation;
}

export type RequirementKind = "tool" | "part" | "consumable" | "personnel" | "condition" | "reference";

export interface Requirement {
  kind: RequirementKind;
  text: string;
  /** Part number, tool number or reference id, when the manual gives one. */
  ident: string | null;
  qty: string | null;
  citation: Citation | null;
}

export interface Asset {
  asset_id: string;
  role: "figure" | "page";
  /** Served by the engine (HTTP) or the native asset scheme. */
  url: string;
  media_type: string;
  width: number | null;
  height: number | null;
  label: string | null;
}

// ---------------------------------------------------------------- pack

export interface PackInfo {
  pack_id: string;
  title: string;
  version: string;
  built_at: string;
  signed_by: string | null;
  sources: { manual: string; edition: string; date: string | null }[];
  levels: Level[];
}

export interface Level {
  id: string;
  label: string;
}

// ---------------------------------------------------------------- equipment

export interface Variant {
  equip_id: string;
  /** "Model 40 utility pump, diesel" */
  title: string;
  /** "40D" */
  short: string;
  attrs: Record<string, string>;
}

export interface Observation {
  /** Data plate text as typed or read. */
  plate_text?: string;
  serial?: string;
  firmware?: string;
  params?: Record<string, string>;
}

/** Why a variant matched: the rule and the observed value it matched. */
export interface MatchReason {
  kind: "serial_range" | "model" | "firmware" | "param" | "text";
  pattern: string;
  observed: string;
}

export interface ResolveCandidate {
  variant: Variant;
  reasons: MatchReason[];
}

export interface ResolveResult {
  status: "resolved" | "ambiguous" | "none";
  candidates: ResolveCandidate[];
}

// ---------------------------------------------------------------- assets (units)

export interface Unit {
  asset_id: string;
  /** The unit's own number on this fleet, e.g. "P40-0172". */
  name: string;
  serial: string;
  variant: Variant;
  resolved_by: MatchReason[];
  meter: { value: number; unit: "hours" | "miles" | "km" } | null;
  location: string | null;
  created_at: string;
}

export interface Discrepancy {
  id: string;
  text: string;
  opened_at: string;
  job_id: string | null;
}

export interface HistoryEntry {
  event_id: string;
  date: string;
  text: string;
  system: string | null;
  job_id: string | null;
}

export interface FailureMode {
  mode_id: string;
  title: string;
  count: number;
  share: number | null;
  tree_id: string | null;
}

export interface UnitHistory {
  unit: HistoryEntry[];
  open_discrepancies: Discrepancy[];
  /** The same symptom again within the pack's repeat window. */
  repeats: { symptom: string; count: number; window_days: number; last: string }[];
  fleet: { reports: number; modes: FailureMode[] };
}

// ---------------------------------------------------------------- symptoms and signals

export interface SymptomHit {
  symptom_id: string;
  tree_id: string;
  title: string;
  system: string | null;
  /** Why it matched: the words or the code, as the engine found them. */
  why: { kind: "words" | "synonym" | "code" | "history"; text: string }[];
  citation: Citation;
}

export interface ActiveCode {
  code: string;
  title: string;
  source: string;
}

export interface SignalMatch {
  code: string;
  title: string;
  tree_id: string;
  node_id: string | null;
  quote: string | null;
  citation: Citation | null;
}

// ---------------------------------------------------------------- jobs (troubleshooting)

export type NodeKind = "symptom" | "check" | "action" | "goto" | "escalate" | "end";

/** How a result is recorded at a node (the engine's `Expect`). */
export type Expect =
  | { kind: "yes_no" }
  | { kind: "pass_fail" }
  | { kind: "choice"; options: string[] }
  | { kind: "value"; unit: string; min: number | null; max: number | null }
  | { kind: "ack" };

/** One way out of a node, with the manual's own label. */
export interface Branch {
  outcome: string;
  label: string;
  /** For a value: the numeric range this branch takes, as the manual states it. */
  range: string | null;
}

export interface Facet {
  /** reason | known | possible | test_option, named by the pack. */
  facet: string;
  label: string;
  texts: string[];
  citation: Citation;
  /** Shown expanded at the current level. */
  shown: boolean;
}

export interface TestStep {
  n: number;
  text: string;
  guards: Guard[];
}

export interface PathEntry {
  node_id: string;
  kind: NodeKind;
  text: string;
  /** The recorded result, as its branch label ("No", "−42 kPa"). */
  result: string | null;
}

export interface FieldNote {
  note_id: string;
  text: string;
  cause: string | null;
  times_seen: number;
  approved_at: string;
  reviewer: string;
}

export interface Setup {
  conditions: Requirement[];
  tools: Requirement[];
  references: Requirement[];
  personnel: Requirement[];
}

export interface StepView {
  job_id: string;
  node_id: string;
  kind: NodeKind;
  /** 1-based position on the path. */
  step_no: number;
  text: string;
  citation: Citation;
  guards: Guard[];
  setup: Setup;
  requirements: Requirement[];
  assets: Asset[];
  expect: Expect | null;
  branches: Branch[];
  facets: Facet[];
  test_steps: TestStep[];
  test_steps_fold: "expanded" | "collapsed";
  path: PathEntry[];
  field_notes: FieldNote[];
  level: string;
  levels: Level[];
  /** Where a goto or an action that is a task leads. */
  target: { kind: "tree" | "procedure"; id: string; title: string } | null;
}

export type ResultInput =
  | { outcome: string }
  | { value: number; unit: string };

export interface Attachment {
  kind: "photo" | "note";
  id: string;
  text?: string;
  url?: string;
}

export interface JobSummary {
  job_id: string;
  asset_id: string;
  unit_name: string;
  symptom: string;
  started_at: string;
  step_no: number;
  status: "open" | "closed";
}

// ---------------------------------------------------------------- procedures and runs

export interface ProcedureStep {
  n: number;
  text: string;
  guards: Guard[];
  citation: Citation;
  expect: Expect | null;
}

export interface Procedure {
  task_id: string;
  title: string;
  citation: Citation;
  guards: Guard[];
  setup: Setup;
  requirements: Requirement[];
  steps: ProcedureStep[];
}

// ---------------------------------------------------------------- ask

export interface AskAnswer {
  query: string;
  /** Each sentence is the manual's, with its citation. */
  passages: { text: string; citation: Citation }[];
  /** Present only when the on-device model is on: a one-line pointer, never a claim of its own. */
  summary: string | null;
}

// ---------------------------------------------------------------- lessons and sync

export type LessonStatus = "local" | "queued" | "uploaded" | "approved" | "returned";

export interface Lesson {
  lesson_id: string;
  job_id: string;
  unit_name: string;
  variant: string;
  symptom: string;
  cause: string;
  action: string;
  parts: { ident: string | null; text: string; qty: string }[];
  minutes: number | null;
  note: string;
  photos: number;
  status: LessonStatus;
  saved_at: string;
}

export interface SyncStatus {
  online: boolean;
  queued: number;
  last_sync: string | null;
  hub: string | null;
}
