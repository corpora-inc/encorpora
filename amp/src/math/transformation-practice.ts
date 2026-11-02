import { createHash } from "node:crypto";
import type {
  CoordinateGeometryFigure,
  GeneratedProblem,
  PlaneMotion,
  SemanticFigure,
  SimilarTrianglesFigure,
  TemplateMetadata,
} from "./contracts";
import { applyMotion } from "./plane-motion";
import {
  exactDecimal,
  isPerfectSquare,
  roundedRoot,
  sweepChoose,
  sweepVariant,
  type SweepAxes,
} from "./number-domain-axes";

type Random = (low: number, high: number) => number;
type Point = { x: number; y: number };
type Case = {
  prompt: string;
  /** A number, a fraction n/d or the exact label of the correct option. */
  answer: string;
  explanation: string[];
  tags: string[];
  figure?: SemanticFigure;
  options?: string[];
  feedback?: Record<string, string>;
  /** Overrides the template's response label. */
  label?: string;
};

const geometry = {
  requiredFigureCapability: "geometry-figures-v1",
} as const;
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const transformationTemplates: readonly TemplateMetadata[] = [
  {
    id: "coordinate-side-length",
    version: 1,
    title: "Side lengths from coordinates",
    skillId: "coordinate-polygons",
    gradeBand: "6–8",
    description:
      "Find the length of a horizontal or vertical side of a polygon from the coordinates of its vertices.",
    ...geometry,
  },
  {
    id: "coordinate-rectangle-measure",
    version: 1,
    title: "Rectangle perimeter and area from coordinates",
    skillId: "coordinate-polygons",
    gradeBand: "6–8",
    description:
      "Find the perimeter or area of a rectangle from the coordinates of its vertices.",
    ...geometry,
  },
  {
    id: "coordinate-distance",
    version: 1,
    title: "Distance between two points",
    skillId: "coordinate-distance",
    gradeBand: "6–8",
    description:
      "Find the whole-number distance between two points with the Pythagorean theorem.",
  },
  {
    id: "coordinate-distance-exact",
    version: 1,
    title: "Exact distance between two points",
    skillId: "coordinate-distance",
    gradeBand: "6–8",
    description:
      "Find the exact distance between two graphed points as a whole number or a simplified square root.",
    ...geometry,
    ...choice,
  },
  {
    id: "transformation-image",
    version: 1,
    title: "Coordinates after a rigid motion",
    skillId: "rigid-motions",
    gradeBand: "6–8",
    description:
      "Find the image of a vertex under a translation, a reflection over an axis or a rotation about the origin.",
    ...geometry,
    ...choice,
  },
  {
    id: "identify-rigid-motion",
    version: 1,
    title: "Identify a rigid motion",
    skillId: "rigid-motions",
    gradeBand: "6–8",
    description:
      "Identify the translation, reflection or rotation that maps one triangle onto another.",
    ...geometry,
    ...choice,
  },
  {
    id: "dilation-image",
    version: 1,
    title: "Coordinates after a dilation",
    skillId: "dilations-similarity",
    gradeBand: "6–8",
    description:
      "Find the image of a vertex under a dilation centered at the origin.",
    ...geometry,
    ...choice,
  },
  {
    id: "dilation-scale-factor",
    version: 1,
    title: "Find a dilation's scale factor",
    skillId: "dilations-similarity",
    gradeBand: "6–8",
    description:
      "Find the scale factor of a dilation centered at the origin from a figure and its image.",
    ...geometry,
  },
  {
    id: "similar-triangles-side",
    version: 1,
    title: "Missing side of similar triangles",
    skillId: "dilations-similarity",
    gradeBand: "6–8",
    description:
      "Find a missing side of a triangle similar to a triangle with known sides.",
    ...geometry,
  },
  {
    id: "scale-drawing",
    version: 1,
    title: "Lengths and areas from a scale drawing",
    skillId: "scale-drawings",
    gradeBand: "6–8",
    description:
      "Find actual lengths, drawing lengths and actual areas from a scale drawing and its scale.",
  },
];

const hints: Record<string, string> = {
  "coordinate-side-length":
    "Two vertices with the same $x$-coordinate lie on a vertical line, so the side's length is the distance between their $y$-coordinates; with the same $y$-coordinate, use the $x$-coordinates. Coordinates on opposite sides of 0 add their distances from 0.",
  "coordinate-rectangle-measure":
    "Find the width from two vertices on a horizontal side and the height from two vertices on a vertical side. Perimeter adds all four sides; area multiplies width by height.",
  "coordinate-distance":
    "The segment is the hypotenuse of a right triangle whose legs are the change in $x$ and the change in $y$. Square the legs, add, and take the square root.",
  "coordinate-distance-exact":
    "Use the change in $x$ and the change in $y$ as the legs of a right triangle. The distance squared is the sum of their squares; take the square root and remove any square factor.",
  "transformation-image":
    "Apply the motion's rule to the vertex: a translation adds to the coordinates, a reflection changes one sign, and a rotation about the origin swaps or negates coordinates.",
  "identify-rigid-motion":
    "Compare each vertex with its image. A translation adds the same amount to every vertex; a reflection over an axis changes the sign of one coordinate; a rotation about the origin swaps or negates both.",
  "dilation-image":
    "A dilation centered at the origin multiplies both coordinates of every point by the scale factor.",
  "dilation-scale-factor":
    "A dilation centered at the origin multiplies every coordinate by the same scale factor $k$. Divide an image coordinate by the matching original coordinate.",
  "similar-triangles-side":
    "Match corresponding sides by the order of the vertices. One pair of known corresponding sides gives the scale factor; multiply the matching side by it.",
  "scale-drawing":
    "Every drawing length is multiplied by the same number to get the actual length. Areas are multiplied by that number squared.",
};

