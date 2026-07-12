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
 * and the etymology gem so both obey ONE hard rule: an ES→EN learner NEVER sees
 * the English (target) etymology. The native paragraph is preferred; the target
 * paragraph is surfaced ONLY when the target genuinely IS the learner's language
 * (an explicit native whose base subtag equals the target's — en vs en-GB).
 *
 * When there is no native-language paragraph AND native differs from target (or
 * native is unknown), we return null — the caller then falls back to the native
 * gloss + in-context example, or shows nothing, but never an English wall. This
 * is deliberately stricter than a plain "no L1 ⇒ target" fallback: on-device,
 * that fallback surfaced "…from Old English an…" to a Spanish learner (the
 * number "one" carried only a target paragraph, and nativeLang was empty in that
 * path). Region tolerance for the NATIVE paragraph is already applied upstream
 * when populating explanationNative (resolve.ts matches pt == pt-BR).
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
  const targetIsNative = !!nativeLang && baseSubtag(nativeLang) === baseSubtag(targetLang)
  if (extras.explanationTarget && targetIsNative) {
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
