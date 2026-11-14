// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import { mountExample } from "./example";
import { actionSchema, scriptSchema, type Timing } from "./schema";
import { Film, heldHighlights } from "./stage";

const say = "Radius, five. HEIGHT twelve. Radius height done.";
const timing: Timing = { duration: 11, shots: [[{
  start: 1, end: 9,
  words: say.split(" ").map((text, i) => ({ text, start: [1, 2, 3, 3.5, 4, 6, 8][i]!, end: [1, 2, 3, 3.5, 4, 6, 8][i]! + 0.3 })),
}]] };
const figure = {
  points: { A: [0, 0], B: [3, 0] },
  parts: [
    { id: "radius", seg: ["A", "B"], group: "shape", start: true },
    { id: "label", label: "r", at: "A", start: true },
    { id: "grid", grid: [2, 1], at: "A", start: true },
    { id: "c", counters: "grid", n: 2, start: true },
    { id: "b", blocks: ["tens", "ones"], rows: [{ id: "n", pieces: { tens: 1, ones: 2 } }], digits: true, start: true },
    { id: "t", table: true, at: "A", head: ["A"], rows: [{ label: "B", cells: ["2"] }], cell: [2, 2], start: true },
    { id: "m", mosaic: "A", w: 4, h: 2, slice: "rows", groups: [{ n: 2, k: 1 }], start: true },
    { id: "bar", bar: "A", w: 4, h: 2, start: true },
    { id: "ducks", things: "duck", n: 2, at: "A", start: true },
  ],
};
const cleanup: (() => void)[] = [];
afterEach(() => { act(() => cleanup.splice(0).forEach((f) => f())); });
function geometry(targets: string[]) {
  const aliases: Record<string, string> = { shape: "radius", c1: "c", ducks1: "ducks" };
  const ids = new Set(targets.map((t) => aliases[t] ?? t.split(".")[0]));
  if (ids.has("c")) ids.add("grid");
  return { ...figure, parts: figure.parts.filter((p) => ids.has(p.id)) };
}
function film(actions: unknown[], fig: unknown = geometry(["radius"])) {
  const script = scriptSchema.parse({ id: "until", title: "Until", shots: [{ figure: fig, beats: [{ say, do: actions }] }] });
  const root = document.createElement("div");
  document.body.appendChild(root);
  cleanup.push(() => root.remove());
  let f!: Film;
  act(() => {
    f = new Film(root, script, timing, (host, shot, list) => mountExample(null, host, shot, list, (dispose) => cleanup.push(dispose)), { checks: false });
  });
  return { f, root, script, geo: f.shots[0]!.geo! };
}

const targets = ["radius", "shape", "label", "grid", "c1", "b.n.tens", "b.n.tens.1", "b.digit.tens", "t.row.1", "t.cell.1.1", "m.slab.1", "bar.part"];
it.each(targets)("releases %s on its word with the existing fade, and preserves the default hold", (target) => {
  for (const until of ["height", undefined]) {
    const { f, geo } = film([{ do: "highlight", target, at: "radius", until }], geometry([target]));
    const light = (t: number) => geo.chainState([target], true, t).em;
    expect(light(0.9)).toBe(0);
    expect(light(2.5)).toBe(1);
    if (until) {
      expect(light(3.17)).toBeCloseTo(0.5);
      expect(light(4)).toBe(0);
      expect(f.moving()).toContainEqual([3.02, 3.34]);
    } else {
      expect(light(8.9)).toBe(1);
      expect(light(9.17)).toBeCloseTo(0.5);
      expect(light(10)).toBe(0);
    }
    // Seeking backwards never resurrects a finished light in a later frame.
    expect(light(2.5)).toBe(1);
    expect(light(10)).toBe(0);
  }
});

it.each(["ducks", "ducks1"])("releases things named %s, including mixed target lists", (target) => {
  for (const until of ["height", undefined]) {
    const { geo } = film([{ do: "highlight", target: [target, "radius"], at: "radius", until }], geometry([target, "radius"]));
    const light = (t: number) => geo.thingsModel!.stateAt("ducks1", t).lit;
    expect(light(2)).toBe(1);
    expect(light(until ? 3.46 : 9.46)).toBeCloseTo(0.5);
    expect(light(4)).toBe(until ? 0 : 1);
    expect(light(8.9)).toBe(until ? 0 : 1);
    expect(light(10)).toBe(0);
  }
});

