/**
 * beatlounge — the song document (schema 1).
 *
 * THE CONTRACT EVERYTHING BUILDS ON. Rules:
 *  1. Every datum is plain JSON — no class instances, no functions, no Tone
 *     objects. Serializes losslessly to IndexedDB and to the LLM.
 *  2. Every event is addressed by (trackId, tick). Ticks are canonical;
 *     "steps" are a derived view (see ./timing).
 *  3. A mutation is `reduce(doc, command) => doc'` — a pure function with
 *     structural sharing (see ./reduce). There is ONE write path.
 *
 * Tamburas / tablas / drones / sine-pads are PRESETS over the generic
 * instrument engines below — not new engine kinds.
 */

import type { Id } from "./ids"
import type { Grid, Tick, TimeSignature } from "./timing"
import { PPQ } from "./timing"
import { newId } from "./ids"

export type { Id } from "./ids"
export type { Grid, Tick, TimeSignature, GridDenominator } from "./timing"

export type Normalized = number // 0..1
export type Midi = number // 0..127
export const SCHEMA = 1 as const

// ---------------------------------------------------------------- tempo/meter
export interface TempoEvent {
  id: Id
  tick: Tick
  bpm: number
}
export interface MeterEvent {
  id: Id
  tick: Tick
  sig: TimeSignature
}

// ---------------------------------------------------------------- events
/** A pitched / triggered note. `duration` in ticks ⇒ sustained pads & drones. */
export interface NoteEvent {
  id: Id
  tick: Tick
  duration: Tick
  pitch: Midi // for drum pads, pitch == pad/key number
  velocity: Normalized
  /** 0..1 trigger chance (generative). Absent ⇒ always. */
  probability?: Normalized
  /** Subdivide into N hits (drum rolls). Absent ⇒ 1. */
  ratchet?: number
  /** Signed, INTENTIONAL micro-timing offset in ticks (humanize is computed). */
  micro?: Tick
}

/** A TTS / audio-fragment placement — the phrase-sampler's atom. */
export interface FragmentEvent {
  id: Id
  tick: Tick
  /** FK → BeatloungeDoc.fragmentLibrary[].id */
  fragmentId: Id
  gain: Normalized
  /** -24..+24, applied via GrainPlayer detune — the per-step "performance". */
  pitchSemis: number
  /** 1 = natural; grain time-stretch independent of pitch. */
  stretch?: number
  reverse?: boolean
  /** In-sample crop start, 0..1. */
  startOffset?: Normalized
  /** Optional turntable-scratch rate envelope across the step duration. */
  scratch?: ScratchAutomation
}

export interface ScratchAutomation {
  /** playbackRate keyframes (may be negative), evenly spaced over the step. */
  curve: number[]
}

// ---------------------------------------------------------------- automation
export type ParamTarget =
  | { scope: "track"; trackId: Id; param: "volume" | "pan" }
  | { scope: "insert"; trackId: Id; insertId: Id; param: string }
  | { scope: "send"; trackId: Id; sendId: Id; param: "level" }
  | { scope: "instrument"; trackId: Id; param: string }
  | { scope: "bus"; busId: Id; param: string }
  | { scope: "master"; param: "volume" }

export interface AutomationPoint {
  id: Id
  tick: Tick
  value: number
  curve?: "step" | "linear" | "expo"
}
export interface AutomationLane {
  id: Id
  target: ParamTarget
  points: AutomationPoint[] // sorted by tick
  default: number
}

// ---------------------------------------------------------------- modulators
/**
 * An AUTONOMOUS modulator — a "knob tweaker". It drives a ParamTarget over time
 * with a shape, so the loop evolves itself instead of being hand-tweaked. The
 * modulation engine evaluates these against the tempo clock and writes the
 * result onto the live audio nodes (the doc keeps the BASE value; modulation is
 * a live overlay around it). Agents/macros and the LLM spawn these en masse.
 */
export type ModulatorShape =
  | "sine"
  | "triangle"
  | "saw"
  | "square"
  | "random" // stepped random (sample & hold) at the rate
  | "drift" // smooth random walk (perlin-ish)

