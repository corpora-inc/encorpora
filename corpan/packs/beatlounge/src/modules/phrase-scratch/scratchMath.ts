/**
 * beatlounge — phrase-SCRATCH pure math (POSITION-BASED turntablism).
 *
 * A real record is ONE wave with ONE read-head. The needle points at ONE exact
 * moment in the phrase; moving the disc moves that single playhead forward or
 * backward through the single buffer; the speed you move = the (signed) playback
 * rate. No grains, no looping, no re-triggering. A fixed arc of vinyl = a fixed
 * slice of time in the wave.
 *
 * These helpers turn DISC ROTATION into a BUFFER TIME (the playhead the needle
 * points at + the worklet scrubs to) and back, plus the release-coast friction
 * physics and the word-placement geometry. All pure / DOM- and audio-free so the
 * feel is unit-testable. The actual sample reading / playhead advance lives in
 * `scratchDsp.ts` (shared by the worklet processor and its tests).
 *
 * THE SPIRAL: rotation accumulates WITHOUT wrapping. A fixed `BUFFER_SECONDS_PER_REV`
 * maps one full revolution to a fixed slice of the phrase, so a phrase longer than
 * one revolution spans MULTIPLE revolutions — the groove/label spirals inward per
 * turn, exactly like a real record. The playhead is clamped to the phrase duration
 * (a real record does not wrap: past the end is run-off silence, past the start is
 * silence).
 */

/** Max absolute playbackRate. Beyond this the scrub aliases hard. */
export const MAX_RATE = 8

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

/* ---------------------------------------------------- disc rotation <-> buffer */

/**
 * Buffer-seconds covered by ONE full disc revolution. The phrase is laid out
 * along the groove at this many seconds per turn; a value of ~2s means a typical
 * word spans a comfortable arc you can scrub slowly + precisely, and a phrase
 * longer than 2s spirals across multiple revolutions.
 */
export const BUFFER_SECONDS_PER_REV = 2.0

/** Buffer-seconds advanced per radian of disc rotation (derived). */
export const SECONDS_PER_RAD = BUFFER_SECONDS_PER_REV / (2 * Math.PI)

/**
 * The angular arc (radians) a clip of `clipSeconds` buffer-seconds occupies on
 * the disc. A clip equal to BUFFER_SECONDS_PER_REV fills a whole revolution.
 */
export const clipArcRadians = (clipSeconds: number): number =>
  (clipSeconds / BUFFER_SECONDS_PER_REV) * (2 * Math.PI)

/**
 * Convert a signed disc-angle delta (radians the finger just dragged the platter)
 * into the playbackRate that makes the audio track that motion over `dt` seconds.
 * rate = bufferΔ / dt, where bufferΔ is the buffer-seconds the rotation demanded.
 * Faithful, lag-free: the record goes exactly where the finger puts it, signed.
 */
export const rotationDeltaToRate = (deltaRadians: number, dt: number): number => {
  if (!(dt > 0)) return 0
  const bufferDelta = deltaRadians * SECONDS_PER_RAD
  return clampRate(bufferDelta / dt)
}

/**
 * The playbackRate for a given disc angular velocity (rad/s). The disc spinning
 * at `angVel` rad/s plays the buffer at this signed rate. The lag-free contact
 * mapping (equivalent to rotationDeltaToRate over one second).
 */
export const angularVelocityToRate = (angVel: number): number =>
  clampRate(angVel * SECONDS_PER_RAD)

/**
 * Map an UNWRAPPED disc rotation (radians, accumulated, may be many turns) to the
 * absolute buffer PLAYHEAD TIME (seconds), CLAMPED to [0, durationSeconds]. This
 * is the single source of truth the needle points at AND the worklet scrubs to.
 *
 * No modulo: rotation 0 → time 0, and each additional revolution adds
 * BUFFER_SECONDS_PER_REV — so a long phrase spirals across revolutions. Past the
 * end clamps to the run-off (duration); below zero clamps to the lead-in (0). A
 * real record does NOT wrap.
 */
export const rotationToPlayhead = (rotation: number, durationSeconds: number): number => {
  if (!(durationSeconds > 0)) return 0
  const raw = rotation * SECONDS_PER_RAD
  if (raw <= 0) return 0
  if (raw >= durationSeconds) return durationSeconds
  return raw
}

/** Inverse of `rotationToPlayhead`: the disc rotation (radians) for a buffer time. */
export const playheadToRotation = (seconds: number): number => seconds / SECONDS_PER_RAD

/* -------------------------------------------------------------- the spiral geometry */

/** A point on the spiral groove, normalized: angle (radians) + radius fraction 0..1. */
export interface SpiralPoint {
  /** Rotation around the disc (radians, may exceed 2π for inner turns). */
  angle: number
  /** Radius as a fraction of the playable groove band (0 = inner, 1 = outer rim). */
  radiusFrac: number
}

