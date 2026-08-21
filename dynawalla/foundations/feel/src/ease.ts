// Easing curves, by name.
//
// Robert Penner's set (the vocabulary every animator already has), plus the
// four that do the actual work in juice code and are worth naming separately:
//
//   outBack      pop-in with a landing overshoot. The single most useful curve
//                in the kit — every "thing appears" moment uses it.
//   outElastic   release after a squash. Reads as springy, not bouncy.
//   outExpo      "fast then settle". The correct curve for anything the child
//                must be able to read *immediately* — 80% of the travel is done
//                in the first 25% of the time.
//   inQuad       anticipation. The wind-up before a pop. Slow start is the
//                whole point; anything with a fast start cannot anticipate.
//
// Everything here is a pure `(t: number) => number` over the unit interval and
// allocates nothing. `bench/cpu.mjs` measures them; the slowest (outElastic,
// two transcendentals) costs ~4 ns on an M2 Max, so curve choice is a feel
// decision and never a performance one.
//
// Domain: callers must clamp. `ease.outBack(1.4)` is a defined number and a
// wrong picture; `tween.ts` clamps at the one place it matters.

export type EaseFn = (t: number) => number

const PI = Math.PI
const HALF_PI = Math.PI / 2

/** Penner's default overshoot. 1.70158 produces ~10% past the target. */
export const BACK_OVERSHOOT = 1.70158
const BACK_IO = BACK_OVERSHOOT * 1.525

export const linear: EaseFn = (t) => t

export const inQuad: EaseFn = (t) => t * t
export const outQuad: EaseFn = (t) => t * (2 - t)
export const inOutQuad: EaseFn = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t)

export const inCubic: EaseFn = (t) => t * t * t
export const outCubic: EaseFn = (t) => {
  const f = t - 1
  return f * f * f + 1
}
export const inOutCubic: EaseFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 + (t - 1) * (2 * t - 2) * (2 * t - 2)

export const inQuart: EaseFn = (t) => t * t * t * t
export const outQuart: EaseFn = (t) => 1 - (t - 1) ** 4
export const inOutQuart: EaseFn = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - 8 * (t - 1) ** 4)

export const inQuint: EaseFn = (t) => t ** 5
export const outQuint: EaseFn = (t) => 1 + (t - 1) ** 5
export const inOutQuint: EaseFn = (t) => (t < 0.5 ? 16 * t ** 5 : 1 + 16 * (t - 1) ** 5)

export const inSine: EaseFn = (t) => 1 - Math.cos(t * HALF_PI)
export const outSine: EaseFn = (t) => Math.sin(t * HALF_PI)
export const inOutSine: EaseFn = (t) => -(Math.cos(PI * t) - 1) / 2

export const inExpo: EaseFn = (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10))
export const outExpo: EaseFn = (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
export const inOutExpo: EaseFn = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2

export const inCirc: EaseFn = (t) => 1 - Math.sqrt(1 - t * t)
export const outCirc: EaseFn = (t) => Math.sqrt(1 - (t - 1) * (t - 1))
export const inOutCirc: EaseFn = (t) =>
  t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2

export const inBack: EaseFn = (t) => (BACK_OVERSHOOT + 1) * t * t * t - BACK_OVERSHOOT * t * t
export const outBack: EaseFn = (t) => {
  const f = t - 1
  return 1 + (BACK_OVERSHOOT + 1) * f * f * f + BACK_OVERSHOOT * f * f
}
export const inOutBack: EaseFn = (t) =>
  t < 0.5
    ? ((2 * t) ** 2 * ((BACK_IO + 1) * 2 * t - BACK_IO)) / 2
    : ((2 * t - 2) ** 2 * ((BACK_IO + 1) * (t * 2 - 2) + BACK_IO) + 2) / 2

const ELASTIC_C4 = (2 * PI) / 3
const ELASTIC_C5 = (2 * PI) / 4.5

export const inElastic: EaseFn = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ELASTIC_C4)
export const outElastic: EaseFn = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_C4) + 1
export const inOutElastic: EaseFn = (t) =>
  t <= 0
    ? 0
    : t >= 1
      ? 1
      : t < 0.5
        ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2
        : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * ELASTIC_C5)) / 2 + 1

export const outBounce: EaseFn = (t) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) {
    const u = t - 1.5 / d
    return n * u * u + 0.75
  }
  if (t < 2.5 / d) {
    const u = t - 2.25 / d
    return n * u * u + 0.9375
  }
  const u = t - 2.625 / d
  return n * u * u + 0.984375
}
export const inBounce: EaseFn = (t) => 1 - outBounce(1 - t)
export const inOutBounce: EaseFn = (t) =>
  t < 0.5 ? (1 - outBounce(1 - 2 * t)) / 2 : (1 + outBounce(2 * t - 1)) / 2

