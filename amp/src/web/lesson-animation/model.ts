import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type RateLines = Extract<SemanticFigure, { kind: "double-number-line" }>;
/** A double number line scaled through 1: pairs are [bottom, top]. */
export type RateModel = {
  kind: "rate";
  top: string;
  bottom: string;
  given: [number, number];
  target: [number, number];
  findBottom: boolean;
};
export type AnimationModel =
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 }
  | RateModel;
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
    lesson.templateId === "double-number-line-missing" &&
    f?.kind === "double-number-line"
  )
    return rateModel(f);
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
/** Whole-number lines with 0, one known pair and one pair with an unknown. */
function rateModel(f: RateLines): RateModel | null {
  const { top, bottom } = f;
  if (top.denominator !== 1 || bottom.denominator !== 1) return null;
  if (top.numerators.length !== 3 || bottom.numerators.length !== 3)
    return null;
  if (top.numerators[0] !== 0 || bottom.numerators[0] !== 0) return null;
  const columns = [1, 2].map((i) => [
    bottom.numerators[i] ?? null,
    top.numerators[i] ?? null,
  ]);
  const known = columns.find(([b, t]) => b !== null && t !== null),
    asked = columns.find(([b, t]) => (b === null) !== (t === null));
  if (!known || !asked) return null;
  const [b, t] = known as [number, number];
  if (!integer(b, 1, 1000) || !integer(t, 1, 100000) || t % b) return null;
  const rate = t / b,
    findBottom = asked[0] === null;
  const target: [number, number] = findBottom
    ? [asked[1]! / rate, asked[1]!]
    : [asked[0]!, asked[0]! * rate];
  if (!integer(target[0], 2, 1000) || target[0] === b) return null;
  return {
    kind: "rate",
    top: top.label,
    bottom: bottom.label,
    given: [b, t],
    target,
    findBottom,
  };
}
export function animationFrames(model: AnimationModel) {
  if (model.kind === "rate") {
    const [b, t] = model.given,
      [tb, tt] = model.target,
      rate = t / b;
    const bottom = model.bottom.toLowerCase(),
      top = model.top.toLowerCase();
    return [
      {
        title: "Start from a known pair",
        text: `Aligned marks pair ${t} on the ${top} line with ${b} on the ${bottom} line.`,
        math: `$${t}$ and $${b}$`,
      },
      {
        title: "Shrink both lines to 1",
        text: `Divide both values by ${b}. The pair keeps its ratio and lands on 1.`,
        math: `$${t} \\div ${b} = ${rate}$ and $${b} \\div ${b} = 1$`,
      },
      {
        title: model.findBottom
          ? "Stretch to the known value"
          : "Stretch to the target",
        text: model.findBottom
          ? `Multiply both values by ${tb}, because ${tb} groups of ${rate} make ${tt}.`
          : `Multiply both values by ${tb}. The marks stay aligned.`,
        math: model.findBottom
          ? `$${tt} \\div ${rate} = ${tb}$`
          : `$${rate} \\times ${tb} = ${tt}$`,
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
