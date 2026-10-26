import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Random,
} from "./distribution-practice";
import { f, graph, table } from "./scene/author";
import { fromRoots, polynomialWindow } from "./polynomial-scenes";

const choice = {
  version: 1 as const,
  gradeBand: "9–12" as const,
  requiredResponseCapability: "single-choice-v1" as const,
};

export const functionBehaviorTemplates: readonly TemplateMetadata[] = [
  {
    ...choice,
    id: "polynomial-behavior-description",
    title: "End behavior, crossings and turns of a polynomial",
    skillId: "polynomial-behavior",
    difficultyOffset: 0.2,
    description:
      "From a factored polynomial or its terms, choose the end behavior, the cross-or-touch behavior at each zero, or the greatest possible number of turning points.",
  },
  {
    ...choice,
    id: "rational-function-features",
    title: "Asymptotes, holes and intercepts of a rational function",
    skillId: "rational-function-behavior",
    difficultyOffset: 0.4,
    description:
      "From a rational function in factored form, identify vertical asymptotes, a hole, the horizontal asymptote, intercepts, or the domain.",
  },
  {
    ...choice,
    id: "graphical-solution-table",
    title: "Solve f(x) = g(x) with a table of values",
    skillId: "graphical-equation-solving",
    difficultyOffset: 0.3,
    requiredFigureCapability: "scenes-v1",
    description:
      "Use a table of values for two functions to find an exact solution, bracket a solution between consecutive inputs, or refine it to the nearest tenth.",
  },
  {
    ...choice,
    id: "polynomial-identity-use",
    title: "Use a polynomial identity",
    skillId: "polynomial-identities",
    difficultyOffset: 0.2,
    description:
      "Use (a+b)², a²−b² and (x²+y²)² = (x²−y²)² + (2xy)² to compute quickly, build Pythagorean triples, or choose the equation that is true for every x.",
  },
  {
    ...choice,
    id: "binomial-coefficient",
    title: "A coefficient in a binomial expansion",
    skillId: "binomial-theorem",
    difficultyOffset: 0.3,
    description:
      "Find the coefficient of a given term of (ax+b)ⁿ for n ≤ 7, including negative b, the constant term and the leading term, or read Pascal's row.",
  },
  {
    ...choice,
    id: "number-system-closure-classify",
    title: "Rational and irrational sums and products",
    skillId: "number-system-closure",
    difficultyOffset: 0.2,
    description:
      "Decide whether a sum or product of rational and irrational numbers is rational, including the zero exception and irrational pairs with a rational result.",
  },
  {
    ...choice,
    id: "polynomial-graph-match",
    title: "Match a polynomial graph to its factored form",
    skillId: "polynomial-behavior",
    difficultyOffset: 0.3,
    requiredFigureCapability: "scenes-v1",
    description:
      "Read the zeros, the cross-or-touch behavior at each zero and the end behavior from a plotted polynomial with integer zeros, and choose the factored polynomial that has that graph.",
  },
];

export const polynomialBehaviorTemplate = functionBehaviorTemplates[0]!;
export const rationalFunctionTemplate = functionBehaviorTemplates[1]!;
export const graphicalSolutionTemplate = functionBehaviorTemplates[2]!;
export const polynomialIdentityTemplate = functionBehaviorTemplates[3]!;
export const binomialCoefficientTemplate = functionBehaviorTemplates[4]!;
export const numberSystemClosureTemplate = functionBehaviorTemplates[5]!;
export const polynomialGraphMatchTemplate = functionBehaviorTemplates[6]!;

type Wrong = { label: string; feedback: string };
type Spec = {
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  wrong: Wrong[];
  figure?: Parameters<typeof assemble>[3]["figure"];
};
/** Exactly one correct label and three distinct wrong labels, each with feedback. */
function finish(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  spec: Spec,
): GeneratedProblem {
  const seen = new Set([spec.correct]);
  const wrong = spec.wrong.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (wrong.length < 3) throw new Error(`Too few distinct choices: ${meta.id}`);
  return assemble(meta, seed, r, {
    prompt: spec.prompt,
    answer: "",
    hint: spec.hint,
    explanation: spec.explanation,
    ...(spec.figure ? { figure: spec.figure } : {}),
    choices: [
      { label: spec.correct, correct: true },
      ...wrong.slice(0, 3).map((w) => ({ ...w })),
    ],
  });
}
function start(meta: TemplateMetadata, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return random(meta.id, seed);
}
const pickOf = <T>(r: Random, items: readonly T[]) => items[r(0, items.length - 1)]!;
const sign = (r: Random) => (r(0, 1) ? 1 : -1);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** A reduced fraction [numerator, positive denominator]. */
function reduce(n: number, d: number): [number, number] {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return [n / g, d / g];
}
const fracTex = ([n, d]: [number, number]) =>
  d === 1 ? `${n}` : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
const lead = (c: number) => (c === 1 ? "" : c === -1 ? "-" : `${c}`);
/** (x − root)^m as LaTeX; root 0 gives x^m. */
function factor(root: number, m = 1) {
  const base =
    root === 0 ? "x" : `(x${root < 0 ? "+" : "-"}${Math.abs(root)})`;
  return m > 1 ? `${base}^{${m}}` : base;
}
/** Terms [coefficient, degree] as a polynomial in the order given. */
function termsText(terms: [number, number][]) {
  return terms
    .map(([c, d], i) => {
      const mag = Math.abs(c);
      const body =
        d === 0
          ? `${mag}`
          : `${mag === 1 ? "" : mag}x${d === 1 ? "" : `^{${d}}`}`;
      return i === 0 ? `${c < 0 ? "-" : ""}${body}` : ` ${c < 0 ? "-" : "+"} ${body}`;
    })
    .join("");
}
/** Ascending coefficient array to descending polynomial text. */
function coeffText(coeffs: number[]) {
  const terms: [number, number][] = [];
  for (let d = coeffs.length - 1; d >= 0; d--)
    if (coeffs[d]) terms.push([coeffs[d]!, d]);
  return termsText(terms);
}
const andList = (items: string[]) =>
  items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

// ------------------------------------------------------- polynomial behavior
const endText = (degree: number, a: number) =>
  degree % 2 === 0
    ? a > 0
      ? "Rises on both the left and the right"
      : "Falls on both the left and the right"
    : a > 0
      ? "Falls on the left, rises on the right"
      : "Rises on the left, falls on the right";

