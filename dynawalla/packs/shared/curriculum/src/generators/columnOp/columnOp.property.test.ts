/**
 * Property tests for `gen.arith.column-op`.
 *
 * Seeded purity, exact-arithmetic correctness, checker self-consistency and
 * structural adequacy are statements over thousands of seeds, not over three
 * examples. Every invariant below is checked on every item of every configuration,
 * and the case count is printed so the number in a PR body is a measurement rather
 * than a claim.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { eq, add as ratAdd, sub as ratSub, toScaled } from "../../math/rational.ts";
import { answerEquals, answerToString } from "../../types/answer.ts";
import type { Exercise } from "../../types/exercise.ts";
import { LOC_KEY_PATTERN, skillId } from "../../types/ids.ts";
import { serializeExercise } from "../../serialize.ts";
import { correctBorrows, correctCarries } from "../../malrules/columnOp.ts";
import { columnOpFamily } from "./family.ts";
import {
  FORM_COLUMN,
  FORM_FREE_ENTRY,
  SLOT_COLUMN,
  SLOT_TOP,
  SLOT_VALUE,
  SOLUTION_KEY_CARRY,
  SOLUTION_KEY_COLUMN,
  SOLUTION_KEY_REGROUP,
} from "./constants.ts";
import type { GenerateRequest } from "../../types/generator.ts";
import { columnOpParamSchema } from "./params.ts";
import type { ColumnOpParams } from "./params.ts";
import { readOperands } from "./digits.ts";

const SEEDS_PER_CONFIG = 2500;
const SKILL = skillId("dw.add.regroup.subtract-across-zero");
const BOTH_FORMS = [FORM_FREE_ENTRY, FORM_COLUMN];

type Config = { readonly name: string; readonly params: ColumnOpParams };

function config(name: string, overrides: Partial<ColumnOpParams>): Config {
  return {
    name,
    params: {
      op: "sub",
      digits: 4,
      operandDigits: 4,
      regroupings: 1,
      acrossZero: 0,
      decimalPlaces: 0,
      allowZeroResult: false,
      ...overrides,
    },
  };
}

/** Deliberately spans the edges: zeros, repeated regrouping, short operands, decimals. */
const CONFIGS: readonly Config[] = [
  config("two-digit, one borrow", { digits: 2, operandDigits: 2, regroupings: 1 }),
  config("three-digit, two borrows", { digits: 3, operandDigits: 3, regroupings: 2 }),
  config("four-digit, borrow across one zero", { regroupings: 2, acrossZero: 1 }),
  config("four-digit, borrow across two zeros", { regroupings: 3, acrossZero: 2 }),
  config("five-digit, borrow across three zeros", { digits: 5, operandDigits: 5, regroupings: 4, acrossZero: 3 }),
  config("short subtrahend", { digits: 4, operandDigits: 2, regroupings: 1 }),
  config("short subtrahend across zeros", { digits: 4, operandDigits: 1, regroupings: 3, acrossZero: 2 }),
  config("no regrouping at all", { digits: 3, operandDigits: 3, regroupings: 0 }),
  config("tenths", { digits: 3, operandDigits: 3, regroupings: 1, decimalPlaces: 1 }),
  config("hundredths across a zero", { digits: 4, operandDigits: 4, regroupings: 2, acrossZero: 1, decimalPlaces: 2 }),
  config("two-digit addition, one carry", { op: "add", digits: 2, operandDigits: 2, regroupings: 1 }),
  config("three-digit addition, carry every column", { op: "add", digits: 3, operandDigits: 3, regroupings: 3 }),
  config("addition with a short addend", { op: "add", digits: 4, operandDigits: 2, regroupings: 2 }),
];

