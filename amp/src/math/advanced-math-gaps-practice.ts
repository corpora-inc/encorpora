import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Random,
} from "./distribution-practice";
import { valueTable } from "./exponential-scenes";
import { f, graph } from "./scene/author";
import type { Scene } from "./scene/spec";

/** Five single-choice families that fill advanced-math gaps: arithmetic
 * series and recursion, compound growth, factoring patterns, residual-based
 * model choice and exponential/logarithmic graph features. Every answer is
 * exact (or rounded as the prompt states); only the prompt, optional scene and
 * shuffled choices reach the learner. */
const meta = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  description,
});

export const seriesRecursionTemplate = meta(
  "series-recursion",
  "Arithmetic series and recursive rules",
  "arithmetic-sequences",
  0.3,
  "Sum an arithmetic series, convert between recursive and explicit rules, read a term from a table, or compute a term from a recursive rule.",
);
export const compoundGrowthTemplate = meta(
  "compound-growth",
  "Compound interest and growth rates",
  "exponential-models",
  0.4,
  "Use periodic and continuous compounding, convert between annual and per-period growth factors, and read a compound-interest formula.",
);
export const factoringPatternsTemplate = meta(
  "polynomial-factoring-patterns",
  "Factoring patterns beyond trinomials",
  "factor-quadratics",
  0.45,
  "Factor sums and differences of cubes, polynomials by grouping, and quadratic-in-form polynomials completely over the integers.",
);
export const residualFunctionFitTemplate = meta(
  "residual-function-fit",
  "Residuals and choosing a model type",
  "regression-interpretation",
  0.4,
  "Use a residual plot or a table to choose a model type, and compute or interpret a residual from a nonlinear model and a data point.",
);
export const graphFeaturesTemplate = meta(
  "function-graph-features",
  "Features of exponential and logarithmic graphs",
  "logarithms",
  0.4,
  "Read intercepts, asymptotes, domain, range, direction and end behavior of exponential and logarithmic functions from an equation or a graph.",
);
export const advancedMathGapTemplates: readonly TemplateMetadata[] = [
  seriesRecursionTemplate,
  compoundGrowthTemplate,
  factoringPatternsTemplate,
  residualFunctionFitTemplate,
  graphFeaturesTemplate,
];

type Wrong = { label: string; feedback: string };
type Built = {
  variant: string;
  prompt: string;
  scene?: Scene;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
};

const math = (s: string) => `$${s}$`;
const sgn = (n: number) => (n < 0 ? "-" : "+");
/** Linear expression ax + b in LaTeX. */
function lin(a: number, b: number, v = "x"): string {
  const lead = a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
  return b === 0 ? lead : `${lead}${sgn(b)}${Math.abs(b)}`;
}
/** Polynomial from descending coefficients, in LaTeX. */
function poly(c: number[]): string {
  const top = c.length - 1;
  let out = "";
  c.forEach((k, i) => {
    if (k === 0) return;
    const p = top - i;
    const mag = Math.abs(k) === 1 && p > 0 ? "" : String(Math.abs(k));
    const x = p === 0 ? "" : p === 1 ? "x" : `x^{${p}}`;
    out += `${out ? (k < 0 ? "-" : "+") : k < 0 ? "-" : ""}${mag}${x}`;
  });
  return out || "0";
}
/** (x + b) with the sign of b preserved; coefficient a on x. */
const bin = (a: number, b: number) => `(${lin(a, b)})`;
const money = (n: number) => `${Math.round(n).toLocaleString("en-US")} dollars`;
/** The fractional part is at least `margin` away from the rounding boundary. */
const safeRound = (v: number, margin = 0.06) =>
  Math.abs((v % 1) - 0.5) > margin;

/** Three distinct wrong choices, shuffled by the seeded generator. */
function pickWrong(r: Random, correct: string, wrong: Wrong[]): Wrong[] {
  const seen = new Set([correct]);
  const unique = wrong.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (unique.length < 3)
    throw new Error(
      `Insufficient distinct choices: ${correct} / ${wrong.map((w) => w.label).join(" | ")}`,
    );
  return shuffle(r, unique).slice(0, 3);
}

