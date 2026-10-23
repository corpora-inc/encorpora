import assert from "node:assert/strict";
import test from "node:test";
import { fractionBookAlignments } from "../books/fraction-field-guide/alignments.js";
import { fractionPracticeBindings } from "../src/content/fraction-practice-coverage.js";
import { problemLesson } from "../src/content/problem-lessons.js";
import { generatedProblemSchema } from "../src/math/contracts.js";
import { generateProblem, templates } from "../src/math/engine.js";

const templateId = "fraction-division-expression";
type Rational = { numerator: bigint; denominator: bigint };
const gcd = (a: bigint, b: bigint): bigint => (b ? gcd(b, a % b) : a);
function canonical(numerator: bigint, denominator: bigint): string {
  assert.notEqual(denominator, 0n);
  const sign = denominator < 0n ? -1n : 1n;
  const common = gcd(
    numerator < 0n ? -numerator : numerator,
    denominator < 0n ? -denominator : denominator,
  );
  return `${(sign * numerator) / common}/${(sign * denominator) / common}`;
}
function publicFraction(prompt: string): Rational {
  const match = prompt.match(/\\frac\{(\d+)\}\{(\d+)\}/);
  assert.ok(match, prompt);
  return { numerator: BigInt(match[1]!), denominator: BigInt(match[2]!) };
}
function expressionValue(label: string): string {
  const expression = label.match(/^\$(\d+) \\(div|times) (\d+)\$$/);
  assert.ok(expression, label);
  const left = BigInt(expression[1]!);
  const right = BigInt(expression[3]!);
  return expression[2] === "div"
    ? canonical(left, right)
    : canonical(left * right, 1n);
}

test("public fraction-expression choices have one exact answer and four distinct values", () => {
  const variants = new Set<string>();
  for (let seed = 0; seed < 512; seed++) {
    const problem = generateProblem(templateId, `public-${seed}`);
    generatedProblemSchema.parse(problem);
    const { numerator, denominator } = publicFraction(problem.public.prompt);
    assert.ok(denominator >= 2n && denominator <= 12n);
    assert.notEqual(numerator, denominator);
    if (numerator === 1n) variants.add("unit");
    else if (numerator < denominator) variants.add("proper");
    else {
      assert.ok(numerator < 2n * denominator);
      variants.add("improper");
    }
    const response = problem.public.response;
    assert.equal(response.kind, "choice");
    if (response.kind !== "choice") throw new Error("Expected choices");
    assert.equal(response.options.length, 4);
    const target = canonical(numerator, denominator);
    const values = response.options.map((option) =>
      expressionValue(option.label),
    );
    assert.equal(new Set(values).size, 4);
    assert.equal(values.filter((value) => value === target).length, 1);
    assert.equal(
      response.options.find(
        (option) => expressionValue(option.label) === target,
      )?.id,
      problem.answer,
    );
    assert.ok(problem.hint.includes(String(numerator)));
    assert.ok(problem.hint.includes(String(denominator)));
    assert.ok(
      !problem.hint.includes(
        response.options.find((option) => option.id === problem.answer)!.label,
      ),
    );
  }
  assert.deepEqual([...variants].sort(), ["improper", "proper", "unit"]);
});

test("the recognition family reuses the existing skill, sharing page and a standalone short lesson", () => {
  const template = templates.find((candidate) => candidate.id === templateId);
  assert.equal(template?.skillId, "fraction-as-division");
  assert.equal(template?.requiredResponseCapability, "single-choice-v1");
  const binding = fractionPracticeBindings.find(
    (item) => item.templateId === templateId,
  );
  assert.deepEqual(binding?.pageIds, ["sharing"]);
  assert.deepEqual(binding?.componentIds, ["5.NF.B.3"]);
  assert.ok(
    fractionBookAlignments
      .find((item) => item.id === "meaning-share")
      ?.templateIds.includes(templateId),
  );
  const lesson = problemLesson(templateId, "standalone");
  assert.match(lesson.intuition ?? "", /numerator/);
  assert.match(lesson.intuition ?? "", /denominator/);
  assert.ok(lesson.method.length >= 2);
  assert.match(lesson.watch ?? "", /order/);
  assert.match(lesson.principle ?? "", /\\div/);
});
