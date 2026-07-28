// A local stub Host so the bout is playable standalone with `npm run dev`.
//
// It serves what the real runtime serves and nothing else. Only the `add`
// domain is active in the curriculum graph, every one of its seven live rows is
// a whole-number column operation, and `covers` is a request rather than an
// instruction — so a stub that dealt fractions or long division would be a
// rehearsal for a match that never happens. Column add and column subtract, at
// two to four digits, is the truth.
//
// Three properties the real runtime also honours, asserted by
// `src/test/stubHost.test.ts`:
//
//   1. **Exact arithmetic.** Every operand, answer and distractor is an
//      integer. No float ever reaches an answer string or a comparison.
//   2. **Seeded and deterministic.** Same seed → same question stream, forever.
//   3. **Distractors are real mal-rule outputs.** Each one is the value a child
//      running a specific broken procedure actually writes down. The three
//      procedures are ported from `packs/shared/curriculum/src/malrules/
//      columnOp.ts` — `mis.add.carry-dropped`, `mis.add.smaller-from-larger`
//      and `mis.add.borrow-across-zero` — including their `applies()` guards, so
//      a rule that would coincide with the correct procedure emits nothing at
//      all. Never `answer + 1`, and never a fixed offset off the answer.
//
// That matters more here than in a quiz game: in THE GRAPPLE FOUNDRY a
// distractor is a *false finish*. Land the bar on one and the crowd comes up
// and the referee waves it off. A value nobody would ever produce would make
// that beat fire at random, and the beat is the diagnosis.

import type { Host, Question } from "./contract.ts"
import { Rng } from "./core/rng.ts"

type Op = "add" | "sub"

/** Digits of `n`, least significant first. `0` is one digit. */
function digitsOf(n: number): number[] {
  if (n === 0) return [0]
  const out: number[] = []
  let m = n
  while (m > 0) {
    out.push(m % 10)
    m = Math.floor(m / 10)
  }
  return out
}

function fromDigits(ds: readonly number[]): number {
  let out = 0
  for (let i = ds.length - 1; i >= 0; i--) out = out * 10 + (ds[i] as number)
  return out
}

/**
 * The three mal-rules the `add` domain actually declares, ported from
 * `packs/shared/curriculum/src/malrules/columnOp.ts` and matching it column for
 * column.
 *
 * Two rules are carried over from that file along with the procedures:
 *
 *   1. **Run the buggy procedure, never a shortcut off the answer.**
 *      `mis.add.borrow-across-zero` happens to come out as the correct answer
 *      plus the thousand that was borrowed and never given up — but that is a
 *      consequence of the procedure, not its definition, and a stub that
 *      encoded the shortcut would stop matching the moment a borrow chain had a
 *      different shape.
 *   2. **A rule that does not *apply* emits nothing.** With no column to
 *      regroup, taking the smaller digit from the larger *is* the correct
 *      procedure, so the rule is undefined there rather than wrong. Each
 *      function below returns `null` in exactly the cases the curriculum's
 *      `applies()` returns false.
 *
 * The reference case, from that file's own docblock:
 *
 *     5001 − 2798.  Correct 2203.
 *     3797 is smaller-from-larger — |5−2| |0−7| |0−9| |1−8|.
 *     3203 is borrow-across-zero — the zeros written as 9s and the thousand
 *          never taken off the leading digit.
 */

/** Columns the pair occupies. */
function colsOf(a: number, b: number): number {
  return Math.max(digitsOf(a).length, digitsOf(b).length)
}

/**
 * `mis.add.carry-dropped` — every column added, no carry ever recorded or added
 * into the next one. 27 + 15 → 32.
 *
 * Undefined when nothing carries: then it is the correct procedure.
 */
export function carryDropped(a: number, b: number): number | null {
  const da = digitsOf(a)
  const db = digitsOf(b)
  const n = colsOf(a, b)
  const out: number[] = []
  let carried = false
  for (let i = 0; i < n; i++) {
    const sum = (da[i] ?? 0) + (db[i] ?? 0)
    if (sum > 9) carried = true
    out.push(sum % 10)
  }
  return carried ? fromDigits(out) : null
}

