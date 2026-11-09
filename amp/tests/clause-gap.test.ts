import assert from "node:assert/strict";
import { test } from "node:test";
import { forcedClause } from "../src/math/clause-gap.js";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
import { gradeStructuredWork } from "../src/math/structured-work.js";

const reprints: [string, string, string, string][] = [
  [
    "add-ones-regroup",
    "independent-0",
    "The blocks show 14. Add 8 ones. What is the new total?",
    "22",
  ],
  [
    "three-addend-story",
    "independent-0",
    "A team scored 4 points, then 4 points, then 2 points. How many points did the team score?",
    "10",
  ],
  ["add-within-20", "independent-0", "What is 14 + 0?", "14"],
  [
    "number-line-hops",
    "independent-0",
    "Start at 34. Hop forward 20, then forward 7. Where do you land?",
    "61",
  ],
  ["make-ten-fact", "independent-0", "What is 9 + 3?", "12"],
  ["money-total-dollars", "independent-0", "How much money is shown? Enter the amount in dollars, such as 2.35.", "6.36"],
];

test("version 1 reprints the pre-clause problems", () => {
  for (const [id, seed, prompt, answer] of reprints) {
    const problem = generateProblem(id, seed, 1);
    assert.equal(problem.public.prompt, prompt);
    assert.equal(problem.answer, answer);
    assert.equal(problem.public.templateVersion, 1);
    assert.equal(problem.variant?.axes?.clause, undefined);
  }
});

test("clause keys grade and fresh draws include the new tasks", () => {
  const tasks = [
    ["add-ones-regroup", "add-tens"],
    ["add-ones-regroup", "blocks-to-stack"],
    ["three-addend-story", "which-equation"],
    ["add-within-20", "near-double"],
    ["add-within-20", "within-10-fluency"],
    ["subtract-within-20", "within-10-fluency"],
    ["number-line-hops", "length-story"],
    ["number-line-hops", "from-zero"],
    ["add-several-two-digit", "tens-then-ones"],
    ["add-with-regrouping", "blocks-to-stack"],
    ["subtract-with-regrouping", "open-which"],
    ["make-ten-fact", "all-one-digit-sums"],
    ["related-subtraction", "all-one-digit-sums"],
    ["add-three-digit", "round-and-adjust"],
    ["subtract-three-digit", "count-up"],
    ["add-multidigit", "stack-work"],
    ["subtract-multidigit", "stack-work"],
    ["number-bond-missing", "two-ways"],
    ["ten-frame-complement", "record"],
    ["money-total-dollars", "write-with-symbols"],
    ["order-lengths", "full-order"],
    ["staar-nested-grouping", "brace-nesting"],
  ] as const;
  for (const [id, task] of tasks)
    for (let i = 0; i < 8; i++) {
      const problem = forcedClause(id, task, `clause-${i}`);
      assert.equal(gradeAnswer(problem, problem.answer), true, `${id}/${task}`);
      assert.equal(problem.variant?.id, task);
    }
  const seen = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const problem = generateProblem("add-ones-regroup", `mix-${i}`);
    if (problem.variant?.id) seen.add(problem.variant.id);
  }
  assert.ok(seen.has("add-tens"));
  assert.ok(seen.has("blocks-to-stack"));
});

test("adding tens keeps the ones digit and stays under 100", () => {
  for (let i = 0; i < 40; i++) {
    const problem = forcedClause("add-ones-regroup", "add-tens", `tens-${i}`);
    const start = Number(problem.public.prompt.match(/show (\d+)/)![1]);
    const total = Number(problem.answer);
    assert.equal(total % 10, start % 10);
    assert.ok(total <= 99);
    assert.notEqual(total - start, 10);
    assert.equal((total - start) % 10, 0);
  }
});

test("two ways to split 7 rejects a turned-around pair", () => {
  let problem = forcedClause("number-bond-missing", "two-ways", "seek-7");
  for (let i = 0; i < 30 && !problem.public.prompt.startsWith("Split 7 "); i++)
    problem = forcedClause("number-bond-missing", "two-ways", `seek-${i}`);
  assert.match(problem.public.prompt, /^Split 7 /);
  const response = problem.public.response;
  assert.equal(response.kind, "structured-work");
  if (response.kind !== "structured-work") return;
  const grading = problem.workGrading!;
  assert.equal(
    gradeStructuredWork(response, grading, JSON.stringify([["2", "5"], ["6", "1"]])),
    true,
  );
  assert.equal(
    gradeStructuredWork(response, grading, JSON.stringify([["3", "4"], ["4", "3"]])),
    false,
  );
  assert.equal(
    gradeStructuredWork(response, grading, JSON.stringify([["3", "5"], ["1", "6"]])),
    false,
  );
});

test("ten-frame complements use every filled count from 1 to 9", () => {
  const seen = new Map<number, number>();
  for (let i = 0; i < 400; i++) {
    const problem = generateProblem("ten-frame-complement", `frame-${i}`, 1);
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "ten-frame");
    if (figure?.kind !== "ten-frame") continue;
    seen.set(figure.first, (seen.get(figure.first) ?? 0) + 1);
    assert.equal(Number(problem.answer), 10 - figure.first);
  }
  for (let n = 1; n <= 9; n++) assert.ok((seen.get(n) ?? 0) >= 10, `filled ${n}`);
});
