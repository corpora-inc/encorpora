/**
 * beatlounge — phrase-SCRATCH pure math.
 *
 * These helpers turn FINGER MOTION into a turntable playbackRate and a platter
 * ROTATION, with no audio / DOM dependency so the feel is unit-testable.
 *
 * The model is POSITION-based turntablism, not velocity-based: the disc's
 * angular position directly indexes a position in the decoded buffer, so the
 * platter follows the finger 1:1 with NO easing or low-pass lag during contact.
 * A word is stretched across roughly HALF a revolution (you can scrub one word
 * slowly + precisely), and a SILENT gap is mapped between words so each word is
 * legible and separated. The playbackRate handed to the GrainPlayer each frame
 * is simply d(buffer-position)/d(real-time) — exactly the rate that makes the
 * audio track the disc. On RELEASE a friction-decayed momentum keeps the platter
 * coasting (a real turntable's spin-down), which then feeds the same mapping.
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

/* ------------------------------------------------------------------ mapping */

/**
 * Buffer-seconds covered by ONE full disc revolution. The whole snippet (every
 * padded word slot, see SILENCE_GAP) is laid out around the disc at this many
 * seconds per turn. A small value = a tiny snippet still fills the whole record,
 * so a single word occupies a big arc — slow, precise, scrubbable. Tuned so a
 * typical ~0.7s word (padded to ~1.0s with its gap) spans about HALF a turn.
 */
export const BUFFER_SECONDS_PER_REV = 2.0

/** Buffer-seconds advanced per radian of disc rotation (derived). */
export const SECONDS_PER_RAD = BUFFER_SECONDS_PER_REV / (2 * Math.PI)

/**
 * The angular arc (radians) a clip of `clipSeconds` buffer-seconds occupies on
 * the disc. A clip equal to BUFFER_SECONDS_PER_REV fills a whole revolution; a
 * half-rev clip is BUFFER_SECONDS_PER_REV/2 seconds long. Pure so tests can
 * assert "one word ≈ half the record".
 */
export const clipArcRadians = (clipSeconds: number): number =>
  (clipSeconds / BUFFER_SECONDS_PER_REV) * (2 * Math.PI)

/**
 * Convert a signed disc-angle delta (radians the finger just dragged the platter)
 * into the playbackRate that makes the audio track that motion over `dt` seconds.
 * This is the FAITHFUL, lag-free mapping: rate = bufferΔ / dt, where bufferΔ is
 * the buffer-seconds the rotation just demanded. No easing, no low-pass — the
 * record goes exactly where the finger puts it, at any speed.
 */
export const rotationDeltaToRate = (deltaRadians: number, dt: number): number => {
  if (!(dt > 0)) return 0
  const bufferDelta = deltaRadians * SECONDS_PER_RAD
  return clampRate(bufferDelta / dt)
}

/**
 * The playbackRate for a given disc angular velocity (rad/s). Equivalent to
 * rotationDeltaToRate over one second; the disc spinning at `angVel` rad/s plays
 * the buffer at this signed rate. This is the lag-free contact mapping.
 */
export const angularVelocityToRate = (angVel: number): number =>
  clampRate(angVel * SECONDS_PER_RAD)

/**
 * Buffer playback position (seconds, ≥0, wrapped into the snippet) for a disc
 * rotation. The disc angle directly indexes the buffer; `loopSeconds` is the
 * padded snippet length so the position loops cleanly with the disc.
 */
export const rotationToBufferPos = (rotation: number, loopSeconds: number): number => {
  if (!(loopSeconds > 0)) return 0
  const raw = rotation * SECONDS_PER_RAD
  return ((raw % loopSeconds) + loopSeconds) % loopSeconds
}

/* -------------------------------------------------------- silence between words */

/**
 * Silent pad (seconds) inserted AFTER each word so consecutive words don't blur
 * together — you hear space, the disc still turns through it. Audible but tight.
 */
export const SILENCE_GAP = 0.32

