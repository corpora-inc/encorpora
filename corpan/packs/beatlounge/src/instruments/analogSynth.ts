/**
 * beatlounge — premium analog / subtractive synth.
 *
 * A real two-oscillator subtractive voice, hand-built from Tone primitives so
 * every stage is controllable: dual oscillators (fat detuned saws, pulse with
 * width) + a sub oscillator + a noise source, mixed → a resonant multimode
 * filter driven by its OWN ADSR filter envelope (+ env amount + key-tracking) →
 * an amp ADSR → drive / saturation → output. An LFO routes to pitch (vibrato),
 * filter cutoff (wobble) or amplitude (tremolo), and glide/portamento slides
 * pitch between notes. Polyphonic via a managed voice pool, with a mono/glide
 * mode for basses and leads.
 *
 * The config is a FLAT param bag (`InstrumentConfig` kind "analogSynth"); this
 * file OWNS the full param schema (ranges/defaults/presets) and exports it so
 * the synth-analog UI module drives the exact same setters — they can't drift.
 *
 * Signal chain (per voice):
 *   osc1 ┐
 *   osc2 ┼─ voiceMix ─ filter(+filterEnv) ─ ampEnv ─┐
 *   sub  │                                          ├─ (all voices) ─ drive ─ out
 *   noise┘                                          ┘
 */

import * as Tone from "tone"
import type { Instrument, TriggerNote } from "../contracts/engine"
import type { InstrumentConfig } from "../model/document"

// ============================================================ param schema
/** Oscillator base waveforms the analog engine offers. osc1 adds "fatsawtooth"
 *  / "fatsquare" (multi-voice detuned) and "pulse" (with width). */
export const ANALOG_WAVES = [
  "sawtooth",
  "fatsawtooth",
  "square",
  "fatsquare",
  "pulse",
  "triangle",
  "sine",
] as const
export type AnalogWave = (typeof ANALOG_WAVES)[number]

export const FILTER_TYPES = ["lowpass", "bandpass", "highpass"] as const
export type AnalogFilterType = (typeof FILTER_TYPES)[number]

export const LFO_TARGETS = ["pitch", "filter", "amp"] as const
export type AnalogLfoTarget = (typeof LFO_TARGETS)[number]

export const VOICE_MODES = ["poly", "mono"] as const
export type AnalogVoiceMode = (typeof VOICE_MODES)[number]

export type AnalogParamType = "number" | "enum" | "boolean"

export interface AnalogParamSpec {
  key: string
  label: string
  type: AnalogParamType
  min?: number
  max?: number
  step?: number
  default: number | string | boolean
  /** Logarithmic feel for the UI (frequencies); engine still gets the raw value. */
  log?: boolean
  unit?: string
  options?: readonly string[]
  /** Grouping hint for the UI layout (oscillators / filter / amp / mod / out). */
  group: "osc" | "filter" | "amp" | "mod" | "out" | "voice"
  describe: string
}

const n = (
  key: string,
  label: string,
  group: AnalogParamSpec["group"],
  min: number,
  max: number,
  def: number,
  describe: string,
  extra: Partial<AnalogParamSpec> = {}
): AnalogParamSpec => ({ key, label, type: "number", group, min, max, default: def, describe, ...extra })

const env = (
  prefix: "filter" | "amp",
  group: AnalogParamSpec["group"],
  sustainDefault: number
): AnalogParamSpec[] => [
  n(`${prefix}Attack`, "Attack", group, 0.001, 4, 0.01, `${prefix} envelope attack time.`, { unit: "s", log: true }),
  n(`${prefix}Decay`, "Decay", group, 0.001, 4, 0.25, `${prefix} envelope decay time.`, { unit: "s", log: true }),
  n(`${prefix}Sustain`, "Sustain", group, 0, 1, sustainDefault, `${prefix} envelope sustain level.`),
  n(`${prefix}Release`, "Release", group, 0.005, 8, 0.4, `${prefix} envelope release time.`, { unit: "s", log: true }),
]

