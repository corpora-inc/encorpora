/**
 * Screen punch, hitstop and time dilation — the three techniques from Nijman's
 * "Art of Screenshake" that do the most work per line of code.
 *
 * Shake is trauma-based (Jorge Jimenez's model): callers add trauma, the
 * offset is `trauma^2`, and trauma decays linearly. Squaring is why a small
 * merge is a nudge and a big one is a wallop — a linear model makes every
 * event feel identical.
 *
 * Everything here has a hard ceiling. This is a children's product: the shake
 * cannot exceed `MAX_OFFSET`, the freeze cannot exceed `MAX_HITSTOP_MS`, and
 * `reduceMotion` collapses all of it to zero without losing any information,
 * because nothing here ever carries information on its own.
 */

const MAX_OFFSET = 26
const MAX_ROT = 0.022
const MAX_HITSTOP_MS = 110

export class Punch {
  private trauma = 0
  private t = 0
  private hitstopMs = 0
  private dilation = 1
  private dilationMs = 0
  reduceMotion = false

  ox = 0
  oy = 0
  rot = 0
  /** 1 = normal, <1 = slow motion. Multiply your dt by this. */
  timeScale = 1
  /** True on frames the world is frozen. */
  frozen = false

  add(amount: number): void {
    if (this.reduceMotion) return
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Freeze the world for `ms`. The single best-value juice trick there is. */
  freeze(ms: number): void {
    if (this.reduceMotion) return
    this.hitstopMs = Math.max(this.hitstopMs, Math.min(MAX_HITSTOP_MS, ms))
  }

  /** Slow time to `scale` for `ms`, then ease back. */
  slow(scale: number, ms: number): void {
    if (this.reduceMotion) return
    this.dilation = Math.min(this.dilation, Math.max(0.1, scale))
    this.dilationMs = Math.max(this.dilationMs, ms)
  }

  reset(): void {
    this.trauma = 0
    this.hitstopMs = 0
    this.dilationMs = 0
    this.dilation = 1
    this.ox = 0
    this.oy = 0
    this.rot = 0
    this.timeScale = 1
    this.frozen = false
  }

  /** `realDt` is wall-clock seconds. Call once per frame before world update. */
  update(realDt: number): void {
    if (this.reduceMotion) {
      this.ox = 0
      this.oy = 0
      this.rot = 0
      this.timeScale = 1
      this.frozen = false
      this.trauma = 0
      return
    }

    this.frozen = false
    if (this.hitstopMs > 0) {
      this.hitstopMs -= realDt * 1000
      this.frozen = true
    }

    if (this.dilationMs > 0) {
      this.dilationMs -= realDt * 1000
      if (this.dilationMs <= 0) this.dilation = 1
    }
    this.timeScale = this.frozen ? 0 : this.dilation

    this.t += realDt
    this.trauma = Math.max(0, this.trauma - realDt * 1.65)
    const s = this.trauma * this.trauma
    // Three decorrelated sines beat Math.random(): it stays smooth at 60fps and
    // does not turn into a buzzing single-pixel jitter on a high-refresh screen.
    this.ox = MAX_OFFSET * s * Math.sin(this.t * 47.3)
    this.oy = MAX_OFFSET * s * Math.sin(this.t * 39.1 + 1.7)
    this.rot = MAX_ROT * s * Math.sin(this.t * 31.7 + 0.4)
  }

  get level(): number {
    return this.trauma
  }
}

/** Easing curves used across the game, gathered so the feel stays consistent. */
export const ease = {
  outCubic: (t: number): number => 1 - (1 - t) ** 3,
  outQuint: (t: number): number => 1 - (1 - t) ** 5,
  inCubic: (t: number): number => t * t * t,
  /** Overshoots past 1 and settles — the merge "pop". */
  outBack: (t: number, s = 2.4): number => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2,
  /** Springy, several diminishing bounces. */
  outElastic: (t: number): number => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    return 2 ** (-9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  },
  smooth: (t: number): number => t * t * (3 - 2 * t),
}

/** Frame-rate independent exponential approach. `rate` in units of 1/second. */
export function approach(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt)
}
