// The leverage plates — the mathematics of the escape, and the whole game.
//
// You are pinned. Two plates hang off the ring frame, one light and one heavy,
// each stamped with a whole number. Every tap drops that plate's weight onto
// the bar across your chest. Reach the target **exactly** and the bar tips and
// you kick out. Go one over and the bar crushes you and the fall is lost.
//
// That is the two-denomination exact-target problem — the coin problem, the
// smallest interesting object in number theory that a six-year-old can hold in
// their head — and it is the mechanic rather than a quiz laid over one. The
// target is the value of the sum on the referee's board, so a fall asks two
// questions back to back:
//
//     "what is 62 − 38?"          the served item
//     "how do I make 24 from 7s and 5s?"   the escape
//
// Everything in this file is exact integer arithmetic. There is no float in a
// plate value, a target, a remainder or a comparison, and `plates.test.ts`
// asserts that over the whole reachable target range rather than on a sample.

/** The pair of plates hanging on the frame, and the escape they were cut for. */
export type Plates = {
  /** The light plate. Always the smaller of the two. */
  a: number
  /** The heavy plate. Always strictly greater than `a`. */
  b: number
  /** Taps on the light plate in the shortest escape that uses both plates. */
  x: number
  /** Taps on the heavy plate in that same escape. */
  y: number
  /** `x + y` — how many taps the escape costs at best. */
  taps: number
}

/**
 * The tap budget an escape may cost.
 *
 * The floor is 2 because a one-tap escape is not a decomposition, it is a
 * button. The ceiling is 9 because past that the count runs out on manual
 * dexterity rather than on arithmetic, and a child who knew the answer would
 * still lose — which is the one failure this game must never produce.
 */
export const MIN_TAPS = 2
export const MAX_TAPS = 9

/**
 * Plate sizes, and why they are bounds rather than constants.
 *
 * A pedal is a physical object with a number stamped on it, read at speed with
 * a referee counting, so the default ceilings are small. But the host serves
 * whatever the ladder has reached, and at the top of `dw.add` that is a
 * four-digit column sum — a target of 3,916 cannot be made from plates capped
 * at 400 in nine taps, and a game that quietly failed to cut a pair for it
 * would be a game that stops working exactly when a child gets good.
 *
 * So the ceilings scale with the target and the defaults are the floor.
 */
const BASE_MAX_PLATE = 400
const BASE_MAX_LIGHT = 14

function maxHeavyFor(target: number): number {
  return Math.max(BASE_MAX_PLATE, Math.ceil(target / 2))
}

function maxLightFor(target: number): number {
  return Math.max(BASE_MAX_LIGHT, Math.min(99, Math.floor(target / 12)))
}

export function gcd(m: number, n: number): number {
  let p = Math.abs(m)
  let q = Math.abs(n)
  while (q > 0) {
    const r = p % q
    p = q
    q = r
  }
  return p
}

/**
 * Can `remaining` be made from these two plates at all, with any number of taps?
 *
 * This is the dead-end test, and it is the reason the game has a third outcome
 * beside "escaped" and "overshot". With plates 4 and 7 and a target of 24, a
 * child who taps 7, 7, 7 is on 21 with three to go: no combination of 4 and 7
 * makes 3, and every further tap overshoots. They are not out of time and they
 * have not gone over — they are simply stuck, and the honest thing is to say
 * so at once instead of running the count down on a position with no move in
 * it.
 *
 * Exhaustive by construction: `y` cannot exceed `remaining / b`, so the loop is
 * bounded and every branch is integer division and remainder.
 */
export function reachable(remaining: number, a: number, b: number): boolean {
  if (!Number.isInteger(remaining) || remaining < 0) return false
  if (remaining === 0) return true
  if (a <= 0 || b <= 0) return false
  for (let y = 0; y * b <= remaining; y++) {
    if ((remaining - y * b) % a === 0) return true
  }
  return false
}

/** The fewest taps that make `remaining` exactly, or `null` when nothing does. */
export function minTapsFor(remaining: number, a: number, b: number): number | null {
  if (!Number.isInteger(remaining) || remaining < 0) return null
  if (remaining === 0) return 0
  if (a <= 0 || b <= 0) return null
  let best: number | null = null
  for (let y = 0; y * b <= remaining; y++) {
    const rest = remaining - y * b
    if (rest % a !== 0) continue
    const taps = y + rest / a
    if (best === null || taps < best) best = taps
  }
  return best
}

/**
 * Every escape from `target` on these plates that costs at most `maxTaps`.
 *
 * The game does not show this to the child — it is what the tests use to prove
 * that a chosen pair is escapable, and what the bout uses to decide how much
 * count to give.
 */
export function representations(
  target: number,
  a: number,
  b: number,
  maxTaps: number = MAX_TAPS,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = []
  if (!Number.isInteger(target) || target < 1 || a <= 0 || b <= 0) return out
  for (let y = 0; y * b <= target; y++) {
    const rest = target - y * b
    if (rest % a !== 0) continue
    const x = rest / a
    if (x + y > maxTaps) continue
    out.push({ x, y })
  }
  return out
}

