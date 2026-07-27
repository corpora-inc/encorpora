/** Small numeric helpers. Presentation only — never touches a graded value. */

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential approach. `rate` is per second. */
export const approach = (a: number, b: number, rate: number, dt: number): number =>
  b + (a - b) * Math.exp(-rate * dt);

export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
export const easeInCubic = (t: number): number => t * t * t;
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
export const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Cheap smooth pseudo-noise for shake. Deterministic in `t`. */
export function noise1(t: number, seed: number): number {
  return (
    Math.sin(t * 12.9898 + seed * 78.233) * 0.6 +
    Math.sin(t * 31.7 + seed * 19.1) * 0.3 +
    Math.sin(t * 71.3 + seed * 3.7) * 0.1
  );
}

/** A visual-only RNG. Kept separate from the question stream on purpose. */
export function fxRandom(): number {
  return Math.random();
}

export const randRange = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);
