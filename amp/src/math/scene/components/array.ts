import { z } from "zod";
import { count } from "../../agreement";
import { base, fill } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { Point } from "../spec";

/** Rows × columns of unit squares or dots, optionally split into regions. */
export const arraySchema = z
  .object({
    ...base,
    type: z.literal("array"),
    rows: z.number().int().min(1).max(20),
    columns: z.number().int().min(1).max(20),
    shape: z.enum(["square", "dot"]).optional(),
    splitAfterRow: z.number().int().min(1).optional(),
    splitAfterColumn: z.number().int().min(1).optional(),
    regionLabels: z.boolean().optional(),
  })
  .strict()
  .refine(
    (f) =>
      (f.splitAfterRow === undefined || f.splitAfterRow < f.rows) &&
      (f.splitAfterColumn === undefined || f.splitAfterColumn < f.columns),
  );
export type ArrayModel = z.infer<typeof arraySchema>;

registerComponent("array", {
  maxScale: () => 30,
  compile(c) {
    const prims: Prim[] = [];
    const dot = c.shape === "dot";
    for (let r = 0; r < c.rows; r++)
      for (let col = 0; col < c.columns; col++) {
        const lower =
          (c.splitAfterRow !== undefined && r >= c.splitAfterRow) ||
          (c.splitAfterColumn !== undefined && col >= c.splitAfterColumn);
        const at: Point = [col, c.rows - 1 - r];
        prims.push(
          dot
            ? {
                type: "circle",
                id: `cell.${r}.${col}`,
                center: [at[0] + 0.5, at[1] + 0.5],
                r: 0.32,
                fill: lower ? "warm" : "accent",
                stroke: "paper",
                width: 1,
                data: { "unit-cell": r * c.columns + col },
              }
            : {
                type: "rect",
                id: `cell.${r}.${col}`,
                at,
                size: [1, 1],
                fill: lower ? "warm-fill" : "accent-fill",
                stroke: "ink",
                width: 1.25,
                data: { "unit-cell": r * c.columns + col },
              },
        );
      }
    if (c.splitAfterRow !== undefined) {
      const y = c.rows - c.splitAfterRow;
      prims.push({
        type: "segment",
        id: "split",
        from: [-0.12, y],
        to: [c.columns + 0.12, y],
        stroke: "ink",
        width: 3,
      });
      if (c.regionLabels !== false) {
        prims.push({
          type: "text",
          id: "region.a",
          at: [c.columns, (y + c.rows) / 2],
          text: "A",
          font: "sans",
          bold: true,
          color: "accent",
          offset: [12, 0],
          align: [-1, 0],
        });
        prims.push({
          type: "text",
          id: "region.b",
          at: [c.columns, y / 2],
          text: "B",
          font: "sans",
          bold: true,
          color: "warm",
          offset: [12, 0],
          align: [-1, 0],
        });
      }
    }
    if (c.splitAfterColumn !== undefined) {
      const x = c.splitAfterColumn;
      prims.push({
        type: "segment",
        id: "split.column",
        from: [x, -0.12],
        to: [x, c.rows + 0.12],
        stroke: "ink",
        width: 3,
      });
    }
    return prims;
  },
  describe(c) {
    const unit = c.shape === "dot" ? "dot" : "unit square";
    return `${count(c.rows, "row")} of ${count(c.columns, unit)}${c.splitAfterRow ? `; region A is the top ${count(c.splitAfterRow, "row")} and region B is the remaining ${c.rows - c.splitAfterRow}` : ""}${c.splitAfterColumn ? `; a line splits the first ${count(c.splitAfterColumn, "column")} from the other ${c.columns - c.splitAfterColumn}` : ""}.`;
  },
});