/** THE schema: every analog param with range/default/unit + a one-line hint. */
export const ANALOG_PARAMS: AnalogParamSpec[] = [
  // ---- oscillators ----
  { key: "osc1Wave", label: "Osc 1", type: "enum", group: "osc", options: ANALOG_WAVES, default: "sawtooth", describe: "Oscillator 1 waveform." },
  { key: "osc2Wave", label: "Osc 2", type: "enum", group: "osc", options: ANALOG_WAVES, default: "square", describe: "Oscillator 2 waveform." },
  n("osc2Semi", "Osc 2 Semi", "osc", -24, 24, 0, "Osc 2 pitch offset in semitones.", { step: 1, unit: "st" }),
  n("osc2Detune", "Detune", "osc", 0, 50, 7, "Fine detune of osc 2 / fat-osc spread in cents.", { unit: "ct" }),
  n("oscMix", "Mix", "osc", 0, 1, 0.5, "Balance between osc 1 (0) and osc 2 (1)."),
  n("pulseWidth", "PW", "osc", 0.05, 0.95, 0.5, "Pulse width for the pulse waveform."),
  n("subLevel", "Sub", "osc", 0, 1, 0.3, "Square sub-oscillator one octave below osc 1."),
  n("noiseLevel", "Noise", "osc", 0, 1, 0, "White-noise source level."),
  // ---- filter ----
  { key: "filterType", label: "Type", type: "enum", group: "filter", options: FILTER_TYPES, default: "lowpass", describe: "Filter mode." },
  n("cutoff", "Cutoff", "filter", 20, 18000, 2200, "Filter cutoff frequency.", { unit: "Hz", log: true, step: 1 }),
  n("resonance", "Reso", "filter", 0.1, 24, 4, "Filter resonance (Q)."),
  n("filterEnvAmount", "Env Amt", "filter", -1, 1, 0.5, "How much the filter envelope opens (or closes) the cutoff."),
  n("keyTracking", "Key Trk", "filter", 0, 1, 0, "How much higher notes raise the cutoff."),
  ...env("filter", "filter", 0.4),
  // ---- amp ----
  ...env("amp", "amp", 0.6),
  // ---- modulation ----
  n("lfoRate", "Rate", "mod", 0.05, 30, 5, "LFO speed.", { unit: "Hz", log: true }),
  n("lfoDepth", "Depth", "mod", 0, 1, 0, "LFO amount."),
  { key: "lfoTarget", label: "Target", type: "enum", group: "mod", options: LFO_TARGETS, default: "pitch", describe: "Where the LFO is routed: pitch (vibrato), filter (wobble), amp (tremolo)." },
  n("glide", "Glide", "voice", 0, 1, 0, "Portamento time between notes.", { unit: "s" }),
  { key: "voiceMode", label: "Voice", type: "enum", group: "voice", options: VOICE_MODES, default: "poly", describe: "Polyphonic, or monophonic with glide (bass/lead)." },
  // ---- output ----
  n("drive", "Drive", "out", 0, 1, 0.15, "Analog-style saturation / overdrive."),
  n("level", "Level", "out", 0, 1.5, 0.9, "Output gain."),
]

const SPEC_BY_KEY: Record<string, AnalogParamSpec> = Object.fromEntries(
  ANALOG_PARAMS.map((s) => [s.key, s])
)
export const analogSpec = (key: string): AnalogParamSpec | undefined => SPEC_BY_KEY[key]

// ============================================================ presets
export type AnalogParams = Record<string, number | string | boolean>

/** Default param bag (every key defined). The preset map layers over this. */
export const defaultAnalogParams = (): AnalogParams => {
  const out: AnalogParams = {}
  for (const s of ANALOG_PARAMS) out[s.key] = s.default
  return out
}

/** Named presets — sound-design starting points. Each is a sparse override of
 *  the defaults so the schema stays the single source of truth. */
