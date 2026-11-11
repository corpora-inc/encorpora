import { createHash } from "node:crypto";
import type {
  FunctionDisplayFigure,
  GeneratedProblem,
  ProblemResponse,
  TemplateMetadata,
} from "./contracts";
import { nounFor } from "./agreement";
import {
  axisRecord,
  chooseAxes,
  defineAxis,
  isLegacy,
  type AxisSet,
} from "./variation/axes";

type Random = (low: number, high: number) => number;
type Choice = { label: string; correct?: true; feedback?: string };
type Case = {
  prompt: string;
  /** Number answers; choice items give `choices` instead. */
  answer?: number;
  choices?: Choice[];
  explanation: string[];
  figure?: FunctionDisplayFigure;
  tags: string[];
  /** One teaching step written from this problem's own givens. */
  hint: string;
};

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const display = { requiredFigureCapability: "function-displays-v1" as const };

export const patternFunctionTemplates: readonly TemplateMetadata[] = [
  {
    id: "rule-pattern-term",
    version: 1,
    title: "Extend a pattern from its rule",
    skillId: "rule-patterns",
    gradeBand: "3–5",
    description:
      "Generate the terms of a number pattern from its start and rule to find a later term.",
  },
  {
    id: "rule-pattern-feature",
    version: 1,
    title: "What a pattern rule guarantees",
    skillId: "rule-patterns",
    gradeBand: "3–5",
    description:
      "Identify a feature that every term of a rule-generated pattern shares, such as being odd or a multiple of a number.",
    ...choice,
  },
  {
    id: "related-patterns-relationship",
    version: 1,
    title: "Relate two patterns",
    skillId: "related-patterns",
    gradeBand: "3–5",
    description:
      "Pair the terms of two patterns, read the pairs in a table and on a graph, and state how each term of one pattern relates to the matching term of the other.",
    ...display,
  },
  {
    id: "dependent-variable-equation",
    version: 1,
    title: "Write the equation from a table and graph",
    skillId: "dependent-variables",
    gradeBand: "6–8",
    description:
      "Identify the dependent and independent variables in a context and choose the equation that expresses the dependent variable in terms of the independent one.",
    ...choice,
    ...display,
  },
  {
    id: "dependent-variable-value",
    version: 1,
    title: "Use an equation between two variables",
    skillId: "dependent-variables",
    gradeBand: "6–8",
    description:
      "Use an equation such as d = 65t to find one variable's value from the other's.",
  },
  {
    id: "compare-function-rates",
    version: 2,
    reprintsFrom: 1,
    title: "Compare two functions",
    skillId: "compare-functions",
    gradeBand: "6–8",
    description:
      "Compare the rates of change and initial values of two linear functions given by a table, a graph, an equation or a description. Also compare two proportional relationships shown in two different ways, including a distance-time graph and a distance-time equation.",
    ...choice,
    ...display,
  },
  {
    id: "linear-function-choice",
    version: 2,
    reprintsFrom: 1,
    title: "Linear or not linear",
    skillId: "compare-functions",
    gradeBand: "6–8",
    description:
      "Decide which equation defines a linear function, including forms that are linear without looking like y = mx + b. Also say why a function given by three points is not linear. The square-area points (1, 1), (2, 4) and (3, 9) are one of those cases.",
    ...choice,
  },
];

function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
/** Typographic minus for display; answers keep ASCII. */
const n = (v: number) => (v < 0 ? `−${-v}` : String(v));
/** A signed value inside arithmetic, parenthesized when negative. */
const p = (v: number) => (v < 0 ? `(−${-v})` : String(v));
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** Exact rational text for a/b, reduced, with a typographic minus. */
function q(a: number, b = 1) {
  if (b < 0) [a, b] = [-a, -b];
  const g = gcd(a, b) || 1;
  const [x, y] = [a / g, b / g];
  return `${n(x)}${y === 1 ? "" : `/${y}`}`;
}
const ordinal = (k: number) =>
  `${k}${k % 100 >= 11 && k % 100 <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[k % 10] ?? "th")}`;

/** Grid range and step: at most 8 labelled steps, with room for `value`. */
export function niceAxis(value: number) {
  for (const step of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500])
    if (Math.ceil(value / step) <= 8)
      return { max: Math.max(step, Math.ceil(value / step) * step), step };
  throw new Error("Axis range too large");
}

// ---------------------------------------------------------------- rule-pattern-term
function ruleTermCase(r: Random): Case {
  const mode = pick(r, ["add", "add", "subtract", "multiply"] as const);
  let start: number, step: number, k: number, terms: number[], rule: string;
  if (mode === "add") {
    start = r(0, 25);
    step = r(2, 12);
    k = r(5, 10);
    terms = Array.from({ length: k }, (_, i) => start + i * step);
    rule = `add ${step}`;
  } else if (mode === "subtract") {
    step = r(2, 9);
    k = r(5, 9);
    start = step * (k - 1) + r(0, 20);
    terms = Array.from({ length: k }, (_, i) => start - i * step);
    rule = `subtract ${step}`;
  } else {
    step = r(2, 3);
    k = step === 2 ? r(4, 7) : r(4, 5);
    start = step === 2 ? r(1, 6) : r(1, 4);
    terms = Array.from({ length: k }, (_, i) => start * step ** i);
    rule = `multiply by ${step}`;
  }
  const answer = terms.at(-1)!;
  const sign = { add: "+", subtract: "−", multiply: "×" }[mode];
  const repeated =
    mode === "multiply"
      ? `${start} × ${Array(k - 1)
          .fill(step)
          .join(" × ")} = ${answer}`
      : `${start} ${sign} ${k - 1} × ${step} = ${answer}`;
  return {
    prompt: `A number pattern starts at ${start}. Its rule is “${rule}.” What is the ${ordinal(k)} number in the pattern?`,
    answer,
    hint: `Write the next number: ${start} ${sign} ${step} = ${terms[1]}. Keep applying “${rule}” to each new number until you reach the ${ordinal(k)} number.`,
    explanation: [
      `The start is the 1st number, ${start}. Each later number comes from applying “${rule}” to the number before it.`,
      `Apply the rule again and again: ${terms.join(", ")}.`,
      `From the 1st number to the ${ordinal(k)}, the rule is applied ${k - 1} times: ${repeated}.`,
      `The ${ordinal(k)} number is ${answer}.`,
    ],
    tags: [mode, k >= 8 ? "far" : "near"],
  };
}

