import { withArticle } from "./agreement";
import { createHash } from "node:crypto";
import { nounFor } from "./agreement";

/** A measured gap with a unit that agrees: "1 hour", "2 hours". */
export function yAmount(n: number | string, unit: string): string {
  const singular: Record<string, string> = {
    hours: "hour",
    cups: "cup",
    inches: "inch",
    centimeters: "centimeter",
    "thousand dollars": "thousand dollar",
    "test-score points": "test-score point",
  };
  const value = typeof n === "number" ? n : Number(n);
  const one = singular[unit];
  return `${n} ${one ? nounFor(value, one, unit) : nounFor(value, unit)}`;
}
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  figureOptionIds,
  figureOptionLetters,
  type FigureChoiceResponse,
} from "./figure-choice";
import {
  serializeMultiPart,
  type MultiPartBlank,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { graph } from "./scene/author";
import { sceneSchema, type Scene } from "./scene/spec";
import { storyName } from "./story-kit/names";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes";

/**
 * Describing a distribution (6.SP.A.2) and judging a trend line's fit
 * (8.SP.A.2).
 *
 * Dot plots come from a fixed table of stack patterns, one family per shape:
 * every pattern has a whole-number middle value, 13 to 22 dots, a spread of 8
 * or 10, and stacks no taller than 6. Scatter clouds are whole-number points
 * around a hidden line with balanced noise; every line drawn and every claim
 * made about it is checked against the points before the problem is built.
 * The interactive fitter in trend-line-fit-practice.ts shares these clouds;
 * its separate response protocol grades informal fits by vertical closeness.
 */

const band = "6–8" as const;
const parts = {
  requiredResponseCapability: "multi-part-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};
const figures = {
  requiredResponseCapability: "figure-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};
const choice = {
  requiredResponseCapability: "single-choice-v1" as const,
  requiredFigureCapability: "scenes-v1" as const,
};

export const distributionShapeFitTemplates: readonly TemplateMetadata[] = [
  {
    id: "distribution-describe-dot-plot",
    version: 1,
    title: "Describe a distribution by center, spread and shape",
    skillId: "describe-distributions",
    gradeBand: band,
    description:
      "Read a dot plot of data collected for a statistical question. Choose the value the data are centered around, the statement that gives their spread, and the statement that gives their overall shape: symmetric, piled to one side with a tail, two clusters, or flat.",
    ...parts,
  },
  {
    id: "distribution-match-description",
    version: 1,
    title: "Match a description to its dot plot",
    skillId: "describe-distributions",
    gradeBand: band,
    description:
      "A description gives the center, the spread and the shape of some data. Choose the one dot plot that matches all three. Each other plot misses exactly one: it is shifted, narrower, or a different shape.",
    ...figures,
  },
  {
    id: "distribution-read-description",
    version: 1,
    title: "Choose the complete description of a dot plot",
    skillId: "describe-distributions",
    gradeBand: band,
    description:
      "Read a dot plot and choose the description that is correct and complete. Each wrong description changes exactly one of the center, the spread or the shape.",
    ...choice,
  },
  {
    id: "statistical-question-distribution-answer",
    version: 1,
    title: "A statistical question is answered by a distribution",
    skillId: "describe-distributions",
    gradeBand: band,
    description:
      "From a dot plot of data that vary, choose the statistical question the data answer, then the statement that answers it with center, spread and shape rather than one number.",
    ...parts,
  },
  {
    id: "trend-line-best-fit-choice",
    version: 1,
    title: "Choose the line that fits the data best",
    skillId: "scatterplots",
    gradeBand: band,
    description:
      "Four graphs show the same scatter plot with different lines. Choose the line that goes through the middle of the points and stays close to them all along. The other lines sit above or below the cloud, tilt too much or too little, connect two dots, or stay flat.",
    ...figures,
  },
  {
    id: "trend-line-fit-assess",
    version: 1,
    title: "Judge how well a line fits the data",
    skillId: "scatterplots",
    gradeBand: band,
    description:
      "A scatter plot has one line drawn on it. Choose the statement that correctly judges how well the line fits, by how close the points are and whether they lie on both sides of it. Some clouds curve, so no straight line fits them.",
    ...choice,
  },
];
const metaOf = (id: string) =>
  distributionShapeFitTemplates.find((t) => t.id === id)!;

/* ------------------------------------------------------------ helpers */

const letters = ["a", "b", "c", "d", "e", "f"] as const;
const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
const ordinal = (k: number) => {
  const tens = k % 100;
  if (tens >= 11 && tens <= 13) return `${k}th`;
  return `${k}${["th", "st", "nd", "rd"][k % 10] ?? "th"}`;
};
/** A short whole or one-place decimal for prose. */
const short = (v: number) => {
  const t = Math.round(v * 10) / 10;
  return Number.isInteger(t) ? `${t}` : t.toFixed(1);
};
const plain = (v: number) => (v < 0 ? `−${-v}` : `${v}`);

function problemId(meta: TemplateMetadata, seed: string) {
  return createHash("sha256")
    .update(JSON.stringify([meta.id, meta.version, seed]))
    .digest("hex");
}
type Option = { label: string; correct?: true; feedback?: string };
/** A single-choice problem: the options shuffled with the seed. */
function choiceProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    figure: SemanticFigure;
    options: Option[];
    hint: string;
    explanation: string[];
  },
): GeneratedProblem {
  if (new Set(built.options.map((o) => o.label)).size !== built.options.length)
    throw new Error("Need distinct options");
  const order = shuffle(r, [...built.options]);
  const feedback: Record<string, string> = {};
  let answer = "";
  const options = order.map((o, i) => {
    const id = `option-${"abcd"[i]}`;
    if (o.correct) answer = id;
    else feedback[id] = o.feedback!;
    return { id, label: o.label };
  });
  return {
    public: {
      id: problemId(meta, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response: { kind: "choice", label: "Choose one answer", options },
      figure: built.figure,
    },
    answer,
    explanation: built.explanation,
    hint: built.hint,
    choiceFeedback: feedback,
  };
}
type Blank = {
  id: string;
  label: string;
  options: Option[];
};
/** A multi-part problem in labeled slots; each blank's options shuffled. */
function partsProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    figure: SemanticFigure;
    blanks: Blank[];
    hint: string;
    explanation: string[];
  },
): GeneratedProblem {
  const key: Record<string, string> = {};
  const blanks: MultiPartBlank[] = built.blanks.map((b) => {
    if (new Set(b.options.map((o) => o.label)).size !== b.options.length)
      throw new Error("Need distinct part options");
    const order = shuffle(r, [...b.options]);
    const options = order.map((o, i) => {
      if (o.correct) key[b.id] = letters[i]!;
      return { id: letters[i]!, label: o.label };
    });
    return { id: b.id, label: b.label, options };
  });
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each part",
    layout: "slots",
    blanks,
  };
  return {
    public: {
      id: problemId(meta, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
      figure: built.figure,
    },
    answer: serializeMultiPart(response, key),
    explanation: built.explanation,
    hint: built.hint,
  };
}
type Card = {
  description: string;
  scene: Scene;
  correct?: true;
  /** Names the misconception; given the card's name ("Graph B"). */
  feedback?: (name: string) => string;
  /** One explanation line about this card; given its name. */
  line: (name: string) => string;
};
/** A figure-choice problem: cards shuffled, lettered by position. */
function cardsProblem(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
  built: {
    prompt: string;
    label: string;
    cards: Card[];
    hint: string;
    lead: string[];
  },
): GeneratedProblem {
  const cards = built.cards;
  if (
    new Set(cards.map((c) => c.description)).size !== cards.length ||
    new Set(cards.map((c) => JSON.stringify(c.scene.elements))).size !==
      cards.length
  )
    throw new Error("Need distinct cards");
  const order = shuffle(r, [...cards]);
  const name = (c: Card) => `Graph ${figureOptionLetters[order.indexOf(c)]!}`;
  const id = (c: Card) => figureOptionIds[order.indexOf(c)]!;
  const response: FigureChoiceResponse = {
    kind: "figure-choice",
    label: built.label,
    noun: "Graph",
    options: order.map((c) => ({
      id: id(c),
      label: c.description,
      scene: c.scene,
    })),
  };
  const correct = cards.find((c) => c.correct)!;
  return {
    public: {
      id: problemId(meta, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: built.prompt,
      skillId: meta.skillId,
      response,
    },
    answer: id(correct),
    explanation: [
      ...built.lead,
      ...order.filter((c) => !c.correct).map((c) => c.line(name(c))),
      correct.line(name(correct)),
    ],
    hint: built.hint,
    choiceFeedback: Object.fromEntries(
      cards.filter((c) => !c.correct).map((c) => [id(c), c.feedback!(name(c))]),
    ),
  };
}
/** Card size: drawn at this width so labels keep their full size. */
const CARD = { width: 264, maxHeight: 280 } as const;

/** Redraw from a salted stream when a draw cannot meet every rule; the saved
 * seed and the axis values never change. */
function withRetries(
  templateId: string,
  seed: string,
  build: (r: Random) => GeneratedProblem,
): GeneratedProblem {
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = random(templateId, attempt ? `${seed}#${attempt}` : seed);
    try {
      return build(r);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  }
  throw new Error(`${templateId}: no instance for ${seed}`);
}

/* ---------------------------------------------------- distributions */

export const shapeFamilies = [
  "symmetric",
  "tail-high",
  "tail-low",
  "two-clusters",
  "uniform",
] as const;
export type ShapeFamily = (typeof shapeFamilies)[number];
const reversed = (rows: number[][]) => rows.map((p) => [...p].reverse());
const TAIL_HIGH = [
  [2, 5, 4, 3, 2, 1, 1, 1, 1],
  [3, 6, 4, 2, 1, 1, 1, 1, 1],
  [1, 4, 5, 3, 2, 1, 1, 1, 1],
  [2, 4, 3, 2, 2, 1, 1, 1, 1, 1, 1],
];
/** Stack heights at consecutive values, left to right. The second
 * two-clusters pattern of the design ([1, 3, 2, 0, 0, 0, 2, 3, 1]) had only
 * 12 dots; it is [1, 3, 3, 0, 0, 0, 3, 3, 1] here. */
export const PATTERNS: Record<ShapeFamily, readonly number[][]> = {
  symmetric: [
    [1, 1, 2, 3, 4, 3, 2, 1, 1],
    [1, 2, 2, 3, 5, 3, 2, 2, 1],
    [1, 1, 2, 4, 5, 4, 2, 1, 1],
    [1, 1, 2, 2, 3, 4, 3, 2, 2, 1, 1],
  ],
  "tail-high": TAIL_HIGH,
  "tail-low": reversed(TAIL_HIGH),
  "two-clusters": [
    [2, 3, 2, 0, 0, 0, 2, 3, 2],
    [1, 3, 3, 0, 0, 0, 3, 3, 1],
    [2, 4, 2, 0, 0, 0, 2, 4, 2],
    [2, 3, 2, 0, 0, 0, 0, 0, 2, 3, 2],
  ],
  uniform: [
    [2, 2, 2, 2, 2, 2, 2, 2, 2],
    [2, 2, 1, 2, 2, 2, 1, 2, 2],
    [1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1],
  ],
};
/** The narrow pattern of each family (spread 4): the "spread ignored" plot. */
const NARROW: Record<ShapeFamily, number[]> = {
  symmetric: [2, 4, 6, 4, 2],
  "tail-high": [4, 6, 4, 3, 2],
  "tail-low": [2, 3, 4, 6, 4],
  "two-clusters": [2, 3, 0, 3, 2],
  uniform: [3, 3, 3, 3, 3],
};
/** Completes "The data are …". All five are 54 or 55 characters. */
export const SHAPE_PHRASE: Record<ShapeFamily, string> = {
  symmetric: "roughly symmetric: one mound, about even on both sides",
  "tail-high": "piled up at low values, with a tail toward high values",
  "tail-low": "piled up at high values, with a tail toward low values",
  "two-clusters": "in two separate clusters, with an empty gap between them",
  uniform: "flat, with about the same number of dots at every value",
};
/** A shorter form for the one-line answer to a statistical question. */
export const SHAPE_SHORT: Record<ShapeFamily, string> = {
  symmetric: "one mound, about even on both sides",
  "tail-high": "piled at low values, tail toward high",
  "tail-low": "piled at high values, tail toward low",
  "two-clusters": "two clusters with a gap between them",
  uniform: "flat, about the same at every value",
};
const capital = (s: string) => s[0]!.toUpperCase() + s.slice(1);

type Context = {
  id: string;
  question: string;
  /** "asked the students in one class" (then: a statistical question). */
  asked: string;
  /** "students in one class" (collected these data from the …). */
  from: string;
  member: string;
  members: string;
  unit: string;
  one: string;
  axis: string;
  low: number;
  high: number;
  single: (name: string) => string;
  count: string;
  largest: string;
};
export const distributionContexts: readonly Context[] = [
  {
    id: "books",
    question: "How many books did each student in the class read last month?",
    asked: "asked the students in one class",
    from: "students in one class",
    member: "student",
    members: "students",
    unit: "books",
    one: "book",
    axis: "Books read",
    low: 0,
    high: 16,
    single: (n) => `How many books did ${n} read last month?`,
    count: "How many students are in the class?",
    largest: "What is the most books anyone could read in a month?",
  },
  {
    id: "walk",
    question:
      "How many minutes does each student in the class take to get to school?",
    asked: "asked the students in one class",
    from: "students in one class",
    member: "student",
    members: "students",
    unit: "minutes",
    one: "minute",
    axis: "Minutes to school",
    low: 3,
    high: 20,
    single: (n) => `How many minutes does ${n} take to get to school?`,
    count: "How many students are in the class?",
    largest: "What is the longest anyone could take to get to school?",
  },
  {
    id: "goals",
    question: "How many goals did each player on the team score this season?",
    asked: "asked the players on one soccer team",
    from: "players on one soccer team",
    member: "player",
    members: "players",
    unit: "goals",
    one: "goal",
    axis: "Goals scored",
    low: 0,
    high: 15,
    single: (n) => `How many goals did ${n} score this season?`,
    count: "How many players are on the team?",
    largest: "What is the most goals anyone could score in a season?",
  },
  {
    id: "plants",
    question:
      "How tall, in centimeters, is each bean plant in the class after three weeks?",
    asked: "measured the bean plants grown by one class to answer",
    from: "bean plants grown by one class",
    member: "plant",
    members: "plants",
    unit: "centimeters",
    one: "centimeter",
    axis: "Height (centimeters)",
    low: 4,
    high: 20,
    single: (n) => `How tall is ${n}'s bean plant after three weeks?`,
    count: "How many bean plants did the class grow?",
    largest: "What is the tallest a bean plant could ever grow?",
  },
  {
    id: "screen",
    question:
      "How many hours of screen time did each student in the class have last week?",
    asked: "asked the students in one class",
    from: "students in one class",
    member: "student",
    members: "students",
    unit: "hours",
    one: "hour",
    axis: "Hours of screen time",
    low: 1,
    high: 18,
    single: (n) => `How many hours of screen time did ${n} have last week?`,
    count: "How many students are in the class?",
    largest: "What is the most screen time anyone could have in a week?",
  },
];

export type Dist = {
  family: ShapeFamily;
  pattern: number[];
  start: number;
  values: number[];
  n: number;
  min: number;
  max: number;
  range: number;
  median: number;
  mode: number;
  /** True when one stack is strictly the tallest. */
  modeUnique: boolean;
  tallest: number;
  mean: number;
};
/** The data a pattern describes when its first stack sits at `start`. */
export function distOf(
  family: ShapeFamily,
  pattern: readonly number[],
  start: number,
): Dist {
  const values = pattern.flatMap((c, i) =>
    Array.from({ length: c }, () => start + i),
  );
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const median =
    n % 2 ? sorted[(n - 1) / 2]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
  if (!Number.isInteger(median)) throw new Error("Need a whole-number median");
  const tallest = Math.max(...pattern);
  const at = pattern.indexOf(tallest);
  return {
    family,
    pattern: [...pattern],
    start,
    values,
    n,
    min: sorted[0]!,
    max: sorted[n - 1]!,
    range: sorted[n - 1]! - sorted[0]!,
    median,
    mode: start + at,
    modeUnique: pattern.filter((c) => c === tallest).length === 1,
    tallest,
    mean: values.reduce((a, b) => a + b, 0) / n,
  };
}
const dotScene = (
  min: number,
  max: number,
  values: number[],
  unit: string,
  options: { title?: string; card?: boolean } = {},
): Scene =>
  sceneSchema.parse({
    v: 1,
    ...(options.title ? { title: options.title } : {}),
    ...(options.card ? CARD : { maxHeight: 360 }),
    elements: [
      {
        type: "dotPlot",
        id: "plot",
        min,
        max,
        mark: "dot",
        groups: [{ values }],
        unit,
      },
    ],
  });
/** "1 at 3, 2 at 4, …": every value with at least one dot, left to right. */
const countsText = (values: readonly number[]) => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => a - b)
    .map((v) => `${counts.get(v)} at ${v}`)
    .join(", ");
};
/** What each of the three explanation lines says about the data. */
function centerLine(d: Dist): string {
  const sorted = [...d.values].sort((a, b) => a - b);
  if (d.n % 2) {
    const k = (d.n + 1) / 2;
    return `Center: there are ${d.n} dots. Counting from the left, the middle dot is the ${ordinal(k)}, and it lands on ${d.median}. The data are centered around ${d.median}.`;
  }
  const k = d.n / 2;
  const [a, b] = [sorted[k - 1]!, sorted[k]!];
  return a === b
    ? `Center: there are ${d.n} dots. Counting from the left, the two middle dots, the ${ordinal(k)} and the ${ordinal(k + 1)}, both land on ${d.median}. The data are centered around ${d.median}.`
    : `Center: there are ${d.n} dots. The two middle dots, the ${ordinal(k)} and the ${ordinal(k + 1)}, are at ${a} and ${b}. Halfway between them is ${d.median}, in the empty gap, so the data are centered around ${d.median}. The center of a distribution does not have to be a data value.`;
}
function spreadLine(d: Dist, ctx: Context): string {
  return `Spread: the smallest value is ${d.min} and the largest is ${d.max}. The data spread over $${d.max} - ${d.min} = ${d.range}$ ${ctx.unit}. Spread is about the dots, not about how far the number line runs.`;
}
function shapeLine(d: Dist): string {
  const p = d.pattern;
  switch (d.family) {
    case "symmetric":
      return `Shape: the tallest stack is at ${d.mode}, and the stacks get shorter in about the same way on both sides. The data are roughly symmetric: one mound.`;
    case "tail-high":
      return `Shape: the tallest stacks are at the low values, near ${d.mode}, and the stacks get shorter toward the right. The data are piled up at low values, with a tail toward high values.`;
    case "tail-low":
      return `Shape: the tallest stacks are at the high values, near ${d.mode}, and the stacks get shorter toward the left. The data are piled up at high values, with a tail toward low values.`;
    case "two-clusters": {
      const firstEmpty = p.indexOf(0);
      const lastEmpty = p.lastIndexOf(0);
      return `Shape: the dots form two groups, from ${d.start} to ${d.start + firstEmpty - 1} and from ${d.start + lastEmpty + 1} to ${d.max}, with no dots between them. The data are in two separate clusters.`;
    }
    default: {
      const lo = Math.min(...p),
        hi = Math.max(...p);
      return `Shape: every value from ${d.min} to ${d.max} has about the same number of dots, ${lo === hi ? `${lo} each` : `${lo} or ${hi}`}. There is no peak, so the data are flat.`;
    }
  }
}

