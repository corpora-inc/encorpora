/**
 * beatlounge — the AudioFacade: the ONE seam between the audio engine and the
 * UI shell. The engine (scheduler + audioGraph + instruments) implements it and
 * wires itself to the command bus internally (it subscribes to doc changes and
 * reconciles). The shell consumes ONLY this interface — it never imports a Tone
 * object. The shell mutates audio by dispatching commands to the bus; the audio
 * reacts. This keeps the two halves of Wave 1 independently buildable.
 */

import type { CommandBus } from "../model/commandBus"
import type { Id, ParamTarget, Tick } from "../model/document"
import type { TtsFragmentDeps } from "../instruments/ttsFragment"

/** A live voice in flight (one finger). The surface bends its pitch while the
 *  finger drags and releases it on lift. Idempotent release. */
export interface LiveVoiceHandle {
  /** Glide this voice to a new fractional MIDI pitch (smooth portamento). */
  bend(midi: number): void
  /** Release this voice into its amp tail (safe to call more than once). */
  release(): void
}

export interface AudioFacade {
  /** Resume the AudioContext (user-gesture) and start the transport. */
  start(): Promise<void>
  stop(): void
  isPlaying(): boolean
  /** rAF-driven playhead in ticks (wrapped into the loop). -1 when stopped. */
  onPlayhead(cb: (tick: Tick) => void): () => void
  /** One-shot audition of a track's instrument (click-to-hear), at audio-now.
   *  `pitch` (MIDI / drum-pad number) overrides the track's default so drum
   *  pads audition the right pad. */
  previewTrack(trackId: Id, velocity?: number, pitch?: number): void
  /** Drive a param in REAL TIME (no document write) — the live-performance seam
   *  behind ribbons / XY pads. e.g. {scope:"instrument",trackId,param:"pitchOffset"}
   *  bends a phrase track's pitch as the finger moves. Smoothed at the node. */
  applyParam(target: ParamTarget, value: number): void
  /** Open a CONTINUOUS live-performance voice on a track's instrument (one
   *  finger). `midi` is fractional (60.5 = +50 cents). Returns a handle to glide
   *  the pitch as the finger drags and release it on lift. Undefined when the
   *  track / engine cannot play live (the surface then falls back to previews).
   *  Live performance — never writes the document. */
  playLiveVoice(trackId: Id, midi: number, velocity?: number): LiveVoiceHandle | undefined
  /** The shared AudioContext, for modules that need their own nodes (scopes). */
  context(): AudioContext
  dispose(): void
}

export interface BeatloungeAudioOpts {
  /** Reuse an existing AudioContext (else one is created). */
  ctx?: AudioContext
  /** Phrase-sampler deps so ttsFragment tracks play real audio (the headline
   *  sampler feature). Omit ⇒ ttsFragment tracks use a synth fallback. */
  fragmentDeps?: TtsFragmentDeps
}

/**
 * Factory the engine exports and `App` calls. The facade subscribes to the bus
 * for the lifetime of the pack; `dispose()` unsubscribes and frees nodes.
 */
export type CreateBeatloungeAudio = (
  bus: CommandBus,
  opts?: BeatloungeAudioOpts
) => AudioFacade
