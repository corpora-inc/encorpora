import assert from "node:assert/strict";
import test from "node:test";
import { problemLesson } from "../src/content/problem-lessons.js";
import { dataWalkthrough } from "../src/math/scene/data-walkthroughs.js";
import { fiveNumbers } from "../src/math/scene/components/dot-plot.js";
import { layoutScene, type Drawn } from "../src/math/scene/index.js";
import { frameAt, missingTargets } from "../src/math/scene/timeline.js";
import { componentDef } from "../src/math/scene/layout.js";

const ids = [
  "line-plot-whole",
  "fraction-line-plot",
  "fraction-plot-equal-share",
  "dot-plot-mean",
  "dot-plot-mad",
  "dot-plot-iqr",
  "means-in-mads",
];
const walk = (id: string, seed: string) => {
  const lesson = problemLesson(id, seed);
  return { lesson, scene: dataWalkthrough(id, lesson.example.figure) };
};
const near = (a: number, b: number, eps = 1e-6) =>
  assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const by = (items: Drawn[], prefix: string) =>
  items.filter((d) => d.id === prefix || d.id.startsWith(`${prefix}.`));

test("every data lesson has a walkthrough whose steps name real parts", () => {
  for (const id of ids)
    for (let i = 0; i < 30; i++) {
      const { scene } = walk(id, `walk-${i}`);
      if (!scene) {
        // Only an equal share that does not land on a tick has no walkthrough.
        assert.equal(id, "fraction-plot-equal-share");
        continue;
      }
      assert.ok(scene.steps!.length === 3, id);
      const l = layoutScene(scene, { reveal: true });
      assert.deepEqual(missingTargets(l, scene.steps!), [], id);
      const e = scene.elements[0]!;
      const cap = componentDef(e.type)!.maxScale?.(e as never) ?? Infinity;
      assert.ok(
        l.width >= 260 || l.scale >= cap - 1e-6,
        `${id}: ${l.width} px wide`,
      );
      // The final frame shows every part.
      const end = frameAt(l, scene.steps!, 2, 1);
      for (const d of l.items)
        if (!/^plot\.(ref\.0|group\.0\.mark)/.test(d.id))
          assert.notEqual(end[d.id]?.opacity, 0, `${id}: ${d.id} hidden`);
    }
});

test("the balance point is the exact mean: distances to it cancel", () => {
  for (const id of ["dot-plot-mean", "dot-plot-mad"])
    for (let i = 0; i < 40; i++) {
      const { scene, lesson } = walk(id, `balance-${i}`);
      const plot = scene!.elements[0]! as { references: { at: number }[] };
      const f = lesson.example.figure!;
      assert(f.kind === "line-plot");
      const mean = f.values.reduce((a, b) => a + b, 0) / f.values.length;
      assert.equal(plot.references[1]!.at, mean);
      assert.notEqual(plot.references[0]!.at, mean);
      const l = layoutScene(scene!, { reveal: true });
      const signed = by(l.items, "plot.ref.1.distance").map((d) =>
        d.k === "line" ? d.x2 - d.x1 : 0,
      );
      near(
        signed.reduce((a, b) => a + b, 0),
        0,
        1e-6,
      );
    }
});

test("the box covers exactly Q1 to Q3 of the example's values", () => {
  for (let i = 0; i < 40; i++) {
    const { scene, lesson } = walk("dot-plot-iqr", `box-${i}`);
    const f = lesson.example.figure!;
    assert(f.kind === "line-plot");
    const q = fiveNumbers(f.values);
    const l = layoutScene(scene!, { reveal: true });
    const tick = (v: number) => {
      const t = l.items.find((d) => d.id === `plot.axis.0.tick.${v}`);
      assert.ok(t && t.k === "line");
      return t.x1;
    };
    const x = (v: number) =>
      tick(f.start) +
      ((v - f.start) * (tick(f.end) - tick(f.start))) / (f.end - f.start);
    const box = l.items.find((d) => d.id === "plot.box.box");
    assert.ok(box && box.k === "rect");
    near(box.x, x(q.q1), 1e-3);
    near(box.x + box.w, x(q.q3), 1e-3);
    const [n, d] = lesson.example.answer.split("/").map(Number);
    near(
      q.q3 - q.q1,
      lesson.example.answer.includes(".")
        ? Number(lesson.example.answer)
        : n! / (d ?? 1),
    );
  }
});

test("MAD bricks fill exactly the gap between the means; shares keep the total", () => {
  for (let i = 0; i < 40; i++) {
    const { scene, lesson } = walk("means-in-mads", `gap-${i}`);
    const l = layoutScene(scene!, { reveal: true });
    const bricks = by(l.items, "plot.brick").filter((d) => d.k === "rect");
    const refs = by(l.items, "plot.ref").filter(
      (d) => d.k === "line" && /^plot\.ref\.\d$/.test(d.id),
    );
    const xs = refs
      .map((d) => (d.k === "line" ? d.x1 : 0))
      .sort((a, b) => a - b);
    const width = bricks.reduce((a, d) => a + (d.k === "rect" ? d.w : 0), 0);
    near(width, xs[1]! - xs[0]!, 1e-3);
    const [n, d] = lesson.example.answer.split("/").map(Number);
    const unit = bricks[0]!.k === "rect" ? bricks[0]!.w : NaN;
    near((xs[1]! - xs[0]!) / unit, n! / (d ?? 1), 1e-6);
  }
  for (let i = 0; i < 40; i++) {
    const { scene, lesson } = walk("fraction-plot-equal-share", `share-${i}`);
    if (!scene) continue;
    const f = lesson.example.figure!;
    assert(f.kind === "line-plot");
    const plot = scene.elements[0]! as { share: number };
    near(
      plot.share * f.values.length,
      f.values.reduce((a, b) => a + b, 0) / f.denominator,
    );
  }
});