export function polynomialBehaviorCase(seed: string) {
  const meta = polynomialBehaviorTemplate;
  const r = start(meta, seed);
  const variant = r(0, 4); // 0 ends, 1 turns, 2 zeros, 3 standard form, 4 zeros
  const count = r(2, 3);
  const roots = shuffle(r, [-4, -3, -2, -1, 0, 1, 2, 3, 4]).slice(0, count);
  roots.sort((x, y) => x - y);
  const cap = count === 3 ? 2 : 3;
  const mult = roots.map(() => r(1, cap));
  if (variant === 2 || variant === 4) {
    // Both behaviours must appear: one odd and one even multiplicity.
    mult[0] = pickOf(r, [1, 3]);
    mult[1] = 2;
  }
  const a = r(1, 3) * sign(r);
  const degree = mult.reduce((s, m) => s + m, 0);
  const poly = `P(x)=${lead(a)}${roots.map((z, i) => factor(z, mult[i]!)).join("")}`;
  const degreeHint = `Add the exponents of the factors in $${poly}$ to find the degree, and note the sign of the leading coefficient $${a}$.`;
  const flipSign: Wrong = {
    label: endText(degree, -a),
    feedback:
      "The sign of the leading coefficient decides which way the right end goes: positive rises on the right, negative falls on the right.",
  };
  const flipParity: Wrong = {
    label: endText(degree + 1, a),
    feedback:
      "Check the degree, the sum of all the exponents. An even degree sends both ends the same way; an odd degree sends them opposite ways.",
  };
  const both: Wrong = {
    label: endText(degree + 1, -a),
    feedback:
      "Both the sign of the leading coefficient and the parity of the degree are needed: the degree is the sum of the exponents.",
  };
  if (variant === 0) {
    return {
      variant,
      degree,
      problem: finish(meta, seed, r, {
        prompt: `Let $${poly}$. Which description of the end behavior of the graph is correct?`,
        hint: degreeHint,
        explanation: [
          `Multiplying out, the highest-degree term has degree equal to the sum of the exponents: $${mult.join("+")}=${degree}$.`,
          `Its coefficient is the product of $${a}$ and the leading coefficients 1 of the factors, so it is $${a}$, which is ${a > 0 ? "positive" : "negative"}.`,
          `${degree % 2 === 0 ? "An even" : "An odd"} degree with a ${a > 0 ? "positive" : "negative"} leading coefficient: ${endText(degree, a).toLowerCase()}.`,
        ],
        correct: endText(degree, a),
        wrong: [flipSign, flipParity, both],
      }),
    };
  }
  if (variant === 1) {
    const turns = degree - 1;
    const word = (n: number) => `$${n}$`;
    return {
      variant,
      degree,
      problem: finish(meta, seed, r, {
        prompt: `Let $${poly}$. What is the greatest number of turning points that the graph of any polynomial with the same degree as $P$ can have? A turning point is where the graph changes from rising to falling or from falling to rising.`,
        hint: `Add the exponents of the factors in $${poly}$ to find its degree. A polynomial of degree $n$ has at most one fewer turning point than its degree.`,
        explanation: [
          `The degree is the sum of the exponents: $${mult.join("+")}=${degree}$.`,
          `A polynomial of degree $n$ has at most $n-1$ turning points.`,
          `So the greatest number is $${degree}-1=${turns}$.`,
        ],
        correct: word(turns),
        wrong: [
          {
            label: word(degree),
            feedback:
              "The degree itself is the greatest number of zeros, not of turning points; turning points number at most one fewer than the degree.",
          },
          {
            label: word(count),
            feedback:
              "Counting the different zeros ignores the multiplicities. Use the degree, the sum of all exponents, then subtract 1.",
          },
          {
            label: word(count - 1),
            feedback:
              "Between neighboring zeros the graph turns once, but the bound comes from the degree, the sum of all exponents, minus 1.",
          },
          {
            label: word(degree + 1),
            feedback:
              "A polynomial cannot turn more times than its degree minus 1.",
          },
          {
            label: word(Math.max(degree - 2, 0)),
            feedback:
              "Subtract only 1 from the degree: a polynomial of degree $n$ can have $n-1$ turning points.",
          },
          {
            label: word(degree + 2),
            feedback:
              "A polynomial cannot turn more times than its degree minus 1.",
          },
        ],
      }),
    };
  }
  if (variant === 3) {
    const d = r(3, 6);
    const lower = shuffle(r, [1, 2, 3, 4, 5].filter((x) => x < d)).slice(0, 2);
    const lowC = lower.map(() => r(1, 6) * sign(r));
    const c = r(1, 5) * sign(r);
    const terms: [number, number][] = shuffle(r, [
      [c, d],
      ...lower.map((e, i) => [lowC[i]!, e] as [number, number]),
      [r(1, 9) * sign(r), 0],
    ]);
    return {
      variant,
      degree: d,
      problem: finish(meta, seed, r, {
        prompt: `Let $P(x)=${termsText(terms)}$. Which description of the end behavior of the graph is correct?`,
        hint: `Find the term of $P(x)=${termsText(terms)}$ with the highest exponent; only that term controls the ends.`,
        explanation: [
          `The highest exponent is ${d}, so the leading term is $${c}x^{${d}}$, whatever order the terms are written in.`,
          `The degree ${d} is ${d % 2 === 0 ? "even" : "odd"} and the coefficient $${c}$ is ${c > 0 ? "positive" : "negative"}.`,
          `${endText(d, c)}.`,
        ],
        correct: endText(d, c),
        wrong: [
          {
            label: endText(d, -c),
            feedback:
              "Use the sign of the leading term's coefficient, the term with the highest exponent.",
          },
          {
            label: endText(d + 1, c),
            feedback:
              "Read the exponent of the highest-degree term, not of the first term written.",
          },
          {
            label: endText(d + 1, -c),
            feedback:
              "Both the sign and the exponent must come from the highest-degree term.",
          },
        ],
      }),
    };
  }
  // Variants 2 and 4: the full description.
  const cross = roots.filter((_, i) => mult[i]! % 2 === 1);
  const touch = roots.filter((_, i) => mult[i]! % 2 === 0);
  const swapOne = (cr: number[], to: number[]): [number[], number[]] => {
    // Move the first crossing zero to the touching list and vice versa.
    const x = cr[0]!,
      y = to[0]!;
    return [
      [...cr.slice(1), y].sort((p, q) => p - q),
      [...to.slice(1), x].sort((p, q) => p - q),
    ];
  };
  const [sc, st] = swapOne(cross, touch);
  const text = (e: string, cr: number[], to: number[]) =>
    `${e}; crosses the $x$-axis at ${andList(cr.map((z) => `$x=${z}$`))}; touches it at ${andList(to.map((z) => `$x=${z}$`))}`;
  const good = text(endText(degree, a), cross, touch);
  return {
    variant,
    degree,
    problem: finish(meta, seed, r, {
      prompt: `Let $${poly}$. Choose the description that matches the graph's end behavior and its behavior at each zero.`,
      hint: `For each factor in $${poly}$, look at its exponent: an odd exponent and an even exponent act differently at the zero. Then add the exponents and check the sign of $${a}$ for the ends.`,
      explanation: [
        ...roots.map(
          (z, i) =>
            `The zero $x=${z}$ has multiplicity ${mult[i]}, which is ${mult[i]! % 2 ? "odd, so the graph crosses" : "even, so the graph touches and turns back at"} the $x$-axis there.`,
        ),
        `The degree is $${mult.join("+")}=${degree}$ and the leading coefficient is $${a}$: ${endText(degree, a).toLowerCase()}.`,
      ],
      correct: good,
      wrong: [
        {
          label: text(endText(degree, -a), cross, touch),
          feedback:
            "The crossings are right, but the ends follow the sign of the leading coefficient: positive rises on the right.",
        },
        {
          label: text(endText(degree, a), sc, st),
          feedback:
            "An odd multiplicity crosses the axis and an even multiplicity touches it and turns back. Check each exponent.",
        },
        {
          label: text(endText(degree + 1, a), cross, touch),
          feedback:
            "The zeros are classified correctly, but the degree is the sum of all exponents, and its parity sets the ends.",
        },
        {
          label: text(endText(degree, a), touch, cross),
          feedback:
            "These are reversed: odd multiplicities cross, even multiplicities touch.",
        },
      ],
    }),
  };
}

// --------------------------------------------------- rational function features
type Rational = {
  a: number;
  b: number;
  num: number[];
  den: number[];
  hole?: number;
};
function rationalText(f: Rational) {
  const holeFactor = f.hole === undefined ? [] : [factor(f.hole)];
  const part = (c: number, roots: number[]) => {
    const fs = [...holeFactor, ...roots.map((z) => factor(z))];
    return fs.length ? `${lead(c)}${fs.join("")}` : `${c}`;
  };
  return `f(x)=\\dfrac{${part(f.a, f.num)}}{${part(f.b, f.den)}}`;
}
const xs = (vals: number[]) =>
  vals.length ? andList(vals.map((v) => `$x=${v}$`)) : "";
const sortedNum = (v: number[]) => [...v].sort((p, q) => p - q);

