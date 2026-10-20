import { z } from "zod";
import { base, coord, num } from "../base";
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
    /** Vertical guides at a value (a pivot, a mean), optionally with the
     * horizontal distance from each mark of that group to it. */
    references: z
      .array(
        z
          .object({
            at: coord,
            group: z.number().int().min(0).max(1).optional(),
            distances: z.boolean().optional(),
            label: z.string().min(1).max(16).optional(),
          })
          .strict(),
      )
      .max(4)
      .optional(),
    /** The first group's quartiles (median of each half) as labeled lines. */
    quartiles: z.boolean().optional(),
    /** The first group's box plot, drawn over its marks. */
    box: z.boolean().optional(),
    /** The first group's values shared equally: one mark each at this value. */
    share: coord.optional(),
    /** Blocks of `size` laid from `from` to `to` under the first group. */
    bricks: z
      .object({ from: coord, to: coord, size: num.positive() })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (p) =>
      (p.share === undefined || (p.share >= p.min && p.share <= p.max)) &&
      (!p.bricks ||
        (p.bricks.from >= p.min &&
          p.bricks.to <= p.max &&
          p.bricks.to > p.bricks.from &&
          (p.bricks.to - p.bricks.from) / p.bricks.size <= 24)) &&
      (p.references ?? []).every(
        (r) =>
          r.at >= p.min && r.at <= p.max && (r.group ?? 0) < p.groups.length,
      ),
    "Guides sit inside the scale",
  )
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

/** Minimum, quartiles (median of each half, leaving out the middle value
 * when the count is odd), median and maximum. */
