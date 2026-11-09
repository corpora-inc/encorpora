import { count, isAre, plural } from "./agreement";
import type { GeneratedProblem, SemanticFigure } from "./contracts";
import { scene } from "./scene/author";
import type { Element } from "./scene/spec";
import {
  chooseAxes,
  defineAxis,
  surfaceStream,
  type Random,
} from "./variation/axes";

/** Arrangement and quantity-link surfaces for `count-objects`.
 * Legacy stays a 1–10 dot collection. Scene values need scenes-v1; a client
 * without it is forced back to legacy. Circle and scatter have no scene
 * component, so those families are drawn as ten-frames. */
export const countObjectAxes = {
  family: defineAxis(
    "family",
    [
      "legacy",
      "one-more-arrives",
      "one-leaves",
      "spot-the-miscount",
      "line",
      "array",
      "circle",
      "scatter",
    ] as const,
    {
      legacy: "legacy",
      weights: [6, 3, 2, 2, 3, 3, 3, 3],
      silentLegacy: true,
      since: 2,
      needs: {
        "one-more-arrives": "scenes-v1",
        "one-leaves": "scenes-v1",
        "spot-the-miscount": "scenes-v1",
        line: "scenes-v1",
        array: "scenes-v1",
        circle: "scenes-v1",
        scatter: "scenes-v1",
      },
    },
  ),
} as const;

const NOUNS = ["cup", "dog", "apple", "star", "block", "button"] as const;
const WORD = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

type Built = Pick<
  GeneratedProblem,
  "answer" | "hint" | "explanation" | "variant"
> & {
  prompt: string;
  figure: SemanticFigure;
};

const frame = (
  groups: { count: number; color: "accent" | "warm" | "gold" }[],
): Element => {
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return {
    type: "tenFrame",
    id: "frame",
    frames: total > 10 ? 2 : 1,
    groups: groups.map((group) => ({
      count: group.count,
      shape: "dot",
      color: group.color,
    })),
  };
};

const drawn = (
  elements: Element[],
  title: string,
  width: number,
  maxHeight: number,
): SemanticFigure => ({
  kind: "scene",
  scene: scene(...elements).build({ title, width, maxHeight }),
});

const nounAt = (s: Random) => NOUNS[s(0, NOUNS.length - 1)]!;

function legacy(r: Random): Built {
  const n = r(1, 10);
  return {
    prompt: "How many dots are shown?",
    answer: `${n}`,
    hint:
      n > 5
        ? "The top row has 5 dots. Count them, then keep counting along the bottom row without starting again."
        : "Start at the left dot and say one number for each dot as you touch it.",
    explanation: [
      "Touch each dot once and say one number for it, so no dot is missed or counted twice.",
      `Count: ${Array.from({ length: n }, (_, i) => i + 1).join(", ")}.`,
      `The last number you say tells how many, so there are ${n} dots.`,
    ],
    figure: { kind: "collection", count: n },
  };
}

