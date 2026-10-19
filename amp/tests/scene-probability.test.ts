import assert from "node:assert/strict";
import test from "node:test";
import {
  describeScene,
  layoutScene,
  sceneSchema,
  type Drawn,
} from "../src/math/scene/index.js";
import { table, tree, venn } from "../src/math/scene/author.js";
import { vennAnchor, vennRegion } from "../src/math/scene/components/venn.js";

const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));
const byId = (items: Drawn[], id: string) => {
  const d = items.find((i) => i.id === id);
  assert.ok(d, `missing ${id}`);
  return d;
};
const center = (d: Drawn) => {
  assert.equal(d.k, "text");
  return d.k === "text"
    ? { x: (d.box.x0 + d.box.x1) / 2, y: (d.box.y0 + d.box.y1) / 2 }
    : { x: NaN, y: NaN };
};

test("venn regions are the exact lens and crescents, each holding its own value", () => {
  // Circles of radius 2.35 at x = 3.7 and 6.3, y = 3.05 (venn.ts).
  const inA = ([x, y]: number[]) =>
    Math.hypot(x! - 3.7, y! - 3.05) <= 2.35 + 1e-9;
  const inB = ([x, y]: number[]) =>
    Math.hypot(x! - 6.3, y! - 3.05) <= 2.35 + 1e-9;
  for (const p of vennRegion("ab")) assert.ok(inA(p) && inB(p));
  const strictlyA = vennRegion("a").filter(
    ([x, y]) => Math.hypot(x! - 6.3, y! - 3.05) < 2.35 - 1e-6,
  );
  for (const p of vennRegion("a")) assert.ok(inA(p));
  for (const p of strictlyA)
    assert.ok(Math.hypot(p[0]! - 3.7, p[1]! - 3.05) > 2.35 - 1e-6);
  for (const p of vennRegion("b")) assert.ok(inB(p));
  // Value anchors sit inside their regions only.
  assert.ok(inA(vennAnchor.a) && !inB(vennAnchor.a));
  assert.ok(inA(vennAnchor.ab) && inB(vennAnchor.ab));
  assert.ok(inB(vennAnchor.b) && !inA(vennAnchor.b));
  assert.ok(!inA(vennAnchor.none) && !inB(vennAnchor.none));
});

test("venn unknowns carry no value and stay masked even when revealed", () => {
  const s = venn("Art", "Music", { universe: "40 students" })
    .totals(18, 15)
    .regions({ a: null, ab: 6, b: null })
    .shade("a", "ab", "b")
    .id("v")
    .scene();
  assert.ok(!JSON.stringify(s).includes("12"));
  for (const reveal of [false, true]) {
    const l = layoutScene(s, { reveal });
    const a = byId(l.items, "v.count.a");
    assert.ok(a.k === "text" && a.plain === "?" && a.masked === !reveal);
    const ab = byId(l.items, "v.count.ab");
    assert.ok(ab.k === "text" && ab.plain === "6" && !ab.masked);
    // The left count is left of the overlap, which is left of the right count.
    assert.ok(center(a).x < center(ab).x);
    assert.ok(center(ab).x < center(byId(l.items, "v.count.b")).x);
  }
  const shaded = layoutScene(s).items.filter(
    (d) => d.k === "path" && d.id.startsWith("v.region.") && d.fill !== "none",
  );
  assert.deepEqual(shaded.map((d) => d.id).sort(), [
    "v.region.a",
    "v.region.ab",
    "v.region.b",
  ]);
  assert.match(describeScene(s), /Art: 18 in all/);
  assert.match(describeScene(s), /Art only: unknown; both Art and Music: 6/);
});

