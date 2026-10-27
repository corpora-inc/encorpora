import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
  type MultiPartSentence,
  type PartOption,
} from "./multi-part-choice";
import { lineTable } from "./scene/author";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes";

/** Families answered by choosing one option for each blank
 * (multi-part-choice-v1): the rule of a two-row table written as a sentence
 * with two blanks, and a match table that marks each equation true or not
 * true for a stated value. */
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
export const multiPartFormatsTemplates: readonly TemplateMetadata[] = [
  {
    id: "table-rule-sentence",
    version: 1,
    title: "Complete the rule of a table",
    skillId: "rule-patterns",
    gradeBand: "3–5",
    ...parts,
    requiredFigureCapability: "scenes-v1",
    description:
      "Complete a sentence about a table of $x$ and $y$ values by choosing the operation and the number of its rule, or whether the relationship is additive or multiplicative and the number it uses.",
  },
  {
    id: "substitution-match-table",
    version: 1,
    title: "Mark each equation true or not true",
    skillId: "two-step-equations",
    gradeBand: "6–8",
    ...parts,
    description:
      "Substitute a stated value, negative or positive, into four or five equations and mark each as true or not true, including equations with a negative coefficient, a subtracted variable or a fraction of the variable.",
  },
];

const letters = ["a", "b", "c", "d", "e", "f"] as const;
/** Options in their given order, ids by position: an id says nothing about
 * which option is correct once the order is shuffled. */
const optionsOf = (labels: readonly string[]): PartOption[] =>
  labels.map((label, i) => ({ id: letters[i]!, label }));
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
const signed = (n: number) => (n < 0 ? `−${-n}` : `${n}`);

function problemOf(
  meta: TemplateMetadata,
  seed: string,
  built: {
    prompt: string;
    response: MultiPartChoiceResponse;
    /** Correct option label for each blank, in blank order. */
    correct: readonly string[];
    figure?: SemanticFigure;
    explanation: string[];
    hint: string;
  },
): GeneratedProblem {
  const key = Object.fromEntries(
    built.response.blanks.map((b, i) => {
      const option = b.options.find((o) => o.label === built.correct[i]);
      if (!option) throw new Error(`No correct option for blank ${b.id}`);
      return [b.id, option.id];
    }),
  );
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, meta.version, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: built.response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer: serializeMultiPart(built.response, key),
    explanation: built.explanation,
    hint: built.hint,
  };
}

/* ---------- complete the rule of a table ---------- */
export const tableRuleAxes = {
  "rule-operation": defineAxis("rule-operation", [
    "multiply",
    "add",
    "subtract",
    "divide",
  ] as const),
  "sentence-form": defineAxis("sentence-form", [
    "operation-number",
    "kind-number",
  ] as const),
} as const;
type Operation = (typeof tableRuleAxes)["rule-operation"]["values"][number];
const OPERATION_PHRASE: Record<Operation, string> = {
  multiply: "multiplied by",
  add: "increased by",
  subtract: "decreased by",
  divide: "divided by",
};
const OPERATION_SYMBOL: Record<Operation, string> = {
  multiply: "\\cdot",
  add: "+",
  subtract: "-",
  divide: "\\div",
};
const apply = (op: Operation, x: number, n: number) =>
  op === "multiply"
    ? x * n
    : op === "add"
      ? x + n
      : op === "subtract"
        ? x - n
        : x / n;

