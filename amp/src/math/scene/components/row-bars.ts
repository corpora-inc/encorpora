import { z } from "zod";
import { base, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole, InkRole } from "../roles";
import { typeset } from "../type";

/** Rows of a two-way table as bars: first on one count scale, then each
 * stretched to 100%, so the parts compare as fractions of their own row. */
export const rowBarsSchema = z
  .object({
    ...base,
    type: z.literal("rowBars"),
    /** Part names, in bar order: ["Yes", "No"]. */
    parts: z.array(z.string().min(1).max(12)).min(2).max(4),
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(18),
            counts: z.array(small.max(100000)).min(2).max(4),
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict()
  .refine(
    (b) =>
      b.rows.every(
        (r) =>
          r.counts.length === b.parts.length &&
          r.counts.reduce((a, c) => a + c, 0) > 0,
      ),
    "Each row has one count per part and a positive total",
  );
export type RowBars = z.infer<typeof rowBarsSchema>;

/** Geometry in figure pixels; compile divides by the scale. */
const BAR = 300,
  BAR_HEIGHT = 22,
  LINE = 20,
  ROW = LINE + BAR_HEIGHT + 14,
  HEADER = 26,
  LEGEND = 26,
  GAP = 14;
const tones: [FillRole, InkRole][] = [
  ["accent-strong", "accent"],
  ["empty", "axis"],
  ["gold-fill", "gold"],
  ["warm-fill", "warm"],
];
const total = (counts: number[]) => counts.reduce((a, b) => a + b, 0);
/** A whole percent, or one decimal place when it is not whole. */
export const percentText = (part: number, whole: number) => {
  const p = (100 * part) / whole;
  return `${Number.isInteger(p) ? p : p.toFixed(1)}%`;
};

/** Pixel layout of both panels, from the top left: the count bars share one
 * scale; the percent bars are each the full width. */
export function rowBarsGeometry(b: RowBars) {
  const largest = Math.max(...b.rows.map((r) => total(r.counts)));
  const panelTop = (panel: 0 | 1) =>
    LEGEND + panel * (HEADER + b.rows.length * ROW + GAP);
  return {
    width: BAR,
    height: panelTop(1) + HEADER + b.rows.length * ROW,
    panelTop,
    barTop: (panel: 0 | 1, i: number) =>
      panelTop(panel) + HEADER + i * ROW + LINE + 2,
    /** Segment k of row i: left edge and width in pixels. */
    segment: (panel: 0 | 1, i: number, k: number) => {
      const counts = b.rows[i]!.counts,
        whole = panel === 0 ? largest : total(counts);
      const before = counts.slice(0, k).reduce((a, c) => a + c, 0);
      return {
        x: (BAR * before) / whole,
        w: (BAR * counts[k]!) / whole,
      };
    },
  };
}

registerComponent("rowBars", {
  maxScale: () => 1,
  compile(b, { s }) {
    const g = rowBarsGeometry(b);
    const P = (x: number, y: number): [number, number] => [x / s, -y / s];
    const prims: Prim[] = [];
    // Legend: one swatch per part.
    let x = 0;
    for (const [k, name] of b.parts.entries()) {
      const [fill, stroke] = tones[k]!;
      prims.push(
        {
          type: "rect",
          id: `legend.${k}`,
          at: P(x, 18),
          size: [14 / s, 14 / s],
          radius: 2,
          fill,
          stroke,
          width: 1.25,
        },
        {
          type: "text",
          id: `legend.${k}.label`,
          at: P(x + 20, 11),
          text: name,
          font: "sans",
          size: "sm",
          align: [-1, 0],
        },
      );
      x += 20 + typeset(name, "sans", "sm").width + 18;
    }
    const first = b.parts[0]!.toLowerCase();
    for (const panel of [0, 1] as const) {
      const name = panel === 0 ? "count" : "percent";
      prims.push({
        type: "text",
        id: `${name}.title`,
        at: P(0, g.panelTop(panel) + HEADER / 2),
        text: panel === 0 ? "Counts, on one scale" : "Each row as 100%",
        font: "sans",
        bold: true,
        size: "sm",
        align: [-1, 0],
      });
      for (const [i, row] of b.rows.entries()) {
        const top = g.barTop(panel, i),
          whole = total(row.counts);
        prims.push({
          type: "text",
          id: `${name}.${i}.label`,
          at: P(0, top - LINE / 2 - 2),
          text:
            panel === 0
              ? `${row.label}: ${row.counts[0]} of ${whole} ${first}`
              : `${row.label}: ${percentText(row.counts[0]!, whole)} ${first}`,
          font: "sans",
          size: "sm",
          align: [-1, 0],
        });
        for (const [k] of row.counts.entries()) {
          const seg = g.segment(panel, i, k);
          if (seg.w <= 0) continue;
          const [fill, stroke] = tones[k]!;
          prims.push({
            type: "rect",
            id: `${name}.${i}.part.${k}`,
            at: P(seg.x, top + BAR_HEIGHT),
            size: [seg.w / s, BAR_HEIGHT / s],
            fill,
            stroke,
            width: 1.5,
            data: { part: k, count: row.counts[k]! },
          });
        }
      }
    }
    return prims;
  },
  describe(b) {
    const first = b.parts[0]!.toLowerCase();
    return `Bars for ${b.rows.length} rows, split into ${b.parts.join(" and ")}. ${b.rows
      .map(
        (r) =>
          `${r.label}: ${r.counts[0]} of ${total(r.counts)} ${first}, ${percentText(r.counts[0]!, total(r.counts))}.`,
      )
      .join(" ")} First on one count scale, then each row stretched to 100%.`;
  },
});
