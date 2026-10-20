import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { act, circleDiagram, graph, step } from "./scene/author";
import type { Point, Scene } from "./scene/spec";
import type { Action } from "./scene/timeline";

/** Geometry with coordinates and circles (G-GPE, G-C): circle equations,
 * perimeter and area from coordinates, partitioning a segment, parallel and
 * perpendicular slopes, and angles in circles. */
type Random = (low: number, high: number) => number;
type Rational = { n: number; d: number };
type Case = {
  prompt: string;
  answer: Rational;
  explanation: string[];
  hint: string;
  tags: string[];
  figure?: Scene;
  label: string;
};

const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const coordinateCircleTemplates: readonly TemplateMetadata[] = [
  {
    id: "circle-equation",
    version: 1,
    title: "Equations of circles",
    skillId: "circle-equations",
    gradeBand: "9–12",
    description:
      "Read the center and radius from (x − h)² + (y − k)² = r², complete the square in x² + y² + Dx + Ey + F = 0, and write r² from a center and a point.",
    ...scenes,
  },
  {
    id: "coordinate-polygon",
    version: 1,
    title: "Perimeter and area from coordinates",
    skillId: "coordinate-measurement",
    gradeBand: "9–12",
    description:
      "Find perimeters with the distance formula and areas by enclosing a polygon in a rectangle, from vertex coordinates.",
    ...scenes,
  },
  {
    id: "segment-partition",
    version: 1,
    title: "Partition a segment in a ratio",
    skillId: "segment-division",
    gradeBand: "9–12",
    description:
      "Find the point that divides a directed segment in a given ratio, or a given fraction of the way from one end, one coordinate at a time.",
    ...scenes,
  },
  {
    id: "perpendicular-slopes",
    version: 1,
    title: "Parallel and perpendicular slopes",
    skillId: "slope-proofs",
    gradeBand: "9–12",
    description:
      "Use equal slopes for parallel lines and negative reciprocal slopes for perpendicular lines: slopes, lines through a point, and a missing coordinate.",
    ...scenes,
  },
  {
    id: "circle-angles",
    version: 1,
    title: "Angles in circles",
    skillId: "circle-theorems",
    gradeBand: "9–12",
    description:
      "Use inscribed angles (half the central angle on the same arc), the right angle in a semicircle, and a tangent perpendicular to the radius.",
    ...scenes,
  },
];

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Rational {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const value = (v: Rational) => v.n / v.d;
const frac = (v: Rational) =>
  `${v.n < 0 ? "−" : ""}${Math.abs(v.n)}${v.d === 1 ? "" : `/${v.d}`}`;
const answerText = (v: Rational) => `${v.n}${v.d === 1 ? "" : `/${v.d}`}`;
/** −3 with a typographic minus. */
const n = (x: number) => String(x).replace("-", "−");
const pt = ([x, y]: Point) => `(${n(x)}, ${n(y)})`;
/** "A, B and C". */
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
/** Twice the signed area by the shoelace sum, written out with its terms. */
function shoelace(P: Point[]) {
  const terms = P.map((p, i) => {
    const q = P[(i + 1) % P.length]!;
    return {
      text: `${n(p[0])}·${n(q[1])} − ${n(q[0])}·${n(p[1])}`,
      value: p[0] * q[1] - q[0] * p[1],
    };
  });
  const sum = terms.reduce((a, t) => a + t.value, 0);
  return { terms, sum };
}
/** "x − 3", "x + 2" or "x" for (x − h). */
const shift = (v: string, h: number) =>
  h === 0 ? v : `${v} ${h > 0 ? "−" : "+"} ${Math.abs(h)}`;
/** (x − 3)² or x² when the center coordinate is 0. */
const sq = (v: string, h: number) => (h === 0 ? `${v}²` : `(${shift(v, h)})²`);
/** An equation as TeX: squares and minus signs typeset. */
const math = (plain: string) =>
  `$${plain
    .replace(/²/g, "^2")
    .replace(/−/g, "-")
    .replace(/°/g, "^\\circ")
    .replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}")}$`;

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let v: number;
    do
      v = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (v >= limit);
    return low + (v % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const light = (target: string, ink: "accent" | "warm" | "gold"): Action => ({
  do: "fill",
  target,
  ink,
});
/** A window around points, with room for labels. */
function windowFor(points: Point[], pad = 2) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const lo = Math.min(-1, ...xs, ...ys) - pad,
    hi = Math.max(1, ...xs, ...ys) + pad;
  const span = hi - lo;
  return {
    x: [Math.floor(lo), Math.ceil(hi)] as [number, number],
    y: [Math.floor(lo), Math.ceil(hi)] as [number, number],
    tick: span > 24 ? 4 : span > 12 ? 2 : 1,
  };
}
const triples: readonly [number, number, number][] = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [0, 5, 5],
  [4, 3, 5],
  [8, 6, 10],
];

