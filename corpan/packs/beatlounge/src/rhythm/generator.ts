/**
 * beatlounge — THE STOCHASTIC DRUM-BEAT GENERATOR (the +/− dial's brain).
 *
 * The founder's #1 ask: pressing "+" on the home page GENERATES a genuinely new,
 * surprising, musical drum beat across the WHOLE kit — "we expect ~5 hits to show
 * up… but since it's random we may get 1 or 10". Not a stock beat. This is that.
 *
 * HOW IT WORKS. Given a chosen groove + a grid length + a DENSITY level, build the
 * per-(role, step) weight table (./weights: archetypes × the groove's signature),
 * then walk EVERY kit row × EVERY step and roll the dice:
 *
 *     for row in ALL kit rows:
 *       for step in 0..steps:
 *         p = clamp(table[row][step].prob ± vary-jitter) * densityScale(level)
 *         if rng() < p:
 *           place a hit at a velocity sampled from this cell's band
 *
 * So every press is a fresh, stochastic beat spread over the entire kit — kick on
 * the downbeats, snare on the backbeats, hats subdividing, perc colour — flavoured
 * by the chosen groove, and DIFFERENT every time (the caller passes a fresh seed).
 *
 * DENSITY. The dial moves a `level` (0..LEVELS). `densityScale(level)` maps it to
 * a multiplier tuned so level 1 from empty averages ~5 hits (legitimately 1–10),
 * and higher levels pack the kit. Level 0 ⇒ empty. The mapping is calibrated
 * against the table's total weight so "~5" holds across grooves (see DENSITY_TUNE).
 *
 * Pure + seeded: deterministic given the rng, so the distribution is unit-testable.
 * No audio, no React, no doc mutation — returns tick-addressed NotePlacements.
 */

import { PPQ } from "../model/timing"
import { buildWeightTable, type KitWeightTable } from "./weights"
import type { NotePlacement } from "./engine"
import type { Rhythm } from "./types"

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Dial levels — how many "+" presses from empty to a packed kit. */
export const DENSITY_LEVELS = 6

/**
 * DENSITY CALIBRATION — strong beats stay STRONG, weak beats gate out.
 *
 * A naïve flat multiplier (`prob × scale`) crushes EVERY cell equally, so at low
 * density even the beat-1 kick (prob 0.86) becomes rare — the opposite of musical.
 * Instead density shapes the curve with a CONTRAST EXPONENT `gamma`:
 *
 *     p_eff(cell) = clamp(prob ± jitter)^gamma × gain
 *
 * At LOW density gamma is HIGH (e.g. 2.4) so weak cells (0.2 → 0.2^2.4 ≈ 0.02)
 * vanish while strong cells (0.86 → 0.86^2.4 ≈ 0.69) survive — the few hits you get
 * are the RIGHT ones (downbeats, backbeats). As density rises gamma relaxes toward
 * 1 (linear) and `gain` grows, so colour + syncopation fill in. `gain` is solved
 * per-call against the table's gamma-weighted mass so level 1 still averages ~5.
 *
 * This makes the strongest cells "high probability … but still skippable" and the
 * near-0 cells almost-always-skipped — exactly the founder's weighting.
 */
/** Target expected hit count for a single "+" from empty. */
export const LEVEL1_TARGET_HITS = 5
/** Contrast exponent per level — high at low density (only strong cells), easing
 *  toward ~1 (linear, everything fills in) as the dial climbs. Index by level. */
const GAMMA_BY_LEVEL = [3, 2.4, 1.9, 1.5, 1.25, 1.1, 1] as const
/** The expected-hit multiplier the level targets (level 1 = the ~5 anchor, then a
 *  geometric ramp so each "+" packs the kit more). */
const TARGET_GROWTH = 2.0
/** Hard ceiling on the per-cell gain so even max density never forces certainty. */
const MAX_GAIN = 1

const clampGamma = (level: number): number =>
  GAMMA_BY_LEVEL[Math.min(GAMMA_BY_LEVEL.length - 1, Math.max(0, level - 1))]

export interface GenerateOptions {
  /** Loop length in ticks to tile across (defaults to the groove's bar). */
  loopTicks?: number
  /** Grid resolution: steps per beat (default 4 ⇒ sixteenths). */
  stepsPerBeat?: number
  /** Dial level 0..DENSITY_LEVELS (0 ⇒ empty). Default 1 (~5 hits). */
  level?: number
  /** Explicit density gain override (0..1) — bypasses the level→gain solve. */
  scale?: number
  /** Restrict generation to these kit pitches (rows). Empty/undefined ⇒ ALL rows. */
  rows?: number[]
  /** Scale all chosen velocities (0..1). Default 1. */
  intensity?: number
}

/**
 * Σ of every (row,step) probability^gamma in the table — the table's gamma-weighted
 * "mass" (the denominator the gain is solved against so the expected count matches
 * the target). With gamma=1 this is the plain probability sum.
 */
