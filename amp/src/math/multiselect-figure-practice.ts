import type { GeneratedProblem } from "./contracts";
import { dispatch, pick } from "./chain-kit";
import {
  hasParallelSides,
  hasPerpendicularSides,
  isoBox,
  lineAngle,
  panelScene,
  poly,
  transform,
  unambiguousSides,
  type PanelSpec,
  type Pt,
} from "./select-figures";
import { shuffled } from "./elementary-gap-kit";
import {
  sample,
  selectFamily,
  selectModel,
  selectTemplate,
  st,
} from "./select-kit";
import type { Element } from "./scene/spec";
import type { Random } from "./variation/axes";
import type { Statement } from "./variation/statement-set";

/**
 * Select-every-figure families. Each draws lettered figures from exact
 * coordinates and computes every figure's property from those same
 * coordinates, so a drawing and its answer cannot disagree.
 */

const L = "ABCDEF";
const numberOfTrue = (shown: readonly Statement[]) =>
  shown.filter((x) => x.holds).length;
const shapeWord = (n: string) => `Shape $${n}$`;

/* ------------------------------------------------------------ shape library */

interface ShapeDef {
  name: string;
  pts: readonly Pt[];
}
const shapeLibrary: readonly ShapeDef[] = (
  [
    {
      name: "rectangle",
      pts: [
        [-3, -1.5],
        [3, -1.5],
        [3, 1.5],
        [-3, 1.5],
      ],
    },
    {
      name: "square",
      pts: [
        [-2, -2],
        [2, -2],
        [2, 2],
        [-2, 2],
      ],
    },
    {
      name: "parallelogram",
      pts: [
        [-3, -1.5],
        [1, -1.5],
        [3, 1.5],
        [-1, 1.5],
      ],
    },
    {
      name: "rhombus",
      pts: [
        [-2.5, 0],
        [0, -2],
        [2.5, 0],
        [0, 2],
      ],
    },
    {
      name: "trapezoid",
      pts: [
        [-3, -1.5],
        [3, -1.5],
        [1.5, 1.5],
        [-1.5, 1.5],
      ],
    },
    {
      name: "right trapezoid",
      pts: [
        [-3, -1.5],
        [3, -1.5],
        [1, 1.5],
        [-3, 1.5],
      ],
    },
    {
      name: "right triangle",
      pts: [
        [-2.5, -2],
        [2.5, -2],
        [-2.5, 2],
      ],
    },
    {
      name: "isosceles triangle",
      pts: [
        [-3, -2],
        [3, -2],
        [0, 2.5],
      ],
    },
    {
      name: "scalene triangle",
      pts: [
        [-3, -1.5],
        [3, -2],
        [0.5, 2.5],
      ],
    },
    {
      name: "house",
      pts: [
        [-2.5, -2],
        [2.5, -2],
        [2.5, 0.5],
        [0, 2.5],
        [-2.5, 0.5],
      ],
    },
    {
      name: "L shape",
      pts: [
        [-3, -2],
        [3, -2],
        [3, 0],
        [-1, 0],
        [-1, 2],
        [-3, 2],
      ],
    },
    {
      name: "hexagon",
      pts: [
        [-3, 0],
        [-1.5, 2.5],
        [1.5, 2.5],
        [3, 0],
        [1.5, -2.5],
        [-1.5, -2.5],
      ],
    },
    {
      name: "octagon",
      pts: [
        [-1, -3],
        [1, -3],
        [3, -1],
        [3, 1],
        [1, 3],
        [-1, 3],
        [-3, 1],
        [-3, -1],
      ],
    },
    {
      name: "arrow",
      pts: [
        [-3, -1],
        [0.5, -1],
        [0.5, -2.5],
        [3, 0],
        [0.5, 2.5],
        [0.5, 1],
        [-3, 1],
      ],
    },
    {
      name: "slanted pentagon",
      pts: [
        [-3, -1.5],
        [1, -2.5],
        [3, 0.5],
        [0.5, 2.5],
        [-2.5, 1.5],
      ],
    },
    {
      name: "slanted quadrilateral",
      pts: [
        [-3, -1.5],
        [3, -2.5],
        [2, 1.5],
        [-2, 2.5],
      ],
    },
    {
      name: "obtuse triangle",
      pts: [
        [-3, -1.5],
        [2.5, -1.5],
        [-1.5, 2],
      ],
    },
    {
      name: "acute triangle",
      pts: [
        [-2.5, -2],
        [3, -1.5],
        [0, 2.5],
      ],
    },
  ] as ShapeDef[]
).filter((s) => unambiguousSides(s.pts));

/* ------------------------------------------- sides: parallel or perpendicular */

export const shapeRelationTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "shape-sides-select",
  title: "Select the shapes with parallel or perpendicular sides",
  skillId: "lines-symmetry",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select every drawn polygon that has at least one pair of parallel sides or at least one pair of perpendicular sides, among triangles, quadrilaterals and larger polygons turned in any direction.",
});

function shapeRelation(r: Random) {
  const variant = pick(r, ["parallel", "perpendicular"] as const);
  const has = variant === "parallel" ? hasParallelSides : hasPerpendicularSides;
  const total = 6;
  const k = r(2, 4);
  const yes = shuffled(
    r,
    shapeLibrary.filter((s) => has(s.pts)),
  );
  const no = shuffled(
    r,
    shapeLibrary.filter((s) => !has(s.pts)),
  );
  if (yes.length < k || no.length < total - k)
    throw new Error("Need three retry: shapes");
  const chosen = shuffled(r, [...yes.slice(0, k), ...no.slice(0, total - k)]);
  const panels: PanelSpec[] = [];
  const pool: Statement[] = [];
  chosen.forEach((def, i) => {
    const pts = transform(def.pts, r(0, 3), r(0, 1) === 1);
    const holds = has(pts);
    panels.push({ letter: L[i]!, elements: [poly(pts)] });
    const word =
      variant === "parallel" ? "parallel sides" : "perpendicular sides";
    pool.push(
      st(
        shapeWord(L[i]!),
        holds,
        holds
          ? `Shape $${L[i]}$ is ${article(def.name)} ${def.name} with a pair of ${word}.`
          : `Shape $${L[i]}$ is ${article(def.name)} ${def.name}; it has no pair of ${word}.`,
      ),
    );
  });
  const scene = panelScene({
    title: "Six lettered polygons",
    panels,
    columns: 3,
    cell: [7.4, 7.8],
  });
  const phrase =
    variant === "parallel"
      ? "at least one pair of parallel sides"
      : "at least one pair of perpendicular sides";
  return selectModel({
    variant: `${variant}-sides`,
    pool,
    total: pool.length,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context:
      variant === "parallel"
        ? "Parallel sides are always the same distance apart and never meet."
        : "Perpendicular sides meet at a right angle, like the corner of a sheet of paper.",
    ask: (n) => `Select the ${n} shapes that have ${phrase}.`,
    one: "shape",
    hint: (shown) =>
      variant === "parallel"
        ? `The question asks for ${numberOfTrue(shown)} shapes. Go around each shape and look for two sides that point the same way and would never meet if extended. A shape can have one such pair or several.`
        : `The question asks for ${numberOfTrue(shown)} shapes. Go around each shape and look for a corner like the corner of a sheet of paper. Two sides that meet at that corner are perpendicular.`,
    figure: { kind: "scene", scene },
  });
}

