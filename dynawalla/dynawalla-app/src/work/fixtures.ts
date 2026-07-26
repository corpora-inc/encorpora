// The `5001 − 2798` fixture.
//
// `P-03` is written against one specific problem, so the tests want that exact
// item — not something like it. It is reachable: the across-zero skill's level 2
// is `sub(4, 4, 3, 2)`, four digits with three regroupings through a run of two
// zeros, which is precisely the shape of `5001 − 2798`. So the fixture is a
// **real generated exercise**, found by seed search, rather than a hand-built
// object literal that could drift from what the generator actually emits.
//
// The seed is cached and re-derived if it stops working. `exerciseIdOf` mixes
// `familyRev` into the seed, so a legitimate generator change moves every seed at
// once; a hard-pinned constant would then fail with "wrong numbers" and tell
// nobody why. The search is bounded and takes well under a second.
//
// Test-only. Nothing in the app imports it, so it is not in the bundle.

import { columnOpFamily, exact, FORM_FREE_ENTRY, SLOT_BOTTOM, SLOT_TOP } from "./curriculum.ts"
import type { AnswerValue, Exercise } from "./curriculum.ts"
import { rungAt, LADDER } from "./ladder.ts"

/** The across-zero rung: `dw.add.regroup.subtract-across-zero` level 2. */
export const ACROSS_ZERO_RUNG = LADDER.length - 1

/** Known-good at `familyRev` 1. Re-derived automatically if it stops matching. */
export const CACHED_SEED = 159579

const SEARCH_LIMIT = 400_000

/** The scaled whole-unit value of a prompt slot, or `null`. */
export function operand(exercise: Exercise, slot: string): bigint | null {
  const value = exercise.prompt.slots[slot]
  if (value === undefined || value.kind !== "number") return null
  return exact.toScaled(value.value, value.decimalPlaces)
}

function isFiveThousandOne(exercise: Exercise): boolean {
  return operand(exercise, SLOT_TOP) === 5001n && operand(exercise, SLOT_BOTTOM) === 2798n
}

export function generateAt(seed: number): Exercise {
  const rung = rungAt(ACROSS_ZERO_RUNG)
  return columnOpFamily.generate({
    skillId: rung.skillId,
    level: rung.level,
    seed,
    params: rung.params,
    forms: [FORM_FREE_ENTRY],
  })
}

let cache: { seed: number; exercise: Exercise } | null = null

/** The real `5001 − 2798` item, and the seed that produces it. */
export function fiveThousandOne(): { seed: number; exercise: Exercise } {
  if (cache !== null) return cache
  const cached = generateAt(CACHED_SEED)
  if (isFiveThousandOne(cached)) {
    cache = { seed: CACHED_SEED, exercise: cached }
    return cache
  }
  for (let seed = 0; seed < SEARCH_LIMIT; seed++) {
    const exercise = generateAt(seed)
    if (isFiveThousandOne(exercise)) {
      cache = { seed, exercise }
      return cache
    }
  }
  throw new Error(
    `no seed under ${String(SEARCH_LIMIT)} produces 5001 − 2798 on rung ${String(ACROSS_ZERO_RUNG)}`,
  )
}

/** An exact integer answer value. */
export function answerOf(value: bigint): AnswerValue {
  return { kind: "integer", value: exact.rational(value) }
}

/** The whole-unit value of an answer, or `null` for a shape that has none. */
export function scaledAnswer(value: AnswerValue): bigint | null {
  if (value.kind !== "integer" && value.kind !== "columnAlgorithm") return null
  return exact.toScaled(value.value, 0)
}
