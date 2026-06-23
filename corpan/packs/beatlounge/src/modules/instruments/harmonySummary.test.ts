/**
 * beatlounge — harmonySummary tests: the collapsed harmony-row label for the
 * Instruments page. Modal → tonic + scale name; chordal → tonic + chord list.
 */

import { describe, expect, it } from "vitest"
import { createDefaultDoc } from "../../model/document"
import { reduce } from "../../model/reduce"
import { harmonySummary } from "./harmonySummary"

describe("harmonySummary", () => {
  it("summarizes a modal harmony as tonic + scale name", () => {
    const s = harmonySummary(createDefaultDoc(0))
    expect(s.tonic).toBe("C")
    expect(s.detail).toMatch(/Ionian|Major/i)
  })

  it("reflects the tonic change", () => {
    const d = reduce(createDefaultDoc(0), { t: "setTonic", pc: 7 })
    expect(harmonySummary(d).tonic).toBe("G")
  })

  it("summarizes chordal mode with the placed chord symbols", () => {
    let d = reduce(createDefaultDoc(0), { t: "setHarmonyMode", mode: "chordal" })
    d = reduce(d, { t: "setChordAt", tick: 0, symbol: "Cmaj7" })
    const s = harmonySummary(d)
    expect(s.tonic).toBe("C")
    expect(s.detail).toContain("C")
  })

  it("handles an empty chordal progression gracefully", () => {
    const d = reduce(createDefaultDoc(0), { t: "setHarmonyMode", mode: "chordal" })
    expect(harmonySummary(d).detail.length).toBeGreaterThan(0)
  })
})
