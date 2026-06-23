/**
 * beatlounge — the STOCHASTIC DRUM GENERATOR: weight model + distribution.
 *
 * Proves the founder's spec concretely:
 *   • the weight table covers the WHOLE kit, strongest prob < 1.0, some ≈ 0;
 *   • generate is deterministic-given-rng, spreads across ALL rows, density scales
 *     the hit count, a "+" from empty averages ~5 (ranges 1–10), and level 0 = empty.
 */

import { describe, expect, it } from "vitest"
import { RHYTHMS, getRhythm } from "./index"
import { buildWeightTable } from "./weights"
import { KIT_ROLES, kitPitches } from "./kit"
import { PROB_CAP } from "./archetypes"
import { generateBeat, densityScale, tableWeightMass, gammaForLevel } from "./generator"
import { DRUM_LANES } from "../modules/step-grid/gridModel"

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clave = () => getRhythm("son-clave-3-2") ?? RHYTHMS[0]

describe("kit ↔ grid lock-step", () => {
  it("KIT_ROLES pitches match the step-grid DRUM_LANES exactly (no invisible rows)", () => {
    expect(kitPitches()).toEqual(DRUM_LANES.map((l) => l.pitch))
    expect(KIT_ROLES.length).toBe(DRUM_LANES.length)
  })
})

describe("weight table shape", () => {
  const table = buildWeightTable(clave(), 16)

  it("has one per-step weight row for EVERY kit role", () => {
    expect(table.rows.length).toBe(KIT_ROLES.length)
    for (const row of table.rows) expect(row.length).toBe(16)
    expect(table.pitches).toEqual(kitPitches())
  })

  it("the strongest probability is < 1.0 (never guaranteed)", () => {
    let strongest = 0
    for (const row of table.rows) for (const c of row) strongest = Math.max(strongest, c.prob)
    expect(strongest).toBeLessThan(1)
    expect(strongest).toBeLessThanOrEqual(PROB_CAP)
  })

  it("EVERY (role,step) cell keeps SOME probability — no groove rejects a drum", () => {
    // The floor means no cell is a dead zero: every place can fire (rarely). Weak
    // steps stay weak (the contrast curve keeps low density musical), but the
    // weighting is never prescriptive enough to lock a row out entirely.
    let min = 1
    let weakCount = 0
    for (const row of table.rows)
      for (const c of row) {
        min = Math.min(min, c.prob)
        if (c.prob < 0.1) weakCount++
      }
    expect(min).toBeGreaterThan(0) // never zero — always some chance
    expect(weakCount).toBeGreaterThan(10) // weak steps still exist (kept musical)
  })

  it("velocity bands are well-formed (velMax > velMin, in 0..1)", () => {
    for (const row of table.rows)
      for (const c of row) {
        expect(c.velMin).toBeGreaterThanOrEqual(0)
        expect(c.velMax).toBeLessThanOrEqual(1)
        expect(c.velMax).toBeGreaterThan(c.velMin)
      }
  })

  it("kick is strong on beat 1, snare strong on the backbeats (archetype DNA)", () => {
    const kickRow = table.rows[0] // KIT_ROLES[0] = kick
    const snareRow = table.rows[1] // KIT_ROLES[1] = snare
    expect(kickRow[0].prob).toBeGreaterThan(0.5) // beat 1
    expect(snareRow[4].prob).toBeGreaterThan(0.5) // beat 2
    expect(snareRow[12].prob).toBeGreaterThan(0.5) // beat 4
    // …but kick on a random off-beat 16th is tiny.
    expect(kickRow[5].prob).toBeLessThan(0.2)
  })

  it("the groove SIGNATURE flavours its rows (clave onsets lift the claves row)", () => {
    // Son clave 3-2 plays the "clave" role (→ pitch 75); its onsets should lift
    // the claves row above the bare archetype.
    const plain = buildWeightTable({ ...clave(), lanes: [] }, 16)
    const flavoured = buildWeightTable(clave(), 16)
    const clavesIdx = KIT_ROLES.findIndex((r) => r.pitch === 75)
    const plainSum = plain.rows[clavesIdx].reduce((s, c) => s + c.prob, 0)
    const flavSum = flavoured.rows[clavesIdx].reduce((s, c) => s + c.prob, 0)
    expect(flavSum).toBeGreaterThan(plainSum)
  })
})

