// src/journey/exercises/types.ts — the one renderer contract (feed-ux §4).
//
// Renderers are DUMB about scheduling: no store writes, no quota calls, no
// celebration calls. They receive fully resolved content (items +
// distractors from the W5 resolver — they never query content themselves)
// and report `onOutcome` exactly once per attempt.

import type { ActivityDetail, ActivityItemResult, ActivitySpec } from "../../contentPacks/activityContract.ts"
import type { ResolvedItem } from "../content/resolve.ts"
import type { DistractorSet } from "../content/distractors.ts"
import type { RawOutcome, ScaffoldState } from "../types.ts"

export type ExerciseMode = "live" | "review" | "probe"

export type SpeakFn = (lang: string, text: string, opts?: { rate?: number }) => Promise<void>

export interface ExerciseProps {
  cardId: string
  spec: ActivitySpec
  items: ResolvedItem[]
  distractors: DistractorSet | null
  mode: ExerciseMode
  scaffold: ScaffoldState
  onOutcome: (o: RawOutcome) => void
  /** Scaffold consumed — the host accounts hintsUsed (grades Hard at best). */
  onHintUsed: () => void
  speak: SpeakFn
  showRomanization: boolean
  /** Card is the CURRENT slot (audio-first cards auto-play on arrival only). */
  active: boolean
  /** Review snapshot: the result this card settled with (read-only render). */
  review?: { correct: boolean } | null
}

export type { ActivityDetail, ActivityItemResult, RawOutcome, ScaffoldState, DistractorSet, ResolvedItem }

/** Answer face of an item per direction (choice cards). */
export function faceOf(
  item: ResolvedItem,
  which: "target" | "native",
): { text: string; ttsText: string; romanization?: string } | null {
  if (which === "target") return item.target
  return item.native ?? null
}

export function perItemAll(
  items: ResolvedItem[],
  outcome: "pass" | "partial" | "fail",
  latencyMs: number,
  hintsUsed: number,
  detail?: ActivityDetail,
): ActivityItemResult[] {
  return items.map((i) => {
    const r: ActivityItemResult = { itemRef: i.ref, outcome, latencyMs }
    if (hintsUsed > 0) r.hintsUsed = hintsUsed
    if (detail) r.detail = detail
    return r
  })
}
