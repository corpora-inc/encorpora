/**
 * `gen.frac.equivalence-simplify` — the same number, written another way.
 *
 * Simplifying, building an equivalent fraction, and moving between improper and
 * mixed notation are one family because they are one idea, and because the item
 * that exposes the misconception in the fourth task is built out of the third.
 *
 * **Every answer is `as-written`, and that is the whole point.** On a
 * simplification item, `2/4` is the *question*; accepting it as an answer would
 * mark the thing being taught correct. `AnswerSchema.fraction.equivalence` exists
 * so that this decision is written on the schema a renderer and a checker both see,
 * rather than living in a comment.
 *
 * The answer's value is checked against the presented fraction's value with exact
 * rational arithmetic on every call: a rewriting that changed the number is the one
 * bug this family could have, and it cannot be served.
 */

import { eq as rationalEq, mul, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { LocKey } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { fractionSlot, numberSlot } from "../shared/slots.ts";
import { drawBetween, drawBetweenExcluding } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { MIXED_PARTS, PROPER_PARTS, fractionAnswer, fractionSchema, reduce, valueOf } from "../shared/fractions.ts";
import type { WrittenFraction } from "../shared/fractions.ts";
import {
  COEFF_DENOMINATOR,
  COEFF_FACTOR,
  COEFF_TO_MIXED,
  COEFF_WHOLE_PART,
  FORM_OFFSET_FREE_ENTRY,
  FRAC_EQUIVALENCE_FAMILY,
  FRAC_EQUIVALENCE_FAMILY_REV,
  FRAC_EQUIVALENCE_FORMS,
  PROMPT_KEY_BUILD,
  PROMPT_KEY_SIMPLIFY,
  PROMPT_KEY_TO_IMPROPER,
  PROMPT_KEY_TO_MIXED,
  SLOT_ANSWER,
  SLOT_DENOMINATOR,
  SLOT_FACTOR,
  SLOT_FRACTION,
  SLOT_WHOLE,
  SOLUTION_KEY_COMMON_FACTOR,
  SOLUTION_KEY_DIVIDE_OUT,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SCALE,
  SOLUTION_KEY_WHOLES_IN,
} from "./constants.ts";
import { fracEquivalenceParamSchema } from "./params.ts";
import type { EquivalenceTask, FracEquivalenceParams } from "./params.ts";

const PROMPT_KEYS: Readonly<Record<EquivalenceTask, LocKey>> = {
  simplify: PROMPT_KEY_SIMPLIFY,
  build: PROMPT_KEY_BUILD,
  "to-mixed": PROMPT_KEY_TO_MIXED,
  "to-improper": PROMPT_KEY_TO_IMPROPER,
};

type Item = {
  /** What is written on the card. */
  readonly shown: WrittenFraction;
  /** What the child writes. */
  readonly answer: WrittenFraction;
  /** The scaling factor between the two, where there is one. */
  readonly factor: bigint;
  /** The target denominator, on a `build` item. */
  readonly target: bigint;
};

/** A written fraction, whole part and all. */
function writtenSlot(written: WrittenFraction): PromptSlot {
  return fractionSlot(written.num, written.den, written.whole);
}

/**
 * A reduced proper fraction whose denominator leaves room to be scaled up.
 *
 * Drawn as any proper fraction and then reduced, rather than by rejecting until the
 * draw happens to be in lowest terms: a rejection loop's draw count depends on what
 * it rejected, and every later value in the item would move with it.
 */
function drawReducedBase(maxDenominator: number, rng: Rng): { num: bigint; den: bigint } {
  const den = drawBetween(rng, 2n, BigInt(maxDenominator) / 2n);
  const num = drawBetween(rng, 1n, den - 1n);
  return reduce(num, den);
}

function drawItem(params: FracEquivalenceParams, rng: Rng): Item {
  const ceiling = BigInt(params.maxDenominator);

  if (params.task === "simplify" || params.task === "build") {
    const base = drawReducedBase(params.maxDenominator, rng);
    const factorCeiling = ceiling / base.den;
    if (factorCeiling < 2n) throw new InfeasibleLevelError("no room to scale this fraction up");
    const factor = drawBetween(rng, 2n, factorCeiling > BigInt(params.maxFactor) ? BigInt(params.maxFactor) : factorCeiling);
    const scaled: WrittenFraction = { whole: 0n, num: base.num * factor, den: base.den * factor };
    const reduced: WrittenFraction = { whole: 0n, num: base.num, den: base.den };

    return params.task === "simplify"
      ? { shown: scaled, answer: reduced, factor, target: base.den }
      : { shown: reduced, answer: scaled, factor, target: base.den * factor };
  }

  // Improper and mixed. The denominator ten is excluded from the `to-improper`
  // draw: with a single-digit numerator, writing the whole part in front of the
  // numerator *is* multiplying by ten, so the concatenation bug would produce the
  // correct answer and the item could not tell the two apart.
  const den =
    params.task === "to-improper"
      ? drawBetweenExcluding(rng, 2n, ceiling, 10n)
      : drawBetween(rng, 2n, ceiling);
  const whole = drawBetween(rng, 1n, BigInt(params.maxWhole));
  const num = drawBetween(rng, 1n, den - 1n);

  const mixed: WrittenFraction = { whole, num, den };
  const improper: WrittenFraction = { whole: 0n, num: whole * den + num, den };

  return params.task === "to-mixed"
    ? { shown: improper, answer: mixed, factor: 1n, target: den }
    : { shown: mixed, answer: improper, factor: 1n, target: den };
}

function schemaFor(params: FracEquivalenceParams): AnswerSchema {
  return params.task === "to-mixed"
    ? fractionSchema(MIXED_PARTS, "as-written")
    : fractionSchema(PROPER_PARTS, "as-written");
}

function promptSlots(task: EquivalenceTask, item: Item): Record<string, PromptSlot> {
  return task === "build"
    ? { [SLOT_FRACTION]: writtenSlot(item.shown), [SLOT_DENOMINATOR]: numberSlot(item.target) }
    : { [SLOT_FRACTION]: writtenSlot(item.shown) };
}

function solutionFor(task: EquivalenceTask, item: Item): SolutionStep[] {
  const steps: SolutionStep[] = [];

  if (task === "simplify") {
    steps.push({
      key: SOLUTION_KEY_COMMON_FACTOR,
      slots: { [SLOT_FRACTION]: writtenSlot(item.shown), [SLOT_FACTOR]: numberSlot(item.factor) },
    });
    steps.push({ key: SOLUTION_KEY_DIVIDE_OUT, slots: { [SLOT_ANSWER]: writtenSlot(item.answer) } });
  } else if (task === "build") {
    steps.push({
      key: SOLUTION_KEY_SCALE,
      slots: {
        [SLOT_FRACTION]: writtenSlot(item.shown),
        [SLOT_FACTOR]: numberSlot(item.factor),
        [SLOT_DENOMINATOR]: numberSlot(item.target),
      },
    });
  } else {
    const mixed = task === "to-mixed" ? item.answer : item.shown;
    steps.push({
      key: SOLUTION_KEY_WHOLES_IN,
      slots: {
        [SLOT_WHOLE]: numberSlot(mixed.whole),
        [SLOT_DENOMINATOR]: numberSlot(mixed.den),
        [SLOT_FRACTION]: writtenSlot(task === "to-mixed" ? item.shown : item.answer),
      },
    });
  }

  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: writtenSlot(item.answer) } });
  return steps;
}