describe("generateBeat — determinism + coverage", () => {
  it("is deterministic given the same rng/seed", () => {
    const a = generateBeat(clave(), mulberry32(42), { level: 2 })
    const b = generateBeat(clave(), mulberry32(42), { level: 2 })
    expect(a).toEqual(b)
  })

  it("different seeds give DIFFERENT beats (genuinely new each press)", () => {
    const a = generateBeat(clave(), mulberry32(1), { level: 2 })
    const b = generateBeat(clave(), mulberry32(2), { level: 2 })
    expect(a).not.toEqual(b)
  })

  it("level 0 = empty", () => {
    expect(generateBeat(clave(), mulberry32(7), { level: 0 })).toEqual([])
  })

  it("spreads across MANY kit rows over a run of seeds (whole kit, not 3 lanes)", () => {
    const touched = new Set<number>()
    for (let s = 0; s < 80; s++)
      for (const p of generateBeat(clave(), mulberry32(s + 1), { level: 1 })) touched.add(p.pitch)
    // The generator should reach the great majority of the 16 kit rows.
    expect(touched.size).toBeGreaterThanOrEqual(14)
  })

  it("higher density ⇒ more hits", () => {
    const avg = (level: number): number => {
      let total = 0
      for (let s = 0; s < 100; s++) total += generateBeat(clave(), mulberry32(s + 1), { level }).length
      return total / 100
    }
    const l1 = avg(1)
    const l2 = avg(2)
    const l3 = avg(3)
    expect(l2).toBeGreaterThan(l1)
    expect(l3).toBeGreaterThan(l2)
  })

  it("respects ~0-weight steps: a kick almost never lands on an off-beat 16th", () => {
    let offbeatKick = 0
    const KICK = 36
    for (let s = 0; s < 300; s++)
      for (const p of generateBeat(clave(), mulberry32(s + 1), { level: 1 }))
        // tick for step 5 (an "e" 16th) at PPQ 960, sixteenths = 240 → 5*240=1200.
        if (p.pitch === KICK && p.tick === 1200) offbeatKick++
    expect(offbeatKick).toBeLessThan(15) // rare surprise, not a habit
  })

  it("strongest steps are FREQUENT but not always (beat-1 kick fires often, sometimes skips)", () => {
    const KICK = 36
    let beat1 = 0
    const N = 300
    for (let s = 0; s < N; s++)
      if (generateBeat(clave(), mulberry32(s + 1), { level: 2 }).some((p) => p.pitch === KICK && p.tick === 0))
        beat1++
    expect(beat1).toBeGreaterThan(N * 0.5) // frequent
    expect(beat1).toBeLessThan(N) // but NOT every press
  })

  it("velocities are sampled in 0..1", () => {
    for (const p of generateBeat(clave(), mulberry32(3), { level: 3 })) {
      expect(p.velocity).toBeGreaterThanOrEqual(0)
      expect(p.velocity).toBeLessThanOrEqual(1)
    }
  })
})

describe("the ~5/1–10 calibration (the founder's headline)", () => {
  const runStats = (rhythmId: string) => {
    const r = getRhythm(rhythmId) ?? RHYTHMS[0]
    let total = 0
    let inRange = 0
    const N = 600
    for (let s = 0; s < N; s++) {
      const n = generateBeat(r, mulberry32((s * 2654435761) >>> 0), { level: 1 }).length
      total += n
      if (n >= 1 && n <= 10) inRange++
    }
    return { avg: total / N, inRangeFrac: inRange / N }
  }

  it("a single + from empty AVERAGES ~5 hits (4–6) across varied grooves", () => {
    for (const id of ["son-clave-3-2", "samba", "amen-break", "teental"]) {
      const { avg } = runStats(id)
      expect(avg).toBeGreaterThanOrEqual(4)
      expect(avg).toBeLessThanOrEqual(6)
    }
  })

  it("the vast majority of presses land in the 1–10 range", () => {
    for (const id of ["son-clave-3-2", "samba"]) {
      const { inRangeFrac } = runStats(id)
      expect(inRangeFrac).toBeGreaterThan(0.95)
    }
  })
})

describe("density calibration helpers", () => {
  it("densityScale(0) is 0", () => {
    const table = buildWeightTable(clave(), 16)
    const mass = tableWeightMass(table, undefined, gammaForLevel(1))
    expect(densityScale(0, mass)).toBe(0)
  })

  it("the contrast exponent (gamma) is HIGH at low density, easing toward 1", () => {
    expect(gammaForLevel(1)).toBeGreaterThan(gammaForLevel(3))
    expect(gammaForLevel(99)).toBeGreaterThanOrEqual(1)
  })

  it("level-1 gain × gamma-weighted mass ≈ the target hit count (~5)", () => {
    const table = buildWeightTable(clave(), 16)
    const g = gammaForLevel(1)
    const gammaMass = tableWeightMass(table, undefined, g)
    const expected = densityScale(1, gammaMass) * gammaMass
    expect(expected).toBeGreaterThan(4)
    expect(expected).toBeLessThan(6)
  })
})

describe("row selection", () => {
  it("with `rows` set, generates ONLY on those rows", () => {
    const KICK = 36
    const SNARE = 38
    const beat = generateBeat(clave(), mulberry32(5), { level: 4, rows: [KICK, SNARE] })
    for (const p of beat) expect([KICK, SNARE]).toContain(p.pitch)
  })
})