function checkItem(exercise: Exercise, params: ColumnOpParams, label: string): void {
  const operands = readOperands(exercise);
  assert.ok(operands !== null, `${label}: operands must be recoverable from the exercise`);

  const top = exercise.prompt.slots["top"];
  const bottom = exercise.prompt.slots["bottom"];
  assert.ok(top !== undefined && top.kind === "number", `${label}: top slot`);
  assert.ok(bottom !== undefined && bottom.kind === "number", `${label}: bottom slot`);
  const canonical = exercise.answer.canonical;
  assert.ok(canonical.kind === "integer" || canonical.kind === "columnAlgorithm", `${label}: answer kind`);

  // 1. The answer is exact rational arithmetic on the two operands.
  const expected = params.op === "sub" ? ratSub(top.value, bottom.value) : ratAdd(top.value, bottom.value);
  assert.ok(eq(canonical.value, expected), `${label}: answer is not the exact difference/sum`);

  // 2. No unintended negative, and no degenerate zero.
  assert.ok(canonical.value.n >= 0n, `${label}: negative answer`);
  if (!params.allowZeroResult) assert.ok(canonical.value.n > 0n, `${label}: zero answer`);

  // 3. Both operands are written to the requested width, with no leading zero.
  const scale = params.decimalPlaces;
  const topDigits = (toScaled(top.value, scale) ?? 0n).toString();
  const bottomDigits = (toScaled(bottom.value, scale) ?? 0n).toString();
  assert.equal(topDigits.length, params.digits, `${label}: top operand width`);
  assert.equal(bottomDigits.length, params.operandDigits, `${label}: bottom operand width`);
  assert.equal(top.decimalPlaces, params.decimalPlaces, `${label}: top decimal places`);
  assert.equal(bottom.decimalPlaces, params.decimalPlaces, `${label}: bottom decimal places`);

  // 4. The regrouping structure is exactly what the level asked for.
  const regroupings =
    params.op === "sub"
      ? correctBorrows(operands.top, operands.bottom, operands.cols).filter(Boolean).length
      : correctCarries(operands.top, operands.bottom, operands.cols).filter(Boolean).length;
  assert.equal(regroupings, params.regroupings, `${label}: regrouping count`);

  // 5. The across-zero run is where the parameters say it is.
  if (params.acrossZero > 0) {
    for (let column = 1; column <= params.acrossZero; column++) {
      assert.equal(operands.top[column], 0, `${label}: column ${String(column)} should be a zero`);
    }
    assert.notEqual(operands.top[params.acrossZero + 1], 0, `${label}: the run must terminate on a non-zero digit`);
  }

  // 6. Nothing has more decimal places than the level declares.
  for (const value of [top.value, bottom.value, canonical.value]) {
    assert.notEqual(toScaled(value, params.decimalPlaces), null, `${label}: value is not on the decimal grid`);
  }

  // 7. The item is answerable and its distractors are all wrong.
  assert.ok(columnOpFamily.check(exercise, canonical).correct, `${label}: checker rejects its own answer`);
  for (const accepted of exercise.answer.alsoAccept) {
    assert.ok(columnOpFamily.check(exercise, accepted).correct, `${label}: checker rejects an alsoAccept answer`);
  }
  const seen = new Set<string>();
  for (const distractor of exercise.distractors) {
    assert.ok(!answerEquals(distractor.value, canonical), `${label}: distractor equals the answer`);
    assert.equal(columnOpFamily.check(exercise, distractor.value).correct, false, `${label}: distractor accepted`);
    const key = answerToString(distractor.value);
    assert.ok(!seen.has(key), `${label}: duplicate distractor`);
    seen.add(key);
    assert.ok(distractor.misconception !== undefined, `${label}: distractor with no mal-rule`);
    if (distractor.value.kind === "integer" || distractor.value.kind === "columnAlgorithm") {
      assert.ok(distractor.value.value.n >= 0n, `${label}: negative distractor`);
    }
  }

  // 8. Prompts are structured, and every key is a locale key.
  assert.ok(LOC_KEY_PATTERN.test(exercise.prompt.key), `${label}: prompt key`);
  for (const step of exercise.solution) assert.ok(LOC_KEY_PATTERN.test(step.key), `${label}: solution key`);
  assert.equal(exercise.family, "gen.arith.column-op");
  assert.equal(exercise.familyRev, 1);
  assert.ok(BOTH_FORMS.includes(exercise.form), `${label}: unknown form`);

  // 9. The answer field is a parameter, never the answer's own width.
  const capacity = params.op === "add" ? params.digits + 1 : params.digits;
  if (exercise.schema.kind === "integer") assert.equal(exercise.schema.digits, capacity, `${label}: field width`);
  if (exercise.schema.kind === "columnAlgorithm") assert.equal(exercise.schema.cols, capacity, `${label}: cols`);

  // 10. The walkthrough never asserts a digit the child has not been shown.
  //
  // Every column step states the value being worked with. That value may differ
  // from the digit written on the page only if an earlier step said so — a regroup
  // step naming this column, or a carry step delivering one into it. This is the
  // general form of the bug the `4007 − 2888` example pins: a step list that
  // silently turns the zeros of a borrow chain into nines is a demonstration of
  // `mis.add.borrow-across-zero`, in the worked example that repairs it.
  const restated = new Map<number, number>();
  const carried = new Set<number>();
  for (const step of exercise.solution) {
    const column = step.slots[SLOT_COLUMN];
    const value = step.slots[SLOT_VALUE];
    if (column === undefined || column.kind !== "count") continue;

    if (step.key === SOLUTION_KEY_REGROUP && value !== undefined && value.kind === "count") {
      restated.set(column.value, value.value);
      continue;
    }
    if (step.key === SOLUTION_KEY_CARRY) {
      carried.add(column.value);
      continue;
    }
    if (step.key !== SOLUTION_KEY_COLUMN) continue;

    const worked = step.slots[SLOT_TOP];
    assert.ok(worked !== undefined && worked.kind === "count", `${label}: column step has no top digit`);
    const written: number = operands.top[column.value] ?? 0;
    const shown: number = restated.get(column.value) ?? written + (carried.has(column.value) ? 1 : 0);
    assert.equal(
      worked.value,
      shown,
      `${label}: column ${String(column.value)} is worked as ${String(worked.value)} but the child was shown ${String(shown)}`,
    );
  }
}

