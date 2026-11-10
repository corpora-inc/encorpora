import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import type { FigureFraction, LengthUnit } from "./area-volume-figures";
import {
  multiPartChoiceResponseSchema,
  serializeMultiPart,
  type MultiPartChoiceResponse,
  type PartOption,
} from "./multi-part-choice";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkGrading,
} from "./structured-work";
import { generatingVersion } from "./variation/axes";

/** Clause families added at this version. A reprint below it runs the
 * generator that shipped at version 1, on the same content stream. */
const CLAUSE_SINCE = 2;
const clauseHostIds = new Set([
  "triangle-area-base-height",
  "polygon-area-decompose",
  "fraction-edge-volume",
  "composite-area",
  "composite-face-prism-surface-area",
]);

/** Area, surface area and volume (grades 6–8): triangles and polygons by
 * decomposition, nets, fractional edges, composite figures and curved solids. */
const areaVolumeCore: readonly TemplateMetadata[] = (
  [
    [
      "triangle-area-base-height",
      "Triangle area",
      "triangle-area",
      "Find a triangle's area from its base and the perpendicular height to that base.",
    ],
    [
      "polygon-area-decompose",
      "Area by decomposition",
      "triangle-area",
      "Find the area of a parallelogram, trapezoid or pentagon by splitting it into rectangles and triangles.",
    ],
    [
      "net-surface-area",
      "Surface area from a net",
      "surface-area",
      "Add the areas of the faces in the net of a rectangular prism, triangular prism or square pyramid.",
    ],
    [
      "unit-fraction-cube-packing",
      "Pack a prism with fraction cubes",
      "fractional-prism-volume",
      "Count the small cubes with unit-fraction edges that fill a rectangular prism and find its volume.",
    ],
    [
      "fraction-edge-volume",
      "Volume with fractional edges",
      "fractional-prism-volume",
      "Find a rectangular prism's volume, or a missing edge, when the edge lengths are fractions.",
    ],
    [
      "composite-area",
      "Area of composite figures",
      "composite-measurement",
      "Find the area of a figure built from rectangles and triangles, recovering any unlabeled sides.",
    ],
    [
      "composite-face-prism-volume",
      "Volume of a composite prism",
      "composite-measurement",
      "Find the volume of a right prism whose front face is an L-, T- or U-shaped polygon.",
    ],
    [
      "composite-face-prism-surface-area",
      "Surface area of a composite prism",
      "composite-measurement",
      "Find the surface area of a right prism whose front face is an L-, T- or U-shaped polygon.",
    ],
    [
      "cylinder-volume",
      "Cylinder volume",
      "curved-solid-volume",
      "Find a cylinder's volume as a multiple of $\\pi$ or with $\\pi$ given, or find its height from its volume.",
    ],
    [
      "cone-sphere-volume",
      "Cone and sphere volume",
      "curved-solid-volume",
      "Find the volume of a cone, sphere or hemisphere as a multiple of $\\pi$ or with $\\pi$ given.",
    ],
  ] as const
).map(([id, title, skillId, description]) => ({
  id,
  title,
  skillId,
  description,
  version: clauseHostIds.has(id) ? 2 : 1,
  ...(clauseHostIds.has(id) ? { reprintsFrom: 1 as const } : {}),
  gradeBand: "6–8" as const,
}));

const clauseTemplates: readonly TemplateMetadata[] = [
  {
    id: "polygon-show-the-pieces",
    title: "Area of the pieces",
    skillId: "triangle-area",
    description:
      "Choose the area of each piece when a trapezoid, parallelogram, or right triangle is split or doubled into rectangles and triangles.",
    version: 2,
    reprintsFrom: 1,
    gradeBand: "6–8",
    requiredResponseCapability: "multi-part-choice-v1",
    glossaryNoLink: ["base", "bases", "side", "part", "parts", "whole", "square"],
  },
  {
    id: "polygon-which-expression",
    title: "Which area expression",
    skillId: "triangle-area",
    description:
      "Choose the expression that adds a trapezoid's middle rectangle and its two end triangles.",
    version: 1,
    gradeBand: "6–8",
    requiredResponseCapability: "single-choice-v1",
    glossaryNoLink: ["base", "bases", "side", "part", "whole", "square"],
  },
  {
    id: "count-then-size-then-check",
    title: "Count, size, then check",
    skillId: "fractional-prism-volume",
    description:
      "Count the unit-fraction cubes along each edge of a box, then find the volume from that count and again from the edge lengths.",
    version: 1,
    gradeBand: "6–8",
    requiredResponseCapability: "structured-work-v1",
    glossarySenses: { solid: "solid-shape", cube: "cube", edge: "edge" },
    glossaryNoLink: ["whole", "count"],
  },
  {
    id: "net-name-the-solid",
    title: "Name the solid from its net",
    skillId: "surface-area",
    description:
      "Name the solid a net of rectangles and triangles folds into: cube, rectangular prism, triangular prism, or square pyramid.",
    version: 1,
    gradeBand: "6–8",
    requiredResponseCapability: "single-choice-v1",
    glossarySenses: {
      net: "net-solid",
      face: "face-solid",
      solid: "solid-shape",
      base: "base-shape",
      square: "square-shape",
      edge: "edge",
    },
    glossaryNoLink: ["opposite", "change"],
  },
];

export const areaVolumeTemplates: readonly TemplateMetadata[] = [
  ...areaVolumeCore,
  ...clauseTemplates,
];

type Random = (low: number, high: number) => number;
type Q = { n: number; d: number };
type Case = {
  prompt: string;
  answer: Q;
  explanation: string[];
  hint: string;
  figure?: SemanticFigure;
  tags: string[];
  kind: "number" | "fraction";
  label: string;
};

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
function q(n: number, d = 1): Q {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d === 0)
    throw new Error("Expected exact rational arithmetic");
  if (d < 0) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
}
const mul = (...xs: Q[]) => xs.reduce((a, b) => q(a.n * b.n, a.d * b.d), q(1));
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const add = (...xs: Q[]) =>
  xs.reduce((a, b) => q(a.n * b.d + b.n * a.d, a.d * b.d), q(0));
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const num = (a: Q) => a.n / a.d;
/** Integer or terminating decimal for prose; other values as a/b. */
function plain(a: Q): string {
  let d = a.d,
    places = 0;
  while (d % 10 === 0) [d, places] = [d / 10, places + 1];
  while (d % 2 === 0 || d % 5 === 0) {
    d = d % 2 === 0 ? d / 2 : d / 5;
    places++;
  }
  if (d !== 1) return `${a.n}/${a.d}`;
  const text = (a.n / a.d).toFixed(places);
  return places ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
}
/** TeX: whole numbers, proper fractions and mixed numbers. */
function mixed(a: Q): string {
  if (a.d === 1) return String(a.n);
  const whole = Math.floor(a.n / a.d),
    rest = a.n - whole * a.d;
  return `${whole ? whole : ""}\\tfrac{${rest}}{${a.d}}`;
}
/** TeX fraction without a whole part, for arithmetic. */
const frac = (a: Q) => (a.d === 1 ? String(a.n) : `\\tfrac{${a.n}}{${a.d}}`);
const answerText = (a: Q) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
/** TeX power with grouping for a fraction base. */
const power = (a: Q, k: number) =>
  a.d === 1 ? `${a.n}^${k}` : `\\left(${frac(a)}\\right)^${k}`;
const asFigure = (a: Q): FigureFraction => {
  if (![1, 2, 3, 4].includes(a.d)) throw new Error("Unsupported figure edge");
  return { n: a.n, d: a.d as FigureFraction["d"] };
};
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
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

const unitWords: Record<LengthUnit, [string, string]> = {
  cm: ["centimeter", "centimeters"],
  m: ["meter", "meters"],
  in: ["inch", "inches"],
  ft: ["foot", "feet"],
};
const units = Object.keys(unitWords) as LengthUnit[];
/** A length in prose, with the unit agreeing with the value. */
const len = (v: Q | number, u: LengthUnit, tex = false) => {
  const value = typeof v === "number" ? q(v) : v;
  const word = unitWords[u][num(value) <= 1 ? 0 : 1];
  return `${tex ? `$${mixed(value)}$` : plain(value)} ${word}`;
};
const square = (u: LengthUnit) => `square ${unitWords[u][1]}`;
const cubic = (u: LengthUnit) => `cubic ${unitWords[u][1]}`;
/** The unit word agreeing with a value: “1/2 foot”, “3 feet”. */
const word = (v: Q, u: LengthUnit) => unitWords[u][num(v) <= 1 ? 0 : 1];
/** A volume in prose with a mixed-number value. */
const cubicText = (v: Q, u: LengthUnit) => `$${mixed(v)}$ cubic ${word(v, u)}`;
const list = (items: string[]) =>
  items.length < 3
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const times = (xs: (number | string)[]) => xs.join(" × ");

/** Horizontal legs l with l² + h² a perfect square, keyed by the height h. */
const hypotenuse = (a: number, b: number) => {
  const c = Math.round(Math.hypot(a, b));
  return c * c === a * a + b * b ? c : null;
};
const legsFor = (h: number, max = 20) =>
  Array.from({ length: max }, (_, i) => i + 1).filter(
    (l) => hypotenuse(l, h) !== null,
  );
const tripleHeights = [3, 4, 5, 6, 8, 9, 12, 15];

// ---------------------------------------------------------------- triangles
function triangleCase(r: Random): Case {
  const u = pick(r, units);
  const shape = pick(r, ["acute", "right", "obtuse"] as const);
  const showSides = r(0, 2) > 0;
  let b: number, h: number, x: number;
  let sides: (number | null)[];
  if (shape === "acute") {
    if (showSides) {
      // Heights with a leg shorter than themselves admit an acute apex.
      h = pick(
        r,
        tripleHeights.filter((t) => legsFor(t).some((l) => l < t)),
      );
      const legs = legsFor(h).filter((l) => l <= 16);
      // Every angle acute: the apex angle is acute exactly when l1 × l2 < h².
      let l1: number, l2: number;
      do [l1, l2] = [pick(r, legs), pick(r, legs)];
      while (l1 * l2 >= h * h);
      [b, x] = [l1 + l2, l1];
      sides = [b, hypotenuse(l2, h), hypotenuse(l1, h)];
    } else {
      // Every angle acute: the foot of the height splits the base into x and
      // b − x with x(b − x) < h², so the apex angle is acute too.
      do {
        b = r(4, 18);
        h = r(3, 14);
        x = r(1, b - 1);
      } while (x * (b - x) >= h * h);
      sides = [b, null, null];
    }
  } else if (shape === "right") {
    if (showSides) {
      h = pick(r, tripleHeights);
      b = pick(
        r,
        legsFor(h).filter((l) => l <= 16),
      );
    } else {
      b = r(3, 16);
      h = r(3, 14);
    }
    x = r(0, 1) ? 0 : b;
    const slant = showSides ? hypotenuse(b, h) : null;
    sides = x === 0 ? [b, slant, h] : [b, h, slant];
  } else {
    let over: number;
    if (showSides) {
      h = pick(r, [8, 12, 15]);
      const legs = legsFor(h);
      let l1: number, l2: number;
      do [l1, l2] = [pick(r, legs), pick(r, legs)];
      while (l1 <= l2);
      [b, over] = [l1 - l2, l2];
    } else {
      b = r(4, 16);
      h = r(3, 12);
      over = r(1, Math.min(6, b));
    }
    const left = r(0, 1) === 1;
    x = left ? -over : b + over;
    const near = showSides ? hypotenuse(over, h) : null,
      far = showSides ? hypotenuse(b + over, h) : null;
    sides = left ? [b, far, near] : [b, near, far];
  }
  const vertices: [number, number][] = [
    [0, 0],
    [b, 0],
    [x, h],
  ];
  const area = q(b * h, 2);
  const isRight = shape === "right";
  const figure: SemanticFigure = {
    kind: "measured-polygon",
    unit: u,
    vertices,
    sides,
    heights: isRight ? [] : [{ from: [x, h], to: [x, 0], value: h }],
    guides:
      shape === "obtuse" ? [{ from: [x, 0], to: [x < 0 ? 0 : b, 0] }] : [],
    rightAngles: isRight ? [x === 0 ? 0 : 1] : [],
  };
  const unused = sides
    .slice(1)
    .filter((s): s is number => s !== null && s !== h);
  const explanation = [
    isRight
      ? `The sides of ${len(b, u)} and ${len(h, u)} meet at a right angle, so each is perpendicular to the other. Use ${b} as the base and ${h} as the height.`
      : shape === "obtuse"
        ? `The base is the bottom side, ${len(b, u)}. The height is the dashed segment from the top vertex, perpendicular to the line of the base. It lands outside the triangle, on the extended base: ${len(h, u)}.`
        : `The base is the bottom side, ${len(b, u)}. The height is the dashed segment from the top vertex, perpendicular to the base: ${len(h, u)}.`,
  ];
  if (unused.length)
    explanation.push(
      isRight
        ? `The ${len(unused[0]!, u)} side is opposite the right angle. It is not perpendicular to the base, so it is not used.`
        : `The slanted ${unused.length === 1 ? "side" : "sides"}, ${list(unused.map((s) => len(s, u)))}, ${unused.length === 1 ? "is" : "are"} not perpendicular to the base, so ${unused.length === 1 ? "it is" : "they are"} not used.`,
    );
  explanation.push(
    `A copy of the triangle, turned halfway around, fits against it to make a ${isRight ? "rectangle" : "parallelogram"} with the same base and height. Its area is base × height: ${b} × ${h} = ${b * h} ${square(u)}.`,
    `The triangle is half of that ${isRight ? "rectangle" : "parallelogram"}: ${b * h} ÷ 2 = ${plain(area)}. The area is ${plain(area)} ${square(u)}.`,
  );
  return {
    prompt: `The figure shows a triangle with lengths in ${unitWords[u][1]}. What is the area of the triangle, in ${square(u)}?`,
    answer: area,
    explanation,
    hint: isRight
      ? `Two sides meet at a right angle: use them as the base and the height. A triangle is half of the rectangle they make: area = 1/2 × base × height.`
      : `The base is the bottom side, ${len(b, u)}. The height is the dashed segment perpendicular to it, not a slanted side. A triangle is half of a parallelogram with the same base and height.`,
    figure,
    tags: [
      shape,
      showSides ? "extra-sides" : "base-height-only",
      area.d === 1 ? "whole-area" : "half-area",
    ],
    kind: "number",
    label: `Area (${square(u)})`,
  };
}