export const tableWeightMass = (
  table: KitWeightTable,
  rows?: number[],
  gamma = 1
): number => {
  const rowSet = rows && rows.length > 0 ? new Set(rows) : null
  let sum = 0
  for (let i = 0; i < table.rows.length; i++) {
    if (rowSet && !rowSet.has(table.pitches[i])) continue
    for (const cell of table.rows[i]) sum += Math.pow(cell.prob, gamma)
  }
  return sum
}

/** The target expected hit count at a level (level 1 = the ~5 anchor, geometric). */
const targetHitsForLevel = (level: number): number =>
  LEVEL1_TARGET_HITS * Math.pow(TARGET_GROWTH, level - 1)

/**
 * The density GAIN for a level, solved so the gamma-weighted mass × gain ≈ the
 * level's target hit count (level 1 ≈ LEVEL1_TARGET_HITS), capped at MAX_GAIN.
 * Pure. `gammaMass` is `tableWeightMass(table, rows, gammaFor(level))`.
 */
export const densityScale = (level: number, gammaMass: number): number => {
  if (level <= 0 || gammaMass <= 0) return 0
  return Math.min(MAX_GAIN, targetHitsForLevel(level) / gammaMass)
}

/** The contrast exponent (gamma) for a level — public for tests/tuning. */
export const gammaForLevel = (level: number): number => clampGamma(level)

/** Ticks per generator step (one beat = PPQ; `stepsPerBeat` steps per beat). */
const stepTicks = (stepsPerBeat: number): number => Math.round(PPQ / Math.max(1, stepsPerBeat))

/**
 * GENERATE a fresh stochastic beat across the kit. Walks every (selected or all)
 * row × every step, rolls against the weight table scaled by density, and places
 * a hit with a velocity sampled from the cell's band. Tiles across `loopTicks`.
 *
 * Deterministic given `rng` → testable. The strongest cells are frequent but
 * never certain (PROB_CAP); ~0-weight cells almost never fire (the surprise ghost).
 */
export const generateBeat = (
  r: Rhythm,
  rng: () => number,
  opts: GenerateOptions = {}
): NotePlacement[] => {
  const stepsPerBeat = Math.max(1, Math.round(opts.stepsPerBeat ?? 4))
  const st = stepTicks(stepsPerBeat)
  const oneBar = st * stepsPerBeat * 4 // a 4-beat bar in ticks (4/4 generator grid)
  if (oneBar <= 0) return []
  const loop = Math.max(oneBar, Math.round(opts.loopTicks ?? oneBar))
  const stepsPerBar = stepsPerBeat * 4

  const table = buildWeightTable(r, stepsPerBar)
  const rowSel = (opts.rows ?? []).filter((p) => Number.isFinite(p))
  const useRows = rowSel.length > 0 ? new Set(rowSel) : null

  const level = opts.level == null ? 1 : Math.max(0, opts.level)
  if (level <= 0 && opts.scale == null) return [] // level 0 = empty
  // Contrast exponent (strong cells survive at low density) + the gain solved so
  // the gamma-weighted mass lands the level's target hit count.
  const gamma = gammaForLevel(level)
  const gammaMass = tableWeightMass(table, useRows ? rowSel : undefined, gamma)
  const gain = opts.scale != null ? clamp01(opts.scale) : densityScale(level, gammaMass)
  if (gain <= 0) return []
  const intensity = opts.intensity == null ? 1 : Math.max(0, opts.intensity)

  // How many bar-copies tile the loop (whole + a partial tail).
  const copies = Math.max(1, Math.ceil(loop / oneBar))

  const out: NotePlacement[] = []
  for (let ri = 0; ri < table.rows.length; ri++) {
    const pitch = table.pitches[ri]
    if (useRows && !useRows.has(pitch)) continue
    const row = table.rows[ri]
    for (let copy = 0; copy < copies; copy++) {
      const offset = copy * oneBar
      for (let s = 0; s < stepsPerBar; s++) {
        const tick = offset + s * st
        if (tick >= loop) continue // truncate a partial trailing bar
        const cell = row[s]
        // Per-press probability jitter (seeded) so presses differ even at the
        // same level — strongest steps stay frequent-but-not-identical.
        const jitter = (rng() - 0.5) * 2 * cell.vary
        // Contrast curve: weak cells gate out at low density; strong cells survive.
        const p = Math.pow(clamp01(cell.prob + jitter), gamma) * gain
        if (rng() >= p) continue // didn't fire here
        const band = cell.velMax - cell.velMin
        const vel = cell.velMin + rng() * (band > 0 ? band : 0)
        out.push({ tick, pitch, velocity: clamp01(vel * intensity) })
      }
    }
  }
  out.sort((a, b) => a.tick - b.tick || a.pitch - b.pitch)
  return out
}
