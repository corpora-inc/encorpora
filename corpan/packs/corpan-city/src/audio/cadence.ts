/**
 * cadence.ts — the PURE, audio-free logic behind footstep timing and the master
 * mute/volume persistence. Split out from `soundscape.ts` so it is unit-testable
 * in the `node` vitest environment (no `AudioContext`, no `window` required) and
 * so the footstep cadence math has a single, asserted source of truth.
 *
 * Footstep model: at full walk speed (`speed === 1`) the player takes
 * `STEPS_PER_SEC_MAX` steps per second; the interval scales inversely with speed
 * so a slow shuffle is sparse and a brisk walk is quick. Below `MIN_SPEED` the
 * player is effectively standing and NO steps fire (silence at rest).
 */

export const STORAGE_MUTED = "wp:audio:muted"
export const STORAGE_VOLUME = "wp:audio:volume"

/** Default master volume — intentionally subtle. The plaza should murmur, not blare. */
export const DEFAULT_VOLUME = 0.55

/** Below this normalized speed the player is "standing"; no footsteps. */
export const MIN_STEP_SPEED = 0.06

/** Steps per second at full tilt (speed === 1). A natural brisk-walk cadence. */
export const STEPS_PER_SEC_MAX = 2.6

/** Steps per second at the slowest moving speed. Keeps slow walks from droning. */
export const STEPS_PER_SEC_MIN = 1.2

/**
 * The interval (seconds) between footsteps at a given normalized speed (0..1),
 * or `null` when the player is below the standing threshold (→ no steps).
 * Linearly maps speed→steps-per-second between MIN and MAX, then inverts.
 */
export function stepInterval(speed: number): number | null {
  const s = clamp01(speed)
  if (s < MIN_STEP_SPEED) return null
  const sps = STEPS_PER_SEC_MIN + (STEPS_PER_SEC_MAX - STEPS_PER_SEC_MIN) * s
  return 1 / sps
}

/**
 * A tiny accumulator that converts a per-frame `speed` into discrete footstep
 * fire events. `tick(speed, dt)` returns the number of steps to play THIS frame
 * (almost always 0 or 1; >1 only after a long stall). Resets its phase when the
 * player stops so the first step after standing still doesn't fire instantly on
 * a stale accumulator.
 */
export function createStepClock() {
  let acc = 0
  return {
    tick(speed: number, dt: number): number {
      const interval = stepInterval(speed)
      if (interval == null) {
        acc = 0
        return 0
      }
      acc += dt
      let steps = 0
      // Guard against a huge dt (tab refocus) spamming dozens of steps.
      const cap = 3
      while (acc >= interval && steps < cap) {
        acc -= interval
        steps++
      }
      if (acc >= interval) acc = 0 // drained the cap; drop the backlog
      return steps
    },
    reset() {
      acc = 0
    },
  }
}

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}

// ---- master mute / volume persistence (localStorage; test-safe) ------------

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

/** Read the persisted muted flag (default: false → audio ON). */
export function loadMuted(): boolean {
  const ls = safeStorage()
  return ls?.getItem(STORAGE_MUTED) === "1"
}

export function saveMuted(muted: boolean): void {
  const ls = safeStorage()
  try {
    ls?.setItem(STORAGE_MUTED, muted ? "1" : "0")
  } catch {
    /* quota / private mode — non-fatal, audio still works this session */
  }
}

/** Read the persisted master volume (default DEFAULT_VOLUME), clamped 0..1. */
export function loadVolume(): number {
  const ls = safeStorage()
  const raw = ls?.getItem(STORAGE_VOLUME)
  if (raw == null) return DEFAULT_VOLUME
  const n = Number.parseFloat(raw)
  return Number.isFinite(n) ? clamp01(n) : DEFAULT_VOLUME
}

export function saveVolume(v: number): void {
  const ls = safeStorage()
  try {
    ls?.setItem(STORAGE_VOLUME, clamp01(v).toFixed(3))
  } catch {
    /* non-fatal */
  }
}