export const distributionAxes = {
  shape: defineAxis("shape", shapeFamilies),
  context: defineAxis(
    "context",
    distributionContexts.map((c) => c.id),
  ),
} as const;

type Placed = {
  ctx: Context;
  name: string;
  d: Dist;
  axisMin: number;
  axisMax: number;
};
/** Place a pattern of `family` on its context's scale. */
function place(
  r: Random,
  family: ShapeFamily,
  ctx: Context,
  options: { lengths?: number[]; pads?: [number, number] } = {},
): Placed {
  const pool = PATTERNS[family].filter(
    (p) => !options.lengths || options.lengths.includes(p.length),
  );
  const pattern = pick(r, pool);
  const [padL, padR] = options.pads ?? [r(1, 3), r(1, 3)];
  const lo = Math.max(ctx.low, padL);
  const hi = ctx.high - pattern.length + 1;
  if (hi < lo) throw new Error("Need room on the scale");
  const start = r(lo, hi);
  const d = distOf(family, pattern, start);
  return {
    ctx,
    name: storyName((k) => r(0, k - 1)),
    d,
    axisMin: start - padL,
    axisMax: d.max + padR,
  };
}
const contextOf = (id: string) =>
  distributionContexts.find((c) => c.id === id)!;

/** The center choices: the middle value and the values a learner takes for
 * the center (an end of the data, the middle of the number line, the count
 * of dots, the tallest stack), each kept only when it is at least 3 away. */