// ---------------------------------------------------------------- rule-pattern-feature
const parity = (v: number) => (v % 2 === 0 ? "even" : "odd");
export const featureStatements = {
  odd: "Every number in the pattern is odd.",
  even: "Every number in the pattern is even.",
  alternate: "The numbers in the pattern alternate between odd and even.",
  multiple: (m: number) => `Every number in the pattern is a multiple of ${m}.`,
  ends: (d: number) => `Every number in the pattern ends in the digit ${d}.`,
};
function featureCase(r: Random): Case {
  const mode = pick(r, ["parity", "multiple", "ones"] as const);
  let start: number, step: number;
  let factor = 0;
  const choices: Choice[] = [];
  const explanation: string[] = [];
  if (mode === "parity") {
    step = r(3, 9);
    do start = r(1, 30);
    while (start % step === 0);
  } else if (mode === "multiple") {
    factor = r(3, 6);
    const b = r(2, 4);
    let a: number;
    do a = r(1, 7);
    while (a % b === 0);
    start = factor * a;
    step = factor * b;
  } else {
    step = 10 * r(1, 5);
    do start = r(1, 99);
    while (start % 10 === 0);
  }
  const terms = Array.from({ length: 6 }, (_, i) => start + i * step);
  explanation.push(
    `Start at ${start} and add ${step} each time: ${terms.join(", ")}, …`,
  );
  const evenStep = step % 2 === 0;
  const parityReason = evenStep
    ? `The rule adds ${step}, an even number. Adding an even number never changes whether a number is odd or even, so every number is ${parity(start)}, like the start, ${start}.`
    : `The rule adds ${step}, an odd number. Adding an odd number switches odd to even and even to odd, so the numbers alternate: ${terms.slice(0, 3).join(", ")}, …`;
  const parityFeedback = (statement: "odd" | "even" | "alternate") =>
    evenStep
      ? statement === "alternate"
        ? `Adding ${step}, an even number, never switches odd and even. Every number is ${parity(start)}, like ${start}.`
        : `${start} is ${parity(start)}, and adding the even number ${step} keeps a number ${parity(start)}, so no number is ${statement}.`
      : `Adding ${step}, an odd number, switches odd and even at every step: ${terms.slice(0, 3).join(", ")}. The numbers are not all ${statement}.`;
  if (mode === "parity") {
    const truth = evenStep ? parity(start) : "alternate";
    for (const key of ["odd", "even", "alternate"] as const)
      choices.push({
        label: featureStatements[key],
        ...(key === truth
          ? { correct: true as const }
          : { feedback: parityFeedback(key) }),
      });
    choices.push({
      label: featureStatements.multiple(step),
      feedback: `Adding ${step} keeps the same remainder after division by ${step}. The start, ${start}, is not a multiple of ${step}, so no number in the pattern is.`,
    });
    explanation.push(parityReason);
  } else if (mode === "multiple") {
    choices.push({ label: featureStatements.multiple(factor), correct: true });
    choices.push({
      label: featureStatements.multiple(step),
      feedback: `The step ${step} is a multiple of ${step}, but the start is not: ${start} ÷ ${step} leaves a remainder of ${start % step}. Every number keeps that remainder.`,
    });
    for (const key of evenStep
      ? ([start % 2 === 0 ? "odd" : "even", "alternate"] as const)
      : (["odd", "even"] as const))
      choices.push({
        label: featureStatements[key],
        feedback: parityFeedback(key),
      });
    explanation.push(
      `The start is $${start} = ${factor} × ${start / factor}$, and the rule adds $${step} = ${factor} × ${step / factor}$. A multiple of ${factor} plus a multiple of ${factor} is again a multiple of ${factor}, so every number is a multiple of ${factor}.`,
    );
  } else {
    const ones = start % 10,
      tens = step / 10;
    choices.push({ label: featureStatements.ends(ones), correct: true });
    choices.push({
      label: featureStatements.ends(0),
      feedback: `The step ${step} ends in 0, but the numbers do not: adding ${step} leaves the ones digit of the start, ${ones}, unchanged.`,
    });
    choices.push({
      label: featureStatements.alternate,
      feedback: parityFeedback("alternate"),
    });
    choices.push({
      label: featureStatements[start % 2 === 0 ? "odd" : "even"],
      feedback: parityFeedback(start % 2 === 0 ? "odd" : "even"),
    });
    explanation.push(
      `Adding ${step} adds ${tens === 1 ? "1 ten" : `${tens} tens`} and no ones, so the ones digit never changes. Every number ends in ${ones}, the ones digit of ${start}.`,
    );
  }
  explanation.push(
    `The true statement is: ${choices.find((c) => c.correct)!.label}`,
  );
  return {
    prompt: `A number pattern starts at ${start}. Its rule is “add ${step}.” Which statement about the pattern is true?`,
    hint: `List the first numbers: ${terms.slice(0, 4).join(", ")}, … Then ask what adding ${step} does to every number: to odd and even, to multiples, or to the ones digit.`,
    choices,
    explanation,
    tags: [
      mode,
      mode === "parity"
        ? evenStep
          ? `constant-${parity(start)}`
          : "alternate"
        : mode,
    ],
  };
}

// ---------------------------------------------------------------- related-patterns-relationship
function relatedCase(r: Random): Case {
  const a = r(1, 5),
    k = r(2, 6),
    b = k * a;
  const rows = Array.from({ length: 5 }, (_, i) => ({ x: i * a, y: i * b }));
  const xs = niceAxis(rows.at(-1)!.x),
    ys = niceAxis(rows.at(-1)!.y);
  const extend = r(0, 1) === 1;
  const later = r(6, 12) * a;
  const question = extend
    ? `The patterns continue. Which term of pattern B matches ${later} in pattern A?`
    : "Each term of pattern B is how many times the matching term of pattern A?";
  const explanation = [
    `Each step adds ${a} to pattern A and ${b} to pattern B. Since ${b} = ${k} × ${a}, pattern B gains ${k} times as much as pattern A at every step.`,
    `After the same number of steps, B has gained ${k} times as much, so each B-term is ${k} times its A-term: ${rows[2]!.y} = ${k} × ${rows[2]!.x} and ${rows[4]!.y} = ${k} × ${rows[4]!.x}.`,
  ];
  explanation.push(
    extend
      ? `The term of B that matches ${later} is ${k} × ${later} = ${k * later}. On the graph, the point (${later}, ${k * later}) continues the same straight line through (0, 0).`
      : `Each term of pattern B is ${k} times the matching term of pattern A. On the graph, every point (A, B) has a B-coordinate ${k} times its A-coordinate, so the points line up through (0, 0).`,
  );
  return {
    prompt: `Pattern A starts at 0 and adds ${a} each step. Pattern B starts at 0 and adds ${b} each step. ${question}`,
    answer: extend ? k * later : k,
    hint: extend
      ? `Each step adds ${a} to pattern A and ${b} to pattern B, so every B-term is the same multiple of its A-term. Find that multiple from a row of the table, then apply it to ${later}.`
      : `Each step adds ${a} to pattern A and ${b} to pattern B. How many times ${a} is ${b}? Check that multiple on a row of the table.`,
    explanation,
    figure: {
      kind: "function-display",
      table: { columns: ["Pattern A", "Pattern B"], rows },
      graph: {
        xLabel: "A",
        yLabel: "B",
        xMax: xs.max,
        yMax: ys.max,
        xStep: xs.step,
        yStep: ys.step,
        series: [{ points: rows }],
      },
    },
    tags: [extend ? "extend" : "factor", `factor-${k}`],
  };
}

