import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { f, graph, lineTable as table } from "./scene/author";
import type { Fn } from "./scene/spec";
import {
  assemble,
  constText,
  linearText,
  n,
  nonzero,
  p,
  pick,
  pq,
  qt,
  quotient,
  quadAt,
  scaled,
  article,
  rat,
  seeded,
  shuffle,
  termText,
  twoTerm,
  type Case,
  type Choice,
  type Random,
  type Rational,
} from "./algebra-one-kit";

/** Algebra 1: functions, domain and range, average rate of change, linear
 * models, formulas and graphs as solution sets (HSF.IF.A–B, HSA.CED.A,
 * HSA.REI.D.10). Every figure is a scene. */
/** Money in words: "$" would open a math span in MathText. */
const usd = (v: number) => (v === 1 ? "1 dollar" : `${v} dollars`);
const choice = { requiredResponseCapability: "single-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const hs = { version: 1 as const, gradeBand: "9–12" as const };

export const linearFunctionTemplates: readonly TemplateMetadata[] = [
  {
    ...hs,
    id: "graph-domain-range",
    title: "Domain and range from a graph",
    skillId: "function-domain-range",
    description:
      "Read the domain or range of a function from its graph, with closed and open endpoints and turning points.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "context-domain-range",
    title: "Domain and range in context",
    skillId: "function-domain-range",
    description:
      "Choose the inputs or outputs that make sense for a function describing a situation: whole-number counts or continuous times, with their limits.",
    ...choice,
  },
  {
    ...hs,
    id: "function-relation-test",
    title: "Is it a function?",
    skillId: "function-domain-range",
    description:
      "Decide which relation, given as ordered pairs or an equation, assigns exactly one output to each input.",
    ...choice,
  },
  {
    ...hs,
    id: "average-rate-formula",
    title: "Average rate of change from a formula",
    skillId: "average-rate-change",
    description:
      "Find the average rate of change of a quadratic, exponential or height function over an interval from its formula or two of its values.",
  },
  {
    ...hs,
    id: "average-rate-display",
    title: "Average rate of change from a graph or table",
    skillId: "average-rate-change",
    description:
      "Find the average rate of change over an interval from a curve with a secant drawn, or from a table of values, with units in context.",
    ...scenes,
  },
  {
    ...hs,
    id: "linear-model-value",
    title: "Build and solve a linear model",
    skillId: "linear-equation-modeling",
    description:
      "Write a linear equation or inequality for a situation (a fee and a rate, two plans, a perimeter, a budget) and solve it.",
  },
  {
    ...hs,
    id: "linear-model-equation",
    title: "Choose the linear model",
    skillId: "linear-equation-modeling",
    description:
      "Choose the equation that models a situation described in words, a graph or a table, telling the starting amount from the rate.",
    ...choice,
    ...scenes,
  },
  {
    ...hs,
    id: "formula-isolate",
    title: "Solve a formula for a variable",
    skillId: "formula-rearrangement",
    description:
      "Rearrange a geometry, science, finance or line formula to isolate the variable asked for.",
    ...choice,
  },
  {
    ...hs,
    id: "formula-value",
    title: "Use a rearranged formula",
    skillId: "formula-rearrangement",
    description:
      "Find one variable of a formula from the others by isolating it, then substituting.",
  },
  {
    ...hs,
    id: "solution-point-choice",
    title: "Points on a graph",
    skillId: "graph-solution-sets",
    description:
      "Choose the point on the graph of an equation by testing which ordered pair makes it true.",
    ...choice,
  },
  {
    ...hs,
    id: "solution-coordinate",
    title: "Complete a point on a graph",
    skillId: "graph-solution-sets",
    description:
      "Find the missing coordinate of a point on the graph of a line or parabola by substituting the known one.",
    ...scenes,
  },
];

const fraction = (v: Rational) => qt(v);
const ratEqOne = (v: Rational) => Math.abs(v.n) === 1 && v.d === 1;
type End = "closed" | "open";
const sign = (incl: boolean) => (incl ? "≤" : "<");
const interval = (
  lo: number,
  hi: number,
  v: string,
  il: boolean,
  ih: boolean,
) => `${n(lo)} ${sign(il)} ${v} ${sign(ih)} ${n(hi)}`;
/** Up to three distinct wrong options, never equal to the correct one. */
function distinct(correct: string, candidates: Choice[]) {
  const seen = new Set([correct]);
  const out: Choice[] = [];
  for (const c of candidates)
    if (!seen.has(c.label) && out.length < 3) {
      seen.add(c.label);
      out.push(c);
    }
  if (out.length < 3) throw new Error(`Too few distractors for ${correct}`);
  return out;
}

// ------------------------------------------------------- graph-domain-range
function graphDomainRange(r: Random): Case {
  const shape = pick(r, ["line", "line", "parabola", "abs"] as const);
  const ask = pick(r, ["domain", "range"] as const);
  let fn: Fn, a: number, b: number, ends: [End, End], at: (x: number) => number;
  let turn: [number, number] | null = null;
  if (shape === "line") {
    for (;;) {
      const m = pick(r, [-2, -1, 1, 2]);
      a = r(-6, -1);
      b = r(1, 6);
      const lo = Math.max(-6 - m * a, -6 - m * b),
        hi = Math.min(6 - m * a, 6 - m * b);
      if (b - a < 3 || lo > hi) continue;
      const c = r(lo, hi);
      fn = f.poly(m, c);
      at = (x) => m * x + c;
      break;
    }
    ends = pick(r, [
      ["closed", "open"],
      ["open", "closed"],
      ["closed", "closed"],
      ["open", "open"],
    ] as [End, End][]);
  } else {
    const s = pick(r, [1, -1]),
      h = r(-2, 2);
    const reach = shape === "parabola" ? [1, 2, 3] : [1, 2, 3, 4, 5];
    const [d1, d2] = shuffle(r, reach).slice(0, 2) as [number, number];
    const D = shape === "parabola" ? Math.max(d1, d2) ** 2 : Math.max(d1, d2);
    const k = s > 0 ? r(-6, 7 - D) : r(D - 7, 6);
    a = h - d1;
    b = h + d2;
    fn = shape === "parabola" ? f.vertex(s, h, k) : f.abs(s, h, k);
    at = (x) => s * (shape === "parabola" ? (x - h) ** 2 : Math.abs(x - h)) + k;
    turn = [h, k];
    ends = ["closed", "closed"];
  }
  const fa = at!(a!),
    fb = at!(b!);
  const [il, ih] = ends!.map((e) => e === "closed") as [boolean, boolean];
  // The range: lowest and highest y, each included as its point is.
  const ys: [number, boolean][] = [
    [fa, il],
    [fb, ih],
  ];
  if (turn) ys.push([turn[1], true]);
  const yMin = Math.min(...ys.map(([y]) => y)),
    yMax = Math.max(...ys.map(([y]) => y));
  const incl = (y: number) => ys.some(([v, i]) => v === y && i);
  const domain = interval(a!, b!, "x", il, ih);
  const range = interval(yMin, yMax, "y", incl(yMin), incl(yMax));
  const correct = ask === "domain" ? domain : range;
  const endWords = (x: number, y: number, e: End) =>
    `(${n(x)}, ${n(y)}) with ${e === "closed" ? "a filled dot, so it is included" : "an open dot, so it is left out"}`;
  const candidates: Choice[] = [];
  if (ask === "domain") {
    candidates.push(
      {
        label: interval(a!, b!, "x", !il, !ih),
        feedback: `Check the dots at the ends: a filled dot includes its x-value and an open dot leaves it out.`,
      },
      {
        label: interval(yMin, yMax, "x", incl(yMin), incl(yMax)),
        feedback: `These are the graph's lowest and highest y-values. The domain is read along the x-axis, from the left end to the right end.`,
      },
      {
        label: interval(a!, b!, "x", !il, ih),
        feedback: `Look again at the left end, x = ${n(a!)}: is its dot filled or open?`,
      },
      {
        label: interval(a!, b!, "x", il, !ih),
        feedback: `Look again at the right end, x = ${n(b!)}: is its dot filled or open?`,
      },
    );
  } else {
    const yl = Math.min(fa, fb),
      yh = Math.max(fa, fb);
    if (turn)
      candidates.push({
        label: interval(yl, yh, "y", true, true),
        feedback: `The ends are not the only candidates: the turning point (${n(turn[0])}, ${n(turn[1])}) is ${turn[1] < yl ? "lower" : "higher"} than both ends.`,
      });
    candidates.push(
      {
        label: interval(a!, b!, "y", il, ih),
        feedback: `These are the x-values, from the left end to the right end. The range is the set of y-values, read up the y-axis.`,
      },
      {
        label: interval(yMin, yMax, "y", !incl(yMin), !incl(yMax)),
        feedback: `An endpoint value is in the range only when its dot is filled.`,
      },
    );
    if (!turn && fa > fb)
      candidates.push({
        label: interval(yMin, yMax, "y", il, ih),
        feedback: `The line falls, so its lowest y-value is at the right end, x = ${n(b!)}. Attach each end's dot to its own y-value.`,
      });
    candidates.push(
      {
        label: interval(yMin, yMax, "y", true, true),
        feedback: `An open dot leaves its y-value out of the range.`,
      },
      {
        label: interval(yMin, yMax, "y", false, false),
        feedback: `A filled dot includes its y-value in the range.`,
      },
      {
        label: interval(yMin, yMax, "y", !incl(yMin), incl(yMax)),
        feedback: `Check the lowest point, y = ${n(yMin)}: is it on the graph, with a filled dot, or left out?`,
      },
      {
        label: interval(yMin, yMax, "y", incl(yMin), !incl(yMax)),
        feedback: `Check the highest point, y = ${n(yMax)}: is it on the graph, with a filled dot, or left out?`,
      },
    );
  }
  candidates.push(
    {
      label: "All real numbers",
      feedback: `The graph has two ends, at x = ${n(a!)} and x = ${n(b!)}, so its values are limited.`,
    },
    {
      label: interval(
        Math.min(a!, yMin),
        Math.max(b!, yMax),
        ask === "domain" ? "x" : "y",
        true,
        true,
      ),
      feedback: `Read only the ${ask === "domain" ? "x" : "y"}-values of the graph's own points.`,
    },
  );
  const wrong = distinct(correct, candidates);
  const scene = graph({ id: "g", x: [-7, 7], y: [-7, 7], grid: 1 })
    .curve(fn!, { domain: [a!, b!], ends: ends! })
    .scene({ title: "Graph of f on its domain" });
  const steps =
    ask === "domain"
      ? [
          `The domain is every x-value that has a point on the graph. Read it along the x-axis from the left end to the right end.`,
          `The left end is ${endWords(a!, fa, ends![0])}. The right end is ${endWords(b!, fb, ends![1])}.`,
          `Every x between them has a point, so the domain is ${domain}.`,
        ]
      : [
          `The range is every y-value the graph reaches. Read it up the y-axis from the lowest point to the highest.`,
          turn
            ? `The ends are (${n(a!)}, ${n(fa)}) and (${n(b!)}, ${n(fb)}), and the turning point is (${n(turn[0])}, ${n(turn[1])}). The lowest y-value is ${n(yMin)} and the highest is ${n(yMax)}.`
            : `One end is ${endWords(a!, fa, ends![0])}; the other is ${endWords(b!, fb, ends![1])}. The line passes every y-value between them.`,
          `So the range is ${range}.`,
        ];
  return {
    prompt: `The graph shows the whole function f. What is the ${ask} of f?`,
    choices: [{ label: correct, correct: true }, ...wrong],
    scene,
    explanation: steps,
    hint:
      ask === "domain"
        ? `Run along the x-axis under the graph from its left end, (${n(a!)}, ${n(fa)}), to its right end, (${n(b!)}, ${n(fb)}). A filled dot includes its x-value; an open dot leaves it out.`
        : `Scan up the y-axis from the graph's lowest point to its highest. The ends are (${n(a!)}, ${n(fa)}) and (${n(b!)}, ${n(fb)})${turn ? "; compare them with the turning point" : ""}, and an open dot leaves its y-value out.`,
    tags: [shape, ask, ends!.join("-")],
  };
}

// ----------------------------------------------------- context-domain-range
function contextDomainRange(r: Random): Case {
  const kind = pick(r, ["count", "time"] as const);
  const ask = pick(r, ["domain", "range"] as const);
  if (kind === "count") {
    const ctx = pick(r, [
      {
        setup: (cap: number, price: number) =>
          `A van carries at most ${cap} passengers, and each pays ${usd(price)}. The function F(p) = ${price}p gives the fares collected from p passengers.`,
        f: "F",
        v: "p",
        unit: "passengers",
      },
      {
        setup: (cap: number, price: number) =>
          `A bakery bakes ${cap} loaves a day and sells them for ${usd(price)} each. The function R(n) = ${price}n gives the money taken for n loaves sold.`,
        f: "R",
        v: "n",
        unit: "loaves",
      },
      {
        setup: (cap: number, price: number) =>
          `A ferry takes at most ${cap} cars, and each car pays ${usd(price)}. The function T(c) = ${price}c gives the tolls collected for c cars.`,
        f: "T",
        v: "c",
        unit: "cars",
      },
    ]);
    const cap = r(8, 16),
      price = r(3, 15);
    const top = cap * price;
    const options: Choice[] =
      ask === "domain"
        ? [
            { label: `Whole numbers from 0 to ${cap}`, correct: true },
            {
              label: `All real numbers from 0 to ${cap}`,
              feedback: `The input counts ${ctx.unit}, so it cannot be a value such as 2.5.`,
            },
            {
              label: `Whole numbers from 0 to ${top}`,
              feedback: `${top} is the most money collected, an output. The domain is the inputs: the possible numbers of ${ctx.unit}.`,
            },
            {
              label: `All whole numbers`,
              feedback: `There are at most ${cap} ${ctx.unit}, so larger inputs do not fit the situation.`,
            },
          ]
        : [
            {
              label: `Multiples of ${price} from 0 to ${top}`,
              correct: true,
            },
            {
              label: `Whole numbers from 0 to ${top}`,
              feedback: `Each of the ${ctx.unit} adds ${usd(price)}, so an amount such as ${usd(price + 1)} can never be collected.`,
            },
            {
              label: `All real numbers from 0 to ${top}`,
              feedback: `The input is a whole number, so the outputs are only ${price} times whole numbers.`,
            },
            {
              label: `Whole numbers from 0 to ${cap}`,
              feedback: `These are the inputs, the numbers of ${ctx.unit}. The range is the money collected.`,
            },
          ];
    return {
      prompt: `${ctx.setup(cap, price)} Which describes the ${ask} of ${ctx.f} in this situation?`,
      choices: options,
      explanation: [
        `The input ${ctx.v} counts ${ctx.unit}, so it is a whole number, and there are at most ${cap}: the domain is the whole numbers from 0 to ${cap}.`,
        `Each output is ${price} times an input: ${price} × 0 = 0, ${price} × 1 = ${price}, …, ${price} × ${cap} = ${top}.`,
        ask === "domain"
          ? `So the ${ask} is the whole numbers from 0 to ${cap}.`
          : `So the range is the multiples of ${price} from 0 to ${top}.`,
      ],
      hint: `${ask === "domain" ? `The inputs are numbers of ${ctx.unit}` : `The outputs are ${price} times a number of ${ctx.unit}`}: can there be half of one, and can there be more than ${cap}?`,
      tags: [kind, ask],
    };
  }
  const ctx = pick(r, [
    {
      setup: (total: number, rate: number) =>
        `${article(total)} ${total}-liter tank drains at ${rate} liters per minute. The function W(t) = ${total} − ${rate}t gives the water left after t minutes, until the tank is empty.`,
      f: "W",
      what: "water left",
      unit: "minutes",
    },
    {
      setup: (total: number, rate: number) =>
        `${article(total)} ${total}-centimeter candle burns ${rate} centimeters per hour. The function L(t) = ${total} − ${rate}t gives its length after t hours, until it burns out.`,
      f: "L",
      what: "length",
      unit: "hours",
    },
  ]);
  const rate = ctx.f === "W" ? r(5, 30) : r(2, 4),
    end = ctx.f === "W" ? r(6, 40) : r(4, 12);
  const total = rate * end;
  const F = ctx.f;
  const options: Choice[] =
    ask === "domain"
      ? [
          { label: `0 ≤ t ≤ ${end}`, correct: true },
          {
            label: `0 ≤ t ≤ ${total}`,
            feedback: `${total} is the starting ${ctx.what}, not a time. Find when ${F}(t) reaches 0: ${total} ÷ ${rate}.`,
          },
          {
            label: `t ≥ 0`,
            feedback: `The function stops applying when ${F}(t) = 0; later times would give a negative ${ctx.what}.`,
          },
          {
            label: `Whole numbers from 0 to ${end}`,
            feedback: `Time passes continuously, so t can be any number between 0 and ${end}, such as 2.5.`,
          },
        ]
      : [
          { label: `0 ≤ ${F} ≤ ${total}`, correct: true },
          {
            label: `0 ≤ ${F} ≤ ${end}`,
            feedback: `${end} is the time it takes, an input. The range is the ${ctx.what}, from ${total} down to 0.`,
          },
          {
            label: `${F} ≤ ${total}`,
            feedback: `The ${ctx.what} never drops below 0, because the function stops when it reaches 0.`,
          },
          {
            label: `Whole numbers from 0 to ${total}`,
            feedback: `The ${ctx.what} changes continuously, so it takes every value between 0 and ${total}.`,
          },
        ];
  return {
    prompt: `${ctx.setup(total, rate)} Which describes the ${ask} of ${F} in this situation?`,
    choices: options,
    explanation: [
      `The function starts at t = 0 and stops when ${F}(t) = 0: ${total} − ${rate}t = 0 gives t = ${total} ÷ ${rate} = ${end}.`,
      `Time passes continuously, so the domain is 0 ≤ t ≤ ${end}.`,
      ask === "domain"
        ? `So the domain is 0 ≤ t ≤ ${end}.`
        : `Over that time the ${ctx.what} falls steadily from ${F}(0) = ${total} to ${F}(${end}) = 0, so the range is 0 ≤ ${F} ≤ ${total}.`,
    ],
    hint: `Find when the situation ends: solve ${total} − ${rate}t = 0. Then ask which values the ${ask === "domain" ? `time t` : ctx.what} takes from t = 0 until then.`,
    tags: [kind, ask],
  };
}

// --------------------------------------------------- function-relation-test
const pair = ([x, y]: [number, number]) => `(${n(x)}, ${n(y)})`;
const pairSet = (s: [number, number][]) => `{${s.map(pair).join(", ")}}`;
function functionPairs(r: Random, repeatY: boolean): [number, number][] {
  const xs = shuffle(
    r,
    Array.from({ length: 13 }, (_, i) => i - 6),
  ).slice(0, 4);
  const ys = xs.map(() => r(-6, 6));
  if (repeatY) ys[3] = ys[1]!;
  return xs.map((x, i) => [x, ys[i]!]);
}
function relationPairs(r: Random): [number, number][] {
  const s = functionPairs(r, false);
  // Repeat one input with a different output.
  const i = r(0, 3);
  let j = r(0, 3);
  while (j === i) j = r(0, 3);
  let y = r(-6, 6);
  while (y === s[i]![1]) y = r(-6, 6);
  s[j] = [s[i]![0], y];
  return s;
}
function functionRelation(r: Random): Case {
  const frame = pick(r, [
    "pairs-is",
    "pairs-not",
    "equation-is",
    "equation-not",
  ] as const);
  if (frame.startsWith("pairs")) {
    const is = frame === "pairs-is";
    const correct = is ? functionPairs(r, true) : relationPairs(r);
    const others = Array.from({ length: 3 }, (_, i) =>
      is ? relationPairs(r) : functionPairs(r, i === 0),
    );
    const repeated = (s: [number, number][]) =>
      s.find(([x], i) => s.findIndex(([v]) => v === x) !== i)!;
    const choices: Choice[] = [
      { label: pairSet(correct), correct: true },
      ...others.map((s) => ({
        label: pairSet(s),
        feedback: is
          ? `The input ${n(repeated(s)[0])} appears twice with different outputs, so this relation is not a function.`
          : `Every input in this set appears once, so it is a function. Repeated outputs are allowed.`,
      })),
    ];
    const rep = is ? null : repeated(correct);
    return {
      prompt: `Which relation ${is ? "is" : "is not"} a function of x? Each ordered pair is (x, y).`,
      choices,
      explanation: [
        `A relation is a function when each input x is paired with exactly one output y. Look for an x that appears twice with different y-values.`,
        is
          ? `In ${pairSet(correct)} no input repeats (${correct.map(([x]) => n(x)).join(", ")}), so each input has one output. The repeated output ${n(correct[1]![1])} is allowed.`
          : `In ${pairSet(correct)} the input ${n(rep![0])} is paired with two different outputs.`,
        is
          ? `Each other set repeats an input with two different outputs.`
          : `Each other set uses every input once, so each is a function.`,
      ],
      hint: is
        ? `In each set, read the first numbers, the x-values. A set that repeats an x-value with two different y-values is not a function; a repeated y-value is allowed.`
        : `In each set, read the first numbers, the x-values, and look for one that appears twice with two different y-values. A repeated y-value alone does not break a function.`,
      tags: [frame, "pairs"],
    };
  }
  const is = frame === "equation-is";
  const c = nonzero(r, -6, 6),
    h = nonzero(r, -4, 4),
    m = nonzero(r, -5, 5),
    rad = r(2, 6);
  const fns: [string, string][] = shuffle(r, [
    [`y = x²${constText(c)}`, `each x gives one value of x²${constText(c)}`],
    [`y = |x${constText(-h)}|`, `each x gives one absolute value`],
    [
      `y = ${linearText(m, c)}`,
      `each x gives one value of ${linearText(m, c)}`,
    ],
    [`y = x³${constText(-h)}`, `each x gives one cube`],
  ] as [string, string][]);
  const nons: [string, string][] = shuffle(r, [
    [
      `x = y²${constText(c)}`,
      `x = ${n(1 + c)} is paired with y = 1 and y = −1`,
    ],
    [
      `x = |y|${constText(h)}`,
      `x = ${n(2 + h)} is paired with y = 2 and y = −2`,
    ],
    [
      `x² + y² = ${rad * rad}`,
      `x = 0 is paired with y = ${rad} and y = −${rad}`,
    ],
    [
      `y² = x${constText(c)}`,
      `x = ${n(1 - c)} is paired with y = 1 and y = −1`,
    ],
  ] as [string, string][]);
  const [right, wrongs] = is
    ? [fns[0]!, nons.slice(0, 3)]
    : [nons[0]!, fns.slice(0, 3)];
  return {
    prompt: `Which equation ${is ? "defines" : "does not define"} y as a function of x?`,
    choices: [
      { label: right[0], correct: true },
      ...wrongs.map(([label, why]) => ({
        label,
        feedback: is
          ? `Not a function: ${why}.`
          : `This is a function: ${why}.`,
      })),
    ],
    explanation: [
      `y is a function of x when every x-value gives exactly one y-value. Test an equation by looking for one x that gives two values of y.`,
      is
        ? `In ${right[0]}, ${right[1]}, so it defines a function.`
        : `In ${right[0]}, ${right[1]}, so it does not define a function.`,
      is
        ? `In each other equation, y is squared or inside an absolute value, so y and −y give the same x.`
        : `Each other equation gives y directly from x, so every x gives one y.`,
    ],
    hint: is
      ? `For each equation, pick an x-value and ask how many y-values make it true. Where y is squared or inside | |, both y and −y can work.`
      : `Pick an x-value for each equation and count the y-values that make it true: an equation where both y and −y work gives one x two outputs.`,
    tags: [frame, "equations"],
  };
}

// ---------------------------------------------------- average-rate-formula
const quadText = (a: number, b: number, c: number) =>
  `${termText(a, "x²")}${termText(b, "x", false)}${constText(c)}`;
function averageRateFormula(r: Random): Case {
  const frame = pick(r, [
    "quadratic",
    "exponential",
    "height",
    "values",
  ] as const);
  if (frame === "values") {
    const p0 = r(-5, 3),
      q0 = p0 + r(2, 7);
    const fp = r(-12, 15),
      fq = r(-12, 15);
    const ans = rat(fq - fp, q0 - p0);
    return {
      prompt: `A function f has f(${n(p0)}) = ${n(fp)} and f(${n(q0)}) = ${n(fq)}. What is the average rate of change of f from x = ${n(p0)} to x = ${n(q0)}?`,
      answer: ans,
      explanation: [
        `The average rate of change is the change in f divided by the change in x: (f(${n(q0)}) − f(${n(p0)})) ÷ (${n(q0)} − ${p(p0)}).`,
        `Change in f: ${n(fq)} − ${p(fp)} = ${n(fq - fp)}. Change in x: ${n(q0)} − ${p(p0)} = ${q0 - p0}.`,
        `Average rate of change: ${quotient(fq - fp, q0 - p0)}.`,
      ],
      hint: `Subtract in the same order: the change in f is ${n(fq)} − ${p(fp)}, and the change in x is ${n(q0)} − ${p(p0)}. Divide the first by the second.`,
      tags: [frame, ans.d === 1 ? "integer" : "fraction"],
    };
  }
  let name = "f",
    v = "x",
    rule: string,
    at: (x: number) => number,
    p0: number,
    q0: number,
    sub: (x: number) => string,
    unit = "";
  if (frame === "quadratic") {
    const a = nonzero(r, -3, 3),
      b = r(-6, 6),
      c = r(-9, 9);
    rule = `f(x) = ${quadText(a, b, c)}`;
    at = (x) => a * x * x + b * x + c;
    sub = (x) => quadAt(a, b, c, x);
    p0 = r(-4, 3);
    q0 = p0 + r(1, 4);
  } else if (frame === "exponential") {
    const base = pick(r, [2, 3]),
      c = r(1, 5);
    rule = `f(x) = ${c === 1 ? "" : `${c} · `}${base}^x`;
    at = (x) => c * base ** x;
    sub = (x) => `${c === 1 ? "" : `${c} · `}${base}^${x}`;
    p0 = r(0, 2);
    q0 = p0 + r(1, base === 2 ? 3 : 2);
  } else {
    const speed = pick(r, [32, 48, 64, 80, 96]),
      start = r(0, 30);
    name = "h";
    v = "t";
    unit = "feet per second";
    rule = `h(t) = −16t² + ${speed}t${constText(start)}`;
    at = (t) => -16 * t * t + speed * t + start;
    sub = (t) => `−16(${t})² + ${speed}(${t})${constText(start)}`;
    p0 = r(0, speed / 16 - 1);
    q0 = r(p0 + 1, speed / 16);
  }
  const fp = at(p0),
    fq = at(q0);
  const ans = rat(fq - fp, q0 - p0);
  const context =
    frame === "height"
      ? `A ball's height, in feet, t seconds after it is thrown up is ${rule}. Find its average rate of change, in feet per second, from t = ${p0} to t = ${q0}.`
      : `For ${rule}, what is the average rate of change of f from x = ${n(p0)} to x = ${n(q0)}?`;
  return {
    prompt: context,
    answer: ans,
    explanation: [
      `Evaluate at both ends: ${name}(${n(q0)}) = ${sub(q0)} = ${n(fq)} and ${name}(${n(p0)}) = ${sub(p0)} = ${n(fp)}.`,
      `Average rate of change = (${name}(${n(q0)}) − ${name}(${n(p0)})) ÷ (${n(q0)} − ${p(p0)}) = (${n(fq)} − ${p(fp)}) ÷ ${q0 - p0} = ${quotient(fq - fp, q0 - p0)}.`,
      `So it is ${fraction(ans)}${unit ? ` ${unit}` : ""}: the slope of the line through (${n(p0)}, ${n(fp)}) and (${n(q0)}, ${n(fq)}).`,
    ],
    hint: `Find ${name}(${n(q0)}) and ${name}(${n(p0)}) from ${rule} first. Then divide their difference by the change in ${v}, ${n(q0)} − ${p(p0)}.`,
    tags: [frame, ans.d === 1 ? "integer" : "fraction"],
  };
}

// ---------------------------------------------------- average-rate-display
function averageRateDisplay(r: Random): Case {
  const frame = pick(r, ["graph", "graph", "table", "context"] as const);
  if (frame === "graph") {
    for (;;) {
      const a = pick(r, [1, -1, 0.5, -0.5]);
      const h = r(-2, 2);
      const k = a > 0 ? r(-6, 0) : r(0, 6);
      const step = Math.abs(a) === 0.5 ? 2 : 1;
      const offs = [-4, -3, -2, -1, 0, 1, 2, 3, 4].filter(
        (d) => d % step === 0,
      );
      const [d1, d2] = shuffle(r, offs)
        .slice(0, 2)
        .sort((x, y) => x - y) as [number, number];
      const at = (x: number) => a * (x - h) ** 2 + k;
      const [p0, q0] = [h + d1, h + d2];
      const [fp, fq] = [at(p0), at(q0)];
      if ([fp, fq].some((y) => Math.abs(y) > 8) || p0 < -6 || q0 > 6) continue;
      const ans = rat(Math.round(fq - fp), q0 - p0);
      const scene = graph({ id: "g", x: [-6, 6], y: [-8, 8], grid: 1 })
        .curve(f.vertex(a, h, k))
        .secant(0, p0, q0)
        .point(p0, fp, "A")
        .point(q0, fq, "B")
        .scene({ title: "Graph of f with a secant through A and B" });
      return {
        prompt: `The graph of y = f(x) passes through A at x = ${n(p0)} and B at x = ${n(q0)}. What is the average rate of change of f from x = ${n(p0)} to x = ${n(q0)}?`,
        answer: ans,
        scene,
        explanation: [
          `Read the coordinates from the grid: A = (${n(p0)}, ${n(fp)}) and B = (${n(q0)}, ${n(fq)}).`,
          `The average rate of change is the slope of the secant line AB: (${n(fq)} − ${p(fp)}) ÷ (${n(q0)} − ${p(p0)}) = ${quotient(fq - fp, q0 - p0)}.`,
          `So it is ${fraction(ans)}. A curve does not change at one constant rate, but from A to B, f changes by ${fraction(ans)} for each 1 that x increases on average.`,
        ],
        hint: `Read the y-values of A (at x = ${n(p0)}) and B (at x = ${n(q0)}) from the grid. The average rate is the rise from A to B divided by the run, ${n(q0)} − ${p(p0)}.`,
        tags: [frame, a > 0 ? "opens-up" : "opens-down"],
      };
    }
  }
  if (frame === "table") {
    const exp = r(0, 1) === 1;
    const xs = exp ? [0, 1, 2, 3, 4, 5] : [-2, -1, 0, 1, 2, 3];
    const c = r(1, 3),
      a = nonzero(r, -2, 2),
      b = r(-4, 4),
      d = r(-5, 5);
    const at = (x: number) => (exp ? c * 2 ** x : a * x * x + b * x + d);
    const [i, j] = shuffle(r, [0, 1, 2, 3, 4, 5])
      .slice(0, 2)
      .sort((u, w) => u - w) as [number, number];
    const [p0, q0] = [xs[i]!, xs[j]!];
    const [fp, fq] = [at(p0), at(q0)];
    const ans = rat(fq - fp, q0 - p0);
    const scene = table(
      [
        ["x", ...xs.map(n)],
        ["f(x)", ...xs.map((x) => n(at(x)))],
      ],
      { highlight: [i + 1, j + 1] },
    ).scene({ title: "Values of f" });
    return {
      prompt: `The table gives values of a function f. What is the average rate of change of f from x = ${n(p0)} to x = ${n(q0)}?`,
      answer: ans,
      scene,
      explanation: [
        `From the table, f(${n(p0)}) = ${n(fp)} and f(${n(q0)}) = ${n(fq)}.`,
        `Average rate of change = (${n(fq)} − ${p(fp)}) ÷ (${n(q0)} − ${p(p0)}) = ${quotient(fq - fp, q0 - p0)}.`,
        `The values between the two columns do not enter: an average rate uses only the ends of the interval.`,
      ],
      hint: `Use only the shaded columns, x = ${n(p0)} and x = ${n(q0)}: divide the change in f(x) between them by ${n(q0)} − ${p(p0)}.`,
      tags: [frame, exp ? "exponential" : "quadratic"],
    };
  }
  const ctx = pick(r, [
    {
      prompt: (a: number, b: number) =>
        `The table shows the temperature T, in degrees Fahrenheit, h hours after 6 a.m. What is the average rate of change of T, in degrees per hour, from h = ${a} to h = ${b}?`,
      heads: ["h", "T"],
      when: (x: number) => `at h = ${x}`,
      xs: [0, 1, 2, 3, 4, 5],
      start: () => r(40, 60),
      change: () => r(-2, 6),
      unit: "degrees per hour",
    },
    {
      prompt: (a: number, b: number) =>
        `The table shows a town's population P, in thousands, in each year. What is the average rate of change of P, in thousands per year, from ${a} to ${b}?`,
      heads: ["Year", "P"],
      when: (x: number) => `in ${x}`,
      xs: [2000, 2005, 2010, 2015, 2020],
      start: () => r(12, 40),
      change: () => r(-3, 9),
      unit: "thousand people per year",
    },
  ]);
  const values = [ctx.start()];
  for (let i = 1; i < ctx.xs.length; i++)
    values.push(values[i - 1]! + ctx.change());
  const [i, j] = shuffle(
    r,
    ctx.xs.map((_, k) => k),
  )
    .slice(0, 2)
    .sort((u, w) => u - w) as [number, number];
  const [p0, q0, fp, fq] = [ctx.xs[i]!, ctx.xs[j]!, values[i]!, values[j]!];
  const ans = rat(fq - fp, q0 - p0);
  const scene = table(
    [
      [ctx.heads[0]!, ...ctx.xs.map(String)],
      [ctx.heads[1]!, ...values.map(n)],
    ],
    { highlight: [i + 1, j + 1] },
  ).scene({ title: "Table of values" });
  return {
    prompt: ctx.prompt(p0, q0),
    answer: ans,
    scene,
    explanation: [
      `${ctx.when(p0)[0]!.toUpperCase()}${ctx.when(p0).slice(1)}, ${ctx.heads[1]} = ${n(fp)}; ${ctx.when(q0)}, ${ctx.heads[1]} = ${n(fq)}.`,
      `Average rate of change = (${n(fq)} − ${p(fp)}) ÷ (${q0} − ${p0}) = ${quotient(fq - fp, q0 - p0)}.`,
      `So ${ctx.heads[1]} changed on average by ${fraction(ans)} ${ratEqOne(ans) ? ctx.unit.replace("degrees", "degree").replace("thousand people", "thousand people") : ctx.unit}, though it did not change by the same amount in every step.`,
    ],
    hint: `Take ${ctx.heads[1]} ${ctx.when(p0)} and ${ctx.when(q0)} from the shaded columns. Divide their difference by the time between them, ${q0} − ${p0}.`,
    tags: [frame, ctx.heads[1]!, ans.d === 1 ? "integer" : "fraction"],
  };
}

// ------------------------------------------------------- linear-model-value
function linearModelValue(r: Random): Case {
  const frame = pick(r, [
    "fee-rate",
    "two-plans",
    "perimeter",
    "budget",
  ] as const);
  if (frame === "fee-rate") {
    const ctx = pick(r, [
      {
        who: "Maya",
        what: "A gym charges a joining fee of F dollars plus R dollars per month",
        did: "Maya has paid T dollars in all",
        ask: "For how many months has she been a member?",
        v: "m",
        unit: "months",
        fee: [20, 60],
        rate: [15, 40],
      },
      {
        who: "Leo",
        what: "A plumber charges F dollars for a visit plus R dollars per hour",
        did: "Leo's bill is T dollars",
        ask: "How many hours did the plumber work?",
        v: "h",
        unit: "hours",
        fee: [40, 90],
        rate: [35, 75],
      },
      {
        who: "Ana",
        what: "A bike rental costs F dollars plus R dollars per hour",
        did: "Ana paid T dollars",
        ask: "For how many hours did she rent the bike?",
        v: "h",
        unit: "hours",
        fee: [5, 15],
        rate: [3, 9],
      },
    ]);
    const fee = r(ctx.fee[0]!, ctx.fee[1]!),
      rate = r(ctx.rate[0]!, ctx.rate[1]!),
      k = r(3, ctx.v === "m" ? 14 : 8);
    const total = fee + rate * k;
    const opening = ctx.what
      .replace("F dollars", `${usd(fee)}`)
      .replace("R dollars", `${usd(rate)}`);
    const did = ctx.did.replace("T dollars", `${usd(total)}`);
    return {
      prompt: `${opening}. ${did}. ${ctx.ask}`,
      answer: rat(k),
      explanation: [
        `Let ${ctx.v} be the number of ${ctx.unit}. The fixed ${usd(fee)} plus ${usd(rate)} for each of the ${ctx.v} ${ctx.unit} is the total: ${fee} + ${rate}${ctx.v} = ${total}.`,
        `Subtract ${fee} from both sides: ${rate}${ctx.v} = ${total - fee}.`,
        `Divide both sides by ${rate}: ${ctx.v} = ${k}.`,
        `Check: ${fee} + ${rate} × ${k} = ${total}.`,
      ],
      hint: `Call the number of ${ctx.unit} ${ctx.v}: the ${usd(fee)} is paid once and the ${usd(rate)} is paid ${ctx.v} times, so ${fee} + ${rate}${ctx.v} = ${total}. Undo the one-time ${usd(fee)} first.`,
      tags: [frame],
    };
  }
  if (frame === "two-plans") {
    const b1 = r(5, 15),
      b2 = b1 + r(2, 9),
      k = r(2, 12);
    const a2 = r(0, 20),
      a1 = a2 + k * (b2 - b1);
    const ctx = pick(r, [
      ["Phone plan A costs", "Plan B costs", "per month", "months", "m"],
      ["Gym A charges", "Gym B charges", "per visit", "visits", "v"],
      ["Car rental A charges", "Rental B charges", "per day", "days", "d"],
    ] as const);
    return {
      prompt: `${ctx[0]} ${usd(a1)} plus ${usd(b1)} ${ctx[2]}. ${ctx[1]} ${usd(a2)} plus ${usd(b2)} ${ctx[2]}. After how many ${ctx[3]} do they cost the same?`,
      answer: rat(k),
      explanation: [
        `Let ${ctx[4]} be the number of ${ctx[3]}. The costs are ${a1} + ${b1}${ctx[4]} and ${a2} + ${b2}${ctx[4]}; set them equal: ${a1} + ${b1}${ctx[4]} = ${a2} + ${b2}${ctx[4]}.`,
        `Subtract ${b1}${ctx[4]} and ${a2} from both sides: ${a1 - a2} = ${b2 - b1}${ctx[4]}.`,
        `Divide by ${b2 - b1}: ${ctx[4]} = ${k}.`,
        `Check: ${a1} + ${b1} × ${k} = ${a1 + b1 * k} and ${a2} + ${b2} × ${k} = ${a2 + b2 * k}.`,
      ],
      hint: `Write each cost with ${ctx[4]} for the number of ${ctx[3]}, ${a1} + ${b1}${ctx[4]} and ${a2} + ${b2}${ctx[4]}, and set the two expressions equal.`,
      tags: [frame],
    };
  }
  if (frame === "perimeter") {
    const w = r(3, 15),
      c = pick(r, [1, 2, 3]),
      d = r(1, 7);
    const l = c * w + d,
      P = 2 * (l + w);
    const rel =
      c === 1
        ? `${d} cm more than its width`
        : `${d} cm more than ${c === 2 ? "twice" : "three times"} its width`;
    return {
      prompt: `A rectangle's length is ${rel}. Its perimeter is ${P} cm. What is its width, in centimeters?`,
      answer: rat(w),
      explanation: [
        `Let w be the width. The length is ${linearText(c, d, "w")}, and the perimeter is twice length plus width: 2(${linearText(c, d, "w")} + w) = ${P}.`,
        `Combine inside the parentheses: 2(${linearText(c + 1, d, "w")}) = ${P}, so ${linearText(2 * c + 2, 2 * d, "w")} = ${P}.`,
        `Subtract ${2 * d}: ${2 * c + 2}w = ${P - 2 * d}. Divide by ${2 * c + 2}: w = ${w}.`,
        `Check: the length is ${l} cm, and 2(${l} + ${w}) = ${P}.`,
      ],
      hint: `Write the length in terms of the width w, as ${linearText(c, d, "w")}. A perimeter adds each side twice: 2(length + width) = ${P}.`,
      tags: [frame, c === 1 ? "plus" : "times-plus"],
    };
  }
  const ctx = pick(r, [
    [
      "A fair charges E dollars to enter and R dollars per ride",
      "Ana has B dollars",
      "What is the greatest number of rides she can take?",
      "rides",
      "r",
    ],
    [
      "A taxi charges E dollars plus R dollars per mile",
      "Sam has B dollars",
      "What is the greatest whole number of miles he can ride?",
      "miles",
      "m",
    ],
    [
      "A print shop charges E dollars to set up plus R dollars per poster",
      "The club has B dollars",
      "What is the greatest number of posters it can order?",
      "posters",
      "p",
    ],
  ] as const);
  const e = r(3, 12),
    rate = r(2, 7),
    k = r(4, 15);
  const B = e + rate * k + r(0, rate - 1);
  return {
    prompt: `${ctx[0].replace("E dollars", usd(e)).replace("R dollars", usd(rate))}. ${ctx[1].replace("B dollars", usd(B))}. ${ctx[2]}`,
    answer: rat(k),
    explanation: [
      `Let ${ctx[4]} be the number of ${ctx[3]}. The cost may not exceed the money available: ${e} + ${rate}${ctx[4]} ≤ ${B}.`,
      `Subtract ${e}: ${rate}${ctx[4]} ≤ ${B - e}. Divide by ${rate}: ${ctx[4]} ≤ ${fraction(rat(B - e, rate))}.`,
      `The number of ${ctx[3]} is a whole number, so the greatest is ${k}. Check: ${e} + ${rate} × ${k} = ${e + rate * k} ≤ ${B}, but ${e} + ${rate} × ${k + 1} = ${e + rate * (k + 1)} > ${B}.`,
    ],
    hint: `The cost ${e} + ${rate}${ctx[4]} must be at most ${B}: solve ${e} + ${rate}${ctx[4]} ≤ ${B}, then take the greatest whole number that fits.`,
    tags: [frame, "inequality"],
  };
}

// ---------------------------------------------------- linear-model-equation
function linearModelEquation(r: Random): Case {
  const frame = pick(r, ["words", "graph", "table"] as const);
  const ctx = pick(r, [
    {
      kind: "grow",
      y: "F",
      x: "d",
      say: (b: number, m: number) =>
        `A taxi charges ${usd(b)} plus ${usd(m)} per mile. F is the fare, in dollars, for a ride of d miles.`,
      yName: "fare F, in dollars",
      xName: "miles d",
    },
    {
      kind: "grow",
      y: "H",
      x: "w",
      say: (b: number, m: number) =>
        `A plant is ${b} cm tall when planted and grows ${m} cm each week. H is its height, in centimeters, after w weeks.`,
      yName: "height H, in centimeters",
      xName: "weeks w",
    },
    {
      kind: "fall",
      y: "L",
      x: "t",
      say: (b: number, m: number) =>
        `A candle is ${b} cm long and burns ${m} cm each hour. L is its length, in centimeters, after t hours.`,
      yName: "length L, in centimeters",
      xName: "hours t",
    },
  ]);
  let m: number, b: number, X: number;
  if (ctx.kind === "fall") {
    m = r(2, 3);
    X = r(4, 7);
    b = m * X;
  } else {
    m = r(1, 3);
    X = 6;
    b = r(1, 20 - m * X);
    if (b === m) b += 1;
  }
  const s = ctx.kind === "fall" ? -1 : 1;
  const { x, y } = ctx;
  const times = (k: number) => (k === 1 ? "" : String(k));
  const eq = (slope: number, icept: number) =>
    slope < 0
      ? `${y} = ${icept} − ${Math.abs(slope) === 1 ? "" : Math.abs(slope)}${x}`
      : `${y} = ${slope === 1 ? "" : slope}${x} + ${icept}`;
  const correct = eq(s * m, b);
  const candidates: Choice[] = [
    {
      label: s > 0 ? eq(b, m) : `${y} = ${m} − ${times(b)}${x}`,
      feedback: `This swaps the starting amount and the rate. The rate multiplies ${x}; the starting amount is the value when ${x} = 0.`,
    },
    {
      label:
        s > 0
          ? `${y} = ${times(m)}${x} − ${b}`
          : `${y} = ${times(m)}${x} + ${b}`,
      feedback:
        s > 0
          ? `The starting amount ${b} is added, not subtracted: when ${x} = 0, ${y} = ${b}.`
          : `${y} decreases as ${x} grows, so ${m}${x} is subtracted from the starting ${b}.`,
    },
    {
      label: `${y} = ${times(s > 0 ? m + b : b - m)}${x}`,
      feedback: `This gives ${y} = 0 when ${x} = 0, but the starting value is ${b}.`,
    },
    {
      label: `${y} = ${times(m)}(${x} + ${b})`,
      feedback: `Multiplying gives ${m}${x} + ${m * b}: the starting amount would be ${m * b}, not ${b}.`,
    },
  ];
  const wrong = distinct(correct, candidates);
  const rateWords = `${ctx.kind === "fall" ? "falls" : "rises"} by ${m} for each 1 that ${x} increases`;
  let prompt: string, scene, first: string, hint: string;
  if (frame === "words") {
    prompt = `${ctx.say(b, m)} Which equation gives ${y} in terms of ${x}?`;
    first = `The starting amount, when ${x} = 0, is ${b}, and ${y} ${rateWords}.`;
    hint = `Find the value of ${y} when ${x} = 0, here ${b}, and how much ${y} changes for each 1 that ${x} increases, here ${m}. Which of the two multiplies ${x}?`;
  } else if (frame === "graph") {
    const top = Math.max(b, b + s * m * X);
    const yMax = top + (top % 2 ? 1 : 2);
    scene = graph({
      id: "g",
      x: [0, X + 1],
      y: [0, yMax],
      grid: 1,
      tick: 2,
      axisNames: [x, y],
    })
      .curve(f.poly(s * m, b), { domain: [0, X], ends: ["none", "none"] })
      .scene({ title: `Graph of ${ctx.yName} against ${ctx.xName}` });
    const sayIt = ctx.say(b, m).split(". ")[1]!;
    prompt = `The graph shows a linear relationship. ${sayIt} Which equation gives ${y} in terms of ${x}?`;
    first = `The graph starts at (0, ${b}), so ${y} = ${b} when ${x} = 0. From (0, ${b}) to (1, ${b + s * m}) it ${ctx.kind === "fall" ? "falls" : "rises"} ${m}, so ${y} ${rateWords}.`;
    hint = `Read where the line meets the ${y}-axis, at ${x} = 0, then count how far it ${ctx.kind === "fall" ? "falls" : "rises"} from ${x} = 0 to ${x} = 1. The first is the starting amount; the second multiplies ${x}.`;
  } else {
    const start = r(1, Math.max(1, X - 3));
    const xs = [start, start + 1, start + 2, start + 3];
    const yv = (v: number) => b + s * m * v;
    scene = table([
      [x, ...xs.map(String)],
      [y, ...xs.map((v) => n(yv(v)))],
    ]).scene({ title: `Values of ${y}` });
    const sayIt = ctx.say(b, m).split(". ")[1]!;
    prompt = `The table shows a linear relationship. ${sayIt} Which equation gives ${y} in terms of ${x}?`;
    first = `Each time ${x} increases by 1, ${y} changes by ${n(s * m)}, so the rate is ${n(s * m)}. Working back from (${xs[0]}, ${n(yv(xs[0]!))}) by ${xs[0]} step${xs[0] === 1 ? "" : "s"} gives ${y} = ${b} at ${x} = 0.`;
    hint = `Find the change in ${y} from one column to the next; that is the rate. Then work back from ${x} = ${xs[0]} to ${x} = 0 to find the starting amount.`;
  }
  return {
    prompt,
    choices: [{ label: correct, correct: true }, ...wrong],
    scene,
    explanation: [
      first,
      `A linear model is ${y} = (starting amount) + (rate)·${x}, so ${correct}.`,
      `Check: at ${x} = 2 the equation gives ${y} = ${b + 2 * s * m}${ctx.kind === "fall" ? `, which is ${b} − 2 × ${m}` : `, which is ${b} + 2 × ${m}`}.`,
    ],
    hint,
    tags: [frame, ctx.y],
  };
}

// ------------------------------------------------------------ formula-isolate
type FormulaCase = {
  formula: string;
  about: string;
  target: string;
  others: string;
  correct: string;
  wrong: [string, string][];
  steps: string[];
  family: string;
};
const formulas: FormulaCase[] = [
  {
    family: "geometry",
    formula: "A = ½bh",
    about: "the area A of a triangle with base b and height h",
    target: "h",
    others: "A and b",
    correct: "h = 2A/b",
    wrong: [
      [
        "h = A/(2b)",
        "Multiplying both sides by 2 gives 2A = bh; the 2 multiplies A.",
      ],
      ["h = 2b/A", "Dividing 2A = bh by b leaves h = 2A ÷ b, not b ÷ A."],
      [
        "h = 2A − b",
        "b multiplies h, so undo it by dividing, not subtracting.",
      ],
    ],
    steps: [
      "Multiply both sides by 2: 2A = bh.",
      "Divide both sides by b: h = 2A/b.",
    ],
  },
  {
    family: "geometry",
    formula: "P = 2l + 2w",
    about: "the perimeter P of a rectangle with length l and width w",
    target: "w",
    others: "P and l",
    correct: "w = (P − 2l)/2",
    wrong: [
      [
        "w = P/2 − 2l",
        "Dividing by 2 must divide every term: (P − 2l)/2 = P/2 − l.",
      ],
      ["w = (P − l)/2", "The term to remove is 2l, not l."],
      [
        "w = P − 2l/2",
        "Only half of P remains after dividing; the whole P − 2l is divided by 2.",
      ],
    ],
    steps: [
      "Subtract 2l from both sides: P − 2l = 2w.",
      "Divide both sides by 2: w = (P − 2l)/2.",
    ],
  },
  {
    family: "geometry",
    formula: "V = lwh",
    about: "the volume V of a box with length l, width w and height h",
    target: "h",
    others: "V, l and w",
    correct: "h = V/(lw)",
    wrong: [
      ["h = Vlw", "l and w multiply h, so divide by them."],
      ["h = lw/V", "This divides lw by V; it should divide V by lw."],
      ["h = V − lw", "lw multiplies h; undo multiplication by dividing."],
    ],
    steps: [
      "The product lw multiplies h: V = (lw)h.",
      "Divide both sides by lw: h = V/(lw).",
    ],
  },
  {
    family: "science",
    formula: "d = rt",
    about: "the distance d traveled at rate r for time t",
    target: "t",
    others: "d and r",
    correct: "t = d/r",
    wrong: [
      ["t = r/d", "Dividing d = rt by r leaves d ÷ r, with d on top."],
      ["t = dr", "r multiplies t, so divide by r."],
      ["t = d − r", "r multiplies t; undo it by dividing, not subtracting."],
    ],
    steps: ["r multiplies t, so divide both sides by r.", "t = d/r."],
  },
  {
    family: "science",
    formula: "F = 9C/5 + 32",
    about: "a temperature F in degrees Fahrenheit from C in degrees Celsius",
    target: "C",
    others: "F",
    correct: "C = 5(F − 32)/9",
    wrong: [
      [
        "C = 5F/9 − 32",
        "Undo the steps in reverse order: subtract 32 first, then multiply by 5/9.",
      ],
      ["C = 9(F − 32)/5", "Undo × 9/5 by multiplying by its reciprocal, 5/9."],
      [
        "C = (5F − 32)/9",
        "Subtract 32 from F before multiplying; 32 is not multiplied by 5.",
      ],
    ],
    steps: [
      "Subtract 32 from both sides: F − 32 = 9C/5.",
      "Multiply both sides by 5/9: C = 5(F − 32)/9.",
    ],
  },
  {
    family: "science",
    formula: "v = u + at",
    about:
      "the speed v after accelerating at a for time t from a starting speed u",
    target: "a",
    others: "v, u and t",
    correct: "a = (v − u)/t",
    wrong: [
      ["a = v/t − u", "Subtract u first, then divide all of v − u by t."],
      [
        "a = (v + u)/t",
        "u is added on the right, so subtract it from both sides.",
      ],
      ["a = t/(v − u)", "Divide v − u by t, not t by v − u."],
    ],
    steps: [
      "Subtract u from both sides: v − u = at.",
      "Divide both sides by t: a = (v − u)/t.",
    ],
  },
  {
    family: "finance",
    formula: "I = Prt",
    about: "the simple interest I on a principal P at rate r for t years",
    target: "r",
    others: "I, P and t",
    correct: "r = I/(Pt)",
    wrong: [
      ["r = IPt", "P and t multiply r, so divide by them."],
      ["r = Pt/I", "This divides Pt by I; it should divide I by Pt."],
      [
        "r = I/P − t",
        "t multiplies r too, so divide by t as well; do not subtract it.",
      ],
    ],
    steps: [
      "P and t both multiply r: I = (Pt)r.",
      "Divide both sides by Pt: r = I/(Pt).",
    ],
  },
  {
    family: "finance",
    formula: "A = P + Prt",
    about:
      "the amount A after simple interest on a principal P at rate r for t years",
    target: "t",
    others: "A, P and r",
    correct: "t = (A − P)/(Pr)",
    wrong: [
      ["t = A/(Pr) − P", "Subtract P first, then divide all of A − P by Pr."],
      ["t = (A − P)/r", "P multiplies t too: divide by P and by r."],
      [
        "t = (A + P)/(Pr)",
        "P is added on the right, so subtract it from both sides.",
      ],
    ],
    steps: [
      "Subtract P from both sides: A − P = Prt.",
      "Divide both sides by Pr: t = (A − P)/(Pr).",
    ],
  },
  {
    family: "lines",
    formula: "y = mx + b",
    about: "a line with slope m and y-intercept b",
    target: "x",
    others: "y, m and b",
    correct: "x = (y − b)/m",
    wrong: [
      ["x = y/m − b", "Subtract b first, then divide all of y − b by m."],
      ["x = (y + b)/m", "b is added on the right, so subtract it."],
      ["x = m/(y − b)", "Divide y − b by m, not m by y − b."],
    ],
    steps: [
      "Subtract b from both sides: y − b = mx.",
      "Divide both sides by m: x = (y − b)/m.",
    ],
  },
  {
    family: "lines",
    formula: "ax + by = c",
    about: "a line in standard form, with b nonzero",
    target: "y",
    others: "x, a, b and c",
    correct: "y = (c − ax)/b",
    wrong: [
      ["y = c/b − ax", "Divide every term by b: (c − ax)/b = c/b − ax/b."],
      [
        "y = (c + ax)/b",
        "ax is added on the left, so subtract it from both sides.",
      ],
      [
        "y = (ax − c)/b",
        "Subtracting ax from both sides gives c − ax, not ax − c.",
      ],
    ],
    steps: [
      "Subtract ax from both sides: by = c − ax.",
      "Divide both sides by b: y = (c − ax)/b.",
    ],
  },
  {
    family: "lines",
    formula: "y − k = m(x − h)",
    about: "a line through (h, k) with slope m",
    target: "x",
    others: "y, k, m and h",
    correct: "x = (y − k)/m + h",
    wrong: [
      ["x = (y − k)/m − h", "x − h = (y − k)/m, so add h to both sides."],
      ["x = m(y − k) + h", "Divide by m to undo multiplication by m."],
      ["x = (y + k)/m + h", "Keep y − k as it is: only m and h are undone."],
    ],
    steps: [
      "Divide both sides by m: (y − k)/m = x − h.",
      "Add h to both sides: x = (y − k)/m + h.",
    ],
  },
  {
    family: "geometry",
    formula: "C = 2πr",
    about: "the circumference C of a circle with radius r",
    target: "r",
    others: "C",
    correct: "r = C/(2π)",
    wrong: [
      ["r = 2πC", "2π multiplies r, so divide by 2π."],
      ["r = C − 2π", "2π multiplies r; undo multiplication by dividing."],
      ["r = 2π/C", "Divide C by 2π, not 2π by C."],
    ],
    steps: ["2π multiplies r.", "Divide both sides by 2π: r = C/(2π)."],
  },
  {
    family: "geometry",
    formula: "V = πr²h",
    about: "the volume V of a cylinder with radius r and height h",
    target: "h",
    others: "V and r",
    correct: "h = V/(πr²)",
    wrong: [
      ["h = Vπr²", "πr² multiplies h, so divide by it."],
      ["h = πr²/V", "Divide V by πr², not πr² by V."],
      ["h = V − πr²", "πr² multiplies h; undo multiplication by dividing."],
    ],
    steps: [
      "The product πr² multiplies h: V = (πr²)h.",
      "Divide both sides by πr²: h = V/(πr²).",
    ],
  },
  {
    family: "geometry",
    formula: "P = 2l + 2w",
    about: "the perimeter P of a rectangle with length l and width w",
    target: "l",
    others: "P and w",
    correct: "l = (P − 2w)/2",
    wrong: [
      [
        "l = P/2 − 2w",
        "Dividing by 2 must divide every term: (P − 2w)/2 = P/2 − w.",
      ],
      ["l = (P − w)/2", "The term to remove is 2w, not w."],
      [
        "l = (P + 2w)/2",
        "2w is added on the right, so subtract it from both sides.",
      ],
    ],
    steps: [
      "Subtract 2w from both sides: P − 2w = 2l.",
      "Divide both sides by 2: l = (P − 2w)/2.",
    ],
  },
  {
    family: "science",
    formula: "d = rt",
    about: "the distance d traveled at rate r for time t",
    target: "r",
    others: "d and t",
    correct: "r = d/t",
    wrong: [
      ["r = t/d", "Dividing d = rt by t leaves d ÷ t, with d on top."],
      ["r = dt", "t multiplies r, so divide by t."],
      ["r = d − t", "t multiplies r; undo it by dividing, not subtracting."],
    ],
    steps: ["t multiplies r, so divide both sides by t.", "r = d/t."],
  },
  {
    family: "science",
    formula: "F = ma",
    about: "the force F on a mass m with acceleration a",
    target: "a",
    others: "F and m",
    correct: "a = F/m",
    wrong: [
      ["a = m/F", "Dividing F = ma by m leaves F ÷ m."],
      ["a = Fm", "m multiplies a, so divide by m."],
      ["a = F − m", "m multiplies a; undo multiplication by dividing."],
    ],
    steps: ["m multiplies a, so divide both sides by m.", "a = F/m."],
  },
  {
    family: "science",
    formula: "v = u + at",
    about:
      "the speed v after accelerating at a for time t from a starting speed u",
    target: "u",
    others: "v, a and t",
    correct: "u = v − at",
    wrong: [
      ["u = v + at", "at is added to u, so subtract it from both sides."],
      [
        "u = (v − a)/t",
        "a and t multiply each other; at is one term to subtract.",
      ],
      [
        "u = at − v",
        "Subtracting at from both sides gives v − at, not at − v.",
      ],
    ],
    steps: ["at is added to u.", "Subtract at from both sides: u = v − at."],
  },
  {
    family: "finance",
    formula: "I = Prt",
    about: "the simple interest I on a principal P at rate r for t years",
    target: "P",
    others: "I, r and t",
    correct: "P = I/(rt)",
    wrong: [
      ["P = Irt", "r and t multiply P, so divide by them."],
      ["P = rt/I", "This divides rt by I; it should divide I by rt."],
      ["P = I − rt", "rt multiplies P; undo multiplication by dividing."],
    ],
    steps: [
      "r and t both multiply P: I = P(rt).",
      "Divide both sides by rt: P = I/(rt).",
    ],
  },
  {
    family: "finance",
    formula: "T = p + px",
    about: "the total T paid on a price p with a sales-tax rate x",
    target: "p",
    others: "T and x",
    correct: "p = T/(1 + x)",
    wrong: [
      [
        "p = T − x",
        "p appears twice: factor it out, T = p(1 + x), then divide.",
      ],
      [
        "p = T/x − 1",
        "Factor first: T = p(1 + x), so divide T by all of 1 + x.",
      ],
      ["p = (T − x)/2", "p + px is p(1 + x), not 2p + x."],
    ],
    steps: [
      "Factor out p: T = p(1 + x).",
      "Divide both sides by 1 + x: p = T/(1 + x).",
    ],
  },
  {
    family: "lines",
    formula: "y = mx + b",
    about: "a line with slope m and y-intercept b",
    target: "b",
    others: "y, m and x",
    correct: "b = y − mx",
    wrong: [
      ["b = y + mx", "mx is added to b, so subtract it from both sides."],
      [
        "b = mx − y",
        "Subtracting mx from both sides gives y − mx, not mx − y.",
      ],
      ["b = y/(mx)", "b is added, not multiplied: subtract mx."],
    ],
    steps: ["mx is added to b.", "Subtract mx from both sides: b = y − mx."],
  },
  {
    family: "lines",
    formula: "ax + by = c",
    about: "a line in standard form, with a nonzero",
    target: "x",
    others: "y, a, b and c",
    correct: "x = (c − by)/a",
    wrong: [
      ["x = c/a − by", "Divide every term by a: (c − by)/a = c/a − by/a."],
      [
        "x = (c + by)/a",
        "by is added on the left, so subtract it from both sides.",
      ],
      [
        "x = (by − c)/a",
        "Subtracting by from both sides gives c − by, not by − c.",
      ],
    ],
    steps: [
      "Subtract by from both sides: ax = c − by.",
      "Divide both sides by a: x = (c − by)/a.",
    ],
  },
];
function formulaIsolate(r: Random): Case {
  const fc = pick(r, formulas);
  return {
    prompt: `The formula ${fc.formula} gives ${fc.about}. Which formula gives ${fc.target} in terms of ${fc.others}?`,
    choices: [
      { label: fc.correct, correct: true },
      ...fc.wrong.map(([label, feedback]) => ({ label, feedback })),
    ],
    explanation: [
      `Treat ${fc.target} as the unknown and every other letter as a known number. Undo what is done to ${fc.target}, in reverse order, on both sides.`,
      ...fc.steps,
    ],
    hint: `In ${fc.formula}, list what is done to ${fc.target}, then undo the last of those steps first on both sides.`,
    tags: [fc.family, fc.target],
  };
}

// --------------------------------------------------------------- formula-value
function formulaValue(r: Random): Case {
  const frame = pick(r, [
    "perimeter",
    "temperature",
    "trapezoid",
    "speed",
    "interest",
  ] as const);
  if (frame === "perimeter") {
    const l = r(6, 30),
      w = r(2, l);
    const P = 2 * l + 2 * w;
    return {
      prompt: `A rectangle's perimeter is P = 2l + 2w. Find the width w when P = ${P} and the length l = ${l}.`,
      answer: rat(w),
      explanation: [
        `Solve for w: subtract 2l, then divide by 2, so w = (P − 2l)/2.`,
        `Substitute: w = (${P} − 2 × ${l})/2 = ${P - 2 * l}/2.`,
        `w = ${w}.`,
      ],
      hint: `Substitute P = ${P} and l = ${l} into P = 2l + 2w, then undo the + 2l and the × 2 to isolate w.`,
      tags: [frame],
    };
  }
  if (frame === "temperature") {
    const C = 5 * r(-6, 20);
    const F = (9 * C) / 5 + 32;
    return {
      prompt: `Temperatures satisfy F = 9C/5 + 32. What Celsius temperature C equals ${n(F)} degrees Fahrenheit?`,
      answer: rat(C),
      explanation: [
        `Solve for C: subtract 32, then multiply by 5/9, so C = 5(F − 32)/9.`,
        `Substitute: C = 5(${n(F)} − 32)/9 = 5 × ${n(F - 32)}/9.`,
        `C = ${n(C)}.`,
      ],
      hint: `Put F = ${n(F)} into F = 9C/5 + 32. Subtract 32 from both sides before undoing the 9/5.`,
      tags: [frame, C < 0 ? "negative" : "positive"],
    };
  }
  if (frame === "trapezoid") {
    const h = r(2, 12),
      sum = 2 * r(3, 12);
    const b1 = r(1, sum - 1),
      b2 = sum - b1;
    const A = (sum * h) / 2;
    return {
      prompt: `A trapezoid's area is A = ½(b₁ + b₂)h. Find the height h when A = ${A}, b₁ = ${b1} and b₂ = ${b2}.`,
      answer: rat(h),
      explanation: [
        `Solve for h: multiply by 2, then divide by b₁ + b₂, so h = 2A/(b₁ + b₂).`,
        `Substitute: h = 2 × ${A}/(${b1} + ${b2}) = ${2 * A}/${sum}.`,
        `h = ${h}.`,
      ],
      hint: `Substitute A = ${A}, b₁ = ${b1} and b₂ = ${b2}: ${A} = ½(${b1} + ${b2})h. Add the bases first, then isolate h.`,
      tags: [frame],
    };
  }
  if (frame === "speed") {
    const a = r(2, 9),
      t = r(2, 9),
      u = r(0, 20);
    const v = u + a * t;
    return {
      prompt: `A cart's speed is v = u + at. Find its acceleration a when v = ${v}, u = ${u} and t = ${t}.`,
      answer: rat(a),
      explanation: [
        `Solve for a: subtract u, then divide by t, so a = (v − u)/t.`,
        `Substitute: a = (${v} − ${u})/${t} = ${v - u}/${t}.`,
        `a = ${a}.`,
      ],
      hint: `Substitute v = ${v}, u = ${u} and t = ${t} into v = u + at, then subtract ${u} from both sides first.`,
      tags: [frame],
    };
  }
  const P = 100 * r(2, 30),
    rate = r(2, 9),
    t = r(2, 8);
  const I = (P * rate * t) / 100;
  return {
    prompt: `Simple interest is I = Prt. Find the time t, in years, when I = ${I}, P = ${P} and r = ${rate / 100}.`,
    answer: rat(t),
    explanation: [
      `Solve for t: divide by P and by r, so t = I/(Pr).`,
      `Substitute: Pr = ${P} × ${rate / 100} = ${(P * rate) / 100}, so t = ${I}/${(P * rate) / 100}.`,
      `t = ${t}.`,
    ],
    hint: `Substitute I = ${I}, P = ${P} and r = ${rate / 100} into I = Prt. Multiply ${P} × ${rate / 100} first, then divide.`,
    tags: [frame],
  };
}

// ------------------------------------------------------- solution-point-choice
type Equation = {
  text: string;
  holds: (x: number, y: number) => boolean;
  /** How substituting (x, y) reads, ending in whether it holds. */
  check: (x: number, y: number) => string;
  y: (x: number) => number;
  /** x-values that give whole-number y-values are multiples of this. */
  step: number;
};
const ratIs = (v: Rational, y: number) => v.d === 1 && v.n === y;
const rightSide = (expr: string, value: Rational, y: number) =>
  `the right side is ${expr} = ${qt(value)}, ${ratIs(value, y) ? "equal to" : "not"} y = ${n(y)}`;
function equationFor(r: Random, frame: string): Equation {
  if (frame === "standard") {
    const a = nonzero(r, -5, 5),
      b = nonzero(r, -5, 5);
    const c = a * r(-5, 5) + b * r(-5, 5);
    const sub = (x: number, y: number) =>
      `${scaled(a, x)}${scaled(b, y, false)}`;
    return {
      text: `${twoTerm(a, b)} = ${n(c)}`,
      holds: (x, y) => a * x + b * y === c,
      check: (x, y) =>
        `${sub(x, y)} = ${n(a * x + b * y)}${a * x + b * y === c ? "" : `, not ${n(c)}`}`,
      y: (x) => (c - a * x) / b,
      step: 1,
    };
  }
  if (frame === "slope") {
    const den = pick(r, [2, 3]),
      num = nonzero(r, -5, 5),
      b = r(-5, 5);
    const m = rat(num, den);
    const coef =
      m.d === 1
        ? termText(m.n, "x")
        : `${m.n < 0 ? "−" : ""}${Math.abs(m.n)}/${m.d}x`;
    const value = (x: number) => rat(m.n * x + b * m.d, m.d);
    return {
      text: `y = ${coef}${constText(b)}`,
      holds: (x, y) => ratIs(value(x), y),
      check: (x, y) =>
        rightSide(`${qt(m)} × ${p(x)}${constText(b)}`, value(x), y),
      y: (x) => (m.n * x) / m.d + b,
      step: m.d,
    };
  }
  if (frame === "quadratic") {
    const a = pick(r, [1, 1, -1, 2]),
      b = r(-4, 4),
      c = r(-5, 5);
    const at = (x: number) => a * x * x + b * x + c;
    return {
      text: `y = ${termText(a, "x²")}${termText(b, "x", false)}${constText(c)}`,
      holds: (x, y) => y === at(x),
      check: (x, y) => rightSide(quadAt(a, b, c, x), rat(at(x)), y),
      y: at,
      step: 1,
    };
  }
  const h = r(-4, 4),
    k = r(-4, 4);
  const at = (x: number) => Math.abs(x - h) + k;
  return {
    text: `y = |x${constText(-h)}|${constText(k)}`,
    holds: (x, y) => y === at(x),
    check: (x, y) =>
      rightSide(`|${n(x)}${constText(-h)}|${constText(k)}`, rat(at(x)), y),
    y: at,
    step: 1,
  };
}
function solutionPointChoice(r: Random): Case {
  const frame = pick(r, [
    "standard",
    "slope",
    "quadratic",
    "absolute",
  ] as const);
  for (;;) {
    const eq = equationFor(r, frame);
    const step = eq.step;
    const x0 = step * r(-3, 3);
    const y0 = eq.y(x0);
    if (!Number.isInteger(y0) || Math.abs(y0) > 30) continue;
    const pts: [number, number][] = [
      [y0, x0],
      [x0, -y0],
      [-x0, y0],
      [x0, y0 + 1],
      [x0 + step, y0],
      [x0, y0 - 2],
    ].filter(([x, y]) => !eq.holds(x, y)) as [number, number][];
    const unique = pts.filter(
      ([x, y], i) => pts.findIndex(([u, v]) => u === x && v === y) === i,
    );
    if (unique.length < 3) continue;
    const wrong = shuffle(r, unique).slice(0, 3);
    const check = eq.check;
    return {
      prompt: `Which point is on the graph of ${eq.text}?`,
      choices: [
        { label: pair([x0, y0]), correct: true },
        ...wrong.map(([x, y]) => ({
          label: pair([x, y]),
          feedback: `Substituting x = ${n(x)} and y = ${n(y)}: ${check(x, y)}. The point is not on the graph.`,
        })),
      ],
      explanation: [
        `The graph of an equation is every point (x, y) whose coordinates make the equation true. Substitute each pair, x first.`,
        `For ${pair([x0, y0])}: ${check(x0, y0)}, so it is on the graph.`,
        `Each other pair makes the two sides differ, so those points are off the graph.`,
      ],
      hint: `Put each pair into ${eq.text}, the first number for x and the second for y, and keep the one that makes it true.`,
      tags: [frame],
    };
  }
}

// --------------------------------------------------------- solution-coordinate
function solutionCoordinate(r: Random): Case {
  const frame = pick(r, ["find-y", "find-x", "parabola"] as const);
  if (frame === "parabola") {
    const a = pick(r, [1, -1]),
      b = r(-4, 4),
      c = r(-6, 6),
      x0 = nonzero(r, -4, 4);
    const at = (x: number) => a * x * x + b * x + c;
    const k = at(x0);
    const text = `y = ${termText(a, "x²")}${termText(b, "x", false)}${constText(c)}`;
    const scene = graph({ id: "g", x: [-6, 6], y: [-10, 10], grid: 1, tick: 2 })
      .curve(f.poly(a, b, c))
      .segment([x0, -10], [x0, 10], { dash: "dash" })
      .scene({ title: `Graph of ${text} with the line x = ${n(x0)}` });
    const sq = quadAt(a, b, c, x0);
    return {
      prompt: `The point (${n(x0)}, k) is on the graph of ${text}. What is k?`,
      answer: rat(k),
      scene,
      explanation: [
        `A point is on the graph exactly when its coordinates make the equation true, so substitute x = ${n(x0)}.`,
        `k = ${sq} = ${n(k)}.`,
        `The parabola meets the dashed line x = ${n(x0)} at (${n(x0)}, ${n(k)}).`,
      ],
      hint: `Substitute x = ${n(x0)} into ${text}; square ${n(x0)} before multiplying${a < 0 ? " by −1" : ""}.`,
      tags: [frame],
    };
  }
  for (;;) {
    const a = nonzero(r, -5, 5),
      b = nonzero(r, -5, 5);
    const px0 = r(-4, 4),
      py0 = r(-4, 4);
    const c = a * px0 + b * py0;
    const text = `${twoTerm(a, b)} = ${n(c)}`;
    const known = nonzero(r, -6, 6);
    const findY = frame === "find-y";
    const ans = findY ? rat(c - a * known, b) : rat(c - b * known, a);
    if (Math.abs(ans.n / ans.d) > 9) continue;
    const scene = graph({ id: "g", x: [-9, 9], y: [-9, 9], grid: 1, tick: 3 })
      .line({ a, b, c })
      .segment(
        findY ? [known, -9] : [-9, known],
        findY ? [known, 9] : [9, known],
        { dash: "dash" },
      )
      .scene({
        title: `Graph of ${text} with the line ${findY ? "x" : "y"} = ${n(known)}`,
      });
    const point = findY ? `(${n(known)}, k)` : `(k, ${n(known)})`;
    const sub = findY
      ? `${scaled(a, known)}${termText(b, "k", false)}`
      : `${termText(a, "k")}${scaled(b, known, false)}`;
    const moved = findY ? a * known : b * known;
    const times = (k: number, v: Rational, first: boolean) => {
      const mag = Math.abs(k) === 1 ? pq(v) : `${Math.abs(k)} × ${pq(v)}`;
      return first
        ? `${k < 0 ? "−" : ""}${mag}`
        : `${k < 0 ? " − " : " + "}${mag}`;
    };
    const check = findY
      ? `${scaled(a, known)}${times(b, ans, false)}`
      : `${times(a, ans, true)}${scaled(b, known, false)}`;
    const coeff = findY ? b : a;
    return {
      prompt: `The point ${point} is on the graph of ${text}. What is k?`,
      answer: ans,
      scene,
      explanation: [
        `Points on the graph are exactly the pairs that make the equation true. Substitute ${findY ? "x" : "y"} = ${n(known)}: ${sub} = ${n(c)}.`,
        `Then ${n(moved)} ${coeff < 0 ? "−" : "+"} ${Math.abs(coeff) === 1 ? "" : Math.abs(coeff)}k = ${n(c)}, so ${coeff === 1 ? "" : coeff === -1 ? "−" : n(coeff)}k = ${n(c - moved)}.`,
        `k = ${quotient(c - moved, coeff)}. Check: ${check} = ${n(c)}. The graph crosses the dashed line ${findY ? "x" : "y"} = ${n(known)} at ${findY ? `(${n(known)}, ${qt(ans)})` : `(${qt(ans)}, ${n(known)})`}.`,
      ],
      hint: `Substitute ${findY ? "x" : "y"} = ${n(known)} into ${text}, then solve the one-variable equation for k.`,
      tags: [frame, ans.d === 1 ? "integer" : "fraction"],
    };
  }
}

const builders: Record<string, (r: Random) => Case> = {
  "graph-domain-range": graphDomainRange,
  "context-domain-range": contextDomainRange,
  "function-relation-test": functionRelation,
  "average-rate-formula": averageRateFormula,
  "average-rate-display": averageRateDisplay,
  "linear-model-value": linearModelValue,
  "linear-model-equation": linearModelEquation,
  "formula-isolate": formulaIsolate,
  "formula-value": formulaValue,
  "solution-point-choice": solutionPointChoice,
  "solution-coordinate": solutionCoordinate,
};
const labels: Record<string, string> = {
  "graph-domain-range": "Choose the interval",
  "context-domain-range": "Choose the description",
  "function-relation-test": "Choose one relation",
  "average-rate-formula": "Average rate of change",
  "average-rate-display": "Average rate of change",
  "linear-model-value": "Answer",
  "linear-model-equation": "Choose the equation",
  "formula-isolate": "Choose the formula",
  "formula-value": "Answer",
  "solution-point-choice": "Choose the point",
  "solution-coordinate": "k",
};
const fractionItems = new Set([
  "average-rate-formula",
  "average-rate-display",
  "solution-coordinate",
]);

export function linearFunctionPrintCase(id: string, seed: string) {
  const meta = linearFunctionTemplates.find((t) => t.id === id);
  if (!meta) throw new Error(`Unknown linear-function template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = seeded(id, seed);
  return assemble(
    meta,
    seed,
    builders[id]!(r),
    r,
    labels[id]!,
    fractionItems.has(id) ? "fraction" : "number",
  );
}
export const generateLinearFunctionProblem = (
  id: string,
  seed: string,
): GeneratedProblem => linearFunctionPrintCase(id, seed).problem;
