import { act, f, graph, step, table } from "./scene/author.js";
import type { Scene } from "./scene/spec.js";
import type { Step } from "./scene/timeline.js";

/** Scenes for exponential growth, sequences and logarithms: problem figures
 * (givens only, never the answer), with hint walkthroughs over those givens,
 * and the lessons' models, which play step by step. */

const tex = (n: number) => String(n).replace("-", "−");
/** A window maximum: the next multiple of a round step above `v`. */
export function niceCeil(v: number) {
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(
    (s) => v / s <= 8,
  )!;
  return { max: Math.ceil((v * 1.08) / step) * step, step };
}

/** A function table (id "t"): inputs down the side under `corner`, one
 * column of outputs per name. Headings are mathematics unless `words`. */
export function valueTable(
  corner: string,
  columns: string[],
  rows: number[][],
  options: { words?: boolean } = {},
) {
  return table({
    id: "t",
    corner,
    columns,
    rows: rows.map(([x, ...cells]) => ({ label: tex(x!), cells })),
    ...(options.words ? {} : { math: true }),
  });
}

/** x | y with ×b (or +d) marked down the y column. */
export function stepTable(
  xs: number[],
  ys: number[],
  change: string | false,
): Scene {
  return valueTable(
    "x",
    ["y"],
    xs.map((x, i) => [x, ys[i]!]),
  )
    .changes(
      0,
      xs.slice(1).map(() => change),
    )
    .scene({
      title: "Table of y against x",
      steps: change
        ? [
            step(
              `Each step down the table multiplies $y$ by the same factor: ${change}.`,
              act.highlight("t.change.0"),
            ),
          ]
        : undefined,
    });
}

/** An exponential curve (id "g") through marked, labeled points. */
export function exponentialGraph(a: number, b: number, xs: number[]): Scene {
  const ys = xs.map((x) => a * b ** x);
  const { max, step: up } = niceCeil(Math.max(...ys));
  let g = graph({
    id: "g",
    x: [-1, Math.max(...xs) + 1],
    y: [0, max],
    grid: [1, up],
    tick: [1, up],
    labels: "auto",
  }).curve(f.exp(a, b));
  for (const [i, x] of xs.entries())
    g = g.point(x, ys[i]!, `(${tex(x)}, ${tex(ys[i]!)})`);
  return g.scene({
    title: "An exponential curve through marked points",
    steps: [
      step(
        `At $x = 0$ the curve is at ${tex(ys[0]!)}: the starting value.`,
        act.highlight("g.point.0"),
      ),
      step(
        `One step later it is at ${tex(ys[1]!)}. Is that ${tex(ys[0]!)} plus a fixed amount, or times a factor?`,
        act.highlight("g.point.1"),
      ),
    ],
  });
}

/** A line f and an exponential curve g (id "g"); the crossing is unmarked
 * and the window does not depend on it. */
export function raceGraph(
  m: number,
  c: number,
  b: number,
  xMax: number,
): Scene {
  const { max, step: up } = niceCeil(Math.max(m * xMax + c, 2 * c));
  return graph({
    id: "g",
    x: [0, xMax],
    y: [0, max],
    grid: [1, up],
    tick: [1, up],
    labels: "auto",
  })
    .line({ m, b: c }, { label: "f" })
    .curve(f.exp(1, b), { label: "g", color: "warm" })
    .scene({
      title: "A line f and an exponential curve g",
      steps: [
        step(
          `$f$ adds ${m} for each step of 1 in $x$.`,
          act.highlight("g.line.0"),
        ),
        step(
          `$g$ starts at 1 and multiplies by ${b} for each step, so its steps keep growing.`,
          act.highlight("g.curve.0"),
        ),
      ],
    });
}

/** y = log_b x (id "g") with a dashed vertical at x = at; the height there
 * is asked. */
export function logGraph(b: number, at: number, xMax: number): Scene {
  const top = Math.ceil(Math.log(xMax) / Math.log(b) - 1e-9);
  const across = xMax > 12 ? 2 : 1;
  return graph({
    id: "g",
    x: [0, xMax],
    y: [-2, top],
    grid: [across, 1],
    tick: [across, 1],
    labels: "auto",
  })
    .curve(f.log(1, b), { features: ["asymptotes"] })
    .line({ x: at }, { dash: "dash" })
    .point(at, 0, `x = ${tex(at)}`)
    .scene({
      title: `The curve y = log base ${b} of x`,
      steps: [
        step(
          `Go up from $x = ${tex(at)}$ to the curve. Its height is the power of ${b} that gives ${tex(at)}.`,
          act.highlight("g.line.0"),
        ),
      ],
    });
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
        id: "bars",
        categories: categories.map(String),
        series: [{ values }],
        axisName,
      },
    ],
  };
}

