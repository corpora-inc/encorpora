// Turning a question into a claim.
//
// The host serves `{ prompt: "47 + 25", answer: "72", distractors: [...] }`.
// This game never asks that question. It makes a *statement* out of it —
// `47 + 25 = 72` or `47 + 25 = 62` — and asks the only question a GO/NO-GO task
// can ask: is that so?
//
// Two things make this rigorous rather than a coin toss.
//
//  1. **The falsehood is a mal-rule output.** `answer ± 1` is noise: a child
//     rejects it by feel, without doing the arithmetic. `62` is what a child who
//     drops the carry in `47 + 25` actually writes, so rejecting it *is* the
//     work. The host puts its mal-rule values at the front of `distractors` and
//     its place-value near-misses behind them, and the weighting below prefers
//     the front.
//
//  2. **A false statement is never accidentally true.** Every candidate is
//     compared to the answer with exact decimal-string arithmetic before it is
//     allowed onto the slate. Nothing here parses a numeral into a `number`.
//
// The mapping is domain-blind on purpose. It reads `prompt`, `answer` and
// `distractors` and nothing else, so the day `mul`, `frac` or `alg` are promoted
// out of draft this game covers them with no change: a claim is a claim.

import { comprehensionMsFor, p50MsFor } from "./cadence.ts"
import { canonicalNumeral, sameValue } from "../core/exact.ts"
import type { Rng } from "../core/rng.ts"
import type { Question } from "../contract.ts"

export type Statement = {
  /** The served item this claim was built from. `""` when the pool ran dry. */
  questionId: string
  /** "47 + 25" */
  expression: string
  /** The value the slate claims. */
  claimed: string
  /** The value the curriculum says is right. */
  answer: string
  /** Whether the claim on the slate is true. */
  truth: boolean
  /** "47 + 25 = 62" */
  text: string
  /** How long the window stays open once the statement is cut in, in ms. */
  windowMs: number
  /** How long the empty slate stands before the statement is cut into it, in ms. */
  stillMs: number
  /**
   * The item's own p50 from `cadence.ts`. Not a limit and never shown: it is what
   * "quick" is measured against, by the bag and by the ladder, and it is carried
   * on the statement so those two can never disagree about which beat they mean.
   */
  p50Ms: number
}

/**
 * The draw window, and the stillness before it.
 *
 * Both are a function of the item and of nothing else. In particular **neither
 * depends on how long the run has been going**: `EXPERIENCE_DESIGN.md` bans
 * escalation on run length, and a reaction game that quietly tightens its window
 * every round is exactly that ban's target. A long run in this game is not
 * faster. It is only longer.
 *
 * ── the window is the child's time ──────────────────────────────────────────
 *
 * The window is `cadence.ts`'s p90 for the item's own class, and nothing here is
 * allowed to clamp it. It used to be `max(1750, min(3600, 1300 + 215d))`, and
 * that upper clamp inverted the ramp: measured against the repo's own cadence
 * table it handed a single-digit fact more than its whole p50 and the
 * `5,001 − 2,798` class under a third of one, so the harder the item, the less
 * of the child's measured need it received. `windowMonotone` in the tests is now
 * the standing guard on that.
 *
 * The old comment justified the clamp with "verification is cheaper than
 * computation — the ones column alone rejects most mal-rules". **That claim is
 * false**, and `malRule.test.ts` is the proof. Every mal-rule this game
 * *prefers* — the dropped carry, the smaller-from-larger subtraction, the borrow
 * left at ten — reproduces the true ones digit exactly, by construction: they
 * are correct in the ones column and wrong further left. `47 + 25 = 62` and the
 * true `72` share their last digit. A child who checks only the ones column
 * accepts every one of them. Verification here costs what computation costs, so
 * it is budgeted at what computation costs.
 *
 * The stillness, meanwhile, still *flattens*: it is the lead-in, not the
 * thinking, and a lead-in long enough for a four-digit sum is dead air on
 * `12 + 5 = 17`. The thinking happens with the slate lit, where the child can
 * end it the moment they are ready by drawing.
 */
