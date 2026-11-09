import { createHash } from "node:crypto";
import { count } from "./agreement";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { scene } from "./scene/author";
import type { Element, FillRole, Scene } from "./scene/spec";
import { serializeSelection } from "./selection-response";

/**
 * Flat or solid (K.G.A.3) and composite shapes (1.G.A.2).
 *
 * Every figure is drawn from scene primitives, never from a named shape
 * component, so its spoken description says what is seen ("an outline with 3
 * straight sides", "a block with square faces") and never the answer. Solids
 * are drawn in one fixed view: x right, y away from the viewer, z up, seen
 * from 25° above (orthographic). Visible faces are filled, the top darkest,
 * and hidden edges are dashed; a sphere is shaded and carries a dashed back
 * line. Composite flat shapes live on a unit lattice: a piece is a set of
 * cell parts (each cell cut by its diagonals into four triangles, or holding
 * one quarter disk), so whether pieces cover a shape exactly is a set
 * comparison, checked by search.
 */

const K2 = "K–2" as const;
const senses = {
  square: "square-shape",
  squares: "square-shape",
  side: "side",
  sides: "side",
  face: "face-solid",
  faces: "face-solid",
};
export const flatSolidComposeTemplates: readonly TemplateMetadata[] = [
  {
    id: "flat-or-solid-name",
    version: 1,
    title: "Flat or solid, and its name",
    skillId: "name-shapes",
    gradeBand: K2,
    description:
      "Say whether one drawn shape is flat or solid, then name it. The name choices include its look-alike: a cube and a square, a sphere and a circle, a cone and a triangle.",
    requiredResponseCapability: "multi-part-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "pick-flat-or-solid",
    version: 1,
    title: "Choose the flat or the solid shapes",
    skillId: "name-shapes",
    gradeBand: K2,
    description:
      "Choose every flat shape, or every solid shape, in a lettered row of 4 to 6 shapes that mixes look-alikes such as a square and a cube.",
    requiredResponseCapability: "multi-select-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "count-flat-or-solid",
    version: 1,
    title: "Count the flat or the solid shapes",
    skillId: "name-shapes",
    gradeBand: K2,
    description:
      "Count how many shapes in a row of 4 to 6 are solid, or how many are flat.",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "composite-shape-name",
    version: 1,
    title: "Name the shape the pieces make",
    skillId: "composite-shapes",
    gradeBand: K2,
    description:
      "Name the new shape that flat pieces make with their sides touching (squares, rectangles, triangles, trapezoids, half-circles and quarter-circles), or the solid that two equal solids make.",
    requiredResponseCapability: "single-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "composite-which-pieces",
    version: 1,
    title: "Choose the pieces that make a shape",
    skillId: "composite-shapes",
    gradeBand: K2,
    description:
      "Choose the set of flat pieces that can be put together to make a shape on a grid. Other sets have pieces of the wrong size, the wrong kind, or one piece too few.",
    requiredResponseCapability: "figure-choice-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
  {
    id: "composite-which-solids",
    version: 1,
    title: "Which solids build this shape",
    skillId: "composite-shapes",
    gradeBand: K2,
    description:
      "Choose the solids (cubes, rectangular prisms, cylinders and cones) that were put together to build a composite solid whose seams show.",
    requiredResponseCapability: "multi-select-v1",
    requiredFigureCapability: "scenes-v1",
    glossarySenses: senses,
  },
];
const metaOf = (id: string) =>
  flatSolidComposeTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------ drawing */

type Pt = [number, number];
type P3 = [number, number, number];
/** The view elevation in degrees. The oracle reads solids with the same view. */
export const ELEVATION = 25;
const SIN = Math.sin((ELEVATION * Math.PI) / 180);
const COS = Math.cos((ELEVATION * Math.PI) / 180);
const r4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
const pt = (x: number, y: number): Pt => [r4(x), r4(y)];
const project = (x: number, y: number, z: number): Pt =>
  pt(x, y * SIN + z * COS);
const turnPoint = (x: number, y: number, deg: number): Pt => {
  const t = (deg * Math.PI) / 180;
  return [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
};
const EDGE = { stroke: "ink" as const, width: 2.5 };
const HIDDEN = { stroke: "ink" as const, width: 1.6, dash: "dash" as const };
const SEAM = { stroke: "muted" as const, width: 1.25 };
function arc(
  c: Pt,
  rx: number,
  ry: number,
  from: number,
  to: number,
  n: number,
): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / n;
    return pt(c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t));
  });
}

type BoxSpec = {
  cx: number;
  cy: number;
  z0: number;
  w: number;
  d: number;
  h: number;
  turn: number;
  /** Seams: a cut at local x = at (across the width) or at height z = at. */
  seams?: { axis: "x" | "z"; at: number }[];
};
/** A box seen from above and in front: visible faces filled and outlined,
 * hidden edges dashed, seams as thin muted lines across visible faces. */
function boxElements(id: string, b: BoxSpec): Element[] {
  const local: Pt[] = [
    [-b.w / 2, -b.d / 2],
    [b.w / 2, -b.d / 2],
    [b.w / 2, b.d / 2],
    [-b.w / 2, b.d / 2],
  ];
  const world = (x: number, y: number, z: number): P3 => {
    const [tx, ty] = turnPoint(x, y, b.turn);
    return [b.cx + tx, b.cy + ty, b.z0 + z];
  };
  const bottom = local.map(([x, y]) => world(x, y, 0));
  const top = local.map(([x, y]) => world(x, y, b.h));
  type Face = { pts: P3[]; n: P3; local: P3[] };
  const faces: Face[] = [
    {
      pts: bottom,
      n: [0, 0, -1],
      local: local.map(([x, y]) => [x, y, 0] as P3),
    },
    {
      pts: top,
      n: [0, 0, 1],
      local: local.map(([x, y]) => [x, y, b.h] as P3),
    },
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const dx = bottom[j]![0] - bottom[i]![0],
      dy = bottom[j]![1] - bottom[i]![1];
    const l = Math.hypot(dx, dy);
    faces.push({
      pts: [bottom[i]!, bottom[j]!, top[j]!, top[i]!],
      n: [dy / l, -dx / l, 0],
      local: [
        [local[i]![0], local[i]![1], 0],
        [local[j]![0], local[j]![1], 0],
        [local[j]![0], local[j]![1], b.h],
        [local[i]![0], local[i]![1], b.h],
      ],
    });
  }
  const facing = (n: P3) => -n[1] * COS + n[2] * SIN;
  const shown = faces.map((f) => facing(f.n) > 1e-9);
  const sides = faces
    .map((f, i) => ({ i, v: facing(f.n) }))
    .filter((f) => f.i >= 2 && shown[f.i]);
  const front = sides.reduce((a, s) => (s.v > a.v ? s : a), sides[0]!).i;
  const fillOf = (i: number): FillRole =>
    i === 1 ? "accent-strong" : i === front ? "accent-fill" : "empty";
  const proj = (p: P3) => project(p[0], p[1], p[2]);
  const out: Element[] = [];
  faces.forEach((f, i) => {
    if (shown[i])
      out.push({
        type: "polygon",
        id: `${id}f${i}`,
        points: f.pts.map(proj),
        fill: fillOf(i),
        ...EDGE,
      });
  });
  // Edges: bottom i (faces 0 and 2+i), top i (1, 2+i), vertical i (2+i−1, 2+i).
  let k = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const prev = 2 + ((i + 3) % 4);
    const edges: [P3, P3, number, number][] = [
      [bottom[i]!, bottom[j]!, 0, 2 + i],
      [top[i]!, top[j]!, 1, 2 + i],
      [bottom[i]!, top[i]!, prev, 2 + i],
    ];
    for (const [a, c, f1, f2] of edges)
      if (!shown[f1] && !shown[f2])
        out.push({
          type: "segment",
          id: `${id}h${k++}`,
          from: proj(a),
          to: proj(c),
          ...HIDDEN,
        });
  }
  (b.seams ?? []).forEach((s, si) => {
    faces.forEach((f, i) => {
      if (!shown[i]) return;
      const value = (p: P3) => (s.axis === "x" ? p[0] : p[2]) - s.at;
      const cut: P3[] = [];
      for (let e = 0; e < 4; e++) {
        const a = f.local[e]!,
          c = f.local[(e + 1) % 4]!;
        const va = value(a),
          vc = value(c);
        if (Math.abs(va) < 1e-9 && Math.abs(vc) < 1e-9) return;
        if ((va < 0 && vc > 0) || (va > 0 && vc < 0) || Math.abs(va) < 1e-9) {
          const t = Math.abs(va) < 1e-9 ? 0 : va / (va - vc);
          cut.push([
            a[0] + (c[0] - a[0]) * t,
            a[1] + (c[1] - a[1]) * t,
            a[2] + (c[2] - a[2]) * t,
          ]);
        }
      }
      if (cut.length !== 2) return;
      out.push({
        type: "segment",
        id: `${id}s${si}${i}`,
        from: proj(world(cut[0]![0], cut[0]![1], cut[0]![2])),
        to: proj(world(cut[1]![0], cut[1]![1], cut[1]![2])),
        ...SEAM,
      });
    });
  });
  return out;
}
type RoundSpec = {
  cx: number;
  cy: number;
  z0: number;
  r: number;
  h: number;
  seams?: number[];
};
function cylinderElements(id: string, c: RoundSpec): Element[] {
  const base = project(c.cx, c.cy, c.z0),
    top = project(c.cx, c.cy, c.z0 + c.h),
    ry = c.r * SIN;
  const front = arc(base, c.r, ry, Math.PI, 2 * Math.PI, 32);
  const topFront = arc(top, c.r, ry, Math.PI, 2 * Math.PI, 32).reverse();
  return [
    {
      type: "polygon",
      id: `${id}s`,
      points: [...front, ...topFront],
      fill: "accent-fill",
      ...EDGE,
    },
    {
      type: "polygon",
      id: `${id}t`,
      points: arc(top, c.r, ry, 0, 2 * Math.PI, 64).slice(0, -1),
      fill: "accent-strong",
      ...EDGE,
    },
    {
      type: "polyline",
      id: `${id}b`,
      points: arc(base, c.r, ry, 0, Math.PI, 32),
      ...HIDDEN,
    },
    ...(c.seams ?? []).map((z, i): Element => ({
      type: "polyline",
      id: `${id}m${i}`,
      points: arc(
        project(c.cx, c.cy, c.z0 + z),
        c.r,
        ry,
        Math.PI,
        2 * Math.PI,
        32,
      ),
      ...SEAM,
    })),
  ];
}
function coneElements(id: string, c: RoundSpec): Element[] {
  const base = project(c.cx, c.cy, c.z0),
    apex = project(c.cx, c.cy, c.z0 + c.h),
    ry = c.r * SIN;
  const H = apex[1] - base[1];
  const t1 = Math.asin(Math.min(1, ry / H)),
    t2 = Math.PI - t1;
  return [
    {
      type: "polygon",
      id: `${id}s`,
      points: [apex, ...arc(base, c.r, ry, t2, 2 * Math.PI + t1, 40)],
      fill: "accent-fill",
      ...EDGE,
    },
    {
      type: "polyline",
      id: `${id}b`,
      points: arc(base, c.r, ry, t1, t2, 24),
      ...HIDDEN,
    },
  ];
}
function sphereElements(
  id: string,
  c: { cx: number; cy: number; z0: number; r: number },
): Element[] {
  const ground = project(c.cx, c.cy, c.z0),
    center = project(c.cx, c.cy, c.z0 + c.r),
    ry = c.r * SIN;
  return [
    {
      type: "polygon",
      id: `${id}g`,
      points: arc(ground, c.r * 0.95, c.r * 0.95 * SIN, 0, 2 * Math.PI, 48)
        .slice(0, -1)
        .map(([x, y]) => pt(x, y - c.r * 0.08)),
      fill: "ink",
      opacity: 0.12,
      stroke: "paper",
      width: 0.5,
    },
    {
      type: "circle",
      id: `${id}o`,
      center,
      r: r4(c.r),
      fill: "accent-fill",
      ...EDGE,
    },
    {
      type: "polyline",
      id: `${id}b`,
      points: arc(center, c.r, ry, 0, Math.PI, 32),
      ...HIDDEN,
    },
    {
      type: "polyline",
      id: `${id}e`,
      points: arc(center, c.r, ry, Math.PI, 2 * Math.PI, 32),
      stroke: "ink",
      width: 1.8,
    },
    {
      type: "circle",
      id: `${id}l`,
      center: pt(center[0] - 0.38 * c.r, center[1] + 0.4 * c.r),
      r: r4(0.24 * c.r),
      fill: "paper",
      opacity: 0.6,
      stroke: "paper",
      width: 0.5,
    },
  ];
}

