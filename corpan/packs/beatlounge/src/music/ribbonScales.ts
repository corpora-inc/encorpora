/**
 * beatlounge — ribbon performance scale/pitch math (pure, dependency-free,
 * fully testable). The ribbon controller maps a horizontal touch position
 * (0..1 across a pitch window) onto either a CONTINUOUS frequency (fretless /
 * theremin glide) or the NEAREST in-scale MIDI note (fretted), so the player
 * literally can't play a wrong note in a locked key + mode.
 *
 * Conventions match the rest of the pack: MIDI pitch is a number, middle C = 60,
 * A4 (MIDI 69) = 440 Hz (12-TET). Self-contained so a future pass can swap in a
 * shared harmony engine without touching the module.
 */

/** The 12 pitch-class names (sharps spelled). Index = pitch-class 0..11. */
export const KEY_NAMES = [
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

export type KeyName = (typeof KEY_NAMES)[number]

/** A musical mode → its semitone offsets from the tonic (ascending, < 12). */
export const SCALE_MODES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  "natural-minor": [0, 2, 3, 5, 7, 8, 10],
  "harmonic-minor": [0, 2, 3, 5, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  pentatonic: [0, 2, 4, 7, 9],
  "minor-pentatonic": [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
} as const satisfies Record<string, readonly number[]>

export type ScaleMode = keyof typeof SCALE_MODES

/** All mode ids, in a sensible picker order. */
export const SCALE_MODE_IDS = Object.keys(SCALE_MODES) as ScaleMode[]

/** Human label for a mode id (Title Case, no neon). */
export const modeLabel = (mode: ScaleMode): string =>
  mode
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

// ----------------------------------------------------------------- tuning
/** A4 (MIDI 69) reference, 12-tone equal temperament. */
export const A4_MIDI = 69
export const A4_HZ = 440

/** Continuous MIDI value → frequency in Hz (fractional MIDI ⇒ microtonal). */
export const midiToFreq = (midi: number): number =>
  A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12)

/** Frequency in Hz → continuous MIDI value (inverse of midiToFreq). */
export const freqToMidi = (hz: number): number =>
  A4_MIDI + 12 * Math.log2(hz / A4_HZ)

/** Positive modulo (JS % keeps the sign of the dividend). */
const mod = (n: number, m: number): number => ((n % m) + m) % m

/** Pitch-class (0..11) of a MIDI pitch. */
export const pitchClass = (midi: number): number => mod(Math.round(midi), 12)

/** Scientific octave number for a MIDI pitch (C4 = 60 ⇒ octave 4). */
export const octaveOf = (midi: number): number => Math.floor(midi / 12) - 1

/** Label for an integer MIDI pitch, e.g. 60 → "C4", 61 → "C#4". */
export const noteLabel = (midi: number): string =>
  `${KEY_NAMES[pitchClass(midi)]}${octaveOf(Math.round(midi))}`

// ----------------------------------------------------------------- scales
/**
 * Is the (integer) MIDI `pitch` a degree of `mode` rooted at pitch-class
 * `keyPc` (0..11)? Octave-agnostic.
 */
export const isInScale = (
  pitch: number,
  keyPc: number,
  mode: ScaleMode
): boolean =>
  (SCALE_MODES[mode] as readonly number[]).includes(mod(Math.round(pitch) - keyPc, 12))

/**
 * Every in-scale MIDI note in [lowMidi, highMidi] inclusive, ascending. This is
 * the set of "frets" the ribbon draws + snaps to in fretted mode.
 */
export const scaleNotesInRange = (
  keyPc: number,
  mode: ScaleMode,
  lowMidi: number,
  highMidi: number
): number[] => {
  const lo = Math.ceil(lowMidi)
  const hi = Math.floor(highMidi)
  const out: number[] = []
  for (let p = lo; p <= hi; p++) {
    if (isInScale(p, keyPc, mode)) out.push(p)
  }
  return out
}

/**
 * Snap a continuous MIDI value to the nearest in-scale MIDI note for the key +
 * mode. Ties resolve downward (the lower note), which feels musically stable.
 * Always returns an integer MIDI pitch that is genuinely in the scale.
 */
export const snapToScale = (
  midi: number,
  keyPc: number,
  mode: ScaleMode
): number => {
  const base = Math.round(midi)
  // Search outward from the rounded pitch; the nearest in-scale degree is at
  // most 6 semitones away for any mode, so a small window always resolves.
  for (let d = 0; d <= 6; d++) {
    const lo = base - d
    if (isInScale(lo, keyPc, mode)) return lo
    const hi = base + d
    if (d > 0 && isInScale(hi, keyPc, mode)) return hi
  }
  return base
}

// ------------------------------------------------------------- ribbon window
/**
 * The pitch window the ribbon spans: [lowMidi, lowMidi + spanSemis]. `x` is a
 * normalized 0..1 position across the ribbon (0 = lowest pitch, 1 = highest).
 */
export interface RibbonWindow {
  /** MIDI pitch at the left edge (x = 0). */
  lowMidi: number
  /** Total semitone span the ribbon covers (e.g. 96 ≈ 8 octaves). */
  spanSemis: number
}

/** Clamp to [0, 1]. */
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Map a normalized ribbon position to a CONTINUOUS MIDI value (fretless glide).
 * Linear across the window so a finger sweep is an even pitch sweep.
 */
export const xToMidi = (x: number, win: RibbonWindow): number =>
  win.lowMidi + clamp01(x) * win.spanSemis

/** Map a normalized ribbon position to a continuous frequency (fretless). */
export const xToFreq = (x: number, win: RibbonWindow): number =>
  midiToFreq(xToMidi(x, win))

/** Inverse: where a MIDI pitch sits on the ribbon, normalized 0..1. */
export const midiToX = (midi: number, win: RibbonWindow): number =>
  win.spanSemis <= 0 ? 0 : clamp01((midi - win.lowMidi) / win.spanSemis)

/**
 * Map a normalized ribbon position to the nearest in-scale MIDI note (fretted).
 * Returns an integer MIDI pitch that is always a degree of the key + mode.
 */
export const xToScaleNote = (
  x: number,
  win: RibbonWindow,
  keyPc: number,
  mode: ScaleMode
): number => snapToScale(xToMidi(x, win), keyPc, mode)

/**
 * The fret layout for the visible window: each in-scale note plus its normalized
 * x-position, for drawing fret lines / glow targets. Tonic flagged for accent.
 */
export interface Fret {
  midi: number
  /** Normalized 0..1 x-position of this fret on the ribbon. */
  x: number
  /** This note's pitch-class is the key's tonic. */
  tonic: boolean
  label: string
}

export const ribbonFrets = (
  win: RibbonWindow,
  keyPc: number,
  mode: ScaleMode
): Fret[] => {
  const notes = scaleNotesInRange(
    keyPc,
    mode,
    win.lowMidi,
    win.lowMidi + win.spanSemis
  )
  const tonicPc = mod(keyPc, 12)
  return notes.map((midi) => ({
    midi,
    x: midiToX(midi, win),
    tonic: pitchClass(midi) === tonicPc,
    label: noteLabel(midi),
  }))
}
