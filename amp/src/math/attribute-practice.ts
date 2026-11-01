import { count } from "./agreement";
import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";

type Response = "choice" | "number";
// id | title | skill | grade band | response | description
const rows = `
compare-lengths|Which is longer?|compare-attributes|K–2|choice|Compare the lengths of two strips, aligned or not at their left ends, or recognize equal lengths.
compare-weights|Which is heavier?|compare-attributes|K–2|choice|Read a balance to decide which of two objects is heavier or lighter, or that they weigh the same; drawn size does not follow weight.
compare-capacity|Which holds more?|compare-attributes|K–2|choice|Decide which jar holds more after a full jar is poured into an empty one.
measure-with-units|Measure with equal units|measure-equal-units|K–2|number|Count equal cubes or paper clips laid end to end, without gaps or overlaps, along an object.
correct-unit-measure|Measure without gaps or overlaps|measure-equal-units|K–2|choice|Pick the picture that measures correctly from layouts with gaps, overlaps or a shifted start.
order-lengths|Longest and shortest|measure-equal-units|K–2|choice|Order three ribbons from two length comparisons and name the longest or shortest.
read-liquid-volume|Read liters on a scale|mass-volume|3–5|number|Read a liquid level in liters on a container scale whose ticks are worth 1, 2 or 5 liters.
balance-mass|Find a mass with a balance|mass-volume|3–5|number|Find an object's mass in grams from the standard masses that balance it.
mass-volume-story|Mass and volume stories|mass-volume|3–5|number|Solve a one-step addition, subtraction, multiplication or division story in grams, kilograms or liters.
`;
const definitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, gradeBand, response, description] = row.split(
      "|",
    ) as [string, string, string, "K–2" | "3–5", Response, string];
    return { id, title, skillId, gradeBand, response, description };
  });
export const attributeTemplates: readonly TemplateMetadata[] = definitions.map(
  ({ id, title, skillId, gradeBand, response, description }) => ({
    id,
    version: 1,
    title,
    skillId,
    gradeBand,
    description,
    ...(response === "choice"
      ? { requiredResponseCapability: "single-choice-v1" as const }
      : {}),
  }),
);

type Random = (low: number, high: number) => number;
function random(id: string, seed: string): Random {
  let counter = 0;
  return (low, high) => {
    const span = high - low + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let value: number;
    do {
      value = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    } while (value >= limit);
    return low + (value % span);
  };
}
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;
function shuffle<T>(r: Random, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = r(0, i);
    [xs[i], xs[j]] = [xs[j]!, xs[i]!];
  }
  return xs;
}
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  choices?: Choice[];
  /** Choices are in display order (labels name figure positions). */
  ordered?: boolean;
};
const choice = (label: string, right: boolean, feedback: string): Choice =>
  right ? { label, correct: true } : { label, feedback };

function compareLengths(r: Random): Draft {
  const equal = r(0, 4) === 0,
    aligned = equal || r(0, 2) > 0;
  let a = r(3, 12),
    b = equal ? a : r(3, 12);
  while (!equal && Math.abs(a - b) < 2) b = r(3, 12);
  // Misaligned strips: the shorter one starts further right and ends past the longer.
  let sa = 0,
    sb = 0;
  if (!aligned) {
    const shift = Math.abs(a - b) + r(1, 2);
    if (a < b) sa = shift;
    else sb = shift;
  }
  const ask = r(0, 1) ? "longer" : "shorter";
  const target = equal ? null : (ask === "longer") === a > b ? "A" : "B";
  const misleading = sa !== sb;
  return {
    prompt: `Which strip is ${ask}?`,
    hint: misleading
      ? "Strip A and strip B start at different places. Compare them from one starting line, not by where they end."
      : "Strip A and strip B start at the same line. Look at the right ends: which reaches further?",
    figure: {
      kind: "length-rods",
      rods: [
        { label: "A", length: a, start: sa },
        { label: "B", length: b, start: sb },
      ],
    },
    explanation: equal
      ? [
          "The strips start at the same place and end at the same place.",
          "They are the same length, so neither is longer or shorter.",
        ]
      : [
          misleading
            ? `The strips do not start at the same place, so the one that reaches further right is not necessarily longer.`
            : "Both strips start at the same left edge.",
          `Lined up at one end, strip ${a > b ? "A" : "B"} reaches further, so it is longer.`,
          `Strip ${target} is ${ask}.`,
        ],
    choices: [
      choice(
        "Strip A",
        target === "A",
        equal
          ? "The strips start and end at the same places, so they are the same length."
          : `Line up the left ends: strip ${target} is ${ask}.`,
      ),
      choice(
        "Strip B",
        target === "B",
        equal
          ? "The strips start and end at the same places, so they are the same length."
          : `Line up the left ends: strip ${target} is ${ask}.`,
      ),
      choice(
        "They are the same length.",
        equal,
        `Strip ${a > b ? "A" : "B"} is longer than strip ${a > b ? "B" : "A"}${misleading ? "; the strips only look even because they start at different places" : ""}.`,
      ),
    ],
    ordered: true,
  };
}

