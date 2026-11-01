import type { TemplateMetadata } from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  curveValue,
  latticeOnCurve,
  pointTex,
  type LatticePoint,
  type PlotCurve,
  type PointPlotGrading,
  type PointPlotGrid,
  type PointPlotResponse,
  type Rat,
} from "./point-plot";

/** Graph a nonlinear function by placing lattice points that satisfy
 * y = f(x) exactly (point-plot-v1, on-curve grading). The function and any
 * required feature point stay on the server. */
const plot = { requiredResponseCapability: "point-plot-v1" as const };
export const pointPlotCurveTemplates: readonly TemplateMetadata[] = [
  {
    id: "graph-quadratic-points",
    version: 1,
    title: "Graph a parabola by placing points",
    skillId: "quadratic-graphs",
    gradeBand: "9–12",
    ...plot,
    description:
      "Graph a quadratic function from vertex or standard form by placing three of its lattice points, sometimes including the vertex or the $y$-intercept; any three distinct points on the parabola are accepted.",
  },
  {
    id: "graph-absolute-value-points",
    version: 1,
    title: "Graph an absolute value function by placing points",
    skillId: "piecewise-functions",
    gradeBand: "9–12",
    ...plot,
    description:
      "Graph $y = a|x - h| + k$ by placing three lattice points, sometimes including the vertex; any three distinct points on the V-shaped graph are accepted.",
  },
  {
    id: "graph-exponential-points",
    version: 1,
    title: "Graph an exponential function by placing points",
    skillId: "exponential-models",
    gradeBand: "9–12",
    ...plot,
    description:
      "Graph $y = a \\cdot b^x$ for a whole-number $a$ and a base of 2, 3, one half or one third by placing three lattice points whose outputs are whole numbers, including negative inputs.",
  },
  {
    id: "graph-sqrt-points",
    version: 1,
    title: "Graph a square root function by placing points",
    skillId: "function-transformations",
    gradeBand: "9–12",
    ...plot,
    description:
      "Graph $y = a\\sqrt{x - h} + k$ by placing three lattice points whose square roots are whole numbers, sometimes including the starting point; the graph exists only for $x \\ge h$.",
  },
];

const GRID: PointPlotGrid = {
  xMin: -6,
  xMax: 6,
  yMin: -6,
  yMax: 6,
  step: 1,
  xLabel: "x",
  yLabel: "y",
};
/** Exponentials grow fast: a wide, tall window with the asymptote y = 0 inside. */
const EXPONENTIAL_GRID: PointPlotGrid = {
  xMin: -4,
  xMax: 4,
  yMin: -2,
  yMax: 12,
  step: 1,
  xLabel: "x",
  yLabel: "y",
};

export interface CurveParts {
  prompt: string;
  response: PointPlotResponse;
  answer: LatticePoint[];
  grading: PointPlotGrading;
  explanation: string[];
  hint: string;
}