/* ---------- small exact helpers ---------- */
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** A signed integer with a typographic minus. */
const n = (v: number) => (v < 0 ? `−${-v}` : String(v));
const pt = (p: Point) => `(${n(p.x)}, ${n(p.y)})`;
/** A labeled point is one TeX unit: it typesets like every other point and never breaks inside. */
const named = (label: string, p: Point) =>
  `$${label.replace("′", "'")}${pt(p)}$`;
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const units = (v: number, word = "unit") => `${v} ${word}${v === 1 ? "" : "s"}`;
/** The same reduced fraction as TeX: "\\tfrac{3}{2}", "-\\tfrac{1}{3}" or "4". */
function fracTex(num: number, den: number) {
  const f = frac(num, den).replace("−", "-");
  const m = /^(-?)(\d+)\/(\d+)$/.exec(f);
  return m ? `${m[1]}\\tfrac{${m[2]}}{${m[3]}}` : f;
}
/** A reduced fraction for display: "3/2", "−1/3" or "4". */
function frac(num: number, den: number) {
  if (den < 0) [num, den] = [-num, -den];
  const g = gcd(num, den) || 1;
  num /= g;
  den /= g;
  return den === 1 ? n(num) : `${n(num)}/${den}`;
}
/** The plain answer form: "-3/2" or "7". */
function answerFraction(num: number, den: number) {
  return frac(num, den).replace("−", "-");
}
/** A terminating value as a decimal answer ("37.5"); halves and quarters only. */
function decimal(num: number, den: number) {
  const g = gcd(num, den);
  num /= g;
  den /= g;
  if (den === 1) return String(num);
  if (![2, 4].includes(den)) throw new Error("Non-terminating scale answer");
  return String(num / den);
}
const prime = (label: string) => `${label}′`;
/** A primed vertex named in prose, typeset as math. */
const primed = (label: string) => `$${label}'$`;

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
function shuffle<T>(items: T[], r: Random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = r(0, i);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
/** A grid window around the points, padded by one unit and showing the origin. */
function windowAround(points: Point[]) {
  const xs = [0, ...points.map((p) => p.x)],
    ys = [0, ...points.map((p) => p.y)];
  return {
    xMin: Math.min(...xs) - 1,
    xMax: Math.max(...xs) + 1,
    yMin: Math.min(...ys) - 1,
    yMax: Math.max(...ys) + 1,
  };
}
function coordinateFigure(
  shapes: CoordinateGeometryFigure["shapes"],
  extra: Partial<Pick<CoordinateGeometryFigure, "motion" | "rays">> = {},
): CoordinateGeometryFigure {
  return {
    kind: "coordinate-geometry",
    ...windowAround(shapes.flatMap((s) => s.vertices)),
    shapes,
    ...extra,
  };
}
const labelled = (labels: string, points: Point[]) =>
  points.map((p, i) => ({ ...p, label: labels[i]! }));

/* ---------- coordinate polygons (grade 6) ---------- */
/** How far apart two numbers on one axis are, explained through distances from 0. */
function axisGap(a: number, b: number, axis: "x" | "y") {
  const gap = Math.abs(a - b),
    side = axis === "x" ? "the $y$-axis" : "the $x$-axis";
  if (a === 0 || b === 0) {
    const other = a === 0 ? b : a;
    return {
      gap,
      text: `A coordinate of 0 lies on ${side}, so the distance is how far ${n(other)} is from 0: ${gap}.`,
      tag: "on-axis",
    };
  }
  if (a * b < 0)
    return {
      gap,
      text: `The coordinates ${n(a)} and ${n(b)} lie on opposite sides of ${side}, at distances ${Math.abs(a)} and ${Math.abs(b)} from it, so add: ${Math.abs(a)} + ${Math.abs(b)} = ${gap}.`,
      tag: "crosses-axis",
    };
  const far = Math.max(Math.abs(a), Math.abs(b)),
    near = Math.min(Math.abs(a), Math.abs(b));
  return {
    gap,
    text: `The coordinates ${n(a)} and ${n(b)} lie on the same side of ${side}, at distances ${Math.abs(a)} and ${Math.abs(b)} from it, so subtract: ${far} − ${near} = ${gap}.`,
    tag: "same-side",
  };
}
/** Two distinct values in [low, high] at least `min` apart, in increasing order. */
function span(r: Random, low: number, high: number, min: number, max: number) {
  for (;;) {
    const a = r(low, high),
      b = r(low, high);
    const d = Math.abs(a - b);
    if (d >= min && d <= max) return a < b ? [a, b] : [b, a];
  }
}
type Polygon = { name: string; labels: string; points: Point[] };
function polygon(r: Random): Polygon {
  const kind = r(0, 3);
  const [x1, x2] = span(r, -8, 8, 3, 14),
    [y2, y1] = span(r, -7, 7, 3, 12);
  if (kind === 0)
    return {
      name: "Rectangle",
      labels: "ABCD",
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
    };
  if (kind === 1)
    return {
      name: "Triangle",
      labels: "ABC",
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x1, y: y2 },
      ],
    };
  if (kind === 2) {
    let x3 = r(x1 + 1, x2 + 3);
    if (x3 === x2) x3 = x2 - 1;
    return {
      name: "Quadrilateral",
      labels: "ABCD",
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x3, y: y2 },
        { x: x1, y: y2 },
      ],
    };
  }
  const xm = r(x1 + 1, x2 - 1),
    ym = r(y2 + 1, y1 - 1);
  return {
    name: "Hexagon",
    labels: "ABCDEF",
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: ym },
      { x: xm, y: ym },
      { x: xm, y: y2 },
      { x: x1, y: y2 },
    ],
  };
}
function vertexList(p: Polygon) {
  return list(p.points.map((q, i) => named(p.labels[i]!, q)));
}
function sideCase(r: Random): Case {
  const p = polygon(r);
  const sides = p.points
    .map((a, i) => [i, (i + 1) % p.points.length] as const)
    .filter(([i, j]) => {
      const a = p.points[i]!,
        b = p.points[j]!;
      return a.x === b.x || a.y === b.y;
    });
  const [i, j] = pick(r, sides);
  const a = p.points[i]!,
    b = p.points[j]!,
    la = p.labels[i]!,
    lb = p.labels[j]!;
  const vertical = a.x === b.x;
  const shared = vertical ? a.x : a.y;
  const gap = vertical ? axisGap(a.y, b.y, "y") : axisGap(a.x, b.x, "x");
  return {
    prompt: `${p.name} $${p.labels}$ has vertices ${vertexList(p)}. What is the length of side $${la}${lb}$, in units?`,
    answer: String(gap.gap),
    explanation: [
      `${named(la, a)} and ${named(lb, b)} have the same $${vertical ? "x" : "y"}$-coordinate, ${n(shared)}, so side $${la}${lb}$ is ${vertical ? "vertical" : "horizontal"}. Its length is the distance between the $${vertical ? "y" : "x"}$-coordinates ${n(vertical ? a.y : a.x)} and ${n(vertical ? b.y : b.x)}.`,
      gap.text,
      `Side $${la}${lb}$ is ${units(gap.gap)} long.`,
    ],
    tags: [p.name.toLowerCase(), vertical ? "vertical" : "horizontal", gap.tag],
    figure: coordinateFigure([
      { role: "given", closed: true, vertices: labelled(p.labels, p.points) },
    ]),
  };
}
function rectangleCase(r: Random): Case {
  const [x1, x2] = span(r, -8, 8, 2, 12),
    [y2, y1] = span(r, -7, 7, 2, 10);
  const pts = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
  const rect: Polygon = { name: "Rectangle", labels: "ABCD", points: pts };
  const w = axisGap(x1, x2, "x"),
    h = axisGap(y1, y2, "y");
  const area = r(0, 1) === 1;
  const value = area ? w.gap * h.gap : 2 * (w.gap + h.gap);
  return {
    prompt: `Rectangle $ABCD$ has vertices ${vertexList(rect)}. What is its ${area ? "area, in square units" : "perimeter, in units"}?`,
    answer: String(value),
    explanation: [
      `Side $AB$ joins ${named("A", pts[0]!)} and ${named("B", pts[1]!)}, which share the $y$-coordinate ${n(y1)}, so it is horizontal. Its length is the distance between ${n(x1)} and ${n(x2)}. ${w.text}`,
      `Side $BC$ joins ${named("B", pts[1]!)} and ${named("C", pts[2]!)}, which share the $x$-coordinate ${n(x2)}, so it is vertical. Its length is the distance between ${n(y1)} and ${n(y2)}. ${h.text}`,
      area
        ? `The rectangle is ${w.gap} units wide and ${h.gap} units tall. Area = width × height = ${w.gap} × ${h.gap} = ${value} square units.`
        : `Opposite sides of a rectangle are equal, so the perimeter is ${w.gap} + ${h.gap} + ${w.gap} + ${h.gap} = 2 × (${w.gap} + ${h.gap}) = ${value} units.`,
    ],
    tags: [area ? "area" : "perimeter", w.tag, h.tag],
    figure: coordinateFigure([
      { role: "given", closed: true, vertices: labelled("ABCD", pts) },
    ]),
  };
}

