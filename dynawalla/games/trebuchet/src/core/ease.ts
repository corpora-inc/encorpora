/** Easing, by name. Every animation in this game names the curve it uses. */

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
export const clamp01 = (v: number): number => clamp(v, 0, 1)
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Frame-rate independent approach. `rate` = fraction of the gap closed per second. */
export const approach = (a: number, b: number, rate: number, dt: number): number =>
  b + (a - b) * Math.exp(-rate * dt)

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeInCubic = (t: number): number => t * t * t
export const easeInQuad = (t: number): number => t * t
export const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t)
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

export function easeOutBack(t: number, overshoot = 1.7): number {
  const c3 = overshoot + 1
  const p = t - 1
  return 1 + c3 * p * p * p + overshoot * p * p
}

export function easeOutElastic(t: number, period = 0.34): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  const c4 = (2 * Math.PI) / period
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

export function easeOutBounce(t: number): number {
  const n1 = 7.5625
  const d1 = 2.75
  if (t < 1 / d1) return n1 * t * t
  if (t < 2 / d1) {
    const p = t - 1.5 / d1
    return n1 * p * p + 0.75
  }
  if (t < 2.5 / d1) {
    const p = t - 2.25 / d1
    return n1 * p * p + 0.9375
  }
  const p = t - 2.625 / d1
  return n1 * p * p + 0.984375
}

/** Smooth, cheap value noise for shake — deterministic per channel. */
export function noise1(x: number, channel: number): number {
  const i = Math.floor(x)
  const f = x - i
  const h = (n: number): number => {
    let t = (n * 1103515245 + channel * 12345 + 0x9e3779b9) >>> 0
    t ^= t >>> 15
    t = Math.imul(t, 0x85ebca6b)
    t ^= t >>> 13
    return ((t >>> 0) / 4294967296) * 2 - 1
  }
  const u = f * f * (3 - 2 * f)
  return lerp(h(i), h(i + 1), u)
}
