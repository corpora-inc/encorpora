import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";
import {
  layoutScene,
  describeScene,
  type Drawn,
} from "../src/math/scene/index.js";
import { isPorted, legacyScene } from "../src/math/scene/legacy.js";
import { componentDef } from "../src/math/scene/layout.js";
import type { SemanticFigure } from "../src/math/contracts.js";

const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
/** Screen x of a tick value, read from the drawn tick. */
const tickX = (items: Drawn[], prefix: string, v: number) => {
  const t = items.find((d) => d.id === `${prefix}.tick.${v}`);
  assert.ok(t && t.k === "line", `${prefix}.tick.${v}`);
  return t.x1;
};
const figures = (id: string, n = 40) =>
  Array.from(
    { length: n },
    (_, i) => generateProblem(id, `scene-${i}`).public.figure,
  ).filter((f): f is SemanticFigure => !!f && isPorted(f));

test("dot plots: one mark per value, over its tick, stacked in equal steps", () => {
  for (const id of [
    "line-plot-whole",
    "fraction-line-plot",
    "dot-plot-mean",
    "means-in-mads",
    "sample-estimates-plot",
  ])
    for (const f of figures(id)) {
      assert.ok(f.kind === "line-plot" || f.kind === "double-dot-plot", id);
      const scene = legacyScene(f);
      const l = layoutScene(scene);
      const groups =
        f.kind === "line-plot"
          ? [f.values.map((v) => v / f.denominator)]
          : f.groups.map((g) => g.values);
      groups.forEach((values, g) => {
        const marks = l.items.filter(
          (d) =>
            d.data?.mark &&
            d.id.startsWith(`plot.group.${g}.mark.`) &&
            !d.id.endsWith(".cross"),
        );
        assert.equal(marks.length, values.length, id);
        const levels = new Map<number, number[]>();
        for (const m of marks) {
          const v = Number(m.data!.value);
          const x =
            m.k === "circle" ? m.cx : m.k === "line" ? (m.x1 + m.x2) / 2 : NaN;
          near(x, tickX(l.items, `plot.axis.${g}`, v), 1e-6);
          const y =
            m.k === "circle" ? m.cy : m.k === "line" ? (m.y1 + m.y2) / 2 : NaN;
          levels.set(v, [...(levels.get(v) ?? []), y]);
        }
        for (const ys of levels.values()) {
          ys.sort((a, b) => b - a);
          for (let k = 2; k < ys.length; k++)
            near(ys[k - 1]! - ys[k]!, ys[0]! - ys[1]!, 1e-6);
        }
      });
      assert.ok(describeScene(scene).length > 20);
    }
});

test("box plots: whisker ends, box edges and median sit on their values", () => {
  for (const id of [
    "box-plot-read",
    "double-box-compare",
    "compare-distributions-choice",
  ])
    for (const f of figures(id)) {
      assert.ok(f.kind === "box-plot" || f.kind === "double-box-plot", id);
      const l = layoutScene(legacyScene(f));
      const at = (v: number) => {
        // Interpolate along the axis between two drawn ticks.
        const a = tickX(l.items, "box.axis", f.start),
          b = tickX(l.items, "box.axis", f.end);
        return a + ((v - f.start) * (b - a)) / (f.end - f.start);
      };
      const summaries =
        f.kind === "box-plot" ? [f.summary] : f.groups.map((g) => g.summary);
      summaries.forEach(([lo, q1, med, q3, hi], g) => {
        const get = (part: string) =>
          l.items.find((d) => d.id === `box.group.${g}.${part}`)!;
        const box = get("box"),
          median = get("median"),
          ends = [get("end.0"), get("end.1")];
        assert.ok(box.k === "rect" && median.k === "line");
        near(box.x, at(q1));
        near(box.x + box.w, at(q3), 1e-3);
        near(median.x1, at(med));
        ends.forEach((e, k) => {
          assert.ok(e.k === "line");
          near(e.x1, at(k ? hi : lo));
        });
      });
    }
});

