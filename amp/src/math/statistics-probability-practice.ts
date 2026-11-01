import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import {
  assemble,
  random,
  rational,
  shown,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice";

/** High-school statistics and probability (HSS.ID.A.4, HSS.IC, HSS.MD): normal
 * models, random variables and distributions, decisions under uncertainty,
 * simulation and randomization, critique of reports and model validation.
 * Every template is a single-choice family whose exact answer comes from a
 * private case model; distractors are named misconceptions with feedback. */
const base = {
  gradeBand: "9–12",
  requiredResponseCapability: "single-choice-v1",
} as const;

export const statisticsProbabilityTemplates: readonly TemplateMetadata[] = [
  {
    id: "normal-model-rule",
    version: 1,
    title: "Normal models and the 68–95–99.7 rule",
    skillId: "normal-distributions",
    difficultyOffset: 0.3,
    description:
      "Use the empirical rule for percents between, above and below mean $\\pm k$ standard deviations, find an interval for a stated percent, compare values by $z$-score, and judge when a normal model is not appropriate.",
    ...base,
  },
  {
    id: "random-variable-distribution",
    version: 1,
    title: "Random variables and their distributions",
    skillId: "random-variables",
    difficultyOffset: 0.25,
    description:
      "Define a numerical random variable, find the probability of one of its values, read a probability distribution bar chart and complete a distribution whose probabilities sum to 1.",
    ...base,
  },
  {
    id: "theoretical-distribution-expectation",
    version: 1,
    title: "Theoretical distributions and expected value",
    skillId: "theoretical-distributions",
    difficultyOffset: 0.4,
    description:
      "Build a distribution from equally likely outcomes (sum of two dice) or three independent trials and compute probabilities and expected value exactly.",
    ...base,
  },
  {
    id: "empirical-distribution-expectation",
    version: 1,
    title: "Empirical distributions and expected value",
    skillId: "empirical-distributions",
    difficultyOffset: 0.3,
    description:
      "From observed frequencies, find relative frequencies, the expected value per trial and the expected total for a larger population.",
    ...base,
  },
  {
    id: "strategy-expected-value",
    version: 1,
    title: "Choose a strategy by expected value",
    skillId: "decision-strategies",
    difficultyOffset: 0.45,
    description:
      "Compare the expected payoffs of games, a warranty and a sure amount against a gamble, and select the statement the expected values justify.",
    ...base,
  },
  {
    id: "fair-selection-procedure",
    version: 1,
    title: "Fair random selection",
    skillId: "fair-random-decisions",
    difficultyOffset: 0.35,
    description:
      "Choose a random procedure that gives every person the same chance, and compute the chance each person has under a given procedure.",
    ...base,
  },
  {
    id: "simulation-consistency-check",
    version: 1,
    title: "Is the result consistent with the model?",
    skillId: "simulation-model-checks",
    difficultyOffset: 0.4,
    description:
      "Use a chart of simulated results to find the fraction at least as extreme as an observed result and decide whether the model is consistent with it at a stated cutoff.",
    ...base,
  },
  {
    id: "randomization-test-decision",
    version: 1,
    title: "Is the treatment difference significant?",
    skillId: "randomization-tests",
    difficultyOffset: 0.5,
    description:
      "Use the distribution of differences from re-randomized groups to find the proportion as or more extreme than the observed difference and decide significance at a stated cutoff.",
    ...base,
  },
  {
    id: "report-flaw-critique",
    version: 1,
    title: "Find the flaw in a report",
    skillId: "statistical-report-critique",
    difficultyOffset: 0.4,
    description:
      "Identify voluntary response, a convenience sample, a too-small sample, a missing margin of error or a truncated axis, including reports with two flaws.",
    ...base,
  },
  {
    id: "model-residual-conclusion",
    version: 1,
    title: "Check a model against data",
    skillId: "model-validation",
    difficultyOffset: 0.5,
    description:
      "Read a residual table to choose the justified conclusion about a model: a curved pattern, no pattern, an extrapolation or which of two models fits better.",
    ...base,
  },
];

// ---------------------------------------------------------------- helpers
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** LaTeX body of a reduced fraction, "3", or "-\frac{1}{2}". */
function frac(n: number, d: number) {
  const g = gcd(Math.abs(n), d) || 1;
  const num = n / g;
  const den = d / g;
  if (den === 1) return `${num}`;
  return `${num < 0 ? "-" : ""}\\frac{${Math.abs(num)}}{${den}}`;
}
const f = (n: number, d: number) => `$${frac(n, d)}$`;
const choose = (n: number, k: number) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c;
};
const pct = (x: number) => `${+x.toFixed(2)}%`;
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

type Wrong = { label: string; feedback: string };
/** One correct choice plus three distinct wrong choices, drawn in a seeded order. */
function options(r: Random, correct: string, wrong: Wrong[]): Draft["choices"] {
  const seen = new Set([correct]);
  const unique = shuffle(r, wrong).filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (unique.length < 3)
    throw new Error(
      `Only ${unique.length} distinct wrong choices for ${correct}`,
    );
  return [{ label: correct, correct: true }, ...unique.slice(0, 3)];
}
type Built = { variant: string; draft: Draft };
const chart = (
  categories: (string | number)[],
  values: number[],
  valueLabel: string,
): SemanticFigure => ({
  kind: "bar-chart",
  categories: categories.map(String),
  values,
  valueLabel,
});

/** Integer counts that add to `total`, shaped like a bell curve with seeded jitter. */
function bellCounts(
  r: Random,
  lo: number,
  hi: number,
  center: number,
  sd: number,
  total: number,
) {
  const weights = Array.from({ length: hi - lo + 1 }, (_, i) =>
    Math.exp(-((lo + i - center) ** 2) / (2 * sd * sd)),
  );
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (w / sum) * total);
  const counts = raw.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => [v - Math.floor(v), i] as const)
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; left > 0; i++, left--) counts[order[i % order.length]![1]]!++;
  for (let move = 0; move < 6; move++) {
    const from = r(0, counts.length - 1);
    const to = Math.max(
      0,
      Math.min(counts.length - 1, from + (r(0, 1) ? 1 : -1)),
    );
    if (from !== to && counts[from]! > 1) {
      counts[from]!--;
      counts[to]!++;
    }
  }
  return counts;
}

// ------------------------------------------------------- normal-distributions
/** Plain meanings repeated at first use in every explanation. */
const NORMAL =
  "A normal distribution is a symmetric, bell-shaped spread of values. The mean, the average, sits at the center. The standard deviation (SD) is the typical distance of a value from the mean.";
const RULE =
  "The 68–95–99.7 rule says that in a normal distribution about 68% of values lie within 1 SD of the mean, 95% within 2 SD, and 99.7% within 3 SD.";
const RANDOM_VARIABLE =
  "A random variable, such as $X$, is a number decided by chance. $P(X=k)$, read \"the probability that $X$ equals $k$\", is the chance it takes the value $k$.";
const EXPECTED =
  "The expected value is the long-run average: multiply each possible value by its probability and add the results.";
const inside: Record<number, number> = { 1: 68, 2: 95, 3: 99.7 };
const half: Record<number, number> = { 1: 34, 2: 47.5, 3: 49.85 };
const tail: Record<number, number> = { 1: 16, 2: 2.5, 3: 0.15 };
const below: Record<number, number> = { 1: 84, 2: 97.5, 3: 99.85 };
const normalContexts = [
  {
    what: "The heights of adult women in a large city",
    unit: "cm",
    mean: [158, 166],
    sd: [4, 7],
  },
  {
    what: "The fill weights of boxes from a cereal machine",
    unit: "g",
    mean: [480, 520],
    sd: [3, 8],
  },
  {
    what: "The scores on a placement exam",
    unit: "points",
    mean: [60, 80],
    sd: [6, 12],
  },
  {
    what: "The lengths of bolts from one factory line",
    unit: "mm",
    mean: [48, 56],
    sd: [2, 5],
  },
] as const;
const shapeBank = {
  normal: [
    "Heights of 2,000 adult men: symmetric and bell-shaped; mean and median both 176 cm.",
    "Diameters of 500 bolts from one machine: symmetric, one peak; mean and median both 10.0 mm.",
    "Birth weights of 1,500 full-term babies: symmetric, one peak; mean and median both 3.4 kg.",
  ],
  skewed: [
    {
      text: "Yearly incomes of 1,000 households: long right tail; mean $82,000, median $56,000.",
      why: "A long right tail with the mean far above the median means the data are skewed; a normal curve is symmetric.",
    },
    {
      text: "Clinic waiting times: many short waits, a few very long; mean well above the median.",
      why: "Waiting times bunch near zero and trail off to the right, so they are skewed; a normal curve is symmetric.",
    },
    {
      text: "Scores on a very easy 20-point quiz: most 18 to 20, a long tail of low scores; mean below median.",
      why: "The scores pile up at the maximum and tail to the left, so they are skewed; a normal curve is symmetric.",
    },
    {
      text: "Ages at a family party: one peak near age 8 and another near age 38.",
      why: "Two separate peaks mean the data are not mound-shaped; a normal curve has one peak.",
    },
  ],
} as const;