// --------------------------------------------- parallelograms, trapezoids …
const slantPairs: [number, number][] = [
  [3, 4],
  [4, 3],
  [6, 8],
  [8, 6],
  [5, 12],
  [9, 12],
  [12, 9],
  [8, 15],
];
function polygonCase(r: Random): Case {
  const u = pick(r, units);
  const shape = pick(r, [
    "parallelogram",
    "trapezoid",
    "right-trapezoid",
    "pentagon",
  ] as const);
  const A = square(u);
  if (shape === "parallelogram") {
    const labelled = r(0, 1) === 1;
    const [s, h] = labelled
      ? pick(
          r,
          slantPairs.filter(([a, b]) => a <= 9 && b <= 12),
        )
      : [r(1, 5), r(3, 10)];
    const b = r(Math.max(4, s + 1), 14);
    const slant = labelled ? hypotenuse(s, h) : null;
    const area = q(b * h);
    return {
      prompt: `The figure is a parallelogram with lengths in ${unitWords[u][1]}. What is its area, in ${A}?`,
      answer: area,
      explanation: [
        `The base is ${len(b, u)}. The dashed height, ${len(h, u)}, is perpendicular to the base.${slant ? ` The slanted side, ${len(slant, u)}, is not perpendicular to the base, so it is not used.` : ""}`,
        `Cut along the dashed height. Slide the right triangle on the left to the right end; the slanted sides match because opposite sides of a parallelogram are equal and parallel.`,
        `The pieces form a rectangle ${len(b, u)} long and ${len(h, u)} tall, with the same area as the parallelogram: ${b} × ${h} = ${b * h}. The area is ${b * h} ${A}.`,
      ],
      hint: "Cut off the triangle at one end along the height and move it to the other end. The parallelogram becomes a rectangle with the same base and height.",
      figure: {
        kind: "measured-polygon",
        unit: u,
        vertices: [
          [0, 0],
          [b, 0],
          [b + s, h],
          [s, h],
        ],
        sides: [b, null, null, slant],
        heights: [{ from: [s, h], to: [s, 0], value: h }],
        guides: [],
        rightAngles: [],
      },
      tags: [shape, labelled ? "extra-sides" : "base-height-only"],
      kind: "number",
      label: `Area (${A})`,
    };
  }
  if (shape === "trapezoid" || shape === "right-trapezoid") {
    const right = shape === "right-trapezoid";
    const h = r(3, 10),
      a = r(6, 16);
    const p = right ? 0 : r(1, Math.max(1, Math.floor(a / 3)));
    const c = r(2, a - p - (right ? 1 : 1));
    const bottom = q(a * h, 2),
      top = q(c * h, 2),
      area = add(bottom, top);
    const vertices: [number, number][] = [
      [0, 0],
      [a, 0],
      [p + c, h],
      [p, h],
    ];
    return {
      prompt: `The figure is a trapezoid: its top and bottom sides are parallel. Lengths are in ${unitWords[u][1]}. What is its area, in ${A}?`,
      answer: area,
      explanation: [
        `The parallel sides are ${len(a, u)} and ${len(c, u)}. The distance between them, measured perpendicular to both, is the height: ${len(h, u)}.`,
        `Draw a diagonal from the bottom left corner to the top right corner. It splits the trapezoid into two triangles, and each has height ${h} because the parallel sides stay ${h} apart.`,
        `The bottom triangle has base ${a}: 1/2 × ${a} × ${h} = ${plain(bottom)}. The top triangle has base ${c}: 1/2 × ${c} × ${h} = ${plain(top)}.`,
        `Add the two triangles: ${plain(bottom)} + ${plain(top)} = ${plain(area)}. The area is ${plain(area)} ${A}.`,
      ],
      hint: "Split the trapezoid along a diagonal into two triangles. Both have the trapezoid's height; their bases are the two parallel sides.",
      figure: {
        kind: "measured-polygon",
        unit: u,
        vertices,
        sides: [a, null, c, right ? h : null],
        heights: right ? [] : [{ from: [p, h], to: [p, 0], value: h }],
        guides: [],
        rightAngles: right ? [0, 3] : [],
      },
      tags: [shape, area.d === 1 ? "whole-area" : "half-area"],
      kind: "number",
      label: `Area (${A})`,
    };
  }
  // A pentagon: a rectangle with a triangle on top, peak over the middle.
  const w = r(2, 7) * 2,
    wall = r(2, 8),
    roof = r(2, 7);
  const total = r(0, 1) === 1;
  const rect = w * wall,
    tri = q(w * roof, 2),
    area = add(q(rect), tri);
  return {
    prompt: `The pentagon has right angles at its two bottom corners, and its top vertex is centered above the bottom side. Lengths are in ${unitWords[u][1]}. What is its area, in ${A}?`,
    answer: area,
    explanation: [
      `Draw a horizontal line between the two upper side corners. It splits the pentagon into a rectangle ${len(w, u)} wide and ${len(wall, u)} tall, and a triangle on top.`,
      total
        ? `The dashed height, ${len(wall + roof, u)}, runs from the bottom to the top vertex. The rectangle uses ${wall} of it, so the triangle's height is ${wall + roof} − ${wall} = ${roof}.`
        : `The triangle's base is the line just drawn, ${len(w, u)}, and its height is the dashed segment, ${len(roof, u)}.`,
      `Rectangle: ${w} × ${wall} = ${rect}. Triangle: 1/2 × ${w} × ${roof} = ${plain(tri)}.`,
      `Add the parts: ${rect} + ${plain(tri)} = ${plain(area)}. The area is ${plain(area)} ${A}.`,
    ],
    hint: "Split the pentagon into a rectangle and a triangle. Find each area and add.",
    figure: {
      kind: "measured-polygon",
      unit: u,
      vertices: [
        [0, 0],
        [w, 0],
        [w, wall],
        [w / 2, wall + roof],
        [0, wall],
      ],
      sides: [w, wall, null, null, wall],
      heights: [
        {
          from: [w / 2, wall + roof],
          to: [w / 2, total ? 0 : wall],
          value: total ? wall + roof : roof,
        },
      ],
      guides: total ? [] : [{ from: [0, wall], to: [w, wall] }],
      rightAngles: [0, 1],
    },
    tags: [shape, total ? "total-height" : "roof-height"],
    kind: "number",
    label: `Area (${A})`,
  };
}

// --------------------------------------------------------------------- nets
const triangleShapes = (r: Random) => {
  // [base, height, left side, right side], built from right triangles.
  const kind = pick(r, ["right", "isosceles", "scalene"] as const);
  if (kind === "right") {
    const [a, b] = pick(r, [
      [4, 3],
      [3, 4],
      [8, 6],
      [6, 8],
      [12, 5],
      [5, 12],
    ] as const);
    return { kind, base: a, height: b, sides: [b, hypotenuse(a, b)!] };
  }
  if (kind === "isosceles") {
    const [a, b] = pick(r, [
      [3, 4],
      [4, 3],
      [6, 8],
      [8, 6],
      [5, 12],
    ] as const);
    const c = hypotenuse(a, b)!;
    return { kind, base: 2 * a, height: b, sides: [c, c] };
  }
  const [h, l1, l2] = pick(r, [
    [12, 5, 9],
    [12, 9, 5],
    [12, 5, 16],
    [8, 6, 15],
  ] as const);
  return {
    kind,
    base: l1 + l2,
    height: h,
    sides: [hypotenuse(l1, h)!, hypotenuse(l2, h)!],
  };
};
function netCase(r: Random): Case {
  const u = pick(r, units);
  const solid = pick(r, [
    "rectangular-prism",
    "triangular-prism",
    "square-pyramid",
  ] as const);
  const A = square(u);
  if (solid === "rectangular-prism") {
    let l: number, w: number, h: number;
    // Keep the box recognizable: no edge more than three times another.
    do [l, w, h] = [r(2, 12), r(2, 9), r(2, 9)];
    while ((l === w && w === h) || Math.max(l, w, h) > 3 * Math.min(l, w, h));
    const pairs = [l * w, l * h, w * h];
    const total = 2 * (pairs[0]! + pairs[1]! + pairs[2]!);
    return {
      prompt: `The net folds into a rectangular prism. Lengths are in ${unitWords[u][1]}. What is the surface area of the prism, in ${A}?`,
      answer: q(total),
      explanation: [
        `Surface area is the total area of all the faces. The net shows the prism's six rectangular faces, in three matching pairs.`,
        `Top and bottom: ${l} × ${w} = ${pairs[0]} each. Front and back: ${l} × ${h} = ${pairs[1]} each. The two ends: ${w} × ${h} = ${pairs[2]} each.`,
        `Add every face, counting each pair twice: 2 × ${pairs[0]} + 2 × ${pairs[1]} + 2 × ${pairs[2]} = ${2 * pairs[0]!} + ${2 * pairs[1]!} + ${2 * pairs[2]!} = ${total}.`,
        `The surface area is ${total} ${A}.`,
      ],
      hint: "Find the area of each rectangle in the net and add them. Opposite faces of a rectangular prism match, so there are three pairs.",
      figure: {
        kind: "rectangular-prism-net",
        unit: u,
        length: l,
        width: w,
        height: h,
      },
      tags: [
        solid,
        l === w || w === h || l === h ? "square-faces" : "all-different",
      ],
      kind: "number",
      label: `Surface area (${A})`,
    };
  }
  if (solid === "triangular-prism") {
    const t = triangleShapes(r),
      L = r(3, 14);
    const tri = q(t.base * t.height, 2);
    const rects = [t.base * L, t.sides[0]! * L, t.sides[1]! * L];
    const total = add(mul(q(2), tri), q(rects[0]! + rects[1]! + rects[2]!));
    return {
      prompt: `The net folds into a triangular prism. Lengths are in ${unitWords[u][1]}. What is the surface area of the prism, in ${A}?`,
      answer: total,
      explanation: [
        `The net has two triangles, the prism's ends, and three rectangles. Surface area is their total area.`,
        `Each triangle has base ${t.base} and height ${t.height}: 1/2 × ${t.base} × ${t.height} = ${plain(tri)}. The two triangles: 2 × ${plain(tri)} = ${plain(mul(q(2), tri))}.`,
        `Every rectangle is ${L} long, and its width is one side of the triangle: ${t.base} × ${L} = ${rects[0]}, ${t.sides[0]} × ${L} = ${rects[1]} and ${t.sides[1]} × ${L} = ${rects[2]}.`,
        `Add all five faces: ${plain(mul(q(2), tri))} + ${rects[0]} + ${rects[1]} + ${rects[2]} = ${plain(total)}. The surface area is ${plain(total)} ${A}.`,
      ],
      hint: "Add two triangles and three rectangles. Each rectangle's width is one side of the triangle, and its length is the prism's length.",
      figure: {
        kind: "triangular-prism-net",
        unit: u,
        base: t.base,
        height: t.height,
        sides: [t.sides[0]!, t.sides[1]!],
        length: L,
      },
      tags: [solid, `${t.kind}-triangle`],
      kind: "number",
      label: `Surface area (${A})`,
    };
  }
  const s = r(2, 12),
    slant = r(Math.floor(s / 2) + 1, Math.min(15, 2 * s));
  const face = q(s * slant, 2),
    total = add(q(s * s), mul(q(4), face));
  return {
    prompt: `The net folds into a pyramid with a square base. Lengths are in ${unitWords[u][1]}. What is the surface area of the pyramid, in ${A}?`,
    answer: total,
    explanation: [
      `The net has one square, the base, and four matching triangles that meet at the top. Surface area is their total area.`,
      `Square base: ${s} × ${s} = ${s * s}.`,
      `Each triangle has base ${s} and height ${slant}, the dashed segment: 1/2 × ${s} × ${slant} = ${plain(face)}. Four triangles: 4 × ${plain(face)} = ${plain(mul(q(4), face))}.`,
      `Add the faces: ${s * s} + ${plain(mul(q(4), face))} = ${plain(total)}. The surface area is ${plain(total)} ${A}.`,
    ],
    hint: "Add the square base and the four triangles. Each triangle's height is the dashed segment, measured on the face.",
    figure: { kind: "square-pyramid-net", unit: u, side: s, slant },
    tags: [solid, face.d === 1 ? "whole-faces" : "half-faces"],
    kind: "number",
    label: `Surface area (${A})`,
  };
}

