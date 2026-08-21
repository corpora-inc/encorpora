// THE COMPREHENSION WINDOW — how long the child may have.
//
// `docs/EXPERIENCE_DESIGN.md` is unambiguous about this and it is the one line
// in the house design that is a prohibition rather than a target:
//
//     T=0→C COMPREHENSION | not budgeted | The child's time. Measured, never
//     limited.
//
// A game where the question walks down a lattice cannot take that literally —
// something has to reach the floor eventually or the board never clears. What
// it CAN do, and what this module exists to guarantee, is the invariant
// underneath it:
//
//     **The window is monotone non-decreasing in the item's difficulty.**
//     A harder question may never get less time than an easier one.
//
// This game used to break that outright. The window was the candidates' fall,
// the fall was `1.184 × descentSeconds`, and `descentSeconds` is the MOTION
// constant the pressure curve tightens as a run escalates — so the window ran
// 11.84s down to 6.87s on exactly the curve that took the requested item
// difficulty from 2 to 9. Harder maths, 42% less time. Excitement and
// comprehension were on one knob, and the knob was labelled excitement.
//
// So the window is computed HERE, from the item and nothing else. Nothing in
// this file may import the director, read a pressure level, or take a run's
// elapsed time as an argument. That is the decoupling, stated structurally.
//
// The numbers are the house cadence table's **p90**, not its p50: the window is
// the point at which the board takes the question away, so it is sized for the
// child who is slow today, not the median one.
//
//     single-digit fact          2.8s / 6s
//     two-digit with regrouping    6s / 14s
//     the `5,001 − 2,798` class   16s / 40s

/** Nothing is ever answerable for less than this, whatever the parser makes of it. */
export const MIN_WINDOW_SECONDS = 6
/**
 * Nor for more. Not a budget — a guard against a malformed prompt parsing as
 * nine columns and leaving a wave drifting for a minute and a half.
 */
export const MAX_WINDOW_SECONDS = 44

/**
 * Seconds by column count, straight off the table: index 1 is the single-digit
 * fact's p90, index 2 and index 4 are the two rows the table names, and index 3
 * is between them. Strictly increasing, which is half of the invariant.
 */
const BY_COLUMNS = [6, 6, 11, 18, 32] as const

/**
 * What regrouping is worth on top, per column count.
 *
 * `11 + 3 = 14` is the two-digit-with-regrouping row exactly, and `32 + 8 = 40`
 * is the `5,001 − 2,798` row exactly. Each of these is small enough that
 * `BY_COLUMNS[n] + REGROUPING[n] <= BY_COLUMNS[n + 1]` — which is the other
 * half of the invariant, and is asserted rather than assumed.
 */
const REGROUPING = [0, 0, 3, 5, 8] as const

export type Item = {
  /** As the child reads it: `247 + 158`. */
  prompt: string
  /** The canonical value the host revealed. Never computed here. */
  answer: number
}

/**
 * The widest column count in the item — the operands and the answer together.
 *
 * The answer counts because it is a column wider than either operand whenever
 * the top place carries, and that carried column is the one the child is still
 * holding when the board decides they are out of time.
 */
export function widestColumn(item: Item): number {
  let widest = 1
  for (const run of item.prompt.match(/\d+/g) ?? []) widest = Math.max(widest, run.length)
  if (Number.isInteger(item.answer) && item.answer > 0) {
    widest = Math.max(widest, String(Math.abs(item.answer)).length)
  }
  return widest
}

const OPERATOR = /^\s*(\d+)\s*([+\-−])\s*(\d+)\s*$/

/**
 * Does this item need a carry or a borrow anywhere?
 *
 * A prompt this cannot parse — a word problem, a form this game has not met yet
 * — reads as **true**, which is the longer window. Guessing in the child's
 * favour is the only direction this function is allowed to be wrong in.
 */
export function needsRegrouping(prompt: string): boolean {
  const m = OPERATOR.exec(prompt)
  if (!m) return true
  const a = Number(m[1])
  const b = Number(m[3])
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b)) return true
  const add = m[2] === "+"
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
 * How long this item is answerable for, in seconds.
 *
 * Monotone non-decreasing in both of its inputs — more columns is never less
 * time, and needing to regroup is never less time than not needing to — and
 * a function of the item alone. A wave still ends the moment it is answered, so
 * this is a ceiling a fluent child never touches, not a pace anybody is held to.
 */
export function comprehensionWindow(item: Item): number {
  const columns = Math.max(1, Math.min(BY_COLUMNS.length - 1, widestColumn(item)))
  const base = BY_COLUMNS[columns] ?? MIN_WINDOW_SECONDS
  const extra = needsRegrouping(item.prompt) ? (REGROUPING[columns] ?? 0) : 0
  return Math.max(MIN_WINDOW_SECONDS, Math.min(MAX_WINDOW_SECONDS, base + extra))
}

/**
 * How long the finished statement is held on the wall after a miss.
 *
 * **There is no such function any more, and this note is why.** It returned 1.5
 * to 3 seconds and the shell spent it as a countdown, taking the completed sum
 * away whether or not anybody had finished reading it. That is the defect
 * `packs/shared/game-pacing`'s `revealPlan` names, and its answer is
 * `holdMs: Infinity` — a child who has just missed is the slowest reader in the
 * session, and a timer sized for a fluent one removes the evidence exactly when
 * it becomes useful. `mount.completeSum` now holds the hall until the child's
 * own hand ends it, with `REVEAL_SETTLE_MS` of lockout and nothing else.
 *
 * Do not bring it back. A duration here is a deadline on reading, and reading is
 * the only thing a miss is for.
 */
