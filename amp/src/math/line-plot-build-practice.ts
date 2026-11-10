import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle } from "./distribution-practice";
import { lineTable, scene } from "./scene/author";
import { clientDrawsValue, defineAxis } from "./variation/axes";
import {
  normalizeLinePlotBuild,
  type LinePlotBuildResponse,
} from "./line-plot-build";

export const linePlotBuildTemplates: readonly TemplateMetadata[] = [
  {
    id: "line-plot-build",
    version: 1,
    title: "Make a line plot of the measurements",
    skillId: "line-plots",
    gradeBand: "K–2",
    description:
      "Make a line plot from several lengths, repeated measurements, a table, or drawn rulers. Place one X per measurement on a consecutive whole-number scale.",
    requiredResponseCapability: "line-plot-build-v1",
    requiredFigureCapability: "scenes-v1",
    glossaryNoLink: ["tally", "whole"],
  },
];
const families = defineAxis(
  "source",
  ["given-several", "given-repeated", "given-table", "measure-and-plot"],
  {
    weights: [30, 20, 15, 35],
    needs: { "measure-and-plot": "scenes-v2" },
  },
);
const nouns = [
  "crayon",
  "pencil",
  "ribbon",
  "leaf",
  "straw",
  "paper clip chain",
  "shoe",
  "stick",
  "string",
  "feather",
  "block",
  "eraser",
];
const colors = ["red", "blue", "green", "yellow", "orange", "purple", "pink"];
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);
const tally = (values: number[]) => {
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    counts[v] = (counts[v] ?? 0) + 1;
  });
  return counts;
};