// -------------------------------------------------------- fractional edges
const cubeEdges = [q(1, 2), q(1, 2), q(1, 2), q(1, 3), q(1, 4)];
function packingCase(r: Random): Case {
  const u = pick(r, units);
  const e = pick(r, cubeEdges);
  const most = e.d === 2 ? 7 : e.d === 3 ? 6 : 8;
  let counts: number[];
  do counts = [r(2, most), r(2, most - 2), r(2, most - 2)];
  while (counts.every((c) => c % e.d === 0));
  const edges = counts.map((c) => mul(q(c), e));
  const total = counts[0]! * counts[1]! * counts[2]!;
  const small = mul(e, e, e),
    volume = mul(q(total), small);
  const asksVolume = r(0, 1) === 1;
  const names = ["long", "wide", "tall"];
  const dims = list(edges.map((x, i) => `${len(x, u, true)} ${names[i]}`));
  const intro = `A rectangular prism is ${dims}. It is packed with cubes that have edges of ${len(e, u, true)}, as shown.`;
  const along = edges.map(
    (x, i) =>
      `$${mixed(x)} \\div ${frac(e)} = ${counts[i]}$ cubes fit along the ${["length", "width", "height"][i]}`,
  );
  const explanation = [
    `Volume is how many unit cubes fill a solid. First count how many small cubes fit along each edge: divide the edge by ${len(e, u, true)}.`,
    ...along.map((a) => `${a[0]!.toUpperCase()}${a.slice(1)}.`),
    `The cubes form ${counts[2]} ${counts[2] === 1 ? "layer" : "layers"} of ${counts[0]} × ${counts[1]} = ${counts[0]! * counts[1]!} cubes: ${times(counts)} = ${total} cubes.`,
  ];
  if (asksVolume)
    explanation.push(
      `One small cube has volume $${frac(e)} \\times ${frac(e)} \\times ${frac(e)} = ${frac(small)}$ cubic ${unitWords[u][0]}.`,
      `The prism's volume is the number of cubes times the volume of one: $${total} \\times ${frac(small)} = ${frac(volume)}$.`,
      `Check with length × width × height: $${edges.map(frac).join(" \\times ")} = ${frac(volume)}$. The volume is ${cubicText(volume, u)}.`,
    );
  else
    explanation.push(
      `Exactly ${total} cubes with edges of ${len(e, u, true)} fill the prism.`,
    );
  return {
    prompt: asksVolume
      ? `${intro} What is the volume of the prism, in ${cubic(u)}?`
      : `${intro} How many of these cubes fill the prism?`,
    answer: asksVolume ? volume : q(total),
    explanation,
    hint: asksVolume
      ? `Count the cubes along each edge and multiply to find how many fill the prism. Then multiply by the volume of one cube, 1/${e.d} × 1/${e.d} × 1/${e.d} = 1/${e.d ** 3}.`
      : `Divide each edge length by the cube's edge, ${len(e, u, true)}, to count the cubes along it, then multiply the three counts.`,
    figure: {
      kind: "fraction-box-prism",
      unit: u,
      length: asFigure(edges[0]!),
      width: asFigure(edges[1]!),
      height: asFigure(edges[2]!),
      cubeEdge: asFigure(e),
    },
    tags: [
      asksVolume ? "volume" : "count",
      `edge-1/${e.d}`,
      volume.d === 1 ? "whole-volume" : "fraction-volume",
    ],
    kind: asksVolume ? "fraction" : "number",
    label: asksVolume ? `Volume (${cubic(u)})` : "Number of cubes",
  };
}

const edgeChoices = (r: Random) => {
  const d = pick(r, [2, 2, 3, 4, 4]);
  return q(r(1, 6 * d), d);
};
function fractionVolumeCase(r: Random): Case {
  const u = pick(r, ["ft", "in", "m", "cm"] as LengthUnit[]);
  let edges: Q[];
  do edges = [edgeChoices(r), edgeChoices(r), edgeChoices(r)];
  while (
    edges.filter((x) => x.d > 1).length < 2 ||
    edges.some((x) => num(x) < 1 / 2)
  );
  const volume = mul(...edges);
  const thing = pick(r, [
    "A box",
    "A block of wood",
    "A planter box",
    "A rectangular prism",
  ]);
  const missing = r(0, 1) === 0 ? null : r(0, 2);
  const names = ["long", "wide", "tall"];
  const product = edges.map(frac).join(" \\times ");
  const fractions = edges
    .filter((x) => x.d > 1 && x.n > x.d)
    .map((x) => `$${mixed(x)} = ${frac(x)}$`);
  if (missing === null) {
    const raw = edges.reduce((a, x) => a * x.n, 1),
      rawD = edges.reduce((a, x) => a * x.d, 1);
    return {
      prompt: `${thing} is ${list(edges.map((x, i) => `${len(x, u, true)} ${names[i]}`))}. What is its volume, in ${cubic(u)}?`,
      answer: volume,
      explanation: [
        ...(fractions.length
          ? [`Write each mixed number as a fraction: ${list(fractions)}.`]
          : []),
        `Volume = length × width × height. Multiply the numerators and the denominators: $${product} = \\tfrac{${raw}}{${rawD}}${raw === volume.n && rawD === volume.d ? "" : ` = ${frac(volume)}`}$.`,
        `The volume is ${cubicText(volume, u)}.`,
      ],
      hint: `Multiply the three edges, ${list(edges.map((x) => len(x, u, true)))}. Write each mixed number as a fraction, multiply the numerators and the denominators, then simplify.`,
      figure: {
        kind: "fraction-box-prism",
        unit: u,
        length: asFigure(edges[0]!),
        width: asFigure(edges[1]!),
        height: asFigure(edges[2]!),
        cubeEdge: null,
      },
      tags: ["volume", volume.d === 1 ? "whole-volume" : "fraction-volume"],
      kind: "fraction",
      label: `Volume (${cubic(u)})`,
    };
  }
  const known = [0, 1, 2].filter((i) => i !== missing);
  const base = mul(edges[known[0]!]!, edges[known[1]!]!);
  const ask = ["long", "wide", "tall"][missing]!;
  const askName = ["length", "width", "height"][missing]!;
  const answer = edges[missing]!;
  return {
    prompt: `${thing} has a volume of ${cubicText(volume, u)}. It is ${list(known.map((i) => `${len(edges[i]!, u, true)} ${names[i]}`))}. How ${ask} is it, in ${unitWords[u][1]}?`,
    answer,
    explanation: [
      `Volume = length × width × height, so the missing ${askName} is the volume divided by the product of the other two edges.`,
      `Product of the known edges: $${frac(edges[known[0]!]!)} \\times ${frac(edges[known[1]!]!)} = ${frac(base)}$.`,
      `Divide by multiplying by the reciprocal: $${frac(volume)} \\div ${frac(base)} = ${frac(volume)} \\times ${frac(q(base.d, base.n))} = ${frac(answer)}$.`,
      `Check: $${product} = ${frac(volume)}$. The ${askName} is ${len(answer, u, true)}.`,
    ],
    hint: `The volume is length times width times height. Multiply the two known edges, ${known.map((i) => len(edges[i]!, u, true)).join(" and ")}, then divide the volume, ${cubicText(volume, u)}, by that product.`,
    figure: {
      kind: "fraction-box-prism",
      unit: u,
      length: missing === 0 ? null : asFigure(edges[0]!),
      width: missing === 1 ? null : asFigure(edges[1]!),
      height: missing === 2 ? null : asFigure(edges[2]!),
      cubeEdge: null,
    },
    tags: ["missing-edge", `missing-${askName}`],
    kind: "fraction",
    label: `${askName[0]!.toUpperCase()}${askName.slice(1)} (${unitWords[u][1]})`,
  };
}

