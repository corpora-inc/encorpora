import { withArticle } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  ProblemResponse,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { article } from "./agreement";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { graph } from "./scene/author";
import type { Point } from "./scene/spec";

/**
 * Rewriting a contextual expression (7.EE.A.2): a percent change is one
 * multiplier, and each equivalent form shows something different. Explaining
 * why slope is constant and deriving y = mx and y = mx + b (8.EE.B.6): the
 * learner supplies a reason, orders the argument, finds a flawed step or picks
 * the complete explanation. Every option is a statement whose truth the
 * generator computes from the same numbers it prints.
 */

const choice = { requiredResponseCapability: "single-choice-v1" as const };
const parts = { requiredResponseCapability: "multi-part-choice-v1" as const };
const scenes = { requiredFigureCapability: "scenes-v1" as const };
const band = "6–8" as const;
const termSense = {
  glossarySenses: { term: "term-expression", terms: "term-expression" },
};

export const algebraFormReasoningTemplates: readonly TemplateMetadata[] = [
  {
    id: "percent-change-multiplier-form",
    version: 1,
    title: "Choose the multiplier for a percent change",
    skillId: "linear-expressions",
    gradeBand: band,
    description:
      "A price, wage or cost goes up or down by a percent. Choose the single expression, such as $1.05p$ or $0.7j$, that gives the new amount. Wrong choices keep only the change, add the percent as dollars, or change the wrong way.",
    ...choice,
    ...termSense,
  },
  {
    id: "percent-change-multiplier-entry",
    version: 1,
    title: "Enter the multiplier for a percent change",
    skillId: "linear-expressions",
    gradeBand: band,
    description:
      "Enter the number $k$ that multiplies an amount after a percent increase, a percent decrease, or a discount followed by tax. Or read a multiplier such as $1.35p$ and enter the percent change it shows.",
    ...termSense,
  },
  {
    id: "expression-form-insight",
    version: 1,
    title: "What each form of an expression shows",
    skillId: "linear-expressions",
    gradeBand: band,
    description:
      "Two equal expressions describe a discount, tip, raise, markup, perimeter, ticket fee or overtime pay. Choose the form that shows a named fact directly, say what one term stands for, or say what a coefficient tells you.",
    ...choice,
    ...termSense,
  },
  {
    id: "expression-form-two-part",
    version: 1,
    title: "Rewrite a percent expression and read it",
    skillId: "linear-expressions",
    gradeBand: band,
    description:
      "Rewrite an expression such as $m + 0.08m$ as one multiple of the letter, then choose what that single form says about the quantity.",
    ...parts,
    ...termSense,
  },
  {
    id: "percent-rewrite-reasoning",
    version: 1,
    title: "Why a percent rewrite works",
    skillId: "linear-expressions",
    gradeBand: band,
    description:
      "Choose the complete reason that $p + 0.05p = 1.05p$, find the mistake in a student's expression for a percent increase, or judge a claim about a percent decrease followed by the same percent increase.",
    ...choice,
    ...termSense,
  },
  {
    id: "slope-constant-similar-triangles",
    version: 1,
    title: "Why slope triangles give the same slope",
    skillId: "slope",
    gradeBand: band,
    description:
      "Two slope triangles sit on one line. Choose the reason the triangles are similar, the proportion that shows the slopes are equal, or the one wrong step in the argument.",
    ...choice,
    ...scenes,
  },
  {
    id: "slope-argument-order",
    version: 1,
    title: "Order the slope triangle argument",
    skillId: "slope",
    gradeBand: band,
    description:
      "Put five statements in order to explain why the slope is the same between any two points of a line: right angles and corresponding angles, then similar triangles, then proportional sides, then equal slopes.",
    ...parts,
    ...scenes,
  },
  {
    id: "derive-line-equation",
    version: 1,
    title: "Derive the equation of a line from its slope",
    skillId: "slope",
    gradeBand: band,
    description:
      "Follow the derivation of $y = mx$ for a line through the origin and $y = mx + b$ for a line crossing the $y$-axis at $b$. Supply a missing reason or step, choose the slope between the intercept and a general point, choose the complete explanation, or find the wrong step.",
    ...choice,
    ...scenes,
  },
];

const metaOf = (id: string) =>
  algebraFormReasoningTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------ helpers */

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
/** An integer count of 10^-places written as a decimal: (105, 2) → "1.05". */
function decimal(n: number, places: number): string {
  const scale = 10 ** places;
  const sign = n < 0 ? "-" : "";
  const whole = Math.floor(Math.abs(n) / scale);
  const frac = String(Math.abs(n) % scale)
    .padStart(places, "0")
    .replace(/0+$/, "");
  return `${sign}${whole}${frac ? `.${frac}` : ""}`;
}
/** Hundredths of a percent as a decimal fraction of the whole: 5 → "0.05". */
const hundredths = (n: number) => decimal(n, 2);
/** A signed integer in prose, with a true minus sign. */
const prose = (n: number) => (n < 0 ? `−${-n}` : `${n}`);

type Choice = { label: string; correct?: true; feedback?: string };
interface Built {
  prompt: string;
  hint: string;
  explanation: string[];
  variant: string;
  figure?: SemanticFigure;
  /** Single choice: exactly one correct, every other with feedback. */
  choices?: Choice[];
  label?: string;
  /** Number: the exact answer and its field label. */
  answer?: string;
  /** Multi-part choice: the response and each blank's correct label. */
  parts?: { response: MultiPartChoiceResponse; correct: readonly string[] };
}

function finish(
  id: string,
  seed: string,
  r: Random,
  built: Built,
): GeneratedProblem {
  const meta = metaOf(id);
  let response: ProblemResponse;
  let answer: string;
  let choiceFeedback: Record<string, string> | undefined;
  if (built.choices) {
    const choices = built.choices;
    if (
      choices.filter((c) => c.correct).length !== 1 ||
      new Set(choices.map((c) => c.label)).size !== choices.length ||
      choices.some((c) => !c.correct && !c.feedback) ||
      choices.some((c) => c.label.length > 120)
    )
      throw new Error(
        `${id}: ambiguous or overlong choices ${JSON.stringify(choices.map((c) => c.label))}`,
      );
    shuffle(r, choices);
    choiceFeedback = {};
    answer = "";
    response = {
      kind: "choice",
      label: built.label ?? "Choose one answer",
      options: choices.map((c, i) => {
        const optionId = `option-${"abcd"[i]}`;
        if (c.correct) answer = optionId;
        else choiceFeedback![optionId] = c.feedback!;
        return { id: optionId, label: c.label };
      }),
    };
  } else if (built.parts) {
    const { response: multi, correct } = built.parts;
    const key = Object.fromEntries(
      multi.blanks.map((b, i) => {
        const option = b.options.find((o) => o.label === correct[i]);
        if (!option) throw new Error(`${id}: no correct option for ${b.id}`);
        if (b.options.some((o) => o.label.length > 80))
          throw new Error(`${id}: option over 80 characters`);
        return [b.id, option.id];
      }),
    );
    response = multi;
    answer = serializeMultiPart(multi, key);
  } else {
    response = { kind: "number", label: built.label ?? "Answer" };
    answer = built.answer!;
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([id, meta.version, seed]))
        .digest("hex"),
      templateId: id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      ...(built.figure ? { figure: built.figure } : {}),
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    ...(choiceFeedback ? { choiceFeedback } : {}),
    variant: { id: built.variant },
  };
}

/* ------------------------------------------------- percent stories */

/** Grade-7 percents (the spec's set R). */
export const PERCENTS = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75];

export interface PercentStory {
  key: string;
  dir: "up" | "down";
  v: string;
  setup: (pct: number) => string;
  ask: string;
  base: string;
  change: string;
  result: string;
  /** For "By what percent did the … change?"; absent when it reads badly. */
  thing?: string;
  percents: readonly number[];
}

export const PERCENT_STORIES: readonly PercentStory[] = [
  {
    key: "bike",
    dir: "up",
    v: "p",
    setup: (r) => `A bike costs $p$ dollars. Its price goes up by ${r}%.`,
    ask: "Which expression gives the new price?",
    base: "the old price",
    change: "the increase",
    result: "the new price",
    thing: "price",
    percents: PERCENTS,
  },
  {
    key: "wage",
    dir: "up",
    v: "w",
    setup: (r) =>
      `A worker earns $w$ dollars an hour and gets ${article(r)} ${r}% raise.`,
    ask: "Which expression gives the new hourly wage?",
    base: "the old wage",
    change: "the raise",
    result: "the new wage",
    thing: "wage",
    percents: [4, 5, 6, 8, 10, 12, 15, 20, 25],
  },
  {
    key: "salary",
    dir: "up",
    v: "s",
    setup: (r) =>
      `A nurse earns a salary of $s$ dollars a year. The salary goes up by ${r}%.`,
    ask: "Which expression gives the new salary?",
    base: "the old salary",
    change: "the raise",
    result: "the new salary",
    thing: "salary",
    percents: [4, 5, 6, 8, 10, 12, 15],
  },
  {
    key: "tip",
    dir: "up",
    v: "m",
    setup: (r) =>
      `A meal costs $m$ dollars, and ${article(r)} ${r}% tip is added.`,
    ask: "Which expression gives the total paid?",
    base: "the meal cost",
    change: "the tip",
    result: "the total paid",
    percents: [10, 12, 15, 20, 25],
  },
  {
    key: "ticket",
    dir: "up",
    v: "t",
    setup: (r) =>
      `A concert ticket costs $t$ dollars. The ticket price rises by ${r}%.`,
    ask: "Which expression gives the new ticket price?",
    base: "the old ticket price",
    change: "the increase",
    result: "the new ticket price",
    thing: "ticket price",
    percents: [5, 8, 10, 12, 15, 20, 25, 30, 40, 50],
  },
  {
    key: "markup",
    dir: "up",
    v: "c",
    setup: (r) =>
      `A store pays $c$ dollars for a lamp and marks the price up ${r}%.`,
    ask: "Which expression gives the selling price?",
    base: "the store's cost",
    change: "the markup",
    result: "the selling price",
    percents: [20, 25, 30, 40, 50, 60, 75],
  },
  {
    key: "jacket",
    dir: "down",
    v: "j",
    setup: (r) => `A jacket costs $j$ dollars and is marked down ${r}%.`,
    ask: "Which expression gives the sale price?",
    base: "the original price",
    change: "the amount saved",
    result: "the sale price",
    thing: "price",
    percents: PERCENTS,
  },
  {
    key: "game",
    dir: "down",
    v: "p",
    setup: (r) =>
      `A video game costs $p$ dollars. It goes on sale at ${r}% off.`,
    ask: "Which expression gives the sale price?",
    base: "the original price",
    change: "the discount",
    result: "the sale price",
    thing: "price",
    percents: [10, 15, 20, 25, 30, 40, 50, 60, 75],
  },
  {
    key: "train",
    dir: "down",
    v: "t",
    setup: (r) =>
      `A train ticket costs $t$ dollars, and students get ${r}% off.`,
    ask: "Which expression gives the student price?",
    base: "the full price",
    change: "the discount",
    result: "the student price",
    thing: "price",
    percents: [10, 15, 20, 25, 30, 40, 50],
  },
  {
    key: "plan",
    dir: "down",
    v: "c",
    setup: (r) =>
      `A phone plan costs $c$ dollars a month. The company cuts the cost by ${r}%.`,
    ask: "Which expression gives the new monthly cost?",
    base: "the old cost",
    change: "the cut",
    result: "the new cost",
    thing: "cost",
    percents: [4, 5, 6, 8, 10, 12, 15, 20, 25],
  },
  {
    key: "gym",
    dir: "down",
    v: "r",
    setup: (r) =>
      `A gym's monthly rate is $r$ dollars. The gym lowers the rate by ${r}%.`,
    ask: "Which expression gives the new rate?",
    base: "the old rate",
    change: "the cut",
    result: "the new rate",
    thing: "rate",
    percents: [4, 5, 6, 8, 10, 12, 15, 20],
  },
];

