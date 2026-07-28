// Feel: the curves everything in this observatory moves on, in one place so the
// whole instrument has one physics rather than eight.

/** Clamp to 0..1. */
export function unit(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Frame-rate independent approach: `k` is the fraction closed per 16.7 ms. */
export function approach(a: number, b: number, k: number, dt: number): number {
  const t = 1 - Math.pow(1 - unit(k), dt / 16.6667)
  return a + (b - a) * t
}

export function easeOutCubic(t: number): number {
  const x = 1 - unit(t)
  return 1 - x * x * x
}

export function easeInCubic(t: number): number {
  const x = unit(t)
  return x * x * x
}

export function easeInOutSine(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * unit(t))
}

/**
 * The snap: a star crossing to its true station does not glide. It leaves fast,
 * arrives faster, and stops dead. Anything eased-out on both ends reads as a
 * balloon drifting rather than a measurement being taken.
 */
export function snap(t: number): number {
  const x = unit(t)
  return x * x * (3 - 2 * x) * 0.35 + easeInCubic(x) * 0.65
}

/** A detent: the ring turns, overshoots by a hair, and seats. */
export function detent(t: number): number {
  const x = unit(t)
  if (x >= 1) return 1
  return 1 - Math.cos(x * Math.PI * 2.4) * Math.exp(-7.5 * x) * (1 - x)
}
