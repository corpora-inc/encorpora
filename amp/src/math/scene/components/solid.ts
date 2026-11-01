import { article } from "../../agreement";
import { z } from "zod";
import { base, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import { atSchema, shifted } from "./shapes";
import type { FillRole, Point } from "../spec";
import { flatShapeSchema } from "./shapes";

/**
 * A right solid standing on a horizontal base, seen from in front and above
 * (orthographic, 22° elevation): x right, y away from the viewer, z up.
 * Faces toward the viewer are filled; hidden edges are dashed. A circular
 * base (an ellipse with equal radii) makes a cylinder or a cone.
 */
const radius = zNum.positive().max(20);
const height = zNum.positive().max(20);
export const solidSchema = z
  .object({
    ...base,
    type: z.literal("solid"),
    /** Math-unit offset, to place several components in one scene. */
    at: atSchema.optional(),
    solid: z.discriminatedUnion("type", [
      z.object({ type: z.literal("sphere"), radius }).strict(),
      z
        .object({ type: z.literal("prism"), base: flatShapeSchema, height })
        .strict(),
      z
        .object({ type: z.literal("pyramid"), base: flatShapeSchema, height })
        .strict(),
    ]),
  })
  .strict();
export type SolidSpec = z.infer<typeof solidSchema>;
export type Solid = SolidSpec["solid"];

const E = (22 * Math.PI) / 180;
const sinE = Math.sin(E),
  cosE = Math.cos(E);
/** Project world (x, y depth, z up) to figure math coordinates (y up). */
export const project = (x: number, y: number, z: number): Point => [
  x,
  y * sinE + z * cosE,
];
/** True when a face with outward normal n faces the viewer. */
const facesViewer = (n: [number, number, number]) =>
  -n[1] * cosE + n[2] * sinE > 1e-9;
type P3 = [number, number, number];
const hidden = { stroke: "ink" as const, width: 1.6, dash: "dash" as const };
const visible = { stroke: "ink" as const, width: 2.5 };

function curved(s: Extract<Solid, { type: "prism" | "pyramid" }>): Prim[] {
  const b = s.base;
  if (b.type !== "ellipse") return [];
  const [cx, cy] = b.center,
    r = b.radii[0];
  const base = project(cx, cy, 0),
    top = project(cx, cy, s.height);
  const ry = r * sinE;
  const ell = (c: Point, from: number, to: number, n = 48) =>
    Array.from({ length: n + 1 }, (_, i): Point => {
      const t = from + ((to - from) * i) / n;
      return [c[0] + r * Math.cos(t), c[1] + ry * Math.sin(t)];
    });
  if (s.type === "prism") {
    const front = ell(base, Math.PI, 2 * Math.PI);
    const topFront = ell(top, Math.PI, 2 * Math.PI);
    return [
      {
        type: "polygon",
        id: "side",
        points: [...front, ...[...topFront].reverse()],
        fill: "accent-fill",
        noStroke: true,
      },
      {
        type: "polygon",
        id: "top",
        points: ell(top, 0, 2 * Math.PI, 96).slice(0, -1),
        fill: "accent-strong",
        ...visible,
      },
      {
        type: "polyline",
        id: "back",
        points: ell(base, 0, Math.PI),
        ...hidden,
      },
      { type: "polyline", id: "front", points: front, ...visible },
      {
        type: "segment",
        id: "left",
        from: [base[0] - r, base[1]],
        to: [top[0] - r, top[1]],
        ...visible,
      },
      {
        type: "segment",
        id: "right",
        from: [base[0] + r, base[1]],
        to: [top[0] + r, top[1]],
        ...visible,
      },
    ];
  }
  // Tangent lines from the apex touch the base slightly behind its center;
  // the front arc between them is visible.
  const H = top[1] - base[1];
  const t1 = Math.asin(Math.min(1, ry / H)),
    t2 = Math.PI - t1;
  const front = ell(base, t2, 2 * Math.PI + t1);
  return [
    {
      type: "polygon",
      id: "side",
      points: [top, ...front],
      fill: "accent-fill",
      noStroke: true,
    },
    { type: "polyline", id: "back", points: ell(base, t1, t2), ...hidden },
    { type: "polyline", id: "front", points: [top, ...front, top], ...visible },
  ];
}

function faceted(s: Extract<Solid, { type: "prism" | "pyramid" }>): Prim[] {
  const raw = (s.base as { points: [number, number][] }).points;
  const area = raw.reduce(
    (a, p, i) =>
      a +
      p[0] * raw[(i + 1) % raw.length]![1] -
      raw[(i + 1) % raw.length]![0] * p[1],
    0,
  );
  const ring = area > 0 ? raw : [...raw].reverse();
  const n = ring.length,
    h = s.height;
  const bottom = ring.map(([x, y]) => [x, y, 0] as P3);
  const topRing = ring.map(([x, y]) => [x, y, h] as P3);
  const apex: P3 = [
    ring.reduce((a, p) => a + p[0], 0) / n,
    ring.reduce((a, p) => a + p[1], 0) / n,
    h,
  ];
  const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: P3, b: P3): P3 => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  type Face = { points: P3[]; normal: P3; fill: FillRole };
  const faces: Face[] = [{ points: bottom, normal: [0, 0, -1], fill: "none" }];
  const edges: { a: P3; b: P3; faces: number[] }[] = [];
  const edge = (a: P3, b: P3, f: number) => {
    const found = edges.find(
      (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
    );
    if (found) found.faces.push(f);
    else edges.push({ a, b, faces: [f] });
  };
  const sideFill = (normal: P3): FillRole =>
    normal[0] < -1e-9 ? "accent-fill" : "empty";
  bottom.forEach((p, i) => edge(p, bottom[(i + 1) % n]!, 0));
  if (s.type === "prism") {
    faces.push({ points: topRing, normal: [0, 0, 1], fill: "accent-strong" });
    topRing.forEach((p, i) => edge(p, topRing[(i + 1) % n]!, 1));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const normal = cross(sub(bottom[j]!, bottom[i]!), [0, 0, 1]);
      const f = faces.length;
      faces.push({
        points: [bottom[i]!, bottom[j]!, topRing[j]!, topRing[i]!],
        normal,
        fill: sideFill(normal),
      });
      edge(bottom[i]!, bottom[j]!, f);
      edge(topRing[i]!, topRing[j]!, f);
      edge(bottom[i]!, topRing[i]!, f);
      edge(bottom[j]!, topRing[j]!, f);
    }
  } else
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const normal = cross(sub(bottom[j]!, bottom[i]!), sub(apex, bottom[i]!));
      const f = faces.length;
      faces.push({
        points: [bottom[i]!, bottom[j]!, apex],
        normal,
        fill: sideFill(normal),
      });
      edge(bottom[i]!, bottom[j]!, f);
      edge(bottom[i]!, apex, f);
      edge(bottom[j]!, apex, f);
    }
  const shown = faces.map((f) => facesViewer(f.normal));
  const P = (p: P3) => project(p[0], p[1], p[2]);
  const prims: Prim[] = [];
  faces.forEach((f, i) => {
    if (shown[i])
      prims.push({
        type: "polygon",
        id: `face.${i}`,
        points: f.points.map(P),
        fill: f.fill,
        noStroke: true,
      });
  });
  edges.forEach((e, i) => {
    const front = e.faces.some((f) => shown[f]);
    prims.push({
      type: "segment",
      id: `${front ? "edge" : "hidden"}.${i}`,
      from: P(e.a),
      to: P(e.b),
      ...(front ? visible : hidden),
      cap: "round",
    });
  });
  // Hidden edges first, so visible edges paint over their ends.
  return prims.sort(
    (a, b) =>
      Number(a.id?.startsWith("edge")) - Number(b.id?.startsWith("edge")),
  );
}

