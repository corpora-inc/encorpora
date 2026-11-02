import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const benchmarkEstimateTemplate: TemplateMetadata = {
  id: "benchmark-fraction-estimate",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Estimate with 0, one half and 1",
  skillId: "fraction-addition",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Round two fractions to the nearest of 0, one half and 1, then estimate their sum, their difference or the amount of a whole that is left after both are taken.",
};

/** Fractions within a tenth of a benchmark, grouped by that benchmark
 * (0, 1/2 and 1 written as twice the benchmark: 0, 1, 2). */
const pool: { n: number; d: number; bench2: 0 | 1 | 2 }[] = [
  { n: 1, d: 10, bench2: 0 },
  { n: 1, d: 9, bench2: 0 },
  { n: 1, d: 12, bench2: 0 },
  { n: 1, d: 11, bench2: 0 },
  { n: 3, d: 7, bench2: 1 },
  { n: 4, d: 9, bench2: 1 },
  { n: 5, d: 9, bench2: 1 },
  { n: 4, d: 7, bench2: 1 },
  { n: 5, d: 11, bench2: 1 },
  { n: 6, d: 11, bench2: 1 },
  { n: 5, d: 12, bench2: 1 },
  { n: 7, d: 12, bench2: 1 },
  { n: 8, d: 9, bench2: 2 },
  { n: 9, d: 10, bench2: 2 },
  { n: 10, d: 11, bench2: 2 },
  { n: 11, d: 12, bench2: 2 },
];
type Frac = (typeof pool)[number];
const value = (f: Frac) => f.n / f.d;
const tex = (f: Frac) => `$\\frac{${f.n}}{${f.d}}$`;
/** A number of halves as text: 0, 1/2, 1, 1 1/2, 2. A half-step value (0.5,
 * 1.5) is a quarter or three quarters, used only as a non-benchmark choice. */
const aboutLabel = (halves: number) =>
  halves === 0
    ? "About 0"
    : halves === 0.5
      ? "About $\\frac{1}{4}$"
      : halves === 1
        ? "About $\\frac{1}{2}$"
        : halves === 1.5
          ? "About $\\frac{3}{4}$"
          : halves === 2
            ? "About 1"
            : halves === 3
              ? "About $1\\frac{1}{2}$"
              : "About 2";
const benchName = (b2: number) =>
  b2 === 0 ? "0" : b2 === 1 ? "$\\frac{1}{2}$" : "1";

const axes = {
  ask: defineAxis("ask", ["sum", "difference", "left"] as const),
};
interface Model {
  ask: "sum" | "difference" | "left";
  x: Frac;
  y: Frac;
  /** The estimate in halves. */
  est: number;
  /** Which of the wordings of the question. */
  wording: number;
}
function model(
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"] },
): Model {
  const x = pick(r, pool);
  const y = pick(r, pool);
  if (x.n === y.n && x.d === y.d) throw new Error("Need three retries");
  let est: number;
  if (a.ask === "sum") est = x.bench2 + y.bench2;
  else if (a.ask === "difference") {
    if (value(x) <= value(y)) throw new Error("Need three retries");
    est = x.bench2 - y.bench2;
    if (est < 0) throw new Error("Need three retries");
  } else {
    if (value(x) + value(y) > 1) throw new Error("Need three retries");
    est = 2 - x.bench2 - y.bench2;
    if (est < 0) throw new Error("Need three retries");
  }
  return { ask: a.ask, x, y, est, wording: r(0, 2) };
}

const USE = "Use the benchmarks 0, $\\frac{1}{2}$ and 1";
const wordings = {
  sum: [
    (x: Frac, y: Frac) =>
      `A recipe uses ${tex(x)} cup of flour and ${tex(y)} cup of sugar. ${USE} to estimate about how many cups of flour and sugar it uses altogether.`,
    (x: Frac, y: Frac) =>
      `Ana walked ${tex(x)} mile to school and ${tex(y)} mile to the park. ${USE} to estimate about how many miles she walked altogether.`,
    (x: Frac, y: Frac) =>
      `One rope is ${tex(x)} meter long and another is ${tex(y)} meter long. ${USE} to estimate about how many meters long they are together.`,
  ],
  difference: [
    (x: Frac, y: Frac) =>
      `A board is ${tex(x)} meter long and a pipe is ${tex(y)} meter long. ${USE} to estimate about how many meters longer the board is.`,
    (x: Frac, y: Frac) =>
      `Omar ran ${tex(x)} mile and Lena ran ${tex(y)} mile. ${USE} to estimate about how many miles farther Omar ran.`,
    (x: Frac, y: Frac) =>
      `A jug holds ${tex(x)} liter and a bottle holds ${tex(y)} liter. ${USE} to estimate about how many liters more the jug holds.`,
  ],
  left: [
    (x: Frac, y: Frac) =>
      `A ribbon is cut: ${tex(x)} of it is used for a bow and ${tex(y)} of it for a card. ${USE} to estimate about how much of the ribbon is left.`,
    (x: Frac, y: Frac) =>
      `Two friends eat ${tex(x)} and ${tex(y)} of a pizza. ${USE} to estimate about how much of the pizza is left.`,
    (x: Frac, y: Frac) =>
      `A gardener plants ${tex(x)} of a garden with beans and ${tex(y)} of it with peas. ${USE} to estimate about how much of the garden is left.`,
  ],
} as const;

