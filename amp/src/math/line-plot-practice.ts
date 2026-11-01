import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { MAX_STACK, mixedText, stackHeights } from "./data-display-models.js";

/** Line plots of measurements, from whole units to fraction operations (grades 2–5). */
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
export const linePlotTemplates: readonly TemplateMetadata[] = [
  {
    id: "line-plot-whole",
    version: 1,
    ...charts,
    title: "Read a line plot",
    skillId: "line-plots",
    gradeBand: "K–2",
    description:
      "Read whole-unit length measurements from a line plot: one length, longer than, how many in all, and longest minus shortest.",
  },
  {
    id: "fraction-line-plot",
    version: 1,
    ...charts,
    title: "Line plots with halves and fourths",
    skillId: "fraction-line-plots",
    gradeBand: "3–5",
    description:
      "Count measurements at or beyond a half- or quarter-unit length on a line plot.",
  },
  {
    id: "fraction-plot-difference",
    version: 1,
    ...charts,
    title: "Add and subtract from a line plot",
    skillId: "fraction-plot-arithmetic",
    gradeBand: "3–5",
    description:
      "Add or subtract like fractions read from a fourths or eighths line plot.",
  },
  {
    id: "fraction-plot-equal-share",
    version: 1,
    ...charts,
    title: "Share the total equally",
    skillId: "fraction-plot-computation",
    gradeBand: "3–5",
    description:
      "Find the equal share when every amount on a fractional line plot is pooled and redistributed.",
  },
];

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
}
type Random = ReturnType<typeof random>;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Exact answer text: a reduced fraction or a whole number. */
function rational(n: number, d: number) {
  const g = gcd(Math.abs(n), d) || 1;
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
}
/** "3/4 inch", "1 inch", "2 1/4 inches": singular only up to one unit. */
const measure = (v: number, d: number, one: string, many: string) =>
  `${mixedText(v, d)} ${v <= d ? one : many}`;
/** Improper and mixed forms together, e.g. "9/4 (2 1/4)". */
const both = (v: number, d: number) => {
  const r = rational(v, d);
  return r.includes("/") && v > d ? `${r} (${mixedText(v, d)})` : r;
};

const parts = (d: number) =>
  ({ 2: "halves", 4: "fourths", 8: "eighths" })[d] ?? `${d}ths`;
/** "16/8 = 2 inches": the value in parts, its simplest form, and an agreeing unit. */
const result = (v: number, d: number, one: string, many: string) =>
  `${v}/${d}${rational(v, d) !== `${v}/${d}` ? ` = ${both(v, d)}` : ""} ${v <= d ? one : many}`;
/** The simplest answer with its unit: "1 inch", "1 1/4 inches", "3/4 liter". */
const measure2 = (v: number, d: number, one: string, many: string) => {
  const r = rational(v, d);
  const text = r.includes("/") && v > d ? mixedText(v, d) : r;
  return `${text} ${v <= d ? one : many}`;
};
const lengthContexts = [
  { item: "pencil", items: "pencils" },
  { item: "leaf", items: "leaves" },
  { item: "shell", items: "shells" },
  { item: "ribbon", items: "ribbons" },
  { item: "feather", items: "feathers" },
] as const;
const units = {
  in: { one: "inch", many: "inches" },
  cm: { one: "centimeter", many: "centimeters" },
} as const;

function sample(r: Random, count: number, lo: number, hi: number) {
  let values: number[];
  do values = Array.from({ length: count }, () => r(lo, hi));
  while (
    Math.max(...stackHeights(values).values()) > MAX_STACK ||
    new Set(values).size < 3
  );
  return values;
}

type Draft = {
  prompt: string;
  figure: SemanticFigure;
  answer: string;
  fraction: boolean;
  hint: string;
  explanation: string[];
};

