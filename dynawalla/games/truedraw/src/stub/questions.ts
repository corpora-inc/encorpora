// The stub question source: whole-number column arithmetic, drawn exactly.
//
// Three properties, all asserted by `questions.test.ts`:
//
//   1. **Exact integer arithmetic.** Every operand, answer and distractor is an
//      integer. There is not a float anywhere in this file — not in an operand,
//      not in an answer, not in a comparison.
//   2. **Seeded and deterministic.** Same seed, same stream, forever.
//   3. **Distractors are mal-rule outputs.** Each one is what a child running a
//      specific broken procedure actually writes down. `answer + 1` is noise a
//      child rejects by feel; `47 + 25 = 62` is a claim they have to do the work
//      to reject, and doing the work is the entire point of this game.
//
// This mirrors what the real curriculum serves — `columnOp` emits exactly these
// diagnoses — so the dev harness and the device are playing the same game.

import { Rng } from "../core/rng.ts"

export type Op = "add" | "sub"

export type Drawn = {
  op: Op
  a: number
  b: number
  answer: number
  /** Mal-rule outputs, most diagnostic first. */
  distractors: number[]
}

/** Column addition with every carry dropped: 47 + 25 → 62. */
export function addNoCarry(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    out += (((x % 10) + (y % 10)) % 10) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** Take the smaller digit from the larger in every column: 52 − 27 → 35. */
export function subSmallerFromLarger(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    out += Math.abs((x % 10) - (y % 10)) * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/**
 * Borrowing *through* a zero and leaving it at ten.
 *
 * `503 − 87`: the ones need a borrow, the tens are zero, so the child reaches
 * past to the hundreds — correctly — and then reads the tens column as ten
 * rather than as the nine it became when it passed the borrow along. Ones
 * `13 − 7 = 6`, tens `10 − 8 = 2`, hundreds `4`. Written down: `426`, against a
 * true `416`.
 *
 * Returns `-1` when this procedure cannot run on these operands or produces a
 * column that is not a digit; the caller drops it.
 */
export function borrowAcrossZero(a: number, b: number): number {
  const top = digits(a)
  const bottom = digits(b)
  const out: number[] = []
  for (let i = 0; i < top.length; i++) {
    let t = top[i] ?? 0
    const bo = bottom[i] ?? 0
    if (t < bo) {
      let j = i + 1
      while (j < top.length && (top[j] ?? 0) === 0) j++
      if (j >= top.length) return -1
      top[j] = (top[j] ?? 0) - 1
      // The bug, and the only line that differs from the correct algorithm: a
      // zero the borrow travelled through should become nine.
      for (let k = i + 1; k < j; k++) top[k] = 10
      t += 10
    }
    const digit = t - bo
    if (digit < 0 || digit > 9) return -1
    out.push(digit)
  }
  return fromDigits(out)
}

/** Digit-reversal — a transcription slip, not a procedure: 63 → 36. */
export function reverseDigits(n: number): number {
  let out = 0
  let m = n
  while (m > 0) {
    out = out * 10 + (m % 10)
    m = Math.floor(m / 10)
  }
  return out
}

function digits(n: number): number[] {
  const out: number[] = []
  let m = n
  if (m === 0) return [0]
  while (m > 0) {
    out.push(m % 10)
    m = Math.floor(m / 10)
  }
  return out
}

function fromDigits(ds: readonly number[]): number {
  let out = 0
  for (let i = ds.length - 1; i >= 0; i--) out = out * 10 + (ds[i] ?? 0)
  return out
}

/**
 * Draw a problem at `level` 0..7, which stretches the operand width the way the
 * real ladder does: two digits at the bottom, four at the top, regrouping from
 * level two on.
 */
export function drawProblem(level: number, rng: Rng): Drawn {
  const clamped = Math.max(0, Math.min(7, Math.round(level)))
  const width = clamped < 2 ? 2 : clamped < 5 ? 3 : 4
  const lo = width === 2 ? 12 : width === 3 ? 102 : 1002
  const hi = width === 2 ? 98 : width === 3 ? 989 : 9899
  const op: Op = rng.chance(0.5) ? "add" : "sub"

  if (op === "add") {
    const a = rng.int(lo, hi)
    const b = rng.int(lo, hi)
    const answer = a + b
    return {
      op,
      a,
      b,
      answer,
      distractors: dedupe(answer, [
        addNoCarry(a, b),
        answer - 10,
        answer + 10,
        Math.abs(a - b),
        reverseDigits(answer),
      ]),
    }
  }

  // Keep the difference positive: this is whole-number subtraction and a
  // negative answer is a different skill entirely.
  const a = rng.int(lo + 10, hi)
  const b = rng.int(lo, a - 1)
  const answer = a - b
  return {
    op,
    a,
    b,
    answer,
    distractors: dedupe(answer, [
      subSmallerFromLarger(a, b),
      borrowAcrossZero(a, b),
      answer + 10,
      answer - 10,
      reverseDigits(answer),
    ]),
  }
}

/** Positive integers, distinct, and never the answer. */
function dedupe(answer: number, candidates: readonly number[]): number[] {
  const seen = new Set<number>([answer])
  const out: number[] = []
  for (const value of candidates) {
    if (!Number.isInteger(value) || value < 0 || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

export const GLYPH: Record<Op, string> = { add: "+", sub: "−" }
