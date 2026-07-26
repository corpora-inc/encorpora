import assert from "node:assert/strict";
import test from "node:test";
import { eq, sub as ratSub, add as ratAdd, toDecimalString, toScaled, rational } from "../../math/rational.ts";
import type { Rational } from "../../math/rational.ts";
import { serializeExercise } from "../../serialize.ts";
import { MIS_BORROW_ACROSS_ZERO, MIS_SMALLER_FROM_LARGER } from "../../malrules/columnOp.ts";
import type { Exercise } from "../../types/exercise.ts";
import { skillId } from "../../types/ids.ts";
import { columnOpFamily, InfeasibleParamsError } from "./family.ts";
import { FORM_COLUMN, FORM_FREE_ENTRY, PROMPT_KEY_ADD, PROMPT_KEY_SUB } from "./constants.ts";
import { columnOpParamSchema } from "./params.ts";
import type { ColumnOpParams } from "./params.ts";
import { readOperands } from "./digits.ts";

const SKILL = skillId("dw.add.regroup.subtract-across-zero");
const BOTH_FORMS = [FORM_FREE_ENTRY, FORM_COLUMN];

function params(overrides: Partial<ColumnOpParams> = {}): ColumnOpParams {
  return {
    op: "sub",
    digits: 4,
    operandDigits: 4,
    regroupings: 3,
    acrossZero: 2,
    decimalPlaces: 0,
    allowZeroResult: false,
    ...overrides,
  };
}

function generate(seed: number, overrides: Partial<ColumnOpParams> = {}, forms = BOTH_FORMS): Exercise {
  return columnOpFamily.generate({ skillId: SKILL, level: 0, seed, params: params(overrides), forms });
}

function operandOf(exercise: Exercise, slot: "top" | "bottom"): Rational {
  const value = exercise.prompt.slots[slot];
  assert.ok(value !== undefined && value.kind === "number", "operand slot must be a number slot");
  return value.value;
}

function answerOf(exercise: Exercise): Rational {
  const canonical = exercise.answer.canonical;
  assert.ok(canonical.kind === "integer" || canonical.kind === "columnAlgorithm");
  return canonical.value;
}

test("column-op: the same seed always produces the identical exercise", () => {
  for (const seed of [1, 2, 97, 5001, 4294967295]) {
    const first = generate(seed);
    const second = generate(seed);
    assert.equal(serializeExercise(first), serializeExercise(second));
    assert.equal(first.exerciseId, `gen.arith.column-op@1:${SKILL}:L0:${String(seed)}`);
  }
  assert.notEqual(serializeExercise(generate(1)), serializeExercise(generate(2)));
});

test("column-op: the answer equals exact rational subtraction, not digit bookkeeping", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const exercise = generate(seed);
    assert.ok(eq(answerOf(exercise), ratSub(operandOf(exercise, "top"), operandOf(exercise, "bottom"))));
  }
});

test("column-op: a documented across-zero item behaves as the program describes", () => {
  // 5001 − 2798 is the worked example the whole diagnosis story hangs on. It is one
  // draw out of ~126,000 for this level, so it is asserted here through the
  // structure rather than by hunting for its seed: every item at this level has a
  // two-zero run, a three-borrow chain, and the two mal-rule distractors.
  const exercise = generate(1);
  const operands = readOperands(exercise);
  assert.ok(operands !== null);
  assert.equal(operands.op, "sub");
  assert.equal(operands.top[1], 0, "the tens digit of the minuend is a zero the borrow crosses");
  assert.equal(operands.top[2], 0, "the hundreds digit too");
  assert.ok((operands.top[3] ?? 0) >= 2, "and there is a digit above the run to regroup from");

  const misconceptions = exercise.distractors.map((distractor) => distractor.misconception);
  assert.deepEqual([...misconceptions].sort(), [MIS_BORROW_ACROSS_ZERO, MIS_SMALLER_FROM_LARGER].sort());

  // Borrow-across-zero is the correct answer plus exactly the thousand that was
  // borrowed and never given up.
  const borrowBug = exercise.distractors.find((d) => d.misconception === MIS_BORROW_ACROSS_ZERO);
  assert.ok(borrowBug !== undefined && borrowBug.value.kind !== "choice" && borrowBug.value.kind !== "fraction");
  assert.ok(eq(borrowBug.value.value, ratAdd(answerOf(exercise), rational(1000n))));
});

test("column-op: never negative, never zero, never a trivial subtrahend", () => {
  for (let seed = 1; seed <= 500; seed++) {
    const exercise = generate(seed);
    const answer = answerOf(exercise);
    assert.ok(answer.n > 0n, `seed ${String(seed)} produced a non-positive answer`);
    assert.ok(operandOf(exercise, "bottom").n > 0n, "the subtrahend is never zero");
  }
});

