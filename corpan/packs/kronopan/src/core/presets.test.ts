import { describe, it, expect } from "vitest"
import { PRESETS, presetById } from "./presets"
import { validateCycle, totalPulses } from "./cycle"

describe("PRESETS", () => {
  it("are all valid and playable", () => {
    for (const p of PRESETS) {
      const v = validateCycle(p)
      expect(v.playable, `${p.id} should be playable`).toBe(true)
    }
  })

  it("have unique ids", () => {
    const ids = PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("use only valid pulse units", () => {
    for (const p of PRESETS) {
      expect([4, 8, 16]).toContain(p.unit)
    }
  })

  it("match their expected totals for the longer meters", () => {
    // Guards against a typo in the big group arrays.
    expect(totalPulses(presetById("kopanitsa")!)).toBe(11)
    expect(totalPulses(presetById("sandansko")!)).toBe(22)
    expect(totalPulses(presetById("sedi-donka")!)).toBe(25)
    expect(totalPulses(presetById("buchimis")!)).toBe(15)
    expect(totalPulses(presetById("yove-male-mome")!)).toBe(18)
    expect(totalPulses(presetById("jhaptal")!)).toBe(10)
    expect(totalPulses(presetById("deepchandi")!)).toBe(14)
    expect(totalPulses(presetById("heptadecagonal")!)).toBe(17)
    expect(totalPulses(presetById("nevesto")!)).toBe(9)
  })

  it("keep the author-specified groupings verbatim", () => {
    expect(presetById("rachenitsa")!.groups).toEqual([2, 2, 3])
    expect(presetById("lesnoto")!.groups).toEqual([3, 2, 2])
    expect(presetById("slip-jig")!.groups).toEqual([3, 3, 3])
    expect(presetById("kopanitsa")!.groups).toEqual([2, 2, 3, 2, 2])
  })
})
