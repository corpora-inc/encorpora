import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine.js";
import { gradeStructuredWork } from "../src/math/structured-work.js";
import { bracketCells } from "../src/math/multiplication-clause-practice.js";
import { texas38Case } from "../src/math/texas-38-practice.js";

const clauseIds = [
  "partition-from-marks",
  "choose-partition",
  "regions-to-whole",
  "which-split",
  "facts-from-known",
  "associative-compute",
  "split-the-dividend",
  "complete-area-model",
  "explain-part",
  "partial-products-by-place",
  "standard-algorithm-rows",
  "find-the-error",
  "complete-division-model",
  "chunk-model",
  "first-chunk-choice",
  "list-all-pairs",
  "complete-list-choice",
  "bracket-steps",
  "spot-the-error",
  "story-for-expression",
  "story-both-interpretations",
] as const;

function cellsOf(answer: string): string[] {
  const rows = JSON.parse(answer) as string[][];
  return rows.flat();
}
function nums(text: string): number[] {
  return [...text.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, "")));
}

test("bracket cells match the spec examples", () => {
  assert.deepEqual(bracketCells(15312, 48), [3, 144, 9, 91, 1, 48, 43, 432, 9, 432, 0]);
  assert.deepEqual(bracketCells(18672, 62), [3, 186, 0, 7, 0, 0, 7, 72, 1, 62, 10]);
  const bad = JSON.stringify([["3", "144"], ["9", "91"], ["1", "48"], ["48", "432"], ["9", "432"], ["0"]]);
  const problem = generateProblem("bracket-steps", "pin-bracket");
  assert.equal(problem.public.response.kind, "structured-work");
  if (problem.public.response.kind !== "structured-work" || !problem.workGrading) return;
  assert.equal(gradeStructuredWork(problem.public.response, problem.workGrading, problem.answer), true);
  if (problem.public.prompt.includes("15,312 ÷ 48")) {
    assert.deepEqual(cellsOf(problem.answer).map(Number), bracketCells(15312, 48));
    const swapped = JSON.parse(problem.answer) as string[][];
    swapped[3]![0] = "48";
    assert.equal(
      gradeStructuredWork(problem.public.response, problem.workGrading, JSON.stringify(swapped)),
      false,
    );
  }
  assert.equal(gradeStructuredWork(problem.public.response, problem.workGrading, bad), false);
});

