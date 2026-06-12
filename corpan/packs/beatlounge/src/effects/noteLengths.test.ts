import { describe, expect, it } from "vitest"
import {
  NOTE_LENGTH_PRESETS,
  noteLengthSeconds,
  closestNoteLengthId,
  exceedsMaxDelay,
  MAX_DELAY_SECONDS,
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

  it("exposes the COMPLETE 1/32 → 1/1 grid (plain · triplet · dotted), short → long", () => {
    expect(NOTE_LENGTH_PRESETS.map((p) => p.id)).toEqual([
      "1/32t", "1/32", "1/16t", "1/32.", "1/16", "1/8t", "1/16.", "1/8", "1/4t",
      "1/8.", "1/4", "1/2t", "1/4.", "1/2", "1/1t", "1/2.", "1/1", "1/1.",
    ])
    // every note value 1/32..1/1 in all three flavours = 6 × 3 = 18 chips
    expect(NOTE_LENGTH_PRESETS).toHaveLength(18)
    // ascending duration (the row reads short → long)
    const secs = NOTE_LENGTH_PRESETS.map((p) => noteLengthSeconds(p.fraction, 120))
    expect(secs).toEqual([...secs].sort((a, b) => a - b))
  })

  it("flags note lengths that exceed the delay max at slow tempos", () => {
    // a whole note at 60 bpm = 4s > 3s max
    expect(exceedsMaxDelay(1, 60)).toBe(true)
    expect(noteLengthSeconds(1, 60)).toBeCloseTo(4, 6)
    // …but it fits at 96 bpm (2.5s)
    expect(exceedsMaxDelay(1, 96)).toBe(false)
    // a quarter never exceeds the max in any sane tempo
    expect(exceedsMaxDelay(1 / 4, 40)).toBe(false)
    expect(MAX_DELAY_SECONDS).toBe(3)
  })
})
