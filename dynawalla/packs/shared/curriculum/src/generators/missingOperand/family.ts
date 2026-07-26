/**
 * `gen.arith.missing-operand` — the equals sign as a relation.
 *
 * The answer is always drawn first and the sentence is built around it, so no shape
 * can produce a negative unknown, a zero unknown, or a missing factor that does not
 * divide. Drawing the sentence and solving it would leave all three to chance, and
 * "the box is 0" is an item whose two documented mal-rules both coincide with the
 * correct answer.
 *
 * `both-sides` optionally carries the balance scale, whose pans hold the side that
 * is complete and the part of the other side that is already there. That is the
 * representation doing its job: the child sees two pans that do not balance and has
 * to say what makes them.
 */

import { mul, rational, add as ratAdd } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, RepSpec, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { LocKey } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { numberSlot } from "../shared/slots.ts";
import { drawBetween, drawWithDigits } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import {
  COEFF_DIGIT_OVER_TWO,
  FORM_OFFSET_FREE_ENTRY,
  MISSING_OPERAND_FAMILY,
  MISSING_OPERAND_FAMILY_REV,
  MISSING_OPERAND_FORMS,
  OFFSET_ADD_UNKNOWN,
  OFFSET_BOTH_SIDES,
  OFFSET_MUL_UNKNOWN,
  OFFSET_SUB_UNKNOWN,
  OFFSET_SUB_UNKNOWN_MINUEND,
  PROMPT_KEY_ADD_UNKNOWN,
  PROMPT_KEY_BOTH_SIDES,
  PROMPT_KEY_MUL_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN,
  PROMPT_KEY_SUB_UNKNOWN_MINUEND,
  REP_BALANCE_SCALE,
  SLOT_ANSWER,
  SLOT_KNOWN,
  SLOT_LEFT_A,
  SLOT_LEFT_B,
  SLOT_LEFT_TOTAL,
  SLOT_RIGHT_KNOWN,
  SLOT_TOTAL,
  SOLUTION_KEY_BALANCE_SIDES,
  SOLUTION_KEY_READ_RELATION,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_UNDO,
} from "./constants.ts";
import { missingOperandParamSchema } from "./params.ts";
import type { MissingOperandParams, SentenceShape } from "./params.ts";

const PROMPT_KEYS: Readonly<Record<SentenceShape, LocKey>> = {
  "add-unknown": PROMPT_KEY_ADD_UNKNOWN,
  "sub-unknown": PROMPT_KEY_SUB_UNKNOWN,
  "sub-unknown-minuend": PROMPT_KEY_SUB_UNKNOWN_MINUEND,
  "mul-unknown": PROMPT_KEY_MUL_UNKNOWN,
  "both-sides": PROMPT_KEY_BOTH_SIDES,
};

const SHAPE_OFFSETS: Readonly<Record<SentenceShape, Rational>> = {
  "add-unknown": OFFSET_ADD_UNKNOWN,
  "sub-unknown": OFFSET_SUB_UNKNOWN,
  "sub-unknown-minuend": OFFSET_SUB_UNKNOWN_MINUEND,
  "mul-unknown": OFFSET_MUL_UNKNOWN,
  "both-sides": OFFSET_BOTH_SIDES,
};

type Sentence = {
  readonly slots: Readonly<Record<string, PromptSlot>>;
  readonly answer: bigint;
  /** The complete side's total, on a `both-sides` item. */
  readonly leftTotal: bigint;
  readonly rightKnown: bigint;
};

/** A number written with exactly `digits` digits, or 1..9 at one digit. */
function drawNumber(digits: number, rng: Rng): bigint {
  return drawWithDigits(rng, digits);
}

