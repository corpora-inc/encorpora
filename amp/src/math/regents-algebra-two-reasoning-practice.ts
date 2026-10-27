import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { shuffle } from "./distribution-practice";
import { f as fn, graph, scene as sceneOf } from "./scene/author";
import { CARD } from "./figure-choice-practice";
import { polyTex } from "./regents-algebra-two-kit";

type R = (lo: number, hi: number) => number;
const fail = () => {
  throw new Error("Need three retries");
};
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
  ...(/figure/.test(description)
    ? { requiredFigureCapability: "scenes-v1" as const }
    : {}),
  description,
});

export const studyDesignClassifyTemplate = meta(
  "study-design-classify",
  "Classify a described study and give the reason",
  "causal-claims",
  0.3,
  "Decide whether a described study is a randomized experiment or an observational study, and choose the sentence that gives the correct reason.",
);
export const quarticFactoredFormTemplate = meta(
  "quartic-factored-form",
  "Choose the factored form of a quartic binomial with a common factor",
  "factor-quadratics",
  0.55,
  "Factor $cx^4-ck^4$ completely over the integers: take out the common factor, then a difference of squares, and choose the equivalent expression among forms with sign, factor and repeated-factor slips.",
);
export const cubicQuotientFactoredTemplate = meta(
  "cubic-quotient-factored",
  "Choose the factored quotient of a cubic divided by a linear binomial",
  "rational-expressions",
  0.55,
  "A cubic written in standard form is divided by one of its linear factors with leading coefficient 2, 3 or 5. Choose the factored quotient, by factoring or by division.",
);
export const completeSquareFirstStepsTemplate = meta(
  "complete-square-first-steps",
  "Judge the first steps of completing the square",
  "equation-reasoning",
  0.55,
  "Decide which of three possible first steps on a quadratic equation are valid, including an invalid zero-product step and a sign slip, and choose the correct set.",
);
export const exponentialPointsStatementTemplate = meta(
  "exponential-points-statement",
  "Choose the true statement about an exponential model through three graphed points",
  "exponential-models",
  0.5,
  "Three graphed points at equal spacing show a quantity doubling. Choose the statement that gives the correct doubling time and the matching model, among a wrong time, a wrong base and a linear model; the figure shows the points.",
);
export const rationalAbsCountTemplate = meta(
  "rational-abs-solution-count",
  "Count the solutions of a rational expression equal to an absolute value",
  "graphical-equation-solving",
  0.6,
  "Count the points where the graph of $\\frac{a}{x-h}+k$ meets the graph of $|x-p|+q$, found exactly from the two cases of the absolute value; the figure shows both graphs.",
);

const sg = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
const xs = (k: number) =>
  k === 0 ? "x" : `x ${k < 0 ? "-" : "+"} ${Math.abs(k)}`;