// ------------------------------------------------------- composite figures
type Shape = {
  name: "L" | "T" | "U";
  face: [number, number][];
  /** Area as rectangles, each [label, width, height]. */
  parts: [string, number, number][];
  /** Edges that may be left unlabeled, each with how to recover it. */
  recover: { edge: number; text: string }[][];
};
function rectilinear(r: Random, allow: Shape["name"][]): Shape {
  const name = pick(r, allow);
  if (name === "L") {
    const W = r(6, 14),
      H = r(5, 12),
      a = r(2, W - 2),
      b = r(2, H - 2);
    const face: [number, number][] = [
      [0, 0],
      [W, 0],
      [W, H - b],
      [W - a, H - b],
      [W - a, H],
      [0, H],
    ];
    return {
      name,
      face,
      parts: [
        ["lower rectangle", W, H - b],
        ["upper rectangle", W - a, b],
      ],
      recover: [
        [
          {
            edge: 0,
            text: `the bottom side equals the top side plus the inner horizontal edge: ${W - a} + ${a} = ${W}`,
          },
          {
            edge: 2,
            text: `the inner horizontal edge is the bottom side minus the top side: ${W} − ${W - a} = ${a}`,
          },
          {
            edge: 4,
            text: `the top side is the bottom side minus the inner horizontal edge: ${W} − ${a} = ${W - a}`,
          },
        ],
        [
          {
            edge: 1,
            text: `the right side is the left side minus the inner vertical edge: ${H} − ${b} = ${H - b}`,
          },
          {
            edge: 3,
            text: `the inner vertical edge is the left side minus the right side: ${H} − ${H - b} = ${b}`,
          },
          {
            edge: 5,
            text: `the left side equals the right side plus the inner vertical edge: ${H - b} + ${b} = ${H}`,
          },
        ],
      ],
    };
  }
  if (name === "T") {
    const W = r(8, 15),
      t = r(2, 4),
      H = r(t + 3, 12),
      s = r(2, W - 4),
      p = r(2, W - s - 2);
    const qd = W - p - s;
    return {
      name,
      face: [
        [p, 0],
        [p + s, 0],
        [p + s, H - t],
        [W, H - t],
        [W, H],
        [0, H],
        [0, H - t],
        [p, H - t],
      ],
      parts: [
        ["bar", W, t],
        ["stem", s, H - t],
      ],
      recover: [
        [
          {
            edge: 4,
            text: `the top equals the three widths below it: ${p} + ${s} + ${qd} = ${W}`,
          },
          {
            edge: 2,
            text: `the bar's right underside is the top minus the other two widths: ${W} − ${p} − ${s} = ${qd}`,
          },
          {
            edge: 6,
            text: `the bar's left underside is the top minus the other two widths: ${W} − ${s} − ${qd} = ${p}`,
          },
        ],
        [
          {
            edge: 1,
            text: `the stem's right side is the left side's full height minus the bar's right end: ${t} + ${H - t} − ${t} = ${H - t}`,
          },
          {
            edge: 3,
            text: `the bar's right end is the left side's full height minus the stem's right side: ${t} + ${H - t} − ${H - t} = ${t}`,
          },
        ],
      ],
    };
  }
  const W = r(7, 15),
    H = r(5, 12),
    a = r(3, W - 4),
    b = r(2, H - 2),
    p = r(2, W - a - 2);
  const qd = W - p - a;
  return {
    name,
    face: [
      [0, 0],
      [W, 0],
      [W, H],
      [p + a, H],
      [p + a, H - b],
      [p, H - b],
      [p, H],
      [0, H],
    ],
    parts: [
      ["base", W, H - b],
      ["left post", p, b],
      ["right post", qd, b],
    ],
    recover: [
      [
        {
          edge: 0,
          text: `the bottom equals the three widths across the top: ${p} + ${a} + ${qd} = ${W}`,
        },
        {
          edge: 2,
          text: `the right post's top is the bottom minus the other two widths: ${W} − ${p} − ${a} = ${qd}`,
        },
        {
          edge: 4,
          text: `the notch's width is the bottom minus the two posts: ${W} − ${p} − ${qd} = ${a}`,
        },
      ],
      [{ edge: 3, text: `the notch's right side equals its left side, ${b}` }],
    ],
  };
}
/** Hide one horizontal and one vertical edge, each recoverable from the others. */
function labels(r: Random, shape: Shape, solid = false) {
  const sides: (number | null)[] = shape.face.map((p, i) => {
    const qd = shape.face[(i + 1) % shape.face.length]!;
    return Math.abs(qd[0] - p[0]) + Math.abs(qd[1] - p[1]);
  });
  const hidden = solid
    ? // On a prism only silhouette edges carry labels; inner edges are derived.
      shape.recover
        .flat()
        .filter((h) => (shape.name === "L" ? [2, 3] : [1, 2]).includes(h.edge))
    : shape.name === "U"
      ? // Inside the notch only its left wall is labeled, so labels never crowd.
        shape.recover.flat().filter((h) => h.edge === 3 || h.edge === 4)
      : shape.recover.slice(0, 1 + r(0, 1)).map((group) => pick(r, group));
  for (const h of hidden) sides[h.edge] = null;
  return { sides, hidden };
}
const describe = { L: "L-shaped", T: "T-shaped", U: "U-shaped" } as const;
const area = (shape: Shape) =>
  shape.parts.reduce((s, [, w, h]) => s + w * h, 0);
const perimeter = (shape: Shape) =>
  shape.face.reduce((s, p, i) => {
    const qd = shape.face[(i + 1) % shape.face.length]!;
    return s + Math.abs(qd[0] - p[0]) + Math.abs(qd[1] - p[1]);
  }, 0);
const partsText = (shape: Shape) =>
  shape.parts.map(([name, w, h]) => `${name} ${w} × ${h} = ${w * h}`);

function compositeAreaCase(r: Random): Case {
  const u = pick(r, units);
  const A = square(u);
  if (r(0, 3) === 0) {
    // A rectangle with one corner cut off by a straight line.
    const W = r(6, 14),
      H = r(5, 12),
      a = r(2, W - 2),
      b = r(2, H - 2);
    const tri = q(a * b, 2),
      total = sub(q(W * H), tri);
    return {
      prompt: `The figure is a rectangle with its top right corner cut off by a straight line. Its other corners are right angles. Lengths are in ${unitWords[u][1]}. What is its area, in ${A}?`,
      answer: total,
      explanation: [
        `Complete the rectangle: it is ${len(W, u)} wide and ${len(H, u)} tall, with area ${W} × ${H} = ${W * H}.`,
        `The missing corner is a right triangle. Its legs are ${W} − ${W - a} = ${a} across the top and ${H} − ${H - b} = ${b} down the right side.`,
        `The triangle's area is 1/2 × ${a} × ${b} = ${plain(tri)}. Subtract it: ${W * H} − ${plain(tri)} = ${plain(total)}. The area is ${plain(total)} ${A}.`,
      ],
      hint: "Find the area of the whole rectangle, then subtract the right triangle that was cut off. Its legs are the differences between opposite sides.",
      figure: {
        kind: "measured-polygon",
        unit: u,
        vertices: [
          [0, 0],
          [W, 0],
          [W, H - b],
          [W - a, H],
          [0, H],
        ],
        sides: [W, H - b, null, W - a, H],
        heights: [],
        guides: [
          { from: [W - a, H], to: [W, H] },
          { from: [W, H], to: [W, H - b] },
        ],
        rightAngles: [0, 1, 4],
      },
      tags: ["cut-corner", total.d === 1 ? "whole-area" : "half-area"],
      kind: "number",
      label: `Area (${A})`,
    };
  }
  const shape = rectilinear(r, ["L", "T", "U"]);
  const { sides, hidden } = labels(r, shape);
  const total = area(shape);
  const explanation = [
    `Area is how many unit squares cover a shape. The sides meet only at square corners, some turning in and some turning out, so opposite sides line up and missing sides can be found.`,
    ...hidden.map((h) => `${h.text[0]!.toUpperCase()}${h.text.slice(1)}.`),
    `Split the figure into rectangles: ${list(partsText(shape))}.`,
    `Add the rectangles: ${shape.parts.map(([, w, h]) => w * h).join(" + ")} = ${total}. The area is ${total} ${A}.`,
  ];
  if (shape.name === "U") {
    const [, W, low] = shape.parts[0]!,
      b = shape.parts[1]![2],
      notch = W - shape.parts[1]![1] - shape.parts[2]![1];
    explanation.splice(
      2,
      0,
      `Check by subtracting the notch from the whole rectangle: ${W} × ${low + b} − ${notch} × ${b} = ${W * (low + b)} − ${notch * b} = ${total}.`,
    );
  }
  return {
    prompt: `All angles in the ${describe[shape.name]} figure are right angles. Lengths are in ${unitWords[u][1]}. What is its area, in ${A}?`,
    answer: q(total),
    explanation,
    hint: "Find any unlabeled sides from the opposite sides, then split the figure into rectangles and add their areas.",
    figure: {
      kind: "measured-polygon",
      unit: u,
      vertices: shape.face,
      sides,
      heights: [],
      guides: [],
      rightAngles: [],
    },
    tags: [
      `${shape.name}-shape`,
      hidden.length === 2 ? "two-hidden" : "one-hidden",
    ],
    kind: "number",
    label: `Area (${A})`,
  };
}

function compositePrismCase(r: Random, surface: boolean): Case {
  const u = pick(r, units);
  const shape = rectilinear(r, ["L", "T"]);
  const { sides, hidden } = labels(r, shape, true);
  const depth = r(2, 10);
  const face = area(shape),
    around = perimeter(shape);
  const edges = shape.face.map((p, i) => {
    const qd = shape.face[(i + 1) % shape.face.length]!;
    return Math.abs(qd[0] - p[0]) + Math.abs(qd[1] - p[1]);
  });
  const findSides = `The edges of the front face meet only at square corners, some turning in and some turning out, so opposite edges line up. ${hidden.map((h) => `${h.text[0]!.toUpperCase()}${h.text.slice(1)}.`).join(" ")}`;
  const faceStep = `Split the front face into rectangles: ${list(partsText(shape))}. Its area is ${shape.parts.map(([, w, h]) => w * h).join(" + ")} = ${face}.`;
  const intro = `A right prism has the ${describe[shape.name]} front face shown and is ${len(depth, u)} deep. All angles are right angles. Lengths are in ${unitWords[u][1]}.`;
  if (!surface)
    return {
      prompt: `${intro} What is the volume of the prism, in ${cubic(u)}?`,
      answer: q(face * depth),
      explanation: [
        findSides,
        faceStep,
        `Each layer 1 ${unitWords[u][0]} deep holds ${face} unit cubes, and there are ${depth} layers: ${face} × ${depth} = ${face * depth}.`,
        `The volume is ${face * depth} ${cubic(u)}.`,
      ],
      hint: `Volume of a right prism = area of the front face × depth, ${len(depth, u)}. Split the face into rectangles to find its area.`,
      figure: {
        kind: "extruded-polygon",
        unit: u,
        face: shape.face,
        sides,
        depth,
      },
      tags: [`${shape.name}-shape`, "volume"],
      kind: "number",
      label: `Volume (${cubic(u)})`,
    };
  const total = 2 * face + around * depth;
  return {
    prompt: `${intro} What is the surface area of the prism, in ${square(u)}?`,
    answer: q(total),
    explanation: [
      findSides,
      faceStep,
      `The front and back faces match: 2 × ${face} = ${2 * face}.`,
      `Every other face is a rectangle ${depth} deep, one for each edge of the front face. Their widths add up to the perimeter, ${edges.join(" + ")} = ${around}, so together they cover ${around} × ${depth} = ${around * depth}.`,
      `Add all the faces: ${2 * face} + ${around * depth} = ${total}. The surface area is ${total} ${square(u)}.`,
    ],
    hint: `Surface area = 2 × (front face area) + perimeter of the front face × depth, ${len(depth, u)}. The side faces unroll into one rectangle as long as the perimeter.`,
    figure: {
      kind: "extruded-polygon",
      unit: u,
      face: shape.face,
      sides,
      depth,
    },
    tags: [`${shape.name}-shape`, "surface-area"],
    kind: "number",
    label: `Surface area (${square(u)})`,
  };
}

// ------------------------------------------------------------ curved solids
const pi = (a: Q) => (a.n === a.d ? "\\pi" : `${frac(a)}\\pi`);
/** 3.14 × a, exactly, when it terminates. */
const approx = (a: Q) => mul(q(314, 100), a);
function dimensions(r: Random, maxRadius: number) {
  const byDiameter = r(0, 2) === 0;
  const radius = byDiameter ? q(r(2, 2 * maxRadius), 2) : q(r(1, maxRadius));
  return { radius, byDiameter, diameter: mul(radius, q(2)) };
}
function radiusStep(d: ReturnType<typeof dimensions>, u: LengthUnit) {
  return d.byDiameter
    ? `The radius is half the diameter: ${plain(d.diameter)} ÷ 2 = ${plain(d.radius)} ${unitWords[u][num(d.radius) <= 1 ? 0 : 1]}.`
    : `The radius is r = ${len(d.radius, u)}.`;
}
const sizeText = (d: ReturnType<typeof dimensions>, u: LengthUnit) =>
  d.byDiameter
    ? `a diameter of ${len(d.diameter, u)}`
    : `a radius of ${len(d.radius, u)}`;
