/**
 * beatlounge — phrase-discovery: human label for a BCP-47-ish language code.
 *
 * Discovery shows ONE row per stack language, so each row needs a readable
 * label ("Spanish", "日本語"…). We use `Intl.DisplayNames` when present (modern
 * WebViews) to localize the language name, falling back to the bare uppercased
 * code on older runtimes / unknown codes. Pure, dependency-free, testable.
 */

type DisplayNamesCtor = new (
  locales?: string | string[],
  opts?: { type?: "language"; fallback?: "code" | "none" }
) => { of(code: string): string | undefined }

const getDisplayNames = (): DisplayNamesCtor | null => {
  const intl = (globalThis as { Intl?: { DisplayNames?: DisplayNamesCtor } }).Intl
  return intl && typeof intl.DisplayNames === "function" ? intl.DisplayNames : null
}

/** Strip a region/script subtag for DisplayNames lookup but keep the original
 *  for display fallback (so "zh-hant" → tries "zh-hant", then "zh"). */
const candidates = (code: string): string[] => {
  const c = code.trim()
  if (!c) return []
  const base = c.split("-")[0]
  return base && base !== c ? [c, base] : [c]
}

/**
 * Readable label for a language code, e.g. "es" → "Spanish".
 * `displayLocale` controls the OUTPUT language of the name (default: the user's
 * native, so labels read in their own language). Always returns a non-empty
 * string — the uppercased code if nothing else resolves.
 */
export const languageLabel = (code: string, displayLocale?: string): string => {
  const raw = (code ?? "").trim()
  if (!raw) return ""
  const Ctor = getDisplayNames()
  if (Ctor) {
    try {
      const dn = new Ctor(displayLocale || undefined, { type: "language", fallback: "none" })
      for (const cand of candidates(raw)) {
        const label = dn.of(cand)
        if (label && label !== cand) return label
      }
    } catch {
      /* unsupported locale/code — fall through to the code */
    }
  }
  return raw.toUpperCase()
}
