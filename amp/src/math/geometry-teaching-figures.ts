import { circleDiagram, scene as sceneOf, triangle } from "./scene/author.js";
import type { SemanticFigure } from "./contracts.js";
import type { Element, Point, Scene } from "./scene/spec.js";

/** A scene as a problem figure. */
export const sceneFigure = (scene: Scene): SemanticFigure => ({
  kind: "scene",
  scene,
});

/**
 * Teaching figures for geometry and trigonometry problems whose givens are
 * easier to read on a drawing: labeled triangles, circles with chords,
 * secants and tangents, transversals, and parallelograms. Every figure is
 * composed from existing scene components and primitives; none of them
 * carries an answer. A figure shows only what the prompt states, with the
 * quantity the learner finds drawn as "?" (or left unmarked).
 *
 * Figures drawn to the true shape of their givens need no caption. A figure
 * whose proportions the givens do not fix (intersecting chords, secants) is
 * a schematic and says "Not to scale".
 */

type Vec = Point;
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const len = (a: Vec) => Math.hypot(a[0], a[1]);
const unit = (a: Vec): Vec => mul(a, 1 / (len(a) || 1));
const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a: Vec, b: Vec, t: number): Vec => add(a, mul(sub(b, a), t));
const perp = (a: Vec): Vec => [-a[1], a[0]];
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const dirDeg = (v: Vec) => deg(Math.atan2(v[1], v[0]));

/* ------------------------------------------------------------------ */
/* Primitive building blocks, sized in figure units                    */
/* ------------------------------------------------------------------ */

const alignAway = (out: Vec): [-1 | 0 | 1, -1 | 0 | 1] => [
  out[0] > 0.3 ? -1 : out[0] < -0.3 ? 1 : 0,
  out[1] > 0.3 ? 1 : out[1] < -0.3 ? -1 : 0,
];

/** A point mark. */
const dot = (id: string, p: Vec): Element => ({
  type: "point",
  id,
  at: p,
  r: 3.5,
});
/** A bold vertex or line name, set away from the figure along `out`. */
const name = (id: string, text: string, p: Vec, out: Vec): Element => {
  const u = unit(out);
  return {
    type: "text",
    id,
    at: p,
    text,
    font: "math",
    bold: true,
    align: alignAway(u),
    offset: [u[0] * 7, -u[1] * 7],
  };
};
const seg = (
  id: string,
  from: Vec,
  to: Vec,
  o: {
    dash?: boolean;
    width?: number;
    stroke?: "ink" | "accent" | "warm";
  } = {},
): Element => ({
  type: "segment",
  id,
  from,
  to,
  stroke: o.stroke ?? "ink",
  width: o.width ?? 2.25,
  ...(o.dash ? { dash: "dash" as const } : {}),
});
/** A value written beside a segment, on the side of `normal`; "?" masks. */
function segLabel(
  id: string,
  text: string | null,
  a: Vec,
  b: Vec,
  normal: Vec,
  o: { t?: number; distance?: number } = {},
): Element {
  const p = lerp(a, b, o.t ?? 0.5);
  const n = unit(normal);
  const d = o.distance ?? 11;
  return {
    type: "text",
    id,
    at: p,
    text: text ?? "?",
    font: "math",
    bold: text === null,
    derived: text === null,
    halo: true,
    align: alignAway(n),
    offset: [n[0] * d, -n[1] * d],
  };
}
/** The unit normal of a→b that points away from `inside`. */
const awayFrom = (a: Vec, b: Vec, inside: Vec): Vec => {
  const n = unit(perp(sub(b, a)));
  const m = mid(a, b);
  return n[0] * (m[0] - inside[0]) + n[1] * (m[1] - inside[1]) >= 0
    ? n
    : mul(n, -1);
};
/** Congruence ticks across a segment, `count` of them. */
function ticks(
  id: string,
  a: Vec,
  b: Vec,
  count: number,
  stroke: "ink" | "accent" | "warm" = "ink",
): Element[] {
  const u = unit(sub(b, a)),
    n = perp(u),
    c = mid(a, b);
  return Array.from({ length: count }, (_, k): Element => {
    const p = add(c, mul(u, (k - (count - 1) / 2) * 0.22));
    return {
      type: "tick",
      id: `${id}${k}`,
      at: p,
      dir: [n[0], -n[1]],
      length: 9,
      stroke,
      width: 2,
    };
  });
}
/** A right-angle square at `v` between the directions toward p and q. */
function rightMark(id: string, v: Vec, p: Vec, q: Vec, size = 0.38): Element {
  const u = unit(sub(p, v)),
    w = unit(sub(q, v));
  return {
    type: "polyline",
    id,
    points: [
      add(v, mul(u, size)),
      add(v, mul(add(u, w), size)),
      add(v, mul(w, size)),
    ],
    stroke: "ink",
    width: 1.75,
  };
}
/** Arcs for an angle at v between rays toward p and q, with an optional label. */
function angleMark(
  id: string,
  v: Vec,
  p: Vec,
  q: Vec,
  o: {
    arcs?: number;
    label?: string | null;
    stroke?: "accent" | "warm" | "gold";
    r?: number;
  } = {},
): Element[] {
  let from = dirDeg(sub(p, v)),
    to = dirDeg(sub(q, v));
  if ((((to - from) % 360) + 360) % 360 > 180) [from, to] = [to, from];
  if (to < from) to += 360;
  const r0 = o.r ?? 0.62;
  const out: Element[] = Array.from(
    { length: o.arcs ?? 1 },
    (_, k): Element => ({
      type: "arc",
      id: `${id}a${k}`,
      center: v,
      r: r0 + 0.14 * k,
      from,
      to,
      stroke: o.stroke ?? "accent",
      width: 2,
    }),
  );
  if (o.label !== undefined) {
    const bis = rad((from + to) / 2);
    const half = Math.max(0.2, rad((to - from) / 2));
    const reach = Math.max(r0 + 0.5, 0.62 / Math.sin(half));
    out.push({
      type: "text",
      id: `${id}t`,
      at: add(v, [Math.cos(bis) * reach, Math.sin(bis) * reach]),
      text: o.label ?? "?",
      font: "math",
      size: "sm",
      bold: true,
      derived: o.label === null,
      color: o.stroke ?? "accent",
      halo: true,
      align: [0, 0],
    });
  }
  return out;
}
/** Chevrons on a segment: the mark for "these lines are parallel". */
function parallelMark(
  id: string,
  a: Vec,
  b: Vec,
  count = 1,
  t = 0.5,
): Element[] {
  const u = unit(sub(b, a)),
    n = perp(u),
    c = lerp(a, b, t);
  return Array.from({ length: count }, (_, k): Element => {
    const tip = add(c, mul(u, (k - (count - 1) / 2) * 0.3 + 0.12));
    return {
      type: "polyline",
      id: `${id}${k}`,
      points: [
        add(sub(tip, mul(u, 0.26)), mul(n, 0.2)),
        tip,
        sub(sub(tip, mul(u, 0.26)), mul(n, 0.2)),
      ],
      stroke: "ink",
      width: 1.75,
    };
  });
}
/** "Not to scale", under the figure's right edge. */
function notToScale(points: Vec[], edge: "left" | "right" = "right"): Element {
  const x1 =
      edge === "right"
        ? Math.max(...points.map((p) => p[0]))
        : Math.min(...points.map((p) => p[0])),
    y0 = Math.min(...points.map((p) => p[1]));
  return {
    type: "text",
    id: "scale",
    at: [x1, y0],
    text: "Not to scale",
    font: "sans",
    size: "sm",
    color: "muted",
    align: [edge === "right" ? 1 : -1, -1],
    offset: [0, 10],
  };
}
const finish = (
  title: string,
  elements: (Element | { element(): Element })[],
  note?: string,
): Scene => sceneOf(...elements).build({ title, ...(note ? { note } : {}) });

