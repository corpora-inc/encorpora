import assert from "node:assert/strict";
import test from "node:test";
import { generateProblem } from "../src/math/engine.js";
import {
  layoutScene,
  describeScene,
  type Drawn,
} from "../src/math/scene/index.js";
import { isPorted, legacyScene } from "../src/math/scene/legacy.js";
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
