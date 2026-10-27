import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { random, shuffle, type Random } from "./distribution-practice";
import { f as fn, graph, scene as sceneOf } from "./scene/author";
import { CARD, problemOf, type Candidate } from "./figure-choice-practice";

type R = (lo: number, hi: number) => number;
const fail = () => {
  throw new Error("Need three retries");
};
const base = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  figureChoice = false,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: figureChoice
    ? "figure-choice-v1"
    : "single-choice-v1",
  requiredFigureCapability: "scenes-v1",
  description,
});
export const logBaseFractionGraphTemplate = base(
  "log-base-fraction-graph",
  "Choose the graph of a logarithm with a base between 0 and 1",
  "logarithms",
  0.5,
  "Choose the graph of $y=\\log_b x$ for a base $b$ of one half, one third or one fourth, among the graph of the base reciprocal, of an exponential decay and of an exponential growth.",
  true,
);
export const remainderZeroGraphTemplate = base(
  "remainder-zero-graph",
  "Choose the graph of a polynomial that is divisible by a linear binomial",
  "polynomial-division",
  0.55,
  "Use the remainder theorem to choose the graph of a cubic with zero remainder on division by $x-r$, among graphs with the zero at $-r$, a graph shifted off the axis at $x=r$ and a graph with no zero near $r$.",
  true,
);
export const repeatedZeroRuleTemplate = base(
  "repeated-zero-rule",
  "Choose the polynomial rule that matches a graph with a repeated zero",
  "polynomial-zeros",
  0.55,
  "From a graph of a cubic that touches the axis at one zero and crosses at another, with a negative leading coefficient, choose the factored rule; the figure shows the graph.",
);
export const sinusoidCompareRuleTemplate = base(
  "sinusoid-compare-rule",
  "Compare a graphed sinusoid with a sine rule",
  "trigonometric-graphs",
  0.55,
  "Read the maximum and period from the graph of $f(x)=A\\sin\\left(\\frac{2\\pi}{P}x\\right)$ and compare them with a function given by a rule, choosing the statement about maximum and frequency; the figure shows the graph.",
);
export const tideCosineEquationTemplate = base(
  "tide-cosine-equation",
  "Write the cosine equation of a graphed periodic model",
  "periodic-modeling",
  0.6,
  "Read the maximum, minimum and period from a graph that starts at a maximum or a minimum and choose the equation $y=A\\cos\\left(\\frac{2\\pi}{P}x\\right)+D$; the figure shows the graph.",
);
export const cubicGraphStatementTemplate = base(
  "cubic-graph-statement",
  "Choose the true statement about a graphed cubic",
  "polynomial-behavior",
  0.6,
  "From the graph of a cubic with a double zero and a simple zero, choose the one true statement about end behavior, the multiplicity of a zero, or an interval where the function increases or decreases; the figure shows the graph.",
);

const sg = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
const plane = (lo = -6, hi = 6, ylo = -6, yhi = 6) =>
  graph({
    x: [lo, hi],
    y: [ylo, yhi],
    grid: 1,
    tick: 2,
    aspect: (hi - lo) / (yhi - ylo),
    axisNames: ["x", "y"],
  });
const rec = (c: R): Random => c;
void rec;