it("matches punctuation, case and explicit occurrences just like at/nth", () => {
  const { geo } = film([{ do: "highlight", target: "radius", at: "RADIUS!", nth: 2, until: "Height.", untilNth: 2 }]);
  const light = (t: number) => geo.chainState(["radius"], true, t).em;
  expect(light(3.5)).toBe(0);
  expect(light(5)).toBe(1);
  expect(light(6.17)).toBeCloseTo(0.5);
  expect(light(7)).toBe(0);
});

const scene = { scene: { v: 1, elements: [{ type: "coins", id: "coins", coins: [{ coin: "quarter" }, { coin: "quarter" }] }] } };
const cue = (extra: object) => ({ do: "scene", at: "radius", actions: [{ do: "highlight", target: "coins.coin.0", ...extra }] });
it("releases a nested scene highlight independently and preserves other scene lights", () => {
  const { f, root } = film([
    { do: "scene", at: "radius", actions: [
      { do: "highlight", target: "coins.coin.0", until: "height", untilNth: 2 },
      { do: "highlight", target: "coins.coin.1" },
    ] },
    { do: "scene", at: "radius", nth: 2, actions: [{ do: "fill", target: "coins", ink: "warm" }] },
  ], scene);
  const strengths = (t: number) => {
    act(() => f.shots[0]!.extern!(t));
    return [0, 1].map((i) => Number(root.querySelector(`[data-id="coins.coin.${i}"] [data-coin-lit]`)?.getAttribute("stroke-opacity") ?? 0));
  };
  expect(strengths(2)).toEqual([1, 1]);
  expect(strengths(5)).toEqual([1, 0]);
  expect(strengths(6.45)[0]).toBeCloseTo(0.5);
  expect(strengths(7)).toEqual([0, 0]);
  expect(strengths(2)).toEqual([1, 1]);
  expect(strengths(0)).toEqual([0, 0]);
  expect(f.moving()).toContainEqual([5.98, 6.92]);
});

it("keeps the final scene light held when until is omitted", () => {
  const { f, root } = film([cue({})], scene);
  act(() => f.shots[0]!.extern!(10));
  expect(root.querySelector('[data-id="coins.coin.0"] [data-coin-lit]')?.getAttribute("stroke-opacity")).toBe("1");
});

it.each([
  [{ until: "missing" }, /Word "missing" \(occurrence 1\) is not in:/],
  [{ until: "height", untilNth: 3 }, /Word "height" \(occurrence 3\) is not in:/],
  [{ until: "height" }, /before the action starts/],
] as const)("reports bad releases for geometry, things and scenes: %j", (extra, error) => {
  for (const target of ["radius", "ducks"]) {
    expect(() => film([{ do: "highlight", target, at: "radius", nth: 2, ...extra }])).toThrow(error);
  }
  expect(() => film([{ ...cue(extra), nth: 2 }], scene)).toThrow(error);
});

it("accepts a same-word release and samples it before its short fade", () => {
  const { script, geo } = film([{ do: "highlight", target: "radius", at: "radius", until: "radius" }]);
  const [held] = heldHighlights(script, timing);
  expect(held!.t).toBe(1.04);
  expect(geo.chainState(["radius"], true, 2).em).toBe(0);
});

it("samples explicit scene highlights and rejects invalid occurrence numbers", () => {
  const { script } = film([cue({ until: "height" })], scene);
  expect(heldHighlights(script, timing)).toEqual([{ beat: 0, t: 1.9, word: "radius" }]);
  for (const untilNth of [0, -1, 1.5]) {
    expect(actionSchema.safeParse({ do: "highlight", target: "radius", until: "height", untilNth }).success).toBe(false);
    expect(actionSchema.safeParse(cue({ until: "height", untilNth })).success).toBe(false);
  }
});

it("samples the peak of a scene light released on its starting word", () => {
  const { f, root, script } = film([cue({ until: "radius" })], scene);
  const [held] = heldHighlights(script, timing);
  expect(held!.t).toBe(1.45);
  act(() => f.shots[0]!.extern!(held!.t));
  expect(Number(root.querySelector('[data-id="coins.coin.0"] [data-coin-lit]')?.getAttribute("stroke-opacity"))).toBeCloseTo(0.5);
});
