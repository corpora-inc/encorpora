/**
 * What stands between a `draft` row and an `active` one, per row.
 *
 * Every draft row in this graph waits on **PR-2.13**, the statement renderer, and
 * since [ADR-0022](../../../../docs/DECISIONS/ADR-0022-host-ships-no-content.md)
 * that renderer is a **pack's** to land rather than the host's: the host ships no
 * content, and stating a question is content. Nothing in this repository draws a
 * curriculum item today, so promoting a row buys an answer entry on a child's
 * screen with no question above it (CG-8, `render/prompts.ts`).
 *
 * Three further blockers are named below, and each is a different kind of thing.
 *
 * **CG-10**, the variant-space floor. It requires an estimated space of 975 — a
 * 40-item practice run repeating no more than one item in fifty — and the levels
 * in `CG10_BLOCKED_LEVELS` do not clear it. Some are genuinely short of problems in
 * the world: `dw.alg.equality.missing-addend` L0 draws both operands from 1..9, so
 * its true space is exactly 81 items and no generator work changes that. Others
 * would clear the floor with a wider draw, and two of them now have one — see the
 * note under the list.
 *
 * **The operator**, in `OPERATOR_BLOCKED_TEMPLATES`, and this one is not a gap in
 * the curriculum at all. It is a defect in the only thing that draws a question
 * today, and it is why the multiplication and division rows are still draft after
 * their generators, their fact floors and their variant spaces were all finished.
 *
 * **The sign**, in `SIGNED_BLOCKED_SKILLS`. The integer rows answer below zero and
 * `answer:integer-signed` is not built.
 *
 * The lists are here rather than in a comment beside each row because a comment
 * cannot be checked. `families.property.test.ts` measures the sub-floor set over
 * the whole graph and asserts it equals `CG10_BLOCKED_LEVELS` **in both
 * directions**: a level that slips under the floor is named here or the sweep
 * fails, and a generator widened past it must be struck off or the sweep fails
 * too. The other two lists are asserted the same way, against the prompt registry
 * and against the schemas the graph's own items emit.
 *
 * Labels are `<skill id> L<level>`, the same form the sweep prints.
 */

export const CG10_BLOCKED_LEVELS: readonly string[] = [
  "dw.ns.place.digit-in-place L0",
  "dw.ns.round.whole-numbers L0",
  "dw.frac.equivalence.build-equivalent L0",
  "dw.frac.equivalence.build-equivalent L1",
  "dw.frac.equivalence.build-equivalent L2",
  "dw.frac.equivalence.lowest-terms L0",
  "dw.frac.equivalence.lowest-terms L1",
  "dw.frac.equivalence.lowest-terms L2",
  "dw.frac.equivalence.improper-to-mixed L0",
  "dw.frac.equivalence.improper-to-mixed L1",
  "dw.frac.equivalence.mixed-to-improper L0",
  "dw.frac.equivalence.mixed-to-improper L1",
  "dw.frac.arith.add-like-denominators L0",
  "dw.frac.arith.add-like-denominators L1",
  "dw.frac.arith.add-unlike-denominators L0",
  "dw.frac.arith.subtract-fractions L0",
  "dw.frac.arith.subtract-fractions L1",
  "dw.frac.arith.multiply-by-a-whole L0",
  "dw.frac.arith.multiply-by-a-whole L1",
  "dw.frac.arith.multiply-fractions L0",
  "dw.alg.equality.missing-addend L0",
  "dw.alg.equality.balance-meaning L0",
  "dw.alg.equality.missing-subtrahend L0",
  "dw.alg.equality.unknown-minuend L0",
  "dw.alg.equality.missing-factor L0",
];

/**
 * Two levels came off this list, and neither by argument.
 *
 * `dw.mul.scale.times-power-of-ten L0` was `47 × 100` — ninety multiplicands times
 * one power, ninety problems — and is now three digits by two powers, which is
 * 1,800. `dw.div.whole.divide-exact L0` was a two-digit quotient over a one-digit
 * divisor, 720 problems, and is now a three-digit quotient, which is 7,200. Both
 * were bounded by a digit count that nothing about the content asked to be small,
 * which is precisely the case `GeneratorBinding.closedFactSet` must not be used
 * for. A level that could be widened and simply has not been is a level that gets
 * widened.
 *
 * The fact rows added alongside them are the other case and take the other route:
 * there are 121 multiplications in the tables to twelve and no 122nd, so they
 * declare `closedFactSet` and are measured against it. Nothing on this list moved
 * because the floor was argued down.
 */

