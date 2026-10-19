import { registerComponent, type Prim } from "../layout";
import type { FillRole, Point } from "../spec";
import { num, spoken } from "./format";

const regionFills: FillRole[] = [
  "accent-fill",
  "warm-fill",
  "gold-fill",
  "accent-strong",
];
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** Part sizes along one side: true lengths, or square-root-compressed with a
 * floor so a small part still holds its label. */
function sides(
  across: number[],
  down: number[],
  mode: "proportional" | "schematic",
) {
  if (mode === "proportional") return { across, down };
  const squash = (v: number[], total: number) => {
    const roots = v.map(Math.sqrt),
      t = sum(roots);
    const floor = v.length > 1 ? 0.2 : 1;
    const shares = roots.map((r) => Math.max(floor, r / t));
    const st = sum(shares);
    return shares.map((x) => (x / st) * total);
  };
  const ratio = Math.sqrt(sum(down) / sum(across));
  return {
    across: squash(across, 10),
    down: squash(down, Math.min(10, Math.max(3.6, 10 * ratio))),
  };
}
export function areaScale(c: {
  across: number[];
  down: number[];
  scale?: string;
}) {
  if (c.scale === "proportional" || c.scale === "schematic") return c.scale;
  const A = sum(c.across),
    D = sum(c.down);
  const ok =
    Math.max(A, D) / Math.min(A, D) <= 6 &&
    c.across.every((v) => v / A >= 0.08) &&
    c.down.every((v) => v / D >= 0.08);
  return ok ? "proportional" : "schematic";
}

registerComponent("areaModel", {
  maxScale: (c) =>
    areaScale(c) === "proportional"
      ? 300 / Math.max(sum(c.across), sum(c.down))
      : 30,
  compile(c, { s }) {
    const mode = areaScale(c);
    const { across, down } = sides(c.across, c.down, mode);
    const W = sum(across),
      H = sum(down);
    const prims: Prim[] = [];
    let y = H;
    for (const [j, h] of down.entries()) {
      let x = 0;
      y -= h;
      for (const [i, w] of across.entries()) {
        prims.push({
          type: "rect",
          id: `region.${i}.${j}`,
          at: [x, y],
          size: [w, h],
          fill: regionFills[(i + j) % regionFills.length]!,
          stroke: "ink",
          width: 2,
          data: { region: `${c.across[i]}x${c.down[j]}` },
        });
        x += w;
      }
    }
    if (c.unitGrid && mode === "proportional" && W <= 40 && H <= 40) {
      for (let x = 1; x < W; x++)
        prims.push({
          type: "segment",
          id: `unit.x.${x}`,
          from: [x, 0],
          to: [x, H],
          stroke: "grid",
          width: 1,
        });
      for (let v = 1; v < H; v++)
        prims.push({
          type: "segment",
          id: `unit.y.${v}`,
          from: [0, v],
          to: [W, v],
          stroke: "grid",
          width: 1,
        });
      // Partition lines stay on top of the unit grid.
      for (const p of prims.filter((q) => q.type === "rect"))
        prims.push({ ...p, id: `${p.id}.edge`, fill: "none" });
    }
    let x = 0;
    for (const [i, w] of across.entries()) {
      prims.push({
        type: "text",
        id: `across.${i}`,
        at: [x + w / 2, H],
        text: c.acrossLabels?.[i] ?? num(c.across[i]!),
        offset: [0, -8],
        align: [0, 1],
      });
      x += w;
    }
    y = H;
    for (const [j, h] of down.entries()) {
      y -= h;
      prims.push({
        type: "text",
        id: `down.${j}`,
        at: [0, y + h / 2],
        text: c.downLabels?.[j] ?? num(c.down[j]!),
        offset: [-8, 0],
        align: [1, 0],
      });
    }
    if ((c.products ?? "derived") !== "none") {
      y = H;
      for (const [j, h] of down.entries()) {
        x = 0;
        y -= h;
        for (const [i, w] of across.entries()) {
          const text = num(c.across[i]! * c.down[j]!);
          prims.push({
            type: "text",
            id: `product.${i}.${j}`,
            at: [x + w / 2, y + h / 2],
            text,
            derived: c.products !== "shown",
            bold: true,
            size: w * s < 44 ? "sm" : "md",
          });
          x += w;
        }
      }
    }
    return prims;
  },
  describe(c, reveal, hidden) {
    const A = c.acrossLabels?.join(" + ") ?? c.across.map(num).join(" + "),
      D = c.downLabels?.join(" + ") ?? c.down.map(num).join(" + ");
    const out = [
      `An area model: a rectangle ${A} across and ${D} down, split into ${c.across.length * c.down.length} regions${areaScale(c) === "schematic" ? " (not to scale)" : ""}.`,
    ];
    if (
      (c.products ?? "derived") === "shown" ||
      ((c.products ?? "derived") === "derived" && reveal)
    )
      out.push(
        `Region products: ${c.down
          .flatMap((d) =>
            c.across.map((a) => `${num(a)} × ${num(d)} = ${num(a * d)}`),
          )
          .join("; ")}.`,
      );
    else if (c.products !== "none")
      out.push("Each region's product is to be found.");
    return out.join(" ");
  },
});

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
    const unit = c.shape === "dot" ? "dots" : "unit squares";
    return `${c.rows} rows of ${c.columns} ${unit}${c.splitAfterRow ? `; region A is the top ${c.splitAfterRow} row${c.splitAfterRow > 1 ? "s" : ""} and region B is the remaining ${c.rows - c.splitAfterRow}` : ""}${c.splitAfterColumn ? `; a line splits the first ${c.splitAfterColumn} columns from the other ${c.columns - c.splitAfterColumn}` : ""}.`;
  },
});

