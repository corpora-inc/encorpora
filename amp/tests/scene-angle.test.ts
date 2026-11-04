import { test } from "node:test";
import assert from "node:assert/strict";
import { angle, protractor } from "../src/math/scene/author";
import { describeScene, layoutScene, type Drawn } from "../src/math/scene";

function labelHits(items: Drawn[]) {
  const labels = items.flatMap((d) => (d.k === "text" ? [d] : []));
  const box = (d: (typeof labels)[number]) => ({
    x0: d.x - 1,
    y0: d.y - d.t.ascent * 0.82,
    x1: d.x + d.t.width + 1,
    y1: d.y + d.t.descent * 0.6,
  });
  const hits: string[] = [];
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = box(labels[i]!),
        b = box(labels[j]!);
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)
        hits.push(`${labels[i]!.id}/${labels[j]!.id}`);
    }
  return hits;
}

const texts = (scene: ReturnType<typeof layoutScene>) =>
  scene.items.flatMap((d) => (d.k === "text" ? [d] : []));

test("a protractor draws both scales, every degree tick and its rays", () => {
  const scene = protractor([180, 130], ["A", "B", "C"]).scene();
  const l = layoutScene(scene);
  const ticks = l.items.filter((d) => /\.tick\.\d+$/.test(d.id));
  assert.equal(ticks.length, 181);
  const outer = texts(l).filter((t) => t.data?.scale === "outer");
  const inner = texts(l).filter((t) => t.data?.scale === "inner");
  assert.deepEqual(
    outer.map((t) => t.plain).sort((a, b) => +a - +b),
    inner.map((t) => t.plain).sort((a, b) => +a - +b),
  );
  // A full-size protractor keeps every 20° number on both scales.
  assert.equal(outer.length, 10);
  assert.equal(inner.length, 10);
  for (const t of outer) assert.equal(Number(t.data!.value) % 20, 0);
  assert.match(describeScene(scene, false), /Ray BA lies on 0 at the left/);
});

test("a phone-width protractor thins its scales instead of colliding", () => {
  const l = layoutScene(
    protractor([0, 155], ["A", "B", "C"]).scene({
      width: 288,
      maxHeight: 280,
    }),
  );
  const labels = texts(l).filter((t) => t.data?.scale);
  const values = [...new Set(labels.map((t) => Number(t.data!.value)))].sort(
    (a, b) => a - b,
  );
  // 150 stays, so the 155° ray is one medium tick past a labeled mark.
  assert.deepEqual(values, [0, 30, 60, 90, 120, 150, 180]);
  assert.equal(l.items.filter((d) => /\.tick\.\d+$/.test(d.id)).length, 181);
  assert.deepEqual(labelHits(l.items), []);
  // The tool fills the phone width; labels did not shrink it away.
  assert.ok(l.scale >= 120, `scale ${l.scale}`);
});

test("an angle mark's measure comes from its rays and is masked when derived", () => {
  const scene = angle({
    rays: [20, 65, 140],
    labels: { vertex: "B", ends: ["A", "C", "D"] },
    marks: [
      { from: 0, to: 1, measure: true },
      { from: 1, to: 2, measure: true, derived: true },
    ],
  }).scene();
  const hidden = texts(layoutScene(scene)).map((t) => t.plain);
  assert.ok(hidden.includes("45°"));
  assert.ok(hidden.includes("?"));
  assert.ok(!hidden.includes("75°"));
  const shown = texts(layoutScene(scene, { reveal: true })).map((t) => t.plain);
  assert.ok(shown.includes("75°"));
  assert.ok(!JSON.stringify(scene).includes("75°"), "no answer in the payload");
  assert.match(
    describeScene(scene, false),
    /angle CBD is the measure to find/i,
  );
});

test("a right angle gets a square mark, not an arc", () => {
  const l = layoutScene(
    angle({
      rays: [30, 120],
      arrows: true,
      marks: [{ from: 0, to: 1 }],
    }).scene(),
  );
  const mark = l.items.find((d) => d.id.endsWith(".mark.0"))!;
  assert.equal(mark.data?.mark, "right");
});

test("a clockwise mark measures the turn the other way", () => {
  const l = layoutScene(
    angle({
      rays: [180, 130],
      marksOnly: true,
      marks: [{ from: 0, to: 1, measure: true, clockwise: true }],
    }).scene(),
    { reveal: true },
  );
  assert.ok(texts(l).some((t) => t.plain === "50°"));
  assert.ok(!l.items.some((d) => /\.ray\./.test(d.id)));
});
