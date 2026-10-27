import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { par, roundText } from "./regents-kit";

export const arithmeticDistantTermTemplate: TemplateMetadata = {
  id: "arithmetic-distant-term",
  version: 1,
  title: "Find a distant term of an arithmetic sequence from its listed terms",
  skillId: "arithmetic-sequences",
  gradeBand: "9–12",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Read the common difference from the first four listed terms of an increasing or decreasing arithmetic sequence with whole-number or one-decimal terms, then choose a term between the 15th and the 30th.",
};
export const geometricSignedTermTemplate: TemplateMetadata = {
  id: "geometric-signed-term",
  version: 1,
  title:
    "Find a term of a geometric sequence with a negative ratio or first term",
  skillId: "geometric-sequences",
  gradeBand: "9–12",
  difficultyOffset: 0.3,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Find the common ratio of a geometric sequence whose terms alternate in sign or are all negative, from listed terms or from the first term and ratio, then choose the fourth, fifth or sixth term.",
};

/* ------------------------------------------------ arithmetic distant term */
const arithmeticAxes = {
  domain: defineAxis("domain", ["whole", "decimal"] as const),
};
interface ArithmeticModel {
  tenths: boolean;
  /** first term and difference, in tenths when `tenths`. */
  a1: number;
  d: number;
  n: number;
}
function arithmeticModel(
  r: (lo: number, hi: number) => number,
  axes: { domain: "whole" | "decimal" },
): ArithmeticModel {
  const tenths = axes.domain === "decimal";
  const sign = r(0, 1) ? 1 : -1;
  const d = sign * r(2, 9);
  const a1 = tenths ? r(-30, 60) : r(-15, 40);
  return { tenths, a1, d, n: r(15, 30) };
}
export const arithmeticDistantTerm = chainFamily({
  template: arithmeticDistantTermTemplate,
  axes: arithmeticAxes,
  model: arithmeticModel,
  variant: (m) =>
    `${m.d > 0 ? "increasing" : "decreasing"}-${m.tenths ? "decimal" : "whole"}`,
  render: (m, _a, r) => {
    const f = (v: number) => (m.tenths ? roundText(v / 10, 1) : String(v));
    const term = (k: number) => m.a1 + (k - 1) * m.d;
    const list = [1, 2, 3, 4].map((k) => f(term(k))).join(", ");
    const label = (v: number) => `$${f(v)}$`;
    const steps = m.n - 1;
    return choiceSurface(r, {
      prompt: `The first four terms of an arithmetic sequence are $${list}, \\dots$. What is the ${m.n}th term, $a_{${m.n}}$?`,
      options: [
        { label: label(term(m.n)), correct: true },
        {
          label: label(m.a1 + m.n * m.d),
          feedback: `Reaching term ${m.n} from term 1 takes ${steps} steps of the common difference, not ${m.n}.`,
        },
        {
          label: label(m.a1 + (m.n - 2) * m.d),
          feedback: `Term ${m.n} is ${steps} steps after term 1; this uses one step too few.`,
        },
        {
          label: label(m.a1 - steps * m.d),
          feedback: `The terms ${m.d > 0 ? "increase" : "decrease"} from term to term, so the steps move away from $${f(m.a1)}$ in that direction.`,
        },
        {
          label: label(m.n * m.d),
          feedback: `The sequence starts at $${f(m.a1)}$. Multiplying the position by the difference leaves out that starting value.`,
        },
      ],
      hint: `Subtract neighbouring terms, $${f(term(2))}-${par(f(term(1)))}$, to find the common difference. Then count how many steps lead from term 1 to term ${m.n}.`,
      explanation: [
        `The common difference is $${f(term(2))}-${par(f(term(1)))}=${f(m.d)}$, and the later differences agree.`,
        `Term ${m.n} is ${steps} steps after term 1: $a_{${m.n}}=a_1+${steps}d=${f(m.a1)}+${steps}\\cdot${par(f(m.d))}$.`,
        `$${steps}\\cdot${par(f(m.d))}=${f(steps * m.d)}$, so $a_{${m.n}}=${f(term(m.n))}$.`,
      ],
    });
  },
});

