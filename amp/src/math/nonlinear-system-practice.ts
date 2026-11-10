import type { TemplateMetadata, GeneratedProblem } from "./contracts";
import {
  assemble,
  constText,
  linearText,
  n,
  pick,
  p,
  rat,
  seeded,
  termText,
} from "./algebra-one-kit";
import { f, graph } from "./scene/author";
import { chooseAxes, defineAxis, surfaceStream } from "./variation/axes";

/** A short thread from reading shared points to substitution and counting roots. */
export const nonlinearSystemTemplates: readonly TemplateMetadata[] = [
  {
    id: "nonlinear-system-read",
    title: "Read a line and parabola intersection",
    description:
      "Read the smaller or larger intersection coordinate from a graph and its equations.",
    difficultyOffset: -0.5,
    requiredFigureCapability: "scenes-v1",
  },
  {
    id: "nonlinear-system-solve",
    title: "Solve a line and parabola system",
    description:
      "Substitute a line into a quadratic and recover a requested coordinate, or use both intersection points of a line with a parabola or a circle.",
    difficultyOffset: 0,
  },
  {
    id: "nonlinear-system-count",
    title: "Count line and parabola intersections",
    description:
      "Use the discriminant to count zero, one or two real solutions, including irrational intersections.",
    difficultyOffset: 0.5,
  },
].map((t) => ({
  ...t,
  skillId:
    t.id === "nonlinear-system-read"
      ? "nonlinear-intersection-reading"
      : t.id === "nonlinear-system-count"
        ? "nonlinear-intersection-count"
        : "nonlinear-systems",
  version: t.id === "nonlinear-system-solve" ? 2 : 1,
  gradeBand: "9–12" as const,
  ...(t.id === "nonlinear-system-solve" ? { reprintsFrom: 1 } : {}),
})) as readonly TemplateMetadata[];

/** Legacy asks for one coordinate of a known pair. The plot family asks for
 * the smaller x, the larger x, or the y of the smaller-x point, so one
 * crossing is not enough. The response stays numeric: this template has no
 * point-plot capability. */
const solveAxes = {
  task: defineAxis(
    "task",
    ["coordinate", "smaller-x", "larger-x", "smaller-y"] as const,
    {
      legacy: "coordinate",
      silentLegacy: true,
      since: 2,
      weights: [3, 1, 1, 1],
    },
  ),
};
type PlotTask = "smaller-x" | "larger-x" | "smaller-y";
type PlotPoint = { x: number; y: number };
const GRID = { xMin: -8, xMax: 8, yMin: -10, yMax: 10 };
const onGrid = (x: number, y: number) =>
  x >= GRID.xMin && x <= GRID.xMax && y >= GRID.yMin && y <= GRID.yMax;