test("column-op: the answer field is sized to the parameters, not to the answer", () => {
  // Auto-sizing an input to the answer tells a child how many digits it has.
  // ARCHITECTURE L3 forbids it; this is the generator's half of that promise.
  let sawShorterAnswer = false;
  for (let seed = 1; seed <= 2000; seed++) {
    const exercise = generate(seed, { regroupings: 3 }, [FORM_FREE_ENTRY]);
    assert.equal(exercise.schema.kind, "integer");
    if (exercise.schema.kind !== "integer") continue;
    assert.equal(exercise.schema.digits, 4, "field width comes from params.digits");
    const written = (toScaled(answerOf(exercise), 0) ?? 0n).toString().length;
    if (written < exercise.schema.digits) sawShorterAnswer = true;
  }
  assert.ok(sawShorterAnswer, "at least one answer is shorter than the field, which is the point");
});

test("column-op: decimals are exact", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const exercise = generate(seed, {
      digits: 3,
      operandDigits: 3,
      regroupings: 1,
      acrossZero: 0,
      decimalPlaces: 1,
    });
    const top = operandOf(exercise, "top");
    const bottom = operandOf(exercise, "bottom");
    const answer = answerOf(exercise);
    assert.ok(eq(answer, ratSub(top, bottom)));
    // Every value is an exact multiple of a tenth: denominators divide 10.
    for (const value of [top, bottom, answer]) assert.equal(10n % value.d, 0n);
    assert.ok(toDecimalString(answer, 1) !== null);
  }
});

test("column-op: a zero result is refused by default and allowed on request", () => {
  const equalOperands = { digits: 2, operandDigits: 2, regroupings: 0, acrossZero: 0 } as const;
  for (let seed = 1; seed <= 3000; seed++) {
    assert.ok(answerOf(generate(seed, equalOperands)).n > 0n, `seed ${String(seed)} produced zero`);
  }
  let sawZero = false;
  for (let seed = 1; seed <= 3000 && !sawZero; seed++) {
    if (answerOf(generate(seed, { ...equalOperands, allowZeroResult: true })).n === 0n) sawZero = true;
  }
  assert.ok(sawZero, "a - a = 0 is reachable when the level asks for it");
});

test("column-op: addition carries, and the sum may gain a digit", () => {
  let sawExtraDigit = false;
  for (let seed = 1; seed <= 500; seed++) {
    const exercise = generate(seed, {
      op: "add",
      digits: 3,
      operandDigits: 3,
      regroupings: 3,
      acrossZero: 0,
    });
    assert.equal(exercise.prompt.key, PROMPT_KEY_ADD);
    assert.ok(eq(answerOf(exercise), ratAdd(operandOf(exercise, "top"), operandOf(exercise, "bottom"))));
    if (exercise.schema.kind === "integer") assert.equal(exercise.schema.digits, 4);
    if ((toScaled(answerOf(exercise), 0) ?? 0n) >= 1000n) sawExtraDigit = true;
  }
  assert.ok(sawExtraDigit, "carrying out of the top column widens the answer");
});

test("column-op: subtraction and addition use different prompt templates", () => {
  assert.equal(generate(3).prompt.key, PROMPT_KEY_SUB);
  assert.equal(generate(3, { op: "add", regroupings: 1, acrossZero: 0 }).prompt.key, PROMPT_KEY_ADD);
});

test("column-op: forms are drawn from the binding and both appear", () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) seen.add(generate(seed).form);
  assert.deepEqual([...seen].sort(), [FORM_COLUMN, FORM_FREE_ENTRY]);
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(generate(seed, {}, [FORM_COLUMN]).form, FORM_COLUMN);
  }
  assert.throws(() => generate(1, {}, []), InfeasibleParamsError);
  assert.throws(() => generate(1, {}, ["dial"]), InfeasibleParamsError);
});

test("column-op: the column form accepts the digits with or without regrouping marks", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const exercise = generate(seed, {}, [FORM_COLUMN]);
    assert.equal(exercise.schema.kind, "columnAlgorithm");
    const canonical = exercise.answer.canonical;
    assert.ok(canonical.kind === "columnAlgorithm");
    assert.ok(canonical.marks.length > 0, "the canonical answer records the regrouping");
    assert.equal(exercise.answer.alsoAccept.length, 1);
    const unmarked = exercise.answer.alsoAccept[0];
    assert.ok(unmarked !== undefined && unmarked.kind === "columnAlgorithm");
    assert.equal(unmarked.marks.length, 0);
    assert.ok(columnOpFamily.check(exercise, unmarked).correct, "regrouping mentally is still correct");
    assert.ok(columnOpFamily.check(exercise, canonical).correct);
  }
});

