import assert from "node:assert/strict";
import test from "node:test";
import { fractionFieldGuide } from "./book.js";
import type { Rational } from "./schema.js";

const blocks = fractionFieldGuide.pages.flatMap((page) => page.blocks);
const tasks = blocks.filter((block) => block.kind === "task");
const solutions = blocks.filter((block) => block.kind === "solution");
const diagrams = blocks
  .filter((block) => block.kind === "diagram")
  .map((block) => block.diagram);
const value = ([n, d]: Rational) => n / d;
const exact = ([n, d]: Rational) => {
  assert.ok(Number.isSafeInteger(n));
  assert.ok(Number.isSafeInteger(d) && d > 0);
};

test("every learner task has one detailed solution and every HTML anchor is unique", () => {
  const ids = [
    ...fractionFieldGuide.pages.map((page) => page.id),
    ...tasks.map((task) => task.id),
    ...diagrams.map((diagram) => diagram.id),
  ];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(tasks.length, 85);
  assert.equal(solutions.length, tasks.length);
  for (const task of tasks) {
    const matches = solutions.filter((solution) => solution.taskId === task.id);
    assert.equal(matches.length, 1, task.id);
    assert.ok(matches[0]!.answer.trim().length > 0);
    assert.ok(matches[0]!.reasoning.length > 40);
  }
  assert.ok(
    solutions.every((solution) =>
      tasks.some((task) => task.id === solution.taskId),
    ),
  );
});

test("semantic diagrams use consistent exact units and valid model geometry", () => {
  for (const diagram of diagrams) {
    // This book uses fractional models; unit arrays belong to other authored books.
    assert.ok(diagram.kind !== "array");
    assert.ok(diagram.kind === "double-line" || diagram.wholeLabel.length);
    assert.ok(diagram.caption.length > 20 && diagram.alt.length > 20);
    if (diagram.kind === "strips") {
      for (const row of diagram.rows) {
        assert.ok(Number.isInteger(row.parts) && row.parts > 0);
        assert.ok(Number.isInteger(row.shaded) && row.shaded >= 0);
        assert.ok(Number.isInteger(row.wholes ?? 1) && (row.wholes ?? 1) > 0);
        assert.ok(row.shaded <= row.parts * (row.wholes ?? 1));
      }
    } else if (diagram.kind === "number-line") {
      exact(diagram.min);
      exact(diagram.max);
      assert.ok(value(diagram.max) > value(diagram.min));
      assert.ok(
        Number.isInteger(diagram.divisionsPerUnit) &&
          diagram.divisionsPerUnit > 0,
      );
      for (const mark of diagram.marks) {
        exact(mark.at);
        assert.ok(
          value(mark.at) >= value(diagram.min) &&
            value(mark.at) <= value(diagram.max),
        );
        assert.equal((mark.at[0] * diagram.divisionsPerUnit) % mark.at[1], 0);
      }
      for (const jump of diagram.jumps ?? []) {
        exact(jump.from);
        exact(jump.to);
        assert.ok(value(jump.from) >= value(diagram.min));
        assert.ok(value(jump.to) <= value(diagram.max));
        assert.ok(value(jump.from) < value(jump.to));
      }
    } else if (diagram.kind === "area") {
      for (const count of [
        diagram.columns,
        diagram.rows,
        diagram.shadedColumns,
        diagram.shadedRows,
      ])
        assert.ok(Number.isInteger(count) && count > 0);
      assert.ok(
        diagram.shadedColumns <= diagram.columns &&
          diagram.shadedRows <= diagram.rows,
      );
    } else if (diagram.kind === "groups") {
      exact(diagram.total);
      exact(diagram.groupSize);
      assert.ok(value(diagram.total) > 0 && value(diagram.groupSize) > 0);
      assert.equal(
        (diagram.total[0] * diagram.unitDivisions) % diagram.total[1],
        0,
      );
      assert.equal(
        (diagram.groupSize[0] * diagram.unitDivisions) % diagram.groupSize[1],
        0,
      );
    } else {
      const [zero, reference] = diagram.pairs;
      assert.ok(zero && reference);
      assert.equal(value(zero.top), 0);
      assert.equal(value(zero.bottom), 0);
      assert.ok(value(reference.top) > 0 && value(reference.bottom) > 0);
      diagram.pairs.forEach((pair, index) => {
        exact(pair.top);
        exact(pair.bottom);
        assert.equal(
          pair.top[0] * reference.top[1] * reference.bottom[0] * pair.bottom[1],
          pair.bottom[0] * reference.bottom[1] * reference.top[0] * pair.top[1],
        );
        if (index > 0)
          assert.ok(value(pair.top) > value(diagram.pairs[index - 1]!.top));
      });
    }
  }
});

test("grouping and sharing pictures preserve their differently measured answers", () => {
  const grouping = diagrams.find((diagram) => diagram.id === "division-groups");
  assert.ok(grouping?.kind === "groups");
  assert.equal(value(grouping.total) / value(grouping.groupSize), 6);
  const partial = diagrams.find((diagram) => diagram.id === "partial-groups");
  assert.ok(partial?.kind === "groups");
  assert.equal(value(partial.total) / value(partial.groupSize), 9 / 4);
  const sharing = diagrams.find(
    (diagram) => diagram.id === "division-share-strips",
  );
  assert.ok(sharing?.kind === "strips");
  assert.equal(sharing.rows[0]!.shaded / sharing.rows[0]!.parts, 3 / 2);
  assert.equal(sharing.rows[1]!.shaded / sharing.rows[1]!.parts, 3 / 8);
  assert.equal(
    (4 * sharing.rows[1]!.shaded) / sharing.rows[1]!.parts,
    sharing.rows[0]!.shaded / sharing.rows[0]!.parts,
  );
});

import { skills } from "../../src/curriculum/catalog.js";
import { templates } from "../../src/math/engine.js";
import {
  fractionBookAlignments,
  validateFractionBookAlignments,
} from "./alignments.js";
test("editorial alignment resolves actual skill, template, page, and task IDs and rejects drift", () => {
  assert.doesNotThrow(() => validateFractionBookAlignments(skills, templates));
  const first = fractionBookAlignments[0]!;
  for (const bad of [
    { ...first, skillId: "missing" },
    { ...first, pageIds: ["missing"] },
    { ...first, taskIds: ["missing"] },
    { ...first, templateIds: ["missing"] },
    { ...first, templateIds: ["add-fractions"] },
  ])
    assert.throws(() =>
      validateFractionBookAlignments(skills, templates, [bad]),
    );
});
