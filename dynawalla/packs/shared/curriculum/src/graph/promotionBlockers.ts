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
 * Read off `games/polarity/src/core/labels.ts`, which is the narrowest budget any
 * pack in this repository declares and the only one that is a hard refusal rather
 * than a layout squeeze: `isPrintable(v)` is false past eight characters, and
 * `orbValues` returns `null` for an item whose *answer* will not print. The number
 * is not arbitrary there — the game's numeral cell is twice as wide as it is tall
 * and the constant was measured over 44,000 orbs of the ladder as it then was.
 *
 * It is written down here because a curriculum row is only reachable if something
 * can draw its answer, and until this pass no row in the graph came close to the
 * limit. `48,826 × 82,726` is ten characters.
 */
export const SHIPPED_NUMERAL_MAX_CHARS = 8;

/**
 * Levels whose answers are wider than any shipped game will print.
 *
 * ## What this costs, precisely
 *
 * A pack that cannot print an answer must not offer it, and `games/polarity` gets
 * that right: it declines the item and says so on the console. But declining is
 * per-item and the host serves by *rung* — ask again at the same difficulty and the
 * same rung answers — so a level where every item is too wide is not a graceful
 * degradation. It is a Seal Bearer that asks nothing, forever, and the child at the
 * top of the ladder is the one it happens to. Measured over 60 seeds a level:
 *
 * | level | items too wide | widest |
 * |---|---|---|
 * | `dw.mul.scale.times-power-of-ten L2` | 21/60 | `544,080,000` — 9 |
 * | `dw.mul.multidigit.long-multiplication L1` | 50/60 | `799,204,497` — 9 |
 * | `dw.mul.multidigit.long-multiplication L2` | **60/60** | `2,367,541,946` — 10 |
 *
 * ## Why this is the pack's to clear and not the curriculum's
 *
 * Nothing is wrong with the rows. `48,826 × 82,726` is the program's stated ceiling
 * and `docs/` has said so since before the generator existed; a graph that trimmed
 * its own content to a texture atlas would be the tail wagging the dog. What is
 * missing is on the other side, and `packs/sdk` already has the seam for it:
 * `next({ maxDifficulty })` is "a ceiling on the same scale, the stream never goes
 * above it", and polarity does not pass one. A pack that can print eight characters
 * says so, and gets the part of the ladder it can draw.
 *
 * So this blocker clears when a pack either widens its numeral or caps its stream —
 * and the row is a `status` flip after it, exactly like the operator was.
 * `render/prompts.test.ts` asserts this list equals the levels whose answers exceed
 * `SHIPPED_NUMERAL_MAX_CHARS`, in both directions, so widening one and forgetting
 * the other fails.
 */
export const NUMERAL_WIDTH_BLOCKED_LEVELS: readonly string[] = [
  "dw.mul.multidigit.long-multiplication L1",
  "dw.mul.multidigit.long-multiplication L2",
  "dw.mul.scale.times-power-of-ten L2",
];

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
