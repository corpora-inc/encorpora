/**
 * beatlounge — music theory core (pure, dependency-free, exhaustively tested).
 *
 * The harmony engine the JAM composer stands on. It turns chord SYMBOLS
 * ("Dmin7", "G7", "Cmaj7#11") into concrete pitch-class sets + ordered chord
 * tones, knows the scales/modes a chord lives in, and exposes the diatonic /
 * key helpers the generator voice-leads through.
 *
 * Conventions:
 *  - A "pitch class" (pc) is an integer 0..11, C = 0. All pc math is mod-12.
 *  - A chord's `tones` are SEMITONE offsets from its root (root = 0), in
 *    ascending order — so absolute MIDI is `rootMidi + offset`.
 *  - We never throw on a parse: a malformed quality degrades to a major triad
 *    so "something musical always happens" (the pack's headline value).
 *
 * Nothing here touches the document/audio — it is the music, not the playback.
 */

export type PitchClass = number // 0..11, C = 0

// ----------------------------------------------------------------- note names
/** Pitch-class names with sharps spelled (index = pc). */
export const SHARP_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const

/** Pitch-class names with flats spelled (index = pc). */
export const FLAT_NAMES = [
  "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B",
] as const

/** Natural letter → pitch class. */
const LETTER_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
}

/** True mod that always returns 0..(m-1). */
export const mod = (n: number, m: number): number => ((n % m) + m) % m

/** Normalize any integer to a pitch class 0..11. */
export const toPc = (n: number): PitchClass => mod(n, 12)

/**
 * Parse a note name ("C", "F#", "Bb", "Ebb", "G##") to a pitch class.
 * Forgiving: unknown input → null (caller decides the fallback).
 */
export const parseNoteName = (raw: string): PitchClass | null => {
  const s = raw.trim()
  if (!s) return null
  const letter = s[0].toUpperCase()
  const base = LETTER_PC[letter]
  if (base === undefined) return null
  let pc = base
  for (let i = 1; i < s.length; i++) {
    const ch = s[i]
    if (ch === "#" || ch === "♯") pc += 1
    else if (ch === "b" || ch === "♭") pc -= 1
    else break // stop at the first non-accidental (quality starts here)
  }
  return toPc(pc)
}

/** Spell a pitch class, preferring flats when `preferFlat` (e.g. minor keys). */
export const spellPc = (pc: PitchClass, preferFlat = false): string =>
  (preferFlat ? FLAT_NAMES : SHARP_NAMES)[toPc(pc)]

// ----------------------------------------------------------------- scales
export type ScaleName =
  | "major"
  | "minor" // natural minor (aeolian)
  | "harmonicMinor"
  | "melodicMinor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian"
  | "majorPentatonic"
  | "minorPentatonic"
  | "blues"
  | "wholeTone"
  | "chromatic"

/** Semitone offsets (from the tonic) for each scale, ascending within an octave. */
export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  majorPentatonic: [0, 2, 4, 7, 9],
  minorPentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  wholeTone: [0, 2, 4, 6, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
}

export const SCALE_NAMES = Object.keys(SCALES) as ScaleName[]

/** The pitch-class SET of a scale rooted at `tonic`. */
export const scalePcs = (tonic: PitchClass, name: ScaleName): PitchClass[] =>
  SCALES[name].map((s) => toPc(tonic + s))

/** Is `pc` a degree of the scale rooted at `tonic`? */
export const inScale = (pc: PitchClass, tonic: PitchClass, name: ScaleName): boolean =>
  SCALES[name].includes(mod(pc - tonic, 12))

/**
 * Snap a MIDI pitch to the nearest in-scale pitch (ties resolve UP). Preserves
 * octave register; used to keep generated melody notes diatonic.
 */
export const snapToScale = (
  midi: number,
  tonic: PitchClass,
  name: ScaleName
): number => {
  const pcs = SCALES[name].map((s) => toPc(tonic + s))
  if (pcs.includes(toPc(midi))) return midi
  for (let d = 1; d <= 6; d++) {
    if (pcs.includes(toPc(midi + d))) return midi + d
    if (pcs.includes(toPc(midi - d))) return midi - d
  }
  return midi
}

// ----------------------------------------------------------------- chords
/**
 * A normalized chord quality. We keep the catalog generous but closed; an
 * unknown quality string degrades to "maj" at parse time.
 */
export type ChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "maj7"
  | "min7"
  | "dom7" // "7"
  | "dim7"
  | "min7b5" // half-diminished
  | "minMaj7"
  | "maj6"
  | "min6"
  | "dom9"
  | "maj9"
  | "min9"
  | "add9"
  | "five" // power chord (no third)

