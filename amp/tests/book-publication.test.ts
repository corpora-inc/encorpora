import "../books/fraction-field-guide/book.test.js";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  Diagram,
  FractionBook,
} from "../books/fraction-field-guide/schema.js";
import { BookDiagram } from "../src/publishing/diagrams.js";
import { renderBook } from "../src/publishing/book.js";
import { validateBook, validateDiagram } from "../src/publishing/validate.js";
const common = {
  id: "test-diagram",
  caption: "One whole is the full bar.",
  alt: "A fraction model with labeled units.",
};
function svg(diagram: Diagram) {
  return renderToStaticMarkup(React.createElement(BookDiagram, { diagram }));
}
const book: FractionBook = {
  id: "test-book",
  version: "1",
  title: "A <safe> book",
  subtitle: "Read and reason",
  audience: "Learners",
  description: "Original test fixture",
  pages: [
    {
      id: "first-page",
      kind: "lesson",
      eyebrow: "Part one",
      title: "One whole",
      blocks: [
        {
          kind: "task",
          id: "one-task",
          prompt: "Explain <script>alert(1)</script>",
          response: { kind: "lines", size: "medium" },
        },
      ],
    },
    {
      id: "answers",
      kind: "solutions",
      eyebrow: "Check",
      title: "Solutions",
      blocks: [
        {
          kind: "solution",
          taskId: "one-task",
          answer: "One",
          reasoning: "A full whole.",
        },
      ],
    },
  ],
};
test("book validates references and rejects orphan or missing answers", () => {
  assert.doesNotThrow(() => validateBook(book));
  const missing = structuredClone(book);
  missing.pages.pop();
  assert.throws(() => validateBook(missing), /Missing solution/);
  const orphan = structuredClone(book);
  orphan.pages[0]!.blocks = [];
  assert.throws(() => validateBook(orphan), /Orphan solution/);
  const duplicate = structuredClone(book);
  duplicate.pages.push(duplicate.pages[0]!);
  assert.throws(() => validateBook(duplicate), /duplicate/);
});
test("publication escapes text and provides reciprocal solution links", () => {
  const html = renderBook(book);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes('href="#solution-one-task"'));
  assert.ok(html.includes('href="#one-task"'));
});
test("strip diagram preserves unit length across different numbers of wholes", () => {
  const html = svg({
    ...common,
    kind: "strips",
    wholeLabel: "Ribbon",
    rows: [
      { label: "half", parts: 2, shaded: 1 },
      { label: "five fourths", parts: 4, shaded: 5, wholes: 2 },
    ],
  });
  assert.equal((html.match(/data-part=/g) ?? []).length, 10);
  assert.equal((html.match(/data-shaded="true"/g) ?? []).length, 6);
  // One whole is210px in each row: half cell105px, quarter52.5px.
  assert.ok(html.includes('width="105"'));
  assert.ok(html.includes('width="52.5"'));
});
test("area model identifies exactly the intersection cells", () => {
  const html = svg({
    ...common,
    kind: "area",
    wholeLabel: "One plot",
    columns: 4,
    rows: 3,
    shadedColumns: 3,
    shadedRows: 2,
  });
  assert.equal((html.match(/data-overlap="true"/g) ?? []).length, 6);
  assert.equal((html.match(/data-overlap="false"/g) ?? []).length, 6);
});
test("grouping includes a partial final group", () => {
  const html = svg({
    ...common,
    kind: "groups",
    wholeLabel: "Length",
    total: [3, 2],
    groupSize: [2, 3],
    unitDivisions: 6,
  });
  assert.equal((html.match(/data-group=/g) ?? []).length, 3);
  assert.equal((html.match(/data-complete="false"/g) ?? []).length, 1);
});
test("double lines reject nonproportional intermediate positions exactly", () => {
  const d: Diagram = {
    ...common,
    kind: "double-line",
    topLabel: "Cups",
    bottomLabel: "Batches",
    pairs: [
      { top: [0, 1], bottom: [0, 1] },
      { top: [1, 3], bottom: [2, 3] },
      { top: [1, 1], bottom: [2, 1] },
    ],
  };
  assert.doesNotThrow(() => validateDiagram(d));
  d.pairs[1]!.bottom = [1, 1];
  assert.throws(() => validateDiagram(d), /scales disagree/);
});
test("invalid geometry fails before rendering", () => {
  assert.throws(
    () =>
      svg({
        ...common,
        kind: "strips",
        wholeLabel: "Whole",
        rows: [{ label: "bad", parts: 0, shaded: 1 }],
      }),
    /out of range/,
  );
  assert.throws(
    () =>
      svg({
        ...common,
        kind: "number-line",
        wholeLabel: "Distance",
        min: [0, 1],
        max: [1, 1],
        divisionsPerUnit: 4,
        marks: [{ at: [5, 4], label: "outside" }],
      }),
    /out of range/,
  );
});

test("exact grouping does not create a phantom final group", async () => {
  const { exactGroupCount, completeGroup } =
    await import("../src/publishing/validate.js");
  assert.equal(exactGroupCount([7, 10], [1, 10]), 7);
  assert.equal(exactGroupCount([3, 2], [2, 3]), 3);
  assert.equal(completeGroup([3, 2], [2, 3], 1), true);
  assert.equal(completeGroup([3, 2], [2, 3], 2), false);
});

test("reserved generated anchors cannot collide with authored ids", () => {
  const invalid = structuredClone(book);
  invalid.pages[0]!.id = "solution-one-task";
  assert.throws(() => validateBook(invalid), /Invalid or duplicate/);
});

test("number line emits explicit integer labels once on one baseline when space permits", () => {
  const html = svg({
    ...common,
    kind: "number-line",
    wholeLabel: "One kilometer",
    min: [0, 1],
    max: [1, 1],
    divisionsPerUnit: 4,
    marks: [
      { at: [0, 1], label: "0" },
      { at: [1, 4], label: "1/4" },
      { at: [1, 1], label: "1" },
    ],
  });
  assert.equal((html.match(/data-number-label="0"/g) ?? []).length, 1);
  assert.equal((html.match(/data-number-label="1"/g) ?? []).length, 1);
  assert.equal((html.match(/y="84" text-anchor="middle"/g) ?? []).length, 3);
});

test("ratio double lines reject a merely affine alignment", () => {
  assert.throws(
    () =>
      validateDiagram({
        ...common,
        kind: "double-line",
        topLabel: "Batches",
        bottomLabel: "Cups",
        pairs: [
          { top: [1, 1], bottom: [2, 1] },
          { top: [2, 1], bottom: [3, 1] },
        ],
      }),
    /shared zero/,
  );
});

test("publisher options accept flags before or after the output directory", async () => {
  const { parsePublishingArgs } = await import("../src/publishing/options.js");
  assert.deepEqual(parsePublishingArgs(["--all-pages", "/tmp/book"]), {
    outputDirectory: "/tmp/book",
    allPages: true,
  });
  assert.deepEqual(
    parsePublishingArgs(["--output", "/tmp/book", "--all-pages"]),
    { outputDirectory: "/tmp/book", allPages: true },
  );
  assert.throws(() => parsePublishingArgs(["--bogus"]), /Unknown/);
  assert.throws(() => parsePublishingArgs(["--output"]), /exactly one/);
});
