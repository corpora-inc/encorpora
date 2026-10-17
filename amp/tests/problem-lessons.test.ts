import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem } from "../src/math/engine";
import { methods } from "../src/content/problem-methods";
import { principles } from "../src/content/problem-principles";
import { problemLesson } from "../src/content/problem-lessons";

test("every problem type has an authored lesson and no lesson is orphaned", () => {
  const ids = new Set(templates.map((template) => template.id));
  const missing = [...ids].filter((id) => !methods[id]);
  assert.deepEqual(missing, [], `Missing lessons: ${missing.join(", ")}`);
  const unprincipled = [...ids].filter((id) => !principles[id]);
  assert.deepEqual(
    unprincipled,
    [],
    `Missing principles: ${unprincipled.join(", ")}`,
  );
  assert.deepEqual(
    Object.keys(principles).filter((id) => !ids.has(id)),
    [],
  );
  const orphaned = Object.keys(methods).filter((id) => !ids.has(id));
  assert.deepEqual(orphaned, []);
  for (const [id, method] of Object.entries(methods)) {
    assert.ok(method.goal.length <= 140, `${id} goal is concise`);
    assert.ok(method.method.length >= 1 && method.method.length <= 4, id);
  }
});

test("a lesson's worked example is another instance, never the learner's problem", () => {
  for (const template of templates) {
    const problem = generateProblem(template.id, "learner-seed");
    const lesson = problemLesson(
      template.id,
      problem.public.seed,
      problem.public.prompt,
    );
    assert.equal(lesson.templateId, template.id);
    assert.ok(lesson.example.steps.length > 0);
    assert.ok(!/^option-/.test(lesson.example.answer), template.id);
    assert.deepEqual(
      lesson,
      problemLesson(template.id, problem.public.seed, problem.public.prompt),
    );
  }
});
