import { describe, expect, it } from "vitest";
import { placeNames, planStack, type StackPlan } from "./stack";

const plan = (rows: string[], op: "+" | "-") => {
  const p = planStack(rows, op);
  if (typeof p === "string") throw new Error(p);
  return p as StackPlan;
};
/** The answer as written, with its point. */
const written = (p: StackPlan) => {
  const shown = new Set(p.steps.map((s) => s.col));
  for (const s of p.steps) if (s.lead) shown.add(s.lead.col);
  const d = p.answer.map((x, c) => (shown.has(c) ? x : ""));
  return (d.slice(0, p.int).join("") || "0") + (p.frac ? "." + d.slice(p.int).join("") : "");
};

describe("planStack", () => {
  it("adds decimals with a placeholder zero and a final carry", () => {
    const p = plan(["9.26", "0.8"], "+");
    expect(written(p)).toBe("10.06");
    expect(p.rows[1]![3]).toEqual({ digit: "0", pad: true });
    expect(p.steps.map((s) => s.digit)).toEqual(["6", "0", "0"]);
    expect(p.steps[1]!.carry).toEqual({ col: 1, value: "1" });
    expect(p.steps[2]!.lead).toEqual({ col: 0, digit: "1" });
  });
  it("subtracts with one borrow and writes no leading zero", () => {
    const p = plan(["12.06", "2.25"], "-");
    expect(written(p)).toBe("9.81");
    expect(p.steps[1]!.borrows).toEqual([{ col: 1, value: "1" }, { col: 2, value: "10" }]);
  });
  it("borrows across zeros", () => {
    const p = plan(["5.00", "2.04"], "-");
    expect(written(p)).toBe("2.96");
    expect(p.steps[0]!.borrows).toEqual([{ col: 0, value: "4" }, { col: 1, value: "9" }, { col: 2, value: "10" }]);
  });
  it("keeps the zero before the point", () => {
    expect(written(plan(["2.00", "1.96"], "-"))).toBe("0.04");
  });
  it("whole numbers: 305 - 178, 999 + 1, three rows", () => {
    expect(written(plan(["305", "178"], "-"))).toBe("127");
    expect(written(plan(["999", "1"], "+"))).toBe("1000");
    const three = plan(["25", "38", "47"], "+");
    expect(written(three)).toBe("110");
    expect(three.steps[0]!.carry).toEqual({ col: 1, value: "2" });
  });
  it("refuses what cannot be stacked", () => {
    expect(typeof planStack(["2.25", "12.06"], "-")).toBe("string");
    expect(typeof planStack(["1/2", "3"], "+")).toBe("string");
  });
});

describe("leading columns", () => {
  it("12.06 - 2.25 needs three column beats, not four", () => {
    const p = planStack(["12.06", "2.25"], "-");
    if (typeof p === "string") throw new Error(p);
    expect(p.steps.map((s) => s.col)).toEqual([3, 2, 1]);
  });
});

describe("place headers", () => {
  it("names every column, the empty tens of 0.8 + 9.26 included", () => {
    expect(placeNames(plan(["0.8", "9.26"], "+"))).toEqual(["tens", "ones", "tenths", "hundredths"]);
    expect(placeNames(plan(["12.06", "2.25"], "-"))).toEqual(["tens", "ones", "tenths", "hundredths"]);
    expect(placeNames(plan(["305", "178"], "-"))).toEqual(["hundreds", "tens", "ones"]);
    expect(placeNames(plan(["5.00", "2.04"], "-"))).toEqual(["ones", "tenths", "hundredths"]);
  });
});
