/**
 * Ballistics.
 *
 * The honesty rule: **the dial is the range, and the wind is exactly the wind**. A
 * shot dialled to 56 in a wind of 5 lands at exactly 61 metres — not 60.98. The
 * float maths below shapes the arc for the eye; it never decides anything. Every
 * outcome is decided by integer compare in `resolve()`.
 *
 * Solution: launch from height `h`, land on y = 0, horizontal distance R, at the
 * chosen launch angle. Two inputs that do genuinely different jobs:
 *   R      -> WHERE it lands in still air (integer metres)
 *   angle  -> the SHAPE of the arc getting there (same landing, different sky)
 * Wind is a constant horizontal acceleration sized so the landing is displaced by
 * exactly `wind` metres — the arc visibly bends and the arithmetic stays exact.
 *
 * The angle is not a control any more. The game throws every boulder at `LOFT_DEG`
 * and the child never chooses it; the parameter stays because the physics has to be
 * right at any angle and the wall clearance is measured through it.
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

/* ------------------------------------------------------------------ *
 * The metre-scale of the field.
 *
 * Four numbers, and three of them are derived from the first two, because the
 * relationship BETWEEN them is what decides whether the wind is an honest
 * mechanic or a decoration. Measured on `origin/main` over 450 shots across five
 * seeds and waves 1–20, driven through the real game against the faithful ladder
 * harness, for a child who works the sum out correctly and dials her answer
 * without accounting for the wind:
 *
 *     wind cap 3   n=95   displacement 1..3 m   graze 72%  solid 28%  MISS 0%
 *     wind cap 4   n=95   displacement 1..4 m   graze 55%  solid 25%  miss 20%
 *
 * 165 of those 190 windy shots — 86.8% — came down INSIDE the blast radius of the
 * keep she was aiming at. The boulder struck the tower, the tower cracked and
 * leaned, masonry came off it, and the game recorded a wrong answer. That is the
 * founder's report, exactly: "they are confusing and don't necessarily do
 * anything". A variable whose whole range is smaller than the blast it moves is
 * invisible in the world and audible only in the verdict, which is the worst of
 * both — it looks ignorable and it is not.
 *
 * So the wind's magnitude is now pinned to this geometry at both ends:
 *
 *   - it must be STRICTLY BIGGER than the blast, or an ignored wind still knocks
 *     dust off the right keep and the child is told she is wrong about a shot she
 *     watched hit;
 *   - it must be small enough that a shot at the answer cannot read as a shot at
 *     the NEXT keep along. `game.ts` fires the garrison — the wrong-horn, the
 *     failure haptic, the counter-volley — when a landing comes down within 1 m of
 *     a keep that is not the one asked for, and that would tell her she had named
 *     the wrong number when what she had actually done was ignore the wind. Keeps
 *     stand at least `MIN_GAP` apart, so the wind may not reach `MIN_GAP − 1`.
 *
 * What is deliberately NOT claimed: that an ignored wind touches nothing at all. At
 * the closest spacing the field allows, a six-metre wind puts the boulder two
 * metres from the neighbouring keep and the blast shakes it. That is the truth
 * about the shot — she was six metres long — and it is told in the right place, out
 * on the ground, next to a keep that is not hers. Making it touch nothing would
 * need `MIN_GAP` at 10, which narrows the 104-metre field to the point where a wave
 * cannot always find six answers to stand apart on it; the mechanic does not get to
 * shorten the waves.
 *
 * Every bound here is asserted through behaviour, not through its own arithmetic,
 * in `sim/world.test.ts`.
 * ------------------------------------------------------------------ */

/** Blast reach in metres — a landing this close still shakes a tower's footings. */
export const GRAZE_M = 3

/**
 * The closest two keeps may ever stand. Two keeps nearer than this would be one
 * target: the blast reaches `GRAZE_M` either side, so at 6 m apart a landing
 * between them shakes both.
 */
export const MIN_GAP = 8

/**
 * The weakest wind there is. One metre past the blast, so a shot that ignores it
 * lands in open ground and leaves a crater with her number in it — which is the
 * feedback the manual has always promised for a wrong answer and which the wind
 * was, measurably, never able to trigger.
 */
export const WIND_MIN = GRAZE_M + 1

/**
 * The strongest wind there is. One metre inside the garrison's reach, so a shot
 * that ignores the wind is never mistaken for a claim about the neighbouring keep.
 */
export const WIND_MAX = MIN_GAP - 2

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
