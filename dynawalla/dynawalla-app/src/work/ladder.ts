// The fixed difficulty ladder.
//
// **There is no adaptivity here, on purpose.** The learner model is M5. This is
// seven rungs in a written order and one counter: four correct answers at a rung
// advance to the next, the top rung repeats forever, and nothing ever descends.
// That last clause is not a simplification — no loss, no demotion, no streak is a
// product rule (MISSION, engagement ethics), so the counter is monotone by
// construction rather than by a check somewhere.
//
// A retry or a repair item is served at a rung *without* moving the position;
// only `rungCorrect` moves the ladder. Otherwise getting an item wrong and then
// right on the easier retry would promote a child for the easier item.
//
// The rungs walk the two M2 skills from two-digit borrowing to the across-zero
// case the slice exists to test: `dw.add.regroup.subtract-multidigit` levels 0–3,
// then `dw.add.regroup.subtract-across-zero` levels 0–2. The parameters are the
// curriculum's, read from the graph — this file names a (skill, level) pair and
// nothing else, so a level's difficulty stays a curriculum fact.

import {
  columnOpParamSchema,
  nodeById,
  skillId,
  FORM_FREE_ENTRY,
  MIS_BORROW_ACROSS_ZERO,
} from "./curriculum.ts"
import type { ColumnOpParams, MalRuleId, SkillId, SkillNode } from "./curriculum.ts"

/** Correct answers at a rung before the ladder moves up. */
export const CORRECT_PER_RUNG = 4

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

/** One rung easier, for the Stage-1 retry. Never below the bottom. */
export function easier(index: number): number {
  return Math.max(0, Math.min(index, LADDER.length - 1) - 1)
}

/**
 * Parameters that *guarantee* an item exercises the step a misconception breaks.
 *
 * This is what makes the follow-up after a contrast pair a repair rather than
 * another card. The child's own rung will not do: `dw.add.regroup.subtract-
 * multidigit` level 2 asks for two regroupings and no zeros, and a zero turns up
 * in a drawn digit often enough to fire this diagnosis anyway — 155 items in
 * 4,000, by the curriculum's own measurement. Serving the next item from that
 * same rung would usually hand back a problem with no zero in it at all, which
 * tests nothing about the step that just broke.
 *
 * So the repair comes from the lowest rung whose *parameters* demand the
 * structure. It is the easiest problem on the ladder that cannot avoid the
 * misunderstanding.
 */
const guaranteesAcrossZero = (params: ColumnOpParams): boolean =>
  params.op === "sub" && params.acrossZero >= 1

const REPAIR_STRUCTURE: readonly (readonly [MalRuleId, (params: ColumnOpParams) => boolean])[] = [
  [MIS_BORROW_ACROSS_ZERO, guaranteesAcrossZero],
]

/**
 * The first rung whose parameters *guarantee* a regrouping across a zero.
 *
 * Derived from the same predicate the repair rung uses, so the two cannot
 * disagree about where the across-zero content starts. The character notices
 * the child arriving here; nothing else reads it.
 */
export const FIRST_ACROSS_ZERO: number = LADDER.findIndex((rung) =>
  guaranteesAcrossZero(rung.params),
)

/** The rung a repair item comes from, or `fallback` when nothing is bound. */
export function repairRung(misconception: MalRuleId, fallback: number): number {
  const bound = REPAIR_STRUCTURE.find(([id]) => id === misconception)
  if (bound === undefined) return fallback
  const index = LADDER.findIndex((rung) => bound[1](rung.params))
  return index === -1 ? fallback : index
}

/** Where the position goes after a correct answer at `index`. Monotone. */
export function advanceRung(index: number, rungCorrect: number): { rung: number; rungCorrect: number } {
  const next = rungCorrect + 1
  if (next < CORRECT_PER_RUNG) return { rung: index, rungCorrect: next }
  return { rung: Math.min(index + 1, LADDER.length - 1), rungCorrect: 0 }
}

/**
 * The widest number any rung can put on the slate.
 *
 * The slate reserves this many numeral columns for every item, so a two-digit
 * problem and a four-digit one occupy the same box and the layout does not move
 * between cards. Derived, so adding a rung cannot leave the reservation stale.
 */
export const SLATE_COLUMNS: number = LADDER.reduce(
  (widest, rung) => Math.max(widest, rung.params.digits + rung.params.decimalPlaces),
  0,
)
