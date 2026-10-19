import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { factArrayTemplates, factHint } from "../src/math/fact-arrays-practice";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts";
import { openerSlots, templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";

const ids = factArrayTemplates.map((t) => t.id);
const numbers = (text: string) => (text.match(/\d+/g) ?? []).map(Number);
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `arrays-${i}`));

test("fact-array families are deterministic, valid, numeric, figured and gradeable", () => {
  for (const id of ids)
    for (const [i, problem] of sample(id).entries()) {
      assert.deepEqual(problem, generateProblem(id, `arrays-${i}`));
      generatedProblemSchema.parse(problem);
      assert.ok(problem.public.figure, id);
      assert.equal(problem.public.response.kind, "number");
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(problem, problem.answer), true);
      assert.equal(
        gradeAnswer(problem, String(Number(problem.answer) + 1)),
        false,
      );
      // A hint names the givens but never states the answer.
      assert.ok(
        !numbers(problem.hint).includes(Number(problem.answer)) ||
          numbers(problem.public.prompt).includes(Number(problem.answer)) ||
          id === "times-table-pattern",
        `${id}: ${problem.hint}`,
      );
    }
});

test("a covered array never carries the side it asks for", () => {
  for (const id of ["divide-facts", "missing-factor-fact"])
    for (const p of sample(id)) {
      const f = p.public.figure!;
      assert.equal(f.kind, "dot-array");
      if (f.kind !== "dot-array") continue;
      const answer = Number(p.answer);
      if (f.show === "first-column") {
        assert.equal(f.columns, undefined);
        assert.equal(f.total! / f.rows!, answer);
      } else {
        assert.equal(f.show, "first-row");
        assert.equal(f.rows, undefined);
        assert.equal(f.total! / f.columns!, answer);
      }
    }
  assert.throws(() =>
    semanticFigureSchema.parse({
      kind: "dot-array",
      show: "first-column",
      rows: 7,
      columns: 8,
      total: 56,
    }),
  );
});

test("each answer follows from the displayed givens", () => {
  for (const p of sample("multiply-facts")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "dot-array" && f.show === "edges");
    if (f.kind !== "dot-array") continue;
    assert.equal(Number(p.answer), f.rows! * f.columns!);
    const shown = numbers(p.public.prompt);
    if (shown.length)
      assert.ok(shown.includes(f.rows!) && shown.includes(f.columns!));
  }
  for (const p of sample("share-or-group")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "share-model");
    if (f.kind !== "share-model") continue;
    assert.deepEqual(numbers(p.public.prompt), [f.total, f.count]);
    assert.equal(Number(p.answer) * f.count, f.total);
  }
  for (const p of sample("times-table-pattern")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "times-table");
    if (f.kind !== "times-table") continue;
    assert.equal(Number(p.answer), f.rows[f.ask[0]]! * f.columns[f.ask[1]]!);
  }
});

test("fact items reach every frame and the hard facts", () => {
  const frames = (id: string) =>
    new Set(sample(id, 400).map((p) => p.public.prompt.replace(/\d+/g, "#")));
  assert.ok(frames("multiply-facts").size >= 4);
  assert.ok(frames("divide-facts").size >= 4);
  assert.ok(frames("missing-factor-fact").size >= 4);
  assert.ok(frames("share-or-group").size >= 6);
  assert.ok(frames("times-table-pattern").size >= 4);
  const hard = sample("multiply-facts", 400).filter((p) => {
    const f = p.public.figure!;
    return (
      f.kind === "dot-array" &&
      f.rows! >= 6 &&
      f.rows! <= 8 &&
      f.columns! >= 6 &&
      f.columns! <= 8
    );
  }).length;
  assert.ok(hard > 40, `${hard}`);
});

test("fact hints use a strategy and stop short of the product", () => {
  assert.equal(factHint(7, 2), "Double 7.");
  assert.equal(factHint(9, 6), "Find 6 × 10, then take away one group of 6.");
  assert.equal(
    factHint(7, 8),
    "Split 8 into 5 and 3: find 5 × 7 and 3 × 7, then add.",
  );
  for (let a = 2; a <= 10; a++)
    for (let b = 2; b <= 10; b++)
      assert.ok(!numbers(factHint(a, b)).includes(a * b), `${a} × ${b}`);
});

test("the grade 4 opener offers figured fact items", () => {
  const grade4 = openerSlots[4]!.flat();
  for (const id of ["multiply-facts", "divide-facts", "share-or-group"])
    assert.ok(grade4.includes(id), id);
});

test("array, turn and deal animations follow the example's figure", () => {
  for (let i = 0; i < 40; i++) {
    const m = animationModel(problemLesson("multiply-facts", `animation-${i}`));
    assert.equal(m?.kind, "array-build");
    if (m?.kind !== "array-build") continue;
    const frames = animationFrames(m);
    assert.equal(frames.length, 3);
    assert.equal(
      frames[2]!.math,
      `$${m.rows} \\times ${m.columns} = ${m.rows * m.columns}$`,
    );
  }
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("divide-facts", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "array-turn");
    if (m?.kind !== "array-turn") continue;
    const answer = Number(lesson.example.answer);
    assert.ok(answer === m.rows || answer === m.columns);
  }
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("share-or-group", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "deal");
    if (m?.kind !== "deal") continue;
    assert.equal(Number(lesson.example.answer) * m.count, m.total);
    assert.equal(animationFrames(m).length, 3);
  }
});

test("every fact-array family has one illustrated lesson and a distinct workbook", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(bound[0]!.sections.some((s) => s.illustration));
    const html = publicationHtml(bound[0]!, "workbook");
    assert.ok(html.includes("data-kind="), id);
  }
});
