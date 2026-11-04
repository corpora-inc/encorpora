import { createHash } from "node:crypto";
import type { GeneratedProblem, TemplateMetadata } from "./contracts";
import { count } from "./agreement";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  choiceSurface,
  dispatch,
  numberSurface,
  type ChoiceOption,
} from "./chain-kit";
import { multiPartProblem } from "./multi-part-support";
import { CARD, problemOf, type Candidate } from "./figure-choice-practice";
import { sceneSchema, type Scene } from "./scene/spec";
import { dotTickLabel } from "./scene/components/dot-plot";
import { halfStep } from "./data-display-models";
import type { Surface } from "./variation/compose";

/** Nine eighths, six fourths, four halves, then one each of the other
 * grade-4 denominators. 100 does not fit a line plot. */
const DENOM_BAG = [
  8, 8, 8, 8, 8, 8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 2, 2, 2, 2, 3, 5, 6, 10, 12,
] as const;

const PRECISION: Record<number, string> = {
  2: "nearest half inch",
  3: "nearest third of an inch",
  4: "nearest quarter inch",
  5: "nearest fifth of an inch",
  6: "nearest sixth of an inch",
  8: "nearest eighth inch",
  10: "nearest tenth of an inch",
  12: "nearest twelfth of an inch",
};

const lineSenses = {
  mode: "mode-statistics",
  modes: "mode-statistics",
  median: "median",
  medians: "median",
  range: "range-statistics",
  ranges: "range-statistics",
};
const tableSenses = {
  frequency: "frequency",
  frequencies: "frequency",
  interval: "interval",
  intervals: "interval",
};
const barSenses = { scale: "scale-axis", scales: "scale-axis" };

const scenes = { requiredFigureCapability: "scenes-v1" as const };
const plotSkill = "fraction-plot-arithmetic";
const barSkill = "frequency-bar-graphs";

export const grade4DataTemplates: readonly TemplateMetadata[] = [
  {
    id: "line-plot-build-slots",
    version: 1,
    title: "Build a line plot from a list",
    skillId: plotSkill,
    gradeBand: "3–5",
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
    description:
      "Count how many listed lengths belong at each mark of a blank line plot. Most lists use halves, fourths or eighths. Thirds, fifths, sixths, tenths and twelfths appear less often. One mark is empty and one length repeats.",
  },
  {
    id: "line-plot-data-match",
    version: 1,
    title: "Choose the line plot for a list",
    skillId: plotSkill,
    gradeBand: "3–5",
    requiredResponseCapability: "figure-choice-v1",
    ...scenes,
    description:
      "Choose the line plot whose marks match a list of lengths. The other graphs move one mark by one tick, move one mark farther, or leave one length out.",
  },
  {
    id: "line-plot-center-range",
    version: 1,
    title: "Mode, median or range from a line plot",
    skillId: plotSkill,
    gradeBand: "3–5",
    requiredResponseCapability: "single-choice-v1",
    ...scenes,
    description:
      "Find the mode, the median or the range of an odd number of lengths shown on a line plot of halves, fourths or eighths.",
    glossarySenses: lineSenses,
  },
  {
    id: "frequency-table-grade4",
    version: 1,
    title: "Frequency tables with wide intervals",
    skillId: barSkill,
    gradeBand: "3–5",
    requiredResponseCapability: "single-choice-v1",
    description:
      "Sort a list into four equal intervals of 5, 10, 25, 50 or 100, or find how many more are in the first two intervals together than in the last.",
    glossarySenses: tableSenses,
  },
  {
    id: "scaled-bar-grade4",
    version: 1,
    title: "Two-step questions from a scaled bar graph",
    skillId: barSkill,
    gradeBand: "3–5",
    requiredFigureCapability: "data-displays-v1",
    description:
      "Read a bar graph whose side scale counts by 5, 10, 25, 50 or 100, and find how many more are in two categories together than in a third.",
    glossarySenses: barSenses,
  },
];

const metaOf = (id: string) => grade4DataTemplates.find((t) => t.id === id)!;

function tickLabel(tick: number, d: number): string {
  return dotTickLabel(tick / d, d, { fixedLabels: true });
}
function inchLabel(tick: number, d: number): string {
  // 0 takes the plural ("0 inches"). A fraction up to one whole stays singular.
  const unit = tick === 0 || tick > d ? "inches" : "inch";
  return `${tickLabel(tick, d)} ${unit}`;
}
const precision = (d: number) => PRECISION[d] ?? "nearest inch";