// ---------------------------------------------------------------- series-recursion
function seriesRecursion(r: Random): Built {
  const variant = [
    "series-listed",
    "series-story",
    "series-sigma",
    "recursive-to-explicit",
    "explicit-to-recursive",
    "table-term",
    "recursion-term",
  ][r(0, 6)]!;
  const nonzero = (lo: number, hi: number) => r(lo, hi) * (r(0, 1) ? 1 : -1);
  if (variant.startsWith("series")) {
    let a1: number, d: number, n: number;
    let prompt: string, hint: string;
    if (variant === "series-sigma") {
      const p = nonzero(2, 6),
        q = nonzero(1, 9);
      n = r(8, 20);
      a1 = p + q;
      d = p;
      prompt = `Evaluate $\\sum_{k=1}^{${n}} (${lin(p, q, "k")})$.`;
      hint = `This sum adds ${n} terms. Find the first term at $k=1$ and the last term at $k=${n}$; the terms change by a fixed amount.`;
    } else if (variant === "series-story") {
      a1 = r(6, 20);
      d = r(2, 5);
      n = r(8, 18);
      prompt = `A theater's first row has ${a1} seats. Each later row has ${d} more seats than the row in front of it. There are ${n} rows. How many seats are in the theater?`;
      hint = `Find the seats in the last row, then average the first and last rows and multiply by the ${n} rows.`;
    } else {
      a1 = nonzero(2, 14);
      d = nonzero(2, 7);
      n = r(8, 20);
      const shownTerm = (v: number) => (v < 0 ? `(${v})` : `${v}`);
      prompt = `Find the sum of the first ${n} terms of the arithmetic series $${a1}+${shownTerm(a1 + d)}+${shownTerm(a1 + 2 * d)}+\\cdots$.`;
      hint = `The terms change by ${d} each time. Find term ${n}, then use the average of the first and last terms.`;
    }
    const last = a1 + (n - 1) * d;
    const sum = (n * (a1 + last)) / 2;
    const without = (n - 1) * (a1 + last - d);
    return {
      variant,
      prompt,
      hint,
      explanation: [
        `The first term is ${a1} and the common difference is ${d}.`,
        `Term ${n} is ${a1} + ${n - 1}(${d}) = ${last}.`,
        `The sum is the number of terms times the average of the first and last terms: ${n} × (${a1} + ${last < 0 ? `(${last})` : last})/2 = ${sum}.`,
      ],
      correct: math(String(sum)),
      wrong: [
        {
          label: math(String(n * (a1 + last))),
          feedback:
            "That is twice the sum. Pairing first with last counts every term twice, so divide $n(a_1+a_n)$ by 2.",
        },
        {
          label: math(String(n * last)),
          feedback:
            "The terms are not all equal to the last term. Use the average of the first and last terms.",
        },
        {
          label: math(String(without / 2)),
          feedback: `That sums ${n - 1} terms. Count all ${n} terms, including the last.`,
        },
        {
          label: math(String(last)),
          feedback: "That is only the last term, not the sum of all the terms.",
        },
        {
          label: math(String(n * a1)),
          feedback:
            "The terms are not all equal to the first term. Use the average of the first and last terms.",
        },
        {
          label: math(String(((n + 1) * (2 * a1 + n * d)) / 2)),
          feedback: `That sums ${n + 1} terms. Count exactly ${n} terms.`,
        },
      ],
    };
  }
  if (variant === "recursive-to-explicit") {
    const A = r(1, 20),
      D = nonzero(2, 8);
    const label = (a: number, b: number) => math(`a_n=${lin(a, b, "n")}`);
    const correct = label(D, A - D);
    return {
      variant,
      prompt: `A sequence has $a_1=${A}$ and $a_{n+1}=a_n${sgn(D)}${Math.abs(D)}$ for $n\\ge1$. Which explicit rule gives $a_n$?`,
      hint: `The first term is ${A}. To reach term $n$ you apply the rule one fewer time than $n$. Test your rule at $n=1$.`,
      explanation: [
        `Each step adds ${D}, so the common difference is ${D}.`,
        `Term $n$ takes $n-1$ steps from the first term: $a_n=${A}+${D < 0 ? `(${D})` : D}(n-1)$.`,
        `Distribute and combine: $a_n=${lin(D, A - D, "n")}$. Check: $n=1$ gives ${A}.`,
      ],
      correct,
      wrong: [
        {
          label: label(D, A),
          feedback: `At $n=1$ this gives ${A + D}, not ${A}. The first term has taken zero steps, so use $n-1$ steps.`,
        },
        {
          label: label(A, D),
          feedback:
            "The coefficient of $n$ is the common difference, and the constant makes $n=1$ land on the first term.",
        },
        {
          label: label(D, A + D),
          feedback: `At $n=1$ this gives ${A + 2 * D}, not ${A}. Subtract one difference, not add it.`,
        },
        {
          label: label(-D, A + D),
          feedback:
            "The sign of the difference is preserved in the explicit rule: the sequence moves the same direction.",
        },
      ],
    };
  }
  if (variant === "explicit-to-recursive") {
    const P = nonzero(2, 8);
    let Q = nonzero(1, 9);
    while (Q === P) Q = nonzero(1, 9);
    const a1 = P + Q;
    const rec = (first: number, step: string) =>
      math(`a_1=${first},\\ a_{n+1}=${step}`);
    const add = (k: number) => `a_n${sgn(k)}${Math.abs(k)}`;
    return {
      variant,
      prompt: `A sequence is defined by $a_n=${lin(P, Q, "n")}$ for $n\\ge1$. Which recursive definition gives the same sequence?`,
      hint: `Evaluate $${lin(P, Q, "n")}$ at $n=1$ for the first term, then compare $a_2$ with $a_1$ to find what each step adds.`,
      explanation: [
        `At $n=1$: $a_1=${P}(1)${sgn(Q)}${Math.abs(Q)}=${a1}$.`,
        `Increasing $n$ by 1 changes $${lin(P, Q, "n")}$ by ${P}, so $a_{n+1}=${add(P)}$.`,
        `The recursive definition is $a_1=${a1},\\ a_{n+1}=${add(P)}$.`,
      ],
      correct: rec(a1, add(P)),
      wrong: [
        {
          label: rec(Q, add(P)),
          feedback: `${Q} is the constant in the formula, not the first term. Substitute $n=1$ to get $a_1$.`,
        },
        {
          label: rec(a1, add(Q)),
          feedback: `Each step adds the coefficient of $n$ (${P}), not the constant (${Q}).`,
        },
        {
          label: rec(a1, `${P}a_n`),
          feedback:
            "Multiplying by a constant gives a geometric pattern. This sequence changes by the same amount each step.",
        },
        {
          label: rec(P, add(Q)),
          feedback:
            "Find the first term by substituting $n=1$, and the step from the coefficient of $n$.",
        },
      ],
    };
  }
  if (variant === "table-term") {
    const i = r(2, 4),
      j = i + r(2, 4),
      d = nonzero(2, 9),
      ai = r(10, 40);
    const aj = ai + (j - i) * d;
    const N = j + r(2, 5);
    const answer = aj + (N - j) * d;
    const scene = valueTable(
      "n",
      ["a_n"],
      [
        [i, ai],
        [j, aj],
      ],
    ).scene({ title: "Two terms of an arithmetic sequence" });
    return {
      variant,
      scene,
      prompt: `The table shows two terms of an arithmetic sequence. What is $a_{${N}}$?`,
      hint: `Terms ${i} and ${j} are ${j - i} steps apart. The change from $a_{${i}}$ to $a_{${j}}$ is spread evenly over those steps. Then take ${N - j} more steps to reach $a_{${N}}$.`,
      explanation: [
        `From term ${i} to term ${j} there are ${j - i} steps, and the value changes by ${aj} − ${ai} = ${aj - ai}.`,
        `The common difference is ${aj - ai} ÷ ${j - i} = ${d}.`,
        `Term ${N} is ${N - j} steps after term ${j}: ${aj} + ${N - j}(${d}) = ${answer}.`,
      ],
      correct: math(String(answer)),
      wrong: [
        {
          label: math(String(aj + (N - j) * (aj - ai))),
          feedback:
            "The change between the two given terms covers several steps. Divide it by the number of steps to get one difference.",
        },
        {
          label: math(String(aj + (N - j + 1) * d)),
          feedback: `From term ${j} to term ${N} is ${N - j} steps, one fewer than ${N - j + 1}.`,
        },
        {
          label: math(String(aj + (N - j - 1) * d)),
          feedback: `From term ${j} to term ${N} is ${N - j} steps, not ${N - j - 1}.`,
        },
        {
          label: math(String(aj - (N - j) * d)),
          feedback:
            "Term numbers beyond the table come after it, so move in the direction the sequence is going.",
        },
      ],
    };
  }
  // recursion-term: affine recursion, a transfer beyond adding a constant.
  const A = r(1, 5),
    m = r(2, 3);
  let c = nonzero(1, 4);
  while (c === -(m - 1) * A) c = nonzero(1, 4); // a constant sequence teaches nothing
  const seq = [A];
  for (let k = 1; k < 5; k++) seq.push(m * seq[k - 1]! + c);
  const rule = `a_{n+1}=${m}a_n${sgn(c)}${Math.abs(c)}`;
  const a6 = m * seq[4]! + c;
  return {
    variant,
    prompt: `A sequence has $a_1=${A}$ and $${rule}$ for $n\\ge1$. What is $a_5$?`,
    hint: `Start from $a_1=${A}$. Apply the rule to $a_1$ to get $a_2$, then to $a_2$ to get $a_3$, and keep going to $a_5$. Each term needs the one before it.`,
    explanation: [
      `$a_2=${m}(${seq[0]})${sgn(c)}${Math.abs(c)}=${seq[1]}$.`,
      `$a_3=${m}(${seq[1]})${sgn(c)}${Math.abs(c)}=${seq[2]}$.`,
      `$a_4=${m}(${seq[2]})${sgn(c)}${Math.abs(c)}=${seq[3]}$.`,
      `$a_5=${m}(${seq[3]})${sgn(c)}${Math.abs(c)}=${seq[4]}$.`,
    ],
    correct: math(String(seq[4])),
    wrong: [
      {
        label: math(String(seq[3])),
        feedback: "That is $a_4$. Apply the rule once more to reach $a_5$.",
      },
      {
        label: math(String(a6)),
        feedback:
          "That is $a_6$. The first term is $a_1$, so stop one step earlier.",
      },
      {
        label: math(String(A * m ** 4 + 4 * c)),
        feedback: `The ${Math.abs(c)} is added before each later multiplication by ${m}, so it is multiplied too. Apply the whole rule step by step.`,
      },
      {
        label: math(String(A * m ** 4)),
        feedback: `Each step also ${c < 0 ? "subtracts" : "adds"} ${Math.abs(c)} after multiplying by ${m}.`,
      },
    ],
  };
}

