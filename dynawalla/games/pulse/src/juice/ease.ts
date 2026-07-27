/** Named easings. Called by name at every call site so the feel is reviewable. */

export const linear = (t: number): number => t;

export const outQuad = (t: number): number => 1 - (1 - t) * (1 - t);
export const outCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const outQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
export const outExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const inQuad = (t: number): number => t * t;
export const inCubic = (t: number): number => t * t * t;

export const inOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const outBack = (t: number, overshoot = 1.9): number => {
  const c3 = overshoot + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};

export const outElastic = (t: number, period = 0.32): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / period;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** A single sharp bump: 0 → 1 → 0, peaking at `peak`. */
export const impulse = (t: number, peak = 0.18): number => {
  if (t <= 0 || t >= 1) return 0;
  return t < peak ? outQuad(t / peak) : outCubic(1 - (t - peak) / (1 - peak));
};

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential approach. `rate` = e-folds per second. */
export const approach = (cur: number, target: number, rate: number, dt: number): number =>
  target + (cur - target) * Math.exp(-rate * dt);
