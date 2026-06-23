/**
 * beatlounge — terse builders for authoring corpus progressions.
 *
 * These keep the generator files compact and readable: a chord is authored
 * either by a diatonic degree (`d`) or a chromatic root-semitone (`c`), and a
 * progression is assembled from a chord array + beats + tags. Roman labels are
 * carried for display ONLY — never a song name.
 */

import type {
  CorpusChord,
  CorpusChordQuality,
  CorpusProgression,
  KeyMode,
  ProgressionFamily,
} from "./types"

/** Diatonic chord: degree (0-based) + quality + roman label (+ inversion). */
export const d = (
  degree: number,
  quality: CorpusChordQuality,
  roman: string,
  inversion?: number
): CorpusChord => ({ degree, quality, roman, ...(inversion ? { inversion } : {}) })

/** Chromatic-root chord: root semitones above tonic + quality + roman. */
export const c = (
  rootSemitone: number,
  quality: CorpusChordQuality,
  roman: string,
  inversion?: number
): CorpusChord => ({
  rootSemitone,
  quality,
  roman,
  ...(inversion ? { inversion } : {}),
})

/** Assemble a progression entry. */
export const prog = (
  id: string,
  degrees: CorpusChord[],
  mode: KeyMode,
  family: ProgressionFamily,
  tags: string[],
  perChordBeats: number | number[] = 4,
  meter?: [number, number]
): CorpusProgression => ({
  id,
  degrees,
  perChordBeats,
  mode,
  family,
  tags,
  ...(meter ? { meter } : {}),
})

/**
 * Rotate a chord array by `n` (left rotation). Used to spin a 4-chord loop into
 * its 4 musically-distinct rotations (each is a real, commonly-played loop).
 */
export const rotate = <T>(arr: T[], n: number): T[] => {
  const k = ((n % arr.length) + arr.length) % arr.length
  return [...arr.slice(k), ...arr.slice(0, k)]
}

/** A compact slug from roman labels, e.g. [I,V,vi,IV] → "I-V-vi-IV". */
export const slug = (degrees: CorpusChord[]): string =>
  degrees.map((x) => x.roman.replace(/\//g, "_")).join("-")