function normalCase(r: Random): Built {
  const ctx = pick(r, normalContexts);
  const m = r(ctx.mean[0], ctx.mean[1]);
  const s = r(ctx.sd[0], ctx.sd[1]);
  const model = `${ctx.what} are approximately normal with mean ${m} ${ctx.unit} and standard deviation ${s} ${ctx.unit}.`;
  const variant = (
    [
      "between-symmetric",
      "between-asymmetric",
      "one-sided",
      "find-interval",
      "z-compare",
      "model-appropriate",
    ] as const
  )[r(0, 5)]!;
  if (variant === "between-symmetric") {
    const k = r(1, 3);
    const ks = k * s;
    const correct = pct(inside[k]!);
    const others = [1, 2, 3].filter((x) => x !== k);
    return {
      variant,
      draft: {
        prompt: `${model} Using the 68–95–99.7 rule, about what percent of values lie between ${m - ks} and ${m + ks} ${ctx.unit}?`,
        answer: correct,
        hint: `The mean is ${m} and one standard deviation is ${s} ${ctx.unit}. Find how many standard deviations ${m + ks} is above ${m}, then use the matching percent in the rule.`,
        explanation: [
          NORMAL,
          RULE,
          `Measure each end from the mean ${m}. ${m + ks} − ${m} = ${ks} ${ctx.unit}, which is ${ks} ÷ ${s} = ${k} SD. Likewise ${m} − ${m - ks} = ${ks}.`,
          `So the interval reaches ${k} SD on both sides of the mean.`,
          `By the rule, about ${correct} of values lie between ${m - ks} and ${m + ks} ${ctx.unit}.`,
        ],
        choices: options(r, correct, [
          ...others.map((o) => ({
            label: pct(inside[o]!),
            feedback: `That is the percent within ${o} standard deviation${o > 1 ? "s" : ""}. This interval reaches ${k} on each side of the mean.`,
          })),
          {
            label: pct(half[k]!),
            feedback:
              "That is the percent on one side of the mean only. This interval covers both sides.",
          },
          {
            label: pct(100 - inside[k]!),
            feedback:
              "That is the percent outside the interval. The question asks for the percent inside.",
          },
        ]),
      },
    };
  }
  if (variant === "between-asymmetric") {
    const k1 = r(1, 3);
    let k2 = r(1, 3);
    if (k2 === k1) k2 = (k1 % 3) + 1;
    const correct = pct(half[k1]! + half[k2]!);
    return {
      variant,
      draft: {
        prompt: `${model} Using the 68–95–99.7 rule, about what percent of values lie between ${m - k1 * s} and ${m + k2 * s} ${ctx.unit}?`,
        answer: correct,
        hint: `Split the interval at the mean ${m}. The left part reaches ${k1 * s} ${ctx.unit} below it and the right part ${k2 * s} ${ctx.unit} above it; each part is a different number of standard deviations (${s} ${ctx.unit}).`,
        explanation: [
          NORMAL,
          RULE,
          `The left end is ${k1 * s} ÷ ${s} = ${k1} SD below the mean, and the right end is ${k2 * s} ÷ ${s} = ${k2} SD above. The two sides differ, so split at the mean.`,
          `The bell is symmetric, so each side holds half of the rule's percent: ${pct(half[k1]!)} from the mean down to ${k1} SD below, and ${pct(half[k2]!)} from the mean up to ${k2} SD above.`,
          `Add the two sides: ${half[k1]} + ${half[k2]} = ${+(half[k1]! + half[k2]!).toFixed(2)}.`,
          `So about ${correct} of values lie between ${m - k1 * s} and ${m + k2 * s} ${ctx.unit}.`,
        ],
        choices: options(r, correct, [
          {
            label: pct(inside[Math.max(k1, k2)]!),
            feedback:
              "That treats the interval as symmetric about the mean using the longer side. The two sides have different lengths.",
          },
          {
            label: pct(inside[Math.min(k1, k2)]!),
            feedback:
              "That treats the interval as symmetric about the mean using the shorter side. The sides have different lengths.",
          },
          {
            label: pct(half[Math.max(k1, k2)]!),
            feedback:
              "That is the percent between the mean and the farther end only. The interval also reaches the nearer end on the other side.",
          },
          {
            label: pct(100 - half[k1]! - half[k2]!),
            feedback:
              "That is the percent outside the interval. The question asks for the percent inside.",
          },
          {
            label: pct(Math.abs(half[k1]! - half[k2]!)),
            feedback:
              "The two parts lie on opposite sides of the mean, so add them rather than subtract.",
          },
        ]),
      },
    };
  }
  if (variant === "one-sided") {
    const k = r(1, 3);
    const upperBoundary = r(0, 1) === 1;
    const wantAbove = r(0, 1) === 1;
    const boundary = upperBoundary ? m + k * s : m - k * s;
    const smallSide = wantAbove === upperBoundary; // The region is the far tail.
    const answer = smallSide ? tail[k]! : below[k]!;
    const correct = pct(answer);
    const word = wantAbove ? "greater than" : "less than";
    return {
      variant,
      draft: {
        prompt: `${model} Using the 68–95–99.7 rule, about what percent of values are ${word} ${boundary} ${ctx.unit}?`,
        answer: correct,
        hint: `${boundary} is ${k * s} ${ctx.unit} ${upperBoundary ? "above" : "below"} the mean ${m}. Find how many standard deviations that is, then decide which side of ${boundary} the question asks about.`,
        explanation: [
          NORMAL,
          RULE,
          `${boundary} is ${k * s} ÷ ${s} = ${k} SD ${upperBoundary ? "above" : "below"} the mean ${m}.`,
          `Within ${k} SD of the mean lies ${pct(inside[k]!)}. The other ${pct(100 - inside[k]!)} lies outside, split equally into two tails (the ends of the bell) of ${pct(tail[k]!)} each.`,
          smallSide
            ? `Values ${word} ${boundary} form one outer tail: ${pct(tail[k]!)}.`
            : `Values ${word} ${boundary} are everything except the far tail: 100% − ${pct(tail[k]!)} = ${correct}.`,
          `So about ${correct} of values are ${word} ${boundary} ${ctx.unit}.`,
        ],
        choices: options(r, correct, [
          {
            label: pct(smallSide ? below[k]! : tail[k]!),
            feedback:
              "That is the percent on the other side of the boundary. Check whether the question asks for greater than or less than.",
          },
          {
            label: pct(100 - inside[k]!),
            feedback:
              "That counts both outer tails. Only one side of the boundary is asked for.",
          },
          {
            label: pct(inside[k]!),
            feedback:
              "That is the percent within the interval mean ± the same number of standard deviations, not a one-sided percent.",
          },
          {
            label: pct(half[k]!),
            feedback:
              "That is the percent between the mean and the boundary, not beyond the boundary.",
          },
        ]),
      },
    };
  }
  if (variant === "find-interval") {
    const k = r(1, 3);
    const interval = (j: number) => `${m - j * s} to ${m + j * s} ${ctx.unit}`;
    const correct = interval(k);
    const others = [1, 2, 3].filter((x) => x !== k);
    return {
      variant,
      draft: {
        prompt: `${model} About ${inside[k]}% of the values lie within which interval, by the 68–95–99.7 rule?`,
        answer: correct,
        hint: `The rule links ${inside[k]}% to a number of standard deviations either side of the mean ${m}. Find that number, then multiply it by ${s} ${ctx.unit} to build both ends.`,
        explanation: [
          NORMAL,
          RULE,
          `So ${inside[k]}% lies within ${k} SD of the mean, on both sides.`,
          `${k} SD is ${k} × ${s} = ${k * s} ${ctx.unit}.`,
          `Go that far each way from the mean: ${m} − ${k * s} = ${m - k * s} and ${m} + ${k * s} = ${m + k * s}.`,
          `So about ${inside[k]}% of values lie from ${correct}.`,
        ],
        choices: options(r, correct, [
          ...others.map((o) => ({
            label: interval(o),
            feedback: `That interval is mean ± ${o} standard deviation${o > 1 ? "s" : ""}, which holds ${inside[o]}%, not ${inside[k]}%.`,
          })),
          {
            label: `${m} to ${m + k * s} ${ctx.unit}`,
            feedback:
              "That is one side of the mean only, so it holds half of the stated percent.",
          },
          {
            label: `${m - k} to ${m + k} ${ctx.unit}`,
            feedback: `Multiply the number of standard deviations by the standard deviation, ${s} ${ctx.unit}, before adding to and subtracting from the mean.`,
          },
        ]),
      },
    };
  }
  if (variant === "z-compare") {
    const names = pick(r, [
      ["Maya", "Leo", "algebra", "geometry"],
      ["Priya", "Mateo", "biology", "chemistry"],
      ["Nora", "Sam", "reading", "writing"],
    ] as const);
    const zA = pick(r, [1, 1.5, 2, 2.5]);
    const zs = (z: number) => `${z < 0 ? "−" : ""}${Math.abs(z)}`;
    const zB = pick(
      r,
      [-0.5, 0, 0.5, 1].filter((z) => z < zA),
    );
    const sA = 2 * r(2, 6);
    const sB = 2 * r(2, 6);
    const mA = r(60, 80);
    const xA = mA + zA * sA;
    const xB = xA + r(3, 15);
    const mB = xB - zB * sB;
    const [nameA, nameB, subA, subB] = names;
    const correct = `${nameA}: z = ${zs(zA)}, compared with z = ${zs(zB)} for ${nameB}`;
    return {
      variant,
      draft: {
        prompt: `Both exams have approximately normal scores. ${nameA} scored ${xA} on the ${subA} exam (mean ${mA}, standard deviation ${sA}). ${nameB} scored ${xB} on the ${subB} exam (mean ${mB}, standard deviation ${sB}). Who scored higher relative to the others who took the same exam? Compare $z$-scores, where $z=\\frac{\\text{score}-\\text{mean}}{\\text{standard deviation}}$.`,
        answer: correct,
        hint: `Raw scores ${xA} and ${xB} come from different exams. Convert each to the number of standard deviations from its own mean: subtract the mean, then divide by the standard deviation.`,
        explanation: [
          "The exams have different averages, called means, and different typical spreads, called standard deviations. So raw scores cannot be compared directly.",
          "A $z$-score puts them on one scale: how many standard deviations a score is above or below its own mean.",
          `${nameA}: $z=(${xA}-${mA})\\div${sA}=${zs(zA)}$.`,
          `${nameB}: $z=(${xB}-${mB})\\div${sB}=${zs(zB)}$.`,
          `A larger $z$-score is farther above the mean. So ${nameA} scored higher relative to the ${subA} group, even though ${nameB} has the higher raw score.`,
        ],
        choices: options(r, correct, [
          {
            label: `${nameB}: higher raw score, ${xB} compared with ${xA}`,
            feedback:
              "The exams have different means and spreads, so raw scores are not comparable. Standardize with $z$-scores.",
          },
          {
            label: `${nameB}: z = ${zs(zB)}, compared with z = ${zs(zA)} for ${nameA}`,
            feedback:
              "A larger $z$-score means farther above the mean, so the larger $z$-score is the better relative result. These two $z$-scores are in the wrong order.",
          },
          {
            label: "Neither: scores from different exams cannot be compared",
            feedback:
              "Standardizing to $z$-scores puts both scores on the same scale, number of standard deviations from the mean, so they can be compared.",
          },
        ]),
      },
    };
  }
  const normalText = pick(r, shapeBank.normal);
  const skewedPool = shuffle(r, [...shapeBank.skewed]).slice(0, 3);
  return {
    variant: "model-appropriate",
    draft: {
      prompt:
        "A student plans to use a normal model with the 68–95–99.7 rule. For which data set is a normal model most appropriate?",
      answer: normalText,
      hint: "The 68–95–99.7 rule needs a normal curve, which is symmetric with one peak, so its mean equals its median. Check each description for the shape and for the mean compared with the median.",
      explanation: [
        "A normal model is a symmetric bell curve with one peak. Its mean (the average) equals its median (the middle value).",
        "So it fits data that are symmetric and mound-shaped. Skewed data, with a long tail on one side, pull the mean away from the median.",
        `${normalText} matches the bell shape.`,
        "The other descriptions are skewed or have two peaks, so the 68–95–99.7 percents would not describe them.",
        `So the normal model is most appropriate for: ${normalText.replace(/\.$/, "")}.`,
      ],
      choices: options(
        r,
        normalText,
        skewedPool.map((s) => ({ label: s.text, feedback: s.why })),
      ),
    },
  };
}

