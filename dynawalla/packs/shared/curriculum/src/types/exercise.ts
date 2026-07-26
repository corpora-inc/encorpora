/**
 * The exercise contract (CURRICULUM.md, "three non-negotiables").
 *
 * 1. Exact rational arithmetic only — see `answer.ts`.
 * 2. Seeded, pure, platform-stable — see `../rng/rng.ts`.
 * 3. Structured prompts, never rendered strings — `PromptSpec` below. One template
 *    key translated once serves every seeded instance forever, so localization cost
 *    scales with template count instead of content volume (gate CG-19).
 */

import type { Rational } from "../math/rational.ts";
import type { AnswerSchema, AnswerValue } from "./answer.ts";
import type { ExerciseId, FamilyId, FormId, LocKey, MalRuleId, RepId, SkillId } from "./ids.ts";

/**
 * A prompt slot. Never a rendered string.
 *
 * `number` carries the exact value plus how many decimal places the *problem* is
 * written to, because `1.50` and `1.5` are the same number and different notation,
 * and the number layer needs the notation. `count` is separate from `number`
 * because it selects a CLDR plural category (CG-14).
 */
export type PromptSlot =
  | { readonly kind: "number"; readonly value: Rational; readonly decimalPlaces: number }
  | { readonly kind: "count"; readonly value: number }
  | { readonly kind: "term"; readonly key: LocKey };

export type PromptSpec = {
  readonly key: LocKey;
  readonly slots: Readonly<Record<string, PromptSlot>>;
};

export type RepSpec = {
  readonly rep: RepId;
  readonly params: Readonly<Record<string, number>>;
};

export type SolutionStep = {
  readonly key: LocKey;
  readonly slots: Readonly<Record<string, PromptSlot>>;
  /** Column this step acts on, units = 0. Lets a renderer highlight in place. */
  readonly focusColumn?: number;
};

export type Distractor = {
  readonly value: AnswerValue;
  /** Which buggy procedure produced it. Internal only — never shown to a child (M-16). */
  readonly misconception?: MalRuleId;
};

export type CheckSpec =
  /** Exact structural equality against `canonical` or one of `alsoAccept`. */
  | { readonly kind: "exact" }
  /** Exact-rational tolerance band. Still no floats: the tolerance is a rational. */
  | { readonly kind: "tolerance"; readonly tolerance: Rational };

export type Exercise = {
  readonly exerciseId: ExerciseId;
  readonly skillId: SkillId;
  readonly level: number;
  readonly seed: number;
  readonly family: FamilyId;
  readonly familyRev: number;
  /**
   * Which interaction form this instance took. Not in the doc's sketch of
   * `Exercise`, but the fact-memory layer keys cards on
   * `skill:<id>#L<level>#<formId>` (ADR-0008), so the form has to be recoverable
   * from the item that was served.
   */
  readonly form: FormId;
  readonly prompt: PromptSpec;
  readonly representation?: RepSpec;
  /** The schema the work surface must render and `judge` must interpret. */
  readonly schema: AnswerSchema;
  readonly answer: {
    readonly canonical: AnswerValue;
    readonly alsoAccept: readonly AnswerValue[];
  };
  readonly distractors: readonly Distractor[];
  readonly check: CheckSpec;
  readonly solution: readonly SolutionStep[];
};
