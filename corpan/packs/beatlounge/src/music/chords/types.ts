/**
 * beatlounge — chord-progressions corpus: KEY-AGNOSTIC schema.
 *
 * Everything here is RELATIVE TO A KEY. A progression is a sequence of chords
 * expressed as scale-DEGREE + quality (Roman-numeral semantics), so the same
 * datum transposes to any of the 12 keys and voices in strict 12-TET.
 *
 * Nothing in this module is named after a song, artist, or album. The entries
 * are pure music-theory objects (cadences, turnarounds, vamps, loops) with
 * descriptive THEORY tags only — chord progressions are not copyrightable and
 * that is precisely the point (see docs/CHORDS_CORPUS.md).
 *
 * 12-TET only. A degree resolves to a pitch class; a quality resolves to a set
 * of semitone offsets; together they resolve to MIDI note numbers.
 */

/** Pitch class 0..11 (C = 0). Re-exported from harmony for convenience. */
export type PitchClass = number

/**
 * The harmonic "mode" / key context a progression is read against. This fixes
 * the diatonic scale used to turn a scale-degree into a pitch class.
 *
 *  - "major"  → Ionian (I ii iii IV V vi vii°)
 *  - "minor"  → natural minor / Aeolian (i ii° III iv v VI VII)
 *  - the modal contexts give the corpus its modal vamps without re-spelling.
 */
export type KeyMode =
  | "major"
  | "minor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "aeolian"
  | "harmonicMinor"

/**
 * A chord QUALITY the corpus can express. A superset of the harmony engine's
 * quality set, adding the extended/altered colours the corpus needs (11, 13,
 * 6/9, altered dominant). Each resolves to a semitone-interval set below.
 */
export type CorpusChordQuality =
  | "maj"
  | "min"
  | "dim"
  | "aug"
  | "sus2"
  | "sus4"
  | "maj7"
  | "min7"
  | "dom7"
  | "dim7"
  | "m7b5" // half-diminished
  | "minMaj7"
  | "maj6"
  | "min6"
  | "six9" // 6/9
  | "dom9"
  | "maj9"
  | "min9"
  | "dom11"
  | "min11"
  | "dom13"
  | "maj13"
  | "add9"
  | "altered" // 7alt: 7(b9#9b5#5) — dominant tension colour
  | "five" // power chord, no third

/**
 * A key-agnostic chord.
 *
 *  - `degree` is the 0-based scale degree (I = 0, ii = 1, …, vii = 6). It is
 *    read against the progression's `mode`.
 *  - `accidental` chromatically shifts the ROOT by a semitone for borrowed /
 *    secondary / chromatic roots (e.g. bVII = degree 6 with accidental -1 from
 *    the major scale's degree-6 root, or simply authored as the literal root).
 *    For clarity the corpus uses an explicit semitone root offset where the
 *    diatonic degree would be ambiguous (see `rootSemitone`).
 *  - `rootSemitone`, when present, OVERRIDES degree+accidental and gives the
 *    root directly as a semitone offset above the key tonic (0..11). This is
 *    how we express bVII, bIII, #iv°, the bII Neapolitan, tritone subs, etc.
 *    exactly, key-agnostically. Exactly one of (degree | rootSemitone) drives
 *    the root; if both are present `rootSemitone` wins.
 *  - `quality` is the chord quality.
 *  - `inversion` (0 = root position, 1 = first, …) lowers the corresponding
 *    chord tone to become the bass (slash voicing). Optional.
 *  - `roman` is the human-readable Roman-numeral label (display only, never a
 *    song name).
 */
export interface CorpusChord {
  /** 0-based diatonic scale degree (I=0 … vii=6). Used when `rootSemitone` is absent. */
  degree?: number
  /** Chromatic root shift in semitones applied to the diatonic degree root. */
  accidental?: number
  /** Direct root as semitones above the tonic (0..11). Overrides degree. */
  rootSemitone?: number
  quality: CorpusChordQuality
  /** Inversion index; the Nth chord tone becomes the bass. */
  inversion?: number
  /** Display Roman-numeral label, e.g. "ii7", "V7", "bVII", "I/3". */
  roman: string
}

/**
 * A progression entry in the corpus. Durations are expressed in BEATS per chord
 * (a beat = a quarter note at the document's PPQ). `perChordBeats` may be a
 * single number (uniform) or one entry per chord. Total length in beats is
 * derivable; `meter` defaults to 4/4.
 */
export interface CorpusProgression {
  /** Stable, generated, non-naming id, e.g. "pop-loop:I-V-vi-IV". */
  id: string
  /** The chords, in order. */
  degrees: CorpusChord[]
  /** Beats per chord: a scalar (uniform) or per-chord array. Default 4. */
  perChordBeats: number | number[]
  /** The key context the degrees are read against. */
  mode: KeyMode
  /**
   * Family bucket the entry was generated into (one of FAMILIES). Coarse
   * organization; see `tags` for the fine-grained, searchable descriptors.
   */
  family: ProgressionFamily
  /**
   * Descriptive THEORY tags (searchable). Examples: "cadence", "authentic",
   * "ii-V-I", "turnaround", "doo-wop", "modal", "dorian", "blues-12bar",
   * "secondary-dominant", "tritone-sub", "andalusian". NEVER a song/artist.
   */
  tags: string[]
  /** Optional time signature [numerator, denominator]; default [4,4]. */
  meter?: [number, number]
}

/** Coarse organizational families the corpus is partitioned into. */
export type ProgressionFamily =
  | "cadence" // diatonic cadences (authentic/plagal/deceptive/half)
  | "pop-loop" // 4-chord pop/rock loops + rotations
  | "doo-wop" // 50s / I-vi-IV-V family + rotations
  | "jazz-turnaround" // ii-V-I, turnarounds, tritone/backdoor subs
  | "blues" // 12-bar / 8-bar blues variants
  | "modal-vamp" // Dorian/Mixolydian/Phrygian/Aeolian vamps
  | "circle-of-fifths" // descending-fifths sequences
  | "secondary-dominant" // V/x chains
  | "modal-interchange" // borrowed-chord progressions
  | "folk" // folk / singer-songwriter diatonic patterns
  | "gospel" // gospel / 6-2-5-1 & plagal colour
  | "latin" // bossa / Latin
  | "pop-punk" // I-V-vi-IV energy variants & power-chord loops
  | "edm" // loop-based EDM minor vamps
  | "andalusian" // Phrygian descending tetrachord family

/** The canonical family list (also the order docs present them). */
export const FAMILIES: ProgressionFamily[] = [
  "cadence",
  "pop-loop",
  "doo-wop",
  "jazz-turnaround",
  "blues",
  "modal-vamp",
  "circle-of-fifths",
  "secondary-dominant",
  "modal-interchange",
  "folk",
  "gospel",
  "latin",
  "pop-punk",
  "edm",
  "andalusian",
]
