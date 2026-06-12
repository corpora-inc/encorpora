import { describe, it, expect } from "vitest"
import { columnsForWidth, spanForAspect } from "./tileLayout"

describe("columnsForWidth", () => {
  it("is a single column at and below ~320–520px (phone, incl. the 320px floor)", () => {
    expect(columnsForWidth(320)).toBe(1) // small-phone floor: clean single stack
    expect(columnsForWidth(300)).toBe(1)
    expect(columnsForWidth(360)).toBe(1)
    expect(columnsForWidth(519)).toBe(1)
  })
  it("is 1 column on phone and the 6-column IA grid from 720px (every iPad)", () => {
    expect(columnsForWidth(700)).toBe(1) // still phone-ish → single stack
    expect(columnsForWidth(720)).toBe(6) // iPad mini portrait
    expect(columnsForWidth(834)).toBe(6) // 11" portrait
    expect(columnsForWidth(1024)).toBe(6) // 12.9" portrait
    expect(columnsForWidth(1194)).toBe(6) // 11" landscape
    expect(columnsForWidth(1366)).toBe(6) // 12.9" landscape
  })
})

describe("spanForAspect", () => {
  it("collapses every aspect to one full-width row in the phone band", () => {
    for (const a of ["third", "half", "twothirds", "full", "band", "tall"] as const) {
      expect(spanForAspect(a, 1)).toEqual({ cols: 1, rows: 1 })
    }
  })
  it("maps the IA fractions on the 6-column grid", () => {
    expect(spanForAspect("third", 6)).toEqual({ cols: 2, rows: 1 }) // 3-up rows
    expect(spanForAspect("half", 6)).toEqual({ cols: 3, rows: 1 }) // 2-up rows
    expect(spanForAspect("twothirds", 6)).toEqual({ cols: 4, rows: 1 }) // drums lead
    expect(spanForAspect("full", 6)).toEqual({ cols: 6, rows: 1 }) // mixer band
    expect(spanForAspect("band", 6)).toEqual({ cols: 6, rows: 2 }) // ribbon hero (tall)
  })
  it("a clean [cycle(third) + drums(twothirds)] and [half + half] each fill the row", () => {
    expect(spanForAspect("third", 6).cols + spanForAspect("twothirds", 6).cols).toBe(6)
    expect(spanForAspect("half", 6).cols * 2).toBe(6)
    expect(spanForAspect("third", 6).cols * 3).toBe(6)
  })
  it("legacy aliases map on: square→third, wide→twothirds; undefined→third", () => {
    expect(spanForAspect("square", 6)).toEqual({ cols: 2, rows: 1 })
    expect(spanForAspect("wide", 6)).toEqual({ cols: 4, rows: 1 })
    expect(spanForAspect(undefined, 6)).toEqual({ cols: 2, rows: 1 })
  })
})
