/**
 * `gen.arith.times-table` — the multiplication tables and their inverses, from
 * `0 × 1` to `144 ÷ 12`.
 *
 * ## Why this is not `gen.arith.multidigit-mul` with smaller parameters
 *
 * The same argument `gen.arith.number-facts` makes against `gen.arith.column-op`,
 * and it lands harder here. `multidigit-mul` is bounded by a **digit count** and
 * its smallest legal multiplicand is two digits wide; there is no parameter in it
 * that means "the tables to five", because a digit count cannot say which table.
 * Its worked solution is a walk over partial products and its three mal-rules are
 * all bugs in that walk — run at one digit by one digit, the walkthrough for
 * `6 × 8` announces a single partial product and then announces it again as the
 * answer, and every mal-rule's `applies()` is false.
 *
 * What a child does with `6 × 8` is recall it, and failing that, count in sixes.
 * That is the hint ladder here, and it is the whole reason the family exists.
 *
 * ## Why multiplication and division are one family
 *
 * `48 ÷ 6` is not a procedure at this size; it is `6 × 8` read backwards, and the
 * strategy rung says so in as many words. One family means one closed set, one
 * enumeration and one uniformity argument covering both directions, and it means
 * a level table cannot accidentally claim a division level reaching facts its
 * multiplication sibling does not have. `gen.arith.long-div` owns division the
 * moment it stops being recall and becomes a column procedure, which is exactly
 * where `divisorDigits` starts to mean something.
 *
 * ## No mal-rules, on purpose
 *
 * Every buggy procedure in `malrules/` is a bug in a written algorithm.
 * CURRICULUM.md names `mis.mul.makes-bigger` for this domain, and it is a real and
 * well-evidenced belief — but its home is an item where multiplying *can* make a
 * number smaller, which is a fraction or a decimal, and a whole-number table never
 * poses one. The documented error at this size is a retrieval slip: the
 * neighbouring fact, or a skip-count that lost a step. Shipping either as a
 * distractor would be a bug this program invented rather than one it has evidence
 * for, which `README.md` forbids outright. The rows declare `misconceptions: []`
 * and a wrong answer routes to the worked example, which is the honest outcome.
 *
 * ## No array picture
 *
 * The array model is the right representation for `6 × 8` and it is not declared
 * here, because nothing in this repository draws a representation and a card whose
 * question is a picture nobody draws is a blank card. `REP_GEAR_TRAIN` and an
 * array both wait on the same pack renderer. The numerals are a complete question
 * without them; a picture would have been a scaffold, not the content.
 */