// ----------------------------------------------------------- random-variables
function randomVariableCase(r: Random): Built {
  const variant = (
    [
      "list-probability",
      "define-variable",
      "read-distribution",
      "missing-probability",
    ] as const
  )[r(0, 3)]!;
  if (variant === "list-probability") {
    if (r(0, 1) === 0) {
      const n = r(3, 4);
      const k = r(0, n);
      const ways = choose(n, k);
      const total = 2 ** n;
      const correct = f(ways, total);
      return {
        variant: "list-probability",
        draft: {
          prompt: `A fair coin is tossed ${n} times. Let $X$ be the number of heads. What is $P(X=${k})$?`,
          answer: correct,
          hint: `List which of the ${total} equally likely sequences of ${n} tosses have exactly ${k} head${k === 1 ? "" : "s"}. $X=${k}$ is an event made of several outcomes, not a single one.`,
          explanation: [
            RANDOM_VARIABLE,
            `Each toss has 2 results, so ${n} tosses have $2^{${n}}=${total}$ equally likely sequences.`,
            `$\\binom{${n}}{${k}}$, read "${n} choose ${k}", counts the ways to pick which ${k} of the ${n} tosses are heads. Here it is ${ways}.`,
            `Probability is favorable outcomes over all outcomes: $P(X=${k})=\\frac{${ways}}{${total}}$${gcd(ways, total) > 1 ? `, which reduces to ${correct}` : ""}.`,
            `So $P(X=${k})=${frac(ways, total)}$.`,
          ],
          choices: options(r, correct, [
            {
              label: f(1, n + 1),
              feedback: `The ${n + 1} values of $X$ are not equally likely; some happen in more ways.`,
            },
            {
              label: f(1, total),
              feedback:
                "That is the chance of one specific sequence. Count all sequences with this number of heads.",
            },
            {
              label: f(k, n),
              feedback:
                "That is the fraction of tosses that are heads, not the probability that $X$ takes this value.",
            },
            {
              label: f(ways, 2 * n),
              feedback: `The total number of equally likely sequences is $2^{${n}}=${total}$, not ${2 * n}.`,
            },
            {
              label: f(ways + 1, total),
              feedback:
                "The count is one too high. Count the sequences with this many heads exactly.",
            },
            {
              label: f(ways, total + 1),
              feedback: `The total is one too high. There are exactly $2^{${n}}=${total}$ equally likely sequences.`,
            },
          ]),
        },
      };
    }
    const k = r(1, 6);
    const correct = f(2 * k - 1, 36);
    return {
      variant: "list-probability",
      draft: {
        prompt: `Two fair six-sided dice are rolled. Let $X$ be the larger of the two numbers (if they match, $X$ is that number). What is $P(X=${k})$?`,
        answer: correct,
        hint: `There are 36 equally likely pairs. Count the pairs in which the larger number is exactly ${k}: both dice at most ${k}, but not both at most ${k - 1}.`,
        explanation: [
          RANDOM_VARIABLE,
          "Two dice give $6\\times6=36$ equally likely pairs. Count the pairs whose larger number is exactly the target by subtracting.",
          `Pairs with both dice at most ${k}: $${k}^2=${k * k}$. In these, the larger number is ${k} or less.`,
          `Pairs with both dice at most ${k - 1}: $${k - 1}^2=${(k - 1) ** 2}$. Removing them leaves pairs whose larger number is exactly ${k}.`,
          `${k * k} − ${(k - 1) ** 2} = ${2 * k - 1} pairs, out of 36.`,
          `So $P(X=${k})=\\frac{${2 * k - 1}}{36}$.`,
        ],
        choices: options(r, correct, [
          {
            label: f(1, 6),
            feedback:
              "This treats the six values of $X$ as equally likely. Larger values can happen in more ways, so count pairs.",
          },
          {
            label: f(k, 36),
            feedback: `Count every pair whose larger number is ${k}, not just ${k} of them.`,
          },
          {
            label: f(k * k, 36),
            feedback: `That is $P(X\\le ${k})$: it also counts pairs whose larger number is smaller. Subtract those.`,
          },
          {
            label: f(2 * k + 1, 36),
            feedback:
              "The count is two too high. The number of pairs is one less than twice the value.",
          },
          {
            label: f(1, 36),
            feedback:
              "That counts only the pair where both dice match. Count every pair whose larger number is this value.",
          },
          {
            label: f(2 * (7 - k) - 1, 36),
            feedback:
              "That is the probability for the value at the other end of the range. Count the pairs whose larger number is exactly this value.",
          },
          {
            label: f(k, 6),
            feedback:
              "There are 36 equally likely pairs, so divide by 36 after counting the pairs.",
          },
        ]),
      },
    };
  }
  if (variant === "define-variable") {
    const bank = [
      {
        setting: "Two fair dice are rolled.",
        good: "$X$ = the sum of the two numbers",
        bad: [
          [
            "$X$ = the pair of numbers shown, such as (3, 5)",
            "A pair is two numbers, not one numerical value for each outcome.",
          ],
          [
            "$X$ = whether the two numbers match",
            "That is a yes/no description. A random variable needs a number, such as 1 for a match and 0 otherwise.",
          ],
          [
            "$X$ = the die that shows the greater number",
            "That names a die, not a number.",
          ],
        ],
      },
      {
        setting: "A family has three children.",
        good: "$X$ = the number of girls among the children",
        bad: [
          [
            "$X$ = the order of boys and girls from oldest to youngest",
            "That is a sequence of labels, not a single number.",
          ],
          [
            "$X$ = whether there are more girls than boys",
            "That is a yes/no description, not a number.",
          ],
          ["$X$ = the family's last name", "A name is not numerical."],
        ],
      },
      {
        setting: "Two marbles are drawn from a bag of red and blue marbles.",
        good: "$X$ = the number of red marbles drawn",
        bad: [
          [
            "$X$ = the colors drawn, in order",
            "That lists colors, which are not numbers.",
          ],
          [
            "$X$ = whether both marbles match in color",
            "That is a yes/no description, not a number.",
          ],
          ["$X$ = red or blue", "A color is not numerical."],
        ],
      },
      {
        setting: "A basketball player takes four free throws.",
        good: "$X$ = the number of free throws made",
        bad: [
          [
            "$X$ = the sequence of makes and misses",
            "That is a list of outcomes, not one number.",
          ],
          [
            "$X$ = whether the player makes the first shot",
            "That is a yes/no description, not a number.",
          ],
          ["$X$ = the player's name", "A name is not numerical."],
        ],
      },
    ] as const;
    const item = pick(r, bank);
    return {
      variant: "define-variable",
      draft: {
        prompt: `${item.setting} Which definition gives a numerical random variable $X$ on this experiment, with one number for each outcome?`,
        answer: item.good,
        hint: "A random variable assigns exactly one number to each outcome. Test each choice by asking whether every outcome gets a single number you could list in a table of values and probabilities.",
        explanation: [
          "A random variable is a rule that gives each possible outcome of an experiment exactly one number.",
          "That number lets us list the values in a table with their probabilities, the chance of each.",
          `${item.good} gives each outcome one count.`,
          "The other choices give labels, pairs or yes/no answers instead of a single number.",
          `So the numerical random variable is: ${item.good}.`,
        ],
        choices: options(
          r,
          item.good,
          item.bad.map(([label, feedback]) => ({ label, feedback })),
        ),
      },
    };
  }
  if (variant === "read-distribution") {
    const values = [0, 1, 2, 3, 4];
    const counts = values.map(() => r(1, 5));
    const total = counts.reduce((a, b) => a + b, 0);
    const figure = chart(values, counts, "Equally likely outcomes");
    const kind = r(0, 2);
    const k = r(1, 3);
    let question: string;
    let c: number;
    let hintText: string;
    let steps: string;
    if (kind === 0) {
      c = counts[k]!;
      question = `$P(X=${k})$`;
      hintText = `Find the bar for $X=${k}$ and divide its height by the total height of all five bars.`;
      steps = `Bar at ${k}: ${c}.`;
    } else if (kind === 1) {
      c = counts.slice(k).reduce((a, b) => a + b, 0);
      question = `$P(X\\ge ${k})$`;
      hintText = `$X\\ge ${k}$ includes the bar at ${k} and every bar to its right. Add those heights, then divide by the total height of all the bars.`;
      steps = `Bars from ${k} up: ${counts.slice(k).join(" + ")} = ${c}.`;
    } else {
      c = counts.slice(0, k + 1).reduce((a, b) => a + b, 0);
      question = `$P(X\\le ${k})$`;
      hintText = `$X\\le ${k}$ includes the bar at ${k} and every bar to its left. Add those heights, then divide by the total height of all the bars.`;
      steps = `Bars from 0 to ${k}: ${counts.slice(0, k + 1).join(" + ")} = ${c}.`;
    }
    const correct = f(c, total);
    return {
      variant: "read-distribution",
      draft: {
        prompt: `A spinner game has equally likely outcomes. Let $X$ be the score. The bar chart shows how many outcomes give each score. Find ${question}.`,
        figure,
        answer: correct,
        hint: hintText,
        explanation: [
          RANDOM_VARIABLE,
          "The outcomes are equally likely, so a probability is the number of outcomes in the event divided by the total number of outcomes.",
          `Total outcomes, all the bar heights: ${counts.join(" + ")} = ${total}.`,
          steps,
          `So ${question} = $\\frac{${c}}{${total}}$${gcd(c, total) > 1 ? ` = ${correct}` : ""}.`,
        ],
        choices: options(r, correct, [
          {
            label: f(counts[k]!, total),
            feedback:
              "That uses the single bar at this value. Include every bar the event describes.",
          },
          {
            label: `$${c}$`,
            feedback: `A probability is a fraction of the ${total} outcomes. Divide the count by ${total}.`,
          },
          {
            label: f(total - c, total),
            feedback:
              "That is the probability of the opposite event: every outcome not in this one.",
          },
          {
            label: f(c, 5),
            feedback:
              "Divide by the total number of equally likely outcomes, not by the number of bars.",
          },
          {
            label: f(c + 1, total),
            feedback:
              "The count is one too high. Add the bar heights exactly.",
          },
        ]),
      },
    };
  }
  const d = pick(r, [10, 12, 20]);
  const nums = [r(1, 3), r(1, 3), r(1, 3), r(1, 3)];
  const hidden = r(0, 3);
  const given = nums.filter((_, i) => i !== hidden);
  const givenSum = given.reduce((a, b) => a + b, 0);
  const left = d - givenSum;
  const correct = f(left, d);
  const row = nums
    .map((n, i) =>
      i === hidden
        ? `$P(X=${i + 1})=a$`
        : `$P(X=${i + 1})=${f(n, d).slice(1, -1)}$`,
    )
    .join(", ");
  return {
    variant: "missing-probability",
    draft: {
      prompt: `A random variable $X$ takes the values 1, 2, 3 and 4. Its distribution is ${row}. Find $a$.`,
      answer: correct,
      hint: `The probabilities of all possible values of $X$ must add to 1. Add the three given probabilities (they share the denominator ${d}), then find what is left.`,
      explanation: [
        "A probability distribution lists every value of $X$ with its probability. $X$ must take one of these values, so the probabilities add to 1, which means certain.",
        `Add the three given probabilities: they share the denominator ${d}, so add the tops: $\\frac{${givenSum}}{${d}}$.`,
        `The missing one is what is left of 1: $a=1-\\frac{${givenSum}}{${d}}=\\frac{${left}}{${d}}$${gcd(left, d) > 1 ? `, which reduces to ${correct}` : ""}.`,
        `So $a=${frac(left, d)}$.`,
      ],
      choices: options(r, correct, [
        {
          label: f(givenSum, d),
          feedback:
            "That is the sum of the given probabilities. The total must be 1, so subtract it from 1.",
        },
        {
          label: f(1, 4),
          feedback:
            "The four values need not be equally likely. Use the fact that the probabilities add to 1.",
        },
        {
          label: f(left + 1, d),
          feedback:
            "This is one too high. Subtract exactly: 1 minus the sum of the given probabilities.",
        },
        {
          label: f(left, d + 1),
          feedback: `The denominator changed. Keep ${d}, as in the other probabilities.`,
        },
        {
          label: f(left - 1 > 0 ? left - 1 : left + 2, d),
          feedback:
            "This is off by an arithmetic slip. Subtract exactly: 1 minus the sum of the given probabilities.",
        },
      ]),
    },
  };
}