const storiesFor = (
  dir: "up" | "down",
  keys?: readonly string[],
): PercentStory[] =>
  PERCENT_STORIES.filter(
    (s) => s.dir === dir && (!keys || keys.includes(s.key)),
  );

/** The new amount's multiplier in hundredths: 105 for +5%, 70 for −30%. */
const multiplier = (s: PercentStory, pct: number) =>
  s.dir === "up" ? 100 + pct : 100 - pct;
const sign = (s: PercentStory) => (s.dir === "up" ? "+" : "-");
/** "$p + 0.05p$": the story form, the whole plus or minus the change. */
const storyForm = (s: PercentStory, pct: number) =>
  `${s.v} ${sign(s)} ${hundredths(pct)}${s.v}`;
/** The decimal-slip multiplier: 5% read as 0.5, in hundredths. */
const slip = (s: PercentStory, pct: number) =>
  s.dir === "up" ? 100 + 10 * pct : 100 - 10 * pct;

function multiplierSteps(s: PercentStory, pct: number): string[] {
  const d = hundredths(pct),
    k = hundredths(multiplier(s, pct)),
    v = s.v;
  const verb = s.dir === "up" ? "plus" : "minus";
  const check = multiplier(s, pct);
  return [
    `${cap(s.result)} is ${s.base} ${verb} ${pct}% of it: $${storyForm(s, pct)}$. Here ${pct}% is ${pct} hundredths, $${d}$, and $${d}${v}$ is ${s.change}.`,
    `Both terms count $${v}$: one whole $${v}$ ${s.dir === "up" ? "and" : "minus"} ${d} of $${v}$. Factor out $${v}$ (write it once, outside parentheses): $(1 ${sign(s)} ${d})${v}$.`,
    `$1 ${sign(s)} ${d} = ${k}$, so ${s.result} is $${k}${v}$. ${s.dir === "up" ? "Increasing" : "Decreasing"} by ${pct}% is the same as multiplying by ${k}.`,
    `Check with $${v} = 100$: $100 ${sign(s)} ${pct} = ${check}$, and $${k} \\cdot 100 = ${check}$.`,
  ];
}

/* ---------------------- percent-change-multiplier-form (choice) */

function multiplierForm(seed: string, r: Random): GeneratedProblem {
  const dir = r(0, 1) ? "up" : "down";
  const s = pick(r, storiesFor(dir));
  // At 50% off the amount saved equals the sale price, so the "discount is
  // the price" choice would also be right; that percent is left out here.
  const pct = pick(
    r,
    s.percents.filter((p) => dir === "up" || p !== 50),
  );
  const v = s.v,
    d = hundredths(pct),
    k = hundredths(multiplier(s, pct));
  const asDollars = r(0, 1) ? d : String(pct);
  const choices: Choice[] = [
    { label: `$${k}${v}$`, correct: true },
    {
      label: `$${d}${v}$`,
      feedback: `$${d}${v}$ is only ${s.change}, ${pct}% of $${v}$. ${cap(s.result)} also ${dir === "up" ? "keeps" : "starts from"} the whole $${v}$.`,
    },
    {
      label: `$${v} ${sign(s)} ${asDollars}$`,
      feedback: `This ${dir === "up" ? "adds" : "subtracts"} ${asDollars} dollars, a fixed amount. ${pct}% of $${v}$ depends on $${v}$: it is $${d}${v}$.`,
    },
    dir === "up" && pct < 10
      ? {
          label: `$${hundredths(slip(s, pct))}${v}$`,
          feedback: `${pct}% is ${pct} hundredths, ${d}, not ${decimal(pct, 1)}. $${hundredths(slip(s, pct))}${v}$ would be ${article(10 * pct)} ${10 * pct}% increase.`,
        }
      : dir === "up" && pct === 50
        ? {
            // At 50% the turned-around multiplier 0.5 equals the increase.
            label: `$${v} + ${asDollars === d ? pct : d}$`,
            feedback: `This adds ${asDollars === d ? pct : d} dollars, a fixed amount. ${pct}% of $${v}$ depends on $${v}$: it is $${d}${v}$.`,
          }
        : {
            label: `$${hundredths(dir === "up" ? 100 - pct : 100 + pct)}${v}$`,
            feedback:
              dir === "up"
                ? `A multiplier less than 1 makes the amount smaller. An increase needs a multiplier greater than 1.`
                : `A multiplier greater than 1 makes the amount larger. ${article(pct, true)} ${pct}% cut needs a multiplier less than 1.`,
          },
  ];
  return finish("percent-change-multiplier-form", seed, r, {
    prompt: `${s.setup(pct)} ${s.ask}`,
    choices,
    hint: `Write ${s.result} as $${v}$ ${dir === "up" ? "plus" : "minus"} ${pct}% of $${v}$, that is $${storyForm(s, pct)}$. Both terms have $${v}$: count them together.`,
    explanation: multiplierSteps(s, pct),
    variant: `${dir}-choice`,
  });
}

/* --------------------- percent-change-multiplier-entry (number) */

const TWO_STEP = [
  { v: "p", item: "A board game costs $p$ dollars." },
  { v: "j", item: "A jacket costs $j$ dollars." },
  { v: "c", item: "A camera costs $c$ dollars." },
];

function multiplierEntry(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, [
    "up-number",
    "down-number",
    "two-step-number",
    "reverse-up",
    "reverse-down",
  ] as const);
  if (variant === "up-number" || variant === "down-number") {
    const s = pick(r, storiesFor(variant === "up-number" ? "up" : "down"));
    const pct = pick(r, s.percents);
    const k = hundredths(multiplier(s, pct));
    return finish("percent-change-multiplier-entry", seed, r, {
      prompt: `${s.setup(pct)} ${cap(s.result)} can be written as $k \\cdot ${s.v}$ for one number $k$. What is $k$?`,
      label: "k",
      answer: k,
      hint: `Write ${s.result} as $${s.v}$ ${s.dir === "up" ? "plus" : "minus"} ${pct}% of $${s.v}$. Then count how many $${s.v}$'s that is in all.`,
      explanation: [...multiplierSteps(s, pct), `So $k = ${k}$.`],
      variant,
    });
  }
  if (variant === "two-step-number") {
    const story = pick(r, TWO_STEP);
    const off = pick(r, [10, 20, 25, 30, 40, 50]);
    const tax = pick(r, [5, 8, 10, 20]);
    const product = (100 - off) * (100 + tax); // ten-thousandths
    if (product % 10 !== 0)
      throw new Error("Need a product with at most three decimals");
    const v = story.v;
    const k1 = hundredths(100 - off),
      k2 = hundredths(100 + tax),
      k = decimal(product, 4);
    const added = hundredths(100 - off + tax);
    const sale = 100 - off;
    const final = decimal(product, 2);
    return finish("percent-change-multiplier-entry", seed, r, {
      prompt: `${story.item} It is ${off}% off, and then ${tax}% sales tax is added to the sale price. The final price is $k \\cdot ${v}$. What is $k$?`,
      label: "k",
      answer: k,
      hint: `First write the sale price after ${off}% off as a multiple of $${v}$. Then add ${tax}% of that sale price, not ${tax}% of $${v}$.`,
      explanation: [
        `After ${off}% off, the sale price is $${v} - ${hundredths(off)}${v} = ${k1}${v}$.`,
        `The tax is ${tax}% of the sale price, not of $${v}$. Adding it multiplies the sale price by $1 + ${hundredths(tax)} = ${k2}$: the final price is $${k2}(${k1}${v})$.`,
        `$${k2} \\cdot ${k1} = ${k}$, so the final price is $${k}${v}$ and $k = ${k}$.`,
        `Adding the percents, $1 - ${hundredths(off)} + ${hundredths(tax)} = ${added}$, is wrong: it takes the tax on the original price $${v}$.`,
        `Check with $${v} = 100$: after the discount the price is ${sale}, and ${tax}% tax on ${sale} makes ${final}. Also $${k} \\cdot 100 = ${final}$.`,
      ],
      variant,
    });
  }
  const dir = variant === "reverse-up" ? "up" : "down";
  const s = pick(
    r,
    storiesFor(dir).filter((x) => x.thing),
  );
  const pct = pick(r, s.percents);
  const m = multiplier(s, pct);
  const k = hundredths(m),
    d = hundredths(pct),
    v = s.v;
  const way = dir === "up" ? "increase" : "decrease";
  return finish("percent-change-multiplier-entry", seed, r, {
    prompt: `After a change, ${s.result} is $${k}${v}$, where $${v}$ is ${s.base}. By what percent did the ${s.thing} ${way}?`,
    label: "percent",
    answer: String(pct),
    hint: `Split $${k}${v}$ into the whole $${v}$ ${dir === "up" ? "plus" : "minus"} a part. What percent of $${v}$ is that part?`,
    explanation: [
      `$${k}${v} = ${v} ${dir === "up" ? "+" : "-"} ${d}${v}$: the whole $${v}$ ${dir === "up" ? "plus" : "minus"} ${d} of it.`,
      `${d} of $${v}$ is ${pct}% of $${v}$, so the ${s.thing} ${dir === "up" ? "increased" : "decreased"} by ${pct}%.`,
      dir === "up"
        ? `Do not read ${k} as ${article(m)} ${m}% increase. ${m}% is the new amount as a percent of the old one; only the extra ${pct}% is the increase.`
        : `Do not read ${k} as ${article(m)} ${m}% decrease. You still pay ${m}% of the old amount, so ${pct}% came off.`,
    ],
    variant,
  });
}

/* ------------------------------ expression-form-insight (choice) */

interface FormContext {
  key: string;
  setup: string;
  /** What the expression gives: "the sale price". */
  result: string;
  /** Expanded form (TeX) and single form (TeX). */
  expanded: string;
  single: string;
  /** The fact each form shows directly. */
  showsExpanded: string;
  showsSingle: string;
  /** Not equal to the result: [label, feedback]. */
  decoys: [string, string][];
  /** The asked term of the expanded form, its true meaning, and three
   * meanings that do not match it: [phrase, feedback]. */
  /** A first move naming the context's numbers: try a value in each choice. */
  tryText: string;
  term: string;
  /** The two terms of the expanded form, in order (TeX). */
  terms: [string, string];
  termMeaning: string;
  termDecoys: [string, string][];
}

