import type { TemplateMetadata } from "./contracts";
import { defineAxis, type Random } from "./variation/axes";
import { shuffle } from "./distribution-practice";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  mixedTex,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { graph } from "./scene/author";
import type { Scene } from "./scene/spec";
import { sceneSchema } from "./scene/spec";
import type { Surface } from "./variation/compose";

/**
 * Reading data displays as a learner meets them on tests:
 * - a line graph of one quantity over days or weeks (value, greatest and
 *   least, closest value, change between two points, greatest increase and
 *   decrease, and statements about the graph) or of four categories over
 *   weeks;
 * - a dot plot or line plot of whole-number or mixed-number measurements
 *   (the total, the greatest minus the least, a missing value from a total).
 * Each family holds the data once; the answer, every distractor and every
 * statement is computed from it.
 */
const choiceCap = {
  requiredResponseCapability: "single-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};
export const lineGraphReaderTemplate: TemplateMetadata = {
  id: "line-graph-reader",
  version: 1,
  title: "Read a line graph",
  skillId: "coordinate-first-quadrant",
  gradeBand: "3–5",
  difficultyOffset: 0,
  description:
    "Read a line graph of one quantity over days or weeks, or of four categories over weeks: a value, the greatest or least, the value closest to a given one, the change between two points, the greatest increase or decrease, or a true statement about the graph.",
  ...choiceCap,
};
export const dotPlotArithmeticTemplate: TemplateMetadata = {
  id: "dot-plot-arithmetic",
  version: 1,
  title: "Total and range from a dot plot",
  skillId: "fraction-plot-arithmetic",
  gradeBand: "3–5",
  difficultyOffset: 0,
  description:
    "From a dot plot or line plot of whole-number or mixed-number measurements, find the total, the greatest minus the least, or a missing value when the total is given.",
  ...choiceCap,
};

/* ------------------------------------------------------------------ */
/* 1. A line graph                                                     */
/* ------------------------------------------------------------------ */

interface Context {
  xName: string;
  xWord: string;
  yName: string;
  /** "The graph shows ..." with the count of points filled in. */
  intro: (n: number) => string;
  /** "the temperature", used in questions. */
  noun: string;
  /** A value with its unit: "55 degrees". */
  value: (v: number) => string;
  step: number;
  /** Heights are step times a whole number in this range. */
  k: [number, number];
  n: [number, number];
}
const contexts: Context[] = [
  {
    xName: "Day",
    xWord: "day",
    yName: "°F",
    intro: (n) =>
      `The graph shows the temperature at noon, in degrees Fahrenheit, on each of ${n} days.`,
    noun: "temperature",
    value: (v) => `${v} degrees`,
    step: 5,
    k: [6, 18],
    n: [6, 7],
  },
  {
    xName: "Week",
    xWord: "week",
    yName: "Boxes",
    intro: (n) =>
      `The graph shows how many boxes of soup a store sold in each of ${n} weeks.`,
    noun: "number of boxes sold",
    value: (v) => `${v} boxes`,
    step: 10,
    k: [2, 9],
    n: [5, 6],
  },
  {
    xName: "Hour",
    xWord: "hour",
    yName: "Liters",
    intro: (n) =>
      `The graph shows how many liters of water were in a tank at the end of each of ${n} hours.`,
    noun: "amount of water",
    value: (v) => `${v} liters`,
    step: 10,
    k: [1, 9],
    n: [5, 6],
  },
];
const categoryNames = ["Soccer", "Art", "Chess", "Music"];

const lineAxes = {
  ask: defineAxis("ask", [
    "greatest-point",
    "least-point",
    "value-at",
    "closest-value",
    "change-between",
    "greatest-increase",
    "greatest-decrease",
    "true-statement",
    "category-extreme",
  ] as const),
};
type LineAsk =
  | "greatest-point"
  | "least-point"
  | "value-at"
  | "closest-value"
  | "change-between"
  | "greatest-increase"
  | "greatest-decrease"
  | "true-statement"
  | "category-extreme";

interface LineModel {
  ask: LineAsk;
  ctx: Context;
  n: number;
  ys: number[];
  /** Four series for category-extreme. */
  series?: number[][];
  /** Day indexes (1-based) and a target value, as the ask needs. */
  a: number;
  b: number;
  target: number;
  bigger: boolean;
}

const rangeInts = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
const diffs = (ys: number[]) => ys.slice(1).map((v, i) => v - ys[i]!);
const argOf = (xs: number[], best: (a: number, b: number) => boolean) =>
  xs.reduce((bi, v, i) => (best(v, xs[bi]!) ? i : bi), 0);
const unique = (xs: number[], v: number) =>
  xs.filter((x) => x === v).length === 1;

function drawLine(r: Random, ctx: Context, n: number, step: number) {
  return Array.from({ length: n }, () => step * r(ctx.k[0], ctx.k[1]));
}

function lineModel(r: Random, a: { ask: LineAsk }): LineModel {
  const ctx = pick(r, contexts);
  const n = r(ctx.n[0], ctx.n[1]);
  const ask = a.ask;
  const step = ctx.step;
  if (ask === "category-extreme") {
    const series = categoryNames.map(() =>
      drawLine(r, { ...ctx, k: [2, 9] }, 5, 10),
    );
    const week = r(1, 5);
    const bigger = !!r(0, 1);
    // End labels need room: the last week's values are two or more steps apart.
    let k = r(2, 3);
    const ends = [k];
    for (let s = 1; s < 4; s++) {
      k += 2 + r(0, 1);
      ends.push(k);
    }
    if (k > 9) throw new Error("Need three retries");
    const order = shuffle(r, [0, 1, 2, 3]);
    series.forEach((s, idx) => {
      s[4] = ends[order[idx]!]! * 10;
    });
    const col = series.map((s) => s[week - 1]!);
    const target = bigger ? Math.max(...col) : Math.min(...col);
    if (!unique(col, target)) throw new Error("Need three retries");
    return {
      ask,
      ctx: { ...ctx, xName: "Week", xWord: "week", yName: "Percent", step: 10 },
      n: 5,
      ys: [],
      series,
      a: week,
      b: 0,
      target,
      bigger,
    };
  }
  const ys = drawLine(r, ctx, n, step);
  const model: LineModel = {
    ask,
    ctx,
    n,
    ys,
    a: 1,
    b: 2,
    target: 0,
    bigger: true,
  };
  const hi = Math.max(...ys),
    lo = Math.min(...ys);
  switch (ask) {
    case "greatest-point":
      if (!unique(ys, hi)) throw new Error("Need three retries");
      break;
    case "least-point":
      if (!unique(ys, lo)) throw new Error("Need three retries");
      break;
    case "value-at":
      model.a = r(1, n);
      break;
    case "closest-value": {
      const j = r(1, n);
      const delta = r(1, step - 1) * (r(0, 1) ? 1 : -1);
      model.target = ys[j - 1]! + delta;
      const dist = ys.map((v) => Math.abs(v - model.target));
      if (model.target <= 0 || model.target >= 100)
        throw new Error("Need three retries");
      if (!unique(dist, Math.min(...dist)))
        throw new Error("Need three retries");
      if (ys.includes(model.target)) throw new Error("Need three retries");
      break;
    }
    case "change-between": {
      model.a = r(1, n - 2);
      model.b = r(model.a + 2, n);
      if (ys[model.a - 1] === ys[model.b - 1])
        throw new Error("Need three retries");
      break;
    }
    case "greatest-increase": {
      const d = diffs(ys);
      if (Math.max(...d) <= 0 || !unique(d, Math.max(...d)))
        throw new Error("Need three retries");
      break;
    }
    case "greatest-decrease": {
      const d = diffs(ys);
      if (Math.min(...d) >= 0 || !unique(d, Math.min(...d)))
        throw new Error("Need three retries");
      break;
    }
    case "true-statement":
      break;
  }
  return model;
}

function lineScene(m: LineModel): Scene {
  const { ctx } = m;
  const base = graph({
    id: "g",
    x: [0, m.n + 1],
    y: [0, 100],
    grid: [1, ctx.step],
    tick: [1, 2 * ctx.step],
    axisNames: [ctx.xName, ctx.yName],
    frame: true,
  });
  const colors = ["accent", "warm", "gold", "ink"] as const;
  const draw = (
    ys: number[],
    color: (typeof colors)[number],
    name?: string,
  ) => {
    ys.forEach((y, i) => {
      if (i) base.segment([i, ys[i - 1]!], [i + 1, y], { color });
      base.point(i + 1, y, i === ys.length - 1 ? name : undefined, { color });
    });
  };
  if (m.series)
    m.series.forEach((s, i) => draw(s, colors[i]!, categoryNames[i]));
  else draw(m.ys, "accent");
  const title = m.series
    ? "Line graph of four categories over five weeks"
    : `Line graph of ${ctx.noun} for each ${ctx.xWord}`;
  return sceneSchema.parse(base.scene({ title }));
}

const day = (m: LineModel, i: number) => `${m.ctx.xName} ${i}`;
const interval = (m: LineModel, i: number) =>
  `${day(m, i)} to ${day(m, i + 1)}`;

function surfaceLine(m: LineModel, r: Random): Surface | null {
  const { ctx, ys } = m;
  const noun = ctx.noun;
  const val = (v: number) => ctx.value(v);
  const mk = (
    prompt: string,
    options: ChoiceOption[],
    hint: string,
    explanation: string[],
    label = "Choose one answer",
  ) => {
    const s = choiceSurface(r, { prompt, options, hint, explanation, label });
    return (
      s && { ...s, figure: { kind: "scene" as const, scene: lineScene(m) } }
    );
  };
  const readHint = `The graph has ${m.n} points, one for each ${ctx.xWord}. Read each point's height on the vertical scale, which counts by ${ctx.step}.`;
  const intro = m.series
    ? "The graph shows the percent of students who chose each of four activities in each of 5 weeks."
    : ctx.intro(m.n);

  if (m.ask === "category-extreme") {
    const col = m.series!.map((s) => s[m.a - 1]!);
    const winner = col.indexOf(m.target);
    const options: ChoiceOption[] = categoryNames.map((name, i) =>
      i === winner
        ? { label: name, correct: true as const }
        : {
            label: name,
            feedback: `${name} was ${col[i]}% in ${day(m, m.a)}, but ${categoryNames[winner]} was ${m.target}%, the ${m.bigger ? "greatest" : "least"} of the four.`,
          },
    );
    return mk(
      `${intro} In ${day(m, m.a)}, which activity had the ${m.bigger ? "greatest" : "least"} percent?`,
      options,
      `Find ${day(m, m.a)} on the horizontal axis and look straight up at the four points above it. The vertical scale counts by 10 percent.`,
      [
        `Each line is one activity. A point's height, read on the vertical scale, is its percent for that week.`,
        `Look straight up from ${day(m, m.a)} and read the four points: ${categoryNames.map((c, i) => `${c} ${col[i]}%`).join(", ")}.`,
        `The ${m.bigger ? "greatest" : "least"} of these is ${m.target}%.`,
        `${categoryNames[winner]} had the ${m.bigger ? "greatest" : "least"} percent in ${day(m, m.a)}.`,
      ],
      "Choose the activity",
    );
  }

  if (m.ask === "greatest-point" || m.ask === "least-point") {
    const big = m.ask === "greatest-point";
    const best = big ? Math.max(...ys) : Math.min(...ys);
    const at = ys.indexOf(best) + 1;
    const other = ys.indexOf(big ? Math.min(...ys) : Math.max(...ys)) + 1;
    const rise = argOf(diffs(ys), (x, y) => (big ? x > y : x < y)) + 2;
    const options: ChoiceOption[] = [
      { label: day(m, at), correct: true },
      {
        label: day(m, other),
        feedback: `${day(m, other)} is the ${big ? "lowest" : "highest"} point, ${val(ys[other - 1]!)}. The question asks for the ${big ? "highest" : "lowest"}.`,
      },
      {
        label: day(m, rise),
        feedback: `${day(m, rise)} is where the line ${big ? "rises" : "falls"} the most, not where the ${noun} is ${big ? "greatest" : "least"}. ${day(m, at)} has ${val(best)}.`,
      },
      ...rangeInts(m.n)
        .filter((i) => i !== at)
        .map((i) => ({
          label: day(m, i),
          feedback: `${day(m, i)} has ${val(ys[i - 1]!)}, and ${day(m, at)} has ${val(best)}, which is ${big ? "greater" : "less"}.`,
        })),
    ];
    return mk(
      `${intro} On which ${ctx.xWord} was the ${noun} ${big ? "greatest" : "least"}?`,
      options,
      `${readHint} The ${big ? "greatest" : "least"} value is the point ${big ? "highest above" : "closest to"} the horizontal axis.`,
      [
        `On a line graph, the higher a point sits, the greater its value. The steepest part of the line is not the same as the ${big ? "highest" : "lowest"} point.`,
        `Read each point on the vertical scale: ${ys.map((v, i) => `${day(m, i + 1)}: ${v}`).join(", ")}.`,
        `The ${big ? "greatest" : "least"} value is ${best}.`,
        `The ${noun} was ${big ? "greatest" : "least"} on ${day(m, at)}.`,
      ],
      `Choose the ${ctx.xWord}`,
    );
  }

  if (m.ask === "value-at") {
    const v = ys[m.a - 1]!;
    const wrong: [number, string][] = [
      [
        v + ctx.step,
        `${val(v + ctx.step)} is one gridline above the point. Read where the point sits against the vertical scale.`,
      ],
      [v - ctx.step, `${val(v - ctx.step)} is one gridline below the point.`],
      ...[m.a - 1, m.a + 1]
        .filter((i) => i >= 1 && i <= m.n)
        .map((i): [number, string] => [
          ys[i - 1]!,
          `${val(ys[i - 1]!)} is the value on ${day(m, i)}, not ${day(m, m.a)}.`,
        ]),
    ];
    const options: ChoiceOption[] = [
      { label: val(v), correct: true },
      ...wrong
        .filter(([w]) => w > 0 && w !== v)
        .map(([w, feedback]) => ({ label: val(w), feedback })),
    ];
    return mk(
      `${intro} What was the ${noun} on ${day(m, m.a)}?`,
      shuffle(r, options.slice(1)).length >= 3
        ? [options[0]!, ...shuffle(r, options.slice(1))]
        : options,
      `${readHint} Find ${day(m, m.a)} on the horizontal axis, go up to the point, then across to the vertical scale.`,
      [
        `Find ${day(m, m.a)} on the horizontal axis and go up to its point.`,
        `Reading across to the vertical scale, the point is at ${v}.`,
        `The ${noun} on ${day(m, m.a)} was ${val(v)}.`,
      ],
      "Choose the value",
    );
  }

  if (m.ask === "closest-value") {
    const dist = ys.map((v) => Math.abs(v - m.target));
    const best = dist.indexOf(Math.min(...dist)) + 1;
    const order = rangeInts(m.n).sort((p, q) => dist[p - 1]! - dist[q - 1]!);
    const options: ChoiceOption[] = [
      { label: day(m, best), correct: true },
      ...order
        .filter((i) => i !== best)
        .map((i) => ({
          label: day(m, i),
          feedback: `${day(m, i)} has ${val(ys[i - 1]!)}, which is ${dist[i - 1]} from ${m.target}. ${day(m, best)} is only ${dist[best - 1]} away.`,
        })),
    ];
    return mk(
      `${intro} On which ${ctx.xWord} was the ${noun} closest to ${val(m.target)}?`,
      options,
      `${readHint} Find how far each point is from ${m.target}, above or below, and keep the smallest distance.`,
      [
        `"Closest to ${m.target}" means the smallest distance from ${m.target}, above or below it.`,
        `Distances from ${m.target}: ${rangeInts(m.n)
          .map((i) => `${day(m, i)}: ${dist[i - 1]}`)
          .join(", ")}.`,
        `The smallest distance is ${dist[best - 1]}, so the ${noun} was closest to ${val(m.target)} on ${day(m, best)}.`,
      ],
      `Choose the ${ctx.xWord}`,
    );
  }

  if (m.ask === "change-between") {
    const from = ys[m.a - 1]!,
      to = ys[m.b - 1]!;
    const d = to - from;
    const word = (v: number) => (v > 0 ? "Increased" : "Decreased");
    const options: ChoiceOption[] = [
      { label: `${word(d)} by ${Math.abs(d)}`, correct: true as const },
      {
        label: `${word(-d)} by ${Math.abs(d)}`,
        feedback: `That has the direction reversed. The value went from ${from} on ${day(m, m.a)} to ${to} on ${day(m, m.b)}, so it ${d > 0 ? "increased" : "decreased"}.`,
      },
      {
        label: `${word(to)} by ${Math.abs(to)}`,
        feedback: `${to} is the value on ${day(m, m.b)}, not the change. Subtract the starting value ${from}.`,
      },
      {
        label: `${word(d + ctx.step)} by ${Math.abs(d + ctx.step)}`,
        feedback: `That is one gridline off. Read both points against the vertical scale before subtracting.`,
      },
      {
        label: `${word(d - ctx.step)} by ${Math.abs(d - ctx.step)}`,
        feedback: `That is one gridline off. Read both points against the vertical scale before subtracting.`,
      },
    ].filter(
      (o, i, all) =>
        o.label.length > 0 &&
        !/ by 0$/.test(o.label) &&
        all.findIndex((x) => x.label === o.label) === i,
    );
    return mk(
      `${intro} How did the ${noun} change from ${day(m, m.a)} to ${day(m, m.b)}?`,
      options,
      `${readHint} Read the values on ${day(m, m.a)} and ${day(m, m.b)}, then subtract the first from the second to see the direction and size of the change.`,
      [
        `A change is the end value minus the start value. A positive change is an increase; a negative change is a decrease.`,
        `${day(m, m.a)} is ${from} and ${day(m, m.b)} is ${to}.`,
        `${to} − ${from} = ${d}.`,
        `The ${noun} ${d > 0 ? "increased" : "decreased"} by ${Math.abs(d)}.`,
      ],
      "Choose the change",
    );
  }

  if (m.ask === "greatest-increase" || m.ask === "greatest-decrease") {
    const up = m.ask === "greatest-increase";
    const d = diffs(ys);
    const best = argOf(d, (x, y) => (up ? x > y : x < y)) + 1;
    const opposite = argOf(d, (x, y) => (up ? x < y : x > y)) + 1;
    const peak = ys.indexOf(up ? Math.max(...ys) : Math.min(...ys));
    const options: ChoiceOption[] = [
      { label: interval(m, best), correct: true },
      {
        label: interval(m, opposite),
        feedback: `The value ${d[opposite - 1]! < 0 ? "falls" : "rises"} by ${Math.abs(d[opposite - 1]!)} from ${day(m, opposite)} to ${day(m, opposite + 1)}, the opposite of what is asked.`,
      },
      ...(peak >= 1
        ? [
            {
              label: interval(m, peak),
              feedback: `The line ends at the ${up ? "highest" : "lowest"} point here, but the change is ${d[peak - 1]! > 0 ? "an increase" : "a decrease"} of only ${Math.abs(d[peak - 1]!)}, compared with ${Math.abs(d[best - 1]!)} from ${day(m, best)} to ${day(m, best + 1)}.`,
            },
          ]
        : []),
      ...rangeInts(m.n - 1)
        .filter((i) => i !== best)
        .map((i) => ({
          label: interval(m, i),
          feedback: `From ${day(m, i)} to ${day(m, i + 1)} the value changes by ${d[i - 1]! > 0 ? "+" : d[i - 1]! < 0 ? "−" : ""}${Math.abs(d[i - 1]!)}, which is not the ${up ? "greatest increase" : "greatest decrease"}.`,
        })),
    ];
    return mk(
      `${intro} Between which two consecutive ${ctx.xWord}s did the ${noun} ${up ? "increase" : "decrease"} the most?`,
      options,
      `${readHint} For each pair of neighboring points, find how much the line ${up ? "goes up" : "goes down"}; the steepest ${up ? "climb" : "drop"} wins.`,
      [
        `Between two neighboring points, the change is the later value minus the earlier one. The steepest ${up ? "climb" : "drop"} is the greatest ${up ? "increase" : "decrease"}.`,
        `The changes between neighbors are ${d.map((v, i) => `${interval(m, i + 1)}: ${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`).join("; ")}.`,
        `The greatest ${up ? "increase" : "decrease"} is ${Math.abs(d[best - 1]!)}, so the ${noun} ${up ? "increased" : "decreased"} the most from ${interval(m, best)}.`,
      ],
      "Choose the interval",
    );
  }

  // true-statement
  type Statement = { text: string; truth: boolean; feedback: string };
  const pool: Statement[] = [];
  const hi = Math.max(...ys),
    lo = Math.min(...ys);
  const d = diffs(ys);
  const upBest = argOf(d, (x, y) => x > y) + 1,
    downBest = argOf(d, (x, y) => x < y) + 1;
  for (let tries = 0; tries < 16 && pool.length < 12; tries++) {
    const kind = r(0, 5);
    const i = r(1, m.n),
      j = r(1, m.n);
    if (kind === 0 && i !== j)
      pool.push({
        text: `The ${noun} was greater on ${day(m, i)} than on ${day(m, j)}.`,
        truth: ys[i - 1]! > ys[j - 1]!,
        feedback: `${day(m, i)} was ${val(ys[i - 1]!)} and ${day(m, j)} was ${val(ys[j - 1]!)}, so ${day(m, i)} was not greater.`,
      });
    // Superlative statements need a unique, real extreme; ties or no change in
    // that direction would make a "false" statement arguably true.
    const upClear = Math.max(...d) > 0 && unique(d, Math.max(...d));
    const downClear = Math.min(...d) < 0 && unique(d, Math.min(...d));
    if (kind === 1 && upClear) {
      const k = r(1, m.n - 1);
      pool.push({
        text: `The greatest increase was from ${interval(m, k)}.`,
        truth: k === upBest,
        feedback: `From ${interval(m, k)} the value changed by ${d[k - 1]! > 0 ? "+" : "−"}${Math.abs(d[k - 1]!)}; the greatest increase was ${d[upBest - 1]} from ${interval(m, upBest)}.`,
      });
    }
    if (kind === 2 && downClear) {
      const k = r(1, m.n - 1);
      pool.push({
        text: `The greatest decrease was from ${interval(m, k)}.`,
        truth: k === downBest,
        feedback: `From ${interval(m, k)} the value changed by ${d[k - 1]! > 0 ? "+" : "−"}${Math.abs(d[k - 1]!)}; the greatest decrease was ${Math.abs(d[downBest - 1]!)} from ${interval(m, downBest)}.`,
      });
    }
    if (kind === 3) {
      const greatest = !!r(0, 1);
      const target = greatest ? hi : lo;
      pool.push({
        text: `The ${noun} was ${greatest ? "greatest" : "least"} on ${day(m, i)}.`,
        truth: ys[i - 1] === target && unique(ys, target),
        feedback: `${day(m, i)} was ${val(ys[i - 1]!)}; the greatest was ${val(hi)} and the least was ${val(lo)}.`,
      });
    }
    if (kind === 4 && i !== j) {
      const diff = ys[i - 1]! - ys[j - 1]!;
      const claim =
        Math.abs(diff) + (r(0, 1) ? 0 : ctx.step * (r(0, 1) ? 1 : -1));
      if (claim > 0)
        pool.push({
          text: `The ${noun} on ${day(m, i)} was ${claim} ${diff > 0 ? "more" : "less"} than on ${day(m, j)}.`,
          truth: Math.abs(diff) === claim && diff !== 0,
          feedback: `${day(m, i)} was ${ys[i - 1]} and ${day(m, j)} was ${ys[j - 1]}, ${diff === 0 ? "the same value" : `${Math.abs(diff)} ${diff > 0 ? "more" : "less"}`}, not ${claim}.`,
        });
    }
    if (kind === 5) {
      const a = r(1, m.n - 1),
        b = r(a + 1, m.n);
      const rising = ys
        .slice(a - 1, b)
        .every((v, k, all) => !k || v > all[k - 1]!);
      pool.push({
        text: `The ${noun} increased each ${ctx.xWord} from ${day(m, a)} to ${day(m, b)}.`,
        truth: rising,
        feedback: `The values from ${day(m, a)} to ${day(m, b)} are ${ys.slice(a - 1, b).join(", ")}, which do not increase every ${ctx.xWord}.`,
      });
    }
  }
  const seen = new Set<string>();
  const unique2 = pool.filter((s) =>
    seen.has(s.text) ? false : (seen.add(s.text), true),
  );
  const truths = unique2.filter((s) => s.truth);
  const falses = unique2.filter((s) => !s.truth);
  if (!truths.length || falses.length < 3) return null;
  const chosen = [truths[0]!, ...falses.slice(0, 3)];
  const options: ChoiceOption[] = chosen.map((s) =>
    s.truth
      ? { label: s.text, correct: true as const }
      : { label: s.text, feedback: s.feedback },
  );
  return mk(
    `${intro} Which statement about the graph is true?`,
    options,
    `${readHint} Check each statement against the points, one at a time, using the values you read.`,
    [
      `First read every point on the vertical scale, so each statement can be checked with numbers.`,
      `The points read ${ys.map((v, i) => `${day(m, i + 1)}: ${v}`).join(", ")}.`,
      `Checking the statements against these values, only one is true: ${truths[0]!.text}`,
    ],
    "Choose the true statement",
  );
}

export const lineGraphReaderFamily = chainFamily({
  template: lineGraphReaderTemplate,
  axes: lineAxes,
  model: lineModel,
  variant: (m) => m.ask,
  render: (m, _ax, r) => surfaceLine(m, r),
});

/* ------------------------------------------------------------------ */
/* 2. A dot plot with arithmetic                                       */
/* ------------------------------------------------------------------ */

interface DotContext {
  intro: (count: number) => string;
  unit: string;
  one: string;
  entity: string;
  /** True when a mixed-number value is natural (miles, feet, pounds). */
  fractional: boolean;
  /** The question for the value that is not on the plot. */
  missing: (count: number, grand: string) => string;
  /** The question for the total of the plotted values. */
  total: (count: number) => string;
}
const dotContexts: DotContext[] = [
  {
    intro: (n) =>
      `The dot plot shows how many miles Maya walked on each of ${n} days.`,
    unit: "miles",
    one: "mile",
    entity: "day",
    fractional: true,
    missing: (n, grand) =>
      `Maya walked ${grand} in all ${n + 1} days. How many miles did she walk on day ${n + 1}?`,
    total: (n) => `How many miles did Maya walk in all ${n} days?`,
  },
  {
    intro: (n) =>
      `The dot plot shows how many points a team scored in each of its first ${n} games.`,
    unit: "points",
    one: "point",
    entity: "game",
    fractional: false,
    missing: (n, grand) =>
      `The team scored ${grand} in its first ${n + 1} games. How many points did it score in game ${n + 1}?`,
    total: (n) => `How many points did the team score in all ${n} games?`,
  },
  {
    intro: (n) =>
      `The dot plot shows the length, in feet, of each of ${n} ribbons.`,
    unit: "feet",
    one: "foot",
    entity: "ribbon",
    fractional: true,
    missing: (n, grand) =>
      `All ${n + 1} ribbons have a total length of ${grand}. What is the length of ribbon ${n + 1}, in feet?`,
    total: (n) => `What is the total length of all ${n} ribbons, in feet?`,
  },
  {
    intro: (n) =>
      `The dot plot shows the weight, in pounds, of each of ${n} bags of apples.`,
    unit: "pounds",
    one: "pound",
    entity: "bag",
    fractional: true,
    missing: (n, grand) =>
      `All ${n + 1} bags weigh ${grand} together. What is the weight of bag ${n + 1}, in pounds?`,
    total: (n) => `What is the total weight of all ${n} bags, in pounds?`,
  },
];
const dotAxes = {
  values: defineAxis("values", ["whole", "mixed"] as const),
  ask: defineAxis("ask", ["total", "range", "missing-value"] as const),
};
interface DotModel {
  values: "whole" | "mixed";
  ask: "total" | "range" | "missing-value";
  ctx: DotContext;
  /** Values in units of 1/d. */
  d: number;
  units: number[];
  count: number;
  /** Total of one more value, for missing-value (in units of 1/d). */
  grand: number;
  hidden: number;
}
function dotModel(
  r: Random,
  a: { values: DotModel["values"]; ask: DotModel["ask"] },
): DotModel {
  const ctx = pick(
    r,
    dotContexts.filter((c) => a.values === "whole" || c.fractional),
  );
  const d = a.values === "whole" ? 1 : pick(r, [2, 4]);
  const count = r(5, 7);
  const lo = d * (a.values === "whole" ? 2 : 1),
    hi = d * (a.values === "whole" ? 9 : 5);
  const units: number[] = [];
  for (let i = 0; i < count; i++) {
    units.push(r(lo, hi));
  }
  if (a.values === "mixed" && units.every((u) => u % d === 0))
    throw new Error("Need three retries");
  // A repeated value makes counting each mark matter.
  if (new Set(units).size === units.length)
    throw new Error("Need three retries");
  if (new Set(units).size < 3) throw new Error("Need three retries");
  const hidden = r(lo, hi);
  const total = units.reduce((s, v) => s + v, 0);
  return {
    values: a.values,
    ask: a.ask,
    ctx,
    d,
    units,
    count,
    grand: total + hidden,
    hidden,
  };
}
const g2 = (x: number, y: number): number => (y ? g2(y, x % y) : x);
/** A value in units of 1/d as TeX: 4, 2\\frac{1}{4}, \\frac{3}{4}. */
const tv = (units: number, d: number) => {
  const w = Math.floor(units / d),
    rest = units - w * d;
  if (!rest) return String(w);
  const k = g2(rest, d);
  return w ? mixedTex(w, rest / k, d / k) : `\\frac{${rest / k}}{${d / k}}`;
};
/** The same value for prose: a plain whole number, or the TeX in a math span. */
const val = (units: number, d: number) =>
  units % d ? `$${tv(units, d)}$` : tv(units, d);
const withUnit = (units: number, d: number, c: DotContext) =>
  `${val(units, d)} ${units <= d ? c.one : c.unit}`;

export const dotPlotArithmeticFamily = chainFamily({
  template: dotPlotArithmeticTemplate,
  axes: dotAxes,
  model: dotModel,
  variant: (m) => `${m.values}-${m.ask}`,
  render: (m, _ax, r) => {
    const { ctx, d, units } = m;
    const total = units.reduce((s, v) => s + v, 0);
    const hi = Math.max(...units),
      lo = Math.min(...units);
    const distinct = [...new Set(units)];
    const scene = sceneSchema.parse({
      v: 1,
      title: "Dot plot of the measurements",
      maxHeight: 720,
      elements: [
        {
          type: "dotPlot",
          id: "plot",
          min: 0,
          max: m.values === "whole" ? 10 : 6,
          ...(d > 1 ? { denominator: d } : {}),
          mark: "dot",
          groups: [{ values: units.map((u) => u / d) }],
          unit: ctx.unit,
        },
      ],
    });
    let answer: number;
    let wrong: [number, string][];
    let prompt: string;
    let hint: string;
    let explanation: string[];
    const listed = units
      .slice()
      .sort((x, y) => x - y)
      .map((u) => val(u, d))
      .join(", ");
    if (m.ask === "total") {
      answer = total;
      const once = distinct.reduce((s, v) => s + v, 0);
      wrong = [
        [
          once,
          "It adds each different value once. Every dot is a separate measurement, so a value with two dots is added twice.",
        ],
        [total - lo, "It leaves out one dot. Count every dot in the plot."],
        [
          total + hi,
          "It counts one dot too many. Each dot is added exactly once.",
        ],
        [units.length * d, "That is the number of dots, not their total."],
      ];
      prompt = `${ctx.intro(m.count)} ${ctx.total(m.count)}`;
      hint = `The plot has ${m.count} dots. Each dot is one measurement, so a value with two dots counts twice. Add the value of every dot.`;
      explanation = [
        `In a dot plot, each dot is one measurement, placed above its value. Two dots above a value mean it happened twice.`,
        `Read every dot, repeats included: ${listed}.`,
        `"In all" means add every dot's value: all ${m.count} values add to ${val(total, d)}.`,
        `The total is ${withUnit(total, d, ctx)}.`,
      ];
    } else if (m.ask === "range") {
      answer = hi - lo;
      wrong = [
        [
          hi,
          "It stops at the greatest value. The range subtracts the least value from it.",
        ],
        [
          hi + lo,
          "It adds the greatest and least values. The range is their difference.",
        ],
        [lo, "That is the least value, not the difference."],
        [
          hi - lo + 1,
          "It is one mark too many on the scale. Subtract the least value from the greatest exactly.",
        ],
      ];
      prompt = `${ctx.intro(m.count)} What is the difference between the greatest and the least value, in ${ctx.unit}?`;
      hint = `The plot has ${m.count} dots on a scale marked in ${m.values === "whole" ? "whole numbers" : d === 2 ? "halves" : "fourths"}. Find the dot farthest to the right and the dot farthest to the left, then subtract.`;
      explanation = [
        `In a dot plot, each dot is one measurement. The rightmost dot is the greatest value and the leftmost is the least.`,
        `The greatest value is ${val(hi, d)} and the least is ${val(lo, d)}.`,
        `The difference is what you get by subtracting: $${tv(hi, d)} - ${tv(lo, d)} = ${tv(hi - lo, d)}$.`,
        `The difference is ${withUnit(hi - lo, d, ctx)}.`,
      ];
    } else {
      answer = m.hidden;
      const grand = m.grand;
      wrong = [
        [total, "That is the total of the dots shown, not the missing value."],
        [grand, "That is the given total, not the missing value."],
        [
          grand - total + 1,
          "It is one mark more than the difference. Add the shown dots again, counting each repeated value every time, then subtract that sum from the total.",
        ],
        [
          grand - total - 1,
          "It is one mark less than the difference. Add the shown dots again, counting each repeated value every time, then subtract that sum from the total.",
        ],
      ];
      prompt = `${ctx.intro(m.count)} ${ctx.missing(m.count, withUnit(grand, d, ctx))}`;
      hint = `Add the values of the ${m.count} dots, counting repeated values each time. The missing value is the total ${val(grand, d)} minus that sum.`;
      explanation = [
        `The given total is the dots shown plus the missing value. So the missing value is the total minus the dots shown.`,
        `Read every dot, repeats included: ${listed}. They add to ${val(total, d)}.`,
        `Subtract: $${tv(grand, d)} - ${tv(total, d)} = ${tv(m.hidden, d)}$.`,
        `The missing value is ${withUnit(m.hidden, d, ctx)}.`,
      ];
    }
    const seen = new Set([answer]);
    const options: ChoiceOption[] = [
      { label: withUnit(answer, d, ctx), correct: true },
    ];
    for (const [v, feedback] of shuffle(r, wrong)) {
      if (v <= 0 || seen.has(v)) continue;
      seen.add(v);
      options.push({ label: withUnit(v, d, ctx), feedback });
    }
    const s = choiceSurface(r, {
      prompt,
      options,
      hint,
      explanation,
      label: "Choose the answer",
    });
    return s && { ...s, figure: { kind: "scene" as const, scene } };
  },
});

export const lineGraphReadTemplates = [
  lineGraphReaderTemplate,
  dotPlotArithmeticTemplate,
] as const;
export const lineGraphReadGenerate = dispatch(lineGraphReadTemplates, {
  "line-graph-reader": (seed) => lineGraphReaderFamily.generate(seed).problem,
  "dot-plot-arithmetic": (seed) =>
    dotPlotArithmeticFamily.generate(seed).problem,
});