// ------------------------------------------------------ theoretical-distributions
const diceEvents = [
  { text: "the sum is 7", ways: 6 },
  { text: "the sum is 10 or more", ways: 6 },
  { text: "the sum is 4 or less", ways: 6 },
  { text: "both dice show the same number", ways: 6 },
  { text: "the sum is 9 or more", ways: 10 },
  { text: "the sum is 2 or 3", ways: 3 },
  { text: "the sum is 11 or 12", ways: 3 },
  { text: "the sum is 6 or 8", ways: 10 },
] as const;
const probs: [number, number][] = [
  [1, 3],
  [2, 3],
  [1, 4],
  [3, 4],
  [1, 5],
];
function theoreticalCase(r: Random): Built {
  const variant = (
    [
      "two-dice-probability",
      "game-expected-value",
      "binomial-probability",
      "binomial-expectation",
    ] as const
  )[r(0, 3)]!;
  if (variant === "two-dice-probability") {
    const s = r(2, 12);
    const atLeast = r(0, 1) === 1;
    const ways = (t: number) => 6 - Math.abs(t - 7);
    let count = 0;
    for (let t = s; t <= (atLeast ? 12 : s); t++) count += ways(t);
    const event = atLeast ? `X\\ge ${s}` : `X=${s}`;
    const correct = f(count, 36);
    return {
      variant,
      draft: {
        prompt: `Two fair six-sided dice are rolled. Let $X$ be the sum of the two numbers. What is $P(${event})$?`,
        answer: correct,
        hint: `Build the distribution of the sum from the 36 equally likely pairs. Count the pairs with ${atLeast ? `a sum of ${s} or more` : `sum exactly ${s}`}; pairs such as (1, ${s - 1}) and (${s - 1}, 1) count separately.`,
        explanation: [
          RANDOM_VARIABLE,
          "Two dice give $6\\times6=36$ equally likely ordered pairs; (1, 2) and (2, 1) are different pairs. A sum of 7 has the most pairs, 6, and each step away from 7 loses one.",
          atLeast
            ? `Add the pairs for sums ${s} through 12: ${count}.`
            : `A sum of ${s} occurs in ${count} pair${count === 1 ? "" : "s"}.`,
          `Probability is favorable outcomes over all outcomes: $P(${event})=\\frac{${count}}{36}$${gcd(count, 36) > 1 ? `, which reduces to ${correct}` : ""}.`,
          `So $P(${event})=${frac(count, 36)}$.`,
        ],
        choices: options(r, correct, [
          {
            label: f(1, 11),
            feedback:
              "This treats the 11 possible sums as equally likely. Middle sums occur in more ways, so count pairs out of 36.",
          },
          {
            label: f(1, 36),
            feedback:
              "That counts one pair only. Count every ordered pair with the required sum.",
          },
          {
            label: f(count, 12),
            feedback:
              "The total number of equally likely ordered pairs is 36, not 12.",
          },
          {
            label: f(36 - count, 36),
            feedback:
              "That is the probability of the opposite event: every outcome not in this one.",
          },
          {
            label: f(s, 36),
            feedback:
              "This uses the sum itself as the count. Count the pairs that give that sum.",
          },
        ]),
      },
    };
  }
  if (variant === "game-expected-value") {
    const ev = pick(r, diceEvents);
    const w = r(3, 20);
    const l = r(1, 8);
    const num = ev.ways * w - (36 - ev.ways) * l;
    const correct = `$${frac(num, 36)}$ dollars`;
    const swapped = ev.ways * l - (36 - ev.ways) * w;
    return {
      variant,
      draft: {
        prompt: `You roll two fair dice. If ${ev.text}, you win ${w} dollars; otherwise you lose ${l} dollar${l === 1 ? "" : "s"}. Let $X$ be your net gain in dollars. Find the expected value $E(X)$ exactly.`,
        answer: correct,
        hint: `There are 36 equally likely outcomes, and ${ev.text} in ${ev.ways} of them. Multiply each payoff (${w} and −${l}) by its probability, then add.`,
        explanation: [
          EXPECTED,
          `${ev.text.charAt(0).toUpperCase()}${ev.text.slice(1)} in ${ev.ways} of the 36 equally likely pairs. So $P(\\text{win})=\\frac{${ev.ways}}{36}$ and $P(\\text{lose})=\\frac{${36 - ev.ways}}{36}$.`,
          `$E(X)=${w}\\cdot\\frac{${ev.ways}}{36}+(-${l})\\cdot\\frac{${36 - ev.ways}}{36}=\\frac{${ev.ways * w}-${(36 - ev.ways) * l}}{36}=\\frac{${num}}{36}$.`,
          `In lowest terms, $E(X)=${frac(num, 36)}$. On average you ${num >= 0 ? "gain" : "lose"} that many dollars per game over many games.`,
        ],
        choices: options(r, correct, [
          {
            label: `$${frac(w - l, 2)}$ dollars`,
            feedback:
              "That averages the two payoffs as if they were equally likely. Weight each payoff by its probability.",
          },
          {
            label: `$${frac(ev.ways * w, 36)}$ dollars`,
            feedback:
              "That leaves out the loss. Include the negative payoff times its probability.",
          },
          {
            label: `$${frac(swapped, 36)}$ dollars`,
            feedback:
              "The probabilities are swapped: the winning payoff goes with the smaller number of favorable outcomes in this event.",
          },
          {
            label: `$${num}$ dollars`,
            feedback:
              "This forgets to divide. Divide the total by the 36 equally likely outcomes to get an expected value per game.",
          },
        ]),
      },
    };
  }
  const [a, b] = pick(r, probs);
  const nums = [0, 1, 2, 3].map(
    (k) => choose(3, k) * a ** k * (b - a) ** (3 - k),
  );
  const denom = b ** 3;
  if (variant === "binomial-probability") {
    const k = r(0, 3);
    const correct = f(nums[k]!, denom);
    const p = `\\frac{${a}}{${b}}`;
    return {
      variant,
      draft: {
        prompt: `A player makes each of 3 shots independently with probability $${p}$. Let $X$ be the number of shots made. Find $P(X=${k})$.`,
        answer: correct,
        hint: `One specific order with ${k} make${k === 1 ? "" : "s"} and ${3 - k} miss${3 - k === 1 ? "" : "es"} has probability (the make probability)$^{${k}}$ times (the miss probability)$^{${3 - k}}$, where a make has probability $${p}$. Then count how many orders give ${k} make${k === 1 ? "" : "s"}.`,
        explanation: [
          RANDOM_VARIABLE,
          `Independent means one shot does not affect another, so probabilities multiply. A miss has probability $1-${p}=\\frac{${b - a}}{${b}}$.`,
          `One order with ${k} make${k === 1 ? "" : "s"} and ${3 - k} miss${3 - k === 1 ? "" : "es"} has probability $\\left(${p}\\right)^{${k}}\\left(\\frac{${b - a}}{${b}}\\right)^{${3 - k}}=\\frac{${a ** k * (b - a) ** (3 - k)}}{${denom}}$.`,
          `$\\binom{3}{${k}}$, read "3 choose ${k}", counts the orders: which ${k} of the 3 shots are makes. It is ${choose(3, k)}.`,
          `Multiply: $P(X=${k})=${choose(3, k)}\\cdot\\frac{${a ** k * (b - a) ** (3 - k)}}{${denom}}=\\frac{${nums[k]}}{${denom}}$${gcd(nums[k]!, denom) > 1 ? `, which reduces to ${correct}` : ""}.`,
          `So $P(X=${k})=${frac(nums[k]!, denom)}$.`,
        ],
        choices: options(r, correct, [
          {
            label: f(a ** k * (b - a) ** (3 - k), denom),
            feedback:
              "That is the probability of one specific order. Multiply by the number of orders with this many makes.",
          },
          {
            label: f(choose(3, k) * a ** k, b ** k),
            feedback:
              "This leaves out the misses. Multiply in the probability of each miss as well as each make.",
          },
          {
            label: f(1, 4),
            feedback:
              "The four values 0 to 3 are not equally likely when the shots are not 50-50.",
          },
          {
            label: f(choose(3, k) * (b - a) ** k * a ** (3 - k), denom),
            feedback:
              "The makes and misses are swapped: use the make probability for makes and the miss probability for misses.",
          },
          {
            label: f(choose(3, k) * a * (b - a), b * b),
            feedback:
              "This uses each probability once. Raise the make probability to the number of makes and the miss probability to the number of misses.",
          },
        ]),
      },
    };
  }
  const table = nums
    .map((n, k) => `$P(X=${k})=${f(n, denom).slice(1, -1)}$`)
    .join(", ");
  const total = nums.reduce((acc, n, k) => acc + n * k, 0); // equals 3 * a * b^2
  const correct = f(total, denom);
  const mode = nums.indexOf(Math.max(...nums));
  return {
    variant: "binomial-expectation",
    draft: {
      prompt: `$X$ is the number of shots made in 3 independent shots. Its distribution is ${table}. Find the expected value $E(X)$ exactly.`,
      answer: correct,
      hint: `Multiply each value of $X$ (0, 1, 2, 3) by its own probability from the list, then add the four products. The denominators are all ${denom}.`,
      explanation: [
        EXPECTED,
        `$E(X)=0\\cdot P(0)+1\\cdot P(1)+2\\cdot P(2)+3\\cdot P(3)$.`,
        `The numerators give $0\\cdot${nums[0]}+1\\cdot${nums[1]}+2\\cdot${nums[2]}+3\\cdot${nums[3]}=${total}$ over ${denom}.`,
        `$E(X)=\\frac{${total}}{${denom}}$${gcd(total, denom) > 1 ? `, which reduces to ${correct}` : ""} shots made out of 3, on average.`,
      ],
      choices: options(r, correct, [
        {
          label: f(3, 2),
          feedback:
            "That averages the values 0 to 3 as if they were equally likely. Weight each value by its probability.",
        },
        {
          label: `$${mode}$`,
          feedback:
            "That is the most likely value, not the expected value. The expected value weights every value.",
        },
        {
          label: "$1$",
          feedback:
            "The probabilities add to 1, but the expected value multiplies each probability by its value first.",
        },
        {
          label: f(3 * denom - total, denom),
          feedback:
            "That is the expected number of misses, 3 minus the expected number of makes.",
        },
        {
          label: f(a, b),
          feedback:
            "That is the chance of one make. Over 3 shots the expected number is larger.",
        },
      ]),
    },
  };
}

