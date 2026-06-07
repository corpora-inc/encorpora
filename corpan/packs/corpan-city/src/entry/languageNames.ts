/**
 * languageNames — readable language labels for the entry welcome + chooser.
 *
 * `src/npc/promptProgram.ts` has a tiny `languageName()` (7 langs) tuned for the
 * LLM prompt; the chooser needs the FULL Corpán roster (51 languages / 52 scripts)
 * with endonyms so a learner recognizes their own language. This is the entry
 * slice's own map (we own `src/entry/*`); it deliberately does not touch the npc
 * one. Unknown codes fall back to the raw code (never a blank chip).
 */

/** English name + native endonym for each supported language code. */
interface LangLabel {
  /** English name (the UI usually reads in the user's primary, but English is a safe glance). */
  en: string
  /** Endonym — the language's own name, shown as the prominent line. */
  native: string
  /** A short two/three-letter glyph for the flag-less lozenge. */
  tag: string
}

const TABLE: Record<string, LangLabel> = {
  en: { en: "English", native: "English", tag: "EN" },
  es: { en: "Spanish", native: "Español", tag: "ES" },
  fr: { en: "French", native: "Français", tag: "FR" },
  de: { en: "German", native: "Deutsch", tag: "DE" },
  it: { en: "Italian", native: "Italiano", tag: "IT" },
  pt: { en: "Portuguese", native: "Português", tag: "PT" },
  "pt-BR": { en: "Portuguese (Brazil)", native: "Português do Brasil", tag: "PT" },
  nl: { en: "Dutch", native: "Nederlands", tag: "NL" },
  sv: { en: "Swedish", native: "Svenska", tag: "SV" },
  no: { en: "Norwegian", native: "Norsk", tag: "NO" },
  da: { en: "Danish", native: "Dansk", tag: "DA" },
  fi: { en: "Finnish", native: "Suomi", tag: "FI" },
  is: { en: "Icelandic", native: "Íslenska", tag: "IS" },
  pl: { en: "Polish", native: "Polski", tag: "PL" },
  cs: { en: "Czech", native: "Čeština", tag: "CS" },
  sk: { en: "Slovak", native: "Slovenčina", tag: "SK" },
  sl: { en: "Slovenian", native: "Slovenščina", tag: "SL" },
  lt: { en: "Lithuanian", native: "Lietuvių", tag: "LT" },
  uk: { en: "Ukrainian", native: "Українська", tag: "UK" },
  ru: { en: "Russian", native: "Русский", tag: "RU" },
  bg: { en: "Bulgarian", native: "Български", tag: "BG" },
  sr: { en: "Serbian", native: "Српски", tag: "SR" },
  "sr-Latn": { en: "Serbian (Latin)", native: "Srpski", tag: "SR" },
  hr: { en: "Croatian", native: "Hrvatski", tag: "HR" },
  ro: { en: "Romanian", native: "Română", tag: "RO" },
  el: { en: "Greek", native: "Ελληνικά", tag: "EL" },
  hu: { en: "Hungarian", native: "Magyar", tag: "HU" },
  tr: { en: "Turkish", native: "Türkçe", tag: "TR" },
  ca: { en: "Catalan", native: "Català", tag: "CA" },
  ga: { en: "Irish", native: "Gaeilge", tag: "GA" },
  cy: { en: "Welsh", native: "Cymraeg", tag: "CY" },
  ar: { en: "Arabic", native: "العربية", tag: "AR" },
  he: { en: "Hebrew", native: "עברית", tag: "HE" },
  fa: { en: "Persian", native: "فارسی", tag: "FA" },
  ur: { en: "Urdu", native: "اردو", tag: "UR" },
  hi: { en: "Hindi", native: "हिन्दी", tag: "HI" },
  ne: { en: "Nepali", native: "नेपाली", tag: "NE" },
  bn: { en: "Bengali", native: "বাংলা", tag: "BN" },
  pa: { en: "Punjabi", native: "ਪੰਜਾਬੀ", tag: "PA" },
  "pa-Arab": { en: "Punjabi (Shahmukhi)", native: "پنجابی", tag: "PA" },
  ta: { en: "Tamil", native: "தமிழ்", tag: "TA" },
  te: { en: "Telugu", native: "తెలుగు", tag: "TE" },
  ml: { en: "Malayalam", native: "മലയാളം", tag: "ML" },
  kn: { en: "Kannada", native: "ಕನ್ನಡ", tag: "KN" },
  gu: { en: "Gujarati", native: "ગુજરાતી", tag: "GU" },
  mr: { en: "Marathi", native: "मराठी", tag: "MR" },
  th: { en: "Thai", native: "ไทย", tag: "TH" },
  vi: { en: "Vietnamese", native: "Tiếng Việt", tag: "VI" },
  id: { en: "Indonesian", native: "Bahasa Indonesia", tag: "ID" },
  ms: { en: "Malay", native: "Bahasa Melayu", tag: "MS" },
  tl: { en: "Filipino", native: "Filipino", tag: "TL" },
  zh: { en: "Chinese", native: "中文", tag: "中" },
  "zh-Hans": { en: "Chinese (Simplified)", native: "简体中文", tag: "中" },
  "zh-Hant": { en: "Chinese (Traditional)", native: "繁體中文", tag: "中" },
  yue: { en: "Cantonese", native: "粵語", tag: "粵" },
  ja: { en: "Japanese", native: "日本語", tag: "日" },
  ko: { en: "Korean", native: "한국어", tag: "한" },
  "ko-polite": { en: "Korean (Polite)", native: "한국어", tag: "한" },
  sw: { en: "Swahili", native: "Kiswahili", tag: "SW" },
  am: { en: "Amharic", native: "አማርኛ", tag: "AM" },
}

/** A best-effort tag for an unknown code: first two letters, upper-cased. */
function fallbackTag(code: string): string {
  return code.slice(0, 2).toUpperCase()
}

/** The endonym (the language's own name) for a code, falling back to the code. */
export function nativeName(code: string): string {
  return TABLE[code]?.native ?? code
}

/** The English name for a code, falling back to the code. */
export function englishName(code: string): string {
  return TABLE[code]?.en ?? code
}

/** A short lozenge tag ("ES", "日") for a code. */
export function langTag(code: string): string {
  return TABLE[code]?.tag ?? fallbackTag(code)
}

/** Both names, useful for "Español · Spanish" lines. Dedupes if identical. */
export function bilabel(code: string): { primary: string; secondary?: string } {
  const l = TABLE[code]
  if (!l) return { primary: code }
  if (l.native === l.en) return { primary: l.native }
  return { primary: l.native, secondary: l.en }
}
