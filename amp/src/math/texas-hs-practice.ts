import { article } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  shuffle,
  type Random,
} from "./distribution-practice";
import { graph, lineTable } from "./scene/author";
import type { Scene } from "./scene/spec";

/**
 * Texas high-school requirement gaps: Algebra I, Geometry, Algebra II and
 * Precalculus tasks that no existing template practiced. Every case is a
 * private exact integer or rational model; only the prompt, an optional
 * figure and the shuffled choices reach the learner.
 */

const make = (
  id: string,
  title: string,
  skillId: string,
  difficultyOffset: number,
  description: string,
  scene = false,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand: "9–12",
  difficultyOffset,
  requiredResponseCapability: "single-choice-v1",
  ...(scene ? { requiredFigureCapability: "scenes-v1" as const } : {}),
  description,
});

export const lineEquationFormsTemplate = make(
  "line-equation-forms",
  "Write a line in a requested form",
  "linear-equation-modeling",
  0.3,
  "Choose the equation of a line in point-slope, slope-intercept or standard form from a point and a slope, from two points, or from another form.",
);
export const lineRelationshipEquationsTemplate = make(
  "line-relationship-equations",
  "Parallel, perpendicular and axis-parallel lines",
  "linear-equation-modeling",
  0.45,
  "Choose the equation of the line through a point that is parallel or perpendicular to a given line, or parallel to an axis, and state the slope of horizontal and vertical lines.",
);
export const systemEquationChoiceTemplate = make(
  "system-equation-choice",
  "Write a system from a table, graph or story",
  "systems-modeling",
  0.35,
  "Choose the system of two linear equations that matches a description, a pair of tables or a graph of two lines.",
  true,
);
export const graphEstimateSystemTemplate = make(
  "graph-estimate-system-solution",
  "Estimate a system's solution from a graph",
  "linear-systems",
  0.4,
  "Read two plotted lines in a real-world situation and estimate where they meet, including a crossing between grid lines.",
  true,
);
export const exponentialDomainRangeTemplate = make(
  "exponential-domain-range",
  "Domain and range of an exponential function",
  "exponential-models",
  0.4,
  "Choose the domain and range of an exponential function or growth and decay model, written as inequalities.",
);
export const absoluteValueFormulateTemplate = make(
  "absolute-value-equation-formulate",
  "Write an absolute value equation from a situation",
  "absolute-value-equations",
  0.3,
  "Choose the absolute value equation for numbers a given distance from a point, for two given solutions, or for a measurement that differs from a target by a fixed amount.",
);
export const rationalEquationFormulateTemplate = make(
  "rational-equation-formulate",
  "Write a rational equation from a situation",
  "rational-equations",
  0.45,
  "Choose the rational equation that models a work-together, current-speed or two-speed travel situation.",
);
export const rationalExponentEquationTemplate = make(
  "rational-exponent-equation",
  "Solve an equation with a rational exponent",
  "rational-exponents",
  0.4,
  "Solve x^(p/q) = k by raising both sides to the reciprocal power, with the sign and domain cases the exponent creates.",
);
export const transformationCompositionTemplate = make(
  "transformation-composition-image",
  "Image under a rigid motion and a dilation",
  "rigid-motions",
  0.5,
  "Find the image of a point after a translation, reflection or rotation and a dilation with a center other than the origin, in either order.",
);
export const counterexampleChoiceTemplate = make(
  "counterexample-choice",
  "Choose a counterexample",
  "geometric-proof",
  0.4,
  "Choose the case that makes a geometric conjecture's hypothesis true and its conclusion false.",
);
export const sphericalGeometryTemplate = make(
  "spherical-geometry-compare",
  "Euclidean and spherical geometry",
  "geometric-definitions",
  0.4,
  "State how parallel lines, triangle angle sums, right angles and shortest paths differ on a sphere from the plane.",
);
export const regularPolygonAreaTemplate = make(
  "regular-polygon-area",
  "Area of a regular polygon",
  "geometric-modeling",
  0.4,
  "Find the area of a regular polygon from its apothem and perimeter, from a hexagon's side, or find a missing apothem.",
);
export const curvedSolidSurfaceTemplate = make(
  "curved-solid-surface-area",
  "Surface area of cones and composite solids",
  "geometric-modeling",
  0.5,
  "Find the surface area of a cone, or of a cylinder joined to a hemisphere or a cone, counting only the exposed surfaces.",
);
export const areaProbabilityTemplate = make(
  "area-probability",
  "Probability from area",
  "conditional-probability",
  0.35,
  "Find the probability that a point chosen at random in a region lands in a part of it, as a ratio of areas.",
);
export const compositionOrderTemplate = make(
  "composition-order-choice",
  "Does the order of composition matter?",
  "function-composition",
  0.4,
  "Compare $f(g(x))$ with $g(f(x))$ for given functions and decide whether they are equal.",
);
export const oneSidedBehaviorTemplate = make(
  "one-sided-behavior-choice",
  "Behavior on each side of a discontinuity",
  "rational-function-behavior",
  0.55,
  "Describe what $f(x)$ approaches from the left and from the right of a vertical asymptote, a hole or a jump.",
);
export const parametricRectangularTemplate = make(
  "parametric-rectangular-convert",
  "Convert parametric equations to a rectangular relation",
  "parametric-models",
  0.5,
  "Eliminate the parameter from linear, parabolic and circular parametric equations, or write a line parametrically.",
);
export const angularVelocityTemplate = make(
  "angular-velocity-problem",
  "Angular and linear velocity",
  "radians-unit-circle",
  0.5,
  "Find angular speed, linear speed or distance traveled for a point on a rotating wheel.",
);
export const referenceAngleTemplate = make(
  "reference-angle-standard-position",
  "Reference angles and standard position",
  "radians-unit-circle",
  0.35,
  "Find the reference angle, quadrant or coterminal angle of an angle in standard position, including negative angles and angles beyond one turn.",
);
export const bearingTrigTemplate = make(
  "bearing-trig-problem",
  "Directional bearings",
  "right-triangle-trigonometry",
  0.45,
  "Resolve a travel distance on a compass bearing into north-south and east-west components, or find the bearing from the two components.",
);
export const sigmaNotationTemplate = make(
  "sigma-notation-represent",
  "Write a series in sigma notation",
  "sequence-sums",
  0.45,
  "Choose the sigma notation that represents an arithmetic or geometric series listed by its first and last terms.",
);
export const infiniteGeometricTemplate = make(
  "infinite-geometric-sum",
  "Sum of an infinite geometric series",
  "sequence-sums",
  0.5,
  "Find the sum of an infinite geometric series when it exists, and recognize when the ratio is too large for a sum.",
);
export const polynomialInequalityTemplate = make(
  "polynomial-inequality-solve",
  "Solve a polynomial inequality",
  "polynomial-zeros",
  0.55,
  "Choose the interval-notation solution of a polynomial inequality from its factored or factorable form, including repeated roots and non-strict inequalities.",
);
export const rationalInequalityTemplate = make(
  "rational-inequality-solve",
  "Solve a rational inequality",
  "rational-expressions",
  0.6,
  "Choose the interval-notation solution of a rational inequality, excluding values that make the denominator zero.",
);

export const texasHsTemplates: readonly TemplateMetadata[] = [
  lineEquationFormsTemplate,
  lineRelationshipEquationsTemplate,
  systemEquationChoiceTemplate,
  graphEstimateSystemTemplate,
  exponentialDomainRangeTemplate,
  absoluteValueFormulateTemplate,
  rationalEquationFormulateTemplate,
  rationalExponentEquationTemplate,
  transformationCompositionTemplate,
  counterexampleChoiceTemplate,
  sphericalGeometryTemplate,
  regularPolygonAreaTemplate,
  curvedSolidSurfaceTemplate,
  areaProbabilityTemplate,
  compositionOrderTemplate,
  oneSidedBehaviorTemplate,
  parametricRectangularTemplate,
  angularVelocityTemplate,
  referenceAngleTemplate,
  bearingTrigTemplate,
  sigmaNotationTemplate,
  infiniteGeometricTemplate,
  polynomialInequalityTemplate,
  rationalInequalityTemplate,
];

// ---------------------------------------------------------------------------
// Shared case plumbing
// ---------------------------------------------------------------------------

type Wrong = { label: string; feedback: string; key?: string };
type Spec = {
  prompt: string;
  hint: string;
  explanation: string[];
  correct: string;
  /** Identity of the correct choice when different labels can name one answer. */
  key?: string;
  wrong: Wrong[];
  scene?: Scene;
  variant: string;
};
export type TexasHsCase = {
  variant: string;
  correctLabel: string;
  problem: GeneratedProblem;
};