/**
 * A word's AUDIBLE span on the gapped timeline: [start, end] in seconds. The
 * trailing silence (SILENCE_GAP) lives BETWEEN one span's end and the next
 * span's start (or, for the last word, before the loop wraps).
 */
export interface WordSpan {
  start: number
  end: number
}

/**
 * Which word index is "current" at a buffer position (seconds) on the gapped,
 * looped timeline. While inside a word's audible span, that word; while inside
 * the trailing gap, the word that JUST played (so the label holds through the
 * silence rather than flickering). −1 only when there are no words. Drives the
 * rotating label so the printed word matches what is being scrubbed/heard.
 */
export const wordIndexAt = (
  spans: WordSpan[],
  pos: number,
  loopSeconds: number
): number => {
  if (spans.length === 0) return -1
  if (!(loopSeconds > 0)) return 0
  const p = ((pos % loopSeconds) + loopSeconds) % loopSeconds
  // Inside an audible span → that word.
  for (let i = 0; i < spans.length; i++) {
    if (p >= spans[i].start && p < spans[i].end) return i
  }
  // In a gap → the most recent word whose span ended at/before p (wrap-aware).
  let best = spans.length - 1 // default: the gap after the last word
  for (let i = 0; i < spans.length; i++) {
    if (spans[i].end <= p) best = i
  }
  return best
}

/* -------------------------------------------------------------- momentum physics */

/**
 * Per-second friction (fraction of angular velocity retained per second). A
 * released platter coasts and decays toward rest; lower = grippier (stops
 * sooner), higher = a longer free spin. A real turntable platter coasts for a
 * couple of seconds, so we keep ~12% of velocity per second.
 */
export const FRICTION_PER_SEC = 0.12

/** Below this |angVel| (rad/s) the coast is considered stopped (snaps to 0). */
export const COAST_STOP_EPSILON = 0.05

/**
 * Decay an angular velocity (rad/s) by friction over `dt` seconds. Frame-rate
 * independent (exponential), monotonic toward zero, snaps to 0 once tiny so the
 * record actually comes to rest. SEPARATE from in-contact tracking — only the
 * RELEASE coast uses this; while a finger owns the platter the velocity is the
 * finger's, untouched by friction.
 */
export const decayAngularVelocity = (angVel: number, dt: number): number => {
  if (!(dt > 0)) return angVel
  const next = angVel * Math.pow(FRICTION_PER_SEC, dt)
  return Math.abs(next) < COAST_STOP_EPSILON ? 0 : next
}

/* --------------------------------------------------------------- visual rotation */

/**
 * Advance the platter's visual rotation by an angular-velocity coast (rad/s) for
 * `dt` seconds — used ONLY off-contact (release / spin baseline). In-contact the
 * rotation is moved by the finger's angular delta (1:1). Kept UNWRAPPED so the
 * coast continues smoothly from wherever contact left the disc (no jump at the
 * contact→coast boundary); `rotationToBufferPos` does the modulo for audio, and
 * CSS `rotate()` handles large radian values. Double precision is ample for a
 * session (thousands of radians stays exact).
 */
export const advanceRotationByVel = (
  rotation: number,
  angVel: number,
  dt: number
): number => rotation + angVel * Math.max(0, dt)

/** Baseline "spin" angular velocity (rad/s) when the record is set to loop. */
export const SPIN_ANG_VEL = (2 * Math.PI) / BUFFER_SECONDS_PER_REV // one snippet/2s-rev → natural

/** Is this rate close enough to zero that the record is effectively held? */
export const isHeld = (rate: number): boolean => Math.abs(rate) < HOLD_EPSILON

/** Format a signed rate for the readout, e.g. "+1.00×", "−0.50×", "hold". */
export const fmtRate = (rate: number): string => {
  if (isHeld(rate)) return "hold"
  const sign = rate >= 0 ? "+" : "−"
  return `${sign}${Math.abs(rate).toFixed(2)}×`
}
