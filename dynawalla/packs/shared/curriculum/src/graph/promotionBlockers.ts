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
 * **CG-10**, the variant-space floor — and `CG10_BLOCKED_LEVELS` is now **empty**. It
 * requires an estimated space of 975, a 40-item practice run repeating no more than
 * one item in fifty. Twenty-four levels did not clear it and every one is resolved,
 * by one of the two instruments and never by argument: a level whose ceiling was
 * arbitrarily small was widened, and a level whose space is genuinely all there is
 * declares `closedFactSet` and is exhausted in `closedSpaces.test.ts`. See the note
 * under the list.
 *
 * **`MIN_RUNG_VARIANTS`**, the floor *under* the floor: 24 distinct problems per rung,
 * whatever CG-10 says about it, with `SMALL_RUNG_LEVELS` naming the one active level
 * that is exempt and why. `ladder.test.ts` measures it over the *active* graph, which
 * is what a child stands on; `families.property.test.ts` measures the same bound over
 * the **whole** graph, so a draft rung authored under the floor is named before it can
 * be promoted rather than after.
 *
 * **The apparatus a pack builds**, in `PACK_STATEMENT_BLOCKED_SKILLS`, and this one
 * is new with the blank statement. A question the host can now *state* is not a
 * question every pack that declares it can *draw*, and the failure is the same silent
 * shape one layer out: a board whose pans cannot balance under any answer.
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

export const CG10_BLOCKED_LEVELS: readonly string[] = [];

/**
 * **Empty**, and it stays here for the reason `NUMERAL_WIDTH_BLOCKED_LEVELS` does: the
 * list is asserted in *both* directions, so the day a level slips under the floor it is
 * named by a failing build rather than by somebody noticing.
 *
 * ## What was on it, and what took it off
 *
 * Twenty-four levels, and two before them. `dw.mul.scale.times-power-of-ten L0` was
 * `47 × 100` — ninety multiplicands times one power, ninety problems — and is three
 * digits by two powers, which is 1,800. `dw.div.whole.divide-exact L0` was a two-digit
 * quotient over a one-digit divisor, 720 problems, and is a three-digit quotient, which
 * is 7,200. Both were bounded by a digit count that nothing about the content asked to
 * be small: **a level that could be widened and simply has not been is a level that
 * gets widened.**
 *
 * The remaining twenty-four were the whole of `ns`'s two sub-floor levels, nine `frac`
 * rows and four `alg` rows, and they split the same way:
 *
 * - **Widened**, because the ceiling was arbitrary. `dw.ns.round.whole-numbers`' easiest
 *   three-digit rung rounded only to the nearest ten (720 problems) and now rounds to
 *   ten *or* hundred (1,602). `dw.frac.arith.add-like-denominators` L2 was a ceiling of
 *   16 (1,008 problems, read as ~780 by the gate's estimator) and is a ceiling of 20
 *   (2,100, read as ~1,180).
 * - **Declared closed and exhausted**, because the space is all there is.
 *   `dw.alg.equality.missing-subtrahend` L0 draws both operands from 1..9, so its space
 *   is exactly 81 items and no generator work changes that. Neither does anything change
 *   `dw.frac.equivalence.build-equivalent`, whose *entire task* — a reduced fraction
 *   scaled up, at the family's widest denominator — holds six hundred problems.
 *
 * ## The rule the second route now follows, and the loophole it closes
 *
 * `closedFactSet` exempts a level from the floor, so an inflated declaration would be a
 * way to buy the exemption without earning it: CG-10's substituted check is
 * `distinct ≤ declared`, which passes trivially for any number large enough. So every
 * declaration in this graph is **exhausted** in `closedSpaces.test.ts` — drawn until the
 * level stops yielding new items, and required to equal the declared count exactly.
 * Over-declaring fails, and so does under-declaring.
 *
 * That test is also why the field is used only where the space is **below** the floor.
 * Exhausting a space of a few hundred costs a few thousand seeds; exhausting the 2,280
 * same-numerator comparisons inside twentieths costs six figures, which is not a PR
 * gate. Two rungs are left unauthored as a result and `domains/frac.ts` records them:
 * their true spaces clear the floor and the estimator says otherwise, which is a finding
 * about CG-10's estimator rather than about the content.
 */

/** The skills above, deduplicated. */
export const CG10_BLOCKED_SKILLS: readonly string[] = [
  ...new Set(CG10_BLOCKED_LEVELS.map((label) => label.slice(0, label.lastIndexOf(" ")))),
];