import { eq as ratEq, mul as ratMul, mul, rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { createRng, seedFrom } from "../../rng/rng.ts";
import type { AnswerSchema, AnswerValue } from "../../types/answer.ts";
import type { Exercise, PromptSlot, SolutionStep } from "../../types/exercise.ts";
import { exerciseIdOf } from "../../types/ids.ts";
import type { GenerateRequest, GeneratorFamily, Verdict } from "../../types/generator.ts";
import { add as ratAdd } from "../../math/rational.ts";
import { chooseForm, distractorsFor, judge } from "../shared/build.ts";
import { InfeasibleLevelError } from "../shared/errors.ts";
import { countSlot, numberSlot } from "../shared/slots.ts";
import {
  COEFF_DIVISION,
  COEFF_FACTOR_OVER_ROOT,
  COEFF_INCLUDE_TRIVIAL,
  FORM_OFFSET_FREE_ENTRY,
  PROMPT_KEY_DIV,
  PROMPT_KEY_MUL,
  ROOT_MAX_FACTOR,
  SLOT_ANSWER,
  SLOT_DIVIDEND,
  SLOT_DIVISOR,
  SLOT_FIRST,
  SLOT_OTHER,
  SLOT_SECOND,
  SLOT_STEP,
  SLOT_TIMES,
  SOLUTION_KEY_DIVIDE_BY_ONE,
  SOLUTION_KEY_MISSING_FACTOR,
  SOLUTION_KEY_READ,
  SOLUTION_KEY_RESULT,
  SOLUTION_KEY_SKIP_COUNT,
  SOLUTION_KEY_TIMES_ONE,
  SOLUTION_KEY_TIMES_ZERO,
  SOLUTION_KEY_ZERO_SHARED,
  TIMES_TABLE_FAMILY,
  TIMES_TABLE_FAMILY_REV,
  TIMES_TABLE_FORMS,
} from "./constants.ts";
import { factSet } from "./facts.ts";
import type { Fact } from "./facts.ts";
import { timesTableParamSchema } from "./params.ts";
import type { TimesTableParams } from "./params.ts";

/**
 * The answer field's width, which is the *level's* width and never this item's.
 *
 * Sizing the field to the answer would tell a child how many digits it has
 * (ARCHITECTURE L3), and on the twelve times table that is most of the question:
 * a two-cell field on `12 × 9` rules out 108 before the child has thought about it.
 * The widest product a level can reach is `maxFactor²`; the widest quotient is
 * `maxFactor`, because the level draws the quotient and multiplies back.
 */
function answerDigits(params: TimesTableParams): number {
  const widest = params.op === "mul" ? params.maxFactor * params.maxFactor : params.maxFactor;
  return String(widest).length;
}

function schemaFor(params: TimesTableParams): AnswerSchema {
  return { kind: "integer", digits: answerDigits(params), decimalPlaces: 0 };
}

function promptSlots(params: TimesTableParams, fact: Fact): Readonly<Record<string, PromptSlot>> {
  return params.op === "mul"
    ? { [SLOT_FIRST]: numberSlot(BigInt(fact.first)), [SLOT_SECOND]: numberSlot(BigInt(fact.second)) }
    : { [SLOT_DIVIDEND]: numberSlot(BigInt(fact.first)), [SLOT_DIVISOR]: numberSlot(BigInt(fact.second)) };
}

/**
 * The hint ladder: read the fact, apply the strategy, state the answer.
 *
 * The middle rung is the strategy, not a restatement of the arithmetic.
 *
 * For multiplication it is skip counting **in steps of the larger factor**, taken
 * the smaller factor's many times: `3 × 8` is three eights and not eight threes,
 * because a child who counts in threes eight times has eight chances to lose the
 * thread. That is the same decision `number-facts` makes when it counts on from
 * the larger addend, and for the same reason.
 *
 * For division it is the missing factor, in as many words: `48 ÷ 6` is "what do
 * you multiply six by to reach forty-eight". A repeated-subtraction rung would be
 * the other correct reading and is the slower habit; the strategy this row is
 * teaching is that the table is the answer.
 *
 * The four facts decided by one operand alone get their own rung each, because
 * counting in steps of nothing, and counting in steps of anything exactly once,
 * are both nonsense dressed as a strategy.
 */
function solutionFor(params: TimesTableParams, fact: Fact): SolutionStep[] {
  const read: SolutionStep = { key: SOLUTION_KEY_READ, slots: promptSlots(params, fact) };
  const result: SolutionStep = {
    key: SOLUTION_KEY_RESULT,
    slots: { [SLOT_ANSWER]: numberSlot(BigInt(fact.result)) },
  };

  if (params.op === "mul") {
    if (fact.first === 0 || fact.second === 0) {
      const other = fact.first === 0 ? fact.second : fact.first;
      return [read, { key: SOLUTION_KEY_TIMES_ZERO, slots: { [SLOT_OTHER]: numberSlot(BigInt(other)) } }, result];
    }
    if (fact.first === 1 || fact.second === 1) {
      const other = fact.first === 1 ? fact.second : fact.first;
      return [read, { key: SOLUTION_KEY_TIMES_ONE, slots: { [SLOT_OTHER]: numberSlot(BigInt(other)) } }, result];
    }
    const step = fact.first > fact.second ? fact.first : fact.second;
    const times = fact.first > fact.second ? fact.second : fact.first;
    return [
      read,
      {
        key: SOLUTION_KEY_SKIP_COUNT,
        slots: { [SLOT_STEP]: numberSlot(BigInt(step)), [SLOT_TIMES]: countSlot(times) },
      },
      result,
    ];
  }

  if (fact.first === 0) {
    return [read, { key: SOLUTION_KEY_ZERO_SHARED, slots: { [SLOT_DIVISOR]: numberSlot(BigInt(fact.second)) } }, result];
  }
  if (fact.second === 1) {
    return [
      read,
      { key: SOLUTION_KEY_DIVIDE_BY_ONE, slots: { [SLOT_DIVIDEND]: numberSlot(BigInt(fact.first)) } },
      result,
    ];
  }
  return [
    read,
    {
      key: SOLUTION_KEY_MISSING_FACTOR,
      slots: {
        [SLOT_DIVISOR]: numberSlot(BigInt(fact.second)),
        [SLOT_DIVIDEND]: numberSlot(BigInt(fact.first)),
      },
    },
    result,
  ];
}

export const timesTableFamily: GeneratorFamily<TimesTableParams> = {
  family: TIMES_TABLE_FAMILY,
  familyRev: TIMES_TABLE_FAMILY_REV,
  paramSchema: timesTableParamSchema,
  forms: TIMES_TABLE_FORMS,
  choiceOnly: false,
  representations: [],

  answerSchema(params: TimesTableParams): AnswerSchema {
    return schemaFor(params);
  },

  difficultyOffset(params: TimesTableParams): Rational {
    let b = mul(COEFF_FACTOR_OVER_ROOT, rational(BigInt(params.maxFactor - ROOT_MAX_FACTOR)));
    if (params.op === "div") b = ratAdd(b, COEFF_DIVISION);
    if (params.includeTrivial) b = ratAdd(b, COEFF_INCLUDE_TRIVIAL);
    return b;
  },

  formOffset(): Rational {
    return FORM_OFFSET_FREE_ENTRY;
  },

  generate(request: GenerateRequest<TimesTableParams>): Exercise {
    const { skillId, level, seed, params, forms } = request;
    const exerciseId = exerciseIdOf(TIMES_TABLE_FAMILY, TIMES_TABLE_FAMILY_REV, skillId, level, seed);
    const rng = createRng(seedFrom(exerciseId));
    const form = chooseForm(forms, TIMES_TABLE_FORMS, rng);

    const facts = factSet(params);
    if (facts.length === 0) {
      // The schema rejects every combination that empties the table, so reaching
      // here is a disagreement between the validator and the enumeration — the one
      // bug class a family of this shape is most likely to have.
      throw new InfeasibleLevelError(`no fact satisfies the parameters of ${exerciseId}`);
    }
    const fact = rng.pick(facts);

    // The enumeration and exact rational arithmetic agree, asserted on every call.
    // `facts.ts` computes the result while it builds the pair, so this is the one
    // place the two derivations meet — and both readings are checked in the
    // *multiplicative* direction, which for a division item is the inverse of what
    // the child is asked. A quotient that did not multiply back would be a card
    // with a wrong answer on it, and it would be wrong identically on every device.
    const product = ratMul(
      rational(BigInt(params.op === "mul" ? fact.first : fact.result)),
      rational(BigInt(fact.second)),
    );
    const stated = rational(BigInt(params.op === "mul" ? fact.result : fact.first));
    if (!ratEq(product, stated)) {
      throw new InfeasibleLevelError(`the table disagreed with exact arithmetic on ${exerciseId}`);
    }

    const base: Exercise = {
      exerciseId,
      skillId,
      level,
      seed,
      family: TIMES_TABLE_FAMILY,
      familyRev: TIMES_TABLE_FAMILY_REV,
      form,
      prompt: {
        key: params.op === "mul" ? PROMPT_KEY_MUL : PROMPT_KEY_DIV,
        slots: promptSlots(params, fact),
      },
      schema: schemaFor(params),
      answer: { canonical: { kind: "integer", value: rational(BigInt(fact.result)) }, alsoAccept: [] },
      distractors: [],
      check: { kind: "exact" },
      solution: solutionFor(params, fact),
    };

    return { ...base, distractors: distractorsFor(TIMES_TABLE_FAMILY, base) };
  },

  check(exercise: Exercise, submitted: AnswerValue): Verdict {
    return judge(exercise, submitted);
  },
};
