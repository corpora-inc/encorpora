/**
 * beatlounge — MELODY corpus + generation tests.
 *
 * Covers: contour-cell well-formedness + coverage + IP-safety (generated ids,
 * no naming), metric-profile shape + the downbeat-strong / pre-downbeat-~0 rule,
 * transition-table shape + no-dead-state, the degree→pitch bridge (octave wrap,
 * negatives, detune for non-12-TET cents), and generation determinism +
 * invariants (seeded reproducibility, forced downbeat, in-range degrees, the
 * density floor). This is the gate the corpus data must pass.
 */

import { describe, expect, it } from "vitest"
import type { ActivePitches } from "../resolver"
import {
  CELLS,
  CELL_IDS,
  CONTOUR_FAMILIES,
  MELODY_CORPUS,
  METRIC_PROFILES,
  TRANSITION_TABLES,
  cellFamilyCounts,
  cellsByFamily,
  degreeToPitch,
  generateMelody,
  getMetric,
  getTransition,
  transposeCell,
  cellToNotes,
} from "./index"

// A tiny deterministic PRNG (mulberry32) so generation tests are reproducible.
const rngFrom = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A 12-TET major ActivePitches for the bridge tests (tonic C).
const MAJOR_AP: ActivePitches = {
  tonicPc: 0,
  cents: [0, 200, 400, 500, 700, 900, 1100],
  pcs: [0, 2, 4, 5, 7, 9, 11],
}

// ------------------------------------------------------------------- cells
describe("contour cells — well-formedness", () => {
  it("has a substantial, deduplicated bank", () => {
    expect(CELLS.length).toBeGreaterThanOrEqual(200)
    expect(new Set(CELL_IDS).size).toBe(CELLS.length) // ids unique
    expect(CELL_IDS.length).toBe(CELLS.length)
  })

  it("represents every contour family", () => {
    const counts = cellFamilyCounts()
    for (const fam of CONTOUR_FAMILIES) {
      expect(cellsByFamily(fam).length).toBeGreaterThan(0)
      expect(counts[fam]).toBeGreaterThan(0)
    }
  })

  it("every cell is structurally sound", () => {
    for (const c of CELLS) {
      expect(c.notes.length).toBeGreaterThanOrEqual(2)
      expect(c.spanSixteenths).toBeGreaterThan(0)
      let lastPos = -1
      let lo = Infinity
      let hi = -Infinity
      for (const n of c.notes) {
        expect(n.pos).toBeGreaterThanOrEqual(0)
        expect(n.pos).toBeLessThan(c.spanSixteenths)
        expect(n.pos).toBeGreaterThanOrEqual(lastPos) // ascending by pos
        lastPos = n.pos
        expect(n.dur).toBeGreaterThanOrEqual(1)
        expect(n.weight).toBeGreaterThanOrEqual(0)
        expect(n.weight).toBeLessThanOrEqual(1)
        lo = Math.min(lo, n.degree)
        hi = Math.max(hi, n.degree)
      }
      expect(c.range).toEqual([lo, hi]) // cached range matches the notes
      expect(CONTOUR_FAMILIES).toContain(c.family)
      expect(c.tags).toContain(c.family)
      expect(c.tags).toContain("systematic")
    }
  })

  it("is IP-safe: ids are generated tokens, never names", () => {
    // Every id is the generator's strict shape; no spaces/letters-as-words.
    const idShape = /^contour:[a-z-]+:len\d+:[-\d]+(?:-[-\d]+)*@r\d+$/
    for (const id of CELL_IDS) expect(id).toMatch(idShape)
  })
})

// --------------------------------------------------------------- metric bank
describe("metric profiles", () => {
  it("exposes the expected profiles via the corpus + lookup", () => {
    expect(METRIC_PROFILES.length).toBeGreaterThanOrEqual(5)
    expect(MELODY_CORPUS.metric).toBe(METRIC_PROFILES)
    expect(getMetric("four-on-floor")).toBeDefined()
    expect(getMetric("metric:ballad")).toBeDefined()
    expect(getMetric("nope")).toBeUndefined()
  })

  it("each profile is downbeat-strongest with a suppressed pre-downbeat", () => {
    for (const m of METRIC_PROFILES) {
      expect(m.weights.length).toBe(m.barSixteenths)
      for (const w of m.weights) {
        expect(w).toBeGreaterThanOrEqual(0)
        expect(w).toBeLessThanOrEqual(1)
      }
      // Downbeat is the global maximum.
      expect(m.weights[0]).toBe(Math.max(...m.weights))
      // The last sixteenth (pre-downbeat 32nd zone) is strongly suppressed.
      const last = m.weights[m.weights.length - 1]
      expect(last).toBeLessThanOrEqual(0.2)
      expect(last).toBeLessThanOrEqual(m.weights[0] * 0.25)
      // Beat positions dominate the weak odd sixteenths.
      const beats = [0, 4, 8, 12].map((i) => m.weights[i])
      const odds = [1, 3, 5, 7, 9, 11, 13, 15].map((i) => m.weights[i])
      expect(Math.min(...beats)).toBeGreaterThanOrEqual(Math.max(...odds))
    }
  })
})