export function windowFor(text: string): number {
  return comprehensionMsFor(text)
}

/**
 * The beat before the statement is cut in — and the slate is BLANK for all of it.
 *
 * It used to scale with the digit count, 620–1150 ms, because the statement was
 * legible during it: the slate came up already engraved and unlit, and the light
 * was the go signal of a GO/NO-GO task. That structure is gone, and it took two
 * things with it.
 *
 *   1. **The free thinking time.** A child could read `47 + 25 = 62` for a whole
 *      second before the window opened, then answer in 40 ms. Every latency this
 *      game measures would have that second silently subtracted out of it, and the
 *      ladder would read a deliberate child as a lightning-fast one. With two
 *      gestures the reaction time is the signal that drives the difficulty, so a
 *      lead-in the child can think during is a lead-in that corrupts it. The
 *      statement now appears when the window opens, and `p50Ms` is measured from
 *      there.
 *
 *   2. **The dead air.** Up to 1.15 s per round of a slate you may not answer,
 *      scaled UP by how hard the sum is, on a game whose complaint was that it was
 *      boring. It is now a flat ~320 ms: enough for the eye to land on the slate,
 *      not enough to read anything, and not a function of the item at all.
 *
 * The jitter stays. A fixed lead would let a child pre-load the flick and stop
 * reading, and pre-loading is the one way left to fake a fast call.
 */
export function stillFor(_text: string, rng: Rng): number {
  return Math.round(320 + rng.range(-70, 90))
}

/**
 * Every distractor that is a legal, genuinely-wrong claim, in the host's own
 * order, deduplicated by value rather than by spelling.
 */
export function falsehoodsFor(question: Question): string[] {
  const canonicalAnswer = canonicalNumeral(question.answer)
  // If the answer itself is not a numeral we cannot prove any claim wrong, and
  // an unprovable claim must never be presented as false. This is the one
  // failure mode that matters more than any other: a child asked to reject a
  // true sentence learns that the game lies, and the game has no way to tell
  // them otherwise. Nothing here guesses.
  if (canonicalAnswer === null) return []

  const seen = new Set<string>([canonicalAnswer])
  const out: string[] = []
  for (const candidate of question.distractors) {
    const canonical = canonicalNumeral(candidate)
    // Not a numeral, or the answer wearing a different coat. Either way it
    // cannot go on a slate under "this is false".
    if (canonical === null || seen.has(canonical)) continue
    if (sameValue(candidate, question.answer)) continue
    seen.add(canonical)
    out.push(candidate)
  }
  return out
}

/**
 * Build the claim. `wantTruth` is what the balancer asked for; the returned
 * statement's `truth` is what was actually possible, and the caller reconciles
 * the two — an item with no usable distractor can only ever be told truthfully.
 */
export function buildStatement(question: Question, wantTruth: boolean, rng: Rng): Statement {
  const expression = question.prompt
  let claimed = question.answer
  let truth = true

  if (!wantTruth) {
    const falsehoods = falsehoodsFor(question)
    const picked = pickFalsehood(falsehoods, rng)
    if (picked !== null) {
      claimed = picked
      truth = false
    }
  }

  const text = `${expression} = ${claimed}`
  return {
    questionId: question.id,
    expression,
    claimed,
    answer: question.answer,
    truth,
    text,
    windowMs: windowFor(text),
    stillMs: stillFor(text, rng),
    p50Ms: p50MsFor(text),
  }
}

/**
 * Weighted towards the head of the list, which is where the host puts the
 * values a real broken procedure produces. The tail is place-value padding and
 * is worth showing sometimes — a child who learns that the slate only ever lies
 * in one way has learned the pack, not the arithmetic.
 */
function pickFalsehood(falsehoods: readonly string[], rng: Rng): string | null {
  const head = falsehoods[0]
  if (head === undefined) return null
  if (falsehoods.length === 1) return head
  if (rng.chance(0.55)) return head
  return rng.pick(falsehoods.slice(1))
}
