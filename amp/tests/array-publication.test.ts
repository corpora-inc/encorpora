import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookDiagram } from "../src/publishing/diagrams.js";
import { ArrayCover } from "../src/publishing/ArrayCover.js";
import { validateDiagram } from "../src/publishing/validate.js";
import type { Diagram } from "../src/publishing/schema.js";
const array: Extract<Diagram, { kind: "array" }> = {
  kind: "array",
  id: "array-model",
  alt: "Four rows of seven unit squares split into groups of five and two columns.",
  caption: "The parts fill the same rectangle.",
  rows: 4,
  columns: 7,
  splitAfterColumn: 5,
  rowLabel: "4 rows",
  columnLabel: "7 in each row",
};
test("array cells form disjoint complete regions with exact counts", () => {
  for (let rows = 1; rows <= 12; rows++)
    for (let columns = 1; columns <= 12; columns++) {
      const d = {
        ...array,
        rows,
        columns,
        splitAfterColumn: columns > 1 ? 1 : undefined,
        splitAfterRow: rows > 1 ? 1 : undefined,
      };
      const html = renderToStaticMarkup(
        React.createElement(BookDiagram, { diagram: d }),
      );
      assert.equal(
        (html.match(/data-array-row=/g) ?? []).length,
        rows * columns,
      );
      assert.equal((html.match(/data-array-region="00"/g) ?? []).length, 1);
      assert.equal(
        (html.match(/data-array-region="11"/g) ?? []).length,
        (rows - 1) * (columns - 1),
      );
    }
});
test("array rejects noninterior splits, fractional dimensions and missing axis meaning", () => {
  for (const patch of [
    { rows: 0 },
    { columns: 13 },
    { rows: 2.5 },
    { splitAfterColumn: 0 },
    { splitAfterColumn: 7 },
    { splitAfterRow: 4 },
    { splitAfterRow: NaN },
    { rowLabel: " " },
    { columnLabel: "" },
  ])
    assert.throws(() => validateDiagram({ ...array, ...patch }));
});
test("array cover equation derives from cells and escapes author text", () => {
  const html = renderToStaticMarkup(
    React.createElement(ArrayCover, {
      diagram: { ...array, columnLabel: "<script>alert(1)</script>" },
    }),
  );
  assert.match(html, /4 × 7 = 28/);
  assert.equal((html.match(/data-array-row=/g) ?? []).length, 28);
  assert.ok(!html.includes("<script>"));
});
test("array rectangle coordinates tile one contiguous area without overlap", () => {
  const html = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: array }),
  );
  const rects = [...html.matchAll(/<rect\b[^>]*data-array-row[^>]*>/g)].map(
    ([tag]) =>
      Object.fromEntries(
        [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k!, v!]),
      ),
  );
  const cell = 38,
    left = (600 - 7 * cell) / 2;
  for (const rect of rects) {
    assert.equal(
      Number(rect.x),
      left + Number(rect["data-array-column"]) * cell,
    );
    assert.equal(Number(rect.y), 52 + Number(rect["data-array-row"]) * cell);
    assert.equal(Number(rect.width), cell);
    assert.equal(Number(rect.height), cell);
  }
  assert.equal(
    rects.reduce((sum, r) => sum + Number(r.width) * Number(r.height), 0),
    7 * cell * (4 * cell),
  );
});
test("bounded whole-unit groups show exact remainder cells", () => {
  const d: Diagram = {
    kind: "groups",
    id: "tokens",
    alt: "Seventeen tokens in groups of five with two tokens left.",
    caption: "Three complete groups and two tokens left.",
    wholeLabel: "one token",
    total: [17, 1],
    groupSize: [5, 1],
    unitDivisions: 1,
  };
  const html = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: d }),
  );
  assert.equal((html.match(/<rect/g) ?? []).length, 17);
  assert.equal((html.match(/data-complete="true"/g) ?? []).length, 3);
  assert.equal((html.match(/data-complete="false"/g) ?? []).length, 1);
  assert.match(html, /2 left/);
  for (const invalid of [
    { ...d, total: [31, 1] },
    { ...d, total: [29, 2] },
    { ...d, unitDivisions: 2 },
    { ...d, groupSize: [1, 1] },
  ])
    assert.throws(() => validateDiagram(invalid as Diagram));
});
test("extended number lines keep whole-unit ticks and sparse labels with disjoint jumps", () => {
  const d: Extract<Diagram, { kind: "number-line" }> = {
    kind: "number-line",
    id: "jumps",
    alt: "Four jumps of five reach twenty.",
    caption: "Count jumps rather than endpoints.",
    wholeLabel: "one unit",
    min: [0, 1],
    max: [20, 1],
    divisionsPerUnit: 1,
    integerLabelInterval: 5,
    marks: [],
    jumps: Array.from({ length: 4 }, (_, i) => ({
      from: [i * 5, 1],
      to: [(i + 1) * 5, 1],
      label: "5",
    })),
  };
  const html = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: d }),
  );
  assert.equal((html.match(/marker-end=/g) ?? []).length, 4);
  assert.equal((html.match(/y="48"/g) ?? []).length, 4);
  assert.match(html, />20<\/text>/);
  assert.ok(!html.includes(">19</text>"));
  assert.throws(() => validateDiagram({ ...d, integerLabelInterval: 1 }));
  assert.throws(() => validateDiagram({ ...d, divisionsPerUnit: 2 }));
  assert.throws(() =>
    validateDiagram({
      ...d,
      jumps: [
        { from: [0, 1], to: [10, 1], label: "10" },
        { from: [5, 1], to: [15, 1], label: "10" },
      ],
    }),
  );
  assert.throws(() =>
    validateDiagram({
      ...d,
      jumps: [{ from: [0, 1], to: [0, 1], label: "0" }],
    }),
  );
});