export function rationalFunctionCase(seed: string) {
  const meta = rationalFunctionTemplate;
  const r = start(meta, seed);
  const variant = r(0, 4); // 0 vertical, 1 hole, 2 horizontal, 3 intercepts, 4 domain
  const pool = shuffle(r, [-4, -3, -2, -1, 1, 2, 3, 4]);
  const withHole = variant === 1 || variant === 4 ? true : r(0, 1) === 1;
  const hole = withHole ? pool.pop()! : undefined;
  const take = (n: number) => pool.splice(0, n);
  let a = r(1, 3) * sign(r);
  let b = pickOf(r, [1, 1, 2, 3]) * (r(0, 3) === 0 ? -1 : 1);
  while (Math.abs(a) === Math.abs(b)) a = r(1, 3) * sign(r);
  const result = (f: Rational, spec: Spec) => ({
    variant,
    f,
    problem: finish(meta, seed, r, spec),
  });

  if (variant === 2) {
    const rel = r(0, 2);
    const dd = rel === 0 ? r(2, 3) : rel === 1 ? r(1, 3) : r(1, 2);
    const dn = rel === 0 ? r(1, dd - 1) : rel === 1 ? dd : r(dd + 1, 3);
    const f: Rational = { a, b, num: take(dn), den: take(dd) };
    const ratio = reduce(a, b);
    const inverse = reduce(b, a);
    const labels = {
      zero: "$y=0$",
      ratio: `$y=${fracTex(ratio)}$`,
      none: "There is no horizontal asymptote",
      one: "$y=1$",
      inverse: `$y=${fracTex(inverse)}$`,
    };
    const fb = {
      zero: "The graph approaches $y=0$ only when the denominator has the greater degree.",
      ratio: "The ratio of leading coefficients is the asymptote only when the two degrees are equal.",
      none: "A horizontal asymptote exists unless the numerator has the greater degree.",
      one: "The height is the ratio of the leading coefficients, not 1 unless they are equal.",
      inverse: "Divide the numerator's leading coefficient by the denominator's, not the other way around.",
    };
    const key = rel === 0 ? "zero" : rel === 1 ? "ratio" : "none";
    const order = (["zero", "none", "ratio", "inverse", "one"] as const).filter(
      (k) => k !== key,
    );
    return result(f, {
      prompt: `For $${rationalText(f)}$, what is the horizontal asymptote of the graph?`,
      hint: `Count the factors in the numerator and in the denominator of $${rationalText(f)}$ to find each degree, then compare them.`,
      explanation: [
        `The numerator has degree ${dn} and the denominator has degree ${dd}.`,
        rel === 0
          ? "The denominator grows faster, so the fraction approaches 0 as $x$ becomes very large in either direction."
          : rel === 1
            ? `The degrees are equal, so the fraction approaches the ratio of the leading coefficients, $\\frac{${a}}{${b}}=${fracTex(ratio)}$.`
            : "The numerator grows faster, so the fraction grows without approaching a fixed height. There is no horizontal asymptote.",
        `The horizontal asymptote is ${labels[key].startsWith("$") ? labels[key] : "absent: " + labels[key].toLowerCase()}.`,
      ],
      correct: labels[key],
      wrong: order.map((k) => ({ label: labels[k], feedback: fb[k] })),
    });
  }

  if (variant === 1) {
    const [n1, d1] = take(2) as [number, number];
    const f: Rational = { a, b, num: [n1], den: [d1], hole };
    const c = hole!;
    const yNum = a * (c - n1);
    const yDen = b * (c - d1);
    const y = reduce(yNum, yDen);
    const point = (x: number, v: [number, number]) =>
      `$(${x},\\ ${fracTex(v)})$`;
    return result(f, {
      prompt: `The graph of $${rationalText(f)}$ has a hole. Which point is the hole?`,
      hint: `Find the factor that appears in both the numerator and the denominator of $${rationalText(f)}$. Its zero is the hole's $x$-value; find the $y$-value from what remains after canceling.`,
      explanation: [
        `The factor $(x${c < 0 ? "+" : "-"}${Math.abs(c)})$ is in both the numerator and the denominator, so the graph has a hole at $x=${c}$.`,
        `After canceling, $f(x)=\\dfrac{${lead(a)}${factor(n1)}}{${lead(b)}${factor(d1)}}$ for $x\\ne${c}$.`,
        `Substitute $x=${c}$: $\\dfrac{${a}(${c - n1})}{${b}(${c - d1})}=${fracTex(y)}$. The hole is at ${point(c, y)}.`,
      ],
      correct: point(c, y),
      wrong: [
        {
          label: point(-c, y),
          feedback: "The factor $(x-c)$ has its zero at $x=c$; check the sign.",
        },
        {
          label: point(c, [0, 1]),
          feedback:
            "A hole is not an intercept. After canceling, substitute the hole's $x$-value into what remains to get its height.",
        },
        {
          label: point(c, reduce(yNum, 1)),
          feedback:
            "Use the whole simplified fraction at the hole's $x$-value, including the denominator that remains.",
        },
        {
          label: point(c, [-y[0], y[1]]),
          feedback:
            "Check the signs when substituting the hole's $x$-value into each remaining factor.",
        },
      ],
    });
  }

  if (variant === 4) {
    const dens = take(r(1, 2));
    const nums = take(1);
    const f: Rational = { a, b, num: nums, den: dens, hole };
    const c = hole!;
    const label = (vals: number[]) =>
      `All real numbers except ${xs(sortedNum(vals))}`;
    return result(f, {
      prompt: `What is the domain of $${rationalText(f)}$?`,
      hint: `The domain excludes every input that makes the denominator of $${rationalText(f)}$ zero, before any canceling.`,
      explanation: [
        `The denominator is zero at ${xs([c, ...dens])}.`,
        `The factor for $x=${c}$ cancels, so the graph has a hole there, but $f(${c})$ is still undefined.`,
        `The domain is ${label([c, ...dens]).toLowerCase()}.`,
      ],
      correct: label([c, ...dens]),
      wrong: [
        {
          label: label(dens),
          feedback: `The function is also undefined at $x=${c}$, even though that factor cancels and leaves a hole instead of an asymptote.`,
        },
        {
          label: label(nums),
          feedback:
            "Zeros of the numerator make the function zero, not undefined. Look at the denominator.",
        },
        {
          label: label([-c, ...dens.map((d) => -d)]),
          feedback:
            "A factor $(x-c)$ is zero at $x=c$, not at $-c$. Check the signs.",
        },
        {
          label: label([c]),
          feedback: "Every zero of the original denominator is excluded.",
        },
      ],
    });
  }

  // Variants 0 and 3 share the same shape of function.
  const nums = take(variant === 3 ? r(1, 2) : r(1, 2));
  const dens = take(r(1, 2));
  const f: Rational = { a, b, num: nums, den: dens, hole };
  if (variant === 0) {
    const va = sortedNum(dens);
    const list = (vals: number[]) => xs(sortedNum(vals));
    return result(f, {
      prompt: `Which lists all the vertical asymptotes of $${rationalText(f)}$?`,
      hint: `Look for zeros of the denominator of $${rationalText(f)}$ that remain after any common factor is canceled.`,
      explanation: [
        hole === undefined
          ? "No factor is common to the numerator and denominator, so no zero of the denominator cancels."
          : `The factor $(x${hole < 0 ? "+" : "-"}${Math.abs(hole)})$ is in both the numerator and the denominator; it cancels and gives a hole at $x=${hole}$, not an asymptote.`,
        `The remaining zeros of the denominator are ${list(va)}.`,
        `The vertical asymptotes are ${list(va)}.`,
      ],
      correct: list(va),
      wrong: [
        { label: list(nums), feedback: "Zeros of the numerator are where the graph meets the axis, not where it has asymptotes. Use the denominator." },
        ...(hole === undefined
          ? []
          : [
              {
                label: list([hole, ...va]),
                feedback: `At $x=${hole}$ the factor cancels from both parts, leaving a hole, not an asymptote.`,
              },
              {
                label: list([hole]),
                feedback: "A common factor gives a hole. Look at the denominator zeros that remain after canceling.",
              },
            ]),
        {
          label: list(va.map((v) => -v)),
          feedback: "A factor $(x-c)$ is zero at $x=c$; check the sign of each zero.",
        },
        { label: list([...va, ...nums]), feedback: "Only zeros of the denominator can be asymptotes; numerator zeros are intercepts." },
        { label: "There are no vertical asymptotes", feedback: "A zero of the denominator that does not cancel gives a vertical asymptote." },
      ],
    });
  }
  // Intercepts.
  const yInt = reduce(
    a * nums.reduce((p, z) => p * -z, 1),
    b * dens.reduce((p, z) => p * -z, 1),
  );
  const label = (xv: number[], yv: [number, number]) =>
    `$x$-intercept${xv.length > 1 ? "s" : ""} at ${xs(sortedNum(xv))}; $y$-intercept at $y=${fracTex(yv)}$`;
  return result(f, {
    prompt: `Which lists the $x$-intercepts and the $y$-intercept of the graph of $${rationalText(f)}$?`,
    hint: `For the $x$-intercepts, find where the numerator of $${rationalText(f)}$ is zero while the function is still defined. For the $y$-intercept, substitute $x=0$.`,
    explanation: [
      `The numerator is zero at ${xs(sortedNum([...nums, ...(hole === undefined ? [] : [hole])]))}.${hole === undefined ? "" : ` At $x=${hole}$ the denominator is also zero, so that is a hole, not an intercept.`}`,
      `The $x$-intercept${nums.length > 1 ? "s are" : " is"} ${xs(sortedNum(nums))}.`,
      `At $x=0$ each factor $(x-c)$ becomes $-c$, so $f(0)=${fracTex(yInt)}$, the $y$-intercept.`,
    ],
    correct: label(nums, yInt),
    wrong: [
      {
        label: label(nums.map((v) => -v), yInt),
        feedback: "A factor $(x-c)$ is zero at $x=c$; check the sign of each zero.",
      },
      {
        label: label(nums, [-yInt[0], yInt[1]]),
        feedback: "Substitute $x=0$ into every factor, keeping each sign: $(0-c)=-c$.",
      },
      hole === undefined
        ? {
            label: label([...nums, dens[0]!], yInt),
            feedback:
              "A zero of the denominator is not an intercept: the function is undefined there.",
          }
        : {
            label: label([...nums, hole], yInt),
            feedback: `The factor at $x=${hole}$ is also in the denominator, so there is a hole there, not an intercept.`,
          },
      {
        label: label(nums.map((v) => -v), [-yInt[0], yInt[1]]),
        feedback: "Check the sign of each zero and substitute $x=0$ carefully.",
      },
      {
        label: label(nums, reduce(yInt[1], yInt[0])),
        feedback: "The $y$-intercept is $f(0)$, numerator over denominator, not the reciprocal.",
      },
      {
        label: label(nums, reduce(a * nums.reduce((p, z) => p * -z, 1), 1)),
        feedback: "Include the denominator when substituting $x=0$: $f(0)$ is a quotient.",
      },
    ],
  });
}

