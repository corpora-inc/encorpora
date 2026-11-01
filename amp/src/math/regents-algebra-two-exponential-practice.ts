import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { frac, par } from "./regents-kit";
import { gcd, roundDiv, withCommas } from "./regents-algebra-two-kit";

const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  choice = true,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  ...(choice
    ? { requiredResponseCapability: "single-choice-v1" as const }
    : {}),
  description,
});

export const geometricSeriesTotalTemplate = meta(
  "geometric-series-total",
  "Total of a finite geometric series with a fractional or percent ratio",
  "sequence-sums",
  0.5,
  "Choose the sum of the first several terms of a geometric sequence whose ratio is a fraction, or the rounded total of annual payments that each grow by a percent.",
);
export const commonBaseExponentialTemplate = meta(
  "common-base-exponential",
  "Solve an exponential equation by rewriting both sides in one base",
  "exponential-equations",
  0.35,
  "Rewrite two different powers of one base (such as 27 and 9) as powers of that base, equate the exponents and solve the linear equation.",
);
export const exponentialParameterLogTemplate = meta(
  "exponential-parameter-log",
  "Solve a base-10 exponential equation with a coefficient for the variable",
  "exponential-equations",
  0.5,
  "Divide out a coefficient or a multiplier of the exponent, then take the base-10 logarithm to choose the solution, with symbolic or numeric parameters.",
);
export const exponentialTargetTimeTemplate = meta(
  "exponential-target-time",
  "Time for an exponential model to reach a target value",
  "exponential-models",
  0.55,
  "Solve $A\\,b^t=T$ or $A\\,e^{rt}=T$ for $t$ with logarithms and a calculator, rounded to the nearest hundredth.",
  false,
);
export const growthModelRewriteTemplate = meta(
  "growth-model-rewrite",
  "Choose a monthly growth form or a half-life decay model",
  "exponential-models",
  0.5,
  "Rewrite an annual growth or decay factor as a monthly factor raised to $12t$, or choose the decay model from a half-life in hours.",
);
export const depreciationRecursionTemplate = meta(
  "depreciation-recursion",
  "Choose the recursive rule for a percent change each year",
  "geometric-sequences",
  0.4,
  "Convert a percent lost each year into a common ratio and choose the recursive rule with its starting value.",
);
export const nonlinearRecursionTemplate = meta(
  "nonlinear-recursion-term",
  "Find a term of a sequence defined by a nonlinear recursive rule",
  "arithmetic-sequences",
  0.3,
  "Apply a recursive rule that squares the previous term and adds or subtracts a constant, one term at a time, and enter the requested term.",
  false,
);

const tex = (s: string) => `$${s}$`;

