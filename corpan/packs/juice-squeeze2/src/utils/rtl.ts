/**
 * RTL language detection utilities
 */

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"])

/**
 * Detect if a language code is RTL
 */
export const isRTL = (langCode: string): boolean => {
  const base = langCode.split("-")[0].toLowerCase()
  return RTL_LANGUAGES.has(base)
}

/**
 * Get text direction for a language code
 */
export const getTextDirection = (langCode: string): "ltr" | "rtl" => {
  return isRTL(langCode) ? "rtl" : "ltr"
}
