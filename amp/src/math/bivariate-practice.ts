import { count } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import {
  assemble,
  random,
  rational,
  shuffle,
  type Draft,
  type Random,
} from "./distribution-practice.js";
import {
  act,
  graph,
  lessonStep,
  step,
  table as tableScene,
} from "./scene/author.js";
import type { Step } from "./scene/timeline.js";

type Axis = { label: string; start: number; end: number; step: number };
/** A scatter plot scene: the data on a grid with unlike x and y steps. */
function scatterScene(
  x: Axis,
  y: Axis,
  points: Point[],
  line?: { m: number; b: number; marks: [Point, Point] },
): SemanticFigure {
  let g = graph({
    x: [x.start, x.end],
    y: [y.start, y.end],
    grid: [x.step, y.step],
    tick: [x.step, y.step],
    axisNames: [x.label, y.label],
    // Landscape, as data plots are drawn: the plot is 0.72 as tall as wide.
    aspect: (0.72 * (x.end - x.start)) / (y.end - y.start),
  }).scatter(points, line && { m: line.m, b: line.b });
  for (const [px, py] of line?.marks ?? [])
    g = g.point(px, py, undefined, { open: true });
  return { kind: "scene", scene: g.scene() };
}

/** The trend-line scene and its walkthrough. Lesson steps compare a flat line
 * at the typical y with the trend line, gap by gap, and (for a prediction)
 * reveal the predicted value; the slope triangle is the step a hint shows. */
function trendScene(
  c: { x: Axis; y: Axis; names: readonly [string, string] },
  points: Point[],
  m: number,
  b: number,
  marks: [Point, Point],
  predict?: number,
): SemanticFigure {
  const level = Math.round(
    points.reduce((a, [, y]) => a + y, 0) / points.length,
  );
  const gaps = (line: (x: number) => number) =>
    points.reduce((a, [x, y]) => a + Math.abs(y - line(x)), 0);
  const [[x1, y1], [x2, y2]] = marks;
  let g = graph({
    id: "g",
    x: [c.x.start, c.x.end],
    y: [c.y.start, c.y.end],
    grid: [c.x.step, c.y.step],
    tick: [c.x.step, c.y.step],
    axisNames: [c.x.label, c.y.label],
    aspect: (0.72 * (c.x.end - c.x.start)) / (c.y.end - c.y.start),
  });
  g = g
    .scatter(points, { m, b }, true)
    .trial(0, level)
    .slope(marks[0], marks[1], "shown");
  if (predict !== undefined) g = g.predict(predict);
  for (const [px, py] of marks) g = g.point(px, py, undefined, { open: true });
  const steps = [
    lessonStep(
      `A flat line at ${level} ignores the trend: the gaps from the points to it add up to ${gaps(() => level)}.`,
      act.appear("g.trial"),
    ),
    lessonStep(
      `The trend line follows the points: its gaps add up to only ${gaps((x) => b + m * x)}.`,
      act.disappear("g.trial"),
      act.highlight("g.fit"),
      act.appear("g.residual"),
    ),
    step(
      `Between the marked points, ${c.names[0]} changes by {g.slope.0.run.label} and ${c.names[1]} by {g.slope.0.rise.label}: slope = rise ÷ run.`,
      act.appear("g.slope.0"),
      act.highlight("g.point"),
    ),
    predict === undefined
      ? lessonStep(
          `Slope = ${signed(y2 - y1)} ÷ ${x2 - x1} = ${signed(m)}: the change in ${c.names[1]} for each 1 more of ${c.names[0]}.`,
          act.highlight("g.fit"),
        )
      : lessonStep(
          `Follow the line to ${c.names[0]} = ${predict}: it predicts {g.predict.label}.`,

          act.appear("g.predict"),
        ),
  ];
  return { kind: "scene", scene: g.scene({ steps }) };
}

/** Grade 8 statistics: patterns in scatter plots, trend lines as models, and
 * association in two-way tables. */
