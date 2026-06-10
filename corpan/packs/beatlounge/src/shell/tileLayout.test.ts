import { describe, it, expect } from "vitest"
import { columnsForWidth, spanForAspect } from "./tileLayout"

describe("columnsForWidth", () => {
  it("is a single column at and below ~300–520px (phone)", () => {
    expect(columnsForWidth(300)).toBe(1)
    expect(columnsForWidth(360)).toBe(1)
    expect(columnsForWidth(519)).toBe(1)
  })
  it("scales 2 → 3 → 4 up the breakpoints", () => {
    expect(columnsForWidth(520)).toBe(2)
    expect(columnsForWidth(700)).toBe(2)
    expect(columnsForWidth(900)).toBe(3)
    expect(columnsForWidth(1100)).toBe(3)
    expect(columnsForWidth(1240)).toBe(4)
    expect(columnsForWidth(1600)).toBe(4)
  })
})

describe("spanForAspect", () => {
  it("collapses every aspect to 1×1 in the single-column phone band", () => {
    for (const a of ["square", "wide", "tall"] as const) {
      expect(spanForAspect(a, 1)).toEqual({ cols: 1, rows: 1 })
    }
  })
  it("spans wide=2cols, tall=2rows, square=1×1 from 2 columns up", () => {
    expect(spanForAspect("square", 3)).toEqual({ cols: 1, rows: 1 })
    expect(spanForAspect("wide", 3)).toEqual({ cols: 2, rows: 1 })
    expect(spanForAspect("tall", 3)).toEqual({ cols: 1, rows: 2 })
  })
  it("never lets a wide tile overflow the available columns", () => {
    expect(spanForAspect("wide", 2).cols).toBe(2)
    expect(spanForAspect("wide", 4).cols).toBe(2)
  })
  it("treats undefined aspect as square", () => {
    expect(spanForAspect(undefined, 3)).toEqual({ cols: 1, rows: 1 })
  })
})
