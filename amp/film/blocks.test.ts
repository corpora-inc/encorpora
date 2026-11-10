import { describe, expect, it } from "vitest";
import { BlocksModel, chartView, digitsOf, initialState, kindOf, layoutChart, layoutPile, splitOne, subBox, unitPlace, zoomView, type Place } from "./blocks";

const places: Place[] = ["ones", "tenths", "hundredths"];
const value = (m: BlocksModel, i: number) => {
  const s = m.states[i]!;
  return places.reduce((a, p) => a + (s[p] ?? []).length * ({ ones: 100, tenths: 10, hundredths: 1 } as Record<string, number>)[p]!, 0);
};

describe("shapes", () => {
  it("the flat is the whole in a decimal chart; the square is the one in a whole-number chart", () => {
    expect(unitPlace(places)).toBe("hundredths");
    expect(kindOf("ones", "hundredths")).toBe("flat");
    expect(kindOf("tenths", "hundredths")).toBe("rod");
    expect(kindOf("hundredths", "hundredths")).toBe("square");
    expect(unitPlace(["hundreds", "tens", "ones"])).toBe("ones");
    expect(kindOf("hundreds", "ones")).toBe("flat");
    expect(() => kindOf("thousands", "ones")).toThrow(/not drawn yet/);
  });
  it("is always to scale: a rod is ten squares long, a flat ten rods wide", () => {
    const s = initialState("b", "n", places, { ones: 1, tenths: 1, hundredths: 1 }, {}, "accent");
    const l = layoutChart(places, s);
    expect(l.pieces.get("b.n.ones.1")).toMatchObject({ w: 10, h: 10 });
    expect(l.pieces.get("b.n.tenths.1")).toMatchObject({ w: 1, h: 10 });
    expect(l.pieces.get("b.n.hundredths.1")).toMatchObject({ w: 1, h: 1 });
  });
});

describe("piles", () => {
  const rods = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `r${k}`, kind: "rod" as const, ink: "accent" }));
  const squares = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `s${k}`, kind: "square" as const, ink: "accent" }));
  const flats = (n: number) => Array.from({ length: n }, (_, k) => ({ id: `f${k}`, kind: "flat" as const, ink: "accent" }));
  it("rods stand side by side on one baseline", () => {
    const p = layoutPile(rods(7));
    expect(p.boxes.every((b) => b.y === 0 && b.h === 10)).toBe(true);
    expect(p.w).toBeCloseTo(7 + 6 * 0.5);
    expect(p.h).toBe(10);
  });
  it("squares stack in tens, so twenty-seven is two full stacks and a stack of seven", () => {
    const p = layoutPile(squares(27));
    const cols = new Set(p.boxes.map((b) => b.x));
    expect(cols.size).toBe(3);
    expect(p.boxes.filter((b) => b.x === 0).length).toBe(10);
    expect(p.boxes.filter((b) => b.x === Math.max(...cols)).length).toBe(7);
    // a stack of ten is about a rod tall, not taller than the chart's rods by much
    expect(p.h).toBeLessThan(11.2);
  });
  it("squares in rows of five, the early-grade way, when asked", () => {
    const p = layoutPile(squares(7), "rows");
    expect(p.boxes.filter((b) => b.y === 0).length).toBe(5);
    expect(p.boxes.filter((b) => b.y > 0).length).toBe(2);
  });
  it("four flats make a two by two block; more go three to a row", () => {
    expect(layoutPile(flats(4)).w).toBeCloseTo(20.6);
    expect(layoutPile(flats(4)).h).toBeCloseTo(20.6);
    expect(layoutPile(flats(5)).w).toBeCloseTo(31.2);
  });
  it("an empty pile has no size", () => {
    expect(layoutPile([])).toEqual({ boxes: [], w: 0, h: 0 });
  });
});

