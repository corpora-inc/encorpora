// The coil, as arithmetic.
//
// A coil is an articulated chain of **links**, and a link is nothing but a
// place: a link of place `p` is worth `10^p`. So a coil is an array of place
// exponents, and its value is the sum of the powers — which makes a coil a
// number written in base ten with the positions made physical instead of
// implied.
//
//   72  →  [1,1,1,1,1,1,1, 0,0]      seven tens and two ones
//   403 →  [2,2,2,2, 0,0,0]          four hundreds and three ones
//
// Everything in this file is exact integer arithmetic on `number`. Nothing is
// rounded, nothing is compared with a tolerance, and no value ever leaves here
// as a float: `10 ** p` is exact for every `p` this game can reach, and the
// guard in `valueOf` is what keeps that true rather than assumed.
//
// Two operations, and they are the two things a child does in column
// arithmetic:
//
//   * **break** — one link of place `p` becomes ten links of place `p−1`, in
//     the position it occupied. That is the borrow, and it is the only way to
//     get finer resolution out of a coil.
//   * **fuse** — ten adjacent links of the same place become one link of the
//     place above. That is the carry.
//
// Both preserve the coil's value exactly, and both are asserted to.

/** The largest place a link may carry. `10 ** 15` is still an exact integer. */
export const MAX_PLACE = 15

/** The value of a single link of place `p`. Exact for every legal `p`. */
export function linkValue(p: number): number {
  if (!Number.isInteger(p) || p < 0 || p > MAX_PLACE) {
    throw new RangeError(`coil: place ${String(p)} is out of range`)
  }
  return 10 ** p
}

/** The value of a whole coil, or of any run of links. */
export function valueOf(links: readonly number[]): number {
  let total = 0
  for (const p of links) total += linkValue(p)
  return total
}

/**
 * The coil a whole number arrives as: its digits, biggest place at the head.
 *
 * This is the numeral and nothing more — `403` is four hundreds and three ones,
 * with no tens link at all, exactly as the numeral is written. The zero in the
 * middle is the *absence* of a link, which is what makes borrowing across a
 * zero physically visible rather than a rule about digits.
 */
export function coilOf(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`coil: ${String(value)} is not a whole number`)
  }
  const links: number[] = []
  const digits = String(value)
  for (let i = 0; i < digits.length; i++) {
    const d = digits.charCodeAt(i) - 48
    const place = digits.length - 1 - i
    for (let k = 0; k < d; k++) links.push(place)
  }
  return links
}

/**
 * The value of the suffix `links[cut..]` — the piece the shear takes off.
 *
 * The severed piece is always a suffix because the shear makes **one** cut, at
 * one joint, and the tail is the free end. That single constraint is what turns
 * the coil into a place-value puzzle instead of a shopping list: you cannot
 * simply pick out two tens and five ones, you have to arrange for them to be
 * the last thing on the chain.
 */
export function suffixValue(links: readonly number[], cut: number): number {
  let total = 0
  for (let i = Math.max(0, cut); i < links.length; i++) total += linkValue(links[i] as number)
  return total
}

/** Every value the shear can currently take, indexed by cut position. */
export function suffixValues(links: readonly number[]): number[] {
  const out = new Array<number>(links.length + 1)
  let running = 0
  out[links.length] = 0
  for (let i = links.length - 1; i >= 0; i--) {
    running += linkValue(links[i] as number)
    out[i] = running
  }
  return out
}

/** A link may be cracked open when it is worth more than one. */
export function canBreak(links: readonly number[], index: number): boolean {
  const p = links[index]
  return p !== undefined && p > 0
}