const int = (n: number): Rat => [n, 1];
const signed = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const paren = (n: number) => (n < 0 ? `(${n})` : `${n}`);
const ratNumber = ([n, d]: Rat) => n / d;
const ratTex = ([n, d]: Rat) =>
  d === 1 ? signed(n) : `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
/** The coefficient written before a factor: 1 and -1 are implicit. */
const coefTex = (a: Rat) =>
  a[0] === 1 && a[1] === 1 ? "" : a[0] === -1 && a[1] === 1 ? "-" : ratTex(a);
const shiftTex = (h: number) =>
  h === 0 ? "x" : `x ${h < 0 ? "+" : "-"} ${Math.abs(h)}`;
const addTex = (k: number) =>
  k === 0 ? "" : ` ${k < 0 ? "-" : "+"} ${Math.abs(k)}`;
/** a times a value, for a worked step: 1 and -1 vanish into the value. */
const timesTex = (a: Rat, value: string) =>
  value === "0"
    ? "0"
    : a[0] === 1 && a[1] === 1
      ? value
      : a[0] === -1 && a[1] === 1
        ? `-${value}`
        : `${ratTex(a)} \\cdot ${value}`;
/** Terms joined with their signs: "9 - 12 + 1". */
const sum = (terms: number[]) =>
  terms
    .map((t, i) =>
      i === 0 ? signed(t) : ` ${t < 0 ? "-" : "+"} ${Math.abs(t)}`,
    )
    .join("");
/** Steps joined by equals signs, without repeating a step. */
const chain = (...steps: string[]) =>
  steps.filter((step, i) => i === 0 || step !== steps[i - 1]).join(" = ");
const inner = (x: number, h: number) =>
  h === 0 ? `${x}` : `${x} ${h < 0 ? "+" : "-"} ${Math.abs(h)}`;
const key = ([x, y]: LatticePoint) => `${x},${y}`;
const sortPoints = (points: LatticePoint[]) =>
  [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
const intValue = (curve: PlotCurve, x: number): number => {
  const v = curveValue(curve, x);
  if (!v || v.d !== 1n) throw new Error("Worked point is not a lattice point");
  return Number(v.n);
};

type Feature = "vertex" | "y-intercept" | "start";
interface Core {
  curve: PlotCurve;
  grid: PointPlotGrid;
  equation: string;
  feature?: { kind: Feature; point: LatticePoint };
  /** Substitution of x into the equation, ending at y. */
  work: (x: number, y: number) => string;
  method: string[];
  hint: string;
  /** Prefer points nearest this x when choosing the worked points. */
  center?: number;
}

function finish(core: Core, r: Random): CurveParts {
  const { curve, grid, feature } = core;
  const all = latticeOnCurve(grid, curve);
  const k = 3;
  if (all.length < k) throw new Error("Too few lattice points on the curve");
  const required = feature ? [feature.point] : [];
  if (!all.some((p) => key(p) === required.map(key)[0]) && feature)
    throw new Error("The feature point is not on the grid");
  const rest = all.filter((p) => !required.some((q) => key(q) === key(p)));
  const chosen =
    core.center === undefined
      ? shuffle(r, [...rest]).slice(0, k - required.length)
      : [...rest]
          .sort(
            (p, q) =>
              Math.abs(p[0] - core.center!) - Math.abs(q[0] - core.center!) ||
              p[0] - q[0],
          )
          .slice(0, k - required.length);
  const answer = sortPoints([...required, ...chosen]);
  const ask =
    feature === undefined
      ? "by placing 3 points."
      : feature.kind === "vertex"
        ? "by placing its vertex and 2 more points."
        : feature.kind === "y-intercept"
          ? "by placing its $y$-intercept and 2 more points."
          : "by placing its starting point and 2 more points.";
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Place 3 points on the curve",
    grid,
    pointCount: k,
    ordered: false,
    connect: "curve",
  };
  const lines = answer.map(
    (p) =>
      `$x = ${signed(p[0])}$: $${core.work(p[0], p[1])}$, so ${pointTex(p)} is on the curve.`,
  );
  return {
    prompt: `Graph $${core.equation}$ ${ask}`,
    response,
    answer,
    grading: {
      mode: "on-curve",
      curve,
      ...(feature ? { required: [feature.point] } : {}),
    },
    hint: core.hint,
    explanation: [
      ...core.method,
      ...lines,
      feature
        ? `Place ${list(answer.map((p) => pointTex(p)))}. The ${feature.kind === "start" ? "starting point" : feature.kind === "y-intercept" ? "$y$-intercept" : feature.kind} ${pointTex(feature.point)} is one of them, and any 2 other points that satisfy the equation also work.`
        : `Place ${list(answer.map((p) => pointTex(p)))}. Any 3 different points that satisfy the equation are correct.`,
    ],
  };
}
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/* ---------- parabolas ---------- */
function quadraticParts(seed: string): CurveParts {
  const id = pointPlotCurveTemplates[0]!.id;
  const r = random(id, seed);
  const variant = r(0, 5);
  const standard = variant >= 3;
  for (let attempt = 0; attempt < 500; attempt++) {
    const a: Rat =
      variant === 1
        ? ([r(0, 1) ? 1 : -1, 2] as Rat)
        : int([1, -1, 2, -2][r(0, 3)]!);
    const h = r(-5, 5),
      k = r(-5, 5);
    if (standard && h === 0) continue;
    const curve: PlotCurve = { kind: "quadratic", a, h: int(h), k: int(k) };
    const all = latticeOnCurve(GRID, curve);
    if (all.length < 5) continue;
    const vertex: LatticePoint = [h, k];
    if (variant === 4) {
      const c = a[0] * h * h + k;
      if (Math.abs(c) > 6) continue;
    }
    const an = a[0];
    const b = -2 * an * h,
      c = an * h * h + k;
    const a2 = ratTex(a);
    let equation: string;
    let work: Core["work"];
    let method: string[];
    let hint: string;
    if (!standard) {
      equation = `y = ${coefTex(a)}(${shiftTex(h)})^2${addTex(k)}`;
      if (h === 0) equation = `y = ${coefTex(a)}x^2${addTex(k)}`;
      work = (x) => {
        const t = x - h;
        // A bare number after the coefficient would read as one number.
        const square =
          h === 0
            ? timesTex(a, `${paren(x)}^2`)
            : `${coefTex(a)}(${inner(x, h)})^2`;
        return chain(
          `y = ${square}${addTex(k)}`,
          `${timesTex(a, `${t * t}`)}${addTex(k)}`,
          `${intValue(curve, x)}`,
        );
      };
      method = [
        "A parabola is the U-shaped graph of a quadratic. Its vertex is the turning point, the lowest or highest point of the graph.",
        `Vertex form $y = a(x - h)^2 + k$ has its vertex at $(h, k)$.${h < 0 ? ` Here $x + ${-h}$ means $x - (${h})$.` : h === 0 ? " Here $x^2$ means $(x - 0)^2$." : ""} So $a = ${a2}$, $h = ${h}$ and $k = ${k}$, and the vertex is ${pointTex(vertex)}.`,
        `The number $a$ is ${an > 0 ? "positive" : "negative"}, so the parabola opens ${an > 0 ? "upward" : "downward"}.`,
        `The parabola is symmetric about its axis of symmetry, the line $x = ${h}$. So points the same distance left and right of the vertex have equal $y$-values.`,
        `Substitute whole-number values of $x$ and keep the points whose $y$ is a whole number.${a[1] > 1 ? " With $a = " + a2 + "$, that happens when $x - h$ is even." : ""}`,
      ];
      hint = `In $${equation}$, the vertex is $(h, k)$: $h$ is the number that $x$ is shifted by, taken with the opposite sign from the one inside the parentheses, and $k$ is the number added at the end. Find the vertex first, then substitute $x$-values near $h$ to find other points.`;
    } else {
      const bTerm =
        b === 0
          ? ""
          : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`;
      const aTerm = an === 1 ? "x^2" : an === -1 ? "-x^2" : `${an}x^2`;
      equation = `y = ${aTerm}${bTerm}${addTex(c)}`;
      work = (x) => {
        const xp = paren(x);
        const sq =
          an === 1
            ? `${xp}^2`
            : an === -1
              ? `-${xp}^2`
              : `${an} \\cdot ${xp}^2`;
        const lin =
          b === 0
            ? ""
            : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : `${Math.abs(b)} \\cdot `}${xp}`;
        const terms = [an * x * x, ...(b ? [b * x] : []), ...(c ? [c] : [])];
        return `y = ${sq}${lin}${addTex(c)} = ${sum(terms)} = ${intValue(curve, x)}`;
      };
      const ya = an * h * h + b * h + c;
      method = [
        "A parabola is the U-shaped graph of a quadratic. Its vertex is the turning point, the lowest or highest point of the graph.",
        `For $y = ax^2 + bx + c$ the vertex has $x = -\\frac{b}{2a}$. Here $a = ${an}$ and $b = ${b}$, so $x = -\\frac{${paren(b)}}{2 \\cdot ${paren(an)}} = ${h}$.`,
        `Then $y = ${work(h, ya).split("y = ")[1]}$, so the vertex is ${pointTex(vertex)}.`,
        `The number $a$ is ${an > 0 ? "positive" : "negative"}, so the parabola opens ${an > 0 ? "upward" : "downward"}.`,
        `Substitute whole-number values of $x$ near $x = ${h}$ to find other points.${variant === 4 ? ` The $y$-intercept, where the graph crosses the $y$-axis, is $(0, ${c})$, because $y = c$ when $x = 0$.` : ""}`,
      ];
      hint =
        variant === 4
          ? `The $y$-intercept is where $x = 0$, which leaves only the constant term of $${equation}$. Then substitute other whole-number $x$-values, starting near the parabola's axis of symmetry $x = -\\frac{b}{2a}$.`
          : `Use $x = -\\frac{b}{2a}$ with $a = ${an}$ and $b = ${b}$ to find the vertex's $x$-coordinate, then substitute it into $${equation}$ for the $y$-coordinate. Substitute nearby whole-number $x$-values for more points.`;
    }
    const feature =
      variant === 0 || variant === 1 || variant === 3
        ? { kind: "vertex" as const, point: vertex }
        : variant === 4
          ? { kind: "y-intercept" as const, point: [0, c] as LatticePoint }
          : undefined;
    return finish(
      { curve, grid: GRID, equation, feature, work, method, hint, center: h },
      r,
    );
  }
  throw new Error("No graphable parabola drawn");
}

