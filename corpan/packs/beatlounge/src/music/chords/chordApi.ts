/**
 * beatlounge — pure chord API: resolve key-agnostic chords to 12-TET MIDI,
 * voice them, transpose progressions, and emit tick-addressed chord events.
 *
 * No audio, no document mutation. This is the FOUNDATION the harmony engine /
 * composer / piano-roll will consume in a later round.
 */

import { mod, toPc } from "../harmony"
import { PPQ } from "../../model/timing"
import { QUALITY_INTERVALS, chordRootPc } from "./qualities"
import type {
  CorpusChord,
  CorpusProgression,
  KeyMode,
  PitchClass,
} from "./types"

/** Default MIDI octave anchor: MIDI 48 = C3, a comfortable comping register. */
export const DEFAULT_OCTAVE_MIDI = 48

/**
 * The MIDI note numbers of a chord, in a given key, anchored so the ROOT lands
 * at `octaveRoot` (MIDI of the chord root in the desired octave). Chord tones
 * stack ABOVE the root in ascending semitone order. 12-TET throughout.
 *
 * Note: `octaveRoot` is the MIDI for the chord's root pitch class; callers
 * usually pass `octaveForRoot(rootPc, octave)`.
 */
export const chordToMidiAtRoot = (
  chord: CorpusChord,
  octaveRoot: number
): number[] => QUALITY_INTERVALS[chord.quality].map((iv) => octaveRoot + iv)

/**
 * The MIDI note number for a pitch class in a given octave register.
 * `octave` follows the MIDI convention where octave 3 → C3 = MIDI 48.
 */
export const midiForPc = (pc: PitchClass, octave: number): number =>
  (octave + 1) * 12 + toPc(pc)

/**
 * Resolve a key-agnostic chord to concrete MIDI notes.
 *
 *  - `keyRoot` is the tonic pitch class (0..11).
 *  - `octave` places the chord root (octave 3 → root near MIDI 48..59).
 *  - Applies the chord's `inversion`: the lowest N chord tones are raised an
 *    octave so the (N+1)th tone becomes the bass (a clean slash voicing).
 *
 * Returns ascending MIDI note numbers, 12-TET.
 */
export const chordToMidi = (
  chord: CorpusChord,
  keyRoot: PitchClass,
  octave: number = 3,
  mode: KeyMode = "major"
): number[] => {
  const rootPc = chordRootPc(chord, keyRoot, mode)
  const octaveRoot = midiForPc(rootPc, octave)
  const notes = QUALITY_INTERVALS[chord.quality].map((iv) => octaveRoot + iv)
  return applyInversion(notes, chord.inversion ?? 0)
}

/**
 * Raise the lowest `inv` tones an octave so the (inv)th tone is the new bass.
 * Re-sorts ascending. inv=0 → unchanged. Wraps safely past the tone count.
 */
export const applyInversion = (notes: number[], inv: number): number[] => {
  if (inv <= 0 || notes.length <= 1) return [...notes]
  const out = [...notes]
  const n = mod(inv, out.length)
  for (let i = 0; i < n; i++) out[i] += 12
  return out.sort((a, b) => a - b)
}

/**
 * A basic CLOSE or DROP-2 voicing of a chord around a register.
 *
 *  - "close": chord tones packed within ~an octave above the root (the raw
 *    chordToMidi shape, capped to `maxVoices`).
 *  - "drop2": the 2nd-highest voice of the close voicing dropped an octave —
 *    the workhorse comping spread. Falls back to close for < 4 voices.
 *
 * Pure; returns ascending MIDI. This is a *helper*, not the voice-leading
 * engine (that lives in harmony.ts's nearestPcTo and is composed later).
 */
