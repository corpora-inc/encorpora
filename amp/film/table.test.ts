import { describe, expect, it } from "vitest";
import {
  bandOpacity, CONTEXT, DIM, fits, guideLine, inRegion, isStraight, mosaicAnchor, overallShare, partBox, restBox, restriction,
  slabBox, tableAnchor, tableBox, tableCell, tableRegion, type MosaicSpec, type TableSpec,
} from "./table";

const near = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));
const lin = (u: number) => Math.min(1, Math.max(0, u));

// Sport (rows) by band (columns), with totals: 3 body columns, 3 body rows.
const T: TableSpec = { at: [0, 20], cols: 3, rows: 3, cell: [3.6, 1.6], labelW: 5 };

describe("table cells", () => {
  it("puts the header row on top and the label column at the left", () => {
    const box = (b: { x: number; y: number; w: number; h: number }) => [b.x, b.y, b.w, b.h];
    near(box(tableCell(T, 0, 0)), [0, 18.4, 5, 1.6]);
    near(box(tableCell(T, 0, 1)), [5, 18.4, 3.6, 1.6]);
    near(box(tableCell(T, 1, 0)), [0, 16.8, 5, 1.6]);
  });
  it("covers the table exactly: the last cell ends at the box's corner", () => {
    const b = tableBox(T), last = tableCell(T, 3, 3);
    near([b.x, b.y, b.w, b.h], [0, 20 - 4 * 1.6, 5 + 3 * 3.6, 4 * 1.6]);
    expect(last.x + last.w).toBeCloseTo(b.x + b.w, 9);
    expect(last.y).toBeCloseTo(b.y, 9);
  });
  it("refuses a cell outside the table", () => {
    expect(() => tableCell(T, 4, 0)).toThrow(/no cell/);
    expect(() => tableCell(T, 0, 4)).toThrow(/no cell/);
  });
});

describe("table regions", () => {
  it("a row runs from its label to its last cell", () => {
    const r = tableRegion(T, "row.1");
    near([r.x, r.y, r.w, r.h], [0, 16.8, 5 + 3 * 3.6, 1.6]);
  });
  it("a column runs from its header to its last cell", () => {
    const c = tableRegion(T, "col.1");
    near([c.x, c.y, c.w, c.h], [5, 20 - 4 * 1.6, 3.6, 4 * 1.6]);
  });
  it("knows which cells a row or a column holds", () => {
    expect(inRegion("row.1", 1, 3)).toBe(true);
    expect(inRegion("row.1", 2, 1)).toBe(false);
    expect(inRegion("col.2", 0, 2)).toBe(true);
    expect(inRegion("col.2", 3, 1)).toBe(false);
  });
});

describe("table anchors", () => {
  it("names cell middles and edge middles", () => {
    near(tableAnchor(T, "cell:1,1"), [5 + 1.8, 16.8 + 0.8]);
    near(tableAnchor(T, "right:1"), [5 + 3 * 3.6, 16.8 + 0.8]);
    near(tableAnchor(T, "left:2"), [0, 15.2 + 0.8]);
    near(tableAnchor(T, "bottom:1"), [5 + 1.8, 20 - 4 * 1.6]);
    near(tableAnchor(T, "top:3"), [5 + 2 * 3.6 + 1.8, 20]);
    expect(() => tableAnchor(T, "middle")).toThrow(/no anchor/);
  });
});

// Twenty students: 12 play a sport (3 in band), 8 do not (2 in band). Independent: 1/4 everywhere.
const M: MosaicSpec = { at: [0, 8], w: 8, h: 8, slice: "rows", groups: [{ n: 12, k: 3 }, { n: 8, k: 2 }] };

describe("mosaic slabs", () => {
  it("slices rows from the top in proportion to the groups", () => {
    const a = slabBox(M, 1), b = slabBox(M, 2);
    near([a.x, a.y, a.w, a.h], [0, 8 - 4.8, 8, 4.8]);
    near([b.x, b.y, b.w, b.h], [0, 0, 8, 3.2]);
  });
  it("colors each slab from the left by its own share", () => {
    const p = partBox(M, 1), r = restBox(M, 1);
    expect(p.w).toBeCloseTo(2, 9);
    expect(r.x).toBeCloseTo(2, 9);
    expect(r.w).toBeCloseTo(6, 9);
    expect(partBox(M, 2).w).toBeCloseTo(2, 9);
  });
  it("slices columns from the left and colors from the top", () => {
    // The problem's table: B (8) and Not B (16) slice; A colors 1 of 8 and 5 of 16.
    const C: MosaicSpec = { at: [0, 8], w: 8, h: 8, slice: "cols", groups: [{ n: 8, k: 1 }, { n: 16, k: 5 }] };
    const s1 = slabBox(C, 1), s2 = slabBox(C, 2), p1 = partBox(C, 1);
    near([s1.x, s1.w], [0, 8 / 3]);
    near([s2.x, s2.w], [8 / 3, 16 / 3]);
    expect(p1.y + p1.h).toBeCloseTo(8, 9);
    expect(p1.h).toBeCloseTo(1, 9);
    expect(restBox(C, 1).h).toBeCloseTo(7, 9);
  });
  it("refuses a slab that does not exist", () => {
    expect(() => slabBox(M, 3)).toThrow(/no slab/);
  });
});

