import type { Material } from "./dsp/materials.ts"

/**
 * Dynawalla audio foundation — public types.
 *
 * Everything here is synthesized at runtime. No sample files, ever. A prototype
 * author touches `play()`, `music`, `ambience` and `onCue`; the rest is the kit
 * keeping 60fps and not sounding like a 1980s calculator.
 */

/** Quality tier. Drives voice caps, reverb, partial counts, grain density. */
export type Tier = "ultra" | "high" | "medium" | "low"

/** Mix destination. Ducking, caps and limiting are per-bus. */
export type BusName = "sfx" | "ui" | "music" | "ambience"

/**
 * Haptic intent carried by a cue. The kit never calls a haptics plugin itself —
 * the host maps this onto `tauri-plugin-haptics` so a browser prototype and a
 * device build share one call site.
 */
export type HapticHint = "none" | "light" | "medium" | "heavy" | "success" | "warning"

/**
 * A cue is emitted for EVERY `play()` — including when audio is muted or the
 * device is silenced. That is deliberate: wire your visuals to cues and the
 * prototype is automatically accessible, because sound never carries
 * information alone.
 */
export interface Cue {
  /** Preset id that fired. */
  readonly id: string
  /** AudioContext time the sound starts (already includes any scheduling offset). */
  readonly when: number
  /** 0..1 loudness/impact the caller asked for. */
  readonly intensity: number
  /** Semitone offset actually used, after ladder + variation. */
  readonly semitones: number
  /** Preset's haptic intent. */
  readonly haptic: HapticHint
  /** Rough visual weight 0..1 — how big a flash/shake this deserves. */
  readonly weight: number
  /** True when the sound was NOT rendered (muted, disabled, or voice-capped). */
  readonly silent: boolean
}

/** Options accepted by `play()`. Every field is optional — one-liners are the point. */
export interface PlayOptions {
  /** 0..1. Drives level, brightness and (for some presets) the layer count. */
  intensity?: number
  /** Pitch offset in semitones, added to the preset's own pitch logic. */
  semitones?: number
  /** Stereo position -1..1. Default is a small deterministic spread per preset. */
  pan?: number
  /** Seconds from now. Use for chords/rolls; sub-millisecond accurate. */
  delay?: number
  /** Force this preset to duck the music by this much (0..1). */
  duck?: number
  /** Deterministic variation seed — same seed, same sound. Omit for lively random. */
  seed?: number
}

/** A voice returned by presets that can be held or stopped early. */
export interface VoiceHandle {
  /** Release the voice now (fades over its own release time). */
  stop(at?: number): void
  /** Context time this voice can be reclaimed. */
  readonly endsAt: number
}

/** What a preset gets when it builds a sound. */
export interface RenderCtx {
  readonly ctx: BaseAudioContext
  /** Where this voice should connect. Already bus- and tier-correct. */
  readonly out: AudioNode
  /** Pre-fader reverb send for this bus, or null when reverb is off (low tier). */
  readonly send: AudioNode | null
  readonly when: number
  readonly intensity: number
  /** Total pitch offset in semitones (caller + ladder + variation). */
  readonly semitones: number
  readonly tier: Tier
  /** Deterministic per-trigger randomness. Always use this, never Math.random. */
  rand(): number
  /** Uniform in [lo,hi). */
  range(lo: number, hi: number): number
  /** Shared, lazily built noise buffers / curves / waves for this context. */
  readonly tables: SharedTables
  /** Polyphonic Karplus-Strong string bank, when the worklet loaded. */
  readonly strings: StringBank | null
  /** Polyphonic modal bank, when the worklet loaded. */
  readonly modal: ModalVoiceBank | null
  /**
   * The preset's own level, already applied to `out` by a per-voice gain node.
   * Presets do not need to multiply by it — it is here so a voice's reverb
   * SEND can be scaled to match (the send taps the bus, not the voice gain).
   */
  readonly level: number
}

/** The struck-object bank. See dsp/banks.ts. */
export interface ModalVoiceBank {
  strike(opts: {
    when: number
    material: Material
    freq: number
    velocity: number
    damp?: number
    sustain?: number
    modes?: number
    pan?: number
    gain?: number
    rand?: () => number
  }): void
}

/** Result of building one sound. */
export interface RenderResult {
  /** Context time by which the voice is inaudible and its nodes are collectable. */
  endsAt: number
  /** Optional early-release hook for sustained voices. */
  release?(at: number): void
}

/** A preset: the unit a prototype author names. */
export interface Preset {
  readonly id: string
  readonly bus: BusName
  /** Base gain 0..1 before intensity. Presets are loudness-matched by ear + LUFS. */
  readonly gain: number
  /** Voice budget category — presets sharing a group steal from each other. */
  readonly group?: string
  /** Max simultaneous voices of this preset. Default from its group. */
  readonly poly?: number
  readonly haptic?: HapticHint
  /** Visual weight for cue consumers. */
  readonly weight?: number
  /** How much this sound ducks music/ambience (0..1). */
  readonly duck?: number
  /** Minimum gap between retriggers, seconds. Stops machine-gun phase stacking. */
  readonly minGap?: number
  /** Per-trigger pitch jitter in cents (± this). Default 30. */
  readonly jitterCents?: number
  render(rc: RenderCtx): RenderResult
}

/** Lazily built, shared-per-context DSP tables. Built once, never per voice. */
export interface SharedTables {
  white(): AudioBuffer
  pink(): AudioBuffer
  brown(): AudioBuffer
  /** Sparse impulse ("velvet") noise — cheap, crisp transients with no low rumble. */
  velvet(): AudioBuffer
  /** Soft-saturation curve for warmth (odd-harmonic, no aliasing splatter). */
  saturation(amount: number): Float32Array<ArrayBuffer>
  /** Hard-knee safety clipper used at the master. */
  safetyClip(): Float32Array<ArrayBuffer>
  /** Procedurally generated reverb impulse. */
  impulse(kind: "tile" | "courtyard" | "plate", seconds: number): AudioBuffer
  /**
   * A pre-baked granular grain: band index 0-7 (1.4 kHz -> 12.8 kHz), amplitude
   * index 0-3. Band-passed, Hann-windowed and pre-scaled, so playing one costs
   * exactly one AudioBufferSourceNode and nothing else.
   */
  grain(band: number, amp: number): AudioBuffer
}

/** Polyphonic Karplus-Strong bank running in an AudioWorklet. */
export interface StringBank {
  readonly node: AudioNode
  /**
   * Pluck a string. Sample-accurate: `when` is an AudioContext time and the
   * worklet lands the excitation on the exact frame.
   */
  pluck(opts: {
    when: number
    freq: number
    /** 0..1 — how hard. Drives excitation brightness and level. */
    velocity: number
    /** Decay time to -60dB, seconds. */
    decay: number
    /** 0..1 — 0 is a bright wire, 1 is a felt-muted thump. */
    damping: number
    /** 0..0.5 — pick position along the string; changes which harmonics survive. */
    position?: number
    /** -1..1 */
    pan?: number
    gain?: number
  }): void
  dispose(): void
}
