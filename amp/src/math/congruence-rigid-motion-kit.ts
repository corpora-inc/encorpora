import type { SemanticFigure } from "./contracts";
import { shuffle } from "./distribution-practice";
import {
  figureAngleMark,
  figureScene,
  figureSegment,
  figureTicks,
  sceneFigure,
} from "./geometry-teaching-figures";
import type { Element, Point } from "./scene/spec";
import {
  gradeStructuredWork,
  gradingFits,
  normalizeStructuredWork,
  structuralProblem,
  type StructuredWorkResponse,
  type WorkField,
  type WorkGrading,
} from "./structured-work";
import type { ProofModel } from "./structured-work-kit";
import type { Random } from "./variation/axes";

/**
 * Shared model of the rigid-motion congruence arguments (HSG.CO.B.7 and
 * HSG.CO.B.8): two congruent triangles drawn to scale, and the proof that
 * lands one on the other. Translate A to D and rotate about D until the
 * image of B is on ray DE; the given AB = DE puts it at E; orientation
 * decides whether a reflection over line DE is needed; then the third
 * vertex is pinned by an angle and a side (SAS), two angles (ASA) or two
 * sides (SSS). The last line concludes congruence by the definition.
 *
 * Every proof is six lines (the structured-work limit), so the translation
 * and the rotation share one line, and the reflection shares the line that
 * reads the orientation. Each line's claim lists exactly the lines it
 * logically needs, so every valid order is credited.
 */

export type Role = "A" | "B" | "C" | "D" | "E" | "F";
export type Letters = Record<Role, string>;
export type Path = "sas" | "asa" | "sss";