/* ----------------------------------------------- geometric series total */
const seriesAxes = {
  context: defineAxis("context", ["fraction-ratio", "percent-growth"] as const),
};
interface SeriesModel {
  kind: "fraction-ratio" | "percent-growth";
  a: number; // first term, or first payment in dollars
  p: number; // numerator of ratio, or growth percent
  q: number; // denominator of ratio
  n: number;
}
function seriesModel(
  r: (lo: number, hi: number) => number,
  ax: { context: SeriesModel["kind"] },
): SeriesModel {
  if (ax.context === "fraction-ratio") {
    const [p, q] = pick(r, [
      [2, 3],
      [3, 4],
      [3, 5],
      [4, 5],
      [5, 6],
      [1, 3],
    ] as const);
    const a = pick(r, [1, 2, 3, 4, 5, 6, 8, 10, 12] as const);
    const n = r(4, 6);
    const num = a * (q ** n - p ** n);
    const den = q ** (n - 1) * (q - p);
    if (den / gcd(num, den) === 1) throw new Error("Need three retries");
    return { kind: ax.context, a, p, q, n };
  }
  const m: SeriesModel = {
    kind: ax.context,
    a: 50 * r(10, 60),
    p: pick(r, [3, 4, 5, 6, 8] as const),
    q: 100,
    n: r(5, 8),
  };
  if (!roundedTotal(m.a, m.p, m.n).clear) throw new Error("Need three retries");
  return m;
}
/** Total of n payments, first payment a dollars, each p% larger than the last. */
function roundedTotal(a: number, p: number, n: number) {
  const hi = BigInt(100 + p);
  const num = BigInt(a) * (hi ** BigInt(n) - 100n ** BigInt(n));
  const den = BigInt(p) * 100n ** BigInt(n - 1);
  return roundDiv(num, den);
}
function lastPayment(a: number, p: number, k: number) {
  return roundDiv(BigInt(a) * BigInt(100 + p) ** BigInt(k), 100n ** BigInt(k));
}
export const geometricSeriesTotal = chainFamily({
  template: geometricSeriesTotalTemplate,
  axes: seriesAxes,
  model: seriesModel,
  variant: (m) => m.kind,
  render: (m, _a, r) => {
    if (m.kind === "fraction-ratio") {
      const sumTo = (k: number, a = m.a, p = m.p, q = m.q) =>
        frac(a * (q ** k - p ** k), q ** (k - 1) * (q - p));
      const label = (s: string) => tex(s);
      const ratio = `\\frac{${m.p}}{${m.q}}`;
      return choiceSurface(r, {
        prompt: `A geometric sequence has first term $a_1=${m.a}$ and common ratio $r=${ratio}$. What is the sum of its first ${m.n} terms, $S_{${m.n}}$?`,
        options: [
          { label: label(sumTo(m.n)), correct: true },
          {
            label: label(sumTo(m.n - 1)),
            feedback: `That is the sum of only ${m.n - 1} terms. The power of $r$ in the formula matches the number of terms, ${m.n}.`,
          },
          {
            label: label(frac(m.a * (m.q ** m.n - m.p ** m.n), m.q ** m.n)),
            feedback:
              "The formula divides $a_1(1-r^n)$ by $1-r$. This answer leaves out that division.",
          },
          {
            label: label(frac(m.a * m.q, m.q - m.p)),
            feedback:
              "That is the sum of infinitely many terms, $\\frac{a_1}{1-r}$. The question asks for a fixed number of terms, so keep the $r^n$ factor.",
          },
          {
            label: label(
              frac(
                m.a * (m.q ** m.n - m.p ** m.n),
                m.q ** (m.n - 1) * (m.q + m.p),
              ),
            ),
            feedback:
              "This divides by $1+r$. The formula divides by $1-r$, one minus the ratio, so check the sign in the denominator.",
          },
        ],
        hint: `Use $S_n=\\dfrac{a_1(1-r^n)}{1-r}$ with $a_1=${m.a}$, $r=${ratio}$ and $n=${m.n}$. Work out $r^{${m.n}}$ before you subtract it from 1.`,
        explanation: [
          `A geometric series adds terms that each multiply the one before by the same number, the common ratio $r$. Here $a_1=${m.a}$ is the first term and $r=${ratio}$.`,
          `The sum of the first $n$ terms is $S_n=\\dfrac{a_1(1-r^n)}{1-r}$. Multiplying the sum by $r$ shifts each term one place, and subtracting cancels all but two terms.`,
          `Work out the power first: $r^{${m.n}}=\\dfrac{${m.p ** m.n}}{${m.q ** m.n}}$. So $1-r^{${m.n}}=\\dfrac{${m.q ** m.n - m.p ** m.n}}{${m.q ** m.n}}$.`,
          `The denominator is $1-r=\\dfrac{${m.q - m.p}}{${m.q}}$. Dividing by it is the same as multiplying by its flip, $\\dfrac{${m.q}}{${m.q - m.p}}$.`,
          `$S_{${m.n}}=${m.a}\\cdot\\dfrac{${m.q ** m.n - m.p ** m.n}}{${m.q ** m.n}}\\cdot\\dfrac{${m.q}}{${m.q - m.p}}=${sumTo(m.n)}$.`,
          `The sum of the first ${m.n} terms is $${sumTo(m.n)}$.`,
        ],
      });
    }
    const total = roundedTotal(m.a, m.p, m.n).value;
    const lbl = (v: bigint) => `${withCommas(v)} dollars`;
    const factor = (1 + m.p / 100).toFixed(2);
    return choiceSurface(r, {
      prompt: `A fund receives yearly payments. The first payment is ${withCommas(m.a)} dollars and each payment is ${m.p}% larger than the one before it. To the nearest dollar, what is the total of the first ${m.n} payments?`,
      options: [
        { label: lbl(total), correct: true },
        {
          label: lbl(roundedTotal(m.a, m.p, m.n - 1).value),
          feedback: `This is one term short: it adds only ${m.n - 1} payments. Use all ${m.n}, so the power of the growth factor is ${m.n}.`,
        },
        {
          label: lbl(roundedTotal(m.a, m.p, m.n + 1).value),
          feedback: `This is one term too many: it adds ${m.n + 1} payments. The exponent in the formula equals the number of payments, ${m.n}.`,
        },
        {
          label: lbl(lastPayment(m.a, m.p, m.n - 1).value),
          feedback: `This is the size of payment number ${m.n} alone, the last term. The question asks for the total of all ${m.n} payments.`,
        },
        {
          label: lbl(BigInt(m.a * m.n)),
          feedback:
            "This treats every payment as equal to the first. Each payment is larger than the one before, so the total is more than the first payment times the number of payments.",
        },
      ],
      hint: `A ${m.p}% increase multiplies each payment by ${factor}, so the payments form a geometric sequence with $a_1=${m.a}$ and $r=${factor}$. Add the first ${m.n} terms with the series formula.`,
      explanation: [
        `Each payment is ${m.p}% larger than the one before. That keeps 100% and adds ${m.p}%, so each payment is the last one times $${factor}$.`,
        `Payments that multiply by the same number form a geometric sequence. The first term is $a_1=${m.a}$ and the common ratio is $r=${factor}$.`,
        `The total of the first $n$ terms is $S_n=\\dfrac{a_1(r^n-1)}{r-1}$. Multiplying the total by $r$ shifts each payment one place, and subtracting cancels all but two terms.`,
        `Substitute: $S_{${m.n}}=\\dfrac{${m.a}(${factor}^{${m.n}}-1)}{${factor}-1}=\\dfrac{${m.a}(${factor}^{${m.n}}-1)}{${(m.p / 100).toFixed(2)}}$.`,
        `Use a calculator and round only at the end. The first ${m.n} payments total ${lbl(total)}, to the nearest dollar.`,
      ],
    });
  },
});