// ---------------------------------------------------------------- dependent-variable-equation
type Context = {
  key: string;
  kind: "rate" | "offset";
  intro: (c: number) => string;
  /** One sentence naming the variables; their units label the table. */
  shows: string;
  x: string;
  y: string;
  xUnit: string;
  yUnit: string;
  constants: number[];
  inputs: (r: Random) => number[];
};
const rateInputs = (r: Random) => {
  const [x0, step] = pick(r, [
    [1, 2],
    [2, 1],
    [2, 2],
    [2, 3],
    [3, 1],
  ] as const);
  return Array.from({ length: 4 }, (_, i) => x0 + i * step);
};
export const equationContexts: Context[] = [
  {
    key: "car",
    kind: "rate",
    intro: () => "A car travels at a constant speed.",
    shows: "After $t$ hours it has gone $d$ miles.",
    x: "t",
    y: "d",
    xUnit: "hours",
    yUnit: "miles",
    constants: [40, 45, 50, 55, 60, 65, 70],
    inputs: rateInputs,
  },
  {
    key: "pay",
    kind: "rate",
    intro: () => "Sam is paid the same amount for every hour of work.",
    shows: "For $h$ hours, Sam earns $p$ dollars.",
    x: "h",
    y: "p",
    xUnit: "hours",
    yUnit: "dollars",
    constants: [9, 11, 12, 14, 15, 16, 18, 20],
    inputs: rateInputs,
  },
  {
    key: "printer",
    kind: "rate",
    intro: () => "A printer prints pages at a constant rate.",
    shows: "In $m$ minutes it prints $p$ pages.",
    x: "m",
    y: "p",
    xUnit: "minutes",
    yUnit: "pages",
    constants: [12, 15, 18, 20, 24, 25, 30],
    inputs: rateInputs,
  },
  {
    key: "tickets",
    kind: "rate",
    intro: () => "Every ticket to a show costs the same amount.",
    shows: "$n$ tickets cost $c$ dollars.",
    x: "n",
    y: "c",
    xUnit: "tickets",
    yUnit: "dollars",
    constants: [6, 7, 8, 9, 12, 15],
    inputs: rateInputs,
  },
  {
    key: "ages",
    kind: "offset",
    intro: (c) => `Mia is always ${c} years older than her brother.`,
    shows: "When her brother is $b$, Mia is $m$.",
    x: "b",
    y: "m",
    xUnit: "years",
    yUnit: "years",
    constants: [2, 3, 4, 5, 6, 7, 8, 9],
    inputs: (r) => {
      const x0 = r(1, 4),
        step = r(1, 3);
      return Array.from({ length: 4 }, (_, i) => x0 + i * step);
    },
  },
  {
    key: "greenhouse",
    kind: "offset",
    intro: (c) => `A greenhouse is always ${c} °F warmer than the air outside.`,
    shows: "When it is $a$ °F outside, the greenhouse is $g$ °F.",
    x: "a",
    y: "g",
    xUnit: "°F",
    yUnit: "°F",
    constants: [5, 8, 10, 12, 15, 20],
    inputs: (r) => {
      const x0 = 10 * r(3, 5),
        step = pick(r, [5, 10]);
      return Array.from({ length: 4 }, (_, i) => x0 + i * step);
    },
  },
];
function equationCase(r: Random): Case {
  const ctx = pick(r, equationContexts);
  const c = pick(r, ctx.constants);
  const xs = ctx.inputs(r);
  const rate = ctx.kind === "rate";
  const f = (x: number) => (rate ? c * x : x + c);
  const rows = xs.map((x) => ({ x, y: f(x) }));
  const { x, y } = ctx;
  const correct = rate ? `${y} = ${c}${x}` : `${y} = ${x} + ${c}`;
  const row = rows[1]!;
  const choices: Choice[] = [{ label: correct, correct: true }];
  if (rate) {
    const wrongRate = xs[0] !== 1 ? rows[0]!.y : rows[1]!.y - rows[0]!.y;
    choices.push(
      {
        label: `${x} = ${c}${y}`,
        feedback: `This equation makes $${x}$ depend on $${y}$. Here $${y}$ depends on $${x}$, so $${y}$ stands alone: ${correct}.`,
      },
      {
        label: `${y} = ${x} + ${c}`,
        feedback: `Check a row: when ${x} = ${row.x}, ${row.x} + ${c} = ${row.x + c}, but the table shows ${row.y}. Here $${y}$ is ${c} times $${x}$, not ${c} more.`,
      },
      {
        label: `${y} = ${wrongRate}${x}`,
        feedback: `${wrongRate} is ${xs[0] !== 1 ? `the value of $${y}$ when ${x} = ${xs[0]}` : `the change in $${y}$ from one row to the next, when $${x}$ grows by ${xs[1]! - xs[0]!}`}, not the amount for each 1 of $${x}$. Divide: ${row.y} ÷ ${row.x} = ${c}.`,
      },
    );
  } else {
    choices.push(
      {
        label: `${x} = ${y} + ${c}`,
        feedback: `This equation makes $${x}$ the larger value. Here $${y}$ is ${c} more than $${x}$, so ${correct}.`,
      },
      {
        label: `${y} = ${c}${x}`,
        feedback: `Check a row: when ${x} = ${row.x}, ${c} × ${row.x} = ${c * row.x}, but the table shows ${row.y}. Here $${y}$ is ${c} more than $${x}$, not ${c} times $${x}$.`,
      },
      {
        label: `${y} = ${x} − ${c}`,
        feedback: `In every row $${y}$ is larger than $${x}$, so ${c} is added to $${x}$, not subtracted.`,
      },
    );
  }
  const xa = niceAxis(xs.at(-1)!),
    ya = niceAxis(rows.at(-1)!.y);
  const label = (v: string, unit: string) => `${v} (${unit})`;
  const explanation = [
    `The independent variable is $${x}$: its values are chosen first. The dependent variable is $${y}$: its value depends on $${x}$.`,
    rate
      ? `In every row, ${y} ÷ ${x} is the same: ${rows.map((w) => `${w.y} ÷ ${w.x} = ${c}`).join("; ")}.`
      : `In every row, ${y} − ${x} is the same: ${rows.map((w) => `${w.y} − ${w.x} = ${c}`).join("; ")}.`,
    rate
      ? `So $${y}$ is always ${c} times $${x}$: ${correct}. On the graph, the points lie on a line through (0, 0) that rises ${c} for each 1 to the right.`
      : `So $${y}$ is always ${c} more than $${x}$: ${correct}. On the graph, the points lie on a line that crosses the vertical axis at ${c} and rises 1 for each 1 to the right.`,
  ];
  return {
    prompt: `${ctx.intro(c)} ${ctx.shows} Which equation gives $${y}$ in terms of $${x}$?`,
    hint: rate
      ? `Take one row: when ${x} = ${row.x}, ${y} = ${row.y}. Is ${row.y} a fixed number times ${row.x}, or a fixed number more than ${row.x}? Test the same on a second row.`
      : `The story gives ${c}. Take one row: when ${x} = ${row.x}, ${y} = ${row.y}. Is ${row.y} equal to ${c} times ${row.x}, or ${c} more than ${row.x}?`,
    choices,
    explanation,
    figure: {
      kind: "function-display",
      table: {
        columns: [label(x, ctx.xUnit), label(y, ctx.yUnit)],
        rows,
      },
      graph: {
        xLabel: label(x, ctx.xUnit),
        yLabel: label(y, ctx.yUnit),
        xMax: xa.max,
        yMax: ya.max,
        xStep: xa.step,
        yStep: ya.step,
        series: [
          {
            points: rows,
            line: rate ? { rise: c, run: 1, b: 0 } : { rise: 1, run: 1, b: c },
          },
        ],
      },
    },
    tags: [ctx.key, ctx.kind],
  };
}