// ---------------------------------------------------------------- compound-growth
function compoundGrowth(r: Random): Built {
  const variant = [
    "periodic",
    "continuous",
    "period-factor",
    "annual-rate",
    "read-formula",
  ][r(0, 4)]!;
  if (variant === "periodic") {
    for (;;) {
      const P = [1000, 1500, 2000, 2500, 5000, 8000][r(0, 5)]!;
      const pct = [3, 4, 5, 6, 8][r(0, 4)]!;
      const [n, name] = (
        [
          [1, "annually"],
          [2, "semiannually (2 times per year)"],
          [4, "quarterly (4 times per year)"],
          [12, "monthly (12 times per year)"],
          [4, "quarterly (4 times per year)"],
          [12, "monthly (12 times per year)"],
        ] as [number, string][]
      )[r(0, 5)]!;
      const t = [2, 3, 5, 10][r(0, 3)]!;
      const rr = pct / 100;
      const A = P * (1 + rr / n) ** (n * t);
      if (!safeRound(A)) continue;
      const formula = r(0, 1) === 1;
      return {
        variant,
        prompt: `${money(P)} is deposited at ${pct}% annual interest, compounded ${name}. ${formula ? "Use $A=P(1+r/n)^{nt}$. " : ""}What is the balance after ${t} years, rounded to the nearest dollar?`,
        hint: `Use the rate for one compounding period, not the annual rate, and count how many periods occur in ${t} years.`,
        explanation: [
          `The annual rate is $r=${rr}$, compounding ${n} time${n === 1 ? "" : "s"} per year, for $t=${t}$ years: $n=${n}$.`,
          `The rate per period is $r/n=${rr}/${n}=${+(rr / n).toFixed(6)}$, and there are $nt=${n * t}$ periods.`,
          `$A=${P}(1+${+(rr / n).toFixed(6)})^{${n * t}}\\approx${Math.round(A)}$ dollars.`,
        ],
        correct: money(A),
        wrong: [
          {
            label: money(P * (1 + rr * t)),
            feedback:
              "That is simple interest. With compounding, each period's interest earns interest, so raise the growth factor to the number of periods.",
          },
          {
            label: money(P * (1 + rr) ** (n * t)),
            feedback: `Divide the annual rate by ${n} for each period's rate before compounding.`,
          },
          {
            label: money(P * (1 + rr / n) ** t),
            feedback: `Compounding happens ${n} times per year, so the exponent is $nt$, not just $t$.`,
          },
          {
            label: money(A - P),
            feedback:
              "That is only the interest earned. The balance includes the original deposit.",
          },
          {
            label: money(P * (1 + rr / n) ** (n * t - 1)),
            feedback: `There are ${n * t} compounding periods in ${t} years, not one fewer.`,
          },
        ],
      };
    }
  }
  if (variant === "continuous") {
    for (;;) {
      const P = [1000, 2000, 3000, 5000][r(0, 3)]!;
      const pct = [2, 3, 4, 5, 6][r(0, 4)]!;
      const t = [5, 10, 15, 20][r(0, 3)]!;
      const rr = pct / 100;
      const A = P * Math.exp(rr * t);
      if (!safeRound(A)) continue;
      const formula = r(0, 1) === 1;
      return {
        variant,
        prompt: `${money(P)} is deposited at ${pct}% annual interest, compounded continuously. ${formula ? "Use $A=Pe^{rt}$. " : ""}What is the balance after ${t} years, rounded to the nearest dollar?`,
        hint: `Continuous compounding uses $e$ raised to rate × time. Write the rate as a decimal and multiply by ${t} before using the exponential.`,
        explanation: [
          `Continuous compounding follows $A=Pe^{rt}$ with $P=${P}$, $r=${rr}$, $t=${t}$.`,
          `The exponent is $rt=${rr}\\times${t}=${+(rr * t).toFixed(4)}$.`,
          `$A=${P}e^{${+(rr * t).toFixed(4)}}\\approx${Math.round(A)}$ dollars.`,
        ],
        correct: money(A),
        wrong: [
          {
            label: money(P * (1 + rr) ** t),
            feedback:
              "That compounds once per year. Continuous compounding uses $e^{rt}$.",
          },
          {
            label: money(P * (1 + rr * t)),
            feedback:
              "That is simple interest, which adds the same amount every year.",
          },
          {
            label: money(A - P),
            feedback:
              "That is only the interest earned. The balance includes the original deposit.",
          },
          {
            label: money(P + Math.exp(rr * t)),
            feedback:
              "The growth factor $e^{rt}$ multiplies the deposit; it is not added to it.",
          },
        ],
      };
    }
  }
  if (variant === "period-factor") {
    const monthly = r(0, 1) === 1;
    const per = monthly ? 12 : 4;
    const unit = monthly ? "month" : "quarter";
    const g = monthly ? [12, 24, 36][r(0, 2)]! : [8, 12, 16, 20][r(0, 3)]!;
    const s = r(0, 1) ? 1 : -1;
    const V = [1200, 2400, 5000, 8000][r(0, 3)]!;
    const year = (1 + (s * g) / 100).toFixed(2);
    const small = (1 + (s * g) / per / 100).toFixed(2);
    const verb = s > 0 ? "grows" : "shrinks";
    const L = (e: string) => math(e);
    return {
      variant,
      prompt: `A value ${verb} ${g}% each year, so $V(t)=${V}(${year})^{t}$ with $t$ in years. Which model gives the same values using $m$, the number of ${unit}s since the start?`,
      hint: `One ${unit} is $1/${per}$ of a year. In $V(t)=${V}(${year})^{t}$, how should the exponent change so that $m$ ${unit}s equals $m/${per}$ years?`,
      explanation: [
        `$m$ ${unit}s is $m/${per}$ years, so replace $t$ by $m/${per}$.`,
        `$V=${V}(${year})^{m/${per}}$. The yearly factor ${year} is spread over ${per} ${unit}s by the exponent $1/${per}$.`,
        `Dividing the yearly percent by ${per} would give a different factor, ${small}, which compounds to more or less than ${year} over a year.`,
      ],
      correct: L(`V=${V}(${year})^{m/${per}}`),
      wrong: [
        {
          label: L(`V=${V}(${year})^{${per}m}`),
          feedback: `${per}$m$ counts too many years. One ${unit} is $1/${per}$ of a year, so divide, not multiply.`,
        },
        {
          label: L(`V=${V}(${small})^{m}`),
          feedback: `Dividing the percent by ${per} gives ${small} per ${unit}, but $${small}^{${per}}$ is not ${year}. An equivalent ${unit}ly factor comes from a root of the yearly factor.`,
        },
        {
          label: L(`V=${V}\\left(\\tfrac{${year}}{${per}}\\right)^{m}`),
          feedback: `Dividing the factor by ${per} shrinks the value each ${unit}; the factor must stay close to 1.`,
        },
        {
          label: L(`V=${V}(${year})^{m}`),
          feedback: `This applies the yearly factor every ${unit}. It changes once per ${unit} by ${g}%, not once per year.`,
        },
      ],
    };
  }
  if (variant === "annual-rate") {
    for (;;) {
      const monthly = r(0, 1) === 1;
      const per = monthly ? 12 : 4;
      const unit = monthly ? "month" : "quarter";
      const p = monthly ? [0.5, 1, 1.5, 2][r(0, 3)]! : [2, 3, 5][r(0, 2)]!;
      const s = r(0, 1) ? 1 : -1;
      const factor = (1 + (s * p) / 100) ** per;
      const pctYear = Math.abs(factor - 1) * 100;
      if (!safeRound(pctYear * 10, 0.08)) continue;
      const ans = (Math.round(pctYear * 10) / 10).toFixed(1);
      const growth = s > 0;
      const text = (v: string) => `${v}%`;
      const wrongRoot = (
        Math.abs((1 + (s * p) / 100) ** (1 / per) - 1) * 100
      ).toFixed(1);
      return {
        variant,
        prompt: `A quantity ${growth ? "increases" : "decreases"} by ${p}% each ${unit}, with each change applied to the previous ${unit}'s value. By what percent does it ${growth ? "increase" : "decrease"} over one year? Round to the nearest tenth of a percent.`,
        hint: `One year contains ${per} ${unit}s. Write the factor for a ${p}% ${growth ? "increase" : "decrease"} in one ${unit}, repeat it ${per} times, then convert the yearly factor to a percent change.`,
        explanation: [
          `The factor for one ${unit} is ${(1 + (s * p) / 100).toFixed(4).replace(/0+$/, "")}.`,
          `Over a year, it is applied ${per} times: $(${(1 + (s * p) / 100).toFixed(4).replace(/0+$/, "")})^{${per}}\\approx${factor.toFixed(4)}$.`,
          `The yearly change is $|${factor.toFixed(4)}-1|\\approx${ans}\\%$, ${growth ? "an increase" : "a decrease"}.`,
        ],
        correct: text(ans),
        wrong: [
          {
            label: text((p * per).toFixed(1)),
            feedback: `Multiplying ${p}% by ${per} treats the change as simple. Each ${unit}'s change applies to a value already changed.`,
          },
          {
            label: text((factor * 100).toFixed(1)),
            feedback:
              "That is the yearly factor as a percent of the starting value. Subtract 100% to get the percent change.",
          },
          {
            label: text(wrongRoot),
            feedback: `Raise the ${unit} factor to the power ${per}; do not take a ${per}th root.`,
          },
          {
            label: text(
              (Math.abs((1 + (s * p) / 100) ** (per - 1) - 1) * 100).toFixed(1),
            ),
            feedback: `A year has ${per} ${unit}s, so the factor is used ${per} times, not ${per - 1}.`,
          },
        ],
      };
    }
  }
  // read-formula
  const n = [2, 4, 12][r(0, 2)]!;
  const choices: Record<number, number[]> = {
    2: [3, 5, 7],
    4: [6, 10, 14],
    12: [6, 18, 24],
  };
  const pct = choices[n]![r(0, 2)]!;
  const pPer = pct / n;
  const P = [1500, 2000, 4000][r(0, 2)]!;
  const factor = +(1 + pPer / 100).toFixed(4);
  const name =
    n === 2 ? "twice a year" : n === 4 ? "four times a year" : "monthly";
  const fmt = (v: number) => `${+v.toFixed(3)}`;
  return {
    variant,
    prompt: `The balance of an account is $B(t)=${P}(${factor})^{${n}t}$, where $t$ is in years. Which statement describes the account?`,
    hint: `The exponent $${n}t$ counts compounding periods. The factor inside the parentheses is $1+r/n$ for one period.`,
    explanation: [
      `The exponent is $${n}t$, so interest is added ${n} times per year.`,
      `The growth factor per period is ${factor}, so each period earns ${fmt(pPer)}%.`,
      `The annual rate is ${n} × ${fmt(pPer)}% = ${pct}%. The account earns ${pct}% per year, compounded ${name}.`,
    ],
    correct: `It earns ${pct}% annual interest, compounded ${name}.`,
    wrong: [
      {
        label: `It earns ${fmt(pPer)}% annual interest, compounded ${name}.`,
        feedback: `${fmt(pPer)}% is the rate for one period. The annual rate is ${n} times as large.`,
      },
      {
        label: `It earns ${pct}% annual interest, compounded once a year.`,
        feedback: `The exponent $${n}t$ shows ${n} compounding periods per year.`,
      },
      {
        label: `It earns ${n}% annual interest, compounded ${pct} times a year.`,
        feedback: `The ${n} in the exponent is the number of periods per year; the rate is found from the factor ${factor}.`,
      },
      {
        label: `It earns ${pct}% interest in every compounding period, ${name}.`,
        feedback: `${pct}% is the whole year's rate. Each of the ${n} periods earns ${fmt(pPer)}%.`,
      },
    ],
  };
}

