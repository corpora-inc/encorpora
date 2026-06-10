/**
 * beatlounge — phrase Discovery: pure view-model helpers (no React, no audio).
 *
 * Discovery is "all stack languages" — NOT native+target. So instead of the
 * pipeline's `resolvePhraseContent` (which collapses to target+gloss), we expose
 * EVERY stack language present in an entry as its own row, and the contiguous
 * n-gram breakdown for a chosen language's text. Kept pure so it's unit-testable
 * and the React layer stays thin.
 */

import type { EntryOut, StackConfig, TranslationOut } from "../../sdk/types"
import { tokenizePhrase, isNoSpaceScript } from "../../phrase/tokenize"
import { phraseCombos, combosByBand, comboCount, type PhraseCombo } from "../../phrase/combos"

/** One stack language present in an entry — a row in the language list. */
export interface LanguageRow {
  code: string
  /** Is this the native (languages[0]) language of the stack? */
  isNative: boolean
  text: string
  romanization?: string
}

/**
 * One row per STACK language that actually has a translation in this entry, in
 * stack order (native first). The user samples across every language they study
 * — not just native+target. Languages absent from `entry.translations` are
 * dropped (nothing to show), so the list reflects real coverage.
 */
export const entryLanguageRows = (
  entry: EntryOut,
  stackLanguages: string[]
): LanguageRow[] => {
  const byCode = new Map<string, TranslationOut>()
  for (const tr of entry.translations) {
    const code = tr.language_code?.trim()
    if (code && !byCode.has(code.toLowerCase())) byCode.set(code.toLowerCase(), tr)
  }
  const rows: LanguageRow[] = []
  stackLanguages.forEach((lang, i) => {
    const tr = byCode.get(lang.trim().toLowerCase())
    if (!tr || !tr.text?.trim()) return
    rows.push({
      code: lang,
      isNative: i === 0,
      text: tr.text,
      romanization: tr.romanization || undefined,
    })
  })
  return rows
}

/** A short native-language gloss for a result row (the first stack language). */
export const nativeGloss = (entry: EntryOut, stackLanguages: string[]): string => {
  const native = stackLanguages[0]
  if (!native) return ""
  const lc = native.trim().toLowerCase()
  const tr = entry.translations.find((t) => t.language_code?.trim().toLowerCase() === lc)
  return tr?.text ?? ""
}

/**
 * The "headline" text shown for a result row: the first TARGET (non-native)
 * stack language present, else the native, else the first translation. This is
 * just the browse-list preview; drilling in shows ALL languages.
 */
export const headlineRow = (entry: EntryOut, stackLanguages: string[]): LanguageRow | null => {
  const rows = entryLanguageRows(entry, stackLanguages)
  if (rows.length === 0) {
    const first = entry.translations[0]
    return first
      ? { code: first.language_code, isNative: false, text: first.text, romanization: first.romanization }
      : null
  }
  return rows.find((r) => !r.isNative) ?? rows[0]
}

/** The joiner the combinator should use for a language (space vs CJK no-space). */
export const joinerFor = (text: string, lang: string): string =>
  isNoSpaceScript(text, lang) ? "" : " "

export interface ComboBreakdown {
  /** Token surface forms in reading order. */
  tokens: string[]
  /** Grouped n-gram bands (N=1..maxN), each with its combos. */
  bands: { n: number; combos: PhraseCombo[] }[]
  /** Total combos that WOULD exist for the full phrase (triangular). */
  fullCount: number
  /** Total combos actually produced (after any maxN cap). */
  shownCount: number
  /** The N at which we capped (undefined ⇒ no cap). */
  cappedAtN?: number
  /** Combos hidden by the cap (fullCount - shownCount). */
  hiddenCount: number
}

/**
 * Tokenize a language's text and produce the grouped contiguous-n-gram
 * breakdown, capping the longest bands when a phrase is long (the count grows
 * triangularly). `maxN` caps the band length; what was capped is surfaced so the
 * UI is noisy, not silent.
 */
export const comboBreakdown = (text: string, lang: string, maxN?: number): ComboBreakdown => {
  const tokens = tokenizePhrase(text, lang).map((t) => t.text)
  const joiner = joinerFor(text, lang)
  const fullCount = comboCount(tokens.length)
  const effectiveMax = maxN && maxN < tokens.length ? maxN : tokens.length
  const combos = phraseCombos(tokens, joiner, effectiveMax)
  const bands = combosByBand(combos)
  const cappedAtN = effectiveMax < tokens.length ? effectiveMax : undefined
  return {
    tokens,
    bands,
    fullCount,
    shownCount: combos.length,
    cappedAtN,
    hiddenCount: Math.max(0, fullCount - combos.length),
  }
}

/**
 * Choose the language codes to send to the corpus query: ALL stack languages
 * (Discovery requirement). Falls back to the stack's first language if the list
 * is empty, and de-dupes while preserving order.
 */
export const discoveryLanguageCodes = (stack: StackConfig): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of stack.languages ?? []) {
    const c = l?.trim()
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase())
      out.push(c)
    }
  }
  return out
}
