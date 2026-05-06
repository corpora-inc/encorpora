/**
 * Map Corpan BCP-47-ish language codes to Radio Browser API language names.
 *
 * Radio Browser indexes stations by free-text language strings (lowercase English
 * names from ISO 639-2). Corpan codes are tighter (script + variant aware), so we
 * pick the broadest matching name and the radio API filters down via station counts.
 *
 * Notes:
 * - `ko-polite` collapses to "korean" (politeness is Corpan-specific, irrelevant for radio).
 * - Both Punjabi scripts collapse to "punjabi".
 * - `zh-Hans` → "chinese" is the most-indexed string in Radio Browser; "mandarin"
 *   alone returns far fewer results because operators tag inconsistently.
 * - `pt-BR` → "portuguese" — Brazilian/European are not consistently tagged.
 */

export type CorpanLanguageCode =
  | "en" | "es" | "fr" | "it" | "pt-BR" | "de" | "pl" | "ru" | "hu" | "tr"
  | "ar" | "fa" | "ur" | "pa-Arab" | "pa-Guru"
  | "hi" | "bn" | "mr" | "gu" | "kn" | "te" | "ta"
  | "th" | "vi" | "id"
  | "zh-Hans" | "zh-Hant" | "yue-Hant-HK"
  | "ko-polite" | "ja"
  | "sw" | "he" | "el" | "my" | "km"

export const LANGUAGE_DISPLAY: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  it: "Italian",
  "pt-BR": "Portuguese",
  de: "German",
  pl: "Polish",
  ru: "Russian",
  hu: "Hungarian",
  tr: "Turkish",
  ar: "Arabic",
  fa: "Persian",
  ur: "Urdu",
  "pa-Arab": "Punjabi (Shahmukhi)",
  "pa-Guru": "Punjabi (Gurmukhi)",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  te: "Telugu",
  ta: "Tamil",
  th: "Thai",
  vi: "Vietnamese",
  id: "Indonesian",
  "zh-Hans": "Mandarin",
  "zh-Hant": "Mandarin (Trad.)",
  "yue-Hant-HK": "Cantonese",
  "ko-polite": "Korean",
  ja: "Japanese",
  sw: "Swahili",
  he: "Hebrew",
  el: "Greek",
  my: "Burmese",
  km: "Khmer",
}

const TO_RADIO: Record<string, string> = {
  en: "english",
  es: "spanish",
  fr: "french",
  it: "italian",
  "pt-BR": "portuguese",
  de: "german",
  pl: "polish",
  ru: "russian",
  hu: "hungarian",
  tr: "turkish",
  ar: "arabic",
  fa: "persian",
  ur: "urdu",
  "pa-Arab": "punjabi",
  "pa-Guru": "punjabi",
  hi: "hindi",
  bn: "bengali",
  mr: "marathi",
  gu: "gujarati",
  kn: "kannada",
  te: "telugu",
  ta: "tamil",
  th: "thai",
  vi: "vietnamese",
  id: "indonesian",
  "zh-Hans": "chinese",
  "zh-Hant": "chinese",
  "yue-Hant-HK": "cantonese",
  "ko-polite": "korean",
  ja: "japanese",
  sw: "swahili",
  he: "hebrew",
  el: "greek",
  my: "burmese",
  km: "khmer",
}

export function corpanToRadioLanguage(code: string): string | null {
  return TO_RADIO[code] ?? null
}

export function displayName(code: string): string {
  return LANGUAGE_DISPLAY[code] ?? code
}

export const ALL_CORPAN_LANGUAGES: string[] = Object.keys(LANGUAGE_DISPLAY)

/**
 * Reverse lookup: given a Radio Browser station's `language` (free-text,
 * comma-separated English names) and `languagecodes` (comma-separated ISO 639
 * codes), pick the most appropriate Corpan language code to navigate to.
 *
 * If `stack` is provided, prefer codes the user is currently learning so
 * "Show in list" lands on a familiar entry instead of a random match.
 *
 * Returns null if no Corpan language matches — caller falls back to staying
 * on the global map.
 */
export function resolveCorpanCodeForStation(
  station: { language?: string; languagecodes?: string },
  stack: string[] = []
): string | null {
  const names = (station.language ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const isos = (station.languagecodes ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

  const candidates: string[] = []
  for (const code of ALL_CORPAN_LANGUAGES) {
    const radioName = TO_RADIO[code]
    if (!radioName) continue
    if (names.includes(radioName)) {
      candidates.push(code)
      continue
    }
    const iso = code.toLowerCase().split("-")[0]
    if (iso && isos.includes(iso)) candidates.push(code)
  }
  if (candidates.length === 0) return null

  for (const s of stack) {
    if (candidates.includes(s)) return s
  }
  return candidates[0]
}
