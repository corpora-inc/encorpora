// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import { mountExample } from "./example";
import { scriptSchema, type Timing } from "./schema";
import { Film, THING_TICK, THING_TICK_IN_CELL } from "./stage";

const say = "Here is one whole bar.";
const timing: Timing = { duration: 6, shots: [[{
  start: 1, end: 5,
  words: say.split(" ").map((text, i) => ({ text, start: 1 + i * 0.8, end: 1.5 + i * 0.8 })),
}]] };
const cleanup: (() => void)[] = [];
afterEach(() => { act(() => cleanup.splice(0).forEach((f) => f())); });

function bracketAt(title: string | undefined, t: number) {
  const bar: Record<string, unknown> = { id: "bar", bar: "A", w: 4, h: 1, divisions: 4, start: true };
  if (title !== undefined) bar.title = title;
  const script = scriptSchema.parse({ id: "bar-title", title: "Bar title", shots: [{
    figure: { points: { A: [0, 0] }, parts: [bar] },
    beats: [{ say }],
  }] });
  const root = document.createElement("div");
  document.body.appendChild(root);
  cleanup.push(() => root.remove());
  let f!: Film;
  act(() => {
    f = new Film(root, script, timing, (host, shot, list) => mountExample(null, host, shot, list, (dispose) => cleanup.push(dispose)), { checks: false });
  });
  act(() => f.seek(t));
  return {
    bracket: root.querySelector<SVGElement>(".film-bar-bracket")!,
    title: root.querySelector<HTMLElement>(".film-bar-title")!,
  };
}

it("draws no bracket over a bar whose title is empty", () => {
  for (const t of [1.2, 3, 5.5]) {
    const { bracket, title } = bracketAt("", t);
    expect(bracket.style.display, `bracket at ${t}`).toBe("none");
    expect(title.style.display, `title at ${t}`).toBe("none");
  }
});

it("still draws the bracket and its words over a titled bar", () => {
  const { bracket, title } = bracketAt(undefined, 3);
  expect(bracket.style.display).toBe("");
  expect(Number(bracket.style.opacity)).toBeGreaterThan(0.5);
  expect(title.style.display).toBe("");
});

it("centres a counted thing's tick under its art in a row, clear of the art", () => {
  const nums = THING_TICK.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
  // the art is drawn in a 100-unit box centred on 50
  expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(50, 0);
  expect(Math.min(...ys)).toBeGreaterThan(100);
});

it("keeps the tick inside the thing's own cell in a grid, clear of the cell border", () => {
  // the art fills IN_CELL (0.8) of its cell, so the cell edge is 12.5 units beyond the 100-unit box
  const nums = THING_TICK_IN_CELL.match(/-?\d+(\.\d+)?/g)!.map(Number);
  const ys = nums.filter((_, i) => i % 2 === 1), xs = nums.filter((_, i) => i % 2 === 0);
  expect(Math.max(...ys)).toBeLessThan(112.5 - 4);
  expect(Math.max(...xs)).toBeLessThan(112.5 - 4);
});