export interface Modulator {
  id: Id
  target: ParamTarget
  shape: ModulatorShape
  /** Cycle length in beats (tempo-synced). Use this OR rateHz. */
  syncBeats?: number
  /** Free rate in Hz when not tempo-synced. */
  rateHz?: number
  /** Swing of the modulation, in normalized 0..1 param space. */
  depth: Normalized
  /** Center of the swing, in normalized 0..1 param space (the resting value). */
  center: Normalized
  /** Start phase 0..1. */
  phase?: Normalized
  /** Seed for random/drift shapes (reproducible). */
  seed?: number
  enabled: boolean
}

// ---------------------------------------------------------------- effects
export type EffectKind =
  | "filter"
  | "eq3"
  | "compressor"
  | "distortion"
  | "chorus"
  | "phaser"
  | "bitcrusher"
  | "delay"
  | "reverb"
  | "limiter"
  | "gain"

export interface EffectNode {
  id: Id
  kind: EffectKind
  enabled: boolean
  /** Flat JSON param bag; the audioGraph reconciler maps keys to Tone setters. */
  params: Record<string, number | string | boolean>
}

export interface Send {
  id: Id
  busId: Id
  level: Normalized
  preFader?: boolean
}

// ---------------------------------------------------------------- instruments
export interface FilterCfg {
  type: "lowpass" | "highpass" | "bandpass"
  frequency: number
  q: number
}
export interface EnvCfg {
  attack: number
  decay: number
  sustain: Normalized
  release: number
}
export interface DrumPad {
  note: Midi
  sampleId: Id
  chokeGroup?: number
  gain: Normalized
}
export interface SampleZone {
  sampleId: Id
  rootNote: Midi
  loNote: Midi
  hiNote: Midi
  loVel?: Normalized
  hiVel?: Normalized
}

export type InstrumentConfig =
  | { kind: "drumSampler"; kitId?: Id; pads: DrumPad[]; fallback: "synthKit" }
  | { kind: "sampler"; sampleSetId: Id; zones: SampleZone[]; mode: "repitch" | "grain" }
  | {
      kind: "synth"
      osc: "sine" | "triangle" | "sawtooth" | "square"
      filter: FilterCfg
      env: EnvCfg
    }
  | { kind: "fmSynth"; harmonicity: number; modIndex: number; env: EnvCfg }
  | { kind: "wavetable"; tableId: Id; env: EnvCfg; filter: FilterCfg }
  | { kind: "soundfont"; soundfontId: Id; program: number; bank: number }
  | { kind: "ttsFragment"; voiceId?: string }
  /** A premium analog/subtractive synth. Flat param bag (like EffectNode) so
   *  the instrument owns its own rich schema (oscillators, filter+env, LFO,
   *  drive, glide …) without churning this union. */
  | { kind: "analogSynth"; preset?: string; params: Record<string, number | string | boolean> }

export type InstrumentKind = InstrumentConfig["kind"]

// ---------------------------------------------------------------- tracks
export type TrackKind = "instrument" | "fragment"

export interface TrackBase {
  id: Id
  name: string
  color?: string
  /** UI / quantize default; events stay tick-addressed regardless. */
  grid: Grid
  /** Polymeter: omit ⇒ inherit the song loop length. */
  lengthTicks?: Tick
  volume: Normalized
  pan: number // -1..1
  mute: boolean
  solo: boolean
  groupId?: Id
  inserts: EffectNode[]
  sends: Send[]
  automation: AutomationLane[]
}

export interface InstrumentTrack extends TrackBase {
  kind: "instrument"
  instrument: Exclude<InstrumentConfig, { kind: "ttsFragment" }>
  notes: NoteEvent[] // sorted by tick — THE addressable grid data
}

export interface FragmentTrack extends TrackBase {
  kind: "fragment"
  instrument: Extract<InstrumentConfig, { kind: "ttsFragment" }>
  fragments: FragmentEvent[] // sorted by tick
}

export type Track = InstrumentTrack | FragmentTrack

export const isInstrumentTrack = (t: Track): t is InstrumentTrack =>
  t.kind === "instrument"
export const isFragmentTrack = (t: Track): t is FragmentTrack =>
  t.kind === "fragment"

// ---------------------------------------------------------------- buses
export interface Bus {
  id: Id
  name: string
  role: "group" | "fx"
  inserts: EffectNode[]
  sends: Send[]
  volume: Normalized
  mute: boolean
}

