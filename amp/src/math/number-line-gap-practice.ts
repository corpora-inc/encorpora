import type { TemplateMetadata } from "./contracts";
import { numberLine } from "./scene/author";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";

const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const numberLinePositionTemplate: TemplateMetadata = {
  id: "number-line-between-hundreds",
  version: 1,
  ...scenes,
  requiredResponseCapability: "single-choice-v1",
  title: "Which number is the point?",
  skillId: "round-whole-numbers",
  gradeBand: "3–5",
  difficultyOffset: -0.2,
  description:
    "Read the whole number a point names on a number line that runs between two neighboring hundreds or thousands, using the halfway mark and the tick marks.",
};
export const numberLineStoryTemplate: TemplateMetadata = {
  id: "number-line-jump-story",
  version: 1,
  ...scenes,
  requiredResponseCapability: "single-choice-v1",
  title: "Which story matches the jumps?",
  skillId: "number-line-arithmetic",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Match a number line with a jump to the left and a jump to the right from a start to the story that takes away and adds the same amounts in the same order.",
};

type R = (lo: number, hi: number) => number;
const comma = (n: number) => n.toLocaleString("en-US");

/* ----------------------------------------------------------- position */
const positionAxes = {
  range: defineAxis("range", ["hundreds", "thousands"] as const),
};
interface PositionModel {
  range: "hundreds" | "thousands";
  low: number;
  /** Tens above the low end, 1 to 9. */
  tens: number;
  options: number[];
}
export const numberLinePosition = chainFamily({
  template: numberLinePositionTemplate,
  axes: positionAxes,
  model: (r: R, a): PositionModel => {
    const low =
      a.range === "hundreds" ? 100 * r(1, 9) : 1000 * r(1, 8) + 100 * r(0, 9);
    const tens = pick(r, [6, 7, 8, 9, 1, 2, 3, 4]);
    const v = low + 10 * tens;
    const mirror = low + 100 - 10 * tens;
    const next = low + 100 + 10 * tens;
    const digits = low + tens; // the tens digit written as ones
    const options = [v, mirror, next, digits];
    if (new Set(options).size !== 4) throw new Error("Need three retries");
    return { range: a.range, low, tens, options };
  },
  variant: (m) => `${m.range}-${m.tens >= 5 ? "past-half" : "before-half"}`,
  render: (m, _a, r) => {
    const v = m.low + 10 * m.tens;
    const half = m.low + 50;
    const line = numberLine({
      min: m.low,
      max: m.low + 100,
      step: 10,
      labels: [m.low, half, m.low + 100],
    });
    line.mark(v, { label: "P" });
    const [, mirror, next, digits] = m.options as [
      number,
      number,
      number,
      number,
    ];
    const surface = choiceSurface(r, {
      prompt: `The number line runs from ${comma(m.low)} to ${comma(m.low + 100)}, with a tick mark every 10. Which number does point $P$ show?`,
      options: [
        { label: comma(v), correct: true },
        {
          label: comma(mirror),
          feedback: `${comma(mirror)} is the same distance from ${comma(m.low + 100)} that ${comma(v)} is from ${comma(m.low)}. Count the tick marks from ${comma(m.low)} to point $P$, not from the other end.`,
        },
        {
          label: comma(next),
          feedback: `${comma(next)} is past the end of this number line, which stops at ${comma(m.low + 100)}.`,
        },
        {
          label: comma(digits),
          feedback: `Each tick mark is worth 10, so ${m.tens} tick marks above ${comma(m.low)} is ${10 * m.tens} more, not ${m.tens} more.`,
        },
      ],
      hint: `Each tick mark is worth 10, and the labeled halfway mark is ${comma(half)}. Decide whether $P$ is before or after the halfway mark, then count tick marks from ${comma(m.low)}.`,
      explanation: [
        `The line runs from ${comma(m.low)} to ${comma(m.low + 100)} in 10 equal steps of 10. The halfway mark is ${comma(half)}.`,
        `Point $P$ is ${m.tens} ${m.tens === 1 ? "tick mark" : "tick marks"} above ${comma(m.low)}, so it is ${comma(m.low)} + ${m.tens} × 10 = ${comma(v)}.`,
        `That is ${v > half ? "past" : v === half ? "at" : "before"} the halfway mark, as the picture shows.`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: line.scene() },
      }
    );
  },
});

