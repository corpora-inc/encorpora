import { registerComponent, type Prim } from "../layout";
import { completeTable, type Table } from "../spec";
import { typeset } from "../type";
import { num } from "./format";

/** Table geometry in figure pixels; compile divides by the scale. */
const PAD = 12,
  ROW = 36,
  HEADER = 34,
  TITLE = 30,
  MIN_COLUMN = 56;
const isNumber = (v: unknown): v is number => typeof v === "number";

/** Column widths and row positions, in figure pixels from the top left. */
export function tableGeometry(t: Table) {
  const labelWidth =
    Math.max(...t.rows.map((r) => typeset(r.label, "sans", "md", true).width)) +
    2 * PAD;
  const widths = t.columns.map((c, j) =>
    Math.max(
      MIN_COLUMN,
      typeset(c, "sans", "md", true).width + 2 * PAD,
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
  const lefts = widths.map(
    (_, j) => labelWidth + widths.slice(0, j).reduce((a, b) => a + b, 0),
  );
  const top = t.title ? TITLE : 0;
  return {
    labelWidth,
    widths,
    lefts,
    width: labelWidth + widths.reduce((a, b) => a + b, 0),
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
    for (const [j, c] of t.columns.entries())
      prims.push({
        type: "text",
        id: `column.${j}`,
        at: P(g.lefts[j]! + g.widths[j]! / 2, g.headerTop + HEADER / 2 + 2),
        text: c,
        font: "sans",
        bold: true,
        align: [0, 0],
      });
    for (const [i, row] of t.rows.entries()) {
      const top = g.rowTop(i),
        total = t.sums && i === lastRow;
      prims.push(
        {
          type: "rect",
          id: `row.${i}`,
          at: P(0, top + ROW),
          size: size(g.width, ROW),
          fill: total ? "empty" : "paper",
          stroke: "grid",
          width: 1,
        },
        {
          type: "text",
          id: `row.${i}.label`,
          at: P(PAD, top + ROW / 2),
          text: row.label,
          font: "sans",
          bold: true,
          align: [-1, 0],
        },
      );
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
    return `Table${t.title ? ` headed “${t.title}”` : ""} with columns ${t.columns.join(", ")}. ${t.rows
      .map(
        (r, i) =>
          `${r.label}: ${r.cells.map((v, j) => cell(v, i, j)).join(", ")}.`,
      )
      .join(" ")}`;
  },
});