// -------------------------------------------------------- graphical solutions
const dec = (value: number, scale: number) => {
  const sg = value < 0 ? "-" : "";
  const digits = String(Math.abs(value)).padStart(String(scale).length, "0");
  const cut = digits.length - (String(scale).length - 1);
  const text = `${digits.slice(0, cut)}.${digits.slice(cut)}`;
  return `${sg}${text.replace(/0+$/, "").replace(/\.$/, "")}`;
};
const lineText = (m: number, b: number) =>
  `${m === 1 ? "" : m === -1 ? "-" : m}x${b === 0 ? "" : b < 0 ? `-${-b}` : `+${b}`}`;

export function graphicalSolutionCase(seed: string) {
  const meta = graphicalSolutionTemplate;
  const r = start(meta, seed);
  const variant = r(0, 3); // 0 exact, 1 and 2 bracket, 3 nearest tenth
  const exponential = variant === 1 && r(0, 1) === 1;
  for (let attempt = 0; attempt < 500; attempt++) {
    const m = r(1, 4) * sign(r);
    const b = r(-6, 6);
    const c = r(-6, 6);
    const f = (x: number) => (exponential ? 2 ** x + c : x * x + c);
    const g = (x: number) => m * x + b;
    const ftext = exponential ? `2^x${c === 0 ? "" : c < 0 ? c : `+${c}`}` : `x^2${c === 0 ? "" : c < 0 ? c : `+${c}`}`;
    const gtext = lineText(m, b);
    const head = `Let $f(x)=${ftext}$ and $g(x)=${gtext}$.`;
    const makeFigure = (rows: { x: string; f: string; g: string }[]) => ({
      kind: "scene" as const,
      scene: table({
        id: "t",
        title: "Values of f and g",
        corner: "x",
        math: true,
        columns: ["f(x)", "g(x)"],
        rows: rows.map((row) => ({ label: row.x, cells: [row.f, row.g] })),
      }).scene({ title: "Table of values of f(x) and g(x)" }),
    });
    const x0 = exponential ? r(0, 1) : r(-3, 1);
    const grid = Array.from({ length: 5 }, (_, i) => x0 + i);
    const diff = grid.map((x) => f(x) - g(x));
    if (variant === 0) {
      const hits = grid.filter((_, i) => diff[i] === 0);
      if (hits.length !== 1) continue;
      const k = hits[0]!;
      const idx = k - x0;
      if (idx < 1 || idx > 3) continue;
      const out = f(k);
      const rows = grid.map((x) => ({ x: `${x}`, f: `${f(x)}`, g: `${g(x)}` }));
      const pick = (v: number) => `$x=${v}$`;
      return {
        variant,
        problem: finish(meta, seed, r, {
          prompt: `${head} The table shows their values. For which input $x$ is $f(x)=g(x)$?`,
          figure: makeFigure(rows),
          hint: `A solution of $f(x)=g(x)$ is an input where the two columns of the table show the same number. Scan the rows of the table for $f(x)$ and $g(x)$ side by side.`,
          explanation: [
            `Compare the two output columns row by row.`,
            `At $x=${k}$, $f(${k})=${out}$ and $g(${k})=${out}$, so the outputs are equal.`,
            `The solution is the input, $x=${k}$. The shared output ${out} is the height of the intersection, not the solution.`,
          ],
          correct: pick(k),
          wrong: [
            ...(out !== k && !grid.includes(out)
              ? [
                  {
                    label: pick(out),
                    feedback:
                      "That is the shared output. The solution is the input $x$ at which the outputs match.",
                  },
                ]
              : []),
            ...(out !== k
              ? [
                  {
                    label: `$y=${out}$`,
                    feedback:
                      "That is the shared output. A solution of $f(x)=g(x)$ is the input $x$ at which the outputs match.",
                  },
                ]
              : []),
            {
              label: pick(k - 1),
              feedback: `At $x=${k - 1}$ the outputs are ${f(k - 1)} and ${g(k - 1)}, which are not equal.`,
            },
            {
              label: pick(k + 1),
              feedback: `At $x=${k + 1}$ the outputs are ${f(k + 1)} and ${g(k + 1)}, which are not equal.`,
            },
            {
              label: pick(k + 2),
              feedback: `At $x=${k + 2}$ the outputs are ${f(k + 2)} and ${g(k + 2)}, which are not equal.`,
            },
          ],
        }),
      };
    }
    if (variant === 1 || variant === 2) {
      if (diff.some((d) => d === 0)) continue;
      const flips = diff.flatMap((d, i) =>
        i > 0 && Math.sign(d) !== Math.sign(diff[i - 1]!) ? [i] : [],
      );
      if (flips.length !== 1) continue;
      const i = flips[0]!;
      const lo = grid[i - 1]!;
      const between = (k: number) => `between $x=${k}$ and $x=${k + 1}$`;
      const rows = grid.map((x) => ({ x: `${x}`, f: `${f(x)}`, g: `${g(x)}` }));
      const others = [0, 1, 2, 3].filter((j) => j !== i - 1);
      return {
        variant,
        problem: finish(meta, seed, r, {
          prompt: `${head} A solution of $f(x)=g(x)$ lies in the table's range. Between which consecutive table inputs does it lie?`,
          figure: makeFigure(rows),
          hint: `In each row compare $f(x)$ with $g(x)$ and note which is larger. The solution is between two rows where the larger function changes.`,
          explanation: [
            `At $x=${lo}$, $f(${lo})=${f(lo)}$ and $g(${lo})=${g(lo)}$, so $f$ is ${f(lo) > g(lo) ? "above" : "below"} $g$.`,
            `At $x=${lo + 1}$, $f(${lo + 1})=${f(lo + 1)}$ and $g(${lo + 1})=${g(lo + 1)}$, so $f$ is now ${f(lo + 1) > g(lo + 1) ? "above" : "below"} $g$.`,
            `The functions are continuous, so their graphs must meet between these inputs: the solution lies ${between(lo)}.`,
          ],
          correct: between(lo),
          wrong: others.map((j) => ({
            label: between(grid[j]!),
            feedback: `At both $x=${grid[j]}$ and $x=${grid[j]! + 1}$ the function $f$ is ${diff[j]! > 0 ? "above" : "below"} $g$, so the graphs have not crossed in that step.`,
          })),
        }),
      };
    }
    // Variant 3: refine to the nearest tenth; hundredths X = 100x, H = 10^4 (f - g).
    if (exponential) continue;
    const H = (X: number) =>
      X * X + 10000 * c - 100 * m * X - 10000 * b;
    const brackets: number[] = [];
    for (let x = -6; x < 6; x++)
      if (
        H(x * 100) !== 0 &&
        H((x + 1) * 100) !== 0 &&
        Math.sign(H(x * 100)) !== Math.sign(H((x + 1) * 100))
      )
        brackets.push(x);
    if (!brackets.length) continue;
    const bracket = brackets[r(0, brackets.length - 1)];
    let tenth = -1;
    for (let j = 0; j < 10; j++) {
      const lowX = bracket * 100 + 10 * j;
      if (H(lowX) === 0 || H(lowX + 10) === 0) {
        tenth = -2;
        break;
      }
      if (Math.sign(H(lowX)) !== Math.sign(H(lowX + 10))) tenth = j;
    }
    if (tenth < 0) continue;
    const X0 = bracket * 100 + 10 * tenth;
    if (H(X0 + 5) === 0) continue;
    const nearLow = Math.sign(H(X0)) !== Math.sign(H(X0 + 5));
    const tenthLabel = (X: number) => `$${(X / 100).toFixed(1)}$`;
    const answerX = nearLow ? X0 : X0 + 10;
    const rows = [X0, X0 + 5, X0 + 10].map((X) => ({
      x: dec(X, 100),
      f: dec(X * X + 10000 * c, 10000),
      g: dec(100 * m * X + 10000 * b, 10000),
    }));
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `${head} The table brackets a solution of $f(x)=g(x)$ between $x=${dec(X0, 100)}$ and $x=${dec(X0 + 10, 100)}$. To the nearest tenth, what is the solution?`,
        figure: makeFigure(rows),
        hint: `Compare $f(x)$ and $g(x)$ in each row of the table and find which of the two steps contains the change in which function is larger. The solution lies in that step.`,
        explanation: [
          `At $x=${dec(X0, 100)}$, $f=${rows[0]!.f}$ and $g=${rows[0]!.g}$: $f$ is ${H(X0) > 0 ? "above" : "below"} $g$.`,
          `At $x=${dec(X0 + 5, 100)}$, $f=${rows[1]!.f}$ and $g=${rows[1]!.g}$: $f$ is ${H(X0 + 5) > 0 ? "above" : "below"} $g$.`,
          `The change happens ${nearLow ? "before" : "after"} the middle row, so the solution is in the ${nearLow ? "first" : "second"} half-step. It is closer to ${dec(answerX, 100)}.`,
        ],
        correct: tenthLabel(answerX),
        wrong: [
          {
            label: tenthLabel(nearLow ? X0 + 10 : X0),
            feedback:
              "The middle row shows which half of the interval holds the change: the solution is nearer to the end of that half.",
          },
          {
            label: tenthLabel(X0 - 10),
            feedback: "The solution is inside the bracketed interval, so it cannot round to a value outside it.",
          },
          {
            label: tenthLabel(X0 + 20),
            feedback: "The solution is inside the bracketed interval, so it cannot round to a value outside it.",
          },
        ],
      }),
    };
  }
  throw new Error("No graphical-solution instance found");
}