// ------------------------------------------------------------ circle equations
function circleCase(r: Random): Case {
  const mode = r(0, 3);
  const h = r(-6, 6),
    k = r(-6, 6);
  if (mode === 2 || mode === 3) {
    // A center and a point on the circle, at a whole-number distance.
    const [dx, dy] = pick(r, triples);
    const sx = r(0, 1) ? 1 : -1,
      sy = r(0, 1) ? 1 : -1;
    const P: Point = [h + sx * dx, k + sy * dy];
    const r2 = dx * dx + dy * dy;
    const w = windowFor(
      [
        [h - Math.sqrt(r2), k - Math.sqrt(r2)],
        [h + Math.sqrt(r2), k + Math.sqrt(r2)],
      ],
      1,
    );
    const figure = graph({ x: w.x, y: w.y, tick: w.tick })
      .id("g")
      .circle([h, k], Math.sqrt(r2), { showCenter: true })
      .point(h, k, "C")
      .point(P[0], P[1], "P")
      .segment([h, k], P)
      .scene({
        title: "A circle with center C through P",
        steps: [
          step(
            "The radius is the distance from the center $C$ to $P$.",
            act.trace("g.segment.0"),
          ),
          step(
            `Across: ${Math.abs(P[0] - h)}; up or down: ${Math.abs(P[1] - k)}.`,
            act.highlight("g.point.1"),
          ),
        ],
      });
    const read = mode === 3;
    return {
      prompt: read
        ? `The graph shows a circle with center $C$ and a point $P$ on it. Its equation is (x − a)² + (y − b)² = c. What is $c$?`
        : `A circle has center ${pt([h, k])} and passes through ${pt(P)}. Its equation is ${math(`${sq("x", h)} + ${sq("y", k)} = r²`)}. What is r²?`,
      answer: q(r2),
      explanation: [
        read
          ? `From the graph, $C = ${pt([h, k])}$ and $P = ${pt(P)}$.`
          : `$r$ is the distance from the center ${pt([h, k])} to ${pt(P)}.`,
        `r² = (${n(P[0])} − ${n(h)})² + (${n(P[1])} − ${n(k)})² = ${dx}² + ${dy}² = ${r2}.`.replace(
          /− −/g,
          "+ ",
        ),
        `r² = ${r2}.`,
      ],
      hint: read
        ? "Read the center $C$ and the point $P$ from the grid. The squared radius is (change in $x$)² + (change in $y$)²."
        : `The radius runs from ${pt([h, k])} to ${pt(P)}. Square the change in $x$ and the change in $y$, and add.`,
      tags: [read ? "graph" : "center-point"],
      figure,
      label: read ? "c" : "r²",
    };
  }
  const rr = r(1, 9);
  if (mode === 0) {
    const ask = pick(r, ["radius", "x", "y"] as const);
    return {
      prompt: `A circle has equation ${math(`${sq("x", h)} + ${sq("y", k)} = ${rr * rr}`)}. ${
        ask === "radius"
          ? "What is its radius?"
          : `What is the $${ask}$-coordinate of its center?`
      }`,
      answer: q(ask === "radius" ? rr : ask === "x" ? h : k),
      explanation: [
        `Compare with ${math("(x − h)² + (y − k)² = r²")}: the center is $(h, k)$ and r² is the right side.`,
        `Matching ${shift("x", h)} with x − h gives h = ${n(h)}; matching ${shift("y", k)} with y − k gives k = ${n(k)}. So the center is ${pt([h, k])}, and the radius is the square root of ${rr * rr}: r = ${rr}.`,
        ask === "radius"
          ? `The radius is ${rr}.`
          : `The $${ask}$-coordinate of the center is ${n(ask === "x" ? h : k)}.`,
      ],
      hint:
        ask === "radius"
          ? `The right side, ${rr * rr}, is the radius squared, not the radius.`
          : `Write ${ask === "x" ? shift("x", h) : shift("y", k)} in the form ${ask} − ${ask === "x" ? "h" : "k"}. The sign inside the parentheses is the opposite of the center's coordinate.`,
      tags: ["standard", ask],
      label: ask === "radius" ? "Radius" : `${ask}-coordinate`,
    };
  }
  // General form: x² + y² + Dx + Ey + F = 0.
  const D = -2 * h,
    E = -2 * k,
    F = h * h + k * k - rr * rr;
  const term = (c: number, v: string) =>
    c === 0 ? "" : ` ${c > 0 ? "+" : "−"} ${Math.abs(c)}${v}`;
  const ask = pick(r, ["radius", "x", "y"] as const);
  return {
    prompt: `A circle has equation ${math(`x² + y²${term(D, "x")}${term(E, "y")}${term(F, "")} = 0`)}. ${
      ask === "radius"
        ? "What is its radius?"
        : `What is the $${ask}$-coordinate of its center?`
    }`,
    answer: q(ask === "radius" ? rr : ask === "x" ? h : k),
    explanation: [
      `Group and complete each square: add (half the $x$-coefficient)² = ${h * h} and (half the $y$-coefficient)² = ${k * k} to both sides.`,
      `${math(`${sq("x", h)} + ${sq("y", k)} = ${n(-F)} + ${h * h} + ${k * k} = ${rr * rr}`)}.`
        .replace("+ 0 + 0 ", "")
        .replace(/= (−?\d+) \+ 0 \+ /, "= $1 + "),
      ask === "radius"
        ? `r² = ${rr * rr}, so the radius is ${rr}.`
        : `The center is ${pt([h, k])}, so its $${ask}$-coordinate is ${n(ask === "x" ? h : k)}.`,
    ],
    hint: `Complete the square in $x$ and in $y$: the $x$-coefficient ${n(D)} halves to ${n(D / 2)}, and the $y$-coefficient ${n(E)} halves to ${n(E / 2)}.`,
    tags: ["general", ask],
    label: ask === "radius" ? "Radius" : `${ask}-coordinate`,
  };
}