function tableRuleSentence(seed: string, salt: string): GeneratedProblem {
  const meta = multiPartFormatsTemplates[0]!;
  const r = random(meta.id, salt);
  const axes = chooseAxes(meta.id, seed, tableRuleAxes);
  const op = axes["rule-operation"];
  const n = op === "divide" ? r(2, 5) : op === "subtract" ? r(2, 8) : r(2, 9);
  const count = r(4, 5);
  const step = r(0, 2) === 0 ? 2 : 1;
  const start =
    op === "divide" ? 1 : op === "subtract" ? n + 1 + r(0, 2) : r(1, 4);
  const xs = Array.from({ length: count }, (_, i) =>
    op === "divide" ? n * (start + i * step) : start + i * step,
  );
  const ys = xs.map((x) => apply(op, x, n));
  if (!ys.every((y) => Number.isInteger(y) && y > 0))
    throw new Error("Need a whole table");
  const figure: SemanticFigure = {
    kind: "scene",
    scene: lineTable(
      [
        ["x", ...xs.map(String)],
        ["y", ...ys.map(String)],
      ],
      { header: "column" },
    ).scene({ title: "Table of x and y values" }),
  };
  // Numbers a learner might take for the rule's number.
  const slips = [
    ys[0]!,
    ys[1]! - ys[0]!,
    xs[0]!,
    xs[1]! - xs[0]!,
    n + 1,
    n - 1,
    Math.round(ys[0]! / xs[0]!),
  ].filter((v) => Number.isInteger(v) && v > 0 && v !== n);
  const numbers = [
    ...new Set([n, ...shuffle(r, [...new Set(slips)]).slice(0, 3)]),
  ];
  if (numbers.length < 4) throw new Error("Need three distinct numbers");
  const numberLabels = shuffle(r, numbers.map(String));
  const form = axes["sentence-form"];
  const kindOf = (o: Operation) =>
    o === "multiply" || o === "divide" ? "multiplicative" : "additive";
  const blanks: MultiPartBlank[] =
    form === "operation-number"
      ? [
          {
            id: "op",
            label: "the operation",
            options: optionsOf(shuffle(r, Object.values(OPERATION_PHRASE))),
          },
          {
            id: "num",
            label: "the number",
            options: optionsOf(numberLabels),
          },
        ]
      : [
          {
            id: "kind",
            label: "the kind of relationship",
            options: optionsOf(shuffle(r, ["additive", "multiplicative"])),
          },
          {
            id: "num",
            label: "the number in the rule",
            options: optionsOf(numberLabels),
          },
        ];
  const sentence: MultiPartSentence =
    form === "operation-number"
      ? [
          { text: "Each $y$ is the $x$ above it " },
          { blank: "op" },
          { text: " " },
          { blank: "num" },
          { text: "." },
        ]
      : [
          { text: "This relationship is " },
          { blank: "kind" },
          { text: ", and the number in its rule is " },
          { blank: "num" },
          { text: "." },
        ];
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each blank",
    layout: "inline",
    blanks,
    sentence,
  };
  const symbol = OPERATION_SYMBOL[op];
  return problemOf(meta, seed, {
    prompt:
      "The table shows $x$ and $y$ values that follow one rule. Complete the sentence.",
    response,
    figure,
    correct:
      form === "operation-number"
        ? [OPERATION_PHRASE[op], String(n)]
        : [kindOf(op), String(n)],
    hint: `Compare the first pair, $x = ${xs[0]}$ and $y = ${ys[0]}$: decide what was done to ${xs[0]} to get ${ys[0]}. Then test the same operation on $x = ${xs[1]}$.`,
    explanation: [
      `Compare each $x$ with the $y$ below it. From $x = ${xs[0]}$ to $y = ${ys[0]}$: $${xs[0]} ${symbol} ${n} = ${ys[0]}$.`,
      `The same operation works for every pair: $${xs[1]} ${symbol} ${n} = ${ys[1]}$ and $${xs.at(-1)} ${symbol} ${n} = ${ys.at(-1)}$.`,
      form === "operation-number"
        ? `Each $y$ is the $x$ above it ${OPERATION_PHRASE[op]} ${n}.`
        : `Each $y$ is found by ${op === "multiply" ? "multiplying by" : op === "divide" ? "dividing by" : op === "add" ? "adding" : "subtracting"} ${n}, so the relationship is ${kindOf(op)} and the number in its rule is ${n}.`,
    ],
  });
}

/* ---------- mark each equation true or not true ---------- */
export const substitutionAxes = {
  "value-sign": defineAxis("value-sign", ["negative", "positive"] as const),
  "equation-count": defineAxis("equation-count", ["four", "five"] as const),
} as const;
type Equation = {
  /** TeX of the equation. */
  label: string;
  holds: boolean;
  /** TeX of the substitution check, ending in the left side's value. */
  work: string;
  left: number;
  right: number;
};
const VARIABLES = ["m", "n", "p", "t", "w", "k"] as const;
const term = (a: number, v: string) =>
  a === 1 ? v : a === -1 ? `-${v}` : `${a}${v}`;
const plus = (b: number) => (b < 0 ? `- ${-b}` : `+ ${b}`);
const par = (n: number) => (n < 0 ? `(${n})` : `${n}`);