describe("the straight edge", () => {
  it("everyone's share is all the k over all the n, and the guide sits there", () => {
    expect(overallShare(M)).toBeCloseTo(0.25, 9);
    const [a, b] = guideLine(M);
    near(a, [2, 8]);
    near(b, [2, 0]);
  });
  it("independent groups make one straight line through every slab's edge", () => {
    expect(isStraight(M)).toBe(true);
    const gx = guideLine(M)[0][0];
    expect(mosaicAnchor(M, "edge:1")[0]).toBeCloseTo(gx, 9);
    expect(mosaicAnchor(M, "edge:2")[0]).toBeCloseTo(gx, 9);
  });
  it("a group with a different share breaks the line", () => {
    const N: MosaicSpec = { ...M, groups: [{ n: 12, k: 4 }, { n: 8, k: 1 }] };
    expect(isStraight(N)).toBe(false);
    expect(mosaicAnchor(N, "edge:1")[0]).toBeGreaterThan(guideLine(N)[0][0]);
    expect(mosaicAnchor(N, "edge:2")[0]).toBeLessThan(guideLine(N)[0][0]);
  });
  it("four groups: only the group at everyone's rate has its edge on the guide", () => {
    const F: MosaicSpec = { at: [0, 8], w: 10, h: 8, slice: "rows", groups: [{ n: 10, k: 7 }, { n: 25, k: 16 }, { n: 20, k: 12 }, { n: 25, k: 13 }] };
    expect(overallShare(F)).toBeCloseTo(0.6, 9);
    const gx = guideLine(F)[0][0];
    const on = [1, 2, 3, 4].filter((i) => Math.abs(mosaicAnchor(F, "edge:" + i)[0] - gx) < 1e-9);
    expect(on).toEqual([3]);
  });
});

describe("mosaic anchors", () => {
  it("names slab, part and edge middles", () => {
    near(mosaicAnchor(M, "slab:1"), [4, 8 - 2.4]);
    near(mosaicAnchor(M, "part:1"), [1, 8 - 2.4]);
    near(mosaicAnchor(M, "rest:2"), [5, 1.6]);
    near(mosaicAnchor(M, "left:1"), [0, 8 - 2.4]);
    near(mosaicAnchor(M, "top:1"), [4, 8]);
    near(mosaicAnchor(M, "guide:end"), [2, 0]);
    expect(() => mosaicAnchor(M, "corner:1")).toThrow(/no anchor/);
  });
});

describe("given", () => {
  const level = (target: string) => (target === "row.1" ? 1 : DIM);
  const header = (target: string) => (target.startsWith("row.") ? CONTEXT : 1);
  it("dims what is outside the given group and brings it back on release", () => {
    const g = [{ t0: 2, dur: 1, target: "row.1" }, { t0: 6, dur: 1, target: null }];
    const outside = (t: number) => restriction(g, t, () => DIM, lin);
    const inside = (t: number) => restriction(g, t, level, lin);
    expect(outside(1)).toBe(1);
    expect(outside(2.5)).toBeCloseTo((1 + DIM) / 2, 9);
    expect(outside(4)).toBeCloseTo(DIM, 9);
    expect(inside(4)).toBe(1);
    expect(outside(6.5)).toBeCloseTo((1 + DIM) / 2, 9);
    expect(outside(8)).toBe(1);
  });
  it("a header stays legible as context", () => {
    const g = [{ t0: 0, dur: 0.5, target: "row.2" }];
    expect(restriction(g, 3, header, lin)).toBeCloseTo(CONTEXT, 9);
  });
  it("hands over from one group to the next without a flash", () => {
    const g = [{ t0: 0, dur: 1, target: "row.1" }, { t0: 5, dur: 1, target: "row.2" }];
    const row1 = (target: string) => (target === "row.1" ? 1 : DIM);
    expect(restriction(g, 5.5, row1, lin)).toBeCloseTo((1 + DIM) / 2, 9);
    expect(bandOpacity(g, 5.5, "row.1", lin)).toBeCloseTo(0.5, 9);
    expect(bandOpacity(g, 5.5, "row.2", lin)).toBeCloseTo(0.5, 9);
    expect(bandOpacity(g, 7, "row.2", lin)).toBe(1);
    expect(bandOpacity(g, 7, "row.1", lin)).toBe(0);
  });
});

describe("fits", () => {
  it("a label fits when it sits inside the cell with padding", () => {
    expect(fits(100, 40, 180, 70)).toBe(true);
    expect(fits(170, 40, 180, 70)).toBe(false);
    expect(fits(100, 66, 180, 70)).toBe(false);
    expect(fits(100, 60, 180, 70)).toBe(true);
  });
});
