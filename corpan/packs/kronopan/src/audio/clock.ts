// The clock contract.
//
// A clock reports a continuous musical position in pulses and drives whatever
// sound its backend makes. Views never know which backend is running: they read
// positionPulses() every animation frame and map it onto the cycle with
// core.activeAt. This indirection is deliberate. Today there is one backend, the
// internal synthesized metronome. Two more are planned and fit this same
// interface without changing it:
//
//   * a reference-audio backend that plays a looped recording and reports its
//     position, so a learner can practice against a real performance (the loop
//     length plus the chosen cycle fixes the tempo, the way a looper pedal
//     derives BPM once you pick the bar structure)
//   * a Web MIDI slave clock that follows an external device
//
// Only the internal backend is built now.

import type { Cycle } from "../core"

// How dense the click track is. Each level is a superset of the one before.
//   cycle:        only the cycle downbeat sounds
//   group-heads:  the downbeat and the first pulse of every group
//   pulse:        every pulse
//   subdivision:  every pulse plus a soft click halfway between pulses
export type ClickDensity = "cycle" | "group-heads" | "pulse" | "subdivision"

// The voice a given click uses. The three musical roles come straight from the
// cycle geometry; subdivision is the extra half-pulse tick.
export type ClickRole = "downbeat" | "group-head" | "pulse" | "subdivision"

export type ClockState = "stopped" | "running"

export interface Clock {
  // Resumes the audio context (must be called from a user gesture on mobile)
  // and starts the transport.
  start(): Promise<void>
  stop(): void
  state(): ClockState

  // Continuous position in pulses since the last start, as a float. It is not
  // moved by a tempo change, so the playhead stays phase-locked while the
  // musician turns the dial. Swapping the cycle may restart it at the downbeat.
  // Wrap it onto one cycle with core.activeAt or core.wrapPulses for display.
  positionPulses(): number

  // Quarter-note BPM. Changing tempo must not move the current position.
  setTempo(bpm: number): void
  getTempo(): number

  // Swapping the cycle may restart the phase at the downbeat, and callers should
  // tell the musician that it did.
  setCycle(cycle: Cycle): void

  setClickDensity(density: ClickDensity): void
  getClickDensity(): ClickDensity

  // Click track level, 0 to 1.
  setVolume(v: number): void

  dispose(): void
}