// ------------------------------------------------------ coordinate measurement
function polygonCase(r: Random): Case {
  const mode = r(0, 2);
  const ox = r(-5, 2),
    oy = r(-5, 2);
  if (mode === 0) {
    // A triangle with lattice vertices; area by enclosing it in a rectangle.
    let A: Point, B: Point, C: Point, area2: number;
    do {
      A = [ox, oy];
      B = [ox + r(3, 8), oy + r(-2, 3)];
      C = [ox + r(0, 8), oy + r(3, 8)];
      area2 = Math.abs(
        (B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1]),
      );
    } while (area2 === 0);
    const pts = [A, B, C];
    const xs = pts.map((p) => p[0]),
      ys = pts.map((p) => p[1]);
    const W = Math.max(...xs) - Math.min(...xs),
      H = Math.max(...ys) - Math.min(...ys);
    const w = windowFor(pts, 1);
    return {
      prompt: `A triangle has vertices $A${pt(A)}$, $B${pt(B)}$ and $C${pt(C)}$. What is its area, in square units?`,
      answer: q(area2, 2),
      explanation: [
        `Enclose it in the rectangle from x = ${n(Math.min(...xs))} to ${n(Math.max(...xs))} and y = ${n(Math.min(...ys))} to ${n(Math.max(...ys))}: ${W} × ${H} = ${W * H}.`,
        `Subtract the three right triangles in the corners, or use the shoelace sum: ${shoelace(
          pts,
        )
          .terms.map((t) => `(${t.text})`)
          .join(" + ")} = ${n(shoelace(pts).sum)}.`,
        `Half its size: ${Math.abs(shoelace(pts).sum)} ÷ 2 = ${frac(q(area2, 2))}.`,
        `Area = ${frac(q(area2, 2))} square units.`,
      ],
      hint: `Draw the smallest rectangle around $A${pt(A)}$, $B${pt(B)}$ and $C${pt(C)}$: ${W} by ${H}. Subtract the right triangles in its corners that lie outside the triangle.`,
      tags: ["area", "triangle"],
      figure: graph({ x: w.x, y: w.y, tick: w.tick })
        .id("g")
        .point(A[0], A[1], "A")
        .point(B[0], B[1], "B")
        .point(C[0], C[1], "C")
        .segment(A, B)
        .segment(B, C)
        .segment(C, A)
        .scene({ title: "Triangle ABC on a grid" }),
      label: "Area",
    };
  }
  // A polygon with whole-number sides: axis sides and 3-4-5 diagonals.
  const [a, b] = pick(r, [
    [3, 4],
    [4, 3],
    [6, 8],
    [5, 12],
  ] as const);
  const c = Math.hypot(a, b);
  if (mode === 1) {
    // Right triangle with legs on the grid lines, or a parallelogram.
    const para = r(0, 1) === 1;
    const base = r(3, 9);
    const P: Point[] = para
      ? [
          [ox, oy],
          [ox + base, oy],
          [ox + base + a, oy + b],
          [ox + a, oy + b],
        ]
      : [
          [ox, oy],
          [ox + a, oy],
          [ox + a, oy + b],
        ];
    const names = para ? ["A", "B", "C", "D"] : ["A", "B", "C"];
    const perimeter = para ? 2 * (base + c) : a + b + c;
    const w = windowFor(P, 1);
    let g = graph({ x: w.x, y: w.y, tick: w.tick }).id("g");
    P.forEach((p, i) => (g = g.point(p[0], p[1], names[i])));
    P.forEach((p, i) => (g = g.segment(p, P[(i + 1) % P.length]!)));
    const slanted = para ? 1 : 2;
    return {
      prompt: `A ${para ? "parallelogram" : "triangle"} has vertices ${list(P.map((p, i) => `$${names[i]}${pt(p)}$`))}. What is its perimeter?`,
      answer: q(perimeter),
      explanation: [
        para
          ? `AB and CD are horizontal: each is ${base}.`
          : `AB is horizontal, ${a} long, and BC is vertical, ${b} long.`,
        `The slanted ${para ? "sides run" : "side runs"} ${a} across and ${b} up: √(${a}² + ${b}²) = √${a * a + b * b} = ${c}.`,
        para
          ? `Perimeter = 2 × (${base} + ${c}) = ${perimeter}.`
          : `Perimeter = ${a} + ${b} + ${c} = ${perimeter}.`,
      ],
      hint: `From $${names[0]}${pt(P[0]!)}$, count the horizontal and vertical sides on the grid. For a slanted side, use its run and rise in the distance formula.`,
      tags: ["perimeter", para ? "parallelogram" : "triangle"],
      figure: g.scene({
        title: `A ${para ? "parallelogram" : "triangle"} on a grid`,
        steps: [
          step(
            "Horizontal and vertical sides: count the units.",
            light("g.segment.0", "accent"),
          ),
          step(
            `A slanted side: ${a} across and ${b} up, so its length is √(${a}² + ${b}²).`,
            light(`g.segment.${slanted}`, "warm"),
          ),
        ],
      }),
      label: "Perimeter",
    };
  }
  // Quadrilateral area by the rectangle method.
  const P: Point[] = [
    [ox, oy + r(0, 2)],
    [ox + r(4, 7), oy],
    [ox + r(6, 9), oy + r(4, 7)],
    [ox + r(1, 3), oy + r(5, 8)],
  ];
  let area2 = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = P[i]!,
      [x2, y2] = P[(i + 1) % 4]!;
    area2 += x1 * y2 - x2 * y1;
  }
  area2 = Math.abs(area2);
  const names = ["A", "B", "C", "D"];
  const w = windowFor(P, 1);
  let g = graph({ x: w.x, y: w.y, tick: w.tick }).id("g");
  P.forEach((p, i) => (g = g.point(p[0], p[1], names[i])));
  P.forEach((p, i) => (g = g.segment(p, P[(i + 1) % 4]!)));
  const xs = P.map((p) => p[0]),
    ys = P.map((p) => p[1]);
  const W = Math.max(...xs) - Math.min(...xs),
    H = Math.max(...ys) - Math.min(...ys);
  return {
    prompt: `A quadrilateral has vertices ${list(P.map((p, i) => `$${names[i]}${pt(p)}$`))}, in order. What is its area, in square units?`,
    answer: q(area2, 2),
    explanation: [
      `Enclose it in a ${W} × ${H} rectangle, area ${W * H}.`,
      `Subtract the corner pieces, or use the shoelace sum around $A$, $B$, $C$, $D$: ${shoelace(
        P,
      )
        .terms.map((t) => `(${t.text})`)
        .join(" + ")} = ${n(shoelace(P).sum)}.`,
      `Half its size: ${Math.abs(shoelace(P).sum)} ÷ 2 = ${frac(q(area2, 2))}.`,
      `Area = ${frac(q(area2, 2))} square units.`,
    ],
    hint: `Surround ABCD, from $A${pt(P[0]!)}$, with a ${W}-by-${H} rectangle on the grid. The area you want is what is left after removing the corner triangles.`,
    tags: ["area", "quadrilateral"],
    figure: g.scene({ title: "Quadrilateral ABCD on a grid" }),
    label: "Area",
  };
}

