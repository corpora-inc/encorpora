import { createHash } from "node:crypto";
import type {
  FunctionDisplayFigure,
  GeneratedProblem,
  ProblemResponse,
  TemplateMetadata,
} from "./contracts";

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
    version: 1,
    title: "Compare two functions",
    skillId: "compare-functions",
    gradeBand: "6–8",
    description:
      "Compare the rates of change and initial values of two linear functions given by a table, a graph, an equation or a description.",
    ...choice,
    ...display,
  },
  {
    id: "linear-function-choice",
    version: 1,
    title: "Linear or not linear",
    skillId: "compare-functions",
    gradeBand: "6–8",
    description:
      "Decide which equation defines a linear function, including forms that are linear without looking like y = mx + b.",
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
      `The start is ${start} = ${factor} × ${start / factor}, and the rule adds ${step} = ${factor} × ${step / factor}. A multiple of ${factor} plus a multiple of ${factor} is again a multiple of ${factor}, so every number is a multiple of ${factor}.`,
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
    shows: "n tickets cost c dollars.",
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
    intro: (c) => `A greenhouse is always ${c} °$F$ warmer than the air outside.`,
    shows: "When it is a °$F$ outside, the greenhouse is $g$ °$F$.",
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
        feedback: `This equation makes ${x} depend on ${y}. Here ${y} depends on ${x}, so ${y} stands alone: ${correct}.`,
      },
      {
        label: `${y} = ${x} + ${c}`,
        feedback: `Check a row: when ${x} = ${row.x}, ${row.x} + ${c} = ${row.x + c}, but the table shows ${row.y}. Here ${y} is ${c} times ${x}, not ${c} more.`,
      },
      {
        label: `${y} = ${wrongRate}${x}`,
        feedback: `${wrongRate} is ${xs[0] !== 1 ? `the value of ${y} when ${x} = ${xs[0]}` : `the change in ${y} from one row to the next, when ${x} grows by ${xs[1]! - xs[0]!}`}, not the amount for each 1 of ${x}. Divide: ${row.y} ÷ ${row.x} = ${c}.`,
      },
    );
  } else {
    choices.push(
      {
        label: `${x} = ${y} + ${c}`,
        feedback: `This equation makes ${x} the larger value. Here ${y} is ${c} more than ${x}, so ${correct}.`,
      },
      {
        label: `${y} = ${c}${x}`,
        feedback: `Check a row: when ${x} = ${row.x}, ${c} × ${row.x} = ${c * row.x}, but the table shows ${row.y}. Here ${y} is ${c} more than ${x}, not ${c} times ${x}.`,
      },
      {
        label: `${y} = ${x} − ${c}`,
        feedback: `In every row ${y} is larger than ${x}, so ${c} is added to ${x}, not subtracted.`,
      },
    );
  }
  const xa = niceAxis(xs.at(-1)!),
    ya = niceAxis(rows.at(-1)!.y);
  const label = (v: string, unit: string) => `${v} (${unit})`;
  const explanation = [
    `The independent variable is ${x}: its values are chosen first. The dependent variable is ${y}: its value depends on ${x}.`,
    rate
      ? `In every row, ${y} ÷ ${x} is the same: ${rows.map((w) => `${w.y} ÷ ${w.x} = ${c}`).join("; ")}.`
      : `In every row, ${y} − ${x} is the same: ${rows.map((w) => `${w.y} − ${w.x} = ${c}`).join("; ")}.`,
    rate
      ? `So ${y} is always ${c} times ${x}: ${correct}. On the graph, the points lie on a line through (0, 0) that rises ${c} for each 1 to the right.`
      : `So ${y} is always ${c} more than ${x}: ${correct}. On the graph, the points lie on a line that crosses the vertical axis at ${c} and rises 1 for each 1 to the right.`,
  ];
  return {
    prompt: `${ctx.intro(c)} ${ctx.shows} Which equation gives ${y} in terms of ${x}?`,
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
        `In ${y} = ${c}${x}, ${y} is the dependent variable: it depends on ${x}. Substitute ${x} = ${input}.`,
        `${y} = ${c} × ${input} = ${output}.`,
        `The answer is ${output} ${unit}.`,
      ]
    : [
        `In ${y} = ${c}${x}, ${y} is the dependent variable and ${x} is the independent variable. Substitute ${y} = ${output}: ${output} = ${c}${x}.`,
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
      note: `y = ${c} is y = 0x + ${c}: its rate of change is 0, and its graph is a horizontal line`,
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
  const c = builders[id]!(r);
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
