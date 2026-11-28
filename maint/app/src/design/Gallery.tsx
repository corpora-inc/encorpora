/**
 * /design: every screen in every state, from sample props, inside the real
 * shell. Development and design builds only. Test data for components: the
 * handlers do nothing and nothing here decides anything.
 */
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { CloseOut, type CloseOutProps } from "../screens/CloseOut.tsx";
import { Describe, type DescribeProps } from "../screens/Describe.tsx";
import { Home } from "../screens/Home.tsx";
import { Identify, type IdentifyProps } from "../screens/Identify.tsx";
import { Step, type StepProps } from "../screens/Step.tsx";
import { UnitPage } from "../screens/UnitPage.tsx";
import { designPath } from "../routes.ts";
import { Shell, type ShellUnit } from "../ui/Shell.tsx";
import * as S from "./samples.ts";

const none = () => {};
const unit = S.UNITS[0]!;
const shellUnit: ShellUnit = { asset_id: unit.asset_id, name: unit.name, variant: unit.variant };

interface Entry {
  state: string;
  label: string;
  unit: ShellUnit | null;
  online?: boolean;
  render(): ReactNode;
}

const identify: Omit<IdentifyProps, "mode" | "phase" | "result"> = { observed: { serial: "40D-4172", plate_text: "MODEL 40 UTILITY PUMP" }, picked: null, fleetNumber: "P40-0172", canConnect: false, onObserved: none, onResolve: none, onPick: none, onFleetNumber: none, onSave: none, onConnect: none };

const describe: Omit<DescribeProps, "phase"> = {
  unit,
  query: "",
  hits: [],
  codes: null,
  usedCodes: [],
  signal: null,
  index: S.INDEX,
  voice: "idle",
  clarify: null,
  onQuery: none,
  onToggleCode: none,
  onVoice: none,
  onStart: none,
  onStartSignal: none,
};

const step: Omit<StepProps, "step"> = {
  symptom: "Low discharge pressure",
  phase: "ready",
  draft: "",
  attachments: [],
  testOpen: false,
  overlay: null,
  model: false,
  onDraft: none,
  onAnswer: none,
  onLevel: none,
  onTestOpen: none,
  onBack: none,
  onPhoto: none,
  onNote: none,
  onAskQuery: none,
};

const close: Omit<CloseOutProps, "phase"> = {
  symptom: "Low discharge pressure",
  action: S.STEP_ACTION,
  procedure: S.PROCEDURE,
  verify: S.VERIFY,
  done: [1, 2],
  lesson: S.LESSON,
  onStepDone: none,
  onProcedureDone: none,
  onVerified: none,
  onLesson: none,
  onSave: none,
};