function compareWeights(r: Random): Draft {
  const tilt = pick(r, ["left", "right", "left", "right", "level"] as const);
  const shapes = shuffle(r, ["box", "ball", "bag"] as (
    "box" | "ball" | "bag"
  )[]);
  // Size is independent of weight: the heavier object is often the smaller one.
  const [sizeA, sizeB] =
    tilt === "level"
      ? [r(1, 3), r(1, 3)]
      : r(0, 2) > 0
        ? tilt === "left"
          ? [1, r(2, 3)]
          : [r(2, 3), 1]
        : [r(1, 3), r(1, 3)];
  const ask = r(0, 1) ? "heavier" : "lighter";
  const heavier = tilt === "left" ? "A" : tilt === "right" ? "B" : null;
  const target =
    heavier === null
      ? null
      : ask === "heavier"
        ? heavier
        : heavier === "A"
          ? "B"
          : "A";
  const [nameA, nameB] = [shapes[0]!, shapes[1]!];
  const same = "They weigh the same.";
  const reason =
    heavier === null
      ? "The beam is level, so both sides weigh the same."
      : `The beam goes down on the side of ${heavier}, so ${heavier} is heavier.`;
  return {
    prompt: `Which is ${ask}?`,
    hint: `The ${nameA} is on the left pan and the ${nameB} on the right. A balance drops on the heavier side, whatever the sizes.`,
    figure: {
      kind: "mass-balance",
      tilt,
      left: { shape: nameA, size: sizeA!, label: "A" },
      right: { shape: nameB, size: sizeB!, label: "B" },
    },
    explanation: [
      `${cap(nameA)} A is on the left pan and ${nameB} B is on the right pan.`,
      reason,
      heavier === null
        ? "Neither is heavier or lighter."
        : `So ${target} is ${ask}. A bigger object is not always heavier.`,
    ],
    choices: [
      choice(`A (the ${nameA})`, target === "A", reason),
      choice(`B (the ${nameB})`, target === "B", reason),
      choice(same, heavier === null, reason),
    ],
    ordered: true,
  };
}

/** A tall container poured into a wide one; names vary, the figure does not. */
const CONTAINERS: [string, string][] = [
  ["jar", "bowl"],
  ["bottle", "jug"],
  ["vase", "pot"],
  ["glass", "mug"],
  ["can", "pan"],
];
function compareCapacity(r: Random): Draft {
  const outcome = r(0, 2);
  const eighths = outcome === 0 ? r(3, 7) : outcome === 1 ? 8 : 9;
  const [tall, wide] = pick(r, CONTAINERS);
  const A = `the ${tall}`,
    B = `the ${wide}`;
  const answer = eighths < 8 ? "B" : eighths > 8 ? "A" : null;
  const what =
    eighths < 8
      ? `The water does not fill ${B}; there is room left.`
      : eighths === 8
        ? `The water fills ${B} exactly to the top.`
        : `${cap(B)} overflows: some water spills.`;
  return {
    prompt: `${cap(A)} (A) was full of water. All of it was poured into ${B} (B), which was empty. Which holds more?`,
    hint: `Look at ${B} after pouring. Did the water leave room, fill it exactly, or spill over?`,
    figure: { kind: "pour", eighths },
    explanation: [
      what,
      answer === "B"
        ? `${cap(B)} can hold all of the water from ${A} and more, so ${B} holds more.`
        : answer === "A"
          ? `The water from ${A} is more than ${B} can hold, so ${A} holds more.`
          : `${cap(B)} holds exactly what ${A} held, so they hold the same amount.`,
      "A taller container does not always hold more; pouring compares what they hold.",
    ],
    choices: [
      choice(`A, ${A}`, answer === "A", what),
      choice(`B, ${B}`, answer === "B", what),
      choice("They hold the same amount.", answer === null, what),
    ],
    ordered: true,
  };
}

