import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateProblem, templates } from "../src/math/engine";
import { semanticFigureSchema } from "../src/math/contracts";
import {
  barGraphLayout,
  boxPlotLayout,
  doubleBoxLayout,
  doubleDotLayout,
  histogramLayout,
  scatterLayout,
  dataDisplayKinds,
  linePlotLayout,
  pictureGraphLayout,
  sortShapesLayout,
  type DataDisplayFigure,
} from "../src/math/data-display-models";
import { DataDisplayFigure as Chart } from "../src/web/DataDisplayFigure";
import { dataIllustrations } from "../src/content/data-display-illustrations";

const dataTemplates = templates.filter((t) =>
  [0, 1, 2].some((i) =>
    dataDisplayKinds.has(
      generateProblem(t.id, `kind-${i}`).public.figure?.kind ?? "",
    ),
  ),
);
const figures = (id: string, n = 120) =>
  Array.from({ length: n }, (_, i) => generateProblem(id, `chart-${i}`))
    .map((p) => p.public.figure)
    .filter((f): f is DataDisplayFigure => !!f && dataDisplayKinds.has(f.kind));

test("every chart-bearing template declares the data-display capability", () => {
  assert.ok(dataTemplates.length >= 5);
  for (const t of dataTemplates)
    assert.equal(t.requiredFigureCapability, "data-displays-v1", t.id);
});

test("drawn geometry is exactly proportional to the displayed data", () => {
  for (const t of dataTemplates)
    for (const figure of figures(t.id)) {
      assert.ok(semanticFigureSchema.safeParse(figure).success, t.id);
      if (figure.kind === "scaled-bar-graph") {
        const l = barGraphLayout(figure);
        const unit = (l.bottom - l.top) / figure.max;
        for (const bar of l.bars) {
          assert.ok(Math.abs(bar.height - bar.value * unit) < 1e-9);
          assert.ok(Math.abs(bar.top + bar.height - l.bottom) < 1e-9);
        }
        assert.equal(l.gridlines.at(-1), figure.max);
        // Bars never overlap and stay inside the plot.
        l.bars.forEach((b, i) => {
          assert.ok(b.x >= l.left && b.x + b.width <= l.right);
          if (i) assert.ok(b.x > l.bars[i - 1]!.x + l.bars[i - 1]!.width);
        });
      } else if (figure.kind === "picture-graph") {
        const l = pictureGraphLayout(figure);
        l.rows.forEach((row, i) => {
          const drawn = row.symbols.reduce(
            (sum, s) => sum + (s.half ? figure.key / 2 : figure.key),
            0,
          );
          assert.equal(drawn, figure.categories[i]!.count);
          assert.ok(row.symbols.filter((s) => s.half).length <= 1);
          assert.ok((row.symbols.at(-1)?.cx ?? 0) + l.radius <= 352);
        });
      } else if (figure.kind === "histogram") {
        const l = histogramLayout(figure);
        const unit = (l.bottom - l.top) / l.max;
        l.bars.forEach((b, i) => {
          assert.ok(Math.abs(b.height - b.count * unit) < 1e-9);
          // Bars touch: each starts where the last ended.
          if (i)
            assert.ok(
              Math.abs(b.x - (l.bars[i - 1]!.x + l.bars[i - 1]!.width)) < 1e-9,
            );
        });
        assert.ok(l.max >= Math.max(...figure.counts));
      } else if (figure.kind === "box-plot") {
        const l = boxPlotLayout(figure);
        const [min, q1, med, q3, max] = figure.summary;
        assert.deepEqual(
          [l.box.min, l.box.q1, l.box.median, l.box.q3, l.box.max],
          [min, q1, med, q3, max].map(l.x),
        );
        assert.ok(l.box.min >= l.left && l.box.max <= l.right);
      } else if (figure.kind === "scatter-plot") {
        const l = scatterLayout(figure);
        figure.points.forEach(([px, py], i) => {
          // Each point sits exactly at its pair, inside the grid.
          assert.ok(Math.abs(l.points[i]!.cx - l.x(px)) < 1e-9);
          assert.ok(Math.abs(l.points[i]!.cy - l.y(py)) < 1e-9);
          assert.ok(l.points[i]!.cx >= l.left && l.points[i]!.cx <= l.right);
          assert.ok(l.points[i]!.cy >= l.top && l.points[i]!.cy <= l.bottom);
        });
        if (l.line) {
          // The drawn segment passes through both marked lattice points.
          const { x1, y1, x2, y2 } = l.line;
          for (const m of l.line.marks) {
            const cross = (x2 - x1) * (m.cy - y1) - (y2 - y1) * (m.cx - x1);
            assert.ok(Math.abs(cross) < 1e-6);
            assert.ok(m.cx >= x1 - 1e-9 && m.cx <= x2 + 1e-9);
          }
          assert.ok(y1 >= l.top - 1e-9 && y1 <= l.bottom + 1e-9);
          assert.ok(y2 >= l.top - 1e-9 && y2 <= l.bottom + 1e-9);
        }
      } else if (figure.kind === "two-way-table") {
        // Every known entry agrees with the row and column sums it is part of.
        const g = [
          [...figure.cells[0], figure.rowTotals[0]],
          [...figure.cells[1], figure.rowTotals[1]],
          [...figure.columnTotals, figure.total],
        ];
        const known = (v: unknown): v is number => typeof v === "number";
        for (let i = 0; i < 3; i++)
          if (g[i]!.every(known))
            assert.equal((g[i]![0] as number) + (g[i]![1] as number), g[i]![2]);
        for (let j = 0; j < 3; j++)
          if ([0, 1, 2].every((i) => known(g[i]![j])))
            assert.equal((g[0]![j] as number) + (g[1]![j] as number), g[2]![j]);
      } else if (figure.kind === "double-dot-plot") {
        const l = doubleDotLayout(figure);
        l.panels.forEach((p, i) => {
          const values = figure.groups[i]!.values;
          assert.equal(p.marks.length, values.length);
          for (const m of p.marks) {
            // Same value, same x in both panels; stacks stay inside their panel.
            assert.ok(Math.abs(m.cx - l.x(m.value)) < 1e-9);
            assert.ok(m.cy + 7 < p.axisY);
            assert.ok(m.cy - 7 > (i ? l.panels[0]!.axisY + 30 : 24));
          }
        });
        assert.ok(l.ticks.at(-1)!.x <= l.right + 1e-9);
      } else if (figure.kind === "double-box-plot") {
        const l = doubleBoxLayout(figure);
        l.boxes.forEach((b, i) => {
          const [min, q1, med, q3, max] = figure.groups[i]!.summary;
          assert.deepEqual(
            [b.box.min, b.box.q1, b.box.median, b.box.q3, b.box.max],
            [min, q1, med, q3, max].map(l.x),
          );
          assert.ok(b.box.bottom < l.axisY - 10);
        });
        assert.ok(l.boxes[0]!.box.bottom + 24 < l.boxes[1]!.box.top);
      } else if (figure.kind === "line-plot") {
        const l = linePlotLayout(figure);
        const step = l.ticks[1]!.x - l.ticks[0]!.x;
        l.ticks.forEach((t, i) =>
          assert.ok(Math.abs(t.x - (l.left + i * step)) < 1e-9),
        );
        for (const m of l.marks) {
          // Each mark sits exactly above its value, one level per repeat.
          assert.ok(Math.abs(m.cx - l.x(m.value)) < 1e-9);
          assert.ok(m.cy - 7 > 0 && m.cy + 7 < l.axisY);
        }
        assert.equal(l.marks.length, figure.values.length);
        assert.ok(figure.end - figure.start <= 12);
      } else if (figure.kind === "sort-shapes") {
        const placed = sortShapesLayout(figure.shapes);
        for (const p of placed)
          assert.ok(p.cx - p.size / 2 >= 0 && p.cx + p.size / 2 <= 360);
        assert.equal(
          new Set(placed.map((p) => `${p.cx},${p.cy}`)).size,
          placed.length,
        );
      }
    }
});

