// src/journey/exercises/clozeContext.ts — pure derivation for the
// words-in-context cloze (a word met before, shown blanked inside a real
// corpus phrase). Kept react-free so it is unit-testable; <Cloze> renders over
// it. When no context params are present the caller falls back to its normal
// single-item cloze behaviour.

import { tokenizePhrase } from "../../util/wordTokens.ts"

export interface ClozeContext {
  /** Word tokens of the CONTEXT phrase (isWord only). */
  words: string[]
  /** Index of the blanked token (the target word inside the phrase). */
  blankIndex: number
  /** The correct fill (surface form as it appears in the phrase). */
  blankWord: string
  /** Native gloss of the whole phrase, if provided. */
  native?: string
}

export interface ClozeContextParams {
  contextPhrase?: unknown
  contextWord?: unknown
  contextNative?: unknown
}

/**
 * Build the context-cloze view, or null when this card is not a context cloze
 * (no `contextPhrase`) or the word cannot be located in the phrase (defensive —
 * the runtime only sets context when it verified membership, but a mismatch
 * must degrade to the normal cloze, never blank the sentence).
 */
export function clozeContext(
  params: ClozeContextParams | undefined,
  targetLang: string,
): ClozeContext | null {
  const phrase = typeof params?.contextPhrase === "string" ? params.contextPhrase : ""
  const word = typeof params?.contextWord === "string" ? params.contextWord : ""
  if (!phrase || !word) return null
  const words = tokenizePhrase(phrase, targetLang)
    .filter((w) => w.isWord)
    .map((w) => w.text)
  const target = word.toLowerCase()
  const blankIndex = words.findIndex((w) => w.toLowerCase() === target)
  if (blankIndex < 0) return null
  const out: ClozeContext = { words, blankIndex, blankWord: words[blankIndex] }
  if (typeof params?.contextNative === "string" && params.contextNative) {
    out.native = params.contextNative
  }
  return out
}
