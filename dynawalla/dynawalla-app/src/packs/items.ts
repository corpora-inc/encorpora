// Where a question comes from, and who says whether it was right.
//
// `bridge.ts` is deliberately ignorant of what an item is; this is the module
// it is ignorant of. Everything here is `@dynawalla/curriculum` — the skill
// graph, the generator families, the executable mal-rules — and nothing here
// does arithmetic of its own. That is the whole point of ADR-0022 read from the
// host's side: the pack draws, the curriculum decides, and a game that wanted
// to be beaten by fiddling with what it renders has nothing to fiddle with.
//
// Three properties, each of them a reason this file exists rather than the
// equivalent living in a pack:
//
//   * **Exact.** Every operand, every answer and every distractor is a
//     `Rational` rendered to a decimal string. No `number` is ever parsed out
//     of one and no float is ever compared.
//   * **Seeded.** An item is a pure function of (profile, pack, sequence). The
//     same learner on the same pack on two devices gets the same ladder.
//   * **Judged here.** `nextItem` does not carry the answer. `judge` records
//     the attempt and *then* returns the canonical value, so `reveal` — which
//     a game that must place the correct target before the child reaches it
//     genuinely needs — is a declared capability rather than a hole.
//
// **What a rung is.** The curriculum ships one generator family so far
// (`gen.arith.column-op`) bound to four active skills at four levels each. The
// rungs are those bindings, sorted by the difficulty the node itself declares,
// and the ladder walks them: a correct answer climbs, a wrong one steps down.
// How *far* a correct answer climbs is how quick it was for *that item* — read
// off the cadence table in `docs/EXPERIENCE_DESIGN.md`, never off a constant.
// See `climbRungs` below for the three regimes and why none of them is a hold.
// That is not the FSRS scheduler (ADR-0008) — it is the smallest honest
// thing that makes a pack's stream get harder — and it is confined to this file
// so replacing it does not touch the boundary.

import type {
  Item,
  ItemChoice,
  Judgement,
  LearnerSummary,
} from "../../../packs/sdk/src/index.ts"
import type {
  AnswerValue,
  AnyGeneratorFamily,
  Exercise,
  PromptOperator,
  PromptSlot,
  Rational,
  SkillNode,
} from "./curriculum.ts"
import {
  activeNodes,
  familyById,
  FORM_FREE_ENTRY,
  promptOperator,
  rational,
  seedFrom,
  createRng,
  SLOT_BOTTOM,
  SLOT_TOP,
} from "./curriculum.ts"

/**
 * The glyph each operator is written with, as a child reads it.
 *
 * U+2212 MINUS, U+00D7 MULTIPLICATION SIGN, U+00F7 DIVISION SIGN. A hyphen is not
 * a minus sign, an `x` is not a times sign and a `/` is not a division sign, and
 * at 40px a child can tell — the same standard the minus has been held to here
 * since this file was written, now applied to the other two.
 */
const OPERATOR_GLYPH: Readonly<Record<Exclude<PromptOperator, "none">, string>> = {
  "+": "+",
  "−": "−",
  "×": "×",
  "÷": "÷",
}

/**
 * The same operator as `Item.operator` spells it, which is not the same string.
 *
 * `packs/sdk/src/protocol.ts` types the field `"+" | "-" | "×" | "÷" | "<" | ">" |
 * "="` — an ASCII hyphen for the minus and the typographic glyphs for the other
 * two. That is the wire format every shipped game already reads, so the mapping is
 * written out rather than assumed: `operator` is what a game branches on and
 * `prompt` is what it draws, and only the second is typography.
 */
const OPERATOR_PROTOCOL: Readonly<
  Record<Exclude<PromptOperator, "none">, NonNullable<Item["operator"]>>
> = {
  "+": "+",
  "−": "-",
  "×": "×",
  "÷": "÷",
}

/** Items kept addressable for `judge` and `reveal`. Oldest evicted first. */
const LEDGER_LIMIT = 512

/**
 * ## How long a question is *expected* to take
 *
 * `EXPERIENCE_DESIGN.md` publishes a cadence table — instrumented p50/p90, never
 * shown to a child:
 *
 * | class | p50 | p90 |
 * |---|---|---|
 * | single-digit fact | 2.8 s | 6 s |
 * | two-digit with regrouping | 6 s | 14 s |
 * | three-digit | 11 s | 27 s |
 * | the `5,001 − 2,798` class | 16 s | 40 s |
 *
 * Two straight lines fit all four rows exactly, in the width of the widest
 * operand — which is also how the table names its own classes:
 *
 *     p50 = 2.8 s                             at one digit
 *         = 6 s  + 5 s  × (digits − 2)        from two digits up
 *     p90 = 6 s                               at one digit
 *         = 14 s + 13 s × (digits − 2)        from two digits up
 *
 * Check: three digits → 6+5 = 11 s and 14+13 = 27 s; four → 16 s and 40 s. The
 * constants below are those two lines and nothing else, so the table stays the
 * source of truth and this file holds no opinion of its own about how long a
 * child should take.
 *
 * **Why this is here at all.** Until this note, the ladder climbed on
 * `correct && latencyMs <= 6000` — one constant for every question in the
 * product. Against the table above, six seconds is the *median* of a two-digit
 * regrouping item, so half of the children answering at the expected pace never
 * climbed; and it is well under the median of the `5,001 − 2,798` class, so the
 * three rungs of `dw.add.regroup.subtract-across-zero` — the hardest content
 * that ships — were not hard, they were **unreachable**. The doc's own line for
 * this row reads "COMPREHENSION — not budgeted. The child's time. Measured,
 * never limited," and a constant threshold budgeted it.
 */