// ---------------------------------------------------------------- polynomial-factoring-patterns
function factoringPatterns(r: Random): Built {
  const variant = [
    "cubes",
    "gcf-cubes",
    "grouping",
    "grouping-complete",
    "quadratic-form",
    "quadratic-form-irreducible",
    "fourth-power-difference",
  ][r(0, 6)]!;
  const ask = (e: string) =>
    `Which is the complete factorization of $${e}$ over the integers?`;
  const L = math;
  if (variant === "cubes" || variant === "gcf-cubes") {
    const k = variant === "gcf-cubes" ? [2, 3, 4, 5][r(0, 3)]! : 1;
    const a = variant === "cubes" ? r(1, 3) : 1;
    // A common factor of a and b would be a cube that must be pulled out first,
    // so keep a and b coprime: then the factors below are the complete factorization.
    const bChoices = [1, 2, 3, 4].filter((v) =>
      [2, 3].every((f) => a % f !== 0 || v % f !== 0),
    );
    const b = bChoices[r(0, bChoices.length - 1)]!;
    const s = r(0, 1) ? 1 : -1;
    const expr = poly([k * a ** 3, 0, 0, s * k * b ** 3]);
    const kk = k === 1 ? "" : String(k);
    const trinomial = (mid: number, sign: number) =>
      poly([a * a, sign * mid, b * b]);
    const correct = L(`${kk}${bin(a, s * b)}(${trinomial(a * b, -s)})`);
    return {
      variant,
      prompt: ask(expr),
      hint:
        k === 1
          ? `Write each term as a perfect cube: ${a ** 3 === 1 ? "" : `$${a ** 3}x^3=(${a}x)^3$ and `}$${b ** 3}=${b}^3$. Then use the sum or difference of cubes pattern.`
          : `First factor out the common number ${k}. Then write each remaining term as a perfect cube and use the sum or difference of cubes pattern.`,
      explanation: [
        ...(k === 1
          ? []
          : [
              `Factor out the common factor ${k}: $${expr}=${k}(${poly([a ** 3, 0, 0, s * b ** 3])})$.`,
            ]),
        `${s > 0 ? "A sum" : "A difference"} of cubes: $${poly([a ** 3, 0, 0, s * b ** 3])}=(${a === 1 ? "x" : `${a}x`})^3${s > 0 ? "+" : "-"}${b}^3$.`,
        `Use $u^3${s > 0 ? "+" : "-"}v^3=(u${s > 0 ? "+" : "-"}v)(u^2${s > 0 ? "-" : "+"}uv+v^2)$ with $u=${lin(a, 0)}$, $v=${b}$.`,
        `The complete factorization is ${correct}. The quadratic factor has discriminant $-3(${a * b})^2<0$, so it does not factor further.`,
      ],
      correct,
      wrong: [
        {
          label: L(`${kk}${bin(a, s * b)}(${trinomial(a * b, s)})`),
          feedback:
            "The middle term of the quadratic factor has the opposite sign from the binomial: $u+v$ pairs with $u^2-uv+v^2$.",
        },
        {
          label: L(`${kk}${bin(a, -s * b)}(${trinomial(a * b, s)})`),
          feedback:
            "The binomial keeps the sign of the original sum or difference; only the middle term of the trinomial changes sign.",
        },
        {
          label: L(`${kk}${bin(a, s * b)}^3`),
          feedback:
            "Cubing a binomial gives four terms with coefficients 3 in the middle. A sum of cubes has no $x^2$ or $x$ terms.",
        },
        {
          label: L(`${kk}${bin(a, s * b)}(${trinomial(2 * a * b, -s)})`),
          feedback:
            "The middle term is $uv$, not $2uv$. The trinomial is not a perfect square.",
        },
      ],
    };
  }
  if (variant === "grouping" || variant === "grouping-complete") {
    const p = r(1, 6) * (r(0, 1) ? 1 : -1);
    if (variant === "grouping") {
      const q = [2, 3, 5, 6, 7, 10][r(0, 5)]!;
      const expr = poly([1, p, q, p * q]);
      const w = (u: number, v: number) =>
        L(`(x${sgn(u)}${Math.abs(u)})(x^2${sgn(v)}${Math.abs(v)})`);
      return {
        variant,
        prompt: ask(expr),
        hint: `Group the first two terms and the last two terms of $${expr}$, and factor each pair. Look for the same binomial in both groups.`,
        explanation: [
          `Group: $(${poly([1, p, 0, 0])})+(${poly([q, p * q])})$.`,
          `Factor each group: $x^2(x${sgn(p)}${Math.abs(p)})+${q}(x${sgn(p)}${Math.abs(p)})$.`,
          `Both groups contain $(x${sgn(p)}${Math.abs(p)})$. Factor it out: ${w(p, q)}.`,
          `$x^2+${q}$ has no integer factors, so the factorization is complete.`,
        ],
        correct: w(p, q),
        wrong: [
          {
            label: w(p, -q),
            feedback:
              "The second group is added, so after factoring out the shared binomial the second factor is $x^2+q$, not $x^2-q$.",
          },
          {
            label: w(-p, q),
            feedback:
              "The shared binomial keeps the sign that appears in both groups.",
          },
          {
            label: w(q, p),
            feedback:
              "What is left from the first group ($x^2$) and from the second group (the number) form the second factor; the shared binomial keeps its own terms.",
          },
        ].concat([
          {
            label: L(`(x${sgn(p)}${Math.abs(p)})(x${sgn(q)}${q})(x-${q})`),
            feedback:
              "The second factor $x^2+q$ cannot be split into two real linear factors.",
          },
        ]),
      };
    }
    const s = r(2, 5);
    let pp = p;
    if (Math.abs(pp) === s) pp = pp > 0 ? s + 1 : -(s + 1);
    const expr = poly([1, pp, -s * s, -pp * s * s]);
    const lf = (u: number) => `(x${sgn(u)}${Math.abs(u)})`;
    const correct = L(`${lf(pp)}(x-${s})(x+${s})`);
    return {
      variant,
      prompt: ask(expr),
      hint: `Factor $${expr}$ by grouping first. After that, check whether either factor can be factored again.`,
      explanation: [
        `Group: $(${poly([1, pp, 0, 0])})+(${poly([-s * s, -pp * s * s])})$.`,
        `Factor each group: $x^2${lf(pp)}-${s * s}${lf(pp)}$.`,
        `Factor out $${lf(pp)}$: $${lf(pp)}(x^2-${s * s})$.`,
        `$x^2-${s * s}$ is a difference of squares, $(x-${s})(x+${s})$. The complete factorization is ${correct}.`,
      ],
      correct,
      wrong: [
        {
          label: L(`${lf(pp)}(x^2-${s * s})`),
          feedback: `This product equals the polynomial, but $x^2-${s * s}$ is a difference of squares and factors further.`,
        },
        {
          label: L(`${lf(pp)}(x-${s})^2`),
          feedback:
            "The difference of squares $x^2-s^2$ has one factor $x-s$ and one $x+s$.",
        },
        {
          label: L(`${lf(-pp)}(x-${s})(x+${s})`),
          feedback:
            "The binomial that is common to both groups keeps its sign.",
        },
        {
          label: L(`${lf(pp)}(x^2+${s * s})`),
          feedback:
            "The second group is subtracted, so the remaining factor is $x^2-s^2$, not $x^2+s^2$.",
        },
      ],
    };
  }
  if (variant === "quadratic-form") {
    const m = r(1, 3);
    const nn = m + r(1, 4 - m);
    const expr = poly([1, 0, -(m * m + nn * nn), 0, m * m * nn * nn]);
    const correct = L(`(x-${m})(x+${m})(x-${nn})(x+${nn})`);
    return {
      variant,
      prompt: ask(expr),
      hint: `Let $u=x^2$ to see an ordinary trinomial in $u$. Factor it, put $x^2$ back, then look for differences of squares.`,
      explanation: [
        `With $u=x^2$ the polynomial is $u^2-${m * m + nn * nn}u+${m * m * nn * nn}$.`,
        `The numbers with product ${m * m * nn * nn} and sum ${m * m + nn * nn} are ${m * m} and ${nn * nn}, so it factors as $(u-${m * m})(u-${nn * nn})$.`,
        `Put $x^2$ back: $(x^2-${m * m})(x^2-${nn * nn})$.`,
        `Each factor is a difference of squares: ${correct}.`,
      ],
      correct,
      wrong: [
        {
          label: L(`(x^2-${m * m})(x^2-${nn * nn})`),
          feedback:
            "This equals the polynomial, but each factor is a difference of squares and factors further.",
        },
        {
          label: L(`(x^2-${m})(x^2-${nn})`),
          feedback: `The factors of $u^2-${m * m + nn * nn}u+${m * m * nn * nn}$ use ${m * m} and ${nn * nn}, not ${m} and ${nn}.`,
        },
        {
          label: L(`(x-${m})^2(x-${nn})^2`),
          feedback:
            "Each difference of squares gives one factor $x-a$ and one $x+a$.",
        },
        {
          label: L(`(x^2+${m * m})(x^2+${nn * nn})`),
          feedback:
            "The middle coefficient is negative, so both numbers are subtracted.",
        },
      ],
    };
  }
  if (variant === "quadratic-form-irreducible") {
    const p = r(1, 4),
      q = p + r(1, 4);
    const expr = poly([1, 0, p + q, 0, p * q]);
    const correct = L(`(x^2+${p})(x^2+${q})`);
    return {
      variant,
      prompt: ask(expr),
      hint: `Let $u=x^2$ and factor the trinomial in $u$. Then decide whether each factor in $x$ can be factored again over the integers.`,
      explanation: [
        `With $u=x^2$ the polynomial is $u^2+${p + q}u+${p * q}$.`,
        `The numbers with product ${p * q} and sum ${p + q} are ${p} and ${q}, so it factors as $(u+${p})(u+${q})$.`,
        `Put $x^2$ back: ${correct}. A sum $x^2+c$ with $c>0$ has no real roots, so neither factor splits further.`,
      ],
      correct,
      wrong: [
        {
          label: L(`(x^2-${p})(x^2-${q})`),
          feedback:
            "All the signs in the polynomial are positive, so the numbers added are positive.",
        },
        {
          label: L(`(x+${p})(x-${p})(x+${q})(x-${q})`),
          feedback:
            "That pattern is for a difference of squares. Here each factor is a sum, which does not split.",
        },
        {
          label: L(`(x^2+${p * q})(x^2+${p + q})`),
          feedback:
            "The numbers in the factors have product equal to the constant and sum equal to the middle coefficient, not the other way around.",
        },
        {
          label: L(`(x+${p})^2(x+${q})^2`),
          feedback:
            "Replacing $x^2$ by $x$ in the factors is not allowed; $(x+a)^2$ has a middle term.",
        },
      ],
    };
  }
  const k = r(2, 5);
  const expr = poly([1, 0, 0, 0, -(k ** 4)]);
  const correct = L(`(x^2+${k * k})(x-${k})(x+${k})`);
  return {
    variant,
    prompt: ask(expr),
    hint: `Write $x^4-${k ** 4}$ as a difference of two squares with $x^4=(x^2)^2$ and $${k ** 4}=(${k * k})^2$. Then check each factor for another difference of squares.`,
    explanation: [
      `$x^4-${k ** 4}=(x^2)^2-(${k * k})^2=(x^2-${k * k})(x^2+${k * k})$.`,
      `$x^2-${k * k}$ is again a difference of squares: $(x-${k})(x+${k})$.`,
      `$x^2+${k * k}$ is a sum of squares and does not factor over the integers. The complete factorization is ${correct}.`,
    ],
    correct,
    wrong: [
      {
        label: L(`(x^2-${k * k})(x^2+${k * k})`),
        feedback:
          "This equals the polynomial, but $x^2-" +
          k * k +
          "$ factors further.",
      },
      {
        label: L(`(x-${k})^2(x+${k})^2`),
        feedback:
          "This is $(x^2-" + k * k + ")^2$, which has a different expansion.",
      },
      {
        label: L(`(x^2-${k})(x^2+${k})`),
        feedback: `Squaring ${k * k} gives ${k ** 4}; here the squares are $x^2$ and ${k * k}.`,
      },
      {
        label: L(`(x-${k})^4`),
        feedback:
          "Raising a binomial to the fourth power gives a middle term of every degree.",
      },
    ],
  };
}

