// HOW LONG A GATE STAYS OPEN — and why the revive gate has no answer to that.
//
// `docs/EXPERIENCE_DESIGN.md` has one line that is a prohibition rather than a
// target:
//
//     T=0→C COMPREHENSION | not budgeted | The child's time. Measured, never
//     limited.
//
// CLAIM had a flat `GATE_SECONDS = 7`, and that single budget had to cover
// three unlike things: reading the prompt, computing the answer, and **driving
// the snake across the arena to the plate**. The third is motor work and it is
// not small. `worstTravelSeconds` measures it from the game's own geometry:
// the player respawns on the rail, the plates sit inside the plane, movement is
// four-way at `railSpeed`, so the worst rail cell is a fixed, computable number
// of cells from the far edge of the worst plate. On the tall-phone arena at
// level one that is 141 cells at 25 cells/second — **5.64 s of pure driving**
// out of a seven-second ring. Take the 0.55 s plate hold off too and a child
// had **0.81 s** left to read a prompt, read three four-digit candidates and
// pick one, against this codebase's own instrumented 2.8 s p50 for the
// *easiest* class of item there is. It is no better on the wide desktop arena
// (5.52 s), and it is still 4.00 s at the top of the ladder where the rail runs
// fastest — the ladder speeds the child up by less than it speeds the maths up.
//
// So the revive gate has **no limit at all**. It is the gate a child reaches by
// dying; a life is already spent; letting a clock take the second chance away
// is the worst possible moment to be impatient. Nothing moves during a gate —
// hunters are frozen, there is no line out, `onEnterCell` returns early — so an
// open gate is a genuinely safe pocket that can simply wait.
//
// The vault (the same three plates, opened by *clearing* a level) keeps a
// budget, and the rule that makes it legitimate is:
//
//     **A clock may never take anything away from a child.**
//
// A lapsed vault costs nothing, reports nothing and starts the next level — it
// is an abandonment guard, not an answer clock. It is also not a constant: it
// is this item's own p90 read time plus the worst drive on this arena plus the
// plate hold, and **it refills on any input**, so it can only ever run out on a
// child who has stopped playing entirely.

import { PLATE_ARM, PLATE_HALF_H, PLATE_HALF_W, PLATE_SPOTS } from "./plates.ts"

/** A gate that cannot expire. `Infinity - dt` is still `Infinity`. */
export const NO_LIMIT = Number.POSITIVE_INFINITY

/**
 * Seconds by digit count, straight off the cadence table's **p90** row.
 *
 * The table publishes single-digit fact 2.8 s / 6 s, two-digit with regrouping
 * 6 s / 14 s, and the `5,001 − 2,798` class 16 s / 40 s. p90 and not p50,
 * because this number is the point at which the board would take the question
 * away: it is sized for the child who is slow today, not the median one.
 *
 * The same ladder `games/beam/src/sim/window.ts` uses, kept here rather than
 * imported — one game reaching into another's `src/` is not a dependency this
 * repo has, and the table is the shared thing, not the code.
 */
const READ_P90_BY_DIGITS = [6, 6, 11, 18, 32] as const

/** What needing to carry or borrow is worth on top, per digit count. */
const READ_REGROUP_BY_DIGITS = [0, 0, 3, 5, 8] as const

/**
 * Three candidates, not one answer.
 *
 * The cadence table prices *computing* an item. A gate also asks the child to
 * read two more numbers of the same width and decide which of the three is the
 * one they computed, and at the revive gate those are four-digit cell counts
 * like 5400 / 4500 / 1800 that differ in the leading digit. This is the
 * scan, per extra candidate, and it is deliberately generous.
 */
const READ_PER_CANDIDATE_SECONDS = 1.5

const OPERATOR = /^\s*(\d+)\s*([+\-−×÷*/])\s*(\d+)\s*$/