const CADENCE_FACT_P50_MS = 2_800
const CADENCE_FACT_P90_MS = 6_000
const CADENCE_COLUMN_P50_MS = 6_000
const CADENCE_COLUMN_P50_PER_DIGIT_MS = 5_000
const CADENCE_COLUMN_P90_MS = 14_000
const CADENCE_COLUMN_P90_PER_DIGIT_MS = 13_000

/**
 * The table's widest p90/p50 spread, as a ratio so it multiplies exactly.
 *
 * 6/2.8, 14/6, 27/11 and 40/16 are 2.14, 2.33, 2.45 and 2.50. The largest is
 * taken, because the first use of it below is "widen a declared median into a
 * slow tail" and a narrow guess there is the punitive direction.
 *
 * It has three uses, and they are the same number on purpose:
 *
 *   * A declared `fluencyTarget.p50Ms` becomes a tail at `p50 × 5/2`.
 *   * The **quick mark** of an item is its median compressed by the same
 *     ratio, `p50 × 2/5` — the mirror image of the tail. An item's expected
 *     band is therefore the stretch between them, and "quick" and "slow" are
 *     the same distance from the middle rather than two independent opinions.
 *   * The **most rungs one answer can be worth**, so an unbelievably small
 *     latency cannot buy an unbounded climb. 5/2 is under three, and three is
 *     the number of wrong slabs on a four-option grid, so a guesser's expected
 *     move stays negative. Necessary and *not* sufficient — see
 *     `QUICK_RUN_FOR_BONUS`, which is what actually keeps a guesser off the
 *     ladder, and `items.test.ts`, which runs one.
 */
const CADENCE_SPREAD_NUM = 5
const CADENCE_SPREAD_DEN = 2

/**
 * Options on a closed list: the canonical answer and three wrong ones.
 *
 * Four because that is what a two-by-two grid holds, and a game that draws its
 * options as a grid draws an empty cell for a missing one.
 */
const CHOICE_COUNT = 4

export type Rung = {
  readonly node: SkillNode
  readonly family: AnyGeneratorFamily
  readonly params: unknown
  readonly level: number
}

/**
 * Every (skill, level) the shipped graph can generate, easiest first.
 *
 * Ordered by the node's own declared difficulty for the level, which is a
 * `Rational` — so the sort is exact and does not depend on how two coefficients
 * round. A binding whose family is not registered, or whose parameters do not
 * validate, is dropped rather than throwing: an unusable rung is a curriculum
 * bug, and it must not be a blank screen in a child's game.
 */
export function ladder(nodes: readonly SkillNode[] = activeNodes()): readonly Rung[] {
  const rungs: { rung: Rung; b: Rational }[] = []
  for (const node of nodes) {
    const family = familyById(node.generator.family)
    if (!family) continue
    node.generator.params.forEach((raw, level) => {
      const parsed = family.paramSchema.validate(raw)
      if (!parsed.ok) return
      const own = node.difficulty.levels[level]
      if (own === undefined) return
      rungs.push({
        rung: { node, family, params: parsed.value, level },
        b: rational.add(node.difficulty.b, own),
      })
    })
  }
  rungs.sort((a, b) => rational.cmp(a.b, b.b))
  return rungs.map((entry) => entry.rung)
}

/** The forms a rung may serve. Free entry when it has one: a pack owns its own
    surface, and the column scaffold is a host-drawn worksheet by another name. */
function formsFor(rung: Rung): readonly string[] {
  const declared = rung.node.generator.forms
  return declared.includes(FORM_FREE_ENTRY) ? [FORM_FREE_ENTRY] : declared
}

/** A prompt slot as a child reads it.
 *
 * A `switch` over `kind` rather than a chain ending in a fall-through, so that
 * the next slot kind the curriculum grows fails to compile HERE — at the
 * renderer that has to learn how to draw it — instead of silently landing in
 * whichever branch happened to be last. That is not hypothetical: the
 * `fraction` kind arrived exactly that way. */
function slotText(slot: PromptSlot | undefined): string {
  if (slot === undefined) return ""
  switch (slot.kind) {
    case "number":
      return (
        rational.toDecimalString(slot.value, slot.decimalPlaces) ?? rational.toString(slot.value)
      )
    case "count":
      return String(slot.value)
    case "term":
      return slot.key
    case "fraction": {
      // As written, never reduced: `2/4` and `1/2` are the same number and
      // different problems, and the generator chose which one it asked. The
      // whole part is drawn only when there is one, so a plain fraction reads
      // `1/2` rather than `0 1/2`.
      const written = `${slot.num.toString()}/${slot.den.toString()}`
      if (slot.whole === undefined || slot.whole === 0n) return written
      return `${slot.whole.toString()} ${written}`
    }
  }
}

/**
 * The two operands a child reads, whichever family drew them.
 *
 * This file used to reach for `slots[SLOT_TOP]` and `slots[SLOT_BOTTOM]` by
 * name, and `slotText(undefined)` returns `""`. So when the curriculum grew a
 * second active family — `gen.arith.number-facts`, which names its slots
 * `first` and `second` — every question on the six easiest rungs in the product
 * rendered as `" + "` with no numbers in it, and nothing said so. That is the
 * failure mode this codebase keeps meeting: a missing thing becoming an empty
 * string and then becoming a blank screen a child is asked to answer.
 *
 * Named slots when a family declares them, declaration order otherwise, so a
 * family that names its slots anything at all is drawn correctly. And an empty
 * operand is refused by the caller rather than printed.
 */
