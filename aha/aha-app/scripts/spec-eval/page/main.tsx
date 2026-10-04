/** DEV-ONLY spec-eval renderer: draws ONE locally generated, validated spec (injected by
 * scripts/spec-eval/render.mjs as window.__SPEC_EVAL__) inside the studio's focus stage, the
 * same surface learners see (mirrors src/activity/gallery/stage.tsx). Never in the production build. */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Studio } from '../../../src/ui/Studio';
import type { ActivitySpec } from '../../../src/activity/spec';

const spec = (window as unknown as { __SPEC_EVAL__?: ActivitySpec }).__SPEC_EVAL__;
const noop = () => {};
ReactDOM.createRoot(document.getElementById('root')!).render(spec
  ? <Studio mode="native" practiceMode="ai" practiceStatus="DEV spec-eval · synthetic learner" learnerName="Eval"
      session={{ completed: 3, target: 10 }} progress={[]} account={{ connected: true, aiReady: true }}
      spec={{ spec, onSubmit: noop }} activityAnswered={false}
      onSupport={noop} onSubmit={noop} onContinue={noop} onCuriosity={noop} onCloseCuriosity={noop} onSignIn={noop} onSignOut={noop}
      onExport={noop} onImport={noop} onDeleteLearner={noop} />
  : <p>No spec injected.</p>);