/** Each wording's closing sentence for an estimate of `a` (text) units;
 * `s` pluralizes the unit for amounts other than 1 or less. */
type Close = (a: string, s: string) => string;
const measures: Record<Model["ask"], readonly Close[]> = {
  sum: [
    (a, s) =>
      `The recipe uses about ${a} cup${s} of flour and sugar altogether.`,
    (a, s) => `Ana walked about ${a} mile${s} altogether.`,
    (a, s) => `The ropes are about ${a} meter${s} long together.`,
  ],
  difference: [
    (a, s) => `The board is about ${a} meter${s} longer than the pipe.`,
    (a, s) => `Omar ran about ${a} mile${s} farther than Lena.`,
    (a, s) => `The jug holds about ${a} liter${s} more than the bottle.`,
  ],
  left: [
    (a) => `About ${a} of the ribbon is left.`,
    (a) => `About ${a} of the pizza is left.`,
    (a) => `About ${a} of the garden is left.`,
  ],
};
/** Why a fraction is near its benchmark, from its own numerator and denominator. */
const nearWhy = (f: Frac) =>
  f.bench2 === 0
    ? `${tex(f)} is close to 0, because ${f.n} is tiny next to ${f.d}.`
    : f.bench2 === 1
      ? `${tex(f)} is close to $\\frac{1}{2}$, because ${f.n} is about half of ${f.d}.`
      : `${tex(f)} is close to 1, because ${f.n} is almost all of ${f.d}.`;

export const benchmarkEstimate = chainFamily({
  template: benchmarkEstimateTemplate,
  axes,
  model,
  variant: (m) => m.ask,
  render: (m, _a, r) => {
    const { x, y, est } = m;
    const prompt = wordings[m.ask][m.wording]!(x, y);
    // Options: the estimate and three other multiples of one half.
    const all =
      m.ask === "left"
        ? [0, 0.5, 1, 1.5, 2]
        : m.ask === "difference"
          ? [0, 1, 2, 3]
          : [0, 1, 2, 3, 4];
    const wrong = draw(
      r,
      all.filter((h) => h !== est),
      3,
    );
    const slip = (h: number) =>
      m.ask === "left" && h === x.bench2 + y.bench2
        ? "This is the amount that was used, not the amount that is left."
        : h % 1
          ? `${aboutLabel(h)} is not one of the benchmarks 0, $\\frac{1}{2}$ and 1, so it cannot come from rounding to them.`
          : `The benchmarks give ${aboutLabel(est).toLowerCase()}, not ${aboutLabel(h).toLowerCase()}.`;
    return choiceSurface(r, {
      prompt,
      options: [
        { label: aboutLabel(est), correct: true as const },
        ...wrong.map((h) => ({
          label: aboutLabel(h),
          feedback: `${slip(h)} Round ${tex(x)} to ${benchName(x.bench2)} and ${tex(y)} to ${benchName(y.bench2)} first, then ${m.ask === "sum" ? "add them" : m.ask === "difference" ? "subtract them" : "take their total away from 1"}.`,
        })),
      ],
      hint: `Round each fraction to the nearest of 0, $\\frac{1}{2}$ and 1. Start with ${tex(x)}: is it closest to 0, to $\\frac{1}{2}$ or to 1? Then do the same for ${tex(y)}.`,
      explanation: [
        `A benchmark is a friendly number to compare with. Round each fraction to the nearest of 1, $\\frac{1}{2}$ or 0, because those are quick to work with.`,
        nearWhy(x),
        nearWhy(y),
        m.ask === "sum"
          ? `Adding the benchmarks: ${benchName(x.bench2)} + ${benchName(y.bench2)} is ${aboutLabel(est).slice(6)}.`
          : m.ask === "difference"
            ? `Subtracting the benchmarks: ${benchName(x.bench2)} − ${benchName(y.bench2)} is ${aboutLabel(est).slice(6)}.`
            : `The two parts are about ${aboutLabel(x.bench2 + y.bench2).slice(6)} together, so what is left is 1 − ${aboutLabel(x.bench2 + y.bench2).slice(6)}, which is ${aboutLabel(est).slice(6)}.`,
        measures[m.ask][m.wording]!(
          aboutLabel(est).slice(6),
          est === 0 || est > 2 ? "s" : "",
        ),
      ],
    });
  },
});

export const benchmarkEstimateTemplates = [benchmarkEstimateTemplate] as const;
export const benchmarkEstimateGenerate = dispatch(benchmarkEstimateTemplates, {
  "benchmark-fraction-estimate": (seed) =>
    benchmarkEstimate.generate(seed).problem,
});
