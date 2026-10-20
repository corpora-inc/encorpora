import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  TemplateMetadata,
} from "./contracts";
import { act, graph, lessonStep, scene, step, table } from "./scene/author";
import {
  clean,
  conditionalBars,
  correlation,
  d,
  dataGraph,
  inside,
  leastSquares,
  mean,
  median,
  outlierWalkthrough,
  residualSticks,
  sum,
  t,
  tightenScene,
  type Axis,
} from "./algebra-statistics-scenes";
import type { Point, Scene } from "./scene/spec";
import type { Step } from "./scene/timeline";
import { pick, seeded, shuffle, type Random } from "./algebra-one-kit";
import { fiveNumbers } from "./scene/components/dot-plot";

/** Algebra 1 statistics (S-ID): center and spread with outliers and skew,
 * relative frequencies in two-way tables, least-squares lines, residuals and
 * correlation, and association versus causation. Every figure is a scene;
 * stated least-squares lines are exact for the plotted data. */
const scenes = { requiredFigureCapability: "scenes-v1" } as const;
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
export const algebraStatisticsTemplates: readonly TemplateMetadata[] = [
  {
    id: "outlier-center-shift",
    version: 1,
    ...scenes,
    ...choice,
    title: "How an outlier moves the center",
    skillId: "statistical-summary-comparison",
    gradeBand: "9–12",
    description:
      "Decide how the mean and the median change when an outlier is removed, added or corrected.",
  },
  {
    id: "skewed-box-compare",
    version: 1,
    ...scenes,
    ...choice,
    title: "Shape and spread in box plots",
    skillId: "statistical-summary-comparison",
    gradeBand: "9–12",
    description:
      "Describe the shapes of two box plots, choose the measures that suit skewed data, and tell the range from the interquartile range.",
  },
  {
    id: "relative-frequency-percent",
    version: 1,
    ...scenes,
    title: "Joint, marginal and conditional percents",
    skillId: "categorical-association",
    gradeBand: "9–12",
    description:
      "Find a joint, marginal or conditional relative frequency from a two-way table, as a percent.",
  },
  {
    id: "conditional-frequency-choice",
    version: 1,
    ...scenes,
    ...choice,
    title: "Read conditional percents",
    skillId: "categorical-association",
    gradeBand: "9–12",
    description:
      "Tell a conditional percent from its reverse and from a joint percent, and judge association by comparing conditional percents.",
  },
  {
    id: "regression-coefficient-meaning",
    version: 1,
    ...scenes,
    ...choice,
    title: "What the slope and intercept mean",
    skillId: "regression-interpretation",
    gradeBand: "9–12",
    description:
      "Interpret the slope and intercept of a least-squares line in context, with units, and recognize an intercept that has no meaning.",
  },
  {
    id: "regression-line-predict",
    version: 1,
    ...scenes,
    title: "Predict with a fitted line",
    skillId: "regression-interpretation",
    gradeBand: "9–12",
    description:
      "Use a least-squares line to predict a value, the predicted difference between two inputs, or the input for a predicted value.",
  },
  {
    id: "residual-value",
    version: 1,
    ...scenes,
    title: "Residuals",
    skillId: "residuals-correlation",
    gradeBand: "9–12",
    description:
      "Find a residual as observed minus predicted, or an observed value from its residual.",
  },
  {
    id: "correlation-choice",
    version: 1,
    ...scenes,
    ...choice,
    title: "Correlation and residual plots",
    skillId: "residuals-correlation",
    gradeBand: "9–12",
    description:
      "Estimate a correlation coefficient from a scatter plot, compare strengths, read a residual plot, and recognize a curve that correlation misses.",
  },
  {
    id: "causal-claim-choice",
    version: 1,
    ...scenes,
    ...choice,
    title: "Association or causation",
    skillId: "causal-claims",
    gradeBand: "9–12",
    description:
      "Judge what an observed association supports, and name a lurking variable or reverse causation that could explain it.",
  },
  {
    id: "study-design-choice",
    version: 1,
    ...scenes,
    ...choice,
    title: "Studies that can show a cause",
    skillId: "causal-claims",
    gradeBand: "9–12",
    description:
      "Choose a randomized experiment to test a cause, classify a study, and draw the conclusion its design supports.",
  },
];

type Choice = { label: string; correct?: true; feedback?: string };
type Case = {
  prompt: string;
  /** Exact decimal answer for number items; choice items give `choices`. */
  answer?: number;
  choices?: Choice[];
  explanation: string[];
  scene?: Scene;
  tags: string[];
  hint: string;
  hintCue?: Step[];
  walkthrough?: Scene;
};

