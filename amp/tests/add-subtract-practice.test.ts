import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  addSubtractTemplates,
  borrows,
  carries,
} from "../src/math/add-subtract-practice";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
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

/** Solve the public givens, including every intermediate slot and carry. */
function arithmetic(p: GeneratedProblem) {
  const [a, b] = numbersIn(p.public.prompt) as [number, number];
  const adding = p.public.prompt.includes("+");
  const total =
    p.public.templateId === "make-hundred" ? 100 - a : adding ? a + b : a - b;
  const response = p.public.response;
  const clause = p.variant?.axes?.clause;
  if (clause === "round-and-adjust" || clause === "count-up") {
    assert.equal(response.kind, "multi-part-choice");
    if (response.kind !== "multi-part-choice")
      throw new Error("Expected slots");
    const round = Math.round(b / 100) * 100;
    const ten = Math.ceil(b / 10) * 10;
    const hundred = Math.ceil(ten / 100) * 100;
    const values: Record<string, number> =
      clause === "round-and-adjust"
        ? {
            near: round,
            round: a + round,
            off: Math.abs(b - round),
            sum: total,
          }
        : { h1: ten - b, h2: hundred - ten, h3: a - hundred, diff: total };
    assert.deepEqual(
      response.blanks.map((blank) => blank.id),
      Object.keys(values),
    );
    const key: Record<string, string> = {};
    for (const blank of response.blanks) {
      const correct = blank.options.filter(
        (option) => parse(option.label) === values[blank.id],
      );
      assert.equal(correct.length, 1, blank.label);
      key[blank.id] = correct[0]!.id;
    }
    assert.deepEqual(JSON.parse(p.answer), key, p.public.prompt);
    assert.equal(gradeAnswer(p, JSON.stringify(key)), true);
    for (const blank of response.blanks) {
      const wrong = blank.options.find(
        (option) => option.id !== key[blank.id],
      )!;
      assert.equal(
        gradeAnswer(p, JSON.stringify({ ...key, [blank.id]: wrong.id })),
        false,
      );
    }
  } else if (clause === "stack-work") {
    assert.equal(response.kind, "structured-work");
    if (response.kind !== "structured-work") throw new Error("Expected stack");
    const width = Math.max(
      String(a).length,
      String(b).length,
      String(total).length,
    );
    const digits = String(total).padStart(width, "0").split("").reverse();
    const rows = digits.map((digit, i) => {
      // The lower i+1 places overflow precisely when they carry into the next.
      const place = 10 ** (i + 1);
      const carry = Math.floor(((a % place) + (b % place)) / place);
      return adding && i < width - 1 ? [digit, String(carry)] : [digit];
    });
    assert.deepEqual(
      response.rows.map((row) => row.fields.length),
      rows.map((row) => row.length),
    );
    assert.deepEqual(JSON.parse(p.answer), rows, p.public.prompt);
    assert.equal(gradeAnswer(p, JSON.stringify(rows)), true);
    for (const [i, row] of rows.entries())
      for (const [j, value] of row.entries()) {
        const wrong = rows.map((r) => [...r]);
        wrong[i]![j] = String((Number(value) + 1) % 10);
        assert.equal(gradeAnswer(p, JSON.stringify(wrong)), false);
      }
  } else {
    assert.equal(clause, undefined, `Unhandled clause ${clause}`);
    assert.equal(response.kind, "number");
    assert.equal(Number(p.answer), total, p.public.prompt);
    assert.equal(gradeAnswer(p, String(total)), true);
    assert.equal(gradeAnswer(p, String(total + 1)), false);
  }
  return total;
}

test("addition and subtraction families are deterministic, valid and exact", () => {
  const seen = new Set<string>();
  for (const id of ids)
    for (const [i, p] of sample(id).entries()) {
      assert.deepEqual(p, generateProblem(id, `as-${i}`));
      generatedProblemSchema.parse(p);
      assert.equal(templateRole(id), "assessment");
      seen.add(`${id}:${p.variant?.axes?.clause ?? "legacy"}`);
      const expected = arithmetic(p);
      assert.ok(expected > 0);
      assert.equal(gradeAnswer(p, p.answer), true);
      // Accept grouped or ungrouped digits in the worked solution.
      assert.ok(
        p.explanation.some((line) => numbersIn(line).includes(expected)),
        p.public.prompt,
      );
    }
  for (const id of ids) assert.ok(seen.has(`${id}:legacy`));
  for (const [id, clause] of [
    ["add-three-digit", "round-and-adjust"],
    ["subtract-three-digit", "count-up"],
    ["add-multidigit", "stack-work"],
    ["subtract-multidigit", "stack-work"],
  ])
    assert.ok(seen.has(`${id}:${clause}`), `${id}:${clause}`);
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
      if (p.variant?.axes?.clause === "round-and-adjust") {
        // The near-hundred addend includes 97–99; the other has three digits.
        assert.ok(a >= 105 && a <= 799, p.public.prompt);
        assert.ok(b >= 97 && b <= 703, p.public.prompt);
        assert.ok(Math.abs(b - Math.round(b / 100) * 100) <= 3);
      } else if (p.variant?.axes?.clause === "stack-work") {
        // Written stacks include a shorter second operand.
        assert.ok(a >= 1000 && a <= 99999, p.public.prompt);
        assert.ok(
          b >= 10 ** (String(a).length - 2) && b <= 99999,
          p.public.prompt,
        );
      } else {
        for (const n of [a, b])
          assert.ok(n >= low && n <= high, p.public.prompt);
      }
      assert.ok(arithmetic(p) <= limit, p.public.prompt);
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