describe("chart", () => {
  it("centers each pile in a column at least wide enough for its name, and puts the point between ones and tenths", () => {
    const s = initialState("b", "n", places, { tenths: 7 }, {}, "accent");
    const l = layoutChart(places, s, { point: true });
    expect(l.columns.map((c) => c.place)).toEqual(places);
    for (const c of l.columns) expect(c.x1 - c.x0).toBeGreaterThanOrEqual(8);
    const tenths = l.columns[1]!;
    expect(tenths.pile.x + tenths.pile.w / 2).toBeCloseTo(tenths.cx);
    expect(l.pointX).toBeCloseTo((l.columns[0]!.x1 + tenths.x0) / 2);
    // columns never overlap
    for (let i = 1; i < l.columns.length; i++) expect(l.columns[i]!.x0).toBeGreaterThan(l.columns[i - 1]!.x1);
  });
  it("the view of the whole chart holds every piece and the digit row", () => {
    const s = initialState("b", "n", places, { ones: 4, tenths: 5 }, {}, "accent");
    const l = layoutChart(places, s);
    const [x0, y0, x1, y1] = chartView(l);
    for (const b of l.pieces.values()) {
      expect(b.x).toBeGreaterThanOrEqual(x0); expect(b.x + b.w).toBeLessThanOrEqual(x1);
      expect(b.y).toBeGreaterThanOrEqual(y0); expect(b.y + b.h).toBeLessThanOrEqual(y1);
    }
    expect(y0).toBeLessThan(-4.3);
  });
  it("a zoom holds the piece with room for its labels", () => {
    const v = zoomView({ x: 3, y: 0, w: 10, h: 10 }, ["n", "e"]);
    expect(v[0]).toBeLessThan(3); expect(v[1]).toBeLessThan(0);
    expect(v[2]).toBeGreaterThan(13 + 5); expect(v[3]).toBeGreaterThan(10 + 2);
  });
  it("names strips and cells of a flat and cells of a rod", () => {
    const flat = { x: 2, y: 0, w: 10, h: 10 };
    expect(subBox("flat", flat, "s10")).toEqual({ x: 11, y: 0, w: 1, h: 10 });
    expect(subBox("flat", flat, "c1")).toEqual({ x: 2, y: 9, w: 1, h: 1 });
    expect(subBox("flat", flat, "c100")).toEqual({ x: 11, y: 0, w: 1, h: 1 });
    expect(subBox("rod", { x: 0, y: 0, w: 1, h: 10 }, "c1")).toEqual({ x: 0, y: 9, w: 1, h: 1 });
    expect(() => subBox("square", { x: 0, y: 0, w: 1, h: 1 }, "c1")).toThrow();
  });
});

describe("digits", () => {
  it("reads the numeral and marks placeholders: 0.70 has a leading 0 that counts and a trailing 0 that only holds a place", () => {
    const d = digitsOf(places, initialState("b", "n", places, { tenths: 7 }, {}, "accent"));
    expect(d.digit).toEqual({ ones: 0, tenths: 7, hundredths: 0 });
    expect(d.placeholder).toEqual({ hundredths: true, tenths: false });
    expect(d.overflow).toBe(false);
  });
  it("carries a pile of ten or more, so 2 tenths and 27 hundredths still read 0.47", () => {
    const s = initialState("b", "n", places, { tenths: 2, hundredths: 27 }, {}, "accent");
    expect(digitsOf(places, s).digit).toEqual({ ones: 0, tenths: 4, hundredths: 7 });
  });
  it("a zero between digits is not a placeholder; a leading zero left of the ones is", () => {
    expect(digitsOf(places, initialState("b", "n", places, { ones: 4, hundredths: 5 }, {}, "accent")).placeholder).toEqual({ hundredths: false, tenths: false });
    const whole: Place[] = ["hundreds", "tens", "ones"];
    expect(digitsOf(whole, initialState("b", "n", whole, { tens: 4, ones: 7 }, {}, "accent")).placeholder).toEqual({ hundreds: true, tens: false });
  });
});

