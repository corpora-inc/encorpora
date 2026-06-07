import { describe, it, expect } from "vitest"
import {
  questString,
  hasQuestString,
  questTitleKey,
  questNarrativeKey,
  questStepKey,
  specialNameKey,
  presentQuestLocales,
  __QUEST_LOCALES_FOR_TEST as QL,
} from "./quests"

describe("quest string key derivation", () => {
  it("derives stable keys from quest/step/anchor ids", () => {
    expect(questTitleKey("es-cafe-travel")).toBe("quest.es-cafe-travel.title")
    expect(questNarrativeKey("es-cafe-travel")).toBe("quest.es-cafe-travel.narrative")
    expect(questStepKey("es-cafe-travel", "order-coffee")).toBe(
      "quest.es-cafe-travel.step.order-coffee",
    )
    expect(specialNameKey("es-cafe-travel", "plaza")).toBe("special.es-cafe-travel.plaza.name")
  })
})

describe("questString resolver — literal fallback is the contract", () => {
  it("falls back to the authored literal when the catalog has no entry (never blank)", () => {
    // Catalog is empty today → every quest renders via its JSON literal.
    expect(questString("quest.x.title", "es", "Coffee on the Plaza")).toBe("Coffee on the Plaza")
    expect(questString("quest.x.title", "ar", "Coffee on the Plaza")).toBe("Coffee on the Plaza")
  })

  it("prefers a catalog entry when present, collapsing variants", () => {
    // Seed a temporary entry to prove resolution + variant collapse.
    QL.es = { "quest.demo.title": "Café en la plaza" }
    try {
      expect(questString("quest.demo.title", "es", "LITERAL")).toBe("Café en la plaza")
      expect(questString("quest.demo.title", "es-419", "LITERAL")).toBe("Café en la plaza") // collapse
      expect(hasQuestString("quest.demo.title", "es")).toBe(true)
      expect(hasQuestString("quest.demo.title", "fr")).toBe(false)
      // unknown locale → literal fallback, never blank
      expect(questString("quest.demo.title", "zz", "LITERAL")).toBe("LITERAL")
    } finally {
      delete QL.es
    }
  })

  it("interpolates {token} params and preserves unknown tokens", () => {
    expect(questString("quest.x.n", "en", "Step {n}", { n: 3 })).toBe("Step 3")
    expect(questString("quest.x.n", "en", "Step {n}")).toBe("Step {n}")
  })

  it("English is always a present locale", () => {
    expect(presentQuestLocales()).toContain("en")
  })
})