/* ------------------------------------------------------- sides of a shape */

export const polygonSidesTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "polygon-sides-select",
  title: "Select the shapes with the same number of sides",
  skillId: "polygon-properties",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Count the sides of one drawn polygon and select every named shape or description that has the same number of sides.",
});
const sideNames: Record<number, string[]> = {
  3: ["triangle"],
  4: ["rectangle", "square", "rhombus", "trapezoid", "parallelogram"],
  5: ["pentagon"],
  6: ["hexagon"],
  7: ["heptagon"],
  8: ["octagon"],
};
const polyWord: Record<number, string> = {
  3: "triangle",
  4: "quadrilateral",
  5: "pentagon",
  6: "hexagon",
  7: "heptagon",
  8: "octagon",
};
const regular = (n: number, rad = 2.6): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = Math.PI / 2 + (2 * Math.PI * i) / n;
    return [
      Math.round(rad * Math.cos(t) * 1000) / 1000,
      Math.round(rad * Math.sin(t) * 1000) / 1000,
    ] as const;
  });

function polygonSides(r: Random) {
  const n = pick(r, [4, 5, 6, 8]);
  const shape =
    n === 4
      ? pick(
          r,
          shapeLibrary.filter((s) => s.pts.length === 4),
        ).pts
      : regular(n);
  const scene = panelScene({
    title: `A polygon with ${n} sides`,
    panels: [{ letter: "Shape", elements: [poly(shape)] }],
    columns: 1,
    cell: [8, 7.4],
    width: 240,
    maxHeight: 220,
  });
  const pool: Statement[] = [];
  const add = (label: string, count: number, how: string) =>
    pool.push(
      st(
        label,
        count === n,
        count === n
          ? `${how} has $${count}$ sides, as many as the drawn shape.`
          : `${how} has $${count}$ sides, but the drawn shape has $${n}$.`,
      ),
    );
  for (const [c, names] of Object.entries(sideNames))
    for (const name of names)
      add(
        `${article(name)} ${name}`,
        Number(c),
        `${cap(article(name))} ${name}`,
      );
  for (const c of [3, 4, 5, 6, 8]) {
    add(`a shape with $${c}$ corners`, c, `A shape with $${c}$ corners`);
    add(`a shape with $${c}$ angles`, c, `A shape with $${c}$ angles`);
  }
  return selectModel({
    variant: n === 4 ? "four-sides" : "more-sides",
    pool,
    total: 5,
    k: r(2, 3),
    context: "The shape below is a polygon.",
    ask: (k) =>
      `Select the ${k} named shapes or descriptions that have as many sides as the shape below.`,
    one: "shape",
    hint: (shown) =>
      `Count the sides of the drawn shape by going around it once and tapping each straight side. A polygon has as many corners and as many angles as it has sides, so use that count for each of the five choices.${n === 4 ? " Several different names can describe a shape with this many sides." : " Check descriptions by corners or angles as well as names."} ${numberOfTrue(shown)} of the five choices match.`,
    figure: { kind: "scene", scene },
  });
}
void polyWord;

/* ----------------------------------------------- lines: parallel / perpendicular */

