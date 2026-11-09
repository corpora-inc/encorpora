import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { algebraModels } from "./fixtures/algebra-models.js";
import { validateDiagram } from "../src/publishing/validate.js";
import {
  clipPlotLine,
  compareExact,
} from "../src/publishing/algebra-models.js";
import type { CoordinatePlot } from "../src/publishing/algebra-models.js";
import { BookDiagram } from "../src/publishing/diagrams.js";
import { BookScreenFigure } from "../src/web/BookScreenFigure.js";
import { contrast, resolveTheme, type Rgba } from "../scripts/color-system.js";
const plot = (): CoordinatePlot => ({
  kind: "coordinate-plot",
  xMin: -4,
  xMax: 4,
  yMin: -4,
  yMax: 4,
  xStep: 1,
  yStep: 1,
  xLabel: "x",
  yLabel: "y",
  points: [],
});
const diagram = (model: object) =>
  ({
    id: "test-model",
    alt: "An exact mathematical model.",
    caption: "Quantities retain their specified units.",
    ...model,
  }) as Parameters<typeof validateDiagram>[0];
test("screen plot lines, keys and label halos remain legible in both themes", () => {
  const html = renderToStaticMarkup(
    React.createElement(BookScreenFigure, {
      diagram: diagram({
        ...plot(),
        lines: [{ slope: [1, 1], intercept: [0, 1], label: "L" }],
        points: [{ x: [1, 1], y: [1, 1], label: "A" }],
      }),
    }),
  );
  const line = html.match(
    /<g data-line="L">[\s\S]*?<line[^>]*stroke="([^"]+)"/,
  )?.[1];
  const key = html.match(/<span style="color:([^";]+)/)?.[1];
  const halo = html.match(/paint-order="stroke" stroke="([^"]+)"/)?.[1];
  assert.ok(line && key && halo);
  for (const theme of ["light", "dark"] as const) {
    const { color } = resolveTheme(theme);
    const resolve = (value: string): Rgba => {
      if (value.startsWith("var(")) return color(value.slice(4, -1));
      if (value === "white") return [255, 255, 255, 1];
      assert.match(value, /^#[0-9a-f]{6}$/i);
      return [1, 3, 5]
        .map((at) => parseInt(value.slice(at, at + 2), 16))
        .concat(1) as Rgba;
    };
    const surface = color("--color-surface");
    assert.ok(
      contrast(resolve(line), surface) >= 3,
      `${theme}: plotted line contrast`,
    );
    assert.ok(
      contrast(resolve(key), surface) >= 4.5,
      `${theme}: legend text contrast`,
    );
    assert.deepEqual(
      resolve(halo),
      surface,
      `${theme}: the label halo matches the page`,
    );
  }
});
test("algebra examples validate and share exact mathematical drawing between print and screen", () => {
  for (const d of algebraModels) {
    validateDiagram(d);
    const print = renderToStaticMarkup(
      React.createElement(BookDiagram, { diagram: d }),
    );
    const screen = renderToStaticMarkup(
      React.createElement(BookScreenFigure, { diagram: d }),
    );
    // Normalize only palette values: every geometric and semantic attribute
    // must match print, including unfilled shapes and line patterns.
    const printInks: Record<string, string> = {
      "--color-figure-accent": "#18594f",
      "--color-figure-warm": "#af4c39",
      "--color-figure-gold-fill": "#e8c579",
      "--color-figure-accent-fill": "#e4f0eb",
      "--color-figure-grid": "#ccdcd5",
      "--color-surface": "white",
    };
    const screenOnPaper = screen.replace(
      /var\((--color-[a-z-]+)\)/g,
      (value, role: string) => printInks[role] ?? value,
    );
    assert.equal(
      print.match(/<svg[\s\S]*?<\/svg>/)?.[0],
      screenOnPaper.match(/<svg[\s\S]*?<\/svg>/)?.[0],
    );
    assert.equal(
      print.match(/<table[\s\S]*?<\/table>/)?.[0],
      screen.match(/<table[\s\S]*?<\/table>/)?.[0],
    );
  }
});
test("exact clipping preserves rational intersections and rejects tangency without a visible line", () => {
  const d = plot();
  assert.deepEqual(
    clipPlotLine(d, { slope: [3, 2], intercept: [1, 3], label: "L" }),
    [
      { x: [-26, 9], y: [-4, 1] },
      { x: [22, 9], y: [4, 1] },
    ],
  );
  assert.deepEqual(
    clipPlotLine(d, { slope: [0, 1], intercept: [2, 3], label: "L" }),
    [
      { x: [-4, 1], y: [2, 3] },
      { x: [4, 1], y: [2, 3] },
    ],
  );
  assert.throws(
    () => clipPlotLine(d, { slope: [1, 1], intercept: [8, 1], label: "L" }),
    /cross/,
  );
  for (let m = -6; m <= 6; m++)
    for (let b = -3; b <= 3; b++) {
      const [a, z] = clipPlotLine(d, {
        slope: [m, 3],
        intercept: [b, 2],
        label: "L",
      });
      for (const p of [a, z]) {
        assert.equal(
          BigInt(p.y[0]) * 3n * BigInt(p.x[1]) * 2n,
          BigInt(m) * BigInt(p.x[0]) * BigInt(p.y[1]) * 2n +
            BigInt(b) * BigInt(p.y[1]) * 3n * BigInt(p.x[1]),
        );
        assert.ok(
          Math.abs(p.x[0] / p.x[1]) <= 4 && Math.abs(p.y[0] / p.y[1]) <= 4,
        );
      }
      assert.equal(compareExact(a.x, z.x), -1);
    }
});
test("level physical balances reject negative solutions and inconsistent equality", () => {
  const d = algebraModels.find((model) => model.id === "positive-balance")!;
  assert.equal(d.kind, "balance");
  if (d.kind !== "balance") return;
  for (const update of [
    { left: { bags: 2, units: 11 }, right: { bags: 0, units: 3 } },
    { left: { bags: 2, units: 3 }, right: { bags: 2, units: 4 } },
    { left: { bags: -1, units: 3 } },
    { right: { bags: 0, units: 25 } },
    { unknownLabel: "long" },
  ])
    assert.throws(() => validateDiagram({ ...d, ...update }));
  validateDiagram({
    ...d,
    left: { bags: 0, units: 0 },
    right: { bags: 0, units: 0 },
  });
  validateDiagram({
    ...d,
    left: { bags: 2, units: 3 },
    right: { bags: 0, units: 3 },
  });
});
test("plots reject dense ticks, clipped finite domains, degenerate segments and invalid quantities", () => {
  const d = plot();
  const cases = [
    { xStep: 0 },
    { xStep: 3 },
    { xMin: -10, xMax: 10, xStep: 1 },
    { points: [{ x: [5, 1], y: [0, 1] }] },
    { points: [{ x: [1, 0], y: [0, 1] }] },
    { points: [{ x: [0, 1], y: [0, 1], label: "long" }] },
    {
      lines: [
        {
          slope: [1, 1],
          intercept: [0, 1],
          label: "L",
          domain: [
            [3, 1],
            [2, 1],
          ],
        },
      ],
    },
    {
      lines: [
        {
          slope: [2, 1],
          intercept: [0, 1],
          label: "L",
          domain: [
            [0, 1],
            [4, 1],
          ],
        },
      ],
    },
    {
      segments: [
        { from: { x: [1, 1], y: [1, 1] }, to: { x: [2, 2], y: [3, 3] } },
      ],
    },
  ];
  for (const change of cases)
    assert.throws(() => validateDiagram(diagram({ ...d, ...change })));
});
test("value tables preserve duplicate inputs and distinguish unknown from zero", () => {
  const d = diagram({
    kind: "value-table",
    inputLabel: "Input",
    outputLabel: "Output",
    rows: [
      { input: [2, 1], output: [0, 1] },
      { input: [2, 1], output: [3, 1] },
      { input: [4, 1], output: null },
    ],
  });
  validateDiagram(d);
  const html = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: d }),
  );
  assert.equal((html.match(/<td>2<\/td>/g) ?? []).length, 2);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /unknown value/);
  assert.match(html, /scope="col"/);
});

test("unknown table outputs do not permit unknown inputs", () => {
  assert.throws(
    () =>
      validateDiagram(
        diagram({
          kind: "value-table",
          inputLabel: "Input",
          outputLabel: "Output",
          rows: [{ input: null, output: [1, 1] }],
        }),
      ),
    /rational/,
  );
});

test("coordinate drawing maps known givens to the specified axes without reversing direction", () => {
  const d = algebraModels.find((model) => model.id === "negative-coordinates")!;
  const html = renderToStaticMarkup(
    React.createElement(BookDiagram, { diagram: d }),
  );
  assert.match(html, /data-point="A" cx="79\.375" cy="136\.5"/);
  assert.match(html, /data-point="B" cx="226\.25" cy="42\.75"/);
  assert.match(html, /x1="50" y1="155\.25" x2="255\.625" y2="24"/);
  assert.equal((html.match(/data-point=/g) ?? []).length, 2);
});
