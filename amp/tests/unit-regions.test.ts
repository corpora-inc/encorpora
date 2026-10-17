import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  regionBoundaryEdges,
  unitRegionLayout,
  validateUnitRegionModel,
  type UnitRegionModel,
} from "../src/publishing/unit-regions.js";
import { UnitRegionFigure } from "../src/publishing/UnitRegionFigure.js";
import { validateDiagram } from "../src/publishing/validate.js";
const rectangle = (width: number, height: number) =>
  Array.from({ length: width * height }, (_, i) => ({
    column: i % width,
    row: Math.floor(i / width),
  }));
const region = (patch: Partial<UnitRegionModel> = {}): UnitRegionModel => ({
  kind: "unit-region",
  unit: "cm",
  cells: rectangle(4, 3),
  showGrid: true,
  ...patch,
});

test("shared-edge cancellation preserves complete rectangles and concave boundaries", () => {
  for (const [w, h] of [
    [1, 1],
    [4, 3],
    [12, 8],
  ]) {
    const d = region({ cells: rectangle(w!, h!) });
    validateUnitRegionModel(d);
    assert.equal(regionBoundaryEdges(d.cells).length, 2 * (w! + h!));
  }
  const l = region({
    cells: rectangle(3, 3).filter((p) => p.column === 0 || p.row === 2),
  });
  validateUnitRegionModel(l);
  assert.equal(l.cells.length, 5);
  assert.equal(regionBoundaryEdges(l.cells).length, 12);
  const u = region({
    cells: rectangle(3, 3).filter((p) => p.column !== 1 || p.row === 2),
  });
  validateUnitRegionModel(u);
  assert.equal(regionBoundaryEdges(u.cells).length, 16);
});
test("rejects unbounded, disconnected, duplicate and enclosed-gap cell collections", () => {
  const bad: Partial<UnitRegionModel>[] = [
    { cells: [] },
    {
      cells: [
        { column: 0, row: 0 },
        { column: 0, row: 0 },
      ],
    },
    {
      cells: [
        { column: 0, row: 0 },
        { column: 1, row: 1 },
      ],
    },
    { cells: [{ column: 1, row: 0 }] },
    { cells: [{ column: 0, row: 0.5 }] },
    { cells: rectangle(13, 1) },
    { cells: rectangle(1, 9) },
    { cells: rectangle(3, 3).filter((p) => p.column !== 1 || p.row !== 1) },
    { showGrid: undefined },
    { unit: "feet" as never },
  ];
  for (const patch of bad)
    assert.throws(() => validateUnitRegionModel(region(patch)));
});
test("every partition unit edge must have occupied cells on both sides", () => {
  const valid = region({
    partitions: [{ from: { column: 2, row: 0 }, to: { column: 2, row: 3 } }],
  });
  assert.doesNotThrow(() => validateUnitRegionModel(valid));
  for (const segment of [
    { from: { column: 0, row: 0 }, to: { column: 4, row: 0 } },
    { from: { column: 2, row: 0 }, to: { column: 2, row: 4 } },
    { from: { column: 1, row: 1 }, to: { column: 1, row: 1 } },
    { from: { column: 1, row: 0 }, to: { column: 2, row: 3 } },
    { from: { column: 1.5, row: 0 }, to: { column: 1.5, row: 3 } },
  ])
    assert.throws(() =>
      validateUnitRegionModel(region({ partitions: [segment] })),
    );
  assert.throws(
    () =>
      validateUnitRegionModel({
        ...valid,
        partitions: [...valid.partitions!, ...valid.partitions!],
      }),
    /overlapping/,
  );
  // The proposed line crosses a missing cell between its valid end regions.
  const c = rectangle(4, 4).filter(
    (p) => p.column === 0 || p.row === 0 || p.row === 3,
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({
          cells: c,
          partitions: [
            { from: { column: 1, row: 0 }, to: { column: 1, row: 4 } },
          ],
        }),
      ),
    /every partition/,
  );
});
test("labels follow complete exterior edges and reject interior-facing or duplicated spans", () => {
  const top = {
    from: { column: 0, row: 0 },
    to: { column: 4, row: 0 },
    side: "above" as const,
  };
  assert.doesNotThrow(() =>
    validateUnitRegionModel(region({ edgeLabels: [top] })),
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({ edgeLabels: [{ ...top, side: "below" }] }),
      ),
    /exterior/,
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({ edgeLabels: [{ ...top, side: "left" }] }),
      ),
    /orientation/,
  );
  assert.throws(
    () => validateUnitRegionModel(region({ edgeLabels: [top, top] })),
    /overlapping/,
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({ edgeLabels: [{ ...top, to: { column: 5, row: 0 } }] }),
      ),
    /boundary/,
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({
          edgeLabels: [
            {
              from: { column: 1, row: 1 },
              to: { column: 3, row: 1 },
              side: "above",
            },
          ],
        }),
      ),
    /boundary/,
  );
});
test("rendered cells retain identical horizontal and vertical units with explicit known edge lengths", () => {
  const d = {
    ...region({
      cells: rectangle(12, 8),
      edgeLabels: [
        {
          from: { column: 0, row: 0 },
          to: { column: 12, row: 0 },
          side: "above",
        },
      ],
    }),
    id: "maximum-region",
    caption: "A rectangle on an equal-unit grid.",
    alt: "Twelve columns and eight rows of unit squares.",
  };
  validateDiagram(d);
  const html = renderToStaticMarkup(
    React.createElement(UnitRegionFigure, { diagram: d }),
  );
  assert.equal((html.match(/data-region-cell=/g) ?? []).length, 96);
  assert.equal((html.match(/data-region-boundary=/g) ?? []).length, 40);
  assert.equal((html.match(/width="20" height="20"/g) ?? []).length, 96);
  assert.match(html, /data-region-length="12"/);
  assert.match(html, /Drawings are not life-size/);
});
test("valid mathematical labels fail closed when a narrow notch cannot hold their text", () => {
  const cells = rectangle(12, 8).filter((p) => p.column < 6 || p.row !== 3);
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({
          cells,
          edgeLabels: [
            {
              from: { column: 6, row: 3 },
              to: { column: 12, row: 3 },
              side: "below",
            },
          ],
        }),
      ),
    /overlap the region/,
  );
  const slit = rectangle(12, 8).filter((p) => p.column !== 5 || p.row === 7);
  const left = {
    from: { column: 5, row: 0 },
    to: { column: 5, row: 7 },
    side: "right" as const,
  };
  const right = {
    from: { column: 6, row: 0 },
    to: { column: 6, row: 7 },
    side: "left" as const,
  };
  assert.doesNotThrow(() =>
    validateUnitRegionModel(region({ cells: slit, edgeLabels: [left] })),
  );
  assert.throws(
    () =>
      validateUnitRegionModel(
        region({ cells: slit, edgeLabels: [left, right] }),
      ),
    /labels would overlap/,
  );
});