function centerOptions(p: Placed): { value: number; feedback?: string }[] {
  const { d } = p;
  const mid = (p.axisMin + p.axisMax) / 2;
  const candidates: { value: number; feedback: string }[] = [
    {
      value: d.max,
      feedback: `${d.max} is the largest value, an end of the data. The center is where the middle dot lands.`,
    },
    {
      value: d.min,
      feedback: `${d.min} is the smallest value, an end of the data. The center is where the middle dot lands.`,
    },
    {
      value: mid,
      feedback: `${mid} is the middle of the number line, not the middle of the dots. The number line runs farther than the data.`,
    },
    {
      value: d.n,
      feedback: `${d.n} is how many dots there are, not a value of the data.`,
    },
    {
      value: d.mode,
      feedback: `${d.mode} has the tallest stack, but the middle dot does not land there.`,
    },
  ];
  const chosen: { value: number; feedback?: string }[] = [{ value: d.median }];
  for (const c of candidates) {
    if (chosen.length === 4) break;
    if (
      Number.isInteger(c.value) &&
      c.value >= p.axisMin &&
      c.value <= p.axisMax &&
      Math.abs(c.value - d.median) >= 3 &&
      !chosen.some((x) => x.value === c.value)
    )
      chosen.push(c);
  }
  if (chosen.length < 3) throw new Error("Need two center distractors");
  // An eyeballed balance point also lands on the keyed center.
  for (const c of chosen.slice(1))
    if (Math.abs(d.mean - c.value) <= Math.abs(d.mean - d.median))
      throw new Error("Need the mean nearest the center");
  return chosen;
}

