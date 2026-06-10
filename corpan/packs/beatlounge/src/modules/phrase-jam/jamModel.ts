/**
 * beatlounge — derive the phrase-JAM step-grid VIEW from a FragmentTrack + bank.
 *
 * The Jam screen is the drum sequencer for SAVED PHRASE SNIPPETS: one LANE per
 * `FragmentRef` in `doc.fragmentLibrary` (the bank), STEPS along the loop on the
 * track's grid (exactly like the drum step-grid's `stepsInLoop(loopTicks, grid)`
 * + `tickForStep`). A cell is ON when a `FragmentEvent` exists at that lane's
 * fragmentId AND that step's tick — placing one = `placeFragment`, clearing =
 * `removeFragment`. This module mirrors `step-grid/gridModel.ts` so the columns
 * line up tick-for-tick with the rest of the app.
 *
 * Pure / no audio / no store — fully unit-testable.
 */

import type {
  BeatloungeDoc,
  FragmentEvent,
  FragmentRef,
  FragmentTrack,
  Id,
} from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"

/** Per-step state for one bank-snippet lane. */
export interface JamCell {
  on: boolean
  /** The placed event id (for `removeFragment` / `editFragment`). */
  fragId?: Id
  /** 0..1 — drives the on-cell glow (the event's gain). */
  gain: number
}

/** One lane = one saved snippet from the bank. */
export interface JamLane {
  ref: FragmentRef
  /** Short label (the snippet text, trimmed for the head). */
  label: string
  /** Language tag for the small chip (uppercased code). */
  langTag: string
  /** The default / current per-lane pitch (semitones) for NEW placements —
   *  derived from the most recent placed event on this lane, else 0. */
  pitchSemis: number
  cells: JamCell[]
}

export interface JamView {
  steps: number
  /** Steps per beat on this grid (for downbeat accents). */
  stepsPerBeat: number
  lanes: JamLane[]
}

/** A trimmed, single-line label for a snippet lane head. */
export const laneLabel = (ref: FragmentRef): string => {
  const t = (ref.text ?? "").trim()
  if (!t) return "snippet"
  return t.length > 24 ? `${t.slice(0, 23)}…` : t
}

/**
 * Build the JAM grid view: bank snippets (newest last) as lanes × loop steps,
 * lighting the cell wherever a FragmentEvent on `track` references that lane's
 * snippet at that step's tick. Mirrors step-grid's tick mapping exactly.
 */
export const buildJamView = (
  doc: BeatloungeDoc,
  track: FragmentTrack,
  bank: FragmentRef[]
): JamView => {
  const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
  const stepsPerBeat = Math.max(1, Math.round(track.grid.denominator / 4))

  // Index placed events by (tick → fragmentId) for O(1) cell lookup, and track
  // the latest pitch seen per fragmentId (the lane's "current" pitch default).
  const byTickFrag = new Map<string, FragmentEvent>()
  const latestPitch = new Map<Id, number>()
  for (const ev of track.fragments) {
    byTickFrag.set(`${ev.tick}:${ev.fragmentId}`, ev)
    latestPitch.set(ev.fragmentId, ev.pitchSemis)
  }

  const lanes: JamLane[] = bank.map((ref) => {
    const cells = Array.from({ length: steps }, (_, s): JamCell => {
      const tick = tickForStep(s, track.grid)
      const ev = byTickFrag.get(`${tick}:${ref.id}`)
      return ev ? { on: true, fragId: ev.id, gain: ev.gain } : { on: false, gain: 0.9 }
    })
    return {
      ref,
      label: laneLabel(ref),
      langTag: (ref.language ?? "").toUpperCase(),
      pitchSemis: latestPitch.get(ref.id) ?? 0,
      cells,
    }
  })

  return { steps, stepsPerBeat, lanes }
}

/** Is the (fragmentId, step) cell currently lit on this track? */
export const cellEventAt = (
  track: FragmentTrack,
  fragmentId: Id,
  step: number
): FragmentEvent | undefined => {
  const tick = tickForStep(step, track.grid)
  return track.fragments.find((e) => e.tick === tick && e.fragmentId === fragmentId)
}

/** Clamp a pitch into the engine's live range. */
export const clampPitch = (semis: number): number =>
  Math.max(-24, Math.min(24, Math.round(semis)))

// ----------------------------------------------------------- musical scales
/**
 * Pitch-class sets (semitone offsets within ONE octave, relative to centre 0)
 * for the live ribbon's snap-to-scale and the scramble riff. These are real,
 * named scales so the control reads as music — NOT bare chromatic snapping.
 * `chromatic` is the "off" identity (every semitone is in-scale).
 */
