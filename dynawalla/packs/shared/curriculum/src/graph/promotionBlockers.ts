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
 * **The unstated question**, in `MISSTATED_QUESTION_TEMPLATES`, and this one is not
 * a gap in the curriculum at all. It is a defect in the only thing that draws a
 * question today. Its predecessor — `OPERATOR_BLOCKED_TEMPLATES`, where every
 * non-subtraction was drawn with a plus sign — is gone, fixed, and it is why the
 * multiplication rows and three of the division rows are now active. What is left
 * is the templates a two-operand string cannot state at all.
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
 * Prompt templates whose question a two-operand string does not state — **not** an
 * operator problem, and what is left of one after the operator problem was fixed.
 *
 * ## The blocker this replaces
 *
 * `OPERATOR_BLOCKED_TEMPLATES` named the twelve templates the shipped renderer
 * drew with the wrong sign. `dynawalla-app/src/packs/items.ts` picked the operator
 * with `promptKey.endsWith(".sub") ? "−" : "+"`, so **every template that was not a
 * subtraction was drawn as an addition**, and `dw.mul.facts.tables-to-twelve`
 * reached a child as `5 + 7` wanting 35. That list is gone because the defect is:
 * the renderer now reads `promptOperator(key)` out of `render/prompts.ts` and has
 * no fallback, and `items.test.ts` holds every registered template to what the
 * registry declares rather than to the shape of its id.
 *
 * ## The blocker that is left, and it is the same shape one level down
 *
 * A correct operator is not a stated question. These templates name a question the
 * string `a OP b` does not ask, so a child reading the card correctly answers
 * something other than what is wanted — the same silent, invisible failure, and it
 * survives the operator fix untouched:
 *
 * | template | what a child reads | what it wants |
 * |---|---|---|
 * | `long-div.remainder` | `129 ÷ 2` | 1 — the *remainder*, not 64 |
 * | `missing-operand.add-unknown` | `1 + 10` | 9 — the operand, not 11 |
 * | `missing-operand.mul-unknown` | `3 × 15` | 5 |
 * | `missing-operand.sub-unknown-minuend` | `1 − 5` | 6 |
 *
 * `dw.prompt.long-div.quotient-remainder` is not on the list and is blocked anyway,
 * by `FRACTION_ANSWER_BLOCKED_SKILLS` below: `487 ÷ 9` *is* what its answer
 * answers, but the answer is `54 1/9`.
 *
 * The list is measured rather than asserted: `render/prompts.test.ts` runs every
 * bound level of every registered template, applies the declared operator to the
 * two operands the host would draw, and compares the result with the canonical
 * answer in exact rationals. What disagrees must be exactly this list, in both
 * directions — so a family added tomorrow whose question a binary-op string cannot
 * state is named here by an existing test, not by somebody noticing.
 */
export const MISSTATED_QUESTION_TEMPLATES: readonly string[] = [
  "dw.prompt.long-div.remainder",
  "dw.prompt.missing-operand.add-unknown",
  "dw.prompt.missing-operand.mul-unknown",
  "dw.prompt.missing-operand.sub-unknown-minuend",
];

/**
 * The longest numeral a shipped game will put in front of a child, in characters.
 *
 * Read off `games/polarity/src/core/labels.ts`, which is still the only pack in
 * this repository that refuses an answer outright rather than squeezing a layout
 * — `isPrintable(v)` is false past this, and `orbValues` returns `null` for an
 * item whose *answer* will not print, so the item is never offered.
 *
 * **It was eight, and eight was not measured.** The constant's stated reason was
 * that eight characters "still fits the cell without squeezing"; they did not,
 * by about 60%, and nothing checked. POLARITY derives the number now, from the
 * thing that actually limits it: four answer orbs share a fixed slice of a
 * hundred-unit playfield, the numeral drawn over one is as wide as its lane
 * allows and no wider, and a character may not be narrower than half its own cap
 * height. That comes out at ten — which is `48,826 × 82,726`, the program's
 * stated ceiling, reached with less than one percent of margin rather than by
 * rounding in its favour.
 *
 * It is written down here because a curriculum row is only reachable if
 * something can draw its answer. Eleven characters is a row that ships to a
 * child who is served nothing.
 */
export const SHIPPED_NUMERAL_MAX_CHARS = 10;

