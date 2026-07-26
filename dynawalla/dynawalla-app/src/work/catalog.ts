// The curriculum, as the learner model is allowed to see it.
//
// `@dynawalla/engine` does not import `dynawalla/curriculum` and never will —
// its own `boundary.test.ts` fails the build if it does. That is not tidiness:
// the engine's simulation harness needs a graph with seventy skills to exercise
// the interleaving and window rules, and the app ships three. If the scheduler
// read the graph directly, it could only ever be tested against the content that
// happens to exist.
//
// So the app builds the engine's view. This file is the whole of the translation
// and it is one direction only: `Rational` difficulties become fixed-point
// `Fix`, generator parameters become the `guarantees` a repair item is chosen
// by, and nothing about prompts, renderers or answer schemas crosses.
//
// The relative import matches `curriculum.ts`'s, and for the same reason:
// `@dynawalla/engine` is a private package with no `main`, no `exports` and no
// build step, so a bare specifier would resolve under Vite and not under
// `node --experimental-strip-types --test`.

import {
  catalogOf,
  fixed,
  type Catalog,
  type FormMeta,
  type LevelMeta,
  type SkillMeta,
} from "../../../engine/src/index.ts"
import { activeNodes, columnOpFamily, columnOpParamSchema, exact, FORM_FREE_ENTRY, MIS_BORROW_ACROSS_ZERO } from "./curriculum.ts"
import type { ColumnOpParams, Rational, SkillId, SkillNode } from "./curriculum.ts"

/** The only form this build can draw. `LADDER_FORMS` says the same thing. */
const FREE_ENTRY: FormMeta = {
  id: FORM_FREE_ENTRY,
  // Free entry has no guess floor: there is no list to pick from.
  guessFloor: fixed.ZERO,
  // Nothing in the M2 slice is an *enumerable fact*. `5001 − 2798` is computed,
  // not recalled, and scheduling it in the FSRS pool would be the category error
  // ADR-0008 exists to prevent. Layer F stays empty until the fact families land.
  enumerable: false,
}

/**
 * A `Rational` logit as the engine's fixed-point millionths.
 *
 * The curriculum is exact-rational and the engine is fixed-point; this is the
 * one place the two number systems meet, and the rounding happens once, here,
 * rather than in every comparison downstream.
 */
export function toFix(value: Rational): fixed.Fix {
  return fixed.fromRatio(Number(value.n), Number(value.d))
}

/**
 * The mal-rules a level's parameters *guarantee* an item will exercise.
 *
 * This is what makes a repair item a repair rather than another card: the
 * child's own level will usually hand back a problem with no zero in it at all,
 * which tests nothing about the step that just broke. The predicate is the
 * curriculum's — `acrossZero >= 1` forces a regrouping through a zero — and it
 * lives here because the engine may not know what a generator parameter is.
 */
function guaranteesOf(params: ColumnOpParams): string[] {
  return params.op === "sub" && params.acrossZero >= 1 ? [MIS_BORROW_ACROSS_ZERO] : []
}

function levelsOf(node: SkillNode): LevelMeta[] {
  return node.generator.params.map((raw, level) => {
    const parsed = columnOpParamSchema.validate(raw)
    if (!parsed.ok) throw new RangeError(`catalog: ${node.id} level ${String(level)} has invalid params`)
    const declared = node.difficulty.levels[level]
    // `b_item` is the node's own contribution plus the generator's parameter
    // offset. The curriculum states the expected value per level and gate CG-9
    // checks it against the params, so using the declared value when it exists
    // keeps the app and the gate reading the same number.
    const b = declared ?? exact.add(node.difficulty.b, columnOpFamily.difficultyOffset(parsed.value))
    return { b: toFix(b), guarantees: guaranteesOf(parsed.value), forms: [FREE_ENTRY] }
  })
}

let cached: Catalog | null = null

/** The engine's view of every active skill. Built once. */
export function engineCatalog(): Catalog {
  if (cached !== null) return cached
  const skills: SkillMeta[] = activeNodes().map((node) => ({
    id: node.id,
    b: toFix(node.difficulty.b),
    levels: levelsOf(node),
    prereqs: node.prereqs.filter((edge) => edge.kind === "requires").map((edge) => edge.to),
    // The interleaving rule groups on this. Every M2 node is a column operation,
    // so the operation is the generator's, not the domain's: `add` and `sub`
    // are different work and the rule is about not doing eight of one.
    operation: operationOf(node),
    gradeNominal: node.gradeBand.nominal,
    misconceptions: [...node.misconceptions],
  }))
  cached = catalogOf(skills)
  return cached
}

function operationOf(node: SkillNode): string {
  const first = node.generator.params[0]
  const parsed = first === undefined ? null : columnOpParamSchema.validate(first)
  return parsed !== null && parsed.ok ? parsed.value.op : node.domain
}

/** The generator parameters for one planned card. */
export function paramsFor(skillId: SkillId, level: number): ColumnOpParams {
  const node = activeNodes().find((candidate) => candidate.id === skillId)
  if (node === undefined) throw new RangeError(`catalog: no active skill ${skillId}`)
  const raw = node.generator.params[level]
  if (raw === undefined) throw new RangeError(`catalog: ${skillId} has no level ${String(level)}`)
  const parsed = columnOpParamSchema.validate(raw)
  if (!parsed.ok) throw new RangeError(`catalog: ${skillId} level ${String(level)} has invalid params`)
  return parsed.value
}

/**
 * The child's grade, for the cold-start seed.
 *
 * One number, and it is the only thing the model is told before the first card.
 * Hard-coded until the M9 profile screen asks for it; the seam is here so that
 * screen changes one line.
 */
export const DEFAULT_GRADE = 3

/** The easiest and hardest item the catalog can serve, for the 0…1 difficulty. */
export function difficultyRange(): { readonly low: fixed.Fix; readonly high: fixed.Fix } {
  const all = engineCatalog().skills.flatMap((skill) => skill.levels.map((level) => level.b))
  let low = all[0] ?? fixed.ZERO
  let high = all[0] ?? fixed.ZERO
  for (const b of all) {
    if (b < low) low = b
    if (b > high) high = b
  }
  return { low, high }
}
