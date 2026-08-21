// The CORE wave: where the curriculum enters the lattice.
//
// An ordinary automaton carries a number and the child judges divisibility. A
// CORE carries a **problem** — `47 + 38`, drawn from the host — and when it
// fractures at the midline it throws out one automaton per candidate value.
// Killing one submits it.
//
// That is the whole integration, and the reason it is not a quiz bolted onto a
// shooter: to submit a value the child must do the column arithmetic *and* find
// a beam that divides the result. The divisibility rule is not decoration
// around the answer, it is the lock on the trigger — you cannot hand in a
// number you cannot factor.
//
// Nothing in this module compares a response to an answer. It labels which
// candidate is canonical from the value the host revealed, and the game reports
// what was struck.

import { beamDivisors, resonates, tuneLattice, usableCoreValue } from "./lattice.ts"
import { comprehensionWindow } from "./window.ts"

export type Candidate = { value: number; correct: boolean }

export type CoreWave = {
  questionId: string
  prompt: string
  /** The canonical value, as revealed by the host. Never computed here. */
  answer: number
  /** Beam labels, ascending. Tuned so every candidate below is killable. */
  beams: number[]
  candidates: Candidate[]
  /**
   * How long the candidates are answerable for, in seconds.
   *
   * Carried on the wave rather than read off the pressure curve at fracture
   * time, because it belongs to the ITEM: this is the number that must never
   * fall when the question gets harder, and it is computed by
   * `sim/window.ts` from the prompt and the answer alone.
   */
  windowSeconds: number
}

/**
 * Mal-rule outputs for column arithmetic, used only to top a thin candidate set
 * back up to something worth choosing between.
 *
 * Every one is a procedure a child actually runs: the carry written and never
 * added in, the carry added twice, the same slip a column to the left, and the
 * transcription reversal. None of them is `answer + 1`.
 */
export function columnMalRules(answer: number): number[] {
  return [answer - 10, answer + 10, answer - 100, answer + 100, reverseDigits(answer)]
}

/** 63 → 36. A real transcription slip, not noise. */
export function reverseDigits(n: number): number {
  let out = 0
  let m = n
  while (m > 0) {
    out = out * 10 + (m % 10)
    m = Math.floor(m / 10)
  }
  return out
}

function parseValue(s: string): number | null {
  if (!/^\d{1,4}$/.test(s.trim())) return null
  const n = Number(s.trim())
  return Number.isInteger(n) && n >= 2 ? n : null
}

/** Fewer than this and the choice is not a choice. */
export const MIN_CANDIDATES = 2
export const MAX_CANDIDATES = 4

export type CoreSource = {
  id: string
  prompt: string
  answer: string
  distractors: string[]
}

/**
 * Turn a served item into a wave, or return `null` if it cannot be one.
 *
 * `null` is not a failure to paper over: an answer with no divisor in the beam
 * range (a prime, or 169) genuinely cannot be killed on a lattice a child can
 * read, and presenting it would be presenting an unanswerable question. The
 * caller draws the next item instead. A dropped item is never reported.
 */
export function buildCore(
  source: CoreSource,
  beamCount: number,
  rand: () => number,
  /**
   * The most candidates this wave may carry, from `sim/opening.ts`.
   *
   * Clamped into `MIN_CANDIDATES..MAX_CANDIDATES` here rather than trusted: two
   * is a choice and one is a formality, and a caller that asked for one would
   * silently turn the question into "hit the only thing on the screen".
   */
  cap: number = MAX_CANDIDATES,
): CoreWave | null {
  const most = Math.max(MIN_CANDIDATES, Math.min(MAX_CANDIDATES, Math.floor(cap)))
  const answer = parseValue(source.answer)
  if (answer === null || !usableCoreValue(answer)) return null

  const seen = new Set<number>([answer])
  const values: number[] = [answer]
  for (const raw of source.distractors) {
    if (values.length >= most) break
    const v = parseValue(raw)
    // A distractor is held to the same standard as the answer. A small prime —
    // 5, 7, 11 — can only be killed from its own beam, and a beam labelled 5
    // sitting under a hull carrying 5 is glyph matching, not division. Such a
    // distractor is dropped rather than allowed to corrupt the lattice.
    if (v === null || seen.has(v) || !usableCoreValue(v)) continue
    seen.add(v)
    values.push(v)
  }

  // The lattice is tuned to the values that exist so far. The answer is first
  // in the list, so it gets the first forced beam and is always killable.
  let beams = tuneLattice(values, beamCount, rand)
  let kept = values.filter((v) => beamDivisors(v).some((d) => beams.includes(d)))

  if (kept.length < MIN_CANDIDATES) {
    // The host's distractors were all unkillable on this lattice (a prime
    // distractor, most often). Top up with mal-rules rather than shipping a
    // wave where the only thing on screen is the answer.
    const extra: number[] = []
    for (const v of columnMalRules(answer)) {
      if (extra.length + kept.length >= Math.min(most, MIN_CANDIDATES + 1)) break
      if (seen.has(v) || !usableCoreValue(v)) continue
      if (!beamDivisors(v).some((d) => beams.includes(d))) continue
      seen.add(v)
      extra.push(v)
    }
    kept = [...kept, ...extra]
  }
  if (kept.length < MIN_CANDIDATES) return null

  // Re-tune against exactly what will be on screen, so no beam label prints a
  // candidate's number back at the child.
  beams = tuneLattice(kept, beamCount, rand)
  if (!beams.some((b) => resonates(b, answer))) return null
  kept = kept.filter((v) => v === answer || beams.some((b) => resonates(b, v)))
  if (kept.length < MIN_CANDIDATES) return null

  // **Trimmed to the cap here and nowhere earlier.** The re-tune above can only
  // remove values, so trimming before it would leave a wave the ramp asked to
  // hold two of carrying three whenever the mal-rule top-up fired. The answer is
  // never the one dropped — a wave without its own answer on it is not a
  // question, it is four wrong numbers.
  if (kept.length > most) {
    const rest = kept.filter((v) => v !== answer).slice(0, most - 1)
    kept = [answer, ...rest]
  }

  // Shuffle by rejection so the answer is not always the leftmost candidate.
  const order = [...kept]
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = order[i] as number
    order[i] = order[j] as number
    order[j] = t
  }

  return {
    questionId: source.id,
    prompt: source.prompt,
    answer,
    beams,
    candidates: order.map((value) => ({ value, correct: value === answer })),
    windowSeconds: comprehensionWindow({ prompt: source.prompt, answer }),
  }
}