const charts = { requiredFigureCapability: "scenes-v1" } as const;
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const bivariateTemplates: readonly TemplateMetadata[] = [
  {
    id: "scatter-association-choice",
    version: 1,
    ...charts,
    ...choice,
    title: "Describe the association",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Classify the pattern in a scatter plot as positive linear, negative linear, nonlinear or no association.",
  },
  {
    id: "trend-line-predict",
    version: 1,
    ...charts,
    title: "Predict with a trend line",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Find a trend line's slope from two marked points and use it to predict.",
  },
  {
    id: "trend-slope-meaning",
    version: 1,
    ...charts,
    ...choice,
    title: "What the slope means",
    skillId: "scatterplots",
    gradeBand: "6–8",
    description:
      "Choose the statement that interprets a trend line's slope in context.",
  },
  {
    id: "two-way-missing",
    version: 1,
    ...charts,
    title: "Complete a two-way table",
    skillId: "two-way-tables",
    gradeBand: "6–8",
    description:
      "Use row and column totals to find a missing count in a two-way table.",
  },
  {
    id: "two-way-row-percent",
    version: 1,
    ...charts,
    title: "Percent within a row",
    skillId: "two-way-tables",
    gradeBand: "6–8",
    description:
      "Find a relative frequency within one row of a two-way table, as a percent.",
  },
  {
    id: "two-way-association-choice",
    version: 1,
    ...charts,
    ...choice,
    title: "Is there an association?",
    skillId: "two-way-tables",
    gradeBand: "6–8",
    description:
      "Decide whether two categorical variables are associated by comparing row percents, not counts.",
  },
];

type Point = [number, number];
/** A signed number with a true minus sign: −12. */
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);
const mean = (v: readonly number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Least-squares fit quality: r for a line, R² for a parabola. */
export function fitQuality(points: readonly Point[]) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const mx = mean(xs),
    my = mean(ys);
  const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0),
    syy = ys.reduce((a, y) => a + (y - my) ** 2, 0),
    sxy = points.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
  const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
  // Quadratic least squares by the normal equations (Cramer's rule).
  const s = (k: number) => xs.reduce((a, x) => a + x ** k, 0);
  const t = (k: number) => points.reduce((a, [x, y]) => a + x ** k * y, 0);
  const m: number[][] = [
    [s(4), s(3), s(2)],
    [s(3), s(2), s(1)],
    [s(2), s(1), points.length],
  ];
  const rhs = [t(2), t(1), t(0)];
  const det = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const d = det(m);
  const coef = [0, 1, 2].map(
    (c) =>
      det(m.map((row, i) => row.map((v, j) => (j === c ? rhs[i]! : v)))) / d,
  );
  const sse = points.reduce(
    (a, [x, y]) => a + (y - (coef[0]! * x * x + coef[1]! * x + coef[2]!)) ** 2,
    0,
  );
  return { r, quadratic: syy ? 1 - sse / syy : 0 };
}

