import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import type { FigureFraction, LengthUnit } from "./area-volume-figures";

/** Area, surface area and volume (grades 6–8): triangles and polygons by
 * decomposition, nets, fractional edges, composite figures and curved solids. */
export const areaVolumeTemplates: readonly TemplateMetadata[] = (
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
      "Find a cylinder's volume as a multiple of pi or with pi given, or find its height from its volume.",
    ],
    [
      "cone-sphere-volume",
      "Cone and sphere volume",
      "curved-solid-volume",
      "Find the volume of a cone, sphere or hemisphere as a multiple of pi or with pi given.",
    ],
  ] as const
).map(([id, title, skillId, description]) => ({
  id,
  title,
  skillId,
  description,
  version: 1 as const,
  gradeBand: "6–8" as const,
}));

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
    `Count the cubes along each edge by dividing the edge by ${len(e, u, true)}: ${list(along)}.`,
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
    `Every corner is a right angle, so opposite sides line up. Find the unlabeled ${hidden.length === 1 ? "side" : "sides"}: ${hidden.map((h) => h.text).join("; ")}.`,
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
  const findSides = `Every corner of the front face is a right angle. Find the unlabeled ${hidden.length === 1 ? "edge" : "edges"}: ${hidden.map((h) => h.text).join("; ")}.`;
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
      hint: `Volume = base area × height. The cylinder has ${sizeText(d, u)}: find the base area, pi × radius², then divide $${pi(volumeC)}$ by it; the pi cancels.`,
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
      hint: `Volume = pi × radius² × height. The cylinder has ${sizeText(d, u)} and is ${len(h, u)} tall: multiply radius × radius × height, then multiply by 3.14.`,
      figure,
      tags: ["approximate", d.byDiameter ? "diameter" : "radius"],
      kind: "number",
      label: `Volume (${C})`,
    };
  }
  return {
    prompt: `A cylinder has ${sizeText(d, u)} and a height of ${len(h, u)}. Its volume is $a\\pi$ ${C}. What is a?`,
    answer: volumeC,
    explanation: [
      radiusStep(d, u),
      baseStep,
      stack,
      `The number multiplying $\\pi$ is a, so $a = ${frac(volumeC)}$.`,
    ],
    hint: `Volume = pi × radius² × height. The cylinder has ${sizeText(d, u)} and is ${len(h, u)} tall: multiply radius × radius × height; that product is the number multiplying pi.`,
    figure,
    tags: [
      "exact",
      d.byDiameter ? "diameter" : "radius",
      volumeC.d === 1 ? "whole-coefficient" : "fraction-coefficient",
    ],
    kind: "fraction",
    label: "Exact coefficient a",
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
    `The number multiplying $\\pi$ is a, so $a = ${frac(coefficient)}$.`,
  );
  return {
    prompt: `${given} Its volume is $a\\pi$ ${C}. What is a?`,
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
    label: "Exact coefficient a",
  };
}
const hints: Record<string, string> = {
  cone: "A cone holds one third of the cylinder with the same base and height: volume = one third × pi × radius² × height.",
  sphere: "Volume of a sphere = four thirds × pi × radius³. Halve a diameter first.",
  hemisphere:
    "A hemisphere is half a sphere: volume = one half × four thirds × pi × radius³ = two thirds × pi × radius³.",
};

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