function percentFormContext(s: PercentStory, pct: number): FormContext {
  const v = s.v,
    d = hundredths(pct),
    k = hundredths(multiplier(s, pct));
  const m = multiplier(s, pct);
  const verb = s.dir === "up" ? "plus" : "minus";
  const constant = s.key === "wage" ? `${d} dollars an hour` : `${d} dollars`;
  return {
    key: s.key,
    setup: s.setup(pct),
    result: s.result,
    expanded: storyForm(s, pct),
    single: `${k}${v}`,
    showsExpanded: `${s.result} is ${s.base} ${verb} ${s.change}`,
    showsSingle: `${s.result} is ${m}% of ${s.base}`,
    decoys: [
      [
        `${v} ${sign(s)} ${d}`,
        `This ${s.dir === "up" ? "adds" : "subtracts"} ${d} dollars, not ${pct}% of $${v}$, so it does not equal ${s.result}.`,
      ],
      [`${d}${v}`, `This is only ${s.change}, not ${s.result}.`],
    ],
    tryText: `Put $${v} = 100$ into each choice: with ${article(pct)} ${pct}% ${s.dir === "up" ? "increase" : "decrease"}, ${s.result} should come out to ${m}.`,
    term: `${d}${v}`,
    terms: [v, `${d}${v}`],
    termMeaning: s.change,
    termDecoys: [
      [
        s.result,
        `${cap(s.result)} is the whole expression, not one term of it.`,
      ],
      [s.base, `${cap(s.base)} is $${v}$ itself, the first term.`],
      [
        `${CONSTANT_NOUN[s.key] ?? "a change"} of ${constant}`,
        `$${d}${v}$ is ${d} times $${v}$, not ${d} dollars. It grows when $${v}$ grows.`,
      ],
    ],
  };
}

function perimeterContext(r: Random): FormContext {
  const side = pick(r, ["L", "W"]);
  const other = side === "L" ? "W" : "L";
  return {
    key: "perimeter",
    setup: "A rectangle is $L$ units long and $W$ units wide.",
    result: "the perimeter",
    expanded: "2L + 2W",
    single: "2(L + W)",
    showsExpanded: "the perimeter is two lengths plus two widths",
    showsSingle: "the perimeter is twice the sum of one length and one width",
    decoys: [
      ["2L + W", "This counts only one width, so it is not the perimeter."],
      [
        "2LW",
        "This multiplies the length and the width. That is not the distance around.",
      ],
    ],
    tryText:
      "Put $L = 5$ and $W = 3$ into each choice: the perimeter should come out to 16.",
    term: `2${side}`,
    terms: ["2L", "2W"],
    termMeaning: `the two sides of length $${side}$ together`,
    termDecoys: [
      [
        "the whole perimeter",
        "The whole perimeter is $2L + 2W$, both terms together.",
      ],
      [
        `one side of length $${side}$`,
        `One side of length $${side}$ is just $${side}$. The 2 counts two such sides.`,
      ],
      [
        "the area of the rectangle",
        `The area is $LW$, a product. $2${side}$ adds two sides; ${other === "W" ? "the width" : "the length"} is not in it.`,
      ],
    ],
  };
}

function ticketContext(r: Random): FormContext {
  const a = r(8, 30),
    b = r(2, 6);
  return {
    key: "per-ticket-fee",
    setup: `Tickets cost ${a} dollars each, plus a fee of ${b} dollars on each ticket. Someone buys $n$ tickets.`,
    result: "the total cost",
    expanded: `${a}n + ${b}n`,
    single: `${a + b}n`,
    showsExpanded:
      "the total cost is the ticket prices plus the fees, added separately",
    showsSingle: `each ticket costs ${a + b} dollars with its fee`,
    decoys: [
      [
        `${a} + ${b}n`,
        `This counts the ${a}-dollar price only once, not once for each of the $n$ tickets.`,
      ],
      [`${b}n`, `This is only the fees, not the total cost.`],
    ],
    tryText: `Put $n = 2$ into each choice: two tickets at ${a} dollars plus ${withArticle(b)}-dollar fee each cost ${2 * (a + b)} dollars.`,
    term: `${b}n`,
    terms: [`${a}n`, `${b}n`],
    termMeaning: "the fees for all $n$ tickets",
    termDecoys: [
      [
        "the cost of one ticket with its fee",
        `One ticket with its fee costs ${a + b} dollars; $${b}n$ grows with $n$.`,
      ],
      [
        "the number of tickets",
        `The number of tickets is $n$. $${b}n$ is ${b} dollars for each of them.`,
      ],
      [
        `one fee of ${b} dollars`,
        `One fee is ${b} dollars. $${b}n$ is $n$ fees.`,
      ],
    ],
  };
}

function overtimeContext(): FormContext {
  return {
    key: "overtime",
    setup:
      "A worker's regular rate is $r$ dollars an hour, and overtime pays time and a half.",
    result: "the overtime rate",
    expanded: "r + 0.5r",
    single: "1.5r",
    showsExpanded: "the overtime rate is the regular rate plus the extra pay",
    showsSingle: "the overtime rate is 150% of the regular rate",
    decoys: [
      ["r + 0.5", "This adds 0.5 dollars, not half of $r$."],
      ["0.5r", "This is only the extra half, not the whole overtime rate."],
    ],
    tryText:
      "Put $r = 10$ into each choice: time and a half of 10 dollars is 15 dollars.",
    term: "0.5r",
    terms: ["r", "0.5r"],
    termMeaning: "the extra pay for each overtime hour",
    termDecoys: [
      [
        "the overtime rate",
        "The overtime rate is the whole expression, $r + 0.5r$.",
      ],
      ["the regular rate", "The regular rate is $r$, the first term."],
      [
        "an extra 0.5 dollars an hour",
        "$0.5r$ is half of $r$, not 0.5 dollars. It grows when $r$ grows.",
      ],
    ],
  };
}

const CONSTANT_NOUN: Record<string, string> = {
  jacket: "a discount",
  tip: "a tip",
  wage: "a raise",
  markup: "a markup",
};
const COEFFICIENT_KEYS = ["jacket", "tip", "wage", "markup"] as const;

function formInsight(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, [
    "which-form",
    "what-term-means",
    "what-coefficient-means",
  ] as const);
  if (variant === "what-coefficient-means") {
    const key = pick(r, [...COEFFICIENT_KEYS, "overtime"] as const);
    if (key === "overtime") {
      const claims: Choice[] = [
        {
          label: "The overtime rate is 150% of the regular rate.",
          correct: true,
        },
        {
          label: "The extra pay is 150% of the regular rate.",
          feedback:
            "The extra pay is only $0.5r$, 50% of the regular rate. The 1.5 counts the whole $r$ plus the extra half.",
        },
        {
          label: "The overtime rate is 1.5 dollars.",
          feedback: "1.5 multiplies $r$. It is not a number of dollars.",
        },
        {
          label: "The overtime rate is 50% less than the regular rate.",
          feedback:
            "A multiplier greater than 1 makes the rate larger, not smaller.",
        },
      ];
      return finish("expression-form-insight", seed, r, {
        prompt: `${overtimeContext().setup} The overtime rate is $1.5r$. What does the 1.5 in $1.5r$ tell you?`,
        choices: claims,
        hint: `Write $1.5r$ as $r + 0.5r$: one whole regular rate plus half of it. Then say 1.5 as a percent of $r$.`,
        explanation: [
          "Start from the story form: overtime pays the regular rate plus half of it, $r + 0.5r$.",
          "Both terms count $r$, so $r + 0.5r = (1 + 0.5)r = 1.5r$.",
          "The coefficient 1.5 (the number multiplying $r$) is $1 + 0.5$: the whole regular rate and half again. So the overtime rate is 150% of the regular rate.",
          "Check with $r = 10$: $10 + 5 = 15$ and $1.5 \\cdot 10 = 15$.",
        ],
        variant: `${variant}-overtime`,
      });
    }
    const s = PERCENT_STORIES.find((x) => x.key === key)!;
    // At 50% off the amount saved and the sale price are both 50%.
    const pct = pick(
      r,
      s.percents.filter((p) => p !== 50),
    );
    const m = multiplier(s, pct);
    const k = hundredths(m),
      d = hundredths(pct),
      v = s.v;
    const claims: Choice[] = [
      { label: `${cap(s.result)} is ${m}% of ${s.base}.`, correct: true },
      {
        label: `${cap(s.change)} is ${m}% of ${s.base}.`,
        feedback: `${cap(s.change)} is $${d}${v}$, only ${pct}% of $${v}$. The ${k} gives ${s.result}.`,
      },
      {
        label: `${cap(s.result)} is ${k} dollars.`,
        feedback: `${k} multiplies $${v}$, so ${s.result} changes when $${v}$ changes. ${k} is not a number of dollars.`,
      },
      s.dir === "down"
        ? {
            label: `${cap(s.result)} is ${m}% more than ${s.base}.`,
            feedback: `A multiplier less than 1 makes the amount smaller: ${s.result} is ${pct}% less than ${s.base}.`,
          }
        : {
            label: `${cap(s.result)} is ${pct}% less than ${s.base}.`,
            feedback: `A multiplier greater than 1 makes the amount larger: ${s.result} is ${pct}% more than ${s.base}.`,
          },
    ];
    return finish("expression-form-insight", seed, r, {
      prompt: `${s.setup(pct)} ${cap(s.result)} is $${k}${v}$. What does the ${k} in $${k}${v}$ tell you?`,
      choices: claims,
      hint: `Write $${k}${v}$ the long way, as $${storyForm(s, pct)}$. How much of $${v}$ is that in all, as a percent of $${v}$?`,
      explanation: [
        `Start from the story form: ${s.result} is $${storyForm(s, pct)}$.`,
        `Both terms count $${v}$: $(1 ${sign(s)} ${d})${v} = ${k}${v}$.`,
        `So the coefficient ${k} (the number multiplying $${v}$) says ${s.result} is ${m} hundredths of $${v}$, which is ${m}% of ${s.base}. The $${d}${v}$ is ${s.change}, ${pct}%.`,
        `Check with $${v} = 100$: $100 ${sign(s)} ${pct} = ${m}$ and $${k} \\cdot 100 = ${m}$.`,
      ],
      variant: `${variant}-${s.key}`,
    });
  }
  const contextKey = pick(r, [
    "jacket",
    "tip",
    "wage",
    "markup",
    "perimeter",
    "per-ticket-fee",
    "overtime",
  ] as const);
  let c: FormContext;
  if (contextKey === "perimeter") c = perimeterContext(r);
  else if (contextKey === "per-ticket-fee") c = ticketContext(r);
  else if (contextKey === "overtime") c = overtimeContext();
  else {
    const s = PERCENT_STORIES.find((x) => x.key === contextKey)!;
    // At 50% off the amount saved equals the sale price; leave it out.
    c = percentFormContext(
      s,
      pick(
        r,
        s.percents.filter((p) => s.dir === "up" || p !== 50),
      ),
    );
  }
  if (variant === "which-form") {
    const wantSingle = r(0, 1) === 1;
    const fact = wantSingle ? c.showsSingle : c.showsExpanded;
    const right = wantSingle ? c.single : c.expanded;
    const other = wantSingle ? c.expanded : c.single;
    const choices: Choice[] = [
      { label: `$${right}$`, correct: true },
      {
        label: `$${other}$`,
        feedback: `$${other}$ equals ${c.result} too, but it does not show directly that ${fact}.`,
      },
      ...c.decoys.map(([label, feedback]) => ({
        label: `$${label}$`,
        feedback,
      })),
    ];
    return finish("expression-form-insight", seed, r, {
      prompt: `${c.setup} Which expression for ${c.result} shows most directly that ${fact}?`,
      choices,
      hint: `${c.tryText} Of the expressions that match, which shows the fact as ${wantSingle ? "one product" : "two separate terms"}?`,
      explanation: [
        `${cap(c.result)} can be written $${c.expanded}$ or $${c.single}$; the two are equal because both terms of $${c.expanded}$ share a factor that can be taken out.`,
        `$${c.single}$ is one product: it shows ${c.showsSingle}.`,
        `$${c.expanded}$ keeps two terms: it shows ${c.showsExpanded}.`,
        `So the form that shows directly that ${fact} is $${right}$.`,
        `$${c.decoys[0]![0]}$ and $${c.decoys[1]![0]}$ do not equal ${c.result}, so neither can show anything about it.`,
      ],
      variant: `${variant}-${c.key}`,
    });
  }
  const choices: Choice[] = [
    { label: cap(c.termMeaning), correct: true },
    ...c.termDecoys.map(([label, feedback]) => ({
      label: cap(label),
      feedback,
    })),
  ];
  return finish("expression-form-insight", seed, r, {
    prompt: `${c.setup} ${cap(c.result)} is $${c.expanded}$. In this expression, what does the term $${c.term}$ stand for?`,
    choices,
    hint: `A term is one of the parts joined by $+$ or $-$. Read $${c.expanded}$ against the story: which part of ${c.result} does $${c.term}$ count?`,
    explanation: [
      `${cap(c.result)} is $${c.expanded}$. A term is one part joined by $+$ or $-$, so the terms here are $${c.terms[0]}$ and $${c.terms[1]}$.`,
      `Read the story: $${c.term}$ is ${c.termMeaning}.`,
      `The whole expression is ${c.result}; a term is only one part of it, and a term with a letter changes when the letter changes.`,
      c.key === "perimeter"
        ? `Check with $L = 5$ and $W = 3$: $2L + 2W = 10 + 6 = 16$, the perimeter.`
        : `Together the terms give ${c.result}, which can also be written $${c.single}$.`,
    ],
    variant: `${variant}-${c.key}`,
  });
}