/** Semitone offsets (from the root) that DEFINE each quality. Ascending. */
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
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
  min7b5: [0, 3, 6, 10],
  minMaj7: [0, 3, 7, 11],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  dom9: [0, 4, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  add9: [0, 4, 7, 14],
  five: [0, 7],
}

/**
 * A scale/mode that FITS a chord quality — what the soloist plays over it.
 * For dominant we lean mixolydian; for min7b5 locrian; etc. This is the seam
 * the JAM melody generator uses to pick non-chord passing tones tastefully.
 */
export const QUALITY_SCALE: Record<ChordQuality, ScaleName> = {
  maj: "major",
  min: "minor",
  dim: "locrian",
  aug: "wholeTone",
  sus2: "mixolydian",
  sus4: "mixolydian",
  maj7: "major",
  min7: "dorian",
  dom7: "mixolydian",
  dim7: "harmonicMinor",
  min7b5: "locrian",
  minMaj7: "melodicMinor",
  maj6: "major",
  min6: "dorian",
  dom9: "mixolydian",
  maj9: "lydian",
  min9: "dorian",
  add9: "major",
  five: "minorPentatonic",
}

export interface Chord {
  /** Root pitch class 0..11. */
  root: PitchClass
  quality: ChordQuality
  /** Semitone offsets from the root (ascending), the chord's defining tones. */
  tones: number[]
  /** Pitch-class set (absolute, mod-12) of the chord tones. */
  pcs: PitchClass[]
  /** The symbol we parsed (normalized display, e.g. "Dmin7"). */
  symbol: string
  /** A fitting scale name for soloing/comping over this chord. */
  scale: ScaleName
}

/**
 * Quality token → canonical quality. Order matters: longest/most-specific match
 * first. CONVENTION: an UPPERCASE `M` means MAJOR, a lowercase `m` means MINOR
 * — so those tokens are CASE-SENSITIVE (no /i). Word tokens like "maj"/"min"/
 * "dim"/"sus" are case-insensitive. `Δ`/`°`/`ø`/`-` are unambiguous symbols.
 */
const QUALITY_TOKENS: Array<[RegExp, ChordQuality]> = [
  // minor-Major 7 (must precede both maj7 and min7)
  [/^m\(maj7\)|^minMaj7|^mM7|^mMaj7|^-Δ7|^mΔ/, "minMaj7"],
  // half-diminished (must precede min7)
  [/^min7b5|^m7b5|^m7-5|^ø7|^ø/i, "min7b5"],
  // 9ths
  [/^maj9|^M9|^Δ9/, "maj9"],
  [/^min9|^m9|^-9/i, "min9"],
  [/^add9|^add2/i, "add9"],
  [/^9/, "dom9"],
  // 7ths (uppercase-M tokens are major; lowercase-m are minor)
  [/^maj7|^Ma7|^M7|^Δ7|^Δ/, "maj7"],
  [/^dim7|^°7|^o7/i, "dim7"],
  [/^min7|^m7|^-7/i, "min7"],
  [/^dom7|^7/, "dom7"],
  // 6ths
  [/^min6|^m6|^-6/i, "min6"],
  [/^maj6|^M6|^6/, "maj6"],
  // triads + sus + power. "maj"/"min" WORD tokens precede the bare m/M so a
  // leading "maj" is not eaten by the minor "^m".
  [/^sus2/i, "sus2"],
  [/^sus4|^sus/i, "sus4"],
  [/^dim|^°|^o(?![a-z])/i, "dim"],
  [/^aug|^\+/i, "aug"],
  [/^maj/i, "maj"],
  [/^min/i, "min"],
  [/^m|^-/, "min"],
  [/^M/, "maj"],
  [/^5/, "five"],
]

/**
 * Map a raw quality suffix (everything after the root) to a canonical quality.
 * Strips a trailing slash-bass and any unrecognized extension chars (forgiving).
 */
export const parseQuality = (raw: string): ChordQuality => {
  // Drop a slash bass ("/G") — voicing handles inversions separately.
  const s = raw.split("/")[0].trim()
  if (!s) return "maj"
  for (const [re, q] of QUALITY_TOKENS) if (re.test(s)) return q
  return "maj"
}

/**
 * Parse a chord symbol ("Dmin7", "G/B", "F#m7b5", "Csus4") into a Chord.
 * Forgiving by design — anything unparseable becomes the C major triad so the
 * generator never stalls. Returns null ONLY for an empty token.
 */