type Association = "positive" | "negative" | "nonlinear" | "none";
const associationContexts: {
  kind: Association;
  describe: (n: number) => string;
  x: { label: string; start: number; end: number; step: number };
  y: { label: string; start: number; end: number; step: number };
  names: [string, string];
  shape: (r: Random, x: number) => number;
  read: string;
}[] = [
  {
    kind: "positive",
    describe: (n) =>
      `how many hours each of ${n} students studied and the score each earned on a test`,
    x: { label: "hours studied", start: 0, end: 10, step: 1 },
    y: { label: "test score", start: 30, end: 100, step: 10 },
    names: ["hours studied", "test score"],
    shape: (r, x) => 45 + 5 * x + r(-6, 6),
    read: "Students who studied longer tended to score higher.",
  },
  {
    kind: "positive",
    describe: (n) => `the height and the arm span of each of ${n} people`,
    x: { label: "height (cm)", start: 140, end: 190, step: 10 },
    y: { label: "arm span (cm)", start: 140, end: 190, step: 10 },
    names: ["height", "arm span"],
    shape: (r, x) => x + r(-5, 5),
    read: "Taller people tended to have longer arm spans.",
  },
  {
    kind: "negative",
    describe: (n) => `the age and the value of each of ${n} used cars`,
    x: { label: "age (years)", start: 0, end: 10, step: 1 },
    y: { label: "value (thousand $)", start: 0, end: 30, step: 5 },
    names: ["age", "value"],
    shape: (r, x) => 28 - 2.5 * x + r(-3, 3),
    read: "Older cars tended to be worth less.",
  },
  {
    kind: "negative",
    describe: (n) =>
      `the price of lemonade and the cups sold on each of ${n} days`,
    x: { label: "price (cents)", start: 50, end: 150, step: 10 },
    y: { label: "cups sold", start: 0, end: 70, step: 10 },
    names: ["price", "cups sold"],
    shape: (r, x) => 75 - 0.5 * x + r(-6, 6),
    read: "On days with a higher price, fewer cups tended to sell.",
  },
  {
    kind: "nonlinear",
    describe: (n) => `the temperature at ${n} times during one day`,
    x: { label: "hour of the day", start: 6, end: 20, step: 2 },
    y: { label: "temperature (°F)", start: 40, end: 90, step: 10 },
    names: ["the hour", "temperature"],
    shape: (r, x) => 84 - 0.7 * (x - 14) ** 2 + r(-2, 2),
    read: "The temperature rose through the morning, peaked in the afternoon, then fell.",
  },
  {
    kind: "nonlinear",
    describe: (n) => `the speed of a car and its fuel use on ${n} test drives`,
    x: { label: "speed (mph)", start: 20, end: 80, step: 10 },
    y: { label: "miles per gallon", start: 10, end: 40, step: 5 },
    names: ["speed", "miles per gallon"],
    shape: (r, x) => 36 - 0.012 * (x - 50) ** 2 + r(-1, 1),
    read: "Fuel use was best at middle speeds and worse at slow and fast speeds.",
  },
  {
    kind: "none",
    describe: (n) =>
      `the shoe size and the quiz score of each of ${n} students`,
    x: { label: "shoe size", start: 4, end: 12, step: 1 },
    y: { label: "quiz score", start: 0, end: 10, step: 1 },
    names: ["shoe size", "quiz score"],
    shape: (r) => r(1, 10),
    read: "Knowing a student’s shoe size tells you nothing about the quiz score.",
  },
  {
    kind: "none",
    describe: (n) =>
      `the number of letters in each of ${n} students’ first names and the minutes each spent on homework`,
    x: { label: "letters in name", start: 2, end: 12, step: 1 },
    y: { label: "homework (min)", start: 0, end: 60, step: 10 },
    names: ["name length", "homework time"],
    shape: (r) => r(5, 60),
    read: "Name length tells you nothing about homework time.",
  },
];
const associationLabels: Record<Association, string> = {
  positive: "Positive linear association",
  negative: "Negative linear association",
  nonlinear: "Nonlinear association",
  none: "No association",
};
const associationWhy: Record<Association, string> = {
  positive:
    "As one quantity increases, the other tends to increase, and the points lie near a straight line.",
  negative:
    "As one quantity increases, the other tends to decrease, and the points lie near a straight line.",
  nonlinear:
    "The points follow a clear pattern, but it curves: no single straight line fits it.",
  none: "The points show no trend: one quantity does not help predict the other.",
};
/** Clear-cut patterns only: the fit measures leave no doubt about the kind. */
function clearly(kind: Association, points: Point[]) {
  const { r, quadratic } = fitQuality(points);
  if (kind === "positive") return r >= 0.85 && quadratic - r * r < 0.05;
  if (kind === "negative") return r <= -0.85 && quadratic - r * r < 0.05;
  if (kind === "nonlinear") return r * r <= 0.3 && quadratic >= 0.85;
  return Math.abs(r) <= 0.2 && quadratic <= 0.15;
}

