import { describe, it, expect } from "vitest"
import { columnsForWidth, spanForAspect } from "./tileLayout"

describe("columnsForWidth", () => {
  it("is a single column at and below ~320–520px (phone, incl. the 320px floor)", () => {
    expect(columnsForWidth(320)).toBe(1) // small-phone floor: clean single stack
    expect(columnsForWidth(300)).toBe(1)
    expect(columnsForWidth(360)).toBe(1)
    expect(columnsForWidth(519)).toBe(1)
  })
  it("scales 2 → 3 and CAPS at 3 (no 4th column that splits the IA groups)", () => {
    expect(columnsForWidth(520)).toBe(2)
    expect(columnsForWidth(700)).toBe(2)
    expect(columnsForWidth(900)).toBe(3)
    expect(columnsForWidth(1100)).toBe(3)
    expect(columnsForWidth(1240)).toBe(3) // capped — a 12.9" landscape stays 3-col
    expect(columnsForWidth(1600)).toBe(3)
  })
})

describe("spanForAspect", () => {
  it("collapses every aspect to 1×1 in the single-column phone band", () => {
    for (const a of ["square", "wide", "tall", "full"] as const) {
      expect(spanForAspect(a, 1)).toEqual({ cols: 1, rows: 1 })
    }
  })
  it("at 2 columns: wide stays 1 (so [cycle+drums] pairs), full spans the row", () => {
    expect(spanForAspect("square", 2)).toEqual({ cols: 1, rows: 1 })
    expect(spanForAspect("wide", 2)).toEqual({ cols: 1, rows: 1 })
    expect(spanForAspect("full", 2)).toEqual({ cols: 2, rows: 1 })
    expect(spanForAspect("tall", 2)).toEqual({ cols: 1, rows: 2 })
  })
  it("at 3 columns: wide=2, full=3, tall=2rows, square=1×1", () => {
    expect(spanForAspect("square", 3)).toEqual({ cols: 1, rows: 1 })
    expect(spanForAspect("wide", 3)).toEqual({ cols: 2, rows: 1 })
    expect(spanForAspect("full", 3)).toEqual({ cols: 3, rows: 1 })
    expect(spanForAspect("tall", 3)).toEqual({ cols: 1, rows: 2 })
  })
  it("treats undefined aspect as square", () => {
    expect(spanForAspect(undefined, 3)).toEqual({ cols: 1, rows: 1 })
  })
})
