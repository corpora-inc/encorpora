import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, type Random } from "./distribution-practice";
import { scene, table } from "./scene/author";
import type { Scene } from "./scene/spec";

/* Texas grades 3-8 requirements that existing skills did not yet practise:
 * multiplicative comparison wording, tables from situations, equations and
 * strip diagrams for stories, area models for division and decimals, unit
 * sizes, benchmark reasonableness, nested number sets, reciprocal and scaling
 * reasoning, percent models and conversions, variable roles, expressions
 * versus equations, equations for rational area and volume, categorical
 * summaries, check registers, lifetime income, pi, experimental probability,
 * cylinder surface area and two-sided equations. Every template attaches to an
 * existing skill and draws one private exact model for givens, choices and
 * worked steps. */

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  responseLabel?: string;
  choices?: Choice[];
  /** Choices are in display order because their labels name figure positions. */
  ordered?: boolean;
  /** Skip the answer-in-prompt check when the answer is shown in the prompt. */
  noLeakCheck?: boolean;
};
type Built = Draft & { variant: string };

const metadata = (
  id: string,
  title: string,
  skillId: string,
  gradeBand: "3–5" | "6–8",
  difficultyOffset: number,
  kind: "choice" | "number" | "mixed",
  figure: boolean,
  description: string,
): TemplateMetadata => ({
  id,
  version: 1,
  title,
  skillId,
  gradeBand,
  difficultyOffset,
  ...(kind === "choice"
    ? { requiredResponseCapability: "single-choice-v1" as const }
    : {}),
  ...(figure ? { requiredFigureCapability: "scenes-v1" as const } : {}),
  description,
});