// ---------------------------------------------------------- segment partition
function partitionCase(r: Random): Case {
  const m = r(1, 4),
    k = r(1, 4);
  const total = m + k;
  const A: Point = [r(-8, 2), r(-8, 2)];
  // Never vertical or horizontal: both coordinates change.
  const B: Point = [
    A[0] + total * pick(r, [-2, -1, 1, 2, 3]),
    A[1] + total * r(1, 3),
  ];
  const asRatio = r(0, 1) === 1;
  const axis = r(0, 1);
  const name = axis ? "y" : "x";
  const t = q(m, total);
  const P: Point = [
    A[0] + (B[0] - A[0]) * value(t),
    A[1] + (B[1] - A[1]) * value(t),
  ];
  const answer = q(P[axis]! * 1);
  const run = B[axis]! - A[axis]!;
  const w = windowFor([A, B], 1);
  return {
    prompt: asRatio
      ? `Point $P$ is on segment AB, with $A${pt(A)}$ and $B${pt(B)}$, and divides it so that AP : PB = ${m} : ${k}. What is the $${name}$-coordinate of $P$?`
      : `Point $P$ is ${frac(t)} of the way from $A${pt(A)}$ to $B${pt(B)}$. What is the $${name}$-coordinate of $P$?`,
    answer,
    explanation: [
      asRatio
        ? `With AP : PB = ${m} : ${k}, AB has ${total} equal parts, and $P$ is ${m} ${m === 1 ? "part" : "parts"} from $A$: ${frac(t)} of the way.`
        : `$P$ is ${frac(t)} of the way along AB.`,
      `The $${name}$-coordinate changes by ${n(run)} from $A$ to $B$; ${frac(t)} of that is ${frac(q(run * m, total))}.`,
      `${n(A[axis]!)} + ${frac(q(run * m, total))} = ${frac(answer)}.`.replace(
        "+ −",
        "− ",
      ),
    ],
    hint: asRatio
      ? `A ${m} : ${k} split makes ${m} + ${k} equal parts; $P$ is ${m} ${m === 1 ? "part" : "parts"} from $A$. Take that fraction of the change in $${name}$ and add it to A's $${name}$.`
      : `Take ${frac(t)} of the change in $${name}$ from $A$ to $B$, then add it to A's $${name}$-coordinate.`,
    tags: [asRatio ? "ratio" : "fraction", `axis-${name}`],
    figure: graph({ x: w.x, y: w.y, tick: w.tick })
      .id("g")
      .point(A[0], A[1], "A")
      .point(B[0], B[1], "B")
      .segment(A, B)
      .slope(A, B, "none")
      .scene({
        title: "Segment AB",
        steps: [
          step(
            "From $A$ to $B$: the run and the rise.",
            act.highlight("g.slope.0"),
          ),
          step(
            `$P$ keeps the same fraction of each: ${frac(t)} of the run and ${frac(t)} of the rise.`,
            light("g.segment.0", "accent"),
          ),
        ],
      }),
    label: `$${name}$-coordinate`,
  };
}

