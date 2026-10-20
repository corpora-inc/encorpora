import { z } from "zod";
import { base, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole, Point } from "../spec";

/**
 * Flat shapes drawn from their true vertices at one shared scale, so a larger
 * shape looks larger. One shape stands alone; two to four sit in lettered
 * cells. Pieces of one item meet edge to edge (a composite shape). Marks are
 * measured from the vertices: a square at each right angle, matching ticks
 * on equal sides and, with `parallel`, matching arrows on parallel sides.
 */
const coordinate = zNum.min(-40).max(40);
const point = z.tuple([coordinate, coordinate]);
const radius = zNum.positive().max(20);
export const flatShapeSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("polygon"),
      points: z.array(point).min(3).max(16),
    })
    .strict(),
  z
    .object({
      type: z.literal("ellipse"),
      center: point,
      radii: z.tuple([radius, radius]),
      /** Degrees, counterclockwise, of the first radius. */
      angle: zNum.min(0).max(180),
    })
    .strict(),
]);
export type FlatShape = z.infer<typeof flatShapeSchema>;
const letter = z.enum(["A", "B", "C", "D"]);
export const shapeItemSchema = z
  .object({
    label: letter.optional(),
    pieces: z.array(flatShapeSchema).min(1).max(8),
    marks: z.enum(["sides-angles", "parallel"]).optional(),
    /** A name written under the shape (lesson models). */
    caption: z.string().min(1).max(30).optional(),
  })
  .strict();
export type ShapeItem = z.infer<typeof shapeItemSchema>;
export const distinctLabels = (items: { label?: string }[]) => {
  const labels = items.flatMap((i) => (i.label ? [i.label] : []));
  return new Set(labels).size === labels.length;
};

export const shapesSchema = z
  .object({
    ...base,
    type: z.literal("shapes"),
    items: z.array(shapeItemSchema).min(1).max(4),
    /** Draw a copy of this item's shape on top, as `morph`: a timeline can
     * reshape it into the other items (`morph` into `item.B.piece.0`). */
    ghost: letter.optional(),
    /** Math-unit offset, to place several components in one scene. */
    at: z.lazy(() => atSchema).optional(),
    /** Outline each item's cell (default with two or more items). */
    cells: z.boolean().optional(),
  })
  .strict()
  .refine((s) => distinctLabels(s.items), "Item letters are distinct")
  .refine(
    (s) =>
      !s.ghost ||
      s.items.some(
        (i) => i.label === s.ghost && i.pieces[0]?.type === "polygon",
      ),
    "The ghost copies a lettered polygon",
  );
export type Shapes = z.infer<typeof shapesSchema>;

export type Box = { x0: number; y0: number; x1: number; y1: number };
/** A rotated ellipse as a closed polygon fine enough to read as a curve. */
export function ellipsePoints(e: Extract<FlatShape, { type: "ellipse" }>) {
  const t = (e.angle * Math.PI) / 180,
    c = Math.cos(t),
    s = Math.sin(t);
  return Array.from({ length: 96 }, (_, i): Point => {
    const u = (2 * Math.PI * i) / 96;
    const x = e.radii[0] * Math.cos(u),
      y = e.radii[1] * Math.sin(u);
    return [e.center[0] + x * c - y * s, e.center[1] + x * s + y * c];
  });
}
export const outlineOf = (p: FlatShape): Point[] =>
  p.type === "polygon" ? (p.points as Point[]) : ellipsePoints(p);
export function boundsOf(pieces: FlatShape[]): Box {
  const pts = pieces.flatMap(outlineOf);
  return {
    x0: Math.min(...pts.map((p) => p[0])),
    x1: Math.max(...pts.map((p) => p[0])),
    y0: Math.min(...pts.map((p) => p[1])),
    y1: Math.max(...pts.map((p) => p[1])),
  };
}
/** Pieces of one composite alternate fills so seams read. */
const fills: FillRole[] = ["accent-fill", "gold-fill", "warm-fill"];

/** One item's pieces and marks, shifted by `by`. */
export function itemPrims(
  item: ShapeItem,
  by: Point,
  s: number,
  prefix: string,
): Prim[] {
  const move = (p: Point): Point => [p[0] + by[0], p[1] + by[1]];
  const prims: Prim[] = item.pieces.map((p, j) => ({
    type: "polygon",
    id: `${prefix}.piece.${j}`,
    points: outlineOf(p).map((q) => move(q as Point)),
    fill: fills[item.pieces.length === 1 ? 0 : j % 3]!,
    stroke: "ink",
    width: 2.5,
  }));
  if (item.caption) {
    const b = boundsOf(item.pieces);
    prims.push({
      type: "text",
      id: `${prefix}.caption`,
      at: [(b.x0 + b.x1) / 2 + by[0], b.y0 + by[1]],
      text: item.caption,
      font: "sans",
      align: [0, -1],
      offset: [0, 10],
    });
  }
  if (item.marks)
    item.pieces.forEach((p, j) => {
      if (p.type === "polygon")
        prims.push(
          ...markPrims(
            (p.points as Point[]).map(move),
            s,
            `${prefix}.marks.${j}`,
            item.marks === "parallel",
          ),
        );
    });
  return prims;
}