// ---------------------------------------------------------------- residual-function-fit
const residualContexts = [
  {
    what: "daily sales against advertising spending",
    x: "advertising spending",
  },
  { what: "reaction rate against temperature", x: "temperature" },
  { what: "plant height against days since planting", x: "days" },
];
function residualScene(res: number[], unit: number, xName: string): Scene {
  const points = res.map((v, i) => [i + 1, v] as [number, number]);
  return graph({
    id: "g",
    x: [0, 10],
    y: [-4 * unit, 4 * unit],
    grid: [1, unit],
    tick: [1, 2 * unit],
    axisNames: [xName, "residual"],
    frame: true,
    aspect: 0.55,
  })
    .scatter(points, { m: 0, b: 0 })
    .scene();
}
const clean1 = (v: number) => Math.round(v * 10) / 10;
function residualFunctionFit(r: Random): Built {
  const variant = [
    "residual-u",
    "residual-cap",
    "residual-random",
    "table-type",
    "residual-compute",
    "residual-meaning",
  ][r(0, 5)]!;
  if (variant.startsWith("residual-") && /u$|cap$|random$/.test(variant)) {
    const ctx = residualContexts[r(0, 2)]!;
    const unit = [1, 2, 5, 10][r(0, 3)]!;
    const sign =
      variant === "residual-u" ? 1 : variant === "residual-cap" ? -1 : 0;
    let res: number[] = [];
    for (;;) {
      res = Array.from({ length: 9 }, (_, i) => {
        const base = sign * 0.16 * ((i - 4) ** 2 - 60 / 9);
        const noise = sign === 0 ? r(-12, 12) / 10 : r(-2, 2) / 10;
        return clean1(unit * (base + noise));
      });
      if (sign !== 0) break;
      const c = (a: number[], b: number[]) => {
        const ma = a.reduce((s, v) => s + v, 0) / a.length;
        const mb = b.reduce((s, v) => s + v, 0) / b.length;
        const cov = a.reduce((s, v, i) => s + (v - ma) * (b[i]! - mb), 0);
        const va = a.reduce((s, v) => s + (v - ma) ** 2, 0);
        const vb = b.reduce((s, v) => s + (v - mb) ** 2, 0);
        return cov / Math.sqrt(va * vb);
      };
      const idx = res.map((_, i) => i);
      const bowl = idx.map((i) => (i - 4) ** 2);
      if (Math.abs(c(res, bowl)) < 0.35 && Math.abs(c(res, idx)) < 0.35) break;
    }
    const scene = residualScene(res, unit, ctx.x);
    const up =
      "Switch to a curved model that bends upward, such as a parabola opening upward.";
    const down =
      "Switch to a curved model that bends downward, such as a parabola opening downward.";
    const keep = "Keep the linear model: its residuals show no pattern.";
    const correct = sign === 1 ? up : sign === -1 ? down : keep;
    const wrongs: Wrong[] = [
      {
        label: keep,
        feedback:
          "The residuals follow a curve instead of scattering at random, so a line has missed a pattern in the data.",
      },
      {
        label: up,
        feedback:
          "Residuals are observed minus predicted. Where they are negative, the data lie below the line. Check the shape against the sign at each end.",
      },
      {
        label: down,
        feedback:
          "Residuals are observed minus predicted. Where they are positive, the data lie above the line. Check the shape against the sign at each end.",
      },
      {
        label:
          "Use a line with a steeper slope, because some residuals are far from 0.",
        feedback:
          "A least-squares line already has the best slope for a line. A curved residual pattern means the model type needs to change.",
      },
      {
        label:
          "Replace the line with a different line, because some residuals are positive and some are negative.",
        feedback:
          "Every least-squares line has residuals of both signs. Look for a pattern in the residuals, not for the signs themselves.",
      },
    ];
    const first = res[0]!,
      mid = res[4]!;
    return {
      variant,
      scene,
      prompt: `A line was fit to ${ctx.what}. The residual plot shows each residual, observed − predicted, against ${ctx.x}. Which conclusion does the residual plot support?`,
      hint: `Read the residuals from left to right. Are they scattered at random around 0, or do they follow a shape? A positive residual means the point is above the line.`,
      explanation:
        sign === 0
          ? [
              "The residuals are scattered above and below 0 with no curve and no trend.",
              "Random scatter means the line has captured the pattern in the data.",
              `Keep the linear model.`,
            ]
          : [
              `At the left end the residuals are ${first > 0 ? "positive" : "negative"}, in the middle they are ${mid > 0 ? "positive" : "negative"}, and at the right end they are ${first > 0 ? "positive" : "negative"} again.`,
              sign === 1
                ? "The data are above the line at both ends and below it in the middle, so the data bend upward."
                : "The data are below the line at both ends and above it in the middle, so the data bend downward.",
              correct,
            ],
      correct,
      wrong: pickWrong(
        r,
        correct,
        wrongs.filter((w) => w.label !== correct),
      ),
    };
  }
  if (variant === "table-type") {
    const kind = r(0, 3);
    const xs = [0, 1, 2, 3, 4, 5];
    let ys: number[], nameCorrect: string, why: string[];
    if (kind === 0) {
      const a = (r(0, 1) ? 1 : -1) * r(2, 9),
        b = r(1, 20);
      ys = xs.map((x) => a * x + b);
      nameCorrect = "Linear";
      why = [
        `The differences of consecutive $y$-values are all ${a}: ${ys
          .slice(1)
          .map((v, i) => v - ys[i]!)
          .join(", ")}.`,
        "Equal first differences mean the data fit a linear model.",
      ];
    } else if (kind === 1) {
      const a = (r(0, 1) ? 1 : -1) * r(1, 3),
        b = r(-4, 6),
        c = r(1, 12);
      ys = xs.map((x) => a * x * x + b * x + c);
      nameCorrect = "Quadratic";
      const d1 = ys.slice(1).map((v, i) => v - ys[i]!);
      const d2 = d1.slice(1).map((v, i) => v - d1[i]!);
      why = [
        `The first differences are ${d1.join(", ")}, which are not equal.`,
        `The second differences are ${d2.join(", ")}, all equal.`,
        "Equal second differences mean the data fit a quadratic model.",
      ];
    } else if (kind === 2) {
      const a = [1, 2, 3, 4][r(0, 3)]!,
        b = r(0, 1) ? [2, 3][r(0, 1)]! : 0.5;
      const aa = b === 0.5 ? 32 * a : a;
      ys = xs.map((x) => aa * b ** x);
      nameCorrect = "Exponential";
      why = [
        `The differences are not equal: ${ys
          .slice(1)
          .map((v, i) => v - ys[i]!)
          .join(", ")}.`,
        `The ratios of consecutive $y$-values are all ${b}: ${ys
          .slice(1)
          .map((v, i) => +(v / ys[i]!).toFixed(3))
          .join(", ")}.`,
        "Equal ratios mean the data fit an exponential model.",
      ];
    } else {
      const c = r(1, 9);
      ys = xs.map((x) => x ** 3 + c);
      nameCorrect = "None of these: not linear, quadratic or exponential";
      const d1 = ys.slice(1).map((v, i) => v - ys[i]!);
      const d2 = d1.slice(1).map((v, i) => v - d1[i]!);
      why = [
        `The first differences are ${d1.join(", ")} and the second differences are ${d2.join(", ")}; neither list is constant.`,
        `The ratios ${ys
          .slice(1)
          .map((v, i) => +(v / ys[i]!).toFixed(2))
          .join(", ")} are not constant either.`,
        "The data fit none of the three types.",
      ];
    }
    const scene = valueTable(
      "x",
      ["y"],
      xs.map((x, i) => [x, ys[i]!]),
    ).scene({ title: "Exact measurements" });
    const names: Record<string, string> = {
      Linear: "Linear",
      Quadratic: "Quadratic",
      Exponential: "Exponential",
      None: "None of these: not linear, quadratic or exponential",
    };
    const all = [
      {
        label: names.Linear!,
        feedback:
          "A linear model needs equal differences between consecutive $y$-values. Compare them.",
      },
      {
        label: names.Quadratic!,
        feedback:
          "A quadratic model needs equal second differences: the differences of the differences.",
      },
      {
        label: names.Exponential!,
        feedback:
          "An exponential model needs equal ratios between consecutive $y$-values. Divide to check.",
      },
      {
        label: names.None!,
        feedback:
          "Check the differences, second differences and ratios. One of the three types matches.",
      },
    ];
    return {
      variant,
      scene,
      prompt:
        "The table gives exact measurements at equally spaced values of $x$. Which type of model fits the data exactly?",
      hint: "Find the differences between consecutive $y$-values. If they are not equal, find the differences of those differences, and also the ratios of consecutive $y$-values.",
      explanation: [...why, `The type is: ${nameCorrect}.`],
      correct: nameCorrect,
      wrong: all.filter((w) => w.label !== nameCorrect),
    };
  }
  // residual-compute / residual-meaning with a nonlinear model.
  let quad = false,
    x = 0,
    model = "",
    predicted = 0,
    slip = 0,
    slipText = "";
  do {
    quad = r(0, 1) === 1;
    x = quad ? r(2, 6) : r(2, 5);
    if (quad) {
      const a = r(1, 3),
        b = (r(0, 1) ? 1 : -1) * r(1, 4),
        c = r(1, 9);
      model = `\\hat y=${poly([a, b, c])}`;
      predicted = a * x * x + b * x + c;
      slip = (a * x) ** 2 + b * x + c;
      slipText = "squared the coefficient along with $x$";
    } else {
      const a = r(1, 4),
        b = r(2, 3);
      model = `\\hat y=${a}\\cdot${b}^{x}`;
      predicted = a * b ** x;
      slip = a * b * x;
      slipText = "multiplied instead of using $x$ as an exponent";
    }
  } while (predicted < 2); // a nonzero prediction keeps every choice distinct
  let e = (r(0, 1) ? 1 : -1) * r(2, 9);
  while (
    new Set([e, -e, predicted, predicted + e]).size < 4 ||
    predicted + e < 1
  )
    e = (r(0, 1) ? 1 : -1) * r(2, 9);
  const observed = predicted + e;
  const setup = `A model predicts $${model}$. At $x=${x}$ the observed value is $y=${observed}$.`;
  if (variant === "residual-compute") {
    return {
      variant,
      prompt: `${setup} A residual is observed minus predicted. What is the residual at $x=${x}$?`,
      hint: `Substitute $x=${x}$ into the model to get the predicted value first. Then subtract it from the observed value ${observed}.`,
      explanation: [
        `Substituting $x=${x}$ into $${model}$ gives a predicted value of ${predicted}.`,
        `Residual = observed − predicted = ${observed} − ${predicted} = ${e}.`,
      ],
      correct: math(String(e)),
      wrong: pickWrong(r, math(String(e)), [
        {
          label: math(String(-e)),
          feedback:
            "A residual is observed minus predicted; this subtracts in the other order.",
        },
        {
          label: math(String(observed - slip)),
          feedback: `The predicted value is off: this ${slipText}. Evaluate the model exactly.`,
        },
        {
          label: math(String(predicted)),
          feedback:
            "That is the predicted value. The residual is how far the observed value is from it.",
        },
        {
          label: math(String(observed)),
          feedback:
            "That is the observed value. Subtract the model's prediction from it.",
        },
      ]),
    };
  }
  const gap = Math.abs(e);
  const over = e < 0;
  const stmt = (isOver: boolean, g: number) =>
    `The model ${isOver ? "overestimates" : "underestimates"} the observed value by ${g}.`;
  const correct = stmt(over, gap);
  return {
    variant,
    prompt: `${setup} Which statement describes the model at $x=${x}$?`,
    hint: `Find the predicted value, then compare it with the observed value ${observed}. Is the prediction larger or smaller than what was observed?`,
    explanation: [
      `Predicted value at $x=${x}$ is ${predicted}; the observed value is ${observed}.`,
      `Residual = observed − predicted = ${e}. ${over ? "A negative residual means the prediction is above the observed value" : "A positive residual means the prediction is below the observed value"}.`,
      correct,
    ],
    correct,
    wrong: pickWrong(r, correct, [
      {
        label: stmt(!over, gap),
        feedback: `A ${over ? "negative" : "positive"} residual means observed minus predicted is ${over ? "below" : "above"} 0, so the prediction is ${over ? "too high" : "too low"}.`,
      },
      {
        label: stmt(over, predicted),
        feedback:
          "The size of the miss is the distance between predicted and observed values, not the predicted value itself.",
      },
      {
        label: stmt(!over, Math.abs(observed - slip)),
        feedback: `The prediction was found incorrectly: it ${slipText}. Evaluate the model exactly.`,
      },
      {
        label: stmt(over, Math.abs(observed - slip)),
        feedback: `The prediction was found incorrectly: it ${slipText}. Evaluate the model exactly.`,
      },
      {
        label: stmt(!over, predicted),
        feedback:
          "The size of the miss is the distance between predicted and observed values, and its direction comes from the sign of the residual.",
      },
      {
        label: stmt(over, observed),
        feedback:
          "The observed value is not the size of the miss. Compare it with the prediction.",
      },
    ]),
  };
}