/**
 * `mis.add.smaller-from-larger` — in every column the smaller digit is taken
 * from the larger, whichever is on top, and nothing is regrouped.
 * 52 − 27 → 35.
 *
 * Undefined when no column would have needed regrouping.
 */
export function smallerFromLarger(a: number, b: number): number | null {
  const da = digitsOf(a)
  const db = digitsOf(b)
  const n = colsOf(a, b)
  let needed = false
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const top = da[i] ?? 0
    const bot = db[i] ?? 0
    if (bot > top) needed = true
    out.push(Math.abs(top - bot))
  }
  return needed ? fromDigits(out) : null
}

/**
 * `mis.add.borrow-across-zero` — regrouped all the way down through a run of
 * zeros, writing them as 9s, and never decrementing the digit above the run.
 * 403 − 87 → 416, not 316.
 *
 * Undefined unless the borrow chain actually crossed a zero: with a non-zero
 * digit to borrow from, this procedure decrements it correctly and is the
 * correct procedure.
 */
export function borrowAcrossZero(a: number, b: number): number | null {
  const da = digitsOf(a)
  const db = digitsOf(b)
  const n = colsOf(a, b)
  const work = da.slice()
  while (work.length < n) work.push(0)
  const out: number[] = []
  let crossedZero = false
  for (let i = 0; i < n; i++) {
    let top = work[i] as number
    const bot = db[i] ?? 0
    if (top < bot) {
      let j = i + 1
      while (j < n && (work[j] as number) === 0) {
        work[j] = 9
        j++
      }
      if (j >= n) return null
      // The bug, and only here: a run of zeros became 9s and the digit above it
      // was left alone. With no run, the decrement happens and this is correct.
      if (j > i + 1) crossedZero = true
      else work[j] = (work[j] as number) - 1
      top += 10
    }
    out.push(top - bot)
  }
  return crossedZero ? fromDigits(out) : null
}

/**
 * The wrong operation entirely — the one error below that is *not* one of the
 * graph's three, and is named as such rather than dressed up as one. A child who
 * reads `+` as `−` is not running a broken column procedure; they are answering a
 * different question, and the value is worth putting on the mat all the same.
 */
export function wrongOperation(op: Op, a: number, b: number): number {
  return op === "add" ? Math.abs(a - b) : a + b
}

function malRulesFor(op: Op, a: number, b: number): number[] {
  const rules =
    op === "add"
      ? [carryDropped(a, b), wrongOperation(op, a, b)]
      : [smallerFromLarger(a, b), borrowAcrossZero(a, b), wrongOperation(op, a, b)]
  return rules.filter((v): v is number => v !== null)
}

/**
 * Operands, drawn to the shape of the seven active `dw.add` rows.
 *
 * `level` is 0..7 and matches what the host's ladder walks: two digits without
 * regrouping at the bottom, four digits with regrouping across a zero at the
 * top. The stub is the ladder, not a random-number generator with a difficulty
 * knob taped to it.
 */
