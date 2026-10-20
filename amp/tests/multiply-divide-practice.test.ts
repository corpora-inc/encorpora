import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import {
  multiplyDivideTemplates,
  placeParts,
} from "../src/math/multiply-divide-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = multiplyDivideTemplates.map((t) => t.id);
const numbersIn = (prompt: string) =>
  (prompt.match(/\d[\d,]*\d|\d/g) ?? []).map((n) =>
    Number(n.replaceAll(",", "")),
  );

test("multiply-divide families are deterministic, valid and exact", () => {
  for (const id of ids)
    for (let i = 0; i < 300; i++) {
      const p = generateProblem(id, `md-${i}`);
      assert.deepEqual(p, generateProblem(id, `md-${i}`));
      generatedProblemSchema.parse(p);
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(p, p.answer), true);
      assert.equal(gradeAnswer(p, String(Number(p.answer) + 1)), false);
      const [a, b] = numbersIn(p.public.prompt);
      const answer = Number(p.answer);
      if (id === "division-remainder") {
        assert.ok(answer >= 1 && answer < b!);
        assert.equal((a! - answer) % b!, 0);
      } else if (p.public.prompt.includes("÷")) {
        assert.equal(answer * b!, a);
      } else assert.equal(answer, a! * b!);
      assert.ok(p.explanation.every((line) => !/\bNaN\b|undefined/.test(line)));
    }
});

test("the area model splits both factors by place value", () => {
  assert.deepEqual(placeParts(346), [300, 40, 6]);
  assert.deepEqual(placeParts(305), [300, 5]);
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("area-model-product", `md-${i}`);
    const [a, b] = numbersIn(p.public.prompt);
    assert.deepEqual(p.public.figure, {
      kind: "area-model",
      columns: placeParts(a!),
      rows: placeParts(b!),
    });
  }
});

test("hard cases appear: zeros, remainders and three-digit quotients", () => {
  const share = (
    id: string,
    keep: (p: ReturnType<typeof generateProblem>) => boolean,
  ) =>
    Array.from({ length: 400 }, (_, i) =>
      generateProblem(id, `share-${i}`),
    ).filter(keep).length / 400;
  const zeroQuotient = (p: ReturnType<typeof generateProblem>) =>
    p.answer.includes("0");
  assert.ok(share("divide-by-one-digit", zeroQuotient) > 0.15);
  assert.ok(share("divide-by-two-digit", zeroQuotient) > 0.05);
  assert.ok(share("divide-by-two-digit", (p) => p.answer.length === 3) > 0.1);
  assert.ok(
    share("multiply-multidigit", (p) =>
      /0/.test(numbersIn(p.public.prompt).join(" ")),
    ) > 0.15,
  );
  assert.ok(
    share(
      "division-remainder",
      (p) => Number(p.answer) === numbersIn(p.public.prompt)[1]! - 1,
    ) > 0.1,
  );
});

test("multiplication and division openers are numeric and short", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of [
    "multiply-by-tens",
    "multiply-by-one-digit",
    "divide-by-one-digit",
  ])
    assert.ok(openers.has(id), id);
  for (const id of ids)
    assert.equal(
      multiplyDivideTemplates.find((t) => t.id === id)!
        .requiredResponseCapability,
      undefined,
    );
});

test("the area-model animation conserves the product", () => {
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("area-model-product", `animation-${i}`);
    const model = animationModel(lesson);
    assert.ok(model && model.kind === "area-model");
    const { columns, rows } = model.figure;
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    const product = (columns[0]! + columns[1]!) * (rows[0]! + rows[1]!);
    assert.equal(Number(lesson.example.answer), product);
    assert.match(
      frames[2]!.math,
      new RegExp(
        `= ${String(product).replace(/\B(?=(\d{3})+(?!\d))/g, "\\{,\\}")}\\$$`,
      ),
    );
  }
});

test("every multiply-divide family has one illustrated reference lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(
      bound[0]!.sections.some((s) => s.illustration),
      id,
    );
  }
});
