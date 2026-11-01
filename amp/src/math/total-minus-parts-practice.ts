import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  decimalText,
  dispatch,
  gcd,
  numberSurface,
  pick,
} from "./chain-kit";

export const bagTotalsTemplate: TemplateMetadata = {
  id: "bag-totals-chain",
  version: 1,
  title: "Add two totals, then take away a part",
  skillId: "add-subtract-thousands",
  gradeBand: "3–5",
  difficultyOffset: 0.4,
  description:
    "Add two three-digit totals and subtract a third amount, or subtract the sum of two parts from a total, with regrouping.",
};
export const fractionTotalMinusPartsTemplate: TemplateMetadata = {
  id: "fraction-total-minus-parts",
  version: 1,
  title: "Subtract the sum of two measures from a total",
  skillId: "fraction-addition",
  gradeBand: "3–5",
  difficultyOffset: 0.55,
  description:
    "Add two measures given as mixed numbers with unlike denominators, or as a fraction and a decimal, and subtract the sum from a total.",
};

/* ---------------------------------------------------------- whole numbers */
const bagAxes = {
  shape: defineAxis("shape", [
    "add-then-subtract",
    "subtract-the-sum",
  ] as const),
};
interface BagModel {
  a: number;
  b: number;
  c: number;
  total: number;
  context: number;
}
const bagStories = [
  { thing: "beads", holder: "bags", a: "red", b: "blue", rest: "yellow" },
  { thing: "stickers", holder: "sheets", a: "star", b: "heart", rest: "moon" },
  { thing: "marbles", holder: "jars", a: "green", b: "clear", rest: "striped" },
] as const;
function bagModel(r: (lo: number, hi: number) => number): BagModel {
  for (let tries = 0; tries < 200; tries++) {
    const a = r(120, 480);
    const b = r(120, 480);
    const c = r(100, 400);
    if (c >= a + b || (a % 10) + (b % 10) < 10) continue; // force regrouping
    const total = a + b + r(30, 250);
    return { a, b, c, total, context: r(0, bagStories.length - 1) };
  }
  throw new Error("Need three retries");
}
export const bagTotals = chainFamily({
  template: bagTotalsTemplate,
  axes: bagAxes,
  model: bagModel,
  variant: (m) => `bags-${m.context}`,
  render: (m, ax) => {
    const s = bagStories[m.context]!;
    if (ax.shape === "add-then-subtract") {
      const sum = m.a + m.b;
      return numberSurface({
        prompt: `One of the ${s.holder} holds ${m.a} ${s.thing} and another holds ${m.b} ${s.thing}. Nia pours both ${s.holder} out together and sets aside ${m.c} of the ${s.thing} that are broken. How many ${s.thing} are not set aside?`,
        answer: String(sum - m.c),
        hint: `Add the two totals first: ${m.a} + ${m.b}. The ${m.c} that are set aside come off that sum.`,
        explanation: [
          `Both ${s.holder} are poured out together, so first add them to find the whole amount.`,
          `$${m.a}+${m.b}=${sum}$ ${s.thing} in all.`,
          `${m.c} of those are set aside, so take them away from the whole: $${sum}-${m.c}=${sum - m.c}$.`,
          `Check: $${sum - m.c}+${m.c}=${sum}$.`,
          `${sum - m.c} ${s.thing} are not set aside.`,
        ],
        label: `Answer (${s.thing})`,
      });
    }
    const sum = m.a + m.b;
    return numberSurface({
      prompt: `A collection has ${m.total} ${s.thing}. ${m.a} are ${s.a} and ${m.b} are ${s.b}. The rest are ${s.rest}. How many ${s.thing} are ${s.rest}?`,
      answer: String(m.total - sum),
      hint: `The ${s.a} and ${s.b} ${s.thing} are both taken out of the ${m.total}. Add ${m.a} and ${m.b} first to see how many that is.`,
      explanation: [
        `The whole collection is made of three parts. Two parts are known, and the ${s.rest} ${s.thing} are the missing part.`,
        `Add the known parts: $${m.a}+${m.b}=${sum}$.`,
        `The missing part is the whole minus the known parts: $${m.total}-${sum}=${m.total - sum}$.`,
        `Check: $${sum}+${m.total - sum}=${m.total}$.`,
        `${m.total - sum} ${s.thing} are ${s.rest}.`,
      ],
      label: `Answer (${s.thing})`,
    });
  },
});