// ------------------------------------------------------- empirical-distributions
const empiricalContexts = [
  {
    unit: "household",
    plural: "households",
    x: "cars",
    values: [0, 1, 2, 3, 4],
    count: "Number of households",
    total: "town",
  },
  {
    unit: "day",
    plural: "days",
    x: "delayed orders",
    values: [0, 1, 2, 3, 4],
    count: "Number of days",
    total: "season",
  },
  {
    unit: "play",
    plural: "plays",
    x: "dollars won",
    values: [0, 1, 2, 5, 10],
    count: "Number of plays",
    total: "evening",
  },
] as const;
function empiricalCase(r: Random): Built {
  const ctx = pick(r, empiricalContexts);
  const values: number[] = [...ctx.values];
  const N = pick(r, [20, 25, 40, 50]);
  const counts = values.map(() => 1);
  for (let i = 0; i < N - values.length; i++)
    counts[r(0, values.length - 1)]!++;
  const totalX = counts.reduce((acc, c, i) => acc + c * values[i]!, 0);
  const figure = chart(values, counts, ctx.count);
  const intro = `The bar chart shows the observed number of ${ctx.x} in each of ${N} ${ctx.plural}.`;
  const variant = (
    ["relative-frequency", "expected-per-trial", "expected-total"] as const
  )[r(0, 2)]!;
  const modeValue = values[counts.indexOf(Math.max(...counts))]!;
  if (variant === "relative-frequency") {
    const i = r(0, values.length - 1);
    const correct = shown(counts[i]!, N);
    return {
      variant,
      draft: {
        prompt: `${intro} Use the relative frequencies as estimated probabilities. Estimate the probability that the number of ${ctx.x} in a ${ctx.unit} is ${values[i]}. Give a decimal.`,
        figure,
        answer: correct,
        hint: `Read the bar at ${values[i]} and divide its height by the total number of ${ctx.plural}, ${N}.`,
        explanation: [
          "A relative frequency is the fraction of all observations that had a given value: its count divided by the total.",
          `The bar at ${values[i]} has height ${counts[i]}, so ${counts[i]} of the ${N} ${ctx.plural} had that value.`,
          `Divide: ${counts[i]} ÷ ${N} = ${correct}.`,
          "An observed relative frequency estimates the probability of that value.",
          `So the relative frequency is ${correct}.`,
        ],
        choices: options(r, correct, [
          {
            label: `${counts[i]}`,
            feedback: `A relative frequency is a fraction of all ${N} ${ctx.plural}. Divide the count by ${N}.`,
          },
          {
            label: shown(counts[i]!, 5),
            feedback: `Divide by the total number of ${ctx.plural}, ${N}, not by the number of bars.`,
          },
          {
            label: "0.2",
            feedback:
              "That assumes the five values are equally likely. Use the observed counts.",
          },
          {
            label: shown(N - counts[i]!, N),
            feedback: "That is the relative frequency of all the other values.",
          },
          {
            label: shown(counts[i]! + 1, N),
            feedback:
              "This misreads the bar. Read the bar's height exactly before dividing.",
          },
        ]),
      },
    };
  }
  if (variant === "expected-per-trial") {
    const correct = shown(totalX, N);
    return {
      variant,
      draft: {
        prompt: `${intro} Use the relative frequencies as estimated probabilities. Find the expected number of ${ctx.x} per ${ctx.unit}. Give a decimal.`,
        figure,
        answer: correct,
        hint: `Weight each value by how often it occurred: multiply each value by its bar height, add, and divide by the ${N} ${ctx.plural}.`,
        explanation: [
          `${EXPECTED} From data, use how often each value occurred.`,
          `Multiply each value by its bar height, the number of ${ctx.plural}: ${values.map((v, i) => `${v}×${counts[i]}=${v * counts[i]!}`).join(", ")}.`,
          `Add them for the total number of ${ctx.x}: ${totalX}.`,
          `Divide by the ${N} ${ctx.plural}: ${totalX} ÷ ${N} = ${correct}.`,
          `So the expected value is ${correct} ${ctx.x} per ${ctx.unit}.`,
        ],
        choices: options(r, correct, [
          {
            label: shown(
              values.reduce((a, b) => a + b, 0),
              5,
            ),
            feedback:
              "That averages the five values as if each occurred equally often. Weight each by its count.",
          },
          {
            label: `${modeValue}`,
            feedback:
              "That is the most frequent value, not the expected value.",
          },
          {
            label: `${totalX}`,
            feedback: `That is the total over all ${N} ${ctx.plural}. Divide by ${N} for the expected value per ${ctx.unit}.`,
          },
          {
            label: shown(Math.max(...counts), N),
            feedback:
              "That is the largest relative frequency, not an expected value. Multiply values by relative frequencies and add.",
          },
          {
            label: shown(totalX + N, N),
            feedback:
              "Multiply each value by its count and add exactly, then divide by the number of observations.",
          },
        ]),
      },
    };
  }
  const H = pick(r, [200, 400, 1000, 2000]);
  const scale = H / N;
  const answer = totalX * scale;
  const correct = `${answer}`;
  return {
    variant,
    draft: {
      prompt: `${intro} Suppose the same pattern holds for ${H} ${ctx.plural} in the ${ctx.total}. About how many ${ctx.x} in total should be expected?`,
      figure,
      answer: correct,
      hint: `First find the expected number of ${ctx.x} for one ${ctx.unit} from the observed counts. Then scale that expected value up to ${H} ${ctx.plural}.`,
      explanation: [
        EXPECTED,
        `From the chart, multiply each value by its bar height and add: the ${N} observed ${ctx.plural} had ${totalX} ${ctx.x} in all.`,
        `Expected per ${ctx.unit}: ${totalX} ÷ ${N} = ${shown(totalX, N)}.`,
        `If the same pattern holds, each of the ${H} ${ctx.plural} averages that much: ${shown(totalX, N)} × ${H} = ${answer}.`,
        `So expect about ${answer} ${ctx.x} in total.`,
      ],
      choices: options(r, correct, [
        {
          label: shown(totalX, N),
          feedback: `That is the expected value for one ${ctx.unit}. Multiply by ${H} for the total.`,
        },
        {
          label: `${totalX}`,
          feedback: `That is the total for the ${N} observed ${ctx.plural}. Scale to ${H}.`,
        },
        {
          label: `${(values.reduce((a, b) => a + b, 0) / 5) * H}`,
          feedback:
            "That averages the five values as if each occurred equally often. Weight each by its count first.",
        },
        {
          label: `${totalX * N}`,
          feedback: `Scale by ${H} ÷ ${N} = ${scale}, not by ${N}.`,
        },
        {
          label: `${answer + scale}`,
          feedback:
            "Scale the expected value exactly: it is the sample total times the scale factor.",
        },
      ]),
    },
  };
}

// -------------------------------------------------------------- decision-strategies
function strategyCase(r: Random): Built {
  const variant = (["compare-games", "warranty", "sure-or-gamble"] as const)[
    r(0, 2)
  ]!;
  if (variant === "compare-games") {
    const names = ["A", "B", "C", "D"];
    for (let attempt = 0; ; attempt++) {
      const games = names.map(() => {
        const d = pick(r, [4, 5, 8, 10]);
        return { d, k: r(1, d - 1), w: r(4, 40), c: r(1, 8) };
      });
      // Net expected gain = (w*k - c*d)/d.
      const nets = games.map((g) => ({ n: g.w * g.k - g.c * g.d, d: g.d }));
      const value = (x: { n: number; d: number }) => x.n / x.d;
      const best = Math.max(...nets.map(value));
      if (
        nets.filter((x) => Math.abs(value(x) - best) < 1e-9).length !== 1 &&
        attempt < 50
      )
        continue;
      const bestIndex = nets.findIndex((x) => Math.abs(value(x) - best) < 1e-9);
      const lines = games
        .map(
          (g, i) =>
            `Game $${names[i]}$: pay ${g.c} dollar${g.c === 1 ? "" : "s"} to play; win ${g.w} dollars with probability $${frac(g.k, g.d)}$, otherwise win nothing.`,
        )
        .join(" ");
      const correct = `Game $${names[bestIndex]}$`;
      const bestText = `$${frac(nets[bestIndex]!.n, nets[bestIndex]!.d)}$`;
      return {
        variant,
        draft: {
          prompt: `Four games are offered. ${lines} Which game has the greatest expected net gain per play (prize chance times prize, minus the cost)?`,
          answer: correct,
          hint: `For one game, such as the one with a ${games[0]!.w}-dollar prize at probability $${frac(games[0]!.k, games[0]!.d)}$ and cost ${games[0]!.c}, multiply the prize by its probability and subtract the cost. Do that for each game and compare.`,
          explanation: [
            `${EXPECTED} For each game: prize times its chance, minus the cost you always pay.`,
          ]
            .concat(
              games.map(
                (g, i) =>
                  `Game $${names[i]}$: $${g.w}\\cdot${frac(g.k, g.d)}-${g.c}=${frac(nets[i]!.n, nets[i]!.d)}$ dollars.`,
              ),
            )
            .concat([
              `The greatest expected net gain is ${bestText} dollars, so the best choice is ${correct}.`,
            ]),
          choices: names.map((name, i) =>
            i === bestIndex
              ? { label: `Game $${name}$`, correct: true as const }
              : {
                  label: `Game $${name}$`,
                  feedback: `Game $${name}$ has expected net gain $${frac(nets[i]!.n, nets[i]!.d)}$ dollars, which is less than the best game's ${bestText} dollars.`,
                },
          ),
        },
      };
    }
  }
  if (variant === "warranty") {
    const d = pick(r, [10, 20, 25]);
    const k = r(1, Math.floor(d / 2) - 1);
    const R = 20 * r(6, 30);
    const expected = (R * k) / d; // Terminates because d divides 100.
    const price = Math.max(
      10,
      Math.round((expected + (r(0, 1) ? 1 : -1) * r(5, 40)) / 5) * 5,
    );
    const buy = expected > price;
    const dec = buy ? "Buy the warranty" : "Skip the warranty";
    const exp = shown(R * k, d);
    const wrongExp = (R * (d - k)) / d;
    const wrongDec =
      wrongExp > price ? "Buy the warranty" : "Skip the warranty";
    const correct = `${dec}: the expected repair cost without it is ${exp} dollars, compared with its price of ${price} dollars.`;
    return {
      variant,
      draft: {
        prompt: `A warranty costs ${price} dollars. Without it, there is a probability of $${frac(k, d)}$ that you pay a ${R}-dollar repair bill and otherwise pay nothing. Which statement is justified by comparing expected costs?`,
        answer: correct,
        hint: `Expected repair cost without the warranty = repair bill × probability of needing it: ${R} × $${frac(k, d)}$. Compare that expected cost with the ${price}-dollar price.`,
        explanation: [
          EXPECTED,
          `Without the warranty, you pay ${R} dollars with probability $${frac(k, d)}$, and 0 otherwise. Expected cost: $${R}\\cdot${frac(k, d)}=${exp}$ dollars.`,
          `With the warranty, you pay ${price} dollars for sure.`,
          `${exp} dollars is ${buy ? "more" : "less"} than ${price} dollars, so on average ${buy ? "buying the warranty costs less." : "skipping the warranty costs less."}`,
        ],
        choices: options(r, correct, [
          {
            label: `Buy the warranty: a repair would cost ${R} dollars, more than its ${price}-dollar price.`,
            feedback:
              "That compares the price with the worst case. Decide with the expected cost, which accounts for how unlikely the repair is.",
          },
          {
            label: `Skip the warranty: a repair is unlikely, with probability only $${frac(k, d)}$.`,
            feedback:
              "Unlikely is not enough. Compare the expected repair cost with the price.",
          },
          {
            label: `${wrongDec}: the expected repair cost without it is ${shown(R * (d - k), d)} dollars, compared with its price of ${price} dollars.`,
            feedback: `The probability of needing a repair is $${frac(k, d)}$, not its complement, so the expected cost uses ${k} out of ${d}.`,
          },
          {
            label: `Either choice is equally good: you pay at most ${R} dollars either way.`,
            feedback:
              "The two choices have different expected costs. Compute and compare them.",
          },
        ]),
      },
    };
  }
  const d = pick(r, [4, 5, 10]);
  let k = r(1, d - 1);
  if (2 * k === d) k += 1;
  const W = r(20, 100);
  const L = -r(1, 40);
  const num = k * W + (d - k) * L;
  const S = Math.round(num / d / 5) * 5 + 5 * (r(0, 1) ? 1 : -1) * r(1, 3);
  const claim = (n: number, den: number) => {
    const e = `$${frac(n, den)}$`;
    const diff = n - S * den;
    if (diff > 0)
      return `Take the gamble: its expected value, ${e} dollars, is more than the sure ${S} dollars.`;
    if (diff < 0)
      return `Take the sure amount: the gamble's expected value, ${e} dollars, is less than the sure ${S} dollars.`;
    return `Either choice: the gamble's expected value, ${e} dollars, equals the sure ${S} dollars.`;
  };
  const correct = claim(num, d);
  return {
    variant,
    draft: {
      prompt: `You can take a sure ${S} dollars or a gamble. In the gamble you win ${W} dollars with probability $${frac(k, d)}$ and otherwise ${L === 0 ? "win nothing" : `lose ${-L} dollar${L === -1 ? "" : "s"}`}. Which statement is justified by comparing expected values?`,
      answer: correct,
      hint: `Expected value of the gamble: ${W} times $${frac(k, d)}$, plus the other payoff (−${-L}) times the leftover probability. Compare that total with the sure ${S}.`,
      explanation: [
        EXPECTED,
        `The losing probability is what is left of 1: $1-${frac(k, d)}=${frac(d - k, d)}$.`,
        `Expected value of the gamble: $${W}\\cdot${frac(k, d)}+(${L})\\cdot${frac(d - k, d)}=${frac(num, d)}$ dollars.`,
        `${correct}`,
      ],
      choices: options(r, correct, [
        {
          label: claim(k * W, d),
          feedback:
            "That leaves out the other outcome's payoff. The expected value adds every outcome's payoff times its probability.",
        },
        {
          label: claim((W + L) * d, 2 * d),
          feedback:
            "That averages the two payoffs as if they were equally likely. Weight each by its probability.",
        },
        {
          label: claim((d - k) * W + k * L, d),
          feedback:
            "The probabilities are swapped. The prize goes with the winning probability.",
        },
        {
          label: claim(k * W + (d - k) * L + 5 * d, d),
          feedback:
            "This has an arithmetic slip. Recompute each payoff times its probability, then add.",
        },
      ]),
    },
  };
}

