import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import {
  gradeStructuredWork,
  structuredWorkResponseSchema,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import { polynomialProductCases } from "../src/math/polynomial-product-steps-practice";
import { lineFromPointCases } from "../src/math/line-from-point-steps-practice";
import { similarityProofCases } from "../src/math/similarity-proof-practice";
import { mcasWrittenWorkCases } from "../src/math/mcas-written-work-practice";
import { regentsWrittenWorkCases } from "../src/math/regents-written-work-practice";

const cases = {
  ...polynomialProductCases,
  ...lineFromPointCases,
  ...similarityProofCases,
  ...mcasWrittenWorkCases,
  ...regentsWrittenWorkCases,
};
const expectedVariants: Record<string, string[]> = {
  "polynomial-product-steps": [
    "binomials",
    "squared-binomial",
    "binomial-trinomial",
  ],
  "line-from-point-steps": ["slope-and-point", "two-points"],
  "similarity-proof-aa": [
    "perpendicular-leg",
    "altitude",
    "parallel",
    "isosceles",
  ],
  "similar-triangles-work": ["enlarge", "reduce"],
  "scale-drawing-work": ["feet-inches", "meters-centimeters"],
  "scientific-notation-work": ["animals", "objects"],
  "recursion-term-steps": [
    "square-plus-term-3",
    "square-plus-term-4",
    "double-square-minus-term-3",
    "double-square-minus-term-4",
    "double-plus-term-3",
    "double-plus-term-4",
  ],
  "remainder-steps": ["x-minus", "x-plus"],
  "addition-rule-steps": ["either", "neither"],
  "average-rate-steps": ["whole-table", "inner-years"],
  "budget-items-steps": ["budget", "goal"],
};
const SEEDS = 400;

for (const [id, variants] of Object.entries(expectedVariants)) {
  test(`${id}: contract, determinism, variants, credit`, () => {
    assert.ok(
      templates.some((t) => t.id === id),
      "registered in the engine",
    );
    const seen = new Set<string>();
    const modes = new Set<string>();
    const hints = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const seed = `sweep-${i}`;
      const a = generateProblem(id, seed);
      const b = generateProblem(id, seed);
      assert.deepEqual(a, b, `${id} ${seed} is deterministic`);
      generatedProblemSchema.parse(a);
      assert.match(a.variant!.id, /^[a-z0-9][a-z0-9-]{0,63}$/);
      seen.add(a.variant!.id);
      const response = a.public.response as StructuredWorkResponse;
      structuredWorkResponseSchema.parse(response);
      modes.add(response.mode);
      hints.add(a.hint);
      assert.ok(a.workGrading, "has a private rule");
      assert.ok(
        gradeStructuredWork(response, a.workGrading!, a.answer),
        `${id} ${seed}: key is credited`,
      );
      // One wrong learner field is never credited.
      const rows = JSON.parse(a.answer) as string[][];
      if (response.layout === "steps") {
        for (let r = 0; r < rows.length; r++)
          for (let f = 0; f < rows[r]!.length; f++) {
            if (rows[r]![f] === "") continue;
            const wrong = rows.map((row) => [...row]);
            const kind = response.rows[r]!.fields[f]!.kind;
            wrong[r]![f] = kind === "number" ? "12345" : "x+11";
            if (kind === "expression" && response.rows[r]!.fields[f]!.relations)
              wrong[r]![f] = "y=x+11";
            assert.equal(
              gradeStructuredWork(
                response,
                a.workGrading!,
                JSON.stringify(wrong),
              ),
              false,
              `${id} ${seed}: row ${r + 1} field ${f + 1} wrong`,
            );
          }
        // The hint never states a learner-entered value of 4+ characters.
        for (const row of rows)
          for (const v of row)
            if (v.length >= 4) assert.ok(!a.hint.includes(v), `${id} ${seed}`);
      }
      assert.ok(a.hint.length > 40);
      assert.ok(a.explanation.length >= 2);
    }
    assert.deepEqual([...seen].sort(), [...variants].sort());
    assert.ok(modes.has("build") && modes.has("fill"));
    assert.ok(
      hints.size >= (id === "similarity-proof-aa" ? 8 : 20),
      `${id}: hints vary across seeds`,
    );
  });
}

test("similarity proofs: any valid order and a false statement fail", () => {
  const seed = "sweep-order";
  let order = 0;
  for (let i = 0; i < SEEDS && order < 5; i++) {
    const p = cases["similarity-proof-aa"](`${seed}-${i}`, {
      mode: "build",
    }).problem;
    const response = p.public.response as StructuredWorkResponse;
    const lines = JSON.parse(p.answer) as [string, string][];
    assert.ok(gradeStructuredWork(response, p.workGrading!, p.answer));
    // Swapping the last two lines puts the conclusion before its support.
    const swapped = [...lines];
    [swapped[swapped.length - 2], swapped[swapped.length - 1]] = [
      swapped[swapped.length - 1]!,
      swapped[swapped.length - 2]!,
    ];
    assert.equal(
      gradeStructuredWork(response, p.workGrading!, JSON.stringify(swapped)),
      false,
    );
    // The reason of the last line replaced by "Given" is rejected.
    const given = lines.map((l) => [...l]);
    given[given.length - 1]![1] = given[0]![1]!;
    assert.equal(
      gradeStructuredWork(response, p.workGrading!, JSON.stringify(given)),
      false,
    );
    order++;
  }
  assert.equal(order, 5);
});

test("polynomial products: an unexpanded product is not a step", () => {
  let checked = 0;
  for (let i = 0; i < SEEDS && checked < 20; i++) {
    const p = generateProblem("polynomial-product-steps", `sweep-expand-${i}`);
    const response = p.public.response as StructuredWorkResponse;
    const rows = JSON.parse(p.answer) as string[][];
    const r = rows.findIndex(
      (row, k) =>
        row[0] !== "" &&
        response.rows[k]!.fields[0]!.kind === "expression" &&
        /[+-]/.test(row[0]!.slice(1)),
    );
    if (r < 0) continue;
    for (const form of [
      `(${rows[r]![0]})`,
      `1*(${rows[r]![0]})`,
      `x*(${rows[r]![0]})/x`,
    ]) {
      const wrong = rows.map((row) => [...row]);
      wrong[r]![0] = form;
      assert.equal(
        gradeStructuredWork(response, p.workGrading!, JSON.stringify(wrong)),
        false,
        `${form} is not an expanded step`,
      );
    }
    const reversed = rows.map((row) => [...row]);
    reversed[r]![0] = rows[r]![0]!.split(/(?=[+-])/)
      .reverse()
      .map((t) => (/^[+-]/.test(t) ? t : `+${t}`))
      .join("")
      .replace(/^\+/, "");
    assert.ok(
      gradeStructuredWork(response, p.workGrading!, JSON.stringify(reversed)),
      `${reversed[r]![0]} reordered is accepted`,
    );
    checked++;
  }
  assert.ok(checked >= 5);
});
