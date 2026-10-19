import { z } from "zod";
import { base, label, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";

/** A table of values or of steps. Cells are labels; a derived cell is a
 * value the learner finds, drawn as "?" until revealed. */
const lineTableCell = z.union([
  z.string().max(60),
  z
    .object({
      text: label,
      derived: z.boolean().optional(),
      color: z.enum(["accent", "warm", "gold"]).optional(),
    })
    .strict(),
]);
export const lineTableSchema = z
  .object({
    ...base,
    type: z.literal("lineTable"),
    rows: z.array(z.array(lineTableCell).min(1).max(10)).min(1).max(10),
    /** Which edge holds the headings: the first column (a function table
     * read across), the first row, or neither. */
    header: z.enum(["column", "row", "none"]).optional(),
    /** Ruling: every cell boxed, or rules between rows only (steps). */
    rules: z.enum(["grid", "rows"]).optional(),
    /** Columns to shade, as in the two ends of an interval. */
    highlight: z.array(small.max(9)).max(10).optional(),
    /** A heavy rule above this row: the sum line of stacked equations. */
    total: small.max(9).optional(),
    /** Horizontal alignment per column. */
    align: z
      .array(z.enum(["left", "center", "right"]))
      .max(10)
      .optional(),
  })
  .strict()
  .refine(
    (t) => t.rows.every((r) => r.length === t.rows[0]!.length),
    "Every row has the same number of cells",
  );

export type LineTable = z.infer<typeof lineTableSchema>;

/** A table read along its lines: a function's values across, or an
 * equation's steps down with their reasons. (The `table` component is the
 * two-way data table with headings and sums.)
 *
 * Cell sizes are figure pixels; the component converts them to math units
 * at the current scale, so a table reads the same beside any graph. */
const PAD = 10,
  MIN_W = 38,
  ROW_H = 36,
  /** Extra height of a row whose words wrap onto a second line. */
  LINE = 19,
  /** Words wider than this wrap at the space nearest their middle. */
  WRAP = 150;
type Table = LineTable;
type Cell = Table["rows"][number][number];
const text = (c: Cell) => (typeof c === "string" ? c : c.text);
const derived = (c: Cell) => typeof c !== "string" && !!c.derived;
/** Words set in the UI sans; numbers, variables and equations in math.
 * A word is a capitalized word ("Given", "Year") or four or more lowercase
 * letters; products of variables such as bh or Prt stay math. */
export const lineCellFont = (t: string): "math" | "sans" =>
  /[a-z]{4,}|[A-Z][a-z]{2,}/.test(t) ? "sans" : "math";
const isHead = (t: Table, r: number, c: number) =>
  (t.header ?? "column") === "column"
    ? c === 0
    : t.header === "row"
      ? r === 0
      : false;
/** Words in a body cell (a step's reason) are set a size smaller. */
const size = (t: string, head: boolean) =>
  !head && lineCellFont(t) === "sans" ? ("sm" as const) : ("md" as const);
/** The lines a cell is set on: one, or two for long words. */
function lines(t: string, head: boolean) {
  const w = typeset(t, lineCellFont(t), size(t, head), head).width;
  if (lineCellFont(t) === "math" || w <= WRAP || !t.includes(" ")) return [t];
  const spaces = [...t.matchAll(/ /g)].map((m) => m.index!);
  const mid = t.length / 2;
  const at = spaces.reduce((a, b) =>
    Math.abs(b - mid) < Math.abs(a - mid) ? b : a,
  );
  return [t.slice(0, at), t.slice(at + 1)];
}

registerComponent("lineTable", {
  compile(t, { s }) {
    const cols = t.rows[0]!.length;
    const set = t.rows.map((row, r) =>
      row.map((cell, c) => {
        const v = text(cell),
          head = isHead(t, r, c);
        const parts = v ? lines(v, head) : [];
        const width = Math.max(
          0,
          ...parts.map(
            (part) => typeset(part, lineCellFont(v), size(v, head), head).width,
          ),
        );
        return { v, head, parts, width };
      }),
    );
    const widths = Array.from({ length: cols }, (_, c) =>
      Math.max(MIN_W, ...set.map((row) => row[c]!.width + 2 * PAD)),
    );
    const heights = set.map((row) =>
      Math.max(
        ...row.map((cell) => (cell.parts.length > 1 ? ROW_H + LINE : ROW_H)),
      ),
    );
    const tops = heights.map(
      (_, r) => -heights.slice(0, r).reduce((a, b) => a + b, 0),
    );
    const bottom = -heights.reduce((a, b) => a + b, 0);
    const u = (px: number) => px / s;
    const prims: Prim[] = [];
    const left = widths.map((_, c) =>
      widths.slice(0, c).reduce((a, b) => a + b, 0),
    );
    const total = left.at(-1)! + widths.at(-1)!;
    const grid = (t.rules ?? "grid") === "grid";
    const hl = new Set(t.highlight ?? []);
    for (const [r, row] of t.rows.entries()) {
      const top = tops[r]!,
        h = heights[r]!;
      for (const [c, cell] of row.entries()) {
        const { v, head, parts } = set[r]![c]!;
        const color = typeof cell === "string" ? undefined : cell.color;
        const fill = color
          ? (`${color}-fill` as const)
          : hl.has(c) && !head
            ? "gold-fill"
            : head
              ? "empty"
              : grid
                ? "paper"
                : "none";
        if (grid || fill !== "none")
          prims.push({
            type: "rect",
            id: `cell.${r}.${c}`,
            at: [u(left[c]!), u(top - h)],
            size: [u(widths[c]!), u(h)],
            fill,
            ...(grid ? { stroke: "axis" as const, width: 1 } : {}),
            data: { cell: `${r},${c}` },
          });
        const align = t.align?.[c] ?? "center";
        const x =
          align === "left"
            ? left[c]! + PAD
            : align === "right"
              ? left[c]! + widths[c]! - PAD
              : left[c]! + widths[c]! / 2;
        const shift = (i: number) =>
          parts.length > 1 ? (i ? -LINE / 2 : LINE / 2) : 0;
        for (const [i, part] of parts.entries())
          prims.push({
            type: "text",
            id: parts.length > 1 ? `text.${r}.${c}.${i}` : `text.${r}.${c}`,
            at: [u(x), u(top - h / 2 + shift(i))],
            text: part,
            font: lineCellFont(v),
            size: size(v, head),
            bold: head || undefined,
            align: [align === "left" ? -1 : align === "right" ? 1 : 0, 0],
            derived: derived(cell) || undefined,
            color: color ?? "ink",
            data: { cell: `${r},${c}` },
          });
      }
      if (!grid && r > 0)
        prims.push({
          type: "segment",
          id: `rule.${r}`,
          from: [0, u(top)],
          to: [u(total), u(top)],
          stroke: "grid",
          width: 1,
        });
    }
    if (t.total !== undefined) {
      const y = u(tops[t.total] ?? bottom);
      prims.push({
        type: "segment",
        id: "total",
        from: [0, y],
        to: [u(total), y],
        stroke: "ink",
        width: 2,
      });
    }
    return prims;
  },
  describe(t, reveal) {
    const say = (c: Cell) =>
      derived(c) && !reveal ? "a value to find" : text(c);
    const rows = t.rows.map((row) =>
      (t.header ?? "column") === "column"
        ? `${say(row[0]!)}: ${row.slice(1).map(say).join(", ")}`
        : row
            .filter((c) => text(c))
            .map(say)
            .join(", "),
    );
    return `A table. ${rows.join("; ")}.`;
  },
});