/* --------------------------- expression-form-two-part (multi-part) */

function formTwoPart(seed: string, r: Random): GeneratedProblem {
  const key = pick(r, COEFFICIENT_KEYS);
  const s = PERCENT_STORIES.find((x) => x.key === key)!;
  const pct = pick(
    r,
    s.percents.filter((p) => p !== 50),
  );
  const m = multiplier(s, pct);
  const v = s.v,
    d = hundredths(pct),
    k = hundredths(m);
  const wrongK =
    s.dir === "up" && pct < 10
      ? hundredths(slip(s, pct))
      : hundredths(s.dir === "up" ? 100 - pct : 100 + pct);
  const letters = ["a", "b", "c", "d"] as const;
  const expressionLabels = shuffle(r, [
    `$${k}${v}$`,
    `$${d}${v}$`,
    `$${v} ${sign(s)} ${d}$`,
    `$${wrongK}${v}$`,
  ]);
  const meaningLabels = shuffle(r, [
    `${cap(s.result)} is ${m}% of ${s.base}.`,
    `${cap(s.result)} is ${pct}% of ${s.base}.`,
    `${cap(s.change)} is ${m}% of ${s.base}.`,
    `${cap(s.change)} is ${k} dollars.`,
  ]);
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each part",
    layout: "slots",
    blanks: [
      {
        id: "single",
        label: `A single expression equal to $${storyForm(s, pct)}$`,
        options: expressionLabels.map((label, i) => ({
          id: letters[i]!,
          label,
        })),
      },
      {
        id: "meaning",
        label: `What that single expression says about ${s.result}`,
        options: meaningLabels.map((label, i) => ({ id: letters[i]!, label })),
      },
    ],
  };
  return finish("expression-form-two-part", seed, r, {
    prompt: `${s.setup(pct)} ${cap(s.result)} can be written as $${storyForm(s, pct)}$. Rewrite it as one multiple of $${v}$, then say what that form tells you.`,
    parts: {
      response,
      correct: [`$${k}${v}$`, `${cap(s.result)} is ${m}% of ${s.base}.`],
    },
    hint: `Both terms of $${storyForm(s, pct)}$ count $${v}$. Factor out $${v}$: write $(1 ${sign(s)} ${d})${v}$ and work out the number in the parentheses.`,
    explanation: [
      `Both terms count $${v}$: $${storyForm(s, pct)} = (1 ${sign(s)} ${d})${v} = ${k}${v}$.`,
      `The coefficient ${k} is ${m} hundredths, so ${s.result} is ${m}% of ${s.base}.`,
      `$${d}${v}$ is only ${s.change}, ${pct}% of $${v}$; it is not ${s.result}, and ${k} is not a number of dollars.`,
      `Check with $${v} = 100$: $100 ${sign(s)} ${pct} = ${m}$ and $${k} \\cdot 100 = ${m}$.`,
    ],
    variant: `two-part-${s.key}`,
  });
}

/* ---------------------------- percent-rewrite-reasoning (choice) */

const NAMES = ["Mia", "Tariq", "Ana", "Dev", "Noor", "Leo", "Priya", "Sam"];