/* -------------------------------------------------------------- story */
const stories = [
  {
    who: "A library",
    thing: "books",
    down: "lends out",
    up: "gets back",
    start: "has",
  },
  {
    who: "A bakery",
    thing: "muffins",
    down: "sells",
    up: "bakes",
    start: "has",
  },
  { who: "Maya", thing: "dollars", down: "spends", up: "earns", start: "has" },
  {
    who: "A school store",
    thing: "pencils",
    down: "sells",
    up: "restocks",
    start: "has",
  },
];
const storyAxes = {
  order: defineAxis("order", ["left-then-right", "right-then-left"] as const),
};
interface StoryModel {
  order: "left-then-right" | "right-then-left";
  story: (typeof stories)[number];
  start: number;
  a: number;
  b: number;
}
export const numberLineStory = chainFamily({
  template: numberLineStoryTemplate,
  axes: storyAxes,
  model: (r: R, ax): StoryModel => {
    const a = r(4, 30);
    const b = r(4, 30);
    if (a === b) throw new Error("Need three retries");
    return {
      order: ax.order,
      story: pick(r, stories),
      start: r(35, 70),
      a,
      b,
    };
  },
  variant: (m) => m.order,
  render: (m, _ax, r) => {
    const { story: s, start, a, b } = m;
    // The first jump and the second jump, each with its direction.
    const first = m.order === "left-then-right" ? -a : b;
    const second = m.order === "left-then-right" ? b : -a;
    const reach = [start, start + first, start + first + second];
    const lo = Math.max(0, Math.floor((Math.min(...reach) - 5) / 10) * 10);
    const hi = Math.ceil((Math.max(...reach) + 5) / 10) * 10;
    const line = numberLine({ min: lo, max: hi, step: 5, labels: "auto" });
    line.mark(start, { label: true });
    line.hop(start, first, { landing: "none" });
    line.then(second, { landing: "none" });
    const pronoun = s.who === "Maya" ? "She" : "It";
    const verb = (kind: "down" | "up") => (kind === "down" ? s.down : s.up);
    const story = (x: ["down" | "up", number], y: ["down" | "up", number]) =>
      `${s.who} ${s.start} ${start} ${s.thing}. ${pronoun} ${verb(x[0])} ${x[1]}, then ${verb(y[0])} ${y[1]} more.`;
    const firstKind = m.order === "left-then-right" ? "down" : "up";
    const secondKind = m.order === "left-then-right" ? "up" : "down";
    const firstN = m.order === "left-then-right" ? a : b;
    const secondN = m.order === "left-then-right" ? b : a;
    const correct = story([firstKind, firstN], [secondKind, secondN]);
    const options = [
      { label: correct, correct: true as const },
      {
        label: story([secondKind, secondN], [firstKind, firstN]),
        feedback:
          "The amounts are right, but the jumps happen in the other order. Follow the jumps from the start: the first jump is the first thing that happens.",
      },
      {
        label: story([firstKind, secondN], [secondKind, firstN]),
        feedback: `This story swaps the amounts. The first jump is ${firstN} long and the second jump is ${secondN} long.`,
      },
      {
        label: story([firstKind, firstN], [firstKind, secondN]),
        feedback: `Both parts of this story go ${firstKind === "down" ? "down" : "up"}, but the jumps on the number line go in opposite directions.`,
      },
    ];
    const surface = choiceSurface(r, {
      prompt: `The number line shows two jumps that start at ${start}. Which story matches the jumps?`,
      options,
      hint: `Start at ${start} and follow the jumps in order. Look at which way the first jump, ${firstN} long, points and which way the second jump, ${secondN} long, points. A jump to the left takes away and a jump to the right adds.`,
      explanation: [
        `The first jump is ${firstN} long and goes ${first < 0 ? "left" : "right"}, so it ${first < 0 ? "takes away" : "adds"} ${firstN}.`,
        `The second jump is ${secondN} long and goes ${second < 0 ? "left" : "right"}, so it ${second < 0 ? "takes away" : "adds"} ${secondN}.`,
        `The story that does these two things in this order is: "${correct}"`,
      ],
    });
    return (
      surface && {
        ...surface,
        figure: { kind: "scene" as const, scene: line.scene() },
      }
    );
  },
});

export const numberLineGapTemplates = [
  numberLinePositionTemplate,
  numberLineStoryTemplate,
] as const;
export const numberLineGapGenerate = dispatch(numberLineGapTemplates, {
  "number-line-between-hundreds": (seed) =>
    numberLinePosition.generate(seed).problem,
  "number-line-jump-story": (seed) => numberLineStory.generate(seed).problem,
});