/* --------------------------------------------------------------- fractions */
const fractionAxes = {
  quantities: defineAxis("quantities", [
    "mixed-unlike",
    "fraction-decimal",
  ] as const),
};
interface FractionModel {
  mixed: boolean;
  /** mixed: sixteenths. fraction-decimal: hundredths. */
  total: number;
  a: number;
  b: number;
  aDenominator: number;
  context: number;
}
const trails = [
  {
    thing: "A hiking trail",
    measure: "miles",
    one: "mile",
    legs: (x: string, y: string) =>
      `The first part measures ${x} and the second part measures ${y}`,
  },
  {
    thing: "A roll of ribbon",
    measure: "yards",
    one: "yard",
    legs: (x: string, y: string) =>
      `One piece measures ${x} and another piece measures ${y}`,
  },
  {
    thing: "A water jug",
    measure: "gallons",
    one: "gallon",
    legs: (x: string, y: string) => `Dev uses ${x} and Ana uses ${y}`,
  },
] as const;
function fractionModel(
  r: (lo: number, hi: number) => number,
  ax: { quantities: "mixed-unlike" | "fraction-decimal" },
): FractionModel {
  if (ax.quantities === "mixed-unlike") {
    const aDen = 8;
    const k = 2 * r(0, 3) + 1; // an odd number of eighths
    const a = 16 * r(1, 3) + 2 * k; // eighths in sixteenths
    const b = 16 * r(1, 3) + r(1, 15);
    if (b % 2 === 0) throw new Error("Need three retries");
    const total = a + b + 16 * r(1, 3) + r(1, 15);
    return {
      mixed: true,
      total,
      a,
      b,
      aDenominator: aDen,
      context: r(0, trails.length - 1),
    };
  }
  const den = pick(r, [2, 4, 5, 10, 20] as const);
  const a = (100 / den) * r(1, den - 1); // hundredths
  const b = r(11, 95);
  const total = 100 * r(2, 6) + 5 * r(1, 19);
  if (a + b >= total) throw new Error("Need three retries");
  return {
    mixed: false,
    total,
    a,
    b,
    aDenominator: den,
    context: r(0, trails.length - 1),
  };
}
const mixedTex = (sixteenths: number) => {
  const whole = Math.floor(sixteenths / 16);
  const rest = sixteenths % 16;
  const g = gcd(rest, 16) || 16;
  const frac = rest ? `\\frac{${rest / g}}{${16 / g}}` : "";
  return `$${whole ? whole : ""}${frac || (whole ? "" : "0")}$`;
};
export const fractionTotalMinusParts = chainFamily({
  template: fractionTotalMinusPartsTemplate,
  axes: fractionAxes,
  model: fractionModel,
  variant: (m) => (m.mixed ? "mixed-unlike" : "fraction-decimal"),
  render: (m) => {
    const t = trails[m.context]!;
    if (m.mixed) {
      const sum = m.a + m.b;
      const left = m.total - sum;
      const g = gcd(left, 16) || 16;
      const answer =
        left % 16 === 0 ? String(left / 16) : `${left / g}/${16 / g}`;
      return numberSurface({
        prompt: `${t.thing} measures ${mixedTex(m.total)} ${t.measure} in all. ${t.legs(`${mixedTex(m.a)} ${t.measure}`, `${mixedTex(m.b)} ${t.measure}`)}. How many ${t.measure} remain? Enter the answer as an improper fraction, a decimal or a whole number.`,
        answer,
        hint: `Add ${mixedTex(m.a)} and ${mixedTex(m.b)} first. Rewrite the eighths as sixteenths so the two measures have the same denominator.`,
        explanation: [
          `Mixed numbers with different denominators (bottom numbers) are easier to work with as sixteenths, the smallest piece here.`,
          `Rewrite each measure as an improper fraction (a fraction with the top larger than the bottom) with denominator 16: ${mixedTex(m.a)} is $${m.a}/16$ and ${mixedTex(m.b)} is $${m.b}/16$.`,
          `The two measures total $${m.a}/16+${m.b}/16=${sum}/16$, which is ${mixedTex(sum)}.`,
          `What remains is the total minus what was used. The total ${mixedTex(m.total)} is $${m.total}/16$, so $${m.total}/16-${sum}/16=${left}/16$.`,
          left % 16 === 0
            ? `The amount left is ${answer} ${t.measure}.`
            : `The amount left is ${mixedTex(left)} ${t.measure}. As an improper fraction, that is $${answer}$.`,
        ],
        fraction: true,
      });
    }
    const hundredths = (v: number) => decimalText(v, 100);
    const fractionText = `$\\frac{${m.a / (100 / m.aDenominator)}}{${m.aDenominator}}$`;
    const aDecimal = hundredths(m.a);
    const left = m.total - m.a - m.b;
    return numberSurface({
      prompt: `${t.thing} measures ${hundredths(m.total)} ${t.measure} in all. ${t.legs(`${fractionText} ${t.one}`, `${hundredths(m.b)} ${t.measure}`)}. How many ${t.measure} remain? Enter the answer as a decimal.`,
      answer: hundredths(left),
      hint: `Write ${fractionText} as a decimal first: divide ${m.a / (100 / m.aDenominator)} by ${m.aDenominator}. Then both measures are decimals you can add.`,
      explanation: [
        `One measure is a fraction and the other is a decimal. Write both as decimals so they can be added.`,
        `A fraction bar means divide, so ${fractionText} written as a decimal is $${aDecimal}$.`,
        `Add the two parts, lining up the decimal points: $${aDecimal}+${hundredths(m.b)}=${hundredths(m.a + m.b)}$.`,
        `What remains is the total minus the two parts: $${hundredths(m.total)}-${hundredths(m.a + m.b)}=${hundredths(left)}$.`,
        `The amount left is ${hundredths(left)} ${t.measure}.`,
      ],
    });
  },
});
export const totalMinusPartsTemplates = [
  bagTotalsTemplate,
  fractionTotalMinusPartsTemplate,
] as const;
export const totalMinusPartsGenerate = dispatch(totalMinusPartsTemplates, {
  "bag-totals-chain": (seed) => bagTotals.generate(seed).problem,
  "fraction-total-minus-parts": (seed) =>
    fractionTotalMinusParts.generate(seed).problem,
});
