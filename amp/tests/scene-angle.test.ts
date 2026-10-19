import { test } from "node:test";
import assert from "node:assert/strict";
import { angle, protractor } from "../src/math/scene/author";
import { describeScene, layoutScene } from "../src/math/scene";

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
  // The outer number at a direction is 180 minus the inner number there.
  for (const t of outer) assert.equal(Number(t.data!.value) % 20, 0);
  assert.match(describeScene(scene, false), /Ray BA lies on 0 at the left/);
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