/* ---------- distance (grade 8) ---------- */
/** [coefficient, radicand] with no square factor left under the root. */
function simplestRoot(value: number): [number, number] {
  let a = 1,
    b = value;
  for (let f = 2; f * f <= b; f++)
    while (b % (f * f) === 0) {
      b /= f * f;
      a *= f;
    }
  return [a, b];
}
const rootLabel = ([a, b]: [number, number]) =>
  b === 1 ? String(a) : `$${a === 1 ? "" : a}\\sqrt{${b}}$`;
const rootValue = (squared: number) => rootLabel(simplestRoot(squared));
function legs(a: Point, b: Point) {
  const dx = Math.abs(b.x - a.x),
    dy = Math.abs(b.y - a.y);
  return {
    dx,
    dy,
    text: `The horizontal leg is the change in $x$: ${n(Math.max(a.x, b.x))} − ${Math.min(a.x, b.x) < 0 ? `(${n(Math.min(a.x, b.x))})` : n(Math.min(a.x, b.x))} = ${dx}. The vertical leg is the change in $y$: ${n(Math.max(a.y, b.y))} − ${Math.min(a.y, b.y) < 0 ? `(${n(Math.min(a.y, b.y))})` : n(Math.min(a.y, b.y))} = ${dy}.`,
  };
}
const triples = [
  [3, 4],
  [6, 8],
  [9, 12],
  [12, 16],
  [5, 12],
  [8, 15],
  [12, 9],
  [4, 3],
  [8, 6],
  [12, 5],
  [15, 8],
  [16, 12],
] as const;
function placeSegment(r: Random, dx: number, dy: number, limit: number) {
  const sx = r(0, 1) ? 1 : -1,
    sy = r(0, 1) ? 1 : -1;
  const x1 = r(-limit, limit - dx),
    y1 = r(-limit, limit - dy);
  const a = { x: sx > 0 ? x1 : x1 + dx, y: y1 },
    b = { x: sx > 0 ? x1 + dx : x1, y: y1 + dy };
  return sy > 0 ? [a, b] : [b, a];
}
function distanceCase(r: Random): Case {
  const [dx, dy] = pick(r, triples);
  const [a, b] = placeSegment(r, dx, dy, 10);
  const c2 = dx * dx + dy * dy,
    c = Math.round(Math.sqrt(c2));
  const l = legs(a!, b!);
  return {
    prompt: `What is the distance between the points ${pt(a!)} and ${pt(b!)}?`,
    answer: String(c),
    explanation: [
      `Draw a right triangle with the segment as its hypotenuse and legs along the grid. ${l.text}`,
      `By the Pythagorean theorem, the distance squared is ${dx}² + ${dy}² = ${dx * dx} + ${dy * dy} = ${c2}.`,
      `The distance is $\\sqrt{${c2}}$ = ${c} units, because ${c} × ${c} = ${c2}.`,
    ],
    tags: [
      `hypotenuse-${c}`,
      Math.sign(a!.x) * Math.sign(b!.x) < 0 ||
      Math.sign(a!.y) * Math.sign(b!.y) < 0
        ? "crosses-axis"
        : "one-quadrant",
    ],
  };
}
function exactDistanceCase(r: Random, axes?: Record<string, string>): Case {
  const form = axes?.["answer-form"] ?? "exact";
  let dx: number, dy: number;
  do {
    dx = r(1, 9);
    dy = r(1, 9);
  } while (
    (dx === dy && r(0, 2) > 0) ||
    dx + dy < 3 ||
    (form !== "exact" && isPerfectSquare(dx * dx + dy * dy))
  );
  const [a, b] = placeSegment(r, dx, dy, 8) as [Point, Point];
  const c2 = dx * dx + dy * dy,
    root = simplestRoot(c2),
    correct = rootLabel(root);
  const l = legs(a, b);
  if (form !== "exact") {
    // The same distance as a decimal rounded to a stated place. The wrong
    // choices are the misconceptions of the exact form plus a wrong place.
    const places = form === "nearest-tenth" ? 1 : 2;
    const rounded = roundedRoot(c2, places, "$AB$");
    const wrongPlace = roundedRoot(c2, (places - 1) as 0 | 1, "$AB$");
    const unit = 10 ** places;
    const step = (sign: 1 | -1) =>
      exactDecimal(Math.round(Number(rounded.answer) * unit) + sign, unit);
    const candidates: [string, string][] = [
      [
        wrongPlace.answer,
        `That rounds to the nearest ${wrongPlace.unitWord}. The question asks for the nearest ${rounded.unitWord}.`,
      ],
      [
        String(dx + dy),
        `${dx} + ${dy} is the length of a path along the grid lines. The straight distance is the hypotenuse: its square is ${dx}² + ${dy}² = ${c2}.`,
      ],
      [
        String(c2),
        `${c2} is the distance squared. Take its square root to find the distance.`,
      ],
      [
        step(1),
        `That is one ${rounded.unitWord} too large. Check the digit after the place you round to.`,
      ],
      [
        step(-1),
        `That is one ${rounded.unitWord} too small. Check the digit after the place you round to.`,
      ],
    ];
    const distractors: [string, string][] = [];
    for (const candidate of candidates)
      if (
        candidate[0] !== rounded.answer &&
        !distractors.some((d) => d[0] === candidate[0]) &&
        distractors.length < 3
      )
        distractors.push(candidate);
    return {
      prompt: `Point $A$ is at ${pt(a)} and point $B$ is at ${pt(b)}. What is the distance AB, in units, to the nearest ${rounded.unitWord}?`,
      answer: rounded.answer,
      options: [rounded.answer, ...distractors.map((d) => d[0])],
      feedback: Object.fromEntries(distractors),
      label: "Distance (units)",
      explanation: [
        `Draw a right triangle with $AB$ as its hypotenuse and legs along the grid. ${l.text}`,
        `By the Pythagorean theorem, $AB^2 = ${dx}^2 + ${dy}^2 = ${dx * dx} + ${dy * dy} = ${c2}$, so $AB$ = $\\sqrt{${c2}}$.`,
        ...rounded.steps,
        `The distance is about ${rounded.answer} units.`,
      ],
      tags: [form, "crosses-axis"],
      figure: coordinateFigure([
        {
          role: "given",
          closed: false,
          vertices: [
            { ...a, label: "A" },
            { ...b, label: "B" },
          ],
        },
      ]),
    };
  }
  // Misconceptions in priority order; each is an exact value that differs from the answer.
  const signX = Math.abs(Math.abs(a.x) - Math.abs(b.x)),
    signY = Math.abs(Math.abs(a.y) - Math.abs(b.y));
  const candidates: [string, string][] = [];
  if (signX !== dx || signY !== dy)
    candidates.push([
      rootValue(signX * signX + signY * signY || 1),
      `That subtracts the coordinates as if they had the same sign. ${a.x * b.x < 0 ? `The $x$-coordinates ${n(a.x)} and ${n(b.x)} lie on opposite sides of 0, so the horizontal leg is ${dx}.` : `The $y$-coordinates ${n(a.y)} and ${n(b.y)} lie on opposite sides of 0, so the vertical leg is ${dy}.`}`,
    ]);
  candidates.push([
    String(dx + dy),
    `${dx} + ${dy} is the length of a path along the grid lines. The straight distance is the hypotenuse: its square is ${dx}² + ${dy}² = ${c2}.`,
  ]);
  if (root[0] > 1 && root[1] > 1)
    candidates.push([
      rootLabel([root[0] * root[0], root[1]]),
      `$\\sqrt{${c2}} = \\sqrt{${root[0] * root[0]}}\\sqrt{${root[1]}}$, and $\\sqrt{${root[0] * root[0]}} = ${root[0]}$, so the coefficient is ${root[0]}, not ${root[0] * root[0]}.`,
    ]);
  candidates.push([
    String(c2),
    `${c2} is the distance squared. Take its square root to find the distance.`,
  ]);
  if (dx !== dy)
    candidates.push([
      rootValue(Math.abs(dx * dx - dy * dy)),
      `The legs' squares are added, not subtracted: the hypotenuse squared is ${dx}² + ${dy}² = ${c2}.`,
    ]);
  candidates.push([
    rootValue(c2 + 1),
    `Recheck the legs ${dx} and ${dy}: the distance squared is ${dx * dx} + ${dy * dy} = ${c2}.`,
  ]);
  const distractors: [string, string][] = [];
  for (const candidate of candidates)
    if (
      candidate[0] !== correct &&
      !distractors.some((d) => d[0] === candidate[0]) &&
      distractors.length < 3
    )
      distractors.push(candidate);
  const simplify =
    root[1] === 1
      ? `$\\sqrt{${c2}}$ = ${root[0]}, because ${root[0]} × ${root[0]} = ${c2}.`
      : root[0] === 1
        ? `${c2} has no square factor greater than 1, so $\\sqrt{${c2}}$ is already in simplest form.`
        : `${c2} = ${root[0] * root[0]} × ${root[1]}, and ${root[0] * root[0]} is a perfect square, so $\\sqrt{${c2}} = \\sqrt{${root[0] * root[0]}} \\times \\sqrt{${root[1]}} = ${root[0]}\\sqrt{${root[1]}}$.`;
  return {
    prompt: `Point $A$ is at ${pt(a)} and point $B$ is at ${pt(b)}. What is the exact distance AB, in units?`,
    answer: correct,
    options: [correct, ...distractors.map((d) => d[0])],
    feedback: Object.fromEntries(distractors),
    explanation: [
      `Draw a right triangle with $AB$ as its hypotenuse and legs along the grid. ${l.text}`,
      `By the Pythagorean theorem, $AB^2 = ${dx}^2 + ${dy}^2 = ${dx * dx} + ${dy * dy} = ${c2}$, so $AB$ = $\\sqrt{${c2}}$.`,
      simplify,
      `The exact distance is ${correct} units.`,
    ],
    tags: [
      root[1] === 1 ? "whole" : root[0] === 1 ? "prime-root" : "simplify",
      signX !== dx || signY !== dy ? "crosses-axis" : "one-quadrant",
    ],
    figure: coordinateFigure([
      {
        role: "given",
        closed: false,
        vertices: [
          { ...a, label: "A" },
          { ...b, label: "B" },
        ],
      },
    ]),
  };
}

