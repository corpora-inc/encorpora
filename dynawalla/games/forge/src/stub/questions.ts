// A seeded, exact question generator. This is the STUB — `dynawalla/curriculum`
// replaces it wholesale. It exists so the game is fully playable today, and its
// only contract obligation is to return well-formed `Question`s.
//
// Distractors are real mal-rule outputs, not noise: the wrong answers are the
// ones a child actually produces. "52 - 27 = 35" is the column-wise
// bigger-minus-smaller bug; "7 x 8 = 15" is the add-instead-of-multiply slip;
// "10^4 x 10^3 = 10^12" is exponent-multiplication. A distractor a player would
// never write teaches nothing when they avoid it.

import type { Question } from "../contract.ts"
import type { Rng } from "../core/rng.ts"

type Gen = (rng: Rng, level: number) => { prompt: string; answer: number; wrong: number[]; domain: string }

const MINUS = "−" // U+2212, not a hyphen — a minus sign is a minus sign
const TIMES = "×"
const DIVIDE = "÷"

function span(level: number, lo: number, hi: number): number {
  return Math.round(lo + (hi - lo) * Math.max(0, Math.min(1, level)))
}

const addition: Gen = (rng, level) => {
  const top = span(level, 9, 90)
  const a = rng.int(2, top)
  const b = rng.int(2, top)
  const answer = a + b
  return {
    prompt: `${a} + ${b}`,
    answer,
    // off-by-one; forgot the carry (units digit only); subtracted instead
    wrong: [answer + 1, answer - 10, Math.abs(a - b), answer - 1],
    domain: "add-sub",
  }
}

const subtraction: Gen = (rng, level) => {
  const top = span(level, 10, 99)
  const a = rng.int(6, top)
  const b = rng.int(2, Math.max(2, a - 1))
  const answer = a - b
  // The column bug: take |digit difference| in each column independently.
  const colBug =
    Math.abs(Math.floor(a / 10) - Math.floor(b / 10)) * 10 + Math.abs((a % 10) - (b % 10))
  return {
    prompt: `${a} ${MINUS} ${b}`,
    answer,
    wrong: [colBug, answer + 1, a + b, answer - 1],
    domain: "add-sub",
  }
}

const times: Gen = (rng, level) => {
  const top = span(level, 6, 12)
  const a = rng.int(2, top)
  const b = rng.int(2, 12)
  const answer = a * b
  return {
    prompt: `${a} ${TIMES} ${b}`,
    answer,
    // neighbour in the table (both directions); added instead of multiplied
    wrong: [answer + a, answer - b, a + b, answer + b],
    domain: "mul-div",
  }
}

const division: Gen = (rng, level) => {
  const top = span(level, 6, 12)
  const b = rng.int(2, top)
  const answer = rng.int(2, 12)
  const a = answer * b
  return {
    prompt: `${a} ${DIVIDE} ${b}`,
    answer,
    // wrong times-table fact; divided by a neighbour; off-by-one quotient
    wrong: [
      answer + 1,
      Math.max(1, Math.floor(a / (b + 1))),
      answer - 1,
      Math.max(1, Math.ceil(a / Math.max(1, b - 1))),
    ],
    domain: "mul-div",
  }
}

const missing: Gen = (rng, level) => {
  const top = span(level, 8, 12)
  const a = rng.int(2, top)
  const answer = rng.int(2, 12)
  const c = a * answer
  return {
    prompt: `${a} ${TIMES} □ = ${c}`,
    answer,
    wrong: [c - a, answer + 1, c, answer - 1],
    domain: "algebra-ready",
  }
}

const doubling: Gen = (rng, level) => {
  const base = rng.int(3, span(level, 8, 40))
  const n = rng.int(2, span(level, 3, 5))
  const answer = base * 2 ** n
  return {
    prompt: `${base} ${TIMES} 2${sup(n)}`,
    answer,
    // multiplied by 2n instead of 2^n; one doubling short; one doubling long
    wrong: [base * 2 * n, base * 2 ** (n - 1), base * 2 ** (n + 1), answer + base],
    domain: "powers",
  }
}