export const ANALOG_PRESETS: Record<string, AnalogParams> = {
  init: {},
  "fat bass": {
    osc1Wave: "fatsawtooth",
    osc2Wave: "square",
    osc2Semi: -12,
    osc2Detune: 12,
    oscMix: 0.42,
    subLevel: 0.6,
    cutoff: 480,
    resonance: 7,
    filterEnvAmount: 0.55,
    filterAttack: 0.002,
    filterDecay: 0.22,
    filterSustain: 0.12,
    filterRelease: 0.18,
    ampAttack: 0.004,
    ampDecay: 0.2,
    ampSustain: 0.85,
    ampRelease: 0.16,
    glide: 0.04,
    voiceMode: "mono",
    drive: 0.35,
  },
  "warm pad": {
    osc1Wave: "fatsawtooth",
    osc2Wave: "fatsawtooth",
    osc2Detune: 18,
    osc2Semi: 7,
    oscMix: 0.5,
    subLevel: 0.18,
    noiseLevel: 0.04,
    cutoff: 1500,
    resonance: 1.5,
    filterEnvAmount: 0.3,
    filterAttack: 0.8,
    filterDecay: 1.4,
    filterSustain: 0.6,
    filterRelease: 2.4,
    ampAttack: 0.9,
    ampDecay: 1.2,
    ampSustain: 0.8,
    ampRelease: 2.6,
    lfoRate: 0.3,
    lfoDepth: 0.12,
    lfoTarget: "filter",
    drive: 0.1,
  },
  "acid lead": {
    osc1Wave: "sawtooth",
    osc2Wave: "sawtooth",
    osc2Detune: 4,
    oscMix: 0.2,
    subLevel: 0.25,
    cutoff: 700,
    resonance: 16,
    filterEnvAmount: 0.85,
    keyTracking: 0.4,
    filterAttack: 0.002,
    filterDecay: 0.3,
    filterSustain: 0.05,
    filterRelease: 0.2,
    ampAttack: 0.003,
    ampDecay: 0.3,
    ampSustain: 0.7,
    ampRelease: 0.15,
    glide: 0.06,
    voiceMode: "mono",
    drive: 0.5,
  },
  pluck: {
    osc1Wave: "square",
    osc2Wave: "triangle",
    osc2Semi: 12,
    oscMix: 0.35,
    subLevel: 0.2,
    cutoff: 3200,
    resonance: 3,
    filterEnvAmount: 0.65,
    filterAttack: 0.002,
    filterDecay: 0.16,
    filterSustain: 0,
    filterRelease: 0.12,
    ampAttack: 0.002,
    ampDecay: 0.18,
    ampSustain: 0,
    ampRelease: 0.12,
    drive: 0.18,
  },
}

export const ANALOG_PRESET_NAMES = Object.keys(ANALOG_PRESETS)

/** Resolve a named preset to a FULL param bag (defaults + overrides). */
export const resolveAnalogPreset = (name: string): AnalogParams => ({
  ...defaultAnalogParams(),
  ...(ANALOG_PRESETS[name] ?? {}),
})

// ============================================================ value helpers
type AnalogConfig = Extract<InstrumentConfig, { kind: "analogSynth" }>
const isAnalog = (c: InstrumentConfig): c is AnalogConfig => c.kind === "analogSynth"

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Read a numeric param, clamped to its schema range, with the schema default. */
export const numParam = (p: AnalogParams, key: string): number => {
  const spec = SPEC_BY_KEY[key]
  const def = typeof spec?.default === "number" ? spec.default : 0
  const v = p[key]
  const raw = typeof v === "number" && Number.isFinite(v) ? v : def
  if (spec?.min != null && spec?.max != null) return clamp(raw, spec.min, spec.max)
  return raw
}

/** Read an enum/string param, validated against the schema options. */
export const enumParam = <T extends string>(p: AnalogParams, key: string, options: readonly T[]): T => {
  const spec = SPEC_BY_KEY[key]
  const def = (typeof spec?.default === "string" ? spec.default : options[0]) as T
  const v = p[key]
  return typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : def
}

/** The OmniOscillator `type` value type (not exported at the top level). */
type OmniType = Tone.OmniOscillator<Tone.Oscillator>["type"]

/** Tone OmniOscillator type string for an AnalogWave (fat/pulse pass through). */
const oscType = (w: AnalogWave): OmniType => w as OmniType

// ============================================================ the voice
/**
 * One analog voice: two oscillators + sub + noise → voice mix → resonant filter
 * (with its own envelope) → amp envelope. Voices share the post-filter drive
 * stage via `out`. The pool allocates/steals voices; in mono mode a single
 * voice glides between notes.
 */
