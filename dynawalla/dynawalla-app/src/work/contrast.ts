// The Stage-2 LOCATE contrast pair, on the counting board.
//
// This is the mechanism the product is named for, so it is worth being exact
// about what it does and does not claim.
//
// A child who answers `5001 − 2798 = 3203` regrouped all the way down through the
// zeros, wrote them as 9s, and never took the thousand off the leading digit. The
// answer is the correct one plus exactly the 1,000 that was borrowed and never
// given up. That surplus is not an abstraction: put the answer back together with
// the subtrahend and you are holding `6001` worth of counters over a board carved
// for `5001`. One counter has no socket. The contradiction is a thing on the
// board, not a sentence.
//
//   correct   2203 + 2798 = 5001   every counter seats
//   yours     3203 + 2798 = 6001   one thousand-counter left over
//
// The *pair* is those two boards side by side. Neither board on its own is a
// contrast: "you were wrong" is the left one alone, and the right one alone is a
// worked example. What makes it an explanation rather than a verdict is that the
// child's own procedure is carried out faithfully to the point where it fails to
// close.
//
// ## Quantity, not digits — the bug this module was rewritten to kill
//
// The first version compared the **decimal digits** of `answer + subtrahend`
// against the digits of the minuend, place by place. That is a digit comparison
// in a quantity comparison's clothes, and the two agree only where the surplus
// does not carry. On `903 − 778` (correct 125, the bug gives 225) the check is
// `225 + 778 = 1003`; digit-wise against 903 that reads hundreds 9 sockets / *0*
// counters, so the plate drew nine EMPTY hundreds beside a diamond in a column
// the correct plate did not have. A child shaky on regrouping through zero reads
// that as "I lost all nine hundreds" — a second misconception, taught on the one
// screen whose job is to repair the first. Measured: 11–16% of contrast cards on
// every rung the diagnosis reaches, 4,000 seeds per rung.
//
// A board is a quantity. 1003 in counters over a board carved for 903 fills every
// socket and leaves 1003 − 903 = 100 standing outside; counters trade ten-for-one,
// so any quantity at or above the carved total fills the sockets exactly and the
// remainder is drawn in the places its own digits name. Both plates are built as
// *sockets, all seated, plus the surplus* — never a digit-by-digit diff — so a
// plate can never show an empty socket its partner fills.
//
// A check coming to **less** than the board holds has no honest place-by-place
// drawing (only empty sockets and stranded counters at once), so it returns
// `null` and the caller falls back to Stage 1.
//
// The distinction the program has already got wrong once: `3797` on this same
// problem is a *different* rule (`mis.add.smaller-from-larger`, taking the smaller
// digit from the larger in every column). It is not off by a place-value unit at
// all, so the counting board is not its contradiction and it must never be served
// this card. `judge.ts` decides that; this module only draws what it is given and
// returns `null` when the board cannot honestly be built.

import { exact } from "./curriculum.ts"
import type { AnswerValue, Exercise } from "./curriculum.ts"
import { readProblem } from "./problem.ts"

export interface BoardColumn {
  /** The power of ten this column holds: 3 is thousands. */
  readonly place: number
  /** Counters carved into the board — what the top number actually is. */
  readonly sockets: number
  /** Counters sitting in those sockets. Never more than `sockets`. */
  readonly seated: number
  /** Counters this check has left with nowhere to sit. */
  readonly spare: number
}

export interface BoardCheck {
  /** The answer being put back, as written. */
  readonly addend: string
  /** `addend + subtrahend`, as written. */
  readonly sum: string
  /** One entry per place in `CountingBoard.places`, in the same order. */
  readonly columns: readonly BoardColumn[]
  /** Does the board close — does the check rebuild the number it started from? */
  readonly rebuilds: boolean
}

export interface CountingBoard {
  readonly minuend: string
  readonly subtrahend: string
  /**
   * The one column set both plates are drawn over, highest place first.
   *
   * Shared, not per-plate: if one plate omits its empty leading places, its
   * hundreds sit under the other's thousands and the comparison the card exists
   * to make is not available. An empty place is still a column.
   */
  readonly places: readonly number[]
  readonly correct: BoardCheck
  readonly yours: BoardCheck
}

/** The digit of `value` at a power of ten. `value` is non-negative. */
function digitAt(value: bigint, place: number): number {
  return Number((value / 10n ** BigInt(place)) % 10n)
}

/** One plate: every socket filled, plus whatever the check leaves over.
 *  `sum >= target` is the caller's guarantee, which is what makes "every" true. */
function checkFor(
  addend: bigint,
  subtrahend: bigint,
  target: bigint,
  places: readonly number[],
): BoardCheck {
  const sum = addend + subtrahend
  const spare = sum - target
  return {
    addend: addend.toString(),
    sum: sum.toString(),
    columns: places.map((place) => {
      const sockets = digitAt(target, place)
      return { place, sockets, seated: sockets, spare: digitAt(spare, place) }
    }),
    rebuilds: sum === target,
  }
}

/**
 * The board for this item and this wrong answer, or `null` when it cannot be
 * drawn honestly.
 *
 * `null` for: a non-subtraction item, a decimal one (this board is whole-unit),
 * values that are not exact whole numbers, an answer that rebuilds the minuend
 * anyway, and an answer whose check comes to *less* than the board holds. In
 * every one the plates look identical or the contradiction is not a single
 * readable thing, and a LOCATE card showing no contradiction is worse than a
 * Stage-1 strike mark. The caller falls back.
 */
export function countingBoard(exercise: Exercise, submitted: AnswerValue): CountingBoard | null {
  const problem = readProblem(exercise)
  if (problem === null || problem.op !== "sub" || problem.decimalPlaces !== 0) return null
  if (submitted.kind !== "integer" && submitted.kind !== "columnAlgorithm") return null

  const yours = exact.toScaled(submitted.value, 0)
  const canonical = exercise.answer.canonical
  if (canonical.kind !== "integer" && canonical.kind !== "columnAlgorithm") return null
  const right = exact.toScaled(canonical.value, 0)
  if (yours === null || right === null || yours < 0n) return null

  const { topScaled: minuend, bottomScaled: subtrahend } = problem

  // The correct answer must close the board. If it does not, the item is
  // inconsistent and nothing here is worth showing a child.
  if (right + subtrahend !== minuend) return null

  // The child's check must overflow the board: strictly more than it holds. Equal
  // is not a contradiction, and less has no honest place-by-place drawing.
  const yourSum = yours + subtrahend
  if (yourSum <= minuend) return null

  const width = Math.max(minuend.toString().length, yourSum.toString().length)
  const places = Array.from({ length: width }, (_, i) => width - 1 - i)

  return {
    minuend: problem.top,
    subtrahend: problem.bottom,
    places,
    correct: checkFor(right, subtrahend, minuend, places),
    yours: checkFor(yours, subtrahend, minuend, places),
  }
}
