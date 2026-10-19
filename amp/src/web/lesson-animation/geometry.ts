import type { SemanticFigure } from "../../math/contracts";
import { geometryFigureSchema } from "../../math/geometry-models";

type Triangle = Extract<SemanticFigure, { kind: "triangle-angles" }>;
type Parallel = Extract<SemanticFigure, { kind: "parallel-transversal" }>;
type Solid = Extract<SemanticFigure, { kind: "solid-section" }>;
export type GeometryAnimationModel =
  | { kind: "triangle-sum"; figure: Triangle }
  | { kind: "exterior-angle"; figure: Triangle & { exterior: object } }
  | { kind: "transversal"; figure: Parallel }
  | { kind: "plane-sweep"; figure: Solid };
type Frame = { title: string; text: string; math: string };

/** Valid exact figures only; the frames read true measures from the figure. */
export function geometryAnimationModel(
  templateId: string,
  figure: SemanticFigure | undefined,
): GeometryAnimationModel | null {
  if (!figure || !geometryFigureSchema.safeParse(figure).success) return null;
  if (templateId === "triangle-angle-sum" && figure.kind === "triangle-angles")
    return figure.exterior ? null : { kind: "triangle-sum", figure };
  if (
    templateId === "triangle-exterior-angle" &&
    figure.kind === "triangle-angles" &&
    figure.exterior
  )
    return {
      kind: "exterior-angle",
      figure: figure as Triangle & { exterior: object },
    };
  if (
    templateId === "parallel-lines-angle" &&
    figure.kind === "parallel-transversal" &&
    figure.marks.length === 2
  )
    return { kind: "transversal", figure };
  if (
    (templateId === "cross-section-shape" ||
      templateId === "cross-section-area") &&
    figure.kind === "solid-section"
  )
    return { kind: "plane-sweep", figure };
  return null;
}

/** "(3x − 5)°" → "3x - 5" for typeset equations. */
const expr = (label: string) =>
  label
    .replace(/°/g, "")
    .replace(/^\((.*)\)$/, "$1")
    .replaceAll("−", "-");
const shapeOf = (f: Solid) =>
  f.plane === "corner" || f.plane === "through-apex"
    ? "triangle"
    : f.plane === "off-apex"
      ? "trapezoid"
      : "rectangle";

