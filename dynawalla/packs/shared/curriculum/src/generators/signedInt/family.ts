/**
 * `gen.arith.signed-int` — arithmetic below zero. The pre-algebra on-ramp.
 *
 * ## What is new here, and it is one thing
 *
 * Every answer in this program before now was at or above zero, and every gate,
 * sweep and renderer declaration quietly assumed it. This family is the first that
 * cannot, so it carries the first `AnswerSchema.integer.signed`, and that flag is
 * not decoration: a keypad with no minus key on `(−7) + 4` draws a card that looks
 * answerable and marks a correct child wrong, which is worse than the blank screen
 * CG-8 usually catches. `answer:integer-signed` is a separate renderer id for
 * exactly that reason.
 *
 * ## What it does not do
 *
 * **No number line.** The number line is the right representation for integers and
 * it is not declared here, because nothing in this repository draws a
 * representation. A row whose question is a picture nobody draws is a blank card,
 * and `−3` is a complete question written as numerals; a line would have been a
 * scaffold, not the content. `REP_NUMBER_LINE` is registered and unimplemented, and
 * the day it is drawn these rows gain it as `optional` without a new id.
 *
 * **No division.** `(−48) ÷ 6` follows the same sign rule as the multiplication
 * here and would need an exact-division draw to avoid posing a fraction by
 * accident. It is a row this family can carry the day someone wants it, not a gap
 * in what it teaches.
 *
 * **No mal-rules.** The evidence base for sign errors is real — the
 * over-generalised "two negatives make a positive" applied to an addition is the
 * one every teacher can name — but this program's rule is that a mal-rule is a
 * *documented* buggy procedure with a citation behind it, and `README.md` forbids
 * inventing one outright. The rows declare `misconceptions: []`, the items carry
 * no distractors, and a wrong answer routes to the worked example. That is the
 * honest outcome, and the rung it routes to is the one that names the rule.
 */

import { mul as ratMul, rational, add as ratAdd, sub as ratSub, eq as ratEq } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { countSlot, numberSlot } from "../shared/slots.ts";
import {
  COEFF_BOTH_NEGATIVE,
  COEFF_FIRST_NEGATIVE,
  COEFF_MAGNITUDE_OVER_ROOT,
  COEFF_MULTIPLICATION,
  COEFF_SECOND_NEGATIVE,
  COEFF_SUBTRACTION,
  FORM_OFFSET_FREE_ENTRY,
  PROMPT_KEY_ADD,
  PROMPT_KEY_MUL,
  PROMPT_KEY_SUB,
  ROOT_MAGNITUDE,
  SIGNED_INT_FAMILY,
  SIGNED_INT_FAMILY_REV,
  SIGNED_INT_FORMS,
  SLOT_ANSWER,
  SLOT_FIRST,
  SLOT_LARGER,
  SLOT_NEGATIVES,
  SLOT_OPPOSITE,
  SLOT_PAST,
  SLOT_SECOND,
  SLOT_SIZE,
  SLOT_SMALLER,
  SOLUTION_KEY_ADD_THE_OPPOSITE,
  SOLUTION_KEY_DIFFERENT_SIGNS,
  SOLUTION_KEY_PAST_ZERO,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SAME_SIGNS,
  SOLUTION_KEY_SIGN_RULE,
} from "./constants.ts";
import { pairSet } from "./pairs.ts";
import type { Pair } from "./pairs.ts";
import { signedIntParamSchema } from "./params.ts";
import type { SignedIntParams } from "./params.ts";

const PROMPT_KEYS = {
  add: PROMPT_KEY_ADD,
  sub: PROMPT_KEY_SUB,
  mul: PROMPT_KEY_MUL,
} as const;

/** `|n|`, on a plain number. */
function magnitude(value: number): number {
  return value < 0 ? -value : value;
}