function cylinderCase(r: Random): Case {
  const u = pick(r, units);
  const mode = pick(r, ["exact", "exact", "approx", "height"] as const);
  let d = dimensions(r, 10),
    h = r(2, 20);
  // 3.14 answers are exact decimals; keep them to two places.
  // With 3.14, a whole-number radius keeps the answer to two decimal places.
  while (mode === "approx" && d.radius.d !== 1)
    [d, h] = [dimensions(r, 10), r(2, 20)];
  const baseC = mul(d.radius, d.radius),
    volumeC = mul(baseC, q(h));
  const figure: SemanticFigure = {
    kind: "curved-solid",
    unit: u,
    solid: "cylinder",
    radius: d.byDiameter ? null : num(d.radius),
    diameter: d.byDiameter ? num(d.diameter) : null,
    height: mode === "height" ? null : h,
  };
  const C = cubic(u);
  const baseStep = `The base is a circle. Its area is $\\pi r^2 = \\pi \\times ${power(d.radius, 2)} = ${pi(baseC)}$ ${square(u)}.`;
  if (mode === "height")
    return {
      prompt: `A cylinder has a volume of $${pi(volumeC)}$ ${C} and ${sizeText(d, u)}. What is its height, in ${unitWords[u][1]}?`,
      answer: q(h),
      explanation: [
        radiusStep(d, u),
        baseStep,
        `Volume = base area × height, so the height is the volume divided by the base area: $${pi(volumeC)} \\div ${pi(baseC)} = ${h}$.`,
        `Check: $${pi(baseC)} \\times ${h} = ${pi(volumeC)}$. The height is ${len(h, u)}.`,
      ],
      hint: `Volume = base area × height. The cylinder has ${sizeText(d, u)}: find the base area, $\\pi r^2$, then divide $${pi(volumeC)}$ by it; the $\\pi$ cancels.`,
      figure,
      tags: ["missing-height", d.byDiameter ? "diameter" : "radius"],
      kind: "fraction",
      label: `Height (${unitWords[u][1]})`,
    };
  const stack = `A cylinder is a stack of copies of its base, ${len(h, u)} tall. The volume is the base area times the height: $${pi(baseC)} \\times ${h} = ${pi(volumeC)}$ ${C}.`;
  if (mode === "approx") {
    const value = approx(volumeC);
    return {
      prompt: `A cylinder has ${sizeText(d, u)} and a height of ${len(h, u)}. Use 3.14 for $\\pi$. What is its volume, in ${C}?`,
      answer: value,
      explanation: [
        radiusStep(d, u),
        baseStep,
        stack,
        `Replace $\\pi$ with 3.14: $${pi(volumeC)} \\approx 3.14 \\times ${plain(volumeC)} = ${plain(value)}$. The volume is about ${plain(value)} ${C}.`,
      ],
      hint: `The volume is $V = \\pi \\times r \\times r \\times h$. The cylinder has ${sizeText(d, u)} and is ${len(h, u)} tall: multiply radius × radius × height, then multiply by 3.14.`,
      figure,
      tags: ["approximate", d.byDiameter ? "diameter" : "radius"],
      kind: "number",
      label: `Volume (${C})`,
    };
  }
  return {
    prompt: `A cylinder has ${sizeText(d, u)} and a height of ${len(h, u)}. Its volume is $a\\pi$ ${C}. What is $a$?`,
    answer: volumeC,
    explanation: [
      radiusStep(d, u),
      baseStep,
      stack,
      `The number multiplying $\\pi$ is $a$, so $a = ${frac(volumeC)}$.`,
    ],
    hint: `The volume is $V = \\pi \\times r \\times r \\times h$. The cylinder has ${sizeText(d, u)} and is ${len(h, u)} tall: multiply radius × radius × height; that product is the number multiplying $\\pi$.`,
    figure,
    tags: [
      "exact",
      d.byDiameter ? "diameter" : "radius",
      volumeC.d === 1 ? "whole-coefficient" : "fraction-coefficient",
    ],
    kind: "fraction",
    label: "Exact coefficient $a$",
  };
}

function coneSphereCase(r: Random): Case {
  const u = pick(r, units);
  const solid = pick(r, ["cone", "cone", "sphere", "hemisphere"] as const);
  const wantApprox = r(0, 3) === 0;
  // A cone is between as tall as its radius and four times as tall.
  const tall = (d: { radius: Q }) =>
    r(
      Math.max(2, Math.ceil(num(d.radius))),
      Math.min(18, Math.floor(4 * num(d.radius)) + 2),
    );
  let d = dimensions(r, 9),
    h = tall(d),
    coefficient: Q;
  const value = () =>
    solid === "cone"
      ? mul(q(1, 3), d.radius, d.radius, q(h))
      : mul(q(solid === "sphere" ? 4 : 2, 3), d.radius, d.radius, d.radius);
  coefficient = value();
  while (
    wantApprox &&
    (coefficient.d !== 1 || d.radius.d !== 1 || num(coefficient) > 2000)
  ) {
    d = dimensions(r, 9);
    h = tall(d);
    coefficient = value();
  }
  const C = cubic(u);
  const figure: SemanticFigure = {
    kind: "curved-solid",
    unit: u,
    solid,
    radius: d.byDiameter ? null : num(d.radius),
    diameter: d.byDiameter ? num(d.diameter) : null,
    height: solid === "cone" ? h : null,
  };
  const steps = [radiusStep(d, u)];
  if (solid === "cone") {
    const base = mul(d.radius, d.radius),
      cyl = mul(base, q(h));
    steps.push(
      `The base is a circle with area $\\pi \\times ${power(d.radius, 2)} = ${pi(base)}$ ${square(u)}. A cylinder with this base and height ${h} would hold $${pi(base)} \\times ${h} = ${pi(cyl)}$ ${C}.`,
      `A cone holds one third of the cylinder with the same base and height: $\\tfrac{1}{3} \\times ${pi(cyl)} = ${pi(coefficient)}$ ${C}.`,
    );
  } else {
    const cube = mul(d.radius, d.radius, d.radius),
      sphere = mul(q(4, 3), cube);
    steps.push(
      `Cube the radius: $${power(d.radius, 3)} = ${frac(cube)}$. A sphere's volume is $\\tfrac{4}{3}\\pi r^3$: $\\tfrac{4}{3} \\times ${pi(cube)} = ${pi(sphere)}$ ${C}.`,
    );
    if (solid === "hemisphere")
      steps.push(
        `A hemisphere is half of a sphere: $\\tfrac{1}{2} \\times ${pi(sphere)} = ${pi(coefficient)}$ ${C}.`,
      );
  }
  const name = solid === "hemisphere" ? "hemisphere" : solid;
  const size = sizeText(d, u);
  const given =
    solid === "cone"
      ? `A cone has ${size} and a height of ${len(h, u)}.`
      : `A ${name} has ${size}.`;
  if (wantApprox) {
    const v = approx(coefficient);
    steps.push(
      `Replace $\\pi$ with 3.14: $${pi(coefficient)} \\approx 3.14 \\times ${plain(coefficient)} = ${plain(v)}$. The volume is about ${plain(v)} ${C}.`,
    );
    return {
      prompt: `${given} Use 3.14 for $\\pi$. What is its volume, in ${C}?`,
      answer: v,
      explanation: steps,
      hint: `${hints[solid]!} ${given}`,
      figure,
      tags: [solid, "approximate", d.byDiameter ? "diameter" : "radius"],
      kind: "number",
      label: `Volume (${C})`,
    };
  }
  steps.push(
    `The number multiplying $\\pi$ is $a$, so $a = ${frac(coefficient)}$.`,
  );
  return {
    prompt: `${given} Its volume is $a\\pi$ ${C}. What is $a$?`,
    answer: coefficient,
    explanation: steps,
    hint: `${hints[solid]!} ${given}`,
    figure,
    tags: [
      solid,
      "exact",
      d.byDiameter ? "diameter" : "radius",
      coefficient.d === 1 ? "whole-coefficient" : "fraction-coefficient",
    ],
    kind: "fraction",
    label: "Exact coefficient $a$",
  };
}
const hints: Record<string, string> = {
  cone: "A cone holds one third of the cylinder with the same base and height: its volume is one third of $\\pi \\times r \\times r \\times h$.",
  sphere:
    "A sphere's volume is four thirds of $\\pi \\times r \\times r \\times r$. Halve a diameter first.",
  hemisphere:
    "A hemisphere is half a sphere: its volume is one half of four thirds, or two thirds, of $\\pi \\times r \\times r \\times r$.",
};

