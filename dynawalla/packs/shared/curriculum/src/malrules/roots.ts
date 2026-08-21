/**
 * Mal-rule root ids — the `parent` a group of bugs shares.
 *
 * A root is a **routing key, not an executable rule**, and it is deliberately not
 * in the registry. `MalRule.parent` exists so that several bugs with one cause
 * remediate together; if the root were itself a registered rule it would produce an
 * output of its own, that output would match on the same items as its children, and
 * `classify` — which returns `null` the moment two rules explain one wrong answer —
 * would stop diagnosing anything at all.
 *
 * `mis.frac.whole-number-bias` is the case CURRICULUM.md names: adding numerators
 * and denominators, and reading a larger denominator as a larger number, are the
 * same belief in two places, and a child who holds it needs one repair rather than
 * two.
 *
 * `mis.mul.shift-not-applied` is the second: the placeholder zero missing under a
 * second partial product, and the zeros missing from a multiplication by a power of
 * ten, are one belief about place value. They stay separate *rules* because the
 * contradiction you show a child differs — one is about where a row is written, the
 * other about a number that did not move — but they route to one repair.
 */

import { malRuleId } from "../types/ids.ts";

export const MIS_WHOLE_NUMBER_BIAS = malRuleId("mis.frac.whole-number-bias");
export const MIS_MUL_SHIFT_NOT_APPLIED = malRuleId("mis.mul.shift-not-applied");
