/**
 * beatlounge — chord-quality interval tables + degree → pitch-class resolution.
 *
 * Pure 12-TET. A quality is a set of SEMITONE offsets from the chord root
 * (root = 0). A scale degree resolves to a pitch class against a KeyMode's
 * diatonic scale; chromatic roots are expressed directly as semitone offsets.
 */

import { mod, toPc } from "../harmony"
import type { CorpusChord, CorpusChordQuality, KeyMode, PitchClass } from "./types"

/**
 * Semitone offsets (from the root, ascending) that DEFINE each quality.
 * Extensions beyond the octave (9th=14, 11th=17, 13th=21) are kept literally so
 * voicing/voice-leading can place them; a higher layer may drop the 5th etc.
 */
export const QUALITY_INTERVALS: Record<CorpusChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  minMaj7: [0, 3, 7, 11],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  six9: [0, 4, 7, 9, 14],
  dom9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  dom11: [0, 7, 10, 14, 17], // dominant 11 commonly omits the 3rd (clashes)
  min11: [0, 3, 7, 10, 14, 17],
  dom13: [0, 4, 7, 10, 14, 21],
  maj13: [0, 4, 7, 11, 14, 21],
  add9: [0, 4, 7, 14],
  altered: [0, 4, 10, 13, 15], // 7(b9#9) altered-dominant colour (3 & b7 + tensions)
  five: [0, 7],
}

/** Diatonic scale offsets (from the tonic) for each KeyMode. */
export const MODE_SCALE: Record<KeyMode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
}

/**
 * The ROOT pitch class of a corpus chord, RELATIVE to a tonic at `keyRoot`.
 * Resolution order:
 *   1. `rootSemitone` (explicit chromatic root) wins if present.
 *   2. else diatonic degree against the mode's scale + optional `accidental`.
 */
export const chordRootPc = (
  chord: CorpusChord,
  keyRoot: PitchClass,
  mode: KeyMode
): PitchClass => {
  if (chord.rootSemitone !== undefined) {
    return toPc(keyRoot + chord.rootSemitone)
  }
  const scale = MODE_SCALE[mode]
  const deg = mod(chord.degree ?? 0, scale.length)
  return toPc(keyRoot + scale[deg] + (chord.accidental ?? 0))
}

/**
 * The root's semitone offset above the tonic (0..11) — the key-agnostic root.
 * Equivalent to chordRootPc(chord, 0, mode).
 */
export const chordRootOffset = (chord: CorpusChord, mode: KeyMode): number =>
  chordRootPc(chord, 0, mode)

/** The absolute pitch-class SET of a corpus chord in a given key. */
export const chordPcs = (
  chord: CorpusChord,
  keyRoot: PitchClass,
  mode: KeyMode
): PitchClass[] => {
  const root = chordRootPc(chord, keyRoot, mode)
  return QUALITY_INTERVALS[chord.quality].map((iv) => toPc(root + iv))
}
