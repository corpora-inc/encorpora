import { registerComponent, type Prim } from "../layout";
import type { Point } from "../spec";
import { z } from "zod";
import { base, num as zNum } from "../base";
import {
  boundsOf,
  cellPrims,
  distinctLabels,
  flatShapeSchema,
  itemPrims,
  shapeItemSchema,
} from "./shapes";

const point = z.tuple([zNum.min(-40).max(40), zNum.min(-40).max(40)]);
/** A dashed target outline partly covered by pieces, and lettered candidate
 * pieces at the same scale below it; one candidate fills the gap. */
export const shapePuzzleSchema = z
  .object({
    ...base,
    type: z.literal("shapePuzzle"),
    outline: z.array(point).min(3).max(12),
    placed: z.array(flatShapeSchema).min(1).max(7),
    candidates: z.array(shapeItemSchema).min(2).max(4),
  })
  .strict()
  .refine(
    (s) => distinctLabels(s.candidates) && s.candidates.every((c) => c.label),
    "Candidates are lettered",
  );
export type ShapePuzzle = z.infer<typeof shapePuzzleSchema>;

/** The target spans the top; the lettered candidates share one row below,
 * all at one scale, so a piece of the wrong size looks the wrong size. */
registerComponent("shapePuzzle", {
  maxScale: () => 90,
  compile(c, ctx) {
    const s = ctx.s,
      n = c.candidates.length;
    const boxes = c.candidates.map((k) => boundsOf(k.pieces));
    const w = Math.max(...boxes.map((b) => b.x1 - b.x0)),
      h = Math.max(...boxes.map((b) => b.y1 - b.y0));
    const target = boundsOf([{ type: "polygon", points: c.outline }]);
    const pad = 0.22 * Math.max(w, h);
    const top = 26 / s;
    const cw = Math.max(w + 2 * pad, (target.x1 - target.x0 + 2 * pad) / n),
      ch = h + 2 * pad + top;
    const width = n * cw,
      th = target.y1 - target.y0 + 2 * pad;
    // Target region above the candidate row (row spans y in [-ch, 0]).
    const shift: Point = [
      width / 2 - (target.x0 + target.x1) / 2,
      th / 2 - (target.y0 + target.y1) / 2,
    ];
    const move = (p: readonly number[]): Point => [
      p[0]! + shift[0],
      p[1]! + shift[1],
    ];
    const prims: Prim[] = [
      {
        type: "polygon",
        id: "outline",
        points: c.outline.map(move),
        fill: "paper",
        stroke: "ink",
        width: 2,
        dash: "dash",
      },
      ...c.placed.map((p, j): Prim => ({
        type: "polygon",
        id: `placed.${j}`,
        points: (p.type === "polygon" ? p.points : []).map(move),
        fill: "accent-fill",
        stroke: "ink",
        width: 2.5,
      })),
    ];
    c.candidates.forEach((item, i) => {
      const cell = { x0: i * cw, x1: (i + 1) * cw, y0: -ch, y1: 0 };
      const b = boxes[i]!;
      const by: Point = [
        (cell.x0 + cell.x1) / 2 - (b.x0 + b.x1) / 2,
        (cell.y0 + cell.y1 - top) / 2 - (b.y0 + b.y1) / 2,
      ];
      const prefix = `piece.${item.label}`;
      prims.push(...cellPrims(cell, item.label, s, prefix));
      prims.push(...itemPrims(item, by, s, prefix));
    });
    return prims;
  },
  describe(c) {
    return `A larger shape outlined with a dashed line, filled by ${c.placed.length} ${c.placed.length === 1 ? "piece" : "pieces"} except for one empty space. ${c.candidates.length} loose pieces, labeled ${c.candidates.map((k) => k.label).join(", ")}, are drawn at the same scale.`;
  },
});
