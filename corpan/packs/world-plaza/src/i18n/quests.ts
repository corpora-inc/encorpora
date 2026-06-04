/**
 * Quest string catalog (LOCALIZATION.md §3) — the SECOND i18n namespace, for quest
 * CONTENT copy (title / narrative / step label / special-NPC name). Kept separate
 * from the UI-chrome catalog (`strings.ts`) because quest copy is content-register
 * (authored + tuned differently from button/menu UI), but it uses the SAME
 * mechanism: an `en` source-of-truth, a `GENERATED_LOCALES` block filled by
 * `tools/gen_i18n.py`, and a resolver that collapses variants + falls back per-key
 * to English (never blank).
 *
 * Keys are DERIVED from the ids the quest JSON already carries, so a quest needs no
 * hand-assigned keys — just author the English value under the derived key:
 *   - `quest.<questId>.title`
 *   - `quest.<questId>.narrative`
 *   - `quest.<questId>.step.<stepId>`     (a step label)
 *   - `special.<questId>.<anchorId>.name` (a special-NPC display name — the shape
 *      `content/npc/special.json`'s `nameKey` already uses)
 *
 * `questString(key, lang, fallback)` is the resolver every quest-bearing surface
 * calls: it returns the localized string, or the AUTHORED LITERAL fallback (the
 * quest JSON's raw `title`/`narrative`/`label`/`name`) when the catalog has no
 * entry — so an un-keyed or not-yet-translated quest still renders clean English.
 *
 * Rendered in the immersion resolver's `uiLocale()` (native by default, target
 * under immersion) — identical to the chrome catalog, so quest copy localizes AND
 * immersion-flips for free.
 */

import { baseLocale } from "./strings"

/** Derive the catalog key for a quest's title. */
export const questTitleKey = (questId: string): string => `quest.${questId}.title`
/** Derive the catalog key for a quest's narrative. */
export const questNarrativeKey = (questId: string): string => `quest.${questId}.narrative`
/** Derive the catalog key for a quest step's label. */
export const questStepKey = (questId: string, stepId: string): string =>
  `quest.${questId}.step.${stepId}`
/** Derive the catalog key for a special-NPC display name (matches special.json). */
export const specialNameKey = (questId: string, anchorId: string): string =>
  `special.${questId}.${anchorId}.name`

/**
 * The English source-of-truth + generated locales. AUTHORED keys live under `en`;
 * `tools/gen_i18n.py` (a second invocation, pointed at this file) fills the rest.
 * Seeded EMPTY: every quest currently renders via its JSON literal fallback, so the
 * pack is fully functional today; filling `en` here + generating is the translation
 * step (LOCALIZATION.md §4), with ZERO runtime risk (fallback covers every miss).
 */
const en: Record<string, string> = {
  // Authored quest/special-NPC strings go here, e.g.:
  //   "quest.es-cafe-travel.title": "Coffee on the Plaza",
  //   "quest.es-cafe-travel.step.order-coffee": "Order a coffee at the plaza café",
  //   "special.es-cafe-travel.plaza.name": "the café host",
  // (Left empty for now — the literal fallback renders until these are authored.)
}

// GENERATED_QUEST_LOCALES_START
const LOCALES: Record<string, Record<string, string>> = {
  en,
}
// GENERATED_QUEST_LOCALES_END

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m))
}

/**
 * Resolve a quest-content string into `lang`, falling back to the authored LITERAL
 * (the quest JSON's raw value) when the catalog has no entry — never blank. This is
 * the keyed-quest contract (LOCALIZATION.md §3): prefer the key, fall back to the
 * literal, so an un-keyed/not-yet-translated quest renders clean English.
 */
export function questString(
  key: string,
  lang: string,
  fallbackLiteral: string,
  params?: Record<string, string | number>,
): string {
  const loc = baseLocale(lang)
  const hit = LOCALES[lang]?.[key] ?? LOCALES[loc]?.[key] ?? en[key]
  return interpolate(hit ?? fallbackLiteral, params)
}

/** True when the catalog actually has a (non-fallback) entry for `key` in `lang`. */
export function hasQuestString(key: string, lang: string): boolean {
  const loc = baseLocale(lang)
  return Boolean(LOCALES[lang]?.[key] ?? LOCALES[loc]?.[key] ?? en[key])
}

/** Present quest-catalog locales (for tests/dev). */
export function presentQuestLocales(): string[] {
  return Object.keys(LOCALES)
}

export { LOCALES as __QUEST_LOCALES_FOR_TEST }
