/**
 * /design: every screen in every state, inside the real shell, from data the
 * engine returned (captured.json, written by scripts/capture-samples.mjs from
 * the fictional Model 40 pump fixture). Development and design builds only.
 * Test data for components: the handlers do nothing and nothing here decides anything.
 */
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import type {
  AskResponse,
  Asset,
  AuditRecord,
  ChainReport,
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
import { CloseOut, type CloseOutProps } from "../screens/CloseOut.tsx";
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
import { Review, suggestedNote, type ReviewProps } from "../screens/Review.tsx";
import { designPath } from "../routes.ts";
import { unitName } from "../ui/format.ts";
import { AssetSource } from "../ui/manual.tsx";
import { Shell, type ShellUnit } from "../ui/Shell.tsx";
import raw from "./captured.json";

interface Captured {
  pack: PackInfoView;
  equipment: EquipView[];
  trees: FaultTree[];
  assets: Asset[];
  resolve: { resolved: Resolved; ambiguous: Resolved; none: Resolved };
  search: { results: SymptomSearch; none: SymptomSearch; closest: SymptomSearch; codes: SymptomSearch };
  steps: Record<"symptom" | "check" | "checkLevel2" | "value" | "action" | "back" | "passfail" | "escalate" | "actionCheck" | "end" | "choice", JobView>;
  task: TaskView;
  tasks: import("../engine/types.ts").TaskSummary[];
  run: Run;
  ask: AskResponse;
  askDeclined: AskResponse;
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
const index: IndexGroup[] = D.pack.systems.map((system) => ({ system, trees: D.trees.filter((t) => t.system === system) }));

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
  query: "",
  search: null,
  codes: [],
  signalKinds: D.pack.signal_kinds,
  index,
  voice: "unavailable",
  onQuery: none,
  onAddCode: none,
  onRemoveCode: none,
  onVoice: none,
  onStartSymptom: none,
  onStartTree: none,
  onStartSignal: none,
};

const step = (v: JobView, extra: Partial<StepProps> = {}): StepProps => ({
  job: v.job,
  step: v.step!,
  levels: D.pack.levels,
  phase: "ready",
  draft: "",
  note: "",
  photos: 0,
  keypadOpen: false,
  overlay: null,
  onDraft: none,
  onKeypad: none,
  onAnswer: none,
  onLevel: none,
  onBack: none,
  onPhoto: none,
  onNote: none,
  onAskQuery: none,
  ...extra,
});

const lessonFrom = (s: JobView) => ({ cause: "", action: s.step!.node.text, parts: D.task.requirements.filter((r) => r.kind === "part").map((r) => ({ ident: r.ident, text: r.text, qty: r.qty })), minutes: 45, note: "" });

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
  ...extra,
});

const pageAsset = D.steps.check.step!.assets.find((a) => a.role === "page")!;

