/**
 * Renderer ownership declarations — the data behind gate CG-8.
 *
 * CG-8 is the gate the first program draft was missing entirely: a generator can
 * emit a perfectly valid `Exercise` that the app cannot draw. A skill may not go
 * `active` unless its generator's `AnswerSchema` kind **and every
 * `representations.required` RepId** has a registered, tested renderer.
 *
 * `curriculum/` cannot import whoever draws, so the registry is a declaration
 * that side has to satisfy, not a live lookup. Three things keep that from
 * becoming a rubber stamp:
 *
 * - `owner` names the PR that must land the renderer; an entry with no owner is
 *   meaningless and the gate rejects it.
 * - `implemented` is `false` until the renderer and its test exist. The default
 *   gate accepts a declared-but-unimplemented renderer (the curriculum may be
 *   authored ahead of the work surface); `--strict-renderers`, which the release
 *   checklist runs, does not. So "declare everything" buys nothing at release.
 * - `testRef` is the test that proves it draws, and CG-8 rejects `implemented`
 *   without one. Whoever claims a renderer closes the loop from their side, in
 *   both directions: a declaration nobody satisfies is a lie, and a renderer
 *   nobody declared cannot let its skills go active.
 *
 * ## Nothing here is implemented, and that is the honest state
 *
 * These entries used to be satisfied by the host's practice loop —
 * `dynawalla-app/src/work/`. [ADR-0022](../../../../docs/DECISIONS/ADR-0022-host-ships-no-content.md)
 * deleted that surface: the host ships no content, and drawing an exercise is
 * content. **No module in this repository draws a curriculum item today.** The
 * generators, the mal-rules and the walkthrough are a library; the thing that
 * puts a question and an answer entry on a child's screen is a pack.
 *
 * So every entry below is `implemented: false` with the PR that owes it, and
 * `--strict-renderers` fails — which is correct, because a release with nothing
 * drawing anything is not a release. The first pack to draw a curriculum item
 * flips the entries it satisfies and names the test that holds them up. Leaving
 * them `true` with a `testRef` into a deleted file would have made CG-8 green by
 * pointing at a file that no longer exists, which is exactly the rubber stamp
 * the three rules above exist to prevent.
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

/**
 * The pack renderer nobody has written. One constant rather than eight copies of
 * the same string, so the day a pack lands one the diff is the entry it earned
 * and not a search-and-replace over the whole table.
 */
const PACK = "PR-4.16 — a pack renderer, ADR-0022";

export const rendererRegistry: readonly RendererDeclaration[] = [
  { id: "answer:integer", kind: "answerSchema", owner: PACK, implemented: false },
  { id: "answer:columnAlgorithm", kind: "answerSchema", owner: PACK, implemented: false },
  { id: "answer:fraction", kind: "answerSchema", owner: PACK, implemented: false },
  { id: "answer:choice", kind: "answerSchema", owner: PACK, implemented: false },
  { id: "rep:counting-board", kind: "representation", owner: PACK, implemented: false },
  // The quantity picture for the bottom of the ladder. Declared and not built, on
  // the same terms as everything else here: the rows that emit it list it as
  // `optional`, because a row that declared it `required` today would be a
  // curriculum row the app cannot draw, which is the failure CG-8 exists to stop.
  { id: "rep:ten-frame", kind: "representation", owner: PACK, implemented: false },
  { id: "rep:number-line", kind: "representation", owner: PACK, implemented: false },
  { id: "rep:balance-scale", kind: "representation", owner: PACK, implemented: false },
  // Declared, not built, and for a second reason on top of the one above: the
  // gear train carries multiples, factors and LCM (CURRICULUM.md), and none of
  // that content exists yet — a renderer with no item to draw is a renderer
  // nobody can check.
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
