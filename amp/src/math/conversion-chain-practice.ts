import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  decimalText,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";

export const conversionChainTemplate: TemplateMetadata = {
  id: "conversion-chain-story",
  version: 1,
  title: "Convert through several units, then answer the story",
  skillId: "unit-conversion",
  gradeBand: "6–8",
  difficultyOffset: 0.5,
  description:
    "Convert a decimal or mixed-number amount through a chain of customary or metric units, using stated or remembered equivalents, and count whole pieces cut from the converted length.",
};

const axes = {
  "quantity-form": defineAxis("quantity-form", ["decimal", "mixed"] as const),
};

type Kind = "capacity-chart" | "length-recalled" | "cut-pieces";
interface Model {
  kind: Kind;
  quarters: number; // the quantity in quarters of its unit
  piece: number; // cm per piece (cut-pieces)
  target: "pints" | "cups";
}
function quantityText(quarters: number, form: "decimal" | "mixed"): string {
  if (form === "decimal") return decimalText(quarters, 4);
  const whole = Math.floor(quarters / 4);
  const rest = quarters % 4;
  if (rest === 0) return `${whole}`;
  const frac = rest === 2 ? "\\frac{1}{2}" : `\\frac{${rest}}{4}`;
  return whole ? `$${whole}${frac}$` : `$${frac}$`;
}
const quantityMath = (quarters: number) => decimalText(quarters, 4);

function model(r: (lo: number, hi: number) => number): Model {
  const kind = pick(r, [
    "capacity-chart",
    "length-recalled",
    "cut-pieces",
  ] as const);
  if (kind === "capacity-chart")
    return {
      kind,
      quarters: pick(r, [2, 6, 10, 14, 18, 3, 5, 7, 9, 11] as const),
      piece: 0,
      target: pick(r, ["pints", "cups"] as const),
    };
  if (kind === "length-recalled")
    return {
      kind,
      quarters: 4 * r(2, 9) + pick(r, [0, 2] as const),
      piece: 0,
      target: "cups",
    };
  for (let tries = 0; tries < 200; tries++) {
    const quarters = 4 * r(2, 9) + pick(r, [1, 2, 3] as const);
    const piece = pick(r, [15, 18, 20, 25, 30, 35, 40] as const);
    const cm = quarters * 25;
    if (cm % piece !== 0 && Math.floor(cm / piece) >= 3)
      return { kind, quarters, piece, target: "cups" };
  }
  throw new Error("Need three retries");
}

export const conversionChain = chainFamily({
  template: conversionChainTemplate,
  axes,
  model,
  variant: (m) => m.kind,
  render: (m, a) => {
    const q = quantityText(m.quarters, a["quantity-form"]);
    const v = quantityMath(m.quarters);
    if (m.kind === "capacity-chart") {
      const quarts = m.quarters;
      const pints = m.quarters * 2;
      const cups = m.quarters * 4;
      const answer = m.target === "pints" ? pints : cups;
      return numberSurface({
        prompt: `Use these equivalents: 1 gallon = 4 quarts, 1 quart = 2 pints, 1 pint = 2 cups. A cooler holds ${q} gallons of water. How many ${m.target} of water is that?`,
        answer: String(answer),
        hint: `Change ${v} gallons to quarts first: each gallon is 4 quarts, so multiply ${v} by 4. Then continue down the chart one unit at a time.`,
        explanation: [
          `Gallons to quarts: $${v}\\times4=${quarts}$ quarts.`,
          `Quarts to pints: $${quarts}\\times2=${pints}$ pints.`,
          m.target === "pints"
            ? `The cooler holds ${pints} pints.`
            : `Pints to cups: $${pints}\\times2=${cups}$ cups. The cooler holds ${cups} cups.`,
        ],
        label: `Answer (${m.target})`,
      });
    }
    if (m.kind === "length-recalled") {
      const inches = (m.quarters * 198) / 4;
      return numberSurface({
        prompt: `A rod is a unit of length equal to 5.5 yards. How many inches long is ${q} rods?`,
        answer: String(inches),
        hint: `Change ${v} rods to yards first: each rod is 5.5 yards, so multiply ${v} by 5.5. Then use the number of feet in a yard and inches in a foot.`,
        explanation: [
          `Rods to yards: $${v}\\times5.5=${decimalText(m.quarters * 11, 8)}$ yards.`,
          `Yards to feet, with 3 feet in a yard: $${decimalText(m.quarters * 11, 8)}\\times3=${decimalText(m.quarters * 33, 8)}$ feet.`,
          `Feet to inches, with 12 inches in a foot: $${decimalText(m.quarters * 33, 8)}\\times12=${inches}$ inches.`,
          `${q.startsWith("$") ? v : q} rods is ${inches} inches long.`,
        ],
        label: "Answer (inches)",
      });
    }
    const cm = m.quarters * 25;
    const pieces = Math.floor(cm / m.piece);
    const used = pieces * m.piece;
    return numberSurface({
      prompt: `A ribbon is ${q} meters long. Each bow uses ${m.piece} centimeters of ribbon. How many whole bows can be made?`,
      answer: String(pieces),
      hint: `The length and the piece use different units. Change ${v} meters to centimeters first: 1 meter is 100 centimeters, so multiply ${v} by 100.`,
      explanation: [
        `Meters to centimeters: $${v}\\times100=${cm}$ centimeters.`,
        `Divide by the length of one bow: $${cm}\\div${m.piece}$ gives ${pieces} whole bows with a remainder of ${cm - used}.`,
        `Check: ${pieces} bows use $${pieces}\\times${m.piece}=${used}$ centimeters, and ${cm - used} is less than the ${m.piece} centimeters another bow needs. ${pieces} whole bows can be made.`,
      ],
      label: "Answer (bows)",
    });
  },
});

export const conversionChainTemplates = [conversionChainTemplate] as const;
export const conversionChainGenerate = dispatch(conversionChainTemplates, {
  "conversion-chain-story": (seed) => conversionChain.generate(seed).problem,
});
