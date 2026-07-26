/** Named easing curves. Referenced by name in the juice spec so feel is auditable. */

export const linear = (t: number): number => t;

export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);

export const easeInCubic = (t: number): number => t * t * t;

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export const easeInBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
};

export const easeOutElastic = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Overshoots to `peak` then settles at 1 — the squash/stretch settle curve. */
export const easeOutOvershoot = (t: number, peak = 1.24): number => {
  if (t >= 1) return 1;
  const e = easeOutCubic(t);
  return e + (peak - 1) * Math.sin(Math.PI * Math.min(1, t * 1.35)) * (1 - t);
};

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Framerate-independent exponential approach. `rate` = fraction closed per second. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  b + (a - b) * Math.exp(-rate * dt);
