import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type Shapes = Extract<SemanticFigure, { kind: "partitioned-shapes" }>;
type Area = Extract<SemanticFigure, { kind: "area-partition" }>;
/** One shape cut into n equal parts, k of them shaded. */
export type PartitionAnimation = {
  kind: "partition";
  shape: Shapes["shapes"][number];
};
/** Two fractions of one whole, a/b and c/d, with unequal values. */
export type CompareAnimation = {
  kind: "compare";
  bars: [{ n: number; d: number }, { n: number; d: number }];
};
/** Equal-area grid regions; one region is the highlighted part. */
export type AreaAnimation = { kind: "area"; figure: Area };
type LinePlot = Extract<SemanticFigure, { kind: "line-plot" }>;
type CounterRows = Extract<SemanticFigure, { kind: "counter-rows" }>;
type BaseTenPair = Extract<SemanticFigure, { kind: "base-ten-pair" }>;
type TenFramePair = Extract<SemanticFigure, { kind: "ten-frame-pair" }>;
export type AnimationModel =
  | { kind: "make-ten"; figure: TenFramePair }
  | PartitionAnimation
  | CompareAnimation
  | AreaAnimation
  | { kind: "pairing"; figure: CounterRows }
  | { kind: "place-compare"; figure: BaseTenPair }
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 }
  | { kind: "line-plot-stack"; figure: LinePlot }
  | { kind: "line-plot-share"; figure: LinePlot; share: number }
  | { kind: "mean-balance"; figure: LinePlot; mad: boolean; trial: number }
  | { kind: "box-build"; figure: LinePlot };
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const f = lesson.example.figure;
  if (
    (lesson.templateId === "dot-plot-mean" ||
      lesson.templateId === "dot-plot-mad") &&
    f?.kind === "line-plot" &&
    f.mark === "dot" &&
    f.denominator === 1 &&
    validPlot(f)
  ) {
    const mean = f.values.reduce((a, b) => a + b, 0) / f.values.length;
    const lo = Math.min(...f.values),
      hi = Math.max(...f.values);
    // A trial pivot that is not the mean: the middle of the range, or beside it.
    const mid = (lo + hi) / 2;
    const trial = mid !== mean ? mid : mean + (hi - mean > 1 ? 1 : -1);
    return {
      kind: "mean-balance",
      figure: f,
      mad: lesson.templateId === "dot-plot-mad",
      trial,
    };
  }
  if (
    lesson.templateId === "dot-plot-iqr" &&
    f?.kind === "line-plot" &&
    f.mark === "dot" &&
    f.denominator === 1 &&
    validPlot(f) &&
    f.values.length >= 4
  )
    return { kind: "box-build", figure: f };
  if (
    lesson.templateId === "make-ten-fact" &&
    f?.kind === "ten-frame-pair" &&
    integer(f.first, 1, 9) &&
    integer(f.second, 1, 9) &&
    f.first + f.second > 10
  )
    return { kind: "make-ten", figure: f };
  if (
    (lesson.templateId === "name-equal-share" ||
      lesson.templateId === "name-share") &&
    f?.kind === "partitioned-shapes" &&
    f.shapes.length === 1
  ) {
    const shape = f.shapes[0]!,
      n = shape.sizes.length;
    if (
      integer(n, 2, 4) &&
      shape.sizes.every((w) => w === shape.sizes[0]) &&
      shape.shaded.length >= 1 &&
      shape.shaded.every((i) => integer(i, 0, n - 1))
    )
      return { kind: "partition", shape };
  }
  if (
    (lesson.templateId === "compare-like-denominators" ||
      lesson.templateId === "compare-like-numerators" ||
      lesson.templateId === "compare-unlike-fractions") &&
    f?.kind === "fraction-bars" &&
    f.bars.length === 2
  ) {
    const bars = f.bars.map((bar) => {
      const m = /^(\d+)\/(\d+)$/.exec(bar.label);
      return m && Number(m[2]) === bar.parts
        ? { n: Number(m[1]), d: bar.parts }
        : null;
    });
    const [a, b] = bars;
    if (
      a &&
      b &&
      integer(a.d, 1, 12) &&
      integer(b.d, 1, 12) &&
      integer(a.n, 0, a.d) &&
      integer(b.n, 0, b.d) &&
      a.n * b.d !== b.n * a.d
    )
      return { kind: "compare", bars: [a, b] };
  }
  if (
    (lesson.templateId === "equal-area-fraction" ||
      lesson.templateId === "equal-area-part-size") &&
    f?.kind === "area-partition" &&
    f.shaded.length === 1
  ) {
    const count = Math.max(...f.regions) + 1,
      size = f.regions.filter((r) => r === 0).length;
    if (
      integer(count, 2, 12) &&
      f.regions.length === f.columns * f.rows &&
      Array.from(
        { length: count },
        (_, r) => f.regions.filter((x) => x === r).length,
      ).every((c) => c === size)
    )
      return { kind: "area", figure: f };
  }
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
  return null;
}
const WORDS = ["zero", "one", "two", "three", "four"];
const UNIT: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
};
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
/** Quartiles by the median-of-halves convention (overall median left out for odd counts). */
export function fiveNumbers(values: readonly number[]) {
  const xs = [...values].sort((a, b) => a - b),
    n = xs.length;
  const median = (v: number[]) => {
    const k = Math.floor(v.length / 2);
    return v.length % 2 ? v[k]! : (v[k - 1]! + v[k]!) / 2;
  };
  return {
    min: xs[0]!,
    q1: median(xs.slice(0, Math.floor(n / 2))),
    median: median(xs),
    q3: median(xs.slice(Math.ceil(n / 2))),
    max: xs[n - 1]!,
  };
}
const num = (v: number) => (Number.isInteger(v) ? `${v}` : v.toFixed(1));