export function fiveNumbers(values: readonly number[]) {
  const v = [...values].sort((a, b) => a - b),
    n = v.length;
  const median = (xs: number[]) => {
    const k = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[k]! : (xs[k - 1]! + xs[k]!) / 2;
  };
  return {
    min: v[0]!,
    q1: median(v.slice(0, Math.floor(n / 2))),
    median: median(v),
    q3: median(v.slice(Math.ceil(n / 2))),
    max: v[n - 1]!,
  };
}
const BAND = 56,
  BRICKS = 22,
  REF = 20;

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
    // Each panel, top down: name line, [quartile and box band], stacks,
    // axis, tick labels, [bricks]; panels stack downward.
    const levels = (g: number) =>
      Math.max(
        1,
        tallest(p.groups[g]!.values),
        g === 0 && p.share !== undefined ? p.groups[0]!.values.length : 0,
      );
    const band = (g: number) =>
      (g === 0 && (p.quartiles || p.box) ? BAND : 0) +
      ((p.references ?? []).some((r) => (r.group ?? 0) === g && r.label)
        ? REF
        : 0);
    const below = (g: number) => (g === 0 && p.bricks ? BRICKS : 0);
    const height = (g: number) =>
      (NAME + band(g) + FIRST + levels(g) * STACK + LABELS + below(g)) / s;
    const markAt = (v: number, axisY: number, level: number, id: string) => {
      const y = axisY + (FIRST + level * STACK) / s;
      const data = { mark: kind, value: v, level };
      if (kind === "dot")
        return [
          {
            type: "point",
            id,
            at: [v, y],
            r: MARK,
            color: "accent",
            data,
          } satisfies Prim,
        ];
      const k = 5.5 / s;
      return [
        {
          type: "segment",
          id,
          from: [v - k, y - k],
          to: [v + k, y + k],
          stroke: "accent",
          width: 3,
          cap: "round",
          data,
        } satisfies Prim,
        {
          type: "segment",
          id: `${id}.cross`,
          from: [v - k, y + k],
          to: [v + k, y - k],
          stroke: "accent",
          width: 3,
          cap: "round",
        } satisfies Prim,
      ];
    };
    let top = 0,
      lastAxis = 0;
    const axes: number[] = [],
      tops: number[] = [];
    for (const [g, group] of p.groups.entries()) {
      const axisY = top - height(g) + (LABELS + below(g)) / s;
      axes.push(axisY);
      tops.push(top);
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
      // Distances first, so the marks sit on top of them.
      for (const [r, ref] of (p.references ?? []).entries()) {
        if ((ref.group ?? 0) !== g || !ref.distances) continue;
        const seen = new Map<number, number>();
        for (const [i, v] of group.values.entries()) {
          const level = seen.get(v) ?? 0;
          seen.set(v, level + 1);
          if (v === ref.at) continue;
          const y = axisY + (FIRST + level * STACK) / s;
          prims.push({
            type: "segment",
            id: `ref.${r}.distance.${i}`,
            from: [v, y],
            to: [ref.at, y],
            stroke: v < ref.at ? "warm" : "gold",
            width: 3,
            data: { distance: Math.abs(v - ref.at) },
          });
        }
      }
      const seen = new Map<number, number>();
      for (const [i, v] of group.values.entries()) {
        const level = seen.get(v) ?? 0;
        seen.set(v, level + 1);
        prims.push(...markAt(v, axisY, level, `group.${g}.mark.${i}`));
      }
      top -= height(g) + 12 / s;
    }
    const stackTop = (g: number) =>
      axes[g]! + (FIRST + (levels(g) - 0.5) * STACK) / s;
    for (const [r, ref] of (p.references ?? []).entries()) {
      const g = ref.group ?? 0;
      prims.push({
        type: "segment",
        id: `ref.${r}`,
        from: [ref.at, axes[g]! - 6 / s],
        to: [ref.at, stackTop(g)],
        stroke: "warm",
        width: 2.5,
        dash: "dash",
        data: { reference: ref.at },
      });
      if (ref.label)
        prims.push({
          type: "text",
          id: `ref.${r}.label`,
          at: [ref.at, stackTop(g)],
          text: ref.label,
          font: "sans",
          size: "sm",
          bold: true,
          color: "warm",
          halo: true,
          // Beside the top of its line, on whichever side is clear.
          place: [
            [4, -2, -1, 1],
            [-4, -2, 1, 1],
          ],
        });
    }
    if (p.share !== undefined)
      for (let k = 0; k < p.groups[0]!.values.length; k++)
        prims.push(...markAt(p.share, axes[0]!, k, `share.${k}`));
    if (p.quartiles || p.box) {
      const q = fiveNumbers(p.groups[0]!.values);
      const bandTop = tops[0]! - NAME / s,
        boxY = bandTop - (BAND - 16) / s;
      if (p.quartiles)
        for (const [k, [v, name]] of (
          [
            [q.q1, "Q1"],
            [q.median, "M"],
            [q.q3, "Q3"],
          ] as const
        ).entries())
          prims.push(
            {
              type: "segment",
              id: `quartile.${k}`,
              from: [v, axes[0]!],
              to: [v, bandTop - 18 / s],
              stroke: "warm",
              width: 2,
              dash: "dash",
              data: { quartile: name, value: v },
            },
            {
              type: "text",
              id: `quartile.${k}.label`,
              at: [v, bandTop - 18 / s],
              text: name,
              font: "sans",
              size: "sm",
              bold: true,
              color: "warm",
              halo: true,
              offset: [0, -2],
              align: [0, 1],
            },
          );
      if (p.box) {
        const h = 11 / s,
          cap = 8 / s;
        const line = (id: string, a: number, b: number) =>
          prims.push({
            type: "segment",
            id,
            from: [a, boxY],
            to: [b, boxY],
            stroke: "accent",
            width: 2.5,
          });
        line("box.whisker.low", q.min, q.q1);
        line("box.whisker.high", q.q3, q.max);
        for (const [k, v] of [q.min, q.max].entries())
          prims.push({
            type: "segment",
            id: `box.end.${k}`,
            from: [v, boxY - cap],
            to: [v, boxY + cap],
            stroke: "accent",
            width: 2.5,
          });
        prims.push(
          {
            type: "rect",
            id: "box.box",
            at: [q.q1, boxY - h],
            size: [Math.max(q.q3 - q.q1, 1e-6), 2 * h],
            fill: "accent-fill",
            stroke: "accent",
            width: 2.5,
            data: { q1: q.q1, q3: q.q3 },
          },
          {
            type: "segment",
            id: "box.median",
            from: [q.median, boxY - h],
            to: [q.median, boxY + h],
            stroke: "warm",
            width: 3.5,
          },
        );
      }
    }
    if (p.bricks) {
      const { from, to, size } = p.bricks;
      const y = axes[0]! - (LABELS + BRICKS - 6) / s;
      for (let k = 0; from + k * size < to - 1e-9; k++) {
        const x = from + k * size;
        prims.push({
          type: "rect",
          id: `brick.${k}`,
          at: [x, y],
          size: [Math.min(size, to - x), 12 / s],
          radius: 2,
          fill: k % 2 ? "gold-fill" : "accent-strong",
          stroke: "ink",
          width: 1.25,
          data: { brick: k },
        });
      }
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
    const extras = [
      ...(p.references ?? []).map(
        (r) =>
          ` A guide line at ${spoken(r.at)}${r.label ? ` (${r.label})` : ""}${r.distances ? ", with each value's distance to it" : ""}.`,
      ),
      ...(p.quartiles || p.box
        ? (() => {
            const q = fiveNumbers(p.groups[0]!.values);
            return [
              ` Quartiles: Q1 ${spoken(q.q1)}, median ${spoken(q.median)}, Q3 ${spoken(q.q3)}${p.box ? `; a box from Q1 to Q3 with whiskers to ${spoken(q.min)} and ${spoken(q.max)}` : ""}.`,
            ];
          })()
        : []),
      ...(p.share !== undefined
        ? [` Shared equally, every value would be ${mixed(p.share, d)}.`]
        : []),
      ...(p.bricks
        ? [
            ` Blocks of ${spoken(p.bricks.size)} span ${spoken(p.bricks.from)} to ${spoken(p.bricks.to)}.`,
          ]
        : []),
    ].join("");
    return `${describeGroups(p, kind, counts)}${extras}`;
  },
});
function describeGroups(
  p: DotPlot,
  kind: string,
  counts: (values: readonly number[]) => string,
) {
  return p.groups.length === 1
    ? `${kind} of ${p.groups[0]!.values.length} values${p.unit ? ` in ${p.unit}` : ""}, from ${spoken(p.min)} to ${spoken(p.max)}. ${counts(p.groups[0]!.values)}.`
    : `${p.groups.length} ${kind.toLowerCase()}s${p.unit ? ` of ${p.unit}` : ""} on the same scale. ${p.groups.map((g, i) => `${g.label ?? `Group ${i + 1}`}: ${counts(g.values)}`).join(". ")}.`;
}