export const linePairTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "line-pair-select",
  title: "Select the two lines that are parallel or perpendicular",
  skillId: "lines-symmetry",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Select the two lines of five drawn lines that are parallel, or the two that are perpendicular, in any direction.",
});
const lineDirs: Pt[] = [
  [1, 0],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 1],
  [-1, 2],
  [-1, 1],
  [-2, 1],
];
// Directions 90 degrees apart share a class: index i and i + 4.
function linePair(r: Random) {
  const variant = pick(r, ["parallel", "perpendicular"] as const);
  let dirs: Pt[] = [];
  let pair: number[] = [];
  for (let g = 0; g < 200; g++) {
    const classes = shuffled(r, [0, 1, 2, 3]);
    if (variant === "parallel") {
      const base = r(0, 7);
      const others = shuffled(
        r,
        [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => i !== base),
      ).slice(0, 3);
      const flip = r(0, 1) ? 1 : -1;
      const d = lineDirs[base]!;
      dirs = [
        d,
        [d[0] * flip, d[1] * flip],
        ...others.map((i) => lineDirs[i]!),
      ];
    } else {
      const first = classes[0]!;
      const a = r(0, 1) ? first : first + 4;
      dirs = [
        lineDirs[a]!,
        lineDirs[(a + 4) % 8]!,
        ...classes.slice(1).map((c) => lineDirs[r(0, 1) ? c : c + 4]!),
      ];
    }
    // exactly one pair has the stated relation
    const rel = (a: Pt, b: Pt) =>
      variant === "parallel"
        ? a[0] * b[1] - a[1] * b[0] === 0
        : a[0] * b[0] + a[1] * b[1] === 0;
    let count = 0;
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) if (rel(dirs[i]!, dirs[j]!)) count++;
    if (count === 1) {
      pair = [0, 1];
      break;
    }
  }
  const order = shuffled(r, [0, 1, 2, 3, 4]);
  const elements: PanelSpec[] = order.map((di, slot) => {
    const d = dirs[di]!;
    const len = Math.hypot(d[0], d[1]);
    const half = 2.2 / len;
    return {
      letter: L[slot]!,
      elements: [
        {
          type: "segment",
          from: [-d[0] * half, -d[1] * half],
          to: [d[0] * half, d[1] * half],
          stroke: "ink",
          width: 2.5,
        } as Element,
      ],
    };
  });
  const scene = panelScene({
    title: "Five lettered lines",
    panels: elements,
    columns: 5,
    cell: [5.6, 7],
    width: 360,
    maxHeight: 200,
  });
  const pool: Statement[] = order.map((di, slot) =>
    st(
      `Line $${L[slot]}$`,
      pair.includes(di),
      pair.includes(di)
        ? `Line $${L[slot]}$ is one of the two lines that are ${variant}.`
        : `Line $${L[slot]}$ is not ${variant} to any other line.`,
    ),
  );
  return selectModel({
    variant: `${variant}-pair`,
    pool,
    total: 5,
    k: 2,
    ordered: true,
    context: "",
    ask: () =>
      variant === "parallel"
        ? "Select the 2 lines that appear parallel."
        : "Select the 2 lines that appear perpendicular.",
    one: "line",
    hint: () => {
      const first = dirs[order[0]!]!;
      const lean =
        first[1] === 0
          ? "lies flat"
          : first[0] === 0
            ? "stands straight up"
            : `leans ${Math.abs(first[1] / first[0]) > 1 ? "steeply" : "gently"} ${first[1] / first[0] > 0 ? "up to the right" : "up to the left"}`;
      return variant === "parallel"
        ? `Parallel lines slant exactly the same way. The first line on the left ${lean}. Compare how each line leans with it and with the others, and find the two that lean the same amount in the same direction.`
        : `Perpendicular lines cross to make a square corner. The first line on the left ${lean}. Imagine turning each line a quarter turn and look for another line that lies along it.`;
    },
    figure: { kind: "scene", scene },
  });
}

/* --------------------------------------------------------------- angles */

export const angleKindTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "angle-kind-select",
  title: "Select the angles that are acute, right or obtuse",
  skillId: "lines-symmetry",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Select every drawn angle that is acute, right or obtuse among six angles turned in any direction.",
});

function angleKind(r: Random) {
  const kind = pick(r, ["acute", "right", "obtuse"] as const);
  const measure = (k: string) =>
    k === "acute" ? r(5, 16) * 5 : k === "right" ? 90 : r(21, 34) * 5;
  const kindOf = (a: number) =>
    a < 90 ? "acute" : a === 90 ? "right" : "obtuse";
  const k = r(2, 3);
  const others = (["acute", "right", "obtuse"] as const).filter(
    (x) => x !== kind,
  );
  const kinds = shuffled(r, [
    ...Array(k).fill(kind),
    ...Array.from({ length: 6 - k }, (_, i) => others[i % 2]!),
  ]);
  const panels: PanelSpec[] = [];
  const pool: Statement[] = [];
  const used = new Set<string>();
  kinds.forEach((kd, i) => {
    let a = measure(kd);
    let guard = 0;
    while (kd !== "right" && used.has(`${kd}${a}`) && guard++ < 20)
      a = measure(kd);
    used.add(`${kd}${a}`);
    const start = r(0, 23) * 15;
    const t0 = (start * Math.PI) / 180;
    const t1 = ((start + a) * Math.PI) / 180;
    const e0: Pt = [2.7 * Math.cos(t0), 2.7 * Math.sin(t0)];
    const e1: Pt = [2.7 * Math.cos(t1), 2.7 * Math.sin(t1)];
    const xs = [e0[0], 0, e1[0]];
    const ys = [e0[1], 0, e1[1]];
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const pts: [number, number][] = [
      [e0[0] - cx, e0[1] - cy],
      [-cx, -cy],
      [e1[0] - cx, e1[1] - cy],
    ];
    panels.push({
      letter: L[i]!,
      elements: [
        { type: "polyline", points: pts, stroke: "ink", width: 2.5 } as Element,
      ],
    });
    const actual = kindOf(a);
    pool.push(
      st(
        `Angle $${L[i]}$`,
        actual === kind,
        `Angle $${L[i]}$ measures $${a}^\\circ$, so it is ${actual === "acute" ? "less than a right angle (acute)" : actual === "right" ? "a right angle" : "greater than a right angle (obtuse)"}.`,
      ),
    );
  });
  const scene = panelScene({
    title: "Six lettered angles",
    panels,
    columns: 3,
    cell: [6.6, 7],
  });
  const phrase =
    kind === "acute" ? "acute" : kind === "right" ? "right" : "obtuse";
  return selectModel({
    variant: `${phrase}-angles`,
    pool,
    total: 6,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context:
      kind === "acute"
        ? "An acute angle is smaller than a right angle."
        : kind === "right"
          ? "A right angle is the corner of a sheet of paper."
          : "An obtuse angle is larger than a right angle and smaller than a straight line.",
    ask: (n) => `Select the ${n} angles that appear ${phrase}.`,
    one: "angle",
    hint: (shown) =>
      `Compare each angle with a right angle, the square corner of a sheet of paper: open it wider than the corner, and it is obtuse; narrower, and it is acute. ${numberOfTrue(shown)} of the six angles ${kind === "right" ? "are right angles" : `are ${kind}`}.`,
    figure: { kind: "scene", scene },
  });
}

/* ------------------------------------------------------------- symmetry */

export const symmetryLineTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "symmetry-lines-select",
  title: "Select the figures with a correct line of symmetry",
  skillId: "lines-symmetry",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Select every drawn figure whose dashed line, or whose two dashed lines, are lines of symmetry, among rectangles, squares, rhombuses, triangles, parallelograms and other shapes.",
});

