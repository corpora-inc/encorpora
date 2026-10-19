import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type Balance = Extract<SemanticFigure, { kind: "balance-scale" }>;
/** add: x + a = b; times: px = b; remove-split: px + q = r; split-remove: p(x + q) = r. */
export type BalanceForm = "add" | "times" | "remove-split" | "split-remove";
type LinePlot = Extract<SemanticFigure, { kind: "line-plot" }>;
type CounterRows = Extract<SemanticFigure, { kind: "counter-rows" }>;
type BaseTenPair = Extract<SemanticFigure, { kind: "base-ten-pair" }>;
export type AnimationModel =
  | { kind: "balance"; figure: Balance; form: BalanceForm; x: number }
  | { kind: "pairing"; figure: CounterRows }
  | { kind: "place-compare"; figure: BaseTenPair }
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 }
  | { kind: "line-plot-stack"; figure: LinePlot }
  | { kind: "line-plot-share"; figure: LinePlot; share: number };
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const f = lesson.example.figure;
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
    (lesson.templateId === "line-plot-whole" ||
      lesson.templateId === "fraction-line-plot") &&
    f?.kind === "line-plot" &&
    validPlot(f)
  )
    return { kind: "line-plot-stack", figure: f };
  if (
    lesson.templateId === "fraction-plot-equal-share" &&
    f?.kind === "line-plot" &&
    validPlot(f)
  ) {
    const total = f.values.reduce((a, b) => a + b, 0);
    // The shared amount must land on a tick, and all marks must fit one stack.
    if (total % f.values.length === 0 && f.values.length <= 8)
      return {
        kind: "line-plot-share",
        figure: f,
        share: total / f.values.length,
      };
  }
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
function validPlot(f: LinePlot) {
  return (
    integer(f.start, 0, 400) &&
    integer(f.end, f.start + 1, f.start + 12) &&
    f.values.length >= 3 &&
    f.values.length <= 24 &&
    f.values.every((v) => integer(v, f.start, f.end))
  );
}
const plotted = (v: number, d: number) => {
  const whole = Math.floor(v / d),
    rest = v % d;
  if (!rest) return `${whole}`;
  let a = rest,
    b = d;
  while (b) [a, b] = [b, a % b];
  const frac = `\\tfrac{${rest / a}}{${d / a}}`;
  return whole ? `${whole}${frac}` : frac;
};
const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
export function animationFrames(model: AnimationModel) {
  if (model.kind === "balance") return balanceFrames(model);
  if (model.kind === "line-plot-stack") {
    const { values, denominator: d } = model.figure;
    const half = Math.ceil(values.length / 2);
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const n = Math.max(...counts.values());
    const tops = [...counts]
      .filter(([, c]) => c === n)
      .map(([v]) => v)
      .sort((a, b) => a - b);
    return [
      {
        title: "Draw the scale",
        text: `Mark equal spaces of ${d === 1 ? "one unit" : `1/${d} unit`} along the number line, wide enough for every measurement.`,
        math: `${values.length}\\text{ measurements}`,
      },
      {
        title: "One mark per measurement",
        text: `Place an × above each length. A repeated length stacks on top of the one below.`,
        math: `${half}\\text{ of }${values.length}\\text{ placed}`,
      },
      {
        title: "Read the stacks",
        text: `Every measurement is shown once. The tallest ${tops.length > 1 ? "stacks show the most common lengths" : "stack is the most common length"}.`,
        math: `${n}\\text{ at }${tops.map((v) => plotted(v, d)).join("\\text{ and }")}`,
      },
    ].map((f) => ({ ...f, math: `$${f.math}$` }));
  }
  if (model.kind === "line-plot-share") {
    const { values, denominator: d } = model.figure;
    const total = values.reduce((a, b) => a + b, 0);
    return [
      {
        title: "Read every amount",
        text: `${values.length} beakers, each × one beaker, measured in ${d === 2 ? "halves" : d === 4 ? "fourths" : "eighths"} of a liter.`,
        math: `$${values.length}\\text{ beakers}$`,
      },
      {
        title: "Pool the water",
        text: "Pour every beaker into one jug. The total does not change.",
        math: `$\\text{total} = \\dfrac{${total}}{${d}}$`,
      },
      {
        title: "Share it equally",
        text: "Pour the total back into the beakers so each holds the same amount. Every × moves to one value.",
        math: `$\\dfrac{${total}}{${d}} \\div ${values.length} = ${[`\\dfrac{${model.share}}{${d}}`, plotted(model.share, d).replace("tfrac", "dfrac")].filter((v, i, all) => all.indexOf(v) === i).join(" = ")}$`,
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