/* ---------------------------------------------------------- vectors */

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const cross = (u: Point, v: Point) => u[0] * v[1] - u[1] * v[0];
export const dot = (u: Point, v: Point) => u[0] * v[0] + u[1] * v[1];
export const dist = (a: Point, b: Point) =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);
const rad = (d: number) => (d * Math.PI) / 180;
export const rotateVec = (v: Point, deg: number): Point => {
  const c = Math.cos(rad(deg)),
    s = Math.sin(rad(deg));
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
/** Signed area sign of p → q → s: positive means counterclockwise. */
export const turn = (p: Point, q: Point, s: Point) =>
  Math.sign(cross(sub(q, p), sub(s, p)));
/** Mirror image of p across the line through a and b. */
export function reflectAcross(p: Point, a: Point, b: Point): Point {
  const u = sub(b, a);
  const t = dot(sub(p, a), u) / dot(u, u);
  const foot = add(a, mul(u, t));
  return sub(mul(foot, 2), p);
}
const centroid = (ps: Point[]): Point => [
  ps.reduce((s, p) => s + p[0], 0) / ps.length,
  ps.reduce((s, p) => s + p[1], 0) / ps.length,
];

/* ---------------------------------------------------------- letters */

/** Vertex names: two disjoint triples, never I, O, Q, S or W. */
const TRIPLES = [
  ["A", "B", "C"],
  ["D", "E", "F"],
  ["G", "H", "J"],
  ["K", "L", "M"],
  ["N", "P", "R"],
  ["T", "U", "V"],
  ["X", "Y", "Z"],
] as const;
export function drawLetters(r: Random): Letters {
  // The textbook names are the most common draw.
  if (r(1, 3) === 1) return { A: "A", B: "B", C: "C", D: "D", E: "E", F: "F" };
  const i = r(0, TRIPLES.length - 1);
  let j = r(0, TRIPLES.length - 2);
  if (j >= i) j++;
  const [A, B, C] = TRIPLES[i]!;
  const [D, E, F] = TRIPLES[j]!;
  return { A, B, C, D, E, F };
}

/* --------------------------------------------------------- triangles */

/** Interior angles in degrees of the triangle with sides a = BC, b = CA,
 * c = AB. */
export function anglesOf(a: number, b: number, c: number) {
  const deg = (x: number) => (Math.acos(x) * 180) / Math.PI;
  return {
    A: deg((b * b + c * c - a * a) / (2 * b * c)),
    B: deg((a * a + c * c - b * b) / (2 * a * c)),
    C: deg((a * a + b * b - c * c) / (2 * a * b)),
  };
}
/** Vertices of the triangle with sides a = BC, b = CA, c = AB:
 * A at the origin, B on the positive x axis, C above (counterclockwise). */
export function baseTriangle(a: number, b: number, c: number): Point[] {
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  return [
    [0, 0],
    [c, 0],
    [b * cosA, b * Math.sqrt(1 - cosA * cosA)],
  ];
}

/** Integer sides 5–14 of a scalene triangle with every angle in
 * [30°, 110°]. */
export function drawSides(r: Random) {
  for (;;) {
    const a = r(5, 14),
      b = r(5, 14),
      c = r(5, 14);
    if (a === b || b === c || a === c) continue;
    if (a + b <= c || b + c <= a || a + c <= b) continue;
    const g = anglesOf(a, b, c);
    if ([g.A, g.B, g.C].every((x) => x >= 30 && x <= 110)) return { a, b, c };
  }
}

/** Place a triangle (given counterclockwise) for drawing: optionally
 * mirrored, then turned by `turnDeg`, scaled so its longest side is 5. */
function posed(t: Point[], mirror: boolean, turnDeg: number, k: number) {
  return t.map((p) =>
    rotateVec(mul([p[0], mirror ? -p[1] : p[1]], k), turnDeg),
  );
}

export interface TrianglePair {
  /** Drawn positions (math coordinates, y up). */
  at: Record<Role, Point>;
  sides: { a: number; b: number; c: number };
  /** A→B→C and D→E→F run opposite ways round. */
  opposite: boolean;
  /** A→B→C runs counterclockwise. */
  abcCounterclockwise: boolean;
}

/** △ABC and a congruent △DEF beside it, turned by a multiple of 15° in
 * [30°, 330°] other than 180° and reflected when `opposite`. */
export function congruentPair(r: Random, opposite: boolean): TrianglePair {
  for (;;) {
    const sides = drawSides(r);
    const t = baseTriangle(sides.a, sides.b, sides.c);
    const k = 5 / Math.max(sides.a, sides.b, sides.c);
    const mirror = r(0, 1) === 1;
    const first = 15 * r(0, 23);
    let delta: number;
    do delta = 15 * r(2, 22);
    while (delta === 180);
    const abc = posed(t, mirror, first, k);
    const def = posed(t, mirror !== opposite, first + delta, k);
    const at = place(abc, def);
    if (!pairUsable(at)) continue;
    return {
      at,
      sides,
      opposite,
      abcCounterclockwise: turn(at.A, at.B, at.C) > 0,
    };
  }
}

/** ABC centered at the origin; DEF to its right with a clear gap. */
export function place(abc: Point[], def: Point[]): Record<Role, Point> {
  const c1 = centroid(abc);
  const p1 = abc.map((p) => sub(p, c1));
  const c2 = centroid(def);
  const p2 = def.map((p) => sub(p, c2));
  const right = Math.max(...p1.map((p) => p[0]));
  const left = Math.min(...p2.map((p) => p[0]));
  const shift: Point = [right - left + 1.6, 0];
  const q2 = p2.map((p) => add(p, shift));
  return {
    A: p1[0]!,
    B: p1[1]!,
    C: p1[2]!,
    D: q2[0]!,
    E: q2[1]!,
    F: q2[2]!,
  };
}

/** The pair's false decoys stay false: no translation carries AB onto DE,
 * and no rotation about D carries B to E. */
function pairUsable(at: Record<Role, Point>) {
  const ab = sub(at.B, at.A),
    de = sub(at.E, at.D);
  return (
    Math.hypot(ab[0] - de[0], ab[1] - de[1]) > 0.5 &&
    Math.abs(dist(at.D, at.B) - dist(at.D, at.E)) > 0.4
  );
}

/** The construction of the proof, applied to A, B and C: translate by
 * D − A, rotate about D until ray DB' is ray DE, reflect over line DE when
 * the orientations differ. Returns the images. */
export function landing(
  at: Record<Role, Point>,
  opposite: boolean,
): { A: Point; B: Point; C: Point; turnDeg: number } {
  const v = sub(at.D, at.A);
  const moved = [at.A, at.B, at.C].map((p) => add(p, v));
  const from = sub(moved[1]!, at.D);
  const to = sub(at.E, at.D);
  const turnDeg = (Math.atan2(cross(from, to), dot(from, to)) * 180) / Math.PI;
  let [A1, B1, C1] = moved.map((p) =>
    add(at.D, rotateVec(sub(p, at.D), turnDeg)),
  ) as [Point, Point, Point];
  if (opposite) C1 = reflectAcross(C1, at.D, at.E);
  return { A: A1, B: B1, C: C1, turnDeg };
}

/* ----------------------------------------------------------- figures */

export type Marks = {
  /** Side as two roles and its tick count. */
  ticks?: [Role, Role, number][];
  /** Angle at a vertex and its arc count. */
  arcs?: [Role, number][];
};
const triangleOf: Record<Role, [Role, Role, Role]> = {
  A: ["A", "B", "C"],
  B: ["A", "B", "C"],
  C: ["A", "B", "C"],
  D: ["D", "E", "F"],
  E: ["D", "E", "F"],
  F: ["D", "E", "F"],
};
/** The two triangles with their names and congruence marks; `extra`
 * elements (dashed comparison segments) are drawn underneath. */
export function pairFigure(
  title: string,
  at: Record<Role, Point>,
  L: Letters,
  marks: Marks,
  extra: Element[] = [],
): SemanticFigure {
  const els: Element[] = [...extra];
  const sides: [Role, Role][] = [
    ["A", "B"],
    ["B", "C"],
    ["C", "A"],
    ["D", "E"],
    ["E", "F"],
    ["F", "D"],
  ];
  for (const [p, q] of sides)
    els.push(figureSegment(`s${p}${q}`, at[p], at[q]));
  for (const [p, q, n] of marks.ticks ?? [])
    els.push(...figureTicks(`t${p}${q}`, at[p], at[q], n));
  for (const [v, n] of marks.arcs ?? []) {
    const [x, y, z] = triangleOf[v];
    const others = [x, y, z].filter((w) => w !== v) as [Role, Role];
    els.push(
      ...figureAngleMark(`a${v}`, at[v], at[others[0]], at[others[1]], {
        arcs: n,
        r: 0.5,
      }),
    );
  }
  els.push(...vertexNames(at, L, els));
  return sceneFigure(figureScene(title, els));
}

/** Pixels per unit of the narrowest layout: a 288-pixel phone figure
 * holding the whole drawing, with room left for its labels. */
function phoneScale(points: Point[]) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - Math.min(...ys);
  return 0.85 * Math.min(280 / w, 312 / h);
}
/** The strokes a label must stay off, as segments in figure units. */
function strokeSegments(els: Element[]): [Point, Point][] {
  const out: [Point, Point][] = [];
  for (const e of els) {
    if (e.type === "segment") out.push([e.from, e.to]);
    else if (e.type === "polyline")
      for (let i = 0; i + 1 < e.points.length; i++)
        out.push([e.points[i]!, e.points[i + 1]!]);
    else if (e.type === "arc") {
      const steps = 12;
      const at = (k: number): Point => {
        const a = rad(e.from + ((e.to - e.from) * k) / steps);
        return [
          e.center[0] + e.r * Math.cos(a),
          e.center[1] + e.r * Math.sin(a),
        ];
      };
      for (let k = 0; k < steps; k++) out.push([at(k), at(k + 1)]);
    }
  }
  return out;
}
type Box = { x0: number; y0: number; x1: number; y1: number };
/** Whether segment pq meets box b. */
function segmentHits(p: Point, q: Point, b: Box): boolean {
  const inside = (r: Point) =>
    r[0] >= b.x0 && r[0] <= b.x1 && r[1] >= b.y0 && r[1] <= b.y1;
  if (inside(p) || inside(q)) return true;
  const edges: [Point, Point][] = [
    [
      [b.x0, b.y0],
      [b.x1, b.y0],
    ],
    [
      [b.x1, b.y0],
      [b.x1, b.y1],
    ],
    [
      [b.x1, b.y1],
      [b.x0, b.y1],
    ],
    [
      [b.x0, b.y1],
      [b.x0, b.y0],
    ],
  ];
  const side = (a: Point, c: Point, r: Point) =>
    Math.sign(cross(sub(c, a), sub(r, a)));
  return edges.some(
    ([a, c]) =>
      side(a, c, p) !== side(a, c, q) && side(p, q, a) !== side(p, q, c),
  );
}
/** The six vertex names, each set where it clears every stroke of the
 * figure and every name placed before it at the narrowest (phone) layout,
 * nearest to the vertex and closest to straight outward. A wider layout
 * only adds room. */
