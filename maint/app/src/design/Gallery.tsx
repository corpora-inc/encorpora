/**
 * /design: every screen in every state, inside the real shell, from data the
 * engine returned (captured.json, written by scripts/capture-samples.mjs from
 * the fictional Model 40 pump fixture). Development and design builds only.
 * Test data for components: the handlers do nothing and nothing here decides anything.
 */
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import type {
  Asset,
  AuditRecord,
  ChainReport,
  Decoded,
  SignalMatch,
  FieldNote,
  HubStatus,
  JobReport,
  ReviewItem,
  Lesson,
  ManualSearch,
  SectionRef,
  SectionView,
  StepOutcome,
  Tree,
  AssetHistory,
  EquipView,
  FaultTree,
  JobClosed,
  JobSummary,
  JobView,
  PackAsset,
  PackInfoView,
  Resolved,
  Run,
  SymptomSearch,
  SyncStatus,
  TaskView,
} from "../engine/types.ts";
import { applyProposal, CloseOut, type CloseOutProps } from "../screens/CloseOut.tsx";
import { Connect, type ConnectProps } from "../screens/Connect.tsx";
import { Describe, type DescribeProps, type IndexGroup } from "../screens/Describe.tsx";
import { Home } from "../screens/Home.tsx";
import { Identify, type IdentifyProps } from "../screens/Identify.tsx";
import { Step, type StepProps } from "../screens/Step.tsx";
import { UnitPage } from "../screens/UnitPage.tsx";
import { TaskList, TaskPage, type TaskPageProps } from "../screens/Tasks.tsx";
import { PrintJob, PrintProcedure } from "../screens/Print.tsx";
import { ManualHome, ManualResults, SectionReader } from "../screens/Manual.tsx";
import { LearnHome, TreeStudy } from "../screens/Learn.tsx";
import { Records, type RecordsProps } from "../screens/Records.tsx";
import { HubSignIn, Review, type ReviewProps } from "../screens/Review.tsx";
import { designPath } from "../routes.ts";
import { unitName } from "../ui/format.ts";
import { AssetSource, ManualPack } from "../ui/manual.tsx";
import { Shell, type ShellUnit } from "../ui/Shell.tsx";
import raw from "./captured.json";
import practiceRaw from "./practice.json";
import { PracticeItem, PracticeSummary } from "../screens/Practice.tsx";
import { rebuild, reportOf, toBank } from "../learn/state.ts";
import type { Applicability, AssetAttrs, LessonPrefill, LlmStatus, StepAsk, SymptomSuggest, PracticeAttempt, PracticeItems, RowHit, TableSummary, TableView } from "../engine/types.ts";
import { ReferenceHome, ReferenceRow, ReferenceTable } from "../screens/Reference.tsx";
import { Undetermined } from "../ui/applicability.tsx";
import { bySystem } from "../learn/order.ts";
import { shownAsk, shownProposal, shownSuggest } from "../engine/shown.ts";
import { RefTables } from "../ui/reference.tsx";

interface Captured {
  pack: PackInfoView;
  equipment: EquipView[];
  trees: FaultTree[];
  assets: Asset[];
  resolve: { resolved: Resolved; ambiguous: Resolved; none: Resolved };
  search: { results: SymptomSearch; none: SymptomSearch; closest: SymptomSearch; codes: SymptomSearch };
  steps: Record<"symptom" | "check" | "checkLevel2" | "value" | "action" | "back" | "passfail" | "escalate" | "actionCheck" | "end" | "choice" | "goto" | "followed", JobView>;
  task: TaskView;
  tasks: import("../engine/types.ts").TaskSummary[];
  run: Run;
  suggest: Record<"route" | "suggest" | "clarify" | "list", SymptomSuggest>;
  stepAsk: Record<"answer" | "decline", StepAsk>;
  prefill: LessonPrefill;
  llm: LlmStatus;
  llmBefore: LlmStatus;
  llmOff: LlmStatus;
  closed: JobClosed;
  jobs: JobSummary[];
  history: AssetHistory;
  outbox: SyncStatus;
  lessons: Lesson[];
  audit: AuditRecord[];
  chain: ChainReport;
  jobReport: JobReport;
  manualTop: SectionRef[];
  section: SectionView;
  manualSearch: ManualSearch;
  tree: Tree;
  fieldNotes: FieldNote[];
  failedStep: StepOutcome;
  decode: { decoded: Decoded; match: SignalMatch };
  closestMatch: SignalMatch;
  tables: TableSummary[];
  attrsEmpty: AssetAttrs;
  attrsTyped: AssetAttrs;
  attrsPlate: AssetAttrs;
  attrsAll: AssetAttrs;
  ref: {
    codes: TableView;
    codesKnown: TableView;
    specs: TableView;
    specsKnown: TableView;
    lookup: RowHit[];
    lookupNone: RowHit[];
    search: ManualSearch;
    matchTree: SignalMatch;
    matchUnknown: SignalMatch;
    matchKnown: SignalMatch;
  };
}
const D = raw as unknown as Captured;