function rewriteReasoning(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, [
    "justify",
    "find-the-flaw",
    "successive-claim",
  ] as const);
  if (variant === "justify") {
    const dir = r(0, 1) ? "up" : "down";
    const s = pick(r, storiesFor(dir));
    const pct = pick(r, s.percents);
    const v = s.v,
      d = hundredths(pct),
      k = hundredths(multiplier(s, pct));
    const form = storyForm(s, pct);
    const choices: Choice[] = [
      {
        label: `Both terms are multiples of $${v}$: $${form} = (1 ${sign(s)} ${d})${v} = ${k}${v}$, by the distributive property.`,
        correct: true,
      },
      {
        label: `Because $1 ${sign(s)} ${d} = ${k}$.`,
        feedback: `True, but incomplete: it never says where the 1 comes from. The 1 is the coefficient of $${v}$ in the first term, which is why $${v}$ can be factored out.`,
      },
      {
        label: `Because ${dir === "up" ? "adding" : "subtracting"} ${d} ${dir === "up" ? "to" : "from"} $${v}$ gives $${k}${v}$.`,
        feedback: `$${v} ${sign(s)} ${d}$ is not $${k}${v}$. The second term is $${d}${v}$, ${d} times $${v}$, not the number ${d}.`,
      },
      dir === "up"
        ? {
            label: `They are not equal: $${form} = ${d}${v}^2$.`,
            feedback: `Adding two multiples of $${v}$ gives a multiple of $${v}$, not $${v}^2$. Only multiplying $${v}$ by $${v}$ makes $${v}^2$.`,
          }
        : {
            label: `They are not equal: the $${v}$'s cancel, so $${form} = ${k}$.`,
            feedback: `Taking ${d} of $${v}$ away from $${v}$ leaves part of $${v}$, not a number without $${v}$.`,
          },
    ];
    return finish("percent-rewrite-reasoning", seed, r, {
      prompt: `${s.setup(pct)} ${cap(s.result)} can be written as $${form}$ or as $${k}${v}$. Why are these two expressions equal?`,
      choices,
      hint: `Look at the two terms of $${form}$. The first term $${v}$ is $1 \\cdot ${v}$. What do the two terms have in common?`,
      explanation: [
        `The first term $${v}$ is $1 \\cdot ${v}$, and the second term is $${d}${v}$, ${d} times $${v}$. Both are multiples of $${v}$.`,
        `The distributive property lets you factor out $${v}$ (write it once): $1 \\cdot ${v} ${sign(s)} ${d} \\cdot ${v} = (1 ${sign(s)} ${d})${v}$.`,
        `$1 ${sign(s)} ${d} = ${k}$, so $${form} = ${k}${v}$.`,
        `"$1 ${sign(s)} ${d} = ${k}$" is true but does not explain the 1. The second term is ${d} times $${v}$, so it is not the number ${d}.`,
        `Check with $${v} = 100$: $100 ${sign(s)} ${pct} = ${multiplier(s, pct)}$ and $${k} \\cdot 100 = ${multiplier(s, pct)}$.`,
      ],
      variant,
    });
  }
  if (variant === "find-the-flaw") {
    const s = pick(
      r,
      storiesFor("up").filter((x) => x.thing),
    );
    const pct = pick(r, s.percents);
    const v = s.v,
      d = hundredths(pct),
      k = hundredths(multiplier(s, pct));
    const name = pick(r, NAMES);
    const forms =
      pct < 10
        ? (["cents", "increase-only", "slip"] as const)
        : (["cents", "increase-only"] as const);
    const kind = pick(r, forms);
    const slipK = hundredths(slip(s, pct));
    const student =
      kind === "cents"
        ? `${v} + ${d}`
        : kind === "increase-only"
          ? `${d}${v}`
          : `${slipK}${v}`;
    const nothing: Choice = {
      label: "Nothing is wrong.",
      feedback: `Try $${v} = 100$: $${student}$ gives ${kind === "cents" ? decimal(10000 + pct, 2) : kind === "increase-only" ? pct : 100 + 10 * pct}, but ${s.result} is ${multiplier(s, pct)}.`,
    };
    const choices: Choice[] =
      kind === "cents"
        ? [
            {
              label: `${d} is ${pct} cents, not ${pct}% of $${v}$. ${pct}% of $${v}$ is $${d}${v}$, so ${s.result} is $${v} + ${d}${v}$.`,
              correct: true,
            },
            nothing,
            {
              label: `It should be $${d}${v}$.`,
              feedback: `$${d}${v}$ is only ${s.change}. ${cap(s.result)} also keeps the whole $${v}$.`,
            },
            {
              label: `It should be $${v} + ${pct}$.`,
              feedback: `$${v} + ${pct}$ adds ${pct} dollars, a fixed amount. ${pct}% of $${v}$ depends on $${v}$.`,
            },
          ]
        : kind === "increase-only"
          ? [
              {
                label: `$${d}${v}$ is only ${s.change}. ${cap(s.result)} is $${v} + ${d}${v} = ${k}${v}$.`,
                correct: true,
              },
              nothing,
              {
                label: `It should be $${v} + ${d}$.`,
                feedback: `$${v} + ${d}$ adds ${d} dollars, ${pct} cents, not ${pct}% of $${v}$.`,
              },
              pct < 10
                ? {
                    label: `It should be $${slipK}${v}$.`,
                    feedback: `${pct}% is ${d}, not ${decimal(pct, 1)}. $${slipK}${v}$ would be ${article(10 * pct)} ${10 * pct}% increase.`,
                  }
                : {
                    label: `It should be $${hundredths(100 - pct)}${v}$.`,
                    feedback: `A multiplier less than 1 makes the amount smaller, but the ${s.thing} went up.`,
                  },
            ]
          : [
              {
                label: `${pct}% is ${d}, not ${decimal(pct, 1)}. ${cap(s.result)} is $${v} + ${d}${v} = ${k}${v}$.`,
                correct: true,
              },
              nothing,
              {
                label: `It should be $${d}${v}$.`,
                feedback: `$${d}${v}$ is only ${s.change}. ${cap(s.result)} also keeps the whole $${v}$.`,
              },
              {
                label: `It should be $${v} + ${pct}$.`,
                feedback: `$${v} + ${pct}$ adds ${pct} dollars, a fixed amount. ${pct}% of $${v}$ depends on $${v}$.`,
              },
            ];
    return finish("percent-rewrite-reasoning", seed, r, {
      prompt: `${s.setup(pct)} ${name} writes ${s.result} as $${student}$. What is wrong?`,
      choices,
      hint: `Write ${s.result} the long way: the whole $${v}$ plus ${pct}% of $${v}$. Then compare that with $${student}$, or try $${v} = 100$ in both.`,
      explanation: [
        `${cap(s.result)} is the whole $${v}$ plus ${pct}% of it. ${pct}% of $${v}$ is $${d}${v}$, so ${s.result} is $${v} + ${d}${v} = ${k}${v}$.`,
        kind === "cents"
          ? `${name} added the number ${d}, which is ${pct} cents. That is not ${pct}% of $${v}$.`
          : kind === "increase-only"
            ? `${name} wrote only ${s.change}, $${d}${v}$, and left out the whole $${v}$.`
            : `${name} wrote ${pct}% as ${decimal(pct, 1)}. But ${pct}% means ${pct} hundredths, ${d}.`,
        `Check with $${v} = 100$: ${s.result} should be ${multiplier(s, pct)}, and $${k} \\cdot 100 = ${multiplier(s, pct)}$.`,
      ],
      variant: `${variant}-${kind}`,
    });
  }
  const pct = pick(r, [10, 20, 25, 50]);
  const downFirst = r(0, 1) === 1;
  const v = pick(r, ["p", "j", "c"]);
  const name = pick(r, NAMES);
  const d = hundredths(pct),
    down = hundredths(100 - pct),
    up = hundredths(100 + pct);
  const product = decimal((100 - pct) * (100 + pct), 4);
  const lost = decimal(pct * pct, 2);
  const second = downFirst ? up : down;
  const first = downFirst ? down : up;
  const doubled = downFirst
    ? decimal((100 - pct) * (100 - pct), 4)
    : decimal((100 + pct) * (100 + pct), 4);
  const choices: Choice[] = [
    {
      label: `Wrong: the final price is $${second}(${first}${v}) = ${product}${v}$, ${lost}% less than the original.`,
      correct: true,
    },
    {
      label: `Right: $${v} ${downFirst ? "-" : "+"} ${d}${v} ${downFirst ? "+" : "-"} ${d}${v} = ${v}$.`,
      feedback: `This takes both changes as ${pct}% of $${v}$. The second change is ${pct}% of the new price, $${first}${v}$, not of $${v}$.`,
    },
    downFirst
      ? {
          label: `Right: the markup adds back $${d}${v}$, so $${down}${v} + ${d}${v} = ${v}$.`,
          feedback: `The markup is ${pct}% of the sale price $${down}${v}$, which is $${decimal(pct * (100 - pct), 4)}${v}$, not $${d}${v}$.`,
        }
      : {
          label: `Right: the markdown takes off $${d}${v}$, so $${up}${v} - ${d}${v} = ${v}$.`,
          feedback: `The markdown is ${pct}% of the raised price $${up}${v}$, which is $${decimal(pct * (100 + pct), 4)}${v}$, not $${d}${v}$.`,
        },
    {
      label: `Wrong: the final price is $${first}(${first}${v}) = ${doubled}${v}$.`,
      feedback: `This applies the first change twice. The second change goes the other way, so its multiplier is ${second}.`,
    },
  ];
  const story = downFirst
    ? `A store marks a price of $${v}$ dollars down ${pct}%. Later it marks the sale price up ${pct}%.`
    : `A store marks a price of $${v}$ dollars up ${pct}%. Later it marks the new price down ${pct}%.`;
  return finish("percent-rewrite-reasoning", seed, r, {
    prompt: `${story} ${name} says the final price equals the original price. Which statement is right?`,
    choices,
    hint: `Write each step as a multiplier: ${pct}% ${downFirst ? "off" : "more"} multiplies by ${first}. Does the second ${pct}% act on $${v}$ or on the price you just got?`,
    explanation: [
      downFirst
        ? `${pct}% off: the price becomes $${v} - ${d}${v} = ${down}${v}$.`
        : `${pct}% more: the price becomes $${v} + ${d}${v} = ${up}${v}$.`,
      `The second change is ${pct}% of that new price, so it multiplies by ${second}: $${second}(${first}${v})$.`,
      `$${second} \\cdot ${first} = ${product}$, so the final price is $${product}${v}$, which is ${lost}% less than the original. The order does not matter: $${up} \\cdot ${down} = ${down} \\cdot ${up}$.`,
      `${name}'s claim fails because the second ${pct}% is taken of a different amount than the first.`,
      `Check with $${v} = 100$: ${downFirst ? `${100 - pct}, then ${decimal((100 - pct) * (100 + pct), 2)}` : `${100 + pct}, then ${decimal((100 + pct) * (100 - pct), 2)}`}.`,
    ],
    variant: `${variant}-${downFirst ? "down-up" : "up-down"}`,
  });
}

/* ---------------------------------------------- slope triangles */

type Tri = { names: [string, string, string]; pts: [Point, Point, Point] };
interface SlopeSetup {
  p: number;
  q: number;
  b: number;
  layout: "separate" | "chained" | "nested";
  small: Tri;
  large: Tri;
  k1: number;
  k2: number;
}
const LETTERS: [[string, string, string], [string, string, string]][] = [
  [
    ["A", "B", "C"],
    ["D", "E", "F"],
  ],
  [
    ["P", "Q", "R"],
    ["S", "T", "U"],
  ],
  [
    ["D", "E", "F"],
    ["A", "B", "C"],
  ],
  [
    ["S", "T", "U"],
    ["P", "Q", "R"],
  ],
];
const RATIOS: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [2, 3],
  [2, 4],
];
const inWindow = (pts: Point[]) =>
  pts.every(([x, y]) => Math.abs(x) <= 10 && Math.abs(y) <= 10);

function slopeSetup(
  r: Random,
  options: { notOne?: boolean; layout?: SlopeSetup["layout"] } = {},
): SlopeSetup {
  for (let attempt = 0; attempt < 400; attempt++) {
    const q = r(1, 5);
    const p = r(1, 4) * (r(0, 1) ? 1 : -1);
    if (gcd(Math.abs(p), q) !== 1 || Math.abs(p) > 3 * q) continue;
    if (options.notOne && Math.abs(p) === q) continue;
    const [k1, k2] = pick(r, RATIOS);
    const layout =
      options.layout ?? pick(r, ["separate", "chained", "nested"] as const);
    const b = r(-6, 6);
    const x0 = q * r(Math.ceil(-10 / q), Math.floor(10 / q));
    const A: Point = [x0, (p * x0) / q + b];
    const tri = (start: Point, k: number): [Point, Point, Point] => [
      start,
      [start[0] + k * q, start[1]],
      [start[0] + k * q, start[1] + k * p],
    ];
    const small = tri(A, k1);
    const gap = r(1, 3);
    const D: Point =
      layout === "chained"
        ? small[2]
        : layout === "nested"
          ? A
          : [small[2][0] + gap * q, small[2][1] + gap * p];
    const large = tri(D, k2);
    if (!inWindow([...small, ...large])) continue;
    const [first, second] = pick(r, LETTERS);
    return {
      p,
      q,
      b,
      layout,
      k1,
      k2,
      small: { names: first, pts: small },
      large: { names: second, pts: large },
    };
  }
  throw new Error("Need slope triangles that fit the grid");
}

/** Lengths of the legs: horizontal run and vertical rise (positive). */
const runOf = (t: Tri) => t.pts[1][0] - t.pts[0][0];
const riseOf = (t: Tri) => Math.abs(t.pts[2][1] - t.pts[1][1]);

function slopeFigure(s: SlopeSetup): SemanticFigure {
  const all = [...s.small.pts, ...s.large.pts];
  const xs = all.map(([x]) => x),
    ys = all.map(([, y]) => y);
  let g = graph({
    x: [Math.min(...xs) - 1, Math.max(...xs) + 1],
    y: [Math.min(...ys) - 1, Math.max(...ys) + 1],
    grid: 1,
    tick: 5,
    aspect: 1,
    axisNames: ["x", "y"],
  })
    .id("slopes")
    .line({ through: [s.small.pts[0], s.small.pts[2]] }, { label: "ℓ" });
  const labels = new Map<string, { at: Point; names: string[] }>();
  for (const t of [s.small, s.large])
    t.pts.forEach((pt, i) => {
      const key = pt.join(",");
      const entry = labels.get(key) ?? { at: pt, names: [] };
      entry.names.push(t.names[i]!);
      labels.set(key, entry);
    });
  for (const { at, names } of labels.values())
    g = g.point(at[0], at[1], names.join(", "));
  const picture = g
    .slope(s.small.pts[0], s.small.pts[2], "shown")
    .slope(s.large.pts[0], s.large.pts[2], "shown")
    .scene({
      title: "Two slope triangles on line ℓ",
      note: "Each triangle has a horizontal leg, a vertical leg and its third side on ℓ. One unit has the same length on both axes.",
      width: 620,
      maxHeight: 440,
    });
  return { kind: "scene", scene: picture };
}

const triName = (t: Tri) => t.names.join("");
/** The canonical four-step argument, by step. */
function canonicalSteps(s: SlopeSetup): string[] {
  const [a, b, c] = s.small.names;
  const [d, e, f] = s.large.names;
  return [
    `$${a}${b}$ and $${d}${e}$ are horizontal, and $${b}${c}$ and $${e}${f}$ are vertical, so $\\angle ${b}$ and $\\angle ${e}$ are right angles.`,
    `$\\angle ${a} = \\angle ${d}$, because they are corresponding angles where $\\ell$ crosses the parallel segments $${a}${b}$ and $${d}${e}$. So triangles $${triName(s.small)}$ and $${triName(s.large)}$ are similar.`,
    `Corresponding sides of similar triangles are proportional, so $\\frac{${b}${c}}{${a}${b}} = \\frac{${e}${f}}{${d}${e}}$.`,
    `$\\frac{${b}${c}}{${a}${b}}$ and $\\frac{${e}${f}}{${d}${e}}$ are both rise over run, so the slope of $\\ell$ is the same for both triangles.`,
  ];
}
const stepList = (steps: string[]) =>
  steps.map((text, i) => `Step ${i + 1}: ${text}`).join(" ");