export function generateLinePlotBuild(
  _id: string,
  seed: string,
): GeneratedProblem {
  const meta = linePlotBuildTemplates[0]!;
  const r = random(meta.id, seed);
  const available = families.values.filter((f) =>
    clientDrawsValue(families, f),
  );
  let roll = r(
    1,
    available.reduce(
      (n, f) => n + families.weights![families.values.indexOf(f)]!,
      0,
    ),
  );
  const family = available.find(
    (f) => (roll -= families.weights![families.values.indexOf(f)]!) <= 0,
  )!;
  const unit: "cm" | "in" = r(0, 1) ? "cm" : "in";
  const one = unit === "cm" ? "centimeter" : "inch";
  const many = unit === "cm" ? "centimeters" : "inches";
  const object = nouns[r(0, nouns.length - 1)]!;
  const objects = object === "leaf" ? "leaves" : `${object}s`;
  let values: number[];
  if (family === "given-repeated") {
    const center = r(unit === "cm" ? 5 : 3, unit === "cm" ? 18 : 11);
    // Both neighbors and a strict mode, with no stack taller than four.
    const mid = r(3, 4),
      below = r(1, 2),
      above = r(1, 2);
    values = [
      ...Array<number>(mid).fill(center),
      ...Array<number>(below).fill(center - 1),
      ...Array<number>(above).fill(center + 1),
    ];
  } else {
    // Four-value windows are within the standard's 4–6 range. With the
    // two surrounding ticks, six columns retain 44px targets at 320px.
    const width = family === "measure-and-plot" ? r(3, 4) : 4;
    const min = r(
      2,
      (family === "measure-and-plot" ? 10 : unit === "cm" ? 20 : 12) -
        width +
        1,
    );
    const max = min + width - 1;
    const gap = r(1, 10) <= 7 ? r(min + 1, max - 1) : -1;
    const pool = range(min, max).filter((v) => v !== gap);
    const n =
      family === "measure-and-plot"
        ? r(Math.max(4, pool.length + 1), 6)
        : r(Math.max(5, pool.length + 1), family === "given-table" ? 7 : 9);
    values = [...pool];
    while (values.length < n) {
      const counts = tally(values),
        choices = pool.filter((v) => (counts[v] ?? 0) < 4);
      values.push(choices[r(0, choices.length - 1)]!);
    }
  }
  values = shuffle(r, values);
  // Measurement order, never an accidentally sorted list.
  if (
    values.every((v, i) => i === 0 || values[i - 1]! <= v) ||
    values.every((v, i) => i === 0 || values[i - 1]! >= v)
  ) {
    const different = values.findIndex((v) => v !== values[0]);
    const a = different === 1 ? 0 : different;
    [values[a], values[1]] = [values[1]!, values[a]!];
  }
  const min = Math.max(0, Math.min(...values) - 1),
    max = Math.max(...values) + 1;
  const counts = tally(values),
    n = values.length;
  const response: LinePlotBuildResponse = {
    kind: "line-plot-build",
    label: `Lengths of ${objects}`,
    axis: { min, max, unit: many },
    maxPerValue: 6,
    marker: "x",
    measurementCount: n,
  };
  let prompt: string, figure: SemanticFigure | undefined;
  let readings: { start: number; end: number }[] | undefined;
  const measuring: string[] = [];
  if (family === "measure-and-plot") {
    readings = values.map((length) => {
      const start = r(1, 10) <= 3 ? r(1, 3) : 0;
      const offset = [0, 0.2, 0.3, -0.3, -0.2][r(0, 4)]!;
      return { start, end: Math.round((start + length + offset) * 10) / 10 };
    });
    const rulerLength =
      Math.ceil(Math.max(...readings.map((item) => item.end))) + 1;
    // Every ruler uses the same whole-unit scale with half-unit ticks.
    figure = {
      kind: "scene",
      scene: scene(
        ...readings.map((item, i) => ({
          type: "ruler" as const,
          id: `measurement-${i + 1}`,
          unit,
          length: rulerLength,
          parts: 2 as const,
          at: [0, (-i * 120) / ((360 - 8) / (rulerLength + 1.2))] as [
            number,
            number,
          ],
          object: {
            label: `${object} ${i + 1}`,
            from: item.start * 2,
            to: item.end * 2,
          },
        })),
      ).build({
        width: 360,
        maxHeight: 720,
        title: `${n} ${objects} on rulers marked in ${many}`,
        note: readings
          .map(
            (item, i) =>
              `${object} ${i + 1} has its start at ${item.start} and its end at ${item.end}.`,
          )
          .join(" "),
      }),
    };
    prompt = `Measure these ${n} ${objects} to the nearest ${one}. Then show the measurements on the line plot.`;
    readings.forEach((item, i) => {
      const nearest = Math.round(item.end),
        floor = Math.floor(item.end);
      measuring.push(
        `${object[0]!.toUpperCase() + object.slice(1)} ${i + 1} has its start at ${item.start}. ${item.end === floor ? `Its end is at ${nearest}.` : `Its end is between ${floor} and ${floor + 1}, closer to ${nearest}.`} Count from ${item.start}: $${nearest} - ${item.start} = ${values[i]}$ ${values[i] === 1 ? one : many}.`,
      );
    });
  } else if (family === "given-table") {
    prompt = `These ${n} ${objects} were measured to the nearest ${one}. Show the measurements on the line plot. Put one X for each ${object}.`;
    figure = {
      kind: "scene",
      scene: scene(
        lineTable(
          [
            ["Object", `Length (${unit})`],
            ...values.map((v, i) => [`${colors[i]} ${object}`, String(v)]),
          ],
          { id: "measurements", header: "row" },
        ),
      ).build({ width: 360 }),
    };
  } else if (family === "given-repeated") {
    prompt = `The same ${object} was measured ${n} times to the nearest ${one}: ${values.join(", ")} ${many}. Show all ${n} measurements on the line plot.`;
  } else {
    prompt = `${n} ${objects} were measured to the nearest ${one}: ${values.join(", ")} ${many}. Show the measurements on the line plot. Put one X for each ${object}.`;
  }
  const empty = range(min, max).filter((v) => !counts[v]);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([meta.id, 1, seed]))
        .digest("hex"),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      skillId: meta.skillId,
      prompt,
      response,
      ...(figure ? { figure } : {}),
    },
    answer: normalizeLinePlotBuild(response, JSON.stringify({ counts }))!,
    walkthrough: scene({
      type: "dotPlot",
      id: "completed-plot",
      min,
      max,
      mark: "x",
      groups: [{ values }],
      unit: many,
    }).build({ width: 360 }),
    linePlotContext: { object, ...(readings ? { readings } : {}) },
    hint: `Go through the ${n} measurements one at a time. ${family === "measure-and-plot" ? "Find the nearest end mark, then count units from the object's start. " : ""}For each measurement, tap above its number once. Keep repeated measurements too.`,
    explanation: [
      ...measuring,
      `Tally means count each length: ${Object.entries(counts)
        .map(([v, c]) => `${v} ${many}: ${c}`)
        .join("; ")}.`,
      ...Object.entries(counts).map(
        ([v, c]) => `Put ${c} ${c === 1 ? "X" : "Xs"} above ${v}.`,
      ),
      `Leave ${empty.join(", ")} with no X. They stay on the scale so each step is one ${one}.`,
      `Check: ${n} Xs in all, one per measurement.`,
      ...(family === "given-repeated"
        ? [
            `Measuring the same ${object} can give slightly different numbers because measuring is never perfect. The Xs pile up around ${values.reduce((a, b) => (counts[a]! > counts[b]! ? a : b))} ${many}.`,
          ]
        : []),
    ],
    variant: { id: family, axes: { unit } },
  };
}