function associationChoice(r: Random): Draft {
  const kinds: Association[] = ["positive", "negative", "nonlinear", "none"];
  const kind = kinds[r(0, 3)]!;
  const options = associationContexts.filter((c) => c.kind === kind);
  const c = options[r(0, options.length - 1)]!;
  const n = r(12, 16);
  let points: Point[];
  do {
    const seen = new Set<string>();
    points = [];
    while (points.length < n) {
      const x =
        c.x.start +
        r(0, (c.x.end - c.x.start) / (c.x.step / 2)) * (c.x.step / 2);
      const y = Math.round(
        Math.min(c.y.end, Math.max(c.y.start, c.shape(r, x))),
      );
      if (!Number.isInteger(x) || x === c.x.start || seen.has(`${x},${y}`))
        continue;
      seen.add(`${x},${y}`);
      points.push([x, y]);
    }
  } while (!clearly(kind, points));
  const figure = scatterScene(c.x, c.y, points);
  return {
    prompt: `The scatter plot shows ${c.describe(n)}. Which describes the association?`,
    figure,
    answer: "",
    hint: `Read the ${n} points from left to right as ${c.names[0]} increases. Does ${c.names[1]} tend to rise, fall, bend, or show no trend?`,
    explanation: [
      `${associationLabels[kind]}. ${associationWhy[kind]}`,
      c.read,
    ],
    choices: kinds.map((k) =>
      k === kind
        ? { label: associationLabels[k], correct: true as const }
        : {
            label: associationLabels[k],
            feedback: `${associationWhy[kind]} ${k === "none" ? "There is a pattern here." : k === "nonlinear" ? "Here the points lie near a straight line." : kind === "nonlinear" ? "Here the points bend, so a straight line does not fit." : kind === "none" ? "Here there is no trend at all." : "Here the trend goes the other way."}`,
          },
    ),
  };
}

/** Linear contexts for trend lines: y = intercept + slope · x. */
const trendContexts = [
  {
    describe: (n: number) =>
      `how many hours each of ${n} students studied and each one’s test score`,
    x: { label: "hours studied", start: 0, end: 10, step: 1 },
    y: { label: "test score", start: 30, end: 100, step: 10 },
    names: ["hours studied", "test score"],
    slopes: [4, 5],
    intercepts: [40, 55],
    noise: 7,
    ask: (x: number) =>
      `Use the trend line to predict the score of a student who studies ${x} ${x === 1 ? "hour" : "hours"}.`,
    xUnit: ["hour of study", "hours of study"],
    rate: (k: number, up: boolean) =>
      `Each additional hour of study goes with about ${k} ${up ? "more" : "fewer"} ${k === 1 ? "point" : "points"}.`,
    reversed: (k: number, up: boolean) =>
      `Each additional point goes with about ${k} ${up ? "more" : "fewer"} ${k === 1 ? "hour" : "hours"} of study.`,
    zero: (b: number) =>
      `A student who does not study scores about ${b} points.`,
    intercept: true,
  },
  {
    describe: (n: number) => `the age and the value of each of ${n} used cars`,
    x: { label: "age (years)", start: 0, end: 10, step: 1 },
    y: { label: "value (thousand $)", start: 0, end: 30, step: 5 },
    names: ["age", "value"],
    slopes: [-2, -3],
    intercepts: [26, 30],
    noise: 2,
    ask: (x: number) =>
      `Use the trend line to predict the value, in thousands of dollars, of a car that is ${x} ${x === 1 ? "year" : "years"} old.`,
    xUnit: ["year of age", "years of age"],
    rate: (k: number, up: boolean) =>
      `Each additional year of age goes with a value about ${k} thousand dollars ${up ? "higher" : "lower"}.`,
    reversed: (k: number, up: boolean) =>
      `Each additional thousand dollars of value goes with about ${k} ${up ? "more" : "fewer"} ${k === 1 ? "year" : "years"} of age.`,
    zero: (b: number) => `A new car is worth about ${b} thousand dollars.`,
    intercept: true,
  },
  {
    describe: (n: number) =>
      `the high temperature and the cups of lemonade sold on each of ${n} days`,
    x: { label: "temperature (°F)", start: 60, end: 100, step: 5 },
    y: { label: "cups sold", start: 0, end: 100, step: 10 },
    names: ["temperature", "cups sold"],
    slopes: [1, 2],
    intercepts: [-110, -40],
    noise: 5,
    ask: (x: number) =>
      `Use the trend line to predict how many cups sell on a ${x}°F day.`,
    xUnit: ["degree", "degrees"],
    rate: (k: number, up: boolean) =>
      `Each additional degree goes with about ${k} ${up ? "more" : "fewer"} ${k === 1 ? "cup" : "cups"} sold.`,
    reversed: (k: number, up: boolean) =>
      `Each additional cup sold goes with about ${k} ${up ? "more" : "fewer"} ${k === 1 ? "degree" : "degrees"}.`,
    zero: (b: number, x: number, y: number) =>
      `On a ${x}°F day about ${y} cups sell.`,
    intercept: false,
  },
] as const;