test("rendered charts draw one mark per datum and only role colors", () => {
  for (const t of dataTemplates)
    for (const figure of figures(t.id, 20)) {
      const svg = renderToStaticMarkup(React.createElement(Chart, { figure }));
      assert.doesNotMatch(svg, /#[0-9a-f]{3,8}\b|rgb\(/i, t.id);
      assert.match(svg, /role="img" aria-label="[^"]{20,}"/);
      if (figure.kind === "sort-shapes")
        assert.equal(svg.match(/data-shape=/g)?.length, figure.shapes.length);
      if (figure.kind === "line-plot")
        assert.equal(svg.match(/data-mark=/g)?.length, figure.values.length);
      if (figure.kind === "scaled-bar-graph")
        assert.equal(svg.match(/data-bar=/g)?.length, figure.categories.length);
      if (figure.kind === "double-dot-plot")
        assert.equal(
          svg.match(/data-mark=/g)?.length,
          figure.groups[0].values.length + figure.groups[1].values.length,
        );
      if (figure.kind === "scatter-plot")
        assert.equal(svg.match(/data-point=/g)?.length, figure.points.length);
      if (figure.kind === "two-way-table")
        assert.equal(svg.match(/data-cell=/g)?.length, 9);
      if (figure.kind === "double-box-plot")
        assert.equal(svg.match(/data-box=/g)?.length, 2);
    }
  for (const figure of Object.values(dataIllustrations))
    assert.ok(semanticFigureSchema.safeParse(figure).success);
});

test("unreadable charts are rejected", () => {
  const bad: unknown[] = [
    {
      kind: "scaled-bar-graph",
      categories: [
        { label: "A", value: 7 },
        { label: "B", value: 10 },
      ],
      step: 10,
      max: 60,
      unit: "cans",
    },
    {
      kind: "scaled-bar-graph",
      categories: [
        { label: "A", value: 10 },
        { label: "B", value: 10 },
      ],
      step: 5,
      max: 75,
      unit: "cans",
    },
    {
      kind: "picture-graph",
      categories: [
        { label: "A", count: 7 },
        { label: "B", count: 10 },
      ],
      key: 5,
      unit: "students",
    },
    { kind: "sort-shapes", shapes: ["circle", "hexagon", "square"] },
  ];
  for (const figure of bad)
    assert.equal(semanticFigureSchema.safeParse(figure).success, false);
});

test("a missing two-way count must come from its column: its row-mate is blank", () => {
  for (let i = 0; i < 60; i++) {
    const f = generateProblem("two-way-missing", `blank-${i}`).public.figure;
    assert(f?.kind === "two-way-table");
    const row = f.cells.findIndex((r) => r.includes("?"));
    assert.ok(row >= 0);
    assert.deepEqual(
      [...f.cells[row]!].sort(),
      ["?", null].sort(),
      "the asked row has exactly two blanks",
    );
    assert.ok(f.cells[1 - row]!.every((v) => typeof v === "number"));
  }
});
