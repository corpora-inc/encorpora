import { z } from "zod";
import { base, color, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import type { FillRole } from "../spec";

/** A monomial c·xᵖ as [c, p]: [3, 1] is 3x, [−2, 0] is −2. */
const termSchema = z.tuple([
  z
    .number()
    .int()
    .min(-144)
    .max(144)
    .refine((c) => c !== 0, "Nonzero"),
  z.number().int().min(0).max(3),
]);
/** A product of polynomials as an area: each side lists its terms, and each
 * region is one term product. Linear sides with small coefficients are drawn
 * as algebra tiles (x² squares, x strips, unit squares); other sides are
 * schematic. Negative products are shaded warm. */
export const polyAreaSchema = z
  .object({
    ...base,
    type: z.literal("polyArea"),
    across: z.array(termSchema).min(1).max(4),
    down: z.array(termSchema).min(1).max(4),
    /** The side terms: the factors. */
    sides: z.enum(["shown", "derived", "none"]).optional(),
    /** Each region's term product: masked by default. */
    products: z.enum(["shown", "derived", "none"]).optional(),
    /** Regions [i, j] drawn as an empty dashed outline: the piece to add
     * when completing a square. */
    missing: z
      .array(
        z.tuple([
          z.number().int().min(0).max(3),
          z.number().int().min(0).max(3),
        ]),
      )
      .max(4)
      .optional(),
  })
  .strict();
export type PolyArea = z.infer<typeof polyAreaSchema>;
export type Term = PolyArea["across"][number];

/**
 * A polynomial product as an area. Each side is a list of terms; region
 * (i, j) is across[i] × down[j]. When every side term is linear with a small
 * coefficient the regions are algebra tiles: an x side is drawn X units long
 * (X is not a whole number, so an x strip never passes for a count of units)
 * and each region is subdivided into its tiles. Otherwise the sides are
 * schematic and only the regions are drawn.
 */
export const X = 3.4;
const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** A term as a math label: [3, 1] → "3x", [−1, 2] → "−x^2", [5, 0] → "5". */
export function termText([c, p]: Term, leading = true) {
  const sign = c < 0 ? "−" : leading ? "" : "+",
    m = Math.abs(c);
  const body =
    p === 0 ? String(m) : `${m === 1 ? "" : m}x${p > 1 ? `^${p}` : ""}`;
  return `${sign}${body}`;
}
/** A side as a label: [[1, 1], [−3, 0]] → "x − 3". */
export const sideText = (terms: Term[]) =>
  terms
    .map((t, i) =>
      i === 0
        ? termText(t)
        : ` ${t[0] < 0 ? "−" : "+"} ${termText([Math.abs(t[0]), t[1]])}`,
    )
    .join("");
export const productTerm = (a: Term, b: Term): Term => [
  a[0] * b[0],
  a[1] + b[1],
];

/** Drawn as tiles: linear sides, at most 4 x-lengths and 12 units a term. */
export function tiled(c: Pick<PolyArea, "across" | "down">) {
  return [...c.across, ...c.down].every(
    ([k, p]) => p <= 1 && Math.abs(k) <= (p === 1 ? 4 : 12),
  );
}
/** Drawn length of one side term. */
function length([k, p]: Term, tiles: boolean) {
  if (tiles) return p === 1 ? Math.abs(k) * X : Math.abs(k);
  return [1.6, 3, 3.6, 4.2][p]!;
}
const fillFor = ([k, p]: Term): FillRole =>
  k < 0
    ? "warm-fill"
    : p >= 2
      ? "accent-fill"
      : p === 1
        ? "gold-fill"
        : "empty";

/** The center of a region's middle tile, so a label never sits on a tile
 * edge (the region's center is an edge when a side has an even count). */
function middleTile(
  x: number,
  y: number,
  w: number,
  h: number,
  across: Term,
  down: Term,
): [number, number] {
  const cols = Math.abs(across[0]),
    rows = Math.abs(down[0]);
  return [
    x + (w * (Math.floor(cols / 2) + 0.5)) / cols,
    y + (h * (Math.floor(rows / 2) + 0.5)) / rows,
  ];
}

export function polyAreaSize(c: Pick<PolyArea, "across" | "down">) {
  const tiles = tiled(c);
  return {
    tiles,
    across: c.across.map((t) => length(t, tiles)),
    down: c.down.map((t) => length(t, tiles)),
  };
}

registerComponent("polyArea", {
  maxScale: (c) => {
    const { across, down } = polyAreaSize(c);
    return Math.min(40, 300 / Math.max(sum(across), sum(down)));
  },
  compile(c, { s }) {
    const { tiles, across, down } = polyAreaSize(c);
    const W = sum(across),
      H = sum(down);
    const missing = new Set((c.missing ?? []).map(([i, j]) => `${i}.${j}`));
    const prims: Prim[] = [];
    const labels: Prim[] = [];
    let y = H;
    for (const [j, h] of down.entries()) {
      let x = 0;
      y -= h;
      for (const [i, w] of across.entries()) {
        const id = `region.${i}.${j}`,
          term = productTerm(c.across[i]!, c.down[j]!),
          gap = missing.has(`${i}.${j}`);
        prims.push({
          type: "rect",
          id,
          at: [x, y],
          size: [w, h],
          fill: gap ? "none" : fillFor(term),
          stroke: gap ? "muted" : "ink",
          width: 2,
          ...(gap ? { dash: "dash" as const } : {}),
          data: { region: termText(term), ...(gap ? { missing: 1 } : {}) },
        });
        if (tiles && !gap) {
          // Tile edges: one strip per x-length or unit along each side.
          const cols = Math.abs(c.across[i]![0]),
            rows = Math.abs(c.down[j]![0]);
          for (let k = 1; k < cols; k++)
            prims.push({
              type: "segment",
              id: `${id}.tile.v${k}`,
              from: [x + (w * k) / cols, y],
              to: [x + (w * k) / cols, y + h],
              stroke: "ink",
              width: 1,
            });
          for (let k = 1; k < rows; k++)
            prims.push({
              type: "segment",
              id: `${id}.tile.h${k}`,
              from: [x, y + (h * k) / rows],
              to: [x + w, y + (h * k) / rows],
              stroke: "ink",
              width: 1,
            });
        }
        const mode = c.products ?? "derived";
        if (mode !== "none" && w * s >= 26 && h * s >= 20)
          labels.push({
            type: "text",
            id: `${id}.term`,
            at:
              tiles && !gap
                ? middleTile(x, y, w, h, c.across[i]!, c.down[j]!)
                : [x + w / 2, y + h / 2],
            text: termText(term),
            font: "math",
            derived: gap || mode === "derived",
            bold: true,
            halo: tiles,
            size: w * s < 48 || h * s < 30 ? "sm" : "md",
            align: [0, 0],
          });
        x += w;
      }
    }
    if ((c.sides ?? "shown") !== "none") {
      const derived = c.sides === "derived";
      let x = 0;
      for (const [i, w] of across.entries()) {
        labels.push({
          type: "text",
          id: `across.${i}`,
          at: [x + w / 2, H],
          text: termText(c.across[i]!),
          font: "math",
          derived,
          offset: [0, -8],
          align: [0, 1],
        });
        x += w;
      }
      y = H;
      for (const [j, h] of down.entries()) {
        y -= h;
        labels.push({
          type: "text",
          id: `down.${j}`,
          at: [0, y + h / 2],
          text: termText(c.down[j]!),
          font: "math",
          derived,
          offset: [-8, 0],
          align: [1, 0],
        });
      }
    }
    return [...prims, ...labels];
  },
  describe(c, reveal) {
    const A = sideText(c.across),
      D = sideText(c.down),
      n = c.across.length * c.down.length;
    const sides =
      c.sides === "derived" && !reveal
        ? "with side lengths to be found"
        : `${A} across and ${D} down`;
    const out = [
      `An area model${tiled(c) ? " of algebra tiles" : ""}: a rectangle ${sides}, split into ${n} ${n === 1 ? "region" : "regions"}${tiled(c) ? "" : " (not to scale)"}.`,
    ];
    const gaps = c.missing ?? [];
    if (gaps.length)
      out.push(
        `${gaps.length === 1 ? "One corner region is" : `${gaps.length} regions are`} empty, to be filled.`,
      );
    const mode = c.products ?? "derived";
    if (mode === "shown" || (mode === "derived" && reveal))
      out.push(
        `Region terms: ${c.down
          .flatMap((d) => c.across.map((a) => termText(productTerm(a, d))))
          .join(", ")}. Negative terms are shaded differently.`,
      );
    else if (mode !== "none") out.push("Each region's term is to be found.");
    return out.join(" ");
  },
});
