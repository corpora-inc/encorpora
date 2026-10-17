import test from "node:test";
import assert from "node:assert/strict";
import { inTheSameProportion as book } from "../books/in-the-same-proportion/book.js";
import {
  ratioAlignments,
  validateRatioAlignments,
} from "../books/in-the-same-proportion/alignments.js";
import {
  ratioPracticeBindings,
  validateRatioPracticeBindings,
} from "../books/in-the-same-proportion/practice.js";
import { validateBook } from "../src/publishing/validate.js";
import { skills, standards } from "../src/curriculum/catalog.js";
import { templates } from "../src/math/engine.js";
const blocks = book.pages.flatMap((p) => p.blocks),
  tasks = blocks.filter((b) => b.kind === "task"),
  keys = blocks.filter((b) => b.kind === "solution");
test("ratio manuscript gives every task one reasoned key and valid semantic figures", () => {
  validateBook(book);
  assert.ok(tasks.length >= 40);
  assert.equal(tasks.length, keys.length);
  for (const t of tasks) {
    const matches = keys.filter((k) => k.taskId === t.id);
    assert.equal(matches.length, 1);
    assert.ok(matches[0]!.reasoning.length > 60);
  }
  for (const k of keys) assert.ok(tasks.some((t) => t.id === k.taskId));
});
test("ratio editorial and automated scope bind only real matching pages and skills", () => {
  validateRatioAlignments(skills, templates, standards);
  validateRatioPracticeBindings(templates);
  assert.equal(ratioPracticeBindings.length, 3);
  assert.ok(
    ratioPracticeBindings.every(
      (b) =>
        b.assessedResponse === "numeric-result-only" &&
        b.unassessedRequirements.length > 0,
    ),
  );
  assert.throws(() =>
    validateRatioPracticeBindings(templates, [
      { ...ratioPracticeBindings[0]!, pageIds: ["absent-page"] },
    ]),
  );
  assert.throws(() =>
    validateRatioPracticeBindings(templates, [
      { ...ratioPracticeBindings[0]!, skillId: "percentages" },
    ]),
  );
  assert.throws(() =>
    validateRatioAlignments(skills, templates, standards, [
      { ...ratioAlignments[0]!, standardIds: ["not-a-standard"] },
    ]),
  );
});
test("whole-object and continuous plots state different graphical domains", () => {
  const continuous = book.pages
    .find((p) => p.id === "proportional-graph")!
    .blocks.find((b) => b.kind === "diagram")!;
  const discrete = book.pages
    .find((p) => p.id === "whole-object-domain")!
    .blocks.find((b) => b.kind === "diagram")!;
  assert.equal(continuous.kind, "diagram");
  assert.equal(discrete.kind, "diagram");
  if (continuous.kind !== "diagram" || discrete.kind !== "diagram")
    throw new Error("Missing diagrams");
  assert.equal(continuous.diagram.kind, "coordinate-plot");
  assert.equal(discrete.diagram.kind, "coordinate-plot");
  if (
    continuous.diagram.kind !== "coordinate-plot" ||
    discrete.diagram.kind !== "coordinate-plot"
  )
    throw new Error("Wrong diagrams");
  assert.equal(continuous.diagram.lines?.length, 1);
  assert.ok(continuous.diagram.lines![0]!.domain);
  assert.equal(discrete.diagram.lines?.length ?? 0, 0);
  assert.ok(discrete.diagram.points.every((p) => p.x[1] === 1 && p.y[1] === 1));
});
test("authored prose separates percentages and punctuation from following words", () => {
  const strings: string[] = [];
  function collect(v: unknown) {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === "object") Object.values(v).forEach(collect);
  }
  collect(book);
  for (const s of strings)
    assert.ok(!/%[A-Za-z]|[A-Za-z][$‘]|[a-z][,:;][^ ]|kand|kwith/.test(s), s);
});

test("worked context metadata is explicit and rejects unsupported presentations", () => {
  const copy = structuredClone(book);
  const example = copy.pages
    .flatMap((p) => p.blocks)
    .find((b) => b.kind === "worked")!;
  assert.equal(example.kind, "worked");
  if (example.kind !== "worked") throw new Error("Missing worked example");
  assert.equal(example.promptPresentation, "context");
  example.promptPresentation = "auto" as never;
  assert.throws(() => validateBook(copy), /worked prompt presentation/);
});