export const voiceChord = (
  chord: CorpusChord,
  keyRoot: PitchClass,
  opts: {
    octave?: number
    mode?: KeyMode
    style?: "close" | "drop2"
    maxVoices?: number
  } = {}
): number[] => {
  const { octave = 3, mode = "major", style = "close", maxVoices = 5 } = opts
  let notes = chordToMidi(chord, keyRoot, octave, mode)
  if (notes.length > maxVoices) notes = notes.slice(0, maxVoices)
  if (style === "drop2" && notes.length >= 4) {
    const sorted = [...notes].sort((a, b) => a - b)
    const second = sorted.length - 2
    sorted[second] -= 12
    return sorted.sort((a, b) => a - b)
  }
  return notes
}

/**
 * Transpose a whole progression to a target key by recording its `keyRoot`.
 * Because the corpus is key-AGNOSTIC, "transposition" simply means resolving
 * against a different tonic — the stored degrees are unchanged. This helper
 * returns a small, explicit value object the consumer can resolve from.
 */
export interface KeyedProgression {
  progression: CorpusProgression
  /** Tonic pitch class the degrees resolve against. */
  keyRoot: PitchClass
}

/** Bind a corpus progression to a concrete key (0..11). */
export const transposeToKey = (
  progression: CorpusProgression,
  keyRoot: PitchClass
): KeyedProgression => ({ progression, keyRoot: toPc(keyRoot) })

// ----------------------------------------------------------------- beats/ticks
/** Per-chord beats for index `i` of a progression (scalar or array). */
export const beatsForChord = (prog: CorpusProgression, i: number): number => {
  const b = prog.perChordBeats
  if (Array.isArray(b)) return Math.max(1, Math.round(b[i] ?? b[b.length - 1] ?? 4))
  return Math.max(1, Math.round(b))
}

/** Total length of a progression in beats. */
export const progressionBeats = (prog: CorpusProgression): number => {
  let total = 0
  for (let i = 0; i < prog.degrees.length; i++) total += beatsForChord(prog, i)
  return total
}

/**
 * A tick-addressed chord event — the substrate the piano-roll / composer will
 * later turn into note clusters. Ticks use the document's PPQ (960). This round
 * produces DATA only (no document command is created — that is a later round).
 */
export interface ChordEvent {
  /** Index in the progression. */
  index: number
  /** The source key-agnostic chord. */
  chord: CorpusChord
  /** Start tick (PPQ-based) from the progression's start. */
  startTick: number
  /** Duration in ticks. */
  durationTicks: number
  /** Resolved MIDI notes (12-TET) in the bound key. */
  notes: number[]
  /** The chord's Roman-numeral display label. */
  roman: string
}

export interface ChordEventOptions {
  /** Tonic pitch class to resolve against. Default 0 (C). */
  keyRoot?: PitchClass
  /** Octave register for the chord root. Default 3. */
  octave?: number
  /** Voicing style for the emitted notes. Default "close". */
  style?: "close" | "drop2"
  /** Max voices in the emitted cluster. Default 5. */
  maxVoices?: number
  /** Ticks per quarter note; defaults to the document PPQ (960). */
  ppq?: number
}

/**
 * Expand a progression into ordered, tick-addressed chord events resolved to
 * MIDI in the chosen key. Aligns to the document PPQ so events can later become
 * tick-addressed clip content without re-deriving timing.
 */
export const progressionToChordEvents = (
  prog: CorpusProgression,
  opts: ChordEventOptions = {}
): ChordEvent[] => {
  const {
    keyRoot = 0,
    octave = 3,
    style = "close",
    maxVoices = 5,
    ppq = PPQ,
  } = opts
  const events: ChordEvent[] = []
  let cursor = 0
  for (let i = 0; i < prog.degrees.length; i++) {
    const chord = prog.degrees[i]
    const beats = beatsForChord(prog, i)
    const durationTicks = beats * ppq
    const notes = voiceChord(chord, toPc(keyRoot), {
      octave,
      mode: prog.mode,
      style,
      maxVoices,
    })
    events.push({
      index: i,
      chord,
      startTick: cursor,
      durationTicks,
      notes,
      roman: chord.roman,
    })
    cursor += durationTicks
  }
  return events
}
