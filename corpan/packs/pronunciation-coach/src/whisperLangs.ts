/**
 * Whisper language capability layer.
 *
 * Pronunciation scoring runs on whisper (tauri-plugin-stt). Whisper only
 * recognizes a fixed ~99-language set; passing a code outside it makes
 * whisper silently fall back to English and score the user against
 * gibberish, so the native plugin (STTPlugin.swift / SttPlugin.kt) GUARDS
 * the call and rejects unsupported codes with a hard error. That rejection
 * is the right safety net, but it surfaces as a red "[UNSUPPORTED_LANGUAGE]"
 * error AFTER the user has already recorded — bad UX.
 *
 * This module mirrors whisper's supported set on the JS side so the pack can
 * gate gracefully BEFORE recording: never serve an unscorable language as a
 * target, and show a calm "not available yet" state when a stack has nothing
 * scorable.
 *
 * SOURCE OF TRUTH: keep `WHISPER_SUPPORTED` in sync with
 * `plugins/tauri-plugin-stt/ios/Sources/STTPlugin.swift` `Constants.languageCodes`
 * (the canonical list the native guard checks against).
 *
 * Two Corpán codes need attention:
 *   - `jv` (Javanese): whisper DOES support Javanese, but under the code `jw`.
 *     Corpán uses `jv`, so a raw base-split rejected it even though whisper
 *     could score it. The alias below recovers it.
 *   - `yue-Hant-HK` (Cantonese): whisper has no Cantonese code — it folds
 *     Cantonese into `zh` (Mandarin). Scoring Cantonese speech against the
 *     Mandarin model gives misleading per-word feedback, so it is left
 *     UNSUPPORTED on purpose (no alias).
 */

/** Whisper's recognized language codes (mirrors the native guard). */
export const WHISPER_SUPPORTED: ReadonlySet<string> = new Set([
  "af", "am", "ar", "as", "az", "ba", "be", "bg", "bn", "bo", "br", "bs",
  "ca", "cs", "cy", "da", "de", "el", "en", "es", "et", "eu", "fa", "fi",
  "fo", "fr", "gl", "gu", "ha", "haw", "he", "hi", "hr", "ht", "hu", "hy",
  "id", "is", "it", "ja", "jw", "ka", "kk", "km", "kn", "ko", "la", "lb",
  "ln", "lo", "lt", "lv", "mg", "mi", "mk", "ml", "mn", "mr", "ms", "mt",
  "my", "ne", "nl", "nn", "no", "oc", "pa", "pl", "ps", "pt", "ro", "ru",
  "sa", "sd", "si", "sk", "sl", "sn", "so", "sq", "sr", "su", "sv", "sw",
  "ta", "te", "tg", "th", "tk", "tl", "tr", "tt", "uk", "ur", "uz", "vi",
  "yi", "yo", "zh",
])

/**
 * Corpán base code → whisper code, where the two differ. Applied before the
 * base-split lookup. Only Javanese needs remapping today.
 */
export const WHISPER_ALIASES: Readonly<Record<string, string>> = {
  jv: "jw",
}

/** Collapse a Corpán code to its base (e.g. `pt-BR` → `pt`, `ko-polite` → `ko`). */
const baseOf = (code: string): string => code.split("-")[0].toLowerCase()

/**
 * Map a Corpán language code to the whisper code that scores it, or `null`
 * if whisper cannot score it. Empty input → `null`.
 */
export const toWhisperLang = (code: string): string | null => {
  if (!code) return null
  const base = baseOf(code)
  const mapped = WHISPER_ALIASES[base] ?? base
  return WHISPER_SUPPORTED.has(mapped) ? mapped : null
}

/** True when whisper can score pronunciation for this Corpán code. */
export const isWhisperSupported = (code: string): boolean =>
  toWhisperLang(code) !== null

/**
 * Whether a learning stack has at least one target language whisper can score.
 * Convention: `languages[0]` is the native/king language and `languages[1..]`
 * are the targets; a single-language stack practises that one language
 * directly, so it counts as a target too.
 */
export const stackHasScorableLang = (languages: string[]): boolean => {
  if (!languages || languages.length === 0) return false
  const targets = languages.length === 1 ? languages : languages.slice(1)
  return targets.some(isWhisperSupported)
}