interface VoiceParams {
  osc1Wave: AnalogWave
  osc2Wave: AnalogWave
  osc2Semi: number
  osc2Detune: number
  oscMix: number
  pulseWidth: number
  subLevel: number
  noiseLevel: number
  filterType: AnalogFilterType
  cutoff: number
  resonance: number
  filterEnvAmount: number
  keyTracking: number
  filterAttack: number
  filterDecay: number
  filterSustain: number
  filterRelease: number
  ampAttack: number
  ampDecay: number
  ampSustain: number
  ampRelease: number
  glide: number
  lfoTarget: AnalogLfoTarget
  lfoDepth: number
}

const A4 = 69 // midi
/** Cutoff multiplier from key-tracking: ±N octaves around middle, scaled. */
const keyTrackMul = (midi: number, amount: number): number => {
  if (amount <= 0) return 1
  const octaves = (midi - 60) / 12
  return Math.pow(2, octaves * amount)
}

class AnalogVoice {
  readonly osc1: Tone.OmniOscillator<Tone.Oscillator>
  readonly osc2: Tone.OmniOscillator<Tone.Oscillator>
  readonly sub: Tone.Oscillator
  readonly noise: Tone.Noise
  private readonly osc1Gain: Tone.Gain
  private readonly osc2Gain: Tone.Gain
  private readonly subGain: Tone.Gain
  private readonly noiseGain: Tone.Gain
  private readonly filter: Tone.Filter
  private readonly filterEnv: Tone.FrequencyEnvelope
  private readonly ampEnv: Tone.AmplitudeEnvelope
  /** When did this voice last start — for round-robin voice stealing. */
  startedAt = 0
  /** The midi pitch currently held (or -1 when free). */
  note = -1
  active = false

  constructor(out: Tone.ToneAudioNode, p: VoiceParams) {
    this.osc1 = new Tone.OmniOscillator(440, oscType(p.osc1Wave))
    this.osc2 = new Tone.OmniOscillator(440, oscType(p.osc2Wave))
    this.sub = new Tone.Oscillator({ type: "square" })
    this.noise = new Tone.Noise("white")

    this.osc1Gain = new Tone.Gain(0)
    this.osc2Gain = new Tone.Gain(0)
    this.subGain = new Tone.Gain(0)
    this.noiseGain = new Tone.Gain(0)

    this.filter = new Tone.Filter({ type: p.filterType, frequency: p.cutoff, Q: p.resonance })
    // The filter envelope drives the cutoff ABOVE its base via an octave swing.
    this.filterEnv = new Tone.FrequencyEnvelope({
      attack: p.filterAttack,
      decay: p.filterDecay,
      sustain: p.filterSustain,
      release: p.filterRelease,
      baseFrequency: p.cutoff,
      octaves: 4,
    })
    this.ampEnv = new Tone.AmplitudeEnvelope({
      attack: p.ampAttack,
      decay: p.ampDecay,
      sustain: p.ampSustain,
      release: p.ampRelease,
    })

    this.osc1.connect(this.osc1Gain)
    this.osc2.connect(this.osc2Gain)
    this.sub.connect(this.subGain)
    this.noise.connect(this.noiseGain)
    this.osc1Gain.connect(this.filter)
    this.osc2Gain.connect(this.filter)
    this.subGain.connect(this.filter)
    this.noiseGain.connect(this.filter)
    this.filterEnv.connect(this.filter.frequency)
    this.filter.connect(this.ampEnv)
    this.ampEnv.connect(out)

    this.applyMix(p)
    this.osc1.start()
    this.osc2.start()
    this.sub.start()
    this.noise.start()
  }

