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

import { canonicalNumeral, digitCount, sameValue } from "../core/exact.ts"
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
  /** How long the draw window stays open once the slate lights, in ms. */
  windowMs: number
  /** How long the street stays still before the slate lights, in ms. */
  stillMs: number
}

/**
 * The draw window, and the stillness before it.
 *
 * Both are a function of how much numeral there is to verify and of nothing
 * else. In particular **neither depends on how long the run has been going**:
 * `EXPERIENCE_DESIGN.md` bans escalation on run length, and a reaction game that
 * quietly tightens its window every round is exactly that ban's target. A long
 * run in this game is not faster. It is only longer.
 *
 * The two slopes pull in opposite directions on purpose. The window climbs
 * steeply — `753 + 577 = 1330` needs real time, and `EXPERIENCE_DESIGN.md`'s own
 * cadence table puts multi-digit regrouping at a 6 s p50 — while the stillness
 * *flattens*, because a lead-in long enough for a four-digit sum is dead air on
 * `12 + 5 = 17`. Short statements come at you faster; long ones give more room.
 * Verification is cheaper than computation (the ones column alone rejects most
 * mal-rules), which is why the budget can be under the cadence target at all.
 */
export function windowFor(text: string): number {
  const d = digitCount(text)
  return Math.max(1750, Math.min(3600, 1300 + 215 * d))
}

export function stillFor(text: string, rng: Rng): number {
  const d = digitCount(text)
  const base = Math.max(620, Math.min(1150, 420 + 80 * d))
  // A fixed lead would let a child pre-load the press and stop reading. The
  // jitter is small enough to stay a beat and large enough to defeat that.
  return Math.round(base + rng.range(-140, 180))
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