export function operandsOf(exercise: Exercise): readonly string[] {
  const slots = exercise.prompt.slots
  const named = [slots[SLOT_TOP], slots[SLOT_BOTTOM]]
  const chosen = named.every((slot) => slot !== undefined) ? named : Object.values(slots)
  return chosen.map((slot) => slotText(slot))
}

/**
 * The operator this question is written with, read off the curriculum's own
 * declaration — or `null` when the question is not a binary operation at all.
 *
 * ## What this replaced, and what it cost
 *
 * Until this function, the operator was guessed from the shape of the prompt key:
 *
 * ```ts
 * export function isSubtraction(promptKey: string): boolean {
 *   return promptKey === PROMPT_KEY_SUB || promptKey.endsWith(".sub")
 * }
 * // …
 * prompt: `${top} ${subtract ? MINUS : "+"} ${bottom}`,
 * ```
 *
 * So **every template that was not a subtraction was drawn as an addition**. That
 * is right for the four templates the graph had active and wrong for everything
 * else in it, and the failure it produces is the worst shape this program has: not
 * a blank card, which a reviewer sees in a minute, but a card that reads perfectly,
 * is answerable, and marks a correct child wrong. Measured on the shipped code,
 * against the draft rows it was about to be handed:
 *
 * | row | what a child would have read | what it wanted |
 * |---|---|---|
 * | `dw.mul.facts.tables-to-twelve` | `5 + 7` | 35 |
 * | `dw.div.facts.division-facts`   | `12 + 3` | 4 |
 * | `dw.ns.compare.whole-numbers`   | `432 + 737` | 737 |
 * | `dw.ns.place.digit-value`       | `295 + dw.term.place.hundreds` | 200 |
 *
 * `promptOperator` is a table read against `render/prompts.ts`, where the operator
 * a question is written with is declared by the template that writes it. There is
 * no fallback and there must never be one: an unregistered key returns `null` and
 * the caller refuses to serve the item, because the alternative is a guess, and the
 * guess is what the table above is.
 */
export function binaryOperator(
  promptKey: string,
): { readonly glyph: string; readonly protocol: NonNullable<Item["operator"]> } | null {
  const declared = promptOperator(promptKey)
  if (declared === null || declared === "none") return null
  return { glyph: OPERATOR_GLYPH[declared], protocol: OPERATOR_PROTOCOL[declared] }
}

/**
 * A minus sign as a child's keypad might spell it, as the parser spells it.
 *
 * The host draws U+2212 in every prompt it writes — so a pack that echoes the
 * glyph it was given back as part of an answer, or a keypad whose minus key is the
 * one on the card, produces a string `rational.parseRational` rejects outright:
 * its integer pattern is `/^[+-]?\d+$/` and U+2212 is neither of those. A rejected
 * parse is scored wrong, silently, which on a signed row is every negative answer
 * a child gets right.
 */
export function normalizeMinus(text: string): string {
  return text.replace(/−/gu, "-")
}

/** An answer value as a child would write it. Never a float, never rounded. */
export function answerText(value: AnswerValue, decimalPlaces: number): string | null {
  if (value.kind === "integer" || value.kind === "columnAlgorithm") {
    return rational.toDecimalString(value.value, decimalPlaces)
  }
  return null
}

function decimalPlacesOf(exercise: Exercise): number {
  const schema = exercise.schema
  return schema.kind === "integer" || schema.kind === "columnAlgorithm" ? schema.decimalPlaces : 0
}

function digitsOf(exercise: Exercise): number | undefined {
  const schema = exercise.schema
  if (schema.kind === "integer") return schema.digits
  if (schema.kind === "columnAlgorithm") return schema.cols
  return undefined
}

/**
 * The closed list a pack may offer, canonical included, deterministically
 * shuffled.
 *
 * Offered on every item rather than only on a choice-schema one: a tower
 * defence that puts three slabs on a wall needs two wrong answers a child would
 * actually produce, and the mal-rules are the only place those exist. A pack
 * that wants free entry ignores the list; `judge` accepts either the value text
 * or a choice id, so neither presentation changes who decides.
 */
export function choicesFor(exercise: Exercise, places: number): readonly ItemChoice[] {
  const canonical = answerText(exercise.answer.canonical, places)
  if (canonical === null) return []
  const texts: string[] = [canonical]
  for (const distractor of exercise.distractors) {
    const text = answerText(distractor.value, places)
    if (text === null || texts.includes(text)) continue
    texts.push(text)
    if (texts.length === CHOICE_COUNT) break
  }

  // A mal-rule only fires when the item can provoke it, so a clean two-digit
  // sum offers one wrong answer and a three-way choice would be a coin toss.
  // The padding is place-value near-misses — off by one, off by ten — computed
  // in exact rationals like everything else here. They are not diagnoses and
  // are never reported as one; they exist so a closed list is a choice.
  //
  // Four, not three: a game that lays its options out in a grid draws an empty
  // slab for a missing one, and an empty slab is a wrong answer a child cannot
  // read.
  //
  // A negative near-miss is skipped on a row whose answers cannot go below zero —
  // it is not a wrong answer a child would produce there, it is a number that
  // cannot be written — but it is a perfectly ordinary one on a row whose schema
  // says otherwise. `AnswerSchema.integer.signed` is the only thing that can tell
  // the two apart, and reading it here is what stops an integer row from being
  // padded down to a two-slab coin toss.
  const exact = exercise.answer.canonical
  const signed = exercise.schema.kind === "integer" && exercise.schema.signed === true
  if (exact.kind === "integer" || exact.kind === "columnAlgorithm") {
    for (const offset of [1n, -1n, 10n, -10n, 100n, -100n, 9n, 11n]) {
      if (texts.length >= CHOICE_COUNT) break
      const shifted = rational.add(exact.value, rational.rational(offset))
      if (!signed && rational.sign(shifted) < 0) continue
      const text = rational.toDecimalString(shifted, places)
      if (text === null || texts.includes(text)) continue
      texts.push(text)
    }
  }
  const rng = createRng(seedFrom(exercise.exerciseId, "choices"))
  // Fisher–Yates over the integer stream, so the order is stable per exercise
  // and the right answer is not always the first slab on the wall.
  for (let i = texts.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i)
    const a = texts[i] as string
    const b = texts[j] as string
    texts[i] = b
    texts[j] = a
  }
  return texts.map((text, index) => ({ id: `c${String(index)}`, text }))
}