registerComponent("tenFrame", {
  maxScale: () => 50,
  compile(c) {
    const prims: Prim[] = [];
    const slots = c.frames * 10;
    const fills: { shape: "dot" | "square"; color: string }[] =
      c.groups.flatMap((g, gi) =>
        Array.from({ length: g.count }, () => ({
          shape: g.shape ?? (gi === 0 ? "dot" : "square"),
          color: g.color ?? (["accent", "warm", "gold"][gi] as string),
        })),
      );
    for (let i = 0; i < slots; i++) {
      const frame = Math.floor(i / 10),
        within = i % 10;
      const x = within % 5,
        y = -(frame * 2.4 + Math.floor(within / 5)) - 1;
      prims.push({
        type: "rect",
        id: `slot.${i}`,
        at: [x, y],
        size: [1, 1],
        fill: "paper",
        stroke: "ink",
        width: 1.5,
        data: { slot: i },
      });
      const f = fills[i];
      if (!f) continue;
      const group = c.groups.findIndex(
        (_, gi) =>
          i < c.groups.slice(0, gi + 1).reduce((a, g) => a + g.count, 0),
      );
      prims.push(
        f.shape === "dot"
          ? {
              type: "circle",
              id: `counter.${i}`,
              center: [x + 0.5, y + 0.5],
              r: 0.3,
              fill: f.color as FillRole,
              stroke: "paper",
              width: 1,
              data: { counter: group === 0 ? "first" : "second" },
            }
          : {
              type: "rect",
              id: `counter.${i}`,
              at: [x + 0.24, y + 0.24],
              size: [0.52, 0.52],
              radius: 2,
              fill: f.color as FillRole,
              data: { counter: group === 0 ? "first" : "second" },
            },
      );
    }
    return prims;
  },
  describe(c) {
    const kinds = c.groups.map(
      (g, gi) =>
        `${g.count} ${(g.shape ?? (gi === 0 ? "dot" : "square")) === "dot" ? "round" : "square"} counter${g.count === 1 ? "" : "s"}`,
    );
    return `${c.frames === 1 ? "One ten-frame" : "Two ten-frames"}, each with ten places. ${kinds.join(" and ") || "No counters"}. Other places are empty.`;
  },
});