/* ---------- absolute value ---------- */
function absoluteParts(seed: string): CurveParts {
  const id = pointPlotCurveTemplates[1]!.id;
  const r = random(id, seed);
  const withVertex = r(0, 1) === 1;
  for (let attempt = 0; attempt < 500; attempt++) {
    const choices: Rat[] = [int(1), int(-1), int(2), int(-2), [1, 2], [-1, 2]];
    const a = choices[r(0, choices.length - 1)]!;
    const h = r(-5, 5),
      k = r(-5, 5);
    const curve: PlotCurve = { kind: "absolute", a, h: int(h), k: int(k) };
    if (latticeOnCurve(GRID, curve).length < 5) continue;
    const equation = `y = ${coefTex(a)}\\left|${shiftTex(h)}\\right|${addTex(k)}`;
    const work = (x: number) =>
      chain(
        `y = ${coefTex(a)}\\left|${inner(x, h)}\\right|${addTex(k)}`,
        `${timesTex(a, `${Math.abs(x - h)}`)}${addTex(k)}`,
        `${intValue(curve, x)}`,
      );
    return finish(
      {
        curve,
        grid: GRID,
        equation,
        feature: withVertex ? { kind: "vertex", point: [h, k] } : undefined,
        work,
        center: h,
        method: [
          "The absolute value of a number is its distance from 0, so it is never negative.",
          `The graph of $y = a|x - h| + k$ is V-shaped with its vertex, the corner point, at $(h, k)$. Here the vertex is ${pointTex([h, k])}.`,
          `The graph opens ${a[0] > 0 ? "upward" : "downward"} because $a$, the number in front, is ${a[0] > 0 ? "positive" : "negative"}.`,
          `Each side is a straight ray, a half-line. $y$ changes by $${ratTex(a)}$ for every unit $x$ moves from $h$, ${a[1] > 1 ? "so whole-number points appear every 2 units" : "so whole-number points appear at every unit"}.`,
          `Equal distances left and right of $x = ${h}$ give equal $y$-values.`,
        ],
        hint: `In $${equation}$, the vertex is where the expression inside the absolute value is 0, because $|0| = 0$ leaves only the number added at the end. Find that $x$-value, then substitute $x$-values on both sides of it.`,
      },
      r,
    );
  }
  throw new Error("No graphable absolute value drawn");
}

