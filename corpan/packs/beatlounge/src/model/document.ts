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
  createdAt: number
  updatedAt: number
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

const newInstrumentTrack = (
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

const drumNote = (tick: Tick, pitch: Midi, velocity = 0.9): NoteEvent => ({
  id: newId("n"),
  tick,
  duration: PPQ / 8,
  pitch,
  velocity,
})

/** General-MIDI-ish drum pad pitches we use as a convention. */
export const DRUM_PITCH = { kick: 36, snare: 38, hat: 42, clap: 39 } as const

/**
 * A fresh, musically-alive default: four-on-the-floor kick, backbeat snare,
 * eighth hats, on a single drum-sampler track (synth-kit fallback), plus a
 * polysynth track with a short C–E–G–C riff. Loop = one 4/4 bar.
 */
export const createDefaultDoc = (now: number): BeatloungeDoc => {
  const bar = PPQ * 4
  const q = PPQ // quarter
  const e = PPQ / 2 // eighth
  const s16 = PPQ / 4 // sixteenth

  const drumNotes: NoteEvent[] = []
  // kick: beats 1..4
  for (let i = 0; i < 4; i++) drumNotes.push(drumNote(i * q, DRUM_PITCH.kick))
  // snare: beats 2 & 4
  drumNotes.push(drumNote(1 * q, DRUM_PITCH.snare, 0.85))
  drumNotes.push(drumNote(3 * q, DRUM_PITCH.snare, 0.85))
  // hats: every eighth
  for (let t = 0; t < bar; t += e) drumNotes.push(drumNote(t, DRUM_PITCH.hat, 0.5))
  drumNotes.sort((a, b) => a.tick - b.tick)

  const drumTrack = newInstrumentTrack(
    "Drums",
    { kind: "drumSampler", pads: [], fallback: "synthKit" },
    drumNotes,
    { color: "#39e0ff", grid: sixteenth }
  )

  const lead: NoteEvent[] = [
    { id: newId("n"), tick: 0, duration: q, pitch: 60, velocity: 0.7 },
    { id: newId("n"), tick: q, duration: q, pitch: 64, velocity: 0.7 },
    { id: newId("n"), tick: 2 * q, duration: q, pitch: 67, velocity: 0.7 },
    { id: newId("n"), tick: 3 * q, duration: q, pitch: 72, velocity: 0.7 },
  ]
  const synthTrack = newInstrumentTrack("Synth", synthPreset("triangle"), lead, {
    color: "#c66bff",
    volume: 0.7,
    grid: { denominator: 8 },
  })
  // suppress unused-var lint for s16 in environments that tree-shake aggressively
  void s16

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
    tracks: [drumTrack, synthTrack],
    buses: [],
    fragmentLibrary: [],
    modulators: [],
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
