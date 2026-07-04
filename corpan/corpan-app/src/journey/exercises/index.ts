// src/journey/exercises/index.ts — the native renderer registry, keyed by
// the R4 ACTIVITY_TYPES contract constant (one metadata source; this map
// must cover exactly its keys — pinned by a unit test).

import type { ComponentType } from "react"
import { ACTIVITY_TYPES } from "../../contentPacks/activityContract.ts"
import type { ExerciseProps } from "./types.ts"
import { ChoicePick } from "./ChoicePick.tsx"
import { Cloze } from "./Cloze.tsx"
import { FlipRecall } from "./FlipRecall.tsx"
import { GrammarNote } from "./GrammarNote.tsx"
import { IntroEcho } from "./IntroEcho.tsx"
import { ListenPick } from "./ListenPick.tsx"
import { ListenType } from "./ListenType.tsx"
import { MatchPairs } from "./MatchPairs.tsx"
import { SpeakEcho } from "./SpeakEcho.tsx"
import { WordOrder } from "./WordOrder.tsx"

export const EXERCISE_RENDERERS: Record<keyof typeof ACTIVITY_TYPES, ComponentType<ExerciseProps>> = {
  choice_pick: ChoicePick,
  listen_pick: ListenPick,
  listen_type: ListenType,
  cloze: Cloze,
  word_order: WordOrder,
  match_pairs: MatchPairs,
  flip_recall: FlipRecall,
  speak_echo: SpeakEcho,
  intro_echo: IntroEcho,
  grammar_note: GrammarNote,
}

export function rendererFor(activityType: string): ComponentType<ExerciseProps> | null {
  return (EXERCISE_RENDERERS as Record<string, ComponentType<ExerciseProps>>)[activityType] ?? null
}

export type { ExerciseProps } from "./types.ts"