/* ------------------------------------------------ log graph (figure choice) */
function logBaseFractionGraph(seed: string): GeneratedProblem {
  const meta = logBaseFractionGraphTemplate;
  const r = random(meta.id, seed);
  const d = pick(r, [2, 3, 4] as const);
  const b = 1 / d;
  const win = () => plane(-2, 6, -4, 4);
  const card = (
    plot: ReturnType<typeof win>,
    description: string,
    feedback?: (n: string) => string,
  ): Candidate => ({
    description,
    scene: sceneOf(plot).build(CARD),
    ...(feedback ? { feedback } : {}),
  });
  const correct = card(
    win().curve(fn.log(1, b), { color: "accent" }),
    "A curve that falls from left to right, passes through the point (1, 0) and stays to the right of the y-axis.",
  );
  const distractors = [
    card(
      win().curve(fn.log(1, d), { color: "accent" }),
      "A curve that rises from left to right, passes through the point (1, 0) and stays to the right of the y-axis.",
      (n) =>
        `${n} rises. For a base between 0 and 1, larger inputs give smaller logarithms, so the graph falls. This graph is $y = \\log_{${d}} x$, with base ${d}.`,
    ),
    card(
      win().curve(fn.exp(1, b), { color: "accent" }),
      "A curve that falls from left to right and passes through the point (0, 1), reaching across the whole x-axis.",
      (n) =>
        `${n} passes through $(0, 1)$ and is defined for every $x$: it is the exponential $y = \\left(\\frac{1}{${d}}\\right)^x$. A logarithm passes through $(1, 0)$.`,
    ),
    card(
      win().curve(fn.exp(1, d), { color: "accent" }),
      "A curve that rises from left to right and passes through the point (0, 1), reaching across the whole x-axis.",
      (n) =>
        `${n} is an exponential growth curve $y = ${d}^x$. A logarithm passes through $(1, 0)$ and is only defined for $x > 0$.`,
    ),
  ];
  return problemOf(meta, seed, r, {
    prompt: `Which graph represents $y = \\log_{1/${d}} x$?`,
    label: "Choose the graph",
    noun: "Graph",
    correct,
    distractors,
    hint: `Since $\\log_b 1 = 0$ for every base, the graph of $y = \\log_{1/${d}} x$ passes through $(1, 0)$. The base $\\frac{1}{${d}}$ is less than 1, so decide whether the values rise or fall as $x$ grows.`,
    explanation: (name) => [
      "Every logarithm graph passes through $(1, 0)$ and lies to the right of the $y$-axis, since logarithms are only defined for positive inputs.",
      `The base $\\frac{1}{${d}}$ is between 0 and 1, so the logarithm decreases as $x$ increases.`,
      `${name} is the graph that falls and passes through $(1, 0)$.`,
    ],
    walkthrough: sceneOf(win().curve(fn.log(1, b), { color: "accent" })).build({
      title: "A logarithm graph with a base below 1",
      width: 300,
      maxHeight: 300,
    }),
  });
}