test("phone array geometry partitions the same exact unit cells", async () => {
  const { BookArrayDrawing } = await import("../src/web/BookArrayDrawing.js");
  for (const rows of [1, 3, 12])
    for (const columns of [1, 7, 12]) {
      const d = {
        ...array,
        rows,
        columns,
        splitAfterRow: rows > 1 ? 1 : undefined,
        splitAfterColumn: columns > 1 ? 1 : undefined,
      };
      const html = renderToStaticMarkup(
        React.createElement(BookArrayDrawing, { diagram: d }),
      );
      const rects = [...html.matchAll(/<rect\b[^>]*data-array-row[^>]*>/g)].map(
        ([tag]) =>
          Object.fromEntries(
            [...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [
              k!,
              v!,
            ]),
          ),
      );
      const cell = Math.min(28, 280 / columns, 200 / rows),
        left = (320 - columns * cell) / 2;
      assert.equal(rects.length, rows * columns);
      for (const r of rects) {
        assert.equal(Number(r.x), left + Number(r["data-array-column"]) * cell);
        assert.equal(Number(r.y), 10 + Number(r["data-array-row"]) * cell);
        assert.equal(Number(r.width), cell);
        assert.equal(Number(r.height), cell);
      }
    }
});

test("extended workspace retains exact physical vector dimensions", async () => {
  const { renderBook } = await import("../src/publishing/book.js");
  const html = renderBook({
    id: "workspace-check",
    version: "1",
    title: "Workspace",
    subtitle: "",
    audience: "Review",
    description: "Exact physical workspace",
    pages: [
      {
        id: "work",
        kind: "workshop",
        eyebrow: "Draw",
        title: "Explain a model",
        blocks: [
          {
            kind: "task",
            id: "draw",
            prompt: "Draw a labeled model.",
            response: { kind: "grid", size: "extended" },
          },
          {
            kind: "solution",
            taskId: "draw",
            answer: "A labeled model.",
            reasoning: "Quantities and units agree.",
          },
        ],
      },
    ],
  });
  assert.match(html, /workspace grid extended/);
  assert.match(html, /viewBox="0 0 691.2 230.4"/);
  assert.match(html, /\.workspace.extended\{height:2.4in\}/);
});
test("publisher selects an identifier rather than loading caller-supplied source paths", async () => {
  const { parsePublishingArgs } = await import("../src/publishing/options.js");
  assert.deepEqual(
    parsePublishingArgs(["--book", "equal-groups-workshop", "--all-pages"]),
    {
      bookId: "equal-groups-workshop",
      outputDirectory: "artifacts/books/equal-groups-workshop",
      allPages: true,
    },
  );
  for (const args of [
    ["--book", "../secrets"],
    ["--book", "/tmp/book.ts"],
    ["--book", "https://example.org/book"],
    ["--book", "one", "--book", "two"],
  ])
    assert.throws(() => parsePublishingArgs(args));
});