test("column-op: every configuration holds every invariant on every seed", (t) => {
  let items = 0;

  for (const { name, params } of CONFIGS) {
    const validated = columnOpParamSchema.validate(params);
    assert.equal(validated.ok, true, `${name}: parameters must validate — ${JSON.stringify(validated)}`);
    if (!validated.ok) continue;

    for (let seed = 1; seed <= SEEDS_PER_CONFIG; seed++) {
      const exercise = columnOpFamily.generate({
        skillId: SKILL,
        level: 0,
        seed,
        params: validated.value,
        forms: BOTH_FORMS,
      });
      checkItem(exercise, params, `${name} seed ${String(seed)}`);
      items += 1;
    }
  }

  t.diagnostic(`${String(items)} generated items across ${String(CONFIGS.length)} configurations`);
  assert.equal(items, CONFIGS.length * SEEDS_PER_CONFIG);
});

test("column-op: generation is reproducible from the seed alone", (t) => {
  let items = 0;
  for (const { name, params } of CONFIGS) {
    const validated = columnOpParamSchema.validate(params);
    if (!validated.ok) continue;
    for (let seed = 1; seed <= 500; seed++) {
      const request: GenerateRequest<ColumnOpParams> = {
        skillId: SKILL,
        level: 0,
        seed,
        params: validated.value,
        forms: BOTH_FORMS,
      };
      assert.equal(
        serializeExercise(columnOpFamily.generate(request)),
        serializeExercise(columnOpFamily.generate(request)),
        `${name} seed ${String(seed)} is not reproducible`,
      );
      items += 1;
    }
  }
  t.diagnostic(`${String(items)} items regenerated and compared byte for byte`);
});

test("column-op: the level and skill are part of the draw, not just of the label", (t) => {
  // Two skills sharing a level's parameters must not serve the same problems in
  // the same order, or a child who has met one has met the other.
  const validated = columnOpParamSchema.validate(CONFIGS[3]?.params);
  assert.equal(validated.ok, true);
  if (!validated.ok) return;

  let differing = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const a = columnOpFamily.generate({
      skillId: SKILL,
      level: 0,
      seed,
      params: validated.value,
      forms: [FORM_FREE_ENTRY],
    });
    const b = columnOpFamily.generate({
      skillId: skillId("dw.add.regroup.subtract-multidigit"),
      level: 2,
      seed,
      params: validated.value,
      forms: [FORM_FREE_ENTRY],
    });
    if (answerToString(a.answer.canonical) !== answerToString(b.answer.canonical)) differing += 1;
  }
  t.diagnostic(`${String(differing)}/500 seeds differ between two skills at the same parameters`);
  assert.ok(differing > 490, "the skill id and level must reseed the draw");
});
