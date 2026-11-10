import { skills as curriculumSkills } from "../src/curriculum/catalog";
import test from "node:test";
import assert from "node:assert/strict";
import { templates } from "../src/math/engine";
import { generateProblem } from "./fixtures/pre-clause-problem";
import {
  functionBehaviorTemplates,
  polynomialBehaviorCase,
  rationalFunctionCase,
  graphicalSolutionCase,
  polynomialIdentityCase,
  binomialCoefficientCase,
  numberSystemClosureCase,
  polynomialGraphMatchCase,
} from "../src/math/function-behavior-practice";
import { problemLesson } from "../src/content/problem-lessons";

const cases = {
  "polynomial-behavior-description": polynomialBehaviorCase,
  "rational-function-features": rationalFunctionCase,
  "graphical-solution-table": graphicalSolutionCase,
  "polynomial-identity-use": polynomialIdentityCase,
  "binomial-coefficient": binomialCoefficientCase,
  "number-system-closure-classify": numberSystemClosureCase,
  "polynomial-graph-match": polynomialGraphMatchCase,
} as const;

for (const [id, make] of Object.entries(cases)) {
  test(`${id}: deterministic, reachable, one correct among four distinct choices`, () => {
    const template = functionBehaviorTemplates.find((t) => t.id === id)!;
    assert.ok(template, id);
    assert.ok(curriculumSkills.some((s) => s.id === template.skillId), id);
    for (let seed = 0; seed < 400; seed++) {
      const key = `fb:${seed}`;
      const one = make(key);
      const two = make(key);
      assert.deepEqual(one.problem, two.problem);
      const generated = generateProblem(id, key);
      assert.equal(generated.answer, one.problem.answer);
      assert.equal(generated.public.prompt, one.problem.public.prompt);
      assert.deepEqual(generated.public.response, one.problem.public.response);
      const response = generated.public.response;
      assert.equal(response.kind, "choice");
      if (response.kind !== "choice") continue;
      const labels = response.options.map((o) => o.label);
      assert.equal(labels.length, 4);
      assert.equal(new Set(labels).size, 4);
      const correct = response.options.find((o) => o.id === generated.answer)!;
      assert.ok(correct, "answer names an option");
      for (const o of response.options)
        if (o.id !== generated.answer)
          assert.ok(generated.choiceFeedback?.[o.id], `feedback ${o.id}`);
      assert.ok(!generated.public.prompt.includes(correct.label), key);
      assert.ok(!generated.hint.includes(correct.label), key);
      assert.ok(generated.explanation.length >= 2);
      assert.equal(generated.public.skillId, template.skillId);
    }
  });
}

test("function-behavior templates are registered and carry lessons", () => {
  for (const t of functionBehaviorTemplates) {
    assert.ok(templates.some((x) => x.id === t.id));
    const lesson = problemLesson(t.id, "library");
    assert.ok(lesson.intuition && lesson.method.length >= 2);
    assert.ok(lesson.watch && lesson.principle);
    assert.ok(lesson.example.steps.length >= 2);
  }
});