export const fracEquivalenceFamily: GeneratorFamily<FracEquivalenceParams> = {
  family: FRAC_EQUIVALENCE_FAMILY,
  familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
  paramSchema: fracEquivalenceParamSchema,
  forms: FRAC_EQUIVALENCE_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: FracEquivalenceParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: FracEquivalenceParams): Rational {
    let b = mul(COEFF_DENOMINATOR, rational(BigInt(params.maxDenominator)));
    b = ratAdd(b, mul(COEFF_FACTOR, rational(BigInt(params.maxFactor - 1))));
    if (params.task === "to-mixed" || params.task === "to-improper") b = ratAdd(b, COEFF_WHOLE_PART);
    if (params.task === "to-mixed") b = ratAdd(b, COEFF_TO_MIXED);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<FracEquivalenceParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(FRAC_EQUIVALENCE_FAMILY, FRAC_EQUIVALENCE_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, FRAC_EQUIVALENCE_FORMS, rng);
    const item = drawItem(params, rng);

    // A rewriting that changed the number is this family's one possible bug.
    if (!rationalEq(valueOf(item.shown), valueOf(item.answer))) {
      throw new InfeasibleLevelError(`the rewriting changed the number on ${exerciseId}`);
    }
    if (item.shown.num === item.answer.num && item.shown.den === item.answer.den) {
      throw new InfeasibleLevelError(`nothing to rewrite on ${exerciseId}`);
    }

    const schema = schemaFor(params);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: FRAC_EQUIVALENCE_FAMILY,
      familyRev: FRAC_EQUIVALENCE_FAMILY_REV,
      form,
      prompt: { key: PROMPT_KEYS[params.task], slots: promptSlots(params.task, item) },
      schema,
      answer: { canonical: fractionAnswer(item.answer), alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params.task, item),
    };

    return { ...base, distractors: distractorsFor(FRAC_EQUIVALENCE_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
