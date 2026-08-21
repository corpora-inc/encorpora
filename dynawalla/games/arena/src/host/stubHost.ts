import type { Host, Question } from "../contract.ts"
import { Rng } from "../core/rng.ts"

/**
 * A local, seeded, deterministic stub Host so ARENA is playable standalone.
 *
 * Rules it obeys, because the real host will:
 *  - Every answer and every comparison is exact integer arithmetic. No float
 *    ever reaches an answer string; `0.1 + 0.2 !== 0.3` must never be able to
 *    mark correct work wrong.
 *  - Distractors are *mal-rule outputs*: the number a child actually writes
 *    when they apply a plausible-but-wrong procedure. Never random noise —
 *    random noise teaches a child to spot the odd one out, not to compute.
 *  - Deterministic for a given seed, so a playtest is reproducible.
 */

type Gen = (r: Rng, d: number) => {
  prompt: string
  answer: number
  wrong: number[]
  /** For predicate prompts: is `v` a *wrong* answer? */
  valid?: (v: number) => boolean
}

/**
 * Deduplicate, drop the answer and any non-positive value, keep order.
 *
 * `valid` exists because the top-up path once handed back a *correct* option
 * as a distractor: "which is a multiple of 2" offered 10 as a wrong answer.
 * Any generator whose prompt is a predicate must supply that predicate here.
 */
function clean(answer: number, wrong: number[], r: Rng, valid?: (v: number) => boolean): string[] {
  const out: number[] = []
  for (const w of wrong) {
    if (w === answer) continue
    if (!Number.isInteger(w)) continue
    if (w < 0) continue
    if (out.includes(w)) continue
    if (valid && !valid(w)) continue
    out.push(w)
  }
  // Top up with near-miss values if a mal-rule collided with the answer.
  let step = 1
  while (out.length < 3) {
    const cand = r.chance(0.5) ? answer + step : answer - step
    if (cand > 0 && cand !== answer && !out.includes(cand) && (!valid || valid(cand))) out.push(cand)
    step++
    if (step > 400) break
  }
  return out.slice(0, 3).map((n) => String(n))
}

/** a × b — the mal-rules are off-by-one-multiple, add-instead-of-multiply, and a dropped carry. */
const mul: Gen = (r, d) => {
  const hi = d <= 2 ? 5 : d <= 4 ? 9 : d <= 6 ? 12 : 15
  const lo = d <= 2 ? 2 : 3
  const a = r.int(lo, hi)
  const b = r.int(lo, hi)
  const answer = a * b
  return {
    prompt: `${a} × ${b}`,
    answer,
    wrong: r.shuffle([
      a * (b - 1), // skipped a step counting up
      a * (b + 1), // one step too far
      a + b, // wrong operation
      answer - 10 * Math.floor(answer / 100), // dropped a carry into the tens
    ]),
  }
}

/** a + b, multi-digit — the mal-rule is the forgotten carry (add columns independently). */
const add: Gen = (r, d) => {
  const digits = d <= 2 ? 1 : d <= 5 ? 2 : 3
  const lo = digits === 1 ? 2 : digits === 2 ? 12 : 120
  const hi = digits === 1 ? 9 : digits === 2 ? 89 : 899
  const a = r.int(lo, hi)
  const b = r.int(lo, hi)
  const answer = a + b
  return {
    prompt: `${a} + ${b}`,
    answer,
    wrong: r.shuffle([noCarryAdd(a, b), answer + 10, answer - 10, answer + 1]),
  }
}