/* ------------------------------------------------- geometric signed term */
const geometricAxes = {
  given: defineAxis("given", ["listed-terms", "first-and-rule"] as const),
};
interface GeometricModel {
  a1: number;
  ratio: number;
  k: number;
}
function geometricModel(r: (lo: number, hi: number) => number): GeometricModel {
  const kind = r(0, 3); // 0,1: negative first term and ratio; 2: positive first term; 3: positive ratio
  const mag = r(1, 5);
  const ratioMag = pick(r, [2, 3, 4] as const);
  return {
    a1: kind === 2 ? mag : -mag,
    ratio: kind === 3 ? ratioMag : -ratioMag,
    k: r(4, 6),
  };
}
export const geometricSignedTerm = chainFamily({
  template: geometricSignedTermTemplate,
  axes: geometricAxes,
  model: geometricModel,
  variant: (m) =>
    m.ratio > 0
      ? "negative-terms"
      : m.a1 < 0
        ? "negative-first-and-ratio"
        : "positive-first-negative-ratio",
  render: (m, a, r) => {
    const term = (j: number) => m.a1 * m.ratio ** (j - 1);
    const correct = term(m.k);
    const label = (v: number) => `$${v}$`;
    const listed = a.given === "listed-terms";
    const given = listed
      ? `The first three terms of a geometric sequence are $${term(1)}, ${term(2)}, ${term(3)}, \\dots$.`
      : `A geometric sequence has first term $a_1=${m.a1}$, and each term is $${m.ratio}$ times the term before it.`;
    const power = m.k - 1;
    return choiceSurface(r, {
      prompt: `${given} What is the term $a_{${m.k}}$?`,
      options: [
        { label: label(correct), correct: true },
        {
          label: label(m.a1 * m.ratio ** m.k),
          feedback: `Term ${m.k} multiplies the first term by the ratio ${power} times, not ${m.k} times.`,
        },
        {
          label: label(-correct),
          feedback: `Track the sign: multiplying by $${m.ratio}$ ${m.ratio < 0 ? "flips" : "keeps"} the sign, and $a_1$ is ${m.a1 < 0 ? "negative" : "positive"}. After ${power} multiplications the term is ${correct < 0 ? "negative" : "positive"}.`,
        },
        {
          label: label(m.a1 + power * m.ratio),
          feedback:
            "A geometric sequence multiplies by the ratio at each step; adding the ratio treats it as an arithmetic sequence.",
        },
        {
          label: label(m.a1 * m.ratio * power),
          feedback: `The ratio is applied ${power} times in a row, which is a power $${par(m.ratio)}^{${power}}$, not the product $${par(m.ratio)}\\cdot${power}$.`,
        },
      ],
      hint: listed
        ? `Divide neighbouring terms, $${term(2)}\\div${par(term(1))}$, to find the ratio. Then multiply $a_1=${term(1)}$ by it once for each step up to term ${m.k}.`
        : `Starting from $a_1=${m.a1}$, each step multiplies by $${m.ratio}$. Count how many steps lead from term 1 to term ${m.k}, and track the sign as you go.`,
      explanation: [
        listed
          ? `The common ratio is $r=${term(2)}\\div${par(term(1))}=${m.ratio}$.`
          : `The common ratio is given as $r=${m.ratio}$.`,
        `Term ${m.k} is $a_1r^{${power}}=${m.a1}\\cdot${par(m.ratio)}^{${power}}$.`,
        `$${par(m.ratio)}^{${power}}=${m.ratio ** power}$, so $a_{${m.k}}=${m.a1}\\cdot${par(m.ratio ** power)}=${correct}$.`,
      ],
    });
  },
});

export const regentsSequenceTemplates = [
  arithmeticDistantTermTemplate,
  geometricSignedTermTemplate,
];
export const regentsSequenceGenerate = dispatch(regentsSequenceTemplates, {
  "arithmetic-distant-term": (seed) =>
    arithmeticDistantTerm.generate(seed).problem,
  "geometric-signed-term": (seed) => geometricSignedTerm.generate(seed).problem,
});
