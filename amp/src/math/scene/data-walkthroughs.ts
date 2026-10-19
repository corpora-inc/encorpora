import type { SemanticFigure } from "../contracts";
import { act, lessonStep, step } from "./author";
import { fiveNumbers, type DotPlot } from "./components/dot-plot";
import { sceneSchema, type Scene } from "./spec";
import type { Step } from "./timeline";

/**
 * Lesson walkthroughs for the data displays, on the example's own data.
 * Each takes the problem's figure (still a legacy data kind on the wire) and
 * returns a revealed scene with steps, or null when the figure does not fit
 * the model. These replace the bespoke data lesson animations.
 */
type LinePlot = Extract<SemanticFigure, { kind: "line-plot" }>;
type DoubleDot = Extract<SemanticFigure, { kind: "double-dot-plot" }>;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** An exact rational as TeX: 7, \tfrac{7}{2}, −\tfrac{1}{3}. */
function tex(n: number, d = 1): string {
  const g = gcd(Math.abs(n), d) || 1,
    p = n / g,
    q = d / g;
  if (q === 1) return `${p}`;
  return `${p < 0 ? "-" : ""}\\tfrac{${Math.abs(p)}}{${q}}`;
}
/** A decimal value that is a multiple of 1/d, as exact TeX. */
const texValue = (v: number, d: number) => tex(Math.round(v * d), d);
const sum = (v: readonly number[]) => v.reduce((a, b) => a + b, 0);

function plot(
  f: LinePlot,
  extra: Partial<DotPlot> = {},
): DotPlot & { type: "dotPlot" } {
  return {
    type: "dotPlot",
    id: "plot",
    min: f.start / f.denominator,
    max: f.end / f.denominator,
    ...(f.denominator > 1 ? { denominator: f.denominator } : {}),
    mark: f.mark,
    groups: [{ values: f.values.map((v) => v / f.denominator) }],
    unit: f.unit,
    ...extra,
  };
}
const build = (element: DotPlot, steps: Step[]): Scene =>
  sceneSchema.parse({ v: 1, elements: [element], steps });
/** Mark ids of the values that make the tallest stacks (at most 12). */
function tallestMarks(values: readonly number[]) {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const n = Math.max(...counts.values());
  const tops = [...counts].filter(([, c]) => c === n).map(([v]) => v);
  return {
    n,
    tops: tops.sort((a, b) => a - b),
    ids: values
      .map((v, i) => (tops.includes(v) ? `plot.group.0.mark.${i}` : ""))
      .filter(Boolean)
      .slice(0, 12),
  };
}

/** Build a line plot: the scale, one mark per measurement, the stacks. */
function stacks(f: LinePlot): Scene {
  const d = f.denominator,
    { n, tops, ids } = tallestMarks(f.values);
  return build(plot(f), [
    step(
      `Draw the scale: equal spaces of ${d === 1 ? "one unit" : `$\\tfrac{1}{${d}}$ unit`}, wide enough for every one of the ${f.values.length} measurements.`,
      act.highlight("plot.axis.0"),
    ),
    step(
      `Place one ${f.mark === "x" ? "×" : "dot"} above each measurement. A repeated length stacks on the one below.`,
      act.appear("plot.group.0.mark", true),
    ),
    step(
      `Every measurement appears once. The tallest ${tops.length > 1 ? "stacks" : "stack"}, ${n} high at ${tops.map((v) => `$${texValue(v / d, d)}$`).join(" and ")}, ${tops.length > 1 ? "are the most common lengths" : "is the most common length"}.`,
      ...ids.map((id) => act.highlight(id)),
    ),
  ]);
}

/** Pool every amount, then share the total equally. */
function share(f: LinePlot): Scene | null {
  const total = sum(f.values),
    n = f.values.length,
    d = f.denominator;
  if (total % n !== 0 || n > 8) return null;
  const each = total / n / d;
  return build(plot(f, { share: each }), [
    step(
      `Read every amount: ${n} measurements, in ${d === 2 ? "halves" : d === 4 ? "fourths" : d === 8 ? "eighths" : "whole units"}.`,
      act.highlight("plot.group.0.mark"),
    ),
    step(
      `Pool them: the total is $${tex(total, d)}$, and pooling does not change it.`,
      act.highlight("plot.group.0.mark"),
    ),
    step(
      `Share the total equally: $${tex(total, d)} \\div ${n} = ${tex(total / n, d)}$. Every mark moves to one value.`,
      act.disappear("plot.group.0.mark"),
      act.appear("plot.share", true),
    ),
  ]);
}

