import { describe, it, expect } from "vitest"
import { pickRandomRhythmId, resolveDialRhythmId } from "./randomRhythm"
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

describe("resolveDialRhythmId — NEVER defaults to 'the first' rhythm", () => {
  it("uses an explicit id when given (a shuffle just picked one)", () => {
    expect(resolveDialRhythmId(() => 0.5, undefined, "samba")).toBe("samba")
    // explicit wins even over a last-used id
    expect(resolveDialRhythmId(() => 0.5, "techno", "samba")).toBe("samba")
  })

  it("falls back to the last-used id (sticky between dial presses)", () => {
    expect(resolveDialRhythmId(() => 0.5, "techno")).toBe("techno")
  })

  it("picks a RANDOM groove (not index 0) when nothing is chosen yet", () => {
    // A mid-range rng must NOT land on RHYTHMS[0] (the old son-clave cling).
    const id = resolveDialRhythmId(() => 0.5, undefined, undefined)
    expect(getRhythm(id)).toBeTruthy()
    expect(id).not.toBe(RHYTHMS[0]!.id)
  })
})