registerComponent("baseTen", {
  maxScale: (c) => (c.hundreds ? 8 : 12),
  compile(c) {
    const prims: Prim[] = [];
    const cols: { key: string; label: string; n: number; w: number }[] = [];
    if (c.hundreds)
      cols.push({
        key: "hundred",
        label: "Hundreds",
        n: c.hundreds,
        w: Math.min(3, c.hundreds) * 10.6 - 0.6,
      });
    cols.push({
      key: "ten",
      label: "Tens",
      n: c.tens,
      w: Math.max(1, Math.min(10, c.tens) * 1.5 - 0.5),
    });
    cols.push({
      key: "one",
      label: "Ones",
      n: c.ones,
      w: Math.max(1, Math.min(5, c.ones) * 1.5 - 0.5),
    });
    let x = 0;
    for (const col of cols) {
      if (c.labels !== false)
        prims.push({
          type: "text",
          id: `${col.key}.label`,
          at: [x + col.w / 2, 0],
          text: col.label,
          font: "sans",
          size: "sm",
          color: "muted",
          bold: true,
          offset: [0, -8],
          align: [0, 1],
        });
      for (let i = 0; i < col.n; i++) {
        if (col.key === "hundred") {
          const bx = x + (i % 3) * 10.6,
            by = -10 - Math.floor(i / 3) * 10.6;
          prims.push({
            type: "rect",
            id: `hundred.${i}`,
            at: [bx, by],
            size: [10, 10],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "hundred" },
          });
          for (let j = 1; j < 10; j++) {
            prims.push({
              type: "segment",
              id: `hundred.${i}.v${j}`,
              from: [bx + j, by],
              to: [bx + j, by + 10],
              stroke: "accent",
              width: 0.75,
            });
            prims.push({
              type: "segment",
              id: `hundred.${i}.h${j}`,
              from: [bx, by + j],
              to: [bx + 10, by + j],
              stroke: "accent",
              width: 0.75,
            });
          }
        } else if (col.key === "ten") {
          const bx = x + (i % 10) * 1.5,
            by = -10 - Math.floor(i / 10) * 10.8;
          prims.push({
            type: "rect",
            id: `ten.${i}`,
            at: [bx, by],
            size: [1, 10],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "ten" },
          });
          for (let j = 1; j < 10; j++)
            prims.push({
              type: "segment",
              id: `ten.${i}.h${j}`,
              from: [bx, by + j],
              to: [bx + 1, by + j],
              stroke: "accent",
              width: 0.75,
            });
        } else {
          const bx = x + (i % 5) * 1.5,
            by = -1 - Math.floor(i / 5) * 1.5;
          prims.push({
            type: "rect",
            id: `one.${i}`,
            at: [bx, by],
            size: [1, 1],
            fill: "accent-fill",
            stroke: "accent",
            width: 1.5,
            radius: 2,
            data: { unit: "one" },
          });
        }
      }
      x += col.w + 3;
    }
    return prims;
  },
  describe(c) {
    return `Base-ten model: ${c.hundreds} hundred flat${c.hundreds === 1 ? "" : "s"}, ${c.tens} ten rod${c.tens === 1 ? "" : "s"}, and ${c.ones} one cube${c.ones === 1 ? "" : "s"}. A hundred flat has ten rows of ten units; a rod has ten units.`;
  },
});