/**
 * Levels whose answers are wider than any shipped game will print. **Empty.**
 *
 * ## What it recorded, and what cleared it
 *
 * `dw.mul.scale.times-power-of-ten L2` and `dw.mul.multidigit.long-multiplication`
 * L1 and L2 reach nine and ten characters, and the pack refused past eight.
 * Refusing is per-item and the host serves by *rung* — ask again at the same
 * difficulty and the same rung answers — so a level where every item is too wide
 * was not a graceful degradation. It was a Seal Bearer that asks nothing,
 * forever, and the child at the top of the ladder was the one it happened to.
 * Measured over 60 seeds a level, at the time it was recorded:
 *
 * | level | items too wide | widest |
 * |---|---|---|
 * | `dw.mul.scale.times-power-of-ten L2` | 18/60 | `546,270,000` — 9 |
 * | `dw.mul.multidigit.long-multiplication L1` | 51/60 | `263,502,180` — 9 |
 * | `dw.mul.multidigit.long-multiplication L2` | **60/60** | `1,042,977,861` — 10 |
 *
 * Nothing was ever wrong with the rows, and the fix was the pack's, in two parts:
 * the numeral budget is derived from the orb's lane rather than typed, which puts
 * it at ten characters; and POLARITY caps its own stream with
 * `next({ maxDifficulty })` the first time a rung refuses to print, which is what
 * makes any ceiling — this one or the next one — safe rather than silent.
 *
 * ## Why the empty list stays
 *
 * Because it is asserted in BOTH directions. `render/prompts.test.ts` measures
 * every bound level of every non-deprecated row against
 * `SHIPPED_NUMERAL_MAX_CHARS` and requires the result to equal this list, so the
 * day a row reaches eleven characters it is named here by a failing build rather
 * than by a child being served silence. A deleted list would have to be
 * rediscovered the same way the first one was: by promoting the rows and
 * watching a pack's sweep go red.
 */
export const NUMERAL_WIDTH_BLOCKED_LEVELS: readonly string[] = [];

/** The skills above, deduplicated — the rows that stay draft because of it. */
export const NUMERAL_WIDTH_BLOCKED_SKILLS: readonly string[] = [
  ...new Set(NUMERAL_WIDTH_BLOCKED_LEVELS.map((label) => label.slice(0, label.lastIndexOf(" ")))),
];

/**
 * Skills whose answer is a fraction, which the only thing that serves an item
 * cannot write down.
 *
 * `answerText` in `dynawalla-app/src/packs/items.ts` returns `null` for anything
 * that is not an integer or a column algorithm, and everything downstream of it
 * treats `null` as `""`: `reveal` came back empty, `choicesFor` returned no
 * options, and `judge` parsed the response as an integer and scored every one of
 * them wrong. A complete-looking card nobody can pass. The host refuses to serve
 * such a row now, loudly — so promoting one is a rung that generates nothing, which
 * is the *other* failure this file exists to prevent.
 *
 * This list used to be prose. It is data because the row it most obviously catches,
 * `dw.div.whole.quotient-and-remainder`, passes every other check in this package:
 * its operator is right, `487 ÷ 9` states its question, its variant space is fine
 * and its prerequisites are active. Nothing in the curriculum would have stopped
 * it; only the app would, and only by serving nothing.
 *
 * `render/prompts.test.ts` asserts this equals the set of skills in the graph whose
 * bound levels emit a `fraction` answer schema, in both directions. The blocker
 * clears when `answerText` learns to write a fraction and `answer:fraction` has a
 * renderer — the same PR, since a string nobody can enter is not an answer.
 */
export const FRACTION_ANSWER_BLOCKED_SKILLS: readonly string[] = [
  "dw.div.whole.quotient-and-remainder",
  "dw.frac.arith.add-like-denominators",
  "dw.frac.arith.add-unlike-denominators",
  "dw.frac.arith.multiply-by-a-whole",
  "dw.frac.arith.multiply-fractions",
  "dw.frac.arith.subtract-fractions",
  "dw.frac.compare.same-numerator",
  "dw.frac.compare.unlike-fractions",
  "dw.frac.equivalence.build-equivalent",
  "dw.frac.equivalence.improper-to-mixed",
  "dw.frac.equivalence.lowest-terms",
  "dw.frac.equivalence.mixed-to-improper",
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
