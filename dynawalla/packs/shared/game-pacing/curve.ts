/**
 * The mapping seam: ONE intensity in, a game's own constants out.
 *
 * `flow.ts` produces a single number in [0,1] — how hard the world is pushing
 * right now. This file is how a game spends it. Nothing here knows what a mote
 * or a spawn interval is; the game supplies both ends of every range and this
 * supplies the walk between them.
 *
 * Pure arithmetic. No DOM, no state, no allocation.
 */

/** How a range is distributed across the intensity it is driven by. */
export type Curve =
  /** Even. Half the intensity is half the range. */
  | "linear"
  /** Back-loaded. Most of the range is spent low; the top arrives late. */
  | "gentle"
  /** Front-loaded. Leaves the calm quickly, then eases into the top. */
  | "steep"
  /** Smoothstep. No corner at either end. */
  | "settle"

export const clamp01 = (x: number): number => (Number.isNaN(x) ? 0 : x < 0 ? 0 : x > 1 ? 1 : x)

/** Shape `u` in [0,1]. Monotone on [0,1] for every curve, and fixes both ends. */
export function curved(u: number, curve: Curve = "linear"): number {
  const t = clamp01(u)
  switch (curve) {
    case "linear":
      return t
    case "gentle":
      return t * t
    case "steep":
      return 1 - (1 - t) * (1 - t)
    case "settle":
      return t * t * (3 - 2 * t)
  }
}

/** The inverse of `curved`. Exact rather than a search — every curve inverts. */
export function uncurved(v: number, curve: Curve = "linear"): number {
  const t = clamp01(v)
  switch (curve) {
    case "linear":
      return t
    case "gentle":
      return Math.sqrt(t)
    case "steep":
      return 1 - Math.sqrt(1 - t)
    case "settle": {
      // Closed-form inverse of the smoothstep. It goes through `asin`/`sin`,
      // which leaves 5.5e-17 where it should leave 0 — and a demand of
      // 5.5e-17 instead of the floor is a world that is very slightly not at
      // rest, forever. Snap both ends.
      const u = 0.5 - Math.sin(Math.asin(1 - 2 * t) / 3)
      return u < 1e-12 ? 0 : u > 1 - 1e-12 ? 1 : u
    }
  }
}

/**
 * A scalar that walks from `atCalm` to `atFull` as intensity rises.
 *
 * `atCalm` may be the LARGER of the two — a spawn interval, a grace period or a
 * question's time limit all get shorter as the world pushes harder, and that is
 * the same walk read the other way. This is the function a game calls for
 * speed, radius, interval, anything continuous.
 */
export function valueAt(intensity: number, atCalm: number, atFull: number, curve: Curve = "linear"): number {
  return atCalm + (atFull - atCalm) * curved(intensity, curve)
}

/**
 * An entity budget: how many of a thing may exist at this intensity.
 *
 * Rounded, then clamped into the range the caller named. The clamp is not
 * decoration: `Math.round` of a value a hair outside the range is exactly how a
 * fixed-size pool gets asked for one more slot than it owns, and this module is
 * meant to be safe to wire straight into a spawner.
 */
export function countAt(intensity: number, atCalm: number, atFull: number, curve: Curve = "linear"): number {
  const lo = Math.min(atCalm, atFull)
  const hi = Math.max(atCalm, atFull)
  const v = Math.round(valueAt(intensity, atCalm, atFull, curve))
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * A rung on an ordered ladder — the curriculum seam.
 *
 * The ladder itself is NOT defined here. Its length and its ordering belong to
 * the curriculum, and a game passes in however many rungs its host actually
 * offers. This decides only which one the current intensity is standing on.
 *
 * **Hysteresis, and why it is not optional.** Without `current`, a difficulty
 * that sits on a band edge flickers between two rungs every frame, and a child
 * gets alternating easy and hard questions for no reason they can see. Pass the
 * rung you are on and this will move at most ONE rung at a time, and only once
 * intensity has travelled `margin` past the boundary. Falling and rising
 * therefore happen at different intensities, which is what "smoothly" means
 * when a continuous quantity drives a discrete one.
 */
export function rungAt(
  intensity: number,
  rungs: number,
  current?: number,
  margin = 0.04,
): number {
  const n = Math.max(1, Math.floor(rungs))
  const i = clamp01(intensity)
  const raw = Math.min(n - 1, Math.floor(i * n))
  if (current === undefined || !Number.isFinite(current)) return raw
  const cur = Math.min(n - 1, Math.max(0, Math.floor(current)))
  if (raw === cur) return cur
  const top = (cur + 1) / n
  const bottom = cur / n
  if (raw > cur && i >= top + margin) return cur + 1
  if (raw < cur && i <= bottom - margin) return cur - 1
  return cur
}