const taskPage = (extra: Partial<TaskPageProps> = {}): TaskPageProps => ({
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
  pack: D.pack,
  notes: D.fieldNotes,
  audit: D.audit,
  chain: null,
  model: null,
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
const reviewItem = (l: Lesson): ReviewItem => ({ current: l, first_received_at: l.created_at, lesson_id: l.lesson_id, reopened: false, reviews: [], status: "pending", versions: [] });
const reviewQueue = D.lessons.map(reviewItem);
const first = reviewQueue[0] ?? null;
const hubStatus: HubStatus = { bundles: 1, conflicts: 0, devices: 2, items: 3, jobs: 2, key_id: "1c3d7ada6ee7d67c", latest_bundle: 1, lessons_approved: 1, lessons_pending: reviewQueue.length, lessons_rejected: 0, stream: "pump40-fleet" };
const review: ReviewProps = {
  status: hubStatus,
  queue: reviewQueue,
  approved: [],
  selected: first,
  titles,
  variants: variantsById,
  draft: first ? { text: suggestedNote(first.current), note: "" } : null,
  suggested: first ? suggestedNote(first.current) : "",
  reviewer: "Shop supervisor",
  busy: false,
  onReviewer: none,
  onDraft: none,
  onApprove: none,
  onReject: none,
  onPublish: none,
};

const sectionPage = D.section.assets.find((a) => a.role === "page") ?? null;

export const GALLERY: Record<string, { title: string; states: Entry[] }> = {
  home: {
    title: "1. Fleet",
    states: [
      { state: "first-run", label: "First run", unit: null, render: () => <Home loading={false} units={[]} variants={variants} openJobs={[]} pending={0} lastSync={null} /> },
      { state: "loading", label: "Loading", unit: null, render: () => <Home loading units={[]} variants={variants} openJobs={[]} pending={0} lastSync={null} /> },
      { state: "fleet", label: "Units and open jobs", unit: shellUnit, render: () => <Home loading={false} units={D.assets} variants={variants} openJobs={openJobs} pending={D.outbox.pending} lastSync={D.outbox.last_synced_at} /> },
    ],
  },
  identify: {
    title: "2. Add a unit",
    states: [
      { state: "entry", label: "Typing the plate", unit: null, render: () => <Identify {...identify} mode="type" phase="entry" result={null} /> },
      { state: "resolving", label: "Identifying", unit: null, render: () => <Identify {...identify} mode="type" phase="resolving" result={null} /> },
      { state: "resolved", label: "Resolved, with the rule", unit: null, render: () => <Identify {...identify} mode="type" phase="done" result={D.resolve.resolved} name="Pump 104" hours="12" /> },
      { state: "general", label: "Model only, no variant", unit: null, render: () => <Identify {...identify} mode="type" phase="done" observed={{ model: "Model 40" }} result={D.resolve.ambiguous} general /> },
      { state: "none", label: "No match", unit: null, render: () => <Identify {...identify} mode="type" phase="done" observed={{ serial: "ZZ-0001" }} result={D.resolve.none} /> },
      { state: "connect", label: "Connect, no link", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} /> },
      { state: "connect-ready", label: "Connect, link present", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} canConnect /> },
    ],
  },
  unit: {
    title: "3. Unit",
    states: [
      { state: "history", label: "History, repeats, fleet", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={D.history} openJob={openJobs[0] ?? null} /> },
      { state: "new", label: "New unit", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={{ ...D.history, events: [], jobs: [], fleet_history: [], failure_modes: [] }} openJob={null} /> },
      { state: "loading", label: "Loading history", unit: shellUnit, render: () => <UnitPage unit={unit} variant={variant} history={null} openJob={null} /> },
    ],
  },
  describe: {
    title: "4. Describe the problem",
    states: [
      { state: "empty", label: "Nothing typed", unit: shellUnit, render: () => <Describe {...describe} phase="empty" /> },
      { state: "searching", label: "Searching", unit: shellUnit, render: () => <Describe {...describe} query="engine does not crank" phase="searching" /> },
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
      { state: "ask", label: "Ask, cited answer", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "How do I check fuse F2?", answer: D.ask } })} /> },
      { state: "ask-declined", label: "Ask, not in the manual", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "What colour is the paint?", answer: D.askDeclined } })} /> },
      { state: "ask-loading", label: "Ask, loading", unit: shellUnit, render: () => <Step {...step(D.steps.check, { overlay: { kind: "ask", query: "How do I check fuse F2?", answer: null } })} /> },
      { state: "action", label: "Corrective action reached", unit: shellUnit, render: () => <Step {...step(D.steps.action)} /> },
      { state: "escalate", label: "Refer", unit: shellUnit, render: () => <Step {...step(D.steps.escalate)} /> },
      { state: "end", label: "Fault corrected", unit: shellUnit, render: () => <Step {...step(D.steps.end)} /> },
    ],
  },
  close: {
    title: "6. Close-out",
    states: [
      { state: "action", label: "Corrective action, task run", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action)} /> },
      { state: "verify", label: "Did it fix it?", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action, { phase: "verify" })} /> },
      { state: "lesson", label: "Lesson, prefilled", unit: shellUnit, render: () => <CloseOut {...close(D.steps.action, { phase: "lesson" })} /> },
      { state: "referral", label: "Referral", unit: shellUnit, render: () => <CloseOut {...close(D.steps.escalate, { phase: "lesson", resolution: "escalated", task: null, draft: { ...lessonFrom(D.steps.escalate), parts: [] } })} /> },
      { state: "queued", label: "Saved, waiting to sync", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "saved", saved: D.closed.lesson })} /> },
      { state: "approved", label: "Approved", unit: shellUnit, render: () => <CloseOut {...close(D.steps.end, { phase: "saved", saved: { ...D.closed.lesson!, status: "approved" } })} /> },
    ],
  },
};