/* ------------------------------------------------ common-base exponential */
const baseTable: [number, number[]][] = [
  [2, [4, 8, 16, 32]],
  [3, [9, 27, 81]],
  [5, [25, 125]],
];
interface CommonBaseModel {
  base: number;
  pL: number;
  pR: number;
  bL: number; // left exponent: x + cL (coefficient 1) or aL x + cL
  aL: number;
  cL: number;
  aR: number;
  cR: number;
  x: number;
}
function commonBaseModel(
  r: (lo: number, hi: number) => number,
): CommonBaseModel {
  for (let t = 0; t < 400; t++) {
    const [b, powers] = pick(r, baseTable);
    const big = pick(r, powers);
    const small = pick(r, powers);
    if (big === small) continue;
    const pL = Math.round(Math.log(big) / Math.log(b));
    const pR = Math.round(Math.log(small) / Math.log(b));
    const aL = pick(r, [1, 1, 2] as const);
    const cL = r(-3, 3);
    const aR = pick(r, [1, 2, 3] as const);
    const cR = r(-4, 6);
    // pL(aL x + cL) = pR(aR x + cR)
    const den = pL * aL - pR * aR;
    const numr = pR * cR - pL * cL;
    if (den === 0 || numr % den !== 0) continue;
    const x = numr / den;
    if (x === 0 || Math.abs(x) > 12) continue;
    return { base: b, pL, pR, bL: big, aL, cL, aR, cR, x };
  }
  throw new Error("Need three retries");
}
const expText = (a: number, c: number) =>
  `${a === 1 ? "" : a}x${c === 0 ? "" : c < 0 ? ` - ${-c}` : ` + ${c}`}`;
export const commonBaseExponential = chainFamily({
  template: commonBaseExponentialTemplate,
  axes: {
    order: defineAxis("order", ["bigger-left", "smaller-left"] as const),
  },
  model: commonBaseModel,
  variant: (m) => `base-${m.base}`,
  render: (m, ax, r) => {
    const big = m.base ** m.pL;
    const small = m.base ** m.pR;
    const left = `${big}^{${expText(m.aL, m.cL)}}`;
    const right = `${small}^{${expText(m.aR, m.cR)}}`;
    const swap = ax.order === "smaller-left";
    // Draw the equation the same way for both orders by swapping the sides.
    const eq = swap ? `${right}=${left}` : `${left}=${right}`;
    const wrongSum = (m.cR - m.cL) / (m.aL - m.aR);
    return choiceSurface(r, {
      prompt: `Solve for $x$: $${eq}$`,
      options: [
        { label: `$x=${m.x}$`, correct: true },
        ...(Number.isInteger(wrongSum) && wrongSum !== m.x
          ? [
              {
                label: `$x=${wrongSum}$`,
                feedback: `This sets the exponents equal while the bases still differ. That only works when both sides use the same base. Here $${big}$ and $${small}$ are different powers of ${m.base}, so first rewrite both as powers of ${m.base}.`,
              },
            ]
          : []),
        {
          label: `$x=${-m.x}$`,
          feedback: `This has the wrong sign, which often comes from moving a term across the equals sign without changing its sign. Substitute $x=${-m.x}$ into $${m.pL}(${expText(m.aL, m.cL)})=${m.pR}(${expText(m.aR, m.cR)})$: the two sides differ.`,
        },
        {
          label: `$x=${m.x + 1}$`,
          feedback: `This is off by one, a slip in the last step. Substitute $x=${m.x + 1}$ into $${m.pL}(${expText(m.aL, m.cL)})=${m.pR}(${expText(m.aR, m.cR)})$: the two exponents are not equal.`,
        },
        {
          label: `$x=${m.x - 1}$`,
          feedback: `This is off by one, a slip in the last step. Substitute $x=${m.x - 1}$ into $${m.pL}(${expText(m.aL, m.cL)})=${m.pR}(${expText(m.aR, m.cR)})$: the two exponents are not equal.`,
        },
        ...((m.pR * m.cR - m.pL * m.cL) % (m.pL * m.aL + m.pR * m.aR) === 0
          ? [
              {
                label: `$x=${(m.pR * m.cR - m.pL * m.cL) / (m.pL * m.aL + m.pR * m.aR)}$`,
                feedback: `This adds the $x$ terms when moving them to one side. Moving a term across the equals sign changes its sign, so subtract instead.`,
              },
            ]
          : []),
      ],
      hint: `Write both ${big} and ${small} as powers of ${m.base}: $${big}=${m.base}^{${m.pL}}$ and $${small}=${m.base}^{${m.pR}}$. Then multiply each exponent by that power.`,
      explanation: [
        `The unknown $x$ is in the exponents, the small raised numbers. To compare exponents, both sides need the same base, the number being raised to a power.`,
        `${big} and ${small} are both powers of ${m.base}: $${big}=${m.base}^{${m.pL}}$ and $${small}=${m.base}^{${m.pR}}$.`,
        `A power of a power multiplies the exponents. So $${left}$ becomes $${m.base}^{${m.pL}(${expText(m.aL, m.cL)})}$ and $${right}$ becomes $${m.base}^{${m.pR}(${expText(m.aR, m.cR)})}$.`,
        `Two powers of the same base are equal only when their exponents are equal: $${m.pL}(${expText(m.aL, m.cL)})=${m.pR}(${expText(m.aR, m.cR)})$.`,
        `Multiply out both brackets, move the $x$ terms to one side and the numbers to the other, then divide. This gives $x=${m.x}$.`,
        `Check: at $x=${m.x}$ both exponents equal ${m.pL * (m.aL * m.x + m.cL)}. The solution is $x=${m.x}$.`,
      ],
    });
  },
});

