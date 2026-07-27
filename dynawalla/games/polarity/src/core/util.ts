export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const inv = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));

/** Frame-rate independent exponential approach. `h` is the half-life in seconds. */
export const approach = (a: number, b: number, h: number, dt: number): number =>
  h <= 0 ? b : b + (a - b) * Math.pow(2, -dt / h);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t: number): number => 1 - Math.pow(1 - t, 5);
export const easeInCubic = (t: number): number => t * t * t;
export const easeOutBack = (t: number): number => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};
/** 0 → 1 → 0, peaking at t=0.5. Good for one-shot pops. */
export const pulse = (t: number): number => {
  const x = clamp01(t);
  return Math.sin(x * Math.PI);
};
/** Fast decaying spring wobble in [-1,1], for punches. */
export const wobble = (t: number, freq = 14, decay = 9): number =>
  Math.sin(t * freq) * Math.exp(-t * decay);

export const angleTo = (dx: number, dy: number): number => Math.atan2(dy, dx);
export const dist2 = (ax: number, ay: number, bx: number, by: number): number => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};

/** Shortest signed difference between two angles. */
export const angDiff = (a: number, b: number): number => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
};

export const fmtScore = (n: number): string => {
  const s = Math.floor(n).toString();
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += " ";
    out += s[i];
  }
  return out;
};