/* ---------- rigid motions (grade 8) ---------- */
const steps = (v: number, plus: string, minus: string) =>
  `${Math.abs(v)} ${Math.abs(v) === 1 ? "unit" : "units"} ${v > 0 ? plus : minus}`;
function translationWords(dx: number, dy: number) {
  return [
    ...(dx ? [steps(dx, "right", "left")] : []),
    ...(dy ? [steps(dy, "up", "down")] : []),
  ].join(" and ");
}
/** The motion as a verb phrase for "It is …" and as an option label. */
function motionPhrase(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `translated ${translationWords(m.dx, m.dy)}`;
    case "reflect":
      return `reflected over the $${m.axis}$-axis`;
    case "rotate":
      return m.degrees === 180
        ? "rotated 180° about the origin"
        : `rotated 90° ${m.degrees === 90 ? "counterclockwise" : "clockwise"} about the origin`;
    case "dilate":
      return `dilated with center at the origin and scale factor ${frac(m.numerator, m.denominator)}`;
  }
}
function motionName(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `A translation ${translationWords(m.dx, m.dy)}`;
    case "reflect":
      return `A reflection over the $${m.axis}$-axis`;
    case "rotate":
      return m.degrees === 180
        ? "A rotation of 180° about the origin"
        : `A rotation of 90° ${m.degrees === 90 ? "counterclockwise" : "clockwise"} about the origin`;
    case "dilate":
      return `A dilation with scale factor ${frac(m.numerator, m.denominator)}`;
  }
}
/** The coordinate rule, with a typographic minus. */
function motionRule(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `$(x, y) \\to (x ${m.dx < 0 ? "-" : "+"} ${Math.abs(m.dx)}, y ${m.dy < 0 ? "-" : "+"} ${Math.abs(m.dy)})$`;
    case "reflect":
      return m.axis === "x" ? "$(x, y) \\to (x, -y)$" : "$(x, y) \\to (-x, y)$";
    case "rotate":
      return m.degrees === 90
        ? "$(x, y) \\to (-y, x)$"
        : m.degrees === 180
          ? "$(x, y) \\to (-x, -y)$"
          : "$(x, y) \\to (y, -x)$";
    case "dilate":
      return `$(x, y) \\to (${fracTex(m.numerator, m.denominator)}x, ${fracTex(m.numerator, m.denominator)}y)$`;
  }
}
function motionReason(m: PlaneMotion) {
  switch (m.kind) {
    case "translate":
      return `A translation slides every point the same distance in the same direction: ${translationWords(m.dx, m.dy)} adds ${n(m.dx)} to each $x$-coordinate and ${n(m.dy)} to each $y$-coordinate.`;
    case "reflect":
      return m.axis === "x"
        ? "A reflection over the $x$-axis moves each point straight across the axis to the same distance on the other side. The $x$-coordinate stays the same and the $y$-coordinate changes sign."
        : "A reflection over the $y$-axis moves each point straight across the axis to the same distance on the other side. The $y$-coordinate stays the same and the $x$-coordinate changes sign.";
    case "rotate":
      return m.degrees === 180
        ? "A half turn about the origin carries each point to the opposite side of the origin at the same distance, so both coordinates change sign."
        : m.degrees === 90
          ? "A quarter turn counterclockwise about the origin carries a point 1 unit right of the origin to 1 unit above it, and a point 1 unit above it to 1 unit left of it. So the old $y$-coordinate, with its sign changed, becomes the new $x$-coordinate, and the old $x$-coordinate becomes the new $y$-coordinate."
          : "A quarter turn clockwise about the origin carries a point 1 unit above the origin to 1 unit right of it, and a point 1 unit right of it to 1 unit below it. So the old $y$-coordinate becomes the new $x$-coordinate, and the old $x$-coordinate, with its sign changed, becomes the new $y$-coordinate.";
    case "dilate":
      return `A dilation centered at the origin moves every point along the ray from the origin through it, multiplying its distance from the origin by ${frac(m.numerator, m.denominator)}. Both coordinates are multiplied by ${frac(m.numerator, m.denominator)}.`;
  }
}
const square = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
/** A scalene, non-degenerate lattice triangle off both axes. */
function triangle(r: Random, limit: number, step = 1): Point[] {
  for (;;) {
    const pts = Array.from({ length: 3 }, () => ({
      x: r(-limit, limit) * step,
      y: r(-limit, limit) * step,
    }));
    const [a, b, c] = pts as [Point, Point, Point];
    const area2 = Math.abs(
      (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y),
    );
    const sides = [square(a, b), square(b, c), square(c, a)];
    if (
      pts.every((p) => p.x !== 0 && p.y !== 0) &&
      area2 >= 8 * step * step &&
      // No sliver: every angle is at least 20°, so the triangle reads clearly.
      [0, 1, 2].every((i) => {
        const [x, y, z] = [sides[i]!, sides[(i + 1) % 3]!, sides[(i + 2) % 3]!];
        return (y + z - x) / (2 * Math.sqrt(y * z)) <= Math.cos(Math.PI / 9);
      }) &&
      new Set(sides).size === 3 &&
      Math.min(...sides) >= 4 * step * step
    )
      return pts;
  }
}
const motions: PlaneMotion[] = [
  { kind: "reflect", axis: "x" },
  { kind: "reflect", axis: "y" },
  { kind: "rotate", degrees: 90 },
  { kind: "rotate", degrees: 180 },
  { kind: "rotate", degrees: 270 },
];
function randomRigid(r: Random): PlaneMotion {
  const k = r(0, 5);
  if (k < 5) return motions[k]!;
  let dx: number, dy: number;
  do {
    dx = r(-6, 6);
    dy = r(-6, 6);
  } while (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy));
  return { kind: "translate", dx, dy };
}
/** Lower is a closer confusion: the other axis, the other direction of turn. */
function confusion(target: PlaneMotion, m: PlaneMotion) {
  if (target.kind === "reflect")
    return m.kind === "reflect"
      ? 0
      : m.kind === "rotate" && m.degrees === 180
        ? 1
        : 2;
  if (target.kind === "rotate" && target.degrees !== 180)
    return m.kind === "rotate" ? (m.degrees === 180 ? 1 : 0) : 2;
  return m.kind === "reflect" ? 0 : 1;
}
const inRange = (p: Point, limit: number) =>
  Math.abs(p.x) <= limit && Math.abs(p.y) <= limit;
