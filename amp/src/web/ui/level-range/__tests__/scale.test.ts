import { expect, test } from "vitest";
import { shownRange, shownSpan } from "../../../../learning/level-check";
import { fitScale, likelyRange, shownLikely } from "../scale";

const inside = (scale: { lo: number; hi: number }, level: number) =>
  level >= scale.lo && level <= scale.hi;

test("a K to 12 class fits one scale and nobody's range runs off it", () => {
  const children = [
    { level: 0.4, sd: 0.4 },
    { level: 4.2, sd: 0.6 },
    { level: 8.1, sd: 0.5 },
    { level: 12.3, sd: 0.3 },
  ];
  const scale = fitScale(children);
  for (const child of children) {
    const range = shownRange(child);
    const [from, to] = shownSpan(range);
    // An open end runs to the scale's end; a closed one fits on it.
    if (!range.openLow) expect(inside(scale, from)).toBe(true);
    if (!range.openHigh) expect(inside(scale, to)).toBe(true);
  }
  // Precalculus is the top: a range that reaches it is open, and runs to
  // the end of a scale that stops there.
  expect(scale).toEqual({ lo: 0, hi: 12 });
});

test("a bar's ends are its words' grades: a range reaching precalculus is open", () => {
  expect(shownLikely({ level: 8, sd: 1.6, low: 5.3, high: 10.7 })).toEqual([
    4.5, 11.5,
  ]);
  expect(shownLikely({ level: 9, sd: 2.1, low: 6.4, high: 11.7 })[1]).toBe(13);
  expect(likelyRange({ level: 9, sd: 2.1, low: 6.4, high: 11.7 })).toEqual([
    6.4, 11.7,
  ]);
});

test("a narrow class still gets a readable span, and the data are never clamped", () => {
  const scale = fitScale([{ level: 5, sd: 0.2 }], { minSpan: 4 });
  expect(scale.hi - scale.lo).toBe(4);
  expect(inside(scale, 5)).toBe(true);
  // A course stripe beyond everyone's range widens the scale to hold it.
  expect(fitScale([{ level: 5, sd: 0.2 }], { include: [9, 10] }).hi).toBe(10);
  // Padding adds context but stops at the ends of the curriculum.
  expect(fitScale([{ level: 0.5, sd: 0.3 }], { pad: 1 }).lo).toBe(0);
});
