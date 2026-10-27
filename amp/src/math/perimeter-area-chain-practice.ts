import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";

export const perimeterAreaChainTemplate: TemplateMetadata = {
  id: "perimeter-area-chain",
  version: 1,
  title: "Perimeter to area and area to perimeter",
  skillId: "area-perimeter-models",
  gradeBand: "3–5",
  difficultyOffset: 0.4,
  description:
    "Find a square's area from its perimeter or its perimeter from its area, and a rectangle's area from its perimeter and one side or its perimeter from its area and one side.",
};

const axes = {
  given: defineAxis("given", ["perimeter", "area"] as const),
};
interface Model {
  shape: "square" | "rectangle";
  a: number; // side of the square, or width
  b: number; // length of the rectangle (unused for squares)
  context: number;
}
const places = [
  {
    square: "A square garden",
    rectangle: "A rectangular patio",
    unit: "meters",
    sq: "square meters",
  },
  {
    square: "A square game board",
    rectangle: "A rectangular banner",
    unit: "inches",
    sq: "square inches",
  },
  {
    square: "A square pool cover",
    rectangle: "A rectangular rug",
    unit: "feet",
    sq: "square feet",
  },
] as const;
function model(r: (lo: number, hi: number) => number): Model {
  const shape = pick(r, ["square", "rectangle"] as const);
  const a = r(3, 12);
  return {
    shape,
    a,
    b: shape === "square" ? a : a + r(2, 9),
    context: r(0, places.length - 1),
  };
}
export const perimeterAreaChain = chainFamily({
  template: perimeterAreaChainTemplate,
  axes,
  model,
  variant: (m) => m.shape,
  render: (m, ax) => {
    const c = places[m.context]!;
    const per = 2 * (m.a + m.b);
    const area = m.a * m.b;
    if (m.shape === "square") {
      if (ax.given === "perimeter")
        return numberSurface({
          prompt: `${c.square} has a perimeter of ${4 * m.a} ${c.unit}. What is its area, in ${c.sq}?`,
          answer: String(area),
          hint: `A square has 4 equal sides. Divide the perimeter ${4 * m.a} by 4 to find one side first.`,
          explanation: [
            `The four sides are equal, so one side is $${4 * m.a}\\div4=${m.a}$ ${c.unit}.`,
            `The area is side times side: $${m.a}\\times${m.a}=${area}$.`,
            `The area is ${area} ${c.sq}.`,
          ],
          label: `Answer (${c.sq})`,
        });
      return numberSurface({
        prompt: `${c.square} has an area of ${area} ${c.sq}. What is its perimeter, in ${c.unit}?`,
        answer: String(4 * m.a),
        hint: `The area ${area} is a side times itself. Find the number that multiplies by itself to make ${area}; that is one side.`,
        explanation: [
          `Area is side times side, and $${m.a}\\times${m.a}=${area}$, so one side is ${m.a} ${c.unit}.`,
          `The perimeter adds four equal sides: $4\\times${m.a}=${4 * m.a}$.`,
          `The perimeter is ${4 * m.a} ${c.unit}.`,
        ],
        label: `Answer (${c.unit})`,
      });
    }
    if (ax.given === "perimeter")
      return numberSurface({
        prompt: `${c.rectangle} has a perimeter of ${per} ${c.unit} and a width of ${m.a} ${c.unit}. What is its area, in ${c.sq}?`,
        answer: String(area),
        hint: `The perimeter is twice the sum of the length and the width. Divide ${per} by 2 to get the length plus the width, then subtract the width ${m.a}.`,
        explanation: [
          `Half the perimeter is length plus width: $${per}\\div2=${per / 2}$.`,
          `The length is $${per / 2}-${m.a}=${m.b}$ ${c.unit}.`,
          `The area is length times width: $${m.b}\\times${m.a}=${area}$ ${c.sq}.`,
        ],
        label: `Answer (${c.sq})`,
      });
    return numberSurface({
      prompt: `${c.rectangle} has an area of ${area} ${c.sq} and a width of ${m.a} ${c.unit}. What is its perimeter, in ${c.unit}?`,
      answer: String(per),
      hint: `Area is length times width. Divide the area ${area} by the width ${m.a} to find the length first.`,
      explanation: [
        `The length is $${area}\\div${m.a}=${m.b}$ ${c.unit}.`,
        `The perimeter is twice the sum of the length and width: $2\\times(${m.b}+${m.a})=2\\times${m.a + m.b}=${per}$.`,
        `The perimeter is ${per} ${c.unit}.`,
      ],
      label: `Answer (${c.unit})`,
    });
  },
});

export const perimeterAreaChainTemplates = [
  perimeterAreaChainTemplate,
] as const;
export const perimeterAreaChainGenerate = dispatch(
  perimeterAreaChainTemplates,
  {
    "perimeter-area-chain": (seed) => perimeterAreaChain.generate(seed).problem,
  },
);