/* ------------------------------------------------------------------ */
/* Triangles                                                           */
/* ------------------------------------------------------------------ */

/** Vertices A, B, C of the triangle with sides a = BC, b = CA and c = AB,
 * with AB along the x axis. */
export function triangleFromSides(
  a: number,
  b: number,
  c: number,
): [Vec, Vec, Vec] {
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  return [
    [0, 0],
    [c, 0],
    [b * cosA, b * sinA],
  ];
}
/** The sides a, b, c of a triangle from two angles (degrees) and the side a
 * opposite the first. */
export function sidesFromAngles(A: number, B: number, a: number) {
  const C = 180 - A - B;
  const k = a / Math.sin(rad(A));
  return { a, b: k * Math.sin(rad(B)), c: k * Math.sin(rad(C)) };
}
export const interior = (P: Vec[], i: number) => {
  const p = P[i]!,
    u = unit(sub(P[(i + 1) % 3]!, p)),
    w = unit(sub(P[(i + 2) % 3]!, p));
  return deg(Math.acos(Math.max(-1, Math.min(1, u[0] * w[0] + u[1] * w[1]))));
};

export type TriangleLabels = {
  /** Vertex names, in order A, B, C. */
  names: [string, string, string];
  /** Side labels: sides[0] is AB, sides[1] is BC, sides[2] is CA. A null is
   * the unknown, drawn "?". Omitted means unmarked. */
  sides?: [
    string | null | undefined,
    string | null | undefined,
    string | null | undefined,
  ];
  /** Angle labels at A, B, C. */
  angles?: [
    string | null | undefined,
    string | null | undefined,
    string | null | undefined,
  ];
  ticks?: [number, number, number];
  right?: number;
};

/** A labeled triangle drawn to the true shape of its points. */
export function labeledTriangle(
  points: [Vec, Vec, Vec],
  l: TriangleLabels,
  title: string,
  extra: Element[] = [],
  note?: string,
): Scene {
  const t = triangle(points)
    .names(...l.names)
    .id("t");
  ([0, 1, 2] as const).forEach((i) => {
    const s = l.sides?.[i];
    const k = l.ticks?.[i];
    if (s !== undefined || k)
      t.side(i, {
        ...(s !== undefined ? { label: s } : {}),
        ...(k ? { ticks: k } : {}),
      });
    const a = l.angles?.[i];
    if (l.right === i) t.angle(i, { mark: "right" });
    else if (a !== undefined) t.angle(i, { mark: "arc", label: a });
  });
  return finish(title, [t, ...extra], note);
}

/** Law of sines and cosines: the triangle from its measured parts. The
 * givens fix the shape, so the drawing is true to them. */