// --------------------------------------------------------- polynomial identities
const times = (p: number[], q: number[]) => {
  const out = Array<number>(p.length + q.length - 1).fill(0);
  p.forEach((u, i) => q.forEach((v, j) => (out[i + j]! += u * v)));
  return out;
};
const same = (p: number[], q: number[]) =>
  p.length === q.length && p.every((v, i) => v === q[i]);
const isTriple = (legs: [number, number], hyp: number) =>
  legs[0] ** 2 + legs[1] ** 2 === hyp ** 2;

export function polynomialIdentityCase(seed: string) {
  const meta = polynomialIdentityTemplate;
  const r = start(meta, seed);
  const variant = r(0, 5);
  const $ = (n: number) => `$${n}$`;
  if (variant === 0) {
    const m = pickOf(r, [20, 30, 40, 50, 100, 200]);
    const s = r(1, 5);
    const up = r(0, 1) === 1;
    const v = up ? m + s : m - s;
    const mid = 2 * m * s;
    const good = up ? m * m + mid + s * s : m * m - mid + s * s;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `Use an identity to find $${v}^2$ without a calculator: write $${v}$ as a sum or difference of a round number and a small one.`,
        hint: `Write $${v}$ as $${m}${up ? "+" : "-"}${s}$, then square it with $(a${up ? "+" : "-"}b)^2=a^2${up ? "+" : "-"}2ab+b^2$.`,
        explanation: [
          `$${v}=${m}${up ? "+" : "-"}${s}$, so $a=${m}$ and $b=${s}$.`,
          `$a^2=${m * m}$, $2ab=${mid}$, $b^2=${s * s}$.`,
          `$${v}^2=${m * m}${up ? "+" : "-"}${mid}+${s * s}=${good}$.`,
        ],
        correct: $(good),
        wrong: [
          { label: $(m * m + s * s), feedback: "The middle term $2ab$ is missing. A square of a sum or difference has three terms." },
          { label: $(up ? m * m + mid - s * s : m * m - mid - s * s), feedback: "The last term $b^2$ is always added, because a square is never negative." },
          { label: $(up ? m * m - mid + s * s : m * m + mid + s * s), feedback: `The middle term has the sign of $${up ? "+" : "-"}$ in $a${up ? "+" : "-"}b$.` },
          { label: $(up ? (m + s) * (m + s) - 2 * s * s : (m - s) * (m - s) + 2 * s * s), feedback: "Check the arithmetic of each of the three terms." },
        ],
      }),
    };
  }
  if (variant === 1) {
    const m = pickOf(r, [20, 30, 40, 50, 60, 100]);
    const s = r(1, 6);
    const good = m * m - s * s;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `Use an identity to find $${m + s}\\times${m - s}$.`,
        hint: `The numbers $${m + s}$ and $${m - s}$ are the same distance from one round number. Write them as a sum and a difference of that number and a small one.`,
        explanation: [
          `$${m + s}=${m}+${s}$ and $${m - s}=${m}-${s}$, so the product has the form $(a+b)(a-b)$ with $a=${m}$, $b=${s}$.`,
          `$(a+b)(a-b)=a^2-b^2=${m * m}-${s * s}$.`,
          `The product is $${good}$.`,
        ],
        correct: $(good),
        wrong: [
          { label: $(m * m + s * s), feedback: "The identity is a difference of squares, $a^2-b^2$, not a sum." },
          { label: $((m - s) ** 2), feedback: "That is $(a-b)^2$. The product $(a+b)(a-b)$ has no middle term and equals $a^2-b^2$." },
          { label: $(m * m - s), feedback: "Square $b$ before subtracting: the product is $a^2-b^2$." },
          { label: $((m + s) ** 2), feedback: "That is $(a+b)^2$; the second factor is $a-b$, not $a+b$." },
        ],
      }),
    };
  }
  if (variant === 2) {
    const x = r(2, 6);
    const y = r(1, x - 1);
    const d = x * x - y * y,
      t = 2 * x * y,
      h = x * x + y * y;
    const triple = (l1: number, l2: number, hyp: number) => {
      const [p, q] = l1 < l2 ? [l1, l2] : [l2, l1];
      return `legs $${p}$ and $${q}$, hypotenuse $${hyp}$`;
    };
    const candidates: { legs: [number, number]; hyp: number; why: string }[] = [
      { legs: [d, x * y], hyp: h, why: "The second leg is $2xy$, with the factor 2." },
      { legs: [d, t], hyp: (x + y) ** 2, why: "The hypotenuse is $x^2+y^2$, not $(x+y)^2$." },
      { legs: [h, t], hyp: d, why: "The hypotenuse is the longest side, $x^2+y^2$; the legs are $x^2-y^2$ and $2xy$." },
      { legs: [x * x, y * y], hyp: h, why: "The legs are $x^2-y^2$ and $2xy$; squares of $x$ and $y$ alone do not satisfy the identity." },
    ];
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `The identity $(x^2+y^2)^2=(x^2-y^2)^2+(2xy)^2$ holds for all numbers $x$ and $y$. With $x=${x}$ and $y=${y}$, which describes a right triangle with these side lengths?`,
        hint: `Put $x=${x}$ and $y=${y}$ into $x^2-y^2$, $2xy$ and $x^2+y^2$. The identity says the square of the last equals the sum of the squares of the first two.`,
        explanation: [
          `$x^2-y^2=${x * x}-${y * y}=${d}$, $2xy=${t}$, $x^2+y^2=${h}$.`,
          `By the identity, $${d}^2+${t}^2=${h}^2$, which is $${d * d}+${t * t}=${h * h}$.`,
          `So the legs are ${d} and ${t} and the hypotenuse is ${h}.`,
        ],
        correct: triple(d, t, h),
        wrong: candidates
          .filter((c) => !isTriple(c.legs, c.hyp))
          .map((c) => ({ label: triple(c.legs[0], c.legs[1], c.hyp), feedback: c.why })),
      }),
    };
  }
  if (variant === 3) {
    const a = r(2, 7);
    const k = pickOf(r, [1, 1, 2, 3]);
    const family = r(0, 4);
    type Eq = { lhs: string; truth: number[]; wrong: { rhs: number[]; why: string }[] };
    let eq: Eq;
    if (family === 0 || family === 1) {
      const s = family === 0 ? 1 : -1;
      const lhs = `(${lead(k)}x${s > 0 ? "+" : "-"}${a})^2`;
      eq = {
        lhs,
        truth: [a * a, 2 * s * k * a, k * k],
        wrong: [
          { rhs: [a * a, 0, k * k], why: "A square of a two-term sum or difference has a middle term $2ab$." },
          { rhs: [a * a, s * k * a, k * k], why: "The middle term is twice the product of the two terms, $2ab$." },
          { rhs: [a * a, 2 * s * k * a, k], why: "Squaring the first term also squares its coefficient, and the $x^2$ term is $(kx)^2$." },
          { rhs: [-a * a, 2 * s * k * a, k * k], why: "The last term is $+b^2$ because a square is not negative." },
        ],
      };
    } else if (family === 2) {
      eq = {
        lhs: `(x+${a})(x-${a})`,
        truth: [-a * a, 0, 1],
        wrong: [
          { rhs: [a * a, 0, 1], why: "The two factors differ in sign, so the constant is $-a^2$, not $+a^2$." },
          { rhs: [a * a, -2 * a, 1], why: "That is $(x-a)^2$; the factors $(x+a)(x-a)$ have no middle term." },
          { rhs: [-a, 0, 1], why: "Square the constant: the product is $x^2-a^2$." },
          { rhs: [-a * a, a, 1], why: "The $x$ terms cancel, so there is no middle term." },
        ],
      };
    } else if (family === 3) {
      let b = r(2, 7);
      if (b === a) b = a + 1;
      eq = {
        lhs: `(x+${a})(x+${b})`,
        truth: [a * b, a + b, 1],
        wrong: [
          { rhs: [a + b, a * b, 1], why: "The coefficient of $x$ is the sum $a+b$ and the constant is the product $ab$." },
          { rhs: [a + b, a + b, 1], why: "The constant term is the product $ab$, not the sum." },
          { rhs: [a * b, 0, 1], why: "The two cross products give a middle term $(a+b)x$." },
          { rhs: [a * b, a * b, 1], why: "The coefficient of $x$ is the sum of the numbers, $a+b$, not the product." },
        ],
      };
    } else {
      eq = {
        lhs: `(x+${a})^3`,
        truth: [a ** 3, 3 * a * a, 3 * a, 1],
        wrong: [
          { rhs: [a ** 3, 0, 0, 1], why: "A cube of a two-term sum has two middle terms; the cubes alone are not enough." },
          { rhs: [a ** 3, 3 * a, 3 * a, 1], why: "The $x$ coefficient is $3a^2$: the number is squared." },
          { rhs: [a ** 3, 3 * a * a, 3 * a * a, 1], why: "The coefficients are $3a$ for $x^2$ and $3a^2$ for $x$." },
          { rhs: [a * a * a, 3 * a, 3 * a * a, 1], why: "The coefficients are $3a$ for $x^2$ and $3a^2$ for $x$, not the reverse." },
        ],
      };
    }
    const lhsCoeffs = (() => {
      // Expand the left side independently from its factors.
      if (family === 0 || family === 1) {
        const f = [family === 0 ? a : -a, k];
        return times(f, f);
      }
      if (family === 2) return times([a, 1], [-a, 1]);
      if (family === 3) {
        const m = /\(x\+(\d+)\)\(x\+(\d+)\)/.exec(eq.lhs)!;
        return times([Number(m[1]), 1], [Number(m[2]), 1]);
      }
      return times(times([a, 1], [a, 1]), [a, 1]);
    })();
    if (!same(lhsCoeffs, eq.truth)) throw new Error("Identity does not expand");
    const text = (rhs: number[]) => `$${eq.lhs}=${coeffText(rhs)}$`;
    const wrongs = eq.wrong.filter((w) => !same(w.rhs, lhsCoeffs));
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: "Which equation is true for every value of $x$?",
        hint: `Expand the left side $${eq.lhs}$ by multiplying out, or substitute a simple value such as $x=1$ and compare each equation.`,
        explanation: [
          `Expand the left side: $${eq.lhs}=${coeffText(eq.truth)}$.`,
          "Each other equation changes a term of this expansion, so it fails for some value of $x$.",
          `The equation ${text(eq.truth)} is the identity.`,
        ],
        correct: text(eq.truth),
        wrong: wrongs.map((w) => ({ label: text(w.rhs), feedback: w.why })),
      }),
    };
  }
  if (variant === 4) {
    const x = r(4, 12),
      y = r(1, x - 1);
    const s = x + y,
      d = x - y;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `Suppose $x+y=${s}$ and $x-y=${d}$. What is $x^2-y^2$?`,
        hint: `Factor $x^2-y^2$ as a product of $x+y$ and $x-y$, then use the two values you are given.`,
        explanation: [
          "$x^2-y^2=(x+y)(x-y)$.",
          `Substitute: $${s}\\times${d}=${s * d}$.`,
          "The identity holds for all $x$ and $y$, so $x$ and $y$ need not be found separately.",
        ],
        correct: $(s * d),
        wrong: [
          { label: $(s * s - d * d), feedback: "Squaring $x+y$ and $x-y$ and subtracting gives $4xy$, not $x^2-y^2$. Multiply the two given numbers." },
          { label: $(s + d), feedback: "Adding the two given numbers gives $2x$. The difference of squares is their product." },
          { label: $(s * s + d * d), feedback: "That equals $2(x^2+y^2)$. Use $x^2-y^2=(x+y)(x-y)$." },
          { label: $(s - d), feedback: "Subtracting the given numbers gives $2y$. The difference of squares is their product." },
        ],
      }),
    };
  }
  const x = r(1, 7) * sign(r),
    y = r(1, 7) * sign(r);
  const s = x + y,
    p = x * y;
  const good = x * x + y * y;
  return {
    variant,
    problem: finish(meta, seed, r, {
      prompt: `Suppose $x+y=${s}$ and $xy=${p}$. What is $x^2+y^2$?`,
      hint: `Square the equation $x+y=${s}$ with $(x+y)^2=x^2+2xy+y^2$, then replace $xy$ by the value you are given.`,
      explanation: [
        "$(x+y)^2=x^2+2xy+y^2$, so $x^2+y^2=(x+y)^2-2xy$.",
        `$(${s})^2-2(${p})=${s * s}${-2 * p < 0 ? "-" : "+"}${Math.abs(2 * p)}=${good}$.`,
        "The identity holds for all $x$ and $y$, so $x$ and $y$ need not be found separately.",
      ],
      correct: $(good),
      wrong: [
        { label: $(s * s - p), feedback: "The cross term in $(x+y)^2$ is $2xy$, so subtract $2xy$, not $xy$." },
        { label: $(s * s + 2 * p), feedback: "Rearranging $(x+y)^2=x^2+2xy+y^2$ subtracts $2xy$ from $(x+y)^2$." },
        { label: $(s * s), feedback: "$(x+y)^2$ also contains the cross term $2xy$; remove it." },
        { label: $(s * s - 4 * p), feedback: "That is $(x-y)^2$. Subtract only $2xy$ from $(x+y)^2$." },
      ],
    }),
  };
}