test("publication provenance includes nested author modules and rejects path traversal/symlinks", async () => {
  const { mkdtemp, mkdir, writeFile, symlink, rm } =
    await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { publicationSourceHashes } =
    await import("../src/publishing/source-manifest.js");
  const root = await mkdtemp(join(tmpdir(), "amp-book-source-"));
  try {
    for (const path of [
      "books/example/chapters",
      "src/publishing",
      "src/books",
      "scripts",
    ])
      await mkdir(join(root, path), { recursive: true });
    for (const path of [
      "books/example/book.ts",
      "books/example/chapters/one.ts",
      "src/publishing/schema.ts",
      "src/books/catalog.ts",
      "scripts/publish-book.ts",
    ])
      await writeFile(join(root, path), path);
    const before = await publicationSourceHashes(root, "example");
    assert.equal(Object.keys(before).length, 5);
    assert.ok(before["books/example/chapters/one.ts"]);
    await writeFile(
      join(root, "books/example/chapters/one.ts"),
      "updated lesson",
    );
    const after = await publicationSourceHashes(root, "example");
    assert.notEqual(
      before["books/example/chapters/one.ts"],
      after["books/example/chapters/one.ts"],
    );
    await assert.rejects(publicationSourceHashes(root, "../example"));
    await symlink(
      join(root, "scripts/publish-book.ts"),
      join(root, "books/example/linked.ts"),
    );
    await assert.rejects(publicationSourceHashes(root, "example"), /symlink/);
    await symlink(join(root, "books/example"), join(root, "books/linked"));
    await assert.rejects(publicationSourceHashes(root, "linked"), /symlink/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("mobile integer line has exact whole ticks, sparse labels and four disjoint forward arrows", async () => {
  const { BookIntegerLineDrawing } =
    await import("../src/web/BookIntegerLineDrawing.js");
  const line: Extract<Diagram, { kind: "number-line" }> = {
    kind: "number-line",
    id: "twenty",
    alt: "Four jumps of five reach twenty",
    caption: "Four equal groups",
    wholeLabel: "Each small interval is one unit",
    min: [0, 1],
    max: [20, 1],
    divisionsPerUnit: 1,
    integerLabelInterval: 5,
    marks: [],
    jumps: Array.from({ length: 4 }, (_, i) => ({
      from: [i * 5, 1],
      to: [(i + 1) * 5, 1],
      label: "+5",
    })),
  };
  const html = renderToStaticMarkup(
    React.createElement(BookIntegerLineDrawing, { diagram: line }),
  );
  assert.deepEqual(
    [...html.matchAll(/data-line-tick="([^"]+)"/g)].map((m) => Number(m[1])),
    Array.from({ length: 21 }, (_, i) => i),
  );
  assert.deepEqual(
    [...html.matchAll(/data-line-label="([^"]+)"/g)].map((m) => Number(m[1])),
    [0, 5, 10, 15, 20],
  );
  assert.deepEqual(
    [
      ...html.matchAll(
        /data-jump-from="([^"]+)" data-jump-to="([^"]+)" d="M([^,]+),[^ ]+ Q[^ ]+ ([^,]+),/g,
      ),
    ].map((m) => [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]),
    [
      [0, 5, 24, 92],
      [5, 10, 92, 160],
      [10, 15, 160, 228],
      [15, 20, 228, 296],
    ],
  );
  assert.equal((html.match(/marker-end=/g) ?? []).length, 4);
});

test("mobile line separates neighboring labels without moving their mathematical points", async () => {
  const { BookIntegerLineDrawing } =
    await import("../src/web/BookIntegerLineDrawing.js");
  const d: Extract<Diagram, { kind: "number-line" }> = {
    kind: "number-line",
    id: "crowded",
    alt: "Two nearby named points",
    caption: "The points remain one unit apart.",
    wholeLabel: "Each small interval is one unit",
    min: [0, 1],
    max: [20, 1],
    divisionsPerUnit: 1,
    integerLabelInterval: 5,
    marks: [
      { at: [0, 1], label: "Start" },
      { at: [1, 1], label: "Point" },
    ],
  };
  const html = renderToStaticMarkup(
    React.createElement(BookIntegerLineDrawing, { diagram: d }),
  );
  const labels = [
    ...html.matchAll(
      /<text data-line-label="([^"]+)" x="([^"]+)" y="([^"]+)" text-anchor="middle">([^<]+)<\/text>/g,
    ),
  ].map((m) => ({
    at: Number(m[1]),
    x: Number(m[2]),
    y: Number(m[3]),
    text: m[4]!,
  }));
  assert.equal(labels.length, 6);
  for (let i = 0; i < labels.length; i++)
    for (let j = 0; j < i; j++) {
      const a = labels[i]!,
        b = labels[j]!;
      if (a.y === b.y)
        assert.ok(Math.abs(a.x - b.x) > (a.text.length + b.text.length) * 5.5);
    }
  assert.match(html, /<circle cx="24"/);
  assert.match(html, /<circle cx="37.6"/);
});

test("extended integer line rejects dense labels and marks between whole-unit ticks", () => {
  const d: Extract<Diagram, { kind: "number-line" }> = {
    kind: "number-line",
    id: "dense",
    alt: "Integer points",
    caption: "Whole units",
    wholeLabel: "Each interval is one unit",
    min: [0, 1],
    max: [20, 1],
    divisionsPerUnit: 1,
    integerLabelInterval: 5,
    marks: [],
  };
  assert.throws(
    () => validateDiagram({ ...d, marks: [{ at: [1, 2], label: "Half" }] }),
    /whole-number/,
  );
  assert.throws(
    () =>
      validateDiagram({
        ...d,
        marks: Array.from({ length: 12 }, (_, i) => ({
          at: [i, 1],
          label: `Point${String(i).padStart(3, "0")}`,
        })),
      }),
    /too dense/,
  );
});

test("short multiple-jump lines share the phone readability gate", () => {
  const d: Extract<Diagram, { kind: "number-line" }> = {
    kind: "number-line",
    id: "short-jumps",
    alt: "Two jumps",
    caption: "Two equal jumps reach four",
    wholeLabel: "One unit",
    min: [0, 1],
    max: [4, 1],
    divisionsPerUnit: 1,
    marks: [],
    jumps: [
      { from: [0, 1], to: [2, 1], label: "+2" },
      { from: [2, 1], to: [4, 1], label: "+2" },
    ],
  };
  assert.doesNotThrow(() => validateDiagram(d));
  assert.throws(
    () =>
      validateDiagram({
        ...d,
        marks: Array.from({ length: 8 }, (_, i) => ({
          at: [i, 100],
          label: `Point${String(i).padStart(3, "0")}`,
        })),
      }),
    /too dense/,
  );
});
