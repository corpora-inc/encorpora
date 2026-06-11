/**
 * beatlounge — phrase-SCRATCH pure math (CONTINUOUS-RATE turntablism).
 *
 * A real record is ONE wave with ONE read-head. The needle points at ONE exact
 * moment in the phrase; moving the disc moves that single playhead forward or
 * backward through the single buffer; the SPEED you move = the (signed) playback
 * rate. The disc is ALWAYS moving at the hand's current speed — the engine
 * integrates a continuous rate every sample (see `scratchDsp.ts`), it never snaps
 * to a target and freezes between frames. No grains, no re-triggering.
 *
 * THE PHRASE LOOPS. A fixed `SECONDS_PER_REV` maps one full disc revolution to a
 * FIXED slice of the phrase — REGARDLESS of phrase length (real math: a turn is a
 * fixed number of seconds of audio). A longer phrase simply spans MORE revolutions
 * before it loops; the mapping is NEVER scaled by phrase duration. Past the end the
 * playhead WRAPS to the start (and past the start, to the end), so spinning replays
 * the phrase.
 *
 * DIRECTION CONVENTION (the "forward = forward" fix): the disc's accumulated
 * `rotation` is in CLOCKWISE-POSITIVE radians as the finger drags (screen atan2 with
 * y-down gives clockwise-positive deltas). Dragging the record FORWARD (natural
 * clockwise drag) advances the playhead FORWARD: `playhead = +rotation * SECONDS_PER_RAD`.
 * Reverse drag (counter-clockwise) plays backward. The needle is FIXED at 3 o'clock;
 * to bring the groove point for a given time under it, the disc rotates by the
 * NEGATIVE of that point's spiral angle (`needleRotationOffset`), so what is under
 * the needle is exactly the playhead you hear.
 *
 * These helpers turn DISC ROTATION into a BUFFER TIME and a signed RATE, plus the
 * release-coast friction physics and the word-placement geometry. All pure / DOM-
 * and audio-free so the feel is unit-testable. The per-sample read/advance lives in
 * `scratchDsp.ts` (shared by the worklet processor and its tests).
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
 * Buffer-seconds covered by ONE full disc revolution — a FIXED constant, the same
 * for EVERY phrase ("time is consistent for a length of record regardless of the
 * sample"). One full turn of the disc = this many seconds of audio, always. A
 * phrase longer than this just spans more revolutions before it loops; the mapping
 * is never scaled by phrase length. ~2s = a comfortable arc you can scrub slowly.
 */
export const SECONDS_PER_REV = 2.0

/** Back-compat alias (old name). Prefer `SECONDS_PER_REV`. */
export const BUFFER_SECONDS_PER_REV = SECONDS_PER_REV

/** Buffer-seconds advanced per radian of disc rotation (derived, fixed). */
export const SECONDS_PER_RAD = SECONDS_PER_REV / (2 * Math.PI)

/**
 * Disc angular speed (rad/s) of a platter spinning at NATURAL tempo (rate 1.0 = one
 * buffer-second per real second). One revolution every `SECONDS_PER_REV` real
 * seconds. Used by Spin (auto-rotate at natural speed).
 */
export const NATURAL_ANGULAR_VEL = (2 * Math.PI) / SECONDS_PER_REV

/**
 * The angular arc (radians) a clip of `clipSeconds` buffer-seconds occupies on
 * the disc. A clip equal to SECONDS_PER_REV fills a whole revolution.
 */
export const clipArcRadians = (clipSeconds: number): number =>
  (clipSeconds / SECONDS_PER_REV) * (2 * Math.PI)

/**
 * Convert a signed disc-angle delta (radians the finger just dragged the platter)
 * into the playbackRate that makes the audio track that motion over `dt` seconds.
 * rate = bufferΔ / dt, where bufferΔ is the buffer-seconds the rotation demanded.
 * SIGNED so a forward (clockwise) drag is positive (forward) and reverse is
 * negative. Faithful: the record moves at exactly the finger's speed.
 */
