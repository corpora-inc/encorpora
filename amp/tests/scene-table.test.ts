import { test } from "node:test";
import assert from "node:assert/strict";
import { describeScene, layoutScene, sceneSchema } from "../src/math/scene";
import { table } from "../src/math/scene/author";
import type { Drawn } from "../src/math/scene";

const rects = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "rect" ? [d] : []));
const texts = (items: Drawn[]) =>
  items.flatMap((d) => (d.k === "text" ? [d] : []));

test("a value table has equal rows, aligned columns and centred cells", () => {
  const l = layoutScene(
    table([
      ["x", "−2", "0", "2", "4"],
      ["f(x)", "7", "3", { text: "−1", derived: true }, "−5"],
    ]).scene(),
  );
  const cells = rects(l.items);
  assert.equal(cells.length, 10);
  const heights = new Set(cells.map((c) => Math.round(c.h * 100)));
  assert.equal(heights.size, 1, "one row height");
  // Cells in one column share x and width.
  for (let c = 0; c < 5; c++) {
    const col = cells.filter((d) => String(d.data?.cell).endsWith(`,${c}`));
    assert.equal(new Set(col.map((d) => Math.round(d.x))).size, 1);
    assert.equal(new Set(col.map((d) => Math.round(d.w))).size, 1);
  }
  // Every label sits inside its own cell.
  for (const t of texts(l.items)) {
    const cell = cells.find((d) => d.data?.cell === t.data?.cell)!;
    assert.ok(t.box.x0 >= cell.x - 0.5 && t.box.x1 <= cell.x + cell.w + 0.5);
    assert.ok(t.box.y0 >= cell.y - 0.5 && t.box.y1 <= cell.y + cell.h + 0.5);
  }
  // The heading column is shaded and bold, and the unknown is masked.
  assert.equal(cells.find((d) => d.data?.cell === "1,0")!.fill, "empty");
  assert.deepEqual(
    texts(l.items)
      .filter((t) => t.masked)
      .map((t) => t.plain),
    ["?"],
  );
});

test("headings, highlights, step rules and a sum line", () => {
  const l = layoutScene(
    table(
      [
        ["Hours", "1", "2", "3"],
        ["Miles", "4", "8", "12"],
      ],
      {
        highlight: [1, 3],
      },
    ).scene(),
  );
  const fill = (cell: string) =>
    rects(l.items).find((d) => d.data?.cell === cell)!.fill;
  assert.equal(fill("1,1"), "gold-fill");
  assert.equal(fill("1,2"), "paper");
  assert.equal(fill("0,0"), "empty");
  const words = texts(l.items).find((t) => t.plain === "Hours")!;
  assert.equal(words.t.runs[0]!.font, "sansBold");

  const steps = table(
    [
      ["", "2x", "+ 3y", "=", "12"],
      ["+", "x", "− 3y", "=", "3"],
      [
        "",
        { text: "3x", derived: true },
        "",
        "=",
        { text: "15", derived: true },
      ],
    ],
    { header: "none", rules: "rows", total: 2 },
  ).scene();
  const s = layoutScene(steps);
  assert.equal(rects(s.items).length, 0, "rows ruling draws no boxes");
  assert.ok(s.items.some((d) => d.id.endsWith(".total") && d.k === "line"));
  assert.equal(texts(s.items).filter((t) => t.masked).length, 2);
  assert.equal(
    texts(layoutScene(steps, { reveal: true }).items).filter((t) => t.masked)
      .length,
    0,
  );
});

test("tables validate, reject ragged rows and describe every value", () => {
  assert.equal(
    sceneSchema.safeParse({
      v: 1,
      elements: [{ type: "table", rows: [["x", "1"], ["y"]] }],
    }).success,
    false,
  );
  const scene = table([
    ["x", "1", "2"],
    ["y", "5", { text: "9", derived: true }],
  ]).scene();
  assert.equal(
    describeScene(scene),
    "A table. x: 1, 2; y: 5, a value to find.",
  );
  assert.equal(describeScene(scene, true), "A table. x: 1, 2; y: 5, 9.");
});

test("long words wrap onto two lines in a taller row; equations never wrap", () => {
  const l = layoutScene(
    table(
      [
        ["3(x − 4) = 18", "Given"],
        ["3x − 12 = 18", "Multiplication property of equality"],
      ],
      { header: "none", rules: "rows", align: ["left", "left"] },
    ).scene(),
  );
  const lines = texts(l.items).filter((t) => t.data?.cell === "1,1");
  assert.equal(lines.length, 2);
  const mid = (t: (typeof lines)[number]) => (t.box.y0 + t.box.y1) / 2;
  assert.ok(mid(lines[1]!) - mid(lines[0]!) >= 18, "one line below the other");
  assert.equal(texts(l.items).filter((t) => t.data?.cell === "1,0").length, 1);
  assert.ok(l.width < 360, `width ${l.width}`);
});