function generateOne(
  meta: TemplateMetadata,
  seed: string,
  build: (r: Random) => GeneratedProblem,
): GeneratedProblem {
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  let last: Error | undefined;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return build(random(meta.id, `${seed}#${attempt}`));
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
      last = error;
    }
  }
  throw last ?? new Error(`Need a ${meta.id} problem`);
}

function finish(
  meta: TemplateMetadata,
  seed: string,
  surface: Surface,
): GeneratedProblem {
  return {
    public: {
      id: hashId(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: surface.prompt,
      skillId: meta.skillId,
      response: surface.response,
      ...(surface.figure ? { figure: surface.figure } : {}),
    },
    answer: surface.answer,
    explanation: surface.explanation,
    hint: surface.hint,
    ...(surface.choiceFeedback
      ? { choiceFeedback: surface.choiceFeedback }
      : {}),
  };
}

function hashId(id: string, seed: string): string {
  return createHash("sha256")
    .update(JSON.stringify([id, 1, seed]))
    .digest("hex");
}

function dotScene(opts: {
  title?: string;
  width?: number;
  maxHeight: number;
  minTick: number;
  maxTick: number;
  d: number;
  ticks: readonly number[];
  blank?: boolean;
}): Scene {
  const values = opts.blank
    ? []
    : opts.ticks.map((t) => t / opts.d).sort((a, b) => a - b);
  return sceneSchema.parse({
    v: 1,
    ...(opts.title ? { title: opts.title } : {}),
    ...(opts.width ? { width: opts.width } : {}),
    maxHeight: opts.maxHeight,
    elements: [
      {
        type: "dotPlot",
        id: "plot",
        min: opts.minTick / opts.d,
        max: opts.maxTick / opts.d,
        denominator: opts.d,
        mark: "x",
        fixedLabels: true,
        ...(opts.blank ? { blank: true } : {}),
        groups: [{ values }],
        unit: "inches",
      },
    ],
  });
}

/** Counts on 4–6 ticks: one empty tick, one count of at least 2, sum at least 8, each count at most 4. */
function buildCounts(r: Random, nTicks: number): number[] {
  const counts = Array.from({ length: nTicks }, () => r(0, 4));
  const zeros = () => counts.filter((c) => c === 0).length;
  if (!counts.includes(0)) counts[r(0, nTicks - 1)] = 0;
  if (!counts.some((c) => c >= 2)) {
    if (zeros() >= 2) counts[counts.indexOf(0)] = 2;
    else {
      const i = counts.findIndex((c) => c > 0 && c < 4);
      if (i < 0) throw new Error("Need a cell that can reach 2");
      counts[i] = 2;
    }
  }
  let guard = 0;
  while (counts.reduce((a, b) => a + b, 0) < 8) {
    if (++guard > 40) throw new Error("Need a longer list");
    const room = counts.findIndex((c) => c > 0 && c < 4);
    if (room >= 0) {
      counts[room]!++;
      continue;
    }
    if (zeros() >= 2) {
      const z = counts.indexOf(0);
      counts[z] = counts[z]! + 1;
      continue;
    }
    throw new Error("Need room to grow the list and keep one empty mark");
  }
  if (!counts.includes(0) || !counts.some((c) => c >= 2))
    throw new Error("Need an empty mark and a repeated length");
  if (counts.some((c) => c > 4)) throw new Error("Need counts at most 4");
  return counts;
}

function buildSlots(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const d = DENOM_BAG[r(0, DENOM_BAG.length - 1)]!;
  const nTicks = r(4, 6);
  const counts = buildCounts(r, nTicks);
  const listedTicks: number[] = [];
  counts.forEach((c, i) => {
    for (let k = 0; k < c; k++) listedTicks.push(i);
  });
  const shown = shuffle(r, [...listedTicks]);
  const listed = shown.map((t) => tickLabel(t, d)).join(", ");
  const total = listedTicks.length;
  const sample = shown[0]!;
  const scene = dotScene({
    title: "Line plot with no marks yet",
    width: 640,
    maxHeight: 720,
    minTick: 0,
    maxTick: nTicks - 1,
    d,
    ticks: [],
    blank: true,
  });
  return multiPartProblem(meta, seed, r, {
    prompt: `A class measured ${count(total, "length")} to the ${precision(d)}. The number line has no marks yet. The lengths, in inches, are: ${listed}. How many lengths belong at each mark?`,
    layout: "table",
    label: "How many lengths?",
    rowHeader: "Length",
    slots: counts.map((c, i) => ({
      id: `t${i}`,
      label: tickLabel(i, d),
      correct: String(c),
      fixed: ["0", "1", "2", "3", "4"],
    })),
    figure: { kind: "scene", scene },
    hint: `Count the listed lengths. There are ${count(total, "length")} in all. One listed length is ${inchLabel(sample, d)}. Choose the count of listed lengths at each mark.`,
    explanation: counts.map(
      (c, i) =>
        `The mark at ${inchLabel(i, d)} matches ${count(c, "length")} from the list.`,
    ),
  });
}

function multiset(ticks: readonly number[]): string {
  return [...ticks].sort((a, b) => a - b).join(",");
}
function maxTickFor(d: number): number {
  return d >= 8 ? d : d * 2;
}
/** How far the second distractor moves one mark. Halves move by one whole unit, because half a unit is already one tick. */
function halfDelta(d: number): number {
  if (d === 2) return 2;
  if (d % 2 === 1) return Math.max(2, Math.round(d / 2));
  return d / 2;
}
function shiftWords(d: number): string {
  if (d === 2) return "one whole unit";
  if (d % 2 === 1) return "two or more ticks";
  return "half an inch";
}
function describe(
  ticks: readonly number[],
  d: number,
  maxTick: number,
): string {
  const parts: string[] = [];
  for (let t = 0; t <= maxTick; t++) {
    const c = ticks.filter((x) => x === t).length;
    parts.push(`${tickLabel(t, d)} has ${c}`);
  }
  const body =
    parts.length < 2
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
  return `Marks: ${body}.`;
}
function moved(
  ticks: readonly number[],
  delta: number,
  maxTick: number,
  blocked: Set<string>,
  r: Random,
): number[] {
  const order = shuffle(
    r,
    ticks.map((_, i) => i),
  );
  for (const i of order) {
    for (const sign of shuffle(r, [1, -1])) {
      const next = ticks[i]! + sign * delta;
      if (next < 0 || next > maxTick) continue;
      const copy = ticks.slice();
      copy[i] = next;
      if (copy.filter((t) => t === next).length > 4) continue;
      const key = multiset(copy);
      if (key === multiset(ticks) || blocked.has(key)) continue;
      return copy;
    }
  }
  throw new Error("Need a different graph");
}
function dropped(
  ticks: readonly number[],
  blocked: Set<string>,
  r: Random,
): number[] {
  for (const i of shuffle(
    r,
    ticks.map((_, index) => index),
  )) {
    const copy = ticks.filter((_, j) => j !== i);
    const key = multiset(copy);
    if (!blocked.has(key)) return copy;
  }
  throw new Error("Need a graph that leaves out one mark");
}

function dataMatch(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const d = DENOM_BAG[r(0, DENOM_BAG.length - 1)]!;
  const maxTick = maxTickFor(d);
  const pool = Array.from({ length: maxTick + 1 }, (_, i) => i);
  const chosen = shuffle(r, [...pool]).slice(0, 3);
  const ticks = [chosen[0]!, chosen[0]!, chosen[1]!, chosen[2]!];
  const n = r(6, 10);
  while (ticks.length < n) {
    const used = new Map<number, number>();
    for (const t of ticks) used.set(t, (used.get(t) ?? 0) + 1);
    const growable = [...used.entries()]
      .filter(([, c]) => c < 4)
      .map(([t]) => t);
    const fresh = pool.filter((t) => !used.has(t));
    const options = [...growable, ...fresh];
    if (!options.length) throw new Error("Need room for another length");
    ticks.push(options[r(0, options.length - 1)]!);
  }
  if (new Set(ticks).size < 3) throw new Error("Need three different lengths");
  const blocked = new Set<string>([multiset(ticks)]);
  const one = moved(ticks, 1, maxTick, blocked, r);
  blocked.add(multiset(one));
  const half = moved(ticks, halfDelta(d), maxTick, blocked, r);
  blocked.add(multiset(half));
  const gone = dropped(ticks, blocked, r);
  const groups = [ticks, one, half, gone];
  if (new Set(groups.map(multiset)).size !== 4)
    throw new Error("Need four different graphs");
  const sceneOf = (group: number[]) =>
    dotScene({
      width: CARD.width,
      maxHeight: CARD.maxHeight,
      minTick: 0,
      maxTick,
      d,
      ticks: group,
    });
  const textOf = (group: number[]) => describe(group, d, maxTick);
  const texts = groups.map(textOf);
  if (
    texts.some((text) => text.length < 10 || text.length > 240) ||
    new Set(texts).size !== 4
  )
    throw new Error("Need descriptions that fit");
  const shown = shuffle(r, [...ticks]);
  const listed = shown.map((t) => tickLabel(t, d)).join(", ");
  const sample = shown[0]!;
  const correct: Candidate = {
    description: texts[0]!,
    scene: sceneOf(ticks),
  };
  const distractors: Candidate[] = [
    {
      description: texts[1]!,
      scene: sceneOf(one),
      feedback: () => "This graph moves one mark by one tick.",
    },
    {
      description: texts[2]!,
      scene: sceneOf(half),
      feedback: () => `This graph moves one mark by ${shiftWords(d)}.`,
    },
    {
      description: texts[3]!,
      scene: sceneOf(gone),
      feedback: () => "This graph leaves out one mark.",
    },
  ];
  return problemOf(meta, seed, r, {
    prompt: `A class measured ${count(n, "length")} to the ${precision(d)}. The lengths, in inches, are: ${listed}. Which graph shows this list? Each graph is a line plot.`,
    label: "Choose the graph",
    noun: "Graph",
    correct,
    distractors,
    hint: `Match the list. There are ${count(n, "length")}, measured to the ${precision(d)}. One length in the list is ${inchLabel(sample, d)}. The matching line plot has one mark for each of those lengths.`,
    explanation: (name) => [
      `The list has ${count(n, "length")}.`,
      "Each length in the list needs one mark at that length.",
      `${name} has one mark for each listed length.`,
    ],
    walkthrough: correct.scene,
  });
}

type Ask = "mode" | "median" | "range";
type Situation = "none" | "one" | "several";

function modeLabel(freq: Map<number, number>, d: number): string {
  const present = [...freq.entries()];
  const maxF = Math.max(...present.map(([, c]) => c));
  const modes = present
    .filter(([, c]) => c === maxF)
    .map(([t]) => t)
    .sort((a, b) => a - b);
  const least = Math.min(...present.map(([, c]) => c));
  if (least === maxF) return "no mode";
  if (modes.length === 1) return inchLabel(modes[0]!, d);
  if (modes.length === 2)
    return `${inchLabel(modes[0]!, d)} and ${inchLabel(modes[1]!, d)}`;
  throw new Error("Need one mode or two modes");
}

function centerRange(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const d = [2, 4, 8][r(0, 2)]!;
  const pool = d === 8 ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5];
  const ask: Ask = (["mode", "median", "range"] as const)[r(0, 2)]!;
  const situation: Situation = (["none", "one", "several"] as const)[r(0, 2)]!;
  const take = (k: number) => shuffle(r, [...pool]).slice(0, k);
  let ticks: number[];
  if (situation === "none") ticks = take(5);
  else if (situation === "one") {
    const [a, b, c, e] = take(4);
    ticks = [a!, a!, a!, b!, b!, c!, e!];
  } else {
    const [a, b, c] = take(3);
    ticks = [a!, a!, a!, b!, b!, b!, c!];
  }
  const freq = new Map<number, number>();
  for (const t of ticks) freq.set(t, (freq.get(t) ?? 0) + 1);
  const lo = Math.min(...ticks);
  const hi = Math.max(...ticks);
  if (lo < 1) throw new Error("Need lengths above 0");
  const sorted = [...ticks].sort((a, b) => a - b);
  const medianTick = sorted[(sorted.length - 1) / 2]!;
  const rangeTicks = hi - lo;
  const correct =
    ask === "mode"
      ? modeLabel(freq, d)
      : ask === "median"
        ? inchLabel(medianTick, d)
        : inchLabel(rangeTicks, d);
  const focus =
    ask === "mode"
      ? [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]![0]
      : ask === "median"
        ? medianTick
        : rangeTicks;
  const wrongs: ChoiceOption[] = [];
  const seen = new Set<string>([correct]);
  const add = (label: string, feedback: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    wrongs.push({ label, feedback });
  };
  add(
    "no mode",
    "That would mean every length appears the same number of times.",
  );
  for (const [t, c] of freq)
    if (c === Math.max(...freq.values()))
      add(
        inchLabel(t, d),
        "That is only one of the lengths that appear most often.",
      );
  add(
    inchLabel(hi, d),
    "That is the greatest length, not the answer to this question.",
  );
  add(
    inchLabel(lo, d),
    "That is the least length, not the answer to this question.",
  );
  add(
    inchLabel(rangeTicks, d),
    "That is the greatest length minus the least length.",
  );
  add(
    inchLabel(medianTick, d),
    "That is the middle length, not the answer to this question.",
  );
  if (focus > 0)
    add(
      inchLabel(focus - 1, d),
      "That length is one mark away from the length this question asks for.",
    );
  add(
    inchLabel(focus + 1, d),
    "That length is one mark away from the length this question asks for.",
  );
  if (wrongs.length < 3) throw new Error("Need three different wrong answers");
  const question =
    ask === "mode"
      ? "What is the mode?"
      : ask === "median"
        ? "What is the median length?"
        : "What is the range?";
  const task =
    ask === "mode"
      ? "Find the length that appears most often. If the lengths tie, there is not a single mode."
      : ask === "median"
        ? "Order the lengths and take the middle one."
        : "Subtract the least length from the greatest length.";
  const surface = choiceSurface(r, {
    prompt: `The line plot shows lengths measured to the ${precision(d)}. ${question}`,
    options: [
      { label: correct, correct: true as const },
      ...wrongs.slice(0, 3),
    ],
    hint: `Read the marks. The plot shows ${count(ticks.length, "length")}, measured to the ${precision(d)}. ${task}`,
    explanation:
      ask === "mode" && correct === "no mode"
        ? [
            "Every length has 1 mark, so there is not one mode.",
            "The mode is not a single length.",
          ]
        : [
            ask === "mode"
              ? "Count the marks above each length. The mode is the length with the most marks."
              : ask === "median"
                ? `Order the ${count(ticks.length, "length")} and take the middle one.`
                : "Subtract the least length from the greatest length.",
            `The answer is ${correct}.`,
          ],
    label: "Choose the answer",
  });
  if (!surface) throw new Error("Need three different wrong answers");
  const scene = dotScene({
    title: "Line plot of the lengths",
    width: 640,
    maxHeight: 720,
    minTick: lo,
    maxTick: hi,
    d,
    ticks,
  });
  return finish(meta, seed, {
    ...surface,
    figure: { kind: "scene", scene },
  });
}