interface SymShape {
  name: string;
  pts: Pt[];
}
const symShapes: SymShape[] = [
  {
    name: "rectangle",
    pts: [
      [-3, -1.5],
      [3, -1.5],
      [3, 1.5],
      [-3, 1.5],
    ],
  },
  {
    name: "square",
    pts: [
      [-2, -2],
      [2, -2],
      [2, 2],
      [-2, 2],
    ],
  },
  {
    name: "rhombus",
    pts: [
      [-2.5, 0],
      [0, -2],
      [2.5, 0],
      [0, 2],
    ],
  },
  {
    name: "isosceles triangle",
    pts: [
      [-3, -2],
      [3, -2],
      [0, 2.5],
    ],
  },
  {
    name: "isosceles trapezoid",
    pts: [
      [-3, -1.5],
      [3, -1.5],
      [1.5, 1.5],
      [-1.5, 1.5],
    ],
  },
  {
    name: "house",
    pts: [
      [-2.5, -2],
      [2.5, -2],
      [2.5, 0.5],
      [0, 2.5],
      [-2.5, 0.5],
    ],
  },
  {
    name: "kite",
    pts: [
      [-2, 0],
      [0, 2.5],
      [2, 0],
      [0, -1.5],
    ],
  },
  {
    name: "parallelogram",
    pts: [
      [-3, -1.5],
      [1, -1.5],
      [3, 1.5],
      [-1, 1.5],
    ],
  },
  {
    name: "right triangle",
    pts: [
      [-2.5, -2],
      [2.5, -2],
      [-2.5, 2],
    ],
  },
  {
    name: "scalene triangle",
    pts: [
      [-3, -1.5],
      [3, -2],
      [0.5, 2.5],
    ],
  },
];
type Line = { p: Pt; d: Pt };
const lineChoices: Line[] = [
  { p: [0, 0], d: [0, 1] },
  { p: [0, 0], d: [1, 0] },
  { p: [0, 0], d: [1, 1] },
  { p: [0, 0], d: [1, -1] },
  { p: [1, 0], d: [0, 1] },
  { p: [0, 0.8], d: [1, 0] },
];
const reflect = (pt: Pt, l: Line): Pt => {
  const vx = pt[0] - l.p[0];
  const vy = pt[1] - l.p[1];
  const dd = l.d[0] * l.d[0] + l.d[1] * l.d[1];
  const t = (vx * l.d[0] + vy * l.d[1]) / dd;
  return [l.p[0] + 2 * t * l.d[0] - vx, l.p[1] + 2 * t * l.d[1] - vy];
};
const keyOf = (pt: Pt) =>
  `${Math.round(pt[0] * 1e6) / 1e6},${Math.round(pt[1] * 1e6) / 1e6}`;
function isSymmetryLine(pts: readonly Pt[], l: Line): boolean {
  const have = new Set(pts.map(keyOf));
  const sameVertices = pts.every((p) => have.has(keyOf(reflect(p, l))));
  if (!sameVertices) return false;
  // Equal vertex sets alone can describe a different polygon; every edge must
  // also map onto an edge.
  const edges = new Set(
    pts.map((p, i) =>
      [keyOf(p), keyOf(pts[(i + 1) % pts.length]!)].sort().join("|"),
    ),
  );
  return pts.every((p, i) =>
    edges.has(
      [keyOf(reflect(p, l)), keyOf(reflect(pts[(i + 1) % pts.length]!, l))]
        .sort()
        .join("|"),
    ),
  );
}
function lineElement(l: Line, extent = 3.1): Element {
  const len = Math.hypot(l.d[0], l.d[1]);
  const u: Pt = [l.d[0] / len, l.d[1] / len];
  return {
    type: "segment",
    from: [l.p[0] - u[0] * extent, l.p[1] - u[1] * extent],
    to: [l.p[0] + u[0] * extent, l.p[1] + u[1] * extent],
    stroke: "accent",
    width: 2,
    dash: "dash",
  };
}
function symmetryLines(r: Random) {
  const variant = pick(r, ["one-line", "two-lines"] as const);
  const per = variant === "one-line" ? 1 : 2;
  const total = 5;
  const k = r(2, 3);
  // Build a figure whose drawn lines are all symmetry lines (true) or not.
  const build = (wantAll: boolean) => {
    for (let g = 0; g < 400; g++) {
      const shape = pick(r, symShapes);
      const lines = sample(r, lineChoices, per);
      const quarter = r(0, 3);
      const mirror = r(0, 1) === 1;
      const pts = transform(shape.pts, quarter, mirror);
      const ls = lines.map((l) => {
        const [p] = transform([l.p], quarter, mirror);
        const [d] = transform([l.d], quarter, mirror);
        return { p: p!, d: d! };
      });
      const all = ls.every((l) => isSymmetryLine(pts, l));
      if (all !== wantAll) continue;
      // Do not mix a clearly right line with an almost-right wrong one.
      return { shape, pts, ls, all };
    }
    throw new Error("Need three retry: symmetry figure");
  };
  const wants = shuffled(r, [
    ...Array(k).fill(true),
    ...Array(total - k).fill(false),
  ]);
  const built = wants.map((w) => build(w));
  const panels: PanelSpec[] = [];
  const pool: Statement[] = [];
  built.forEach((b, i) => {
    panels.push({
      letter: L[i]!,
      elements: [poly(b.pts), ...b.ls.map((l) => lineElement(l))],
    });
    pool.push(
      st(
        `Figure $${L[i]}$`,
        b.all,
        b.all
          ? `Folding the ${b.shape.name} along ${per === 1 ? "the dashed line" : "each dashed line"} makes the two halves match.`
          : `The dashed line${per === 1 ? "" : "s"} on the ${b.shape.name} ${per === 1 ? "does" : "do"} not all fold the figure onto itself: a half would not match.`,
      ),
    );
  });
  const scene = panelScene({
    title: "Five lettered figures with dashed lines",
    panels,
    columns: 3,
    cell: [7.4, 8.6],
  });
  return selectModel({
    variant,
    pool,
    total,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context:
      per === 1
        ? "A line of symmetry folds a figure so that the two halves match exactly."
        : "A line of symmetry folds a figure so that the two halves match exactly. Each figure shows two dashed lines.",
    ask: (n) =>
      per === 1
        ? `Select the ${n} figures whose dashed line is a line of symmetry.`
        : `Select the ${n} figures whose two dashed lines are both lines of symmetry.`,
    one: "figure",
    hint: (shown) =>
      `Imagine folding each figure along ${per === 1 ? "its dashed line" : "each of its two dashed lines"}. If every corner and side lands exactly on a matching corner and side, the line is a line of symmetry. ${numberOfTrue(shown)} of the five figures pass${per === 2 ? " with both lines" : ""}.`,
    figure: { kind: "scene", scene },
  });
}

