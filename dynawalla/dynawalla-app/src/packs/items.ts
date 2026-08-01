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
  PromptBlank,
  PromptOperator,
  PromptSlot,
  Rational,
  SkillNode,
} from "./curriculum.ts"
import {
  activeNodes,
  familyById,
  FORM_FREE_ENTRY,
  promptBlank,
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

/**
 * The blank a child fills in, and why it is **U+25A1 WHITE SQUARE** and not `___`.
 *
 * The founder asked for the shape in underscores:
 *
 * > "maybe to prevent the calculator (or at least make it so that you have to
 * > understand the problem to use it correctly) we could use blanks in an equation
 * > `___ × 15 = 165`"
 *
 * The shape is right and the glyph is not, and the difference is measurable rather
 * than a matter of taste. `games/balance` is the only pack in the fleet that builds
 * a physical apparatus out of the statement instead of merely drawing it: it splits
 * the prompt at the `=` and tokenises each side (`src/adapter.ts:251-253`), and its
 * blank is matched as **exactly one of `□`, `?` or `_`** (`src/adapter.ts:60`). A run
 * of three underscores is not any of those, so it falls through the tokeniser to
 * `parseFrac` and is dropped — measured on the real pack code, `___ × 15 = 165`
 * builds a board with **no fill slot at all**, and `fillSide` then defaults to the
 * far pan (`src/adapter.ts:283`). The child is asked to load the pan the question
 * did not ask about. That is a silent-blank failure of exactly the kind this
 * repository has shipped four of in a week, and it is invisible to every test in the
 * fleet because all 28 stub hosts write `a OP b` and never a blank.
 *
 * `□` is also what balance *writes* when it generates its own boards —
 * `src/generate.ts:71` and the `6 × 2 = □ × 3` in `buildPrompt` — so this is the
 * fleet's existing notation rather than a new one, and it is the box CCSS 1.OA.D.8
 * and this curriculum's own comments (`☐`) already use for an unknown.
 *
 * `?` would parse too, and is rejected for a different measured reason: the fleet
 * already spends `?` on *failure*. `games/polarity` prints `?` for a numeral it
 * cannot draw (`src/core/labels.ts`, `LABEL_FAULT_TILE`) and `games/arena` refuses
 * to append a reveal to any prompt containing one (`src/mount.ts:392`). A blank that
 * shares its glyph with the fault marker is a blank that reads as a broken card.
 *
 * Note the code point: U+25A1 WHITE SQUARE, **not** U+2610 BALLOT BOX (`☐`), which
 * the prose in the curriculum uses and which balance's tokeniser does not accept.
 * Written as an escape so a copy-paste of the wrong box fails in `items.test.ts`
 * rather than on a child's screen.
 */
export const BLANK = "□"

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

/**
 * ## Why a rung is served as a distribution and not as a point
 *
 * The founder, having played it:
 *
 * > "we don't have to be at one level only 'mixed triple and double' .. we could
 * > still throw in some single digit problems but it should change the
 * > probabilities of harder and easier problems more smoothly."
 *
 * Until this note the ladder served `rungs[Math.floor(progress)]` and nothing
 * else. Two consequences, and both of them are what he was reporting:
 *
 *   * Every question in a sitting came from one rung, so on a rung whose fact
 *     set is closed and small — `add-within-ten` L0 has **nine** items in it —
 *     the same sum came round every few questions and the content looked
 *     hardcoded. It is not hardcoded; it is a nine-item set served nine times.
 *   * The rung's ordinate moved in whole steps, so the content *lurched*: a
 *     child was on `0 + 2` and then, in one step, on nothing but the next rung.
 *     There was no such thing as "mostly this, sometimes one either side".
 *
 * **The kernel.** A two-sided geometric weight over the offset from the rung the
 * ladder is standing on: the centre weighs 1, each rung below weighs
 * `BELOW_RATIO` times the one above it, each rung above weighs `ABOVE_RATIO`
 * times the one below it, truncated at `SPREAD_BELOW` and `SPREAD_ABOVE`.
 * Geometric because the weights then compose — two rungs away is exactly "one
 * rung away, twice" — and there is no distance at which the shape changes its
 * mind. Asymmetric because *easier than you can do* and *harder than you can do*
 * are not the same event: the first is a fluency rep, the second is a child stuck.
 *
 * ## What the numbers are, and why the upward reach was widened
 *
 * The founder again, having watched a child play the shipped mix:
 *
 * > "the interlude problems stay extremely easy for a long time. Do we have the
 * > concept of mixing in problems from the next higher level to measure the
 * > person's performance there and add variety? ... maybe we need to mix in a
 * > range and try people at a level higher just to see if they can do it ... when
 * > the person starts the preponderance is on the easy side but there is some
 * > probability that slightly harder stuff comes out even in the first few"
 *
 * The mix he was describing is the one this kernel used to make. Measured:
 *
 * | offset       | −3   | −2   | −1   | 0    | +1   | +2   |
 * |--------------|------|------|------|------|------|------|
 * | weight, was  | .125 | .25  | .5   | 1    | .25  | .0625|
 * | share, was   | 5.7% | 11.4%| 22.9%| 45.7%| 11.4%| 2.9% |
 * | weight, is   | .125 | .25  | .5   | 1    | .45  | .2025|
 * | share, is    | 4.9% | 9.9% | 19.8%| 39.6%| 17.8%| 8.0% |
 *
 * The rung immediately above went from **one question in nine to one in five and
 * a half**, and the whole upward reach from 14.3% to 25.8%.
 *
 * **Why it could not be widened before, and what changed.** `ABOVE_RATIO` used to
 * be fixed by the promotion gate, and the argument was airtight *given how the
 * gate read its evidence*. `PROMOTE_AT` is 0.95, so a child had five points of
 * head-room; content two rungs above is the part of the mix a child at their own
 * level plausibly cannot do at all; and the gate charged those draws against them.
 * If the two-above share exceeded the head-room, a child right about literally
 * everything else measured under 95% and **could never promote again, at any
 * level, forever.** A deadlock, not a tuning risk — so the reach was pinned at
 * whatever fitted under 5%.
 *
 * That constraint is gone, because the gate no longer reads the mixture. See
 * `ladderBand`: the founder's 95/85/75 thresholds are now read off the answers
 * drawn **at the rung the child is standing on**, and a draw above the centre is a
 * *probe* — evidence about the rung above, which is what it was always for — and
 * can never lower the promotion gate. There is therefore no share of two-above
 * content that deadlocks anything, and the reach is free to be set by what makes
 * it *informative* instead of by what makes it survivable.
 *
 * **What sets it now.** Three requirements, in the order they bind:
 *
 *   1. **The preponderance stays on the easy side** — his words. At or below the
 *      centre is **74.2%** of the stream, comfortably over two thirds.
 *   2. **Easier stays likelier than harder at every distance**, which is
 *      `ABOVE_RATIO < BELOW_RATIO`. Being served a rung below your level is a
 *      fluency rep; being served one above it is being stuck, and the two are not
 *      the same event at the same distance.
 *   3. **The probe has to arrive in time to be used.** This is the requirement
 *      that actually binds, and it comes straight out of `ladderBand`: a rung is
 *      read directly once there are `EVIDENCE_MIN` answers about it, and until
 *      then the reading is *borrowed from the rungs below* — which is the one
 *      reading that is systematically wrong in the permissive direction, because
 *      everything below a child is easy. So the rung above has to have gathered
 *      `EVIDENCE_MIN` answers by the time the child arrives on it, out of a memory
 *      `ATTEMPT_LOG` questions long. Requiring it inside *half* the log — so the
 *      evidence about the next rung is in the recent half of what is remembered
 *      rather than at its stalest end — is
 *      `share(+1) ≥ 2 × EVIDENCE_MIN / ATTEMPT_LOG` = **1 question in 6**.
 *
 * That is the whole of what the probe is for, and it is worth saying what it is
 * *not* for, because it was built and measured and thrown away. A cap on the climb
 * — "you may not climb past a rung the probe has measured you failing" — reads
 * like the obvious companion to this and does nothing at all: by the time the
 * probe has `EVIDENCE_MIN` answers in it the staircase has decayed to
 * `STEP_TRACK`, an ascent is a fraction of a rung, and a cap of one rung never
 * binds. Simulated over three learners at two paces, adding it and removing it
 * produced identical output to the last digit. The evidence the probe gathers is
 * spent by `ladderBand`, not by a second mechanism.
 *
 * 0.45 is the round number that clears (3) — 17.8% against 16.7% — while still
 * clearing (2). 0.40 misses it, at 16.4%. 0.5 would satisfy (3) and break (2) by
 * making one rung up exactly as likely as one rung down.
 *
 * **What it costs, said plainly.** Read against the accuracy a child plausibly has
 * at each offset — near everything below level, ~90% at level, ~60% one above,
 * ~30% two above — a child standing exactly at their own level now gets **82.6%**
 * of the whole stream right, where before they got 88.1%. That is roughly one
 * question in six rather than one in eight, and it is the price of the variety he
 * asked for: "occasionally the person will be getting something too easy or too
 * hard but it's fun for the variety". It is **not** charged against their level
 * any more, which is the half of this change that makes the price payable.
 *
 * Two more properties it has to have, and does:
 *
 *   * **Consecutive questions differ.** The chance two draws land on the same
 *     rung is `Σ p²` = **24.6%**, down from 29.1%: widening the reach spreads the
 *     centre out rather than concentrating it, so three questions in four move.
 *   * **A rung the child cannot do is uncommon, and present.** Two above is one
 *     question in twelve; three above is not served at all.
 *
 * **Reflected at the ends, not clipped.** At the bottom of the ladder there is
 * nowhere below to go, and clipping would pile 78% of a beginner's questions
 * onto rung 0 — nine items — which is the exact defect this exists to fix. So
 * the mass that falls off an end is *reflected back inward*: at rung 0 the
 * kernel becomes 46% / 34% / 14% / 6% over rungs 0..3, which is `add-within-ten`
 * L0 and L1 and `subtract-within-ten` L0 and L1 — about sixty distinct items
 * rather than nine, with nothing inflated and no closed set relabelled. That is
 * the answer to a small honest fact set: **reach the neighbours**, never pretend
 * the set is bigger than it is (CG-10 exists to stop exactly that pretence).
 */
export const SPREAD_BELOW = 3
export const SPREAD_ABOVE = 2
export const BELOW_RATIO = 0.5
export const ABOVE_RATIO = 0.45

/**
 * The weight of every rung on the ladder for a child standing on `centre`.
 *
 * Length `span + 1` — one weight per rung — summing to the untruncated kernel's
 * total, because mass that falls off an end is reflected inward rather than
 * dropped. Reflection is iterated, so a ladder narrower than the kernel (a test
 * with two rungs in it) still gets a normalisable set of weights instead of a
 * hole.
 *
 * Exported because a distribution asserted by sampling it is a distribution
 * asserted at whatever confidence the sample happened to have. `items.test.ts`
 * reads the weights.
 */
export function rungWeights(centre: number, span: number): readonly number[] {
  const width = Math.max(0, Math.floor(span)) + 1
  const weights = new Array<number>(width).fill(0)
  const from = Math.max(0, Math.min(width - 1, Math.round(centre)))
  for (let offset = -SPREAD_BELOW; offset <= SPREAD_ABOVE; offset++) {
    const weight =
      offset === 0 ? 1 : offset < 0 ? BELOW_RATIO ** -offset : ABOVE_RATIO ** offset
    // Reflect at both ends rather than clip. `-1` reflects to `1`, and on a
    // two-rung ladder `-3` reflects to `3` and then back to `1`, so the loop
    // runs until the index is inside — bounded, because each pass strictly
    // reduces the overshoot.
    let index = from + offset
    for (let guard = 0; guard < 64 && (index < 0 || index > width - 1); guard++) {
      if (index < 0) index = -index
      if (index > width - 1) index = 2 * (width - 1) - index
    }
    if (index < 0 || index > width - 1) index = from
    weights[index] = (weights[index] as number) + weight
  }
  return weights
}

/** `Rng` emits uint32 rather than a float, so a unit draw is spelled out once. */
const UINT32_RANGE = 2 ** 32

/** One rung drawn from `rungWeights`. Deterministic in the stream it is given. */
export function pickRung(centre: number, span: number, unit: number): number {
  const weights = rungWeights(centre, span)
  let total = 0
  for (const weight of weights) total += weight
  if (total <= 0) return Math.max(0, Math.min(weights.length - 1, Math.round(centre)))
  // `unit` is clamped rather than trusted: a stream that returns exactly 1 must
  // land on the last rung with weight, not past the end of the array.
  let cut = Math.min(0.999_999_999, Math.max(0, unit)) * total
  for (let index = 0; index < weights.length; index++) {
    cut -= weights[index] as number
    if (cut < 0) return index
  }
  return weights.length - 1
}

/**
 * ## Finding a child's level quickly, then tracking it gently
 *
 * The founder, in the same report:
 *
 * > "right now the true draw is almost impossible to progress beyond 0+2 level.
 * > We need to sort of quickly find the players level .. maybe where they are
 * > getting 80%+ correct but slowly .. go down on a wrong answer, go up on a
 * > right answer"
 *
 * and, one paragraph earlier, the apparent opposite:
 *
 * > "it's way too quick to go from 0+1 to 1269/9. We need to find the users
 * > level more gently!"
 *
 * They are the same request. The *search* must be quick and the *content* must
 * not lurch. What was shipped was the reverse of both: a fixed ±1 rung, which is
 * a slow search, married to a single-rung stream and a 64-deep question queue in
 * `packs/shared/game-host`, which is what turned the search into a teleport once
 * the queue finally turned over. The queue is fixed there; the search is fixed
 * here.
 *
 * **The shape: a decaying stride, aimed by a gate on sustained accuracy.** The
 * stride is standard psychophysics and is the right standard, because the problem
 * is literally threshold estimation. What the *direction* is decided by is not
 * standard, and it is not standard because the founder's rule is not a threshold —
 * see `PROMOTE_AT`, which is where the band, the window and the arithmetic live.
 *
 *   * **The stride shrinks.** It opens at `STEP_START` rungs, multiplies by
 *     `STEP_DECAY` after every answer, and is *halved again at every reversal* —
 *     every time the child's direction changes, because a reversal is the moment
 *     their level got bracketed. Large strides early are the "quickly find the
 *     level"; the shrinking is the "more gently".
 *   * **The floor of the stride depends on the evidence.** While no reversal has
 *     happened the stride bottoms out at `STEP_OPEN` = 1 — which is exactly the
 *     rate this file shipped with, so **a child who is never wrong is never
 *     slower than they were before**, and the 87-answer property for a slow
 *     perfect child is preserved by construction rather than by tuning. Once
 *     bracketed it bottoms out at `STEP_TRACK`, a quarter of a rung, which is
 *     what makes the tracking gentle.
 *   * **In the child's own currency.** The descent is scaled by `pace`, a running
 *     mean of what this child's correct answers have actually been worth
 *     (`climbRungs`, unchanged — quick, expected and tail regimes all still
 *     apply, and they now scale the stride instead of being the whole of it). A
 *     child worth 0.4 of a rung an answer falls 0.4 × step, not 1 × step. Without
 *     this a deliberate child would fall at the rate of a quick one and climb at
 *     their own, which parks every slow child several rungs below the fast child
 *     who knows exactly as much.
 *   * **The first miss is symmetric.** Before any reversal the descent weight is
 *     1, whatever the band says: the first wrong answer is the move that *closes*
 *     the bracket, and it should be the same size as the moves that opened it.
 *     Multiplying an opening stride of four rungs by the decisive weight would
 *     throw a child twelve rungs down for one slip, which is the lurch in the
 *     other direction.
 *
 * **A guesser still cannot climb.** One tap in four on a four-slab grid never
 * gets a forty-answer window to 95%, so `bandOf` reads `lost` on essentially
 * every answer and the guesser is pinned. The speedcuber bonus is still gated
 * behind `QUICK_RUN_FOR_BONUS` consecutive quick *correct* answers, which a
 * guesser reaches one time in 4⁶. `items.test.ts` runs the bot.
 */
export const STEP_START = 4
export const STEP_OPEN = 1
export const STEP_TRACK = 0.25
export const STEP_DECAY = 0.72
export const REVERSAL_DECAY = 0.5

/**
 * ## The founder's band: sit at 85%, climb only above 95%, and below 75% get out
 *
 * This replaces a single Kaernbach target, and the reason it replaces it is that
 * the founder's rule has **two** thresholds in it and a weighted staircase has
 * one. Him, having played VOLTA on 0.3.3:
 *
 * > "you get a few right just by being lucky and all of a sudden you are asked to
 * > do like 87364/9 or something super treacherous.... the level should be
 * > adjusted I think so that the person is getting 80-90% right and it's a bit
 * > easier... not that it's smashing you through with a 50% because you are
 * > getting lucky and it's racing you to impossible mode."
 *
 * and then the rule itself:
 *
 * > "i think there is a principle here. **you only progress when sustaining >~95%**
 * > ... **if you are getting 85% you are at the right level. if you are less than
 * > ~75% its too hard.** Volta right now will just ream your ass if you get a few
 * > right!"
 *
 * **Why a weighted staircase cannot express that.** Kaernbach's rule — down/up =
 * `p/(1 − p)` — has exactly one accuracy at which the drift is zero, and it drifts
 * at every other accuracy. Set it to 80% and the child is walked to 80%; set it to
 * 85% and the child is walked to 85%. There is no ratio that *sits still* over a
 * range, and "85% is the right level, 95% is where you progress" is a range. What
 * is more, the staircase moves on a single answer: at the tracking floor one
 * correct answer was worth +0.25 of a rung and at the opening stride it was worth
 * four, so four lucky answers in a row moved a child about twelve rungs. That is
 * the "a few right just by being lucky" in one sentence, and no choice of ratio
 * fixes it, because the instrument has a denominator of one.
 *
 * **The instrument.** A running window of the last `RECENT_WINDOW` answers, and
 * four bands over its accuracy:
 *
 * | window accuracy | band     | what happens                                  |
 * |-----------------|----------|-----------------------------------------------|
 * | ≥ `PROMOTE_AT`  | `climb`  | a correct answer climbs, by stride × its worth |
 * | ≥ `SIT_AT`      | `sit`    | nothing moves — this is the right level        |
 * | ≥ `LOST_AT`     | `slip`   | down one stride, in the child's own currency  |
 * | below that      | `lost`   | down `DESCENT_FAR` strides                     |
 *
 * The window is the whole fix. **A single answer can no longer move a child a
 * rung on its own evidence**: to climb at all, the last forty answers have to be
 * at 95%, which is at most two misses. Four lucky taps do not reach it — four
 * correct answers out of four is 100%, but the *fifth* answer a guesser gets wrong
 * puts the window at 80% and the band at `slip`, and it stays there. Where the old
 * rule let one right answer buy a rung back immediately after a miss, one miss now
 * costs a child the climb until it ages out of the window.
 *
 * **Two thresholds, and a dead band between them.** Climbing needs 95%; falling
 * starts under 85%; between the two the ladder holds still. That dead band *is*
 * "if you are getting 85% you are at the right level", said as code, and it is why
 * the settled accuracy is a range and not a point: a child climbing from below
 * stops just under 95%, and a child sinking from above stops just over 85%.
 * **Every settled accuracy this rule can produce is inside the founder's band by
 * construction, from either direction.** Simulated against the real service, five
 * children of five different true abilities — 60%, 75%, 85% and 95% own-rung
 * accuracy at rung 20, plus a beginner at rung 3 — settle at a **measured 88.3% to
 * 89.9% correct**. The rule this replaced settled every one of the same five at
 * **80.0%**, because that is what one Kaernbach target does: it walks a child to
 * its number regardless of who they are. `items.test.ts` pins the two ends of the
 * band through the service — a 90% child comes to rest and stays, an 80% child is
 * walked down off a floor they cannot sit on — and the drift's change of sign
 * inside the band from the binomial.
 *
 * **Demotion is readier than promotion, and it is the gate that makes it so, not
 * the step size.** At a true accuracy of 85% — the bottom of the band — the
 * probability that one answer's window reads `climb` is 4.9%, and the probability
 * it reads `slip` or `lost` is 39.3%: **eight times readier down than up**, with
 * the two step sizes equal. Computed from the binomial, not tuned:
 *
 * | true accuracy | `climb` | `sit` | `slip` | `lost` | down : up |
 * |---------------|---------|-------|--------|--------|-----------|
 * | 100%          | 100.0%  |  0.0% |   0.0% |   0.0% | never     |
 * | 95%           |  67.7%  | 32.0% |   0.3% |   0.0% | 1 : 226   |
 * | 90%           |  22.3%  | 67.8% |   9.8% |   0.1% | 1 : 2.2   |
 * | 85%           |   4.9%  | 55.8% |  36.3% |   3.0% | 8 : 1     |
 * | 80%           |   0.8%  | 27.8% |  55.3% |  16.1% | 90 : 1    |
 * | 75%           |   0.1%  |  9.5% |  48.8% |  41.6% | 890 : 1   |
 *
 * Read the last two rows against "Volta right now will just ream your ass": at
 * 75% correct the ladder now moves down on nine answers in ten and up on one in a
 * thousand.
 *
 * **A perfect child is not slowed by any of this.** 100% correct is above 95% from
 * the very first answer, so `bandOf` reads `climb` on every one of them and the
 * gate is not in the way at all: the slow-perfect child's 126 answers to the top
 * of the 66-rung ladder are the same 126 they were, and `items.test.ts` asserts
 * the number rather than trusting the argument.
 *
 * **A miss inside a sustained window costs nothing.** Up needs both a correct
 * answer and a window at 95%; down needs only the window. So a child at 100% who
 * slips once holds their rung — the window still says this is their level, and one
 * miss is not evidence about a level, it is evidence about an item. This is the
 * direct answer to "will just ream your ass if you get a few right".
 */
export const PROMOTE_AT = 0.95
export const SIT_AT = 0.85
export const LOST_AT = 0.75

/**
 * How many recent answers the band is read off.
 *
 * **Derived, from the width of the dead band.** The window is a Bernoulli
 * estimate, so its standard error at accuracy `p` is `√(p(1−p)/N)`. For the dead
 * band between `SIT_AT` and `PROMOTE_AT` to actually *hold a child still* rather
 * than be crossed by noise in both directions every few answers, that error has to
 * be no wider than half the band. At the middle of the band, `p` = 0.90:
 *
 * `√(0.9 × 0.1 / N) ≤ (0.95 − 0.85) / 2` ⟹ `N ≥ 0.09 / 0.0025` = **36**
 *
 * Forty is that, rounded to a number a person can hold. Below it the band is
 * narrower than the measurement and the ladder wanders: at N = 20 the error is
 * 6.7 points against a 5-point half-band, and a child in the middle of the band
 * reads `climb` on 39% of answers instead of 22%.
 *
 * The cost of a longer window is how long a miss is held against a child, and that
 * cost is the point. At forty, `PROMOTE_AT` admits two misses, so a third one
 * stops the climb until the oldest ages out — which is "sustaining", and about two
 * minutes of play rather than about ten seconds.
 *
 * `items.test.ts` re-derives this from `SIT_AT` and `PROMOTE_AT` rather than
 * restating 40, so a future edit to either threshold fails until the window is
 * recomputed.
 */
export const RECENT_WINDOW = 40

/**
 * How many strides a `slip` costs, and how many a `lost` costs.
 *
 * `DESCENT_NEAR` is **one**: a level that turns out to be wrong is left at the
 * same rate it was entered. The asymmetry the founder asked for lives in the gate
 * and is worth a factor of eight there (see the table on `PROMOTE_AT`), so buying
 * it a second time in the step size would be double-counting, and a sweep of
 * `DESCENT_NEAR` over 1 and 2 moved neither the settled rung nor the settled
 * accuracy of any simulated child.
 *
 * `DESCENT_FAR` is **three**, and three is `LOST_AT / (1 − LOST_AT)` — the
 * Kaernbach weight for the accuracy the founder named as too hard. It is the same
 * arithmetic PR 699 used to get four out of 80%, applied to the threshold he
 * actually named, and it means the decisive branch falls at exactly the rate a
 * classical staircase aimed at 75% would: below 75% correct the ladder does not
 * merely drift down, it is being driven down.
 *
 * Measured, on a child parked twenty rungs above their level and answering at
 * their true accuracy, counting answers until the standing rung is back within a
 * rung of it:
 *
 * | `DESCENT_FAR` | answers to get back |
 * |---------------|---------------------|
 * | 1             | 73                  |
 * | 2             | 37                  |
 * | 3 (is)        | 25                  |
 * | 4             | 19                  |
 * | 6             | 13                  |
 *
 * Twenty-five is inside one window, which is the property that matters: a child
 * who has been thrown into content they cannot do is out of it before the evidence
 * that put them there has even aged out. Every one of these values leaves the
 * settled accuracy inside the founder's band — the gate sets that, not the step —
 * so the derivation is what picks, and the table is what confirms the derivation
 * is not absurd.
 */
export const DESCENT_NEAR = 1
export const DESCENT_FAR = 3

/**
 * How fast `pace` forgets. A quarter, so five answers carry ~76% of the weight:
 * long enough that one unusually fast tap does not redefine a child's currency,
 * short enough that a child who has warmed up is measured warm.
 */
export const PACE_ALPHA = 0.25

/**
 * The smallest currency a child can be charged a miss in.
 *
 * A pace of zero would make a miss free, which is the one thing a staircase may
 * never be — it is exactly what a guesser would need in order to climb. A tenth
 * of a rung is under the pace of a child answering at ten times an item's own
 * p90, so it binds on nobody the tail regime can measure and it closes the hole.
 */
export const PACE_FLOOR = 0.1

/**
 * ## How far a pack's `difficulty` may reach past the rung the evidence gives
 *
 * A pack proposes; the host disposes. A `difficulty` is honoured only within
 * this many rungs of where the host's own band has put the child, so a game can
 * shape the texture of a question and cannot outrun the evidence about the
 * child.
 *
 * **What it was before.** Issue 733 measured it. Seventeen of the twenty-seven
 * shipping packs send a `difficulty`, **none** of them reads `position()`, and
 * `next()` applied the request by rewriting the whole rung —
 * `progress = index + (progress − Math.floor(progress))`. The band would climb
 * on the evidence and the very next draw put it back: ARENA measured
 * `host pos 22 → 26 → 22`, every question. Every one of the seventeen derives
 * its number from its own game state — `stack` asks for `difficultyFor(floor)`,
 * the height of the tower — so for those seventeen games arithmetic difficulty
 * was a function of how well the *game* was going, which is close to the inverse
 * of the founder's rule and is the pacing audit's single defect one level up.
 * The band governed only the ten packs that never asked.
 *
 * **Why one rung.**
 *
 *   * **Not zero.** Zero is "the host owns the ladder outright", and it deletes
 *     the texture seventeen games are built out of — ARENA's breath, MONUMENT's
 *     floors — one of which the founder has called "almost perfect". A game
 *     saying "this chip should feel like a hard one" is a legitimate thing for a
 *     game to say. It is only not a legitimate thing for it to *decide*.
 *   * **Not two.** One rung is the size of the largest move the host itself can
 *     make on a single answer once the search has bracketed the child:
 *     `DESCENT_FAR × STEP_TRACK` is `3 × 0.25` = 0.75 of a rung at a pace of 1,
 *     and the climb at the same point is `STEP_TRACK` times what the answer was
 *     worth. So ±1 is about one decisive answer's worth of evidence — the most a
 *     pack can be handed while the host is still able to take it back within a
 *     handful of answers. At ±2 a pack moves the served content further in one
 *     draw than the band can correct in eight answers of evidence, and the pack
 *     is driving again with extra steps.
 *   * **Whole rungs**, because a rung is the unit the ladder moves a child in —
 *     see `progress`, where the whole part is the rung and the fraction is
 *     credit toward the next one.
 *
 * **It is a reach and not a drift.** The clamp is anchored on `Math.floor(progress)`
 * as `judge` left it and the request is *never written back* to `progress` — see
 * `next()`. A clamp that re-derived its anchor from its own previous output would
 * be a ratchet: a pack asking for rung 40 would be handed 23, then 24, then 25,
 * and would arrive at 40 in seventeen questions having answered to nobody.
 *
 * **A pack can still pull a child up — at the rate the evidence allows.** Asking
 * for one rung above serves one rung above; if the child sustains `PROMOTE_AT`
 * there, the band climbs and the anchor climbs with it, and the next request is
 * measured from the new rung. What cannot happen is arriving somewhere the last
 * forty answers do not support.
 *
 * The ceiling is not this. `maxDifficulty` is a *capability* — "I cannot draw a
 * question harder than this" — and it still binds absolutely, below the band and
 * above it, because handing a pack a rung it cannot render is PR 694 again.
 *
 * **Which leaves one way out, and it should be said rather than implied.** A
 * pack that pins its ceiling *to* its request has opted out of the band: it is
 * served at its ceiling and it pulls the ladder down to it, exactly as it did
 * before. `counterweight` does this on purpose (`difficulty: rung,
 * maxDifficulty: rung`), and `balance`, `horde`, `merge-idle`, `polarity`,
 * `gavel` and `lattice` carry standing ceilings that dilute it. So this constant
 * makes the founder's rule govern the `difficulty` channel across the fleet; it
 * does not make it govern a game that has declared it can only draw one rung.
 * That is pack work — widen what those games can render — and it cannot be done
 * from here without serving a game a question it cannot put on the screen.
 * `items.test.ts` pins the boundary so it is not mistaken for coverage.
 */
export const HINT_BAND = 1

/** Where the search is: the stride, the direction, and the child's own currency. */
export type Staircase = {
  /** Rungs, before the regime multiplier. Never below the current floor. */
  readonly step: number
  /** `+1`, `-1`, or `0` before the first answer. */
  readonly lastDir: 0 | 1 | -1
  /** Whether the child's direction has ever changed — i.e. whether they are bracketed. */
  readonly reversed: boolean
  /** Running mean of what this child's correct answers have been worth, in rungs. */
  readonly pace: number
}

export function openStaircase(): Staircase {
  return { step: STEP_START, lastDir: 0, reversed: false, pace: 1 }
}

/** How far this correct answer moves the centre, given what it was worth. */
export function ascentOf(stair: Staircase, gain: number): number {
  return gain * stair.step
}

/**
 * How far a `slip` or a `lost` answer moves the centre.
 *
 * One stride for a `slip` and `DESCENT_FAR` for a `lost`, in the child's own
 * currency — and one stride for both until the bracket closes, because the move
 * that closes the bracket must be the size of the moves that opened it.
 */
export function descentOf(stair: Staircase, band: Band): number {
  const weight = !stair.reversed ? 1 : band === "lost" ? DESCENT_FAR : DESCENT_NEAR
  return weight * stair.step * Math.max(PACE_FLOOR, stair.pace)
}

/**
 * The search after one answer in `dir`, worth `gain` rungs if it was correct.
 *
 * `dir` of `0` is a `sit`: the stride still decays — a child sitting in the band
 * is not searching, and the stride they eventually leave the band with should be a
 * tracking stride and not the one they arrived with — but the direction and the
 * bracket are untouched, because holding still is not a reversal.
 */
export function advanceStaircase(
  stair: Staircase,
  dir: 0 | 1 | -1,
  gain: number | null,
): Staircase {
  const isReversal = dir !== 0 && stair.lastDir !== 0 && dir !== stair.lastDir
  const reversed = stair.reversed || isReversal
  const floor = reversed ? STEP_TRACK : STEP_OPEN
  const base = isReversal ? stair.step * REVERSAL_DECAY : stair.step
  const step = Math.max(floor, floor + (base - floor) * STEP_DECAY)
  const pace = gain === null ? stair.pace : stair.pace + PACE_ALPHA * (gain - stair.pace)
  return { step, lastDir: dir === 0 ? stair.lastDir : dir, reversed, pace }
}

/**
 * Which of the four bands on `PROMOTE_AT`'s table a window of answers is in.
 *
 * `sit` on an empty window: before there is any evidence the ladder holds still,
 * which is the only reading of no evidence that cannot be gamed.
 */
export type Band = "climb" | "sit" | "slip" | "lost"

/**
 * A window of answers, oldest first. Plain booleans rather than a running count,
 * because the accuracy has to be *re-read* as answers age out and a counter that
 * only ever increments cannot do that.
 *
 * Never held as state. The ladder keeps an `Attempt` log and cuts a window out of
 * it with `windowFor` on every reading, which is what makes "the last forty
 * answers **at this rung**" a thing that can be asked for at all: a stored window
 * would have to have been told in advance which question it was the answer to.
 */
export type Recent = readonly boolean[]

/**
 * The window's accuracy, or `null` when there is nothing in it.
 *
 * Divided by how many answers there *are*, not by `RECENT_WINDOW`. A child four
 * answers into a session who has been right four times is at 100% and climbing;
 * padding the denominator to forty would read them as 10% and drive them to the
 * floor, and padding it with imaginary correct answers would let four lucky taps
 * read as 95% — which is the defect this whole rule exists to end.
 */
export function recentAccuracy(recent: Recent): number | null {
  if (recent.length === 0) return null
  let hits = 0
  for (const bit of recent) if (bit) hits += 1
  return hits / recent.length
}

/** The band, read off the window. See `PROMOTE_AT` for the table. */
export function bandOf(recent: Recent): Band {
  const accuracy = recentAccuracy(recent)
  if (accuracy === null) return "sit"
  if (accuracy >= PROMOTE_AT) return "climb"
  if (accuracy >= SIT_AT) return "sit"
  if (accuracy >= LOST_AT) return "slip"
  return "lost"
}

/**
 * ## One answer, and which rung of the ladder it came from
 *
 * A `Recent` is a row of booleans, which is all the mixture-reading gate ever
 * needed. It is not enough for the founder's next request:
 *
 * > "if they are getting ~95% level 1 and 70% level 2 ... we could concentrate on
 * > 2 with occasional level 1 and level 3"
 *
 * "95% at level 1 and 70% at level 2" is two numbers, and a row of booleans over a
 * mixed stream is one. So every answer now carries **the rung it was drawn from**,
 * and the accuracy the ladder acts on is read at a chosen rung rather than over
 * everything.
 *
 * **The rung and not the offset**, which is a distinction that cost a revision to
 * find. Recording each answer's offset from wherever the child was standing at the
 * time is the smaller change and it is wrong, because a window of "answers at
 * offset 0" pools answers taken at rungs that are nothing like each other: an
 * offset-0 window forty answers deep spans a hundred questions, and if the centre
 * moved during those hundred questions it is reading yesterday's rung as though it
 * were today's. Measured, with an offset-keyed window: a child who is 95% at rung
 * 20 overshot to 23, read the resulting misses as evidence about wherever they
 * currently stood, and was driven all the way to the floor and back in a cycle —
 * the settled centre came out at **11.5**, worse than the mixture-reading gate it
 * replaced. Keyed by rung, the same misses stay attached to rung 23, the reading
 * changes the moment the centre steps off it, and the fall stops after one rung.
 *
 * A record rather than a bare boolean is also where the guess floor goes when
 * issue 729 is picked up. A true/false pack is right half the time by tapping, so
 * its answers are not comparable with a free-entry pack's on the same axis; the
 * chance-corrected reading is `(p − g) / (1 − g)` for a floor `g`, and it has to be
 * applied per answer because the floor is a property of *how the item was
 * presented*, not of the child. That field is deliberately not added here — this
 * change does not fix 729 — but the shape that can carry it is.
 */
export type Attempt = {
  readonly correct: boolean
  /** The index on the ladder this question was drawn from. */
  readonly rung: number
}

/**
 * How many answers the ladder remembers, across every offset.
 *
 * Longer than `RECENT_WINDOW`, because `RECENT_WINDOW` is the width of a *reading*
 * and this is the pool a reading is taken from. The narrowest reading is the
 * centre's, and the centre carries 39.6% of the stream (see `ABOVE_RATIO`), so the
 * pool has to be about two and a half times the window for the centre's window to
 * fill at all: `RECENT_WINDOW / 0.396` = 101. Three windows is that, rounded to a
 * number a person can hold, and it leaves the reach's evidence — which by
 * construction arrives inside half the pool — sitting in the recent half of it.
 */
export const ATTEMPT_LOG = 3 * RECENT_WINDOW

/** `log` with one more answer on the end, and the oldest dropped if it is full. */
export function noteAttempt(
  log: readonly Attempt[],
  attempt: Attempt,
): readonly Attempt[] {
  const kept = log.length < ATTEMPT_LOG ? log : log.slice(log.length - ATTEMPT_LOG + 1)
  return [...kept, attempt]
}

/**
 * The most recent `limit` answers drawn at a rung the predicate accepts, oldest
 * first — a `Recent`, so every reading in this file goes through the same
 * `bandOf` and the same `recentAccuracy`.
 *
 * Walked from the newest end so that a thin rung yields *recent* answers rather
 * than however many happen to be in the pool. Nothing older than `ATTEMPT_LOG`
 * questions can be returned at any rung, which is the property a per-rung counter
 * could not have: a rung fed 5% of the stream would otherwise hold answers from
 * eight hundred questions ago and read as gospel.
 */
export function windowFor(
  log: readonly Attempt[],
  matches: (rung: number) => boolean,
  limit: number = RECENT_WINDOW,
): Recent {
  const bits: boolean[] = []
  for (let i = log.length - 1; i >= 0 && bits.length < limit; i--) {
    const attempt = log[i] as Attempt
    if (matches(attempt.rung)) bits.push(attempt.correct)
  }
  return bits.reverse()
}

/**
 * The fewest answers at one offset that can carry a decision about it.
 *
 * **Derived from the dead band.** In a window of `n`, one answer is worth `1/n` of
 * the accuracy. If that is wider than the gap between `SIT_AT` and `PROMOTE_AT`
 * then a single answer can carry a child across the whole dead band, and the
 * reading is not a reading — it is the last answer wearing a denominator. So
 * `n ≥ 1 / (PROMOTE_AT − SIT_AT)` = **10**.
 *
 * Rounded rather than ceilinged only because `0.95 − 0.85` in binary floats is
 * 0.09999999999999998 and `Math.ceil` of its reciprocal is 11. `items.test.ts`
 * re-derives the number from the two thresholds so an edit to either fails here.
 */
export const EVIDENCE_MIN = Math.round(1 / (PROMOTE_AT - SIT_AT))

/**
 * ## The founder's rule, read at the rung the child is standing on
 *
 * This is the change the whole file turns on. `bandOf` is unchanged and the three
 * thresholds are unchanged; what changed is **which answers they are read over**.
 *
 * **What was wrong.** The gate read the mixture — every answer, wherever it came
 * from. But the mixture deliberately contains content above the child, so a child
 * who is *perfect at their own rung* still measures well under 95% overall, and
 * the promotion gate is a gate they cannot open by being good at their level. Read
 * off the old kernel and the plausible-accuracy model on `ABOVE_RATIO`, the
 * mixture measures `0.469 + 0.457 × a` for a child whose own-rung accuracy is `a`,
 * so `sit` — the band where nothing moves — covered **own-rung accuracy from 83%
 * all the way to 100%**. A child who never once missed a question at their own
 * level sat there for ever. That is the founder's report, arithmetically:
 *
 * > "the interlude problems stay extremely easy for a long time"
 *
 * Simulated against the real service before this change, a child who is 95%
 * correct at rung 20 came to rest with their centre at **17.5** — two and a half
 * rungs below their own level, on content they get right 99% of the time.
 *
 * **What it is now.** The accuracy is read at offset 0: the answers drawn at the
 * rung the child is standing on. So the table on `PROMOTE_AT` means exactly what
 * the founder said it means — *at your level* you climb above 95%, sit at 85–95%,
 * and are in the wrong place under 75% — and the settled centre is the rung where
 * the child sits in that band, rather than two rungs under it.
 *
 * **A widening reach downward, until there is enough to read.** A gate that waited
 * for `EVIDENCE_MIN` answers at the centre rung before doing anything would be
 * shut for the first twenty-five questions of a sitting, and shut again for
 * twenty-five more every time the child moved — and a ladder that cannot move is a
 * failure this file has shipped before. So the reading starts at the centre alone
 * and, while it is thin, borrows from the rung below, then the one below that, out
 * to `SPREAD_BELOW` — the width of the mix itself, so it can never borrow from a
 * rung the child is not being served. Then anything at or below the centre at all.
 *
 * **It never borrows upward, at any tier.** An answer drawn above the centre
 * cannot enter the promotion reading and cannot push a child down. That is the
 * property that released `ABOVE_RATIO` from the deadlock argument, and it is the
 * property that keeps a `lost` reading attached to the rung that produced it: a
 * child who overshoots reads `lost` at the rung they overshot to, falls off it, and
 * the very next reading is the rung below's — which is why the fall stops after one
 * rung instead of running to the floor.
 *
 * The last resort is the whole log, which is the old mixture reading. It runs on
 * the first answers of a session, where it is the only evidence there is, and for a
 * pack that pins one `skillId` far above the child — where without it the ladder
 * would freeze on the grounds that nothing has ever been served at or below where
 * it stands.
 */
export function ladderBand(log: readonly Attempt[], centre: number): Band {
  for (let radius = 0; radius <= SPREAD_BELOW; radius++) {
    const near = windowFor(log, (rung) => rung <= centre && rung >= centre - radius)
    if (near.length >= EVIDENCE_MIN) return bandOf(near)
  }
  const standing = windowFor(log, (rung) => rung <= centre)
  if (standing.length > 0) return bandOf(standing)
  return bandOf(windowFor(log, () => true))
}


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
 * Where this question's blank sits, read off the same declaration for the same
 * reason — or `null` for a key the curriculum does not register.
 *
 * The second half of what `binaryOperator` started. A correct operator is not a
 * stated question: `dw.alg.equality.missing-factor` drawn as `15 × 165` has the right
 * glyph in it and asks for the product of two numbers when it wants the factor
 * between one of them and the other. `promotionBlockers.ts` named four templates of
 * that shape in `MISSTATED_QUESTION_TEMPLATES` and kept the whole `alg` domain draft
 * because of them; this is the field that lets the statement be written down.
 *
 * `null` and not `"none"` on an unknown key, the same discipline and for the same
 * reason: the failing direction is silent, and a blank drawn as though it were not
 * there marks a correct child wrong.
 */
export function blankPosition(promptKey: string): PromptBlank | null {
  return promptBlank(promptKey)
}

/**
 * The question as a child reads it, from the two operands and the declaration.
 *
 * Three statements and no fourth, because `PromptBlank` has three values and this
 * switch has no default — a fourth position added to the curriculum fails to compile
 * *here*, at the renderer that would have to draw it, rather than falling into
 * whichever branch happened to be last. That is not hypothetical in this file: see
 * `slotText`, where the `fraction` slot kind arrived exactly that way.
 *
 * `a` and `b` are the operands in the order the host reads them. On a blank statement
 * `a` is the number written beside the box and `b` is the result on the far side of
 * the equals sign, which is what makes `□ × 15 = 165` a missing factor and not a
 * multiplication: the 165 is *given*, and the child has to know that recovering 11
 * from it means dividing. `render/prompts.test.ts` substitutes the canonical answer
 * into the box and checks the equation is true in exact rationals, over every bound
 * level of every registered template, so a statement this function writes wrongly is
 * a failing build rather than a wrong card.
 *
 * Space-separated throughout, including around the `=`. Not cosmetic: `games/balance`
 * tokenises the statement on whitespace after inserting spaces around operator
 * glyphs, and its blank has to be a token of its own to be seen at all.
 */
export function drawStatement(a: string, b: string, glyph: string, blank: PromptBlank): string {
  switch (blank) {
    case "none":
      return `${a} ${glyph} ${b}`
    case "first":
      return `${BLANK} ${glyph} ${a} = ${b}`
    case "second":
      return `${a} ${glyph} ${BLANK} = ${b}`
  }
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
  /**
   * Which rung of the ladder this question was drawn from. Recorded here rather
   * than recomputed in `judge`, because by the time an answer arrives the ladder
   * has usually moved and the spread has usually been re-drawn: the rung a
   * question *was* drawn from is not the rung it *would be* drawn from now.
   */
  readonly rungIndex: number
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
     *
     * **A hint, not an instruction.** It is honoured within `HINT_BAND` rungs of
     * where the host's own band has the child and clamped there otherwise: a
     * game shapes the texture of a question, it does not decide what the child
     * is ready for. A pack that wants to know what it got reads the ordinate on
     * the item that comes back, which is the rung that was used and not the one
     * that was asked for.
     */
    difficulty?: number
    /**
     * A ceiling on the same scale. The stream never goes above it.
     *
     * Unlike `difficulty` this is absolute — it is a pack saying what it can
     * physically draw, and it binds below `HINT_BAND` as well as above it.
     */
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
   * The search for where the child is: stride, direction, and their own currency.
   *
   * Session-scoped, like `progress`, and for the same reason — it is a search,
   * and a search that opens mid-stride is a search that has evidence it does not
   * have. See the note on `STEP_START`.
   */
  let stair = openStaircase()
  /**
   * The last `ATTEMPT_LOG` answers and the offsets they were drawn at, which is
   * what decides the direction. See `ladderBand` for which of them a given
   * decision is read over, and `Attempt` for why an offset is carried at all.
   *
   * Session-scoped for the same reason as `progress` and `stair`: it is evidence
   * about a sitting, and a log carried across sittings would let a child who was
   * fluent last night be demoted for warming up this morning. See `PROMOTE_AT`.
   */
  let log: readonly Attempt[] = []
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
        A pack asked for a rung index and a half-climbed one is not one.

        This is the *host's* rung — what the last `RECENT_WINDOW` answers say —
        and while a pack is driving `difficulty` the rung it is served may sit up
        to `HINT_BAND` away from it. That is the one place the two numbers differ,
        and the item's own `difficulty` ordinate is what says where a question
        actually came from. */
    position: () => Math.floor(progress),

    next: ({ packId, skillId, difficulty, maxDifficulty }) => {
      // A pack may name a skill it covers. It is a request, not an instruction:
      // an unknown id falls back to the ladder rather than failing, because a
      // pack built against a later curriculum must still be playable.
      const wanted =
        skillId === undefined ? null : (rungs.find((rung) => rung.node.id === skillId) ?? null)

      // A difficulty is the same kind of request, one rung lower down — and it
      // is a request. It is honoured within `HINT_BAND` rungs of where the
      // host's own evidence stands and no further, which is what makes the
      // founder's 85/95 rule reach the seventeen packs that drive difficulty off
      // their own game state — every one of them except where a pack has also
      // declared a ceiling it cannot draw above. See `HINT_BAND` for why one
      // rung, and for the ceiling's way out of it.
      const span = Math.max(0, rungs.length - 1)
      // **The anchor**, read once and read here: the rung `judge` left the child
      // on, before a single thing the pack asked for has been looked at.
      //
      // Nothing below writes a pack's request into `progress`, and that is not
      // tidiness, it is the whole clamp. `progress` is moved by `judge` and by
      // the ceiling and by nothing else, so the next question's anchor is the
      // next question's *evidence*. Anchoring on the previous draw instead — on
      // this function's own clamped output — would make the band a ratchet a
      // pack could climb one rung per question, which is the bug wearing a
      // clamp as a hat.
      //
      // The banked fraction is safe by construction now rather than by
      // arithmetic: the rule this replaced kept `progress − Math.floor(progress)`
      // by hand, because rewriting the whole number would let a game that drives
      // difficulty every question quietly delete the credit a slow-and-correct
      // child had earned toward their next rung. Not writing at all keeps the
      // fraction *and* the rung.
      const anchor = Math.floor(progress)
      let index = anchor
      if (difficulty !== undefined) {
        // The request rounds to the nearest rung — a pack asking for 0.5 wants
        // the middle and not the rung below it — and is then pulled inside the
        // band. What comes back to the pack is the ordinate it *got*, so a
        // clamped request is visible on the pack's side.
        const asked = Math.round(difficulty * span)
        index = Math.max(anchor - HINT_BAND, Math.min(anchor + HINT_BAND, asked))
      }
      if (maxDifficulty !== undefined) {
        // The **ceiling floors** where the request rounds, and the two are
        // deliberately different: `maxDifficulty` is documented as "the stream
        // never goes above it", and rounding a cap can only round it up. A pack
        // that says 0.2 on a 59-rung ladder got 12/58 = 0.203 — over its own
        // ceiling, by a rung, silently. It passed for as long as it did because
        // 0.2 × 42 happened to round down; the ladder grew and it stopped
        // happening, which is the shape of every rounding bug this codebase has
        // met.
        //
        // It binds after the band and it wins, because it is not a pedagogy
        // request: it is a pack saying what it can physically draw, and PR 694
        // exists because polarity was handed a rung it could not render.
        const cap = Math.floor(maxDifficulty * span)
        index = Math.min(index, cap)
        // And a standing ceiling pins the ladder itself, exactly as it always
        // has: a position standing above content the pack can never test the
        // child on is a fiction. Downward only, and only when it bites — so it
        // cannot be the ratchet the note above is about — carrying the banked
        // fraction, which is what `progress − anchor` is.
        if (cap < anchor) progress = Math.max(0, cap) + (progress - anchor)
      }
      index = Math.max(0, Math.min(span, index))

      sequence += 1

      // The rung is drawn from a spread centred on the one the ladder is
      // standing on — see `rungWeights` for the shape and why it is not a point.
      // Seeded off (profile, pack, sequence) like everything else here, so the
      // same learner on two devices sees the same mix and not merely the same
      // centre; and re-clamped under `maxDifficulty` afterwards, because a
      // ceiling the spread could reach over is not a ceiling.
      //
      // **Only when the centre is the host's own.** A `difficulty` the pack
      // named is honoured as the point the SDK documents it to be — a point
      // inside `HINT_BAND` of the host's rung since issue 733, but still a
      // point — and the
      // reason is not caution, it is four shipped games: `counterweight` pins
      // `maxDifficulty` *equal* to its request, `polarity` and `balance` and
      // `horde` pin a ceiling to what they can physically draw, and PR 694 exists
      // because polarity was handed a rung it could not render. Smearing the
      // host's kernel over a request like that overrides a pack's own model with
      // no way for the pack to say no. What the child's *level* is, is the
      // host's business and gets the spread; what a game's dramaturgy wants for
      // the next chip is the game's, and it already varies on its own terms. A
      // pack opting into a spread around its own request is one SDK field and is
      // named here rather than guessed at.
      let drawn = index
      if (difficulty === undefined) {
        const spread = createRng(seedFrom(deps.profileId, packId, String(sequence), "rung"))
        drawn = pickRung(index, span, spread.nextUint32() / UINT32_RANGE)
        if (maxDifficulty !== undefined) {
          drawn = Math.min(drawn, Math.max(0, Math.floor(maxDifficulty * span)))
        }
      }

      const rung = wanted ?? rungAt(drawn)
      if (!rung) return null
      // Where the rung that was actually used sits, so the pack is told what it
      // got and not what it asked for. A pack comparing the two is how a
      // clamped request becomes visible on the pack's side.
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

      // And where the blank goes, from the same registry. `null` here can only mean
      // the entry has an operator and no blank position, which the type makes
      // impossible — so it is a corrupt registry rather than an unstated question,
      // and it is refused rather than defaulted to `"none"`. Defaulting is what
      // would draw `15 × 165` for a missing factor.
      const blank = blankPosition(exercise.prompt.key)
      if (blank === null) {
        console.error(
          `[packs] ${rung.node.id} (${rung.family.family}) emits ${exercise.prompt.key}, which ` +
            `declares the operator ${operator.glyph} and no blank position — the registry in ` +
            `render/prompts.ts is inconsistent and nothing is served rather than guessing that the ` +
            `question has no blank in it.`,
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
        // The rung that was actually used, whoever chose it — the spread, a
        // pack's clamped `difficulty`, or a pinned `skillId`. What the child was
        // asked is what the evidence is about, and there is no third party's
        // opinion in this number.
        rungIndex: used,
        answered: false,
      })
      practised.add(rung.node.id)

      const digits = digitsOf(exercise)

      // `form` and `operator` are the two fields a pack could use to rebuild the
      // question itself, and on a blank statement they would rebuild the wrong one.
      // `operands` on `□ × 15 = 165` are the two numerals a child reads, 15 and 165
      // — and 165 is the *product*, not the second factor, so reporting them as the
      // operands of a `×` is a false statement of exactly the class this change
      // exists to retire. So a blank statement reports `form: "value"` and **omits
      // `operator` entirely**: nothing implies an arithmetic relation between the two
      // numerals, and the whole question lives in `prompt`, which is the only field
      // `packs/shared/game-host` forwards anyway (`questionFrom`, index.ts:636-649,
      // drops `operands`, `operator`, `form`, `answerKind` and `digits`). A plain
      // `a OP b` is unchanged, bit for bit.
      const statement = drawStatement(top, bottom, operator.glyph, blank)

      return {
        id,
        skillId: rung.node.id,
        level: rung.level,
        difficulty: ordinate,
        form: blank === "none" ? "binary-op" : "value",
        ...(blank === "none" ? { operator: operator.protocol } : {}),
        operands: [top, bottom],
        prompt: statement,
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
        // The ladder moves on the last `RECENT_WINDOW` answers *at the rung the
        // child is standing on*, not on this one and not on the mixture.
        // `ladderBand` is the founder's rule — climb only while sustaining 95%,
        // sit at 85%, leave decisively under 75% — read where he meant it to be
        // read, and `PROMOTE_AT` carries the whole argument for why a single
        // answer is not evidence about a level.
        //
        // Up needs two things and down needs one: a climb needs both a correct
        // answer and a window that says this child is over the level, while a fall
        // needs only the window. So a miss inside a sustained window costs
        // nothing, and a correct answer inside a collapsing one does not rescue
        // it. How *far* is still the stride times what the answer was worth — see
        // `STEP_START` for why the stride opens wide and shrinks, and
        // `DESCENT_FAR` for the two descent weights.
        log = noteAttempt(log, { correct: verdict.correct, rung: served.rungIndex })
        const centre = Math.floor(progress)
        const band = ladderBand(log, centre)
        if (verdict.correct) {
          const gain = climbFor(served, latencyMs)
          if (band === "climb") {
            progress = progress + ascentOf(stair, gain)
            stair = advanceStaircase(stair, 1, gain)
          } else if (band === "sit") {
            stair = advanceStaircase(stair, 0, gain)
          } else {
            progress = progress - descentOf(stair, band)
            stair = advanceStaircase(stair, -1, gain)
          }
        } else {
          // A miss ends the run, however fast it was. Speed on a wrong answer
          // is not evidence of anything at all — it is what guessing looks
          // like — and the speedcuber's rate has to be earned again.
          quickRun = 0
          if (band === "climb" || band === "sit") {
            stair = advanceStaircase(stair, 0, null)
          } else {
            progress = progress - descentOf(stair, band)
            stair = advanceStaircase(stair, -1, null)
          }
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