function countQuestion(
  r: Random,
  d: 1 | 2 | 4,
  values: number[],
  start: number,
  end: number,
  context: (typeof lengthContexts)[number],
  unit: { one: string; many: string },
  intro: string,
  allowSpread: boolean,
): Draft {
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start,
    end,
    values,
    mark: "x",
    unit: unit.many,
  };
  const heights = stackHeights(values);
  const sorted = [...values].sort((a, b) => a - b);
  const name = (v: number) => measure(v, d, unit.one, unit.many);
  const question = r(0, allowSpread ? 3 : 2);
  if (question === 0) {
    const plotted = [...heights.keys()];
    const v = plotted[r(0, plotted.length - 1)]!,
      n = heights.get(v)!;
    return {
      prompt: `${intro} How many ${context.items} are ${name(v)} long?`,
      figure,
      answer: `${n}`,
      fraction: false,
      hint: `Find ${mixedText(v, d)} on the number line. Each × above it is one ${context.item}.`,
      explanation: [
        `A line plot puts one mark (×) above the number line for each ${context.item}, at its length.`,
        `So the marks above ${mixedText(v, d)} show the ${context.items} of that length. Count only that column.`,
        `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} above ${mixedText(v, d)}.`,
        `${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} ${name(v)} long.`,
      ],
    };
  }
  if (question === 1) {
    let v: number;
    do v = r(sorted[0]!, sorted.at(-1)! - 1);
    while (!values.some((x) => x > v));
    const longer = [...heights]
      .filter(([x]) => x > v)
      .sort((a, b) => a[0] - b[0]);
    const n = longer.reduce((s, [, c]) => s + c, 0);
    return {
      prompt: `${intro} How many ${context.items} are longer than ${name(v)}?`,
      figure,
      answer: `${n}`,
      fraction: false,
      hint: `Look only to the right of ${mixedText(v, d)}, not at ${mixedText(v, d)} itself. Count every mark there.`,
      explanation: [
        `Each mark (×) is one ${context.item}, placed above its length. Lengths grow to the right.`,
        `“Longer than ${mixedText(v, d)}” means to the right of ${mixedText(v, d)}. Marks exactly at ${mixedText(v, d)} do not count, because they are not longer.`,
        `To the right of ${mixedText(v, d)}: ${longer.map(([x, c]) => `${c} at ${mixedText(x, d)}`).join(", ")}.`,
        longer.length > 1
          ? `Add the columns: ${longer.map(([, c]) => c).join(" + ")} = ${n}. So ${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} longer than ${name(v)}.`
          : `So ${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} longer than ${name(v)}.`,
      ],
    };
  }
  if (question === 2) {
    const columns = [...heights].sort((a, b) => a[0] - b[0]);
    return {
      prompt: `${intro} How many ${context.items} were measured?`,
      figure,
      answer: `${values.length}`,
      fraction: false,
      hint: `Every × is one measured ${context.item}. Count the marks in each of the ${columns.length} columns, starting above ${mixedText(columns[0]![0], d)}, then add the columns.`,
      explanation: [
        `Each mark (×) on a line plot is one measured ${context.item}, so count every mark.`,
        `Count each column: ${columns.map(([x, c]) => `${c} at ${mixedText(x, d)}`).join(", ")}.`,
        `Add the columns: ${columns.map(([, c]) => c).join(" + ")} = ${values.length}.`,
        `${values.length} ${context.items} were measured.`,
      ],
    };
  }
  const longest = sorted.at(-1)!,
    shortest = sorted[0]!;
  return {
    prompt: `${intro} How many ${unit.many} longer is the longest ${context.item} than the shortest?`,
    figure,
    answer: `${longest - shortest}`,
    fraction: false,
    hint: `The longest ${context.item} is the rightmost mark and the shortest is the leftmost. Read both lengths and subtract, in ${unit.many}.`,
    explanation: [
      `Lengths grow to the right, so the rightmost mark is the longest ${context.item} and the leftmost is the shortest.`,
      `The longest is ${name(longest)}; the shortest is ${name(shortest)}.`,
      `"How many longer" asks for the difference, so subtract: ${longest} − ${shortest} = ${longest - shortest}.`,
      `The longest ${context.item} is ${longest - shortest} ${longest - shortest === 1 ? unit.one : unit.many} longer than the shortest.`,
    ],
  };
}

function wholePlot(r: Random): Draft {
  const context = lengthContexts[r(0, lengthContexts.length - 1)]!;
  const unit = r(0, 1) ? units.in : units.cm;
  const start = r(2, 8),
    end = start + r(6, 10);
  const values = sample(r, r(8, 14), start + 1, end - 1);
  return countQuestion(
    r,
    1,
    values,
    start,
    end,
    context,
    unit,
    `The line plot shows the lengths of some ${context.items}, measured to the nearest ${unit.one}.`,
    true,
  );
}

function fractionPlot(r: Random): Draft {
  const context = lengthContexts[r(0, lengthContexts.length - 1)]!;
  const d = r(0, 1) ? 4 : 2;
  const wholes = d === 4 ? 2 : 3,
    first = r(0, 3);
  const start = first * d,
    end = (first + wholes) * d;
  const values = sample(r, r(8, 14), Math.max(start, 1), end);
  return countQuestion(
    r,
    d,
    values,
    start,
    end,
    context,
    units.in,
    `The line plot shows the lengths of some ${context.items}, measured to the nearest ${d === 4 ? "quarter" : "half"} inch.`,
    false,
  );
}