/* ------------------------------------------------------------ protractor */

export const protractorAnglesTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "protractor-angles-select",
  title: "Select the true angle readings on one protractor",
  skillId: "angle-measure",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Read several rays on one protractor and select every true statement about the measures of the angles between them, or every angle whose measure is not a stated value.",
});

function protractorAngles(r: Random) {
  const variant = pick(r, ["true-measures", "not-the-measure"] as const);
  const nRays = variant === "true-measures" ? 3 : 4;
  let rays: number[] = [];
  for (let g = 0; g < 400; g++) {
    // rays are on the inner scale from 0 on the right
    rays = [0, ...Array.from({ length: nRays - 1 }, () => r(2, 34) * 5)]
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort((a, b) => a - b);
    if (rays.length !== nRays) continue;
    const gaps = rays.slice(1).map((v, i) => v - rays[i]!);
    if (gaps.some((x) => x < 15) || rays[nRays - 1]! > 175) continue;
    if (variant === "not-the-measure") {
      const diffs = pairs(nRays).map(([i, j]) => rays[j]! - rays[i]!);
      const counts = new Map<number, number>();
      diffs.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
      if (![...counts.values()].some((c) => c === 2)) continue;
    }
    break;
  }
  const name = "ABCD";
  const o = "O";
  const nameOf = ([i, j]: [number, number]) =>
    `\\angle ${name[i]}${o}${name[j]}`;
  const meas = ([i, j]: [number, number]) => rays[j]! - rays[i]!;
  const prs = pairs(nRays);
  const prot = {
    type: "protractor" as const,
    rays: [rays[0]!, rays[1]!] as [number, number],
    labels: [name[0]!, o, name[1]!] as [string, string, string],
  };
  const extra: Element[] = rays.slice(2).flatMap((deg, i): Element[] => {
    const t = (deg * Math.PI) / 180;
    return [
      {
        type: "segment",
        from: [0, 0],
        to: [1.15 * Math.cos(t), 1.15 * Math.sin(t)],
        stroke: "ink",
        width: 2,
      },
      {
        type: "text",
        at: [1.25 * Math.cos(t), 1.25 * Math.sin(t)],
        text: name[i + 2]!,
        font: "sans",
        size: "md",
        bold: true,
        align: [0, 0],
      },
    ];
  });
  const figure = {
    kind: "scene" as const,
    scene: {
      v: 1 as const,
      title: `A protractor with rays ${name.slice(0, nRays).split("").join(", ")} from vertex ${o}`,
      width: 340,
      maxHeight: 280,
      elements: [prot as Element, ...extra],
    },
  };
  if (variant === "not-the-measure") {
    const diffs = prs.map(meas);
    const targets = [...new Set(diffs)].filter(
      (d) => diffs.filter((x) => x === d).length === 2,
    );
    const M = pick(r, targets);
    const pool = prs.map((p) =>
      st(
        `$${nameOf(p)}$`,
        meas(p) !== M,
        meas(p) !== M
          ? `$${nameOf(p)}$ is from $${rays[p[0]]}^\\circ$ to $${rays[p[1]]}^\\circ$ on the scale: $${meas(p)}^\\circ$, not $${M}^\\circ$.`
          : `$${nameOf(p)}$ is from $${rays[p[0]]}^\\circ$ to $${rays[p[1]]}^\\circ$ on the scale: $${meas(p)}^\\circ$, which is $${M}^\\circ$.`,
      ),
    );
    return selectModel({
      variant,
      pool,
      total: pool.length,
      k: pool.filter((p) => p.holds).length,
      ordered: true,
      context: "Rays from vertex $O$ are drawn on one protractor.",
      ask: (n) => `Select the ${n} angles whose measure is not $${M}^\\circ$.`,
      one: "angle",
      hint: () =>
        `Read the scale where ray $A$ is at $0$. An angle between two rays measures the difference of their two readings: find each reading, subtract the smaller from the greater, and compare with $${M}^\\circ$.`,
      figure,
    });
  }
  const pool: Statement[] = [];
  for (const p of prs) {
    const actual = meas(p);
    const cands = new Set<number>([
      actual,
      180 - actual,
      actual + 10,
      actual - 10,
      rays[p[1]]!,
      rays[p[0]]! + rays[p[1]]!,
    ]);
    for (const v of cands) {
      if (v <= 0 || v >= 180) continue;
      pool.push(
        st(
          `$${nameOf(p)}=${v}^\\circ$`,
          v === actual,
          v === actual
            ? `The rays are at $${rays[p[0]]}^\\circ$ and $${rays[p[1]]}^\\circ$ on the scale, so $${nameOf(p)}=${actual}^\\circ$.`
            : `The rays are at $${rays[p[0]]}^\\circ$ and $${rays[p[1]]}^\\circ$ on the scale, so $${nameOf(p)}=${actual}^\\circ$, not $${v}^\\circ$.`,
        ),
      );
    }
  }
  const seen = new Set<string>();
  const unique = pool.filter((s) =>
    seen.has(s.label) ? false : !!seen.add(s.label),
  );
  return selectModel({
    variant,
    pool: unique,
    total: 5,
    k: r(2, 3),
    context:
      "Rays $A$, $B$ and $C$ from vertex $O$ are drawn on one protractor.",
    ask: (n) => `Select the ${n} true statements.`,
    hint: (shown) =>
      `Ray $A$ is on $0$ of the scale you read. Read where ray $B$ and ray $C$ cross that scale. An angle between two rays measures the difference of their readings, so for the angle between $B$ and $C$ subtract the smaller reading from the greater. ${numberOfTrue(shown)} of the five statements are true.`,
    figure,
  });
}
function pairs(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/* ---------------------------------------------------------- prism volume */

export const prismVolumeTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "prism-volume-select",
  title: "Select the prisms with a stated volume",
  skillId: "prism-volume",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Multiply the labeled edges of six drawn rectangular prisms and select every prism that has a stated volume in cubic centimeters.",
});

