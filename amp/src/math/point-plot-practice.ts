import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  PlaneMotion,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  latticeOnLine,
  lineThrough,
  pointPlotScene,
  pointTex,
  serializePlot,
  type LatticePoint,
  type PointPlotGrading,
  type PointPlotGrid,
  type PointPlotResponse,
} from "./point-plot";
import {
  generateCurveParts,
  pointPlotCurveTemplates,
} from "./point-plot-curves";

/** Families answered by placing points on a coordinate grid (point-plot-v1). */
const plot = { requiredResponseCapability: "point-plot-v1" as const };
export const pointPlotTemplates: readonly TemplateMetadata[] = [
  {
    id: "plot-points",
    version: 1,
    title: "Plot points in four quadrants",
    skillId: "coordinate-four-quadrants",
    gradeBand: "6–8",
    ...plot,
    description:
      "Plot signed coordinate pairs on a four-quadrant grid, including points on an axis, points described by their distances from the axes, and reflections of a point across an axis.",
  },
  {
    id: "graph-linear-equation",
    version: 1,
    title: "Graph a line from its equation",
    skillId: "slope",
    gradeBand: "6–8",
    ...plot,
    description:
      "Graph a line by placing two of its lattice points, from slope-intercept, standard or point-slope form, a horizontal line, or a proportional relationship through the origin.",
  },
  {
    id: "place-transformed-image",
    version: 1,
    title: "Place the image of a rigid motion",
    skillId: "rigid-motions",
    gradeBand: "6–8",
    ...plot,
    description:
      "Place the images of two or three vertices, in order, under a translation, a reflection over an axis, or a rotation of 90° or 180° about the origin.",
  },
  ...pointPlotCurveTemplates,
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
const inWindow = ([x, y]: LatticePoint, limit = 6) =>
  Math.abs(x) <= limit && Math.abs(y) <= limit;
const key = ([x, y]: LatticePoint) => `${x},${y}`;
const signed = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

function problemOf(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    response: PointPlotResponse;
    answer: readonly LatticePoint[];
    grading: PointPlotGrading;
    explanation: string[];
    hint: string;
  },
): GeneratedProblem {
  const answer = serializePlot(parts.answer, parts.response.ordered);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: parts.prompt,
      skillId: meta.skillId,
      response: parts.response,
    },
    answer,
    explanation: parts.explanation,
    hint: parts.hint,
    pointGrading: parts.grading,
    // A lesson's example shows the solved grid; a problem never does.
    walkthrough: pointPlotScene(parts.response, {
      answer: parts.answer,
      ...(parts.grading.mode === "on-curve"
        ? { curve: parts.grading.curve }
        : {}),
      title: "The solved grid",
    }),
  };
}

/* ---------- plot points (grade 6) ---------- */
/** Directions from the origin, for a worked step. */
function walk([x, y]: LatticePoint): string {
  if (x === 0 && y === 0) return "it is the origin itself";
  const across =
    x === 0 ? "" : `move ${units(Math.abs(x))} ${x > 0 ? "right" : "left"}`;
  const up =
    y === 0 ? "" : `move ${units(Math.abs(y))} ${y > 0 ? "up" : "down"}`;
  const axis =
    x === 0
      ? " The $x$-coordinate is 0, so the point lies on the $y$-axis."
      : y === 0
        ? " The $y$-coordinate is 0, so the point lies on the $x$-axis."
        : "";
  return `from the origin, ${[across, up].filter(Boolean).join(", then ")}.${axis}`;
}
function nonzero(r: Random, limit = 6) {
  const n = r(1, limit);
  return r(0, 1) ? n : -n;
}
const letterSets = [
  ["A", "B", "C", "D"],
  ["P", "Q", "R", "S"],
  ["J", "K", "L", "M"],
] as const;