/**
 * How wide the widest operand is, in digits, as a child reads it.
 *
 * Digit characters only, so `12.5` is three and `4,003` would be four however it
 * is punctuated. Zero means the prompt has no numerals in it — a fraction card
 * or a worded term — and zero is *not* a width: it is "this file cannot tell",
 * and the caller must treat it as such rather than as "easy".
 */
export function widestOperandDigits(operands: readonly string[]): number {
  let widest = 0
  for (const operand of operands) {
    let digits = 0
    for (const ch of operand) if (ch >= "0" && ch <= "9") digits += 1
    if (digits > widest) widest = digits
  }
  return widest
}

/** The cadence table read at a width, or `null` when there is no width to read. */
export function cadenceFor(digits: number): { p50Ms: number; p90Ms: number } | null {
  if (!Number.isInteger(digits) || digits < 1) return null
  if (digits === 1) return { p50Ms: CADENCE_FACT_P50_MS, p90Ms: CADENCE_FACT_P90_MS }
  const over = digits - 2
  return {
    p50Ms: CADENCE_COLUMN_P50_MS + CADENCE_COLUMN_P50_PER_DIGIT_MS * over,
    p90Ms: CADENCE_COLUMN_P90_MS + CADENCE_COLUMN_P90_PER_DIGIT_MS * over,
  }
}

/**
 * How long an answer to *this* item may take and still be worth a whole rung —
 * or `null` when nothing about the item says.
 *
 * The item's own p90. A child at the p90 is not slow; a child at the p90 is the
 * ninth of ten children who answered it, and the tenth climbs too, by the
 * fraction `climbRungs` gives them. Nothing here is a ceiling on a child's
 * progress; it is the width of the band worth exactly one rung.
 *
 * Two inputs, and the wider of them wins:
 *
 *   * **The cadence table**, at the width of the widest operand.
 *   * **`fluencyTarget.p50Ms`**, when the curriculum node declares one, widened
 *     by the table's own spread. This is not decoration. `gen.arith.column-op`
 *     is the addition ladder the table was measured on; `dw.mul.*` declares a
 *     15 s median and `dw.div.*` an 18 s one, and a two-digit multiplication
 *     read only through the column model would get a 14 s window around a 15 s
 *     median — the same defect, in a domain that has not gone active yet. Taking
 *     the **max** makes authored data able only to widen the window and never to
 *     narrow it, which `items.test.ts` asserts over every node in the graph.
 *
 * `null` — a prompt with no numerals on a node that declares no target — means
 * the item's class is not knowable here. The caller promotes anyway and says so
 * out loud. A ladder that quietly declines to move is exactly the silent blank
 * this codebase keeps shipping, and "we could not classify it" is never a reason
 * to hold a child down.
 */
export function climbWithinMs(digits: number, fluencyP50Ms: number | undefined): number | null {
  return itemPace(digits, fluencyP50Ms)?.tailMs ?? null
}

/**
 * The three landmarks on *this* item's clock, or `null` when it has none.
 *
 * `quickMs < medianMs < tailMs`, always, and every one of them is read off the
 * item — the cadence table at the width the child saw, widened (never narrowed)
 * by a `fluencyTarget.p50Ms` the node declares. There is no absolute number
 * here and there must never be one: the whole defect this replaced was a single
 * constant applied to every question in the product.
 *
 * The tail is the p90 of the class. The quick mark is the median compressed by
 * the same ratio the tail stretches it by, so an item's "expected" band is
 * symmetric about its own median in log terms rather than being two unrelated
 * judgements.
 */
export function itemPace(
  digits: number,
  fluencyP50Ms: number | undefined,
): { quickMs: number; medianMs: number; tailMs: number } | null {
  const table = cadenceFor(digits)
  const declared =
    fluencyP50Ms === undefined || !Number.isFinite(fluencyP50Ms) || fluencyP50Ms <= 0
      ? null
      : fluencyP50Ms
  if (table === null && declared === null) return null
  const medianMs = Math.max(table?.p50Ms ?? 0, declared ?? 0)
  const tailMs = Math.max(
    table?.p90Ms ?? 0,
    declared === null ? 0 : Math.round((declared * CADENCE_SPREAD_NUM) / CADENCE_SPREAD_DEN),
  )
  return {
    quickMs: (medianMs * CADENCE_SPREAD_DEN) / CADENCE_SPREAD_NUM,
    medianMs,
    tailMs,
  }
}

