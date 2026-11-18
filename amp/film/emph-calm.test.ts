// @vitest-environment jsdom
import { expect, it } from "vitest";
import { boxedPadding, EMPH_GROW_MAX_PX, emphScale } from "./stage";

it("lets a small lit shape grow its usual 15%", () => {
  expect(emphScale(40, 1)).toBeCloseTo(1.15, 6);
  expect(emphScale(40, 0.5)).toBeCloseTo(1.075, 6);
});

it("keeps a big lit shape calm: it grows only a few pixels, however wide it is", () => {
  for (const size of [100, 300, 900]) {
    const grown = (emphScale(size, 1) - 1) * size;
    expect(grown).toBeCloseTo(EMPH_GROW_MAX_PX, 6);
  }
  expect(emphScale(300, 0)).toBe(1);
});

it("grows smoothly with the light: more light never means less growth", () => {
  let last = 0;
  for (let i = 0; i <= 20; i++) {
    const k = emphScale(250, i / 20);
    expect(k).toBeGreaterThanOrEqual(last);
    last = k;
  }
});

it("measures a boxed line's padding so its math fits inside the box", () => {
  const el = document.createElement("div");
  el.className = "film-line answer";
  el.style.padding = "0 56px";
  document.body.appendChild(el);
  expect(boxedPadding(el)).toBe(112);
  el.className = "film-line";
  expect(boxedPadding(el)).toBe(0);
  el.remove();
});
