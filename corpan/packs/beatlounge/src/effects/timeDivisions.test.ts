import { describe, expect, it } from "vitest"
import { TIME_DIVISIONS, divisionSeconds, closestDivisionId } from "./timeDivisions"

describe("timeDivisions", () => {
  it("computes seconds from beats + tempo", () => {
    // 120 bpm → a quarter = 0.5s
    expect(divisionSeconds(1, 120)).toBeCloseTo(0.5, 6)
    expect(divisionSeconds(0.5, 120)).toBeCloseTo(0.25, 6) // 1/8
    expect(divisionSeconds(0.25, 120)).toBeCloseTo(0.125, 6) // 1/16
    expect(divisionSeconds(0.75, 120)).toBeCloseTo(0.375, 6) // dotted 1/8
    expect(divisionSeconds(1 / 3, 120)).toBeCloseTo(1 / 6, 6) // 1/8 triplet
  })

  it("round-trips: every division is recognized as its own id", () => {
    for (const bpm of [90, 120, 140]) {
      for (const d of TIME_DIVISIONS) {
        expect(closestDivisionId(divisionSeconds(d.beats, bpm), bpm)).toBe(d.id)
      }
    }
  })

  it("returns null for an un-synced (free) time", () => {
    // 0.31s at 120bpm is between 1/8 (0.25) and dotted-1/8 (0.375) → not on grid
    expect(closestDivisionId(0.31, 120)).toBeNull()
  })
})
