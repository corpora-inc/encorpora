/**
 * The last thing between a game and a child's ears.
 *
 * Every Dynawalla game builds its own Web Audio graph, and every one of them
 * ended it with `master.connect(ctx.destination)`. That is the line this file
 * replaces. Instead:
 *
 *     master -> bus.input -> [ level -> limiter -> shaper -> mute ] -> destination
 *
 * `limiter`  a real DynamicsCompressorNode at a limiting setting, which does
 *            the musical work: it rides the loud moments down instead of
 *            letting them collide.
 * `shaper`   a WaveShaperNode whose curve is flat at +/-CEILING. This is the
 *            guarantee. The Web Audio spec says an input outside [-1, 1] uses
 *            the nearest curve value, so the largest sample this node can emit
 *            is the largest value in the curve — for any input, including the
 *            14x-full-scale burst MOSAIC was producing. A limiter alone cannot
 *            promise that: its attack time is real, and the first two
 *            milliseconds of a transient go straight through it.
 * `mute`     after the ceiling, so muted means silent and not merely quiet.
 *
 * The node vocabulary is deliberately tiny — createGain, createWaveShaper,
 * createDynamicsCompressor, connect, and `.value` on a param. That is exactly
 * what the games' own fake contexts already implement. The shared chrome module
 * broke four games by reaching for DOM APIs their doubles did not have; this
 * one does not reach.
 */

import { CEILING, KNEE, shaperCurve } from "./ceiling.ts"

/** The slice of AudioContext this module touches. Nothing else is assumed. */
export type BusContext = {
  readonly currentTime: number
  readonly destination: AudioNode
  createGain(): GainNode
  createDynamicsCompressor(): DynamicsCompressorNode
  createWaveShaper?: () => WaveShaperNode
}

export type SafetyBusOptions = {
  /** Peak the bus may emit, linear 0..1. Defaults to CEILING. */
  readonly ceiling?: number
  /** Master trim applied BEFORE the limiter. Defaults to 1. */
  readonly level?: number
  /** Where the bus ends. Defaults to `ctx.destination`. */
  readonly output?: AudioNode
  /** Start muted — for a game that mounts with sound off. */
  readonly muted?: boolean
}

export type SafetyBus = {
  /** Connect every voice here. Never to `ctx.destination`. */
  readonly input: AudioNode
  /** The peak this bus can emit, whatever is fed to it. */
  readonly ceiling: number
  /** Master trim before the limiter, 0..1. */
  setLevel(level: number): void
  /** True silence, after the ceiling. */
  setMuted(muted: boolean): void
  readonly muted: boolean
  disconnect(): void
}

/**
 * Limiter settings.
 *
 * threshold 0 dB    and this number is not a compromise, it is measured. A
 *                   DynamicsCompressorNode applies an internal makeup gain
 *                   derived from its threshold, which means a threshold below
 *                   zero makes QUIET material louder — the opposite of the job.
 *                   Rendered against a real implementation, small-signal gain
 *                   through this node was:
 *
 *                       threshold -3 dB  ->  1.218x   (+1.7 dB, every cue)
 *                       threshold -1 dB  ->  1.068x
 *                       threshold  0 dB  ->  1.000x   (unity, exactly)
 *
 *                   and the exact makeup differs between engines, so any
 *                   negative threshold would also make the bus's behaviour
 *                   depend on whether the child is on WebKit or Chromium.
 *                   At 0 the node engages precisely when material would
 *                   otherwise clip, and turns it down instead of distorting
 *                   it. The musical part of the job — the soft bend that
 *                   starts well below full scale — belongs to the shaper's
 *                   knee, which is exact arithmetic and the same everywhere.
 * knee 0            a limiter, not a glue compressor. The games that had a
 *                   compressor at knee 22-26 and ratio 5 were gluing, not
 *                   limiting, and still clipped when six cues overlapped.
 * ratio 20          the Web Audio maximum.
 * attack 0.003      as fast as the node is useful at. The remaining leak is
 *                   what the shaper is for, and what MIN_ATTACK prevents.
 * release 0.25      slow enough not to pump on a fast run of hits.
 */
const THRESHOLD_DB = 0
const RATIO = 20
const ATTACK = 0.003
const RELEASE = 0.25

export function createSafetyBus(ctx: BusContext, options: SafetyBusOptions = {}): SafetyBus {
  const ceiling = clamp01(options.ceiling ?? CEILING)

  const input = ctx.createGain()
  const level = ctx.createGain()
  level.gain.value = clamp01(options.level ?? 1)

  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = THRESHOLD_DB
  limiter.knee.value = 0
  limiter.ratio.value = RATIO
  limiter.attack.value = ATTACK
  limiter.release.value = RELEASE

  const mute = ctx.createGain()
  let muted = options.muted === true
  mute.gain.value = muted ? 0 : 1

  input.connect(level)
  level.connect(limiter)

  // The ceiling. Without a WaveShaper there is no guarantee, only a limiter and
  // a hope — so say so out loud rather than shipping a bus that claims a
  // ceiling it cannot hold.
  let shaper: WaveShaperNode | null = null
  if (typeof ctx.createWaveShaper === "function") {
    shaper = ctx.createWaveShaper()
    shaper.curve = shaperCurve(2048, ceiling, KNEE)
    // "none", and it matters. Oversampling a WaveShaper means upsample, shape,
    // downsample — and the downsampling filter rings past the curve's own
    // maximum. Rendered offline against a real Web Audio implementation, a
    // sawtooth driven 1000x into this exact curve came out at:
    //
    //     oversample "none"  ->  0.8900   (the ceiling, exactly)
    //     oversample "2x"    ->  1.0820   (clipping)
    //     oversample "4x"    ->  1.0978   (clipping)
    //
    // The nicer-sounding setting is the one that voids the guarantee. Since
    // the limiter upstream means this node barely engages in normal play, the
    // aliasing it trades away is the cheaper thing to give up.
    try {
      shaper.oversample = "none"
    } catch (e) {
      console.warn("[game-audio] could not set oversample", e)
    }
    limiter.connect(shaper)
    shaper.connect(mute)
  } else {
    console.warn(
      "[game-audio] no createWaveShaper on this AudioContext: the output ceiling is NOT enforced",
    )
    limiter.connect(mute)
  }

  mute.connect(options.output ?? ctx.destination)

  return {
    input,
    ceiling,
    setLevel(v: number): void {
      level.gain.value = clamp01(v)
    },
    setMuted(next: boolean): void {
      muted = next
      mute.gain.value = next ? 0 : 1
    },
    get muted(): boolean {
      return muted
    },
    disconnect(): void {
      for (const n of [input, level, limiter, shaper, mute]) {
        if (!n) continue
        try {
          n.disconnect()
        } catch (e) {
          console.warn("[game-audio] node already torn down", e)
        }
      }
    },
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.min(1, Math.max(0, v))
}
