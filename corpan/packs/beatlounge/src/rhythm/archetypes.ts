/**
 * beatlounge — SHIPPED per-role metric ARCHETYPES (the generator's "musical DNA").
 *
 * The founder's ask: "for every groove, different beats have different weights /
 * probabilities / emphasis … spread that rhythm out over ALL of the drums/rows
 * … with stochasticity and varied probabilities THAT WE SHIP WITH THE APP."
 *
 * This file ships those weights. For each kit FAMILY (kick, snare, hats, toms,
 * perc…) we author a metric WEIGHT CURVE over a bar: per sixteenth-step, how
 * LIKELY a hit is (`prob`) and how LOUD when it fires (`emphasis` → a velocity
 * band). These are the timeless metric truths of a drum kit:
 *
 *   • KICK lives on the downbeats (1 & 3 strong) with occasional "&-of" and
 *     "e/a" syncopation; beat 1 is the strongest BUT capped < 1 — we may still
 *     skip it (the founder: "still a strong possibility we SKIP it").
 *   • SNARE/CLAP own the BACKBEATS (2 & 4) loud, with quiet ghost fills between.
 *   • CLOSED HAT is the steady subdivision engine — every 8th solid, the 16th
 *     "e/a" lighter, with a swing lean on the "&".
 *   • OPEN HAT colours the OFF-beats (the "&"s), sparse and bright.
 *   • PEDAL HAT chicks on the back-beats.
 *   • RIDE rides the 8ths (a jazzier alt to the closed hat); CRASH marks the
 *     downbeat of the bar, rare.
 *   • TOMS / CONGA / COWBELL / TAMB / SHAKER / CLAVES are sparse syncopated
 *     COLOUR — low base probability, leaning to off-beats and the "a"s, so the
 *     generator sprinkles tasteful fills across the kit instead of a wall.
 *
 * Each step also carries a VARIANCE half-width so repeated generation differs:
 * the live probability is jittered ±`vary` per press (seeded), so the strongest
 * steps stay frequent-but-not-identical and the kit breathes.
 *
 * RESOLUTION. Curves are authored at 16 steps (4 beats × 4 sixteenths = one 4/4
 * bar). `weightAt(curve, step, steps)` resamples to ANY grid length by phase, so
 * a 12-step (triplet) or 32-step (double-bar) grid reuses the same musical DNA.
 *
 * IP-SAFE: these are generic metric templates (downbeat/backbeat/off-beat math),
 * NOT any song or artist pattern.
 *
 * Pure data + pure lookups. No RNG here (the generator owns the dice); no audio.
 */

import type { KitFamily } from "./kit"

/** One step's authored weighting on the 16-step reference bar. */
export interface ArchStep {
  /** Base placement probability at this step (0..1), pre density/signature. */
  prob: number
  /** Emphasis 0..1 — the CENTER of the velocity band when a hit fires here. */
  emphasis: number
  /** Per-press probability jitter half-width (0..~0.2) — keeps presses varied. */
  vary: number
}

/** A full archetype: a 16-step metric curve + how loud its velocity band spreads. */
export interface Archetype {
  /** 16 steps over one 4/4 bar (cell 0 = beat 1, 4 = beat 2 …). */
  curve: ArchStep[]
  /** Velocity band half-width around each step's emphasis (breathes per hit). */
  bandHalf: number
}

const REF_STEPS = 16

// ----------------------------------------------------------------- curve sugar
/** Build a 16-step curve from sparse {step: [prob, emphasis, vary]} entries; any
 *  step you omit defaults to a near-silent baseline (prob 0.015) so EVERY step is
 *  defined and a few surprise off-pattern ghosts can still slip through. */
const curve = (
  spec: Record<number, [prob: number, emphasis: number, vary?: number]>,
  baseProb = 0.015,
  baseEmph = 0.34
): ArchStep[] => {
  const out: ArchStep[] = []
  for (let s = 0; s < REF_STEPS; s++) {
    const e = spec[s]
    out.push(
      e
        ? { prob: e[0], emphasis: e[1], vary: e[2] ?? 0.06 }
        : { prob: baseProb, emphasis: baseEmph, vary: 0.02 }
    )
  }
  return out
}

// Step landmarks on the 16-step bar (named so the tables read like a score):
//   beats        0, 4, 8, 12
//   "&" (8ths)   2, 6, 10, 14
//   "e"/"a"(16ths) 1,3, 5,7, 9,11, 13,15

/**
 * THE ARCHETYPE LIBRARY — one metric curve per kit family. The strongest cell of
 * every curve is capped at 0.86 (NEVER 1.0): even a beat-1 kick can be skipped.
 */
