// Screenshake, hitstop, time dilation, camera punch and a hard flash budget.
//
// Trauma model rather than a decaying offset: `addTrauma` accumulates, shake is
// trauma² so small knocks stay quiet and big ones are violent, and it decays
// linearly. Jan Willem Nijman's rules, applied by name.
//
// The flash budget is not a style choice. This is a children's product and
// photosensitive epilepsy is triggered by flash RATE — so flashes are capped at
// 2.8 per second, capped in amplitude, and removed entirely under reduced
// motion.

export type Easing = (t: number) => number

export const ease = {
  outCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  outQuint: (t: number): number => 1 - Math.pow(1 - t, 5),
  outExpo: (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inQuart: (t: number): number => t * t * t * t,
  outBack: (t: number): number => {
    const c1 = 1.9
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  outElastic: (t: number): number => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const p = 0.36
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1
  },
  inOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}

const MIN_FLASH_GAP = 0.36 // seconds → at most 2.8 flashes/second, ever

export class Juice {
  trauma = 0
  /** Remaining hitstop, in unscaled seconds. */
  private stop = 0
  /** Multiplier applied to dt. Slow-mo lives here. */
  timeScale = 1
  private targetScale = 1
  private scaleLerp = 6
  shakeX = 0
  shakeY = 0
  rot = 0
  zoom = 1
  private zoomImpulse = 0
  flash = 0
  private flashColour = "#ffffff"
  private lastFlash = -10
  private clock = 0
  reduced = false
  private seed = 987654321

  private rand(): number {
    this.seed ^= this.seed << 13
    this.seed >>>= 0
    this.seed ^= this.seed >>> 17
    this.seed ^= this.seed << 5
    this.seed >>>= 0
    return this.seed / 4294967296
  }

  addTrauma(amount: number): void {
    if (this.reduced) return
    this.trauma = Math.min(1, this.trauma + amount)
  }

  /** Freeze the world for `ms`. Kept under reduced motion — it is not motion. */
  hitstop(ms: number): void {
    this.stop = Math.max(this.stop, ms / 1000)
  }

  /** Ramp time to `scale`, then back to 1 over `holdSec`. */
  slowmo(scale: number, holdSec: number): void {
    if (this.reduced) return
    this.timeScale = scale
    this.targetScale = scale
    this.slowUntil = this.clock + holdSec
  }
  private slowUntil = 0

  punch(zoom: number, rot: number): void {
    if (this.reduced) return
    this.zoomImpulse = Math.max(this.zoomImpulse, zoom)
    this.rot += rot
  }

  /** Returns false when the flash was refused by the rate cap. */
  doFlash(strength: number, colour = "#ffffff"): boolean {
    if (this.reduced) return false
    if (this.clock - this.lastFlash < MIN_FLASH_GAP) return false
    this.lastFlash = this.clock
    this.flash = Math.min(0.22, strength)
    this.flashColour = colour
    return true
  }

  get flashStyle(): string {
    return this.flashColour
  }

  /**
   * Advance. Returns the dt the simulation should actually use — zero while
   * hitstop is holding, scaled while slow-mo is on.
   */
  step(realDt: number): number {
    this.clock += realDt
    if (this.stop > 0) {
      this.stop -= realDt
      // The presentation layer keeps moving so the freeze reads as impact
      // rather than as a dropped frame.
      this.decay(realDt)
      return 0
    }
    if (this.clock > this.slowUntil) this.targetScale = 1
    this.timeScale += (this.targetScale - this.timeScale) * Math.min(1, this.scaleLerp * realDt)
    this.decay(realDt)
    return realDt * this.timeScale
  }

  private decay(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.65)
    const s = this.trauma * this.trauma
    const amp = s * 17
    this.shakeX = (this.rand() * 2 - 1) * amp
    this.shakeY = (this.rand() * 2 - 1) * amp
    this.rot += -this.rot * Math.min(1, dt * 11)
    this.rot += (this.rand() * 2 - 1) * s * 0.012
    this.zoomImpulse *= Math.max(0, 1 - dt * 7)
    this.zoom = 1 + this.zoomImpulse
    this.flash = Math.max(0, this.flash - dt * 2.6)
  }

  reset(): void {
    this.trauma = 0
    this.stop = 0
    this.timeScale = 1
    this.targetScale = 1
    this.zoomImpulse = 0
    this.flash = 0
    this.rot = 0
  }
}
