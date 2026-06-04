import { describe, it, expect } from "vitest"
import type { LanguageCode } from "@world-plaza/contracts"
import { isCrossLanguageTool } from "./registry"
import { entryPair, type ChallengeEntry } from "./host"

/**
 * #27 — cross-language (translation / matching) challenges must ALWAYS keep BOTH
 * languages, even under immersion. Collapsing both halves to the target makes a
 * tautology with no answer ("where is the Arabic I'm matching TO?").
 *
 * The orchestrator's rule (game.ts): for a cross-language tool with native ≠
 * target, `ChallengeContext.nativeLanguage = learnerPair.native` REGARDLESS of the
 * immersion resolver (which would otherwise return undefined under immersion).
 * These tests lock the two halves of that rule: the tool classification, and the
 * entryPair behaviour that proves "native kept" → two distinct sides vs "native
 * dropped" → tautology.
 */

const AR = "ar" as LanguageCode
const EN = "en" as LanguageCode

/** An AR-target / EN-native corpus entry (the owner's AR-from-EN immersion case). */
const entry: ChallengeEntry = {
  entry_id: 1,
  level: "A1",
  domains: ["travel"],
  source: "test",
  translations: [
    { language_code: "ar", text: "أرى النجمة", romanization: "ara an-najma" },
    { language_code: "en", text: "I see the star", romanization: "" },
  ],
}

describe("#27 — cross-language tool classification", () => {
  it("flags the translation/matching tools (incl. legacy aliases)", () => {
    for (const id of ["fast-translate", "tap-translation", "listen-choose-pic", "memory-pairs", "true-false", "category-sort", "picture-match"] as const) {
      expect(isCrossLanguageTool(id), id).toBe(true)
    }
    // Legacy aliases resolve to their cross-language canonical id.
    expect(isCrossLanguageTool("translate-fast")).toBe(true)
    expect(isCrossLanguageTool("listen-choose")).toBe(true)
  })

  it("does NOT flag monolingual target-only drills", () => {
    for (const id of ["say-it-back", "read-aloud", "word-scramble", "odd-one-out", "rhyme-match", "dialogue-fill", "repeat-after"] as const) {
      expect(isCrossLanguageTool(id), id).toBe(false)
    }
  })
})

describe("#27 — entryPair keeps two DISTINCT sides when native is supplied", () => {
  it("with native=en the two sides differ (a real match has an answer)", () => {
    const p = entryPair(entry, AR, EN)
    expect(p).not.toBeNull()
    expect(p!.target).toBe("أرى النجمة")
    expect(p!.native).toBe("I see the star")
    expect(p!.native).not.toBe(p!.target) // ← NOT a tautology
  })

  it("dropping native (immersion-collapsed) IS the tautology this fix prevents", () => {
    // This is the BAD state the orchestrator must avoid for cross-language tools:
    // no native → both sides collapse to the Arabic, nothing to match TO.
    const collapsed = entryPair(entry, AR, undefined)
    expect(collapsed!.target).toBe("أرى النجمة")
    expect(collapsed!.native).toBe("أرى النجمة") // tautology — proves why #27 matters
    // The fix keeps the native, so the SHOWN pair is the distinct one above.
  })
})
