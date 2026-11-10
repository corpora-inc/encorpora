import { describe, expect, it } from "vitest";
import { amountAt, barAnchor, barCells, checkBar, cutsAt, planBar, shareBox, shadedAt, spreadBarLabels, type BarSpec } from "./bar";
import { partSchema, actionSchema } from "./schema";

const s: BarSpec = { at: [3, 8], w: 14, h: 2, whole: 50 };
describe("one whole, two scales", () => {
  it("conserves fifty books in ten equal cells of five, including the unshaded cells", () => {
    const cells = barCells(s, 10);
    expect(cells).toHaveLength(10);
    expect(cells.map(c => c.amount)).toEqual(Array(10).fill(5));
    expect(cells.reduce((sum, c) => sum + c.box.w, 0)).toBeCloseTo(s.w);
    expect(cells[0]!.center).toEqual([3.7, 7]);
    expect(cells[9]!.center[0]).toBeCloseTo(16.3);
    expect(barCells({ ...s, whole: undefined }, 4)[0]!.amount).toBeUndefined();
  });
  it("draws 20% of fifty as ten, at exactly one fifth of the length", () => {
    expect(shareBox(s, 0, 0.2)).toEqual({ x: 3, y: 6, w: 2.8000000000000003, h: 2 });
    expect(amountAt(s, 0.2)).toBe(10);
    expect(barAnchor(s, "share:0.2")[0]).toBeCloseTo(5.8);
    expect(barAnchor(s, "amount:0.2")[0]).toBeCloseTo(5.8);
  });
  it("reuses the length for fractions, unknown wholes, and offset story parts", () => {
    expect(amountAt({ ...s, whole: undefined }, 0.25)).toBeUndefined();
    const b = shareBox({ ...s, whole: 24 }, 0.25, 0.75);
    expect(b.x).toBe(6.5); expect(b.w).toBe(7);
    expect(amountAt({ ...s, whole: 24 }, 1 / 3)).toBe(8);
  });
  it("handles empty and complete shades without exceeding the whole", () => {
    expect(shareBox(s, 0, 0).w).toBe(0);
    expect(shareBox(s, 0, 1).w).toBe(s.w);
    expect(() => shareBox(s, 0, 1.01)).toThrow(/share/);
    expect(() => shareBox(s, 0.8, 0.2)).toThrow(/precedes/);
    expect(() => barAnchor(s, "share:2")).toThrow(/share/);
    expect(() => checkBar({ ...s, whole: 0 })).toThrow(/whole/);
  });
});
describe("spoken-word cuts and shading", () => {
  const cuts = [{ t0: 1, dur: 2, into: 10 }, { t0: 5, dur: 2, into: 100 }];
  const shades = [{ t0: 8, dur: 2, from: 0, to: 0.2 }, { t0: 12, dur: 2, from: 0, to: 0.1 }];
  it("cuts in front of the learner, retaining the old tenths during refinement", () => {
    expect(cutsAt(1, cuts, 0).cuts).toHaveLength(0);
    expect(cutsAt(1, cuts, 2).cuts.every(c => c.progress === 0.5)).toBe(true);
    expect(cutsAt(1, cuts, 4).cuts).toHaveLength(9);
    const refining = cutsAt(1, cuts, 6).cuts;
    expect(refining).toHaveLength(99);
    expect(refining.find(c => c.share === 0.1)?.progress).toBe(1);
    expect(refining.find(c => c.share === 0.01)?.progress).toBe(0.5);
  });
  it("preserves amount and bar geometry when cutting", () => {
    const a = planBar(s, cuts, shades, 0), b = planBar(s, cuts, shades, 7);
    expect(a.whole).toEqual(b.whole);
    expect(amountAt(s, 1)).toBe(50);
  });
  it("shades then shrinks on the same fixed scale", () => {
    expect(shadedAt(shades, 7)).toEqual([0, 0]);
    expect(shadedAt(shades, 9)).toEqual([0, 0.1]);
    expect(shadedAt(shades, 11)).toEqual([0, 0.2]);
    expect(shadedAt(shades, 13)[1]).toBeCloseTo(0.15);
    expect(shadedAt(shades, 15)).toEqual([0, 0.1]);
  });
  it("continues interrupted transitions from the visible geometry", () => {
    const events = [{ t0: 0, dur: 4, from: 0, to: 1 }, { t0: 2, dur: 2, from: 0, to: 0.2 }];
    expect(shadedAt(events, 2)).toEqual([0, 0.5]);
    expect(shadedAt(events, 3)[1]).toBeCloseTo(0.35);
  });
  it("seeks backwards identically without mutating input", () => {
    const before = JSON.stringify({ s, cuts, shades });
    const middle = planBar(s, cuts, shades, 9);
    planBar(s, cuts, shades, 30); planBar(s, cuts, shades, 0);
    expect(planBar(s, cuts, shades, 9)).toEqual(middle);
    expect(JSON.stringify({ s, cuts, shades })).toBe(before);
  });
  it("repartitions quarters into thirds without inventing unequal pieces", () => {
    const p = cutsAt(4, [{ t0: 1, dur: 1, into: 3 }], 3);
    expect(p.cuts.map(c => c.share)).toEqual([0.333333333, 0.666666667]);
  });
});
describe("readable near-zero labels", () => {
  it("separates 0%, 1%, 6% while keeping all text inside the card", () => {
    const labels = [{ x: 50, w: 48 }, { x: 57, w: 48 }, { x: 92, w: 48 }, { x: 750, w: 90 }];
    const xs = spreadBarLabels(labels, 20, 800)!;
    for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual((labels[i]!.w + labels[i - 1]!.w) / 2 + 16);
    expect(xs[0]! - 24).toBeGreaterThanOrEqual(20);
    expect(xs[3]! + 45).toBeLessThanOrEqual(800);
  });
  it("leaves spacious labels at their true positions and flags impossible rows", () => {
    expect(spreadBarLabels([{ x: 100, w: 40 }, { x: 400, w: 60 }], 0, 600)).toEqual([100, 400]);
    expect(spreadBarLabels([{ x: 1, w: 70 }, { x: 2, w: 70 }], 0, 100)).toBeNull();
  });
});
describe("screenplay contract", () => {
  it("accepts a percent bar and its word-timed actions", () => {
    expect(partSchema.parse({ id: "b", bar: "A", w: 14, h: 2, whole: 50, scale: { max: 100, suffix: "\\%", label: "Percent" }, marks: [{ id: "twenty", value: 0.2 }] })).toBeDefined();
    expect(actionSchema.parse({ do: "partition", target: "b", into: 100, at: "hundred" })).toBeDefined();
    expect(actionSchema.parse({ do: "shade", target: "b", to: 0.2, at: "twenty" })).toBeDefined();
  });
  it("rejects invalid partitions and percentages at the schema boundary", () => {
    expect(() => actionSchema.parse({ do: "partition", target: "b", into: 2.5 })).toThrow();
    expect(() => actionSchema.parse({ do: "shade", target: "b", to: 1.5 })).toThrow();
  });
});