// Captured page images, by asset id, so the gallery needs no engine.
const IMAGES = import.meta.glob("./assets/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const imageFor = (_pack: string, a: PackAsset) => Object.entries(IMAGES).find(([k]) => k.includes(`/${a.asset_id}.`))?.[1] ?? "";

const none = () => {};
const variants = Object.fromEntries(D.equipment.map((e) => [e.equip_id, e.name]));
const unit = D.history.asset;
const variant = (unit.equip_id && variants[unit.equip_id]) || "";
const shellUnit: ShellUnit = { asset_id: unit.asset_id, name: unitName(unit), variant };
const openJobs = D.jobs.filter((j) => j.status === "open");
const index: IndexGroup[] = bySystem(D.pack.systems, D.trees);

interface Entry {
  state: string;
  label: string;
  unit: ShellUnit | null;
  /** A document with no app chrome (print). */
  bare?: boolean;
  render(): ReactNode;
}

const identify: Omit<IdentifyProps, "mode" | "phase" | "result"> = {
  observed: { serial: D.assets[0]?.serial ?? "" },
  general: false,
  picked: null,
  name: "",
  hours: "",
  saving: false,
  canConnect: false,
  onObserved: none,
  onResolve: none,
  onPick: none,
  onName: none,
  onHours: none,
  onSave: none,
  onConnect: none,
};

const describe: Omit<DescribeProps, "phase"> = {
  unitName: unitName(unit),
  connectTo: "/units/unit-101/connect",
  query: "",
  search: null,
  codes: [],
  signalKinds: D.pack.signal_kinds,
  index,
  suggest: null,
  voice: "unavailable",
  onQuery: none,
  onAddCode: none,
  onRemoveCode: none,
  onVoice: none,
  onStartSymptom: none,
  onStartTree: none,
  onStartSignal: none,
};

const connect: ConnectProps = {
  unitName: unitName(unit),
  source: "typed",
  linkAvailable: false,
  formats: [
    { value: "j1939_candump", label: "J1939 candump" },
    { value: "j1939_frames", label: "J1939 frames" },
  ],
  format: "j1939_candump",
  signalKinds: D.pack.signal_kinds,
  codes: [],
  decoded: null,
  match: null,
  busy: false,
  describeTo: "/units/unit-101/troubleshoot",
  onSource: none,
  onFormat: none,
  onRead: none,
  onDecode: none,
  onType: none,
  onRemove: none,
  onClear: none,
  onStart: none,
  onStartSymptom: none,
};

const step = (v: JobView, extra: Partial<StepProps> = {}): StepProps => ({
  job: v.job,
  step: v.step!,
  levels: D.pack.levels,
  facetLabels: Object.fromEntries((D.pack.facets ?? []).map((f) => [f.id, f.label])),
  phase: "ready",
  draft: "",
  note: "",
  photos: 0,
  keypadOpen: false,
  overlay: null,
  voice: false,
  onDraft: none,
  onKeypad: none,
  onAnswer: none,
  onLevel: none,
  onBack: none,
  onFollow: none,
  onPhoto: none,
  onNote: none,
  onAskQuery: none,
  ...extra,
});

const lessonFrom = (s: JobView) => ({
  cause: "",
  action: s.step!.node.text,
  parts: D.task.requirements.filter((r) => r.kind === "part").map((r) => ({ ident: r.ident, text: r.text, qty: r.qty })),
  minutes: 45,
  note: "",
});

const close = (v: JobView, extra: Partial<CloseOutProps> = {}): CloseOutProps => ({
  phase: "action",
  step: v.step!,
  resolution: "fixed",
  task: D.task,
  run: D.run,
  draft: lessonFrom(v),
  saved: null,
  busy: false,
  onRecord: none,
  onActionDone: none,
  onVerified: none,
  onDraft: none,
  onSave: none,
  prefilling: false,
  confirming: false,
  onConfirming: none,
  voice: "unavailable",
  onVoice: none,
  ...extra,
});

// The scripted model's proposal for the note, as the close-out lays it over the job's draft.
const PREFILL_NOTE = "The fuse let go. Swapped it, took 25 minutes.";
const prefilled = applyProposal({ ...lessonFrom(D.steps.end), note: PREFILL_NOTE, cause: "", action: "" }, shownProposal(D.prefill.proposal));

const pageAsset = D.steps.check.step!.assets.find((a) => a.role === "page")!;

const taskPage = (extra: Partial<TaskPageProps> = {}): TaskPageProps => ({
  packId: D.pack.pack_id,
  task: D.task,
  run: null,
  guidance: null,
  report: null,
  busy: false,
  unitName: unitName(unit),
  onStart: none,
  onRecord: none,
  onFinish: none,
  onAbandon: none,
  ...extra,
});

const records: RecordsProps = {
  sync: D.outbox,
  device: { device_id: "dev-15db3c55739b5c4c", public_key: "5MdZk4KLMfL+gvk5FUsE4EmxidH7WojwxR4xVwCE2Qs=" },
  packs: [D.pack],
  warnings: [],
  notes: D.fieldNotes,
  audit: D.audit,
  chain: null,
  llm: D.llmOff,
  modelOn: false,
  theme: "system",
  busy: null,
  onSync: none,
  onVerifyChain: none,
  onInstallNotes: none,
  onImportFleet: none,
  onModel: none,
  onTheme: none,
};

const titles = Object.fromEntries(D.trees.map((t) => [t.tree_id, t.title]));
const variantsById = Object.fromEntries(D.equipment.map((e) => [e.equip_id, e.name]));
// Wording as the hub returns it in suggested_note (captured from the hub in the flow test).
const hubNote = (l: Lesson) => `Verified cause: ${l.cause}. Corrective action: ${l.action}.`;
const reviewItem = (l: Lesson): ReviewItem => ({ current: l, first_received_at: l.created_at, lesson_id: l.lesson_id, needs_reviewer: false, reopened: false, reviews: [], status: "pending", versions: [], suggested_note: hubNote(l), suggested_scope: { equip_id: l.equip_id, node_id: null, symptom_id: l.symptom_id, tree_id: l.tree_id } });
const reviewQueue = D.lessons.map(reviewItem);
const first = reviewQueue[0] ?? null;
const hubStatus: HubStatus = {
  bundles: 1,
  conflicts: 0,
  devices: 2,
  items: 3,
  jobs: 2,
  key_id: "1c3d7ada6ee7d67c",
  latest_bundle: 1,
  lessons_approved: 1,
  lessons_pending: reviewQueue.length,
  lessons_rejected: 0,
  stream: "pump40-fleet",
};
const review: ReviewProps = {
  status: hubStatus,
  queue: reviewQueue,
  approved: [],
  selected: first,
  titles,
  variants: variantsById,
  draft: first ? { text: hubNote(first.current), note: "", version: null } : null,
  suggested: first ? hubNote(first.current) : "",
  me: { name: "Shop supervisor", roles: ["reviewer", "publisher", "admin"], via: "token" },
  devices: [],
  busy: false,
  onSignOut: none,
  onEnroll: none,
  onRevoke: none,
  onDraft: none,
  onApprove: none,
  onReject: none,
  onPublish: none,
};

// Practice: the fictional pump pack's items (harvest show), and a learner part-way through.
const PI = practiceRaw as unknown as PracticeItems;
const pix = toBank(PI);
const T0 = Date.UTC(2026, 10, 28, 9);
const someAttempts: PracticeAttempt[] = PI.questions.slice(0, 12).map((q, i) => ({ attempt_id: `a${i}`, pack_id: "pump40v2-proof", pack_version: "", skill_id: q.skill_id, q_id: q.q_id, chosen: q.answer, correct: i % 4 !== 1, ms: 8000, at: new Date(T0 + i * 60_000).toISOString() }));
const pstate = rebuild(pix, someAttempts);
const pq = PI.questions[0]!;
const pskill = PI.skills.find((x) => x.skill_id === pq.skill_id)!;
const ptopic = PI.topics.find((t) => t.topic_id === pskill.topic_id)!;
const practiceItem = { packId: "pump40v2-proof", question: pq, skillTitle: pskill.title, topicTitle: ptopic.title, reason: "frontier" as const, chosen: null, busy: false, onChoose: none, onNext: none };

const sectionPage = D.section.assets.find((a) => a.role === "page") ?? null;

// The in-place answer, as the app renders it for a unit with nothing answered yet.
const answer = (a: Applicability) => <Undetermined a={a} declared={D.attrsEmpty.declared} onAnswer={none} />;
const answerRefused = (a: Applicability) => <Undetermined a={a} declared={D.attrsEmpty.declared} refused={{ firmware: true }} onAnswer={none} />;
const unitAttrs = { attrs: D.attrsAll, attrsSaving: false, onAttr: none, referenceTo: `/manual/${D.pack.pack_id}/reference` };
// The engine's own undetermined applicability (row E52, "firmware 2.4 and later"), set on a step's
// block and on the step itself: the fixture scopes rows, not tree nodes, with statements.
const unknownA = D.ref.codes.rows.find((r) => r.applicability?.status === "unknown")!.applicability!;
const withUnknown = (v: JobView): JobView => ({ ...v, step: { ...v.step!, applicability: unknownA, guards: v.step!.guards.map((g, i) => (i === v.step!.guards.length - 1 ? { ...g, applicability: unknownA } : g)) } });
// The fixture marks every block must_show; one class left foldable shows the experienced level's fold.
const expert = D.pack.levels[D.pack.levels.length - 1]!;
const foldable = (v: JobView): JobView => ({ ...v, step: { ...v.step!, level: expert, guards: v.step!.guards.map((g) => (g.rank > 1 ? { ...g, must_show: false } : g)) } });
// The fixture's classes have the warning, caution and note tones; the sample adds danger and notice
// (label and tone set here) so all five tones show side by side, in rank order.
const fiveTones = (v: JobView): JobView => {
  const g = v.step!.guards[0]!;
  const tones = [
    ["DANGER", "danger"],
    ["WARNING", "warning"],
    ["CAUTION", "caution"],
    ["NOTICE", "notice"],
    ["NOTE", "note"],
  ] as const;
  return { ...v, step: { ...v.step!, guards: tones.map(([label, tone], i) => ({ ...g, label, tone, rank: i + 1 })) } };
};
const rowOf = (t: TableView, ord: number) => t.rows.find((r) => r.ord === ord)!;

export const GALLERY: Record<string, { title: string; states: Entry[] }> = {
  home: {
    title: "1. Fleet",
    states: [
      { state: "first-run", label: "First run", unit: null, render: () => <Home loading={false} units={[]} variants={variants} openJobs={[]} pending={0} lastSync={null} /> },
      { state: "loading", label: "Loading", unit: null, render: () => <Home loading units={[]} variants={variants} openJobs={[]} pending={0} lastSync={null} /> },
      {
        state: "fleet",
        label: "Units and open jobs",
        unit: shellUnit,
        render: () => <Home loading={false} units={D.assets} variants={variants} openJobs={openJobs} pending={D.outbox.pending} lastSync={D.outbox.last_synced_at} />,
      },
    ],
  },
  identify: {
    title: "2. Add a unit",
    states: [
      { state: "entry", label: "Typing the plate", unit: null, render: () => <Identify {...identify} mode="type" phase="entry" result={null} /> },
      { state: "resolving", label: "Identifying", unit: null, render: () => <Identify {...identify} mode="type" phase="resolving" result={null} /> },
      { state: "resolved", label: "Resolved, with the rule", unit: null, render: () => <Identify {...identify} mode="type" phase="done" result={D.resolve.resolved} name="Pump 104" hours="12" /> },
      { state: "resolved-plate", label: "Resolved, plate values kept", unit: null, render: () => <Identify {...identify} mode="type" phase="done" observed={{ serial: D.assets[0]?.serial ?? "", firmware: "2.6" }} result={D.resolve.resolved} name="Pump 104" hours="12" /> },
      { state: "general", label: "Model only, no variant", unit: null, render: () => <Identify {...identify} mode="type" phase="done" observed={{ model: "Model 40" }} result={D.resolve.ambiguous} general /> },
      { state: "none", label: "No match", unit: null, render: () => <Identify {...identify} mode="type" phase="done" observed={{ serial: "ZZ-0001" }} result={D.resolve.none} /> },
      { state: "connect", label: "Connect, no link", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} /> },
      { state: "connect-ready", label: "Connect, link present", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} canConnect /> },
    ],
  },
  unit: {
    title: "3. Unit",
    states: [
      { state: "history", label: "History, repeats, fleet", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={D.history} openJob={openJobs[0] ?? null} codes={[]} {...unitAttrs} /> },
      { state: "attributes-unknown", label: "Attributes not yet known", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={D.history} openJob={null} codes={[]} {...unitAttrs} attrs={D.attrsEmpty} /> },
      {
        state: "codes",
        label: "With active codes",
        unit: shellUnit,
        render: () => (
          <UnitPage
            unit={unit}
            variant={variant}
            history={D.history}
            openJob={null}
            codes={[
              { value: "spn:168/fmi:1", title: "Battery voltage low" },
              { value: "X99", title: null },
            ]}
            {...unitAttrs}
          />
        ),
      },
      { state: "connect", label: "Connect to vehicle, empty", unit: shellUnit, render: () => <Connect {...connect} /> },
      { state: "connect-row", label: "Connect, a code that is a table row, with a tree", unit: shellUnit, render: () => <Connect {...connect} codes={[{ signal_kind: null, value: "E21" }]} match={D.ref.matchTree} /> },
      { state: "connect-row-unknown", label: "Connect, a row not yet known to apply", unit: shellUnit, render: () => <Connect {...connect} codes={[{ signal_kind: null, value: "E52" }]} match={D.ref.matchUnknown} renderAnswer={answer} /> },
      { state: "connect-row-known", label: "Connect, the row after the answer", unit: shellUnit, render: () => <Connect {...connect} codes={[{ signal_kind: null, value: "E52" }]} match={D.ref.matchKnown} /> },
      {
        state: "connect-codes",
        label: "Connect, codes read",
        unit: shellUnit,
        render: () => (
          <Connect
            {...connect}
            codes={[
              { signal_kind: null, value: "spn:168/fmi:1" },
              { signal_kind: null, value: "X99" },
            ]}
            match={D.search.codes.signals}
          />
        ),
      },
      {
        state: "new",
        label: "New unit",
        unit: shellUnit,
        render: () => <UnitPage unit={unit} variant={variant} history={{ ...D.history, events: [], jobs: [], fleet_history: [], failure_modes: [] }} openJob={null} codes={[]} {...unitAttrs} attrs={D.attrsPlate} />,
      },
      { state: "loading", label: "Loading history", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={null} openJob={null} codes={[]} {...unitAttrs} attrs={null} /> },
    ],
  },
  describe: {
    title: "4. Describe the problem",
    states: [
      { state: "empty", label: "Nothing typed", unit: shellUnit, render: () => <Describe {...describe} phase="empty" /> },
      { state: "searching", label: "Searching", unit: shellUnit, render: () => <Describe {...describe} query="engine does not crank" phase="searching" /> },
      { state: "suggest", label: "Model, one suggested entry", unit: shellUnit, render: () => <Describe {...describe} query="the pump engine is acting up and making a weird noise" phase="results" search={D.suggest.suggest.search} suggest={shownSuggest(D.suggest.suggest)} /> },
      { state: "clarify", label: "Model, which of these is it?", unit: shellUnit, render: () => <Describe {...describe} query="the pump engine is acting up and there is a rattle" phase="results" search={D.suggest.clarify.search} suggest={shownSuggest(D.suggest.clarify)} /> },
      { state: "model-list", label: "Model, no pick: the list", unit: shellUnit, render: () => <Describe {...describe} query="the pump engine is acting up and grinding" phase="results" search={D.suggest.list.search} suggest={shownSuggest(D.suggest.list)} /> },
      { state: "route", label: "Model on, the engine's own match", unit: shellUnit, render: () => <Describe {...describe} query="engine does not crank" phase="results" search={D.suggest.route.search} suggest={shownSuggest(D.suggest.route)} /> },
      { state: "results", label: "Confident match", unit: shellUnit, render: () => <Describe {...describe} query="engine does not crank" phase="results" search={D.search.results} /> },
      { state: "closest", label: "Closest entries only", unit: shellUnit, render: () => <Describe {...describe} query="engine is hot" phase="results" search={D.search.closest} /> },
      { state: "codes", label: "With a fault code", unit: shellUnit, render: () => <Describe {...describe} phase="results" codes={[{ signal_kind: "j1939.dm1", value: "spn:168/fmi:1" }]} search={D.search.codes} /> },
      { state: "none", label: "No match", unit: shellUnit, render: () => <Describe {...describe} query="smells like toast" phase="results" search={D.search.none} /> },
      { state: "listening", label: "Voice, listening", unit: shellUnit, render: () => <Describe {...describe} phase="empty" voice="listening" /> },
    ],
  },
  step: {
    title: "5. Guided troubleshooting",
    states: [
      { state: "symptom", label: "Symptom, continue", unit: shellUnit, render: () => <Step {...step(D.steps.symptom)} /> },
      { state: "check", label: "Yes/no, first level", unit: shellUnit, render: () => <Step {...step(D.steps.check)} /> },
      { state: "check-level2", label: "Yes/no, second level", unit: shellUnit, render: () => <Step {...step(D.steps.checkLevel2)} /> },
      { state: "value", label: "Measured value", unit: shellUnit, render: () => <Step {...step(D.steps.value, { draft: "10.8" })} /> },
      { state: "value-keypad", label: "Measured value, keypad open", unit: shellUnit, render: () => <Step {...step(D.steps.value, { draft: "10.8", keypadOpen: true })} /> },
      { state: "back", label: "After changing an answer", unit: shellUnit, render: () => <Step {...step(D.steps.back)} /> },
      { state: "passfail", label: "Pass or fail", unit: shellUnit, render: () => <Step {...step(D.steps.passfail)} /> },
      { state: "choice", label: "Three-way choice", unit: shellUnit, render: () => <Step {...step(D.steps.choice)} /> },
      { state: "action-check", label: "Action, then a question", unit: shellUnit, render: () => <Step {...step(D.steps.actionCheck)} /> },
      { state: "page", label: "Original page open", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "page", asset: pageAsset } })} /> },
      { state: "noted", label: "Note and photos", unit: shellUnit, render: () => <Step {...step(D.steps.check, { note: "Fuse holder loose.", photos: 2 })} /> },
      { state: "sending", label: "Result sent", unit: shellUnit, render: () => <Step {...step(D.steps.check, { phase: "sending" })} /> },
      { state: "ask", label: "Ask, cited answer", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "How do I check fuse F2?", answer: shownAsk(D.stepAsk.answer) } })} /> },
      { state: "ask-declined", label: "Ask, not in the manual", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "What colour is the paint?", answer: shownAsk(D.stepAsk.decline) } })} /> },
      { state: "ask-passages", label: "Ask, model off: the manual's passages", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "How do I check fuse F2?", answer: { ...shownAsk(D.stepAsk.decline), decision: "passages" } } })} /> },
      { state: "ask-loading", label: "Ask, loading", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "How do I check fuse F2?", answer: null } })} /> },
      { state: "goto", label: "Go to another table", unit: shellUnit, render: () => <Step {...step(D.steps.goto)} /> },
      { state: "followed", label: "Continued in another table", unit: shellUnit, render: () => <Step {...step(D.steps.followed)} /> },
      { state: "action", label: "Corrective action reached", unit: shellUnit, render: () => <Step {...step(D.steps.action)} /> },
      { state: "escalate", label: "Refer", unit: shellUnit, render: () => <Step {...step(D.steps.escalate)} /> },
      { state: "end", label: "Fault corrected", unit: shellUnit, render: () => <Step {...step(D.steps.end)} /> },
      { state: "ranked", label: "Two safety classes, by tone", unit: shellUnit, render: () => <Step {...step(D.steps.passfail)} /> },
      { state: "tones", label: "All five tones", unit: shellUnit, render: () => <Step {...step(fiveTones(D.steps.check))} /> },
      { state: "ranked-folded", label: "Experienced level, foldable class", unit: shellUnit, render: () => <Step {...step(foldable(D.steps.passfail))} /> },
      { state: "undetermined", label: "Applicability not determined", unit: shellUnit, render: () => <Step {...step(withUnknown(D.steps.check), { renderAnswer: answer })} /> },
    ],
  },
  close: {
    title: "6. Close-out",
    states: [
      { state: "action", label: "Corrective action, task run", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action)} /> },
      { state: "verify", label: "Did it fix it?", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action, { phase: "verify" })} /> },
      { state: "lesson", label: "Lesson, prefilled", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action, { phase: "lesson" })} /> },
      { state: "lesson-note", label: "Lesson, a note to fill from", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "lesson", draft: { ...lessonFrom(D.steps.end), note: PREFILL_NOTE }, onPrefill: none })} /> },
      { state: "lesson-suggested", label: "Lesson, suggested fields", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "lesson", draft: prefilled, onPrefill: none })} /> },
      { state: "lesson-confirm", label: "Lesson, confirm before saving", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "lesson", draft: prefilled, onPrefill: none, confirming: true })} /> },
      {
        state: "referral",
        label: "Referral",
        unit: shellUnit,
        render: () => <CloseOut {...close(D.steps.escalate, { phase: "lesson", resolution: "escalated", task: null, draft: { ...lessonFrom(D.steps.escalate), parts: [] } })} />,
      },
      { state: "queued", label: "Saved, waiting to sync", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "saved", saved: D.closed.lesson })} /> },
      { state: "approved", label: "Approved", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "saved", saved: { ...D.closed.lesson!, status: "approved" } })} /> },
    ],
  },
};

