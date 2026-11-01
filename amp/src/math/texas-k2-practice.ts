import type { SemanticFigure, TemplateMetadata } from "./contracts";
import {
  assemble,
  random,
  type Draft,
  type Random,
} from "./distribution-practice";
import { fractionBar, numberLine, scene } from "./scene/author";
import type { Element, PathOp } from "./scene/spec";
import { place, type Pt, type Solid } from "./shape-figures";
import {
  sweepChoose,
  sweepVariant,
  type SweepAxes,
} from "./number-domain-axes";

/**
 * Round-2 problem types for Texas kindergarten to grade 2 requirements that
 * the existing practice does not assess. Each template is new and attached to
 * an existing skill; no existing template changes.
 */
const choice = { requiredResponseCapability: "single-choice-v1" } as const;
const scenes = { requiredFigureCapability: "scenes-v1" } as const;
export const texasK2Templates: readonly TemplateMetadata[] = [
  {
    id: "coin-name-and-cent-value",
    version: 1,
    title: "Name a coin and write its value",
    skillId: "money-values",
    gradeBand: "K–2",
    difficultyOffset: -0.5,
    ...choice,
    description:
      "Name a penny, nickel, dime or quarter from its picture, find the picture of a named coin, and write a coin's value with the cent symbol.",
  },
  {
    id: "solid-bottom-face-shape",
    version: 1,
    title: "The flat face at the bottom of a solid",
    skillId: "polygon-properties",
    gradeBand: "K–2",
    difficultyOffset: -0.3,
    ...choice,
    ...scenes,
    description:
      "Name the flat shape of the face a solid stands on: a cube, a box, a prism, a pyramid, a cylinder or a cone.",
  },
  {
    id: "measurable-attribute-choice",
    version: 1,
    title: "Choose the attribute to measure",
    skillId: "compare-attributes",
    gradeBand: "K–2",
    difficultyOffset: -0.4,
    ...choice,
    description:
      "Name the attribute (length, capacity or weight) that a question or a goal asks you to measure, and pick the question that asks about a given attribute.",
  },
  {
    id: "dot-group-compared-to-number",
    version: 1,
    title: "Find the group with more, fewer or the same",
    skillId: "compare-small-groups",
    gradeBand: "K–2",
    difficultyOffset: -0.2,
    ...choice,
    ...scenes,
    description:
      "Choose the group of dots that has more than, fewer than or the same number as a given number or group, with counts up to 20.",
  },
  {
    id: "story-sentence-match-20",
    version: 1,
    title: "Match a story and a number sentence within 20",
    skillId: "addition-stories",
    gradeBand: "K–2",
    difficultyOffset: 0.1,
    ...choice,
    description:
      "Choose the number sentence that matches a joining, separating, comparing or missing-part story within 20, and the story that matches a number sentence.",
  },
  {
    id: "story-sentence-match-1000",
    version: 1,
    title: "Match a story and a number sentence within 1,000",
    skillId: "two-step-stories",
    gradeBand: "K–2",
    difficultyOffset: -0.1,
    ...choice,
    description:
      "Choose the number sentence that matches a one-step addition or subtraction story within 1,000, and the story that matches a number sentence.",
  },
  {
    id: "open-number-line-to-120",
    version: 1,
    title: "Place and read numbers on an open number line to 120",
    skillId: "compare-two-digit",
    gradeBand: "K–2",
    difficultyOffset: 0.15,
    ...choice,
    ...scenes,
    description:
      "Find the point at a given whole number and read the whole number at a marked point on a number line labeled at only three numbers, up to 120.",
  },
  {
    id: "open-number-line-to-1000",
    version: 1,
    title: "Place and read numbers on an open number line to 1,000",
    skillId: "hundreds-place-value",
    gradeBand: "K–2",
    difficultyOffset: 0.15,
    ...choice,
    ...scenes,
    description:
      "Find the point at a given whole number and read the whole number at a marked point on a number line labeled at only three numbers, up to 1,000.",
  },
  {
    id: "eighths-and-parts-beyond-one",
    version: 1,
    title: "Eighths and counting parts beyond one whole",
    skillId: "thirds-and-partitions",
    gradeBand: "K–2",
    difficultyOffset: 0.3,
    ...choice,
    ...scenes,
    description:
      "Name shaded eighths, find how many equal parts make one whole, and describe shaded parts that run past one whole as wholes and parts.",
  },
  {
    id: "decompose-flat-shape",
    version: 1,
    title: "Name the parts of a cut shape",
    skillId: "compose-shapes",
    gradeBand: "K–2",
    difficultyOffset: 0.1,
    ...choice,
    description:
      "Say how many parts a square or rectangle is cut into and name the shape of the parts.",
  },
  {
    id: "unit-size-and-count",
    version: 1,
    title: "Unit size and the number of units",
    skillId: "measure-equal-units",
    gradeBand: "K–2",
    difficultyOffset: 0.2,
    ...choice,
    ...scenes,
    description:
      "Measure the same length with a shorter and a longer unit: choose which needs fewer copies, find the count for the longer unit, and explain why a shorter unit needs more.",
  },
  {
    id: "benchmark-length-estimate",
    version: 1,
    title: "Estimate a length from a benchmark",
    skillId: "ruler-measurement",
    gradeBand: "K–2",
    difficultyOffset: 0.15,
    ...choice,
    description:
      "Estimate a length by repeating a known benchmark length, and choose the reasonable estimate for the length of a familiar object.",
  },
  {
    id: "clock-minute-match",
    version: 1,
    title: "Clocks to the minute",
    skillId: "clock-five-minutes",
    gradeBand: "K–2",
    difficultyOffset: 0.35,
    ...choice,
    description:
      "Read an analog clock to the minute and match it with a digital time, in either direction, and count the minutes after the hour.",
  },
  {
    id: "tally-and-t-chart",
    version: 1,
    title: "Tally charts and T-charts",
    skillId: "categorical-data",
    gradeBand: "K–2",
    difficultyOffset: -0.1,
    ...choice,
    ...scenes,
    description:
      "Read a tally chart to find a count, a difference or a total, and choose the T-chart that organizes a list of answers.",
  },
  {
    id: "early-money-decisions",
    version: 1,
    title: "Income, saving and making things",
    skillId: "money-values",
    gradeBand: "K–2",
    difficultyOffset: 0.2,
    ...choice,
    description:
      "Tell income from a gift, spending from saving, a deposit from a withdrawal and a producer from a consumer, and find savings over time, a bank balance and the cost to make one item.",
  },
];

type Wrong = { label: string; feedback: string };
type Built = Draft & { variant: string };

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;
function shuffled<T>(r: Random, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r(0, i);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
function choicesFrom(r: Random, correct: string, wrongs: Wrong[], count = 3) {
  const seen = new Set([correct]);
  const pool = wrongs.filter((w) => {
    if (seen.has(w.label)) return false;
    seen.add(w.label);
    return true;
  });
  if (pool.length < count) throw new Error("Need three distinct wrong choices");
  const chosen: Wrong[] = [];
  while (chosen.length < count)
    chosen.push(pool.splice(r(0, pool.length - 1), 1)[0]!);
  return [{ label: correct, correct: true as const }, ...chosen];
}
const count = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);
const NAMES = ["Mia", "Sam", "Ana", "Ben", "Dee", "Leo", "Kim", "Noor"];
const twoNames = (r: Random): [string, string] => {
  const a = pick(r, NAMES);
  return [
    a,
    pick(
      r,
      NAMES.filter((n) => n !== a),
    ),
  ];
};
const dollars = (n: number) => `$${n}`;
const clockText = (h: number, m: number) =>
  `${h}:${String(m).padStart(2, "0")}`;

/* ---------------------------------------------------------------------- */
/* coin-name-and-cent-value                                                */
/* ---------------------------------------------------------------------- */

const COINS = ["penny", "nickel", "dime", "quarter"] as const;
type Coin = (typeof COINS)[number];
const COIN_CENTS: Record<Coin, number> = {
  penny: 1,
  nickel: 5,
  dime: 10,
  quarter: 25,
};
const CENT_WORDS: Record<Coin, string> = {
  penny: "one cent",
  nickel: "five cents",
  dime: "ten cents",
  quarter: "twenty-five cents",
};
const coinSet = (...items: Coin[]): SemanticFigure => ({
  kind: "money-sets",
  sets: items.map((item, i) => ({
    items: [item],
    ...(items.length > 1 ? { label: "ABC"[i] as "A" | "B" | "C" } : {}),
  })),
});

/** The features-only surface: coins drawn without values (scenes-v2), known
 * by size, color and edge. Letters only when there are several. */
const drawnCoins = (...items: Coin[]): SemanticFigure => ({
  kind: "scene",
  scene: {
    v: 1,
    elements: [
      {
        type: "coins",
        id: "coins",
        coins: items.map((coin, i) => ({
          coin,
          ...(items.length > 1 ? { label: "ABC"[i] as "A" | "B" | "C" } : {}),
        })),
      },
    ],
  },
});
/** What a coin looks like: the features that name it without its value. */
const COIN_LOOKS: Record<Coin, string> = {
  penny: "copper with a smooth edge",
  nickel: "silver, bigger than a dime, with a smooth edge",
  dime: "silver, the smallest coin, with a ridged edge",
  quarter: "silver, the largest coin, with a ridged edge",
};
const COIN_TELLS: Record<Coin, string> = {
  penny: "it is the only copper coin",
  nickel: "it is silver with a smooth edge",
  dime: "it is the smallest coin, silver with a ridged edge",
  quarter: "it is the largest coin, silver with a ridged edge",
};
/** Why a coin is not another: the first feature that differs. */
function notCoin(seen: Coin, named: Coin): string {
  if (seen === "penny") return `A ${named} is silver; this coin is copper.`;
  if (named === "penny") return "A penny is copper; this coin is silver.";
  if ((seen === "nickel") !== (named === "nickel"))
    return seen === "nickel"
      ? `A ${named} has a ridged edge; this coin's edge is smooth.`
      : "A nickel has a smooth edge; this coin's edge is ridged.";
  return seen === "dime"
    ? "A quarter is the largest coin; this ridged coin is the smallest."
    : "A dime is the smallest coin; this ridged coin is the largest.";
}

