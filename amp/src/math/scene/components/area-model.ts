import { z } from "zod";
import { base, fill, label, num as zNum, small } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole, Point } from "../spec";
import { num, spoken } from "./format";

/** A rectangle partitioned by place value or by terms: an area model. */
export const areaModelSchema = z
  .object({
    ...base,
    type: z.literal("areaModel"),
    across: z.array(zNum.positive().max(1e5)).min(1).max(4),
    down: z.array(zNum.positive().max(1e5)).min(1).max(4),
    /** Side labels, defaulting to the part values. */
    acrossLabels: z.array(label).max(4).optional(),
    downLabels: z.array(label).max(4).optional(),
    /** Region products: the learner's work, so masked by default. */
    products: z.enum(["shown", "derived", "none"]).optional(),
    scale: z.enum(["auto", "proportional", "schematic"]).optional(),
    unitGrid: z.boolean().optional(),
  })
  .strict()
  .refine(
    (f) =>
      (!f.acrossLabels || f.acrossLabels.length === f.across.length) &&
      (!f.downLabels || f.downLabels.length === f.down.length),
  );
export type AreaModel = z.infer<typeof areaModelSchema>;

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
