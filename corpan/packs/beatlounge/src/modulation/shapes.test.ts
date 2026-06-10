/**
 * beatlounge — shape evaluation tests: every shape stays in [-1,1], the
 * deterministic shapes hit their known landmarks, the stochastic shapes are
 * reproducible per (cycleIndex, seed), and drift is continuous across cycles.
 */

import { describe, expect, it } from "vitest"
import { shapeValue, hash01 } from "./shapes"
import type { ModulatorShape } from "../model/document"

const SHAPES: ModulatorShape[] = ["sine", "triangle", "saw", "square", "random", "drift"]

describe("shapeValue — range", () => {
  it("stays within [-1, 1] for every shape across the cycle and across cycles", () => {
    for (const shape of SHAPES) {
      for (let c = 0; c < 8; c++) {
        for (let i = 0; i <= 64; i++) {
          const v = shapeValue(shape, i / 64, c, 1234)
          expect(v, `${shape} c=${c} p=${i / 64}`).toBeGreaterThanOrEqual(-1)
          expect(v, `${shape} c=${c} p=${i / 64}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it("wraps out-of-range phase", () => {
    expect(shapeValue("saw", 1.25, 0)).toBeCloseTo(shapeValue("saw", 0.25, 0))
    expect(shapeValue("sine", -0.25, 0)).toBeCloseTo(shapeValue("sine", 0.75, 0))
  })
})

describe("shapeValue — deterministic landmarks", () => {
  it("sine starts at 0 and peaks at a quarter cycle", () => {
    expect(shapeValue("sine", 0, 0)).toBeCloseTo(0)
    expect(shapeValue("sine", 0.25, 0)).toBeCloseTo(1)
    expect(shapeValue("sine", 0.5, 0)).toBeCloseTo(0)
    expect(shapeValue("sine", 0.75, 0)).toBeCloseTo(-1)
  })

  it("triangle peaks at mid-cycle and bottoms at the edges", () => {
    expect(shapeValue("triangle", 0, 0)).toBeCloseTo(-1)
    expect(shapeValue("triangle", 0.5, 0)).toBeCloseTo(1)
    expect(shapeValue("triangle", 1, 0)).toBeCloseTo(-1)
  })

  it("saw ramps linearly from -1 to +1", () => {
    expect(shapeValue("saw", 0, 0)).toBeCloseTo(-1)
    expect(shapeValue("saw", 0.5, 0)).toBeCloseTo(0)
    expect(shapeValue("saw", 0.999, 0)).toBeGreaterThan(0.99)
  })

  it("square is high then low", () => {
    expect(shapeValue("square", 0.1, 0)).toBe(1)
    expect(shapeValue("square", 0.6, 0)).toBe(-1)
  })
})

describe("shapeValue — stochastic shapes", () => {
  it("random holds one value flat across a cycle (sample & hold)", () => {
    const a = shapeValue("random", 0.0, 3, 99)
    const b = shapeValue("random", 0.5, 3, 99)
    const c = shapeValue("random", 0.9, 3, 99)
    expect(b).toBe(a)
    expect(c).toBe(a)
  })

  it("random changes value between cycles", () => {
    const c0 = shapeValue("random", 0.5, 0, 99)
    const c1 = shapeValue("random", 0.5, 1, 99)
    expect(c0).not.toBe(c1)
  })

  it("is reproducible per (cycleIndex, seed)", () => {
    expect(shapeValue("random", 0.3, 7, 5)).toBe(shapeValue("random", 0.8, 7, 5))
    expect(shapeValue("drift", 0.42, 11, 2)).toBe(shapeValue("drift", 0.42, 11, 2))
  })

  it("different seeds give different streams", () => {
    expect(shapeValue("random", 0.5, 4, 1)).not.toBe(shapeValue("random", 0.5, 4, 2))
  })
})

describe("shapeValue — drift continuity", () => {
  it("is continuous across the cycle boundary (no jump)", () => {
    const seed = 17
    for (let c = 0; c < 5; c++) {
      const endOfThis = shapeValue("drift", 0.99999, c, seed)
      const startOfNext = shapeValue("drift", 0, c + 1, seed)
      // Smoothstep ends at the same hashed target the next cycle starts from.
      expect(Math.abs(endOfThis - startOfNext)).toBeLessThan(1e-3)
    }
  })

  it("anchors the cycle start at the cycle's hashed target", () => {
    const seed = 3
    // At p=0 the drift value equals this cycle's hashed bipolar target.
    const target = hash01(2, seed) * 2 - 1
    expect(shapeValue("drift", 0, 2, seed)).toBeCloseTo(target)
  })
})

describe("hash01", () => {
  it("is deterministic and in [0,1)", () => {
    for (let i = 0; i < 100; i++) {
      const v = hash01(i, 42)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      expect(hash01(i, 42)).toBe(v)
    }
  })
})