export const parseChord = (raw: string): Chord | null => {
  const token = raw.trim()
  if (!token) return null
  // Root: a letter + optional accidentals.
  const m = token.match(/^([A-Ga-g])([#b♯♭]*)/)
  if (!m) return makeChord(0, "maj", token)
  const rootStr = m[1] + m[2]
  const root = parseNoteName(rootStr)
  if (root === null) return makeChord(0, "maj", token)
  const rest = token.slice(m[0].length)
  const quality = parseQuality(rest)
  return makeChord(root, quality, token)
}

/** Assemble a Chord from a root pc + canonical quality. */
const makeChord = (root: PitchClass, quality: ChordQuality, symbol: string): Chord => {
  const tones = [...CHORD_INTERVALS[quality]]
  const pcs = tones.map((t) => toPc(root + t))
  return {
    root,
    quality,
    tones,
    pcs,
    symbol,
    scale: QUALITY_SCALE[quality],
  }
}

/** A friendly display name for a chord (root spelled + quality suffix). */
const QUALITY_SUFFIX: Record<ChordQuality, string> = {
  maj: "", min: "m", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
  maj7: "maj7", min7: "m7", dom7: "7", dim7: "dim7", min7b5: "m7b5",
  minMaj7: "mMaj7", maj6: "6", min6: "m6", dom9: "9", maj9: "maj9",
  min9: "m9", add9: "add9", five: "5",
}

export const chordName = (chord: Chord, preferFlat = false): string =>
  `${spellPc(chord.root, preferFlat)}${QUALITY_SUFFIX[chord.quality]}`

/**
 * Absolute chord-tone MIDI pitches near a register anchor. `octaveRoot` is the
 * MIDI of the chord root in the desired octave (e.g. 48 = C3); returns the
 * chord tones above it, in ascending order. Used to build voicings.
 */
export const chordMidiTones = (chord: Chord, octaveRoot: number): number[] =>
  chord.tones.map((t) => octaveRoot + t)

/**
 * Nearest MIDI for a pitch class AT OR ABOVE `floor`. Used by voice-leading to
 * place a target tone close to a previous voice.
 */
export const pcAtOrAbove = (pc: PitchClass, floor: number): number => {
  const base = floor - mod(floor - pc, 12)
  return base + 12 <= floor ? base + 12 : base + (mod(floor - pc, 12) === 0 ? 0 : 12)
}

/**
 * Nearest MIDI of pitch class `pc` to a reference MIDI `near` (minimal leap;
 * ties resolve DOWN, the smoother default for inner voices). The voice-leading
 * primitive: given the previous note, find the closest octave of the target pc.
 */
export const nearestPcTo = (pc: PitchClass, near: number): number => {
  const base = pc + 12 * Math.round((near - pc) / 12)
  // Check neighbors for the true minimum (rounding can be off by an octave).
  let best = base
  let bestDist = Math.abs(base - near)
  for (const cand of [base - 12, base + 12]) {
    const d = Math.abs(cand - near)
    if (d < bestDist) {
      best = cand
      bestDist = d
    }
  }
  return best
}

// ----------------------------------------------------------------- diatonic
/** Roman-numeral-ish degree index (0..6) of a pc within a key, or -1. */
export const scaleDegreeOf = (
  pc: PitchClass,
  tonic: PitchClass,
  name: ScaleName
): number => SCALES[name].indexOf(mod(pc - tonic, 12))

/**
 * The diatonic triad built on `degree` (0-based) of a key. Stacks thirds within
 * the scale — so degree 0 of C-major = C major, degree 1 = D minor, etc. This
 * lets the progression generator emit KEY-CORRECT chords from roman numerals.
 */
export const diatonicTriad = (
  degree: number,
  tonic: PitchClass,
  name: ScaleName
): Chord => {
  const scale = SCALES[name]
  const len = scale.length
  const d = mod(degree, len)
  const root = toPc(tonic + scale[d])
  const third = toPc(tonic + scale[mod(d + 2, len)])
  const fifth = toPc(tonic + scale[mod(d + 4, len)])
  const quality = classifyTriad(root, third, fifth)
  return makeChord(root, quality, `${spellPc(root)}${QUALITY_SUFFIX[quality]}`)
}

/** Classify a triad by its third + fifth intervals (mod-12). */
const classifyTriad = (
  root: PitchClass,
  third: PitchClass,
  fifth: PitchClass
): ChordQuality => {
  const t = mod(third - root, 12)
  const f = mod(fifth - root, 12)
  if (t === 4 && f === 7) return "maj"
  if (t === 3 && f === 7) return "min"
  if (t === 3 && f === 6) return "dim"
  if (t === 4 && f === 8) return "aug"
  return "maj"
}

/** The seven diatonic triads of a key, degree order. */
export const diatonicTriads = (tonic: PitchClass, name: ScaleName): Chord[] =>
  SCALES[name].map((_, i) => diatonicTriad(i, tonic, name))