/* ------------------------------------------------ study design */
const experiments = [
  (n: number) =>
    `A researcher randomly assigns ${n} volunteers to take a new vitamin or a placebo for 8 weeks and then measures each volunteer's energy level.`,
  (n: number) =>
    `A farmer randomly picks half of ${n} plots to receive a new fertilizer and the other half to receive none, then measures the crop yield of every plot.`,
  (n: number) =>
    `A teacher flips a coin for each of ${n} students to decide whether the student uses a study app or a paper guide, and compares their test scores.`,
  (n: number) =>
    `A company randomly assigns ${n} employees to a four-day or a five-day work week and compares their productivity scores after three months.`,
];
const observations = [
  (n: number) =>
    `A researcher surveys ${n} adults about how many hours they sleep each night and records their reaction times.`,
  (n: number) =>
    `A school records the grades of ${n} students who chose to join the band and of ${n} who chose not to join.`,
  (n: number) =>
    `A doctor reviews the records of ${n} patients, some of whom already take a vitamin, and compares their blood pressure.`,
  (n: number) =>
    `A city counts the number of ${n} households that already use solar panels and compares their electric bills with those of the households that do not.`,
];
export const studyDesignClassify = chainFamily({
  template: studyDesignClassifyTemplate,
  axes: { kind: defineAxis("kind", ["experiment", "observational"] as const) },
  model: (r: R, ax) => ({
    idx: r(0, 3),
    n: pick(r, [40, 60, 80, 120, 150, 200] as const),
    exp: ax.kind === "experiment",
  }),
  variant: (m) => `${m.exp ? "experiment" : "observational"}-${m.idx}`,
  render: (m, _ax, r) => {
    const text = (m.exp ? experiments : observations)[m.idx]!(m.n);
    const E1 =
      "Experiment, because the researcher assigned who received each treatment";
    const O1 =
      "Observational study, because the researcher only recorded values for groups that already existed";
    const E2 =
      "Experiment, because the researcher measured a response variable";
    const O2 = "Observational study, because the subjects were not all alike";
    const correct = m.exp ? E1 : O1;
    const fb: Record<string, string> = {
      [E1]: "Assigning each subject to a treatment is what makes a study an experiment. In this study nobody was assigned a treatment by the researcher.",
      [O1]: "In this study the researcher assigned the treatments, so it is an experiment. An observational study only records what already happens.",
      [E2]: "Both kinds of study measure a response. What makes a study an experiment is that the researcher assigns the treatments.",
      [O2]: "Subjects are never all alike. A study is observational when the researcher does not assign the treatments.",
    };
    const options: ChoiceOption[] = [E1, O1, E2, O2].map((label) =>
      label === correct
        ? { label, correct: true as const }
        : { label, feedback: fb[label]! },
    );
    return choiceSurface(r, {
      prompt: `${text} Which statement correctly classifies this study and gives the reason?`,
      label: "Choose the statement",
      options,
      hint: `In the study of ${m.n} subjects, ask who decided which treatment or group each subject was in: the researcher, or the subjects themselves or circumstances.`,
      explanation: m.exp
        ? [
            "The researcher decides, by chance, which treatment each subject receives.",
            "A study in which the researcher assigns the treatments is an experiment.",
          ]
        : [
            "The groups already existed, or the subjects chose them; the researcher assigned nothing.",
            "A study that only records existing groups is observational.",
          ],
    });
  },
});

/* ------------------------------------------------ eval helper text */
const prod = (c: number, parts: string[]) =>
  `${c === 1 ? "" : c}${parts.join("")}`;
const bin = (k: number, v = "x") =>
  `(${v} ${k < 0 ? "-" : "+"} ${Math.abs(k)})`;

/* ------------------------------------------------ quartic */
export const quarticFactoredForm = chainFamily({
  template: quarticFactoredFormTemplate,
  axes: {},
  model: (r: R) => ({ c: pick(r, [2, 3, 4, 5, 6] as const), k: r(2, 3) }),
  variant: (m) => `k-${m.k}`,
  render: (m, _a, r) => {
    const { c, k } = m;
    const expr = `${c}x^4 - ${c * k ** 4}`;
    const lab = (s: string) => `$${s}$`;
    const sumK = `(x^2 + ${k * k})`;
    const difK = `(x^2 - ${k * k})`;
    const options: ChoiceOption[] = [
      { label: lab(prod(c, [bin(-k), bin(k), sumK])), correct: true },
      {
        label: lab(prod(1, [bin(-k), bin(k), sumK])),
        feedback: `Removing the common factor ${c} gives $x^4 - ${k ** 4}$, so ${c} must stay in front of the factored form.`,
      },
      {
        label: lab(prod(c, [bin(-k), bin(k), difK])),
        feedback: `$x^2 - ${k * k}$ was factored once, leaving $x^2 + ${k * k}$, not a second difference of squares: the second quadratic factor is the sum $x^2 + ${k * k}$.`,
      },
      {
        label: lab(prod(c, [sumK, sumK])),
        feedback: `$${sumK.slice(1, -1)}$ squared expands to $x^4 + ${2 * k * k}x^2 + ${k ** 4}$; $x^4 - ${k ** 4}$ has no $x^2$ term and its constant term is negative.`,
      },
      {
        label: lab(prod(c, [bin(-k), bin(-k), sumK])),
        feedback: `A difference of squares has one factor $(x - ${k})$ and one factor $(x + ${k})$, not $(x - ${k})$ twice.`,
      },
    ];
    return choiceSurface(r, {
      prompt: `Which expression is equivalent to $${expr}$?`,
      label: "Choose the expression",
      options,
      hint: `Take out the common factor of ${c} and ${c * k ** 4} first, then notice that $x^4$ is $(x^2)^2$ and ${k ** 4} is ${k * k} squared.`,
      explanation: [
        `Factor out ${c}: $${expr} = ${c}(x^4 - ${k ** 4})$.`,
        `Difference of squares: $x^4 - ${k ** 4} = (x^2 - ${k * k})(x^2 + ${k * k})$.`,
        `Factor $x^2 - ${k * k} = (x - ${k})(x + ${k})$. The sum $x^2 + ${k * k}$ does not factor over the integers.`,
        `$${expr} = ${prod(c, [bin(-k), bin(k), sumK])}$.`,
      ],
    });
  },
});