const SLOPE_SETUP_TEXT = (s: SlopeSetup) =>
  `Line $\\ell$ has two slope triangles, $${triName(s.small)}$ and $${triName(s.large)}$. A slope triangle is a right triangle with a horizontal leg, a vertical leg and its third side on the line.`;

function slopeExplanation(s: SlopeSetup): string[] {
  const [a, b, c] = s.small.names;
  const [d, e, f] = s.large.names;
  const run1 = runOf(s.small),
    rise1 = riseOf(s.small),
    run2 = runOf(s.large),
    rise2 = riseOf(s.large);
  const scale = s.k2 / s.k1;
  const scaleText = Number.isInteger(scale)
    ? `${scale}`
    : `\\frac{${s.k2}}{${s.k1}}`;
  return [
    `Read the figure: $${a}${b} = ${run1}$ and $${b}${c} = ${rise1}$; $${d}${e} = ${run2}$ and $${e}${f} = ${rise2}$.`,
    `Both triangles have a right angle, at $${b}$ and at $${e}$, where a horizontal leg meets a vertical leg.`,
    `$${a}${b}$ and $${d}${e}$ are both horizontal, so they are parallel. $\\ell$ crosses both, so $\\angle ${a} = \\angle ${d}$: they are corresponding angles (angles in matching positions where one line crosses two parallel lines).`,
    `Two pairs of equal angles make the triangles similar: the large one is the small one scaled by $${scaleText}$.`,
    `So the sides are proportional: $\\frac{${b}${c}}{${a}${b}} = \\frac{${rise1}}{${run1}}$ and $\\frac{${e}${f}}{${d}${e}} = \\frac{${rise2}}{${run2}}$ are equal. Each is rise over run, the slope of $\\ell$; the scale factor cancels.`,
  ];
}

function slopeConstant(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, [
    "missing-reason",
    "proportion",
    "find-the-flaw",
  ] as const);
  if (variant === "missing-reason") {
    const s = slopeSetup(r);
    const [a, b] = s.small.names;
    const [d, e] = s.large.names;
    const steps = canonicalSteps(s);
    const shown = [
      steps[0]!,
      `Triangles $${triName(s.small)}$ and $${triName(s.large)}$ are similar (the same shape, possibly a different size). Why?`,
      steps[2]!,
      steps[3]!,
    ];
    const choices: Choice[] = [
      {
        label: `Each has a right angle, and $\\angle ${a} = \\angle ${d}$: corresponding angles where $\\ell$ crosses parallel $${a}${b}$ and $${d}${e}$.`,
        correct: true,
      },
      {
        label: "Both triangles are right triangles.",
        feedback: `One pair of equal angles is not enough: two right triangles can have different shapes. The argument also needs $\\angle ${a} = \\angle ${d}$.`,
      },
      {
        label: `Their third sides both lie on $\\ell$, so the triangles are congruent.`,
        feedback:
          "Congruent means the same size as well as the same shape. These triangles have different sizes, and lying on one line proves neither.",
      },
      {
        label: "Both triangles have the same slope.",
        feedback:
          "The equal slope is what Step 4 concludes. Using it as the reason for Step 2 assumes the answer.",
      },
    ];
    return finish("slope-constant-similar-triangles", seed, r, {
      prompt: `${SLOPE_SETUP_TEXT(s)} Here is an argument that the slope of $\\ell$ is the same whether you measure it with $${triName(s.small)}$ or with $${triName(s.large)}$. ${stepList(shown)} Which reason justifies Step 2?`,
      figure: slopeFigure(s),
      choices,
      hint: `Step 2 needs two pairs of equal angles to make the triangles similar. The right angles at $${b}$ and $${e}$ are one pair. $${a}${b}$ and $${d}${e}$ are parallel, and $\\ell$ crosses both: what does that say about $\\angle ${a}$ and $\\angle ${d}$?`,
      explanation: [
        ...slopeExplanation(s),
        `"Both are right triangles" gives only one pair of angles. "Congruent" claims the same size, which is false here. "The same slope" assumes the conclusion.`,
      ],
      variant: `${variant}-${s.layout}`,
    });
  }
  if (variant === "proportion") {
    for (let attempt = 0; attempt < 40; attempt++) {
      const s = slopeSetup(r, { notOne: true });
      const [a, b, c] = s.small.names;
      const [d, e, f] = s.large.names;
      const AB = runOf(s.small),
        BC = riseOf(s.small),
        DE = runOf(s.large),
        EF = riseOf(s.large);
      // AC/DF is 1/k; AB/BC is run over rise. Equal would make the decoy true.
      if (s.k1 * BC === s.k2 * AB) continue;
      const choices: Choice[] = [
        {
          label: `$\\frac{${b}${c}}{${a}${b}} = \\frac{${e}${f}}{${d}${e}}$`,
          correct: true,
        },
        {
          label: `$\\frac{${a}${b}}{${b}${c}} = \\frac{${e}${f}}{${d}${e}}$`,
          feedback: `This puts run over rise on the left and rise over run on the right: $\\frac{${AB}}{${BC}}$ is not $\\frac{${EF}}{${DE}}$.`,
        },
        {
          label: `$\\frac{${b}${c}}{${e}${f}} = \\frac{${d}${e}}{${a}${b}}$`,
          feedback: `This pairs sides that do not match: $\\frac{${BC}}{${EF}}$ is the small triangle over the large one, but $\\frac{${DE}}{${AB}}$ is large over small.`,
        },
        {
          label: `$\\frac{${a}${c}}{${d}${f}} = \\frac{${a}${b}}{${b}${c}}$`,
          feedback:
            "The third sides are not the rise or the run. Their ratio is the scale factor between the triangles, not the slope.",
        },
      ];
      return finish("slope-constant-similar-triangles", seed, r, {
        prompt: `${SLOPE_SETUP_TEXT(s)} The right angles are at $${b}$ and $${e}$, and the legs are $${a}${b} = ${AB}$, $${b}${c} = ${BC}$, $${d}${e} = ${DE}$ and $${e}${f} = ${EF}$. The triangles are similar. Which equation must be true because corresponding sides of similar triangles are proportional, and shows that the two slopes are equal?`,
        figure: slopeFigure(s),
        choices,
        hint: `Slope is rise over run. In $${triName(s.small)}$ the rise is $${b}${c} = ${BC}$ and the run is $${a}${b} = ${AB}$. Which equation sets one triangle's rise over run equal to the other's?`,
        explanation: [
          ...slopeExplanation(s),
          `So $\\frac{${b}${c}}{${a}${b}} = \\frac{${e}${f}}{${d}${e}}$: $\\frac{${BC}}{${AB}} = \\frac{${EF}}{${DE}}$. The other equations mix up run and rise, pair sides that do not correspond, or use the third sides.`,
        ],
        variant: `${variant}-${s.layout}`,
      });
    }
    throw new Error("Need a proportion setup");
  }
  const s = slopeSetup(r);
  const [a, b, c] = s.small.names;
  const [d, e, f] = s.large.names;
  const steps = canonicalSteps(s);
  const positions = Math.abs(s.p) === s.q ? [2, 4] : [2, 3, 4];
  const at = pick(r, positions);
  let flaw: string, why: string, tag: string;
  if (at === 2) {
    if (r(0, 1)) {
      flaw = `Triangles $${triName(s.small)}$ and $${triName(s.large)}$ are congruent, because $${a}${c}$ and $${d}${f}$ lie on the same line.`;
      why =
        "Step 2 claims congruent (same size). The triangles have different sizes, and lying on one line proves neither congruence nor similarity.";
      tag = "congruent";
    } else {
      flaw = `Triangles $${triName(s.small)}$ and $${triName(s.large)}$ are similar, because both are right triangles.`;
      why = `Step 2 uses only one pair of equal angles. Two right triangles can have different shapes; the argument needs $\\angle ${a} = \\angle ${d}$ as well.`;
      tag = "one-angle";
    }
  } else if (at === 3) {
    flaw = `Corresponding sides of similar triangles are proportional, so $\\frac{${b}${c}}{${a}${b}} = \\frac{${d}${e}}{${e}${f}}$.`;
    why = `Step 3 flips one ratio: $\\frac{${d}${e}}{${e}${f}}$ is run over rise. Corresponding sides give $\\frac{${b}${c}}{${a}${b}} = \\frac{${e}${f}}{${d}${e}}$.`;
    tag = "reciprocal";
  } else {
    flaw = `The slope of $\\ell$ is $\\frac{${a}${c}}{${d}${f}}$, so it is the same for both triangles.`;
    why =
      "Step 4 uses the third sides. Their ratio is the scale factor between the triangles; slope is rise over run.";
    tag = "hypotenuse";
  }
  const shown = steps.map((text, i) => (i + 1 === at ? flaw : text));
  const choices: Choice[] = [1, 2, 3, 4].map((n) =>
    n === at
      ? { label: `Step ${n}`, correct: true as const }
      : {
          label: `Step ${n}`,
          feedback:
            n === 1
              ? "Step 1 is true: a horizontal leg meets a vertical leg at a right angle."
              : n === 2
                ? "Step 2 is correct: a right angle and a pair of corresponding angles make the triangles similar."
                : n === 3
                  ? "Step 3 is correct: it pairs the rises and the runs, the corresponding sides."
                  : "Step 4 is correct: each ratio is rise over run, which is the slope.",
        },
  );
  return finish("slope-constant-similar-triangles", seed, r, {
    prompt: `${SLOPE_SETUP_TEXT(s)} One step in this argument that the slope of $\\ell$ is the same for both triangles is wrong. ${stepList(shown)} Which step is wrong?`,
    figure: slopeFigure(s),
    choices,
    label: "Choose the wrong step",
    hint: `Step 1 only reads the figure. Check the reason in Steps 2, 3 and 4 against it: are $${triName(s.small)}$ and $${triName(s.large)}$ the same size, does a step use both angle pairs, and does each ratio put a rise over a run?`,
    explanation: [...slopeExplanation(s), why],
    variant: `${variant}-${tag}`,
  });
}

/* --------------------------------- slope-argument-order (multi-part) */