// ------------------------------------------------------------- slope proofs
function slopeCase(r: Random): Case {
  const mode = r(0, 3);
  let rise: number, runV: number;
  do {
    rise = r(-5, 5);
    runV = r(1, 5);
  } while (rise === 0 || gcd(rise, runV) !== 1);
  const A: Point = [r(-6, 0), r(-6, 0)];
  const B: Point = [A[0] + runV, A[1] + rise];
  const m = q(rise, runV),
    perp = q(-runV, rise);
  // The figure shows line AB and its slope triangle, unlabeled: the slope
  // (and the perpendicular direction) is the learner's work.
  const base = () => {
    const w = windowFor([A, B], 1);
    return graph({ x: w.x, y: w.y, tick: w.tick })
      .id("g")
      .point(A[0], A[1], "A")
      .point(B[0], B[1], "B")
      .segment(A, B)
      .slope(A, B, "none")
      .scene({
        title: "Line AB and its slope triangle",
        steps: [
          step(
            "Rise over run along AB gives the slope of $ℓ$.",
            act.highlight("g.slope.0"),
          ),
          step(
            "A perpendicular turns the slope triangle a quarter turn: run and rise swap, and one changes sign.",
            act.highlight("g.segment.0"),
          ),
        ],
      });
  };
  if (mode === 0) {
    const parallel = r(0, 1) === 1;
    return {
      prompt: `Line $ℓ$ passes through $A${pt(A)}$ and $B${pt(B)}$. What is the slope of a line ${parallel ? "parallel" : "perpendicular"} to $ℓ$?`,
      answer: parallel ? m : perp,
      explanation: [
        `Slope of $ℓ$: $(${n(B[1])} − ${n(A[1])}) ÷ (${n(B[0])} − ${n(A[0])}) = ${frac(m)}$.`.replace(
          /− −/g,
          "+ ",
        ),
        parallel
          ? `Parallel lines have equal slopes: ${frac(m)}.`
          : `Perpendicular slopes are negative reciprocals (their product is −1): −1 ÷ ${frac(m)} = ${frac(perp)}.`,
      ],
      hint: parallel
        ? `Find the slope of $ℓ$ from $A${pt(A)}$ and $B${pt(B)}$: rise over run. A parallel line goes in the same direction.`
        : `Find the slope of $ℓ$ from $A${pt(A)}$ and $B${pt(B)}$, then flip it and change its sign.`,
      tags: [parallel ? "parallel" : "perpendicular"],
      figure: base(),
      label: "Slope",
    };
  }
  const P: Point = [r(-4, 4), r(-4, 4)];
  if (mode === 1 || mode === 2) {
    const parallel = mode === 1;
    const s = parallel ? m : perp;
    const b = q(P[1] * s.d - s.n * P[0], s.d);
    return {
      prompt: `Line $ℓ$ passes through $A${pt(A)}$ and $B${pt(B)}$. The line through $P${pt(P)}$ ${parallel ? "parallel" : "perpendicular"} to $ℓ$ has equation y = mx + b. What is $b$?`,
      answer: b,
      explanation: [
        `Slope of $ℓ$: ${frac(m)}. The new line's slope is ${parallel ? `the same, ${frac(s)}` : `its negative reciprocal, ${frac(s)}`}.`,
        `Through $P$: ${n(P[1])} = ${frac(s)} × ${n(P[0])} + b, so $b = ${n(P[1])} ${s.n * P[0] < 0 ? "+" : "−"} ${frac(q(Math.abs(s.n * P[0]), s.d))} = ${frac(b)}$.`,
      ],
      hint: `First the slope: ${parallel ? "equal to $ℓ$'s" : "the negative reciprocal of $ℓ$'s"}. Then put $P${pt(P)}$ into y = mx + b and solve for $b$.`,
      tags: [parallel ? "parallel-line" : "perpendicular-line"],
      figure: base(),
      label: "Value of $b$",
    };
  }
  // A missing coordinate that makes two lines perpendicular.
  const C: Point = [A[0], A[1]];
  const D: Point = [A[0] - rise * 2, A[1] + runV * 2];
  return {
    prompt: `Line $ℓ$ passes through $A${pt(A)}$ and $B${pt(B)}$. Line $j$ passes through $C${pt(C)}$ and $D(${n(D[0])}, k)$. For which value of $k$ is $j$ perpendicular to $ℓ$?`,
    answer: q(D[1]),
    explanation: [
      `Slope of $ℓ$: ${frac(m)}, so $j$ needs slope ${frac(perp)}.`,
      `Slope of $j$: $(k − ${n(C[1])}) ÷ (${n(D[0])} − ${n(C[0])}) = ${frac(perp)}$, so $k − ${n(C[1])} = ${frac(perp)} × ${n(D[0] - C[0])} = ${n(D[1] - C[1])}$.`.replace(
        /− −/g,
        "+ ",
      ),
      `k = ${n(D[1])}.`,
    ],
    hint: `$j$ must have slope −1 ÷ (slope of $ℓ$). Write j's slope from $C$ and $D$ with $k$ in it, and set the two equal.`,
    tags: ["missing-coordinate"],
    figure: base(),
    label: "Value of $k$",
  };
}

