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

/**
 * The operator glyph a template's question is written with, or `none` for a
 * question that is not a binary operation at all.
 *
 * ## Why this is on the declaration and not left to the renderer
 *
 * Because the renderer got it wrong, in the shipped product, in the way this
 * program keeps meeting: silently and in the favour of nobody.
 *
 * `dynawalla-app/src/packs/items.ts` builds the string a game shows a child, and
 * it used to decide the operator like this:
 *
 * ```ts
 * export function isSubtraction(promptKey: string): boolean {
 *   return promptKey === PROMPT_KEY_SUB || promptKey.endsWith(".sub")
 * }
 * // …
 * prompt: `${top} ${subtract ? MINUS : "+"} ${bottom}`,
 * ```
 *
 * Every template that was not a subtraction was drawn as an **addition**: correct
 * for the four templates the graph had active and wrong for eleven of the rest.
 * `dw.prompt.times-table.mul` reached a child as `5 + 7` with 35 as the answer.
 * `packs/sdk/src/protocol.ts` had carried `"×"` and `"÷"` in `Item.operator` the
 * whole time; what was missing was anywhere to look them up.
 *
 * This is that place, and the renderer reads it now — `binaryOperator()` in
 * `items.ts` is a lookup here with **no fallback**, so an unregistered key or a
 * `none` refuses to serve the item rather than guessing a plus sign at it. It is
 * data the curriculum owns, because which glyph a question is written with is a
 * fact about the question. `promotionBlockers.ts` carries what is left:
 * `MISSTATED_QUESTION_TEMPLATES`, the templates whose question a two-operand
 * string does not state however right the operator between them is.
 */
export type PromptOperator = "+" | "−" | "×" | "÷" | "none";

export type PromptTemplateDeclaration = {
  /** The `LocKey` a family writes into `Exercise.prompt.key`. */
  readonly id: LocKey;
  /** The family that emits it. Lets the gate report a family, not just a key. */
  readonly family: FamilyId;
  /** The glyph this question is written with. See `PromptOperator`. */
  readonly operator: PromptOperator;
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
const TIMES_TABLE = familyId("gen.arith.times-table");
const SIGNED_INT = familyId("gen.arith.signed-int");

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
  { id: locKey("dw.prompt.number-facts.add"), operator: "+", family: NUMBER_FACTS, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.number-facts.sub"), operator: "−", family: NUMBER_FACTS, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.column-op.sub"), operator: "−", family: COLUMN_OP, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.column-op.add"), operator: "+", family: COLUMN_OP, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.place-value.digit-value"), operator: "none", family: PLACE_VALUE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.place-value.digit-in-place"), operator: "none", family: PLACE_VALUE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.place-value.total-in-place"), operator: "none", family: PLACE_VALUE, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.compare-order.greater"), operator: "none", family: COMPARE_ORDER, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.compare-order.lesser"), operator: "none", family: COMPARE_ORDER, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.round-estimate.round"), operator: "none", family: ROUND_ESTIMATE, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.multidigit-mul.product"), operator: "×", family: MULTIDIGIT_MUL, owner: "PR-2.13", implemented: false },

  { id: locKey("dw.prompt.long-div.quotient"), operator: "÷", family: LONG_DIV, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.long-div.remainder"), operator: "÷", family: LONG_DIV, owner: "PR-2.13", implemented: false },
  {
    id: locKey("dw.prompt.long-div.quotient-remainder"),
    operator: "÷",
    family: LONG_DIV,
    owner: "PR-2.13",
    implemented: false,
  },

  { id: locKey("dw.prompt.frac-equivalence.simplify"), operator: "none", family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-equivalence.build"), operator: "none", family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-equivalence.to-mixed"), operator: "none", family: FRAC_EQUIVALENCE, owner: "PR-2.13", implemented: false },
  {
    id: locKey("dw.prompt.frac-equivalence.to-improper"),
    operator: "none",
    family: FRAC_EQUIVALENCE,
    owner: "PR-2.13",
    implemented: false,
  },

  { id: locKey("dw.prompt.frac-arith.add"), operator: "+", family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.sub"), operator: "−", family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.mul"), operator: "×", family: FRAC_ARITH, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.frac-arith.mul-whole"), operator: "×", family: FRAC_ARITH, owner: "PR-2.13", implemented: false },

  {
    id: locKey("dw.prompt.missing-operand.add-unknown"),
    operator: "+",
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.sub-unknown"),
    operator: "−",
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.sub-unknown-minuend"),
    operator: "−",
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.mul-unknown"),
    operator: "×",
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },
  {
    id: locKey("dw.prompt.missing-operand.both-sides"),
    operator: "none",
    family: MISSING_OPERAND,
    owner: "PR-2.13",
    implemented: false,
  },

  // The tables and their inverses. Neither glyph has ever been drawn by anything
  // in this repository, and the second is the one a game would meet first.
  { id: locKey("dw.prompt.times-table.mul"), operator: "×", family: TIMES_TABLE, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.times-table.div"), operator: "÷", family: TIMES_TABLE, owner: "PR-2.13", implemented: false },

  // Signed arithmetic. The `+` and `−` here are the same glyphs the additive
  // families use and the *operands* are what differ — `(−7) + 4` is an addition
  // however it reads — so a renderer that draws these correctly still needs
  // `answer:integer-signed` before the card is answerable.
  { id: locKey("dw.prompt.signed-int.add"), operator: "+", family: SIGNED_INT, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.signed-int.sub"), operator: "−", family: SIGNED_INT, owner: "PR-2.13", implemented: false },
  { id: locKey("dw.prompt.signed-int.mul"), operator: "×", family: SIGNED_INT, owner: "PR-2.13", implemented: false },
];

export function findPromptTemplate(
  key: LocKey,
  registry: readonly PromptTemplateDeclaration[] = promptRegistry,
): PromptTemplateDeclaration | undefined {
  return registry.find((entry) => entry.id === key);
}

/**
 * The glyph this question is written with, or `null` for a key nothing declares.
 *
 * The lookup a renderer needs, so that "which operator is this" is a table read
 * rather than a guess from the shape of the key. `null` and not `"+"` on an
 * unknown key, deliberately: a renderer that cannot tell must draw nothing and say
 * so, because the alternative is the defect this function exists to retire — a
 * multiplication served to a child with a plus sign in the middle of it.
 */
export function promptOperator(
  key: string,
  registry: readonly PromptTemplateDeclaration[] = promptRegistry,
): PromptOperator | null {
  return registry.find((entry) => String(entry.id) === key)?.operator ?? null;
}