function operandsFor(op: Op, level: number, rng: Rng): [number, number] {
  const lv = Math.max(0, Math.min(7, Math.round(level)))
  const digits = lv <= 1 ? 2 : lv <= 4 ? 3 : 4
  const lo = 10 ** (digits - 1)
  const hi = 10 ** digits - 1

  if (op === "add") {
    if (lv <= 1) {
      // No regrouping: build it column by column so no column can carry.
      const da: number[] = []
      const db: number[] = []
      for (let i = 0; i < digits; i++) {
        const x = rng.int(i === digits - 1 ? 1 : 0, 8)
        const y = rng.int(i === digits - 1 ? 1 : 0, 9 - x)
        da.push(x)
        db.push(y)
      }
      return [fromDigits(da), fromDigits(db)]
    }
    // Short addend at the top of the ladder — `4,003 + 87` is its own row.
    if (lv >= 6) return [rng.int(lo, hi), rng.int(10, 99)]
    return [rng.int(lo, hi), rng.int(lo, hi)]
  }

  if (lv <= 1) {
    // No regrouping: every top digit is at least the bottom one, and the ones
    // column is strictly greater so the difference is never zero — the graph
    // sets `allowZeroResult: false` and a target of nothing is not a fall.
    const da: number[] = []
    const db: number[] = []
    for (let i = 0; i < digits; i++) {
      const top = rng.int(i === digits - 1 ? 2 : 1, 9)
      const lowest = i === digits - 1 ? 1 : 0
      da.push(top)
      db.push(rng.int(lowest, i === 0 ? top - 1 : top))
    }
    return [fromDigits(da), fromDigits(db)]
  }
  if (lv >= 6) {
    // Across a zero: plant one so `borrowAcrossZero` has something to be wrong
    // about, which is what makes that distractor worth showing.
    const ds = [rng.int(0, 9), 0, rng.int(1, 9), rng.int(1, 9)].slice(0, digits)
    const a = Math.max(fromDigits(ds), 100)
    return [a, rng.int(10, Math.max(11, Math.min(99, a - 1)))]
  }
  const a = rng.int(lo + 10, hi)
  return [a, rng.int(lo, a - 1)]
}

const GLYPH: Record<Op, string> = { add: "+", sub: "−" }

/** The ladder's height, matching the host's `item.level / 8` normalisation. */
const LEVELS = 8

export type StubHostOptions = {
  seed?: number
  reducedMotion?: boolean
  /** Pin the ladder level instead of walking it. For tests and for capture runs. */
  level?: number
  /** Observe reports — the dev harness draws a running accuracy readout from this. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  /** Observe haptics so the harness can show they fired on a device that has none. */
  onHaptic?: (k: string) => void
}

export function createStubHost(options: StubHostOptions = {}): Host {
  const rng = new Rng(options.seed ?? 0x6f057d)
  let served = 0

  return {
    next(o) {
      served++
      // A slow walk up the ladder, so a dev session sees two-digit sums first
      // and four-digit borrows twenty falls later — the shape of a real
      // scheduler, without pretending to be one.
      const level =
        options.level !== undefined
          ? Math.max(0, Math.min(LEVELS - 1, Math.round(options.level)))
          : Math.min(LEVELS - 1, Math.floor((served - 1) / 6))
      const op: Op = rng.chance(0.5) ? "add" : "sub"
      const [a, b] = operandsFor(op, level, rng)
      const answer = op === "add" ? a + b : a - b

      const seen = new Set<number>([answer])
      const pool: number[] = []
      for (const v of malRulesFor(op, a, b)) {
        if (!Number.isInteger(v) || v < 1 || seen.has(v)) continue
        seen.add(v)
        pool.push(v)
      }
      rng.shuffle(pool)

      return {
        id: `stub-${served}`,
        prompt: `${a} ${GLYPH[op]} ${b}`,
        answer: String(answer),
        distractors: pool.slice(0, 3).map(String),
        domain: o?.domain ?? "add",
        // Normalised the way the pack host normalises it: `item.level / 8`.
        difficulty: level / LEVELS,
      } satisfies Question
    },

    report(r) {
      options.onReport?.(r)
    },

    haptic(k) {
      options.onHaptic?.(k)
      const nav = globalThis.navigator as Navigator | undefined
      if (!nav || typeof nav.vibrate !== "function") return
      const ms =
        k === "light" ? 8 : k === "medium" ? 18 : k === "heavy" ? 34 : k === "success" ? 12 : 40
      try {
        if (k === "success") nav.vibrate([ms, 26, ms])
        else if (k === "failure") nav.vibrate([ms, 40, ms])
        else nav.vibrate(ms)
      } catch {
        // A browser that exposes vibrate but refuses it (no user gesture yet, or
        // a policy block) must never take the frame down with it.
        console.warn("[foundry] navigator.vibrate refused")
      }
    },

    prefersReducedMotion() {
      if (options.reducedMotion !== undefined) return options.reducedMotion
      return (
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
      )
    },
  }
}
