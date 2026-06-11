/**
 * beatlounge — the GROOVE SCATTER PROFILE (the "groove brain"'s feel map).
 *
 * The probabilistic SCATTER engine spreads a groove's *character* across the
 * rows the user selected: for each row × each step it rolls "should a hit land
 * here?" and, if so, picks a velocity. To make that MUSICAL (not a flat 20%),
 * each step needs two numbers derived from the groove itself:
 *
 *   • probability — how likely a hit is at that step. A clave's actual onset
 *     cells get a HIGH chance, its rests a LOW one, so scattering a clave across
 *     5 rows still *feels* like a clave — just spread out and different each time.
 *   • a velocity BAND (min..max) — accents → a loud band, ghosts → a quiet one,
 *     rests → a soft baseline. The engine picks a random velocity inside the band
 *     so repeats breathe.
 *
 * The profile is COMPUTED from a rhythm's existing lanes/accents/ghosts (so all
 * 66 corpus rhythms get a sensible profile for free), and a rhythm MAY override
 * any cell via `rhythm.scatter` (see types.ts). This is the single source of the
 * feel — the engine just rolls dice against it.
 *
 * Pure: no audio, no React, no RNG (the RNG lives in the engine that consumes
 * this). A `GrooveProfile` is one entry per grid CELL, in cell order.
 */

import { hitVelocity, rhythmCells, type Hit, type Lane, type Rhythm } from "./types"

/** One grid cell's resolved scatter weighting (every field concrete). */
export interface ProfileCell {
  /** 0-based grid cell index. */
  cell: number
  /** Placement probability at this step (0..1), before any density scale. */
  prob: number
  /** Velocity band lower bound when a hit fires here (0..1). */
  velMin: number
  /** Velocity band upper bound when a hit fires here (0..1). */
  velMax: number
}

/** A rhythm's full per-cell scatter profile (length = grid cells, in order). */
export type GrooveProfile = ProfileCell[]

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

// Baseline placement chance on a cell NO lane touches (a "rest"). Low but
// non-zero so the scatter still surprises with the odd off-pattern ghost.
const REST_PROB = 0.06
// Floor/ceiling for an ONSET cell's derived probability so even a single quiet
// ghost has a real chance and a loud accent isn't a dead certainty (keeps every
// press different). Strength scales between these by the cell's loudness.
const ONSET_PROB_MIN = 0.45
const ONSET_PROB_MAX = 0.92
// Velocity band half-widths around a cell's representative loudness.
const BAND_HALF = 0.14
// A rest's soft band (used for the rare off-pattern placement).
const REST_VEL_MIN = 0.3
const REST_VEL_MAX = 0.5

/**
 * Derive the scatter profile for ONE cell from the loudest hit any lane plays at
 * that cell (its "representative" stroke). Louder rep ⇒ higher probability + a
 * louder velocity band; absent ⇒ the rest baseline.
 */
const deriveCell = (cell: number, repVel: number | null): ProfileCell => {
  if (repVel == null) {
    return { cell, prob: REST_PROB, velMin: REST_VEL_MIN, velMax: REST_VEL_MAX }
  }
  const v = clamp01(repVel)
  // Map loudness (0.05 ghost … 1.0 accent) onto the onset-probability band.
  const prob = ONSET_PROB_MIN + (ONSET_PROB_MAX - ONSET_PROB_MIN) * v
  const velMin = clamp01(v - BAND_HALF)
  const velMax = clamp01(v + BAND_HALF)
  return { cell, prob, velMin, velMax: Math.max(velMax, velMin + 0.02) }
}

/**
 * Build a rhythm's scatter profile from its lanes (then apply any per-cell
 * `rhythm.scatter` overrides). Works for ANY groove:
 *   • a 1-lane clave → its single pattern's onsets become the high-prob cells;
 *   • a multi-lane groove → each cell takes the LOUDEST stroke across all lanes
 *     (a combined/normalized feel: an accented surdo+caixa hit on beat 1 reads as
 *     a strong cell; a lone ghost reads as a soft one).
 */
export const grooveProfile = (r: Rhythm): GrooveProfile => {
  const cells = rhythmCells(r)
  // Loudest hit velocity seen at each cell across every lane (null ⇒ untouched).
  const rep: (number | null)[] = new Array(cells).fill(null)
  for (const lane of r.lanes as Lane[]) {
    for (const hit of lane.hits as Hit[]) {
      if (hit.cell < 0 || hit.cell >= cells) continue
      const v = hitVelocity(lane, hit)
      const cur = rep[hit.cell]
      if (cur == null || v > cur) rep[hit.cell] = v
    }
  }

  const profile: GrooveProfile = []
  for (let c = 0; c < cells; c++) profile.push(deriveCell(c, rep[c]))

  // Apply sparse per-rhythm overrides (only the fields present).
  if (r.scatter && r.scatter.length > 0) {
    for (const o of r.scatter) {
      if (o.cell < 0 || o.cell >= cells) continue
      const p = profile[o.cell]
      if (o.prob != null) p.prob = clamp01(o.prob)
      if (o.velMin != null) p.velMin = clamp01(o.velMin)
      if (o.velMax != null) p.velMax = clamp01(o.velMax)
      if (p.velMax < p.velMin) p.velMax = p.velMin // keep the band sane
    }
  }
  return profile
}
