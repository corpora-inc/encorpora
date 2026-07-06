// src/journey/cards/wordEnrichment.ts — pure model for the post-answer word
// enrichment (words-in-context + wordpan meaning). Kept side-effect-free so the
// "what to show" decision is unit-testable without a DOM: the <WordEnrichment>
// component is a thin render over this.

import type { ResolvedExample, ResolvedItem } from "../content/resolve.ts"

export interface WordEnrichmentModel {
  /** The word being enriched (target surface). */
  word: string
  /** A real corpus phrase carrying the word — the "in context" line. */
  example?: {
    target: string
    native?: string
    targetLang: string
    nativeLang?: string
  }
  /** wordpan meaning/etymology paragraph, native-first, with its language. */
  explanation?: { text: string; lang: string }
}

/**
 * Build the enrichment model for a settled card, or null when there is nothing
 * richer to show (not a word, or no example AND no wordpan paragraph). The
 * caller renders nothing on null — enrichment is additive depth, never a gap.
 *
 * wordpan paragraph selection is native-first (the learner's language) with a
 * target-language fallback — the same contract the etymology gem uses.
 */
export function wordEnrichment(
  item: ResolvedItem,
  example: ResolvedExample | null | undefined,
  langs: { targetLang: string; nativeLang?: string },
): WordEnrichmentModel | null {
  if (item.kind !== "word") return null
  const model: WordEnrichmentModel = { word: item.target.text }

  if (example && example.phrase.target.text) {
    const ex: WordEnrichmentModel["example"] = {
      target: example.phrase.target.text,
      targetLang: langs.targetLang,
    }
    if (example.phrase.native?.text) {
      ex.native = example.phrase.native.text
      if (langs.nativeLang) ex.nativeLang = langs.nativeLang
    }
    model.example = ex
  }

  const extras = item.extras?.kind === "word" ? item.extras : null
  if (extras?.explanationNative && langs.nativeLang) {
    model.explanation = { text: extras.explanationNative, lang: langs.nativeLang }
  } else if (extras?.explanationTarget) {
    model.explanation = { text: extras.explanationTarget, lang: langs.targetLang }
  }

  if (!model.example && !model.explanation) return null
  return model
}