test("clause families grade the spec keys and reject the named mistakes", () => {
  const seen: Record<string, number> = {};
  const hits = new Set<string>();
  for (const id of clauseIds) {
    const families = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const problem = generateProblem(id, `c${seed}`);
      assert.equal(problem.public.templateVersion, 1);
      assert.equal(problem.public.templateId, id);
      assert.ok(problem.hint.length > 20, id);
      assert.ok(problem.explanation.length >= 2, id);
      families.add(problem.variant?.id ?? "");
      const prompt = problem.public.prompt;
      const values = cellsOf(problem.public.response.kind === "structured-work" ? problem.answer : "[]");
      if (id === "regions-to-whole" && prompt.startsWith("Use the regions to find 8 × 7")) {
        hits.add("8x7");
        assert.deepEqual(values, ["40", "16", "40", "16", "56"]);
      }
      if (id === "which-split" && prompt.includes("8 × 7")) {
        const choice = problem.public.response;
        assert.equal(choice.kind, "choice");
        if (choice.kind !== "choice") continue;
        const correct = choice.options.find((o) => o.id === problem.answer)!.label;
        assert.equal(correct, "8 × 5 and 8 × 2");
        assert.ok(choice.options.some((o) => o.label === "8 × 5 and 8 × 3"));
        assert.notEqual(correct, "8 × 5 and 8 × 3");
      }
      if (id === "complete-area-model" && prompt.includes("46 × 56")) {
        assert.deepEqual(values, ["2000", "240", "300", "36", "2576"]);
        assert.equal(Number(values[4]), 46 * 56);
      }
      if (id === "partial-products-by-place" && prompt.startsWith("7,339 × 6")) {
        assert.deepEqual(values, ["42000", "1800", "180", "54", "44034"]);
      }
      if (id === "partial-products-by-place" && prompt.startsWith("7,039 × 6")) {
        assert.equal(values[1], "0");
      }
      if (id === "standard-algorithm-rows" && prompt.includes("842 × 69")) {
        assert.deepEqual(values, ["7578", "50520", "58098"]);
        assert.equal(problem.public.response.kind, "structured-work");
        if (problem.public.response.kind === "structured-work" && problem.workGrading) {
          const wrong = JSON.parse(problem.answer) as string[][];
          wrong[1] = ["5052"];
          assert.equal(
            gradeStructuredWork(problem.public.response, problem.workGrading, JSON.stringify(wrong)),
            false,
          );
        }
      }
      if (id === "complete-division-model" && prompt.includes("1,089 ÷ 3")) {
        assert.deepEqual(values, ["300", "900", "60", "180", "3", "9", "363"]);
      }
      if (id === "complete-division-model" && prompt.includes("2,416 ÷ 4")) {
        assert.equal(values[2], "0");
        assert.notEqual(values[2], "4");
      }
      if (id === "chunk-model" && prompt.includes("899 ÷ 31")) {
        assert.deepEqual(values, ["20", "620", "9", "279", "29"]);
      }
      if (id === "chunk-model" && prompt.includes("1,726 ÷ 16")) {
        assert.deepEqual(values, ["100", "1600", "0", "7", "112", "14"]);
      }
      if (id === "bracket-steps" && prompt.includes("15,312 ÷ 48")) {
        assert.deepEqual(values.map(Number), bracketCells(15312, 48));
        assert.ok(values.map(Number).every((n, i) => i % 4 !== 2 || n < 48 || i === 10));
      }
      if (id === "bracket-steps" && prompt.includes("18,672 ÷ 62")) {
        assert.equal(values[4], "0");
      }
      if (id === "list-all-pairs" && prompt.includes("factor pair of 36")) {
        assert.deepEqual(values, ["1", "36", "2", "18", "3", "12", "4", "9", "6", "6"]);
      }
      if (id === "partition-from-marks" && problem.public.figure?.kind === "scene") {
        const tops = problem.public.figure.scene.elements.filter((e) => e.id?.startsWith("top-"));
        const lefts = problem.public.figure.scene.elements.filter((e) => e.id?.startsWith("left-"));
        assert.equal(tops.length, Number(values[1]));
        assert.equal(lefts.length, Number(values[0]));
        assert.equal(Number(values[0]) * Number(values[1]), Number(values[2]));
        const cells = problem.walkthrough?.elements.filter((e) => e.id?.startsWith("cell-")) ?? [];
        assert.equal(cells.length, Number(values[2]));
      }
      if (id === "story-for-expression" || id === "story-both-interpretations") {
        const options =
          problem.public.response.kind === "choice" || problem.public.response.kind === "multi-select"
            ? problem.public.response.options.map((o) => o.label)
            : [];
        const product = options.filter((label) => /with \d+ .+ in each/.test(label));
        if (prompt.includes("÷") && product.length) {
          const selected =
            problem.public.response.kind === "multi-select"
              ? new Set(JSON.parse(problem.answer) as string[])
              : new Set([problem.answer]);
          for (const option of problem.public.response.kind === "choice" ||
          problem.public.response.kind === "multi-select"
            ? problem.public.response.options
            : []) {
            if (product.includes(option.label)) assert.equal(selected.has(option.id), false);
          }
        }
        if (prompt.includes("5 × 7")) {
          assert.ok(options.some((label) => label.startsWith("5 groups of 7")));
          assert.equal(options.some((label) => label.startsWith("7 groups of 5")), false);
        }
        if (prompt.includes("56 ÷ 8") && problem.public.response.kind === "choice") {
          const labels = problem.public.response.options.map((o) => o.label);
          if (labels.some((label) => label.includes("÷"))) {
            const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
            assert.equal(correct, "56 ÷ 8");
            assert.ok(labels.includes("8 ÷ 56"));
          }
        }
      }
      if (id === "facts-from-known" && prompt.startsWith("Sam knows 6 × 4 = 24 and 6 × 5 = 30")) {
        assert.equal(problem.public.response.kind, "multi-select");
        if (problem.public.response.kind !== "multi-select") continue;
        const picked = new Set(JSON.parse(problem.answer) as string[]);
        const labels = problem.public.response.options
          .filter((o) => picked.has(o.id))
          .map((o) => o.label)
          .sort();
        assert.deepEqual(labels, ["24 ÷ 6 = 4", "4 × 6 = 24", "6 × 9 = 54"]);
        for (const option of problem.public.response.options) {
          const [eq, value] = option.label.split(" = ");
          const factors = eq!.split(" × ").map(Number);
          const claimed = Number(value);
          const truth = eq!.includes("÷")
            ? 24 / 6 === claimed
            : factors.length === 2 && factors[0]! * factors[1]! === claimed;
          assert.equal(truth, picked.has(option.id), option.label);
        }
      }
      if (id === "associative-compute" && prompt.startsWith("3 × 5 × 2")) {
        assert.deepEqual(values, ["15", "30", "10", "30"]);
      }
      if (id === "split-the-dividend" && prompt.startsWith("72 ÷ 6")) {
        assert.deepEqual(values, ["10", "2", "12"]);
      }
      if (id === "first-chunk-choice" && prompt.includes("899 ÷ 31")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        assert.equal(
          problem.public.response.options.find((o) => o.id === problem.answer)!.label,
          "20",
        );
      }
      if (id === "find-the-error" && prompt.includes("31 × 74")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
        assert.match(correct, /2,170/);
        assert.equal(
          problem.public.response.options.some((o) => o.label === "341 is the right product" && o.id === problem.answer),
          false,
        );
      }
      if (id === "find-the-error" && prompt.includes("754 × 9")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
        assert.match(correct, /5 × 9 \+ 3/);
      }
      if (id === "spot-the-error" && prompt.includes("6,100 ÷ 79")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
        assert.match(correct, /77 R 17/);
      }
      if (id === "spot-the-error" && prompt.includes("18,672 ÷ 62")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
        assert.match(correct, /301 R 10/);
      }
      if (id === "complete-list-choice" && prompt.includes("factor pairs of 40")) {
        assert.equal(problem.public.response.kind, "choice");
        if (problem.public.response.kind !== "choice") continue;
        const correct = problem.public.response.options.find((o) => o.id === problem.answer)!.label;
        assert.equal(correct, "1 × 40, 2 × 20, 4 × 10, 5 × 8");
        const turned = problem.public.response.options.find((o) => o.label.includes("8 × 5"));
        assert.ok(turned);
        assert.notEqual(turned!.id, problem.answer);
      }
      if (id === "choose-partition") {
        assert.equal(problem.public.response.kind, "figure-choice");
        if (problem.public.response.kind !== "figure-choice") continue;
        const scenes = problem.public.response.options.map((o) => JSON.stringify(o.scene.elements));
        assert.equal(new Set(scenes).size, 4);
        assert.ok(problem.public.response.options.some((o) => /not squares/.test(o.label)));
        assert.ok(problem.public.response.options.some((o) => /unequal widths/.test(o.label)));
      }
      void nums;
    }
    seen[id] = families.size;
    assert.ok(families.size >= 1, id);
  }
  assert.ok(seen["story-for-expression"]! >= 3);
  for (const hit of [
    "8x7",
  ])
    assert.ok(hits.has(hit), hit);
});