export function obliqueFigure(o: {
  names?: [string, string, string];
  sides: [number, number, number]; // a, b, c
  shown: { a?: string | null; b?: string | null; c?: string | null };
  angles: { A?: string | null; B?: string | null; C?: string | null };
}): Scene {
  const [a, b, c] = o.sides;
  const P = triangleFromSides(a, b, c);
  const names = o.names ?? ["A", "B", "C"];
  const [la, lb, lc] = names.map((n) => n.toLowerCase()) as [
    string,
    string,
    string,
  ];
  return labeledTriangle(
    P,
    {
      names,
      // AB is c, BC is a, CA is b.
      sides: [
        o.shown.c === undefined ? undefined : fmtSide(lc, o.shown.c),
        o.shown.a === undefined ? undefined : fmtSide(la, o.shown.a),
        o.shown.b === undefined ? undefined : fmtSide(lb, o.shown.b),
      ],
      angles: [o.angles.A, o.angles.B, o.angles.C],
    },
    `A triangle ${names.join("")} with the given sides and angles marked`,
  );
}
const fmtSide = (letter: string, v: string | null) =>
  v === null ? null : `${letter} = ${v}`;
export { fmtSide as sideLabel };

/** Isosceles triangle ABC with AB = AC and the apex angle at A given. */
export function isoscelesFigure(apex: number): Scene {
  const half = rad(apex / 2);
  const P: [Vec, Vec, Vec] = [
    [0, 0],
    [-Math.sin(half) * 4, -Math.cos(half) * 4],
    [Math.sin(half) * 4, -Math.cos(half) * 4],
  ];
  // Orient counterclockwise so the sides and angles read A, B, C.
  const ccw: [Vec, Vec, Vec] = [P[0], P[1], P[2]];
  return labeledTriangle(
    ccw,
    {
      names: ["A", "B", "C"],
      ticks: [1, 0, 1],
      angles: [`${apex}°`, null, undefined],
    },
    "Isosceles triangle ABC with AB equal to AC",
  );
}

/** Triangle ABC with the midpoints D of AB and E of AC joined. */
export function midsegmentFigure(de: string, bc: string): Scene {
  const A: Vec = [1.6, 3.6],
    B: Vec = [0, 0],
    C: Vec = [5.2, 0];
  const D = mid(A, B),
    E = mid(A, C);
  return finish("Triangle ABC with the midpoints D and E joined", [
    triangle([B, C, A]).names("B", "C", "A").id("t"),
    seg("de", D, E, { stroke: "accent", width: 2.5 }),
    dot("d", D),
    dot("e", E),
    name("dn", "D", D, [-1, 0.2]),
    name("en", "E", E, [1, 0.2]),
    ...ticks("ad", A, D, 1),
    ...ticks("db", D, B, 1),
    ...ticks("ae", A, E, 2),
    ...ticks("ec", E, C, 2),
    segLabel("del", de, D, E, [0, 1], { distance: 12 }),
    segLabel("bcl", bc, B, C, [0, -1]),
  ]);
}

/** Triangle ABC with median AM and centroid G; one length may be given. */
export function medianFigure(given: "AM" | "GM", value: number): Scene {
  const A: Vec = [1.4, 4.2],
    B: Vec = [0, 0],
    C: Vec = [5.4, 0];
  const M = mid(B, C);
  const G: Vec = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  return finish(
    "Triangle ABC with the median AM and the point G where the medians meet",
    [
      triangle([B, C, A]).names("B", "C", "A").id("t"),
      seg("am", A, M, { stroke: "accent", width: 2.5 }),
      dot("m", M),
      dot("g", G),
      name("mn", "M", M, [0, -1]),
      name("gn", "G", G, [1, 0.4]),
      ...ticks("bm", B, M, 1),
      ...ticks("mc", M, C, 1),
      segLabel(
        "len",
        `${given} = ${value}`,
        given === "AM" ? A : G,
        M,
        [-1, 0],
        { distance: 12, t: given === "AM" ? 0.25 : 0.5 },
      ),
    ],
    `The labeled length is ${given}.`,
  );
}

/** The altitude figure behind the laws of sines and cosines. `foot` names
 * the foot D; `from` is the vertex index the altitude leaves. */
export function altitudeFigure(o: {
  names: [string, string, string];
  sides: [number, number, number]; // a, b, c lengths used to draw the shape
  from: 0 | 2;
  hLabel?: string;
  sideLabels: [string | undefined, string | undefined, string | undefined]; // AB, BC, CA
  footLabels?: [string | undefined, string | undefined]; // the two parts of the base
}): Scene {
  const [a, b, c] = o.sides;
  const P = triangleFromSides(a, b, c);
  const [A, B, C] = P;
  const [nA, nB, nC] = o.names;
  // Altitude from C onto AB (from 2) or from A onto BC (from 0).
  const foot = (p: Vec, q: Vec, r: Vec): Vec => {
    const u = unit(sub(r, q));
    return add(q, mul(u, (p[0] - q[0]) * u[0] + (p[1] - q[1]) * u[1]));
  };
  const apex = o.from === 2 ? C : A;
  const base: [Vec, Vec] = o.from === 2 ? [A, B] : [B, C];
  const D = foot(apex, base[0], base[1]);
  const centroid: Vec = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  const els: (Element | { element(): Element })[] = [
    triangle([A, B, C])
      .names(nA, nB, nC)
      .side(0, o.sideLabels[0] ? { label: o.sideLabels[0] } : {})
      .side(1, o.sideLabels[1] ? { label: o.sideLabels[1] } : {})
      .side(2, o.sideLabels[2] ? { label: o.sideLabels[2] } : {})
      .id("t"),
    seg("alt", apex, D, { dash: true, stroke: "accent" }),
    dot("d", D),
    name("dn", "D", D, awayFrom(base[0], base[1], centroid)),
    rightMark("rt", D, base[0], apex),
    ...(o.hLabel
      ? [segLabel("h", o.hLabel, apex, D, [1, 0], { distance: 10, t: 0.5 })]
      : []),
  ];
  if (o.footLabels) {
    const [l1, l2] = o.footLabels;
    const away = awayFrom(base[0], base[1], centroid);
    if (l1) els.push(segLabel("p1", l1, base[0], D, away, { distance: 18 }));
    if (l2) els.push(segLabel("p2", l2, D, base[1], away, { distance: 18 }));
  }
  return finish(
    `Triangle ${nA}${nB}${nC} with the altitude from ${o.from === 2 ? nC : nA} meeting the opposite side at D`,
    els,
  );
}