// ---------------------------------------------------------------- function-graph-features
/** a·b^x + k in LaTeX. */
function expText(a: number, b: number, k: number): string {
  const base = b === 0.5 ? "\\left(\\tfrac{1}{2}\\right)" : String(b);
  const lead = a === 1 ? "" : a === -1 ? "-" : `${a}\\cdot`;
  return `${lead}${base}^{x}${k === 0 ? "" : `${sgn(k)}${Math.abs(k)}`}`;
}
function shiftText(h: number): string {
  return h === 0 ? "x" : `x${sgn(-h)}${Math.abs(h)}`;
}
function logText(a: number, base: number, h: number, k: number): string {
  const lead = a === 1 ? "" : a === -1 ? "-" : `${a}`;
  return `${lead}\\log_{${base}}(${shiftText(h)})${k === 0 ? "" : `${sgn(k)}${Math.abs(k)}`}`;
}
function expGraph(a: number, b: number, k: number): Scene | null {
  let X = 3;
  const mag = (x: number) => Math.abs(a) * b ** x;
  while (X > 1 && mag(b > 1 ? X : -X) > 10) X--;
  const [x0, x1] = b > 1 ? [-3, X] : [-X, 3];
  const ys = [k];
  for (let x = x0; x <= x1; x++) ys.push(a * b ** x + k);
  const lowY = Math.floor(Math.min(0, ...ys)) - 1;
  const highY = Math.ceil(Math.max(0, ...ys)) + 1;
  if (highY - lowY > 14) return null;
  return graph({
    id: "g",
    x: [x0, x1],
    y: [lowY, highY],
    grid: [1, 1],
    tick: [1, 1],
    labels: "auto",
  })
    .curve(f.exp(a, b, { k }))
    .scene({ title: "Graph of an exponential function" });
}
function logGraphScene(a: number, base: number, h: number): Scene {
  return graph({
    id: "g",
    x: [h - 2, h + 8],
    y: [-3, 3],
    grid: [1, 1],
    tick: [1, 1],
    labels: "auto",
  })
    .curve(f.log(a, base, { h }))
    .scene({ title: "Graph of a logarithmic function" });
}
function graphFeatures(r: Random): Built {
  const variant = [
    "exp-asymptote-range",
    "exp-y-intercept",
    "exp-graph-statement",
    "exp-end-behavior",
    "log-domain-asymptote",
    "log-graph-domain",
    "log-graph-intercept",
  ][r(0, 6)]!;
  const nz = (lo: number, hi: number) => r(lo, hi) * (r(0, 1) ? 1 : -1);
  if (variant.startsWith("exp")) {
    for (;;) {
      const a = [1, 2, -1, -2][r(0, 3)]!;
      const b = [2, 3, 0.5][r(0, 2)]!;
      const k = variant === "exp-end-behavior" ? nz(1, 4) : nz(1, 4);
      const eq = `f(x)=${expText(a, b, k)}`;
      const inc = (a > 0 && b > 1) || (a < 0 && b < 1);
      const yint = a + k;
      if (variant === "exp-y-intercept" && yint === 0) continue;
      if (variant === "exp-asymptote-range") {
        const above = a > 0;
        const lbl = (asym: number, up: boolean) =>
          math(`y=${asym}\\text{; range }y${up ? ">" : "<"}${asym}`);
        const correct = lbl(k, above);
        return {
          variant,
          prompt: `For $${eq}$, which gives the horizontal asymptote and the range?`,
          hint: `As $x$ moves far in one direction, $${b === 0.5 ? "\\left(\\tfrac12\\right)" : b}^x$ approaches 0. Find where $f$ settles, and decide whether the curve stays above or below that height using the sign of the coefficient in front of the power.`,
          explanation: [
            `The power $${b === 0.5 ? "\\left(\\tfrac12\\right)" : b}^x$ is always positive and approaches 0 in one direction.`,
            `So $f$ approaches ${k}: the horizontal asymptote is $y=${k}$.`,
            `The coefficient ${a} is ${a > 0 ? "positive" : "negative"}, so the curve stays ${a > 0 ? "above" : "below"} $y=${k}$. The range is $y${a > 0 ? ">" : "<"}${k}$.`,
          ],
          correct,
          wrong: pickWrong(r, correct, [
            {
              label: lbl(k, !above),
              feedback: `The sign of the coefficient ${a} decides the side: the curve is ${a > 0 ? "above" : "below"} the asymptote.`,
            },
            {
              label: lbl(0, above),
              feedback: `Adding ${k} shifts the asymptote from the $x$-axis to $y=${k}$.`,
            },
            {
              label: lbl(-k, above),
              feedback: `A constant added at the end shifts the graph by that amount, so the asymptote is $y=${k}$, not $y=${-k}$.`,
            },
            {
              label: math(`x=0\\text{; range all real numbers}`),
              feedback:
                "An exponential function has a horizontal asymptote, and its range is restricted to one side of it.",
            },
          ]),
        };
      }
      const scene = expGraph(a, b, k);
      if (!scene && variant !== "exp-end-behavior") continue;
      if (variant === "exp-y-intercept") {
        const P = (x: number, y: number) => math(`(${x},${y})`);
        const correct = P(0, yint);
        return {
          variant,
          scene: scene!,
          prompt:
            "The graph shows an exponential function. At which point does the graph cross the $y$-axis?",
          hint: "The $y$-axis is the line $x=0$. Find where the curve meets it and read the height from the grid.",
          explanation: [
            "The graph crosses the $y$-axis where $x=0$.",
            `Reading the grid at $x=0$ gives $y=${yint}$.`,
            `The $y$-intercept is ${correct}.`,
          ],
          correct,
          wrong: pickWrong(r, correct, [
            {
              label: P(0, k),
              feedback: `Height ${k} is where the curve levels off (the asymptote), not where it meets the $y$-axis.`,
            },
            {
              label: P(yint, 0),
              feedback:
                "The $y$-coordinate comes second. A $y$-intercept has $x=0$.",
            },
            {
              label: P(0, -yint),
              feedback:
                "Check whether the curve is above or below the $x$-axis at $x=0$; the sign of the height is reversed.",
            },
            {
              label: P(0, a),
              feedback:
                "Read the height where the curve itself meets the $y$-axis, using the grid lines.",
            },
            {
              label: P(0, yint + (yint > 0 ? 1 : -1)),
              feedback:
                "Count the grid lines carefully from the $x$-axis to the point where the curve meets the $y$-axis.",
            },
          ]),
        };
      }
      if (variant === "exp-graph-statement") {
        const dir = (up: boolean) => (up ? "increasing" : "decreasing");
        const st = (asym: string, up: boolean) =>
          `The graph is ${dir(up)} with horizontal asymptote ${asym}.`;
        const correct = st(`$y=${k}$`, inc);
        return {
          variant,
          scene: scene!,
          prompt:
            "Which statement is true for the exponential function whose graph is shown?",
          hint: "Look at the left and right ends of the curve: which height does it level off at, and does the curve rise or fall as you move right?",
          explanation: [
            `The curve levels off at $y=${k}$, so that is the horizontal asymptote.`,
            `Moving right, the curve ${inc ? "rises" : "falls"}, so the function is ${dir(inc)}.`,
            correct,
          ],
          correct,
          wrong: pickWrong(r, correct, [
            {
              label: st(`$y=${k}$`, !inc),
              feedback: `Follow the curve left to right: it ${inc ? "rises" : "falls"}.`,
            },
            {
              label: st(`$y=${yint}$`, inc),
              feedback: `Height ${yint} is where the curve crosses the $y$-axis. The curve keeps moving toward ${k}.`,
            },
            {
              label: st("$x=0$", inc),
              feedback:
                "An exponential function has a horizontal asymptote, not a vertical one at $x=0$.",
            },
            {
              label: st("$y=0$", !inc),
              feedback:
                "The curve levels off at the height of its shift, not at the $x$-axis, unless the graph is unshifted.",
            },
          ]),
        };
      }
      // exp-end-behavior
      const inf = a > 0 ? "\\infty" : "-\\infty";
      const flip = a > 0 ? "-\\infty" : "\\infty";
      const ends = (right: string, left: string) =>
        math(
          `x\\to\\infty:\\ f(x)\\to${right};\\quad x\\to-\\infty:\\ f(x)\\to${left}`,
        );
      const rightEnd = b > 1 ? inf : String(k);
      const leftEnd = b > 1 ? String(k) : inf;
      const correct = ends(rightEnd, leftEnd);
      return {
        variant,
        prompt: `Which describes the end behavior of $${eq}$?`,
        hint: `Decide what $${b === 0.5 ? "\\left(\\tfrac12\\right)" : b}^x$ does as $x$ grows large and as $x$ becomes very negative. Then apply the coefficient ${a} and the shift ${k}.`,
        explanation: [
          `For base ${b === 0.5 ? "1/2" : b}, the power ${b > 1 ? "grows without bound as $x$ increases and approaches 0 as $x$ decreases" : "approaches 0 as $x$ increases and grows without bound as $x$ decreases"}.`,
          `Multiplying by ${a} ${a > 0 ? "keeps it growing upward" : "turns the growth downward"}, and adding ${k} moves the leveling-off height to ${k}.`,
          `As $x\\to\\infty$, $f(x)\\to${rightEnd}$; as $x\\to-\\infty$, $f(x)\\to${leftEnd}$.`,
        ],
        correct,
        wrong: pickWrong(r, correct, [
          {
            label: ends(leftEnd, rightEnd),
            feedback:
              "The two ends are swapped. Check which direction makes the power grow.",
          },
          {
            label: ends(String(k), String(k)),
            feedback:
              "The curve levels off at only one end; at the other it grows without bound.",
          },
          {
            label: ends(b > 1 ? flip : String(k), b > 1 ? String(k) : flip),
            feedback:
              "The sign of the coefficient decides whether the unbounded end goes up or down.",
          },
          {
            label: ends(inf, inf),
            feedback:
              "Only one end grows without bound; the other approaches the asymptote.",
          },
        ]),
      };
    }
  }
  // logarithmic variants
  const a =
    variant === "log-graph-intercept" || variant === "log-graph-domain"
      ? r(0, 1)
        ? 1
        : -1
      : [1, 2, -1][r(0, 2)]!;
  const base = [2, 3][r(0, 1)]!;
  const h = nz(1, 4);
  if (variant === "log-domain-asymptote") {
    const k = nz(1, 4);
    const eq = `f(x)=${logText(a, base, h, k)}`;
    const lbl = (c: number | string) =>
      math(`\\text{domain }x>${c};\\ \\text{vertical asymptote }x=${c}`);
    const correct = lbl(h);
    return {
      variant,
      prompt: `For $${eq}$, which gives the domain and the vertical asymptote?`,
      hint: `A logarithm needs a positive input. Set the expression inside the parentheses greater than 0 and solve for $x$.`,
      explanation: [
        `The input of the logarithm must be positive: $${shiftText(h)}>0$.`,
        `Solving gives $x>${h}$, so the domain is $x>${h}$.`,
        `The graph approaches the vertical line $x=${h}$ without touching it: the vertical asymptote. The added ${k} moves the graph up or down but does not change the domain.`,
      ],
      correct,
      wrong: pickWrong(r, correct, [
        {
          label: lbl(-h),
          feedback: `Solve $${shiftText(h)}>0$ carefully: the shift moves the asymptote to $x=${h}$, not $x=${-h}$.`,
        },
        {
          label: lbl(0),
          feedback:
            "The input is shifted, so the domain starts at the shift, not at 0.",
        },
        {
          label: lbl(k),
          feedback:
            "The constant outside the logarithm shifts the graph vertically and does not affect the domain.",
        },
        {
          label: math(
            `\\text{domain }x>${h};\\ \\text{horizontal asymptote }y=${k}`,
          ),
          feedback:
            "A logarithmic function has a vertical asymptote at the edge of its domain.",
        },
      ]),
    };
  }
  const scene = logGraphScene(a, base, h);
  if (variant === "log-graph-domain") {
    const dom = (c: number) => math(`x>${c}`);
    const correct = dom(h);
    return {
      variant,
      scene,
      prompt: "The graph shows a logarithmic function. What is its domain?",
      hint: "Find the vertical line the curve climbs along without touching. The function is defined only on one side of it.",
      explanation: [
        `The curve approaches the vertical line $x=${h}$ but never reaches it.`,
        `It exists only to the right of that line.`,
        `The domain is ${correct}.`,
      ],
      correct,
      wrong: pickWrong(r, correct, [
        {
          label: dom(h + 1),
          feedback: `$x=${h + 1}$ is where the curve crosses the $x$-axis, not where it begins.`,
        },
        {
          label: dom(0),
          feedback: "The graph's vertical asymptote is not at the $y$-axis here.",
        },
        {
          label: math(`x<${h}`),
          feedback:
            "The curve is on the right of the asymptote, so the domain is the numbers greater than the asymptote.",
        },
        {
          label: math("\\text{all real numbers}"),
          feedback:
            "A logarithmic function is not defined on both sides of its vertical asymptote.",
        },
      ]),
    };
  }
  // log-graph-intercept
  const P = (x: number, y: number) => math(`(${x},${y})`);
  const correct = P(h + 1, 0);
  return {
    variant,
    scene,
    prompt:
      "The graph shows a logarithmic function. At which point does it cross the $x$-axis?",
    hint: "The $x$-axis is the line $y=0$. Find where the curve meets it and read the $x$-coordinate from the grid.",
    explanation: [
      "The graph crosses the $x$-axis where $y=0$.",
      `Reading the grid there gives $x=${h + 1}$.`,
      `The $x$-intercept is ${correct}.`,
    ],
    correct,
    wrong: pickWrong(r, correct, [
      {
        label: P(h, 0),
        feedback: `$x=${h}$ is the vertical asymptote. The curve never reaches it.`,
      },
      {
        label: P(0, h + 1),
        feedback: "The $x$-coordinate comes first. An $x$-intercept has $y=0$.",
      },
      {
        label: P(h + base, 1),
        feedback: "That point is not on the $x$-axis. The $x$-intercept has $y=0$.",
      },
      {
        label: P(h + 2, 0),
        feedback:
          "Check the grid: the curve reaches height 0 one unit to the right of its asymptote.",
      },
    ]),
  };
}

