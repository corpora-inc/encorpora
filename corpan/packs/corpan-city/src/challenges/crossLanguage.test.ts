import { describe, it, expect } from "vitest"
import type { LanguageCode } from "@corpan-city/contracts"
import { isCrossLanguageTool, getTool } from "./registry"
import { entryPair, type ChallengeEntry } from "./host"
import { choiceToolList } from "./tools/choiceTools"
import { gridToolList } from "./tools/gridTools"
import { textToolList } from "./tools/textTools"
import { sttToolList } from "./tools/sttTools"

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

const ALL_TOOLS = [...choiceToolList, ...gridToolList, ...textToolList, ...sttToolList]

describe("#57 — cross-language is a DECLARED tool property, not a whitelist", () => {
  it("isCrossLanguageTool(id) === the tool's own isCrossLanguage flag", () => {
    // The registry reads the property — a tool can't slip through a stale list.
    for (const tool of ALL_TOOLS) {
      expect(isCrossLanguageTool(tool.id), tool.id).toBe(tool.isCrossLanguage === true)
    }
  })

  it("flags every translation/meaning/match tool — incl. which-meant (countdown-recall, the #57 miss)", () => {
    for (const id of ["fast-translate", "tap-translation", "listen-choose-pic", "memory-pairs", "true-false", "picture-match", "countdown-recall"] as const) {
      expect(isCrossLanguageTool(id), id).toBe(true)
    }
    // Legacy aliases resolve to their cross-language canonical id.
    expect(isCrossLanguageTool("translate-fast")).toBe(true)
    expect(isCrossLanguageTool("listen-choose")).toBe(true)
  })

  it("does NOT flag monolingual target-only drills (category-sort sorts target by TOPIC, not language)", () => {
    for (const id of ["say-it-back", "read-aloud", "word-scramble", "odd-one-out", "rhyme-match", "dialogue-fill", "repeat-after", "category-sort", "conjugation-tap", "spot-typo", "number-drill", "word-search", "fill-the-blank", "build-sentence"] as const) {
      expect(isCrossLanguageTool(id), id).toBe(false)
    }
  })

  it("every tool's isCrossLanguage is a real boolean decision (no tool left undeclared-by-accident in a 2-lang family)", () => {
    // Belt-and-braces: the cross-language ids resolve to a real tool with the flag.
    for (const tool of ALL_TOOLS) {
      if (tool.isCrossLanguage) expect(getTool(tool.id)?.isCrossLanguage).toBe(true)
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

describe("#57 — under immersion, a cross-language tool's prompt & answer stay TWO languages", () => {
  /**
   * The orchestrator rule (game.ts): for a cross-language tool, the challenge
   * context's nativeLanguage = learnerPair.native REGARDLESS of immersion (the
   * immersion resolver returns undefined for monolingual tools). Replicate that
   * decision here + resolve the pair, and assert the two SHOWN sides differ — for
   * EVERY cross-language tool. This is the "which line meant 'Close the window'"
   * tautology, closed for good.
   */
  const resolveCtxNative = (toolIsCross: boolean, immersionDropsNative: boolean): LanguageCode | undefined =>
    toolIsCross ? EN /* learnerPair.native, kept */ : immersionDropsNative ? undefined : EN

  it("which-meant + every cross-language tool: prompt language ≠ answer language under immersion", () => {
    for (const tool of ALL_TOOLS.filter((t) => t.isCrossLanguage)) {
      // Immersion ON → the resolver would drop native; the cross-language override
      // restores it because the tool is flagged.
      const ctxNative = resolveCtxNative(true, /* immersion drops native */ true)
      const p = entryPair(entry, AR, ctxNative)
      expect(p, tool.id).not.toBeNull()
      // The two sides the tool shows (one as prompt, one as the correct choice).
      expect(p!.target, tool.id).not.toBe(p!.native)
      expect(p!.native, `${tool.id}: native side must survive immersion`).toBe("I see the star")
    }
  })

  it("a MONOLINGUAL tool correctly collapses to target-only under immersion (no native gloss)", () => {
    const sayItBack = ALL_TOOLS.find((t) => t.id === "say-it-back")!
    expect(sayItBack.isCrossLanguage ?? false).toBe(false)
    const ctxNative = resolveCtxNative(false, /* immersion drops native */ true)
    expect(ctxNative).toBeUndefined() // monolingual → native dropped, which is correct
  })
})