function plotDifference(r: Random): Draft {
  const context = lengthContexts[r(0, lengthContexts.length - 1)]!;
  const d = r(0, 1) ? 8 : 4;
  const first = r(0, d === 8 ? 2 : 3),
    start = first * d,
    end = start + 8;
  const values = sample(r, r(6, 12), Math.max(start, 1), end);
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start,
    end,
    values,
    mark: "x",
    unit: "inches",
  };
  const intro = `The line plot shows the lengths of some ${context.items}, measured to the nearest ${d === 8 ? "eighth" : "quarter"} inch.`;
  const sorted = [...values].sort((a, b) => a - b);
  const longest = sorted.at(-1)!,
    shortest = sorted[0]!;
  const f = (v: number) => `${v}/${d}`;
  const lead = `The rightmost mark is the longest ${context.item} and the leftmost is the shortest. Write both in ${parts(d)}, so the pieces are the same size.`;
  const read = `The longest is ${mixedText(longest, d)} = ${f(longest)} inches; the shortest is ${mixedText(shortest, d)} = ${f(shortest)} inch${shortest > d ? "es" : ""}.`;
  const question = r(0, 2);
  if (question === 0)
    return {
      prompt: `${intro} What is the difference in length between the longest and shortest ${context.item}, in inches?`,
      figure,
      answer: rational(longest - shortest, d),
      fraction: true,
      hint: `Write both lengths as ${parts(d)}. Subtract the numerators; the size of the parts stays ${parts(d)}.`,
      explanation: [
        lead,
        read,
        `The difference is what is left after subtracting. With same-size pieces, subtract the top numbers: ${f(longest)} − ${f(shortest)} = ${result(longest - shortest, d, "inch", "inches")}.`,
        `The difference in length is ${measure2(longest - shortest, d, "inch", "inches")}.`,
      ],
    };
  if (question === 1)
    return {
      prompt: `${intro} What is the combined length of the longest and shortest ${context.item}, in inches?`,
      figure,
      answer: rational(longest + shortest, d),
      fraction: true,
      hint: `Write both lengths as ${parts(d)} and add the numerators. The parts are still ${parts(d)}.`,
      explanation: [
        lead,
        read,
        `Combined means added together. With same-size pieces, add the top numbers: ${f(longest)} + ${f(shortest)} = ${result(longest + shortest, d, "inch", "inches")}.`,
        `The combined length is ${measure2(longest + shortest, d, "inch", "inches")}.`,
      ],
    };
  const heights = stackHeights(values);
  const stacked = [...heights].filter(([, c]) => c > 1);
  const [v, n] = stacked.length
    ? stacked[r(0, stacked.length - 1)]!
    : [...heights][0]!;
  const total = v * n;
  return {
    prompt: `${intro} What is the total length of all the ${context.items} that are ${measure(v, d, "inch", "inches")} long, in inches?`,
    figure,
    answer: rational(total, d),
    fraction: true,
    hint: `Count the marks above ${mixedText(v, d)}. Add that length once for each mark, or multiply.`,
    explanation: [
      `Each mark (×) is one ${context.item}. The marks above ${mixedText(v, d)} show the ${context.items} of that length.`,
      `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} above ${mixedText(v, d)} = ${f(v)}.`,
      `Add that length once for each mark. That is the same as multiplying: ${n} × ${f(v)} = ${result(total, d, "inch", "inches")}.`,
      `Their total length is ${measure2(total, d, "inch", "inches")}.`,
    ],
  };
}

function equalShare(r: Random): Draft {
  const d = ([2, 4, 8] as const)[r(0, 2)]!;
  const count = [4, 5, 6, 8][r(0, 3)]!;
  let values: number[];
  do values = sample(r, count, 1, d * (d === 8 ? 1 : 2));
  while (values.reduce((a, b) => a + b, 0) % count !== 0);
  const sum = values.reduce((a, b) => a + b, 0),
    share = sum / count;
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start: 0,
    end: d === 8 ? 8 : 2 * d,
    values,
    mark: "x",
    unit: "liters",
  };
  const columns = [...stackHeights(values)].sort((a, b) => a[0] - b[0]);
  const f = (v: number) => `${v}/${d}`;
  return {
    prompt: `The line plot shows the amount of water in ${count} identical beakers. If all the water were shared equally among the beakers, how many liters would each beaker hold?`,
    figure,
    answer: rational(share, d),
    fraction: true,
    hint: `Two steps: add every amount to find the total water, then divide the total by the ${count} beakers.`,
    explanation: [
      `Sharing equally means: put all the water together, then split it into ${count} equal amounts.`,
      `First find the total. Each mark is one beaker, so add each amount once per mark, in ${parts(d)} of a liter: ${columns.map(([v, c]) => `${c} × ${f(v)}`).join(" + ")} = ${result(sum, d, "liter", "liters")}.`,
      `Then split the total among ${count} beakers: ${f(sum)} ÷ ${count} = ${result(share, d, "liter", "liters")}.`,
      `Check: the equal share lies between the least and greatest amounts.`,
      `Each beaker would hold ${measure2(share, d, "liter", "liters")}.`,
    ],
  };
}

export function generateLinePlotProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = linePlotTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown line-plot template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const draft =
    templateId === "line-plot-whole"
      ? wholePlot(r)
      : templateId === "fraction-line-plot"
        ? fractionPlot(r)
        : templateId === "fraction-plot-difference"
          ? plotDifference(r)
          : equalShare(r);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: draft.prompt,
      skillId: meta.skillId,
      response: draft.fraction
        ? {
            kind: "fraction",
            label: "Answer (fraction, decimal, or whole number)",
          }
        : { kind: "number", label: "Answer" },
      figure: draft.figure,
    },
    answer: draft.answer,
    explanation: draft.explanation,
    hint: draft.hint,
  };
}
