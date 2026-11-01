import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { shuffle } from "./distribution-practice";
import {
  gcd,
  isSquarefree,
  normalCdf,
  withCommas,
} from "./regents-algebra-two-kit";

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

export const normalProbabilityTemplate = meta(
  "normal-probability",
  "Normal model: probability between two values or count above a value",
  "normal-distributions",
  0.55,
  "Use a calculator or table to find the probability between two values of a normally distributed quantity, or the expected count above a value, with the rounding stated.",
);
export const tangentQuadrantCosineTemplate = meta(
  "tangent-quadrant-cosine",
  "Find the cosine of an angle from its tangent and quadrant",
  "trigonometric-identities",
  0.6,
  "Use the tangent and the quadrant of the angle to find the exact cosine, rationalized, including the sign.",
);
export const specialAngleMatchTemplate = meta(
  "special-angle-match",
  "Match a trigonometric value at a special angle with another expression",
  "trigonometric-symmetry",
  0.45,
  "Choose the expression with the same exact value as the sine or cosine of an obtuse special angle, using reference angles and cofunctions.",
);
export const oddSineParametersTemplate = meta(
  "odd-sine-parameters",
  "Choose the parameters that make a sine function odd",
  "trigonometric-graphs",
  0.5,
  "Decide which phase shift and vertical shift make $A\\sin(Bx-C)+D$ an odd function, using $f(-x)=-f(x)$.",
);
export const parabolaVertexDistanceTemplate = meta(
  "parabola-vertex-distance",
  "Find the vertex of a parabola from its directrix and the distance to its focus",
  "parabola-locus",
  0.5,
  "Place the vertex halfway between the directrix and a focus that is described only by its distance from the directrix and the line it lies on.",
);
export const eventComplementSetTemplate = meta(
  "event-complement-set",
  "Write the complement of a set of outcomes as a set",
  "event-sets",
  0.3,
  "List the members of the complement of an event, of a union, or of an intersection of two events in a given sample space.",
);

