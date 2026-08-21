/**
 * RTL (right-to-left) language detection for Juice Squeeze (Fire rebuild).
 *
 * Ported VERBATIM from the shipped pack's game.ts (~line 2154). The store does
 * NOT use this — RTL is a DOM-layout concern. The UI layer uses isRTL() to
 * decide how to flatten the placed blocks into reading order before calling
 * the store's checkWin().
 */

/**
 * Raw set of language codes that read right-to-left.
 * Matches the shipped pack exactly.
 */
export const RTL_LANGUAGES = ["ar", "fa", "ur", "he", "pa-Arab"] as const

/**
 * Check if a language code is RTL (right-to-left).
 * Verbatim from game.ts: exact-string membership in RTL_LANGUAGES.
 */
export const isRTL = (lang: string): boolean => {
  return (RTL_LANGUAGES as readonly string[]).includes(lang)
}