/**
 * How many distinct problems a rung must have before a child may stand on it.
 *
 * ## The gap CG-10 leaves, and what fell through it
 *
 * CG-10 has two regimes and both of them are right. A level with an open
 * parameter space is measured against `VARIANT_SPACE_FLOOR`, 975 problems. A level
 * that declares `closedFactSet` is measured against its own declaration instead,
 * because there are 45 additions within ten and no forty-sixth, and a floor
 * derived from a model of generators that do not close was never a statement about
 * a closed one.
 *
 * Neither regime asks the question a child asks. `dw.add.facts.add-within-ten` L0
 * declared a closed set of **nine**, reached all nine, overran nothing and passed
 * every gate in the package — and it was the bottom rung of the whole product, so
 * every game's difficulty floor parked on it. The founder played four different
 * games for an hour and reported the same thing from each:
 *
 * > "easy also means 4+5 not just 2+0 over and over again for an hour."
 *
 * An honestly-declared set of nine is not a lie. It is not a level either. So the
 * closed-set regime gains the one bound it was missing: **a declared closed set is
 * a rung a child stands on, and a rung is at least 24 problems.**
 *
 * ## Why 24
 *
 * A sitting is about 30 questions — the number `items.test.ts` measures
 * distinct-prompts against. Drawing 30 uniformly from `S` leaves about
 * `S(1 − (1 − 1/S)³⁰)` distinct, so no single rung ever gives 30 distinct in 30;
 * the host serves a *distribution* over about six rungs for exactly that reason
 * (`dynawalla-app/src/packs/items.ts`, PR #699). What the curriculum owes that
 * mechanism is that no rung inside a beginner's window is a handful of items: at
 * 24 the worst rung contributes 19 distinct problems to 30 draws, and the four
 * easiest rungs of the shipped ladder now offer 220 between them.
 *
 * It is deliberately **below** every set that is not exempt, so the number is a
 * floor and not a description. The smallest non-exempt rung is 26.
 *
 * ## Not a licence to inflate
 *
 * The bound is on the *level table*, never on the declaration. If the mathematics
 * of a rung is closed at nine, the answer is that nine items must not be a whole
 * level — widen what the level draws from, or fold it into a neighbour — and never
 * to write a larger number next to it. CG-10's overrun check catches the second
 * one immediately: a row that declares 30 and reaches 31 fails.
 */
export const MIN_RUNG_VARIANTS = 24;

/**
 * Active levels under `MIN_RUNG_VARIANTS`. **One**, and it is the top of its row.
 *
 * `dw.mul.facts.tables-within-five L2` is `{2..5}²` — sixteen products — which is
 * the entire multiplication table within five once the zero and identity facts are
 * out. There is no wider set at that content: `MAX_TRIVIAL_FACTOR` keeps the
 * trivial facts below the sixes for a reason of its own, so the level above this
 * one is `dw.mul.facts.tables-to-twelve` L0 at 36.
 *
 * It stays because the alternative is worse. Deleting it moves the multiplicative
 * ladder from −1.05 straight to −0.60, a 0.45-logit hole in the one strand a child
 * climbs one table at a time; and it is the *top* rung of its row, at ladder
 * position 19 of 66, so the child standing on it is not a beginner and the host's
 * kernel spreads five sixths of their questions across neighbouring rungs holding
 * thousands of items.
 *
 * The list is data and asserted in **both** directions by `ladder.test.ts`: a rung
 * that slips under the floor is named here or the test fails, and a rung widened
 * past it must be struck off or the test fails too. That is what stops the next
 * nine-item floor from being discovered by a child.
 */
export const SMALL_RUNG_LEVELS: readonly string[] = ["dw.mul.facts.tables-within-five L2"];

/*
 * Measured twice, over two different graphs, and both directions each time.
 *
 * `ladder.test.ts` runs the list above over `activeNodes` — what a child can actually be
 * served, which is the claim that matters most. `families.property.test.ts` runs the same
 * bound over the whole graph including the twenty-eight draft rows, and it has to: this
 * package authors rungs long before it promotes them, so a draft level under the floor
 * that nothing measured would be discovered by the promotion PR at best and by a child at
 * worst. It is the same asymmetry that let `dw.div.facts.division-facts` ship a difficulty
 * table no gate had checked.
 *
 * `closedSpaces.test.ts` adds the third reading, from the other side of the same number:
 * over a level's **whole declared space** rather than over a 500-seed sample of it. A
 * sample reports what it happened to draw; a space reports what exists, and a rung whose
 * universe is nineteen items cannot be made wider by sampling it harder.
 */

