import { z } from "zod";
import { base, color, coord, label, pointSchema, type Point } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";

/** A value written on a figure; null is the unknown, drawn as "?". */
const entry = z.union([label, z.null()]);
const vertexName = z.string().regex(/^[A-Z]′?$/);
const sideSpec = z
  .object({
    /** A length, a name such as "hypotenuse", or null for the unknown. */
    label: entry.optional(),
    /** Congruence ticks: sides with the same count are equal. */
    ticks: z.number().int().min(1).max(3).optional(),
    color,
  })
  .strict();
const angleSpec = z
  .object({
    /** "right" draws the square; "arc" draws `arcs` arcs (equal angles match). */
    mark: z.enum(["arc", "right"]).optional(),
    arcs: z.number().int().min(1).max(3).optional(),
    label: entry.optional(),
    color,
  })
  .strict();
/** A triangle drawn to its true shape, with side lengths, tick marks for
 * congruent sides, angle arcs, right-angle squares and vertex names. Side i
 * runs from vertex i to vertex i + 1; angle i is at vertex i. */
export const triangleSchema = z
  .object({
    ...base,
    type: z.literal("triangle"),
    points: z.tuple([pointSchema, pointSchema, pointSchema]),
    names: z.tuple([vertexName, vertexName, vertexName]).optional(),
    sides: z.tuple([sideSpec, sideSpec, sideSpec]).optional(),
    angles: z.tuple([angleSpec, angleSpec, angleSpec]).optional(),
    fill: z.enum(["none", "accent-fill", "warm-fill", "gold-fill"]).optional(),
    /** A dashed copy, for an image or a preimage beside the figure. */
    dash: z.boolean().optional(),
    /** Scale for the drawing only (math units per given length unit). */
    scale: coord.positive().optional(),
  })
  .strict()
  .refine((t) => {
    const [a, b, c] = t.points;
    return (
      Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) >
      1e-9
    );
  }, "Three points that are not on one line");
export type Triangle = z.infer<typeof triangleSchema>;

const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const len = (v: Point) => Math.hypot(v[0], v[1]);
const unit = (v: Point): Point => {
  const l = len(v) || 1;
  return [v[0] / l, v[1] / l];
};
const deg = (v: Point) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;

/** The interior angle at vertex i, in degrees, from the drawn points. */
export function interiorAngle(points: Point[], i: number) {
  const p = points[i]!,
    u = unit(sub(points[(i + 1) % 3]!, p)),
    v = unit(sub(points[(i + 2) % 3]!, p));
  return (
    (Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) * 180) /
    Math.PI
  );
}