function oneMore(templateId: string, seed: string, leaves: boolean): Built {
  const s = surfaceStream(templateId, `${seed}:${leaves ? "leaves" : "arrives"}`);
  const noun = nounAt(s);
  const n = leaves
    ? s(2, 20)
    : s(1, 5) === 1
      ? s(0, 1) === 0
        ? 9
        : 19
      : s(1, 19);
  const answer = leaves ? n - 1 : n + 1;
  const many = plural(noun);
  const prompt = leaves
    ? `There ${isAre(n)} ${count(n, noun)}. One ${noun} leaves. How many ${many} now?`
    : `There ${isAre(n)} ${count(n, noun)}. One more ${noun} comes. How many ${many} now?`;
  const groups = leaves
    ? [
        { count: n - 1, color: "accent" as const },
        { count: 1, color: "warm" as const },
      ]
    : [
        { count: n, color: "accent" as const },
        { count: 1, color: "gold" as const },
      ];
  const decade = !leaves && (n === 9 || n === 19);
  const hint = leaves
    ? `Start from ${n}. One ${noun} leaves, so say the counting word just before ${n}.`
    : decade
      ? `${n} ends in 9, so the next word starts a new ten. Count on one from ${n}. Do not stick a 1 onto ${n}.`
      : `Start from ${n}. One more ${noun} means the next counting word. Do not start over.`;
  const copied = leaves ? n : n;
  const twice = leaves ? n - 2 : n + 2;
  const other = leaves ? n + 1 : n - 1;
  const explanation = leaves
    ? [
        `There ${isAre(n)} ${count(n, noun)}. One ${noun} leaves.`,
        `The word just before ${n} is ${WORD[answer]}. We do not keep the old count.`,
        `Saying ${copied} copies the number you started with. The ${noun} that left is still being counted.`,
        twice >= 1
          ? `Saying ${twice} takes away two, not one.`
          : `The count cannot fall below 1.`,
        `Saying ${other} adds a ${noun} instead of taking one away.`,
        `Count the ${many} that are still here. There ${isAre(answer)} ${count(answer, noun)}.`,
      ]
    : [
        `There ${isAre(n)} ${count(n, noun)}. One more ${noun} comes.`,
        `The next word after ${n} is ${WORD[answer]}. We do not start over.`,
        `Saying ${copied} leaves the new ${noun} out.`,
        `Saying ${twice} counts the new ${noun} twice.`,
        decade
          ? `Saying ${n} copies the old count. Saying ${answer === 10 ? 11 : 21} skips ahead. The next word is one more, not ${n} with a 1 stuck on.`
          : `Saying ${other} takes a ${noun} away. This ${noun} is arriving, not leaving.`,
        `Count every ${noun}, including the new one. There ${isAre(answer)} ${count(answer, noun)}.`,
      ];
  return {
    prompt,
    answer: `${answer}`,
    hint,
    explanation,
    figure: drawn(
      [
        frame(groups),
        {
          type: "text",
          id: "caption",
          at: [0, 1],
          text: `${n} ${WORD[n]}`,
          font: "sans",
          size: "md",
        },
      ],
      leaves
        ? `${count(n, noun)}, and one ${noun} leaving`
        : `${count(n, noun)}, and one more ${noun} arriving`,
      280,
      n + (leaves ? 0 : 1) > 10 ? 340 : 220,
    ),
    variant: {
      id: leaves ? "one-leaves" : "one-more-arrives",
      axes: { family: leaves ? "one-leaves" : "one-more-arrives" },
    },
  };
}

function miscount(templateId: string, seed: string): Built {
  const s = surfaceStream(templateId, `${seed}:miscount`);
  const noun = nounAt(s);
  const n = s(6, 10);
  const right = s(1, 4) === 1;
  const many = plural(noun);
  let labels: number[];
  let kind: "right" | "skip" | "double";
  if (right) {
    labels = Array.from({ length: n }, (_, i) => i + 1);
    kind = "right";
  } else if (s(0, 1) === 0) {
    const at = s(1, n - 2);
    labels = Array.from({ length: n }, (_, i) => (i < at ? i + 1 : i + 2));
    kind = "skip";
  } else {
    const at = s(1, n - 3);
    labels = Array.from({ length: n }, (_, i) => (i <= at ? i + 1 : i));
    kind = "double";
  }
  const shown = labels.join(", ");
  const hint = `Touch each ${noun} once and give it one number, in order. Check Ana's labels for a skip or a number used twice.`;
  const explanation =
    kind === "right"
      ? [
          `Ana's labels are ${shown}. Each ${noun} has the next number.`,
          `No ${noun} is skipped, and no ${noun} has two numbers.`,
          `The count is right. The last number, ${n}, is how many ${many} there are.`,
        ]
      : kind === "skip"
        ? [
            `The labels are ${shown}. One number is missing in the list, so one ${noun} was skipped.`,
            `The skip is not the first ${noun} and not the last ${noun}.`,
            `Touch each ${noun} with one word. The last ${noun} gets the word ${WORD[n]}.`,
            `There ${isAre(n)} ${count(n, noun)}. Ana's last label is not the count.`,
          ]
        : [
            `The labels are ${shown}. One number is used twice, so one ${noun} was given two names.`,
            `That pair is not the first ${noun} and not the last ${noun}.`,
            `Touch each ${noun} with one new word. The last ${noun} gets the word ${WORD[n]}.`,
            `There ${isAre(n)} ${count(n, noun)}.`,
          ];
  return {
    prompt: `Ana counted the ${many}. Her labels are ${shown}. How many ${many} are shown?`,
    answer: `${n}`,
    hint,
    explanation,
    figure: drawn(
      [
        {
          type: "array",
          id: "row",
          rows: 1,
          columns: n,
          shape: "dot",
        },
        {
          type: "text",
          id: "labels",
          at: [n / 2, -0.6],
          text: shown,
          font: "sans",
          size: "sm",
          align: [0, 1],
        },
      ],
      `A row of ${many} with Ana's count labels`,
      Math.min(720, Math.max(180, 36 * n + 48)),
      180,
    ),
    variant: { id: "spot-the-miscount", axes: { family: "spot-the-miscount" } },
  };
}