/* ----------------------------------------------- base-10 with parameters */
const paramAxes = {
  form: defineAxis("form", ["coefficient", "exponent-factor"] as const),
  values: defineAxis("values", ["symbolic", "numeric"] as const),
};
interface ParamModel {
  a: number;
  b: number;
  letters: [string, string];
}
function paramModel(r: (lo: number, hi: number) => number): ParamModel {
  const letters = pick(r, [
    ["a", "b"],
    ["c", "d"],
    ["k", "m"],
    ["p", "q"],
  ] as const);
  const a = r(2, 9);
  const mult = r(2, 12);
  // For 2 and 4, log(4)/2 and log(4/2) are the same number, so two choices
  // would both be correct.
  if (a === 2 && mult === 2) throw new Error("Need three retries");
  return { a, b: a * mult, letters: [letters[0], letters[1]] };
}
export const exponentialParameterLog = chainFamily({
  template: exponentialParameterLogTemplate,
  axes: paramAxes,
  model: paramModel,
  variant: (m) => (m.letters[0] === "a" ? "first-letters" : "other-letters"),
  render: (m, ax, r) => {
    const [A, B] = m.letters;
    const sym = ax.values === "symbolic";
    const ca = sym ? A : String(m.a);
    const cb = sym ? B : String(m.b);
    // Prose forms: letters are typeset, numbers are plain.
    const pa = sym ? `$${A}$` : ca;
    const pb = sym ? `$${B}$` : cb;
    const lead = sym
      ? `For positive constants $${A}$ and $${B}$, solve`
      : "Solve";
    if (ax.form === "coefficient") {
      const q = sym ? `\\frac{${B}}{${A}}` : String(m.b / m.a);
      return choiceSurface(r, {
        prompt: `${lead} $${ca}\\cdot10^{x}=${cb}$ for $x$. Which expression gives $x$?`,
        options: [
          { label: `$x=\\log\\left(${q}\\right)$`, correct: true },
          {
            label: `$x=\\dfrac{\\log ${cb}}{${ca}}$`,
            feedback: `This divides the log by ${pa}, as if ${pa} were in the exponent. But ${pa} multiplies $10^x$ from outside. Divide both sides by ${pa} first, then take the log.`,
          },
          {
            label: `$x=\\log ${cb}-${ca}$`,
            feedback: `This subtracts ${pa} after taking the log. Subtracting does not undo multiplying by ${pa}. Divide both sides by ${pa} before taking the log.`,
          },
          {
            label: `$x=\\log\\left(${cb}-${ca}\\right)$`,
            feedback: `This subtracts ${pa} inside the log. But ${pa} multiplies $10^x$, so undo it by dividing both sides by ${pa}.`,
          },
          {
            label: `$x=\\dfrac{\\log ${cb}}{\\log ${ca}}$`,
            feedback: `This treats ${pa} as the base of the power. Here the base is 10, and ${pa} is a multiplier in front.`,
          },
        ],
        hint: `The factor ${pa} multiplies $10^{x}$. Divide both sides of $${ca}\\cdot10^{x}=${cb}$ by ${pa} before you take a logarithm.`,
        explanation: [
          `The unknown $x$ is an exponent. First get the power $10^{x}$ alone on one side.`,
          `${sym ? pa : `The number ${pa}`} multiplies $10^{x}$, so divide both sides by ${pa}: $10^{x}=${q}$.`,
          `$\\log$ with no base written means base 10. It undoes a power of 10: $\\log 10^{x}=x$.`,
          `So take $\\log$ of both sides: $x=\\log\\left(${q}\\right)$.`,
          sym
            ? `A log needs a positive input. That holds because $${A}>0$ and $${B}>0$, so the quotient is positive.`
            : `A log needs a positive input, and ${m.b / m.a} is positive, so $x=\\log ${m.b / m.a}$ is defined.`,
          `So $x=\\log\\left(${q}\\right)$.`,
        ],
      });
    }
    return choiceSurface(r, {
      prompt: `${lead} $10^{${ca}x}=${cb}$ for $x$. Which expression gives $x$?`,
      options: [
        { label: `$x=\\dfrac{\\log ${cb}}{${ca}}$`, correct: true },
        {
          label: `$x=\\log\\left(\\dfrac{${cb}}{${ca}}\\right)$`,
          feedback: `This divides inside the log. But ${pa} multiplies $x$ in the exponent, so it comes out after the log: $${ca}x=\\log ${cb}$, then divide by ${pa}.`,
        },
        {
          label: `$x=${ca}\\log ${cb}$`,
          feedback: `This multiplies by ${pa} instead of dividing. $${ca}x=\\log ${cb}$ means $x$ is the log divided by ${pa}.`,
        },
        {
          label: `$x=\\log ${cb}-${ca}$`,
          feedback: `This subtracts ${pa}. But ${pa} multiplies $x$ in the exponent, so undo it by dividing, not subtracting.`,
        },
        {
          label: `$x=\\dfrac{\\log ${ca}}{\\log ${cb}}$`,
          feedback: `This treats ${pa} as a base. The base is 10, and $\\log 10^{k}=k$ leaves the exponent itself. So take the log of ${pb} only, then divide by ${pa}.`,
        },
      ],
      hint: `Take the base-10 logarithm of both sides of $10^{${ca}x}=${cb}$. The exponent $${ca}x$ comes down as it is, then divide by ${pa}.`,
      explanation: [
        `The unknown $x$ is in the exponent. $\\log$ with no base written means base 10, and it undoes a power of 10.`,
        `Take $\\log$ of both sides: $\\log 10^{${ca}x}=\\log ${cb}$.`,
        `$\\log 10^{k}=k$ for any exponent $k$, because $\\log$ asks "10 to what power?". So $${ca}x=\\log ${cb}$.`,
        `$${ca}x$ means ${pa} times $x$, so divide both sides by ${pa}: $x=\\dfrac{\\log ${cb}}{${ca}}$.`,
        `So $x=\\dfrac{\\log ${cb}}{${ca}}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ exponential target time */
const targetAxes = {
  model: defineAxis("model", ["base-b", "continuous"] as const),
  setting: defineAxis("setting", ["crowd", "bacteria", "savings"] as const),
};
interface TargetModel {
  a: number;
  b: number; // growth factor, or continuous rate in percent for "continuous"
  target: number;
  t: string;
}
function targetModel(
  r: (lo: number, hi: number) => number,
  ax: { model: "base-b" | "continuous" },
): TargetModel {
  const a = 10 * r(5, 60);
  const b =
    ax.model === "base-b"
      ? pick(r, [1.2, 1.35, 1.5, 1.8, 2.5, 1.07, 1.15] as const)
      : pick(r, [3, 4, 6, 8, 12, 15] as const);
  const target = a * r(2, 9) + 10 * r(0, 9);
  const raw =
    ax.model === "base-b"
      ? Math.log(target / a) / Math.log(b)
      : Math.log(target / a) / (b / 100);
  const scaled = raw * 100;
  if (
    Math.abs(scaled - Math.floor(scaled) - 0.5) < 0.08 ||
    raw < 0.3 ||
    raw > 60
  )
    throw new Error("Need three retries");
  return { a, b, target, t: (Math.round(scaled) / 100).toFixed(2) };
}
const settings = {
  crowd: { lead: "The number of people at a festival", unit: "hours" },
  bacteria: { lead: "The number of bacteria in a culture", unit: "hours" },
  savings: { lead: "The balance of an account, in dollars,", unit: "years" },
} as const;
export const exponentialTargetTime = chainFamily({
  template: exponentialTargetTimeTemplate,
  axes: targetAxes,
  model: targetModel,
  variant: (m) => (Number.isInteger(m.b) ? "continuous" : "base-b"),
  render: (m, ax) => {
    const s = settings[ax.setting];
    const rule =
      ax.model === "base-b"
        ? `N(t)=${m.a}\\cdot${m.b}^{t}`
        : `N(t)=${m.a}e^{${m.b / 100}t}`;
    const solve =
      ax.model === "base-b"
        ? `${m.b}^{t}=\\dfrac{${m.target}}{${m.a}}`
        : `e^{${m.b / 100}t}=\\dfrac{${m.target}}{${m.a}}`;
    return numberSurface({
      prompt: `${s.lead} is modeled by $${rule}$, where $t$ is in ${s.unit}. After how many ${s.unit} does the model reach ${m.target}? Round to the nearest hundredth.`,
      answer: m.t,
      label: `Answer (${s.unit}, nearest hundredth)`,
      hint: `Set the model equal to ${m.target} and divide both sides by ${m.a}, so the exponential part stands alone. Then use a logarithm to bring $t$ down.`,
      explanation: [
        `$N(t)$, read "$N$ of $t$", is the model's value after $t$ ${s.unit}. We want the $t$ that makes it ${m.target}, so set them equal: $${rule.replace("N(t)", String(m.target))}$.`,
        `${m.a} multiplies the power, so divide both sides by ${m.a}. That leaves the power alone: $${solve}$.`,
        ax.model === "base-b"
          ? `The unknown $t$ is an exponent. Take $\\ln$, the natural logarithm, of both sides. A log brings an exponent down in front: $t\\ln ${m.b}=\\ln(${m.target}/${m.a})$.`
          : `The unknown $t$ is an exponent. $e$ is a special number, about 2.718, and $\\ln$, the natural logarithm, undoes a power of $e$. Take $\\ln$ of both sides: $${m.b / 100}t=\\ln(${m.target}/${m.a})$.`,
        ax.model === "base-b"
          ? `Divide both sides by $\\ln ${m.b}$: $t=\\dfrac{\\ln(${m.target}/${m.a})}{\\ln ${m.b}}$.`
          : `Divide both sides by ${m.b / 100}: $t=\\dfrac{\\ln(${m.target}/${m.a})}{${m.b / 100}}$.`,
        `Use a calculator and round to the nearest hundredth. The model reaches ${m.target} after about ${m.t} ${s.unit}.`,
      ],
    });
  },
});