function clauseRandom(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, "clause-family", seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
/** New family on half the seeds. A reprint below CLAUSE_SINCE does not draw. */
function useClauseFamily(id: string, seed: string): boolean {
  if (!clauseHostIds.has(id)) return false;
  const version = generatingVersion();
  if (typeof version === "number" && version < CLAUSE_SINCE) return false;
  return clauseRandom(id, seed)(0, 1) === 1;
}
function stampedVersion(id: string): number {
  if (!clauseHostIds.has(id)) return 1;
  const version = generatingVersion();
  if (typeof version === "number" && version < CLAUSE_SINCE) return 1;
  return version ?? CLAUSE_SINCE;
}
function shuffle<T>(r: Random, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = r(0, i);
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}
function problemHash(id: string, seed: string, version: number): string {
  return createHash("sha256")
    .update(JSON.stringify([id, version, seed]))
    .digest("hex");
}
type PolyFig = Extract<SemanticFigure, { kind: "measured-polygon" }>;
function asPoly(figure: SemanticFigure | undefined): PolyFig {
  if (!figure || figure.kind !== "measured-polygon")
    throw new Error("Expected a measured polygon");
  return figure;
}
const shown = (a: Q) => (a.d === 1 ? String(a.n) : frac(a));
const claim = (a: Q) => (a.d === 1 ? String(a.n) : `$${frac(a)}$`);

function inContextTriangle(r: Random): Case {
  const base = triangleCase(r);
  const price = r(2, 6);
  const f = asPoly(base.figure);
  const b = f.sides[0]!;
  const h = f.heights[0]
    ? f.heights[0].value
    : f.rightAngles.includes(0)
      ? f.sides[2]!
      : f.sides[1]!;
  const area = q(b * h, 2);
  if (area.n !== base.answer.n || area.d !== base.answer.d)
    throw new Error("Sail base and height do not match the triangle");
  const cost = mul(area, q(price));
  const u = f.unit;
  return {
    prompt: `The triangle is a sail. Canvas costs $${price}$ for each square ${unitWords[u][0]}. What does the canvas cost, in dollars?`,
    answer: cost,
    explanation: [
      `The base is ${b} and the perpendicular height is ${h}. Half of their product is the area: $\\tfrac{1}{2} \\times ${b} \\times ${h} = ${shown(area)}$.`,
      `Canvas costs $${price}$ for each square ${unitWords[u][0]}: $${shown(area)} \\times ${price} = ${shown(cost)}$.`,
      `The cost is ${plain(cost)} dollars.`,
    ],
    hint: "Use the base and the height that meets it at a right angle. Halve that product, then multiply by the price of one square unit.",
    figure: f,
    tags: ["in-context", "sail"],
    kind: "number",
    label: "Cost (dollars)",
  };
}

function inContextPolygon(r: Random): Case {
  const base = polygonCase(r);
  const price = r(2, 6);
  const f = asPoly(base.figure);
  const u = f.unit;
  const shape = base.tags[0]!;
  const skin =
    shape === "parallelogram"
      ? { thing: "sign", goods: "Paint", asked: "the paint", word: "parallelogram" }
      : shape === "pentagon"
        ? { thing: "barn end", goods: "Siding", asked: "the siding", word: "pentagon" }
        : { thing: "garden", goods: "Sod", asked: "the sod", word: "trapezoid" };
  const steps: string[] = [];
  if (shape === "parallelogram") {
    const b = f.sides[0]!,
      h = f.heights[0]!.value;
    if (b * h !== base.answer.n || base.answer.d !== 1)
      throw new Error("Parallelogram area mismatch");
    steps.push(
      `The base is ${b} and the perpendicular height is ${h}: $${b} \\times ${h} = ${b * h}$.`,
    );
  } else if (shape === "pentagon") {
    const w = f.sides[0]!,
      wall = f.sides[1]!,
      marked = f.heights[0]!.value;
    const roof = base.tags.includes("total-height") ? marked - wall : marked;
    const rect = w * wall,
      tri = q(w * roof, 2),
      sum = add(q(rect), tri);
    if (sum.n !== base.answer.n || sum.d !== base.answer.d)
      throw new Error("Pentagon pieces do not match its area");
    steps.push(
      `The wall rectangle is ${w} by ${wall}: $${w} \\times ${wall} = ${rect}$.`,
      `The roof triangle has base ${w} and height ${roof}: $\\tfrac{1}{2} \\times ${w} \\times ${roof} = ${shown(tri)}$.`,
      `Add the pieces: $${rect} + ${shown(tri)} = ${shown(sum)}$.`,
    );
  } else {
    const a = f.sides[0]!,
      c = f.sides[2]!,
      h = f.heights[0]?.value ?? f.sides[3]!;
    const area = q((a + c) * h, 2);
    if (area.n !== base.answer.n || area.d !== base.answer.d)
      throw new Error("Trapezoid area mismatch");
    steps.push(
      `The parallel sides are ${a} and ${c}, and the height is ${h}: $\\tfrac{1}{2} \\times (${a} + ${c}) \\times ${h} = ${shown(area)}$.`,
    );
  }
  const cost = mul(base.answer, q(price));
  steps.push(
    `${skin.goods} costs $${price}$ for each square ${unitWords[u][0]}: $${shown(base.answer)} \\times ${price} = ${shown(cost)}$.`,
    `The cost is ${plain(cost)} dollars.`,
  );
  const hint =
    shape === "parallelogram"
      ? "The area is the base times the perpendicular height, not a slanted side. Then multiply by the price of one square unit."
      : shape === "pentagon"
        ? "Add the rectangle and half the roof's base times the roof's own height, then multiply by the price of one square unit."
        : "Average the two parallel sides, multiply by the height between them, then multiply by the price of one square unit.";
  return {
    prompt: `A ${skin.thing} is the ${skin.word} shown. ${skin.goods} costs $${price}$ for each square ${unitWords[u][0]}. What does ${skin.asked} cost, in dollars?`,
    answer: cost,
    explanation: steps,
    hint,
    figure: f,
    tags: ["in-context", `context-${skin.word}`],
    kind: "number",
    label: "Cost (dollars)",
  };
}

function houseCase(r: Random, u: LengthUnit): Case {
  const w = r(2, 10) * 2,
    wall = r(3, 12),
    roof = r(2, 8);
  const rect = w * wall,
    tri = (w * roof) / 2,
    total = rect + tri;
  const plural = unitWords[u][1],
    A = square(u);
  return {
    prompt: `The figure is a rectangle ${w} ${plural} wide and ${wall} ${plural} tall with a triangle on top. The triangle is ${w} ${plural} wide and ${roof} ${plural} tall. What is its area, in ${A}?`,
    answer: q(total),
    explanation: [
      `The rectangle is ${w} by ${wall}: $${w} \\times ${wall} = ${rect}$.`,
      `The triangle on top has base ${w} and height ${roof}: $\\tfrac{1}{2} \\times ${w} \\times ${roof} = ${tri}$.`,
      `Add the pieces: $${rect} + ${tri} = ${total}$. The area is ${total} ${A}.`,
    ],
    hint: "Add the rectangle's area to half of the triangle's base times its own height. The roof's height is not the wall.",
    figure: {
      kind: "measured-polygon",
      unit: u,
      vertices: [
        [0, 0],
        [w, 0],
        [w, wall],
        [w / 2, wall + roof],
        [0, wall],
      ],
      sides: [w, wall, null, null, wall],
      heights: [
        { from: [w / 2, wall + roof], to: [w / 2, wall], value: roof },
      ],
      guides: [{ from: [0, wall], to: [w, wall] }],
      rightAngles: [0, 1],
    },
    tags: ["with-triangles", "house"],
    kind: "number",
    label: `Area (${A})`,
  };
}
function cutTriangleCase(r: Random, u: LengthUnit): Case {
  const W = r(6, 14),
    H = r(5, 12),
    a = r(2, W - 2),
    b = r(2, H - 2);
  const tri = q(a * b, 2),
    total = sub(q(W * H), tri);
  const A = square(u);
  return {
    prompt: `A rectangle has a right-triangle corner removed. Lengths are in ${unitWords[u][1]}. What is its area, in ${A}?`,
    answer: total,
    explanation: [
      `The whole rectangle is ${W} by ${H}: $${W} \\times ${H} = ${W * H}$.`,
      `The removed corner has legs ${a} and ${b}: $\\tfrac{1}{2} \\times ${a} \\times ${b} = ${shown(tri)}$.`,
      `Subtract the triangle: $${W * H} - ${shown(tri)} = ${shown(total)}$. The area is ${plain(total)} ${A}.`,
    ],
    hint: "Find the rectangle's area, then subtract half the product of the cut's two legs.",
    figure: {
      kind: "measured-polygon",
      unit: u,
      vertices: [
        [0, 0],
        [W, 0],
        [W, H - b],
        [W - a, H],
        [0, H],
      ],
      sides: [W, H - b, null, W - a, H],
      heights: [],
      guides: [
        { from: [W - a, H], to: [W, H] },
        { from: [W, H], to: [W, H - b] },
      ],
      rightAngles: [0, 1, 4],
    },
    tags: ["with-triangles", "cut-triangle"],
    kind: "number",
    label: `Area (${A})`,
  };
}
function rectTrapCase(r: Random, u: LengthUnit): Case {
  const W = r(8, 16),
    H = r(3, 10),
    o = r(1, Math.min(3, Math.floor((W - 2) / 2))),
    top = W - 2 * o,
    t = r(2, 8);
  const rect = W * H,
    trap = ((W + top) * t) / 2,
    total = rect + trap;
  const plural = unitWords[u][1],
    A = square(u);
  return {
    prompt: `The figure is a rectangle ${W} ${plural} wide and ${H} ${plural} tall with a trapezoid on top. The trapezoid's parallel sides are ${W} ${plural} and ${top} ${plural}, and its height is ${t} ${plural}. What is its area, in ${A}?`,
    answer: q(total),
    explanation: [
      `The rectangle is ${W} by ${H}: $${W} \\times ${H} = ${rect}$.`,
      `The trapezoid has parallel sides ${W} and ${top} and height ${t}: $\\tfrac{1}{2} \\times (${W} + ${top}) \\times ${t} = ${trap}$.`,
      `Add the pieces: $${rect} + ${trap} = ${total}$. The area is ${total} ${A}.`,
    ],
    hint: "Add the rectangle to the trapezoid. The trapezoid's area is the average of its parallel sides times its own height.",
    figure: {
      kind: "measured-polygon",
      unit: u,
      vertices: [
        [0, 0],
        [W, 0],
        [W, H],
        [W - o, H + t],
        [o, H + t],
        [0, H],
      ],
      sides: [W, H, null, top, null, H],
      heights: [{ from: [o, H + t], to: [o, H], value: t }],
      guides: [],
      rightAngles: [0, 1],
    },
    tags: ["with-triangles", "rectangle-trapezoid"],
    kind: "number",
    label: `Area (${A})`,
  };
}
function withTriangles(r: Random): Case {
  const u = pick(r, units);
  const kind = r(0, 2);
  return kind === 0 ? houseCase(r, u) : kind === 1 ? cutTriangleCase(r, u) : rectTrapCase(r, u);
}

function stackedCubes(r: Random): Case {
  const u = pick(r, units);
  let e: number, f: number;
  do {
    e = r(4, 10);
    f = r(2, Math.floor(e / 2));
  } while ((e - f) % 2 !== 0);
  const bottom = 6 * e * e,
    top = 6 * f * f,
    hidden = f * f,
    answer = bottom + top - 2 * hidden;
  const left = (e - f) / 2,
    right = (e + f) / 2;
  const plural = unitWords[u][1],
    A = square(u);
  return {
    prompt: `Two cubes are stacked. The bottom cube has edges of ${e} ${plural}. The top cube has edges of ${f} ${plural} and sits centered on the bottom cube. The drawing shows the front outline with one depth, so both edges are stated here. What is the surface area of the solid, in ${A}?`,
    answer: q(answer),
    explanation: [
      `The bottom cube has 6 faces of side ${e}: $6 \\times ${e}^2 = ${bottom}$.`,
      `The top cube has 6 faces of side ${f}: $6 \\times ${f}^2 = ${top}$.`,
      `The cubes meet on a square of side ${f}, hidden on each cube: $${f}^2 = ${hidden}$, and $2 \\times ${hidden} = ${2 * hidden}$.`,
      `Subtract both hidden faces: $${bottom} + ${top} - ${2 * hidden} = ${answer}$. The surface area is ${answer} ${A}.`,
    ],
    hint: "Do not stop at 6 times each edge squared added together: the touching faces are hidden. Do not subtract the hidden square only once: it is hidden on both cubes.",
    figure: {
      kind: "extruded-polygon",
      unit: u,
      face: [
        [0, 0],
        [e, 0],
        [e, e],
        [right, e],
        [right, e + f],
        [left, e + f],
        [left, e],
        [0, e],
      ],
      sides: [e, e, null, f, f, f, null, e],
      depth: e,
    },
    tags: ["stacked-cubes"],
    kind: "number",
    label: `Surface area (${A})`,
  };
}

function mixedQ(r: Random, denoms: readonly number[], maxWhole: number): Q {
  const d = pick(r, denoms);
  return q(r(1, maxWhole) * d + r(1, d - 1), d);
}
function fractionalBase(r: Random): Case {
  const u = pick(r, ["ft", "in", "m", "cm"] as const);
  const [thing, fill] = pick(r, [
    ["fish tank", "water"],
    ["planter", "soil"],
    ["box", "sand"],
  ] as const);
  let B: Q, h: Q, volume: Q;
  do {
    B = mixedQ(r, [2, 3, 4, 5, 6], 12);
    h = mixedQ(r, [2, 3, 4], 5);
    volume = mul(B, h);
  } while (volume.d > 12);
  const missing = r(0, 1) === 1;
  const plural = unitWords[u][1];
  const figure: SemanticFigure = {
    kind: "measured-polygon",
    unit: u,
    vertices: [
      [0, 0],
      [4, 0],
      [4, 2],
      [0, 2],
    ],
    sides: [null, null, null, null],
    heights: [],
    guides: [],
    rightAngles: [0, 1, 2, 3],
  };
  const rawN = B.n * h.n,
    rawD = B.d * h.d;
  if (!missing) {
    const sum = add(B, h);
    const trap =
      sum.n === volume.n && sum.d === volume.d
        ? []
        : [
            `Adding the base area and the height gives $${frac(sum)}$, not the volume.`,
          ];
    return {
      prompt: `A ${thing} has a rectangular base with area $${mixed(B)}$ square ${plural}. The ${fill} is $${mixed(h)}$ ${word(h, u)} deep. How many cubic ${plural} of ${fill} does it hold?`,
      answer: volume,
      explanation: [
        `Write the measures as improper fractions: $${mixed(B)} = ${frac(B)}$ and $${mixed(h)} = ${frac(h)}$.`,
        `Base times height: $${frac(B)} \\times ${frac(h)} = \\tfrac{${rawN}}{${rawD}} = ${shown(volume)}$.`,
        ...trap,
        `The volume is ${claim(volume)} cubic ${word(volume, u)}.`,
      ],
      hint: "Multiply the base area by the depth. Adding those two measurements does not give the volume.",
      figure,
      tags: ["fractional-base-height", "base-times-height"],
      kind: "fraction",
      label: `Volume (${cubic(u)})`,
    };
  }
  return {
    prompt: `A ${thing} has a base of $${mixed(B)}$ square ${plural} and holds $${mixed(volume)}$ cubic ${word(volume, u)} of ${fill}. How deep is the ${fill}, in ${plural}?`,
    answer: h,
    explanation: [
      `The depth is the volume divided by the base area. Adding the base area to the volume does not give the depth.`,
      `$${frac(volume)} \\div ${frac(B)} = ${frac(volume)} \\times \\tfrac{${B.d}}{${B.n}} = ${shown(h)}$.`,
      `The depth is ${claim(h)} ${word(h, u)}.`,
    ],
    hint: "Divide the volume by the base area. The depth is that missing factor.",
    figure,
    tags: ["fractional-base-height", "missing-base-height"],
    kind: "fraction",
    label: `Depth (${plural})`,
  };
}

function clauseCase(id: string, r: Random): Case {
  if (id === "triangle-area-base-height") return inContextTriangle(r);
  if (id === "polygon-area-decompose") return inContextPolygon(r);
  if (id === "composite-area") return withTriangles(r);
  if (id === "composite-face-prism-surface-area") return stackedCubes(r);
  if (id === "fraction-edge-volume") return fractionalBase(r);
  throw new Error(`No clause family for ${id}`);
}

type Trap = {
  u: LengthUnit;
  B: number;
  b: number;
  h: number;
  o: number;
  rect: number;
  tri: number;
  total: number;
};
function trapDims(r: Random): Trap {
  const u = pick(r, units);
  let b: number, o: number, h: number;
  do {
    b = r(4, 12);
    o = r(1, 6);
    h = r(2, 10);
  } while ((o * h) % 2 !== 0);
  const B = b + 2 * o,
    rect = b * h,
    tri = (o * h) / 2,
    total = rect + 2 * tri;
  return { u, B, b, h, o, rect, tri, total };
}
function trapFigure(t: Trap): SemanticFigure {
  return {
    kind: "measured-polygon",
    unit: t.u,
    vertices: [
      [0, 0],
      [t.B, 0],
      [t.o + t.b, t.h],
      [t.o, t.h],
    ],
    sides: [t.B, null, t.b, null],
    heights: [{ from: [t.o, t.h], to: [t.o, 0], value: t.h }],
    guides: [],
    rightAngles: [],
  };
}
const CHOICE_IDS = ["option-a", "option-b", "option-c", "option-d"] as const;
function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  prompt: string,
  figure: SemanticFigure,
  options: { label: string; correct?: boolean; feedback?: string }[],
  explanation: string[],
  hint: string,
  label: string,
): GeneratedProblem {
  if (options.length !== 4 || options.filter((o) => o.correct).length !== 1)
    throw new Error(`${meta.id} needs one correct choice of four`);
  if (new Set(options.map((o) => o.label)).size !== 4)
    throw new Error(`${meta.id} choice labels collide`);
  const choiceFeedback: Record<string, string> = {};
  options.forEach((o, i) => {
    if (!o.correct && o.feedback) choiceFeedback[CHOICE_IDS[i]!] = o.feedback;
  });
  return {
    public: {
      id: problemHash(meta.id, seed, 1),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt,
      response: {
        kind: "choice",
        label,
        options: options.map((o, i) => ({ id: CHOICE_IDS[i]!, label: o.label })),
      },
      figure,
    },
    answer: CHOICE_IDS[options.findIndex((o) => o.correct)]!,
    explanation,
    hint,
    ...(Object.keys(choiceFeedback).length ? { choiceFeedback } : {}),
  };
}
function whichExpression(
  r: Random,
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  for (let n = 0; n < 40; n++) {
    const t = trapDims(r);
    const correct = `${t.b} × ${t.h} + 2 × (1/2 × ${t.o} × ${t.h})`;
    const box = `${t.B} × ${t.h}`;
    const rectOnly = `${t.b} × ${t.h}`;
    const bases = `${t.B} × ${t.b}`;
    const values = [t.total, t.B * t.h, t.b * t.h, t.B * t.b];
    if (new Set(values).size !== 4) continue;
    if (new Set([correct, box, rectOnly, bases]).size !== 4) continue;
    const options = shuffle(r, [
      { label: correct, correct: true as const },
      {
        label: box,
        feedback:
          "That is the box around the trapezoid: the long base times the height.",
      },
      {
        label: rectOnly,
        feedback:
          "That is only the middle rectangle. Both end triangles still belong to the trapezoid.",
      },
      {
        label: bases,
        feedback:
          "That multiplies the two bases. The second factor is the height, not the other base.",
      },
    ]);
    return choiceProblem(
      meta,
      seed,
      `A trapezoid has parallel sides ${t.B} and ${t.b} and height ${t.h}. Lengths are in ${unitWords[t.u][1]}. Which expression gives its area?`,
      trapFigure(t),
      options,
      [
        `The bases differ by ${t.B} − ${t.b} = ${t.B - t.b}, so each end overhangs ${t.o}.`,
        `The middle rectangle is $${t.b} \\times ${t.h} = ${t.rect}$. Each end triangle is $\\tfrac{1}{2} \\times ${t.o} \\times ${t.h} = ${t.tri}$.`,
        `Rectangle and both triangles: $${t.rect} + ${t.tri} + ${t.tri} = ${t.total}$. The area is ${t.total} ${square(t.u)}.`,
      ],
      "The middle uses the shorter base times the height. Each end is half of the overhang times the height. Add the middle and both ends.",
      "Area expression",
    );
  }
  throw new Error("Need a trapezoid with four distinct expressions");
}

