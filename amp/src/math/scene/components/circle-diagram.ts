import { z } from "zod";
import { base, color, label, num as zNum, type Point } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";

/** A value written in a figure; null is the unknown, drawn as "?". */
const entry = z.union([label, z.null()]);
const name = z.string().regex(/^[A-Z]′?$/);
/** A circle of radius 1 with named points on it (at a direction in degrees),
 * named points outside it (at a direction and a distance in radii), its
 * center O, and the chords, radii, tangents, angle marks and arcs between
 * them: the figure for inscribed angles, central angles and tangents. */
export const circleDiagramSchema = z
  .object({
    ...base,
    type: z.literal("circleDiagram"),
    points: z
      .array(z.object({ name, at: zNum.min(-720).max(720) }).strict())
      .min(1)
      .max(8),
    outside: z
      .array(
        z
          .object({
            name,
            at: zNum.min(-720).max(720),
            dist: zNum.min(1.05).max(4),
          })
          .strict(),
      )
      .max(3)
      .optional(),
    /** Draw and name the center O. */
    center: z.boolean().optional(),
    segments: z
      .array(
        z
          .object({
            from: name.or(z.literal("O")),
            to: name.or(z.literal("O")),
            label: entry.optional(),
            dash: z.boolean().optional(),
            color,
          })
          .strict(),
      )
      .max(10)
      .optional(),
    /** Angle marks at a vertex between two rays (vertex, from, to). */
    angles: z
      .array(
        z
          .object({
            at: name.or(z.literal("O")),
            from: name.or(z.literal("O")),
            to: name.or(z.literal("O")),
            mark: z.enum(["arc", "right"]).optional(),
            label: entry.optional(),
            color,
          })
          .strict(),
      )
      .max(4)
      .optional(),
    /** An arc of the circle, counterclockwise from one named point to another. */
    arcs: z
      .array(
        z
          .object({
            from: name,
            to: name,
            label: entry.optional(),
            color,
          })
          .strict(),
      )
      .max(3)
      .optional(),
  })
  .strict()
  .refine((c) => {
    const names = new Set([
      "O",
      ...c.points.map((p) => p.name),
      ...(c.outside ?? []).map((p) => p.name),
    ]);
    const used = [
      ...(c.segments ?? []).flatMap((s) => [s.from, s.to]),
      ...(c.angles ?? []).flatMap((a) => [a.at, a.from, a.to]),
      ...(c.arcs ?? []).flatMap((a) => [a.from, a.to]),
    ];
    return used.every((n) => names.has(n));
  }, "Segments, angles and arcs name drawn points");
export type CircleDiagram = z.infer<typeof circleDiagramSchema>;

const dir = (deg: number): Point => [
  Math.cos((deg * Math.PI) / 180),
  Math.sin((deg * Math.PI) / 180),
];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const unit = (v: Point): Point => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const angleOf = (v: Point) => (Math.atan2(v[1], v[0]) * 180) / Math.PI;
/** Positions of every named point, the center included. */
export function circlePositions(c: CircleDiagram) {
  const at = new Map<string, Point>([["O", [0, 0]]]);
  for (const p of c.points) at.set(p.name, dir(p.at));
  for (const p of c.outside ?? []) {
    const [x, y] = dir(p.at);
    at.set(p.name, [x * p.dist, y * p.dist]);
  }
  return at;
}

