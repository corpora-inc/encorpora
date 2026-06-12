import { describe, expect, it } from "vitest"
import {
  NOTE_LENGTH_PRESETS,
  noteLengthSeconds,
  closestNoteLengthId,
} from "./noteLengths"

describe("noteLengths", () => {
  it("computes seconds from a note fraction + tempo", () => {
    // 120 bpm → a beat (quarter) = 0.5s
    expect(noteLengthSeconds(1 / 4, 120)).toBeCloseTo(0.5, 6) // 1/4
    expect(noteLengthSeconds(1 / 8, 120)).toBeCloseTo(0.25, 6) // 1/8
    expect(noteLengthSeconds(1 / 16, 120)).toBeCloseTo(0.125, 6) // 1/16
    expect(noteLengthSeconds((1 / 4) * 1.5, 120)).toBeCloseTo(0.75, 6) // dotted 1/4
    expect(noteLengthSeconds((1 / 8) * (2 / 3), 120)).toBeCloseTo(0.25 / 3 * 2, 6) // 1/8 triplet
  })

  it("dotted quarter at 96 bpm matches the delay default (0.9375s)", () => {
    expect(noteLengthSeconds((1 / 4) * 1.5, 96)).toBeCloseTo(0.9375, 6)
  })

  it("guards against a zero/negative bpm (no division blow-up)", () => {
    expect(Number.isFinite(noteLengthSeconds(1 / 4, 0))).toBe(true)
  })

  it("round-trips: every preset is recognized as its own id", () => {
    for (const bpm of [90, 96, 120, 140]) {
      for (const p of NOTE_LENGTH_PRESETS) {
        expect(closestNoteLengthId(noteLengthSeconds(p.fraction, bpm), bpm)).toBe(p.id)
      }
    }
  })

  it("returns null for a free (un-synced) time", () => {
    // 0.31s at 120bpm sits between 1/8 (0.25) and dotted-1/8 (not in the set) → off grid
    expect(closestNoteLengthId(0.31, 120)).toBeNull()
  })

  it("exposes the curated five-chip set in a stable order", () => {
    expect(NOTE_LENGTH_PRESETS.map((p) => p.id)).toEqual([
      "1/4",
      "1/4.",
      "1/8",
      "1/8t",
      "1/16",
    ])
  })
})