function argumentOrder(seed: string, r: Random): GeneratedProblem {
  const s = slopeSetup(r);
  const [a, b, c] = s.small.names;
  const [d, e, f] = s.large.names;
  const statements = [
    `Draw two slope triangles, $${triName(s.small)}$ and $${triName(s.large)}$, with horizontal and vertical legs.`,
    `Right angles at $${b}$ and $${e}$; $\\angle ${a} = \\angle ${d}$, corresponding angles.`,
    `Two pairs of equal angles, so triangles $${triName(s.small)}$ and $${triName(s.large)}$ are similar.`,
    `Corresponding sides are proportional, so $\\frac{${b}${c}}{${a}${b}} = \\frac{${e}${f}}{${d}${e}}$.`,
    "Each ratio is rise over run, so both give the same slope of $\\ell$.",
  ];
  // The listed order keeps at most one statement in its own step, so the
  // list never reads as the answer.
  let order = shuffle(r, [0, 1, 2, 3, 4]);
  for (let tries = 0; order.filter((v, i) => v === i).length > 1; tries++)
    order = tries < 40 ? shuffle(r, order) : [1, 2, 3, 4, 0];
  const letters = ["a", "b", "c", "d", "e"] as const;
  const options = order.map((i, slot) => ({
    id: letters[slot]!,
    label: statements[i]!,
  }));
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose the statement for each step",
    layout: "slots",
    blanks: [1, 2, 3, 4, 5].map((n) => ({
      id: `s${n}`,
      label: `Step ${n}`,
      options,
    })),
  };
  return finish("slope-argument-order", seed, r, {
    prompt: `${SLOPE_SETUP_TEXT(s)} Put the steps of the explanation in order, to show that the slope of $\\ell$ is the same between any two of its points. Each statement is used once.`,
    figure: slopeFigure(s),
    parts: { response, correct: statements },
    hint: `Each step needs the one before it. You cannot use proportional sides before the triangles are known to be similar, and similarity needs the angles at $${b}$, $${e}$, $${a}$ and $${d}$ first.`,
    explanation: [
      `Step 1: ${statements[0]}`,
      `Step 2: ${statements[1]} The legs $${a}${b}$ and $${d}${e}$ are parallel and $\\ell$ crosses both.`,
      `Step 3: ${statements[2]}`,
      `Step 4: ${statements[3]}`,
      `Step 5: ${statements[4]}`,
      "The order is forced: similarity needs the two angle pairs, the proportion needs similarity, and the slope statement needs the proportion.",
    ],
    variant: `order-${s.layout}`,
  });
}

/* ----------------------------------- derive-line-equation (choice) */

/** TeX of p/q in lowest terms (q > 0). */
function frac(p: number, q: number): string {
  const g = gcd(Math.abs(p), q);
  const n = p / g,
    d = q / g;
  if (d === 1) return `${n}`;
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}
/** TeX of m·x: "3x", "-x", "\frac{3}{2}x". */
function mx(p: number, q: number): string {
  const m = frac(p, q);
  return m === "1" ? "x" : m === "-1" ? "-x" : `${m}x`;
}
/** TeX of y − b with b written as a signed number: y + 4, y - 3. */
const yMinusB = (b: number) => (b < 0 ? `y + ${-b}` : `y - ${b}`);
const xMinusB = (b: number) => (b < 0 ? `x + ${-b}` : `x - ${b}`);
/** TeX of a subtraction that shows a negative b in parentheses: y - (-4), y - 7. */
const minus = (term: string, b: number) => `${term} - ${b < 0 ? `(${b})` : b}`;
const plusB = (b: number) => (b < 0 ? ` - ${-b}` : ` + ${b}`);
/** TeX of m times a number: "\frac{3}{2} \cdot 2", "2", "-2". */
function mTimes(p: number, q: number, n: number): string {
  const m = frac(p, q);
  return m === "1" ? `${n}` : m === "-1" ? `-${n}` : `${m} \\cdot ${n}`;
}

interface LineSetup {
  p: number;
  q: number;
  b: number;
  k: number;
}
function lineSetup(r: Random, zero: boolean, notOne: boolean): LineSetup {
  for (let attempt = 0; attempt < 400; attempt++) {
    const q = r(1, 5);
    const p = r(1, 4) * (r(0, 1) ? 1 : -1);
    if (gcd(Math.abs(p), q) !== 1 || Math.abs(p) > 3 * q) continue;
    if (notOne && Math.abs(p) === q) continue;
    const b = zero ? 0 : r(-7, 7);
    if (!zero && b === 0) continue;
    const k = r(2, 3);
    const pts: Point[] = [
      [0, b],
      [q, b + p],
      [k * q, b + k * p],
    ];
    if (!inWindow(pts)) continue;
    return { p, q, b, k };
  }
  throw new Error("Need a line that fits the grid");
}

function lineFigure(l: LineSetup): SemanticFigure {
  const P: Point = [l.k * l.q, l.b + l.k * l.p];
  const xs = [0, l.q, P[0]],
    ys = [0, l.b, l.b + l.p, P[1]];
  const picture = graph({
    x: [Math.min(...xs) - 1, Math.max(...xs) + 1],
    y: [Math.min(...ys) - 1, Math.max(...ys) + 1],
    grid: 1,
    tick: 5,
    aspect: 1,
    axisNames: ["x", "y"],
  })
    .id("line")
    .line({ through: [[0, l.b], P] })
    .point(0, l.b, l.b === 0 ? "O" : `(0, ${prose(l.b)})`, { color: "gold" })
    .point(P[0], P[1], "(x, y)", { color: "accent" })
    .slope([0, l.b], [l.q, l.b + l.p], "shown")
    .slope([0, l.b], P, "none")
    .scene({
      title:
        l.b === 0 ? "A line through the origin" : "A line crossing the y-axis",
      note: "The small slope triangle shows the run and rise; the point (x, y) stands for any point on the line.",
      width: 620,
      maxHeight: 440,
    });
  return { kind: "scene", scene: picture };
}

