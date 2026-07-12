// src/journey/cards/wordEnrichment.ts — pure model for the post-answer word
// enrichment (words-in-context + wordpan meaning). Kept side-effect-free so the
// "what to show" decision is unit-testable without a DOM: the <WordEnrichment>
// component is a thin render over this.

import type { ResolvedExample, ResolvedItem } from "../content/resolve.ts"

export interface WordEnrichmentModel {
  /** The word being enriched (target surface). */
  word: string
  /** Short native gloss headline (the word's meaning), when resolved. Decoration
   *  for the overlay header — a bare gloss alone is NOT enrichment (it already
   *  IS the card's native face), so it never lights the (?) on its own. */
  gloss?: string
  /** A real corpus phrase carrying the word — the "in context" line. */
  example?: {
    target: string
    native?: string
    targetLang: string
    nativeLang?: string
  }
  /**
   * Depth-on-demand explanation, opened behind a (?) affordance as an OVERLAY
   * (never inline — it must not reflow the exercise). Present ONLY when a real
   * paragraph exists in the learner's own language (or, on a single-language
   * stack, the target) — never the English etymology for a non-English native.
   */
  meaning?: {
    /** wordpan ~50-word explanation paragraph, in `lang`. */
    paragraph: string
    /** Language of the paragraph. */
    lang: string
  }
}

const baseSubtag = (l: string): string => (l.split("-")[0] || l).toLowerCase()

/**
 * Native-safe, region-tolerant explanation selection — shared by the (?) overlay
 * and the etymology gem so both obey ONE rule: an ES→EN learner reads the
 * Spanish paragraph, never the English etymology. The target-language paragraph
 * is surfaced ONLY when it IS the learner's language: a single-language stack
 * (no nativeLang), or native/target sharing a base subtag (en vs en-GB). Region
 * tolerance is already applied upstream when populating explanationNative
 * (resolve.ts matches pt == pt-BR); this keeps the render side honest.
 */
export function selectWordParagraph(
  item: ResolvedItem,
  langs: { targetLang: string; nativeLang?: string },
): { text: string; lang: string } | null {
  const extras = item.extras?.kind === "word" ? item.extras : null
  if (!extras) return null
  const { nativeLang, targetLang } = langs
  if (extras.explanationNative && nativeLang) {
    return { text: extras.explanationNative, lang: nativeLang }
  }
  const sameLang = !nativeLang || baseSubtag(nativeLang) === baseSubtag(targetLang)
  if (extras.explanationTarget && sameLang) {
    return { text: extras.explanationTarget, lang: targetLang }
  }
  return null
}

/**
 * Build the enrichment model for a settled card, or null when there is nothing
 * richer to show (not a word, or no example AND no native-safe paragraph). The
 * caller renders nothing on null — enrichment is additive depth, never a gap.
 */
export function wordEnrichment(
  item: ResolvedItem,
  example: ResolvedExample | null | undefined,
  langs: { targetLang: string; nativeLang?: string },
): WordEnrichmentModel | null {
  if (item.kind !== "word") return null
  const model: WordEnrichmentModel = { word: item.target.text }
  // Native gloss is header decoration only — it rides along in the overlay when
  // some OTHER enrichment (example / paragraph) opens it, never triggers it.
  if (langs.nativeLang && item.native?.text) model.gloss = item.native.text

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

  const para = selectWordParagraph(item, langs)
  if (para) model.meaning = { paragraph: para.text, lang: para.lang }

  if (!model.example && !model.meaning) return null
  return model
}