/**
 * The answer field's width, which is the *level's* width and never this item's.
 *
 * The sign is not a digit — `−144` is three digits and a minus — so the width is
 * read off the largest magnitude the level can reach and the schema's `signed`
 * flag carries the rest. A field cut to this item would say how big the answer is,
 * and on a level whose answers straddle zero it would also say which side of it.
 */
function answerDigits(params: SignedIntParams): number {
  const widest = params.op === "mul" ? params.maxMagnitude * params.maxMagnitude : 2 * params.maxMagnitude;
  return String(widest).length;
}

function schemaFor(params: SignedIntParams): AnswerSchema {
  return { kind: "integer", digits: answerDigits(params), decimalPlaces: 0, signed: true };
}

/** The exact answer, in integers. The item's whole arithmetic, in one place. */
function resultOf(op: SignedIntParams["op"], pair: Pair): number {
  switch (op) {
    case "add":
      return pair.first + pair.second;
    case "sub":
      return pair.first - pair.second;
    case "mul":
      return pair.first * pair.second;
  }
}

/**
 * The hint ladder. Read the item, name the move, state the answer — with a fourth
 * rung on subtraction, because subtraction has two moves.
 *
 * The middle rungs are the strategy and never a restatement of the arithmetic:
 *
 * - **`3 − 9`** counts down to zero and then past it. Not "add the opposite":
 *   a child meeting a negative answer for the first time has no opposite to add
 *   yet, and the thing they need is that the count carries on below zero.
 * - **Every other subtraction** turns into an addition first — `7 − (−4)` is
 *   `7 + 4` — and then takes the addition rung it became. Two rungs, because that
 *   is two moves, and a ladder that did both in one step would hide the move the
 *   row exists to teach.
 * - **Addition** splits on whether the signs agree. Alike: add the sizes, keep the
 *   sign. Unlike: take the smaller size from the larger and keep the larger's sign.
 * - **Multiplication** multiplies the sizes and then counts the minus signs. One
 *   rung, one key, and the count is a `count` slot so the template's plural turns
 *   on it: "one minus sign" and "two minus signs" are one sentence in English and
 *   two in several launch locales.
 */
function solutionFor(params: SignedIntParams, pair: Pair): SolutionStep[] {
  const answer = resultOf(params.op, pair);
  const read: SolutionStep = {
    key: SOLUTION_KEY_READ,
    slots: {
      [SLOT_FIRST]: numberSlot(BigInt(pair.first)),
      [SLOT_SECOND]: numberSlot(BigInt(pair.second)),
    },
  };
  const result: SolutionStep = {
    key: SOLUTION_KEY_RESULT,
    slots: { [SLOT_ANSWER]: numberSlot(BigInt(answer)) },
  };

  if (params.op === "mul") {
    const negatives = (pair.first < 0 ? 1 : 0) + (pair.second < 0 ? 1 : 0);
    return [
      read,
      {
        key: SOLUTION_KEY_SIGN_RULE,
        slots: {
          [SLOT_SIZE]: numberSlot(BigInt(magnitude(pair.first) * magnitude(pair.second))),
          [SLOT_NEGATIVES]: countSlot(negatives),
        },
      },
      result,
    ];
  }

  if (params.op === "sub" && params.negatives === "none") {
    return [
      read,
      {
        key: SOLUTION_KEY_PAST_ZERO,
        slots: {
          [SLOT_FIRST]: numberSlot(BigInt(pair.first)),
          [SLOT_PAST]: countSlot(pair.second - pair.first),
        },
      },
      result,
    ];
  }

  // From here the item is an addition, either because it was one or because the
  // rung above turned it into one. `addend` is what is really being added.
  const addend = params.op === "sub" ? -pair.second : pair.second;
  const steps: SolutionStep[] = [read];
  if (params.op === "sub") {
    steps.push({
      key: SOLUTION_KEY_ADD_THE_OPPOSITE,
      slots: {
        [SLOT_SECOND]: numberSlot(BigInt(pair.second)),
        [SLOT_OPPOSITE]: numberSlot(BigInt(addend)),
      },
    });
  }

  // The two sizes, always larger first — on both rungs, and not only on the one
  // that subtracts them. "Add the larger and the smaller" is the same sentence
  // whichever order the card wrote them in, and a slot called `larger` that
  // sometimes holds the smaller is a template waiting to be translated wrongly.
  const bigger = magnitude(pair.first) >= magnitude(addend) ? magnitude(pair.first) : magnitude(addend);
  const smaller = magnitude(pair.first) >= magnitude(addend) ? magnitude(addend) : magnitude(pair.first);
  steps.push({
    key: pair.first < 0 === addend < 0 ? SOLUTION_KEY_SAME_SIGNS : SOLUTION_KEY_DIFFERENT_SIGNS,
    slots: {
      [SLOT_LARGER]: numberSlot(BigInt(bigger)),
      [SLOT_SMALLER]: numberSlot(BigInt(smaller)),
    },
  });

  steps.push(result);
  return steps;
}

