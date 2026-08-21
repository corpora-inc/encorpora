// src/journey/cards/tutorMoment.ts — pure prompt construction for the
// end-of-lesson "tutor moment" (Qwen3 on-device recap). Kept side-effect-free
// and framework-free so the exact model input is unit-testable and reviewable
// WITHOUT a device or a loaded model. The (deferred) card wiring is a thin
// streaming shell over this — see docs/journey/specs/llm-cards.md.
//
// Design intent (spec §"Prompt"):
//   • ONE short recap, IN the target language, at the learner's CEFR band.
//   • Naturally re-uses 2–3 words the learner just struggled with.
//   • No grading, no translation, no lists, no meta — a warm human beat.
//   • Non-thinking (Qwen3 hybrid) + tight token cap to keep it fast + on-model.

import type { LlmChatMessage, LlmChatOptions } from "../../contentPacks/types.ts"

export interface TutorMomentStruggle {
  /** Target-language surface the learner tripped on. */
  text: string
  /** Optional native gloss — helps the model pick the right sense. */
  native?: string
}

export interface TutorMomentInput {
  /** Language being learned (display name preferred, e.g. "English"). */
  targetLang: string
  /** Learner's native language name, when known. */
  nativeLang?: string
  /** CEFR band of the current unit (e.g. "A1"). Controls difficulty. */
  cefr?: string
  /** Items just struggled with, most-struggled first. */
  struggled: TutorMomentStruggle[]
}

/** Cap the recap to at most three anchor words — more dilutes it. */
export const TUTOR_MOMENT_MAX_WORDS = 3

/** Deterministic, low-temperature options — a recap is not a place for wandering. */
export const TUTOR_MOMENT_OPTIONS: LlmChatOptions = {
  temperature: 0.4,
  topP: 0.9,
  minP: 0.05,
  repeatPenalty: 1.1,
  maxTokens: 96,
  noThink: true,
}

/**
 * Build the chat messages for the tutor moment, or null when there is nothing
 * worth recapping (no struggled items). Returning null is the caller's signal
 * to emit NO card — the tutor moment is a reward for a real struggle, never
 * filler.
 */
export function buildTutorMomentMessages(input: TutorMomentInput): LlmChatMessage[] | null {
  const words = input.struggled
    .map((s) => s.text.trim())
    .filter(Boolean)
    .slice(0, TUTOR_MOMENT_MAX_WORDS)
  if (words.length === 0) return null

  const cefr = input.cefr ? ` at CEFR ${input.cefr} level` : ""
  const wordList = words.map((w) => `"${w}"`).join(", ")
  // The instruction is authored so the OUTPUT is in the target language; the
  // recap itself must never switch to the native language (that would undo the
  // immersion). Brevity + no-meta directives mirror the tutomaton house rules.
  const system =
    `You are a warm, encouraging language tutor. Write ONE short recap of at most two sentences, ` +
    `written entirely in ${input.targetLang}${cefr}. Naturally reuse these words the learner just ` +
    `practiced: ${wordList}. Do not translate, do not explain grammar, do not use lists or headings, ` +
    `and do not mention that this is a recap. Just speak to the learner like a person.`

  const user = `Words to weave in: ${wordList}. Keep it to ${input.targetLang} only.`

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ]
}
