/** DEV/TEST-ONLY: every studio screen and state outside the activity format, from TEST FIXTURE
 * props (?s=<scenario>). `npm run sweep` screenshots each one at phone, tablet and desktop sizes in
 * light and dark. Nothing here is learner data or AI output. `window.__scenarios` lists the ids;
 * `window.__ready` turns true once a scenario's scripted taps have run. */
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { Studio, type StudioProps, type StudioActivity } from "../Studio";
import { fixtures } from "../../activity/fixtures";
import { gradeActivity, type GradeOutcome } from "../../activity/grade";
import { growthSummary } from "../../application/growth";

const noop = () => {};
const day = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * day).toISOString();
const local: Record<string, StudioActivity & { answer: string; hint: string; explain: string }> = {
  short: { id: "l-short", title: "", prompt: "7 × 8 = ?", skill: "Recall multiplication facts", answerKind: "number", answer: "56",
    hint: "Think of 7 × 8 as 7 × 4, doubled.", explain: "7 × 4 = 28, and 28 doubled is **56**." },
  visual: { id: "l-visual", title: "", prompt: "How many dots are in the array? Count the rows, then the columns.", skill: "Equal rows", answerKind: "number",
    visual: { type: "array", rows: 3, columns: 6 }, answer: "18", hint: "There are 3 rows of 6.", explain: "3 rows of 6 dots: 6 + 6 + 6 = **18**." },
  fraction: { id: "l-fraction", title: "", prompt: "What fraction of the bar is shaded?", skill: "Fractions", answerKind: "fraction",
    visual: { type: "fraction", numerator: 3, denominator: 8 }, answer: "3/8", hint: "Count the shaded parts, then all the parts.", explain: "3 of the 8 equal parts are shaded: **3/8**." },
  choice: { id: "l-choice", title: "", prompt: "Which number is closest to 500?", skill: "Rounding", answerKind: "choice",
    choices: ["449", "512", "560", "605"].map(x => ({ id: x, label: x })), answer: "512", hint: "Find how far each number is from 500.", explain: "512 is only 12 away from 500." },
  compare: { id: "l-compare", title: "", prompt: "Compare: 3/4 ☐ 5/8", skill: "Compare fractions", answerKind: "comparison", answer: ">",
    hint: "Write 3/4 in eighths.", explain: "3/4 = 6/8, and 6/8 > 5/8." },
  signed: { id: "l-signed", title: "", prompt: "Solve for x: 3x + 14 = 2", skill: "Linear equations", answerKind: "number", signed: true, answer: "-4",
    hint: "Subtract 14 from both sides first.", explain: "3x = −12, so x = **−4**." },
  long: { id: "l-long", title: "", prompt: "A rectangle is 12 cm long and 7 cm wide. A second rectangle has the same perimeter but is 10 cm long. What is the area of the second rectangle, in square centimetres?", skill: "Perimeter and area", answerKind: "number",
    visual: { type: "rectangle", width: 12, height: 7 }, answer: "90", hint: "Find the perimeter of the first rectangle: 2 × (12 + 7).", explain: "The perimeter is 38 cm, so the second is 10 by 9: **90** square cm." },
};
const week = (done: number[]) => growthSummary(undefined).week.map((d, i) => ({ ...d, practiced: done.includes(6 - i) }));
const growth: NonNullable<StudioProps["growth"]> = {
  week: week([0, 1, 2, 3, 5]), streak: 4,
  areas: [
    { id: "operations", label: "Operations", skills: [
      { id: "3.OA.C.7", title: "Recall multiplication and division facts", status: "confident" },
      { id: "3.OA.A.4", title: "Find missing factors and quotients", status: "growing" },
      { id: "3.OA.D.9", title: "Identify arithmetic patterns and explain them", status: "review" }] },
    { id: "fractions", label: "Fractions and ratios", skills: [
      { id: "3.NF.A.1", title: "Interpret numerator and denominator through parts", status: "growing" },
      { id: "3.NF.A.3", title: "Explain equivalence and compare fractional quantities", status: "growing" }] },
    { id: "number", label: "Number sense", skills: [{ id: "3.NBT.A.1", title: "Round quantities to tens and hundreds", status: "confident" }] },
    { id: "measurement", label: "Measurement", skills: [{ id: "3.MD.C.7", title: "Connect rectangular area with multiplication", status: "review" }] },
  ],
  recent: [
    { skillId: "3.NF.A.3", title: "Explain equivalence and compare fractional quantities", area: "Fractions and ratios", at: ago(0) },
    { skillId: "3.OA.C.7", title: "Recall multiplication and division facts", area: "Operations", at: ago(1) },
    { skillId: "3.NBT.A.1", title: "Round quantities to tens and hundreds", area: "Number sense", at: ago(3) },
  ],
};
const signedIn: StudioProps["account"] = { connected: true, aiReady: true, label: "Signed in as maple", balance: "41.2 2Z", budget: "100 2Z per month", budgetLeft: "86.5 2Z", batchCost: "≈ 0.6 2Z" };
const modelMenu: StudioProps["modelMenu"] = { choice: "auto", auto: { name: "GPT-5 mini", batch2z: "0.6" }, options: [{ id: "a", name: "GPT-5 mini", batch2z: "0.6" }, { id: "b", name: "Claude Sonnet 5", batch2z: "1.4" }] };
const statsLines = ["GPT-5 mini: 6 batches, 41 answered, 78% correct, 1 flagged, ≈ 0.58 2Z per batch", "Claude Sonnet 5: 2 batches, 14 answered, 86% correct, 0 flagged, ≈ 1.31 2Z per batch"];

