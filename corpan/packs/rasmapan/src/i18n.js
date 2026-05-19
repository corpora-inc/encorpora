/**
 * Rasmapan — host-i18next integration.
 *
 * Recycles corpan's i18next instance via the `window.__corpanI18n`
 * surface (exposed by corpan-app/src/i18n.ts). At module load,
 * registers per-language locale bundles into a `rasmapan`
 * namespace so `i18n.t("rasmapan:mode.letters")` resolves through
 * the same machinery that translates the rest of the host UI and
 * automatically picks up whenever the user changes their primary
 * language in corpan settings.
 *
 * The locale bundles live as JSON files under `./locales/<lang>.json`
 * and are inlined into the pack bundle at build time via Vite's
 * `import.meta.glob` (no runtime fetch).
 *
 * 51 corpan locales × ~19 keys each. Adding a new language is a
 * one-file drop in `./locales/`.
 */

const NAMESPACE = "rasmapan"

// `locales.generated.js` is rebuilt by `scripts/build-locales.mjs`
// from every JSON file under `src/locales/`. Using a generated
// static-import module instead of `import.meta.glob` because the
// glob form returns an empty object under Vite's library-mode
// IIFE build (verified empirically) — static imports always work.
import LOCALES from "./locales.generated.js"

// True i18next instance if the host exposed it. We register our
// resource bundles eagerly so the first `t()` call resolves.
let registered = false
const getI18n = () => {
  if (typeof window === "undefined") return null
  return window.__corpanI18n || null
}

const ensureRegistered = () => {
  if (registered) return
  const i18n = getI18n()
  if (!i18n || typeof i18n.addResourceBundle !== "function") return
  for (const [lang, bundle] of Object.entries(LOCALES)) {
    try {
      i18n.addResourceBundle(lang, NAMESPACE, bundle, true, true)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[rasmapan] addResourceBundle failed for", lang, err)
    }
  }
  registered = true
}

// English bundle is the universal fallback when:
//   (a) the host isn't available (e.g. browser preview without
//       window.__corpanI18n)
//   (b) the current language has no key the caller is asking for
const enFallback = LOCALES.en || {}

const lookupFromBundle = (bundle, key) => {
  if (!bundle) return undefined
  let cur = bundle
  for (const part of key.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined
    cur = cur[part]
  }
  return typeof cur === "string" ? cur : undefined
}

const interpolate = (template, params) => {
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    params[k] != null ? String(params[k]) : "",
  )
}

/**
 * Translate a Rasmapan UI string.
 *   t("mode.letters")
 *   t("lesson.step", { n: 2, total: 6 })
 *
 * Routes through `window.__corpanI18n.t("rasmapan:" + key)` when
 * available so language switching happens in lockstep with the
 * rest of corpan. Falls back to the English bundle on standalone
 * preview or any miss.
 */
export const t = (key, params) => {
  ensureRegistered()
  const i18n = getI18n()
  if (i18n && typeof i18n.t === "function") {
    const result = i18n.t(`${NAMESPACE}:${key}`, params || {})
    if (typeof result === "string" && result && result !== `${NAMESPACE}:${key}`) {
      return result
    }
  }
  // Standalone preview path or i18next miss — interpolate from
  // the English bundle directly.
  const en = lookupFromBundle(enFallback, key)
  if (en != null) return interpolate(en, params)
  return key
}

/**
 * Subscribe to the host's `languageChanged` event so callers can
 * re-render their chrome the moment the user picks a different
 * language in corpan settings. Returns an unsubscribe function.
 */
export const subscribeLanguageChanged = (handler) => {
  ensureRegistered()
  const i18n = getI18n()
  if (!i18n || typeof i18n.on !== "function") return () => {}
  i18n.on("languageChanged", handler)
  return () => {
    try {
      if (typeof i18n.off === "function") i18n.off("languageChanged", handler)
    } catch {
      /* no-op */
    }
  }
}

/** Currently-active i18next language. Returns the host's code with
 *  its original casing preserved (e.g. "zh-Hans", "pt-BR", "ko-polite"
 *  — i18next keeps the registered casing). Previously this was
 *  `.toLowerCase()`d, which silently broke mixed-case locales: every
 *  SQL `WHERE language_code IN (...)` lookup against the pack DB
 *  and every `lesson.i18n[<lang>]` JS object access is
 *  case-sensitive, so lowercasing turned `"zh-Hans"` into a key
 *  that doesn't exist. Falls back to `"en"` when standalone. */
export const currentLanguage = () => {
  const i18n = getI18n()
  return i18n && i18n.language ? i18n.language : "en"
}
