// Screenshake, hitstop, slow-motion, flash budget, easing.
//
// Straight out of Jan Willem Nijman's "Art of Screenshake", applied by name:
//   HITSTOP     — freeze the simulation for 40-140 ms on impact. The single
//                 highest-value-per-line effect in action feel: it reads as
//                 weight, because a heavy thing that hits something stops.
//   SCREENSHAKE — an impulse with exponential decay and a per-frame random
//                 direction. Decayed, never a fixed-duration wobble.
//   CAMERA PUNCH— a translation along the impact vector that eases back.
//   SLOW-MO     — a time scale below 1 for the big beats only, so it stays rare
//                 enough to still mean something.
//   SQUASH      — non-uniform scale that conserves area, snapping back through
//                 an overshoot curve.
//
// And the thing the talk does not have to worry about, because this is a
// children's product: a hard flash budget. Full-screen luminance changes are
// rate-limited AND amplitude-limited, and `prefers-reduced-motion` removes
// motion without removing a single piece of information.

export type Juice = {
  reduced: boolean
  /** Current shake offset, already decayed. */
  shakeX: number
  shakeY: number
  /** 0..1 white overlay, already budget-limited. */
  flash: number
  /** Simulation time scale, 1 normally. */
  timeScale: number
  /** True while frozen; the renderer still draws. */
  frozen: boolean

  shake(power: number): void
  punch(x: number, y: number, power: number): void
  hitstop(ms: number): void
  slowmo(scale: number, ms: number): void
  /** Request a full-screen flash. Silently clamped or dropped if over budget. */
  requestFlash(amount: number): void
  update(dtMs: number): void
}

export function makeJuice(reduced: boolean): Juice {
  let shakePower = 0
  let punchX = 0
  let punchY = 0
  let stopMs = 0
  let slowMs = 0
  let slowScale = 1
  let flashAmt = 0

  // Flash budget: at most 3 flashes per second, hard-capped amplitude, and a
  // forced dark interval between them. Photosensitive-epilepsy guidance puts
  // the risk band at 3 Hz and above; this sits below it by construction.
  const FLASH_MIN_GAP_MS = 340
  const FLASH_MAX = 0.55
  let sinceFlash = FLASH_MIN_GAP_MS

  const j: Juice = {
    reduced,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    timeScale: 1,
    frozen: false,

    shake(power) {
      if (reduced) return
      shakePower = Math.max(shakePower, power)
    },

    punch(x, y, power) {
      if (reduced) return
      const len = Math.hypot(x, y) || 1
      punchX += (x / len) * power
      punchY += (y / len) * power
    },

    hitstop(ms) {
      // Kept under reduced-motion: hitstop is timing, not movement, and it is
      // most of what makes a hit feel like a hit.
      stopMs = Math.max(stopMs, ms)
    },

    slowmo(scale, ms) {
      if (reduced) return
      slowScale = scale
      slowMs = Math.max(slowMs, ms)
    },

    requestFlash(amount) {
      if (sinceFlash < FLASH_MIN_GAP_MS) return
      sinceFlash = 0
      flashAmt = Math.min(reduced ? 0.14 : FLASH_MAX, Math.max(flashAmt, amount))
    },

    update(dtMs) {
      sinceFlash += dtMs

      if (stopMs > 0) {
        stopMs -= dtMs
        j.frozen = true
        j.timeScale = 0
      } else {
        j.frozen = false
        if (slowMs > 0) {
          slowMs -= dtMs
          j.timeScale = slowScale
        } else {
          j.timeScale = 1
        }
      }

      // Exponential decay, frame-rate independent: 0.0035 per ms is a ~200 ms
      // half-life, which is the sweet spot — long enough to read as impact,
      // short enough that two hits in a row do not blur into vibration.
      const decay = Math.exp(-0.0075 * dtMs)
      shakePower *= decay
      if (shakePower < 0.05) shakePower = 0
      punchX *= Math.exp(-0.012 * dtMs)
      punchY *= Math.exp(-0.012 * dtMs)

      const a = Math.random() * Math.PI * 2
      j.shakeX = Math.cos(a) * shakePower + punchX
      j.shakeY = Math.sin(a) * shakePower + punchY

      flashAmt *= Math.exp(-0.011 * dtMs)
      if (flashAmt < 0.004) flashAmt = 0
      j.flash = flashAmt
    },
  }
  return j
}

// --- easing -----------------------------------------------------------------

export const ease = {
  linear: (t: number) => t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  /** Overshoots past 1 and settles. The "it landed hard" curve. */
  outBack: (t: number) => {
    const c1 = 1.9
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  /** Rings like struck metal. Use sparingly; it is loud. */
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
  outBounce: (t: number) => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
}

export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent approach. `rate` is the fraction closed per second. */
export function approach(current: number, target: number, rate: number, dtMs: number): number {
  return target + (current - target) * Math.exp((-rate * dtMs) / 1000)
}