/**
 * Place a buffer TIME (seconds) on the spiral groove. A real record's groove
 * starts at the OUTER rim and spirals INWARD; we mirror that. `time / SECONDS_PER_REV`
 * is the revolution count; its fractional part is the angle around the disc and
 * its whole part steps the radius inward by one band per revolution.
 *
 *   • `angle`      = (time / BUFFER_SECONDS_PER_REV) * 2π  (unwrapped, total turn)
 *   • `radiusFrac` = 1 − revsDone/totalRevs                (outer→inner across the phrase)
 *
 * `totalSeconds` is the whole phrase; `radiusFrac` walks from 1 (rim, t=0) down to
 * a floor at the spindle (t=totalSeconds). With a sub-1-rev phrase the groove just
 * uses the outer band (no visible spiral, which is correct).
 */
export const timeToSpiral = (
  time: number,
  totalSeconds: number,
  innerFloor: number = 0.18
): SpiralPoint => {
  const t = Math.max(0, time)
  const revs = t / BUFFER_SECONDS_PER_REV
  const angle = revs * 2 * Math.PI
  const totalRevs = Math.max(1e-6, totalSeconds / BUFFER_SECONDS_PER_REV)
  const frac = totalRevs <= 1 ? 1 : 1 - revs / totalRevs
  const span = 1 - innerFloor
  // Keep the groove inside [innerFloor, 1].
  const r = innerFloor + Math.max(0, Math.min(1, frac)) * span
  return { angle, radiusFrac: r }
}

/* -------------------------------------------------- words along the groove (visual) */

/** A word's AUDIBLE span on the REAL phrase timeline: [start, end] in seconds. */
export interface WordSpan {
  start: number
  end: number
}

/**
 * Which word index is "current" at a buffer position (seconds) on the REAL (non-
 * looping) phrase timeline. While inside a word's span, that word; otherwise the
 * NEAREST word boundary already crossed (so the label holds through inter-word
 * space rather than flickering to nothing). −1 only when there are no words.
 */
export const wordIndexAt = (spans: WordSpan[], pos: number): number => {
  if (spans.length === 0) return -1
  if (pos <= spans[0].start) return 0
  // Inside an audible span → that word.
  for (let i = 0; i < spans.length; i++) {
    if (pos >= spans[i].start && pos < spans[i].end) return i
  }
  // Between words / past the end → the most recent word that began at/before pos.
  let best = 0
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].start <= pos) best = i
  }
  return best
}

/* -------------------------------------------------------------- momentum physics */

/**
 * Per-second friction (fraction of angular velocity retained per second). A
 * released platter coasts and decays toward rest; lower = grippier (stops
 * sooner), higher = a longer free spin. ~12% per second ≈ a couple-second coast.
 */
export const FRICTION_PER_SEC = 0.12

/** Below this |angVel| (rad/s) the coast is considered stopped (snaps to 0). */
export const COAST_STOP_EPSILON = 0.05

/**
 * Decay an angular velocity (rad/s) by friction over `dt` seconds. Frame-rate
 * independent (exponential), monotonic toward zero, snaps to 0 once tiny so the
 * record actually comes to rest. Only the RELEASE coast uses this; while a finger
 * owns the platter the velocity is the finger's, untouched by friction.
 */
export const decayAngularVelocity = (angVel: number, dt: number): number => {
  if (!(dt > 0)) return angVel
  const next = angVel * Math.pow(FRICTION_PER_SEC, dt)
  return Math.abs(next) < COAST_STOP_EPSILON ? 0 : next
}

/* --------------------------------------------------------------- visual rotation */

/**
 * Advance the platter's visual rotation by an angular-velocity coast (rad/s) for
 * `dt` seconds — used OFF-contact (release coast). Kept UNWRAPPED so the coast
 * continues smoothly from wherever contact left the disc; `rotationToPlayhead`
 * clamps for audio, CSS `rotate()` handles large radian values.
 */
export const advanceRotationByVel = (
  rotation: number,
  angVel: number,
  dt: number
): number => rotation + angVel * Math.max(0, dt)

/** Is this rate close enough to zero that the record is effectively held? */
export const isHeld = (rate: number): boolean => Math.abs(rate) < HOLD_EPSILON

/** Format a signed rate for the readout, e.g. "+1.00×", "−0.50×", "hold". */
export const fmtRate = (rate: number): string => {
  if (isHeld(rate)) return "hold"
  const sign = rate >= 0 ? "+" : "−"
  return `${sign}${Math.abs(rate).toFixed(2)}×`
}

/** Format a buffer time (seconds) for the position readout, e.g. "0.84s". */
export const fmtTime = (seconds: number): string => `${Math.max(0, seconds).toFixed(2)}s`