// ---------------------------------------------------------------- harmony
/**
 * THE GLOBAL PITCH WORLD (HARMONY_VISION §4). One field on the doc is the sole
 * source of truth for tonic, tuning, the modal/chordal choice, and the chord
 * timeline. Every melodic module reads it through the pure resolver
 * (`music/resolver.ts`) — no module ever picks its own scale.
 *
 * Plain JSON (document.ts rule #1): a tonic pitch-class, a scale reference (the
 * corpus mode id + family + tuning), a tick-addressed chord timeline, and the
 * configurable reference pitch. 12-TET / C-major / A=440 is the migration-safe
 * default so old docs open sounding identical.
 */

/** Which editor's output the resolver consumes (HARMONY_VISION §3). */
export type HarmonyMode = "modal" | "chordal"

/** The corpus family a modal scale is drawn from (mirrors `music/modes`). */
export type HarmonyScaleFamily =
  | "western"
  | "thaat"
  | "melakarta"
  | "maqam"
  | "persian"
  | "turkish"

/** Built-in tuning systems (mirrors `music/tuning` TuningSystemId). */
export type HarmonyTuningId = "equal12" | "pythagorean" | "just"

/** Regional intonation school for maqam (mirrors `music/modes` MaqamSchool).
 *  Optional — absent ⇒ the default school. Only meaningful for the maqam family. */
export type MaqamSchool = "grid" | "just" | "egyptian" | "syrian"

/**
 * The active modal scale: a corpus mode id (e.g. "western.ionian") within a
 * family, intonated through a tuning. The tonic lives on `Harmony` (shared with
 * chordal mode) so switching editors keeps the key.
 */
export interface HarmonyScale {
  family: HarmonyScaleFamily
  /** Stable corpus mode id, e.g. "western.ionian", "thaat.bhairav", "maqam.rast". */
  id: string
  /** How the abstract degrees are intonated. Default "equal12" (chord-safe). */
  tuning: HarmonyTuningId
  /** Maqam regional intonation school (maqam family only). Absent ⇒ default school. */
  school?: MaqamSchool
}

/**
 * A chord placed on the loop timeline — same (tick) addressing as NoteEvent /
 * TempoEvent. The `symbol` is parsed by `music/harmony.parseChord` (forgiving).
 * `durationTicks` is informational; the active chord at a tick is simply the
 * last chord whose tick ≤ the query tick (it sustains until the next chord).
 */
export interface HarmonyChordEvent {
  id: Id
  tick: Tick
  /** Chord SYMBOL ("Cmaj7", "Dm7b5", "G7"). 12-TET; chords require 12-TET. */
  symbol: string
  /** Sustain in ticks (until the next chord by default). Informational. */
  durationTicks?: Tick
}

/** The configurable reference pitch (A4 = 440 @ MIDI 69 by convention). */
export interface HarmonyReference {
  hz: number
  midi: number
}

export interface Harmony {
  /** Which editor's output the resolver consumes. */
  mode: HarmonyMode
  /** Tonic pitch class 0..11 (C = 0). Shared by modal + chordal. */
  tonic: number
  /** The active modal scale (used directly when mode === "modal"). */
  scale: HarmonyScale
  /** Tick-addressed chord timeline (used when mode === "chordal"), sorted by tick. */
  progression: HarmonyChordEvent[]
  /** Reference pitch the tuning is anchored to. Default { hz: 440, midi: 69 }. */
  reference: HarmonyReference
}

/** The migration-safe default: modal, C, Western Ionian, 12-TET, A = 440. */
export const defaultHarmony = (): Harmony => ({
  mode: "modal",
  tonic: 0,
  scale: { family: "western", id: "western.ionian", tuning: "equal12" },
  progression: [],
  reference: { hz: 440, midi: 69 },
})

// ---------------------------------------------------------------- fragments
export interface FragmentRef {
  id: Id
  source: "voiceKit" | "ttsRender" | "userSample"
  voiceId?: string
  text?: string
  language?: string
  /** corpan-pack:// or blob URL; raw bytes live in IndexedDB keyed by sha256. */
  assetUrl?: string
  sha256?: string
  durationSec?: number
}