describe("splits", () => {
  it("cuts the rightmost rod into ten squares that join the hundredths at the left, and the amount does not change", () => {
    const s0 = initialState("b", "n", places, { tenths: 2, hundredths: 7 }, { hundredths: "warm" }, "accent");
    const seq = { ones: 0, tenths: 2, hundredths: 7 };
    const r = splitOne(places, s0, "tenths", seq);
    expect(r.from.id).toBe("b.n.tenths.2");
    expect(r.born).toHaveLength(10);
    expect(r.born.every((p) => p.kind === "square" && p.ink === "accent" && p.from === "b.n.tenths.2")).toBe(true);
    expect(r.state.tenths).toHaveLength(1);
    expect(r.state.hundredths).toHaveLength(17);
    expect(r.state.hundredths!.slice(0, 10).map((p) => p.id)).toEqual(r.born.map((p) => p.id));
    expect(r.state.hundredths![16]!.ink).toBe("warm");
    expect(new Set(r.state.hundredths!.map((p) => p.id)).size).toBe(17);
  });
  it("refuses a split with no place to the right or nothing to split", () => {
    expect(() => splitOne(places, initialState("b", "n", places, { hundredths: 3 }, {}, "accent"), "hundredths", { hundredths: 3 })).toThrow(/place to its right/);
    expect(() => splitOne(places, initialState("b", "n", places, {}, {}, "accent"), "tenths", { tenths: 0 })).toThrow(/nothing left/);
  });
  it("a model keeps the value through every state and lands every piece exactly", () => {
    const m = new BlocksModel("b", "n", places, { tenths: 7 });
    m.split("tenths", 7, 10, 0.9, 0.45);
    expect(m.states).toHaveLength(8);
    for (let i = 0; i < m.states.length; i++) expect(value(m, i)).toBe(70);
    expect(m.countAt("tenths", 0)).toBe(7);
    expect(m.countAt("hundredths", 0)).toBe(0);
    expect(m.countAt("hundredths", 10 + 6 * 0.45 + 0.9)).toBe(70);
    expect(m.countAt("tenths", 100)).toBe(0);
    // after the trade the last-born square is exactly where the final layout puts it
    const last = m.transitions[6]!.born[3]!.id;
    expect(m.positionAt(last, 100)).toEqual(m.layouts[7]!.pieces.get(last));
    // and the rod that was cut no longer exists
    expect(m.positionAt("b.n.tenths.7", 100)).toBeUndefined();
    expect(m.positionAt("b.n.tenths.7", 9.99)).toBeDefined();
  });
  it("a new square starts inside the rod it was cut from and ends in the hundredths column", () => {
    const m = new BlocksModel("b", "n", places, { tenths: 2, hundredths: 7 });
    m.split("tenths", 1, 5, 1, 1);
    const rod = m.positionAt("b.n.tenths.2", 4.999)!;
    const born = m.transitions[0]!.born;
    const top = m.positionAt(born[9]!.id, 5 + 1e-9)!;
    expect(top.x).toBeCloseTo(rod.x, 3);
    expect(top.y).toBeCloseTo(rod.y + 9, 3);
    const end = m.positionAt(born[9]!.id, 50)!;
    const hund = m.column("hundredths", 50);
    expect(end.x).toBeGreaterThanOrEqual(hund.x0);
    expect(end.x + end.w).toBeLessThanOrEqual(hund.x1);
  });
  it("the pile a label points at follows its pieces", () => {
    const m = new BlocksModel("b", "n", places, { tenths: 2, hundredths: 7 });
    m.split("tenths", 2, 5, 1, 1);
    const before = m.boxOf("b.n.hundredths", 0);
    const after = m.boxOf("b.n.hundredths", 50);
    expect(before.w).toBeCloseTo(1);
    expect(after.w).toBeCloseTo(1 + 2 * 1.5);
    expect(() => m.boxOf("b.n.tenths", 50)).toThrow(/empty pile/);
    expect(() => m.boxOf("b.n.tens", 0)).toThrow(/no tens place/);
  });
});

describe("columns stay put", () => {
  it("a column is as wide as the widest pile it ever holds, so headers never move during a trade", () => {
    const m = new BlocksModel("b", "n", places, { tenths: 7 });
    m.split("tenths", 7, 0, 1, 1);
    const first = m.layouts[0]!.columns.map((c) => [c.x0, c.x1]);
    for (const l of m.layouts) expect(l.columns.map((c) => [c.x0, c.x1])).toEqual(first);
    // the hundredths column was widened in advance for the seventy squares it will hold
    const h = m.layouts[0]!.columns[2]!;
    expect(h.x1 - h.x0).toBeCloseTo(7 + 6 * 0.5);
  });
  it("gives each column the room its name needs at the chart's scale", () => {
    const m = new BlocksModel("b", "n", places, { tenths: 2, hundredths: 7 });
    m.fitHeaders(20);
    const w = (p: string) => { const c = m.layouts[0]!.columns.find((x) => x.place === p)!; return c.x1 - c.x0; };
    expect(w("hundredths")).toBeCloseTo((27 * 10 + 40) / 20);
    // the name and digit rows sit at fixed pixel offsets, so they never crowd the blocks at any scale
    expect(m.headY).toBeCloseTo(-46 / 20);
    expect(m.digitY).toBeCloseTo(-124 / 20);
    expect(w("ones")).toBe(8);
  });
});

describe("cuts", () => {
  it("a flat with no lines gains its tenths lines, then its hundredths lines", () => {
    const m = new BlocksModel("b", "n", places, { ones: 1 }, { lines: "none" });
    expect(m.linesAt(0)).toEqual({ v: 0, h: 0 });
    m.cut("tenths", 2, 1);
    m.cut("hundredths", 6, 1);
    expect(m.linesAt(1.9)).toEqual({ v: 0, h: 0 });
    expect(m.linesAt(3.5)).toEqual({ v: 1, h: 0 });
    expect(m.linesAt(2.5).v).toBeGreaterThan(0.3);
    expect(m.linesAt(8)).toEqual({ v: 1, h: 1 });
    expect(() => m.cut("ones", 0, 1)).toThrow(/draws nothing/);
  });
  it("lines are drawn from the start unless the chart says otherwise", () => {
    expect(new BlocksModel("b", "n", places, { tenths: 3 }).linesAt(0)).toEqual({ v: 1, h: 1 });
  });
});
