import assert from "node:assert/strict";
import test from "node:test";
import { balanceAndChange as book } from "../books/balance-and-change/book.js";
import {
  balanceAlignments,
  validateBalanceAlignments,
} from "../books/balance-and-change/alignments.js";
import {
  balancePracticeBindings,
  validateBalancePracticeBindings,
} from "../books/balance-and-change/practice.js";
import { skills, standards } from "../src/curriculum/catalog.js";
import { templates } from "../src/math/engine.js";
import { validateBook } from "../src/publishing/validate.js";
import { supportsBook } from "../src/books/capabilities.js";
const blocks = book.pages.flatMap((p) => p.blocks);
const tasks = blocks.filter((b) => b.kind === "task");
const keys = blocks.filter((b) => b.kind === "solution");
test("algebra volume has unique anchors, reasoned keys and explicit assessment boundaries", () => {
  validateBook(book);
  assert.ok(tasks.length >= 80);
  assert.equal(keys.length, tasks.length);
  for (const task of tasks) {
    const answers = keys.filter((k) => k.taskId === task.id);
    assert.equal(answers.length, 1, task.id);
    assert.ok(answers[0]!.reasoning.length > 40, task.id);
  }
  for (const id of ["design-plans", "design-graph"])
    assert.ok(
      book.pages
        .find((p) => p.id === id)
        ?.blocks.some(
          (b) => b.kind === "task" && b.response.size === "extended",
        ),
      id,
    );
  validateBalanceAlignments(skills, templates, standards);
  validateBalancePracticeBindings(templates);
  assert.equal(
    balancePracticeBindings.filter(
      (b) => b.assessedResponse === "single-choice-selection",
    ).length,
    7,
  );
  for (const alignment of balanceAlignments)
    assert.ok(alignment.unassessedRequirements.length);
  const sample = balanceAlignments[0]!;
  for (const invalid of [
    { ...sample, pageIds: ["absent"] },
    { ...sample, standardIds: ["8.EE.fake"] },
    { ...sample, skillId: "absent" },
    { ...sample, taskIds: ["absent"] },
    { ...sample, unassessedRequirements: [] },
  ])
    assert.throws(() =>
      validateBalanceAlignments(skills, templates, standards, [invalid]),
    );
});
test("legacy readers cannot advertise support through unrelated capability tokens", () => {
  assert.equal(supportsBook([], []), true);
  assert.equal(supportsBook(["algebra-models-v1"], []), false);
  assert.equal(
    supportsBook(["algebra-models-v1"], ["algebra-models-v2"]),
    false,
  );
  assert.equal(
    supportsBook(
      ["algebra-models-v1"],
      ["future-capability", "algebra-models-v1"],
    ),
    true,
  );
});
