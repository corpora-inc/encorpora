import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { clauseFamily } from "./clause-family.js";
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
    version: 2,
    reprintsFrom: 1,
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
    version: 2,
    reprintsFrom: 1,
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
const PETS = ["dog", "cat", "fish", "bird"] as const;

function clauseGraphical(
  templateId: string,
  seed: string,
  family: string,
  r: ReturnType<typeof random>,
): GeneratedProblem {
  const template = graphicalTemplates.find((t) => t.id === templateId)!;
  const base = {
    templateId,
    templateVersion: 1 as const,
    seed,
    skillId: template.skillId,
  };
  if (family === "missing-bar") {
    const n = r(3, 4);
    const names = PETS.slice(0, n);
    const counts = names.map(() => r(1, 5));
    const missing = r(0, n - 1);
    const drawn = names
      .map((name, i) => ({ name, count: counts[i]! }))
      .filter((_, i) => i !== missing);
    const total = counts.reduce((a, b) => a + b, 0);
    const answer = counts[missing]!;
    return {
      public: {
        ...base,
        id: "",
        prompt: `The bar graph shows the pets of ${total} students. Each student has one pet. The bar for ${names[missing]} is not drawn yet. How many students have ${names[missing]}?`,
        response: { kind: "number", label: "Answer" },
        figure: {
          kind: "bar-chart",
          categories: drawn.map((d) => d.name),
          values: drawn.map((d) => d.count),
          valueLabel: "Pets",
        },
      },
      answer: String(answer),
      hint: `Add the bars that are drawn. The total is ${total} students, so the missing bar is what is left.`,
      explanation: [
        `The drawn bars are ${drawn.map((d) => `${d.name} ${d.count}`).join(", ")}.`,
        `Their sum is ${drawn.map((d) => d.count).join(" + ")} = ${total - answer}.`,
        `${total} − ${total - answer} = ${answer}. The ${names[missing]} bar is ${answer}.`,
        `Check: ${counts.join(" + ")} = ${total}.`,
      ],
    };
  }
  if (family === "two-clocks") {
    const sh0 = r(7, 10);
    const sm0 = r(0, 1) === 0 ? r(0, 59) : 5 * r(0, 11);
    const start = sh0 * 60 + sm0;
    const bridge = sm0 === 0 ? 60 : 60 - sm0;
    const room = 12 * 60 - start - 1;
    const duration = Math.min(r(5, 110), bridge + 59, Math.max(5, room));
    const end = start + duration;
    const sh = Math.floor(start / 60);
    const sm = start % 60;
    const eh = Math.floor(end / 60);
    const em = end % 60;
    return {
      public: {
        ...base,
        id: "",
        prompt: `Reading club starts at the time on the clock, ${time(start)}, and ends at ${time(end)} the same morning. How many minutes does it last?`,
        response: { kind: "number", label: "Minutes" },
        figure: { kind: "clock", hour: sh, minute: sm },
      },
      answer: String(duration),
      hint: `Read the start, ${time(start)}. Count up to ${time(end)}.`,
      explanation: [
        `The clock shows ${time(start)}. The club ends at ${time(end)}.`,
        eh > sh
          ? `From ${time(start)} up to ${sh + 1}:00 is ${60 - sm} minutes, then ${duration - (60 - sm)} more. ${60 - sm} + ${duration - (60 - sm)} = ${duration}.`
          : `Both times are in the ${sh} o'clock hour: ${em} − ${sm} = ${duration}.`,
        `The club lasts ${duration} minutes.`,
      ],
    };
  }
  if (family === "add-intervals") {
    const parts = [r(10, 50), r(10, 50)];
    if (r(0, 1) === 0) parts.push(r(10, 40));
    while (parts.reduce((a, b) => a + b, 0) > 150) parts[0] = Math.max(10, parts[0]! - 5);
    const clipped = parts;
    const sum = clipped.reduce((a, b) => a + b, 0);
    return {
      public: {
        ...base,
        id: "",
        prompt: `Jo walks to the pool in ${clipped[0]} minutes, swims for ${clipped[1]} minutes${clipped[2] ? ` and walks home in ${clipped[2]} minutes` : ""}. How many minutes does the whole trip take?`,
        response: { kind: "number", label: "Minutes" },
        figure: { kind: "number-line", min: 0, max: 180, points: [0] },
      },
      answer: String(sum),
      hint: `Add the parts of the trip: ${clipped.join(" minutes, then ")} minutes. Each part is a hop on a minute line.`,
      explanation: [
        `Add the intervals: ${clipped.join(" + ")} = ${sum}.`,
        sum >= 60
          ? `${sum} minutes is ${Math.floor(sum / 60)} hour and ${sum % 60} minutes, because 60 minutes make an hour.`
          : `${sum} minutes is less than one hour.`,
      ],
    };
  }
  const whole = r(30, 120);
  const part = r(5, whole - 5);
  const left = whole - part;
  const shape = r(0, 2);
  const prompt =
    shape === 0
      ? `Band practice lasts ${whole} minutes. The band spends ${part} minutes on scales and the rest on songs. How many minutes on songs?`
      : shape === 1
        ? `A ${whole}-minute class has used ${part} minutes. How many minutes are left?`
        : `Lunch is ${Math.max(whole, part)} minutes and recess is ${Math.min(whole, part)} minutes. How many minutes longer is the longer one?`;
  const answer =
    shape === 2 ? Math.abs(whole - part) : left;
  const big = Math.max(whole, part);
  const small = Math.min(whole, part);
  return {
    public: {
      ...base,
      id: "",
      prompt,
      response: { kind: "number", label: "Minutes" },
      figure: { kind: "number-line", min: 0, max: 180, points: [0] },
    },
    answer: String(shape === 2 ? big - small : left),
    hint:
      shape === 2
        ? `Compare ${big} minutes with ${small} minutes. A comparison is the larger time minus the smaller.`
        : `The whole time is ${whole} minutes and the known part is ${part} minutes. The whole time minus the known part is what is left.`,
    explanation: [
      shape === 2
        ? `The longer time minus the shorter time: ${big} − ${small} = ${big - small}.`
        : `The whole is ${whole} and the known part is ${part}. ${whole} − ${part} = ${left}.`,
      "The difference is never negative: subtract the smaller amount from the larger one.",
    ],
  };
}

