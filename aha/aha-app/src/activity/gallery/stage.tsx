/** DEV/TEST-ONLY: one Activity Spec TEST FIXTURE inside the studio's focus stage (?fixture=id).
 * Used by scripts/verify-ui.mjs to hold specs to the same one-screen pass bar as local practice,
 * and to drive every transient state of the stable stage (#892). `window.__stage` (test-only):
 *   hold()     the next Next / Try something harder waits ("Preparing your next AI lesson…")
 *   release()  finishes that wait and shows the next fixture
 *   fail(msg)  shows an error, as a failed action would
 * ?label=Apples gives the first activity's typed response that label; ?unit=… gives a numeric one a unit. */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Studio } from '../../ui/Studio';
import { fixtures as v1Fixtures } from '../fixtures';
import { gradeResponse, type GradeOutcome } from '../grade';
import type { ResolvedSpec } from '../resolved';
import { goldResolved } from '../v2/gold/resolved';

const params = new URLSearchParams(location.search);
const id = params.get('fixture');
// ?label=… gives the first activity's typed response a label, as model-written specs often do.
const label = params.get('label');
const unit = params.get('unit');
// v1 TEST FIXTURES, then v2 gold specs resolved through the v2 validator: one focus-stage pass bar for both.
const fixtures: ResolvedSpec[] = [...v1Fixtures, ...goldResolved()];
const start = Math.max(0, fixtures.findIndex(f => f.id === id));
const withLabel = (spec: ResolvedSpec, i: number): ResolvedSpec =>
  label && i === start && ['numeric', 'expression', 'fraction'].includes(spec.response.type)
    ? { ...spec, response: { ...spec.response, label } as ResolvedSpec['response'] }
    : unit && i === start && spec.response.type === 'numeric' ? { ...spec, response: { ...spec.response, unit } } : spec;
const noop = () => {};
type StageControl = { hold: () => void; release: () => void; fail: (message: string) => void };
declare global { interface Window { __stage?: StageControl } }

function Harness() {
  const [index, setIndex] = useState(start);
  const spec = withLabel(fixtures[index % fixtures.length]!, index);
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
    session={{ completed: 3, target: 10 }} progress={[]} account={{ connected: true, aiReady: true }}
    spec={{ id: `${spec.id}-${index}`, spec, result, onSubmit: r => setResult(gradeResponse(spec.response, r, spec.id)) }}
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
