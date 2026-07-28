// A local stub Host so the game is playable standalone with `npm run dev`.
//
// It imitates the one thing the real host actually serves this pack: column
// addition and subtraction, in the shape `dynawalla-app/src/packs/items.ts`
// emits it — `top − bottom` with a U+2212 MINUS, an integer answer, and a
// closed list of wrong answers. The six rungs below are the shapes the seven
// active `dw.add.*` rows declare, from a two-digit sum with nothing to regroup
// up to a six-digit minuend with zeros to borrow across.
//
// Three properties the runtime also honours, asserted by `stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs** — what a child running a
//      specific broken procedure actually writes down, not `answer + 1` noise.
//      This game can *produce* several of them physically: shearing two tens
//      and two ones when the demand was twenty-five is the smaller-from-larger
//      bug, performed rather than typed.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

/** U+2212. A hyphen is not a minus sign, and at 40px a child can tell. */
const MINUS = "−"

/** Column addition with every carry dropped: 27 + 15 → 32. */
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

/** The smaller-from-larger bug: 52 − 27 → 35, taking |2−7| in the ones column. */
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
 * Borrowing across a zero and leaving a ten where a nine belongs.
 *
 * `403 − 87 → 326`, where the answer is `316`. The child borrows correctly all
 * the way to the hundreds, but the zero the ten passed through is written as a
 * ten rather than a nine — because "I took ten from the hundreds and put it
 * here" is exactly what they did, and giving one of it away again to the ones
 * column is the step that gets dropped.
 *
 * Returns `-1` when the item gives the bug nothing to fire on — there is no
 * zero to borrow across — or when the buggy procedure does not land on a
 * numeral, which is what the curriculum means by a mal-rule that does not
 * apply.
 */
export function borrowSkippingZero(a: number, b: number): number {
  const digits = String(a)
    .split("")
    .map((d) => Number(d))
  const sub = String(b)
    .padStart(digits.length, "0")
    .split("")
    .map((d) => Number(d))
  if (sub.length !== digits.length) return -1
  let fired = false
  for (let i = digits.length - 1; i >= 0; i--) {
    const top = digits[i] as number
    const bottom = sub[i] as number
    if (top >= bottom) {
      digits[i] = top - bottom
      continue
    }
    let j = i - 1
    let adjacent = true
    while (j >= 0 && digits[j] === 0) {
      // The bug is here, and only on the first zero: it becomes a ten.
      digits[j] = adjacent ? 10 : 9
      if (adjacent) fired = true
      adjacent = false
      j--
    }
    if (j < 0) return -1
    digits[j] = (digits[j] as number) - 1
    digits[i] = top + 10 - bottom
  }
  if (!fired) return -1
  for (const d of digits) if (d < 0 || d > 9) return -1
  return Number(digits.join(""))
}

function malRules(op: "add" | "sub", a: number, b: number, answer: number): number[] {
  if (op === "add") {
    return [
      addNoCarry(a, b),
      answer - 10, // carried and never added the carry in
      answer + 10, // carried twice
      a - b, // reached for the wrong operation
      answer - 100,
    ]
  }
  return [
    subSmallerFromLarger(a, b),
    borrowSkippingZero(a, b),
    answer + 10, // borrowed without decrementing the next column
    answer - 10, // decremented twice
    a + b, // wrong operation
  ]
}

/** Minuend / sum ceilings and second-operand ceilings, rung by rung. */
const ADD_A = [49, 89, 499, 899, 4999, 8999] as const
const ADD_B = [30, 89, 99, 899, 99, 999] as const
const SUB_A = [59, 99, 599, 999, 9999, 400_999] as const
const SUB_B = [29, 89, 99, 899, 99, 999] as const

function operands(op: "add" | "sub", rung: number, rng: Rng): [number, number] {
  const d = Math.max(0, Math.min(5, Math.round(rung)))
  if (op === "add") {
    const a = rng.int(10, ADD_A[d] as number)
    const b = rng.int(2, ADD_B[d] as number)
    return [a, b]
  }
  const a = rng.int(20, SUB_A[d] as number)
  const b = rng.int(2, Math.min(SUB_B[d] as number, Math.max(2, a - 1)))
  return [a, b]
}

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Pin the rung 0..5 instead of letting the stub walk up its own ladder. */
  rung?: number
  /** Observe reports — the dev harness draws a running accuracy readout. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness shows them on a device with no motor. */
  onHaptic?: (k: string) => void
}

/** Questions served on one rung before the stub's own ladder steps up. */
const RUNG_LENGTH = 5

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x0c011960)
  let n = 0

  return {
    next() {
      // The real host's `difficulty` is a level *within* a skill, not a rung, so
      // the stub walks its own ladder: five questions per rung, six rungs, then
      // it stays at the top. Deterministic, and it shows the whole range of
      // coil shapes inside a minute of `npm run dev`.
      const rung = opts.rung ?? Math.min(5, Math.floor(n / RUNG_LENGTH))
      const op: "add" | "sub" = rng.chance(0.5) ? "add" : "sub"
      const [a, b] = operands(op, rung, rng)
      const answer = op === "add" ? a + b : a - b

      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRules(op, a, b, answer)) {
        if (!Number.isSafeInteger(v) || v < 0 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      n++
      return {
        id: `stub-${String(n)}`,
        prompt: `${String(a)} ${op === "add" ? "+" : MINUS} ${String(b)}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain: op,
        difficulty: rung / 5,
      } satisfies Question
    },

    report(r) {
      opts.onReport?.(r)
    },

    haptic(k) {
      opts.onHaptic?.(k)
      const nav = globalThis.navigator as Navigator | undefined
      if (!nav || typeof nav.vibrate !== "function") return
      const ms =
        k === "light" ? 8 : k === "medium" ? 18 : k === "heavy" ? 34 : k === "success" ? 12 : 40
      try {
        if (k === "success") nav.vibrate([ms, 26, ms])
        else if (k === "failure") nav.vibrate([ms, 40, ms])
        else nav.vibrate(ms)
      } catch {
        // A browser that exposes vibrate but refuses it (no user gesture yet,
        // or a policy block) must never take the frame down with it.
        console.warn("[coil] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },
  }
}
