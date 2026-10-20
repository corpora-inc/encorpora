import { z } from "zod";
import { base, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import { spoken } from "./format";

/** A picture graph: each whole symbol stands for `key` items, a half symbol
 * for half a key. */
export const pictureGraphSchema = z
  .object({
    ...base,
    type: z.literal("pictureGraph"),
    rows: z
      .array(
        z
          .object({ label: z.string().min(1).max(12), count: small.max(1000) })
          .strict(),
      )
      .min(1)
      .max(5),
    key: z.number().int().min(1).max(100),
    unit: z.string().min(1).max(24),
  })
  .strict()
  .refine(
    (p) =>
      p.rows.every((r) => {
        const half = p.key % 2 === 0 ? p.key / 2 : p.key;
        return r.count % half === 0 && r.count / p.key <= 10;
      }),
    "Every count is whole or half symbols, at most ten",
  );
export type PictureGraph = z.infer<typeof pictureGraphSchema>;

const ROW = 36,
  R = 10,
  GAP = 26;
const plural = (n: number, unit: string) =>
  n === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;
/** Symbol centers per row, in pixels from the top left. */
export function pictureGeometry(p: PictureGraph) {
  const labelWidth =
    Math.max(...p.rows.map((r) => typeset(r.label, "sans", "md").width)) + 18;
  return {
    labelWidth,
    rows: p.rows.map((r, i) => {
      const wholes = Math.floor(r.count / p.key),
        half = r.count % p.key !== 0;
      return {
        y: i * ROW + ROW / 2,
        symbols: Array.from({ length: wholes + (half ? 1 : 0) }, (_, j) => ({
          cx: labelWidth + 16 + j * GAP,
          half: half && j === wholes,
        })),
      };
    }),
    keyY: p.rows.length * ROW + 26,
  };
}

registerComponent("pictureGraph", {
  maxScale: () => 1,
  compile(p, { s }) {
    const g = pictureGeometry(p);
    const P = (x: number, y: number): [number, number] => [x / s, -y / s];
    const prims: Prim[] = [];
    const token = (id: string, cx: number, cy: number, half: boolean, r = R) =>
      half
        ? ({
            type: "arc",
            id,
            center: P(cx, cy),
            r: r / s,
            from: 90,
            to: 270,
            fill: "accent",
            stroke: "accent",
            width: 0.5,
          } as const)
        : ({
            type: "circle",
            id,
            center: P(cx, cy),
            r: r / s,
            fill: "accent",
            stroke: "accent",
            width: 0.5,
          } as const);
    const end = Math.max(
      g.labelWidth + 16 + 10 * GAP,
      ...g.rows.flatMap((r) => r.symbols.map((t) => t.cx + R + 8)),
    );
    for (const [i, row] of g.rows.entries()) {
      if (i)
        prims.push({
          type: "segment",
          id: `row.${i}.rule`,
          from: P(0, row.y - ROW / 2),
          to: P(end, row.y - ROW / 2),
          stroke: "grid",
          width: 1,
        });
      prims.push({
        type: "text",
        id: `row.${i}.label`,
        at: P(g.labelWidth - 10, row.y),
        text: p.rows[i]!.label,
        font: "sans",
        align: [1, 0],
      });
      for (const [j, t] of row.symbols.entries())
        prims.push({
          ...token(`row.${i}.symbol.${j}`, t.cx, row.y, t.half),
          data: { symbol: t.half ? "half" : "whole" },
        } as Prim);
    }
    prims.push({
      type: "segment",
      id: "divider",
      from: P(g.labelWidth, 0),
      to: P(g.labelWidth, g.rows.length * ROW),
      stroke: "axis",
      width: 2,
    });
    // A full row of ten symbols makes the graph wider than a phone's stage,
    // so it is drawn at about 74% on a 320 px phone: the key is set at the
    // row labels' size so it still reads at 12 px or more there.
    const key = `= ${p.key} ${plural(p.key, p.unit)}`,
      keyWidth = Math.max(190, 34 + typeset(key, "sans", "md").width + 12);
    prims.push(
      {
        type: "rect",
        id: "key",
        at: P(g.labelWidth, g.keyY + 14),
        size: [keyWidth / s, 28 / s],
        radius: 6,
        fill: "empty",
      },
      token("key.symbol", g.labelWidth + 18, g.keyY, false, R - 2) as Prim,
      {
        type: "text",
        id: "key.label",
        at: P(g.labelWidth + 34, g.keyY),
        text: key,
        font: "sans",
        align: [-1, 0],
      },
    );
    return prims;
  },
  describe(p) {
    return `Picture graph. Each symbol stands for ${spoken(p.key)} ${plural(p.key, p.unit)}${p.key % 2 === 0 ? `; a half symbol stands for ${spoken(p.key / 2)}` : ""}. ${p.rows.map((r) => `${r.label}: ${spoken(r.count)}`).join("; ")}.`;
  },
});