/* ----------------------------------------------------- normal probability */
const normalAxes = {
  ask: defineAxis("ask", ["between-values", "count-above"] as const),
};
interface NormalModel {
  ask: "between-values" | "count-above";
  mu: number;
  sigma: number;
  a: number;
  b: number;
  n: number;
  noun: number;
}
const normalNouns = [
  {
    what: "heights of adult women",
    unit: "inches",
    mean: [62, 63, 64, 65],
    sd: [2, 2.5, 3],
  },
  {
    what: "scores on a standardized exam",
    unit: "points",
    mean: [70, 75, 80, 500],
    sd: [6, 8, 10, 50, 100],
  },
  {
    what: "lengths of a machine part",
    unit: "millimeters",
    mean: [40, 50, 120],
    sd: [2, 3, 4, 5],
  },
  {
    what: "lifetimes of a battery",
    unit: "hours",
    mean: [200, 300, 450],
    sd: [20, 25, 30, 40],
  },
] as const;
function normalModel(
  r: (lo: number, hi: number) => number,
  ax: { ask: NormalModel["ask"] },
): NormalModel {
  const noun = r(0, normalNouns.length - 1);
  const spec = normalNouns[noun]!;
  const mu = pick(r, spec.mean);
  let sigma = pick(r, spec.sd);
  if (noun === 1 && mu === 500) sigma = pick(r, [50, 100] as const);
  if (noun === 1 && mu !== 500) sigma = pick(r, [6, 8, 10] as const);
  const step = sigma >= 20 ? 5 : sigma >= 5 ? 1 : 0.5;
  const pickVal = (lo: number, hi: number) =>
    mu +
    step * r(Math.ceil((lo * sigma) / step), Math.floor((hi * sigma) / step));
  const m: NormalModel = { ask: ax.ask, mu, sigma, a: 0, b: 0, n: 0, noun };
  if (ax.ask === "between-values") {
    m.a = pickVal(-2, 0.5);
    m.b = pickVal(0.5, 2.2);
    if (m.b - m.a < sigma) throw new Error("Need three retries");
    const P = normalCdf((m.b - mu) / sigma) - normalCdf((m.a - mu) / sigma);
    if (!clear(P * 1000)) throw new Error("Need three retries");
  } else {
    m.a = pickVal(-1.9, 1.9);
    m.n = 100 * r(2, 50);
    const z = (m.a - mu) / sigma;
    const count = m.n * (1 - normalCdf(z));
    if (Math.abs(z) < 0.3 || !clear(count))
      throw new Error("Need three retries");
  }
  return m;
}
/** True when x is not within 0.08 of a rounding boundary (a half). */
const clear = (x: number) => Math.abs(x - Math.floor(x) - 0.5) > 0.08;
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(v));
export const normalProbability = chainFamily({
  template: normalProbabilityTemplate,
  axes: normalAxes,
  model: normalModel,
  variant: (m) => m.ask,
  render: (m, _ax, r) => {
    const spec = normalNouns[m.noun]!;
    const z = (v: number) => (v - m.mu) / m.sigma;
    const model = `The ${spec.what} follow a normal distribution with mean ${fmt(m.mu)} ${spec.unit} and standard deviation ${fmt(m.sigma)} ${spec.unit}.`;
    const calc = "Use a calculator or table.";
    if (m.ask === "between-values") {
      const P = normalCdf(z(m.b)) - normalCdf(z(m.a));
      const pct = (p: number) =>
        `${(Math.round(p * 1000 + 1e-9) / 10).toFixed(1)}%`;
      const wrongSign = normalCdf(z(m.b)) - normalCdf(-z(m.a));
      const variance =
        normalCdf((m.b - m.mu) / m.sigma ** 2) -
        normalCdf((m.a - m.mu) / m.sigma ** 2);
      return choiceSurface(r, {
        prompt: `${model} ${calc} To the nearest tenth of a percent, what percent of these values are between ${fmt(m.a)} and ${fmt(m.b)} ${spec.unit}?`,
        options: [
          { label: pct(P), correct: true },
          {
            label: pct(normalCdf(z(m.b))),
            feedback: `This is the percent below ${fmt(m.b)}. It also includes everything below ${fmt(m.a)}, which must be subtracted.`,
          },
          {
            label: pct(1 - normalCdf(z(m.a))),
            feedback: `This is the percent above ${fmt(m.a)}. It includes values above ${fmt(m.b)}, which must be removed.`,
          },
          {
            label: pct(1 - P),
            feedback: `This is the percent outside the two values. The question asks for the percent between them.`,
          },
          {
            label: pct(wrongSign),
            feedback: `The $z$-score of ${fmt(m.a)} is $${z(m.a).toFixed(2)}$; keep its sign when you find the area below it.`,
          },
          {
            label: pct(variance),
            feedback:
              "A $z$-score divides by the standard deviation, not by its square.",
          },
        ],
        hint: `Find the area under the normal curve with mean ${fmt(m.mu)} and standard deviation ${fmt(m.sigma)} below ${fmt(m.b)}, then subtract the area below ${fmt(m.a)}.`,
        explanation: [
          `A normal distribution is the bell-shaped pattern where most values sit near the mean, the average, and fewer sit far from it.`,
          `The standard deviation, here ${fmt(m.sigma)} ${spec.unit}, is the typical distance of a value from the mean.`,
          `A $z$-score counts how many standard deviations a value is from the mean. Subtract the mean, then divide by the standard deviation.`,
          `$z$-scores: $z_{${fmt(m.a)}}=\\frac{${fmt(m.a)}-${fmt(m.mu)}}{${fmt(m.sigma)}}=${z(m.a).toFixed(2)}$ and $z_{${fmt(m.b)}}=\\frac{${fmt(m.b)}-${fmt(m.mu)}}{${fmt(m.sigma)}}=${z(m.b).toFixed(2)}$.`,
          `A calculator or table gives the area under the curve to the left of a $z$-score. That area is the fraction of values below it.`,
          `Area below ${fmt(m.b)}: $${normalCdf(z(m.b)).toFixed(4)}$. Area below ${fmt(m.a)}: $${normalCdf(z(m.a)).toFixed(4)}$.`,
          `The values between ${fmt(m.a)} and ${fmt(m.b)} are the values below ${fmt(m.b)} minus the values below ${fmt(m.a)}.`,
          `The percent between them is $${normalCdf(z(m.b)).toFixed(4)}-${normalCdf(z(m.a)).toFixed(4)}\\approx${(P * 100).toFixed(1)}\\%$.`,
          `About ${(P * 100).toFixed(1)}% of these ${spec.what.split(" ")[0]} are between ${fmt(m.a)} and ${fmt(m.b)} ${spec.unit}.`,
        ],
      });
    }
    const zz = z(m.a);
    const count = (p: number) => Math.round(m.n * p);
    const lbl = (c: number) => `${withCommas(c)} values`;
    const tails = [0.5, 0.16, 0.025, 0.0015];
    const rule =
      zz >= 0
        ? tails[Math.min(3, Math.floor(zz))]!
        : 1 - tails[Math.min(3, Math.floor(-zz))]!;
    return choiceSurface(r, {
      prompt: `${model} ${calc} In a sample of ${withCommas(m.n)} values, about how many are greater than ${fmt(m.a)} ${spec.unit}? Round to the nearest whole number.`,
      options: [
        { label: lbl(count(1 - normalCdf(zz))), correct: true },
        {
          label: lbl(count(normalCdf(zz))),
          feedback: `This counts the values below ${fmt(m.a)}. The question asks for the values above it.`,
        },
        {
          label: lbl(count(rule)),
          feedback:
            "The 68-95-99.7 rule applies at whole numbers of standard deviations only. This $z$-score is not a whole number, so use a calculator or table.",
        },
        {
          label: lbl(Math.round(m.n / 2)),
          feedback: `Half of the values are above the mean, ${fmt(m.mu)}, but ${fmt(m.a)} is not the mean.`,
        },
        {
          label: lbl(count(1 - normalCdf((m.a - m.mu) / m.sigma ** 2))),
          feedback:
            "A $z$-score divides by the standard deviation, not by its square.",
        },
      ],
      hint: `Find the $z$-score of ${fmt(m.a)} using the mean ${fmt(m.mu)} and standard deviation ${fmt(m.sigma)}, find the area above it, and multiply by ${withCommas(m.n)}.`,
      explanation: [
        `A normal distribution is the bell-shaped pattern where most values sit near the mean, the average, and fewer sit far from it.`,
        `A $z$-score counts how many standard deviations, typical distances from the mean, a value lies from the mean. Subtract the mean, then divide by the standard deviation.`,
        `$z=\\frac{${fmt(m.a)}-${fmt(m.mu)}}{${fmt(m.sigma)}}=${zz.toFixed(2)}$.`,
        `A calculator or table gives the area to the left of a $z$-score, the fraction of values below it. Here that area is $${normalCdf(zz).toFixed(4)}$.`,
        `The whole area under the curve is 1, so the area to the right is 1 minus the area to the left.`,
        `The area above this $z$-score is $1-${normalCdf(zz).toFixed(4)}=${(1 - normalCdf(zz)).toFixed(4)}$.`,
        `Multiply that fraction by the sample size to estimate the count.`,
        `Expected count: $${withCommas(m.n)}\\times${(1 - normalCdf(zz)).toFixed(4)}\\approx${withCommas(count(1 - normalCdf(zz)))}$.`,
        `About ${withCommas(count(1 - normalCdf(zz)))} of the ${withCommas(m.n)} values are greater than ${fmt(m.a)} ${spec.unit}.`,
      ],
    });
  },
});

