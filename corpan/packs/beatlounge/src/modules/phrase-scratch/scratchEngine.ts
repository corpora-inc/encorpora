/**
 * beatlounge — the phrase-SCRATCH ENGINE: a LIVE, hand-driven turntable for a
 * single isolated phrase snippet. Like `auditionPhrase`, it plays DIRECTLY on
 * the pack's shared AudioContext (NOT through the command bus / transport /
 * scheduler) — it's a performance instrument the widget drives by hand.
 *
 * CONTINUITY — the whole point — is by construction:
 *
 *   • A `Tone.GrainPlayer` with `loop: true` is the source. Granular playback
 *     decouples playback SPEED from pitch and lets the rate move smoothly through
 *     and across ZERO (forward ⇄ reverse) WITHOUT ever re-triggering the source.
 *     Because we NEVER call stop()/start() to change speed — we only ride
 *     `playbackRate` — there are no re-trigger gaps, so there are NO SKIPS and no
 *     clicks. A held finger = rate ~0 = the record sits in its groove (the loop
 *     keeps the node alive); the user resumes the scratch with zero discontinuity.
 *   • Small grains (grainSize ~0.05, like the rest of the pack) keep the scratch
 *     feeling immediate while overlap crossfades any grain boundary so it stays
 *     click-free even at high speed.
 *
 * The widget feeds this engine a target rate every animation frame (mapped from
 * finger velocity by scratchMath); the engine just keeps the GrainPlayer looping
 * and writes the rate. A separate "spin" toggle parks the baseline at 0 (hold)
 * or 1 (the phrase loops normally) so the user can start it spinning then scratch
 * over the top. Pitch is an independent `detune` (the grain decoupling is exactly
 * what lets pitch and scratch-speed move independently).
 *
 * Errors are logged, not swallowed. `dispose()` stops + frees every node.
 */

import * as Tone from "tone"
import { clampRate } from "./scratchMath"

const LOG = "[beatlounge/phrase-scratch]"

export interface ScratchEngine {
  /** True once a buffer is loaded and the loop is running. */
  isLive(): boolean
  /** Set the live turntable rate (signed; negative = reverse). Click-free. */
  setRate(rate: number): void
  /** Read the rate currently driving the source. */
  getRate(): number
  /** Independent pitch in semitones (grain detune; does NOT change scratch speed). */
  setPitch(semitones: number): void
  /** Master output level 0..1. */
  setGain(gain: number): void
  /** Loaded buffer duration in seconds (0 if none). */
  duration(): number
  /** Free every node + stop sound. Idempotent. */
  dispose(): void
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Build a scratch engine over the shared AudioContext for a decoded buffer.
 * The GrainPlayer starts looping immediately at the given baseline rate (0 by
 * default = a held record) so the source is ALWAYS alive and rate changes are
 * gapless from the first touch.
 */
export const createScratchEngine = (
  ctx: AudioContext,
  buffer: AudioBuffer,
  opts: { baselineRate?: number; gain?: number } = {}
): ScratchEngine => {
  // Adopt the shared context so Tone schedules on the same clock + destination
  // as the rest of the pack (idempotent, matches ribbonVoice / audioGraph).
  Tone.setContext(ctx)

  const out = new Tone.Gain(clamp01(opts.gain ?? 0.95))
  out.connect(ctx.destination)

  let rate = clampRate(opts.baselineRate ?? 0)
  let disposed = false
  let live = false

  // GrainPlayer: looped granular source. grainSize/overlap chosen small enough
  // to feel immediate yet overlap-crossfaded so grain seams never click.
  const player = new Tone.GrainPlayer({
    url: new Tone.ToneAudioBuffer(buffer),
    loop: true,
    grainSize: 0.05,
    overlap: 0.025,
    playbackRate: Math.abs(rate) < 1e-4 ? 0.0001 : Math.abs(rate),
    detune: 0,
  }).connect(out)

  // GrainPlayer has no signed reverse on playbackRate; direction is a boolean.
  // We set both: |rate| drives speed, sign drives the `reverse` flag.
  const applyRate = () => {
    if (disposed) return
    const abs = Math.abs(rate)
    try {
      // A true zero would freeze the grain clock; keep a hair of motion so the
      // source stays warm and resuming is instantaneous + click-free.
      player.playbackRate = abs < 1e-4 ? 0.0001 : abs
      const wantReverse = rate < 0
      if (player.reverse !== wantReverse) player.reverse = wantReverse
    } catch (err) {
      console.warn(`${LOG} applyRate failed:`, err)
    }
  }

  // Start the loop now so the record is spinning (or held) before the first drag.
  try {
    player.start()
    live = true
    applyRate()
  } catch (err) {
    console.warn(`${LOG} GrainPlayer start failed:`, err)
  }

  return {
    isLive: () => live && !disposed,
    setRate(next: number) {
      if (disposed) return
      rate = clampRate(next)
      applyRate()
    },
    getRate: () => rate,
    setPitch(semitones: number) {
      if (disposed) return
      try {
        player.detune = Math.max(-2400, Math.min(2400, semitones * 100))
      } catch (err) {
        console.warn(`${LOG} setPitch failed:`, err)
      }
    },
    setGain(gain: number) {
      if (disposed) return
      try {
        out.gain.rampTo(clamp01(gain), 0.02)
      } catch (err) {
        console.warn(`${LOG} setGain failed:`, err)
      }
    },
    duration: () => buffer.duration,
    dispose() {
      if (disposed) return
      disposed = true
      live = false
      try {
        player.stop()
      } catch {
        /* already stopped */
      }
      try {
        player.dispose()
      } catch (err) {
        console.warn(`${LOG} player dispose failed:`, err)
      }
      try {
        out.dispose()
      } catch (err) {
        console.warn(`${LOG} out dispose failed:`, err)
      }
    },
  }
}
