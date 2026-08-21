// journey/engine/strands.ts — Four Strands accounting (pedagogy §12.1):
// rolling 2-week tally + last-40 window + stage ratio targets + deficit.

import {
  LANGUAGE_SHARE_HARD_CAP,
  LAST40_WINDOW,
  STRAND_CONTROL_EXPONENT,
  STRAND_CONTROL_MAX,
  STRAND_CONTROL_MIN,
  STRAND_TARGETS,
  STRAND_WINDOW_DAYS,
} from "./constants.ts"
import type { CourseState, SessionState, Strand } from "./types.ts"

export const STRAND_INDEX: Record<Strand, 0 | 1 | 2 | 3> = {
  input: 0,
  output: 1,
  language: 2,
  fluency: 3,
}
export const STRANDS: Strand[] = ["input", "output", "language", "fluency"]

/** Credit duration to today's bucket. */
export function creditStrand(course: CourseState, strand: Strand, ms: number, day: number): void {
  let bucket = course.strandTally.find((b) => b.day === day)
  if (!bucket) {
    bucket = { day, secs: [0, 0, 0, 0] }
    course.strandTally.push(bucket)
  }
  bucket.secs[STRAND_INDEX[strand]] += ms / 1000
}

/** Drop tally entries older than 14 days (tickDay step 1). */
export function pruneStrandTally(course: CourseState, day: number): void {
  course.strandTally = course.strandTally.filter((b) => day - b.day < STRAND_WINDOW_DAYS)
}

/** 2-week shares [input, output, language, fluency]; zeros when no data. */
export function strandShares(course: CourseState, day: number): [number, number, number, number] {
  const sums: [number, number, number, number] = [0, 0, 0, 0]
  for (const b of course.strandTally) {
    if (day - b.day >= STRAND_WINDOW_DAYS) continue
    for (let i = 0; i < 4; i++) sums[i] += b.secs[i]
  }
  const total = sums[0] + sums[1] + sums[2] + sums[3]
  if (total <= 0) return [0, 0, 0, 0]
  return [sums[0] / total, sums[1] / total, sums[2] / total, sums[3] / total]
}

export function stageTargets(cefr: string): [number, number, number, number] {
  return STRAND_TARGETS[cefr] ?? STRAND_TARGETS.A1
}

/** The most-deficient strand vs stage targets, or null with no data yet. */
export function mostDeficientStrand(course: CourseState, day: number, cefr: string): Strand | null {
  const shares = strandShares(course, day)
  if (shares[0] + shares[1] + shares[2] + shares[3] === 0) return null
  const targets = stageTargets(cefr)
  let worst: Strand | null = null
  let worstGap = 0
  for (const s of STRANDS) {
    const i = STRAND_INDEX[s]
    const gap = targets[i] - shares[i]
    if (gap > worstGap) {
      worstGap = gap
      worst = s
    }
  }
  return worst
}

/** Proportional strand control: per-strand template weight
 *  ≈ target/current, clamped — drives 2-week shares onto the stage targets
 *  (P7). Neutral 1s until any tally exists. */
export function strandControlWeights(
  course: CourseState,
  day: number,
  cefr: string,
): [number, number, number, number] {
  const shares = strandShares(course, day)
  if (shares[0] + shares[1] + shares[2] + shares[3] === 0) return [1, 1, 1, 1]
  const targets = stageTargets(cefr)
  const out: [number, number, number, number] = [1, 1, 1, 1]
  for (let i = 0; i < 4; i++) {
    const ratio = (targets[i] + 0.02) / (shares[i] + 0.02)
    out[i] = Math.min(
      STRAND_CONTROL_MAX,
      Math.max(STRAND_CONTROL_MIN, Math.pow(ratio, STRAND_CONTROL_EXPONENT)),
    )
  }
  return out
}

/** Track a served card in the last-40 interleaving buffer. */
export function pushLast40(session: SessionState, entry: SessionState["last40"][number]): void {
  session.last40.push(entry)
  if (session.last40.length > LAST40_WINDOW) session.last40.shift()
}

/** Hard rule input: language-focused share over last40 (engine.md §5.3.3). */
export function languageShareLast40(session: SessionState): number {
  if (session.last40.length === 0) return 0
  let n = 0
  for (const e of session.last40) if (e.strand === "language") n += 1
  return n / session.last40.length
}

export function languageOverCap(session: SessionState): boolean {
  return session.last40.length >= 10 && languageShareLast40(session) > LANGUAGE_SHARE_HARD_CAP
}