/* ------------------------------------------------- tangent -> cosine */
const tanAxes = {
  quadrant: defineAxis("quadrant", ["two", "three", "four"] as const),
  form: defineAxis("form", ["integer", "fraction"] as const),
};
interface TanModel {
  a: number;
  b: number;
  n: number;
}
function tanModel(
  r: (lo: number, hi: number) => number,
  ax: { form: "integer" | "fraction" },
): TanModel {
  const a = r(1, 12);
  const b = ax.form === "integer" ? 1 : r(2, 9);
  if (gcd(a, b) !== 1 || a === b) throw new Error("Need three retries");
  const n = a * a + b * b;
  const root = Math.sqrt(n);
  if (!Number.isInteger(root) && !isSquarefree(n))
    throw new Error("Need three retries");
  return { a, b, n };
}
export const tangentQuadrantCosine = chainFamily({
  template: tangentQuadrantCosineTemplate,
  axes: tanAxes,
  model: tanModel,
  variant: (m) =>
    Number.isInteger(Math.sqrt(m.n)) ? "perfect-square" : "radical",
  render: (m, ax, r) => {
    const quad = ({ two: "II", three: "III", four: "IV" } as const)[
      ax.quadrant
    ];
    const tanNeg = quad !== "III";
    const cosNeg = quad !== "IV";
    const { a, b, n } = m;
    const root = Math.sqrt(n);
    const exact = Number.isInteger(root);
    const val = (num: number, sgn: boolean, rad: boolean, over: number) => {
      const body = rad
        ? num === 1
          ? `\\sqrt{${n}}`
          : `${num}\\sqrt{${n}}`
        : String(num);
      return `$${sgn ? "-" : ""}\\dfrac{${body}}{${over}}$`;
    };
    const cos = (neg: boolean) =>
      exact ? val(b, neg, false, root) : val(b, neg, true, n);
    const sin = (neg: boolean) =>
      exact ? val(a, neg, false, root) : val(a, neg, true, n);
    const sec = (neg: boolean) =>
      (exact ? val(root, neg, false, b) : val(1, neg, true, b)).replace(
        "\\dfrac{\\sqrt{" + n + "}}{1}",
        `\\sqrt{${n}}`,
      );
    const tanText = `${tanNeg ? "-" : ""}${b === 1 ? a : `\\dfrac{${a}}{${b}}`}`;
    const sinNeg = quad === "IV" || quad === "III";
    return choiceSurface(r, {
      prompt: `Angle $\\theta$ is in Quadrant ${quad} and $\\tan\\theta=${tanText}$. What is $\\cos\\theta$?`,
      options: [
        { label: cos(cosNeg), correct: true },
        {
          label: cos(!cosNeg),
          feedback: `In Quadrant ${quad}, cosine is ${cosNeg ? "negative" : "positive"}. The value has the right size but the wrong sign.`,
        },
        {
          label: sin(sinNeg),
          feedback: `This is $\\sin\\theta$: the opposite side ${a} goes over the hypotenuse. Cosine uses the adjacent side ${b}.`,
        },
        {
          label: sec(cosNeg),
          feedback:
            "This is the reciprocal of cosine, $\\sec\\theta$: the hypotenuse divided by the adjacent side. Cosine is the adjacent side divided by the hypotenuse.",
        },
        ...(exact
          ? []
          : [
              {
                label: `$${cosNeg ? "-" : ""}\\dfrac{${b}}{${n}}$`,
                feedback: `The hypotenuse is $\\sqrt{${a}^2+${b}^2}=\\sqrt{${n}}$, so keep the square root; ${n} is not a perfect square.`,
              },
            ]),
      ],
      hint: `Draw a reference right triangle with opposite side ${a} and adjacent side ${b}, find its hypotenuse, and then decide the sign of cosine from Quadrant ${quad}.`,
      explanation: [
        `In a right triangle, the tangent of an angle is the opposite side divided by the adjacent side: $\\tan\\theta=\\frac{\\text{opposite}}{\\text{adjacent}}$.`,
        `So draw a reference triangle, the right triangle the angle makes with the $x$-axis, with opposite side ${a} and adjacent side ${b}.${tanNeg ? " Side lengths are positive, so set the minus sign aside for now." : ""}`,
        `The Pythagorean theorem says the two legs squared add up to the hypotenuse squared. The hypotenuse, the longest side, is $\\sqrt{${a}^2+${b}^2}=${exact ? root : `\\sqrt{${n}}`}$.`,
        `Cosine is the adjacent side divided by the hypotenuse. So the size of $\\cos\\theta$ is $\\frac{${b}}{${exact ? root : `\\sqrt{${n}}`}}$.`,
        ...(exact
          ? []
          : [
              `Multiply the top and bottom by $\\sqrt{${n}}$ to clear the square root from the bottom: $\\frac{${b}}{\\sqrt{${n}}}=\\frac{${b === 1 ? "" : b}\\sqrt{${n}}}{${n}}$.`,
            ]),
        `In Quadrant ${quad}, $x$-values are ${cosNeg ? "negative" : "positive"}. Cosine has the sign of the $x$-value, so cosine is ${cosNeg ? "negative" : "positive"} there.`,
        `So ${cos(cosNeg).replace(/^\$/, "$\\cos\\theta = ")}.`,
      ],
    });
  },
});