function coinNameAndValue(
  r: Random,
  axes: SweepAxes<"coin-name-and-cent-value">,
): Built {
  const drawn = axes.picture === "features-only";
  const variant = (
    [
      "name-coin",
      "picture-of-coin",
      "write-cents-picture",
      "write-cents-name",
    ] as const
  )[r(0, 3)];
  const coin = pick(r, COINS);
  const v = COIN_CENTS[coin];
  if (variant === "name-coin" && drawn)
    return {
      variant,
      prompt: "What is the name of this coin?",
      figure: drawnCoins(coin),
      answer: "",
      hint: "Look at three things: the coin's color (copper or silver), its size (small or large) and its edge (smooth or ridged). Then match those features to the coin you know.",
      explanation: [
        `This coin is ${COIN_LOOKS[coin]}.`,
        `It is a ${coin}: ${COIN_TELLS[coin]}.`,
      ],
      choices: choicesFrom(
        r,
        coin,
        COINS.filter((c) => c !== coin).map((c) => ({
          label: c,
          feedback: notCoin(coin, c),
        })),
      ),
    };
  if (variant === "name-coin")
    return {
      variant,
      prompt: "What is the name of this coin?",
      figure: coinSet(coin),
      answer: "",
      hint: "Read the number of cents written on the coin. The four coin values, from least to greatest, are 1¢, 5¢, 10¢ and 25¢. Match the value to the name you know.",
      explanation: [
        `The coin shows ${v}¢.`,
        `The coin worth ${v}¢ is called a ${coin}.`,
      ],
      choices: choicesFrom(
        r,
        coin,
        COINS.filter((c) => c !== coin).map((c) => ({
          label: c,
          feedback: `A ${c} is worth ${COIN_CENTS[c]}¢. This coin is worth ${v}¢.`,
        })),
      ),
    };
  if (variant === "picture-of-coin") {
    const others = shuffled(
      r,
      COINS.filter((c) => c !== coin),
    ).slice(0, 2);
    const order = shuffled(r, [coin, ...others]);
    const letters = ["A", "B", "C"];
    if (drawn)
      return {
        variant,
        prompt: `Which picture shows a ${coin}?`,
        figure: drawnCoins(...order),
        answer: "",
        hint: `Compare the coins' color, size and edge. A ${coin} is ${COIN_LOOKS[coin]}.`,
        explanation: [
          `A ${coin} is ${COIN_LOOKS[coin]}.`,
          `Coin $${letters[order.indexOf(coin)]}$ is the ${coin}: ${COIN_TELLS[coin]}.`,
        ],
        choices: [
          { label: `$${letters[order.indexOf(coin)]}$`, correct: true },
          ...order.flatMap((c, i) =>
            c === coin
              ? []
              : [
                  {
                    label: `$${letters[i]}$`,
                    feedback: `Coin $${letters[i]}$ is not a ${coin}. ${notCoin(c, coin)}`,
                  },
                ],
          ),
        ],
      };
    return {
      variant,
      prompt: `Which picture shows a ${coin}?`,
      figure: coinSet(...order),
      answer: "",
      hint: `Remember the value of a ${coin}. Look for the coin with that many cents written on it.`,
      explanation: [
        `A ${coin} is worth ${v}¢.`,
        `Coin $${letters[order.indexOf(coin)]}$ shows ${v}¢, so it is the ${coin}.`,
      ],
      choices: [
        { label: `$${letters[order.indexOf(coin)]}$`, correct: true },
        ...order.flatMap((c, i) =>
          c === coin
            ? []
            : [
                {
                  label: `$${letters[i]}$`,
                  feedback: `Coin $${letters[i]}$ shows ${COIN_CENTS[c]}¢. A ${coin} is worth ${v}¢.`,
                },
              ],
        ),
      ],
    };
  }
  const correct = `${v}¢`;
  const wrongs: Wrong[] = [
    {
      label: `¢${v}`,
      feedback: "Write the cent symbol after the number, not before it.",
    },
    {
      label: `${v}`,
      feedback: `The number alone does not say cents. Write ${v}¢ with the cent symbol.`,
    },
    {
      label: `$${v}`,
      feedback: `A dollar sign means dollars. $${v} is much more than ${v}¢.`,
    },
  ];
  if (variant === "write-cents-picture" && drawn)
    return {
      variant,
      prompt: "How do you write the value of this coin with the cent symbol?",
      figure: drawnCoins(coin),
      answer: "",
      hint: "First name the coin from its color, size and edge, and remember what it is worth. The cent symbol is ¢. It goes after the number, like 3¢ for three cents.",
      explanation: [
        `This coin is ${COIN_LOOKS[coin]}, so it is a ${coin}.`,
        `A ${coin} is worth ${count(v, "cent")}.`,
        `Write the number, then the cent symbol after it: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  return variant === "write-cents-picture"
    ? {
        variant,
        prompt: "How do you write the value of this coin with the cent symbol?",
        figure: coinSet(coin),
        answer: "",
        hint: "The cent symbol is ¢. It goes after the number, like 3¢ for three cents. Read the number on the coin.",
        explanation: [
          `The coin is worth ${count(v, "cent")}.`,
          `Write the number, then the cent symbol after it: ${correct}.`,
        ],
        choices: choicesFrom(r, correct, wrongs),
      }
    : {
        variant,
        prompt: `A ${coin} is worth ${CENT_WORDS[coin]}. How do you write that value with the cent symbol?`,
        answer: "",
        hint: "The cent symbol is ¢. It goes after the number, like 3¢ for three cents.",
        explanation: [
          `${cap(CENT_WORDS[coin])} is the number ${v}.`,
          `Write the number, then the cent symbol after it: ${correct}.`,
        ],
        choices: choicesFrom(r, correct, wrongs),
      };
}

/* ---------------------------------------------------------------------- */
/* solid-bottom-face-shape                                                 */
/* ---------------------------------------------------------------------- */

const SHAPE_DESC: Record<string, string> = {
  triangle: "3 straight sides and 3 corners",
  square: "4 equal sides and 4 corners",
  rectangle: "4 corners and two different side lengths",
  circle: "no corners and no straight sides",
  hexagon: "6 straight sides and 6 corners",
};
type SolidKind =
  | "cube"
  | "box"
  | "triangular prism"
  | "square pyramid"
  | "triangular pyramid"
  | "cylinder"
  | "cone";
const SOLID_BASE: Record<SolidKind, string> = {
  cube: "square",
  box: "rectangle",
  "triangular prism": "triangle",
  "square pyramid": "square",
  "triangular pyramid": "triangle",
  cylinder: "circle",
  cone: "circle",
};

/** What a hint may call each solid without naming the answer's shape. */
const SOLID_NAME: Record<SolidKind, string> = {
  cube: "cube",
  box: "box",
  "triangular prism": "prism",
  "square pyramid": "pyramid",
  "triangular pyramid": "pyramid",
  cylinder: "cylinder",
  cone: "cone",
};

function solidBottomFace(r: Random): Built {
  const kind = pick(r, Object.keys(SOLID_BASE) as SolidKind[]);
  const azimuth = pick(r, [20, 25, 30, 35, 40]);
  const circle = {
    type: "ellipse" as const,
    center: [0, 0] as Pt,
    radii: [1.1, 1.1] as [number, number],
    angle: 0,
  };
  const poly = (points: Pt[], degrees: number) => ({
    type: "polygon" as const,
    points: place(points, degrees),
  });
  const square: Pt[] = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const triangle: Pt[] = [
    [-1.1, -0.65],
    [1.1, -0.65],
    [0, 1.25],
  ];
  let solid: Solid;
  if (kind === "cube")
    solid = { type: "prism", base: poly(square, azimuth), height: 2 };
  else if (kind === "box")
    solid = {
      type: "prism",
      base: poly(
        [
          [-1.5, -0.8],
          [1.5, -0.8],
          [1.5, 0.8],
          [-1.5, 0.8],
        ],
        azimuth,
      ),
      height: pick(r, [1.2, 1.5]),
    };
  else if (kind === "triangular prism")
    solid = {
      type: "prism",
      base: poly(triangle, azimuth + 180),
      height: pick(r, [1.6, 2]),
    };
  else if (kind === "square pyramid")
    solid = { type: "pyramid", base: poly(square, azimuth), height: 2.2 };
  else if (kind === "triangular pyramid")
    solid = {
      type: "pyramid",
      base: poly(triangle, azimuth + 180),
      height: 2.2,
    };
  else if (kind === "cylinder")
    solid = { type: "prism", base: circle, height: pick(r, [1.6, 2]) };
  else solid = { type: "pyramid", base: circle, height: 2.2 };
  const correct = SOLID_BASE[kind];
  // A square is also a rectangle, so the two are never offered together
  // unless the face is truly a rectangle that is not a square.
  const pool = Object.keys(SHAPE_DESC).filter(
    (s) => s !== correct && !(correct === "square" && s === "rectangle"),
  );
  return {
    variant: kind,
    prompt:
      "A solid stands on a table. What is the shape of its flat face that touches the table?",
    figure: { kind: "solid-shape", solid },
    answer: "",
    hint: `The solid is a ${SOLID_NAME[kind]}. Look at the face of the ${SOLID_NAME[kind]} that touches the table. Is it round or does it have straight sides? Count its straight sides and corners.`,
    explanation: [
      `The face on the table has ${SHAPE_DESC[correct]}.`,
      `A ${correct} has ${SHAPE_DESC[correct]}, so the bottom face is a ${correct}.`,
    ],
    choices: choicesFrom(
      r,
      correct,
      pool.map((s) => ({
        label: s,
        feedback: `A ${s} has ${SHAPE_DESC[s]}. The face on the table has ${SHAPE_DESC[correct]}.`,
      })),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* measurable-attribute-choice                                             */
/* ---------------------------------------------------------------------- */

const ATTRIBUTES = ["length", "capacity", "weight"] as const;
type Attribute = (typeof ATTRIBUTES)[number];
const ATTRIBUTE_MEANING: Record<Attribute | "color", string> = {
  length: "Length tells how long, how tall or how wide something is.",
  capacity: "Capacity tells how much a container can hold.",
  weight: "Weight tells how heavy something is.",
  color: "Color is not measured with units. It has no amount.",
};
const QUESTIONS: Record<Attribute, string[]> = {
  length: [
    "How long is the jump rope?",
    "How tall is the door?",
    "How wide is the table?",
    "How tall is the plant?",
  ],
  capacity: [
    "How much water does the bucket hold?",
    "How much juice can the pitcher hold?",
    "How much soup fits in the pot?",
    "How much milk can the jug hold?",
  ],
  weight: [
    "How heavy is the backpack?",
    "How heavy is the watermelon?",
    "How heavy is the bag of apples?",
    "How heavy is the dog?",
  ],
};
const GOALS: Record<Attribute, string[]> = {
  length: [
    "Dee wants to know if the shelf is long enough for her book.",
    "Leo wants to know if the rope will reach the tree.",
    "Kim wants to know if the table is wide enough for a big map.",
    "Zed wants to know if the door is tall enough for a tall box.",
  ],
  capacity: [
    "Ava wants to know if the pot has room for all of the soup.",
    "Ben wants to know if the pitcher can hold all of the lemonade.",
    "Cy wants to know if the tank has room for ten buckets of water.",
  ],
  weight: [
    "Eli wants to know if the box is too heavy to lift.",
    "Fay wants to know if the bag of rice is heavier than the bag of beans.",
    "Gus wants to know how heavy the pumpkin is.",
  ],
};
const ATTRIBUTE_CHOICES: (Attribute | "color")[] = [
  "length",
  "capacity",
  "weight",
  "color",
];

function measurableAttribute(r: Random): Built {
  const variant = (
    [
      "attribute-of-question",
      "question-for-attribute",
      "decide-what-to-measure",
    ] as const
  )[r(0, 2)];
  const attr = pick(r, ATTRIBUTES);
  const wrongFor = (a: Attribute | "color"): Wrong => ({
    label: a,
    feedback: `${ATTRIBUTE_MEANING[a]} The question asks about something else.`,
  });
  const hint =
    "Look at the key words. 'How long', 'how tall' and 'how wide' ask about one attribute. 'How heavy' asks about a second. 'How much can it hold' asks about a third. Which key words do you see?";
  if (variant === "question-for-attribute") {
    const noun = pick(r, ["bucket", "box", "jar", "bottle", "bag"]);
    const asks: Record<Attribute | "color", string> = {
      length: `How long is the ${noun}?`,
      capacity: `How much can the ${noun} hold?`,
      weight: `How heavy is the ${noun}?`,
      color: `What color is the ${noun}?`,
    };
    return {
      variant,
      prompt: `Which question asks about the ${attr} of the ${noun}?`,
      answer: "",
      hint: `${ATTRIBUTE_MEANING[attr]} Find the question with key words that ask about it.`,
      explanation: [
        "An attribute is something about an object that you can measure, like how long or how heavy it is.",
        ATTRIBUTE_MEANING[attr],
        `"${asks[attr]}" uses those key words, so it asks about the ${attr}.`,
      ],
      choices: choicesFrom(
        r,
        asks[attr],
        ATTRIBUTE_CHOICES.filter((a) => a !== attr).map((a) => ({
          label: asks[a],
          feedback: `${ATTRIBUTE_MEANING[a]} This question asks about ${a === "color" ? "color" : `the ${a}`}, not the ${attr}.`,
        })),
      ),
    };
  }
  const deciding = variant === "decide-what-to-measure";
  const text = pick(r, deciding ? GOALS[attr] : QUESTIONS[attr]);
  return {
    variant,
    prompt: deciding
      ? `${text} Which attribute should be measured?`
      : `You want to answer this question: ${text} Which attribute do you measure?`,
    answer: "",
    hint: deciding
      ? "Ask what the goal needs to know: how long something is, how much it can hold, or how heavy it is. Then pick that attribute."
      : hint,
    explanation: [
      "An attribute is something about an object that you can measure, like how long or how heavy it is.",
      ATTRIBUTE_MEANING[attr],
      `${deciding ? "The goal" : "The question"} asks about the ${attr}, so you measure the ${attr}.`,
    ],
    choices: choicesFrom(
      r,
      attr,
      ATTRIBUTE_CHOICES.filter((a) => a !== attr).map(wrongFor),
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* dot-group-compared-to-number                                            */
/* ---------------------------------------------------------------------- */

/** One closed path of circles per group keeps the scene within its element limit. */
function dotPath(centers: Pt[], r: number): Element {
  const k = 0.5523 * r;
  const d: PathOp[] = [];
  for (const [x, y] of centers)
    d.push(
      ["M", x + r, y],
      ["C", x + r, y + k, x + k, y + r, x, y + r],
      ["C", x - k, y + r, x - r, y + k, x - r, y],
      ["C", x - r, y - k, x - k, y - r, x, y - r],
      ["C", x + k, y - r, x + r, y - k, x + r, y],
      ["Z"],
    );
  return { type: "path", d, fill: "accent", stroke: "ink", width: 1 };
}
function dotFigure(groups: { label: string; n: number }[]): SemanticFigure {
  const elements: Element[] = [];
  groups.forEach(({ label, n }, g) => {
    const x0 = (g % 2) * 7.4;
    const top = -Math.floor(g / 2) * 6.4;
    elements.push({
      type: "text",
      font: "sans",
      at: [x0 + 2.2, top],
      text: label,
      bold: true,
      size: "md",
      align: [0, 0],
    });
    elements.push(
      dotPath(
        Array.from({ length: n }, (_, i): Pt => [
          x0 + (i % 5) * 1.1,
          top - 1.1 - Math.floor(i / 5) * 1.1,
        ]),
        0.4,
      ),
    );
  });
  return {
    kind: "scene",
    scene: scene(...elements).build({
      title: "Groups of dots",
      width: 340,
      maxHeight: 300,
    }),
  };
}
const relation = (n: number, target: number) =>
  n < target ? "fewer than" : n > target ? "more than" : "the same as";

function dotGroupCompare(r: Random): Built {
  const variant = (
    [
      "more-than-number",
      "fewer-than-number",
      "same-as-number",
      "same-as-group",
    ] as const
  )[r(0, 3)];
  const N = r(4, 17);
  let counts: number[]; // correct first
  if (variant === "more-than-number") {
    const d = r(1, 3);
    counts = [N + d, N, N - 1, N - 3];
  } else if (variant === "fewer-than-number") {
    const d = r(1, 3);
    counts = [N - d, N, N + 1, N + 3];
  } else {
    counts = [N, N - 1, N + 1, r(0, 1) ? N + 2 : N - 2];
  }
  const withGroup = variant === "same-as-group";
  const used = withGroup ? counts.slice(0, 3) : counts;
  const order = shuffled(
    r,
    used.map((n, i) => ({ n, correct: i === 0 })),
  );
  const letters = ["A", "B", "C", "D"];
  const groups = order.map((o, i) => ({ label: letters[i]!, n: o.n }));
  const figure = dotFigure(
    withGroup ? [{ label: "Start", n: N }, ...groups] : groups,
  );
  const target = withGroup ? "the Start group" : `${N}`;
  const ask =
    variant === "more-than-number"
      ? `more dots than ${N}`
      : variant === "fewer-than-number"
        ? `fewer dots than ${N}`
        : variant === "same-as-number"
          ? `exactly ${N} dots`
          : "the same number of dots as the Start group";
  const correctLetter = letters[order.findIndex((o) => o.correct)]!;
  const wantRel =
    variant === "more-than-number"
      ? "more than"
      : variant === "fewer-than-number"
        ? "fewer than"
        : "the same as";
  return {
    variant,
    prompt: `Which group has ${ask}?`,
    figure,
    answer: "",
    hint: withGroup
      ? "Count the dots in the Start group first. Then count each lettered group and compare it with that number."
      : `Count the dots in each group. Then compare each count with ${N}: is it more, fewer or the same?`,
    explanation: [
      withGroup
        ? `First count the Start group: it has ${N} dots. Then count each lettered group and compare.`
        : `Count the dots in each group, then compare each count with ${N}.`,
      ...groups.map(
        (g) =>
          `Group ${g.label} has ${count(g.n, "dot")}, which is ${relation(g.n, N)} ${target}.`,
      ),
      `Only Group ${correctLetter} has ${wantRel} ${target}, so the answer is Group ${correctLetter}.`,
    ],
    choices: [
      { label: correctLetter, correct: true as const },
      ...groups.flatMap((g) =>
        g.label === correctLetter
          ? []
          : [
              {
                label: g.label,
                feedback: `Group ${g.label} has ${count(g.n, "dot")}, which is ${relation(g.n, N)} ${target}. You need ${wantRel} ${target}.`,
              },
            ],
      ),
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* story-sentence-match-20 and -1000                                       */
/* ---------------------------------------------------------------------- */

type StoryType =
  | "join-result"
  | "separate-result"
  | "join-change"
  | "separate-start"
  | "compare";
const STORY_TYPES: StoryType[] = [
  "join-result",
  "separate-result",
  "join-change",
  "separate-start",
  "compare",
];
const OBJECTS = ["stickers", "marbles", "books", "cards", "shells", "stamps"];
type Story = { type: StoryType; p: number; q: number; t: number };
/** The number the box stands for. */
const storyValue = (s: Story) =>
  ({
    "join-result": s.t,
    "separate-result": s.p,
    "join-change": s.q,
    "separate-start": s.t,
    compare: s.p,
  })[s.type];
const storySentence = (s: Story) =>
  ({
    "join-result": `${s.p} + ${s.q} = □`,
    "separate-result": `${s.t} − ${s.q} = □`,
    "join-change": `${s.p} + □ = ${s.t}`,
    "separate-start": `□ − ${s.q} = ${s.p}`,
    compare: `${s.t} − ${s.q} = □`,
  })[s.type];
function storyText(s: Story, a: string, b: string, obj: string): string {
  switch (s.type) {
    case "join-result":
      return `${a} has ${s.p} ${obj}. ${a} gets ${s.q} more. How many ${obj} does ${a} have now?`;
    case "separate-result":
      return `${a} has ${s.t} ${obj}. ${a} gives away ${s.q}. How many ${obj} does ${a} have left?`;
    case "join-change":
      return `${a} has ${s.p} ${obj}. ${a} gets some more. Now ${a} has ${s.t}. How many more ${obj} did ${a} get?`;
    case "separate-start":
      return `${a} had some ${obj}. ${a} gave away ${s.q}. Now ${a} has ${s.p} left. How many ${obj} did ${a} have at first?`;
    case "compare":
      return `${a} has ${s.t} ${obj}. ${b} has ${s.q}. How many more ${obj} does ${a} have than ${b}?`;
  }
}
const STORY_REASON: Record<StoryType, string> = {
  "join-result":
    "More are put with the first group, so the total is unknown: add.",
  "separate-result":
    "Some are taken away from a group, so the number left is unknown: subtract.",
  "join-change":
    "More are added and the total is known, so the amount added is unknown: it is the missing part.",
  "separate-start":
    "Some are taken away and the number left is known, so the number at first is unknown: it is the whole.",
  compare:
    "Two groups are compared, so the difference is unknown: subtract the smaller from the greater.",
};
/** Sentences with the same numbers, each with the value its box would have. */
function sentencePool(s: Story): { text: string; value: number }[] {
  const { p, q, t } = s;
  const all = [
    { text: `${p} + ${q} = □`, value: t },
    { text: `${t} − ${p} = □`, value: q },
    { text: `${t} − ${q} = □`, value: p },
    { text: `${p} + □ = ${t}`, value: q },
    { text: `□ + ${q} = ${t}`, value: p },
    { text: `□ − ${p} = ${q}`, value: t },
    { text: `□ − ${q} = ${p}`, value: t },
    {
      text: `${Math.max(p, q)} − ${Math.min(p, q)} = □`,
      value: Math.abs(p - q),
    },
  ];
  return all;
}

/** The numbers the story states, written as "320 and 301". */
const storyNumbers = (s: Story, a: string, b: string, obj: string) =>
  (storyText(s, a, b, obj).match(/\d+/g) ?? []).join(" and ");

function storySentenceMatch(r: Random, big: boolean): Built {
  const variant = r(0, 1) ? "story-for-sentence" : "sentence-for-story";
  let p: number, q: number;
  do {
    p = big ? r(120, 700) : r(2, 12);
    q = big ? r(110, 650) : r(2, 12);
  } while (p === q || (big ? p + q > 990 : p + q > 20));
  const t = p + q;
  const type = pick(r, STORY_TYPES);
  const story: Story = { type, p, q, t };
  const [a, b] = twoNames(r);
  const obj = pick(r, OBJECTS);
  const box = "The box □ is the number to find.";
  if (variant === "sentence-for-story") {
    const answerValue = storyValue(story);
    const correct = storySentence(story);
    const wrongs = sentencePool(story)
      .filter((x) => x.value !== answerValue && x.text !== correct)
      .map((x) => ({
        label: x.text,
        feedback: `In ${x.text} the box is ${x.value}, but the story asks for a different number. Decide whether the story joins, takes away or compares, and which number is not known.`,
      }));
    return {
      variant,
      prompt: `Which number sentence matches this story? ${box} ${storyText(story, a, b, obj)}`,
      answer: "",
      hint: `The story tells you ${storyNumbers(story, a, b, obj)} ${obj}. Ask what happens to the ${obj}: are they put together, taken away or compared? Then find the number the story does not tell you.`,
      explanation: [
        "A number sentence uses numbers and signs to tell what happens in a story. The box □ stands for the number the story asks for.",
        STORY_REASON[type],
        `So the number sentence that matches the story is ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  const sentence = storySentence(story);
  const answerValue = storyValue(story);
  const wrongs = STORY_TYPES.filter(
    (ty) => storyValue({ ...story, type: ty }) !== answerValue,
  ).map((ty) => {
    const other = { ...story, type: ty };
    return {
      label: storyText(other, a, b, obj),
      feedback: `This story is written ${storySentence(other)}, not ${sentence}. Check where the unknown number is.`,
    };
  });
  return {
    variant,
    prompt: `Which story matches ${sentence}? ${box}`,
    answer: "",
    hint: `Read ${sentence} aloud. Is the box the total, a part that is added or the number left? Find the story with its unknown number in the same place.`,
    explanation: [
      `A number sentence uses numbers and signs to tell what happens. In ${sentence} the box □ stands for the number to find.`,
      `Read the sentence as a story and find the story where the unknown number is in the same place.`,
      STORY_REASON[type],
      `So the matching story is: "${storyText(story, a, b, obj)}"`,
    ],
    choices: choicesFrom(r, storyText(story, a, b, obj), wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* open-number-line-to-120 and -to-1000                                    */
/* ---------------------------------------------------------------------- */

type Line = { min: number; max: number; step: number; labels: number[] };
const SMALL_LINES: Line[] = [
  { min: 0, max: 20, step: 1, labels: [0, 10, 20] },
  { min: 0, max: 50, step: 5, labels: [0, 25, 50] },
  { min: 0, max: 100, step: 10, labels: [0, 50, 100] },
  { min: 100, max: 120, step: 1, labels: [100, 110, 120] },
  { min: 20, max: 120, step: 10, labels: [20, 70, 120] },
  { min: 80, max: 120, step: 5, labels: [80, 100, 120] },
];
const BIG_LINES: Line[] = [
  ...[0, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((min) => ({
    min,
    max: min + 100,
    step: 10,
    labels: [min, min + 50, min + 100],
  })),
  { min: 0, max: 500, step: 50, labels: [0, 250, 500] },
  { min: 500, max: 1000, step: 50, labels: [500, 750, 1000] },
  { min: 0, max: 1000, step: 100, labels: [0, 500, 1000] },
];
function openNumberLine(r: Random, lines: Line[]): Built {
  const variant = r(0, 1) ? "read-point" : "locate-number";
  const line = pick(r, lines);
  const { min, max, step, labels } = line;
  const values: number[] = [];
  for (let v = min + step; v < max; v += step)
    if (!labels.includes(v)) values.push(v);
  const spec = (marks: { at: number; label: string }[]) =>
    numberLine({ id: "nl", min, max, step, labels, marks }).scene({
      title: "Number line",
      note: `The number line runs from ${min} to ${max}. Only ${labels.join(", ")} are labeled; the other tick marks are not.`,
      width: 360,
    });
  const ticks = (a: number, b: number) => Math.abs(a - b) / step;
  if (variant === "read-point") {
    const v = pick(r, values);
    const nearest = labels.reduce((best, l) =>
      Math.abs(l - v) < Math.abs(best - v) ? l : best,
    );
    const pool = [v + step, v - step, min + max - v, v + 2 * step, v - 2 * step]
      .filter((x) => x > min && x < max && x !== v)
      .map((x) => ({
        label: `${x}`,
        feedback:
          x === v + step || x === v - step
            ? `${x} is one tick mark ${x > v ? "past" : "before"} $P$. Start at ${nearest} and touch each tick mark once as you count by ${step}.`
            : x === min + max - v
              ? `${x} is where $P$ would be if you counted from the other end of the line. Start at the labeled number nearest $P$, ${nearest}.`
              : `${x} is two tick marks ${x > v ? "past" : "before"} $P$. Each tick mark is ${step} more than the one before it; count them one by one from ${nearest}.`,
      }));
    return {
      variant,
      prompt: "Which number is at point $P$ on the number line?",
      figure: { kind: "scene", scene: spec([{ at: v, label: "P" }]) },
      answer: "",
      hint: `Find the labeled number nearest to $P$. Count the tick marks from there to $P$, and count by the size of each step (each step is ${step} here).`,
      explanation: [
        `Tick marks are the small lines on a number line. Here each tick mark is ${step} more than the one before it.`,
        `Start at the labeled number nearest $P$, ${nearest}, so there is less to count.`,
        `Count ${count(ticks(nearest, v), "tick mark")} ${v > nearest ? "right" : "left"}, ${step} at a time. Going ${v > nearest ? "right adds" : "left takes away"} ${step} each time.`,
        `Point $P$ is at ${v}.`,
      ],
      choices: choicesFrom(r, `${v}`, pool),
    };
  }
  const chosen = shuffled(r, values).slice(0, 4);
  const v = chosen[0]!;
  const order = shuffled(r, chosen);
  const letters = ["A", "B", "C", "D"];
  const correct = letters[order.indexOf(v)]!;
  const nearest = labels.reduce((best, l) =>
    Math.abs(l - v) < Math.abs(best - v) ? l : best,
  );
  return {
    variant,
    prompt: `Which point is at ${v} on the number line?`,
    figure: {
      kind: "scene",
      scene: spec(order.map((at, i) => ({ at, label: letters[i]! }))),
    },
    answer: "",
    hint: `Start at the labeled number nearest to ${v}. Count along the tick marks, ${step} at a time, until you reach ${v}, then see which point is there.`,
    explanation: [
      `Tick marks are the small lines on a number line. Here each tick mark is ${step} more than the one before it.`,
      `Start at the labeled number nearest ${v}, which is ${nearest}, so there is less to count.`,
      `Count ${step} at a time ${v > nearest ? "right" : "left"} to ${v}: that takes ${count(ticks(nearest, v), "tick mark")}.`,
      `Point $${correct}$ is at ${v}, so the answer is point $${correct}$.`,
    ],
    choices: [
      { label: `$${correct}$`, correct: true as const },
      ...order.flatMap((at, i) =>
        at === v
          ? []
          : [
              {
                label: `$${letters[i]}$`,
                feedback: `Point $${letters[i]}$ is at ${at}, not ${v}. Count the tick marks from a labeled number.`,
              },
            ],
      ),
    ],
  };
}

/* ---------------------------------------------------------------------- */
/* eighths-and-parts-beyond-one                                            */
/* ---------------------------------------------------------------------- */

const FRACTION_UNIT: Record<number, [string, string]> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["fourth", "fourths"],
  8: ["eighth", "eighths"],
};
const unitOf = (d: number, n: number) => FRACTION_UNIT[d]![n === 1 ? 0 : 1];
const barFigure = (parts: number, shaded: number, wholes?: number) =>
  ({
    kind: "scene",
    scene: fractionBar({
      parts,
      shaded,
      ...(wholes ? { wholes } : {}),
      label: false,
    }).scene({ title: "Fraction bar", width: 360 }),
  }) as SemanticFigure;

function eighthsAndBeyond(r: Random): Built {
  const variant = (
    [
      "name-share",
      "parts-make-whole",
      "count-in-all",
      "wholes-and-parts",
    ] as const
  )[r(0, 3)];
  if (variant === "name-share") {
    const d = pick(r, [8, 8, 4]);
    const k = r(1, d - 1);
    const correct = `${k} ${unitOf(d, k)}`;
    const others = [2, 3, 4, 8].filter((x) => x !== d);
    const wrongs: Wrong[] = [
      {
        label: `${d - k} ${unitOf(d, d - k)}`,
        feedback: `That counts the parts that are not shaded. Count only the shaded parts: ${k}.`,
      },
      ...others.map((o) => ({
        label: `${k} ${unitOf(o, k)}`,
        feedback: `The bar is cut into ${d} equal parts, so each part is one ${unitOf(d, 1)}. The name comes from the number of equal parts.`,
      })),
      {
        label: `${d} ${unitOf(d, d)}`,
        feedback: `${d} is the number of parts in the whole bar. Count only the shaded parts.`,
      },
    ];
    return {
      variant,
      prompt: "The bar is cut into equal parts. How much of the bar is shaded?",
      figure: barFigure(d, k),
      answer: "",
      hint: `Count all the equal parts in the bar first. That number gives the name of each part. Then count the shaded parts.`,
      explanation: [
        `The number of equal parts in the whole gives each part its name.`,
        `The bar has ${d} equal parts, so each part is one ${unitOf(d, 1)}.`,
        `Count only the shaded parts: ${k}.`,
        `So ${count(k, unitOf(d, 1), unitOf(d, 2))} of the bar ${k === 1 ? "is" : "are"} shaded.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  if (variant === "parts-make-whole") {
    const d = pick(r, [2, 3, 4, 8]);
    const pool = [1, 2, d - 1, d + 1, 2 * d, Math.floor(d / 2)]
      .filter((x) => x >= 1 && x !== d)
      .map((x) => ({
        label: `${x}`,
        feedback: `Count the equal parts in one whole bar. A whole bar has ${d} equal parts, not ${x}.`,
      }));
    return {
      variant,
      prompt: `The bar is one whole, cut into equal parts. How many ${unitOf(d, 2)} make one whole?`,
      figure: barFigure(d, d),
      answer: "",
      hint: "One whole is the whole bar. Count the equal parts that fill it from end to end.",
      explanation: [
        `The number of equal parts in the whole gives each part its name.`,
        `The whole bar is cut into ${d} equal parts, and each part is one ${unitOf(d, 1)}.`,
        `All ${d} parts together fill the bar, so ${count(d, unitOf(d, 1), unitOf(d, 2))} make one whole.`,
      ],
      choices: choicesFrom(r, `${d}`, pool),
    };
  }
  const d = pick(r, [2, 3, 4, 8]);
  const extra = r(1, d - 1);
  const s = d + extra;
  const figure = barFigure(d, s, 2);
  if (variant === "count-in-all") {
    const pool = [extra, d, s + 1, s - 1, 2 * d]
      .filter((x) => x >= 1 && x !== s)
      .map((x) => ({
        label: `${x}`,
        feedback:
          x === d
            ? `${d} is the number of ${unitOf(d, 2)} in one whole. Count the shaded parts in both bars.`
            : x === extra
              ? `That counts only the ${extra} shaded ${extra === 1 ? "part" : "parts"} in the second bar. Count the shaded parts in both bars.`
              : "Count every shaded part once, in both bars.",
      }));
    return {
      variant,
      prompt: `Each bar is one whole, cut into ${unitOf(d, 2)}. How many ${unitOf(d, 2)} are shaded in all?`,
      figure,
      answer: "",
      hint: "Count the shaded parts in the first bar. Then keep counting the shaded parts in the second bar.",
      explanation: [
        `Both bars are cut into ${unitOf(d, 2)}, so you can count all the shaded parts together.`,
        `The first bar has ${count(d, unitOf(d, 1), unitOf(d, 2))}, all shaded.`,
        `The second bar has ${count(extra, unitOf(d, 1), unitOf(d, 2))} shaded.`,
        `Add them: ${d} + ${extra} = ${s}, so ${count(s, unitOf(d, 1), unitOf(d, 2))} are shaded in all.`,
      ],
      choices: choicesFrom(r, `${s}`, pool),
    };
  }
  const whole = (n: number) => count(n, "whole");
  const correct = `${whole(1)} and ${count(extra, unitOf(d, 1), unitOf(d, 2))}`;
  const wrongs: Wrong[] = [
    {
      label: `${whole(1)} and ${count(s, unitOf(d, 1), unitOf(d, 2))}`,
      feedback: `The first whole is already full. Only ${extra} more ${extra === 1 ? "is" : "are"} shaded after it, not ${s}.`,
    },
    {
      label: `${whole(1)} and ${count(d - extra, unitOf(d, 1), unitOf(d, 2))}`,
      feedback: `That counts the parts that are not shaded in the second bar. Count the shaded ones: ${extra}.`,
    },
    {
      label: `${whole(2)} and ${count(extra, unitOf(d, 1), unitOf(d, 2))}`,
      feedback:
        "Only the first bar is full. The second bar is not completely shaded.",
    },
    {
      label: `${whole(s)}`,
      feedback: `${s} is the number of shaded parts, not wholes. A whole needs ${d} parts.`,
    },
  ];
  return {
    variant,
    prompt: `Each bar is one whole, cut into ${unitOf(d, 2)}. How much is shaded?`,
    figure,
    answer: "",
    hint: "Check whether the first bar is completely shaded. Then count the shaded parts in the second bar.",
    explanation: [
      `Each bar is one whole, cut into ${d} equal parts.`,
      `The first bar is full: that is ${whole(1)}, which is ${count(d, unitOf(d, 1), unitOf(d, 2))}.`,
      `The second bar has ${count(extra, unitOf(d, 1), unitOf(d, 2))} shaded, which is less than a whole.`,
      `Together that is ${correct}.`,
    ],
    choices: choicesFrom(r, correct, wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* decompose-flat-shape                                                    */
/* ---------------------------------------------------------------------- */

type PartKind = "triangles" | "rectangles" | "squares";
function decomposeFlatShape(r: Random): Built {
  const variant = (["diagonal", "both-diagonals", "strips", "grid"] as const)[
    r(0, 3)
  ];
  const shape =
    variant === "both-diagonals"
      ? "square"
      : pick(r, ["rectangle", "square"] as const);
  let cut: "diagonal" | "diagonals" | "columns" | "rows" | "grid";
  let sizes: number[];
  let parts: number;
  let kind: PartKind;
  if (variant === "diagonal") {
    cut = "diagonal";
    sizes = [1, 1];
    parts = 2;
    kind = "triangles";
  } else if (variant === "both-diagonals") {
    cut = "diagonals";
    sizes = [1, 1, 1, 1];
    parts = 4;
    kind = "triangles";
  } else if (variant === "strips") {
    cut = pick(r, ["columns", "rows"] as const);
    parts = r(2, 3);
    sizes = Array.from({ length: parts }, () => 1);
    kind = "rectangles";
  } else {
    cut = "grid";
    sizes = [1, 1, 1, 1];
    parts = 4;
    kind = shape === "square" ? "squares" : "rectangles";
  }
  const label = (n: number, k: PartKind) => `${n} ${k}`;
  const correct = label(parts, kind);
  // Every true description is excluded from the wrong choices: a square is
  // also a rectangle, so 4 squares and 4 rectangles are both true for a grid cut of a square.
  const truths = new Set([correct]);
  if (kind === "squares") truths.add(label(parts, "rectangles"));
  const universe: string[] = [];
  for (const n of [2, 3, 4])
    for (const k of ["triangles", "rectangles", "squares"] as const)
      universe.push(label(n, k));
  const KIND_FACT: Record<PartKind, string> = {
    triangles: "3 sides and 3 corners",
    rectangles: "4 sides and 4 square corners, with two different side lengths",
    squares: "4 equal sides and 4 square corners",
  };
  const wrongs = universe
    .filter((x) => !truths.has(x))
    .map((x) => {
      const [n, k] = x.split(" ") as [string, PartKind];
      return {
        label: x,
        feedback:
          Number(n) !== parts
            ? `Count the parts the cut makes: there are ${parts}, not ${n}.`
            : `Each part has ${KIND_FACT[kind]}, so the parts are not ${k}.`,
      };
    });
  const cutWords: Record<string, string> = {
    diagonal: "along one line from corner to corner",
    diagonals: "along both lines from corner to corner",
    columns: "by straight lines from top to bottom",
    rows: "by straight lines from side to side",
    grid: "by one line from top to bottom and one line from side to side through the middle",
  };
  return {
    variant,
    prompt: `A ${shape} is cut into equal parts. What are the new shapes?`,
    figure: {
      kind: "partitioned-shapes",
      shapes: [{ shape, cut, sizes, shaded: [] }],
    },
    answer: "",
    hint: `The ${shape} is cut ${cutWords[cut]}. Count the parts the cuts make. Then pick one part and count its sides and corners to name its shape.`,
    explanation: [
      `The ${shape} is cut ${cutWords[cut]}. The cut makes ${parts} parts.`,
      `To name a shape, count its straight sides and corners. Each part has ${KIND_FACT[kind]}.`,
      `So the new shapes are ${correct}.`,
    ],
    choices: choicesFrom(r, correct, wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* unit-size-and-count                                                     */
/* ---------------------------------------------------------------------- */

function unitRows(
  length: number,
  rows: {
    label: string;
    size: number;
    copies: number;
    fill: "accent-fill" | "warm-fill";
    stroke: "accent" | "warm";
  }[],
): SemanticFigure {
  const elements: Element[] = [
    {
      type: "rect",
      at: [0, 2.4],
      size: [length, 0.9],
      fill: "paper",
      stroke: "ink",
      width: 1.5,
    },
    {
      type: "text",
      font: "sans",
      at: [length / 2, 2.85],
      text: "Ribbon",
      size: "sm",
      align: [0, 0],
    },
  ];
  rows.forEach((row, i) => {
    const y = 1.2 - i * 1.2;
    elements.push({
      type: "text",
      font: "sans",
      at: [-0.5, y + 0.45],
      text: row.label,
      size: "md",
      bold: true,
      align: [1, 0],
    });
    for (let c = 0; c < row.copies; c++)
      elements.push({
        type: "rect",
        at: [c * row.size, y],
        size: [row.size, 0.9],
        fill: row.fill,
        stroke: row.stroke,
        width: 1.5,
      });
  });
  return {
    kind: "scene",
    scene: scene(...elements).build({
      title: "A ribbon measured with units",
      width: 360,
      maxHeight: 260,
    }),
  };
}

function unitSizeAndCount(r: Random): Built {
  const variant = (["which-fewer", "predict-count", "why-more"] as const)[
    r(0, 2)
  ];
  const length = pick(r, [6, 8, 12]);
  const sizes = [1, 2, 3, 4, 6].filter((s) => length % s === 0);
  const small = pick(r, sizes.slice(0, -1));
  const large = pick(
    r,
    sizes.filter((s) => s > small),
  );
  if (variant === "predict-count") {
    // The small unit is the unit of length here, so one long unit is `large` of them.
    const n = length / large;
    const k = large;
    const pool = [length * k, length - k, k, length + k, n + 1, n - 1]
      .filter((x) => x >= 1 && x !== n)
      .map((x) => ({
        label: `${x}`,
        feedback:
          x === k
            ? `${k} is the number of small units in one long unit. Ask how many long units fit in ${length} small units.`
            : "A long unit covers several small units, so fewer long units are needed. Share the small units into long units.",
      }));
    return {
      variant,
      prompt: `The ribbon is ${length} small units long. One long unit is as long as ${k} small units. How many long units cover the ribbon?`,
      figure: unitRows(length, [
        {
          label: "Small",
          size: 1,
          copies: length,
          fill: "accent-fill",
          stroke: "accent",
        },
        {
          label: "Long",
          size: k,
          copies: 1,
          fill: "warm-fill",
          stroke: "warm",
        },
      ]),
      answer: "",
      hint: `Each long unit covers ${k} small units. Count how many groups of ${k} small units fit along the ribbon.`,
      explanation: [
        `The ribbon is ${length} small units long.`,
        `Each long unit covers ${k} small units, so count how many groups of ${k} fit into ${length}.`,
        `Finding how many groups fit is division: ${length} ÷ ${k} = ${n}.`,
        `So ${n} long units cover the ribbon.`,
      ],
      choices: choicesFrom(r, `${n}`, pool),
    };
  }
  const aLonger = r(0, 1) === 1;
  const sizeA = aLonger ? large : small;
  const sizeB = aLonger ? small : large;
  const figure = unitRows(length, [
    {
      label: "Unit A",
      size: sizeA,
      copies: length / sizeA,
      fill: "accent-fill",
      stroke: "accent",
    },
    {
      label: "Unit B",
      size: sizeB,
      copies: length / sizeB,
      fill: "warm-fill",
      stroke: "warm",
    },
  ]);
  const longer = aLonger ? "A" : "B";
  const shorter = aLonger ? "B" : "A";
  if (variant === "which-fewer") {
    const correct = `Unit $${longer}$, because it is longer`;
    return {
      variant,
      prompt:
        "The same ribbon is measured with unit $A$ and with unit $B$. Which unit needs fewer copies to cover the ribbon, and why?",
      figure,
      answer: "",
      hint: "Compare the two rows. Count the copies of each unit and see which unit is longer. Does the longer unit or the shorter unit need more copies?",
      explanation: [
        `Unit $${longer}$ is the longer unit and unit $${shorter}$ is the shorter unit.`,
        `A longer unit covers more of the ribbon with each copy, so it needs fewer copies.`,
        `Unit $${longer}$ needs fewer copies because it is longer.`,
      ],
      choices: [
        { label: correct, correct: true as const },
        {
          label: `Unit $${longer}$, because it is shorter`,
          feedback: `Unit $${longer}$ is the longer unit, so it is not shorter.`,
        },
        {
          label: `Unit $${shorter}$, because it is longer`,
          feedback: `Unit $${shorter}$ is the shorter unit, so this reason is not true.`,
        },
        {
          label: `Unit $${shorter}$, because it is shorter`,
          feedback: `Unit $${shorter}$ is shorter, but a shorter unit needs more copies to cover the same ribbon.`,
        },
      ],
    };
  }
  const reasons: Wrong[] = [
    {
      label: `Unit $${shorter}$ is longer than unit $${longer}$.`,
      feedback: `Unit $${shorter}$ is the shorter unit. A longer unit would need fewer copies.`,
    },
    {
      label: `The ribbon is longer in the row of unit $${shorter}$.`,
      feedback: "Both rows measure the same ribbon, so the length is the same.",
    },
    {
      label: `The copies of unit $${shorter}$ have gaps between them.`,
      feedback:
        "The copies fit end to end with no gaps. The units are not the same size.",
    },
  ];
  return {
    variant,
    prompt: `Both rows cover the same ribbon, end to end, with no gaps. Row $${shorter}$ uses more units than row $${longer}$. Why?`,
    figure,
    answer: "",
    hint: "Both rows measure the same ribbon. Compare the size of one unit in each row. What does a smaller unit do to the count?",
    explanation: [
      "Both rows cover the same ribbon, so the length is the same.",
      `One copy of unit $${shorter}$ is shorter than one copy of unit $${longer}$.`,
      `A shorter unit covers less each time, so more copies are needed.`,
      `So row $${shorter}$ uses more units because unit $${shorter}$ is shorter.`,
    ],
    choices: choicesFrom(
      r,
      `Unit $${shorter}$ is shorter than unit $${longer}$.`,
      reasons,
    ),
  };
}

/* ---------------------------------------------------------------------- */
/* benchmark-length-estimate                                               */
/* ---------------------------------------------------------------------- */

const BENCHMARKS: {
  one: string;
  many: string;
  len: number;
  unit: string;
  unitOne: string;
}[] = [
  {
    one: "a paper clip",
    many: "paper clips",
    len: 1,
    unit: "inches",
    unitOne: "inch",
  },
  { one: "a crayon", many: "crayons", len: 4, unit: "inches", unitOne: "inch" },
  { one: "a ruler", many: "rulers", len: 12, unit: "inches", unitOne: "inch" },
  {
    one: "a paper clip",
    many: "paper clips",
    len: 3,
    unit: "centimeters",
    unitOne: "centimeter",
  },
  {
    one: "a crayon",
    many: "crayons",
    len: 9,
    unit: "centimeters",
    unitOne: "centimeter",
  },
];
const TARGETS = ["a shelf", "a ribbon", "a table", "a mat", "a window"];
const REASONABLE: {
  what: string;
  right: string;
  wrong: Wrong[];
}[] = [
  {
    what: "the length of a pencil",
    right: "7 inches",
    wrong: [
      {
        label: "7 feet",
        feedback:
          "7 feet is as long as a door is tall. A pencil is much shorter.",
      },
      {
        label: "70 inches",
        feedback:
          "70 inches is taller than most doorways. A pencil is much shorter.",
      },
      {
        label: "1 inch",
        feedback:
          "1 inch is about the length of a paper clip. A pencil is longer.",
      },
    ],
  },
  {
    what: "the height of a classroom door",
    right: "7 feet",
    wrong: [
      {
        label: "7 inches",
        feedback:
          "7 inches is about the length of a pencil. A door is much taller.",
      },
      {
        label: "70 feet",
        feedback: "70 feet is taller than a house. A door is much shorter.",
      },
      {
        label: "2 feet",
        feedback:
          "2 feet is about as tall as a small child's knee. A door is taller.",
      },
    ],
  },
  {
    what: "the length of a bed",
    right: "6 feet",
    wrong: [
      {
        label: "6 inches",
        feedback:
          "6 inches is about the length of a crayon. A bed is much longer.",
      },
      {
        label: "60 feet",
        feedback: "60 feet is longer than a classroom. A bed is much shorter.",
      },
      {
        label: "2 feet",
        feedback:
          "2 feet is shorter than most children are tall. A bed is longer.",
      },
    ],
  },
  {
    what: "the length of a school bus",
    right: "40 feet",
    wrong: [
      {
        label: "40 inches",
        feedback:
          "40 inches is about as long as a small table. A bus is much longer.",
      },
      {
        label: "4 feet",
        feedback:
          "4 feet is about as tall as a small child. A bus is much longer.",
      },
      {
        label: "400 feet",
        feedback:
          "400 feet is longer than a football field. A bus is much shorter.",
      },
    ],
  },
  {
    what: "the length of a pencil",
    right: "18 centimeters",
    wrong: [
      {
        label: "18 meters",
        feedback:
          "18 meters is longer than a classroom. A pencil is much shorter.",
      },
      {
        label: "180 centimeters",
        feedback:
          "180 centimeters is taller than most adults. A pencil is much shorter.",
      },
      {
        label: "2 centimeters",
        feedback:
          "2 centimeters is shorter than a paper clip. A pencil is longer.",
      },
    ],
  },
  {
    what: "the height of a classroom door",
    right: "2 meters",
    wrong: [
      {
        label: "2 centimeters",
        feedback:
          "2 centimeters is shorter than a paper clip. A door is much taller.",
      },
      {
        label: "20 meters",
        feedback: "20 meters is taller than a house. A door is much shorter.",
      },
      {
        label: "20 centimeters",
        feedback:
          "20 centimeters is about the length of a pencil. A door is much taller.",
      },
    ],
  },
  {
    what: "the length of a paper clip",
    right: "3 centimeters",
    wrong: [
      {
        label: "3 meters",
        feedback:
          "3 meters is about as tall as a door and a half. A paper clip is much shorter.",
      },
      {
        label: "30 centimeters",
        feedback:
          "30 centimeters is about the length of a ruler. A paper clip is much shorter.",
      },
      {
        label: "20 centimeters",
        feedback:
          "20 centimeters is about the length of a pencil. A paper clip is shorter.",
      },
    ],
  },
];

function benchmarkEstimate(r: Random): Built {
  if (r(0, 1)) {
    const item = pick(r, REASONABLE);
    return {
      variant: "reasonable-estimate",
      prompt: `Which is the best estimate for ${item.what}?`,
      answer: "",
      hint: "Think of a length you know: a ruler is 12 inches, one big step is about 1 foot, and a paper clip is about 3 centimeters. Which choice is close to the real object?",
      explanation: [
        "An estimate is a close guess. Compare each choice with a length you know: a ruler is 12 inches, and one foot is about the length of a big step.",
        "The other choices are much too long or much too short for this object.",
        `So the best estimate is that ${item.what} is about ${item.right}.`,
      ],
      choices: choicesFrom(r, item.right, item.wrong),
    };
  }
  const b = pick(r, BENCHMARKS);
  const k = pick(r, b.len === 12 ? [2, 3, 4] : [2, 3, 4, 5, 6]);
  const target = pick(r, TARGETS);
  const total = b.len * k;
  const label = (n: number) => `${n} ${n === 1 ? b.unitOne : b.unit}`;
  const wrongs: Wrong[] = [
    {
      label: label(b.len + k),
      feedback: `Do not add ${k} to ${b.len}. Repeat the length ${label(b.len)} ${k} times.`,
    },
    {
      label: label(b.len),
      feedback: `${label(b.len)} is only one ${b.one.slice(2)}. ${cap(target)} is ${k} of them long.`,
    },
    {
      label: label(b.len * (k - 1)),
      feedback: `There are ${k} ${b.many}, not ${k - 1}. Repeat the length ${k} times.`,
    },
    {
      label: label(b.len * (k + 1)),
      feedback: `There are ${k} ${b.many}, not ${k + 1}. Repeat the length ${k} times.`,
    },
  ];
  return {
    variant: "repeat-benchmark",
    prompt: `${cap(b.one)} is about ${label(b.len)} long. ${cap(target)} is about ${k} ${b.many} long, end to end. About how long is ${target}?`,
    answer: "",
    hint: `Lay ${k} copies of the benchmark end to end. Each copy is about ${label(b.len)}. What do you do to find the total length?`,
    explanation: [
      `Each ${b.one.slice(2)} is about ${label(b.len)}.`,
      `${cap(target)} is ${k} of them: ${Array.from({ length: k }, () => b.len).join(" + ")} = ${total}.`,
      `${cap(target)} is about ${label(total)} long.`,
    ],
    choices: choicesFrom(r, label(total), wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* clock-minute-match                                                      */
/* ---------------------------------------------------------------------- */

function clockMinuteMatch(r: Random): Built {
  const variant = (
    ["read-minute", "match-clock", "minutes-after-hour"] as const
  )[r(0, 2)];
  const h = r(1, 12);
  // Most times are not multiples of five; some are, so the skill is not a guess.
  let m = r(1, 59);
  if (r(0, 5) > 0) while (m % 5 === 0) m = r(1, 59);
  const t = clockText(h, m);
  const next = (x: number) => (x % 12) + 1;
  const prev = (x: number) => ((x + 10) % 12) + 1;
  if (variant === "match-clock") {
    const mirror = (60 - m) % 60 === m ? (m + 10) % 60 : (60 - m) % 60;
    const clocks = shuffled(r, [
      { hour: h, minute: m, correct: true },
      { hour: h, minute: mirror, correct: false },
      { hour: next(h), minute: m, correct: false },
    ]);
    const letters = ["A", "B", "C"] as const;
    const correct = letters[clocks.findIndex((c) => c.correct)]!;
    return {
      variant,
      prompt: `Which clock shows ${t}?`,
      figure: {
        kind: "analog-clocks",
        clocks: clocks.map(({ hour, minute }, i) => ({
          hour,
          minute,
          label: letters[i],
        })),
      },
      answer: "",
      hint: `For ${t}, the short hand is near ${h} and the long hand is ${count(m, "minute")} after 12. Count by fives to the numeral before the long hand, then count single minutes.`,
      explanation: [
        "On a clock, the short hand shows the hour and the long hand shows the minutes.",
        `${t} means ${count(m, "minute")} after ${h} o'clock.`,
        `Clock ${correct} has its short hand just past ${h} and its long hand ${count(m, "minute")} after 12.`,
      ],
      choices: [
        { label: correct, correct: true as const },
        ...clocks.flatMap((c, i) =>
          c.correct
            ? []
            : [
                {
                  label: letters[i]!,
                  feedback: `Clock ${letters[i]} shows ${clockText(c.hour, c.minute)}, not ${t}.`,
                },
              ],
        ),
      ],
    };
  }
  const figure: SemanticFigure = {
    kind: "analog-clocks",
    clocks: [{ hour: h, minute: m }],
  };
  if (variant === "minutes-after-hour") {
    const wrongs = [
      {
        label: `${60 - m}`,
        feedback: `${60 - m} is the number of minutes left until the next hour. Count from 12 to the long hand.`,
      },
      {
        label: `${Math.round(m / 5)}`,
        feedback:
          "That is the numeral near the long hand. Each numeral is 5 minutes, so multiply by 5 and add single minutes.",
      },
      {
        label: `${m + 1}`,
        feedback:
          "That is 1 minute too many. Count the small tick marks carefully.",
      },
      {
        label: `${m - 1}`,
        feedback:
          "That is 1 minute too few. Count the small tick marks carefully.",
      },
      {
        label: `${5 * Math.floor(m / 5)}`,
        feedback:
          "That counts only to the numeral before the long hand. Add the single minutes after it.",
      },
    ];
    return {
      variant,
      prompt: "How many minutes after the hour does the clock show?",
      figure,
      answer: "",
      hint: "Look at the long hand. Count by fives for each numeral from 12, then count single minutes with the small tick marks until you reach the hand.",
      explanation: [
        "The long hand shows the minutes. Each numeral on the clock is 5 minutes more than the one before it.",
        Math.floor(m / 5) === 0
          ? "The long hand has not reached the 1, so there are no full fives."
          : `The long hand has passed ${count(Math.floor(m / 5), "numeral")} after the 12, and each numeral is 5 minutes: ${5 * Math.floor(m / 5)} minutes.`,
        m % 5 === 0
          ? "The hand is exactly on a numeral, so there are no single minutes to add."
          : `It is ${count(m % 5, "small tick mark")} past that numeral, so add ${m % 5}.`,
        `${5 * Math.floor(m / 5)} + ${m % 5} = ${count(m, "minute")} after the hour.`,
      ],
      choices: choicesFrom(r, `${m}`, wrongs),
    };
  }
  const swapped = clockText(
    Math.max(1, Math.round(m / 5)) % 12 || 12,
    (h * 5) % 60,
  );
  const wrongs = [
    {
      label: swapped,
      feedback:
        "The short hand shows the hour and the long hand shows the minutes. These two hands were swapped.",
    },
    {
      label: clockText(h, (m + 1) % 60),
      feedback:
        "That is 1 minute too many. Count the small tick marks carefully.",
    },
    {
      label: clockText(h, m - 1),
      feedback:
        "That is 1 minute too few. Count the small tick marks carefully.",
    },
    {
      label: clockText(prev(h), m),
      feedback:
        "Check the hour: the short hand has already passed this numeral, so read the numeral it passed.",
    },
    {
      label: clockText(next(h), m),
      feedback:
        "Check the hour: the short hand has not reached this numeral yet, so read the numeral it passed.",
    },
    {
      label: clockText(h, 5 * Math.floor(m / 5)),
      feedback:
        "That counts only to the numeral before the long hand. Add the single minutes after it.",
    },
  ];
  return {
    variant,
    prompt: "Which digital time matches the clock?",
    figure,
    answer: "",
    hint: "Read the hour from the short hand: the numeral it has passed. Then read the minutes from the long hand by counting by fives and then single minutes.",
    explanation: [
      "On a clock, the short hand shows the hour and the long hand shows the minutes.",
      `The short hand has passed ${h} but not reached the next numeral, so the hour is ${h}.`,
      `Count the long hand by fives for each numeral after 12, then single minutes: ${count(m, "minute")}.`,
      `A digital time writes the hour, a colon, then the minutes. The digital time is ${t}.`,
    ],
    choices: choicesFrom(r, t, wrongs),
  };
}

/* ---------------------------------------------------------------------- */
/* tally-and-t-chart                                                       */
/* ---------------------------------------------------------------------- */

const TALLY_TOPICS: { header: string; things: string[]; asked: string }[] = [
  {
    header: "Pet",
    things: ["cat", "dog", "fish", "bird"],
    asked: "favorite pet",
  },
  {
    header: "Fruit",
    things: ["apple", "pear", "grape", "plum"],
    asked: "favorite fruit",
  },
  {
    header: "Color",
    things: ["red", "blue", "green", "yellow"],
    asked: "favorite color",
  },
  {
    header: "Game",
    things: ["tag", "hide", "catch", "jump"],
    asked: "favorite game",
  },
];
function tallyFigure(header: string, rows: { label: string; n: number }[]) {
  const elements: Element[] = [
    {
      type: "text",
      font: "sans",
      at: [0, 0],
      text: header,
      bold: true,
      size: "md",
      align: [-1, 0],
    },
    {
      type: "text",
      font: "sans",
      at: [3.6, 0],
      text: "Tally",
      bold: true,
      size: "md",
      align: [-1, 0],
    },
    {
      type: "segment",
      from: [-0.2, -0.7],
      to: [9.6, -0.7],
      stroke: "ink",
      width: 2,
    },
    {
      type: "segment",
      from: [3.3, 0.6],
      to: [3.3, -rows.length * 1.5 - 0.5],
      stroke: "ink",
      width: 2,
    },
  ];
  rows.forEach(({ label, n }, i) => {
    const y = -1.6 - i * 1.5;
    elements.push({
      type: "text",
      font: "sans",
      at: [0, y],
      text: label,
      size: "md",
      align: [-1, 0],
    });
    const groups = Math.floor(n / 5);
    for (let g = 0; g < Math.ceil(n / 5); g++) {
      const x0 = 3.7 + g * 2;
      const strokes = g < groups ? 4 : n - groups * 5;
      for (let s = 0; s < strokes; s++)
        elements.push({
          type: "segment",
          from: [x0 + s * 0.4, y - 0.5],
          to: [x0 + s * 0.4, y + 0.5],
          stroke: "ink",
          width: 2.5,
        });
      if (g < groups)
        elements.push({
          type: "segment",
          from: [x0 - 0.2, y - 0.4],
          to: [x0 + 1.4, y + 0.4],
          stroke: "ink",
          width: 2.5,
        });
    }
  });
  return {
    kind: "scene",
    scene: scene(...elements).build({
      title: "Tally chart",
      width: 360,
      maxHeight: 300,
    }),
  } as SemanticFigure;
}

function tallyAndTChart(r: Random): Built {
  const variant = (
    ["read-tally", "compare-tally", "total-tally", "make-t-chart"] as const
  )[r(0, 3)];
  const topic = pick(r, TALLY_TOPICS);
  const things = shuffled(r, topic.things).slice(0, 3);
  if (variant === "make-t-chart") {
    const counts = shuffled(r, [2, 3, 4, 5]).slice(0, 3);
    const list = shuffled(
      r,
      things.flatMap((t, i) => Array.from({ length: counts[i]! }, () => t)),
    );
    const [a] = twoNames(r);
    const chart = (c: number[]) =>
      things.map((t, i) => `${t} ${c[i]}`).join(", ");
    const correct = chart(counts);
    const swap = [counts[1]!, counts[0]!, counts[2]!];
    const wrongs: Wrong[] = [
      {
        label: chart(swap),
        feedback: `The counts for ${things[0]} and ${things[1]} are switched. Count each word separately.`,
      },
      {
        label: chart([counts[0]! + 1, counts[1]!, counts[2]!]),
        feedback: `${cap(things[0]!)} has one fewer in the list. Mark each answer once.`,
      },
      {
        label: chart([counts[0]!, counts[1]!, counts[2]! - 1]),
        feedback: `${cap(things[2]!)} has one more in the list. Mark each answer once.`,
      },
      {
        label: chart([counts[0]!, counts[1]! + 1, counts[2]! + 1]),
        feedback: `${cap(things[1]!)} and ${things[2]} are each counted one too many times. Cross out each answer as you count it.`,
      },
    ];
    const total = counts.reduce((x, y) => x + y, 0);
    return {
      variant,
      prompt: `${a} asked ${total} children for a ${topic.asked}. The answers were: ${list.join(", ")}. Which T-chart shows how many children chose each?`,
      answer: "",
      hint: `Go through the list of ${total} answers and make one tally mark for each, one column per ${topic.header.toLowerCase()}. Then count the marks for each.`,
      explanation: [
        `Count each answer in the list: ${things.map((t, i) => `${t} ${counts[i]}`).join(", ")}.`,
        `The counts add to ${total}, the number of children asked.`,
        `A T-chart lists each choice with its count. The T-chart is: ${correct}.`,
      ],
      choices: choicesFrom(r, correct, wrongs),
    };
  }
  const rows = things.map((label) => ({ label, n: r(2, 14) }));
  // Distinct counts keep "more" and "most" unambiguous.
  while (new Set(rows.map((x) => x.n)).size < rows.length)
    rows.forEach((x) => (x.n = r(2, 14)));
  const figure = tallyFigure(topic.header, rows);
  const g = (n: number) => Math.floor(n / 5);
  const base = {
    variant,
    figure,
    answer: "",
  };
  const tallyHint =
    "Each group of five has four lines and one line across them. Count each group as 5, then count the lines that are left over.";
  if (variant === "read-tally") {
    const row = pick(r, rows);
    const pool = [
      {
        x: row.n - g(row.n),
        why: "That leaves out the line across each group of five. It counts as one more mark.",
      },
      {
        x: row.n + g(row.n),
        why: "A line across a group of four is not a separate count. Four lines and the line across make 5.",
      },
      {
        x: row.n + 1,
        why: "That is one too many. Count each group of five as 5, then the lines left over.",
      },
      {
        x: row.n - 1,
        why: "That is one too few. Count each group of five as 5, then the lines left over.",
      },
      {
        x: g(row.n) * 5,
        why: "That counts only the full groups of five. Add the lines left over.",
      },
    ]
      .filter((o) => o.x !== row.n && o.x > 0)
      .map((o) => ({ label: `${o.x}`, feedback: o.why }));
    return {
      ...base,
      prompt: `The tally chart shows each child's ${topic.asked}. How many children chose ${row.label}?`,
      hint: tallyHint,
      explanation: [
        "Each tally mark is one child. A group of five is four lines with one line across them.",
        `For ${row.label}: ${g(row.n)} ${g(row.n) === 1 ? "group" : "groups"} of five is ${g(row.n) * 5}${row.n % 5 ? `, and ${row.n % 5} more lines` : ""}.`,
        `${row.n} children chose ${row.label}.`,
      ],
      choices: choicesFrom(r, `${row.n}`, pool),
    };
  }
  if (variant === "compare-tally") {
    const [x, y] = shuffled(r, rows).slice(0, 2) as [
      { label: string; n: number },
      { label: string; n: number },
    ];
    const hi = x.n > y.n ? x : y;
    const lo = x.n > y.n ? y : x;
    const diff = hi.n - lo.n;
    const pool = [hi.n + lo.n, hi.n, lo.n, diff + 1, diff - 1]
      .filter((v) => v !== diff && v > 0)
      .map((v) => ({
        label: `${v}`,
        feedback:
          v === hi.n + lo.n
            ? "That adds the two counts. To find how many more, subtract the smaller count from the greater."
            : v === hi.n || v === lo.n
              ? "That is one of the counts. Find the difference between the two counts."
              : "One count is off by one. Count each group of five as 5, then the lines left over, and subtract again.",
      }));
    return {
      ...base,
      prompt: `The tally chart shows each child's ${topic.asked}. How many more children chose ${hi.label} than ${lo.label}?`,
      hint: `${tallyHint} Then find how much greater one count is than the other.`,
      explanation: [
        "Each tally mark is one child. A group of five is four lines with one line across them.",
        `${cap(hi.label)} has ${hi.n} and ${lo.label} has ${lo.n}.`,
        `"How many more" asks for the difference, so subtract the smaller count from the greater: ${hi.n} − ${lo.n} = ${diff}.`,
        `${diff === 1 ? "1 more child chose" : `${diff} more children chose`} ${hi.label}.`,
      ],
      choices: choicesFrom(r, `${diff}`, pool),
    };
  }
  const total = rows.reduce((s, row) => s + row.n, 0);
  const pool = [
    Math.max(...rows.map((row) => row.n)),
    total - 1,
    total + 1,
    total + 5,
    total - rows[0]!.n,
  ]
    .filter((v) => v !== total && v > 0)
    .map((v) => ({
      label: `${v}`,
      feedback:
        v === Math.max(...rows.map((row) => row.n))
          ? "That is only the greatest count. Add the counts from every row."
          : v === total - rows[0]!.n
            ? "That leaves out one row. Add the counts from every row."
            : "One row's count is off. Count each group of five as 5, then the lines left over, and add all the rows again.",
    }));
  return {
    ...base,
    prompt: `The tally chart shows each child's ${topic.asked}. How many children answered in all?`,
    hint: `${tallyHint} Then add the counts of every row.`,
    explanation: [
      "Each tally mark is one child, so add every row to find how many answered.",
      `The rows are ${rows.map((row) => `${row.label} ${row.n}`).join(", ")}.`,
      `${rows.map((row) => row.n).join(" + ")} = ${total}.`,
      `${total} children answered in all.`,
    ],
    choices: choicesFrom(r, `${total}`, pool),
  };
}

/* ---------------------------------------------------------------------- */
/* early-money-decisions                                                   */
/* ---------------------------------------------------------------------- */

function oneOfFour(
  r: Random,
  variant: string,
  prompt: string,
  hint: string,
  right: string,
  wrongs: string[],
  why: string,
  feedback: string,
): Built {
  return {
    variant,
    prompt,
    answer: "",
    hint,
    explanation: [why, `So the answer is: ${right}`],
    choices: choicesFrom(
      r,
      right,
      shuffled(r, wrongs)
        .slice(0, 3)
        .map((label) => ({ label, feedback })),
    ),
  };
}

function earlyMoneyDecisions(r: Random): Built {
  const variant = (
    [
      "earned-income",
      "gift",
      "spending",
      "saving",
      "deposit",
      "withdrawal",
      "savings-total",
      "producer-consumer",
      "production-cost",
    ] as const
  )[r(0, 8)];
  const [n, other] = twoNames(r);
  const amt = r(2, 9);
  const earned = [
    `${n} is paid ${dollars(amt)} for washing cars.`,
    `${n} is paid ${dollars(amt)} for raking leaves.`,
    `${n} is paid ${dollars(amt)} for walking a neighbor's dog.`,
    `${n} is paid ${dollars(amt)} for mowing a lawn.`,
  ];
  const gifts = [
    `${n} gets ${dollars(amt)} from Grandma as a birthday present.`,
    `${n} gets ${dollars(amt)} in a card from an aunt.`,
    `${n} gets ${dollars(amt)} as a present from a friend.`,
  ];
  if (variant === "earned-income") {
    const right = pick(r, earned);
    return oneOfFour(
      r,
      variant,
      "Which one shows income, money earned by working?",
      "Income is money you get for doing work. A gift is money someone gives you without any work. Look for the choice where the money is pay for work.",
      right,
      gifts,
      "Income is money you earn for doing work. The person in this choice is paid for work.",
      "Money given as a present is a gift. A gift is not paid for work, so it is not income.",
    );
  }
  if (variant === "gift") {
    const right = pick(r, gifts);
    return oneOfFour(
      r,
      variant,
      "Which one shows a gift, money given to you that you did not earn?",
      "A gift is money someone gives you without any work. Income is pay for work. Look for the choice where nobody worked for the money.",
      right,
      shuffled(r, earned).slice(0, 3),
      "A gift is money given to you without work. Nobody worked for the money in this choice.",
      "The person in this choice is paid for work, so this is income, not a gift.",
    );
  }
  const saves = [
    `${n} puts ${dollars(amt)} in a jar to keep for later.`,
    `${n} puts ${dollars(amt)} in a piggy bank to keep for later.`,
    `${n} puts ${dollars(amt)} in a bank account to keep for later.`,
  ];
  const spends = [
    `${n} buys a toy for ${dollars(amt)}.`,
    `${n} buys a snack for ${dollars(amt)}.`,
    `${n} buys a book for ${dollars(amt)}.`,
  ];
  if (variant === "spending" || variant === "saving") {
    const spend = variant === "spending";
    return oneOfFour(
      r,
      variant,
      `Which one shows ${spend ? "spending" : "saving"}?`,
      "Spending means using money to buy something now. Saving means keeping money to use later. Look at what happens to the money.",
      pick(r, spend ? spends : saves),
      spend ? saves : spends,
      spend
        ? "Spending means paying money to buy something now."
        : "Saving means keeping money to use later.",
      spend
        ? "The money is kept for later, so this is saving, not spending."
        : "The money is used to buy something now, so this is spending, not saving.",
    );
  }
  const deposits = [
    `${n} puts ${dollars(amt * 5)} into a bank account.`,
    `${n} adds ${dollars(amt * 5)} to savings at the bank.`,
    `${n} puts ${dollars(amt * 5)} of pay into the bank.`,
  ];
  const withdrawals = [
    `${n} takes ${dollars(amt * 5)} out of a bank account.`,
    `${n} takes ${dollars(amt * 5)} out of savings at the bank.`,
    `${n} takes ${dollars(amt * 5)} out of the bank to pay for shoes.`,
  ];
  if (variant === "deposit" || variant === "withdrawal") {
    const dep = variant === "deposit";
    return oneOfFour(
      r,
      variant,
      `Which one is ${dep ? "a deposit" : "a withdrawal"}?`,
      "A deposit puts money into an account, so the balance goes up. A withdrawal takes money out of an account, so the balance goes down.",
      pick(r, dep ? deposits : withdrawals),
      dep ? withdrawals : deposits,
      dep
        ? "A deposit puts money into the account."
        : "A withdrawal takes money out of the account.",
      dep
        ? "Money is taken out, so this is a withdrawal, not a deposit."
        : "Money is put in, so this is a deposit, not a withdrawal.",
    );
  }
  if (variant === "savings-total") {
    const form = r(0, 2);
    const week = r(2, 9);
    const weeks = r(3, 8);
    const start = r(5, 30);
    if (form === 0) {
      const total = week * weeks;
      return {
        variant,
        prompt: `${n} saves ${dollars(week)} each week. How much has ${n} saved after ${weeks} weeks?`,
        answer: "",
        hint: `Each week adds the same amount. Count how many ${dollars(week)} amounts are added in ${weeks} weeks.`,
        explanation: [
          `Saving means keeping money to use later. Each week adds ${dollars(week)}.`,
          `${weeks} weeks: ${Array.from({ length: weeks }, () => week).join(" + ")} = ${total}.`,
          `${n} has saved ${dollars(total)}.`,
        ],
        choices: choicesFrom(r, dollars(total), [
          {
            label: dollars(week + weeks),
            feedback:
              "That adds the amount and the number of weeks. Add the weekly amount once for each week.",
          },
          {
            label: dollars(week * (weeks - 1)),
            feedback: `There are ${weeks} weeks, not ${weeks - 1}. Add the weekly amount once for each week.`,
          },
          {
            label: dollars(week),
            feedback:
              "That is only one week of saving. Add the weekly amount once for each week.",
          },
          {
            label: dollars(week * (weeks + 1)),
            feedback: `There are ${weeks} weeks, not ${weeks + 1}. Add the weekly amount once for each week.`,
          },
        ]),
      };
    }
    if (form === 1) {
      const total = start + week * weeks;
      return {
        variant,
        prompt: `${n} already has ${dollars(start)} saved and saves ${dollars(week)} more each week. How much does ${n} have after ${weeks} weeks?`,
        answer: "",
        hint: `Find how much ${n} adds in ${weeks} weeks first. Then remember the money ${n} already had.`,
        explanation: [
          `The same amount is added each week, so multiply: in ${weeks} weeks ${n} adds ${weeks} × ${week} = ${week * weeks}.`,
          `${n} already had ${start}, so ${start} + ${week * weeks} = ${total}.`,
          `${n} has ${dollars(total)}.`,
        ],
        choices: choicesFrom(r, dollars(total), [
          {
            label: dollars(week * weeks),
            feedback: `That leaves out the ${dollars(start)} ${n} already had.`,
          },
          {
            label: dollars(start + week),
            feedback:
              "That adds only one week of saving. Add the weekly amount once for each week.",
          },
          {
            label: dollars(start * weeks),
            feedback: `${dollars(start)} is not added each week. Only ${dollars(week)} is added each week.`,
          },
          {
            label: dollars(start + week * (weeks - 1)),
            feedback: `There are ${weeks} weeks, not ${weeks - 1}.`,
          },
        ]),
      };
    }
    const bal = r(20, 60);
    const dep = r(5, 30);
    const wd = r(3, Math.min(bal + dep - 1, 25));
    const total = bal + dep - wd;
    return {
      variant,
      prompt: `${n}'s bank account has ${dollars(bal)}. ${n} makes a deposit of ${dollars(dep)} and a withdrawal of ${dollars(wd)}. How much is in the account now?`,
      answer: "",
      hint: `Start with ${dollars(bal)}. A deposit puts money in, so the balance goes up. A withdrawal takes money out, so the balance goes down. Change the balance one step at a time.`,
      explanation: [
        "A deposit puts money into an account, and a withdrawal takes money out.",
        `The deposit adds ${dep}: ${bal} + ${dep} = ${bal + dep}.`,
        `The withdrawal takes away ${wd}: ${bal + dep} − ${wd} = ${total}.`,
        `The account has ${dollars(total)}.`,
      ],
      choices: choicesFrom(r, dollars(total), [
        {
          label: dollars(bal + dep + wd),
          feedback: "A withdrawal takes money out, so subtract it.",
        },
        {
          label: dollars(bal + dep),
          feedback:
            "That leaves out the withdrawal. Subtract the money taken out.",
        },
        {
          label: dollars(bal - dep + wd),
          feedback:
            "A deposit puts money in, so add it. A withdrawal takes money out, so subtract it.",
        },
        {
          label: dollars(bal - wd),
          feedback: "That leaves out the deposit. Add the money put in.",
        },
      ]),
    };
  }
  if (variant === "producer-consumer") {
    const story = pick(r, [
      ["bakes bread and sells it", "buys a loaf"],
      ["grows apples and sells them", "buys an apple"],
      ["makes bracelets and sells them", "buys a bracelet"],
      ["makes lemonade and sells it", "buys a cup"],
    ] as const);
    const correct = `${n} is the producer and ${other} is the consumer.`;
    return {
      variant,
      prompt: `${n} ${story[0]}. ${other} ${story[1]}. Which sentence is true?`,
      answer: "",
      hint: "A producer makes goods or services to sell. A consumer buys and uses them. Ask who makes the item and who buys it.",
      explanation: [
        "A producer makes goods to sell. A consumer buys goods to use them.",
        `${n} makes the item and sells it, so ${n} is a producer.`,
        `${other} buys the item to use it, so ${other} is a consumer.`,
      ],
      choices: choicesFrom(r, correct, [
        {
          label: `${n} is the consumer and ${other} is the producer.`,
          feedback: `${n} is the one who makes the item, so ${n} is the producer.`,
        },
        {
          label: `${n} and ${other} are both producers.`,
          feedback: `${other} buys the item and does not make it, so ${other} is a consumer.`,
        },
        {
          label: `${n} and ${other} are both consumers.`,
          feedback: `${n} makes the item to sell, so ${n} is a producer.`,
        },
      ]),
    };
  }
  const recipe = pick(r, [
    {
      item: "bracelet",
      parts: [
        ["bead", "beads", 4, 5],
        ["string", "strings", 1, 8],
      ],
    },
    {
      item: "cup of lemonade",
      parts: [
        ["lemon", "lemons", 2, 10],
        ["bag of sugar", "bags of sugar", 1, 6],
        ["cup", "cups", 1, 4],
      ],
    },
    {
      item: "birdhouse",
      parts: [
        ["board", "boards", 3, 12],
        ["box of nails", "boxes of nails", 1, 9],
      ],
    },
    {
      item: "card",
      parts: [
        ["sheet of paper", "sheets of paper", 2, 7],
        ["sticker", "stickers", 1, 5],
      ],
    },
  ] as const);
  const cost = recipe.parts.reduce((s, [, , c, e]) => s + c * e, 0);
  const listed = recipe.parts
    .map(([one, many, c, e]) =>
      c === 1 ? `1 ${one} for ${e}¢` : `${c} ${many} at ${e}¢ each`,
    )
    .join(", ");
  const eachSum = recipe.parts.reduce((s, [, , , e]) => s + e, 0);
  const first = recipe.parts[0]!;
  return {
    variant,
    prompt: `${n} makes one ${recipe.item} and buys ${listed}. How much does it cost ${n} to make the ${recipe.item}?`,
    answer: "",
    hint: `For each kind of part, find its cost: the number of parts times the cost of one, such as ${first[2]} × ${first[3]}¢ for the ${first[1]}. Then add the costs of all the parts.`,
    explanation: [
      ...recipe.parts.map(
        ([one, many, c, e]) =>
          `${c === 1 ? one : many}: ${c} × ${e}¢ = ${c * e}¢.`,
      ),
      `${recipe.parts.map(([, , c, e]) => c * e).join(" + ")} = ${cost}.`,
      `It costs ${cost}¢ to make the ${recipe.item}.`,
    ],
    choices: choicesFrom(r, `${cost}¢`, [
      {
        label: `${eachSum}¢`,
        feedback:
          "That adds the cost of one of each part. Count how many of each part are needed.",
      },
      {
        label: `${cost - first[2] * first[3]}¢`,
        feedback: `That leaves out the ${first[1]}. Add the cost of every part.`,
      },
      {
        label: `${cost + first[3]}¢`,
        feedback:
          "That counts one part too many. Check how many of each part are needed.",
      },
      {
        label: `${cost - first[3]}¢`,
        feedback:
          "That counts one part too few. Check how many of each part are needed.",
      },
    ]),
  };
}

/* ---------------------------------------------------------------------- */

const builders: Record<
  string,
  (r: Random, seed: string) => Built & { axes?: Record<string, string> }
> = {
  "coin-name-and-cent-value": (r, seed) => {
    const axes = sweepChoose("coin-name-and-cent-value", seed);
    return { ...coinNameAndValue(r, axes), axes };
  },
  "solid-bottom-face-shape": solidBottomFace,
  "measurable-attribute-choice": measurableAttribute,
  "dot-group-compared-to-number": dotGroupCompare,
  "story-sentence-match-20": (r) => storySentenceMatch(r, false),
  "story-sentence-match-1000": (r) => storySentenceMatch(r, true),
  "open-number-line-to-120": (r) => openNumberLine(r, SMALL_LINES),
  "open-number-line-to-1000": (r) => openNumberLine(r, BIG_LINES),
  "eighths-and-parts-beyond-one": eighthsAndBeyond,
  "decompose-flat-shape": decomposeFlatShape,
  "unit-size-and-count": unitSizeAndCount,
  "benchmark-length-estimate": benchmarkEstimate,
  "clock-minute-match": clockMinuteMatch,
  "tally-and-t-chart": tallyAndTChart,
  "early-money-decisions": earlyMoneyDecisions,
};
export const texasK2TemplateIds = Object.keys(builders);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function leaks(draft: Draft): boolean {
  const text = `${draft.prompt}\n${draft.hint}`;
  const correct = draft.choices!.find((c) => c.correct)!.label;
  // A single letter names a picture; it cannot give the answer away.
  if (correct.length <= 1) return false;
  if (/^-?[\d,.]+$/.test(correct))
    return new RegExp(`(?<![\\d.,])${escape(correct)}(?![\\d]|[.,]\\d)`).test(
      text,
    );
  return text.includes(correct);
}

/** Private model: the variant is for tests; only the public problem is served. */
export function texasK2Case(templateId: string, seed: string) {
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const meta = texasK2Templates.find((t) => t.id === templateId);
  const build = builders[templateId];
  if (!meta || !build) throw new Error(`Unknown template ${templateId}`);
  const r = random(meta.id, seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    let draft: Built;
    try {
      draft = build(r, seed);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Need three"))
        continue;
      throw error;
    }
    if (leaks(draft)) continue;
    const { axes, ...rest } = draft as Built & {
      axes?: Record<string, string>;
    };
    const problem = assemble(meta, seed, r, rest);
    return {
      variant: draft.variant,
      problem: axes
        ? { ...problem, variant: sweepVariant(draft.variant, axes) }
        : problem,
    };
  }
  throw new Error("Could not generate a problem without leaking the answer");
}

export function generateTexasK2Problem(templateId: string, seed: string) {
  return texasK2Case(templateId, seed).problem;
}
