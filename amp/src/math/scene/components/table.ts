import { registerComponent, type Prim } from "../layout";
import type { InkRole, Table, TableCell } from "../spec";
import { typeset } from "../type";

/** Table geometry is in figure pixels (one math unit is one pixel), so cell
 * sizes follow the type and never squeeze it. */
const ROW = 36,
  PAD = 14,
  GUTTER_PAD = 10,
  BEND = 14;

const cellOf = (
  c: TableCell,
  font: "math" | "sans",
  bold = false,
): { text: string; font: "math" | "sans"; bold: boolean; color?: InkRole } =>
  // Headers are bold in sans; math keeps its own weight.
  typeof c === "string"
    ? { text: c, font, bold: bold && font === "sans" }
    : {
        text: c.text,
        font: c.font ?? font,
        bold: c.bold ?? (bold && (c.font ?? font) === "sans"),
        color: c.color,
      };
export const cellText = (c: TableCell) => (typeof c === "string" ? c : c.text);

/** Column widths, step gutters and the x of each column's left edge. */
export function tableGeometry(t: Table) {
  const headerFont = t.headerFont ?? "sans";
  const widths = t.header.map((h, j) => {
    const all = [
      cellOf(h, headerFont, true),
      ...t.rows.map((r) =>
        cellOf(r[j]!, t.rowHeaders && j === 0 ? "sans" : "math"),
      ),
    ];
    return (
      Math.max(
        ...all.map((c) => typeset(c.text, c.font, "md", c.bold).width),
        24,
      ) +
      2 * PAD
    );
  });
  const gutters = t.header.map((_, j) => {
    const step = t.steps?.find((s) => s.column === j);
    if (!step) return 0;
    const widest = Math.max(
      0,
      ...step.labels.map((l) =>
        l === false ? 0 : typeset(l, "math", "sm").width,
      ),
    );
    return BEND + GUTTER_PAD + widest + 6;
  });
  const left: number[] = [];
  let x = 0;
  for (const [j, w] of widths.entries()) {
    left.push(x);
    x += w + gutters[j]!;
  }
  return { widths, gutters, left, right: x };
}

registerComponent("table", {
  // One unit is one pixel: never enlarge a table past its type size.
  maxScale: () => 1,
  compile(t) {
    const prims: Prim[] = [];
    const { widths, left } = tableGeometry(t);
    const headerFont = t.headerFont ?? "sans";
    const rows = [t.header, ...t.rows];
    const top = 0,
      y = (i: number) => top - (i + 1) * ROW; // bottom of row i (0 = header)
    const tint = t.highlight?.color ?? "accent";
    const fillOf = { accent: "accent-fill", warm: "warm-fill", gold: "gold-fill" } as const;
    // Header band, then highlighted rows and columns, under the rules.
    for (const [j, w] of widths.entries())
      prims.push({
        type: "rect",
        id: `header.${j}`,
        at: [left[j]!, y(0)],
        size: [w, ROW],
        fill: "empty",
      });
    for (const r of t.highlight?.rows ?? [])
      if (r < t.rows.length)
        for (const [j, w] of widths.entries())
          prims.push({
            type: "rect",
            id: `highlight.row.${r}.${j}`,
            at: [left[j]!, y(r + 1)],
            size: [w, ROW],
            fill: fillOf[tint],
            data: { highlight: "row", row: r },
          });
    for (const c of t.highlight?.columns ?? [])
      if (c < widths.length)
        prims.push({
          type: "rect",
          id: `highlight.column.${c}`,
          at: [left[c]!, y(t.rows.length)],
          size: [widths[c]!, ROW * t.rows.length],
          fill: fillOf[tint],
          data: { highlight: "column", column: c },
        });
    // Rules: each column is its own boxed strip, so step gutters sit outside.
    for (const [j, w] of widths.entries()) {
      prims.push({
        type: "rect",
        id: `column.${j}`,
        at: [left[j]!, y(t.rows.length)],
        size: [w, ROW * rows.length],
        fill: "none",
        stroke: "ink",
        width: 1.5,
      });
      for (let i = 1; i <= t.rows.length; i++)
        prims.push({
          type: "segment",
          id: `rule.${i}.${j}`,
          from: [left[j]!, y(i - 1)],
          to: [left[j]! + w, y(i - 1)],
          stroke: i === 1 ? "ink" : "grid",
          width: i === 1 ? 1.5 : 1,
        });
    }
    for (const [i, row] of rows.entries())
      for (const [j, raw] of row.entries()) {
        const c =
          i === 0
            ? cellOf(raw, headerFont, true)
            : cellOf(raw, t.rowHeaders && j === 0 ? "sans" : "math");
        prims.push({
          type: "text",
          id: i === 0 ? `head.${j}` : `cell.${i - 1}.${j}`,
          at: [left[j]! + widths[j]! / 2, y(i) + ROW / 2],
          text: c.text,
          font: c.font,
          bold: c.bold || undefined,
          color: c.color,
          size: "md",
          data: i === 0 ? { column: j } : { row: i - 1, column: j },
        });
      }
    for (const step of t.steps ?? []) {
      const x = left[step.column]! + widths[step.column]! + 4;
      for (const [i, l] of step.labels.entries()) {
        const from = y(i + 1) + ROW / 2 - 5,
          to = y(i + 2) + ROW / 2 + 5;
        prims.push({
          type: "arrow",
          id: `step.${step.column}.${i}`,
          from: [x, from],
          to: [x, to],
          bend: BEND / 2,
          stroke: step.color ?? "accent",
          width: 1.75,
          data: { step: i, column: step.column },
        });
        if (l !== false)
          prims.push({
            type: "text",
            id: `step.${step.column}.${i}.label`,
            at: [x + BEND / 2 + GUTTER_PAD - 4, (from + to) / 2],
            text: l,
            size: "sm",
            color: step.color ?? "accent",
            align: [-1, 0],
          });
      }
    }
    return prims;
  },
  describe(t) {
    const head = t.header.map(cellText);
    const rows = t.rows.map(
      (r) =>
        r
          .map((c, j) => `${head[j]} ${cellText(c).replace("?", "unknown")}`)
          .join(", ") + ".",
    );
    const steps = (t.steps ?? []).map(
      (s) =>
        `Down the ${head[s.column]} column, each step is ${s.labels
          .map((l) => (l === false ? "unmarked" : l))
          .join(", then ")}.`,
    );
    const highlighted = (t.highlight?.rows ?? []).map(
      (r) => `The ${cellText(t.rows[r]![0]!)} row is highlighted.`,
    );
    return [
      `A table with columns ${head.join(", ")}.`,
      ...rows,
      ...steps,
      ...highlighted,
    ].join(" ");
  },
});