registerComponent("triangle", {
  maxScale: (t) => {
    const xs = t.points.map((p) => p[0]),
      ys = t.points.map((p) => p[1]);
    return (
      220 /
      Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys),
      )
    );
  },
  compile(t, { s }) {
    const pts = t.points as Point[];
    const centroid: Point = [
      (pts[0]![0] + pts[1]![0] + pts[2]![0]) / 3,
      (pts[0]![1] + pts[1]![1] + pts[2]![1]) / 3,
    ];
    const px = (n: number) => n / s;
    const prims: Prim[] = [
      {
        type: "polygon",
        id: "body",
        points: pts,
        fill: t.fill ?? "none",
        noStroke: true,
      },
    ];
    for (let i = 0; i < 3; i++) {
      const a = pts[i]!,
        b = pts[(i + 1) % 3]!;
      const side = t.sides?.[i];
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const along = unit(sub(b, a));
      // The outward normal points away from the centroid.
      let normal: Point = [-along[1], along[0]];
      if (
        (mid[0] - centroid[0]) * normal[0] +
          (mid[1] - centroid[1]) * normal[1] <
        0
      )
        normal = [-normal[0], -normal[1]];
      // Each side is its own stroke, so a step can light one up.
      prims.push({
        type: "segment",
        id: `side.${i}`,
        from: a,
        to: b,
        stroke: side?.color ?? "ink",
        width: side?.color ? 4 : 2.5,
        dash: t.dash ? "dash" : undefined,
        cap: "round",
        obstacle: true,
      });
      for (let k = 0; k < (side?.ticks ?? 0); k++) {
        const offset = (k - ((side!.ticks ?? 1) - 1) / 2) * px(6);
        const c: Point = [
          mid[0] + along[0] * offset,
          mid[1] + along[1] * offset,
        ];
        prims.push({
          type: "segment",
          id: `side.${i}.tick.${k}`,
          from: [c[0] - normal[0] * px(7), c[1] - normal[1] * px(7)],
          to: [c[0] + normal[0] * px(7), c[1] + normal[1] * px(7)],
          stroke: side?.color ?? "ink",
          width: 2,
        });
      }
      if (side?.label !== undefined) {
        // Away from the side, on the outside; the side's direction picks the
        // anchor corner so the label never crosses the line.
        const ax = normal[0] > 0.35 ? -1 : normal[0] < -0.35 ? 1 : 0,
          ay = normal[1] > 0.35 ? 1 : normal[1] < -0.35 ? -1 : 0;
        prims.push({
          type: "text",
          id: `side.${i}.label`,
          at: mid,
          text: side.label ?? "?",
          // Words ("hypotenuse") in the UI sans; lengths as math.
          font: /^[A-Za-z]{3,}/.test(side.label ?? "") ? "sans" : "math",
          derived: side.label === null,
          bold: side.label === null || !!side.color,
          color: side.color ?? "ink",
          halo: true,
          align: [ax as -1 | 0 | 1, ay as -1 | 0 | 1],
          offset: [normal[0] * 10, -normal[1] * 10],
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const p = pts[i]!,
        u = unit(sub(pts[(i + 1) % 3]!, p)),
        v = unit(sub(pts[(i + 2) % 3]!, p));
      const spec = t.angles?.[i];
      const bis = unit([u[0] + v[0], u[1] + v[1]]);
      if (spec?.mark === "right") {
        const r = px(13);
        prims.push({
          type: "polyline",
          id: `angle.${i}`,
          points: [
            [p[0] + u[0] * r, p[1] + u[1] * r],
            [p[0] + (u[0] + v[0]) * r, p[1] + (u[1] + v[1]) * r],
            [p[0] + v[0] * r, p[1] + v[1] * r],
          ],
          stroke: spec.color ?? "ink",
          width: 1.75,
        });
      } else if (spec?.mark === "arc") {
        let from = deg(u),
          to = deg(v);
        // Sweep the interior: the counterclockwise turn must be under 180°.
        if ((((to - from) % 360) + 360) % 360 > 180) [from, to] = [to, from];
        if (to < from) to += 360;
        for (let k = 0; k < (spec.arcs ?? 1); k++)
          prims.push({
            type: "arc",
            id: `angle.${i}.arc.${k}`,
            center: p,
            r: px(20 + 5 * k),
            from,
            to,
            stroke: spec.color ?? "accent",
            width: 2,
          });
      }
      if (spec?.label !== undefined) {
        // Beyond the arcs, and far enough out that the wedge is wider than
        // the label: a 30° angle pushes its label well away from the vertex.
        const half =
          Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1]))) / 2;
        const w = typeset(spec.label ?? "?", "math", "sm").width;
        const outer =
          spec.mark === "right" ? 13 : 20 + 5 * ((spec.arcs ?? 1) - 1);
        const want = Math.max(outer + 16, (w / 2 + 9) / Math.sin(half));
        // The shorter side at this vertex bounds how far in a label can sit;
        // a narrow angle on a small drawing labels from outside instead.
        const room =
          Math.min(
            len(sub(pts[(i + 1) % 3]!, p)),
            len(sub(pts[(i + 2) % 3]!, p)),
          ) *
          s *
          0.8;
        const inside = want <= room;
        const r = inside ? px(want) : -px(w / 2 + 14);
        prims.push({
          type: "text",
          id: `angle.${i}.label`,
          at: [p[0] + bis[0] * r, p[1] + bis[1] * r],
          text: spec.label ?? "?",
          derived: spec.label === null,
          color: spec.color ?? "accent",
          size: "sm",
          align: [0, 0],
        });
      }
      if (t.names) {
        const out: Point = [-bis[0], -bis[1]];
        prims.push({
          type: "text",
          id: `vertex.${i}`,
          at: p,
          text: t.names[i]!,
          font: "math",
          bold: true,
          align: [
            out[0] > 0.3 ? -1 : out[0] < -0.3 ? 1 : 0,
            out[1] > 0.3 ? 1 : out[1] < -0.3 ? -1 : 0,
          ],
          offset: [out[0] * 6, -out[1] * 6],
        });
      }
    }
    return prims;
  },
  describe(t) {
    const names = t.names ?? [
      "the first vertex",
      "the second vertex",
      "the third vertex",
    ];
    const v = (x: string | null | undefined) => (x === null ? "unknown" : x);
    const out = [`Triangle ${t.names ? t.names.join("") : ""}`.trim() + "."];
    t.sides?.forEach((s, i) => {
      if (s.label !== undefined)
        out.push(`Side ${names[i]}${names[(i + 1) % 3]}: ${v(s.label)}.`);
    });
    t.angles?.forEach((a, i) => {
      if (a.mark === "right") out.push(`A right angle at ${names[i]}.`);
      else if (a.label !== undefined)
        out.push(`Angle at ${names[i]}: ${v(a.label)}.`);
    });
    const ticks = (t.sides ?? []).filter((s) => s.ticks);
    if (ticks.length > 1) out.push("Sides with matching tick marks are equal.");
    return out.join(" ");
  },
});
