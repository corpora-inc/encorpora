import { z } from "zod";
import { base, coord, num } from "../base";
import { registerComponent, type Prim } from "../layout";
import { NAME, axis, scaleTicks, unitLabel } from "./data-scale";
import { num as numText, spoken } from "./format";

const groupLabel = z.string().min(1).max(16);
/** Box plots (minimum, quartiles, median, maximum) over one shared scale. */
export const boxPlotSchema = z
  .object({
    ...base,
    type: z.literal("boxPlot"),
    min: coord,
    max: coord,
    step: num.positive(),
    groups: z
      .array(
        z
          .object({
            label: groupLabel.optional(),
            summary: z.tuple([coord, coord, coord, coord, coord]),
          })
          .strict(),
      )
      .min(1)
      .max(3),
    unit: z.string().min(1).max(24).optional(),
  })
  .strict()
  .refine(
    (b) =>
      b.max > b.min &&
      (b.max - b.min) / b.step <= 40 &&
      b.groups.every((g) =>
        g.summary.every(
          (v, i) =>
            v >= b.min && v <= b.max && (i === 0 || v >= g.summary[i - 1]!),
        ),
      ),
    "Five ordered numbers inside the scale",
  );

export type BoxPlot = z.infer<typeof boxPlotSchema>;

const BOX = 44,
  ROW = 86,
  CAP = 14;
registerComponent("boxPlot", {
  maxScale: (b) => 48 / b.step,
  compile(b, { s }) {
    const prims: Prim[] = [];
    const n = b.groups.length;
    // The axis is at y = 0; groups sit above it, the first at the top.
    const center = (g: number) => ((n - 1 - g) * ROW + 30 + BOX / 2) / s;
    const list = scaleTicks(b.min, b.max, b.step, s, numText);
    // Label every other tick when labels would crowd, as the scale is read
    // from labeled ticks two steps apart.
    axis(prims, "axis", b.min, b.max, 0, s, list, numText);
    if (b.unit) prims.push(unitLabel(b.unit, b.max, 0, s));
    for (const [g, group] of b.groups.entries()) {
      const [lo, q1, med, q3, hi] = group.summary;
      const y = center(g),
        h = BOX / 2 / s,
        cap = CAP / s;
      if (group.label)
        prims.push({
          type: "text",
          id: `group.${g}.label`,
          at: [b.min - 10 / s, y + h + 14 / s],
          text: group.label,
          font: "sans",
          bold: true,
          align: [-1, 0],
        });
      const whisker = (id: string, a: number, c: number) =>
        prims.push({
          type: "segment",
          id: `group.${g}.${id}`,
          from: [a, y],
          to: [c, y],
          stroke: "accent",
          width: 2,
        });
      whisker("whisker.low", lo, q1);
      whisker("whisker.high", q3, hi);
      for (const [k, v] of [lo, hi].entries())
        prims.push({
          type: "segment",
          id: `group.${g}.end.${k}`,
          from: [v, y - cap],
          to: [v, y + cap],
          stroke: "accent",
          width: 2,
          data: { summary: k === 0 ? "min" : "max", value: v },
        });
      prims.push(
        {
          type: "rect",
          id: `group.${g}.box`,
          at: [q1, y - h],
          size: [Math.max(q3 - q1, 1e-6), 2 * h],
          fill: "accent-fill",
          stroke: "accent",
          width: 2,
          radius: 3,
          data: { q1, q3 },
        },
        {
          type: "segment",
          id: `group.${g}.median`,
          from: [med, y - h],
          to: [med, y + h],
          stroke: "warm",
          width: 3.5,
          data: { summary: "median", value: med },
        },
      );
    }
    return prims;
  },
  describe(b) {
    const five = (g: BoxPlot["groups"][number]) =>
      `minimum ${spoken(g.summary[0])}, lower quartile ${spoken(g.summary[1])}, median ${spoken(g.summary[2])}, upper quartile ${spoken(g.summary[3])}, maximum ${spoken(g.summary[4])}`;
    return b.groups.length === 1
      ? `Box plot${b.unit ? ` of ${b.unit}` : ""}: ${five(b.groups[0]!)}.`
      : `${b.groups.length} box plots${b.unit ? ` of ${b.unit}` : ""} on the same scale. ${b.groups.map((g, i) => `${g.label ?? `Group ${i + 1}`}: ${five(g)}`).join(". ")}.`;
  },
});