Object.assign(GALLERY, {
  tasks: {
    title: "7. Maintenance tasks",
    states: [
      {
        state: "list",
        label: "Tasks for the variant",
        unit: shellUnit,
        render: () => <TaskList variant={variant} groups={[{ packId: D.pack.pack_id, title: D.pack.sources[0]?.title ?? D.pack.pack_id, tasks: D.tasks }]} />,
      },
      { state: "task", label: "A task, before starting", unit: shellUnit, render: () => <TaskPage {...taskPage()} /> },
      { state: "run", label: "Running, two steps recorded", unit: shellUnit, render: () => <TaskPage {...taskPage({ run: D.run })} /> },
      { state: "failed", label: "A failed step", unit: shellUnit, render: () => <TaskPage {...taskPage({ run: { ...D.run, steps: [D.failedStep.record] }, guidance: D.failedStep.guidance })} /> },
      { state: "print", label: "Printable task", unit: null, bare: true, render: () => <PrintProcedure task={D.task} pack={D.pack} unit={unitName(unit)} /> },
      { state: "print-job", label: "Printable job", unit: null, bare: true, render: () => <PrintJob report={D.jobReport} pack={D.pack} unit={unitName(unit)} lesson={D.closed.lesson} /> },
    ],
  },
  manual: {
    title: "8. Manual",
    states: [
      {
        state: "contents",
        label: "Contents and search",
        unit: shellUnit,
        render: () => <ManualHome manuals={[{ packId: D.pack.pack_id, title: D.pack.sources[0]?.title ?? "", edition: D.pack.sources[0]?.edition ?? "", contents: D.manualTop, tables: D.tables.length }]} />,
      },
      { state: "section", label: "A section", unit: shellUnit, render: () => <SectionReader packId={D.pack.pack_id} view={D.section} page={sectionPage} pageOpen={false} src={(a) => imageFor(D.pack.pack_id, a)} /> },
      {
        state: "page",
        label: "Original page, passage marked",
        unit: shellUnit,
        render: () => <SectionReader packId={D.pack.pack_id} view={D.section} page={sectionPage} pageOpen src={(a) => imageFor(D.pack.pack_id, a)} />,
      },
      { state: "search", label: "Search results", unit: shellUnit, render: () => <ManualResults packId={D.pack.pack_id} query="battery voltage" hits={D.manualSearch.hits} /> },
      { state: "search-rows", label: "Search, table rows among the hits", unit: shellUnit, render: () => <ManualResults packId={D.pack.pack_id} query="E52 inverter" hits={D.ref.search.hits} renderAnswer={answer} /> },
    ],
  },
  reference: {
    title: "8b. Reference",
    states: [
      { state: "home", label: "Tables by kind", unit: shellUnit, render: () => <ReferenceHome packId={D.pack.pack_id} manual={D.pack.sources[0]?.title ?? ""} tables={D.tables} lookup={null} unitName={unitName(unit)} renderAnswer={answer} /> },
      { state: "lookup", label: "Lookup, a row not yet known to apply", unit: shellUnit, render: () => <ReferenceHome packId={D.pack.pack_id} manual="" tables={D.tables} lookup={{ query: "E52", hits: D.ref.lookup }} unitName={unitName(unit)} renderAnswer={answer} /> },
      { state: "lookup-none", label: "Lookup, nothing", unit: shellUnit, render: () => <ReferenceHome packId={D.pack.pack_id} manual="" tables={D.tables} lookup={{ query: "E99", hits: D.ref.lookupNone }} unitName={null} /> },
      { state: "lookup-loading", label: "Lookup, running", unit: shellUnit, render: () => <ReferenceHome packId={D.pack.pack_id} manual="" tables={D.tables} lookup={{ query: "E52", hits: null }} unitName={null} /> },
      { state: "codes", label: "Messages and codes", unit: shellUnit, render: () => <ReferenceTable packId={D.pack.pack_id} table={D.ref.codes} unitName={unitName(unit)} renderAnswer={answer} /> },
      { state: "codes-known", label: "Codes, firmware answered", unit: shellUnit, render: () => <ReferenceTable packId={D.pack.pack_id} table={D.ref.codesKnown} unitName={unitName(unit)} /> },
      { state: "specs", label: "Specifications, a cell not yet known", unit: shellUnit, render: () => <ReferenceTable packId={D.pack.pack_id} table={D.ref.specs} unitName={unitName(unit)} renderAnswer={answer} /> },
      { state: "specs-known", label: "Specifications, bulletin answered", unit: shellUnit, render: () => <ReferenceTable packId={D.pack.pack_id} table={D.ref.specsKnown} unitName={unitName(unit)} /> },
      { state: "row", label: "A row, not yet known", unit: shellUnit, render: () => <ReferenceRow packId={D.pack.pack_id} table={D.ref.codes} row={rowOf(D.ref.codes, 3)} unitName={unitName(unit)} start={null} renderAnswer={answer} /> },
      { state: "row-refused", label: "A row, the typed value refused", unit: shellUnit, render: () => <ReferenceRow packId={D.pack.pack_id} table={D.ref.codes} row={rowOf(D.ref.codes, 3)} unitName={unitName(unit)} start={null} renderAnswer={answerRefused} /> },
      { state: "row-start", label: "A row the manual troubleshoots", unit: shellUnit, render: () => <ReferenceRow packId={D.pack.pack_id} table={D.ref.codes} row={rowOf(D.ref.codes, 1)} unitName={unitName(unit)} start={{ title: D.trees.find((t) => t.tree_id === D.ref.matchTree.hits[0]?.rule.tree_id)?.title ?? "", onStart: none }} /> },
      { state: "row-spec", label: "A specification row, printed limits", unit: shellUnit, render: () => <ReferenceRow packId={D.pack.pack_id} table={D.ref.specsKnown} row={rowOf(D.ref.specsKnown, 3)} unitName={unitName(unit)} start={null} /> },
    ],
  },
  learn: {
    title: "9. Learn",
    states: [
      {
        state: "home",
        label: "Tables and lessons",
        unit: shellUnit,
        render: () => <LearnHome groups={[{ packId: D.pack.pack_id, title: D.pack.sources[0]?.title ?? "", trees: D.trees }]} lessons={D.lessons} titles={titles} />,
      },
      { state: "tree", label: "A whole table", unit: shellUnit, render: () => <TreeStudy tree={D.tree} packId={D.pack.pack_id} titles={titles} /> },
      {
        state: "practice-summary",
        label: "Practice, mastery by skill",
        unit: shellUnit,
        render: () => <LearnHome groups={[{ packId: D.pack.pack_id, title: D.pack.sources[0]?.title ?? "", trees: D.trees }]} lessons={D.lessons} titles={titles} practice={<PracticeSummary packId="pump40v2-proof" items={PI} report={reportOf({ ix: pix, state: pstate }, T0 + 3_600_000)} />} />,
      },
      { state: "practice-item", label: "Practice, a question", unit: shellUnit, render: () => <PracticeItem {...practiceItem} /> },
      { state: "practice-answered", label: "Practice, answered wrong", unit: shellUnit, render: () => <PracticeItem {...practiceItem} chosen={(Number(pq.answer) + 1) % pq.choices.length} /> },
      { state: "practice-review", label: "Practice, a review", unit: shellUnit, render: () => <PracticeItem {...practiceItem} reason="review" chosen={Number(pq.answer)} /> },
    ],
  },
  records: {
    title: "10. Sync and records",
    states: [
      { state: "records", label: "Queue, notes, audit, pack", unit: shellUnit, render: () => <Records {...records} /> },
      { state: "chain", label: "Chain checked", unit: shellUnit, render: () => <Records {...records} chain={D.chain} /> },
      { state: "model-not-asked", label: "Model set up, not asked yet", unit: shellUnit, render: () => <Records {...records} llm={D.llmBefore} modelOn /> },
      { state: "model-on", label: "Model answered, switch on", unit: shellUnit, render: () => <Records {...records} llm={D.llm} modelOn /> },
      { state: "model-off", label: "Model set up, switched off", unit: shellUnit, render: () => <Records {...records} llm={D.llm} /> },
    ],
  },
  review: {
    title: "11. Review (hub)",
    states: [
      { state: "queue", label: "A lesson to review", unit: null, render: () => <Review {...review} /> },
      {
        state: "edited",
        label: "Edited before approval",
        unit: null,
        render: () => <Review {...review} draft={{ text: "Check the battery date code first: batteries over three years old failed the voltage test.", note: "Made it a check to do first.", version: null }} />,
      },
      {
        state: "conflict",
        label: "Two units' versions to choose from",
        unit: null,
        render: () => {
          const l = first!.current;
          const other = { ...l, cause: "Battery terminals corroded", action: "Cleaned and greased the terminals", note: null };
          const item: ReviewItem = {
            ...first!,
            needs_reviewer: true,
            versions: [
              { device_id: "dev-15db3c55739b5c4c", item_id: "item-a", lesson: l, received_at: l.created_at, state: "current", updated_at: l.updated_at },
              { device_id: "dev-8e21f07a9c4b3d11", item_id: "item-b", lesson: other, received_at: l.created_at, state: "lost", updated_at: l.updated_at },
            ],
          };
          return <Review {...review} queue={[item]} selected={item} draft={{ text: hubNote(l), note: "", version: "item-a" }} />;
        },
      },
      { state: "reviewer-only", label: "Signed in as a reviewer only", unit: null, render: () => <Review {...review} me={{ name: "Line reviewer", roles: ["reviewer"], via: "token" }} devices={null} /> },
      { state: "sign-in", label: "Sign in", unit: null, render: () => <HubSignIn error={null} busy={false} onSignIn={none} /> },
      {
        state: "empty",
        label: "Nothing waiting",
        unit: null,
        render: () => (
          <Review
            {...review}
            queue={[]}
            selected={null}
            draft={null}
            approved={reviewQueue.map((r) => ({ ...r, status: "approved", reviews: [{ action: "approve", at: r.current.created_at, item_id: r.lesson_id, note: null, reviewer: "Shop supervisor" }] }))}
          />
        ),
      },
    ],
  },
});

