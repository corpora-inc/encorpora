// A local stub Host so the observatory is playable standalone with `npm run
// dev`. It stands in for the runtime; it is not the runtime.
//
// Three properties the real host also honours, each asserted by
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison — a
//      station is a pair of digits and a digit cannot be 0.30000000000000004.
//   2. **Seeded and deterministic.** Same seed → same watch, forever.
//   3. **Distractors are real mal-rule outputs** — what a child with a specific
//      broken procedure actually writes down, not `answer ± 1` noise. In this
//      game a mal-rule is mechanically load-bearing: a mark that lands on one
//      costs no sighting, because the register recognises the mistake.
//
// The operations are addition and subtraction of whole numbers in columns,
// because those are the seven rows of the `add` domain that are `active`. The
// stub does not pretend to be a curriculum; it draws from the same shapes.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Op = "add" | "sub"

/** Column addition with every carry dropped: 27 + 15 → 32. */
function addNoCarry(a: number, b: number): number {
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

/**
 * The short addend written flush left instead of flush right: `247 + 8` set
 * down as `247 + 800`. The misconception `dw.add.regroup.add-short-addend`
 * exists to catch exactly this, so it belongs in the pool whenever the two
 * operands are of different lengths.
 */
function misalignShortAddend(a: number, b: number): number {
  const la = String(a).length
  const lb = String(b).length
  if (la === lb) return a + b
  const [long, short, gap] = la > lb ? [a, b, la - lb] : [b, a, lb - la]
  return long + short * 10 ** gap
}

/** The smaller-from-larger bug: 52 − 27 → 35, taking |2 − 7| in the ones column. */
function subSmallerFromLarger(a: number, b: number): number {
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

/** Borrowed across a zero without decrementing the column past it: 300 − 8 → 302. */
function borrowAcrossZero(a: number, b: number): number {
  const digits = String(a).split("").map(Number)
  const from = String(b).split("").map(Number)
  let out = 0
  let place = 1
  for (let i = 0; i < digits.length; i++) {
    const da = digits[digits.length - 1 - i] ?? 0
    const db = from[from.length - 1 - i] ?? 0
    // Takes the ten but never pays for it, so the column above is untouched.
    const d = da >= db ? da - db : da + 10 - db
    out += d * place
    place *= 10
  }
  return out
}

function malRulesFor(op: Op, a: number, b: number, answer: number): number[] {
  return op === "add"
    ? [
        addNoCarry(a, b), // MIS_CARRY_DROPPED
        misalignShortAddend(a, b), // the short addend set down flush left
        answer - 10, // carried and never added the carry in
        answer + 10, // carried twice
        Math.abs(a - b), // reached for the wrong operation
      ]
    : [
        subSmallerFromLarger(a, b), // MIS_SMALLER_FROM_LARGER
        borrowAcrossZero(a, b), // MIS_BORROW_ACROSS_ZERO
        answer + 10, // borrowed without decrementing the next column
        answer - 10, // decremented twice
        a + b, // wrong operation
      ]
}

/**
 * Operands shaped like the `add` domain's level tables: two, three and four
 * digit column work, regrouping arriving with difficulty.
 */
function operandsFor(op: Op, difficulty: number, rng: Rng): [number, number] {
  // `difficulty` is the host's 0..1 reading of the ladder. Four bands, so the
  // stub walks the same 2 → 4 digit progression the real level tables do.
  const band = Math.max(0, Math.min(3, Math.floor(difficulty * 4)))
  const lo = [10, 10, 100, 1000][band] as number
  const hi = [99, 99, 999, 9999][band] as number
  if (op === "add") {
    const a = rng.int(lo, hi)
    const b = band === 0 ? rng.int(2, 9) : rng.int(lo, hi)
    return [a, b]
  }
  const a = rng.int(lo + 1, hi)
  const b = band === 0 ? rng.int(2, 9) : rng.int(lo, a - 1)
  return [a, b]
}

const GLYPH: Record<Op, string> = { add: "+", sub: "−" }

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Observe reports — the dev harness draws a running accuracy readout from this. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness can show they fired on a device that has none. */
  onHaptic?: (k: string) => void
  /** Observe stopping points, which a real host may put a sheet on. */
  onTransition?: (kind: string, label?: string) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x5c91ed)
  let n = 0

  return {
    next(o) {
      const difficulty = Math.max(0, Math.min(1, o?.difficulty ?? 0.35))
      const op: Op = rng.chance(0.5) ? "add" : "sub"
      const [a, b] = operandsFor(op, difficulty, rng)
      const answer = op === "add" ? a + b : a - b

      // Mal-rule outputs, deduped, filtered to values this sky can hold: a
      // whole number of at most six digits that is not the answer itself.
      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(op, a, b, answer)) {
        if (!Number.isInteger(v) || v < 0 || v > 999999 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      n++
      return {
        id: `stub-${n}`,
        prompt: `${a} ${GLYPH[op]} ${b}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain: "add",
        difficulty,
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
        console.warn("[skyledger] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (opts.reducedMotion !== undefined) return opts.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },

    transition(kind, label) {
      opts.onTransition?.(kind, label)
    },
  }
}
