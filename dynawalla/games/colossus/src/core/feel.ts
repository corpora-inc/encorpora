// Feel: the curves everything in this game moves on, in one place so the whole
// building has one physics rather than eight.

/** Clamp to 0..1. */
export function unit(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent approach: `k` is the fraction closed per 16.7 ms. */
export function approach(a: number, b: number, k: number, dt: number): number {
  const t = 1 - Math.pow(1 - unit(k), dt / 16.6667)
  return a + (b - a) * t
}

/** Heavy things start slow and arrive fast. Gravity, near enough. */
export function easeInQuad(t: number): number {
  const x = unit(t)
  return x * x
}

export function easeOutCubic(t: number): number {
  const x = 1 - unit(t)
  return 1 - x * x * x
}

export function easeOutBack(t: number): number {
  const x = unit(t) - 1
  return 1 + 2.2 * x * x * x + 1.2 * x * x
}

/**
 * A settle: overshoot once, then a short shudder that dies.
 *
 * A stone slab weighing several tonnes does not bounce like a ball, so the
 * amplitude is small and the decay is fast. Anything springier reads as rubber.
 */
export function settle(t: number): number {
  const x = unit(t)
  if (x >= 1) return 1
  return 1 - Math.cos(x * Math.PI * 3.1) * Math.exp(-6.2 * x) * (1 - x)
}
