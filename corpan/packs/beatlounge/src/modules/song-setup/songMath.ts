/**
 * beatlounge — Song Setup pure math + the world-cycle (tala) catalog.
 *
 * This is the deterministic core behind the premium Song surface: it converts
 * between musical units (bars / beats / ticks) given a meter, clamps to the
 * model's legal loop range, and ships a curated catalog of long, odd cycles
 * (Indian talas + a few world rhythms) so exotic meters feel one-tap easy.
 *
 * NO React, NO audio, NO model writes — just numbers and data, fully testable.
 * The UI layers on top and dispatches the real commands (setLoopLength /
 * setMeter / setTempo / setSwing).
 */

import {
  MAX_BEATS,
  MAX_LOOP_TICKS,
  PPQ,
  clampLoopTicks,
  ticksPerBar,
  type TimeSignature,
  type Tick,
} from "../../model/timing"

export { MAX_BEATS, MAX_LOOP_TICKS, PPQ }

// ------------------------------------------------------------------ unit math
/**
 * Ticks of ONE beat for a meter. The denominator is the note value that gets
 * the beat (4 ⇒ quarter, 8 ⇒ eighth), so a beat = PPQ * 4 / denominator.
 * Examples (PPQ 960): 4/4 beat → 960, 6/8 beat → 480, 5/4 beat → 960.
 */
export const beatTicks = (sig: TimeSignature): Tick =>
  Math.round((PPQ * 4) / sig.denominator)

/** Whole beats that fit in `ticks` for a meter (floor — partial beats dropped). */
export const ticksToBeats = (ticks: Tick, sig: TimeSignature): number =>
  Math.floor(ticks / beatTicks(sig))

/** Ticks spanned by `beats` of a meter. */
export const beatsToTicks = (beats: number, sig: TimeSignature): Tick =>
  Math.round(beats * beatTicks(sig))

/** Whole bars that fit in `ticks` for a meter (floor). */
export const ticksToBars = (ticks: Tick, sig: TimeSignature): number =>
  Math.floor(ticks / ticksPerBar(sig))

/** Ticks spanned by `bars` of a meter. */
export const barsToTicks = (bars: number, sig: TimeSignature): Tick =>
  Math.round(bars * ticksPerBar(sig))

/** Beats in one bar of a meter (= the numerator, but derived from ticks). */
export const beatsPerBar = (sig: TimeSignature): number =>
  Math.round(ticksPerBar(sig) / beatTicks(sig))

/**
 * The hard ceiling on BEATS for a given meter. MAX_LOOP_TICKS is fixed at 128
 * QUARTER-notes; in beat-units that ceiling shifts with the denominator (e.g.
 * a meter in eighths can hold up to 256 eighth-beats). We still surface 128 as
 * the headline "up to 128 beats", but the true cap is whatever fits the ticks.
 */
export const maxBeatsForMeter = (sig: TimeSignature): number =>
  Math.floor(MAX_LOOP_TICKS / beatTicks(sig))

/** The most bars that fit under MAX_LOOP_TICKS for a meter. */
export const maxBarsForMeter = (sig: TimeSignature): number =>
  Math.floor(MAX_LOOP_TICKS / ticksPerBar(sig))

// ------------------------------------------------------------------ meter validation
export const MIN_NUMERATOR = 1
export const MAX_NUMERATOR = 32
export const METER_DENOMINATORS = [1, 2, 4, 8, 16] as const
export type MeterDenominator = (typeof METER_DENOMINATORS)[number]

export const isMeterDenominator = (d: number): d is MeterDenominator =>
  (METER_DENOMINATORS as readonly number[]).includes(d)

/** Clamp a numerator to the supported 1..32 range as a whole number. */
export const clampNumerator = (n: number): number =>
  Math.max(MIN_NUMERATOR, Math.min(MAX_NUMERATOR, Math.round(n)))

/** Normalize an arbitrary signature into a legal one. */
export const normalizeMeter = (sig: TimeSignature): TimeSignature => ({
  numerator: clampNumerator(sig.numerator),
  denominator: isMeterDenominator(sig.denominator) ? sig.denominator : 4,
})

export const formatMeter = (sig: TimeSignature): string =>
  `${sig.numerator}/${sig.denominator}`