function describeDotPlot(seed: string): GeneratedProblem {
  const meta = metaOf("distribution-describe-dot-plot");
  const axes = chooseAxes(meta.id, seed, distributionAxes);
  return withRetries(meta.id, seed, (r) => {
    const p = place(r, axes.shape, contextOf(axes.context));
    const { d, ctx } = p;
    const span = p.axisMax - p.axisMin;
    // Range, number-line span, count and tallest stack are four different numbers.
    if (new Set([d.range, span, d.n, d.tallest]).size !== 4)
      throw new Error("Need distinct spread claims");
    const center = centerOptions(p);
    const figure: SemanticFigure = {
      kind: "scene",
      scene: dotScene(p.axisMin, p.axisMax, d.values, ctx.axis, {
        title: ctx.question,
      }),
    };
    const spreadRight = `The values go from ${d.min} to ${d.max}, so they spread over ${d.range} ${ctx.unit}.`;
    return {
      ...partsProblem(meta, seed, r, {
        prompt: `${p.name} ${ctx.asked} a statistical question: “${ctx.question}” The dot plot shows the data collected. Describe the distribution.`,
        figure,
        blanks: [
          {
            id: "center",
            label: "Center: around which value are the data centered?",
            options: center.map((c) => ({
              label: `${c.value}`,
              ...(c.feedback
                ? { feedback: c.feedback }
                : { correct: true as const }),
            })),
          },
          {
            id: "spread",
            label: "Spread: which statement describes the spread of the data?",
            options: [
              { label: spreadRight, correct: true },
              {
                label: `The values go from ${p.axisMin} to ${p.axisMax}, so they spread over ${span} ${ctx.unit}.`,
              },
              {
                label: `The spread is ${d.n}, because there are ${d.n} data values.`,
              },
              {
                label: `The spread is ${d.tallest}, the height of the tallest stack.`,
              },
            ],
          },
          {
            id: "shape",
            label: "Shape: which statement describes the overall shape?",
            options: shapeFamilies.map((f) => ({
              label: `The data are ${SHAPE_PHRASE[f]}.`,
              ...(f === d.family ? { correct: true as const } : {}),
            })),
          },
        ],
        hint: `There are ${d.n} dots. Count from the left to the middle dot for the center, then find the smallest and largest values for the spread.`,
        explanation: [centerLine(d), spreadLine(d, ctx), shapeLine(d)],
      }),
      variant: {
        id: `${axes.shape}-${axes.context}`,
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  });
}

/** One sentence: "Centered around 7, spread from 3 to 11, and …". */
const describeSentence = (c: number, a: number, b: number, f: ShapeFamily) =>
  `Centered around ${c}, spread from ${a} to ${b}, and ${SHAPE_PHRASE[f]}.`;
/** The shape a learner mistakes this one for. */
const SHAPE_MISREAD: Record<ShapeFamily, ShapeFamily> = {
  symmetric: "two-clusters",
  "tail-high": "tail-low",
  "tail-low": "tail-high",
  "two-clusters": "symmetric",
  uniform: "symmetric",
};
const SHAPE_MISREAD_WHY: Record<ShapeFamily, string> = {
  symmetric:
    "the dots make one mound with no gap, so they are not two separate clusters",
  "tail-high":
    "the dots pile up at the low values and the tail stretches toward the high values, not the other way",
  "tail-low":
    "the dots pile up at the high values and the tail stretches toward the low values, not the other way",
  "two-clusters":
    "there is an empty gap in the middle, so the dots are two clusters, not one mound",
  uniform:
    "the stacks are about the same height everywhere, so there is no mound in the middle",
};

function readDescription(seed: string): GeneratedProblem {
  const meta = metaOf("distribution-read-description");
  const axes = chooseAxes(meta.id, seed, distributionAxes);
  return withRetries(meta.id, seed, (r) => {
    const p = place(r, axes.shape, contextOf(axes.context));
    const { d, ctx } = p;
    const mid = (p.axisMin + p.axisMax) / 2;
    const wrongCenter = [d.max, mid, d.min].find(
      (v) => Number.isInteger(v) && Math.abs(v - d.median) >= 3,
    );
    if (wrongCenter === undefined) throw new Error("Need a wrong center");
    const misread = SHAPE_MISREAD[d.family];
    const options: Option[] = [
      {
        label: describeSentence(d.median, d.min, d.max, d.family),
        correct: true,
      },
      {
        label: describeSentence(wrongCenter, d.min, d.max, d.family),
        feedback: `The spread and the shape are right, but the middle dot lands on ${d.median}, so the data are centered around ${d.median}, not ${wrongCenter}.`,
      },
      {
        label: describeSentence(d.median, p.axisMin, p.axisMax, d.family),
        feedback: `${p.axisMin} and ${p.axisMax} are the ends of the number line. The dots only go from ${d.min} to ${d.max}.`,
      },
      {
        label: describeSentence(d.median, d.min, d.max, misread),
        feedback: `The center and the spread are right, but ${SHAPE_MISREAD_WHY[d.family]}.`,
      },
    ];
    const lengths = options.map((o) => o.label.length);
    if (Math.max(...lengths) - Math.min(...lengths) > 12)
      throw new Error("Need matched lengths");
    return {
      ...choiceProblem(meta, seed, r, {
        prompt: `${p.name} ${ctx.asked} a statistical question: “${ctx.question}” Which description of the data is correct and complete?`,
        figure: {
          kind: "scene",
          scene: dotScene(p.axisMin, p.axisMax, d.values, ctx.axis),
        },
        options,
        hint: `A description has three parts. There are ${d.n} dots: find where the middle dot lands, then check where the dots start and end, then the shape.`,
        explanation: [
          centerLine(d),
          spreadLine(d, ctx),
          shapeLine(d),
          `Only one description gets all three parts right: centered around ${d.median}, spread from ${d.min} to ${d.max}, and ${SHAPE_PHRASE[d.family]}. Each other description changes one part.`,
        ],
      }),
      variant: {
        id: `${axes.shape}-${axes.context}`,
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  });
}

function matchDescription(seed: string): GeneratedProblem {
  const meta = metaOf("distribution-match-description");
  const axes = chooseAxes(meta.id, seed, distributionAxes);
  return withRetries(meta.id, seed, (r) => {
    const ctx = contextOf(axes.context);
    // Length-9 patterns on a fixed scale from one below to four above.
    const p = place(r, axes.shape, ctx, { lengths: [9], pads: [1, 4] });
    const { d } = p;
    const shifted = distOf(d.family, d.pattern, d.start + 3);
    const narrowPattern = NARROW[d.family];
    const narrowAt = distOf(d.family, narrowPattern, 0).median;
    const narrow = distOf(d.family, narrowPattern, d.median - narrowAt);
    const misread = SHAPE_MISREAD[d.family];
    const other =
      d.family === "tail-high" || d.family === "tail-low"
        ? [...d.pattern].reverse()
        : pick(
            r,
            PATTERNS[misread].filter((x) => x.length === d.pattern.length),
          );
    const reshaped = distOf(misread, other, d.start);
    for (const x of [shifted, narrow, reshaped])
      if (x.min < p.axisMin || x.max > p.axisMax)
        throw new Error("Need every plot on the scale");
    if (narrow.median !== d.median || d.range - narrow.range < 3)
      throw new Error("Need a narrow plot with the same center");
    if (reshaped.min !== d.min || reshaped.max !== d.max)
      throw new Error("Need the same ends");
    const card = (x: Dist) => ({
      description: `A dot plot of ${x.n} dots: ${countsText(x.values)}.`,
      scene: dotScene(p.axisMin, p.axisMax, x.values, ctx.axis, {
        card: true,
      }),
    });
    const cards: Card[] = [
      {
        ...card(d),
        correct: true,
        line: (name) =>
          `${name} matches all three parts: its middle dot lands on ${d.median}, its dots run from ${d.min} to ${d.max}, and it is ${SHAPE_PHRASE[d.family]}.`,
      },
      {
        ...card(shifted),
        feedback: (name) =>
          `${name} has the right shape and spread, but it is centered around ${shifted.median}, not ${d.median}.`,
        line: (name) =>
          `${name} has the right shape and spread, but it is centered around ${shifted.median}, not ${d.median}.`,
      },
      {
        ...card(narrow),
        feedback: (name) =>
          `${name} is centered around ${d.median}, but it only spreads from ${narrow.min} to ${narrow.max}, not from ${d.min} to ${d.max}.`,
        line: (name) =>
          `${name} is centered around ${d.median}, but it only spreads from ${narrow.min} to ${narrow.max}.`,
      },
      {
        ...card(reshaped),
        feedback: (name) =>
          `${name} spreads from ${d.min} to ${d.max}, but it is ${SHAPE_PHRASE[misread]}. The description says ${SHAPE_PHRASE[d.family]}.`,
        line: (name) =>
          `${name} spreads from ${d.min} to ${d.max}, but it is ${SHAPE_PHRASE[misread]}.`,
      },
    ];
    return {
      ...cardsProblem(meta, seed, r, {
        prompt: `${p.name} ${ctx.asked} a statistical question: “${ctx.question}” The data collected were centered around ${d.median}, spread from ${d.min} to ${d.max}, and ${SHAPE_PHRASE[d.family]}. Which dot plot shows these data?`,
        label: "Choose the dot plot",
        cards,
        hint: `The description says the data spread from ${d.min} to ${d.max}. Rule out any plot whose dots start or end somewhere else, then check where its middle dot lands and its shape.`,
        lead: [
          `A description has three parts: center, spread and shape. A plot must match all three, so check each plot one part at a time.`,
          `The center is where the middle dot lands, the spread runs from the smallest dot to the largest, and the shape is the outline the stacks make.`,
        ],
      }),
      variant: {
        id: `${axes.shape}-${axes.context}`,
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  });
}

function questionAnswer(seed: string): GeneratedProblem {
  const meta = metaOf("statistical-question-distribution-answer");
  const axes = chooseAxes(meta.id, seed, distributionAxes);
  return withRetries(meta.id, seed, (r) => {
    const ctx = contextOf(axes.context);
    const p = place(r, axes.shape, ctx);
    const { d } = p;
    if (d.n === d.median) throw new Error("Need a count unlike the center");
    const other = storyName((k) => r(0, k - 1));
    if (other === p.name) throw new Error("Need another name");
    const correct = `Centered near ${d.median}, spread from ${d.min} to ${d.max}, ${SHAPE_SHORT[d.family]}.`;
    const single = `The answer is ${d.median} ${ctx.unit}, the middle value, so the rest can be left out.`;
    const modeLabel =
      d.modeUnique && d.mode !== d.median
        ? `The answer is ${d.mode} ${ctx.unit}, the one value that the most ${ctx.members} had.`
        : `The answer is ${d.max} ${ctx.unit}, since that is the largest value in the data.`;
    const none =
      "There is no answer, because the values are not all the same as each other.";
    const statements = [correct, single, modeLabel, none];
    const lengths = statements.map((s) => s.length);
    if (Math.max(...lengths) - Math.min(...lengths) > 12)
      throw new Error("Need matched lengths");
    return {
      ...partsProblem(meta, seed, r, {
        prompt: `${p.name} collected these data from the ${ctx.from}. Each dot is one ${ctx.member}'s value.`,
        figure: {
          kind: "scene",
          scene: dotScene(p.axisMin, p.axisMax, d.values, ctx.axis),
        },
        blanks: [
          {
            id: "question",
            label: "Which question were these data collected to answer?",
            options: [
              { label: ctx.question, correct: true },
              {
                label: ctx.single(other),
                feedback: `That asks about one ${ctx.member}, so it has one answer. It is not a statistical question.`,
              },
              {
                label: ctx.count,
                feedback: `Counting the dots answers that question, but the data are the values the dots show, not how many there are.`,
              },
              {
                label: ctx.largest,
                feedback: `No data can answer that. The dots show what was measured, not the most possible.`,
              },
            ],
          },
          {
            id: "answer",
            label: "Which statement best answers that question?",
            options: [
              { label: correct, correct: true },
              {
                label: single,
                feedback: `One number throws away how much the values vary, which is what the question expected.`,
              },
              {
                label: modeLabel,
                feedback: `One number throws away the rest of the data. The answer describes all the values.`,
              },
              {
                label: none,
                feedback: `Values that vary are what a statistical question expects. The answer describes how they vary.`,
              },
            ],
          },
        ],
        hint: `The plot shows ${d.n} values, and they are not all the same. Choose the question that expects different answers, then describe the whole set of values.`,
        explanation: [
          `Each dot is one ${ctx.member}'s value, and the values differ. So the question asked about all the ${ctx.members} and expected different answers: “${ctx.question}”`,
          `Counting the dots gives ${d.n}, the number of ${ctx.members}. That answers a different question. A question about one ${ctx.member} has one answer, so it is not a statistical question.`,
          `A statistical question is answered by describing the distribution. Center: near ${d.median}. Spread: from ${d.min} to ${d.max}. Shape: ${SHAPE_PHRASE[d.family]}.`,
          `Saying only one number, such as ${d.median}, leaves out how the values vary.`,
        ],
      }),
      variant: {
        id: `${axes.shape}-${axes.context}`,
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  });
}

/* ------------------------------------------------------ scatter plots */

type Pt = [number, number];
export type Line = { m: number; b: number };
type ScatterContext = {
  id: string;
  xName: string;
  yName: string;
  describe: (n: number) => string;
  /** The y quantity in prose, after a number: "test-score points". */
  yUnit: string;
  /** What each dot is, plural: "students", "days". */
  members: string;
  /** An x value in prose: "7 hours", "85°F". */
  xAt: (x: number) => string;
  xs: number[];
  xAxis: [number, number];
  xStep: number;
  yStep: number;
  slopes: number[];
  /** Value of the hidden line at the first grid x. */
  start: [number, number];
  noise: (m: number) => number;
  sign: 1 | -1;
  /** The curve a nonlinear cloud follows, from 0 at the first grid x to 1
   * at the last; null when this story has no curved version. */
  curve: "concave" | "convex" | null;
  yMin: number;
  yMax: number;
};
const range = (a: number, b: number, step: number) =>
  Array.from(
    { length: Math.round((b - a) / step) + 1 },
    (_, i) => a + i * step,
  );
export const scatterContexts: readonly ScatterContext[] = [
  {
    id: "study",
    members: "students",
    xAt: (x) => `${x} ${x === 1 ? "hour" : "hours"}`,
    xName: "Hours studied",
    yName: "Test score",
    describe: (n) =>
      `how many hours each of ${n} students studied and each student's test score`,
    yUnit: "test-score points",
    xs: range(1, 10, 1),
    xAxis: [0, 11],
    xStep: 1,
    yStep: 10,
    slopes: [3, 4, 5],
    start: [40, 50],
    noise: () => 7,
    sign: 1,
    curve: "concave",
    yMin: 20,
    yMax: 100,
  },
  {
    id: "lemonade",
    members: "days",
    xAt: (x) => `${x}°F`,
    xName: "High temperature (°F)",
    yName: "Cups sold",
    describe: (n) =>
      `the high temperature and the cups of lemonade sold on each of ${n} days`,
    yUnit: "cups",
    xs: range(50, 100, 5),
    xAxis: [45, 105],
    xStep: 5,
    yStep: 10,
    slopes: [1, 2],
    start: [5, 15],
    noise: (m) => 6 * m,
    sign: 1,
    curve: "convex",
    yMin: 0,
    yMax: 130,
  },
  {
    id: "car",
    members: "cars",
    xAt: (x) => `${x} ${x === 1 ? "year" : "years"}`,
    xName: "Age in years",
    yName: "Value in thousand dollars",
    describe: (n) => `the age and the value of each of ${n} used cars`,
    yUnit: "thousand dollars",
    xs: range(1, 12, 1),
    xAxis: [0, 13],
    xStep: 1,
    yStep: 5,
    slopes: [-1.5, -2, -3],
    start: [35, 40],
    noise: (m) => (Math.abs(m) >= 3 ? 4 : 3),
    sign: -1,
    curve: "convex",
    yMin: 1,
    yMax: 50,
  },
  {
    id: "arm-span",
    members: "students",
    xAt: (x) => `${x} inches`,
    xName: "Height in inches",
    yName: "Arm span in inches",
    describe: (n) => `the height and the arm span of each of ${n} students`,
    yUnit: "inches",
    xs: range(55, 70, 1),
    xAxis: [54, 71],
    xStep: 1,
    yStep: 5,
    slopes: [1],
    start: [53, 57],
    noise: () => 2,
    sign: 1,
    curve: null,
    yMin: 45,
    yMax: 80,
  },
  {
    id: "tv",
    members: "students",
    xAt: (x) => `${x} minutes`,
    xName: "TV each day, in minutes",
    yName: "Reading each week, in hours",
    describe: (n) =>
      `how many minutes of TV each of ${n} students watches each day and how many hours each one reads each week`,
    yUnit: "hours",
    xs: range(10, 120, 10),
    xAxis: [0, 130],
    xStep: 10,
    yStep: 2,
    slopes: [-0.1],
    start: [13, 15],
    noise: () => 2,
    sign: -1,
    curve: "convex",
    yMin: 0,
    yMax: 20,
  },
  {
    id: "plant",
    members: "plants",
    xAt: (x) => `${x} ${x === 1 ? "week" : "weeks"}`,
    xName: "Age in weeks",
    yName: "Height in centimeters",
    describe: (n) => `the age and the height of each of ${n} bean plants`,
    yUnit: "centimeters",
    xs: range(1, 10, 1),
    xAxis: [0, 11],
    xStep: 1,
    yStep: 5,
    slopes: [2, 3],
    start: [3, 8],
    noise: (m) => (m >= 3 ? 3 : 2),
    sign: 1,
    curve: "concave",
    yMin: 0,
    yMax: 45,
  },
];

export function leastSquares(points: readonly Pt[]): Line {
  const n = points.length;
  const mx = points.reduce((a, [x]) => a + x, 0) / n;
  const my = points.reduce((a, [, y]) => a + y, 0) / n;
  let sxy = 0,
    sxx = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
  }
  const m = sxy / sxx;
  return { m, b: my - m * mx };
}
export function correlation(points: readonly Pt[]): number {
  const n = points.length;
  const mx = points.reduce((a, [x]) => a + x, 0) / n;
  const my = points.reduce((a, [, y]) => a + y, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (const [x, y] of points) {
    sxy += (x - mx) * (y - my);
    sxx += (x - mx) ** 2;
    syy += (y - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}
const EPS = 1e-9;
/** Sum of the vertical distances from the points to the line. */
export const sae = (points: readonly Pt[], l: Line) =>
  points.reduce((a, [x, y]) => a + Math.abs(y - (l.m * x + l.b)), 0);
export function sides(points: readonly Pt[], l: Line) {
  let above = 0,
    below = 0;
  for (const [x, y] of points) {
    const res = y - (l.m * x + l.b);
    if (res > EPS) above++;
    else if (res < -EPS) below++;
  }
  return { above, below };
}
/** Points left of the middle x mostly on one side, right of it mostly on the
 * other: at least 75% of each half. */
export function tiltSplit(points: readonly Pt[], l: Line): boolean {
  const xs = points.map(([x]) => x).sort((a, b) => a - b);
  const mid = (xs[0]! + xs[xs.length - 1]!) / 2;
  const side = (pts: Pt[]) => {
    const s = sides(pts, l);
    return { up: s.above / pts.length, down: s.below / pts.length };
  };
  const left = side(points.filter(([x]) => x < mid));
  const right = side(points.filter(([x]) => x > mid));
  return (
    (left.up >= 0.75 && right.down >= 0.75) ||
    (left.down >= 0.75 && right.up >= 0.75)
  );
}
/** Least-squares residual signs of a bend: the points in the outer eighth of
 * the x span at both ends on one side of the line, and the points in the
 * middle 30% (at least two) on the other. */
export function curvedPattern(points: readonly Pt[]): boolean {
  const ls = leastSquares(points);
  const xs = points.map(([x]) => x);
  const lo = Math.min(...xs),
    hi = Math.max(...xs);
  const t = (x: number) => (x - lo) / (hi - lo);
  const res = (p: Pt) => p[1] - (ls.m * p[0] + ls.b);
  const ends = points.filter(([x]) => t(x) <= 0.125 || t(x) >= 0.875);
  const middle = points.filter(([x]) => t(x) >= 0.35 && t(x) <= 0.65);
  const left = ends.some(([x]) => t(x) <= 0.125);
  const right = ends.some(([x]) => t(x) >= 0.875);
  const up =
    ends.every((p) => res(p) > EPS) && middle.every((p) => res(p) < -EPS);
  const down =
    ends.every((p) => res(p) < -EPS) && middle.every((p) => res(p) > EPS);
  return left && right && middle.length >= 2 && (up || down);
}

export type Cloud = {
  ctx: ScatterContext;
  points: Pt[];
  n: number;
  ls: Line;
  saeLs: number;
  yAxis: [number, number];
  /** The snapped least-squares line, through two whole-number points. */
  snapped: Line;
  through: [Pt, Pt];
  center: Pt;
};
const yWindow = (ctx: ScatterContext, ys: number[]): [number, number] => {
  const lo = Math.max(
    0,
    ctx.yStep * (Math.floor(Math.min(...ys) / ctx.yStep) - 1),
  );
  const hi = ctx.yStep * (Math.ceil(Math.max(...ys) / ctx.yStep) + 1);
  return [lo, hi];
};
/** n distinct grid x values, sorted, with at most one repeated. */
function chooseXs(
  r: Random,
  ctx: ScatterContext,
  n: number,
  repeats: boolean,
): number[] {
  const repeat = !repeats ? 0 : n > ctx.xs.length ? 1 : r(0, 1);
  const distinct = shuffle(r, [...ctx.xs]).slice(0, n - repeat);
  const xs = repeat ? [...distinct, pick(r, distinct)] : distinct;
  return xs.sort((a, b) => a - b);
}
/** A linear cloud around a hidden line, or a curved one. */
export function makeCloud(
  r: Random,
  ctx: ScatterContext,
  shape: "linear" | "curved",
): Cloud {
  const linear = shape === "linear";
  const n = r(9, Math.min(12, ctx.xs.length + (linear ? 1 : 0)));
  const xs = chooseXs(r, ctx, n, linear);
  const x0 = ctx.xs[0]!,
    x1 = ctx.xs[ctx.xs.length - 1]!;
  const m = pick(r, ctx.slopes);
  const y0 = r(ctx.start[0], ctx.start[1]);
  const y1 = y0 + m * (x1 - x0);
  let ys: number[];
  if (shape === "linear") {
    const E = ctx.noise(m);
    // Balanced signs, and no three neighbors in a row on one side.
    let noise: number[] = [];
    let tries = 0;
    for (;;) {
      noise = xs.map(() => r(-E, E));
      const pos = noise.filter((e) => e > 0).length;
      const neg = noise.filter((e) => e < 0).length;
      const run = noise.some(
        (e, i) =>
          i >= 2 &&
          Math.sign(e) !== 0 &&
          Math.sign(e) === Math.sign(noise[i - 1]!) &&
          Math.sign(e) === Math.sign(noise[i - 2]!),
      );
      if (Math.abs(pos - neg) <= 1 && !run) break;
      if (++tries > 200) throw new Error("Need balanced noise");
    }
    ys = xs.map((x, i) => Math.round(y0 + m * (x - x0) + noise[i]!));
  } else {
    if (!ctx.curve) throw new Error("Need a curved story");
    // A cubic bend from y0 to y1 the story's way, with a little noise:
    // concave rises fast and levels off; convex starts flat and rises fast,
    // or (falling) drops fast and levels off.
    const E = Math.max(1, Math.round(Math.abs(y1 - y0) * 0.03));
    ys = xs.map((x) => {
      const t = (x - x0) / (x1 - x0);
      const bend = ctx.curve === "concave" ? 1 - (1 - t) ** 3 : t ** 3;
      const level =
        m > 0
          ? y0 + (y1 - y0) * bend
          : ctx.curve === "convex"
            ? y1 + (y0 - y1) * (1 - t) ** 3
            : y0 + (y1 - y0) * (1 - (1 - t) ** 3);
      return Math.round(level + r(-E, E));
    });
  }
  if (ys.some((y) => y < ctx.yMin || y > ctx.yMax))
    throw new Error("Need values inside the story");
  const points = xs.map((x, i) => [x, ys[i]!] as Pt);
  if (new Set(points.map((p) => p.join())).size !== points.length)
    throw new Error("Need distinct points");
  const ls = leastSquares(points);
  if (Math.sign(ls.m) !== ctx.sign) throw new Error("Need the story's slope");
  const yAxis = yWindow(ctx, ys);
  const span = yAxis[1] - yAxis[0];
  const saeLs = sae(points, ls);
  if (shape === "linear") {
    if (Math.abs(correlation(points)) < 0.85 || curvedPattern(points))
      throw new Error("Need a strong linear cloud");
    // A cloud, not a line, and not a blur: mean distance 3% to 12% of the scale.
    if (saeLs / n < 0.03 * span || saeLs / n > 0.12 * span)
      throw new Error("Need a cloud of moderate scatter");
  } else {
    if (!curvedPattern(points)) throw new Error("Need a clear curve");
    if (saeLs / n < 0.045 * span) throw new Error("Need a visible bend");
  }
  // The least-squares line snapped to two whole-number points near the ends.
  const dataXs = [...new Set(xs)];
  let best: { line: Line; through: [Pt, Pt]; sae: number } | null = null;
  for (let i = 0; i < Math.min(3, dataXs.length); i++)
    for (let j = dataXs.length - 1; j >= Math.max(0, dataXs.length - 3); j--) {
      const xa = dataXs[i]!,
        xb = dataXs[j]!;
      if (xb - xa < (x1 - x0) / 2) continue;
      const ya = Math.round(ls.m * xa + ls.b),
        yb = Math.round(ls.m * xb + ls.b);
      const mm = (yb - ya) / (xb - xa);
      const line = { m: mm, b: ya - mm * xa };
      const s = sae(points, line);
      if (!best || s < best.sae - EPS)
        best = {
          line,
          through: [
            [xa, ya],
            [xb, yb],
          ],
          sae: s,
        };
    }
  if (!best) throw new Error("Need a snapped line");
  const cx = xs.reduce((a, b) => a + b, 0) / n;
  const cy = ys.reduce((a, b) => a + b, 0) / n;
  return {
    ctx,
    points,
    n,
    ls,
    saeLs,
    yAxis,
    snapped: best.line,
    through: best.through,
    center: [cx, cy],
  };
}
function scatterFigure(c: Cloud, line: Line, card = false): Scene {
  const [xa, xb] = c.ctx.xAxis;
  const [ya, yb] = c.yAxis;
  return graph({
    x: [xa, xb],
    y: [ya, yb],
    grid: [c.ctx.xStep, c.ctx.yStep],
    tick: [c.ctx.xStep, c.ctx.yStep],
    axisNames: [c.ctx.xName, c.ctx.yName],
    aspect: (0.72 * (xb - xa)) / (yb - ya),
  })
    .scatter(c.points, { m: line.m, b: line.b })
    .scene(card ? CARD : {});
}
const yAt = (l: Line, x: number) => l.m * x + l.b;
/** The farthest point from a line, and how far. */
function farthest(c: Cloud, l: Line) {
  let best = { d: -1, x: 0, y: 0 };
  for (const [x, y] of c.points) {
    const d = Math.abs(y - yAt(l, x));
    if (d > best.d) best = { d, x, y };
  }
  return best;
}
const sidesText = (points: readonly Pt[], l: Line) => {
  const s = sides(points, l);
  return `${s.above} ${s.above === 1 ? "point lies" : "points lie"} above it and ${s.below} below`;
};
/** Where a line runs across the data: its values at the first and last x. */
function lineText(c: Cloud, l: Line) {
  const xs = c.points.map(([x]) => x);
  const a = Math.min(...xs),
    b = Math.max(...xs);
  return `a line through about (${a}, ${plain(Math.round(yAt(l, a)))}) and (${b}, ${plain(Math.round(yAt(l, b)))})`;
}

export const bestFitAxes = {
  recipe: defineAxis("recipe", [
    "two-shifts-one-tilt",
    "connect-and-pivot",
    "mean-and-shift",
  ] as const),
  context: defineAxis(
    "context",
    scatterContexts.map((c) => c.id),
  ),
} as const;
export type DistractorTag =
  | "ceiling"
  | "floor"
  | "pivot-steep"
  | "pivot-flat"
  | "connect-dots"
  | "mean-line"
  | "origin"
  | "wrong-sign";
const TAG_WHY: Record<DistractorTag, string> = {
  ceiling:
    "sits above the cloud: almost every point is below it. A trend line goes through the middle of the points",
  floor:
    "sits below the cloud: almost every point is above it. A trend line goes through the middle of the points",
  "pivot-steep":
    "goes through the middle of the cloud but tilts too steeply, so the points at the ends are far from it",
  "pivot-flat":
    "goes through the middle of the cloud but is too flat, so the points at the ends are far from it",
  "connect-dots":
    "connects two of the dots instead of following the whole cloud, so many points are far from it",
  "mean-line":
    "is flat at the average value, so it ignores how the points rise or fall",
  origin:
    "is forced through the point where both values are 0, so it misses the cloud. A trend line does not have to pass through 0",
  "wrong-sign": "tilts the opposite way from the points",
};
/** Build one tagged distractor line, or null when this cloud has none. A
 * ceiling or floor line keeps the trend's slope and touches the farthest
 * point; given `total`, it moves out until the points' distances to it add to
 * at least that much. */
function distractor(c: Cloud, tag: DistractorTag, total = 0): Line | null {
  const { ls } = c;
  const [cx, cy] = c.center;
  const through = (m: number) => ({ m, b: cy - m * cx });
  const residuals = c.points.map(([x, y]) => y - yAt(ls, x));
  switch (tag) {
    case "ceiling":
      return {
        m: ls.m,
        b: ls.b + Math.max(...residuals, total / c.n),
      };
    case "floor":
      return {
        m: ls.m,
        b: ls.b + Math.min(...residuals, -total / c.n),
      };
    case "pivot-steep":
      return through(2 * ls.m);
    case "pivot-flat":
      return through(0.4 * ls.m);
    case "wrong-sign":
      return through(-ls.m);
    case "mean-line":
      return { m: 0, b: cy };
    case "origin":
      return cx === 0 ? null : { m: cy / cx, b: 0 };
    case "connect-dots": {
      // An end dot and an interior dot on opposite sides of the trend.
      const sorted = [...c.points].sort((a, b) => a[0] - b[0]);
      const res = (p: Pt) => p[1] - yAt(ls, p[0]);
      const ends = [sorted[0]!, sorted[sorted.length - 1]!];
      let best: Line | null = null,
        worst = -1;
      for (const e of ends)
        for (const q of sorted.slice(1, -1)) {
          if (q[0] === e[0] || Math.sign(res(e)) * Math.sign(res(q)) >= 0)
            continue;
          const m = (q[1] - e[1]) / (q[0] - e[0]);
          const line = { m, b: e[1] - m * e[0] };
          const s = sae(c.points, line);
          if (s > worst) {
            worst = s;
            best = line;
          }
        }
      return best;
    }
  }
}
/** The property a tagged line must have, checked on the points. */
function hasTag(c: Cloud, tag: DistractorTag, l: Line): boolean {
  const s = sides(c.points, l);
  const [cx, cy] = c.center;
  const onCenter = Math.abs(yAt(l, cx) - cy) < 1e-6;
  switch (tag) {
    case "ceiling":
      return s.below >= c.n - 1;
    case "floor":
      return s.above >= c.n - 1;
    case "pivot-steep":
    case "pivot-flat":
      return onCenter && Math.sign(l.m) === Math.sign(c.ls.m);
    case "wrong-sign":
      return onCenter && Math.sign(l.m) === -Math.sign(c.ls.m);
    case "mean-line":
      return l.m === 0;
    case "origin":
      return Math.abs(l.b) < 1e-9;
    case "connect-dots":
      return (
        c.points.filter(([x, y]) => Math.abs(y - yAt(l, x)) < 1e-6).length >= 2
      );
  }
}
const similar = (a: Line, b: Line, yStep: number) =>
  Math.abs(a.m - b.m) <= 0.1 * Math.max(Math.abs(a.m), Math.abs(b.m)) &&
  Math.abs(a.b - b.b) <= yStep;

function bestFitChoice(seed: string): GeneratedProblem {
  const meta = metaOf("trend-line-best-fit-choice");
  const axes = chooseAxes(meta.id, seed, bestFitAxes);
  const ctx = scatterContexts.find((c) => c.id === axes.context)!;
  return withRetries(meta.id, seed, (r) => {
    const c = makeCloud(r, ctx, "linear");
    const correct = c.snapped;
    const saeCorrect = sae(c.points, correct);
    const balance = sides(c.points, correct);
    if (
      saeCorrect > 1.2 * c.saeLs ||
      Math.abs(balance.above - balance.below) > 2
    )
      throw new Error("Need a close, balanced snapped line");
    const updown = r(0, 1) ? "ceiling" : "floor";
    const pivot = r(0, 1) ? "pivot-steep" : "pivot-flat";
    const tags: DistractorTag[] =
      axes.recipe === "two-shifts-one-tilt"
        ? ["ceiling", "floor", pivot]
        : axes.recipe === "connect-and-pivot"
          ? ["connect-dots", "pivot-steep", "pivot-flat"]
          : [
              "mean-line",
              updown,
              r(0, 2) === 0
                ? "wrong-sign"
                : distractor(c, "origin") &&
                    sae(c.points, distractor(c, "origin")!) >= 1.8 * saeCorrect
                  ? "origin"
                  : pivot,
            ];
    const lines = tags.map((tag) => {
      // Far enough to add up to 1.9 times the best line's distances, and a
      // whole grid step from it, so the shifted line looks different.
      const l = distractor(
        c,
        tag,
        Math.max(1.9 * saeCorrect, 1.05 * c.n * ctx.yStep),
      );
      if (!l || !hasTag(c, tag, l))
        throw new Error(`Need ${withArticle(tag)} line`);
      if (sae(c.points, l) < 1.8 * saeCorrect)
        throw new Error(`Need ${withArticle(tag)} line far from the points`);
      return { tag, line: l };
    });
    const all = [correct, ...lines.map((x) => x.line)];
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++)
        if (similar(all[i]!, all[j]!, ctx.yStep))
          throw new Error("Need lines that look different");
    const far = farthest(c, correct);
    const card = (l: Line) => ({
      description: `The ${c.n} points with ${lineText(c, l)}; ${sidesText(c.points, l)}.`,
      scene: scatterFigure(c, l, true),
    });
    const cards: Card[] = [
      {
        ...card(correct),
        correct: true,
        line: (name) =>
          `${name} fits best: ${sidesText(c.points, correct)}, and every point is close. The farthest is about ${yAmount(short(far.d), ctx.yUnit)} away.`,
      },
      ...lines.map(({ tag, line }) => ({
        ...card(line),
        feedback: (name: string) => `${name} ${TAG_WHY[tag]}.`,
        line: (name: string) =>
          `${name} ${TAG_WHY[tag]}. Here ${sidesText(c.points, line)}.`,
      })),
    ];
    return {
      ...cardsProblem(meta, seed, r, {
        prompt: `Each graph shows the same scatter plot of ${ctx.describe(c.n)}, with a different line drawn. Which line fits the data best?`,
        label: "Choose the graph",
        cards,
        hint: `Each graph has the same ${c.n} points. For each line, count the points above it and below it, and look at how far the points at both ends are from it.`,
        lead: [
          `Every graph has the same dots; only the line is different. A good trend line goes through the middle of the cloud, with points on both sides, and stays close to the points all along.`,
        ],
      }),
      variant: {
        id: `${axes.recipe}-${axes.context}-${lines.map((x) => x.tag).join("-")}`,
        axes: axisRecord(axes as Record<string, string>),
      },
    };
  });
}

export const fitAssessAxes = {
  fit: defineAxis(
    "fit",
    ["good-fit", "shifted", "tilted", "no-line"] as const,
    {
      weights: [7, 4, 4, 5],
    },
  ),
  context: defineAxis(
    "context",
    scatterContexts.map((c) => c.id),
  ),
} as const;
/** The statements, all in one frame and within a few characters in length. */
export const FIT_STATEMENTS = {
  good: "The line fits well: the points are close to it, with about as many above it as below.",
  above:
    "The line does not fit well: almost all of the points lie above the line, not around it.",
  below:
    "The line does not fit well: almost all of the points lie below the line, not around it.",
  tilt: "The line does not fit well: points at one end lie above it, and at the other end below it.",
  curve:
    "No straight line fits well: the points curve, so the points at both ends are far from it.",
  twoDots:
    "The line fits well: it passes right through two of the data points, so it must be good.",
  everyDot:
    "The line does not fit well: a good line must pass through every one of the points.",
  sameWay:
    "The line fits well: it slopes the same way as the points do, so it matches the data.",
  spacing:
    "The line does not fit well: the points are not evenly spaced from left to right.",
  bothSides:
    "The line fits well: the points are far from it, but there are some on both sides.",
} as const;
type Statement = keyof typeof FIT_STATEMENTS;
const STATEMENT_WHY: Record<Statement, string> = {
  good: "The points are not close to this line all along, so it does not fit well.",
  above:
    "The points are not almost all above the line; there are points on both sides of it.",
  below:
    "The points are not almost all below the line; there are points on both sides of it.",
  tilt: "The points are not above it at one end and below it at the other; they lie on both sides all along.",
  curve:
    "These points follow a straight-line pattern, so a straight line can fit them.",
  twoDots:
    "A line can pass through two dots and still be far from the rest. Fit is about how close all the points are.",
  everyDot:
    "No trend line passes through every point. A good line stays close to the points, with points on both sides.",
  sameWay:
    "Sloping the same way is not enough. The points must also be close to the line all along.",
  spacing:
    "Spacing along the bottom does not decide fit. Fit is about how close the points are to the line.",
  bothSides:
    "Points far from a line on both sides mean it fits badly. A good fit needs the points close to it.",
};

function fitAssess(seed: string): GeneratedProblem {
  const meta = metaOf("trend-line-fit-assess");
  const axes = chooseAxes(meta.id, seed, fitAssessAxes);
  const fit = axes.fit;
  // A curved cloud needs a story that bends; the arm-span story does not.
  const ctxId =
    fit === "no-line" && axes.context === "arm-span" ? "plant" : axes.context;
  const ctx = scatterContexts.find((c) => c.id === ctxId)!;
  return withRetries(meta.id, seed, (r) => {
    const c = makeCloud(r, ctx, fit === "no-line" ? "curved" : "linear");
    let line: Line;
    let correct: Statement;
    let direction: "steep" | "flat" | null = null;
    if (fit === "good-fit") {
      line = c.snapped;
      correct = "good";
    } else if (fit === "shifted") {
      const up = r(0, 1) === 1;
      line = distractor(c, up ? "ceiling" : "floor")!;
      correct = up ? "below" : "above";
    } else if (fit === "tilted") {
      direction = r(0, 1) ? "steep" : "flat";
      line = distractor(
        c,
        direction === "steep" ? "pivot-steep" : "pivot-flat",
      )!;
      correct = "tilt";
    } else {
      line = c.ls;
      correct = "curve";
    }
    // Which statements are true of this picture.
    const s = sides(c.points, line);
    const lineSae = sae(c.points, line);
    const linear = fit !== "no-line";
    const goodFit =
      linear && lineSae <= 1.2 * c.saeLs && Math.abs(s.above - s.below) <= 2;
    const truth: Record<Statement, boolean> = {
      good: goodFit,
      above: s.above >= c.n - 1,
      below: s.below >= c.n - 1,
      tilt: tiltSplit(c.points, line),
      curve: !linear && curvedPattern(c.points),
      twoDots: goodFit,
      everyDot: !goodFit,
      sameWay: goodFit,
      spacing: !goodFit,
      bothSides: goodFit,
    };
    if (!truth[correct]) throw new Error("Need the keyed statement true");
    if (fit === "tilted" && lineSae < 1.8 * c.saeLs)
      throw new Error("Need a clearly tilted line");
    const pools: Record<typeof fit, Statement[]> = {
      "good-fit": ["above", "below", "tilt", "everyDot", "spacing", "curve"],
      shifted: [
        "good",
        "sameWay",
        "twoDots",
        correct === "above" ? "below" : "above",
        "tilt",
      ],
      tilted: ["good", "sameWay", "bothSides", "twoDots", "above", "below"],
      "no-line": ["good", "sameWay", "bothSides", "twoDots"],
    };
    let pool = pools[fit].filter((k) => !truth[k]);
    if (fit === "good-fit") {
      // One of the two "almost all on one side" claims, not both.
      const drop = r(0, 1) ? "above" : "below";
      pool = pool.filter((k) => k !== drop);
    }
    const wrong = shuffle(r, pool).slice(0, 3);
    if (wrong.length < 3) throw new Error("Need three false statements");
    const far = farthest(c, line);
    const sideCount = `${s.above} ${s.above === 1 ? "point is" : "points are"} above the line and ${s.below} ${s.below === 1 ? "is" : "are"} below it`;
    const onLine = c.n - s.above - s.below;
    const explanation = [
      `Each dot is one of the ${c.n} ${ctx.members}. The line is a model of the pattern in the points.`,
      `Check both sides: ${sideCount}${onLine ? `, and ${onLine} ${onLine === 1 ? "is" : "are"} on it` : ""}.`,
      `Check closeness: the farthest point, at ${ctx.xAt(far.x)}, is about ${yAmount(short(far.d), ctx.yUnit)} from the line.`,
      fit === "good-fit"
        ? `The points are on both sides and close all along, so the line fits well. Fit is how close the points are, not which points the line touches.`
        : fit === "shifted"
          ? `Almost every point is on one side, so the line sits ${correct === "below" ? "above" : "below"} the cloud instead of through its middle. It does not fit well.`
          : fit === "tilted"
            ? `The line is too ${direction}: at one end the points are above it and at the other end below it. It does not fit well.`
            : `The distances are long at both ends and short in the middle. The points bend, so a straight line is the wrong shape. No straight line fits them well.`,
    ];
    return {
      ...choiceProblem(meta, seed, r, {
        prompt: `The scatter plot shows ${ctx.describe(c.n)}, with a line drawn. Which statement best describes how well the line fits the data?`,
        figure: { kind: "scene", scene: scatterFigure(c, line) },
        options: [
          { label: FIT_STATEMENTS[correct], correct: true },
          ...wrong.map((k) => ({
            label: FIT_STATEMENTS[k],
            feedback: STATEMENT_WHY[k],
          })),
        ],
        hint: `There are ${c.n} points. Count how many lie above the line and how many below, then look at how far the farthest points are from it.`,
        explanation,
      }),
      variant: {
        id: `${fit}-${ctxId}`,
        axes: axisRecord({ fit, context: ctxId }),
      },
    };
  });
}

/* ------------------------------------------------------------ dispatch */

const generators: Record<string, (seed: string) => GeneratedProblem> = {
  "distribution-describe-dot-plot": describeDotPlot,
  "distribution-match-description": matchDescription,
  "distribution-read-description": readDescription,
  "statistical-question-distribution-answer": questionAnswer,
  "trend-line-best-fit-choice": bestFitChoice,
  "trend-line-fit-assess": fitAssess,
};
export function generateDistributionShapeFit(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate) throw new Error(`Unknown template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  return generate(seed);
}
