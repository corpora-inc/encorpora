/**
 * `gen.frac.arith` — adding, subtracting and multiplying fractions.
 *
 * Three properties are guaranteed by construction rather than by filtering, because
 * each of them is a way for a fraction item to be degenerate:
 *
 * - **A difference is never negative and never zero.** The two operands are ordered
 *   after they are drawn, and equal values are excluded before that.
 * - **A result is never a whole number.** `1/2 + 1/2` written as an answer is
 *   `1/1`, which is a fraction entry holding a number nobody writes that way.
 * - **A whole multiplier is never one.** Multiplying by one is the item on which
 *   the scale-both-parts bug produces the right answer.
 *
 * The result is computed with `Rational` and then written back out as a numerator
 * over a denominator, and the written answer's value is compared to the exact one
 * on every call.
 */

import {
  cmp,
  eq as rationalEq,
  mul,
  add as ratAdd,
  mul as ratMul,
  sub as ratSub,
  rational,
} from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { Rng } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { fractionSlot, numberSlot } from "../shared/slots.ts";
import { drawBetween, drawBetweenExcluding } from "../shared/draw.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { PROPER_PARTS, fractionAnswer, fractionSchema, lcm, reduce } from "../shared/fractions.ts";
import {
  COEFF_DENOMINATOR,
  COEFF_LOWEST_TERMS,
  COEFF_MULTIPLE,
  COEFF_UNLIKE,
  COEFF_WHOLE_MULTIPLIER,
  FORM_OFFSET_FREE_ENTRY,
  FRAC_ARITH_FAMILY,
  FRAC_ARITH_FAMILY_REV,
  FRAC_ARITH_FORMS,
  PROMPT_KEY_ADD,
  PROMPT_KEY_MUL,
  PROMPT_KEY_MUL_WHOLE,
  PROMPT_KEY_SUB,
  SLOT_ANSWER,
  SLOT_COMBINED,
  SLOT_DENOMINATOR,
  SLOT_LEFT,
  SLOT_LEFT_SCALED,
  SLOT_RIGHT,
  SLOT_RIGHT_SCALED,
  SOLUTION_KEY_COMBINE,
  SOLUTION_KEY_COMMON_DENOMINATOR,
  SOLUTION_KEY_MULTIPLY_PARTS,
  SOLUTION_KEY_RESTATE,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SIMPLIFY,
} from "./constants.ts";
import { fracArithParamSchema } from "./params.ts";

/**
 * Bounds the deterministic retry loop that rejects degenerate draws — the same
 * device `gen.arith.column-op` uses for `a − a = 0`. A whole-number result is the
 * only draw this family rejects, it is rare, and the attempt index is part of the
 * seed material so a retry is as reproducible as a first try.
 */
const MAX_GENERATE_ATTEMPTS = 32;
import type { DenominatorRelation, FracArithParams } from "./params.ts";

type Term = { readonly num: bigint; readonly den: bigint };

type Draw = {
  readonly left: Term;
  readonly right: Term;
  /** True when the right operand is a whole number written without a denominator. */
  readonly rightIsWhole: boolean;
};

/** A proper fraction operand. A whole operand is a `numberSlot`, not a `x/1`. */
function termSlot(term: Term): PromptSlot {
  return fractionSlot(term.num, term.den);
}

function valueOfTerm(term: Term): Rational {
  return rational(term.num, term.den);
}

/**
 * A second denominator standing in the requested relation to the first.
 *
 * The `unlike` case walks forward from the drawn value until neither denominator
 * divides the other, rather than drawing again: a redraw would consume a different
 * number of `Rng` values on different seeds and every later quantity in the item
 * would move with it. The walk is bounded by the ceiling and consumes nothing.
 */
function secondDenominator(first: bigint, relation: DenominatorRelation, ceiling: bigint, rng: Rng): bigint {
  if (relation === "like") return first;
  if (relation === "multiple") {
    const factorCeiling = ceiling / first;
    if (factorCeiling < 2n) throw new InfeasibleLevelError("no multiple of this denominator fits under the ceiling");
    return first * drawBetween(rng, 2n, factorCeiling);
  }
  const drawn = drawBetween(rng, 2n, ceiling);
  for (let step = 0n; step < ceiling; step++) {
    const candidate = ((drawn - 2n + step) % (ceiling - 1n)) + 2n;
    if (candidate % first !== 0n && first % candidate !== 0n) return candidate;
  }
  throw new InfeasibleLevelError("no denominator under the ceiling is coprime enough for an unlike pair");
}

