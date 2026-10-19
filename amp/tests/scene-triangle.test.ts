import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScene,
  layoutScene,
  sceneSchema,
  type Drawn,
} from "../src/math/scene/index.js";
import { triangle } from "../src/math/scene/author.js";
import { interiorAngle } from "../src/math/scene/components/triangle.js";
import { typeset } from "../src/math/scene/type.js";

const byId = (items: Drawn[], id: string) => {
  const d = items.find((i) => i.id === id);
  assert.ok(d, `missing ${id}`);
  return d;
};
const center = (d: Drawn) =>
  d.k === "text"
    ? { x: (d.box.x0 + d.box.x1) / 2, y: (d.box.y0 + d.box.y1) / 2 }
    : { x: NaN, y: NaN };

const right = () =>
  triangle([
    [0, 0],
    [4, 0],
    [4, 3],
  ])
    .names("A", "C", "B")
    .side(0, { label: 4, ticks: 2 })
    .side(1, { label: 3 })
    .side(2, { label: null })
    .angle(0, { mark: "arc", label: "θ" })
    .angle(1, { mark: "right" })
    .id("t");

test("side labels sit outside the triangle and the unknown is masked", () => {
  const l = layoutScene(right().scene());
  const sides = [0, 1, 2].map((i) => byId(l.items, `t.side.${i}`));
  const ends = sides.map((d) => (d.k === "line" ? d : null)!);
  const cx = ends.reduce((s, e) => s + e.x1, 0) / 3,
    cy = ends.reduce((s, e) => s + e.y1, 0) / 3;
  for (const [i, e] of ends.entries()) {
    const label = center(byId(l.items, `t.side.${i}.label`));
    const mid = { x: (e.x1 + e.x2) / 2, y: (e.y1 + e.y2) / 2 };
    // Farther from the centroid than the side's own midpoint.
    assert.ok(
      Math.hypot(label.x - cx, label.y - cy) >
        Math.hypot(mid.x - cx, mid.y - cy),
      `side ${i}`,
    );
  }
  const unknown = byId(l.items, "t.side.2.label");
  assert.ok(unknown.k === "text" && unknown.masked && unknown.plain === "?");
  assert.equal(
    l.items.filter((d) => d.id.startsWith("t.side.0.tick.")).length,
    2,
  );
  assert.match(describeScene(right().scene()), /Side BA: unknown/);
  assert.match(describeScene(right().scene()), /A right angle at C/);
});

test("angle marks sweep the interior and a right angle is a square", () => {
  const pts: [number, number][] = [
    [0, 0],
    [4, 0],
    [4, 3],
  ];
  assert.ok(Math.abs(interiorAngle(pts, 1) - 90) < 1e-9);
  assert.ok(
    Math.abs(interiorAngle(pts, 0) + interiorAngle(pts, 2) - 90) < 1e-9,
  );
  const l = layoutScene(right().scene());
  const arc = byId(l.items, "t.angle.0.arc.0");
  assert.equal(arc.k, "path");
  const box = byId(l.items, "t.angle.1");
  assert.equal(box.k, "path");
  // The angle label sits between the two sides at A, inside the triangle.
  const a = center(byId(l.items, "t.angle.0.label"));
  const vertex = center(byId(l.items, "t.vertex.0"));
  assert.ok(a.x > vertex.x && a.y < vertex.y + 1);
});

test("a narrow angle on a small drawing labels from outside the vertex", () => {
  const s = triangle([
    [0, 0],
    [5.5, 0],
    [0, 2],
  ])
    .angle(1, { mark: "arc", label: "20°" })
    .id("t")
    .scene({ width: 160 });
  const l = layoutScene(s);
  const label = center(byId(l.items, "t.angle.1.label"));
  const side = byId(l.items, "t.side.0");
  assert.ok(side.k === "line");
  if (side.k === "line") assert.ok(label.x > Math.max(side.x1, side.x2));
});

test("the schema rejects three points on one line", () => {
  assert.equal(
    sceneSchema.safeParse({
      v: 1,
      elements: [
        {
          type: "triangle",
          points: [
            [0, 0],
            [1, 1],
            [2, 2],
          ],
        },
      ],
    }).success,
    false,
  );
});

test("a prime is set as a superscript, as TeX sets it", () => {
  const t = typeset("A′", "math", "md");
  assert.ok(t.runs[1]!.dy < 0 && t.runs[1]!.size < t.runs[0]!.size);
});
