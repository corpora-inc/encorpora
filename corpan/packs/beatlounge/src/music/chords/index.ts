/**
 * beatlounge — chord-progressions corpus + pure chord API (public surface).
 *
 * A key-AGNOSTIC, 12-TET, IP-safe library of ~1000 chord progressions plus the
 * pure functions to resolve them to MIDI, voice them, transpose them, and emit
 * tick-addressed chord events. No song/artist/album names; everything is
 * generated from music theory (see docs/CHORDS_CORPUS.md).
 *
 * This is a FOUNDATION module — it does not touch the document model, audio, or
 * UI. The harmony engine / composer / piano-roll consume it in a later round.
 */

// Schema + tag taxonomy
export type {
  PitchClass,
  KeyMode,
  CorpusChordQuality,
  CorpusChord,
  CorpusProgression,
  ProgressionFamily,
} from "./types"
export { FAMILIES } from "./types"

// Quality tables + degree resolution
export {
  QUALITY_INTERVALS,
  MODE_SCALE,
  chordRootPc,
  chordRootOffset,
  chordPcs,
} from "./qualities"

// Pure chord API
export {
  DEFAULT_OCTAVE_MIDI,
  midiForPc,
  chordToMidi,
  chordToMidiAtRoot,
  applyInversion,
  voiceChord,
  transposeToKey,
  beatsForChord,
  progressionBeats,
  progressionToChordEvents,
} from "./chordApi"
export type {
  KeyedProgression,
  ChordEvent,
  ChordEventOptions,
} from "./chordApi"

// The corpus + lookup/listing API
export {
  CORPUS,
  CORPUS_IDS,
  getProgression,
  listByFamily,
  listByTag,
  listByTags,
  allTags,
  familyCounts,
} from "./corpus"

// Seeded random selection
export {
  makeRng,
  randomProgression,
} from "./random"
export type { Rng, RandomFilter } from "./random"
