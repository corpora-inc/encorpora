// The response layer — trauma shake, directional kick, punch zoom, hitstop,
// slow-motion and a rate-limited screen flash.
//
// Two house rules, and in a wrestling game both of them bite:
//
//   * **Hitstop is only ever spent on success.** A freeze frame is a reward.
//     The kick-out gets one. The pinfall gets none — it gets *stillness*, which
//     is a different thing: the world keeps running, quietly, while nothing
//     happens. `feel.test.ts` asserts a pinfall never requests one.
//   * **Nothing blocks input.** Every effect here draws over the next moment
//     and none of them gate the pointer. A child who is already reaching for
//     the plates while the crowd is still going is never made to wait.

export type FeelOptions = {
  reducedMotion: boolean
}

/** Hard ceiling for a children's product: no more than this many flashes/sec. */
const MAX_FLASHES_PER_SEC = 3
const MIN_FLASH_GAP_MS = 1000 / MAX_FLASHES_PER_SEC
/** And no single flash may ever exceed this alpha, at any tier, ever. */
const MAX_FLASH_ALPHA = 0.42

export class Feel {
  trauma = 0 // 0..1; shake is trauma²
  kickX = 0
  kickY = 0
  zoom = 0 // additive; 0.1 == 10% punch in
  private flash = 0
  private flashColor = "#ffffff"
  private lastFlashAt = -1e9
  private hitstopMs = 0
  private slowUntil = 0
  private slowFrom = 1
  private slowMs = 1
  private nowMs = 0

  reducedMotion: boolean

  // Resolved each frame; read by the renderer.
  shakeX = 0
  shakeY = 0
  scale = 1
  flashAlpha = 0

  private seed = 0x2545f491

  constructor(o: FeelOptions) {
    this.reducedMotion = o.reducedMotion
  }

  private rand(): number {
    // xorshift32, so shake never allocates and never calls Math.random.
    let x = this.seed
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.seed = x >>> 0
    return (this.seed / 4294967296) * 2 - 1
  }

  addTrauma(v: number): void {
    if (this.reducedMotion) return
    this.trauma = Math.min(1, this.trauma + v)
  }

  /** A kick along a direction — up out of the canvas, or down under the pin. */
  kick(dx: number, dy: number, mag: number): void {
    if (this.reducedMotion) return
    const l = Math.hypot(dx, dy) || 1
    this.kickX += (dx / l) * mag
    this.kickY += (dy / l) * mag
  }

  punch(v: number): void {
    if (this.reducedMotion) return
    this.zoom += v
  }

  /** Freeze frames. Success only. */
  hitstop(ms: number): void {
    if (this.reducedMotion) return
    this.hitstopMs = Math.max(this.hitstopMs, ms)
  }

  /** Slow-motion: drop to `from`, recover to 1 over `ms`. */
  slowmo(from: number, ms: number): void {
    if (this.reducedMotion) return
    if (from >= this.timeScale()) return
    this.slowFrom = from
    this.slowMs = ms
    this.slowUntil = this.nowMs + ms
  }

  /**
   * Screen flash, rate-limited. A request that arrives too soon after the last
   * one is *not* queued — it is dropped and the pending flash is topped up
   * instead. Queuing would let three fast slaps emit a strobe.
   */
  requestFlash(alpha: number, color: string): void {
    if (this.reducedMotion) return
    const a = Math.min(MAX_FLASH_ALPHA, alpha)
    if (this.nowMs - this.lastFlashAt < MIN_FLASH_GAP_MS) {
      this.flash = Math.max(this.flash, a * 0.5)
      return
    }
    this.lastFlashAt = this.nowMs
    this.flash = Math.max(this.flash, a)
    this.flashColor = color
  }

  timeScale(): number {
    if (this.nowMs >= this.slowUntil) return 1
    const t = 1 - (this.slowUntil - this.nowMs) / this.slowMs // 0 → 1
    // easeOutCubic back to real time: the recovery should feel like release.
    const e = 1 - Math.pow(1 - t, 3)
    return this.slowFrom + (1 - this.slowFrom) * e
  }

  /**
   * @param dtMs real elapsed time
   * @param nowMs the frame clock
   * @returns the number of ms the *simulation* should advance — zero while a
   *          hitstop is being served.
   */
  advance(dtMs: number, nowMs: number): number {
    this.nowMs = nowMs
    if (this.hitstopMs > 0) {
      this.hitstopMs -= dtMs
      // Decay the visual response even during a freeze, so a long hitstop does
      // not resume into a stale shake.
      this.decay(dtMs)
      return 0
    }
    this.decay(dtMs)
    return dtMs * this.timeScale()
  }

  private decay(dtMs: number): void {
    const dt = dtMs / 1000
    this.trauma = Math.max(0, this.trauma - dt * 1.55)
    const k = Math.exp(-dt * 11)
    this.kickX *= k
    this.kickY *= k
    this.zoom *= Math.exp(-dt * 8.5)
    this.flash = Math.max(0, this.flash - dt * 2.6)

    const t2 = this.trauma * this.trauma
    const amp = t2 * 24
    this.shakeX = this.rand() * amp + this.kickX
    this.shakeY = this.rand() * amp + this.kickY
    this.scale = 1 + this.zoom + t2 * 0.012
    this.flashAlpha = this.flash
  }

  get currentFlashColor(): string {
    return this.flashColor
  }

  reset(): void {
    this.trauma = 0
    this.kickX = 0
    this.kickY = 0
    this.zoom = 0
    this.flash = 0
    this.hitstopMs = 0
    this.slowUntil = 0
  }
}