export function geometryFrames(model: GeometryAnimationModel): Frame[] {
  if (model.kind === "triangle-sum") {
    const [a, b, c] = model.figure.angles;
    const [A, B, C] = model.figure.vertices;
    return [
      {
        title: "Three corners",
        text: `Triangle ${A}${B}${C} has angles of ${a}°, ${b}° and ${c}°.`,
        math: `$\\angle ${A} + \\angle ${B} + \\angle ${C} = \\,?$`,
      },
      {
        title: "Move two corners to the top",
        text: `Slide ∠${B} along side ${B}${C} and turn ∠${A} half a turn about the middle of ${A}${C}. Neither angle changes size.`,
        math: `$${a}^\\circ,\\ ${c}^\\circ,\\ ${b}^\\circ \\text{ meet at } ${C}$`,
      },
      {
        title: "They fill a straight line",
        text: `The three angles fit together along the line through ${C} parallel to ${A}${B}: a straight angle.`,
        math: `$${a}^\\circ + ${b}^\\circ + ${c}^\\circ = 180^\\circ$`,
      },
    ];
  }
  if (model.kind === "exterior-angle") {
    const [a, b, c] = model.figure.angles;
    const [A, B, C] = model.figure.vertices;
    const D = (model.figure.exterior as { point: string }).point;
    return [
      {
        title: "The exterior angle",
        text: `Extending ${A}${B} past ${B} makes the exterior angle ∠${C}${B}${D}. Its remote interior angles are ∠${A} and ∠${C}.`,
        math: `$\\angle ${C}${B}${D} = 180^\\circ - ${b}^\\circ = ${180 - b}^\\circ$`,
      },
      {
        title: "Move the remote angles to B",
        text: `Slide ∠${A} along ${A}${D} to ${B}, and turn ∠${C} half a turn about the middle of ${B}${C}.`,
        math: `$${a}^\\circ \\text{ and } ${c}^\\circ \\text{ meet at } ${B}$`,
      },
      {
        title: "They fill the exterior angle",
        text: `Together the two copies cover ∠${C}${B}${D} exactly.`,
        math: `$\\angle ${C}${B}${D} = ${a}^\\circ + ${c}^\\circ = ${a + c}^\\circ$`,
      },
    ];
  }
  if (model.kind === "transversal") {
    const f = model.figure;
    const [g, u] = f.marks as [Parallel["marks"][0], Parallel["marks"][0]];
    const [m, n, t] = f.lines;
    const equal = g.position % 2 === u.position % 2;
    const sameCrossing = g.crossing === u.crossing;
    const equation = equal
      ? `$${expr(g.label)} = ${expr(u.label)}$`
      : `$(${expr(g.label)}) + (${expr(u.label)}) = 180$`;
    return [
      {
        title: "Two parallel lines, one transversal",
        text: `Line ${t} crosses ${m} and ${n} at the same tilt, making four angles at each crossing.`,
        math: `$${f.angle}^\\circ \\text{ and } ${180 - f.angle}^\\circ$`,
      },
      sameCrossing
        ? {
            title: "Look at one crossing",
            text: equal
              ? "Opposite angles at a crossing are vertical angles: a half turn carries one onto the other."
              : "Neighboring angles at a crossing sit along one line, so they fill a straight angle.",
            math: equal
              ? "$\\text{vertical angles are equal}$"
              : "$\\text{together } 180^\\circ$",
          }
        : {
            title: `Slide along ${t}`,
            text: `Slide the marked angle along ${t} to the other crossing. Because ${m} ∥ ${n}, it lands exactly on the matching angle there.`,
            math: "$\\text{matching positions are equal}$",
          },
      {
        title: equal ? "Equal angles" : "Supplementary angles",
        text: equal
          ? "The copy covers the other marked angle exactly."
          : "The copy and the other marked angle lie side by side along a line.",
        math: equation,
      },
    ];
  }
  const f = model.figure;
  const u = f.unit ? `\\text{ ${f.unit}}` : "";
  const shape = shapeOf(f);
  const size =
    f.plane === "parallel-base"
      ? f.solid === "prism"
        ? `$${f.length}${u} \\times ${f.width}${u}$`
        : `$${f.length / 2}${u} \\times ${f.width / 2}${u}$`
      : f.plane === "perpendicular-front"
        ? `$${f.length}${u} \\times ${f.height}${u}$`
        : f.plane === "perpendicular-side"
          ? `$${f.width}${u} \\times ${f.height}${u}$`
          : f.plane === "through-apex"
            ? `$\\text{base } ${f.length}${u},\\ \\text{height } ${f.height}${u}$`
            : `$\\text{a ${shape}}$`;
  return [
    {
      title:
        f.solid === "prism"
          ? "A right rectangular prism"
          : "A right rectangular pyramid",
      text: "Hidden edges are dashed. A flat plane is about to cut through.",
      math: `$${f.length} \\times ${f.width} \\times ${f.height}${u}$`,
    },
    {
      title: "The plane moves in",
      text: "Wherever the plane crosses a face, it cuts a straight segment.",
      math: "$\\text{one side per face crossed}$",
    },
    {
      title: `The cross-section: a ${shape}`,
      text:
        f.plane === "off-apex"
          ? "It misses the apex, so the top side is shorter than the bottom: two parallel sides of different lengths."
          : f.plane === "through-apex"
            ? "It passes through the apex, so two sides meet at the top."
            : f.plane === "corner"
              ? "It crosses the three faces at the corner: three sides."
              : f.plane === "parallel-base" && f.solid === "pyramid"
                ? "Halfway up, each side is half the base edge below it."
                : "It copies the face it runs parallel to.",
      math: size,
    },
  ];
}