/* ------------------------------------------------- special-angle match */
type Fn = "sin" | "cos" | "tan";
interface Expr {
  sign: 1 | -1;
  fn: Fn;
  angle: "pi/6" | "pi/4" | "pi/3" | "2pi/3" | "3pi/4" | "5pi/6";
}
const angleTex: Record<Expr["angle"], string> = {
  "pi/6": "\\frac{\\pi}{6}",
  "pi/4": "\\frac{\\pi}{4}",
  "pi/3": "\\frac{\\pi}{3}",
  "2pi/3": "\\frac{2\\pi}{3}",
  "3pi/4": "\\frac{3\\pi}{4}",
  "5pi/6": "\\frac{5\\pi}{6}",
};
const angleRad: Record<Expr["angle"], number> = {
  "pi/6": Math.PI / 6,
  "pi/4": Math.PI / 4,
  "pi/3": Math.PI / 3,
  "2pi/3": (2 * Math.PI) / 3,
  "3pi/4": (3 * Math.PI) / 4,
  "5pi/6": (5 * Math.PI) / 6,
};
const exactTable: Record<string, string> = {
  "sin pi/6": "\\frac12",
  "sin pi/4": "\\frac{\\sqrt2}{2}",
  "sin pi/3": "\\frac{\\sqrt3}{2}",
  "sin 2pi/3": "\\frac{\\sqrt3}{2}",
  "sin 3pi/4": "\\frac{\\sqrt2}{2}",
  "sin 5pi/6": "\\frac12",
  "cos pi/6": "\\frac{\\sqrt3}{2}",
  "cos pi/4": "\\frac{\\sqrt2}{2}",
  "cos pi/3": "\\frac12",
  "cos 2pi/3": "-\\frac12",
  "cos 3pi/4": "-\\frac{\\sqrt2}{2}",
  "cos 5pi/6": "-\\frac{\\sqrt3}{2}",
  "tan pi/6": "\\frac{\\sqrt3}{3}",
  "tan pi/4": "1",
  "tan pi/3": "\\sqrt3",
  "tan 2pi/3": "-\\sqrt3",
  "tan 3pi/4": "-1",
  "tan 5pi/6": "-\\frac{\\sqrt3}{3}",
};
const value = (e: Expr) => e.sign * Math[e.fn](angleRad[e.angle]);
const exprTex = (e: Expr) =>
  `${e.sign < 0 ? "-" : ""}\\${e.fn}\\left(${angleTex[e.angle]}\\right)`;
