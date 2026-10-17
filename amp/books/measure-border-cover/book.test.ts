import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { measureBorderCover as book } from "./book.js";
import {
  measurementAlignments,
  validateMeasurementAlignments,
} from "./alignments.js";
import {
  measurementPracticeBindings,
  validateMeasurementPracticeBindings,
} from "./practice.js";
import { skills, standards } from "../../src/curriculum/catalog.js";
import { templates } from "../../src/math/engine.js";
import { validateBook } from "../../src/publishing/validate.js";
import { bookFor } from "../../src/books/catalog.js";
import {
  supportsBook,
  readerCapabilities,
} from "../../src/books/capabilities.js";
import { UnitRegionCover } from "../../src/publishing/UnitRegionCover.js";
const blocks = book.pages.flatMap((p) => p.blocks),
  tasks = blocks.filter((b) => b.kind === "task"),
  keys = blocks.filter((b) => b.kind === "solution"),
  diagrams = blocks.filter((b) => b.kind === "diagram").map((b) => b.diagram);
test("measurement book keys and curricular links retain selected component limits", () => {
  validateBook(book);
  assert.equal(tasks.length, 48);
  assert.equal(keys.length, tasks.length);
  for (const t of tasks) {
    assert.equal(keys.filter((k) => k.taskId === t.id).length, 1, t.id);
    assert.ok(
      measurementAlignments.some((a) => a.taskIds.includes(t.id)),
      t.id,
    );
  }
  validateMeasurementAlignments(skills, templates, standards);
  validateMeasurementPracticeBindings(templates);
  assert.equal(measurementPracticeBindings.length, 1);
  assert.equal(measurementPracticeBindings[0]!.templateId, "rectangle-area");
  for (const changed of [
    { ...measurementAlignments[0]!, pageIds: ["absent"] },
    { ...measurementAlignments[0]!, taskIds: ["absent"] },
    { ...measurementAlignments[0]!, standardIds: ["3.MD.fake"] },
    { ...measurementAlignments[0]!, templateIds: ["mean-data"] },
  ])
    assert.throws(() =>
      validateMeasurementAlignments(skills, templates, standards, [changed]),
    );
  for (const changed of [
    { ...measurementPracticeBindings[0]!, pageIds: ["absent"] },
    { ...measurementPracticeBindings[0]!, unassessedRequirements: [] },
    { ...measurementPracticeBindings[0]!, skillId: "perimeter" },
  ])
    assert.throws(() =>
      validateMeasurementPracticeBindings(templates, [changed]),
    );
});
test("new region models require explicit reader capability before book delivery", () => {
  const registered = bookFor(book.id)!;
  assert.ok(registered);
  assert.deepEqual(registered.requiredReaderCapabilities, [
    "unit-regions-v1",
    "algebra-models-v1",
  ]);
  assert.equal(
    supportsBook(registered.requiredReaderCapabilities, readerCapabilities),
    true,
  );
  assert.equal(
    supportsBook(registered.requiredReaderCapabilities, [
      "algebra-models-v1",
      "early-number-v1",
    ]),
    false,
  );
  assert.equal(
    supportsBook(registered.requiredReaderCapabilities, ["unit-regions-v1"]),
    false,
  );
});
test("L-shaped teaching figures conserve coverage across different cuts", () => {
  const regions = diagrams.filter(
    (d) => d.kind === "unit-region" && d.id.includes("split"),
  );
  assert.equal(regions.length, 2);
  for (const d of regions) {
    if (d.kind !== "unit-region") throw new Error(d.id);
    assert.equal(d.cells.length, 24);
    const occupied = new Set(d.cells.map((p) => `${p.column},${p.row}`));
    const perimeter = d.cells.reduce(
      (total, p) =>
        total +
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(
          ([dx, dy]) => !occupied.has(`${p.column + dx!},${p.row + dy!}`),
        ).length,
      0,
    );
    assert.equal(perimeter, 22);
  }
  const first = regions[0]!,
    second = regions[1]!;
  if (first.kind !== "unit-region" || second.kind !== "unit-region")
    throw new Error("regions expected");
  assert.notDeepEqual(first.partitions, second.partitions);
});
test("jacket derives boundary and coverage from the same known cells", () => {
  const d = diagrams.find((d) => d.id === "welcome-courtyard");
  assert.ok(d && d.kind === "unit-region");
  if (d.kind !== "unit-region") throw new Error("region expected");
  const html = renderToStaticMarkup(
    React.createElement(UnitRegionCover, { diagram: d }),
  );
  assert.match(html, /20 m around/);
  assert.match(html, /24 square m/);
  assert.match(html, /schematic/);
});
test("ruler illustrations preserve quarter-unit endpoints and the shifted interval", () => {
  const quarter = diagrams.find((d) => d.id === "quarter-ribbon"),
    shift = diagrams.find((d) => d.id === "shifted-pencil");
  assert.ok(quarter && quarter.kind === "number-line");
  assert.ok(shift && shift.kind === "number-line");
  if (quarter.kind !== "number-line" || shift.kind !== "number-line")
    throw new Error("number lines expected");
  assert.equal(quarter.divisionsPerUnit, 4);
  assert.deepEqual(
    quarter.marks.map((m) => m.at),
    [
      [3, 4],
      [13, 4],
    ],
  );
  assert.deepEqual(shift.jumps, [{ from: [3, 1], to: [9, 1], label: "6 cm" }]);
  assert.equal(
    book.pages.find((p) => p.id === "start-away-from-zero")!.title,
    "Start away from zero",
  );
});

test("direct area and perimeter comparisons declare the same diagram viewport", () => {
  for (const ids of [
    ["equal-area-long", "equal-area-compact"],
    ["equal-border-three", "equal-border-four"],
  ]) {
    const pair = ids.map((id) => diagrams.find((d) => d.id === id)!);
    assert.ok(pair.every((d) => d.kind === "unit-region"));
    if (pair[0]!.kind !== "unit-region" || pair[1]!.kind !== "unit-region")
      throw new Error("regions expected");
    assert.ok(pair[0]!.scaleFrame);
    assert.deepEqual(pair[0]!.scaleFrame, pair[1]!.scaleFrame);
  }
});
