/**
 * getNativeLanguageName — code → native language name, ported VERBATIM from the
 * shipped pack (game.ts ~1147). Used for the build-language label under the
 * target phrase (shows e.g. "español" / "日本語" instead of a raw code). Falls
 * back to the raw code when unmapped.
 */
const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  es: "español",
  fr: "français",
  it: "italiano",
  "pt-BR": "português",
  de: "Deutsch",
  pl: "polski",
  ru: "русский",
  hu: "magyar",
  tr: "Türkçe",
  ar: "العربية",
  fa: "فارسی",
  hi: "हिन्दी",
  bn: "বাংলা",
  th: "ไทย",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  "zh-Hans": "中文",
  "zh-Hant": "中文",
  "ko-polite": "한국어",
  ja: "日本語",
  ta: "தமிழ்",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
  mr: "मराठी",
  gu: "ગુજરાતી",
  "pa-Guru": "ਪੰਜਾਬੀ",
  "pa-Arab": "پنجابی",
  ur: "اردو",
}

export function getNativeLanguageName(code: string): string {
  return NATIVE_NAMES[code] || code
}