export type ScaleId =
  | "chromatic"
  | "major"
  | "majorPent"
  | "minorPent"
  | "minor"

export interface ScaleDef {
  id: ScaleId
  /** Short, plain-language label for the picker chip. */
  label: string
  /** Ascending semitone offsets within an octave (0..11). */
  degrees: number[]
}

export const SCALES: ScaleDef[] = [
  { id: "chromatic", label: "Chromatic", degrees: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: "major", label: "Major", degrees: [0, 2, 4, 5, 7, 9, 11] },
  { id: "majorPent", label: "Major Pent", degrees: [0, 2, 4, 7, 9] },
  { id: "minorPent", label: "Minor Pent", degrees: [0, 3, 5, 7, 10] },
  { id: "minor", label: "Minor", degrees: [0, 2, 3, 5, 7, 8, 10] },
]

/** Minor pentatonic is the always-tuneful default for performing/scratching. */
export const DEFAULT_SCALE: ScaleId = "minorPent"

const scaleById = (scale: ScaleId): ScaleDef =>
  SCALES.find((s) => s.id === scale) ?? SCALES[0]

/**
 * Snap a (possibly fractional) semitone bend to the nearest in-scale semitone of
 * `scale`, relative to centre (0 = the snippet's natural pitch). Pure + total.
 * `chromatic` just rounds. The scale repeats every octave in BOTH directions, so
 * a degree like the minor-pentatonic ♭3 lands at +3 going up and −9 going down
 * — always a consonant interval above or below the word. Result is clamped to
 * ±`span` so the ribbon never snaps past its own range.
 */
export const snapToScale = (
  semis: number,
  scale: ScaleId,
  span = 36
): number => {
  const def = scaleById(scale)
  if (def.id === "chromatic") {
    return Math.max(-span, Math.min(span, Math.round(semis)))
  }
  // Build the in-scale pitch set across the full ±span range (octave-repeating),
  // then pick the nearest to `semis`. Bounded loops → cheap + allocation-light.
  let best = 0
  let bestDist = Infinity
  const maxOct = Math.ceil(span / 12)
  for (let oct = -maxOct; oct <= maxOct; oct++) {
    for (const d of def.degrees) {
      const pitch = oct * 12 + d
      if (pitch < -span || pitch > span) continue
      const dist = Math.abs(pitch - semis)
      if (dist < bestDist) {
        bestDist = dist
        best = pitch
      }
    }
  }
  return best
}

// ----------------------------------------------------------- scramble
/** A planned scramble cell (lane index + step) to place. */
export interface ScramblePlacement {
  laneIndex: number
  step: number
  pitchSemis: number
}

/** Scramble draws pitches from this bounded, musical palette (semitones around
 *  centre): a two-octave minor pentatonic, −12..+12, so a scrambled bar reads as
 *  a tuneful riff and NEVER bunches at the clamp ceiling. */
const SCRAMBLE_PALETTE = [-12, -9, -7, -5, -3, 0, 3, 5, 7, 10, 12]

/**
 * Plan a stochastic (re)placement of bank snippets across the grid for happy
 * accidents — pure given an RNG so it's reproducible (reroll = fresh seed) and
 * undoable in one batch. Each step column gets at most one snippet (so the bar
 * reads as a phrase, not mud); `density` ∈ 0..1 controls how many columns fire.
 *
 * Each fired column draws an INDEPENDENT pitch from `SCRAMBLE_PALETTE` (a bounded
 * minor-pentatonic spanning an octave either side of centre). Pitches are varied
 * and modest — they do NOT climb with bar position — so the riff sounds playful
 * and tuneful and never pins to +24.
 */
export const planScramble = (
  laneCount: number,
  steps: number,
  rng: () => number,
  density = 0.6
): ScramblePlacement[] => {
  if (laneCount <= 0 || steps <= 0) return []
  const out: ScramblePlacement[] = []
  for (let step = 0; step < steps; step++) {
    if (rng() > density) continue
    const laneIndex = Math.floor(rng() * laneCount) % laneCount
    const pick = Math.floor(rng() * SCRAMBLE_PALETTE.length) % SCRAMBLE_PALETTE.length
    const semis = clampPitch(SCRAMBLE_PALETTE[pick])
    out.push({ laneIndex, step, pitchSemis: semis })
  }
  return out
}