/** Quick-pick meters surfaced as one-tap chips. */
export interface MeterPreset {
  sig: TimeSignature
  label: string
  /** A short, inviting nickname for the feel. */
  feel: string
}

export const METER_PRESETS: readonly MeterPreset[] = [
  { sig: { numerator: 4, denominator: 4 }, label: "4/4", feel: "Straight" },
  { sig: { numerator: 3, denominator: 4 }, label: "3/4", feel: "Waltz" },
  { sig: { numerator: 6, denominator: 8 }, label: "6/8", feel: "Lilt" },
  { sig: { numerator: 5, denominator: 4 }, label: "5/4", feel: "Take Five" },
  { sig: { numerator: 7, denominator: 8 }, label: "7/8", feel: "Balkan" },
  { sig: { numerator: 9, denominator: 8 }, label: "9/8", feel: "Aksak" },
  { sig: { numerator: 12, denominator: 8 }, label: "12/8", feel: "Shuffle" },
] as const

// ------------------------------------------------------------------ loop snapping
/** Bar-count snap helpers offered as chips. */
export const BAR_SNAPS = [1, 2, 4, 8, 16] as const

// ------------------------------------------------------------------ cycle (tala) catalog
/**
 * A world rhythmic cycle. `beats` is the cycle length in beats; `sig` is a
 * sensible meter that subdivides it; `accents` marks the strong beats (the
 * sam / tali of a tala, or the long-short grouping of a Balkan aksak) as
 * 0-based beat indices — a *visual* affordance (we don't persist accents in the
 * model). `vibhags` optionally groups the cycle for a clave-like read-out.
 */
export interface Cycle {
  id: string
  name: string
  /** Tradition / origin, e.g. "Hindustani tala" or "Balkan". */
  tradition: string
  beats: number
  sig: TimeSignature
  /** Strong-beat indices (0-based) within the cycle. */
  accents: number[]
  /** Optional beat-grouping (e.g. Teental = 4+4+4+4; Rupak = 3+2+2). */
  vibhags?: number[]
  /** One inviting line about the cycle. */
  blurb: string
}

/**
 * The curated catalog. Indian talas dominate (the richest long-cycle tradition)
 * plus a few world rhythms. Lengths verified against the standard count of
 * matras (beats) per tala; meters chosen so beatsPerBar × bars == cycle beats.
 */
export const CYCLE_CATALOG: readonly Cycle[] = [
  {
    id: "teental",
    name: "Teental",
    tradition: "Hindustani tala",
    beats: 16,
    sig: { numerator: 4, denominator: 4 },
    accents: [0, 4, 8, 12],
    vibhags: [4, 4, 4, 4],
    blurb: "The 16-beat backbone of North Indian music. Sam on 1, khali on 9.",
  },
  {
    id: "jhaptal",
    name: "Jhaptal",
    tradition: "Hindustani tala",
    beats: 10,
    sig: { numerator: 5, denominator: 4 },
    accents: [0, 2, 5, 7],
    vibhags: [2, 3, 2, 3],
    blurb: "Ten beats grouped 2+3+2+3 — a gentle, asymmetric sway.",
  },
  {
    id: "rupak",
    name: "Rupak",
    tradition: "Hindustani tala",
    beats: 7,
    sig: { numerator: 7, denominator: 4 },
    accents: [0, 3, 5],
    vibhags: [3, 2, 2],
    blurb: "Seven beats that open on the khali — starts light, lands strong.",
  },
  {
    id: "ektal",
    name: "Ektal",
    tradition: "Hindustani tala",
    beats: 12,
    sig: { numerator: 6, denominator: 4 },
    accents: [0, 2, 4, 6, 8, 10],
    vibhags: [2, 2, 2, 2, 2, 2],
    blurb: "Twelve beats in six pairs — the canvas for slow khayal.",
  },
  {
    id: "dhamar",
    name: "Dhamar",
    tradition: "Hindustani tala",
    beats: 14,
    sig: { numerator: 7, denominator: 4 },
    accents: [0, 5, 10],
    vibhags: [5, 2, 3, 4],
    blurb: "Fourteen beats grouped 5+2+3+4 — the swagger of dhrupad.",
  },
  {
    id: "adi",
    name: "Adi Tala",
    tradition: "Carnatic tala",
    beats: 8,
    sig: { numerator: 4, denominator: 4 },
    accents: [0, 4, 6],
    vibhags: [4, 2, 2],
    blurb: "Eight beats (4+2+2) — the most common cycle in South Indian music.",
  },
  {
    id: "misra-chapu",
    name: "Misra Chapu",
    tradition: "Carnatic tala",
    beats: 7,
    sig: { numerator: 7, denominator: 8 },
    accents: [0, 3],
    vibhags: [3, 4],
    blurb: "A brisk seven (3+4) — the snap of a Carnatic kriti.",
  },
  {
    id: "aksak-9",
    name: "Aksak 9",
    tradition: "Balkan",
    beats: 9,
    sig: { numerator: 9, denominator: 8 },
    accents: [0, 2, 4, 7],
    vibhags: [2, 2, 3, 2],
    blurb: "The 'limping' nine of Bulgarian dance — short-short-long-short.",
  },
  {
    id: "son-clave",
    name: "Son Clave",
    tradition: "Afro-Cuban",
    beats: 16,
    sig: { numerator: 4, denominator: 4 },
    accents: [0, 3, 6, 10, 12],
    vibhags: [4, 4, 4, 4],
    blurb: "Two bars of 4/4 carrying the 3-2 clave — the spine of salsa.",
  },
  {
    id: "ati-31",
    name: "Sankirna Cycle",
    tradition: "Carnatic (long)",
    beats: 31,
    sig: { numerator: 31, denominator: 8 },
    accents: [0, 9, 14, 23],
    vibhags: [9, 5, 9, 8],
    blurb: "A 31-beat marathon — an extended sankirna canvas for the brave.",
  },
] as const

