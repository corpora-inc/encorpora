/** DEV-ONLY spec-eval renderer: draws ONE locally generated, validated spec injected by
 * scripts/spec-eval/render.mjs as window.__SPEC_EVAL__. Never part of the production build. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ActivityView } from '../../../src/activity/render';
import type { ActivitySpec } from '../../../src/activity/spec';

const spec = (window as unknown as { __SPEC_EVAL__?: ActivitySpec }).__SPEC_EVAL__;
document.documentElement.style.background = '#efeee6';
document.body.style.margin = '0';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <main style={{ padding: '24px 16px 48px' }}>
    {spec ? <section data-spec={spec.id}><ActivityView spec={spec} theme="light" onSubmit={() => {}} /></section> : <p>No spec injected.</p>}
  </main>,
);