function plotPoints(seed: string): GeneratedProblem {
  const meta = pointPlotTemplates[0]!;
  const r = random(meta.id, seed);
  const variant = r(0, 5);
  if (variant <= 2) {
    // Named pairs across quadrants, with at least one point on an axis.
    const count = r(3, 4);
    const letters = letterSets[r(0, letterSets.length - 1)]!.slice(0, count);
    const points: LatticePoint[] = [];
    const used = new Set<string>();
    const add = (p: LatticePoint) => {
      if (used.has(key(p))) return false;
      used.add(key(p));
      points.push(p);
      return true;
    };
    // On an axis: x = 0 or y = 0 (the origin only rarely).
    const axisPoint = (): LatticePoint =>
      r(0, 11) === 0 ? [0, 0] : r(0, 1) ? [0, nonzero(r)] : [nonzero(r), 0];
    add(axisPoint());
    // Distinct quadrants for the off-axis points, so signs must be read.
    const quadrants = shuffle(r, [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ]);
    for (let q = 0; points.length < count; q++) {
      const [sx, sy] = quadrants[q % 4]!;
      if (q >= 4 && r(0, 2) === 0) add(axisPoint());
      else add([sx! * r(1, 6), sy! * r(1, 6)]);
    }
    const order = shuffle(r, [...points]);
    const named = order.map((p, i) => pointTex(p, letters[i]));
    const response: PointPlotResponse = {
      kind: "point-plot",
      label: `Plot ${count} points`,
      grid: GRID,
      pointCount: count,
      ordered: false,
      connect: "none",
    };
    const first = order[0]!;
    return problemOf(meta, seed, {
      prompt: `Plot the points ${list(named)}.`,
      response,
      answer: order,
      grading: { mode: "exact" },
      hint: `Start with ${named[0]}. The first number, $${signed(first[0])}$, is how far to move along the $x$-axis from the origin (right if positive, left if negative); the second, $${signed(first[1])}$, is how far to move up or down.`,
      explanation: [
        "Each ordered pair is (horizontal move, vertical move) from the origin. A positive first number moves right and a negative one left; a positive second number moves up and a negative one down.",
        ...order.map((p, i) => `${named[i]}: ${walk(p)}`),
      ],
    });
  }
  if (variant <= 4) {
    // Two points described by distances from the axes.
    const names = r(0, 1) ? ["P", "Q"] : ["M", "N"];
    const first: LatticePoint = [nonzero(r), nonzero(r)];
    let second: LatticePoint = r(0, 1) ? [0, nonzero(r)] : [nonzero(r), 0];
    if (r(0, 2) === 0) second = [nonzero(r), nonzero(r)];
    while (key(second) === key(first)) second = [nonzero(r), nonzero(r)];
    const describe = (name: string, [x, y]: LatticePoint) => {
      const side = (v: number) =>
        `${units(Math.abs(v))} ${v > 0 ? "right of" : "left of"} the $y$-axis`;
      const height = (v: number) =>
        `${units(Math.abs(v))} ${v > 0 ? "above" : "below"} the $x$-axis`;
      if (x === 0) return `$${name}$ lies on the $y$-axis, ${height(y)}`;
      if (y === 0) return `$${name}$ lies on the $x$-axis, ${side(x)}`;
      return `$${name}$ is ${side(x)} and ${height(y)}`;
    };
    const response: PointPlotResponse = {
      kind: "point-plot",
      label: "Plot 2 points",
      grid: GRID,
      pointCount: 2,
      ordered: false,
      connect: "none",
    };
    const coordinate = ([x, y]: LatticePoint) =>
      x === 0
        ? `On the $y$-axis the $x$-coordinate is 0; ${y > 0 ? "above" : "below"} the $x$-axis makes the $y$-coordinate ${y > 0 ? "positive" : "negative"}`
        : y === 0
          ? `On the $x$-axis the $y$-coordinate is 0; ${x > 0 ? "right" : "left"} of the $y$-axis makes the $x$-coordinate ${x > 0 ? "positive" : "negative"}`
          : `${x > 0 ? "Right" : "Left"} of the $y$-axis makes $x$ ${x > 0 ? "positive" : "negative"}, and ${y > 0 ? "above" : "below"} the $x$-axis makes $y$ ${y > 0 ? "positive" : "negative"}`;
    return problemOf(meta, seed, {
      prompt: `Plot both points. ${describe(names[0]!, first)}. ${describe(names[1]!, second)}.`,
      response,
      answer: [first, second],
      grading: { mode: "exact" },
      hint: `The distance from the $y$-axis is the size of the $x$-coordinate, and the distance from the $x$-axis is the size of the $y$-coordinate. For $${names[0]}$, a distance of ${Math.abs(first[0])} to the ${first[0] > 0 ? "right" : "left"} of the $y$-axis gives the sign and size of $x$.`,
      explanation: [
        "A point's distance from the $y$-axis is the size of its $x$-coordinate; its distance from the $x$-axis is the size of its $y$-coordinate.",
        `$${names[0]}$: ${coordinate(first)}, so $${names[0]}$ is ${pointTex(first)}.`,
        `$${names[1]}$: ${coordinate(second)}, so $${names[1]}$ is ${pointTex(second)}.`,
      ],
    });
  }
  // Reflections of a point across both axes (6.NS.C.6b).
  const p: LatticePoint = [nonzero(r), nonzero(r)];
  const name = ["P", "A", "K"][r(0, 2)]!;
  const overX: LatticePoint = [p[0], -p[1]],
    overY: LatticePoint = [-p[0], p[1]];
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Plot both reflections",
    grid: GRID,
    pointCount: 2,
    ordered: false,
    connect: "none",
    given: { vertices: [{ x: p[0], y: p[1], label: name }], closed: false },
  };
  return problemOf(meta, seed, {
    prompt: `Point ${pointTex(p, name)} is plotted. Plot its reflection across the $x$-axis and its reflection across the $y$-axis.`,
    response,
    answer: [overX, overY],
    grading: { mode: "exact" },
    hint: `A reflection across the $x$-axis keeps the horizontal position of $${name}$, $x = ${signed(p[0])}$, and lands the same distance from the axis on the other side. Decide which coordinate changes sign for each reflection.`,
    explanation: [
      `A reflection across the $x$-axis keeps $x = ${signed(p[0])}$ and changes the sign of $y$: ${pointTex(p)} becomes ${pointTex(overX)}.`,
      `A reflection across the $y$-axis keeps $y = ${signed(p[1])}$ and changes the sign of $x$: ${pointTex(p)} becomes ${pointTex(overY)}.`,
      "Each image is the same distance from the mirror axis as the original point, on the opposite side.",
    ],
  });
}

