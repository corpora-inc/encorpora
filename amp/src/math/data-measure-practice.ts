import type { TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  numberSurface,
  pick,
} from "./chain-kit";
import { shuffled } from "./elementary-gap-kit";

export const modeTemplate: TemplateMetadata = {
  id: "mode-of-data",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  title: "Find the mode",
  skillId: "mean-median",
  gradeBand: "3–5",
  difficultyOffset: -0.9,
  description:
    "Find the mode of a list of whole numbers or of a table of values and how many times each appears.",
};
export const measureMeaningTemplate: TemplateMetadata = {
  id: "measure-meaning-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Mean, median, mode or range",
  skillId: "mean-median",
  gradeBand: "3–5",
  difficultyOffset: -0.7,
  description:
    "Name the measure (mean, median, mode or range) that a description defines, or choose the description of a named measure for a small data set.",
};

type R = (lo: number, hi: number) => number;

/* ----------------------------------------------------------------- mode */
const modeAxes = {
  display: defineAxis("display", ["list", "table"] as const),
};
interface ModeModel {
  display: "list" | "table";
  values: number[];
  mode: number;
  modeCount: number;
  context: { noun: string; what: string };
}
const modeContexts = [
  { noun: "points", what: "points scored in a game" },
  { noun: "books", what: "books read last month" },
  { noun: "pets", what: "pets owned" },
  { noun: "minutes", what: "minutes of practice" },
];
function modeModel(r: R, a: { display: "list" | "table" }): ModeModel {
  const context = pick(r, modeContexts);
  const distinct = a.display === "table" ? r(4, 7) : r(3, 6);
  const low = r(1, 12);
  const pool = Array.from(
    { length: distinct },
    (_, i) => low + i * (a.display === "table" ? 1 : r(1, 3)),
  );
  if (new Set(pool).size !== pool.length) throw new Error("Need three retries");
  const counts = pool.map(() => r(1, 3));
  const mode = r(0, pool.length - 1);
  counts[mode] = 3 + r(0, 2);
  const top = Math.max(...counts);
  if (counts.filter((c) => c === top).length !== 1)
    throw new Error("Need three retries");
  const values = shuffled(
    r,
    pool.flatMap((v, i) => Array(counts[i]).fill(v) as number[]),
  );
  if (values.length < 8 || values.length > 14)
    throw new Error("Need three retries");
  return {
    display: a.display,
    values,
    mode: pool[mode]!,
    modeCount: top,
    context,
  };
}
export const modeOfData = chainFamily({
  template: modeTemplate,
  axes: modeAxes,
  model: modeModel,
  variant: (m) => m.display,
  render: (m) => {
    const counts = new Map<number, number>();
    for (const v of m.values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const sorted = [...counts.keys()].sort((a, b) => a - b);
    const first = m.values[0]!;
    const surface =
      m.display === "list"
        ? numberSurface({
            prompt: `A class recorded the ${m.context.what}: ${m.values.join(", ")}. What is the mode of these numbers?`,
            answer: String(m.mode),
            hint: `The mode is the number that appears most often. Start with ${first} and count how many times it appears in the list, then do the same for each other number.`,
            explanation: [
              `The mode is the number that appears most often in a list.`,
              `Count how many times each number appears: ${sorted.map((v) => `${v} is listed ${counts.get(v)} ${counts.get(v) === 1 ? "time" : "times"}`).join(", ")}.`,
              `${m.mode} has the greatest count, ${m.modeCount}, more than any other number.`,
              `The mode is ${m.mode}.`,
            ],
            label: "Answer (the mode)",
          })
        : numberSurface({
            prompt: `The table shows the ${m.context.what} by a class and how many times each number was recorded. What is the mode of the numbers recorded?`,
            answer: String(m.mode),
            hint: `The mode is the number recorded the most times. Read the second row for each number, starting with ${sorted[0]}, and find the greatest count.`,
            explanation: [
              `The mode is the number that appears most often. In this table, the second row already counts each number for you.`,
              `Read the counts: ${sorted.map((v) => `${v} was recorded ${counts.get(v)} ${counts.get(v) === 1 ? "time" : "times"}`).join(", ")}.`,
              `The greatest count is ${m.modeCount}, for the number ${m.mode}. The mode is the number, not its count.`,
              `The mode is ${m.mode}.`,
            ],
            label: "Answer (the mode)",
          });
    if (m.display === "list") return surface;
    const table = lineTable(
      [
        ["Number", ...sorted.map(String)],
        ["Times", ...sorted.map((v) => String(counts.get(v)))],
      ],
      { header: "column" },
    );
    return {
      ...surface,
      figure: { kind: "scene" as const, scene: table.scene() },
    };
  },
});

/* ------------------------------------------------------ measure meaning */
type Measure = "mean" | "median" | "mode" | "range";
const measureAxes = {
  ask: defineAxis("ask", ["name-measure", "describe-measure"] as const),
};
interface MeasureModel {
  ask: "name-measure" | "describe-measure";
  measure: Measure;
  values: number[];
  value: Record<Measure, number>;
  context: { items: string; unit: string; subject: string; share: string };
}
const measureContexts = [
  {
    items: "game scores",
    unit: "points",
    subject: "friends",
    share: "if all the points were shared equally",
  },
  {
    items: "fish counts",
    unit: "fish",
    subject: "aquariums",
    share: "if the fish were shared equally",
  },
  {
    items: "reading totals",
    unit: "books",
    subject: "students",
    share: "if the books were shared equally",
  },
];
const measureNames: Record<Measure, string> = {
  mean: "Mean",
  median: "Median",
  mode: "Mode",
  range: "Range",
};
const measureSentence = (m: MeasureModel, k: Measure) => {
  const { subject, share } = m.context;
  const v = m.value[k];
  switch (k) {
    case "mean":
      return `The number each of the ${subject} would have ${share}: ${v}`;
    case "median":
      return `The middle number when the numbers are in order: ${v}`;
    case "mode":
      return `The number that appears most often: ${v}`;
    case "range":
      return `The difference between the greatest and the least number: ${v}`;
  }
};
function measureModel(r: R, a: { ask: MeasureModel["ask"] }): MeasureModel {
  const context = pick(r, measureContexts);
  const n = pick(r, [5, 5, 7]);
  for (let tries = 0; tries < 2000; tries++) {
    const low = r(3, 9);
    const values = Array.from({ length: n }, () => low + r(0, 12));
    const sorted = [...values].sort((x, y) => x - y);
    const sum = values.reduce((s, v) => s + v, 0);
    if (sum % n) continue;
    const counts = new Map<number, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    const top = Math.max(...counts.values());
    const modes = [...counts].filter(([, c]) => c === top).map(([v]) => v);
    if (top < 2 || modes.length !== 1) continue;
    const value: Record<Measure, number> = {
      mean: sum / n,
      median: sorted[(n - 1) / 2]!,
      mode: modes[0]!,
      range: sorted[n - 1]! - sorted[0]!,
    };
    // The four numbers must differ so a choice cannot be right by accident.
    if (new Set(Object.values(value)).size !== 4) continue;
    return {
      ask: a.ask,
      measure: pick(r, ["mean", "median", "mode", "range"] as const),
      values: shuffled(r, values),
      value,
      context,
    };
  }
  throw new Error("Need three retries");
}
/** The computation of one measure for this list, in plain steps. */
const work = (m: MeasureModel, k: Measure) => {
  const sorted = [...m.values].sort((x, y) => x - y),
    n = sorted.length,
    sum = sorted.reduce((a, b) => a + b, 0);
  switch (k) {
    case "mean":
      return `Add them: ${m.values.join(" + ")} = ${sum}. Share the total ${n} ways: ${sum} ÷ ${n} = ${m.value.mean}.`;
    case "median":
      return `In order: ${sorted.join(", ")}. The middle one, number ${(n + 1) / 2} of ${n}, is ${m.value.median}.`;
    case "mode":
      return `${m.value.mode} is listed ${sorted.filter((v) => v === m.value.mode).length} times, more often than any other number.`;
    case "range":
      return `The greatest is ${sorted[n - 1]} and the least is ${sorted[0]}: ${sorted[n - 1]} − ${sorted[0]} = ${m.value.range}.`;
  }
};
const nameWhy: Record<Measure, string> = {
  mean: "the fair share: the total divided equally",
  median: "the middle number in order",
  mode: "the number that appears most often",
  range: "the difference between the greatest and least numbers",
};
export const measureMeaning = chainFamily({
  template: measureMeaningTemplate,
  axes: measureAxes,
  model: measureModel,
  variant: (m) => `${m.ask}-${m.measure}`,
  render: (m, _a, r) => {
    const all: Measure[] = ["mean", "median", "mode", "range"];
    const list = m.values.join(", ");
    const intro = `Here are the ${m.context.items} for ${m.values.length} ${m.context.subject}: ${list}.`;
    if (m.ask === "name-measure") {
      const ask =
        m.measure === "mean"
          ? `Which measure tells the number each of the ${m.context.subject} would have ${m.context.share}?`
          : m.measure === "median"
            ? "Which measure is the middle number when the numbers are put in order?"
            : m.measure === "mode"
              ? "Which measure is the number that appears most often?"
              : "Which measure is the difference between the greatest and the least number?";
      return choiceSurface(r, {
        prompt: `${intro} ${ask}`,
        options: all.map((k) =>
          k === m.measure
            ? { label: measureNames[k], correct: true as const }
            : {
                label: measureNames[k],
                feedback: `The ${k.toLowerCase()} is ${nameWhy[k]}, which is ${m.value[k]} for these numbers. The question describes ${nameWhy[m.measure]}.`,
              },
        ),
        hint: `Use the numbers ${list}: put them in order from least to greatest and check ${m.values.length} values. Which measure matches what the question describes: the fair share, the middle, the most often, or the difference between greatest and least?`,
        explanation: [
          `The mean is the fair share, the total divided equally. The median is the middle number in order.`,
          `The mode is the number that appears most often. The range is the greatest number minus the least.`,
          `The question describes ${nameWhy[m.measure]}.`,
          work(m, m.measure),
          `That measure is the ${m.measure}.`,
        ],
      });
    }
    return choiceSurface(r, {
      prompt: `${intro} Which sentence describes the ${m.measure} of these numbers?`,
      options: all.map((k) =>
        k === m.measure
          ? { label: measureSentence(m, k)!, correct: true as const }
          : {
              label: measureSentence(m, k)!,
              feedback: `That describes the ${k}, not the ${m.measure}. The ${m.measure} is ${nameWhy[m.measure]}.`,
            },
      ),
      hint: `Put ${list} in order first. The ${m.measure} is ${nameWhy[m.measure]}; check each sentence against that meaning, not only against the numbers.`,
      explanation: [
        `The ${m.measure} is ${nameWhy[m.measure]}.`,
        work(m, m.measure),
        `So the matching sentence is: "${measureSentence(m, m.measure)}".`,
      ],
    });
  },
});

export const dataMeasureTemplates = [
  modeTemplate,
  measureMeaningTemplate,
] as const;
export const dataMeasureGenerate = dispatch(dataMeasureTemplates, {
  "mode-of-data": (seed) => modeOfData.generate(seed).problem,
  "measure-meaning-choice": (seed) => measureMeaning.generate(seed).problem,
});