function vertexNames(
  at: Record<Role, Point>,
  L: Letters,
  els: Element[],
): Element[] {
  const strokes = strokeSegments(els);
  const s = phoneScale([
    ...Object.values(at),
    ...strokes.flatMap(([p, q]) => [p, q]),
  ]);
  // A bold capital is about 14 by 16 pixels; keep 3 pixels of air.
  const half: Point = [(7 + 3) / s, (8 + 3) / s];
  const placed: Box[] = [];
  const out: Element[] = [];
  for (const v of ["A", "B", "C", "D", "E", "F"] as const) {
    const [x, y, z] = triangleOf[v];
    const others = [x, y, z].filter((w) => w !== v) as [Role, Role];
    const u1 = sub(at[others[0]], at[v]),
      u2 = sub(at[others[1]], at[v]);
    const n1 = Math.hypot(...u1),
      n2 = Math.hypot(...u2);
    // Straight outward: the bisector of the outside of the angle.
    const outward = Math.atan2(
      -(u1[1] / n1 + u2[1] / n2),
      -(u1[0] / n1 + u2[0] / n2),
    );
    const tries: { d: number; turn: number; box: Box; c: Point }[] = [];
    for (const d of [12, 15, 19, 24])
      for (let k = 0; k < 24; k++) {
        const a = outward + rad(15 * (k % 2 ? -Math.ceil(k / 2) : k / 2));
        const c: Point = [
          at[v][0] + (Math.cos(a) * d) / s,
          at[v][1] + (Math.sin(a) * d) / s,
        ];
        tries.push({
          d,
          turn: k,
          c,
          box: {
            x0: c[0] - half[0],
            x1: c[0] + half[0],
            y0: c[1] - half[1],
            y1: c[1] + half[1],
          },
        });
      }
    const clear = (b: Box) =>
      !strokes.some(([p, q]) => segmentHits(p, q, b)) &&
      !placed.some(
        (o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1,
      );
    // Nearest first, then closest to outward.
    const chosen = tries.find((t) => clear(t.box)) ?? tries[0]!;
    placed.push(chosen.box);
    const dx = (chosen.c[0] - at[v][0]) * s,
      dy = (chosen.c[1] - at[v][1]) * s;
    out.push({
      type: "text",
      id: `n${v}`,
      at: at[v],
      text: L[v],
      font: "math",
      bold: true,
      align: [0, 0],
      offset: [dx, -dy],
    });
  }
  return out;
}

/** Marks for the givens of a criterion: AB and DE once; the second given
 * part twice; the third three times (or the angle's arcs). */
export function criterionMarks(path: Path | "six" | "ssa" | "aaa"): Marks {
  switch (path) {
    case "sas":
      return {
        ticks: [
          ["A", "B", 1],
          ["D", "E", 1],
          ["C", "A", 2],
          ["F", "D", 2],
        ],
        arcs: [
          ["A", 1],
          ["D", 1],
        ],
      };
    case "asa":
      return {
        ticks: [
          ["A", "B", 1],
          ["D", "E", 1],
        ],
        arcs: [
          ["A", 1],
          ["D", 1],
          ["B", 2],
          ["E", 2],
        ],
      };
    case "sss":
      return {
        ticks: [
          ["A", "B", 1],
          ["D", "E", 1],
          ["B", "C", 2],
          ["E", "F", 2],
          ["C", "A", 3],
          ["F", "D", 3],
        ],
      };
    case "ssa":
      return {
        ticks: [
          ["A", "B", 1],
          ["D", "E", 1],
          ["B", "C", 2],
          ["E", "F", 2],
        ],
        arcs: [
          ["A", 1],
          ["D", 1],
        ],
      };
    case "aaa":
      return {
        arcs: [
          ["A", 1],
          ["D", 1],
          ["B", 2],
          ["E", 2],
          ["C", 3],
          ["F", 3],
        ],
      };
    default:
      return {
        ticks: [
          ["A", "B", 1],
          ["D", "E", 1],
          ["B", "C", 2],
          ["E", "F", 2],
          ["C", "A", 3],
          ["F", "D", 3],
        ],
        arcs: [
          ["A", 1],
          ["D", 1],
          ["B", 2],
          ["E", 2],
          ["C", 3],
          ["F", 3],
        ],
      };
  }
}

/** Plain-text alt text of the marks. */
export function marksText(L: Letters, m: Marks): string {
  const word = ["", "one", "two", "three"];
  const ticks = m.ticks ?? [],
    arcs = m.arcs ?? [];
  const sides = ticks
    .filter((_, i) => i % 2 === 0)
    .map(([p, q, n], i) => {
      const [x, y] = ticks[2 * i + 1]!;
      return `${word[n]} on ${L[p]}${L[q]} and ${L[x]}${L[y]}`;
    });
  const angles = arcs
    .filter((_, i) => i % 2 === 0)
    .map(([v, n], i) => `${word[n]} at ${L[v]} and ${L[arcs[2 * i + 1]![0]]}`);
  return [
    ...(sides.length ? [`ticks: ${sides.join(", ")}`] : []),
    ...(angles.length ? [`arcs: ${angles.join(", ")}`] : []),
  ].join("; ");
}

/* ------------------------------------------------------------- text */

export const tri = (L: Letters, which: "abc" | "def") =>
  which === "abc"
    ? `\\triangle ${L.A}${L.B}${L.C}`
    : `\\triangle ${L.D}${L.E}${L.F}`;
export const way = (ccw: boolean) => (ccw ? "counterclockwise" : "clockwise");
/** "$A\to B\to C$ runs clockwise and $D\to E\to F$ counterclockwise". */
export function orientationText(
  L: Letters,
  p: Pick<TrianglePair, "opposite" | "abcCounterclockwise">,
) {
  const def = p.opposite ? !p.abcCounterclockwise : p.abcCounterclockwise;
  return `$${L.A}\\to ${L.B}\\to ${L.C}$ runs ${way(p.abcCounterclockwise)} and $${L.D}\\to ${L.E}\\to ${L.F}$ runs ${way(def)}`;
}
/** The image of C used by the finish: C' or, after the reflection, C''. */
export const imageC = (L: Letters, opposite: boolean) =>
  opposite ? `${L.C}''` : `${L.C}'`;
export const givenTex: Record<
  "AB" | "BC" | "CA" | "A" | "B" | "C",
  (L: Letters) => string
> = {
  AB: (L) => `\\overline{${L.A}${L.B}}\\cong\\overline{${L.D}${L.E}}`,
  BC: (L) => `\\overline{${L.B}${L.C}}\\cong\\overline{${L.E}${L.F}}`,
  CA: (L) => `\\overline{${L.C}${L.A}}\\cong\\overline{${L.F}${L.D}}`,
  A: (L) => `\\angle ${L.A}\\cong\\angle ${L.D}`,
  B: (L) => `\\angle ${L.B}\\cong\\angle ${L.E}`,
  C: (L) => `\\angle ${L.C}\\cong\\angle ${L.F}`,
};
export type GivenKey = keyof typeof givenTex;
export const criterionGivens: Record<Path, GivenKey[]> = {
  sas: ["AB", "A", "CA"],
  asa: ["AB", "A", "B"],
  sss: ["AB", "BC", "CA"],
};
export const criterionName: Record<Path, string> = {
  sas: "SAS",
  asa: "ASA",
  sss: "SSS",
};

/* ------------------------------------------------------- proof lines */

export type RowKey =
  "tr" | "be" | "or" | "ray" | "rays" | "circ" | "pin" | "conc";
export type ReasonKey =
  | "tr"
  | "dist"
  | "orSame"
  | "orFlip"
  | "ang"
  | "lines"
  | "circles"
  | "def"
  // Distractors, each named by its misconception.
  | "cpctc"
  | "criterion"
  | "freeRotation"
  | "reflectionKeepsOrientation"
  | "dilation"
  | "leap"
  | "picture"
  | "twoPoints"
  | "reflectionMovesLine"
  | "oneMeeting";
export type DecoyKey =
  | "segmentTranslate"
  | "rotateOntoE"
  | "angleLandsB"
  | "leapStatement"
  | "circular"
  | "noReflection"
  | "reflectMovesD"
  | "wrongSide"
  | "rayOnly"
  | "phantom"
  | "oneMeetingStatement";

export function reasonText(L: Letters, key: ReasonKey, path: Path): string {
  const { A, D, E } = L;
  switch (key) {
    case "tr":
      return `A translation can carry $${A}$ to $${D}$; a rotation about $${D}$ fixes $${D}$ and can turn any ray from $${D}$ onto any other.`;
    case "dist":
      return "Rigid motions preserve distance, and a ray has exactly one point at a given distance from its endpoint.";
    case "orSame":
      return "Translations and rotations preserve orientation, and the two triangles have the same orientation.";
    case "orFlip":
      return "Translations and rotations preserve orientation, which differs here; a reflection fixes its line and swaps the line's two sides.";
    case "ang":
      return `Rigid motions preserve angle measure, and on one side of line $${D}${E}$ just one ray from $${D}$ (or from $${E}$) makes a given angle with $\\overline{${D}${E}}$.`;
    case "lines":
      return "Two different lines meet in at most one point.";
    case "circles":
      return "Two circles with different centers meet in at most two points, mirror images across the line through the centers.";
    case "def":
      return "Definition of congruence: a sequence of rigid motions maps one figure onto the other.";
    case "cpctc":
      return "Corresponding parts of congruent triangles are congruent (CPCTC).";
    case "criterion":
      return `The ${criterionName[path]} congruence criterion.`;
    case "freeRotation":
      return `A rotation about $${D}$ can carry any point onto any other point.`;
    case "reflectionKeepsOrientation":
      return "Reflections preserve orientation.";
    case "dilation":
      return "A dilation can make matching sides the same length.";
    case "leap":
      return "Once two vertices land on their matches, the third vertex must land on its match.";
    case "picture":
      return "The two triangles look the same size and shape in the figure.";
    case "twoPoints":
      return "Two points determine exactly one line.";
    case "reflectionMovesLine":
      return `A reflection over line $${D}${E}$ swaps $${D}$ and $${E}$.`;
    case "oneMeeting":
      return "Two circles meet in exactly one point.";
  }
}

/** Misconception of each distractor reason. */
export const reasonMisconception: Partial<Record<ReasonKey, string>> = {
  cpctc: "circular: CPCTC is proved from the definition this proof uses",
  criterion:
    "a criterion in place of the definition; the criteria are proved by this argument",
  freeRotation: "a rotation keeps each point's distance from its center",
  reflectionKeepsOrientation: "a reflection reverses orientation",
  dilation: "a dilation is not a rigid motion",
  leap: "skips the orientation and the pinning of the third vertex",
  picture: "reads the proof from the drawing",
  twoPoints: "a true fact that does not pin this point",
  reflectionMovesLine: "a reflection fixes every point of its line",
  oneMeeting: "two circles can meet in two points",
};

export function rowText(L: Letters, key: RowKey, opposite: boolean): string {
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  switch (key) {
    case "tr":
      return `Translate $\\triangle ${A}${B}${C}$ by the vector from $${A}$ to $${D}$, then rotate about $${D}$ until the image of $${B}$ is on ray $${D}${E}$; call the image $\\triangle ${D}${B}'${C}'$.`;
    case "be":
      return `$${D}${B}'=${A}${B}=${D}${E}$, so $${B}'=${E}$.`;
    case "or":
      return opposite
        ? `$${C}'$ is across line $${D}${E}$ from $${F}$; reflecting over line $${D}${E}$ gives $\\triangle ${D}${B}'${C}''$, with $${C}''$ on $${F}$'s side.`
        : `$${C}'$ and $${F}$ are on the same side of line $${D}${E}$.`;
    case "ray":
      return `$m\\angle ${E}${D}${Cs}=m\\angle ${A}=m\\angle ${D}$, so $${Cs}$ is on ray $${D}${F}$.`;
    case "rays":
      return `$m\\angle ${E}${D}${Cs}=m\\angle ${A}=m\\angle ${D}$ and $m\\angle ${D}${E}${Cs}=m\\angle ${B}=m\\angle ${E}$, so $${Cs}$ is on rays $${D}${F}$ and $${E}${F}$.`;
    case "circ":
      return `$${D}${Cs}=${A}${C}=${D}${F}$ and $${E}${Cs}=${B}${C}=${E}${F}$.`;
    case "pin":
      throw new Error("pin depends on the path");
    case "conc":
      return `The motions take $${A}$, $${B}$, $${C}$ to $${D}$, $${E}$, $${F}$, so they map $\\triangle ${A}${B}${C}$ onto $\\triangle ${D}${E}${F}$: $\\triangle ${A}${B}${C}\\cong\\triangle ${D}${E}${F}$.`;
  }
}
export function pinText(L: Letters, path: Path, opposite: boolean): string {
  const { A, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  if (path === "sas") return `$${D}${Cs}=${A}${C}=${D}${F}$, so $${Cs}=${F}$.`;
  if (path === "asa")
    return `Rays $${D}${F}$ and $${E}${F}$ meet only at $${F}$, so $${Cs}=${F}$.`;
  return `$${Cs}$ and $${F}$ are on one side of line $${D}${E}$, each $${D}${F}$ from $${D}$ and $${E}${F}$ from $${E}$, so $${Cs}=${F}$.`;
}

export function decoyText(
  L: Letters,
  key: DecoyKey,
  opposite: boolean,
  path: Path,
): string {
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  switch (key) {
    case "segmentTranslate":
      return `Translate $\\triangle ${A}${B}${C}$ so that $\\overline{${A}${B}}$ lands on $\\overline{${D}${E}}$.`;
    case "rotateOntoE":
      return `Rotate $\\triangle ${A}${B}${C}$ about $${D}$ until $${B}$ lands on $${E}$.`;
    case "angleLandsB":
      return `$m\\angle ${D}${B}'${C}'=m\\angle ${B}$, so $${B}'=${E}$.`;
    case "leapStatement":
      return `$${Cs}=${F}$, because $${B}'=${E}$.`;
    case "circular":
      return `$${Cs}=${F}$, because $\\triangle ${A}${B}${C}\\cong\\triangle ${D}${E}${F}$.`;
    case "noReflection":
      return "No reflection is needed, because the triangles are congruent.";
    case "reflectMovesD":
      return `Reflect over line $${D}${E}$, which carries $${D}$ onto $${E}$.`;
    case "wrongSide":
      return rowText(L, "or", !opposite);
    case "rayOnly":
      return `$${Cs}$ is on ray $${D}${F}$, so $${Cs}=${F}$.`;
    case "phantom":
      return path === "sas"
        ? `$m\\angle ${D}${E}${Cs}=m\\angle ${B}=m\\angle ${E}$, so $${Cs}$ is on ray $${E}${F}$.`
        : path === "asa"
          ? `$${D}${Cs}=${A}${C}=${D}${F}$, so $${Cs}=${F}$.`
          : `$m\\angle ${E}${D}${Cs}=m\\angle ${A}=m\\angle ${D}$, so $${Cs}$ is on ray $${D}${F}$.`;
    case "oneMeetingStatement":
      return `The circles about $${D}$ and $${E}$ meet in exactly one point, so $${Cs}=${F}$.`;
  }
}

export interface ScriptLine {
  key: RowKey;
  tex: string;
  /** Reason key → alternative sets of lines that must be above. */
  claim: Partial<Record<ReasonKey, RowKey[][]>>;
  reason: ReasonKey;
}
/** The six lines in canonical order, each with the lines it truly needs.
 * The rotation line puts B' on ray DE, which is all the orientation line
 * and the angle at D need; the angle at E, the circle about E and the
 * conclusion also need B' = E. */
export function proofScript(
  L: Letters,
  path: Path,
  opposite: boolean,
): ScriptLine[] {
  const finish: ScriptLine[] =
    path === "sas"
      ? [
          {
            key: "ray",
            tex: rowText(L, "ray", opposite),
            claim: { ang: [["or"]] },
            reason: "ang",
          },
          {
            key: "pin",
            tex: pinText(L, path, opposite),
            claim: { dist: [["ray"]] },
            reason: "dist",
          },
        ]
      : path === "asa"
        ? [
            {
              key: "rays",
              tex: rowText(L, "rays", opposite),
              claim: { ang: [["or", "be"]] },
              reason: "ang",
            },
            {
              key: "pin",
              tex: pinText(L, path, opposite),
              claim: { lines: [["rays"]] },
              reason: "lines",
            },
          ]
        : [
            {
              key: "circ",
              tex: rowText(L, "circ", opposite),
              // C'' only exists after the reflection line.
              claim: { dist: [opposite ? ["or", "be"] : ["be"]] },
              reason: "dist",
            },
            {
              key: "pin",
              tex: pinText(L, path, opposite),
              claim: { circles: [["circ", "or"]] },
              reason: "circles",
            },
          ];
  return [
    {
      key: "tr",
      tex: rowText(L, "tr", opposite),
      claim: { tr: [[]] },
      reason: "tr",
    },
    {
      key: "be",
      tex: rowText(L, "be", opposite),
      claim: { dist: [["tr"]] },
      reason: "dist",
    },
    {
      key: "or",
      tex: rowText(L, "or", opposite),
      claim: opposite ? { orFlip: [["tr"]] } : { orSame: [["tr"]] },
      reason: opposite ? "orFlip" : "orSame",
    },
    ...finish,
    {
      key: "conc",
      tex: rowText(L, "conc", opposite),
      claim: { def: [["be", "pin"]] },
      reason: "def",
    },
  ];
}
/** Correct reasons of a script, each once, in first-use order. */
export const scriptReasons = (s: ScriptLine[]) => [
  ...new Set(s.map((x) => x.reason)),
];

/** Bank ids by display position, so an id never tells the order. */
export function assembleProof(
  r: Random,
  script: ScriptLine[],
  decoys: { key: DecoyKey; tex: string }[],
  reasons: { key: ReasonKey; label: string }[],
): ProofModel & {
  statementId: (key: RowKey | DecoyKey) => string;
  reasonId: (key: ReasonKey) => string;
} {
  const statements = shuffle(r, [
    ...script.map((s) => ({ key: s.key as RowKey | DecoyKey, tex: s.tex })),
    ...decoys,
  ]);
  const shownReasons = shuffle(r, [...reasons]);
  const sid = new Map(
    statements.map((s, i) => [s.key, `s${"abcdefghijkl"[i]}`]),
  );
  const rid = new Map(
    shownReasons.map((x, i) => [x.key, `r${"abcdefghijkl"[i]}`]),
  );
  if (statements.length > 12 || shownReasons.length > 12)
    throw new Error("A bank holds at most 12 options");
  const claims: ProofModel["claims"] = {};
  for (const s of script) {
    const byReason: Record<string, string[][]> = {};
    for (const [reason, sets] of Object.entries(s.claim) as [
      ReasonKey,
      RowKey[][],
    ][])
      if (rid.has(reason))
        byReason[rid.get(reason)!] = sets.map((set) =>
          set.map((k) => sid.get(k)!),
        );
    claims[sid.get(s.key)!] = byReason;
  }
  const goal = script.at(-1)!;
  return {
    statements: statements.map((s) => ({ id: sid.get(s.key)!, label: s.tex })),
    reasons: shownReasons.map((x) => ({ id: rid.get(x.key)!, label: x.label })),
    claims,
    goal: sid.get(goal.key)!,
    goalTex: goal.tex,
    path: script.map((s): [string, string] => [
      sid.get(s.key)!,
      rid.get(s.reason)!,
    ]),
    statementId: (key) => sid.get(key)!,
    reasonId: (key) => rid.get(key)!,
  };
}

/** A proof shown with some statements blank and every reason given: the
 * learner picks each blank statement from the bank. Checked like every
 * structured-work key: the rule fits, the key is canonical and credited. */
export function blankStatementWork(
  m: ProofModel,
  blank: ReadonlySet<number>,
  label: string,
) {
  const field = (
    bank: "statements" | "reasons",
    given?: string,
  ): WorkField => ({
    kind: "choice",
    label: bank === "statements" ? "Statement" : "Reason",
    bank,
    ...(given !== undefined ? { given } : {}),
  });
  const response: StructuredWorkResponse = {
    kind: "structured-work",
    label,
    layout: "proof",
    mode: "fill",
    goal: m.goalTex,
    banks: [
      { id: "statements", label: "Statement", options: m.statements },
      { id: "reasons", label: "Reason", options: m.reasons },
    ],
    rows: m.path.map(([s, reason], i) => ({
      id: `r${i + 1}`,
      fields: [
        blank.has(i) ? field("statements") : field("statements", s),
        field("reasons", reason),
      ],
    })),
  };
  const grading: WorkGrading = {
    mode: "proof",
    goal: m.goal,
    claims: m.claims,
  };
  const answer = JSON.stringify(
    m.path.map(([s], i) => [blank.has(i) ? s : "", ""]),
  );
  const problem = structuralProblem(response);
  if (problem) throw new Error(problem);
  if (!gradingFits(response, grading)) throw new Error("Rule does not fit");
  if (normalizeStructuredWork(response, answer) !== answer)
    throw new Error(`Answer key is not canonical: ${answer}`);
  if (!gradeStructuredWork(response, grading, answer))
    throw new Error(`Answer key is not credited: ${answer}`);
  return { response, workGrading: grading, answer };
}

/* ------------------------------------------------------ explanations */

/** Why a proof line holds, in words, for worked explanations. */
export function lineExplanation(
  L: Letters,
  key: RowKey,
  path: Path,
  opposite: boolean,
): string {
  const { A, B, C, D, E, F } = L;
  const Cs = imageC(L, opposite);
  switch (key) {
    case "tr":
      return `A translation can carry any point to any other, so one lands $${A}$ on $${D}$. A rotation about $${D}$ keeps $${D}$ in place and turns the ray from $${D}$ through the image of $${B}$ onto ray $${D}${E}$.`;
    case "be":
      return `Rigid motions preserve distance, so $${D}${B}'=${A}${B}$, which is given equal to $${D}${E}$. Ray $${D}${E}$ has only one point at that distance from $${D}$, namely $${E}$.`;
    case "or":
      return opposite
        ? `Translations and rotations keep orientation, so $${D}\\to ${B}'\\to ${C}'$ runs the way $${A}\\to ${B}\\to ${C}$ does, the opposite way to $${D}\\to ${E}\\to ${F}$: $${C}'$ is across line $${D}${E}$ from $${F}$. A reflection over line $${D}${E}$ leaves $${D}$ and $${B}'$ in place and carries $${C}'$ to $${F}$'s side.`
        : `Translations and rotations keep orientation, so $${D}\\to ${B}'\\to ${C}'$ runs the way $${A}\\to ${B}\\to ${C}$ does, the same way as $${D}\\to ${E}\\to ${F}$: $${C}'$ is already on $${F}$'s side of line $${D}${E}$, and no reflection is needed.`;
    case "ray":
      return `Angle measure is preserved and $\\angle ${A}\\cong\\angle ${D}$, so ray $${D}${Cs}$ makes the same angle with $\\overline{${D}${E}}$ as ray $${D}${F}$, on the same side. Only one ray does that.`;
    case "rays":
      return `Angle measure is preserved, $\\angle ${A}\\cong\\angle ${D}$ and $\\angle ${B}\\cong\\angle ${E}$, so $${Cs}$ is on ray $${D}${F}$ and on ray $${E}${F}$.`;
    case "pin":
      return path === "sas"
        ? `On ray $${D}${F}$, only one point is $${A}${C}=${D}${F}$ from $${D}$: the point $${F}$.`
        : path === "asa"
          ? `Lines $${D}${F}$ and $${E}${F}$ are different lines, because $${D}$, $${E}$ and $${F}$ are not on one line, so they share only $${F}$. $${Cs}$ is on both, so it is $${F}$.`
          : `The circle about $${D}$ of radius $${D}${F}$ and the circle about $${E}$ of radius $${E}${F}$ meet in at most two points, mirror images across line $${D}${E}$. Only one of them is on $${F}$'s side, so $${Cs}=${F}$.`;
    case "circ":
      return `Distance is preserved: $${Cs}$ is $${A}${C}$ from $${D}$ and $${B}${C}$ from $${E}$, and these equal $${D}${F}$ and $${E}${F}$.`;
    case "conc":
      return `All three vertices land on their matches, so the whole triangle lands on $\\triangle ${D}${E}${F}$. That is what congruent means, so the reason is the definition. CPCTC and the criteria cannot be cited: they are proved from this definition.`;
  }
}

/** Which other orders of the six lines are also valid, and why. */
export function orderNote(L: Letters, path: Path, opposite: boolean): string {
  const { B, D, E } = L;
  if (path === "sas")
    return `Line 2 may come anywhere after line 1 and before the last line: it needs $${B}'$ from line 1, and landing $${B}'$ on $${E}$ is used only by the conclusion. Each other line needs the one before it.`;
  if (path === "asa" || opposite)
    return "Lines 2 and 3 may come in either order: each needs only line 1, and line 4 uses both.";
  return `Line 3 may come anywhere between line 1 and line 5: the side of line $${D}${E}$ matters only for the last landing. Line 4 needs line 2.`;
}