export const rotationDeltaToRate = (deltaRadians: number, dt: number): number => {
  if (!(dt > 0)) return 0
  const bufferDelta = deltaRadians * SECONDS_PER_RAD
  return clampRate(bufferDelta / dt)
}

/**
 * The playbackRate for a given disc angular velocity (rad/s). The disc spinning
 * at `angVel` rad/s plays the buffer at this signed rate. Spinning at
 * `NATURAL_ANGULAR_VEL` → rate 1.0 (natural tempo).
 */
export const angularVelocityToRate = (angVel: number): number =>
  clampRate(angVel * SECONDS_PER_RAD)

/**
 * Map an UNWRAPPED disc rotation (radians, accumulated, may be many turns) to the
 * buffer PLAYHEAD TIME (seconds), WRAPPED (looped) into [0, durationSeconds). The
 * phrase LOOPS: rotation 0 → time 0, each revolution adds SECONDS_PER_REV, and once
 * past the phrase end the playhead wraps back to the start. Forward (positive)
 * rotation advances forward; reverse wraps to the end. A real locked groove.
 */
export const rotationToPlayhead = (rotation: number, durationSeconds: number): number => {
  if (!(durationSeconds > 0)) return 0
  let t = (rotation * SECONDS_PER_RAD) % durationSeconds
  if (t < 0) t += durationSeconds
  return t
}

/** Inverse-ish: the disc rotation (radians) for a buffer time within the first loop. */
export const playheadToRotation = (seconds: number): number => seconds / SECONDS_PER_RAD

/* -------------------------------------------- loop quantized to the revolution */

/**
 * The LOOP length (seconds) for a phrase: its real duration rounded UP to a whole
 * number of revolutions (`ceil(duration / SECONDS_PER_REV) * SECONDS_PER_REV`). The
 * buffer is padded with trailing SILENCE to this length so the engine wraps at an
 * INTEGER number of full disc turns. After every loop the playhead returns to 0 at a
 * whole number of revolutions → the phrase start comes back under the 3 o'clock
 * needle at exactly the SAME angle, every loop. A zero/short phrase still gets one
 * full revolution so there's always a groove to spin.
 */
export const paddedLoopSeconds = (durationSeconds: number): number => {
  if (!(durationSeconds > 0)) return SECONDS_PER_REV
  const revs = Math.max(1, Math.ceil(durationSeconds / SECONDS_PER_REV - 1e-9))
  return revs * SECONDS_PER_REV
}

/** How many whole revolutions the padded loop spans (integer ≥ 1). */
export const loopRevolutions = (durationSeconds: number): number =>
  Math.round(paddedLoopSeconds(durationSeconds) / SECONDS_PER_REV)

/**
 * The screen angle (radians, normalized to [0, 2π)) at which the START of the phrase
 * (playhead = 0) sits, after the disc has rotated by `rotation`. The start groove
 * point lives at local angle 0 (the 3 o'clock needle direction in the disc's own
 * frame — see Platter), so on screen it is at `rotation` itself, modulo 2π. Because
 * the loop is rev-quantized, when the playhead returns to 0 the rotation has advanced
 * by an INTEGER × 2π, so this angle is INVARIANT across loops — the start marker
 * returns under the needle every time. (Used to prove the invariance in tests and to
 * place the fixed start marker.)
 */
export const startMarkerScreenAngle = (rotation: number): number => {
  const tau = 2 * Math.PI
  let a = rotation % tau
  if (a < 0) a += tau
  return a
}

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
 * Which word index is "current" at a buffer position (seconds) on the phrase
 * timeline (the playhead is the wrapped position in [0, duration)). While inside a
 * word's audible span, that word; otherwise the
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
 * `dt` seconds — used OFF-contact (release coast / Spin). Kept UNWRAPPED so the
 * coast continues smoothly from wherever the disc was; `rotationToPlayhead` WRAPS
 * for audio (the phrase loops), and CSS `rotate()` handles large radian values.
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