function finish(meta: TemplateMetadata, seed: string, r: Random, spec: Spec) {
  const seen = new Set([spec.key ?? spec.correct]);
  const wrong = spec.wrong.filter((w) => {
    const k = w.key ?? w.label;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (wrong.length < 3)
    throw new Error(
      `Insufficient distinct choices for ${meta.id}/${spec.variant}: ${spec.prompt} || ${wrong.map((w) => w.label).join(" | ")}`,
    );
  return {
    variant: spec.variant,
    correctLabel: spec.correct,
    problem: assemble(meta, seed, r, {
      prompt: spec.prompt,
      ...(spec.scene
        ? { figure: { kind: "scene" as const, scene: spec.scene } }
        : {}),
      answer: "",
      hint: spec.hint,
      explanation: spec.explanation,
      choices: [
        { label: spec.correct, correct: true as const },
        ...wrong
          .slice(0, 3)
          .map(({ label, feedback }) => ({ label, feedback })),
      ],
    }),
  };
}

function begin(meta: TemplateMetadata, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return random(meta.id, seed);
}

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
/** A number inside a larger expression: negative values need parentheses, positive ones never do. */
const par = (v: number) => (v < 0 ? `(${v})` : `${v}`);
const nonzeroIn = (r: Random, lo: number, hi: number) => {
  let v = 0;
  while (v === 0) v = r(lo, hi);
  return v;
};
const tex = (s: string) => `$${s}$`;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** "+ 3" or "- 3" after a variable. */
const plus = (v: number) => (v < 0 ? `- ${-v}` : `+ ${v}`);
/** "- 3" for subtracting v, so the point coordinate -3 reads "+ 3". */
const minus = (v: number) => (v < 0 ? `+ ${-v}` : `- ${v}`);

type Q = { n: number; d: number };
const q = (n: number, d = 1): Q => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
const qMul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const qSub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const qAdd = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const qNeg = (a: Q) => q(-a.n, a.d);
const qInv = (a: Q) => q(a.d, a.n);
const qKey = (a: Q) => `${a.n}/${a.d}`;
const qAbsTex = (a: Q) =>
  a.d === 1 ? `${Math.abs(a.n)}` : `\\frac{${Math.abs(a.n)}}{${a.d}}`;
const qTex = (a: Q) => `${a.n < 0 ? "-" : ""}${qAbsTex(a)}`;
const qPar = (a: Q) => (a.n < 0 ? `(${qTex(a)})` : qTex(a));

/** y = mx + b, with unit and zero terms omitted. */
function slopeIntercept(m: Q, b: Q): string {
  let s = "";
  if (m.n !== 0) {
    const mag = Math.abs(m.n) === 1 && m.d === 1 ? "" : qAbsTex(m);
    s = `${m.n < 0 ? "-" : ""}${mag}x`;
  }
  if (b.n !== 0) s += s ? ` ${b.n < 0 ? "-" : "+"} ${qAbsTex(b)}` : qTex(b);
  return `y=${s || "0"}`;
}
const lineKey = (m: Q, b: Q) => `${qKey(m)}|${qKey(b)}`;
/** The y-intercept of the line with slope m through (x, y). */
const interceptThrough = (m: Q, x: number, y: number) =>
  qSub(q(y), qMul(m, q(x)));
/** y - y1 = m(x - x1). */
function pointSlope(m: Q, x1: number, y1: number): string {
  const slope =
    m.d === 1 && m.n === 1
      ? ""
      : m.d === 1 && m.n === -1
        ? "-"
        : m.n < 0
          ? `-${qAbsTex(m)}`
          : qAbsTex(m);
  const inner = `(x ${minus(x1)})`;
  return `y ${minus(y1)}=${slope === "" ? `x ${minus(x1)}` : `${slope}${inner}`}`;
}
/** Ax + By = C with integer coefficients, reduced and A > 0 (or B > 0 when A = 0). */
function standardForm(a: number, b: number, c: number) {
  const g = gcd(gcd(a, b), c) || 1;
  [a, b, c] = [a / g, b / g, c / g];
  if (a < 0 || (a === 0 && b < 0)) [a, b, c] = [-a, -b, -c];
  const term = (k: number, v: string, first: boolean) => {
    if (k === 0) return "";
    const mag = Math.abs(k) === 1 ? "" : `${Math.abs(k)}`;
    return first
      ? `${k < 0 ? "-" : ""}${mag}${v}`
      : ` ${k < 0 ? "-" : "+"} ${mag}${v}`;
  };
  const left = term(a, "x", true) + term(b, "y", a === 0);
  return { key: `${a},${b},${c}`, text: `${left}=${c}` };
}

// ---------------------------------------------------------------------------
// Linear equations in a requested form
// ---------------------------------------------------------------------------

export function lineEquationFormsCase(seed: string): TexasHsCase {
  const meta = lineEquationFormsTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 5);
  const bigSlope = () => pick(r, [-5, -4, -3, -2, 2, 3, 4, 5]);
  if (variant === 0 || variant === 1) {
    // A point and a slope.
    const m = q(bigSlope());
    const x1 = nonzeroIn(r, -6, 6);
    const y1 = nonzeroIn(r, -6, 6);
    const b = interceptThrough(m, x1, y1);
    if (b.n === 0) return lineEquationFormsCase(`${seed}~`);
    const given = `The line passes through $(${x1}, ${y1})$ and has slope $${m.n}$.`;
    if (variant === 0) {
      const ps = (mm: Q, a: number, c: number) => ({
        label: tex(pointSlope(mm, a, c)),
        key: lineKey(mm, interceptThrough(mm, a, c)),
      });
      const right = ps(m, x1, y1);
      return finish(meta, seed, r, {
        variant: "point-slope",
        prompt: `${given} Which equation is in point-slope form, $y-y_1=m(x-x_1)$, for this line?`,
        hint: `In $y-y_1=m(x-x_1)$ the point is $(x_1, y_1)=(${x1}, ${y1})$ and the slope is $m=${m.n}$. Subtract each coordinate from its own variable.`,
        explanation: [
          `Point-slope form is $y-y_1=m(x-x_1)$ with $(x_1, y_1)=(${x1}, ${y1})$ and $m=${m.n}$.`,
          `Subtract the $y$-coordinate from $y$: $y ${minus(y1)}$. Subtract the $x$-coordinate from $x$: $x ${minus(x1)}$.`,
          `The equation is ${right.label}.`,
        ],
        correct: right.label,
        key: right.key,
        wrong: [
          {
            ...ps(m, -x1, y1),
            feedback: `The factor with $x$ subtracts the point's $x$-coordinate ${x1}, so it is $x ${minus(x1)}$. The sign of the $x$ term was changed.`,
          },
          {
            ...ps(m, x1, -y1),
            feedback: `The left side subtracts the point's $y$-coordinate ${y1}, so it is $y ${minus(y1)}$. The sign of the $y$ term was changed.`,
          },
          {
            ...ps(m, y1, x1),
            feedback: `The point is $(x, y)=(${x1}, ${y1})$: ${x1} belongs with $x$ and ${y1} belongs with $y$. The coordinates were swapped.`,
          },
          {
            label: tex(`y ${minus(y1)}=${m.n}x ${minus(x1)}`),
            key: lineKey(m, q(y1 - x1)),
            feedback: `The slope multiplies the whole factor $(x ${minus(x1)})$, not only $x$. Keep the parentheses.`,
          },
        ],
      });
    }
    const si = (mm: Q, bb: Q) => ({
      label: tex(slopeIntercept(mm, bb)),
      key: lineKey(mm, bb),
    });
    const right = si(m, b);
    return finish(meta, seed, r, {
      variant: "slope-intercept-from-point",
      prompt: `${given} Which equation of the line is in slope-intercept form, $y=mx+b$?`,
      hint: `Put $m=${m.n}$ into $y=mx+b$, then substitute $x=${x1}$ and $y=${y1}$ and solve for $b$.`,
      explanation: [
        `Start with $y=${m.n}x+b$ and substitute the point: $${y1}=${m.n}(${x1})+b$.`,
        `Multiply: $${y1}=${m.n * x1}+b$, so $b=${y1}-${par(m.n * x1)}=${b.n}$.`,
        `The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...si(m, q(y1 + m.n * x1)),
          feedback: `Solve $${y1}=${m.n * x1}+b$ by subtracting ${m.n * x1} from both sides: $b=${y1}-${par(m.n * x1)}$, not ${y1 + m.n * x1}.`,
        },
        {
          ...si(m, q(y1)),
          feedback: `The number ${y1} is the $y$-coordinate of the point, not the $y$-intercept. The intercept is where $x=0$; solve for $b$ with the point.`,
        },
        {
          ...si(m, q(-b.n)),
          feedback: `The sign of $b$ is reversed. Check by substituting the point: $${m.n}(${x1})+b$ must equal ${y1}.`,
        },
        {
          ...si(m, q(y1 - x1)),
          feedback: `Multiply the slope by the $x$-coordinate: $${m.n}\\cdot(${x1})=${m.n * x1}$, not ${x1}.`,
        },
      ],
    });
  }
  // Two points.
  const dx = r(1, 3);
  const x1 = r(-4, -1);
  const x2 = x1 + dx;
  if (variant === 2 || variant === 5) {
    const m = q(pick(r, [-4, -3, -2, 2, 3, 4]));
    const b = q(nonzeroIn(r, -6, 6));
    const y = (x: number) => m.n * x + b.n;
    const [y1, y2] = [y(x1), y(x2)];
    const pts = `$(${x1}, ${y1})$ and $(${x2}, ${y2})$`;
    const slopeStep = `$m=\\dfrac{${y2}-${par(y1)}}{${x2}-${par(x1)}}=\\dfrac{${y2 - y1}}{${dx}}=${m.n}$`;
    if (variant === 2) {
      const si = (mm: Q, bb: Q) => ({
        label: tex(slopeIntercept(mm, bb)),
        key: lineKey(mm, bb),
      });
      const right = si(m, b);
      return finish(meta, seed, r, {
        variant: "slope-intercept-from-two-points",
        prompt: `A line passes through ${pts}. Which equation of the line is in slope-intercept form?`,
        hint: `First find the slope: the change in $y$ from ${y1} to ${y2} divided by the change in $x$ from ${x1} to ${x2}. Then use one point to find $b$.`,
        explanation: [
          `The slope is ${slopeStep}.`,
          `Substitute $(${x1}, ${y1})$ into $y=${m.n}x+b$: $${y1}=${m.n * x1}+b$, so $b=${b.n}$.`,
          `The equation is ${right.label}.`,
        ],
        correct: right.label,
        key: right.key,
        wrong: [
          {
            ...si(q(1, m.n), b),
            feedback: `The slope is rise over run: ${y2 - y1} over ${dx}, not ${dx} over ${y2 - y1}.`,
          },
          {
            ...si(qNeg(m), b),
            feedback: `Subtract the coordinates in the same order for $y$ and $x$. Here that gives ${y2 - y1} over ${dx}, which is positive or negative as shown, not its opposite.`,
          },
          {
            ...si(m, q(y1)),
            feedback: `${y1} is the $y$-coordinate at $x=${x1}$, not the $y$-intercept. Solve $${y1}=${m.n}(${x1})+b$ for $b$.`,
          },
          {
            ...si(m, qNeg(b)),
            feedback: `The slope is right, but the intercept has the wrong sign. Check: $${m.n}(${x1})+b$ must equal ${y1}.`,
          },
        ],
      });
    }
    // Point-slope from two points, written with the first point.
    const useSecond = r(0, 1) === 1;
    const [px, py] = useSecond ? [x2, y2] : [x1, y1];
    const ps = (mm: Q) => ({
      label: tex(pointSlope(mm, px, py)),
      key: lineKey(mm, interceptThrough(mm, px, py)),
    });
    const right = ps(m);
    return finish(meta, seed, r, {
      variant: "point-slope-from-two-points",
      prompt: `A line passes through ${pts}. Which equation, written with the point $(${px}, ${py})$, is in point-slope form?`,
      hint: `Find the slope from the two points first: change in $y$ over change in $x$. Then put the slope and the point $(${px}, ${py})$ into $y-y_1=m(x-x_1)$.`,
      explanation: [
        `The slope is ${slopeStep}.`,
        `Use $(x_1, y_1)=(${px}, ${py})$ in $y-y_1=m(x-x_1)$.`,
        `The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...ps(q(1, m.n)),
          feedback: `The slope is the change in $y$ over the change in $x$: ${y2 - y1} over ${dx}.`,
        },
        {
          ...ps(qNeg(m)),
          feedback: `The slope has the wrong sign. Subtract $y$ and $x$ in the same order.`,
        },
        {
          ...ps(qNeg(q(1, m.n))),
          feedback: `That is the slope of a perpendicular line. This line's slope is ${y2 - y1} over ${dx}.`,
        },
        {
          label: tex(pointSlope(m, py, px)),
          key: lineKey(m, interceptThrough(m, py, px)),
          feedback: `The point is $(x, y)=(${px}, ${py})$; ${px} belongs with $x$ and ${py} belongs with $y$.`,
        },
      ],
    });
  }
  if (variant === 3) {
    // Standard form from two points.
    const px = r(-4, 4);
    const py = r(-4, 4);
    const rise = nonzeroIn(r, -5, 5);
    const run = r(1, 4);
    const [qx, qy] = [px + run, py + rise];
    const sf = (a: number, b: number) => {
      const s = standardForm(a, b, a * px + b * py);
      return { label: tex(s.text), key: s.key };
    };
    const right = sf(rise, -run);
    const a = rise;
    const b = -run;
    return finish(meta, seed, r, {
      variant: "standard-form-from-two-points",
      prompt: `A line passes through $(${px}, ${py})$ and $(${qx}, ${qy})$. Which equation is a standard form, $Ax+By=C$ with integer coefficients and no common factor, of this line?`,
      hint: `The change in $y$ is ${rise} and the change in $x$ is ${run}. A line through $(x_1, y_1)$ with these changes satisfies $${rise}(x-x_1)=${run}(y-y_1)$; collect $x$ and $y$ on the left.`,
      explanation: [
        `Going from the first point to the second, $y$ changes by ${qy}-${par(py)}=${rise} and $x$ changes by ${qx}-${par(px)}=${run}.`,
        `Every point $(x, y)$ on the line satisfies $${rise}(x ${minus(px)})=${run}(y ${minus(py)})$. Rearranging gives $${a}x ${plus(b)}y=${a * px + b * py}$ after moving $y$ terms to the left.`,
        `Divide by any common factor and make the $x$ coefficient positive: ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...sf(run, -rise),
          feedback: `The coefficient of $x$ is the change in $y$ (${rise}) and the coefficient of $y$ is the opposite of the change in $x$. Here they were exchanged.`,
        },
        {
          ...sf(rise, run),
          feedback: `Moving $y$ terms to the left changes the sign of the change in $x$. Check the second point in your equation.`,
        },
        {
          label: tex(standardForm(rise, -run, rise * px - run * -py).text),
          key: standardForm(rise, -run, rise * px - run * -py).key,
          feedback: `The constant $C$ is $A x_1+B y_1$ for a point on the line, with the point's own signs. Substitute $(${px}, ${py})$ to check.`,
        },
        {
          ...sf(-rise, -run),
          feedback: `The coefficients must give a slope of $\\frac{${rise}}{${run}}$ (rise over run), and these give its opposite. Substitute the second point to see that this equation fails.`,
        },
      ],
    });
  }
  // variant 4: slope-intercept with a fractional slope to standard form
  const den = pick(r, [2, 3, 4]);
  let num = nonzeroIn(r, -5, 5);
  while (gcd(num, den) !== 1) num = nonzeroIn(r, -5, 5);
  const b = nonzeroIn(r, -4, 4);
  const m = q(num, den);
  const sf = (a: number, bb: number, c: number) => {
    const s = standardForm(a, bb, c);
    return { label: tex(s.text), key: s.key };
  };
  const right = sf(-num, den, den * b);
  return finish(meta, seed, r, {
    variant: "standard-form-from-slope-intercept",
    prompt: `A line is $${slopeIntercept(m, q(b))}$. Which equation is an equivalent standard form, $Ax+By=C$ with integer coefficients and no common factor?`,
    hint: `Multiply every term by ${den} to clear the fraction, then move the $x$ term to the left side so the coefficient of $x$ is positive.`,
    explanation: [
      `Multiply both sides of $${slopeIntercept(m, q(b))}$ by ${den}: $${den}y=${num === 1 ? "" : num === -1 ? "-" : num}x ${plus(den * b)}$.`,
      `Move the $x$ term to the left side: $${-num === 1 ? "" : -num === -1 ? "-" : -num}x+${den}y=${den * b}$.`,
      `Make the leading coefficient positive: ${right.label}.`,
    ],
    correct: right.label,
    key: right.key,
    wrong: [
      {
        ...sf(-num, den, b),
        feedback: `Multiply the constant term by ${den} too: every term, including ${b}, is multiplied.`,
      },
      {
        ...sf(num, den, den * b),
        feedback: `Moving $${num}x$ to the left side changes its sign, so $x$ and $y$ end up with opposite signs when the slope is ${num > 0 ? "positive" : "negative"}.`,
      },
      {
        ...sf(-num, den, -den * b),
        feedback: `The constant keeps its sign when you multiply by ${den}: it becomes ${den * b}.`,
      },
      {
        ...sf(den, -num, -num * b),
        feedback: `The slope is ${num}/${den}, so $y$ is multiplied by ${den} and $x$ by ${num}, not the reverse.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Parallel, perpendicular and axis-parallel lines
// ---------------------------------------------------------------------------

export function lineRelationshipEquationsCase(seed: string): TexasHsCase {
  const meta = lineRelationshipEquationsTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 8);
  const si = (m: Q, b: Q) => ({
    label: tex(slopeIntercept(m, b)),
    key: lineKey(m, b),
  });
  if (variant <= 1) {
    // Given in slope-intercept form.
    const parallel = variant === 0;
    const mag = parallel ? nonzeroIn(r, -5, 5) : pick(r, [2, 3, 4, -2, -3, -4]);
    const m = q(mag);
    const c = nonzeroIn(r, -6, 6);
    const target = parallel ? m : q(-1, mag);
    const x1 = parallel ? nonzeroIn(r, -5, 5) : mag * nonzeroIn(r, -2, 2);
    const y1 = nonzeroIn(r, -6, 6);
    if (x1 === 0 || (parallel && y1 === m.n * x1 + c))
      return lineRelationshipEquationsCase(`${seed}~`);
    const b = interceptThrough(target, x1, y1);
    const right = si(target, b);
    const given = `$${slopeIntercept(m, q(c))}$`;
    const wrong: Wrong[] = parallel
      ? [
          {
            ...si(qNeg(qInv(m)), interceptThrough(qNeg(qInv(m)), x1, y1)),
            feedback: `That line is perpendicular to the given line. Parallel lines have the same slope ${m.n}.`,
          },
          {
            ...si(m, q(c)),
            feedback: `That is the given line itself. The new line has the same slope but must pass through $(${x1}, ${y1})$, which changes the intercept.`,
          },
          {
            ...si(m, q(y1)),
            feedback: `${y1} is the $y$-coordinate of the point, not the intercept. Substitute $(${x1}, ${y1})$ to find $b$.`,
          },
          {
            ...si(m, q(y1 + m.n * x1)),
            feedback: `Solve $${y1}=${m.n}(${x1})+b$ for $b$ by subtracting ${m.n * x1} from both sides.`,
          },
        ]
      : [
          {
            ...si(m, interceptThrough(m, x1, y1)),
            feedback: `That line has the same slope ${m.n} as the given line, so it is parallel, not perpendicular.`,
          },
          {
            ...si(qNeg(m), interceptThrough(qNeg(m), x1, y1)),
            feedback: `A perpendicular slope is the negative reciprocal. Changing only the sign gives ${-m.n}; also flip the number upside down.`,
          },
          {
            ...si(q(1, mag), interceptThrough(q(1, mag), x1, y1)),
            feedback: `The reciprocal ${qTex(q(1, mag))} has the wrong sign. A perpendicular slope is the negative reciprocal.`,
          },
          {
            ...si(target, q(y1)),
            feedback: `${y1} is the point's $y$-coordinate, not the intercept. Substitute $(${x1}, ${y1})$ into $y=${qTex(target)}x+b$.`,
          },
        ];
    return finish(meta, seed, r, {
      variant: parallel
        ? "parallel-slope-intercept"
        : "perpendicular-slope-intercept",
      prompt: `Which equation is the line through $(${x1}, ${y1})$ that is ${parallel ? "parallel" : "perpendicular"} to ${given}?`,
      hint: parallel
        ? `Parallel lines have equal slopes. Use the slope ${m.n} of ${given}, then substitute the point to find the intercept.`
        : `Perpendicular lines have slopes whose product is $-1$. Take the negative reciprocal of ${m.n}, then substitute the point to find the intercept.`,
      explanation: [
        parallel
          ? `Parallel lines have the same slope, so the slope is ${m.n}.`
          : `Perpendicular slopes multiply to $-1$, so the slope is the negative reciprocal of ${m.n}, which is $${qTex(target)}$.`,
        `Substitute $(${x1}, ${y1})$ into $y=${qTex(target)}x+b$: $b=${y1}-${qPar(target)}\\cdot${par(x1)}=${qTex(b)}$.`,
        `The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong,
    });
  }
  if (variant <= 3) {
    // Given in standard form Ax + By = C.
    const parallel = variant === 2;
    let a = nonzeroIn(r, -5, 5);
    const bb = pick(r, [2, 3, 4, 5]);
    while (gcd(a, bb) !== 1 || Math.abs(a) === bb) a = nonzeroIn(r, -5, 5);
    const slope = q(-a, bb);
    const target = parallel ? slope : qNeg(qInv(slope));
    const step = parallel ? bb : Math.abs(a);
    const x1 = step * nonzeroIn(r, -2, 2);
    const y1 = nonzeroIn(r, -6, 6);
    const cc = nonzeroIn(r, -6, 6);
    if (parallel && a * x1 + bb * y1 === cc)
      return lineRelationshipEquationsCase(`${seed}~`);
    const given = standardForm(a, bb, cc);
    const b = interceptThrough(target, x1, y1);
    const right = si(target, b);
    const alt = (s: Q) => si(s, interceptThrough(s, x1, y1));
    const wrong: Wrong[] = parallel
      ? [
          {
            ...alt(qNeg(slope)),
            feedback: `Solve $${given.text}$ for $y$: the slope is $-A/B$, not $A/B$. Mind the sign.`,
          },
          {
            ...alt(qInv(slope)),
            feedback: `The slope of $Ax+By=C$ is $-A/B$, the coefficient of $x$ over the coefficient of $y$, not the reverse.`,
          },
          {
            ...alt(qNeg(qInv(slope))),
            feedback: `That is the slope of a perpendicular line. A parallel line has the same slope as the given line.`,
          },
          {
            ...si(slope, q(y1)),
            feedback: `${y1} is the $y$-coordinate of the point, not the intercept. Substitute the point to find $b$.`,
          },
        ]
      : [
          {
            ...alt(slope),
            feedback: `That line has the same slope as the given line, so it is parallel. A perpendicular slope is the negative reciprocal.`,
          },
          {
            ...alt(qNeg(qInv(target))),
            feedback: `That slope is the reciprocal of the correct one with the wrong sign. The given line's slope is $-A/B$; its negative reciprocal is $B/A$.`,
          },
          {
            ...alt(qNeg(target)),
            feedback: `Reversing only the sign of the perpendicular slope gives the reciprocal's opposite. Start from the given slope $-A/B$.`,
          },
          {
            ...si(target, q(y1)),
            feedback: `${y1} is the $y$-coordinate of the point, not the intercept. Substitute the point to find $b$.`,
          },
        ];
    return finish(meta, seed, r, {
      variant: parallel
        ? "parallel-standard-form"
        : "perpendicular-standard-form",
      prompt: `Which equation is the line through $(${x1}, ${y1})$ that is ${parallel ? "parallel" : "perpendicular"} to $${given.text}$?`,
      hint: `First solve $${given.text}$ for $y$ to read its slope: it is $-A/B$. ${parallel ? "A parallel line uses the same slope." : "A perpendicular line uses the negative reciprocal."} Then substitute the point to find $b$.`,
      explanation: [
        `Solving for $y$ gives slope $-\\dfrac{${a}}{${bb}}=${qTex(slope)}$.`,
        parallel
          ? `A parallel line has the same slope, $${qTex(target)}$.`
          : `A perpendicular line has the negative reciprocal slope, $${qTex(target)}$.`,
        `Substitute $(${x1}, ${y1})$: $b=${y1}-${qPar(target)}\\cdot${par(x1)}=${qTex(b)}$. The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong,
    });
  }
  const a = nonzeroIn(r, -7, 7);
  let bv = nonzeroIn(r, -7, 7);
  while (bv === a) bv = nonzeroIn(r, -7, 7);
  const eqY = (v: number) => ({ label: tex(`y=${v}`) });
  const eqX = (v: number) => ({ label: tex(`x=${v}`) });
  if (variant === 4 || variant === 5) {
    const horizontal = variant === 4;
    const right = horizontal ? eqY(bv) : eqX(a);
    return finish(meta, seed, r, {
      variant: horizontal
        ? "horizontal-through-point"
        : "vertical-through-point",
      prompt: `Which equation describes the ${horizontal ? "horizontal" : "vertical"} line through $(${a}, ${bv})$?`,
      hint: horizontal
        ? `Every point on a horizontal line has the same $y$-coordinate. Look at the $y$-coordinate of $(${a}, ${bv})$.`
        : `Every point on a vertical line has the same $x$-coordinate. Look at the $x$-coordinate of $(${a}, ${bv})$.`,
      explanation: horizontal
        ? [
            `A horizontal line does not rise or fall, so every point on it has the same $y$-coordinate.`,
            `The point $(${a}, ${bv})$ has $y=${bv}$, so every point on the line has $y=${bv}$.`,
            `The equation is ${right.label}; the slope is 0.`,
          ]
        : [
            `A vertical line does not move left or right, so every point on it has the same $x$-coordinate.`,
            `The point $(${a}, ${bv})$ has $x=${a}$, so every point on the line has $x=${a}$.`,
            `The equation is ${right.label}; the slope is undefined because the run is 0.`,
          ],
      correct: right.label,
      wrong: horizontal
        ? [
            {
              ...eqX(a),
              feedback: `$x=${a}$ is the vertical line through the point. A horizontal line holds $y$ fixed.`,
            },
            {
              ...eqY(a),
              feedback: `${a} is the point's $x$-coordinate. The fixed value of a horizontal line is the $y$-coordinate, ${bv}.`,
            },
            {
              ...eqX(bv),
              feedback: `${bv} is the point's $y$-coordinate and $x=${bv}$ is vertical. A horizontal line is written $y=\\text{constant}$.`,
            },
            {
              label: tex(`y=${bv}x`),
              feedback: `$y=${bv}x$ is a slanted line through the origin; it does not pass through $(${a}, ${bv})$.`,
            },
          ]
        : [
            {
              ...eqY(bv),
              feedback: `$y=${bv}$ is the horizontal line through the point. A vertical line holds $x$ fixed.`,
            },
            {
              ...eqX(bv),
              feedback: `${bv} is the point's $y$-coordinate. The fixed value of a vertical line is the $x$-coordinate, ${a}.`,
            },
            {
              ...eqY(a),
              feedback: `${a} is the point's $x$-coordinate and $y=${a}$ is horizontal. A vertical line is written $x=\\text{constant}$.`,
            },
            {
              label: tex(`x=${a}y`),
              feedback: `$x=${a}y$ is a slanted line through the origin; it does not pass through $(${a}, ${bv})$.`,
            },
          ],
    });
  }
  if (variant === 6) {
    const c = pick(r, [2, 3, 4, 5, 6, 7, -2, -3, -4, -5]);
    const vertical = r(0, 1) === 1;
    const word = (z: string) => `The slope is ${z}`;
    const rightLabel = vertical ? word("undefined") : word("$0$");
    const oppositeLabel = vertical ? word("$0$") : word("undefined");
    return finish(meta, seed, r, {
      variant: vertical ? "slope-of-vertical" : "slope-of-horizontal",
      prompt: `What is the slope of the line $${vertical ? "x" : "y"}=${c}$?`,
      hint: vertical
        ? `Pick two points on $x=${c}$ and compute rise over run. What is the run between two points with the same $x$-coordinate?`
        : `Pick two points on $y=${c}$ and compute rise over run. What is the rise between two points with the same $y$-coordinate?`,
      explanation: vertical
        ? [
            `Two points on $x=${c}$ are $(${c}, 0)$ and $(${c}, 1)$. The rise is $1-0=1$ and the run is $${c}-${par(c)}=0$.`,
            `Slope is rise over run, $\\dfrac{1}{0}$, and division by zero is undefined.`,
            `A vertical line has an undefined slope.`,
          ]
        : [
            `Two points on $y=${c}$ are $(0, ${c})$ and $(1, ${c})$. The rise is $${c}-${par(c)}=0$ and the run is $1-0=1$.`,
            `Slope is rise over run, $\\dfrac{0}{1}=0$.`,
            `A horizontal line has slope 0.`,
          ],
      correct: rightLabel,
      wrong: [
        {
          label: oppositeLabel,
          feedback: vertical
            ? `Slope 0 is a horizontal line. On $x=${c}$ the run is 0, which makes the slope undefined, not 0.`
            : `An undefined slope is a vertical line. On $y=${c}$ the rise is 0, so the slope is 0.`,
        },
        {
          label: word(`$${c}$`),
          feedback: `The number ${c} is where the line crosses an axis, not its slope. Slope is rise over run.`,
        },
        {
          label: word(`$${-c}$`),
          feedback: `The constant ${c} is not the slope, and neither is its opposite. Slope is rise over run between two points of the line.`,
        },
      ],
    });
  }
  // variants 7-8: parallel or perpendicular to an axis-parallel line
  const k = nonzeroIn(r, -6, 6);
  if (k === a || k === bv) return lineRelationshipEquationsCase(`${seed}~`);
  const givenHorizontal = variant === 7;
  const parallel = r(0, 1) === 1;
  const resultHorizontal = givenHorizontal === parallel;
  const ans = resultHorizontal ? eqY(bv) : eqX(a);
  const nearly = resultHorizontal ? eqX(a) : eqY(bv);
  const given = givenHorizontal ? `y=${k}` : `x=${k}`;
  return finish(meta, seed, r, {
    variant: "axis-parallel-relationship",
    prompt: `Which equation is the line through $(${a}, ${bv})$ that is ${parallel ? "parallel" : "perpendicular"} to $${given}$?`,
    hint: `The line $${given}$ is ${givenHorizontal ? "horizontal" : "vertical"}. A ${parallel ? "parallel" : "perpendicular"} line is ${resultHorizontal ? "horizontal" : "vertical"}, so one coordinate of $(${a}, ${bv})$ stays fixed.`,
    explanation: [
      `$${given}$ is a ${givenHorizontal ? "horizontal" : "vertical"} line.`,
      `A ${parallel ? "parallel" : "perpendicular"} line to it is ${resultHorizontal ? "horizontal" : "vertical"}${parallel ? "" : ", since lines perpendicular to a horizontal line are vertical and the reverse"}.`,
      `A ${resultHorizontal ? "horizontal" : "vertical"} line through $(${a}, ${bv})$ holds ${resultHorizontal ? `$y=${bv}$` : `$x=${a}$`}. The equation is ${ans.label}.`,
    ],
    correct: ans.label,
    wrong: [
      {
        ...nearly,
        feedback: `That line has the other orientation through the point. Decide first whether the new line is horizontal or vertical.`,
      },
      {
        label: tex(given),
        feedback: `That is the given line itself; it does not pass through $(${a}, ${bv})$.`,
      },
      {
        label: tex(resultHorizontal ? `y=${a}` : `x=${bv}`),
        feedback: `Use the coordinate that stays fixed: the ${resultHorizontal ? "$y$" : "$x$"}-coordinate of the point is ${resultHorizontal ? bv : a}.`,
      },
      {
        label: tex(givenHorizontal ? `x=${k}` : `y=${k}`),
        feedback: `That line is not through $(${a}, ${bv})$ and has the other orientation than the given line.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Systems of two linear equations
// ---------------------------------------------------------------------------

const eq = (m: number, b: number) =>
  `y=${m === 1 ? "" : m === -1 ? "-" : m}x${b === 0 ? "" : ` ${plus(b)}`}`;
const systemLabel = (a: [number, number], b: [number, number]) => ({
  label: `${tex(eq(...a))} and ${tex(eq(...b))}`,
  key: [eq(...a), eq(...b)].sort().join("|"),
});

export function systemEquationChoiceCase(seed: string): TexasHsCase {
  const meta = systemEquationChoiceTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  if (variant === 3) {
    // Two unknown counts: a total and a value.
    const total = r(20, 60);
    const adult = pick(r, [6, 7, 8, 9, 10, 12]);
    const child = pick(
      r,
      [3, 4, 5].filter((c) => c < adult),
    );
    const adults = r(5, total - 5);
    const money = adult * adults + child * (total - adults);
    const lbl = (
      c1: number,
      c2: number,
      c3: number,
      c4: number,
      t: number,
      m: number,
    ) => {
      const text = `x+y=${t}\\text{ and }${c3}x+${c4}y=${m}`;
      void c1;
      void c2;
      return { label: tex(text), key: text };
    };
    const right = lbl(1, 1, adult, child, total, money);
    return finish(meta, seed, r, {
      variant: "system-from-counts",
      prompt: `A theater sold ${total} tickets for ${money} dollars. Adult tickets cost ${adult} dollars and child tickets cost ${child} dollars. Let $x$ be the number of adult tickets and $y$ the number of child tickets. Which system models the sales?`,
      hint: `Write one equation for the ${total} tickets and one for the ${money} dollars. In the money equation each ticket count is multiplied by that ticket's price, ${adult} dollars or ${child} dollars.`,
      explanation: [
        `The tickets sold add to ${total}: $x+y=${total}$.`,
        `The money from adult tickets is ${adult} dollars times $x$ and from child tickets is ${child} dollars times $y$, totaling ${money}: $${adult}x+${child}y=${money}$.`,
        `The system is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...lbl(1, 1, child, adult, total, money),
          feedback: `Each count is multiplied by its own price: adults pay ${adult} dollars, so $x$ goes with ${adult}.`,
        },
        {
          ...lbl(1, 1, adult, child, money, total),
          feedback: `The total number of tickets is ${total} and the total money is ${money}; the two totals were exchanged.`,
        },
        {
          label: tex(`x-y=${total}\\text{ and }${adult}x+${child}y=${money}`),
          key: "difference-eq",
          feedback: `The tickets sold add: the first equation must be $x+y=${total}$, not a difference.`,
        },
        {
          label: tex(`x+y=${total}\\text{ and }x+y=${money}`),
          key: "both-count",
          feedback: `Both equations count tickets. The second equation must add the money, using each ticket's price.`,
        },
      ],
    });
  }
  const m1 = r(2, 9);
  let m2 = r(2, 9);
  while (m2 === m1) m2 = r(2, 9);
  const b1 = r(2, 20);
  let b2 = r(2, 20);
  while (b2 === b1 || b2 === m1 || b2 === m2) b2 = r(2, 20);
  if (b1 === m1 || b1 === m2) return systemEquationChoiceCase(`${seed}~`);
  const right = systemLabel([m1, b1], [m2, b2]);
  const swapOne = systemLabel([b1, m1], [m2, b2]);
  const swapOther = systemLabel([m1, b1], [b2, m2]);
  const crossed = systemLabel([m1, b2], [m2, b1]);
  const bothSwapped = systemLabel([b1, m1], [b2, m2]);
  const wrongSet = (swapFeedback: string, crossFeedback: string): Wrong[] => [
    { ...swapOne, feedback: swapFeedback.replace("%", "A") },
    { ...swapOther, feedback: swapFeedback.replace("%", "B") },
    { ...crossed, feedback: crossFeedback },
    { ...bothSwapped, feedback: swapFeedback.replace("%", "both plans") },
  ];
  if (variant === 0) {
    const names = pick(r, [
      ["Gym A", "Gym B", "visits", "a month's membership"],
      ["Plan A", "Plan B", "months", "the plan"],
    ] as const);
    return finish(meta, seed, r, {
      variant: "system-from-description",
      prompt: `${names[0]} charges a sign-up fee of ${b1} dollars plus ${m1} dollars for each of $x$ ${names[2]}. ${names[1]} charges a sign-up fee of ${b2} dollars plus ${m2} dollars for each of $x$ ${names[2]}. Let $y$ be the total cost. Which system models the two costs?`,
      hint: `Each cost is a fixed fee plus a rate times $x$: $y=(\\text{rate})x+(\\text{fee})$. Match the fee of ${b1} dollars and the rate of ${m1} dollars to ${names[0]}.`,
      explanation: [
        `Total cost is the one-time fee plus the rate times the number of ${names[2]}.`,
        `${names[0]}: $${eq(m1, b1)}$. ${names[1]}: $${eq(m2, b2)}$.`,
        `The system is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: wrongSet(
        `The rate per ${names[2] === "months" ? "month" : "visit"} multiplies $x$ and the fee is the constant. For % the two numbers were exchanged.`,
        `Each plan keeps its own fee and its own rate. Here a fee was paired with the other plan's rate.`,
      ),
    });
  }
  const x0 = r(0, 1);
  const xs = [0, 1, 2, 3].map((k) => k + x0);
  const rowA = xs.map((x) => `${m1 * x + b1}`);
  const rowB = xs.map((x) => `${m2 * x + b2}`);
  if (variant === 1) {
    const scene = lineTable(
      [
        ["x (weeks)", ...xs.map(String)],
        ["y, Plant A (cm)", ...rowA],
        ["y, Plant B (cm)", ...rowB],
      ],
      { header: "column", rules: "rows" },
    ).scene({ title: "Heights of two plants by week" });
    const atOne = (m: number, b: number) => m + b;
    const readIntercept = systemLabel([m1, atOne(m1, b1)], [m2, atOne(m2, b2)]);
    return finish(meta, seed, r, {
      variant: "system-from-tables",
      scene,
      prompt: `The table shows the height $y$ in centimeters of two plants $x$ weeks after the first measurement. Which system models both heights?`,
      hint: `Find how much each row increases when $x$ goes up by 1; that is the slope. Then use ${x0 === 0 ? "the value at $x=0$" : "the first value and the slope to work back to $x=0$"} for the constant.`,
      explanation: [
        `Plant A increases by ${m1} each week and Plant B by ${m2} each week, so the slopes are ${m1} and ${m2}.`,
        x0 === 0
          ? `At $x=0$ the heights are ${b1} and ${b2}, so these are the constants.`
          : `At $x=1$ the heights are ${m1 + b1} and ${m2 + b2}. Going back one week subtracts the slope, so the heights at $x=0$ are ${b1} and ${b2}.`,
        `The system is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...swapOne,
          feedback: `The change per week is the coefficient of $x$ and the value at $x=0$ is the constant. Plant A's two numbers were exchanged.`,
        },
        {
          ...swapOther,
          feedback: `The change per week is the coefficient of $x$ and the value at $x=0$ is the constant. Plant B's two numbers were exchanged.`,
        },
        {
          ...crossed,
          feedback: `Each plant keeps its own rate and its own starting height. These pair a rate with the other plant's height.`,
        },
        {
          ...readIntercept,
          feedback:
            x0 === 0
              ? `The constant is the value at $x=0$, not the value at $x=1$.`
              : `The first value in the table is at $x=1$, not $x=0$. Subtract one week's growth to get the constant.`,
        },
      ],
    });
  }
  // variant 2: graph
  const s1 = nonzeroIn(r, -3, 3);
  let s2 = nonzeroIn(r, -3, 3);
  while (s2 === s1) s2 = nonzeroIn(r, -3, 3);
  const c1 = nonzeroIn(r, -5, 5);
  let c2 = nonzeroIn(r, -5, 5);
  while (c2 === c1 || (c2 === s2 && c1 === s1)) c2 = nonzeroIn(r, -5, 5);
  const scene = graph({ id: "g", x: [-6, 6], y: [-8, 8], grid: 1, tick: 2 })
    .line({ m: s1, b: c1 }, { color: "accent" })
    .line({ m: s2, b: c2 }, { color: "warm" })
    .scene({ title: "Two lines" });
  const g = systemLabel([s1, c1], [s2, c2]);
  const flipSlope = systemLabel([-s1, c1], [s2, c2]);
  const flipSlope2 = systemLabel([s1, c1], [-s2, c2]);
  const flipIntercept = systemLabel([s1, -c1], [s2, c2]);
  const flipIntercept2 = systemLabel([s1, c1], [s2, -c2]);
  return finish(meta, seed, r, {
    variant: "system-from-graph",
    scene,
    prompt: `Which system of equations is graphed?`,
    hint: `For each line, read the $y$-intercept where it crosses the vertical axis, then count rise over run between two grid points to get its slope.`,
    explanation: [
      `The first line crosses the $y$-axis at ${c1} and has slope ${s1}: $${eq(s1, c1)}$.`,
      `The second line crosses the $y$-axis at ${c2} and has slope ${s2}: $${eq(s2, c2)}$.`,
      `The system is ${g.label}.`,
    ],
    correct: g.label,
    key: g.key,
    wrong: [
      {
        ...flipSlope,
        feedback: `One line's slope has the wrong sign. A line that rises as $x$ increases has a positive slope; one that falls has a negative slope.`,
      },
      {
        ...flipSlope2,
        feedback: `One line's slope has the wrong sign. Check whether each line rises or falls from left to right.`,
      },
      {
        ...flipIntercept,
        feedback: `One line's $y$-intercept has the wrong sign. Check whether it crosses the vertical axis above or below the origin.`,
      },
      {
        ...flipIntercept2,
        feedback: `One line's $y$-intercept has the wrong sign. Check whether it crosses the vertical axis above or below the origin.`,
      },
    ],
  });
}