type Scenario = {
  local?: keyof typeof local; ai?: string; props?: Partial<StudioProps>;
  /** Taps after mount, by accessible name; "type:<value>" fills the answer field; "settings" opens Settings. */
  steps?: string[]; hold?: boolean;
};
const scenarios: Record<string, Scenario> = {
  "home-new": {},
  "home-continue": { local: "short", props: { session: { completed: 4 }, growth } },
  "home-lap": { props: { session: { completed: 10 }, growth } },
  "home-busy": { props: { busy: true, busyLabel: "Preparing your next discovery…" } },
  "home-error": { props: { error: "The answer save could not be confirmed. We reloaded your durable progress before allowing another attempt." } },
  "home-preview": { props: { mode: "preview" } },
  "growth-empty": { steps: ["Growth"] },
  "growth-rich": { props: { growth, session: { completed: 6 } }, steps: ["Growth"] },
  "focus-short": { local: "short", steps: ["Continue"] },
  "focus-visual": { local: "visual", steps: ["Continue"] },
  "focus-fraction": { local: "fraction", steps: ["Continue"] },
  "focus-choice": { local: "choice", steps: ["Continue"] },
  "focus-compare": { local: "compare", steps: ["Continue"] },
  "focus-signed": { local: "signed", steps: ["Continue"] },
  "focus-long": { local: "long", steps: ["Continue"] },
  "focus-hint": { local: "visual", steps: ["Continue", "Hint"] },
  "focus-showme": { local: "visual", steps: ["Continue", "Show me how"] },
  "focus-nudge": { local: "short", steps: ["Continue", "type:54", "Check"] },
  "focus-correct": { local: "short", steps: ["Continue", "type:56", "Check"] },
  "focus-streak": { local: "short", props: { session: { completed: 4 } }, steps: ["Continue", "type:56", "Check", "Next", "type:56", "Check", "Next", "type:56", "Check"] },
  "focus-incorrect": { local: "visual", steps: ["Continue", "type:15", "Check", "type:16", "Check", "See how"] },
  "focus-lap": { local: "short", props: { session: { completed: 9 } }, steps: ["Continue", "type:56", "Check"] },
  "focus-veil": { local: "short", hold: true, steps: ["Continue", "type:56", "Check", "Next"] },
  "focus-preparing": { hold: true, props: { onCancel: noop }, steps: ["Let’s begin"] },
  "focus-empty": { steps: ["Let’s begin"] },
  "focus-error": { local: "short", props: { error: "TEST: the session could not be saved. Your recorded progress is safe." }, steps: ["Continue"] },
  "focus-ai": { ai: "fx-3-fraction-bar", steps: ["Continue"] },
  "focus-ai-choice": { ai: "fx-k-make-ten", steps: ["Continue"] },
  "focus-ai-hint": { ai: "fx-3-area-tiles", steps: ["Continue", "Hint"] },
  "focus-ai-wrong": { ai: "fx-3-area-tiles", steps: ["Continue", "type:3", "Check"] },
  "focus-ai-correct": { ai: "fx-1-number-line-hop", steps: ["Continue", "type:13", "Check"] },
  "sheet-status-local": { local: "short", steps: ["Continue", "status"] },
  "sheet-status-ai": { ai: "fx-3-fraction-bar", props: { authoringModel: "GPT-5 mini" }, steps: ["Continue", "status"] },
  "sheet-ask": { local: "visual", steps: ["Continue", "Ask a question"] },
  "sheet-ask-thinking": { local: "visual", props: { busy: true, curiosity: { question: "Where would I use this in real life?" }, onCancel: noop }, steps: ["Continue"] },
  "sheet-ask-answer": { local: "visual", props: { curiosity: { question: "Where would I use this in real life?", answer: "Arrays show up whenever things are lined up in **rows**: egg cartons, seats in a theatre, a muffin tray. Counting one row and multiplying is faster than counting every single one." } }, steps: ["Continue"] },
  "sheet-flag": { local: "short", steps: ["Continue", "Something seems off"] },
  "settings-out": { steps: ["settings"] },
  "settings-out-bottom": { steps: ["settings", "scroll-end"] },
  "settings-in": { props: { account: signedIn, modelMenu, loadModelStats: async () => statsLines, learners: [{ id: "a", name: "Maple" }, { id: "b", name: "River" }] }, steps: ["settings"] },
  "settings-stats": { props: { account: signedIn, modelMenu, loadModelStats: async () => statsLines }, steps: ["settings", "Model stats", "scroll-end"] },
  "settings-budget": { props: { account: { connected: true, aiReady: false, label: "Signed in as maple", balance: "0.4 2Z", refusal: "raise_budget", status: "Your app budget for this month is used up. Raise it in Free2Z to keep AI tutoring going." } }, steps: ["settings"] },
  "settings-report": { steps: ["settings", "Report a problem", "scroll-end"] },
  "settings-delete": { steps: ["settings", "Delete this learner’s local progress", "scroll-end"] },
  "settings-error": { props: { error: "TEST backup destination unavailable" }, steps: ["settings"] },
};
declare global { interface Window { __scenarios?: string[]; __ready?: boolean; __release?: () => void } }
window.__scenarios = Object.keys(scenarios);

