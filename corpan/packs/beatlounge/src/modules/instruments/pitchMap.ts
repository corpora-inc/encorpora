/**
 * beatlounge — PURE pitch↔position math for the multitouch instrument surface.
 * No React, no audio — just the geometry so it is fully unit-testable.
 *
 * The surface is a horizontal "string field": X maps continuously to pitch
 * (left = low, right = high), stacked into rows where each row is one octave
 * higher than the one below (so a wide range fits a phone AND an iPad, and a
 * finger sliding across a row glides smoothly through every pitch in it). A
 * touch anywhere reads its ABSOLUTE position (a fretless string, not a key).
 *
 * Three play modes share this math:
 *   • "fretless"  — raw continuous pitch (no markers, no snapping).
 *   • "chromatic" — same continuous pitch, with semitone reference markers drawn.
 *   • "scale"     — continuous pitch SNAPPED to the song's scale via the
 *                   `quantizeToScale` seam (the harmony engine wires it later).
 *
 * The mode-lock SEAM: callers pass an optional `quantizeToScale(midi) => midi`.
 * When absent (default), pitch is chromatic/identity — fully usable today; the
 * integrator supplies the real scale resolver from the global Harmony engine.
 */

export type PlayMode = "fretless" | "chromatic" | "scale"

export interface SurfaceRange {
  /** MIDI pitch at the LEFT edge of the lowest row. */
  baseMidi: number
  /** Semitones spanned horizontally within one row (one octave = 12). */
  rowSpanSemis: number
  /** Number of stacked rows (each +rowSpanSemis above the one below). */
  rows: number
}

/** A sensible default range: 2 octaves wide per row, 3 rows (C2..C8-ish). */
export const DEFAULT_RANGE: SurfaceRange = { baseMidi: 36, rowSpanSemis: 24, rows: 3 }

/** Optional snap function — the harmony seam. Identity by default (chromatic). */
export type QuantizeToScale = (midi: number) => number

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

/**
 * Map a normalized pointer position to a FRACTIONAL MIDI pitch.
 *  @param nx 0..1 across the surface width (0 = left, 1 = right).
 *  @param ny 0..1 down the surface height (0 = TOP). Rows are stacked so the
 *            TOP row is the HIGHEST octave (like a stringed instrument held up).
 * Returns continuous pitch; mode/snap is applied by `resolvePitch`.
 */
export const positionToMidi = (
  nx: number,
  ny: number,
  range: SurfaceRange
): number => {
  const rows = Math.max(1, Math.floor(range.rows))
  const cx = clamp(nx, 0, 1)
  const cy = clamp(ny, 0, 1)
  // Which row (0 = bottom/lowest). Top of the surface (cy→0) = highest row.
  const rowFromTop = Math.min(rows - 1, Math.floor(cy * rows))
  const rowIndex = rows - 1 - rowFromTop
  return range.baseMidi + rowIndex * range.rowSpanSemis + cx * range.rowSpanSemis
}

/**
 * Apply the play mode to a continuous pitch. "fretless"/"chromatic" return the
 * raw pitch (markers are a visual concern only); "scale" snaps via the seam
 * (identity when no `quantize` is supplied → still chromatic, fully usable).
 */
export const resolvePitch = (
  rawMidi: number,
  mode: PlayMode,
  quantize?: QuantizeToScale
): number => {
  if (mode === "scale" && quantize) return quantize(rawMidi)
  return rawMidi
}

/** Convenience: position → final playable pitch in one call. */
export const surfacePitch = (
  nx: number,
  ny: number,
  range: SurfaceRange,
  mode: PlayMode,
  quantize?: QuantizeToScale
): number => resolvePitch(positionToMidi(nx, ny, range), mode, quantize)

export interface Marker {
  /** Normalized X (0..1) of this reference line within a row. */
  nx: number
  /** The MIDI pitch class at this marker (for labels / accents). */
  midi: number
  /** True for the start of an octave (C) — drawn stronger. */
  octave: boolean
  /** True when this pitch is IN the active scale (scale mode highlighting). */
  inScale: boolean
}

/**
 * The semitone reference markers to draw within ONE row (chromatic + scale
 * modes). `scalePitches` (pitch CLASSES 0..11) drives in-scale highlighting;
 * when omitted, all chromatic markers are "in scale" (no scale filtering).
 * Returns markers at every semitone boundary from the row's base.
 */
export const rowMarkers = (
  rowBaseMidi: number,
  rowSpanSemis: number,
  scalePitchClasses?: readonly number[]
): Marker[] => {
  const span = Math.max(1, Math.round(rowSpanSemis))
  const inSet = scalePitchClasses && scalePitchClasses.length > 0
    ? new Set(scalePitchClasses.map((p) => ((p % 12) + 12) % 12))
    : null
  const out: Marker[] = []
  for (let s = 0; s < span; s++) {
    const midi = rowBaseMidi + s
    const pc = ((midi % 12) + 12) % 12
    out.push({
      nx: s / span,
      midi,
      octave: pc === 0,
      inScale: inSet ? inSet.has(pc) : true,
    })
  }
  return out
}

/** Format a fractional MIDI pitch as a note name + octave (e.g. "C4", "F#5"),
 *  ignoring the cents fraction — for a compact live readout. */
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
export const midiToNoteName = (midi: number): string => {
  const rounded = Math.round(midi)
  const pc = ((rounded % 12) + 12) % 12
  const octave = Math.floor(rounded / 12) - 1
  return `${NOTE_NAMES[pc]}${octave}`
}
