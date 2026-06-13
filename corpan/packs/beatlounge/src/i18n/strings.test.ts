import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { SOURCE_EN, ALL_KEYS, presentLocales, __LOCALES_FOR_TEST, setUiLang, ct } from "./strings"

/** The locales beatlounge ships chrome in (matches the app's catalog set). */
const SHIPPED = [
  "ar","bg","bn","ca","cs","da","de","el","es","fa","fi","fr","gu","he","hi","hr",
  "hu","id","it","ja","kn","ko-polite","lt","mr","ms","ne","nl","no","pa-Arab","pa-Guru",
  "pl","pt-BR","pt-PT","ro","ru","sk","sl","sr","sv","sw","ta","te","th","tr","uk","ur",
  "vi","yue-Hant-HK","zh-Hans","zh-Hant",
]

const tokens = (s: string): string[] => (s.match(/\{(\w+)\}/g) ?? []).sort()

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..")
/** Every static ct("key") used anywhere in src/ (excludes the i18n dir + tests). */
const usedKeys = (): Set<string> => {
  const out = new Set<string>()
  const re = /\bct\(\s*["'`]([^"'`]+)["'`]/g
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name)
      const st = statSync(p)
      if (st.isDirectory()) {
        if (name === "i18n" || name === "node_modules" || name === "dist") continue
        walk(p)
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
        const txt = readFileSync(p, "utf-8")
        let m: RegExpExecArray | null
        while ((m = re.exec(txt))) out.add(m[1])
      }
    }
  }
  walk(SRC)
  return out
}

describe("beatlounge i18n catalog", () => {
  it("every English source key is non-empty", () => {
    for (const k of ALL_KEYS) {
      expect(typeof SOURCE_EN[k]).toBe("string")
      expect(SOURCE_EN[k].trim().length).toBeGreaterThan(0)
    }
  })

  it("every ct(\"key\") used in the code has an English source", () => {
    const known = new Set(ALL_KEYS)
    const missing = [...usedKeys()].filter((k) => !known.has(k))
    expect(missing).toEqual([])
  })

  it("no generated locale carries an orphan key", () => {
    const known = new Set(ALL_KEYS)
    for (const [, dict] of Object.entries(__LOCALES_FOR_TEST)) {
      for (const k of Object.keys(dict)) expect(known.has(k)).toBe(true)
    }
  })

  it("every locale value preserves its English {placeholder} tokens", () => {
    for (const [, dict] of Object.entries(__LOCALES_FOR_TEST)) {
      for (const [k, v] of Object.entries(dict)) {
        if (typeof v === "string") expect(tokens(v)).toEqual(tokens(SOURCE_EN[k] ?? ""))
      }
    }
  })

  it("ct() resolves the ambient locale (exact variant first) and falls back to English", () => {
    const K = "drums.title"
    setUiLang("es")
    expect(ct(K)).toBe(__LOCALES_FOR_TEST["es"]?.[K])
    setUiLang("zh-Hant") // exact regional variant, NOT collapsed to a base "zh"
    expect(ct(K)).toBe(__LOCALES_FOR_TEST["zh-Hant"]?.[K])
    setUiLang("es-MX") // collapses to the base "es"
    expect(ct(K)).toBe(__LOCALES_FOR_TEST["es"]?.[K])
    setUiLang("xx-unknown") // no locale → English source
    expect(ct(K)).toBe(SOURCE_EN[K])
    setUiLang("en")
    expect(ct(K)).toBe(SOURCE_EN[K])
  })

  it("ships English + every locale in the Corpán set with broad coverage", () => {
    const present = new Set(presentLocales())
    expect(present.has("en")).toBe(true)
    const missingLocales = SHIPPED.filter((l) => !present.has(l))
    expect(missingLocales).toEqual([])
    // Each shipped locale covers nearly all keys (a few may fall back to English).
    for (const loc of SHIPPED) {
      const dict = __LOCALES_FOR_TEST[loc] ?? {}
      const coverage = Object.keys(dict).length / ALL_KEYS.length
      expect(coverage).toBeGreaterThan(0.9)
    }
  })
})