export const ARCHETYPES: Record<KitFamily, Archetype> = {
  // KICK — anchor the downbeats (1 strongest, 3 strong), push the "& of 3"/"a of
  // 4" for forward motion, light syncopation elsewhere.
  kick: {
    curve: curve({
      0: [0.86, 0.92, 0.08], // beat 1 — the rock, still skippable
      3: [0.12, 0.6, 0.07], // a-of-1 pickup
      6: [0.28, 0.66, 0.1], // & of 2
      8: [0.6, 0.82, 0.1], // beat 3
      10: [0.18, 0.6, 0.08], // & of 3
      11: [0.2, 0.62, 0.1], // a of 3 (the classic push)
      14: [0.22, 0.6, 0.1], // & of 4
    }),
    bandHalf: 0.1,
  },

  // SNARE — the BACKBEAT (2 & 4) loud; ghost notes between for groove.
  snare: {
    curve: curve({
      4: [0.82, 0.9, 0.07], // beat 2 — backbeat
      12: [0.82, 0.9, 0.07], // beat 4 — backbeat
      2: [0.08, 0.4, 0.06], // ghost
      7: [0.12, 0.42, 0.08], // ghost lead-in to 2/3
      10: [0.1, 0.4, 0.07], // ghost
      14: [0.16, 0.46, 0.1], // ghost push into 1
      15: [0.12, 0.44, 0.09],
    }),
    bandHalf: 0.12,
  },

  // RIM / sidestick — a softer backbeat alternative + bossa-ish cross-stick
  // off-beats; sparse so it's a colour, not a second snare.
  rim: {
    curve: curve({
      4: [0.3, 0.66, 0.1],
      12: [0.3, 0.66, 0.1],
      6: [0.16, 0.55, 0.1],
      10: [0.16, 0.55, 0.1],
      14: [0.14, 0.52, 0.1],
    }),
    bandHalf: 0.12,
  },

  // CLAP — like the snare backbone but a touch sparser/brighter (layer over 2/4).
  clap: {
    curve: curve({
      4: [0.5, 0.86, 0.1],
      12: [0.5, 0.86, 0.1],
      8: [0.1, 0.6, 0.08],
      14: [0.12, 0.6, 0.1],
    }),
    bandHalf: 0.1,
  },

  // CLOSED HAT — the steady subdivision engine: every 8th solid, 16ths lighter,
  // a swing-emphasis lift on the "&".
  "hat-closed": {
    curve: curve({
      0: [0.7, 0.62, 0.08],
      2: [0.66, 0.7, 0.1], // & — swing accent
      4: [0.7, 0.6, 0.08],
      6: [0.66, 0.7, 0.1],
      8: [0.7, 0.62, 0.08],
      10: [0.66, 0.7, 0.1],
      12: [0.7, 0.6, 0.08],
      14: [0.66, 0.7, 0.1],
      1: [0.26, 0.46, 0.12], // 16th fills
      3: [0.26, 0.46, 0.12],
      5: [0.26, 0.46, 0.12],
      7: [0.26, 0.46, 0.12],
      9: [0.26, 0.46, 0.12],
      11: [0.26, 0.46, 0.12],
      13: [0.26, 0.46, 0.12],
      15: [0.3, 0.5, 0.12],
    }),
    bandHalf: 0.14,
  },

  // PEDAL HAT — a foot "chick" on the back-beats (2 & 4), occasionally the "&".
  "hat-pedal": {
    curve: curve({
      4: [0.34, 0.55, 0.1],
      12: [0.34, 0.55, 0.1],
      6: [0.1, 0.45, 0.08],
      14: [0.12, 0.45, 0.08],
    }),
    bandHalf: 0.1,
  },

  // OPEN HAT — bright OFF-beats (the "&"s): the disco/house lift. Sparse.
  "hat-open": {
    curve: curve({
      2: [0.26, 0.74, 0.12],
      6: [0.3, 0.78, 0.12],
      10: [0.26, 0.74, 0.12],
      14: [0.34, 0.8, 0.14], // the strongest "& of 4" lift
    }),
    bandHalf: 0.12,
  },

  // RIDE — a jazz/rock ride on the 8ths (alt to the closed hat); bell on beats.
  ride: {
    curve: curve({
      0: [0.4, 0.7, 0.1],
      2: [0.3, 0.6, 0.1],
      4: [0.4, 0.68, 0.1],
      6: [0.3, 0.6, 0.1],
      8: [0.4, 0.7, 0.1],
      10: [0.3, 0.6, 0.1],
      12: [0.4, 0.68, 0.1],
      14: [0.3, 0.6, 0.1],
    }),
    bandHalf: 0.12,
  },

  // CRASH — accent the TOP of the bar (beat 1), rarely the "& of 4" before it.
  crash: {
    curve: curve({
      0: [0.12, 0.88, 0.08],
      14: [0.05, 0.7, 0.05],
    }),
    bandHalf: 0.08,
  },

  // TOM — sparse syncopated colour + fill territory; leans to the "a"s and the
  // back half of the bar (where fills live).
  tom: {
    curve: curve({
      3: [0.06, 0.66, 0.08],
      7: [0.07, 0.68, 0.09],
      11: [0.09, 0.7, 0.1],
      13: [0.12, 0.72, 0.12], // fill into the next bar
      15: [0.14, 0.74, 0.12],
    }),
    bandHalf: 0.12,
  },

  // CONGA — tumbao-flavoured hand drum: open tones on the "&"s + "a of 4".
  conga: {
    curve: curve({
      2: [0.2, 0.62, 0.1],
      6: [0.22, 0.64, 0.1],
      7: [0.16, 0.6, 0.1],
      10: [0.2, 0.62, 0.1],
      14: [0.24, 0.66, 0.12],
      15: [0.2, 0.62, 0.12],
    }),
    bandHalf: 0.12,
  },

  // COWBELL — a steady clave-bell pulse leaning to the quarter + "& of 3".
  cowbell: {
    curve: curve({
      0: [0.16, 0.7, 0.08],
      8: [0.16, 0.7, 0.08],
      10: [0.14, 0.66, 0.1],
      4: [0.1, 0.62, 0.08],
      12: [0.1, 0.62, 0.08],
    }),
    bandHalf: 0.1,
  },

  // TAMB — backbeat shimmer + busy 16th option; soft.
  tamb: {
    curve: curve({
      4: [0.2, 0.6, 0.1],
      12: [0.2, 0.6, 0.1],
      2: [0.1, 0.5, 0.1],
      6: [0.1, 0.5, 0.1],
      10: [0.1, 0.5, 0.1],
      14: [0.12, 0.52, 0.1],
    }),
    bandHalf: 0.12,
  },

  // SHAKER — continuous 16th texture, very soft; the quietest, densest colour.
  shaker: {
    curve: curve({
      0: [0.3, 0.42, 0.1],
      2: [0.34, 0.5, 0.1],
      4: [0.3, 0.42, 0.1],
      6: [0.34, 0.5, 0.1],
      8: [0.3, 0.42, 0.1],
      10: [0.34, 0.5, 0.1],
      12: [0.3, 0.42, 0.1],
      14: [0.34, 0.5, 0.1],
      1: [0.16, 0.36, 0.1],
      5: [0.16, 0.36, 0.1],
      9: [0.16, 0.36, 0.1],
      13: [0.16, 0.36, 0.1],
    }),
    bandHalf: 0.1,
  },

  // CLAVES — the key-pattern bell: sparse, accented, leaning to the tresillo
  // landmarks (1, "a of 2", beat 3-ish). Loud + crisp when it fires.
  claves: {
    curve: curve({
      0: [0.18, 0.82, 0.1],
      3: [0.16, 0.8, 0.1], // a of 1 (tresillo)
      6: [0.16, 0.8, 0.1], // & of 2 (tresillo)
      8: [0.14, 0.78, 0.1],
      12: [0.12, 0.76, 0.1],
    }),
    bandHalf: 0.1,
  },
}

/** The hard cap on ANY archetype probability after all scaling — the founder's
 *  "strongest is still skippable". No (role,step) ever reaches certainty. */
export const PROB_CAP = 0.92

/**
 * Read an archetype's weighting at grid step `step` of a `steps`-long bar,
 * resampling the 16-step reference curve by PHASE. For a 16-step grid this is a
 * direct index; for 12/32/etc. it maps the step's bar-phase to the nearest
 * reference cell, so the same musical DNA fits any resolution.
 */
export const weightAt = (
  arch: Archetype,
  step: number,
  steps: number
): ArchStep => {
  if (steps <= 0) return arch.curve[0]
  if (steps === REF_STEPS) return arch.curve[step % REF_STEPS]
  // Map this step's phase (0..1 through the bar) onto the reference curve.
  const phase = (step % steps) / steps
  const ref = Math.min(REF_STEPS - 1, Math.round(phase * REF_STEPS))
  return arch.curve[ref]
}