/* ---------- graph a line (grade 8) ---------- */
type Rational = { n: number; d: number };
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const reduce = (n: number, d: number): Rational => {
  const g = gcd(n, d) || 1;
  const s = d < 0 ? -1 : 1;
  return { n: (s * n) / g, d: (s * d) / g };
};
/** TeX of y = mx + b with a reduced slope: "y = -\\frac{2}{3}x + 4". */
function slopeIntercept(m: Rational, b: number) {
  if (m.n === 0) return `y = ${signed(b)}`;
  const size = Math.abs(m.n);
  const x =
    (m.n < 0 ? "-" : "") +
    (m.d === 1 ? (size === 1 ? "x" : `${size}x`) : `\\frac{${size}}{${m.d}}x`);
  return b === 0 ? `y = ${x}` : `y = ${x} ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
}
const fracTex = (q: Rational) =>
  q.d === 1
    ? signed(q.n)
    : `${q.n < 0 ? "-" : ""}\\frac{${Math.abs(q.n)}}{${q.d}}`;
const slopes: Rational[] = [1, 2, 3].flatMap((n) => [
  { n, d: 1 },
  { n: -n, d: 1 },
]);
slopes.push(
  ...[
    [1, 2],
    [1, 3],
    [2, 3],
    [3, 2],
  ].flatMap(([n, d]) => [
    { n: n!, d: d! },
    { n: -n!, d: d! },
  ]),
);
const moves = (m: Rational) =>
  `${units(m.d)} right and ${units(Math.abs(m.n))} ${m.n > 0 ? "up" : "down"}`;
/** The lattice neighbor of `from` along the line: the next lattice point
 * (lattice points on a line in a convex window are consecutive). */
function neighbor(points: LatticePoint[], from: LatticePoint): LatticePoint {
  const i = points.findIndex((p) => key(p) === key(from));
  if (i < 0) throw new Error("Anchor is not on the line");
  return points[i + 1] ?? points[i - 1]!;
}

type LineForm =
  | "slope-intercept"
  | "standard"
  | "point-slope"
  | "proportional"
  | "horizontal";
function graphLinearEquation(seed: string): GeneratedProblem {
  const meta = pointPlotTemplates[1]!;
  const r = random(meta.id, seed);
  // Slope-intercept is the usual first form; a horizontal line is the
  // boundary case of slope 0.
  const forms: LineForm[] = [
    "slope-intercept",
    "slope-intercept",
    "slope-intercept",
    "standard",
    "standard",
    "point-slope",
    "point-slope",
    "proportional",
    "proportional",
    "horizontal",
  ];
  const form = forms[r(0, forms.length - 1)]!;
  // Redraw until the line meets at least three lattice points of the
  // window, so two of them can be placed with room to choose.
  for (let attempt = 0; attempt < 500; attempt++) {
    let line: { a: number; b: number; c: number };
    let equation: string;
    let first: LatticePoint;
    let prompt: string;
    let hint: string;
    let lead: string[];
    let m: Rational;
    if (form === "standard") {
      const a = nonzero(r, 5),
        b = nonzero(r, 5);
      if (gcd(a, b) !== 1 || (Math.abs(a) === 1 && Math.abs(b) === 1)) continue;
      const through: LatticePoint = [r(-3, 3), r(-3, 3)];
      const c = a * through[0] + b * through[1];
      line = { a, b, c };
      const coefficient = (v: number) =>
        Math.abs(v) === 1 ? "" : `${Math.abs(v)}`;
      equation = `${a < 0 ? "-" : ""}${coefficient(a)}x ${b < 0 ? "-" : "+"} ${coefficient(b)}y = ${signed(c)}`;
      m = reduce(-a, b);
      const points = latticeOnLine(GRID, line);
      first =
        points.find(([x]) => x === 0) ??
        points.find(([, y]) => y === 0) ??
        points[Math.floor(points.length / 2)] ??
        through;
      prompt = `Graph $${equation}$ by placing 2 points on its line.`;
      hint = `Choose whole-number values of $x$ and solve $${equation}$ for $y$. Keep a value when $y$ comes out whole; the coefficient $${signed(b)}$ of $y$ decides which $x$-values work.`;
      const substitute = ([x, y]: LatticePoint) =>
        `Substitute $x = ${signed(x)}$: $${a}(${x}) ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}y = ${signed(c)}$, so ${Math.abs(b) === 1 ? "" : `$${signed(b)}y = ${signed(c - a * x)}$ and `}$y = ${signed(y)}$. The point ${pointTex([x, y])} is on the line.`;
      const next = points.length >= 3 ? neighbor(points, first) : null;
      if (!next) continue;
      // Work left to right, so the run is positive.
      const [left, second] = next[0] > first[0] ? [first, next] : [next, first];
      first = left;
      lead = [substitute(first)];
      return finishLine(meta, seed, {
        prompt,
        hint,
        line,
        points: [first, second],
        steps: [
          ...lead,
          substitute(second),
          `The slope is $-\\frac{a}{b} = ${fracTex(m)}$: from ${pointTex(first)} to ${pointTex(second)} the line rises $${signed(second[1] - first[1])}$ over a run of ${second[0] - first[0]}.`,
        ],
      });
    }
    if (form === "horizontal") {
      const b = nonzero(r, 5);
      line = { a: 0, b: 1, c: b };
      equation = `y = ${signed(b)}`;
      const x0 = r(-4, 2);
      return finishLine(meta, seed, {
        prompt: `Graph $${equation}$ by placing 2 points on its line.`,
        hint: `In $${equation}$, $x$ does not appear: every point of the line has $y$-coordinate $${signed(b)}$, whatever its $x$-coordinate.`,
        line,
        points: [
          [x0, b],
          [x0 + r(1, 4), b],
        ],
        steps: [
          `The equation fixes $y = ${signed(b)}$ for every $x$, so the graph is the horizontal line ${units(Math.abs(b))} ${b > 0 ? "above" : "below"} the $x$-axis. Its slope is 0.`,
        ],
      });
    }
    m = slopes[r(0, slopes.length - 1)]!;
    if (form === "proportional") {
      if (m.n < 0) m = { n: -m.n, d: m.d };
      const k = r(1, 2);
      const given: LatticePoint = [m.d * k, m.n * k];
      if (!inWindow(given)) continue;
      line = lineThrough([0, 0], given);
      equation = slopeIntercept(m, 0);
      const ratio =
        k === 1 && m.d === 1
          ? `$k = \\frac{${given[1]}}{${given[0]}} = ${given[1]}$`
          : `$k = \\frac{${given[1]}}{${given[0]}}${k > 1 || m.d === 1 ? ` = ${fracTex(m)}` : ""}$`;
      first = [0, 0];
      prompt = `$y$ is proportional to $x$, and $y = ${given[1]}$ when $x = ${given[0]}$. Graph the relationship by placing 2 points on its line.`;
      hint = `A proportional relationship passes through the origin. Divide $y$ by $x$ at the given values, ${given[1]} and ${given[0]}, to find the constant of proportionality.`;
      lead = [
        `A proportional relationship has the form $y = kx$, so its graph passes through the origin ${pointTex([0, 0])}.`,
        `${ratio}, so the equation is $${equation}$.`,
      ];
    } else if (form === "point-slope") {
      first = [r(-4, 4), r(-4, 4)];
      line = lineThrough(first, [first[0] + m.d, first[1] + m.n]);
      const [x1, y1] = first;
      const shiftY = y1 === 0 ? "y" : `y ${y1 < 0 ? "+" : "-"} ${Math.abs(y1)}`;
      // A slope of 1 needs no brackets: y - 3 = x - 3.
      const shiftX =
        x1 === 0
          ? "x"
          : m.n === 1 && m.d === 1
            ? `x ${x1 < 0 ? "+" : "-"} ${Math.abs(x1)}`
            : `(x ${x1 < 0 ? "+" : "-"} ${Math.abs(x1)})`;
      const slopeText =
        m.d === 1
          ? Math.abs(m.n) === 1
            ? m.n < 0
              ? "-"
              : ""
            : `${m.n}`
          : fracTex(m);
      equation = `${shiftY} = ${slopeText}${shiftX}`;
      prompt = `Graph $${equation}$ by placing 2 points on its line.`;
      hint = `$${equation}$ is in point-slope form $y - y_1 = m(x - x_1)$. Read the point $(x_1, y_1)$ from the numbers subtracted from $x$ and $y$, then use the slope $${fracTex(m)}$ to find a second point.`;
      lead = [
        `Point-slope form $y - y_1 = m(x - x_1)$ passes through $(x_1, y_1)$. Here the line passes through ${pointTex(first)} with slope $m = ${fracTex(m)}$.`,
      ];
    } else {
      const b = r(-4, 4);
      first = [0, b];
      line = lineThrough(first, [m.d, b + m.n]);
      equation = slopeIntercept(m, b);
      prompt = `Graph $${equation}$ by placing 2 points on its line.`;
      hint = `In $${equation}$, substitute $x = 0$ to find where the line crosses the $y$-axis. Then use the slope $${fracTex(m)}$: from that point, move ${moves(m)}.`;
      lead = [
        `In $y = mx + b$, the line crosses the $y$-axis at $(0, b)$. Here $b = ${signed(b)}$, so ${pointTex(first)} is on the line, and the slope is $m = ${fracTex(m)}$.`,
      ];
    }
    const points = latticeOnLine(GRID, line);
    if (points.length < 3) continue;
    const second = neighbor(points, first);
    const forward = second[0] > first[0];
    return finishLine(meta, seed, {
      prompt,
      hint,
      line,
      points: [first, second],
      steps: [
        ...lead,
        `A slope of $${fracTex(m)}$ means a rise of $${signed(m.n)}$ for every run of ${m.d}. ${forward ? `From ${pointTex(first)} move ${moves(m)}` : `From ${pointTex(first)} move back: ${units(m.d)} left and ${units(Math.abs(m.n))} ${m.n > 0 ? "down" : "up"}`} to ${pointTex(second)}.`,
      ],
    });
  }
  throw new Error("No graphable line drawn");
}
function finishLine(
  meta: TemplateMetadata,
  seed: string,
  parts: {
    prompt: string;
    hint: string;
    line: { a: number; b: number; c: number };
    points: [LatticePoint, LatticePoint];
    steps: string[];
  },
): GeneratedProblem {
  const [p, q] = parts.points;
  if (!inWindow(p) || !inWindow(q) || key(p) === key(q))
    throw new Error("Worked points must be distinct points of the window");
  // Reduce to lowest terms so equivalent equations grade identically.
  const line = lineThrough(p, q);
  if (
    parts.line.a * line.b !== parts.line.b * line.a ||
    parts.line.a * line.c !== parts.line.c * line.a ||
    parts.line.b * line.c !== parts.line.c * line.b
  )
    throw new Error("Worked points are not on the stated line");
  const response: PointPlotResponse = {
    kind: "point-plot",
    label: "Place 2 points on the line",
    grid: GRID,
    pointCount: 2,
    ordered: false,
    connect: "line",
  };
  return problemOf(meta, seed, {
    prompt: parts.prompt,
    response,
    answer: [p, q],
    grading: { mode: "on-line", ...line },
    hint: parts.hint,
    explanation: [
      ...parts.steps,
      `Any two different points of this line are correct, such as ${pointTex(p)} and ${pointTex(q)}: two points determine a line, so the graph is the line through them.`,
    ],
  });
}

/* ---------- place the image of a rigid motion (grade 8) ---------- */
function apply(m: PlaneMotion, [x, y]: LatticePoint): LatticePoint {
  switch (m.kind) {
    case "translate":
      return [x + m.dx, y + m.dy];
    case "reflect":
      return m.axis === "x" ? [x, -y] : [-x, y];
    case "rotate":
      return m.degrees === 90
        ? [-y, x]
        : m.degrees === 180
          ? [-x, -y]
          : [y, -x];
    case "dilate":
      throw new Error("Dilations are not rigid motions");
  }
}
const steps = (v: number, plus: string, minus: string) =>
  `${units(Math.abs(v))} ${v > 0 ? plus : minus}`;
function motionWords(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `translated ${[...(m.dx ? [steps(m.dx, "right", "left")] : []), ...(m.dy ? [steps(m.dy, "up", "down")] : [])].join(" and ")}`;
    case "reflect":
      return `reflected over the $${m.axis}$-axis`;
    case "rotate":
      return m.degrees === 180
        ? "rotated 180° about the origin"
        : `rotated 90° ${m.degrees === 90 ? "counterclockwise" : "clockwise"} about the origin`;
    default:
      throw new Error("Unsupported motion");
  }
}
const shift = (v: string, by: number) =>
  by === 0 ? v : `${v} ${by < 0 ? "-" : "+"} ${Math.abs(by)}`;
function motionRule(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `$(x, y) \\to (${shift("x", m.dx)}, ${shift("y", m.dy)})$`;
    case "reflect":
      return m.axis === "x" ? "$(x, y) \\to (x, -y)$" : "$(x, y) \\to (-x, y)$";
    case "rotate":
      return m.degrees === 90
        ? "$(x, y) \\to (-y, x)$"
        : m.degrees === 180
          ? "$(x, y) \\to (-x, -y)$"
          : "$(x, y) \\to (y, -x)$";
    default:
      throw new Error("Unsupported motion");
  }
}
function motionHint(m: PlaneMotion, name: string, p: LatticePoint) {
  const at = pointTex(p, name);
  switch (m.kind) {
    case "translate":
      return `A translation adds the same amounts to every vertex. Start with ${at}: add $${signed(m.dx)}$ to its $x$-coordinate and $${signed(m.dy)}$ to its $y$-coordinate.`;
    case "reflect":
      return `A reflection over the $${m.axis}$-axis keeps the ${m.axis === "x" ? "$x$" : "$y$"}-coordinate and changes the sign of the other. Start with ${at}.`;
    case "rotate":
      return m.degrees === 180
        ? `A half turn about the origin changes the sign of both coordinates. Start with ${at}.`
        : `Use the rule ${motionRule(m)} for a quarter turn ${m.degrees === 90 ? "counterclockwise" : "clockwise"}. Start with ${at}: swap its coordinates, then fix the sign.`;
    default:
      throw new Error("Unsupported motion");
  }
}
function placeTransformedImage(seed: string): GeneratedProblem {
  const meta = pointPlotTemplates[2]!;
  const r = random(meta.id, seed);
  const count = r(0, 3) === 0 ? 2 : 3;
  const motions: PlaneMotion[] = [
    { kind: "reflect", axis: "x" },
    { kind: "reflect", axis: "y" },
    { kind: "rotate", degrees: 90 },
    { kind: "rotate", degrees: 270 },
    { kind: "rotate", degrees: 180 },
  ];
  const motion: PlaneMotion =
    r(0, 5) === 0
      ? (() => {
          let dx = r(-5, 5),
            dy = r(-5, 5);
          while (dx === 0 && dy === 0) [dx, dy] = [r(-5, 5), r(-5, 5)];
          return { kind: "translate", dx, dy } as PlaneMotion;
        })()
      : motions[r(0, motions.length - 1)]!;
  const names = (
    [
      ["A", "B", "C"],
      ["P", "Q", "R"],
      ["D", "E", "F"],
    ] as const
  )[r(0, 2)]!.slice(0, count);
  for (let attempt = 0; attempt < 500; attempt++) {
    // Reflections keep the figure on one side of the mirror and turns keep
    // it in one quadrant, so the image lands clear of the original.
    const sx = r(0, 1) ? 1 : -1,
      sy = r(0, 1) ? 1 : -1;
    const coordinate = (sign: number, fixed: boolean) =>
      fixed ? sign * r(1, 5) : r(-5, 5);
    const vertices: LatticePoint[] = [];
    while (vertices.length < count) {
      const p: LatticePoint = [
        coordinate(
          sx,
          motion.kind === "rotate" ||
            (motion.kind === "reflect" && motion.axis === "y"),
        ),
        coordinate(
          sy,
          motion.kind === "rotate" ||
            (motion.kind === "reflect" && motion.axis === "x"),
        ),
      ];
      if (!vertices.some((v) => key(v) === key(p))) vertices.push(p);
    }
    const image = vertices.map((v) => apply(motion, v));
    if (!image.every((p) => inWindow(p))) continue;
    if (count === 3) {
      // A non-degenerate scalene triangle, so each vertex has one image.
      const [a, b, c] = vertices as [LatticePoint, LatticePoint, LatticePoint];
      const area =
        (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const d = (p: LatticePoint, q: LatticePoint) =>
        (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      const sides = [d(a, b), d(b, c), d(c, a)];
      if (Math.abs(area) < 4 || new Set(sides).size !== 3) continue;
    } else if (
      (vertices[0]![0] - vertices[1]![0]) ** 2 +
        (vertices[0]![1] - vertices[1]![1]) ** 2 <
      5
    )
      continue;
    // The image must move: no vertex may be its own image or another's.
    const before = new Set(vertices.map(key));
    if (image.some((p) => before.has(key(p)))) continue;
    // Keep the figure on one side of the mirror, or in one quadrant for a
    // turn, so the image lands clear of the original.
    const side = (values: number[]) =>
      values.every((v) => v > 0) || values.every((v) => v < 0);
    const xs = vertices.map(([x]) => x),
      ys = vertices.map(([, y]) => y);
    if (motion.kind === "reflect" && !side(motion.axis === "x" ? ys : xs))
      continue;
    if (motion.kind === "rotate" && !(side(xs) && side(ys))) continue;
    const primes = names.map((n) => `${n}′`);
    const shape =
      count === 3
        ? `Triangle $${names.join("")}$`
        : `Segment $${names.join("")}$`;
    const response: PointPlotResponse = {
      kind: "point-plot",
      label: `Place ${list(primes.map((p) => `$${p.replace("′", "'")}$`))}`,
      grid: GRID,
      pointCount: count,
      ordered: true,
      pointLabels: primes,
      connect: "polygon",
      given: {
        vertices: vertices.map(([x, y], i) => ({ x, y, label: names[i]! })),
        closed: count === 3,
      },
    };
    const given = vertices.map((p, i) => pointTex(p, names[i]));
    return problemOf(meta, seed, {
      prompt: `${shape} has ${count === 3 ? "vertices" : "endpoints"} ${list(given)}. It is ${motionWords(motion)}. Place ${list(primes.map((p) => `$${p.replace("′", "'")}$`))}, the images of ${list(names.map((n) => `$${n}$`))}.`,
      response,
      answer: image,
      grading: { mode: "exact" },
      hint: motionHint(motion, names[0]!, vertices[0]!),
      explanation: [
        `The coordinate rule is ${motionRule(motion)}.`,
        ...vertices.map(
          (p, i) =>
            `${pointTex(p, names[i])} maps to ${pointTex(image[i]!, primes[i])}.`,
        ),
        `A rigid motion keeps lengths and angles, so ${count === 3 ? `triangle $${primes.join("").replaceAll("′", "'")}$ is congruent to triangle $${names.join("")}$` : `$${primes.join("").replaceAll("′", "'")}$ has the same length as $${names.join("")}$`}.`,
      ],
    });
  }
  throw new Error("No rigid-motion figure fits the grid");
}

export function generatePointPlotProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  switch (templateId) {
    case "plot-points":
      return plotPoints(seed);
    case "graph-linear-equation":
      return graphLinearEquation(seed);
    case "place-transformed-image":
      return placeTransformedImage(seed);
  }
  const curve = generateCurveParts(templateId, seed);
  const meta = pointPlotCurveTemplates.find((t) => t.id === templateId);
  if (curve && meta) return problemOf(meta, seed, curve);
  throw new Error(`Unknown point-plot family ${templateId}`);
}