/**
 * Prompt templates whose question the host still cannot state — **one**, and what is
 * left after the operator problem and then the blank were fixed.
 *
 * ## The blocker before this one, and the blocker before that
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
 * ## Four of the five came off this list, and by a field rather than an argument
 *
 * A correct operator is not a stated question, and this list used to hold four
 * templates whose unknown is *inside* the expression. The string `a OP b` cannot say
 * that, so a child reading the card correctly answered something other than what was
 * wanted:
 *
 * | template | what a child read | what it wanted |
 * |---|---|---|
 * | `missing-operand.add-unknown` | `1 + 10` | 9 — the operand, not 11 |
 * | `missing-operand.mul-unknown` | `3 × 15` | 5 |
 * | `missing-operand.sub-unknown-minuend` | `1 − 5` | 6 |
 *
 * `render/prompts.ts` now carries a second field beside the operator — `PromptBlank`,
 * where the box sits — and the host writes the whole statement from the two operands
 * and the two declarations: `47 + □ = 68`, `□ − 47 = 68`, `□ × 15 = 165`. The
 * templates are struck off because the defect is, not because the floor moved. The
 * founder asked for the shape in as many words, and he was right about more than he
 * said: a blank in the *middle* is the one arrangement a calculator cannot answer for
 * a child, because finding it means knowing which operation undoes the one on the
 * card.
 *
 * `missing-operand.sub-unknown` was never on this list and is worth a line, because
 * it is why "the operator is right" is not enough. Its slots are `known + answer` and
 * `known`, so `93 − 47` wanting 46 is a perfectly *true* subtraction — the card was
 * arithmetically fine and asked the wrong skill. It draws `93 − □ = 47` now, which is
 * the missing subtrahend the row is named for.
 *
 * ## The one that is left
 *
 * | template | what a child reads | what it wants |
 * |---|---|---|
 * | `long-div.remainder` | `129 ÷ 2` | 1 — the *remainder*, not 64 |
 *
 * Not a blank: `129 ÷ 2 = □` would want 64. The statement it needs is a third shape
 * — `129 ÷ 2 = 64 r □`, a quotient *and* a remainder — and `PromptBlank` deliberately
 * does not reach it. `dw.prompt.long-div.quotient-remainder` is not on the list and is
 * blocked anyway, by `FRACTION_ANSWER_BLOCKED_SKILLS` below: `487 ÷ 9` *is* what its
 * answer answers, but the answer is `54 1/9`.
 *
 * The list is measured rather than asserted: `render/prompts.test.ts` runs every
 * bound level of every registered template, writes the statement the two declarations
 * describe, substitutes the canonical answer for the box, and checks the equation is
 * true in exact rationals. What disagrees must be exactly this list, in both
 * directions — so a family added tomorrow whose question the host cannot state is
 * named here by an existing test, not by somebody noticing.
 */
export const MISSTATED_QUESTION_TEMPLATES: readonly string[] = ["dw.prompt.long-div.remainder"];

/**
 * Templates whose question is **not a binary operation at all**, and which the only
 * thing that serves an item therefore refuses outright.
 *
 * ## Why this needed to be data
 *
 * Because it is the whole reason the `ns` domain has never served a child a single
 * question, and it was prose in a file header.
 *
 * `dynawalla-app/src/packs/items.ts` composes a question out of two operands, an
 * operator glyph and a blank position. `binaryOperator()` returns `null` for a
 * template that declares `operator: "none"`, and the caller returns `null` rather than
 * guessing:
 *
 * ```
 * [packs] … emits the prompt template …, which the curriculum does not declare as a
 * binary operation — there is no operator to draw between "295" and
 * "dw.term.place.hundreds", so nothing is served.
 * ```
 *
 * That is correct behaviour and it is the right log line. But it means a promotion of
 * any row below buys a rung that generates a question, refuses to draw it, and serves
 * the child *nothing* — the failure `NUMERAL_WIDTH_BLOCKED_LEVELS` describes as "a Seal
 * Bearer that asks nothing, forever". `MISSTATED_QUESTION_TEMPLATES` catches a card that
 * states the wrong question; this catches a card that states no question.
 *
 * The three shapes here are not one missing feature. "In 4,193, what is the digit in
 * the hundreds place worth?" needs a numeral and a **place name**; "which is greater,
 * 3/8 or 3/5?" needs two numbers and a **relation**; `2/3 = ☐/12` needs an equation
 * between two written fractions. `PromptBlank` reaches none of them, deliberately —
 * `a OP b`, `☐ OP a = b` and `a OP ☐ = b` and no wider — and stretching it to would be
 * the guess this registry exists to retire.
 *
 * ## How it is checked
 *
 * `render/prompts.test.ts` reads the operator off every registered declaration and
 * requires the `none` set to equal this list, and requires every skill whose bound
 * levels emit *only* such templates to be `draft`. Both directions: a template that
 * gains an operator must be struck off, and one added as `none` must be named.
 *
 * The rows it blocks are all six of `ns`, the four `frac.equivalence` rows, the two
 * `frac.compare` rows and `dw.alg.equality.balance-meaning` — thirteen of the graph's
 * twenty-eight draft rows, and the largest single reason the draft list is as long as
 * it is. It clears when a pack lands a renderer for a question that is not two
 * operands and a glyph; that is the same PR as `--strict-renderers` going green, and
 * it is a pack's, not the curriculum's.
 */