/** Standard marks measured from the vertices, sized in figure pixels. */
export function markPrims(
  points: Point[],
  s: number,
  id: string,
  parallel: boolean,
): Prim[] {
  const n = points.length,
    u = (px: number) => px / s;
  const prims: Prim[] = [];
  const length = (i: number) => {
    const a = points[i]!,
      b = points[(i + 1) % n]!;
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  };
  const dir = (i: number): Point => {
    const a = points[i]!,
      b = points[(i + 1) % n]!,
      l = length(i);
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  };
  const line = (key: string, a: Point, b: Point) =>
    prims.push({
      type: "segment",
      id: `${id}.${key}`,
      from: a,
      to: b,
      stroke: "ink",
      width: 1.8,
    });
  for (let i = 0; i < n; i++) {
    const v = points[i]!,
      a = dir((i + n - 1) % n),
      b = dir(i);
    const back: Point = [-a[0], -a[1]];
    if (Math.abs(back[0] * b[0] + back[1] * b[1]) > 1e-3) continue;
    const m = u(10);
    prims.push({
      type: "polyline",
      id: `${id}.right.${i}`,
      points: [
        [v[0] + back[0] * m, v[1] + back[1] * m],
        [v[0] + (back[0] + b[0]) * m, v[1] + (back[1] + b[1]) * m],
        [v[0] + b[0] * m, v[1] + b[1] * m],
      ],
      stroke: "ink",
      width: 1.8,
    });
  }
  const group: number[] = Array(n).fill(0);
  let groups = 0;
  for (let i = 0; i < n; i++) {
    if (group[i]) continue;
    const same = [...Array(n).keys()].filter(
      (j) => !group[j] && Math.abs(length(j) - length(i)) <= 1e-3 * length(i),
    );
    if (same.length < 2) continue;
    groups++;
    for (const j of same) group[j] = groups;
  }
  for (let i = 0; i < n; i++) {
    if (!group[i]) continue;
    const a = points[i]!,
      b = points[(i + 1) % n]!,
      d = dir(i),
      normal: Point = [-d[1], d[0]];
    const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (let k = 0; k < group[i]!; k++) {
      const off = u((k - (group[i]! - 1) / 2) * 5);
      const c: Point = [mid[0] + d[0] * off, mid[1] + d[1] * off];
      line(
        `tick.${i}.${k}`,
        [c[0] - normal[0] * u(6), c[1] - normal[1] * u(6)],
        [c[0] + normal[0] * u(6), c[1] + normal[1] * u(6)],
      );
    }
  }
  if (parallel) {
    let pairs = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const p = dir(i),
          q = dir(j);
        if (Math.abs(p[0] * q[1] - p[1] * q[0]) > 1e-3) continue;
        pairs++;
        for (const side of [i, j]) {
          const a = points[side]!,
            b = points[(side + 1) % n]!,
            d0 = dir(side),
            d: Point = d0[0] * p[0] + d0[1] * p[1] > 0 ? d0 : [-d0[0], -d0[1]],
            normal: Point = [-d[1], d[0]];
          const at: Point = [
            (a[0] + b[0]) / 2 + d0[0] * u(17),
            (a[1] + b[1]) / 2 + d0[1] * u(17),
          ];
          for (let k = 0; k < pairs; k++) {
            const tip: Point = [
              at[0] + d[0] * u(3 + k * 5),
              at[1] + d[1] * u(3 + k * 5),
            ];
            prims.push({
              type: "polyline",
              id: `${id}.parallel.${side}.${k}`,
              points: [
                [
                  tip[0] - d[0] * u(6) + normal[0] * u(5),
                  tip[1] - d[1] * u(6) + normal[1] * u(5),
                ],
                tip,
                [
                  tip[0] - d[0] * u(6) - normal[0] * u(5),
                  tip[1] - d[1] * u(6) - normal[1] * u(5),
                ],
              ],
              stroke: "ink",
              width: 1.8,
            });
          }
        }
      }
  }
  return prims;
}