/**
 * The borrow. `links[index]`, a link of place `p`, becomes ten links of place
 * `p−1` **occupying the same position**.
 *
 * In place, and that is the whole design. If the ten new links were appended or
 * the coil were re-sorted, the reachable suffix values would collapse to the
 * running sums of a descending chain, and a demand like `25` against `72` would
 * be unreachable no matter how much you broke: every ten would sit ahead of
 * every one, so a suffix could never hold two tens and five ones. Breaking in
 * place is what lets the borrowed ones sit between the tens you keep and the
 * tens you give away.
 *
 * Returns a new array. The value is unchanged, and the value of the suffix at
 * `index` is unchanged too — which is the property that makes breaking safe to
 * do while aiming.
 */
export function breakAt(links: readonly number[], index: number): number[] {
  if (!canBreak(links, index)) return links.slice()
  const p = links[index] as number
  const out = links.slice(0, index)
  for (let k = 0; k < 10; k++) out.push(p - 1)
  for (let i = index + 1; i < links.length; i++) out.push(links[i] as number)
  return out
}

/**
 * The carry, and the inverse of `breakAt`: the first run of ten adjacent links
 * of the same place collapses into one link of the place above.
 *
 * Used when two coils are welded together — `47` welded to `25` is six tens and
 * twelve ones, and twelve ones is not how a number is written. Applied until it
 * no longer applies, a coil reaches canonical form: at most nine links of any
 * one place, biggest first, which is the numeral again.
 */
export function fuseOnce(links: readonly number[]): number[] | null {
  for (let i = 0; i + 9 < links.length; i++) {
    const p = links[i] as number
    if (p >= MAX_PLACE) continue
    let run = true
    for (let k = 1; k < 10; k++) {
      if (links[i + k] !== p) {
        run = false
        break
      }
    }
    if (!run) continue
    const out = links.slice(0, i)
    out.push(p + 1)
    for (let j = i + 10; j < links.length; j++) out.push(links[j] as number)
    return out
  }
  return null
}

/**
 * The canonical form of a coil: the numeral for its value.
 *
 * Computed from the value rather than by fusing repeatedly, because they are
 * the same answer and this one cannot loop. `fuseOnce` still exists as its own
 * step so the carry can be *drawn* happening, ten links at a time.
 */
export function canonical(links: readonly number[]): number[] {
  return coilOf(valueOf(links))
}

/** True when a coil is already the numeral for its value. */
export function isCanonical(links: readonly number[]): boolean {
  const want = canonical(links)
  if (want.length !== links.length) return false
  for (let i = 0; i < links.length; i++) if (want[i] !== links[i]) return false
  return true
}

/**
 * The fewest breaks that make `target` reachable as a suffix — how much change
 * the demand costs.
 *
 * **Not the same number as the column algorithm's regroupings, and more often
 * larger.** A single cut takes a *contiguous* tail, so `64 − 31` costs a break
 * even though no column needs one: three tens and one one cannot be the end of
 * a chain that finishes with four ones until a ten is cracked open. That is the
 * shape of the constraint and it is deliberate — cracking a ten to make change
 * is the physical act regrouping is a rule about, and this game charges for it
 * every time it is genuinely needed and never when it is not.
 *
 * Not used to judge anything and never shown as a score. It drives the hint
 * that surfaces after a long hesitation, and it is the measure the tests use to
 * prove that every demand is reachable.
 *
 * The search is the strategy the interaction affords: walk in from the tail
 * taking whole links while they fit, and when the next link overshoots, crack
 * that link open and keep walking. It terminates because every break strictly
 * reduces the place of the link at the boundary, and a link of place zero
 * cannot overshoot a target the chain can cover.
 */
export function breaksNeeded(links: readonly number[], target: number): number {
  if (target < 0 || target > valueOf(links)) return -1
  let chain = links.slice()
  let breaks = 0
  for (;;) {
    let taken = 0
    let i = chain.length - 1
    while (i >= 0) {
      const v = linkValue(chain[i] as number)
      if (taken + v > target) break
      taken += v
      i--
    }
    if (taken === target) return breaks
    if (i < 0) return -1
    if (!canBreak(chain, i)) return -1
    chain = breakAt(chain, i)
    breaks++
    if (breaks > 64) return -1
  }
}