function draw(c: SolidSpec): Prim[] {
  const s = c.solid;
  if (s.type === "sphere") {
    const r = s.radius,
      ry = r * sinE;
    const half = (from: number, to: number) =>
      Array.from({ length: 49 }, (_, i): Point => {
        const t = from + ((to - from) * i) / 48;
        return [r * Math.cos(t), ry * Math.sin(t)];
      });
    return [
      {
        type: "circle",
        id: "ball",
        center: [0, 0],
        r,
        fill: "accent-fill",
        ...visible,
      },
      { type: "polyline", id: "back", points: half(0, Math.PI), ...hidden },
      {
        type: "polyline",
        id: "equator",
        points: half(Math.PI, 2 * Math.PI),
        stroke: "ink",
        width: 1.8,
      },
    ];
  }
  return s.base.type === "ellipse" ? curved(s) : faceted(s);
}

registerComponent("solid", {
  maxScale: () => 70,
  compile(c) {
    return shifted(draw(c), c.at);
  },
  describe(c) {
    const s = c.solid;
    if (s.type === "sphere")
      return "A solid round shape, the same distance across in every direction.";
    if (s.base.type === "ellipse")
      return s.type === "prism"
        ? "A solid with two flat circular ends joined by a curved surface, standing on one end."
        : "A solid with a flat circular base, a curved surface and one point at the top.";
    const n = s.base.points.length;
    return s.type === "prism"
      ? `A solid with ${n + 2} flat faces: two ${n}-sided ends and ${n} rectangular sides. Hidden edges are dashed.`
      : `A solid with ${article(n)} ${n}-sided base and ${n} triangular faces meeting at a point. Hidden edges are dashed.`;
  },
});
