import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";
import { problemLesson } from "../src/content/problem-lessons";

test("a lesson's worked example is another instance, never the learner's problem", () => {
  for (const template of templates) {
    const problem = generateProblem(template.id, "learner-seed");
    const lesson = problemLesson(
      template.id,
      problem.public.seed,
      problem.public.prompt,
    );
    assert.equal(lesson.templateId, template.id);
    assert.ok(lesson.intuition?.trim(), `${template.id} has a plain opening`);
    assert.ok(lesson.example.steps.length > 0);
    assert.ok(!/^option-/.test(lesson.example.answer), template.id);
    assert.deepEqual(
      lesson,
      problemLesson(template.id, problem.public.seed, problem.public.prompt),
    );
  }
});