/**
 * How many consecutive quick, correct answers earn the speedcuber's rate.
 *
 * Not a duration — the rule that everything be relative to the item's own
 * expected time is about *times*, and this is a count of answers. It exists
 * because being quick is the one signal a child can produce without knowing any
 * mathematics: a random tap on a four-slab grid is instant, and one tap in four
 * is right.
 *
 * The arithmetic. A guesser on a closed list of `CHOICE_COUNT` is right one
 * time in four and wrong three, so their expected move per answer is
 * `bonus/4 − 3/4`. At a bonus of one rung — the rule this replaced, which had
 * no bonus at all — that is −0.5 a question and a guesser sits on the floor. At
 * the full 2.5 for any single quick answer it is −0.09, which is not a drift,
 * it is noise. That is not a hypothetical: the simulated guesser in
 * `items.test.ts` reached **rung 26 of 35** the first time this rule was
 * written without a run, having answered nothing correctly except by luck.
 *
 * Requiring a run of `n` costs a guesser about 4ⁿ questions per bonus. The
 * number below was measured rather than reasoned: sixty seeded sessions of four
 * hundred random taps each, against the shipped ladder, at every run length.
 *
 * | run | furthest a guesser got | where they finished |
 * |-----|------------------------|---------------------|
 * | 1   | 35 of 35 (the top)     | 25                  |
 * | 3   | 22                     | 6                   |
 * | 4   | 10                     | 3                   |
 * | 5   | 11                     | 3                   |
 * | 6   | 8                      | 3                   |
 * | — the same guesser under the *old* rule, with no bonus at all: 8, and 3.    |
 *
 * Six is where a guesser stops being able to tell the difference: their whole
 * trajectory is the one they had before the speedcuber existed. A child who
 * actually is quick pays six questions for it once and then keeps it for as
 * long as they keep being quick, which on a 36-rung ladder costs them about two
 * answers out of seventeen.
 *
 * "Sustained fast-correct evidence" is the founder's phrase for this, and a run
 * is the smallest honest reading of it. Anything but a quick correct answer — a
 * miss, or a correct one at ordinary pace — resets the run to zero.
 */
const QUICK_RUN_FOR_BONUS = 6

/**
 * ## How far one correct answer climbs
 *
 * In rungs, and never zero. The founder's ruling, in his words:
 *
 * > "if it takes a long time to get the right answer then we should tend to
 * > stay at the same level .. if the person is 100% right but slow, we could
 * > still slowly move up. But, a speedcuber should move up very fast."
 *
 * Three regimes, each relative to the item's own clock (`itemPace`):
 *
 *   * **Quick** — under the quick mark. `quickMs / latencyMs` rungs, so a child
 *     answering twice as fast as the mark takes two rungs at a time, capped at
 *     the table's own spread — but only once `quickRun` says they have done it
 *     `QUICK_RUN_FOR_BONUS` times running. A speedcuber does not walk every
 *     rung; a lucky tap is not a speedcuber.
 *   * **Expected** — between the quick mark and the tail. Exactly one rung.
 *     This is the great majority of answers, and it is the pace the table was
 *     measured at.
 *   * **Tail** — past the item's p90. `tailMs / latencyMs` rungs: a fraction,
 *     decaying as the answer gets later, and **positive at every latency**. Ten
 *     slow-but-right answers still promote; the tenth of ten children is not
 *     demonstrating what the first is, and they are not stuck either.
 *
 * The decay is what the ruling asks for and a step function is not. Holding a
 * rung — which is what this rule did until the ruling — meant a child who is
 * correct all afternoon and unhurried never moved, and that child is the one
 * the product exists for. A flat fraction instead would have said a child at
 * ten times the expected time is doing the same thing as one at one and a half,
 * and they are not.
 *
 * Two ways to reach a plain one-rung climb by default, and the caller says so
 * on the console for both: an item whose class is not knowable, and a latency
 * that is not a measurement. Neither is ever a reason to hold a child down.
 *
 * **What a contaminated clock costs.** `judge` documents that some packs time
 * from when a question was drawn rather than from when it became answerable,
 * inflating every latency by a second or two. Read against the three regimes,
 * that inflation can deny a genuinely quick child the speedcuber's rate — the
 * quick mark of a single-digit fact is around a second, and a second of
 * contamination is all of it. It cannot demote anybody: the middle regime is
 * still a whole rung, and the tail is still positive. The cost of a bad clock
 * is a slower climb, never a fall, and that is the direction it has to fail in.
 *
 * A wrong answer never reaches here. The descent is one rung, at any speed.
 */
export function climbRungs(input: {
  /** Width of the widest operand as drawn. 0 when the prompt held no numerals. */
  readonly digits: number
  /** `fluencyTarget.p50Ms` from the node, when it declares one. */
  readonly fluencyP50Ms?: number | undefined
  readonly latencyMs: number
  /**
   * How many quick, correct answers came immediately before this one. Zero
   * unless the caller is tracking a run, which the ladder is.
   */
  readonly quickRun?: number
}): number {
  const pace = itemPace(input.digits, input.fluencyP50Ms)
  if (pace === null) return 1
  const { latencyMs } = input
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return 1
  if (latencyMs > pace.tailMs) return pace.tailMs / latencyMs
  if (latencyMs >= pace.quickMs) return 1
  if ((input.quickRun ?? 0) + 1 < QUICK_RUN_FOR_BONUS) return 1
  return Math.min(CADENCE_SPREAD_NUM / CADENCE_SPREAD_DEN, pace.quickMs / latencyMs)
}

/** Whether an answer this quick counts toward the run, whatever it is worth. */
export function isQuick(
  digits: number,
  fluencyP50Ms: number | undefined,
  latencyMs: number,
): boolean {
  const pace = itemPace(digits, fluencyP50Ms)
  if (pace === null) return false
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return false
  return latencyMs < pace.quickMs
}

type Served = {
  readonly exercise: Exercise
  readonly rung: Rung
  readonly places: number
  readonly choices: readonly ItemChoice[]
  /** Width of the widest operand as drawn. 0 when the prompt held no numerals. */
  readonly digits: number
  answered: boolean
}