/** Every coordinate of a drawn element, for bounds. */
function pointsOf(e: Element): Pt[] {
  switch (e.type) {
    case "polygon":
    case "polyline":
      return e.points as Pt[];
    case "segment":
      return [e.from as Pt, e.to as Pt];
    case "circle":
      return [
        [e.center[0] - e.r, e.center[1] - e.r],
        [e.center[0] + e.r, e.center[1] + e.r],
      ];
    case "rect":
      return [e.at as Pt, [e.at[0] + e.size[0], e.at[1] + e.size[1]]];
    default:
      return [];
  }
}
function boundsOf(elements: Element[]) {
  const all = elements.flatMap(pointsOf);
  return {
    x0: Math.min(...all.map((p) => p[0])),
    x1: Math.max(...all.map((p) => p[0])),
    y0: Math.min(...all.map((p) => p[1])),
    y1: Math.max(...all.map((p) => p[1])),
  };
}
function shift(elements: Element[], dx: number, dy: number): Element[] {
  const m = (p: readonly number[]): Pt => pt(p[0]! + dx, p[1]! + dy);
  return elements.map((e): Element => {
    switch (e.type) {
      case "polygon":
      case "polyline":
        return { ...e, points: e.points.map(m) };
      case "segment":
        return { ...e, from: m(e.from), to: m(e.to) };
      case "circle":
        return { ...e, center: m(e.center) };
      case "rect":
      case "text":
        return { ...e, at: m(e.at) };
      default:
        return e;
    }
  });
}

/* ------------------------------------------------- flat or solid (K) */

const FLAT_KINDS = [
  "circle",
  "triangle",
  "square",
  "rectangle",
  "hexagon",
] as const;
const SOLID_KINDS = ["cube", "box", "cylinder", "cone", "sphere"] as const;
type FlatKind = (typeof FLAT_KINDS)[number];
type SolidKind = (typeof SOLID_KINDS)[number];
type Kind = FlatKind | SolidKind;
const isSolid = (k: Kind): k is SolidKind =>
  (SOLID_KINDS as readonly string[]).includes(k);
/** Names said to a kindergarten learner. A box is drawn in rows but never
 * named: K.G.A.2 names cubes, cones, cylinders and spheres. */
const NAME: Record<Kind, string> = {
  circle: "circle",
  triangle: "triangle",
  square: "square",
  rectangle: "rectangle",
  hexagon: "hexagon",
  cube: "cube",
  box: "rectangular prism",
  cylinder: "cylinder",
  cone: "cone",
  sphere: "sphere",
};
/** Look-alike pairs: the flat shape a solid's face or side view shows. */
export const LOOKALIKES: readonly (readonly [FlatKind, SolidKind])[] = [
  ["square", "cube"],
  ["rectangle", "box"],
  ["circle", "sphere"],
  ["circle", "cylinder"],
  ["triangle", "cone"],
];
type Pose = {
  turn: number;
  form?: "acute" | "right" | "obtuse";
  tall?: boolean;
};
type Drawn = { kind: Kind; size: number; pose: Pose; filled: boolean };
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");

/** A pose; `odd` asks for a non-prototypical one: a square turned at least
 * 15°, a triangle that does not point up, a tall rectangle, a hexagon that
 * stands on a corner. */
function poseOf(r: Random, kind: Kind, odd: boolean): Pose {
  switch (kind) {
    case "square":
      return {
        turn: odd
          ? pick(r, [15, 20, 30, 40, 45])
          : pick(r, [0, 10, 15, 20, 30, 40, 45]),
      };
    case "triangle":
      return {
        form: pick(r, ["acute", "right", "obtuse"] as const),
        turn:
          (odd ? pick(r, [90, 180, 270]) : pick(r, [0, 90, 180, 270])) +
          pick(r, [-8, 0, 8]),
      };
    case "rectangle": {
      const tall = odd ? true : r(0, 1) === 1;
      return {
        tall,
        turn: (tall ? 90 : 0) + pick(r, [0, 0, 15, 25, -15, -25]),
      };
    }
    case "hexagon":
      return { turn: odd ? 30 : pick(r, [0, 15, 30]) };
    case "cube":
    case "box":
      return { turn: pick(r, [20, 30, 40, 50, 60]), tall: r(0, 1) === 1 };
    default:
      return { turn: 0 };
  }
}
const ROUND = (n: number, radius: number, start: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = ((start + (360 * i) / n) * Math.PI) / 180;
    return [radius * Math.cos(t), radius * Math.sin(t)] as Pt;
  });
function posed(points: Pt[], turn: number, scale: number): Pt[] {
  const cx = points.reduce((a, p) => a + p[0], 0) / points.length,
    cy = points.reduce((a, p) => a + p[1], 0) / points.length;
  return points.map(([x, y]) => {
    const [tx, ty] = turnPoint((x - cx) * scale, (y - cy) * scale, turn);
    return pt(tx, ty);
  });
}
/** One shape's elements, centered near the origin. */
function drawShape(id: string, s: Drawn): Element[] {
  const f = s.size;
  const flat = (points: Pt[]): Element[] => [
    {
      type: "polygon",
      id: `${id}p`,
      points,
      fill: s.filled ? "accent-fill" : "none",
      stroke: "ink",
      width: 3,
    },
  ];
  switch (s.kind) {
    case "circle":
      return [
        {
          type: "circle",
          id: `${id}p`,
          center: [0, 0],
          r: r4(0.85 * f),
          fill: s.filled ? "accent-fill" : "none",
          stroke: "ink",
          width: 3,
        },
      ];
    case "triangle": {
      const base: Pt[] =
        s.pose.form === "right"
          ? [
              [-0.9, 0],
              [0.9, 0],
              [-0.9, 1.35],
            ]
          : s.pose.form === "obtuse"
            ? [
                [-0.9, 0],
                [0.7, 0],
                [1.15, 1.1],
              ]
            : [
                [-0.85, 0],
                [0.85, 0],
                [0.15, 1.45],
              ];
      return flat(posed(base, s.pose.turn, f));
    }
    case "square":
      return flat(
        posed(
          [
            [0, 0],
            [1.5, 0],
            [1.5, 1.5],
            [0, 1.5],
          ],
          s.pose.turn,
          f,
        ),
      );
    case "rectangle":
      return flat(
        posed(
          [
            [0, 0],
            [2, 0],
            [2, 1.05],
            [0, 1.05],
          ],
          s.pose.turn,
          f,
        ),
      );
    case "hexagon":
      return flat(posed(ROUND(6, 0.95, 0), s.pose.turn, f));
    case "cube":
      return boxElements(id, {
        cx: 0,
        cy: 0,
        z0: 0,
        w: 1.3 * f,
        d: 1.3 * f,
        h: 1.3 * f,
        turn: s.pose.turn,
      });
    case "box":
      return boxElements(
        id,
        s.pose.tall
          ? {
              cx: 0,
              cy: 0,
              z0: 0,
              w: 0.95 * f,
              d: 0.95 * f,
              h: 1.9 * f,
              turn: s.pose.turn,
            }
          : {
              cx: 0,
              cy: 0,
              z0: 0,
              w: 1.9 * f,
              d: 0.95 * f,
              h: 1.0 * f,
              turn: s.pose.turn,
            },
      );
    case "cylinder":
      return cylinderElements(id, {
        cx: 0,
        cy: 0,
        z0: 0,
        r: 0.65 * f,
        h: 1.5 * f,
      });
    case "cone":
      return coneElements(id, { cx: 0, cy: 0, z0: 0, r: 0.75 * f, h: 1.6 * f });
    case "sphere":
      return sphereElements(id, { cx: 0, cy: 0, z0: 0, r: 0.85 * f });
  }
}
/** What a sighted learner sees, without the shape's name or kind. */
const SEEN: Record<Kind, string> = {
  circle: "a round outline",
  triangle: "an outline with 3 straight sides",
  square: "an outline with 4 sides of the same length",
  rectangle: "an outline with 4 sides, 2 long and 2 short",
  hexagon: "an outline with 6 straight sides",
  cube: "a block with all its faces the same size and dashed hidden edges",
  box: "a block longer one way than another, with dashed hidden edges",
  cylinder: "a can shape with a round top and a dashed back edge",
  cone: "a round bottom rising to a point, with a dashed back edge",
  sphere: "a shaded ball with a dashed line around its back",
};
const LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const CELL_W = 3.8,
  CELL_H = 4.1;
