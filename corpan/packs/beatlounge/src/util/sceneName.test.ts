import { describe, expect, it } from "vitest"
import {
  SCENE_ADJECTIVES,
  SCENE_NOUNS,
  defaultSceneName,
  formatSceneDate,
  twoWordName,
} from "./sceneName"

// A fixed UTC-ish epoch; formatSceneDate uses LOCAL time, so we assert structure
// + determinism rather than a specific date string (CI timezone-independent).
const NOW = Date.UTC(2026, 5, 11, 18, 0, 0) // 2026-06-11

describe("sceneName — formatSceneDate", () => {
  it("formats YYYY-MM-DD with zero-padding", () => {
    const s = formatSceneDate(NOW)
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("sceneName — twoWordName", () => {
  it("is adjective-noun with a single hyphen", () => {
    const name = twoWordName(12345)
    expect(name).toMatch(/^[a-z]+-[a-z]+$/)
    const [adj, noun] = name.split("-")
    expect(SCENE_ADJECTIVES).toContain(adj)
    expect(SCENE_NOUNS).toContain(noun)
  })

  it("is deterministic given the same seed", () => {
    expect(twoWordName(777)).toBe(twoWordName(777))
  })

  it("produces two DISTINCT words (never word-word)", () => {
    for (let seed = 0; seed < 500; seed++) {
      const [adj, noun] = twoWordName(seed).split("-")
      expect(adj).not.toBe(noun)
    }
  })

  it("varies across seeds (not a constant)", () => {
    const set = new Set(
      Array.from({ length: 50 }, (_, i) => twoWordName(i * 1009))
    )
    expect(set.size).toBeGreaterThan(5)
  })
})

describe("sceneName — defaultSceneName", () => {
  it("is '<date> · <adjective>-<noun>' and deterministic given (now, seed)", () => {
    const a = defaultSceneName(NOW, 42)
    const b = defaultSceneName(NOW, 42)
    expect(a).toBe(b)
    expect(a).toMatch(/^\d{4}-\d{2}-\d{2} · [a-z]+-[a-z]+$/)
  })
})