export type ItemServiceDeps = {
  /** Namespaces the seed, so two learners do not share a stream. */
  readonly profileId: string
  /** Recorded against the learner. The host's only inbound write. */
  readonly record: (outcome: { packId: string; correct: boolean }) => void
  readonly rungs?: readonly Rung[]
}

export type ItemService = {
  next(input: {
    packId: string
    skillId?: string
    /**
     * Where on the ladder the pack wants this question, 0..1 — 0 the easiest
     * rung the host has, 1 the hardest.
     *
     * Relative rather than absolute, and that is the whole design: a pack
     * cannot know how many rungs there are, and the bottom of the ladder moves
     * as the curriculum grows. A request for 0 today lands on two-digit +
     * two-digit because that is the easiest rung that exists; when rungs below
     * it are authored, the same request lands on those instead and no pack is
     * rebuilt. What it can never do is fail — the index is clamped into the
     * ladder, so an unsatisfiable request becomes the nearest satisfiable one.
     */
    difficulty?: number
    /** A ceiling on the same scale. The stream never goes above it. */
    maxDifficulty?: number
  }): Item | null
  judge(input: {
    packId: string
    itemId: string
    response: string
    /**
     * ## What `latencyMs` is, and what it is not
     *
     * **There is no contract.** This is a finding, not a description. The SDK
     * declares `answer({ itemId, response, latencyMs })` with no doc comment on
     * the field, `bridge.ts` only clamps it to ten minutes and rejects a
     * negative, and every pack decides for itself what interval it names. What
     * has actually been observed in the shipped games: latency timed from when
     * a question was *drawn* rather than from when it became *answerable*, and
     * latency timed to a projectile's *impact* rather than to the child's
     * commit — the second inflating every answer in that game by the two to
     * three seconds of the arc (`games/trebuchet/src/game.test.ts` pins the fix
     * from the pack's side).
     *
     * That is why the rule below is written to be robust to a couple of seconds
     * of contamination rather than exact. The p90 of an item is roughly twice
     * its p50; a game whose clock starts early by two seconds spends about a
     * seventh of that head-room on a two-digit item and less on anything
     * harder, so it costs a child a rung occasionally and never systematically.
     * A rule cut at the p50 — which is what a flat 6 s was for two-digit
     * regrouping — has no head-room at all, and contamination there is the
     * difference between climbing and not.
     *
     * `EXPERIENCE_DESIGN.md` says what the contract *should* be, and nothing
     * implements it yet: `timeToFirstKeyMs` and `timeToCommitMs` recorded
     * separately, because a long first key is retrieval difficulty and a long
     * key-to-commit is execution difficulty. "Corpán conflates them into one
     * `latencyMs`; we will not" — and the SDK, today, does. Splitting the field
     * is a protocol change across `packs/sdk` and every game, so it is named
     * here rather than done here.
     */
    latencyMs: number
  }): Judgement
  reveal(itemId: string): string
  skip(itemId: string): void
  summary(): LearnerSummary
  /** The rung the ladder is standing on. Read by the developer surface. */
  readonly position: () => number
}

/**
 * Everything the bridge's item methods are, as one object.
 *
 * Synchronous: nothing here touches IO. `services.ts` is what wraps it in the
 * promises `HostServices` asks for, which keeps every decision in this file
 * testable in Node with no DOM, no Tauri and no frame.
 */