const exprValueTex = (e: Expr) => {
  const base = exactTable[`${e.fn} ${e.angle}`]!;
  if (e.sign > 0) return base;
  return base.startsWith("-") ? base.slice(1) : `-${base}`;
};
const specialAxes = {
  target: defineAxis("target", ["sine", "cosine"] as const),
};
interface SpecialModel {
  target: Expr;
  correct: Expr;
  pool: Expr[];
}
const acute = ["pi/6", "pi/4", "pi/3"] as const;
const obtuse = ["2pi/3", "3pi/4", "5pi/6"] as const;
const partner: Record<string, Expr["angle"]> = {
  "2pi/3": "pi/3",
  "3pi/4": "pi/4",
  "5pi/6": "pi/6",
};
const complement: Record<string, Expr["angle"]> = {
  "pi/6": "pi/3",
  "pi/4": "pi/4",
  "pi/3": "pi/6",
};
function specialModel(
  r: (lo: number, hi: number) => number,
  ax: { target: "sine" | "cosine" },
): SpecialModel {
  const angle = pick(r, obtuse);
  const ref = partner[angle]!;
  const target: Expr = {
    sign: 1,
    fn: ax.target === "sine" ? "sin" : "cos",
    angle,
  };
  // sine of an obtuse angle = cosine of the complement of its reference angle;
  // cosine of an obtuse angle = minus cosine of the reference angle.
  const correct: Expr =
    ax.target === "sine"
      ? { sign: 1, fn: "cos", angle: complement[ref]! }
      : { sign: -1, fn: "cos", angle: ref };
  const pool: Expr[] = [];
  for (const fn of ["sin", "cos", "tan"] as const)
    for (const sign of [1, -1] as const)
      for (const a of [...acute, ...obtuse]) {
        const e: Expr = { sign, fn, angle: a };
        if (Math.abs(value(e) - value(target)) > 1e-9 && Math.abs(value(e)) < 5)
          pool.push(e);
      }
  return { target, correct, pool };
}
export const specialAngleMatch = chainFamily({
  template: specialAngleMatchTemplate,
  axes: specialAxes,
  model: specialModel,
  variant: (m) => `${m.target.fn}-${m.target.angle.replace("/", "-")}`,
  render: (m, _ax, r) => {
    // Distractors must differ in value from one another, not only in form.
    const used: number[] = [];
    const bad = shuffle(r, m.pool)
      .filter((e) => {
        if (exprTex(e) === exprTex(m.correct)) return false;
        const v = value(e);
        if (used.some((u) => Math.abs(u - v) < 1e-9)) return false;
        used.push(v);
        return true;
      })
      .slice(0, 3);
    const tv = exprValueTex(m.target);
    return choiceSurface(r, {
      prompt: `Which expression has the same value as $${exprTex(m.target)}$?`,
      options: [
        { label: `$${exprTex(m.correct)}$`, correct: true },
        ...bad.map((e) => ({
          label: `$${exprTex(e)}$`,
          feedback: `$${exprTex(e)}=${exprValueTex(e)}$, but $${exprTex(m.target)}=${tv}$. Check the size at the reference angle and the sign in its quadrant.`,
        })),
      ],
      hint: `Find the reference angle of $${angleTex[m.target.angle]}$ and the sign of ${m.target.fn === "sin" ? "sine" : "cosine"} in Quadrant II. Then compare each choice by its exact value.`,
      explanation: [
        `The angle $${angleTex[m.target.angle]}$ is between $\\frac{\\pi}{2}$ and $\\pi$, so it is in Quadrant II, the upper left part of the plane.`,
        `Its reference angle, the acute angle back to the $x$-axis, is $${angleTex[partner[m.target.angle]!]}$, because $\\pi$ minus $${angleTex[m.target.angle]}$ leaves $${angleTex[partner[m.target.angle]!]}$.`,
        `Sine and cosine have the same size as at the reference angle. Only the sign can change.`,
        `In Quadrant II, sine (the $y$-value) is positive and cosine (the $x$-value) is negative. So $${exprTex(m.target)}=${tv}$.`,
        `Now find the exact value of each choice and compare. The choice $${exprTex(m.correct)}$ equals $${exprValueTex(m.correct)}$, the same value.`,
        `The correct choice is $${exprTex(m.correct)}$, because it also equals $${tv}$.`,
      ],
    });
  },
});

