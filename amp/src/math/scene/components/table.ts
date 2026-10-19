import { registerComponent, type Prim } from "../layout";
import type { Table } from "../spec";
import { typeset } from "../type";

/** Numbers, fractions and decimals are set as math; words in the UI sans. */
const isMath = (text: string) => /^[−-]?[\d.,/ ]+%?$/.test(text);
const ROW = 40,
  PAD = 12,
  MIN = 44;
/** Words are set a step smaller than numbers so a four-column table fits a phone. */
const sizeOf = (text: string) => (isMath(text) ? "md" : "sm");

/** Column widths and row heights in figure pixels. A table's size is set by
 * its type, not by the fit, so its math units are pixels divided by the scale. */
export function tableGrid(c: Table) {
  const width = (text: string, bold = false) =>
    typeset(text, isMath(text) ? "math" : "sans", sizeOf(text), bold).width;
  const head = Math.max(
    MIN,
    ...c.rows.map((r) => width(r.label, true)),
    c.corner ? width(c.corner) : 0,
  );
  const cols = c.columns.map((name, j) =>
    Math.max(
      MIN,
      width(name, true),
      ...c.rows.map((r) => width(r.cells[j] ?? "?", !!r.total)),
    ),
  );
  return { widths: [head, ...cols].map((w) => w + 2 * PAD), row: ROW };
}

registerComponent("table", {
  compile(c, { s }) {
    const { widths, row } = tableGrid(c);
    const u = (px: number) => px / s;
    const xs = widths.reduce<number[]>((a, w) => [...a, a.at(-1)! + u(w)], [0]);
    const n = c.rows.length + 1,
      H = u(row) * n;
    const top = (i: number) => H - u(row) * i;
    const prims: Prim[] = [];
    const lit = new Set(
      (c.highlight?.cells ?? []).map(([r, k]) => `${r}.${k}`),
    );
    const rows = new Set(c.highlight?.rows ?? []),
      columns = new Set(c.highlight?.columns ?? []);
    // Header band, then highlight bands under the rules and text.
    prims.push({
      type: "rect",
      id: "head",
      at: [0, top(1)],
      size: [xs.at(-1)!, u(row)],
      fill: "empty",
      noStroke: true,
    });
    for (const r of rows)
      prims.push({
        type: "rect",
        id: `band.row.${r}`,
        at: [0, top(r + 2)],
        size: [xs.at(-1)!, u(row)],
        fill: "accent-fill",
        noStroke: true,
      });
    for (const k of columns)
      prims.push({
        type: "rect",
        id: `band.column.${k}`,
        at: [xs[k + 1]!, 0],
        size: [u(widths[k + 1]!), H],
        fill: "warm-fill",
        noStroke: true,
        opacity: rows.size ? 0.7 : 1,
      });
    for (const key of lit) {
      const [r, k] = key.split(".").map(Number) as [number, number];
      prims.push({
        type: "rect",
        id: `mark.${r}.${k}`,
        at: [xs[k + 1]! + u(3), top(r + 2) + u(3)],
        size: [u(widths[k + 1]! - 6), u(row - 6)],
        fill: "none",
        stroke: "gold",
        width: 3,
        radius: 6,
      });
    }
    // Rules: an outer frame, a heavier rule under the header and beside the
    // row labels, and one before a totals row or column.
    prims.push({
      type: "rect",
      id: "frame",
      at: [0, 0],
      size: [xs.at(-1)!, H],
      fill: "none",
      stroke: "ink",
      width: 1.5,
    });
    for (let i = 2; i < n; i++)
      prims.push({
        type: "segment",
        id: `rule.row.${i}`,
        from: [0, top(i)],
        to: [xs.at(-1)!, top(i)],
        stroke: c.rows[i - 1]!.total ? "ink" : "grid",
        width: c.rows[i - 1]!.total ? 1.5 : 1,
      });
    prims.push({
      type: "segment",
      id: "rule.head",
      from: [0, top(1)],
      to: [xs.at(-1)!, top(1)],
      stroke: "ink",
      width: 2,
    });
    for (let k = 1; k < xs.length - 1; k++) {
      const strong = k === 1 || (c.totalColumn && k === xs.length - 2);
      prims.push({
        type: "segment",
        id: `rule.column.${k}`,
        from: [xs[k]!, 0],
        to: [xs[k]!, H],
        stroke: strong ? "ink" : "grid",
        width: k === 1 ? 2 : strong ? 1.5 : 1,
      });
    }
    const text = (
      id: string,
      x: number,
      i: number,
      value: string | null,
      options: { bold?: boolean; left?: boolean; muted?: boolean } = {},
    ): Prim => ({
      type: "text",
      id,
      at: [x, top(i) - u(row) / 2],
      text: value ?? "?",
      derived: value === null,
      font: value !== null && isMath(value) ? "math" : "sans",
      size: value === null ? "md" : sizeOf(value),
      bold: options.bold,
      color: options.muted ? "muted" : "ink",
      align: [options.left ? -1 : 0, 0],
      offset: [options.left ? PAD : 0, 0],
    });
    if (c.corner)
      prims.push(text("corner", 0, 0, c.corner, { left: true, muted: true }));
    for (const [k, name] of c.columns.entries())
      prims.push(
        text(`column.${k}.name`, (xs[k + 1]! + xs[k + 2]!) / 2, 0, name, {
          bold: true,
        }),
      );
    for (const [r, line] of c.rows.entries()) {
      prims.push(
        text(`row.${r}.name`, 0, r + 1, line.label, { bold: true, left: true }),
      );
      for (const [k, v] of line.cells.entries())
        prims.push({
          ...text(`cell.${r}.${k}`, (xs[k + 1]! + xs[k + 2]!) / 2, r + 1, v, {
            bold:
              !!line.total || (!!c.totalColumn && k === c.columns.length - 1),
          }),
          data: { cell: `${r}.${k}` },
        });
    }
    return prims;
  },
  describe(c) {
    const v = (x: string | null) => (x === null ? "unknown" : x);
    const lines = c.rows.map(
      (r) =>
        `${r.label}: ${r.cells.map((x, k) => `${c.columns[k]} ${v(x)}`).join(", ")}`,
    );
    const lit = [
      ...(c.highlight?.rows ?? []).map((r) => `the ${c.rows[r]!.label} row`),
      ...(c.highlight?.columns ?? []).map((k) => `the ${c.columns[k]!} column`),
    ];
    return [
      `A table with columns ${c.columns.join(", ")} and rows ${c.rows.map((r) => r.label).join(", ")}.`,
      `${lines.join(". ")}.`,
      lit.length ? `Highlighted: ${lit.join(" and ")}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  },
});
