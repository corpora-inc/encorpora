// Canonical language config for the quest-ear NPC corpus.
// Order mirrors corpan's ALL_LANGUAGES (corpan-app/src/store/settings.ts).

export const CANONICAL_ORDER = [
  "en", "es", "ca", "fr", "it", "ro", "pt-PT", "pt-BR", "de", "nl",
  "no", "sv", "da", "fi", "hu", "lt", "pl", "cs", "sk", "sl",
  "hr", "sr", "bg", "uk", "ru", "el", "tr", "he", "ar", "fa",
  "ur", "pa-Arab", "pa-Guru", "hi", "ne", "bn", "mr", "gu", "kn", "te",
  "ta", "th", "vi", "id", "ms", "sw", "zh-Hans", "zh-Hant", "yue-Hant-HK",
  "ko-polite", "ja",
]

// Languages already present in the corpus (after the ko -> ko-polite rekey).
export const EXISTING = [
  "en", "es", "fr", "it", "pt-BR", "de", "hu", "pl", "ru", "tr",
  "ar", "fa", "ur", "hi", "bn", "mr", "gu", "kn", "te", "ta",
  "th", "vi", "id", "zh-Hans", "zh-Hant", "ko-polite", "ja",
]

// Languages we must generate translations for (24).
export const NEW = [
  "ca", "ro", "pt-PT", "nl", "no", "sv", "da", "fi", "lt", "cs",
  "sk", "sl", "hr", "sr", "bg", "uk", "el", "he", "pa-Arab", "pa-Guru",
  "ne", "ms", "sw", "yue-Hant-HK",
]

// Source key in the existing corpus that must be renamed to the canonical code.
export const REKEY = { ko: "ko-polite" }

export const LANG_NAMES = {
  en: "English", es: "Spanish", ca: "Catalan", fr: "French", it: "Italian",
  ro: "Romanian", "pt-PT": "Portuguese (European)", "pt-BR": "Portuguese (Brazil)",
  de: "German", nl: "Dutch", no: "Norwegian", sv: "Swedish", da: "Danish",
  fi: "Finnish", hu: "Hungarian", lt: "Lithuanian", pl: "Polish", cs: "Czech",
  sk: "Slovak", sl: "Slovenian", hr: "Croatian", sr: "Serbian", bg: "Bulgarian",
  uk: "Ukrainian", ru: "Russian", el: "Greek", tr: "Turkish", he: "Hebrew",
  ar: "Arabic", fa: "Persian", ur: "Urdu", "pa-Arab": "Punjabi (Shahmukhi)",
  "pa-Guru": "Punjabi (Gurmukhi)", hi: "Hindi", ne: "Nepali", bn: "Bengali",
  mr: "Marathi", gu: "Gujarati", kn: "Kannada", te: "Telugu", ta: "Tamil",
  th: "Thai", vi: "Vietnamese", id: "Indonesian", ms: "Malay", sw: "Swahili",
  "zh-Hans": "Chinese (Simplified)", "zh-Hant": "Chinese (Traditional)",
  "yue-Hant-HK": "Cantonese (Traditional)", "ko-polite": "Korean (polite)",
  ja: "Japanese",
}

if (CANONICAL_ORDER.length !== 51) {
  throw new Error(`CANONICAL_ORDER must be 51, got ${CANONICAL_ORDER.length}`)
}