function drawAddSub(params: Extract<FracArithParams, { op: "add" | "sub" }>, rng: Rng): Draw {
  const ceiling = BigInt(params.maxDenominator);
  // A `multiple` pair needs room above the first denominator for a second one.
  const firstCeiling = params.denominators === "multiple" ? ceiling / 2n : ceiling;
  // Halves hold exactly one proper fraction, so `a/2 ± b/2` is `1/2 ± 1/2` and
  // nothing else — a zero difference or a whole sum, and the same item every time.
  // A like-denominator level therefore starts at thirds. (The other two relations
  // are safe at two: `unlike` excludes every denominator that divides the first,
  // and `multiple` puts the larger denominator on the right.)
  const firstFloor = params.denominators === "like" ? 3n : 2n;
  const leftDen = drawBetween(rng, firstFloor, firstCeiling);
  const rightDen = secondDenominator(leftDen, params.denominators, ceiling, rng);

  const leftNum = drawBetween(rng, 1n, leftDen - 1n);
  // Never the numerator that makes the two operands equal: a zero difference is a
  // fraction entry holding nothing, and a doubled sum is a different question.
  const equalNumerator = (leftNum * rightDen) % leftDen === 0n ? (leftNum * rightDen) / leftDen : null;
  const rightNum =
    equalNumerator === null || equalNumerator < 1n || equalNumerator > rightDen - 1n
      ? drawBetween(rng, 1n, rightDen - 1n)
      : drawBetweenExcluding(rng, 1n, rightDen - 1n, equalNumerator);

  const left: Term = { num: leftNum, den: leftDen };
  const right: Term = { num: rightNum, den: rightDen };
  if (params.op === "add") return { left, right, rightIsWhole: false };

  // Subtraction: the larger operand is written first, so the difference is
  // positive without the level ever posing a negative answer.
  return cmp(valueOfTerm(left), valueOfTerm(right)) > 0
    ? { left, right, rightIsWhole: false }
    : { left: right, right: left, rightIsWhole: false };
}

function drawMul(params: Extract<FracArithParams, { op: "mul" }>, rng: Rng): Draw {
  const ceiling = BigInt(params.maxDenominator);
  const leftDen = drawBetween(rng, 2n, ceiling);
  const leftNum = drawBetween(rng, 1n, leftDen - 1n);
  const left: Term = { num: leftNum, den: leftDen };

  if (params.wholeMultiplier) {
    // Never one: `2/3 × 1` is the one product on which scaling both parts of the
    // fraction gives the correct answer.
    const whole = drawBetween(rng, 2n, BigInt(params.maxWhole));
    return { left, right: { num: whole, den: 1n }, rightIsWhole: true };
  }

  const rightDen = drawBetween(rng, 2n, ceiling);
  const rightNum = drawBetween(rng, 1n, rightDen - 1n);
  return { left, right: { num: rightNum, den: rightDen }, rightIsWhole: false };
}

function exactResult(params: FracArithParams, draw: Draw): Rational {
  const left = valueOfTerm(draw.left);
  const right = valueOfTerm(draw.right);
  switch (params.op) {
    case "add":
      return ratAdd(left, right);
    case "sub":
      return ratSub(left, right);
    case "mul":
      return ratMul(left, right);
  }
}

function promptKeyFor(params: FracArithParams, draw: Draw): typeof PROMPT_KEY_ADD {
  if (params.op === "add") return PROMPT_KEY_ADD;
  if (params.op === "sub") return PROMPT_KEY_SUB;
  return draw.rightIsWhole ? PROMPT_KEY_MUL_WHOLE : PROMPT_KEY_MUL;
}

function schemaFor(params: FracArithParams): AnswerSchema {
  // `lowestTerms` selects what counts as the same answer. A level about adding
  // fifths accepts any correct writing; a level whose goal includes simplifying
  // does not, or it marks the step that was skipped correct.
  return fractionSchema(PROPER_PARTS, params.lowestTerms ? "as-written" : "any-equivalent");
}

/**
 * The hint ladder, and the rung that used to be missing.
 *
 * Every rung has to follow from the one above it. The combining rung writes the
 * result over the common denominator — `4/6` — and the final rung states the
 * canonical answer, which `generate()` always reduces — `2/3`. Where those two
 * differ there is a step, and the ladder says what it is.
 *
 * That rung used to be gated on `params.lowestTerms`, which is the wrong question.
 * `lowestTerms` decides what the *checker accepts*, not what the walkthrough has to
 * explain, and on a level that accepts `4/6` the walkthrough was jumping straight
 * to `2/3` — worst on exactly the levels that do not teach simplifying, where the
 * child was never asked to produce the form the last rung shows. Gating on "the
 * written forms differ" instead covers both, and also drops the rung on the items
 * where simplify and result carried identical slots and it said nothing.
 */
