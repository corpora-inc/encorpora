import { describe, it, expect } from "vitest"
import { makeQuestLocalizer, literalQuestLocalizer } from "./questLocalize"
import { __QUEST_LOCALES_FOR_TEST as QL } from "../i18n/quests"
import type { Quest, QuestStep } from "@world-plaza/contracts"

const step: QuestStep = { id: "order", label: "Order a coffee" }
const quest = {
  id: "demo-localize",
  title: "Coffee on the Plaza",
  narrative: "Order a coffee.",
  steps: [step],
} as unknown as Quest

describe("makeQuestLocalizer — keyed copy with literal fallback", () => {
  it("falls back to the authored literal when the catalog has no entry", () => {
    const loc = makeQuestLocalizer("es")
    expect(loc.title(quest)).toBe("Coffee on the Plaza")
    expect(loc.narrative(quest)).toBe("Order a coffee.")
    expect(loc.stepLabel(quest, step)).toBe("Order a coffee")
  })

  it("prefers a catalog entry when present, in the requested locale", () => {
    QL.es = {
      "quest.demo-localize.title": "Café en la plaza",
      "quest.demo-localize.step.order": "Pide un café",
    }
    try {
      const loc = makeQuestLocalizer("es")
      expect(loc.title(quest)).toBe("Café en la plaza")
      expect(loc.stepLabel(quest, step)).toBe("Pide un café")
      // narrative still falls back (no es entry for it) — never blank.
      expect(loc.narrative(quest)).toBe("Order a coffee.")
      // a different locale with no entry → literal.
      expect(makeQuestLocalizer("fr").title(quest)).toBe("Coffee on the Plaza")
    } finally {
      delete QL.es
    }
  })

  it("empty/omitted locale renders the English source-of-truth (literals)", () => {
    expect(makeQuestLocalizer("").title(quest)).toBe("Coffee on the Plaza")
  })

  it("literalQuestLocalizer is the explicit identity (no catalog lookup)", () => {
    QL.es = { "quest.demo-localize.title": "Café en la plaza" }
    try {
      expect(literalQuestLocalizer.title(quest)).toBe("Coffee on the Plaza")
      expect(literalQuestLocalizer.stepLabel(quest, step)).toBe("Order a coffee")
    } finally {
      delete QL.es
    }
  })

  it("step label falls back to the step id when the label is empty", () => {
    const bare = { id: "x", label: "" } as QuestStep
    expect(makeQuestLocalizer("es").stepLabel(quest, bare)).toBe("x")
  })
})
