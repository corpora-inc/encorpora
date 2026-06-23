/**
 * Pack-bundled i18n.
 *
 * - All translations ship with the pack as JSON files in `src/locales/`.
 * - The active language is taken from `stackConfig.languages[0]`; if a
 *   key is missing in the active locale we fall back to English.
 * - Subscribers re-render when `setLanguage` is called with a new code.
 *
 * Keep this module dependency-free — it runs in any browser context.
 */

import en from "../locales/en.json"

type StringsMap = Record<string, string>

// Eager-import every translated JSON file so they're bundled with the pack.
// Path glob is relative to this file: `src/i18n/index.ts -> ../locales/*.json`.
const localeModules = import.meta.glob<StringsMap>(
  "../locales/*.json",
  { eager: true, import: "default" },
)

const LOCALES: Record<string, StringsMap> = { en: en as StringsMap }
for (const [path, mod] of Object.entries(localeModules)) {
  const match = path.match(/\/([^/]+)\.json$/)
  if (!match) continue
  const code = match[1]
  LOCALES[code] = mod as StringsMap
}

let activeLanguage = "en"
const listeners = new Set<(lang: string) => void>()

export function currentLanguage(): string {
  return activeLanguage
}

export function availableLocales(): string[] {
  return Object.keys(LOCALES).sort()
}

/**
 * Set the active UI language. Falls back to "en" if the code is
 * unknown. No-op when the language is unchanged.
 */
export function setLanguage(code: string | undefined): void {
  const next = code && LOCALES[code] ? code : "en"
  if (next === activeLanguage) return
  activeLanguage = next
  for (const cb of listeners) cb(next)
}

export function onChange(cb: (lang: string) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

const PARAM_RE = /\{\{(\w+)\}\}/g

/**
 * Translate a key with optional `{{param}}` interpolation. Looks up
 * the active locale first, then English, then returns the key itself
 * (so missing strings are loud, not blank).
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const value =
    LOCALES[activeLanguage]?.[key] ??
    LOCALES.en[key] ??
    key
  if (!params) return value
  return value.replace(PARAM_RE, (_, name: string) => {
    const v = params[name]
    return v === undefined ? `{{${name}}}` : String(v)
  })
}
