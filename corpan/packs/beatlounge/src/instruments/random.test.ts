import { describe, expect, it } from "vitest"
import { pickRandomPreset, pickRandomPresetForClass } from "./random"
import { makeRng } from "../music/chords/random"

describe("instrument random pickers", () => {
  it("is deterministic for a given seed", () => {
    expect(pickRandomPreset(makeRng(5))?.id).toBe(pickRandomPreset(makeRng(5))?.id)
  })

  it("respects the family filter", () => {
    for (let s = 0; s < 20; s++) {
      expect(pickRandomPreset(makeRng(s), ["bass"])?.family).toBe("bass")
    }
  })

  it("picks the right voice class", () => {
    expect(pickRandomPresetForClass(makeRng(1), "bass").family).toBe("bass")
    expect(pickRandomPresetForClass(makeRng(1), "lead").family).toBe("lead")
    expect(["keys", "pad", "pluck", "brass"]).toContain(
      pickRandomPresetForClass(makeRng(3), "mid").family
    )
  })
})
