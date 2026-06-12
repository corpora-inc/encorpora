/**
 * beatlounge — named, key-agnostic chord PROGRESSION templates.
 *
 * These are roman-numeral patterns (degree + a forced quality) so a single
 * template renders correctly into ANY key/mode. The 4B model picks a template
 * name from this CLOSED set; the deterministic renderer does the harmony. The
 * power-user types raw notation instead (progression.ts) — both paths converge
 * on a `Progression`.
 *
 * A degree is 0-based (0 = tonic). `quality` overrides the diatonic triad when
 * a template wants a specific colour (e.g. a secondary dominant, a borrowed iv).
 * `beats` is per-chord; omit ⇒ a default of 4 (one bar of 4/4).
 */

import type { Chord, ChordQuality, ScaleName, PitchClass } from "./harmony"
import { diatonicTriad, toPc, SCALES, spellPc } from "./harmony"
import { progressionFromChords, type Progression } from "./progression"

export interface TemplateStep {
  /** 0-based scale degree the chord is built on. */
  degree: number
  /** Force a specific quality; omit ⇒ use the diatonic triad of the key. */
  quality?: ChordQuality
  /** Beats this chord lasts (default 4). */
  beats?: number
  /** Optional chromatic root offset in semitones (for borrowed/secondary chords). */
  rootOffset?: number
}

export interface ProgressionTemplate {
  name: string
  /** A scale that suits this template best (the generator may honour it). */
  preferScale: ScaleName
  describe: string
  steps: TemplateStep[]
}

const bars = (...steps: Array<[number, number?, ChordQuality?]>): TemplateStep[] =>
  steps.map(([degree, beats, quality]) => ({ degree, beats: beats ?? 4, quality }))

/**
 * The closed template catalog. Names are the LLM's enum + the keyword router's
 * targets. Each is a recognizable, GOOD-sounding song shape.
 */
export const TEMPLATES: Record<string, ProgressionTemplate> = {
  // I–V–vi–IV — the "four chords" pop axis.
  pop: {
    name: "pop",
    preferScale: "major",
    describe: "The classic pop axis: I–V–vi–IV.",
    steps: bars([0], [4], [5], [3]),
  },
  // I–vi–IV–V — 50s doo-wop / sentimental.
  doowop: {
    name: "doowop",
    preferScale: "major",
    describe: "50s doo-wop: I–vi–IV–V.",
    steps: bars([0], [5], [3], [4]),
  },
  // ii–V–I (jazz cadence), with 7th colours.
  jazz: {
    name: "jazz",
    preferScale: "major",
    describe: "Jazz ii–V–I with sevenths.",
    steps: [
      { degree: 1, quality: "min7", beats: 4 },
      { degree: 4, quality: "dom7", beats: 4 },
      { degree: 0, quality: "maj7", beats: 8 },
    ],
  },
  // i–iv–v / minor blues feel.
  blues: {
    name: "blues",
    preferScale: "mixolydian",
    describe: "Twelve-bar blues in I7–IV7–V7.",
    steps: [
      { degree: 0, quality: "dom7", beats: 16 },
      { degree: 3, quality: "dom7", beats: 8 },
      { degree: 0, quality: "dom7", beats: 8 },
      { degree: 4, quality: "dom7", beats: 4 },
      { degree: 3, quality: "dom7", beats: 4 },
      { degree: 0, quality: "dom7", beats: 4 },
      { degree: 4, quality: "dom7", beats: 4 },
    ],
  },
  // i–VI–III–VII — epic/cinematic minor (Andalusian-adjacent).
  epic: {
    name: "epic",
    preferScale: "minor",
    describe: "Epic minor: i–VI–III–VII.",
    steps: bars([0], [5], [2], [6]),
  },
  // i–iv–i–v — sad, plaintive minor.
  sad: {
    name: "sad",
    preferScale: "minor",
    describe: "Plaintive minor: i–iv–v–i.",
    steps: bars([0], [3], [4], [0]),
  },
  // vi–IV–I–V — the "sensitive" emotional pop turn.
  emotional: {
    name: "emotional",
    preferScale: "major",
    describe: "Emotional turn: vi–IV–I–V.",
    steps: bars([5], [3], [0], [4]),
  },
  // i–VII–VI–VII — dorian/rock vamp.
  vamp: {
    name: "vamp",
    preferScale: "dorian",
    describe: "Modal vamp: i–VII–VI–VII.",
    steps: bars([0], [6], [5], [6]),
  },
  // Andalusian cadence i–VII–VI–V (phrygian flavour).
  andalusian: {
    name: "andalusian",
    preferScale: "phrygian",
    describe: "Andalusian cadence: i–VII–VI–V.",
    steps: [
      { degree: 0, beats: 4 },
      { degree: 6, beats: 4 },
      { degree: 5, beats: 4 },
      { degree: 4, quality: "dom7", beats: 4 },
    ],
  },
  // I–IV–V–IV — the three-chord garage/folk staple.
  threechord: {
    name: "threechord",
    preferScale: "major",
    describe: "Three-chord staple: I–IV–V–IV.",
    steps: bars([0], [3], [4], [3]),
  },
  // canon: I–V–vi–iii–IV–I–IV–V (Pachelbel).
  canon: {
    name: "canon",
    preferScale: "major",
    describe: "Pachelbel canon: I–V–vi–iii–IV–I–IV–V.",
    steps: bars([0, 2], [4, 2], [5, 2], [2, 2], [3, 2], [0, 2], [3, 2], [4, 2]),
  },
}

export const TEMPLATE_NAMES = Object.keys(TEMPLATES)

/**
 * Render a named template into a concrete Progression in `tonic`/`scale`.
 * Forgiving: an unknown name falls back to "pop"; a step out of the scale's
 * degree range wraps. Forced qualities are honoured verbatim; otherwise the
 * diatonic triad of the key is used.
 */
export const renderTemplate = (
  name: string,
  tonic: PitchClass,
  scale: ScaleName
): Progression => {
  const tpl = TEMPLATES[name] ?? TEMPLATES.pop
  const len = SCALES[scale].length
  const items = tpl.steps.map((step) => {
    let chord: Chord
    if (step.quality) {
      const root = toPc(tonic + SCALES[scale][((step.degree % len) + len) % len] + (step.rootOffset ?? 0))
      chord = forcedChord(root, step.quality)
    } else {
      chord = diatonicTriad(step.degree, tonic, scale)
    }
    return { chord, beats: step.beats ?? 4, token: chord.symbol }
  })
  return progressionFromChords(items)
}

/** Build a Chord for a known root + forced quality (re-uses parseChord shape). */
import { parseChord } from "./harmony"
const forcedChord = (root: PitchClass, quality: ChordQuality): Chord => {
  // Construct a symbol then re-parse so we get a consistent Chord object.
  const QUALITY_SUFFIX: Record<ChordQuality, string> = {
    maj: "", min: "m", dim: "dim", aug: "aug", sus2: "sus2", sus4: "sus4",
    maj7: "maj7", min7: "m7", dom7: "7", dim7: "dim7", min7b5: "m7b5",
    minMaj7: "mMaj7", maj6: "6", min6: "m6", dom9: "9", maj9: "maj9",
    min9: "m9", add9: "add9", five: "5",
  }
  const sym = `${spellPc(root)}${QUALITY_SUFFIX[quality]}`
  return parseChord(sym)!
}
