import { useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { ALL_LANGUAGES } from "@/store/settings"

/**
 * Best-effort match from `navigator.language` / `navigator.languages` to a
 * supported language code. Exact match first, then primary-subtag. Returns
 * null if no reasonable match. (Extracted verbatim from the original
 * OnboardingPickPrimary so the decision-graph engine can detect on entry.)
 */
export function detectPreferredLang(): string | null {
  if (typeof navigator === "undefined") return null
  const supported = ALL_LANGUAGES.map((l) => l.toLowerCase())
  const candidates = [navigator.language, ...(navigator.languages || [])]
    .filter((s): s is string => Boolean(s))
    .map((s) => s.toLowerCase())

  for (const c of candidates) {
    const hit = supported.indexOf(c)
    if (hit >= 0) return ALL_LANGUAGES[hit]
  }
  for (const c of candidates) {
    const prefix = c.split("-")[0]
    const hit = supported.findIndex(
      (s) => s === prefix || s.startsWith(prefix + "-")
    )
    if (hit >= 0) return ALL_LANGUAGES[hit]
  }
  return null
}

/**
 * Race-safe i18n language setter. `i18n.changeLanguage` is async and not
 * cancellable — if two applies are in flight, the late one can clobber the
 * user's pick. We track the latest desired language and re-apply if drift is
 * detected after a call settles, so the user's tap always wins.
 */
export function useApplyLang() {
  const { i18n } = useTranslation()
  const desiredLangRef = useRef<string | null>(null)
  return useCallback(
    async (code: string) => {
      desiredLangRef.current = code
      await i18n.changeLanguage(code)
      if (desiredLangRef.current && i18n.language !== desiredLangRef.current) {
        await i18n.changeLanguage(desiredLangRef.current)
      }
    },
    [i18n]
  )
}