/* ---------- exponentials ---------- */
const bases: Rat[] = [int(2), int(3), [1, 2], [1, 3]];
function exponentialParts(seed: string): CurveParts {
  const id = pointPlotCurveTemplates[2]!.id;
  const r = random(id, seed);
  for (let attempt = 0; attempt < 500; attempt++) {
    const b = bases[r(0, bases.length - 1)]!;
    const a = int([1, 1, 2, 3, 4, 6, 8, 9][r(0, 7)]!);
    const curve: PlotCurve = { kind: "exponential", a, b };
    if (latticeOnCurve(EXPONENTIAL_GRID, curve).length < 3) continue;
    const base =
      b[1] === 1 ? `${b[0]}` : `\\left(\\frac{${b[0]}}{${b[1]}}\\right)`;
    const lead = a[0] === 1 ? "" : `${a[0]} \\cdot `;
    const equation = `y = ${lead}${base}^x`;
    const work = (x: number, y: number) => {
      const p = curveValue({ kind: "exponential", a: int(1), b }, x)!;
      const power = p.d === 1n ? `${p.n}` : `\\frac{${p.n}}{${p.d}}`;
      const raised = `${lead}${base}^{${x}}`;
      return a[0] === 1
        ? `y = ${raised} = ${y}`
        : `y = ${raised} = ${a[0]} \\cdot ${power} = ${y}`;
    };
    return finish(
      {
        curve,
        grid: EXPONENTIAL_GRID,
        equation,
        work,
        method: [
          `In $y = a \\cdot b^x$, the starting value is $a = ${a[0]}$, the $y$-value at $x = 0$. The base, $b = ${ratTex(b)}$, is the number raised to the power $x$.`,
          `Each step of 1 in $x$ multiplies $y$ by the base. The base is ${b[0] > b[1] ? "greater than 1, so the curve rises" : "between 0 and 1, so the curve falls"} as $x$ increases, and it never reaches $y = 0$.`,
          `A negative exponent takes the reciprocal of the base, 1 divided by it: $b^{-1} = ${b[1] === 1 ? `\\frac{1}{${b[0]}}` : `${b[1]}`}$.`,
          "Only some $x$-values give a whole-number $y$ inside the grid, so test $x$-values and keep those.",
        ],
        hint: `Make a table for $${equation}$. Start at $x = 0$, where $b^0 = 1$, then try $x = 1$, $x = 2$ and negative values such as $x = -1$. Keep a point only when $y$ is a whole number that fits on the grid (a fraction such as $\\frac{3}{2}$ is not a lattice point).`,
      },
      r,
    );
  }
  throw new Error("No graphable exponential drawn");
}