// ---------------------------------------------------------------- numbers
const cap = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`;
const lower = (s: string) => `${s[0]!.toLowerCase()}${s.slice(1)}`;
const range = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
/** A roughly normal draw with standard deviation 1 (sum of three uniforms). */
const normal = (r: Random) =>
  (r(-1000, 1000) + r(-1000, 1000) + r(-1000, 1000)) / 1000;
/** R² of the least-squares parabola. */
function quadraticFit(points: readonly Point[]) {
  const xs = points.map((p) => p[0]);
  const s = (k: number) => sum(xs.map((x) => x ** k));
  const tt = (k: number) => sum(points.map(([x, y]) => x ** k * y));
  const m = [
    [s(4), s(3), s(2)],
    [s(3), s(2), s(1)],
    [s(2), s(1), points.length],
  ];
  const rhs = [tt(2), tt(1), tt(0)];
  const det = (a: number[][]) =>
    a[0]![0]! * (a[1]![1]! * a[2]![2]! - a[1]![2]! * a[2]![1]!) -
    a[0]![1]! * (a[1]![0]! * a[2]![2]! - a[1]![2]! * a[2]![0]!) +
    a[0]![2]! * (a[1]![0]! * a[2]![1]! - a[1]![1]! * a[2]![0]!);
  const dd = det(m);
  const c = [0, 1, 2].map(
    (k) =>
      det(m.map((row, i) => row.map((v, j) => (j === k ? rhs[i]! : v)))) / dd,
  );
  const my = mean(points.map((p) => p[1]));
  const sse = sum(
    points.map(([x, y]) => (y - (c[0]! * x * x + c[1]! * x + c[2]!)) ** 2),
  );
  const sst = sum(points.map(([, y]) => (y - my) ** 2));
  return sst ? 1 - sse / sst : 0;
}

// ------------------------------------------------- 1. outliers and center
type OutlierContext = {
  what: (n: number) => string;
  unit: string;
  cluster: [number, number];
  outlier: [number, number];
};
const outlierContexts: OutlierContext[] = [
  {
    what: (n) =>
      `the number of books each of ${n} students read over the summer`,
    unit: "books",
    cluster: [1, 9],
    outlier: [15, 24],
  },
  {
    what: (n) =>
      `the hours each of ${n} volunteers worked at a food bank last month`,
    unit: "hours",
    cluster: [2, 10],
    outlier: [16, 24],
  },
  {
    what: (n) => `the score of each of ${n} students on a quiz worth 24 points`,
    unit: "points",
    cluster: [14, 23],
    outlier: [0, 7],
  },
  {
    what: (n) => `the minutes each of ${n} riders waited for a bus one morning`,
    unit: "minutes",
    cluster: [2, 9],
    outlier: [15, 24],
  },
];
const moves = (name: string, v: number) =>
  v === 0
    ? `the ${name} does not change`
    : `the ${name} ${v > 0 ? "increases" : "decreases"} by ${d(Math.abs(v))}`;
const shift = (a: number, b: number) =>
  `${cap(moves("mean", a))}, and ${moves("median", b)}.`;
const fromTo = (a: number, b: number) =>
  a === b ? `stays at ${d(a)}` : `moves from ${d(a)} to ${d(b)}`;

function outlierShift(r: Random): Case {
  const frame = pick(r, ["remove", "add", "typo"] as const);
  const c = pick(r, outlierContexts);
  const high = c.outlier[0] > c.cluster[1];
  for (;;) {
    const k = r(7, 9);
    const base = Array.from({ length: k }, () => r(c.cluster[0], c.cluster[1]));
    const S = sum(base);
    let odd: number,
      fixed = 0;
    if (frame === "typo") {
      odd = r(c.outlier[0], c.outlier[1]);
      if ((S + odd) % (k + 1)) continue;
      const fixes = range(c.cluster[0], c.cluster[1]).filter(
        (v) => (odd - v) % (k + 1) === 0,
      );
      if (!fixes.length) continue;
      fixed = pick(r, fixes);
    } else {
      if (S % k) continue;
      const odds = range(c.outlier[0], c.outlier[1]).filter(
        (v) => (S + v) % (k + 1) === 0,
      );
      if (!odds.length) continue;
      odd = pick(r, odds);
    }
    // The data set that holds the far value, ordered as plotted.
    const full = shuffle(r, [...base, odd]);
    const at = full.indexOf(odd);
    const f = fiveNumbers(full),
      iqr = f.q3 - f.q1;
    if (high ? odd <= f.q3 + 1.5 * iqr : odd >= f.q1 - 1.5 * iqr) continue;
    const before = frame === "add" ? full.filter((_, i) => i !== at) : full;
    const after =
      frame === "remove"
        ? full.filter((_, i) => i !== at)
        : frame === "add"
          ? full
          : full.map((v, i) => (i === at ? fixed : v));
    const dm = clean(mean(after) - mean(before)),
      dmed = clean(median(after) - median(before));
    if (dm === 0 || Math.abs(dmed) >= Math.abs(dm)) continue;
    const n = before.length;
    const shown = frame === "add" ? before : full;
    const ask = "How do the mean and the median change?";
    const prompt =
      frame === "remove"
        ? `The dot plot shows ${c.what(n)}. The value ${odd} is an outlier. If it is removed, how do the mean and the median change?`
        : frame === "add"
          ? `The dot plot shows ${c.what(n)}. One more value, ${odd}, is added to the data. ${ask}`
          : `The dot plot shows ${c.what(n)}. The value ${odd} was recorded by mistake; the correct value is ${fixed}. When it is corrected, how do the mean and the median change?`;
    const hint =
      frame === "remove"
        ? `Without ${odd}, the total loses ${odd} and the count drops from ${n} to ${n - 1}. Find the mean and the median with and without it.`
        : frame === "add"
          ? `With ${odd} added, the total gains ${odd} and the count rises from ${n} to ${n + 1}. Find the mean and the median before and after.`
          : `The total changes by ${d(fixed - odd)} when ${odd} is corrected to ${fixed}, but the count stays at ${n}. Find the mean and the median before and after.`;
    const [m0, m1] = [mean(before), mean(after)],
      [d0, d1] = [median(before), median(after)];
    const choices: Choice[] = [
      { label: shift(dm, dmed), correct: true },
      {
        label: shift(dmed, dm),
        feedback: `This swaps them. The mean uses every value, so it ${fromTo(m0, m1)}; the median ${fromTo(d0, d1)}.`,
      },
      {
        label: shift(dm, dm),
        feedback: `The median depends only on the middle of the ordered values, which ${fromTo(d0, d1)}: it does not move as far as the mean.`,
      },
      {
        label: shift(0, dmed),
        feedback: `The mean is the total divided by the count, and the total changes: the mean ${fromTo(m0, m1)}.`,
      },
    ];
    return {
      prompt,
      choices,
      scene: scene({
        type: "dotPlot",
        id: "plot",
        min: 0,
        max: 24,
        mark: "dot",
        groups: [{ values: shown }],
        unit: c.unit,
      }).build({ maxHeight: 720 }),
      explanation: [
        `Mean: $${sum(before)} \\div ${before.length} = ${t(m0)}$ before and $${sum(after)} \\div ${after.length} = ${t(m1)}$ after, so ${moves("mean", dm)}.`,
        `Median: the middle of the ordered values is ${d(d0)} before and ${d(d1)} after, so ${moves("median", dmed)}.`,
        "The mean uses the size of every value, so one far value pulls it. The median depends only on the order, so it barely moves.",
        shift(dm, dmed),
      ],
      hint,
      ...(frame === "add"
        ? {}
        : {
            hintCue: [
              step(
                `${odd} sits far from the other values.`,
                act.highlight(`plot.group.0.mark.${at}`),
              ),
            ],
          }),
      walkthrough: outlierWalkthrough(
        full,
        c.unit,
        frame === "typo"
          ? { kind: "typo", index: at, fixed }
          : { kind: frame, index: at },
      ),
      tags: [frame, high ? "high" : "low"],
    };
  }
}

// ------------------------------------------------- 2. skewed box plots
type Shape = "right" | "left" | "symmetric";
const shapeText: Record<Shape, string> = {
  right: "skewed right",
  left: "skewed left",
  symmetric: "roughly symmetric",
};
const boxContexts = [
  {
    describe: "the commute times, in minutes, of the employees at two offices",
    groups: ["North office", "South office"],
    max: 60,
    step: 2,
    unit: "minutes",
  },
  {
    describe: "the weights, in pounds, of the pumpkins grown on two farms",
    groups: ["North Farm", "South Farm"],
    max: 40,
    step: 1,
    unit: "pounds",
  },
  {
    describe:
      "the times, in seconds, that students in two classes took to solve a puzzle",
    groups: ["Morning class", "Evening class"],
    max: 120,
    step: 4,
    unit: "seconds",
  },
] as const;
type Five = [number, number, number, number, number];
/** A five-number summary in grid units with a clear shape. */
function summary(r: Random, shape: Shape, cells: number): Five | null {
  if (shape === "symmetric") {
    const h = r(2, 4),
      w = r(2, 5);
    const m = r(h + w + 1, cells - h - w - 1);
    return [m - h - w, m - h, m, m + h, m + h + w];
  }
  const h1 = r(1, 3),
    h2 = r(2 * h1 + 1, 2 * h1 + 4),
    w1 = r(1, 2),
    w2 = r(Math.max(5, 3 * w1 + 1), 3 * w1 + 6);
  const span = w1 + h1 + h2 + w2;
  if (span > cells - 2) return null;
  const lo = r(1, cells - 1 - span);
  const right: Five = [lo, lo + w1, lo + w1 + h1, lo + w1 + h1 + h2, lo + span];
  if (shape === "right") return right;
  // Mirror: a long tail toward lower values.
  return right.map((v) => right[4] + right[0] - v).reverse() as Five;
}
const shapeOf = (s: Five): Shape => {
  const [lo, q1, m, q3, hi] = s;
  if (hi - q3 >= 2 * (q1 - lo) + 2 && q3 - m > m - q1) return "right";
  if (q1 - lo >= 2 * (hi - q3) + 2 && m - q1 > q3 - m) return "left";
  if (hi - q3 === q1 - lo && q3 - m === m - q1) return "symmetric";
  throw new Error("Ambiguous box-plot shape");
};

function boxScene(
  c: (typeof boxContexts)[number],
  sums: [Five, Five],
  steps?: Step[],
): Scene {
  return scene({
    type: "boxPlot",
    id: "box",
    min: 0,
    max: c.max,
    step: c.step,
    groups: sums.map((s, i) => ({
      label: c.groups[i]!,
      summary: s.map((v) => v * c.step) as Five,
    })),
    unit: c.unit,
  }).build(steps ? { steps } : {});
}
const fiveText = (label: string, s: Five, k: number) =>
  `${label}: minimum ${s[0] * k}, Q1 ${s[1] * k}, median ${s[2] * k}, Q3 ${s[3] * k}, maximum ${s[4] * k}.`;

function skewedBoxes(r: Random): Case {
  const frame = pick(r, ["shape", "measure", "spread"] as const);
  const c = pick(r, boxContexts);
  const cells = c.max / c.step;
  const [A, B] = c.groups;
  for (;;) {
    const skew: Shape = pick(r, ["right", "left"] as const);
    const plan: [Shape, Shape] =
      frame === "shape"
        ? pick(r, [
            [skew, "symmetric"],
            ["symmetric", skew],
            ["right", "left"],
            ["left", "right"],
          ] as [Shape, Shape][])
        : r(0, 1)
          ? [skew, "symmetric"]
          : ["symmetric", skew];
    const s0 = summary(r, plan[0], cells),
      s1 = summary(r, plan[1], cells);
    if (!s0 || !s1) continue;
    const sums: [Five, Five] = [s0, s1];
    const iqr = sums.map((s) => s[3] - s[1]),
      span = sums.map((s) => s[4] - s[0]);
    const k = c.step;
    const explain = [fiveText(A, s0, k), fiveText(B, s1, k)];
    const cueWhiskers = [
      step(
        "Compare each plot's two whiskers and the two parts of its box.",
        act.highlight("box.group.0.whisker"),
        act.highlight("box.group.1.whisker"),
      ),
    ];
    if (frame === "spread") {
      // One plot has the longer whiskers, the other the wider box.
      const wide = iqr[0]! > iqr[1]! ? 0 : 1;
      if (iqr[wide]! - iqr[1 - wide]! < 2 || span[1 - wide]! - span[wide]! < 2)
        continue;
      const name = (i: number) => c.groups[i]!;
      const statement = (rng: number, box: number) =>
        rng === box
          ? `${name(rng)} has the greater range and the greater IQR.`
          : `${name(rng)} has the greater range, but ${name(box)} has the greater IQR.`;
      const wideRange = 1 - wide;
      return {
        prompt: `The box plots show ${c.describe}. Which statement about their spreads is true?`,
        scene: boxScene(c, sums),
        choices: [0, 1].flatMap((rg) =>
          [0, 1].map((bx) =>
            rg === wideRange && bx === wide
              ? { label: statement(rg, bx), correct: true as const }
              : {
                  label: statement(rg, bx),
                  feedback: `Range runs whisker end to whisker end: ${name(0)} ${span[0]! * k}, ${name(1)} ${span[1]! * k}. IQR is the width of the box: ${name(0)} ${iqr[0]! * k}, ${name(1)} ${iqr[1]! * k}.`,
                },
          ),
        ),
        explanation: [
          ...explain,
          `Range = maximum − minimum: ${A} ${span[0]! * k}, ${B} ${span[1]! * k}. $\\text{IQR} = Q_3 - Q_1$: ${A} ${iqr[0]! * k}, ${B} ${iqr[1]! * k}.`,
          `${statement(wideRange, wide)} The range depends on the two most extreme values; the IQR describes the middle half of the data.`,
        ],
        hint: `Range is whisker end to whisker end; IQR is the width of the box. Read both for ${A} and for ${B}.`,
        hintCue: [
          step(
            "IQR: the width of each box.",
            act.highlight("box.group.0.box"),
            act.highlight("box.group.1.box"),
          ),
          step(
            "Range: from one whisker end to the other.",
            act.highlight("box.group.0.end"),
            act.highlight("box.group.1.end"),
          ),
        ],
        walkthrough: boxScene(c, sums, [
          step(
            `The boxes: IQR ${iqr[0]! * k} for ${A} and ${iqr[1]! * k} for ${B}.`,
            act.highlight("box.group.0.box"),
            act.highlight("box.group.1.box"),
          ),
          lessonStep(
            `The whiskers: range ${span[0]! * k} for ${A} and ${span[1]! * k} for ${B}.`,
            act.highlight("box.group.0.whisker"),
            act.highlight("box.group.1.whisker"),
          ),
        ]),
        tags: [frame],
      };
    }
    const shapes = sums.map(shapeOf) as [Shape, Shape];
    if (shapes[0] !== plan[0] || shapes[1] !== plan[1]) continue;
    const tail = (s: Shape) =>
      s === "right"
        ? "a long tail toward higher values"
        : "a long tail toward lower values";
    if (frame === "shape") {
      const flip = (s: Shape): Shape =>
        s === "right" ? "left" : s === "left" ? "right" : s;
      const label = ([a, b]: [Shape, Shape]) =>
        a === "symmetric" && b === "symmetric"
          ? "Both are roughly symmetric."
          : `${A} is ${shapeText[a]}, and ${B} is ${shapeText[b]}.`;
      const truth = shapes;
      const pool: [Shape, Shape][] = [
        [truth[1], truth[0]],
        [flip(truth[0]), flip(truth[1])],
        ["symmetric", "symmetric"],
        [flip(truth[1]), flip(truth[0])],
        [truth[0], flip(truth[1])],
        [flip(truth[0]), truth[1]],
      ];
      const seen = new Set([label(truth)]);
      const wrong: [Shape, Shape][] = [];
      for (const p of pool)
        if (!seen.has(label(p)) && wrong.length < 3) {
          seen.add(label(p));
          wrong.push(p);
        }
      const why = sums
        .map((_, i) =>
          shapes[i] === "symmetric"
            ? `${c.groups[i]}: the whiskers match and the median is in the middle of the box, so it is roughly symmetric.`
            : `${c.groups[i]}: one whisker and one part of the box are much longer, ${tail(shapes[i]!)}, so it is ${shapeText[shapes[i]!]}.`,
        )
        .join(" ");
      return {
        prompt: `The box plots show ${c.describe}. Which describes the shapes of the two distributions?`,
        scene: boxScene(c, sums),
        choices: [
          { label: label(truth), correct: true },
          ...wrong.map((w) => ({ label: label(w), feedback: why })),
        ],
        explanation: [...explain, why, label(truth)],
        hint: `In each plot, compare the two whiskers and the two parts of the box on either side of the median, first for ${A}, then for ${B}. The longer side is the tail.`,
        hintCue: cueWhiskers,
        tags: [
          frame,
          shapes.includes("symmetric") ? "one-skewed" : "both-skewed",
        ],
      };
    }
    // measure: one skewed plot decides the measures.
    const sk = shapes[0] === "symmetric" ? 1 : 0;
    const skName = c.groups[sk]!,
      symName = c.groups[1 - sk]!;
    return {
      prompt: `The box plots show ${c.describe}. Which measures should be used to compare the centers and spreads of the two groups?`,
      scene: boxScene(c, sums),
      choices: [
        {
          label: `The medians and IQRs, because ${skName} is skewed, and these are not pulled by its long tail.`,
          correct: true,
        },
        {
          label: `The medians and IQRs, because ${symName} is skewed, and these are not pulled by its long tail.`,
          feedback: `${symName} is roughly symmetric. It is ${skName} that is skewed, and that is why the median and IQR are the right measures.`,
        },
        {
          label:
            "The means and standard deviations, because they use every value.",
          feedback: `Using every value is the problem: the values in ${skName}'s long tail pull its mean and inflate its standard deviation.`,
        },
        {
          label: `The ranges, because ${skName} has the longest whisker.`,
          feedback:
            "The range uses only the two most extreme values, so a long tail makes it misleading. The IQR describes the middle half.",
        },
      ],
      explanation: [
        ...explain,
        `${skName} is ${shapeText[shapes[sk]!]}: ${tail(shapes[sk]!)}. ${symName} is roughly symmetric.`,
        "A long tail pulls the mean toward it and inflates the standard deviation, while the median and IQR depend only on the middle of the data.",
        "Compare the medians and IQRs.",
      ],
      hint: `First decide each shape: in ${A} and in ${B}, is one whisker and one part of the box much longer than the other?`,
      hintCue: cueWhiskers,
      tags: [frame, shapes[sk]!],
    };
  }
}

// ------------------------------------------------- 3–4. two-way tables
const tableContexts = [
  {
    intro: "The table shows a survey of students by grade and way to school.",
    title: "Way to school",
    rows: ["Grade 9", "Grade 12"],
    nouns: ["ninth graders", "twelfth graders"],
    columns: ["Bus", "Other"],
    phrases: ["ride the bus", "get to school another way"],
    who: "students",
  },
  {
    intro:
      "The table shows whether students play a sport and sleep 8 hours or more.",
    title: "Sleeps 8 hours or more",
    rows: ["Athlete", "Non-athlete"],
    nouns: ["athletes", "non-athletes"],
    columns: ["Yes", "No"],
    phrases: ["sleep 8 hours or more", "sleep less than 8 hours"],
    who: "students",
  },
  {
    intro:
      "The table shows how adults in two age groups prefer to watch movies.",
    title: "Prefers to watch",
    rows: ["Under 30", "30 and over"],
    nouns: ["adults under 30", "adults 30 and over"],
    columns: ["Theater", "Streaming"],
    phrases: ["prefer a theater", "prefer streaming"],
    who: "adults",
  },
  {
    intro:
      "The table shows a survey of adults by where they live and pet ownership.",
    title: "Owns a pet",
    rows: ["City", "Rural"],
    nouns: ["city residents", "rural residents"],
    columns: ["Yes", "No"],
    phrases: ["own a pet", "do not own a pet"],
    who: "adults",
  },
] as const;
type TableContext = (typeof tableContexts)[number];
type Counts = [[number, number], [number, number]];
const whole = (num: number, den: number) => (100 * num) % den === 0;
const pct = (num: number, den: number) => (100 * num) / den;

function twoWay(
  c: TableContext,
  k: Counts,
  steps?: Step[],
  band?: { column: number },
): Scene {
  const rowT = k.map((row) => row[0] + row[1]),
    colT = [0, 1].map((j) => k[0][j]! + k[1][j]!);
  return table({
    id: "t",
    title: c.title,
    columns: [c.columns[0], c.columns[1], "Total"],
    rows: [
      { label: c.rows[0], cells: [k[0][0], k[0][1], rowT[0]!] },
      { label: c.rows[1], cells: [k[1][0], k[1][1], rowT[1]!] },
      { label: "Total", cells: [colT[0]!, colT[1]!, rowT[0]! + rowT[1]!] },
    ],
    sums: true,
    ...(band ? { highlight: { columns: [band.column] } } : {}),
  }).scene(steps ? { steps } : {});
}
/** Conditioning on a column: its band, its total, then the cell in it. */
function columnWalk(
  c: TableContext,
  k: Counts,
  i: number,
  j: number,
  p: number,
): Scene {
  const total = k[0][j]! + k[1][j]!;
  return twoWay(
    c,
    k,
    [
      step(
        `Only the ${c.who} who ${c.phrases[j]}: the “${c.columns[j]}” column, ${total} in all.`,
        act.highlight(`t.cell.2.${j}`),
      ),
      lessonStep(
        `${k[i]![j]} of them are ${c.nouns[i]}: $${k[i]![j]} \\div ${total} = ${p}\\%$.`,
        act.highlight(`t.cell.${i}.${j}`),
      ),
    ],
    { column: j },
  );
}
function drawCounts(r: Random, unit: number): Counts {
  return [
    [unit * r(2, 18), unit * r(2, 18)],
    [unit * r(2, 18), unit * r(2, 18)],
  ];
}
const totals = (k: Counts) => {
  const row = k.map((x) => x[0] + x[1]),
    col = [0, 1].map((j) => k[0][j]! + k[1][j]!);
  return { row, col, n: row[0]! + row[1]! };
};