export function graphEstimateSystemCase(seed: string): TexasHsCase {
  const meta = graphEstimateSystemTemplate;
  const r = begin(meta, seed);
  const half = r(0, 3) !== 0;
  const m2 = r(1, 2);
  const d = half ? 2 : 1;
  const m1 = m2 + d;
  const b1 = r(0, 4);
  const gap = half ? pick(r, [3, 5, 7]) : r(2, 5);
  const b2 = b1 + gap;
  // m1 x + b1 = m2 x + b2
  const x = gap / d;
  const y = m1 * x + b1;
  const fmt = (v: number) => (Number.isInteger(v) ? `${v}` : `${v}`);
  const ctx = pick(r, [
    {
      thing: "total cost in dollars",
      plan: "plans",
      unit: "months",
      a: "Plan A",
      b: "Plan B",
      t: "cost",
    },
    {
      thing: "total savings in dollars",
      plan: "accounts",
      unit: "weeks",
      a: "Account A",
      b: "Account B",
      t: "savings",
    },
  ]);
  const yMax = Math.ceil((m1 * 6 + b1) / 4) * 4 + 4;
  const scene = graph({ id: "g", x: [0, 6], y: [0, yMax], grid: 1, tick: 2 })
    .line({ m: m1, b: b1 }, { color: "accent", label: ctx.a })
    .line({ m: m2, b: b2 }, { color: "warm", label: ctx.b })
    .scene({
      title: `${ctx.thing[0]!.toUpperCase()}${ctx.thing.slice(1)} for two ${ctx.plan}`,
    });
  const pair = (px: number, py: number) => `(${fmt(px)}, ${fmt(py)})`;
  const right = pair(x, y);
  const nearest = pair(Math.round(x + 0.01), Math.round(y + 0.01));
  const labelOf = (p: string) => tex(p);
  return finish(meta, seed, r, {
    variant: half ? "crossing-between-gridlines" : "crossing-on-gridlines",
    scene,
    prompt: `The graph shows the ${ctx.thing} $y$ of ${ctx.a} and ${ctx.b} after $x$ ${ctx.unit}. Which ordered pair $(x, y)$ best estimates when the two ${ctx.t === "cost" ? "costs are" : "balances are"} equal and what that amount is?`,
    hint: `The two ${ctx.t === "cost" ? "costs" : "balances"} are equal where the lines for ${ctx.a} and ${ctx.b} cross. Find that crossing on the grid, then read its $x$ value on the horizontal axis and its $y$ value on the vertical axis.`,
    explanation: [
      `The lines cross at one point, and there both ${ctx.t === "cost" ? "costs" : "balances"} are equal.`,
      half
        ? `The crossing lies halfway between grid lines: $x=${fmt(x)}$ ${ctx.unit} and $y=${fmt(y)}$ dollars.`
        : `The crossing lies on grid lines: $x=${x}$ ${ctx.unit} and $y=${y}$ dollars.`,
      `The estimate is $${right}$. Check it in both lines: $${m1}(${fmt(x)})+${b1}=${fmt(y)}$ and $${m2}(${fmt(x)})+${b2}=${fmt(y)}$.`,
    ],
    correct: labelOf(right),
    wrong: [
      {
        label: labelOf(pair(y, x)),
        feedback: `The pair is $(x, y)$: the number of ${ctx.unit} comes first and the amount comes second.`,
      },
      ...(half
        ? [
            {
              label: labelOf(nearest),
              feedback: `The crossing is not on a grid intersection. Read between the grid lines instead of rounding to the nearest corner.`,
            },
          ]
        : [
            {
              label: labelOf(pair(x + 1, y + m1)),
              feedback: `That point is on Line A but one ${ctx.unit.slice(0, -1)} to the right of the crossing; Line B is not there.`,
            },
          ]),
      {
        label: labelOf(pair(0, b1)),
        feedback: `That is where ${ctx.a} starts, at $x=0$. The question asks where the two lines meet.`,
      },
      {
        label: labelOf(pair(0, b2)),
        feedback: `That is where ${ctx.b} starts, at $x=0$. The question asks where the two lines meet.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Exponential domain and range
// ---------------------------------------------------------------------------

export function exponentialDomainRangeCase(seed: string): TexasHsCase {
  const meta = exponentialDomainRangeTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const dr = (domain: string, range: string) => ({
    label: `Domain ${tex(domain)}; range ${tex(range)}`,
    key: `${domain}|${range}`,
  });
  const all = "-\\infty<x<\\infty";
  if (variant <= 1) {
    const reflected = variant === 1;
    const a = reflected ? -r(1, 4) : r(1, 4);
    const base = pick(r, [2, 3, 4, 5]);
    const k = nonzeroIn(r, -5, 5);
    const fn = `f(x)=${a === 1 ? "" : a === -1 ? "-" : a}\\left(${base}\\right)^x${k === 0 ? "" : ` ${plus(k)}`}`;
    const rangeOf = (below: boolean, strict: boolean) =>
      `y${below ? (strict ? "<" : "\\le") : strict ? ">" : "\\ge"}${k}`;
    const right = dr(all, rangeOf(reflected, true));
    return finish(meta, seed, r, {
      variant: reflected ? "reflected-exponential" : "shifted-exponential",
      prompt: `What are the domain and range of $${fn}$, written as inequalities?`,
      hint: `The term $${a < 0 ? "-" : ""}${Math.abs(a) === 1 ? "" : Math.abs(a)}\\left(${base}\\right)^x$ is never zero. Decide which side of 0 it stays on, then add the shift ${k} to find the boundary of the outputs.`,
      explanation: [
        `You can raise ${base} to any real power, so every $x$ is allowed: ${tex(all)}.`,
        `$${base}^x$ is always positive, so $${Math.abs(a) === 1 ? "" : Math.abs(a)}\\cdot${base}^x$ is positive and ${reflected ? `multiplying by ${a} makes it always negative` : "stays positive"}. It approaches 0 but never reaches it.`,
        `The outputs are shifted by ${k}, so ${reflected ? `$y<${k}$` : `$y>${k}$`}. The boundary $y=${k}$ is not reached, so the inequality is strict.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...dr(all, rangeOf(!reflected, true)),
          feedback: `The sign of ${a} decides whether the outputs lie above or below the boundary ${k}.`,
        },
        {
          ...dr(all, rangeOf(reflected, false)),
          feedback: `The function never equals ${k}, because the exponential part is never 0. The inequality is strict, with no "or equal to".`,
        },
        {
          ...dr("x>0", rangeOf(reflected, true)),
          feedback: `An exponential function accepts every real $x$. Only $y$ has a boundary; $x>0$ describes the domain of a logarithm.`,
        },
        {
          ...dr(all, `y${reflected ? "<" : ">"}0`),
          feedback: `The vertical shift of ${k} moves the boundary from 0 to ${k}. Use the horizontal asymptote $y=${k}$ as the boundary.`,
        },
      ],
    });
  }
  // contextual model with t >= 0
  const growth = variant === 2;
  const start = pick(r, [50, 100, 120, 200, 400]);
  const rate = growth ? pick(r, [1.5, 2, 3]) : pick(r, [0.5, 0.8, 0.9]);
  const word = growth
    ? pick(r, ["bacteria in a culture", "followers of an account"])
    : pick(r, [
        "milligrams of medicine in a patient",
        "dollars of value of a machine",
      ]);
  const model = `P(t)=${start}(${rate})^t`;
  const unitWord = word.startsWith("dollars") ? "years" : "hours";
  const right = growth
    ? dr("t\\ge0", `P\\ge${start}`)
    : dr("t\\ge0", `0<P\\le${start}`);
  return finish(meta, seed, r, {
    variant: growth ? "growth-model-domain" : "decay-model-domain",
    prompt: `The number of ${word} after $t$ ${unitWord} is modeled by $${model}$, where $t$ starts at 0 when the first count is made. What are the domain and range of this model, written as inequalities?`,
    hint: `Time cannot be negative here, so the domain is restricted. Find $P(0)$, then decide whether $P$ ${growth ? "increases" : "decreases"} from there and what it approaches.`,
    explanation: [
      `Time starts at $t=0$ and runs forward, so the domain is $t\\ge0$, not all real numbers.`,
      `At $t=0$, $P(0)=${start}$. Since the base ${rate} is ${growth ? "greater" : "less"} than 1, $P$ ${growth ? "grows without bound" : "decreases toward 0 but never reaches it"}.`,
      growth
        ? `So the outputs are all values $P\\ge${start}$, including the starting value.`
        : `So the outputs are $0<P\\le${start}$: the starting value is included, 0 is not.`,
    ],
    correct: right.label,
    key: right.key,
    wrong: growth
      ? [
          {
            ...dr(all, `P\\ge${start}`),
            feedback: `The model begins at $t=0$, so negative times are not part of the domain.`,
          },
          {
            ...dr("t\\ge0", `P>${start}`),
            feedback: `At $t=0$ the model equals ${start}, so ${start} is an output and the inequality includes it.`,
          },
          {
            ...dr("t\\ge0", "P>0"),
            feedback: `The outputs begin at the starting value ${start} and grow from there; they never fall below it.`,
          },
          {
            ...dr("t>0", `P\\ge${start}`),
            feedback: `The first count is made at $t=0$, so $t=0$ is allowed and the domain uses $\\ge$.`,
          },
        ]
      : [
          {
            ...dr(all, `0<P\\le${start}`),
            feedback: `The model begins at $t=0$, so negative times are not part of the domain.`,
          },
          {
            ...dr("t\\ge0", `0<P<${start}`),
            feedback: `At $t=0$ the model equals ${start}, so ${start} is an output and the inequality includes it.`,
          },
          {
            ...dr("t\\ge0", `P\\ge${start}`),
            feedback: `The base ${rate} is less than 1, so the quantity shrinks from ${start}; it does not grow above it.`,
          },
          {
            ...dr("t\\ge0", `0\\le P\\le${start}`),
            feedback: `The quantity gets close to 0 but never equals it, because ${rate}^t is never 0. The lower bound is strict.`,
          },
        ],
  });
}

// ---------------------------------------------------------------------------
// Absolute value equations from situations
// ---------------------------------------------------------------------------

const absShift = (c: number) => (c === 0 ? "x" : `x ${minus(c)}`);