export const NON_BINARY_QUESTION_TEMPLATES: readonly string[] = [
  "dw.prompt.compare-order.greater",
  "dw.prompt.compare-order.lesser",
  "dw.prompt.frac-equivalence.build",
  "dw.prompt.frac-equivalence.simplify",
  "dw.prompt.frac-equivalence.to-improper",
  "dw.prompt.frac-equivalence.to-mixed",
  "dw.prompt.missing-operand.both-sides",
  "dw.prompt.place-value.digit-in-place",
  "dw.prompt.place-value.digit-value",
  "dw.prompt.place-value.total-in-place",
  "dw.prompt.round-estimate.round",
];

/**
 * Rows the host can state and a **pack** cannot draw. **One**, and it is not the pack's.
 *
 * ## Why this list has to exist at all
 *
 * Because a stated question is not a drawn one, and the layer that finds out is the one
 * nobody was checking. `packs/shared/game-host` flattens an `Item` to six fields and
 * forwards `prompt` byte for byte, so for twenty-seven of the twenty-eight packs a
 * statement is a string to draw and a longer string is a layout problem at worst.
 * `games/balance` is the twenty-eighth: it splits the prompt at the `=` and builds a
 * **physical apparatus** out of each side, and it is the only pack that declares all five
 * of these rows. Its model was a pan of weights that add, and two of these statements are
 * not sums.
 *
 * ## Four came off, and by a pack fix rather than an argument
 *
 * The list held `missing-subtrahend` (`93 − □ = 47`: `tokenizeSide` set a sign when it
 * read a minus and pushed the blank term without applying it, so the box was *added* to
 * the pan), `missing-factor` (`□ × 15 = 165`: the tokeniser collapsed `6 × 2` to a single
 * weight and could not collapse a product it did not know yet), and `unknown-minuend`,
 * which drew correctly and was unreachable under CG-4 only because its one prerequisite
 * was `missing-subtrahend`.
 *
 * `games/balance` #724 rebuilt the tokeniser around a signed `Item` with `product`,
 * `quotient` and `countOf` terms — the founder had been locked into a board by a
 * *correct* answer to `88965 ÷ 9`, which is the same defect one operator over. Measured
 * afterwards, by running that pack's own `specFromQuestion` on the statements this host
 * writes and asking `whyUnsolvable` whether the beam levels with the canonical answer on
 * the fill side:
 *
 * | statement | board | verdict |
 * |---|---|---|
 * | `47 + □ = 68` | `fill`, left | **solvable** |
 * | `93 − □ = 47` | `fill`, left | **solvable** |
 * | `□ − 47 = 68` | `fill`, left | **solvable** |
 * | `□ × 15 = 165` | `fill`, left | **solvable** |
 * | `8 + 4 = □ + 5` | `fill`, right | **solvable** |
 *
 * So three rows are `active`, and the measurement cannot live in this package — the
 * curriculum imports nothing from `games/` and must not — which is why it is written
 * down here in the form the previous four measurements were.
 *
 * ## The one that is left, and it is the host's
 *
 * `balance-meaning` is the fifth row in that table and it *is* drawable: COUNTERPOISE
 * builds a solvable board for `8 + 4 = □ + 5`. It stays draft because **nothing can hand
 * the pack that string.** `drawStatement` in `dynawalla-app/src/packs/items.ts` writes
 * `a OP b`, `□ OP a = b` and `a OP □ = b` and no fourth shape, and the row's template
 * declares `operator: "none"` for exactly that reason — see
 * `NON_BINARY_QUESTION_TEMPLATES`, where it is named alongside the whole `ns` domain.
 *
 * It carries a second blocker that would outlast the first: the row declares the balance
 * scale `required`, and `Item` in `packs/sdk/src/protocol.ts` has no field to ask a pack
 * for a representation. Promoting it would assert a requirement the host cannot transmit,
 * to the one pack that would honour it anyway.
 *
 * ## How it is checked
 *
 * `render/prompts.test.ts` asserts every entry is a real node and is `draft`, and — in the
 * other direction — that the draft rows of the `alg` domain are **exactly** these. So
 * promoting one without striking it fails, and demoting one without naming it fails.
 */
export const PACK_STATEMENT_BLOCKED_SKILLS: readonly string[] = [
  "dw.alg.equality.balance-meaning",
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
