/**
 * beatlounge — engine-facing contracts (FROZEN).
 *
 * These narrow interfaces let separate teams build the scheduler, the audio
 * graph, each instrument engine, and each effect in parallel against stubs.
 * The only shared dependency is the pure ./model layer.
 */

import type { ToneAudioNode } from "tone"
import type {
  BeatloungeDoc,
  Id,
  InstrumentConfig,
  Midi,
  Normalized,
  ParamTarget,
  Tick,
} from "../model/document"

// ----------------------------------------------------------- asset loading
export interface AssetLoader {
  /** Resolve a corpan-pack:// / catalog / blob asset to raw bytes. */
  resolve(ref: {
    assetUrl?: string
    soundfontId?: Id
    sampleId?: Id
    fragmentId?: Id
  }): Promise<ArrayBuffer>
  /** A decodable object URL for a fragment/sample (Blob-URL on iOS WebKit). */
  url(ref: { assetUrl?: string; fragmentId?: Id; sampleId?: Id }): Promise<string>
}

// ----------------------------------------------------------- instruments
export interface TriggerNote {
  pitch: Midi
  velocity: Normalized
  durationSec: number
  /** Microtonal offset (cents) to apply on top of the 12-TET pitch — the bridge
   *  that makes sequenced notes honor the active tuning (maqam neutral tones,
   *  pythagorean/just, …). Absent/0 ⇒ plain 12-TET (unchanged). Engines that can't
   *  detune (e.g. the GM soundfont worklet) ignore it. */
  detuneCents?: number
  // ttsFragment extras:
  fragmentId?: Id
  pitchSemis?: number
  stretch?: number
  reverse?: boolean
  scratchCurve?: number[]
}

/** An opaque handle to ONE live performance voice (a single finger). The
 *  surface bends its pitch as the finger drags and releases it on lift. */
export type VoiceId = number

/** A continuous, per-touch live-performance voice — the seam the multitouch
 *  instrument surface plays through. Distinct from the sequencer's `trigger`
 *  (which schedules fixed notes at exact times): here a voice is held open,
 *  glided in pitch while a finger drags, and released on lift, so dragging a
 *  finger sweeps pitch smoothly (Theremin / fretless feel) and many fingers =
 *  many simultaneous voices.
 *
 *  Pitch is a FRACTIONAL MIDI number (60.0 = C4, 60.5 = +50 cents) so the
 *  surface can request any frequency between the chromatic grid. Engines that
 *  cannot retune a held voice cleanly fall back to retriggering on a big jump
 *  (and may note that). All methods are no-ops for unknown ids. */
export interface LivePlayable {
  /** Open a voice at a fractional MIDI pitch; returns its id (per finger). */
  startVoice(midi: number, velocity: Normalized, when: number): VoiceId
  /** Glide an open voice to a new fractional MIDI pitch (smooth portamento). */
  bendVoice(id: VoiceId, midi: number, when: number): void
  /** Release an open voice into its amp-release tail. */
  endVoice(id: VoiceId, when: number): void
}

/** Every instrument engine (synth/fm/wavetable/sampler/drumSampler/soundfont/
 *  ttsFragment) implements this. The audioGraph owns its lifecycle. */
export interface Instrument {
  /** Output node — connect into the track's insert chain / track gain. */
  readonly output: ToneAudioNode
  /** Schedule a note at an exact AudioContext time (seconds). */
  trigger(note: TriggerNote, when: number): void
  /** Apply a config delta (reconciler calls on doc change). */
  update(config: InstrumentConfig): void | Promise<void>
  /** Set an automatable param at audio time. */
  setParam(param: string, value: number, when: number): void
  /** Async asset load (samples / soundfonts / fragments). */
  load(assets: AssetLoader): Promise<void>
  /** OPTIONAL live-performance voices (continuous-pitch multitouch play). When
   *  absent the surface falls back to fixed-note `trigger`s. */
  readonly live?: LivePlayable
  dispose(): void
}

// ----------------------------------------------------------- effects
export interface Effect {
  readonly input: ToneAudioNode
  readonly output: ToneAudioNode
  /** Reconcile to the JSON params. Tempo-synced effects (delay) read the song
   *  BPM from the ambient tempo source (see effects/tempo), so a tempo change
   *  re-fires this and the time recomputes — no bpm parameter to thread. */
  update(params: Record<string, number | string | boolean>, enabled: boolean): void
  setParam(param: string, value: number, when: number): void
  dispose(): void
}

// ----------------------------------------------------------- scheduler
export interface ScheduledTrigger {
  trackId: Id
  when: number // AudioContext seconds
  note: TriggerNote
}

export interface Scheduler {
  start(fromTick?: Tick): Promise<void>
  stop(): void
  isPlaying(): boolean
  /** Re-read tempo / loop / events from a new immutable doc snapshot. */
  setDoc(doc: BeatloungeDoc): void
  /** Audio-thread subscription: fires per event at exact AudioContext time. */
  onTrigger(cb: (e: ScheduledTrigger) => void): () => void
  /** UI subscription: rAF-driven playhead position in ticks. */
  onPlayhead(cb: (tick: Tick) => void): () => void
  dispose(): void
}

// ----------------------------------------------------------- audio graph
export interface AudioGraph {
  /** Diff-driven: touch only the nodes that changed between docs. */
  reconcile(prev: BeatloungeDoc | null, next: BeatloungeDoc): void | Promise<void>
  /** Route a scheduled trigger from the scheduler to the right instrument. */
  dispatch(t: ScheduledTrigger): void
  setMasterVolume(v: Normalized): void
  /** Write a resolved ACTUAL value onto the live node a ParamTarget addresses
   *  (the modulation engine calls this each frame to drive autonomous knobs). */
  applyParam(target: ParamTarget, value: number): void
  /** The live-performance voices of a track's instrument, if the engine supports
   *  continuous play (the multitouch instrument surface plays through this). */
  liveInstrument(trackId: Id): LivePlayable | undefined
  dispose(): void
}