// ------------------------------------------------------------ fair-random-decisions
function fairCase(r: Random): Built {
  const variant = (
    [
      "choose-procedure",
      "two-dice-chance",
      "remainder-chance",
      "reroll-chance",
    ] as const
  )[r(0, 3)]!;
  const n = r(7, 11);
  if (variant === "choose-procedure") {
    const [fair, why] = pick(r, [
      [
        `Put ${n} identical slips, one per student, in a bag, mix well and draw one.`,
        `Every slip is equally likely to be drawn and each student has exactly one slip, so each student has probability 1/${n}.`,
      ],
      [
        `Roll a fair 12-sided die, rolling again if the result is above ${n}; the result is the student number.`,
        `Re-rolling leaves the results 1 to ${n}, which are equally likely, and each student has exactly one of them, so each student has probability 1/${n}.`,
      ],
      [
        `Spin an arrow on a wheel divided into ${n} equal sectors, one per student.`,
        `Equal sectors are equally likely to be hit and each student has exactly one sector, so each student has probability 1/${n}.`,
      ],
    ] as const);
    const decoys: Wrong[] = [
      {
        label:
          "Roll one fair six-sided die and use the result as the student number.",
        feedback: `The die has only 6 results, so students 7 to ${n} could never be chosen.`,
      },
      {
        label: `Roll two fair dice, add them, and choose student sum − 1; roll again if the sum is above ${n + 1}.`,
        feedback:
          "Sums are not equally likely: a sum of 7 happens in 6 ways but a sum of 2 in only 1, so students would not have equal chances.",
      },
      {
        label: `Flip a fair coin ${n - 1} times and choose student 1 + the number of heads.`,
        feedback:
          "The number of heads is not equally likely: middle counts happen in many more sequences than 0 or all heads.",
      },
      {
        label: `Roll a fair 12-sided die; the remainder after dividing by ${n} is the student (remainder 0 means student ${n}).`,
        feedback: `${12} outcomes cannot be shared equally among ${n} students, so some students would get 2 outcomes and others 1.`,
      },
    ];
    return {
      variant,
      draft: {
        prompt: `A teacher must choose one of ${n} students at random so that every student has exactly the same chance. Which procedure does that?`,
        answer: fair,
        hint: `A procedure is fair when every student corresponds to the same number of equally likely outcomes. Count the equally likely outcomes in each procedure and check whether they split evenly among the ${n} students.`,
        explanation: [
          "Fair means every student has the same probability. That happens when each student matches the same number of equally likely outcomes.",
          `${fair} ${why}`,
          "The other procedures either leave some students out or give them different numbers of outcomes or ways.",
        ],
        choices: options(r, fair, decoys),
      },
    };
  }
  if (variant === "two-dice-chance") {
    const j = r(1, 11);
    const ways = 6 - Math.abs(j + 1 - 7);
    const correct = f(ways, 36);
    return {
      variant,
      draft: {
        prompt: `To pick one of 11 students numbered 1 to 11, a teacher rolls two fair six-sided dice and chooses the student numbered (sum − 1). What is the probability that student ${j} is chosen?`,
        answer: correct,
        hint: `Student ${j} is chosen when the sum is ${j + 1}. Count the ordered pairs of dice (out of 36) that add to ${j + 1}.`,
        explanation: [
          `Student ${j} is chosen exactly when the sum is ${j + 1}.`,
          `Ordered pairs of dice with sum ${j + 1}: ${ways}.`,
          `Probability = ${ways}/36${gcd(ways, 36) > 1 ? ` = ${correct.slice(1, -1)}` : ""}. The 11 students do not share equally, so this procedure is not fair.`,
        ],
        choices: options(r, correct, [
          {
            label: f(1, 11),
            feedback:
              "That would be fair, but sums are not equally likely. Count the pairs with this sum.",
          },
          {
            label: f(1, 36),
            feedback:
              "That is the chance of one specific ordered pair. Count every pair with this sum.",
          },
          {
            label: f(ways, 11),
            feedback:
              "The total number of equally likely ordered pairs is 36, not 11.",
          },
          {
            label: f(ways, 12),
            feedback:
              "The total number of equally likely ordered pairs is 36, not 12.",
          },
          {
            label: f(ways + 1, 36),
            feedback:
              "Count the ordered pairs exactly; there is no extra pair.",
          },
          {
            label: f(j, 36),
            feedback:
              "The student number is not the number of pairs; count the pairs with the required sum.",
          },
        ]),
      },
    };
  }
  if (variant === "remainder-chance") {
    const j = r(1, n);
    const outcomes = j <= 12 - n ? 2 : 1;
    const correct = f(outcomes, 12);
    const other = outcomes === 2 ? 1 : 2;
    return {
      variant,
      draft: {
        prompt: `To pick one of ${n} students numbered 1 to ${n}, a teacher rolls a fair 12-sided die numbered 1 to 12. The student number is the remainder after dividing the result by ${n}, and a remainder of 0 means student ${n}. What is the probability that student ${j} is chosen?`,
        answer: correct,
        hint: `Go through the die results 1 to 12. A result gives student ${j} when its remainder after dividing by ${n} is ${j % n} (that is, the result is ${j}, or ${j} plus a multiple of ${n}). Count those results.`,
        explanation: [
          `Results that give student ${j}: ${Array.from(
            { length: 12 },
            (_, i) => i + 1,
          )
            .filter((x) => ((x - 1) % n) + 1 === j)
            .join(" and ")}.`,
          `That is ${outcomes} of the 12 equally likely results.`,
          `Probability = ${outcomes}/12${outcomes === 2 ? " = 1/6" : ""}. Because ${n} does not divide 12, some students have twice the chance of others.`,
        ],
        choices: options(r, correct, [
          {
            label: f(1, n),
            feedback: `That would be fair, but 12 results cannot be split equally among ${n} students.`,
          },
          {
            label: f(other, 12),
            feedback: `Count the results that give student ${j}: ${outcomes}, not ${other}.`,
          },
          {
            label: f(outcomes, n),
            feedback:
              "The total number of equally likely results is 12, not the number of students.",
          },
          {
            label: f(1, 6),
            feedback:
              "Only some students get two results. Count the results for this student.",
          },
          {
            label: f(outcomes, 11),
            feedback: "The die has 12 equally likely results.",
          },
          {
            label: f(12 - n, 12),
            feedback:
              "That counts how many students have two results, not this student's chance.",
          },
          {
            label: f(n, 12),
            feedback:
              "That divides the number of students by the number of results. Count this student's results.",
          },
        ]),
      },
    };
  }
  const j = r(1, n);
  const correct = f(1, n);
  return {
    variant: "reroll-chance",
    draft: {
      prompt: `To pick one of ${n} students numbered 1 to ${n}, a teacher rolls a fair 12-sided die numbered 1 to 12, rolling again whenever the result is greater than ${n}. The result is the student number. What is the probability that student ${j} is chosen?`,
      answer: correct,
      hint: `Re-rolling removes the results above ${n}. Once a result of ${n} or less appears, each of those results is equally likely. Count how many results are left.`,
      explanation: [
        `The procedure ends only on results 1 to ${n}.`,
        `Each of these ${n} results is equally likely to be the one that ends the process.`,
        `So student ${j} has probability 1/${n}. Every student has the same chance, so this procedure is fair.`,
      ],
      choices: options(r, correct, [
        {
          label: f(1, 12),
          feedback:
            "Rolls above the student count are ignored, so the chance is shared among fewer than 12 results.",
        },
        {
          label: f(n, 12),
          feedback: `That is the chance that a single roll lands on a student number at most ${n}, not the chance of one student.`,
        },
        {
          label: f(1, 12 - n),
          feedback: `The results that are kept number ${n}, not ${12 - n}.`,
        },
        {
          label: f(1, n + 1),
          feedback: `Exactly ${n} results lead to a student.`,
        },
      ]),
    },
  };
}

// -------------------------------------------------------- simulation & randomization
const simContexts = [
  {
    claim:
      "A game company says its spinner lands on blue with probability $\\frac{1}{2}$",
    trial: "spins",
    did: (x: number) => `the spinner landed on blue ${x} times`,
    count: "landings on blue",
  },
  {
    claim:
      "A coin maker says a new coin lands heads with probability $\\frac{1}{2}$",
    trial: "tosses",
    did: (x: number) => `the coin landed heads ${x} times`,
    count: "heads",
  },
  {
    claim:
      "A shooter says she makes each free throw with probability $\\frac{1}{2}$",
    trial: "shots",
    did: (x: number) => `she made ${x} shots`,
    count: "shots made",
  },
] as const;
function simulationCase(r: Random): Built {
  const ctx = pick(r, simContexts);
  const lo = 4;
  const hi = 16;
  const counts = bellCounts(r, lo, hi, 10, 2.2, 100);
  const at = (c: number) => counts[c - lo]!;
  const sumWhere = (test: (c: number) => boolean) =>
    counts.reduce((acc, v, i) => (test(lo + i) ? acc + v : acc), 0);
  const variant = (["two-sided", "one-sided", "boundary"] as const)[r(0, 2)]!;
  let x: number;
  let cutoff = 5;
  let tailTest: (c: number) => boolean;
  let phrase: string;
  const distance = () => r(3, 6);
  if (variant === "one-sided") {
    x = 10 + distance();
    tailTest = (c) => c >= x;
    phrase = `with ${x} or more ${ctx.count}`;
  } else {
    let d = distance();
    if (variant === "boundary") {
      const candidates = [3, 4, 5, 6].filter((t) => {
        const tt = sumWhere((c) => Math.abs(c - 10) >= t);
        return tt >= 1 && tt <= 12;
      });
      if (candidates.length) d = pick(r, candidates);
    }
    x = r(0, 1) ? 10 + d : 10 - d;
    tailTest = (c) => Math.abs(c - 10) >= d;
    phrase = `at least as far from 10 as ${x} is, in either direction (${10 - d} or fewer, or ${10 + d} or more)`;
    if (variant === "boundary") {
      const tt = sumWhere(tailTest);
      if (tt >= 1 && tt <= 12) cutoff = tt;
    }
  }
  const T = sumWhere(tailTest);
  const inconsistent = (t: number) => t < cutoff;
  const label = (t: number, flip = false) => {
    const bad = flip ? !inconsistent(t) : inconsistent(t);
    return `${t} of 100 sets (${t}%): ${bad ? "not consistent" : "consistent"} with the model`;
  };
  const correct = label(T);
  const oneTail = sumWhere(x > 10 ? (c) => c >= x : (c) => c <= x);
  const exact = at(x);
  const strict = sumWhere(x > 10 ? (c) => c > x : (c) => c < x);
  const wrong: Wrong[] = [
    {
      label: label(100 - T),
      feedback:
        "That is the number of simulations less extreme than the observed result. Count the ones at least as extreme.",
    },
    {
      label: label(T, true),
      feedback: `A small percent of simulations at least as extreme means the result is rare under the model. Compare ${T}% with the cutoff, ${cutoff}%, in the right direction.`,
    },
  ];
  if (variant !== "one-sided")
    wrong.push({
      label: label(oneTail),
      feedback:
        "Extreme results in both directions count, not only the observed side.",
    });
  wrong.push({
    label: label(exact),
    feedback:
      "At least as extreme includes the observed count and every more extreme count, not just the observed count.",
  });
  wrong.push({
    label: label(strict),
    feedback:
      "The observed count itself is included when counting results at least as extreme.",
  });
  return {
    variant,
    draft: {
      prompt: `${ctx.claim}. In a test of 20 ${ctx.trial}, ${ctx.did(x)}.${variant === "one-sided" ? " You suspect the true probability is greater than $\\frac{1}{2}$." : ""} The chart shows the number of ${ctx.count} in each of 100 sets of 20 ${ctx.trial} simulated under the model. Count the sets ${phrase}. Fewer than ${cutoff}% that extreme means not consistent with the model. What do you conclude?`,
      figure: chart(
        Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
        counts,
        "Simulated sets",
      ),
      answer: correct,
      hint: `Under the model the expected count is 10, and the observed ${x} is ${Math.abs(x - 10)} from it. Add the heights of the bars ${variant === "one-sided" ? `from ${x} upward` : `that are that far or farther from 10 on both sides`}, then compare that percent with ${cutoff}%.`,
      explanation: [
        "A simulation runs the model many times by chance, to show which results the model usually produces.",
        "If few simulated runs are at least as extreme (at least as far from the expected value) as the real result, the result is unusual for the model.",
        `Add the bar heights for counts that are at least as extreme as the observed ${x}: ${T}.`,
        `That is ${T} of 100 simulated sets, or ${T}%.`,
        `${T}% is ${inconsistent(T) ? "less than" : cutoff === T ? "equal to" : "not less than"} the ${cutoff}% cutoff, so the result is ${inconsistent(T) ? "not consistent" : "consistent"} with the model.`,
      ],
      choices: options(r, correct, wrong),
    },
  };
}