export function absoluteValueFormulateCase(seed: string): TexasHsCase {
  const meta = absoluteValueFormulateTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 2);
  const lab = (inner: string, rhs: number | string) => ({
    label: tex(`\\left|${inner}\\right|=${rhs}`),
    key: `${inner}=${rhs}`,
  });
  if (variant === 1) {
    // Two given solutions: midpoint and half the distance.
    const mid = nonzeroIn(r, -8, 8);
    const half = r(2, 7);
    if (half === Math.abs(mid)) return absoluteValueFormulateCase(`${seed}~`);
    const lo = mid - half;
    const hi = mid + half;
    const right = lab(absShift(mid), half);
    return finish(meta, seed, r, {
      variant: "equation-from-solutions",
      prompt: `An absolute value equation has the two solutions $x=${lo}$ and $x=${hi}$. Which equation has exactly these solutions?`,
      hint: `The solutions are the same distance from a center on the number line. Find the midpoint of ${lo} and ${hi}, then the distance from the midpoint to either solution.`,
      explanation: [
        `The midpoint of ${lo} and ${hi} is $\\dfrac{${lo}+${par(hi)}}{2}=${mid}$.`,
        `Each solution is ${half} units from ${mid}.`,
        `Points that are ${half} units from ${mid} satisfy $|x-${par(mid)}|=${half}$. The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...lab(absShift(-mid), half),
          feedback: `The inner expression is $x$ minus the center. A center of ${mid} gives $x ${minus(mid)}$, not $x ${plus(mid)}$.`,
        },
        {
          ...lab(absShift(half), mid < 0 ? -mid : mid),
          feedback: `The center is the midpoint ${mid} and the distance is ${half}. They were exchanged.`,
          key: `${absShift(half)}=${Math.abs(mid)}`,
        },
        {
          ...lab("x", hi),
          feedback: `$|x|=${hi}$ has solutions $x=${hi}$ and $x=${-hi}$. The solutions ${lo} and ${hi} are centered at ${mid}, not 0.`,
        },
        {
          ...lab(absShift(mid), Math.abs(mid)),
          feedback: `The right side is the distance from the center to a solution, which is ${half}, not the center itself.`,
        },
      ],
    });
  }
  const c = nonzeroIn(r, -9, 9);
  const dist = r(2, 8);
  const right = lab(absShift(c), dist);
  const wrong = (extra: Wrong): Wrong[] => [
    {
      ...lab(absShift(-c), dist),
      feedback: `The distance from $x$ to ${c} is $|x-${par(c)}|$, which is $|${absShift(c)}|$. The sign of ${Math.abs(c)} was changed.`,
    },
    {
      ...lab(absShift(dist), Math.abs(c)),
      key: `${absShift(dist)}=${Math.abs(c)}`,
      feedback: `The center is ${c} and the distance is ${dist}. They were exchanged.`,
    },
    {
      label: tex(`${absShift(c)}=${dist}`),
      key: `plain`,
      feedback: `Without absolute value the equation has only the solution $x=${c + dist}$. A distance also allows the point ${dist} units on the other side, $x=${c - dist}$.`,
    },
    extra,
  ];
  if (variant === 0) {
    return finish(meta, seed, r, {
      variant: "distance-on-number-line",
      prompt: `Which equation describes all numbers $x$ that are exactly ${dist} units from ${c} on the number line?`,
      hint: `The distance between $x$ and ${c} is $|x-${par(c)}|$. Set that distance equal to ${dist}.`,
      explanation: [
        `The distance from $x$ to ${c} is $|x-${par(c)}|=|${absShift(c)}|$.`,
        `The distance is ${dist}, so $|${absShift(c)}|=${dist}$.`,
        `Its solutions are $x=${c + dist}$ and $x=${c - dist}$, one on each side of ${c}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: wrong({
        ...lab(absShift(c), -dist),
        key: `neg`,
        feedback: `A distance is never negative, so an absolute value cannot equal ${-dist}.`,
      }),
    });
  }
  const target = r(60, 90);
  const diff = r(3, 12);
  const things = pick(r, [
    {
      subj: "A classroom thermostat is set to",
      unit: "degrees",
      tail: "The room temperature $T$ differs from the setting by exactly",
      v: "T",
    },
    {
      subj: "A machine is set to cut boards",
      unit: "centimeters long",
      tail: "A board's length $L$ differs from the setting by exactly",
      v: "L",
    },
  ]);
  const t = target;
  const v = things.v;
  const labelV = (inner: string, rhs: number) => ({
    label: tex(`\\left|${inner}\\right|=${rhs}`),
    key: `${inner}=${rhs}`,
  });
  const inner = `${v} - ${t}`;
  const rightV = labelV(inner, diff);
  return finish(meta, seed, r, {
    variant: "tolerance-situation",
    prompt: `${things.subj} ${t} ${things.unit}. ${things.tail} ${diff} units. Which equation models this?`,
    hint: `"Differs from by exactly" means the distance between $${v}$ and ${t} is ${diff}. Write that distance with absolute value.`,
    explanation: [
      `The difference between $${v}$ and ${t} could be positive or negative, so use its absolute value: $|${inner}|$.`,
      `That distance equals ${diff}: ${rightV.label}.`,
      `Its solutions are $${v}=${t + diff}$ and $${v}=${t - diff}$.`,
    ],
    correct: rightV.label,
    key: rightV.key,
    wrong: [
      {
        ...labelV(`${v} + ${t}`, diff),
        feedback: `The difference is $${v}-${t}$. Adding ${t} measures something else.`,
      },
      {
        ...labelV(`${v} - ${diff}`, t),
        feedback: `The setting is ${t} and the difference is ${diff}. They were exchanged.`,
      },
      {
        label: tex(`${v} - ${t}=${diff}`),
        key: "plain",
        feedback: `Without absolute value only one value is possible, $${v}=${t + diff}$. The value could also be ${diff} below the setting.`,
      },
      {
        label: tex(`\\left|${inner}\\right|=${t + diff}`),
        key: "sum",
        feedback: `The right side is the allowed difference, ${diff}, not the largest possible value.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Rational equations from situations
// ---------------------------------------------------------------------------

export function rationalEquationFormulateCase(seed: string): TexasHsCase {
  const meta = rationalEquationFormulateTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 2);
  const lab = (text: string) => ({ label: tex(text), key: text });
  if (variant === 0) {
    const a = r(2, 9);
    let b = r(2, 9);
    while (b === a) b = r(2, 9);
    const worker = pick(r, [
      ["pipe", "fills", "pool"],
      ["painter", "paints", "fence"],
    ] as const);
    const right = lab(`\\frac{1}{${a}}+\\frac{1}{${b}}=\\frac{1}{x}`);
    return finish(meta, seed, r, {
      variant: "work-together",
      prompt: `One ${worker[0]} ${worker[1]} a ${worker[2]} in ${a} hours working alone. A second ${worker[0]} does the same job in ${b} hours working alone. Working together they take $x$ hours. Which equation models this?`,
      hint: `Each worker's rate is the part of the job done in one hour, which is 1 divided by the hours alone, ${a} or ${b}. Together the rates add to the rate for the whole team, $\\frac{1}{x}$.`,
      explanation: [
        `The first ${worker[0]} does $\\frac{1}{${a}}$ of the job per hour and the second does $\\frac{1}{${b}}$ of the job per hour.`,
        `Together they do $\\frac{1}{x}$ of the job per hour.`,
        `Adding the two rates gives the team's rate: ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...lab(`${a}+${b}=\\frac{1}{x}`),
          feedback: `${a} and ${b} are hours for a whole job, not rates. Rates are jobs per hour: $\\frac{1}{${a}}$ and $\\frac{1}{${b}}$.`,
        },
        {
          ...lab(`\\frac{1}{${a}}+\\frac{1}{${b}}=x`),
          feedback: `The team's rate is $\\frac{1}{x}$ job per hour, not $x$. $x$ is the time.`,
        },
        {
          ...lab(`\\frac{1}{${a}}\\cdot\\frac{1}{${b}}=\\frac{1}{x}`),
          feedback: `Rates of workers who work at the same time add. They are not multiplied.`,
        },
        {
          ...lab(`\\frac{${a}}{x}+\\frac{${b}}{x}=1`),
          feedback: `The fraction of the job each does in $x$ hours is $\\frac{x}{${a}}$ and $\\frac{x}{${b}}$, which add to 1. These are inverted.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const cur = r(2, 4);
    const down = r(3, 8) * 2;
    const up = down - r(1, 2) * 2;
    const dd = down * 3;
    const du = up * 3;
    const right = lab(`\\frac{${dd}}{x+${cur}}=\\frac{${du}}{x-${cur}}`);
    return finish(meta, seed, r, {
      variant: "current-speed",
      prompt: `A boat travels ${dd} miles downstream in the same time it takes to travel ${du} miles upstream. The current flows at ${cur} miles per hour. Let $x$ be the boat's speed in still water, in miles per hour. Which equation models this?`,
      hint: `Time equals distance divided by speed: ${dd} miles downstream and ${du} miles upstream. The current of ${cur} miles per hour adds to the boat's speed downstream and subtracts from it upstream. The two times are equal.`,
      explanation: [
        `Downstream the speed is $x+${cur}$, so the time is $\\frac{${dd}}{x+${cur}}$. Upstream the speed is $x-${cur}$, so the time is $\\frac{${du}}{x-${cur}}$.`,
        `The times are equal.`,
        `The equation is ${right.label}.`,
      ],
      correct: right.label,
      key: right.key,
      wrong: [
        {
          ...lab(`\\frac{${dd}}{x-${cur}}=\\frac{${du}}{x+${cur}}`),
          feedback: `The current helps the boat going downstream, so downstream speed is $x+${cur}$. The two speeds were exchanged.`,
        },
        {
          ...lab(`\\frac{${dd}}{x}+${cur}=\\frac{${du}}{x}-${cur}`),
          feedback: `The current changes the speed, which is the divisor. It is not added to the time.`,
        },
        {
          ...lab(`\\frac{${dd}}{x+${cur}}=\\frac{${du}}{x}`),
          feedback: `The current slows the boat going upstream, so the upstream speed is $x-${cur}$, not $x$.`,
        },
        {
          ...lab(`${dd}(x+${cur})=${du}(x-${cur})`),
          feedback: `Distance is multiplied by time, not by speed. Divide each distance by its speed to get a time.`,
        },
      ],
    });
  }
  const extra = pick(r, [10, 15, 20]);
  const d1 = r(2, 5) * 20;
  let d2 = r(2, 5) * 20;
  while (d2 === d1) d2 = r(2, 5) * 20;
  const hours = pick(r, [3, 4, 5]);
  const right = lab(`\\frac{${d1}}{x}+\\frac{${d2}}{x+${extra}}=${hours}`);
  return finish(meta, seed, r, {
    variant: "two-speeds",
    prompt: `A driver travels ${d1} miles at $x$ miles per hour, then ${d2} more miles at ${extra} miles per hour faster. The whole trip takes ${hours} hours. Which equation models this?`,
    hint: `Each part of the trip takes distance divided by speed. The second speed is $x$ plus ${extra}. The two times add to ${hours}.`,
    explanation: [
      `The first part takes $\\frac{${d1}}{x}$ hours. The second speed is $x+${extra}$, so it takes $\\frac{${d2}}{x+${extra}}$ hours.`,
      `The two times add to ${hours} hours.`,
      `The equation is ${right.label}.`,
    ],
    correct: right.label,
    key: right.key,
    wrong: [
      {
        ...lab(`\\frac{${d1}}{x+${extra}}+\\frac{${d2}}{x}=${hours}`),
        feedback: `The first part is driven at $x$ miles per hour, and the second part at $x+${extra}$. The speeds were exchanged.`,
      },
      {
        ...lab(`\\frac{${d1}}{x}+\\frac{${d2}}{x}+${extra}=${hours}`),
        feedback: `The extra ${extra} miles per hour belongs to the speed in the second denominator, not to the time.`,
      },
      {
        ...lab(`${d1}x+${d2}(x+${extra})=${hours}`),
        feedback: `Time is distance divided by speed. Multiplying distance by speed does not give hours.`,
      },
      {
        ...lab(`\\frac{${d1}+${d2}}{x+${extra}}=${hours}`),
        feedback: `The two parts are driven at different speeds, so their times cannot be combined over one speed.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Equations with rational exponents
// ---------------------------------------------------------------------------

export function rationalExponentEquationCase(seed: string): TexasHsCase {
  const meta = rationalExponentEquationTemplate;
  const r = begin(meta, seed);
  const pairs: [number, number][] = [
    [3, 2],
    [2, 3],
    [3, 4],
    [1, 3],
    [4, 3],
    [5, 2],
    [1, 2],
  ];
  const [p, qq] = pick(r, pairs);
  const t = r(2, 4);
  const negative = p % 2 === 1 && qq % 2 === 1 && r(0, 2) === 0;
  const k = (negative ? -1 : 1) * t ** p;
  const base = t ** qq;
  const frac = `\\frac{${p}}{${qq}}`;
  const exp = `x^{${frac}}`;
  const both = p % 2 === 0;
  const sol = (...vals: number[]) =>
    vals.map((v) => tex(`x=${v}`)).join(" or ");
  const correctVals = negative ? [-base] : both ? [-base, base] : [base];
  const right = sol(...correctVals);
  const restrict =
    qq % 2 === 0
      ? ` Because $x^{\\frac{${p}}{${qq}}}$ uses an even root, $x$ must be nonnegative.`
      : "";
  const wrongVals: Wrong[] = [
    {
      label: sol(t),
      feedback: `Raising to the power $\\frac{${qq}}{${p}}$ undoes the exponent: ${k} raised to that power is $${base}$. Taking only the ${qq === 2 ? "square" : "root"} of ${t ** p} gives ${t}, not the solution.`,
    },
    {
      label: sol(k),
      feedback: `The equation says a power of $x$ equals ${k}, so $x$ itself is not ${k}. Raise both sides to the reciprocal power $\\frac{${qq}}{${p}}$.`,
    },
    {
      label: sol(Math.round((k * qq) / p)),
      feedback: `Undo a power by raising both sides to the reciprocal power, not by multiplying by the reciprocal.`,
    },
    {
      label: sol(...(both || negative ? [base] : [-base, base])),
      feedback: both
        ? `Because the numerator ${p} is even, $x$ and $-x$ give the same value, so there is also a negative solution.`
        : qq % 2 === 0
          ? `The denominator ${qq} means an even root, which is defined only for $x\\ge0$. The negative value is not a solution.`
          : `With an odd numerator and an odd denominator the sign of $x$ matches the sign of ${k}, so $x=${negative ? -base : base}$ is the only solution.`,
    },
    {
      label: sol(base + 1),
      feedback: `Substituting $x=${base + 1}$ does not give ${k}. Check any answer by substituting.`,
    },
  ];
  // Drop equivalent labels to the correct one and keep three distinct wrong ones.
  return finish(meta, seed, r, {
    variant: both
      ? "even-numerator-two-solutions"
      : negative
        ? "negative-right-side"
        : qq % 2 === 0
          ? "even-root-domain"
          : "single-solution",
    prompt: `Solve $${exp}=${k}$ for all real $x$.`,
    hint: `Raise both sides to the reciprocal of the exponent, $\\frac{${qq}}{${p}}$. ${both ? "Think about whether a negative $x$ could also work." : qq % 2 === 0 ? "Think about which $x$ the even root allows." : ""}`.trim(),
    explanation: [
      `The reciprocal of $\\frac{${p}}{${qq}}$ is $\\frac{${qq}}{${p}}$. Since $\\left(x^{\\frac{${p}}{${qq}}}\\right)^{\\frac{${qq}}{${p}}}=x$, raise both sides to that power.`,
      `${k} is ${negative ? `$-${t}^{${p}}$` : `$${t}^{${p}}$`}, so the right side becomes ${negative ? "$-" : "$"}${t}^{${qq}}=${negative ? -base : base}$.${restrict}`,
      both
        ? `The exponent's numerator ${p} is even, so $x$ and $-x$ both give ${k}. Check: $${base}^{${frac}}=${k}$ and $${par(-base)}^{${frac}}=${k}$. The solutions are ${right}.`
        : `Check: $${par(negative ? -base : base)}^{${frac}}=${k}$. The solution is ${right}.`,
    ],
    correct: right,
    wrong: wrongVals,
  });
}

// ---------------------------------------------------------------------------
// Compositions of rigid motions and dilations
// ---------------------------------------------------------------------------

type Pt = [number, number];
const ptText = (p: Pt) => `(${p[0]}, ${p[1]})`;
type Rigid = {
  words: string;
  apply: (p: Pt) => Pt;
  /** A believable error: wrong direction, axis or sense of rotation. */
  mistake: (p: Pt) => Pt;
};
function rigidMotion(r: Random): Rigid {
  const kind = r(0, 5);
  if (kind === 0) {
    const a = nonzeroIn(r, -5, 5);
    const b = nonzeroIn(r, -5, 5);
    return {
      words: `translated ${Math.abs(a)} unit${Math.abs(a) === 1 ? "" : "s"} ${a > 0 ? "right" : "left"} and ${Math.abs(b)} unit${Math.abs(b) === 1 ? "" : "s"} ${b > 0 ? "up" : "down"}`,
      apply: ([x, y]) => [x + a, y + b],
      mistake: ([x, y]) => [x - a, y - b],
    };
  }
  if (kind === 1)
    return {
      words: "reflected across the $x$-axis",
      apply: ([x, y]) => [x, -y],
      mistake: ([x, y]) => [-x, y],
    };
  if (kind === 2)
    return {
      words: "reflected across the $y$-axis",
      apply: ([x, y]) => [-x, y],
      mistake: ([x, y]) => [x, -y],
    };
  if (kind === 3)
    return {
      words: "reflected across the line $y=x$",
      apply: ([x, y]) => [y, x],
      mistake: ([x, y]) => [-y, -x],
    };
  if (kind === 4)
    return {
      words: "rotated $90^\\circ$ counterclockwise about the origin",
      apply: ([x, y]) => [-y, x],
      mistake: ([x, y]) => [y, -x],
    };
  return {
    words: "rotated $180^\\circ$ about the origin",
    apply: ([x, y]) => [-x, -y],
    mistake: ([x, y]) => [-x, y],
  };
}

export function transformationCompositionCase(seed: string): TexasHsCase {
  const meta = transformationCompositionTemplate;
  const r = begin(meta, seed);
  const k = pick(r, [2, 3, 4, 0.5]);
  const rigid = rigidMotion(r);
  const dilateFirst = r(0, 1) === 1;
  const p: Pt = [nonzeroIn(r, -6, 6), nonzeroIn(r, -6, 6)];
  const stage1 = dilateFirst ? null : rigid.apply(p);
  // The dilation acts on the second-stage input; the center matches its parity for k = 1/2.
  const input: Pt = dilateFirst ? p : stage1!;
  let center: Pt = [nonzeroIn(r, -5, 5), nonzeroIn(r, -5, 5)];
  if (k === 0.5)
    center = [
      center[0] + ((center[0] - input[0]) % 2 === 0 ? 0 : 1),
      center[1] + ((center[1] - input[1]) % 2 === 0 ? 0 : 1),
    ];
  const dilate = (pt: Pt, c: Pt, s: number): Pt => [
    c[0] + s * (pt[0] - c[0]),
    c[1] + s * (pt[1] - c[1]),
  ];
  const scale = k === 0.5 ? "$\\frac12$" : `${k}`;
  const apply = (
    pt: Pt,
    c: Pt,
    rigidOp: (q: Pt) => Pt,
    dilationScale = k,
  ): Pt =>
    dilateFirst
      ? rigidOp(dilate(pt, c, dilationScale))
      : dilate(rigidOp(pt), c, dilationScale);
  const answer = apply(p, center, rigid.apply);
  // An image equal to a point named in the prompt would leak the answer.
  if (answer[0] === p[0] && answer[1] === p[1])
    return transformationCompositionCase(`${seed}~`);
  if (answer[0] === center[0] && answer[1] === center[1])
    return transformationCompositionCase(`${seed}~`);
  const first = dilateFirst
    ? `dilated with center $${ptText(center)}$ and scale factor ${scale}`
    : rigid.words;
  const second = dilateFirst
    ? rigid.words
    : `dilated with center $${ptText(center)}$ and scale factor ${scale}`;
  const mid = dilateFirst ? dilate(p, center, k) : stage1!;
  const reversed: Pt = dilateFirst
    ? dilate(rigid.apply(p), center, k)
    : rigid.apply(dilate(p, center, k));
  const label = (pt: Pt) => tex(ptText(pt));
  const otherOrderOk = dilateFirst
    ? "rotations and reflections about the origin and dilations about another center generally do not commute"
    : "";
  void otherOrderOk;
  return finish(meta, seed, r, {
    variant: dilateFirst ? "dilation-then-rigid" : "rigid-then-dilation",
    prompt: `Point $A=${ptText(p)}$ is ${first}, and then its image is ${second}. What are the coordinates of the final image of $A$?`,
    hint: `Do the two steps in the order given. For a dilation with center $C=${ptText(center)}$ and scale factor ${scale}, each point moves along the line from $C$: the image of $P$ is $C+${k === 0.5 ? "\\frac12" : k}(P-C)$, coordinate by coordinate.`,
    explanation: [
      dilateFirst
        ? `Dilate first. Measure from the center: $A-C=(${p[0] - center[0]}, ${p[1] - center[1]})$. Scale by ${scale}: $(${k * (p[0] - center[0])}, ${k * (p[1] - center[1])})$. Add the center back: $${ptText(mid)}$.`
        : `The first step moves $A=${ptText(p)}$ to $${ptText(mid)}$.`,
      dilateFirst
        ? `Now the point $${ptText(mid)}$ is ${second}, which gives $${ptText(answer)}$.`
        : `Dilate $${ptText(mid)}$ about $C=${ptText(center)}$. Measure from the center: $(${mid[0] - center[0]}, ${mid[1] - center[1]})$. Scale by ${scale}: $(${k * (mid[0] - center[0])}, ${k * (mid[1] - center[1])})$. Add the center back: $${ptText(answer)}$.`,
      `The final image is $${ptText(answer)}$.`,
    ],
    correct: label(answer),
    wrong: [
      {
        label: label(apply(p, [0, 0], rigid.apply)),
        feedback: `The dilation is centered at $${ptText(center)}$, not at the origin. Scale the distances measured from that center.`,
      },
      {
        label: label(reversed),
        feedback: `The order matters here. The problem does the ${dilateFirst ? "dilation" : "rigid motion"} first.`,
      },
      {
        label: label(apply(p, center, rigid.mistake)),
        feedback: `The motion "${rigid.words}" sends each point to a different place than this. Re-check which way it moves or reflects the point.`,
      },
      {
        label: label(dilateFirst ? rigid.apply(p) : dilate(p, center, k)),
        feedback: `One of the two steps was skipped. Apply both, in order.`,
      },
      {
        label: label(
          dilateFirst
            ? rigid.apply([k * p[0] + center[0], k * p[1] + center[1]])
            : [k * stage1![0] + center[0], k * stage1![1] + center[1]],
        ),
        feedback: `To dilate about a center, scale the distance from the center, $P-C$, and then add $C$ back. Scaling $P$ itself moves the center too.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Counterexamples
// ---------------------------------------------------------------------------

export function counterexampleChoiceCase(seed: string): TexasHsCase {
  const meta = counterexampleChoiceTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const claim = (text: string) => `Conjecture: ${text}`;
  if (variant === 0) {
    const t = pick(r, [50, 55, 60, 65, 70, 75]);
    const l = r(2, 6);
    const w = l + r(1, 4);
    return finish(meta, seed, r, {
      variant: "rhombus-not-square",
      prompt: `${claim("If a quadrilateral has four congruent sides, then it is a square.")} Which figure is a counterexample?`,
      hint: `A counterexample must satisfy the "if" part (four congruent sides) and fail the "then" part (being a square). Test each figure against both parts.`,
      explanation: [
        `A counterexample has four congruent sides but is not a square.`,
        `A rhombus with angles of $${t}^\\circ$ and $${180 - t}^\\circ$ has four congruent sides, but its angles are not right angles, so it is not a square.`,
        `The other figures either are squares or do not have four congruent sides.`,
      ],
      correct: `A rhombus with angles of $${t}^\\circ$ and $${180 - t}^\\circ$`,
      wrong: [
        {
          label: "A square",
          feedback: `A square has four congruent sides and is a square, so it agrees with the conjecture and cannot refute it.`,
        },
        {
          label: `A rectangle with sides ${l} and ${w}`,
          feedback: `Its sides are not all congruent, so it does not satisfy the "if" part. A counterexample must make the "if" part true.`,
        },
        {
          label: `A kite with sides ${l}, ${l}, ${w}, ${w}`,
          feedback: `Its four sides are not all congruent, so it does not satisfy the "if" part.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const products = [12, 24, 30, 36, 48];
    const prod = pick(r, products);
    const factors: [number, number][] = [];
    for (let b = 2; b <= prod; b++)
      if (prod % b === 0 && prod / b >= 2) factors.push([b, prod / b]);
    const [b1, h1] = pick(r, factors);
    let [b2, h2] = pick(r, factors);
    while (b2 === b1 || b2 === h1) [b2, h2] = pick(r, factors);
    const area = prod / 2;
    const smaller = b1 * (h1 - 1);
    return finish(meta, seed, r, {
      variant: "equal-area-triangles",
      prompt: `${claim("If two triangles have the same area, then they are congruent.")} Which pair of triangles is a counterexample?`,
      hint: `A counterexample needs two triangles with equal areas that are not congruent. Compute each right triangle's area, half the product of its legs, and check whether the two triangles have the same legs.`,
      explanation: [
        `A counterexample has equal areas but is not congruent.`,
        `A right triangle with legs ${b1} and ${h1} has area $\\tfrac12\\cdot${b1}\\cdot${h1}=${area}$. A right triangle with legs ${b2} and ${h2} has area $\\tfrac12\\cdot${b2}\\cdot${h2}=${area}$.`,
        `The areas are equal, but the legs are different lengths, so the triangles are not congruent.`,
      ],
      correct: `A right triangle with legs ${b1} and ${h1}, and a right triangle with legs ${b2} and ${h2}`,
      wrong: [
        {
          label: `Two right triangles, each with legs ${b1} and ${h1}`,
          feedback: `Right triangles with the same two legs are congruent. Congruent triangles with equal area agree with the conjecture; they cannot refute it.`,
        },
        {
          label: `A right triangle with legs ${b1} and ${h1}, and a right triangle with legs ${b1} and ${h1 - 1}`,
          feedback: `Their areas are ${area} and ${smaller / 2}, which are not equal, so the "if" part is false.`,
        },
        {
          label: `A right triangle with legs ${b2} and ${h2}, and a right triangle with legs ${b2 + 1} and ${h2}`,
          feedback: `Their areas are ${area} and ${((b2 + 1) * h2) / 2}, which are not equal, so the "if" part is false.`,
        },
      ],
    });
  }
  if (variant === 2) {
    const per = r(5, 12) * 2;
    const half = per / 2;
    const l1 = r(2, half - 3);
    const w1 = half - l1;
    let l2 = r(1, half - 1);
    while (l2 === l1 || l2 === w1 || half - l2 < 1) l2 = r(1, half - 1);
    const w2 = half - l2;
    return finish(meta, seed, r, {
      variant: "equal-perimeter-rectangles",
      prompt: `${claim("If two rectangles have the same perimeter, then they have the same area.")} Which pair of rectangles is a counterexample?`,
      hint: `A counterexample needs two rectangles with equal perimeters but different areas. Find $2(\\text{length}+\\text{width})$ and length $\\times$ width for each pair.`,
      explanation: [
        `A counterexample has equal perimeters and different areas.`,
        `${article(l1, true)} ${l1} by ${w1} rectangle has perimeter ${per} and area ${l1 * w1}. ${article(l2, true)} ${l2} by ${w2} rectangle has perimeter ${per} and area ${l2 * w2}.`,
        `The perimeters are equal and the areas are different, so this pair refutes the conjecture.`,
      ],
      correct: `${article(l1, true)} ${l1} by ${w1} rectangle and ${article(l2)} ${l2} by ${w2} rectangle`,
      wrong: [
        {
          label: `${article(l1, true)} ${l1} by ${w1} rectangle and ${article(w1)} ${w1} by ${l1} rectangle`,
          feedback: `Both rectangles have perimeter ${per} and area ${l1 * w1}. The areas agree, so this pair supports the conjecture.`,
        },
        {
          label: `${article(l1, true)} ${l1} by ${w1} rectangle and ${article(l1 + 1)} ${l1 + 1} by ${w1} rectangle`,
          feedback: `Their perimeters are ${per} and ${per + 2}, which are not equal, so the "if" part is false.`,
        },
        {
          label: `${article(l2, true)} ${l2} by ${w2} rectangle and ${article(l2)} ${l2} by ${w2 + 2} rectangle`,
          feedback: `Their perimeters are ${per} and ${per + 4}, which are not equal, so the "if" part is false.`,
        },
      ],
    });
  }
  if (variant === 3) {
    const b = pick(r, [8, 10, 12, 14]);
    const a = r(b / 2 + 1, b - 1);
    const longer = b + r(2, 5);
    const desc = (side: number) =>
      `$\\angle A=30^\\circ$, $AC=${b}$ and $BC=${side}$`;
    return finish(meta, seed, r, {
      variant: "ssa-ambiguous",
      prompt: `${claim("If two sides and an angle that is not between them in one triangle are congruent to the matching parts of another triangle, then the triangles are congruent.")} In each choice, triangle $ABC$ has the given angle $A$ and sides $AC$ and $BC$ ($BC$ is opposite angle $A$). Which choice describes a counterexample?`,
      hint: `The counterexample needs two different triangles with the same $\\angle A$, $AC$ and $BC$. Swing side $BC$ about $C$ and ask how many places it can reach the third side. The height from $C$ is $AC\\sin30^\\circ=${b / 2}$.`,
      explanation: [
        `With $\\angle A=30^\\circ$ and $AC=${b}$, the distance from $C$ to the line through $A$ and $B$ is $${b}\\sin30^\\circ=${b / 2}$.`,
        `If $BC$ is longer than ${b / 2} but shorter than ${b}, side $BC$ can reach the line in two places, so two different triangles fit the same data. With $BC=${a}$, between ${b / 2} and ${b}, that happens.`,
        `Equal to ${b / 2} gives one right triangle, and ${b} or more gives one triangle. Only ${desc(a)} fits two non-congruent triangles.`,
      ],
      correct: desc(a),
      wrong: [
        {
          label: desc(b / 2),
          feedback: `With $BC$ equal to the height ${b / 2}, side $BC$ touches the line in exactly one point, a right triangle. Only one triangle fits.`,
        },
        {
          label: desc(b),
          feedback: `With $BC=AC$, the only other point would be $A$ itself. Only one triangle fits.`,
        },
        {
          label: desc(longer),
          feedback: `With $BC$ longer than $AC$, side $BC$ reaches the line in only one valid place. Only one triangle fits.`,
        },
      ],
    });
  }
  return finish(meta, seed, r, {
    variant: "equal-diagonals",
    prompt: `${claim("If the diagonals of a quadrilateral are congruent, then it is a rectangle.")} Which figure is a counterexample?`,
    hint: `A counterexample has congruent diagonals but is not a rectangle. Think about which quadrilaterals have congruent diagonals, and check the other part, being a rectangle.`,
    explanation: [
      `A counterexample must have congruent diagonals and not be a rectangle.`,
      `An isosceles trapezoid has congruent diagonals, but only one pair of parallel sides, so it is not a rectangle.`,
      `A rectangle agrees with the conjecture. A rhombus that is not a square and a parallelogram that is not a rectangle have diagonals that are not congruent, so they do not satisfy the "if" part.`,
    ],
    correct: "An isosceles trapezoid",
    wrong: [
      {
        label: "A rectangle",
        feedback: `A rectangle has congruent diagonals and is a rectangle, so it agrees with the conjecture.`,
      },
      {
        label: "A rhombus that is not a square",
        feedback: `Its diagonals are perpendicular but not congruent, so it does not satisfy the "if" part.`,
      },
      {
        label: "A parallelogram that is not a rectangle",
        feedback: `Its diagonals are not congruent, so it does not satisfy the "if" part.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Euclidean and spherical geometry
// ---------------------------------------------------------------------------

export function sphericalGeometryCase(seed: string): TexasHsCase {
  const meta = sphericalGeometryTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const defn = `On a sphere, a "line" is a great circle: a circle whose center is the center of the sphere, such as the equator.`;
  if (variant === 0)
    return finish(meta, seed, r, {
      variant: "parallel-lines",
      prompt: `${defn} Given a line and a point not on it, how many lines through the point are parallel to the given line in the plane, and how many on the sphere?`,
      hint: `Two great circles on a sphere always cross, in two opposite points. Use that to decide how many great circles through the point miss the given one.`,
      explanation: [
        `In the plane, exactly one line through the point is parallel to the given line.`,
        `Any two great circles of a sphere intersect in two opposite points. So every line through the point meets the given line.`,
        `On the sphere there are no parallel lines.`,
      ],
      correct: "Plane: exactly one. Sphere: none.",
      wrong: [
        {
          label: "Plane: none. Sphere: exactly one.",
          feedback: `The numbers are reversed. The plane has one parallel through the point, and the sphere has none.`,
        },
        {
          label: "Plane: exactly one. Sphere: exactly one.",
          feedback: `Every great circle through the point crosses the given great circle, so there are no parallels on the sphere.`,
        },
        {
          label: "Plane: exactly one. Sphere: infinitely many.",
          feedback: `Infinitely many parallels through a point happens in hyperbolic geometry, not on a sphere. On a sphere, great circles always meet.`,
        },
      ],
    });
  if (variant === 1) {
    const t = pick(r, [75, 80, 90, 100, 110, 120, 135]);
    const small = pick(r, [40, 45, 50, 55]);
    const trip = (v: number) => `Three angles of $${v}^\\circ$ each`;
    return finish(meta, seed, r, {
      variant: "angle-sum",
      prompt: `${defn} A triangle on the sphere is bounded by three arcs of great circles. Which could be the three angle measures of such a triangle?`,
      hint: `In the plane the angles of a triangle add to $180^\\circ$. On a sphere the sides curve outward, which changes the sum. Decide whether it is larger or smaller than $180^\\circ$.`,
      explanation: [
        `The angle sum of a triangle on a sphere is greater than $180^\\circ$. Its excess over $180^\\circ$ grows with the triangle's area.`,
        `Three angles of $${t}^\\circ$ total $${3 * t}^\\circ$, which is greater than $180^\\circ$, so a triangle on the sphere can have them.`,
        `A total of $180^\\circ$ or less cannot occur on a sphere.`,
      ],
      correct: trip(t),
      wrong: [
        {
          label: trip(60),
          feedback: `A total of $180^\\circ$ is the plane's sum. A triangle on a sphere always has a larger total.`,
        },
        {
          label: trip(small),
          feedback: `A total of $${3 * small}^\\circ$ is less than $180^\\circ$. That happens on a saddle-shaped surface, not on a sphere.`,
        },
        {
          label: `Angles of $${small - 10}^\\circ$, $${small}^\\circ$ and $${small + 10}^\\circ$`,
          feedback: `These total $${3 * small}^\\circ$, less than $180^\\circ$. On a sphere the total is greater than $180^\\circ$.`,
        },
      ],
    });
  }
  if (variant === 2)
    return finish(meta, seed, r, {
      variant: "shortest-path",
      prompt: `${defn} Which path is the shortest route along the surface of the sphere between two points that are not opposite each other?`,
      hint: `In the plane the shortest path is a segment of a line. Use the sphere's meaning of "line" from the first sentence.`,
      explanation: [
        `The shortest path in the plane lies on a line. On a sphere the corresponding paths lie on lines, which are great circles.`,
        `The shortest route follows the shorter arc of the great circle through the two points.`,
        `A route along any smaller circle, such as a circle of latitude, is longer, except when that circle is the equator.`,
      ],
      correct: "The shorter arc of the great circle through the two points",
      wrong: [
        {
          label: "The straight segment through the inside of the sphere",
          feedback: `That segment is shorter, but it is not on the surface. The route must stay on the surface of the sphere.`,
        },
        {
          label: "An arc of the circle of latitude through both points",
          feedback: `A circle of latitude that is not the equator is smaller than a great circle, and the route along it is longer than the great-circle route.`,
        },
        {
          label: "The longer arc of the great circle through the two points",
          feedback: `The great circle gives two routes between the points. The shorter arc is the shortest route.`,
        },
      ],
    });
  return finish(meta, seed, r, {
    variant: "right-angles",
    prompt: `${defn} What is the greatest number of right angles a triangle can have in the plane and on the sphere?`,
    hint: `In the plane the angles must total $180^\\circ$. On a sphere, think about the triangle with a vertex at the north pole and two vertices on the equator, a quarter of the way around from each other.`,
    explanation: [
      `In the plane the three angles total $180^\\circ$, so a triangle has at most one right angle.`,
      `On a sphere, take the north pole and two points on the equator a quarter of the way around from each other. The meridians meet the equator at $90^\\circ$ and meet each other at the pole at $90^\\circ$.`,
      `That triangle has three right angles, so on the sphere the greatest number is three.`,
    ],
    correct: "Plane: one. Sphere: three.",
    wrong: [
      {
        label: "Plane: one. Sphere: one.",
        feedback: `The triangle with its vertex at the pole and two points on the equator has three right angles on the sphere.`,
      },
      {
        label: "Plane: three. Sphere: one.",
        feedback: `In the plane the angles total $180^\\circ$, so three right angles ($270^\\circ$) cannot occur.`,
      },
      {
        label: "Plane: two. Sphere: three.",
        feedback: `In the plane two right angles use all $180^\\circ$, leaving $0^\\circ$ for the third angle, so a triangle has at most one.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Regular polygon area
// ---------------------------------------------------------------------------

const decimal = (hundredths: number) => `${hundredths / 100}`;

export function regularPolygonAreaCase(seed: string): TexasHsCase {
  const meta = regularPolygonAreaTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 5);
  const surd = (c: number) => tex(`${c}\\sqrt{3}`);
  if (variant === 0) {
    const t = r(2, 6);
    const s = 2 * t;
    const area = 6 * t * t;
    const right = surd(area);
    return finish(meta, seed, r, {
      variant: "hexagon-from-side",
      prompt: `A regular hexagon has side length ${s} cm. What is its area in square centimeters?`,
      hint: `A regular hexagon splits into 6 equilateral triangles with side ${s}. Find the apothem, the height of one triangle, with a $30^\\circ$-$60^\\circ$-$90^\\circ$ triangle, then use $A=\\tfrac12ap$.`,
      explanation: [
        `The apothem is the height of one equilateral triangle of side ${s}. It splits the triangle into two $30^\\circ$-$60^\\circ$-$90^\\circ$ triangles with short leg ${t}, so $a=${t}\\sqrt{3}$.`,
        `The perimeter is $6\\times${s}=${6 * s}$ cm.`,
        `$A=\\tfrac12ap=\\tfrac12(${t}\\sqrt{3})(${6 * s})=${area}\\sqrt{3}$ square centimeters.`,
      ],
      correct: right,
      wrong: [
        {
          label: tex(`${3 * s * s}`),
          feedback: `The apothem is not the side length. It is the height of an equilateral triangle, $\\frac{\\sqrt3}{2}$ times the side.`,
        },
        {
          label: tex(`${3 * t * t}\\sqrt{3}`),
          feedback: `Use the full area formula $A=\\tfrac12ap$ with the whole perimeter ${6 * s}; this is half of the correct area.`,
        },
        {
          label: tex(`${12 * t * t}\\sqrt{3}`),
          feedback: `The area is one half of apothem times perimeter. This is double the correct area.`,
        },
        {
          label: tex(`${t * t}\\sqrt{3}`),
          feedback: `That is the area of one of the six triangles. The hexagon has six of them.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const t = r(2, 7);
    const s = 2 * t;
    return finish(meta, seed, r, {
      variant: "hexagon-apothem",
      prompt: `A regular hexagon has side length ${s} cm. What is its apothem, the distance from the center to the midpoint of a side?`,
      hint: `Draw the center to two neighboring vertices of the hexagon with side ${s} cm. That triangle is equilateral with side ${s} cm. The apothem is its height, which splits the triangle into two $30^\\circ$-$60^\\circ$-$90^\\circ$ triangles.`,
      explanation: [
        `The center and two neighboring vertices form an equilateral triangle with side ${s} cm.`,
        `The apothem is its height. It splits the triangle into two $30^\\circ$-$60^\\circ$-$90^\\circ$ triangles with short leg ${t} (half the side) and hypotenuse ${s}.`,
        `The long leg is the short leg times $\\sqrt3$, so the apothem is $${t}\\sqrt{3}$ cm.`,
      ],
      correct: tex(`${t}\\sqrt{3}\\text{ cm}`),
      wrong: [
        {
          label: tex(`${s}\\text{ cm}`),
          feedback: `${s} is the side length. The apothem is shorter: it is a leg of a right triangle whose hypotenuse is ${s}.`,
        },
        {
          label: tex(`${t}\\text{ cm}`),
          feedback: `${t} is half the side, the short leg. The apothem is the long leg, $\\sqrt3$ times longer.`,
        },
        {
          label: tex(`${t}\\sqrt{2}\\text{ cm}`),
          feedback: `The right triangle here has angles $30^\\circ$, $60^\\circ$ and $90^\\circ$, so the long leg is $\\sqrt3$ times the short leg. $\\sqrt2$ goes with $45^\\circ$-$45^\\circ$-$90^\\circ$ triangles.`,
        },
      ],
    });
  }
  if (variant === 2) {
    const a = r(2, 12);
    return finish(meta, seed, r, {
      variant: "square-from-apothem",
      prompt: `A square has an apothem of ${a} cm. What is its area in square centimeters?`,
      hint: `The apothem of ${a} cm goes from the center to the midpoint of a side. Use it to find the side length, then the perimeter, then $A=\\tfrac12ap$.`,
      explanation: [
        `The apothem is half the side length, so the side is $2\\times${a}=${2 * a}$ cm.`,
        `The perimeter is $4\\times${2 * a}=${8 * a}$ cm.`,
        `$A=\\tfrac12ap=\\tfrac12(${a})(${8 * a})=${4 * a * a}$ square centimeters. This matches ${2 * a} squared.`,
      ],
      correct: tex(`${4 * a * a}`),
      wrong: [
        {
          label: tex(`${2 * a * a}`),
          feedback: `The perimeter is 4 times the side ${2 * a}, which is ${8 * a}. This used a perimeter that is half as large.`,
        },
        {
          label: tex(`${a * a}`),
          feedback: `${a} is the apothem, half the side. The side is ${2 * a} and the area is the side squared.`,
        },
        {
          label: tex(`${8 * a * a}`),
          feedback: `The area is one half of apothem times perimeter. This is double the correct area.`,
        },
      ],
    });
  }
  if (variant === 3) {
    const t = r(1, 4);
    const s = 6 * t;
    const area = 9 * t * t;
    return finish(meta, seed, r, {
      variant: "triangle-from-side",
      prompt: `A regular polygon with 3 sides, an equilateral triangle, has side length ${s} cm. Its apothem is the distance from its center to a side, $${t === 1 ? "" : t}\\sqrt{3}$ cm. What is its area in square centimeters?`,
      hint: `Use $A=\\tfrac12ap$ with the apothem given and the perimeter of 3 sides of length ${s}.`,
      explanation: [
        `The perimeter is $3\\times${s}=${3 * s}$ cm.`,
        `$A=\\tfrac12ap=\\tfrac12(${t === 1 ? "" : t}\\sqrt3)(${3 * s})$.`,
        `This is $${area}\\sqrt3$ square centimeters.`,
      ],
      correct: surd(area),
      wrong: [
        {
          label: surd(2 * area),
          feedback: `The area is one half of apothem times perimeter. This is double the correct area.`,
        },
        {
          label: surd(area / 3 === Math.floor(area / 3) ? area / 3 : 3 * t),
          feedback: `Use the whole perimeter, ${3 * s}, not one side. The polygon has 3 sides.`,
        },
        {
          label: tex(`${area}`),
          feedback: `The apothem is $${t === 1 ? "" : t}\\sqrt{3}$ cm. Keep the $\\sqrt3$ when you multiply.`,
        },
      ],
    });
  }
  // Rounded textbook apothems for decimal arithmetic.
  const polygons: [string, number, number][] = [
    ["pentagon", 5, 0.68819096],
    ["octagon", 8, 1.20710678],
    ["decagon", 10, 1.53884177],
  ];
  const [name, n, ratio] = pick(r, polygons);
  const side = pick(r, [4, 6, 8, 10, 12]);
  const apothemH = Math.round(side * ratio * 100);
  const perimeter = n * side;
  const area100 = apothemH * perimeter; // area in 1/200 units: A = a*p/2 with a in hundredths
  const areaText = `${area100 / 200}`;
  if (variant === 4)
    return finish(meta, seed, r, {
      variant: "decimal-polygon-area",
      prompt: `A regular ${name} has side length ${side} cm and an apothem of ${decimal(apothemH)} cm, rounded to the nearest hundredth. Use the rounded apothem to find the area in square centimeters.`,
      hint: `The perimeter of a regular ${name} with side ${side} cm is ${n} times its side. Then use $A=\\tfrac12ap$ with the given apothem.`,
      explanation: [
        `The perimeter is $${n}\\times${side}=${perimeter}$ cm.`,
        `$A=\\tfrac12ap=\\tfrac12(${decimal(apothemH)})(${perimeter})$.`,
        `$${decimal(apothemH)}\\times${perimeter}=${(apothemH * perimeter) / 100}$, and half of it is $${areaText}$ square centimeters.`,
      ],
      correct: tex(areaText),
      wrong: [
        {
          label: tex(`${(apothemH * perimeter) / 100}`),
          feedback: `Area is one half of apothem times perimeter. This is double the correct area.`,
        },
        {
          label: tex(`${(apothemH * side) / 200}`),
          feedback: `The perimeter is ${n} sides, not one. Multiply the apothem by ${perimeter}.`,
        },
        {
          label: tex(`${(apothemH * n) / 200}`),
          feedback: `The formula uses the perimeter ${perimeter}, the number of sides times the side length. This used only the number of sides ${n}.`,
        },
      ],
    });
  return finish(meta, seed, r, {
    variant: "missing-side-from-area",
    prompt: `A regular ${name} has an apothem of ${decimal(apothemH)} cm and an area of ${areaText} square centimeters. What is the length of one side in centimeters?`,
    hint: `Put the area ${areaText} and the apothem ${decimal(apothemH)} into $A=\\tfrac12ap$ and solve for the perimeter $p$. The perimeter is shared by the equal sides of a regular ${name}.`,
    explanation: [
      `Solve $A=\\tfrac12ap$ for the perimeter: $p=\\dfrac{2A}{a}=\\dfrac{2(${areaText})}{${decimal(apothemH)}}=${perimeter}$ cm.`,
      `A regular ${name} has ${n} equal sides, so one side is $${perimeter}\\div${n}$.`,
      `The side length is ${side} cm.`,
    ],
    correct: tex(`${side}`),
    wrong: [
      {
        label: tex(`${perimeter}`),
        feedback: `${perimeter} cm is the perimeter. Divide by the ${n} sides to get the length of one.`,
      },
      {
        label: tex(`${side / 2}`),
        feedback: `The perimeter is $\\dfrac{2A}{a}$, not $\\dfrac{A}{a}$. That halves the answer.`,
      },
      {
        label: tex(`${side * 2}`),
        feedback: `The area formula has a $\\tfrac12$, so the perimeter is $\\dfrac{2A}{a}$. Dividing by ${n} sides then gives one side.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Surface area of cones and composites
// ---------------------------------------------------------------------------

export function curvedSolidSurfaceCase(seed: string): TexasHsCase {
  const meta = curvedSolidSurfaceTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const triples: [number, number, number][] = [
    [3, 4, 5],
    [6, 8, 10],
    [5, 12, 13],
    [8, 6, 10],
    [12, 5, 13],
    [8, 15, 17],
    [9, 12, 15],
  ];
  const [rad, h, slant] = pick(r, triples);
  const pi = (c: number) => tex(`${c}\\pi\\text{ cm}^2`);
  if (variant === 0)
    return finish(meta, seed, r, {
      variant: "cone-given-slant",
      prompt: `A closed cone has a base radius of ${rad} cm and a slant height of ${slant} cm. What is its total surface area, including the base?`,
      hint: `The surface is the circular base, $\\pi r^2$ with $r=${rad}$, plus the curved side, $\\pi r\\ell$, where $\\ell=${slant}$ is the slant height.`,
      explanation: [
        `The base is a circle: $\\pi r^2=\\pi(${rad})^2=${rad * rad}\\pi$.`,
        `The curved side is $\\pi r\\ell=\\pi(${rad})(${slant})=${rad * slant}\\pi$.`,
        `The total is $${rad * rad}\\pi+${rad * slant}\\pi=${rad * (rad + slant)}\\pi$ square centimeters.`,
      ],
      correct: pi(rad * (rad + slant)),
      wrong: [
        {
          label: pi(rad * slant),
          feedback: `That is only the curved side. A closed cone also has a circular base of area $\\pi r^2=${rad * rad}\\pi$.`,
        },
        {
          label: pi(rad * (rad + 2 * slant)),
          feedback: `The curved side $\\pi r\\ell$ appears once. A cone has one curved surface and one base.`,
        },
        {
          label: pi(rad * rad),
          feedback: `That is only the base. Add the curved side, $\\pi r\\ell=${rad * slant}\\pi$.`,
        },
      ],
    });
  if (variant === 1)
    return finish(meta, seed, r, {
      variant: "cone-given-height",
      prompt: `A closed cone has a base radius of ${rad} cm and a height of ${h} cm. What is its total surface area, including the base?`,
      hint: `The side formula needs the slant height, the distance along the surface from the apex to the base edge. Find it from the radius ${rad} cm and the height ${h} cm with the Pythagorean theorem.`,
      explanation: [
        `The slant height $\\ell$ is the hypotenuse of a right triangle with legs ${rad} and ${h}: $\\ell=\\sqrt{${rad}^2+${h}^2}=${slant}$ cm.`,
        `Base: $\\pi(${rad})^2=${rad * rad}\\pi$. Curved side: $\\pi(${rad})(${slant})=${rad * slant}\\pi$.`,
        `The total is $${rad * (rad + slant)}\\pi$ square centimeters.`,
      ],
      correct: pi(rad * (rad + slant)),
      wrong: [
        {
          label: pi(rad * (rad + h)),
          feedback: `The curved side uses the slant height ${slant}, not the vertical height ${h}. Use $\\ell=\\sqrt{r^2+h^2}$.`,
        },
        {
          label: pi(rad * slant),
          feedback: `That is only the curved side. A closed cone also has a base of area $${rad * rad}\\pi$.`,
        },
        {
          label: pi(rad * (rad + slant) * 2),
          feedback: `That is twice the correct surface area. The curved side and the base each appear once.`,
        },
      ],
    });
  const R = r(2, 7);
  const H = r(2, 9);
  if (variant === 2)
    return finish(meta, seed, r, {
      variant: "cylinder-with-hemisphere",
      prompt: `A solid is a cylinder with radius ${R} cm and height ${H} cm, with a hemisphere of radius ${R} cm attached to its top face. The bottom face is exposed. What is the surface area of the solid, counting only the outside surfaces?`,
      hint: `List the exposed surfaces for radius ${R} cm and height ${H} cm: the bottom circle, the curved side of the cylinder, and the curved surface of the hemisphere. The cylinder's top is covered by the hemisphere.`,
      explanation: [
        `Bottom circle: $\\pi r^2=${R * R}\\pi$. Cylinder side: $2\\pi rh=2\\pi(${R})(${H})=${2 * R * H}\\pi$.`,
        `Hemisphere: half of a sphere's $4\\pi r^2$, which is $2\\pi r^2=${2 * R * R}\\pi$. The cylinder's top face is covered, so it is not counted.`,
        `Total: $${R * R}\\pi+${2 * R * H}\\pi+${2 * R * R}\\pi=${3 * R * R + 2 * R * H}\\pi$ square centimeters.`,
      ],
      correct: pi(3 * R * R + 2 * R * H),
      wrong: [
        {
          label: pi(4 * R * R + 2 * R * H),
          feedback: `The cylinder's top circle, $${R * R}\\pi$, is covered by the hemisphere and is not on the outside.`,
        },
        {
          label: pi(2 * R * R + 2 * R * H),
          feedback: `The bottom circle is exposed, so add $\\pi r^2=${R * R}\\pi$.`,
        },
        {
          label: pi(5 * R * R + 2 * R * H),
          feedback: `A hemisphere's curved surface is half of a sphere, $2\\pi r^2$, not the whole sphere's $4\\pi r^2$.`,
        },
      ],
    });
  if (variant === 3)
    return finish(meta, seed, r, {
      variant: "cone-on-cylinder",
      prompt: `A silo is a cylinder of radius ${rad} cm and height ${H} cm with a cone of slant height ${slant} cm and the same radius on top. The bottom of the cylinder is a flat base. What is the surface area of the silo, counting only the outside surfaces?`,
      hint: `The exposed surfaces are the flat bottom of radius ${rad} cm, the curved side of the cylinder of height ${H} cm and the curved side of the cone of slant height ${slant} cm. The cone's base and the cylinder's top face are joined and not exposed.`,
      explanation: [
        `Bottom circle: $\\pi r^2=${rad * rad}\\pi$. Cylinder side: $2\\pi rh=2\\pi(${rad})(${H})=${2 * rad * H}\\pi$.`,
        `Cone side: $\\pi r\\ell=\\pi(${rad})(${slant})=${rad * slant}\\pi$. The two joined circles are inside the solid.`,
        `Total: $${rad * rad}\\pi+${2 * rad * H}\\pi+${rad * slant}\\pi=${rad * rad + 2 * rad * H + rad * slant}\\pi$ square centimeters.`,
      ],
      correct: pi(rad * rad + 2 * rad * H + rad * slant),
      wrong: [
        {
          label: pi(2 * rad * rad + 2 * rad * H + rad * slant),
          feedback: `The cylinder's top face and the cone's base are the same joined circle, hidden inside. Counting it adds $\\pi r^2$ too many.`,
        },
        {
          label: pi(2 * rad * H + rad * slant),
          feedback: `The flat bottom of the cylinder is exposed, so add $\\pi r^2=${rad * rad}\\pi$.`,
        },
        {
          label: pi(rad * rad + 2 * rad * H + rad * H),
          feedback: `The cone's side uses its slant height ${slant}, not the cylinder height ${H}.`,
        },
      ],
    });
  return finish(meta, seed, r, {
    variant: "cone-with-hemisphere",
    prompt: `An ice-cream cone is a cone of base radius ${rad} cm and slant height ${slant} cm topped with a hemisphere of radius ${rad} cm that sits over the open end. What is the surface area of the outside, counting the cone's side and the hemisphere's curved surface?`,
    hint: `The cone's circular base is covered by the hemisphere's flat face, so only two curved surfaces are on the outside: the cone's side, with slant height ${slant} cm, and the hemisphere, with radius ${rad} cm.`,
    explanation: [
      `Cone side: $\\pi r\\ell=\\pi(${rad})(${slant})=${rad * slant}\\pi$.`,
      `Hemisphere: half of $4\\pi r^2$, which is $2\\pi r^2=${2 * rad * rad}\\pi$.`,
      `Total: $${rad * slant}\\pi+${2 * rad * rad}\\pi=${rad * slant + 2 * rad * rad}\\pi$ square centimeters.`,
    ],
    correct: pi(rad * slant + 2 * rad * rad),
    wrong: [
      {
        label: pi(rad * slant + 3 * rad * rad),
        feedback: `The cone's base circle and the hemisphere's flat face are joined, so neither is on the outside.`,
      },
      {
        label: pi(rad * slant + 4 * rad * rad),
        feedback: `A hemisphere's curved surface is half of a sphere, $2\\pi r^2$, not the whole sphere's $4\\pi r^2$.`,
      },
      {
        label: pi(rad * slant),
        feedback: `That is only the cone's side. Add the hemisphere's curved surface, $2\\pi r^2=${2 * rad * rad}\\pi$.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Probability from area
// ---------------------------------------------------------------------------

const fracTex = (n: number, d: number, pi = false) => {
  const g = gcd(n, d);
  const [a, b] = [n / g, d / g];
  const top = `${pi ? (a === 1 ? "" : a) : a}${pi ? "\\pi" : ""}`;
  return b === 1 ? (pi ? top : `${a}`) : `\\frac{${top}}{${b}}`;
};

export function areaProbabilityCase(seed: string): TexasHsCase {
  const meta = areaProbabilityTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const lab = (text: string) => tex(text);
  if (variant === 0 || variant === 4) {
    const side = r(5, 12);
    const rad = r(1, Math.floor((side - 1) / 2));
    const inside = variant === 0;
    const hit = fracTex(rad * rad, side * side, true);
    const miss = `1-${hit}`;
    const right = inside ? hit : miss;
    return finish(meta, seed, r, {
      variant: inside ? "circle-in-square" : "outside-the-circle",
      prompt: `A dart lands at a random point of a square target with side ${side} cm. The target has a shaded circle of radius ${rad} cm entirely inside the square. What is the probability that the dart lands ${inside ? "in the circle" : "outside the circle"}? Give the exact probability.`,
      hint: `The probability is the favorable area divided by the whole area, the square of side ${side} cm. ${inside ? "The favorable region is the circle." : "The favorable region is the square without the circle."} Find each area first.`,
      explanation: [
        `The square has area $${side}^2=${side * side}$ square centimeters. The circle has area $\\pi(${rad})^2=${rad * rad === 1 ? "" : rad * rad}\\pi$.`,
        inside
          ? `$P(\\text{circle})=\\dfrac{${rad * rad === 1 ? "" : rad * rad}\\pi}{${side * side}}${hit === `\\frac{${rad * rad === 1 ? "" : rad * rad}\\pi}{${side * side}}` ? "" : `=${hit}`}$.`
          : `$P(\\text{outside})=1-P(\\text{circle})=1-\\dfrac{${rad * rad === 1 ? "" : rad * rad}\\pi}{${side * side}}${miss === `1-\\frac{${rad * rad === 1 ? "" : rad * rad}\\pi}{${side * side}}` ? "" : `=${miss}`}$.`,
        `The probability is $${right}$.`,
      ],
      correct: lab(right),
      wrong: [
        {
          label: lab(
            inside
              ? fracTex(2 * rad * (2 * rad), side * side, true)
              : `1-${fracTex(4 * rad * rad, side * side, true)}`,
          ),
          feedback: `Use the radius ${rad} in $\\pi r^2$, not the diameter ${2 * rad}.`,
        },
        {
          label: lab(
            inside
              ? fracTex(2 * rad, side * side, true)
              : `1-${fracTex(2 * rad, side * side, true)}`,
          ),
          feedback: `The circle's area is $\\pi r^2$. $2\\pi r$ is its circumference, a length, not an area.`,
        },
        {
          label: lab(inside ? miss : hit),
          feedback: inside
            ? `That is the probability of landing outside the circle. The question asks for inside.`
            : `That is the probability of landing in the circle. The question asks for outside.`,
        },
        {
          label: lab(
            inside
              ? fracTex(rad * rad, side * side)
              : `1-${fracTex(rad * rad, side * side)}`,
          ),
          feedback: `The circle's area is $\\pi r^2$, so $\\pi$ is part of the area. It is not left out.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const L = r(8, 14);
    const W = r(6, L - 1);
    const l = r(2, L - 3);
    const w = r(2, W - 2);
    const p = fracTex(l * w, L * W);
    const comp = fracTex(L * W - l * w, L * W);
    return finish(meta, seed, r, {
      variant: "rectangle-in-rectangle",
      prompt: `A point is chosen at random on ${article(L)} ${L} by ${W} rectangular board. A shaded ${l} by ${w} rectangle lies entirely on the board. What is the probability that the point is in the shaded rectangle? Give a fraction in simplest form.`,
      hint: `The probability is the shaded area divided by the board's area. Multiply length by width for the ${l} by ${w} rectangle and for the ${L} by ${W} board.`,
      explanation: [
        `The board's area is $${L}\\times${W}=${L * W}$. The shaded area is $${l}\\times${w}=${l * w}$.`,
        `The probability is $\\dfrac{${l * w}}{${L * W}}$, which simplifies to $${p}$.`,
      ],
      correct: lab(p),
      wrong: [
        {
          label: lab(fracTex(l + w, L + W)),
          feedback: `Probability compares areas, not perimeters or sums of side lengths. Multiply length by width for each rectangle.`,
        },
        {
          label: lab(comp),
          feedback: `That is the probability of landing outside the shaded rectangle. The question asks for inside.`,
        },
        {
          label: lab(fracTex(l * w, L * W - l * w)),
          feedback: `That compares the shaded area to the unshaded area. Probability compares the shaded area to the whole board.`,
        },
        {
          label: lab(fracTex(l, L)),
          feedback: `The shaded rectangle covers $\\frac{${l}}{${L}}$ of the length but only part of the width as well. Compare areas.`,
        },
      ],
    });
  }
  if (variant === 2) {
    const R = r(3, 9);
    const rad = r(1, R - 1);
    const p = fracTex(R * R - rad * rad, R * R);
    return finish(meta, seed, r, {
      variant: "ring-region",
      prompt: `A circular target has radius ${R} cm. Its center is a circle of radius ${rad} cm, and the ring around it is shaded. A dart lands at a random point on the target. What is the probability that it lands in the shaded ring? Give a fraction in simplest form.`,
      hint: `The ring's area is the whole target's area (radius ${R} cm) minus the center circle's area (radius ${rad} cm). Both areas contain $\\pi$, which cancels in the ratio.`,
      explanation: [
        `The target's area is $\\pi(${R})^2=${R * R}\\pi$. The center circle's area is $\\pi(${rad})^2=${rad * rad}\\pi$.`,
        `The ring's area is $${R * R}\\pi-${rad * rad}\\pi=${R * R - rad * rad}\\pi$.`,
        `$P=\\dfrac{${R * R - rad * rad}\\pi}{${R * R}\\pi}=${p}$.`,
      ],
      correct: lab(p),
      wrong: [
        {
          label: lab(fracTex(R - rad, R)),
          feedback: `Probability compares areas, and area depends on the square of the radius. The ring is not $\\frac{${R - rad}}{${R}}$ of the area.`,
        },
        {
          label: lab(fracTex(rad * rad, R * R)),
          feedback: `That is the probability of landing in the center circle. The question asks for the ring.`,
        },
        {
          label: lab(fracTex(R * R - rad * rad, R * R, true)),
          feedback: `Both areas contain $\\pi$, so it cancels. The probability does not contain $\\pi$.`,
        },
        {
          label: lab(fracTex(rad, R)),
          feedback: `That is a ratio of radii. Compare the ring's area to the whole target's area.`,
        },
      ],
    });
  }
  const W = r(6, 12);
  const Lg = r(6, 12);
  const b = 2 * r(1, Math.floor(W / 2));
  const hh = r(2, Lg - 1);
  const area2 = b * hh;
  const p = fracTex(area2, 2 * W * Lg);
  return finish(meta, seed, r, {
    variant: "triangle-in-rectangle",
    prompt: `A point is chosen at random on a rectangle that is ${W} cm wide and ${Lg} cm tall. A shaded triangle inside the rectangle has base ${b} cm and height ${hh} cm. What is the probability that the point is in the triangle? Give a fraction in simplest form.`,
    hint: `The triangle's area is half of its base ${b} cm times its height ${hh} cm. Divide it by the rectangle's area, ${W} cm times ${Lg} cm.`,
    explanation: [
      `The rectangle's area is $${W}\\times${Lg}=${W * Lg}$. The triangle's area is $\\tfrac12(${b})(${hh})=${area2 / 2}$.`,
      `$P=\\dfrac{${area2 / 2}}{${W * Lg}}$.`,
      `In simplest form the probability is $${p}$.`,
    ],
    correct: lab(p),
    wrong: [
      {
        label: lab(fracTex(area2, W * Lg)),
        feedback: `A triangle's area is half of base times height. This forgot the $\\tfrac12$.`,
      },
      {
        label: lab(fracTex(W * Lg - area2 / 2, W * Lg)),
        feedback: `That is the probability of landing outside the triangle. The question asks for inside.`,
      },
      {
        label: lab(fracTex(area2 / 2, W + Lg)),
        feedback: `The denominator is the rectangle's area, ${W} times ${Lg}, not the sum of its sides.`,
      },
      {
        label: lab(fracTex(area2 / 2, area2 / 2 + W * Lg)),
        feedback: `The rectangle already includes the triangle. The whole area is ${W * Lg}, not the sum of the two areas.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Precalculus: composition, one-sided behavior, parametric equations
// ---------------------------------------------------------------------------

/** Polynomial text from coefficients, lowest degree first. */
function polyText(c: number[]): string {
  let out = "";
  for (let d = c.length - 1; d >= 0; d--) {
    const k = c[d]!;
    if (!k) continue;
    const mag = Math.abs(k);
    const body =
      d === 0 ? `${mag}` : `${mag === 1 ? "" : mag}x${d === 1 ? "" : `^${d}`}`;
    out += out ? ` ${k < 0 ? "-" : "+"} ${body}` : `${k < 0 ? "-" : ""}${body}`;
  }
  return out || "0";
}
const polyMul = (a: number[], b: number[]) => {
  const out = Array.from({ length: a.length + b.length - 1 }, () => 0);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j]! += x * y)));
  return out;
};
const polyAdd = (a: number[], b: number[]) =>
  Array.from(
    { length: Math.max(a.length, b.length) },
    (_, i) => (a[i] ?? 0) + (b[i] ?? 0),
  );
/** f(g(x)) where f is a polynomial in coefficient form and g another. */
function polyCompose(f: number[], g: number[]): number[] {
  let out: number[] = [0];
  let power: number[] = [1];
  for (const k of f) {
    out = polyAdd(
      out,
      power.map((v) => v * k),
    );
    power = polyMul(power, g);
  }
  return out;
}
const polyEq = (a: number[], b: number[]) => polyText(a) === polyText(b);

export function compositionOrderCase(seed: string): TexasHsCase {
  const meta = compositionOrderTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  let f: number[];
  let g: number[];
  if (variant === 0 || variant === 1) {
    f = [nonzeroIn(r, -5, 5), pick(r, [2, 3, -2, -3, 4])];
    g =
      variant === 0
        ? [nonzeroIn(r, -5, 5), pick(r, [2, 3, -1, -2, 5])]
        : [nonzeroIn(r, -4, 4), 0, 1];
  } else if (variant === 2) {
    const a = pick(r, [2, 3, 4, 5]);
    let b = pick(r, [2, 3, 4, 5, -2, -3]);
    while (b === a) b = pick(r, [2, 3, 4, 5, -2, -3]);
    f = [0, a];
    g = [0, b];
  } else {
    f = [nonzeroIn(r, -6, 6), 1];
    g = [nonzeroIn(r, -6, 6), 1];
  }
  const fText = polyText(f);
  const gText = polyText(g);
  const fg = polyCompose(f, g);
  const gf = polyCompose(g, f);
  const commute = polyEq(fg, gf);
  if (variant <= 1 && commute) return compositionOrderCase(`${seed}~`);
  const E = (c: number[]) => polyText(c);
  const prompt = `Let $f(x)=${fText}$ and $g(x)=${gText}$. Which statement about $f(g(x))$ and $g(f(x))$ is true?`;
  const hint = `For $f(g(x))$, replace every $x$ in $f(x)=${fText}$ with the whole expression $g(x)=${gText}$. For $g(f(x))$, replace every $x$ in $g$ with $f(x)$. Simplify both and compare.`;
  const prod = polyMul(f, g);
  const sum = polyAdd(f, g);
  if (!commute) {
    const label = (a: number[], b: number[], tail: string) =>
      `$f(g(x))=${E(a)}$ and $g(f(x))=${E(b)}$, so ${tail}`;
    return finish(meta, seed, r, {
      variant: variant === 0 ? "linear-pair" : "linear-quadratic",
      prompt,
      hint,
      explanation: [
        `For $f(g(x))$, put $g(x)=${gText}$ into $f$: $f(g(x))=${E(fg)}$.`,
        `For $g(f(x))$, put $f(x)=${fText}$ into $g$: $g(f(x))=${E(gf)}$.`,
        `These expressions are different, so $f(g(x))\\ne g(f(x))$. The order of composition matters.`,
      ],
      correct: label(fg, gf, "the order matters"),
      wrong: [
        {
          label: label(gf, fg, "the order matters"),
          feedback: `$f(g(x))$ applies $g$ first and then $f$, so $g(x)$ goes inside $f$. The two results were exchanged.`,
        },
        {
          label: `$f(g(x))=g(f(x))=${E(fg)}$, so the order does not matter`,
          feedback: `Composition is not commutative in general. Compute $g(f(x))$ separately: here it is a different expression.`,
        },
        {
          label: `$f(g(x))=g(f(x))=${E(prod)}$, so the order does not matter`,
          feedback: `Composition substitutes one function into the other; it does not multiply them. $f(x)g(x)$ is a product.`,
        },
        {
          label: `$f(g(x))=g(f(x))=${E(sum)}$, so the order does not matter`,
          feedback: `Composition substitutes one function into the other; it does not add them.`,
        },
      ],
    });
  }
  const shown = E(fg);
  return finish(meta, seed, r, {
    variant: variant === 2 ? "scalings-commute" : "shifts-commute",
    prompt,
    hint,
    explanation: [
      `Put $g(x)$ into $f$: $f(g(x))=${shown}$.`,
      `Put $f(x)$ into $g$: $g(f(x))=${E(gf)}$.`,
      `The two expressions are equal, so these two functions commute. That is not true for most pairs of functions.`,
    ],
    correct: `$f(g(x))=g(f(x))=${shown}$, so for these two functions the order does not matter`,
    wrong: [
      {
        label: `$f(g(x))=g(f(x))=${shown}$, so composition is commutative for every pair of functions`,
        feedback: `One pair that gives equal results does not prove it for all pairs. Many pairs of functions give different results in the two orders.`,
      },
      {
        label: `$f(g(x))=${shown}$ and $g(f(x))=${E(prod)}$, so the order matters`,
        feedback: `$g(f(x))$ substitutes $f(x)$ into $g$; it is not the product $f(x)g(x)$. Computing it by substitution gives $${shown}$.`,
      },
      {
        label: `$f(g(x))=g(f(x))=${E(prod)}$, so the order does not matter`,
        feedback: `Composition substitutes one function into the other; it does not multiply them.`,
      },
      {
        label: `$f(g(x))=g(f(x))=${E(sum)}$, so the order does not matter`,
        feedback: `Composition substitutes one function into the other; it does not add them.`,
      },
    ],
  });
}

const sgn = (v: number) => (v > 0 ? 1 : v < 0 ? -1 : 0);
const infText = (s: number) => (s > 0 ? "\\infty" : "-\\infty");

export function oneSidedBehaviorCase(seed: string): TexasHsCase {
  const meta = oneSidedBehaviorTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 5);
  const factor = (root: number) => `(x ${minus(root)})`;
  if (variant <= 3) {
    const c = nonzeroIn(r, -5, 5);
    let d = nonzeroIn(r, -5, 5);
    while (d === c) d = nonzeroIn(r, -5, 5);
    let z = nonzeroIn(r, -5, 5);
    while (z === c || z === d) z = nonzeroIn(r, -5, 5);
    const k = pick(r, [1, -1, 2, -2, 3]);
    const e = r(0, 1) === 0 ? 1 : 2;
    const s0 = sgn(k) * sgn(c - z) * sgn(c - d);
    const left = s0 * (e % 2 === 0 ? 1 : -1);
    const right = s0;
    const kText = k === 1 ? "" : k === -1 ? "-" : `${k}`;
    const fn = `f(x)=\\dfrac{${kText}${factor(z)}}{${factor(c)}${e === 2 ? "^2" : ""}${factor(d)}}`;
    const lab = (a: number, b: number) =>
      tex(
        `x\\to${c}^-:\\ f(x)\\to${infText(a)};\\quad x\\to${c}^+:\\ f(x)\\to${infText(b)}`,
      );
    const combos: [number, number][] = [
      [-1, 1],
      [1, -1],
      [1, 1],
      [-1, -1],
    ];
    const fbFor = ([a, b]: [number, number]) => {
      const bad = [a !== left, b !== right];
      if (bad[0] && bad[1])
        return `Check the sign of $f$ on each side of $x=${c}$: both behaviors are reversed. Test a point just left, like $x=${(c - 0.1).toFixed(1)}$, and one just right, like $x=${(c + 0.1).toFixed(1)}$.`;
      if (bad[0])
        return `The right side is correct, but just left of $x=${c}$ the factor ${e === 2 ? `$(x ${minus(c)})^2$ is positive, so it does not change the sign` : `$x ${minus(c)}$ is negative, which flips the sign`}. Recheck the sign on the left.`;
      return `The left side is correct, but just right of $x=${c}$ the sign of $f$ is ${right > 0 ? "positive" : "negative"}, so $f\\to${infText(right)}$ from the right.`;
    };
    return finish(meta, seed, r, {
      variant:
        e === 2 ? "even-multiplicity-asymptote" : "odd-multiplicity-asymptote",
      prompt: `For $${fn}$, there is a vertical asymptote at $x=${c}$. Which statement describes $f(x)$ as $x$ approaches ${c} from the left and from the right?`,
      hint: `Test a number just left of ${c} and one just right, such as ${(c - 0.1).toFixed(1)} and ${(c + 0.1).toFixed(1)}. Decide whether each factor is positive or negative there; the factor $x ${minus(c)}$ is the one that is close to 0.`,
      explanation: [
        `Near $x=${c}$ the factors other than $x ${minus(c)}$ keep a fixed sign: at $x=${c}$ they give a ${s0 > 0 ? "positive" : "negative"} value together with the constant.`,
        `Just right of ${c}, $x ${minus(c)}$ is positive, so $f$ is ${right > 0 ? "positive" : "negative"} and large: $f\\to${infText(right)}$. Just left of ${c}, $x ${minus(c)}$ is negative${e === 2 ? " but squared, which is positive" : ""}, so $f$ is ${left > 0 ? "positive" : "negative"}: $f\\to${infText(left)}$.`,
        `The behavior is: from the left $f\\to${infText(left)}$, from the right $f\\to${infText(right)}$.`,
      ],
      correct: lab(left, right),
      wrong: combos
        .filter(([a, b]) => a !== left || b !== right)
        .map((cb) => ({ label: lab(...cb), feedback: fbFor(cb) })),
    });
  }
  if (variant === 4) {
    const c = nonzeroIn(r, -5, 5);
    let p = nonzeroIn(r, -5, 5);
    while (p === c) p = nonzeroIn(r, -5, 5);
    const L = c - p;
    const lab = (t: string) => tex(t);
    return finish(meta, seed, r, {
      variant: "hole",
      prompt: `Let $f(x)=\\dfrac{${factor(c)}${factor(p)}}{x ${minus(c)}}$, which is undefined at $x=${c}$. Which statement describes $f(x)$ as $x$ approaches ${c} from the left and from the right?`,
      hint: `For every $x$ other than ${c}, the factor $x ${minus(c)}$ in the numerator and denominator cancels. Use the simplified expression to see what $f$ approaches.`,
      explanation: [
        `For $x\\ne${c}$, $\\dfrac{${factor(c)}${factor(p)}}{x ${minus(c)}}=x ${minus(p)}$.`,
        `As $x$ approaches ${c} from either side, $x ${minus(p)}$ approaches $${c} ${minus(p)}$, which is ${L}.`,
        `So $f\\to${L}$ from both sides. The graph has a hole at $(${c}, ${L})$, not an asymptote.`,
      ],
      correct: lab(
        `x\\to${c}^-:\\ f(x)\\to${L};\\quad x\\to${c}^+:\\ f(x)\\to${L}`,
      ),
      wrong: [
        {
          label: lab(
            `x\\to${c}^-:\\ f(x)\\to-\\infty;\\quad x\\to${c}^+:\\ f(x)\\to\\infty`,
          ),
          feedback: `The factor $x ${minus(c)}$ cancels, so there is no vertical asymptote. The graph has a hole instead.`,
        },
        {
          label: lab(
            `x\\to${c}^-:\\ f(x)\\to0;\\quad x\\to${c}^+:\\ f(x)\\to0`,
          ),
          feedback: `The numerator is 0 at $x=${c}$, but so is the denominator. Cancel the common factor before deciding.`,
        },
        {
          label: lab(
            `x\\to${c}^-:\\ f(x)\\to${-L};\\quad x\\to${c}^+:\\ f(x)\\to${-L}`,
          ),
          feedback: `After canceling, $f(x)=x ${minus(p)}$. Substitute $x=${c}$: $${c} ${minus(p)}=${L}$.`,
        },
      ].filter(
        (w) =>
          w.label !==
          lab(`x\\to${c}^-:\\ f(x)\\to${L};\\quad x\\to${c}^+:\\ f(x)\\to${L}`),
      ),
    });
  }
  // jump discontinuity in a piecewise function
  const c = nonzeroIn(r, -3, 3);
  const al = nonzeroIn(r, -3, 3);
  const be = nonzeroIn(r, -5, 5);
  const ga = nonzeroIn(r, -3, 3);
  let de = nonzeroIn(r, -8, 8);
  const A = al * c + be;
  while (ga * c + de === A) de = nonzeroIn(r, -9, 9);
  const B = ga * c + de;
  const lab = (a: number, b: number) =>
    tex(`x\\to${c}^-:\\ f(x)\\to${a};\\quad x\\to${c}^+:\\ f(x)\\to${b}`);
  const part = (m: number, b: number) => polyText([b, m]);
  return finish(meta, seed, r, {
    variant: "jump",
    prompt: `Let $f(x)=\\begin{cases}${part(al, be)} & x<${c}\\\\ ${part(ga, de)} & x\\ge${c}\\end{cases}$. Which statement describes $f(x)$ as $x$ approaches ${c} from the left and from the right?`,
    hint: `From the left of ${c} use the rule for $x<${c}$, and from the right use the rule for $x\\ge${c}$. Evaluate each rule at $x=${c}$ to see what it approaches.`,
    explanation: [
      `Left of ${c}, $f(x)=${part(al, be)}$, which approaches $${al}\\cdot${par(c)} ${plus(be)}=${A}$ as $x\\to${c}^-$.`,
      `Right of ${c}, $f(x)=${part(ga, de)}$, which approaches $${ga}\\cdot${par(c)} ${plus(de)}=${B}$ as $x\\to${c}^+$.`,
      `The two one-sided values differ (${A} and ${B}), so the graph jumps at $x=${c}$.`,
    ],
    correct: lab(A, B),
    wrong: [
      {
        label: lab(B, A),
        feedback: `The rule for $x<${c}$ controls the left side and the rule for $x\\ge${c}$ controls the right side. The two sides were exchanged.`,
      },
      {
        label: lab(A, A),
        feedback: `From the right, use the second rule, $${part(ga, de)}$, which approaches ${B}. The left value ${A} does not continue.`,
      },
      {
        label: lab(B, B),
        feedback: `From the left, use the first rule, $${part(al, be)}$, which approaches ${A}. The value ${B} belongs to the right side.`,
      },
    ],
  });
}

export function parametricRectangularCase(seed: string): TexasHsCase {
  const meta = parametricRectangularTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const eqn = (m: number, b: number) => ({
    label: tex(slopeIntercept(q(m), q(b))),
  });
  if (variant === 0) {
    const a = pick(r, [1, 2, -1, 3]);
    const s = pick(r, [-3, -2, 2, 3]);
    const b = nonzeroIn(r, -5, 5);
    const d = nonzeroIn(r, -5, 5);
    const c = s * a;
    const inter = d - s * b;
    const ax = `${a === 1 ? "" : a === -1 ? "-" : a}t ${plus(b)}`;
    const cy = `${c === 1 ? "" : c === -1 ? "-" : c}t ${plus(d)}`;
    const tExpr =
      a === 1
        ? `x ${minus(b)}`
        : a === -1
          ? `-(x ${minus(b)})`
          : `\\dfrac{x ${minus(b)}}{${a}}`;
    const right = eqn(s, inter);
    return finish(meta, seed, r, {
      variant: "linear-eliminate",
      prompt: `A point moves so that $x=${ax}$ and $y=${cy}$, where $t$ can be any real number. Which rectangular equation describes its path?`,
      hint: `Solve the equation $x=${ax}$ for $t$, then substitute that expression for $t$ into $y=${cy}$. Simplify to $y=mx+b$.`,
      explanation: [
        `Solve $x=${ax}$ for $t$: $t=${tExpr}$.`,
        `Substitute into $y=${cy}$: $y=${c === 1 ? "" : c === -1 ? "-" : c}\\cdot${a === 1 || a === -1 ? `\\left(${tExpr}\\right)` : tExpr} ${plus(d)}$. The factor ${c} and the divisor ${a} combine to ${s}, so $y=${s}(x ${minus(b)}) ${plus(d)}$.`,
        `Distribute and combine: ${right.label}.`,
      ],
      correct: right.label,
      wrong: [
        {
          ...eqn(s, d),
          feedback: `The $x$ equation has a constant ${b} that must be removed when solving for $t$. Keep track of it: $t$ is not simply $x$ divided by ${a}.`,
        },
        {
          ...eqn(s, d + s * b),
          feedback: `When solving $x=${ax}$ for $t$, subtract ${b} from both sides, so $t$ involves $x ${minus(b)}$. The sign of the constant was reversed.`,
        },
        {
          ...eqn(c, d - c * b),
          feedback: `The slope is the change in $y$ per change in $x$: ${c} per ${a}, which is ${s}. The $t$ coefficients were used as if $x$ increases by 1 for each unit of $t$.`,
        },
        {
          ...eqn(-s, d + s * b),
          feedback: `Check the sign of the slope: as $t$ increases, $x$ and $y$ ${s * 1 > 0 ? "move in the same direction" : "move in opposite directions"}.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const p = nonzeroIn(r, -5, 5);
    const q2 = nonzeroIn(r, -6, 6);
    const lab = (pp: number, qq: number) => ({
      label: tex(`y=(x ${minus(pp)})^2 ${qq === 0 ? "" : plus(qq)}`.trim()),
    });
    const right = lab(p, q2);
    return finish(meta, seed, r, {
      variant: "parabola-eliminate",
      prompt: `A point moves so that $x=t ${plus(p)}$ and $y=t^2 ${plus(q2)}$, where $t$ is any real number. Which rectangular equation describes its path?`,
      hint: `Solve $x=t ${plus(p)}$ for $t$, then replace $t$ in $y=t^2 ${plus(q2)}$.`,
      explanation: [
        `From $x=t ${plus(p)}$, $t=x ${minus(p)}$.`,
        `Substitute into $y=t^2 ${plus(q2)}$: $y=(x ${minus(p)})^2 ${plus(q2)}$.`,
        `The path is ${right.label}, a parabola.`,
      ],
      correct: right.label,
      wrong: [
        {
          ...lab(-p, q2),
          feedback: `To solve $x=t ${plus(p)}$ for $t$, subtract ${p} from both sides: $t=x ${minus(p)}$. The sign of ${Math.abs(p)} was changed.`,
        },
        {
          label: tex(`y=x^2 ${plus(q2)}`),
          feedback: `$t$ is not equal to $x$; it equals $x ${minus(p)}$. The shift ${p} was dropped.`,
        },
        {
          ...lab(p, -q2),
          feedback: `The constant in $y=t^2 ${plus(q2)}$ stays as written. Only $t$ is replaced.`,
        },
        {
          label: tex(`y=x^2 ${plus(q2 - p * p)}`),
          feedback: `$(t)^2=(x ${minus(p)})^2$, which is not $x^2 ${minus(p * p)}$. Squaring a difference gives a middle term.`,
        },
      ],
    });
  }
  if (variant === 2) {
    const rad = r(2, 5);
    const h = r(-4, 4);
    const k = r(-4, 4);
    const sq = (v: number, nameV: string) =>
      v === 0 ? `${nameV}^2` : `(${nameV} ${minus(v)})^2`;
    const lab = (hh: number, kk: number, rhs: number) => ({
      label: tex(`${sq(hh, "x")}+${sq(kk, "y")}=${rhs}`),
    });
    const hs = h === 0 ? "" : ` ${plus(h)}`;
    const ks = k === 0 ? "" : ` ${plus(k)}`;
    const right = lab(h, k, rad * rad);
    return finish(meta, seed, r, {
      variant: "circle-eliminate",
      prompt: `A point moves so that $x=${rad}\\cos t${hs}$ and $y=${rad}\\sin t${ks}$ for $0\\le t<2\\pi$. Which rectangular equation describes its path?`,
      hint: `Isolate $\\cos t$ and $\\sin t$, square each, and add. Use $\\cos^2t+\\sin^2t=1$.`,
      explanation: [
        `Solve each equation: $\\cos t=\\dfrac{x ${minus(h)}}{${rad}}$ and $\\sin t=\\dfrac{y ${minus(k)}}{${rad}}$.`,
        `Since $\\cos^2t+\\sin^2t=1$, $\\dfrac{(x ${minus(h)})^2}{${rad * rad}}+\\dfrac{(y ${minus(k)})^2}{${rad * rad}}=1$.`,
        `Multiply by ${rad * rad}: ${right.label}, a circle with radius ${rad}.`,
      ],
      correct: right.label,
      wrong: [
        {
          ...lab(h, k, rad),
          feedback: `The right side is the radius squared, ${rad * rad}, because each squared fraction has the denominator $${rad}^2=${rad * rad}$.`,
        },
        {
          ...lab(-h, -k, rad * rad),
          feedback: `The center is $(${h}, ${k})$: the circle is $(x-h)^2+(y-k)^2=r^2$, so subtract ${h} and ${k}. The signs were reversed.`,
        },
        {
          ...lab(h, k, 1),
          feedback: `After multiplying through by ${rad * rad}, the right side is ${rad * rad}, not 1.`,
        },
        {
          label: tex(`${sq(h, "x")}-${sq(k, "y")}=${rad * rad}`),
          feedback: `Adding $\\cos^2t$ and $\\sin^2t$ gives a sum of squares. A difference of squares would be a hyperbola.`,
        },
      ],
    });
  }
  const a = pick(r, [2, 3]);
  const h = nonzeroIn(r, -4, 4);
  const m = nonzeroIn(r, -4, 4);
  const b = nonzeroIn(r, -6, 6);
  const ytt = (kc: number, ka: number) => {
    // y = kc*t + ka as text
    const t = kc === 1 ? "t" : kc === -1 ? "-t" : `${kc}t`;
    return `${t}${ka === 0 ? "" : ` ${plus(ka)}`}`;
  };
  const xText = `${a}t ${plus(h)}`;
  const lab = (kc: number, ka: number) => ({
    label: tex(`x=${xText}\\text{ and }y=${ytt(kc, ka)}`),
  });
  const right = lab(m * a, m * h + b);
  return finish(meta, seed, r, {
    variant: "write-parametric",
    prompt: `A line has the rectangular equation $${slopeIntercept(q(m), q(b))}$. Which pair of parametric equations describes this line, using $x=${xText}$?`,
    hint: `The $x$ equation is given. Replace $x$ in $y=${m}x ${plus(b)}$ with $${xText}$ and simplify to get $y$ in terms of $t$.`,
    explanation: [
      `Substitute $x=${xText}$ into $y=${m}x ${plus(b)}$: $y=${m}(${xText}) ${plus(b)}$.`,
      `Distribute: $y=${m * a}t ${plus(m * h)} ${plus(b)}=${ytt(m * a, m * h + b)}$.`,
      `The parametric equations are ${right.label}.`,
    ],
    correct: right.label,
    wrong: [
      {
        ...lab(m * a, b),
        feedback: `Distribute ${m} to both terms of $${xText}$: the constant ${h} also becomes ${m * h}, and it must be added to ${b}.`,
      },
      {
        ...lab(m, m * h + b),
        feedback: `The coefficient of $t$ is the slope ${m} times the coefficient ${a} of $t$ in $x$, which is ${m * a}.`,
      },
      {
        ...lab(m * a, b - m * h),
        feedback: `Distribute ${m} to $${xText}$ and add it to ${b}: the constant is ${b} plus ${m * h}, not minus.`,
      },
      {
        ...lab(a, m * h + b),
        feedback: `The coefficient of $t$ in $y$ is the slope times ${a}, not ${a} alone.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Rotation: angular and linear velocity, reference angles, bearings
// ---------------------------------------------------------------------------

export function angularVelocityCase(seed: string): TexasHsCase {
  const meta = angularVelocityTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 4);
  const wheel = pick(r, ["wheel", "tire", "gear", "turntable"]);
  const lab = (text: string) => tex(text);
  if (variant === 0) {
    const n = r(2, 15) * 5;
    return finish(meta, seed, r, {
      variant: "angular-speed-from-rpm",
      prompt: `A ${wheel} turns at ${n} revolutions per minute. What is its angular speed in radians per minute?`,
      hint: `One full revolution is an angle of $2\\pi$ radians. Multiply the ${n} revolutions per minute by the radians in one revolution.`,
      explanation: [
        `One revolution is $2\\pi$ radians.`,
        `In one minute the ${wheel} turns ${n} revolutions, which is $${n}\\times2\\pi=${2 * n}\\pi$ radians.`,
        `The angular speed is $${2 * n}\\pi$ radians per minute.`,
      ],
      correct: lab(`${2 * n}\\pi\\text{ rad/min}`),
      wrong: [
        {
          label: lab(`${n}\\text{ rad/min}`),
          feedback: `A revolution is $2\\pi$ radians, not 1 radian. Convert revolutions to radians.`,
        },
        {
          label: lab(`${n}\\pi\\text{ rad/min}`),
          feedback: `A full revolution is $2\\pi$ radians; $\\pi$ is only a half revolution.`,
        },
        {
          label: lab(`\\dfrac{${n}}{2\\pi}\\text{ rad/min}`),
          feedback: `To convert revolutions to radians, multiply by $2\\pi$. Dividing converts the other way.`,
        },
      ],
    });
  }
  if (variant === 1) {
    const rad = r(2, 10) * 5;
    const n = r(2, 10) * 5;
    return finish(meta, seed, r, {
      variant: "linear-speed-of-rim",
      prompt: `A ${wheel} with radius ${rad} cm turns at ${n} revolutions per minute. How fast, in centimeters per minute, does a point on its rim move?`,
      hint: `In one revolution a point on the rim travels once around the circle, a distance of $2\\pi r$, with $r=${rad}$ cm. Multiply that distance by the ${n} revolutions per minute.`,
      explanation: [
        `In one revolution a point on the rim travels the circumference, $2\\pi r=2\\pi(${rad})=${2 * rad}\\pi$ cm.`,
        `It makes ${n} revolutions each minute, so it travels $${n}\\times${2 * rad}\\pi=${2 * rad * n}\\pi$ cm in a minute.`,
        `The linear speed is $${2 * rad * n}\\pi$ cm per minute.`,
      ],
      correct: lab(`${2 * rad * n}\\pi\\text{ cm/min}`),
      wrong: [
        {
          label: lab(`${rad * n}\\pi\\text{ cm/min}`),
          feedback: `The distance around a circle is $2\\pi r$, not $\\pi r$. The point travels the whole circumference each revolution.`,
        },
        {
          label: lab(`${2 * n}\\pi\\text{ cm/min}`),
          feedback: `That is the angular speed in radians per minute. To get linear speed, multiply by the radius ${rad} cm.`,
        },
        {
          label: lab(`${rad * rad * n}\\pi\\text{ cm/min}`),
          feedback: `$\\pi r^2$ is an area. The distance traveled in one revolution is the circumference, $2\\pi r$.`,
        },
      ],
    });
  }
  if (variant === 2) {
    const rad = pick(r, [20, 30, 40, 50]);
    const w = r(2, 12);
    const v = rad * w;
    const revs = `\\dfrac{${w}}{2\\pi}`;
    return finish(meta, seed, r, {
      variant: "angular-speed-from-linear",
      prompt: `A point on the rim of a ${wheel} with radius ${rad} cm moves at ${v} centimeters per second. What is the ${wheel}'s angular speed in radians per second?`,
      hint: `Arc length is radius times angle, so the rim speed ${v} cm per second is the radius ${rad} cm times the angular speed. Divide the rim speed by the radius.`,
      explanation: [
        `For a point at distance $r$ from the center, $v=r\\omega$, where $\\omega$ is angular speed in radians per second.`,
        `So $\\omega=\\dfrac{v}{r}=\\dfrac{${v}}{${rad}}=${w}$.`,
        `The angular speed is ${w} radians per second.`,
      ],
      correct: lab(`${w}\\text{ rad/s}`),
      wrong: [
        {
          label: lab(`${v * rad}\\text{ rad/s}`),
          feedback: `$v=r\\omega$, so $\\omega=v\\div r$. Multiplying gives the wrong direction.`,
        },
        {
          label: lab(`${revs}\\text{ rev/s}`),
          feedback: `That is revolutions per second. The question asks for radians per second; one revolution is $2\\pi$ radians.`,
        },
        {
          label: lab(`\\dfrac{${rad}}{${v}}\\text{ rad/s}`),
          feedback: `This divides the radius by the speed. Angular speed is speed divided by radius.`,
        },
      ],
    });
  }
  if (variant === 3) {
    const rad = r(2, 12) * 5;
    const w = r(2, 9);
    const t = r(2, 10);
    return finish(meta, seed, r, {
      variant: "distance-in-time",
      prompt: `A point on the rim of a ${wheel} with radius ${rad} cm turns at an angular speed of ${w} radians per second. How far along the rim, in centimeters, does the point travel in ${t} seconds?`,
      hint: `First find the angle the ${wheel} turns in ${t} seconds at ${w} radians per second. Then use arc length equals radius times angle in radians.`,
      explanation: [
        `In ${t} seconds the ${wheel} turns through $${w}\\times${t}=${w * t}$ radians.`,
        `The arc length is $s=r\\theta=${rad}\\times${w * t}=${rad * w * t}$ cm.`,
        `The point travels ${rad * w * t} centimeters.`,
      ],
      correct: lab(`${rad * w * t}\\text{ cm}`),
      wrong: [
        {
          label: lab(`${w * t}\\text{ cm}`),
          feedback: `${w * t} is the angle in radians. Multiply by the radius ${rad} cm to get the distance along the rim.`,
        },
        {
          label: lab(`${rad * w}\\text{ cm}`),
          feedback: `${rad * w} cm is how far the point moves in one second. The question asks about ${t} seconds.`,
        },
        {
          label: lab(`${2 * rad * w * t}\\pi\\text{ cm}`),
          feedback: `The angle is already in radians, so the arc length is radius times angle. There is no extra $2\\pi$ here.`,
        },
      ],
    });
  }
  const n = pick(r, [30, 60, 90, 120, 150, 180]);
  return finish(meta, seed, r, {
    variant: "rpm-to-radians-per-second",
    prompt: `A fan turns at ${n} revolutions per minute. What is its angular speed in radians per second?`,
    hint: `Convert ${n} revolutions per minute in two steps: revolutions to radians, using $2\\pi$ radians per revolution, and minutes to seconds, using 60 seconds per minute.`,
    explanation: [
      `Each revolution is $2\\pi$ radians, so ${n} revolutions per minute is $${2 * n}\\pi$ radians per minute.`,
      `There are 60 seconds in a minute, so divide by 60: $\\dfrac{${2 * n}\\pi}{60}=${lab(`${fracTex(2 * n, 60)}`).slice(1, -1)}\\pi$.`,
      `The angular speed is $${fracTex(2 * n, 60, true)}$ radians per second.`,
    ],
    correct: lab(`${fracTex(2 * n, 60, true)}\\text{ rad/s}`),
    wrong: [
      {
        label: lab(`${2 * n}\\pi\\text{ rad/s}`),
        feedback: `That is radians per minute. Divide by 60 to convert minutes to seconds.`,
      },
      {
        label: lab(`${fracTex(n, 60, true)}\\text{ rad/s}`),
        feedback: `A revolution is $2\\pi$ radians, not $\\pi$. This is half the correct speed.`,
      },
      {
        label: lab(`${fracTex(n, 60)}\\text{ rev/s}`),
        feedback: `That is revolutions per second. The question asks for radians per second; multiply by $2\\pi$.`,
      },
    ],
  });
}

const degTex = (v: number) => `${v}^\\circ`;
/** k twelfths of pi as exact TeX. */
function piTwelfths(k: number): string {
  if (k === 0) return "0";
  const g = gcd(Math.abs(k), 12);
  const n = Math.abs(k) / g;
  const d = 12 / g;
  const sign = k < 0 ? "-" : "";
  if (d === 1) return `${sign}${n === 1 ? "" : n}\\pi`;
  return `${sign}\\dfrac{${n === 1 ? "" : n}\\pi}{${d}}`;
}
const quadrantWord = ["I", "II", "III", "IV"];

export function referenceAngleCase(seed: string): TexasHsCase {
  const meta = referenceAngleTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  if (variant === 1 || (variant === 2 && r(0, 1) === 1)) {
    // radians
    const base = pick(r, [2, 3, 4, 8, 9, 10, 14, 15, 16, 20, 21, 22]);
    const turns = pick(r, [-2, -1, 0, 0, 1, 2]);
    const k = base + 24 * turns;
    const k0 = ((k % 24) + 24) % 24;
    const quad = Math.floor(k0 / 6);
    const refK =
      quad === 0 ? k0 : quad === 1 ? 12 - k0 : quad === 2 ? k0 - 12 : 24 - k0;
    const angle = piTwelfths(k);
    if (variant === 1 && k === refK) return referenceAngleCase(`${seed}~`);
    if (variant === 2) {
      const lab = (qd: number) => `Quadrant ${quadrantWord[qd]}`;
      return finish(meta, seed, r, {
        variant: "quadrant-radians",
        prompt: `In which quadrant does the terminal side of the angle $\\theta=${angle}$ radians lie when the angle is in standard position?`,
        hint: `Add or subtract full turns of $2\\pi$ from $${angle}$ until the angle is between 0 and $2\\pi$. Then compare it with $\\frac{\\pi}{2}$, $\\pi$ and $\\frac{3\\pi}{2}$.`,
        explanation: [
          `Standard position puts the vertex at the origin and the initial side on the positive $x$-axis. Positive angles turn counterclockwise and negative angles clockwise.`,
          `Adding or subtracting multiples of $2\\pi$ gives the coterminal angle $${piTwelfths(k0)}$ in $[0, 2\\pi)$.`,
          `That angle is between ${["0 and $\\frac{\\pi}{2}$", "$\\frac{\\pi}{2}$ and $\\pi$", "$\\pi$ and $\\frac{3\\pi}{2}$", "$\\frac{3\\pi}{2}$ and $2\\pi$"][quad]}, so the terminal side is in ${lab(quad)}.`,
        ],
        correct: lab(quad),
        wrong: [0, 1, 2, 3]
          .filter((qd) => qd !== quad)
          .map((qd) => ({
            label: lab(qd),
            feedback: `Reduce the angle to $[0, 2\\pi)$ first: it becomes $${piTwelfths(k0)}$, which is in ${lab(quad)}, not ${lab(qd)}.`,
          })),
      });
    }
    const lab = (v: number) => tex(piTwelfths(v));
    const cands = [
      12 - refK > 0 && 12 - refK !== refK ? 6 - refK : 0,
      12 - refK,
      12 + refK,
      24 - refK,
    ]
      .filter((v) => v > 0 && v !== refK)
      .map((v) => v);
    const wrong: Wrong[] = [];
    if (6 - refK > 0 && 6 - refK !== refK)
      wrong.push({
        label: lab(6 - refK),
        feedback: `That is the angle to the $y$-axis. The reference angle is measured from the $x$-axis.`,
      });
    if (k !== refK && k0 !== refK)
      wrong.push({
        label: lab(k),
        feedback: `Full turns of $2\\pi$ change nothing about where the terminal side points. Remove them, then measure the acute angle to the $x$-axis.`,
      });
    if (k0 !== refK)
      wrong.push({
        label: lab(k0),
        feedback: `A reference angle is always acute, between 0 and $\\frac{\\pi}{2}$. Measure from the terminal side to the nearest side of the $x$-axis.`,
      });
    for (const v of cands.filter((v) => v > 6))
      wrong.push({
        label: lab(v),
        feedback: `A reference angle is always acute, between 0 and $\\frac{\\pi}{2}$.`,
      });
    return finish(meta, seed, r, {
      variant: "reference-radians",
      prompt: `What is the reference angle of $\\theta=${angle}$ radians, the acute angle between the terminal side and the $x$-axis?`,
      hint: `Add or subtract full turns of $2\\pi$ from $${angle}$ to get an angle between 0 and $2\\pi$. Find its quadrant, then measure how far the terminal side is from the $x$-axis.`,
      explanation: [
        k === k0
          ? `The angle $${piTwelfths(k)}$ is already between 0 and $2\\pi$.`
          : `Remove full turns: the coterminal angle in $[0, 2\\pi)$ is $${piTwelfths(k0)}$.`,
        `It lies in quadrant ${quadrantWord[quad]}, where the reference angle is ${["the angle itself", "$\\pi$ minus the angle", "the angle minus $\\pi$", "$2\\pi$ minus the angle"][quad]}.`,
        `The reference angle is $${piTwelfths(refK)}$.`,
      ],
      correct: lab(refK),
      wrong,
    });
  }
  // degrees
  const bases: number[] = [];
  for (let b = 10; b < 360; b += 5) if (b % 90 !== 0) bases.push(b);
  const base = pick(r, bases);
  const turns = pick(r, [-2, -1, 0, 0, 1, 2]);
  const theta = base + 360 * turns;
  const t0 = ((theta % 360) + 360) % 360;
  const quad = Math.floor(t0 / 90);
  const ref =
    quad === 0 ? t0 : quad === 1 ? 180 - t0 : quad === 2 ? t0 - 180 : 360 - t0;
  const d = (v: number) => tex(degTex(v));
  if ((variant === 0 && theta === ref) || (variant === 3 && theta === t0))
    return referenceAngleCase(`${seed}~`);
  if (variant === 2) {
    const lab = (qd: number) => `Quadrant ${quadrantWord[qd]}`;
    return finish(meta, seed, r, {
      variant: "quadrant-degrees",
      prompt: `In which quadrant does the terminal side of an angle of $${degTex(theta)}$ in standard position lie?`,
      hint: `Add or subtract full turns of $360^\\circ$ from $${degTex(theta)}$ until the angle is between $0^\\circ$ and $360^\\circ$. Then compare it with $90^\\circ$, $180^\\circ$ and $270^\\circ$.`,
      explanation: [
        `Standard position puts the vertex at the origin and the initial side on the positive $x$-axis. Positive angles turn counterclockwise and negative angles clockwise.`,
        `Adding or subtracting multiples of $360^\\circ$ gives the coterminal angle $${degTex(t0)}$ in $[0^\\circ, 360^\\circ)$.`,
        `$${degTex(t0)}$ is between $${degTex(90 * quad)}$ and $${degTex(90 * quad + 90)}$, so the terminal side is in ${lab(quad)}.`,
      ],
      correct: lab(quad),
      wrong: [0, 1, 2, 3]
        .filter((qd) => qd !== quad)
        .map((qd) => ({
          label: lab(qd),
          feedback: `Reduce the angle first: $${degTex(theta)}$ is coterminal with $${degTex(t0)}$, which is in ${lab(quad)}, not ${lab(qd)}.`,
        })),
    });
  }
  if (variant === 3) {
    const reflect = 360 - t0;
    const opposite = (t0 + 180) % 360;
    const absMod = ((Math.abs(theta) % 360) + 360) % 360;
    const wrong: Wrong[] = [
      {
        label: d(reflect),
        feedback: `Coterminal angles differ by full turns, so they point the same way. $${degTex(reflect)}$ is the mirror image across the $x$-axis, which points elsewhere.`,
      },
      {
        label: d(opposite),
        feedback: `Adding $180^\\circ$ turns the terminal side around to the opposite direction. Coterminal angles differ by multiples of $360^\\circ$.`,
      },
      {
        label: d(absMod),
        feedback: `A negative angle turns clockwise, so its sign matters. Do not drop it before removing full turns.`,
      },
      {
        label: d((t0 + 90) % 360),
        feedback: `Coterminal angles differ by multiples of $360^\\circ$, not $90^\\circ$.`,
      },
    ].filter((w) => w.label !== d(t0));
    return finish(meta, seed, r, {
      variant: "coterminal",
      prompt: `Which angle between $0^\\circ$ and $360^\\circ$ is coterminal with $${degTex(theta)}$?`,
      hint: `Coterminal angles have the same terminal side and differ by multiples of $360^\\circ$. Add or subtract $360^\\circ$ until you land between $0^\\circ$ and $360^\\circ$.`,
      explanation: [
        `A full turn is $360^\\circ$, and adding or subtracting a full turn does not change the terminal side.`,
        theta < 0
          ? `Add $360^\\circ$ repeatedly: $${degTex(theta)}+${360 * Math.ceil(-theta / 360)}^\\circ=${degTex(t0)}$.`
          : `Subtract $360^\\circ$ repeatedly: $${degTex(theta)}-${360 * Math.floor(theta / 360)}^\\circ=${degTex(t0)}$.`,
        `The coterminal angle is $${degTex(t0)}$.`,
      ],
      correct: d(t0),
      wrong,
    });
  }
  const cands: Wrong[] = [];
  const push = (v: number, feedback: string) => {
    if (v !== ref) cands.push({ label: d(v), feedback });
  };
  push(
    90 - ref,
    `That is the angle between the terminal side and the $y$-axis. The reference angle is measured from the $x$-axis.`,
  );
  if (theta !== t0 && theta !== ref)
    push(
      theta,
      `Remove full turns of $360^\\circ$ first, then find the acute angle to the $x$-axis. The given angle itself is not acute.`,
    );
  if (t0 > 90)
    push(
      t0,
      `A reference angle is always acute, between $0^\\circ$ and $90^\\circ$. Measure from the terminal side to the nearest side of the $x$-axis.`,
    );
  push(
    180 - ref,
    `A reference angle is always acute, between $0^\\circ$ and $90^\\circ$.`,
  );
  push(
    180 + ref,
    `A reference angle is always acute, between $0^\\circ$ and $90^\\circ$.`,
  );
  push(
    360 - ref,
    `A reference angle is always acute, between $0^\\circ$ and $90^\\circ$.`,
  );
  return finish(meta, seed, r, {
    variant: "reference-degrees",
    prompt: `What is the reference angle of $${degTex(theta)}$, the acute angle between the terminal side and the $x$-axis, when the angle is in standard position?`,
    hint: `Add or subtract full turns of $360^\\circ$ from $${degTex(theta)}$ to get an angle between $0^\\circ$ and $360^\\circ$. Find its quadrant, then measure how far the terminal side is from the $x$-axis.`,
    explanation: [
      theta === t0
        ? `$${degTex(theta)}$ is already between $0^\\circ$ and $360^\\circ$.`
        : `Remove full turns: $${degTex(theta)}$ is coterminal with $${degTex(t0)}$.`,
      `$${degTex(t0)}$ lies in quadrant ${quadrantWord[quad]}, where the reference angle is ${["the angle itself", "$180^\\circ$ minus the angle", "the angle minus $180^\\circ$", "$360^\\circ$ minus the angle"][quad]}.`,
      `The reference angle is $${degTex(ref)}$.`,
    ],
    correct: d(ref),
    wrong: cands,
  });
}

type Comp = { rat: number; surd: boolean };
const compTex = ({ rat, surd }: Comp) =>
  surd ? `${rat === 1 ? "" : rat}\\sqrt{3}` : `${rat}`;
const ct = (c: Comp) => (c.surd ? `$${compTex(c)}$` : compTex(c));
const bearingText = (b: number) => `${String(b).padStart(3, "0")}^\\circ`;

export function bearingTrigCase(seed: string): TexasHsCase {
  const meta = bearingTrigTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const km = (c: Comp, dir?: string) =>
    tex(`${compTex(c)}\\text{ km${dir ? ` ${dir}` : ""}}`);
  if (variant === 2) {
    const base = pick(r, [30, 60]);
    const k = r(2, 9);
    const east = r(0, 1) === 0;
    const north = r(0, 1) === 0;
    // Legs: small leg k, large leg k*sqrt3. The angle from the N-S axis has tan = (E-W leg)/(N-S leg).
    const ewLeg: Comp =
      base === 30 ? { rat: k, surd: false } : { rat: k, surd: true };
    const nsLeg: Comp =
      base === 30 ? { rat: k, surd: true } : { rat: k, surd: false };
    const bearingOf = (b: number, n: boolean, e: boolean) =>
      n ? (e ? b : 360 - b) : e ? 180 - b : 180 + b;
    const right = bearingOf(base, north, east);
    const dirs = `${north ? "north" : "south"} and ${east ? "east" : "west"}`;
    return finish(meta, seed, r, {
      variant: "bearing-from-legs",
      prompt: `A hiker starts at a trailhead, walks ${ct(nsLeg)} km due ${north ? "north" : "south"}, and then ${ct(ewLeg)} km due ${east ? "east" : "west"}. A three-digit bearing is the angle measured clockwise from north. What is the bearing of the hiker from the trailhead?`,
      hint: `Sketch the two legs, ${ct(nsLeg)} km and ${ct(ewLeg)} km, as a right triangle. The angle at the trailhead between the north-south line and the line to the hiker has tangent equal to the east-west leg divided by the north-south leg. Then convert that angle to a clockwise-from-north bearing.`,
      explanation: [
        `The two legs are perpendicular. The angle $\\alpha$ between the north-south line and the hiker's direction satisfies $\\tan\\alpha=\\dfrac{${compTex(ewLeg)}}{${compTex(nsLeg)}}=${base === 30 ? "\\dfrac{1}{\\sqrt3}" : "\\sqrt3"}$, so $\\alpha=${degTex(base)}$.`,
        `The hiker is ${dirs} of the trailhead, so the bearing is ${north ? (east ? `$${degTex(base)}$ clockwise from north` : `$360^\\circ-${degTex(base)}$`) : east ? `$180^\\circ-${degTex(base)}$` : `$180^\\circ+${degTex(base)}$`}.`,
        `The bearing is $${bearingText(right)}$.`,
      ],
      correct: tex(bearingText(right)),
      wrong: [
        {
          label: tex(bearingText(bearingOf(90 - base, north, east))),
          feedback: `The tangent is the east-west leg over the north-south leg. These legs were exchanged, giving the complementary angle.`,
        },
        {
          label: tex(bearingText(bearingOf(base, north, !east))),
          feedback: `The hiker walked ${east ? "east" : "west"}, so the bearing falls on the ${east ? "east" : "west"} side of the north-south line.`,
        },
        {
          label: tex(bearingText((right + 180) % 360)),
          feedback: `That bearing points the opposite way, from the hiker back to the trailhead.`,
        },
      ],
    });
  }
  const base = pick(r, [30, 60]);
  const dist = r(2, 12) * 10;
  const sinOf: Comp =
    base === 30
      ? { rat: dist / 2, surd: false }
      : { rat: dist / 2, surd: true };
  const cosOf: Comp =
    base === 30
      ? { rat: dist / 2, surd: true }
      : { rat: dist / 2, surd: false };
  if (variant === 3) {
    // Compass-style bearing N/S alpha E/W
    const north = r(0, 1) === 0;
    const east = r(0, 1) === 0;
    const askNS = r(0, 1) === 0;
    const ask = askNS ? cosOf : sinOf;
    const other = askNS ? sinOf : cosOf;
    const word = askNS ? (north ? "north" : "south") : east ? "east" : "west";
    return finish(meta, seed, r, {
      variant: "compass-bearing-component",
      prompt: `A plane flies ${dist} km on a bearing of $\\mathrm{${north ? "N" : "S"}}\\,${degTex(base)}\\,\\mathrm{${east ? "E" : "W"}}$, which means $${degTex(base)}$ from ${north ? "north" : "south"} toward ${east ? "east" : "west"}. How many kilometers ${word} of its starting point is it?`,
      hint: `Draw a right triangle with the flight path as the hypotenuse and a ${north ? "north" : "south"}-pointing leg along the ${north ? "north" : "south"} line. The $${degTex(base)}$ angle sits between that leg and the path. Decide whether the leg you need is adjacent to or opposite the $${degTex(base)}$ angle.`,
      explanation: [
        `The path is the hypotenuse, ${dist} km. The $${degTex(base)}$ angle is between the ${north ? "north" : "south"} direction and the path.`,
        askNS
          ? `The ${north ? "north" : "south"} leg is adjacent to the $${degTex(base)}$ angle, so it equals $${dist}\\cos${degTex(base)}=${compTex(cosOf)}$ km.`
          : `The ${east ? "east" : "west"} leg is opposite the $${degTex(base)}$ angle, so it equals $${dist}\\sin${degTex(base)}=${compTex(sinOf)}$ km.`,
        `The plane is ${ct(ask)} km ${word} of its starting point.`,
      ],
      correct: km(ask),
      wrong: [
        {
          label: km(other),
          feedback: askNS
            ? `That is the east-west leg, opposite the $${degTex(base)}$ angle. The north-south leg is adjacent to it, so use cosine.`
            : `That is the north-south leg, adjacent to the $${degTex(base)}$ angle. The east-west leg is opposite it, so use sine.`,
        },
        {
          label: km({ rat: dist, surd: false }),
          feedback: `${dist} km is the length of the flight path, the hypotenuse. A leg of the triangle is shorter.`,
        },
        {
          label: km({ rat: dist, surd: ask.surd ? ask.surd : other.surd }),
          feedback: `The leg is ${dist} multiplied by a sine or cosine of $${degTex(base)}$, which is smaller than 1; it cannot be at least ${dist}.`,
        },
      ],
    });
  }
  // variants 0/1: three-digit bearing -> component with direction
  const B = pick(r, [30, 60, 120, 150, 210, 240, 300, 330]);
  const sinB = Math.abs(Math.sin((B * Math.PI) / 180));
  const sinIsHalf = Math.abs(sinB - 0.5) < 1e-9;
  const eastComp: Comp = sinIsHalf
    ? { rat: dist / 2, surd: false }
    : { rat: dist / 2, surd: true };
  const northComp: Comp = sinIsHalf
    ? { rat: dist / 2, surd: true }
    : { rat: dist / 2, surd: false };
  const isEast = B < 180;
  const isNorth = B < 90 || B > 270;
  const askEW = variant === 0;
  const right = askEW
    ? km(eastComp, isEast ? "east" : "west")
    : km(northComp, isNorth ? "north" : "south");
  const dirR = askEW ? (isEast ? "east" : "west") : isNorth ? "north" : "south";
  const opp = askEW ? (isEast ? "west" : "east") : isNorth ? "south" : "north";
  const mag = askEW ? eastComp : northComp;
  const swapMag = askEW ? northComp : eastComp;
  return finish(meta, seed, r, {
    variant: askEW ? "bearing-east-west" : "bearing-north-south",
    prompt: `A ship leaves port and travels ${dist} km on a bearing of $${bearingText(B)}$. A three-digit bearing is the angle measured clockwise from north. How far ${askEW ? "east or west" : "north or south"} of the port is the ship?`,
    hint: `Draw north upward and measure $${B}^\\circ$ clockwise. The path is the hypotenuse of a right triangle. Decide which leg is the ${askEW ? "east-west" : "north-south"} one, and which direction it points.`,
    explanation: [
      `A bearing of $${bearingText(B)}$ points ${B < 90 ? "between north and east" : B < 180 ? "between east and south" : B < 270 ? "between south and west" : "between west and north"}, so the ship is ${isNorth ? "north" : "south"} and ${isEast ? "east" : "west"} of the port.`,
      `The angle between the path and the north-south line is $${degTex(base === 30 ? (sinIsHalf ? 30 : 60) : sinIsHalf ? 30 : 60)}$ for this bearing; the ${askEW ? "east-west" : "north-south"} leg of the triangle is ${ct(mag)} km (using ${dist} km times ${sinIsHalf === askEW ? "$\\frac12$" : "$\\frac{\\sqrt3}{2}$"}).`,
      `The ship is ${ct(mag)} km ${dirR} of the port.`,
    ],
    correct: right,
    wrong: [
      {
        label: km(swapMag, dirR),
        feedback: `The ${askEW ? "east-west" : "north-south"} leg uses ${askEW ? "sine of the bearing's angle from north" : "cosine of the bearing's angle from north"}. These were exchanged.`,
      },
      {
        label: km(mag, opp),
        feedback: `The magnitude is right but the direction is not. A bearing of $${bearingText(B)}$ puts the ship ${isNorth ? "north" : "south"} and ${isEast ? "east" : "west"} of the port.`,
      },
      {
        label: km(swapMag, opp),
        feedback: `Both the leg and the direction are wrong. Check which leg is the ${askEW ? "east-west" : "north-south"} one and which way the bearing points.`,
      },
      {
        label: km({ rat: dist, surd: false }, dirR),
        feedback: `${dist} km is the length of the path, the hypotenuse. The ${askEW ? "east-west" : "north-south"} distance is one leg of the triangle.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Series in sigma notation and infinite geometric sums
// ---------------------------------------------------------------------------

type Series = { terms: number[]; label: string };

export function sigmaNotationCase(seed: string): TexasHsCase {
  const meta = sigmaNotationTemplate;
  const r = begin(meta, seed);
  const geometric = r(0, 1) === 1;
  const n = r(5, 9);
  const sum = (lo: number, hi: number, body: string) =>
    tex(`\\sum_{k=${lo}}^{${hi}}${body}`);
  const lin = (c: number, k0: number) =>
    // c*k + k0
    `${c === 1 ? "" : c === -1 ? "-" : c}k${k0 === 0 ? "" : ` ${plus(k0)}`}`;
  const build = (
    termOf: (k: number) => number,
    lo: number,
    hi: number,
    body: string,
  ): Series => ({
    terms: Array.from({ length: hi - lo + 1 }, (_, i) => termOf(lo + i)),
    label: sum(lo, hi, body),
  });
  if (!geometric) {
    const a1 = nonzeroIn(r, -6, 12);
    const dd = pick(r, [2, 3, 4, 5, -2, -3, -4]);
    const c0 = a1 - dd;
    const t = (k: number) => a1 + dd * (k - 1);
    const listing = `${[1, 2, 3]
      .map((k) => t(k))
      .join(" + ")
      .replace(/\+ -/g, "- ")} + \\cdots + ${t(n)}`.replace(
      /\+ \\cdots \+ -/,
      "+ \\cdots - ",
    );
    const form = r(0, 2);
    const correct: Series =
      form === 0
        ? build(t, 1, n, `\\left(${lin(dd, c0)}\\right)`)
        : form === 1
          ? build(
              t,
              1,
              n,
              `\\left(${a1}${dd < 0 ? "-" : "+"}${Math.abs(dd)}(k-1)\\right)`,
            )
          : build(
              (k) => a1 + dd * k,
              0,
              n - 1,
              `\\left(${a1}${dd < 0 ? "-" : "+"}${Math.abs(dd)}k\\right)`,
            );
    const wrongs: Series[] = [
      build((k) => dd * k + a1, 1, n, `\\left(${lin(dd, a1)}\\right)`),
      build(t, 1, n - 1, `\\left(${lin(dd, c0)}\\right)`),
      build(
        (k) => a1 + dd * k,
        0,
        n,
        `\\left(${a1}${dd < 0 ? "-" : "+"}${Math.abs(dd)}k\\right)`,
      ),
      build((k) => a1 * k + dd, 1, n, `\\left(${lin(a1, dd)}\\right)`),
    ].filter((w) => JSON.stringify(w.terms) !== JSON.stringify(correct.terms));
    const feedback = [
      `At $k=1$ this gives ${dd + a1}, not the first term ${a1}. The first term has no common difference added yet.`,
      `This stops at $k=${n - 1}$, so it has ${n - 1} terms. The series has ${n}.`,
      `Starting at $k=0$ and ending at $k=${n}$ gives ${n + 1} terms. The series has ${n}.`,
      `The common difference ${dd} multiplies $k$ (or $k-1$); the first term ${a1} is not the coefficient of $k$.`,
    ];
    return finish(meta, seed, r, {
      variant: "arithmetic-series",
      prompt: `Which sigma notation represents the series $${listing}$, which has ${n} terms?`,
      hint: `The terms increase by a constant ${dd < 0 ? `${dd}` : dd}. Write the $k$th term in terms of $k$, then check that the first term (at the first index) is ${a1} and the last is ${t(n)}.`,
      explanation: [
        `The series is arithmetic with first term ${a1} and common difference ${dd}, so the term in position $k$ is $${a1}${dd < 0 ? "-" : "+"}${Math.abs(dd)}(k-1)=${lin(dd, c0)}$.`,
        `There are ${n} terms, so the index runs through ${n} values.`,
        `Check the ends: the first term is ${t(1)} and the last is ${t(n)}. The sigma notation is ${correct.label}.`,
      ],
      correct: correct.label,
      wrong: wrongs
        .map((w, i) => ({ label: w.label, feedback: feedback[i]! }))
        .slice(0, 4),
    });
  }
  const a1 = nonzeroIn(r, -4, 5);
  const ratio = pick(r, [2, 3, -2, -3, 4]);
  const t = (k: number) => a1 * ratio ** (k - 1);
  const rText = ratio < 0 ? `(${ratio})` : `${ratio}`;
  const geoBody = (c: number, base: string, exp: string) =>
    c === 1
      ? `${base}^{${exp}}`
      : c === -1
        ? `-${base}^{${exp}}`
        : `${c}\\cdot${base}^{${exp}}`;
  const coef = (c: number) => (c === 1 ? "" : c === -1 ? "-" : `${c}`);
  const nmax = Math.min(n, ratio === 4 ? 6 : 8);
  const listing =
    [1, 2, 3, 4]
      .map((k) => t(k))
      .map((v, i) => (i === 0 ? `${v}` : v < 0 ? `- ${-v}` : `+ ${v}`))
      .join(" ") + ` + \\cdots ${t(nmax) < 0 ? "-" : "+"} ${Math.abs(t(nmax))}`;
  const correct: Series =
    r(0, 1) === 0
      ? build(t, 1, nmax, geoBody(a1, rText, "k-1"))
      : build((k) => a1 * ratio ** k, 0, nmax - 1, geoBody(a1, rText, "k"));
  const wrongs: Series[] = [
    build((k) => a1 * ratio ** k, 1, nmax, geoBody(a1, rText, "k")),
    build(t, 1, nmax - 1, geoBody(a1, rText, "k-1")),
    build(
      (k) => (a1 * ratio) ** (k - 1),
      1,
      nmax,
      `\\left(${a1 * ratio}\\right)^{k-1}`,
    ),
    build(
      (k) => ratio * a1 ** (k - 1),
      1,
      nmax,
      `${rText}\\cdot${a1 < 0 ? `(${a1})` : a1}^{k-1}`,
    ),
  ].filter((w) => JSON.stringify(w.terms) !== JSON.stringify(correct.terms));
  const fb = [
    `At $k=1$ this gives ${a1 * ratio}, not the first term ${a1}. A geometric term multiplies by the ratio once fewer times than its position.`,
    `This stops at $k=${nmax - 1}$, so it has ${nmax - 1} terms. The series has ${nmax}.`,
    `The first term ${a1} is the multiplier, and only the ratio ${ratio} is raised to the power. Here the first term and ratio were combined.`,
    `The ratio ${ratio} is raised to a power and the first term ${a1} multiplies it. The two numbers were exchanged.`,
  ];
  return finish(meta, seed, r, {
    variant: "geometric-series",
    prompt: `Which sigma notation represents the series $${listing}$, which has ${nmax} terms?`,
    hint: `Each term of $${listing}$ is the one before multiplied by the same ratio. Find that ratio, then write the $k$th term as the first term times the ratio to a power, and check the first and last terms.`,
    explanation: [
      `The series is geometric with first term ${a1} and ratio ${ratio}: $${t(2)}\\div${t(1)}=${ratio}$.`,
      `The $k$th term is $${a1}\\cdot${rText}^{k-1}$, and there are ${nmax} terms.`,
      `Check the ends: the first term is ${t(1)} and the last is ${t(nmax)}. The sigma notation is ${correct.label}.`,
    ],
    correct: correct.label,
    wrong: wrongs
      .map((w, i) => ({ label: w.label, feedback: fb[i]! }))
      .slice(0, 4),
  });
}

const ratTex = (n: number, d: number) => {
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(Math.abs(n), d) || 1;
  const [a, b] = [n / g, d / g];
  if (b === 1) return `${a}`;
  return a < 0 ? `-\\dfrac{${-a}}{${b}}` : `\\dfrac{${a}}{${b}}`;
};

export function infiniteGeometricCase(seed: string): TexasHsCase {
  const meta = infiniteGeometricTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const lab = (n: number, d: number) => tex(ratTex(n, d));
  const none = "The series has no finite sum";
  if (variant === 2) {
    const a = nonzeroIn(r, -6, 8);
    const rr = pick(r, [2, 3, -2, 1, -1]);
    const terms = [a, a * rr, a * rr * rr, a * rr ** 3];
    const listing = terms
      .map((v, i) => (i === 0 ? `${v}` : v < 0 ? `- ${-v}` : `+ ${v}`))
      .join(" ");
    const values = [
      rr === 1 ? null : lab(a, 1 - rr),
      1 + rr === 0 ? null : lab(a, 1 + rr),
      1 - rr === 0 ? null : lab(a * rr, 1 - rr),
      lab(terms[0]! + terms[1]! + terms[2]! + terms[3]!, 1),
    ].filter((v): v is string => v !== null);
    const feedback = [
      `The formula $\\dfrac{a}{1-r}$ works only when $|r|<1$. With $r=${rr}$ it produces a number, but the series does not add up to it.`,
      `The formula uses $1-r$, not $1+r$, and it works only when $|r|<1$.`,
      `The formula uses the first term $a$, and only when $|r|<1$. This series does not have a finite sum.`,
      `That is the sum of just the four terms shown. The series continues forever, and its terms do not shrink.`,
    ];
    return finish(meta, seed, r, {
      variant: "ratio-too-large",
      prompt: `What is the sum of the infinite geometric series $${listing} + \\cdots$?`,
      hint: `An infinite geometric series has a finite sum only when the absolute value of the ratio is less than 1. Find the ratio of $${listing}$ by dividing a term by the one before it.`,
      explanation: [
        `The ratio is $r=${rr}$, because each term is ${rr} times the one before.`,
        `A finite sum requires $|r|<1$. Here $|${rr}|=${Math.abs(rr)}$, which is not less than 1, so the terms do not shrink toward 0.`,
        `Adding more terms never settles on a number, so the series has no finite sum.`,
      ],
      correct: none,
      wrong: values.map((l, i) => ({ label: l, feedback: feedback[i]! })),
    });
  }
  if (variant === 3) {
    const [p, qq] = pick(r, [
      [1, 2],
      [2, 3],
      [1, 3],
      [3, 5],
      [3, 4],
    ] as const);
    const h = (qq - p) * r(1, 4);
    const total = (h * (qq + p)) / (qq - p);
    const bounce = h * p;
    return finish(meta, seed, r, {
      variant: "bouncing-ball",
      prompt: `A ball is dropped from a height of ${h} ${h === 1 ? "meter" : "meters"}. After each fall it bounces back up to $\\frac{${p}}{${qq}}$ of the height it fell. Assume it keeps bouncing forever. What is the total distance the ball travels, counting every fall and every rise, in meters?`,
      hint: `After the first drop of ${h} ${h === 1 ? "meter" : "meters"}, each bounce is a rise and then a fall of the same length. Write the bounce heights as a geometric series with ratio $\\frac{${p}}{${qq}}$, double them, and add the first drop separately.`,
      explanation: [
        `The first drop is ${h} ${h === 1 ? "meter" : "meters"}. The first bounce rises $${h}\\cdot\\frac{${p}}{${qq}}=${ratTex(bounce, qq)}$ meters, and each later rise is $\\frac{${p}}{${qq}}$ of the one before.`,
        `Each rise is followed by an equal fall, so the bounces add $2\\cdot\\dfrac{${ratTex(bounce, qq)}}{1-\\frac{${p}}{${qq}}}=${ratTex(2 * bounce, qq - p)}$ meters. The sum exists because $|r|=\\frac{${p}}{${qq}}<1$.`,
        `The total is $${h}+${ratTex(2 * bounce, qq - p)}=${total}$ meters.`,
      ],
      correct: tex(`${total}`),
      wrong: [
        {
          label: lab(h * qq, qq - p),
          feedback: `That counts only the falls, $h+hr+hr^2+\\cdots$. The ball also rises after each bounce.`,
        },
        {
          label: lab(2 * h * qq, qq - p),
          feedback: `That counts the first ${h} meters as both a fall and a rise. The first drop is a fall only, with no rise before it.`,
        },
        {
          label: lab(h * p, qq - p),
          feedback: `That counts only the rises, $hr+hr^2+\\cdots$. It leaves out the first drop and every fall.`,
        },
      ],
    });
  }
  // variants 0 and 1: a series with a rational ratio, listed or in sigma notation
  const [p, qq] = pick(r, [
    [1, 2],
    [1, 3],
    [2, 3],
    [1, 4],
    [3, 4],
    [-1, 2],
    [-1, 3],
    [-2, 3],
    [-1, 4],
  ] as const);
  const m = r(1, 2);
  const c = m * qq * qq;
  const rText = p < 0 ? `-\\frac{${-p}}{${qq}}` : `\\frac{${p}}{${qq}}`;
  const rBase = p < 0 ? `\\left(${rText}\\right)` : `\\left(${rText}\\right)`;
  const form = variant === 0 ? 0 : r(1, 3);
  const firstValue = form === 3 ? m * qq * p : c;
  const sumNum = firstValue * qq;
  const sumDen = qq - p;
  const correctLabel = lab(sumNum, sumDen);
  const prompt =
    form === 0
      ? `Find the sum of the infinite geometric series $${[
          c,
          m * qq * p,
          m * p * p,
        ]
          .map((v, i) => (i === 0 ? `${v}` : v < 0 ? `- ${-v}` : `+ ${v}`))
          .join(" ")}+\\cdots$.`
      : form === 1
        ? `Find the sum $\\displaystyle\\sum_{k=1}^{\\infty}${c}${rBase}^{k-1}$.`
        : form === 2
          ? `Find the sum $\\displaystyle\\sum_{k=0}^{\\infty}${c}${rBase}^{k}$.`
          : `Find the sum $\\displaystyle\\sum_{k=1}^{\\infty}${c}${rBase}^{k}$.`;
  const startNote =
    form === 3
      ? `The sum starts at $k=1$ with $${c}${rBase}^1=${firstValue}$, so $a=${firstValue}$.`
      : `The first term is $a=${firstValue}$.`;
  const pool: Wrong[] = [
    form === 3
      ? {
          label: lab(c * qq, sumDen),
          feedback: `The sum starts at $k=1$, so the first term is $${c}${rBase}^1=${firstValue}$, not ${c}. Use the first term that is actually in the sum.`,
        }
      : {
          label: lab(c * p, sumDen),
          feedback: `${c} is the first term here. $\\dfrac{a}{1-r}$ uses the first term as $a$; multiplying by $r$ skips the first term.`,
        },
    {
      label: lab(firstValue * qq, qq + p),
      feedback: `The denominator is $1-r$, not $1+r$. Subtract the ratio $${rText}$ from 1.`,
    },
    {
      label: none,
      feedback: `The ratio $${rText}$ has absolute value less than 1, so the terms shrink toward 0 and the series has a finite sum.`,
    },
    {
      label: lab(firstValue, 1),
      feedback: `${firstValue} is only the first term. Use $\\dfrac{a}{1-r}$ to add all of the terms.`,
    },
  ].filter((w) => w.label !== correctLabel);
  return finish(meta, seed, r, {
    variant:
      form === 0
        ? "listed-series"
        : form === 3
          ? "sigma-starting-at-second-term"
          : "sigma-series",
    prompt,
    hint: `Find the first term $a$ and the ratio $r$; the number ${c} in the series is ${form === 0 ? "the first term" : "the multiplier of the powers"}. If $|r|<1$, the sum is $\\dfrac{a}{1-r}$. Check which term the series starts with before choosing $a$.`,
    explanation: [
      `${startNote} The ratio is $r=${rText}$, and $|r|<1$, so the series has a finite sum.`,
      `The sum is $\\dfrac{a}{1-r}=\\dfrac{${firstValue}}{1-${p < 0 ? `\\left(${rText}\\right)` : rText}}$.`,
      `Simplify: $1-r=${ratTex(qq - p, qq)}$, so the sum is $${firstValue}\\cdot${ratTex(qq, qq - p)}=${ratTex(sumNum, sumDen)}$.`,
    ],
    correct: correctLabel,
    wrong: pool.slice(0, 4),
  });
}

// ---------------------------------------------------------------------------
// Polynomial and rational inequalities in interval notation
// ---------------------------------------------------------------------------

type Factor = { root: number; power: number };
type Op = "<" | ">" | "<=" | ">=";
const opTex: Record<Op, string> = {
  "<": "<",
  ">": ">",
  "<=": "\\le",
  ">=": "\\ge",
};
const flipDirection = (op: Op): Op =>
  op === "<" ? ">" : op === ">" ? "<" : op === "<=" ? ">=" : "<=";
const flipStrict = (op: Op): Op =>
  op === "<" ? "<=" : op === ">" ? ">=" : op === "<=" ? "<" : ">";
const isStrict = (op: Op) => op === "<" || op === ">";

/** Numerator factors have positive power and denominator factors negative power. */
function signAt(x: number, lead: number, factors: Factor[]): number {
  let sign = lead < 0 ? -1 : 1;
  for (const f of factors) {
    const base = x - f.root < 0 ? -1 : 1;
    if (Math.abs(f.power) % 2 === 1) sign *= base;
  }
  return sign;
}

type Segment = { lo: number; hi: number; loClosed: boolean; hiClosed: boolean };
/** Exact solution set of lead * product(x - root)^power  op  0, as merged segments. */
function solveSigns(lead: number, factors: Factor[], op: Op): Segment[] {
  const roots = [...new Set(factors.map((f) => f.root))].sort((a, b) => a - b);
  const wantPositive = op === ">" || op === ">=";
  const tests: number[] = [roots[0]! - 1];
  for (let i = 0; i + 1 < roots.length; i++)
    tests.push((roots[i]! + roots[i + 1]!) / 2);
  tests.push(roots[roots.length - 1]! + 1);
  type Atom = Segment;
  const atoms: (Atom | null)[] = [];
  tests.forEach((t, i) => {
    const ok = signAt(t, lead, factors) > 0 === wantPositive;
    const lo = i === 0 ? -Infinity : roots[i - 1]!;
    const hi = i === roots.length ? Infinity : roots[i]!;
    atoms.push(ok ? { lo, hi, loClosed: false, hiClosed: false } : null);
    if (i < roots.length) {
      const root = roots[i]!;
      const numerator = factors.some((f) => f.root === root && f.power > 0);
      atoms.push(
        !isStrict(op) && numerator
          ? { lo: root, hi: root, loClosed: true, hiClosed: true }
          : null,
      );
    }
  });
  const out: Segment[] = [];
  let current: Segment | null = null;
  for (const atom of atoms) {
    if (!atom) {
      if (current) out.push(current);
      current = null;
    } else if (!current) current = { ...atom };
    else {
      current.hi = atom.hi;
      current.hiClosed = atom.hiClosed;
    }
  }
  if (current) out.push(current);
  return out;
}
function intervalText(segments: Segment[]): string {
  if (!segments.length) return "\\varnothing";
  return segments
    .map((s) => {
      if (s.lo === s.hi) return `\\{${s.lo}\\}`;
      const lo = s.lo === -Infinity ? "-\\infty" : `${s.lo}`;
      const hi = s.hi === Infinity ? "\\infty" : `${s.hi}`;
      return `${s.loClosed ? "[" : "("}${lo},${hi}${s.hiClosed ? "]" : ")"}`;
    })
    .join("\\cup");
}
const factorText = (f: Factor) => {
  const power = Math.abs(f.power) === 1 ? "" : `^${Math.abs(f.power)}`;
  return f.root === 0 ? `x${power}` : `(x ${minus(f.root)})${power}`;
};
/** A product of factors; a lone first-power factor needs no parentheses. */
const groupText = (fs: Factor[]) => {
  const text = fs.map(factorText).join("");
  return fs.length === 1 && Math.abs(fs[0]!.power) === 1
    ? text.replace(/^\(|\)$/g, "")
    : text;
};

function distinctRoots(r: Random, count: number): number[] {
  const roots = new Set<number>();
  while (roots.size < count) roots.add(r(-5, 5));
  return [...roots].sort((a, b) => a - b);
}

/** Describe the sign of the expression on each interval, in order. */
function signChartSentence(
  lead: number,
  factors: Factor[],
  what: string,
): string {
  const roots = [...new Set(factors.map((f) => f.root))].sort((a, b) => a - b);
  const tests: number[] = [roots[0]! - 1];
  for (let i = 0; i + 1 < roots.length; i++)
    tests.push((roots[i]! + roots[i + 1]!) / 2);
  tests.push(roots[roots.length - 1]! + 1);
  const bounds = (i: number) =>
    `${i === 0 ? "-\\infty" : roots[i - 1]!},${i === roots.length ? "\\infty" : roots[i]!}`;
  return tests
    .map(
      (t, i) =>
        `on $(${bounds(i)})$ ${what} is ${signAt(t, lead, factors) > 0 ? "positive" : "negative"}`,
    )
    .join("; ");
}

export function polynomialInequalityCase(seed: string): TexasHsCase {
  const meta = polynomialInequalityTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  let factors: Factor[];
  let lead = 1;
  let expression: string;
  let factorNote = "";
  if (variant === 3) {
    const c = r(2, 5);
    factors = [
      { root: -c, power: 1 },
      { root: 0, power: 1 },
      { root: c, power: 1 },
    ];
    expression = `x^3 ${minus(c * c)}x`;
    factorNote = `Factor first: $x^3 ${minus(c * c)}x=x(x ${minus(c)})(x ${plus(c)})$. `;
  } else {
    const count = variant === 0 ? 2 : 3;
    const roots = distinctRoots(r, count);
    factors = roots.map((root) => ({ root, power: 1 }));
    if (variant === 2) factors[r(0, count - 1)]!.power = 2;
    lead = r(0, 3) === 0 ? -1 : 1;
    expression = `${lead < 0 ? "-" : ""}${factors.map(factorText).join("")}`;
  }
  const op = pick(r, ["<", ">", "<=", ">="] as const);
  const solution = solveSigns(lead, factors, op);
  const label = (segments: Segment[]) => ({
    label: tex(intervalText(segments)),
    key: intervalText(segments),
  });
  const right = label(solution);
  const flipped = label(solveSigns(lead, factors, flipDirection(op)));
  const strict = label(solveSigns(lead, factors, flipStrict(op)));
  const both = label(solveSigns(lead, factors, flipDirection(flipStrict(op))));
  const ignoreLead = label(solveSigns(1, factors, op));
  const simple = label(
    solveSigns(
      lead,
      factors.map((f) => ({ ...f, power: 1 })),
      op,
    ),
  );
  const chart = signChartSentence(lead, factors, "the expression");
  const roots = [...new Set(factors.map((f) => f.root))].sort((a, b) => a - b);
  return finish(meta, seed, r, {
    variant:
      variant === 3
        ? "factor-then-solve"
        : variant === 2
          ? "repeated-root"
          : variant === 0
            ? "two-roots"
            : "three-roots",
    prompt: `Solve $${expression}${opTex[op]}0$. Write the solution in interval notation.`,
    hint: `${variant === 3 ? "Factor the expression completely first. " : ""}The expression can change sign only at its zeros. Find the ${roots.length} zeros of $${expression}$, then test one number in each interval between them and decide whether the endpoints are included.`,
    explanation: [
      `${factorNote}The zeros are $${roots.join(", ")}$. They split the number line into ${roots.length + 1} intervals.`,
      `Testing a number in each interval: ${chart}.`,
      `${isStrict(op) ? "The inequality is strict, so the zeros are not included." : "The inequality allows equality, so the zeros are included."} The solution is ${right.label}.`,
    ],
    correct: right.label,
    key: right.key,
    wrong: [
      {
        ...flipped,
        feedback: `This is the solution of the inequality with the opposite direction. Re-check the sign on each interval against $${opTex[op]}0$.`,
      },
      {
        ...strict,
        feedback: isStrict(op)
          ? `The inequality is strict, so the zeros are not solutions. Use parentheses at them.`
          : `The inequality includes equality, so the zeros are solutions. Use brackets at the zeros.`,
      },
      {
        ...both,
        feedback: `This reverses both the direction and the endpoints. The answer should satisfy $${opTex[op]}0$ exactly.`,
      },
      ...(lead < 0
        ? [
            {
              ...ignoreLead,
              feedback: `The negative sign in front of the product flips the sign on every interval. Include it when testing.`,
            },
          ]
        : []),
      ...(variant === 2
        ? [
            {
              ...simple,
              feedback: `A factor that is squared does not change sign at its zero, so the sign chart treats that zero differently. Check the sign on both sides of it.`,
            },
          ]
        : []),
      {
        ...label(solveSigns(lead, factors.slice(1), op)),
        feedback: `Every zero splits the number line. This leaves one out.`,
      },
    ],
  });
}

export function rationalInequalityCase(seed: string): TexasHsCase {
  const meta = rationalInequalityTemplate;
  const r = begin(meta, seed);
  const variant = r(0, 3);
  const roots = distinctRoots(r, 3);
  let factors: Factor[];
  if (variant === 0)
    factors = [
      { root: roots[0]!, power: 1 },
      { root: roots[1]!, power: -1 },
    ];
  else if (variant === 1)
    factors = [
      { root: roots[0]!, power: 1 },
      { root: roots[1]!, power: 1 },
      { root: roots[2]!, power: -1 },
    ];
  else if (variant === 2)
    factors = [
      { root: roots[0]!, power: 1 },
      { root: roots[1]!, power: -1 },
      { root: roots[2]!, power: -1 },
    ];
  else
    factors = [
      { root: roots[0]!, power: 1 },
      { root: roots[1]!, power: -2 },
    ];
  // The denominator's position among the roots varies with the seed.
  if (r(0, 1) === 1)
    factors = factors.map((f, i) => ({
      ...f,
      root: roots[(i + 1) % roots.length]!,
    }));
  const num = groupText(factors.filter((f) => f.power > 0));
  const den = groupText(factors.filter((f) => f.power < 0));
  const op = pick(r, ["<", ">", "<=", ">="] as const);
  const solution = solveSigns(1, factors, op);
  const label = (segments: Segment[]) => ({
    label: tex(intervalText(segments)),
    key: intervalText(segments),
  });
  const right = label(solution);
  // Multiplying by the denominator without excluding its zero: equality at the denominator's zero.
  const asProduct = label(
    solveSigns(
      1,
      factors.map((f) => ({ ...f, power: Math.abs(f.power) })),
      op,
    ),
  );
  const denRoots = factors.filter((f) => f.power < 0).map((f) => f.root);
  const allRoots = [...new Set(factors.map((f) => f.root))].sort(
    (a, b) => a - b,
  );
  return finish(meta, seed, r, {
    variant:
      variant === 3
        ? "squared-denominator"
        : variant === 2
          ? "two-denominator-factors"
          : variant === 1
            ? "two-numerator-factors"
            : "single-fraction",
    prompt: `Solve $\\dfrac{${num}}{${den}}${opTex[op]}0$. Write the solution in interval notation.`,
    hint: `The fraction can change sign only where the numerator $${num}$ is 0 or the denominator $${den}$ is 0. Mark both kinds of values, test a number in each interval, and remember a value that makes the denominator 0 is never allowed.`,
    explanation: [
      `The numerator is 0 at $${factors
        .filter((f) => f.power > 0)
        .map((f) => f.root)
        .join(
          ", ",
        )}$ and the denominator is 0 at $${denRoots.join(", ")}$, which is not allowed. These split the number line into ${allRoots.length + 1} intervals.`,
      `Testing a number in each interval: ${signChartSentence(1, factors, "the fraction")}.`,
      `${isStrict(op) ? "The inequality is strict, so no endpoint is included." : "The inequality allows equality, so the numerator's zeros are included, but the denominator's zeros never are."} The solution is ${right.label}.`,
    ],
    correct: right.label,
    key: right.key,
    wrong: [
      {
        ...label(solveSigns(1, factors, flipDirection(op))),
        feedback: `This is the solution of the inequality with the opposite direction. Re-check the sign on each interval against $${opTex[op]}0$.`,
      },
      {
        ...label(solveSigns(1, factors, flipStrict(op))),
        feedback: isStrict(op)
          ? `The inequality is strict, so no endpoint is a solution.`
          : `The numerator's zeros are solutions because the inequality includes equality. A fraction equals 0 where its numerator is 0.`,
      },
      {
        ...asProduct,
        feedback: `A value that makes the denominator 0 makes the fraction undefined, so it is never a solution, even when the inequality allows equality.`,
      },
      {
        ...label(solveSigns(1, factors, flipDirection(flipStrict(op)))),
        feedback: `This reverses both the direction and the endpoints. The answer should satisfy $${opTex[op]}0$ exactly.`,
      },
      {
        ...label(
          solveSigns(
            1,
            factors.map((f) => ({ ...f, power: f.power > 0 ? 1 : -1 })),
            op,
          ),
        ),
        feedback: `A factor that is squared does not change the sign at its zero. Check the sign on both sides of it.`,
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const builders: Record<string, (seed: string) => TexasHsCase> = {
  [lineEquationFormsTemplate.id]: lineEquationFormsCase,
  [lineRelationshipEquationsTemplate.id]: lineRelationshipEquationsCase,
  [systemEquationChoiceTemplate.id]: systemEquationChoiceCase,
  [graphEstimateSystemTemplate.id]: graphEstimateSystemCase,
  [exponentialDomainRangeTemplate.id]: exponentialDomainRangeCase,
  [absoluteValueFormulateTemplate.id]: absoluteValueFormulateCase,
  [rationalEquationFormulateTemplate.id]: rationalEquationFormulateCase,
  [rationalExponentEquationTemplate.id]: rationalExponentEquationCase,
  [transformationCompositionTemplate.id]: transformationCompositionCase,
  [counterexampleChoiceTemplate.id]: counterexampleChoiceCase,
  [sphericalGeometryTemplate.id]: sphericalGeometryCase,
  [regularPolygonAreaTemplate.id]: regularPolygonAreaCase,
  [curvedSolidSurfaceTemplate.id]: curvedSolidSurfaceCase,
  [areaProbabilityTemplate.id]: areaProbabilityCase,
  [compositionOrderTemplate.id]: compositionOrderCase,
  [oneSidedBehaviorTemplate.id]: oneSidedBehaviorCase,
  [parametricRectangularTemplate.id]: parametricRectangularCase,
  [angularVelocityTemplate.id]: angularVelocityCase,
  [referenceAngleTemplate.id]: referenceAngleCase,
  [bearingTrigTemplate.id]: bearingTrigCase,
  [sigmaNotationTemplate.id]: sigmaNotationCase,
  [infiniteGeometricTemplate.id]: infiniteGeometricCase,
  [polynomialInequalityTemplate.id]: polynomialInequalityCase,
  [rationalInequalityTemplate.id]: rationalInequalityCase,
};

export function generateTexasHsProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return texasHsCase(id, seed).problem;
}
/** Case with its private variant name, for tests and review tooling. */
export function texasHsCase(id: string, seed: string): TexasHsCase {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const build = builders[id];
  if (!build) throw new Error(`Unknown Texas high-school template ${id}`);
  // A few random draws leave fewer than three distinct wrong choices; redraw deterministically.
  for (let attempt = 0; ; attempt++) {
    try {
      const made = build(attempt === 0 ? seed : `${seed}~${attempt}`);
      // Redraws keep the requested seed on the public problem.
      made.problem.public.seed = seed;
      return made;
    } catch (error) {
      if (
        attempt >= 12 ||
        !(error instanceof Error) ||
        !error.message.startsWith("Insufficient distinct choices")
      )
        throw error;
    }
  }
}