function trendData(r: Random) {
  const c = trendContexts[r(0, trendContexts.length - 1)]!;
  // Keep predictions off the bottom edge: a car worth $0 is not a typical value.
  const inY = (v: number) => v >= c.y.start + c.y.step / 2 && v <= c.y.end;
  for (;;) {
    const m = c.slopes[r(0, c.slopes.length - 1)]!;
    const b = r(c.intercepts[0], c.intercepts[1]);
    const f = (x: number) => b + m * x;
    const span = c.x.end - c.x.start;
    // The marked points sit on grid lines, where they are easy to read.
    const x1 = c.x.start + r(1, 2) * c.x.step,
      x2 = c.x.end - r(1, 2) * c.x.step;
    if (!inY(f(x1)) || !inY(f(x2)) || x2 - x1 < span / 2) continue;
    // Only x-values whose noisy points always stay on the grid.
    const usable = Array.from(
      { length: span },
      (_, i) => c.x.start + 1 + i,
    ).filter((x) => inY(f(x) - c.noise) && inY(f(x) + c.noise));
    if (usable.length < 9) continue;
    const n = r(9, Math.min(14, usable.length));
    const points: Point[] = shuffle(r, usable)
      .slice(0, n)
      .map((x) => [x, Math.round(f(x) + r(-c.noise, c.noise))]);
    const marks: [Point, Point] = [
      [x1, f(x1)],
      [x2, f(x2)],
    ];
    const figure = (predict?: number) =>
      trendScene(c, points, m, b, marks, predict);
    return { c, m, b, f, x1, x2, n, figure, inY };
  }
}

function trendPredict(r: Random): Draft {
  const { c, m, f, x1, x2, n, figure, inY } = trendData(r);
  let X: number;
  do X = c.x.start + r(0, c.x.end - c.x.start);
  while (X === x1 || X === x2 || !inY(f(X)));
  const [y1, y2] = [f(x1), f(x2)];
  return {
    prompt: `The scatter plot shows ${c.describe(n)}, with a trend line through (${x1}, ${y1}) and (${x2}, ${y2}). ${c.ask(X)}`,
    figure: figure(X),
    answer: `${f(X)}`,
    hint: `Slope = change in ${c.names[1]} ÷ change in ${c.names[0]} between the marked points. Then move from (${x1}, ${y1}) to ${X}.`,
    explanation: [
      `Slope: (${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${signed(y2 - y1)} ÷ ${x2 - x1} = ${signed(m)}.`,
      `${X > x1 ? `From ${x1} up to ${X}` : `From ${x1} back to ${X}`} is ${Math.abs(X - x1)} ${Math.abs(X - x1) === 1 ? "step" : "steps"}, so ${c.names[1]} changes by ${signed(m)} × ${signed(X - x1)} = ${signed(m * (X - x1))}: ${y1} ${m * (X - x1) < 0 ? "−" : "+"} ${Math.abs(m * (X - x1))} = ${f(X)}.`,
      "The trend line predicts a typical value; actual data points scatter around it.",
    ],
  };
}