/** The widest run of digits anywhere in the prompt or in any candidate. */
export function widestDigits(prompt: string, labels: ReadonlyArray<string>): number {
  let widest = 1
  for (const text of [prompt, ...labels]) {
    for (const run of text.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  }
  return widest
}

/**
 * Does this prompt need a carry or a borrow?
 *
 * A prompt this cannot parse — a word problem, a fraction, a form this game has
 * not met — reads as **true**, which is the longer allowance. Guessing in the
 * child's favour is the only direction this is allowed to be wrong in.
 */
export function needsRegrouping(prompt: string): boolean {
  const m = OPERATOR.exec(prompt)
  if (!m) return true
  const a = Number(m[1])
  const b = Number(m[3])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return true
  const op = m[2]
  if (op !== "+" && op !== "-" && op !== "−") return true
  const add = op === "+"
  let x = a
  let y = b
  while (x > 0 || y > 0) {
    if (add && (x % 10) + (y % 10) >= 10) return true
    if (!add && x % 10 < y % 10) return true
    x = Math.floor(x / 10)
    y = Math.floor(y / 10)
  }
  return false
}

/**
 * Seconds this item is worth reading and computing, before any driving.
 *
 * Monotone non-decreasing in every input: more digits is never less time, more
 * candidates is never less time, and needing to regroup is never less time than
 * not needing to.
 */
export function readSeconds(prompt: string, labels: ReadonlyArray<string>): number {
  const d = Math.max(1, Math.min(READ_P90_BY_DIGITS.length - 1, widestDigits(prompt, labels)))
  const base = READ_P90_BY_DIGITS[d] as number
  const regroup = needsRegrouping(prompt) ? (READ_REGROUP_BY_DIGITS[d] as number) : 0
  const scan = Math.max(0, labels.length - 1) * READ_PER_CANDIDATE_SECONDS
  return base + regroup + scan
}

/**
 * Steps along one axis from cell `from` to the nearest cell whose centre is
 * inside `(centre − half, centre + half)`.
 *
 * Cell centres are at `i + 0.5`, which is exactly what `Claim.px()`/`py()`
 * produce when the player is at rest, and what `onPlate` is tested against.
 */
function stepsIntoBand(from: number, centre: number, half: number, cells: number): number {
  let best = Number.POSITIVE_INFINITY
  for (let c = 0; c < cells; c++) {
    if (Math.abs(centre - (c + 0.5)) < half) best = Math.min(best, Math.abs(c - from))
  }
  return best
}

/** Every cell of the rail — the ring `resetPlayer` respawns the player onto. */
function railCells(gw: number, gh: number): Array<[number, number]> {
  const ring: Array<[number, number]> = []
  for (let x = 0; x < gw; x++) ring.push([x, 0], [x, gh - 1])
  for (let y = 1; y < gh - 1; y++) ring.push([0, y], [gw - 1, y])
  return ring
}

/**
 * The worst drive, in cells, from any respawn to any plate on a `gw` x `gh`
 * arena.
 *
 * Four-way movement with free cornering, and a gate has no obstacles at all, so
 * the shortest route is the Manhattan one and the two axes are independent.
 * This is the number the seven-second ring was silently spending.
 */
export function worstTravelCells(gw: number, gh: number): number {
  let worst = 0
  for (const [fx, fy] of PLATE_SPOTS) {
    const gx = gw * fx
    const gy = gh * fy
    for (const [cx, cy] of railCells(gw, gh)) {
      const d =
        stepsIntoBand(cx, gx, PLATE_HALF_W, gw) + stepsIntoBand(cy, gy, PLATE_HALF_H, gh)
      if (d > worst) worst = d
    }
  }
  return worst
}

/** The same drive in seconds, at a level's rail speed. */
export function worstTravelSeconds(gw: number, gh: number, railSpeed: number): number {
  return worstTravelCells(gw, gh) / railSpeed
}

/**
 * How long a gate may stay open with the child doing nothing at all.
 *
 * `revive` is `NO_LIMIT` and that is the whole point of this module. `vault` is
 * read + drive + hold, where every term is derived: nothing here is a constant
 * a curriculum can outgrow, and `Claim.updateGate` refills it on any input, so
 * it measures abandonment rather than thought.
 */
export function gateBudget(
  kind: "revive" | "vault",
  q: { prompt: string } | null,
  labels: ReadonlyArray<string>,
  gw: number,
  gh: number,
  railSpeed: number,
): number {
  if (kind === "revive") return NO_LIMIT
  return (
    readSeconds(q?.prompt ?? "", labels) + worstTravelSeconds(gw, gh, railSpeed) + PLATE_ARM
  )
}
