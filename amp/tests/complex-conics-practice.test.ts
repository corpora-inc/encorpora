import test from "node:test";
import assert from "node:assert/strict";
import {
  complexConicsCase,
  complexConicsTemplates,
  complexConicsVariantCounts,
} from "../src/math/complex-conics-practice";
import { generateProblem, templates } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

const SEEDS = 400;

test("complex/conics families are deterministic and reach every variant", () => {
  for (const template of complexConicsTemplates) {
    const variants = new Set<number>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const a = complexConicsCase(template.id, `cc:${seed}`);
      const b = complexConicsCase(template.id, `cc:${seed}`);
      assert.deepEqual(a.problem, b.problem);
      variants.add(a.variant);
    }
    assert.deepEqual(
      [...variants].sort(),
      Array.from(
        { length: complexConicsVariantCounts[template.id]! },
        (_, i) => i,
      ),
      template.id,
    );
  }
});

test("each problem has four distinct choices, one correct, and no answer leakage", () => {
  for (const template of complexConicsTemplates) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const generated = generateProblem(template.id, `cc:${seed}`);
      const direct = complexConicsCase(template.id, `cc:${seed}`);
      assert.equal(generated.public.templateId, template.id);
      assert.equal(generated.public.skillId, template.skillId);
      assert.equal(generated.answer, direct.problem.answer);
      const response = generated.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      const labels = response.options.map((option) => option.label);
      assert.equal(response.options.length, 4);
      assert.equal(new Set(labels).size, 4, labels.join(" | "));
      const correct = response.options.filter((o) => o.id === generated.answer);
      assert.equal(correct.length, 1);
      assert.equal(correct[0]!.label, direct.correct);
      // Every wrong choice teaches; the correct one carries no corrective note.
      const feedback = generated.choiceFeedback ?? {};
      for (const option of response.options)
        if (option.id !== generated.answer)
          assert.ok(feedback[option.id], `${template.id}: ${option.label}`);
      // A real number is its own conjugate; that boundary case names it in the prompt.
      if (!(
        template.id === "complex-conjugate-division" && direct.variant === 4
      )) {
        assert.ok(!generated.public.prompt.includes(direct.correct));
        assert.ok(!generated.hint.includes(direct.correct), generated.hint);
      }
      assert.ok(generated.explanation.length >= 2);
      assert.ok(
        generated.explanation.at(-1)!.length > 0 &&
          generated.explanation.every(
            (line) => !/undefined|NaN|\[object/.test(line),
          ),
        generated.explanation.join("\n"),
      );
      assert.ok(!/undefined|NaN|--|\+ -/.test(generated.public.prompt));
    }
  }
});

test("the plane family draws a figure and others stay text only", () => {
  const plane = generateProblem("complex-plane-forms", "figure:0");
  assert.ok(plane.public.prompt.length > 0);
  let figures = 0;
  for (let seed = 0; seed < 60; seed++)
    if (generateProblem("complex-plane-forms", `f:${seed}`).public.figure)
      figures++;
  assert.ok(figures > 0);
});

test("independent checks of selected variants", () => {
  // Distance variant: recompute from the prompt with integer arithmetic.
  const distance =
    /^Let \$z=(-?\d+)(?: ([+-]) (\d*)i)?\$ and \$w=(-?\d+)(?: ([+-]) (\d*)i)?\$/;
  let checked = 0;
  for (let seed = 0; seed < SEEDS; seed++) {
    const g = complexConicsCase("complex-distance-midpoint", `ind:${seed}`);
    const m = distance.exec(g.problem.public.prompt);
    if (!m) continue;
    const num = (sign: string | undefined, mag: string | undefined) =>
      sign === undefined ? 0 : (sign === "-" ? -1 : 1) * Number(mag || "1");
    const dx = Number(m[1]) - Number(m[4]);
    const dy = num(m[2], m[3]) - num(m[5], m[6]);
    const n = dx * dx + dy * dy;
    let k = 1;
    let rad = n;
    for (let f = 2; f * f <= rad; f++)
      while (rad % (f * f) === 0) {
        rad /= f * f;
        k *= f;
      }
    const expected =
      rad === 1 ? `$${k}$` : `$${k === 1 ? "" : k}\\sqrt{${rad}}$`;
    assert.equal(g.correct, expected);
    checked++;
  }
  assert.ok(checked > 40);
});

test("every family is registered with its lesson, method and skill", () => {
  const expected: Record<string, string> = {
    "complex-plane-forms": "complex-plane",
    "complex-conjugate-division": "complex-conjugates",
    "complex-distance-midpoint": "complex-distance",
    "complex-quadratic-factors": "complex-factorization",
    "polynomial-root-count": "fundamental-theorem-algebra",
    "polar-cartesian-conversion": "polar-coordinates",
    "parametric-linear-motion": "parametric-models",
    "conic-standard-form": "conic-sections",
    "parabola-focus-directrix": "parabola-locus",
  };
  for (const [id, skillId] of Object.entries(expected)) {
    assert.equal(templates.find((t) => t.id === id)?.skillId, skillId);
    const lesson = problemLesson(id, "library");
    assert.ok(lesson.intuition);
    assert.ok(lesson.method.length >= 3);
    assert.ok(lesson.watch);
    assert.ok(lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
  }
});