function slopeMeaning(r: Random): Draft {
  const { c, m, b, n, figure, x1, x2, f } = trendData(r);
  const size = Math.abs(m);
  const [xOne] = c.xUnit;
  const correct = c.rate(size, m > 0);
  return {
    prompt: `The scatter plot shows ${c.describe(n)}, with a trend line through (${x1}, ${f(x1)}) and (${x2}, ${f(x2)}). What does the slope of the trend line mean?`,
    figure: figure(),
    answer: "",
    hint: `Find the slope: change in ${c.names[1]} ÷ change in ${c.names[0]}, from (${x1}, ${f(x1)}) to (${x2}, ${f(x2)}). The slope is the change in ${c.names[1]} for each 1 more of ${c.names[0]}.`,
    explanation: [
      `Slope: (${f(x2)} − ${f(x1)}) ÷ (${x2} − ${x1}) = ${signed(m)}.`,
      `The slope is the change in ${c.names[1]} for each additional ${xOne}. ${correct}`,
      c.intercept
        ? `The $y$-intercept, ${b}, is a different fact: the predicted ${c.names[1]} when ${c.names[0]} is 0.`
        : "The slope is a rate: it describes change, not any single point on the line.",
    ],
    choices: [
      { label: correct, correct: true },
      {
        label: c.zero(b, x1, f(x1)),
        feedback: c.intercept
          ? `That is the $y$-intercept, ${b}: where the line meets ${c.names[0]} = 0. The slope is the change for each additional ${xOne}.`
          : `That reads one point on the line, not the change for each additional ${xOne}.`,
      },
      {
        label: c.reversed(size, m > 0),
        feedback: `This swaps the quantities. The slope divides the change in ${c.names[1]} by the change in ${c.names[0]}.`,
      },
      {
        label: c.rate(size, m < 0),
        feedback: `The line ${m > 0 ? "rises" : "falls"} from left to right, so the slope is ${m > 0 ? "positive" : "negative"}.`,
      },
    ],
  };
}

const tableContexts = [
  {
    intro:
      "The two-way table shows whether students in two grades have a curfew.",
    rows: ["Grade 7", "Grade 8"],
    nouns: ["seventh graders", "eighth graders"],
    columnTitle: "Has a curfew",
    trait: "have a curfew",
    not: "do not have a curfew",
    everyone: "students",
  },
  {
    intro:
      "The two-way table shows whether students who do and do not play a sport eat breakfast daily.",
    rows: ["Athlete", "Non-athlete"],
    nouns: ["athletes", "non-athletes"],
    columnTitle: "Eats breakfast daily",
    trait: "eat breakfast daily",
    not: "do not eat breakfast daily",
    everyone: "students",
  },
  {
    intro:
      "The two-way table shows whether adults who do and do not own a dog walk daily.",
    rows: ["Dog owner", "No dog"],
    nouns: ["dog owners", "adults without a dog"],
    columnTitle: "Walks daily",
    trait: "walk daily",
    not: "do not walk daily",
    everyone: "adults",
  },
] as const;
type Cell = number | null | "?";

/** A two-way table scene with totals; "?" is the cell to find, null a blank. */
function table(
  c: (typeof tableContexts)[number],
  counts: [[number, number], [number, number]],
  hide: (r: number, col: number) => Cell | undefined = () => undefined,
  steps?: Step[],
): SemanticFigure {
  const rowTotals = counts.map((row) => row[0] + row[1]),
    columnTotals = [0, 1].map((j) => counts[0][j]! + counts[1][j]!);
  const derived: [number, number][] = [];
  const cell = (i: number, j: number) => {
    const hidden = hide(i, j);
    if (hidden === "?") derived.push([i, j]);
    return hidden === undefined ? counts[i]![j]! : null;
  };
  const scene = tableScene({
    id: "t",
    title: c.columnTitle,
    columns: ["Yes", "No", "Total"],
    rows: [
      { label: c.rows[0], cells: [cell(0, 0), cell(0, 1), rowTotals[0]!] },
      { label: c.rows[1], cells: [cell(1, 0), cell(1, 1), rowTotals[1]!] },
      {
        label: "Total",
        cells: [
          columnTotals[0]!,
          columnTotals[1]!,
          rowTotals[0]! + rowTotals[1]!,
        ],
      },
    ],
    sums: true,
    ...(derived.length ? { derived } : {}),
  }).scene(steps ? { steps } : {});
  return { kind: "scene", scene };
}