test("bar charts and histograms: heights exactly proportional to values", () => {
  for (const id of [
    "scaled-bar-graph",
    "histogram-read",
    "bar-chart-total",
    "bar-chart-difference",
    "comparison-factor",
  ])
    for (const f of figures(id)) {
      assert.ok(
        f.kind === "scaled-bar-graph" ||
          f.kind === "histogram" ||
          f.kind === "bar-chart",
        id,
      );
      const l = layoutScene(legacyScene(f));
      const values =
        f.kind === "histogram"
          ? f.counts
          : f.kind === "bar-chart"
            ? f.values
            : f.categories.map((c) => c.value);
      const zero = l.items.find((d) => d.id === "chart.grid.0");
      assert.ok(zero && zero.k === "line");
      const bars = values.map((_, i) =>
        l.items.find((d) => d.id === `chart.bar.${i}`),
      );
      const unit = bars
        .map((b, i) => (b && b.k === "rect" ? b.h / values[i]! : NaN))
        .filter(Number.isFinite);
      bars.forEach((b, i) => {
        if (!values[i]) return assert.equal(b, undefined);
        assert.ok(b && b.k === "rect");
        near(b.h, values[i]! * unit[0]!, 1e-6);
        near(b.y + b.h, zero.y1, 1e-6);
        if (f.kind === "histogram" && i) {
          const prev = bars[i - 1];
          if (prev && prev.k === "rect") near(b.x, prev.x + prev.w, 1e-6);
        }
      });
    }
});

test("bar charts are read against the scale: no value labels, readable gridlines", () => {
  for (const id of ["bar-chart-total", "bar-chart-difference"])
    for (const f of figures(id)) {
      assert.ok(f.kind === "bar-chart", id);
      const l = layoutScene(legacyScene(f));
      const texts = l.items.filter((d) => d.k === "text").map((d) => d.id);
      // Category names, scale labels and the caption: never a bar's value.
      assert.ok(
        texts.every((t) => /^chart\.(bar\.\d+\.label|label\.y\.|unit)/.test(t)),
        `${id}: ${texts.join(", ")}`,
      );
      // Every value sits on a gridline, and labeled gridlines sit 20 px or
      // more apart, so a 6 or a 7 reads without a value label.
      const lines = l.items.filter(
        (d) => d.k === "line" && /^chart\.grid\.\d+$/.test(d.id),
      );
      for (const v of f.values)
        assert.ok(
          lines.some((d) => d.id === `chart.grid.${v}`),
          `${id} ${v}`,
        );
      const ys = l.items
        .filter((d) => d.k === "text" && d.id.startsWith("chart.label.y."))
        .map((d) => (d.k === "text" ? d.box.y0 : 0))
        .sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++)
        assert.ok(ys[i]! - ys[i - 1]! >= 19.5, `${id}: crowded scale labels`);
    }
});

test("picture graphs draw the count in symbols; shape sorts draw every shape", () => {
  for (const id of ["picture-graph-questions", "scaled-picture-graph"])
    for (const f of figures(id)) {
      assert.ok(f.kind === "picture-graph", id);
      const l = layoutScene(legacyScene(f));
      f.categories.forEach((c, i) => {
        // A half symbol draws as a filled sector and its outline: one symbol.
        const symbols = [
          ...new Map(
            l.items
              .filter(
                (d) =>
                  d.id.startsWith(`graph.row.${i}.symbol.`) && d.data?.symbol,
              )
              .map((d) => [d.id.replace(/\.sector$/, ""), d]),
          ).values(),
        ];
        const drawn = symbols.reduce(
          (a, d) => a + (d.data!.symbol === "half" ? f.key / 2 : f.key),
          0,
        );
        assert.equal(drawn, c.count, id);
      });
    }
  for (const id of ["sort-shapes-count", "sort-shapes-most"])
    for (const f of figures(id)) {
      assert.ok(f.kind === "sort-shapes", id);
      const l = layoutScene(legacyScene(f));
      const shapes = l.items.filter((d) => d.data?.shape);
      assert.deepEqual(
        shapes.map((d) => d.data!.shape),
        f.shapes,
      );
    }
});

test("every data figure keeps its full width: no scale is squeezed to fit", () => {
  for (const id of [
    "means-in-mads",
    "sample-estimates-plot",
    "dot-plot-mean",
    "line-plot-whole",
    "fraction-line-plot",
    "double-box-compare",
    "histogram-read",
    "scaled-picture-graph",
    "scaled-bar-graph",
    "bar-chart-difference",
    "comparison-factor",
    "sort-shapes-count",
  ])
    for (const f of figures(id, 256)) {
      if (!isPorted(f)) continue;
      const scene = legacyScene(f);
      const l = layoutScene(scene);
      const e = scene.elements[0]!;
      const cap = componentDef(e.type)!.maxScale?.(e as never) ?? Infinity;
      // Full width, or the component's own largest scale (a few shapes).
      assert.ok(
        l.width >= 260 || l.scale >= cap - 1e-6,
        `${id}: ${f.kind} is ${l.width.toFixed(0)} px wide at scale ${l.scale}`,
      );
    }
});