  /** Re-apply mix levels + waveforms + filter/env params (no re-allocation). */
  applyMix(p: VoiceParams) {
    this.osc1.type = oscType(p.osc1Wave)
    this.osc2.type = oscType(p.osc2Wave)
    if (p.osc1Wave === "pulse" && "width" in this.osc1) {
      try {
        ;(this.osc1 as unknown as { width: { value: number } }).width.value = p.pulseWidth * 2 - 1
      } catch {
        /* width unavailable for this osc type — ignore */
      }
    }
    if (p.osc2Wave === "pulse" && "width" in this.osc2) {
      try {
        ;(this.osc2 as unknown as { width: { value: number } }).width.value = p.pulseWidth * 2 - 1
      } catch {
        /* ignore */
      }
    }
    // Fat-osc spread (cents) when applicable; plain detune otherwise.
    try {
      if (p.osc1Wave.startsWith("fat")) (this.osc1 as unknown as { spread: number }).spread = p.osc2Detune
      if (p.osc2Wave.startsWith("fat")) (this.osc2 as unknown as { spread: number }).spread = p.osc2Detune
    } catch {
      /* spread unavailable — ignore */
    }
    // Equal-power-ish crossfade between the two oscillators.
    const a = Math.cos((p.oscMix * Math.PI) / 2)
    const b = Math.sin((p.oscMix * Math.PI) / 2)
    this.osc1Gain.gain.value = a
    this.osc2Gain.gain.value = b
    this.subGain.gain.value = p.subLevel
    this.noiseGain.gain.value = p.noiseLevel * 0.6

    this.filter.type = p.filterType
    this.filter.Q.value = p.resonance
    this.filterEnv.attack = p.filterAttack
    this.filterEnv.decay = p.filterDecay
    this.filterEnv.sustain = p.filterSustain
    this.filterEnv.release = p.filterRelease

    this.ampEnv.attack = p.ampAttack
    this.ampEnv.decay = p.ampDecay
    this.ampEnv.sustain = p.ampSustain
    this.ampEnv.release = p.ampRelease
  }

  /** Set the oscillator pitch for `midi` (glide ramps; 0 = instant). */
  setPitch(midi: number, p: VoiceParams, when: number, glide: number) {
    const f1 = Tone.Frequency(midi, "midi").toFrequency()
    const f2 = Tone.Frequency(midi + p.osc2Semi, "midi").toFrequency()
    const fsub = Tone.Frequency(midi - 12, "midi").toFrequency()
    if (glide > 0 && this.active) {
      this.osc1.frequency.setValueAtTime(this.osc1.frequency.value, when)
      this.osc2.frequency.setValueAtTime(this.osc2.frequency.value, when)
      this.sub.frequency.setValueAtTime(this.sub.frequency.value, when)
      this.osc1.frequency.exponentialRampToValueAtTime(f1, when + glide)
      this.osc2.frequency.exponentialRampToValueAtTime(f2, when + glide)
      this.sub.frequency.exponentialRampToValueAtTime(fsub, when + glide)
    } else {
      this.osc1.frequency.setValueAtTime(f1, when)
      this.osc2.frequency.setValueAtTime(f2, when)
      this.sub.frequency.setValueAtTime(fsub, when)
    }
    // Osc 2 micro-detune (cents) when it is NOT a fat osc (fat uses spread).
    if (!p.osc2Wave.startsWith("fat")) this.osc2.detune.value = p.osc2Detune
  }

  /** Set the filter cutoff base for this note (key-tracking + env amount). */
  applyCutoff(midi: number, p: VoiceParams) {
    const base = clamp(p.cutoff * keyTrackMul(midi, p.keyTracking), 20, 18000)
    this.filter.frequency.value = base
    this.filterEnv.baseFrequency = base
    // Env amount maps to ± octaves of swing (negative inverts the envelope).
    this.filterEnv.octaves = p.filterEnvAmount * 5
  }

  trigger(midi: number, velocity: number, durationSec: number, when: number, p: VoiceParams, glide: number) {
    this.note = midi
    this.startedAt = when
    this.setPitch(midi, p, when, glide)
    this.applyCutoff(midi, p)
    const dur = Math.max(0.02, durationSec)
    // Velocity scales the amp envelope peak.
    this.ampEnv.triggerAttackRelease(dur, when, velocity)
    this.filterEnv.triggerAttackRelease(dur, when)
    this.active = true
    // Free the slot a touch after the release tail.
    this.releaseAt = when + dur + Tone.Time(this.ampEnv.release).toSeconds()
  }

  releaseAt = 0