function prismVolume(r: Random) {
  const V = pick(r, [24, 30, 36, 18, 20]);
  const triples: [number, number, number][] = [];
  for (let l = 1; l <= 6; l++)
    for (let w = l; w <= 6; w++)
      for (let h = w; h <= 6; h++) triples.push([l, w, h]);
  const yes = shuffled(
    r,
    triples.filter(([l, w, h]) => l * w * h === V),
  );
  const no = shuffled(
    r,
    triples.filter(
      ([l, w, h]) =>
        l * w * h !== V && Math.abs(l * w * h - V) <= 14 && l + w + h > 5,
    ),
  );
  const k = Math.min(r(2, 3), yes.length);
  const chosen = shuffled(r, [...yes.slice(0, k), ...no.slice(0, 6 - k)]);
  const elements: PanelSpec[] = [];
  const pool: Statement[] = [];
  chosen.forEach((t, i) => {
    const edges = shuffled(r, [...t]);
    const [l, w, h] = edges as [number, number, number];
    elements.push({ letter: L[i]!, elements: isoBox(l, w, h, 0.5) });
    pool.push(
      st(
        `Prism $${L[i]}$`,
        l * w * h === V,
        `Prism $${L[i]}$: $${l}\\times${w}\\times${h}=${l * w * h}$ cubic centimeters, ${l * w * h === V ? "equal to" : "not equal to"} $${V}$.`,
      ),
    );
  });
  const scene = panelScene({
    title: "Six lettered rectangular prisms with labeled edges",
    panels: elements,
    columns: 2,
    cell: [8, 8.6],
    width: 360,
    maxHeight: 560,
  });
  return selectModel({
    variant: "labeled-edges",
    pool,
    total: 6,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context: "Each prism is drawn with its edge lengths in centimeters.",
    ask: (n) =>
      `Select the ${n} prisms that have a volume of $${V}$ cubic centimeters.`,
    one: "prism",
    hint: () =>
      `The volume of a rectangular prism is length times width times height. Multiply the three edge lengths of each prism, one prism at a time, and compare each product with $${V}$.`,
    figure: { kind: "scene", scene },
  });
}

/* --------------------------------------------------------- drawn solids */

export const solidFiguresTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "solid-figure-select",
  title: "Select the drawn solids with a property",
  skillId: "polygon-properties",
  gradeBand: "3–5",
  difficultyOffset: 0.3,
  description:
    "Select every drawn solid that has a stated property, such as two congruent parallel faces, a curved surface, only flat faces or triangular faces, among prisms, pyramids, a cylinder, a cone and a sphere.",
});

interface SolidDef {
  name: string;
  kind: "prism" | "pyramid" | "cylinder" | "cone" | "sphere";
  /** Sides of the base for a prism or pyramid. */
  n?: number;
}
const solidDefs: SolidDef[] = [
  { name: "cube", kind: "prism", n: 4 },
  { name: "rectangular prism", kind: "prism", n: 4 },
  { name: "triangular prism", kind: "prism", n: 3 },
  { name: "pentagonal prism", kind: "prism", n: 5 },
  { name: "hexagonal prism", kind: "prism", n: 6 },
  { name: "square pyramid", kind: "pyramid", n: 4 },
  { name: "triangular pyramid", kind: "pyramid", n: 3 },
  { name: "pentagonal pyramid", kind: "pyramid", n: 5 },
  { name: "cylinder", kind: "cylinder" },
  { name: "cone", kind: "cone" },
  { name: "sphere", kind: "sphere" },
];
const solidProps = {
  "parallel-faces": {
    phrase: "two congruent parallel faces",
    test: (d: SolidDef) => d.kind === "prism" || d.kind === "cylinder",
    why: (d: SolidDef) =>
      d.kind === "prism" || d.kind === "cylinder"
        ? `a ${d.name} has two congruent bases that are parallel.`
        : `a ${d.name} has at most one base, so it has no two parallel congruent faces.`,
  },
  "curved-surface": {
    phrase: "a curved surface",
    test: (d: SolidDef) => ["cylinder", "cone", "sphere"].includes(d.kind),
    why: (d: SolidDef) =>
      ["cylinder", "cone", "sphere"].includes(d.kind)
        ? `a ${d.name} has a curved surface.`
        : `a ${d.name} has only flat faces.`,
  },
  "flat-faces": {
    phrase: "only flat faces",
    test: (d: SolidDef) => d.kind === "prism" || d.kind === "pyramid",
    why: (d: SolidDef) =>
      d.kind === "prism" || d.kind === "pyramid"
        ? `all the faces of a ${d.name} are flat.`
        : `a ${d.name} has a curved surface.`,
  },
  "triangle-face": {
    phrase: "at least one triangular face",
    test: (d: SolidDef) =>
      d.kind === "pyramid" || (d.kind === "prism" && d.n === 3),
    why: (d: SolidDef) =>
      d.kind === "pyramid"
        ? `the side faces of a ${d.name} are triangles.`
        : d.kind === "prism" && d.n === 3
          ? "a triangular prism has triangles for its two bases."
          : `a ${d.name} has no triangular face.`,
  },
  "many-faces": {
    phrase: "6 or more flat faces",
    test: (d: SolidDef) =>
      (d.kind === "prism" && d.n! + 2 >= 6) ||
      (d.kind === "pyramid" && d.n! + 1 >= 6),
    why: (d: SolidDef) =>
      d.kind === "prism"
        ? `a ${d.name} has ${d.n! + 2} faces.`
        : d.kind === "pyramid"
          ? `a ${d.name} has ${d.n! + 1} faces.`
          : `a ${d.name} does not have 6 or more flat faces.`,
  },
} as const;

