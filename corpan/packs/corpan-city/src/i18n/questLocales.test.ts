/**
 * #112 — quest TITLE/DESCRIPTION localization freshness gate.
 *
 * The quest-content catalog (`quests.ts`) mirrors the chrome catalog (`strings.ts`):
 * an `en` source-of-truth + a generated block of ~46 ship locales, resolved by
 * `questString` with a literal fallback. This test is the freshness gate — the
 * SAME shape as `strings.test.ts`: every shipped locale must carry every quest key,
 * and every locale must be a real (non-empty) translation. A newly-added quest key
 * that wasn't regenerated fails HERE (loudly), not silently in the field.
 */
import { describe, it, expect } from "vitest"
import {
  questString,
  ALL_QUEST_KEYS,
  SOURCE_QUEST_EN,
  presentQuestLocales,
  questTitleKey,
  __QUEST_LOCALES_FOR_TEST as LOCALES,
} from "./quests"

// Mirror of tools/gen_i18n.py DEFAULT_LANGS (the full Corpán ship set).
const SHIPPED_LANGS = [
  "ar", "bg", "bn", "ca", "cs", "da", "de", "el", "es", "fa", "fi", "fr",
  "gu", "he", "hi", "hr", "hu", "id", "it", "ja", "ko", "lt", "mr", "ms",
  "ne", "nl", "no", "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sr", "sv",
  "sw", "ta", "te", "th", "tr", "uk", "ur", "vi", "yue", "zh",
]

describe("quest i18n catalog integrity", () => {
  it("every quest key has a non-empty English source string", () => {
    for (const key of ALL_QUEST_KEYS) {
      expect(SOURCE_QUEST_EN[key], `en[${key}]`).toBeTruthy()
      expect(SOURCE_QUEST_EN[key].trim().length, `en[${key}] non-empty`).toBeGreaterThan(0)
    }
  })

  it("covers every quest's title + narrative + steps (derived keys present)", () => {
    // The 18 quests × (title + narrative + steps). A representative spot-check that
    // the derived keys are authored — the full count is asserted by the freshness
    // gate below (every locale carries every key).
    expect(ALL_QUEST_KEYS).toContain(questTitleKey("plaza-cafe-order"))
    expect(ALL_QUEST_KEYS).toContain(questTitleKey("civic-clinic"))
    expect(ALL_QUEST_KEYS.length).toBeGreaterThanOrEqual(60)
  })
})

describe("quest i18n freshness gate (#112)", () => {
  it("ships English + the full Corpán language set", () => {
    expect(presentQuestLocales()).toContain("en")
    expect(presentQuestLocales().length).toBeGreaterThanOrEqual(SHIPPED_LANGS.length + 1)
  })

  it("EVERY shipped locale carries EVERY quest key (a new unseeded key fails here)", () => {
    const present = new Set(presentQuestLocales())
    const missingLocales = SHIPPED_LANGS.filter((l) => !present.has(l))
    expect(missingLocales, `quest locales not seeded: ${missingLocales.join(", ")}`).toEqual([])
    for (const loc of SHIPPED_LANGS) {
      const dict = LOCALES[loc] ?? {}
      const missingKeys = ALL_QUEST_KEYS.filter((k) => !(k in dict))
      expect(missingKeys, `[${loc}] missing quest keys: ${missingKeys.slice(0, 5).join(", ")}`).toEqual([])
    }
  })

  it("each non-English locale's values are non-empty strings", () => {
    for (const loc of SHIPPED_LANGS) {
      const dict = LOCALES[loc] ?? {}
      for (const k of ALL_QUEST_KEYS) {
        const v = dict[k]
        if (v === undefined) continue // covered by the gate above
        expect(typeof v, `[${loc}] ${k} type`).toBe("string")
        expect(v.trim().length, `[${loc}] ${k} non-empty`).toBeGreaterThan(0)
      }
    }
  })

  it("resolves a localized title for a non-English native, not the English literal", () => {
    // es is always generated; the café title must come back in Spanish (not the EN
    // literal fallback). Proves the render path actually localizes.
    const key = questTitleKey("plaza-cafe-order")
    const enLiteral = SOURCE_QUEST_EN[key]
    const es = questString(key, "es", enLiteral)
    expect(es).toBeTruthy()
    expect(es).not.toBe(enLiteral) // a real Spanish translation, not the English literal
  })

  it("falls back to the authored literal for an un-shipped locale (never blank)", () => {
    expect(questString("quest.zzz.title", "zz", "Some Quest")).toBe("Some Quest")
  })
})

describe("immersion flips quest content native↔target (#112 addendum)", () => {
  // The immersion resolver computes uiLocale = hideNative ? target : native, and
  // game.ts `relocalize` rebuilds the quest localizer with it on every flip. Proving
  // native↔target resolution at the catalog level proves the flip: the SAME quest
  // key resolves to NATIVE copy at the native locale and TARGET copy at the target
  // locale (immersion ON). For an en-native / es-target pair:
  const KEY = questTitleKey("plaza-cafe-order")
  const enLiteral = SOURCE_QUEST_EN[KEY]

  it("immersion OFF → native (en); immersion ON → target (es) — and they differ", () => {
    const native = questString(KEY, "en", enLiteral) // OFF → uiLocale = native = en
    const target = questString(KEY, "es", enLiteral) // ON  → uiLocale = target = es
    expect(native).toBe(enLiteral) // native English source
    expect(target).toBeTruthy()
    expect(target).not.toBe(native) // a real Spanish flip, not the English copy
  })

  it("a non-Latin target (ar) also flips into its own script", () => {
    const ar = questString(KEY, "ar", enLiteral)
    expect(ar).toBeTruthy()
    expect(ar).not.toBe(enLiteral)
    expect(ar, "Arabic copy should be in Arabic script").toMatch(/[؀-ۿ]/)
  })

  // The special-NPC NAME keys (content/npc/special.json nameKeys) localize through
  // the SAME resolver, so the objective NPC's name flips native↔target everywhere
  // (capsule/section/tracker/map) via the shared anchorName helper. #112 addendum.
  it("special-NPC names are keyed + localize native↔target (the anchorName feed)", () => {
    const k = "special.cafe.plaza.name"
    expect(ALL_QUEST_KEYS).toContain(k) // keyed in en + the gen set (freshness gate covers all 46)
    const en = questString(k, "en", "the café host")
    const es = questString(k, "es", "the café host")
    expect(en).toBe("the café host") // native (immersion OFF)
    expect(es).toBeTruthy()
    expect(es).not.toBe(en) // target flip (immersion ON) — a real Spanish name
  })
})
