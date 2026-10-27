import { z } from "zod";
import { base, label, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import type { FillRole, Point } from "../spec";
import { atSchema, shifted } from "./shapes";

/**
 * A circle graph (pie chart). Each sector's angle is its share of the
 * total of `value`; its label is its category and the text the item shows
 * (a percent, an angle or a count), which may be absent or asked for.
 *
 * Sectors run clockwise from 12 o'clock. Labels go inside every sector
 * when every one fits; otherwise each sector carries its number and a key
 * below the circle lists number, swatch, category and value, so a thin
 * sector is never labeled outside where labels would collide.
 */
export const circleGraphSchema = z
  .object({
    ...base,
    type: z.literal("circleGraph"),
    at: atSchema.optional(),
    sectors: z
      .array(
        z
          .object({
            label,
            /** Relative size: the sector is value / total of the circle. */
            value: zNum.positive().max(1e9),
            /** What the sector shows, such as "25%", "90°" or "30". */
            text: z.string().min(1).max(12).optional(),
            /** The text is the unknown: drawn as "?" unless revealed. */
            derived: z.boolean().optional(),
          })
          .strict(),
      )
      .min(2)
      .max(8),
    /** "auto" labels inside when all fit, else uses the key. */
    labels: z.enum(["auto", "inside", "key"]).optional(),
  })
  .strict()
  .refine(
    (c) => new Set(c.sectors.map((s) => s.label)).size === c.sectors.length,
    "Sector labels are distinct",
  )
  .refine(
    (c) => c.sectors.every((s) => !s.derived || s.text !== undefined),
    "A derived sector has text to mask",
  );
export type CircleGraph = z.infer<typeof circleGraphSchema>;

/** Four fills that stay distinct in light, dark and print; neighbors never
 * share one. */
const fills: FillRole[] = ["accent-fill", "warm-fill", "gold-fill", "empty"];
export const sectorFill = (i: number, n: number): FillRole =>
  // With n ≡ 1 (mod 4) the last sector would match the first, its neighbor.
  i === n - 1 && n % 4 === 1 ? fills[2]! : fills[i % 4]!;

/** Sector boundaries in math degrees (counterclockwise from +x), sweeping
 * clockwise from 90°. */
export function sectorAngles(c: Pick<CircleGraph, "sectors">) {
  const total = c.sectors.reduce((a, s) => a + s.value, 0);
  let at = 90;
  return c.sectors.map((s) => {
    const sweep = (s.value / total) * 360;
    const out = { from: at - sweep, to: at, sweep };
    at -= sweep;
    return out;
  });
}
const polar = (deg: number, r: number): Point => [
  Math.cos((deg * Math.PI) / 180) * r,
  Math.sin((deg * Math.PI) / 180) * r,
];
const shown = (s: CircleGraph["sectors"][number], reveal: boolean) =>
  s.text === undefined ? undefined : s.derived && !reveal ? "?" : s.text;

/** Does a w × h pixel box centered at (deg, rho) lie inside the sector,
 * clear of its rim and both edges by `pad` pixels? `s` is pixels per unit
 * (the radius). Angles are math degrees with from < to. */
export function fitsInside(
  from: number,
  to: number,
  rho: number,
  w: number,
  h: number,
  s: number,
  pad = 4,
) {
  const [cx, cy] = polar((from + to) / 2, rho * s);
  const sweep = to - from;
  const rayDistance = (x: number, y: number, deg: number) => {
    const t = (deg * Math.PI) / 180;
    const along = Math.cos(t) * x + Math.sin(t) * y;
    return along <= 0
      ? Math.hypot(x, y)
      : Math.abs(-Math.sin(t) * x + Math.cos(t) * y);
  };
  for (const [dx, dy] of [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [-w / 2, h / 2],
    [w / 2, h / 2],
    [0, -h / 2],
    [0, h / 2],
    [-w / 2, 0],
    [w / 2, 0],
  ] as const) {
    const x = cx + dx,
      y = cy + dy;
    if (Math.hypot(x, y) > s - pad) return false;
    const angle = (((Math.atan2(y, x) * 180) / Math.PI - from) % 360 + 360) % 360;
    if (angle > sweep) return false;
    if (rayDistance(x, y, from) < pad || rayDistance(x, y, to) < pad)
      return false;
  }
  return true;
}

function insideLayout(c: CircleGraph, s: number, reveal: boolean) {
  const angles = sectorAngles(c);
  return c.sectors.map((sector, i) => {
    const { from, to } = angles[i]!;
    const name = typeset(sector.label, "sans", "sm");
    const value = shown(sector, reveal);
    const v = value ? typeset(value, "sans", "sm", true) : undefined;
    const w = Math.max(name.width, v?.width ?? 0) + 4;
    const h = (v ? 36 : 18) + 2;
    for (const rho of [0.6, 0.52, 0.68, 0.44])
      if (fitsInside(from, to, rho, w, h, s)) return rho;
    return null;
  });
}

function draw(c: CircleGraph, s: number, reveal: boolean): Prim[] {
  const angles = sectorAngles(c);
  const n = c.sectors.length;
  const prims: Prim[] = [];
  angles.forEach(({ from, to }, i) =>
    prims.push({
      type: "arc",
      id: `sector.${i}`,
      center: [0, 0],
      r: 1,
      from,
      to,
      fill: sectorFill(i, n),
      stroke: "ink",
      width: 1.5,
      data: { sector: i, share: +((to - from) / 360).toFixed(6) },
    }),
  );
  angles.forEach(({ to }, i) =>
    prims.push({
      type: "segment",
      id: `edge.${i}`,
      from: [0, 0],
      to: polar(to, 1),
      stroke: "ink",
      width: 1.5,
    }),
  );
  const rhos = insideLayout(c, s, reveal);
  const inside =
    c.labels === "inside" ||
    (c.labels !== "key" && rhos.every((r) => r !== null));
  if (inside) {
    c.sectors.forEach((sector, i) => {
      const { from, to } = angles[i]!;
      const at = polar((from + to) / 2, rhos[i] ?? 0.6);
      const value = shown(sector, reveal);
      prims.push({
        type: "text",
        id: `name.${i}`,
        at,
        text: sector.label,
        font: "sans",
        size: "sm",
        align: [0, value ? 1 : 0],
        offset: [0, value ? -1 : 0],
      });
      if (value)
        prims.push({
          type: "text",
          id: `value.${i}`,
          at,
          text: sector.text!,
          font: "sans",
          size: "sm",
          bold: true,
          derived: sector.derived,
          color: sector.derived ? "warm" : "ink",
          align: [0, -1],
          offset: [0, 2],
        });
    });
    return prims;
  }
  // Key: each sector shows its number; rows below the circle explain them.
  c.sectors.forEach((_, i) => {
    const { from, to } = angles[i]!;
    const mid = (from + to) / 2;
    const digit = typeset(String(i + 1), "sans", "sm", true);
    const rho = [0.78, 0.7, 0.62].find((r) =>
      fitsInside(from, to, r, digit.width + 2, 16, s, 3),
    );
    prims.push({
      type: "text",
      id: `key.${i}`,
      at: polar(mid, rho ?? 1),
      text: String(i + 1),
      font: "sans",
      size: "sm",
      bold: true,
      ...(rho === undefined
        ? {
            // Outside the rim, pushed along the sector's direction.
            align: [
              Math.cos((mid * Math.PI) / 180) > 0.3
                ? -1
                : Math.cos((mid * Math.PI) / 180) < -0.3
                  ? 1
                  : 0,
              Math.sin((mid * Math.PI) / 180) > 0.3
                ? 1
                : Math.sin((mid * Math.PI) / 180) < -0.3
                  ? -1
                  : 0,
            ] as [-1 | 0 | 1, -1 | 0 | 1],
            offset: polar(mid, 5).map((v, k) => (k ? -v : v)) as [
              number,
              number,
            ],
          }
        : {}),
    });
  });
  const row = 26 / s,
    swatch = 14 / s;
  const top = -1 - 20 / s;
  c.sectors.forEach((sector, i) => {
    const y = top - i * row;
    const value = shown(sector, reveal);
    prims.push(
      {
        type: "text",
        id: `legend.${i}.key`,
        at: [-1, y],
        text: String(i + 1),
        font: "sans",
        size: "sm",
        bold: true,
        align: [-1, 0],
      },
      {
        type: "rect",
        id: `legend.${i}.swatch`,
        at: [-1 + 16 / s, y - swatch / 2],
        size: [swatch, swatch],
        fill: sectorFill(i, n),
        stroke: "ink",
        width: 1,
        radius: 2,
      },
      {
        type: "text",
        id: `legend.${i}.name`,
        at: [-1 + 38 / s, y],
        text: sector.label,
        font: "sans",
        size: "sm",
        align: [-1, 0],
      },
    );
    if (value) {
      const nameWidth = typeset(sector.label, "sans", "sm").width;
      prims.push({
        type: "text",
        id: `legend.${i}.value`,
        at: [-1 + (38 + nameWidth + 10) / s, y],
        text: sector.text!,
        font: "sans",
        size: "sm",
        bold: true,
        derived: sector.derived,
        color: sector.derived ? "warm" : "ink",
        align: [-1, 0],
      });
    }
  });
  return prims;
}

registerComponent("circleGraph", {
  capability: () => "scenes-v2",
  // A radius of at most 100 px: a 200 px circle fits a 288 px phone stage.
  maxScale: () => 100,
  compile(c, ctx) {
    return shifted(draw(c, ctx.s, ctx.reveal), c.at);
  },
  describe(c, reveal) {
    const parts = c.sectors.map((sector) => {
      if (sector.text === undefined)
        return `${sector.label}, value not shown`;
      if (sector.derived && !reveal) return `${sector.label}, value to find`;
      return `${sector.label} ${sector.text}`;
    });
    return `A circle graph with ${c.sectors.length} sectors, clockwise from the top: ${parts.join("; ")}.`;
  },
});
