/** DEV-ONLY gallery of hand-authored TEST FIXTURES. Not part of the production build. */
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ActivityView } from '../render';
import { fixtures } from '../fixtures';
import { correctResponseFor, gradeResponse, type AnyLearnerResponse, type GradeOutcome } from '../grade';
import type { ResolvedSpec } from '../resolved';
import { goldResolved } from '../v2/gold/resolved';

const params = new URLSearchParams(location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
const only = params.get('fixture');
const state = params.get('state');
document.documentElement.style.background = theme === 'dark' ? '#0f1512' : '#efeee6';
document.body.style.margin = '0';

function Live({ spec }: { spec: ResolvedSpec }) {
  const answered = state === 'answered';
  const grade = (r: AnyLearnerResponse) => gradeResponse(spec.response, r, spec.id);
  const [result, setResult] = useState<GradeOutcome | undefined>(answered ? grade(correctResponseFor(spec.response)) : undefined);
  const [response] = useState<AnyLearnerResponse | undefined>(answered ? correctResponseFor(spec.response) : undefined);
  return <ActivityView spec={spec} theme={theme} result={result} initialResponse={response} initialHintsShown={state === 'hints' ? 2 : 0}
    onSubmit={r => setResult(grade(r))} />;
}

// v1 TEST FIXTURES, then v2 gold specs (hand-authored, resolved through the v2 validator).
const all: ResolvedSpec[] = [...fixtures, ...goldResolved()];
const list = only ? all.filter(f => f.id === only) : all;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <main style={{ padding: '24px 16px 48px', display: 'grid', gap: 28 }}>
    {list.map(spec => <section key={spec.id} data-fixture={spec.id}><Live spec={spec} /></section>)}
  </main>,
);