/**
 * How good a pair of plates is for a given target. Lower is better.
 *
 * These weights are the whole design of the difficulty curve, so they are
 * written out rather than tuned by hand into a magic constant:
 *
 *   * **Five taps is the sweet spot.** Two is a shrug, nine is a drum solo.
 *   * **The heavy plate should be round-ish.** A 25 or a 40 is a landmark a
 *     child counts in; a 37 is arithmetic on top of arithmetic.
 *   * **A single-digit light plate.** It is the one being tapped repeatedly and
 *     the running total has to stay mentally cheap.
 *   * **Coprime plates are the good problem.** When gcd(a, b) is 1 the pair
 *     reaches every large target and the search has real structure. When the
 *     heavy plate is a multiple of the light one the light plate is decoration.
 *   * **A pure heavy-plate escape is a trap for the designer, not the child.**
 *     If the target is a small multiple of `b`, the fastest escape ignores half
 *     the equipment, and the fall stops being a decomposition.
 *   * **A pair with exactly one way out is a cliff.** 24 from 4s and 7s has a
 *     single escape — six fours — because 7y ≡ 24 (mod 4) forces y to zero, so
 *     the very first tap of the heavy plate is fatal. That is a true and
 *     interesting fact about the coin problem and a miserable thing to hand a
 *     seven-year-old with a referee counting, so it is heavily penalised. It is
 *     not forbidden: dead ends are the shape of this problem and removing them
 *     entirely would remove the reason to think before tapping.
 */
export function scorePair(target: number, a: number, b: number, x: number, y: number): number {
  let score = Math.abs(x + y - 5) * 3
  if (b % 10 === 0) score -= 2
  else if (b % 5 === 0) score -= 1
  else score += 2
  if (a > 9) score += 3
  if (a === 1) score += 6
  if (b > 99) score += 3
  if (gcd(a, b) > 1) score += 2
  if (b % a === 0) score += 2
  // Integer throughout: `0` means "the heavy plate does not divide the target",
  // which is a fact about divisibility and not a very large number.
  const soloTaps = target % b === 0 ? target / b : 0
  if (soloTaps >= 1 && soloTaps <= 3) score += 4
  if (representations(target, a, b, MAX_TAPS).length < 2) score += 5
  return score
}

export type ChoosePlatesOptions = {
  /**
   * 0..1. Pushes the escape longer and the plates less round as a child climbs
   * the ladder. It never changes what is *true* — every pair returned is exact
   * and escapable at any pressure.
   */
  pressure?: number
}

/**
 * Cut a pair of plates for this target.
 *
 * The returned pair is **always** exact: `a·x + b·y === target`, on every input.
 *
 * For every target of 5 or more it also uses both plates and costs between
 * `MIN_TAPS` and `MAX_TAPS` taps.
 *
 * Below that the guarantee narrows, and it has to: 1 and 2 cannot be split
 * across two distinct plates that are both used, and 3 and 4 only with a light
 * plate of 1. Targets that small are reachable — `22 − 21` is a legal item on
 * the no-regroup rung — so the fallbacks at the bottom return a short, honest,
 * one-plate fall rather than throwing in front of a child.
 */
export function choosePlates(
  target: number,
  rng: { int(lo: number, hi: number): number; next(): number },
  options: ChoosePlatesOptions = {},
): Plates {
  const pressure = Math.max(0, Math.min(1, options.pressure ?? 0))
  // The tap window opens upward under pressure: a beginner is offered escapes
  // around four taps, a fluent child around six.
  const wantMax = Math.min(MAX_TAPS, 5 + Math.round(pressure * 4))

  type Candidate = Plates & { score: number }
  const found: Candidate[] = []

  if (Number.isInteger(target) && target >= 3) {
    const maxLight = maxLightFor(target)
    const maxHeavy = maxHeavyFor(target)
    for (let a = 2; a <= maxLight; a++) {
      for (let x = 1; x <= wantMax - 1; x++) {
        const rest = target - a * x
        if (rest < 1) break
        for (let y = 1; y <= wantMax - x; y++) {
          if (rest % y !== 0) continue
          const b = rest / y
          if (b <= a || b > maxHeavy) continue
          const taps = x + y
          if (taps < MIN_TAPS || taps > wantMax) continue
          found.push({ a, b, x, y, taps, score: scorePair(target, a, b, x, y) })
        }
      }
    }
  }

  if (found.length > 0) {
    let best = found[0]!.score
    for (const c of found) if (c.score < best) best = c.score
    // Everything within a couple of points of the best is an equally good
    // fall; picking among them is what stops the same two plates hanging on
    // the frame every time a target repeats.
    const shortlist = found.filter((c) => c.score <= best + 2)
    const pick = shortlist[rng.int(0, shortlist.length - 1)] ?? shortlist[0]!
    return { a: pick.a, b: pick.b, x: pick.x, y: pick.y, taps: pick.taps }
  }

  // Degenerate targets. 1 and 2 cannot be split across two distinct plates that
  // are both used, so the light plate becomes 1 and the escape is short and
  // honest rather than impossible.
  if (target >= 3) return { a: 1, b: target - 1, x: 1, y: 1, taps: 2 }
  if (target === 2) return { a: 1, b: 2, x: 2, y: 0, taps: 2 }
  return { a: 1, b: 2, x: 1, y: 0, taps: 1 }
}