test("table highlights band a row or a column under its text and ring a cell", () => {
  const rows = [
    { label: "Grade 9", cells: [18, 12, 30] },
    { label: "Grade 10", cells: [14, 26, 40] },
    { label: "Total", cells: [32, 38, 70] },
  ];
  const s = table({
    columns: ["Online", "In person", "Total"],
    rows,
    sums: true,
    highlight: { rows: [1], cells: [[1, 0]] },
  })
    .id("t")
    .scene();
  const l = layoutScene(s);
  const index = (id: string) => l.items.findIndex((d) => d.id === id);
  const band = byId(l.items, "t.band.row.1"),
    row = byId(l.items, "t.row.1");
  assert.ok(band.k === "rect" && row.k === "rect");
  if (band.k === "rect" && row.k === "rect") {
    assert.equal(band.y, row.y);
    assert.equal(band.h, row.h);
  }
  // The band is drawn over the row's paper and under its text.
  assert.ok(index("t.row.1") < index("t.band.row.1"));
  assert.ok(index("t.band.row.1") < index("t.cell.1.0"));
  const ring = byId(l.items, "t.mark.1.0"),
    cell = center(byId(l.items, "t.cell.1.0"));
  assert.ok(ring.k === "rect");
  if (ring.k === "rect")
    assert.ok(
      ring.x < cell.x &&
        ring.x + ring.w > cell.x &&
        ring.y < cell.y &&
        ring.y + ring.h > cell.y,
    );
  const column = layoutScene(
    table({
      columns: ["A", "B"],
      rows: rows.slice(0, 2).map((r) => ({ ...r, cells: r.cells.slice(0, 2) })),
      highlight: { columns: [1] },
    })
      .id("t")
      .scene(),
  );
  assert.equal(
    column.items.filter((d) => d.id.startsWith("t.band.column.1.")).length,
    2,
    "one band piece per body row",
  );
  assert.equal(
    sceneSchema.safeParse({
      v: 1,
      elements: [
        {
          type: "table",
          columns: ["A"],
          rows: [{ label: "x", cells: [1] }],
          highlight: { rows: [3] },
        },
      ],
    }).success,
    false,
  );
});

test("a tree centers each node on its outcomes and masks unknown branches", () => {
  const s = tree([
    {
      label: "Rain",
      p: "3/10",
      children: [
        { label: "Late", p: "2/5", leaf: null },
        { label: "On time", p: null },
      ],
    },
    {
      label: "Dry",
      p: "7/10",
      children: [
        { label: "Late", p: "1/10" },
        { label: "On time", p: "9/10" },
      ],
    },
  ])
    .id("tr")
    .scene();
  const l = layoutScene(s);
  const y = (id: string) => center(byId(l.items, id)).y;
  assert.ok(
    Math.abs(y("tr.node1.0") - (y("tr.node2.0.0") + y("tr.node2.0.1")) / 2) < 1,
  );
  assert.ok(
    Math.abs(y("tr.node1.1") - (y("tr.node2.1.0") + y("tr.node2.1.1")) / 2) < 1,
  );
  const gapIn = y("tr.node2.0.1") - y("tr.node2.0.0"),
    gapAcross = y("tr.node2.1.0") - y("tr.node2.0.1");
  assert.ok(gapAcross > gapIn, "groups are set apart");
  const p = byId(l.items, "tr.p2.0.1");
  assert.ok(p.k === "text" && p.masked && p.plain === "?");
  const leaf = byId(l.items, "tr.leaf.0.0");
  assert.ok(leaf.k === "text" && leaf.masked);
  // Branches run from the parent's label to the child's.
  const b = byId(l.items, "tr.b2.0.0");
  assert.ok(b.k === "line" && b.x2 > b.x1);
  const tooMany = tree(
    Array.from({ length: 4 }, (_, i) => ({
      label: `${i}`,
      p: "1/4",
      children: [
        { label: "x", p: "1/3" },
        { label: "y", p: "1/3" },
        { label: "z", p: "1/3" },
      ],
    })),
  ).element();
  assert.equal(
    sceneSchema.safeParse({ v: 1, elements: [tooMany] }).success,
    false,
  );
  assert.match(describeScene(s), /On time with probability unknown/);
});
