import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type CounterRows = Extract<SemanticFigure, { kind: "counter-rows" }>;
type BaseTenPair = Extract<SemanticFigure, { kind: "base-ten-pair" }>;
type TenFramePair = Extract<SemanticFigure, { kind: "ten-frame-pair" }>;
export type AnimationModel =
  | { kind: "make-ten"; figure: TenFramePair }
  | { kind: "pairing"; figure: CounterRows }
  | { kind: "place-compare"; figure: BaseTenPair }
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
    lesson.templateId === "make-ten-fact" &&
    f?.kind === "ten-frame-pair" &&
    integer(f.first, 1, 9) &&
    integer(f.second, 1, 9) &&
    f.first + f.second > 10
  )
    return { kind: "make-ten", figure: f };
  if (
    lesson.templateId === "compare-groups" &&
    f?.kind === "counter-rows" &&
    integer(f.circles, 1, 10) &&
    integer(f.squares, 1, 10)
  )
    return { kind: "pairing", figure: f };
  if (
    lesson.templateId === "compare-two-digit" &&
    f?.kind === "base-ten-pair" &&
    f.values.every((n) => integer(n, 10, 99))
  )
    return { kind: "place-compare", figure: f };
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
  return null;
}
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
export function animationFrames(model: AnimationModel) {
  if (model.kind === "make-ten") {
    const { first: a, second: b } = model.figure;
    const need = 10 - a,
      rest = b - need;
    return [
      {
        title: "Two frames",
        text: `${a} in the first frame, ${b} in the second.`,
        math: `$${a} + ${b}$`,
      },
      {
        title: "Fill the first ten",
        text: `${a} needs ${need} more to make 10. Move ${need} from the second frame.`,
        math: `$${b} = ${need} + ${rest}$`,
      },
      {
        title: "Ten and the rest",
        text: `One full ten and ${rest} more. No counter was added or lost.`,
        math: `$${a} + ${b} = 10 + ${rest} = ${a + b}$`,
      },
    ];
  }
  if (model.kind === "pairing") {
    const { circles: c, squares: s, spread } = model.figure;
    const pairs = Math.min(c, s),
      extra = Math.abs(c - s),
      rest =
        c > s
          ? plural(extra, "circle", "circles")
          : plural(extra, "square", "squares");
    return [
      {
        title: "Two rows",
        text:
          spread === "none"
            ? "Circles above, squares below, with the same spacing."
            : `The ${spread} are spread out, so their row looks longer.`,
        math: `$${c}$ circles, $${s}$ squares`,
      },
      {
        title: "Line them up",
        text: "Move each square under a circle. Spacing changes; the number of each does not.",
        math: `$${c}$ circles, $${s}$ squares`,
      },
      {
        title: "Pair them",
        text:
          extra === 0
            ? `${plural(pairs, "pair", "pairs")}, none left over: the same number.`
            : `${plural(pairs, "pair", "pairs")}; ${rest} without a partner.`,
        math: `$${c} ${c < s ? "<" : c > s ? ">" : "="} ${s}$`,
      },
    ];
  }
  if (model.kind === "place-compare") {
    const [a, b] = model.figure.values;
    const [ta, tb] = [Math.floor(a / 10), Math.floor(b / 10)],
      [oa, ob] = [a % 10, b % 10];
    const sign = a < b ? "<" : a > b ? ">" : "=";
    return [
      {
        title: "Build both numbers",
        text: `${a} is ${plural(ta, "ten", "tens")} and ${plural(oa, "one", "ones")}. ${b} is ${plural(tb, "ten", "tens")} and ${plural(ob, "one", "ones")}.`,
        math: `$${a}$ and $${b}$`,
      },
      {
        title: "Compare the tens",
        text:
          ta === tb
            ? `Both have ${plural(ta, "ten", "tens")}. The tens cannot decide.`
            : `${plural(ta, "ten", "tens")} and ${plural(tb, "ten", "tens")}. Even 9 ones are less than 1 ten.`,
        math: `$${ta * 10} ${ta < tb ? "<" : ta > tb ? ">" : "="} ${tb * 10}$`,
      },
      ta === tb
        ? {
            title: "The ones decide",
            text: `${plural(oa, "one", "ones")} and ${plural(ob, "one", "ones")}.`,
            math: `$${a} ${sign} ${b}$`,
          }
        : {
            title: "The tens decide",
            text: "The ones cannot make up a whole ten, so they do not change the answer.",
            math: `$${a} ${sign} ${b}$`,
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
