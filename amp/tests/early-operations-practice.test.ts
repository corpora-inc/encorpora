import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { earlyOperationsTemplates } from "../src/math/early-operations-practice";
import {
  generatedProblemSchema,
  semanticFigureSchema,
} from "../src/math/contracts";
import { templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";
import { lessons } from "../src/content/lessons";

const ids = earlyOperationsTemplates.map((t) => t.id);
const sample = (id: string, n = 300) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `early-${i}`));
const unknowns = (value: unknown): number =>
  value === null
    ? 1
    : Array.isArray(value)
      ? value.reduce((s: number, v) => s + unknowns(v), 0)
      : value && typeof value === "object"
        ? Object.values(value).reduce((s: number, v) => s + unknowns(v), 0)
        : 0;

test("early-operation families are deterministic, figured, valid and gradeable", () => {
  for (const id of ids)
    for (const [i, problem] of sample(id).entries()) {
      assert.deepEqual(problem, generateProblem(id, `early-${i}`));
      generatedProblemSchema.parse(problem);
      assert.ok(problem.public.figure, id);
      assert.equal(templateRole(id), "assessment");
      assert.equal(gradeAnswer(problem, problem.answer), true);
      assert.equal(
        gradeAnswer(problem, String(Number(problem.answer) + 1)),
        false,
      );
      // Every figure except three plain groups hides exactly one number.
      if (problem.public.figure!.kind !== "addend-groups")
        assert.equal(unknowns(problem.public.figure), 1, id);
    }
});

test("each figure agrees with its answer", () => {
  const sum = (v: (number | null)[]) =>
    v.reduce<number>((s, x) => s + (x ?? 0), 0);
  for (const p of sample("number-bond-missing")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "number-bond");
    if (f.kind !== "number-bond") continue;
    assert.equal(sum(f.parts) + Number(p.answer), f.whole);
  }
  for (const p of sample("unknown-addend-story")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "bar-model");
    if (f.kind !== "bar-model") continue;
    assert.equal(sum(f.parts) + Number(p.answer), f.whole);
  }
  for (const p of sample("balanced-addition")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "equal-balance");
    if (f.kind !== "equal-balance") continue;
    const box = f.left.includes(null) ? f.left : f.right,
      other = f.left.includes(null) ? f.right : f.left;
    assert.equal(sum(box) + Number(p.answer), sum(other));
  }
  for (const p of sample("three-addend-story")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "addend-groups");
    if (f.kind !== "addend-groups") continue;
    assert.equal(sum(f.addends), Number(p.answer));
    assert.doesNotMatch(
      p.public.prompt,
      /\b1 (red |blue |green )?(blocks|pages|points)\b/,
    );
  }
  for (const p of sample("two-step-change")) {
    const f = p.public.figure!;
    assert.ok(f.kind === "change-chain");
    if (f.kind !== "change-chain") continue;
    const a = Number(p.answer),
      start = f.start ?? a,
      values = f.steps.map((s) => s.value ?? a),
      end = f.end ?? a;
    let n = start;
    f.steps.forEach((s, i) => (n += s.op === "+" ? values[i]! : -values[i]!));
    assert.equal(n, end);
  }
  assert.throws(() =>
    semanticFigureSchema.parse({
      kind: "equal-balance",
      left: [5, 7],
      right: [4, 8],
    }),
  );
});

test("early-operation items reach every frame", () => {
  const frames = (id: string) =>
    new Set(sample(id, 400).map((p) => p.public.prompt.replace(/\d+/g, "#")));
  assert.ok(frames("number-bond-missing").size >= 4);
  assert.ok(frames("unknown-addend-story").size >= 4);
  assert.ok(frames("balanced-addition").size >= 4);
  assert.ok(frames("three-addend-story").size >= 4);
  assert.ok(frames("two-step-change").size >= 4);
  const tens = sample("three-addend-story", 400).filter((p) => {
    const f = p.public.figure!;
    if (f.kind !== "addend-groups") return false;
    const [a, b, c] = f.addends;
    return a + b === 10 || b + c === 10 || a + c === 10;
  }).length;
  assert.ok(tens > 150, `${tens}`);
});

test("balance, tape and make-ten animations follow the example's figure", () => {
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("balanced-addition", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "balance-level");
    if (m?.kind !== "balance-level") continue;
    const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
    assert.equal(sum(m.partial) + Number(lesson.example.answer), sum(m.full));
    assert.equal(animationFrames(m).length, 3);
  }
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("unknown-addend-story", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "tape-join");
    if (m?.kind !== "tape-join") continue;
    assert.equal(m.part + Number(lesson.example.answer), m.whole);
  }
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("three-addend-story", `animation-${i}`);
    const m = animationModel(lesson);
    assert.equal(m?.kind, "make-ten-three");
    if (m?.kind !== "make-ten-three") continue;
    const frames = animationFrames(m);
    assert.match(frames[2]!.math, new RegExp(`= ${lesson.example.answer}\\$$`));
  }
});

test("every early-operation family has one illustrated lesson", () => {
  for (const id of ids) {
    const bound = lessons.filter((lesson) => lesson.templateIds.includes(id));
    assert.equal(bound.length, 1, id);
    assert.ok(
      bound[0]!.sections.some((s) => s.illustration),
      id,
    );
  }
});
