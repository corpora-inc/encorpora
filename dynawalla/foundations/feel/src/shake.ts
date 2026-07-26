// Trauma-based screen shake, after Squirrel Eiserloh's GDC talk "Math for Game
// Programmers: Juicing Your Cameras With Math".
//
// Three rules, and all three are the difference between shake and vibration:
//
//   1. **Store trauma, not shake.** Callers add trauma in 0…1; the visible
//      amplitude is `trauma^exponent`. The square is what makes a small hit
//      barely register and a big one feel violent — a linear mapping makes
//      every impact feel the same weight, which is the commonest mistake.
//   2. **Sample noise, not random.** `Math.random()` per frame produces a
//      buzz — successive frames are uncorrelated, so the camera teleports and
//      the eye reads it as a rendering fault. Coherent noise produces a smooth
//      excursion the eye reads as *motion*. This is the single most important
//      line in the file.
//   3. **Decay trauma linearly, per second.** Exponential decay never ends and
//      leaves a permanent low-level jitter that people describe as "the screen
//      feels loose".
//
// ## Direction is a kick, not a biased shake
//
// The obvious way to make an impact feel directional is to scale the noise
// per axis toward the impact vector. It does not work: noise is symmetric
// about zero, so a "biased" shake still spends half its time moving *into* the
// impact. What reads as directional is a **recoil** — a one-way displacement
// that springs back — which is why `Kick` is a spring and lives beside the
// shake rather than inside it. Celeste does exactly this split
// (`level.DirectionalShake(dir, .1f)` alongside its undirected `level.Shake()`).
//
// ## Shake runs on real time
//
// Deliberate. During a freeze frame the world stops and the camera keeps
// shaking — that contrast is what sells the freeze. A shake that froze with the
// world would make hitstop read as a hang.

import { Spring1D } from "./spring.ts"

/* ------------------------------------------------------------------ noise */

/** Integer hash → [-1, 1]. Deterministic, allocation-free, ~1 ns. */
function hash1(i: number, seed: number): number {
  let h = (i | 0) ^ Math.imul(seed | 0, 0x9e3779b9)
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  h ^= h >>> 16
  // >>> 0 then map to [-1,1]. Avoids the sign-bit discontinuity of |0.
  return (h >>> 0) / 2147483647.5 - 1
}

/**
 * 1-D value noise with a smootherstep fade. Continuous in value and in first
 * *and* second derivative, which is why it reads as a physical wobble rather
 * than a stack of ramps.
 */
export function noise1(x: number, seed: number): number {
  const i = Math.floor(x)
  const f = x - i
  const a = hash1(i, seed)
  const b = hash1(i + 1, seed)
  const u = f * f * f * (f * (f * 6 - 15) + 10)
  return a + (b - a) * u
}

/* ------------------------------------------------------------------ shake */

export interface ShakeOptions {
  /** Trauma lost per second. 1.4 ≈ a 0.7-trauma hit is gone in half a second. */
  decayPerSec?: number
  /** `amplitude = trauma ** exponent`. 2 is Eiserloh's; 3 is punchier. */
  exponent?: number
  /**
   * Excursions per second. 22–30 Hz is the band that reads as impact.
   * Below ~12 Hz it reads as a wobble; above ~40 Hz the sample rate at 60 fps
   * aliases and you are back to buzz.
   */
  frequencyHz?: number
  /** Max positional excursion at trauma = 1, in the caller's units. */
  maxOffset?: number
  /** Max roll at trauma = 1, in radians. ~0.05 rad (2.9°) is plenty. */
  maxRoll?: number
}

export class Shake {
  trauma = 0
  private t = 0
  private readonly decayPerSec: number
  private readonly exponent: number
  private readonly frequencyHz: number
  private readonly maxOffset: number
  private readonly maxRoll: number

  /** Output, rewritten in place each frame. Read after `update`. */
  x = 0
  y = 0
  roll = 0

  /** Scales all output. The quality governor turns this down, never off. */
  intensity = 1

  constructor(opts: ShakeOptions = {}) {
    this.decayPerSec = opts.decayPerSec ?? 1.4
    this.exponent = opts.exponent ?? 2
    this.frequencyHz = opts.frequencyHz ?? 26
    this.maxOffset = opts.maxOffset ?? 1
    this.maxRoll = opts.maxRoll ?? 0.045
  }

  /** Add trauma. Saturates at 1 — you cannot bank shake for later. */
  add(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Bleed off fast without a pop. `settleNow()` uses this, not `trauma = 0`. */
  settle(): void {
    this.trauma = Math.min(this.trauma, 0.08)
  }

  clear(): void {
    this.trauma = 0
    this.x = 0
    this.y = 0
    this.roll = 0
  }

  /** @param dtRealMs wall-clock ms. Never world time — see the header. */
  update(dtRealMs: number): void {
    if (this.trauma <= 0) {
      this.x = 0
      this.y = 0
      this.roll = 0
      return
    }
    const dtSec = dtRealMs * 0.001
    this.t += dtSec * this.frequencyHz
    this.trauma = Math.max(0, this.trauma - this.decayPerSec * dtSec)

    const amp = this.trauma ** this.exponent * this.intensity
    // Three *different seeds*, one shared time. Sharing the seed and offsetting
    // time makes x and y the same wave delayed, which reads as a diagonal slide.
    this.x = noise1(this.t, 1013) * amp * this.maxOffset
    this.y = noise1(this.t, 7919) * amp * this.maxOffset
    this.roll = noise1(this.t, 3571) * amp * this.maxRoll
  }
}

/* ------------------------------------------------------------------- kick */

/**
 * Directional recoil. An impulse along a direction that springs back.
 *
 * Frequency is deliberately high (18 Hz) and damping just under critical, so
 * the return has exactly one small overshoot — the "thunk" that makes a hit
 * feel like it landed on something solid rather than passed through it.
 */
export class Kick {
  private readonly sx = new Spring1D(18, 0.62)
  private readonly sy = new Spring1D(18, 0.62)
  private readonly sz = new Spring1D(18, 0.62)

  x = 0
  y = 0
  z = 0
  intensity = 1

  /**
   * Arguments are **peak displacement in the caller's units**, not raw impulse.
   *
   * `add(0, -0.28, 0)` moves the camera 0.28 world units down at the peak of
   * the recoil and springs back. This is the API the tier table can be tuned
   * against; raw impulse is not, because the conversion factor is ~0.004 and
   * nobody notices that their numbers are 250× too small.
   */
  add(dx: number, dy: number, dz = 0): void {
    const k = this.sx.impulseForPeak(1) * this.intensity
    this.sx.impulse(dx * k)
    this.sy.impulse(dy * k)
    this.sz.impulse(dz * k)
  }

  update(dtRealMs: number): void {
    this.x = this.sx.update(dtRealMs)
    this.y = this.sy.update(dtRealMs)
    this.z = this.sz.update(dtRealMs)
  }

  settle(): void {
    this.sx.settle()
    this.sy.settle()
    this.sz.settle()
    this.x = 0
    this.y = 0
    this.z = 0
  }

  isAtRest(): boolean {
    return this.sx.isAtRest() && this.sy.isAtRest() && this.sz.isAtRest()
  }
}