/** A row of shapes in cells, three to a row when there are five or six, so
 * a phone shows two rows of three. Lettered rows carry a letter per cell. */
function rowScene(shapes: Drawn[], lettered: boolean): Scene {
  const n = shapes.length,
    cols = n <= 4 ? n : 3;
  const elements: Element[] = [];
  shapes.forEach((s, i) => {
    const col = i % cols,
      row = Math.floor(i / cols);
    const x0 = col * CELL_W,
      y1 = -row * CELL_H,
      y0 = y1 - CELL_H;
    elements.push({
      type: "rect",
      id: `c${i}box`,
      at: pt(x0 + 0.08, y0 + 0.08),
      size: [CELL_W - 0.16, CELL_H - 0.16],
      radius: 10,
      stroke: "grid",
      width: 1.25,
      fill: "none",
    });
    if (lettered)
      elements.push({
        type: "text",
        id: `c${i}tag`,
        at: pt(x0 + 0.2, y1 - 0.2),
        text: LETTERS[i]!,
        font: "sans",
        bold: true,
        align: [-1, -1],
      });
    const drawn = drawShape(`c${i}`, s);
    const b = boundsOf(drawn);
    const top = lettered ? 0.55 : 0.15;
    elements.push(
      ...shift(
        drawn,
        x0 + CELL_W / 2 - (b.x0 + b.x1) / 2,
        (y0 + 0.15 + y1 - top) / 2 - (b.y0 + b.y1) / 2,
      ),
    );
  });
  const said = shapes
    .map((s, i) => `${lettered ? LETTERS[i] : i + 1}: ${SEEN[s.kind]}.`)
    .join(" ");
  return scene(...elements).build({
    title: lettered
      ? `${n} shapes in boxes labeled A to ${LETTERS[n - 1]}`
      : `A row of ${n} shapes`,
    note: said,
  });
}
function singleScene(s: Drawn): Scene {
  const drawn = drawShape("c0", s);
  const b = boundsOf(drawn);
  // A fixed stage keeps every shape at one scale.
  const stage: Element = {
    type: "rect",
    id: "c0box",
    at: [-CELL_W / 2, -CELL_H / 2],
    size: [CELL_W, CELL_H],
    radius: 10,
    stroke: "grid",
    width: 1.25,
    fill: "none",
  };
  return scene(
    stage,
    ...shift(drawn, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2),
  ).build({
    title: "One shape",
    note: `It is ${SEEN[s.kind]}.`,
    width: 280,
  });
}
/** A size for each shape, ±30% around 1. The largest shape is flat in about
 * half of the mixed rows, so size never tells flat from solid. */
function sizes(r: Random, kinds: Kind[]): number[] {
  const out = kinds.map(() => 0.7 + r(0, 10) * 0.05);
  const flats = kinds.flatMap((k, i) => (isSolid(k) ? [] : [i]));
  const solids = kinds.flatMap((k, i) => (isSolid(k) ? [i] : []));
  if (flats.length && solids.length) {
    const big = pick(r, r(0, 1) ? flats : solids);
    out[big] = 1.3;
    out.forEach((v, i) => {
      if (i !== big && v >= 1.3) out[i] = 1.25;
    });
  }
  return out;
}
const flatWord = (solid: boolean) => (solid ? "solid" : "flat");

/** A row of distinct kinds with `asked` of class `solid` and the rest of
 * the other class. `mustPairs` look-alike pairs are both present. */
function rowKinds(
  r: Random,
  n: number,
  askedSolid: boolean,
  asked: number,
  mustPairs: number,
  exclude: readonly Kind[] = [],
): Kind[] {
  const usable = (k: Kind) => !exclude.includes(k);
  const solids: Kind[] = [...SOLID_KINDS],
    flats: Kind[] = [...FLAT_KINDS];
  const askedPool = (askedSolid ? solids : flats).filter(usable);
  const otherPool = (askedSolid ? flats : solids).filter(usable);
  const chosenAsked: Kind[] = [],
    chosenOther: Kind[] = [];
  const pairs = shuffle(r, [...LOOKALIKES]);
  let made = 0;
  for (const [fl, so] of pairs) {
    if (made >= mustPairs) break;
    if (!usable(fl) || !usable(so)) continue;
    const a: Kind = askedSolid ? so : fl,
      o: Kind = askedSolid ? fl : so;
    const needA = !chosenAsked.includes(a),
      needO = !chosenOther.includes(o);
    if (chosenAsked.length + Number(needA) > asked) continue;
    if (chosenOther.length + Number(needO) > n - asked) continue;
    if (needA) chosenAsked.push(a);
    if (needO) chosenOther.push(o);
    made++;
  }
  if (made < mustPairs) throw new Need("room for the look-alike pairs");
  for (const k of shuffle(r, askedPool))
    if (chosenAsked.length < asked && !chosenAsked.includes(k))
      chosenAsked.push(k);
  for (const k of shuffle(r, otherPool))
    if (chosenOther.length < n - asked && !chosenOther.includes(k))
      chosenOther.push(k);
  if (chosenAsked.length !== asked || chosenOther.length !== n - asked)
    throw new Need("enough distinct shapes");
  return shuffle(r, [...chosenAsked, ...chosenOther]);
}
/** Look-alike pairs with both members in the row. */
export function pairsIn(kinds: readonly Kind[]) {
  return LOOKALIKES.filter(
    ([fl, so]) => kinds.includes(fl) && kinds.includes(so),
  );
}
function drawRow(r: Random, kinds: Kind[], oddFlats: boolean): Drawn[] {
  const filled = r(0, 1) === 1;
  const sz = sizes(r, kinds);
  return kinds.map((kind, i) => ({
    kind,
    size: sz[i]!,
    pose: poseOf(r, kind, oddFlats && !isSolid(kind)),
    filled,
  }));
}
const SEEN_CLAUSE: Record<Kind, string> = {
  circle: "it is a circle. You see only its front, so it is flat",
  triangle: "it is a triangle. You see only its front, so it is flat",
  square: "it is a square. You see only its front, so it is flat",
  rectangle: "it is a rectangle. You see only its front, so it is flat",
  hexagon: "it is a hexagon. You see only its front, so it is flat",
  cube: "it is a cube. You see its sides too, so it is solid",
  box: "it is a box shape, a rectangular prism. You see its sides too, so it is solid",
  cylinder: "it is a cylinder. You see its curved side too, so it is solid",
  cone: "it is a cone. You see its curved side too, so it is solid",
  sphere: "it is a sphere, round every way like a ball, so it is solid",
};

type Built = {
  prompt: string;
  response: GeneratedProblem["public"]["response"];
  answer: string;
  hint: string;
  explanation: string[];
  figure?: Scene;
  choiceFeedback?: Record<string, string>;
  variant: string;
};

