import { bars, f, graph, table } from "./scene/author.js";
import type { Scene } from "./scene/spec.js";

/** Scenes for exponential growth, sequences and logarithms: problem figures
 * (givens only, never the answer) and the lessons' revealed models. */

const tex = (n: number) => String(n).replace("-", "−");
/** A window maximum: the next multiple of a round step above `v`. */
export function niceCeil(v: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(
    (s) => v / s <= 8,
  )!;
  return { max: Math.ceil((v * 1.08) / step) * step, step };
}

/** x | y with ×b (or +d) marked down the y column. */
export function stepTable(
  xs: number[],
  ys: string[],
  step: string | false,
  names: [string, string] = ["x", "y"],
): Scene {
  return table(names, xs.map((x, i) => [x, ys[i]!]), { headerFont: "math" })
    .steps(
      1,
      xs.slice(1).map(() => step),
    )
    .scene({ title: `Table of ${names[1]} against ${names[0]}` });
}

/** An exponential curve through marked, labeled points. */
export function exponentialGraph(a: number, b: number, xs: number[]): Scene {
  const ys = xs.map((x) => a * b ** x);
  const { max, step } = niceCeil(Math.max(...ys));
  let g = graph({
    x: [-1, Math.max(...xs) + 1],
    y: [0, max],
    grid: [1, step],
    tick: [1, step],
    labels: "auto",
  }).curve(f.exp(a, b));
  for (const [i, x] of xs.entries())
    g = g.point(x, ys[i]!, `(${tex(x)}, ${tex(ys[i]!)})`);
  return g.scene({ title: "An exponential curve through marked points" });
}

/** A line and an exponential curve on one window, crossing unmarked. */
export function raceGraph(
  m: number,
  c: number,
  b: number,
  xMax: number,
): Scene {
  const { max, step } = niceCeil(Math.max(m * xMax + c, 2 * c));
  return graph({
    x: [0, xMax],
    y: [0, max],
    grid: [1, step],
    tick: [1, step],
    labels: "auto",
  })
    .line({ m, b: c }, { label: "f" })
    .curve(f.exp(1, b), { label: "g", color: "warm" })
    .scene({ title: "A line f and an exponential curve g" });
}

/** y = log_b x with a dashed vertical at x = at; the height there is asked. */
export function logGraph(b: number, at: number, xMax: number): Scene {
  const top = Math.ceil(Math.log(xMax) / Math.log(b) - 1e-9) + 1;
  return graph({
    x: [0, xMax],
    y: [-2, top],
    grid: [xMax > 12 ? 2 : 1, 1],
    tick: [xMax > 12 ? 2 : 1, 1],
    labels: "auto",
  })
    .curve(f.log(1, b), { features: ["asymptotes"] })
    .line({ x: at }, { dash: "dash" })
    .point(at, 0, `x = ${tex(at)}`)
    .scene({ title: `The curve y = log base ${b} of x` });
}

export function growthBars(
  categories: (string | number)[],
  values: number[],
  axisName: string,
): Scene {
  return {
    v: 1,
    title: `Bars by ${axisName.toLowerCase()}`,
    elements: [
      {
        type: "bars",
        categories: categories.map(String),
        series: [{ values }],
        axisName,
      },
    ],
  };
}

export function raceBars(
  categories: (string | number)[],
  first: { label: string; values: number[] },
  second: { label: string; values: number[] },
  axisName: string,
): Scene {
  return {
    v: 1,
    title: `${first.label} and ${second.label} by ${axisName.toLowerCase()}`,
    elements: [
      {
        type: "bars",
        categories: categories.map(String),
        series: [
          { ...first, color: "accent" },
          { ...second, color: "warm" },
        ],
        axisName,
      },
    ],
  };
}