export const findCycle = (id: string): Cycle | undefined =>
  CYCLE_CATALOG.find((c) => c.id === id)

/** A free-form "custom N-beat cycle" — straight beats, accent on 1. */
export const customCycle = (beats: number): Cycle => {
  const n = Math.max(1, Math.min(MAX_BEATS, Math.round(beats)))
  // Prefer a quarter-note meter; if that overflows the tick ceiling, fall back
  // to eighths so very long cycles still fit.
  const quarter: TimeSignature = { numerator: clampNumerator(n), denominator: 4 }
  const sig: TimeSignature =
    n <= MAX_NUMERATOR && beatsToTicks(n, quarter) <= MAX_LOOP_TICKS
      ? quarter
      : { numerator: clampNumerator(n), denominator: 8 }
  return {
    id: "custom",
    name: `${n}-beat cycle`,
    tradition: "Custom",
    beats: n,
    sig,
    accents: [0],
    blurb: `A custom ${n}-beat loop — your own cycle.`,
  }
}

/**
 * Resolve a cycle to the concrete dispatch payload: the loop length in ticks
 * (clamped to the model's legal range) and the initial meter. The UI dispatches
 * setLoopLength{ticks} + setMeter{tick:0, sig} from this.
 */
export interface CyclePlan {
  loopTicks: Tick
  sig: TimeSignature
  /** The accents we'd surface (clipped to the realized beat count). */
  accents: number[]
  /** Beats actually realized after clamping (may be < cycle.beats if huge). */
  beats: number
}

export const planForCycle = (cycle: Cycle): CyclePlan => {
  const sig = normalizeMeter(cycle.sig)
  const wanted = beatsToTicks(cycle.beats, sig)
  const loopTicks = clampLoopTicks(wanted)
  const beats = ticksToBeats(loopTicks, sig)
  const accents = cycle.accents.filter((a) => a < beats)
  return { loopTicks, sig, accents, beats }
}

// ------------------------------------------------------------------ summaries
/** Compact tile summary, e.g. "16 beats · 4/4 · 96bpm" or a tala name. */
export const summarize = (opts: {
  loopTicks: Tick
  sig: TimeSignature
  bpm: number
  cycleName?: string
}): string => {
  const beats = ticksToBeats(opts.loopTicks, opts.sig)
  const head = opts.cycleName ? opts.cycleName : `${beats} beats`
  return `${head} · ${formatMeter(opts.sig)} · ${Math.round(opts.bpm)}bpm`
}
