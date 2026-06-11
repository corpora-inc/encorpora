import { describe, it, expect } from "vitest"
import { pickRandomRhythmId } from "./randomRhythm"
import { RHYTHMS, getRhythm } from "../../rhythm"

describe("pickRandomRhythmId", () => {
  it("returns a real corpus rhythm id", () => {
    const id = pickRandomRhythmId(() => 0.5)
    expect(getRhythm(id)).toBeTruthy()
  })

  it("maps the rng across the whole corpus (0 → first, ~1 → last)", () => {
    expect(pickRandomRhythmId(() => 0)).toBe(RHYTHMS[0]!.id)
    // 0.999… lands on the last rhythm (clamped, never out of range).
    expect(pickRandomRhythmId(() => 0.99999)).toBe(RHYTHMS[RHYTHMS.length - 1]!.id)
  })

  it("never lands on the avoided id when more than one rhythm exists", () => {
    const avoid = RHYTHMS[0]!.id
    for (const q of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(pickRandomRhythmId(() => q, avoid)).not.toBe(avoid)
    }
  })

  it("is deterministic given the same rng", () => {
    const a = pickRandomRhythmId(() => 0.37)
    const b = pickRandomRhythmId(() => 0.37)
    expect(a).toBe(b)
  })
})