function drawSentence(params: MissingOperandParams, rng: Rng): Sentence {
  const { shape, digits } = params;

  if (shape === "mul-unknown") {
    // Both factors are drawn and the product is formed, so the sentence always has
    // a whole-number answer and the child is never asked for a fraction in a box.
    const known = digits === 1 ? BigInt(rng.nextInt(2, 9)) : drawNumber(digits, rng);
    const answer = digits === 1 ? BigInt(rng.nextInt(2, 9)) : drawNumber(digits, rng);
    return {
      slots: { [SLOT_KNOWN]: numberSlot(known), [SLOT_TOTAL]: numberSlot(known * answer) },
      answer,
      leftTotal: known * answer,
      rightKnown: known,
    };
  }

  if (shape === "both-sides") {
    // The right-hand known part is drawn strictly below the left-hand total, so the
    // box is always a positive number.
    const leftA = drawNumber(digits, rng);
    const leftB = drawNumber(digits, rng);
    const leftTotal = leftA + leftB;
    const rightKnown = drawBetween(rng, 1n, leftTotal - 1n);
    return {
      slots: {
        [SLOT_LEFT_A]: numberSlot(leftA),
        [SLOT_LEFT_B]: numberSlot(leftB),
        [SLOT_RIGHT_KNOWN]: numberSlot(rightKnown),
      },
      answer: leftTotal - rightKnown,
      leftTotal,
      rightKnown,
    };
  }

  const known = drawNumber(digits, rng);
  const answer = drawNumber(digits, rng);

  if (shape === "add-unknown") {
    // `known + ☐ = total`
    return {
      slots: { [SLOT_KNOWN]: numberSlot(known), [SLOT_TOTAL]: numberSlot(known + answer) },
      answer,
      leftTotal: known + answer,
      rightKnown: known,
    };
  }
  if (shape === "sub-unknown") {
    // `known − ☐ = total`, so the number written first is the larger one.
    return {
      slots: { [SLOT_KNOWN]: numberSlot(known + answer), [SLOT_TOTAL]: numberSlot(known) },
      answer,
      leftTotal: known + answer,
      rightKnown: known,
    };
  }
  // `☐ − known = total`
  return {
    slots: { [SLOT_KNOWN]: numberSlot(known), [SLOT_TOTAL]: numberSlot(answer) },
    answer: known + answer,
    leftTotal: known + answer,
    rightKnown: known,
  };
}

function representationFor(params: MissingOperandParams, sentence: Sentence): RepSpec | undefined {
  if (!params.balance) return undefined;
  return {
    rep: REP_BALANCE_SCALE,
    // Whole units, both pans. The left pan holds the side that is complete; the
    // right holds what is already there. What is missing is the answer.
    params: { left: Number(sentence.leftTotal), right: Number(sentence.rightKnown) },
  };
}

function solutionFor(params: MissingOperandParams, sentence: Sentence): SolutionStep[] {
  const steps: SolutionStep[] = [{ key: SOLUTION_KEY_READ_RELATION, slots: {} }];

  if (params.shape === "both-sides") {
    steps.push({
      key: SOLUTION_KEY_BALANCE_SIDES,
      slots: {
        [SLOT_LEFT_TOTAL]: numberSlot(sentence.leftTotal),
        [SLOT_RIGHT_KNOWN]: numberSlot(sentence.rightKnown),
      },
    });
  }
  steps.push({
    key: SOLUTION_KEY_UNDO,
    slots: { [SLOT_ANSWER]: numberSlot(sentence.answer) },
  });
  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: numberSlot(sentence.answer) } });
  return steps;
}

function answerCapacity(params: MissingOperandParams): number {
  // One wider than the numbers on the card: `☐ − 47 = 68` has a three-digit answer
  // and a field that could not hold it would say so.
  return params.shape === "mul-unknown" ? params.digits : params.digits + 1;
}

export const missingOperandFamily: GeneratorFamily<MissingOperandParams> = {
  family: MISSING_OPERAND_FAMILY,
  familyRev: MISSING_OPERAND_FAMILY_REV,
  paramSchema: missingOperandParamSchema,
  forms: MISSING_OPERAND_FORMS,
  choiceOnly: false,
  representations: [REP_BALANCE_SCALE],

  answerSchema(params: MissingOperandParams): AnswerSchema {
    return { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 };
  },

  difficultyOffset(params: MissingOperandParams): Rational {
    const b = mul(COEFF_DIGIT_OVER_TWO, rational(BigInt(params.digits - 2)));
    return ratAdd(b, SHAPE_OFFSETS[params.shape]);
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<MissingOperandParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(MISSING_OPERAND_FAMILY, MISSING_OPERAND_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));

    const form = chooseForm(forms, MISSING_OPERAND_FORMS, rng);
    const sentence = drawSentence(params, rng);
    if (sentence.answer <= 0n) {
      throw new InfeasibleLevelError(`the unknown is not positive on ${exerciseId}`);
    }

    const representation = representationFor(params, sentence);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: MISSING_OPERAND_FAMILY,
      familyRev: MISSING_OPERAND_FAMILY_REV,
      form,
      prompt: { key: PROMPT_KEYS[params.shape], slots: sentence.slots },
      ...(representation === undefined ? {} : { representation }),
      schema: { kind: "integer", digits: answerCapacity(params), decimalPlaces: 0 },
      answer: { canonical: { kind: "integer", value: rational(sentence.answer) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, sentence),
    };

    return { ...base, distractors: distractorsFor(MISSING_OPERAND_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
