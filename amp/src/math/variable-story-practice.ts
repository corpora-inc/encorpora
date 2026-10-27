import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { draw } from "./elementary-gap-kit";

export const variableSituationTemplate: TemplateMetadata = {
  id: "variable-in-situation",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "What can change?",
  skillId: "variable-expressions",
  gradeBand: "3–5",
  difficultyOffset: -1,
  description:
    "In a situation with a fixed rate or total, choose the one quantity that can change (a variable) or the one that stays the same (a constant).",
};
export const subtractionStoryTemplate: TemplateMetadata = {
  id: "story-for-subtraction-sentence",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "Which story fits the sentence?",
  skillId: "one-step-equations",
  gradeBand: "3–5",
  difficultyOffset: -0.9,
  description:
    "Choose the story that a subtraction sentence with an unknown result, change or start represents, against stories for the other unknowns and for addition.",
};

type R = (lo: number, hi: number) => number;

/* --------------------------------------------------------- variable */
interface Situation {
  setup: (a: number) => string;
  fixed: ((a: number) => string)[];
  changing: string[];
}
const situations: Situation[] = [
  {
    setup: (a) =>
      `Ana saves ${a} dollars every week and keeps a count of the weeks.`,
    fixed: [
      (a) => `The dollars Ana saves each week: ${a}`,
      () => "The number of days in a week: 7",
      () => "The number of cents in a dollar: 100",
    ],
    changing: [
      "The number of weeks Ana has been saving",
      "The total dollars Ana has saved so far",
      "The dollars Ana would still need for a bike",
    ],
  },
  {
    setup: (a) => `Sam reads ${a} pages every night, night after night.`,
    fixed: [
      (a) => `The pages Sam reads each night: ${a}`,
      () => "The number of hours in a day: 24",
      () => "The number of minutes in an hour: 60",
    ],
    changing: [
      "The number of nights Sam has been reading",
      "The total pages Sam has read so far",
      "The pages left to read in the book",
    ],
  },
  {
    setup: (a) =>
      `A teacher shares ${a} markers equally among the groups in a class.`,
    fixed: [
      (a) => `The number of markers the teacher has: ${a}`,
      () => "The number of days in a week: 7",
      () => "The number of months in a year: 12",
    ],
    changing: [
      "The number of groups in the class",
      "The number of markers each group gets",
      "The number of markers left over after sharing",
    ],
  },
];
const variableAxes = {
  asks: defineAxis("asks", ["variable", "constant"] as const),
};
interface VariableModel {
  asks: "variable" | "constant";
  situation: Situation;
  a: number;
  options: { label: string; correct: boolean; kind: "fixed" | "changing" }[];
}
export const variableInSituation = chainFamily({
  template: variableSituationTemplate,
  axes: variableAxes,
  model: (r: R, ax): VariableModel => {
    const situation = pick(r, situations);
    const a = r(3, 9);
    const wantChange = ax.asks === "variable";
    const target = wantChange
      ? pick(r, situation.changing)
      : pick(r, situation.fixed)(a);
    const others = wantChange
      ? draw(r, situation.fixed, 3).map((f) => f(a))
      : draw(r, situation.changing, 3);
    return {
      asks: ax.asks,
      situation,
      a,
      options: [
        {
          label: target,
          correct: true,
          kind: wantChange ? "changing" : "fixed",
        },
        ...others.map((label) => ({
          label,
          correct: false,
          kind: (wantChange ? "fixed" : "changing") as "fixed" | "changing",
        })),
      ],
    };
  },
  variant: (m) => m.asks,
  render: (m, _ax, r) =>
    choiceSurface(r, {
      prompt: `${m.situation.setup(m.a)} ${m.asks === "variable" ? "Which quantity can change, so it is a variable?" : "Which quantity stays the same, so it is a constant?"}`,
      options: m.options.map((o) =>
        o.correct
          ? { label: o.label, correct: true as const }
          : {
              label: o.label,
              feedback:
                o.kind === "fixed"
                  ? "This quantity stays the same however long the situation goes on, so it is a constant. A variable is a quantity that can take different values."
                  : "This quantity takes different values as the situation goes on, so it is a variable. A constant is a quantity that always stays the same.",
            },
      ),
      hint: `The number ${m.a} is part of the situation. Think about the story as it goes on: which of the four quantities would take a different value, and which would stay the same?`,
      explanation: [
        `A variable is a quantity that can change; a constant always has the same value.`,
        m.asks === "variable"
          ? `The other three quantities are set by the situation and do not change. "${m.options[0]!.label}" takes a new value as the story goes on.`
          : `"${m.options[0]!.label}" is set by the situation and does not change. The other three quantities take new values as the story goes on.`,
      ],
    }),
});