/* ------------------------------------------------ cubic quotient */
export const cubicQuotientFactored = chainFamily({
  template: cubicQuotientFactoredTemplate,
  axes: { lead: defineAxis("lead", ["two", "three", "five"] as const) },
  model: (r: R, ax) => {
    const a = ax.lead === "two" ? 2 : ax.lead === "three" ? 3 : 5;
    const b = r(-5, 5);
    const m = r(-5, 5);
    const n = r(-5, 5);
    if (!b || !m || !n || m === n || m === -n) fail();
    return { a, b, m, n };
  },
  variant: (m) => `lead-${m.a}`,
  render: (m, _ax, r) => {
    const { a, b, m: p, n: q } = m;
    // numerator = (a x + b)(x - p)(x - q)
    const quad = [1, -(p + q), p * q];
    const num = [
      a * quad[0]!,
      a * quad[1]! + b * quad[0]!,
      a * quad[2]! + b * quad[1]!,
      b * quad[2]!,
    ];
    const lin = `${a}x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
    const lab = (s: string) => `$${s}$`;
    const options: ChoiceOption[] = [
      { label: lab(`${bin(-p)}${bin(-q)}`), correct: true },
      {
        label: lab(`${bin(p)}${bin(q)}`),
        feedback: `Each factor $(x - r)$ has a zero at $x = r$. Check by multiplying: $${bin(p)}${bin(q)}$ has the opposite signs.`,
      },
      {
        label: lab(`${a}${bin(-p)}${bin(-q)}`),
        feedback: `The leading coefficient ${a} of the cubic comes from the divisor $${lin}$, so it cancels and does not stay in the quotient.`,
      },
      {
        label: lab(`${bin(-p)}${bin(q)}`),
        feedback: `Only one sign is changed here; multiplying the two factors gives a middle term of $${sg(q - p)}x$, not $${sg(-(p + q))}x$.`,
      },
    ];
    return choiceSurface(r, {
      prompt: `Which expression is equivalent to $\\frac{${polyTex(num)}}{${lin}}$, where $${lin} \\ne 0$?`,
      label: "Choose the expression",
      options,
      hint: `Divide $${polyTex(num)}$ by $${lin}$ using long division or by checking that $${lin}$ is a factor, then factor the quadratic quotient.`,
      explanation: [
        `Dividing the cubic by $${lin}$ leaves the quadratic quotient $${polyTex(quad)}$.`,
        `Factor the quotient: $${polyTex(quad)} = ${bin(-p)}${bin(-q)}$, because ${p} and ${q} multiply to ${p * q} and add to ${p + q}.`,
      ],
    });
  },
});

/* ------------------------------------------------ complete square steps */
interface Step {
  text: string;
  poly: number[] | null; // equivalent a'x^2+b'x+c' = 0, null for a zero-product conclusion
  valid: boolean;
  reason: string;
}
export function completeSquareSteps(a: number, b: number, c: number): Step[] {
  const lhs2 = polyTex([a, b, 0]);
  const sign = (v: number) => (v < 0 ? "-" : "+");
  return [
    {
      text: `$${polyTex([1, b / a, c / a])} = 0$`,
      poly: [1, b / a, c / a],
      valid: true,
      reason: `dividing every term by ${a} keeps the same solutions`,
    },
    {
      text: `$${lhs2} = ${-c}$`,
      poly: [a, b, c],
      valid: true,
      reason: `subtracting ${c} from both sides keeps the same solutions`,
    },
    {
      text: `$${lhs2} = ${c}$`,
      poly: [a, b, -c],
      valid: false,
      reason: `the constant ${c} changes sign when it moves to the other side, giving ${-c}`,
    },
    {
      text: `$${polyTex([1, b, c])} = 0$`,
      poly: [1, b, c],
      valid: false,
      reason: `every term, including the constant, must be divided by ${a}; here only the first term was`,
    },
    {
      text: `$x(${a}x ${sign(b)} ${Math.abs(b)}) = ${-c}$, so $x = ${-c}$ or $${a}x ${sign(b)} ${Math.abs(b)} = ${-c}$`,
      poly: null,
      valid: false,
      reason:
        "the zero-product property applies only when the product equals 0, not another number",
    },
  ];
}
const roman = ["I", "II", "III"];
const setLabel = (idx: number[]) =>
  idx.length === 3
    ? "All three steps are correct"
    : idx.length === 1
      ? `Only step ${roman[idx[0]!]} is correct`
      : `Only steps ${roman[idx[0]!]} and ${roman[idx[1]!]} are correct`;
export const completeSquareFirstSteps = chainFamily({
  template: completeSquareFirstStepsTemplate,
  axes: {},
  model: (r: R) => {
    const a = pick(r, [2, 3, 4] as const);
    const b = a * r(1, 4) * (r(0, 1) ? 1 : -1);
    const c = a * r(1, 5) * (r(0, 1) ? 1 : -1);
    const all = completeSquareSteps(a, b, c);
    const pickIdx = shuffle(r, [0, 1, 2, 3, 4]).slice(0, 3);
    const steps = pickIdx.map((i) => all[i]!);
    const valid = steps.map((s, i) => (s.valid ? i : -1)).filter((i) => i >= 0);
    if (!valid.length || valid.length === 3) fail();
    return { a, b, c, steps, valid };
  },
  variant: (m) => `valid-${m.valid.length}`,
  render: (m, _ax, r) => {
    const { a, b, c, steps, valid } = m;
    const key = valid.join("");
    const subsets: number[][] = [
      [0],
      [1],
      [2],
      [0, 1],
      [0, 2],
      [1, 2],
      [0, 1, 2],
    ];
    const wrong = shuffle(
      r,
      subsets.filter((s) => s.join("") !== key),
    ).slice(0, 3);
    const options: ChoiceOption[] = [{ label: setLabel(valid), correct: true }];
    for (const s of wrong) {
      const bad = [0, 1, 2].filter((i) =>
        s.includes(i) ? !steps[i]!.valid : steps[i]!.valid,
      );
      const i = bad[0]!;
      options.push({
        label: setLabel(s),
        feedback: steps[i]!.valid
          ? `Step ${roman[i]} is correct: ${steps[i]!.reason}.`
          : `Step ${roman[i]} is not correct: ${steps[i]!.reason}.`,
      });
    }
    return choiceSurface(r, {
      prompt: `A student begins to solve $${polyTex([a, b, c])} = 0$ and considers three first steps. Step I: ${steps[0]!.text}. Step II: ${steps[1]!.text}. Step III: ${steps[2]!.text}. Which choice describes the correct steps? A correct step leaves the solutions unchanged.`,
      label: "Choose the statement",
      options,
      hint: `For each step, compare it with $${polyTex([a, b, c])} = 0$: did the same operation happen to every term, and did the constant ${c} change sign when it moved? Test the steps one at a time.`,
      explanation: steps.map(
        (s, i) =>
          `Step ${roman[i]} is ${s.valid ? "correct" : "not correct"}: ${s.reason}.`,
      ),
    });
  },
});

/* ------------------------------------------------ exponential points */
export const exponentialPointsStatement = chainFamily({
  template: exponentialPointsStatementTemplate,
  axes: {},
  model: (r: R) => ({ T: r(2, 5), A: pick(r, [10, 20, 40, 50] as const) }),
  variant: (m) => `T-${m.T}`,
  render: (m, _ax, r) => {
    const { T, A } = m;
    const pts = [
      [0, A],
      [T, 2 * A],
      [2 * T, 4 * A],
    ] as const;
    const lab = (s: string) => `$${s}$`;
    const options: ChoiceOption[] = [
      {
        label: lab(
          `\\text{doubles every } ${T} \\text{ units: } y = ${A}\\cdot 2^{x/${T}}`,
        ),
        correct: true,
      },
      {
        label: lab(
          `\\text{doubles every } ${2 * T} \\text{ units: } y = ${A}\\cdot 2^{x/${2 * T}}`,
        ),
        feedback: `From $(${T}, ${2 * A})$ to $(${2 * T}, ${4 * A})$ the value doubles in ${T} units, not ${2 * T}.`,
      },
      {
        label: lab(`\\text{doubles every unit: } y = ${A}\\cdot 2^{x}`),
        feedback: `At $x = 1$ this model gives ${2 * A}, but the graph shows ${2 * A} only at $x = ${T}$.`,
      },
      {
        label: lab(`\\text{grows linearly: } y = ${A} + ${A / T}x`),
        feedback: `A linear model adds the same amount in equal steps. Here the value rises by ${A}, then by ${2 * A}, so the growth is not constant.`,
      },
    ];
    const plot = graph({
      x: [0, 3 * T],
      y: [0, 5 * A],
      grid: [1, A],
      tick: [T, A],
      aspect: 1,
      axisNames: ["x", "y"],
    });
    let g = plot;
    for (const [x, y] of pts) g = g.point(x, y, undefined, { color: "accent" });
    const surface = choiceSurface(r, {
      prompt: `Three points of an exponential model are graphed: $(0, ${A})$, $(${T}, ${2 * A})$ and $(${2 * T}, ${4 * A})$. Which statement is true?`,
      label: "Choose the statement",
      options,
      hint: `Compare the $y$-values at equal spacing: ${A}, ${2 * A} and ${4 * A}, at $x = 0, ${T}, ${2 * T}$. Find the factor by which the value is multiplied each time $x$ increases by ${T}.`,
      explanation: [
        `From $(0, ${A})$ to $(${T}, ${2 * A})$ the value is multiplied by 2, and from $(${T}, ${2 * A})$ to $(${2 * T}, ${4 * A})$ it is multiplied by 2 again.`,
        `So the value doubles every ${T} units, and the model is $y = ${A}\\cdot 2^{x/${T}}$.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(g).build(CARD) },
      }
    );
  },
});

