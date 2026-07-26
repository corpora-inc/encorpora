/**
 * Renderer ownership declarations — the data behind gate CG-8.
 *
 * CG-8 is the gate the first program draft was missing entirely: a generator can
 * emit a perfectly valid `Exercise` that the app cannot draw. A skill may not go
 * `active` unless its generator's `AnswerSchema` kind **and every
 * `representations.required` RepId** has a registered, tested renderer.
 *
 * `curriculum/` cannot import the app, so the registry is a declaration the app
 * has to satisfy, not a live lookup. Two fields keep that from becoming a rubber
 * stamp:
 *
 * - `owner` names the PR that must land the renderer. An entry with no owner is
 *   meaningless and the gate rejects it.
 * - `implemented` is `false` until the renderer and its test exist. The default
 *   gate accepts a declared-but-unimplemented renderer (the curriculum can be
 *   authored ahead of the work surface); `--strict-renderers`, which the release
 *   checklist runs, does not. So "declare everything" buys nothing at release.
 *
 * PR-2.3 and PR-2.4 flip `integer` and `columnAlgorithm` to implemented and add
 * `testRef`. PR-2.10 does the same for the counting board.
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

export const rendererRegistry: readonly RendererDeclaration[] = [
  { id: "answer:integer", kind: "answerSchema", owner: "PR-2.3", implemented: false },
  { id: "answer:columnAlgorithm", kind: "answerSchema", owner: "PR-2.4", implemented: false },
  { id: "rep:counting-board", kind: "representation", owner: "PR-2.10", implemented: false },
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