/* --------------------------------------------------- growth model rewrite */
const growthAxes = {
  kind: defineAxis("kind", ["monthly-from-annual", "half-life"] as const),
  direction: defineAxis("direction", ["growth", "decay"] as const),
};
interface GrowthModel {
  pct: number;
  hours: number;
  start: number;
}
function growthModel(r: (lo: number, hi: number) => number): GrowthModel {
  return {
    pct: r(2, 9),
    hours: pick(r, [3, 4, 5, 6, 8, 12, 14, 18, 24] as const),
    start: pick(r, [20, 40, 50, 80, 100, 120, 250, 400] as const),
  };
}
export const growthModelRewrite = chainFamily({
  template: growthModelRewriteTemplate,
  axes: growthAxes,
  model: growthModel,
  variant: (m) => "rewrite",
  render: (m, ax, r) => {
    if (ax.kind === "half-life") {
      const h = m.hours;
      const A = m.start;
      return choiceSurface(r, {
        prompt: `A sample of ${A} grams of a substance has a half-life of ${h} hours. Which function gives the number of grams $A(t)$ remaining after $t$ hours?`,
        options: [
          {
            label: `$A(t)=${A}\\left(\\dfrac12\\right)^{t/${h}}$`,
            correct: true,
          },
          {
            label: `$A(t)=${A}\\left(\\dfrac12\\right)^{${h}t}$`,
            feedback: `This multiplies $t$ by ${h} instead of dividing. The sample halves once every ${h} hours, so the exponent counts half-lives: $t/${h}$, not $${h}t$.`,
          },
          {
            label: `$A(t)=${A}\\left(\\dfrac1{${h}}\\right)^{t}$`,
            feedback: `This uses the half-life ${h} as if it were a fraction kept each hour. ${h} is a time. The substance keeps $\\frac12$ each half-life.`,
          },
          {
            label: `$A(t)=${A}\\left(1-\\dfrac12\\right)^{t}$`,
            feedback: `This halves the sample every hour, since $1-\\frac12=\\frac12$ and the exponent is $t$. The halving takes ${h} hours, so use $t/${h}$ as the exponent.`,
          },
          {
            label: `$A(t)=\\dfrac{${A}}{2}\\cdot${h}^{t}$`,
            feedback: `This grows instead of decaying. A decay model multiplies by a factor between 0 and 1, but $${h}^{t}$ gets larger as $t$ grows.`,
          },
        ],
        hint: `Every ${h} hours the ${A} grams are cut in half. Count how many half-lives have passed after $t$ hours, and use that count as the exponent of $\\frac12$.`,
        explanation: [
          `The half-life is the time it takes for half the substance to remain. Here it is ${h} hours.`,
          `So every ${h} hours the amount is multiplied by $\\frac12$. The start, at $t=0$, is ${A} grams.`,
          `To count half-lives, divide the time by ${h}. After $t$ hours, $\\dfrac{t}{${h}}$ half-lives have passed. For example, after ${2 * h} hours that is 2.`,
          `Multiplying by $\\frac12$ once per half-life gives the exponent $\\frac{t}{${h}}$. So $A(t)=${A}\\left(\\dfrac12\\right)^{t/${h}}$.`,
          `The function is $A(t)=${A}\\left(\\dfrac12\\right)^{t/${h}}$.`,
        ],
      });
    }
    const growth = ax.direction === "growth";
    const f = growth ? 1 + m.pct / 100 : 1 - m.pct / 100;
    const fs = f.toFixed(2);
    const P = m.start;
    return choiceSurface(r, {
      prompt: `The value $V(t)=${P}\\left(${fs}\\right)^{t}$ ${growth ? "grows" : "decays"} ${m.pct}% per year, where $t$ is in years. Which expression is equivalent and shows the monthly factor?`,
      options: [
        {
          label: `$V(t)=${P}\\left(${fs}^{1/12}\\right)^{12t}$`,
          correct: true,
        },
        {
          label: `$V(t)=${P}\\left(${growth ? "1+" : "1-"}\\dfrac{${(m.pct / 100).toFixed(2)}}{12}\\right)^{12t}$`,
          feedback:
            "This divides the yearly rate by 12. That gives a different, slightly larger, yearly change after 12 months. Split the yearly factor with a 12th root so that 12 months give the yearly factor exactly.",
        },
        {
          label: `$V(t)=${P}\\left(${fs}^{12}\\right)^{12t}$`,
          feedback:
            "This raises the yearly factor to the 12th power, which is the factor for 12 years. A month is a twelfth of a year, so the monthly factor is a 12th root of the yearly factor.",
        },
        {
          label: `$V(t)=${P}\\left(${fs}^{1/12}\\right)^{t}$`,
          feedback:
            "This applies the monthly factor only $t$ times. With $t$ in years there are $12t$ months, so the monthly factor must be applied $12t$ times.",
        },
        {
          label: `$V(t)=${P}\\left(\\dfrac{${fs}}{12}\\right)^{12t}$`,
          feedback:
            "This divides the yearly factor by 12. Factors combine by multiplying, so splitting one into 12 equal parts takes a 12th root, not division. Dividing makes the value shrink far too fast.",
        },
      ],
      hint: `One year multiplies by ${fs}, so one month multiplies by the number whose 12th power is ${fs}. Write that monthly factor and apply it for the number of months in $t$ years.`,
      explanation: [
        `The growth factor is the number the value is multiplied by each period. In one year it is ${fs}.`,
        `A year is 12 months, so 12 equal monthly factors must multiply to ${fs}. That number is the 12th root of ${fs}, written $${fs}^{1/12}$.`,
        `In $t$ years there are $12t$ months, so the monthly factor is applied $12t$ times.`,
        `That gives $V(t)=${P}\\left(${fs}^{1/12}\\right)^{12t}$. A power of a power multiplies the exponents, $\\frac{1}{12}\\cdot 12t=t$, so it equals the original $${P}(${fs})^{t}$.`,
        `The equivalent form that shows the monthly factor is $V(t)=${P}\\left(${fs}^{1/12}\\right)^{12t}$.`,
      ],
    });
  },
});