const WIDTHS = [5, 10, 25, 50, 100] as const;
const TABLE_NOUNS = ["score", "book", "minute", "page"] as const;
const DASH = "\u2013";

function tableLine(
  bounds: readonly (readonly [number, number])[],
  counts: readonly number[],
  noun: string,
): string {
  return bounds
    .map(([a, b], i) => `${a}${DASH}${b}: ${count(counts[i]!, noun)}`)
    .join("; ");
}

function frequencyTable(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const width = WIDTHS[r(0, WIDTHS.length - 1)]!;
  const noun = TABLE_NOUNS[r(0, TABLE_NOUNS.length - 1)]!;
  let counts: number[] = [];
  for (let guard = 0; guard < 40; guard++) {
    counts = [r(4, 9), r(4, 9), r(4, 9), r(4, 9)];
    const sum = counts.reduce((a, b) => a + b, 0);
    if (sum >= 24 && sum <= 36 && counts[0]! + counts[1]! > counts[3]!) break;
    counts = [];
  }
  if (!counts.length) throw new Error("Need counts that fit the intervals");
  const bounds = [0, 1, 2, 3].map(
    (i) => [i * width, (i + 1) * width - 1] as [number, number],
  );
  const shifted: [number, number][] = [
    [0, width],
    [width + 1, 2 * width - 1],
    [2 * width, 3 * width - 1],
    [3 * width, 4 * width - 1],
  ];
  const values: number[] = [];
  bounds.forEach(([lo, hi], i) => {
    values.push(lo, hi);
    for (let k = 0; k < counts[i]! - 2; k++) values.push(r(lo, hi));
  });
  shuffle(r, values);
  const build = r(0, 1) === 0;
  if (build) {
    const correct = tableLine(bounds, counts, noun);
    const texts = new Set<string>([correct]);
    const wrongs: ChoiceOption[] = [];
    const add = (label: string, feedback: string) => {
      if (texts.has(label) || label.length > 120) return false;
      texts.add(label);
      wrongs.push({ label, feedback });
      return true;
    };
    add(
      tableLine(shifted, counts, noun),
      "The end values of the intervals are shifted. Each interval includes both ends and does not share an end with the next.",
    );
    for (let i = 0; i < 4 && wrongs.length < 3; i++) {
      for (let j = 0; j < 4 && wrongs.length < 3; j++) {
        if (i === j) continue;
        const next = counts.slice();
        next[i] = counts[i]! + 1;
        next[j] = counts[j]! - 1;
        if (next[j]! < 1) continue;
        add(
          tableLine(bounds, next, noun),
          "Two of the counts are off by 1. Count each interval again, including both end values.",
        );
      }
    }
    for (let i = 0; i < 4 && wrongs.length < 3; i++) {
      for (let j = i + 1; j < 4 && wrongs.length < 3; j++) {
        if (counts[i] === counts[j]) continue;
        const next = counts.slice();
        next[i] = counts[j]!;
        next[j] = counts[i]!;
        add(
          tableLine(bounds, next, noun),
          "Two counts are swapped. Match each count to its own interval.",
        );
      }
    }
    if (wrongs.length < 3) throw new Error("Need three different tables");
    const n = values.length;
    const surface = choiceSurface(r, {
      prompt: `Sort the numbers into intervals. There are ${count(n, noun)}. The intervals are ${width} units wide, starting at 0. The numbers are: ${values.join(", ")}. Which table matches the list?`,
      options: [
        { label: correct, correct: true as const },
        ...wrongs.slice(0, 3),
      ],
      hint: `Sort the numbers into intervals. There are ${count(n, noun)}. Each interval is ${width} units wide, and it includes both end values. Count how many listed numbers fall in each interval.`,
      explanation: [
        `The intervals are ${width} units wide and start at 0. Each interval includes both end values.`,
        `The first interval is 0 to ${width - 1}. It holds ${count(counts[0]!, noun)}.`,
        `The other intervals hold ${count(counts[1]!, noun)}, ${count(counts[2]!, noun)} and ${count(counts[3]!, noun)}.`,
        "The matching table is the one with those counts.",
      ],
      label: "Choose the answer",
    });
    if (!surface) throw new Error("Need three different tables");
    return finish(meta, seed, surface);
  }
  const firstTwo = counts[0]! + counts[1]!;
  const last = counts[3]!;
  const diff = firstTwo - last;
  const rows = bounds
    .map(([a, b], i) => `${a}${DASH}${b} has ${count(counts[i]!, noun)}.`)
    .join(" ");
  const plural = count(2, noun).replace(/^\d+ /, "");
  const options: ChoiceOption[] = [
    { label: count(diff, noun), correct: true as const },
    {
      label: count(firstTwo, noun),
      feedback:
        "That is the first two intervals added, without subtracting the last interval.",
    },
    {
      label: count(firstTwo + last, noun),
      feedback: "That adds the last interval instead of subtracting it.",
    },
    {
      label: count(diff + 1, noun),
      feedback: "That is one more than the difference.",
    },
  ];
  const surface = choiceSurface(r, {
    prompt: `A frequency table shows ${plural}. ${rows} Each interval includes both of its end values. How many more ${plural} are in the first two intervals together than in the last interval?`,
    options,
    hint: `Use both ends of the first interval. The first interval runs from 0 to ${width - 1}, and each interval is ${width} units wide. Add the counts of the first two intervals, then subtract the count of the last interval.`,
    explanation: [
      `The first interval ends at ${width - 1}, so both end values belong in it.`,
      `The first two intervals together hold ${count(firstTwo, noun)}.`,
      `The last interval holds ${count(last, noun)}.`,
      `Subtract: ${firstTwo} − ${last} = ${diff}.`,
      `The difference is ${count(diff, noun)}.`,
    ],
    label: "Choose the answer",
  });
  if (!surface) throw new Error("Need three different differences");
  return finish(meta, seed, surface);
}

