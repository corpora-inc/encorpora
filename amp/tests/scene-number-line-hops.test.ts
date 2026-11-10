import assert from "node:assert/strict";
import test from "node:test";
import { layoutScene, type Scene } from "../src/math/scene/index.js";
import { numberLine } from "../src/math/scene/author.js";
import { generateProblem } from "../src/math/engine.js";

const labelBoxes = (scene: Scene) =>
  layoutScene(scene, { reveal: false }).items.flatMap((d) =>
    d.k === "text" && /\.(hop\.\d+\.label|mark\.\d+\.label)$/.test(d.id)
      ? [{ id: d.id, ...d.box }]
      : [],
  );

function assertClear(scene: Scene, what: string) {
  const boxes = labelBoxes(scene);
  assert.ok(boxes.length >= 3, `${what}: start and both jump labels drawn`);
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!,
        b = boxes[j]!;
      assert.ok(
        a.x1 <= b.x0 || b.x1 <= a.x0 || a.y1 <= b.y0 || b.y1 <= a.y0,
        `${what}: ${a.id} and ${b.id} overlap`,
      );
    }
}

test("two jumps from one start never overprint each other's labels", () => {
  for (const [from, a, b] of [
    [57, -25, 27],
    [37, -17, 12],
    [63, -4, 12],
    [44, 22, -5],
    [57, 26, -27],
  ] as const)
    assertClear(
      numberLine({ min: 20, max: 90, step: 5, labels: "auto" })
        .mark(from, { label: true })
        .hop(from, a, { landing: "none" })
        .then(b, { landing: "none" })
        .scene(),
      `${from} ${a} ${b}`,
    );
});

test("number-line-jump-story: labels are clear on every sampled seed", () => {
  for (let i = 0; i < 60; i++) {
    const p = generateProblem("number-line-jump-story", `jumps-${i}`).public;
    assert.equal(p.figure?.kind, "scene");
    if (p.figure?.kind === "scene") assertClear(p.figure.scene, `seed ${i}`);
  }
});

test("overlapping jumps are drawn at different heights", () => {
  const scene = numberLine({ min: 20, max: 90, step: 5 })
    .hop(57, -26, { landing: "none" })
    .then(27, { landing: "none" })
    .scene();
  const apex = layoutScene(scene, { reveal: false })
    .items.filter((d) => d.k === "path" && /\.hop\.\d$/.test(d.id))
    .map((d) => Number(/Q\S+ (\S+)/.exec((d as { d: string }).d)![1]));
  assert.equal(apex.length, 2);
  assert.ok(Math.abs(apex[0]! - apex[1]!) >= 40, `control heights ${apex}`);
});