/* -------------------------------------------------------- depreciation */
const depAxes = {
  wording: defineAxis("wording", ["loses", "worth"] as const),
};
interface DepModel {
  value: number;
  pct: number;
  item: string;
}
function depModel(r: (lo: number, hi: number) => number): DepModel {
  return {
    value: pick(r, [
      1200, 1500, 2000, 2400, 3000, 4500, 6000, 12000, 18000, 25000,
    ] as const),
    pct: pick(r, [5, 8, 10, 12, 15, 20, 25] as const),
    item: pick(r, [
      "car",
      "laptop",
      "tractor",
      "piano",
      "truck",
      "camera",
    ] as const),
  };
}
export const depreciationRecursion = chainFamily({
  template: depreciationRecursionTemplate,
  axes: depAxes,
  model: depModel,
  variant: (m) => "percent-loss",
  render: (m, ax, r) => {
    const keep = (100 - m.pct) / 100;
    const f = (x: number) => String(x);
    const ks = f(keep);
    const lose = f(m.pct / 100);
    const grow = f(1 + m.pct / 100);
    const V = withCommas(m.value);
    const change =
      ax.wording === "loses"
        ? `loses ${m.pct}% of its value each year`
        : `is worth ${100 - m.pct}% of its value from the year before`;
    return choiceSurface(r, {
      prompt: `A ${m.item} bought for ${V} dollars ${change}. Let $a_n$ be its value, in dollars, at the start of year $n$. Which recursive rule models this?`,
      options: [
        { label: `$a_1=${m.value},\\ a_n=${ks}\\,a_{n-1}$`, correct: true },
        {
          label: `$a_1=${m.value},\\ a_n=${lose}\\,a_{n-1}$`,
          feedback: `This uses the percent lost as the factor. Multiplying by ${lose} keeps only ${m.pct}% of the value. After a ${m.pct}% loss, ${100 - m.pct}% remains, so the factor is ${ks}.`,
        },
        {
          label: `$a_1=${m.value},\\ a_n=${grow}\\,a_{n-1}$`,
          feedback: `This adds ${m.pct}% instead of taking it away. A factor of ${grow} increases the value. A loss multiplies by 1 minus the rate.`,
        },
        {
          label: `$a_1=${m.value},\\ a_n=a_{n-1}-${lose}$`,
          feedback: `This subtracts ${lose} dollars, treating the rate as a fixed amount. A percent loss takes a percent of the current value each year, so it multiplies.`,
        },
        {
          label: `$a_1=${m.value},\\ a_n=${ks}\\,a_{n}$`,
          feedback:
            "This defines $a_n$ from itself. A recursive rule gives each term from the previous term, $a_{n-1}$.",
        },
      ],
      hint: `After a ${m.pct}% loss, find what share of the value remains. Write that share as a decimal factor and multiply the previous year's value $a_{n-1}$ by it, starting from ${V}.`,
      explanation: [
        `A recursive rule gives the first term, then says how to get each term from the one before. $a_n$ is the value in year $n$, and $a_{n-1}$ is the value the year before.`,
        `Losing ${m.pct}% leaves $100\\%-${m.pct}\\%=${100 - m.pct}\\%$ of the value. As a decimal that is ${ks}.`,
        `So each year's value is ${ks} times the year before: $a_n=${ks}\\,a_{n-1}$.`,
        `The ${m.item} starts at ${V} dollars, so $a_1=${m.value}$.`,
        `The rule is $a_1=${m.value},\\ a_n=${ks}\\,a_{n-1}$. It is a geometric sequence, with common ratio ${ks}.`,
      ],
    });
  },
});

