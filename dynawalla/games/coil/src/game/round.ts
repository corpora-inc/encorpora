// Reading a served question as a cut.
//
// The host serves column arithmetic — `72 − 25`, `47 + 25` — and this file is
// the whole of how that becomes a physical act. There is one rule, and a child
// is told it once:
//
//   > **Shear off the glowing number. The machine does the rest.**
//
// The glowing number is always the second operand, `b`. What the machine does
// with the severed piece is what the operator says:
//
//   * `a − b`  the coil **is** `a`. The piece you shear off is carried away,
//              and what crawls on is the answer. You never subtracted; you
//              regrouped and took, and `a − b` came out.
//   * `a + b`  the coil is stock. The piece you shear off is **welded** onto an
//              ingot of `a` sitting in the wall, and the ingot's new value is
//              the answer. Welding twelve ones onto seven is a carry, and the
//              carry is drawn happening.
//
// In both, the cut is correct exactly when the severed value equals `b`, and in
// both, the number reported to the host is a physical fact about the coil the
// child left behind. There is no keypad and nothing to guess: a wrong cut
// produces a wrong number that is *the number that cut is worth*.
//
// **Everything here is integer.** An item whose answer is not a non-negative
// whole number is refused rather than approximated, and `mount.ts` asks the
// host for another.

import type { Question } from "../contract.ts"

export type Mode = "take" | "fill"

export type Round = {
  readonly questionId: string
  /** As carved on the wall. */
  readonly prompt: string
  readonly mode: Mode
  /** The coil that arrives, as a whole number. */
  readonly coil: number
  /** The value that must be severed — the glowing operand. */
  readonly demand: number
  /** What is already in the wall's cradle. `0` in `take` mode. */
  readonly ingot: number
  /** The canonical answer, exactly as the host spelled it. */
  readonly answerText: string
  /** The canonical answer as an integer. */
  readonly answer: number
}

/** U+2212 MINUS, U+2013 EN DASH and the ASCII hyphen all read as subtraction. */
const OPERATORS = /^\s*(\d+)\s*([+−–-])\s*(\d+)\s*$/

/**
 * The stock coil, when the item does not hand us one.
 *
 * Ninety-six of something: the smallest `96 × 10^k` that can cover the demand.
 * Ninety-six because the coil is named for it, and because `96` is nine tens
 * and six ones — a coil whose head is deep in tens and whose tail is only six
 * ones long, so almost every demand costs at least one break. A stock of `100`
 * would be a single link, and a single link is not a coil.
 */
export function stockFor(demand: number): number {
  let stock = 96
  while (stock < demand && stock <= 96_000_000_000) stock *= 10
  return stock
}

/** A decimal integer string, or `null`. Never `parseFloat`, never rounded. */
function integerOf(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) ? value : null
}

/**
 * Build the round a question describes, or `null` when the item cannot be cut.
 *
 * The fallback is deliberate and total: an item whose prompt this cannot parse
 * — a different family, a different renderer, a template that has not been
 * written yet — still plays, as a `fill` with an empty cradle, where the
 * demand simply *is* the answer. The game therefore has no way to be handed a
 * question it cannot present, which is the only safe posture for a pack whose
 * `covers` is a request rather than an instruction.
 */
export function roundFrom(q: Question): Round | null {
  const answer = integerOf(q.answer)
  if (answer === null) return null

  const parsed = OPERATORS.exec(q.prompt)
  if (parsed) {
    const [, left, operator, right] = parsed
    const a = integerOf(left ?? "")
    const b = integerOf(right ?? "")
    const subtract = operator !== "+"
    if (a !== null && b !== null && b >= 1) {
      if (subtract && a - b === answer && b <= a) {
        return {
          questionId: q.id,
          prompt: q.prompt,
          mode: "take",
          coil: a,
          demand: b,
          ingot: 0,
          answerText: q.answer.trim(),
          answer,
        }
      }
      if (!subtract && a + b === answer) {
        return {
          questionId: q.id,
          prompt: q.prompt,
          mode: "fill",
          coil: stockFor(b),
          demand: b,
          ingot: a,
          answerText: q.answer.trim(),
          answer,
        }
      }
    }
  }

  if (answer < 1) return null
  return {
    questionId: q.id,
    prompt: q.prompt.trim() === "" ? q.answer.trim() : q.prompt,
    mode: "fill",
    coil: stockFor(answer),
    demand: answer,
    ingot: 0,
    answerText: q.answer.trim(),
    answer,
  }
}

/**
 * What the child is claiming, given the piece they sheared off.
 *
 * The number the host is told. It is never the game's opinion of whether the
 * cut was right — it is what the machine is left holding.
 */
export function claimOf(round: Round, severed: number): number {
  return round.mode === "take" ? round.coil - severed : round.ingot + severed
}

/** The game's own belief, for its own feedback. The host is the judge. */
export function isExact(round: Round, severed: number): boolean {
  return severed === round.demand
}
