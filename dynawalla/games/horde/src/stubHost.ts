/**
 * A local, standalone Host so `npm run dev` is playable with no runtime
 * underneath. The real Dynawalla host replaces this wholesale.
 *
 * Rules this file obeys, and that the real host also obeys:
 *  - **Exact integer arithmetic only.** No float appears in an answer or in a
 *    comparison. `0.1 + 0.2 !== 0.3` would mark correct work wrong, forever,
 *    deterministically.
 *  - **Seeded and deterministic.** Same seed, same stream of questions.
 *  - **Distractors are mal-rule outputs** — what a child who applied a real,
 *    nameable wrong procedure would actually write down. A distractor that is
 *    `answer + 1` teaches nothing and is trivially eliminated.
 */
import type { Host, Question } from "./contract.ts"

/* ------------------------------------------------------------------ rng -- */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------- mal-rule helpers */

/** Column-wise add with every carry dropped: 47 + 38 → 715 becomes 75. */
function noCarryAdd(a: number, b: number): number {
  let out = 0
  let place = 1
  while (a > 0 || b > 0) {
    const d = ((a % 10) + (b % 10)) % 10
    out += d * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return out
}

/** "Take the smaller from the larger" in every column: 52 − 27 → 35. */
function smallerFromLarger(a: number, b: number): number {
  let out = 0
  let place = 1
  while (a > 0 || b > 0) {
    const x = a % 10
    const y = b % 10
    out += Math.abs(x - y) * place
    a = Math.floor(a / 10)
    b = Math.floor(b / 10)
    place *= 10
  }
  return out
}

/** Borrowed once and then forgot to decrement the next column. */
function forgotBorrow(a: number, b: number): number {
  const ones = a % 10
  const bOnes = b % 10
  if (ones >= bOnes) return a - b + 10
  return a - b + 10
}

/* --------------------------------------------------------------- shaping */

type Gen = (rng: () => number, d: number) => { prompt: string; answer: number; wrong: number[] }

const clampD = (d: number) => Math.max(1, Math.min(10, Math.round(d)))
const pick = (rng: () => number, n: number) => Math.floor(rng() * n)
const between = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))

const genAdd: Gen = (rng, d) => {
  const hi = [9, 12, 20, 40, 70, 99, 160, 300, 600, 999][clampD(d) - 1]
  const lo = d <= 2 ? 1 : Math.max(2, Math.floor(hi / 8))
  const a = between(rng, lo, hi)
  const b = between(rng, lo, hi)
  const ans = a + b
  return {
    prompt: `${a} + ${b}`,
    answer: ans,
    wrong: [noCarryAdd(a, b), ans - 10, ans + 10, ans - 1, a + b + (b % 10 === 0 ? 100 : 9)],
  }
}

const genSub: Gen = (rng, d) => {
  const hi = [9, 14, 25, 45, 80, 99, 180, 350, 650, 999][clampD(d) - 1]
  let a = between(rng, Math.max(2, Math.floor(hi / 3)), hi)
  let b = between(rng, 1, a)
  if (a < b) [a, b] = [b, a]
  const ans = a - b
  return {
    prompt: `${a} − ${b}`,
    answer: ans,
    wrong: [smallerFromLarger(a, b), forgotBorrow(a, b), a + b, ans + 10, ans - 10],
  }
}

const genMul: Gen = (rng, d) => {
  const table = [5, 6, 8, 9, 10, 12, 12, 12, 15, 20][clampD(d) - 1]
  const big = d >= 6 ? between(rng, 11, 20 + d * 6) : between(rng, 2, table)
  const a = d >= 6 ? big : between(rng, 2, table)
  const b = between(rng, 2, Math.min(12, table))
  const ans = a * b
  return {
    prompt: `${a} × ${b}`,
    answer: ans,
    // off-by-one-multiple is the classic skip-counting slip; a+b is the
    // operator confusion; a*(b) with a dropped partial-product carry is the
    // long-multiplication error.
    wrong: [a * (b - 1), a * (b + 1), a + b, ans - 10, noCarryAdd(a * (b - 1), a)],
  }
}