const OBJECTS = ["ribbon", "pencil", "rope", "straw", "crayon"] as const;
function measureWithUnits(r: Random): Draft {
  const unit = pick(r, ["cube", "clip"] as const);
  const unitName = unit === "cube" ? "cube" : "paper clip";
  const object = pick(r, OBJECTS);
  const length = r(3, 10);
  return {
    prompt: `${unitName[0]!.toUpperCase()}${unitName.slice(1)}s are lined up along the ${object}, end to end with no gaps or overlaps. How many ${unitName}s long is the ${object}?`,
    hint: `Count the ${unitName}s from one end of the ${object} to the other.`,
    figure: {
      kind: "unit-measure",
      unit,
      panels: [
        {
          length,
          placements: Array.from({ length }, (_, i) => i),
        },
      ],
    },
    explanation: [
      `The ${unitName}s start at the end of the ${object} and touch each other, so each one measures one equal part.`,
      `Count them: ${Array.from({ length }, (_, i) => i + 1).join(", ")}.`,
      `The ${object} is ${count(length, unitName)} long.`,
    ],
    answer: `${length}`,
  };
}

function correctUnitMeasure(r: Random): Draft {
  const unit = pick(r, ["cube", "clip"] as const);
  const unitName = unit === "cube" ? "cube" : "paper clip";
  const object = pick(r, OBJECTS);
  const length = r(4, 6);
  const layouts = {
    correct: Array.from({ length }, (_, i) => i),
    gaps: Array.from(
      { length: Math.floor((length - 1) / 1.5) + 1 },
      (_, i) => i * 1.5,
    ),
    overlaps: Array.from({ length: 2 * length - 1 }, (_, i) => i / 2),
    shifted: Array.from({ length }, (_, i) => i + 0.5),
  };
  const wrong = shuffle(r, ["gaps", "overlaps", "shifted"] as (
    "gaps" | "overlaps" | "shifted"
  )[]).slice(0, 2);
  const roles = shuffle(r, ["correct", ...wrong] as (keyof typeof layouts)[]);
  const labels = ["A", "B", "C"] as const;
  const why: Record<keyof typeof layouts, string> = {
    correct: "starts at the end and has no gaps or overlaps",
    gaps: `has gaps between the ${unitName}s, so some length is not counted`,
    overlaps: `has ${unitName}s overlapping, so some length is counted twice`,
    shifted: `does not start at the end of the ${object}, so the count does not match its length`,
  };
  const name = (role: string) =>
    `Picture ${labels[roles.indexOf(role as keyof typeof layouts)]}`;
  return {
    prompt: `Which picture shows how to measure the ${object} with ${unitName}s?`,
    hint: `The ${unitName}s must start at the end of the ${object}, touch each other and never overlap. Check each picture for gaps, overlaps and its start.`,
    figure: {
      kind: "unit-measure",
      unit,
      panels: roles.map((role, i) => ({
        label: labels[i],
        length,
        placements: layouts[role],
      })),
    },
    explanation: [
      ...wrong.map((role) => `${name(role)} ${why[role]}.`),
      `${name("correct")} ${why.correct}: the ${object} is ${count(length, unitName)} long.`,
    ],
    choices: roles.map((role, i) =>
      choice(
        `Picture ${labels[i]}`,
        role === "correct",
        `Picture ${labels[i]} ${why[role]}.`,
      ),
    ),
    ordered: true,
  };
}

