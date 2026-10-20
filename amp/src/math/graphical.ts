import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
export const graphicalTemplates: readonly TemplateMetadata[] = [
  {
    id: "coordinate-point-reading",
    version: 1,
    title: "Read a coordinate",
    skillId: "coordinate-four-quadrants",
    gradeBand: "6–8",
    description: "Read one coordinate of a labeled point on a unit grid.",
  },
  {
    id: "graphed-line-slope",
    version: 1,
    title: "Slope from a graph",
    skillId: "slope",
    gradeBand: "6–8",
    description: "Find exact slope from two labeled lattice points.",
  },
  {
    id: "bar-chart-total",
    version: 1,
    title: "Total from a bar chart",
    skillId: "picture-bar-graphs",
    gradeBand: "K–2",
    description: "Add three category counts from a labeled bar chart.",
  },
  {
    id: "bar-chart-difference",
    version: 1,
    title: "Compare chart categories",
    skillId: "picture-bar-graphs",
    gradeBand: "K–2",
    description: "Find how many more items one category contains than another.",
  },
  {
    id: "clock-elapsed-minutes",
    version: 1,
    title: "Elapsed minutes",
    skillId: "elapsed-time",
    gradeBand: "3–5",
    description:
      "Find a duration up to two hours between times on the same morning.",
  },
  {
    id: "number-line-distance",
    version: 1,
    title: "Distance on a number line",
    skillId: "absolute-value",
    gradeBand: "6–8",
    description: "Find the nonnegative distance between two signed integers.",
  },
];
function random(templateId: string, seed: string) {
  let counter = 0;
  return (low: number, high: number) => {
    const range = high - low + 1,
      limit = Math.floor(0x100000000 / range) * range;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % range);
  };
}
function fraction(numerator: number, denominator: number) {
  let a = Math.abs(numerator),
    b = Math.abs(denominator);
  while (b) [a, b] = [b, a % b];
  return denominator / a === 1
    ? `${numerator / a}`
    : `${numerator / a}/${denominator / a}`;
}
const time = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
export function generateGraphicalProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const template = graphicalTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown graphical template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  let figure: SemanticFigure,
    prompt: string,
    answer: string,
    hint: string,
    explanation: string[];
  let responseKind: "number" | "fraction" = "number";
  switch (templateId) {
    case "coordinate-point-reading": {
      const x = r(-4, 4),
        y = r(-4, 4),
        coordinate = r(0, 1) ? "x" : "y";
      figure = {
        kind: "coordinate-plane",
        xMin: -5,
        xMax: 5,
        yMin: -5,
        yMax: 5,
        points: [{ x, y, label: "P" }],
      };
      prompt = `What is the $${coordinate}$-coordinate of point $P$? Each grid step is one unit.`;
      answer = `${coordinate === "x" ? x : y}`;
      hint =
        coordinate === "x"
          ? "For the $x$-coordinate, count grid steps from the vertical axis straight across to $P$: right is positive, left is negative. Ignore how high $P$ is."
          : "For the $y$-coordinate, count grid steps from the horizontal axis straight up or down to $P$: up is positive, down is negative. Ignore how far across $P$ is.";
      explanation = [
        `Point $P$ is at (${x}, ${y}).`,
        `Its $${coordinate}$-coordinate is ${answer}.`,
      ];
      break;
    }
    case "graphed-line-slope": {
      const x1 = r(-4, -1),
        x2 = r(1, 4),
        y1 = r(-4, 4),
        y2 = r(-4, 4);
      const rise = y2 - y1,
        run = x2 - x1,
        m = rise / run;
      figure = {
        kind: "coordinate-plane",
        xMin: -5,
        xMax: 5,
        yMin: -5,
        yMax: 5,
        points: [
          { x: x1, y: y1, label: "A" },
          { x: x2, y: y2, label: "B" },
        ],
        lines: [{ m, b: y1 - m * x1 }],
      };
      prompt =
        "What is the slope of the line through $A$ and $B$? Each grid step is one unit.";
      answer = fraction(rise, run);
      responseKind = "fraction";
      hint = rise
        ? `Count from $A$ to $B$: steps right for the run, then steps ${rise < 0 ? "down for the rise, which is negative because the line falls" : "up for the rise"}. Slope = rise ÷ run.`
        : "$A$ and $B$ are at the same height. Count the rise from $A$ to $B$, then divide it by the run.";
      explanation = [
        `$A = (${x1}, ${y1})$ and $B = (${x2}, ${y2})$.`,
        `The vertical change is ${y2} − (${y1}) = ${rise}; the horizontal change is ${x2} − (${x1}) = ${run}.`,
        `Slope = ${rise}/${run} = ${answer}.`,
      ];
      break;
    }
    case "bar-chart-total":
    case "bar-chart-difference": {
      const values = [r(2, 12), r(2, 12), r(2, 12)],
        categories = ["Oak", "Pine", "Maple"];
      if (templateId === "bar-chart-difference" && values[0] === values[1])
        values[1] = values[0]! + 1;
      figure = { kind: "bar-chart", categories, values, valueLabel: "Trees" };
      if (templateId === "bar-chart-total") {
        prompt =
          "How many trees are shown altogether across the three categories?";
        answer = `${values.reduce((sum, value) => sum + value, 0)}`;
        hint = `Read each bar's top against the Trees scale: Oak is ${values[0]}. Read Pine and Maple the same way, then add all three.`;
        explanation = [
          `Oak: ${values[0]}, Pine: ${values[1]}, Maple: ${values[2]}.`,
          `${values.join(" + ")} = ${answer} trees.`,
        ];
      } else {
        const larger = values[0]! > values[1]! ? 0 : 1,
          smaller = 1 - larger;
        prompt = `How many more ${categories[larger]} trees than ${categories[smaller]} trees are shown?`;
        answer = `${values[larger]! - values[smaller]!}`;
        hint = `Read the ${categories[larger]} bar and the ${categories[smaller]} bar on the scale. Subtract the ${categories[smaller]} count from the ${categories[larger]} count; ignore Maple.`;
        explanation = [
          `There are ${values[larger]} ${categories[larger]} trees and ${values[smaller]} ${categories[smaller]} trees.`,
          `${values[larger]} − ${values[smaller]} = ${answer} trees.`,
        ];
      }
      break;
    }
    case "clock-elapsed-minutes": {
      const hour = r(1, 8),
        minute = 5 * r(0, 11),
        duration = 5 * r(3, 24),
        start = hour * 60 + minute;
      figure = { kind: "clock", hour, minute };
      prompt = `A lesson starts at the time shown on the clock and ends at ${time(start + duration)} later that same morning. How many minutes does it last?`;
      answer = `${duration}`;
      const end = start + duration,
        nextHour = (hour + 1) * 60;
      hint =
        end > nextHour
          ? `Read the start time on the clock. Count on to ${time(nextHour)} first, then on to ${time(end)}.`
          : `Read the start time on the clock. Count on by fives from there to ${time(end)}.`;
      explanation = [
        `The clock shows ${time(start)} in the morning.`,
        `The ending time is ${time(start + duration)} that morning.`,
        `Subtract minute totals: ${start + duration} − ${start} = ${duration} minutes.`,
      ];
      break;
    }
    case "number-line-distance": {
      const left = r(-8, 3),
        right = r(left + 1, 8);
      figure = {
        kind: "number-line",
        min: -10,
        max: 10,
        points: [left, right],
      };
      prompt =
        "What is the distance between the two marked points? Each tick is one unit.";
      answer = `${right - left}`;
      hint =
        left < 0 && right > 0
          ? `The points are on both sides of 0. Count the steps from ${left} to 0, then from 0 to ${right}, and add.`
          : `Count the unit steps from ${left} to ${right}. A distance is never negative.`;
      explanation = [
        `The points are at ${left} and ${right}.`,
        `Distance = |${right} − (${left})| = ${answer} units.`,
      ];
      break;
    }
    default:
      throw new Error(`Missing graphical generator: ${templateId}`);
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, template.version, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt,
      skillId: template.skillId,
      response: {
        kind: responseKind,
        label:
          responseKind === "fraction"
            ? "Answer (fraction, decimal, or whole number)"
            : "Answer",
      },
      figure,
    },
    answer,
    hint,
    explanation,
  };
}
