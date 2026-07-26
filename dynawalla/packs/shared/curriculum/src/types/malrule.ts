/**
 * Mal-rules — executable, triple-duty.
 *
 * A mal-rule is a pure `(exercise) => AnswerValue | null` reproducing a documented
 * buggy procedure. One function gives three things: a principled distractor (a wrong
 * answer a real child would actually produce), a diagnosis (if the child's answer
 * *equals* the mal-rule output you know which bug fired), and error-analysis content
 * for free.
 *
 * **Safety rule (M-16): mal-rule labels are internal.** There is deliberately no
 * `title` or `description` locale key on this type. Learner-facing feedback names
 * the correct idea, never the child's defect.
 */

import type { AnswerValue } from "./answer.ts";
import type { Exercise } from "./exercise.ts";
import type { FamilyId, MalRuleId, RepId } from "./ids.ts";

export type MalRule = {
  readonly id: MalRuleId;
  readonly family: FamilyId;
  /**
   * Parent rule, when several bugs share a root cause and should remediate
   * together (e.g. the two whole-number-bias fraction rules).
   */
  readonly parent?: MalRuleId;

  /**
   * Whether Stage-2 LOCATE is built for this rule. There is no generic "make the
   * contradiction self-evident" function, so this is true only where a
   * representation is genuinely load-bearing and the evidence base is real.
   * CG-22 requires `contrastRep` whenever this is true.
   */
  readonly locateCapable: boolean;
  readonly contrastRep?: RepId;

  /**
   * Whether the buggy procedure is even defined on this item. A rule that does not
   * apply is not evidence of anything, and CG-12 measures divergence only over
   * items where it does.
   */
  applies(exercise: Exercise): boolean;

  /**
   * Run the buggy procedure. Returns `null` when the procedure is undefined on this
   * item. Deliberately does **not** filter out outputs that happen to equal the
   * correct answer: that is what CG-12 measures, and self-filtering here would make
   * the gate pass by construction.
   */
  apply(exercise: Exercise): AnswerValue | null;
};