/** A lettered cell: an outline and its letter in the top-left corner. */
export function cellPrims(
  box: Box,
  label: string | undefined,
  s: number,
  prefix: string,
): Prim[] {
  const inset = 3 / s;
  return [
    {
      type: "rect",
      id: `${prefix}.cell`,
      at: [box.x0 + inset, box.y0 + inset],
      size: [box.x1 - box.x0 - 2 * inset, box.y1 - box.y0 - 2 * inset],
      radius: 10,
      stroke: "grid",
      width: 1.25,
      fill: "none",
    },
    ...(label
      ? [
          {
            type: "text" as const,
            id: `${prefix}.label`,
            at: [box.x0, box.y1] as Point,
            text: label,
            font: "sans" as const,
            bold: true,
            align: [-1, -1] as [-1, -1],
            offset: [10, 6] as [number, number],
          },
        ]
      : []),
  ];
}

registerComponent("shapes", {
  maxScale: () => 90,
  compile(c, ctx) {
    const s = ctx.s;
    const n = c.items.length;
    const boxes = c.items.map((i) => boundsOf(i.pieces));
    const w = Math.max(...boxes.map((b) => b.x1 - b.x0)),
      h = Math.max(...boxes.map((b) => b.y1 - b.y0));
    const pad = 0.22 * Math.max(w, h),
      labelled = c.items.some((i) => i.label);
    const top = labelled ? 26 / s : 0,
      bottom = c.items.some((i) => i.caption) ? 28 / s : 0;
    const cw = w + 2 * pad,
      ch = h + 2 * pad + top + bottom;
    const cols = n === 4 ? 2 : n,
      prims: Prim[] = [];
    let ghost: { item: ShapeItem; by: Point } | undefined;
    c.items.forEach((item, i) => {
      const col = i % cols,
        row = Math.floor(i / cols);
      const cell: Box = {
        x0: col * cw,
        x1: (col + 1) * cw,
        y1: -row * ch,
        y0: -(row + 1) * ch,
      };
      const b = boxes[i]!;
      // Centered below the letter strip.
      const by: Point = [
        (cell.x0 + cell.x1) / 2 - (b.x0 + b.x1) / 2,
        (cell.y0 + bottom + cell.y1 - top) / 2 - (b.y0 + b.y1) / 2,
      ];
      const prefix = `item.${item.label ?? i}`;
      if (n > 1 && c.cells !== false)
        prims.push(...cellPrims(cell, item.label, s, prefix));
      prims.push(...itemPrims(item, by, s, prefix));
      if (c.ghost && item.label === c.ghost) ghost = { item, by };
    });
    if (ghost)
      prims.push({
        type: "polygon",
        id: "morph",
        points: outlineOf(ghost.item.pieces[0]!).map(
          (q) => [q[0] + ghost!.by[0], q[1] + ghost!.by[1]] as Point,
        ),
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      });
    // Centered on the origin, so `at` places the middle of the group.
    const rows = Math.ceil(n / cols);
    const centered = shifted(prims, [(-cols * cw) / 2, (rows * ch) / 2]);
    return shifted(centered, c.at);
  },
  describe(c) {
    if (c.items.length === 1) {
      const pieces = c.items[0]!.pieces;
      return pieces.length > 1
        ? `${pieces.length} flat pieces fitted together edge to edge with no gaps.`
        : pieces[0]!.type === "ellipse"
          ? "A flat round shape."
          : `A flat closed shape with ${pieces[0]!.points.length} straight sides.`;
    }
    const labels = c.items.map((i) => i.label).filter(Boolean);
    return `${c.items.length} flat shapes${labels.length ? `, labeled ${labels.join(", ")}` : ""}, drawn at the same scale.${c.items.some((i) => i.marks) ? " Marks show right angles and equal sides." : ""}`;
  },
});

/** Shift a component's primitives by a math-unit offset, so several
 * components can share one scene side by side. */
export function shifted(prims: Prim[], at?: readonly [number, number]): Prim[] {
  if (!at || (at[0] === 0 && at[1] === 0)) return prims;
  const m = (p: readonly number[]): Point => [p[0]! + at[0], p[1]! + at[1]];
  return prims.map((p): Prim => {
    switch (p.type) {
      case "text":
      case "point":
      case "tick":
      case "rect":
        return { ...p, at: m(p.at) };
      case "segment":
      case "arrow":
      case "brace":
        return { ...p, from: m(p.from), to: m(p.to) };
      case "polyline":
      case "polygon":
        return { ...p, points: p.points.map(m) };
      case "circle":
      case "arc":
        return { ...p, center: m(p.center) };
      case "path":
        return {
          ...p,
          d: p.d.map((op) =>
            op.map((v, i) =>
              i === 0 ? v : (v as number) + (i % 2 ? at[0] : at[1]),
            ),
          ) as typeof p.d,
        };
    }
  });
}
export const atSchema = z.tuple([
  zNum.min(-100).max(100),
  zNum.min(-100).max(100),
]);
