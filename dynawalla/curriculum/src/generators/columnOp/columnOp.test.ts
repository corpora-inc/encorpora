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
import { addColumns, subtractColumns } from "./procedure.ts";

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
    assert.ok(columnOpFamily.check(exercise, canonical).correct);

    // Marks are process evidence, never a correctness condition, so the number
    // alone is right and so is the number with someone else's marks. `alsoAccept`
    // stays empty rather than listing a value that is already equal to canonical.
    assert.deepEqual(exercise.answer.alsoAccept, []);
    const unmarked = { kind: "columnAlgorithm", value: answerOf(exercise), marks: [] } as const;
    const misMarked = {
      kind: "columnAlgorithm",
      value: answerOf(exercise),
      marks: [{ column: 0, kind: "borrow", value: 3 } as const],
    } as const;
    assert.ok(columnOpFamily.check(exercise, unmarked).correct, "regrouping mentally is still correct");
    assert.ok(columnOpFamily.check(exercise, misMarked).correct, "and the marks are never graded");
  }
});

test("column-op: the free-entry form has nothing extra to accept", () => {
  const exercise = generate(1, {}, [FORM_FREE_ENTRY]);
  assert.deepEqual(exercise.answer.alsoAccept, []);
});

/** One line per solution step: `key@focusColumn slot=value …`, slots in name order. */
function stepLines(exercise: Exercise): string[] {
  return exercise.solution.map((step) => {
    const slots = Object.keys(step.slots)
      .sort()
      .map((name) => {
        const slot = step.slots[name];
        if (slot === undefined) return `${name}=?`;
        if (slot.kind === "number") return `${name}=${toDecimalString(slot.value, slot.decimalPlaces) ?? "?"}`;
        if (slot.kind === "count") return `${name}=${String(slot.value)}`;
        return `${name}=${slot.key}`;
      })
      .join(" ");
    return `${step.key.replace("dw.solution.column-op.", "")}@${step.focusColumn ?? "-"} ${slots}`;
  });
}