/* ------------------------------------------------ rational = abs count */
export function countRationalAbs(
  a: number,
  h: number,
  k: number,
  p: number,
  q: number,
): { count: number; roots: number[] } | null {
  const roots: number[] = [];
  for (const s of [1, -1]) {
    const A = s;
    const B = -s * h - s * p + q - k;
    const C = s * p * h - q * h - a + k * h;
    const D = B * B - 4 * A * C;
    if (D < 0) continue;
    if (D === 0) return null;
    const sq = Math.sqrt(D);
    for (const root of [(-B + sq) / (2 * A), (-B - sq) / (2 * A)]) {
      if (Math.abs(root - h) < 1e-6) return null;
      if (Math.abs(root - p) < 1e-6) return null;
      if (s === 1 ? root > p : root < p) roots.push(root);
    }
  }
  return { count: roots.length, roots };
}
export const rationalAbsCount = chainFamily({
  template: rationalAbsCountTemplate,
  axes: {},
  model: (r: R) => {
    const a = (r(0, 1) ? 1 : -1) * r(1, 6);
    const h = r(-3, 3);
    const k = r(-3, 3);
    const p = r(-3, 3);
    const q = r(-3, 3);
    const res = countRationalAbs(a, h, k, p, q);
    if (!res) fail();
    if (
      res!.roots.some(
        (x) => Math.abs(x) > 6.5 || Math.abs(Math.abs(x - p) + q) > 6.5,
      )
    )
      fail();
    return { a, h, k, p, q, count: res!.count };
  },
  variant: (m) => `count-${m.count}`,
  render: (m, _ax, r) => {
    const { a, h, k, p, q, count } = m;
    const others = shuffle(
      r,
      [0, 1, 2, 3, 4].filter((n) => n !== count),
    ).slice(0, 3);
    const lab = (n: number) => `${n}`;
    const options: ChoiceOption[] = [
      { label: lab(count), correct: true },
      ...others.map((n) => ({
        label: lab(n),
        feedback: `Count the points where the two graphs meet: there ${count === 1 ? "is" : "are"} ${count}, not ${n}. Each meeting point is one solution.`,
      })),
    ];
    const left = `\\frac{${a}}{${xs(-h)}}${k === 0 ? "" : ` ${k < 0 ? "-" : "+"} ${Math.abs(k)}`}`;
    const right = `|${xs(-p)}|${q === 0 ? "" : ` ${q < 0 ? "-" : "+"} ${Math.abs(q)}`}`;
    const g = graph({
      x: [-8, 8],
      y: [-8, 8],
      grid: 1,
      tick: 2,
      aspect: 1,
      axisNames: ["x", "y"],
    })
      .curve(fn.rational([k, a - k * h], [1, -h]), { color: "accent" })
      .curve(fn.abs(1, p, q), { color: "warm" });
    const surface = choiceSurface(r, {
      prompt: `The graphs of $y = ${left}$ and $y = ${right}$ are shown. How many solutions does the equation $${left} = ${right}$ have?`,
      label: "Choose the number of solutions",
      options,
      hint: `A solution is a point where the graph of $y = ${left}$ meets the graph of $y = ${right}$. The first graph has a vertical asymptote at $x = ${h}$; count the meeting points on each side of it.`,
      explanation: [
        `The absolute value splits into $x \\ge ${p}$ and $x < ${p}$. In each case, multiply both sides by $${xs(-h)}$ to get a quadratic.`,
        `Solve each quadratic and keep only the roots that satisfy the case's condition and are not ${h}.`,
        `The solutions are the points where the graphs meet. There ${count === 1 ? "is" : "are"} ${count}.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(g).build(CARD) },
      }
    );
  },
});

export const regentsAlgebraTwoReasoningTemplates = [
  studyDesignClassifyTemplate,
  quarticFactoredFormTemplate,
  cubicQuotientFactoredTemplate,
  completeSquareFirstStepsTemplate,
  exponentialPointsStatementTemplate,
  rationalAbsCountTemplate,
];
export const regentsAlgebraTwoReasoningGenerate = dispatch(
  regentsAlgebraTwoReasoningTemplates,
  {
    "study-design-classify": (s) => studyDesignClassify.generate(s).problem,
    "quartic-factored-form": (s) => quarticFactoredForm.generate(s).problem,
    "cubic-quotient-factored": (s) => cubicQuotientFactored.generate(s).problem,
    "complete-square-first-steps": (s) =>
      completeSquareFirstSteps.generate(s).problem,
    "exponential-points-statement": (s) =>
      exponentialPointsStatement.generate(s).problem,
    "rational-abs-solution-count": (s) => rationalAbsCount.generate(s).problem,
  },
);