const magnitude: Gen = (rng, level) => {
  const p = rng.int(1, span(level, 3, 6))
  const q = rng.int(1, span(level, 2, 5))
  const answer = p + q
  return {
    prompt: `10${sup(p)} ${TIMES} 10${sup(q)} = 10${sup0()}`,
    answer,
    // multiplied the exponents; off by one; used only the larger
    wrong: [p * q, answer + 1, Math.max(p, q), answer - 1],
    domain: "orders-of-magnitude",
  }
}

const scaling: Gen = (rng, level) => {
  const mult = rng.pick([10, 100, 1000] as const)
  const a = rng.int(2, span(level, 9, 40))
  const answer = a * mult
  return {
    prompt: `${a} ${TIMES} ${mult}`,
    answer,
    // one zero short, one zero long, added the zeros as digits
    wrong: [Math.floor(answer / 10), answer * 10, a + mult, answer - mult],
    domain: "orders-of-magnitude",
  }
}

const SUPS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"]
function sup(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUPS[c.charCodeAt(0) - 48])
    .join("")
}
function sup0(): string {
  return "□" // an empty box in the exponent slot: "10^□"
}

/** Weighted by difficulty. Early game is counting; late game is exponents. */
function pool(level: number): Gen[] {
  const g: Gen[] = [addition, subtraction, times, times]
  if (level > 0.15) g.push(division, subtraction)
  if (level > 0.3) g.push(missing, scaling)
  if (level > 0.5) g.push(doubling, magnitude, scaling)
  if (level > 0.7) g.push(magnitude, doubling, missing)
  return g
}

let counter = 0

export function generate(rng: Rng, level: number): Question {
  const gen = rng.pick(pool(level))
  const r = gen(rng, level)

  const seen = new Set<number>([r.answer])
  const distractors: string[] = []
  // A mal-rule is only useful as a distractor when its output is CLOSE. "144 ÷
  // 12" has a real multiply-instead-of-divide bug whose output is 1728, and a
  // 1728 sitting next to 11, 12, 13 is not a distractor, it is a free pass.
  // Anything more than an order of magnitude away is dropped and backfilled.
  const plausible = (w: number): boolean =>
    w <= r.answer * 10 + 30 && w >= r.answer / 10 - 30
  for (const w of r.wrong) {
    if (w < 0 || !Number.isInteger(w) || seen.has(w) || !plausible(w)) continue
    seen.add(w)
    distractors.push(String(w))
    if (distractors.length === 3) break
  }
  // Backfill if the mal-rules collided. Near misses, never random noise.
  let d = 1
  while (distractors.length < 3) {
    for (const cand of [r.answer + d, r.answer - d]) {
      if (cand >= 0 && !seen.has(cand) && distractors.length < 3) {
        seen.add(cand)
        distractors.push(String(cand))
      }
    }
    d++
  }

  counter++
  return {
    id: `stub-${counter}`,
    prompt: r.prompt,
    answer: String(r.answer),
    distractors,
    domain: r.domain,
    difficulty: Math.max(0, Math.min(1, level)),
  }
}

/**
 * What one correct strike is worth in heat.
 *
 * The answer IS the payout — `12 x 11` pays 132 and `4 + 5` pays 9 — so a
 * player starts noticing which questions are worth more, which is the first
 * time most children voluntarily compare two arithmetic expressions. Large
 * answers (the exponent domains) are compressed so a lucky `10^7` cannot
 * outrank a minute of honest work.
 */
export function payoutFor(answer: string): number {
  const n = Number(answer)
  if (!Number.isFinite(n)) return 8
  const v = Math.abs(Math.trunc(n))
  if (v <= 200) return Math.max(3, v)
  return 60 + 14 * String(v).length
}