/* --------------------------------------------------------- odd sine */
const oddAxes = {
  lead: defineAxis("lead", ["positive", "negative"] as const),
};
interface OddModel {
  A: number;
  B: number;
  k: number;
  other: number;
}
function oddModel(r: (lo: number, hi: number) => number): OddModel {
  return {
    A: r(2, 5),
    B: pick(r, [2, 3, 4] as const),
    k: r(1, 4),
    other: pick(r, [2, 3, 4] as const),
  };
}
export const oddSineParameters = chainFamily({
  template: oddSineParametersTemplate,
  axes: oddAxes,
  model: oddModel,
  variant: (m) => `period-${m.B}`,
  render: (m, ax, r) => {
    const A = ax.lead === "negative" ? -m.A : m.A;
    const rule = `f(x)=${A < 0 ? "-" : ""}${Math.abs(A)}\\sin(${m.B}x-C)+D`;
    const pair = (c: string, d: string) => `$C=${c}$ and $D=${d}$`;
    const quarter = `\\dfrac{\\pi}{${2 * m.other}}`;
    return choiceSurface(r, {
      prompt: `For which values of $C$ and $D$ is $${rule}$ an odd function?`,
      options: [
        { label: pair("0", "0"), correct: true },
        {
          label: pair(`\\dfrac{\\pi}{2}`, "0"),
          feedback: `With $C=\\frac{\\pi}{2}$ the function is $${A < 0 ? "" : "-"}${Math.abs(A)}\\cos(${m.B}x)$ up to sign, which is even: $f(-x)=f(x)$.`,
        },
        {
          label: pair("0", String(m.k)),
          feedback: `The constant ${m.k} shifts the graph up. For an odd function $f(-x)=-f(x)$, which forces $f(0)=0$; here $f(0)=${m.k}$.`,
        },
        {
          label: pair(quarter, String(m.k)),
          feedback:
            "A phase shift of this size and a vertical shift together give a function that is neither even nor odd.",
        },
        {
          label: pair(quarter, "0"),
          feedback: `With $C=\\frac{\\pi}{${2 * m.other}}$ the graph is shifted sideways but is not symmetric about the origin, so $f(-x)\\ne-f(x)$.`,
        },
      ],
      hint: `An odd function satisfies $f(-x)=-f(x)$, so its graph passes through the origin. Test $f(0)=${A < 0 ? "-" : ""}${Math.abs(A)}\\sin(-C)+D$ and compare $f(-x)$ with $-f(x)$.`,
      explanation: [
        `An odd function is one where $f(-x)=-f(x)$ for every $x$. Its graph looks the same after a half turn about the origin, the point (0, 0).`,
        `Put $x=0$ into that rule: $f(0)=-f(0)$. Only 0 equals its own opposite, so an odd function has $f(0)=0$.`,
        `Sine is odd, because $\\sin(-x)=-\\sin(x)$. So with no shifts, $${rule.replace("-C", "").replace("+D", "")}$ is odd.`,
        `$D$ is a vertical shift, a slide up or down. If $D\\ne0$, then $f(0)=D$, not 0, so the function is not odd.`,
        `$C$ is a phase shift, a slide left or right. With $C=\\frac{\\pi}{2}$, sine turns into cosine, which is even: $f(-x)=f(x)$.`,
        `The other nonzero choices for $C$ make $\\sin(-C)$ nonzero, so $f(0)$ is not 0 even when $D=0$.`,
        "So both shifts must be 0: $C=0$ and $D=0$.",
        "The function is odd when $C=0$ and $D=0$.",
      ],
    });
  },
});

