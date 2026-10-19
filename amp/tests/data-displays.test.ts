import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { generateProblem, templates } from "../src/math/engine";
import { semanticFigureSchema } from "../src/math/contracts";
import {
  barGraphLayout,
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
