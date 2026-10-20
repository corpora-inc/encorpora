import { act, graph, lessonStep, rowBars, scene, step } from "./scene/author";
import type { Point, Scene } from "./scene/spec";

/** Browser-safe scene models and statistics for the Algebra 1 statistics
 * family: shared by its generator (algebra-statistics-practice.ts) and its
 * lesson illustrations. */
export const sum = (v: readonly number[]) => v.reduce((a, b) => a + b, 0);
export const mean = (v: readonly number[]) => sum(v) / v.length;
export const median = (v: readonly number[]) => {
  const s = [...v].sort((a, b) => a - b),
    k = Math.floor(s.length / 2);
  return s.length % 2 ? s[k]! : (s[k - 1]! + s[k]!) / 2;
};
export const clean = (v: number) => {
  const r = Math.round(v * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
};
/** A value as prose: "−2.5". */
export const d = (v: number) => String(clean(v)).replace("-", "−");
/** A value inside TeX: "-2.5". */
export const t = (v: number) => String(clean(v));
/** Pearson r. */
export function correlation(points: readonly Point[]) {
  const mx = mean(points.map((p) => p[0])),
    my = mean(points.map((p) => p[1]));
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}
/** Least squares: slope and intercept. */
export function leastSquares(points: readonly Point[]) {
  const mx = mean(points.map((p) => p[0])),
    my = mean(points.map((p) => p[1]));
  let sxy = 0,
    sxx = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  const m = sxy / sxx;
  return { m, b: my - m * mx };
}
export type Axis = { label: string; start: number; end: number; step: number };
/** A landscape data graph: 0.72 as tall as wide. */
/** Screen units per y unit, relative to x: 0.72 as tall as wide. */
const dataAspect = (x: Axis, y: Axis) =>
  Math.max(0.05, (0.72 * (x.end - x.start)) / (y.end - y.start));
export function dataGraph(x: Axis, y: Axis, id = "g") {
  return graph({
    id,
    x: [x.start, x.end],
    y: [y.start, y.end],
    grid: [x.step, y.step],
    tick: [x.step, y.step],
    axisNames: [x.label, y.label],
    aspect: dataAspect(x, y),
  });
}
export const inside = (a: Axis, v: number, margin = 0) =>
  v >= a.start + margin && v <= a.end - margin;

/** The dot plot with the mean as a sliding guide and the median as the
 * middle dot (or two), as one value leaves, joins or is corrected: the
 * lesson model for outliers. The mean moves with every value; the middle of
 * the order barely shifts. */
export function outlierWalkthrough(
  values: number[],
  unit: string,
  change:
    | { kind: "remove"; index: number }
    | { kind: "add"; index: number }
    | { kind: "typo"; index: number; fixed: number },
): Scene {
  const shown =
    change.kind === "typo" ? [...values, change.fixed] : [...values];
  const all = values.map((_, i) => i);
  const beforeIdx =
    change.kind === "add" ? all.filter((i) => i !== change.index) : all;
  const afterIdx =
    change.kind === "remove"
      ? all.filter((i) => i !== change.index)
      : change.kind === "add"
        ? all
        : [...all.filter((i) => i !== change.index), values.length];
  const at = (idx: number[]) => idx.map((i) => shown[i]!);
  const [m0, m1, d0, d1] = [
    mean(at(beforeIdx)),
    mean(at(afterIdx)),
    median(at(beforeIdx)),
    median(at(afterIdx)),
  ];
  const mark = (i: number) => `plot.group.0.mark.${i}`;
  /** The middle mark, or the two middle marks, of a set of values. */
  const middles = (idx: number[]) => {
    const sorted = [...idx].sort((a, b) => shown[a]! - shown[b]! || a - b);
    const k = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? [sorted[k]!] : [sorted[k - 1]!, sorted[k]!];
  };
  const odd = values[change.index]!;
  const what =
    change.kind === "remove"
      ? `Remove ${d(odd)}`
      : change.kind === "add"
        ? `Add ${d(odd)}`
        : `Correct ${d(odd)} to ${d(change.fixed)}`;
  return scene({
    type: "dotPlot",
    id: "plot",
    min: 0,
    max: 24,
    mark: "dot",
    groups: [{ values: shown }],
    unit,
    references: [{ at: m0, label: "mean" }],
  }).build({
    maxHeight: 720,
    steps: [
      step(
        `Before: the mean, the balance point, is ${d(m0)}. The median, the middle of the order, is ${d(d0)}.`,
        act.appear("plot.ref.0"),
        ...middles(beforeIdx).map((i) => act.highlight(mark(i))),
      ),
      lessonStep(
        `${what}: the mean slides to ${d(m1)}, but the median ${d1 === d0 ? "stays at" : "moves only to"} ${d(d1)}.`,
        act.move("plot.ref.0", [m1 - m0, 0]),
        ...(change.kind === "remove"
          ? [act.disappear(mark(change.index))]
          : change.kind === "add"
            ? [act.appear(mark(change.index))]
            : [
                act.disappear(mark(change.index)),
                act.appear(mark(values.length)),
              ]),
        ...middles(afterIdx).map((i) => act.highlight(mark(i))),
      ),
    ],
  });
}

/** Rows (or columns) of a table as bars, re-normalized to 100%: the lesson
 * model for conditional relative frequency. */
export function conditionalBars(
  labels: readonly [string, string],
  parts: readonly [string, string],
  counts: [[number, number], [number, number]],
  caption: [string, string],
): Scene {
  return rowBars({
    id: "bars",
    parts: [...parts],
    rows: labels.map((label, i) => ({ label, counts: counts[i]! })),
  }).scene({
    steps: [
      step(caption[0], act.appear("bars.legend"), act.appear("bars.count")),
      lessonStep(caption[1], act.appear("bars.percent", true)),
    ],
  });
}
/** The scatter with every residual stick dropping from its point to the line. */
export function residualSticks(
  f: { c: { x: Axis; y: Axis }; m: number; b: number; points: Point[] },
  captions: [string, string],
  focus: number,
): Scene {
  return dataGraph(f.c.x, f.c.y)
    .scatter(f.points, { m: f.m, b: f.b }, true)
    .scene({
      steps: [
        step(captions[0], act.trace("g.residual")),
        lessonStep(
          captions[1],
          act.highlight(`g.residual.${focus}`),
          act.highlight(`g.scatter.${focus}`),
        ),
      ],
    });
}

/** Points sliding halfway to the fitted line: the correlation strengthens. */
export function tightenScene(
  x: Axis,
  y: Axis,
  points: Point[],
  captions?: [string, string],
): Scene {
  const fit = leastSquares(points);
  const before = correlation(points);
  const moved: Point[] = points.map(([px, py]) => [
    px,
    py + (fit.m * px + fit.b - py) / 2,
  ]);
  const after = correlation(moved);
  return dataGraph(x, y)
    .scatter(points, { m: clean(fit.m), b: clean(fit.b) })
    .scene({
      steps: [
        step(
          captions?.[0] ??
            `The points scatter around the line: $r \\approx ${t(Math.round(before * 100) / 100)}$.`,
          act.appear("g.fit"),
        ),
        lessonStep(
          captions?.[1] ??
            `Halve every gap to the line: the points tighten and $r \\approx ${t(Math.round(after * 100) / 100)}$.`,
          ...points.slice(0, 12).map(([px, py], j) =>
            // Moves are in the scene's units, where a y unit is
            // `aspect` x units tall.
            act.move(`g.scatter.${j}`, [
              0,
              ((fit.m * px + fit.b - py) / 2) * dataAspect(x, y),
            ]),
          ),
        ),
      ],
    });
}
