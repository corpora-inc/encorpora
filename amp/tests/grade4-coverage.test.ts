import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { generateProblem } from "../src/math/engine";
import { standards } from "../src/curriculum/catalog";
import {
  grade4CoverageLines,
  grade4Summary,
  renderGrade4Coverage,
} from "../src/curriculum/grade4-coverage";
import { buildGapLedger } from "../src/curriculum/gap-ledger";

test("grade 4 coverage names every standard and only real problem types", () => {
  const lines = grade4CoverageLines();
  const ccss = standards.filter((standard) => standard.id.startsWith("4."));
  assert.deepEqual(
    lines.filter((line) => line.framework === "CCSS").map((line) => line.id),
    ccss.map((standard) => standard.id),
  );
  const report = buildGapLedger();
  assert.equal(report.valid, true);
  const stateIds = report.sourceReconciliation.slices.flatMap((slice) =>
    slice.requirements
      .filter(
        (requirement) =>
          slice.grade === "4" || requirement.id.startsWith("MA.4."),
      )
      .map((requirement) => requirement.id),
  );
  const renderedIds = lines
    .filter((line) => line.framework !== "CCSS")
    .map((line) => line.id);
  assert.deepEqual(renderedIds, stateIds);
  const linked = new Set(
    report.sourceReconciliation.slices.flatMap((slice) =>
      slice.tasks.flatMap((task) => task.templateIds),
    ),
  );
  for (const line of lines) {
    if (line.status === "full" || line.status === "partial")
      assert.ok(line.templates.length > 0, line.id);
    else assert.equal(line.templates.length, 0, line.id);
    if (line.status !== "full") assert.ok(line.gap.length > 0, line.id);
    for (const id of line.templates)
      if (line.framework !== "CCSS") assert.ok(linked.has(id), `${line.id} ${id}`);
  }
  const seen = new Set<string>();
  for (const line of lines)
    for (const id of line.templates) {
      if (!seen.has(id)) {
        seen.add(id);
        for (const seed of ["g4-proof-a", "g4-proof-b"]) {
          const problem = generateProblem(id, seed);
          assert.ok(problem.public.prompt.trim().length > 0, `${id} ${seed}`);
          assert.ok(problem.answer.trim().length > 0, `${id} ${seed}`);
        }
      }
    }
  const markdown = renderGrade4Coverage(lines);
  assert.equal(
    readFileSync(new URL("../docs/grade4-coverage.md", import.meta.url), "utf8").trimEnd(),
    markdown.trimEnd(),
  );
  const totals = grade4Summary(lines);
  // Judgment after the 2026-11-04 link pass. The source ledger stays partial.
  assert.deepEqual(
    {
      full: totals.full,
      partial: totals.partial,
      none: totals.none,
      outOfScope: totals.outOfScope,
      uncovered: totals.uncovered,
    },
    { full: 38, partial: 162, none: 16, outOfScope: 10, uncovered: 6 },
  );
});