  // ---- live-performance (continuous, sustained) play ----
  /** Open a SUSTAINED live voice at a fractional midi pitch (held until
   *  `liveRelease`). Unlike `trigger`, no auto-release is scheduled — the amp +
   *  filter envelopes attack and hold at sustain while the finger is down. */
  liveAttack(midi: number, velocity: number, when: number, p: VoiceParams) {
    this.note = midi
    this.startedAt = when
    this.setPitch(midi, p, when, 0)
    this.applyCutoff(midi, p)
    this.ampEnv.triggerAttack(when, velocity)
    this.filterEnv.triggerAttack(when)
    this.active = true
    this.releaseAt = Number.POSITIVE_INFINITY
  }

  /** Glide a held live voice to a new fractional midi pitch (smooth portamento
   *  on every oscillator — click-free). */
  liveBend(midi: number, when: number, glideSec: number, p: VoiceParams) {
    this.note = midi
    this.setPitch(midi, p, when, Math.max(0.001, glideSec))
    // Track key-tracked cutoff base as the finger sweeps.
    this.applyCutoff(midi, p)
  }

  /** Release a held live voice into its amp tail; returns the release seconds. */
  liveRelease(when: number): number {
    this.ampEnv.triggerRelease(when)
    this.filterEnv.triggerRelease(when)
    this.active = false
    const r = Tone.Time(this.ampEnv.release).toSeconds()
    this.releaseAt = when + (Number.isFinite(r) ? r : 0.3)
    return Number.isFinite(r) ? r : 0.3
  }

  /** The filter cutoff signal — the pool fans the shared LFO into this for the
   *  "filter" target, and `setParam("cutoff")` writes it directly. */
  get cutoffSignal(): Tone.Signal<"frequency"> {
    return this.filter.frequency
  }

  /** Connect a modulation source (the shared scaled LFO) to this voice's chosen
   *  destination. Pitch → both osc detunes; filter → cutoff. */
  connectLfo(source: Tone.ToneAudioNode, target: AnalogLfoTarget) {
    if (target === "pitch") {
      source.connect(this.osc1.detune)
      source.connect(this.osc2.detune)
    } else if (target === "filter") {
      source.connect(this.filter.frequency)
    }
  }

  dispose() {
    this.osc1.dispose()
    this.osc2.dispose()
    this.sub.dispose()
    this.noise.dispose()
    this.osc1Gain.dispose()
    this.osc2Gain.dispose()
    this.subGain.dispose()
    this.noiseGain.dispose()
    this.filter.dispose()
    this.filterEnv.dispose()
    this.ampEnv.dispose()
  }
}

// ============================================================ the instrument
const MAX_VOICES = 10

const readVoiceParams = (p: AnalogParams): VoiceParams => ({
  osc1Wave: enumParam(p, "osc1Wave", ANALOG_WAVES),
  osc2Wave: enumParam(p, "osc2Wave", ANALOG_WAVES),
  osc2Semi: numParam(p, "osc2Semi"),
  osc2Detune: numParam(p, "osc2Detune"),
  oscMix: numParam(p, "oscMix"),
  pulseWidth: numParam(p, "pulseWidth"),
  subLevel: numParam(p, "subLevel"),
  noiseLevel: numParam(p, "noiseLevel"),
  filterType: enumParam(p, "filterType", FILTER_TYPES),
  cutoff: numParam(p, "cutoff"),
  resonance: numParam(p, "resonance"),
  filterEnvAmount: numParam(p, "filterEnvAmount"),
  keyTracking: numParam(p, "keyTracking"),
  filterAttack: numParam(p, "filterAttack"),
  filterDecay: numParam(p, "filterDecay"),
  filterSustain: numParam(p, "filterSustain"),
  filterRelease: numParam(p, "filterRelease"),
  ampAttack: numParam(p, "ampAttack"),
  ampDecay: numParam(p, "ampDecay"),
  ampSustain: numParam(p, "ampSustain"),
  ampRelease: numParam(p, "ampRelease"),
  glide: numParam(p, "glide"),
  lfoTarget: enumParam(p, "lfoTarget", LFO_TARGETS),
  lfoDepth: numParam(p, "lfoDepth"),
})

/** Resolve the param bag a config addresses: explicit params over preset over
 *  defaults (an analogSynth config carries a full bag, but be defensive). */
const resolveParams = (config: AnalogConfig): AnalogParams => {
  const base = config.preset ? resolveAnalogPreset(config.preset) : defaultAnalogParams()
  return { ...base, ...(config.params ?? {}) }
}

void A4