/** The mean as the balance point: a trial pivot tips, the mean balances. */
function balance(f: LinePlot, mad: boolean): Scene | null {
  if (f.denominator !== 1 || f.mark !== "dot") return null;
  const v = f.values,
    n = v.length,
    total = sum(v),
    mean = total / n;
  const lo = Math.min(...v),
    hi = Math.max(...v);
  const mid = Math.round((lo + hi) / 2);
  const trial = mid !== mean ? mid : mean + (hi - mean > 1 ? 1 : -1);
  // Distances to a pivot, as exact TeX (the mean may be a fraction).
  const side = (at: number, below: boolean) =>
    tex(
      v
        .filter((x) => (below ? x < at : x > at))
        .reduce((a, x) => a + Math.abs(x * n - at * n), 0),
      n,
    );
  return build(
    plot(f, {
      references: [
        { at: trial, distances: true, label: "pivot" },
        { at: mean, distances: true, label: "mean" },
      ],
    }),
    [
      step(
        `${n} values sit on the line like equal weights. Their sum is ${total}.`,
        act.highlight("plot.group.0.mark"),
      ),
      step(
        `Try a pivot at ${trial}: the distances to its left add to $${side(trial, true)}$, to its right $${side(trial, false)}$. Unequal, so it tips.`,
        act.appear("plot.ref.0"),
      ),
      lessonStep(
        mad
          ? `At the mean, $${tex(total, n)}$, both sides add to $${side(mean, true)}$. The MAD is the mean of all the distances: $\\dfrac{2 \\times ${side(mean, true)}}{${n}}$.`
          : `Balance at the mean, $${total} \\div ${n} = ${tex(total, n)}$: the distances on each side add to $${side(mean, true)}$.`,
        act.disappear("plot.ref.0"),
        act.appear("plot.ref.1"),
      ),
    ],
  );
}

/** Quartiles split the ordered dots; the box covers the middle half. */
function boxBuild(f: LinePlot): Scene | null {
  if (f.denominator !== 1 || f.mark !== "dot" || f.values.length < 4)
    return null;
  const q = fiveNumbers(f.values);
  const t = (x: number) => tex(Math.round(x * 2), 2);
  return build(plot(f, { quartiles: true, box: true }), [
    step(
      `A dot plot lists the ${f.values.length} values in order, left to right.`,
      act.highlight("plot.group.0.mark"),
    ),
    step(
      `The median splits the data in half; each half’s median is a quartile: $Q_1 = ${t(q.q1)}$, $M = ${t(q.median)}$, $Q_3 = ${t(q.q3)}$.`,
      act.appear("plot.quartile", true),
    ),
    lessonStep(
      `The box spans the middle half, from $Q_1$ to $Q_3$: $\\text{IQR} = ${t(q.q3)} - ${t(q.q1)} = ${t(q.q3 - q.q1)}$. The whiskers reach ${q.min} and ${q.max}.`,
      act.appear("plot.box"),
    ),
  ]);
}

/** Two groups with one MAD: the gap between means, laid out in MADs. */
function madGap(f: DoubleDot): Scene | null {
  const [a, b] = f.groups.map((g) => g.values) as [number[], number[]];
  const meanOf = (v: number[]) => sum(v) / v.length;
  const madOf = (v: number[]) =>
    sum(v.map((x) => Math.abs(x - meanOf(v)))) / v.length;
  const mad = madOf(a),
    [m1, m2] = [meanOf(a), meanOf(b)],
    gap = Math.abs(m1 - m2);
  if (
    !Number.isInteger(mad) ||
    mad < 1 ||
    madOf(b) !== mad ||
    !Number.isInteger((2 * gap) / mad) ||
    gap === 0
  )
    return null;
  const [g1, g2] = f.groups;
  return build(
    {
      type: "dotPlot",
      id: "plot",
      min: f.start,
      max: f.end,
      mark: "dot",
      groups: f.groups.map((g) => ({ label: g.label, values: g.values })),
      unit: f.unit,
      references: [
        { at: m1, group: 0, label: "mean" },
        { at: m2, group: 1, label: "mean" },
      ],
      bricks: { from: Math.min(m1, m2), to: Math.max(m1, m2), size: mad },
    },
    [
      step(
        `${g1!.label} and ${g2!.label} share one scale, so equal values line up. Both have a MAD of ${mad}.`,
        act.highlight("plot.group.0.mark"),
        act.highlight("plot.group.1.mark"),
      ),
      step(
        `Find each mean: ${g1!.label} $${sum(a)} \\div ${a.length} = ${tex(sum(a), a.length)}$, ${g2!.label} $${sum(b)} \\div ${b.length} = ${tex(sum(b), b.length)}$.`,
        act.appear("plot.ref"),
      ),
      lessonStep(
        `Lay MADs across the gap: $${tex(gap * 2, 2)} \\div ${mad} = ${tex((gap * 2) / mad, 2)}$ MADs. The more MADs between the means, the less the groups overlap.`,
        act.appear("plot.brick", true),
      ),
    ],
  );
}

/** The walkthrough for a problem type's example figure, if it has one. */
export function dataWalkthrough(
  templateId: string,
  figure: SemanticFigure | undefined,
): Scene | null {
  if (figure?.kind === "line-plot") {
    switch (templateId) {
      case "line-plot-whole":
      case "fraction-line-plot":
        return stacks(figure);
      case "fraction-plot-equal-share":
        return share(figure);
      case "dot-plot-mean":
        return balance(figure, false);
      case "dot-plot-mad":
        return balance(figure, true);
      case "dot-plot-iqr":
        return boxBuild(figure);
    }
  }
  if (figure?.kind === "double-dot-plot" && templateId === "means-in-mads")
    return madGap(figure);
  return null;
}
