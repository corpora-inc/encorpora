import type { SemanticFigure } from "../../math/contracts";

type Pt = [number, number];
/** Three shapes of one kind, morphed into one another: what changes, and
 * what never does. */
export type ShapeMorphAnimation = {
  kind: "shape-morph";
  shapes: { label: string; points: Pt[] }[];
};

/** Opts in only for three lettered straight-sided shapes with one vertex
 * count, read from the example's own figure. */
export function shapeMorphModel(
  templateId: string,
  f: SemanticFigure | undefined,
): ShapeMorphAnimation | null {
  if (templateId !== "defining-attribute" || f?.kind !== "plane-shapes")
    return null;
  if (f.items.length !== 3) return null;
  const shapes = f.items.map((item) => {
    const piece = item.pieces[0];
    return item.pieces.length === 1 && piece?.type === "polygon" && item.label
      ? { label: item.label, points: piece.points as Pt[] }
      : null;
  });
  if (shapes.some((s) => !s)) return null;
  const n = shapes[0]!.points.length;
  if (n < 3 || n > 8 || shapes.some((s) => s!.points.length !== n)) return null;
  return {
    kind: "shape-morph",
    shapes: shapes as ShapeMorphAnimation["shapes"],
  };
}

const sideLengths = (p: Pt[]) =>
  p.map((v, i) => {
    const w = p[(i + 1) % p.length]!;
    return Math.hypot(w[0] - v[0], w[1] - v[1]);
  });
function describe(p: Pt[]) {
  const ys = p.map((q) => q[1]),
    xs = p.map((q) => q[0]);
  const low = Math.min(...ys);
  const flat = p.some(
    (v, i) =>
      Math.abs(v[1] - low) < 1e-3 &&
      Math.abs(p[(i + 1) % p.length]![1] - low) < 1e-3,
  );
  const d = sideLengths(p);
  const equal = Math.max(...d) - Math.min(...d) < 1e-3 * Math.max(...d);
  const w = Math.max(...xs) - Math.min(...xs),
    h = Math.max(...ys) - low;
  return [
    equal ? "all sides the same length" : "sides of different lengths",
    flat ? "a side flat along the bottom" : "no side flat along the bottom",
    w > h ? "wider than tall" : "taller than wide",
  ].join("; ");
}
export function shapeMorphFrames(model: ShapeMorphAnimation) {
  const n = model.shapes[0]!.points.length;
  const [a, b, c] = model.shapes as [
    ShapeMorphAnimation["shapes"][number],
    ShapeMorphAnimation["shapes"][number],
    ShapeMorphAnimation["shapes"][number],
  ];
  const count = `$${n}$ sides, $${n}$ corners`;
  return [
    {
      title: `Shape ${a.label}`,
      text: `${n} sides and ${n} corners: ${describe(a.points)}.`,
      math: count,
    },
    {
      title: `Reshape it into ${b.label}`,
      text: `Now ${describe(b.points)}. Still ${n} sides and ${n} corners.`,
      math: count,
    },
    {
      title: `Reshape it into ${c.label}`,
      text: `Now ${describe(c.points)}. The sides and corners never changed.`,
      math: count,
    },
  ];
}