const genDiv: Gen = (rng, d) => {
  const bMax = [4, 5, 6, 8, 9, 10, 11, 12, 12, 12][clampD(d) - 1]
  const qMax = [5, 6, 8, 9, 10, 12, 14, 16, 20, 25][clampD(d) - 1]
  const b = between(rng, 2, bMax)
  const q = between(rng, 2, qMax)
  const a = b * q
  return {
    prompt: `${a} ÷ ${b}`,
    answer: q,
    wrong: [q + 1, q - 1, a - b, b, Math.floor(a / (b + 1))],
  }
}

/** Signed work — the polarity that a horde survivor's shield/damage maths needs. */
const genSigned: Gen = (rng, d) => {
  const hi = [6, 9, 12, 18, 25, 40, 60, 90, 140, 200][clampD(d) - 1]
  const a = between(rng, 1, hi)
  const b = between(rng, 1, hi)
  const neg = pick(rng, 2) === 0
  if (neg) {
    const ans = a - b
    return {
      prompt: `${a} + (−${b})`,
      answer: ans,
      // The sign-drop is *the* signed-arithmetic mal-rule.
      wrong: [a + b, b - a, -(a + b), ans + 10, ans - 1],
    }
  }
  const ans = -a - b
  return {
    prompt: `(−${a}) + (−${b})`,
    answer: ans,
    wrong: [a + b, b - a, a - b, ans + 10, ans + 1],
  }
}

const DOMAINS: Record<string, Gen> = {
  add: genAdd,
  sub: genSub,
  mul: genMul,
  div: genDiv,
  signed: genSigned,
}

/** Which domains are live at a given difficulty — the run's own ramp. */
function domainsFor(d: number): string[] {
  if (d <= 2) return ["add", "sub"]
  if (d <= 4) return ["add", "sub", "mul"]
  if (d <= 6) return ["add", "sub", "mul", "div"]
  return ["add", "sub", "mul", "div", "signed"]
}

/* ------------------------------------------------------------------ host */

export type StubHostOptions = {
  seed?: number
  /** Called on every `report`, so the standalone shell can show accuracy. */
  onReport?: (r: { questionId: string; correct: boolean; ms: number; answered: string }) => void
  haptic?: (k: "light" | "medium" | "heavy" | "success" | "failure") => void
}

export function createStubHost(opts: StubHostOptions = {}): Host {
  const rng = mulberry32(opts.seed ?? 0x5eed1e)
  let n = 0

  return {
    next(o): Question {
      const difficulty = clampD(o?.difficulty ?? 3)
      const pool = domainsFor(difficulty)
      const domain = o?.domain && DOMAINS[o.domain] ? o.domain : pool[pick(rng, pool.length)]
      const gen = DOMAINS[domain]

      let g = gen(rng, difficulty)
      // Reject degenerate items: an answer a child can read off the prompt.
      for (let guard = 0; guard < 8; guard++) {
        if (Math.abs(g.answer) > 1 && !g.prompt.startsWith(`${g.answer} `)) break
        g = gen(rng, difficulty)
      }

      // Three distinct, plausible, non-answer distractors.
      const seen = new Set<number>([g.answer])
      const distractors: string[] = []
      for (const w of g.wrong) {
        if (distractors.length === 3) break
        if (!Number.isInteger(w)) continue
        if (seen.has(w)) continue
        if (domain !== "signed" && w < 0) continue
        seen.add(w)
        distractors.push(String(w))
      }
      // Deterministic backfill, still never a float.
      let pad = 1
      while (distractors.length < 3) {
        const w = g.answer + pad * (pad % 2 === 0 ? 1 : -1) * 2
        pad++
        if (seen.has(w) || (domain !== "signed" && w < 0)) continue
        seen.add(w)
        distractors.push(String(w))
      }

      n++
      return {
        id: `stub-${n}`,
        prompt: g.prompt,
        answer: String(g.answer),
        distractors,
        domain,
        difficulty,
      }
    },

    report(r) {
      opts.onReport?.(r)
    },

    haptic(k) {
      opts.haptic?.(k)
      // Best-effort on Android Chrome; a silent no-op everywhere else.
      const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
      if (typeof nav.vibrate !== "function") return
      const pattern: Record<string, number | number[]> = {
        light: 8,
        medium: 18,
        heavy: 32,
        success: [12, 28, 22],
        failure: [26, 40, 26],
      }
      try {
        nav.vibrate(pattern[k] ?? 10)
      } catch {
        /* a device that refuses to buzz is not an error */
      }
    },

    prefersReducedMotion() {
      return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches
    },
  }
}
