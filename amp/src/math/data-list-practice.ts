import type { TemplateMetadata } from "./contracts";
import { lineTable } from "./scene/author";
import { sceneSchema } from "./scene/spec";
import { MAX_STACK, stackHeights } from "./data-display-models";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const dataListTemplate: TemplateMetadata = {
  id: "data-list-for-display",
  version: 1,
  requiredFigureCapability: "scenes-v1",
  requiredResponseCapability: "single-choice-v1",
  title: "Which list of data matches the display?",
  skillId: "line-plots",
  gradeBand: "3–5",
  difficultyOffset: 0.2,
  description:
    "Choose the list of whole numbers that matches a dot plot, a table of counts or a table of counts in ranges, against lists with one value changed or moved across a range boundary.",
};

type R = (lo: number, hi: number) => number;
const axes = {
  display: defineAxis("display", [
    "dot-plot",
    "count-table",
    "range-table",
  ] as const),
};
const contexts = [
  { what: "the number of pets each student in a class has", unit: "pets" },
  { what: "the number of books each student read last month", unit: "books" },
  {
    what: "the number of goals scored in each game of a season",
    unit: "goals",
  },
  { what: "the minutes each student spent on a puzzle", unit: "minutes" },
];
interface Model {
  display: "dot-plot" | "count-table" | "range-table";
  context: (typeof contexts)[number];
  values: number[];
  /** Range tables: the width and the first range's start. */
  width: number;
  options: number[][];
  correct: number;
}
const sortedCopy = (v: number[]) => [...v].sort((a, b) => a - b);
function model(r: R, a: { display: Model["display"] }): Model {
  const context = pick(r, contexts);
  const ranged = a.display === "range-table";
  const lo = ranged ? 10 : 1;
  const hi = ranged ? 49 : 9;
  const n = r(9, 13);
  const values = sortedCopy(Array.from({ length: n }, () => r(lo, hi)));
  const key = (v: number[]) => sortedCopy(v).join(",");
  if (
    a.display === "dot-plot" &&
    Math.max(...stackHeights(values).values()) > MAX_STACK
  )
    throw new Error("Need three retries");
  const distinct = new Set(values).size;
  if (distinct < 4) throw new Error("Need three retries");
  const width = 10;
  const bucket = (v: number) => (ranged ? Math.floor(v / width) : v);
  const nearBoundary = (v: number) =>
    ranged && (v % width === 0 || v % width === width - 1);
  // Wrong lists: change one value, move a value across a boundary or to the next
  // value, and drop a value for a repeated one.
  const wrong: number[][] = [];
  const tryAdd = (list: number[]) => {
    const l = sortedCopy(list);
    if (l.length !== n || l.some((v) => v < lo || v > hi)) return;
    if (key(l) === key(values) || wrong.some((w) => key(w) === key(l))) return;
    // A wrong list must not give the same table.
    const counts = (xs: number[]) => {
      const m = new Map<number, number>();
      for (const v of xs) m.set(bucket(v), (m.get(bucket(v)) ?? 0) + 1);
      return [...m].sort((x, y) => x[0] - y[0]).join("|");
    };
    if (a.display !== "dot-plot" && counts(l) === counts(values)) return;
    if (
      a.display === "dot-plot" &&
      Math.max(...stackHeights(l).values()) > MAX_STACK
    )
      return;
    wrong.push(l);
  };
  for (let t = 0; t < 60 && wrong.length < 3; t++) {
    const i = r(0, n - 1);
    const copy = [...values];
    const kind = r(0, 2);
    if (kind === 0) copy[i] = copy[i]! + (r(0, 1) ? 1 : -1);
    else if (kind === 1 && ranged) {
      const b = pick(r, values.filter(nearBoundary).concat(values));
      const j = copy.indexOf(b);
      copy[j] =
        b % width === 0 ? b - 1 : b + (b % width === width - 1 ? 1 : width);
    } else copy[i] = copy[r(0, n - 1)]!;
    tryAdd(copy);
  }
  if (wrong.length < 3) throw new Error("Need three retries");
  const options = draw(r, [values, ...wrong], 4);
  return {
    display: a.display,
    context,
    values,
    width,
    options,
    correct: options.findIndex((o) => key(o) === key(values)),
  };
}