export function createItemService(deps: ItemServiceDeps): ItemService {
  const rungs = deps.rungs ?? ladder()
  const ledger = new Map<string, Served>()
  const order: string[] = []
  const practised = new Set<string>()
  /**
   * Where the child is, in rungs, carried as a real number.
   *
   * The rung they are standing on is the whole part of it; the fraction is
   * credit earned toward the next one. That fraction is the entire mechanism
   * behind "correct but slow still climbs, slowly" — a tail answer is worth
   * less than a rung, and enough of them are worth one. Carrying it as one
   * number rather than as an integer plus a counter means the two directions
   * cannot disagree: a step down is `− 1` whatever the fraction was, and
   * `Math.floor(x − 1) === Math.floor(x) − 1` for every x, so a miss always
   * costs exactly one rung and never one and a bit.
   */
  let progress = 0
  /**
   * Consecutive quick, correct answers. Reset by anything else — see
   * `QUICK_RUN_FOR_BONUS` for why a single one earns nothing.
   */
  let quickRun = 0
  let sequence = 0
  /** A ladder with one rung answers every difficulty the same. Said once. */
  let toldAboutFlatLadder = false
  /** Warnings that would otherwise fire on every single answer. */
  const said = new Set<string>()
  const sayOnce = (key: string, message: string) => {
    if (said.has(key)) return
    said.add(key)
    console.warn(message)
  }

  const remember = (id: string, served: Served) => {
    ledger.set(id, served)
    order.push(id)
    while (order.length > LEDGER_LIMIT) {
      const evicted = order.shift()
      if (evicted !== undefined) ledger.delete(evicted)
    }
  }

  /**
   * How far this correct answer climbs, with the two "we cannot tell" cases
   * said out loud.
   *
   * `climbRungs` already returns a whole rung for both of them — this is where
   * they become a line on the console rather than a silent default:
   *
   *   * The item's class is not knowable — no numerals in the prompt and no
   *     `fluencyTarget` on the node. A future family will hit this the day it
   *     lands, and it must arrive as a line in the log rather than as a child
   *     whose rate is being guessed at.
   *   * The latency is not a measurement. Arithmetic on `NaN` is `NaN`, so a
   *     pack reporting a bad clock would otherwise pin a child to the bottom of
   *     the ladder in total silence — the exact shape of this bug, one layer
   *     down.
   */
  const climbFor = (served: Served, latencyMs: number): number => {
    const declared = served.rung.node.fluencyTarget?.p50Ms
    const gained = climbRungs({
      digits: served.digits,
      fluencyP50Ms: declared,
      latencyMs,
      quickRun,
    })
    // Counted after it is spent, so the sixth quick answer in a row is the
    // first one that pays. A correct answer at ordinary pace ends the run —
    // being quick six times running is the claim, not being right six times.
    quickRun = isQuick(served.digits, declared, latencyMs) ? quickRun + 1 : 0
    if (itemPace(served.digits, declared) === null) {
      sayOnce(
        served.rung.node.id,
        `[packs] ${served.rung.node.id} draws a prompt with no numerals in it and declares no ` +
          `fluencyTarget, so how long it should take is unknown — every correct answer on it ` +
          `climbs one rung. Give the node a fluencyTarget.p50Ms to pace it.`,
      )
    } else if (!Number.isFinite(latencyMs) || latencyMs < 0) {
      sayOnce(
        `latency:${served.rung.node.id}`,
        `[packs] ${served.rung.node.id} was answered with a latency of ${String(latencyMs)}, ` +
          `which is not a measurement — the answer climbs one rung, and the pack's clock needs ` +
          `fixing.`,
      )
    }
    return gained
  }

  const rungAt = (index: number): Rung | null => {
    if (rungs.length === 0) return null
    const clamped = Math.max(0, Math.min(rungs.length - 1, index))
    return rungs[clamped] ?? null
  }

  return {
    /** The rung being stood on: the whole part of `progress`, never a fraction.
        A pack asked for a rung index and a half-climbed one is not one. */
    position: () => Math.floor(progress),

    next: ({ packId, skillId, difficulty, maxDifficulty }) => {
      // A pack may name a skill it covers. It is a request, not an instruction:
      // an unknown id falls back to the ladder rather than failing, because a
      // pack built against a later curriculum must still be playable.
      const wanted =
        skillId === undefined ? null : (rungs.find((rung) => rung.node.id === skillId) ?? null)

      // A difficulty is the same kind of request, one rung lower down. It moves
      // the ladder rather than reading past it, so there is one position and
      // not two: a pack that drives the difficulty and then stops driving it
      // resumes from where it left the child, and `judge` keeps climbing and
      // stepping down from there.
      let index = Math.floor(progress)
      if (difficulty !== undefined || maxDifficulty !== undefined) {
        const span = Math.max(0, rungs.length - 1)
        const asked = difficulty === undefined ? index / Math.max(1, span) : difficulty
        // The request rounds to the nearest rung — a pack asking for 0.5 wants the
        // middle and not the rung below it. The **ceiling floors**, and the two are
        // deliberately different: `maxDifficulty` is documented as "the stream never
        // goes above it", and rounding a cap can only round it up. A pack that says
        // 0.2 on a 59-rung ladder got 12/58 = 0.203 — over its own ceiling, by a
        // rung, silently. It passed for as long as it did because 0.2 × 42 happened
        // to round down; the ladder grew and it stopped happening, which is the
        // shape of every rounding bug this codebase has met.
        const cap = maxDifficulty === undefined ? span : Math.floor(maxDifficulty * span)
        index = Math.max(0, Math.min(span, cap, Math.round(asked * span)))
        // The rung the pack named, carrying the credit already earned toward
        // the next one. Overwriting the whole number would let a game that
        // drives difficulty on every question quietly delete the fraction a
        // slow-and-correct child had banked, over and over, and that child
        // would never move — which is the bug this rule was rewritten to end.
        progress = index + (progress - Math.floor(progress))
      }

      const rung = wanted ?? rungAt(index)
      if (!rung) return null
      // Where the rung that was actually used sits, so the pack is told what it
      // got and not what it asked for. A pack comparing the two is how a
      // clamped request becomes visible on the pack's side.
      const span = Math.max(0, rungs.length - 1)
      const used = rungs.indexOf(rung)
      const ordinate = span === 0 ? 0 : Math.max(0, Math.min(1, used / span))
      if (span === 0 && difficulty !== undefined && !toldAboutFlatLadder) {
        toldAboutFlatLadder = true
        console.warn(
          `[packs] ${packId} asked for difficulty ${difficulty.toFixed(2)} and the ladder has ` +
            `${String(rungs.length)} rung(s) — every request lands on the same question until the ` +
            `curriculum has more than one`,
        )
      }

      sequence += 1
      const seed = seedFrom(deps.profileId, packId, String(sequence))
      let exercise: Exercise
      try {
        exercise = rung.family.generate({
          skillId: rung.node.id,
          level: rung.level,
          seed,
          params: rung.params,
          forms: formsFor(rung),
        })
      } catch (error) {
        // A generator that cannot draw is a curriculum bug and is loud, but it
        // is not a crash in a child's game: the pack is told there is nothing.
        console.error(`[packs] ${rung.node.id} could not generate`, error)
        return null
      }

      const [top = "", bottom = ""] = operandsOf(exercise)
      if (top === "" || bottom === "") {
        // A blank question is worse than no question: a child cannot answer
        // `" + "` and cannot tell that anything is wrong with it. Loud, and
        // named precisely enough to fix — the slot keys are what differ when a
        // new family arrives and this file has not learned to read it.
        console.error(
          `[packs] ${rung.node.id} (${rung.family.family}) drew a prompt with a missing operand: ` +
            `slots are [${Object.keys(exercise.prompt.slots).join(", ")}] and this read ` +
            `["${top}", "${bottom}"]`,
        )
        return null
      }

      // The operator before anything else is built, because a question drawn with
      // the wrong one is worse than no question: `5 + 7` wanting 35 reads perfectly
      // and marks a correct child wrong. `null` is a template the curriculum does
      // not register, or one it registers as not being a binary operation at all —
      // a place-value or comparison card, which needs a surface this file does not
      // have and which used to come out as `295 + dw.term.place.hundreds`.
      const operator = binaryOperator(exercise.prompt.key)
      if (operator === null) {
        console.error(
          `[packs] ${rung.node.id} (${rung.family.family}) emits the prompt template ` +
            `${exercise.prompt.key}, which the curriculum does not declare as a binary operation — ` +
            `there is no operator to draw between "${top}" and "${bottom}", so nothing is served. ` +
            `See render/prompts.ts: a question that is not "a OP b" needs a renderer of its own.`,
        )
        return null
      }

      const places = decimalPlacesOf(exercise)
      // The answer this file can write. A fraction answer comes back `null` from
      // `answerText`, which would make `reveal` an empty string and every response
      // wrong — a card that looks complete and cannot be passed. Refused here, out
      // loud, rather than discovered by a child.
      if (answerText(exercise.answer.canonical, places) === null) {
        console.error(
          `[packs] ${rung.node.id} (${rung.family.family}) has a ` +
            `${exercise.answer.canonical.kind} answer, which this file cannot write as text — ` +
            `the card would draw with no revealable answer and mark every response wrong. ` +
            `answerText() needs to learn this answer kind before the row can be served.`,
        )
        return null
      }
      const choices = choicesFor(exercise, places)
      const id = `${exercise.exerciseId}#${String(sequence)}`
      // Measured here rather than in `judge`, off the strings a child actually
      // read: the operands are already in hand, and the width of the question as
      // drawn is the only reading of "how hard is this item" that cannot drift
      // from what was on the screen.
      remember(id, {
        exercise,
        rung,
        places,
        choices,
        digits: widestOperandDigits([top, bottom]),
        answered: false,
      })
      practised.add(rung.node.id)

      const digits = digitsOf(exercise)

      return {
        id,
        skillId: rung.node.id,
        level: rung.level,
        difficulty: ordinate,
        form: "binary-op",
        operator: operator.protocol,
        operands: [top, bottom],
        prompt: `${top} ${operator.glyph} ${bottom}`,
        choices,
        answerKind: "integer",
        ...(digits === undefined ? {} : { digits }),
      }
    },

    judge: ({ packId, itemId, response, latencyMs }) => {
      const served = ledger.get(itemId)
      if (!served) throw new RangeError(`no such item: ${itemId}`)

      const canonical = answerText(served.exercise.answer.canonical, served.places) ?? ""
      // A pack may answer with the value or with the id of a choice it drew.
      // Both are the same act; a pack should not have to reformat a slab it
      // was handed to report that a child touched it.
      const chosen = served.choices.find((choice) => choice.id === response)
      // The host's own minus glyph normalised back to the one the parser reads.
      // See `normalizeMinus`: without it a child who answers `−7` on a signed row
      // is marked wrong for writing the sign the card is written with.
      const text = normalizeMinus(chosen?.text ?? response)

      let submitted: AnswerValue | null = null
      try {
        submitted = { kind: "integer", value: rational.parseRational(text) }
      } catch {
        // Not a number a child could have written. Wrong, not a crash: a pack
        // is free to report whatever a stray tap produced.
      }

      const verdict =
        submitted === null
          ? ({ correct: false } as const)
          : served.rung.family.check(served.exercise, submitted)

      // Recorded before the canonical value goes back, which is what makes it
      // safe to return one at all: there is no way to read the answer without
      // spending the attempt.
      if (!served.answered) {
        served.answered = true
        deps.record({ packId, correct: verdict.correct })
        // The ladder moves on what actually happened. Up on every correct
        // answer — by more than a rung when it was quick for this question, by
        // a fraction of one when it came from the item's slow tail — and down
        // one rung on any miss. Slow is not wrong: it is the same direction,
        // taken at the child's own speed. Wrong is the only thing that
        // descends, which is what stops a guesser.
        if (verdict.correct) progress = progress + climbFor(served, latencyMs)
        else {
          progress = progress - 1
          // A miss ends the run, however fast it was. Speed on a wrong answer
          // is not evidence of anything at all — it is what guessing looks
          // like — and the speedcuber's rate has to be earned again.
          quickRun = 0
        }
        // One clamp for both directions, and the floor is written as a floor:
        // no sequence of answers can put a child below the easiest rung the
        // curriculum has, and none can put them past the hardest.
        progress = Math.max(0, Math.min(Math.max(0, rungs.length - 1), progress))
      }

      return {
        correct: verdict.correct,
        canonical,
        ...(verdict.correct || verdict.misconception === undefined
          ? {}
          : { diagnosis: verdict.misconception }),
        advance: verdict.correct,
      }
    },

    reveal: (itemId) => {
      const served = ledger.get(itemId)
      if (!served) throw new RangeError(`no such item: ${itemId}`)
      return answerText(served.exercise.answer.canonical, served.places) ?? ""
    },

    skip: (itemId) => {
      const served = ledger.get(itemId)
      if (served) served.answered = true
    },

    summary: () => ({
      skills: rungs
        .map((rung) => rung.node.id)
        .filter((id, index, all) => all.indexOf(id) === index)
        .map((id) => ({ id, level: practised.has(id) ? ("practiced" as const) : ("new" as const) })),
    }),
  }
}
