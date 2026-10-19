import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
export type AnimationModel =
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 }
  /** A point reflected across 0 onto its opposite. */
  | { kind: "opposite"; value: number; min: number; max: number }
  /** Signed changes added one jump at a time; values are exact halves. */
  | { kind: "jumps"; start: number; jumps: number[]; min: number; max: number };
const half = (n: number) => Number.isFinite(n) && Number.isInteger(n * 2);
/** Running positions of a jump sequence, exact for halves. */
export const jumpStops = (start: number, jumps: number[]) =>
  jumps.reduce(
    (all, j) => [...all, Math.round((all.at(-1)! + j) * 2) / 2],
    [start],
  );
/** TeX for a signed number; negatives in parentheses when they follow an operator. */
/** Prose uses a typographic minus. */
const shown = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const tex = (n: number, wrap = false) => (n < 0 && wrap ? `(${n})` : `${n}`);
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
    lesson.templateId === "split-array-part" &&
    f?.kind === "unit-array" &&
    integer(f.rows, 2, 12) &&
    integer(f.columns, 1, 12) &&
    f.splitAfterRow !== undefined &&
    integer(f.splitAfterRow, 1, f.rows - 1)
  )
    return { kind: "array", figure: { ...f, splitAfterRow: f.splitAfterRow } };
  if (
    lesson.templateId === "opposite-on-line" &&
    f?.kind === "signed-line" &&
    f.jumps === undefined &&
    f.points.length === 1 &&
    integer(f.points[0]!.value, f.min, f.max) &&
    f.points[0]!.value !== 0 &&
    integer(-f.points[0]!.value, f.min, f.max)
  )
    return {
      kind: "opposite",
      value: f.points[0]!.value,
      min: f.min,
      max: f.max,
    };
  if (
    lesson.templateId === "signed-jumps" &&
    f?.kind === "signed-line" &&
    f.start !== undefined &&
    f.jumps !== undefined &&
    f.jumps.length >= 1 &&
    f.jumps.length <= 4 &&
    Number.isInteger(f.min) &&
    Number.isInteger(f.max) &&
    f.max > f.min &&
    half(f.start) &&
    f.jumps.every((j) => half(j) && j !== 0) &&
    jumpStops(f.start, f.jumps).every((v) => v >= f.min && v <= f.max)
  )
    return {
      kind: "jumps",
      start: f.start,
      jumps: f.jumps,
      min: f.min,
      max: f.max,
    };
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
  if (model.kind === "opposite") {
    const a = model.value,
      d = Math.abs(a),
      units = `${d} ${d === 1 ? "unit" : "units"}`;
    return [
      {
        title: "Read the point",
        text: `P is ${units} to the ${a < 0 ? "left" : "right"} of 0.`,
        math: `$P = ${tex(a)}$`,
      },
      {
        title: "Reflect across 0",
        text: "Swing P over 0 to the other side. Its distance from 0 does not change.",
        math: `$\\text{distance from } 0 = ${d}$`,
      },
      {
        title: "Name the opposite",
        text: `The opposite of ${shown(a)} is ${shown(-a)}: ${units} from 0 on the ${a < 0 ? "right" : "left"}.`,
        math: `$-${tex(a, true)} = ${tex(-a)}$`,
      },
    ];
  }
  if (model.kind === "jumps") {
    const stops = jumpStops(model.start, model.jumps),
      end = stops.at(-1)!;
    const sum = [
      tex(model.start),
      ...model.jumps.map((j) => tex(j, true)),
    ].join(" + ");
    return [
      {
        title: "Start",
        text: `Begin at ${shown(model.start)}. Moving right adds a positive change; moving left adds a negative change.`,
        math: `$${tex(model.start)}$`,
      },
      {
        title: "Make each jump",
        text: `Each arrow adds one change, in order: ${model.jumps.map((j) => (j > 0 ? `+${j}` : shown(j))).join(", then ")}.`,
        math: `$${sum}$`,
      },
      {
        title: "Land",
        text: `The last arrow ends at ${shown(end)}, ${end < 0 ? "left" : "right"} of 0.`,
        math: `$${sum} = ${tex(end)}$`,
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
