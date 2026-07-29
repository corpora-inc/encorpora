/**
 * Prompt-template renderer declarations — the missing half of gate CG-8.
 *
 * ## What this file is for
 *
 * CG-8 stopped a curriculum row going `active` behind an answer schema or a
 * representation nobody could draw. It said nothing about the **question**.
 *
 * That is not a theoretical hole. The practice loop that used to live in the host
 * read an item back out of `Exercise.prompt.slots` by matching `prompt.key` against
 * exactly two template keys — `dw.prompt.column-op.sub` and `dw.prompt.column-op.add`
 * — and returned `null` for anything else, and the slate rendered `null` when it
 * did. So an item from any other family drew its answer entry, its keypad, its
 * verdict well and its representation, and **no question at all**: a fraction card
 * with two empty cells over a bar and nothing to say what they are for.
 *
 * That is precisely the failure the bidirectional gate exists to prevent, one level
 * up from where it was looking, and it is why every family this package has gained
 * beyond `column-op` binds `draft` rows only.
 *
 * ## Why this is a second registry rather than a third `kind`
 *
 * A consumer of `rendererRegistry` reasonably branches on
 * `kind === "answerSchema"` and treats everything else as a `rep:` id, slicing
 * four characters off the front — which is what the host's own half of CG-8 did
 * before ADR-0022 deleted it. A third kind in that array would break such a
 * reader on a string it cannot parse, from the outside. A sibling registry
 * leaves that loop untouched, and whoever lands a prompt renderer closes their
 * half of this one.
 *
 * ## What `implemented` means here
 *
 * The same as everywhere else in this directory: `false` until a renderer and its
 * test exist, a warning by default so the curriculum can be authored ahead of the
 * work surface, and a failure under `--strict-renderers`, which the release
 * checklist runs. Declaring everything therefore buys nothing at release.
 */

import type { FamilyId, LocKey } from "../types/ids.ts";
import { familyId, locKey } from "../types/ids.ts";

export type PromptTemplateDeclaration = {
  /** The `LocKey` a family writes into `Exercise.prompt.key`. */
  readonly id: LocKey;
  /** The family that emits it. Lets the gate report a family, not just a key. */
  readonly family: FamilyId;
  /** The PR that owns landing the renderer. Required — an unowned entry is noise. */
  readonly owner: string;
  readonly implemented: boolean;
  /** Path of the test that proves it is drawn. Required once implemented. */
  readonly testRef?: string;
};

const NUMBER_FACTS = familyId("gen.arith.number-facts");
const COLUMN_OP = familyId("gen.arith.column-op");
const PLACE_VALUE = familyId("gen.number.place-value-decompose");
const COMPARE_ORDER = familyId("gen.number.compare-order");
const ROUND_ESTIMATE = familyId("gen.number.round-estimate");
const MULTIDIGIT_MUL = familyId("gen.arith.multidigit-mul");
const LONG_DIV = familyId("gen.arith.long-div");
const FRAC_EQUIVALENCE = familyId("gen.frac.equivalence-simplify");
const FRAC_ARITH = familyId("gen.frac.arith");
const MISSING_OPERAND = familyId("gen.arith.missing-operand");

/**
 * Every prompt template every registered family can emit.
 *
 * **Nothing below is implemented, including the two column-op keys.** They were,
 * by the host's problem slate, until
 * [ADR-0022](../../../../docs/DECISIONS/ADR-0022-host-ships-no-content.md) deleted
 * `dynawalla-app/src/work/` — the host ships no content, and stating a question is
 * content. A `testRef` pointing at `surface.test.ts` would now name a file that
 * does not exist, so the two entries go back to `false` with the rest.
 *
 * `PR-2.13` was the app PR that owed a statement renderer; the work is now a
 * pack's. Either way it does not exist, which is the honest state and the reason
 * for the `draft` rows: a family whose question cannot be drawn has nothing to
 * promote.
 */
export const promptRegistry: readonly PromptTemplateDeclaration[] = [
  // The bottom of the ladder. Two numbers and an operator, which is the smallest
  // question this program can ask and the first one a five-year-old sees.
  { id: locKey("dw.prompt.number-facts.add"), family: NUMBER_FACTS, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.number-facts.sub"), family: NUMBER_FACTS, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.column-op.sub"), family: COLUMN_OP, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.column-op.add"), family: COLUMN_OP, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.place-value.digit-value"), family: PLACE_VALUE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.place-value.digit-in-place"), family: PLACE_VALUE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.place-value.total-in-place"), family: PLACE_VALUE, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.compare-order.greater"), family: COMPARE_ORDER, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.compare-order.lesser"), family: COMPARE_ORDER, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.round-estimate.round"), family: ROUND_ESTIMATE, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.multidigit-mul.product"), family: MULTIDIGIT_MUL, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.long-div.quotient"), family: LONG_DIV, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.long-div.remainder"), family: LONG_DIV, owner: "PR-2.13", implemented: false },
  {
    id: locKey("dw.prompt.long-div.quotient-remainder"),
    family: LONG_DIV,
    owner: "PR-2.13",
    implemented: false,
  },

  { id: locKey("dw.prompt.frac-equivalence.simplify"), family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-equivalence.build"), family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-equivalence.to-mixed"), family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  {
    id: locKey("dw.prompt.frac-equivalence.to-improper"),
    family: FRAC_EQUIVALENCE,
    owner: "PR-2.13",
    implemented: false,
  },

  { id: locKey("dw.prompt.frac-arith.add"), family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.sub"), family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.mul"), family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.mul-whole"), family: FRAC_ARITH, owner: "PR-2.13", implemented: false },

  {
    id: locKey("dw.prompt.missing-operand.add-unknown"),
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.sub-unknown"),
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.sub-unknown-minuend"),
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.mul-unknown"),
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.both-sides"),
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
];

export function findPromptTemplate(
  key: LocKey,
  registry: readonly PromptTemplateDeclaration[] = promptRegistry,
): PromptTemplateDeclaration | undefined {
  return registry.find((entry) => entry.id === key);
}