function relativeFrequency(r: Random): Case {
  const frame = pick(r, [
    "joint",
    "marginal-row",
    "marginal-column",
    "row",
    "column",
  ] as const);
  const c = pick(r, tableContexts);
  const i = r(0, 1),
    j = r(0, 1);
  for (;;) {
    const k = drawCounts(r, pick(r, [1, 2, 5]));
    const { row, col, n } = totals(k);
    const [num, den] =
      frame === "joint"
        ? [k[i]![j]!, n]
        : frame === "marginal-row"
          ? [row[i]!, n]
          : frame === "marginal-column"
            ? [col[j]!, n]
            : frame === "row"
              ? [k[i]![j]!, row[i]!]
              : [k[i]![j]!, col[j]!];
    if (!whole(num, den)) continue;
    const p = pct(num, den);
    if (p < 5 || p > 95) continue;
    const noun = c.nouns[i],
      phrase = c.phrases[j];
    const prompt =
      frame === "joint"
        ? `${c.intro} What percent of the ${n} ${c.who} surveyed are ${noun} who ${phrase}?`
        : frame === "marginal-row"
          ? `${c.intro} What percent of the ${n} ${c.who} surveyed are ${noun}?`
          : frame === "marginal-column"
            ? `${c.intro} What percent of the ${n} ${c.who} surveyed ${phrase}?`
            : frame === "row"
              ? `${c.intro} What percent of the ${noun} ${phrase}?`
              : `${c.intro} Of the ${c.who} who ${phrase}, what percent are ${noun}?`;
    const cell = `t.cell.${i}.${j}`;
    const [kind, hint, cue] =
      frame === "joint"
        ? [
            "joint",
            `A joint percent divides one cell by the table total: the ${noun} who ${phrase}, out of all ${n}.`,
            [
              step(
                "One cell, out of the table total.",
                act.highlight(cell),
                act.highlight("t.cell.2.2"),
              ),
            ],
          ]
        : frame === "marginal-row"
          ? [
              "marginal",
              `A marginal percent divides a total in the margin by the table total, ${n}: here the ${c.rows[i]} row total.`,
              [
                step(
                  "A row total, out of the table total.",
                  act.highlight(`t.cell.${i}.2`),
                  act.highlight("t.cell.2.2"),
                ),
              ],
            ]
          : frame === "marginal-column"
            ? [
                "marginal",
                `A marginal percent divides a total in the margin by the table total, ${n}: here the “${c.columns[j]}” column total.`,
                [
                  step(
                    "A column total, out of the table total.",
                    act.highlight(`t.cell.2.${j}`),
                    act.highlight("t.cell.2.2"),
                  ),
                ],
              ]
            : frame === "row"
              ? [
                  "conditional",
                  `The group is the ${noun}: divide the number who ${phrase} by the ${c.rows[i]} row total, ${row[i]}, not by ${n}.`,
                  [
                    step(
                      `Only the ${c.rows[i]} row.`,
                      act.highlight(`t.row.${i}`),
                      act.highlight(cell),
                      act.highlight(`t.cell.${i}.2`),
                    ),
                  ],
                ]
              : [
                  "conditional",
                  `The group is the ${c.who} who ${phrase}: divide the ${c.rows[i]} count in the “${c.columns[j]}” column by that column's total, ${col[j]}, not by ${n}.`,
                  [
                    step(
                      `Only the “${c.columns[j]}” column.`,
                      act.highlight(`t.column.${j}`),
                      act.highlight(cell),
                      act.highlight(`t.cell.2.${j}`),
                    ),
                  ],
                ];
    const what =
      frame === "joint"
        ? `${noun} who ${phrase}: ${num} of all ${n} ${c.who}`
        : frame === "marginal-row"
          ? `${noun}: the row total, ${num}, of all ${n} ${c.who}`
          : frame === "marginal-column"
            ? `${c.who} who ${phrase}: the column total, ${num}, of all ${n}`
            : frame === "row"
              ? `${noun}: ${num} of the ${den} in that row ${phrase}`
              : `${c.who} who ${phrase}: ${num} of the ${den} in that column are ${noun}`;
    const conditional = frame === "row" || frame === "column";
    const walk = conditional
      ? frame === "row"
        ? conditionalBars(c.rows, c.columns, k, [
            `On one count scale the rows have different lengths: ${row[0]} and ${row[1]} ${c.who}.`,
            `Stretch each row to 100%: within ${c.rows[i]}, ${k[i]![j]} of ${row[i]} is ${p}%.`,
          ])
        : columnWalk(c, k, i, j, p)
      : twoWay(c, k, [
          step(
            frame === "joint"
              ? "The cell counts both conditions at once."
              : "The total in the margin.",
            act.highlight(
              frame === "joint"
                ? cell
                : frame === "marginal-row"
                  ? `t.cell.${i}.2`
                  : `t.cell.2.${j}`,
            ),
          ),
          lessonStep(
            `Out of all ${n}: ${num} ÷ ${n} = ${p}%.`,
            act.highlight("t.cell.2.2"),
          ),
        ]);
    return {
      prompt,
      answer: p,
      scene: twoWay(c, k),
      explanation: [
        conditional
          ? `This is a conditional percent: the whole is only the ${frame === "row" ? noun : `${c.who} who ${phrase}`}, ${den} ${c.who}.`
          : `This is a ${kind} percent: the whole is everyone surveyed, ${n} ${c.who}.`,
        `${cap(what)}.`,
        `$${num} \\div ${den} = ${t(num / den)} = ${p}\\%$.`,
      ],
      hint,
      hintCue: cue as Step[],
      walkthrough: walk,
      tags: [kind, frame],
    };
  }
}

function conditionalChoice(r: Random): Case {
  const frame = pick(r, ["interpret", "pick", "association"] as const);
  const c = pick(r, tableContexts);
  const pc = (v: number) => `${d(v)}%`;
  const associated = r(0, 1) === 1;
  for (;;) {
    if (frame === "association") {
      let k: Counts;
      if (associated) {
        // Equal "yes" counts in rows of different sizes: the joint percents
        // match and the column splits evenly, but the rows differ.
        const yes = 5 * r(2, 12);
        const t0 = yes + 5 * r(1, 12),
          t1 = yes + 5 * r(1, 24);
        k = [
          [yes, t0 - yes],
          [yes, t1 - yes],
        ];
      } else {
        const u = pick(r, [1, 2, 5]);
        const t0 = u * r(4, 12),
          t1 = u * r(16, 40);
        k = [
          [r(1, t0 - 1), 0],
          [r(1, t1 - 1), 0],
        ];
        k[0][1] = t0 - k[0][0];
        k[1][1] = t1 - k[1][0];
      }
      const { row, col, n } = totals(k);
      const p = [pct(k[0][0], row[0]!), pct(k[1][0], row[1]!)];
      const jn = [pct(k[0][0], n), pct(k[1][0], n)];
      const cc = [pct(k[0][0], col[0]!), pct(k[1][0], col[0]!)];
      if (
        ![
          [k[0][0], row[0]],
          [k[1][0], row[1]],
          [k[0][0], n],
          [k[1][0], n],
          [k[0][0], col[0]],
        ].every(([a, b]) => whole(a!, b!))
      )
        continue;
      const gap = Math.abs(p[0]! - p[1]!);
      if (associated ? gap < 20 : gap > 4 || Math.abs(jn[0]! - jn[1]!) < 20)
        continue;
      if (Math.min(...p) < 5 || Math.max(...p) > 95) continue;
      if (!associated && Math.abs(cc[0]! - cc[1]!) < 20) continue;
      const phrase = c.phrases[0];
      const hi = p[0]! > p[1]! ? 0 : 1;
      const yesLabel = `Yes: ${pc(p[hi]!)} of ${c.nouns[hi]} ${phrase}, but only ${pc(p[1 - hi]!)} of ${c.nouns[1 - hi]}.`;
      const noLabel = `No: ${pc(p[0]!)} of ${c.nouns[0]} and ${pc(p[1]!)} of ${c.nouns[1]} ${phrase}, about the same.`;
      const jh = jn[0]! >= jn[1]! ? 0 : 1;
      const jointLabel = associated
        ? `No: ${pc(jn[0]!)} of everyone surveyed are ${c.nouns[0]} who ${phrase}, and ${pc(jn[1]!)} are ${c.nouns[1]} who do.`
        : `Yes: ${pc(jn[jh]!)} of everyone surveyed are ${c.nouns[jh]} who ${phrase}, but only ${pc(jn[1 - jh]!)} are ${c.nouns[1 - jh]} who do.`;
      const ch = cc[0]! >= cc[1]! ? 0 : 1;
      const columnLabel = associated
        ? `No: of the ${c.who} who ${phrase}, half are ${c.nouns[0]} and half are ${c.nouns[1]}.`
        : `Yes: of the ${c.who} who ${phrase}, ${pc(cc[ch]!)} are ${c.nouns[ch]}, but only ${pc(cc[1 - ch]!)} are ${c.nouns[1 - ch]}.`;
      const rowsWhy = `Compare within each row: ${pc(p[0]!)} of ${c.nouns[0]} and ${pc(p[1]!)} of ${c.nouns[1]} ${phrase}.`;
      return {
        prompt: `${c.intro} Is there an association between the group and whether they ${phrase}?`,
        scene: twoWay(c, k),
        choices: [
          associated
            ? { label: yesLabel, correct: true }
            : {
                label: yesLabel,
                feedback: `${rowsWhy} They differ by only ${d(gap)} points.`,
              },
          associated
            ? {
                label: noLabel,
                feedback: `${rowsWhy} They differ by ${d(gap)} points.`,
              }
            : { label: noLabel, correct: true },
          {
            label: jointLabel,
            feedback: `Those are joint percents: out of everyone surveyed, they mostly reflect how big each group is. ${rowsWhy}`,
          },
          {
            label: columnLabel,
            feedback: `That splits the ${c.who} who ${phrase} by group, which mostly reflects how big each group is. ${rowsWhy}`,
          },
        ],
        explanation: [
          `${c.rows[0]}: $${k[0][0]} \\div ${row[0]} = ${p[0]}\\%$. ${c.rows[1]}: $${k[1][0]} \\div ${row[1]} = ${p[1]}\\%$.`,
          associated
            ? `The conditional percents differ by ${d(gap)} points, so the group and whether they ${phrase} are associated.`
            : `The conditional percents are nearly equal, so there is no evidence of an association.`,
          "Joint percents and the split within a column depend on how big each group is; percents within each row do not.",
          associated ? yesLabel : noLabel,
        ],
        hint: `The rows have different totals, ${row[0]} and ${row[1]}: find the percent within each row who ${phrase}, then compare.`,
        hintCue: [
          step(
            "Each row out of its own total.",
            act.highlight("t.cell.0.0"),
            act.highlight("t.cell.0.2"),
            act.highlight("t.cell.1.0"),
            act.highlight("t.cell.1.2"),
          ),
        ],
        walkthrough: conditionalBars(c.rows, c.columns, k, [
          `On one count scale the rows differ in size: ${row[0]} and ${row[1]} ${c.who}.`,
          `Each row as 100%: ${pc(p[0]!)} against ${pc(p[1]!)}.`,
        ]),
        tags: [frame, associated ? "associated" : "not-associated"],
      };
    }
    // interpret / pick: the four readings of a cell must be whole and distinct.
    const k = drawCounts(r, 5);
    const { row, col, n } = totals(k);
    const i = r(0, 1),
      j = r(0, 1);
    const cell = k[i]![j]!;
    const readings: [number, number][] = [
      [cell, row[i]!],
      [cell, col[j]!],
      [cell, n],
      [row[i]!, n],
    ];
    if (!readings.every(([a, b]) => whole(a, b))) continue;
    const values = readings.map(([a, b]) => pct(a, b));
    if (
      new Set(values).size < 4 ||
      Math.min(...values) < 5 ||
      Math.max(...values) > 95
    )
      continue;
    const noun = c.nouns[i],
      phrase = c.phrases[j];
    const describe = (q: number, v: string) =>
      [
        `${v} of ${noun} ${phrase}.`,
        `${v} of the ${c.who} who ${phrase} are ${noun}.`,
        `${v} of everyone surveyed are ${noun} who ${phrase}.`,
        `${v} of everyone surveyed are ${noun}.`,
      ][q]!;
    const whyOf = (q: number) =>
      [
        `the ${noun}, the ${c.rows[i]} row total, ${row[i]}`,
        `the ${c.who} who ${phrase}, the “${c.columns[j]}” column total, ${col[j]}`,
        `everyone surveyed, ${n}`,
        `everyone surveyed, ${n}`,
      ][q]!;
    if (frame === "interpret") {
      const q = r(0, 3);
      const [a, b] = readings[q]!;
      const v = pc(values[q]!);
      return {
        prompt: `${c.intro} One calculation from the table is $${a} \\div ${b} = ${values[q]}\\%$. What does this percent describe?`,
        scene: twoWay(c, k),
        choices: [0, 1, 2, 3].map((x) =>
          x === q
            ? { label: describe(x, v), correct: true as const }
            : {
                label: describe(x, v),
                feedback: `That statement divides by ${whyOf(x)}, which gives ${pc(values[x]!)}. The calculation divides by ${b}.`,
              },
        ),
        explanation: [
          `In the calculation, ${a} is the part and ${b} is the whole: the whole is ${whyOf(q)}.`,
          `So ${values[q]}% describes this: ${describe(q, v)}`,
        ],
        hint: `Find ${a} and ${b} in the table. The divisor, ${b}, names the group the percent is out of.`,
        tags: [frame, ["row", "column", "joint", "marginal"][q]!],
      };
    }
    // pick: a conditional percent, with its reverse and the joint percent as traps.
    const reverse = r(0, 1) === 1;
    const want = reverse ? 1 : 0;
    const prompt = reverse
      ? `${c.intro} Of the ${c.who} who ${phrase}, what percent are ${noun}?`
      : `${c.intro} What percent of the ${noun} ${phrase}?`;
    const traps = [
      `That divides by ${whyOf(0)}: the percent of ${noun} who ${phrase}.`,
      `That divides by ${whyOf(1)}: the percent of the ${c.who} who ${phrase} who are ${noun}.`,
      `That divides by ${whyOf(2)}: a joint percent.`,
      `That is the percent of everyone surveyed who are ${noun}.`,
    ];
    return {
      prompt,
      scene: twoWay(c, k),
      choices: [0, 1, 2, 3].map((x) =>
        x === want
          ? { label: pc(values[x]!), correct: true as const }
          : { label: pc(values[x]!), feedback: traps[x]! },
      ),
      explanation: [
        `The group comes after “of”: ${whyOf(want)}.`,
        `$${cell} \\div ${readings[want]![1]} = ${values[want]}\\%$.`,
        reverse
          ? `${pc(values[1]!)} of the ${c.who} who ${phrase} are ${noun}.`
          : `${pc(values[0]!)} of ${noun} ${phrase}.`,
      ],
      hint: reverse
        ? `The group is the ${c.who} who ${phrase}: use the “${c.columns[j]}” column total, not the ${c.rows[i]} row total or ${n}.`
        : `The group is the ${noun}: use the ${c.rows[i]} row total, not the “${c.columns[j]}” column total or ${n}.`,
      hintCue: [
        step(
          reverse
            ? `Only the “${c.columns[j]}” column.`
            : `Only the ${c.rows[i]} row.`,
          act.highlight(reverse ? `t.column.${j}` : `t.row.${i}`),
        ),
      ],
      walkthrough: reverse
        ? columnWalk(c, k, i, j, values[1]!)
        : conditionalBars(c.rows, c.columns, k, [
            `Each row as a bar: ${row[0]} and ${row[1]} ${c.who}.`,
            `Within ${c.rows[i]}, ${cell} of ${row[i]} is ${values[0]}%.`,
          ]),
      tags: [frame, reverse ? "column" : "row"],
    };
  }
}