function regularBase(n: number, rad: number): [number, number][] {
  const rot = n === 4 ? Math.PI / 4 : Math.PI / 2;
  return Array.from({ length: n }, (_, i) => {
    const t = rot + (2 * Math.PI * i) / n;
    return [
      Math.round(rad * Math.cos(t) * 1000) / 1000,
      Math.round(rad * Math.sin(t) * 1000) / 1000,
    ] as [number, number];
  });
}
const SOLID_SCALE = 1.3;
function solidElement(d: SolidDef): Element {
  const f = SOLID_SCALE;
  const ellipse = {
    type: "ellipse" as const,
    center: [0, 0] as [number, number],
    radii: [f, f] as [number, number],
    angle: 0,
  };
  if (d.kind === "sphere")
    return { type: "solid", solid: { type: "sphere", radius: 1.25 * f } };
  if (d.kind === "cylinder")
    return {
      type: "solid",
      solid: { type: "prism", base: ellipse, height: 2 * f },
    };
  if (d.kind === "cone")
    return {
      type: "solid",
      solid: { type: "pyramid", base: ellipse, height: 2.2 * f },
    };
  const rad = (d.name === "cube" ? 1.1 : d.n === 4 ? 1.2 : 1.1) * f;
  const base: [number, number][] =
    d.name === "rectangular prism"
      ? [
          [-1.5 * f, -0.8 * f],
          [1.5 * f, -0.8 * f],
          [1.5 * f, 0.8 * f],
          [-1.5 * f, 0.8 * f],
        ]
      : regularBase(d.n!, rad);
  const height =
    (d.name === "cube" ? 1.55 : d.kind === "prism" ? 1.8 : 2.2) * f;
  return {
    type: "solid",
    solid: {
      type: d.kind as "prism" | "pyramid",
      base: { type: "polygon", points: base },
      height,
    },
  };
}

function solidFigures(r: Random) {
  const key = pick(r, Object.keys(solidProps) as (keyof typeof solidProps)[]);
  const prop = solidProps[key];
  const k = r(2, 3);
  const yes = shuffled(r, solidDefs.filter(prop.test));
  const no = shuffled(
    r,
    solidDefs.filter((d) => !prop.test(d)),
  );
  if (yes.length < k || no.length < 6 - k)
    throw new Error("Need three retry: solids");
  const chosen = shuffled(r, [...yes.slice(0, k), ...no.slice(0, 6 - k)]);
  const panels: PanelSpec[] = chosen.map((d, i) => ({
    letter: L[i]!,
    elements: [solidElement(d)],
  }));
  const pool = chosen.map((d, i) =>
    st(
      `Solid $${L[i]}$`,
      prop.test(d),
      `Solid $${L[i]}$ is ${article(d.name)} ${d.name}: ${prop.why(d)}`,
    ),
  );
  const scene = panelScene({
    title: "Six lettered solids",
    panels,
    columns: 3,
    cell: [7, 8],
  });
  return selectModel({
    variant: `${key}-solids`,
    pool,
    total: 6,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context: "",
    ask: (n) => `Select the ${n} solids that have ${prop.phrase}.`,
    one: "solid",
    hint: (shown) =>
      `${numberOfTrue(shown)} of the six solids ${key === "parallel-faces" ? "have two parallel congruent faces" : key === "curved-surface" ? "have a curved surface" : key === "flat-faces" ? "have only flat faces" : key === "triangle-face" ? "have a triangular face" : "have six or more flat faces"}. ` +
      (key === "parallel-faces"
        ? "Look for a solid with two faces that are the same size and shape and face each other, like the top and bottom of a box."
        : key === "curved-surface" || key === "flat-faces"
          ? "Look at the surface of each solid. A flat face lies flat against a table, and a curved surface rolls."
          : key === "triangle-face"
            ? "Look for triangles among the faces of each solid. A triangle has three straight sides."
            : "Count the flat faces of each solid: the bases and each side face. Count the hidden ones too, using the dashed edges."),
    figure: { kind: "scene", scene },
  });
}
const cap = (w: string) => w[0]!.toUpperCase() + w.slice(1);
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/* ------------------------------------------------------ stem-and-leaf plots */

export const stemLeafMatchTemplate = selectTemplate({
  figure: "scenes-v1",
  id: "stem-leaf-match-select",
  title: "Select the plots that show a data list",
  skillId: "mean-median",
  gradeBand: "6–8",
  difficultyOffset: -0.3,
  description:
    "Compare each of four stem-and-leaf plots with a list of two-digit values and select every plot that shows exactly that data, with leaves in order or in the order listed.",
});