/** Column-wise addition with every carry dropped — the classic procedural bug. */
function noCarryAdd(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const s = ((x % 10) + (y % 10)) % 10
    out += s * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** a − b — the mal-rule is "smaller from larger" in each column (the borrow bug). */
const sub: Gen = (r, d) => {
  const digits = d <= 2 ? 1 : d <= 5 ? 2 : 3
  const hi = digits === 1 ? 9 : digits === 2 ? 95 : 950
  const a = r.int(digits === 1 ? 4 : digits === 2 ? 30 : 300, hi)
  const b = r.int(1, a - 1)
  const answer = a - b
  return {
    prompt: `${a} − ${b}`,
    answer,
    wrong: r.shuffle([smallerFromLarger(a, b), answer + 10, answer - 1, a + b]),
  }
}

/** Per column take |top − bottom| instead of borrowing. */
function smallerFromLarger(a: number, b: number): number {
  let out = 0
  let place = 1
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    const s = Math.abs((x % 10) - (y % 10))
    out += s * place
    place *= 10
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return out
}

/** a ÷ b, exact — built from the product so it is integer by construction. */
const div: Gen = (r, d) => {
  const hi = d <= 3 ? 6 : d <= 6 ? 10 : 12
  const b = r.int(2, hi)
  const answer = r.int(2, hi)
  const a = b * answer
  return {
    prompt: `${a} ÷ ${b}`,
    answer,
    wrong: r.shuffle([answer + 1, answer - 1, a - b, b]),
  }
}

/** "Which is a factor of N?" — the mal-rule is a near-miss that divides a neighbour of N. */
const factor: Gen = (r, d) => {
  const bases = d <= 3 ? [12, 16, 18, 20, 24] : d <= 6 ? [24, 30, 36, 40, 48] : [48, 60, 72, 84, 96]
  const n = r.pick(bases)
  const divisors: number[] = []
  for (let i = 2; i < n; i++) if (n % i === 0) divisors.push(i)
  const answer = r.pick(divisors.length ? divisors : [2])
  const nonDivisors: number[] = []
  for (let i = 2; i < n && nonDivisors.length < 12; i++) if (n % i !== 0) nonDivisors.push(i)
  return {
    prompt: `factor of ${n}`,
    answer,
    wrong: r.shuffle(nonDivisors).slice(0, 4),
    valid: (v) => v > 1 && n % v !== 0,
  }
}

/** "Which is a multiple of k?" — reads directly as the skip-counting ladder. */
const multiple: Gen = (r, d) => {
  const k = d <= 3 ? r.int(2, 5) : d <= 6 ? r.int(3, 9) : r.int(4, 12)
  const m = r.int(3, d <= 3 ? 9 : 14)
  const answer = k * m
  return {
    prompt: `multiple of ${k}`,
    answer,
    wrong: r.shuffle([answer + 1, answer - 1, answer + (k - 1), answer - (k - 1)]).filter((v) => v % k !== 0),
    valid: (v) => v > 0 && v % k !== 0,
  }
}

/** N less than a bound — pure magnitude, the arena's own rule stated as a question. */
const compare: Gen = (r, d) => {
  const mag = d <= 3 ? 100 : d <= 6 ? 1000 : 10000
  const bound = r.int(Math.floor(mag / 3), mag)
  const answer = r.int(2, bound - 1)
  return {
    prompt: `less than ${bound}`,
    answer,
    wrong: r.shuffle([bound + r.int(1, 9), bound + r.int(10, 99), bound + r.int(100, 400)]),
    valid: (v) => v >= bound,
  }
}

const GENS: { g: Gen; domain: string; minD: number }[] = [
  { g: compare, domain: "compare", minD: 1 },
  { g: add, domain: "add", minD: 1 },
  { g: mul, domain: "multiply", minD: 1 },
  { g: sub, domain: "subtract", minD: 2 },
  { g: multiple, domain: "multiples", minD: 2 },
  { g: div, domain: "divide", minD: 3 },
  { g: factor, domain: "factors", minD: 3 },
]

export type StubHostOptions = {
  seed?: number
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = new Rng(opts.seed ?? 0x5eed1e)
  let n = 0
  const reduced =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null

  return {
    next(o) {
      const d = Math.max(1, Math.min(10, Math.round(o?.difficulty ?? 3)))
      const pool = GENS.filter((x) => x.minD <= d && (!o?.domain || x.domain === o.domain))
      const chosen = pool.length ? rng.pick(pool) : (GENS[0] as (typeof GENS)[number])
      const { prompt, answer, wrong, valid } = chosen.g(rng, d)
      const q: Question = {
        id: `stub-${++n}`,
        prompt,
        answer: String(answer),
        distractors: clean(answer, wrong, rng, valid),
        domain: chosen.domain,
        difficulty: d,
      }
      return q
    },
    report(r) {
      // The stub keeps no mastery model — the real host will. It forwards so a
      // harness can watch the answer stream.
      opts.onReport?.(r)
    },
    haptic(k) {
      // navigator.vibrate is absent on iOS Safari and on desktop — a silent no-op there.
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
      if (typeof nav.vibrate !== "function") return
      const pattern =
        k === "light" ? 8 : k === "medium" ? 18 : k === "heavy" ? 34 : k === "success" ? [10, 30, 16] : [30, 40, 30]
      try {
        nav.vibrate(pattern)
      } catch {
        console.warn("[arena] haptic failed")
      }
    },
    prefersReducedMotion() {
      return reduced?.matches ?? false
    },
  }
}
