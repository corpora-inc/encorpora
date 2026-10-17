import assert from "node:assert/strict";
import test from "node:test";
import { numberBuilders as book } from "./book.js";
import { numberAlignments, validateNumberAlignments } from "./alignments.js";
import {
  numberPracticeBindings,
  validateNumberPracticeBindings,
} from "./practice.js";
import { skills, standards } from "../../src/curriculum/catalog.js";
import { templates } from "../../src/math/engine.js";
import { validateBook } from "../../src/publishing/validate.js";
const blocks = book.pages.flatMap((p) => p.blocks),
  tasks = blocks.filter((b) => b.kind === "task"),
  keys = blocks.filter((b) => b.kind === "solution"),
  diagrams = blocks.filter((b) => b.kind === "diagram").map((b) => b.diagram);
const get = (id: string) => {
  const d = diagrams.find((d) => d.id === id);
  assert.ok(d, id);
  return d;
};
test("early-number book has complete task keys and bounded real curriculum links", () => {
  validateBook(book);
  assert.equal(tasks.length, 57);
  assert.equal(keys.length, tasks.length);
  for (const t of tasks) {
    assert.equal(keys.filter((k) => k.taskId === t.id).length, 1, t.id);
    assert.ok(
      numberAlignments.some((a) => a.taskIds.includes(t.id)),
      t.id,
    );
  }
  validateNumberAlignments(skills, templates, standards);
  validateNumberPracticeBindings(templates);
  assert.equal(numberPracticeBindings.length, 17);
  for (const b of numberPracticeBindings) {
    assert.equal(b.assessedResponse, "numeric-result-only");
    assert.ok(b.unassessedRequirements.length >= 2);
  }
  const sample = numberAlignments[0]!;
  for (const changed of [
    { ...sample, pageIds: ["absent"] },
    { ...sample, taskIds: ["absent"] },
    { ...sample, standardIds: ["K.CC.fake"] },
    { ...sample, templateIds: ["mean-data"] },
  ])
    assert.throws(() =>
      validateNumberAlignments(skills, templates, standards, [changed]),
    );
  const binding = numberPracticeBindings[0]!;
  for (const changed of [
    { ...binding, pageIds: ["absent"] },
    { ...binding, bookId: "absent" },
    { ...binding, skillId: "absent" },
    { ...binding, unassessedRequirements: [] },
  ])
    assert.throws(() => validateNumberPracticeBindings(templates, [changed]));
});
test("make-ten pictures preserve both the whole and the intermediate addend/removal", () => {
  const addition = get("eight-plus-five"),
    subtraction = get("thirteen-minus-five");
  assert.equal(addition.kind, "ten-frame");
  assert.equal(subtraction.kind, "ten-frame");
  if (addition.kind !== "ten-frame" || subtraction.kind !== "ten-frame") return;
  for (const d of [addition, subtraction]) {
    assert.equal(d.occupied.length, 13);
    assert.equal(d.emphasized?.length, 5);
    assert.equal(d.emphasized?.filter((i) => i < 10).length, 2);
    assert.equal(d.emphasized?.filter((i) => i >= 10).length, 3);
  }
  assert.equal(subtraction.occupied.length - subtraction.emphasized!.length, 8);
  assert.match(addition.emphasisLabel!, /added/);
  assert.match(subtraction.emphasisLabel!, /remove/);
});
test("unit exchanges and removal keep the mathematically intended values", () => {
  const total = (id: string) => {
    const d = get(id);
    assert.equal(d.kind, "base-ten");
    if (d.kind !== "base-ten") throw new Error(id);
    return 10 * d.tens + d.ones;
  };
  assert.equal(total("trade-24-before"), 24);
  assert.equal(total("trade-24-after"), 24);
  assert.equal(total("two-tens-fifteen"), 35);
  assert.equal(total("three-tens-five"), 35);
  assert.equal(total("forty-two-before"), 42);
  assert.equal(total("forty-two-unpacked"), 42);
  const d = get("forty-two-unpacked");
  if (d.kind !== "base-ten") throw new Error(d.id);
  assert.equal(d.emphasizedTens?.length, 1);
  assert.equal(d.emphasizedOnes?.length, 6);
  assert.equal(
    10 * (d.tens - d.emphasizedTens!.length) +
      d.ones -
      d.emphasizedOnes!.length,
    26,
  );
});
test("conservation and empty mats are represented explicitly", () => {
  const zero = get("zero-mat");
  assert.equal(zero.kind, "count-collection");
  if (zero.kind !== "count-collection") throw new Error(zero.id);
  assert.equal(zero.panels.length, 1);
  assert.equal(zero.panels[0]!.cells.length, 0);
  for (const id of ["same-seven-mats", "eight-rearranged"]) {
    const d = get(id);
    if (d.kind !== "count-collection") throw new Error(id);
    assert.equal(d.relationship, "conserved");
    assert.equal(d.panels[0]!.cells.length, d.panels[1]!.cells.length);
    assert.notDeepEqual(d.panels[0]!.cells, d.panels[1]!.cells);
  }
  const mat = get("reusable-empty-frames");
  if (mat.kind !== "ten-frame") throw new Error(mat.id);
  assert.equal(mat.frames, 2);
  assert.equal(mat.occupied.length, 0);
  const tools = get("reusable-unit-pieces");
  if (tools.kind !== "base-ten") throw new Error(tools.id);
  assert.equal(tools.tens, 2);
  assert.equal(tools.ones, 10);
});
