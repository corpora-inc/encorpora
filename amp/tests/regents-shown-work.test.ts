import { test } from "node:test";
import assert from "node:assert/strict";
import { generatedProblemSchema } from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import {
  gradeStructuredWork,
  structuredWorkResponseSchema,
  type StructuredWorkResponse,
} from "../src/math/structured-work";
import { regentsShownWorkCases } from "../src/math/regents-shown-work-practice";

const expectedVariants: Record<string, string[]> = {
  "density-volume-steps": [
    "cylinder-weight",
    "prism-pyramid-mass",
    "pyramid-count",
  ],
  "sas-area-steps": ["acute", "obtuse"],
  "trig-leg-steps": ["adjacent-leg", "opposite-leg"],
  "elevation-depression-steps": ["deeper-base", "higher-top"],
  "isosceles-perimeter-steps": ["narrow-apex", "wide-apex"],
  "ring-area-steps": ["from-diameter", "from-radius"],
  "parallelogram-angle-steps": [
    "acute-inside",
    "obtuse-at-d",
    "obtuse-outside",
  ],
  "parallel-segment-steps": ["parallel-length", "whole-side"],
  "two-radical-steps": [
    "double-radicand",
    "quadruple-radicand",
    "triple-radicand",
  ],
  "grouped-both-sides-steps": ["grouped-left", "grouped-right"],
  "exponential-time-steps": ["base-b", "natural-rate"],
};
const SEEDS = 400;

for (const [id, variants] of Object.entries(expectedVariants)) {
  test(`${id}: contract, determinism, variants, credit`, () => {
    assert.ok(
      templates.some((t) => t.id === id),
      "registered in the engine",
    );
    assert.ok(id in regentsShownWorkCases);
    const seen = new Set<string>();
    const modes = new Set<string>();
    const hints = new Set<string>();
    for (let i = 0; i < SEEDS; i++) {
      const seed = `shown-${i}`;
      const a = generateProblem(id, seed);
      assert.deepEqual(a, generateProblem(id, seed), `${id} ${seed}`);
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
      const rows = JSON.parse(a.answer) as string[][];
      for (let r = 0; r < rows.length; r++)
        for (let f = 0; f < rows[r]!.length; f++) {
          if (rows[r]![f] === "") continue;
          const wrong = rows.map((row) => [...row]);
          const kind = response.rows[r]!.fields[f]!.kind;
          wrong[r]![f] = kind === "number" ? "12345" : "x+11";
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
      for (const row of rows)
        for (const v of row)
          if (v.length >= 4) assert.ok(!a.hint.includes(v), `${id} ${seed}`);
      assert.ok(a.hint.length > 40);
      assert.ok(a.explanation.length >= 2);
    }
    assert.deepEqual([...seen].sort(), [...variants].sort());
    assert.ok(modes.has("build") && modes.has("fill"));
    assert.ok(hints.size >= 20, `${id}: hints vary across seeds`);
  });
}

test("grouped equation: only the combined grouped side earns the first step", () => {
  let checked = 0;
  for (let i = 0; i < SEEDS && checked < 20; i++) {
    const p = generateProblem("grouped-both-sides-steps", `shown-g-${i}`);
    const response = p.public.response as StructuredWorkResponse;
    const rows = JSON.parse(p.answer) as string[][];
    const first = rows[0]![0]!;
    if (first === "") continue;
    const credited = (value: string) => {
      const next = rows.map((row) => [...row]);
      next[0]![0] = value;
      return gradeStructuredWork(
        response,
        p.workGrading!,
        JSON.stringify(next),
      );
    };
    assert.ok(credited(first));
    // The grouped term left unmultiplied and an uncombined sum earn nothing.
    assert.equal(credited(`1*(${first})`), false);
    assert.equal(credited(`${first}+x-x`), false);
    assert.equal(credited(`${first}+1`), false);
    // The same polynomial written with its terms in another order is the step.
    const terms = first.split(/(?=[+-])/);
    if (terms.length === 2) {
      const flipped = terms
        .reverse()
        .map((t) => (/^[+-]/.test(t) ? t : `+${t}`));
      assert.ok(credited(flipped.join("").replace(/^\+/, "")));
    }
    checked++;
  }
  assert.ok(checked >= 10);
});
