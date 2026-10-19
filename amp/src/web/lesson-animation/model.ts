import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type Balance = Extract<SemanticFigure, { kind: "balance-scale" }>;
/** add: x + a = b; times: px = b; remove-split: px + q = r; split-remove: p(x + q) = r. */
export type BalanceForm = "add" | "times" | "remove-split" | "split-remove";
export type AnimationModel =
  | { kind: "balance"; figure: Balance; form: BalanceForm; x: number }
  | { kind: "fraction"; figure: Fraction }
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
  if (
    (lesson.templateId === "balance-one-step" ||
      lesson.templateId === "balance-two-step") &&
    f?.kind === "balance-scale"
  ) {
    const form = balanceForm(f);
    if (!form) return null;
    // The weight follows from the figure's counts; the lesson answer is not read.
    const x = (f.right - f.groups * f.units) / (f.groups * f.blocks);
    return Number.isInteger(x) && x >= 1
      ? { kind: "balance", figure: f, form, x }
      : null;
  }
  return null;
}
function balanceForm(f: Balance): BalanceForm | null {
  if (
    !integer(f.groups, 1, 3) ||
    !integer(f.blocks, 1, 5) ||
    !integer(f.units, 0, 12) ||
    !integer(f.right, 1, 30)
  )
    return null;
  if (f.groups > 1)
    return f.blocks === 1 && f.units >= 1 ? "split-remove" : null;
  if (f.blocks === 1) return f.units >= 1 ? "add" : null;
  return f.units === 0 ? "times" : "remove-split";
}
function balanceFrames(model: Extract<AnimationModel, { kind: "balance" }>) {
  const { groups: g, blocks: p, units: q, right: r } = model.figure;
  const x = model.x;
  const cubes = (n: number) => `${n} ${n === 1 ? "cube" : "cubes"}`;
  if (model.form === "add")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: one x block and ${cubes(q)} balance ${cubes(r)}.`,
        math: `$x + ${q} = ${r}$`,
      },
      {
        title: "Remove the same weight from both pans",
        text: `Take ${cubes(q)} off each pan. Both pans lose ${q} grams, so the balance stays level.`,
        math: `$x + ${q} - ${q} = ${r} - ${q}$`,
      },
      {
        title: "The block is alone",
        text: `One x block balances ${cubes(x)}.`,
        math: `$x = ${x}$`,
      },
    ];
  if (model.form === "times")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: ${p} x blocks balance ${cubes(r)}.`,
        math: `$${p}x = ${r}$`,
      },
      {
        title: `Split both pans into ${p} equal groups`,
        text: `Each group on the left is one x block. Each group on the right has ${cubes(x)}.`,
        math: `$${p}x \\div ${p} = ${r} \\div ${p}$`,
      },
      {
        title: "Keep one group from each pan",
        text: `One x block balances one group of ${cubes(x)}.`,
        math: `$x = ${x}$`,
      },
    ];
  if (model.form === "remove-split")
    return [
      {
        title: "Read the balance",
        text: `Level pans hold equal weights: ${p} x blocks and ${cubes(q)} balance ${cubes(r)}.`,
        math: `$${p}x + ${q} = ${r}$`,
      },
      {
        title: "Remove the loose cubes from both pans",
        text: `Take ${cubes(q)} off each pan. The balance stays level.`,
        math: `$${p}x = ${r} - ${q} = ${r - q}$`,
      },
      {
        title: `Split both pans into ${p} equal groups`,
        text: `Each x block balances one group of ${cubes(x)}.`,
        math: `$x = ${r - q} \\div ${p} = ${x}$`,
      },
    ];
  return [
    {
      title: "Read the balance",
      text: `Level pans hold equal weights: ${g} bags, each holding one x block and ${cubes(q)}, balance ${cubes(r)}.`,
      math: `$${g}(x + ${q}) = ${r}$`,
    },
    {
      title: `Split both pans into ${g} equal groups`,
      text: `One bag balances one group of ${cubes(r / g)}.`,
      math: `$x + ${q} = ${r} \\div ${g} = ${r / g}$`,
    },
    {
      title: "Remove the same weight from every group",
      text: `Take the ${cubes(q)} out of each bag and ${cubes(q)} from each group on the right.`,
      math: `$x = ${r / g} - ${q} = ${x}$`,
    },
  ];
}
export function animationFrames(model: AnimationModel) {
  if (model.kind === "balance") return balanceFrames(model);
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
