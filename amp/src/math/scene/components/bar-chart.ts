import { z } from "zod";
import { base, num } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import { num as numText, spoken } from "./format";
import { ticks } from "./number-line";

const name = z.string().min(1).max(16);
/** A vertical bar chart on a labeled count scale: separate bars for
 * categories, or touching bars over equal intervals (a histogram). */
export const barChartSchema = z
  .object({
    ...base,
    type: z.literal("barChart"),
    /** Separate bars, one per category. */
    bars: z
      .array(z.object({ label: name, value: num.min(0) }).strict())
      .min(1)
      .max(8)
      .optional(),
    /** Touching bars over [start + i·width, start + (i+1)·width). */
    bins: z
      .object({
        start: num,
        width: num.positive(),
        counts: z.array(num.min(0)).min(1).max(10),
      })
      .strict()
      .optional(),
    /** Top of the scale and the gridline step; labels every step. */
    max: num.positive(),
    step: num.positive(),
    /** Names the scale (above it) and, for bins, the measured quantity. */
    unit: z.string().min(1).max(24).optional(),
    xUnit: z.string().min(1).max(24).optional(),
  })
  .strict()
  .refine((c) => !c.bars !== !c.bins, "Bars or bins, not both")
  .refine(
    (c) =>
      c.max / c.step <= 20 &&
      [...(c.bars?.map((b) => b.value) ?? []), ...(c.bins?.counts ?? [])].every(
        (v) => v <= c.max,
      ),
    "Every bar fits the scale",
  );
export type BarChart = z.infer<typeof barChartSchema>;

/** Pixel geometry from the top left; compile divides by the scale. The
 * plot grows with the number of gridlines, up to a ceiling, so a fine scale
 * keeps its gridlines apart (docs/figures.md, Charts). */
const BAND = 80,
  WIDTH = 280,
  TOP = 30,
  GRID_GAP = 20,
  RADIUS = 3;
export function barChartGeometry(c: BarChart) {
  const gridlines = ticks(0, c.max, c.step);
  const steps = gridlines.length - 1;
  const plot = Math.min(200, Math.max(150, steps * GRID_GAP));
  // Label every gridline when labels fit apart, else every 2nd or 5th.
  const stride =
    [1, 2, 5, 10].find((k) => (plot / steps) * k >= GRID_GAP - 0.5) ?? 20;
  const labeled = gridlines.filter((_, i) => i % stride === 0);
  const widest = Math.max(
    ...labeled.map((v) => typeset(numText(v), "math", "sm").width),
  );
  const left = widest + 14;
  const y = (v: number) => TOP + plot - (plot * v) / c.max;
  const n = c.bars?.length ?? c.bins!.counts.length;
  // Separate bars keep one band width and a 0.6 bar-to-band ratio; bins
  // share the full width and touch.
  const slot = c.bars ? Math.min(BAND, WIDTH / n) : WIDTH / n;
  const bars = c.bars
    ? c.bars.map((b, i) => {
        const w = slot * 0.6;
        return {
          x: left + slot * i + (slot - w) / 2,
          w,
          center: left + slot * i + slot / 2,
          top: y(b.value),
        };
      })
    : c.bins!.counts.map((count, i) => ({
        x: left + slot * i,
        w: slot,
        center: left + slot * i + slot / 2,
        top: y(count),
      }));
  return {
    left,
    widest,
    right: left + slot * n,
    top: TOP,
    bottom: TOP + plot,
    y,
    gridlines,
    labeled: new Set(labeled),
    bars,
  };
}

registerComponent("barChart", {
  maxScale: () => 1,
  compile(c, { s }) {
    const g = barChartGeometry(c);
    const P = (x: number, y: number): [number, number] => [x / s, -y / s];
    const prims: Prim[] = [];
    // Hairline gridlines carry the reading; the baseline is drawn last,
    // over the bars' feet.
    for (const v of g.gridlines) {
      if (v)
        prims.push({
          type: "segment",
          id: `grid.${v}`,
          from: P(g.left, g.y(v)),
          to: P(g.right, g.y(v)),
          stroke: "grid",
          width: 1,
        });
      if (g.labeled.has(v))
        prims.push({
          type: "text",
          id: `label.y.${v}`,
          at: P(g.left - 8, g.y(v)),
          text: numText(v),
          size: "sm",
          color: "muted",
          align: [1, 0],
          data: { "tick-label": v },
        });
    }
    if (c.unit)
      // A quiet caption over the scale, flush with its labels.
      prims.push({
        type: "text",
        id: "unit",
        at: P(g.left - 8 - g.widest, g.top - 14),
        text: c.unit,
        font: "sans",
        size: "sm",
        color: "muted",
        align: [-1, 1],
      });
    for (const [i, b] of g.bars.entries()) {
      const value = c.bars ? c.bars[i]!.value : c.bins!.counts[i]!;
      const h = g.bottom - b.top;
      if (value > 0) {
        // Separate bars round their top corners, flush with the baseline;
        // touching bins stay square, parted by a paper hairline.
        prims.push({
          type: "rect",
          id: `bar.${i}`,
          at: P(b.x, g.bottom),
          size: [b.w / s, h / s],
          fill: "accent",
          ...(c.bars
            ? { radius: RADIUS, roundTop: true }
            : { stroke: "paper", width: 1 }),
          data: c.bars
            ? { bar: c.bars[i]!.label, value }
            : { bin: c.bins!.start + i * c.bins!.width, count: value },
        });
      }
      if (c.bars)
        prims.push({
          type: "text",
          id: `bar.${i}.label`,
          at: P(b.center, g.bottom + 8),
          text: c.bars[i]!.label,
          font: "sans",
          size: "sm",
          align: [0, -1],
        });
    }
    if (c.bins) {
      const { start, width, counts } = c.bins;
      for (let i = 0; i <= counts.length; i++) {
        const x = g.left + ((g.right - g.left) * i) / counts.length,
          v = start + i * width;
        prims.push(
          {
            type: "tick",
            id: `edge.${i}`,
            at: P(x, g.bottom),
            dir: [0, 1],
            length: 6,
            stroke: "axis",
            data: { edge: v },
          },
          {
            type: "text",
            id: `edge.${i}.label`,
            at: P(x, g.bottom + 8),
            text: numText(v),
            size: "sm",
            color: "muted",
            align: [0, -1],
          },
        );
      }
      if (c.xUnit)
        prims.push({
          type: "text",
          id: "xunit",
          at: P(g.right, g.bottom + 32),
          text: c.xUnit,
          font: "sans",
          size: "sm",
          color: "muted",
          align: [1, -1],
        });
    }
    prims.push({
      type: "segment",
      id: "grid.0",
      from: P(g.left, g.bottom),
      to: P(g.right, g.bottom),
      stroke: "ink",
      width: 1.5,
    });
    return prims;
  },
  describe(c) {
    if (c.bins) {
      const { start, width, counts } = c.bins;
      return `Histogram${c.xUnit ? ` of ${c.xUnit}` : ""}, intervals of ${spoken(width)}. ${counts
        .map(
          (n, i) =>
            `${spoken(start + i * width)} to less than ${spoken(start + (i + 1) * width)}: ${spoken(n)}`,
        )
        .join("; ")}.`;
    }
    return `Bar graph${c.unit ? ` of ${c.unit}` : ""}. The scale counts by ${spoken(c.step)}s from 0 to ${spoken(c.max)}. ${c
      .bars!.map((b) => `${b.label}: ${spoken(b.value)}`)
      .join("; ")}.`;
  },
});