export const signedIntFamily: GeneratorFamily<SignedIntParams> = {
  family: SIGNED_INT_FAMILY,
  familyRev: SIGNED_INT_FAMILY_REV,
  paramSchema: signedIntParamSchema,
  forms: SIGNED_INT_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: SignedIntParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: SignedIntParams): Rational {
    let b = ratMul(COEFF_MAGNITUDE_OVER_ROOT, rational(BigInt(params.maxMagnitude - ROOT_MAGNITUDE)));
    if (params.op === "sub") b = ratAdd(b, COEFF_SUBTRACTION);
    if (params.op === "mul") b = ratAdd(b, COEFF_MULTIPLICATION);
    if (params.negatives === "first") b = ratAdd(b, COEFF_FIRST_NEGATIVE);
    if (params.negatives === "second") b = ratAdd(b, COEFF_SECOND_NEGATIVE);
    if (params.negatives === "both") b = ratAdd(b, COEFF_BOTH_NEGATIVE);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<SignedIntParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(SIGNED_INT_FAMILY, SIGNED_INT_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));
    const form = chooseForm(forms, SIGNED_INT_FORMS, rng);

    const pairs = pairSet(params);
    if (pairs.length === 0) {
      // The schema rejects every combination that empties the set, so reaching
      // here is a disagreement between the validator and the enumeration — the one
      // bug class a family of this shape is most likely to have.
      throw new InfeasibleLevelError(`no pair satisfies the parameters of ${exerciseId}`);
    }
    const pair = rng.pick(pairs);
    const answer = resultOf(params.op, pair);

    // Integer arithmetic and exact rational arithmetic agree, asserted on every
    // call. This is where a sign error in the family itself would be caught, and it
    // is worth the two multiplications: an answer whose sign is wrong is wrong
    // identically on every device and no test that re-ran `resultOf` would see it.
    const left = rational(BigInt(pair.first));
    const right = rational(BigInt(pair.second));
    const exact =
      params.op === "add" ? ratAdd(left, right) : params.op === "sub" ? ratSub(left, right) : ratMul(left, right);
    if (!ratEq(exact, rational(BigInt(answer)))) {
      throw new InfeasibleLevelError(`signed arithmetic disagreed with exact arithmetic on ${exerciseId}`);
    }

    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: SIGNED_INT_FAMILY,
      familyRev: SIGNED_INT_FAMILY_REV,
      form,
      prompt: {
        key: PROMPT_KEYS[params.op],
        slots: {
          [SLOT_FIRST]: numberSlot(BigInt(pair.first)),
          [SLOT_SECOND]: numberSlot(BigInt(pair.second)),
        },
      },
      schema: schemaFor(params),
      answer: { canonical: { kind: "integer", value: rational(BigInt(answer)) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, pair),
    };

    return { ...base, distractors: distractorsFor(SIGNED_INT_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
