import { z } from "zod";
import { base, label } from "../base";
import { registerComponent, type Prim } from "../layout";
import { atSchema, shifted } from "./shapes";

/**
 * A ruler or measuring tape with an object laid along it. One math unit is
 * one inch or one centimeter. Inches divide into halves, quarters, eighths
 * or sixteenths; centimeters into halves or millimeters. Tick length falls
 * with the size of the part, so a half is longer than a quarter, a quarter
 * than an eighth. Whole units are numbered from 0.
 *
 * The object spans `from`/`to`, counted in parts (eighths, millimeters…), so
 * every end is exactly on a tick; dashed guides drop from its ends to the
 * scale.
 */
export const rulerSchema = z
  .object({
    ...base,
    type: z.literal("ruler"),
    at: atSchema.optional(),
    unit: z.enum(["in", "cm"]),
    /** Whole units shown. */
    length: z.number().int().min(1).max(15),
    /** Parts per unit: 1, 2, 4, 8 or 16 for inches; 1, 2 or 10 for cm. */
    parts: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(10),
      z.literal(16),
    ]),
    /** A tape is a flat strip; a ruler is a board with a margin. */
    style: z.enum(["ruler", "tape"]).optional(),
    object: z
      .object({
        from: z.number().int().min(0).max(240),
        to: z.number().int().min(1).max(240),
        shape: z.enum(["bar", "pencil", "ribbon"]).optional(),
        label: label.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (r) =>
      r.unit === "in"
        ? [1, 2, 4, 8, 16].includes(r.parts)
        : [1, 2, 10].includes(r.parts),
    "Inches divide by 2, 4, 8 or 16; centimeters by 2 or 10",
  )
  .refine((r) => r.length * r.parts <= 160, "At most 160 ticks")
  .refine(
    (r) =>
      !r.object ||
      (r.object.from < r.object.to && r.object.to <= r.length * r.parts),
    "The object lies on the ruler",
  );
export type Ruler = z.infer<typeof rulerSchema>;

/** Tick length in pixels for tick k of a ruler with `parts` per unit. */
export function tickLength(k: number, parts: number, unit: "in" | "cm") {
  if (k % parts === 0) return 18;
  if (unit === "cm")
    return parts === 10 && k % 5 === 0 ? 12 : parts === 2 ? 12 : 7;
  // The part's denominator: parts over the largest power of two dividing k
  // (2 for a half, 4 for a quarter, 8 for an eighth, 16 for a sixteenth).
  const step = parts / (k & -k);
  return step === 2 ? 14 : step === 4 ? 11 : step === 8 ? 8 : 6;
}

function draw(r: Ruler, s: number): Prim[] {
  const px = (p: number) => p / s;
  const tape = r.style === "tape";
  const margin = tape ? px(6) : px(12);
  const height = px(40);
  const prims: Prim[] = [
    {
      type: "rect",
      id: "body",
      at: [-margin, -height],
      size: [r.length + 2 * margin, height],
      radius: tape ? 1 : 4,
      fill: tape ? "gold-fill" : "empty",
      stroke: "ink",
      width: 1.5,
    },
  ];
  const n = r.length * r.parts;
  for (let k = 0; k <= n; k++) {
    const x = k / r.parts;
    prims.push({
      type: "segment",
      id: `tick.${k}`,
      from: [x, 0],
      to: [x, -px(tickLength(k, r.parts, r.unit))],
      stroke: "ink",
      width: k % r.parts === 0 ? 1.5 : 1,
      data: { part: k },
    });
    if (k % r.parts === 0)
      prims.push({
        type: "text",
        id: `number.${k / r.parts}`,
        at: [x, -px(20)],
        text: String(k / r.parts),
        font: "sans",
        size: "sm",
        align: [0, -1],
        data: { value: k / r.parts },
      });
  }
  prims.push({
    type: "text",
    id: "unit",
    at: [r.length + margin, -height],
    text: r.unit === "in" ? "inches" : "cm",
    font: "sans",
    size: "sm",
    color: "muted",
    align: [1, -1],
    offset: [0, 4],
  });
  const o = r.object;
  if (o) {
    const x0 = o.from / r.parts,
      x1 = o.to / r.parts;
    const gap = px(14),
      thick = px(o.shape === "ribbon" ? 10 : 16);
    const y0 = gap,
      y1 = gap + thick;
    const shape = o.shape ?? "bar";
    if (shape === "pencil") {
      const tip = Math.min(px(22), (x1 - x0) / 3);
      prims.push(
        {
          type: "polygon",
          id: "object",
          points: [
            [x0, y0],
            [x1 - tip, y0],
            [x1, (y0 + y1) / 2],
            [x1 - tip, y1],
            [x0, y1],
          ],
          fill: "gold-fill",
          stroke: "ink",
          width: 1.5,
          data: { from: o.from, to: o.to },
        },
        {
          type: "segment",
          id: "object.collar",
          from: [x1 - tip, y0],
          to: [x1 - tip, y1],
          stroke: "ink",
          width: 1,
        },
        {
          type: "polygon",
          id: "object.point",
          points: [
            [x1 - tip / 3, y0 + thick / 3],
            [x1, (y0 + y1) / 2],
            [x1 - tip / 3, y1 - thick / 3],
          ],
          fill: "ink",
          noStroke: true,
        },
      );
    } else
      prims.push({
        type: "rect",
        id: "object",
        at: [x0, y0],
        size: [x1 - x0, thick],
        radius: shape === "ribbon" ? 1 : 4,
        fill: shape === "ribbon" ? "warm" : "accent-fill",
        stroke: shape === "ribbon" ? undefined : "ink",
        width: 1.5,
        data: { from: o.from, to: o.to },
      });
    for (const [key, x] of [
      ["start", x0],
      ["end", x1],
    ] as const)
      prims.push({
        type: "segment",
        id: `guide.${key}`,
        from: [x, y0],
        to: [x, 0],
        stroke: "axis",
        width: 1,
        dash: "dash",
      });
    if (o.label)
      prims.push({
        type: "text",
        id: "object.label",
        at: [(x0 + x1) / 2, y1],
        text: o.label,
        font: "sans",
        size: "sm",
        align: [0, 1],
        offset: [0, -4],
      });
  }
  return prims;
}

const partName = (parts: number, unit: "in" | "cm") =>
  unit === "cm"
    ? parts === 10
      ? "millimeters"
      : parts === 2
        ? "half centimeters"
        : "whole centimeters"
    : ({ 1: "whole inches", 2: "half inches", 4: "quarter inches", 8: "eighth inches", 16: "sixteenth inches" } as Record<number, string>)[parts]!;

registerComponent("ruler", {
  capability: () => "scenes-v2",
  // An inch is at most 96 px (true size on a screen), a centimeter 48 px.
  maxScale: (r) => (r.unit === "in" ? 96 : 48),
  compile(r, ctx) {
    return shifted(draw(r, ctx.s), r.at);
  },
  describe(r) {
    const unit = r.unit === "in" ? "inch" : "centimeter";
    const ruler = `A ${r.style === "tape" ? "measuring tape" : "ruler"} numbered from 0 to ${r.length} ${unit === "inch" ? "inches" : "centimeters"}, marked in ${partName(r.parts, r.unit)}.`;
    if (!r.object) return ruler;
    const what = r.object.label ?? `A ${r.object.shape ?? "bar"}`;
    // The description gives the ends as tick counts, never the length.
    const at = (k: number) =>
      k % r.parts === 0
        ? `the ${k / r.parts} mark`
        : `${k % r.parts} small marks past ${Math.floor(k / r.parts)}`;
    return `${ruler} ${what} lies along it from ${at(r.object.from)} to ${at(r.object.to)}.`;
  },
});
