/** DEV/TEST-ONLY: one Activity Spec TEST FIXTURE inside the studio's focus stage (?fixture=id).
 * Used by scripts/verify-ui.mjs to hold specs to the same one-screen pass bar as local practice,
 * and to drive every transient state of the stable stage (#892). `window.__stage` (test-only):
 *   hold()     the next Next / Try something harder waits ("Preparing your next AI lesson…")
 *   release()  finishes that wait and shows the next fixture
 *   fail(msg)  shows an error, as a failed action would
 * ?label=Apples gives the first activity's typed response that label; ?unit=… gives a numeric one a unit.
 * ?completed=9 starts the run nine answers in, so the next answer completes a lap and shows the recap.
 * `window.__stageSpec` (dev-only, set by a Playwright init script such as scripts/flag-review.mjs) replaces
 * the fixtures with that ONE stored spec, rendered exactly as given (no label/unit overrides). */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Studio } from '../../ui/Studio';
import { fixtures } from '../fixtures';
import { gradeActivity, type GradeOutcome } from '../grade';
import type { ActivitySpec } from '../spec';
import type { LapRecap } from '../../application/lapRecap';

declare global { interface Window { __stage?: StageControl; __stageSpec?: ActivitySpec } }
const injected = window.__stageSpec;
const specs: readonly ActivitySpec[] = injected ? [injected] : fixtures;
const params = new URLSearchParams(location.search);
const id = params.get('fixture');
// ?label=… gives the first activity's typed response a label, as model-written specs often do.
const label = injected ? null : params.get('label');
const unit = injected ? null : params.get('unit');
const start = Math.max(0, specs.findIndex(f => f.id === id));
const completedBefore = Math.max(0, Number(params.get('completed')) || 3);
/** TEST recap for a completed lap (the app derives it from durable evidence: application/lapRecap.ts). */
const testRecap = (lastCorrect: boolean): LapRecap => {
  const answers = [true, true, false, true, true, true, true, true, true, lastCorrect];
  return { answers, correct: answers.filter(Boolean).length, streak: 3, skills: [
    { id: 'K.CC.B.5', title: 'Count to tell how many', growth: 'rooted' },
    { id: '2.MD.C.8', title: 'Solve money word problems', growth: 'remembered' },
    { id: '2.NBT.B.5', title: 'Add and subtract within 100' },
  ] };
};
const withLabel = (spec: ActivitySpec, i: number): ActivitySpec =>
  label && i === start && ['numeric', 'expression', 'fraction'].includes(spec.response.type)
    ? { ...spec, response: { ...spec.response, label } as ActivitySpec['response'] }
    : unit && i === start && spec.response.type === 'numeric' ? { ...spec, response: { ...spec.response, unit } } : spec;
const noop = () => {};
type StageControl = { hold: () => void; release: () => void; fail: (message: string) => void };

function Harness() {
  const [index, setIndex] = useState(start);
  const [answered, setAnswered] = useState(0);
  const spec = withLabel(specs[index % specs.length]!, index);
  const [result, setResult] = useState<GradeOutcome>();
  const [hint, setHint] = useState<string>();
  const [hints, setHints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [error, setError] = useState<string>();
  const [curiosity, setCuriosity] = useState<{ question: string; answer?: string }>();
  const next = () => { setBusy(false); setResult(undefined); setHint(undefined); setHints(0); setIndex(i => i + 1); };
  const advance = () => { setError(undefined); if (holding) setBusy(true); else next(); };
  window.__stage = { hold: () => setHolding(true), release: () => { setHolding(false); next(); }, fail: setError };
  return <Studio mode="native" practiceMode="ai" practiceStatus="AI tutoring · progress saved on this device" learnerName="Test"
    session={{ completed: completedBefore + answered }}
    lapRecap={(completedBefore + answered) % 10 === 0 && answered ? testRecap(!!result?.correct) : undefined} progress={[]} account={{ connected: true, aiReady: true }}
    spec={{ id: `${spec.id}-${index}`, spec, result, onSubmit: r => { const graded = gradeActivity(spec, r); if (!graded.invalid) setAnswered(n => n + 1); setResult(graded); } }}
    activityAnswered={!!result && !result.invalid} hint={hint} busy={busy} error={error}
    busyLabel={busy ? 'Preparing your next AI lesson…' : undefined} onCancel={busy ? () => setBusy(false) : undefined}
    feedback={result && !result.invalid && !result.correct ? { kind: 'retry', title: 'Not quite yet.', message: spec.explanation } : undefined}
    curiosity={curiosity}
    onSupport={kind => {
      setError(undefined);
      if (kind === 'hint' && spec.hints?.length) { const n = Math.min(hints + 1, spec.hints.length); setHints(n); setHint(spec.hints[n - 1]); }
      if (kind === 'explain') setHint(spec.explanation);
      if (kind === 'harder' || kind === 'dispute') advance();
    }}
    onSubmit={noop} onContinue={advance}
    onCuriosity={question => setCuriosity({ question, answer: 'TEST answer: you could use this to share things fairly.' })}
    onCloseCuriosity={() => setCuriosity(undefined)} onSignIn={noop} onSignOut={noop}
    onExport={noop} onImport={noop} onDeleteLearner={noop} />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
