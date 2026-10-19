import { registerComponent, type Prim } from "../layout";
import type { Point, Tree } from "../spec";
import { typeset } from "../type";

/** Layout in figure pixels (y down); a tree's size is set by its labels, so
 * math units are pixels divided by the scale. */
const PITCH = 52,
  GAP = 20,
  RUN = 88,
  LEAF_GAP = 18;
const isMath = (text: string) => /^[−-]?[\d.,/ ]+$/.test(text);
/** Outcome labels are bold. */
const width = (text: string) =>
  typeset(text, isMath(text) ? "math" : "sans", "md", true).width;

type Node = {
  path: string;
  label: string;
  p: string | null;
  derived?: boolean;
  at: Point;
};
type Exact = { n: bigint; d: bigint; decimals: number | null };
/** "3/5" or "0.25" as an exact value; decimals keep their place count. */
function exact(text: string): Exact | null {
  const f = /^(\d+)\/(\d+)$/.exec(text);
  if (f) return { n: BigInt(f[1]!), d: BigInt(f[2]!), decimals: null };
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m) return null;
  const places = m[2]?.length ?? 0;
  return {
    n: BigInt(m[1]! + (m[2] ?? "")),
    d: 10n ** BigInt(places),
    decimals: places,
  };
}
/** A path's product as written: fractions multiply unreduced (3/5 × 2/4 =
 * 6/20, as the lesson shows it), decimals as a decimal. */
export function pathProduct(ps: (string | null)[]): string | null {
  const values = ps.map((p) => (p === null ? null : exact(p)));
  if (values.some((v) => v === null)) return null;
  const vs = values as Exact[];
  const n = vs.reduce((a, v) => a * v.n, 1n),
    d = vs.reduce((a, v) => a * v.d, 1n);
  if (vs.every((v) => v.decimals !== null)) {
    const places = vs.reduce((a, v) => a + v.decimals!, 0);
    const digits = n.toString().padStart(places + 1, "0");
    const text = places
      ? `${digits.slice(0, -places)}.${digits.slice(-places)}`
      : digits;
    return places ? text.replace(/\.?0+$/, "") : text;
  }
  return `${n}/${d}`;
}
/** Parts are named by stage (b1.0, b2.0.1) so that a timeline target, which
 * matches by prefix, never catches the next stage's branches. */
const stage = (path: string) => (path.includes(".") ? 2 : 1);
export function treeLayout(c: Tree) {
  const stages = c.branches.some((b) => b.children) ? 2 : 1;
  const leaves: {
    path: string;
    y: number;
    leaf?: string | null;
    product?: string | null;
  }[] = [];
  let y = 0;
  for (const [i, b] of c.branches.entries()) {
    if (i) y += GAP;
    for (const [j, ch] of (b.children ?? [b]).entries()) {
      if (j || i) y += PITCH;
      leaves.push({
        path: b.children ? `${i}.${j}` : `${i}`,
        y,
        leaf: ch.leaf,
        product: c.products
          ? pathProduct(b.children ? [b.p, ch.p] : [b.p])
          : undefined,
      });
    }
  }
  const first = c.branches.map((b, i) => {
    const mine = leaves.filter(
      (l) => l.path === `${i}` || l.path.startsWith(`${i}.`),
    );
    return (mine[0]!.y + mine.at(-1)!.y) / 2;
  });
  const rootY = (first[0]! + first.at(-1)!) / 2;
  const x1 = RUN + 8;
  const w1 = Math.max(...c.branches.map((b) => width(b.label)));
  const x2 = x1 + w1 + 10 + RUN;
  const w2 = Math.max(
    0,
    ...c.branches.flatMap((b) =>
      (b.children ?? []).map((ch) => width(ch.label)),
    ),
  );
  const nodes: Node[] = c.branches.map((b, i) => ({
    path: `${i}`,
    label: b.label,
    p: b.p,
    derived: b.derived,
    at: [x1, first[i]!],
  }));
  for (const [i, b] of c.branches.entries())
    for (const [j, ch] of (b.children ?? []).entries())
      nodes.push({
        path: `${i}.${j}`,
        label: ch.label,
        p: ch.p,
        derived: ch.derived,
        at: [x2, leaves.find((l) => l.path === `${i}.${j}`)!.y],
      });
  const leafX = (stages === 2 ? x2 + w2 : x1 + w1) + LEAF_GAP;
  return { nodes, leaves, root: [0, rootY] as Point, x1, w1, leafX, height: y };
}