const trialContexts = [
  {
    a: "the new study guide",
    b: "the usual study guide",
    measure: "mean quiz score",
    unit: "points",
  },
  { a: "plant food $A$", b: "plant food $B$", measure: "mean growth", unit: "cm" },
  {
    a: "the warm-up routine",
    b: "no warm-up",
    measure: "mean sprint time improvement",
    unit: "tenths of a second",
  },
] as const;
function randomizationCase(r: Random): Built {
  const ctx = pick(r, trialContexts);
  const lo = -6;
  const hi = 6;
  const counts = bellCounts(r, lo, hi, 0, 2.2, 200);
  const variant = (["two-sided", "one-sided", "boundary"] as const)[r(0, 2)]!;
  const sumWhere = (test: (c: number) => boolean) =>
    counts.reduce((acc, v, i) => (test(lo + i) ? acc + v : acc), 0);
  let D = r(3, 6);
  let cutoff = 5;
  if (variant === "boundary") {
    const candidates = [3, 4, 5, 6].filter((t) => {
      const tt = sumWhere((c) => Math.abs(c) >= t);
      return tt >= 2 && tt <= 24 && tt % 2 === 0;
    });
    if (candidates.length) {
      D = pick(r, candidates);
      cutoff = sumWhere((c) => Math.abs(c) >= D) / 2;
    }
  }
  const twoSided = variant !== "one-sided";
  const tailTest = twoSided
    ? (c: number) => Math.abs(c) >= D
    : (c: number) => c >= D;
  const T = sumWhere(tailTest);
  const percent = T / 2;
  const significant = percent < cutoff;
  const label = (t: number, sig: boolean) =>
    `${t} of 200 reshuffles (${shown(t, 2)}%): ${sig ? "significant; chance is an unlikely explanation" : "not significant; chance could explain it"}`;
  const correct = label(T, significant);
  const wrong: Wrong[] = [
    {
      label: label(T, !significant),
      feedback: `Significant means the proportion is less than the cutoff. Compare ${shown(T, 2)}% with ${cutoff}% in the right direction.`,
    },
    {
      label: label(200 - T, (200 - T) / 2 < cutoff),
      feedback:
        "That counts the re-randomizations less extreme than the observed difference. Count the ones at least as extreme.",
    },
    {
      label: label(counts[D - lo]!, counts[D - lo]! / 2 < cutoff),
      feedback:
        "As or more extreme includes the observed difference and every larger one, not just the observed value.",
    },
  ];
  if (twoSided)
    wrong.push({
      label: label(
        sumWhere((c) => c >= D),
        sumWhere((c) => c >= D) / 2 < cutoff,
      ),
      feedback:
        "Because the question is whether the groups differ in either direction, count differences at least as large in both directions.",
    });
  else
    wrong.push({
      label: label(
        sumWhere((c) => Math.abs(c) >= D),
        sumWhere((c) => Math.abs(c) >= D) / 2 < cutoff,
      ),
      feedback:
        "The claim is only that the first group has the higher mean, so count only the high side.",
    });
  const claimText = twoSided
    ? `whether the groups differ`
    : `whether ${ctx.a} gave a higher ${ctx.measure}`;
  return {
    variant,
    draft: {
      prompt: `Volunteers were randomly assigned to ${ctx.a} or ${ctx.b}. The difference in ${ctx.measure} (${ctx.a} minus ${ctx.b}) was ${D} ${ctx.unit}. To test ${claimText}, the labels were reshuffled 200 times; the chart shows how many reshuffles gave each difference. Count the reshuffles ${twoSided ? `with a difference of ${D} or more, or −${D} or less` : `with a difference of ${D} or more`}. Significant means that proportion is less than ${cutoff}%. What do you conclude?`,
      figure: chart(
        Array.from({ length: hi - lo + 1 }, (_, i) => lo + i),
        counts,
        "Re-randomizations",
      ),
      answer: correct,
      hint: `The reshuffles show what random assignment alone produces. Add the bar heights ${twoSided ? `at ${D} and above and at −${D} and below` : `at ${D} and above`}, divide by 200, and compare with ${cutoff}%.`,
      explanation: [
        "Reshuffling the group labels many times shows the differences that random assignment alone produces, with no real treatment effect.",
        "If few reshuffles give a difference at least as large as the real one, chance is an unlikely explanation. Then the difference is called significant.",
        `Add the bar heights ${twoSided ? `for differences of ${D} or more and −${D} or less` : `for differences of ${D} or more`}: ${T}.`,
        `${T} of 200 is ${shown(T, 2)}%.`,
        `${shown(T, 2)}% is ${significant ? "less than" : percent === cutoff ? "equal to" : "not less than"} ${cutoff}%, so the difference is ${significant ? "significant: reshuffling rarely produces a difference this large" : "not significant: reshuffling often produces a difference this large"}.`,
      ],
      choices: options(r, correct, wrong),
    },
  };
}

// ------------------------------------------------------ statistical-report-critique
const flawNames = {
  voluntary: "voluntary response",
  convenience: "convenience sample",
  small: "sample too small",
  missing: "no margin of error",
  axis: "truncated axis",
} as const;
type Flaw = keyof typeof flawNames;
const flawLabels: Record<Flaw, string> = {
  voluntary: "Voluntary response: only people who chose to reply are counted.",
  convenience:
    "Convenience sample: the people asked do not represent the whole group.",
  small: "Sample too small: a few people give an unreliable estimate.",
  missing:
    "No margin of error: a close result is reported as if it were certain.",
  axis: "Truncated axis: the vertical scale exaggerates the gap.",
};
const reportContexts = [
  {
    org: "The school board",
    people: "parents",
    popl: "all parents in the district",
    q: "which of two school start times they prefer",
    A: "the later start",
    place: "elementary school pick-up line",
  },
  {
    org: "A transit agency",
    people: "riders",
    popl: "all riders on its bus system",
    q: "which of two proposed schedules they prefer",
    A: "Schedule $X$",
    place: "downtown bus stop",
  },
  {
    org: "A cafe chain",
    people: "customers",
    popl: "all customers across its stores",
    q: "which of two new sandwiches they prefer",
    A: "the Garden Melt",
    place: "single store in the city center",
  },
] as const;
function reportCase(r: Random): Built {
  const ctx = pick(r, reportContexts);
  const all: Flaw[] = ["voluntary", "convenience", "small", "missing", "axis"];
  const single = r(0, 5) < 5;
  let present: Flaw[];
  if (single) present = [all[r(0, 4)]!];
  else {
    const aspects = shuffle(r, ["sampling", "small", "missing", "axis"]).slice(
      0,
      2,
    );
    present = aspects.map((a) =>
      a === "sampling" ? (r(0, 1) ? "voluntary" : "convenience") : (a as Flaw),
    );
  }
  const has = (flaw: Flaw) => present.includes(flaw);
  // A self-selected web poll is also arguably a convenience sample, and vice
  // versa, so never offer the other sampling flaw beside the one present.
  const sibling: Flaw | undefined = has("voluntary")
    ? "convenience"
    : has("convenience")
      ? "voluntary"
      : undefined;
  const n = has("small") ? r(12, 25) : r(8, 24) * 100;
  const closeRace = has("missing");
  const pA = closeRace ? r(51, 52) : r(58, 66);
  const pB = 100 - pA;
  const m = Math.max(1, Math.round(100 / Math.sqrt(n)));
  const askedHow = has("voluntary")
    ? `${ctx.org} posted the question on its website and counted the ${n} replies from ${ctx.people} who chose to answer.`
    : has("convenience")
      ? `${ctx.org} asked ${n} ${ctx.people} it met at one ${ctx.place} on a weekday morning.`
      : `${ctx.org} selected ${n} ${ctx.people} at random from a complete list of ${ctx.popl}.`;
  const sentences = [
    `${askedHow} The question was ${ctx.q}.`,
    `${pA}% chose ${ctx.A} and ${pB}% chose the other option.${has("missing") ? "" : ` The report states a margin of error of ±${m} percentage points.`}`,
    has("axis")
      ? `The report's bar chart draws the two percentages on a vertical axis that starts at ${pB - 2}%.`
      : "The report's bar chart uses a vertical axis that starts at 0%.",
    `Headline: "Most ${ctx.people} prefer ${ctx.A}."`,
  ];
  const falseNote: Record<Flaw, string> = {
    voluntary: has("convenience")
      ? "The people did not choose to reply; they were asked in person at one place. The weakness is whom the sample reaches, not who chose to answer."
      : `The ${ctx.people} were chosen at random, so they did not decide for themselves whether to be counted.`,
    convenience: has("voluntary")
      ? "People chose to reply; the weakness is self-selection, not a single convenient location."
      : `The ${ctx.people} were chosen at random from the full list, so the sample reaches the whole population.`,
    small: `The report counts ${n} ${ctx.people}, which is large enough for a stable estimate.`,
    missing: `The report states a margin of error of ±${m} percentage points.`,
    axis: "The bar chart's axis starts at 0%, so bar heights are in proportion to the percentages.",
  };
  const prompt = (items: string) => `${sentences.join(" ")} ${items}`;
  if (single) {
    const flaw = present[0]!;
    const correct = flawLabels[flaw];
    return {
      variant: `single-${flaw}`,
      draft: {
        prompt: prompt("Which flaw most weakens the headline conclusion?"),
        answer: correct,
        hint: `Check the report piece by piece: how the ${n} ${ctx.people} were reached, whether ${n} is enough, whether the report states how precise ${pA}% is, and where the chart's axis starts.`,
        explanation: [
          "A trustworthy survey picks people at random from the whole group, uses enough people, states a margin of error, and draws its graph honestly.",
          "A margin of error says how far the sample's percent may be from the true percent for everyone.",
          "Check those four things in turn: how people were chosen, how many there are, whether a margin of error is given, and where the graph's axis starts.",
          `Only one of them fails here: ${flawNames[flaw]}.`,
          `So the flaw that most weakens the headline is ${flawNames[flaw]}.`,
        ],
        choices: options(
          r,
          correct,
          all
            .filter((x) => x !== flaw && x !== sibling)
            .map((x) => ({ label: flawLabels[x], feedback: falseNote[x] })),
        ),
      },
    };
  }
  const pairLabel = (a: Flaw, b: Flaw) => {
    const text = `${flawNames[a]} and ${flawNames[b]}`;
    return `${text[0]!.toUpperCase()}${text.slice(1)}`;
  };
  const order = (pair: Flaw[]) =>
    [...pair].sort((x, y) => all.indexOf(x) - all.indexOf(y));
  const correctPair = order(present);
  const correct = pairLabel(correctPair[0]!, correctPair[1]!);
  const pairs: Flaw[][] = [];
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++) {
      const pair = [all[i]!, all[j]!];
      if (pair.includes("voluntary") && pair.includes("convenience")) continue;
      if (sibling && pair.includes(sibling)) continue;
      pairs.push(pair);
    }
  const trueCount = (pair: Flaw[]) => pair.filter(has).length;
  const wrongPairs = pairs
    .filter((pair) => pairLabel(pair[0]!, pair[1]!) !== correct)
    .sort((x, y) => trueCount(y) - trueCount(x));
  const oneTrue = shuffle(
    r,
    wrongPairs.filter((p) => trueCount(p) === 1),
  );
  const noneTrue = shuffle(
    r,
    wrongPairs.filter((p) => trueCount(p) === 0),
  );
  return {
    variant: "mixed-pair",
    draft: {
      prompt: prompt("Which two flaws weaken the headline conclusion?"),
      answer: correct,
      hint: `Check the report piece by piece: how the ${n} ${ctx.people} were reached, whether ${n} is enough, whether the report states how precise ${pA}% is, and where the chart's axis starts. Two of the four checks fail.`,
      explanation: [
        "A trustworthy survey picks people at random from the whole group, uses enough people, states a margin of error (how far its percent may be from the truth), and draws its graph honestly.",
        "Check those four things in turn: how people were chosen, how many there are, whether a margin of error is given, and where the graph's axis starts.",
        `Two fail here: ${flawNames[correctPair[0]!]} and ${flawNames[correctPair[1]!]}.`,
        "A pair is correct only if both of its flaws are present.",
        `So the report's flaws are ${flawNames[correctPair[0]!]} and ${flawNames[correctPair[1]!]}.`,
      ],
      choices: options(
        r,
        correct,
        [...oneTrue, ...noneTrue].map((pair) => {
          const falseFlaw = pair.find((x) => !has(x))!;
          return {
            label: pairLabel(pair[0]!, pair[1]!),
            feedback: `${flawNames[falseFlaw][0]!.toUpperCase()}${flawNames[falseFlaw].slice(1)} is not a flaw here. ${falseNote[falseFlaw]}`,
          };
        }),
      ),
    },
  };
}