export const GALLERY: Record<string, { title: string; states: Entry[] }> = {
  home: {
    title: "1. Fleet",
    states: [
      { state: "first-run", label: "First run", unit: null, render: () => <Home loading={false} units={[]} jobs={[]} queued={0} lastSync={null} /> },
      { state: "loading", label: "Loading", unit: null, render: () => <Home loading units={[]} jobs={[]} queued={0} lastSync={null} /> },
      { state: "fleet", label: "Units and open jobs", unit: shellUnit, render: () => <Home loading={false} units={S.UNITS} jobs={S.JOBS} queued={3} lastSync="Today 06:40" /> },
    ],
  },
  identify: {
    title: "2. Add a unit",
    states: [
      { state: "entry", label: "Typing the plate", unit: null, render: () => <Identify {...identify} mode="type" phase="entry" result={null} /> },
      { state: "resolving", label: "Identifying", unit: null, render: () => <Identify {...identify} mode="type" phase="resolving" result={null} /> },
      { state: "resolved", label: "Resolved, with the rule", unit: null, render: () => <Identify {...identify} mode="type" phase="done" result={S.RESOLVED} /> },
      { state: "ambiguous", label: "Two variants match", unit: null, render: () => <Identify {...identify} mode="type" phase="done" result={S.AMBIGUOUS} observed={{ plate_text: "MODEL 40" }} picked="m40-e" /> },
      { state: "none", label: "No match", unit: null, render: () => <Identify {...identify} mode="type" phase="done" result={S.NO_MATCH} observed={{ serial: "41X-0001" }} /> },
      { state: "connect", label: "Connect, no link", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} /> },
      { state: "connect-ready", label: "Connect, link present", unit: null, render: () => <Identify {...identify} mode="connect" phase="entry" result={null} canConnect /> },
    ],
  },
  unit: {
    title: "3. Unit",
    states: [
      { state: "history", label: "History, repeats, fleet", unit: shellUnit, render: () => <UnitPage unit={unit} history={S.HISTORY} codes={null} openJob={S.JOBS[0]!} /> },
      { state: "connected", label: "Connected, active codes", unit: shellUnit, render: () => <UnitPage unit={unit} history={S.HISTORY} codes={S.CODES} openJob={null} /> },
      { state: "new", label: "New unit", unit: shellUnit, render: () => <UnitPage unit={unit} history={S.HISTORY_EMPTY} codes={null} openJob={null} /> },
      { state: "loading", label: "Loading history", unit: shellUnit, render: () => <UnitPage unit={unit} history={null} codes={null} openJob={null} /> },
    ],
  },
  describe: {
    title: "4. Describe the problem",
    states: [
      { state: "empty", label: "Nothing typed", unit: shellUnit, render: () => <Describe {...describe} phase="empty" /> },
      { state: "searching", label: "Searching", unit: shellUnit, render: () => <Describe {...describe} query="weak pressure" phase="searching" /> },
      { state: "results", label: "Ranked symptoms", unit: shellUnit, render: () => <Describe {...describe} query="weak flow, pressure low" phase="results" hits={S.HITS} /> },
      { state: "codes", label: "With fault codes", unit: shellUnit, render: () => <Describe {...describe} query="" phase="results" hits={S.HITS.slice(0, 1)} codes={S.CODES} usedCodes={["F214"]} signal={S.SIGNAL} /> },
      { state: "none", label: "No match", unit: shellUnit, render: () => <Describe {...describe} query="smells like toast" phase="none" /> },
      { state: "listening", label: "Voice, listening", unit: shellUnit, render: () => <Describe {...describe} phase="empty" voice="listening" /> },
      {
        state: "clarify",
        label: "Model on, one question",
        unit: shellUnit,
        render: () => (
          <Describe
            {...describe}
            query="weak flow"
            phase="results"
            hits={S.HITS.slice(0, 2)}
            clarify={{ question: "Does the pump hold prime after it stops?", options: [{ label: "Holds prime", symptom_id: "s-low" }, { label: "Loses prime", symptom_id: "s-prime" }] }}
          />
        ),
      },
    ],
  },
  step: {
    title: "5. Guided troubleshooting",
    states: [
      { state: "check", label: "Yes/no, detailed", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK} /> },
      { state: "check-brief", label: "Yes/no, experienced", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK_BRIEF} /> },
      { state: "value", label: "Measured value", unit: shellUnit, render: () => <Step {...step} step={S.STEP_VALUE} draft="-12" /> },
      { state: "passfail", label: "Pass or fail", unit: shellUnit, render: () => <Step {...step} step={S.STEP_PASSFAIL} /> },
      { state: "page", label: "Original page open", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK} overlay={{ kind: "page", asset: S.STEP_CHECK.assets[0]! }} /> },
      { state: "attached", label: "Photo and note", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK_BRIEF} attachments={S.ATTACHMENTS} /> },
      { state: "sending", label: "Result sent", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK_BRIEF} phase="sending" /> },
      { state: "ask", label: "Ask, cited answer", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK} overlay={{ kind: "ask", query: S.ASK.query, answer: S.ASK }} /> },
      { state: "ask-model", label: "Ask, model on", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK} model overlay={{ kind: "ask", query: S.ASK.query, answer: S.ASK_MODEL }} /> },
      { state: "ask-loading", label: "Ask, loading", unit: shellUnit, render: () => <Step {...step} step={S.STEP_CHECK} overlay={{ kind: "ask", query: S.ASK.query, answer: null }} /> },
      { state: "action", label: "Corrective action", unit: shellUnit, render: () => <Step {...step} step={S.STEP_ACTION} /> },
      { state: "escalate", label: "Refer", unit: shellUnit, render: () => <Step {...step} step={S.STEP_ESCALATE} /> },
    ],
  },
  close: {
    title: "6. Close-out",
    states: [
      { state: "procedure", label: "Corrective action", unit: shellUnit, render: () => <CloseOut {...close} phase="procedure" /> },
      { state: "verify", label: "Did it fix it?", unit: shellUnit, render: () => <CloseOut {...close} phase="verify" /> },
      { state: "lesson", label: "Lesson, prefilled", unit: shellUnit, render: () => <CloseOut {...close} phase="lesson" /> },
      { state: "saved", label: "Saved on this device", unit: shellUnit, render: () => <CloseOut {...close} phase="saved" /> },
      { state: "queued", label: "Waiting to sync", unit: shellUnit, render: () => <CloseOut {...close} phase="saved" lesson={{ ...S.LESSON, status: "queued" }} /> },
      { state: "approved", label: "Approved", unit: shellUnit, online: true, render: () => <CloseOut {...close} phase="saved" lesson={{ ...S.LESSON, status: "approved" }} /> },
    ],
  },
};

/** Every gallery URL, for the browser checks and screenshots. */
export const GALLERY_ROUTES = Object.entries(GALLERY).flatMap(([screen, g]) => g.states.map((s) => designPath(screen, s.state)));

export function GalleryIndex() {
  return (
    <Shell unit={null} online={false} queued={0}>
      <div className="mx-auto w-full max-w-[1100px] px-4 pt-5 pb-10 sm:px-6 lg:px-8">
        <h1 className="mb-1 text-h2 sm:text-h1">Design</h1>
        <p className="mb-6 text-body text-ink-2">Every screen and state, from sample props.</p>
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
    <Shell unit={entry.unit} online={entry.online ?? false} queued={3}>
      {entry.render()}
    </Shell>
  );
}
