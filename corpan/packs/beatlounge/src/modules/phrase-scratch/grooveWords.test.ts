import { describe, expect, it } from "vitest"
import { splitWords } from "./grooveWords"

describe("splitWords — language-aware groove tokens (#465)", () => {
  it("splits spaced scripts on whitespace", () => {
    expect(splitWords("the cat sat", "en")).toEqual(["the", "cat", "sat"])
  })

  it("segments no-space Chinese into multiple tokens, not one blob", () => {
    const toks = splitWords("我爱你", "zh")
    expect(toks.length).toBeGreaterThan(1)
    expect(toks.join("")).toBe("我爱你")
  })

  it("segments no-space Japanese", () => {
    expect(splitWords("夜明け", "ja").length).toBeGreaterThan(1)
  })

  it("empty / whitespace-only yields no tokens", () => {
    expect(splitWords("   ", "en")).toEqual([])
    expect(splitWords("", "zh")).toEqual([])
  })
})
