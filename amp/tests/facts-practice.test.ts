import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { factsTemplates } from "../src/math/facts-practice";
import { generatedProblemSchema } from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = factsTemplates.map((t) => t.id);
const numbers = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `facts-${i}`));

test("facts families are deterministic, valid, numeric and gradeable", () => {
  for (const id of ids)
    for (const [i, problem] of sample(id).entries()) {
      assert.deepEqual(problem, generateProblem(id, `facts-${i}`));
      generatedProblemSchema.parse(problem);
      assert.equal(problem.public.response.kind, "number");
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(problem, problem.answer), true);
      assert.equal(
        gradeAnswer(problem, String(Number(problem.answer) + 1)),
        false,
      );
    }
});

test("each answer follows from the displayed numbers", () => {
  const sign = (p: string) => (p.includes("+") ? 1 : -1);
  for (const p of sample("facts-to-five")) {
    const [a, b] = numbers(p.public.prompt);
    const value = a! + sign(p.public.prompt) * b!;
    assert.ok(a! <= 5 && b! <= 5 && value >= 0 && value <= 5);
    assert.equal(Number(p.answer), value);
  }
  for (const p of sample("count-on-back")) {
    const [start, steps] = numbers(p.public.prompt);
    assert.deepEqual(p.public.figure, {
      kind: "number-line",
      min: 0,
      max: 20,
      points: [start],
    });
    const on = p.public.prompt.includes("Count on");
    assert.equal(Number(p.answer), start! + (on ? steps! : -steps!));
  }
  for (const p of sample("counted-steps")) {
    const [start, ...said] = numbers(p.public.prompt);
    said.pop(); // the start repeated in the question
    assert.equal(Number(p.answer), said.length);
    const step = p.public.prompt.includes("added") ? 1 : -1;
    said.forEach((n, i) => assert.equal(n, start! + step * (i + 1)));
  }
  for (const p of sample("make-ten-fact")) {
    const [a, b] = numbers(p.public.prompt);
    assert.deepEqual(p.public.figure, {
      kind: "ten-frame-pair",
      first: a,
      second: b,
    });
    assert.ok(a! + b! > 10 && a! < 10 && b! < 10);
    assert.equal(Number(p.answer), a! + b!);
  }
  for (const p of sample("related-subtraction")) {
    const [a, b] = numbers(p.public.prompt);
    assert.ok(a! <= 20 && b! <= 9);
    assert.equal(Number(p.answer), a! - b!);
  }
  for (const p of sample("mental-ten-hundred")) {
    const [n, step] = numbers(p.public.prompt);
    assert.ok(n! >= 100 && n! <= 900 && (step === 10 || step === 100));
    assert.equal(Number(p.answer), n! + sign(p.public.prompt) * step!);
  }
});

test("facts items reach their hard cases", () => {
  const share = (id: string, hit: (p: string, answer: number) => boolean) =>
    sample(id, 400).filter((p) => hit(p.public.prompt, Number(p.answer)))
      .length / 400;
  const across = share(
    "count-on-back",
    (p, a) => numbers(p)[0]! < 10 !== a < 10,
  );
  assert.ok(across > 0.3, `${across}`);
  const borrow = share("related-subtraction", (p) => {
    const [a, b] = numbers(p);
    return a! % 10 < b!;
  });
  assert.ok(borrow > 0.6, `${borrow}`);
  const regroup = share("mental-ten-hundred", (p, a) => {
    const [n, step] = numbers(p);
    return step === 10 && Math.floor(n! / 100) !== Math.floor(a / 100);
  });
  assert.ok(regroup > 0.15 && regroup < 0.4, `${regroup}`);
});

test("facts openers are numeric and in their grade bands", () => {
  const openers = new Set(openerSlots.flat(2));
  for (const id of ids.filter((id) => id !== "counted-steps"))
    assert.ok(openers.has(id), id);
});

test("the make-ten animation moves exactly the counters that fill the ten", () => {
  for (let i = 0; i < 60; i++) {
    const lesson = problemLesson("make-ten-fact", `animation-${i}`);
    const model = animationModel(lesson);
    assert.ok(model && model.kind === "make-ten");
    if (model?.kind !== "make-ten") continue;
    const { first: a, second: b } = model.figure;
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    assert.equal(frames[1]!.math, `$${b} = ${10 - a} + ${a + b - 10}$`);
    assert.equal(
      frames[2]!.math,
      `$${a} + ${b} = 10 + ${a + b - 10} = ${a + b}$`,
    );
    assert.equal(Number(lesson.example.answer), a + b);
  }
});

test("every facts family has one illustrated reference lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
  }
});