function flatOrSolidName(r: Random): Built {
  const roll = r(1, 100);
  const variant =
    roll <= 45
      ? "solid-with-lookalike"
      : roll <= 90
        ? "flat-with-lookalike"
        : "flat-circle-vs-round-solids";
  const K_SOLIDS: SolidKind[] = ["cube", "cylinder", "cone", "sphere"];
  let kind: Kind;
  let names: string[];
  let look: string | undefined;
  if (variant === "solid-with-lookalike") {
    const k = pick(r, K_SOLIDS);
    kind = k;
    const flatLook: FlatKind =
      k === "cube"
        ? "square"
        : k === "sphere"
          ? "circle"
          : k === "cone"
            ? "triangle"
            : pick(r, ["circle", "rectangle"] as const);
    look = flatLook;
    const otherSolid = pick(
      r,
      K_SOLIDS.filter((s) => s !== k),
    );
    const otherFlat = pick(
      r,
      FLAT_KINDS.filter((f) => f !== flatLook),
    );
    names = [NAME[k], flatLook, NAME[otherSolid], otherFlat];
  } else if (variant === "flat-with-lookalike") {
    const k = pick(r, FLAT_KINDS);
    kind = k;
    const solidLook: SolidKind | undefined =
      k === "square"
        ? "cube"
        : k === "rectangle"
          ? "cylinder"
          : k === "triangle"
            ? "cone"
            : k === "circle"
              ? pick(r, ["sphere", "cylinder"] as const)
              : undefined;
    look = solidLook;
    const otherFlat = pick(
      r,
      FLAT_KINDS.filter(
        (f) => f !== k && !(k === "square" && f === "rectangle"),
      ),
    );
    const solidsLeft = shuffle(
      r,
      K_SOLIDS.filter((s) => s !== solidLook),
    );
    names = solidLook
      ? [k, solidLook, otherFlat, solidsLeft[0]!]
      : [k, otherFlat, solidsLeft[0]!, solidsLeft[1]!];
  } else {
    kind = "circle";
    look = pick(r, ["sphere", "cylinder"] as const);
    names = ["circle", "sphere", "cylinder", "cone"];
  }
  const drawn: Drawn = {
    kind,
    size: 1,
    pose: poseOf(r, kind, variant !== "solid-with-lookalike"),
    filled: r(0, 1) === 1,
  };
  const solid = isSolid(kind);
  const kindOptions = shuffle(r, ["flat", "solid"]).map((label, i) => ({
    id: "ab"[i]!,
    label,
  }));
  const nameOptions = shuffle(r, [...names]).map((label, i) => ({
    id: "abcd"[i]!,
    label,
  }));
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each part",
    layout: "slots",
    blanks: [
      {
        id: "kind",
        label: "Is this shape flat or solid?",
        options: kindOptions,
      },
      { id: "name", label: "What is its name?", options: nameOptions },
    ],
  };
  const answer = serializeMultiPart(response, {
    kind: kindOptions.find((o) => o.label === flatWord(solid))!.id,
    name: nameOptions.find((o) => o.label === NAME[kind])!.id,
  });
  const name = NAME[kind];
  const pair = shuffle(r, [name, look ?? names[1]!]);
  const first = solid
    ? kind === "sphere"
      ? "Look at the shape. It is round every way, like a ball. It takes up room, so it is solid."
      : kind === "cube"
        ? "Look at the shape. You can see its front, its top and a side, like a block. It takes up room, so it is solid."
        : "Look at the shape. You can see its round top or bottom and its curved side, like a can or a party hat. It takes up room, so it is solid."
    : "Look at the shape. You can see only its front, with nothing coming toward you, so it is flat. You could trace all of it on the page with your finger.";
  const second: Record<Kind, string> = {
    cube: "A solid can have flat faces. This one has squares on its faces, but it is not a square. It is a cube.",
    cylinder:
      "Its two flat ends are circles, but the whole shape is not a circle. It has a curved side between the ends. It is a cylinder.",
    cone: "Its flat bottom is a circle, and its curved side comes to a point. From the side it can look like a triangle, but it is a cone.",
    sphere:
      "A sphere can look like a circle on the page. A circle is flat, but a ball is not flat. It is a sphere.",
    box: "It is a rectangular prism.",
    square:
      "It has 4 sides of the same length and 4 square corners, so it is a square, even turned. It is only a square: if it were a cube, you would see its sides too.",
    rectangle:
      "It has 4 straight sides, 2 long and 2 short, and 4 square corners, so it is a rectangle, even standing tall. A cylinder seen from the side looks like this, but this shape shows no curved side.",
    triangle:
      "It has 3 straight sides and 3 corners, so it is a triangle, whichever way it points. A cone would show a round bottom too.",
    circle:
      "It is round with no corners, and it is flat, so it is a circle. A sphere or a cylinder would show more than a flat front.",
    hexagon:
      "It has 6 straight sides and 6 corners, so it is a hexagon, whichever way it is turned.",
  };
  return {
    variant,
    prompt: "Look at this shape. Is it flat or solid? What is its name?",
    response,
    answer,
    figure: singleScene(drawn),
    hint: `Could this shape lie flat on the page, or could it stand on a table and take up room? Then choose its name: is it ${article(pair[0]!)} ${pair[0]} or ${article(pair[1]!)} ${pair[1]}?`,
    explanation: [
      first,
      second[kind],
      "Flat shapes: circle, triangle, square, rectangle, hexagon. Solid shapes: cube, cylinder, cone, sphere.",
    ],
  };
}

function pickFlatOrSolid(r: Random): Built {
  const roll = r(1, 100);
  const variant =
    roll <= 30
      ? "even-split"
      : roll <= 75
        ? "lookalike-pair"
        : roll <= 90
          ? "all-but-one"
          : "turned-flats";
  const askedSolid = variant === "turned-flats" ? false : r(0, 1) === 1;
  const n = variant === "even-split" ? pick(r, [4, 6]) : r(4, 6);
  const asked =
    variant === "even-split"
      ? n / 2
      : variant === "all-but-one"
        ? n - 1
        : variant === "turned-flats"
          ? r(2, Math.min(n - 1, 4))
          : r(2, n - 1);
  let kinds: Kind[];
  if (variant === "all-but-one") {
    // The lone shape is the look-alike of one of the chosen shapes.
    kinds = rowKinds(r, n, askedSolid, asked, 1);
  } else if (variant === "turned-flats") {
    // A circle has no turned form, so a turned-flats row has none.
    kinds = rowKinds(r, n, askedSolid, asked, 0, ["circle"]);
  } else
    kinds = rowKinds(
      r,
      n,
      askedSolid,
      asked,
      variant === "lookalike-pair" ? 1 : 0,
    );
  const shapes = drawRow(r, kinds, variant === "turned-flats");
  const words = flatWord(askedSolid);
  const softer = r(1, 10) <= 3;
  const prompt = softer
    ? askedSolid
      ? "Which shapes could stand on a table and take up room?"
      : "Which shapes could lie flat on the page?"
    : `Which shapes are ${words}?`;
  const options = kinds.map((_, i) => ({
    id: `option-${"abcdef"[i]}`,
    label: LETTERS[i]!,
  }));
  const chosen = kinds.flatMap((k, i) =>
    isSolid(k) === askedSolid ? [options[i]!.id] : [],
  );
  const lonely =
    variant === "all-but-one"
      ? kinds.find((k) => isSolid(k) !== askedSolid)!
      : undefined;
  const pairs = pairsIn(kinds);
  const pairLine = pairs.length
    ? (() => {
        const [fl, so] = pairs[0]!;
        const lf = LETTERS[kinds.indexOf(fl)]!,
          ls = LETTERS[kinds.indexOf(so)]!;
        return `Shapes ${lf} and ${ls} look alike, but ${ls} is ${article(NAME[so])} ${NAME[so]} and you can see its sides, so it is solid. Shape ${lf} is ${article(fl)} ${fl}, only a front, so it is flat.`;
      })()
    : undefined;
  return {
    variant,
    prompt,
    response: {
      kind: "multi-select",
      label: `Choose ${count(asked, "shape")}`,
      options,
      selectionCount: asked,
    },
    answer: serializeSelection(chosen),
    figure: rowScene(shapes, true),
    hint: `Start with shape A: can you see its sides, or only its front? Then check every shape from B to ${LETTERS[n - 1]} the same way, and choose the ${words} ones.`,
    explanation: [
      `We want the ${words} shapes. A flat shape shows only its front. A solid shape takes up room, so you can see its sides too.`,
      ...kinds.map((k, i) => `Shape ${LETTERS[i]}: ${SEEN_CLAUSE[k]}.`),
      ...(pairLine ? [pairLine] : []),
      ...(lonely
        ? [
            `Only one shape is not ${words}: shape ${LETTERS[kinds.indexOf(lonely)]}.`,
          ]
        : []),
      `The ${words} shapes are ${listOf(chosen.map((id) => LETTERS[options.findIndex((o) => o.id === id)]!))}.`,
    ],
  };
}
const listOf = (items: string[]) =>
  items.length < 2
    ? items.join("")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

function countFlatOrSolid(r: Random): Built {
  const variant = r(1, 100) <= 60 ? "mixed" : "lookalike-heavy";
  const askedSolid = r(0, 1) === 1;
  let kinds: Kind[];
  if (variant === "mixed") {
    const n = r(4, 6);
    kinds = rowKinds(r, n, askedSolid, r(1, n - 1), 0);
  } else {
    const n = pick(r, [4, 6]);
    // Two or three look-alike pairs, then fill; the count follows.
    const pairs = shuffle(r, [...LOOKALIKES]);
    const set: Kind[] = [];
    let made = 0;
    for (const [fl, so] of pairs) {
      const add = [fl, so].filter((k) => !set.includes(k));
      if (set.length + add.length > n) continue;
      set.push(...add);
      made++;
      if (made >= (n === 6 ? r(2, 3) : 2)) break;
    }
    const rest = shuffle(r, [...FLAT_KINDS, ...SOLID_KINDS] as Kind[]).filter(
      (k) => !set.includes(k),
    );
    while (set.length < n) set.push(rest.shift()!);
    kinds = shuffle(r, set);
    if (pairsIn(kinds).length < 2) throw new Need("two look-alike pairs");
  }
  const shapes = drawRow(r, kinds, false);
  const words = flatWord(askedSolid);
  const answer = kinds.filter((k) => isSolid(k) === askedSolid).length;
  let running = 0;
  const walk = kinds.map((k) => {
    const hit = isSolid(k) === askedSolid;
    if (hit) running++;
    return `${NAME[k]}, ${flatWord(isSolid(k))}${hit ? `, ${running}` : ""}`;
  });
  return {
    variant,
    prompt: `How many of these shapes are ${words}?`,
    response: {
      kind: "number",
      label: `${words === "solid" ? "Solid" : "Flat"} shapes`,
    },
    answer: String(answer),
    figure: rowScene(shapes, false),
    hint: `Point to each of the ${kinds.length} shapes in turn. Say "flat" or "solid" for each one, and count only the ${words} ones.`,
    explanation: [
      `Point to each shape and say flat or solid. A flat shape shows only its front. A solid shape shows its sides too.`,
      `${walk.join("; ")}.`,
      `There ${answer === 1 ? "is" : "are"} ${count(answer, `${words} shape`)}.`,
    ],
  };
}

/* ------------------------------------------- composite shapes (grade 1) */

/** A cell part: one of the four triangles a cell's diagonals cut (S, E, N,
 * W) or one quarter disk of radius 1 centered on a corner (qSW …). */
type Part = "S" | "E" | "N" | "W" | "qSW" | "qSE" | "qNE" | "qNW";
type Atom = string; // "x,y,part"
const ROT: Record<Part, Part> = {
  S: "E",
  E: "N",
  N: "W",
  W: "S",
  qSW: "qSE",
  qSE: "qNE",
  qNE: "qNW",
  qNW: "qSW",
};
const FLIP: Record<Part, Part> = {
  S: "S",
  N: "N",
  E: "W",
  W: "E",
  qSW: "qSE",
  qSE: "qSW",
  qNE: "qNW",
  qNW: "qNE",
};
export type PieceId = "S" | "R2" | "R3" | "T1" | "T2" | "RT" | "IT" | "Q" | "H";
const FULL: Part[] = ["S", "E", "N", "W"];
const cells = (list: [number, number, Part[]][]): Atom[] =>
  list.flatMap(([x, y, parts]) => parts.map((p) => `${x},${y},${p}`));