/** One equation about `v` whose left side equals `right` at `value`. */
function equationOf(
  r: Random,
  v: string,
  value: number,
  holds: boolean,
  kind: number,
): Equation | null {
  const slip = (truth: number, alternatives: number[]) =>
    holds ? truth : (alternatives.find((x) => x !== truth) ?? truth + 1);
  const a = r(2, 6) * (r(0, 1) ? 1 : -1);
  const b = r(1, 9) * (r(0, 1) ? 1 : -1);
  switch (kind) {
    case 0: {
      // a v + b = c; the slip uses the opposite value.
      const truth = a * value + b;
      const c = slip(truth, [a * -value + b, truth + a, truth + b]);
      return {
        label: `${term(a, v)} ${plus(b)} = ${c}`,
        holds,
        work: `${a} \\cdot ${par(value)} ${plus(b)} = ${truth}`,
        left: truth,
        right: c,
      };
    }
    case 1: {
      // v + b = c
      const truth = value + b;
      const c = slip(truth, [-value + b, value - b, truth + 1]);
      return {
        label: `${v} ${plus(b)} = ${c}`,
        holds,
        work: `${par(value)} ${plus(b)} = ${truth}`,
        left: truth,
        right: c,
      };
    }
    case 2: {
      // v / d = c with d dividing the value
      const d = pick(
        r,
        [2, 3, 4, 5].filter((x) => value % x === 0),
      );
      if (!d) return null;
      const truth = value / d;
      const c = slip(truth, [-value / d, value * d, truth + 1]);
      return {
        label: `\\frac{${v}}{${d}} = ${c}`,
        holds,
        work: `\\frac{${value}}{${d}} = ${truth}`,
        left: truth,
        right: c,
      };
    }
    case 3: {
      // k − v = c
      const k = r(1, 9) * (r(0, 1) ? 1 : -1);
      const truth = k - value;
      const c = slip(truth, [k + value, value - k, truth + 2]);
      return {
        label: `${k} - ${v} = ${c}`,
        holds,
        work: `${k} - ${par(value)} = ${truth}`,
        left: truth,
        right: c,
      };
    }
    default: {
      // a v = c
      const truth = a * value;
      const c = slip(truth, [a * -value, truth + a, -truth + 1]);
      return {
        label: `${term(a, v)} = ${c}`,
        holds,
        work: `${a} \\cdot ${par(value)} = ${truth}`,
        left: truth,
        right: c,
      };
    }
  }
}
function substitutionMatchTable(seed: string, salt: string): GeneratedProblem {
  const meta = multiPartFormatsTemplates[1]!;
  const r = random(meta.id, salt);
  const axes = chooseAxes(meta.id, seed, substitutionAxes);
  const count = axes["equation-count"] === "five" ? 5 : 4;
  const magnitude = pick(r, [2, 3, 4, 5, 6, 8, 10, 12]);
  const value = axes["value-sign"] === "negative" ? -magnitude : magnitude;
  const v = pick(r, VARIABLES);
  const yes = r(1, count - 1);
  const kinds = shuffle(r, [0, 1, 2, 3, 4]).slice(0, count);
  const truths = shuffle(
    r,
    Array.from({ length: count }, (_, i) => i < yes),
  );
  const rows: Equation[] = [];
  for (const [i, kind] of kinds.entries()) {
    const eq = equationOf(r, v, value, truths[i]!, kind);
    if (!eq || (eq.left === eq.right) !== eq.holds)
      throw new Error("Need a different equation");
    rows.push(eq);
  }
  if (new Set(rows.map((row) => row.label)).size !== rows.length)
    throw new Error("Need different equations");
  const columns = optionsOf(["True", "Not true"]);
  const state = `$${v} = ${value}$`;
  return problemOf(meta, seed, {
    prompt: `Mark each equation as true or not true when ${state}.`,
    response: {
      kind: "multi-part-choice",
      label: "Choose one column in each row",
      layout: "table",
      rowHeader: "Equation",
      blanks: rows.map((row, i) => ({
        id: `r${i + 1}`,
        label: `$${row.label}$`,
        options: columns,
      })),
    },
    correct: rows.map((row) => (row.holds ? "True" : "Not true")),
    hint: `Replace $${v}$ with ${signed(value)} in $${rows[0]!.label}$, work out the left side, and compare it with the right side. Do the same for each row.`,
    explanation: [
      `An equation is true for ${state} when both sides have the same value after $${v}$ is replaced by ${signed(value)}.`,
      ...rows.map(
        (row) =>
          `$${row.label}$: the left side is $${row.work}$ and the right side is $${row.right}$, so it is ${row.holds ? "true" : "not true"}.`,
      ),
    ],
  });
}

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "table-rule-sentence": tableRuleSentence,
  "substitution-match-table": substitutionMatchTable,
};
export const multiPartFormatsAxes = {
  "table-rule-sentence": tableRuleAxes,
  "substitution-match-table": substitutionAxes,
} as const;
export function generateMultiPartFormatsProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate) throw new Error(`Unknown multi-part template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const axes = chooseAxes(
    templateId,
    seed,
    multiPartFormatsAxes[templateId as keyof typeof multiPartFormatsAxes],
  );
  // A draw that cannot make a valid table is redrawn from a salted stream;
  // the saved seed and the axis values never change.
  let problem: GeneratedProblem | undefined;
  for (let attempt = 0; attempt < 60 && !problem; attempt++)
    try {
      problem = generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  if (!problem) throw new Error(`${templateId}: no instance for ${seed}`);
  return {
    ...problem,
    variant: {
      id: Object.values(axes).join("-"),
      axes: axisRecord(axes as Record<string, string>),
    },
  };
}