// ------------------------------------------------------------- binomial theorem
const choose = (n: number, k: number) => {
  if (k < 0 || k > n) return 0;
  let v = 1;
  for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i;
  return Math.round(v);
};
const pascalRow = (n: number) => Array.from({ length: n + 1 }, (_, k) => choose(n, k));
const binomialLinear = (a: number, b: number) =>
  `${lead(a)}x${b < 0 ? "-" : "+"}${Math.abs(b)}`;

export function binomialCoefficientCase(seed: string) {
  const meta = binomialCoefficientTemplate;
  const r = start(meta, seed);
  const variant = r(0, 4);
  const n = r(3, 7);
  if (variant === 3) {
    const row = pascalRow(n);
    const text = (v: number[]) => `$${v.join(",\\ ")}$`;
    const wrongRows = [
      pascalRow(n - 1),
      pascalRow(n + 1),
      row.map((_, k) => (k === 0 ? 1 : n ** Math.min(k, 1) * k)).map((v, k) => (k === n ? 1 : v)),
      row.map((v) => v + 1),
    ];
    return {
      variant,
      n,
      problem: finish(meta, seed, r, {
        prompt: `Pascal's triangle starts with row 0, which is $1$; each later entry is the sum of the two entries above it. Which row gives the coefficients in the expansion of $(x+y)^{${n}}$?`,
        hint: `The expansion of $(x+y)^{${n}}$ has ${n + 1} terms, and row $n$ of Pascal's triangle has $n+1$ entries. Row 0 is $1$ and row 1 is $1,\\ 1$.`,
        explanation: [
          `The expansion of $(x+y)^{${n}}$ has ${n + 1} terms, so the row has ${n + 1} entries: row ${n}, counting the top row as row 0.`,
          `Building down from row 0, row ${n} is ${text(row)}.`,
          `Check: the row reads the same in both directions, and its entries add to $2^{${n}}=${2 ** n}$.`,
        ],
        correct: text(row),
        wrong: [
          { label: text(wrongRows[0]!), feedback: `That row is row ${n - 1}. Row $n$ has $n+1$ entries, matching the $n+1$ terms.` },
          { label: text(wrongRows[1]!), feedback: `That row is row ${n + 1}. Row $n$ has $n+1$ entries, matching the $n+1$ terms.` },
          { label: text(wrongRows[3]!), feedback: "Each entry is the sum of the two entries above it; recompute the row from the one before." },
          { label: text(wrongRows[2]!), feedback: "Each entry is the sum of the two entries above it, so the row is not made of multiples of $n$." },
        ],
      }),
    };
  }
  const a = variant === 0 || variant === 4 ? 1 : pickOf(r, [2, 3, 2]);
  const b = r(2, 4) * sign(r);
  let k: number;
  if (variant === 2) k = r(0, 1) ? 0 : n;
  else k = r(1, n - 1);
  const aa = variant === 2 && k === n && Math.abs(a) === 1 ? 2 : a;
  const coef = (kk: number) => choose(n, kk) * aa ** kk * b ** (n - kk);
  const good = coef(k);
  const exprText = binomialLinear(aa, b);
  const pool: Wrong[] = [
    { label: `$${aa ** k * b ** (n - k)}$`, feedback: "Multiply by the binomial coefficient $\\binom{n}{k}$ from Pascal's triangle." },
    { label: `$${choose(n, k) * b ** (n - k)}$`, feedback: `The factor $x$ in $${exprText}$ has coefficient ${aa}, and it is raised to the power ${k} too.` },
    { label: `$${choose(n, k) * aa ** k}$`, feedback: `The constant ${b} is raised to the power $${n - k}$ and keeps its sign.` },
    { label: `$${choose(n, k) * aa ** (n - k) * b ** k}$`, feedback: `In the term with $x^{${k}}$, the $ax$ part is raised to ${k} and the constant to ${n - k}.` },
    { label: `$${choose(n, k) * aa ** k * Math.abs(b) ** (n - k)}$`, feedback: "Keep the sign of the constant: an odd power of a negative number is negative." },
    ...(k + 1 <= n ? [{ label: `$${coef(k + 1)}$`, feedback: `That is the coefficient of $x^{${k + 1}}$. Check which power of $x$ is asked for.` }] : []),
    ...(k - 1 >= 0 ? [{ label: `$${coef(k - 1)}$`, feedback: `That is the coefficient of $x^{${k - 1}}$. Check which power of $x$ is asked for.` }] : []),
    { label: `$${-good}$`, feedback: "Check the sign: it comes from the odd or even power of the constant." },
  ];
  const label = `$${good}$`;
  const xk = k === 1 ? "x" : `x^{${k}}`;
  const what = k === 0 ? "the constant term" : `the coefficient of $${xk}$`;
  const rowNote = variant === 4
    ? ` Row ${n} of Pascal's triangle is $${pascalRow(n).join(",\\ ")}$.`
    : "";
  const prompt = k === 0
    ? `What is the constant term in the expansion of $(${exprText})^{${n}}$?${rowNote}`
    : `What is the coefficient of $${xk}$ in the expansion of $(${exprText})^{${n}}$?${rowNote}`;
  return {
    variant,
    n,
    problem: finish(meta, seed, r, {
      prompt,
      hint: `The term with $${xk}$ in $(${exprText})^{${n}}$ is $\\binom{${n}}{${k}}(${lead(aa)}x)^{${k}}(${b})^{${n - k}}$. Find the binomial coefficient from row ${n} of Pascal's triangle, then raise each part to its power.`,
      explanation: [
        `The term with ${k === 0 ? "no $x$" : `$${xk}$`} is $\\binom{${n}}{${k}}(${lead(aa)}x)^{${k}}(${b})^{${n - k}}$.`,
        `$\\binom{${n}}{${k}}=${choose(n, k)}$, $${aa}^{${k}}=${aa ** k}$, and $(${b})^{${n - k}}=${b ** (n - k)}$.`,
        `The product is $${choose(n, k)}\\cdot${aa ** k}\\cdot(${b ** (n - k)})=${good}$, ${what}.`,
      ],
      correct: label,
      wrong: pool,
    }),
  };
}

