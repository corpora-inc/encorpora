import { z } from "zod";
import { base, coord } from "../base";
import { registerComponent, type Prim } from "../layout";
import {
  FIRST,
  LABELS,
  MARK,
  NAME,
  STACK,
  axis,
  mixed,
  scaleTicks,
  tallest,
  unitLabel,
} from "./data-scale";
import { spoken } from "./format";

const groupLabel = z.string().min(1).max(16);
/** A line plot or dot plot: one mark per value, stacked over a number line;
 * two groups share one scale, one panel above the other. */
export const dotPlotSchema = z
  .object({
    ...base,
    type: z.literal("dotPlot"),
    min: coord,
    max: coord,
    /** Ticks every 1/denominator, labeled as mixed numbers. */
    denominator: z.number().int().min(1).max(16).optional(),
    mark: z.enum(["x", "dot"]).optional(),
    groups: z
      .array(
        z
          .object({
            label: groupLabel.optional(),
            values: z.array(coord).min(1).max(40),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    unit: z.string().min(1).max(24).optional(),
  })
  .strict()
  .refine((p) => {
    const d = p.denominator ?? 1;
    const on = (v: number) => Math.abs(v * d - Math.round(v * d)) < 1e-9;
    return (
      p.max > p.min &&
      on(p.min) &&
      on(p.max) &&
      (p.max - p.min) * d <= 24 &&
      p.groups.every((g) =>
        g.values.every((v) => on(v) && v >= p.min && v <= p.max),
      )
    );
  }, "Values sit on ticks inside the scale");

export type DotPlot = z.infer<typeof dotPlotSchema>;

registerComponent("dotPlot", {
  maxScale: (p) => 40 * (p.denominator ?? 1),
  compile(p, { s }) {
    const d = p.denominator ?? 1,
      kind = p.mark ?? "dot";
    const text = (v: number) => mixed(v, d);
    const list = scaleTicks(p.min, p.max, 1 / d, s, text).map((t) => ({
      ...t,
      // Whole numbers are the major ticks on a fraction scale.
      major: d > 1 ? Number.isInteger(Math.round(t.v * 1e9) / 1e9) : true,
    }));
    const prims: Prim[] = [];
    // Each panel: name line, stacks, axis, tick labels; panels stack downward.
    const height = (values: readonly number[]) =>
      (NAME + FIRST + Math.max(1, tallest(values)) * STACK + LABELS) / s;
    let top = 0,
      lastAxis = 0;
    for (const [g, group] of p.groups.entries()) {
      const axisY = top - height(group.values) + LABELS / s;
      if (group.label)
        prims.push({
          type: "text",
          id: `group.${g}.label`,
          at: [p.min - 10 / s, top - NAME / 2 / s],
          text: group.label,
          font: "sans",
          bold: true,
          align: [-1, 0],
        });
      lastAxis = axisY;
      axis(prims, `axis.${g}`, p.min, p.max, axisY, s, list, text);
      const seen = new Map<number, number>();
      for (const [i, v] of group.values.entries()) {
        const level = seen.get(v) ?? 0;
        seen.set(v, level + 1);
        const y = axisY + (FIRST + level * STACK) / s;
        const data = { mark: kind, value: v, level };
        if (kind === "dot")
          prims.push({
            type: "point",
            id: `group.${g}.mark.${i}`,
            at: [v, y],
            r: MARK,
            color: "accent",
            data,
          });
        else {
          const k = 5.5 / s;
          prims.push(
            {
              type: "segment",
              id: `group.${g}.mark.${i}`,
              from: [v - k, y - k],
              to: [v + k, y + k],
              stroke: "accent",
              width: 3,
              cap: "round",
              data,
            },
            {
              type: "segment",
              id: `group.${g}.mark.${i}.cross`,
              from: [v - k, y + k],
              to: [v + k, y - k],
              stroke: "accent",
              width: 3,
              cap: "round",
            },
          );
        }
      }
      top -= height(group.values) + 12 / s;
    }
    if (p.unit) prims.push(unitLabel(p.unit, p.max, lastAxis, s));
    return prims;
  },
  describe(p) {
    const d = p.denominator ?? 1;
    const counts = (values: readonly number[]) => {
      const m = new Map<number, number>();
      for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
      return [...m]
        .sort((a, b) => a[0] - b[0])
        .map(([v, c]) => `${mixed(v, d).replace("/", " over ")}: ${c}`)
        .join("; ");
    };
    const kind = (p.mark ?? "dot") === "x" ? "Line plot" : "Dot plot";
    return p.groups.length === 1
      ? `${kind} of ${p.groups[0]!.values.length} values${p.unit ? ` in ${p.unit}` : ""}, from ${spoken(p.min)} to ${spoken(p.max)}. ${counts(p.groups[0]!.values)}.`
      : `${p.groups.length} ${kind.toLowerCase()}s${p.unit ? ` of ${p.unit}` : ""} on the same scale. ${p.groups.map((g, i) => `${g.label ?? `Group ${i + 1}`}: ${counts(g.values)}`).join(". ")}.`;
  },
});
