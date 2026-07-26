// The Stage-2 LOCATE contrast pair, on the counting board.
//
// This is the mechanism the product is named for, so it is worth being exact
// about what it does and does not claim.
//
// A child who answers `5001 − 2798 = 3203` regrouped all the way down through the
// zeros, wrote them as 9s, and never took the thousand off the leading digit. The
// answer is the correct one plus exactly the 1,000 that was borrowed and never
// given up. That surplus is not an abstraction: put the answer back together with
// the subtrahend and the board holds `6001` where `5001` was carved. One counter
// has no socket. The contradiction is a thing on the board, not a sentence.
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
// The distinction the program has already got wrong once: `3797` on this same
// problem is a *different* rule (`mis.add.smaller-from-larger`, taking the smaller
// digit from the larger in every column). It is not off by a place-value unit at
// all, so the counting board is not its contradiction and it must never be served
// this card. `judge.ts` decides that; this module only draws what it is given and
// returns `null` when the board cannot honestly be built.

import { exact } from "./curriculum.ts"
import type { AnswerValue, Exercise } from "./curriculum.ts"
import { digitsOf, readProblem } from "./problem.ts"

export interface BoardColumn {
  /** The power of ten this column holds: 3 is thousands. */
  readonly place: number
  /** Counters carved into the board — what the top number actually is. */
  readonly sockets: number
  /** Counters the check put there. Above `sockets`, they have nowhere to sit. */
  readonly counters: number
}

export interface BoardCheck {
  /** The answer being put back, as written. */
  readonly addend: string
  /** `addend + subtrahend`, as written. */
  readonly sum: string
  readonly columns: readonly BoardColumn[]
  /** Does the board close — does the check rebuild the number it started from? */
  readonly rebuilds: boolean
}

export interface CountingBoard {
  readonly minuend: string
  readonly subtrahend: string
  readonly correct: BoardCheck
  readonly yours: BoardCheck
  /** The place value of the surplus, e.g. 3 for a thousand. `null` if none. */
  readonly surplusPlace: number | null
}

function columnsFor(sum: bigint, target: bigint): BoardColumn[] {
  const width = Math.max(sum.toString().length, target.toString().length)
  const sumDigits = digitsOf(sum)
  const targetDigits = digitsOf(target)
  const out: BoardColumn[] = []
  for (let i = 0; i < width; i++) {
    const place = width - 1 - i
    out.push({
      place,
      sockets: targetDigits[targetDigits.length - 1 - place] ?? 0,
      counters: sumDigits[sumDigits.length - 1 - place] ?? 0,
    })
  }
  return out
}

function checkFor(addend: bigint, subtrahend: bigint, target: bigint): BoardCheck {
  const sum = addend + subtrahend
  return {
    addend: addend.toString(),
    sum: sum.toString(),
    columns: columnsFor(sum, target),
    rebuilds: sum === target,
  }
}

/**
 * The board for this item and this wrong answer, or `null` when it cannot be
 * drawn honestly.
 *
 * `null` is returned for a non-subtraction item, a decimal one (the board is a
 * whole-unit place-value board), a wrong answer that happens to rebuild the
 * minuend anyway, and anything whose values are not exact whole numbers. Every
 * one of those is a case where the two plates would look identical or the
 * contradiction would not be visible, and a LOCATE card that shows no
 * contradiction is worse than a Stage-1 strike mark. The caller falls back.
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
  const yourCheck = checkFor(yours, subtrahend, minuend)
  if (yourCheck.rebuilds) return null

  const correctCheck = checkFor(right, subtrahend, minuend)
  // The correct answer must close the board. If it does not, the item is
  // inconsistent and nothing here is worth showing a child.
  if (!correctCheck.rebuilds) return null

  const surplus = yourCheck.columns.find((column) => column.counters > column.sockets)

  return {
    minuend: problem.top,
    subtrahend: problem.bottom,
    correct: correctCheck,
    yours: yourCheck,
    surplusPlace: surplus?.place ?? null,
  }
}