/* ---------------------------------------------- parabola vertex */
const vertexAxes = {
  directrix: defineAxis("directrix", ["horizontal", "vertical"] as const),
};
interface VertexModel {
  d: number;
  f: number;
  h: number;
  above: boolean;
}
function vertexModel(r: (lo: number, hi: number) => number): VertexModel {
  const d = r(-5, 5);
  const f = pick(r, [2, 3, 4, 5, 6, 8] as const);
  const h = r(-6, 6);
  if (d === h || d + f / 2 === h) throw new Error("Need three retries");
  return { d, f, h, above: r(0, 1) === 1 };
}
export const parabolaVertexDistance = chainFamily({
  template: parabolaVertexDistanceTemplate,
  axes: vertexAxes,
  model: vertexModel,
  variant: (m) => (m.above ? "positive-side" : "negative-side"),
  render: (m, ax, r) => {
    const num = (v: number) => String(v);
    const unitsOf = (v: number) => `${v} ${v === 1 ? "unit" : "units"}`;
    const s = m.above ? 1 : -1;
    const half = (m.f / 2) * s;
    const pt = (x: number, y: number) => `$(${num(x)},\\ ${num(y)})$`;
    const horiz = ax.directrix === "horizontal";
    // horizontal directrix y=d, axis x=h: vertex (h, d+half). vertical directrix x=d, axis y=h: vertex (d+half, h).
    const make = (along: number) => (horiz ? pt(m.h, along) : pt(along, m.h));
    const correct = m.d + half;
    const side = horiz
      ? m.above
        ? "above"
        : "below"
      : m.above
        ? "to the right of"
        : "to the left of";
    const line = horiz ? `y=${m.d}` : `x=${m.d}`;
    const axisLine = horiz ? `x=${m.h}` : `y=${m.h}`;
    return choiceSurface(r, {
      prompt: `A parabola has directrix $${line}$. Its focus is ${m.f} units from the directrix, ${side} it, on the line $${axisLine}$. Which point is the vertex of the parabola?`,
      options: [
        { label: make(correct), correct: true },
        {
          label: make(m.d + 2 * half),
          feedback: `That point is ${m.f} units from the directrix, which is the focus. The vertex is halfway between the directrix and the focus.`,
        },
        {
          label: make(m.d - half),
          feedback: `That point is on the other side of the directrix. The focus and the vertex are ${side} it.`,
        },
        {
          label: horiz ? pt(correct, m.h) : pt(m.h, correct),
          feedback:
            "The coordinates are swapped. The vertex lies on the axis of symmetry through the focus, perpendicular to the directrix.",
        },
        {
          label: horiz ? pt(m.h, half) : pt(half, m.h),
          feedback: `The vertex is ${unitsOf(m.f / 2)} from the directrix $${line}$, not from the origin.`,
        },
      ],
      hint: `The vertex lies on $${axisLine}$ halfway between the directrix $${line}$ and the focus, which is ${m.f} units from the directrix. Find the point ${unitsOf(m.f / 2)} from the directrix on the focus's side.`,
      explanation: [
        `A parabola is every point that is the same distance from a fixed point, the focus, and a fixed line, the directrix.`,
        `The vertex, the turning point, is on the parabola. So it is equally far from the focus and the directrix, which puts it halfway between them.`,
        `The axis of symmetry, the mirror line of the parabola, goes through the focus at a right angle to the directrix: $${axisLine}$. The vertex lies on it.`,
        `Half of ${m.f} units is ${unitsOf(m.f / 2)}. So the vertex is ${unitsOf(m.f / 2)} from the directrix, ${side} it, on the focus's side.`,
        `That gives the ${horiz ? `$y$-coordinate $${m.d}${s > 0 ? "+" : "-"}${m.f / 2}=${num(correct)}$` : `$x$-coordinate $${m.d}${s > 0 ? "+" : "-"}${m.f / 2}=${num(correct)}$`}, so the vertex is ${make(correct)}.`,
        `The vertex of the parabola is the point ${make(correct)}.`,
      ],
    });
  },
});