// ------------------------------------------------- 5–7. least squares
type RegressionContext = {
  key: string;
  x: Axis;
  y: Axis;
  xs: [number, number];
  who: [string, string];
  describe: (n: number) => string;
  vars: string;
  xWhat: string;
  yWhat: string;
  /** Slope in tenths and intercept, in reach of the axes. */
  line: (r: Random) => [number, number];
  noise: number;
  rate: (k: string, up: boolean) => string;
  swapped: (k: string, up: boolean) => string;
  atZero: (v: string) => string;
  /** Whether x = 0 is in the data, so the intercept has a meaning. */
  zero: boolean;
  outside: (b: string) => string;
  units: [string, string, string, string];
  short: [string, string];
  predictQ: (x: number) => string;
  diffQ: (a: number, b: number) => string;
  solveQ: (y: string) => string;
  pointQ: (x: number, y: string) => string;
  observedQ: (x: number, e: string) => string;
  tableQ: (x: number) => string;
  yUnit: (v: string) => string;
};
const hours = (n: number) => `${n} ${n === 1 ? "hour" : "hours"}`;
const years = (n: number) => `${n} ${n === 1 ? "year" : "years"}`;
const regressionContexts: RegressionContext[] = [
  {
    key: "practice",
    x: { label: "practice (hours)", start: 0, end: 10, step: 1 },
    y: { label: "test score", start: 30, end: 100, step: 10 },
    xs: [0, 10],
    who: ["student", "students"],
    describe: (n) =>
      `the hours of practice and the test score of each of ${n} students`,
    vars: "where $x$ is hours of practice and $\\hat{y}$ is the predicted score",
    xWhat: "hours of practice",
    yWhat: "score",
    line: (r) => [pick(r, [25, 30, 35, 40, 45]), r(38, 50)],
    noise: 6,
    rate: (k, up) =>
      `Each additional hour of practice goes with a predicted score ${k} points ${up ? "higher" : "lower"}.`,
    swapped: (k, up) =>
      `Each additional point of score goes with ${k} ${up ? "more" : "fewer"} predicted hours of practice.`,
    atZero: (v) =>
      `a student who practices 0 hours has a predicted score of ${v} points`,
    zero: true,
    outside: () => "0 hours of practice is outside the data.",
    units: ["points per hour", "hours per point", "points", "hours"],
    short: ["Hours", "Score"],
    predictQ: (x) =>
      `Use the line to predict the score of a student who practices ${hours(x)}.`,
    diffQ: (a, b) =>
      `Two students practice ${hours(a)} and ${hours(b)}. By how many points do their predicted scores differ?`,
    solveQ: (y) =>
      `For how many hours of practice does the line predict a score of ${y}?`,
    pointQ: (x, y) =>
      `One student practiced ${hours(x)} and scored ${y}. What is the residual for this student?`,
    observedQ: (x, e) =>
      `Another student, not in the plot, practiced ${hours(x)}, and the residual for this student is ${e}. What score did this student earn?`,
    tableQ: (x) =>
      `What is the missing residual, for the student who practiced ${hours(x)}?`,
    yUnit: (v) => `${v} points`,
  },
  {
    key: "car",
    x: { label: "age (years)", start: 0, end: 12, step: 1 },
    y: { label: "value (thousand $)", start: 0, end: 32, step: 4 },
    xs: [0, 12],
    who: ["car", "cars"],
    describe: (n) =>
      `the age and the value, in thousands of dollars, of each of ${n} used cars`,
    vars: "where $x$ is the age in years and $\\hat{y}$ is the predicted value in thousands of dollars",
    xWhat: "age",
    yWhat: "value",
    line: (r) => [pick(r, [-15, -20]), r(27, 30)],
    noise: 3,
    rate: (k, up) =>
      `Each additional year of age goes with a predicted value ${k} thousand dollars ${up ? "higher" : "lower"}.`,
    swapped: (k, up) =>
      `Each additional thousand dollars of value goes with a predicted age ${k} years ${up ? "higher" : "lower"}.`,
    atZero: (v) =>
      `a new car, 0 years old, has a predicted value of ${v} thousand dollars`,
    zero: true,
    outside: () => "a car 0 years old is outside the data.",
    units: [
      "thousand dollars per year",
      "years per thousand dollars",
      "thousand dollars",
      "years",
    ],
    short: ["Age (years)", "Value"],
    predictQ: (x) =>
      `Use the line to predict the value, in thousands of dollars, of a car that is ${years(x)} old.`,
    diffQ: (a, b) =>
      `Two cars are ${a} and ${b} years old. By how many thousand dollars do their predicted values differ?`,
    solveQ: (y) =>
      `At what age, in years, does the line predict a value of ${y} thousand dollars?`,
    pointQ: (x, y) =>
      `One car is ${years(x)} old and worth ${y} thousand dollars. What is the residual for this car?`,
    observedQ: (x, e) =>
      `Another car, not in the plot, is ${years(x)} old, and the residual for this car is ${e}. What is its value, in thousands of dollars?`,
    tableQ: (x) =>
      `What is the missing residual, for the car that is ${years(x)} old?`,
    yUnit: (v) => `${v} thousand dollars`,
  },
  {
    key: "height",
    x: { label: "height (cm)", start: 150, end: 190, step: 5 },
    y: { label: "mass (kg)", start: 40, end: 100, step: 10 },
    xs: [152, 188],
    who: ["adult", "adults"],
    describe: (n) => `the height and the mass of each of ${n} adults`,
    vars: "where $x$ is the height in centimeters and $\\hat{y}$ is the predicted mass in kilograms",
    xWhat: "height",
    yWhat: "mass",
    line: (r) => {
      const m10 = pick(r, [8, 9, 11, 12]);
      return [m10, r(48, 56) - 15 * m10];
    },
    noise: 5,
    rate: (k, up) =>
      `Each additional centimeter of height goes with a predicted mass ${k} kg ${up ? "higher" : "lower"}.`,
    swapped: (k, up) =>
      `Each additional kilogram of mass goes with a predicted height ${k} cm ${up ? "greater" : "less"}.`,
    atZero: (v) => `a person 0 cm tall has a predicted mass of ${v} kg`,
    zero: false,
    outside: (b) =>
      `a height of 0 cm is far outside the data, and a mass of ${b} kg is impossible.`,
    units: [
      "kilograms per centimeter",
      "centimeters per kilogram",
      "kilograms",
      "centimeters",
    ],
    short: ["Height (cm)", "Mass (kg)"],
    predictQ: (x) =>
      `Use the line to predict the mass, in kilograms, of an adult who is ${x} cm tall.`,
    diffQ: (a, b) =>
      `Two adults are ${a} cm and ${b} cm tall. By how many kilograms do their predicted masses differ?`,
    solveQ: (y) =>
      `For what height, in centimeters, does the line predict a mass of ${y} kg?`,
    pointQ: (x, y) =>
      `One adult is ${x} cm tall and has a mass of ${y} kg. What is the residual for this adult?`,
    observedQ: (x, e) =>
      `Another adult, not in the plot, is ${x} cm tall, and the residual for this adult is ${e}. What is this adult's mass, in kilograms?`,
    tableQ: (x) =>
      `What is the missing residual, for the adult who is ${x} cm tall?`,
    yUnit: (v) => `${v} kg`,
  },
  {
    key: "lemonade",
    x: { label: "high temperature (°F)", start: 60, end: 100, step: 5 },
    y: { label: "cups sold", start: 0, end: 160, step: 20 },
    xs: [62, 98],
    who: ["day", "days"],
    describe: (n) =>
      `the high temperature and the cups of lemonade a stand sold on each of ${n} days`,
    vars: "where $x$ is the high temperature in degrees Fahrenheit and $\\hat{y}$ is the predicted number of cups sold",
    xWhat: "the high temperature",
    yWhat: "cups sold",
    line: (r) => {
      const m10 = pick(r, [20, 25, 30]);
      return [m10, r(22, 36) - 6 * m10];
    },
    noise: 12,
    rate: (k, up) =>
      `Each additional degree goes with ${k} ${up ? "more" : "fewer"} predicted cups sold.`,
    swapped: (k, up) =>
      `Each additional cup sold goes with a predicted high ${k} degrees ${up ? "warmer" : "cooler"}.`,
    atZero: (v) => `on a 0-degree day the stand has a predicted ${v} cups sold`,
    zero: false,
    outside: (b) =>
      `a high of 0 degrees is far outside the data, and ${b} cups is impossible.`,
    units: ["cups per degree", "degrees per cup", "cups", "degrees"],
    short: ["High (°F)", "Cups sold"],
    predictQ: (x) =>
      `Use the line to predict the cups sold on a day with a high of ${x} degrees.`,
    diffQ: (a, b) =>
      `One day has a high of ${a} degrees and another ${b} degrees. By how many cups do their predicted sales differ?`,
    solveQ: (y) =>
      `For what high temperature, in degrees, does the line predict ${y} cups sold?`,
    pointQ: (x, y) =>
      `On one day the high was ${x} degrees and the stand sold ${y} cups. What is the residual for this day?`,
    observedQ: (x, e) =>
      `On another day, not in the plot, the high was ${x} degrees, and the residual for this day is ${e}. How many cups did the stand sell?`,
    tableQ: (x) =>
      `What is the missing residual, for the day with a high of ${x} degrees?`,
    yUnit: (v) => `${v} cups`,
  },
];
const equation = (m: number, b: number) =>
  `\\hat{y} = ${t(m)}x${b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${t(Math.abs(b))}`}`;
/** "2.5(7) + 31" substituted into the line. */
const substituted = (m: number, b: number, x: number) =>
  `${t(m)}(${x})${b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${t(Math.abs(b))}`}`;

type Fitted = {
  c: RegressionContext;
  m: number;
  b: number;
  points: Point[];
  /** Residuals, y − ŷ, in tenths. */
  e10: number[];
  hat: (x: number) => number;
};
/** Data whose least-squares line is exactly ŷ = mx + b: interior residuals
 * are drawn, and the two extreme points absorb Σe = 0 and Σxe = 0. */
function fitted(r: Random, c: RegressionContext): Fitted {
  for (;;) {
    const [m10, b] = c.line(r);
    const hat10 = (x: number) => m10 * x + 10 * b;
    const n = r(8, 12);
    let xs = shuffle(r, range(c.xs[0], c.xs[1])).slice(0, n);
    if (c.zero && !xs.includes(0)) xs[0] = 0;
    xs = [...new Set(xs)].sort((a, z) => a - z);
    if (xs.length < 8) continue;
    const ys10 = xs.map(
      (x) => 10 * Math.round((hat10(x) + 10 * r(-c.noise, c.noise)) / 10),
    );
    const e10 = ys10.map((y, i) => y - hat10(xs[i]!));
    const last = xs.length - 1;
    const s0 = sum(e10.slice(1, last)),
      s1 = sum(e10.slice(1, last).map((e, i) => e * xs[i + 1]!));
    const [xp, xq] = [xs[0]!, xs[last]!];
    const top = -s1 + xp * s0;
    if (top % (xq - xp)) continue;
    const eq = top / (xq - xp),
      ep = -s0 - eq;
    if (Math.abs(ep) > 15 * c.noise || Math.abs(eq) > 15 * c.noise) continue;
    e10[0] = ep;
    e10[last] = eq;
    const points: Point[] = xs.map((x, i) => [x, (hat10(x) + e10[i]!) / 10]);
    if (!points.every(([, y]) => inside(c.y, y, c.y.step / 4))) continue;
    if (!inside(c.y, hat10(c.xs[0]) / 10) || !inside(c.y, hat10(c.xs[1]) / 10))
      continue;
    return {
      c,
      m: m10 / 10,
      b,
      points,
      e10,
      hat: (x) => clean(hat10(x) / 10),
    };
  }
}
function fitScene(
  f: Fitted,
  options: {
    residuals?: boolean;
    predict?: number;
    mark?: Point;
    steps?: Step[];
    extra?: (g: ReturnType<typeof dataGraph>) => ReturnType<typeof dataGraph>;
  } = {},
): Scene {
  let g = dataGraph(f.c.x, f.c.y).scatter(
    f.points,
    { m: f.m, b: f.b },
    options.residuals ?? false,
  );
  if (options.predict !== undefined) g = g.predict(options.predict);
  if (options.mark)
    g = g.point(options.mark[0], options.mark[1], undefined, { open: true });
  if (options.extra) g = options.extra(g);
  return g.scene(options.steps ? { steps: options.steps } : {});
}

function coefficientMeaning(r: Random): Case {
  const frame = pick(r, ["slope", "intercept", "units"] as const);
  const c = pick(r, regressionContexts);
  const f = fitted(r, c);
  const { m, b } = f;
  const eq = equation(m, b);
  const n = f.points.length;
  const lead = `The scatter plot shows ${c.describe(n)}, with the least-squares line $${eq}$, ${c.vars}.`;
  const k = d(Math.abs(m)),
    up = m > 0;
  const cue = [step("The least-squares line.", act.highlight("g.fit"))];
  if (frame === "slope") {
    const correct = c.rate(k, up);
    return {
      prompt: `${lead} What does the slope mean in this context?`,
      scene: fitScene(f),
      choices: [
        { label: correct, correct: true },
        {
          label: c.swapped(k, up),
          feedback: `This swaps the variables. The slope is the change in predicted ${c.yWhat} for each 1 more unit of ${c.xWhat}.`,
        },
        {
          label: `${cap(c.atZero(k))}.`,
          feedback: `That is how the $y$-intercept is read, and the intercept here is ${d(b)}. The slope is a rate of change.`,
        },
        {
          label: c.rate(k, !up),
          feedback: `The slope is ${d(m)}, ${up ? "positive" : "negative"}: the line ${up ? "rises" : "falls"} from left to right.`,
        },
      ],
      explanation: [
        `The slope is the coefficient of $x$: ${d(m)}.`,
        `It is the change in predicted ${c.yWhat} for each 1 more unit of ${c.xWhat}, in the units of the context.`,
        correct,
      ],
      hint: `The slope is the number multiplying $x$, ${d(m)}. Say what changes in $\\hat{y}$ when $x$ goes up by 1.`,
      hintCue: cue,
      tags: [frame, c.key, up ? "positive" : "negative"],
    };
  }
  if (frame === "units") {
    const [right, ...wrong] = c.units;
    return {
      prompt: `${lead} In what units is the slope measured?`,
      scene: fitScene(f),
      choices: [
        { label: right, correct: true },
        ...wrong.map((u, i) => ({
          label: u,
          feedback:
            i === 0
              ? `That is upside down. Slope = change in ${c.yWhat} ÷ change in ${c.xWhat}.`
              : `A slope is a rate: a change in ${c.yWhat} for each 1 more unit of ${c.xWhat}, so its units are a ratio.`,
        })),
      ],
      explanation: [
        `Slope = change in $\\hat{y}$ ÷ change in $x$: ${c.yWhat} ÷ ${c.xWhat}.`,
        `So the slope, ${d(m)}, is in ${right}.`,
      ],
      hint: `The slope, ${d(m)}, is a change in $\\hat{y}$ divided by a change in $x$. Write the units of each and divide.`,
      hintCue: cue,
      tags: [frame, c.key],
    };
  }
  const bText = d(b);
  const yes = `Yes: ${c.atZero(bText)}.`;
  const no = `No: ${c.outside(bText)}`;
  return {
    prompt: `${lead} Does the $y$-intercept, ${bText}, have a meaning in this context?`,
    scene: fitScene(f),
    choices: [
      c.zero
        ? { label: yes, correct: true }
        : {
            label: yes,
            feedback: `That is what the equation gives at $x = 0$, but $x = 0$ is far outside the data (${c.xs[0]} to ${c.xs[1]}), so the prediction there describes nothing real.`,
          },
      c.zero
        ? {
            label: no,
            feedback: `The data include $x = 0$, so the intercept is a prediction inside the data and has a meaning.`,
          }
        : { label: no, correct: true },
      {
        label: `Yes: ${lower(c.rate(d(Math.abs(b)), b > 0))}`,
        feedback: `That describes a slope. The $y$-intercept is the predicted value at $x = 0$.`,
      },
      {
        label: "No: a $y$-intercept never has a meaning in context.",
        feedback: `It has one when $x = 0$ is a sensible value inside the data${c.zero ? ", as here." : "; here it is not."}`,
      },
    ],
    explanation: [
      `The $y$-intercept is the predicted value at $x = 0$: $\\hat{y} = ${t(b)}$.`,
      c.zero
        ? `The data include $x = 0$, so this prediction is inside the data: ${c.atZero(bText)}.`
        : `The data run from ${c.xs[0]} to ${c.xs[1]}, so $x = 0$ is far outside them: ${c.outside(bText)}`,
      c.zero ? yes : no,
    ],
    hint: `The $y$-intercept, ${bText}, is the prediction at $x = 0$. Is $x = 0$ inside the data, and is ${bText} a possible value?`,
    hintCue: cue,
    tags: [frame, c.zero ? "meaningful" : "extrapolation", c.key],
  };
}

function linePredict(r: Random): Case {
  const frame = pick(r, ["predict", "difference", "solve"] as const);
  const c = pick(r, regressionContexts);
  const f = fitted(r, c);
  const { m, b } = f;
  const eq = equation(m, b);
  const n = f.points.length;
  const lead = `The scatter plot shows ${c.describe(n)}, with the least-squares line $${eq}$, ${c.vars}.`;
  const lo = c.xs[0] + 1,
    hi = c.xs[1] - 1;
  if (frame === "predict") {
    const X = r(lo, hi),
      Y = f.hat(X);
    return {
      prompt: `${lead} ${c.predictQ(X)}`,
      answer: Y,
      scene: fitScene(f, { predict: X }),
      explanation: [
        `Substitute $x = ${X}$: $\\hat{y} = ${substituted(m, b, X)} = ${t(m * X)} ${b < 0 ? "-" : "+"} ${t(Math.abs(b))} = ${t(Y)}$.`,
        `A real ${c.who[0]} may be above or below the line. The line predicts ${c.yUnit(d(Y))}.`,
      ],
      hint: `Substitute $x = ${X}$ into $${eq}$, multiplying first.`,
      hintCue: [
        step(
          `Up from $x = ${X}$ to the line.`,
          act.highlight("g.predict.guide.up"),
          act.highlight("g.fit"),
        ),
      ],
      walkthrough: fitScene(f, {
        predict: X,
        steps: [
          step(
            `Up from $x = ${X}$ to the line.`,
            act.trace("g.predict.guide.up"),
            act.appear("g.predict"),
          ),
          lessonStep(
            `Across to the axis: $${substituted(m, b, X)} = ${t(Y)}$.`,
            act.trace("g.predict.guide.across"),
            act.appear("g.predict.label"),
          ),
        ],
      }),
      tags: [frame, c.key],
    };
  }
  if (frame === "difference") {
    let a: number, z: number;
    do {
      a = r(lo, hi);
      z = r(lo, hi);
    } while (z - a < 3);
    const diff = clean(Math.abs(m) * (z - a));
    return {
      prompt: `${lead} ${c.diffQ(a, z)}`,
      answer: diff,
      scene: fitScene(f),
      explanation: [
        `The slope, ${d(m)}, is the predicted change for each 1 more unit of ${c.xWhat}.`,
        `From ${a} to ${z} is ${z - a} more, so the predictions differ by $${t(Math.abs(m))} \\times ${z - a} = ${t(diff)}$.`,
        `Check: the line predicts ${d(f.hat(a))} and ${d(f.hat(z))}, and $${t(f.hat(z))} - ${t(f.hat(a))} = ${t(f.hat(z) - f.hat(a))}$.`,
        `The predictions differ by ${c.yUnit(d(diff))}.`,
      ],
      hint: `The slope, ${d(m)}, is the predicted change for each 1 more unit of ${c.xWhat}. How many units apart are ${a} and ${z}?`,
      hintCue: [step("The line's steady slope.", act.highlight("g.fit"))],
      walkthrough: fitScene(f, {
        steps: [
          step(
            `Run: from ${a} to ${z} is ${z - a}.`,
            act.appear("g.slope.0.run"),
          ),
          lessonStep(
            `Rise: $${t(Math.abs(m))} \\times ${z - a} = ${t(diff)}$.`,
            act.appear("g.slope.0.rise"),
          ),
        ],
        extra: (g) => g.slope([a, f.hat(a)], [z, f.hat(z)], "shown"),
      }),
      tags: [frame, c.key],
    };
  }
  const X = r(lo, hi),
    Y = f.hat(X);
  const lhs = clean(Y - b);
  return {
    prompt: `${lead} ${c.solveQ(d(Y))}`,
    answer: X,
    scene: fitScene(f),
    explanation: [
      `Set the prediction equal to ${d(Y)}: $${t(m)}x ${b < 0 ? "-" : "+"} ${t(Math.abs(b))} = ${t(Y)}$.`,
      `${b < 0 ? "Add" : "Subtract"} ${d(Math.abs(b))}: $${t(m)}x = ${t(lhs)}$. Divide by ${d(m)}: $x = ${X}$.`,
      `Check: $${substituted(m, b, X)} = ${t(Y)}$. So $x = ${X}$.`,
    ],
    hint: `Solve $${t(m)}x ${b < 0 ? "-" : "+"} ${t(Math.abs(b))} = ${t(Y)}$ for $x$: undo the ${d(Math.abs(b))} first.`,
    hintCue: [
      step(
        "Find the height on the line, then read down.",
        act.highlight("g.fit"),
      ),
    ],
    walkthrough: fitScene(f, {
      steps: [
        step(`Across from ${d(Y)} to the line.`, act.trace("g.segment.0")),
        lessonStep(
          `Down to the axis: $x = ${X}$.`,
          act.trace("g.segment.1"),
          act.appear("g.point"),
        ),
      ],
      extra: (g) =>
        g
          .segment([c.x.start, Y], [X, Y], { dash: "dash", color: "warm" })
          .segment([X, Y], [X, c.y.start], { dash: "dash", color: "warm" })
          .point(X, Y),
    }),
    tags: [frame, c.key],
  };
}

function residualValue(r: Random): Case {
  const frame = pick(r, ["point", "observed", "table"] as const);
  const c = pick(r, regressionContexts);
  const f = fitted(r, c);
  const { m, b } = f;
  const eq = equation(m, b);
  const n = f.points.length;
  const lead = `The scatter plot shows ${c.describe(n)}, with the least-squares line $${eq}$, ${c.vars}.`;
  const interior = range(1, n - 2).filter((i) => f.e10[i] !== 0);
  if (frame === "point") {
    const i = pick(r, interior);
    const [x, y] = f.points[i]!;
    const e = clean(y - f.hat(x));
    return {
      prompt: `${lead} ${c.pointQ(x, d(y))}`,
      answer: e,
      scene: fitScene(f, { residuals: true, mark: [x, y] }),
      explanation: [
        `Predicted: $\\hat{y} = ${substituted(m, b, x)} = ${t(f.hat(x))}$.`,
        `Residual = observed − predicted: $${t(y)} - ${t(f.hat(x))} = ${t(e)}$.`,
        e > 0
          ? `The residual is ${d(e)}: positive, because the point lies above the line.`
          : `The residual is ${d(e)}: negative, because the point lies below the line.`,
      ],
      hint: `Find the predicted value at $x = ${x}$ from $${eq}$, then subtract it from the observed ${d(y)}.`,
      hintCue: [
        step(
          "The gap from this point to the line.",
          act.highlight(`g.residual.${i}`),
          act.highlight("g.point"),
        ),
      ],
      walkthrough: residualSticks(
        f,
        [
          "Each residual is observed − predicted: the vertical stick from a point to the line.",
          `At $x = ${x}$: $${t(y)} - ${t(f.hat(x))} = ${t(e)}$.`,
        ],
        i,
      ),
      tags: [frame, e > 0 ? "above" : "below", c.key],
    };
  }
  if (frame === "observed") {
    const used = new Set(f.points.map((p) => p[0]));
    const free = range(c.xs[0] + 1, c.xs[1] - 1).filter((x) => !used.has(x));
    const X = free.length ? pick(r, free) : r(c.xs[0] + 1, c.xs[1] - 1);
    let e: number;
    do e = r(-2 * c.noise, 2 * c.noise) / 2;
    while (e === 0 || !inside(c.y, f.hat(X) + e));
    const y = clean(f.hat(X) + e);
    return {
      prompt: `${lead} ${c.observedQ(X, d(e))}`,
      answer: y,
      scene: fitScene(f, { residuals: true }),
      explanation: [
        `Residual = observed − predicted, so observed = predicted + residual.`,
        `Predicted: $\\hat{y} = ${substituted(m, b, X)} = ${t(f.hat(X))}$.`,
        `Observed: $${t(f.hat(X))} ${e < 0 ? "-" : "+"} ${t(Math.abs(e))} = ${t(y)}$, so the observed value is ${c.yUnit(d(y))}.`,
      ],
      hint: `Observed = predicted + residual. Start with the predicted value at $x = ${X}$, then add ${d(e)}.`,
      hintCue: [
        step("Each stick is one residual.", act.highlight("g.residual")),
      ],
      walkthrough: dataGraph(c.x, c.y)
        .scatter(f.points, { m, b }, true)
        .point(X, y)
        .segment([X, f.hat(X)], [X, y], { color: "warm" })
        .scene({
          steps: [
            step(
              "A residual is the vertical gap from the line to the point.",
              act.trace("g.residual"),
            ),
            lessonStep(
              `From the line at ${d(f.hat(X))}, move ${d(e)}: ${d(y)}.`,
              act.trace("g.segment.0"),
              act.appear("g.point"),
            ),
          ],
        }),
      tags: [frame, e > 0 ? "above" : "below", c.key],
    };
  }
  // table: four rows with their residuals; one residual to find.
  const rows = shuffle(r, interior)
    .slice(0, 4)
    .sort((a, z) => a - z);
  const ask = r(0, rows.length - 1);
  const cells = rows.map((i) => {
    const [x, y] = f.points[i]!;
    return { x, y, e: clean(y - f.hat(x)) };
  });
  const target = cells[ask]!;
  const tableOf = (reveal: boolean, steps?: Step[]) =>
    table({
      id: "t",
      corner: c.short[0],
      columns: [c.short[1], "Residual"],
      rows: cells.map((cell, k) => ({
        label: d(cell.x),
        cells: [cell.y, k === ask && !reveal ? null : cell.e],
      })),
    }).scene(steps ? { steps } : {});
  return {
    prompt: `The table lists ${cells.length} of the ${n} ${c.who[1]} in a data set, with residuals from the least-squares line $${eq}$, ${c.vars}. ${c.tableQ(target.x)}`,
    answer: target.e,
    scene: tableOf(false),
    explanation: [
      `Predicted: $\\hat{y} = ${substituted(m, b, target.x)} = ${t(f.hat(target.x))}$.`,
      `Residual = observed − predicted: $${t(target.y)} - ${t(f.hat(target.x))} = ${t(target.e)}$. The missing residual is ${d(target.e)}.`,
    ],
    hint: `For $x = ${target.x}$, find the predicted value from $${eq}$, then subtract it from the observed ${d(target.y)}.`,
    hintCue: [step("The row to finish.", act.highlight(`t.row.${ask}`))],
    walkthrough: tableOf(true, [
      step(
        `Predicted at $x = ${target.x}$: ${d(f.hat(target.x))}.`,
        act.highlight(`t.row.${ask}`),
        act.highlight(`t.cell.${ask}.0`),
      ),
      lessonStep(
        `Observed − predicted: $${t(target.y)} - ${t(f.hat(target.x))} = ${t(target.e)}$.`,
        act.highlight(`t.cell.${ask}.1`),
      ),
    ]),
    tags: [frame, target.e > 0 ? "above" : "below", c.key],
  };
}

// ------------------------------------------------- 8. correlation
const correlationContexts = [
  {
    sign: 1,
    describe: (n: number) =>
      `the hours of practice and the test score of each of ${n} students`,
    x: { label: "practice (hours)", start: 0, end: 10, step: 1 },
    y: { label: "test score", start: 30, end: 100, step: 10 },
  },
  {
    sign: 1,
    describe: (n: number) =>
      `the height and the arm span of each of ${n} adults`,
    x: { label: "height (cm)", start: 150, end: 190, step: 5 },
    y: { label: "arm span (cm)", start: 150, end: 190, step: 5 },
  },
  {
    sign: -1,
    describe: (n: number) => `the age and the value of each of ${n} used cars`,
    x: { label: "age (years)", start: 0, end: 12, step: 1 },
    y: { label: "value (thousand $)", start: 0, end: 32, step: 4 },
  },
  {
    sign: -1,
    describe: (n: number) =>
      `the price of a cup of lemonade and the cups sold on each of ${n} days`,
    x: { label: "price (cents)", start: 25, end: 100, step: 5 },
    y: { label: "cups sold", start: 0, end: 80, step: 10 },
  },
  {
    sign: 0,
    describe: (n: number) =>
      `the commute time and the hours of sleep of each of ${n} workers`,
    x: { label: "commute (minutes)", start: 0, end: 60, step: 10 },
    y: { label: "sleep (hours)", start: 4, end: 10, step: 1 },
  },
  {
    sign: 0,
    describe: (n: number) =>
      `the shoe size and the quiz score of each of ${n} students`,
    x: { label: "shoe size", start: 4, end: 12, step: 1 },
    y: { label: "quiz score", start: 0, end: 10, step: 1 },
  },
] as const;
const rValues = [-0.95, -0.6, 0, 0.6, 0.95];
/** A cloud of points whose correlation is within 0.08 of the target. */
function cloud(
  r: Random,
  x: Axis,
  y: Axis,
  target: number,
  n: number,
): Point[] {
  const xspan = x.end - x.start,
    yspan = y.end - y.start;
  for (;;) {
    const xs = Array.from({ length: n }, () =>
      clean(x.start + (xspan * r(5, 95)) / 100),
    );
    const mx = mean(xs),
      sx = Math.sqrt(mean(xs.map((v) => (v - mx) ** 2)));
    const slope = (Math.sign(target) * 0.55 * yspan) / xspan;
    const level = y.start + yspan / 2;
    const sd =
      target === 0
        ? yspan / 5
        : Math.abs(slope) * sx * Math.sqrt(1 / target ** 2 - 1);
    const points: Point[] = xs.map((v) => [
      v,
      clean(Math.round((level + slope * (v - mx) + sd * normal(r)) * 10) / 10),
    ]);
    if (!points.every(([, v]) => inside(y, v, yspan / 40))) continue;
    const rr = correlation(points);
    if (Math.abs(rr - target) <= (target === 0 ? 0.1 : 0.06)) return points;
  }
}
const curveContexts = [
  {
    describe: (n: number) =>
      `the hour of the day and the temperature at ${n} times during one day`,
    x: { label: "hour of the day", start: 6, end: 20, step: 2 },
    y: { label: "temperature (°F)", start: 40, end: 90, step: 10 },
    names: ["the hour", "the temperature"],
    xs: [6, 20],
    f: (v: number) => 84 - 0.7 * (v - 13) ** 2,
    noise: 1.5,
  },
  {
    describe: (n: number) =>
      `the speed and the fuel economy of a car on ${n} test drives`,
    x: { label: "speed (mph)", start: 20, end: 80, step: 10 },
    y: { label: "miles per gallon", start: 10, end: 40, step: 5 },
    names: ["speed", "fuel economy"],
    xs: [20, 80],
    f: (v: number) => 37 - 0.014 * (v - 50) ** 2,
    noise: 1,
  },
  {
    describe: (n: number) =>
      `the time and the height of a thrown ball at ${n} moments`,
    x: { label: "time (seconds)", start: 0, end: 4, step: 0.5 },
    y: { label: "height (feet)", start: 0, end: 70, step: 10 },
    names: ["time", "height"],
    xs: [0, 4],
    f: (v: number) => 4 + 64 * v - 16 * v * v,
    noise: 1.5,
  },
] as const;
const residualContexts = [
  {
    describe: (n: number) =>
      `the speed and the stopping distance of a car in ${n} braking tests`,
    x: { label: "speed (mph)", start: 20, end: 70, step: 10 },
    xWhat: "speed",
    xs: [20, 70],
    f: (v: number) => 0.05 * v * v + v,
    noise: 4,
  },
  {
    describe: (n: number) =>
      `the minutes since a cup of tea was poured and its temperature at ${n} times`,
    x: { label: "time (minutes)", start: 0, end: 60, step: 10 },
    xWhat: "time",
    xs: [0, 60],
    f: (v: number) => 70 + 110 * 0.95 ** v,
    noise: 1.5,
  },
] as const;

function correlationChoice(r: Random): Case {
  const frame = pick(r, [
    "estimate",
    "strongest",
    "residual-plot",
    "nonlinear",
  ] as const);
  if (frame === "estimate") {
    const target = pick(r, rValues);
    const c = pick(
      r,
      correlationContexts.filter((x) => x.sign === Math.sign(target)),
    );
    const n = r(10, 12);
    const points = cloud(r, c.x, c.y, target, n);
    const rr = correlation(points);
    const others = shuffle(
      r,
      rValues.filter((v) => v !== target),
    ).slice(0, 3);
    const label = (v: number) => d(v);
    return {
      prompt: `The scatter plot shows ${c.describe(n)}. Which value is closest to the correlation coefficient, $r$?`,
      scene: dataGraph(c.x, c.y).scatter(points).scene(),
      choices: [
        { label: label(target), correct: true },
        ...others.map((v) => ({
          label: label(v),
          feedback:
            Math.sign(v) !== Math.sign(target)
              ? target === 0
                ? "These points show no trend up or down, so $r$ is near 0."
                : v === 0
                  ? `The points do trend ${target > 0 ? "upward" : "downward"}, so $r$ is not near 0.`
                  : `The points trend ${target > 0 ? "upward" : "downward"}, so $r$ is ${target > 0 ? "positive" : "negative"}.`
              : Math.abs(v) > Math.abs(target)
                ? "The points scatter too widely around a line for $r$ to be that close to ±1."
                : "The points hug a line more tightly than that: $r$ is closer to ±1.",
        })),
      ],
      explanation: [
        target === 0
          ? "The points show no upward or downward trend."
          : `The points trend ${target > 0 ? "upward" : "downward"}, so $r$ is ${target > 0 ? "positive" : "negative"}.`,
        target === 0
          ? "So $r$ is near 0."
          : Math.abs(target) > 0.9
            ? "They lie close to a line, so $r$ is near ±1."
            : "They follow a line loosely, so $r$ is between 0 and ±1.",
        `For these points $r \\approx ${t(Math.round(rr * 100) / 100)}$, closest to ${d(target)}.`,
      ],
      hint: `Read the ${n} points left to right: the direction gives the sign of $r$, and how tightly they hug a line gives its size.`,
      ...(target === 0 ? {} : { walkthrough: tightenScene(c.x, c.y, points) }),
      tags: [
        frame,
        target === 0 ? "none" : Math.abs(target) > 0.9 ? "strong" : "moderate",
      ],
    };
  }
  if (frame === "strongest") {
    for (;;) {
      const top = r(80, 97) / 100;
      const sign = r(0, 9) < 6 ? -1 : 1;
      const rest = [r(top * 100 - 18, top * 100 - 6), r(20, 70), r(0, 40)].map(
        (v, i) => (i === 0 ? -sign : pick(r, [-1, 1])) * (v / 100),
      );
      const all = [sign * top, ...rest];
      if (new Set(all.map((v) => Math.abs(v))).size < 4) continue;
      const strongest = sign * top;
      const decoy = rest[0]!;
      return {
        prompt:
          "Four data sets have the correlation coefficients below. Which shows the strongest linear association?",
        choices: all.map((v) =>
          v === strongest
            ? { label: `$r = ${t(v)}$`, correct: true as const }
            : {
                label: `$r = ${t(v)}$`,
                feedback:
                  v === decoy
                    ? `The sign shows direction only. ${d(strongest)} is ${d(Math.abs(strongest))} from 0, farther than ${d(v)}.`
                    : `Strength is distance from 0: ${d(strongest)} is farther from 0 than ${d(v)}.`,
              },
        ),
        explanation: [
          "The strength of a linear association is how close $r$ is to −1 or 1: its distance from 0.",
          `The distances are ${all.map((v) => d(Math.abs(v))).join(", ")}.`,
          `The largest is ${d(top)}, for $r = ${t(strongest)}$.`,
        ],
        hint: `The sign of $r$ gives only the direction. ${d(decoy)} is ${d(Math.abs(decoy))} from 0: how far from 0 is each of the others?`,
        tags: [frame, sign < 0 ? "negative-strongest" : "positive-strongest"],
      };
    }
  }
  if (frame === "nonlinear") {
    const c = pick(r, curveContexts);
    for (;;) {
      const n = r(9, 12);
      const xs = [
        ...new Set(
          Array.from({ length: n }, () =>
            clean(c.xs[0] + ((c.xs[1] - c.xs[0]) * r(0, 20)) / 20),
          ),
        ),
      ].sort((a, z) => a - z);
      if (xs.length < 8) continue;
      const points: Point[] = xs.map((v) => [
        v,
        clean(Math.round((c.f(v) + c.noise * normal(r)) * 10) / 10),
      ]);
      if (!points.every(([, v]) => inside(c.y, v))) continue;
      const rr = Math.round(correlation(points) * 100) / 100;
      if (Math.abs(rr) > 0.12 || quadraticFit(points) < 0.9) continue;
      const [xn, yn] = c.names;
      return {
        prompt: `The scatter plot shows ${c.describe(xs.length)}. For these data, $r = ${t(rr)}$. Which statement is true?`,
        scene: dataGraph(c.x, c.y).scatter(points).scene(),
        choices: [
          {
            label:
              "The points follow a clear curve; $r$ is near 0 because it measures only linear association.",
            correct: true,
          },
          {
            label: `Because $r$ is near 0, there is no relationship between ${xn} and ${yn}.`,
            feedback: `The points follow a clear curve, so ${xn} and ${yn} are related. $r$ measures only how well a straight line fits.`,
          },
          {
            label: "Because $r$ is near 0, a line fits these data well.",
            feedback: "A value of $r$ near 0 means a line fits poorly.",
          },
          {
            label: "The points show a strong positive linear association.",
            feedback: `They rise and then fall, so no single line fits, and $r = ${t(rr)}$ is near 0.`,
          },
        ],
        explanation: [
          `The points rise and then fall along a curve: ${xn} and ${yn} are strongly related.`,
          `$r = ${t(rr)}$ is near 0 because no straight line fits a pattern that rises and then falls.`,
          "A correlation near 0 means no linear association, not no association.",
        ],
        hint: `$r = ${t(rr)}$ measures how closely the ${xs.length} points follow a straight line. What shape do they actually follow?`,
        tags: [frame],
      };
    }
  }
  // residual plot: a curve in the residuals, or none.
  const curved = r(0, 1) === 1;
  for (;;) {
    let points: Point[], describe: string, xLabel: Axis, xWhat: string;
    if (curved) {
      const c = pick(r, residualContexts);
      const n = r(9, 12);
      const xs = [
        ...new Set(Array.from({ length: n }, () => r(c.xs[0], c.xs[1]))),
      ].sort((a, z) => a - z);
      if (xs.length < 8) continue;
      points = xs.map((v) => [
        v,
        clean(Math.round((c.f(v) + c.noise * normal(r)) * 10) / 10),
      ]);
      describe = c.describe(xs.length);
      xLabel = c.x;
      xWhat = c.xWhat;
    } else {
      const c = pick(r, regressionContexts);
      const f = fitted(r, c);
      points = f.points;
      describe = c.describe(points.length);
      xLabel = c.x;
      xWhat = c.xWhat;
    }
    const fit = leastSquares(points);
    const res: Point[] = points.map(([x, y]) => [
      x,
      clean(Math.round((y - (fit.m * x + fit.b)) * 10) / 10),
    ]);
    const q = quadraticFit(res);
    if (curved ? q < 0.7 : q > 0.25) continue;
    const big = Math.max(...res.map((p) => Math.abs(p[1])));
    const stepY = [1, 2, 5, 10, 20, 50].find((s) => 4 * s >= big) ?? 50;
    const yAxis = {
      label: "residual",
      start: -5 * stepY,
      end: 5 * stepY,
      step: stepY,
    };
    if (!res.every(([, v]) => inside(yAxis, v))) continue;
    const n = points.length;
    const good =
      "The residuals scatter with no pattern around 0, so a line is a good model.";
    const bent =
      "The residuals follow a curve, so a curved model would fit better than a line.";
    const sc = graph({
      id: "g",
      x: [xLabel.start, xLabel.end],
      y: [yAxis.start, yAxis.end],
      grid: [xLabel.step, yAxis.step],
      tick: [xLabel.step, 2 * yAxis.step],
      axisNames: [xLabel.label, "residual"],
      frame: true,
      aspect: Math.max(
        0.05,
        (0.6 * (xLabel.end - xLabel.start)) / (yAxis.end - yAxis.start),
      ),
    })
      .scatter(res, { m: 0, b: 0 })
      .scene();
    return {
      prompt: `A line was fit to ${describe}. The residual plot shows each residual, observed − predicted, against ${xWhat}. What does it show about the line?`,
      scene: sc,
      choices: [
        curved
          ? {
              label: good,
              feedback:
                "Read left to right: the residuals bend, positive at one stage and negative at another, in a curve. That pattern is what the line missed.",
            }
          : { label: good, correct: true },
        curved
          ? { label: bent, correct: true }
          : {
              label: bent,
              feedback:
                "Read left to right: the residuals jump above and below 0 with no curve, which is what a good linear fit leaves behind.",
            },
        {
          label: "Some residuals are negative, so the line is a poor fit.",
          feedback:
            "Every least-squares line has negative residuals: points below the line. The pattern matters, not the signs.",
        },
        {
          label:
            "About half the residuals are positive, so the correlation is 0.",
          feedback:
            "Residuals of a least-squares line always balance around 0, whatever the correlation. Look for a pattern.",
        },
      ],
      explanation: [
        "A residual plot shows what the line missed: each point's residual against $x$.",
        curved
          ? "Here the residuals follow a curve, so the data bend away from the line in a regular way."
          : "Here the residuals scatter above and below 0 with no curve, so the line has captured the pattern.",
        curved ? bent : good,
      ],
      hint: `Read the ${n} residuals left to right along ${xWhat}: do they bend in a curve, or jump above and below 0 at random?`,
      hintCue: [step("Residual 0: the fitted line.", act.highlight("g.fit"))],
      tags: [frame, curved ? "curved" : "random"],
    };
  }
}

// ------------------------------------------------- 9. causal claims
type CausalContext = {
  key: string;
  setting: string;
  x: string;
  y: string;
  cause: string;
  intervene: string;
  lurking?: { right: string; decoys: [string, string, string]; why: string };
  reverse?: { right: string; other: string };
  plot: { x: Axis; y: Axis; sign: 1 | -1; n: number };
};
const causalContexts: CausalContext[] = [
  {
    key: "ice-cream",
    setting:
      "On each of 30 summer days, a beach town recorded how many ice cream cones were sold and how many people were treated for sunburn. Days with more cones sold tended to have more sunburns.",
    x: "ice cream sales",
    y: "sunburns",
    cause: "eating ice cream makes sunburn more likely",
    intervene: "Banning ice cream sales would prevent sunburns.",
    lurking: {
      right: "How hot and sunny each day was",
      decoys: [
        "The flavors of ice cream on sale",
        "The color of the ice cream cones",
        "The number of people treated for sunburn",
      ],
      why: "hot, sunny days bring more people to the beach, where they buy ice cream and get sunburned",
    },
    plot: {
      x: { label: "cones sold", start: 0, end: 500, step: 50 },
      y: { label: "sunburns", start: 0, end: 40, step: 5 },
      sign: 1,
      n: 30,
    },
  },
  {
    key: "fires",
    setting:
      "For 40 house fires, a city recorded how many firefighters were sent and the damage, in thousands of dollars. Fires with more firefighters tended to have more damage.",
    x: "the number of firefighters",
    y: "the damage",
    cause: "sending more firefighters causes more damage",
    intervene: "Sending fewer firefighters would reduce the damage.",
    lurking: {
      right: "The size of each fire",
      decoys: [
        "The color of the fire trucks",
        "The names of the firefighters",
        "The amount of damage",
      ],
      why: "a bigger fire both draws more firefighters and does more damage",
    },
    plot: {
      x: { label: "firefighters", start: 0, end: 40, step: 5 },
      y: { label: "damage (thousand $)", start: 0, end: 400, step: 50 },
      sign: 1,
      n: 40,
    },
  },
  {
    key: "feet",
    setting:
      "At an elementary school, 50 students from every grade had their foot length and reading score recorded. Students with longer feet tended to have higher reading scores.",
    x: "foot length",
    y: "reading score",
    cause: "longer feet make students better readers",
    intervene: "Buying students bigger shoes would raise their reading scores.",
    lurking: {
      right: "The students' ages",
      decoys: [
        "The colors of the students' shoes",
        "The day the scores were recorded",
        "The students' reading scores",
      ],
      why: "older students have longer feet and have had more years of reading",
    },
    plot: {
      x: { label: "foot length (cm)", start: 14, end: 26, step: 1 },
      y: { label: "reading score", start: 0, end: 100, step: 10 },
      sign: 1,
      n: 50,
    },
  },
  {
    key: "police",
    setting:
      "A study of 25 cities found that cities with more police officers tended to have more reported crimes.",
    x: "the number of police officers",
    y: "the number of crimes",
    cause: "police officers cause crime",
    intervene: "Cutting the number of police officers would reduce crime.",
    lurking: {
      right: "The population of each city",
      decoys: [
        "The color of the police cars",
        "The year each city was founded",
        "The number of reported crimes",
      ],
      why: "a bigger city has more people to commit crimes and hires more officers",
    },
    reverse: {
      right: "Cities with more crime hire more police officers.",
      other: "Bigger cities have both more officers and more crimes.",
    },
    plot: {
      x: { label: "officers (hundreds)", start: 0, end: 20, step: 2 },
      y: { label: "crimes (thousands)", start: 0, end: 50, step: 5 },
      sign: 1,
      n: 25,
    },
  },
  {
    key: "tutoring",
    setting:
      "At one school, the 60 students who visited the tutoring center more often during a term tended to have lower grades.",
    x: "tutoring visits",
    y: "grades",
    cause: "going to tutoring lowers grades",
    intervene: "Closing the tutoring center would raise grades.",
    reverse: {
      right: "Students who already have low grades go to tutoring more often.",
      other:
        "Students in harder courses both get lower grades and seek more help.",
    },
    plot: {
      x: { label: "tutoring visits", start: 0, end: 20, step: 2 },
      y: { label: "grade (%)", start: 50, end: 100, step: 10 },
      sign: -1,
      n: 60,
    },
  },
  {
    key: "exercise",
    setting:
      "In a survey of 80 adults, those who exercised more hours each week tended to report lower stress.",
    x: "exercise",
    y: "stress",
    cause: "exercising lowers stress",
    intervene:
      "Requiring everyone to exercise more would lower everyone's stress.",
    reverse: {
      right: "Adults with less stress have more time and energy to exercise.",
      other:
        "Adults with more free time both exercise more and feel less stress.",
    },
    plot: {
      x: { label: "exercise (hours/week)", start: 0, end: 10, step: 1 },
      y: { label: "stress score", start: 0, end: 10, step: 1 },
      sign: -1,
      n: 80,
    },
  },
];
const studyCount = (c: CausalContext) => c.plot.n;

function causalClaim(r: Random): Case {
  const frame = pick(r, ["conclusion", "lurking", "reverse"] as const);
  const pool = causalContexts.filter((c) =>
    frame === "lurking" ? c.lurking : frame === "reverse" ? c.reverse : true,
  );
  const c = pick(r, pool);
  const N = studyCount(c);
  if (frame === "conclusion") {
    const { x, y, sign } = c.plot;
    const points = cloud(r, x, y, 0.6 * sign, Math.min(c.plot.n, 40));
    const right = `${cap(c.x)} and ${c.y} are associated, but these data cannot show a cause.`;
    return {
      prompt: `${c.setting} Which conclusion do the data support?`,
      scene: dataGraph(x, y).scatter(points).scene(),
      choices: [
        { label: right, correct: true },
        {
          label: `The data show that ${c.cause}.`,
          feedback: `Nobody assigned ${c.x}; the data were only observed. An association like this can come from a third variable or from cause and effect running the other way.`,
        },
        {
          label: c.intervene,
          feedback: `That claims a cause. Observed data cannot show what would happen if ${c.x} were changed.`,
        },
        {
          label: `Because association is not causation, ${c.x} and ${c.y} are not related.`,
          feedback:
            "They are related: the scatter plot shows a clear trend. What the data cannot show is why.",
        },
      ],
      explanation: [
        `The scatter plot shows an association between ${c.x} and ${c.y}.`,
        `The ${N} cases were observed, not assigned, so something else could produce the pattern${c.lurking ? `: ${c.lurking.why}` : ""}.`,
        right,
      ],
      hint: `Ask how the ${N} cases were collected: did anyone assign ${c.x}, or was it only recorded?`,
      tags: [frame, c.key],
    };
  }
  if (frame === "lurking") {
    const l = c.lurking!;
    return {
      prompt: `${c.setting} Which is a lurking variable that could explain this association?`,
      choices: [
        { label: l.right, correct: true },
        ...l.decoys.map((decoy, i) => ({
          label: decoy,
          feedback:
            i === 2
              ? "That is one of the two variables in the association. A lurking variable is a third variable that affects both."
              : `That has no plausible effect on both ${c.x} and ${c.y}.`,
        })),
      ],
      explanation: [
        `A lurking variable is a third variable that affects both ${c.x} and ${c.y}, creating an association without either causing the other.`,
        `${l.right}: ${l.why}.`,
        l.right,
      ],
      hint: `Look for a third variable, not one of the two measured over the ${N} cases, that could push ${c.x} and ${c.y} in the same direction at once.`,
      tags: [frame, c.key],
    };
  }
  const rv = c.reverse!;
  return {
    prompt: `${c.setting} Which explanation reverses cause and effect?`,
    choices: [
      { label: rv.right, correct: true },
      {
        label: `${cap(c.cause)}.`,
        feedback: `That is the direct reading: ${c.x} causing ${c.y}. Reverse causation runs from ${c.y} to ${c.x}.`,
      },
      {
        label: rv.other,
        feedback:
          "That is a lurking variable: a third cause of both. Reverse causation has the second variable causing the first.",
      },
      {
        label: "The association happened by chance, so it means nothing.",
        feedback: `That does not name any cause, and a clear trend over ${N} cases is unlikely to be chance alone.`,
      },
    ],
    explanation: [
      `The direct reading is that ${c.cause}.`,
      `Reverse causation runs the other way, from ${c.y} to ${c.x}: ${rv.right.toLowerCase().replace(/\.$/, "")}.`,
      rv.right,
    ],
    hint: `Swap the roles: could ${c.y} be what changes ${c.x} among the ${N} cases?`,
    tags: [frame, c.key],
  };
}

// ------------------------------------------------- 10. study design
type StudyContext = {
  key: string;
  subjects: string;
  question: string;
  claim: string;
  random: (n: number) => string;
  observed: (n: number) => string;
  design: [string, string, string, string];
  rows: [string, string];
  /** The groups as nouns: "app group". */
  groups: [string, string];
  columns: [string, string];
  title: string;
  better: string;
};
const studyContexts: StudyContext[] = [
  {
    key: "app",
    subjects: "students",
    question: "whether a vocabulary app raises quiz scores",
    claim: "the app raises quiz scores",
    random: (n) =>
      `Researchers randomly assigned ${n} students either to use a vocabulary app or to study as usual for a month.`,
    observed: (n) =>
      `Researchers asked ${n} students whether they had used a vocabulary app during the month.`,
    design: [
      "Randomly assign students to use the app or to study as usual, then compare their quiz scores.",
      "Compare the quiz scores of students who already use the app with those who do not.",
      "Give the app to every student, then compare their quiz scores before and after.",
      "Let each student choose whether to use the app, then compare their quiz scores.",
    ],
    rows: ["App", "No app"],
    groups: ["app group", "no-app group"],
    columns: ["Passed", "Did not pass"],
    title: "Vocabulary quiz",
    better: "passed the quiz",
  },
  {
    key: "fertilizer",
    subjects: "bean plants",
    question: "whether a new fertilizer makes bean plants grow taller",
    claim: "the fertilizer makes the plants grow taller",
    random: (n) =>
      `A gardener randomly assigned ${n} bean plants either to get a new fertilizer or to get plain water for a month.`,
    observed: (n) =>
      `A gardener surveyed ${n} bean plants in local gardens and noted which ones their owners had given a new fertilizer.`,
    design: [
      "Randomly assign plants to get the fertilizer or plain water, then compare their growth.",
      "Compare plants in gardens that already use the fertilizer with plants in gardens that do not.",
      "Give the fertilizer to every plant, then compare their heights before and after.",
      "Give the fertilizer to the plants by the sunny window and water to the rest, then compare their growth.",
    ],
    rows: ["Fertilizer", "Water only"],
    groups: ["fertilizer group", "water group"],
    columns: ["Grew 10+ cm", "Grew less"],
    title: "Growth in a month",
    better: "grew 10 cm or more",
  },
  {
    key: "stretching",
    subjects: "runners",
    question: "whether a stretching routine prevents injuries",
    claim: "the stretching routine prevents injuries",
    random: (n) =>
      `A coach randomly assigned ${n} runners either to do a stretching routine before every run or to skip it for one season.`,
    observed: (n) =>
      `A coach asked ${n} runners whether they had stretched before their runs during one season.`,
    design: [
      "Randomly assign runners to stretch or not, then compare their injuries over a season.",
      "Compare injuries among runners who already stretch and runners who do not.",
      "Have every runner stretch, then compare this season's injuries with last season's.",
      "Let each runner choose whether to stretch, then compare their injuries.",
    ],
    rows: ["Stretched", "Did not"],
    groups: ["stretching group", "no-stretching group"],
    columns: ["No injury", "Injured"],
    title: "Season result",
    better: "stayed free of injury",
  },
  {
    key: "reminder",
    subjects: "library members",
    question: "whether a reminder text gets library books returned on time",
    claim: "the reminder text gets books returned on time",
    random: (n) =>
      `A library randomly assigned ${n} members either to get a reminder text before their due date or to get no text.`,
    observed: (n) =>
      `A library looked at ${n} members and noted which ones had signed up for reminder texts.`,
    design: [
      "Randomly assign members to get a reminder text or no text, then compare on-time returns.",
      "Compare on-time returns of members who signed up for texts with those who did not.",
      "Text every member, then compare on-time returns this month with last month.",
      "Let each member choose whether to get texts, then compare on-time returns.",
    ],
    rows: ["Text", "No text"],
    groups: ["text group", "no-text group"],
    columns: ["On time", "Late"],
    title: "Book returned",
    better: "returned their books on time",
  },
];
const kinds = {
  experimentCause: "It is an experiment, so it can show cause and effect.",
  observationalAssociation:
    "It is an observational study, so it can show an association but not cause and effect.",
  experimentAssociation:
    "It is an experiment, but it can show only an association.",
  observationalCause:
    "It is an observational study, and it can show cause and effect.",
};

function studyDesign(r: Random): Case {
  const frame = pick(r, ["design", "identify", "conclusion"] as const);
  const c = pick(r, studyContexts);
  if (frame === "design") {
    const [right, ...wrong] = c.design;
    const why = [
      "Those groups chose themselves, so they may differ in other ways that affect the outcome.",
      "With no comparison group, a change could come from time, practice or anything else that changed.",
      "The groups formed by choice or by a plan, so they may differ in ways other than the treatment.",
    ];
    return {
      prompt: `A researcher wants to know ${c.question}. Which study can show this?`,
      choices: [
        { label: right, correct: true },
        ...wrong.map((label, i) => ({ label, feedback: why[i]! })),
      ],
      explanation: [
        "To show a cause, the groups must differ only in the treatment.",
        "Random assignment makes the groups alike, on average, in everything else, and a comparison group shows what happens without the treatment.",
        right,
      ],
      hint: `Look for the study in which the researcher decides, by chance, which ${c.subjects} get the treatment, and compares them with ${c.subjects} who do not.`,
      tags: [frame, c.key],
    };
  }
  const n = 2 * r(15, 50);
  const randomized = r(0, 1) === 1;
  if (frame === "identify") {
    const text = randomized ? c.random(n) : c.observed(n);
    const right = randomized
      ? kinds.experimentCause
      : kinds.observationalAssociation;
    return {
      prompt: `${text} They then compared the two groups. Which describes this study?`,
      choices: Object.values(kinds).map((label) =>
        label === right
          ? { label, correct: true as const }
          : {
              label,
              feedback: randomized
                ? "The researchers assigned the treatment at random, so this is an experiment, and random assignment is what lets it show cause and effect."
                : "The researchers only recorded what the subjects already did, so this is an observational study, and it cannot rule out other differences between the groups.",
            },
      ),
      explanation: [
        randomized
          ? "The researchers imposed the treatment by random assignment: an experiment."
          : "The researchers only observed which subjects had the treatment: an observational study.",
        randomized
          ? "Random assignment balances other differences, so a clear difference in outcomes is evidence of cause and effect."
          : "The groups chose themselves, so they may differ in other ways; the study can show association only.",
        right,
      ],
      hint: `Ask who decided which of the ${n} ${c.subjects} got the treatment: the researcher, by chance, or the ${c.subjects} themselves?`,
      tags: [frame, randomized ? "experiment" : "observational", c.key],
    };
  }
  // conclusion: a results table; counts favor the control, percents the treatment.
  for (;;) {
    const t0 = 5 * r(4, 12),
      t1 = 5 * r(6, 24);
    if (t1 < 1.3 * t0 || t1 > 2 * t0) continue;
    const p0 = 5 * r(12, 18),
      p1 = 5 * r(6, 14);
    const a = (t0 * p0) / 100,
      b = (t1 * p1) / 100;
    if (!Number.isInteger(a) || !Number.isInteger(b) || b <= a || p0 - p1 < 20)
      continue;
    const counts: Counts = [
      [a, t0 - a],
      [b, t1 - b],
    ];
    const total = t0 + t1;
    const design = randomized ? c.random(total) : c.observed(total);
    const sizes = randomized
      ? ` The groups had ${t0} and ${t1} ${c.subjects}.`
      : "";
    const did = `The ${c.groups[0]} did better, ${p0}% to ${p1}%`;
    const random = `${did}. Random assignment makes this evidence of a cause.`;
    const notRandom = `${did}, but without random assignment this does not show a cause.`;
    const tbl = table({
      id: "t",
      title: c.title,
      columns: [c.columns[0], c.columns[1], "Total"],
      rows: [
        { label: c.rows[0], cells: [a, t0 - a, t0] },
        { label: c.rows[1], cells: [b, t1 - b, t1] },
        { label: "Total", cells: [a + b, total - a - b, total] },
      ],
      sums: true,
    }).scene();
    return {
      prompt: `${design}${sizes} The table shows the results. Which conclusion is justified?`,
      scene: tbl,
      choices: [
        randomized
          ? { label: random, correct: true }
          : {
              label: random,
              feedback:
                "The groups were not randomly assigned: the subjects were only observed, so other differences between the groups could explain the result.",
            },
        randomized
          ? {
              label: notRandom,
              feedback:
                "The groups were randomly assigned, so other differences balance out on average, and the difference is evidence of a cause.",
            }
          : { label: notRandom, correct: true },
        {
          label: `More ${c.subjects} in the ${c.groups[1]} ${c.better} (${b} against ${a}), so it does not help.`,
          feedback: `The groups have different sizes, ${t0} and ${t1}, so compare percents: ${p0}% against ${p1}%.`,
        },
        {
          label:
            "The two groups did about equally well, so there is no evidence either way.",
          feedback: `${p0}% against ${p1}% is a large difference.`,
        },
      ],
      explanation: [
        `${c.rows[0]}: $${a} \\div ${t0} = ${p0}\\%$ ${c.better}. ${c.rows[1]}: $${b} \\div ${t1} = ${p1}\\%$.`,
        randomized
          ? `The treatment was randomly assigned, so the groups were alike on average in everything else: the difference is evidence that ${c.claim}.`
          : "The subjects were only observed, so the groups may differ in other ways that affect the outcome: the difference shows association, not cause.",
        randomized ? random : notRandom,
      ],
      hint: `Compare percents, since the groups have ${t0} and ${t1} ${c.subjects}. Then ask whether the groups were formed by random assignment.`,
      hintCue: [
        step(
          "Each group out of its own total.",
          act.highlight("t.cell.0.0"),
          act.highlight("t.cell.0.2"),
          act.highlight("t.cell.1.0"),
          act.highlight("t.cell.1.2"),
        ),
      ],
      walkthrough: conditionalBars(c.rows, c.columns, counts, [
        `On one count scale the ${c.rows[1]} group looks better: ${b} against ${a}. But it is ${t1} ${c.subjects}, not ${t0}.`,
        `Each group as 100%: ${p0}% against ${p1}%.`,
      ]),
      tags: [frame, randomized ? "experiment" : "observational", c.key],
    };
  }
}

// ---------------------------------------------------------------- assembly
const builders: Record<string, (r: Random) => Case> = {
  "outlier-center-shift": outlierShift,
  "skewed-box-compare": skewedBoxes,
  "relative-frequency-percent": relativeFrequency,
  "conditional-frequency-choice": conditionalChoice,
  "regression-coefficient-meaning": coefficientMeaning,
  "regression-line-predict": linePredict,
  "residual-value": residualValue,
  "correlation-choice": correlationChoice,
  "causal-claim-choice": causalClaim,
  "study-design-choice": studyDesign,
};
const labels: Record<string, string> = {
  "relative-frequency-percent": "Percent",
  "regression-line-predict": "Answer",
  "residual-value": "Answer",
};

export function algebraStatisticsCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const meta = algebraStatisticsTemplates.find((x) => x.id === id);
  if (!meta) throw new Error(`Unknown statistics template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  const c = builders[id]!(r);
  let response: ProblemResponse, answer: string;
  let choiceFeedback: Record<string, string> | undefined;
  if (c.choices) {
    if (
      c.choices.length !== 4 ||
      c.choices.filter((x) => x.correct).length !== 1
    )
      throw new Error(`${id}: four options, one correct`);
    if (new Set(c.choices.map((x) => x.label)).size !== 4)
      throw new Error(`${id}: duplicate options`);
    const order = shuffle(
      r,
      c.choices.map((_, i) => i),
    );
    const options = order.map((source, i) => ({
      id: `option-${"abcd"[i]}`,
      label: c.choices![source]!.label,
    }));
    response = { kind: "choice", label: "Choose one answer", options };
    answer = options[order.findIndex((s) => c.choices![s]!.correct)]!.id;
    choiceFeedback = Object.fromEntries(
      order
        .map((s, i) => [options[i]!.id, c.choices![s]!.feedback] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  } else {
    if (c.answer === undefined) throw new Error(`${id}: no answer`);
    response = { kind: "number", label: labels[id] ?? "Answer" };
    answer = String(clean(c.answer));
  }
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt: c.prompt,
      response,
      ...(c.scene
        ? { figure: { kind: "scene" as const, scene: c.scene } }
        : {}),
    },
    answer,
    explanation: c.explanation,
    hint: c.hint,
    ...(c.hintCue ? { hintCue: c.hintCue } : {}),
    ...(c.walkthrough ? { walkthrough: c.walkthrough } : {}),
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
  return {
    problem,
    tags: c.tags,
    caseKey: JSON.stringify([
      c.prompt,
      c.scene ?? null,
      c.choices?.map((x) => x.label).sort() ?? null,
    ]),
  };
}
export const generateAlgebraStatisticsProblem = (
  id: string,
  seed: string,
): GeneratedProblem => algebraStatisticsCase(id, seed).problem;
