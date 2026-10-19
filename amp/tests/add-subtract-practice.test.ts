import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  addSubtractTemplates,
  borrows,
  carries,
} from "../src/math/add-subtract-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = addSubtractTemplates.map((t) => t.id);
const parse = (text: string) => Number(text.replaceAll(",", ""));
const numbersIn = (prompt: string) =>
  (prompt.match(/\d[\d,]*\d|\d/g) ?? []).map(parse);
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `as-${i}`));

test("addition and subtraction families are deterministic, valid and exact", () => {
  for (const id of ids)
    for (const [i, p] of sample(id).entries()) {
      assert.deepEqual(p, generateProblem(id, `as-${i}`));
      generatedProblemSchema.parse(p);
      assert.equal(templateRole(id), "assessment");
      assert.equal(p.public.response.kind, "number");
      const [a, b] = numbersIn(p.public.prompt) as [number, number];
      const expected =
        id === "make-hundred"
          ? 100 - a
          : p.public.prompt.includes("+")
            ? a + b
            : a - b;
      assert.equal(Number(p.answer), expected, p.public.prompt);
      assert.ok(expected > 0);
      assert.equal(gradeAnswer(p, p.answer), true);
      assert.equal(gradeAnswer(p, String(expected + 1)), false);
      // The worked solution ends on the answer, written with separators.
      assert.ok(
        p.explanation.some((line) =>
          line.includes(expected.toLocaleString("en-US")),
        ),
        p.public.prompt,
      );
    }
});

test("operands stay in each skill's range", () => {
  const bounds: Record<string, [number, number, number]> = {
    "add-two-digit-regroup": [10, 99, 100],
    "subtract-two-digit-regroup": [10, 100, 100],
    "add-three-digit": [100, 999, 1000],
    "subtract-three-digit": [100, 1000, 1000],
    "add-multidigit": [1000, 999999, 999999],
    "subtract-multidigit": [1000, 999999, 999999],
  };
  for (const [id, [low, high, limit]] of Object.entries(bounds))
    for (const p of sample(id)) {
      const [a, b] = numbersIn(p.public.prompt) as [number, number];
      for (const n of [a, b]) assert.ok(n >= low && n <= high, p.public.prompt);
      assert.ok(Number(p.answer) <= limit);
    }
  for (const p of sample("add-two-digit-regroup", 50))
    assert.deepEqual(p.public.figure, {
      kind: "base-ten-pair",
      values: numbersIn(p.public.prompt),
    });
});

test("hard cases appear: regrouping in each place, zeros, and controls", () => {
  const share = (id: string, has: (a: number, b: number) => boolean) =>
    sample(id, 400).filter((p) => {
      const [a, b] = numbersIn(p.public.prompt) as [number, number];
      return has(a, b);
    }).length / 400;
  const twoRegroup = share("add-two-digit-regroup", (a, b) =>
    carries(a, b).includes(0),
  );
  assert.ok(twoRegroup > 0.6 && twoRegroup < 0.95, `${twoRegroup}`);
  const across = share(
    "subtract-three-digit",
    (a, b) => borrows(a, b).acrossZero,
  );
  assert.ok(across > 0.15, `${across}`);
  const controls = share(
    "subtract-three-digit",
    (a, b) => !borrows(a, b).at.length,
  );
  assert.ok(controls > 0.08 && controls < 0.3, `${controls}`);
  const zeros = share(
    "subtract-multidigit",
    (a, b) => borrows(a, b).acrossZero && /[1-9]00/.test(String(a)),
  );
  assert.ok(zeros > 0.4, `${zeros}`);
  const newPlace = share(
    "add-multidigit",
    (a, b) => String(a + b).length > String(Math.max(a, b)).length,
  );
  assert.ok(newPlace > 0.2 && newPlace < 0.5, `${newPlace}`);
});

test("column helpers match place-value arithmetic", () => {
  assert.deepEqual(carries(47, 38), [0]);
  assert.deepEqual(carries(999, 1), [0, 1, 2]);
  assert.deepEqual(borrows(503, 268), { at: [0], acrossZero: true });
  assert.deepEqual(borrows(523, 287), { at: [0, 1], acrossZero: false });
  assert.deepEqual(borrows(40003, 12456), { at: [0], acrossZero: true });
});

test("openers include the whole addition and subtraction items", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of [
    "add-two-digit-regroup",
    "subtract-two-digit-regroup",
    "add-three-digit",
    "add-multidigit",
  ])
    assert.ok(openers.has(id), id);
});

test("the regroup animation conserves the sum", () => {
  let trades = 0;
  for (let i = 0; i < 80; i++) {
    const lesson = problemLesson("add-two-digit-regroup", `animation-${i}`);
    const model = animationModel(lesson);
    assert.ok(model && model.kind === "regroup-sum");
    const [a, b] = model.figure.values;
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    assert.ok(frames[2]!.math.endsWith(`= ${a + b}$`), frames[2]!.math);
    assert.equal(Number(lesson.example.answer), a + b);
    if ((a % 10) + (b % 10) >= 10) trades++;
  }
  assert.ok(trades > 30);
});

test("every family has one illustrated reference lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
  }
});
