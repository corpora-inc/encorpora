import test from "node:test";
import assert from "node:assert/strict";
import { generateProblem, templates } from "../src/math/engine.js";
import { spokenMath } from "../src/web/MathText";

/* Recent work's plain reading (product grabs 2026-11-17, #17; teacher-shared
   `promptLine` is this on one line): every generated prompt of the problem
   types that read "-5/41/6" and "31/4" reads one way. */
test("complex fractions and mixed numbers read unambiguously in Recent work", () => {
  const ids = [
    "complex-fraction",
    "decimal-rename-chain",
    "fraction-term-chain",
  ];
  for (const id of ids)
    assert.ok(
      templates.some((t) => t.id === id),
      id,
    );
  for (const id of ids)
    for (let seed = 0; seed < 60; seed++) {
      const line = spokenMath(
        generateProblem(id, `seed-${seed}`).public.prompt,
      );
      // No fraction runs into the number beside it ("31/4", "41/6").
      assert.doesNotMatch(line, /\d\/\d+\/\d/, line);
      assert.doesNotMatch(line, /\\frac|[{}]/, line);
    }
});