/* ------------------------------------------------ remainder zero graph */
function remainderZeroGraph(seed: string): GeneratedProblem {
  const meta = remainderZeroGraphTemplate;
  const r = random(meta.id, seed);
  for (let t = 0; t < 200; t++) {
    const root = pick(r, [2, 3, 4, -2, -3, -4] as const);
    const zeros = () => {
      const u = r(-4, 4);
      const v = r(-4, 4);
      return [u, v] as const;
    };
    const [u, v] = zeros();
    if ([u, v].some((z) => z === root) || u === v) continue;
    const [u2, v2] = zeros();
    if (
      [u2, v2, -root].some((z) => z === root) ||
      u2 === v2 ||
      u2 === -root ||
      v2 === -root ||
      u2 === u ||
      v2 === v
    )
      continue;
    const [u3, v3] = zeros();
    if ([u3, v3].some((z) => z === root) || u3 === v3) continue;
    const c = 0.25;
    const poly = (z1: number, z2: number, z3: number, up = 0) => {
      // c (x - z1)(x - z2)(x - z3) + up
      const s1 = z1 + z2 + z3;
      const s2 = z1 * z2 + z1 * z3 + z2 * z3;
      const s3 = z1 * z2 * z3;
      return fn.poly(c, -c * s1, c * s2, -c * s3 + up);
    };
    const val = (z1: number, z2: number, z3: number, x: number, up = 0) =>
      c * (x - z1) * (x - z2) * (x - z3) + up;
    const sets = [
      [root, u, v, 0],
      [-root, u2, v2, 0],
      [root, u, v, 2],
      [u3, v3, r(-4, 4), 0],
    ] as const;
    if (sets[3][2] === root) continue;
    // Distractor 4 must not vanish at the root.
    if (val(sets[3][0], sets[3][1], sets[3][2], root) === 0) continue;
    const win = () => plane(-6, 6, -6, 6);
    const card = (
      s: readonly [number, number, number, number],
      description: string,
      feedback?: (n: string) => string,
    ): Candidate => ({
      description,
      scene: sceneOf(
        win().curve(poly(s[0], s[1], s[2], s[3]), { color: "accent" }),
      ).build(CARD),
      ...(feedback ? { feedback } : {}),
    });
    const zerosText = (s: readonly [number, number, number, number]) =>
      `crosses the x-axis at ${[s[0], s[1], s[2]]
        .sort((p, q) => p - q)
        .map(sg)
        .join(", ")}`;
    try {
      return problemOf(meta, seed, r, {
        prompt: `For which graph does the polynomial $p(x)$ have a remainder of 0 when divided by $x ${root < 0 ? "+" : "-"} ${Math.abs(root)}$?`,
        label: "Choose the graph",
        noun: "Graph",
        correct: card(sets[0], `A cubic that ${zerosText(sets[0])}.`),
        distractors: [
          card(
            sets[1],
            `A cubic that ${zerosText(sets[1])}.`,
            (n) =>
              `${n} has a zero at $x = ${-root}$ but not at $x = ${root}$. The remainder on division by $x ${root < 0 ? "+" : "-"} ${Math.abs(root)}$ is $p(${root})$, which must be 0, so the zero must be at $x = ${root}$.`,
          ),
          card(
            sets[2],
            `A cubic that passes through the point (${root}, 2).`,
            (n) =>
              `${n} is raised 2 units, so $p(${root}) = 2$ and the remainder is 2, not 0.`,
          ),
          card(
            sets[3],
            `A cubic that ${zerosText([sets[3][0], sets[3][1], sets[3][2], 0])}.`,
            (n) =>
              `${n} does not cross the $x$-axis at $x = ${root}$, so $p(${root}) \\ne 0$ and the remainder is not 0.`,
          ),
        ],
        hint: `By the remainder theorem, the remainder on division by $x ${root < 0 ? "+" : "-"} ${Math.abs(root)}$ is $p(${root})$. Look for the graph whose height at $x = ${root}$ is 0.`,
        explanation: (name) => [
          `The remainder on division by $x ${root < 0 ? "+" : "-"} ${Math.abs(root)}$ is $p(${root})$.`,
          `The remainder is 0 exactly when the graph crosses or touches the $x$-axis at $x = ${root}$.`,
          `${name} has a zero at $x = ${root}$.`,
        ],
        walkthrough: sceneOf(
          win()
            .curve(poly(sets[0][0], sets[0][1], sets[0][2]), {
              color: "accent",
            })
            .point(root, 0, undefined, { color: "warm" }),
        ).build({ title: `A zero at x = ${root}`, width: 300, maxHeight: 300 }),
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("distinct")) continue;
      throw e;
    }
  }
  throw new Error(`${meta.id}: no instance for ${seed}`);
}

/* ------------------------------------------------ repeated zero rule */
export const repeatedZeroRule = chainFamily({
  template: repeatedZeroRuleTemplate,
  axes: {
    order: defineAxis("order", ["double-left", "double-right"] as const),
  },
  model: (r: R, ax) => {
    const a = r(-3, 3);
    const b = ax.order === "double-left" ? a + r(1, 3) : a - r(1, 3);
    if (Math.abs(b) > 4 || a === 0 || b === 0) fail();
    return { a, b };
  },
  variant: (m) => (m.b > m.a ? "double-left" : "double-right"),
  render: (m, _ax, r) => {
    const { a, b } = m;
    const f = (
      sa: number,
      sb: number,
      lead: number,
      pa: number,
      pb: number,
    ) => {
      const fac = (z: number, p: number) =>
        `(x ${z < 0 ? "+" : "-"} ${Math.abs(z)})${p === 2 ? "^2" : ""}`;
      return `$y = ${lead < 0 ? "-" : ""}${fac(sa, pa)}${fac(sb, pb)}$`;
    };
    const plot = plane(-6, 6, -6, 6).curve(
      fn.poly(-1, 2 * a + b, -(a * a + 2 * a * b), a * a * b),
      { color: "accent" },
    );
    const surface = choiceSurface(r, {
      prompt:
        "The graph of a cubic polynomial is shown. Which equation could represent it?",
      label: "Choose the equation",
      options: [
        { label: f(a, b, -1, 2, 1), correct: true },
        {
          label: f(a, b, 1, 2, 1),
          feedback:
            "The graph falls to the right, so as $x$ increases the values go to negative infinity. A cubic with a positive leading coefficient rises to the right.",
        },
        {
          label: f(a, b, -1, 1, 2),
          feedback: `The graph touches the $x$-axis at ${a} and crosses at ${b}. A factor that is squared gives a zero where the graph touches without crossing, so the square belongs to the factor for ${a}.`,
        },
        {
          label: f(-a, -b, -1, 2, 1),
          feedback: `A factor $(x - r)$ has its zero at $x = r$. The zeros here are ${a} and ${b}, so the signs inside the factors are reversed.`,
        },
      ],
      hint: `The graph touches the $x$-axis at $x = ${a}$ and crosses at $x = ${b}$, and it falls to the right. Decide which factor must be squared, then decide the sign of the leading coefficient.`,
      explanation: [
        `The zeros are $x = ${a}$ and $x = ${b}$, so the factors are $(x ${a < 0 ? "+" : "-"} ${Math.abs(a)})$ and $(x ${b < 0 ? "+" : "-"} ${Math.abs(b)})$.`,
        `The graph touches the axis at ${a} without crossing, so $(x ${a < 0 ? "+" : "-"} ${Math.abs(a)})$ is squared; it crosses at ${b}, so that factor appears once.`,
        "The graph falls to the right, so the leading coefficient is negative.",
        `The equation is ${f(a, b, -1, 2, 1)}.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(plot).build(CARD) },
      }
    );
  },
});

/* ------------------------------------------------ sinusoid compare */
const piText = (n: number, d: number) =>
  d === 1 ? `${n === 1 ? "" : n}\\pi` : `\\frac{${n === 1 ? "" : n}\\pi}{${d}}`;
export const sinusoidCompareRule = chainFamily({
  template: sinusoidCompareRuleTemplate,
  axes: {},
  model: (r: R) => {
    const A = r(1, 4);
    const P = pick(r, [2, 4, 8] as const);
    const C = r(1, 5);
    const Q = pick(r, [2, 4, 8, 16] as const);
    if (C === A || Q === P) fail();
    return { A, P, C, Q };
  },
  variant: (m) =>
    `${m.C > m.A ? "greater" : "lesser"}-max-${m.Q < m.P ? "greater" : "lesser"}-frequency`,
  render: (m, _ax, r) => {
    const { A, P, C, Q } = m;
    const gMaxGreater = C > A;
    const gFreqGreater = Q < P;
    const rule = `g(x) = ${C}\\sin\\left(\\frac{2\\pi}{${Q}}x\\right)`;
    const stmt = (maxG: boolean, freqG: boolean) =>
      `$g$ has a ${maxG ? "greater" : "smaller"} maximum value and a ${freqG ? "greater" : "smaller"} frequency than $f$`;
    const plot = plane(-0.5, 2 * P, -5, 5).curve(fn.sin(A, (2 * Math.PI) / P), {
      color: "accent",
    });
    const surface = choiceSurface(r, {
      prompt: `The graph of $f(x) = A\\sin\\left(Bx\\right)$ is shown. The function $g$ is defined by $${rule}$. Which statement is true?`,
      label: "Choose the statement",
      options: [
        { label: stmt(gMaxGreater, gFreqGreater), correct: true },
        {
          label: stmt(!gMaxGreater, gFreqGreater),
          feedback: `The maximum value of $g$ is its amplitude ${C}, and the maximum of $f$ is ${A}: $g$ has the ${gMaxGreater ? "greater" : "smaller"} maximum.`,
        },
        {
          label: stmt(gMaxGreater, !gFreqGreater),
          feedback: `Frequency is the reciprocal of the period. The period of $f$ is ${P} and the period of $g$ is ${Q}, so $g$ has the ${gFreqGreater ? "greater" : "smaller"} frequency.`,
        },
        {
          label: stmt(!gMaxGreater, !gFreqGreater),
          feedback:
            "Both comparisons are reversed: compare amplitudes for the maximum and periods for the frequency, and a shorter period means a greater frequency.",
        },
      ],
      hint: `Read the maximum of $f$ from the graph and its period from the distance between peaks. For $g$ the maximum is the number ${C} in front, and the period is $\\frac{2\\pi}{B}$ for $B = \\frac{2\\pi}{${Q}}$. A shorter period means a greater frequency.`,
      explanation: [
        `The graph of $f$ reaches a maximum of ${A} and repeats every ${P} units, so its period is ${P}.`,
        `For $g$ the maximum is ${C}, and the period is $2\\pi \\div \\frac{2\\pi}{${Q}} = ${Q}$.`,
        `${C} is ${gMaxGreater ? "greater" : "smaller"} than ${A}, and a period of ${Q} compared with ${P} gives $g$ a ${gFreqGreater ? "greater" : "smaller"} frequency.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(plot).build(CARD) },
      }
    );
  },
});

/* ------------------------------------------------ tide cosine */
export const tideCosineEquation = chainFamily({
  template: tideCosineEquationTemplate,
  axes: { start: defineAxis("start", ["maximum", "minimum"] as const) },
  model: (r: R, ax) => {
    const A = r(2, 5);
    const D = A + r(1, 3);
    const P = pick(r, [8, 12] as const);
    return { A, D, P, sign: ax.start === "maximum" ? 1 : -1 };
  },
  variant: (m) => `${m.sign > 0 ? "maximum" : "minimum"}-period-${m.P}`,
  render: (m, _ax, r) => {
    const { A, D, P, sign } = m;
    const half = P / 2;
    const eq = (amp: number, trig: string, per: string, mid: number) =>
      `$y = ${amp < 0 ? "-" : ""}${Math.abs(amp)}\\${trig}\\left(\\frac{${per}}{${half}}x\\right) + ${mid}$`;
    const plot = graph({
      x: [0, 2 * P],
      y: [0, D + A + 1],
      grid: 1,
      tick: [2, 2],
      aspect: (2 * P) / (D + A + 1),
      axisNames: ["t", "y"],
    }).curve(fn.cos(sign * A, (2 * Math.PI) / P, { k: D }), {
      color: "accent",
    });
    const surface = choiceSurface(r, {
      prompt: `The graph shows the height $y$ of a tide, in feet, $t$ hours after midnight. Which equation models the height?`,
      label: "Choose the equation",
      options: [
        { label: eq(sign * A, "cos", "\\pi", D), correct: true },
        {
          label: eq(sign * A, "cos", "2\\pi", D),
          feedback: `The period is ${P} hours, so $B = \\frac{2\\pi}{${P}} = \\frac{\\pi}{${half}}$. This uses $\\frac{2\\pi}{${half}}$, which gives a period of ${half}.`,
        },
        {
          label: eq(-sign * A, "cos", "\\pi", D),
          feedback: `At $t = 0$ the graph is at a ${sign > 0 ? "maximum" : "minimum"}, so the cosine is ${sign > 0 ? "positive" : "negated, with a negative amplitude"}. This reflection starts at the ${sign > 0 ? "minimum" : "maximum"}.`,
        },
        {
          label: eq(D * sign, "cos", "\\pi", A),
          feedback: `The amplitude is half the distance from the minimum to the maximum, ${A}, and the midline is ${D}. This swaps them.`,
        },
        {
          label: eq(sign * A, "sin", "\\pi", D),
          feedback:
            "A sine graph starts on the midline. This graph starts at its maximum or minimum, so it is a cosine.",
        },
      ],
      hint: `The graph runs from ${D - A} up to ${D + A}, and one full cycle takes ${P} hours. Use amplitude $\\frac{\\text{maximum} - \\text{minimum}}{2}$, midline $\\frac{\\text{maximum} + \\text{minimum}}{2}$ and $B = \\frac{2\\pi}{\\text{period}}$.`,
      explanation: [
        `The maximum is ${D + A} and the minimum is ${D - A}, so the amplitude is ${A} and the midline is $y = ${D}$.`,
        `One cycle takes ${P} hours, so $B = \\frac{2\\pi}{${P}} = \\frac{\\pi}{${half}}$.`,
        `The graph starts at a ${sign > 0 ? "maximum" : "minimum"} at $t = 0$, so it is ${sign > 0 ? "a cosine" : "a negative cosine"}: ${eq(sign * A, "cos", "\\pi", D)}.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(plot).build(CARD) },
      }
    );
  },
});

/* ------------------------------------------------ cubic statement */
export const cubicGraphStatement = chainFamily({
  template: cubicGraphStatementTemplate,
  axes: { lead: defineAxis("lead", ["positive", "negative"] as const) },
  model: (r: R, ax) => {
    const k = ax.lead === "positive" ? 1 : -1;
    const a = r(-3, 3);
    const c = r(-3, 3);
    if (a === c || (3 * c - a) % 2) fail();
    const b = (3 * c - a) / 2;
    if (b === a || Math.abs(b) > 5) fail();
    const fc = k * (c - a) ** 2 * (c - b);
    if (Math.abs(fc) > 6 || fc === 0) fail();
    return { k, a, b, c };
  },
  variant: (m) => (m.k > 0 ? "positive-lead" : "negative-lead"),
  render: (m, _ax, r) => {
    const { k, a, b, c } = m;
    const lo = Math.min(a, c);
    const hi = Math.max(a, c);
    // f' has the sign k * (x - a)(3x - a - 2b)/... ; for k>0, f rises left of lo, falls on (lo, hi), rises right of hi.
    const risesOuter = k > 0;
    const sgn = (v: number) => (v < 0 ? `-${-v}` : `${v}`);
    const trueSet: string[] = [
      `As $x \\to \\infty$, $f(x) \\to ${k > 0 ? "" : "-"}\\infty$`,
      `$x = ${a}$ is a zero of multiplicity 2`,
      `$f$ is ${risesOuter ? "decreasing" : "increasing"} on the interval $(${lo}, ${hi})$`,
      `$f$ is ${risesOuter ? "increasing" : "decreasing"} on the interval $(-\\infty, ${lo})$`,
    ];
    const falseSet: string[] = [
      `As $x \\to \\infty$, $f(x) \\to ${k > 0 ? "-" : ""}\\infty$`,
      `$x = ${b}$ is a zero of multiplicity 2`,
      `$x = ${a}$ is a zero of multiplicity 3`,
      `$f$ is ${risesOuter ? "increasing" : "decreasing"} on the interval $(${lo}, ${hi})$`,
      `$f$ is ${risesOuter ? "decreasing" : "increasing"} on the interval $(-\\infty, ${lo})$`,
    ];
    const why = (s: string) =>
      s.startsWith("As")
        ? `The graph ${k > 0 ? "rises" : "falls"} to the right, so the end behavior is $f(x) \\to ${k > 0 ? "" : "-"}\\infty$ as $x \\to \\infty$.`
        : s.includes("multiplicity")
          ? `The graph touches the axis at $x = ${a}$ without crossing and crosses at $x = ${b}$, so ${a} has multiplicity 2 and ${b} has multiplicity 1.`
          : `The graph turns at $x = ${lo}$ and $x = ${hi}$, so the function changes between increasing and decreasing there.`;
    const correct = pick(r, trueSet);
    const wrong = shuffle(r, [...falseSet]).slice(0, 3);
    const plot = plane(-6, 6, -6, 6).curve(
      fn.poly(k, -k * (2 * a + b), k * (a * a + 2 * a * b), -k * a * a * b),
      { color: "accent" },
    );
    void sgn;
    const surface = choiceSurface(r, {
      prompt:
        "The graph of a cubic function $f$ is shown. Which statement is true?",
      label: "Choose the statement",
      options: [
        { label: correct, correct: true },
        ...wrong.map((label) => ({
          label,
          feedback: `This statement is not true of the graph. ${why(label.startsWith("As") ? "As" : label.includes("multiplicity") ? "multiplicity" : "interval")}`,
        })),
      ],
      hint: `The graph touches the $x$-axis at $x = ${a}$ and crosses it at $x = ${b}$, and it turns around at $x = ${lo}$ and $x = ${hi}$. Check each statement against what the graph does at those places and at its far left and right.`,
      explanation: [
        `The graph touches the axis at ${a} and crosses at ${b}, so ${a} is a zero of multiplicity 2 and ${b} a zero of multiplicity 1.`,
        `The graph ${k > 0 ? "rises" : "falls"} to the right and ${k > 0 ? "falls" : "rises"} to the left; it turns at $x = ${lo}$ and $x = ${hi}$.`,
        `The true statement is ${correct}.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: sceneOf(plot).build(CARD) },
      }
    );
  },
});

export const regentsAlgebraTwoGraphTemplates = [
  logBaseFractionGraphTemplate,
  remainderZeroGraphTemplate,
  repeatedZeroRuleTemplate,
  sinusoidCompareRuleTemplate,
  tideCosineEquationTemplate,
  cubicGraphStatementTemplate,
];
export const regentsAlgebraTwoGraphGenerate = dispatch(
  regentsAlgebraTwoGraphTemplates,
  {
    "log-base-fraction-graph": logBaseFractionGraph,
    "remainder-zero-graph": remainderZeroGraph,
    "repeated-zero-rule": (s) => repeatedZeroRule.generate(s).problem,
    "sinusoid-compare-rule": (s) => sinusoidCompareRule.generate(s).problem,
    "tide-cosine-equation": (s) => tideCosineEquation.generate(s).problem,
    "cubic-graph-statement": (s) => cubicGraphStatement.generate(s).problem,
  },
);
void ({} as ChoiceOption);
