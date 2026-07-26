// The M2 slice, as an ordered table.
//
// **Selection is the learner model's, not this file's.** Until M5 these seven
// rungs *were* the scheduler: four correct answers advanced one rung and nothing
// ever descended. The engine now chooses, and what is left here is the thing the
// ladder always actually was — the ordered list of (skill, level) pairs the M2
// slice can serve, from two-digit borrowing to the across-zero case the slice
// exists to test.
//
// It still earns its place. `SLATE_COLUMNS` reserves the widest number any of
// them can write, so the units column does not move between a two-digit problem
// and a four-digit one (`Q-01`); `fixtures.ts` finds `5001 − 2798` by searching
// a named pair; and `ladder.test.ts` asserts that every pair binds an active
// skill, climbs in difficulty, and has an entry model — which is the app's half
// of gate CG-8 over the whole slice.
//
// The parameters are the curriculum's, read from the graph. This file names a
// (skill, level) pair and nothing else, so a level's difficulty stays a
// curriculum fact.

import { columnOpParamSchema, nodeById, skillId, FORM_FREE_ENTRY } from "./curriculum.ts"
import type { ColumnOpParams, SkillId, SkillNode } from "./curriculum.ts"

/** Cards in one run before a designed stopping point is offered. */
export const RUN_LENGTH = 12

export const SKILL_SUBTRACT_MULTIDIGIT = skillId("dw.add.regroup.subtract-multidigit")
export const SKILL_SUBTRACT_ACROSS_ZERO = skillId("dw.add.regroup.subtract-across-zero")

/**
 * Free entry only, for now. The family also emits `column` — the borrow grid with
 * its written regrouping marks — and that form needs a `columnAlgorithm` renderer
 * and entry model this PR does not build. Asking for one form is how the request
 * contract says so; the family picks deterministically among whatever it is given.
 */
export const LADDER_FORMS: readonly string[] = [FORM_FREE_ENTRY]

export interface Rung {
  readonly skillId: SkillId
  readonly level: number
  readonly params: ColumnOpParams
}

const STEPS: readonly (readonly [SkillId, number])[] = [
  [SKILL_SUBTRACT_MULTIDIGIT, 0],
  [SKILL_SUBTRACT_MULTIDIGIT, 1],
  [SKILL_SUBTRACT_MULTIDIGIT, 2],
  [SKILL_SUBTRACT_MULTIDIGIT, 3],
  [SKILL_SUBTRACT_ACROSS_ZERO, 0],
  [SKILL_SUBTRACT_ACROSS_ZERO, 1],
  [SKILL_SUBTRACT_ACROSS_ZERO, 2],
]

function rungOf(id: SkillId, level: number): Rung {
  const node: SkillNode | undefined = nodeById(id)
  if (node === undefined) throw new RangeError(`ladder: no skill ${id}`)
  if (node.status !== "active") throw new RangeError(`ladder: ${id} is ${node.status}, not active`)
  const raw = node.generator.params[level]
  if (raw === undefined) throw new RangeError(`ladder: ${id} has no level ${String(level)}`)
  const parsed = columnOpParamSchema.validate(raw)
  if (!parsed.ok) throw new RangeError(`ladder: ${id} level ${String(level)} has invalid params`)
  return { skillId: id, level, params: parsed.value }
}

export const LADDER: readonly Rung[] = STEPS.map(([id, level]) => rungOf(id, level))

/** The rung at `index`, clamped. Above the top the ladder simply repeats. */
export function rungAt(index: number): Rung {
  const clamped = Math.min(Math.max(index, 0), LADDER.length - 1)
  const rung = LADDER[clamped]
  if (rung === undefined) throw new RangeError("ladder: empty")
  return rung
}

/**
 * Parameters that *guarantee* an item exercises the step a misconception breaks.
 *
 * The predicate the engine's catalog is built from — see `catalog.ts`, which
 * turns it into each level's `guarantees` so the scheduler can pick a repair
 * item without knowing what a generator parameter is. It is here as well because
 * `FIRST_ACROSS_ZERO` is the same question asked of the slice table.
 */
export const guaranteesAcrossZero = (params: ColumnOpParams): boolean =>
  params.op === "sub" && params.acrossZero >= 1

/**
 * The first pair whose parameters *guarantee* a regrouping across a zero.
 *
 * Derived from the same predicate the engine's repair level uses, so the two
 * cannot disagree about where the across-zero content starts.
 */
export const FIRST_ACROSS_ZERO: number = LADDER.findIndex((rung) =>
  guaranteesAcrossZero(rung.params),
)

/**
 * The widest number any pair can put on the slate.
 *
 * The slate reserves this many numeral columns for every item, so a two-digit
 * problem and a four-digit one occupy the same box and the layout does not move
 * between cards. Derived, so adding a rung cannot leave the reservation stale.
 */
export const SLATE_COLUMNS: number = LADDER.reduce(
  (widest, rung) => Math.max(widest, rung.params.digits + rung.params.decimalPlaces),
  0,
)