/** The triangle proof of the angle sum: line ℓ through C parallel to AB. */
export function angleSumFigure(): Scene {
  const A: Vec = [0, 0],
    B: Vec = [6, 0],
    C: Vec = [2.4, 3.2];
  const L0: Vec = [-1.2, 3.2],
    L1: Vec = [7.2, 3.2];
  const Ap: Vec = [0.4, 3.2];
  return finish("Triangle ABC and a line through C parallel to AB", [
    triangle([A, B, C]).names("A", "B", "C").id("t"),
    seg("l", L0, L1, { width: 2 }),
    ...parallelMark("pl", L0, L1, 1, 0.9),
    ...parallelMark("pab", A, B, 1, 0.5),
    dot("ap", Ap),
    name("apn", "A′", Ap, [0, 1]),
    name("ln", "ℓ", L1, [1, 0.6]),
    ...angleMark("x", C, Ap, A, { stroke: "accent", r: 0.8 }),
    ...angleMark("y", A, C, B, { stroke: "warm", r: 0.7 }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Lines, angles and parallelograms                                    */
/* ------------------------------------------------------------------ */

/** Parallel lines ℓ and m cut by a transversal t, angles numbered 1–8:
 * 1–4 at the upper crossing and 5–8 at the lower, each group read left to
 * right, upper pair first. */
export function transversalFigure(): Scene {
  const Y1 = 2.4,
    Y0 = 0;
  // The transversal runs from lower left to upper right.
  const X = (y: number): Vec => [3.4 + (y - 1.2) * 0.62, y];
  const p1 = X(Y1),
    p0 = X(Y0);
  const t0 = X(-0.9),
    t1 = X(3.3);
  const xs = [-0.6, 7.2];
  const q = 0.95;
  const num = (
    id: string,
    n: number,
    c: Vec,
    dx: number,
    dy: number,
  ): Element => ({
    type: "text",
    id,
    at: [c[0] + dx * q, c[1] + dy * q],
    text: String(n),
    font: "math",
    size: "sm",
    bold: true,
    color: "accent",
    halo: true,
    align: [0, 0],
  });
  return finish(
    "Two parallel lines cut by a transversal, with eight numbered angles",
    [
      seg("l", [xs[0]!, Y1], [xs[1]!, Y1]),
      seg("m", [xs[0]!, Y0], [xs[1]!, Y0]),
      seg("t", t0, t1),
      ...parallelMark("pl", [xs[0]!, Y1], [xs[1]!, Y1], 1, 0.12),
      ...parallelMark("pm", [xs[0]!, Y0], [xs[1]!, Y0], 1, 0.12),
      name("ln", "ℓ", [xs[1]!, Y1], [1, 0]),
      name("mn", "m", [xs[1]!, Y0], [1, 0]),
      name("tn", "t", t1, [0.3, 1]),
      num("a1", 1, p1, -0.85, 0.55),
      num("a2", 2, p1, 0.85, 0.55),
      num("a3", 3, p1, -0.85, -0.55),
      num("a4", 4, p1, 0.85, -0.55),
      num("a5", 5, p0, -0.85, 0.55),
      num("a6", 6, p0, 0.85, 0.55),
      num("a7", 7, p0, -0.85, -0.55),
      num("a8", 8, p0, 0.85, -0.55),
    ],
  );
}

/** Lines AC and BD crossing at O, with angles AOB and COD labeled. */
export function crossingFigure(left: string, right: string): Scene {
  const O: Vec = [0, 0];
  const u: Vec = [Math.cos(rad(25)), Math.sin(rad(25))];
  const w: Vec = [Math.cos(rad(115)), Math.sin(rad(115))];
  // Line AC runs along u and line BD along w, with B opposite D; the left
  // wedge AOB and the right wedge COD are the labeled angles.
  const A = mul(u, -3),
    C = mul(u, 3);
  const B = mul(w, -3),
    D = mul(w, 3);
  return finish("Lines AC and BD crossing at O", [
    seg("ac", A, C),
    seg("bd", B, D),
    dot("o", O),
    name("on", "O", O, [0.9, -0.9]),
    name("an", "A", A, mul(u, -1)),
    name("cn", "C", C, u),
    name("bn", "B", B, mul(w, -1)),
    name("dn", "D", D, w),
    ...angleMark("aob", O, A, B, { label: left, stroke: "accent", r: 0.75 }),
    ...angleMark("cod", O, C, D, { label: right, stroke: "warm", r: 0.75 }),
  ]);
}

/** Segment XY with its perpendicular bisector ℓ and a point P on ℓ. */
export function bisectorFigure(x: string, y: string): Scene {
  const X: Vec = [-3, 0],
    Y: Vec = [3, 0],
    M: Vec = [0, 0],
    P: Vec = [0, 2.6];
  return finish(
    `Segment ${x}${y} with its perpendicular bisector ℓ and a point P on ℓ`,
    [
      seg("xy", X, Y),
      seg("l", [0, -1.6], [0, 3.6], { stroke: "accent" }),
      seg("px", P, X, { dash: true, width: 1.75 }),
      seg("py", P, Y, { dash: true, width: 1.75 }),
      dot("p", P),
      name("pn", "P", P, [0.9, 0.3]),
      name("xn", x, X, [-1, -0.4]),
      name("yn", y, Y, [1, -0.4]),
      name("ln", "ℓ", [0, 3.6], [0.6, 1]),
      ...ticks("tx", X, M, 1),
      ...ticks("ty", M, Y, 1),
      rightMark("rt", M, Y, P),
    ],
  );
}

/** P is the same distance from X and Y; no bisector is drawn. */
export function equidistantFigure(x: string, y: string): Scene {
  const X: Vec = [-3, 0],
    Y: Vec = [3, 0],
    P: Vec = [0.6, 2.6];
  return finish(`Point P joined to ${x} and ${y}, with PX equal to PY`, [
    seg("xy", X, Y, { width: 1.75, dash: true }),
    seg("px", P, X),
    seg("py", P, Y),
    dot("p", P),
    name("pn", "P", P, [0.3, 1]),
    name("xn", x, X, [-1, -0.4]),
    name("yn", y, Y, [1, -0.4]),
    ...ticks("tpx", P, X, 2),
    ...ticks("tpy", P, Y, 2),
  ]);
}

/** A parallelogram ABCD (counterclockwise from A at the lower left). */
export function parallelogramPoints(
  angleA = 70,
  ab = 6,
  ad = 3.4,
): [Vec, Vec, Vec, Vec] {
  const A: Vec = [0, 0];
  const B: Vec = [ab, 0];
  const D: Vec = [ad * Math.cos(rad(angleA)), ad * Math.sin(rad(angleA))];
  return [A, B, add(B, D), D];
}
export type ParallelogramMarks = {
  /** Draw the diagonals and name their crossing E. */
  diagonals?: boolean;
  /** Right-angle marks at every vertex: a rectangle. */
  rectangle?: boolean;
  parallel?: boolean;
  /** Labels on the diagonals' parts or whole: AE, EC, AC, BD. */
  labels?: {
    ae?: string | null;
    ec?: string | null;
    ac?: string | null;
    bd?: string | null;
  };
  /** Angle labels at A and B. */
  angles?: { A?: string | null; B?: string | null };
  angleA?: number;
};
export function parallelogramFigure(m: ParallelogramMarks): Scene {
  const rectangle = !!m.rectangle;
  const [A, B, C, D] = rectangle
    ? ([
        [0, 0],
        [6, 0],
        [6, 3.4],
        [0, 3.4],
      ] as [Vec, Vec, Vec, Vec])
    : parallelogramPoints(m.angleA ?? 70);
  const E = mid(A, C);
  const centroid = E;
  const els: Element[] = [
    {
      type: "polygon",
      id: "body",
      points: [A, B, C, D],
      fill: "none",
      stroke: "ink",
      width: 2.5,
    },
    name("an", "A", A, sub(A, centroid)),
    name("bn", "B", B, sub(B, centroid)),
    name("cn", "C", C, sub(C, centroid)),
    name("dn", "D", D, sub(D, centroid)),
  ];
  if (m.parallel) {
    els.push(
      ...parallelMark("pab", A, B, 1),
      ...parallelMark("pdc", D, C, 1),
      ...parallelMark("pad", A, D, 2),
      ...parallelMark("pbc", B, C, 2),
    );
  }
  if (rectangle)
    els.push(
      rightMark("ra", A, B, D),
      rightMark("rb", B, C, A),
      rightMark("rc", C, D, B),
      rightMark("rd", D, A, C),
    );
  if (m.diagonals) {
    els.push(
      seg("ac", A, C, { stroke: "accent", width: 2 }),
      seg("bd", B, D, { stroke: "accent", width: 2 }),
      dot("e", E),
      name("en", "E", E, [0.1, -1]),
    );
    const l = m.labels ?? {};
    // Diagonal labels sit on the side away from the other diagonal's slope.
    if (l.ae !== undefined)
      els.push(
        segLabel(
          "lae",
          l.ae === null ? null : `AE = ${l.ae}`,
          A,
          E,
          [0.5, -1],
          { t: 0.5, distance: 12 },
        ),
      );
    if (l.ec !== undefined)
      els.push(
        segLabel(
          "lec",
          l.ec === null ? null : `EC = ${l.ec}`,
          E,
          C,
          [-0.5, 1],
          { t: 0.5, distance: 12 },
        ),
      );
    if (l.ac !== undefined)
      els.push(
        segLabel(
          "lac",
          l.ac === null ? null : `AC = ${l.ac}`,
          A,
          C,
          [-0.4, 1],
          { t: 0.3, distance: 12 },
        ),
      );
    if (l.bd !== undefined)
      els.push(
        segLabel("lbd", l.bd === null ? null : `BD = ${l.bd}`, B, D, [0.5, 1], {
          t: 0.3,
          distance: 12,
        }),
      );
  }
  if (m.angles?.A !== undefined)
    els.push(
      ...angleMark("va", A, B, D, {
        label: m.angles.A,
        stroke: "accent",
        r: 0.7,
      }),
    );
  if (m.angles?.B !== undefined)
    els.push(
      ...angleMark("vb", B, C, A, {
        label: m.angles.B,
        stroke: "warm",
        r: 0.7,
      }),
    );
  return finish(
    `${rectangle ? "Rectangle" : "Parallelogram"} ABCD${m.diagonals ? " with its diagonals meeting at E" : ""}`,
    els,
  );
}

/* ------------------------------------------------------------------ */
/* Circles                                                             */
/* ------------------------------------------------------------------ */

/** Tangent PT from an outside point P to a circle with center O. Lengths are
 * those of the problem; unknown ones are null. The drawing is true to the
 * radius and OP. */
export function tangentFigure(o: {
  radius: number;
  op: number;
  labels: { r?: string | null; op?: string | null; pt?: string | null };
  angleTOP?: string | null;
  angleOPT?: string | null;
}): Scene {
  const exact = o.op / o.radius;
  // A long OP shrinks the circle to a dot and a short one leaves no room
  // to label the tangent: keep the right angle at T and
  // draw the figure as a schematic.
  const schematic = o.angleTOP === undefined && (exact > 2.3 || exact < 1.15);
  const dist = schematic ? Math.min(2.3, Math.max(1.15, exact)) : exact;
  const t = deg(Math.acos(1 / dist));
  const c = circleDiagram({
    points: [{ name: "T", at: t }],
    outside: [{ name: "P", at: 0, dist }],
    center: true,
    segments: [
      {
        from: "O",
        to: "T",
        ...(o.labels.r !== undefined ? { label: o.labels.r } : {}),
      },
      {
        from: "O",
        to: "P",
        ...(o.labels.op !== undefined ? { label: o.labels.op } : {}),
        dash: true,
      },
      {
        from: "P",
        to: "T",
        ...(o.labels.pt !== undefined ? { label: o.labels.pt } : {}),
      },
    ],
    angles: [
      { at: "T", from: "O", to: "P", mark: "right" },
      ...(o.angleTOP !== undefined
        ? [
            {
              at: "O" as const,
              from: "T",
              to: "P",
              mark: "arc" as const,
              label: o.angleTOP,
            },
          ]
        : []),
      ...(o.angleOPT !== undefined
        ? [
            {
              at: "P" as const,
              from: "O",
              to: "T",
              mark: "arc" as const,
              label: o.angleOPT,
            },
          ]
        : []),
    ],
  });
  const title = "A circle with center O and a tangent segment PT";
  return schematic
    ? finish(title, [
        c,
        {
          type: "text",
          id: "scale",
          at: [dist, -1],
          text: "Not to scale",
          font: "sans",
          size: "sm",
          color: "muted",
          align: [1, -1],
          offset: [0, 8],
        },
      ])
    : c.scene({ title });
}

/** Two tangent segments PA and PB from an outside point. */
export function twoTangentsFigure(pa: string, pb: string): Scene {
  const dist = 2.2;
  const t = deg(Math.acos(1 / dist));
  const c = circleDiagram({
    points: [
      { name: "A", at: t },
      { name: "B", at: -t },
    ],
    outside: [{ name: "P", at: 0, dist }],
    center: true,
    segments: [
      { from: "P", to: "A", label: pa },
      { from: "P", to: "B", label: pb },
    ],
    angles: [
      { at: "A", from: "O", to: "P", mark: "right" },
      { at: "B", from: "O", to: "P", mark: "right" },
    ],
  });
  return c.scene({
    title: "A circle with tangent segments PA and PB from the point P",
  });
}

/** Points of a convex polygon inscribed in the unit circle at the given
 * directions, named in order. */
function inscribed(names: string[], at: number[]) {
  return names.map((n, i) => ({ name: n, at: at[i]! }));
}

/** Regular n-gon inscribed in a circle with center O; the central angle
 * between two neighbors is marked (unknown) and the radii labeled. */
export function regularPolygonFigure(
  n: number,
  o: { radiusLabel?: string; central?: "unknown"; drawSides?: boolean },
): Scene {
  const names = ["A", "B", "C", "D", "E", "F"].slice(0, n);
  const at = names.map((_, i) => 90 - (360 / n) * i);
  const segments = names.map((p, i) => ({
    from: p,
    to: names[(i + 1) % n]!,
  }));
  const c = circleDiagram({
    points: inscribed(names, at),
    center: true,
    segments: [
      ...segments,
      {
        from: "O",
        to: "A",
        ...(o.radiusLabel ? { label: o.radiusLabel } : {}),
      },
      {
        from: "O",
        to: "B",
        ...(o.radiusLabel ? { label: o.radiusLabel } : {}),
      },
    ],
    ...(o.central
      ? {
          angles: [
            { at: "O", from: "A", to: "B", mark: "arc" as const, label: null },
          ],
        }
      : {}),
  });
  return c.scene({
    title: `A regular polygon with ${n} sides inscribed in a circle with center O`,
  });
}

/** Quadrilateral ABCD inscribed in a circle; `known` names the vertex whose
 * angle is given and the opposite vertex is unknown. */
export function cyclicQuadrilateralFigure(
  angleA: number,
  shown: Record<string, string | null>,
): Scene {
  // ∠A intercepts the arc BCD of 2·angleA degrees.
  const arc = 2 * angleA;
  const rest = 360 - arc;
  const aAt = 90;
  const bAt = aAt + 0.45 * rest;
  const cAt = bAt + arc * 0.5;
  const dAt = bAt + arc;
  const pos: Record<string, number> = { A: aAt, B: bAt, C: cAt, D: dAt };
  const nb = (p: string) =>
    ({ A: ["D", "B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] })[p]!;
  const c = circleDiagram({
    points: Object.entries(pos).map(([nm, a]) => ({ name: nm, at: a % 360 })),
    center: false,
    segments: [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "D" },
      { from: "D", to: "A" },
    ],
    angles: Object.entries(shown).map(([v, label]) => ({
      at: v,
      from: nb(v)[0]!,
      to: nb(v)[1]!,
      mark: "arc" as const,
      label,
    })),
  });
  return c.scene({ title: "Quadrilateral ABCD inscribed in a circle" });
}

/** Right triangle inscribed in a circle whose center is on the hypotenuse. */
export function rightTriangleCircleFigure(
  a: number,
  b: number,
  h: number,
): Scene {
  // Hypotenuse AB is a diameter (A at 180°, B at 0°); C splits it into legs
  // BC = a and CA = b.
  const theta = deg(2 * Math.asin(a / h));
  const c = circleDiagram({
    points: [
      { name: "A", at: 180 },
      { name: "B", at: 0 },
      { name: "C", at: theta },
    ],
    center: true,
    segments: [
      { from: "A", to: "B" },
      { from: "B", to: "C", label: `${a}` },
      { from: "C", to: "A", label: `${b}` },
    ],
    angles: [{ at: "C", from: "A", to: "B", mark: "right" }],
  });
  return c.scene({
    title: "A right triangle inscribed in a circle, its hypotenuse a diameter",
  });
}

const circumcenter = (A: Vec, B: Vec, C: Vec): Vec => {
  const d =
    2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  const s = (p: Vec) => p[0] * p[0] + p[1] * p[1];
  return [
    (s(A) * (B[1] - C[1]) + s(B) * (C[1] - A[1]) + s(C) * (A[1] - B[1])) / d,
    (s(A) * (C[0] - B[0]) + s(B) * (A[0] - C[0]) + s(C) * (B[0] - A[0])) / d,
  ];
};
const incenter = (A: Vec, B: Vec, C: Vec): { c: Vec; r: number } => {
  const a = len(sub(B, C)),
    b = len(sub(C, A)),
    c = len(sub(A, B));
  const p = a + b + c;
  const ctr: Vec = [
    (a * A[0] + b * B[0] + c * C[0]) / p,
    (a * A[1] + b * B[1] + c * C[1]) / p,
  ];
  const area =
    Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0])) / 2;
  return { c: ctr, r: (2 * area) / p };
};

/** Triangle ABC with its circumscribed or inscribed circle; the center is
 * the thing the problem asks to locate, so it is not marked. */
export function triangleCircleFigure(kind: "circum" | "in"): Scene {
  const A: Vec = [0, 0],
    B: Vec = [6, 0],
    C: Vec = [2.2, 4.4];
  const els: (Element | { element(): Element })[] = [
    triangle([A, B, C]).names("A", "B", "C").id("t"),
  ];
  if (kind === "circum") {
    const O = circumcenter(A, B, C);
    els.push({
      type: "circle",
      id: "circle",
      center: O,
      r: len(sub(A, O)),
      stroke: "accent",
      width: 2.25,
    });
  } else {
    const { c, r } = incenter(A, B, C);
    els.push({
      type: "circle",
      id: "circle",
      center: c,
      r,
      stroke: "accent",
      width: 2.25,
    });
  }
  return finish(
    kind === "circum"
      ? "Triangle ABC with the circle through all three vertices"
      : "Triangle ABC with the circle inside it touching all three sides",
    els,
  );
}

/* ------------------------------------------------------------------ */
/* Circle segment products (schematic)                                 */
/* ------------------------------------------------------------------ */

const onCircle = (R: number, d: number): Vec => [
  R * Math.cos(rad(d)),
  R * Math.sin(rad(d)),
];
const R0 = 3;
function crossing(p: Vec, q: Vec, r: Vec, s: Vec): Vec {
  const d1 = sub(q, p),
    d2 = sub(s, r);
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const t = ((r[0] - p[0]) * d2[1] - (r[1] - p[1]) * d2[0]) / den;
  return add(p, mul(d1, t));
}
const circleEl = (): Element => ({
  type: "circle",
  id: "circle",
  center: [0, 0],
  r: R0,
  stroke: "ink",
  width: 2.5,
});

type CaptionedLabels = Record<string, string | null | undefined>;
const maybe = (
  id: string,
  v: string | null | undefined,
  a: Vec,
  b: Vec,
  n: Vec,
  o: { t?: number; distance?: number } = {},
): Element[] => (v === undefined ? [] : [segLabel(id, v, a, b, n, o)]);

/** Chords AB and CD meeting at E inside the circle. Labels: AE, EB, CE, ED. */
export function chordsFigure(l: CaptionedLabels): Scene {
  const A = onCircle(R0, 150),
    B = onCircle(R0, 300),
    C = onCircle(R0, 60),
    D = onCircle(R0, 225);
  const E = crossing(A, B, C, D);
  return finish(
    "Chords AB and CD of a circle crossing at the point E inside it",
    [
      circleEl(),
      seg("ab", A, B),
      seg("cd", C, D),
      dot("e", E),
      ...[
        ["A", A],
        ["B", B],
        ["C", C],
        ["D", D],
      ].map(([n, p]) =>
        name(`n${n as string}`, n as string, p as Vec, unit(p as Vec)),
      ),
      name("ne", "E", E, [0.9, -0.5]),
      ...maybe("lae", l.AE, A, E, perp(sub(E, A)), { distance: 12 }),
      ...maybe("leb", l.EB, E, B, mul(perp(sub(E, B)), -1), { distance: 12 }),
      ...maybe("lce", l.CE, C, E, mul(perp(sub(C, E)), 1), { distance: 12 }),
      ...maybe("led", l.ED, E, D, mul(perp(sub(D, E)), 1), { distance: 12 }),
      notToScale([onCircle(R0, 180), onCircle(R0, 0), onCircle(R0, 270)]),
    ],
  );
}

/** A value written just beyond the far end of from→to (the whole secant). */
function endLabel(
  id: string,
  text: string | null,
  from: Vec,
  to: Vec,
): Element {
  const u = unit(sub(to, from));
  return {
    type: "text",
    id,
    at: add(to, mul(u, 0.12)),
    text: text ?? "?",
    font: "math",
    bold: text === null,
    derived: text === null,
    halo: true,
    align: [-1, u[1] > 0.2 ? -1 : u[1] < -0.2 ? 1 : 0],
    offset: [8, 0],
  };
}
/** A secant-length label: a value, or null for the unknown. */
type Len = string | null | undefined;

/** Two secants from the outside point P. `upper` is the secant through A and
 * B, `lower` the one through C and D. Each has the outside part (PA, PC) and
 * the whole secant (PB, PD); `chord` marks the unknown chord CD. */
export function secantsFigure(o: {
  upper: { outside?: Len; whole?: Len };
  lower: { outside?: Len; whole?: Len };
  chord?: null;
}): Scene {
  const P: Vec = [-6.6, 0.1];
  const hit = (aim: Vec): [Vec, Vec] => {
    const u = unit(sub(aim, P));
    const b = u[0] * P[0] + u[1] * P[1];
    const disc = b * b - (P[0] * P[0] + P[1] * P[1] - R0 * R0);
    return [
      add(P, mul(u, -b - Math.sqrt(disc))),
      add(P, mul(u, -b + Math.sqrt(disc))),
    ];
  };
  const [A, B] = hit([0, 2.4]);
  const [C, D] = hit([0, -2.2]);
  const els: Element[] = [
    circleEl(),
    seg("pb", P, B),
    seg("pd", P, D),
    dot("p", P),
    dot("a", A),
    dot("b", B),
    dot("c", C),
    dot("d", D),
    name("np", "P", P, [-1, 0]),
    name("na", "A", A, [-0.5, 1]),
    name("nb", "B", B, [0, 1]),
    name("nc", "C", C, [-0.5, -1]),
    name("nd", "D", D, [0, -1]),
  ];
  if (o.upper.outside !== undefined)
    els.push(
      segLabel(
        "lpa",
        o.upper.outside === null ? null : `PA = ${o.upper.outside}`,
        P,
        A,
        [0.2, 1],
        { distance: 13, t: 0.4 },
      ),
    );
  if (o.upper.whole !== undefined)
    els.push(
      endLabel(
        "dpb",
        o.upper.whole === null ? null : `PB = ${o.upper.whole}`,
        P,
        B,
      ),
    );
  if (o.lower.outside !== undefined)
    els.push(
      segLabel(
        "lpc",
        o.lower.outside === null ? null : `PC = ${o.lower.outside}`,
        P,
        C,
        [0.2, -1],
        { distance: 13, t: 0.4 },
      ),
    );
  if (o.lower.whole !== undefined)
    els.push(
      endLabel(
        "dpd",
        o.lower.whole === null ? null : `PD = ${o.lower.whole}`,
        P,
        D,
      ),
    );
  if (o.chord === null)
    els.push(segLabel("lcd", null, C, D, [0.3, -1], { distance: 12 }));
  els.push(notToScale([P, [R0, -R0], [R0, R0]], "left"));
  return finish(
    "Two secants from the point P meeting the circle at A and B, and C and D",
    els,
  );
}

/** Tangent PT and secant PAB from the outside point P. */
export function tangentSecantFigure(o: {
  tangent?: Len;
  outside?: Len;
  whole?: Len;
  chord?: null;
}): Scene {
  const P: Vec = [-6, -0.2];
  const d = len(P);
  const base = Math.atan2(-P[1], -P[0]);
  const T: Vec = add(
    P,
    mul(
      [Math.cos(base + Math.acos(R0 / d)), Math.sin(base + Math.acos(R0 / d))],
      Math.sqrt(d * d - R0 * R0),
    ),
  );
  const u = unit(sub([0, -1.3], P));
  const b = u[0] * P[0] + u[1] * P[1];
  const disc = b * b - (P[0] * P[0] + P[1] * P[1] - R0 * R0);
  const A = add(P, mul(u, -b - Math.sqrt(disc))),
    B = add(P, mul(u, -b + Math.sqrt(disc)));
  const els: Element[] = [
    circleEl(),
    seg("pt", P, T),
    seg("pb", P, B),
    dot("p", P),
    dot("t", T),
    dot("a", A),
    dot("b", B),
    name("np", "P", P, [-1, 0]),
    name("nt", "T", T, [-0.2, 1]),
    name("na", "A", A, [-0.4, -1]),
    name("nb", "B", B, [0, 1]),
  ];
  if (o.tangent !== undefined)
    els.push(
      segLabel(
        "lpt",
        o.tangent === null ? null : `PT = ${o.tangent}`,
        P,
        T,
        [0, 1],
        { distance: 13 },
      ),
    );
  if (o.outside !== undefined)
    els.push(
      segLabel(
        "lpa",
        o.outside === null ? null : `PA = ${o.outside}`,
        P,
        A,
        [0.2, 1],
        { distance: 13, t: 0.4 },
      ),
    );
  if (o.whole !== undefined)
    els.push(
      endLabel("dpb", o.whole === null ? null : `PB = ${o.whole}`, P, B),
    );
  if (o.chord === null)
    els.push(segLabel("lab", null, A, B, [0.3, 1], { distance: 12 }));
  els.push(notToScale([P, [R0, -R0], [R0, R0]], "left"));
  return finish(
    "A tangent segment PT and a secant PAB from the point P outside the circle",
    els,
  );
}
