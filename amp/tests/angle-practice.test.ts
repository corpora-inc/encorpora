import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { angleTemplates } from "../src/math/angle-practice";
import { templateRole } from "../src/learning/placement";
import { problemLesson } from "../src/content/problem-lessons";
import {
  animationFrames,
  animationModel,
} from "../src/web/lesson-animation/model";

test("angle problems are deterministic, valid and balanced", () => {
  for (const t of angleTemplates) {
    assert.equal(t.requiredFigureCapability, "angle-figures-v1");
    const answers = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `angle-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `angle-${i}`));
      generatedProblemSchema.parse(p);
      answers.set(p.answer, (answers.get(p.answer) ?? 0) + 1);
    }
    for (const [answer, n] of answers)
      assert.ok(n < 120, `${t.id} answers ${answer} ${n} times in 200`);
  }
});

test("a protractor angle is read from the scale at 0 on its first ray", () => {
  for (let i = 0; i < 100; i++) {
    const p = generateProblem("protractor-reading", `scale-${i}`);
    const f = p.public.figure!;
    assert(f.kind === "protractor");
    assert.equal(Number(p.answer), Math.abs(f.rays[1] - f.rays[0]));
  }
});

test("the protractor lesson sweeps its own example", () => {
  for (let i = 0; i < 40; i++) {
    const lesson = problemLesson("protractor-reading", `animation-${i}`);
    const model = animationModel(lesson);
    assert(model?.kind === "protractor-sweep");
    assert.equal(String(model.measure), lesson.example.answer);
    const frames = animationFrames(model);
    assert.equal(frames.length, 3);
    assert.ok(frames[2]!.math.includes(`${model.measure}^\\circ`));
  }
});

test("every angle item is a whole assessment item", () => {
  for (const t of angleTemplates)
    assert.equal(templateRole(t.id), "assessment");
});