// ------------------------------------------------------- number-system closure
export function numberSystemClosureCase(seed: string) {
  const meta = numberSystemClosureTemplate;
  const r = start(meta, seed);
  const variant = r(0, 5);
  const k = pickOf(r, [2, 3, 5, 6, 7, 10, 11, 13]);
  const root = `\\sqrt{${k}}`;
  const approx = Math.sqrt(k).toFixed(3);
  const rat = pickOf(r, [
    { t: "\\frac12", u: "\\frac12" },
    { t: "\\frac34", u: "\\frac34" },
    { t: "3", u: "3" },
    { t: "-2", u: "-2" },
    { t: "5", u: "5" },
    { t: "-\\frac13", u: "-\\frac13" },
  ]);
  const depends = (about: string) =>
    `It cannot be decided: ${about} can be rational or irrational`;
  if (variant === 0 || variant === 1) {
    const sum = variant === 0;
    const expr = sum ? `${rat.t}+${root}` : `${rat.t}\\cdot${root}`;
    const good = sum
      ? `Irrational: if the sum were rational, subtracting $${rat.t}$ would make $${root}$ rational`
      : `Irrational: if the product were rational, dividing by the nonzero rational factor would make $${root}$ rational`;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `The number $${root}$ is irrational. Is $${expr}$ rational or irrational?`,
        hint: sum
          ? `Suppose $${expr}$ were rational. Subtract the rational number $${rat.t}$ from both sides and see what that would say about $${root}$.`
          : `Suppose $${expr}$ were rational. Divide by the nonzero rational number $${rat.t}$ and see what that would say about $${root}$.`,
        explanation: sum
          ? [
              `Suppose $${expr}=q$ with $q$ rational.`,
              `Then $${root}=q-(${rat.t})$, a difference of two rational numbers, which is rational.`,
              `That contradicts the fact that $${root}$ is irrational, so $${expr}$ is irrational.`,
            ]
          : [
              `Suppose $${expr}=q$ with $q$ rational.`,
              `Then $${root}=q\\div(${rat.t})$, a quotient of rational numbers with a nonzero divisor, which is rational.`,
              `That contradicts the fact that $${root}$ is irrational, so $${expr}$ is irrational.`,
            ],
        correct: good,
        wrong: [
          {
            label: `Rational: ${sum ? "adding" : "multiplying by"} the rational number $${rat.t}$ gives a rational result`,
            feedback: sum
              ? "A rational number plus an irrational number is irrational: otherwise subtracting the rational number would make the irrational one rational."
              : "A nonzero rational times an irrational is irrational: otherwise dividing by the rational would make the irrational one rational.",
          },
          {
            label: `Rational: $${root}\\approx${approx}$ is a decimal, so the result is a decimal`,
            feedback:
              "Every irrational number has a decimal approximation, but its decimal never ends or repeats. A decimal approximation does not make it rational.",
          },
          {
            label: depends(sum ? "a rational number plus an irrational number" : "a rational number times an irrational number"),
            feedback: sum
              ? "A rational plus an irrational is always irrational. Only a sum of two irrational numbers can go either way."
              : "A nonzero rational times an irrational is always irrational.",
          },
        ],
      }),
    };
  }
  if (variant === 2) {
    const first = r(0, 1) === 1;
    const expr = first ? `0\\cdot${root}` : `${root}\\cdot0`;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `The number $${root}$ is irrational. Is $${expr}$ rational or irrational?`,
        hint: `Compute $${expr}$ first: what is any number multiplied by 0?`,
        explanation: [
          `Any number times 0 is 0, so $${expr}=0$.`,
          "The number 0 is rational, because $0=\\frac01$.",
          "A product of a rational and an irrational number is irrational only when the rational factor is not zero.",
        ],
        correct: "Rational: it equals $0$, the exception for a zero factor",
        wrong: [
          {
            label: "Irrational: a rational times an irrational is always irrational",
            feedback: "The rule needs a nonzero rational factor. With the factor 0 the product is 0.",
          },
          {
            label: `Irrational: it contains $${root}$, which is irrational`,
            feedback: "An irrational number inside a product does not make the product irrational: here the product is 0.",
          },
          {
            label: depends("a product that includes an irrational number"),
            feedback: "The product can be computed exactly: it is 0, which is rational.",
          },
        ],
      }),
    };
  }
  if (variant === 3) {
    const s = r(2, 4);
    const cases = [
      { e: `${root}+(-${root})`, v: 0, why: `$${root}$ and $-${root}$ are opposites, so they add to 0.` },
      { e: `${root}\\cdot${root}`, v: k, why: `$${root}\\cdot${root}=${k}$ by the definition of the square root.` },
      { e: `${root}\\cdot\\sqrt{${k * s * s}}`, v: k * s, why: `$\\sqrt{${k * s * s}}=${s}${root}$, so the product is $${s}\\cdot${k}=${k * s}$.` },
      { e: `\\pi+(${s + 1}-\\pi)`, v: s + 1, why: `The $\\pi$ terms cancel, leaving ${s + 1}.` },
    ];
    const c = pickOf(r, cases);
    const irrationalFacts = c.e.includes("\\pi")
      ? "both $\\pi$ and the other number are irrational"
      : `both numbers are irrational`;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `Both numbers in $${c.e}$ are irrational. Is the result rational or irrational?`,
        hint: `Simplify $${c.e}$ exactly before deciding what kind of number it is.`,
        explanation: [c.why, `The result $${c.v}$ is rational, even though ${irrationalFacts}.`],
        correct: `Rational: it equals $${c.v}$`,
        wrong: [
          {
            label: "Irrational: irrational numbers are closed under this operation",
            feedback: "Sums and products of two irrational numbers can be rational. Simplify to see this case.",
          },
          {
            label: `Irrational: it still contains ${c.e.includes("\\pi") ? "$\\pi$" : `$${root}$`}`,
            feedback: "The irrational parts cancel or combine into a whole number, so the result can be rational.",
          },
          {
            label: depends("the result of combining two irrational numbers in general"),
            feedback: "That is true in general, but this particular result can be computed: simplify it.",
          },
        ],
      }),
    };
  }
  if (variant === 4) {
    const k2 = pickOf(r, [2, 3, 5, 6, 7].filter((v) => v !== k));
    const pair = (u: string, v: string) => `$${u}$ and $${v}$`;
    return {
      variant,
      problem: finish(meta, seed, r, {
        prompt: `A student claims: "The sum of two irrational numbers is always irrational." Which pair of numbers is a counterexample?`,
        hint: `A counterexample needs two irrational numbers whose sum is rational. Look for a pair that cancels, and check that both numbers in a pair really are irrational.`,
        explanation: [
          `$${root}$ and $-${root}$ are both irrational, and their sum is 0, which is rational.`,
          `The other pairs fail: $${root}$ and $\\sqrt{${k2}}$ have an irrational sum, one number in the next pair is rational, and $\\sqrt{${(k + 1) ** 2}}=${k + 1}$ shows the last pair is made of whole numbers.`,
        ],
        correct: pair(root, `-${root}`),
        wrong: [
          {
            label: pair(root, `\\sqrt{${k2}}`),
            feedback: "Both are irrational, but their sum is irrational too, so this pair supports the claim and is not a counterexample.",
          },
          {
            label: pair(root, `${rat.t}`),
            feedback: "The number in this pair is rational. A counterexample needs two irrational numbers.",
          },
          {
            label: pair(`\\sqrt{${(k + 1) ** 2}}`, `\\sqrt{${(k + 2) ** 2}}`),
            feedback: "Both numbers are whole numbers, so they are rational. A counterexample needs two irrational numbers.",
          },
        ],
      }),
    };
  }
  return {
    variant,
    problem: finish(meta, seed, r, {
      prompt: `The number $${root}$ is irrational. For which rational number $q$ is $q\\cdot${root}$ not irrational?`,
      hint: `The product of a nonzero rational number and an irrational number is irrational, so look for the one rational number that is excluded from that rule.`,
      explanation: [
        `If $q\\ne0$, then $q\\cdot${root}$ is irrational: if the product were rational, dividing it by $q$ would make $${root}$ rational.`,
        "If $q=0$, the product is 0, which is rational.",
        "So $q=0$ is the only rational number that works.",
      ],
      correct: "$q=0$",
      wrong: [
        { label: "$q=1$", feedback: `Then the product is $${root}$ itself, which is irrational.` },
        { label: "$q=-1$", feedback: `Then the product is $-${root}$, which is irrational.` },
        { label: `$q=${rat.t === "5" || rat.t === "3" ? "\\frac12" : rat.t}$`, feedback: "A nonzero rational times an irrational number is irrational." },
        { label: "$q=\\frac{1}{3}$", feedback: "A nonzero rational times an irrational number is irrational." },
      ],
    }),
  };
}

