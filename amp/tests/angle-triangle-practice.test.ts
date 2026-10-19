import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { generatedProblemSchema } from "../src/math/contracts";
import { angleTriangleTemplates } from "../src/math/angle-triangle-practice";
import { angleTriangleLessons } from "../src/content/angle-triangle-lessons";
import { angleTriangleWorksheet } from "../src/content/angle-triangle-worksheets";
import { sweep } from "../src/math/geometry-models";

test("angle and triangle problems are deterministic, valid and exact", () => {
  for (const t of angleTriangleTemplates)
    for (let i = 0; i < 200; i++) {
      const p = generateProblem(t.id, `at-${i}`);
      assert.deepEqual(p, generateProblem(t.id, `at-${i}`));
      assert.ok(generatedProblemSchema.safeParse(p).success, `${t.id} ${i}`);
      if (p.public.response.kind === "number")
        assert.match(p.answer, /^\d+$/, `${t.id}: ${p.public.prompt}`);
    }
});

test("angle figures are drawn at the measures their labels state", () => {
  for (let i = 0; i < 200; i++) {
    const p = generateProblem("angle-pair-measure", `rays-${i}`);
    const f = p.public.figure;
    assert.ok(f && f.kind === "angle-rays");
    for (const m of f.marks)
      if (/^\d+°$/.test(m.label))
        assert.equal(
          sweep(f.rays[m.from]!, f.rays[m.to]!),
          Number.parseInt(m.label),
        );
    const unknown = f.marks.find((m) => m.label === "?")!;
    assert.equal(
      String(sweep(f.rays[unknown.from]!, f.rays[unknown.to]!)),
      p.answer,
    );
  }
});

test("each problem type prints twelve distinct worksheet exercises", () => {
  for (const lesson of angleTriangleLessons)
    for (const edition of ["1", "2", "3"]) {
      const problems = lesson.templateIds.flatMap((id) =>
        angleTriangleWorksheet(id, lesson.id, edition),
      );
      assert.equal(problems.length, 12 * lesson.templateIds.length, lesson.id);
      assert.equal(
        new Set(problems.map((p) => JSON.stringify(p.public))).size,
        problems.length,
      );
    }
});