/** The drawn width in figure pixels, labels included. */
export function treeWidth(c: Tree) {
  const L = treeLayout(c);
  const leaf = Math.max(
    0,
    ...L.leaves.map((l) => {
      const text = l.leaf !== undefined ? l.leaf : l.product;
      return text === undefined ? 0 : width(text ?? "?");
    }),
  );
  return Math.max(
    ...L.nodes.map((n) => n.at[0] + width(n.label)),
    L.leafX + leaf,
  );
}

registerComponent("tree", {
  compile(c, { s }) {
    const L = treeLayout(c);
    const P = ([x, y]: Point): Point => [x / s, (L.height - y) / s];
    const lit = new Set(c.highlight ?? []);
    const prims: Prim[] = [
      { type: "point", id: "root", at: P(L.root), r: 5, color: "ink" },
    ];
    for (const n of L.nodes) {
      const parent: Point = n.path.includes(".")
        ? [L.x1 + L.w1 + 10, L.nodes.find((m) => m.path === n.path[0])!.at[1]]
        : [L.root[0] + 8, L.root[1]];
      const end: Point = [n.at[0] - 8, n.at[1]];
      const on = lit.has(n.path);
      prims.push({
        type: "segment",
        id: `b${stage(n.path)}.${n.path}`,
        from: P(parent),
        to: P(end),
        stroke: on ? "accent" : "ink",
        width: on ? 3.5 : 2,
        obstacle: true,
        cap: "round",
      });
      const mid: Point = [(parent[0] + end[0]) / 2, (parent[1] + end[1]) / 2];
      const rise = end[1] - parent[1];
      const up = rise < -1,
        down = rise > 1;
      prims.push({
        type: "text",
        id: `p${stage(n.path)}.${n.path}`,
        at: P(mid),
        text: n.p ?? "?",
        derived: n.p === null || !!n.derived,
        bold: on,
        color: on ? "accent" : "ink",
        halo: true,
        place: down
          ? [
              [4, 6, -1, -1],
              [0, 8, 0, -1],
              [-4, -6, 1, 1],
            ]
          : up
            ? [
                [-4, 6, 1, -1],
                [-4, -6, 1, 1],
                [0, -8, 0, 1],
              ]
            : [
                [0, -6, 0, 1],
                [0, 6, 0, -1],
              ],
      });
      prims.push({
        type: "text",
        id: `node${stage(n.path)}.${n.path}`,
        at: P(n.at),
        text: n.label,
        font: isMath(n.label) ? "math" : "sans",
        bold: true,
        color: on ? "accent" : "ink",
        align: [-1, 0],
      });
    }
    for (const leaf of L.leaves) {
      const text = leaf.leaf !== undefined ? leaf.leaf : leaf.product;
      if (text === undefined) continue;
      prims.push({
        type: "text",
        id: `leaf.${leaf.path}`,
        at: P([L.leafX, leaf.y]),
        text: text ?? "?",
        derived:
          text === null || (leaf.leaf === undefined && c.products !== "shown"),
        bold: lit.has(leaf.path),
        color: lit.has(leaf.path) ? "accent" : "ink",
        align: [-1, 0],
      });
    }
    return prims;
  },
  describe(c, reveal) {
    const v = (x: string | null, derived = false) =>
      x === null || (derived && !reveal) ? "unknown" : x;
    const parts = c.branches.map((b) => {
      const head = `${b.label} with probability ${v(b.p, b.derived)}`;
      if (!b.children)
        return b.leaf !== undefined ? `${head}, giving ${v(b.leaf)}` : head;
      return `${head}, then ${b.children
        .map(
          (ch) =>
            `${ch.label} with probability ${v(ch.p, ch.derived)}${ch.leaf !== undefined ? ` (path: ${v(ch.leaf)})` : ""}`,
        )
        .join(" or ")}`;
    });
    return `A probability tree. First: ${parts.join("; ")}.`;
  },
});
