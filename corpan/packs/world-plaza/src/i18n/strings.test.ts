import { describe, it, expect } from "vitest"
import {
  t,
  bindT,
  isRtl,
  dirFor,
  baseLocale,
  ALL_KEYS,
  SOURCE_EN,
  presentLocales,
  __LOCALES_FOR_TEST as LOCALES,
  type I18nKey,
} from "./strings"

const tokens = (s: string): string[] =>
  (s.match(/\{(\w+)\}/g) ?? []).sort()

describe("i18n catalog integrity", () => {
  it("every key has a non-empty English source string", () => {
    for (const key of ALL_KEYS) {
      const v = SOURCE_EN[key]
      expect(v, `en missing "${key}"`).toBeTruthy()
      expect(v.trim().length, `en "${key}" is blank`).toBeGreaterThan(0)
    }
  })

  it("no generated locale carries an orphan key (subset of en's keys)", () => {
    const known = new Set<string>(ALL_KEYS)
    for (const [loc, dict] of Object.entries(LOCALES)) {
      for (const key of Object.keys(dict)) {
        expect(known.has(key), `locale "${loc}" has orphan key "${key}"`).toBe(true)
      }
    }
  })

  it("every locale preserves each key's {placeholder} tokens", () => {
    for (const [loc, dict] of Object.entries(LOCALES)) {
      for (const key of Object.keys(dict) as I18nKey[]) {
        const want = tokens(SOURCE_EN[key])
        const got = tokens((dict as Record<I18nKey, string>)[key])
        expect(got, `locale "${loc}" key "${key}" dropped/added a token`).toEqual(want)
      }
    }
  })
})

describe("t() resolution", () => {
  it("returns English for an unknown / English locale", () => {
    expect(t("welcome.cta", "en")).toBe(SOURCE_EN["welcome.cta"])
    expect(t("welcome.cta", "xx")).toBe(SOURCE_EN["welcome.cta"]) // unknown → en
  })

  it("never returns blank — falls back per-key to English", () => {
    for (const key of ALL_KEYS) {
      for (const loc of ["en", "es", "ar", "zh-Hans", "pt-BR", "ko-polite"]) {
        expect(t(key, loc).length, `blank for ${key}@${loc}`).toBeGreaterThan(0)
      }
    }
  })

  it("collapses regional/variant codes to the base locale", () => {
    // zh-Hans → zh, pt-BR → pt, ko-polite → ko, pa-Guru → pa
    expect(baseLocale("zh-Hans")).toBe("zh")
    expect(baseLocale("pt-BR")).toBe("pt")
    expect(baseLocale("ko-polite")).toBe("ko")
    expect(baseLocale("pa-Guru")).toBe("pa")
    // A variant resolves the same as its base when the base locale is present.
    if (LOCALES["es"]) expect(t("welcome.cta", "es-419")).toBe(t("welcome.cta", "es"))
  })

  it("interpolates {token} params (and leaves unknown tokens intact)", () => {
    const out = t("welcome.titleNamed", "en", { name: "Koala" })
    expect(out).toContain("Koala")
    expect(out).not.toContain("{name}")
    // Missing param → token left intact (visible, not silently dropped).
    expect(t("welcome.titleNamed", "en")).toContain("{name}")
  })

  it("bindT binds one native locale", () => {
    const bt = bindT("en")
    expect(bt("menu.resume")).toBe(SOURCE_EN["menu.resume"])
  })
})

describe("RTL detection", () => {
  it("flags right-to-left natives", () => {
    for (const rtl of ["ar", "he", "fa", "ur", "ar-EG", "ur-PK"]) {
      expect(isRtl(rtl), `${rtl} should be RTL`).toBe(true)
      expect(dirFor(rtl)).toBe("rtl")
    }
  })
  it("treats LTR natives as ltr", () => {
    for (const ltr of ["en", "es", "ja", "zh", "ru", "ko-polite"]) {
      expect(isRtl(ltr), `${ltr} should be LTR`).toBe(false)
      expect(dirFor(ltr)).toBe("ltr")
    }
  })
})

// The full Corpán language set we COMMIT to shipping (mirror of
// tools/gen_i18n.py DEFAULT_LANGS). The freshness gate: every one of these must
// carry every key. `npm run check-translations` is the richer CI version (it also
// scans for un-keyed string leaks); this keeps the coverage half inside `npm test`.
const SHIPPED_LANGS = [
  "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fr",
  "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "mr", "ms",
  "ne", "nl", "no", "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv",
  "sw", "ta", "te", "th", "tr", "uk", "ur", "vi", "yue", "zh",
]

describe("seed coverage (freshness gate)", () => {
  it("ships English + the full Corpán language set", () => {
    expect(presentLocales()).toContain("en")
    expect(presentLocales().length).toBeGreaterThanOrEqual(SHIPPED_LANGS.length)
  })

  it("EVERY shipped locale carries EVERY key (a new unseeded key fails here)", () => {
    const present = new Set(presentLocales())
    const missingLocales = SHIPPED_LANGS.filter((l) => !present.has(l))
    expect(missingLocales, `locales not seeded: ${missingLocales.join(", ")}`).toEqual([])
    for (const loc of SHIPPED_LANGS) {
      const dict = LOCALES[loc] ?? {}
      const missingKeys = ALL_KEYS.filter((k) => !(k in dict))
      expect(missingKeys, `[${loc}] missing keys: ${missingKeys.join(", ")}`).toEqual([])
    }
  })
})
