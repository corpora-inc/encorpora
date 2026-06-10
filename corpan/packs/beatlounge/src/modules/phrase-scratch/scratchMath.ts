/**
 * beatlounge — phrase-SCRATCH pure math.
 *
 * These helpers turn FINGER MOTION into a turntable playbackRate and a platter
 * ROTATION, with no audio / DOM dependency so the feel is unit-testable. The
 * model is velocity-based "turntablism": the rate the buffer plays at is
 * proportional to how fast the finger is sweeping the platter (sign = direction:
 * negative drags the record backwards), and when the finger LIFTS the rate eases
 * back toward a baseline spin (or 0 = a held record) instead of snapping — that
 * smooth glide is part of why there are no clicks (the GrainPlayer never stops;
 * only its rate moves continuously through zero).
 *
 * Angle math: a drag's angular delta around the platter centre is what spins the
 * record. We map that angular velocity (radians/second) to playbackRate via a
 * gain so a natural wrist flick reaches a satisfying scratch speed, then clamp
 * to a sane range the GrainPlayer can track click-free.
 */

/** Max absolute playbackRate. Beyond this grains can't keep up cleanly. */
export const MAX_RATE = 4

/** Below this |rate| we treat the record as effectively held (silence-ish). */
export const HOLD_EPSILON = 0.02

/** Clamp a playbackRate into the click-safe turntable range. */
export const clampRate = (rate: number): number => {
  if (!Number.isFinite(rate)) return 0
  if (rate > MAX_RATE) return MAX_RATE
  if (rate < -MAX_RATE) return -MAX_RATE
  return rate
}

/**
 * The signed angle (radians) of a point relative to the platter centre.
 * atan2 gives −π..π; callers diff successive angles to get a sweep.
 */
export const pointerAngle = (
  cx: number,
  cy: number,
  px: number,
  py: number
): number => Math.atan2(py - cy, px - cx)

/**
 * Shortest signed difference between two angles, in −π..π. Without this a sweep
 * across the −π/π seam (e.g. 170°→−170°) would read as a huge backwards jump and
 * spike the rate; wrapping keeps the scratch continuous all the way around.
 */
export const angleDelta = (from: number, to: number): number => {
  let d = to - from
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

/**
 * Map an angular velocity (radians/second the finger is sweeping the platter) to
 * a turntable playbackRate. `gain` scales wrist speed to musical speed; the
 * result is clamped. 1.0 rate ≈ the record's natural spin, so a steady ~one
 * rotation/second hand motion lands near unity at the default gain.
 */
export const angularVelocityToRate = (
  angVel: number,
  gain: number = RATE_GAIN
): number => clampRate(angVel * gain)

/** Default angular-velocity→rate gain (tuned so a brisk sweep ≈ rate 1–2). */
export const RATE_GAIN = 1 / (2 * Math.PI)

/**
 * Ease a live rate toward a target over `dt` seconds with a time-constant `tau`
 * (exponential approach — frame-rate independent, never overshoots, so the
 * approach through zero is smooth = no discontinuity = no click). Used both to
 * follow the finger with a touch of inertia and to coast back to the baseline
 * (or 0) after release.
 */
export const easeRate = (
  current: number,
  target: number,
  dt: number,
  tau: number
): number => {
  if (tau <= 0) return target
  const k = 1 - Math.exp(-Math.max(0, dt) / tau)
  return current + (target - current) * k
}

/** Is this rate close enough to zero that the record is effectively held? */
export const isHeld = (rate: number): boolean => Math.abs(rate) < HOLD_EPSILON

/**
 * Advance the platter's visual rotation (radians) by playing `rate` for `dt`
 * seconds. One unit of rate = one buffer-second per real second; we render that
 * as a steady spin (TWO_PI * BASE_RPS per rate-unit-second) so the disc visibly
 * tracks the audio. Pure so the spin can be simulated in tests.
 */
export const BASE_RPS = 0.5 // a held "spin" turns the disc half a turn / second

export const advanceRotation = (
  rotation: number,
  rate: number,
  dt: number
): number => {
  const next = rotation + rate * BASE_RPS * 2 * Math.PI * Math.max(0, dt)
  // Keep it bounded so long sessions don't lose float precision.
  const tau2 = 2 * Math.PI
  return ((next % tau2) + tau2) % tau2
}

/** Format a signed rate for the readout, e.g. "+1.00×", "−0.50×", "hold". */
export const fmtRate = (rate: number): string => {
  if (isHeld(rate)) return "hold"
  const sign = rate >= 0 ? "+" : "−"
  return `${sign}${Math.abs(rate).toFixed(2)}×`
}