function stemLeafMatch(r: Random) {
  const n = r(9, 12);
  let data: number[] = [];
  for (let g = 0; g < 100; g++) {
    const lo = r(1, 3);
    data = Array.from({ length: n }, () => r(lo * 10, (lo + 2) * 10 + 9));
    const stems = new Set(data.map((v) => Math.floor(v / 10)));
    const ones = (stem: number) =>
      new Set(data.filter((v) => Math.floor(v / 10) === stem).map((v) => v % 10))
        .size;
    // A row with two different leaves lets the listed order differ from the sorted one.
    if (
      stems.size >= 3 &&
      stems.size <= 4 &&
      new Set(data).size >= n - 2 &&
      [...stems].some((stem) => ones(stem) >= 2)
    )
      break;
  }
  const toRows = (values: readonly number[], sorted: boolean) => {
    const lo = Math.min(...values.map((v) => Math.floor(v / 10)));
    const hi = Math.max(...values.map((v) => Math.floor(v / 10)));
    const rows: { stem: number; leaves: number[] }[] = [];
    for (let s = lo; s <= hi; s++) {
      const leaves = values
        .filter((v) => Math.floor(v / 10) === s)
        .map((v) => v % 10);
      rows.push({
        stem: s,
        leaves: sorted ? [...leaves].sort((a, b) => a - b) : leaves,
      });
    }
    return rows;
  };
  const reading = (rows: { stem: number; leaves: number[] }[]) =>
    rows
      .flatMap((row) => row.leaves.map((l) => row.stem * 10 + l))
      .sort((a, b) => a - b);
  const sortedData = [...data].sort((a, b) => a - b);
  const same = (rows: { stem: number; leaves: number[] }[]) => {
    const got = reading(rows);
    return (
      got.length === sortedData.length &&
      got.every((v, i) => v === sortedData[i])
    );
  };
  type Rows = { stem: number; leaves: number[] }[];
  const clone = (rows: Rows): Rows =>
    rows.map((x) => ({ stem: x.stem, leaves: [...x.leaves] }));
  const nonEmpty = (rows: Rows) => rows.filter((x) => x.leaves.length);
  const wrong: Rows[] = [];
  const base = toRows(data, true);
  {
    const w = clone(base);
    const row = pick(r, nonEmpty(w));
    const i = r(0, row.leaves.length - 1);
    row.leaves[i] = (row.leaves[i]! + r(1, 3)) % 10;
    row.leaves.sort((a, b) => a - b);
    wrong.push(w);
  }
  {
    const w = clone(base);
    const row = pick(r, nonEmpty(w));
    row.leaves.splice(r(0, row.leaves.length - 1), 1);
    wrong.push(w);
  }
  {
    const w = clone(base);
    const row = pick(r, nonEmpty(w));
    row.leaves.push(row.leaves[0]!);
    row.leaves.sort((a, b) => a - b);
    wrong.push(w);
  }
  {
    // a value with its stem and leaf exchanged: 23 written as 3 | 2
    const w = clone(base);
    const stems = new Set(w.map((x) => x.stem));
    const movable = nonEmpty(w).filter((x) =>
      x.leaves.some((l) => stems.has(l) && l !== x.stem),
    );
    if (movable.length) {
      const row = pick(r, movable);
      const leaf = row.leaves.find((l) => stems.has(l) && l !== row.stem)!;
      row.leaves.splice(row.leaves.indexOf(leaf), 1);
      const target = w.find((x) => x.stem === leaf)!;
      target.leaves.push(row.stem);
      target.leaves.sort((a, b) => a - b);
      wrong.push(w);
    }
  }
  while (wrong.length < 3)
    wrong.push(
      clone(base).map((x) => ({
        stem: x.stem,
        leaves: x.leaves.map((l) => (l + 1) % 10).sort((a, b) => a - b),
      })),
    );
  const sortedRows = toRows(data, true);
  let listedRows = toRows(data, false);
  if (JSON.stringify(listedRows) === JSON.stringify(sortedRows))
    listedRows = listedRows.map((x) => ({
      stem: x.stem,
      leaves: [...x.leaves].reverse(),
    }));
  // Leaves out of order must not mark the right plots: a wrong plot is as
  // likely to list its leaves in the order given.
  const scatter = (rows: Rows): Rows =>
    r(0, 1)
      ? rows.map((x) => ({ stem: x.stem, leaves: shuffled(r, x.leaves) }))
      : rows;
  const trues: Rows[] = [sortedRows, listedRows];
  const kTrue = 2;
  const options: { rows: Rows }[] = shuffled(r, [
    ...trues.slice(0, kTrue).map((rows) => ({ rows })),
    ...shuffled(r, wrong)
      .slice(0, 4 - kTrue)
      .map((rows) => ({ rows: scatter(rows) })),
  ]);
  const panels: PanelSpec[] = options.map((o, i) => {
    const lines = o.rows.length;
    const elements: Element[] = o.rows.map((row, j) => ({
      type: "text",
      at: [-2.3, ((lines - 1) / 2 - j) * 0.95],
      text: `${row.stem} | ${row.leaves.join(" ")}`.trim(),
      font: "sans",
      size: "md",
      align: [-1, 0],
    }));
    return { letter: L[i]!, elements };
  });
  const pool = options.map((o, i) =>
    st(
      `Plot $${L[i]}$`,
      same(o.rows),
      same(o.rows)
        ? `Plot $${L[i]}$ lists the same ${n} values as the data.`
        : `Plot $${L[i]}$ reads as ${reading(o.rows).length === n ? "different values" : `${reading(o.rows).length} values`}, so it does not show the data.`,
    ),
  );
  const scene = panelScene({
    title: "Four lettered stem-and-leaf plots",
    panels,
    columns: 2,
    cell: [6, 2.6 + 0.95 * Math.max(...options.map((o) => o.rows.length))],
    width: 320,
    maxHeight: 360,
  });
  return selectModel({
    variant: "four-plots",
    pool,
    total: 4,
    k: pool.filter((p) => p.holds).length,
    ordered: true,
    context: `The data are ${data.map((v) => `$${v}$`).join(", ")}. In each plot, the stem is the tens digit and a leaf is a ones digit, so $2\\mid3$ means $23$.`,
    ask: (m) => `Select the ${m} stem-and-leaf plots that show this data.`,
    one: "plot",
    hint: () =>
      `Read each plot back into numbers: join each stem with each of its leaves. Count the values in the plot, compare with the ${n} values in the list, starting with the least, $${Math.min(...data)}$, and check every number.`,
    figure: { kind: "scene", scene },
  });
}

/* ------------------------------------------------------------ registry */

const families = {
  "shape-sides-select": selectFamily(shapeRelationTemplate, shapeRelation),
  "polygon-sides-select": selectFamily(polygonSidesTemplate, polygonSides),
  "line-pair-select": selectFamily(linePairTemplate, linePair),
  "angle-kind-select": selectFamily(angleKindTemplate, angleKind),
  "symmetry-lines-select": selectFamily(symmetryLineTemplate, symmetryLines),
  "protractor-angles-select": selectFamily(
    protractorAnglesTemplate,
    protractorAngles,
  ),
  "prism-volume-select": selectFamily(prismVolumeTemplate, prismVolume),
  "solid-figure-select": selectFamily(solidFiguresTemplate, solidFigures),
  "stem-leaf-match-select": selectFamily(stemLeafMatchTemplate, stemLeafMatch),
};
export const multiselectFigureFamilies = families;
export const multiselectFigureTemplates = [
  shapeRelationTemplate,
  polygonSidesTemplate,
  linePairTemplate,
  angleKindTemplate,
  symmetryLineTemplate,
  protractorAnglesTemplate,
  prismVolumeTemplate,
  solidFiguresTemplate,
  stemLeafMatchTemplate,
] as const;
export const multiselectFigureGenerate = dispatch(
  multiselectFigureTemplates,
  Object.fromEntries(
    Object.entries(families).map(([id, f]) => [
      id,
      (seed: string): GeneratedProblem =>
        (
          f as { generate: (s: string) => { problem: GeneratedProblem } }
        ).generate(seed).problem,
    ]),
  ),
);
void lineAngle;
