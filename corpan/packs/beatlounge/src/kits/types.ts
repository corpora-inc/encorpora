/**
 * beatlounge — the DRUM-KIT corpus schema (the 4th corpus, after rhythms /
 * modes / chords). A kit is a set of per-voice SYNTHESIS parameters baked in as
 * plain data — NO sample assets, NO downloads (every voice is synthesised by
 * Tone, exactly like the original hardcoded kit). A `KitDef` re-skins the SOUND
 * of each drum voice; it never changes the pitch/voice SET (that stays the
 * DRUM_PITCH + drum-pads convention).
 *
 * Rules (mirror the model contract):
 *  1. Every datum is plain JSON — no Tone objects, no functions. Serializes for
 *     IndexedDB / the LLM and is trivially testable.
 *  2. The parametric synth (instruments/drumKit.ts) BUILDS its voices from a
 *     KitDef. The default kit reproduces the original sound 1:1.
 */

/**
 * The fixed set of drum VOICE ROLES the synth kit addresses. These map 1:1 to
 * the kit pitches the drum instrument triggers (see rhythm/roles.ts KIT and
 * drumKit.ts triggerForPitch):
 *   kick 36 · snare 38 · rim 37 · clap 39 · closedHat 42 · pedalHat 44 ·
 *   openHat 46 · loTom 43 · hiTom 45 · conga 64 · crash 49 · ride 51 ·
 *   cowbell 56 · tamb 54 · shaker 70 · click(claves) 75.
 *
 * A kit MUST define every role (so no pad is ever silent); families that don't
 * specialise a voice inherit it from the default kit via `mergeKit`.
 */
export type VoiceRole =
  | "kick"
  | "snare"
  | "rim"
  | "clap"
  | "closedHat"
  | "pedalHat"
  | "openHat"
  | "loTom"
  | "hiTom"
  | "conga"
  | "crash"
  | "ride"
  | "cowbell"
  | "tamb"
  | "shaker"
  | "click"

/** All voice roles in canonical order (the test/coverage source of truth). */
export const VOICE_ROLES: readonly VoiceRole[] = [
  "kick",
  "snare",
  "rim",
  "clap",
  "closedHat",
  "pedalHat",
  "openHat",
  "loTom",
  "hiTom",
  "conga",
  "crash",
  "ride",
  "cowbell",
  "tamb",
  "shaker",
  "click",
] as const

/** Oscillator waveform for tonal/membrane voices. */
export type OscType = "sine" | "triangle" | "sawtooth" | "square"
/** Noise colour for noise voices (hats, snare, claps, cymbals, shakers). */
export type NoiseType = "white" | "pink" | "brown"
/** Filter response used to shape a voice. */
export type FilterType = "lowpass" | "highpass" | "bandpass"

/** A simple AD(S)R envelope. `sustain` defaults to 0 for one-shot percussion;
 *  `release` defaults to a tiny value when omitted (some originals had none). */
export interface Envelope {
  attack: number
  decay: number
  /** 0..1; nearly always 0 for percussion. */
  sustain?: number
  release?: number
}

/** A resonant filter stage. */
export interface VoiceFilter {
  type: FilterType
  frequency: number
  /** Resonance / bandwidth. */
  q?: number
}

/**
 * The synthesis recipe for ONE drum voice. A voice is built from one of three
 * engines, selected by `source`:
 *
 *  • "membrane"  — Tone.MembraneSynth: pitched body with a fast pitch decay.
 *                  Used for kicks, toms, congas, surdos. `baseNote`+`pitchDecay`
 *                  +`octaves` shape the punch & the 808-style pitch drop.
 *  • "noise"     — Tone.NoiseSynth through an optional filter chain. Used for
 *                  hats, snare top, claps, cymbals, shakers, tambourine.
 *  • "tonal"     — one or two detuned oscillators through a band-pass gated by
 *                  an amplitude envelope. Used for cowbells, claves, rims,
 *                  blips (707/CR-78 style). `partials` lets a cowbell ring two
 *                  squares; a rim is a single bright click.
 *
 * Several voices LAYER (snare = noise + body; cowbell = two oscillators). The
 * schema models that with optional `body` (a membrane layer under a noise
 * voice) and `partials` (extra oscillators for a tonal voice).
 */
export type VoiceSource = "membrane" | "noise" | "tonal"

/** One detuned partial for a tonal voice (cowbell, metallic blip). */
export interface VoicePartial {
  /** Frequency in Hz (absolute — tonal percussion isn't key-tracked). */
  frequency: number
  type: OscType
  /** Relative level in dB (mixed under the voice). */
  level?: number
}

/** A membrane "body" layer that can sit under a noise voice (snare body). */
export interface BodyLayer {
  /** MIDI note the body is tuned to. */
  baseNote: number
  pitchDecay: number
  octaves: number
  type: OscType
  env: Envelope
  /** Level trim in dB relative to the voice. */
  level?: number
}

export interface VoiceParams {
  source: VoiceSource

  // ---- membrane / tonal pitch ----
  /** MIDI note the voice is tuned to (membrane body, tonal fundamental when no
   *  explicit partials). Ignored by pure "noise" voices. */
  baseNote?: number
  /** MembraneSynth pitch-envelope speed — the 808/909 "boom" drop. */
  pitchDecay?: number
  /** MembraneSynth octave span of the pitch sweep. */
  octaves?: number
  /** Oscillator waveform (membrane body / first tonal partial). */
  osc?: OscType

  // ---- noise ----
  /** Noise colour for "noise" voices. */
  noise?: NoiseType

  // ---- tonal partials (cowbell = two squares, rim = one bright tri) ----
  /** Extra oscillators for a tonal voice. The first uses `baseNote`+`osc`. */
  partials?: VoicePartial[]

  // ---- shared shaping ----
  env: Envelope
  /** Optional filter stage (band/high/low-pass) the voice runs through. */
  filter?: VoiceFilter
  /** A SECOND filter in series before `filter` (the hats' HPF→BPF stack). */
  filter2?: VoiceFilter
  /** A membrane body layered UNDER a noise voice (snare body thump). */
  body?: BodyLayer
  /** Output level trim for the whole voice, in dB. */
  level?: number
  /** Trigger length override in seconds (else a sensible per-source default). */
  durationSec?: number
}

/** The kit families, grouped for the picker + paired with rhythm families. */
export type KitFamily =
  | "electronic"
  | "acoustic"
  | "world"

export interface KitFamilyMeta {
  family: KitFamily
  label: string
  /** One-line description for the picker section header. */
  blurb: string
}

/**
 * A complete drum kit: an id, display name, family, a short description, and the
 * per-voice synthesis params. A kit need only specify the voices it specialises;
 * `resolveKit` fills the rest from the default kit so EVERY role is always
 * defined (no silent pad). The corpus authors full kits for clarity, but the
 * partial form is supported for compact "variation" kits.
 */
export interface KitDef {
  id: string
  name: string
  family: KitFamily
  /** One-line character description (shown in the picker). */
  description: string
  /** Per-voice synthesis. Partial in source; `resolveKit` completes it. */
  voices: Partial<Record<VoiceRole, VoiceParams>>
}

/** A kit with EVERY voice resolved (the form the synth consumes). */
export interface ResolvedKit extends KitDef {
  voices: Record<VoiceRole, VoiceParams>
}