function trayOptions(labels: string[]): PartOption[] {
  // Assign ids before sorting so stored answers keep naming the same cards.
  return labels
    .map((label, i) => ({ id: "abcdef"[i]!, label }))
    .sort((a, b) => Number(a.label) - Number(b.label));
}
function cardsProblem(
  meta: TemplateMetadata,
  seed: string,
  prompt: string,
  figure: SemanticFigure,
  blanks: { id: string; label: string; correct: string }[],
  tray: string[],
  sentence: MultiPartChoiceResponse["sentence"],
  explanation: string[],
  hint: string,
): GeneratedProblem {
  if (new Set(tray).size !== tray.length || tray.length < 2 || tray.length > 6)
    throw new Error(`${meta.id} tray labels must be distinct`);
  const version = generatingVersion() ?? meta.version;
  const options = trayOptions(
    version === 1 ? tray : [...tray].sort((a, b) => Number(a) - Number(b)),
  );
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Piece areas",
    layout: "cards",
    blanks: blanks.map((b) => ({
      id: b.id,
      label: b.label,
      options: options.map((o) => ({ ...o })),
    })),
    sentence,
  };
  multiPartChoiceResponseSchema.parse(response);
  const key = Object.fromEntries(
    blanks.map((b) => {
      const id = options.find((o) => o.label === b.correct)?.id;
      if (!id) throw new Error(`${meta.id} correct card ${b.correct} is missing`);
      return [b.id, id];
    }),
  );
  return {
    public: {
      id: problemHash(meta.id, seed, version),
      templateId: meta.id,
      templateVersion: version,
      seed,
      skillId: meta.skillId,
      prompt,
      response,
      figure,
    },
    answer: serializeMultiPart(response, key),
    explanation,
    hint,
  };
}
function wrongLabels(correct: number[], candidates: number[]): string[] {
  const used = new Set(correct.map(String));
  const out: string[] = [];
  for (const c of candidates) {
    if (!Number.isInteger(c) || c <= 0 || used.has(String(c))) continue;
    used.add(String(c));
    out.push(String(c));
    if (out.length === 2) return out;
  }
  throw new Error("Need two distractor cards");
}
function showPieces(r: Random, meta: TemplateMetadata, seed: string): GeneratedProblem {
  const shape = r(0, 2);
  if (shape === 0) {
    const t = trapDims(r);
    const correct = [t.rect, t.tri, t.total];
    const tray = shuffle(r, [
      ...correct.map(String),
      ...wrongLabels(correct, [t.B * t.h, t.total + 1, t.B * t.b, t.o * t.h]),
    ]);
    const plural = unitWords[t.u][1];
    return cardsProblem(
      meta,
      seed,
      `The trapezoid is cut into a middle rectangle and two matching end triangles. The parallel sides are ${t.B} and ${t.b}, and the height is ${t.h}. Lengths are in ${plural}. Choose each piece and the total, in square ${plural}.`,
      trapFigure(t),
      [
        { id: "rect", label: "Rectangle", correct: String(t.rect) },
        { id: "tri", label: "Each triangle", correct: String(t.tri) },
        { id: "total", label: "Total", correct: String(t.total) },
      ],
      tray,
      [
        { text: "Rectangle: " },
        { blank: "rect" },
        { text: "\nEach triangle: " },
        { blank: "tri" },
        { text: "\nTotal: " },
        { blank: "total" },
      ],
      [
        `Each end overhangs (${t.B} − ${t.b}) ÷ 2 = ${t.o}.`,
        `The middle rectangle is $${t.b} \\times ${t.h} = ${t.rect}$. Each triangle is $\\tfrac{1}{2} \\times ${t.o} \\times ${t.h} = ${t.tri}$.`,
        `Add the rectangle and both triangles: $${t.rect} + ${t.tri} + ${t.tri} = ${t.total}$. The area is ${t.total} square ${plural}.`,
      ],
      "The middle uses the shorter base times the height. Each end is half of the overhang times the height.",
    );
  }
  if (shape === 1) {
    const u = pick(r, units);
    let b: number, h: number;
    do {
      b = r(3, 14);
      h = r(3, 12);
    } while (b === h);
    const area = b * h;
    const slant = hypotenuse(Math.min(b, 20), h);
    const correct = [b, h, area];
    const tray = shuffle(r, [
      ...correct.map(String),
      ...wrongLabels(correct, [area + b, b + h, 2 * (b + h), area + h, slant ?? 0]),
    ]);
    return cardsProblem(
      meta,
      seed,
      `Slide the triangle at one end of the parallelogram across. The base is ${b} ${unitWords[u][1]} and the height is ${h} ${unitWords[u][1]}. Choose the rectangle's length, its width, and its area.`,
      {
        kind: "measured-polygon",
        unit: u,
        vertices: [
          [0, 0],
          [b, 0],
          [b + 1, h],
          [1, h],
        ],
        sides: [b, null, null, null],
        heights: [{ from: [1, h], to: [1, 0], value: h }],
        guides: [],
        rightAngles: [],
      },
      [
        { id: "len", label: "Length", correct: String(b) },
        { id: "wid", label: "Width", correct: String(h) },
        { id: "area", label: "Area", correct: String(area) },
      ],
      tray,
      [
        { text: "After the slide, the rectangle is " },
        { blank: "len" },
        { text: " by " },
        { blank: "wid" },
        { text: ". Its area is " },
        { blank: "area" },
        { text: "." },
      ],
      [
        `The slide keeps the base ${b} and the height ${h}, so the rectangle is ${b} by ${h}.`,
        `Its area is $${b} \\times ${h} = ${area}$. The parallelogram has the same area, ${area} square ${unitWords[u][1]}.`,
      ],
      "The rectangle after the slide has the parallelogram's base and its perpendicular height. Multiply those.",
    );
  }
  const u = pick(r, units);
  let b: number, h: number;
  do {
    b = r(3, 14);
    h = r(3, 12);
  } while (b === h || (b * h) % 2 !== 0);
  const rect = b * h,
    tri = rect / 2;
  const correct = [b, h, rect, tri];
  const tray = shuffle(r, [
    ...correct.map(String),
    ...wrongLabels(correct, [2 * rect, rect + 1, b + h, hypotenuse(b, h) ?? 0]),
  ]);
  return cardsProblem(
    meta,
    seed,
    `Two copies of the right triangle make a rectangle. The legs are ${b} and ${h} ${unitWords[u][1]}. Choose the rectangle's sides, its area, and the triangle's area.`,
    {
      kind: "measured-polygon",
      unit: u,
      vertices: [
        [0, 0],
        [b, 0],
        [0, h],
      ],
      sides: [b, null, h],
      heights: [],
      guides: [],
      rightAngles: [0],
    },
    [
      { id: "base", label: "Length", correct: String(b) },
      { id: "high", label: "Width", correct: String(h) },
      { id: "box", label: "Rectangle area", correct: String(rect) },
      { id: "half", label: "Triangle area", correct: String(tri) },
    ],
    tray,
    [
      { text: "Two copies make a " },
      { blank: "base" },
      { text: " by " },
      { blank: "high" },
      { text: " rectangle, area " },
      { blank: "box" },
      { text: ". The triangle is " },
      { blank: "half" },
      { text: "." },
    ],
    [
      `The legs are the rectangle's sides, ${b} and ${h}.`,
      `The rectangle's area is $${b} \\times ${h} = ${rect}$. The triangle is half: $${rect} \\div 2 = ${tri}$.`,
      `The triangle's area is ${tri} square ${unitWords[u][1]}.`,
    ],
    "The two copies fill a rectangle with the triangle's two legs. The triangle is half of that rectangle.",
  );
}