const params = new URLSearchParams(location.search);
const id = params.get("s") ?? "home-new";
const scenario = scenarios[id] ?? {};
const aiSpec = scenario.ai ? fixtures.find(f => f.id === scenario.ai) : undefined;

function fill(value: string) {
  const input = document.querySelector<HTMLInputElement>(".focus-dock input:not([type=radio]), .ax-dock input, .aha-activity input[inputmode]");
  if (!input) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
function press(name: string) {
  const el = [...document.querySelectorAll<HTMLElement>("button, summary, [role=switch]")]
    .find(b => b.checkVisibility() && (b.getAttribute("aria-label") === name || b.textContent?.trim() === name || b.textContent?.trim().startsWith(name)));
  if (!el) console.warn(`gallery: no control named ${name}`);
  el?.click();
}

function Harness() {
  const task = scenario.local ? local[scenario.local] : undefined;
  const [shown, setShown] = useState(!!task || !!aiSpec);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState<StudioProps["feedback"]>();
  const [result, setResult] = useState<GradeOutcome>();
  const [hint, setHint] = useState<string>();
  const [hints, setHints] = useState(0);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState(0);
  const [completed, setCompleted] = useState(scenario.props?.session?.completed ?? 3);
  const next = () => {
    if (scenario.hold) { setBusy(true); return; }
    setAnswered(false); setFeedback(undefined); setResult(undefined); setHint(undefined); setHints(0); setTries(0); setRound(r => r + 1); setShown(true);
  };
  useEffect(() => {
    let live = true;
    void (async () => {
      const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
      await wait(120);
      for (const step of scenario.steps ?? []) {
        if (!live) return;
        if (step.startsWith("type:")) fill(step.slice(5));
        else if (step === "settings") press("Settings");
        else if (step === "status") document.querySelector<HTMLElement>(".status-dot")?.click();
        else if (step === "scroll-end") { const d = document.querySelector(".settings-dialog[open]"); d?.scrollTo(0, d.scrollHeight); }
        else press(step);
        await wait(step === "Next" ? 120 : 260);
      }
      await wait(scenario.steps?.length ? 900 : 300);
      window.__ready = true;
    })();
    return () => { live = false; };
  }, []);
  const activity = shown && task ? { ...task, id: `${task.id}-${round}` } : undefined;
  const spec = shown && aiSpec ? aiSpec : undefined;
  const props: StudioProps = {
    mode: "native", practiceMode: spec ? "ai" : "local", learnerName: "Maple",
    practiceStatus: spec ? "AI tutoring · progress saved on this device" : "Local practice · AI tutoring is not connected",
    session: { completed },
    growth: growthSummary(undefined), account: { connected: false, signInAvailable: true },
    learners: [{ id: "a", name: "Maple" }],
    activity, activityAnswered: answered, feedback, hint, busy,
    busyLabel: busy ? "Preparing your next discovery…" : undefined,
    spec: spec ? { id: `${spec.id}-${round}`, spec, result, onSubmit: r => { const g = gradeActivity(spec, r); setResult(g); if (g.correct) setCompleted(c => c + 1); } } : undefined,
    onSubmit: (value) => {
      if (!task) return;
      const correct = value.replace("−", "-") === task.answer;
      if (correct) { setAnswered(true); setCompleted(c => c + 1); setFeedback({ kind: "correct", title: "Yes, that’s it.", message: "" }); return; }
      if (tries === 0) { setTries(1); setFeedback({ kind: "nudge", title: "Not quite yet. Try once more.", message: "" }); return; }
      setAnswered(true); setFeedback({ kind: "retry", title: "Not quite yet.", message: task.explain });
    },
    onContinue: next,
    onSupport: (kind) => {
      if (kind === "hint") {
        if (spec) { const n = Math.min(hints + 1, spec.hints?.length ?? 0); setHints(n); setHint(spec.hints?.[n - 1]); }
        else setHint(task?.hint);
      }
      if (kind === "explain") setHint(spec ? spec.explanation : task?.explain);
      if (kind === "harder" || kind === "dispute") next();
    },
    onCuriosity: noop, onCloseCuriosity: noop, onSignIn: noop, onSignOut: noop, onExport: noop, onImport: noop, onDeleteLearner: noop,
    onCreateLearner: noop, onSelectLearner: noop, onManageAccount: noop, onRefreshAccount: noop,
    ...scenario.props,
  };
  if (scenario.props?.session) props.session = { ...scenario.props.session, completed };
  if (busy) { props.busy = true; props.busyLabel = "Preparing your next discovery…"; }
  return <Studio {...props} />;
}
ReactDOM.createRoot(document.getElementById("root")!).render(<Harness />);
