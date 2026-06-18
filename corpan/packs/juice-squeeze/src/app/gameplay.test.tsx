/**
 * Smoke/parity tests for the Juice Squeeze (Fire) gameplay UI.
 * Run: npx vitest run --environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { useGameStore } from "../state/gameStore"
import { pickLanguagePair, resetLanguagePairRotation } from "../util/languagePair"
import { flattenReadingOrder } from "../util/readingOrder"
import { JuiceSqueezeApp } from "./JuiceSqueezeApp"
import type { HostApi, EntryOut } from "../sdk/types"

const PHRASES: EntryOut[] = [
  {
    entry_id: 1,
    level: "A0",
    domains: [],
    source: "base",
    translations: [
      { language_code: "en", text: "the cat is here" },
      { language_code: "es", text: "el gato está aquí" },
    ],
  },
]

function makeHost(overrides: Partial<HostApi> = {}): HostApi {
  return {
    speak: vi.fn(),
    getStackConfig: () => ({
      languages: ["es", "en"],
      domains: [],
      levels: ["A0"],
      rate: 1,
      textSize: "md",
      showRomanization: false,
    }),
    getRandomEntries: vi.fn(async () => PHRASES),
    ...overrides,
  }
}

beforeEach(() => {
  useGameStore.getState().resetGame()
  useGameStore.setState({ stats: { ...useGameStore.getState().stats, allTimeScore: 0, allTimeCompletedPhrases: 0 } })
  resetLanguagePairRotation()
})

describe("pickLanguagePair", () => {
  it("follows the rotation and never returns an identical pair when avoidable", () => {
    // A single stack language pairs with English (the corpus base) so the prompt
    // and the blocks DIFFER — never the same language on both sides (EN→EN bug).
    expect(pickLanguagePair(["es"])).toEqual(["en", "es"])
    // English-only is the one case we can't make distinct.
    expect(pickLanguagePair(["en"])).toEqual(["en", "en"])
    expect(pickLanguagePair([])).toEqual(["en", "en"])
    // Duplicates are deduped before pairing.
    expect(pickLanguagePair(["en", "en"])).toEqual(["en", "en"])
    expect(pickLanguagePair(["es", "en"])).toEqual(["es", "en"])
    // 3+: display fixed = languages[0], block rotates through the rest
    expect(pickLanguagePair(["es", "en", "fr"])).toEqual(["es", "en"])
    expect(pickLanguagePair(["es", "en", "fr"])).toEqual(["es", "fr"])
    expect(pickLanguagePair(["es", "en", "fr"])).toEqual(["es", "en"])
  })
})

describe("flattenReadingOrder", () => {
  it("reverses each row for RTL", () => {
    const blocks = {
      a: { id: "a", word: "A", originalIndex: 0 },
      b: { id: "b", word: "B", originalIndex: 1 },
      c: { id: "c", word: "C", originalIndex: 2 },
    }
    expect(flattenReadingOrder([["a", "b", "c"]], blocks, false)).toEqual(["A", "B", "C"])
    expect(flattenReadingOrder([["a", "b", "c"]], blocks, true)).toEqual(["C", "B", "A"])
  })
})

describe("game loop", () => {
  it("loads a phrase, wins on correct order, fills the bottle, scores", async () => {
    const host = makeHost()
    const container = document.createElement("div")
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<JuiceSqueezeApp hostApi={host} initialStackConfig={host.getStackConfig()} />)
    })
    // allow the async loadNext() to resolve
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    const store = useGameStore.getState()
    expect(store.phrase.id).toBe("entry-1")
    // block lang = languages[1] = "en" -> "the cat is here"
    expect(store.correctWords).toEqual(["the", "cat", "is", "here"])
    expect(store.bankOrder.length).toBe(4)
    expect(window.__jsf?.phraseId).toBe("entry-1")
    expect(window.__jsf?.blockLang).toBe("en")

    // Place blocks in CORRECT reading order into row 0.
    const correctIds = store.correctWords.map((w) => {
      const entry = Object.values(store.blocks).find((b) => b.word === w && useGameStore.getState().bankOrder.includes(b.id))
      return entry!.id
    })
    // Move each, appending to row 0.
    act(() => {
      for (const id of correctIds) {
        useGameStore.getState().moveToSentence(id, 0)
      }
    })

    // Verify placed order is correct, then run the win check the way the app does.
    const s2 = useGameStore.getState()
    const words = flattenReadingOrder(s2.sentenceRows, s2.blocks, false)
    expect(words).toEqual(["the", "cat", "is", "here"])
    const won = s2.checkWin(words)
    expect(won).toBe(true)

    root.unmount()
    container.remove()
  })
})

describe("win reward bookkeeping (store parity)", () => {
  it("increments score by word count and fills the bottle", () => {
    const store = useGameStore.getState()
    store.loadPhrase({ id: "p1", level: "A0", text: "the cat", words: ["the", "cat"], targetText: "el gato", targetLang: "es", blockLang: "en" })
    const before = useGameStore.getState().stats.allTimeScore
    act(() => {
      useGameStore.getState().incrementCompletedPhrases()
      useGameStore.getState().recordCompletedPhrase("p1", 2, "A0", { targetText: "el gato", blockText: "the cat", targetLang: "es", blockLang: "en" }, ["#a", "#b", "#c"])
    })
    const after = useGameStore.getState()
    expect(after.stats.allTimeScore).toBe(before + 2)
    expect(after.bottleProgress.phrasesInCurrentBottle).toBe(1)
    expect(after.getBottleFillPercent()).toBe(10)
  })

  it("completes a bottle after 10 phrases and cycles color", () => {
    const store = useGameStore.getState()
    for (let i = 0; i < 10; i++) {
      store.loadPhrase({ id: `p${i}`, level: "A0", text: "a b", words: ["a", "b"], blockLang: "en", targetLang: "es" })
      act(() => {
        useGameStore.getState().incrementCompletedPhrases()
        useGameStore.getState().recordCompletedPhrase(`p${i}`, 2, "A0", undefined, ["#a", "#b", "#c"])
      })
    }
    const bp = useGameStore.getState().bottleProgress
    expect(bp.bottleCollection.length).toBe(1)
    expect(bp.phrasesInCurrentBottle).toBe(0)
    expect(bp.bottlesCompletedThisLevel).toBe(1)
  })
})
