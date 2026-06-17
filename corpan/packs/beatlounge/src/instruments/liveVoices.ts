/**
 * beatlounge — live-performance voice pool (the multitouch instrument-surface
 * audio path). Distinct from the sequencer's fixed-note `trigger`: each finger
 * opens a MONO voice that is held, glided in pitch as the finger drags, and
 * released on lift. Many fingers = many voices.
 *
 * Each engine that supports continuous play supplies a tiny `LiveVoiceFactory`
 * (build one monophonic Tone node wired into the engine's output, plus a
 * pitch-setter). This pool layers the shared behaviour on top: allocation,
 * click-free pitch glide (a short ramp on the frequency, NOT a hard set), and
 * release into the amp tail. Pitch is FRACTIONAL MIDI so any frequency between
 * the chromatic grid is reachable (fretless / Theremin).
 *
 * Pure DSP, no React. Tested via a stub factory so the glide/alloc/release
 * logic is verifiable without WebAudio.
 */

import type { LivePlayable, VoiceId } from "../contracts/engine"

/** Convert a fractional MIDI pitch to Hz (A4 = 69 = 440 Hz). */
export const midiToHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)

/** One live monophonic voice the engine knows how to build + retune. */
export interface LiveVoice {
  /** Begin the amp envelope at `when` (seconds) for `velocity` (0..1). */
  attack(velocity: number, when: number): void
  /** Set the playing frequency (Hz). `glideSec` 0 = instant, >0 = smooth ramp
   *  from the current value (click-free portamento for a dragging finger). */
  setHz(hz: number, when: number, glideSec: number): void
  /** Release the amp envelope at `when`; returns the release time (seconds) so
   *  the pool can free the voice after the tail. */
  release(when: number): number
  dispose(): void
}

export interface LiveVoiceFactory {
  /** Build a fresh idle voice (oscillators running, amp at zero). */
  create(): LiveVoice
  /** Max simultaneous fingers before the oldest voice is stolen. */
  maxVoices?: number
  /** Glide time (seconds) for a dragging finger; small = tight, 0 = stepped. */
  glideSec?: number
}

interface Slot {
  id: VoiceId
  voice: LiveVoice
  freeAt: number
  startedAt: number
  active: boolean
}

/**
 * Build a `LivePlayable` over a voice factory. The returned object is what an
 * `Instrument` exposes as `.live`. The caller supplies AudioContext-time `when`
 * on each call, so the pool needs no clock of its own.
 */
export const createLivePool = (
  factory: LiveVoiceFactory
): LivePlayable & { dispose(): void } => {
  const glide = Math.max(0, factory.glideSec ?? 0.06)
  const max = Math.max(1, factory.maxVoices ?? 8)
  const slots: Slot[] = []
  let nextId = 1

  /** A reusable slot: a free one past its release tail, else a new one (up to
   *  max), else steal the oldest. */
  const allocate = (when: number): Slot => {
    const free = slots.find((s) => !s.active && when >= s.freeAt)
    if (free) return free
    if (slots.length < max) {
      const slot: Slot = {
        id: 0,
        voice: factory.create(),
        freeAt: 0,
        startedAt: 0,
        active: false,
      }
      slots.push(slot)
      return slot
    }
    let oldest = slots[0]
    for (const s of slots) if (s.startedAt < oldest.startedAt) oldest = s
    return oldest
  }

  const byId = (id: VoiceId): Slot | undefined =>
    slots.find((s) => s.active && s.id === id)

  return {
    startVoice(midi, velocity, when) {
      const slot = allocate(when)
      const id = nextId++
      slot.id = id
      slot.active = true
      slot.startedAt = when
      // Pitch is set INSTANTLY at note-on (no glide into the first note).
      slot.voice.setHz(midiToHz(midi), when, 0)
      slot.voice.attack(Math.max(0, Math.min(1, velocity)), when)
      return id
    },
    bendVoice(id, midi, when) {
      const slot = byId(id)
      if (slot) slot.voice.setHz(midiToHz(midi), when, glide)
    },
    endVoice(id, when) {
      const slot = byId(id)
      if (!slot) return
      const releaseSec = slot.voice.release(when)
      slot.active = false
      slot.freeAt = when + Math.max(0.02, releaseSec) + 0.05
    },
    dispose() {
      for (const s of slots) s.voice.dispose()
      slots.length = 0
    },
  }
}