const builders: Record<string, (r: Random) => Built> = {
  "series-recursion": seriesRecursion,
  "compound-growth": compoundGrowth,
  "polynomial-factoring-patterns": factoringPatterns,
  "residual-function-fit": residualFunctionFit,
  "function-graph-features": graphFeatures,
};

/** Private exact model; the variant name is kept for tests only. */
export function advancedMathGapCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; variant: string; correctLabel: string } {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const template = advancedMathGapTemplates.find((t) => t.id === id);
  const build = builders[id];
  if (!template || !build) throw new Error(`Unknown template ${id}`);
  const r = random(id, seed);
  const built = build(r);
  const wrong = pickWrong(r, built.correct, built.wrong);
  return {
    variant: built.variant,
    correctLabel: built.correct,
    problem: assemble(template, seed, r, {
      prompt: built.prompt,
      ...(built.scene
        ? { figure: { kind: "scene" as const, scene: built.scene } }
        : {}),
      answer: "",
      hint: built.hint,
      explanation: built.explanation,
      choices: [
        { label: built.correct, correct: true },
        ...wrong.map((w) => ({ label: w.label, feedback: w.feedback })),
      ],
    }),
  };
}
export function generateAdvancedMathGapProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return advancedMathGapCase(id, seed).problem;
}
