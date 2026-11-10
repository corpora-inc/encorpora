import { expect, test } from "vitest";
import { fitScale, likelyRange } from "../scale";

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
  for (const child of children)
    for (const end of likelyRange(child))
      expect(inside(scale, end), `${end} in ${scale.lo}–${scale.hi}`).toBe(
        true,
      );
  expect(scale).toEqual({ lo: 0, hi: 13 });
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