export const dataList = chainFamily({
  template: dataListTemplate,
  axes,
  model,
  variant: (m) => m.display,
  render: (m, _a, r) => {
    const n = m.values.length;
    const counts = new Map<number, number>();
    const bucket = (v: number) =>
      m.display === "range-table" ? Math.floor(v / m.width) : v;
    for (const v of m.values)
      counts.set(bucket(v), (counts.get(bucket(v)) ?? 0) + 1);
    const keys = [...counts.keys()].sort((x, y) => x - y);
    const text = (l: number[]) => l.join(", ");
    const figure =
      m.display === "dot-plot"
        ? {
            kind: "scene" as const,
            scene: sceneSchema.parse({
              v: 1,
              maxHeight: 720,
              elements: [
                {
                  type: "dotPlot",
                  id: "plot",
                  min: 0,
                  max: 10,
                  mark: "dot",
                  groups: [{ values: m.values }],
                  unit: m.context.unit,
                },
              ],
            }),
          }
        : {
            kind: "scene" as const,
            scene: lineTable(
              [
                [
                  m.display === "range-table" ? "Range" : "Value",
                  ...keys.map((k) =>
                    m.display === "range-table"
                      ? `${k * m.width}–${k * m.width + m.width - 1}`
                      : String(k),
                  ),
                ],
                ["Count", ...keys.map((k) => String(counts.get(k)))],
              ],
              { header: "column" },
            ).scene(),
          };
    const shown =
      m.display === "dot-plot"
        ? "The dot plot shows"
        : m.display === "count-table"
          ? "The table shows how many times each value was recorded for"
          : "The table shows how many values fall in each range for";
    const first = keys[0]!;
    const name = (k: number) =>
      m.display === "range-table"
        ? `the range ${k * m.width}–${k * m.width + m.width - 1}`
        : `the value ${k}`;
    /** Names the first value (or range) whose count in a wrong list differs. */
    const mismatch = (l: number[]) => {
      const own = new Map<number, number>();
      for (const v of l) own.set(bucket(v), (own.get(bucket(v)) ?? 0) + 1);
      const all = [...new Set([...keys, ...own.keys()])].sort((x, y) => x - y);
      const k = all.find((x) => (own.get(x) ?? 0) !== (counts.get(x) ?? 0))!;
      const has = own.get(k) ?? 0,
        want = counts.get(k) ?? 0;
      const shownCount =
        m.display === "dot-plot"
          ? `the dot plot has ${want} ${want === 1 ? "dot" : "dots"} above ${k}`
          : `the table shows ${want}`;
      return `This list has ${has} ${has === 1 ? "value" : "values"} ${m.display === "range-table" ? "in" : "equal to"} ${name(k).replace(/^the (value|range) /, "")}, but ${shownCount}. Every count must match, not only the number of values.`;
    };
    const surface = choiceSurface(r, {
      prompt: `${shown} ${m.context.what}. Which list of data could match it?`,
      options: m.options.map((o, i) =>
        i === m.correct
          ? { label: text(o), correct: true as const }
          : {
              label: text(o),
              feedback: mismatch(o),
            },
      ),
      hint:
        m.display === "dot-plot"
          ? `Count all the dots first: there are ${n}, so the list needs ${n} values. Then count the dots above ${first} and compare it with the count of ${first} in each list.`
          : m.display === "count-table"
            ? `Add the counts: the list needs ${n} values. Then compare the count of ${first} in each list with the table.`
            : `Add the counts: the list needs ${n} values. Then count how many values of each list fall in the range ${first * m.width}–${first * m.width + m.width - 1}.`,
      explanation: [
        m.display === "dot-plot"
          ? `In a dot plot, each dot is one value from the list, stacked above that value.`
          : `Each count in the table tells how many values from the list ${m.display === "range-table" ? "fall in that range" : "equal that value"}.`,
        `The ${m.display === "dot-plot" ? "dots" : "counts"} add to ${n}, so the list must have ${n} values.`,
        m.display === "range-table"
          ? `Sort each list into the ranges. The table needs the counts ${keys.map((k) => counts.get(k)).join(", ")}, in order from the first range.`
          : `The list must have: ${keys.map((k) => `${k} recorded ${counts.get(k)} ${counts.get(k) === 1 ? "time" : "times"}`).join(", ")}.`,
        `Only ${text(m.values)} has exactly these counts, so it is the list that matches.`,
      ],
    });
    return surface && { ...surface, figure };
  },
});

export const dataListTemplates = [dataListTemplate] as const;
export const dataListGenerate = dispatch(dataListTemplates, {
  "data-list-for-display": (seed) => dataList.generate(seed).problem,
});
