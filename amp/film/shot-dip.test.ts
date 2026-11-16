// @vitest-environment jsdom
/**
 * Two different figures in consecutive shots sit in the same card, app figures and geometry
 * alike. Dissolved over each other they read as one garbled picture (a strip's label printed
 * twice), so the second waits until the first has gone. The same figure carried into the next
 * shot still dissolves, which reads as no change at all, and so does a geometry figure that only
 * gains or only loses whole parts in place.
 */
import { describe, expect, it } from "vitest";
import { Film } from "./stage";
import { scriptSchema, type Timing } from "./schema";

const scene = (text: string) => ({ scene: { v: 1, elements: [{ type: "text", id: "a", text, at: [0, 0], font: "sans" }] } });

function film(first: unknown, second: unknown, firstDoes: unknown[] = []) {
  const script = scriptSchema.parse({
    id: "t", title: "t",
    shots: [first, second].map((figure, k) => ({ figure, beats: [{ say: "One two three.", ...(k === 0 && firstDoes.length ? { do: firstDoes } : {}) }] })),
  });
  const beat = (t0: number) => ({ start: t0, end: t0 + 1.4, words: ["One", "two", "three."].map((text, k) => ({ text, start: t0 + k * 0.5, end: t0 + k * 0.5 + 0.4 })) });
  const timing: Timing = { duration: 14, shots: [[beat(0.5)], [beat(6.5)]] };
  const root = document.createElement("div");
  document.body.appendChild(root);
  const f = new Film(root, script, timing, undefined, { checks: false });
  const [a, b] = f.shots;
  /** How much of each shot shows at t (0 when hidden). */
  const shown = (t: number) => { f.seek(t); return [a!, b!].map((s) => (s.el.style.visibility === "hidden" ? 0 : Number(s.el.style.opacity))); };
  return { change: b!.t0, shown };
}

/** At no moment around the change are both shots on screen, and the second ends fully there. */
function expectDip({ change, shown }: ReturnType<typeof film>) {
  for (let t = change - 0.2; t < change + 1.2; t += 0.02) {
    const [first, second] = shown(t);
    expect(Math.min(first!, second!)).toBeLessThan(0.05);
  }
  expect(shown(change + 1)[1]).toBe(1);
}
/** Partway into the change, both shots show: one dissolves into the other. */
function expectDissolve({ change, shown }: ReturnType<typeof film>) {
  const [first, second] = shown(change + 0.15);
  expect(first!).toBeGreaterThan(0.2);
  expect(second!).toBeGreaterThan(0.05);
}

describe("a shot change between two app figures", () => {
  it("never shows both: the second arrives after the first has gone", () => {
    expectDip(film(scene("Set A"), scene("Set B")));
  });
  it("still dissolves when the figure is the same in both shots", () => {
    expectDissolve(film(scene("Set A"), scene("Set A")));
  });
});

/** A strip cut into n equal parts, its whole named above it: halves and thirds share the strip and the name. */
function strip(n: number, extra: Record<string, unknown>[] = []) {
  const points: Record<string, [number, number]> = { name: [3, 3] };
  const parts: Record<string, unknown>[] = [];
  for (let k = 0; k <= n; k++) { points[`b${k}`] = [(6 * k) / n, 0]; points[`t${k}`] = [(6 * k) / n, 2]; }
  for (let k = 0; k < n; k++) parts.push({ id: `p${k}`, poly: [`b${k}`, `b${k + 1}`, `t${k + 1}`, `t${k}`], fill: "accent-fill", ink: "ink", start: true });
  parts.push({ id: "whole", label: "\\text{One whole}", at: "name", dir: "c", start: true });
  return { view: [-1, -1, 7, 4], points, parts: [...parts, ...extra] };
}
const mark = { id: "mark", seg: ["b0", "t0"], ink: "warm", start: true };

describe("a shot change between two geometry figures", () => {
  it("never shows both when the figures differ: halves of the strip, then thirds", () => {
    expectDip(film(strip(2), strip(3)));
  });
  it("still dissolves when the figure is the same in both shots", () => {
    expectDissolve(film(strip(3), strip(3)));
  });
  it("dissolves when the next figure only adds a part in place", () => {
    expectDissolve(film(strip(3), strip(3, [mark])));
  });
  it("dissolves when the next figure only takes a part away", () => {
    expectDissolve(film(strip(3, [mark]), strip(3)));
  });
  it("dissolves when a part the first shot hid is gone and the next shot adds one", () => {
    const hidden = { ...mark, id: "old" };
    expectDissolve(film(strip(3, [hidden]), strip(3, [mark]), [{ do: "hide", target: "old" }]));
  });
  it("reads a part named like an object's own property (toString) as a part, not a point", () => {
    const named = { ...mark, id: "toString" };
    expectDissolve(film(strip(3, [named]), strip(3, [named, { ...mark, id: "tick", seg: ["b3", "t3"] }])));
  });
  it("dips when one part is swapped for another", () => {
    expectDip(film(strip(3, [{ ...mark, id: "old" }]), strip(3, [mark])));
  });
  it("dips when a shared label's point has moved: it would show in both places", () => {
    const moved = strip(3);
    moved.points.name = [3, 3.5];
    expectDip(film(strip(3), moved));
  });
  it("dips when a part the first shot slid away is drawn back where it started", () => {
    const tick = { id: "tick", seg: ["b3", "t3"], ink: "warm", start: true };
    expectDip(film(strip(3, [mark]), strip(3, [mark, tick]), [{ do: "slide", target: "mark", by: [1, 0] }]));
  });
});
