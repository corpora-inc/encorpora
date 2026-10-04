/** DEV-ONLY gallery of hand-authored TEST FIXTURES. Not part of the production build. */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ActivityView } from '../render';
import { fixtures } from '../fixtures';
import { correctResponse, gradeActivity, type GradeOutcome, type LearnerResponse } from '../grade';
import type { ActivitySpec } from '../spec';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const only = params.get('fixture');
const state = params.get('state');
document.documentElement.style.background = theme === 'dark' ? '#0f1512' : '#efeee6';
document.body.style.margin = '0';

function Live({ spec }: { spec: ActivitySpec }) {
  const answered = state === 'answered';
  const [result, setResult] = useState<GradeOutcome | undefined>(answered ? gradeActivity(spec, correctResponse(spec)) : undefined);
  const [response] = useState<LearnerResponse | undefined>(answered ? correctResponse(spec) : undefined);
  return <ActivityView spec={spec} theme={theme} result={result} initialResponse={response} initialHintsShown={state === 'hints' ? 2 : 0}
    onSubmit={r => setResult(gradeActivity(spec, r))} />;
}

const list = only ? fixtures.filter(f => f.id === only) : fixtures;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <main style={{ padding: '24px 16px 48px', display: 'grid', gap: 28 }}>
    {list.map(spec => <section key={spec.id} data-fixture={spec.id}><Live spec={spec} /></section>)}
  </main>,
);