export function generateGraphicalProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const template = graphicalTemplates.find((t) => t.id === templateId);
  if (!template) throw new Error(`Unknown graphical template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const family =
    templateId === "bar-chart-total" || templateId === "clock-elapsed-minutes"
      ? clauseFamily(
          templateId,
          seed,
          2,
          templateId === "bar-chart-total"
            ? [
                { id: "legacy", weight: 2 },
                { id: "missing-bar", weight: 2 },
              ]
            : [
                { id: "legacy", weight: 3 },
                { id: "two-clocks", weight: 2 },
                { id: "add-intervals", weight: 2 },
                { id: "subtract-intervals", weight: 2 },
              ],
          "legacy",
        )
      : "legacy";
  const r =
    family === "legacy" ? random(templateId, seed) : random(`${templateId}#${family}`, seed);
  if (family !== "legacy") {
    const built = clauseGraphical(templateId, seed, family, r);
    // The public contract accepts only templateVersion 1. The id still
    // includes 2, the catalog version that introduced this clause, so it
    // does not share an id with the version-1 problem of the same seed.
    built.public.id = createHash("sha256")
      .update(JSON.stringify([templateId, 2, seed]))
      .digest("hex");
    return built;
  }
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
        `A point's coordinates are two numbers $(x, y)$: how far across from the vertical axis, then how far up or down from the horizontal axis.`,
        coordinate === "x"
          ? `Count across from the vertical axis to $P$: ${x === 0 ? "it is on the axis, so 0 steps" : `${Math.abs(x)} ${Math.abs(x) === 1 ? "step" : "steps"} ${x > 0 ? "right, so positive" : "left, so negative"}`}.`
          : `Count up or down from the horizontal axis to $P$: ${y === 0 ? "it is on the axis, so 0 steps" : `${Math.abs(y)} ${Math.abs(y) === 1 ? "step" : "steps"} ${y > 0 ? "up, so positive" : "down, so negative"}`}.`,
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
        `Slope measures steepness: how far the line goes up (the rise) for each step it goes right (the run).`,
        `Read the points from the grid: $A = (${x1}, ${y1})$ and $B = (${x2}, ${y2})$.`,
        `Rise, the change in height from $A$ to $B$: ${y2} − (${y1}) = ${rise}.${rise < 0 ? " It is negative because the line goes down." : ""}`,
        `Run, the change across from $A$ to $B$: ${x2} − (${x1}) = ${run}.`,
        `Slope = rise ÷ run = ${rise}/${run}${answer === `${rise}/${run}` ? "" : ` = ${answer}`}. The slope is ${answer}.`,
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
          `Read each bar where its top meets the scale, the numbers up the side.`,
          `Oak: ${values[0]}, Pine: ${values[1]}, Maple: ${values[2]}.`,
          `"Altogether" means add all three: ${values.join(" + ")} = ${answer}.`,
          `${answer} trees are shown altogether.`,
        ];
      } else {
        const larger = values[0]! > values[1]! ? 0 : 1,
          smaller = 1 - larger;
        prompt = `How many more ${categories[larger]} trees than ${categories[smaller]} trees are shown?`;
        answer = `${values[larger]! - values[smaller]!}`;
        hint = `Read the ${categories[larger]} bar and the ${categories[smaller]} bar on the scale. Subtract the ${categories[smaller]} count from the ${categories[larger]} count; ignore Maple.`;
        explanation = [
          `Read each bar where its top meets the scale, the numbers up the side.`,
          `There are ${values[larger]} ${categories[larger]} trees and ${values[smaller]} ${categories[smaller]} trees.`,
          `"How many more" asks for the difference, so subtract: ${values[larger]} − ${values[smaller]} = ${answer}.`,
          `There ${answer === "1" ? "is 1 more" : `are ${answer} more`} ${categories[larger]} ${answer === "1" ? "tree" : "trees"} than ${categories[smaller]} trees.`,
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
        `Elapsed time is how much time passes from the start to the end.`,
        `The short hand shows the hour and the long hand the minutes: the clock shows ${time(start)}. The lesson ends at ${time(end)}.`,
        end > nextHour
          ? `Count on in two jumps. From ${time(start)} to ${time(nextHour)} is ${nextHour - start} minutes; from ${time(nextHour)} to ${time(end)} is ${end - nextHour} minutes.`
          : `Count on by fives from ${time(start)} to ${time(end)}: that is ${duration} minutes.`,
        ...(end > nextHour
          ? [
              `Add the jumps: ${nextHour - start} + ${end - nextHour} = ${duration}.`,
            ]
          : []),
        `The lesson lasts ${duration} minutes.`,
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
        `Distance is how many unit steps lie between two points. It is never negative.`,
        `The points are at ${left} and ${right}.`,
        left < 0 && right > 0
          ? `They are on opposite sides of 0: ${-left} ${-left === 1 ? "step" : "steps"} from ${left} to 0, and ${right} ${right === 1 ? "step" : "steps"} from 0 to ${right}. Together, ${-left} + ${right} = ${answer}.`
          : `Subtract the smaller from the larger: ${right} − (${left}) = ${answer}.`,
        `The distance is ${answer} units.`,
      ];
      break;
    }
    default:
      throw new Error(`Missing graphical generator: ${templateId}`);
  }
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
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
