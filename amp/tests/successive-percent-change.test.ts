import assert from "node:assert/strict";
import test from "node:test";
import { generatedProblemSchema } from "../src/math/contracts";
import {
  generateSuccessivePercentChangeProblem,
  successivePercentChangeCase,
  successivePercentChangeTemplate,
} from "../src/math/successive-percent-change";

test("successive percent change has one stable numeric contract", () => {
  assert.equal(successivePercentChangeTemplate.id, "successive-percent-change");
  assert.equal(successivePercentChangeTemplate.skillId, "percent-change");
  assert.equal(successivePercentChangeTemplate.gradeBand, "6–8");
  assert.equal(successivePercentChangeTemplate.version, 1);
  for (let seed = 0; seed < 600; seed++) {
    const value = `sample-${seed}`;
    const { problem, tags, caseKey } = successivePercentChangeCase(value);
    generatedProblemSchema.parse(problem);
    assert.deepEqual(generateSuccessivePercentChangeProblem(value), problem);
    assert.equal(problem.public.templateId, successivePercentChangeTemplate.id);
    assert.equal(problem.public.response.kind, "number");
    assert.match(problem.public.prompt, /starting price of \$\d+\.\d{2}/);
    assert.match(
      problem.public.prompt,
      /First, the price (increases|decreases) by \d+(?:\.\d+)?%/,
    );
    assert.match(
      problem.public.prompt,
      /Then, the price (increases|decreases) by \d+(?:\.\d+)?% of the price after the first change/,
    );
    assert.match(
      problem.public.prompt,
      /round only the final price to the nearest cent, with halfway amounts rounded up/,
    );
    assert.match(problem.answer, /^\d+\.\d{2}$/);
    assert.ok(problem.hint.includes("starting price"));
    assert.ok(problem.hint.includes("price after the first change"));
    assert.equal(problem.explanation.length, 6);
    assert.ok(tags.length >= 3);
    assert.ok(caseKey.length > 0);
  }
});

test("fixed public cases cover changing bases, exact cents, ties, and three-decimal tax", () => {
  const examples = [
    {
      seed: "sample-0",
      first: "15.121875",
      exact: "20.41453125",
      answer: "20.41",
      tag: "decrease-then-increase",
    },
    {
      seed: "sample-2",
      first: "238.55",
      exact: "214.695",
      answer: "214.70",
      tag: "half-cent-tie",
    },
    {
      seed: "sample-4",
      first: "150.7365",
      exact: "107.022915",
      answer: "107.02",
      tag: "equal-opposite-after-increase",
    },
    {
      seed: "sample-7",
      first: "113.16",
      exact: "84.87",
      answer: "84.87",
      tag: "exact-cent",
    },
    {
      seed: "sample-18",
      first: "139.6845",
      exact: "152.081499375",
      answer: "152.08",
      tag: "discount-then-tax",
    },
  ] as const;
  for (const example of examples) {
    const { problem, tags } = successivePercentChangeCase(example.seed);
    assert.equal(problem.answer, example.answer);
    assert.ok(tags.includes(example.tag), example.seed);
    assert.ok(problem.explanation[1]!.includes(example.first));
    assert.ok(problem.explanation[3]!.includes(example.exact));
    assert.ok(problem.explanation[5]!.includes(example.answer));
  }
  assert.match(
    successivePercentChangeCase("sample-18").problem.public.prompt,
    /8\.875%.*sales tax/,
  );
});

test("seed validation and variation remain bounded", () => {
  assert.throws(() => successivePercentChangeCase(""));
  assert.throws(() => successivePercentChangeCase("x".repeat(129)));
  const cases = Array.from({ length: 600 }, (_, i) =>
    successivePercentChangeCase(`sample-${i}`),
  );
  const tags = new Set(cases.flatMap((entry) => entry.tags));
  for (const required of [
    "increase-then-increase",
    "increase-then-decrease",
    "decrease-then-increase",
    "decrease-then-decrease",
    "equal-opposite-after-increase",
    "equal-opposite-after-decrease",
    "two-discounts",
    "discount-then-tax",
    "integer-rates",
    "decimal-rate",
    "exact-cent",
    "rounded-cent",
    "half-cent-tie",
  ])
    assert.ok(tags.has(required), required);
  assert.ok(new Set(cases.map((entry) => entry.caseKey)).size > 550);
});