function solutionFor(params: FracArithParams, draw: Draw, answer: Term): SolutionStep[] {
  const steps: SolutionStep[] = [];
  /** The result as the previous rung wrote it, before any reducing. */
  let combinedTerm: Term;

  if (params.op === "mul") {
    combinedTerm = { num: draw.left.num * draw.right.num, den: draw.left.den * draw.right.den };
    steps.push({
      key: SOLUTION_KEY_MULTIPLY_PARTS,
      slots: {
        [SLOT_LEFT]: termSlot(draw.left),
        [SLOT_RIGHT]: draw.rightIsWhole ? numberSlot(draw.right.num) : termSlot(draw.right),
        [SLOT_COMBINED]: fractionSlot(combinedTerm.num, combinedTerm.den),
      },
    });
  } else {
    const common = lcm(draw.left.den, draw.right.den);
    steps.push({
      key: SOLUTION_KEY_COMMON_DENOMINATOR,
      slots: { [SLOT_DENOMINATOR]: numberSlot(common) },
    });
    steps.push({
      key: SOLUTION_KEY_RESTATE,
      slots: {
        [SLOT_LEFT_SCALED]: fractionSlot(draw.left.num * (common / draw.left.den), common),
        [SLOT_RIGHT_SCALED]: fractionSlot(draw.right.num * (common / draw.right.den), common),
      },
    });
    const combined =
      params.op === "add"
        ? draw.left.num * (common / draw.left.den) + draw.right.num * (common / draw.right.den)
        : draw.left.num * (common / draw.left.den) - draw.right.num * (common / draw.right.den);
    combinedTerm = { num: combined, den: common };
    steps.push({
      key: SOLUTION_KEY_COMBINE,
      slots: { [SLOT_COMBINED]: fractionSlot(combinedTerm.num, combinedTerm.den) },
    });
  }

  if (combinedTerm.num !== answer.num || combinedTerm.den !== answer.den) {
    steps.push({ key: SOLUTION_KEY_SIMPLIFY, slots: { [SLOT_ANSWER]: termSlot(answer) } });
  }
  steps.push({ key: SOLUTION_KEY_RESULT, slots: { [SLOT_ANSWER]: termSlot(answer) } });
  return steps;
}

export const fracArithFamily: GeneratorFamily<FracArithParams> = {
  family: FRAC_ARITH_FAMILY,
  familyRev: FRAC_ARITH_FAMILY_REV,
  paramSchema: fracArithParamSchema,
  forms: FRAC_ARITH_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: FracArithParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: FracArithParams): Rational {
    let b = mul(COEFF_DENOMINATOR, rational(BigInt(params.maxDenominator)));
    if (params.lowestTerms) b = ratAdd(b, COEFF_LOWEST_TERMS);
    if (params.op === "mul") {
      return params.wholeMultiplier ? ratAdd(b, COEFF_WHOLE_MULTIPLIER) : b;
    }
    if (params.denominators === "unlike") b = ratAdd(b, COEFF_UNLIKE);
    if (params.denominators === "multiple") b = ratAdd(b, COEFF_MULTIPLE);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<FracArithParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(FRAC_ARITH_FAMILY, FRAC_ARITH_FAMILY_REV, skillId, level, seed);
    for (let attempt = 0; attempt < MAX_GENERATE_ATTEMPTS; attempt++) {
    const rng = createRng(seedFrom(exerciseId, String(attempt)));

    const form = chooseForm(forms, FRAC_ARITH_FORMS, rng);
    const draw = params.op === "mul" ? drawMul(params, rng) : drawAddSub(params, rng);

    const exact = exactResult(params, draw);
    if (exact.n <= 0n) throw new InfeasibleLevelError(`non-positive result on ${exerciseId}`);
    if (exact.d === 1n) {
      // A whole-number result written into a fraction entry is `3/1`, which is not
      // how anybody writes three. Draw again rather than serve it.
      continue;
    }

    const answerParts = reduce(exact.n, exact.d);
    const answer: Term = { num: answerParts.num, den: answerParts.den };
    if (!rationalEq(valueOfTerm(answer), exact)) {
      throw new InfeasibleLevelError(`the written answer is not the exact result on ${exerciseId}`);
    }

    const schema = schemaFor(params);
    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: FRAC_ARITH_FAMILY,
      familyRev: FRAC_ARITH_FAMILY_REV,
      form,
      prompt: {
        key: promptKeyFor(params, draw),
        slots: {
          [SLOT_LEFT]: termSlot(draw.left),
          [SLOT_RIGHT]: draw.rightIsWhole ? numberSlot(draw.right.num) : termSlot(draw.right),
        },
      },
      schema,
      answer: { canonical: fractionAnswer({ whole: 0n, num: answer.num, den: answer.den }), alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, draw, answer),
    };

    return { ...base, distractors: distractorsFor(FRAC_ARITH_FAMILY, base) };
    }

    throw new InfeasibleLevelError(
      `every draw for ${exerciseId} came out whole after ${String(MAX_GENERATE_ATTEMPTS)} attempts`,
    );
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
