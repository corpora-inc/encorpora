// src/journey/exercises/common/tokenGuards.ts — pure renderability guards for
// the multi-token exercises (Cloze, WordOrder). Extracted react-free so the
// degenerate-input defense is unit-testable without a DOM (the same reason
// faces.ts / clozeContext.ts are pure).
//
// Team 1 gates single-token KINDS (word/char/phoneme) at selection so these
// activities are rerouted, but a one-word PHRASE ("Fire!", "Jam") can still
// resolve to a single token — the renderer must never present a degenerate
// card (a bare "____" cloze, or a 1-tile "reorder"). These predicates are the
// last line of that defense.

import { tokenizePhrase } from "../../../util/wordTokens.ts"

/** Word tokens of a phrase in `lang` (isWord only) — the ONE tokenizer. */
export function orderTokens(text: string, lang: string): string[] {
  return tokenizePhrase(text, lang)
    .filter((w) => w.isWord)
    .map((w) => w.text)
}

/**
 * A word_order card is renderable only with ≥2 tokens to order. With 0 or 1
 * there is nothing to reorder — the renderer degrades to a reveal.
 */
export function canOrder(tokenCount: number): boolean {
  return tokenCount >= 2
}

/**
 * A cloze card needs surrounding CONTEXT: blanking the only token leaves a bare
 * "____" with nothing to read. ≥2 tokens means at least one context word
 * remains beside the blank.
 */
export function hasClozeContext(tokenCount: number): boolean {
  return tokenCount >= 2
}
