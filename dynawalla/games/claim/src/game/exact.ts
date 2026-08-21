// Exact arithmetic. Every number that reaches an answer, a comparison or the
// HUD is an integer. `0.1 + 0.2 !== 0.3` is not allowed anywhere near a claim.

export type Frac = { n: number; d: number }

export function gcd(a: number, b: number): number {
  let x = Math.abs(a | 0)
  let y = Math.abs(b | 0)
  while (y !== 0) {
    const t = x % y
    x = y
    y = t
  }
  return x
}

/** Lowest terms, denominator always positive. `0` reduces to `0/1`. */
export function reduce(n: number, d: number): Frac {
  if (d === 0) throw new Error("zero denominator")
  const sign = d < 0 ? -1 : 1
  const g = gcd(n, d) || 1
  return { n: (sign * n) / g, d: (sign * d) / g }
}

/**
 * `n/d` of `total`, exactly — throws rather than rounding.
 *
 * The whole game rests on this: the arena's cell count is chosen so that every
 * fraction the curriculum can ask for lands on a whole number of cells. If a
 * fraction ever fails to divide, that is a level-design bug and it should be
 * loud, not silently off by half a cell.
 */
export function partOf(total: number, n: number, d: number): number {
  const num = total * n
  if (num % d !== 0) throw new Error(`${n}/${d} of ${total} is not a whole number of cells`)
  return num / d
}

/** `p`% of `total`, exactly. Same contract as `partOf`. */
export function percentOf(total: number, p: number): number {
  return partOf(total, p, 100)
}

/** Percent as an integer, rounded half-up. Display only, never a comparison. */
export function percentInt(part: number, total: number): number {
  return Math.round((part * 100) / total)
}

/**
 * Percent to one decimal place, returned as a *string* built from integers.
 * `2664 / 7200` → `"37.0"`. No float ever reaches a comparison.
 */
export function percentTenths(part: number, total: number): string {
  const tenths = Math.round((part * 1000) / total)
  const whole = Math.trunc(tenths / 10)
  return `${whole}.${Math.abs(tenths % 10)}`
}

/**
 * If `part/total` reduces to something a child would recognise — denominator at
 * most `maxDen` — return it. This is what makes the meter a teaching surface:
 * cross 2700/7200 and the game says `3/8`, unprompted.
 */
export function cleanFraction(part: number, total: number, maxDen = 12): Frac | null {
  if (part <= 0 || part > total) return null
  const f = reduce(part, total)
  return f.d <= maxDen ? f : null
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