export const createAnalogSynthInstrument = (config: AnalogConfig): Instrument => {
  let params = resolveParams(config)
  let vp = readVoiceParams(params)

  // ---- output stage: voice bus → drive/saturation → level → out ----
  const out = new Tone.Gain(numParam(params, "level"))
  const drive = new Tone.Distortion({ distortion: numParam(params, "drive"), oversample: "2x", wet: 1 })
  const voiceBus = new Tone.Gain(1)
  voiceBus.connect(drive)
  drive.connect(out)

  // ---- shared LFO (routed per lfoTarget) ----
  const lfo = new Tone.LFO({ frequency: numParam(params, "lfoRate"), min: -1, max: 1 })
  lfo.start()
  // A scaler converts the -1..1 LFO into the active target's swing.
  const lfoScale = new Tone.Gain(0)
  lfo.connect(lfoScale)

  const voices: AnalogVoice[] = []

  const newVoice = (): AnalogVoice => new AnalogVoice(voiceBus, vp)

  /** Route the (scaled) LFO to the chosen destination on every live voice. */
  const wireLfo = () => {
    // Disconnect old routes (defensive: re-connect fresh each rewire).
    try {
      lfoScale.disconnect()
    } catch {
      /* nothing connected yet */
    }
    const depth = vp.lfoDepth
    if (depth <= 0) {
      lfoScale.gain.value = 0
      return
    }
    if (vp.lfoTarget === "pitch") {
      // ±50 cents max vibrato.
      lfoScale.gain.value = depth * 50
      for (const v of voices) v.connectLfo(lfoScale, "pitch")
    } else if (vp.lfoTarget === "filter") {
      // ± up to ~3500 Hz wobble around the cutoff.
      lfoScale.gain.value = depth * 3500
      for (const v of voices) v.connectLfo(lfoScale, "filter")
    } else {
      // amp tremolo: modulate the voice bus gain ±depth/2.
      lfoScale.gain.value = depth * 0.5
      lfoScale.connect(voiceBus.gain)
    }
  }

  /** Allocate a voice for `midi`: reuse a free one, else steal the oldest. */
  const allocate = (when: number): AnalogVoice => {
    const free = voices.find((v) => !v.active || when >= v.releaseAt)
    if (free) return free
    if (voices.length < MAX_VOICES) {
      const v = newVoice()
      voices.push(v)
      wireLfo()
      return v
    }
    // Steal the oldest.
    let oldest = voices[0]
    for (const v of voices) if (v.startedAt < oldest.startedAt) oldest = v
    return oldest
  }

  // Mono mode keeps ONE voice that glides between notes.
  let monoVoice: AnalogVoice | null = null

  // Fractional MIDI = pitch + cents/100; the voice's setPitch resolves it through
  // Tone.Frequency, so the microtonal offset lands on every oscillator.
  const tunedPitch = (note: TriggerNote): number => note.pitch + (note.detuneCents ?? 0) / 100

  const triggerPoly = (note: TriggerNote, when: number) => {
    const v = allocate(when)
    v.applyMix(vp)
    v.trigger(tunedPitch(note), note.velocity, note.durationSec, when, vp, 0)
  }

  const triggerMono = (note: TriggerNote, when: number) => {
    if (!monoVoice) {
      monoVoice = newVoice()
      voices.push(monoVoice)
      wireLfo()
    }
    monoVoice.applyMix(vp)
    monoVoice.trigger(tunedPitch(note), note.velocity, note.durationSec, when, vp, vp.glide)
  }

  const applyAll = () => {
    out.gain.value = numParam(params, "level")
    drive.distortion = numParam(params, "drive")
    lfo.frequency.value = numParam(params, "lfoRate")
    for (const v of voices) v.applyMix(vp)
    wireLfo()
  }

  // ---- live multitouch path: a dedicated pool of sustained AnalogVoices ----
  // Separate from the sequencer voices so live fingers never steal scheduled
  // notes. Each finger holds one voice and glides its pitch continuously.
  const LIVE_MAX = 8
  const LIVE_GLIDE = 0.06
  interface LiveSlot {
    id: number
    voice: AnalogVoice
    freeAt: number
    startedAt: number
    held: boolean
  }
  const liveSlots: LiveSlot[] = []
  let liveNextId = 1
  const allocLive = (when: number): LiveSlot => {
    const free = liveSlots.find((s) => !s.held && when >= s.freeAt)
    if (free) return free
    if (liveSlots.length < LIVE_MAX) {
      const voice = new AnalogVoice(voiceBus, vp)
      const slot: LiveSlot = { id: 0, voice, freeAt: 0, startedAt: 0, held: false }
      liveSlots.push(slot)
      return slot
    }
    let oldest = liveSlots[0]
    for (const s of liveSlots) if (s.startedAt < oldest.startedAt) oldest = s
    return oldest
  }
  const liveById = (id: number): LiveSlot | undefined =>
    liveSlots.find((s) => s.held && s.id === id)
  /** Sequencer + live voices — so live knob tweaks reach a held finger too. */
  const allLiveAndSeq = (): AnalogVoice[] => [...voices, ...liveSlots.map((s) => s.voice)]

  return {
    output: out,
    live: {
      startVoice(midi, velocity, when) {
        const slot = allocLive(when)
        slot.id = liveNextId++
        slot.held = true
        slot.startedAt = when
        slot.voice.applyMix(vp)
        slot.voice.liveAttack(midi, Math.max(0, Math.min(1, velocity)), when, vp)
        return slot.id
      },
      bendVoice(id, midi, when) {
        liveById(id)?.voice.liveBend(midi, when, LIVE_GLIDE, vp)
      },
      endVoice(id, when) {
        const slot = liveById(id)
        if (!slot) return
        const r = slot.voice.liveRelease(when)
        slot.held = false
        slot.freeAt = when + Math.max(0.02, r) + 0.05
      },
    },
    trigger(note: TriggerNote, when: number) {
      try {
        if (vp.glide > 0 || (params.voiceMode === "mono")) triggerMono(note, when)
        else triggerPoly(note, when)
      } catch {
        /* ignore transient scheduling errors under heavy retrigger */
      }
    },
    update(next: InstrumentConfig) {
      if (!isAnalog(next)) return
      params = resolveParams(next)
      vp = readVoiceParams(params)
      // Mode change: drop the mono voice so poly re-allocates fresh.
      if (params.voiceMode !== "mono" && vp.glide <= 0) monoVoice = null
      applyAll()
      for (const s of liveSlots) s.voice.applyMix(vp)
    },
    setParam(param: string, value: number, when: number) {
      // Live continuous knob tweaks — touch only the affected nodes (no rebuild).
      switch (param) {
        case "cutoff": {
          params.cutoff = value
          vp.cutoff = value
          for (const v of allLiveAndSeq()) v.cutoffSignal.setValueAtTime(value, when)
          break
        }
        case "resonance": {
          params.resonance = value
          vp.resonance = value
          for (const v of allLiveAndSeq()) v.applyMix(vp)
          break
        }
        case "drive": {
          params.drive = value
          drive.distortion = value
          break
        }
        case "level": {
          params.level = value
          out.gain.setValueAtTime(value, when)
          break
        }
        case "lfoRate": {
          params.lfoRate = value
          lfo.frequency.setValueAtTime(value, when)
          break
        }
        case "lfoDepth": {
          params.lfoDepth = value
          vp.lfoDepth = value
          wireLfo()
          break
        }
        case "oscMix":
        case "subLevel":
        case "noiseLevel":
        case "filterEnvAmount": {
          ;(params as AnalogParams)[param] = value
          vp = readVoiceParams(params)
          for (const v of allLiveAndSeq()) v.applyMix(vp)
          break
        }
        default: {
          // Generic numeric param: fold into the bag + re-derive voice params.
          ;(params as AnalogParams)[param] = value
          vp = readVoiceParams(params)
          for (const v of allLiveAndSeq()) v.applyMix(vp)
        }
      }
    },
    async load() {
      /* no assets */
    },
    dispose() {
      for (const v of voices) v.dispose()
      voices.length = 0
      for (const s of liveSlots) s.voice.dispose()
      liveSlots.length = 0
      monoVoice = null
      lfo.dispose()
      lfoScale.dispose()
      drive.dispose()
      voiceBus.dispose()
      out.dispose()
    },
  }
}
