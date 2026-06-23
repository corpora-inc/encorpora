import { describe, expect, it } from "vitest"
import {
  buildWavetable,
  DEFAULT_WAVETABLE_ID,
  resolveWavetable,
  WAVETABLE_RECIPES,
  WAVETABLES,
} from "./wavetables"

describe("buildWavetable", () => {
  it("keeps DC at zero and offsets harmonics by one (index 0 ⇒ fundamental)", () => {
    const wt = buildWavetable({ id: "t", label: "T", harmonics: [1, 0, 0.5] })
    expect(wt.real[0]).toBe(0)
    expect(wt.imag[0]).toBe(0) // DC
    // 3 harmonics ⇒ length 4 (DC + 3).
    expect(wt.imag).toHaveLength(4)
    expect(wt.real).toHaveLength(4)
  })

  it("normalizes summed harmonic magnitude to ~1", () => {
    const wt = buildWavetable({ id: "t", label: "T", harmonics: [2, 1, 1] })
    const sum = wt.imag.reduce((a, v) => a + Math.abs(v), 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it("handles an all-zero recipe without dividing by zero", () => {
    const wt = buildWavetable({ id: "z", label: "Z", harmonics: [0, 0] })
    expect(wt.imag.every((v) => v === 0)).toBe(true)
  })

  it("caps harmonics at 64", () => {
    const wt = buildWavetable({
      id: "big",
      label: "Big",
      harmonics: new Array(200).fill(1),
    })
    expect(wt.imag.length).toBeLessThanOrEqual(65) // 64 + DC
  })
})

describe("WAVETABLES registry", () => {
  it("renders every recipe into coefficient arrays", () => {
    for (const recipe of WAVETABLE_RECIPES) {
      const wt = WAVETABLES[recipe.id]
      expect(wt, recipe.id).toBeDefined()
      expect(wt.real.length).toBe(wt.imag.length)
      expect(wt.real.length).toBeGreaterThan(1)
      // No NaN/Infinity leaked through.
      expect(wt.imag.every(Number.isFinite)).toBe(true)
    }
  })

  it("includes the documented built-ins", () => {
    const ids = WAVETABLE_RECIPES.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(["saw", "square", "organ", "glass", "vocal"]))
  })

  it("saw harmonics decay as 1/n", () => {
    const saw = WAVETABLE_RECIPES.find((r) => r.id === "saw")!
    // Pre-normalization recipe: h[0]=1, h[1]=1/2, h[2]=1/3 ...
    expect(saw.harmonics[0]).toBeCloseTo(1)
    expect(saw.harmonics[1]).toBeCloseTo(0.5)
    expect(saw.harmonics[2]).toBeCloseTo(1 / 3)
  })

  it("square only has odd harmonics", () => {
    const sq = WAVETABLE_RECIPES.find((r) => r.id === "square")!
    // even harmonics (index 1,3,5...) are zero
    for (let i = 1; i < sq.harmonics.length; i += 2) {
      expect(sq.harmonics[i]).toBe(0)
    }
  })
})

describe("resolveWavetable", () => {
  it("returns the requested table", () => {
    expect(resolveWavetable("glass")).toBe(WAVETABLES.glass)
  })

  it("falls back to the default for unknown ids", () => {
    expect(resolveWavetable("does-not-exist")).toBe(WAVETABLES[DEFAULT_WAVETABLE_ID])
  })
})