/* ------------------------------------------------ subtraction story */
const subjects = [
  { name: "Mia", thing: "stickers", gave: "gives away", has: "has" },
  { name: "Omar", thing: "marbles", gave: "loses", has: "has" },
  { name: "Lena", thing: "cards", gave: "trades away", has: "has" },
  { name: "Theo", thing: "pencils", gave: "gives away", has: "has" },
];
type Unknown = "result" | "change" | "start";
const storyAxes = {
  unknown: defineAxis("unknown", ["result", "change", "start"] as const),
};
interface StoryModel {
  unknown: Unknown;
  who: (typeof subjects)[number];
  /** start = taken + left. */
  start: number;
  taken: number;
  left: number;
}
export const subtractionStory = chainFamily({
  template: subtractionStoryTemplate,
  axes: storyAxes,
  model: (r: R, ax): StoryModel => {
    const taken = r(4, 19);
    const left = r(5, 30);
    if (taken === left) throw new Error("Need three retries");
    return {
      unknown: ax.unknown,
      who: pick(r, subjects),
      start: taken + left,
      taken,
      left,
    };
  },
  variant: (m) => m.unknown,
  render: (m, _ax, r) => {
    const { who, start, taken, left } = m;
    const T = who.thing;
    const stories: Record<Unknown | "sum", string> = {
      result: `${who.name} ${who.has} ${start} ${T} and ${who.gave} ${taken}. How many ${T} does ${who.name} have left?`,
      change: `${who.name} ${who.has} ${start} ${T}, ${who.gave} some, and has ${left} left. How many ${T} did ${who.name} give away?`,
      start: `${who.name} ${who.has} some ${T}, ${who.gave} ${taken}, and has ${left} left. How many ${T} did ${who.name} start with?`,
      sum: `${who.name} ${who.has} ${taken} ${T} and gets ${left} more. How many ${T} does ${who.name} have now?`,
    };
    const sentence: Record<Unknown, string> = {
      result: `$n=${start}-${taken}$`,
      change: `$${start}-n=${left}$`,
      start: `$n-${taken}=${left}$`,
    };
    const why: Record<Unknown | "sum", string> = {
      result: `the number left is the unknown: $${start}-${taken}$`,
      change: `the number taken away is the unknown: $${start}-n=${left}$`,
      start: `the starting number is the unknown: $n-${taken}=${left}$`,
      sum: `${who.name} adds, so the sentence is an addition: $${taken}+${left}=n$`,
    };
    const kinds: (Unknown | "sum")[] = ["result", "change", "start", "sum"];
    return choiceSurface(r, {
      prompt: `Which story is shown by the sentence ${sentence[m.unknown]}, where $n$ is the number we want to find?`,
      options: kinds.map((k) =>
        k === m.unknown
          ? { label: stories[k], correct: true as const }
          : {
              label: stories[k],
              feedback: `In this story ${why[k]}. The sentence ${sentence[m.unknown]} matches a different story.`,
            },
      ),
      hint: `Read ${sentence[m.unknown]} from left to right and say what each number would be in a story: where $n$ is, and which numbers are ${m.unknown === "result" ? `${start} and ${taken}` : m.unknown === "change" ? `${start} and ${left}` : `${taken} and ${left}`}. Then find the story that puts the same numbers in the same places.`,
      explanation: [
        `In ${sentence[m.unknown]}, ${m.unknown === "result" ? `${start} is the amount at the start, ${taken} is taken away and $n$ is what is left` : m.unknown === "change" ? `${start} is the amount at the start, $n$ is taken away and ${left} is what is left` : `$n$ is the amount at the start, ${taken} is taken away and ${left} is what is left`}.`,
        `The story that says so is: "${stories[m.unknown]}"`,
      ],
    });
  },
});

export const variableStoryTemplates = [
  variableSituationTemplate,
  subtractionStoryTemplate,
] as const;
export const variableStoryGenerate = dispatch(variableStoryTemplates, {
  "variable-in-situation": (seed) => variableInSituation.generate(seed).problem,
  "story-for-subtraction-sentence": (seed) =>
    subtractionStory.generate(seed).problem,
});