registerComponent("circleDiagram", {
  maxScale: (c) => 110 / Math.max(1, ...(c.outside ?? []).map((p) => p.dist)),
  compile(c, { s }) {
    const at = circlePositions(c);
    const px = (n: number) => n / s;
    const prims: Prim[] = [
      {
        type: "circle",
        id: "circle",
        center: [0, 0],
        r: 1,
        fill: "none",
        stroke: "ink",
        width: 2.5,
      },
    ];
    for (const [i, a] of (c.arcs ?? []).entries()) {
      let from = angleOf(at.get(a.from)!),
        to = angleOf(at.get(a.to)!);
      if (to <= from) to += 360;
      prims.push({
        type: "arc",
        id: `arc.${i}`,
        center: [0, 0],
        r: 1,
        from,
        to,
        stroke: a.color ?? "accent",
        width: 5,
      });
      if (a.label !== undefined) {
        const mid = dir((from + to) / 2);
        prims.push({
          type: "text",
          id: `arc.${i}.label`,
          at: [mid[0], mid[1]],
          text: a.label ?? "?",
          derived: a.label === null,
          color: a.color ?? "accent",
          bold: true,
          align: [
            mid[0] > 0.3 ? -1 : mid[0] < -0.3 ? 1 : 0,
            mid[1] > 0.3 ? 1 : mid[1] < -0.3 ? -1 : 0,
          ],
          offset: [mid[0] * 10, -mid[1] * 10],
        });
      }
    }
    for (const [i, g] of (c.segments ?? []).entries()) {
      const a = at.get(g.from)!,
        b = at.get(g.to)!;
      prims.push({
        type: "segment",
        id: `segment.${i}`,
        from: a,
        to: b,
        stroke: g.color ?? "ink",
        width: 2,
        dash: g.dash ? "dash" : undefined,
        obstacle: true,
      });
      if (g.label !== undefined) {
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const along = unit(sub(b, a));
        let normal: Point = [-along[1], along[0]];
        // Away from the center, or to one side of a segment through it.
        if (normal[0] * mid[0] + normal[1] * mid[1] < 0)
          normal = [-normal[0], -normal[1]];
        // A segment from the center (a radius, or O to an outside point)
        // labels below and to its right, clear of the tangent and chords
        // that meet its far end.
        if ((g.from === "O" || g.to === "O") && normal[1] > 0)
          normal = [-normal[0], -normal[1]];
        prims.push({
          type: "text",
          id: `segment.${i}.label`,
          at: mid,
          text: g.label ?? "?",
          derived: g.label === null,
          bold: true,
          color: g.color ?? "ink",
          halo: true,
          place: [
            [
              normal[0] * 10,
              -normal[1] * 10,
              normal[0] > 0.3 ? -1 : normal[0] < -0.3 ? 1 : 0,
              normal[1] > 0.3 ? 1 : normal[1] < -0.3 ? -1 : 0,
            ],
            [
              -normal[0] * 10,
              normal[1] * 10,
              normal[0] > 0.3 ? 1 : normal[0] < -0.3 ? -1 : 0,
              normal[1] > 0.3 ? -1 : normal[1] < -0.3 ? 1 : 0,
            ],
          ],
        });
      }
    }
    for (const [i, g] of (c.angles ?? []).entries()) {
      const v = at.get(g.at)!;
      const u1 = unit(sub(at.get(g.from)!, v)),
        u2 = unit(sub(at.get(g.to)!, v));
      const bis = unit([u1[0] + u2[0], u1[1] + u2[1]]);
      if (g.mark === "right") {
        const r = px(11);
        prims.push({
          type: "polyline",
          id: `angle.${i}`,
          points: [
            [v[0] + u1[0] * r, v[1] + u1[1] * r],
            [v[0] + (u1[0] + u2[0]) * r, v[1] + (u1[1] + u2[1]) * r],
            [v[0] + u2[0] * r, v[1] + u2[1] * r],
          ],
          stroke: g.color ?? "ink",
          width: 1.75,
        });
      } else {
        let from = angleOf(u1),
          to = angleOf(u2);
        if ((((to - from) % 360) + 360) % 360 > 180) [from, to] = [to, from];
        if (to < from) to += 360;
        prims.push({
          type: "arc",
          id: `angle.${i}`,
          center: v,
          r: px(20),
          from,
          to,
          stroke: g.color ?? "warm",
          width: 2,
        });
      }
      if (g.label !== undefined) {
        const half =
          Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1]))) /
          2;
        const w = typeset(g.label ?? "?", "math", "sm").width;
        // Far enough out to clear the arc, but near enough to read as this
        // vertex's label even for a narrow angle.
        const r = px(
          Math.min(
            52,
            Math.max(34, (w / 2 + 8) / Math.sin(Math.max(half, 0.05))),
          ),
        );
        prims.push({
          type: "text",
          id: `angle.${i}.label`,
          at: [v[0] + bis[0] * r, v[1] + bis[1] * r],
          text: g.label ?? "?",
          derived: g.label === null,
          color: g.color ?? "warm",
          size: "sm",
          bold: true,
          halo: true,
          align: [0, 0],
        });
      }
    }
    if (c.center)
      prims.push(
        { type: "point", id: "point.O", at: [0, 0], r: 4 },
        {
          type: "text",
          id: "name.O",
          at: [0, 0],
          text: "O",
          font: "math",
          bold: true,
          place: [
            // Above the center first: central-angle marks open downward
            // toward the arcs these figures measure.
            [6, -6, -1, 1],
            [-6, -6, 1, 1],
            [6, 6, -1, -1],
            [-6, 6, 1, -1],
          ],
        },
      );
    for (const [nm, p] of at) {
      if (nm === "O") continue;
      const out = unit(p);
      prims.push(
        { type: "point", id: `point.${nm}`, at: p, r: 4 },
        {
          type: "text",
          id: `name.${nm}`,
          at: p,
          text: nm,
          font: "math",
          bold: true,
          align: [
            out[0] > 0.35 ? -1 : out[0] < -0.35 ? 1 : 0,
            out[1] > 0.35 ? 1 : out[1] < -0.35 ? -1 : 0,
          ],
          offset: [out[0] * 8, -out[1] * 8],
        },
      );
    }
    return prims;
  },
  describe(c) {
    const v = (x: string | null | undefined) => (x === null ? "unknown" : x);
    const out = [
      `A circle${c.center ? " with center O" : ""} through ${c.points.map((p) => p.name).join(", ")}.`,
    ];
    for (const p of c.outside ?? [])
      out.push(`${p.name} is outside the circle.`);
    for (const g of c.segments ?? [])
      out.push(
        `Segment ${g.from}${g.to}${g.label !== undefined ? `: ${v(g.label)}` : ""}.`,
      );
    for (const g of c.angles ?? [])
      out.push(
        g.mark === "right"
          ? `A right angle at ${g.at}.`
          : `Angle ${g.from}${g.at}${g.to}${g.label !== undefined ? `: ${v(g.label)}` : ""}.`,
      );
    for (const a of c.arcs ?? [])
      out.push(
        `Arc ${a.from}${a.to}${a.label !== undefined ? `: ${v(a.label)}` : ""}.`,
      );
    return out.join(" ");
  },
});
