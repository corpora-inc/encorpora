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
 *            It answers to two independent owners: the app's Sound setting
 *            (`sound.ts`) and the game's own mute button. Either one closes it;
 *            only both open it, which is what makes the app setting
 *            authoritative without any game having to know it exists.
 *
 * The node vocabulary is deliberately tiny — createGain, createWaveShaper,
 * createDynamicsCompressor, connect, and `.value` on a param. That is exactly
 * what the games' own fake contexts already implement. The shared chrome module
 * broke four games by reaching for DOM APIs their doubles did not have; this
 * one does not reach.
 */

import { CEILING, KNEE, shaperCurve } from "./ceiling.ts"
import { hostSoundAllowed, onHostSound } from "./sound.ts"

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
  /**
   * The GAME's mute button. True silence, after the ceiling.
   *
   * It cannot open a gate the app has closed. A game calling `setMuted(false)`
   * while the app's Sound setting is off records the game's own preference and
   * changes nothing audible — the bus stays shut until the parent turns Sound
   * back on, at which point the game's preference is the one that applies.
   */
  setMuted(muted: boolean): void
  /**
   * Whether this bus is silent — the honest reading, not the game's opinion.
   *
   * True when the app has turned Sound off OR the game muted itself. A game
   * that toggles with `setMuted(!bus.muted)` therefore still cannot make noise
   * against the app setting; the worst it can do is record `false` for later.
   */
  readonly muted: boolean
  /** What the game last asked for, ignoring the app setting. */
  readonly gameMuted: boolean
  /** Whether the app is allowing sound, ignoring what the game asked for. */
  readonly hostAllows: boolean
  disconnect(): void
}

/**
 * How long the gate takes to open or close, in seconds.
 *
 * Not zero. A gain stepped from 1 to 0 in one sample is a discontinuity, and a
 * discontinuity is a click — a broadband transient, which is precisely the kind
 * of sound this module exists to stop a child hearing. 12 ms is far below the
 * ~100 ms at which a delay becomes perceptible as lag, and far above the point
 * at which the step stops clicking.
 *
 * Only used where the context's `AudioParam` implements scheduling. The games'
 * own fake contexts mostly implement `.value` and nothing else, and the shared
 * chrome module has already broken four games by assuming otherwise, so the
 * fallback below is a plain assignment and is equally complete — just abrupt.
 */
const GATE_FADE = 0.012

/** A scheduling `AudioParam`, if this context happens to have one. */
type Schedulable = {
  value: number
  cancelScheduledValues?: (when: number) => unknown
  setValueAtTime?: (value: number, when: number) => unknown
  linearRampToValueAtTime?: (value: number, when: number) => unknown
}

/** Move a gain to `target`, smoothly where the context can and bluntly where it cannot. */
function slew(param: Schedulable, target: number, now: number): void {
  if (
    typeof param.cancelScheduledValues === "function" &&
    typeof param.setValueAtTime === "function" &&
    typeof param.linearRampToValueAtTime === "function" &&
    Number.isFinite(now)
  ) {
    try {
      // A linear ramp interpolates from the previous event, so there has to be
      // one: cancel whatever is pending, pin the value we are actually at, then
      // ramp. Without the pin, a second toggle inside the fade jumps.
      param.cancelScheduledValues(now)
      param.setValueAtTime(param.value, now)
      param.linearRampToValueAtTime(target, now + GATE_FADE)
      return
    } catch (error) {
      console.warn("[game-audio] could not schedule the mute gate; stepping instead", error)
    }
  }
  param.value = target
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

  // Two owners, one gate. `gameMuted` is the game's own button; `hostAllows`
  // is the app's Sound setting, which this bus follows for as long as it lives.
  const mute = ctx.createGain()
  let gameMuted = options.muted === true
  let hostAllows = hostSoundAllowed()
  const open = (): boolean => hostAllows && !gameMuted
  // Assigned rather than slewed: at construction there is nothing playing to
  // click, and a ramp would leave the first 12 ms of a game that mounts muted
  // audible.
  mute.gain.value = open() ? 1 : 0
  const gate = (): void => {
    slew(mute.gain as unknown as Schedulable, open() ? 1 : 0, ctx.currentTime)
  }
  const unfollow = onHostSound((on) => {
    hostAllows = on
    gate()
  })

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
      gameMuted = next
      gate()
    },
    get muted(): boolean {
      return !open()
    },
    get gameMuted(): boolean {
      return gameMuted
    },
    get hostAllows(): boolean {
      return hostAllows
    },
    disconnect(): void {
      unfollow()
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
