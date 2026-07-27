/**
 * Ballistics.
 *
 * The honesty rule: **the dial is the range**. A shot dialled to 56 with no wind
 * lands at exactly 56 metres — not 55.98. The float maths below shapes the arc for
 * the eye; it never decides anything. Every outcome is decided by integer compare
 * in `resolve()`.
 *
 * Solution: launch from height `h`, land on y = 0, horizontal distance R, at the
 * chosen launch angle. Two knobs that do genuinely different jobs:
 *   power  -> WHERE it lands   (R, integer metres)
 *   loft   -> the SHAPE of the arc getting there (same landing, different sky)
 * Wind is a constant horizontal acceleration sized so the landing is displaced by
 * exactly `wind` metres — the arc visibly bends and the arithmetic stays exact.
 */

/** Heavier-than-Earth gravity: a 100 m shot flies for ~2.5 s, which is the drama window. */
export const G = 34
export const LAUNCH_H = 11

export type Solved = {
  R: number
  wind: number
  angleDeg: number
  h: number
  /** flight time to ground, seconds */
  T: number
  vx: number
  vy: number
  /** constant horizontal acceleration from wind */
  ax: number
  /** exact landing metre = R + wind */
  landing: number
  apexY: number
  apexT: number
}

export function solve(R: number, angleDeg: number, wind: number, h: number = LAUNCH_H): Solved {
  const th = (angleDeg * Math.PI) / 180
  const tan = Math.tan(th)
  const T = Math.sqrt((2 * (h + R * tan)) / G)
  const vx = R / T
  const vy = vx * tan
  const ax = T > 0 ? (2 * wind) / (T * T) : 0
  return {
    R,
    wind,
    angleDeg,
    h,
    T,
    vx,
    vy,
    ax,
    landing: R + wind,
    apexT: vy / G,
    apexY: h + (vy * vy) / (2 * G),
  }
}

export function posAt(s: Solved, t: number): { x: number; y: number } {
  return {
    x: s.vx * t + 0.5 * s.ax * t * t,
    y: s.h + s.vy * t - 0.5 * G * t * t,
  }
}

export function velAt(s: Solved, t: number): { vx: number; vy: number } {
  return { vx: s.vx + s.ax * t, vy: s.vy - G * t }
}

/** Time at which the shot crosses horizontal position x (NaN if it never does). */
export function timeAtX(s: Solved, x: number): number {
  if (Math.abs(s.ax) < 1e-9) return x / s.vx
  const disc = s.vx * s.vx + 2 * s.ax * x
  if (disc < 0) return NaN
  const root = Math.sqrt(disc)
  const t1 = (-s.vx + root) / s.ax
  const t2 = (-s.vx - root) / s.ax
  const cands = [t1, t2].filter((t) => t >= 0)
  if (!cands.length) return NaN
  return Math.min(...cands)
}

/** Height at horizontal position x — the wall-clearance question. */
export function heightAtX(s: Solved, x: number): number {
  const t = timeAtX(s, x)
  if (!Number.isFinite(t)) return -1
  return posAt(s, t).y
}

/** Sample the arc for drawing. Cheap: closed form, no integration. */
export function samplePath(s: Solved, n: number, until = s.T): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= n; i++) {
    pts.push(posAt(s, (i / n) * until))
  }
  return pts
}

/* ------------------------------------------------------------------ *
 * Outcome — integers only, no float ever reaches a comparison.
 * ------------------------------------------------------------------ */

export type HitQuality = 'direct' | 'solid' | 'graze' | 'miss'

export type TargetRef = { id: number; range: number; value: number; alive: boolean }

export type Outcome<T extends TargetRef = TargetRef> = {
  landing: number
  target: T | null
  quality: HitQuality
  /** |landing − target.range| in whole metres; the "how wrong" the ground shows you */
  errorM: number
}

/** Blast reach in metres — a landing this close still shakes a tower's footings. */
export const GRAZE_M = 3

/**
 * Where did the shot land, and what did that mean? `landing` and every `range`
 * are integers, so `errorM` is an integer and the tiering is exact.
 */
export function resolve<T extends TargetRef>(landing: number, targets: readonly T[]): Outcome<T> {
  let best: T | null = null
  let bestErr = Number.MAX_SAFE_INTEGER
  for (const t of targets) {
    if (!t.alive) continue
    const e = Math.abs(landing - t.range)
    if (e < bestErr) {
      bestErr = e
      best = t
    }
  }
  if (!best) return { landing, target: null, quality: 'miss', errorM: 0 }
  const quality: HitQuality =
    bestErr === 0 ? 'direct' : bestErr <= 1 ? 'solid' : bestErr <= GRAZE_M ? 'graze' : 'miss'
  return { landing, target: quality === 'miss' ? null : best, quality, errorM: bestErr }
}

/** Score for a shot. Integer in, integer out. */
export function shotScore(quality: HitQuality, combo: number, difficulty01: number): number {
  const base = quality === 'direct' ? 120 : quality === 'solid' ? 80 : 0
  if (base === 0) return 0
  const diff = 1 + Math.round(difficulty01 * 4) // 1..5
  const chain = 1 + Math.min(combo, 12) * 0.25
  return Math.round(base * diff * chain)
}
