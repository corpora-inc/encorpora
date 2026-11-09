import assert from "node:assert/strict";
import test from "node:test";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem } from "../src/math/engine";
import { regentsAlgebraTwoAlgebraGenerate } from "../src/math/regents-algebra-two-algebra-practice";
import {
  generateSatCompletionProblem,
  rationalDivideModel,
} from "../src/math/sat-completion-practice";

const words = (sentence: string) =>
  sentence
    .replace(/\$[^$]*\$/g, " math ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

test("the shared-factor division acceptance example keeps the canceled hole", () => {
  const model = rationalDivideModel(2, -3, 1, false);
  assert.match(model.prompt, /\\frac\{x\+2\}\{x-3\}\\div\\frac\{x\+2\}\{x\+1\}/);
  assert.match(model.correct, /\\frac\{x\+1\}\{x-3\}/);
  assert.match(model.correct, /\\\{3,-1,-2\\\}/);
  assert.ok(model.distractors.some((label) => label.includes("\\{3,-1\\}") || label.includes("\\{-3,-1\\}")));
  const at = (num: number, den: number) => num / den;
  const original = at(2, -3) / at(2, 1);
  const answer = at(1, -3);
  assert.equal(original, answer);
  assert.equal(original, -1 / 3);
  const multiplied = at(4, -3) / 1;
  assert.notEqual(multiplied, answer);
});

test("rational-expression families stay single-choice and practice division and closure", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const seed = `rational:${i}`;
    const legacy = generateProblem("rational-expression-operation", seed, 1);
    assert.equal(legacy.public.templateVersion, 1);
    assert.equal(legacy.variant, undefined);
    assert.match(legacy.public.prompt, /Retain the restrictions/);
    const problem = generateProblem("rational-expression-operation", seed);
    generatedProblemSchema.parse(problem);
    assert.deepEqual(generateSatCompletionProblem("rational-expression-operation", seed).public.prompt, problem.public.prompt);
    assert.equal(problem.public.response.kind, "choice");
    if (problem.public.response.kind !== "choice") continue;
    const labels = problem.public.response.options.map((o) => o.label);
    assert.equal(new Set(labels).size, 4);
    const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
    assert.equal(problem.public.prompt.includes(correct), false, seed);
    assert.equal(problem.hint.includes(correct), false, seed);
    for (const sentence of [...problem.explanation, problem.hint, problem.public.prompt].flatMap((text) =>
      text.split(/(?<=[.!?])\s+/),
    ))
      assert.ok(words(sentence) <= 35, `${seed}: ${sentence}`);
    seen.add(problem.variant?.axes?.task ?? "combine");
    if (problem.variant?.axes?.task === "closure-statement") {
      assert.match(problem.public.prompt, /polynomial over a polynomial/);
      assert.match(correct, /not the zero expression/);
      assert.match(problem.explanation.join(" "), new RegExp(`x=${"\\d+"}`));
    }
    if (problem.variant?.axes?.task === "divide")
      assert.match(correct, /excluded/);
  }
  for (const task of ["combine", "divide", "twin-value", "letter-result", "closure-statement"])
    assert.ok(seen.has(task), task);
});

test("radicals print square roots and cube roots without an index 2 or a power 1", () => {
  const broken = /\\sqrt\[2\]|x\^\{1\}(?!\/)/;
  for (let i = 0; i < 60; i++) {
    const problem = generateSatCompletionProblem("symbolic-rational-exponent", `radical:${i}`);
    const text = [problem.public.prompt, problem.hint, ...problem.explanation].join("\n");
    assert.equal(broken.test(text), false, text);
    if (problem.public.response.kind === "choice")
      for (const option of problem.public.response.options)
        assert.equal(broken.test(option.label), false, option.label);
  }
  for (let i = 0; i < 40; i++) {
    const problem = regentsAlgebraTwoAlgebraGenerate("rational-exponent-product", `power:${i}`);
    const text = [problem.public.prompt, problem.hint, ...problem.explanation].join("\n");
    assert.equal(broken.test(text), false, text);
  }
});