export const texas38Templates: readonly TemplateMetadata[] = [
  metadata(
    "times-as-many-comparison",
    "Read and write times as many",
    "multiplicative-stories",
    "3–5",
    0.3,
    "choice",
    false,
    "Choose the sentence that a multiplication such as 3 × 24 describes as a times-as-many comparison, the expression for a times-as-many sentence, or the correct comparison of two counts.",
  ),
  metadata(
    "situation-pair-table",
    "Complete a table of pairs from a situation",
    "arithmetic-patterns",
    "3–5",
    0.25,
    "number",
    true,
    "Use a real-world relationship such as equal boxes or an age gap to complete one entry in a table of number pairs, forward, backward or for the rate itself.",
  ),
  metadata(
    "story-equation-choice",
    "Choose the equation for a story",
    "addition-stories",
    "3–5",
    0.5,
    "choice",
    false,
    "Choose the equation with a letter for the unknown that matches a one-step or two-step addition and subtraction story within 1,000.",
  ),
  metadata(
    "strip-diagram-equation",
    "Match a strip diagram to an equation",
    "multistep-whole-stories",
    "3–5",
    0.5,
    "choice",
    true,
    "Read a strip diagram of a multistep story with a letter for the unknown and choose the equation that fits it.",
  ),
  metadata(
    "division-area-model",
    "Show a quotient with an area model",
    "whole-division",
    "3–5",
    0.4,
    "choice",
    false,
    "Read a division as an area model: the equation with an unknown side, the sum of partial quotients, and the quotient from the partial areas.",
  ),
  metadata(
    "fraction-benchmark-reasonable",
    "Judge fraction sums and differences with benchmarks",
    "like-fraction-addition",
    "3–5",
    0.35,
    "choice",
    false,
    "Compare fractions with 0, 1/4, 1/2, 3/4 and 1, estimate a sum or difference of like fractions, and decide why an added-denominator answer cannot be reasonable.",
  ),
  metadata(
    "unit-relative-size",
    "Compare the sizes of units",
    "unit-conversion",
    "3–5",
    0.2,
    "choice",
    false,
    "Choose which customary or metric unit is larger, which measurement has the greater number, and the order of three units of one kind.",
  ),
  metadata(
    "decimal-area-model",
    "Model decimal products and quotients with area",
    "decimal-arithmetic",
    "3–5",
    0.45,
    "choice",
    true,
    "Read a decimal product from a shaded area on a hundredths square, choose the sentence the model shows, and use an area model to divide a decimal by a whole number.",
  ),
  metadata(
    "number-set-venn",
    "Place numbers in nested number sets",
    "signed-numbers",
    "6–8",
    0.3,
    "choice",
    true,
    "Use a nested-set diagram of natural, whole, integer and rational numbers to place a number, name the smallest set that holds it, and judge subset statements.",
  ),
  metadata(
    "reciprocal-division-choice",
    "Divide by a rational number with its reciprocal",
    "fraction-division",
    "6–8",
    0.35,
    "choice",
    false,
    "Choose the multiplication equal to dividing by a fraction or whole number, including how many fractional groups fit in a quantity.",
  ),
  metadata(
    "scaling-direction-choice",
    "Judge whether multiplying increases or decreases",
    "fraction-multiplication",
    "3–5",
    0.3,
    "choice",
    false,
    "Decide, without computing, whether a product is greater than or less than the starting number by comparing the multiplier with 1.",
  ),
  metadata(
    "percent-grid-model",
    "Read a percent from a hundredths grid",
    "percentages",
    "6–8",
    0.1,
    "choice",
    true,
    "Name the percent of a 10 by 10 grid that is shaded, or the fraction and decimal equal to it.",
  ),
  metadata(
    "percent-forms-and-parts",
    "Convert percents and find the whole or the percent",
    "percentages",
    "6–8",
    0.45,
    "mixed",
    false,
    "Write a fraction or decimal as a percent, a percent as a fraction, find the whole from a part and a percent, or find the percent that a part is of a whole.",
  ),
  metadata(
    "independent-dependent-roles",
    "Name the independent and dependent quantity",
    "dependent-variables",
    "6–8",
    0.2,
    "choice",
    true,
    "Read a table of two related quantities and decide which quantity is independent and which depends on it.",
  ),
  metadata(
    "expression-or-equation",
    "Tell an expression from an equation",
    "variable-expressions",
    "6–8",
    0.1,
    "choice",
    false,
    "Choose the item that is an expression or an equation among numeric, algebraic and verbal forms.",
  ),
  metadata(
    "rational-area-volume-equation",
    "Write an equation for area or volume with fractions",
    "triangle-area",
    "6–8",
    0.5,
    "choice",
    false,
    "Choose the equation that relates a triangle's or rectangle's area, or a prism's volume, to fractional dimensions and one unknown measure.",
  ),
  metadata(
    "categorical-summary",
    "Summarize categorical data",
    "categorical-data",
    "6–8",
    0.3,
    "mixed",
    true,
    "Find the mode of a frequency table, the relative frequency of a category as a percent, and a category count from a percent bar.",
  ),
  metadata(
    "check-register-balance",
    "Balance a check register",
    "signed-numbers",
    "6–8",
    0.4,
    "number",
    true,
    "Find a running balance or a missing amount in a check register with deposits, checks, transfers and fees.",
  ),
  metadata(
    "lifetime-income-salary",
    "Total income over a career",
    "decimal-algorithms",
    "6–8",
    0.35,
    "number",
    false,
    "Find lifetime earnings from an annual or monthly salary and a career length, and the difference between two salaries over a career.",
  ),
  metadata(
    "pi-as-ratio",
    "Pi as circumference over diameter",
    "circle-measurement",
    "6–8",
    0.1,
    "choice",
    false,
    "Choose the ratio that defines pi, compute it from a measured circle, and say how it changes when a circle is scaled.",
  ),
  metadata(
    "experimental-probability-predict",
    "Experimental probability and predictions",
    "probability",
    "6–8",
    0.35,
    "mixed",
    false,
    "Find an experimental probability from collected trials, predict a count in more trials, compare observed with expected counts, and judge which experiment to trust.",
  ),
  metadata(
    "cylinder-prism-surface-area",
    "Surface area of cylinders and triangular prisms",
    "surface-area",
    "6–8",
    0.6,
    "number",
    false,
    "Find the lateral or total surface area of a cylinder in terms of pi, a missing height from a surface area, or the surface area of a right triangular prism.",
  ),
  metadata(
    "both-sides-situation-equation",
    "Write an equation or inequality with variables on both sides",
    "linear-equations",
    "6–8",
    0.5,
    "choice",
    false,
    "Choose the equation or inequality that compares two situations that each have a starting amount and a rate, including a decreasing quantity.",
  ),
];
export const texas38TemplateIds = texas38Templates.map((t) => t.id);

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
function shuffle<T>(r: Random, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = r(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}
const commas = (n: number) => n.toLocaleString("en-US");
const NAMES = ["Ava", "Ben", "Carla", "Dev", "Ella", "Finn", "Gia", "Hugo"];
const twoNames = (r: Random): [string, string] => {
  const a = pick(r, NAMES);
  return [
    a,
    pick(
      r,
      NAMES.filter((n) => n !== a),
    ),
  ];
};
const dl = (cents: number) => (cents / 100).toFixed(2);
/** Whole numbers stay whole; other amounts keep two decimals. */
const amount = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : dl(cents);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const MINUS = "−";
const signed = (n: number) => (n < 0 ? `${MINUS}${-n}` : String(n));

/** Four distinct choices: the correct one plus three distinct wrong labels. */
function choicesFrom(
  correct: string,
  wrong: { label: string; feedback: string }[],
): Choice[] {
  const seen = new Set([correct]);
  const out: Choice[] = [{ label: correct, correct: true }];
  for (const w of wrong) {
    if (seen.has(w.label)) continue;
    seen.add(w.label);
    out.push(w);
    if (out.length === 4) return out;
  }
  throw new Error("Need three distinct wrong choices");
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  if (draft.noLeakCheck) return false;
  const text = `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices
    ? draft.choices.find((c) => c.correct)!.label
    : draft.answer!;
  if (/^[\d,.]+$/.test(correct))
    return new RegExp(
      `(?<![\\d.,])${escapeRegex(correct)}(?![\\d]|[.,]\\d)`,
    ).test(text);
  return text.includes(correct);
}

/** Exact fractions as [numerator, denominator] with denominator > 0. */
type Fr = [number, number];
const fr = (n: number, d = 1): Fr => {
  const g = gcd(n, d) || 1;
  return d < 0 ? [-n / g, -d / g] : [n / g, d / g];
};
const frAdd = (a: Fr, b: Fr) => fr(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
const frSub = (a: Fr, b: Fr) => fr(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const frMul = (a: Fr, b: Fr) => fr(a[0] * b[0], a[1] * b[1]);
const frDiv = (a: Fr, b: Fr) => fr(a[0] * b[1], a[1] * b[0]);
const frEq = (a: Fr, b: Fr) => a[0] === b[0] && a[1] === b[1];
const frVal = (a: Fr) => a[0] / a[1];
/** A fraction or whole number; improper results stay as improper fractions. */
const frText = (a: Fr) => (a[1] === 1 ? String(a[0]) : `${a[0]}/${a[1]}`);
/** A mixed number such as 2 1/2 for a value of at least 1. */
const frMixed = (a: Fr) => {
  const w = Math.floor(a[0] / a[1]);
  const rest = a[0] - w * a[1];
  if (!rest) return String(w);
  return w ? `${w} ${rest}/${a[1]}` : `${rest}/${a[1]}`;
};

/* ---------------------------------------------------------------------- */
/* Figures                                                                 */
/* ---------------------------------------------------------------------- */

type Part = { label: string; size: number; unknown?: boolean };
/** A strip diagram: an optional whole above parts of proportional width. */
function stripScene(
  title: string,
  whole: string | null,
  parts: Part[],
  fills: ("accent-fill" | "warm-fill" | "gold-fill")[] = [],
): Scene {
  const total = parts.reduce((a, p) => a + p.size, 0);
  const els: Parameters<typeof scene>[0][] = [];
  const top = whole ? 1.6 : 0;
  if (whole)
    els.push(
      {
        type: "rect",
        id: "whole",
        at: [0, top],
        size: [total, 1.2],
        fill: "paper",
        stroke: "ink",
      },
      {
        type: "text",
        id: "whole-label",
        at: [total / 2, top + 0.6],
        text: whole,
        font: "math",
        size: "md",
      },
    );
  let x = 0;
  parts.forEach((p, i) => {
    els.push(
      {
        type: "rect",
        id: `part-${i}`,
        at: [x, 0],
        size: [p.size, 1.2],
        fill: p.unknown ? "gold-fill" : (fills[i] ?? "accent-fill"),
        stroke: p.unknown ? "gold" : "accent",
      },
      {
        type: "text",
        id: `part-label-${i}`,
        at: [x + p.size / 2, 0.6],
        text: p.label,
        font: "math",
        size: "md",
      },
    );
    x += p.size;
  });
  return scene(...els).build({ title });
}

/** A 10 by 10 grid of one whole with shaded tenths and hundredths regions. */
function hundredGrid(
  title: string,
  shaded: { col: number; row: number; cols: number; rows: number }[],
  labels: { text: string; at: [number, number] }[] = [],
): Scene {
  const els: Parameters<typeof scene>[0][] = [
    {
      type: "rect",
      id: "whole",
      at: [0, 0],
      size: [10, 10],
      fill: "paper",
      stroke: "ink",
    },
  ];
  shaded.forEach((s, i) =>
    els.push({
      type: "rect",
      id: `shade-${i}`,
      at: [s.col, s.row],
      size: [s.cols, s.rows],
      fill: "accent-fill",
      stroke: "accent",
    }),
  );
  for (let k = 1; k < 10; k++)
    els.push(
      {
        type: "segment",
        id: `v-${k}`,
        from: [k, 0],
        to: [k, 10],
        stroke: "grid",
      },
      {
        type: "segment",
        id: `h-${k}`,
        from: [0, k],
        to: [10, k],
        stroke: "grid",
      },
    );
  labels.forEach((l, i) =>
    els.push({
      type: "text",
      id: `label-${i}`,
      at: l.at,
      text: l.text,
      font: "math",
      size: "md",
    }),
  );
  return scene(...els).build({ title });
}
/** The first k hundredths of the grid, filled column by column from the left. */
function percentShading(k: number) {
  const full = Math.floor(k / 10);
  const rest = k % 10;
  return [
    ...(full ? [{ col: 0, row: 0, cols: full, rows: 10 }] : []),
    ...(rest ? [{ col: full, row: 0, cols: 1, rows: rest }] : []),
  ];
}

/* ---------------------------------------------------------------------- */
/* 3.5.C Times as many                                                     */
/* ---------------------------------------------------------------------- */

const THINGS = [
  "stickers",
  "marbles",
  "pencils",
  "shells",
  "cards",
  "stamps",
  "coins",
  "beads",
];

function timesAsManyComparison(r: Random): Built {
  const variant = pick(r, [
    "expression-to-sentence",
    "sentence-to-expression",
    "compare-counts",
  ]);
  const [a, b] = twoNames(r);
  const thing = pick(r, THINGS);
  const k = variant === "expression-to-sentence" ? r(3, 9) : r(2, 9);
  if (variant === "expression-to-sentence") {
    const base = r(2, 25);
    return {
      variant,
      prompt: `${a} has ${base} ${thing}. The product ${k} × ${base} is the number of ${thing} that ${b} has. Which sentence compares the two amounts?`,
      hint: `In ${k} × ${base}, the ${base} is ${a}'s amount and the ${k} says how many copies of it ${b} has. Say that with "times as many".`,
      explanation: [
        `${a} has ${base} ${thing}, and ${b} has ${k} × ${base}.`,
        `${k} × ${base} means ${k} equal groups of ${base}, so ${b} has ${k} times as many ${thing} as ${a}.`,
      ],
      choices: choicesFrom(`${b} has ${k} times as many ${thing} as ${a}.`, [
        {
          label: `${b} has ${k} more ${thing} than ${a}.`,
          feedback: `"${k} more" is addition, ${base} + ${k}. A product means ${k} equal copies of ${a}'s ${base}.`,
        },
        {
          label: `${a} has ${k} times as many ${thing} as ${b}.`,
          feedback: `The product ${k} × ${base} is ${b}'s amount, and it is ${k} copies of ${a}'s amount, so ${b} has the greater number.`,
        },
        {
          label: `${b} has ${base} more ${thing} than ${a}.`,
          feedback: `The expression is a product. It does not say ${b} has ${base} more.`,
        },
        {
          label: `${b} has ${base} times as many ${thing} as ${a}.`,
          feedback: `${a} has ${base} ${thing}. The number of copies is ${k}, so it is ${k} times as many, not ${base} times as many.`,
        },
      ]),
    };
  }
  if (variant === "sentence-to-expression") {
    let base = r(2, 12);
    if (base === 2 && k === 2) base = 3;
    return {
      variant,
      prompt: `${a} has ${base} ${thing}. ${b} has ${k} times as many ${thing} as ${a}. Which expression gives the number of ${thing} ${b} has?`,
      hint: `"${k} times as many" means ${k} equal copies of ${a}'s ${base}. Which operation joins equal copies?`,
      explanation: [
        `${b} has ${k} times as many as ${a}, so ${b} has ${k} copies of ${base}.`,
        `${k} copies of ${base} is ${k} × ${base} = ${k * base}.`,
      ],
      choices: choicesFrom(`${k} × ${base}`, [
        {
          label: `${k} + ${base}`,
          feedback: `Times as many is repeated equal groups, which is multiplication, not adding ${k}.`,
        },
        {
          label: `${base} ÷ ${k}`,
          feedback: `Dividing would give a part of ${a}'s amount. ${b} has more, ${k} times as many.`,
        },
        k * k === k + base
          ? {
              label: `${base} − ${k}`,
              feedback: `Times as many is repeated equal groups, which is multiplication, not taking ${k} away.`,
            }
          : {
              label: `${k} × ${k}`,
              feedback: `The amount being copied is ${a}'s ${base} ${thing}, not ${k}.`,
            },
        {
          label: `${base} × ${k + 1}`,
          feedback: `${k} times as many is ${k} copies, not ${k + 1}.`,
        },
      ]),
    };
  }
  const s = pick(r, [3, 4, 5, 6, 7, 8, 9, 10, 12]);
  const big = k * s;
  return {
    variant,
    prompt: `${a} has ${s} ${thing}. ${b} has ${big} ${thing}. Which sentence compares the amounts correctly with "times as many"?`,
    hint: `Ask how many groups of ${a}'s ${s} ${thing} fit in ${b}'s ${big}. That number goes in front of "times as many".`,
    explanation: [
      `${big} ÷ ${s} = ${k}, because ${k} × ${s} = ${big}.`,
      `${b} has ${k} times as many ${thing} as ${a}.`,
    ],
    choices: choicesFrom(`${b} has ${k} times as many ${thing} as ${a}.`, [
      {
        label: `${a} has ${k} times as many ${thing} as ${b}.`,
        feedback: `${a} has fewer. The greater amount, ${b}'s, is the one that is "times as many".`,
      },
      {
        label: `${b} has ${big - s} times as many ${thing} as ${a}.`,
        feedback: `${big - s} is how many more ${b} has. "Times as many" counts equal groups: ${big} ÷ ${s}.`,
      },
      {
        label: `${b} has ${s} times as many ${thing} as ${a}.`,
        feedback: `${s} is ${a}'s amount. The number of times is how many ${s}s make ${big}.`,
      },
      {
        label: `${b} has ${k} more ${thing} than ${a}.`,
        feedback: `${big} is ${big - s} more than ${s}. "${k}" counts equal groups, so it is ${k} times as many.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 3.5.E Table of number pairs from a situation                            */
/* ---------------------------------------------------------------------- */

const RATE_CONTEXTS = [
  {
    rule: (p: number) => `Each box holds ${p} pencils.`,
    inn: "Boxes",
    out: "Pencils",
    inWord: "boxes",
    outWord: "pencils",
    whole: "one box",
  },
  {
    rule: (p: number) => `Each ticket costs ${p} dollars.`,
    inn: "Tickets",
    out: "Dollars",
    inWord: "tickets",
    outWord: "dollars",
    whole: "one ticket",
  },
  {
    rule: (p: number) => `Each bus seats ${p} students.`,
    inn: "Buses",
    out: "Students",
    inWord: "buses",
    outWord: "students",
    whole: "one bus",
  },
  {
    rule: (p: number) => `Each bag has ${p} apples.`,
    inn: "Bags",
    out: "Apples",
    inWord: "bags",
    outWord: "apples",
    whole: "one bag",
  },
  {
    rule: (p: number) => `Each pack has ${p} cards.`,
    inn: "Packs",
    out: "Cards",
    inWord: "packs",
    outWord: "cards",
    whole: "one pack",
  },
];
const pairTable = (
  inn: string,
  out: string,
  rows: [string, number | string][],
) =>
  ({
    kind: "scene",
    scene: table({
      id: "t",
      corner: inn,
      columns: [out],
      rows: rows.map(([label, v]) => ({ label, cells: [v] })),
    }).scene({ title: `${out} for different values of ${inn.toLowerCase()}` }),
  }) as SemanticFigure;

function situationPairTable(r: Random): Built {
  const variant = pick(r, [
    "rate-forward",
    "rate-backward",
    "per-one",
    "gap-forward",
    "gap-backward",
  ]);
  if (variant.startsWith("gap")) {
    const [young, old] = twoNames(r);
    const g = r(2, 9);
    const givens = shuffle(r, [3, 4, 5, 6, 7, 8])
      .slice(0, 3)
      .sort((x, y) => x - y);
    const n = r(9, 15);
    const inn = `${young}'s age`;
    const out = `${old}'s age`;
    if (variant === "gap-forward")
      return {
        variant,
        prompt: `${old} is ${g} years older than ${young}. The table shows their ages at different times. How old is ${old} when ${young} is ${n}?`,
        hint: `Compare a row you can see, such as ${young} at ${givens[0]} and ${old} at ${givens[0]! + g}. How much older is ${old}? That gap is the same in every row.`,
        explanation: [
          `The gap is ${g} years in every row, for example ${givens[0]! + g} − ${givens[0]} = ${g}.`,
          `When ${young} is ${n}, ${old} is ${n} + ${g} = ${n + g}.`,
        ],
        figure: pairTable(inn, out, [
          ...givens.map((x): [string, number | string] => [String(x), x + g]),
          [String(n), "?"],
        ]),
        answer: String(n + g),
        responseLabel: `${old}'s age`,
      };
    return {
      variant,
      prompt: `${old} is ${g} years older than ${young}. The table shows their ages at different times. How old is ${young} when ${old} is ${n + g}?`,
      hint: `Subtract to compare the ages in a row you can see, such as ${givens[0]! + g} and ${givens[0]}. The same gap applies to the row with ?.`,
      explanation: [
        `The gap is ${g} years in every row.`,
        `${young} is ${g} years younger: ${n + g} − ${g} = ${n}.`,
      ],
      figure: pairTable(inn, out, [
        ...givens.map((x): [string, number | string] => [String(x), x + g]),
        ["?", n + g],
      ]),
      answer: String(n),
      responseLabel: `${young}'s age`,
    };
  }
  const c = pick(r, RATE_CONTEXTS);
  const p = r(3, 9);
  const given = [1, 2, 3, 4];
  if (variant === "rate-forward") {
    const n = r(6, 9);
    return {
      variant,
      prompt: `${c.rule(p)} The table shows the number of ${c.outWord} for different numbers of ${c.inWord}. How many ${c.outWord} for ${n} ${c.inWord}?`,
      hint: `Each row is the number of ${c.inWord} times ${p}. Use the same rule for ${n}.`,
      explanation: [
        `${c.rule(p)} So the number of ${c.outWord} is ${p} times the number of ${c.inWord}.`,
        `For ${n} ${c.inWord}: ${n} × ${p} = ${n * p}.`,
      ],
      figure: pairTable(c.inn, c.out, [
        ...given
          .slice(0, 3)
          .map((x): [string, number | string] => [String(x), x * p]),
        [String(n), "?"],
      ]),
      answer: String(n * p),
      responseLabel: c.out,
    };
  }
  if (variant === "rate-backward") {
    const n = r(6, 9);
    return {
      variant,
      prompt: `${c.rule(p)} The table shows the number of ${c.outWord} for different numbers of ${c.inWord}. How many ${c.inWord} give ${n * p} ${c.outWord}?`,
      hint: `Each ${c.whole.replace("one ", "")} accounts for ${p}. How many groups of ${p} make ${n * p}?`,
      explanation: [
        `${c.rule(p)} The number of ${c.outWord} is ${p} times the number of ${c.inWord}.`,
        `${n * p} ÷ ${p} = ${n}, so ${n} ${c.inWord} give ${n * p} ${c.outWord}.`,
      ],
      figure: pairTable(c.inn, c.out, [
        ...given
          .slice(0, 3)
          .map((x): [string, number | string] => [String(x), x * p]),
        ["?", n * p],
      ]),
      answer: String(n),
      responseLabel: c.inn,
    };
  }
  const xs = [2, 3, 5];
  return {
    variant,
    prompt: `Every ${c.whole.replace("one ", "")} has the same number of ${c.outWord}. The table shows the number of ${c.outWord} for different numbers of ${c.inWord}. How many ${c.outWord} are there for ${c.whole}?`,
    hint: `Look at the row for ${xs[0]} ${c.inWord}: ${xs[0]! * p} ${c.outWord} are shared equally among ${xs[0]}. How many does each get?`,
    explanation: [
      `The rows show ${xs[0]! * p} ${c.outWord} for ${xs[0]} ${c.inWord}, and the same amount for each.`,
      `${xs[0]! * p} ÷ ${xs[0]} = ${p}, so ${c.whole} has ${p} ${c.outWord}.`,
    ],
    figure: pairTable(c.inn, c.out, [
      ...xs.map((x): [string, number | string] => [String(x), x * p]),
      ["1", "?"],
    ]),
    answer: String(p),
    responseLabel: `${c.out} for 1`,
  };
}

/* ---------------------------------------------------------------------- */
/* 3.5.A Equation for a story                                              */
/* ---------------------------------------------------------------------- */

type Wrong = { text: string; reason: string };
function storyEquationChoice(r: Random): Built {
  const variant = pick(r, [
    "join-result",
    "separate-result",
    "join-start-unknown",
    "separate-start-unknown",
    "join-change-unknown",
    "two-step-result",
    "two-step-start-unknown",
  ]);
  const name = pick(r, NAMES);
  const thing = pick(r, THINGS);
  const a = r(150, 480);
  const b = r(110, 420);
  let story = "";
  let ask = "";
  let correct = "";
  let wrong: Wrong[] = [];
  let steps: string[] = [];
  let hint = "";
  if (variant === "join-result") {
    story = `${name} has ${a} ${thing} and gets ${b} more.`;
    ask = `Let n be the number of ${thing} ${name} has now.`;
    correct = r(0, 1) ? `${a} + ${b} = n` : `n − ${b} = ${a}`;
    wrong = [
      {
        text: `${a} − ${b} = n`,
        reason: `That takes ${b} away. Getting more joins amounts, so the total is found by adding.`,
      },
      {
        text: `${a} − n = ${b}`,
        reason: `That treats ${a} as the total, but ${a} is only the starting amount.`,
      },
      {
        text: `n + ${a} = ${b}`,
        reason: `The total n is not what ${b} gets added to; ${a} and ${b} are the parts and n is the total.`,
      },
    ];
    steps = [
      `${name} starts with ${a} and gets ${b} more, so the amounts are joined.`,
      `The total n equals ${a} + ${b}, so ${a} + ${b} = n (or n − ${b} = ${a}).`,
    ];
    hint = `Is ${name}'s ${a} a part or the total? The amount ${name} gets joins it, so the total n is the unknown.`;
  } else if (variant === "separate-result") {
    story = `${name} has ${a + b} ${thing} and gives away ${b}.`;
    ask = `Let n be the number of ${thing} ${name} has left.`;
    correct = r(0, 1) ? `${a + b} − ${b} = n` : `n + ${b} = ${a + b}`;
    wrong = [
      {
        text: `${a + b} + ${b} = n`,
        reason: `Giving away takes ${b} off the amount, so it is not added.`,
      },
      {
        text: `n − ${a + b} = ${b}`,
        reason: `That starts from n and takes ${a + b} away. ${a + b} is the starting amount.`,
      },
      {
        text: `${b} − ${a + b} = n`,
        reason: `That subtracts the larger amount from the smaller. Subtract what is given away from what ${name} had.`,
      },
    ];
    steps = [
      `${name} starts with ${a + b} and gives away ${b}, so ${b} is taken away.`,
      `What is left is ${a + b} − ${b} = n, or n + ${b} = ${a + b}.`,
    ];
    hint = `${name} starts with ${a + b}. Giving ${b} away takes it from that starting amount.`;
  } else if (variant === "join-start-unknown") {
    story = `${name} has some ${thing}. After getting ${b} more, ${name} has ${a + b}.`;
    ask = `Let n be the number of ${thing} ${name} had at first.`;
    correct = `n + ${b} = ${a + b}`;
    wrong = [
      {
        text: `n − ${b} = ${a + b}`,
        reason: `That says ${name} took ${b} away from n. The story says ${name} got ${b} more.`,
      },
      {
        text: `${b} − n = ${a + b}`,
        reason: `n is the starting amount; ${b} is not taken from n and the total is larger than ${b}.`,
      },
      {
        text: `${a + b} + ${b} = n`,
        reason: `${a + b} already includes the ${b} that was added, so adding ${b} again is not right.`,
      },
    ];
    steps = [
      `The start n and the ${b} that is added make the new total.`,
      `So n + ${b} = ${a + b}.`,
    ];
    hint = `n is the amount before anything changes. Write what happens to n, then what it equals afterwards.`;
  } else if (variant === "separate-start-unknown") {
    story = `${name} has some ${thing}, gives away ${b}, and then has ${a} left.`;
    ask = `Let n be the number of ${thing} ${name} had at first.`;
    correct = `n − ${b} = ${a}`;
    wrong = [
      {
        text: `n + ${b} = ${a}`,
        reason: `That says ${name} got ${b} more. The story says ${name} gave ${b} away.`,
      },
      {
        text: `${a} − ${b} = n`,
        reason: `${a} is what was left after giving away, so the starting amount is greater than ${a}.`,
      },
      {
        text: `${b} − n = ${a}`,
        reason: `That takes n from ${b}. The ${b} is taken away from n.`,
      },
    ];
    steps = [
      `The start is n. Giving away ${b} leaves ${a}.`,
      `So n − ${b} = ${a}.`,
    ];
    hint = `Start with n, the amount before. Show ${b} being taken away, and set that equal to what is left.`;
  } else if (variant === "join-change-unknown") {
    story = `${name} has ${a} ${thing}, gets some more, and then has ${a + b}.`;
    ask = `Let n be the number of ${thing} ${name} got.`;
    correct = `${a} + n = ${a + b}`;
    wrong = [
      {
        text: `${a} − n = ${a + b}`,
        reason: `${name} ended with more than ${a}, so ${name} did not take any away.`,
      },
      {
        text: `n − ${a} = ${a + b}`,
        reason: `That makes n the total. n is the part that was added.`,
      },
      {
        text: `${a} + ${a + b} = n`,
        reason: `${a + b} is already the total, so it is not added to ${a}.`,
      },
    ];
    steps = [
      `${name} starts with ${a} and gets n more.`,
      `The total after joining is ${a + b}, so ${a} + n = ${a + b}.`,
    ];
    hint = `The start, ${a}, and the unknown amount that joins it make the new total.`;
  } else if (variant === "two-step-result") {
    const c = r(60, Math.min(a + b - 40, 300));
    const cc = c === b ? c + 7 : c;
    story = `${name} has ${a} ${thing}, gets ${b} more, and then gives away ${cc}.`;
    ask = `Let n be the number of ${thing} ${name} has now.`;
    correct = `${a} + ${b} − ${cc} = n`;
    wrong = [
      {
        text: `${a} − ${b} + ${cc} = n`,
        reason: `That swaps the two changes. ${name} gets ${b} and gives ${cc}.`,
      },
      {
        text: `${a} + ${b} + ${cc} = n`,
        reason: `${name} gives ${cc} away, so it is subtracted.`,
      },
      {
        text: `${a} − ${b} − ${cc} = n`,
        reason: `${name} gets ${b} more, so it is added.`,
      },
    ];
    steps = [
      `Getting ${b} more adds ${b}. Giving away ${cc} subtracts ${cc}.`,
      `So ${a} + ${b} − ${cc} = n.`,
    ];
    hint = `Take the changes in order: one joins ${name}'s ${thing} and one takes some away. Match each with + or −.`;
  } else {
    const c = r(40, 200);
    const cc = c === b ? c + 9 : c;
    const start = a;
    const end = start + b - cc;
    story = `${name} has some ${thing}, gets ${b} more, and then gives away ${cc}. Now ${name} has ${end}.`;
    ask = `Let n be the number of ${thing} ${name} had at first.`;
    correct = `n + ${b} − ${cc} = ${end}`;
    wrong = [
      {
        text: `n − ${b} + ${cc} = ${end}`,
        reason: `That swaps the two changes. ${name} gets ${b} and gives ${cc}.`,
      },
      {
        text: `n + ${b} + ${cc} = ${end}`,
        reason: `${name} gives ${cc} away, so it is subtracted.`,
      },
      {
        text: `n − ${b} − ${cc} = ${end}`,
        reason: `${name} gets ${b} more, so it is added.`,
      },
    ];
    steps = [
      `Start with n, add the ${b} received and subtract the ${cc} given away.`,
      `That leaves ${end}: n + ${b} − ${cc} = ${end}.`,
    ];
    hint = `Begin with n and apply each change in order: one adds and one subtracts. The result is ${end}.`;
  }
  return {
    variant,
    prompt: `${story} ${ask} Which equation matches the story?`,
    hint,
    explanation: steps,
    choices: choicesFrom(
      correct,
      wrong.map((w) => ({ label: w.text, feedback: w.reason })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 4.5.A, 5.4.B Strip diagram and equation with a letter                   */
/* ---------------------------------------------------------------------- */

function stripDiagramEquation(r: Random): Built {
  const variant = pick(r, [
    "groups-plus-extra",
    "total-minus-groups",
    "unknown-in-groups",
    "share-after-removing",
  ]);
  const name = pick(r, NAMES);
  const thing = pick(r, ["marbles", "stickers", "beads", "cards", "stamps"]);
  const repeat = (n: number, label: string, size: number): Part[] =>
    Array.from({ length: n }, () => ({ label, size }));
  if (variant === "groups-plus-extra") {
    const a = r(3, 5),
      b = r(3, 9),
      c = r(2, 9);
    return {
      variant,
      prompt: `${name} packs ${a} bags with ${b} ${thing} in each bag and adds ${c} loose ${thing}. The strip diagram shows the story, with n for the total number of ${thing}. Which equation matches the diagram?`,
      hint: `Count the equal parts and say what each one is worth. Then look at the last part. How are they combined to make n?`,
      explanation: [
        `The diagram has ${a} equal parts of ${b}, which is ${a} × ${b}, and one more part of ${c}.`,
        `The whole is the parts together: n = ${a} × ${b} + ${c}.`,
      ],
      figure: {
        kind: "scene",
        scene: stripScene(
          `A total n made of ${a} parts of ${b} and one part of ${c}`,
          "n",
          [...repeat(a, String(b), 2), { label: String(c), size: 1.6 }],
          [],
        ),
      },
      choices: choicesFrom(`n = ${a} × ${b} + ${c}`, [
        {
          label: `n = ${a} + ${b} + ${c}`,
          feedback: `The ${a} parts each have ${b}, so they make ${a} × ${b}, not ${a} + ${b}.`,
        },
        {
          label: `n = ${a} × (${b} + ${c})`,
          feedback: `The ${c} is added once, not to every group.`,
        },
        {
          label: `n = ${a} × ${b} − ${c}`,
          feedback: `The loose ${thing} are added to the total, so the last part is added.`,
        },
      ]),
    };
  }
  if (variant === "total-minus-groups") {
    const a = r(2, 4),
      b = r(3, 9),
      left = r(3, 12);
    const T = a * b + left;
    return {
      variant,
      prompt: `${name} has ${T} dollars and buys ${a} items that cost ${b} dollars each. The strip diagram shows the story, with n for the dollars left. Which equation matches the diagram?`,
      hint: `The whole strip is ${T} dollars. The parts that are ${b} each are spent. n is the part that remains.`,
      explanation: [
        `The whole is ${T}. The spent parts are ${a} equal parts of ${b}, which is ${a} × ${b}.`,
        `The part that remains is the whole minus the spent parts: ${T} − ${a} × ${b} = n.`,
      ],
      figure: {
        kind: "scene",
        scene: stripScene(
          `A whole of ${T} made of ${a} parts of ${b} and a part n`,
          String(T),
          [
            ...repeat(a, String(b), 2),
            { label: "n", size: 1.6, unknown: true },
          ],
          [],
        ),
      },
      choices: choicesFrom(`${T} − ${a} × ${b} = n`, [
        {
          label: `${T} − ${a} + ${b} = n`,
          feedback: `The ${a} items each cost ${b}, so the spent amount is ${a} × ${b}.`,
        },
        {
          label: `(${T} − ${a}) × ${b} = n`,
          feedback: `That takes ${a} dollars from ${T} first. The ${a} is a count of items, not dollars.`,
        },
        {
          label: `${T} + ${a} × ${b} = n`,
          feedback: `Money spent comes off the ${T} dollars, so it is subtracted.`,
        },
      ]),
    };
  }
  if (variant === "unknown-in-groups") {
    const a = r(3, 5),
      n = r(3, 9),
      c = r(2, 9);
    const T = a * n + c;
    return {
      variant,
      prompt: `${name} puts the same number of ${thing}, n, in each of ${a} boxes and ${c} more ${thing} in a bag. There are ${T} ${thing} in all. The strip diagram shows the story. Which equation matches the diagram?`,
      hint: `The equal parts are all labeled n. Count them, then think about how the last part joins them to make ${T}.`,
      explanation: [
        `There are ${a} equal parts of n, which is ${a} × n, and one part of ${c}.`,
        `Together they make ${T}: ${a} × n + ${c} = ${T}.`,
      ],
      figure: {
        kind: "scene",
        scene: stripScene(
          `A whole of ${T} made of ${a} parts of n and one part of ${c}`,
          String(T),
          [...repeat(a, "n", 2), { label: String(c), size: 1.6 }],
          [],
        ),
      },
      choices: choicesFrom(`${a} × n + ${c} = ${T}`, [
        {
          label: `${a} + n + ${c} = ${T}`,
          feedback: `There are ${a} parts that each equal n, so they make ${a} × n.`,
        },
        {
          label: `${a} × (n + ${c}) = ${T}`,
          feedback: `The ${c} is only added once, not to each box.`,
        },
        {
          label: `${a} × n − ${c} = ${T}`,
          feedback: `The ${c} ${thing} in the bag are part of the ${T}, so they are added.`,
        },
      ]),
    };
  }
  const a = r(3, 5),
    n = r(3, 9),
    c = r(2, 9);
  const T = a * n + c;
  return {
    variant,
    prompt: `${name} has ${T} ${thing}, sets aside ${c}, and shares the rest equally among ${a} friends. Each friend gets n. The strip diagram shows the story. Which equation matches the diagram?`,
    hint: `First take away the part that is set aside. What is left is split into ${a} equal parts, each n.`,
    explanation: [
      `Removing ${c} from the whole ${T} leaves ${T} − ${c}, in ${a} equal parts.`,
      `Each part is n, so (${T} − ${c}) ÷ ${a} = n.`,
    ],
    figure: {
      kind: "scene",
      scene: stripScene(
        `A whole of ${T} made of a part of ${c} and ${a} parts of n`,
        String(T),
        [{ label: String(c), size: 1.6 }, ...repeat(a, "n", 2)],
        ["warm-fill"],
      ),
    },
    choices: choicesFrom(`(${T} − ${c}) ÷ ${a} = n`, [
      {
        label: `${T} − ${c} ÷ ${a} = n`,
        feedback: `Division would be done first here. The subtraction has to happen before sharing, so it needs parentheses.`,
      },
      {
        label: `${T} ÷ ${a} − ${c} = n`,
        feedback: `That shares all ${T} first. The ${c} is set aside before sharing.`,
      },
      {
        label: `(${T} + ${c}) ÷ ${a} = n`,
        feedback: `The ${c} is set aside, so it is taken from ${T}, not added.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 4.4.E Quotient as an area model                                         */
/* ---------------------------------------------------------------------- */

function divisionAreaModel(r: Random): Built {
  const variant = pick(r, [
    "partial-quotients",
    "area-equation",
    "read-quotient",
  ]);
  const d = r(3, 9);
  if (variant === "area-equation") {
    const Q = r(12, 99) * (d <= 4 ? 10 : 1);
    const N = d * Q;
    const unit = pick(r, ["feet", "centimeters", "meters"]);
    return {
      variant,
      prompt: `A rectangle has an area of ${commas(N)} square ${unit} and a height of ${d} ${unit}. Its width is w ${unit}. Which equation shows ${commas(N)} ÷ ${d} as an area model?`,
      hint: `Area is height times width. Write that for this rectangle with ${commas(N)} as the area. The quotient is the unknown side.`,
      explanation: [
        `Area = height × width, so ${d} × w = ${commas(N)}.`,
        `Dividing the area by the known side finds w: ${commas(N)} ÷ ${d} = ${Q}.`,
      ],
      choices: choicesFrom(`${d} × w = ${commas(N)}`, [
        {
          label: `${d} + w = ${commas(N)}`,
          feedback: `Area comes from multiplying the sides, not adding them.`,
        },
        {
          label: `w ÷ ${d} = ${commas(N)}`,
          feedback: `The area is the product of the sides. Dividing the area by ${d} finds w, not the other way around.`,
        },
        {
          label: `${commas(N)} × ${d} = w`,
          feedback: `${commas(N)} is the area, so w is found by dividing it by ${d}, not by multiplying.`,
        },
      ]),
    };
  }
  if (variant === "read-quotient") {
    const T = r(2, 9),
      O = r(2, 9);
    const Q = T * 10 + O;
    const N = d * Q;
    const p2 = d * T * 10,
      p3 = d * O;
    return {
      variant,
      prompt: `An area model for ${N} ÷ ${d} is a rectangle ${d} units tall. Its area is split into two columns with areas ${p2} and ${p3}. What is the quotient?`,
      hint: `Each column's width is its area divided by the height ${d}. Find both widths, then add them.`,
      explanation: [
        `Widths: ${p2} ÷ ${d} = ${T * 10} and ${p3} ÷ ${d} = ${O}.`,
        `The quotient is the total width: ${T * 10} + ${O} = ${Q}.`,
      ],
      choices: choicesFrom(String(Q), [
        {
          label: String(T * 10 + p3),
          feedback: `Only the first area was divided by ${d}. Divide ${p3} by ${d} too.`,
        },
        {
          label: String(T + O),
          feedback: `The first column is ${T * 10}, not ${T}, because its area is in the tens.`,
        },
        {
          label: String(N),
          feedback: `${N} is the whole area. The quotient is the width.`,
        },
        {
          label: String(p2 + O),
          feedback: `Divide both areas by ${d} before adding the widths.`,
        },
      ]),
    };
  }
  const H = r(1, 9),
    T = r(1, 9),
    O = r(1, 9);
  const Q = H * 100 + T * 10 + O;
  const N = d * Q;
  const p1 = d * H * 100,
    p2 = d * T * 10,
    p3 = d * O;
  return {
    variant,
    prompt: `An area model divides ${commas(N)} by ${d}. The rectangle is ${d} units tall, and its area is split into ${commas(p1)}, ${commas(p2)} and ${p3} square units. Which equation shows the quotient?`,
    hint: `Each column's width is its area divided by the height ${d}. Find the three widths first, then add them.`,
    explanation: [
      `Widths: ${commas(p1)} ÷ ${d} = ${H * 100}, ${commas(p2)} ÷ ${d} = ${T * 10}, ${p3} ÷ ${d} = ${O}.`,
      `The widths add to the quotient: ${H * 100} + ${T * 10} + ${O} = ${Q}.`,
    ],
    choices: choicesFrom(`${H * 100} + ${T * 10} + ${O} = ${Q}`, [
      {
        label: `${H * 100} + ${T * 10} + ${p3} = ${H * 100 + T * 10 + p3}`,
        feedback: `The last area, ${p3}, was not divided by ${d}. Its width is ${O}.`,
      },
      {
        label: `${commas(p1)} + ${commas(p2)} + ${p3} = ${commas(N)}`,
        feedback: `That adds the areas, which gives the total area. The quotient is the sum of the widths.`,
      },
      {
        label: `${H * 10} + ${T * 10} + ${O} = ${H * 10 + T * 10 + O}`,
        feedback: `The first width is ${commas(p1)} ÷ ${d} = ${H * 100}, not ${H * 10}. Check the place value.`,
      },
      {
        label: `${H * 100} + ${T} + ${O} = ${H * 100 + T + O}`,
        feedback: `The middle width is ${commas(p2)} ÷ ${d} = ${T * 10}, not ${T}. Check the place value.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 4.3.F Fraction sums and differences with benchmarks                     */
/* ---------------------------------------------------------------------- */

const BENCHMARKS: { fr: Fr; label: string }[] = [
  { fr: fr(0), label: "0" },
  { fr: fr(1, 4), label: "1/4" },
  { fr: fr(1, 2), label: "1/2" },
  { fr: fr(3, 4), label: "3/4" },
  { fr: fr(1), label: "1" },
];
/** The nearest benchmark, or null when two benchmarks are equally near. */
function nearestBenchmark(x: Fr) {
  const ranked = BENCHMARKS.map((b) => ({
    b,
    d: Math.abs(frVal(b.fr) - frVal(x)),
  })).sort((p, q) => p.d - q.d);
  return ranked[0]!.d === ranked[1]!.d ? null : ranked[0]!.b;
}
const estimateText = (x: Fr) =>
  x[0] === 0 ? "about 0" : `about ${frMixed(x)}`;

function fractionBenchmarkReasonable(r: Random): Built {
  const variant = pick(r, [
    "nearest-benchmark",
    "estimate-sum",
    "estimate-difference",
    "denominator-check",
  ]);
  if (variant === "nearest-benchmark") {
    const b = pick(r, [5, 6, 10, 12]);
    const a = r(1, b - 1);
    const x: Fr = [a, b];
    const near = nearestBenchmark(x);
    if (!near) throw new Error("Need three tie");
    const others = BENCHMARKS.filter((m) => m !== near)
      .sort(
        (p, q) =>
          Math.abs(frVal(p.fr) - frVal(x)) - Math.abs(frVal(q.fr) - frVal(x)),
      )
      .slice(0, 3);
    return {
      variant,
      prompt: `Which benchmark is ${a}/${b} closest to: 0, 1/4, 1/2, 3/4 or 1?`,
      hint: `${a}/${b} is ${a} of ${b} equal parts. Compare it with 1/2 first: is it less than half, about half, or more than half? Then pick the nearer benchmark.`,
      explanation: [
        `${a}/${b} is about ${(a / b).toFixed(2)}.`,
        `The distance to ${near.label} is ${Math.abs(frVal(near.fr) - a / b).toFixed(2)}, less than the distance to any other benchmark, so ${a}/${b} is closest to ${near.label}.`,
      ],
      noLeakCheck: true,
      choices: choicesFrom(
        near.label,
        others.map((m) => ({
          label: m.label,
          feedback: `${a}/${b} is about ${(a / b).toFixed(2)}, which is ${Math.abs(frVal(m.fr) - a / b).toFixed(2)} away from ${m.label}. Another benchmark is nearer.`,
        })),
      ),
    };
  }
  if (variant === "denominator-check") {
    const b = pick(r, [8, 10, 12]);
    const a = r(Math.ceil(b / 2), b - 1);
    const c = r(Math.ceil(b / 2), b - 1);
    const wrong = `${a + c}/${2 * b}`;
    return {
      variant,
      prompt: `A student adds ${a}/${b} + ${c}/${b} and gets ${wrong}. Which statement uses benchmarks to show whether this answer is reasonable?`,
      hint: `Compare each addend with 1/2. If each is at least 1/2, what is the least their sum can be? Then compare ${wrong} with that.`,
      explanation: [
        `${a}/${b} and ${c}/${b} are each at least 1/2, because ${Math.ceil(b / 2)}/${b} = 1/2 and both numerators are at least ${Math.ceil(b / 2)}.`,
        `So the sum is at least 1/2 + 1/2 = 1.`,
        `${wrong} is less than 1, because ${a + c} < ${2 * b}. The denominators should not be added, so the answer is not reasonable.`,
      ],
      choices: choicesFrom(
        `Each fraction is at least 1/2, so the sum is at least 1, but ${wrong} is less than 1.`,
        [
          {
            label: `Each fraction is less than 1/2, so the sum is less than 1, and ${wrong} fits.`,
            feedback: `${a}/${b} and ${c}/${b} are each at least 1/2, so the sum cannot be less than 1.`,
          },
          {
            label: `Adding fractions with the same denominator doubles the denominator, so ${wrong} is reasonable.`,
            feedback: `Like fractions add numerators only: the denominator names the size of the parts, and it stays ${b}.`,
          },
          {
            label: `The sum of two fractions is always less than 1, so ${wrong} is reasonable.`,
            feedback: `Two fractions that are each at least 1/2 add to at least 1. Sums can be 1 or more.`,
          },
        ],
      ),
    };
  }
  const b = pick(r, [5, 6, 10, 12]);
  const a = r(1, b - 1);
  const c = r(1, b - 1);
  const subtract = variant === "estimate-difference";
  if (subtract && a <= c) throw new Error("Need three order");
  const na = nearestBenchmark([a, b]);
  const nc = nearestBenchmark([c, b]);
  if (!na || !nc) throw new Error("Need three tie");
  const e = subtract ? frSub(na.fr, nc.fr) : frAdd(na.fr, nc.fr);
  const exact = subtract ? frSub([a, b], [c, b]) : frAdd([a, b], [c, b]);
  const far = [fr(1), fr(3, 2), fr(2), fr(-1)]
    .map((d) => frAdd(e, d))
    .filter(
      (x) =>
        x[0] >= 0 && Math.abs(frVal(x) - frVal(exact)) >= 0.75 && !frEq(x, e),
    );
  const sign = subtract ? "−" : "+";
  return {
    variant,
    prompt: `Estimate ${a}/${b} ${sign} ${c}/${b} by replacing each fraction with the nearest of the benchmarks 0, 1/4, 1/2, 3/4 and 1. Which estimate is correct?`,
    hint: `Find the benchmark nearest ${a}/${b} and the one nearest ${c}/${b}. Then ${subtract ? "subtract" : "add"} the two benchmarks.`,
    explanation: [
      `${a}/${b} is nearest to ${na.label}, and ${c}/${b} is nearest to ${nc.label}.`,
      `${na.label} ${sign} ${nc.label} = ${frMixed(e)}.`,
      `The exact value, ${frText(exact)}, is close to this estimate.`,
    ],
    choices: choicesFrom(
      estimateText(e),
      far.map((x) => ({
        label: estimateText(x),
        feedback: `${a}/${b} is about ${na.label} and ${c}/${b} is about ${nc.label}. ${subtract ? "Their difference" : "Their sum"} is ${frMixed(e)}, not ${frMixed(x)}.`,
      })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 4.8.A Relative sizes of units                                           */
/* ---------------------------------------------------------------------- */

const art = (unit: string, capital: boolean) => {
  const word = /^[aeiou]/.test(unit) ? "an" : "a";
  return capital ? "A".concat(word.slice(1)) : word;
};
type Family = { kind: "length" | "weight" | "capacity"; units: string[] };
const FAMILIES: Family[] = [
  { kind: "length", units: ["millimeter", "centimeter", "meter", "kilometer"] },
  { kind: "length", units: ["inch", "foot", "yard", "mile"] },
  { kind: "weight", units: ["milligram", "gram", "kilogram"] },
  { kind: "weight", units: ["ounce", "pound", "ton"] },
  { kind: "capacity", units: ["milliliter", "liter"] },
  {
    kind: "capacity",
    units: ["fluid ounce", "cup", "pint", "quart", "gallon"],
  },
];
const CROSS: { big: string; small: string; kind: Family["kind"] }[] = [
  { big: "meter", small: "yard", kind: "length" },
  { big: "mile", small: "kilometer", kind: "length" },
  { big: "inch", small: "centimeter", kind: "length" },
  { big: "kilogram", small: "pound", kind: "weight" },
  { big: "ounce", small: "gram", kind: "weight" },
  { big: "liter", small: "quart", kind: "capacity" },
  { big: "gallon", small: "liter", kind: "capacity" },
];
const ANCHOR: Record<string, string> = {
  millimeter: "the thickness of a dime",
  centimeter: "the width of a fingertip",
  meter: "the height of a door knob",
  kilometer: "a 12-minute walk",
  inch: "the width of a thumb",
  foot: "the length of a ruler",
  yard: "the length of a baseball bat",
  mile: "a 20-minute walk",
  milligram: "a grain of salt",
  gram: "a paper clip",
  kilogram: "a large bottle of water",
  ounce: "a slice of bread",
  pound: "a loaf of bread",
  ton: "a small car",
  milliliter: "a few drops of water",
  liter: "a large water bottle",
  "fluid ounce": "two spoonfuls",
  cup: "a mug of milk",
  pint: "a small carton of cream",
  quart: "a carton of milk",
  gallon: "a jug of milk",
};
const MORE: Record<Family["kind"], (x: string, y: string) => string> = {
  length: (x, y) => `${art(x, true)} ${x} is longer than ${art(y, false)} ${y}.`,
  weight: (x, y) => `${art(x, true)} ${x} is heavier than ${art(y, false)} ${y}.`,
  capacity: (x, y) => `${art(x, true)} ${x} holds more than ${art(y, false)} ${y}.`,
};
const WORD: Record<Family["kind"], string> = {
  length: "length",
  weight: "weight",
  capacity: "capacity",
};
const OBJECT: Record<Family["kind"], string> = {
  length: "A ribbon",
  weight: "A bag of rice",
  capacity: "A pitcher of juice",
};

function unitRelativeSize(r: Random): Built {
  const variant = pick(r, [
    "which-larger",
    "cross-system",
    "greater-number",
    "order",
  ]);
  const fam = pick(r, FAMILIES);
  if (variant === "which-larger" || variant === "cross-system") {
    let truth: { big: string; small: string; kind: Family["kind"] };
    let falsePairs: { big: string; small: string; kind: Family["kind"] }[];
    if (variant === "which-larger") {
      const ordered = (f: Family) => {
        const i = r(0, f.units.length - 2);
        const j = r(i + 1, f.units.length - 1);
        return { big: f.units[j]!, small: f.units[i]!, kind: f.kind };
      };
      truth = ordered(fam);
      const sameKind = FAMILIES.filter((f) => f.kind === fam.kind);
      falsePairs = [
        ordered(pick(r, sameKind)),
        ordered(pick(r, sameKind)),
        ordered(fam),
      ];
    } else {
      truth = pick(r, CROSS);
      falsePairs = shuffle(
        r,
        CROSS.filter((c) => c !== truth),
      );
    }
    const correct = MORE[truth.kind](truth.big, truth.small);
    const wrong = [
      { big: truth.small, small: truth.big, kind: truth.kind },
      ...falsePairs.map((p) => ({ big: p.small, small: p.big, kind: p.kind })),
    ].map((p) => ({
      label: MORE[p.kind](p.big, p.small),
      feedback: `That is reversed: ${art(p.small, false)} ${p.small} is larger than ${art(p.big, false)} ${p.big}. Picture ${ANCHOR[p.small]!} and ${ANCHOR[p.big]!}.`,
    }));
    return {
      variant,
      prompt: `Which statement about the sizes of units is true?`,
      hint: `Picture each unit: ${art(truth.big, false)} ${truth.big} is about ${ANCHOR[truth.big]}, and ${art(truth.small, false)} ${truth.small} is about ${ANCHOR[truth.small]}. Then compare the two statements about ${truth.big} and ${truth.small}.`,
      explanation: [
        `${art(truth.big, true)} ${truth.big} is about ${ANCHOR[truth.big]}; ${art(truth.small, false)} ${truth.small} is about ${ANCHOR[truth.small]}.`,
        `So ${correct.charAt(0).toLowerCase()}${correct.slice(1)}`,
      ],
      choices: choicesFrom(correct, wrong),
    };
  }
  if (variant === "greater-number") {
    const i = r(0, fam.units.length - 2);
    const j = r(i + 1, fam.units.length - 1);
    const small = fam.units[i]!,
      big = fam.units[j]!;
    return {
      variant,
      prompt: `${OBJECT[fam.kind]} is measured twice, once in ${big}s and once in ${small}s. Which measurement has the greater number?`,
      hint: `${art(big, true)} ${big} is a bigger unit than ${art(small, false)} ${small}. Do you need more of the bigger unit or more of the smaller unit to measure the same amount?`,
      explanation: [
        `It takes more small units than large units to cover the same ${WORD[fam.kind]}.`,
        `${art(small, true)} ${small} is smaller than ${art(big, false)} ${big}, so the measurement in ${small}s has the greater number.`,
      ],
      choices: choicesFrom(`The measurement in ${small}s`, [
        {
          label: `The measurement in ${big}s`,
          feedback: `${art(big, true)} ${big} is a larger unit, so fewer of them are needed.`,
        },
        {
          label: `The two numbers are the same`,
          feedback: `The amount is the same, but the units are different sizes, so the numbers differ.`,
        },
        {
          label: `The measurement in ${big}s, because ${art(big, false)} ${big} is the larger unit`,
          feedback: `A larger unit gives a smaller number for the same amount.`,
        },
      ]),
    };
  }
  const orderFam =
    fam.units.length >= 3
      ? fam
      : pick(
          r,
          FAMILIES.filter((f) => f.kind === fam.kind && f.units.length >= 3),
        );
  const picked = shuffle(
    r,
    orderFam.units.map((_, i) => i),
  )
    .slice(0, 3)
    .sort((x, y) => x - y);
  const names = picked.map((i) => orderFam.units[i]!);
  const adjective =
    orderFam.kind === "length"
      ? "shortest to longest"
      : orderFam.kind === "weight"
        ? "lightest to heaviest"
        : "least to greatest capacity";
  const list = (xs: string[]) => xs.join(", ");
  const asc = list(names);
  const perms = [
    [2, 1, 0],
    [1, 0, 2],
    [0, 2, 1],
    [1, 2, 0],
    [2, 0, 1],
  ].map((p) => list(p.map((i) => names[i]!)));
  return {
    variant,
    prompt: `Which list orders these units from ${adjective}?`,
    hint: `Picture each unit: ${names.map((n) => `${art(n, false)} ${n} is about ${ANCHOR[n]}`).join("; ")}. Put the smallest first.`,
    explanation: [
      names.map((n) => `${art(n, false)} ${n} is about ${ANCHOR[n]}`).join("; ") + ".",
      `From smallest to largest: ${asc}.`,
    ],
    choices: choicesFrom(
      asc,
      perms.map((p) => ({
        label: p,
        feedback:
          p === list([...names].reverse())
            ? `That is largest to smallest. The question asks for smallest first.`
            : `Two of the units are in the wrong order. Compare each pair using what you can picture.`,
      })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 5.3.D, 5.3.F Decimal products and quotients with area models            */
/* ---------------------------------------------------------------------- */

const dec = (n: number, scale: number) =>
  String(Number((n / scale).toFixed(3)));
function decimalAreaModel(r: Random): Built {
  const variant = pick(r, [
    "product-from-grid",
    "sentence-from-grid",
    "divide-tenths",
    "divide-hundredths",
  ]);
  if (variant === "product-from-grid" || variant === "sentence-from-grid") {
    const a = r(2, 9),
      b = r(2, 9);
    const P = a * b;
    const shaded = [{ col: 0, row: 0, cols: b, rows: a }];
    const figure = (labels: boolean): SemanticFigure => ({
      kind: "scene",
      scene: hundredGrid(
        "One whole as a 10 by 10 grid with a shaded rectangle",
        shaded,
        labels
          ? [
              { text: `0.${b}`, at: [b / 2, -0.9] },
              { text: `0.${a}`, at: [-1.3, a / 2] },
            ]
          : [],
      ),
    });
    if (variant === "product-from-grid")
      return {
        variant,
        prompt: `The large square is 1 whole. The shaded rectangle is 0.${a} tall and 0.${b} wide. What is its area, 0.${a} × 0.${b}?`,
        hint: `Count the small squares in the shaded rectangle: ${a} rows of ${b}. Each small square is one hundredth of the whole.`,
        explanation: [
          `The shaded rectangle has ${a} rows of ${b} small squares, ${a} × ${b} = ${P} squares.`,
          `Each small square is 0.01 of the whole, so the area is ${P} hundredths = ${dec(P, 100)}.`,
        ],
        figure: figure(true),
        choices: choicesFrom(dec(P, 100), [
          {
            label: dec(P, 10),
            feedback: `Tenths of tenths are hundredths, not tenths. ${P} small squares is ${P} hundredths.`,
          },
          {
            label: dec(P, 1000),
            feedback: `Each small square is one hundredth, not one thousandth.`,
          },
          {
            label: dec(a + b, 10),
            feedback: `That adds 0.${a} + 0.${b}. Area comes from multiplying the two sides.`,
          },
        ]),
      };
    const b2 = b < 9 ? b + 1 : b - 1;
    return {
      variant,
      prompt: `The large square is 1 whole. Which multiplication sentence does the shaded part show?`,
      hint: `Count the rows and the columns of the shaded rectangle in tenths, then count how many hundredths it covers.`,
      explanation: [
        `The shaded part is ${a} tenths tall and ${b} tenths wide, so the sentence is 0.${a} × 0.${b}.`,
        `It covers ${a} × ${b} = ${P} hundredths, so 0.${a} × 0.${b} = ${dec(P, 100)}.`,
      ],
      figure: figure(false),
      choices: choicesFrom(`0.${a} × 0.${b} = ${dec(P, 100)}`, [
        {
          label: `0.${a} × 0.${b} = ${dec(P, 10)}`,
          feedback: `The shaded rectangle covers ${P} of the 100 small squares, which is ${dec(P, 100)}.`,
        },
        {
          label: `0.${a} × 0.${b2} = ${dec(a * b2, 100)}`,
          feedback: `Count the columns again: the shaded width is ${b} tenths, not ${b2}.`,
        },
        {
          label: `0.${a} + 0.${b} = ${dec(a + b, 10)}`,
          feedback: `The shaded part is a rectangle whose area is found by multiplying, not adding.`,
        },
      ]),
    };
  }
  const d = r(2, 8);
  const hundredths = variant === "divide-hundredths";
  const t = hundredths ? r(11, 29) : r(2, 9);
  if (hundredths && t % 10 === 0) throw new Error("Need three zero");
  const scale = hundredths ? 100 : 10;
  const A = d * t;
  const unit = hundredths ? "hundredths" : "tenths";
  return {
    variant,
    prompt: `An area model shows a rectangle with an area of ${dec(A, scale)} square units and a width of ${d} units. What is its height, ${dec(A, scale)} ÷ ${d}?`,
    hint: `Think of ${dec(A, scale)} as ${A} ${unit}. Share ${A} ${unit} equally across ${d} columns.`,
    explanation: [
      `${dec(A, scale)} is ${A} ${unit}.`,
      `${A} ${unit} ÷ ${d} = ${t} ${unit}, which is ${dec(t, scale)}.`,
      `Check: ${d} × ${dec(t, scale)} = ${dec(A, scale)}.`,
    ],
    choices: choicesFrom(dec(t, scale), [
      {
        label: dec(t, scale / 10),
        feedback: `That is ten times too large. ${A} ${unit} ÷ ${d} is ${t} ${unit}, which is ${dec(t, scale)}.`,
      },
      {
        label: dec(t, scale * 10),
        feedback: `That is ten times too small. Check ${d} × ${dec(t, scale * 10)}.`,
      },
      {
        label: dec(t + 1, scale),
        feedback: `Check by multiplying: ${d} × ${dec(t + 1, scale)} = ${dec(d * (t + 1), scale)}, not ${dec(A, scale)}.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.2.A, 7.2 Nested number sets                                           */
/* ---------------------------------------------------------------------- */

const SET_NAMES = [
  "natural numbers",
  "whole numbers",
  "integers",
  "rational numbers",
];
const SET_ONE = [
  "natural number",
  "whole number",
  "integer",
  "rational number",
];
const REGION_LETTERS = ["A", "B", "C", "D"];
const REGION_HOLDS = [
  "natural numbers: 1, 2, 3, and so on",
  "whole numbers that are not natural numbers: only 0",
  "integers that are not whole numbers: the negative integers",
  "rational numbers that are not integers: fractions and decimals between integers",
];
function nestedSetsScene(): Scene {
  const radii = [1.5, 3.1, 4.7, 6.3];
  const fills = ["accent-fill", "warm-fill", "gold-fill", "paper"] as const;
  const names = ["Natural", "Whole", "Integers", "Rational"];
  const els: Parameters<typeof scene>[0][] = [];
  for (let i = 3; i >= 0; i--)
    els.push({
      type: "circle",
      id: `set-${i}`,
      center: [0, 0],
      r: radii[i]!,
      fill: fills[i]!,
      stroke: "ink",
    });
  for (let i = 0; i < 4; i++) {
    const mid = i === 0 ? 0 : (radii[i - 1]! + radii[i]!) / 2;
    els.push({
      type: "text",
      id: `name-${i}`,
      at: i === 0 ? [0, 0.55] : [0, mid],
      text: names[i]!,
      size: "sm",
    });
    els.push({
      type: "text",
      id: `region-${i}`,
      at: i === 0 ? [0, -0.55] : [mid, 0],
      text: REGION_LETTERS[i]!,
      size: "md",
      bold: true,
    });
  }
  return scene(...els).build({
    title:
      "Nested sets: natural numbers inside whole numbers inside integers inside rational numbers, with regions A to D",
    width: 360,
    maxHeight: 360,
  });
}
const SET_ITEMS: { text: string; region: number; simplified?: string }[] = [
  ...["3", "8", "15", "27", "40"].map((text) => ({ text, region: 0 })),
  { text: "12/4", region: 0, simplified: "3" },
  { text: "20/5", region: 0, simplified: "4" },
  { text: "36/9", region: 0, simplified: "4" },
  { text: "0", region: 1 },
  ...[`${MINUS}2`, `${MINUS}7`, `${MINUS}15`, `${MINUS}24`].map((text) => ({
    text,
    region: 2,
  })),
  { text: `${MINUS}10/5`, region: 2, simplified: `${MINUS}2` },
  { text: `${MINUS}9/3`, region: 2, simplified: `${MINUS}3` },
  ...[
    "3/4",
    `${MINUS}2/5`,
    "5/8",
    "0.5",
    `${MINUS}1.25`,
    "2 1/2",
    `${MINUS}3/10`,
  ].map((text) => ({ text, region: 3 })),
];
const TRUE_SUBSET = [
  "Every natural number is a whole number.",
  "Every whole number is an integer.",
  "Every integer is a rational number.",
  "Every natural number is a rational number.",
];
const FALSE_SUBSET: [string, string][] = [
  [
    "Every whole number is a natural number.",
    "Zero is a whole number but not a natural number.",
  ],
  [
    "Every integer is a whole number.",
    `${MINUS}3 is an integer but not a whole number.`,
  ],
  [
    "Every rational number is an integer.",
    "1/2 is rational but not an integer.",
  ],
  ["Zero is a natural number.", "Natural numbers start at 1."],
  [
    "Every integer is a natural number.",
    `${MINUS}4 is an integer but not a natural number.`,
  ],
  [
    "Some negative integers are whole numbers.",
    "Whole numbers start at 0, so none are negative.",
  ],
];

function numberSetVenn(r: Random): Built {
  const variant = pick(r, ["place-number", "smallest-set", "subset-statement"]);
  const figure: SemanticFigure = { kind: "scene", scene: nestedSetsScene() };
  if (variant === "subset-statement") {
    const truth = pick(r, TRUE_SUBSET);
    const falses = shuffle(r, [...FALSE_SUBSET]).slice(0, 3);
    return {
      variant,
      prompt: `Use the diagram of nested sets. Which statement is true?`,
      hint: `In the diagram, a set inside another set is a subset. A statement "every X is a Y" is true only when the circle for X lies completely inside the circle for Y.`,
      explanation: [
        `The circles are nested: natural numbers inside whole numbers inside integers inside rational numbers.`,
        `${truth} The circle for the first set lies completely inside the circle for the second.`,
      ],
      figure,
      choices: choicesFrom(
        truth,
        falses.map(([label, feedback]) => ({ label, feedback })),
      ),
    };
  }
  const item = pick(r, SET_ITEMS);
  const k = item.region;
  const value = item.simplified
    ? ` Simplify first: ${item.text} = ${item.simplified}.`
    : "";
  if (variant === "place-number") {
    return {
      variant,
      prompt: `Regions A to D in the diagram of nested number sets are the rings between the circles. Which region holds ${item.text}?`,
      hint: `Region A holds natural numbers, B is whole but not natural, C is integers that are not whole, and D is rational numbers that are not integers. Decide which sets ${item.text} belongs to, then find the innermost one.${value}`,
      explanation: [
        `${item.text}${item.simplified ? ` = ${item.simplified}, which` : ""} is ${k === 3 ? "a rational number that is not an integer" : k === 2 ? "an integer that is not a whole number" : k === 1 ? "a whole number that is not a natural number" : "a natural number"}.`,
        `Region ${REGION_LETTERS[k]} holds ${REGION_HOLDS[k]}.`,
      ],
      figure,
      ordered: true,
      choices: REGION_LETTERS.map((letter, j) =>
        j === k
          ? { label: letter, correct: true as const }
          : {
              label: letter,
              feedback: `Region ${letter} holds ${REGION_HOLDS[j]}. ${item.text} is not in that region.`,
            },
      ),
      noLeakCheck: true,
    };
  }
  return {
    variant,
    prompt: `Use the diagram of nested number sets. What is the smallest of these sets that contains ${item.text}?`,
    hint: `Start with the innermost circle, natural numbers, and move outward until you reach the first set that holds ${item.text}.${value}`,
    explanation: [
      `${item.text} is in the set of ${SET_NAMES[k]}, and in every larger set.`,
      `No smaller set holds it, so the smallest set is ${SET_NAMES[k]}.`,
    ],
    figure,
    choices: SET_NAMES.map((name, j) =>
      j === k
        ? { label: name, correct: true as const }
        : {
            label: name,
            feedback:
              j < k
                ? `${item.text} is not a ${SET_ONE[j]}, so this set does not hold it.`
                : `${item.text} is in the ${name}, but a smaller set also holds it. The question asks for the smallest.`,
          },
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.3.A Dividing by a rational number                                     */
/* ---------------------------------------------------------------------- */

const PROPER: Fr[] = [
  fr(2, 3),
  fr(3, 4),
  fr(1, 2),
  fr(3, 5),
  fr(2, 5),
  fr(5, 6),
  fr(3, 8),
  fr(4, 7),
  fr(1, 3),
  fr(5, 8),
];
function reciprocalDivisionChoice(r: Random): Built {
  const variant = pick(r, [
    "whole-by-fraction",
    "fraction-by-fraction",
    "fraction-by-whole",
    "how-many-fit",
  ]);
  const d = pick(r, PROPER);
  const rec = (x: Fr): Fr => [x[1], x[0]];
  if (variant === "whole-by-fraction") {
    const w = r(2, 12);
    return {
      variant,
      prompt: `Which multiplication equals ${w} ÷ ${frText(d)}?`,
      hint: `Dividing by a fraction is the same as multiplying by its reciprocal, the fraction turned upside down. Which number do you flip: the divisor or the number being divided?`,
      explanation: [
        `The divisor is ${frText(d)}, and its reciprocal is ${frText(rec(d))}.`,
        `${w} ÷ ${frText(d)} = ${w} × ${frText(rec(d))}.`,
      ],
      choices: choicesFrom(`${w} × ${frText(rec(d))}`, [
        {
          label: `${w} × ${frText(d)}`,
          feedback: `That multiplies by the divisor. Dividing by ${frText(d)} multiplies by its reciprocal, ${frText(rec(d))}.`,
        },
        {
          label: `1/${w} × ${frText(rec(d))}`,
          feedback: `Only the divisor, ${frText(d)}, is flipped. ${w} stays as it is.`,
        },
        {
          label: `${w} ÷ ${frText(rec(d))}`,
          feedback: `That still divides, and by the reciprocal. To use the reciprocal, multiply.`,
        },
      ]),
    };
  }
  if (variant === "fraction-by-fraction") {
    let a = pick(r, PROPER);
    if (frEq(a, d)) a = fr(7, 9);
    return {
      variant,
      prompt: `Which multiplication equals ${frText(a)} ÷ ${frText(d)}?`,
      hint: `Only the fraction you divide by, ${frText(d)}, is replaced by its reciprocal, and the division sign becomes multiplication.`,
      explanation: [
        `The divisor ${frText(d)} has the reciprocal ${frText(rec(d))}.`,
        `${frText(a)} ÷ ${frText(d)} = ${frText(a)} × ${frText(rec(d))}.`,
      ],
      choices: choicesFrom(`${frText(a)} × ${frText(rec(d))}`, [
        {
          label: `${frText(a)} × ${frText(d)}`,
          feedback: `The divisor must be flipped. Dividing by ${frText(d)} is multiplying by ${frText(rec(d))}.`,
        },
        {
          label: `${frText(rec(a))} × ${frText(d)}`,
          feedback: `That flips the number being divided instead of the divisor.`,
        },
        {
          label: `${frText(rec(a))} × ${frText(rec(d))}`,
          feedback: `That flips both fractions. Only the divisor is flipped.`,
        },
      ]),
    };
  }
  if (variant === "fraction-by-whole") {
    const a = pick(r, PROPER);
    const w = r(2, 9);
    return {
      variant,
      prompt: `Which multiplication equals ${frText(a)} ÷ ${w}?`,
      hint: `A whole number is a fraction over 1, so ${w} is ${w}/1. What is its reciprocal?`,
      explanation: [
        `${w} = ${w}/1, so its reciprocal is 1/${w}.`,
        `${frText(a)} ÷ ${w} = ${frText(a)} × 1/${w}.`,
      ],
      choices: choicesFrom(`${frText(a)} × 1/${w}`, [
        {
          label: `${frText(a)} × ${w}`,
          feedback: `Multiplying by ${w} makes the amount larger. Dividing by ${w} multiplies by 1/${w}.`,
        },
        {
          label: `${frText(rec(a))} × 1/${w}`,
          feedback: `Only the divisor is flipped. ${frText(a)} stays as it is.`,
        },
        {
          label: `${frText(a)} ÷ 1/${w}`,
          feedback: `That divides by 1/${w}, which multiplies by ${w}.`,
        },
      ]),
    };
  }
  const w = r(2, 9);
  const things = pick(r, [
    ["cup of milk", "cups"],
    ["pound of flour", "pounds"],
    ["meter of ribbon", "meters"],
  ]);
  return {
    variant,
    prompt: `Each batch uses ${frText(d)} ${things[0]}. How many batches can be made from ${w} ${things[1]}? Which expression gives the answer?`,
    hint: `Ask how many groups of ${frText(d)} fit in ${w}. That is a division, and dividing by a fraction can be written as multiplying by its reciprocal.`,
    explanation: [
      `The number of batches is ${w} ÷ ${frText(d)}, the number of ${frText(d)}s in ${w}.`,
      `Dividing by ${frText(d)} is multiplying by ${frText(rec(d))}: ${w} × ${frText(rec(d))}.`,
    ],
    choices: choicesFrom(`${w} × ${frText(rec(d))}`, [
      {
        label: `${w} × ${frText(d)}`,
        feedback: `That gives the amount used in ${w} batches, not the number of batches.`,
      },
      {
        label: `${frText(d)} ÷ ${w}`,
        feedback: `That splits one batch's amount into ${w} parts. The question asks how many batches fit in ${w}.`,
      },
      {
        label: `${w} + ${frText(rec(d))}`,
        feedback: `Fitting groups into a total is division, so the reciprocal is multiplied, not added.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.3.B Multiplying by a fraction greater or less than 1                  */
/* ---------------------------------------------------------------------- */

const LESS: Fr[] = [
  fr(3, 4),
  fr(2, 3),
  fr(5, 6),
  fr(7, 8),
  fr(1, 2),
  fr(4, 5),
  fr(3, 5),
  fr(5, 9),
];
const MORE_F: Fr[] = [
  fr(5, 4),
  fr(3, 2),
  fr(7, 4),
  fr(9, 8),
  fr(4, 3),
  fr(11, 6),
  fr(7, 5),
  fr(8, 3),
];
function scalingDirectionChoice(r: Random): Built {
  const variant = pick(r, [
    "greater-than-start",
    "less-than-start",
    "statement",
  ]);
  const N = r(6, 48) * 2;
  if (variant !== "statement") {
    const greater = variant === "greater-than-start";
    const odd = shuffle(r, [...(greater ? MORE_F : LESS)])[0]!;
    const rest = shuffle(r, [...(greater ? LESS : MORE_F)]).slice(0, 3);
    const expr = (f: Fr) => `${N} × ${frText(f)}`;
    return {
      variant,
      prompt: `Without calculating, which product is ${greater ? "greater" : "less"} than ${N}?`,
      hint: `Compare each multiplier with 1. Multiplying by a number ${greater ? "greater" : "less"} than 1 gives a result ${greater ? "greater" : "less"} than the starting number.`,
      explanation: [
        `${frText(odd)} is ${greater ? "greater" : "less"} than 1, so ${expr(odd)} is ${greater ? "greater" : "less"} than ${N}.`,
        `The other multipliers are ${greater ? "less" : "greater"} than 1, so their products are ${greater ? "less" : "greater"} than ${N}.`,
      ],
      choices: choicesFrom(
        expr(odd),
        rest.map((f) => ({
          label: expr(f),
          feedback: `${frText(f)} is ${greater ? "less" : "greater"} than 1, so this product is ${greater ? "less" : "greater"} than ${N}.`,
        })),
      ),
    };
  }
  const kind = pick(r, ["less", "more", "equal"]);
  const f: Fr =
    kind === "less"
      ? pick(r, LESS)
      : kind === "more"
        ? pick(r, MORE_F)
        : (() => {
            const k = r(2, 9);
            return [k, k] as Fr;
          })();
  const label = kind === "equal" ? `${f[0]}/${f[1]}` : frText(f);
  const outcome =
    kind === "less" ? "Less" : kind === "more" ? "Greater" : "Equal to";
  const text = (o: string, why: string) => `${o} than ${N}, because ${why}`;
  const equalText = (why: string) => `Equal to ${N}, because ${why}`;
  const correct =
    kind === "equal"
      ? equalText(`${label} equals 1.`)
      : text(
          outcome,
          `${label} is ${kind === "less" ? "less" : "greater"} than 1.`,
        );
  const pool: { label: string; feedback: string }[] = [
    {
      label: text("Greater", "multiplying always makes a number greater."),
      feedback: `Multiplying by a number less than 1 makes a number smaller, and by a number greater than 1 makes it greater; it depends on the multiplier.`,
    },
    {
      label: text("Less", "multiplying always makes a number smaller."),
      feedback: `Multiplying by a number greater than 1 makes a number greater. Compare the multiplier with 1.`,
    },
    {
      label: equalText("multiplying by a fraction does not change the amount."),
      feedback: `Only a multiplier equal to 1 leaves the amount unchanged.`,
    },
    {
      label: text("Less", `${label} is a fraction.`),
      feedback: `Being a fraction is not what matters; an improper fraction such as 3/2 is greater than 1. Compare the multiplier with 1.`,
    },
    {
      label: text("Greater", `${label} is a fraction.`),
      feedback: `A fraction can be less than 1, equal to 1 or greater than 1. Compare the multiplier with 1.`,
    },
  ];
  return {
    variant,
    prompt: `Without calculating, how does ${label} × ${N} compare with ${N}?`,
    hint: `Compare the multiplier ${label} with 1. Is it less than 1, equal to 1, or greater than 1?`,
    explanation: [
      `${label} is ${kind === "less" ? "less than" : kind === "more" ? "greater than" : "equal to"} 1.`,
      kind === "equal"
        ? `Multiplying by 1 does not change ${N}, so the product equals ${N}.`
        : `Multiplying by a number ${kind === "less" ? "less" : "greater"} than 1 gives a result ${kind === "less" ? "less" : "greater"} than ${N}.`,
    ],
    choices: choicesFrom(correct, pool),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.4.E-G, 6.5.B-C Percent grids, conversions and parts                   */
/* ---------------------------------------------------------------------- */

const trimNum = (x: number) => String(Number(x.toFixed(2)));
const exactDec = (x: number) => String(Number(x.toFixed(6)));
function percentGridModel(r: Random): Built {
  const variant = pick(r, ["grid-percent", "grid-fraction", "grid-decimal"]);
  let k = r(4, 96);
  if (variant === "grid-fraction")
    k = pick(
      r,
      [5, 10, 12, 15, 20, 24, 25, 30, 32, 35, 40, 45, 48, 60, 64, 75, 80, 85],
    );
  const figure: SemanticFigure = {
    kind: "scene",
    scene: hundredGrid(
      `A 10 by 10 grid with ${k} of 100 squares shaded`,
      percentShading(k),
    ),
  };
  const hint = `The grid has 100 equal squares, so a percent is the number of shaded squares. Count the full columns of 10 and then the extra squares.`;
  if (variant === "grid-percent")
    return {
      variant,
      prompt: `What percent of the grid is shaded?`,
      hint,
      explanation: [
        `The grid has 100 squares and ${k} are shaded.`,
        `${k} out of 100 is ${k}%.`,
      ],
      figure,
      choices: choicesFrom(`${k}%`, [
        {
          label: `${100 - k}%`,
          feedback: `${100 - k} squares are not shaded. The question asks about the shaded part.`,
        },
        {
          label: `${trimNum(k / 10)}%`,
          feedback: `Percent means out of 100 squares, so the count is already the percent.`,
        },
        {
          label: `${trimNum(k / 100)}%`,
          feedback: `${k} of 100 squares is ${k} percent, not ${trimNum(k / 100)} percent.`,
        },
      ]),
    };
  if (variant === "grid-fraction") {
    const g = gcd(k, 100);
    const n = k / g,
      dd = 100 / g;
    return {
      variant,
      prompt: `What fraction of the grid is shaded? Give the fraction in simplest form.`,
      hint,
      explanation: [
        `${k} of the 100 squares are shaded, so the fraction is ${k}/100.`,
        `Divide the top and bottom by ${g}: ${k}/100 = ${n}/${dd}.`,
      ],
      figure,
      choices: choicesFrom(`${n}/${dd}`, [
        {
          label: `${k}/10`,
          feedback: `The whole grid is 100 squares, not 10.`,
        },
        { label: `${100 - k}/100`, feedback: `That is the unshaded part.` },
        {
          label: `${dd}/${n}`,
          feedback: `That turns the fraction upside down. The shaded part is less than the whole.`,
        },
      ]),
    };
  }
  return {
    variant,
    prompt: `What decimal names the shaded part of the grid?`,
    hint,
    explanation: [
      `${k} of 100 squares are shaded, so the part is ${k} hundredths.`,
      `${k} hundredths is ${dec(k, 100)}.`,
    ],
    figure,
    choices: choicesFrom(dec(k, 100), [
      {
        label: dec(k, 10),
        feedback: `${dec(k, 10)} would be ${k} tenths. Each square is one hundredth.`,
      },
      {
        label: dec(k, 1000),
        feedback: `${dec(k, 1000)} would be ${k} thousandths. Each square is one hundredth.`,
      },
      { label: dec(100 - k, 100), feedback: `That is the unshaded part.` },
    ]),
  };
}

const WHOLE_CONTEXTS = [
  (name: string, part: number, p: number) =>
    `${name} has saved ${part} dollars, which is ${p}% of the goal. What is the goal, in dollars?`,
  (name: string, part: number, p: number) =>
    `${name} has read ${part} pages, which is ${p}% of the book. How many pages are in the book?`,
  (name: string, part: number, p: number) =>
    `${part} students are on the team, which is ${p}% of the grade. How many students are in the grade?`,
];
function percentFormsAndParts(r: Random): Built {
  const variant = pick(r, [
    "fraction-to-percent",
    "decimal-to-percent",
    "percent-to-fraction",
    "find-whole",
    "find-percent",
  ]);
  if (variant === "fraction-to-percent") {
    const d = pick(r, [2, 4, 5, 8, 20, 25, 40, 50]);
    const n = r(1, d - 1);
    if (gcd(n, d) !== 1) throw new Error("Need three reduced");
    const p = (n * 100) / d;
    return {
      variant,
      prompt: `Write ${n}/${d} as a percent. Enter the number without the percent sign.`,
      hint: `A percent is a number out of 100. Divide ${n} by ${d}, then multiply by 100, or rewrite ${n}/${d} with a denominator of 100.`,
      explanation: [
        `${n} ÷ ${d} = ${exactDec(n / d)}.`,
        `${exactDec(n / d)} × 100 = ${trimNum(p)}, so ${n}/${d} = ${trimNum(p)}%.`,
      ],
      answer: trimNum(p),
      responseLabel: "Percent",
    };
  }
  if (variant === "decimal-to-percent") {
    const x = pick(
      r,
      [0.6, 0.35, 0.08, 0.375, 1.25, 0.045, 0.9, 0.125, 2.4, 0.72],
    );
    const p = Math.round(x * 100000) / 1000;
    return {
      variant,
      prompt: `Write ${x} as a percent. Enter the number without the percent sign.`,
      hint: `Percent means per 100, so multiply the decimal by 100, which moves the decimal point two places to the right.`,
      explanation: [`${x} × 100 = ${trimNum(p)}.`, `So ${x} = ${trimNum(p)}%.`],
      answer: trimNum(p),
      responseLabel: "Percent",
    };
  }
  if (variant === "percent-to-fraction") {
    const p = pick(r, [35, 60, 12, 45, 64, 15, 85, 24, 55, 36]);
    const g = gcd(p, 100);
    const n = p / g,
      dd = 100 / g;
    return {
      variant,
      prompt: `Which fraction in simplest form equals ${p}%?`,
      hint: `${p}% means ${p} out of 100. Write it as a fraction with denominator 100, then divide the top and bottom by their greatest common factor.`,
      explanation: [
        `${p}% = ${p}/100.`,
        `The greatest common factor of ${p} and 100 is ${g}, so ${p}/100 = ${n}/${dd}.`,
      ],
      choices: choicesFrom(`${n}/${dd}`, [
        {
          label: `${p}/10`,
          feedback: `Percent means out of 100, not out of 10.`,
        },
        {
          label: `1/${p}`,
          feedback: `${p}% is ${p} out of 100, not one out of ${p}.`,
        },
        {
          label: `${p}/1000`,
          feedback: `Percent means out of 100, not out of 1,000.`,
        },
        {
          label: `${dd}/${n}`,
          feedback: `That turns the fraction upside down.`,
        },
      ]),
    };
  }
  if (variant === "find-whole") {
    const p = pick(r, [10, 20, 25, 30, 40, 50, 60, 75, 80]);
    const W = 20 * r(2, 15);
    const part = (p * W) / 100;
    const name = pick(r, NAMES);
    return {
      variant,
      prompt: pick(r, WHOLE_CONTEXTS)(name, part, p),
      hint: `${p}% of the whole is ${part}. Find what 1% is by dividing ${part} by ${p}, or use ${p}% as a fraction and undo it.`,
      explanation: [
        `${p}% of the whole is ${part}.`,
        `1% is ${part} ÷ ${p} = ${exactDec(part / p)}.`,
        `The whole is 100% = ${exactDec(part / p)} × 100 = ${W}.`,
      ],
      answer: String(W),
      responseLabel: "The whole",
    };
  }
  const whole = pick(r, [8, 20, 25, 40, 50, 80, 200]);
  const part = r(1, whole - 1);
  const p = (part * 100) / whole;
  const name = pick(r, NAMES);
  return {
    variant,
    prompt: `${name} got ${part} of ${whole} questions right. What percent of the questions is that? Enter the number without the percent sign.`,
    hint: `The part is ${part} and the whole is ${whole}. Write the part over the whole as a fraction, change it to a decimal, then to a percent.`,
    explanation: [
      `The fraction right is ${part}/${whole} = ${exactDec(part / whole)}.`,
      `${exactDec(part / whole)} × 100 = ${trimNum(p)}, so ${trimNum(p)}% were right.`,
    ],
    answer: trimNum(p),
    responseLabel: "Percent",
  };
}

/* ---------------------------------------------------------------------- */
/* 6.6.A Independent and dependent quantities                              */
/* ---------------------------------------------------------------------- */

const ROLE_CONTEXTS = [
  {
    indep: "number of tickets",
    dep: "total cost",
    inH: "Tickets",
    outH: "Cost ($)",
    mults: [6, 8, 9, 12],
  },
  {
    indep: "minutes on a call",
    dep: "cost of the call",
    inH: "Minutes",
    outH: "Cost ($)",
    mults: [2, 3, 5],
  },
  {
    indep: "hours worked",
    dep: "pay earned",
    inH: "Hours",
    outH: "Pay ($)",
    mults: [9, 12, 15],
  },
  {
    indep: "days since planting",
    dep: "height of the plant",
    inH: "Days",
    outH: "Height (cm)",
    mults: [2, 3, 4],
  },
  {
    indep: "gallons of gas",
    dep: "amount paid",
    inH: "Gallons",
    outH: "Cost ($)",
    mults: [3, 4],
  },
  {
    indep: "hours driven",
    dep: "distance traveled",
    inH: "Hours",
    outH: "Miles",
    mults: [45, 50, 60],
  },
  {
    indep: "weeks of saving",
    dep: "total savings",
    inH: "Weeks",
    outH: "Savings ($)",
    mults: [15, 20, 25],
  },
  {
    indep: "side length of a square",
    dep: "perimeter of the square",
    inH: "Side (cm)",
    outH: "Perimeter (cm)",
    mults: [4],
  },
];
function independentDependentRoles(r: Random): Built {
  const variant = pick(r, [
    "independent-from-table",
    "dependent-from-table",
    "which-depends",
    "horizontal-axis",
  ]);
  const c = pick(r, ROLE_CONTEXTS);
  const m = pick(r, c.mults);
  const xs = [1, 2, 3, 4];
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      id: "t",
      corner: c.inH,
      columns: [c.outH],
      rows: xs.map((x) => ({ label: String(x), cells: [x * m] })),
    }).scene({ title: `${c.outH} for each value of ${c.inH}` }),
  };
  const I = `The ${c.indep}`,
    D = `The ${c.dep}`;
  const rule = `${D} changes when ${I.toLowerCase()} changes, so ${I.toLowerCase()} is the independent quantity and ${D.toLowerCase()} is the dependent quantity.`;
  const common = {
    hint: `Ask which quantity you choose or set first, and which quantity's value is then determined by it.`,
    explanation: [
      `The ${c.dep} is determined by the ${c.indep}: each value of the ${c.indep} gives one ${c.dep}.`,
      `So the ${c.indep} is the independent quantity and the ${c.dep} is the dependent quantity.`,
    ],
    figure,
  };
  if (
    variant === "independent-from-table" ||
    variant === "dependent-from-table"
  ) {
    const ind = variant === "independent-from-table";
    return {
      variant,
      prompt: `The table shows the ${c.dep} for different values of the ${c.indep}. Which is the ${ind ? "independent" : "dependent"} quantity?`,
      ...common,
      choices: choicesFrom(ind ? I : D, [
        {
          label: ind ? D : I,
          feedback: `${ind ? D : I} is the ${ind ? "dependent" : "independent"} quantity: ${ind ? "its value is determined by the other quantity" : "the other quantity's value is determined by it"}.`,
        },
        {
          label: "Both quantities",
          feedback: `In a relationship like this, one quantity determines the other, so they play different roles.`,
        },
        {
          label: "Neither quantity",
          feedback: `Every relationship like this has an independent quantity and a dependent quantity.`,
        },
      ]),
    };
  }
  if (variant === "horizontal-axis")
    return {
      variant,
      prompt: `The pairs in the table are graphed as points. Which quantity is on the horizontal axis?`,
      hint: `The independent quantity goes on the horizontal axis. Decide which quantity is set first and determines the other.`,
      explanation: [
        `The ${c.dep} depends on the ${c.indep}, so the ${c.indep} is the independent quantity.`,
        `The independent quantity goes on the horizontal axis.`,
      ],
      figure,
      choices: choicesFrom(I, [
        {
          label: D,
          feedback: `The dependent quantity goes on the vertical axis.`,
        },
        {
          label: "Either one; the choice does not matter",
          feedback: `By convention the independent quantity is on the horizontal axis and the dependent quantity is on the vertical axis.`,
        },
        {
          label: "The one with the larger numbers",
          feedback: `Which axis a quantity uses depends on its role, not on how large its values are.`,
        },
      ]),
    };
  return {
    variant,
    prompt: `Which statement about the table is true?`,
    ...common,
    choices: choicesFrom(rule, [
      {
        label: `${I} changes when ${D.toLowerCase()} changes, so ${D.toLowerCase()} is the independent quantity.`,
        feedback: `The roles are reversed. The ${c.dep} depends on the ${c.indep}.`,
      },
      {
        label: `Both quantities are independent because both are numbers in the table.`,
        feedback: `Both are numbers, but one determines the other.`,
      },
      {
        label: `The first column is always dependent because it is listed first.`,
        feedback: `Order in a table does not decide the roles. Ask which quantity determines the other.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.7.B Expressions and equations                                         */
/* ---------------------------------------------------------------------- */

const EXPRESSION_FORMS: ((r: Random) => string)[] = [
  (r) => `${r(2, 9)}${pick(r, ["x", "n", "y"])} + ${r(2, 9)}`,
  (r) => `${r(2, 9)}${pick(r, ["x", "n", "y"])} − ${r(2, 9)}`,
  (r) => `${r(2, 6)}(${pick(r, ["x", "n", "y"])} + ${r(2, 9)})`,
  (r) => `${r(2, 9)} × ${r(2, 9)} + ${r(2, 9)}`,
  (r) => `${r(10, 40)} − ${r(2, 9)} × ${r(2, 5)}`,
  (r) => `${r(2, 9)}${pick(r, ["a", "b", "m"])}`,
];
const EQUATION_FORMS: ((r: Random) => string)[] = [
  (r) => `${r(2, 9)}${pick(r, ["x", "n", "y"])} + ${r(2, 9)} = ${r(10, 40)}`,
  (r) => `${r(2, 9)}${pick(r, ["a", "b", "m"])} = ${r(10, 60)}`,
  (r) => `${r(2, 6)}(${pick(r, ["x", "n", "y"])} − ${r(2, 9)}) = ${r(10, 40)}`,
  (r) => `${pick(r, ["x", "n", "y"])} + ${r(2, 9)} = ${r(10, 40)}`,
  (r) => `${r(2, 9)} + ${r(2, 9)} = ${r(10, 20)}`,
  (r) => `${r(10, 40)} − ${r(2, 9)} = ${r(5, 40)}`,
];
const PHRASES: ((r: Random) => string)[] = [
  (r) => `the sum of ${r(2, 9)} and a number`,
  (r) => `${r(2, 9)} less than twice a number`,
  (r) => `the product of ${r(2, 9)} and a number`,
  (r) => `a number divided by ${r(2, 9)}`,
  (r) => `${r(2, 9)} more than a number`,
];
function expressionOrEquation(r: Random): Built {
  const variant = pick(r, [
    "pick-equation",
    "pick-expression",
    "verbal",
    "numeric",
  ]);
  const distinct = (forms: ((r: Random) => string)[], n: number) => {
    const out = new Set<string>();
    let guard = 0;
    while (out.size < n && guard++ < 60) out.add(pick(r, forms)(r));
    if (out.size < n) throw new Error("Need three items");
    return [...out];
  };
  const noSign = `It has no equal sign, so it is an expression: a phrase for a value, not a statement that two things are equal.`;
  const sign = `It has an equal sign, so it is an equation: a statement that two quantities are equal.`;
  if (variant === "verbal") {
    const phrases = distinct(PHRASES, 4);
    const eq = phrases[0]!;
    const equationText = `${eq} is ${r(10, 40)}`;
    return {
      variant,
      prompt: `Which phrase describes an equation?`,
      hint: `An equation says two quantities are equal, using a word such as "is" or "equals". An expression only names a quantity.`,
      explanation: [
        `"${equationText}" says that a quantity is equal to a number, so it describes an equation.`,
        `The other phrases only name a quantity, so they describe expressions.`,
      ],
      choices: choicesFrom(
        equationText,
        phrases.slice(1).map((p) => ({
          label: p,
          feedback: `"${p}" names a quantity but does not say it equals anything, so it describes an expression.`,
        })),
      ),
    };
  }
  if (variant === "pick-expression") {
    const exprs = distinct(EXPRESSION_FORMS, 1);
    const eqs = distinct(
      variant === "pick-expression" ? EQUATION_FORMS : EQUATION_FORMS,
      3,
    );
    return {
      variant,
      prompt: `Which of these is an expression, not an equation?`,
      hint: `Look for an equal sign. An expression is a mathematical phrase without one; an equation sets two quantities equal.`,
      explanation: [
        `${exprs[0]} has no equal sign, so it is an expression.`,
        `The others each have an equal sign, so they are equations.`,
      ],
      choices: choicesFrom(
        exprs[0]!,
        eqs.map((e) => ({
          label: e,
          feedback: `${sign} It is an equation even if it is not true.`,
        })),
      ),
    };
  }
  const exprs =
    variant === "numeric"
      ? distinct([EXPRESSION_FORMS[3]!, EXPRESSION_FORMS[4]!], 3)
      : distinct(EXPRESSION_FORMS.slice(0, 3).concat(EXPRESSION_FORMS[5]!), 3);
  const eq =
    variant === "numeric"
      ? `${r(2, 9)} × ${r(2, 9)} = ${r(10, 80)}`
      : distinct(EQUATION_FORMS.slice(0, 4), 1)[0]!;
  return {
    variant,
    prompt: `Which of these is an equation, not an expression?`,
    hint: `Look for an equal sign. An equation sets two quantities equal; an expression has no equal sign.${variant === "numeric" ? " An equation is still an equation if it is false." : ""}`,
    explanation: [
      `${eq} has an equal sign, so it is an equation.`,
      `The others have no equal sign, so they are expressions.`,
    ],
    choices: choicesFrom(
      eq,
      exprs.map((e) => ({ label: e, feedback: noSign })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 6.8.C Equations for area and volume with rational dimensions            */
/* ---------------------------------------------------------------------- */

const DIMS: Fr[] = [
  fr(3, 2),
  fr(5, 2),
  fr(7, 2),
  fr(9, 4),
  fr(5, 4),
  fr(3, 4),
  fr(2),
  fr(3),
  fr(4),
  fr(7, 4),
  fr(5, 3),
  fr(9, 2),
];
const HALF: Fr = fr(1, 2);
function rationalAreaVolumeEquation(r: Random): Built {
  const variant = pick(r, [
    "triangle-height",
    "triangle-base",
    "rectangle-width",
    "prism-height",
  ]);
  const dims = shuffle(r, [...DIMS]);
  const f = frMixed;
  type Option = { text: string; sol: Fr };
  const build = (
    prompt: string,
    hint: string,
    explanation: string[],
    correct: Option,
    wrong: { o: Option; feedback: string }[],
  ): Built => {
    for (const w of wrong)
      if (frEq(w.o.sol, correct.sol)) throw new Error("Need three solutions");
    return {
      variant,
      prompt,
      hint,
      explanation,
      choices: choicesFrom(
        correct.text,
        wrong.map((w) => ({ label: w.o.text, feedback: w.feedback })),
      ),
    };
  };
  if (variant === "triangle-height" || variant === "triangle-base") {
    const known = dims[0]!,
      unknown = dims[1]!;
    const A = frMul(frMul(HALF, known), unknown);
    const u = variant === "triangle-height" ? "h" : "b";
    const k = variant === "triangle-height" ? "base" : "height";
    const uname = variant === "triangle-height" ? "height" : "base";
    const t = (rest: string) => rest;
    const correct: Option = {
      text: t(`1/2 × ${f(known)} × ${u} = ${f(A)}`),
      sol: unknown,
    };
    return build(
      `A triangular banner has an area of ${f(A)} square feet and a ${k} of ${f(known)} feet. Which equation can be used to find its ${uname}, ${u}, in feet?`,
      `The area of a triangle is one half of its base times its height. Write that with the ${k} ${f(known)} and the area ${f(A)}, and leave ${u} as the unknown.`,
      [
        `Area of a triangle = 1/2 × base × height.`,
        `With the ${k} ${f(known)} and area ${f(A)}: 1/2 × ${f(known)} × ${u} = ${f(A)}.`,
      ],
      correct,
      [
        {
          o: { text: `${f(known)} × ${u} = ${f(A)}`, sol: frDiv(A, known) },
          feedback: `That is the area of a rectangle. A triangle's area is half of base times height.`,
        },
        {
          o: {
            text: `1/2 × (${f(known)} + ${u}) = ${f(A)}`,
            sol: frSub(frMul(fr(2), A), known),
          },
          feedback: `Base and height are multiplied, not added.`,
        },
        {
          o: {
            text: `1/2 × ${f(known)} + ${u} = ${f(A)}`,
            sol: frSub(A, frMul(HALF, known)),
          },
          feedback: `The half applies to the whole product base × height, and ${u} is multiplied, not added.`,
        },
      ],
    );
  }
  if (variant === "rectangle-width") {
    const L = dims[0]!,
      W = dims[1]!;
    const A = frMul(L, W);
    return build(
      `A rectangular garden has an area of ${f(A)} square meters and a length of ${f(L)} meters. Which equation can be used to find its width, w, in meters?`,
      `The area of a rectangle is its length times its width. Write that with the length ${f(L)} and the area ${f(A)}, and leave w as the unknown.`,
      [
        `Area of a rectangle = length × width.`,
        `With the length ${f(L)} and area ${f(A)}: ${f(L)} × w = ${f(A)}.`,
      ],
      { text: `${f(L)} × w = ${f(A)}`, sol: W },
      [
        {
          o: { text: `${f(L)} + w = ${f(A)}`, sol: frSub(A, L) },
          feedback: `Area comes from multiplying length and width, not adding them.`,
        },
        {
          o: {
            text: `2 × ${f(L)} + 2 × w = ${f(A)}`,
            sol: frSub(frMul(HALF, A), L),
          },
          feedback: `That is the perimeter. The area is length times width.`,
        },
        {
          o: { text: `${f(L)} ÷ w = ${f(A)}`, sol: frDiv(L, A) },
          feedback: `The area is the product ${f(L)} × w, not the quotient ${f(L)} ÷ w.`,
        },
      ],
    );
  }
  const L = dims[0]!,
    W = dims[1]!,
    H = dims[2]!;
  const V = frMul(frMul(L, W), H);
  const LW = frMul(L, W);
  return build(
    `A fish tank shaped like a rectangular prism has a length of ${f(L)} feet, a width of ${f(W)} feet and a volume of ${f(V)} cubic feet. Which equation can be used to find its height, h, in feet?`,
    `The volume of a rectangular prism is length times width times height. Write that with the two known edges and the volume ${f(V)}, and leave h as the unknown.`,
    [
      `Volume of a rectangular prism = length × width × height.`,
      `With the length ${f(L)}, width ${f(W)} and volume ${f(V)}: ${f(L)} × ${f(W)} × h = ${f(V)}.`,
    ],
    { text: `${f(L)} × ${f(W)} × h = ${f(V)}`, sol: H },
    [
      {
        o: {
          text: `${f(L)} + ${f(W)} + h = ${f(V)}`,
          sol: frSub(V, frAdd(L, W)),
        },
        feedback: `Volume comes from multiplying the three edges, not adding them.`,
      },
      {
        o: { text: `${f(L)} × ${f(W)} + h = ${f(V)}`, sol: frSub(V, LW) },
        feedback: `The height multiplies the base area ${f(L)} × ${f(W)}; it is not added to it.`,
      },
      {
        o: {
          text: `2 × (${f(L)} × ${f(W)} + ${f(L)} × h + ${f(W)} × h) = ${f(V)}`,
          sol: frDiv(frSub(frMul(HALF, V), LW), frAdd(L, W)),
        },
        feedback: `That is the surface area. Volume is length × width × height.`,
      },
    ],
  );
}

/* ---------------------------------------------------------------------- */
/* 6.12.D Categorical summaries                                            */
/* ---------------------------------------------------------------------- */

const CATEGORY_SETS = [
  {
    title: "favorite pet",
    head: "Pet",
    cats: ["Dog", "Cat", "Fish", "Bird", "Rabbit"],
  },
  {
    title: "favorite lunch",
    head: "Lunch",
    cats: ["Pizza", "Salad", "Tacos", "Soup", "Pasta"],
  },
  {
    title: "favorite sport",
    head: "Sport",
    cats: ["Soccer", "Tennis", "Swimming", "Baseball", "Hockey"],
  },
  {
    title: "favorite color",
    head: "Color",
    cats: ["Blue", "Green", "Red", "Purple", "Yellow"],
  },
];
function categoricalSummary(r: Random): Built {
  const variant = pick(r, ["mode", "relative-frequency", "percent-bar-count"]);
  const set = pick(r, CATEGORY_SETS);
  const cats = shuffle(r, [...set.cats]).slice(0, 4);
  if (variant === "percent-bar-count") {
    const total = pick(r, [40, 60, 80, 100, 120, 200]);
    const percents = pick(r, [
      [40, 35, 25],
      [50, 30, 20],
      [45, 30, 25],
      [25, 25, 50],
      [60, 25, 15],
      [35, 40, 25],
    ]);
    const askIdx = r(0, 2);
    const names = cats.slice(0, 3);
    const count = (percents[askIdx]! * total) / 100;
    return {
      variant,
      prompt: `A percent bar shows the ${set.title} of ${total} students, from left to right: ${names.join(", ")}. How many students chose ${names[askIdx]}?`,
      hint: `The bar shows percents of ${total} students. Find ${names[askIdx]}'s part of the bar, then take that percent of ${total}.`,
      explanation: [
        `${names[askIdx]} is ${percents[askIdx]}% of the ${total} students.`,
        `${percents[askIdx]}% of ${total} = ${percents[askIdx]! / 100} × ${total} = ${count}.`,
      ],
      figure: {
        kind: "scene",
        scene: stripScene(
          `A percent bar of ${total} students: ${percents.map((p, i) => `${names[i]} ${p}%`).join(", ")}`,
          null,
          percents.map((p) => ({ label: `${p}%`, size: p / 10 })),
          ["accent-fill", "warm-fill", "gold-fill"],
        ),
      },
      answer: String(count),
      responseLabel: "Students",
      noLeakCheck: true,
    };
  }
  const total = pick(r, [20, 25, 40, 50]);
  // Four counts that sum to the total with a single greatest count.
  let counts: number[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const cuts = [r(1, total - 3), r(1, total - 3), r(1, total - 3)].sort(
      (a, b) => a - b,
    );
    const cs = [
      cuts[0]!,
      cuts[1]! - cuts[0]!,
      cuts[2]! - cuts[1]!,
      total - cuts[2]!,
    ];
    if (cs.every((c) => c >= 1) && new Set(cs).size === 4) {
      counts = cs;
      break;
    }
  }
  if (!counts.length) throw new Error("Need three counts");
  const figure: SemanticFigure = {
    kind: "scene",
    scene: table({
      id: "t",
      corner: set.head,
      columns: ["Students"],
      rows: cats.map((c, i) => ({ label: c, cells: [counts[i]!] })),
    }).scene({ title: `Students by ${set.title}` }),
  };
  if (variant === "mode") {
    const top = Math.max(...counts);
    const mode = cats[counts.indexOf(top)]!;
    return {
      variant,
      prompt: `The table shows the ${set.title} of ${total} students. Which category is the mode?`,
      hint: `The mode of categorical data is the category that occurs most often. Compare the counts in the table.`,
      explanation: [
        `The counts are ${cats.map((c, i) => `${c} ${counts[i]}`).join(", ")}.`,
        `${mode} has the greatest count, ${top}, so ${mode} is the mode.`,
      ],
      figure,
      choices: choicesFrom(
        mode,
        cats
          .filter((c) => c !== mode)
          .map((c) => ({
            label: c,
            feedback:
              c === cats[0]
                ? `${c} is listed first but has ${counts[cats.indexOf(c)]}, fewer than ${mode}'s ${top}. The mode is the most frequent category, not the first one listed.`
                : `${c} has ${counts[cats.indexOf(c)]} students, fewer than ${mode}'s ${top}.`,
          })),
      ),
    };
  }
  const idx = r(0, 3);
  const p = (counts[idx]! * 100) / total;
  return {
    variant,
    prompt: `The table shows the ${set.title} of ${total} students. What percent of the students chose ${cats[idx]}? Enter the number without the percent sign.`,
    hint: `The relative frequency of a category is its count divided by the total, ${total}. Then write the result as a percent.`,
    explanation: [
      `${cats[idx]} was chosen by ${counts[idx]} of ${total} students.`,
      `${counts[idx]} ÷ ${total} = ${exactDec(counts[idx]! / total)}, which is ${trimNum(p)}%.`,
    ],
    figure,
    answer: trimNum(p),
    responseLabel: "Percent",
  };
}

/* ---------------------------------------------------------------------- */
/* 6.14.C Check register                                                   */
/* ---------------------------------------------------------------------- */

type Entry = { name: string; cents: number };
function checkRegisterBalance(r: Random): Built {
  const variant = pick(r, [
    "final-balance",
    "final-with-transfer-and-fee",
    "missing-amount",
  ]);
  let balance = r(150, 900) * 100 + r(0, 99);
  const start = balance;
  const entries: Entry[] = [];
  const addEntry = (kind: "deposit" | "check" | "transfer" | "fee") => {
    const checkNo =
      101 + entries.filter((e) => e.name.startsWith("Check")).length;
    let cents = r(1500, 12000) + r(0, 99);
    if (kind === "fee") cents = pick(r, [300, 500, 750, 1200]);
    if (kind !== "deposit" && cents >= balance - 1000)
      cents = Math.max(100, Math.floor((balance - 1000) / 2));
    entries.push({
      name:
        kind === "deposit"
          ? "Deposit"
          : kind === "check"
            ? `Check ${checkNo}`
            : kind === "transfer"
              ? "Transfer out"
              : "Monthly fee",
      cents: kind === "deposit" ? cents : -cents,
    });
    balance += kind === "deposit" ? cents : -cents;
  };
  const plan: ("deposit" | "check" | "transfer" | "fee")[] =
    variant === "final-with-transfer-and-fee"
      ? shuffle<"deposit" | "check" | "transfer" | "fee">(r, [
          "deposit",
          "check",
          "transfer",
          "fee",
        ])
      : shuffle<"deposit" | "check" | "transfer" | "fee">(r, [
          "deposit",
          "check",
          "check",
          "deposit",
        ]).slice(0, r(3, 4));
  plan.forEach(addEntry);
  const rows = (hide: number): [string, string, string][] => {
    const out: [string, string, string][] = [["Start", "—", dl(start)]];
    let run = start;
    entries.forEach((e, i) => {
      run += e.cents;
      out.push([
        e.name,
        `${e.cents < 0 ? MINUS : "+"}${dl(Math.abs(e.cents))}`,
        dl(run),
      ]);
    });
    if (hide === -1) out[out.length - 1]![2] = "?";
    else out[hide + 1]![1] = "?";
    return out;
  };
  const figure = (hide: number): SemanticFigure => ({
    kind: "scene",
    scene: table({
      id: "t",
      corner: "Entry",
      columns: ["Amount", "Balance"],
      rows: rows(hide).map(([label, a, b]) => ({ label, cells: [a, b] })),
    }).scene({ title: "A check register with amounts and running balances" }),
  });
  if (variant === "missing-amount") {
    const k = r(0, entries.length - 1);
    const e = entries[k]!;
    return {
      variant,
      prompt: `The check register shows the balance after each entry, but the amount in the row "${e.name}" is missing. How many dollars is that ${e.cents < 0 ? "payment" : "deposit"}? Enter the amount without a sign.`,
      hint: `Subtract the balance before this entry from the balance after it, or the other way around, and find the difference. ${e.cents < 0 ? "The balance went down." : "The balance went up."}`,
      explanation: [
        `The balance before the entry is ${dl(start + entries.slice(0, k).reduce((a, x) => a + x.cents, 0))} and after it is ${dl(start + entries.slice(0, k + 1).reduce((a, x) => a + x.cents, 0))}.`,
        `The difference is ${dl(Math.abs(e.cents))}, so the ${e.cents < 0 ? "payment" : "deposit"} is ${dl(Math.abs(e.cents))} dollars.`,
      ],
      figure: figure(k),
      answer: dl(Math.abs(e.cents)),
      responseLabel: "Dollars",
    };
  }
  const steps = entries.map(
    (e) => `${e.cents < 0 ? "−" : "+"} ${dl(Math.abs(e.cents))}`,
  );
  return {
    variant,
    prompt: `A check register starts with ${dl(start)} dollars. Each deposit is added and each check, transfer or fee is subtracted. What is the balance after the last entry, in dollars?`,
    hint: `Start from ${dl(start)} and go down the table. Add a deposit to the balance; subtract a check, a transfer or a fee. Each row's balance is the next row's starting balance.`,
    explanation: [
      `Start: ${dl(start)}.`,
      `Apply each entry in order: ${steps.join(" ")}.`,
      `The final balance is ${dl(balance)} dollars.`,
    ],
    figure: figure(-1),
    answer: dl(balance),
    responseLabel: "Balance in dollars",
  };
}

/* ---------------------------------------------------------------------- */
/* 6.14.H Lifetime income from a salary                                    */
/* ---------------------------------------------------------------------- */

const money = (cents: number) =>
  `${commas(Math.floor(cents / 100))}${cents % 100 ? `.${String(cents % 100).padStart(2, "0")}` : ""}`;
const plainMoney = (cents: number) =>
  cents % 100 ? dl(cents) : String(cents / 100);
function lifetimeIncomeSalary(r: Random): Built {
  const variant = pick(r, [
    "annual-times-years",
    "age-span",
    "monthly-pay",
    "two-salaries",
  ]);
  const salary = () => r(56, 190) * 500 * 100 + (r(0, 3) === 0 ? 5000 : 0);
  if (variant === "annual-times-years") {
    const S = salary();
    const Y = r(30, 45);
    return {
      variant,
      prompt: `A person earns ${money(S)} dollars each year for ${Y} years. How many dollars does the person earn in all?`,
      hint: `Each year brings the same pay, so the total over ${Y} years is the yearly pay times the number of years.`,
      explanation: [
        `Total = yearly pay × years = ${money(S)} × ${Y}.`,
        `${money(S)} × ${Y} = ${money(S * Y)} dollars.`,
      ],
      answer: plainMoney(S * Y),
      responseLabel: "Dollars",
    };
  }
  if (variant === "age-span") {
    const S = salary();
    const from = r(20, 26),
      to = r(60, 67);
    return {
      variant,
      prompt: `A person works from age ${from} until retiring at age ${to} and earns ${money(S)} dollars a year. How many dollars does the person earn over the whole career?`,
      hint: `First find how many years the person works: subtract the starting age from the retirement age. Then multiply by the yearly pay.`,
      explanation: [
        `Years worked = ${to} − ${from} = ${to - from}.`,
        `Total = ${money(S)} × ${to - from} = ${money(S * (to - from))} dollars.`,
      ],
      answer: plainMoney(S * (to - from)),
      responseLabel: "Dollars",
    };
  }
  if (variant === "monthly-pay") {
    const M = r(22, 70) * 100 * 100 + r(0, 1) * 5000;
    const Y = r(30, 42);
    return {
      variant,
      prompt: `A person earns ${money(M)} dollars each month for ${Y} years. How many dollars does the person earn in all?`,
      hint: `There are 12 months in a year. Find the pay for one year first, then multiply by ${Y}.`,
      explanation: [
        `One year of pay = ${money(M)} × 12 = ${money(M * 12)} dollars.`,
        `${Y} years of pay = ${money(M * 12)} × ${Y} = ${money(M * 12 * Y)} dollars.`,
      ],
      answer: plainMoney(M * 12 * Y),
      responseLabel: "Dollars",
    };
  }
  const S1 = salary();
  const S2 = S1 + r(4, 24) * 500 * 100;
  const Y = r(30, 45);
  return {
    variant,
    prompt: `Job A pays ${money(S1)} dollars a year and Job B pays ${money(S2)} dollars a year. How many more dollars does Job B pay than Job A over ${Y} years?`,
    hint: `Find how much more Job B pays each year, then multiply that difference by ${Y}, or find each total and subtract.`,
    explanation: [
      `Yearly difference = ${money(S2)} − ${money(S1)} = ${money(S2 - S1)} dollars.`,
      `Over ${Y} years: ${money(S2 - S1)} × ${Y} = ${money((S2 - S1) * Y)} dollars.`,
    ],
    answer: plainMoney((S2 - S1) * Y),
    responseLabel: "Dollars",
  };
}

/* ---------------------------------------------------------------------- */
/* 7.5.B Pi as a ratio                                                     */
/* ---------------------------------------------------------------------- */

const MEASURED: [number, number][] = [
  [5, 15.7],
  [7, 22],
  [8, 25.1],
  [9, 28.3],
  [10, 31.4],
  [12, 37.7],
  [14, 44],
  [15, 47.1],
  [20, 62.8],
  [25, 78.5],
];
function piAsRatio(r: Random): Built {
  const variant = pick(r, [
    "definition",
    "measured-diameter",
    "measured-radius",
    "scale",
  ]);
  if (variant === "definition")
    return {
      variant,
      prompt: `Pi (π) is the same number for every circle. Which ratio equals π?`,
      hint: `Pi compares two lengths of a circle: the distance around it and the distance straight across through its center.`,
      explanation: [
        `The distance around a circle is its circumference C, and the distance across through the center is its diameter d.`,
        `Pi is the ratio C ÷ d, the circumference divided by the diameter.`,
      ],
      choices: choicesFrom("circumference ÷ diameter", [
        {
          label: "diameter ÷ circumference",
          feedback: `That is the reciprocal of π, about 0.32.`,
        },
        {
          label: "circumference ÷ radius",
          feedback: `The radius is half the diameter, so this ratio is 2π, about 6.28.`,
        },
        {
          label: "area ÷ diameter",
          feedback: `Area is measured in square units; π compares two lengths.`,
        },
      ]),
    };
  if (variant === "scale") {
    const k = pick(r, [2, 3, 4, 5, 10]);
    return {
      variant,
      prompt: `A circle's diameter is made ${k} times as long. What happens to the ratio circumference ÷ diameter?`,
      hint: `The circumference grows when the diameter grows. Compare how much each is multiplied. Is the ratio the same for every circle?`,
      explanation: [
        `The circumference is also multiplied by ${k}, because circumference is always about 3.14 times the diameter.`,
        `So the ratio circumference ÷ diameter is still π: it stays the same.`,
      ],
      choices: choicesFrom("It stays the same", [
        {
          label: `It is multiplied by ${k}`,
          feedback: `Both the circumference and the diameter are multiplied by ${k}, so the ratio is unchanged.`,
        },
        {
          label: `It is divided by ${k}`,
          feedback: `The circumference grows with the diameter, so the ratio does not shrink.`,
        },
        {
          label: `It increases by ${k}`,
          feedback: `The ratio is π for every circle, so it does not change.`,
        },
      ]),
    };
  }
  const [d, C] = pick(r, MEASURED);
  const radius = variant === "measured-radius";
  const given = radius ? `a radius of ${d / 2} cm` : `a diameter of ${d} cm`;
  return {
    variant,
    prompt: `A circular lid has ${given} and a circumference of ${C} cm. What is the circumference divided by the diameter, rounded to the nearest hundredth?`,
    hint: radius
      ? `The diameter is twice the radius. Find the diameter first, then divide the circumference ${C} by it.`
      : `Divide the circumference ${C} by the diameter ${d} and round to two decimal places.`,
    explanation: [
      ...(radius ? [`The diameter is 2 × ${d / 2} = ${d} cm.`] : []),
      `${C} ÷ ${d} = ${(C / d).toFixed(4)}, which rounds to ${(C / d).toFixed(2)}.`,
      `This is the value of π to the nearest hundredth.`,
    ],
    choices: choicesFrom((C / d).toFixed(2), [
      {
        label: (C / (d / 2)).toFixed(2),
        feedback: `That divides the circumference by the radius. Pi uses the diameter.`,
      },
      {
        label: (d / C).toFixed(2),
        feedback: `That divides the diameter by the circumference, the reciprocal.`,
      },
      {
        label: String(Math.round(C / d)),
        feedback: `The question asks for the nearest hundredth, not the nearest whole number.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* 7.6.C, 7.6.H, 7.6.I Experimental probability                            */
/* ---------------------------------------------------------------------- */

const EXPERIMENTS = [
  {
    setup: (t: number, s: number) =>
      `A paper cup was tossed ${t} times and landed on its side ${s} times.`,
    event: "the cup lands on its side",
    per: "tosses",
  },
  {
    setup: (t: number, s: number) =>
      `A spinner was spun ${t} times and landed on blue ${s} times.`,
    event: "the spinner lands on blue",
    per: "spins",
  },
  {
    setup: (t: number, s: number) =>
      `A thumbtack was dropped ${t} times and landed point up ${s} times.`,
    event: "the thumbtack lands point up",
    per: "drops",
  },
];
function experimentalProbabilityPredict(r: Random): Built {
  const variant = pick(r, [
    "experimental-probability",
    "predict-count",
    "compare-expected",
    "trust-more-trials",
  ]);
  const e = pick(r, EXPERIMENTS);
  if (variant === "experimental-probability") {
    const t = pick(r, [20, 25, 50, 100]);
    const s = r(2, t - 2);
    return {
      variant,
      prompt: `${e.setup(t, s)} What is the experimental probability that ${e.event}? Enter a decimal.`,
      hint: `Experimental probability is the number of times the event happened divided by the total number of ${e.per}.`,
      explanation: [
        `The event happened ${s} times in ${t} ${e.per}.`,
        `Experimental probability = ${s} ÷ ${t} = ${trimNum(s / t)}.`,
      ],
      answer: trimNum(s / t),
      responseLabel: "Probability",
    };
  }
  if (variant === "predict-count") {
    const t = pick(r, [20, 25, 40, 50]);
    const s = r(3, Math.floor(t / 2));
    const k = pick(r, [3, 4, 5, 8, 10]);
    return {
      variant,
      prompt: `${e.setup(t, s)} Use these results to predict how many times ${e.event} in ${t * k} ${e.per}.`,
      hint: `The experiment ran ${t} ${e.per}. How many times as many ${e.per} is the prediction for? Scale the observed count the same way.`,
      explanation: [
        `The experimental probability is ${s}/${t}.`,
        `${t * k} ${e.per} is ${k} times as many as ${t}, so predict ${k} × ${s} = ${k * s} times.`,
      ],
      answer: String(k * s),
      responseLabel: "Predicted number",
    };
  }
  if (variant === "compare-expected") {
    const die = r(0, 1) === 0;
    const t = die ? pick(r, [30, 60, 90]) : pick(r, [20, 40, 60]);
    const expected = die ? t / 6 : t / 2;
    const extra = r(2, 7);
    const s = expected + extra;
    return {
      variant,
      prompt: die
        ? `A fair number cube is rolled ${t} times and a 6 comes up ${s} times. The theoretical probability of a 6 is 1/6. How many more 6s came up than the theory predicts?`
        : `A fair coin is tossed ${t} times and heads comes up ${s} times. The theoretical probability of heads is 1/2. How many more heads came up than the theory predicts?`,
      hint: die
        ? `Theory predicts 1/6 of the ${t} rolls will be 6s. Find that number, then subtract it from the observed count.`
        : `Theory predicts 1/2 of the ${t} tosses will be heads. Find that number, then subtract it from the observed count.`,
      explanation: [
        `Expected: ${die ? "1/6" : "1/2"} × ${t} = ${expected}.`,
        `Observed minus expected: ${s} − ${expected} = ${extra}.`,
      ],
      answer: String(extra),
      responseLabel: "How many more",
    };
  }
  const [a, b] = twoNames(r);
  const small = pick(r, [10, 12]);
  const sa = r(3, 5);
  const big = pick(r, [100, 120]);
  const sb = Math.round(big * (sa / small) + r(-4, 4));
  return {
    variant,
    prompt: `${a} ran an experiment with ${small} trials and the event happened ${sa} times. ${b} ran the same experiment with ${big} trials and the event happened ${sb} times. Whose result is the better basis for predicting what will happen in 500 trials?`,
    hint: `Compare how many trials each person ran. Does an experimental probability tend to be steadier after a few trials or after many?`,
    explanation: [
      `${a} used ${small} trials and ${b} used ${big} trials.`,
      `An experimental probability tends to get closer to the true probability as the number of trials grows, so ${b}'s result is the better basis.`,
    ],
    choices: choicesFrom(
      `${b}'s, because more trials usually give an experimental probability closer to the true probability`,
      [
        {
          label: `${a}'s, because fewer trials are easier to count correctly`,
          feedback: `Counting is not the issue; a few trials can be far from the true probability by chance.`,
        },
        {
          label: `${a}'s, because ${sa}/${small} is the greater fraction`,
          feedback: `The size of the fraction does not decide reliability. The number of trials matters.`,
        },
        {
          label: `Both are equally reliable, because both are experimental`,
          feedback: `Experiments with more trials tend to be more reliable than experiments with few.`,
        },
      ],
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* 8.7.B Surface area of cylinders and triangular prisms                   */
/* ---------------------------------------------------------------------- */

const TRIPLES: [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [6, 8, 10],
  [8, 15, 17],
  [9, 12, 15],
];
function cylinderPrismSurfaceArea(r: Random): Built {
  const variant = pick(r, [
    "lateral",
    "total",
    "find-height",
    "triangular-prism",
  ]);
  const rad = r(2, 9),
    h = r(3, 14);
  if (variant === "lateral")
    return {
      variant,
      prompt: `A cylinder has a radius of ${rad} cm and a height of ${h} cm. Its lateral surface area, the curved side only, is $a\\pi$ square centimeters. What is $a$?`,
      hint: `Unroll the curved side into a rectangle. One side of the rectangle is the height ${h} cm and the other is the distance around the circular base.`,
      explanation: [
        `The unrolled side is a rectangle ${h} cm tall. Its width is the circumference $2\\pi\\times${rad}=${2 * rad}\\pi$ cm.`,
        `Area = $${2 * rad}\\pi \\times ${h} = ${2 * rad * h}\\pi$, so $a=${2 * rad * h}$.`,
      ],
      answer: String(2 * rad * h),
      responseLabel: "a",
    };
  if (variant === "total")
    return {
      variant,
      prompt: `A cylinder has a radius of ${rad} cm and a height of ${h} cm. Its total surface area, including both circular bases, is $a\\pi$ square centimeters. What is $a$?`,
      hint: `Add the area of the two circular bases to the area of the unrolled curved side.`,
      explanation: [
        `Two bases: $2\\times\\pi\\times${rad}^2=${2 * rad * rad}\\pi$.`,
        `Curved side: $2\\pi\\times${rad}\\times${h}=${2 * rad * h}\\pi$.`,
        `Total: $${2 * rad * rad}\\pi+${2 * rad * h}\\pi=${2 * rad * rad + 2 * rad * h}\\pi$, so $a=${2 * rad * rad + 2 * rad * h}$.`,
      ],
      answer: String(2 * rad * rad + 2 * rad * h),
      responseLabel: "a",
    };
  if (variant === "find-height") {
    const a = 2 * rad * rad + 2 * rad * h;
    return {
      variant,
      prompt: `A cylinder has a radius of ${rad} cm and a total surface area of $${a}\\pi$ square centimeters. What is its height, in centimeters?`,
      hint: `Write the total surface area as two bases plus the curved side. Subtract the two bases from ${a}π and then divide by the circumference-coefficient of the side.`,
      explanation: [
        `Two bases: $2\\pi\\times${rad}^2=${2 * rad * rad}\\pi$.`,
        `The curved side is $${a}\\pi-${2 * rad * rad}\\pi=${2 * rad * h}\\pi$.`,
        `The side is $2\\pi\\times${rad}\\times h=${2 * rad}\\pi h$, so $h=${2 * rad * h}\\div${2 * rad}=${h}$ cm.`,
      ],
      answer: String(h),
      responseLabel: "Height in cm",
    };
  }
  const [p, q, c] = pick(r, TRIPLES);
  const L = r(4, 12);
  const sa = p * q + (p + q + c) * L;
  return {
    variant,
    prompt: `A right triangular prism has bases that are right triangles with legs ${p} cm and ${q} cm and hypotenuse ${c} cm. The prism is ${L} cm long. What is its total surface area, in square centimeters?`,
    hint: `The prism has two triangle bases and three rectangular faces. Each rectangle is one side of the triangle by the length ${L} cm.`,
    explanation: [
      `Two triangles: $2\\times\\tfrac12\\times${p}\\times${q}=${p * q}$.`,
      `Three rectangles: $(${p}+${q}+${c})\\times${L}=${(p + q + c) * L}$.`,
      `Total: $${p * q}+${(p + q + c) * L}=${sa}$ square centimeters.`,
    ],
    answer: String(sa),
    responseLabel: "Square centimeters",
  };
}

/* ---------------------------------------------------------------------- */
/* 8.8.A Equations and inequalities with variables on both sides           */
/* ---------------------------------------------------------------------- */

function bothSidesSituationEquation(r: Random): Built {
  const variant = pick(r, [
    "equation-same-cost",
    "inequality-less",
    "decreasing-and-increasing",
  ]);
  if (variant === "decreasing-and-increasing") {
    const t = r(3, 9),
      a1 = r(2, 6),
      b1 = r(2, 6);
    const B0 = r(5, 30);
    const A0 = B0 + (a1 + b1) * t;
    const sol = (a0: number, s1: number, b0: number, s2: number) =>
      (b0 - a0) / (s1 - s2);
    const options = [
      { text: `${A0} − ${a1}t = ${B0} + ${b1}t`, sol: sol(A0, -a1, B0, b1) },
      { text: `${A0} + ${a1}t = ${B0} + ${b1}t`, sol: sol(A0, a1, B0, b1) },
      { text: `${A0} − ${a1}t = ${B0} − ${b1}t`, sol: sol(A0, -a1, B0, -b1) },
      { text: `${A0} − ${a1}t = ${B0}`, sol: (A0 - B0) / a1 },
    ];
    if (
      options
        .slice(1)
        .some((o) => o.sol === options[0]!.sol || !Number.isFinite(o.sol))
    )
      throw new Error("Need three solutions");
    return {
      variant,
      prompt: `Tank A has ${A0} liters and loses ${a1} liters each minute. Tank B has ${B0} liters and gains ${b1} liters each minute. Which equation can be used to find the number of minutes, t, when the tanks hold the same amount?`,
      hint: `Write each tank's amount after t minutes: a tank that loses water has its rate subtracted, and a tank that gains water has its rate added. Then set the two amounts equal.`,
      explanation: [
        `Tank A after t minutes: ${A0} − ${a1}t. Tank B after t minutes: ${B0} + ${b1}t.`,
        `The amounts are equal when ${A0} − ${a1}t = ${B0} + ${b1}t.`,
      ],
      choices: choicesFrom(options[0]!.text, [
        {
          label: options[1]!.text,
          feedback: `Tank A loses water, so its rate is subtracted.`,
        },
        {
          label: options[2]!.text,
          feedback: `Tank B gains water, so its rate is added.`,
        },
        {
          label: options[3]!.text,
          feedback: `Tank B also changes with time. Its amount is ${B0} + ${b1}t, not just ${B0}.`,
        },
      ]),
    };
  }
  const contexts = [
    {
      a: "Gym A",
      b: "Gym B",
      fee: "joining fee",
      per: "per visit",
      v: "v",
      what: "visits",
    },
    {
      a: "Plan A",
      b: "Plan B",
      fee: "setup fee",
      per: "per print",
      v: "p",
      what: "prints",
    },
    {
      a: "Rental A",
      b: "Rental B",
      fee: "starting fee",
      per: "per minute",
      v: "m",
      what: "minutes",
    },
  ];
  const c = pick(r, contexts);
  const n = r(3, 9),
    a1 = r(2, 6),
    b1 = a1 + r(1, 4),
    b0 = r(2, 15);
  const a0 = b0 + (b1 - a1) * n;
  const v = c.v;
  const same = `${a0} + ${a1}${v} = ${b0} + ${b1}${v}`;
  const setup = `${c.a} charges a ${c.fee} of ${a0} dollars plus ${a1} dollars ${c.per}. ${c.b} charges a ${c.fee} of ${b0} dollars plus ${b1} dollars ${c.per}.`;
  if (variant === "equation-same-cost")
    return {
      variant,
      prompt: `${setup} Which equation can be used to find the number of ${c.what}, ${v}, for which the two total costs are equal?`,
      hint: `Write each total cost as the fee plus the rate times ${v}. The costs are equal, so connect the two totals with an equal sign.`,
      explanation: [
        `${c.a}: ${a0} + ${a1}${v}. ${c.b}: ${b0} + ${b1}${v}.`,
        `The costs are equal when ${same}.`,
      ],
      choices: choicesFrom(same, [
        {
          label: `${a0} + ${a1}${v} = ${b1}${v}`,
          feedback: `${c.b} also has a ${c.fee}, ${b0} dollars, which belongs on its side.`,
        },
        {
          label: `${a0} + ${b1}${v} = ${b0} + ${a1}${v}`,
          feedback: `The rates are swapped: ${c.a} charges ${a1} dollars ${c.per} and ${c.b} charges ${b1}.`,
        },
        {
          label: `${a0 + a1}${v} = ${b0 + b1}${v}`,
          feedback: `The fee is paid once and the rate is multiplied by ${v}, so they cannot be combined.`,
        },
      ]),
    };
  return {
    variant,
    prompt: `${setup} Which inequality can be used to find the numbers of ${c.what}, ${v}, for which ${c.a} costs less than ${c.b}?`,
    hint: `Write each total cost as the fee plus the rate times ${v}. "Costs less than" puts ${c.a}'s total on the smaller side of the inequality symbol.`,
    explanation: [
      `${c.a}: ${a0} + ${a1}${v}. ${c.b}: ${b0} + ${b1}${v}.`,
      `${c.a} costs less than ${c.b} when ${a0} + ${a1}${v} < ${b0} + ${b1}${v}.`,
    ],
    choices: choicesFrom(`${a0} + ${a1}${v} < ${b0} + ${b1}${v}`, [
      {
        label: `${a0} + ${a1}${v} > ${b0} + ${b1}${v}`,
        feedback: `That says ${c.a} costs more than ${c.b}. The symbol is reversed.`,
      },
      {
        label: `${a0} + ${a1}${v} ≤ ${b0} + ${b1}${v}`,
        feedback: `"Less than" excludes the case where the costs are equal, so the symbol is <, not ≤.`,
      },
      {
        label: `${a0} + ${b1}${v} < ${b0} + ${a1}${v}`,
        feedback: `The rates are swapped: ${c.a} charges ${a1} dollars ${c.per} and ${c.b} charges ${b1}.`,
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */
/* Assembly                                                                */
/* ---------------------------------------------------------------------- */

const builders: Record<string, (r: Random) => Built> = {
  "times-as-many-comparison": timesAsManyComparison,
  "situation-pair-table": situationPairTable,
  "story-equation-choice": storyEquationChoice,
  "strip-diagram-equation": stripDiagramEquation,
  "division-area-model": divisionAreaModel,
  "fraction-benchmark-reasonable": fractionBenchmarkReasonable,
  "unit-relative-size": unitRelativeSize,
  "decimal-area-model": decimalAreaModel,
  "number-set-venn": numberSetVenn,
  "reciprocal-division-choice": reciprocalDivisionChoice,
  "scaling-direction-choice": scalingDirectionChoice,
  "percent-grid-model": percentGridModel,
  "percent-forms-and-parts": percentFormsAndParts,
  "independent-dependent-roles": independentDependentRoles,
  "expression-or-equation": expressionOrEquation,
  "rational-area-volume-equation": rationalAreaVolumeEquation,
  "categorical-summary": categoricalSummary,
  "check-register-balance": checkRegisterBalance,
  "lifetime-income-salary": lifetimeIncomeSalary,
  "pi-as-ratio": piAsRatio,
  "experimental-probability-predict": experimentalProbabilityPredict,
  "cylinder-prism-surface-area": cylinderPrismSurfaceArea,
  "both-sides-situation-equation": bothSidesSituationEquation,
};

function toProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  d: Draft,
): GeneratedProblem {
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([meta.id, 1, seed]))
      .digest("hex"),
    templateId: meta.id,
    templateVersion: 1 as const,
    seed,
    prompt: d.prompt,
    skillId: meta.skillId,
    ...(d.figure ? { figure: d.figure } : {}),
  };
  if (!d.choices)
    return {
      public: {
        ...base,
        response: { kind: "number", label: d.responseLabel ?? "Answer" },
      },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  const choices = d.ordered ? d.choices : shuffle(r, [...d.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, i) => {
    const id = `option-${"abcd"[i]}`;
    if (c.correct) answer = id;
    else choiceFeedback[id] = c.feedback!;
    return { id, label: c.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: d.explanation,
    hint: d.hint,
    choiceFeedback,
  };
}

/** Private model: the variant is for tests; only the public problem is served. */
export function texas38Case(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = texas38Templates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 120; attempt++) {
    let draft: Built;
    try {
      draft = build(r);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    return { variant: draft.variant, problem: toProblem(meta, seed, r, draft) };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateTexas38Problem(templateId: string, seed: string) {
  return texas38Case(templateId, seed).problem;
}