function countThenSize(
  r: Random,
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const u = pick(r, ["in", "cm", "ft"] as const);
  const d = pick(r, [2, 3, 4]);
  const edge = q(1, d);
  let ks: [number, number, number];
  do ks = [r(2, 9), r(2, 9), r(2, 9)];
  while (ks.every((k) => k % d === 0) || ks[0] * ks[1] * ks[2] > 250);
  const edges = ks.map((k) => q(k, d));
  const total = ks[0] * ks[1] * ks[2];
  const small = q(1, d ** 3);
  const volume = q(total, d ** 3);
  const volText = answerText(volume);
  const cubicName = unitWords[u][1];
  const unitName = unitWords[u][0];
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label: "Count, then volume",
    layout: "steps",
    mode: "build",
    banks: [],
    rows: [
      {
        id: "r1",
        label: "Cubes along the length and the width",
        fields: [
          { kind: "number", label: "Along the length", maxLength: 8 },
          { kind: "number", label: "Along the width", maxLength: 8 },
        ],
      },
      {
        id: "r2",
        label: "Cubes along the height, and how many cubes in all",
        fields: [
          { kind: "number", label: "Along the height", maxLength: 8 },
          { kind: "number", label: "Total cubes", maxLength: 8 },
        ],
      },
      {
        id: "r3",
        label: "Volume of one small cube",
        fields: [
          {
            kind: "number",
            label: "One cube",
            unit: `cubic ${cubicName}`,
            maxLength: 8,
          },
        ],
      },
      {
        id: "r4",
        label: "Volume from the count times one cube",
        fields: [
          {
            kind: "number",
            label: "From the count",
            unit: `cubic ${cubicName}`,
            maxLength: 8,
          },
        ],
      },
      {
        id: "r5",
        label: "Volume from the three edge lengths",
        fields: [
          {
            kind: "number",
            label: "From the edges",
            unit: `cubic ${cubicName}`,
            maxLength: 8,
          },
        ],
      },
    ],
  };
  const workGrading: WorkGrading = {
    mode: "fields",
    fields: [
      [
        { kind: "number", value: String(ks[0]) },
        { kind: "number", value: String(ks[1]) },
      ],
      [
        { kind: "number", value: String(ks[2]) },
        { kind: "number", value: String(total) },
      ],
      [{ kind: "number", value: answerText(small) }],
      [{ kind: "number", value: volText }],
      [{ kind: "number", value: volText }],
    ],
  };
  const answer = JSON.stringify([
    [String(ks[0]), String(ks[1])],
    [String(ks[2]), String(total)],
    [answerText(small)],
    [volText],
    [volText],
  ]);
  const structure = structuralProblem(response);
  if (structure) throw new Error(structure);
  if (!gradingFits(response, workGrading))
    throw new Error("Packing rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error("Packing answer is not canonical");
  if (!gradeStructuredWork(response, workGrading, answer))
    throw new Error("Packing answer is not credited");
  const notEdge =
    d === 2
      ? `A $\\tfrac{1}{2}$-${unitName} cube is $\\tfrac{1}{8}$ cubic ${unitName}, not $\\tfrac{1}{2}$.`
      : `A $\\tfrac{1}{${d}}$-${unitName} cube is $\\tfrac{1}{${d ** 3}}$ cubic ${unitName}, not $\\tfrac{1}{${d}}$.`;
  const names = ["long", "wide", "tall"];
  return {
    public: {
      id: problemHash(meta.id, seed, 1),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt: `A box is ${list(edges.map((x, i) => `${len(x, u, true)} ${names[i]}`))}. It is packed with cubes that have edges of ${len(edge, u, true)}.`,
      response,
      figure: {
        kind: "fraction-box-prism",
        unit: u,
        length: asFigure(edges[0]!),
        width: asFigure(edges[1]!),
        height: asFigure(edges[2]!),
        cubeEdge: asFigure(edge),
      },
    },
    answer,
    workGrading,
    explanation: [
      `Along the length: $${frac(edges[0]!)} \\div \\tfrac{1}{${d}} = ${ks[0]}$. Along the width: $${frac(edges[1]!)} \\div \\tfrac{1}{${d}} = ${ks[1]}$. Along the height: $${frac(edges[2]!)} \\div \\tfrac{1}{${d}} = ${ks[2]}$.`,
      `The counts multiply: $${ks[0]} \\times ${ks[1]} \\times ${ks[2]} = ${total}$.`,
      `${notEdge} Cube the edge: $\\tfrac{1}{${d}} \\times \\tfrac{1}{${d}} \\times \\tfrac{1}{${d}} = ${frac(small)}$.`,
      `The count is not the volume. $${total} \\times ${frac(small)} = ${frac(volume)}$.`,
      `The three edges agree: $${edges.map(frac).join(" \\times ")} = ${frac(volume)}$. The volume is ${claim(volume)} cubic ${word(volume, u)}.`,
    ],
    hint: "Divide each edge by the small cube's edge to count the cubes along it. A small cube's volume is its edge multiplied three times, not the edge itself. The count is not the volume.",
  };
}

const SOLID_NAMES = [
  "rectangular prism",
  "cube",
  "triangular prism",
  "square pyramid",
] as const;
function nameTheSolid(
  r: Random,
  meta: TemplateMetadata,
  seed: string,
): GeneratedProblem {
  const u = pick(r, units);
  const kind = r(0, 3);
  let figure: SemanticFigure;
  let name: (typeof SOLID_NAMES)[number];
  let explanation: string[];
  if (kind === 0) {
    const e = r(2, 5);
    figure = {
      kind: "rectangular-prism-net",
      unit: u,
      length: e,
      width: e,
      height: e,
    };
    name = "cube";
    explanation = [
      `The net is six squares, and every edge is ${e} ${unitWords[u][1]}.`,
      `A rectangular prism also has six faces, but they are not all squares unless every edge matches.`,
      `Every face is a square, so the solid is a cube.`,
    ];
  } else if (kind === 1) {
    let l: number, w: number, h: number;
    do [l, w, h] = [r(2, 6), r(2, 6), r(2, 6)];
    while (new Set([l, w, h]).size < 3);
    figure = { kind: "rectangular-prism-net", unit: u, length: l, width: w, height: h };
    name = "rectangular prism";
    explanation = [
      `The net has six rectangles in three pairs: ${l} by ${w}, ${l} by ${h}, and ${w} by ${h}.`,
      `The three edges differ, so the faces are not all squares. It is not a cube.`,
      `Six rectangular faces fold into a rectangular prism.`,
    ];
  } else if (kind === 2) {
    const [a, b, c] = pick(r, [
      [3, 4, 5],
      [6, 8, 10],
    ] as const);
    const L = r(2, 8);
    figure = {
      kind: "triangular-prism-net",
      unit: u,
      base: a,
      height: b,
      sides: [b, c],
      length: L,
    };
    name = "triangular prism";
    explanation = [
      `Count the faces: five. Two are triangles and three are rectangles.`,
      `A square pyramid also has five faces, but they are one square and four triangles. Face shape separates the two.`,
      `Two triangles and three rectangles fold into a triangular prism.`,
    ];
  } else {
    const side = r(4, 8);
    const slant = r(Math.max(5, Math.floor(side / 2) + 1), 10);
    figure = { kind: "square-pyramid-net", unit: u, side, slant };
    name = "square pyramid";
    explanation = [
      `Count the faces: five. One is a square and four are triangles.`,
      `A triangular prism also has five faces, but they are two triangles and three rectangles. Face shape separates the two.`,
      `One square and four triangles fold into a square pyramid.`,
    ];
  }
  const options = shuffle(
    r,
    SOLID_NAMES.map((label) => ({
      label,
      ...(label === name ? { correct: true as const } : {}),
      feedback:
        label === name
          ? undefined
          : `A ${label} has a different set of faces than this net.`,
    })),
  );
  return choiceProblem(
    meta,
    seed,
    `The net is drawn with lengths in ${unitWords[u][1]}. Which solid does this net fold into?`,
    figure,
    options,
    explanation,
    "Count the faces, then name their shapes. Five faces can be two triangles and three rectangles, or one square and four triangles.",
    "Solid",
  );
}

function clauseTemplateProblem(
  id: string,
  seed: string,
  meta: TemplateMetadata,
): { problem: GeneratedProblem; tags: string[] } | null {
  const r = random(id, seed);
  if (id === "polygon-show-the-pieces")
    return { problem: showPieces(r, meta, seed), tags: ["show-the-pieces"] };
  if (id === "polygon-which-expression")
    return { problem: whichExpression(r, meta, seed), tags: ["which-expression"] };
  if (id === "count-then-size-then-check")
    return {
      problem: countThenSize(r, meta, seed),
      tags: ["count-then-size-then-check"],
    };
  if (id === "net-name-the-solid")
    return { problem: nameTheSolid(r, meta, seed), tags: ["name-the-solid"] };
  return null;
}

const builders: Record<string, (r: Random) => Case> = {
  "triangle-area-base-height": triangleCase,
  "polygon-area-decompose": polygonCase,
  "net-surface-area": netCase,
  "unit-fraction-cube-packing": packingCase,
  "fraction-edge-volume": fractionVolumeCase,
  "composite-area": compositeAreaCase,
  "composite-face-prism-volume": (r) => compositePrismCase(r, false),
  "composite-face-prism-surface-area": (r) => compositePrismCase(r, true),
  "cylinder-volume": cylinderCase,
  "cone-sphere-volume": coneSphereCase,
};

export function areaVolumePrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = areaVolumeTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown area-volume template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const clause = clauseTemplateProblem(id, seed, metadata);
  if (clause)
    return {
      problem: clause.problem,
      tags: clause.tags,
      caseKey: JSON.stringify([
        clause.problem.public.prompt,
        clause.problem.public.figure ?? null,
      ]),
    };
  const version = stampedVersion(id);
  const c = useClauseFamily(id, seed)
    ? clauseCase(id, random(id, seed))
    : builders[id]!(random(id, seed));
  const problem: GeneratedProblem = {
    public: {
      id: problemHash(id, seed, version),
      templateId: id,
      templateVersion: version,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response: { kind: c.kind, label: c.label },
      ...(c.figure ? { figure: c.figure } : {}),
    },
    // A decimal answer (3.14 for pi) is stored as the decimal the learner types.
    answer: c.kind === "number" ? plain(c.answer) : answerText(c.answer),
    explanation: c.explanation,
    hint: c.hint,
  };
  return {
    problem,
    tags: c.tags,
    // The prompt and figure carry every given, so together they identify a case.
    caseKey: JSON.stringify([c.prompt, c.figure ?? null]),
  };
}
export const generateAreaVolumeProblem = (
  id: string,
  seed: string,
): GeneratedProblem => areaVolumePrintCase(id, seed).problem;
