import type { ProblemLessonView } from "../../content/problem-lessons";
import type { SemanticFigure } from "../../math/contracts";

type Fraction = Extract<SemanticFigure, { kind: "fraction" }>;
type ArrayFigure = Extract<SemanticFigure, { kind: "unit-array" }>;
type Exchange = Extract<SemanticFigure, { kind: "base-ten" }>;
type Display = Extract<SemanticFigure, { kind: "function-display" }>;
export type PlotRule = {
  x: string;
  y: string;
  /** y = k × x (offset 0) or y = x + offset (k 1). */
  k: number;
  offset: number;
};
export type AnimationModel =
  | {
      kind: "plot";
      rows: { x: number; y: number }[];
      graph: NonNullable<Display["graph"]>;
      rule: PlotRule;
    }
  | { kind: "fraction"; figure: Fraction }
  | { kind: "array"; figure: ArrayFigure & { splitAfterRow: number } }
  | { kind: "exchange"; figure: Exchange; unit: 1 | 10 };
const integer = (n: number, min: number, max: number) =>
  Number.isInteger(n) && n >= min && n <= max;

/** The variable a column names: "d (miles)" → d, "Pattern B" → B. */
const variable = (label: string) =>
  /^([A-Za-z]) \(/.exec(label)?.[1] ?? label.split(" ").at(-1)!;
/** A proportional or constant-difference rule that every row obeys, if any. */
function plotRule(f: Display): PlotRule | null {
  const t = f.table,
    g = f.graph;
  if (!t || !g || g.series.length !== 1) return null;
  const rows = t.rows;
  if (rows.length < 2 || rows.length > 6) return null;
  const points = g.series[0]!.points;
  if (
    points.length !== rows.length ||
    points.some((p, i) => p.x !== rows[i]!.x || p.y !== rows[i]!.y) ||
    rows.some((r) => r.x < 0 || r.y < 0 || r.x > g.xMax || r.y > g.yMax)
  )
    return null;
  const x = variable(t.columns[0]),
    y = variable(t.columns[1]);
  const base = rows.find((r) => r.x !== 0);
  if (!base) return null;
  const k = base.y / base.x;
  if (Number.isInteger(k) && k > 1 && rows.every((r) => r.y === k * r.x))
    return { x, y, k, offset: 0 };
  const offset = rows[0]!.y - rows[0]!.x;
  if (offset > 0 && rows.every((r) => r.y - r.x === offset))
    return { x, y, k: 1, offset };
  return null;
}

/** Only compatible semantic figures opt in. No prompt parsing or answer access. */
export function animationModel(
  lesson: ProblemLessonView,
): AnimationModel | null {
  const f = lesson.example.figure;
  if (
    (lesson.templateId === "related-patterns-relationship" ||
      lesson.templateId === "dependent-variable-equation") &&
    f?.kind === "function-display"
  ) {
    const rule = plotRule(f);
    return rule
      ? { kind: "plot", rows: f.table!.rows, graph: f.graph!, rule }
      : null;
  }
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
export function animationFrames(model: AnimationModel) {
  if (model.kind === "plot") {
    const { rows, rule } = model;
    const first = rows.find((r) => r.x !== 0) ?? rows[0]!;
    const pairs = rows.map((r) => `(${r.x}, ${r.y})`).join(",\\ ");
    const equation =
      rule.offset === 0
        ? `${rule.y} = ${rule.k}${rule.x}`
        : `${rule.y} = ${rule.x} + ${rule.offset}`;
    return [
      {
        title: "Read the pairs",
        text: `Each row of the table matches a value of ${rule.x} with the value of ${rule.y} that goes with it.`,
        math: `$${pairs}$`,
      },
      {
        title: "Plot each pair",
        text: `Each pair becomes one point: across to the value of ${rule.x}, then up to the value of ${rule.y}. For (${first.x}, ${first.y}): ${first.x} across, ${first.y} up.`,
        math: `$(${rule.x}, ${rule.y}) \\to$ point`,
      },
      {
        title: "Read the rule",
        text:
          rule.offset === 0
            ? `The points lie on one straight line through (0, 0): every ${rule.y} is ${rule.k} times its ${rule.x}, as in ${first.y} = ${rule.k} × ${first.x}.`
            : `The points lie on one straight line: every ${rule.y} is ${rule.offset} more than its ${rule.x}, as in ${first.y} = ${first.x} + ${rule.offset}.`,
        math: `$${equation}$`,
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