const motionTag = (m: PlaneMotion) =>
  m.kind === "reflect"
    ? `reflect-${m.axis}`
    : m.kind === "rotate"
      ? `rotate-${m.degrees}`
      : m.kind;
function imageCase(r: Random): Case {
  for (;;) {
    const motion = randomRigid(r);
    const pts = triangle(r, 6);
    const images = pts.map((p) => applyMotion(motion, p));
    if (!images.every((p) => inRange(p, 10))) continue;
    const index = r(0, 2);
    const p = pts[index]!,
      q = images[index]!,
      label = "ABC"[index]!;
    if (Math.abs(p.x) === Math.abs(p.y)) continue;
    const correct = pt(q);
    const wrong: [Point, string][] =
      motion.kind === "translate"
        ? [
            [
              { x: p.x - motion.dx, y: p.y - motion.dy },
              "That moves the vertex in the opposite direction. Right and up add to the coordinates; left and down subtract.",
            ],
            [
              { x: p.x + motion.dy, y: p.y + motion.dx },
              "That applies the horizontal shift to $y$ and the vertical shift to $x$. Horizontal moves change $x$; vertical moves change $y$.",
            ],
            [
              { x: p.x + motion.dx, y: p.y - motion.dy },
              `That moves the vertex ${motion.dy > 0 ? "down" : "up"} instead of ${motion.dy > 0 ? "up" : "down"}.`,
            ],
            [
              { x: p.x - motion.dx, y: p.y + motion.dy },
              `That moves the vertex ${motion.dx > 0 ? "left" : "right"} instead of ${motion.dx > 0 ? "right" : "left"}.`,
            ],
          ]
        : [
            ...motions
              .filter((m) => JSON.stringify(m) !== JSON.stringify(motion))
              .sort((x, y) => confusion(motion, x) - confusion(motion, y))
              .map(
                (m) =>
                  [
                    applyMotion(m, p),
                    `That is the image under ${motionName(m).replace(/^A /, "a ")}: ${motionRule(m)}. ${motionName(motion)} uses ${motionRule(motion)}.`,
                  ] as [Point, string],
              ),
            [
              { x: p.y, y: p.x },
              `Swapping the coordinates reflects over the line y = x. ${motionName(motion)} uses ${motionRule(motion)}.`,
            ],
          ];
    const distractors: [string, string][] = [];
    for (const [point, why] of wrong) {
      const label = pt(point);
      if (
        label !== correct &&
        !distractors.some((d) => d[0] === label) &&
        distractors.length < 3
      )
        distractors.push([label, why]);
    }
    if (distractors.length < 3) continue;
    const prompt = `Triangle $ABC$ has vertices ${list(pts.map((v, i) => named("ABC"[i]!, v)))}. It is ${motionPhrase(motion)} to form triangle $A'B'C'$. What are the coordinates of ${primed(label)}?`;
    return {
      prompt,
      answer: correct,
      options: [correct, ...distractors.map((d) => d[0])],
      feedback: Object.fromEntries(distractors),
      explanation: [
        motionReason(motion),
        `The rule is ${motionRule(motion)}.`,
        `Apply it to ${named(label, p)}: ${primed(label)} is at ${correct}.`,
      ],
      tags: [motionTag(motion)],
      figure: coordinateFigure(
        [{ role: "given", closed: true, vertices: labelled("ABC", pts) }],
        { motion },
      ),
    };
  }
}
function sameMotion(m: PlaneMotion, from: Point[], to: Point[]) {
  return from.every((p, i) => pt(applyMotion(m, p)) === pt(to[i]!));
}
function identifyCase(r: Random): Case {
  for (;;) {
    const motion = randomRigid(r);
    const pts = triangle(r, 6);
    const images = pts.map((p) => applyMotion(motion, p));
    if (!images.every((p) => inRange(p, 10))) continue;
    const follow: PlaneMotion = {
      kind: "translate",
      dx: images[0]!.x - pts[0]!.x,
      dy: images[0]!.y - pts[0]!.y,
    };
    let pool: PlaneMotion[];
    if (motion.kind === "translate")
      pool = [
        { kind: "translate", dx: -motion.dx, dy: -motion.dy },
        { kind: "translate", dx: motion.dy, dy: motion.dx },
        pick(r, motions.slice(0, 2)),
        { kind: "rotate", degrees: 180 },
      ];
    else if (motion.kind === "reflect")
      pool = [
        { kind: "reflect", axis: motion.axis === "x" ? "y" : "x" },
        { kind: "rotate", degrees: 180 },
        follow,
        pick(
          r,
          motions
            .slice(2)
            .filter(
              (m) => JSON.stringify(m) !== '{"kind":"rotate","degrees":180}',
            ),
        ),
      ];
    else if (motion.kind === "rotate" && motion.degrees === 180)
      pool = [
        pick(r, motions.slice(0, 2)),
        follow,
        pick(r, [motions[2]!, motions[4]!]),
        motions[0]!,
        motions[1]!,
      ];
    else
      pool = [
        {
          kind: "rotate",
          degrees: motion.kind === "rotate" && motion.degrees === 90 ? 270 : 90,
        },
        { kind: "rotate", degrees: 180 },
        pick(r, motions.slice(0, 2)),
        follow,
      ];
    const correct = motionName(motion);
    const distractors: [string, string][] = [];
    for (const m of pool) {
      const label = motionName(m);
      if (
        (m.kind !== "translate" || m.dx !== 0 || m.dy !== 0) &&
        !sameMotion(m, pts, images) &&
        label !== correct &&
        !distractors.some((d) => d[0] === label) &&
        distractors.length < 3
      ) {
        const miss = pts.findIndex(
          (p, i) => pt(applyMotion(m, p)) !== pt(images[i]!),
        );
        const L = "ABC"[miss]!;
        distractors.push([
          label,
          `That motion sends ${named(L, pts[miss]!)} to ${pt(applyMotion(m, pts[miss]!))}, but ${primed(L)} is at ${pt(images[miss]!)}. Check every vertex, not only one.`,
        ]);
      }
    }
    if (distractors.length < 3) continue;
    const before = list(pts.map((v, i) => named("ABC"[i]!, v))),
      after = list(images.map((v, i) => named(prime("ABC"[i]!), v)));
    return {
      prompt: `Triangle $ABC$ has vertices ${before}. Triangle $A'B'C'$ has vertices ${after}. Which single transformation maps triangle $ABC$ onto triangle $A'B'C'$?`,
      answer: correct,
      options: [correct, ...distractors.map((d) => d[0])],
      feedback: Object.fromEntries(distractors),
      explanation: [
        `A rigid motion moves a figure without changing its size or shape: a slide (translation), a flip (reflection) or a turn (rotation). The image is the figure after the move.`,
        `Compare each vertex with its image: ${pts.map((p, i) => `${pt(p)} → ${pt(images[i]!)}`).join(", ")}.`,
        motion.kind === "translate"
          ? `Every $x$-coordinate changes by ${n(motion.dx)} and every $y$-coordinate changes by ${n(motion.dy)}, so each point slides the same distance in the same direction.`
          : `${motionReason(motion)} Every vertex follows this rule: ${motionRule(motion)}.`,
        `The transformation is ${correct.replace(/^A /, "a ")}.`,
      ],
      tags: [motionTag(motion)],
      figure: coordinateFigure([
        { role: "given", closed: true, vertices: labelled("ABC", pts) },
        {
          role: "image",
          closed: true,
          vertices: labelled("ABC", images).map((v) => ({
            ...v,
            label: prime(v.label),
          })),
        },
      ]),
    };
  }
}