// ------------------------------------------------------------------ model-validation
const signed = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
function modelCase(r: Random): Built {
  const variant = (
    ["curved-pattern", "no-pattern", "extrapolation", "compare-models"] as const
  )[r(0, 3)]!;
  const xs = [1, 2, 3, 4, 5, 6, 7];
  const slope = r(2, 6);
  const intercept = r(3, 20);
  const predicted = xs.map((x) => slope * x + intercept);
  const ctx = pick(r, [
    { y: "height of a seedling", yUnit: "cm", x: "weeks" },
    { y: "depth of snow", yUnit: "cm", x: "hours into a storm" },
    { y: "distance a cyclist has ridden", yUnit: "km", x: "hours" },
  ] as const);
  const table = (resid: number[]) =>
    xs
      .map(
        (x, i) =>
          `x = ${x}: observed ${predicted[i]! + resid[i]!}, predicted ${predicted[i]}, residual ${signed(resid[i]!)}`,
      )
      .join("; ");
  const intro = `A linear model $\\hat y=${slope}x+${intercept}$ predicts the ${ctx.y} (${ctx.yUnit}) after $x$ ${ctx.x}. A residual is observed minus predicted.`;
  if (variant === "curved-pattern") {
    const sign = r(0, 1) ? 1 : -1;
    const resid = [6, 1, -3, -4, -3, 1, 2].map((v) => v * sign);
    const first = sign > 0 ? "positive" : "negative";
    const mid = sign > 0 ? "negative" : "positive";
    const correct = `The line misses a curve: the residuals are ${first}, then ${mid}, then ${first}, so a curved model should be tried.`;
    return {
      variant,
      draft: {
        prompt: `${intro} The data: ${table(resid)}. Which conclusion do the residuals support?`,
        answer: correct,
        hint: `Read the residual column from $x=1$ to $x=7$ and watch its sign. The residuals add to 0, but ask whether they look random or follow a shape.`,
        explanation: [
          "A residual is observed minus predicted: how far the model missed each data point. A good model leaves residuals that scatter randomly around 0.",
          `The residuals are ${resid.map(signed).join(", ")}.`,
          `Their signs run ${first}, ${mid}, ${first}. That is a pattern, not random scatter.`,
          "A systematic pattern in the residuals means the straight line is the wrong form, so a curved model should be tried.",
        ],
        choices: options(r, correct, [
          {
            label:
              "The line fits well: the residuals add to 0, so the errors cancel.",
            feedback:
              "Residuals can add to 0 while following a clear curve. Look at the pattern of signs and sizes, not only the sum.",
          },
          {
            label:
              "The line fits well: some residuals are positive and some are negative.",
            feedback:
              "Positive and negative residuals are expected. What matters is whether they appear in a pattern.",
          },
          {
            label:
              "The data must contain mistakes, because they do not lie exactly on the line.",
            feedback:
              "Real data rarely lie exactly on a line. The residual pattern shows the model's form is wrong, not that the data are.",
          },
        ]),
      },
    };
  }
  if (variant === "no-pattern") {
    const sign = r(0, 1) ? 1 : -1;
    const resid = pick(r, [
      [1, -2, 2, -1, -1, 2, -1],
      [-2, 1, 1, -1, 2, -2, 1],
      [2, -1, -2, 1, 1, -1, 0],
    ]).map((v) => v * sign);
    const correct =
      "The residuals are small and show no pattern, so the line is a reasonable model for these values of $x$.";
    return {
      variant,
      draft: {
        prompt: `${intro} The data: ${table(resid)}. Which conclusion do the residuals support?`,
        answer: correct,
        hint: `Read the residual column from $x=1$ to $x=7$. Compare their size with the observed values, which are all above ${intercept}, and watch whether the signs follow any shape.`,
        explanation: [
          "A residual is observed minus predicted: how far the model missed each data point. A good model leaves small residuals that scatter randomly around 0.",
          `The residuals are ${resid.map(signed).join(", ")}.`,
          "Their signs switch back and forth with no shape, and each is small compared with the observed values.",
          "That scatter is what a suitable model leaves behind, so a line is reasonable for these values of $x$.",
        ],
        choices: options(r, correct, [
          {
            label: "A curve is needed, because the residuals are not all 0.",
            feedback:
              "Residuals are almost never all 0. A curve is needed only when they follow a pattern.",
          },
          {
            label:
              "The line is a poor model, because some residuals are positive and others negative.",
            feedback:
              "Both signs are expected for a good fit. They only signal trouble when they appear in a run or shape.",
          },
          {
            label: `The line will predict accurately at any $x$, including $x=100$.`,
            feedback:
              "A good fit within these $x$ values does not show the line holds far outside them.",
          },
        ]),
      },
    };
  }
  if (variant === "extrapolation") {
    const resid = [1, -1, 0, 1, -1, 0, 1];
    const X = 6 * r(5, 9);
    const correct = `The prediction at x = ${X} is an extrapolation far beyond x = 1 to 7, so these residuals do not show it is reliable.`;
    return {
      variant,
      draft: {
        prompt: `${intro} The data: ${table(resid)}. The residuals are small and show no pattern. A report uses the model to predict the ${ctx.y} when $x=${X}$. Which statement is justified?`,
        answer: correct,
        hint: `Compare ${X} with the $x$-values in the table, 1 to 7. Ask what the small residuals tell you about $x$-values the data never reached.`,
        explanation: [
          "A residual is observed minus predicted. Small residuals with no pattern show the line fits, but only where there is data.",
          "Here the data run from $x=1$ to $x=7$, so the residuals support the line in that range.",
          `The prediction at x = ${X} is $\\hat y=${slope}(${X})+${intercept}=${slope * X + intercept}$, far outside that range.`,
          "Predicting far outside the data is called extrapolation. The data say nothing about whether the trend continues out there.",
          "So the prediction is an unsupported extrapolation, and these residuals do not show it is reliable.",
        ],
        choices: options(r, correct, [
          {
            label: `The prediction at x = ${X} is reliable, because the residuals for x = 1 to 7 are small.`,
            feedback: `Small residuals support the model only where there is data. The value x = ${X} is outside it.`,
          },
          {
            label:
              "The prediction is reliable, because the model is a straight line.",
            feedback:
              "A straight line extends forever on paper, but the real quantity may not keep growing at a constant rate.",
          },
          {
            label: "No prediction from any model can ever be made.",
            feedback:
              "Models can predict within the range of the data. Predicting far outside it is the problem.",
          },
        ]),
      },
    };
  }
  const aAlternating = r(2, 3);
  const residA = [
    aAlternating,
    -aAlternating,
    aAlternating,
    -aAlternating,
    aAlternating,
    -aAlternating,
  ];
  const residB = pick(r, [
    [1, 1, 0, 1, -1, 1],
    [1, 0, 1, 1, 1, -1],
    [0, 1, -1, 1, 1, 1],
  ]);
  const swap = r(0, 1) === 1;
  const sq = (v: number[]) => v.reduce((acc, e) => acc + e * e, 0);
  const sum = (v: number[]) => v.reduce((acc, e) => acc + e, 0);
  const [nameZero, nameSmall, zero, small] = swap
    ? (["B", "A", residA, residB] as const)
    : (["A", "B", residA, residB] as const);
  const listA = swap ? small : zero;
  const listB = swap ? zero : small;
  const correct = `Model ${nameSmall} fits better: its sum of squared residuals is ${sq(small)}, compared with ${sq(zero)}.`;
  return {
    variant: "compare-models",
    draft: {
      prompt: `Two models predict the same 6 data values. A residual is observed minus predicted. Model A residuals: ${listA.map(signed).join(", ")}. Model B residuals: ${listB.map(signed).join(", ")}. Which statement is justified? (Compare the sum of the squared residuals, since squaring removes the sign.)`,
      answer: correct,
      hint: `For the first list, ${listA.map(signed).join(", ")}, add the residuals and also square each residual before adding. Notice what happens to positive and negative residuals when you only add.`,
      explanation: [
        "A residual is observed minus predicted: how far the model missed each point. A better model has residuals closer to 0 overall.",
        `Model ${nameZero}: residuals add to ${signed(sum(zero))}, but the sum of squares is ${zero.map((e) => `${e * e}`).join(" + ")} = ${sq(zero)}.`,
        `Model ${nameSmall}: residuals add to ${signed(sum(small))}, and the sum of squares is ${small.map((e) => `${e * e}`).join(" + ")} = ${sq(small)}.`,
        `Squaring stops positive and negative residuals from canceling. The smaller sum of squares, ${sq(small)}, means Model ${nameSmall} stays closer to the data.`,
      ],
      choices: options(r, correct, [
        {
          label: `Model ${nameZero} fits better: its residuals add to ${signed(sum(zero))}, closer to 0 than ${signed(sum(small))}.`,
          feedback:
            "Positive and negative residuals cancel when added, so a sum near 0 hides large misses. Square the residuals first.",
        },
        {
          label:
            "The models fit equally well: both have residuals of both signs.",
          feedback:
            "Having both signs does not measure how far the predictions are from the data. Compare the sums of squared residuals.",
        },
        {
          label: `Model ${nameSmall} fits better: it has more positive residuals than negative ones.`,
          feedback:
            "Counting signs does not measure distance from the data. Compare the sum of squared residuals.",
        },
      ]),
    },
  };
}

// ------------------------------------------------------------------- dispatch
const builders: Record<string, (r: Random) => Built> = {
  "normal-model-rule": normalCase,
  "random-variable-distribution": randomVariableCase,
  "theoretical-distribution-expectation": theoreticalCase,
  "empirical-distribution-expectation": empiricalCase,
  "strategy-expected-value": strategyCase,
  "fair-selection-procedure": fairCase,
  "simulation-consistency-check": simulationCase,
  "randomization-test-decision": randomizationCase,
  "report-flaw-critique": reportCase,
  "model-residual-conclusion": modelCase,
};

function build(templateId: string, seed: string) {
  const meta = statisticsProbabilityTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown statistics template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const built = builders[templateId]!(r);
  return { meta, seed, r, built };
}

/** Private case metadata (variant) for bounded branch checks and independent review. */
export function statisticsProbabilityVariant(templateId: string, seed: string) {
  return build(templateId, seed).built.variant;
}

export function generateStatisticsProbabilityProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const { meta, r, built } = build(templateId, seed);
  return assemble(meta, seed, r, built.draft);
}