const quarter = (cx: number, cy: number, from: number, to: number): Pt[] =>
  arc([cx, cy], 1, 1, from, to, 16);
const PIECES: Record<PieceId, { noun: string; outline: Pt[]; atoms: Atom[] }> =
  {
    S: {
      noun: "square",
      outline: [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      atoms: cells([[0, 0, FULL]]),
    },
    R2: {
      noun: "rectangle",
      outline: [
        [0, 0],
        [2, 0],
        [2, 1],
        [0, 1],
      ],
      atoms: cells([
        [0, 0, FULL],
        [1, 0, FULL],
      ]),
    },
    R3: {
      noun: "rectangle",
      outline: [
        [0, 0],
        [3, 0],
        [3, 1],
        [0, 1],
      ],
      atoms: cells([
        [0, 0, FULL],
        [1, 0, FULL],
        [2, 0, FULL],
      ]),
    },
    T1: {
      noun: "triangle",
      outline: [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      atoms: cells([[0, 0, ["S", "W"]]]),
    },
    T2: {
      noun: "triangle",
      outline: [
        [0, 0],
        [2, 0],
        [0, 2],
      ],
      atoms: cells([
        [0, 0, FULL],
        [1, 0, ["S", "W"]],
        [0, 1, ["S", "W"]],
      ]),
    },
    RT: {
      noun: "trapezoid",
      outline: [
        [0, 0],
        [2, 0],
        [1, 1],
        [0, 1],
      ],
      atoms: cells([
        [0, 0, FULL],
        [1, 0, ["S", "W"]],
      ]),
    },
    IT: {
      noun: "trapezoid",
      outline: [
        [0, 0],
        [3, 0],
        [2, 1],
        [1, 1],
      ],
      atoms: cells([
        [0, 0, ["S", "E"]],
        [1, 0, FULL],
        [2, 0, ["S", "W"]],
      ]),
    },
    Q: {
      noun: "quarter-circle",
      outline: [[0, 0], ...quarter(0, 0, 0, Math.PI / 2)],
      atoms: ["0,0,qSW"],
    },
    H: {
      noun: "half-circle",
      outline: arc([1, 0], 1, 1, 0, Math.PI, 32),
      atoms: ["0,0,qSE", "1,0,qSW"],
    },
  };
type Placement = {
  p: PieceId;
  rot: 0 | 1 | 2 | 3;
  flip?: boolean;
  at: [number, number];
};
function placePoint([x, y]: Pt, pl: Placement): Pt {
  let X = pl.flip ? -x : x,
    Y = y;
  for (let i = 0; i < pl.rot; i++) [X, Y] = [-Y, X];
  return pt(X + pl.at[0], Y + pl.at[1]);
}
function moveAtom(
  atom: Atom,
  rot: number,
  flip: boolean,
  at: [number, number],
): Atom {
  const [xs, ys, p] = atom.split(",") as [string, string, Part];
  let x = Number(xs),
    y = Number(ys),
    part = p;
  if (flip) {
    x = -x - 1;
    part = FLIP[part];
  }
  for (let i = 0; i < rot; i++) {
    [x, y] = [-y - 1, x];
    part = ROT[part];
  }
  return `${x + at[0]},${y + at[1]},${part}`;
}
const placeAtoms = (pl: Placement) =>
  PIECES[pl.p].atoms.map((a) => moveAtom(a, pl.rot, !!pl.flip, pl.at));
/** The atoms a recipe covers, or null when two pieces overlap. */
export function cover(recipe: readonly Placement[]): Set<Atom> | null {
  const seen = new Set<Atom>();
  const curvedCell = new Map<string, number>();
  for (const pl of recipe)
    for (const a of placeAtoms(pl)) {
      if (seen.has(a)) return null;
      seen.add(a);
    }
  for (const a of seen) {
    const cell = a.slice(0, a.lastIndexOf(","));
    curvedCell.set(
      cell,
      (curvedCell.get(cell) ?? 0) + (a.includes(",q") ? 10 : 1),
    );
  }
  for (const v of curvedCell.values()) if (v > 10) return null;
  return seen;
}
type FlatName =
  | "square"
  | "rectangle"
  | "triangle"
  | "trapezoid"
  | "hexagon"
  | "half-circle"
  | "circle";
type Target = {
  id: string;
  name: FlatName;
  outline: Pt[];
  /** Straight sides and corners of the outline (curves: 0 corners). */
  corners: number;
  recipes: Placement[][];
};
const pl = (
  p: PieceId,
  rot: 0 | 1 | 2 | 3,
  x: number,
  y: number,
): Placement => ({ p, rot, at: [x, y] });
/** The recipe library (spec 1.G.A.2 §2): each recipe covers its target
 * exactly. The spec's "S+S+T1+T1" for the 2 by 2 square has area 3, not 4,
 * so it is left out. */
export const TARGETS: readonly Target[] = [
  {
    id: "unit-square",
    name: "square",
    corners: 4,
    outline: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    recipes: [[pl("T1", 0, 0, 0), pl("T1", 2, 1, 1)]],
  },
  {
    id: "rectangle-2-1",
    name: "rectangle",
    corners: 4,
    outline: [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
    ],
    recipes: [
      [pl("S", 0, 0, 0), pl("S", 0, 1, 0)],
      [pl("S", 0, 0, 0), pl("T1", 0, 1, 0), pl("T1", 2, 2, 1)],
    ],
  },
  {
    id: "square-2-2",
    name: "square",
    corners: 4,
    outline: [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ],
    recipes: [
      [pl("S", 0, 0, 0), pl("S", 0, 1, 0), pl("S", 0, 0, 1), pl("S", 0, 1, 1)],
      [pl("R2", 0, 0, 0), pl("R2", 0, 0, 1)],
      [pl("T2", 0, 0, 0), pl("T2", 2, 2, 2)],
    ],
  },
  {
    id: "rectangle-3-1",
    name: "rectangle",
    corners: 4,
    outline: [
      [0, 0],
      [3, 0],
      [3, 1],
      [0, 1],
    ],
    recipes: [
      [pl("S", 0, 0, 0), pl("S", 0, 1, 0), pl("S", 0, 2, 0)],
      [pl("R2", 0, 0, 0), pl("S", 0, 2, 0)],
    ],
  },
  {
    id: "big-triangle",
    name: "triangle",
    corners: 3,
    outline: [
      [0, 0],
      [2, 0],
      [0, 2],
    ],
    recipes: [
      [pl("S", 0, 0, 0), pl("T1", 0, 1, 0), pl("T1", 0, 0, 1)],
      [
        pl("T1", 0, 0, 0),
        pl("T1", 2, 1, 1),
        pl("T1", 0, 1, 0),
        pl("T1", 0, 0, 1),
      ],
    ],
  },
  {
    id: "turned-triangle",
    name: "triangle",
    corners: 3,
    outline: [
      [-1, 1],
      [0, 0],
      [1, 1],
    ],
    recipes: [[pl("T1", 3, 0, 1), pl("T1", 2, 0, 1)]],
  },
  {
    id: "turned-square",
    name: "square",
    corners: 4,
    outline: [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ],
    recipes: [
      [
        pl("T1", 0, 0, 0),
        pl("T1", 1, 0, 0),
        pl("T1", 2, 0, 0),
        pl("T1", 3, 0, 0),
      ],
    ],
  },
  {
    id: "trapezoid-2-1",
    name: "trapezoid",
    corners: 4,
    outline: [
      [0, 0],
      [2, 0],
      [1, 1],
      [0, 1],
    ],
    recipes: [[pl("S", 0, 0, 0), pl("T1", 0, 1, 0)]],
  },
  {
    id: "trapezoid-3-2",
    name: "trapezoid",
    corners: 4,
    outline: [
      [0, 0],
      [3, 0],
      [2, 1],
      [0, 1],
    ],
    recipes: [
      [pl("R2", 0, 0, 0), pl("T1", 0, 2, 0)],
      [pl("S", 0, 0, 0), pl("S", 0, 1, 0), pl("T1", 0, 2, 0)],
    ],
  },
  {
    id: "trapezoid-3-1",
    name: "trapezoid",
    corners: 4,
    outline: [
      [0, 0],
      [3, 0],
      [2, 1],
      [1, 1],
    ],
    recipes: [[pl("T1", 1, 1, 0), pl("S", 0, 1, 0), pl("T1", 0, 2, 0)]],
  },
  {
    id: "hexagon",
    name: "hexagon",
    corners: 6,
    outline: [
      [1, -1],
      [2, -1],
      [3, 0],
      [2, 1],
      [1, 1],
      [0, 0],
    ],
    recipes: [
      [pl("IT", 0, 0, 0), pl("IT", 2, 3, 0)],
      [
        pl("T1", 1, 1, 0),
        pl("S", 0, 1, 0),
        pl("T1", 0, 2, 0),
        pl("T1", 2, 1, 0),
        pl("S", 0, 1, -1),
        pl("T1", 3, 2, 0),
      ],
    ],
  },
  {
    id: "half-circle",
    name: "half-circle",
    corners: 0,
    outline: arc([1, 0], 1, 1, 0, Math.PI, 32),
    recipes: [[pl("Q", 0, 1, 0), pl("Q", 1, 1, 0)]],
  },
  {
    id: "circle",
    name: "circle",
    corners: 0,
    outline: arc([1, 0], 1, 1, 0, 2 * Math.PI, 64).slice(0, -1),
    recipes: [
      [pl("H", 0, 0, 0), pl("H", 2, 2, 0)],
      [pl("Q", 0, 1, 0), pl("Q", 1, 1, 0), pl("Q", 2, 1, 0), pl("Q", 3, 1, 0)],
    ],
  },
];
export const targetAtoms = (t: Target) => cover(t.recipes[0]!)!;

/** Every distinct orientation of a piece's atoms, moved so its lowest cell
 * sits at x, y ≥ 0. */
function orientations(p: PieceId): Atom[][] {
  const out = new Map<string, Atom[]>();
  for (const flip of [false, true])
    for (let rot = 0; rot < 4; rot++) {
      const atoms = PIECES[p].atoms.map((a) => moveAtom(a, rot, flip, [0, 0]));
      const xs = atoms.map((a) => Number(a.split(",")[0])),
        ys = atoms.map((a) => Number(a.split(",")[1]));
      const mx = Math.min(...xs),
        my = Math.min(...ys);
      const norm = atoms.map((a) => moveAtom(a, 0, false, [-mx, -my])).sort();
      out.set(norm.join(";"), norm);
    }
  return [...out.values()];
}
/** Whether these pieces (all used, any turn or flip) cover the target exactly. */
export function canTile(
  target: Set<Atom>,
  pieces: readonly PieceId[],
): boolean {
  const sizeOf = (atoms: Iterable<Atom>) => {
    let straight = 0,
      curved = 0;
    for (const a of atoms) {
      if (a.includes(",q")) curved++;
      else straight++;
    }
    return [straight, curved];
  };
  const [ts, tc] = sizeOf(target);
  let ps = 0,
    pc = 0;
  for (const p of pieces) {
    const [s, c] = sizeOf(PIECES[p].atoms);
    ps += s!;
    pc += c!;
  }
  if (ps !== ts || pc !== tc) return false;
  const forms = new Map(pieces.map((p) => [p, orientations(p)]));
  const search = (left: Set<Atom>, rest: PieceId[]): boolean => {
    if (!left.size) return rest.length === 0;
    const first = [...left].sort()[0]!;
    const [fx, fy, fp] = first.split(",");
    for (const p of new Set(rest)) {
      for (const form of forms.get(p)!) {
        for (const a of form) {
          const [ax, ay, ap] = a.split(",");
          if (ap !== fp) continue;
          const dx = Number(fx) - Number(ax),
            dy = Number(fy) - Number(ay);
          const moved = form.map((m) => moveAtom(m, 0, false, [dx, dy]));
          if (!moved.every((m) => left.has(m))) continue;
          const next = new Set(left);
          for (const m of moved) next.delete(m);
          const remaining = [...rest];
          remaining.splice(remaining.indexOf(p), 1);
          if (search(next, remaining)) return true;
        }
      }
    }
    return false;
  };
  return search(new Set(target), [...pieces]);
}

const PIECE_FILLS: FillRole[] = ["accent-fill", "gold-fill", "warm-fill"];
/** Turn a whole drawing by quarter turns about the origin. */
const quarterTurn = ([x, y]: Pt, q: number): Pt => {
  let X = x,
    Y = y;
  for (let i = 0; i < q; i++) [X, Y] = [-Y, X];
  return pt(X, Y);
};
/** A light unit grid behind a drawing, one path element. */
function gridPath(x0: number, x1: number, y0: number, y1: number): Element {
  const d: (["M", number, number] | ["L", number, number])[] = [];
  for (let x = x0; x <= x1; x++) d.push(["M", x, y0], ["L", x, y1]);
  for (let y = y0; y <= y1; y++) d.push(["M", x0, y], ["L", x1, y]);
  return { type: "path", id: "grid", d, stroke: "grid", width: 1 };
}
/** The composite drawn with its pieces' seams and its whole outline. */
function compositeScene(t: Target, recipe: Placement[], q: number): Scene {
  const all = [...t.outline.map((p) => quarterTurn(p, q))];
  const ox = Math.floor(Math.min(...all.map((p) => p[0])) + 1e-9),
    oy = Math.floor(Math.min(...all.map((p) => p[1])) + 1e-9);
  const at = (p: Pt) => {
    const [x, y] = quarterTurn(p, q);
    return pt(x - ox, y - oy);
  };
  const pieces: Element[] = recipe.map((placement, i) => ({
    type: "polygon",
    id: `piece${i}`,
    points: PIECES[placement.p].outline.map((p) =>
      at(placePoint(p, placement)),
    ),
    fill: PIECE_FILLS[i % 3]!,
    ...SEAM,
  }));
  return scene(...pieces, {
    type: "polygon",
    id: "outline",
    points: t.outline.map(at),
    fill: "none",
    stroke: "ink",
    width: 3,
  }).build({
    title: `${count(recipe.length, "flat piece")} fitted together with their sides touching`,
    note: "Thin lines inside show where the pieces meet. A thick line goes around the outside.",
    width: 300,
  });
}
const SIDE_NAMES: Record<number, string> = {
  5: "pentagon",
  6: "hexagon",
  8: "octagon",
};
const STRAIGHT_SIDES: Record<PieceId, number> = {
  S: 4,
  R2: 4,
  R3: 4,
  T1: 3,
  T2: 3,
  RT: 4,
  IT: 4,
  Q: 2,
  H: 1,
};
const OUTLINE_SAYS: Record<FlatName, string> = {
  square: "It has 4 straight sides of the same length and 4 square corners",
  rectangle:
    "It has 4 straight sides and 4 square corners, and 2 sides are longer than the other 2",
  triangle: "It has 3 straight sides and 3 corners",
  trapezoid:
    "It has 4 straight sides and 4 corners, and only 2 of its sides run the same way, never meeting",
  hexagon: "It has 6 straight sides and 6 corners",
  "half-circle":
    "It has one straight side and one curved edge, like a circle cut in half",
  circle: "It has one curved edge, round all the way around, and no corners",
};
const NAME_POOL = [
  "square",
  "rectangle",
  "triangle",
  "trapezoid",
  "pentagon",
  "hexagon",
  "octagon",
  "half-circle",
  "quarter-circle",
  "circle",
];
/** Names also true of the answer under inclusive naming, never offered. */
const alsoTrue = (name: FlatName): string[] =>
  name === "square"
    ? ["rectangle", "trapezoid"]
    : name === "rectangle"
      ? ["trapezoid"]
      : [];
const NEIGHBOR: Record<FlatName, string[]> = {
  square: ["pentagon", "triangle"],
  rectangle: ["hexagon", "pentagon"],
  triangle: ["square", "trapezoid"],
  trapezoid: ["triangle", "pentagon"],
  hexagon: ["rectangle", "pentagon"],
  "half-circle": ["circle", "quarter-circle"],
  circle: ["half-circle", "quarter-circle"],
};

type SolidPart =
  | {
      kind: "cube" | "box";
      x: number;
      y: number;
      z: number;
      w: number;
      d: number;
      h: number;
    }
  | {
      kind: "cylinder" | "cone";
      x: number;
      y: number;
      z: number;
      r: number;
      h: number;
    };
/** Draw solid pieces turned together by `turn` degrees about the vertical,
 * lower and farther pieces first. */
function solidsScene(
  parts: SolidPart[],
  turn: number,
  title: string,
  note: string,
  seams: { box?: BoxSpec["seams"]; round?: number[] } = {},
): Scene {
  const placed = parts.map((p, i) => {
    const [x, y] = turnPoint(p.x, p.y, turn);
    return { p, i, x, y };
  });
  placed.sort((a, b) => a.p.z - b.p.z || b.y - a.y);
  const elements = placed.flatMap(({ p, i, x, y }) => {
    if ("w" in p)
      return boxElements(`p${i}`, {
        cx: x,
        cy: y,
        z0: p.z,
        w: p.w,
        d: p.d,
        h: p.h,
        turn,
        ...(seams.box ? { seams: seams.box } : {}),
      });
    const round = { cx: x, cy: y, z0: p.z, r: p.r, h: p.h };
    return p.kind === "cylinder"
      ? cylinderElements(`p${i}`, {
          ...round,
          ...(seams.round ? { seams: seams.round } : {}),
        })
      : coneElements(`p${i}`, round);
  });
  const b = boundsOf(elements);
  return scene(
    ...shift(elements, -(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2),
  ).build({ title, note, width: 300 });
}
const SOLID_SEEN = {
  cube: "a block with square faces, all the same size",
  box: "a long block with rectangle faces",
  cylinder: "a piece with two round flat ends and a curved side",
  cone: "a piece with a round flat bottom that comes to a point",
} as const;

function compositeShapeName(r: Random): Built {
  const variant = r(1, 100) <= 75 ? "name-new-flat" : "name-new-solid";
  return variant === "name-new-flat" ? nameNewFlat(r) : nameNewSolid(r);
}
function nameNewFlat(r: Random): Built {
  const all = TARGETS.flatMap((t) =>
    t.recipes.map((recipe) => ({ t, recipe })),
  );
  const { t, recipe } = pick(r, all);
  const q = r(0, 3);
  const banned = new Set([t.name, ...alsoTrue(t.name)]);
  const pieceNames = [...new Set(recipe.map((pl) => PIECES[pl.p].noun))];
  const sides = recipe.reduce((a, pl) => a + STRAIGHT_SIDES[pl.p], 0);
  const curved = recipe.some((pl) => pl.p === "Q" || pl.p === "H");
  const distractors: { label: string; feedback: string }[] = [];
  const add = (label: string | undefined, feedback: string) => {
    if (
      !label ||
      banned.has(label as FlatName) ||
      distractors.some((d) => d.label === label) ||
      distractors.length >= 3
    )
      return;
    distractors.push({ label, feedback });
  };
  const outlineLine = `${OUTLINE_SAYS[t.name]}.`;
  for (const name of shuffle(r, pieceNames))
    add(
      name,
      `${capital(article(name))} ${name} is one of the pieces. The new shape is named by its own outside edge, not by its pieces. ${outlineLine}`,
    );
  if (!curved && SIDE_NAMES[sides])
    add(
      SIDE_NAMES[sides],
      `Adding up the pieces' sides gives ${sides}, but that counts the seams inside too. Only the outside edge counts. ${outlineLine}`,
    );
  for (const name of shuffle(r, [...NEIGHBOR[t.name]]))
    add(name, `Count the corners of the outside edge again. ${outlineLine}`);
  for (const name of shuffle(r, [...NAME_POOL]))
    add(name, `Trace the outside edge. ${outlineLine}`);
  const choices = shuffle(r, [
    { label: t.name as string, correct: true as const },
    ...distractors.slice(0, 3),
  ]);
  return {
    variant: "name-new-flat",
    ...choiceParts(choices),
    prompt:
      "These pieces are put together with their sides touching. What shape do they make?",
    figure: compositeScene(t, recipe, q),
    hint: `These ${count(recipe.length, "piece")} fit with no gaps and no overlaps. Trace only the outside edge with your finger, then count its corners.`,
    explanation: [
      `The ${count(recipe.length, "piece")} fit together with their sides touching, with no gaps and no overlaps. The lines inside are only seams, where two pieces meet.`,
      `Trace only the outside edge. ${outlineLine}`,
      `So the pieces make ${article(t.name)} ${t.name}.`,
    ],
  };
}
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);
function choiceParts(
  choices: (
    { label: string; correct: true } | { label: string; feedback: string }
  )[],
): Pick<Built, "response" | "answer" | "choiceFeedback"> {
  if (
    choices.filter((c) => "correct" in c).length !== 1 ||
    choices.length !== 4
  )
    throw new Need("four choices with one answer");
  if (new Set(choices.map((c) => c.label)).size !== 4)
    throw new Need("distinct choices");
  const options = choices.map((c, i) => ({
    id: `option-${"abcd"[i]}`,
    label: c.label,
  }));
  const choiceFeedback: Record<string, string> = {};
  let answer = "";
  choices.forEach((c, i) => {
    if ("correct" in c) answer = options[i]!.id;
    else choiceFeedback[options[i]!.id] = c.feedback;
  });
  return {
    response: { kind: "choice", label: "Choose one answer", options },
    answer,
    choiceFeedback,
  };
}
function nameNewSolid(r: Random): Built {
  const form = pick(r, [
    "cubes-stacked",
    "cubes-side",
    "cylinders-stacked",
    "blocks-side",
  ] as const);
  const turn = pick(r, [25, 30, 35, 40]);
  const s = 1.2;
  let figure: Scene, answer: string, pieces: string, said: string;
  if (form === "cylinders-stacked") {
    answer = "cylinder";
    pieces = "Two cylinders";
    said =
      "One tall piece with two round flat ends and a curved side. A thin line around its middle shows where two equal pieces meet.";
    figure = solidsScene(
      [{ kind: "cylinder", x: 0, y: 0, z: 0, r: 0.6, h: 2.2 }],
      turn,
      "Two equal solids put together",
      said,
      { round: [1.1] },
    );
  } else {
    answer = "rectangular prism";
    const stacked = form === "cubes-stacked";
    const blocks = form === "blocks-side";
    pieces = blocks ? "Two rectangular prisms" : "Two cubes";
    const w = stacked ? s : 2 * s,
      h = stacked || blocks ? 2 * s : s;
    said = stacked
      ? "One block with flat faces, twice as tall as it is wide. A thin line around its middle shows where two equal pieces meet."
      : blocks
        ? "One block with flat faces, as tall as it is wide and half as deep. A thin line down its middle shows where two equal pieces meet."
        : "One block with flat faces, twice as wide as it is tall. A thin line down its middle shows where two equal pieces meet.";
    figure = solidsScene(
      [{ kind: "box", x: 0, y: 0, z: 0, w, d: s, h }],
      turn,
      "Two equal solids put together",
      said,
      { box: [stacked ? { axis: "z", at: s } : { axis: "x", at: 0 }] },
    );
  }
  const why: Record<string, string> = {
    cube: `${pieces} were put together, but the new shape is not a cube. Its faces are not all squares of the same size, so it is a rectangular prism.`,
    cone: "A cone comes to a point. This shape has no point.",
    cylinder:
      "A cylinder has round flat ends and a curved side. This shape has only flat faces.",
    "rectangular prism":
      "A rectangular prism has only flat faces. This shape has round ends and a curved side.",
  };
  const choices = shuffle(
    r,
    ["rectangular prism", "cube", "cylinder", "cone"].map((label) =>
      label === answer
        ? { label, correct: true as const }
        : { label, feedback: why[label]! },
    ),
  );
  const result =
    answer === "cylinder"
      ? "Round flat ends, a curved side, no corners: the new shape is a cylinder, just taller."
      : form === "cubes-stacked"
        ? "Flat faces and square corners, twice as tall as it is wide, so it is not a cube. It is a rectangular prism."
        : form === "cubes-side"
          ? "Flat faces and square corners, twice as wide as it is tall, so it is not a cube. It is a rectangular prism."
          : "Flat faces and square corners, still longer one way than another. It is a bigger rectangular prism.";
  return {
    variant: "name-new-solid",
    ...choiceParts(choices),
    prompt: `${pieces} are put together like this. What shape do they make?`,
    figure,
    hint: `${pieces} meet at the thin line, which is only a seam. Picture the whole thing as one solid: does it have flat faces or a curved side, and is it as tall as it is wide?`,
    explanation: [
      `${pieces} are put together with flat faces touching. The thin line is only a seam, where they meet.`,
      `Look at the whole solid. ${result}`,
    ],
  };
}

/** The pieces of a figure-choice card, laid out in a row on the grid. */
type PieceSet = { pieces: PieceId[]; scale: number };
const lengthWords = (v: number) =>
  v === 0.5
    ? "half a grid unit"
    : v === 1
      ? "1 grid unit"
      : Number.isInteger(v)
        ? `${v} grid units`
        : `${Math.floor(v)} and a half grid units`;
function pieceWords(p: PieceId, k: number, many: boolean): string {
  const L = (v: number) => lengthWords(v * k);
  const noun = (word: string) => (many ? `${word}s` : word);
  switch (p) {
    case "S":
      return `${noun("square")} with sides of ${L(1)}`;
    case "R2":
      return `${noun("rectangle")} ${L(2)} long and ${L(1)} wide`;
    case "R3":
      return `${noun("rectangle")} ${L(3)} long and ${L(1)} wide`;
    case "T1":
      return `${noun("triangle")} with a square corner and two sides of ${L(1)}`;
    case "T2":
      return `${noun("triangle")} with a square corner and two sides of ${L(2)}`;
    case "RT":
      return `${noun("trapezoid")} with parallel sides of ${L(2)} and ${L(1)}`;
    case "IT":
      return `${noun("trapezoid")} with parallel sides of ${L(3)} and ${L(1)}`;
    case "Q":
      return `${noun("quarter-circle")} with two straight edges of ${L(1)}`;
    case "H":
      return `${noun("half-circle")} ${L(2)} across`;
  }
}
const NUMBER_WORD = ["", "one", "two", "three", "four", "five", "six"];
function setWords(set: PieceSet): string {
  const groups = new Map<PieceId, number>();
  for (const p of set.pieces) groups.set(p, (groups.get(p) ?? 0) + 1);
  const parts = [...groups].map(
    ([p, n]) => `${NUMBER_WORD[n]} ${pieceWords(p, set.scale, n > 1)}`,
  );
  const text = listOf(parts);
  return text[0]!.toUpperCase() + text.slice(1);
}
/** Pieces left to right on the grid, one grid unit apart, starting a new
 * row above when a row would pass 6 units. */
function setLayout(set: PieceSet): {
  elements: Element[];
  w: number;
  h: number;
} {
  let x = 0,
    y = 0,
    rowH = 0,
    w = 0;
  const elements: Element[] = set.pieces.map((p, i) => {
    const pts = PIECES[p].outline.map(([a, b]) =>
      pt(a * set.scale, b * set.scale),
    );
    const x0 = Math.min(...pts.map((q) => q[0])),
      x1 = Math.max(...pts.map((q) => q[0])),
      y1 = Math.max(...pts.map((q) => q[1]));
    const width = Math.ceil(x1 - x0 - 1e-9);
    if (x > 0 && x + width > 6) {
      y += rowH + 1;
      x = 0;
      rowH = 0;
    }
    const moved = pts.map(([a, b]) => pt(a - x0 + x, b + y));
    x += width + 1;
    w = Math.max(w, x - 1);
    rowH = Math.max(rowH, Math.ceil(y1 - 1e-9));
    return {
      type: "polygon",
      id: `piece${i}`,
      points: moved,
      fill: PIECE_FILLS[i % 3]!,
      stroke: "ink",
      width: 2.5,
    };
  });
  return { elements, w, h: y + rowH };
}
const SUBS: Record<PieceId, PieceId[]> = {
  S: ["T1", "Q"],
  R2: ["RT", "T2", "H"],
  R3: ["IT", "R2"],
  T1: ["Q", "S"],
  T2: ["R2", "RT", "H"],
  RT: ["IT", "R2"],
  IT: ["RT", "R3"],
  Q: ["S", "T1"],
  H: ["R2", "T2"],
};
const TARGET_WORDS: Record<string, string> = {
  "unit-square": "a square with sides of 1 grid unit",
  "rectangle-2-1": "a rectangle 2 grid units long and 1 wide",
  "square-2-2": "a square with sides of 2 grid units",
  "rectangle-3-1": "a rectangle 3 grid units long and 1 wide",
  "big-triangle":
    "a triangle with a square corner and two sides of 2 grid units",
  "turned-triangle":
    "a triangle with a long side of 2 grid units and a corner in the middle of a grid square",
  "turned-square":
    "a square standing on a corner, 2 grid units from corner to corner",
  "trapezoid-2-1": "a trapezoid with parallel sides of 2 and 1 grid units",
  "trapezoid-3-2": "a trapezoid with parallel sides of 3 and 2 grid units",
  "trapezoid-3-1": "a trapezoid with parallel sides of 3 and 1 grid units",
  hexagon: "a hexagon 3 grid units wide and 2 grid units tall",
  "half-circle": "a half-circle 2 grid units across",
  circle: "a circle 2 grid units across",
};
function compositeWhichPieces(r: Random): Built {
  const all = TARGETS.flatMap((t) =>
    t.recipes.map((recipe) => ({ t, recipe })),
  );
  const { t, recipe } = pick(r, all);
  const atoms = targetAtoms(t);
  const right: PieceSet = { pieces: recipe.map((p) => p.p), scale: 1 };
  // Right kinds, wrong size: the same pieces doubled, or halved when doubled
  // pieces would not fit a card.
  const doubled: PieceSet = { pieces: right.pieces, scale: 2 };
  const big = setLayout(doubled);
  const size: PieceSet =
    big.w <= 7 && big.h <= 5 ? doubled : { pieces: right.pieces, scale: 0.5 };
  // Right count, wrong kinds.
  let kinds: PieceSet | undefined;
  for (let j = 0; j < 3 && !kinds; j++) {
    const swapped = right.pieces.map(
      (p) => SUBS[p][Math.min(j, SUBS[p].length - 1)]!,
    );
    if (!canTile(atoms, swapped)) kinds = { pieces: swapped, scale: 1 };
  }
  if (!kinds) throw new Need("a wrong-kind set that cannot make the shape");
  const drop = r(0, right.pieces.length - 1);
  const short: PieceSet = {
    pieces: right.pieces.filter((_, i) => i !== drop),
    scale: 1,
  };
  if (canTile(atoms, short.pieces) || !canTile(atoms, right.pieces))
    throw new Error("Recipe check failed");
  const sets = [right, size, kinds, short];
  const words = sets.map(setWords);
  if (new Set(words).size !== 4) throw new Need("four different piece sets");
  const layouts = sets.map(setLayout);
  const W = Math.max(...layouts.map((l) => l.w)),
    H = Math.max(...layouts.map((l) => l.h));
  const card = (i: number): Scene =>
    scene(gridPath(-1, W + 1, -1, H + 1), ...layouts[i]!.elements).build({
      width: 264,
      maxHeight: 280,
    });
  const order = shuffle(r, [0, 1, 2, 3]);
  const letter = (i: number) => figureOptionLetters[order.indexOf(i)]!;
  const idOf = (i: number) => figureOptionIds[order.indexOf(i)]!;
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: "Choose the pieces",
    noun: "Picture",
    options: order.map((i) => ({
      id: figureOptionIds[order.indexOf(i)]!,
      label: `${words[i]}.`,
      scene: card(i),
    })),
  };
  const q = r(0, 3);
  const turned = t.outline.map((p) => quarterTurn(p, q));
  const ox = Math.floor(Math.min(...turned.map((p) => p[0])) + 1e-9),
    oy = Math.floor(Math.min(...turned.map((p) => p[1])) + 1e-9);
  const shown = turned.map(([x, y]) => pt(x - ox, y - oy));
  const tw = Math.ceil(Math.max(...shown.map((p) => p[0])) - 1e-9),
    th = Math.ceil(Math.max(...shown.map((p) => p[1])) - 1e-9);
  const figure = scene(gridPath(-1, tw + 1, -1, th + 1), {
    type: "polygon",
    id: "outline",
    points: shown,
    fill: "accent-fill",
    stroke: "ink",
    width: 3,
  }).build({
    title: "A shape on a grid",
    note: `The shape is ${TARGET_WORDS[t.id]}.`,
    width: 240,
  });
  const bigger = size.scale > 1;
  const feedback = [
    "",
    `These are the right kinds of pieces, but they are too ${bigger ? "big" : "small"}. Compare each piece with the grid squares.`,
    `There are as many pieces as you need, but they are the wrong kinds. Their edges and corners do not match the shape's.`,
    `These pieces are right, but one is missing. Together they cover only part of the shape.`,
  ];
  return {
    variant: "which-pieces",
    prompt:
      "Which pieces can be put together to make this shape? Use every piece in the set.",
    response,
    answer: idOf(0),
    choiceFeedback: Object.fromEntries(
      [1, 2, 3].map((i) => [idOf(i), feedback[i]!]),
    ),
    figure,
    hint: `The shape is ${TARGET_WORDS[t.id]}. For each set, check the size of the pieces against the grid, then check whether they would cover the whole shape.`,
    explanation: [
      `The pieces must cover the whole shape with their sides touching: no gaps, no overlaps, and every piece used.`,
      `Picture ${letter(1)}: ${feedback[1]}`,
      `Picture ${letter(2)}: ${feedback[2]}`,
      `Picture ${letter(3)}: ${feedback[3]}`,
      `${words[0]}: turned and slid into place, these pieces cover the shape exactly.`,
      `So Picture ${letter(0)} shows the pieces that make the shape.`,
    ],
  };
}

const COMPOSITE_SOLIDS = [
  "cone-on-cylinder",
  "cone-on-cube",
  "cylinder-on-cube",
  "cube-on-prism",
  "cube-beside-cylinder-and-cone",
] as const;
function compositeWhichSolids(r: Random): Built {
  const form = pick(r, COMPOSITE_SOLIDS);
  const turn = pick(r, [25, 30, 35, 40]);
  const c = 1.3;
  let parts: SolidPart[];
  let kindsUsed: ("cube" | "box" | "cylinder" | "cone")[];
  switch (form) {
    case "cone-on-cylinder":
      parts = [
        { kind: "cylinder", x: 0, y: 0, z: 0, r: 0.6, h: 1.2 },
        { kind: "cone", x: 0, y: 0, z: 1.2, r: 0.6, h: 1.1 },
      ];
      kindsUsed = ["cylinder", "cone"];
      break;
    case "cone-on-cube":
      parts = [
        { kind: "cube", x: 0, y: 0, z: 0, w: c, d: c, h: c },
        { kind: "cone", x: 0, y: 0, z: c, r: 0.55, h: 1.1 },
      ];
      kindsUsed = ["cube", "cone"];
      break;
    case "cylinder-on-cube":
      parts = [
        { kind: "cube", x: 0, y: 0, z: 0, w: c, d: c, h: c },
        { kind: "cylinder", x: 0, y: 0, z: c, r: 0.5, h: 1.0 },
      ];
      kindsUsed = ["cube", "cylinder"];
      break;
    case "cube-on-prism":
      parts = [
        { kind: "box", x: 0, y: 0, z: 0, w: 2 * c, d: c, h: c },
        {
          kind: "cube",
          x: pick(r, [-c / 2, c / 2]),
          y: 0,
          z: c,
          w: c,
          d: c,
          h: c,
        },
      ];
      kindsUsed = ["box", "cube"];
      break;
    default:
      parts = [
        { kind: "cube", x: -1.05, y: 0, z: 0, w: 1.2, d: 1.2, h: 1.2 },
        { kind: "cylinder", x: 1.05, y: 0, z: 0, r: 0.55, h: 1.2 },
        { kind: "cone", x: 1.05, y: 0, z: 1.2, r: 0.55, h: 1.0 },
      ];
      kindsUsed = ["cube", "cylinder", "cone"];
  }
  const label = (k: "cube" | "box" | "cylinder" | "cone") =>
    k === "box" ? "rectangular prism" : k;
  const used = kindsUsed.map(label);
  // A cube is also a rectangular prism, so with a cube and no longer block
  // the fourth choice is a sphere, never a name that is also true.
  const names = [
    "cube",
    kindsUsed.includes("cube") && !kindsUsed.includes("box")
      ? "sphere"
      : "rectangular prism",
    "cylinder",
    "cone",
  ];
  const ordered = shuffle(r, names);
  const options = ordered.map((label, i) => ({
    id: `option-${"abcd"[i]}`,
    label,
  }));
  const said = parts
    .map((p, i) => {
      const where =
        form === "cube-beside-cylinder-and-cone"
          ? ["On the left", "On the right, at the bottom", "On top of that"][i]
          : i === 0
            ? "At the bottom"
            : "On top";
      return `${where}: ${SOLID_SEEN[p.kind]}.`;
    })
    .join(" ");
  const figure = solidsScene(
    parts,
    turn,
    `A shape built from ${count(parts.length, "solid")}`,
    said,
  );
  const naming: Record<string, string> = {
    cube: "square faces, all the same size: a cube",
    box: "rectangle faces, longer one way than the other: a rectangular prism",
    cylinder: "two round flat ends and a curved side: a cylinder",
    cone: "a round flat bottom that comes to a point: a cone",
  };
  return {
    variant: form,
    prompt: "Which solids were used to build this shape?",
    response: {
      kind: "multi-select",
      label: `Choose ${count(used.length, "solid")}`,
      options,
      selectionCount: used.length,
    },
    answer: serializeSelection(
      options
        .filter((o) => (used as string[]).includes(o.label))
        .map((o) => o.id),
    ),
    figure,
    hint: `This shape is built from ${count(parts.length, "solid")}. Find the seams, where one solid ends and the next begins. Name the bottom piece first: are its faces flat or curved?`,
    explanation: [
      "The lines where the pieces meet are seams. Each piece between seams is one solid.",
      ...parts.map((p, i) => {
        const where =
          form === "cube-beside-cylinder-and-cone"
            ? [
                "The piece on the left",
                "The bottom piece on the right",
                "The piece on top of it",
              ][i]
            : i === 0
              ? "The bottom piece"
              : "The top piece";
        return `${where} has ${naming[p.kind]}.`;
      }),
      `So the solids used are ${listOf(used.map((u) => `${article(u)} ${u}`))}.`,
    ],
  };
}

/* ------------------------------------------------------------ assembly */

class Need extends Error {
  constructor(what: string) {
    super(`Need ${what}`);
  }
}
const generators: Record<string, (r: Random) => Built> = {
  "flat-or-solid-name": flatOrSolidName,
  "pick-flat-or-solid": pickFlatOrSolid,
  "count-flat-or-solid": countFlatOrSolid,
  "composite-shape-name": compositeShapeName,
  "composite-which-pieces": compositeWhichPieces,
  "composite-which-solids": compositeWhichSolids,
};
export function generateFlatSolidCompose(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = metaOf(templateId);
  const make = generators[templateId];
  if (!meta || !make) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  let built: Built | undefined;
  for (let attempt = 0; attempt < 60 && !built; attempt++)
    try {
      built = make(random(templateId, attempt ? `${seed}#${attempt}` : seed));
    } catch (error) {
      if (!(error instanceof Need)) throw error;
    }
  if (!built) throw new Error(`${templateId}: no instance for ${seed}`);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: built.response,
      ...(built.figure
        ? { figure: { kind: "scene" as const, scene: built.figure } }
        : {}),
    },
    answer: built.answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(built.choiceFeedback ? { choiceFeedback: built.choiceFeedback } : {}),
    variant: { id: built.variant },
  };
}