/* ---------- dilations and similarity (grade 8) ---------- */
const factors: [number, number][] = [
  [2, 1],
  [3, 1],
  [1, 2],
  [1, 3],
  [3, 2],
  [2, 3],
];
function dilationTriangle(r: Random, k: [number, number]) {
  const [num, den] = k;
  // Multiples of the denominator keep every image on the lattice; both stay within 9.
  const pts = triangle(r, Math.floor(9 / Math.max(num, den)), den);
  const images = pts.map((p) => ({
    x: (p.x * num) / den,
    y: (p.y * num) / den,
  }));
  return { pts, images };
}
function dilationImageCase(r: Random): Case {
  for (;;) {
    const k = pick(r, factors),
      [num, den] = k,
      motion: PlaneMotion = {
        kind: "dilate",
        numerator: num,
        denominator: den,
      };
    const { pts, images } = dilationTriangle(r, k);
    const index = r(0, 2),
      p = pts[index]!,
      q = images[index]!,
      label = "ABC"[index]!;
    if (Math.abs(p.x) === Math.abs(p.y)) continue;
    const correct = pt(q),
      kText = frac(num, den);
    const wrong: [Point, string][] = [];
    if ((p.x * den) % num === 0 && (p.y * den) % num === 0)
      wrong.push([
        { x: (p.x * den) / num, y: (p.y * den) / num },
        `That divides by ${kText}. A dilation multiplies each coordinate by the scale factor.`,
      ]);
    if (den === 1)
      wrong.push([
        { x: p.x + num, y: p.y + num },
        `That adds ${num} to each coordinate. A dilation multiplies each coordinate by the scale factor; adding moves the figure without changing its size.`,
      ]);
    wrong.push(
      [
        { x: q.x, y: p.y },
        "Only the $x$-coordinate was multiplied. Multiply both coordinates by the scale factor.",
      ],
      [
        { x: p.x, y: q.y },
        "Only the $y$-coordinate was multiplied. Multiply both coordinates by the scale factor.",
      ],
      [
        { x: -q.x, y: -q.y },
        "The signs changed. A positive scale factor keeps each image on the same side of the origin as its point.",
      ],
    );
    const distractors: [string, string][] = [];
    for (const [point, why] of wrong) {
      const l = pt(point);
      if (
        l !== correct &&
        !distractors.some((d) => d[0] === l) &&
        distractors.length < 3
      )
        distractors.push([l, why]);
    }
    if (distractors.length < 3) continue;
    return {
      prompt: `Triangle $ABC$ has vertices ${list(pts.map((v, i) => named("ABC"[i]!, v)))}. It is ${motionPhrase(motion)} to form triangle $A'B'C'$. What are the coordinates of ${primed(label)}?`,
      answer: correct,
      options: [correct, ...distractors.map((d) => d[0])],
      feedback: Object.fromEntries(distractors),
      explanation: [
        motionReason(motion),
        `Multiply both coordinates of ${named(label, p)} by ${kText}. The new $x$-coordinate is ${n(p.x)} × ${kText} = ${n(q.x)}, and the new $y$-coordinate is ${n(p.y)} × ${kText} = ${n(q.y)}.`,
        `${primed(label)} is at ${correct}.`,
      ],
      tags: [
        num > den ? "enlarge" : "reduce",
        den === 1 ? "whole-factor" : "fraction-factor",
      ],
      figure: coordinateFigure(
        [{ role: "given", closed: true, vertices: labelled("ABC", pts) }],
        { motion },
      ),
    };
  }
}
function scaleFactorCase(r: Random): Case {
  const k = pick(r, factors),
    [num, den] = k;
  const { pts, images } = dilationTriangle(r, k);
  const kText = frac(num, den);
  const i = pts.findIndex((p) => p.x !== 0);
  const p = pts[i]!,
    q = images[i]!,
    L = "ABC"[i]!;
  const j = (i + 1) % 3,
    p2 = pts[j]!,
    q2 = images[j]!,
    L2 = "ABC"[j]!;
  return {
    prompt: `A dilation with center at the origin maps triangle $ABC$ onto triangle $A'B'C'$. Triangle $ABC$ has vertices ${list(pts.map((v, idx) => named("ABC"[idx]!, v)))}, and triangle $A'B'C'$ has vertices ${list(images.map((v, idx) => named(prime("ABC"[idx]!), v)))}. What is the scale factor?`,
    answer: answerFraction(num, den),
    explanation: [
      "A dilation centered at the origin multiplies both coordinates of every point by the same scale factor $k$.",
      `${named(L, p)} maps to ${named(prime(L), q)}, so k = ${n(q.x)} ÷ ${p.x < 0 ? `(${n(p.x)})` : p.x} = ${kText}.`,
      `Check with $${L2}$. Multiplying its coordinates gives ${n(p2.x)} × ${kText} = ${n(q2.x)} and ${n(p2.y)} × ${kText} = ${n(q2.y)}, which match ${named(prime(L2), q2)}.`,
      num > den
        ? `The scale factor is ${kText}. It is greater than 1, so the image is an enlargement.`
        : `The scale factor is ${kText}. It is less than 1, so the image is a reduction.`,
    ],
    tags: [
      num > den ? "enlarge" : "reduce",
      den === 1 ? "whole-factor" : "fraction-factor",
    ],
    figure: coordinateFigure(
      [
        { role: "given", closed: true, vertices: labelled("ABC", pts) },
        {
          role: "image",
          closed: true,
          vertices: labelled("ABC", images).map((v) => ({
            ...v,
            label: prime(v.label),
          })),
        },
      ],
      { rays: true },
    ),
  };
}