// ------------------------------------------------------- polynomial graph match
type PolyShape = { roots: number[]; mult: number[]; a: 1 | -1 };
const polyText = ({ roots, mult, a }: PolyShape) =>
  `$P(x)=${a < 0 ? "-" : ""}${roots.map((z, i) => factor(z, mult[i]!)).join("")}$`;
const polyKey = ({ roots, mult, a }: PolyShape) =>
  JSON.stringify([roots, mult, a]);

export function polynomialGraphMatchCase(seed: string) {
  const meta = polynomialGraphMatchTemplate;
  const r = start(meta, seed);
  let shape: PolyShape;
  for (;;) {
    const count = r(2, 3);
    const roots = shuffle(r, [-3, -2, -1, 0, 1, 2, 3]).slice(0, count);
    roots.sort((x, y) => x - y);
    const mult = roots.map(() => r(1, 2));
    const degree = mult.reduce((t, m) => t + m, 0);
    // Both a crossing and a touching zero, so the graph shows both shapes.
    if (degree < 3 || degree > 5 || !mult.includes(1) || !mult.includes(2))
      continue;
    shape = { roots, mult, a: r(0, 1) ? 1 : -1 };
    break;
  }
  const { roots, mult, a } = shape;
  const degree = mult.reduce((t, m) => t + m, 0);
  const wrongShapes: { shape: PolyShape; feedback: string }[] = [];
  // Flip the sign: the ends go the other way.
  wrongShapes.push({
    shape: { ...shape, a: -a as 1 | -1 },
    feedback:
      "The zeros match, but the ends do not. Check the sign of the leading coefficient: the right end of the graph rises when it is positive and falls when it is negative.",
  });
  // Swap a crossing and a touching zero.
  const k = r(0, roots.length - 1);
  wrongShapes.push({
    shape: { ...shape, mult: mult.map((m, i) => (i === k ? 3 - m : m)) },
    feedback: `At $x=${roots[k]}$ the graph ${mult[k] === 1 ? "crosses the axis, so that factor needs an odd exponent" : "touches the axis and turns back, so that factor needs an even exponent"}. The exponent of this choice does the opposite.`,
  });
  // Mirror the zeros left to right.
  wrongShapes.push({
    shape: {
      roots: roots.map((z) => -z).reverse(),
      mult: [...mult].reverse(),
      a,
    },
    feedback:
      "The zeros are on the wrong sides of the origin. A factor $(x+c)$ has its zero at $x=-c$, and $(x-c)$ at $x=c$; read each zero from the graph and then write the factor.",
  });
  // Move one zero by one unit.
  const step = r(0, 1) ? 1 : -1;
  wrongShapes.push({
    shape: { ...shape, roots: roots.map((z, i) => (i === k ? z + step : z)) },
    feedback: `One zero is misplaced. The graph meets the axis at ${andList(roots.map((z) => `$x=${z}$`))}; each factor must have its zero at one of these points.`,
  });
  // Spares when a symmetric set of zeros makes two of the above coincide.
  wrongShapes.push({
    shape: {
      roots: roots.map((z) => -z).reverse(),
      mult: [...mult].reverse(),
      a: -a as 1 | -1,
    },
    feedback:
      "Both the zeros and the ends are wrong. Read each zero from the graph, write its factor, then check which way the right end goes.",
  });
  wrongShapes.push({
    shape: {
      ...shape,
      mult: mult.map((m, i) => (i === (k + 1) % roots.length ? 3 - m : m)),
    },
    feedback: `The exponents do not match the graph: a factor has an odd exponent where the graph crosses the axis and an even exponent where it touches.`,
  });
  wrongShapes.push({
    shape: { ...shape, mult: mult.map((m) => 3 - m) },
    feedback:
      "Every crossing and touching is reversed. A crossing needs an odd exponent and a touch needs an even one.",
  });
  const seen = new Set([polyKey(shape)]);
  const wrong: Wrong[] = [];
  for (const w of shuffle(r, wrongShapes)) {
    const sorted = [...w.shape.roots].sort((x, y) => x - y);
    if (
      new Set(w.shape.roots).size !== w.shape.roots.length ||
      sorted.some((z, i) => z !== w.shape.roots[i]) ||
      seen.has(polyKey(w.shape))
    )
      continue;
    seen.add(polyKey(w.shape));
    wrong.push({ label: polyText(w.shape), feedback: w.feedback });
  }
  if (wrong.length < 3) throw new Error("Too few distinct graph-match choices");
  const desc = fromRoots(
    a,
    roots.flatMap((z, i) => Array<number>(mult[i]!).fill(z)),
  );
  const win = polynomialWindow(desc, roots);
  let g = graph({
    id: "g",
    x: win.x,
    y: win.y,
    grid: [1, win.grid],
    tick: [1, win.grid],
  }).curve(f.poly(...desc));
  // Each zero is marked with its x-value; the learner reads the factors,
  // whether each crosses or touches, and the end behavior from the curve.
  for (const z of roots) g = g.point(z, 0, `${z}`.replace("-", "−"));
  const figure = g.scene({
    title: "The graph of a polynomial with integer zeros",
  });
  const cross = roots.filter((_, i) => mult[i] === 1);
  const touch = roots.filter((_, i) => mult[i] === 2);
  return {
    variant: 0,
    shape,
    problem: finish(meta, seed, r, {
      prompt:
        "The graph of a polynomial $P$ is shown. Its zeros are integers, and its leading coefficient is $1$ or $-1$. Which factored form gives this graph?",
      hint: `Find where the graph meets the $x$-axis and whether it crosses or touches there: a crossing needs an odd exponent and a touch needs an even one. Then check which way the right end goes.`,
      explanation: [
        `The graph meets the $x$-axis at ${andList(roots.map((z) => `$x=${z}$`))}, so the factors are ${andList(roots.map((z) => `$${factor(z)}$`))}.`,
        `It crosses at ${andList(cross.map((z) => `$x=${z}$`))} (exponent 1) and touches and turns back at ${andList(touch.map((z) => `$x=${z}$`))} (exponent 2), so the degree is $${degree}$.`,
        `The right end ${a > 0 ? "rises" : "falls"}, so the leading coefficient is $${a}$: ${polyText(shape)}.`,
      ],
      figure: { kind: "scene", scene: figure },
      correct: polyText(shape),
      wrong,
    }),
  };
}

const generators: Record<string, (seed: string) => { problem: GeneratedProblem }> = {
  "polynomial-behavior-description": polynomialBehaviorCase,
  "rational-function-features": rationalFunctionCase,
  "graphical-solution-table": graphicalSolutionCase,
  "polynomial-identity-use": polynomialIdentityCase,
  "binomial-coefficient": binomialCoefficientCase,
  "number-system-closure-classify": numberSystemClosureCase,
  "polynomial-graph-match": polynomialGraphMatchCase,
};
export function generateFunctionBehaviorProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const make = generators[templateId];
  if (!make) throw new Error("Unknown function-behavior template");
  return make(seed).problem;
}
