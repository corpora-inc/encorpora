// journey/engine/grading.ts — toGrade(): ActivityResult × IssuedCard ×
// ItemCard → Grade. The §4.5 table, evaluated top-down, first match wins.
// All detail paths resolve against the R3 typed envelope; item-level
// per.detail takes precedence over result-level r.detail per field.

import {
  GRADE_Z_EASY,
  GRADE_Z_HARD,
  GAME_ROUND_HARD_BELOW,
  STT_AGAIN_BELOW,
  STT_EASY_ABOVE,
  STT_HARD_BELOW,
} from "./constants.ts"
import { latencyZ } from "./latency.ts"
import type { ActivityItemResult, ActivityResult, CourseState, IssuedCard } from "./types.ts"

export type DerivedGrade = 1 | 2 | 3 | 4 | "forget"

export interface GradeInput {
  result: Pick<ActivityResult, "score" | "detail">
  /** Absent ⇒ score-only round evidence (R9 aggregate path). */
  per?: ActivityItemResult
  issued: IssuedCard
  /** card.fsrs.reps at grading time (firstTry detection). */
  cardReps: number
  baselines: CourseState["latencyBaselines"]
  textLen: number
}

export interface GradeOutput {
  grade: DerivedGrade
  /** Row 2 fired — caller sets CardFlags.PriorKnown. */
  priorKnown: boolean
}

type Detail = NonNullable<ActivityResult["detail"]>

/** Item-level detail wins over result-level, per field (engine.md §4.5). */
function pickDetail<K extends keyof Detail>(
  key: K,
  per: ActivityItemResult | undefined,
  result: GradeInput["result"],
): Detail[K] | undefined {
  const item = per?.detail?.[key]
  if (item !== undefined) return item
  return result.detail?.[key]
}

function flag(name: string, per: ActivityItemResult | undefined, result: GradeInput["result"]): boolean {
  const itemFlags = per?.detail?.flags
  if (itemFlags && name in itemFlags) return itemFlags[name] === true
  return result.detail?.flags?.[name] === true
}

export function toGrade(input: GradeInput): GradeOutput {
  const { result, per, issued } = input
  let priorKnown = false

  const selfReport = pickDetail("selfReport", per, result)
  const stt = pickDetail("stt", per, result)
  const sttUnavailable = flag("sttUnavailable", per, result)
  const aggregateBinned = flag("aggregateBinned", per, result)

  const firstTry = input.cardReps === 0 && !issued.isReplay
  const retried = issued.isReplay
  const hintsUsed = per?.hintsUsed ?? 0
  const z =
    per?.latencyMs !== undefined
      ? latencyZ(input.baselines, issued.activityType, input.textLen, per.latencyMs)
      : 1 // no latency evidence ⇒ neutral (neither fast-Easy nor slow-Hard)

  let grade: DerivedGrade | null = null

  // 1
  if (selfReport === "never-learned") return { grade: "forget", priorKnown: false }
  // 2 (new card only)
  if (grade === null && selfReport === "already-knew" && input.cardReps === 0) {
    grade = 4
    priorKnown = true
  }
  // 3
  if (grade === null && per?.outcome === "fail") grade = 1
  // 4–5 (STT rows; skipped entirely when the speech path degraded)
  if (grade === null && !sttUnavailable && stt && typeof stt.overallScore === "number") {
    if (stt.overallScore < STT_AGAIN_BELOW) grade = 1
    else if (stt.overallScore < STT_HARD_BELOW) grade = 2
  }
  // 6
  if (grade === null && per?.outcome === "partial") grade = 2
  // 7
  if (grade === null && (hintsUsed > 0 || retried || z > GRADE_Z_HARD)) grade = 2
  // 8 — score-only round evidence (no genuine per-item hits)
  if (grade === null && per === undefined && result.score < GAME_ROUND_HARD_BELOW) grade = 2
  // 9 — intentionally stingy Easy
  if (
    grade === null &&
    per !== undefined &&
    z < GRADE_Z_EASY &&
    firstTry &&
    hintsUsed === 0 &&
    !issued.guessable &&
    (!stt || sttUnavailable || stt.overallScore > STT_EASY_ABOVE)
  ) {
    grade = 4
  }
  // 10
  if (grade === null) grade = 3

  // Caps (applied after the table, engine.md §4.5):
  // guessable (MC/recognition) ⇒ ≤ Good
  if (issued.guessable && grade > 3) grade = 3
  // score-only rounds grade uniformly and never exceed Good (R9)
  if (per === undefined && grade > 3) grade = 3
  // provider-synthesized per-item outcomes clamp to [Hard, Good] (R9)
  if (aggregateBinned) {
    if (grade < 2) grade = 2
    if (grade > 3) grade = 3
  }

  return { grade, priorKnown }
}