const unitWords = {
  cm: ["centimeters", "square centimeters"],
  m: ["meters", "square meters"],
  in: ["inches", "square inches"],
  ft: ["feet", "square feet"],
} as const;
/** The angle at each vertex, from the law of cosines, rejects slivers. */
function wellShaped(a: number, b: number, c: number) {
  if (a + b <= c || b + c <= a || c + a <= b) return false;
  const angle = (opp: number, s: number, t: number) =>
    (Math.acos((s * s + t * t - opp * opp) / (2 * s * t)) * 180) / Math.PI;
  const angles = [angle(a, b, c), angle(b, c, a), angle(c, a, b)];
  return Math.min(...angles) >= 25 && Math.max(...angles) <= 120;
}
const similarRatios: [number, number][] = [
  [3, 2],
  [2, 1],
  [5, 2],
  [3, 1],
  [1, 2],
  [2, 3],
  [4, 3],
  [3, 4],
];
const triangleNames = [
  ["ABC", "DEF"],
  ["PQR", "STU"],
  ["JKL", "MNP"],
  ["ABC", "XYZ"],
] as const;
function similarCase(r: Random): Case {
  for (;;) {
    const [p, qd] = pick(r, similarRatios);
    const sides = [r(3, 15), r(3, 15), r(3, 15)];
    if (new Set(sides).size < 3 || !wellShaped(sides[0]!, sides[1]!, sides[2]!))
      continue;
    const known = r(0, 2);
    let asked = r(0, 1);
    asked = asked >= known ? asked + 1 : asked;
    if ((sides[known]! * p) % qd !== 0) continue;
    const answerNum = sides[asked]! * p;
    if (qd === 3 && answerNum % 3 !== 0) continue;
    const unit = pick(r, ["cm", "m", "in", "ft"] as const);
    const [first, second] = pick(r, triangleNames);
    const sideName = (t: string, i: number) => `${t[i]}${t[(i + 1) % 3]}`;
    const knownImage = (sides[known]! * p) / qd;
    const askedValue = decimal(answerNum, qd);
    const secondSides: SimilarTrianglesFigure["triangles"][number]["sides"] = [
      null,
      null,
      null,
    ];
    secondSides[known] = knownImage;
    secondSides[asked] = "?";
    const correspond = list(
      [0, 1, 2].map((i) => `${sideName(first, i)} ↔ ${sideName(second, i)}`),
    );
    const k = frac(p, qd);
    const given = [0, 1, 2]
      .map((i) => `${sideName(first, i)} = ${sides[i]}`)
      .concat(`${sideName(second, known)} = ${knownImage}`);
    return {
      prompt: `Triangle $${first}$ is similar to triangle $${second}$, with ${list([...first].map((v, i) => `$${v}$ corresponding to $${second[i]}$`))}. In ${unitWords[unit][0]}, ${list(given)}. What is ${sideName(second, asked)}, in ${unitWords[unit][0]}?`,
      answer: askedValue,
      explanation: [
        `Similar triangles have the same shape: matching angles are equal, and every side is multiplied by the same number, the scale factor.`,
        `Corresponding sides join corresponding vertices: ${correspond}.`,
        `The known pair ${sideName(first, known)} and ${sideName(second, known)} gives the scale factor from ${first} to $${second}$: ${knownImage} ÷ ${sides[known]} = ${k}.`,
        `Every side of $${second}$ is ${k} times its corresponding side of $${first}$, so $${sideName(second, asked)} = ${sideName(first, asked)} × ${k} = ${sides[asked]} × ${k} = ${askedValue}$.`,
        `${sideName(second, asked)} is ${askedValue} ${unitWords[unit][0]}.`,
      ],
      tags: [
        p > qd ? "larger" : "smaller",
        qd === 1 ? "whole-factor" : "fraction-factor",
        `known-${known}`,
      ],
      figure: {
        kind: "similar-triangles",
        unit,
        triangles: [
          {
            vertices: [first[0]!, first[1]!, first[2]!],
            sides: [sides[0]!, sides[1]!, sides[2]!],
          },
          {
            vertices: [second[0]!, second[1]!, second[2]!],
            sides: secondSides,
          },
        ],
      },
    };
  }
}

/* ---------- scale drawings (grade 7) ---------- */
const scales = [
  { drawing: [1, "cm"], actual: [5, "km"], what: "map" },
  { drawing: [1, "cm"], actual: [20, "km"], what: "map" },
  { drawing: [1, "cm"], actual: [2, "m"], what: "floor plan" },
  { drawing: [2, "cm"], actual: [5, "m"], what: "floor plan" },
  { drawing: [1, "in"], actual: [4, "ft"], what: "floor plan" },
  { drawing: [1, "in"], actual: [6, "ft"], what: "garden plan" },
  { drawing: [1, "cm"], actual: [3, "m"], what: "garden plan" },
] as const;
const longUnit: Record<string, [string, string, string]> = {
  cm: ["centimeter", "centimeters", "square centimeters"],
  in: ["inch", "inches", "square inches"],
  m: ["meter", "meters", "square meters"],
  ft: ["foot", "feet", "square feet"],
  km: ["kilometer", "kilometers", "square kilometers"],
};
/** What a length or a region on each kind of drawing is. */
const subjects = {
  map: { length: "two towns", region: "a park" },
  "floor plan": { length: "a wall", region: "a room" },
  "garden plan": { length: "a path", region: "a flower bed" },
} as const;
const half = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
function scaleCase(r: Random): Case {
  const s = pick(r, scales);
  const [d, du] = s.drawing,
    [a, au] = s.actual;
  const [one, many, squared] = longUnit[du]!,
    [, actualMany, actualSquared] = longUnit[au]!;
  const scaleText = `${d} ${d === 1 ? one : many} represents ${a} ${actualMany}`;
  const k = frac(a, d),
    back = frac(d, a),
    sub = subjects[s.what],
    map = s.what === "map";
  const mode = r(0, 3);
  if (mode === 0) {
    // Drawing length → actual length; drawing lengths are whole or half units.
    const halves = r(3, 24);
    const drawn = halves / 2;
    const actual = decimal(halves * a, 2 * d);
    return {
      prompt: map
        ? `On a map, ${scaleText}. Two towns are ${half(drawn)} ${many} apart on the map. What is the actual distance between them, in ${actualMany}?`
        : `On a ${s.what}, ${scaleText}. ${sub.length[0]!.toUpperCase()}${sub.length.slice(1)} is ${half(drawn)} ${many} long on the plan. What is its actual length, in ${actualMany}?`,
      answer: actual,
      explanation: [
        `The scale says ${scaleText}, so each ${one} on the ${s.what} stands for ${k} ${actualMany}. Multiply the length on the ${s.what} by ${k}.`,
        `Actual length = ${half(drawn)} × ${k} = ${actual}.`,
        `The actual ${map ? "distance" : "length"} is ${actual} ${actualMany}.`,
      ],
      tags: ["to-actual", map ? "map" : "plan"],
    };
  }
  if (mode === 1) {
    // Actual length → drawing length, a whole or half unit on the drawing.
    let halves: number, actual: number;
    do {
      halves = r(3, 24);
      actual = (halves * a) / (2 * d);
    } while (!Number.isInteger(actual));
    const drawn = decimal(halves, 2);
    return {
      prompt: map
        ? `On a map, ${scaleText}. Two towns are ${actual} ${actualMany} apart. How far apart are they on the map, in ${many}?`
        : `On a ${s.what}, ${scaleText}. ${sub.length[0]!.toUpperCase()}${sub.length.slice(1)} is actually ${actual} ${actualMany} long. How long is it on the plan, in ${many}?`,
      answer: drawn,
      explanation: [
        `The scale says ${scaleText}. Going from an actual length back to the ${s.what}, divide by ${k}, which is the same as multiplying by ${back}.`,
        `Length on the ${s.what} = ${actual} × ${back} = ${drawn}.`,
        `On the ${s.what}, the length is ${drawn} ${many}.`,
      ],
      tags: ["to-drawing", map ? "map" : "plan"],
    };
  }
  if (mode === 2) {
    // A rectangle on the drawing → actual area.
    // With a 2-unit scale, whole-unit sides keep every area a whole number of quarters.
    const w2 = r(4, 16) * (d === 2 ? 2 : 1),
      h2 = r(4, 12) * (d === 2 ? 2 : 1);
    const area = decimal(w2 * h2 * a * a, 4 * d * d);
    const plan = decimal(w2 * h2, 4);
    const aw = decimal(w2 * a, 2 * d),
      ah = decimal(h2 * a, 2 * d);
    const region = sub.region.replace(/^a /, "");
    return {
      prompt: `On a ${s.what}, ${scaleText}. A rectangular ${region} is ${half(w2 / 2)} ${many} by ${half(h2 / 2)} ${many} on the ${map ? "map" : "plan"}. What is its actual area, in ${actualSquared}?`,
      answer: area,
      explanation: [
        `Convert each side with the scale by multiplying by ${k}: ${half(w2 / 2)} × ${k} = ${aw} and ${half(h2 / 2)} × ${k} = ${ah}. The ${region} is ${aw} ${actualMany} by ${ah} ${actualMany}.`,
        `Actual area = ${aw} × ${ah} = ${area} ${actualSquared}.`,
        `Check: the area on the ${map ? "map" : "plan"} is ${half(w2 / 2)} × ${half(h2 / 2)} = ${plan} ${squared}. Area grows by the square of the scale: ${plan} × ${k} × ${k} = ${area}.`,
      ],
      tags: ["area", "rectangle", map ? "map" : "plan"],
    };
  }
  // An area on the drawing → actual area: multiply by the square of the scale.
  const drawnArea = r(3, 30) * d * d;
  const k2 = frac(a * a, d * d);
  const area = decimal(drawnArea * a * a, d * d);
  const region = `${sub.region[0]!.toUpperCase()}${sub.region.slice(1)}`;
  return {
    prompt: `On a ${s.what}, ${scaleText}. ${region} covers ${drawnArea} ${squared} on the ${map ? "map" : "plan"}. What is its actual area, in ${actualSquared}?`,
    answer: area,
    explanation: [
      `A square 1 ${one} on each side on the ${s.what} is ${k} ${actualMany} on each side in reality, so its actual area is ${k} × ${k} = ${k2} ${actualSquared}.`,
      `Each square ${one} of the ${s.what} stands for ${k2} ${actualSquared}, so multiply the area by the square of the scale, not by the scale.`,
      `Actual area = ${drawnArea} × ${k2} = ${area} ${actualSquared}.`,
    ],
    tags: ["area", "drawing-area", map ? "map" : "plan"],
  };
}

