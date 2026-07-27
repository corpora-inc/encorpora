/**
 * Screenshake, hitstop, kick, punch-zoom, flash — Nijman's list, with the two
 * rules a children's product adds on top:
 *
 *  - **The flash limiter is hard.** Additive full-screen flashes are capped in
 *    amplitude and rate. A game cannot ask for a brighter or more frequent
 *    flash than the limiter allows, so no future edit can introduce one.
 *  - **Reduced motion removes movement, never information.** Shake becomes a
 *    still frame; hitstop stays (it is timing, not motion); the flash becomes
 *    a dim tint. Everything a player must *know* is still on screen.
 */

export class Feel {
  trauma = 0
  kickX = 0
  kickY = 0
  zoom = 1
  private zoomVel = 0
  hitstopMs = 0
  private t = 0

  flashR = 0
  flashG = 0
  flashB = 0
  flashA = 0
  private flashDecay = 6
  private lastBigFlash = -1e9
  private flashCount = 0
  private flashWindowStart = 0

  reduced = false

  /** Absolute ceilings. Nothing may exceed these, ever. */
  static readonly MAX_FLASH = 0.34
  static readonly MAX_FLASH_REDUCED = 0.09
  /** Full-screen flashes above `BIG` are limited to this many per second. */
  static readonly BIG = 0.12
  static readonly BIG_PER_SEC = 3

  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount)
  }

  kick(dx: number, dy: number, amount: number): void {
    const d = Math.hypot(dx, dy) || 1
    this.kickX += (dx / d) * amount
    this.kickY += (dy / d) * amount
  }

  punch(amount: number): void {
    this.zoomVel += amount
  }

  stop(ms: number): void {
    // Hitstop is only ever spent on success. Never on being hurt: the retry
    // must be the fastest thing in the game.
    this.hitstopMs = Math.max(this.hitstopMs, this.reduced ? Math.min(ms, 40) : ms)
  }

  flash(r: number, g: number, b: number, a: number, decay = 6): void {
    const cap = this.reduced ? Feel.MAX_FLASH_REDUCED : Feel.MAX_FLASH
    let amt = Math.min(a, cap)
    const now = this.t
    if (amt > Feel.BIG) {
      if (now - this.flashWindowStart > 1) {
        this.flashWindowStart = now
        this.flashCount = 0
      }
      if (this.flashCount >= Feel.BIG_PER_SEC || now - this.lastBigFlash < 0.16) {
        amt = Feel.BIG // demote, never drop: the signal survives, the strobe does not
      } else {
        this.flashCount++
        this.lastBigFlash = now
      }
    }
    if (amt <= this.flashA) return
    this.flashR = r
    this.flashG = g
    this.flashB = b
    this.flashA = amt
    this.flashDecay = decay
  }

  update(dt: number): void {
    this.t += dt
    const k = 1 - Math.pow(0.0001, dt)
    this.trauma = Math.max(0, this.trauma - dt * 1.75)
    this.kickX -= this.kickX * k
    this.kickY -= this.kickY * k
    if (Math.abs(this.kickX) < 0.02) this.kickX = 0
    if (Math.abs(this.kickY) < 0.02) this.kickY = 0

    // Punch-zoom as a spring so it overshoots once and settles.
    const stiff = 150
    const damp = 17
    this.zoomVel += (1 - this.zoom) * stiff * dt - this.zoomVel * damp * dt
    this.zoom += this.zoomVel * dt
    this.zoom = Math.max(0.88, Math.min(1.14, this.zoom))

    this.flashA = Math.max(0, this.flashA - dt * this.flashDecay * Math.max(0.4, this.flashA + 0.3))
  }

  /** Screen-space offset in world units, given the current view width. */
  shakeOffset(out: Float32Array, worldPerPixel: number, seed: number): void {
    if (this.reduced) {
      out[0] = 0
      out[1] = 0
      return
    }
    const s = this.trauma * this.trauma
    const a = seed * 12.9898
    // Two decorrelated sines rather than random(): shake that jitters per
    // frame reads as noise, shake that oscillates reads as impact.
    out[0] = Math.sin(a * 3.1 + this.t * 61) * s * 26 * worldPerPixel
    out[1] = Math.cos(a * 2.3 + this.t * 53) * s * 26 * worldPerPixel
  }

  reset(): void {
    this.trauma = 0
    this.kickX = 0
    this.kickY = 0
    this.zoom = 1
    this.zoomVel = 0
    this.hitstopMs = 0
    this.flashA = 0
  }
}