// ------------------------------------------------------------ lesson scenes
export const exponentialLessonScenes = {
  /** Equal steps in x: the line adds 3, the exponential multiplies by 3. */
  "ratio-difference-table": table(
    ["x", "3x + 2", "2·3^x"],
    [0, 1, 2, 3, 4].map((x) => [x, 3 * x + 2, 2 * 3 ** x]),
    { headerFont: "math" },
  )
    .steps(1, ["+3", "+3", "+3", "+3"])
    .steps(2, ["×3", "×3", "×3", "×3"], "warm")
    .scene({ title: "Adding 3 each step against multiplying by 3" }),
  /** Doubling bars racing bars that add the same amount. */
  "doubling-race-bars": raceBars(
    [0, 1, 2, 3, 4, 5, 6, 7],
    { label: "Add 10", values: [0, 1, 2, 3, 4, 5, 6, 7].map((d) => 20 + 10 * d) },
    { label: "Double", values: [0, 1, 2, 3, 4, 5, 6, 7].map((d) => 2 ** d) },
    "Day",
  ),
  /** 2^x passes 10x + 10 between x = 6 and x = 7, and never falls back. */
  "overtake-graph": graph({
    x: [0, 8],
    y: [0, 160],
    grid: [1, 20],
    tick: [1, 40],
    labels: "auto",
  })
    .line({ m: 10, b: 10 }, { label: "y = 10x + 10" })
    .curve(f.exp(1, 2), { label: "y = 2^x", color: "warm" })
    .point(6, 64, "(6, 64)")
    .point(7, 128, "(7, 128)")
    .scene({ title: "y = 2^x overtakes y = 10x + 10" }),
  /** The log curve is the exponential curve reflected in y = x. */
  "exp-log-reflection": graph({ x: [-3, 8], y: [-3, 8], grid: 1, tick: 2 })
    .line({ m: 1, b: 0 }, { dash: "dash" })
    .curve(f.exp(1, 2), { label: "y = 2^x", color: "warm" })
    .curve(f.log(1, 2), { label: "y = log_2 x" })
    .point(3, 8, "(3, 8)")
    .point(8, 3, "(8, 3)")
    .scene({ title: "y = 2^x and y = log base 2 of x mirror in y = x" }),
  /** Points of y = log_2 x: each doubling of x adds 1 to y. */
  "log-graph-points": graph({ x: [0, 9], y: [-2, 4], grid: 1, tick: 1 })
    .curve(f.log(1, 2), { features: ["asymptotes"] })
    .point(0.5, -1, "(1/2, −1)")
    .point(1, 0, "(1, 0)")
    .point(2, 1, "(2, 1)")
    .point(4, 2, "(4, 2)")
    .point(8, 3, "(8, 3)")
    .scene({ title: "y = log base 2 of x through powers of 2" }),
  /** Multiplying outputs adds inputs: 4 × 8 = 32 and 2 + 3 = 5. */
  "powers-product-table": table(
    ["x", "2^x"],
    [1, 2, 3, 4, 5, 6].map((x) => [x, 2 ** x]),
    { headerFont: "math" },
  )
    .highlightRows([1, 2, 4], "gold")
    .scene({
      title: "Powers of 2: rows 2, 3 and 5 highlighted",
      note: "4 × 8 = 32 in the second column matches 2 + 3 = 5 in the first.",
    }),
  /** Ratio table of a geometric sequence. */
  "geometric-ratio-table": table(
    ["n", "a_n"],
    [1, 2, 3, 4, 5].map((n) => [n, 3 * 2 ** (n - 1)]),
    { headerFont: "math" },
  )
    .steps(1, ["×2", "×2", "×2", "×2"])
    .scene({ title: "The sequence 3, 6, 12, 24, 48" }),
  /** Running totals of 1, 2, 4, 8, 16: each total is one less than the next term. */
  "series-running-total": table(
    [{ text: "n", font: "math" }, "term", "total"],
    [1, 2, 3, 4, 5].map((n) => [n, 2 ** (n - 1), 2 ** n - 1]),
  )
    .steps(1, ["×2", "×2", "×2", "×2"])
    .highlightColumns([2], "gold")
    .scene({ title: "Terms 1, 2, 4, 8, 16 and their running totals" }),
} satisfies Record<string, Scene>;
export type ExponentialIllustrationKind = keyof typeof exponentialLessonScenes;
