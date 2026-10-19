import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type CubePrism = Extract<SemanticFigure, { kind: "cube-prism" }>;
type Grid = Extract<SemanticFigure, { kind: "quadrant-grid" }>;
export type AnimationModel =
  | { kind: "fraction"; figure: Fraction }
  | { kind: "prism-layers"; figure: CubePrism }
  | { kind: "quadrant-walk"; figure: Grid }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 };
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const f = lesson.example.figure;
  if (
    lesson.templateId === "fraction-model" &&
    f?.kind === "fraction" &&
    integer(f.parts, 2, 12) &&
    integer(f.selected, 0, f.parts)
  )
    return { kind: "fraction", figure: f };
  if (
    (lesson.templateId === "unit-cube-volume" ||
      lesson.templateId === "cube-layer-count") &&
    f?.kind === "cube-prism" &&
    integer(f.length, 1, 6) &&
    integer(f.width, 1, 6) &&
    integer(f.height, 2, 6)
  )
    return { kind: "prism-layers", figure: f };
  if (
    lesson.templateId === "first-quadrant-coordinates" &&
    f?.kind === "quadrant-grid" &&
    integer(f.size, 4, 10) &&
    f.points.length === 1
  )
    return { kind: "quadrant-walk", figure: f };
  if (
    lesson.templateId === "split-array-part" &&
    f?.kind === "unit-array" &&
    integer(f.rows, 2, 12) &&
    integer(f.columns, 1, 12) &&
    f.splitAfterRow !== undefined &&
    integer(f.splitAfterRow, 1, f.rows - 1)
  )
    return { kind: "array", figure: { ...f, splitAfterRow: f.splitAfterRow } };
  if (
    lesson.templateId === "exchange-base-ten" &&
    f?.kind === "base-ten" &&
    integer(f.hundreds, 0, 9) &&
    integer(f.tens, 0, 19) &&
    integer(f.ones, 0, 19)
  ) {
    if (f.ones >= 10 && f.tens < 10)
      return { kind: "exchange", figure: f, unit: 1 };
    if (f.tens >= 10 && f.ones < 10)
      return { kind: "exchange", figure: f, unit: 10 };
  }
  return null;
}
export function animationFrames(model: AnimationModel) {
  if (model.kind === "prism-layers") {
    const { length: l, width: w, height: h } = model.figure,
      layer = l * w;
    return [
      {
        title: "One layer",
        text: `The top shows ${l} by ${w} cubes. The bottom layer is the same.`,
        math: `$${l} \\times ${w} = ${layer}$ cubes`,
      },
      {
        title: "Stack the layers",
        text: `${h} identical layers fill the prism, hidden cubes included.`,
        math: `$${h}$ layers`,
      },
      {
        title: "Multiply",
        text: `Each of the ${h} layers holds ${layer} cubes.`,
        math: `$V = ${layer} \\times ${h} = ${layer * h}$ cubic units`,
      },
    ];
  }
  if (model.kind === "quadrant-walk") {
    const { x, y } = model.figure.points[0]!;
    return [
      {
        title: "Start at the origin",
        text: "Both coordinates are 0 where the axes meet.",
        math: "$(0, 0)$",
      },
      {
        title: "Across first",
        text: `Go ${x} across along the x-axis: the first coordinate.`,
        math: `$x = ${x}$`,
      },
      {
        title: "Then up",
        text: `Go ${y} up to reach the point: the second coordinate.`,
        math: `$(${x}, ${y})$`,
      },
    ];
  }
  if (model.kind === "fraction") {
    const { parts: d, selected: n } = model.figure;
    return [
      {
        title: "Name the whole",
        text: "The outline marks one whole. Keep its size fixed.",
        math: "$1$ whole",
      },
      {
        title: "Partition equally",
        text: `Divide the whole into ${d} equal parts.`,
        math: `Each part is $\\dfrac{1}{${d}}$ of the whole.`,
      },
      {
        title: "Count the shaded parts",
        text: `${n === 1 ? "The shaded part keeps its" : `The ${n} shaded parts keep their`} size when moved.`,
        math: `$${n} \\times \\dfrac{1}{${d}} = \\dfrac{${n}}{${d}}$`,
      },
    ];
  }
  if (model.kind === "array") {
    const { rows: r, columns: c, splitAfterRow: a } = model.figure;
    return [
      {
        title: "Count rows and columns",
        text: `${r} rows, with ${c} unit squares in each row.`,
        math: `$${r} \\times ${c} = ${r * c}$`,
      },
      {
        title: "Separate the regions",
        text: `A has ${a} rows. B has ${r - a} rows. Each row keeps ${c} squares.`,
        math: `$A = ${a * c},\\quad B = ${(r - a) * c}$`,
      },
      {
        title: "Rejoin the partial products",
        text: "The two regions fill the original array without gaps or overlaps.",
        math: `$${a * c} + ${(r - a) * c} = ${r * c}$`,
      },
    ];
  }
  const { hundreds: h, tens: t, ones: o } = model.figure;
  const u = model.unit,
    small = u === 1 ? "ones" : "tens",
    large = u === 1 ? "ten" : "hundred";
  const h2 = h + (u === 10 ? 1 : 0),
    t2 = t + (u === 1 ? 1 : -10),
    o2 = o - (u === 1 ? 10 : 0);
  const remaining = [
    [h, "hundred"],
    [u === 1 ? t : t - 10, "ten"],
    [u === 1 ? o - 10 : o, "one"],
  ]
    .map(([count, name]) => `${count} ${name}${count === 1 ? "" : "s"}`)
    .join(", ");
  return [
    {
      title: `Choose ten ${small}`,
      text: `Focus on ten of the model’s ${u === 1 ? o : t} ${small}. Other units stay unchanged.`,
      math: `$${h} \\times 100 + ${t} \\times 10 + ${o}$`,
    },
    {
      title: "Bring equal units together",
      text: `Move the ten ${small} together without changing their size.`,
      math: `$10 \\times ${u} = ${10 * u}$`,
    },
    {
      title: `Exchange for one ${large}`,
      text: `Unchanged: ${remaining}. Total value: ${h * 100 + t * 10 + o}.`,
      math: `$${h2} \\times 100 + ${t2} \\times 10 + ${o2}$`,
    },
  ];
}