const builders: Record<
  string,
  (r: Random, axes?: Record<string, string>) => Case
> = {
  "coordinate-side-length": sideCase,
  "coordinate-rectangle-measure": rectangleCase,
  "coordinate-distance": distanceCase,
  "coordinate-distance-exact": exactDistanceCase,
  "transformation-image": imageCase,
  "identify-rigid-motion": identifyCase,
  "dilation-image": dilationImageCase,
  "dilation-scale-factor": scaleFactorCase,
  "similar-triangles-side": similarCase,
  "scale-drawing": scaleCase,
};
const labels: Record<string, string> = {
  "coordinate-side-length": "Side length (units)",
  "coordinate-rectangle-measure": "Measure",
  "coordinate-distance": "Distance (units)",
  "coordinate-distance-exact": "Exact distance",
  "transformation-image": "Image coordinates",
  "identify-rigid-motion": "Transformation",
  "dilation-image": "Image coordinates",
  "dilation-scale-factor": "Scale factor",
  "similar-triangles-side": "Side length",
  "scale-drawing": "Length or area",
};

/** `axes` selects the answer form of the exact-distance family. Printed
 * worksheets omit it and keep the exact distances. */
export function transformationPrintCase(
  id: string,
  seed: string,
  axes?: SweepAxes<"coordinate-distance-exact">,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = transformationTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown transformation template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const c = builders[id]!(r, axes);
  let response: GeneratedProblem["public"]["response"];
  let answer = c.answer;
  let choiceFeedback: Record<string, string> | undefined;
  if (c.options) {
    const options = shuffle(c.options, r).map((label, i) => ({
      id: `option-${"abcd"[i]}`,
      label,
    }));
    answer = options.find((o) => o.label === c.answer)!.id;
    response = { kind: "choice", label: c.label ?? labels[id]!, options };
    choiceFeedback = Object.fromEntries(
      options
        .filter((o) => o.id !== answer)
        .map((o) => [o.id, c.feedback![o.label]!]),
    );
  } else
    response = {
      kind:
        id === "dilation-scale-factor" || id === "similar-triangles-side"
          ? "fraction"
          : "number",
      label: labels[id]!,
    };
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
      response,
      ...(c.figure ? { figure: c.figure } : {}),
    },
    answer,
    explanation: c.explanation,
    hint: instanceHint(id, c, !c.options),
    ...(choiceFeedback ? { choiceFeedback } : {}),
    ...(axes ? { variant: sweepVariant(axes["answer-form"], axes) } : {}),
  };
  // The prompt states every given, so equal prompts are the same case.
  return { problem, tags: c.tags, caseKey: c.prompt };
}
/** The first explanation step that works from this problem's stated numbers
 * without stating the answer; a template's own first move otherwise. */
function instanceHint(id: string, c: Case, numeric: boolean): string {
  const values = (text: string): string[] =>
    text.replaceAll("−", "-").match(/(?<![\w.\/])-?\d+(?:\.\d+)?(?:\/\d+)?/g) ??
    [];
  const given = new Set(values(c.prompt));
  if (id === "transformation-image") {
    const vertex = /coordinates of \$([A-Z])'\$/.exec(c.prompt)![1]!;
    const at = new RegExp(`${vertex}\\(([^)]*)\\)`).exec(c.prompt)![0];
    return `${c.explanation[0]} Apply that to $${at}$.`;
  }
  if (id === "dilation-scale-factor") {
    const at = (v: string) =>
      `$${new RegExp(`${v.replace("′", "'")}\\([^)]*\\)`).exec(c.prompt)![0]}$`;
    return `${at("A")} maps to ${at("A′")} and ${at("B")} maps to ${at("B′")}. Divide an image coordinate by the matching original coordinate.`;
  }
  for (const step of c.explanation) {
    const named = values(step);
    if (
      named.some((v) => given.has(v)) &&
      !(numeric && named.includes(c.answer) && !given.has(c.answer))
    )
      return step;
  }
  return hints[id]!;
}
export const generateTransformationProblem = (
  id: string,
  seed: string,
): GeneratedProblem =>
  transformationPrintCase(
    id,
    seed,
    id === "coordinate-distance-exact"
      ? sweepChoose("coordinate-distance-exact", seed)
      : undefined,
  ).problem;