test("column-op: the free-entry form has nothing extra to accept", () => {
  const exercise = generate(1, {}, [FORM_FREE_ENTRY]);
  assert.deepEqual(exercise.answer.alsoAccept, []);
});

test("column-op: check rejects every distractor and names the bug that produced it", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const exercise = generate(seed);
    for (const distractor of exercise.distractors) {
      const verdict = columnOpFamily.check(exercise, distractor.value);
      assert.equal(verdict.correct, false);
      assert.equal(verdict.correct === false ? verdict.misconception : undefined, distractor.misconception);
    }
  }
});

test("column-op: an unclassified wrong answer is wrong without a diagnosis", () => {
  const exercise = generate(1, {}, [FORM_FREE_ENTRY]);
  const wrong = { kind: "integer", value: ratAdd(answerOf(exercise), rational(7n)) } as const;
  const verdict = columnOpFamily.check(exercise, wrong);
  assert.equal(verdict.correct, false);
  assert.equal(verdict.correct === false ? verdict.misconception : "unset", undefined);
});

test("column-op: the solution walks every column and ends on the answer", () => {
  const exercise = generate(1, {}, [FORM_FREE_ENTRY]);
  assert.ok(exercise.solution.length >= params().digits + 2);
  const columns = exercise.solution
    .filter((step) => step.focusColumn !== undefined)
    .map((step) => step.focusColumn ?? -1);
  assert.deepEqual([...columns].sort((a, b) => a - b), columns, "steps run right to left in order");
  const last = exercise.solution.at(-1);
  assert.ok(last !== undefined);
  const answerSlot = last.slots["answer"];
  assert.ok(answerSlot !== undefined && answerSlot.kind === "number");
  assert.ok(eq(answerSlot.value, answerOf(exercise)));
});

test("column-op: difficulty is a pure function of the parameters", () => {
  const easy = columnOpFamily.difficultyOffset(params({ digits: 2, operandDigits: 2, regroupings: 1, acrossZero: 0 }));
  const hard = columnOpFamily.difficultyOffset(params());
  assert.ok(easy.n * hard.d < hard.n * easy.d, "more regrouping and more zeros is harder");
  // 0.55·3 + 0.30·2 + 0.25·2 = 2.75
  assert.deepEqual(columnOpFamily.difficultyOffset(params()), rational(275n, 100n));
  assert.deepEqual(columnOpFamily.formOffset(FORM_COLUMN), rational(-15n, 100n));
  assert.deepEqual(columnOpFamily.formOffset(FORM_FREE_ENTRY), rational(0n));
});

test("column-op params: accepts the levels the graph binds", () => {
  for (const candidate of [
    params(),
    params({ digits: 2, operandDigits: 2, regroupings: 1, acrossZero: 0 }),
    params({ digits: 4, operandDigits: 1, regroupings: 3, acrossZero: 2 }),
    params({ op: "add", regroupings: 4, acrossZero: 0 }),
  ]) {
    assert.equal(columnOpParamSchema.validate(candidate).ok, true, JSON.stringify(candidate));
  }
});

test("column-op params: rejects combinations no digit assignment could satisfy", () => {
  const cases: readonly (readonly [Partial<ColumnOpParams>, string])[] = [
    [{ digits: 2, operandDigits: 2, regroupings: 2, acrossZero: 0 }, "regroupings"],
    [{ digits: 3, operandDigits: 3, regroupings: 1, acrossZero: 1 }, "regroupings"],
    [{ digits: 3, operandDigits: 3, regroupings: 3, acrossZero: 2 }, "acrossZero"],
    [{ operandDigits: 5 }, "operandDigits"],
    [{ digits: 1, operandDigits: 1, regroupings: 0, acrossZero: 0 }, "digits"],
    [{ decimalPlaces: 3 }, "decimalPlaces"],
    [{ op: "add", acrossZero: 1 }, "acrossZero"],
    [{ regroupings: -1, acrossZero: 0 }, "regroupings"],
  ];
  for (const [overrides, path] of cases) {
    const result = columnOpParamSchema.validate(params(overrides));
    assert.equal(result.ok, false, `expected ${JSON.stringify(overrides)} to be rejected`);
    if (!result.ok) {
      assert.ok(
        result.issues.some((issue) => issue.path === path),
        `expected an issue on ${path}, got ${JSON.stringify(result.issues)}`,
      );
    }
  }
});

test("column-op params: rejects the wrong shape outright", () => {
  for (const bad of [null, 42, "sub", {}, { ...params(), op: "times" }, { ...params(), digits: "4" }]) {
    assert.equal(columnOpParamSchema.validate(bad).ok, false, JSON.stringify(bad));
  }
});