const BAR_STEPS = [5, 10, 10, 25, 25, 50, 50, 50, 100, 100, 100] as const;
const BAR_CONTEXTS = [
  { labels: ["Oak", "Pine", "Maple", "Birch"], unit: "books", one: "book" },
  { labels: ["Red", "Blue", "Gold", "Green"], unit: "cans", one: "can" },
  {
    labels: ["Chess", "Robot", "Drama", "Garden"],
    unit: "students",
    one: "student",
  },
  {
    labels: ["North", "South", "East", "West"],
    unit: "stickers",
    one: "sticker",
  },
] as const;

function scaledBarGrade4(
  meta: TemplateMetadata,
  seed: string,
  r: Random,
): GeneratedProblem {
  const step = BAR_STEPS[r(0, BAR_STEPS.length - 1)]!;
  const lines = r(4, 10);
  const max = step * lines;
  const grain = halfStep(step);
  const slots = max / grain;
  const context = BAR_CONTEXTS[r(0, BAR_CONTEXTS.length - 1)]!;
  const heights = shuffle(
    r,
    Array.from({ length: slots }, (_, i) => (i + 1) * grain),
  ).slice(0, 4);
  if (new Set(heights).size < 4) throw new Error("Need four bar heights");
  const labels = [...context.labels];
  const trio = shuffle(r, [0, 1, 2, 3]).slice(0, 3);
  const ranked = [...trio].sort((a, b) => heights[b]! - heights[a]!);
  const high = ranked[0]!;
  const mid = ranked[1]!;
  const low = ranked[2]!;
  const diff = heights[high]! + heights[mid]! - heights[low]!;
  if (diff <= 0) throw new Error("Need a positive difference");
  const pair = shuffle(r, [high, mid]);
  const a = labels[pair[0]!]!;
  const b = labels[pair[1]!]!;
  const c = labels[low]!;
  const sum = heights[pair[0]!]! + heights[pair[1]!]!;
  const surface = numberSurface({
    prompt: `The bar graph shows ${context.unit}. How many more ${context.unit} are in ${a} and ${b} together than in ${c}? Each line on the side counts as ${step} on this graph.`,
    answer: String(diff),
    hint: `Read the bar graph scale. Each line counts as ${step}. Read the bars for ${a}, ${b} and ${c}. Add the first two readings, then subtract the third.`,
    explanation: [
      `The scale counts by ${step}. Read each bar against that scale.`,
      labels
        .map((label, i) => `${label} shows ${count(heights[i]!, context.one)}`)
        .join(", ") + ".",
      `${a} and ${b} together are ${heights[pair[0]!]!} + ${heights[pair[1]!]!} = ${sum}.`,
      `Subtract ${c}: ${sum} − ${heights[low]!} = ${diff}.`,
      `The difference is ${count(diff, context.one)}.`,
    ],
  });
  return finish(meta, seed, {
    ...surface,
    figure: {
      kind: "scaled-bar-graph",
      categories: labels.map((label, i) => ({ label, value: heights[i]! })),
      step,
      max,
      unit: context.unit,
    },
  });
}

export const generateGrade4DataProblem = dispatch(grade4DataTemplates, {
  "line-plot-build-slots": (seed) =>
    generateOne(metaOf("line-plot-build-slots"), seed, (r) =>
      buildSlots(metaOf("line-plot-build-slots"), seed, r),
    ),
  "line-plot-data-match": (seed) =>
    generateOne(metaOf("line-plot-data-match"), seed, (r) =>
      dataMatch(metaOf("line-plot-data-match"), seed, r),
    ),
  "line-plot-center-range": (seed) =>
    generateOne(metaOf("line-plot-center-range"), seed, (r) =>
      centerRange(metaOf("line-plot-center-range"), seed, r),
    ),
  "frequency-table-grade4": (seed) =>
    generateOne(metaOf("frequency-table-grade4"), seed, (r) =>
      frequencyTable(metaOf("frequency-table-grade4"), seed, r),
    ),
  "scaled-bar-grade4": (seed) =>
    generateOne(metaOf("scaled-bar-grade4"), seed, (r) =>
      scaledBarGrade4(metaOf("scaled-bar-grade4"), seed, r),
    ),
});