Object.assign(GALLERY, {
  tasks: {
    title: "7. Maintenance tasks",
    states: [
      { state: "list", label: "Tasks for the variant", unit: shellUnit, render: () => <TaskList variant={variant} tasks={D.tasks} /> },
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
      { state: "contents", label: "Contents and search", unit: shellUnit, render: () => <ManualHome title={D.pack.sources.map((x) => `${x.title}, ${x.edition}`).join("; ")} contents={D.manualTop} /> },
      { state: "section", label: "A section", unit: shellUnit, render: () => <SectionReader view={D.section} page={sectionPage} pageOpen={false} src={(a) => imageFor(D.pack.pack_id, a)} /> },
      { state: "page", label: "Original page, passage marked", unit: shellUnit, render: () => <SectionReader view={D.section} page={sectionPage} pageOpen src={(a) => imageFor(D.pack.pack_id, a)} /> },
      { state: "search", label: "Search results", unit: shellUnit, render: () => <ManualResults query="battery voltage" hits={D.manualSearch.hits} /> },
    ],
  },
  learn: {
    title: "9. Learn",
    states: [
      { state: "home", label: "Tables and lessons", unit: shellUnit, render: () => <LearnHome trees={D.trees} lessons={D.lessons} titles={titles} /> },
      { state: "tree", label: "A whole table", unit: shellUnit, render: () => <TreeStudy tree={D.tree} /> },
    ],
  },
  records: {
    title: "10. Sync and records",
    states: [
      { state: "records", label: "Queue, notes, audit, pack", unit: shellUnit, render: () => <Records {...records} /> },
      { state: "chain", label: "Chain checked", unit: shellUnit, render: () => <Records {...records} chain={D.chain} model="gemma-4-e4b" modelOn /> },
    ],
  },
  review: {
    title: "11. Review (hub)",
    states: [
      { state: "queue", label: "A lesson to review", unit: null, render: () => <Review {...review} /> },
      { state: "edited", label: "Edited before approval", unit: null, render: () => <Review {...review} draft={{ text: "Check the battery date code first: batteries over three years old failed the voltage test.", note: "Made it a check to do first." }} /> },
      { state: "empty", label: "Nothing waiting", unit: null, render: () => <Review {...review} queue={[]} selected={null} draft={null} approved={reviewQueue.map((r) => ({ ...r, status: "approved", reviews: [{ action: "approve", at: r.current.created_at, item_id: r.lesson_id, note: null, reviewer: "Shop supervisor" }] }))} /> },
    ],
  },
});

export function GalleryIndex() {
  return (
    <Shell unit={null} online={false} queued={0}>
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
      <Shell unit={null} online={false} queued={0}>
        <div className="px-6 py-10">
          <Link to={designPath()}>No such state. Open the gallery.</Link>
        </div>
      </Shell>
    );
  return (
    <AssetSource.Provider value={imageFor}>
      {entry.bare ? (
        entry.render()
      ) : (
        <Shell unit={entry.unit} online={false} queued={D.outbox.pending}>
          {entry.render()}
        </Shell>
      )}
    </AssetSource.Provider>
  );
}