function twoWayMissing(r: Random): Draft {
  const c = tableContexts[r(0, tableContexts.length - 1)]!;
  const counts: [[number, number], [number, number]] = [
    [r(8, 40), r(8, 40)],
    [r(8, 40), r(8, 40)],
  ];
  const [i, j] = [r(0, 1), r(0, 1)];
  // The target's row-mate is blank too, so the target comes from its column.
  const figure = table(
    c,
    counts,
    (a, b) => (a === i && b === j ? "?" : a === i ? null : undefined),
    [
      step(
        `The ${c.rows[i]} row has two blanks, so use the “${j === 0 ? "Yes" : "No"}” column.`,
        act.highlight(`t.column.${j}`),
        act.highlight(`t.cell.0.${j}`),
        act.highlight(`t.cell.1.${j}`),
        act.highlight(`t.cell.2.${j}`),
      ),
      step(
        `Its total minus the ${c.rows[1 - i]} count: {t.cell.2.${j}} − {t.cell.${1 - i}.${j}}.`,
        act.highlight(`t.cell.2.${j}`),
        act.highlight(`t.cell.${1 - i}.${j}`),
      ),
      lessonStep(
        `${c.nouns[i][0]!.toUpperCase()}${c.nouns[i].slice(1)} who ${j === 0 ? c.trait : c.not}: {t.cell.${i}.${j}}.`,
        act.highlight(`t.cell.${i}.${j}`),
      ),
    ],
  );
  const colTotal = counts[0][j]! + counts[1][j]!,
    other = counts[1 - i]![j]!,
    answer = counts[i]![j]!;
  const phrase = j === 0 ? c.trait : c.not;
  return {
    prompt: `${c.intro} How many ${c.nouns[i]} ${phrase}?`,
    figure,
    answer: `${answer}`,
    hint: `That row has two blanks, so use the “${j === 0 ? "Yes" : "No"}” column: its total is ${colTotal}, and ${other} of them are ${c.nouns[1 - i]}.`,
    explanation: [
      `The ${c.rows[i]} row has two unknown counts, so its total alone is not enough.`,
      `The “${j === 0 ? "Yes" : "No"}” column totals ${colTotal}, and ${other} of those are ${c.nouns[1 - i]}.`,
      `${colTotal} − ${other} = ${answer} ${c.nouns[i]} ${phrase}.`,
      `Check across the row: ${answer} + ${counts[i]![1 - j]} = ${counts[i]![0]! + counts[i]![1]!}, the row total.`,
    ],
  };
}

/** Row totals that make every count a whole percent. */
const percentTotals = [20, 25, 40, 50, 60, 75, 80, 100] as const;
function rowCounts(total: number, percent: number) {
  const yes = (total * percent) / 100;
  return [yes, total - yes] as [number, number];
}
function percentRow(r: Random, total: number) {
  const step = 100 / gcdInt(total, 100);
  let p: number;
  do p = step * r(1, Math.floor(99 / step));
  while (p < 10 || p > 90);
  return p;
}
const gcdInt = (a: number, b: number): number => (b ? gcdInt(b, a % b) : a);

function twoWayPercent(r: Random): Draft {
  const c = tableContexts[r(0, tableContexts.length - 1)]!;
  const totals = [0, 1].map(
    () => percentTotals[r(0, percentTotals.length - 1)]!,
  );
  const ps = totals.map((t) => percentRow(r, t));
  const counts = [
    rowCounts(totals[0]!, ps[0]!),
    rowCounts(totals[1]!, ps[1]!),
  ] as [[number, number], [number, number]];
  const i = r(0, 1);
  return {
    prompt: `${c.intro} What percent of the ${c.nouns[i]} ${c.trait}?`,
    figure: table(c, counts, undefined, [
      step(
        `Only the ${c.rows[i]} row: ${counts[i]![0]} “Yes” out of a row total of ${totals[i]}.`,
        act.highlight(`t.row.${i}`),
        act.highlight(`t.cell.${i}.0`),
        act.highlight(`t.cell.${i}.2`),
      ),
    ]),
    answer: `${ps[i]}`,
    hint: `Stay in the ${c.rows[i]} row: divide its “Yes” count by its row total, ${totals[i]}, not by the table total.`,
    explanation: [
      `The question is about ${c.nouns[i]} only: the ${c.rows[i]} row, ${totals[i]} ${c.everyone}.`,
      `${counts[i]![0]} of ${totals[i]} ${c.trait}: ${counts[i]![0]} ÷ ${totals[i]} = ${rational(counts[i]![0], totals[i]!)}.`,
      `${rational(counts[i]![0], totals[i]!)} = ${ps[i]}%.`,
    ],
  };
}

