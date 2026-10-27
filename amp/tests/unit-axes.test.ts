import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, gradeAnswer } from "../src/math/engine";
import { revealsAnswer } from "./fixtures/hint-rules";

/** Digests of the pre-axis output of the three families that gained a unit
 * axis, seeds legacy:0..299, over the public and private problem without the
 * recorded `variant`. */
const golden = JSON.parse(
  readFileSync(
    new URL("./fixtures/unit-axes-legacy-digests.json", import.meta.url),
    "utf8",
  ),
) as Record<string, string[]>;
const digest = (id: string, seed: string) => {
  const { variant, ...rest } = generateProblem(id, seed);
  void variant;
  return createHash("sha256")
    .update(JSON.stringify(rest))
    .digest("hex")
    .slice(0, 16);
};
const axisOf = (id: string) =>
  id === "compound-unit-conversion" ? "rate" : "quantity";
const legacyValue = (id: string) =>
  id === "compound-unit-conversion" ? "mixed" : "length";

test("legacy axis values reproduce the pre-axis output byte for byte", () => {
  for (const [id, digests] of Object.entries(golden)) {
    let legacy = 0;
    digests.forEach((expected, i) => {
      const problem = generateProblem(id, `legacy:${i}`);
      const axes = problem.variant?.axes;
      assert.ok(axes, `${id} legacy:${i} records its axis value`);
      if (axes[axisOf(id)] !== legacyValue(id)) return;
      legacy++;
      assert.equal(digest(id, `legacy:${i}`), expected, `${id} legacy:${i}`);
    });
    assert.ok(legacy >= 30, `${id} reaches its legacy surface (${legacy})`);
  }
});

const independent = (problem: ReturnType<typeof generateProblem>) => {
  const text = problem.public.prompt;
  const m = text.match(/Write (\d+) (\w+) in (\w+)\./);
  if (!m) return null;
  const [, n, from, to] = m;
  const pairs: [string, string, number][] = [
    ["km", "m", 1000],
    ["m", "cm", 100],
    ["L", "mL", 1000],
    ["kg", "g", 1000],
  ];
  const [big, , k] = pairs.find(
    ([b, s]) => (b === from && s === to) || (s === from && b === to),
  )!;
  return big === from ? String(Number(n) * k) : `${n}/${k}`;
};

test("metric renaming covers capacity and mass with exact answers", () => {
  const seen = new Set<string>();
  for (const id of ["metric-length-rename", "metric-length-reverse"])
    for (let i = 0; i < 300; i++) {
      const seed = `unit:${i}`;
      const problem = generateProblem(id, seed);
      generatedProblemSchema.parse(problem);
      assert.deepEqual(problem, generateProblem(id, seed));
      seen.add(`${id}:${problem.variant!.axes!.quantity}`);
      const want = independent(problem)!;
      assert.equal(gradeAnswer(problem, want), true, `${id} ${seed}`);
      assert.ok(
        !problem.hint.includes(problem.answer) || problem.answer.length < 3,
      );
    }
  for (const id of ["metric-length-rename", "metric-length-reverse"])
    for (const q of ["length", "capacity", "mass"])
      assert.ok(seen.has(`${id}:${q}`), `${id}:${q}`);
});

test("compound units: a squared time unit uses the conversion factor twice", () => {
  let squared = 0;
  for (let i = 0; i < 300; i++) {
    const problem = generateProblem("compound-unit-conversion", `sq:${i}`);
    generatedProblemSchema.parse(problem);
    if (problem.variant!.axes!.rate !== "squared-time") continue;
    squared++;
    const up = problem.public.prompt.match(
      /at (\d+) meters per second squared/,
    );
    const down = problem.public.prompt.match(
      /at (\d+) kilometers per hour squared/,
    );
    const want = up
      ? (Number(up[1]) * (3600 * 3600)) / 1000
      : (Number(down![1]) * 1000) / (3600 * 3600);
    assert.equal(Number(problem.answer), want, problem.public.prompt);
    assert.ok(!revealsAnswer(problem, false), problem.hint);
  }
  assert.ok(squared >= 50);
});
