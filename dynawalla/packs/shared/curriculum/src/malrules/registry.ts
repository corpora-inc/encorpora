/**
 * Mal-rule registry and the diagnosis entry point.
 *
 * `classify` deliberately returns `null` when two rules produce the same wrong
 * answer on an item. A confident diagnosis that names one of two equally likely
 * bugs is worse than no diagnosis: Stage 2 LOCATE would then show a contrast pair
 * built for a misconception the child may not hold. Ambiguity routes to Stage 3
 * (a faded worked example), which is correct for both.
 */

import type { AnswerValue } from "../types/answer.ts";
import { answerEquals } from "../types/answer.ts";
import type { Exercise } from "../types/exercise.ts";
import type { FamilyId, MalRuleId } from "../types/ids.ts";
import type { MalRule } from "../types/malrule.ts";
import { columnOpMalRules } from "./columnOp.ts";
import { compareOrderMalRules } from "./compareOrder.ts";
import { fracArithMalRules, fracEquivalenceMalRules } from "./fractions.ts";
import { longDivMalRules } from "./longDiv.ts";
import { missingOperandMalRules } from "./missingOperand.ts";
import { multidigitMulMalRules } from "./multidigitMul.ts";
import { placeValueMalRules } from "./placeValue.ts";

export const malRules: readonly MalRule[] = [
  ...columnOpMalRules,
  ...placeValueMalRules,
  ...compareOrderMalRules,
  ...multidigitMulMalRules,
  ...longDivMalRules,
  ...fracEquivalenceMalRules,
  ...fracArithMalRules,
  ...missingOperandMalRules,
];

/**
 * The shipped registry, grouped once.
 *
 * `generate()` asks for its family's rules on **every item** — 59,500 of them in
 * one property sweep — and a fresh `filter` over the whole table each time is an
 * array allocation and fifteen predicate calls per card, on the path CG-17 puts a
 * p95 budget on. The cache is keyed on the default table only; a caller that
 * passes its own rules (every failing-case test does) still gets a fresh filter,
 * so a fixture can never be answered from a cache built for the real one.
 */
const byFamily = new Map<FamilyId, MalRule[]>();

export function malRulesForFamily(family: FamilyId, rules: readonly MalRule[] = malRules): MalRule[] {
  if (rules !== malRules) return rules.filter((rule) => rule.family === family);
  const cached = byFamily.get(family);
  if (cached !== undefined) return cached;
  const grouped = malRules.filter((rule) => rule.family === family);
  byFamily.set(family, grouped);
  return grouped;
}

export function malRuleById(id: MalRuleId, rules: readonly MalRule[] = malRules): MalRule | undefined {
  return rules.find((rule) => rule.id === id);
}

/** Every rule whose buggy output equals `submitted` on this item. */
export function classifyAll(
  exercise: Exercise,
  submitted: AnswerValue,
  rules: readonly MalRule[] = malRules,
): MalRuleId[] {
  const matched: MalRuleId[] = [];
  for (const rule of rules) {
    if (rule.family !== exercise.family) continue;
    if (!rule.applies(exercise)) continue;
    const produced = rule.apply(exercise);
    if (produced !== null && answerEquals(produced, submitted)) matched.push(rule.id);
  }
  return matched;
}

/** The one rule that explains this wrong answer, or `null` if none or several do. */
export function classify(
  exercise: Exercise,
  submitted: AnswerValue,
  rules: readonly MalRule[] = malRules,
): MalRuleId | null {
  const matched = classifyAll(exercise, submitted, rules);
  return matched.length === 1 ? (matched[0] ?? null) : null;
}
