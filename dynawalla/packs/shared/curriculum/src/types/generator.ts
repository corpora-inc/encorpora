/**
 * The generator-family contract.
 *
 * A family owns its parameter schema, its difficulty contribution, its generation
 * and its checker. Difficulty is *parameters*, not families: `column-op` with
 * `{ op, digits, regroupings, acrossZero, decimalPlaces }` spans 2-digit addition
 * through decimal subtraction, which is why V1 needs 18 families and not 60.
 */

import type { Rational } from "../math/rational.ts";
import type { AnswerSchema, AnswerValue } from "./answer.ts";
import type { Exercise } from "./exercise.ts";
import type { FamilyId, FormId, MalRuleId, RepId, SkillId } from "./ids.ts";

export type ParamIssue = {
  readonly path: string;
  readonly message: string;
};

export type ParamResult<P> =
  | { readonly ok: true; readonly value: P }
  | { readonly ok: false; readonly issues: readonly ParamIssue[] };

export type ParamSchema<P> = {
  /** Human-readable shape, printed by the validator when a binding is rejected. */
  readonly describe: string;
  validate(raw: unknown): ParamResult<P>;
};

export type GenerateRequest<P> = {
  readonly skillId: SkillId;
  readonly level: number;
  readonly seed: number;
  readonly params: P;
  /** The binding's allowed forms; the family picks one deterministically. */
  readonly forms: readonly FormId[];
};

export type Verdict =
  | { readonly correct: true }
  | { readonly correct: false; readonly misconception?: MalRuleId };

export type GeneratorFamily<P> = {
  readonly family: FamilyId;
  /**
   * Bumped whenever generated output changes. CG-16 keys its committed output
   * hashes on this, so changing output without bumping it is a CI failure (M-08).
   */
  readonly familyRev: number;
  readonly paramSchema: ParamSchema<P>;
  /** Every form this family can emit. */
  readonly forms: readonly FormId[];
  /** True when *every* form is a closed-list choice. Read by CG-13. */
  readonly choiceOnly: boolean;
  /** Representations this family can attach to an item. */
  readonly representations: readonly RepId[];

  answerSchema(params: P, form: FormId): AnswerSchema;
  /**
   * The parameter-derived part of `b`. Form and representation offsets are added
   * separately so a level's difficulty does not depend on which form a seed drew.
   */
  difficultyOffset(params: P): Rational;
  formOffset(form: FormId): Rational;

  generate(request: GenerateRequest<P>): Exercise;
  check(exercise: Exercise, submitted: AnswerValue): Verdict;
};

/** A family with its parameter type erased, for registries and gates. */
export type AnyGeneratorFamily = GeneratorFamily<never> & {
  readonly paramSchema: ParamSchema<unknown>;
  answerSchema(params: unknown, form: FormId): AnswerSchema;
  difficultyOffset(params: unknown): Rational;
  generate(request: GenerateRequest<unknown>): Exercise;
};

/** Erase the parameter type. Safe because the schema validates before every call. */
export function erase<P>(family: GeneratorFamily<P>): AnyGeneratorFamily {
  return family as unknown as AnyGeneratorFamily;
}