export function GalleryIndex() {
  return (
    <Shell unit={null} link="offline" queued={0}>
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-10 sm:px-6 lg:px-8">
        <h1 className="mb-1 text-h2 sm:text-h1">Design</h1>
        <p className="mb-6 text-body text-ink-2">Every screen and state, from data the engine returned for the Model 40 fixture.</p>
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(GALLERY).map(([screen, g]) => (
            <section key={screen}>
              <h2 className="mb-2 text-h3">{g.title}</h2>
              <ul className="m-0 list-none overflow-hidden rounded-panel border border-line bg-surface p-0">
                {g.states.map((s) => (
                  <li key={s.state} className="border-b border-line last:border-b-0">
                    <Link to={designPath(screen, s.state)} className="flex min-h-12 items-center px-4 text-small font-semibold text-ink no-underline">
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function GalleryState() {
  const { screen = "", state = "" } = useParams();
  const entry = GALLERY[screen]?.states.find((s) => s.state === state);
  if (!entry)
    return (
      <Shell unit={null} link="offline" queued={0}>
        <div className="px-6 py-10">
          <Link to={designPath()}>No such state. Open the gallery.</Link>
        </div>
      </Shell>
    );
  return (
    <AssetSource.Provider value={imageFor}>
      <ManualPack.Provider value={D.pack.pack_id}>
        <RefTables.Provider value={{ [D.pack.pack_id]: D.tables }}>
        {entry.bare ? (
          entry.render()
        ) : (
          <Shell unit={entry.unit} link="offline" queued={D.outbox.pending}>
            {entry.render()}
          </Shell>
        )}
        </RefTables.Provider>
      </ManualPack.Provider>
    </AssetSource.Provider>
  );
}
