import { describe, expect, it } from "vitest"
import {
  GM_PROGRAM_NAMES,
  GM_FAMILIES,
  GM_DRUM_BANK,
  GM_DRUM_KITS,
  gmProgramName,
  gmFamilyOf,
} from "./gmPrograms"

describe("GM program data", () => {
  it("has exactly 128 melodic program names", () => {
    expect(GM_PROGRAM_NAMES).toHaveLength(128)
    expect(new Set(GM_PROGRAM_NAMES).size).toBe(128) // all distinct
  })

  it("groups all 128 programs into 16 families of 8, in order", () => {
    expect(GM_FAMILIES).toHaveLength(16)
    const seen: number[] = []
    for (const fam of GM_FAMILIES) {
      expect(fam.programs).toHaveLength(8)
      for (const p of fam.programs) {
        expect(p.name).toBe(GM_PROGRAM_NAMES[p.program])
        seen.push(p.program)
      }
    }
    expect(seen).toEqual(Array.from({ length: 128 }, (_, i) => i))
  })

  it("resolves names by program (and drum kits by bank 128)", () => {
    expect(gmProgramName(0)).toBe("Acoustic Grand Piano")
    expect(gmProgramName(40)).toBe("Violin")
    expect(gmProgramName(0, GM_DRUM_BANK)).toBe("Standard Kit")
    expect(gmProgramName(999)).toBe(GM_PROGRAM_NAMES[999 % 128])
  })

  it("maps a program to its owning family", () => {
    expect(gmFamilyOf(0)?.id).toBe("piano")
    expect(gmFamilyOf(35)?.id).toBe("bass")
    expect(gmFamilyOf(48)?.id).toBe("ensemble")
    expect(gmFamilyOf(80)?.id).toBe("synth-lead")
  })

  it("exposes the standard GM drum kit presets", () => {
    expect(GM_DRUM_KITS.length).toBeGreaterThanOrEqual(8)
    expect(GM_DRUM_KITS[0]).toEqual({ program: 0, name: "Standard Kit" })
  })
})
