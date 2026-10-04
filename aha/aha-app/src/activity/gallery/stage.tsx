/** DEV/TEST-ONLY: one Activity Spec TEST FIXTURE inside the studio's focus stage (?fixture=id).
 * Used by scripts/verify-ui.mjs to hold specs to the same one-screen pass bar as local practice. */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Studio } from '../../ui/Studio';
import { fixtures } from '../fixtures';
import { gradeActivity, type GradeOutcome } from '../grade';

const id = new URLSearchParams(location.search).get('fixture');
const spec = fixtures.find(f => f.id === id) ?? fixtures[0]!;
const noop = () => {};

function Harness() {
  const [result, setResult] = useState<GradeOutcome>();
  const [hint, setHint] = useState<string>();
  const [hints, setHints] = useState(0);
  return <Studio mode="native" practiceMode="ai" practiceStatus="AI tutoring · progress saved on this device" learnerName="Test"
    session={{ completed: 3, target: 10 }} progress={[]} account={{ connected: true, aiReady: true }}
    spec={{ spec, result, onSubmit: r => setResult(gradeActivity(spec, r)) }}
    activityAnswered={!!result && !result.invalid} hint={hint}
    onSupport={kind => {
      if (kind === 'hint' && spec.hints?.length) { const n = Math.min(hints + 1, spec.hints.length); setHints(n); setHint(spec.hints.slice(0, n).join('\n\n')); }
      if (kind === 'explain') setHint(spec.explanation);
    }}
    onSubmit={noop} onContinue={noop} onCuriosity={noop} onCloseCuriosity={noop} onSignIn={noop} onSignOut={noop}
    onExport={noop} onImport={noop} onDeleteLearner={noop} />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<Harness />);
