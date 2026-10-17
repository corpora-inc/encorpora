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