function twoWayAssociation(r: Random): Draft {
  const c = tableContexts[r(0, tableContexts.length - 1)]!;
  const associated = r(0, 1) === 1;
  let totals: number[], ps: number[], counts: [number, number][];
  for (;;) {
    totals = [0, 1].map(() => percentTotals[r(0, percentTotals.length - 1)]!);
    if (totals[0] === totals[1]) continue;
    ps = totals.map((t) => percentRow(r, t));
    counts = totals.map((t, k) => rowCounts(t, ps[k]!));
    const gap = Math.abs(ps[0]! - ps[1]!),
      countGap = Math.abs(counts[0]![0]! - counts[1]![0]!);
    // Counts and percents disagree, so comparing counts is the trap.
    if (associated && gap >= 30 && countGap <= 6) break;
    if (!associated && gap >= 1 && gap <= 5 && countGap >= 10) break;
  }
  const [p0, p1] = ps as [number, number],
    [a, b] = [counts[0]![0]!, counts[1]![0]!];
  const [hi, lo] = p0 > p1 ? [0, 1] : [1, 0];
  const percents = `${p0}% of ${c.nouns[0]} and ${p1}% of ${c.nouns[1]} ${c.trait}`;
  const yesLabel = `Yes: ${ps[hi]}% of ${c.nouns[hi]} ${c.trait}, but only ${ps[lo]}% of ${c.nouns[lo]}.`;
  const noLabel = `No: ${percents}, about the same.`;
  const more = a > b ? 0 : 1;
  const countLabel = associated
    ? `No: about as many ${c.nouns[0]} (${a}) as ${c.nouns[1]} (${b}) ${c.trait}.`
    : `Yes: more ${c.nouns[more]} (${counts[more]![0]}) than ${c.nouns[1 - more]} (${counts[1 - more]![0]}) ${c.trait}.`;
  const countFeedback = `The groups have different sizes (${totals[0]} and ${totals[1]}), so counts mislead. Compare percents within each row: ${percents}.`;
  return {
    prompt: `${c.intro} Is there an association between the group and whether they ${c.trait}?`,
    figure: table(
      c,
      counts as [[number, number], [number, number]],
      undefined,
      [0, 1].map((k) =>
        step(
          `${c.rows[k]}: ${counts[k]![0]} “Yes” out of ${totals[k]}.`,
          act.highlight(`t.row.${k}`),
          act.highlight(`t.cell.${k}.0`),
          act.highlight(`t.cell.${k}.2`),
        ),
      ),
    ),
    answer: "",
    hint: `The rows have different totals, ${totals[0]} and ${totals[1]}. Turn each row’s “Yes” count into a percent of its own row before comparing.`,
    explanation: [
      `${c.rows[0]}: ${a} ÷ ${totals[0]} = ${p0}%. ${c.rows[1]}: ${b} ÷ ${totals[1]} = ${p1}%.`,
      associated
        ? `The percents differ by ${Math.abs(p0 - p1)} points, so the group and whether they ${c.trait} are associated.`
        : `The percents are nearly equal, so there is no evidence of an association.`,
      "Compare relative frequencies within each row, never raw counts, when the rows have different totals.",
    ],
    choices: [
      associated
        ? { label: yesLabel, correct: true as const }
        : {
            label: yesLabel,
            feedback: `The percents differ by only ${count(Math.abs(p0 - p1), "point")}: about the same.`,
          },
      associated
        ? {
            label: noLabel,
            feedback: `Those percents are not about the same: they differ by ${Math.abs(p0 - p1)} points.`,
          }
        : { label: noLabel, correct: true as const },
      { label: countLabel, feedback: countFeedback },
    ],
  };
}

export function generateBivariateProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = bivariateTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown statistics template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const build: Record<string, (r: Random) => Draft> = {
    "scatter-association-choice": associationChoice,
    "trend-line-predict": trendPredict,
    "trend-slope-meaning": slopeMeaning,
    "two-way-missing": twoWayMissing,
    "two-way-row-percent": twoWayPercent,
    "two-way-association-choice": twoWayAssociation,
  };
  return assemble(meta, seed, r, build[templateId]!(r));
}
