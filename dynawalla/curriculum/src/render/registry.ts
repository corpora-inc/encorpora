/**
 * Renderer ownership declarations — the data behind gate CG-8.
 *
 * CG-8 is the gate the first program draft was missing entirely: a generator can
 * emit a perfectly valid `Exercise` that the app cannot draw. A skill may not go
 * `active` unless its generator's `AnswerSchema` kind **and every
 * `representations.required` RepId** has a registered, tested renderer.
 *
 * `curriculum/` cannot import the app, so the registry is a declaration the app
 * has to satisfy, not a live lookup. Three things keep that from becoming a
 * rubber stamp:
 *
 * - `owner` names the PR that must land the renderer; an entry with no owner is
 *   meaningless and the gate rejects it.
 * - `implemented` is `false` until the renderer and its test exist. The default
 *   gate accepts a declared-but-unimplemented renderer (the curriculum may be
 *   authored ahead of the work surface); `--strict-renderers`, which the release
 *   checklist runs, does not. So "declare everything" buys nothing at release.
 * - `testRef` is the test that proves it draws, and CG-8 rejects `implemented`
 *   without one. `dynawalla-app/src/work/renderers.test.ts` closes the loop from
 *   the app's side, in both directions: a declaration nobody satisfies is a lie,
 *   and a renderer nobody declared cannot let its skills go active.
 *
 * Every `implemented: true` below is a renderer that exists today, not a
 * roadmap.
 */

import type { AnswerSchemaKind } from "../types/answer.ts";
import type { RepId } from "../types/ids.ts";

export type RendererDeclaration = {
  /** `answer:<schema kind>` or `rep:<rep id>`. */
  readonly id: string;
  readonly kind: "answerSchema" | "representation";
  /** The PR that owns landing this renderer. Required — see above. */
  readonly owner: string;
  readonly implemented: boolean;
  /** Path of the test that proves it renders. Required once implemented. */
  readonly testRef?: string;
};

const ENTRY_TEST = "dynawalla-app/src/work/entry.test.ts";
const REP_TEST = "dynawalla-app/src/work/representation.test.ts";

export const rendererRegistry: readonly RendererDeclaration[] = [
  { id: "answer:integer", kind: "answerSchema", owner: "PR-2.3", implemented: true, testRef: ENTRY_TEST },
  {
    id: "answer:columnAlgorithm",
    kind: "answerSchema",
    owner: "PR-2.4",
    implemented: true,
    testRef: ENTRY_TEST,
  },
  { id: "answer:fraction", kind: "answerSchema", owner: "PR-2.12", implemented: true, testRef: ENTRY_TEST },
  { id: "answer:choice", kind: "answerSchema", owner: "PR-2.12", implemented: true, testRef: ENTRY_TEST },
  {
    id: "rep:counting-board",
    kind: "representation",
    owner: "PR-2.10",
    implemented: true,
    testRef: "dynawalla-app/src/work/diagnosis.test.ts",
  },
  { id: "rep:number-line", kind: "representation", owner: "PR-2.12", implemented: true, testRef: REP_TEST },
  { id: "rep:balance-scale", kind: "representation", owner: "PR-2.12", implemented: true, testRef: REP_TEST },
  // Declared, not built. The gear train carries multiples, factors and LCM
  // (CURRICULUM.md), and none of that content exists yet — a renderer with no
  // item to draw is a renderer nobody can check, and `--strict-renderers` is
  // what keeps a skill going active behind it.
  { id: "rep:gear-train", kind: "representation", owner: "PR-7.14", implemented: false },
];

export function answerRendererId(kind: AnswerSchemaKind): string {
  return `answer:${kind}`;
}

export function repRendererId(rep: RepId): string {
  return `rep:${rep}`;
}

export function findRenderer(
  id: string,
  registry: readonly RendererDeclaration[] = rendererRegistry,
): RendererDeclaration | undefined {
  return registry.find((entry) => entry.id === id);
}