const gdiv = (a: number, b: number): number => (b ? gdiv(b, a % b) : Math.abs(a));
function reduced(n: number, d: number) {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gdiv(n, d) || 1;
  return { n: n / g, d: d / g };
}
function inBounds(n: number, d: number, lo: number, hi: number) {
  const q = reduced(n, d);
  return q.n >= lo * q.d && q.n <= hi * q.d;
}
function lineTex(dy: number, dx: number, bn: number, bd: number) {
  const m = reduced(dy, dx);
  const b = reduced(bn, bd);
  const frac = (q: { n: number; d: number }) =>
    q.d === 1
      ? `${q.n}`
      : `${q.n < 0 ? "-" : ""}\\frac{${Math.abs(q.n)}}{${q.d}}`;
  let slope = "";
  if (m.n !== 0) {
    if (m.d === 1) slope = m.n === 1 ? "x" : m.n === -1 ? "-x" : `${m.n}x`;
    else slope = `${m.n < 0 ? "-" : ""}\\frac{${Math.abs(m.n)}}{${m.d}}x`;
  }
  if (b.n === 0 && slope) return slope;
  if (!slope) return frac(b);
  if (b.d === 1) return `${slope}${b.n < 0 ? b.n : `+${b.n}`}`;
  return `${slope}${b.n < 0 ? "-" : "+"}\\frac{${Math.abs(b.n)}}{${b.d}}`;
}
function plotIntersections(
  meta: (typeof nonlinearSystemTemplates)[number],
  seed: string,
  r: ReturnType<typeof seeded>,
  task: PlotTask,
) {
  const roll = surfaceStream(meta.id, seed)(0, 99);
  const tangent = roll < 15;
  const circle = !tangent && roll < 35;
  let quadratic = "";
  let line = "";
  let points: PlotPoint[] = [];
  let radius = 0;
  for (let attempt = 0; attempt < 80 && points.length === 0; attempt++) {
    if (circle) {
      radius = pick(r, [5, 10]);
      const lattice: PlotPoint[] = [];
      for (let x = GRID.xMin; x <= GRID.xMax; x++)
        for (let y = GRID.yMin; y <= GRID.yMax; y++)
          if (x * x + y * y === radius * radius) lattice.push({ x, y });
      if (lattice.length < 2) continue;
      const i = r(0, lattice.length - 1);
      let j = r(0, lattice.length - 2);
      if (j >= i) j++;
      const p = lattice[i]!;
      const q = lattice[j]!;
      if (p.x === q.x) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const bn = p.y * dx - dy * p.x;
      line = lineTex(dy, dx, bn, dx);
      points = [p, q].sort((a, b) => a.x - b.x);
      const m = reduced(dy, dx);
      const b = reduced(bn, dx);
      const onLine = (pt: PlotPoint) =>
        pt.y * m.d * b.d === (m.n * pt.x * b.d + b.n * m.d);
      if (
        points.some(
          (pt) =>
            pt.x * pt.x + pt.y * pt.y !== radius * radius || !onLine(pt),
        )
      ) {
        points = [];
        continue;
      }
    } else {
      const s = r(0, 1) === 0 ? 1 : -1;
      const m = r(-3, 3);
      const b = r(-6, 6);
      const x1 = tangent ? r(-5, 5) : r(-5, 4);
      const x2 = tangent ? x1 : r(x1 + 1, 5);
      const y1 = m * x1 + b;
      const y2 = m * x2 + b;
      if (!onGrid(x1, y1) || !onGrid(x2, y2)) continue;
      const A = s;
      const B = m - s * (x1 + x2);
      const C = s * x1 * x2 + b;
      if (
        !inBounds(-B, 2 * A, GRID.xMin, GRID.xMax) ||
        !inBounds(4 * A * C - B * B, 4 * A, GRID.yMin, GRID.yMax)
      )
        continue;
      quadratic = `${termText(A, "x^2")}${termText(B, "x", false)}${constText(C)}`;
      line = linearText(m, b);
      const pair = [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ];
      if (
        pair.some(
          (pt) => A * pt.x * pt.x + B * pt.x + C !== pt.y || m * pt.x + b !== pt.y,
        )
      )
        continue;
      points = tangent ? [pair[0]!] : pair.sort((p, q) => p.x - q.x);
    }
  }
  if (!points.length) throw new Error("No plot-intersection system on the grid");
  const smaller = points[0]!;
  const larger = points[points.length - 1]!;
  const value =
    task === "smaller-x" ? smaller.x : task === "larger-x" ? larger.x : smaller.y;
  const question =
    task === "smaller-x"
      ? "What is the smaller $x$-coordinate of a solution?"
      : task === "larger-x"
        ? "What is the larger $x$-coordinate of a solution?"
        : "What is the $y$-coordinate of the solution with the smaller $x$-coordinate?";
  const eqs = circle
    ? `$x^2+y^2=${radius * radius}$ and $y = ${line}$`
    : `$y = ${quadratic}$ and $y = ${line}$`;
  const listed = points
    .map((pt) => `\\left(${n(pt.x)}, ${n(pt.y)}\\right)`)
    .join(" and ");
  const built = assemble(
    meta,
    seed,
    {
      prompt: `The graphs of ${eqs} are shown on the grid from $x=-8$ to $8$ and $y=-10$ to $10$. Plot every solution of the system. ${question}`,
      answer: rat(value),
      hint: `The equations are ${eqs}. The solutions are where the graphs meet, not a curve's zeros and not its vertex. A second crossing still counts.`,
      explanation: [
        `The curves meet at ${listed}.`,
        points.length === 1
          ? "They touch at one point, so the smaller and larger $x$-coordinates are the same."
          : `The smaller $x$-coordinate is ${n(smaller.x)} and the larger is ${n(larger.x)}.`,
        `The $y$-coordinate that goes with $x = ${n(smaller.x)}$ is ${n(smaller.y)}.`,
        "Each stored point satisfies both equations, and both points lie on the grid.",
      ],
      tags: [
        "plot-intersections",
        task,
        circle ? "circle" : tangent ? "tangent" : "two-points",
      ],
    },
    r,
    "Coordinate",
  );
  built.problem.variant = { id: task, axes: { task } };
  return built;
}