test("outline-only figures describe units without referring to hidden grid steps", () => {
  const html = renderToStaticMarkup(
    React.createElement(UnitRegionFigure, {
      diagram: {
        ...region({ showGrid: false }),
        id: "outline",
        alt: "Rectangle",
        caption: "Compare its boundary and coverage.",
      },
    }),
  );
  assert.match(html, /Lengths are measured in cm/);
  assert.doesNotMatch(html, /Each grid step/);
});

test("comparison viewports preserve equal unit scales and reject cropped or noninteger frames", () => {
  const a = region({
      cells: rectangle(12, 2),
      scaleFrame: { columns: 12, rows: 3 },
    }),
    b = region({
      cells: rectangle(8, 3),
      scaleFrame: { columns: 12, rows: 3 },
    });
  validateUnitRegionModel(a);
  validateUnitRegionModel(b);
  assert.equal(unitRegionLayout(a).cell, unitRegionLayout(b).cell);
  assert.equal(unitRegionLayout(a).height, unitRegionLayout(b).height);
  for (const frame of [
    { columns: 11, rows: 3 },
    { columns: 12, rows: 1 },
    { columns: 13, rows: 3 },
    { columns: 12, rows: 9 },
    { columns: 12.5, rows: 3 },
    null,
  ])
    assert.throws(() =>
      validateUnitRegionModel({ ...a, scaleFrame: frame as never }),
    );
});