function orderLengths(r: Random): Draft {
  // Ribbons named by colour words in order from longest to shortest.
  const order = shuffle(r, ["red", "blue", "green", "yellow", "purple"]).slice(
    0,
    3,
  ) as [string, string, string];
  const [long, middle, short] = order;
  const first =
    r(0, 1) === 1
      ? `The ${long} ribbon is longer than the ${middle} ribbon.`
      : `The ${middle} ribbon is shorter than the ${long} ribbon.`;
  const second =
    r(0, 1) === 1
      ? `The ${middle} ribbon is longer than the ${short} ribbon.`
      : `The ${short} ribbon is shorter than the ${middle} ribbon.`;
  const ask = r(0, 1) ? "longest" : "shortest";
  const answer = ask === "longest" ? long : short;
  const [statement1, statement2] = r(0, 1) ? [first, second] : [second, first];
  return {
    prompt: `${statement1} ${statement2} Which ribbon is the ${ask}?`,
    hint: `The ${middle} ribbon is in both sentences, so it goes in the middle. Place the other two on either side of it.`,
    explanation: [
      `The ${long} ribbon is longer than the ${middle} ribbon.`,
      `The ${middle} ribbon is longer than the ${short} ribbon.`,
      `So from longest to shortest: ${long}, ${middle}, ${short}. The ${ask} is the ${answer} ribbon.`,
    ],
    choices: [long, middle, short].map((colour) =>
      choice(
        `The ${colour} ribbon`,
        colour === answer,
        colour === middle
          ? `The ${middle} ribbon is between the other two: shorter than ${long}, longer than ${short}.`
          : `From longest to shortest the order is ${long}, ${middle}, ${short}.`,
      ),
    ),
  };
}

const SCALES: [number, number, number][] = [
  [10, 1, 5],
  [20, 1, 5],
  [20, 2, 5],
  [30, 2, 5],
  [40, 2, 5],
  [40, 5, 2],
  [12, 1, 4],
];
function readLiquid(r: Random): Draft {
  const [max, step, labelEvery] = pick(r, SCALES);
  let level = step * r(1, max / step - 1);
  // Mostly between labels, where the tick value matters.
  if ((level / step) % labelEvery === 0 && r(0, 2) > 0)
    level = step * r(1, max / step - 1);
  const big = step * labelEvery,
    below = Math.floor(level / big) * big,
    ticks = (level - below) / step;
  return {
    prompt: "How many liters of water are in the container?",
    hint: `The labels are ${["", "one", "two", "three", "four", "five"][labelEvery]} ${labelEvery === 1 ? "space" : "spaces"} apart. Work out what one tick is worth, then count up from the label below the water.`,
    figure: {
      kind: "liquid-scale",
      unit: "L",
      max,
      step,
      labelEvery,
      level,
    },
    explanation: [
      `The labels go up by ${big} liters every ${count(labelEvery, "space")}, so each tick mark is ${big} ÷ ${labelEvery} = ${count(step, "liter")}.`,
      ticks === 0
        ? `The water is exactly at the ${below}-liter label.`
        : `The water is ${count(ticks, "tick")} above the ${below}-liter label: ${below} + ${ticks} × ${step} = ${level}.`,
      `There ${level === 1 ? "is" : "are"} ${count(level, "liter")} of water.`,
    ],
    answer: `${level}`,
  };
}

const MASSES = [500, 200, 100, 50, 20, 10, 5];
function balanceMass(r: Random): Draft {
  const n = r(2, 5);
  const grams = Array.from({ length: n }, () => pick(r, MASSES)).sort(
    (a, b) => b - a,
  );
  const total = grams.reduce((a, b) => a + b, 0);
  const shape = pick(r, ["box", "bag", "ball"] as const);
  return {
    prompt: `The balance is level. What is the mass of the ${shape}, in grams?`,
    hint: `The beam is level, so the ${shape} matches the right pan. Add the ${grams.length} standard masses, starting with ${grams[0]} g.`,
    figure: {
      kind: "mass-balance",
      tilt: "level",
      left: { shape, size: r(1, 3) },
      right: { grams },
    },
    explanation: [
      `The beam is level, so the ${shape} has the same mass as the standard masses.`,
      `Add them in grams: ${grams.join(" + ")} = ${total}.`,
      `The ${shape} has a mass of ${total} grams.`,
    ],
    answer: `${total}`,
  };
}