/** Two series side by side (id "race"). */
export function raceBars(
  categories: (string | number)[],
  first: { label: string; values: number[] },
  second: { label: string; values: number[] },
  axisName: string,
  steps?: Step[],
): Scene {
  return {
    v: 1,
    title: `${first.label} and ${second.label} by ${axisName.toLowerCase()}`,
    elements: [
      {
        type: "bars",
        id: "race",
        categories: categories.map(String),
        series: [
          { ...first, color: "accent" },
          { ...second, color: "warm" },
        ],
        axisName,
      },
    ],
    ...(steps ? { steps } : {}),
  };
}

// ------------------------------------------------------------ lesson scenes
const days = [0, 1, 2, 3, 4, 5, 6, 7];
/** Both bars of each day, with their values. */
const showDays = (...ds: number[]) =>
  ds.flatMap((d) =>
    [0, 1].flatMap((k) => [
      act.appear(`race.series.${k}.bar.${d}`),
      act.appear(`race.series.${k}.value.${d}`),
    ]),
  );

export const exponentialLessonScenes = {
  /** Equal steps in x: the line adds 3, the exponential multiplies by 3. */
  "ratio-difference-table": valueTable(
    "x",
    ["3x + 2", "2(3^x)"],
    [0, 1, 2, 3, 4].map((x) => [x, 3 * x + 2, 2 * 3 ** x]),
  )
    .changes(0, ["+3", "+3", "+3", "+3"])
    .changes(1, ["×3", "×3", "×3", "×3"], "warm")
    .scene({
      title: "Adding 3 each step against multiplying by 3",
      steps: [
        step(
          "$3x + 2$ adds 3 at every step: a constant difference.",
          act.appear("t.change.0", true),
        ),
        step(
          "$2(3^x)$ multiplies by 3 at every step: a constant ratio.",
          act.appear("t.change.1", true),
        ),
        step(
          "Its differences grow, 4, 12, 36, 108, because each step adds twice the value before it.",
          act.highlight("t.cell.4.1"),
        ),
      ],
    }),
  /** Doubling bars racing bars that add the same amount. */
  "doubling-race-bars": raceBars(
    days,
    { label: "Add 10", values: days.map((d) => 20 + 10 * d) },
    { label: "Double", values: days.map((d) => 2 ** d) },
    "Day",
    [
      step("Day 0: adding starts at 20, doubling at 1.", ...showDays(0)),
      step(
        "Days 1 to 3: adding gains 10 a day; doubling gains only 1, 2 and 4.",
        ...showDays(1, 2, 3),
      ),
      step(
        "Doubling's gains grow: 8, then 16. Adding still gains 10.",
        ...showDays(4, 5),
      ),
      step("Day 6: 80 against 64. Adding is still ahead.", ...showDays(6)),
      step(
        "Day 7: doubling passes, 128 against 90, and its lead grows every day after.",
        ...showDays(7),
      ),
    ],
  ),
  /** 2^x passes 10x + 10 between x = 6 and x = 7, and never falls back. */
  "overtake-graph": graph({
    id: "g",
    x: [0, 8],
    y: [0, 160],
    grid: [1, 20],
    tick: [1, 40],
    labels: "auto",
  })
    .line({ m: 10, b: 10 }, { label: "10x + 10" })
    .curve(f.exp(1, 2), { label: "2^x", color: "warm" })
    .point(6, 64, "(6, 64)")
    .point(7, 128, "(7, 128)")
    .scene({
      title: "y = 2^x overtakes y = 10x + 10",
      steps: [
        step(
          "$y = 10x + 10$ starts at 10 and adds 10 for each step in $x$.",
          act.trace("g.line.0"),
        ),
        step(
          "$y = 2^x$ starts at 1 and doubles for each step.",
          act.trace("g.curve.0"),
        ),
        step(
          "At $x = 6$ the line is still ahead: $70 > 64$.",
          act.appear("g.point.0"),
        ),
        step(
          "At $x = 7$ the curve has passed it: $128 > 80$. Doubling adds more each step, so the line never catches up.",
          act.appear("g.point.1"),
        ),
      ],
    }),
  /** The log curve is the exponential curve reflected in y = x. */
  "exp-log-reflection": graph({
    id: "g",
    x: [-3, 8],
    y: [-3, 8],
    grid: 1,
    tick: 2,
  })
    .line({ m: 1, b: 0 }, { dash: "dash" })
    .curve(f.exp(1, 2), { label: "y = 2^x", color: "warm" })
    .curve(f.log(1, 2), { label: "y = log_2 x" })
    .point(3, 8, "(3, 8)")
    .point(8, 3, "(8, 3)")
    .scene({
      title: "y = 2^x and y = log base 2 of x mirror in y = x",
      steps: [
        step(
          "$y = 2^x$ passes through $(3, 8)$ because $2^3 = 8$.",
          act.trace("g.curve.0"),
          act.appear("g.point.0"),
        ),
        step(
          "Swapping every point's coordinates reflects the curve in the line $y = x$.",
          act.appear("g.line.0"),
        ),
        step(
          "The reflection is $y = \\log_2 x$, through $(8, 3)$: it undoes $2^x$.",
          act.trace("g.curve.1"),
          act.appear("g.point.1"),
        ),
      ],
    }),
  /** Points of y = log_2 x: each doubling of x adds 1 to y. */
  "log-graph-points": graph({
    id: "g",
    x: [0, 9],
    y: [-2, 4],
    grid: 1,
    tick: 1,
  })
    .curve(f.log(1, 2), { features: ["asymptotes"] })
    .point(0.5, -1, "(1/2, −1)")
    .point(1, 0, "(1, 0)")
    .point(2, 1, "(2, 1)")
    .point(4, 2, "(4, 2)")
    .point(8, 3, "(8, 3)")
    .scene({
      title: "y = log base 2 of x through powers of 2",
      steps: [
        step(
          "$y = \\log_2 x$ is the power of 2 that gives $x$.",
          act.trace("g.curve.0"),
        ),
        step(
          "Each doubling of $x$ adds 1 to $y$; halving subtracts 1, so $\\log_2 \\frac{1}{2} = -1$.",
          act.appear("g.point", true),
        ),
      ],
    }),
  /** Multiplying outputs adds inputs: 4 × 8 = 32 and 2 + 3 = 5. */
  "powers-product-table": valueTable(
    "x",
    ["2^x"],
    [1, 2, 3, 4, 5, 6].map((x) => [x, 2 ** x]),
  )
    .highlight({ rows: [1, 2, 4], color: "gold" })
    .scene({
      title: "Powers of 2: rows 2, 3 and 5 highlighted",
      note: "4 × 8 = 32 in the second column matches 2 + 3 = 5 in the first.",
      steps: [
        step(
          "Multiply two outputs: $4 \\times 8 = 32$.",
          act.highlight("t.cell.1.0"),
          act.highlight("t.cell.2.0"),
          act.highlight("t.cell.4.0"),
        ),
        step(
          "Their inputs add: $2 + 3 = 5$. A logarithm is the input, so $\\log_2(4 \\cdot 8) = \\log_2 4 + \\log_2 8$.",
          act.highlight("t.row.1.label"),
          act.highlight("t.row.2.label"),
          act.highlight("t.row.4.label"),
        ),
      ],
    }),
  /** Ratio table of a geometric sequence. */
  "geometric-ratio-table": valueTable(
    "n",
    ["a_n"],
    [1, 2, 3, 4, 5].map((n) => [n, 3 * 2 ** (n - 1)]),
  )
    .changes(0, ["×2", "×2", "×2", "×2"])
    .scene({
      title: "The sequence 3, 6, 12, 24, 48",
      steps: [
        step(
          "From term 1 to term 5 there are 4 steps of ×2, so $a_5 = 3 \\cdot 2^4$.",
          act.appear("t.change.0", true),
        ),
      ],
    }),
  /** Running totals of 1, 2, 4, 8, 16: each total is one less than the next term. */
  "series-running-total": valueTable(
    "n",
    ["term", "total"],
    [1, 2, 3, 4, 5].map((n) => [n, 2 ** (n - 1), 2 ** n - 1]),
    { words: true },
  )
    .changes(0, ["×2", "×2", "×2", "×2"])
    .highlight({ columns: [1], color: "gold" })
    .scene({
      title: "Terms 1, 2, 4, 8, 16 and their running totals",
      steps: [
        step(
          "Each term doubles the one before.",
          act.appear("t.change.0", true),
        ),
        step(
          "Add as you go: 1, 3, 7, 15, 31.",
          ...[0, 1, 2, 3, 4].map((i) => act.appear(`t.cell.${i}.1`)),
        ),
        step(
          "Each total is one less than the next term: $1 + 2 + 4 + 8 + 16 = 32 - 1$.",
          act.highlight("t.cell.4.1"),
        ),
      ],
    }),
} satisfies Record<string, Scene>;
export type ExponentialIllustrationKind = keyof typeof exponentialLessonScenes;
