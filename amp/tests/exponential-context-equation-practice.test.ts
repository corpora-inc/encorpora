import test from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateExponentialContextEquation } from "../src/math/exponential-context-equation-practice";
import { exponentialContextEquationLessons } from "../src/content/exponential-context-equation-lessons";

test("exponential context equations match bases and stay small integers", () => {
  assert.match(
    exponentialContextEquationLessons[0]!.summary,
    /does not add|not ask you to invent|choosing/i,
  );
  for (let i = 0; i < 300; i++) {
    const problem = generateExponentialContextEquation(
      "exponential-context-equation",
      `exp-${i}`,
    );
    generatedProblemSchema.parse(problem);
    assert.equal(problem.public.response.kind, "multi-part-choice");
    if (problem.public.response.kind !== "multi-part-choice") continue;
    const answer = JSON.parse(problem.answer) as { eq: string; n: string };
    const eq = problem.public.response.blanks[0]!.options.find((o) => o.id === answer.eq)!.label;
    const time = Number(
      problem.public.response.blanks[1]!.options.find((o) => o.id === answer.n)!.label,
    );
    assert.ok(time >= 1 && time <= 50 && Number.isInteger(time));
    if (problem.variant?.id === "decay") {
      const match = /starts with (\d+) atoms and has a half-life of (\d+) hours/.exec(
        problem.public.prompt,
      )!;
      const target = Number(/until (\d+) atoms/.exec(problem.public.prompt)![1]);
      const start = Number(match[1]);
      const half = Number(match[2]);
      assert.equal(start * 0.5 ** (time / half), target);
      assert.ok(eq.includes(String(start)) && eq.includes(`t/${half}`));
    } else {
      const match = /starts with (\d+) bacteria and multiplies by (\d+)/.exec(
        problem.public.prompt,
      )!;
      const target = Number(/there are (\d+) bacteria/.exec(problem.public.prompt)![1]);
      const start = Number(match[1]);
      const base = Number(match[2]);
      assert.equal(start * base ** time, target);
      const linear = (target - start) / base;
      assert.notEqual(linear, time);
      assert.ok(eq.includes(`${start}\\cdot ${base}^{t}`));
    }
    assert.equal(problem.public.response.blanks[1]!.options.length, 4);
    const values = problem.public.response.blanks[1]!.options.map((o) => o.label);
    assert.equal(new Set(values).size, 4);
  }
});