/* ------------------------------------------------------ event complement */
const eventAxes = {
  ask: defineAxis("ask", [
    "complement",
    "complement-of-union",
    "complement-of-intersection",
  ] as const),
};
const people = [
  "Ana",
  "Ben",
  "Cy",
  "Dee",
  "Eli",
  "Fay",
  "Gus",
  "Hal",
  "Ivy",
  "Jo",
] as const;
interface EventModel {
  universe: string[];
  A: Set<string>;
  B: Set<string>;
  ask: "complement" | "complement-of-union" | "complement-of-intersection";
}
function eventModel(
  r: (lo: number, hi: number) => number,
  ax: { ask: EventModel["ask"] },
): EventModel {
  const size = r(7, 9);
  const universe = people.slice(0, size) as unknown as string[];
  const A = new Set(universe.filter(() => r(0, 99) < 50));
  const B = new Set(universe.filter(() => r(0, 99) < 45));
  return { universe, A, B, ask: ax.ask };
}
export const eventComplementSet = chainFamily({
  template: eventComplementSetTemplate,
  axes: eventAxes,
  model: eventModel,
  variant: (m) => m.ask,
  render: (m, _ax, r) => {
    const U = m.universe;
    const comp = (s: Set<string>) => new Set(U.filter((x) => !s.has(x)));
    const union = (x: Set<string>, y: Set<string>) =>
      new Set(U.filter((e) => x.has(e) || y.has(e)));
    const inter = (x: Set<string>, y: Set<string>) =>
      new Set(U.filter((e) => x.has(e) && y.has(e)));
    const show = (s: Set<string>) =>
      `{${U.filter((x) => s.has(x)).join(", ")}}`;
    const key = (s: Set<string>) => U.filter((x) => s.has(x)).join(",");
    if (
      m.A.size < 2 ||
      m.B.size < 2 ||
      m.A.size > U.length - 2 ||
      m.B.size > U.length - 2
    )
      return null;
    const setA = `{${U.filter((x) => m.A.has(x)).join(", ")}}`;
    const setB = `{${U.filter((x) => m.B.has(x)).join(", ")}}`;
    let target: Set<string>;
    let question: string;
    let pool: { s: Set<string>; f: string }[];
    if (m.ask === "complement") {
      target = comp(m.A);
      question = "A'";
      pool = [
        {
          s: m.A,
          f: "These are the members of $A$ itself. The complement lists the members of the sample space that are not in $A$.",
        },
        {
          s: comp(m.B),
          f: "This is the complement of $B$, the members not in $B$. The question asks for the members not in $A$.",
        },
        {
          s: union(m.A, m.B),
          f: "This is the union of $A$ and $B$, the members in either set. The complement of $A$ keeps only the members not in $A$.",
        },
        {
          s: inter(m.A, m.B),
          f: "This is the intersection of $A$ and $B$, the members in both sets. The complement of $A$ keeps only the members not in $A$.",
        },
      ];
    } else if (m.ask === "complement-of-union") {
      target = comp(union(m.A, m.B));
      question = "(A\\cup B)'";
      pool = [
        {
          s: union(m.A, m.B),
          f: "This is $A\\cup B$ itself. Its complement lists the members of the sample space that are in neither set.",
        },
        {
          s: union(comp(m.A), comp(m.B)),
          f: "This is $A'\\cup B'$, which equals $(A\\cap B)'$. The complement of a union is the intersection $A'\\cap B'$.",
        },
        {
          s: comp(m.A),
          f: "This is $A'$ only. Members of $B$ must also be left out.",
        },
        {
          s: comp(m.B),
          f: "This is $B'$ only. Members of $A$ must also be left out.",
        },
      ];
    } else {
      target = comp(inter(m.A, m.B));
      question = "(A\\cap B)'";
      pool = [
        {
          s: inter(m.A, m.B),
          f: "This is $A\\cap B$ itself. Its complement lists the members of the sample space that are not in both sets.",
        },
        {
          s: inter(comp(m.A), comp(m.B)),
          f: "This is $A'\\cap B'$, which equals $(A\\cup B)'$. The complement of an intersection is the union $A'\\cup B'$.",
        },
        {
          s: comp(m.A),
          f: "This is $A'$ only; members in $A$ but not $B$ also belong to the complement of the intersection.",
        },
        {
          s: comp(m.B),
          f: "This is $B'$ only; members in $B$ but not $A$ also belong to the complement of the intersection.",
        },
      ];
    }
    if (target.size === 0 || target.size === U.length) return null;
    const options = [
      { label: show(target), correct: true as const },
      ...pool.map((p) => ({ label: show(p.s), feedback: p.f })),
    ].filter(
      (o, i, all) =>
        o.label !== "{}" && all.findIndex((q) => q.label === o.label) === i,
    );
    void key;
    return choiceSurface(r, {
      prompt: `The sample space is $S$ = ${show(new Set(U))}. Event $A$ = ${setA} and event $B$ = ${setB}. Which set is $${question}$?`,
      options,
      hint: `Go through the ${U.length} members of $S$ one at a time, starting with ${U[0]}. $A$ = ${setA} and $B$ = ${setB}; keep the members that are ${m.ask === "complement" ? "not in $A$" : m.ask === "complement-of-union" ? "in neither $A$ nor $B$" : "not in both $A$ and $B$"}.`,
      explanation: [
        `The sample space $S$ lists every possible outcome. An event, like $A$, is a smaller set of those outcomes.`,
        `The complement of a set, written with a prime mark like $A'$, holds every member of $S$ that is not in that set.`,
        m.ask === "complement"
          ? `$A'$ contains every member of $S$ that is not in $A$.`
          : m.ask === "complement-of-union"
            ? `The union $A\\cup B$ holds every member that is in $A$, in $B$, or in both. First $A\\cup B$ = ${show(union(m.A, m.B))}. Its complement contains the members of $S$ outside that set.`
            : `The intersection $A\\cap B$ holds only the members that are in both $A$ and $B$. First $A\\cap B$ = ${show(inter(m.A, m.B))}. Its complement contains the members of $S$ outside that set.`,
        `Go through the ${U.length} members of $S$ one at a time and keep each one that is outside that set.`,
        `Checking each member of $S$ gives $${question}$ = ${show(target)}.`,
        `So $${question}$ is the set ${show(target)}.`,
      ],
    });
  },
});

export const regentsAlgebraTwoFunctionsTemplates = [
  normalProbabilityTemplate,
  tangentQuadrantCosineTemplate,
  specialAngleMatchTemplate,
  oddSineParametersTemplate,
  parabolaVertexDistanceTemplate,
  eventComplementSetTemplate,
];
export const regentsAlgebraTwoFunctionsGenerate = dispatch(
  regentsAlgebraTwoFunctionsTemplates,
  {
    "normal-probability": (s) => normalProbability.generate(s).problem,
    "tangent-quadrant-cosine": (s) => tangentQuadrantCosine.generate(s).problem,
    "special-angle-match": (s) => specialAngleMatch.generate(s).problem,
    "odd-sine-parameters": (s) => oddSineParameters.generate(s).problem,
    "parabola-vertex-distance": (s) =>
      parabolaVertexDistance.generate(s).problem,
    "event-complement-set": (s) => eventComplementSet.generate(s).problem,
  },
);