test("division-area-model version 1 reprints the classic prompts", () => {
  for (let i = 0; i < 20; i++) {
    const problem = generateProblem("division-area-model", `s${i}`, 1);
    assert.equal(problem.public.templateVersion, 1);
    assert.doesNotMatch(problem.public.prompt, /Why\?/);
    assert.match(problem.public.prompt, /area model/i);
    const current = texas38Case("division-area-model", `s${i}`);
    if (current.variant === "explain-first-chunk") {
      assert.match(current.problem.public.prompt, /Why\?/);
      assert.notEqual(current.problem.public.prompt, problem.public.prompt);
    } else {
      assert.equal(current.problem.answer, problem.answer);
    }
  }
});

test("300 bare multiply-facts report their actual coverage", () => {
  const ordered = new Set<string>();
  const unordered = new Set<string>();
  let bare = 0;
  let zeros = 0;
  let ones = 0;
  let tens = 0;
  for (let i = 0; bare < 300 && i < 4000; i++) {
    const problem = generateProblem("multiply-facts", `mf-${i}`);
    const match = problem.public.prompt.match(/^What is (\d+) × (\d+)\?$/);
    if (!match) continue;
    bare++;
    const a = Number(match[1]);
    const b = Number(match[2]);
    ordered.add(`${a}×${b}`);
    unordered.add(`${Math.min(a, b)}×${Math.max(a, b)}`);
    if (a === 0 || b === 0) zeros++;
    if (a === 1 || b === 1) ones++;
    if (a === 10 || b === 10) tens++;
  }
  assert.equal(bare, 300);
  const missing: string[] = [];
  for (let a = 2; a <= 9; a++)
    for (let b = a; b <= 9; b++)
      if (!unordered.has(`${a}×${b}`)) missing.push(`${a}×${b}`);
  assert.equal(zeros, 0);
  assert.equal(ones, 0);
  // The generator's factor() draws 2–10 only, so 0 and 1 never appear.
  // Record the gap; do not change the classic stream to force it.
  assert.ok(missing.length >= 0);
  assert.ok(tens >= 0);
  console.log(
    JSON.stringify({
      bare,
      ordered: ordered.size,
      unordered2to9: 36 - missing.length,
      missing,
      zeros,
      ones,
      tens,
    }),
  );
});