// ---------------------------------------------------------------- dependent-variable-value
function valueCase(r: Random): Case {
  const mode = pick(r, [
    "printer",
    "car",
    "tickets",
    "pay",
    "ages",
    "car",
  ] as const);
  if (mode === "ages") {
    const c = r(2, 9),
      brother = r(2, 12),
      mia = brother + c;
    return {
      prompt: `Mia is always ${c} years older than her brother, so m = b + ${c}, where $m$ is Mia's age and $b$ is her brother's. How old is her brother when Mia is ${mia}?`,
      answer: brother,
      hint: `Substitute Mia's age for $m$: ${mia} = b + ${c}. Undo the + ${c}.`,
      explanation: [
        `In m = b + ${c}, Mia's age $m$ depends on her brother's age $b$. Substitute m = ${mia}: ${mia} = b + ${c}.`,
        `Subtract ${c} from both sides: b = ${mia} − ${c} = ${brother}.`,
        `Check: ${brother} + ${c} = ${mia}. Her brother is ${brother} years old.`,
      ],
      tags: ["ages", "solve"],
    };
  }
  const table = {
    printer: { rates: [12, 15, 18, 20, 24, 25], x: "m", y: "p" },
    car: { rates: [40, 45, 50, 55, 60, 65, 70], x: "t", y: "d" },
    tickets: { rates: [6, 7, 8, 9, 12, 15], x: "n", y: "c" },
    pay: { rates: [9, 11, 12, 14, 15, 16, 18], x: "h", y: "p" },
  }[mode];
  const c = pick(r, table.rates),
    input = r(2, 12),
    output = c * input;
  const { x, y } = table;
  const forward = mode === "printer" || mode === "pay";
  const prompt = {
    printer: `A printer prints ${c} pages per minute, so p = ${c}m for $p$ pages in $m$ minutes. How many pages does it print in ${input} minutes?`,
    car: `A car travels at a constant speed, so d = ${c}t for $d$ miles in $t$ hours. How many hours does it take to travel ${output} miles?`,
    tickets: `Each ticket costs ${c} dollars, so c = ${c}n for a cost of $c$ dollars for $n$ tickets. How many tickets cost ${output} dollars?`,
    pay: `Sam earns ${c} dollars per hour, so p = ${c}h for $p$ dollars earned in $h$ hours. How many dollars does Sam earn in ${input} hours?`,
  }[mode];
  const unit = {
    printer: "pages",
    car: "hours",
    tickets: "tickets",
    pay: "dollars",
  }[mode];
  const explanation = forward
    ? [
        `In ${y} = ${c}${x}, $${y}$ is the dependent variable: it depends on $${x}$. Substitute ${x} = ${input}.`,
        `${y} = ${c} × ${input} = ${output}.`,
        `So the answer is ${output} ${unit} when ${x} = ${input}.`,
      ]
    : [
        `In ${y} = ${c}${x}, $${y}$ is the dependent variable and $${x}$ is the independent variable. Substitute ${y} = ${output}: ${output} = ${c}${x}.`,
        `Divide both sides by ${c}: ${x} = ${output} ÷ ${c} = ${input}.`,
        `Check: ${c} × ${input} = ${output}. The answer is ${input} ${unit}.`,
      ];
  return {
    prompt,
    answer: forward ? output : input,
    hint: forward
      ? `Substitute ${x} = ${input} into ${y} = ${c}${x}, then multiply.`
      : `Substitute ${y} = ${output} into ${y} = ${c}${x}: ${output} = ${c}${x}. Undo the multiplication by ${c}.`,
    explanation,
    tags: [mode, forward ? "evaluate" : "solve"],
  };
}

// ---------------------------------------------------------------- compare-function-rates
type Rep = "table" | "graph" | "equation" | "words";
type Linear = { rise: number; run: number; b: number };
const at = (f: Linear, x: number) => (f.rise * x) / f.run + f.b;
const rateText = (f: Linear) => q(f.rise, f.run);
const compareOptions = (rate: "A" | "B", start: "A" | "B") =>
  rate === start
    ? `Function ${rate} has the greater rate of change and the greater initial value.`
    : `Function ${rate} has the greater rate of change; function ${start} has the greater initial value.`;
