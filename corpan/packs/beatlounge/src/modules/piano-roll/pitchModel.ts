/**
 * beatlounge — derive the piano-roll VIEW from a melodic InstrumentTrack.
 *
 * Pure functions that map the tick-addressed note set into pitch ROWS × step
 * COLUMNS for rendering, and back via the timing helpers. The visible column
 * count is `stepsInLoop(loopLengthTicks, track.grid)` per the contract; the
 * visible rows span a sensible 2-octave window. One row per MIDI pitch.
 *
 * Scale highlighting: a row is "in scale" when its pitch-class is a degree of
 * the active scale (C-major by default). Accidentals stay reachable — they are
 * rendered as dimmer rows, never hidden — so the player can always play them.
 *
 * Kept free of React so it's unit-testable in isolation.
 */

import type { BeatloungeDoc, InstrumentTrack, Midi } from "../../model/document"
import { stepsInLoop, tickForStep } from "../../model/timing"

/** Pitch-class names (C..B), sharps spelled. Index = pitch % 12. */
export const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const

/** Semitone offsets (from the tonic) of the major scale — the default. */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const

/** A black-key (accidental) pitch-class on a piano keyboard (C-rooted). */
const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

/** Number of pitch rows shown: two octaves (24 semitones) + the top tonic. */
export const ROW_SPAN = 25

/** Default bottom of the visible window: C4 (middle C). */
export const DEFAULT_LOW_PITCH: Midi = 60

export interface PitchRow {
  pitch: Midi
  /** e.g. "C4", "F#4". */
  label: string
  /** Pitch-class is a degree of the active scale (highlight). */
  inScale: boolean
  /** Black key on a piano (accidental) — rendered dimmer but reachable. */
  accidental: boolean
  /** This row's pitch-class is the tonic (octave marker). */
  tonic: boolean
}

export interface RollCell {
  on: boolean
  velocity: number
  /** The note id under this cell, if any (for removal). */
  noteId?: string
}

export interface RollView {
  /** Column count = steps in the loop on this track's grid. */
  steps: number
  /** Steps per beat for downbeat accents. */
  stepsPerBeat: number
  /** Rows top→bottom (highest pitch first, like a real piano roll). */
  rows: PitchRow[]
  /** rows[i].cells[s] — indexed the same as `rows`. */
  cells: RollCell[][]
}

/** MIDI octave number (C4 = 60 ⇒ octave 4), matching scientific notation. */
export const octaveOf = (pitch: Midi): number => Math.floor(pitch / 12) - 1

/** Human label for a MIDI pitch, e.g. 60 → "C4", 61 → "C#4". */
export const pitchLabel = (pitch: Midi): string =>
  `${PITCH_CLASS_NAMES[((pitch % 12) + 12) % 12]}${octaveOf(pitch)}`

/** Is `pitch` a degree of the scale rooted at `tonic` (pitch-class 0..11)? */
export const isInScale = (
  pitch: Midi,
  tonic = 0,
  scale: readonly number[] = MAJOR_SCALE
): boolean => {
  const pc = (((pitch - tonic) % 12) + 12) % 12
  return scale.includes(pc)
}

/**
 * The visible pitch window, highest pitch first. `low` is the bottom row's
 * pitch; `span` rows are shown (default a hair over two octaves so both tonics
 * are visible). C-major (tonic = pitch-class 0) by default.
 */
export const buildRows = (
  low: Midi = DEFAULT_LOW_PITCH,
  span = ROW_SPAN,
  tonic = 0,
  scale: readonly number[] = MAJOR_SCALE
): PitchRow[] => {
  const rows: PitchRow[] = []
  // Highest pitch at the top (descending), like a real piano roll.
  for (let i = span - 1; i >= 0; i--) {
    const pitch = low + i
    const pc = ((pitch % 12) + 12) % 12
    rows.push({
      pitch,
      label: pitchLabel(pitch),
      inScale: isInScale(pitch, tonic, scale),
      accidental: BLACK_KEYS.has(pc),
      tonic: pc === ((tonic % 12) + 12) % 12,
    })
  }
  return rows
}

export interface BuildRollOpts {
  low?: Midi
  span?: number
  tonic?: number
  scale?: readonly number[]
}

/**
 * Map a melodic track's notes onto the (row × step) grid. A note lights every
 * cell it could be addressed from on the grid; we light the cell at the note's
 * own quantized step (the canonical step it sits on).
 */
export const buildRollView = (
  doc: BeatloungeDoc,
  track: InstrumentTrack,
  opts: BuildRollOpts = {}
): RollView => {
  const steps = stepsInLoop(doc.loopLengthTicks, track.grid)
  const stepsPerBeat = Math.max(1, Math.round(track.grid.denominator / 4))
  const rows = buildRows(
    opts.low ?? DEFAULT_LOW_PITCH,
    opts.span ?? ROW_SPAN,
    opts.tonic ?? 0,
    opts.scale ?? MAJOR_SCALE
  )

  // Index notes by (pitch → tick → {velocity,id}) for O(1) cell lookup.
  const byPitchTick = new Map<string, { velocity: number; id: string }>()
  for (const n of track.notes) byPitchTick.set(`${n.pitch}:${n.tick}`, { velocity: n.velocity, id: n.id })

  const cells: RollCell[][] = rows.map((row) =>
    Array.from({ length: steps }, (_, s) => {
      const tick = tickForStep(s, track.grid)
      const hit = byPitchTick.get(`${row.pitch}:${tick}`)
      return hit
        ? { on: true, velocity: hit.velocity, noteId: hit.id }
        : { on: false, velocity: 0.7 }
    })
  )

  return { steps, stepsPerBeat, rows, cells }
}

/**
 * Choose a low-pitch window that centers the track's existing notes, snapping
 * the bottom to a tonic for a tidy keyboard. Falls back to the default window
 * for an empty track. Used so the roll opens framed on the actual melody.
 */
export const autoWindow = (
  track: InstrumentTrack,
  span = ROW_SPAN,
  tonic = 0
): Midi => {
  if (track.notes.length === 0) return DEFAULT_LOW_PITCH
  let lo = Infinity
  let hi = -Infinity
  for (const n of track.notes) {
    if (n.pitch < lo) lo = n.pitch
    if (n.pitch > hi) hi = n.pitch
  }
  const mid = Math.round((lo + hi) / 2)
  let low = mid - Math.floor(span / 2)
  // Snap the bottom row down to the nearest tonic pitch-class for a tidy frame.
  const pc = ((low - tonic) % 12 + 12) % 12
  low -= pc
  // Keep the window inside MIDI range.
  low = Math.max(0, Math.min(127 - (span - 1), low))
  return low
}
