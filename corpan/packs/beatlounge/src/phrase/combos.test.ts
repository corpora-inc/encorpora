import { describe, expect, it } from "vitest"
import { comboCount, phraseCombos, combosByBand } from "./combos"

describe("phraseCombos", () => {
  it("produces the full contiguous n-gram set in reading order", () => {
    const combos = phraseCombos(["ella", "lo", "explicará"])
    expect(combos.map((c) => c.text)).toEqual([
      "ella",
      "lo",
      "explicará",
      "ella lo",
      "lo explicará",
      "ella lo explicará",
    ])
    expect(combos.map((c) => c.n)).toEqual([1, 1, 1, 2, 2, 3])
  })

  it("count is triangular", () => {
    expect(comboCount(0)).toBe(0)
    expect(comboCount(1)).toBe(1)
    expect(comboCount(3)).toBe(6)
    expect(comboCount(5)).toBe(15)
    expect(comboCount(12)).toBe(78)
    expect(phraseCombos(["a", "b", "c", "d", "e"]).length).toBe(comboCount(5))
  })

  it("uses the joiner for no-space scripts", () => {
    expect(phraseCombos(["夜", "明け"], "").map((c) => c.text)).toEqual(["夜", "明け", "夜明け"])
  })

  it("caps the longest band with maxN", () => {
    const combos = phraseCombos(["a", "b", "c", "d"], " ", 2)
    expect(combos.every((c) => c.n <= 2)).toBe(true)
    expect(combos.map((c) => c.text)).toEqual(["a", "b", "c", "d", "a b", "b c", "c d"])
  })

  it("handles a single token + empty", () => {
    expect(phraseCombos(["solo"]).map((c) => c.text)).toEqual(["solo"])
    expect(phraseCombos([])).toEqual([])
  })

  it("groups by band", () => {
    const bands = combosByBand(phraseCombos(["a", "b", "c"]))
    expect(bands.map((b) => b.n)).toEqual([1, 2, 3])
    expect(bands[0].combos.length).toBe(3)
    expect(bands[2].combos.length).toBe(1)
  })
})
