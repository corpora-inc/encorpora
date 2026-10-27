import assert from "node:assert/strict";
import test from "node:test";
import { circleMeasurementWorksheet } from "../src/content/circle-measurement-worksheets.js";
import { lessons } from "../src/content/lessons.js";
import { generateProblem } from "../src/math/engine.js";
import { withLegacySurfaces } from "../src/math/number-domain-axes.js";

for (const templateId of [
  "circle-circumference-coefficient",
  "circle-area-coefficient",
  "arc-length-coefficient",
  "sector-area-coefficient",
]) {
  test(`${templateId} worksheets replay canonical exact problems`, () => {
    const lesson = lessons.find((row) => row.templateIds.includes(templateId));
    assert.ok(lesson);
    for (const edition of ["1", "7", "16"]) {
      const problems = circleMeasurementWorksheet(
        templateId,
        lesson.id,
        edition,
      );
      assert.equal(problems.length, 12);
      assert.equal(new Set(problems.map((p) => p.public.prompt)).size, 12);
      assert.deepEqual(
        problems,
        circleMeasurementWorksheet(templateId, lesson.id, edition),
      );
      for (const problem of problems) {
        assert.equal(problem.public.response.kind, "fraction");
        assert.deepEqual(
          problem,
          withLegacySurfaces(() =>
            generateProblem(templateId, problem.public.seed),
          ),
          `Printed seed ${problem.public.seed} must preserve question, answer and variant`,
        );
      }
    }
  });
}

test("printing exact circle areas does not change live pi-form selection", () => {
  const seed = "print:circle-area-coefficient:1:0";
  const before = generateProblem("circle-area-coefficient", seed);
  assert.equal(before.public.response.kind, "number");
  circleMeasurementWorksheet(
    "circle-area-coefficient",
    "circle-area-coefficient",
    "1",
  );
  assert.deepEqual(generateProblem("circle-area-coefficient", seed), before);
});