// ---------------------------------------------------------- angles in circles
function circleAngleCase(r: Random): Case {
  const mode = r(0, 3);
  if (mode === 0) {
    // Inscribed and central angles on the same arc.
    const central = 2 * r(20, 80);
    const a0 = r(190, 230),
      b0 = a0 + central;
    const c0 = (b0 + (360 - central) / 2 + r(-20, 20)) % 360;
    const fromCentral = r(0, 1) === 1;
    const inscribed = central / 2;
    return {
      prompt: fromCentral
        ? `In circle $O$, central angle AOB measures ${central}°, and $C$ is on the circle but not on arc AB, the arc inside angle AOB. What is the measure of inscribed angle ACB, in degrees?`
        : `In circle $O$, inscribed angle ACB measures ${inscribed}°. What is the measure of central angle AOB, in degrees, on the same arc AB?`,
      answer: q(fromCentral ? inscribed : central),
      explanation: [
        "An inscribed angle and a central angle on the same arc: the inscribed angle is half the central angle.",
        fromCentral
          ? `∠ACB = ${central}° ÷ 2 = ${inscribed}°.`
          : `∠AOB = 2 × ${inscribed}° = ${central}°.`,
      ],
      hint: fromCentral
        ? `Angle AOB, ${central}°, and angle ACB stand on the same arc AB. Which is larger, and by what factor?`
        : `Angle ACB, ${inscribed}°, is an inscribed angle; the central angle on the same arc is the larger one.`,
      tags: ["inscribed", fromCentral ? "from-central" : "from-inscribed"],
      figure: circleDiagram({
        points: [
          { name: "A", at: a0 },
          { name: "B", at: b0 },
          { name: "C", at: c0 },
        ],
        center: true,
        segments: [
          { from: "C", to: "A" },
          { from: "C", to: "B" },
          { from: "O", to: "A", dash: true },
          { from: "O", to: "B", dash: true },
        ],
        angles: [
          {
            at: "C",
            from: "A",
            to: "B",
            label: fromCentral ? null : `${inscribed}°`,
          },
          {
            at: "O",
            from: "A",
            to: "B",
            label: fromCentral ? `${central}°` : null,
            color: "accent",
          },
        ],
        arcs: [{ from: "A", to: "B" }],
      })
        .id("c")
        .scene({
          title: "Inscribed angle ACB and central angle AOB",
          steps: [
            step(
              "Both angles open onto the same arc AB.",
              act.highlight("c.arc.0"),
            ),
            step(
              "The central angle is twice the inscribed angle.",
              act.highlight("c.angle.1"),
              act.highlight("c.angle.0"),
            ),
          ],
        }),
      label: "Degrees",
    };
  }
  if (mode === 1) {
    // Angle in a semicircle.
    const x = r(15, 75);
    // ∠CAB is half of arc CB: C sits at 2x° when B is at 0° and A at 180°.
    const c0 = 2 * x;
    return {
      prompt: `AB is a diameter of circle $O$, and $C$ is another point on the circle. ∠CAB = ${x}°. What is the measure of ∠CBA, in degrees?`,
      answer: q(90 - x),
      explanation: [
        "An angle inscribed in a semicircle is a right angle: ∠ACB stands on the 180° arc, so it measures 180° ÷ 2 = 90°.",
        `The angles of triangle ABC add to 180°: ∠CBA = 180° − 90° − ${x}° = ${90 - x}°.`,
      ],
      hint: `AB is a diameter, so the angle at $C$ is special. Then use the triangle's angle sum with ${x}°.`,
      tags: ["semicircle"],
      figure: circleDiagram({
        points: [
          { name: "A", at: 180 },
          { name: "B", at: 0 },
          { name: "C", at: c0 },
        ],
        center: true,
        segments: [
          { from: "A", to: "B" },
          { from: "A", to: "C" },
          { from: "C", to: "B" },
        ],
        angles: [
          { at: "C", from: "A", to: "B", mark: "right" },
          { at: "A", from: "B", to: "C", label: `${x}°`, color: "accent" },
          { at: "B", from: "C", to: "A", label: null },
        ],
      })
        .id("c")
        .scene({
          title: "Triangle ABC in a semicircle",
          steps: [
            step(
              "A diameter subtends a right angle at any point of the circle.",
              act.highlight("c.angle.0"),
            ),
          ],
        }),
      label: "Degrees",
    };
  }
  if (mode === 2) {
    // Tangent length from the radius and the distance to the center.
    const [a, b, c] = pick(r, [
      [3, 4, 5],
      [5, 12, 13],
      [8, 15, 17],
      [6, 8, 10],
      [7, 24, 25],
    ] as const);
    const askTangent = r(0, 1) === 1;
    const radius = askTangent ? a : a;
    const dist = c / radius;
    const tAngle = 90;
    const pAngle = tAngle - (Math.acos(radius / c) * 180) / Math.PI;
    return {
      prompt: askTangent
        ? `PT is tangent to circle $O$ at $T$. The radius is ${a} and OP = ${c}. How long is PT?`
        : `PT is tangent to circle $O$ at $T$. PT = ${b} and OP = ${c}. What is the radius of the circle?`,
      answer: q(askTangent ? b : a),
      explanation: [
        "A tangent is perpendicular to the radius at the point of tangency, so triangle OTP has a right angle at $T$, with hypotenuse OP.",
        askTangent
          ? `PT = √(${c}² − ${a}²) = √${c * c - a * a} = ${b}.`
          : `OT = √(${c}² − ${b}²) = √${c * c - b * b} = ${a}.`,
      ],
      hint: `The radius OT and the tangent PT meet at a right angle, so OP = ${c} is the hypotenuse of a right triangle.`,
      tags: ["tangent", askTangent ? "ask-tangent" : "ask-radius"],
      figure: circleDiagram({
        points: [{ name: "T", at: tAngle }],
        outside: [{ name: "P", at: pAngle, dist }],
        center: true,
        segments: [
          { from: "O", to: "T", label: askTangent ? String(a) : null },
          {
            from: "T",
            to: "P",
            label: askTangent ? null : String(b),
            color: "accent",
          },
          { from: "O", to: "P", label: String(c), dash: true },
        ],
        angles: [{ at: "T", from: "O", to: "P", mark: "right" }],
      })
        .id("c")
        .scene({
          title: "Tangent PT and radius OT",
          steps: [
            step(
              "The radius meets the tangent at a right angle.",
              act.highlight("c.angle.0"),
            ),
            step(
              "So OP is the hypotenuse of right triangle OTP.",
              light("c.segment.2", "warm"),
            ),
          ],
        }),
      label: "Length",
    };
  }
  // Inscribed angles on the same arc are equal.
  const x = r(20, 70);
  const a0 = r(190, 230),
    b0 = a0 + 2 * x;
  const rest = 360 - 2 * x;
  const c0 = (b0 + rest * 0.3) % 360,
    d0 = (b0 + rest * 0.7) % 360;
  return {
    prompt: `Points $A$, $B$, $C$ and $D$ are on a circle, with $C$ and $D$ on the same side of chord AB. ∠ACB = ${x}°. What is the measure of ∠ADB, in degrees?`,
    answer: q(x),
    explanation: [
      "Both angles are inscribed angles on the same arc AB.",
      `Each is half the central angle on that arc, so they are equal: ∠ADB = ${x}°.`,
    ],
    hint: `∠ACB = ${x}° and ∠ADB both open onto arc AB. What does each equal in terms of the central angle?`,
    tags: ["same-arc"],
    figure: circleDiagram({
      points: [
        { name: "A", at: a0 },
        { name: "B", at: b0 },
        { name: "C", at: c0 },
        { name: "D", at: d0 },
      ],
      segments: [
        { from: "C", to: "A" },
        { from: "C", to: "B" },
        { from: "D", to: "A", color: "accent" },
        { from: "D", to: "B", color: "accent" },
      ],
      angles: [
        { at: "C", from: "A", to: "B", label: `${x}°` },
        { at: "D", from: "A", to: "B", label: null, color: "accent" },
      ],
      arcs: [{ from: "A", to: "B" }],
    })
      .id("c")
      .scene({
        title: "Two inscribed angles on arc AB",
        steps: [
          step("Both angles open onto arc AB.", act.highlight("c.arc.0")),
        ],
      }),
    label: "Degrees",
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "circle-equation": circleCase,
  "coordinate-polygon": polygonCase,
  "segment-partition": partitionCase,
  "perpendicular-slopes": slopeCase,
  "circle-angles": circleAngleCase,
};

export function coordinateCircleCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = coordinateCircleTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown coordinate template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const c = builders[id]!(random(id, seed));
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: {
        kind: c.answer.d === 1 ? "number" : "fraction",
        label: c.label,
      },
      ...(c.figure
        ? { figure: { kind: "scene" as const, scene: c.figure } }
        : {}),
    },
    answer: answerText(c.answer),
    explanation: c.explanation,
    hint: c.hint,
  };
  return {
    problem,
    tags: c.tags,
    caseKey: `${c.prompt}${JSON.stringify(c.figure ?? null)}`,
  };
}
export const generateCoordinateCircleProblem = (
  id: string,
  seed: string,
): GeneratedProblem => coordinateCircleCase(id, seed).problem;
