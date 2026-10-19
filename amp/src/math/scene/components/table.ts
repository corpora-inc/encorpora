import { z } from "zod";
import { base, color, label, num as zNum, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import { num } from "./format";

const tableCell = z.union([
  zNum.min(-1e6).max(1e6),
  z.string().min(1).max(16),
  z.null(),
]);
/** A table of short entries: header row, labeled rows and, with `sums`, a
 * total column and a total row. A derived cell is the one to find: it is null
 * in the data, drawn as "?", and when revealed computed from the sums. */
export const tableSchema = z
  .object({
    ...base,
    type: z.literal("table"),
    /** A heading over the body columns ("Has a curfew"). */
    title: label.max(32).optional(),
    columns: z.array(z.string().min(1).max(16)).min(1).max(6),
    rows: z
      .array(
        z
          .object({
            label: z.string().min(1).max(18),
            cells: z.array(tableCell).min(1).max(6),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    sums: z.boolean().optional(),
    derived: z
      .array(z.tuple([small.max(7), small.max(5)]))
      .max(4)
      .optional(),
    /** A heading over the row labels ("x", "n"). */
    corner: z.string().min(1).max(16).optional(),
    /** Headings and row labels are mathematics (x, f(x), a_n, 2^x), set
     * like the numbers rather than as bold words. */
    math: z.boolean().optional(),
    /** The change between consecutive rows of a body column (+3, ×2), drawn
     * as bowed arrows in a gutter to that column's right. */
    changes: z
      .array(
        z
          .object({
            column: small.max(5),
            labels: z.array(z.union([label, z.literal(false)])).max(7),
            color,
          })
          .strict(),
      )
      .max(3)
      .optional(),
    /** Rows (a conditional distribution) or body columns to tint. */
    highlight: z
      .object({
        rows: z.array(small.max(7)).max(8).optional(),
        columns: z.array(small.max(5)).max(6).optional(),
        color: z.enum(["accent", "warm", "gold"]).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (t) => t.rows.every((r) => r.cells.length === t.columns.length),
    "Every row has one cell per column",
  )
  .refine(
    (t) =>
      (t.changes ?? []).every(
        (c) =>
          c.column < t.columns.length && c.labels.length === t.rows.length - 1,
      ),
    "A change labels each gap between rows of a real column",
  )
  .refine(
    (t) =>
      (t.derived ?? []).every(
        ([r, c]) => r < t.rows.length && t.rows[r]!.cells[c] === null,
      ),
    "A derived cell is an empty cell of the table",
  )
  .refine(
    (t) => !t.derived?.length || (t.sums && completeTable(t) !== null),
    "Derived cells follow from the sums",
  )
  .refine((t) => !t.sums || completeTable(t) !== null, "Totals add up");
/** Fill a summed table's numeric blanks from its row and column totals; null
 * when it is inconsistent or the blanks are not determined. */
export function completeTable(t: {
  rows: { cells: (number | string | null)[] }[];
}): number[][] | null {
  const g = t.rows.map((r) =>
    r.cells.map((v) => (typeof v === "number" ? v : null)),
  );
  if (t.rows.some((r) => r.cells.some((v) => typeof v === "string")))
    return null;
  const n = g.length,
    m = g[0]!.length;
  const lines = [
    ...g.map((_, i) => Array.from({ length: m }, (_, j) => [i, j] as const)),
    ...Array.from({ length: m }, (_, j) =>
      Array.from({ length: n }, (_, i) => [i, j] as const),
    ),
  ];
  for (let changed = true; changed;) {
    changed = false;
    for (const line of lines) {
      const open = line.filter(([i, j]) => g[i]![j] === null);
      if (open.length !== 1) continue;
      const [oi, oj] = open[0]!;
      const last = line.at(-1)!;
      const parts = line
        .slice(0, -1)
        .filter(([i, j]) => !(i === oi && j === oj))
        .reduce((a, [i, j]) => a + g[i]![j]!, 0);
      g[oi]![oj] =
        oi === last[0] && oj === last[1]
          ? parts
          : g[last[0]]![last[1]]! - parts;
      changed = true;
    }
  }
  if (g.some((row) => row.some((v) => v === null))) return null;
  const full = g as number[][];
  for (const line of lines) {
    const values = line.map(([i, j]) => full[i]![j]!);
    const total = values.pop()!;
    if (Math.abs(values.reduce((a, b) => a + b, 0) - total) > 1e-9) return null;
  }
  return full;
}
export type Table = z.infer<typeof tableSchema>;

/** Table geometry in figure pixels; compile divides by the scale. */
const PAD = 12,
  ROW = 36,
  HEADER = 34,
  TITLE = 30,
  MIN_COLUMN = 56;
const isNumber = (v: unknown): v is number => typeof v === "number";
/** Change gutters: arrow bow, gap and label. */
const BEND = 7,
  GUTTER_PAD = 6;
/** Headings and row labels: bold words, or mathematics set like the cells. */
const heading = (t: Table, text: string) =>
  t.math
    ? typeset(text, "math", "md").width
    : typeset(text, "sans", "md", true).width;

/** Column widths and row positions, in figure pixels from the top left. */
export function tableGeometry(t: Table) {
  const labelWidth =
    Math.max(
      ...t.rows.map((r) => heading(t, r.label)),
      t.corner ? heading(t, t.corner) : 0,
    ) +
    2 * PAD;
  const widths = t.columns.map((c, j) =>
    Math.max(
      MIN_COLUMN,
      heading(t, c) + 2 * PAD,
      ...t.rows.map((r) => {
        const v = r.cells[j];
        return v === null || v === undefined
          ? 0
          : typeset(
              isNumber(v) ? num(v) : v,
              isNumber(v) ? "math" : "sans",
              "md",
            ).width +
              2 * PAD;
      }),
    ),
  );
  // A column with steps is followed by a gutter for its arrows and labels.
  const gutters = t.columns.map((_, j) => {
    const step = t.changes?.find((st) => st.column === j);
    if (!step) return 0;
    const widest = Math.max(
      0,
      ...step.labels.map((l) =>
        l === false ? 0 : typeset(l, "math", "sm").width,
      ),
    );
    return 4 + BEND + GUTTER_PAD + widest + 8;
  });
  const lefts = widths.map(
    (_, j) =>
      labelWidth +
      widths.slice(0, j).reduce((a, b) => a + b, 0) +
      gutters.slice(0, j).reduce((a, b) => a + b, 0),
  );
  const top = t.title ? TITLE : 0;
  // The row rules span the label column and the first body columns up to
  // the first gutter; later columns are boxed on their own.
  const split = gutters.findIndex((g) => g > 0);
  return {
    labelWidth,
    widths,
    gutters,
    lefts,
    /** Right edge of the block joined to the row labels. */
    joined:
      split < 0 || split === t.columns.length - 1
        ? lefts.at(-1)! + widths.at(-1)!
        : lefts[split]! + widths[split]!,
    split,
    width:
      labelWidth +
      widths.reduce((a, b) => a + b, 0) +
      gutters.reduce((a, b) => a + b, 0),
    titleTop: 0,
    headerTop: top,
    rowTop: (r: number) => top + HEADER + r * ROW,
    rowHeight: ROW,
    height: top + HEADER + t.rows.length * ROW,
  };
}

registerComponent("table", {
  // One math unit is one figure pixel at full size.
  maxScale: () => 1,
  compile(t, { s }) {
    const g = tableGeometry(t);
    // Pixels, y down from the top left, to math units, y up.
    const P = (x: number, y: number): [number, number] => [x / s, -y / s];
    const size = (w: number, h: number): [number, number] => [w / s, h / s];
    const filled = t.sums ? completeTable(t) : null;
    const derived = new Set((t.derived ?? []).map(([r, c]) => `${r},${c}`));
    const lastRow = t.rows.length - 1,
      lastColumn = t.columns.length - 1;
    const prims: Prim[] = [];
    if (t.title) {
      const span = t.sums ? lastColumn : t.columns.length;
      const x0 = g.lefts[0]!,
        x1 = g.lefts[span - 1]! + g.widths[span - 1]!;
      prims.push(
        {
          type: "text",
          id: "title",
          at: P((x0 + x1) / 2, TITLE / 2 - 2),
          text: t.title,
          font: "sans",
          bold: true,
          align: [0, 0],
        },
        {
          type: "segment",
          id: "title.rule",
          from: P(x0 + 6, TITLE - 4),
          to: P(x1 - 6, TITLE - 4),
          stroke: "axis",
          width: 1.5,
        },
      );
    }
    const words = !t.math;
    if (t.corner)
      prims.push({
        type: "text",
        id: "corner",
        at: P(PAD, g.headerTop + HEADER / 2 + 2),
        text: t.corner,
        font: words ? "sans" : "math",
        bold: words || undefined,
        align: [-1, 0],
      });
    for (const [j, c] of t.columns.entries())
      prims.push({
        type: "text",
        id: `column.${j}`,
        at: P(g.lefts[j]! + g.widths[j]! / 2, g.headerTop + HEADER / 2 + 2),
        text: c,
        font: words ? "sans" : "math",
        bold: words || undefined,
        align: [0, 0],
      });
    // Tints sit under the rules and entries.
    const tint = (
      { accent: "accent-fill", warm: "warm-fill", gold: "gold-fill" } as const
    )[t.highlight?.color ?? "accent"];
    for (const r of t.highlight?.rows ?? [])
      if (r < t.rows.length)
        prims.push({
          type: "rect",
          id: `highlight.row.${r}`,
          at: P(0, g.rowTop(r) + ROW),
          size: size(g.joined, ROW),
          fill: tint,
          data: { highlight: "row", row: r },
        });
    for (const c of t.highlight?.columns ?? [])
      if (c < t.columns.length)
        prims.push({
          type: "rect",
          id: `highlight.column.${c}`,
          at: P(g.lefts[c]!, g.height),
          size: size(g.widths[c]!, t.rows.length * ROW),
          fill: tint,
          data: { highlight: "column", column: c },
        });
    for (const [i, row] of t.rows.entries()) {
      const top = g.rowTop(i),
        total = t.sums && i === lastRow;
      const tinted = t.highlight?.rows?.includes(i);
      prims.push(
        {
          type: "rect",
          id: `row.${i}`,
          at: P(0, top + ROW),
          size: size(g.joined, ROW),
          fill: total ? "empty" : tinted ? "none" : "paper",
          stroke: "grid",
          width: 1,
        },
        {
          type: "text",
          id: `row.${i}.label`,
          at: P(PAD, top + ROW / 2),
          text: row.label,
          font: words ? "sans" : "math",
          bold: words || undefined,
          align: [-1, 0],
        },
      );
      for (let j = g.split + 1; g.split >= 0 && j < t.columns.length; j++)
        prims.push({
          type: "rect",
          id: `row.${i}.box.${j}`,
          at: P(g.lefts[j]!, top + ROW),
          size: size(g.widths[j]!, ROW),
          fill: tinted || t.highlight?.columns?.includes(j) ? "none" : "paper",
          stroke: "grid",
          width: 1,
        });
      for (const [j, v] of row.cells.entries()) {
        const cx = g.lefts[j]! + g.widths[j]! / 2,
          cy = top + ROW / 2;
        const bold = t.sums && (i === lastRow || j === lastColumn);
        const find = derived.has(`${i},${j}`);
        if (v === null) {
          const box = Math.min(52, g.widths[j]! - 12);
          prims.push({
            type: "rect",
            id: `cell.${i}.${j}.box`,
            at: P(cx - box / 2, cy + ROW / 2 - 6),
            size: size(box, ROW - 12),
            radius: 5,
            fill: "none",
            stroke: find ? "warm" : "axis",
            width: find ? 2.25 : 1.25,
            dash: find ? undefined : "dash",
          });
          if (find)
            prims.push({
              type: "text",
              id: `cell.${i}.${j}`,
              at: P(cx, cy),
              text: num(filled?.[i]?.[j] ?? 0),
              font: "math",
              color: "warm",
              bold: true,
              derived: true,
              align: [0, 0],
              data: { cell: `${i}-${j}` },
            });
          continue;
        }
        prims.push({
          type: "text",
          id: `cell.${i}.${j}`,
          at: P(cx, cy),
          text: isNumber(v) ? num(v) : v,
          font: isNumber(v) ? "math" : "sans",
          bold,
          align: [0, 0],
          data: { cell: `${i}-${j}` },
        });
      }
    }
    for (const step of t.changes ?? []) {
      const x = g.lefts[step.column]! + g.widths[step.column]! + 4;
      for (const [i, l] of step.labels.entries()) {
        const from = g.rowTop(i) + ROW / 2 + 5,
          to = g.rowTop(i + 1) + ROW / 2 - 5;
        prims.push({
          type: "arrow",
          id: `change.${step.column}.${i}`,
          from: P(x, from),
          to: P(x, to),
          bend: BEND,
          stroke: step.color ?? "accent",
          width: 1.75,
          data: { step: i, column: step.column },
        });
        if (l !== false)
          prims.push({
            type: "text",
            id: `change.${step.column}.${i}.label`,
            at: P(x + BEND + GUTTER_PAD, (from + to) / 2),
            text: l,
            size: "sm",
            color: step.color ?? "accent",
            align: [-1, 0],
          });
      }
    }
    if (t.sums) {
      const x = g.lefts[lastColumn]!;
      prims.push(
        {
          type: "segment",
          id: "sums.column",
          from: P(x, g.rowTop(0)),
          to: P(x, g.height),
          stroke: "ink",
          width: 1.5,
        },
        {
          type: "segment",
          id: "sums.row",
          from: P(0, g.rowTop(lastRow)),
          to: P(g.width, g.rowTop(lastRow)),
          stroke: "ink",
          width: 1.5,
        },
      );
    }
    return prims;
  },
  describe(t, reveal) {
    const filled = t.sums ? completeTable(t) : null;
    const derived = new Set((t.derived ?? []).map(([r, c]) => `${r},${c}`));
    const cell = (v: number | string | null, i: number, j: number) =>
      v !== null
        ? isNumber(v)
          ? num(v)
          : v
        : derived.has(`${i},${j}`)
          ? reveal && filled
            ? num(filled[i]![j]!)
            : "the number to find"
          : "blank";
    const steps = (t.changes ?? []).map(
      (st) =>
        ` Down the ${t.columns[st.column]} column, each step is ${st.labels
          .map((l) => (l === false ? "unmarked" : l))
          .join(", then ")}.`,
    );
    const tinted = (t.highlight?.rows ?? []).map(
      (r) => ` The ${t.rows[r]?.label} row is highlighted.`,
    );
    return `Table${t.title ? ` headed “${t.title}”` : ""} with ${t.corner ? `${t.corner} down the side and ` : ""}columns ${t.columns.join(", ")}. ${t.rows
      .map(
        (r, i) =>
          `${r.label}: ${r.cells.map((v, j) => cell(v, i, j)).join(", ")}.`,
      )
      .join(" ")}${steps.join("")}${tinted.join("")}`;
  },
});
