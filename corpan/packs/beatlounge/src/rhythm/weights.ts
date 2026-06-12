/**
 * beatlounge — the per-(ROLE, STEP) WEIGHT TABLE: archetype × groove signature.
 *
 * This is the heart of the new generator. For a chosen groove + a grid length it
 * builds, for EVERY kit row × EVERY step, a `WeightCell`:
 *   • prob     — placement probability (0..1), capped < 1 (always skippable);
 *   • velMin/velMax — the velocity band a hit gets when it fires;
 *   • vary     — per-press probability jitter half-width (so presses differ).
 *
 * TWO SOURCES, COMBINED (the founder's spec):
 *   1. ARCHETYPES (./archetypes) — every kit family's timeless metric curve
 *      (kick→downbeats, snare→backbeats, hats→subdivisions, perc→syncopated
 *      colour). This is what spreads weight over ALL rows, even rows the chosen
 *      groove never plays.
 *   2. The groove's SIGNATURE — the actual onsets/accents of the chosen rhythm,
 *      mapped to the kit rows its roles resolve to. At a groove onset we BOOST
 *      that row's probability + emphasis at that step, so a samba feels like
 *      samba and a clave like a clave: the groove FLAVOURS the archetypes.
 *
 * The signature is folded in as a multiplicative+additive lift (clamped), never a
 * replacement, so the archetypes keep every row alive while the groove tilts the
 * weights toward its character. The strongest resulting cell is still capped at
 * PROB_CAP — never guaranteed.
 *
 * Pure: data in, table out. No RNG, no audio. The generator (./generator) rolls
 * the dice against this table.
 */

import { ARCHETYPES, PROB_CAP, weightAt, type ArchStep } from "./archetypes"
import { KIT_ROLES, ROLE_BY_PITCH, type KitFamily, type KitRole } from "./kit"
import { pitchForRole } from "./roles"
import { hitVelocity, rhythmCells, type Lane, type Rhythm } from "./types"

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** One resolved (role, step) weighting. */
export interface WeightCell {
  /** Placement probability (0..1), already capped < 1. */
  prob: number
  /** Velocity band when a hit fires here. */
  velMin: number
  velMax: number
  /** Per-press probability jitter half-width (the generator applies it). */
  vary: number
}

/** The full table: one row per kit voice (in KIT_ROLES order), each a per-step
 *  array of `steps` cells. `pitches[i]` is the kit pitch for `rows[i]`. */
export interface KitWeightTable {
  steps: number
  pitches: number[]
  labels: string[]
  rows: WeightCell[][]
}

const bandFor = (emphasis: number, half: number): [number, number] => {
  const lo = clamp01(emphasis - half)
  const hi = clamp01(emphasis + half)
  return [lo, Math.max(hi, lo + 0.02)]
}

/** The archetype-only weighting for one kit row at one step (no signature yet). */
const archCell = (family: KitFamily, step: number, steps: number): WeightCell => {
  const arch = ARCHETYPES[family]
  const a: ArchStep = weightAt(arch, step, steps)
  const [velMin, velMax] = bandFor(a.emphasis, arch.bandHalf)
  return { prob: Math.min(a.prob, PROB_CAP), velMin, velMax, vary: a.vary }
}

/**
 * The groove's SIGNATURE as a per-(pitch, step) onset map: each cell the rhythm
 * plays (after role→pitch resolution + grid resampling) carries the LOUDEST hit
 * velocity seen there, so a groove onset can boost that exact row at that step.
 *
 * The rhythm's own cell grid is resampled to the table's `steps` by phase (same
 * approach as the archetypes), so a triplet/long-cycle groove still lands its
 * accents on the right beats of the generator grid.
 */
const signatureMap = (
  r: Rhythm,
  steps: number
): Map<string, number> => {
  const cells = rhythmCells(r)
  const out = new Map<string, number>()
  if (cells <= 0) return out
  for (const lane of r.lanes as Lane[]) {
    const pitch = pitchForRole(lane.role)
    for (const hit of lane.hits) {
      if (hit.cell < 0 || hit.cell >= cells) continue
      // Resample the groove cell → a generator step by phase.
      const step = Math.min(steps - 1, Math.round((hit.cell / cells) * steps))
      const v = hitVelocity(lane, hit)
      const key = `${pitch}:${step}`
      const cur = out.get(key)
      // Signature lanes weigh a touch heavier (the recognisable backbone).
      const w = lane.signature ? Math.min(1, v + 0.08) : v
      if (cur == null || w > cur) out.set(key, w)
    }
  }
  return out
}

/** How hard a groove onset lifts its row's probability at that step. A strong
 *  accented onset roughly doubles the archetype chance there (then capped). */
const SIG_PROB_LIFT = 0.55
/** How much a groove onset pulls the velocity band UP toward the onset's loudness. */
const SIG_EMPH_PULL = 0.5

/**
 * Fold a groove onset (loudness `sigVel`) into an archetype cell: lift its
 * probability toward the cap and pull its velocity band up toward the onset's
 * loudness — so the groove's characteristic hits become frequent-and-loud on the
 * rows it actually plays, WITHOUT silencing the archetype weighting elsewhere.
 */
const applySignature = (base: WeightCell, sigVel: number): WeightCell => {
  const prob = Math.min(PROB_CAP, base.prob + (PROB_CAP - base.prob) * SIG_PROB_LIFT * sigVel)
  const targetMin = clamp01(sigVel - 0.1)
  const targetMax = clamp01(sigVel + 0.06)
  const velMin = clamp01(base.velMin + (targetMin - base.velMin) * SIG_EMPH_PULL)
  const velMax = clamp01(base.velMax + (targetMax - base.velMax) * SIG_EMPH_PULL)
  return {
    prob,
    velMin,
    velMax: Math.max(velMax, velMin + 0.02),
    // A signature onset is slightly steadier (we want it to show up more often).
    vary: Math.max(0.04, base.vary * 0.8),
  }
}

/**
 * Build the per-(role, step) weight table for a groove on a `steps`-long grid.
 * Every kit row gets its archetype curve; rows the groove actually plays get
 * their signature onsets folded in. The result is the WHOLE kit, weighted +
 * flavoured + capped (never certain) — exactly what the generator rolls against.
 */
export const buildWeightTable = (r: Rhythm, steps: number): KitWeightTable => {
  const sig = signatureMap(r, steps)
  const rows: WeightCell[][] = []
  for (const role of KIT_ROLES) {
    const rowCells: WeightCell[] = []
    for (let s = 0; s < steps; s++) {
      let cell = archCell(role.family, s, steps)
      const sigVel = sig.get(`${role.pitch}:${s}`)
      if (sigVel != null) cell = applySignature(cell, sigVel)
      rowCells.push(cell)
    }
    rows.push(rowCells)
  }
  return {
    steps,
    pitches: KIT_ROLES.map((r2: KitRole) => r2.pitch),
    labels: KIT_ROLES.map((r2: KitRole) => r2.label),
    rows,
  }
}

/** The kit role for a pitch (re-export so callers needn't reach into kit.ts). */
export { ROLE_BY_PITCH }