/** Hermite. Zero first derivative at both ends — the honest "smooth" curve. */
export const smoothstep: EaseFn = (t) => t * t * (3 - 2 * t)
/** Ken Perlin's improvement: zero *second* derivative too. No visible seam. */
export const smootherstep: EaseFn = (t) => t * t * t * (t * (t * 6 - 15) + 10)

/**
 * A hit's shape: instant to peak, decay back to zero. **Not** a 0→1 ease —
 * this returns to 0, which is what every impact response actually wants
 * (a flash, a punch, a squash) and what people wrongly build out of an
 * out-curve plus a second reversed tween.
 *
 * `sharpness` > 1 makes the decay snappier.
 */
export const spike = (sharpness = 2): EaseFn => {
  return (t) => {
    if (t <= 0 || t >= 1) return 0
    const rise = Math.min(1, t / 0.08)
    const fall = (1 - (t - 0.08) / 0.92) ** sharpness
    return t < 0.08 ? rise : Math.max(0, fall)
  }
}

/**
 * A CSS-compatible cubic Bézier, Newton-solved. Use it when a WebGL animation
 * has to land on the same frame as a CSS transition — matching by eye across
 * the two systems does not work, and a mismatched pair reads as two things
 * happening rather than one.
 *
 * Returns a closure, so build it once at module scope, never per frame.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const a = (u: number, v: number) => 1 - 3 * v + 3 * u
  const b = (u: number, v: number) => 3 * v - 6 * u
  const c = (u: number) => 3 * u
  const calc = (t: number, u: number, v: number) => ((a(u, v) * t + b(u, v)) * t + c(u)) * t
  const slope = (t: number, u: number, v: number) =>
    3 * a(u, v) * t * t + 2 * b(u, v) * t + c(u)

  return (t) => {
    if (x1 === y1 && x2 === y2) return t
    if (t <= 0) return 0
    if (t >= 1) return 1
    let guess = t
    for (let i = 0; i < 8; i++) {
      const s = slope(guess, x1, x2)
      if (s === 0) break
      guess -= (calc(guess, x1, x2) - t) / s
    }
    return calc(guess, y1, y2)
  }
}

/**
 * Closed-form under-damped spring, evaluated at a normalised time.
 *
 * Deliberately **not** a per-frame integrator. An integrator drifts with frame
 * rate, so the same "springy pop" is a different animation at 60 and at 120 Hz,
 * and it cannot be fast-forwarded to its end state — which `settleNow()`
 * requires of everything in the kit. This is exact at any dt and evaluable at
 * `t = 1` for the settled value.
 *
 * `bounces` is roughly how many overshoots are visible; `damping` 0…1.
 */
export function spring(bounces = 2, damping = 0.45): EaseFn {
  const omega = (bounces + 0.5) * PI
  const zeta = Math.max(0.0001, Math.min(0.999, damping))
  const omegaD = omega * Math.sqrt(1 - zeta * zeta)
  return (t) => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    const env = Math.exp(-zeta * omega * t)
    return 1 - env * (Math.cos(omegaD * t) + ((zeta * omega) / omegaD) * Math.sin(omegaD * t))
  }
}

/** Every curve, by the name an animator would say out loud. */
export const EASE = {
  linear,
  inQuad,
  outQuad,
  inOutQuad,
  inCubic,
  outCubic,
  inOutCubic,
  inQuart,
  outQuart,
  inOutQuart,
  inQuint,
  outQuint,
  inOutQuint,
  inSine,
  outSine,
  inOutSine,
  inExpo,
  outExpo,
  inOutExpo,
  inCirc,
  outCirc,
  inOutCirc,
  inBack,
  outBack,
  inOutBack,
  inElastic,
  outElastic,
  inOutElastic,
  inBounce,
  outBounce,
  inOutBounce,
  smoothstep,
  smootherstep,
} as const

export type EaseName = keyof typeof EASE

/** Pre-built curves the kit itself uses, so nothing allocates at call time. */
export const POP = outBack
export const SETTLE = outExpo
export const ANTICIPATE = inQuad
export const RELEASE = outElastic
export const SPRING_POP = spring(1, 0.42)
/** Material Design's standard decelerate, for anything that must feel like UI. */
export const UI_DECELERATE = cubicBezier(0, 0, 0.2, 1)
