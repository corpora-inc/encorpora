/**
 * beatlounge — scatter PROFILE derivation tests. The profile is the groove
 * brain's feel map: per-cell placement probability + velocity band, computed
 * from a rhythm's own lanes/accents/ghosts (with optional per-rhythm overrides).
 */

import { describe, expect, it } from "vitest"
import { RHYTHMS } from "./corpus"
import { getRhythm } from "./index"
import { grooveProfile } from "./profile"
import { rhythmCells, type Rhythm } from "./types"

const son = () => getRhythm("son-clave-3-2")!
const samba = () => getRhythm("samba")!

describe("grooveProfile — shape + invariants", () => {
  it("has one cell entry per grid cell, in order, for every corpus rhythm", () => {
    for (const r of RHYTHMS) {
      const p = grooveProfile(r)
      expect(p.length, r.id).toBe(rhythmCells(r))
      for (let c = 0; c < p.length; c++) expect(p[c].cell).toBe(c)
    }
  })

  it("keeps prob in 0..1 and velMin ≤ velMax in 0..1", () => {
    for (const r of RHYTHMS) {
      for (const cell of grooveProfile(r)) {
        expect(cell.prob).toBeGreaterThanOrEqual(0)
        expect(cell.prob).toBeLessThanOrEqual(1)
        expect(cell.velMin).toBeGreaterThanOrEqual(0)
        expect(cell.velMax).toBeLessThanOrEqual(1)
        expect(cell.velMin).toBeLessThanOrEqual(cell.velMax)
      }
    }
  })
})

describe("grooveProfile — derived from the groove's character", () => {
  it("onset cells get a far higher probability than rests (clave feel survives)", () => {
    const p = grooveProfile(son())
    const onset = new Set([0, 3, 6, 10, 12])
    for (const cell of p) {
      if (onset.has(cell.cell)) expect(cell.prob).toBeGreaterThan(0.4)
      else expect(cell.prob).toBeLessThan(0.2)
    }
  })

  it("an accented onset gets a louder velocity band than a ghost / rest", () => {
    const p = grooveProfile(son())
    const accent = p[0] // son clave cell 0 is an accent
    const rest = p.find((c) => ![0, 3, 6, 10, 12].includes(c.cell))!
    expect(accent.velMax).toBeGreaterThan(rest.velMax)
  })

  it("a multi-lane groove combines lanes — the loudest stroke per cell wins", () => {
    const p = grooveProfile(samba())
    // Beat-1 (cell 0) carries strong strokes in samba → a high-prob, loud cell.
    expect(p[0].prob).toBeGreaterThan(0.4)
    expect(p[0].velMax).toBeGreaterThan(0.5)
  })
})

describe("grooveProfile — per-rhythm override", () => {
  it("a rhythm.scatter override replaces the derived value at that cell", () => {
    const base = son()
    const overridden: Rhythm = {
      ...base,
      scatter: [{ cell: 1, prob: 0.99, velMin: 0.8, velMax: 0.9 }],
    }
    const p = grooveProfile(overridden)
    expect(p[1].prob).toBeCloseTo(0.99)
    expect(p[1].velMin).toBeCloseTo(0.8)
    expect(p[1].velMax).toBeCloseTo(0.9)
    // Unlisted cells keep their derived value (cell 0 is still the accent).
    expect(p[0].prob).toBeGreaterThan(0.4)
  })

  it("does not mutate the source rhythm", () => {
    const r = son()
    const snap = JSON.stringify(r)
    grooveProfile(r)
    expect(JSON.stringify(r)).toBe(snap)
  })
})
