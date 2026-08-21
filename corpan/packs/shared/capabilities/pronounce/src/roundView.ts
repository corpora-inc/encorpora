// Stimulus rendering — the round card body (target text + romanization +
// native gloss) and the target-language badge text, MOVED from
// packs/pronunciation-coach/src/game.ts (fillCard / updateLangBadge slice,
// capability-modules.md §4.1). The deck/swipe chrome around it stays in the
// pack; the capability round card composes the same body.
import { escapeHtml } from "./text"
import { whisperLang } from "./session"

export type StimulusOptions = {
  targetText: string
  romanization?: string
  nativeText?: string
  showRomanization?: boolean
}

/** The card-center body: target phrase (tap-to-hear is bound by the
 *  consumer on .capPron-target / .capPron-romanization), optional
 *  romanization, optional native gloss. */
export const stimulusBodyHtml = (opts: StimulusOptions): string => {
  const roman = opts.romanization || ""
  const romanHtml =
    opts.showRomanization && roman
      ? `<p class="capPron-romanization">${escapeHtml(roman)}</p>`
      : ""
  const nativeHtml = opts.nativeText
    ? `<p class="capPron-native">${escapeHtml(opts.nativeText)}</p>`
    : ""
  return `<h1 class="capPron-target">${escapeHtml(opts.targetText || "—")}</h1>${romanHtml}${nativeHtml}`
}

/** Uppercased whisper base code for the language badge ("ES", "JW", …);
 *  null hides the badge. */
export const langBadgeText = (lang: string | null): string | null => {
  if (!lang) return null
  return whisperLang(lang).toUpperCase()
}