function arrangement(
  templateId: string,
  seed: string,
  layout: "line" | "array" | "circle" | "scatter",
): Built {
  const s = surfaceStream(templateId, `${seed}:${layout}`);
  const noun = nounAt(s);
  const many = plural(noun);
  let rows = 1;
  let columns = 1;
  let elements: Element[];
  let title: string;
  if (layout === "line") {
    columns = s(1, 12) === 1 ? 20 : s(1, 20);
    elements = [
      { type: "array", id: "row", rows: 1, columns, shape: "dot" },
    ];
    title = `A line of ${many}`;
  } else if (layout === "array") {
    const pairs: [number, number][] = [];
    for (let r = 1; r <= 4; r++)
      for (let c = 2; c <= 5; c++) if (r * c <= 20) pairs.push([r, c]);
    const pair = s(1, 8) === 1 ? [4, 5] : pairs[s(0, pairs.length - 1)]!;
    rows = pair[0]!;
    columns = pair[1]!;
    elements = [
      {
        type: "array",
        id: "grid",
        rows,
        columns,
        shape: s(0, 1) === 0 ? "dot" : "square",
      },
    ];
    title = `A rectangular array of ${many}`;
  } else {
    const n = layout === "scatter" ? s(1, 10) : s(1, 12) === 1 ? 20 : s(1, 20);
    columns = n;
    elements = [frame([{ count: n, color: "accent" }])];
    title = `A ten-frame of ${many}`;
  }
  const n = layout === "line" || layout === "array" ? rows * columns : columns;
  const reversal = n >= 13 ? Number(`${n % 10}${Math.floor(n / 10)}`) : n - 1;
  const shapeRead =
    layout === "array" ? rows + columns : layout === "line" ? 1 : n - 1;
  const hint = `Touch each ${noun} once, in order. The last number you say is how many. Do not count rows instead of ${many}.`;
  const explanation = [
    layout === "array"
      ? `The array has ${rows} ${rows === 1 ? "row" : "rows"} of ${columns}. Count one row, then keep going.`
      : layout === "line"
        ? `The ${many} are in one line. Touch each ${noun} once from the left.`
        : layout === "circle"
          ? `The ${many} are in a ten-frame. Count each counter once, and do not count the first one twice.`
          : `The ${many} are in a ten-frame. Count each counter once.`,
    `Saying ${n - 1} skips a ${noun}. Saying ${n + 1} counts one ${noun} twice.`,
    layout === "array"
      ? `Adding the rows and columns gives ${shapeRead}. That reads the shape, not the ${many}.`
      : `The shape of the group does not change how many there are.`,
    n >= 13
      ? `${n} is not ${reversal}. The digits do not trade places.`
      : `Check by counting from the other end. You still end on ${n}.`,
    `The last number is ${n}. There ${isAre(n)} ${count(n, noun)}.`,
  ];
  return {
    prompt: `How many ${many} are shown?`,
    answer: `${n}`,
    hint,
    explanation,
    figure: drawn(
      elements,
      title,
      layout === "line" || layout === "array"
        ? Math.min(720, Math.max(180, 36 * columns + 48))
        : 280,
      layout === "circle" || layout === "scatter"
        ? n > 10
          ? 340
          : 220
        : 200,
    ),
    variant: { id: layout, axes: { family: layout } },
  };
}

export function buildCountObjects(
  templateId: string,
  seed: string,
  r: Random,
): Built {
  const family = chooseAxes(templateId, seed, countObjectAxes).family;
  if (family === "legacy") return legacy(r);
  if (family === "one-more-arrives") return oneMore(templateId, seed, false);
  if (family === "one-leaves") return oneMore(templateId, seed, true);
  if (family === "spot-the-miscount") return miscount(templateId, seed);
  return arrangement(templateId, seed, family);
}
