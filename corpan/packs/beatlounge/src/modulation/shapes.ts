/**
 * beatlounge — PURE modulator shape evaluation.
 *
 * Each shape maps a phase position in [0,1) (the fraction through the current
 * cycle), the integer `cycleIndex` (how many full cycles have elapsed), and a
 * `seed` into a bipolar value in [-1, 1]. Everything here is dependency-free and
 * deterministic: the same (shape, phase01, cycleIndex, seed) always yields the
 * same number, so a modulator is reproducible and unit-testable.
 *
 * The deterministic shapes (sine/triangle/saw/square) ignore cycleIndex+seed.
 * The stochastic shapes use a hash of (cycleIndex, seed):
 *   • random — sample & hold: one hashed value held flat across the whole cycle.
 *   • drift  — a smooth random walk: smoothstep-interpolate between the hashed
 *     value of THIS cycle and the NEXT, so the curve is C1-continuous across
 *     cycle boundaries (no steps), perlin-ish.
 */

import type { ModulatorShape } from "../model/document"

const TAU = Math.PI * 2

/** Wrap any real into [0,1). */
const frac01 = (x: number): number => {
  const f = x - Math.floor(x)
  return f < 0 ? f + 1 : f
}

/**
 * A stable hash of two integers → a float in [0,1). Deterministic, well-mixed
 * (xorshift-flavoured integer hash), no external state. Used for sample&hold and
 * the drift walk's per-cycle target values.
 */
export const hash01 = (cycleIndex: number, seed: number): number => {
  let h = (Math.trunc(cycleIndex) ^ Math.imul(Math.trunc(seed) | 0, 0x9e3779b1)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  h = Math.imul(h, 0x846ca68b)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** A hashed bipolar value in [-1, 1] for a given cycle. */
const hashBipolar = (cycleIndex: number, seed: number): number =>
  hash01(cycleIndex, seed) * 2 - 1

/** Smoothstep easing (C1 at the endpoints) for drift interpolation. */
const smoothstep = (t: number): number => t * t * (3 - 2 * t)

/**
 * Evaluate a shape at `phase01` ∈ [0,1) of cycle `cycleIndex`. Returns [-1, 1].
 * Robust to out-of-range phase (wrapped) and non-integer cycleIndex (truncated
 * for the stochastic shapes).
 */
export const shapeValue = (
  shape: ModulatorShape,
  phase01: number,
  cycleIndex: number,
  seed = 0
): number => {
  const p = frac01(phase01)
  switch (shape) {
    case "sine":
      // Starts at 0, rises first — a natural LFO.
      return Math.sin(p * TAU)
    case "triangle":
      // Peak at the middle of the cycle (+1 at p=0.5), -1 at the edges.
      return 1 - 4 * Math.abs(p - 0.5)
    case "saw":
      // Ramp up from -1 to +1 across the cycle.
      return p * 2 - 1
    case "square":
      // First half high, second half low.
      return p < 0.5 ? 1 : -1
    case "random":
      // Sample & hold: one value per cycle, held flat.
      return hashBipolar(Math.trunc(cycleIndex), seed)
    case "drift": {
      // Smooth random walk: interpolate this cycle's target → next cycle's.
      const c = Math.trunc(cycleIndex)
      const a = hashBipolar(c, seed)
      const b = hashBipolar(c + 1, seed)
      return a + (b - a) * smoothstep(p)
    }
    default:
      return 0
  }
}