// ---------------------------------------------------------------- document
export interface BeatloungeDoc {
  schema: typeof SCHEMA
  id: Id
  name: string
  ppq: typeof PPQ
  bpm: number
  tempoMap: TempoEvent[]
  meterMap: MeterEvent[] // first entry is the initial meter
  loopLengthTicks: Tick // ≤ MAX_LOOP_TICKS
  swing: { amount: Normalized; grid: Grid }
  masterVolume: Normalized
  tracks: Track[] // render order
  buses: Bus[]
  fragmentLibrary: FragmentRef[]
  /** Autonomous knob-tweakers driving params over time. */
  modulators: Modulator[]
  /** THE GLOBAL PITCH WORLD — tonic/scale/tuning + chord timeline. Every
   *  melodic module reads it through `music/resolver.ts`. Optional in the type
   *  so persisted pre-harmony docs deserialize; `migrateDoc` fills it on load. */
  harmony?: Harmony
  createdAt: number
  updatedAt: number
}

/**
 * Migration-safe harmony accessor: returns the doc's harmony, or the default
 * (modal C-major 12-TET) if a persisted doc predates the field. The resolver
 * and every consumer go through this so a missing field never throws.
 */
export const docHarmony = (doc: BeatloungeDoc): Harmony =>
  doc.harmony ?? defaultHarmony()

/**
 * Migrate a (possibly persisted) doc additively + idempotently. Returns the SAME
 * reference when nothing changes (no churn). Old docs open sounding identical;
 * NoteEvent.pitch is untouched. Steps:
 *  1. fill a missing `harmony` with the default,
 *  2. ensure ONE phrase (fragment) track exists so the mixer always shows a
 *     "Phrases" strip with its own FX chain — appended (existing tracks/ids and
 *     order are preserved). Phrase Jam still binds to the first fragment track,
 *     so it reuses this one instead of lazily creating another.
 */
export const migrateDoc = (doc: BeatloungeDoc): BeatloungeDoc => {
  let next = doc
  if (!next.harmony) next = { ...next, harmony: defaultHarmony() }
  if (!next.tracks.some(isFragmentTrack)) {
    next = { ...next, tracks: [...next.tracks, newFragmentTrack()] }
  }
  return next
}

// ---------------------------------------------------------------- factories
export const defaultInsertChain = (): EffectNode[] => []

const sixteenth: Grid = { denominator: 16 }

/** A subtractive synth preset (warm triangle). */
export const synthPreset = (
  osc: "sine" | "triangle" | "sawtooth" | "square" = "triangle"
): Extract<InstrumentConfig, { kind: "synth" }> => ({
  kind: "synth",
  osc,
  filter: { type: "lowpass", frequency: 3000, q: 1.2 },
  env: { attack: 0.005, decay: 0.18, sustain: 0.2, release: 0.25 },
})

/** A default analog/subtractive synth config (the analog-synth instrument owns
 *  the full param schema in instruments/analogSynth.ts; this mirrors its `init`
 *  defaults as plain JSON so a fresh analogSynth track has a sensible patch
 *  without importing the engine into the pure model layer). */
export const analogSynthPreset = (): Extract<InstrumentConfig, { kind: "analogSynth" }> => ({
  kind: "analogSynth",
  preset: "init",
  params: {
    osc1Wave: "sawtooth",
    osc2Wave: "square",
    osc2Semi: 0,
    osc2Detune: 7,
    oscMix: 0.5,
    pulseWidth: 0.5,
    subLevel: 0.3,
    noiseLevel: 0,
    filterType: "lowpass",
    cutoff: 2200,
    resonance: 4,
    filterEnvAmount: 0.5,
    keyTracking: 0,
    filterAttack: 0.01,
    filterDecay: 0.25,
    filterSustain: 0.4,
    filterRelease: 0.4,
    ampAttack: 0.01,
    ampDecay: 0.25,
    ampSustain: 0.6,
    ampRelease: 0.4,
    lfoRate: 5,
    lfoDepth: 0,
    lfoTarget: "pitch",
    glide: 0,
    voiceMode: "poly",
    drive: 0.15,
    level: 0.9,
  },
})

export const newInstrumentTrack = (
  name: string,
  instrument: InstrumentTrack["instrument"],
  notes: NoteEvent[] = [],
  patch: Partial<TrackBase> = {}
): InstrumentTrack => ({
  id: newId("trk"),
  name,
  grid: sixteenth,
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  ...patch,
  kind: "instrument",
  instrument,
  notes,
})