function deriveLine(seed: string, r: Random): GeneratedProblem {
  const variant = pick(r, [
    "origin-reason",
    "intercept-step",
    "intercept-slope",
    "origin-explanation",
    "intercept-flaw",
  ] as const);
  const origin =
    variant === "origin-reason" || variant === "origin-explanation";
  const l = lineSetup(
    r,
    origin,
    variant !== "intercept-step" && variant !== "intercept-flaw",
  );
  const { p, q, b } = l;
  const m = frac(p, q);
  // A whole-number slope is prose ("slope 2"); a fraction is typeset.
  const mText = Number.isInteger(p / q) ? prose(p / q) : `$${m}$`;
  const figure = lineFigure(l);
  if (variant === "origin-reason") {
    if (p === q) throw new Error("Need a slope other than 1");
    const steps = [
      `The line passes through $O(0, 0)$ and has slope ${mText}.`,
      "Let $(x, y)$ be any other point on the line.",
      "The slope between $O$ and $(x, y)$ is $\\frac{y - 0}{x - 0} = \\frac{y}{x}$.",
      "[missing]",
      `So $\\frac{y}{x} = ${m}$, and multiplying both sides by $x$ gives $y = ${mx(p, q)}$.`,
    ];
    const choices: Choice[] = [
      {
        label: `The slope is the same between any two points of a line (slope triangles are similar), so $\\frac{y}{x} = ${m}$.`,
        correct: true,
      },
      {
        label: `$(x, y)$ is on the line, so $x = ${q}$ and $y = ${p}$.`,
        feedback: `$(x, y)$ stands for any point on the line. $(${q}, ${p})$ is only one of them.`,
      },
      {
        label: `The two slope triangles are congruent, so $y = ${p}$ and $x = ${q}$.`,
        feedback:
          "The slope triangles have different sizes. They are similar, not congruent, so their sides are proportional, not equal.",
      },
      {
        label: "$O$ is the origin, so $x$ and $y$ are equal.",
        feedback: `A line through the origin does not have to be $y = x$. This line has slope ${mText}.`,
      },
    ];
    return finish("derive-line-equation", seed, r, {
      prompt: `A line passes through the origin with slope ${mText}. Here is a derivation of its equation. ${stepList(steps)} Which statement belongs at Step 4 so that Step 5 follows?`,
      figure,
      choices,
      hint: `The slope between $(0, 0)$ and $(x, y)$ is $\\frac{y}{x}$. Why must it equal the slope from the small triangle, run ${q} and rise ${prose(p)}?`,
      explanation: [
        "Step 2 takes any point $(x, y)$ on the line, so $x$ and $y$ stay letters.",
        "Step 3 finds the slope from $O$ to $(x, y)$: the change in $y$ over the change in $x$, $\\frac{y}{x}$.",
        `The slope of a line is the same between any two of its points, because its slope triangles are similar. The small triangle has run ${q} and rise ${prose(p)}, so the slope is ${mText}.`,
        `So Step 4 is $\\frac{y}{x} = ${m}$, and multiplying by $x$ gives $y = ${mx(p, q)}$.`,
        `Check: $(${q}, ${p})$ is on the line, and $${p} = ${mTimes(p, q, q)}$.`,
        "Fixing $x$ and $y$ at one point, calling the triangles congruent, or saying $x = y$ all fail: the triangles are only similar, and this line is not $y = x$.",
      ],
      variant,
    });
  }
  if (variant === "intercept-step") {
    const steps = [
      `The line crosses the $y$-axis at $(0, ${b})$.`,
      "Let $(x, y)$ be any other point on the line.",
      `The slope between $(0, ${b})$ and $(x, y)$ is $\\frac{${minus("y", b)}}{x - 0} = \\frac{${yMinusB(b)}}{x}$.`,
      `The slope is the same everywhere on the line, so $\\frac{${yMinusB(b)}}{x} = ${m}$.`,
      "[missing]",
      `So $y = ${mx(p, q)}${plusB(b)}$.`,
    ];
    const over =
      q === 1 || frac(p, q).indexOf("frac") < 0
        ? `\\frac{${p}}{x}`
        : `${p < 0 ? "-" : ""}\\frac{${Math.abs(p)}}{${q}x}`;
    const choices: Choice[] = [
      { label: `$${yMinusB(b)} = ${mx(p, q)}$`, correct: true },
      {
        label: `$${yMinusB(b)} = ${m} + x$`,
        feedback:
          "Dividing by $x$ is undone by multiplying by $x$, not by adding $x$.",
      },
      {
        label: `$y = ${mx(p, q)}${plusB(-b)}$`,
        feedback: `Moving $${b < 0 ? `+${-b}` : `-${b}`}$ to the other side changes its sign: the result is $y = ${mx(p, q)}${plusB(b)}$. This step also skips multiplying by $x$.`,
      },
      {
        label: `$${yMinusB(b)} = ${over}$`,
        feedback:
          "To undo dividing by $x$, multiply both sides by $x$; do not divide again.",
      },
    ];
    return finish("derive-line-equation", seed, r, {
      prompt: `A line has slope ${mText} and crosses the $y$-axis at $(0, ${b})$. Here is a derivation of its equation. ${stepList(steps)} Which equation is Step 5?`,
      figure,
      choices,
      hint: `Step 4 says $\\frac{${yMinusB(b)}}{x} = ${m}$. What can you do to both sides to undo dividing by $x$?`,
      explanation: [
        `Step 3 is the slope from $(0, ${b})$ to $(x, y)$: the change in $y$ is $${yMinusB(b)}$ and the change in $x$ is $x - 0 = x$.`,
        `Step 4 sets it equal to ${mText}, because a line's slope is the same between any two of its points.`,
        `Multiply both sides by $x$ to undo the division: $${yMinusB(b)} = ${mx(p, q)}$. That is Step 5.`,
        `Then ${b < 0 ? `subtract ${-b} from` : `add ${b} to`} both sides: $y = ${mx(p, q)}${plusB(b)}$.`,
        `Check with the point $(${q}, ${b + p})$: $${mTimes(p, q, q)}${plusB(b)} = ${b + p}$.`,
      ],
      variant,
    });
  }
  if (variant === "intercept-slope") {
    const atConcrete = (
      top: (x: number, y: number) => number,
      bottom: (x: number, y: number) => number,
    ) => {
      const x = q,
        y = b + p;
      const den = bottom(x, y);
      return den === 0 ? null : top(x, y) / den;
    };
    const candidates: {
      label: string;
      value: number | null;
      feedback: string;
    }[] = [
      {
        label: `$\\frac{${yMinusB(b)}}{${xMinusB(b)}}$`,
        value: atConcrete(
          (x, y) => y - b,
          (x) => x - b,
        ),
        feedback: `${prose(b)} is a $y$-value, so subtract it only from $y$. The $x$-value of $(0, ${b})$ is 0.`,
      },
      {
        label: `$\\frac{x}{${yMinusB(b)}}$`,
        value: atConcrete(
          (x) => x,
          (x, y) => y - b,
        ),
        feedback:
          "This is run over rise. Slope is the change in $y$ over the change in $x$.",
      },
      {
        label: "$\\frac{y}{x}$",
        value: atConcrete(
          (x, y) => y,
          (x) => x,
        ),
        feedback: `$\\frac{y}{x}$ is the slope from $(0, 0)$, not from $(0, ${b})$. This line does not pass through the origin.`,
      },
      {
        label: `$\\frac{y}{${xMinusB(b)}}$`,
        value: atConcrete(
          (x, y) => y,
          (x) => x - b,
        ),
        feedback: `This treats ${prose(b)} as a point on the $x$-axis. The line crosses the $y$-axis at $(0, ${b})$.`,
      },
    ];
    const slope = p / q;
    const usable = candidates.filter(
      (c) => c.value !== null && Math.abs(c.value - slope) > 1e-9,
    );
    if (usable.length < 3)
      throw new Error("Need three wrong slope expressions");
    const wrong = shuffle(r, usable).slice(0, 3);
    const choices: Choice[] = [
      { label: `$\\frac{${yMinusB(b)}}{x}$`, correct: true },
      ...wrong.map((c) => ({ label: c.label, feedback: c.feedback })),
    ];
    return finish("derive-line-equation", seed, r, {
      prompt: `A line crosses the $y$-axis at $(0, ${b})$, and $(x, y)$ is any other point on the line. Which expression is the slope between $(0, ${b})$ and $(x, y)$?`,
      figure,
      choices,
      hint: `Slope is the change in $y$ over the change in $x$. Going from $(0, ${b})$ to $(x, y)$, $y$ changes by $${minus("y", b)}$. What is the change in $x$ when you start at $x = 0$?`,
      explanation: [
        `The slope from $(0, ${b})$ to $(x, y)$ is the change in $y$ over the change in $x$.`,
        `The change in $y$ is $${minus("y", b)}${b < 0 ? ` = ${yMinusB(b)}` : ""}$. The change in $x$ is $x - 0 = x$.`,
        `So the slope is $\\frac{${yMinusB(b)}}{x}$.`,
        `Check with the point $(${q}, ${b + p})$ on the line: $\\frac{${minus(String(b + p), b)}}{${q}} = ${m}$, the slope of the line.`,
        `$\\frac{y}{x}$ would be the slope from the origin, and putting $x$ on top is run over rise.`,
      ],
      variant,
    });
  }
  if (variant === "origin-explanation") {
    const choices: Choice[] = [
      {
        label: `The slope from $(0, 0)$ to any $(x, y)$ is $y/x$. Slope is constant, so $y/x = ${m}$ and $y = ${mx(p, q)}$.`,
        correct: true,
      },
      {
        label: `Its $y$-intercept is 0, so $b = 0$ in $y = mx + b$, which gives $y = ${mx(p, q)}$.`,
        feedback:
          "This assumes that every line has an equation $y = mx + b$, which is what a derivation must show. It is circular.",
      },
      {
        label: `The point $(${q}, ${p})$ is on the line and $${p} = ${mTimes(p, q, q)}$, so $y = ${mx(p, q)}$.`,
        feedback:
          "Checking one point does not show the rule for every point on the line.",
      },
      {
        label: `For any point $(x, y)$ on it, $x/y = ${m}$, so $y = ${mx(p, q)}$.`,
        feedback: `$x/y$ is run over rise. And $x/y = ${m}$ would give $y = ${mx(q * Math.sign(p), Math.abs(p))}$, not $y = ${mx(p, q)}$.`,
      },
    ];
    if (choices.some((c) => c.label.length > 120))
      throw new Error("Need a shorter slope");
    return finish("derive-line-equation", seed, r, {
      prompt: `A line passes through the origin with slope ${mText}. Which explanation shows why every point $(x, y)$ on the line satisfies $y = ${mx(p, q)}$?`,
      figure,
      choices,
      hint: `What is the slope between $(0, 0)$ and a general point $(x, y)$? Why must it equal ${mText} for every point, not only for $(${q}, ${p})$?`,
      explanation: [
        "Take any point $(x, y)$ on the line; $x$ and $y$ stay letters, so the reasoning covers every point.",
        "The slope from $(0, 0)$ to $(x, y)$ is $\\frac{y - 0}{x - 0} = \\frac{y}{x}$.",
        `A line's slope is the same between any two of its points (its slope triangles are similar), so $\\frac{y}{x} = ${m}$.`,
        `Multiplying by $x$ gives $y = ${mx(p, q)}$.`,
        "Using $y = mx + b$ assumes the result; one point proves nothing about the others; and $\\frac{x}{y}$ is run over rise.",
      ],
      variant,
    });
  }
  // intercept-flaw: one of steps 3–6 is replaced by a flawed version.
  const steps = [
    `The line crosses the $y$-axis at $(0, ${b})$.`,
    "Let $(x, y)$ be any other point on the line.",
    `The slope between $(0, ${b})$ and $(x, y)$ is $\\frac{${minus("y", b)}}{x - 0} = \\frac{${yMinusB(b)}}{x}$.`,
    `The slope is the same everywhere on the line, so $\\frac{${yMinusB(b)}}{x} = ${m}$.`,
    `Multiply both sides by $x$: $${yMinusB(b)} = ${mx(p, q)}$.`,
    `${b < 0 ? `Subtract ${-b} from` : `Add ${b} to`} both sides: $y = ${mx(p, q)}${plusB(b)}$.`,
  ];
  const positions = p === b * q ? [3, 5, 6] : [3, 4, 5, 6];
  const at = pick(r, positions);
  let flaw: string, why: string, tag: string;
  if (at === 3) {
    if (r(0, 1)) {
      flaw = `The slope between $(0, ${b})$ and $(x, y)$ is $\\frac{${minus("y", b)}}{${minus("x", b)}} = \\frac{${yMinusB(b)}}{${xMinusB(b)}}$.`;
      why = `Step 3 subtracts $${b}$ from $x$. The point $(0, ${b})$ has $x$-value 0, so the change in $x$ is $x - 0 = x$.`;
      tag = "b-from-x";
    } else {
      flaw = `The slope between $(0, ${b})$ and $(x, y)$ is $\\frac{x - 0}{${minus("y", b)}} = \\frac{x}{${yMinusB(b)}}$.`;
      why =
        "Step 3 puts the change in $x$ on top. Slope is the change in $y$ over the change in $x$.";
      tag = "run-over-rise";
    }
  } else if (at === 4) {
    flaw = `The slope is the same everywhere on the line, so $\\frac{${yMinusB(b)}}{x} = ${b}$.`;
    why = `Step 4 sets the slope equal to ${prose(b)}, the $y$-intercept. The slope is ${mText}.`;
    tag = "intercept-as-slope";
  } else if (at === 5) {
    flaw = `Multiply both sides by $x$: $${yMinusB(b)} = ${m} + x$.`;
    why = `Step 5 adds $x$ instead of multiplying by $x$. It should be $${yMinusB(b)} = ${mx(p, q)}$.`;
    tag = "add-for-multiply";
  } else {
    flaw = `${b < 0 ? `Subtract ${-b} from` : `Add ${b} to`} both sides: $y = ${mx(p, q)}${plusB(-b)}$.`;
    why = `Step 6 gets the sign of the ${Math.abs(b)} wrong. ${b < 0 ? `Subtracting ${-b}` : `Adding ${b}`} on both sides gives $y = ${mx(p, q)}${plusB(b)}$.`;
    tag = "sign-slip";
  }
  const shown = steps.map((text, i) => (i + 1 === at ? flaw : text));
  const choices: Choice[] = [3, 4, 5, 6].map((n) =>
    n === at
      ? { label: `Step ${n}`, correct: true as const }
      : {
          label: `Step ${n}`,
          feedback:
            n === 3
              ? "Step 3 is correct: change in $y$ over change in $x$ from $(0, b)$."
              : n === 4
                ? `Step 4 is correct: the slope is ${mText} between any two points.`
                : n === 5
                  ? "Step 5 is correct: multiplying both sides by $x$ undoes the division."
                  : "Step 6 is correct: it does the same thing to both sides.",
        },
  );
  return finish("derive-line-equation", seed, r, {
    prompt: `A line has slope ${mText} and crosses the $y$-axis at $(0, ${b})$. One step of this derivation of its equation is wrong. ${stepList(shown)} Which step is wrong?`,
    figure,
    choices,
    label: "Choose the wrong step",
    hint: `Check each step from Step 3 on. Is the slope the change in $y$ over the change in $x$ from $(0, ${b})$, is it set equal to ${mText}, and is each equation step done the same way to both sides?`,
    explanation: [
      `From $(0, ${b})$ to $(x, y)$, the slope is $\\frac{${yMinusB(b)}}{x}$, and it equals ${mText} because a line's slope is the same everywhere.`,
      `Multiplying by $x$ gives $${yMinusB(b)} = ${mx(p, q)}$; then $y = ${mx(p, q)}${plusB(b)}$.`,
      why,
      `Check with the point $(${q}, ${b + p})$: $${mTimes(p, q, q)}${plusB(b)} = ${b + p}$.`,
    ],
    variant: `${variant}-${tag}`,
  });
}

/* ------------------------------------------------------ dispatch */

const generators: Record<
  string,
  (seed: string, r: Random) => GeneratedProblem
> = {
  "percent-change-multiplier-form": multiplierForm,
  "percent-change-multiplier-entry": multiplierEntry,
  "expression-form-insight": formInsight,
  "expression-form-two-part": formTwoPart,
  "percent-rewrite-reasoning": rewriteReasoning,
  "slope-constant-similar-triangles": slopeConstant,
  "slope-argument-order": argumentOrder,
  "derive-line-equation": deriveLine,
};

export function generateAlgebraFormReasoning(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate) throw new Error(`Unknown algebra-form template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that cannot make a valid item is redrawn from a salted stream.
  for (let attempt = 0; attempt < 60; attempt++) {
    const salt = attempt ? `${seed}#${attempt}` : seed;
    try {
      return generate(seed, random(templateId, salt));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