export function nonlinearSystemCase(id: string, seed: string) {
  const meta = nonlinearSystemTemplates.find((t) => t.id === id);
  if (!meta) throw new Error("Unknown nonlinear-system template");
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  if (id === "nonlinear-system-solve") {
    const task = chooseAxes(id, seed, solveAxes).task;
    if (task !== "coordinate") return plotIntersections(meta, seed, r, task);
  }
  const reading = id === "nonlinear-system-read",
    counting = id === "nonlinear-system-count";
  const a = reading ? 1 : pick(r, [-2, -1, 1, 2]);
  const m = reading ? pick(r, [-1, 0, 1]) : r(-3, 3),
    b = r(-4, 4);
  const left = r(-3, 1),
    right = left + r(1, 4);
  // Quadratic minus line = a(x-left)(x-right), or a((x-h)^2 + k).
  const h = r(-3, 3),
    k = pick(r, [-4, -2, -1, 0, 1, 2, 4]);
  const c = counting ? m - 2 * a * h : m - a * (left + right);
  const d = counting ? b + a * (h * h + k) : b + a * left * right;
  const quadratic = `${termText(a, "x^2")}${termText(c, "x", false)}${constText(d)}`;
  const line = linearText(m, b);
  const small = r(0, 1) === 0;
  const coordinate = !reading && r(0, 1) === 1 ? "y" : "x";
  const selected = small ? left : right;
  const count = k < 0 ? 2 : k === 0 ? 1 : 0;
  const answer = counting
    ? count
    : coordinate === "x"
      ? selected
      : m * selected + b;
  const prompt = `The system is $y = ${quadratic}$ and $y = ${line}$. ${counting ? "How many distinct real ordered-pair solutions does the system have?" : `What is the $${coordinate}$-coordinate of the intersection with the ${small ? "smaller" : "larger"} $x$-coordinate?`}`;
  const B = c - m,
    C = d - b,
    discriminant = B * B - 4 * a * C;
  const reduced = `${termText(a, "x^2")}${termText(B, "x", false)}${constText(C)}`;
  const explanation = counting
    ? [
        `A solution of the system is a point on both graphs: the parabola and the line. There both equations give the same $y$.`,
        `So set the two right sides equal: $${quadratic} = ${line}$. Subtract the line's expression from both sides: $${reduced} = 0$.`,
        `Each real solution $x$ of this quadratic is one crossing point. To count them without solving, use the discriminant.`,
        `The quadratic formula solves $Ax^2 + Bx + C = 0$: $x=\\frac{-B\\pm\\sqrt{B^2-4AC}}{2A}$, where $\\pm$ means once with $+$ and once with $-$. The square root sign asks for a number that, times itself, gives what is under it. The part under it, $B^2 - 4AC$, is called the discriminant. Here it is $${p(B)}^2 - 4 \\cdot ${p(a)} \\cdot ${p(C)} = ${n(discriminant)}$.`,
        discriminant > 0
          ? `It is positive, so it has a positive square root. Adding it and subtracting it in the quadratic formula give two different values: two real roots.`
          : discriminant === 0
            ? `It is zero, so plus and minus the root give the same value: one real root. The line just touches the parabola.`
            : `It is negative, and a negative number has no real square root. So there are no real roots: the line misses the parabola.`,
        `Each real $x$ gives exactly one $y$ on the line, so the system has ${count} distinct real ${count === 1 ? "solution" : "solutions"}.`,
      ]
    : [
        `A solution of the system is a point on both graphs: the parabola and the line. There both equations give the same $y$.`,
        `So set the two right sides equal: $${quadratic} = ${line}$. Subtract the line's expression from both sides: $${reduced} = 0$.`,
        `Factor: $${a === 1 ? "" : n(a)}(x${constText(-left)})(x${constText(-right)}) = 0$. A product is zero only when a factor is zero, so $x = ${n(left)}$ or $x = ${n(right)}$.`,
        `Find each $y$ by putting $x$ into the simpler equation, $y = ${line}$. The shared points are $\\left(${n(left)}, ${n(m * left + b)}\\right)$ and $\\left(${n(right)}, ${n(m * right + b)}\\right)$.`,
        `The ${small ? "smaller" : "larger"} $x$-coordinate is ${n(selected)}. So the requested $${coordinate}$-coordinate is ${n(answer)}.`,
      ];
  if (reading)
    explanation.unshift(
      `On the graph, find where the line crosses the parabola: $\\left(${n(left)}, ${n(m * left + b)}\\right)$ and $\\left(${n(right)}, ${n(m * right + b)}\\right)$. The ${small ? "smaller" : "larger"} $x$-coordinate is the ${small ? "left" : "right"} crossing. The algebra below checks these readings.`,
    );
  const scene = reading
    ? graph({ id: "g", x: [-5, 7], y: [-12, 12], grid: [1, 2], tick: [1, 2] })
        .curve(f.poly(a, c, d), { color: "accent" })
        .curve(f.poly(m, b), { color: "warm", dash: "dash" })
        .scene({
          title: `The solid parabola y = ${quadratic} and dashed line y = ${line}. Read their shared points.`,
        })
    : undefined;
  return assemble(
    meta,
    seed,
    {
      prompt,
      answer: rat(answer),
      explanation,
      scene,
      hint: counting
        ? `Set $${quadratic}$ equal to $${line}$, then move all terms to one side before counting real roots.`
        : reading
          ? `Follow the dashed line $y = ${line}$ to where it meets the parabola $y = ${quadratic}$; compare the horizontal positions of those crossings.`
          : `Replace $y$ in the quadratic by $${line}$, using the line's equation, then collect the terms of $${quadratic}$ on one side.`,
      tags: [
        counting ? `count-${count}` : small ? "smaller" : "larger",
        coordinate,
        `a-${a}`,
      ],
    },
    r,
    counting ? "Number of solutions" : `${coordinate}-coordinate`,
  );
}
export function generateNonlinearSystemProblem(
  id: string,
  seed: string,
): GeneratedProblem {
  return nonlinearSystemCase(id, seed).problem;
}