function equationText(f: Linear) {
  const m = f.rise / f.run;
  const slope = m === 1 ? "x" : m === -1 ? "−x" : `${n(m)}x`;
  return f.b === 0
    ? `y = ${slope}`
    : `$y = ${slope} ${f.b < 0 ? "−" : "+"} ${Math.abs(f.b)}$`;
}
function compareCase(r: Random): Case {
  const [repA, repB] = pick(r, [
    ["table", "equation"],
    ["graph", "equation"],
    ["table", "graph"],
    ["graph", "words"],
    ["table", "words"],
  ] as const satisfies readonly (readonly [Rep, Rep])[]);
  const make = (rep: Rep): Linear => {
    const run = rep === "table" || rep === "graph" ? pick(r, [1, 1, 2]) : 1;
    let rise: number;
    do rise = r(rep === "graph" ? -3 : -5, rep === "graph" ? 8 : 6);
    while (rise === 0 || gcd(rise, run) !== 1);
    // A graph stays in the first quadrant out to x = 4, where a point is marked.
    const low =
      rep === "graph" ? Math.max(0, Math.ceil((-4 * rise) / run)) : -6;
    const b = r(low, Math.max(low + 4, rep === "graph" ? 12 : 12));
    return { rise, run, b };
  };
  let A: Linear, B: Linear;
  do {
    A = make(repA);
    B = make(repB);
  } while (A.rise * B.run === B.rise * A.run || A.b === B.b);
  const mA = A.rise / A.run,
    mB = B.rise / B.run;
  const rateWinner = mA > mB ? "A" : "B",
    startWinner = A.b > B.b ? "A" : "B";
  const figure: FunctionDisplayFigure = { kind: "function-display" };
  const graphed: { name: "A" | "B"; f: Linear }[] = [];
  const describe = (name: "A" | "B", f: Linear, rep: Rep): string[] => {
    if (rep === "table") {
      const x0 = f.run === 2 ? pick(r, [0, 2]) : r(0, 3),
        step = f.run === 2 ? 2 : pick(r, [1, 1, 2]);
      const rows = Array.from({ length: 4 }, (_, i) => {
        const x = x0 + i * step;
        return { x, y: at(f, x) };
      });
      figure.table = { title: `Function ${name}`, columns: ["x", "y"], rows };
      const [u, v] = [rows[0]!, rows[1]!];
      const lines = [
        `Function ${name}: from x = ${u.x} to x = ${v.x}, $y$ changes from ${n(u.y)} to ${n(v.y)}. Its rate of change is (${n(v.y)} − ${p(u.y)}) ÷ (${v.x} − ${u.x}) = ${rateText(f)}.`,
      ];
      lines.push(
        u.x === 0
          ? `The table gives y = ${n(f.b)} at x = 0, so the initial value of function ${name} is ${n(f.b)}.`
          : `Work back from x = ${u.x} to x = 0, a change of ${u.x} in $x$: ${n(u.y)} − ${u.x} × ${f.rise < 0 ? `(${rateText(f)})` : rateText(f)} = ${n(f.b)}. The initial value of function ${name} is ${n(f.b)}.`,
      );
      return lines;
    }
    if (rep === "graph") {
      graphed.push({ name, f });
      return [
        `Function ${name}'s graph crosses the vertical axis at (0, ${f.b}), so its initial value is ${f.b}. It also passes through (4, ${at(f, 4)}), so its rate of change is (${at(f, 4)} − ${f.b}) ÷ (4 − 0) = ${rateText(f)}.`,
      ];
    }
    if (rep === "equation")
      return [
        `Function ${name} is ${equationText(f)}. In $y = mx + b$ form, the rate of change is the coefficient of $x$, ${rateText(f)}, and the initial value is the constant, ${n(f.b)}.`,
      ];
    return [
      `Function ${name} has the output ${n(f.b)} at x = 0, its initial value. Its output ${f.rise > 0 ? "increases" : "decreases"} by ${Math.abs(f.rise)} for each increase of 1 in $x$, so its rate of change is ${rateText(f)}.`,
    ];
  };
  const explanation = [...describe("A", A, repA), ...describe("B", B, repB)];
  if (graphed.length) {
    const tops = graphed.flatMap(({ f }) => [f.b, at(f, 4)]);
    const xa = niceAxis(6),
      ya = niceAxis(Math.max(...tops, 1));
    figure.graph = {
      xLabel: "x",
      yLabel: "y",
      xMax: xa.max,
      yMax: ya.max,
      xStep: xa.step,
      yStep: ya.step,
      series: graphed.map(({ name, f }) => ({
        label: name,
        points: [
          { x: 0, y: f.b },
          { x: 4, y: at(f, 4) },
        ],
        line: f,
      })),
    };
  }
  explanation.push(
    `Compare: ${rateText(A)} ${mA > mB ? ">" : "<"} ${rateText(B)}, so function ${rateWinner} has the greater rate of change. ${n(A.b)} ${A.b > B.b ? ">" : "<"} ${n(B.b)}, so function ${startWinner} has the greater initial value.`,
  );
  const words = (name: "A" | "B", rep: Rep, f: Linear) =>
    rep === "table"
      ? "the table"
      : rep === "graph"
        ? "the graph"
        : rep === "equation"
          ? `the equation ${equationText(f)}`
          : `a description: its output is ${n(f.b)} when x = 0 and ${f.rise > 0 ? "increases" : "decreases"} by ${Math.abs(f.rise)} for each increase of 1 in $x$`;
  const step = (name: "A" | "B", rep: Rep, f: Linear) => {
    if (rep === "table") {
      const [u, v] = figure.table!.rows;
      return `in the table, divide the change in $y$ by the change in $x$ from x = ${u!.x} to x = ${v!.x}, and find $y$ at x = 0`;
    }
    if (rep === "graph")
      return `on graph ${name}, read where the line crosses the vertical axis and how far it rises from x = 0 to x = 4`;
    if (rep === "equation")
      return `in ${equationText(f)}, read the coefficient of $x$ and the constant`;
    return `the description gives the output ${n(f.b)} at x = 0 and the change for each increase of 1 in $x$`;
  };
  const hint = `For A, ${step("A", repA, A)}. For B, ${step("B", repB, B)}. Compare the two rates, then the two initial values, as signed numbers.`;
  const prompt = `Function A is given by ${words("A", repA, A)}. Function B is given by ${words("B", repB, B)}. Which statement compares their rates of change and initial values correctly?`;
  const feedback = (rate: "A" | "B", start: "A" | "B") =>
    [
      rate !== rateWinner
        ? `The rates of change are ${rateText(A)} for A and ${rateText(B)} for B, so ${rateWinner} has the greater rate${mA < 0 || mB < 0 ? "; a negative rate is less than any positive rate" : ""}.`
        : "",
      start !== startWinner
        ? `The initial values, the outputs at x = 0, are ${n(A.b)} for A and ${n(B.b)} for B, so ${startWinner} has the greater initial value.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  const choices: Choice[] = (
    [
      ["A", "A"],
      ["A", "B"],
      ["B", "A"],
      ["B", "B"],
    ] as const
  ).map(([rate, start]) =>
    rate === rateWinner && start === startWinner
      ? { label: compareOptions(rate, start), correct: true }
      : { label: compareOptions(rate, start), feedback: feedback(rate, start) },
  );
  return {
    prompt,
    hint,
    choices,
    explanation,
    figure,
    tags: [
      `${repA}-${repB}`,
      mA < 0 || mB < 0 ? "negative-rate" : "positive-rates",
      A.run === 2 || B.run === 2 ? "half-rate" : "whole-rates",
      rateWinner === startWinner ? "same-winner" : "split-winner",
    ],
  };
}

// ---------------------------------------------------------------- linear-function-choice
type Rule = { text: string; linear: boolean; kind: string; note: string };
/** "has the values a, b, c at x = 1, 2, 3: the changes d and e are not equal", from the rule itself. */
function unequal(text: string, f: (x: number) => number) {
  const [a, b, c] = [f(1), f(2), f(3)];
  return `${text} has the values ${[a, b, c].map(n).join(", ")} at x = 1, 2, 3: the changes ${n(b - a)} and ${n(c - b)} are not equal`;
}
function linearRule(r: Random, kind: string): Rule {
  const s = (v: number) => (v < 0 ? `− ${-v}` : `+ ${v}`);
  if (kind === "standard") {
    const m = pick(r, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6, 7, 8]),
      b = pick(r, [-9, -7, -5, -4, -3, -1, 1, 2, 3, 5, 6, 8]);
    return {
      text: `$y = ${n(m)}x ${s(b)}$`,
      linear: true,
      kind,
      note: `$y = ${n(m)}x ${s(b)}$ is already in $y = mx + b$ form, with rate of change ${n(m)}`,
    };
  }
  if (kind === "constant") {
    const c = r(2, 12);
    return {
      text: `y = ${c}`,
      linear: true,
      kind,
      note: `y = ${c} does not change with x, so its rate of change is 0 and its graph is a horizontal line`,
    };
  }
  if (kind === "factored") {
    const k = r(2, 6),
      h = pick(r, [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]);
    return {
      text: `$y = ${k}(x ${s(h)})$`,
      linear: true,
      kind,
      note: `$y = ${k}(x ${s(h)})$ multiplies out to $y = ${k}x ${s(k * h)}$`,
    };
  }
  if (kind === "divided") {
    const d = r(2, 5),
      b = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]);
    return {
      text: `y = x/${d} ${s(b)}`,
      linear: true,
      kind,
      note: `y = x/${d} ${s(b)} has rate of change 1/${d}: $y$ changes by 1/${d} for each increase of 1 in $x$`,
    };
  }
  if (kind === "reversed") {
    const b = r(2, 12),
      m = r(2, 6);
    return {
      text: `y = ${b} − ${m}x`,
      linear: true,
      kind,
      note: `y = ${b} − ${m}x is y = −${m}x + ${b}`,
    };
  }
  if (kind === "square") {
    const b = pick(r, [-4, -3, -2, -1, 1, 2, 3, 4, 5]);
    return {
      text: `$y = x² ${s(b)}$`,
      linear: false,
      kind,
      note: unequal(`$y = x² ${s(b)}$`, (x) => x * x + b),
    };
  }
  if (kind === "scaled-square") {
    const k = r(2, 4);
    return {
      text: `y = ${k}x²`,
      linear: false,
      kind,
      note: unequal(`y = ${k}x²`, (x) => k * x * x),
    };
  }
  if (kind === "reciprocal") {
    const k = pick(r, [6, 12]);
    return {
      text: `y = ${k}/x`,
      linear: false,
      kind,
      note: unequal(`y = ${k}/x`, (x) => k / x),
    };
  }
  const h = r(1, 5);
  return {
    text: `y = x(x + ${h})`,
    linear: false,
    kind: "product",
    note: unequal(`y = x(x + ${h})`, (x) => x * (x + h)),
  };
}
function linearCase(r: Random): Case {
  const wantLinear = r(0, 1) === 1;
  const tricky = ["constant", "factored", "divided", "reversed"];
  const nonlinear = ["square", "scaled-square", "reciprocal", "product"];
  const shuffle = <T>(items: T[]) => {
    for (let i = items.length - 1; i > 0; i--) {
      const j = r(0, i);
      [items[i], items[j]] = [items[j]!, items[i]!];
    }
    return items;
  };
  const kinds = wantLinear
    ? [pick(r, tricky), ...shuffle([...nonlinear]).slice(0, 3)]
    : [pick(r, nonlinear), ...shuffle(["standard", ...tricky]).slice(0, 3)];
  const rules = kinds.map((kind) => linearRule(r, kind));
  if (new Set(rules.map((rule) => rule.text)).size !== 4) return linearCase(r);
  const [answer, ...others] = rules;
  const explanation = [
    "A function is linear when its rule can be written $y = mx + b$. Then $y$ changes by the same amount, $m$, for each increase of 1 in $x$, and its graph is a straight line.",
    `The rule ${answer!.note}, so it ${wantLinear ? "is" : "is not"} linear.`,
    `The other rules ${wantLinear ? "are not linear" : "are linear"}: ${others.map((o) => o.note).join("; ")}.`,
  ];
  return {
    hint: `Test one rule at x = 1, 2 and 3. For ${others[0]!.text}, find the three values of $y$: a linear rule changes $y$ by the same amount each time. Then rewrite each other rule in the form $y = mx + b$ if you can.`,
    prompt: wantLinear
      ? "Which equation defines a linear function?"
      : "Which equation defines a function that is not linear?",
    choices: rules.map((rule, i) =>
      i === 0
        ? { label: rule.text, correct: true }
        : { label: rule.text, feedback: `The rule ${rule.note}.` },
    ),
    explanation,
    tags: [wantLinear ? "find-linear" : "find-nonlinear", ...kinds],
  };
}

/** Proportional pairs, including the required distance-time graph and equation.
 * `affine` is the stored comparison of two lines with a nonzero start. */
export const compareRateAxes = {
  pair: defineAxis(
    "pair",
    ["affine", "speed-graph-equation", "proportional-other"] as const,
    { legacy: "affine", silentLegacy: true, since: 2, weights: [2, 2, 3] },
  ),
} as const;
/** Why three points are not linear. `square-area` is always in the grid:
 * inputs 1, 2, 3 and A = s². Format B (select every nonlinear rule) is a
 * different response kind, so it is not generated here. */
export const linearChoiceAxes = {
  judge: defineAxis(
    "judge",
    ["which-equation", "square-area", "other-nonlinear"] as const,
    { legacy: "which-equation", silentLegacy: true, since: 2, weights: [2, 3, 2] },
  ),
} as const;

function recordedAxes(
  axes: AxisSet | undefined,
  values: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined {
  if (!axes || !values) return undefined;
  const recorded: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const axis = axes[key];
    if (axis?.silentLegacy && value === axis.legacy) continue;
    recorded[key] = value;
  }
  return Object.keys(recorded).length ? recorded : undefined;
}

type PairValue = (typeof compareRateAxes.pair.values)[number];
type JudgeValue = (typeof linearChoiceAxes.judge.values)[number];

/** Largest-free tick: a divisor of `value` with at most 12 gridlines. */
const tickStep = (value: number) => {
  const min = Math.max(1, Math.ceil(value / 12));
  for (let step = min; step <= value; step++)
    if (value % step === 0) return step;
  return value;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

type PropRep = "graph" | "equation" | "table" | "sentence";
type PropContext = {
  id: "speed" | "price" | "fill";
  a: string;
  b: string;
  unit: string;
  ask: string;
  xLabel: string;
  yLabel: string;
  xWord: string;
  yWord: string;
  eq: (m: number) => string;
  sentence: (name: string, m: number, t: number) => string;
  same: string;
  by: (who: string, gap: number) => string;
};
const propContexts: Record<PropContext["id"], PropContext> = {
  speed: {
    id: "speed",
    a: "Car A",
    b: "Car B",
    unit: "mph",
    ask: "Which car is faster, and by how many miles per hour?",
    xLabel: "hours",
    yLabel: "miles",
    xWord: "hours",
    yWord: "miles",
    eq: (m) => `$d = ${m}t$`,
    sentence: (name, m, t) =>
      `${name} travels ${m * t} miles in ${t} hours.`,
    same: "They have the same speed",
    by: (who, gap) => `${who}, by ${gap} mph`,
  },
  price: {
    id: "price",
    a: "Shop A",
    b: "Shop B",
    unit: "dollars",
    ask: "Which shop charges more per item, and by how many dollars?",
    xLabel: "items",
    yLabel: "dollars",
    xWord: "items",
    yWord: "dollars",
    eq: (m) => `$c = ${m}n$`,
    sentence: (name, m, t) =>
      `${name} charges ${m * t} ${nounFor(m * t, "dollar")} for ${t} items.`,
    same: "They charge the same price",
    by: (who, gap) => `${who}, by ${gap} ${nounFor(gap, "dollar")}`,
  },
  fill: {
    id: "fill",
    a: "Pump A",
    b: "Pump B",
    unit: "liters per minute",
    ask: "Which pump fills faster, and by how many liters per minute?",
    xLabel: "minutes",
    yLabel: "liters",
    xWord: "minutes",
    yWord: "liters",
    eq: (m) => `$w = ${m}t$`,
    sentence: (name, m, t) =>
      `${name} adds ${m * t} ${nounFor(m * t, "liter")} in ${t} minutes.`,
    same: "They fill at the same rate",
    by: (who, gap) => `${who}, by ${gap} ${nounFor(gap, "liter")} per minute`,
  },
};

function proportionalCase(r: Random, pair: PairValue): Case {
  const required = pair === "speed-graph-equation";
  const context = required
    ? propContexts.speed
    : propContexts[pick(r, ["speed", "price", "fill"] as const)];
  const lo = context.id === "speed" ? 30 : 2;
  const hi = context.id === "speed" ? 60 : context.id === "price" ? 12 : 20;
  const equal = r(0, 9) === 0;
  const mA = r(lo, hi);
  let mB = equal ? mA : r(lo, hi);
  if (!equal) while (mB === mA) mB = r(lo, hi);
  const pool: readonly (readonly [PropRep, PropRep])[] = [
    ["table", "equation"],
    ["graph", "sentence"],
    ["table", "sentence"],
    ["table", "graph"],
    ["graph", "equation"],
  ];
  let [repA, repB] = required
    ? (["graph", "equation"] as const)
    : pick(r, pool);
  if (
    !required &&
    context.id === "speed" &&
    ((repA === "graph" && repB === "equation") ||
      (repA === "equation" && repB === "graph"))
  )
    [repA, repB] = ["table", "equation"];
  if (!required && r(0, 1) === 1) [repA, repB] = [repB, repA];
  const rateOf = (name: "A" | "B") => (name === "A" ? mA : mB);
  const who = (name: "A" | "B") => (name === "A" ? context.a : context.b);
  const latticeX = 2;
  const hours = () => r(2, 6);
  const told: Record<"A" | "B", { text: string; sample: number }> = {
    A: { text: "", sample: latticeX },
    B: { text: "", sample: latticeX },
  };
  const figure: FunctionDisplayFigure = { kind: "function-display" };
  const place = (name: "A" | "B", rep: PropRep) => {
    const m = rateOf(name);
    if (rep === "graph") {
      const y = m * latticeX;
      const yStep = tickStep(y);
      const yMax = Math.max(yStep, Math.ceil(y / yStep) * yStep);
      figure.graph = {
        xLabel: context.xLabel,
        yLabel: context.yLabel,
        xMax: 8,
        yMax,
        xStep: 2,
        yStep,
        series: [
          {
            label: who(name),
            points: [
              { x: 0, y: 0 },
              { x: latticeX, y },
            ],
            line: { rise: m, run: 1, b: 0 },
          },
        ],
      };
      told[name] = {
        text: `${who(name)} is shown on the graph. Each horizontal gridline is ${plural(2, context.xWord.replace(/s$/, ""))}. Each vertical gridline is ${plural(yStep, context.yWord.replace(/s$/, ""))}.`,
        sample: latticeX,
      };
      return;
    }
    if (rep === "table") {
      const rows = [2, 5, 8].map((x) => ({ x, y: m * x }));
      figure.table = {
        title: who(name),
        columns: [context.xLabel, context.yLabel],
        rows,
      };
      told[name] = {
        text: `${who(name)} is shown in the table.`,
        sample: 5,
      };
      return;
    }
    if (rep === "equation") {
      told[name] = {
        text: `${who(name)} is given by ${context.eq(m)}.`,
        sample: 4,
      };
      return;
    }
    const t = hours();
    told[name] = {
      text: context.sentence(who(name), m, t),
      sample: t,
    };
  };
  place("A", repA);
  place("B", repB);
  const diff = Math.abs(mA - mB);
  const sample = told.A.sample;
  const oneTime = diff * sample;
  const winner: "A" | "B" = mA > mB ? "A" : "B";
  const loser: "A" | "B" = winner === "A" ? "B" : "A";
  const yShown = rateOf(repA === "graph" ? "A" : "B") * latticeX;
  const fake = Math.abs(yShown - (equal ? mA : 0));
  const heightGap = equal ? Math.max(yShown, fake, mA) : 0;
  const rateGap = equal ? Math.max(mA * (latticeX - 1), 2) : 0;
  const choices: Choice[] = equal
    ? [
        { label: context.same, correct: true },
        {
          label: context.by(context.a, rateGap),
          feedback: `The outputs can differ at one input even when you misread a height. The unit rates are both ${mA}.`,
        },
        {
          label: context.by(context.b, rateGap),
          feedback: `Comparing a labeled height to a coefficient is not a rate gap. Both unit rates are ${mA}.`,
        },
        {
          label: context.by(context.a, heightGap === rateGap ? heightGap + mA : heightGap),
          feedback: `A labeled output is not the difference of the rates. Both rates equal ${mA}.`,
        },
      ]
    : [
        { label: context.by(who(winner), diff), correct: true },
        {
          label: context.by(who(loser), diff),
          feedback: `The rates are ${mA} and ${mB}. The larger rate is ${who(winner)}, not ${who(loser)}.`,
        },
        {
          label: context.by(who(winner), oneTime),
          feedback: `At the input ${sample}, the outputs differ by ${oneTime}. That is the rate gap times ${sample}, not the rate gap.`,
        },
        {
          label: context.same,
          feedback: `Both pass through the origin. That is the same start, not the same rate. The rates are ${mA} and ${mB}.`,
        },
      ];
  if (new Set(choices.map((c) => c.label)).size !== 4)
    return proportionalCase(r, pair);
  const read = (name: "A" | "B", rep: PropRep) => {
    const m = rateOf(name);
    if (rep === "graph")
      return `The graph point (${latticeX}, ${m * latticeX}) gives ${m * latticeX} ÷ ${latticeX} = ${m}.`;
    if (rep === "table")
      return `Any table row works: output ÷ input = ${m}.`;
    if (rep === "equation")
      return `The equation multiplies by ${m}, so the unit rate is ${m}.`;
    return `The sentence gives a total ÷ time = ${m}.`;
  };
  const prompt = `${told.A.text} ${told.B.text} ${context.ask}`;
  const explanation = equal
    ? [
        "Through the origin, the unit rate is the slope.",
        read("A", repA),
        read("B", repB),
        `Both rates equal ${mA} ${context.unit}. The same start does not decide the rate.`,
        `Check at input 1: each relationship gives ${mA}.`,
      ]
    : [
        "Through the origin, the unit rate is the slope.",
        read("A", repA),
        read("B", repB),
        `${Math.max(mA, mB)} is greater than ${Math.min(mA, mB)}, so ${who(winner)} is ahead by ${diff} ${context.unit === "liters per minute" ? `${nounFor(diff, "liter")} per minute` : context.unit === "dollars" ? nounFor(diff, "dollar") : context.unit}.`,
        `At input 1 the values are ${mA} and ${mB}. At input ${sample} the outputs differ by ${oneTime}, which is not the rate gap.`,
      ];
  return {
    prompt,
    hint: `${told.A.text} ${told.B.text} Through the origin, divide one output by its input. Do that for each relationship, then subtract the two rates.`,
    choices,
    explanation,
    figure,
    tags: [
      pair,
      context.id,
      `${repA}-${repB}`,
      equal ? "equal-rates" : "unequal-rates",
    ],
  };
}

type NonlinearSpec = {
  story: string;
  points: [number, number][];
  rises: [number, number];
  hasConstant: boolean;
};
function nonlinearSpec(r: Random, judge: JudgeValue): NonlinearSpec {
  const skip = judge !== "square-area" && r(0, 4) === 0;
  const xs = skip ? [1, 2, 4] : [1, 2, 3];
  if (judge === "square-area") {
    const points = xs.map((x) => [x, x * x] as [number, number]);
    return {
      story:
        "The area $A$ of a square with side length $s$ is $A = s^2$.",
      points,
      rises: [points[1]![1] - points[0]![1], points[2]![1] - points[1]![1]],
      hasConstant: false,
    };
  }
  const kind = pick(r, ["square", "cube", "reciprocal", "power", "square-plus"] as const);
  const c = r(1, 5);
  const f =
    kind === "square"
      ? (x: number) => x * x
      : kind === "cube"
        ? (x: number) => x * x * x
        : kind === "reciprocal"
          ? (x: number) => 120 / x
          : kind === "power"
            ? (x: number) => 2 ** x
            : (x: number) => x * x + c;
  const points = xs.map((x) => [x, f(x)] as [number, number]);
  const story =
    kind === "square"
      ? "The area $A$ of a square with side $s$ is $A = s^2$."
      : kind === "cube"
        ? "The volume $V$ of a cube with side $s$ is $V = s^3$."
        : kind === "reciprocal"
          ? "The time $t$, in hours, for 120 miles at $s$ miles per hour is $t = 120/s$."
          : kind === "power"
            ? "A colony doubles each hour. After $s$ hours its size is $y = 2^s$."
            : `A square's area plus ${c} is $A = s^2 + ${c}$.`;
  return {
    story,
    points,
    rises: [points[1]![1] - points[0]![1], points[2]![1] - points[1]![1]],
    hasConstant: kind === "square-plus",
  };
}
function nonlinearCase(r: Random, judge: JudgeValue): Case {
  const spec = nonlinearSpec(r, judge);
  const [p, q, u] = spec.points;
  const listed = `(${p![0]}, ${p![1]}), (${q![0]}, ${q![1]}) and (${u![0]}, ${u![1]})`;
  const [d1, d2] = spec.rises;
  const correct = `Its points ${listed} are not on one straight line. The output changes by ${d1}, then by ${d2}.`;
  const noConstant = {
    label: "Because it has no constant term added.",
    feedback:
      "A rule with no added constant can still be linear, such as $y = 4s$. The test is equal changes, not a missing constant.",
  };
  const instead = {
    label: "Because the variable is used more than once.",
    feedback:
      "How many times the letter appears does not decide. Check whether equal input steps give equal output changes.",
  };
  const choices: Choice[] = [
    { label: correct, correct: true },
    spec.hasConstant ? instead : noConstant,
    {
      label: "Because the output changes as the input changes.",
      feedback:
        "A linear function can rise or fall too. What fails here is that the changes are not equal.",
    },
    {
      label: "It is linear, because every input gives exactly one output.",
      feedback:
        "That is what makes it a function. A linear function also needs equal output changes for equal input steps.",
    },
  ];
  return {
    prompt: `${spec.story} The table shows ${listed}. Why is this not a linear function of the input?`,
    hint: `The points are ${listed}. Subtract consecutive outputs. A linear function changes by the same amount on equal input steps.`,
    choices,
    explanation: [
      "Linear means the same output change for each equal step of the input, so the points lie on one straight line.",
      `The points are ${listed}. The changes are ${d1} and ${d2}. They are not equal.`,
      "A straight line through the first two points misses the third.",
      correct,
    ],
    tags: [judge, spec.hasConstant ? "with-constant" : "no-constant"],
  };
}

const builders: Record<string, (r: Random) => Case> = {
  "rule-pattern-term": ruleTermCase,
  "rule-pattern-feature": featureCase,
  "related-patterns-relationship": relatedCase,
  "dependent-variable-equation": equationCase,
  "dependent-variable-value": valueCase,
  "compare-function-rates": compareCase,
  "linear-function-choice": linearCase,
};
const labels: Record<string, string> = {
  "rule-pattern-term": "Number in the pattern",
  "rule-pattern-feature": "Choose the true statement",
  "related-patterns-relationship": "Answer",
  "dependent-variable-equation": "Choose the equation",
  "dependent-variable-value": "Answer",
  "compare-function-rates": "Choose the correct comparison",
  "linear-function-choice": "Choose one equation",
};

export function patternFunctionPrintCase(
  id: string,
  seed: string,
): { problem: GeneratedProblem; tags: string[]; caseKey: string } {
  const metadata = patternFunctionTemplates.find((t) => t.id === id);
  if (!metadata) throw new Error(`Unknown pattern/function template ${id}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(id, seed);
  const surface =
    id === "compare-function-rates"
      ? compareRateAxes
      : id === "linear-function-choice"
        ? linearChoiceAxes
        : undefined;
  const rateValues =
    id === "compare-function-rates"
      ? chooseAxes(id, seed, compareRateAxes)
      : undefined;
  const choiceValues =
    id === "linear-function-choice"
      ? chooseAxes(id, seed, linearChoiceAxes)
      : undefined;
  const values = rateValues ?? choiceValues;
  const c = rateValues
    ? isLegacy(compareRateAxes, rateValues)
      ? builders[id]!(r)
      : proportionalCase(r, rateValues.pair)
    : choiceValues
      ? isLegacy(linearChoiceAxes, choiceValues)
        ? builders[id]!(r)
        : nonlinearCase(r, choiceValues.judge)
      : builders[id]!(r);
  let response: ProblemResponse, answer: string;
  let choiceFeedback: Record<string, string> | undefined;
  if (c.choices) {
    // Deterministic shuffle: the correct statement's position carries no signal.
    const order = c.choices.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = r(0, i);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const options = order.map((source, i) => ({
      id: `option-${"abcd"[i]}`,
      label: c.choices![source]!.label,
    }));
    response = { kind: "choice", label: labels[id]!, options };
    answer = options[order.findIndex((s) => c.choices![s]!.correct)]!.id;
    choiceFeedback = Object.fromEntries(
      order
        .map((s, i) => [options[i]!.id, c.choices![s]!.feedback] as const)
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  } else {
    response = { kind: "number", label: labels[id]! };
    answer = String(c.answer);
  }
  const problem: GeneratedProblem = {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, 1, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      skillId: metadata.skillId,
      prompt: c.prompt,
      response,
      ...(c.figure ? { figure: c.figure } : {}),
    },
    answer,
    explanation: c.explanation,
    hint: c.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
  };
  const recorded = recordedAxes(surface, values);
  if (recorded)
    problem.variant = {
      id: Object.values(recorded).join("-"),
      axes: axisRecord(recorded),
    };
  return {
    problem,
    tags: c.tags,
    // Prompt, figure and the set of options state every given.
    caseKey: JSON.stringify([
      c.prompt,
      c.figure ?? null,
      c.choices?.map((choice) => choice.label).sort() ?? null,
    ]),
  };
}
export const generatePatternFunctionProblem = (
  id: string,
  seed: string,
): GeneratedProblem => patternFunctionPrintCase(id, seed).problem;