test("column-op: the walkthrough shows every regrouping, including the ones across zeros", () => {
  // The faded worked example for `dw.add.regroup.subtract-across-zero` is the
  // remediation for `mis.add.borrow-across-zero`, and that misconception *is*
  // leaving the zero run and the digit above it unchanged. A walkthrough that
  // announces only the column which could not subtract, and then asserts that the
  // zeros were nines all along, performs the bug it is repairing. So the whole step
  // list is pinned, not its length.
  const acrossZero = columnOpFamily.generate({
    skillId: SKILL,
    level: 2,
    seed: 1,
    params: params(),
    forms: [FORM_FREE_ENTRY],
  });
  assert.deepEqual(stepLines(acrossZero), [
    "setup@- bottom=2888 top=4007",
    "regroup@0 column=0 value=17", // 7 cannot take 8, so the chain runs left
    "column@0 bottom=8 column=0 digit=9 top=17",
    "regroup@1 column=1 value=9", // the first zero it crossed
    "column@1 bottom=8 column=1 digit=1 top=9",
    "regroup@2 column=2 value=9", // the second
    "column@2 bottom=8 column=2 digit=1 top=9",
    "regroup@3 column=3 value=3", // and the 4 it finally took from
    "column@3 bottom=2 column=3 digit=1 top=3",
    "result@- answer=1119",
  ]);

  // 5001 − 2798, the worked example the whole diagnosis story hangs on, generated
  // rather than hand-built: one draw in ~126,000 at this level, found by search.
  const documented = columnOpFamily.generate({
    skillId: SKILL,
    level: 2,
    seed: 159579,
    params: params(),
    forms: [FORM_FREE_ENTRY],
  });
  assert.deepEqual(stepLines(documented), [
    "setup@- bottom=2798 top=5001",
    "regroup@0 column=0 value=11",
    "column@0 bottom=8 column=0 digit=3 top=11",
    "regroup@1 column=1 value=9",
    "column@1 bottom=9 column=1 digit=0 top=9",
    "regroup@2 column=2 value=9",
    "column@2 bottom=7 column=2 digit=2 top=9",
    "regroup@3 column=3 value=4",
    "column@3 bottom=2 column=3 digit=2 top=4",
    "result@- answer=2203",
  ]);

  // The digit that was borrowed from is announced in the small case too, where it
  // is the only regrouping there is: 32 − 16 must not assert that the 3 is a 2.
  const oneBorrow = generate(1, { digits: 2, operandDigits: 2, regroupings: 1, acrossZero: 0 }, [FORM_FREE_ENTRY]);
  assert.deepEqual(stepLines(oneBorrow), [
    "setup@- bottom=16 top=32",
    "regroup@0 column=0 value=12",
    "column@0 bottom=6 column=0 digit=6 top=12",
    "regroup@1 column=1 value=2",
    "column@1 bottom=1 column=1 digit=1 top=2",
    "result@- answer=16",
  ]);
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

test("column-op: acceptance goes through the schema, so `equivalence` is not a dead knob", () => {
  // `AnswerSchema.fraction.equivalence` is a curriculum decision — on
  // `simplify-to-lowest-terms`, accepting `2/4` marks the thing being taught as
  // correct — and it was declared with nothing on the judging path consulting
  // it: `check` compared with `answerEquals`, the app never called
  // `answerAccepted`, and the field would have been silently ignored by the
  // first fraction family, marking every equivalent answer wrong.
  //
  // This family emits no fraction item, so the seam is what is tested: the one
  // checker in the program, handed a fraction schema, honours the schema.
  const exercise = generate(1, {}, [FORM_FREE_ENTRY]);
  const half = { kind: "fraction", num: 1n, den: 2n } as const;
  const quarters = { kind: "fraction", num: 2n, den: 4n } as const;

  const strict: Exercise = {
    ...exercise,
    schema: { kind: "fraction", parts: ["num", "den"] },
    answer: { canonical: half, alsoAccept: [] },
  };
  assert.equal(columnOpFamily.check(strict, half).correct, true);

  const loose: Exercise = {
    ...strict,
    schema: { kind: "fraction", parts: ["num", "den"], equivalence: "any-equivalent" },
  };
  // The discriminating assertion: `2/4` is not `1/2` to `answerEquals`, and the
  // only thing that can make this true is the checker reading the schema.
  assert.equal(
    columnOpFamily.check(loose, quarters).correct,
    true,
    "the schema says any equivalent counts and the checker ignored it",
  );
  // The refusing direction is `answerAccepted`'s own test: a *wrong* fraction
  // here would fall through to `classify`, and this family's mal-rules run the
  // column procedure, which has no fraction answer shape to run into.

  // And the schemas this family really emits are unaffected: an `integer` or
  // `columnAlgorithm` schema carries no `equivalence`, so `answerAccepted` is
  // `answerEquals` on every item it generates.
  for (let seed = 1; seed <= 50; seed++) {
    const real = generate(seed);
    assert.equal(columnOpFamily.check(real, real.answer.canonical).correct, true);
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

test("column-op: the shared procedure matches the worked example, column by column", () => {
  // 5001 − 2798, hand-derived: the units column takes ten and becomes 11; the two
  // zeros the chain crosses are rewritten as 9s and each takes ten of its own; the
  // 5 gives one up and becomes 4. Both the generator and the mal-rules read this,
  // so a hand-checked table here is what stops the two drifting apart again.
  const trace = subtractColumns([1, 0, 0, 5], [8, 9, 7, 2], 4);
  assert.equal(trace.defined, true);
  assert.deepEqual(
    trace.columns.map((column) => [column.borrowed, column.restated, column.effective, column.digit]),
    [
      [true, 1, 11, 3],
      [true, 9, 9, 0],
      [true, 9, 9, 2],
      [false, 4, 4, 2],
    ],
  );

  // 102 − 456: the borrow runs off the top and the difference is negative, which
  // this family never emits.
  assert.equal(subtractColumns([2, 0, 1], [6, 5, 4], 3).defined, false);

  // 47 + 25 = 72: the units carry, the tens do not, and the carry out is zero.
  const sum = addColumns([7, 4], [5, 2], 2);
  assert.deepEqual(
    sum.columns.map((column) => [column.carried, column.effective, column.digit]),
    [
      [true, 7, 2],
      [false, 5, 7],
    ],
  );
  assert.equal(sum.carryOut, 0);
  assert.equal(addColumns([9, 9], [9, 9], 2).carryOut, 1);
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