/** The skills above, deduplicated. */
export const CG10_BLOCKED_SKILLS: readonly string[] = [
  ...new Set(CG10_BLOCKED_LEVELS.map((label) => label.slice(0, label.lastIndexOf(" ")))),
];

/**
 * Prompt templates the shipped renderer draws with the wrong operator.
 *
 * ## The defect, precisely
 *
 * `dynawalla-app/src/packs/items.ts` is the only thing in this repository that
 * turns an `Exercise` into something a child reads, and `packs/shared/game-host`
 * passes its `prompt` string to a game unchanged. It picks the operator with
 * `promptKey.endsWith(".sub") ? "−" : "+"`, so **every template that is not a
 * subtraction is drawn as an addition**. `7 × 8` reaches the child as `7 + 8`,
 * with 56 as the answer they must give.
 *
 * That is correct for the four templates active today, which is why nothing has
 * caught it: the host's own `items.test.ts` asserts `operator === "+"` for every
 * skill whose id does not contain "subtract", so it passes on a multiplication row
 * and passes *wrongly*.
 *
 * ## Why this list, and why here
 *
 * Promoting a row named below would put a wrong question in front of a child. Not
 * a blank card, which is what CG-8 usually protects against and what a reviewer
 * would notice in a minute — a card that reads fine, is answerable, and marks the
 * right answer wrong. So this is a harder blocker than "no renderer exists", and
 * it belongs somewhere a promotion PR reads first.
 *
 * The fix is small and is not in this package's power: read `promptOperator(key)`
 * from `render/prompts.ts`, which now carries the glyph for every template, and
 * put it in `Item.operator` — a field `packs/sdk/src/protocol.ts` has typed as
 * `"+" | "-" | "×" | "÷" | "<" | ">" | "="` since it was written. When that lands,
 * every entry below is struck off and the rows above them are a `status` flip.
 *
 * `render/prompts.test.ts` asserts this list equals the set of registered
 * templates whose operator is neither `+` nor `−`, in both directions, so it
 * cannot go stale as families are added.
 */
export const OPERATOR_BLOCKED_TEMPLATES: readonly string[] = [
  "dw.prompt.frac-arith.mul",
  "dw.prompt.frac-arith.mul-whole",
  "dw.prompt.long-div.quotient",
  "dw.prompt.long-div.quotient-remainder",
  "dw.prompt.long-div.remainder",
  "dw.prompt.missing-operand.mul-unknown",
  // These two are subtractions and are drawn with a plus, which is the same
  // defect arriving by a different route: the host tests `endsWith(".sub")` and
  // these keys end `".sub-unknown"`. Found by `render/prompts.test.ts` rather
  // than by reading — the list was authored from the non-additive families and
  // missed the two additive-family templates whose *names* the rule mis-parses.
  "dw.prompt.missing-operand.sub-unknown",
  "dw.prompt.missing-operand.sub-unknown-minuend",
  "dw.prompt.multidigit-mul.product",
  "dw.prompt.signed-int.mul",
  "dw.prompt.times-table.div",
  "dw.prompt.times-table.mul",
];

/**
 * Skills whose answers go below zero, which no built entry surface can express.
 *
 * A digit keypad handed `(−7) + 4` is not a blank card. It is a card that looks
 * answerable, and every key the child can press produces a positive number — so
 * the only thing they can do is be wrong. `render/registry.ts` declares
 * `answer:integer-signed` as a renderer distinct from `answer:integer` for exactly
 * this reason, and CG-8 tells the two apart through `answerRendererIdFor`.
 *
 * `signedInt.test.ts` asserts this list equals the set of skills in the graph
 * whose bound levels emit a signed schema, in both directions.
 */
export const SIGNED_BLOCKED_SKILLS: readonly string[] = [
  "dw.int.arith.add-signed",
  "dw.int.arith.multiply-signed",
  "dw.int.arith.subtract-past-zero",
  "dw.int.arith.subtract-signed",
];
