import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine";
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
const variantCount: Record<string, number> = {
  "polynomial-behavior-description": 5,
  "rational-function-features": 5,
  "graphical-solution-table": 4,
  "polynomial-identity-use": 6,
  "binomial-coefficient": 5,
  "number-system-closure-classify": 6,
  "polynomial-graph-match": 1,
};
const skills: Record<string, string> = {
  "polynomial-behavior-description": "polynomial-behavior",
  "rational-function-features": "rational-function-behavior",
  "graphical-solution-table": "graphical-equation-solving",
  "polynomial-identity-use": "polynomial-identities",
  "binomial-coefficient": "binomial-theorem",
  "number-system-closure-classify": "number-system-closure",
  "polynomial-graph-match": "polynomial-behavior",
};

for (const [id, make] of Object.entries(cases)) {
  test(`${id}: deterministic, reachable, one correct among four distinct choices`, () => {
    const variants = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const key = `fb:${seed}`;
      const one = make(key);
      const two = make(key);
      assert.deepEqual(one.problem, two.problem);
      const generated = generateProblem(id, key);
      assert.equal(generated.answer, one.problem.answer);
      assert.equal(generated.public.prompt, one.problem.public.prompt);
      assert.deepEqual(generated.public.response, one.problem.public.response);
      variants.add(one.variant);
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
      assert.equal(generated.public.skillId, skills[id]);
    }
    assert.equal(variants.size, variantCount[id], `variants of ${id}`);
  });
}

test("function-behavior templates are registered and carry lessons", () => {
  for (const t of functionBehaviorTemplates) {
    assert.ok(templates.some((x) => x.id === t.id));
    const lesson = problemLesson(t.id, "library");
    assert.ok(lesson.intuition && lesson.method.length >= 2);
    assert.ok(lesson.watch && lesson.principle);
    assert.ok(lesson.example.steps.length >= 3);
  }
});
