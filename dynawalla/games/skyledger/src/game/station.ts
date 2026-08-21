// THE STATION — the one piece of mathematics that makes the sky a plane.
//
// The observatory rules the sky into a 10 × 10 lattice. The horizontal axis is
// ONES, the vertical axis is TENS, and the lattice point (x, y) *is* the number
// `10y + x`. The whole sky is a hundred-square stood upright.
//
// A falling star carries a ledger line — a column sum the host drew. Its
// **station** is where that star belongs on the lattice: the ordered pair of
// the answer's tens and ones digits. `247 + 225 = 472` belongs at (2, 7).
//
// **The great columns are already logged.** An answer of 472 is more than the
// lattice holds, so the hundreds-and-above part — the star's `order` — is
// pre-inked on its plate the way an observatory's assistant has already ruled
// the wide columns of the register. The child works the fine measurement, which
// is the tens and the ones, which is exactly where a carry lives. Nothing is
// dropped and nothing is rounded: the value that goes back to the host is
//
//     order × 100 + y × 10 + x
//
// which is an exact integer the host judges against its own canonical string.
// This module never compares one to the other.
//
// **Why the split is at the hundreds and not somewhere prettier.** Every active
// row of the `add` domain is column arithmetic on whole numbers of two to four
// digits, so an answer runs anywhere up to 19,998. A lattice big enough to hold
// that would need a dial with twenty thousand detents and would stop being an
// instrument a child can turn. Two rings of ten is an astrolabe.

const LATTICE = 10

/** A point on the observatory's lattice. `x` is ones, `y` is tens. Both 0..9. */
export type Station = { readonly x: number; readonly y: number }

/** The lattice is 10 × 10, and every ring on the astrolabe has ten detents. */
export const RINGS = LATTICE

/**
 * The largest answer this game can station.
 *
 * Six digits, which is more than the `add` domain can make: two four-digit
 * addends top out at 19,998. The lattice is unaffected either way — a bigger
 * answer only means a longer `order` pre-inked on the plate, and the child
 * still turns the same two rings.
 */
export const MAX_ANSWER = 999999

/**
 * The answer as an exact non-negative integer, or `null` when the host served
 * something this observatory cannot log.
 *
 * A decimal has no lattice point. Rounding one would report a value the child
 * never asserted, so such an item is dropped rather than bent — the same rule
 * COLOSSUS applies to a slab it cannot cut.
 */
export function answerOf(question: { answer: string }): number | null {
  const raw = question.answer.trim()
  if (!/^\d{1,6}$/.test(raw)) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0 || value > MAX_ANSWER) return null
  return value
}

/** Can this ledger line be hung on a star at all? */
export function isUsable(question: { answer: string }): boolean {
  return answerOf(question) !== null
}

/** The hundreds-and-above part: what the register has already ruled in. */
export function orderOf(value: number): number {
  return Math.floor(value / 100)
}

/** Where a value belongs on the lattice: (ones, tens). */
export function stationOf(value: number): Station {
  return { x: value % 10, y: Math.floor(value / 10) % 10 }
}

/**
 * The value a child asserts by standing the rings at `station` under a star of
 * this `order`. Exact integer arithmetic, always.
 */
export function valueAt(order: number, station: Station): number {
  return order * 100 + station.y * 10 + station.x
}

export function sameStation(a: Station, b: Station): boolean {
  return a.x === b.x && a.y === b.y
}

/**
 * Turn a ring by one detent.
 *
 * **Relative only, and deliberately.** There is no `setStation`, no
 * `stationAt(px, py)`, no way at all to hand this module a place on the screen
 * and get a coordinate back. The astrolabe is the sole producer of an ordered
 * pair and it produces one detent at a time, which is the entire reason this
 * game is not a tapping game. `src/test/produce.test.ts` holds that line.
 */
export function turn(station: Station, ring: "ones" | "tens", dir: number): Station {
  const step = dir >= 0 ? 1 : -1
  if (ring === "ones") return { x: (station.x + step + RINGS) % RINGS, y: station.y }
  return { x: station.x, y: (station.y + step + RINGS) % RINGS }
}

/**
 * The shortest number of detents between two stations.
 *
 * The rings wrap, so it is the circular distance on each, summed. Used by the
 * test that proves a pair cannot be jumped to, and by the astrolabe to decide
 * which way round to animate a pointer.
 */
export function detentsBetween(a: Station, b: Station): number {
  const ring = (p: number, q: number) => {
    const d = Math.abs(p - q)
    return Math.min(d, RINGS - d)
  }
  return ring(a.x, b.x) + ring(a.y, b.y)
}

/**
 * The values a child who is wrong *in a way somebody has a name for* would
 * assert about this ledger line.
 *
 * These are never drawn. Nothing about a star's answer, or the neighbourhood of
 * its answer, is ever put on the sky — a lit decoy would tell a child by
 * elimination where not to aim, which is the same leak as telling them where
 * to. They are used for one thing only, in `game.ts`: a mark that lands on a
 * named slip is a measurement the register recognises, and it does not cost a
 * sighting. A wild guess does. Honest mistakes are cheap here and flailing is
 * not, which is the whole reason the astrolabe has an ammunition at all.
 */
export function namedSlips(distractors: readonly string[]): ReadonlySet<number> {
  const out = new Set<number>()
  for (const raw of distractors) {
    const text = raw.trim()
    if (!/^\d{1,6}$/.test(text)) continue
    const value = Number(text)
    if (!Number.isInteger(value) || value < 0 || value > MAX_ANSWER) continue
    out.add(value)
  }
  return out
}
