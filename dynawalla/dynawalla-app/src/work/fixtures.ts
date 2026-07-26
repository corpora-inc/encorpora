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

/**
 * `903 − 778`, on `subtract-multidigit` level 2.
 *
 * The second fixture, and it is here for a reason `5001 − 2798` cannot serve.
 * On `5001` the borrowed thousand lands in a place the minuend already has, so
 * comparing digits and comparing quantities agree. On `903` it does not: the
 * child's check `225 + 778 = 1003` carries into a place `903` has no digit for,
 * and the two models disagree. Every test in this slice used the agreeing shape,
 * which is exactly why the disagreeing one went unnoticed.
 */
export const CARRY_SURPLUS_RUNG = 2

/** Known-good at `familyRev` 1. Re-derived automatically if they stop matching. */
export const CACHED_SEED = 159579
export const CACHED_SEED_903 = 5656

const SEARCH_LIMIT = 400_000

/** The scaled whole-unit value of a prompt slot, or `null`. */
export function operand(exercise: Exercise, slot: string): bigint | null {
  const value = exercise.prompt.slots[slot]
  if (value === undefined || value.kind !== "number") return null
  return exact.toScaled(value.value, value.decimalPlaces)
}

export interface Fixture {
  readonly seed: number
  readonly exercise: Exercise
}

export function generateAtRung(rung: number, seed: number): Exercise {
  const at = rungAt(rung)
  return columnOpFamily.generate({
    skillId: at.skillId,
    level: at.level,
    seed,
    params: at.params,
    forms: [FORM_FREE_ENTRY],
  })
}

export function generateAt(seed: number): Exercise {
  return generateAtRung(ACROSS_ZERO_RUNG, seed)
}

function find(rung: number, top: bigint, bottom: bigint, cachedSeed: number): Fixture {
  const matches = (exercise: Exercise): boolean =>
    operand(exercise, SLOT_TOP) === top && operand(exercise, SLOT_BOTTOM) === bottom

  const cached = generateAtRung(rung, cachedSeed)
  if (matches(cached)) return { seed: cachedSeed, exercise: cached }
  for (let seed = 0; seed < SEARCH_LIMIT; seed++) {
    const exercise = generateAtRung(rung, seed)
    if (matches(exercise)) return { seed, exercise }
  }
  throw new Error(
    `no seed under ${String(SEARCH_LIMIT)} produces ${top.toString()} − ${bottom.toString()} on rung ${String(rung)}`,
  )
}

let cache: Fixture | null = null
let cache903: Fixture | null = null

/** The real `5001 − 2798` item, and the seed that produces it. */
export function fiveThousandOne(): Fixture {
  cache ??= find(ACROSS_ZERO_RUNG, 5001n, 2798n, CACHED_SEED)
  return cache
}

/** The real `903 − 778` item — the shape where digits and quantities disagree. */
export function nineHundredThree(): Fixture {
  cache903 ??= find(CARRY_SURPLUS_RUNG, 903n, 778n, CACHED_SEED_903)
  return cache903
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
