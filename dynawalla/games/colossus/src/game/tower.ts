// The tower: what a floor is, and how a level's tower is built out of the
// keystones it will be asked to answer.
//
// The tower is the level's whole worklist made physical. Every floor standing
// in it belongs to a keystone — either as part of that keystone's solution, or
// as a slab bearing one of the wrong values a child actually produces for it.
// Clear a keystone and its floors leave the building. Clear them all and the
// colossus is on the ground.
//
// That is why the growth penalty bites: a wrong strike does not take a life or
// sound a buzzer, it drops fresh slabs on top of the tower. The child is not
// told off. They are handed more work, and they can see exactly how much.

import type { Question } from "../contract.ts"
import type { Rng } from "../core/rng.ts"
import { MAX_SLAB, productOf, slabsFor } from "./factor.ts"

export type FloorKind =
  /** Part of a keystone's answer. The product of a keystone's solution floors is its answer. */
  | "solution"
  /** A slab bearing one of a keystone's mal-rule values. Punching it is a diagnosis. */
  | "decoy"
  /** What a wrong strike leaves behind. Belongs to nobody and never leaves on its own. */
  | "rubble"

export type Floor = {
  readonly id: number
  readonly value: number
  /** Index of the keystone this floor belongs to; `-1` once it belongs to nobody. */
  owner: number
  kind: FloorKind
}

/**
 * How tall a fresh tower wants to be, in floors.
 *
 * Not a keystone count — a *height* budget, because a keystone answered with
 * three slabs builds more building than one answered with a single slab. The
 * level takes keystones until it has about this much tower, so a six-year-old
 * on single slabs and a ten-year-old on triples both get a colossus of roughly
 * the same size, and neither gets one they cannot reach the top of.
 */
export const FLOOR_BUDGET = 9

/** Floors under and over the budget. A tower is never shorter or longer. */
export const MIN_KEYSTONES = 3
export const MAX_KEYSTONES = 5

/** Floors a wrong strike stacks on top. Fixed, so a child can count it. */
export const GROWTH = 2

/**
 * The tallest a tower is allowed to get.
 *
 * Not mercy — the cost of a wrong strike is real and stays real. It is that a
 * slab in a sixteen-floor tower is already down to about a third of an inch on
 * a phone, and a tower a child cannot reliably tap punishes them twice. Past
 * the cap the strike still costs the keystone; the building just stops taking
 * new stone.
 */
export const MAX_FLOORS = 16

/** Values rubble is cut from: small, anonymous, and no use to anybody. */
const RUBBLE_LO = 2
const RUBBLE_HI = 12

/** A question this game can build with: an exact positive integer answer. */
export function isUsable(question: Question): boolean {
  const n = Number(question.answer)
  return Number.isInteger(n) && n >= 1 && n <= MAX_SLAB
}

export function answerOf(question: Question): number {
  return Number(question.answer)
}

/**
 * How many slabs a keystone's answer is broken into.
 *
 * One slab is "punch the floor that equals 47 + 25" — the same arithmetic with
 * the multiplication layer switched off, and the right thing for a six-year-old
 * on the first rung of the column ladder. The layer switches on as the host's
 * own ladder rises, and never because the game got bored.
 */
export function slabCount(difficulty: number, level: number, ordinal: number): number {
  // The very first keystone of a session is always one slab. The mechanic
  // teaches itself in a single punch and nobody has to be told the rules.
  if (level <= 1 && ordinal === 0) return 1
  const d = Math.max(0, Math.min(1, difficulty))
  if (d < 0.3) return 1
  if (d < 0.65) return 2
  return 3
}

/** Distinct integer mal-rule values worth standing up as slabs. */
export function decoyValues(question: Question, limit: number): number[] {
  const answer = answerOf(question)
  const seen = new Set<number>([answer])
  const out: number[] = []
  for (const text of question.distractors) {
    if (out.length >= limit) break
    const n = Number(text)
    if (!Number.isInteger(n) || n < 1 || n > MAX_SLAB || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/**
 * The floors one keystone puts into the building: the slabs its answer is cut
 * into, plus slabs carrying the wrong values a child actually produces for it.
 *
 * A keystone answered with one slab gets two decoys; one answered with two or
 * three gets one. Every keystone is therefore three or four floors of building,
 * which is what makes a height budget mean anything — and it keeps the tower
 * from becoming a wall of near-misses at the tiers where the answer is already
 * spread over three slabs.
 */
export function floorsFor(
  question: Question,
  index: number,
  want: number,
  rng: Rng,
  nextId: () => number,
): Floor[] {
  const out: Floor[] = []
  for (const value of slabsFor(answerOf(question), want, rng)) {
    out.push({ id: nextId(), value, owner: index, kind: "solution" })
  }
  for (const value of decoyValues(question, out.length === 1 ? 2 : 1)) {
    out.push({ id: nextId(), value, owner: index, kind: "decoy" })
  }
  return out
}

export type LevelPlan = {
  readonly floors: Floor[]
  /** `solutions[i]` is the ids that multiply to `questions[i]`'s answer. */
  readonly solutions: number[][]
}

/**
 * Build the tower for a level from the keystones it will pose.
 *
 * Floors are shuffled through the whole height, so the answer to the third
 * keystone is not sitting in a neat band above the answer to the second.
 */
export function buildTower(
  questions: readonly Question[],
  level: number,
  rng: Rng,
  nextId: () => number,
): LevelPlan {
  const floors: Floor[] = []
  const solutions: number[][] = []

  questions.forEach((question, i) => {
    const want = slabCount(question.difficulty, level, i)
    const mine = floorsFor(question, i, want, rng, nextId)
    solutions.push(mine.filter((f) => f.kind === "solution").map((f) => f.id))
    floors.push(...mine)
  })

  rng.shuffle(floors)
  return { floors, solutions }
}

/** Fresh rubble for the top of the tower. */
export function rubble(count: number, rng: Rng, nextId: () => number): Floor[] {
  const out: Floor[] = []
  for (let i = 0; i < count; i++) {
    out.push({ id: nextId(), value: rng.int(RUBBLE_LO, RUBBLE_HI), owner: -1, kind: "rubble" })
  }
  return out
}

/**
 * The floors still standing for keystone `index`, and whether they still
 * multiply to its answer.
 *
 * A child may punch out a floor that belonged to a *later* keystone — arming a
 * 9 from the fourth keystone and a 8 from the first is a legitimate way to make
 * 72 — which can leave a keystone that has not been asked yet without an
 * answer. `Game` re-plants when that happens; this is the check.
 */
export function standingSolution(
  floors: readonly Floor[],
  index: number,
): { ids: number[]; product: number } {
  const ids: number[] = []
  const values: number[] = []
  for (const floor of floors) {
    if (floor.owner === index && floor.kind === "solution") {
      ids.push(floor.id)
      values.push(floor.value)
    }
  }
  return { ids, product: values.length === 0 ? 0 : productOf(values) }
}