export function animationFrames(model: AnimationModel) {
  if (model.kind === "mean-balance") {
    const { values } = model.figure,
      n = values.length,
      sum = values.reduce((a, b) => a + b, 0),
      mean = sum / n;
    const below = values
      .filter((v) => v < mean)
      .reduce((a, v) => a + (mean - v), 0);
    const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
    const frac = (p: number, q: number) => {
      const k = g(Math.abs(p), q);
      return q / k === 1
        ? { tex: `${p / k}`, text: `${p / k}` }
        : {
            tex: `\\tfrac{${p / k}}{${q / k}}`,
            text: `${p / k}/${q / k}`,
          };
    };
    const belowText = frac(Math.round(below * n), n);
    return [
      {
        title: "Put the dots on a beam",
        text: `${n} values sit on the number line like equal weights.`,
        math: `$\\text{sum} = ${sum}$`,
      },
      {
        title: "Try a pivot",
        text: `With the pivot at ${num(model.trial)}, the beam tips: one side carries more total distance.`,
        math: `$\\text{pivot} = ${num(model.trial)}$`,
      },
      model.mad
        ? {
            title: "Balance, then measure the spread",
            text: `The beam balances at the mean. The distances below it equal the distances above it, ${belowText.text} each side. The MAD is the mean of all the distances.`,
            math: `$\\text{MAD} = \\dfrac{2 \\times ${belowText.tex}}{${n}}$`,
          }
        : {
            title: "Balance at the mean",
            text: `The beam balances at ${frac(sum, n).text}: the distances below it add up to the distances above it.`,
            math: `$${sum} \\div ${n} = ${frac(sum, n).tex}$`,
          },
    ];
  }
  if (model.kind === "box-build") {
    const q = fiveNumbers(model.figure.values);
    return [
      {
        title: "The ordered data",
        text: "A dot plot already lists the values in order, left to right.",
        math: `$${model.figure.values.length}\\text{ values}$`,
      },
      {
        title: "Split at the median, then split each half",
        text: "The median cuts the data into halves; each half’s median is a quartile.",
        math: `$Q_1 = ${num(q.q1)},\\; \\text{median} = ${num(q.median)},\\; Q_3 = ${num(q.q3)}$`,
      },
      {
        title: "Draw the box",
        text: "The box spans the middle half of the data, from Q1 to Q3; the whiskers reach the least and greatest values.",
        math: `$\\text{IQR} = ${num(q.q3)} - ${num(q.q1)} = ${num(q.q3 - q.q1)}$`,
      },
    ];
  }
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
  if (model.kind === "partition") {
    const n = model.shape.sizes.length,
      k = model.shape.shaded.length;
    const name = `${WORDS[k]} ${UNIT[n]![k === 1 ? 0 : 1]}`;
    return [
      {
        title: "Start with one whole",
        text: `The whole ${model.shape.shape} is the thing being shared.`,
        math: "$1$ whole",
      },
      {
        title: "Cut it into equal parts",
        text: `${WORDS[n]![0]!.toUpperCase()}${WORDS[n]!.slice(1)} equal parts make the whole, so each part is one ${UNIT[n]![0]}.`,
        math: `$${n} \\times \\dfrac{1}{${n}} = 1$`,
      },
      {
        title: "Count the shaded parts",
        text: `${WORDS[k]![0]!.toUpperCase()}${WORDS[k]!.slice(1)} of the ${WORDS[n]} equal parts ${k === 1 ? "is" : "are"} shaded: ${name}.`,
        math: `$\\dfrac{${k}}{${n}}$`,
      },
    ];
  }
  if (model.kind === "compare") {
    const [a, b] = model.bars;
    const sign = a.n * b.d > b.n * a.d ? ">" : "<";
    const f = (x: { n: number; d: number }) => `\\dfrac{${x.n}}{${x.d}}`;
    return [
      {
        title: "Use one whole",
        text: "Both bars are the same length: each is one whole.",
        math: "$1 = 1$",
      },
      {
        title: "Cut each whole equally",
        text:
          a.d === b.d
            ? `Both wholes are cut into ${a.d} equal pieces, so the pieces are the same size.`
            : `Top: ${a.d} equal pieces. Bottom: ${b.d}. More pieces in the same whole means smaller pieces.`,
        math: `$\\dfrac{1}{${a.d}}${a.d === b.d ? "=" : a.d < b.d ? ">" : "<"}\\dfrac{1}{${b.d}}$`,
      },
      {
        title: "Shade and line up",
        text: "The shaded lengths start at the same place. The longer one is the greater fraction.",
        math: `$${f(a)} ${sign} ${f(b)}$`,
      },
    ];
  }
  if (model.kind === "area") {
    const f = model.figure,
      cells = f.columns * f.rows,
      count = Math.max(...f.regions) + 1;
    return [
      {
        title: "Measure the whole",
        text: `The rectangle covers ${f.columns} × ${f.rows} unit squares.`,
        math: `$${f.columns} \\times ${f.rows} = ${cells}$`,
      },
      {
        title: "Split into equal areas",
        text: `${count} parts of ${cells / count} squares each. Their shapes differ; their areas match.`,
        math: `$${count} \\times ${cells / count} = ${cells}$`,
      },
      {
        title: "Name one part",
        text: `The shaded part is one of ${count} equal shares of the area.`,
        math: `$\\dfrac{${cells / count}}{${cells}} = \\dfrac{1}{${count}}$`,
      },
    ];
  }
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