/** The display name of the singular phrase (fragment) track — named by KIND so
 *  its mixer strip always reads "Phrases", never the snippet it happens to hold.
 *  Mirrors `TRACK_BASE.phrases`; kept here so the model layer needs no UI import. */
export const PHRASE_TRACK_NAME = "Phrases"

/** A fresh, empty phrase (fragment) track — the one Phrase Jam sequences saved
 *  snippets on, and the strip the mixer shows for phrases. 16-step bar, named by
 *  kind. Same shape Phrase Jam creates lazily; making it part of the default doc
 *  + migration means the Phrases strip is in the mixer from the first open. */
export const newFragmentTrack = (patch: Partial<TrackBase> = {}): FragmentTrack => ({
  id: newId("trk"),
  name: PHRASE_TRACK_NAME,
  color: "#7cf2c0",
  grid: sixteenth,
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  inserts: [],
  sends: [],
  automation: [],
  ...patch,
  kind: "fragment",
  instrument: { kind: "ttsFragment" },
  fragments: [],
})

/** General-MIDI-ish drum pad pitches we use as a convention. */
export const DRUM_PITCH = { kick: 36, snare: 38, hat: 42, clap: 39 } as const

/**
 * A fresh, EMPTY default: the canonical track layout (one Drums track, one
 * Synth track, one Phrases track) with NO notes on the grid. Pressing play does
 * nothing until you add content — by design, so "new" is a calm blank slate
 * rather than a stock loop. The "Start fresh" affordances build on this:
 *   - Clear     → this exact empty default (fixed C-Ionian, studio kit),
 *   - Randomize → empty grid but randomized instruments / kit / harmony / meter,
 *   - Demos     → a shipped starter song dropped onto the grid.
 * (We deliberately dropped the old four-on-the-floor + rising C–E–G–C default.)
 * Loop = one 4/4 bar so the empty grid still has sensible dimensions.
 */
export const createDefaultDoc = (now: number): BeatloungeDoc => {
  const bar = PPQ * 4

  const drumTrack = newInstrumentTrack(
    "Drums",
    { kind: "drumSampler", pads: [], fallback: "synthKit" },
    [],
    { color: "#39e0ff", grid: sixteenth }
  )

  const synthTrack = newInstrumentTrack("Synth", synthPreset("triangle"), [], {
    color: "#c66bff",
    volume: 0.7,
    grid: { denominator: 8 },
  })

  return {
    schema: SCHEMA,
    id: newId("song"),
    name: "First Loop",
    ppq: PPQ,
    bpm: 96,
    tempoMap: [],
    meterMap: [{ id: newId("m"), tick: 0, sig: { numerator: 4, denominator: 4 } }],
    loopLengthTicks: bar,
    swing: { amount: 0, grid: { denominator: 16 } },
    masterVolume: 0.8,
    tracks: [drumTrack, synthTrack, newFragmentTrack()],
    buses: [],
    fragmentLibrary: [],
    modulators: [],
    harmony: defaultHarmony(),
    createdAt: now,
    updatedAt: now,
  }
}

/** Build a Modulator with sensible defaults (1-bar sine around the midpoint). */
export const createModulator = (
  target: ParamTarget,
  patch: Partial<Omit<Modulator, "id" | "target">> = {}
): Modulator => ({
  id: newId("mod"),
  target,
  shape: "sine",
  syncBeats: 4,
  depth: 0.4,
  center: 0.5,
  phase: 0,
  enabled: true,
  ...patch,
})

// ---------------------------------------------------------------- lookups
export const findTrack = (doc: BeatloungeDoc, trackId: Id): Track | undefined =>
  doc.tracks.find((t) => t.id === trackId)

export const trackIndex = (doc: BeatloungeDoc, trackId: Id): number =>
  doc.tracks.findIndex((t) => t.id === trackId)

/** Any track soloed ⇒ only soloed (and un-muted) tracks are audible. */
export const isTrackAudible = (doc: BeatloungeDoc, track: Track): boolean => {
  const anySolo = doc.tracks.some((t) => t.solo)
  if (track.mute) return false
  return anySolo ? track.solo : true
}