registerComponent("fractionBar", {
  maxScale: () => 34,
  compile(c) {
    const prims: Prim[] = [];
    const L = 10,
      H = 1.4,
      gap = 0.8;
    // One whole has the same length in every bar, so bars compare directly.
    const wholeW = L / Math.max(...c.bars.map((b) => b.wholes ?? 1));
    for (const [i, b] of c.bars.entries()) {
      const y = -(i + 1) * H - i * gap;
      const wholes = b.wholes ?? 1;
      for (let w = 0; w < wholes; w++)
        for (let p = 0; p < b.parts; p++) {
          const index = w * b.parts + p;
          prims.push({
            type: "rect",
            id: `bar.${i}.part.${index}`,
            at: [w * (wholeW + 0.3) + (p * wholeW) / b.parts, y],
            size: [wholeW / b.parts, H],
            fill: index < b.shaded ? (b.color ?? "accent") : "empty",
            // Cuts between shaded parts show in paper; the whole keeps an ink outline.
            stroke: index < b.shaded ? "paper" : "ink",
            width: 1.5,
            data: { part: index, shaded: index < b.shaded ? 1 : 0 },
          });
        }
      for (let w = 0; w < wholes; w++)
        prims.push({
          type: "rect",
          id: `bar.${i}.whole.${w}`,
          at: [w * (wholeW + 0.3), y],
          size: [wholeW, H],
          fill: "none",
          stroke: "ink",
          width: 2,
        });
      if (b.label !== false) {
        const right = wholes * wholeW + (wholes - 1) * 0.3;
        prims.push({
          type: "text",
          id: `bar.${i}.label`,
          at: [right, y + H / 2],
          text: b.label ?? `${b.shaded}/${b.parts}`,
          derived: b.derivedLabel,
          size: "lg",
          offset: [12, 0],
          align: [-1, 0],
        });
      }
    }
    return prims;
  },
  describe(c, reveal) {
    return c.bars
      .map((b, i) => {
        const whole =
          (b.wholes ?? 1) > 1 ? `${b.wholes} wholes, each` : "A whole";
        const label =
          b.label === false
            ? ""
            : b.derivedLabel && !reveal
              ? " Its fraction is to be found."
              : ` Labeled ${b.label ?? `${b.shaded}/${b.parts}`}.`;
        return `${c.bars.length > 1 ? `Bar ${i + 1}: ` : ""}${whole} cut into ${b.parts} equal parts, ${b.shaded} shaded.${label}`;
      })
      .join(" ");
  },
});

registerComponent("clock", {
  maxScale: () => 112,
  compile(c) {
    const prims: Prim[] = [];
    const at = (deg: number, r: number): Point => {
      const t = (deg * Math.PI) / 180;
      return [Math.sin(t) * r, Math.cos(t) * r];
    };
    prims.push({
      type: "circle",
      id: "face",
      center: [0, 0],
      r: 1,
      fill: "empty",
      stroke: "ink",
      width: 3,
    });
    for (let m = 0; m < 60; m++)
      prims.push({
        type: "segment",
        id: `tick.${m}`,
        from: at(m * 6, m % 5 ? 0.93 : 0.89),
        to: at(m * 6, 0.98),
        stroke: "ink",
        width: m % 5 ? 1 : 2,
      });
    if (c.numbers !== false)
      for (let n = 1; n <= 12; n++)
        prims.push({
          type: "text",
          id: `number.${n}`,
          at: at(n * 30, 0.755),
          text: String(n),
          font: "sans",
          size: "lg",
        });
    if (c.hands !== false) {
      const hour = (c.hour % 12) * 30 + c.minute * 0.5;
      prims.push({
        type: "segment",
        id: "hand.hour",
        from: [0, 0],
        to: at(hour, 0.44),
        stroke: "ink",
        width: 7,
        cap: "round",
        data: { hand: "hour" },
      });
      prims.push({
        type: "segment",
        id: "hand.minute",
        from: [0, 0],
        to: at(c.minute * 6, 0.6),
        stroke: "accent",
        width: 4,
        cap: "round",
        data: { hand: "minute" },
      });
      prims.push({
        type: "circle",
        id: "pin",
        center: [0, 0],
        r: 0.05,
        fill: "ink",
      });
    }
    return prims;
  },
  describe(c) {
    const h = c.hour % 12 === 0 ? 12 : c.hour % 12;
    return c.hands === false
      ? "A clock face with no hands."
      : `Clock showing ${h}:${String(c.minute).padStart(2, "0")}. The shorter hand shows the hour; the longer hand shows minutes.`;
  },
});
