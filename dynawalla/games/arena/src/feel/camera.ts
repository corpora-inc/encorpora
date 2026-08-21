/**
 * The camera, and everything that happens *to* the picture.
 *
 * Techniques from Vlambeer's "Art of Screenshake", applied by name:
 * trauma-based screenshake, hit-stop (sleep) on impact, camera lead, zoom
 * punch, knockback, screen-space impact ripple, chromatic aberration on
 * damage, and permanence (nothing is deleted, it is scattered).
 *
 * Everything here is amplitude-limited on purpose. This is a children's
 * product: full-screen luminance jumps are rate-capped to WCAG's three per
 * second, and `prefers-reduced-motion` collapses translation and zoom without
 * removing a single piece of information — the ripple, the flash and the shake
 * all have a non-motion counterpart in the HUD and in the audio.
 */

export class Camera {
  x = 0
  y = 0
  span = 400
  targetSpan = 400

  private trauma = 0
  private shakeT = 0
  shakeX = 0
  shakeY = 0

  /** 0..1, added to the composite as a white-out. */
  flash = 0
  flashR = 1
  flashG = 1
  flashB = 1
  private flashTimes: number[] = []

  aberration = 0
  desat = 0

  rippleX = 0
  rippleY = 0
  rippleT = 1
  rippleAmp = 0
  private rippleSpeed = 1

  /** Seconds of frozen simulation remaining. */
  hitstop = 0

  private punch = 0
  reduced = false

  lead = 0.16

  addTrauma(t: number): void {
    if (this.reduced) {
      // Reduced motion keeps the *signal* (a brief desaturation pulse) and
      // drops the translation.
      this.desat = Math.min(0.5, this.desat + t * 0.5)
      return
    }
    this.trauma = Math.min(1, this.trauma + t)
  }

  addFlash(amount: number, r = 1, g = 1, b = 1): void {
    const now = performance.now()
    while (this.flashTimes.length && now - (this.flashTimes[0] as number) > 1000) this.flashTimes.shift()
    const recent = this.flashTimes.length
    // Hard cap, then a much harder cap once three have already happened inside
    // a second. A child's screen never strobes.
    let amp = Math.min(amount, this.reduced ? 0.1 : 0.34)
    if (recent >= 3) amp = Math.min(amp, 0.05)
    if (recent >= 6) amp = 0
    if (amp > 0.02) this.flashTimes.push(now)
    this.flash = Math.max(this.flash, amp)
    this.flashR = r
    this.flashG = g
    this.flashB = b
  }

  addRipple(x: number, y: number, amp: number, speed = 1): void {
    if (this.reduced) return
    this.rippleX = x
    this.rippleY = y
    this.rippleT = 0
    this.rippleAmp = Math.min(1, amp)
    this.rippleSpeed = speed
  }

  addPunch(p: number): void {
    if (this.reduced) return
    this.punch = Math.min(0.5, this.punch + p)
  }

  addHitstop(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, Math.min(0.14, seconds))
  }

  addAberration(a: number): void {
    if (this.reduced) return
    this.aberration = Math.min(0.012, this.aberration + a)
  }

  /** `dt` here is real time, never the frozen simulation time. */
  update(dt: number, px: number, py: number, pvx: number, pvy: number, wantSpan: number): void {
    this.targetSpan = wantSpan

    const followK = 1 - Math.exp(-dt * (this.reduced ? 14 : 6.5))
    const lx = px + pvx * this.lead
    const ly = py + pvy * this.lead
    this.x += (lx - this.x) * followK
    this.y += (ly - this.y) * followK

    // Zoom eases slower than the follow, which is what makes growing feel like
    // the world receding rather than the sprite shrinking.
    const zoomK = 1 - Math.exp(-dt * 2.6)
    const punched = this.targetSpan * (1 - this.punch)
    this.span += (punched - this.span) * zoomK
    this.punch *= Math.exp(-dt * 7)

    this.trauma = Math.max(0, this.trauma - dt * 1.9)
    const s = this.trauma * this.trauma
    this.shakeT += dt * 34
    if (s > 0.0001) {
      const amp = s * this.span * 0.055
      this.shakeX = (noise1(this.shakeT) - 0.5) * 2 * amp
      this.shakeY = (noise1(this.shakeT + 91.7) - 0.5) * 2 * amp
    } else {
      this.shakeX = 0
      this.shakeY = 0
    }

    this.flash = Math.max(0, this.flash - dt * 3.4)
    this.aberration *= Math.exp(-dt * 9)
    if (this.aberration < 1e-5) this.aberration = 0
    this.desat = Math.max(0, this.desat - dt * 1.6)
    if (this.rippleT < 1) {
      this.rippleT = Math.min(1, this.rippleT + dt * 1.5 * this.rippleSpeed)
      this.rippleAmp *= Math.exp(-dt * 1.1)
    } else {
      this.rippleAmp = 0
    }
    this.hitstop = Math.max(0, this.hitstop - dt)
  }

  get viewX(): number {
    return this.x + this.shakeX
  }

  get viewY(): number {
    return this.y + this.shakeY
  }
}

/** Cheap smooth 1-D value noise, so shake reads as a physical wobble. */
function noise1(t: number): number {
  const i = Math.floor(t)
  const f = t - i
  const u = f * f * (3 - 2 * f)
  const a = hash1(i)
  const b = hash1(i + 1)
  return a + (b - a) * u
}

function hash1(n: number): number {
  let x = Math.sin(n * 127.1) * 43758.5453
  x = x - Math.floor(x)
  return x
}
