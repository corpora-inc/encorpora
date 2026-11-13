import { expect, test } from "vitest";
import { breakable } from "../../MathText";

test("a formula that reads as a sentence breaks after its commas and before its words", () => {
  expect(
    breakable(
      "\\angle AOB,\\angle BOC\\text{ and }\\angle BOC,\\angle COD\\text{ are linear pairs}",
    ),
  ).toEqual([
    "\\angle AOB,",
    "\\angle BOC",
    "\\text{ and }\\angle BOC,",
    "\\angle COD",
    "\\text{ are linear pairs}",
  ]);
});

test("ordinary formulas, pairs and sets stay whole", () => {
  for (const tex of [
    "x=5",
    "m\\angle ABC=40^\\circ",
    "\\left(3,\\,-2\\right)",
    "(3, -2)",
  ])
    expect(breakable(tex)).toEqual([tex]);
  expect(breakable("\\{1, 2\\}\\text{ is a set}")).toEqual([
    "\\{1, 2\\}",
    "\\text{ is a set}",
  ]);
});