function massVolumeStory(r: Random): Draft {
  const kind = pick(r, ["add", "subtract", "multiply", "divide"] as const);
  const volume = r(0, 1) === 1;
  if (kind === "add") {
    const a = volume ? r(2, 19) : 50 * r(2, 14),
      b = volume ? r(2, 19) : 50 * r(2, 14);
    const u = volume ? "liter" : "gram";
    const prompt = volume
      ? `A bucket holds ${a} liters of water and a tub holds ${b} liters. How many liters do they hold together?`
      : `A melon has a mass of ${a} grams and a bunch of grapes has a mass of ${b} grams. What is their total mass, in grams?`;
    return {
      prompt,
      hint: `Together means join ${a} and ${b}: add the two amounts.`,
      explanation: [
        `Both amounts are in ${u}s, so add them.`,
        `${a} + ${b} = ${a + b}.`,
        `Together: ${count(a + b, u)}.`,
      ],
      answer: `${a + b}`,
    };
  }
  if (kind === "subtract") {
    let a = volume ? r(8, 40) : 50 * r(6, 19),
      b = volume ? r(2, 30) : 50 * r(1, 15);
    if (b >= a) [a, b] = [b + (volume ? 2 : 100), a];
    const u = volume ? "liter" : "gram";
    const prompt = volume
      ? `A tank holds ${a} liters of water. ${b} liters are used. How many liters are left?`
      : `A bag of potatoes has a mass of ${a} grams and a bag of onions has a mass of ${b} grams. How many grams heavier is the bag of potatoes?`;
    return {
      prompt,
      hint: volume
        ? `${b} liters are taken away from ${a}: subtract.`
        : `How many more compares ${a} grams with ${b} grams: subtract the smaller from the larger.`,
      explanation: [
        `Both amounts are in ${u}s, so subtract.`,
        `${a} − ${b} = ${a - b}.`,
        `${volume ? "Left" : "Difference"}: ${count(a - b, u)}.`,
      ],
      answer: `${a - b}`,
    };
  }
  const each = volume ? r(2, 9) : r(2, 9),
    groups = r(2, 9);
  const u = volume ? "liter" : "kilogram";
  if (kind === "multiply") {
    const prompt = volume
      ? `Each bottle holds ${each} liters. How many liters do ${groups} bottles hold?`
      : `Each bag of rice has a mass of ${each} kilograms. What is the mass of ${groups} bags, in kilograms?`;
    return {
      prompt,
      hint: `${groups} equal amounts of ${each}: multiply.`,
      explanation: [
        `${groups} equal groups of ${count(each, u)}.`,
        `${groups} × ${each} = ${groups * each}.`,
        `In all: ${count(groups * each, u)}.`,
      ],
      answer: `${groups * each}`,
    };
  }
  const total = each * groups;
  const prompt = volume
    ? `${total} liters of juice are poured equally into ${groups} jugs. How many liters are in each jug?`
    : `${total} kilograms of flour are shared equally among ${groups} bags. What is the mass of each bag, in kilograms?`;
  return {
    prompt,
    hint: `Share ${total} equally into ${groups} parts: divide.`,
    explanation: [
      `Share ${count(total, u)} equally among ${groups}.`,
      `${total} ÷ ${groups} = ${each}, because ${groups} × ${each} = ${total}.`,
      `Each holds ${count(each, u)}.`,
    ],
    answer: `${each}`,
  };
}

function draft(templateId: string, r: Random): Draft {
  switch (templateId) {
    case "compare-lengths":
      return compareLengths(r);
    case "compare-weights":
      return compareWeights(r);
    case "compare-capacity":
      return compareCapacity(r);
    case "measure-with-units":
      return measureWithUnits(r);
    case "correct-unit-measure":
      return correctUnitMeasure(r);
    case "order-lengths":
      return orderLengths(r);
    case "read-liquid-volume":
      return readLiquid(r);
    case "balance-mass":
      return balanceMass(r);
    case "mass-volume-story":
      return massVolumeStory(r);
  }
  throw new Error(`Unknown attribute template: ${templateId}`);
}

export function generateAttributeProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = attributeTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown attribute template: ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const d = draft(templateId, r);
  const base = {
    id: createHash("sha256")
      .update(JSON.stringify([templateId, 1, seed]))
      .digest("hex"),
    templateId,
    templateVersion: 1 as const,
    seed,
    prompt: d.prompt,
    skillId: meta.skillId,
    ...(d.figure ? { figure: d.figure } : {}),
  };
  if (!d.choices)
    return {
      public: { ...base, response: { kind: "number", label: "Answer" } },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  const choices = d.ordered ? d.choices : shuffle(r, [...d.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((c, index) => {
    const optionId = `option-${"abcd"[index]}`;
    if (c.correct) answer = optionId;
    else choiceFeedback[optionId] = c.feedback!;
    return { id: optionId, label: c.label };
  });
  return {
    public: {
      ...base,
      response: { kind: "choice", label: "Choose one answer", options },
    },
    answer,
    explanation: d.explanation,
    hint: d.hint,
    choiceFeedback,
  };
}
