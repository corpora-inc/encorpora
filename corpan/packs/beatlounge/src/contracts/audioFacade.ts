/**
 * beatlounge — the AudioFacade: the ONE seam between the audio engine and the
 * UI shell. The engine (scheduler + audioGraph + instruments) implements it and
 * wires itself to the command bus internally (it subscribes to doc changes and
 * reconciles). The shell consumes ONLY this interface — it never imports a Tone
 * object. The shell mutates audio by dispatching commands to the bus; the audio
 * reacts. This keeps the two halves of Wave 1 independently buildable.
 */

import type { CommandBus } from "../model/commandBus"
import type { Id, Tick } from "../model/document"
import type { TtsFragmentDeps } from "../instruments/ttsFragment"

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
