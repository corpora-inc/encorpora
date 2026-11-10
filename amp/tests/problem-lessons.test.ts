import { test } from "node:test";
import assert from "node:assert/strict";
import { templates, generateProblem, generateProblemFor } from "../src/math/engine";
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

// Postgres JSONB returns stored objects with their keys reordered. A lesson
// for a stored proof must still recognise the learner's own givens and
// work another one, never the learner's proof.
test("a proof lesson never works the learner's own stored proof", () => {
  const reorder = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .reverse()
              .map((k) => [k, reorder((value as Record<string, unknown>)[k])]),
          )
        : value;
  const capabilities = ["structured-work-v1"];
  let checked = 0;
  for (let i = 0; checked < 40 && i < 2000; i++) {
    const served = generateProblemFor(
      "two-column-congruence-proof",
      `stored-proof-${i}`,
      ["scenes-v1"],
      undefined,
      capabilities,
    );
    if (served.variant?.axes?.clause !== "cpctc-relationship") continue;
    checked++;
    const stored = reorder(served) as typeof served;
    const lesson = problemLesson(
      stored.public.templateId,
      stored.public.seed,
      stored.public.prompt,
      stored.public.response,
      stored,
    );
    assert.notEqual(lesson.example.prompt, stored.public.prompt, `seed ${i}`);
  }
  assert.equal(checked, 40);
});
