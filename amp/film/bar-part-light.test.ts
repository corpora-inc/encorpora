// @vitest-environment jsdom
import { act } from "react";
import { afterEach, expect, it } from "vitest";
import { mountExample } from "./example";
import { scriptSchema, type Timing } from "./schema";
import { Film } from "./stage";

const say = "Half is shaded here now.";
const timing: Timing = { duration: 9, shots: [[{
  start: 1, end: 7,
  words: say.split(" ").map((text, i) => ({ text, start: 1 + i, end: 1.3 + i })),
}]] };
const cleanup: (() => void)[] = [];
afterEach(() => { act(() => cleanup.splice(0).forEach((f) => f())); });

function film(target: string) {
  const script = scriptSchema.parse({ id: "bar-part", title: "Bar part", shots: [{
    figure: { points: { A: [0, 0] }, parts: [{ id: "bar", bar: "A", w: 4, h: 1, divisions: 2, start: true }] },
    beats: [{ say, do: [{ do: "shade", target: "bar", to: 0.5, dur: 0.01 }, { do: "highlight", target, at: "shaded", until: "now" }] }],
  }] });
  const root = document.createElement("div");
  document.body.appendChild(root);
  cleanup.push(() => root.remove());
  let f!: Film;
  act(() => {
    f = new Film(root, script, timing, (host, shot, list) => mountExample(null, host, shot, list, (dispose) => cleanup.push(dispose)), { checks: false });
  });
  const at = (t: number) => {
    act(() => f.seek(t));
    const part = root.querySelector<SVGElement>(".film-bar-part")!;
    return { part, group: part.parentElement as unknown as SVGElement };
  };
  return at;
}

it("lights a bar's shaded part where it is, without growing it out of the bar", () => {
  const at = film("bar.part");
  const rest = at(2.5);
  expect(Number(rest.part.style.fillOpacity)).toBeCloseTo(0.32);
  expect(rest.part.getAttribute("transform")).toBeNull();
  const lit = at(3.8);
  expect(Number(lit.part.style.fillOpacity)).toBeCloseTo(0.62);
  expect(Number(lit.part.style.strokeWidth)).toBeCloseTo(3);
  expect(lit.part.getAttribute("transform")).toBeNull();
  expect(lit.group.dataset.em).toBeUndefined();
  expect(lit.part.dataset.em).toBeUndefined();
  const after = at(6.5);
  expect(Number(after.part.style.fillOpacity)).toBeCloseTo(0.32);
  expect(after.part.style.strokeWidth).toBe("");
});

it("still grows the whole bar when the bar itself is lit", () => {
  const at = film("bar");
  const lit = at(3.8);
  expect(Number(lit.part.style.fillOpacity)).toBeCloseTo(0.32);
  expect(lit.part.getAttribute("transform")).toBeNull();
  // jsdom has no layout, so the scale itself is not written; the growth mark is.
  expect(lit.group.dataset.em).toBe("1.000");
  expect(lit.part.dataset.em).toBeUndefined();
});
