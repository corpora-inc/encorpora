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

/** Points along every hop's bow and the corners of its head, as drawn. */
function hopInk(scene: Scene) {
  const points: [number, number][] = [];
  for (const d of layoutScene(scene, { reveal: false }).items) {
    if (d.k !== "path" || !/\.hop\.\d+(\.head)?$/.test(d.id ?? "")) continue;
    const n = (d as { d: string }).d.match(/-?\d+(\.\d+)?/g)!.map(Number);
    if (d.id!.endsWith(".head"))
      for (let i = 0; i + 1 < n.length; i += 2) points.push([n[i]!, n[i + 1]!]);
    else if (n.length === 6)
      for (let k = 0; k <= 32; k++) {
        const t = k / 32;
        const at = (a: number, c: number, b: number) =>
          (1 - t) ** 2 * a + 2 * t * (1 - t) * c + t * t * b;
        points.push([at(n[0]!, n[2]!, n[4]!), at(n[1]!, n[3]!, n[5]!)]);
      }
  }
  return points;
}

test("the start label keeps clear of every hop's bow and arrowhead", () => {
  for (const seeds of ["scene", "jumps"])
    for (let i = 0; i < 60; i++) {
      const p = generateProblem(
        "number-line-jump-story",
        `${seeds}-${i}`,
      ).public;
      if (p.figure?.kind !== "scene") continue;
      const scene = p.figure.scene;
      const start = labelBoxes(scene).find((b) =>
        /mark\.\d+\.label$/.test(b.id),
      )!;
      for (const [x, y] of hopInk(scene))
        assert.ok(
          // Inside the label's em box is ink on ink (digits have no
          // descenders, so its foot is already air).
          x < start.x0 || x > start.x1 || y < start.y0 || y > start.y1,
          `${seeds}-${i}: start label ${JSON.stringify(start)} touches a hop at ${x},${y}`,
        );
    }
});