/* ------------------------------------------------ nonlinear recursion */
const recAxes = {
  rule: defineAxis("rule", [
    "square-plus",
    "square-minus-previous",
    "double-square-minus",
  ] as const),
};
interface RecModel {
  a1: number;
  c: number;
  k: 3 | 4;
}
function recModel(r: (lo: number, hi: number) => number): RecModel {
  const a1 = r(-3, 3);
  const c = r(1, 6);
  return { a1, c, k: r(0, 2) === 2 && Math.abs(a1) <= 2 ? 4 : 3 };
}
export const nonlinearRecursion = chainFamily({
  template: nonlinearRecursionTemplate,
  axes: recAxes,
  model: recModel,
  variant: (m) => `term-${m.k}`,
  render: (m, ax) => {
    const step = (x: number) =>
      ax.rule === "square-plus"
        ? x * x + m.c
        : ax.rule === "square-minus-previous"
          ? x * x - x
          : 2 * x * x - m.c;
    const text =
      ax.rule === "square-plus"
        ? `a_n=a_{n-1}^{2}+${m.c}`
        : ax.rule === "square-minus-previous"
          ? "a_n=a_{n-1}^{2}-a_{n-1}"
          : `a_n=2a_{n-1}^{2}-${m.c}`;
    const k = m.k;
    const a2 = step(m.a1);
    const a3 = step(a2);
    const a4 = step(a3);
    const ans = k === 4 ? a4 : a3;
    const sub = (v: number) => par(v);
    const calc = (prev: number, v: number) =>
      ax.rule === "square-plus"
        ? `${sub(prev)}^{2}+${m.c}=${v}`
        : ax.rule === "square-minus-previous"
          ? `${sub(prev)}^{2}-${sub(prev)}=${v}`
          : `2(${sub(prev)})^{2}-${m.c}=${v}`;
    return numberSurface({
      prompt: `A sequence is defined by $a_1=${m.a1}$ and $${text}$ for $n\\ge2$. What is $a_${k}$?`,
      answer: String(ans),
      label: `Answer ($a_${k}$)`,
      hint: `Start from $a_1=${m.a1}$ and use the rule once to get $a_2$: put ${m.a1} in for $a_{n-1}$. Square first, then ${ax.rule === "square-plus" ? `add ${m.c}` : ax.rule === "square-minus-previous" ? `subtract ${m.a1} (the previous term)` : `double it and subtract ${m.c}`}.`,
      explanation: [
        `A recursive rule builds each term from the one before. $a_n$ is term number $n$, and $a_{n-1}$ is the term just before it.`,
        `To find $a_2$, put $a_1=${m.a1}$ in for $a_{n-1}$. Square first, because powers come before ${ax.rule === "square-plus" ? "adding" : ax.rule === "square-minus-previous" ? "subtracting" : "multiplying and subtracting"}: $a_2=${calc(m.a1, a2)}$.`,
        `Now use $a_2$ the same way to get the next term: $a_3=${calc(a2, a3)}$.`,
        ...(k === 4 ? [`Once more, from $a_3$: $a_4=${calc(a3, a4)}$.`] : []),
        `So $a_${k}=${ans}$.`,
      ],
    });
  },
});

export const regentsAlgebraTwoExponentialTemplates = [
  geometricSeriesTotalTemplate,
  commonBaseExponentialTemplate,
  exponentialParameterLogTemplate,
  exponentialTargetTimeTemplate,
  growthModelRewriteTemplate,
  depreciationRecursionTemplate,
  nonlinearRecursionTemplate,
];
export const regentsAlgebraTwoExponentialGenerate = dispatch(
  regentsAlgebraTwoExponentialTemplates,
  {
    "geometric-series-total": (s) => geometricSeriesTotal.generate(s).problem,
    "common-base-exponential": (s) => commonBaseExponential.generate(s).problem,
    "exponential-parameter-log": (s) =>
      exponentialParameterLog.generate(s).problem,
    "exponential-target-time": (s) => exponentialTargetTime.generate(s).problem,
    "growth-model-rewrite": (s) => growthModelRewrite.generate(s).problem,
    "depreciation-recursion": (s) => depreciationRecursion.generate(s).problem,
    "nonlinear-recursion-term": (s) => nonlinearRecursion.generate(s).problem,
  },
);