/* ---------- square roots ---------- */
function sqrtParts(seed: string): CurveParts {
  const id = pointPlotCurveTemplates[3]!.id;
  const r = random(id, seed);
  const withStart = r(0, 1) === 1;
  for (let attempt = 0; attempt < 500; attempt++) {
    const a = int([1, 2, -1, -2][r(0, 3)]!);
    const h = r(-6, 3),
      k = r(-4, 4);
    const curve: PlotCurve = { kind: "root", a, h: int(h), k: int(k) };
    if (latticeOnCurve(GRID, curve).length < 4) continue;
    const equation = `y = ${coefTex(a)}\\sqrt{${shiftTex(h)}}${addTex(k)}`;
    const work = (x: number) => {
      const t = x - h;
      const s = Math.round(Math.sqrt(t));
      return chain(
        `y = ${coefTex(a)}\\sqrt{${inner(x, h)}}${addTex(k)}`,
        `${timesTex(a, `\\sqrt{${t}}`)}${addTex(k)}`,
        `${timesTex(a, `${s}`)}${addTex(k)}`,
        `${intValue(curve, x)}`,
      );
    };
    return finish(
      {
        curve,
        grid: GRID,
        equation,
        feature: withStart ? { kind: "start", point: [h, k] } : undefined,
        work,
        center: h,
        method: [
          `A negative number has no real square root, so the expression under the root, $${shiftTex(h)}$, must be at least 0. That means $x \\ge ${h}$.`,
          `The graph starts at ${pointTex([h, k])}, where the root is 0. It extends to the right, ${a[0] > 0 ? "rising" : "falling"} because the number in front of the root is ${a[0] > 0 ? "positive" : "negative"}.`,
          `To land on grid points, make $${shiftTex(h)}$ a perfect square, a whole number times itself: 0, 1, 4 or 9. That gives $x = ${[0, 1, 4, 9].map((s) => `${h + s}`).join(", ")}$.`,
        ],
        hint: `Find where $${shiftTex(h)}$ is 0: that is the $x$-coordinate where the graph starts, and no point lies to its left. For other points, choose $x$-values that make $${shiftTex(h)}$ equal to 1, 4 or 9, so the square root is a whole number.`,
      },
      r,
    );
  }
  throw new Error("No graphable square root drawn");
}

export function generateCurveParts(
  templateId: string,
  seed: string,
): CurveParts | null {
  switch (templateId) {
    case "graph-quadratic-points":
      return quadraticParts(seed);
    case "graph-absolute-value-points":
      return absoluteParts(seed);
    case "graph-exponential-points":
      return exponentialParts(seed);
    case "graph-sqrt-points":
      return sqrtParts(seed);
  }
  return null;
}