// ----------------------------------------------------------- transition bank
describe("transition tables", () => {
  it("exposes the expected tables via the corpus + lookup", () => {
    expect(TRANSITION_TABLES.length).toBeGreaterThanOrEqual(3)
    expect(MELODY_CORPUS.transitions).toBe(TRANSITION_TABLES)
    expect(getTransition("stepwise")).toBeDefined()
    expect(getTransition("transition:pentatonic")).toBeDefined()
    expect(getTransition("nope")).toBeUndefined()
  })

  it("each table is a square, non-negative matrix with no dead state", () => {
    for (const t of TRANSITION_TABLES) {
      expect(t.weights.length).toBe(t.scaleSize)
      expect(t.octaveBias).toBeGreaterThanOrEqual(0)
      expect(t.octaveBias).toBeLessThanOrEqual(1)
      for (const row of t.weights) {
        expect(row.length).toBe(t.scaleSize)
        let sum = 0
        for (const w of row) {
          expect(w).toBeGreaterThanOrEqual(0)
          sum += w
        }
        expect(sum).toBeGreaterThan(0) // every degree can move somewhere
      }
    }
  })
})

// ------------------------------------------------------------ degree→pitch
describe("degreeToPitch bridge", () => {
  it("maps the tonic, steps, and octave wraps in 12-TET", () => {
    expect(degreeToPitch(0, MAJOR_AP, 60)).toMatchObject({ midi: 60, detuneCents: 0 })
    expect(degreeToPitch(1, MAJOR_AP, 60).midi).toBe(62) // major 2nd
    expect(degreeToPitch(2, MAJOR_AP, 60).midi).toBe(64) // major 3rd
    expect(degreeToPitch(7, MAJOR_AP, 60).midi).toBe(72) // octave up
    expect(degreeToPitch(-1, MAJOR_AP, 60).midi).toBe(59) // leading tone below
    expect(degreeToPitch(-7, MAJOR_AP, 60).midi).toBe(48) // octave down
  })

  it("carries non-12-TET cents as a residual detune", () => {
    const maqamAp: ActivePitches = {
      tonicPc: 0,
      cents: [0, 145, 400, 500, 700, 845, 1100], // neutral 2nd/6th (≈ three-quarter tone)
      pcs: [0, 1, 4, 5, 7, 9, 11],
    }
    const d1 = degreeToPitch(1, maqamAp, 60)
    expect(d1.midi).toBe(61) // nearest semitone (145¢ → C#)
    expect(d1.detuneCents).toBeCloseTo(45, 5) // +45¢ neutral
    expect(d1.centsAboveTonic).toBe(145)
  })
})

// ------------------------------------------------------------- generation
describe("generateMelody", () => {
  const table = getTransition("stepwise")!
  const metric = getMetric("four-on-floor")!

  it("is deterministic given a seed", () => {
    const a = generateMelody({ table, metric, bars: 4 }, rngFrom(123))
    const b = generateMelody({ table, metric, bars: 4 }, rngFrom(123))
    expect(a).toEqual(b)
    const c = generateMelody({ table, metric, bars: 4 }, rngFrom(124))
    expect(c).not.toEqual(a) // different seed → different line
  })

  it("seeds the first downbeat on startDegree and stays in phrase + range", () => {
    const bars = 4
    const notes = generateMelody({ table, metric, bars, startDegree: 0, density: 0.8 }, rngFrom(7))
    expect(notes[0].pos).toBe(0)
    expect(notes[0].degree).toBe(0)
    let lastPos = -1
    for (const n of notes) {
      expect(n.pos).toBeGreaterThanOrEqual(0)
      expect(n.pos).toBeLessThan(bars * metric.barSixteenths)
      expect(n.pos).toBeGreaterThanOrEqual(lastPos) // ascending
      lastPos = n.pos
      expect(n.dur).toBeGreaterThanOrEqual(1)
      expect(n.degree).toBeGreaterThanOrEqual(-2 * table.scaleSize)
      expect(n.degree).toBeLessThanOrEqual(2 * table.scaleSize)
    }
  })

  it("density 0 collapses to the single forced downbeat; higher density adds notes", () => {
    const sparse = generateMelody({ table, metric, bars: 4, density: 0 }, rngFrom(9))
    expect(sparse.length).toBe(1)
    expect(sparse[0].pos).toBe(0)
    const dense = generateMelody({ table, metric, bars: 4, density: 1 }, rngFrom(9))
    expect(dense.length).toBeGreaterThan(sparse.length)
  })
})

// ----------------------------------------------------------- cell utilities
describe("cell transforms", () => {
  it("transposeCell shifts every degree + the range; 0 is identity", () => {
    const c = CELLS[0]
    expect(transposeCell(c, 0)).toBe(c)
    const up = transposeCell(c, 3)
    expect(up.range).toEqual([c.range[0] + 3, c.range[1] + 3])
    up.notes.forEach((n, i) => expect(n.degree).toBe(c.notes[i].degree + 3))
    expect(up.id).not.toBe(c.id)
  })

  it("cellToNotes places a cell at a bar offset", () => {
    const c = CELLS[0]
    const at = cellToNotes(c, 16)
    expect(at[0].pos).toBe(c.notes[0].pos + 16)
    expect(at.length).toBe(c.notes.length)
  })
})
