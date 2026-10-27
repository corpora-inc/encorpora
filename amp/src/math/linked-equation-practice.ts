import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";

export const linkedDivisionTemplate: TemplateMetadata = {
  id: "linked-division-equations",
  version: 1,
  title: "Choose the linked equations for a two-step sharing story",
  skillId: "multiplicative-stories",
  gradeBand: "3–5",
  difficultyOffset: 0.45,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the pair of linked equations, or the one combined equation, for a story that halves or shares a total equally and then shares or multiplies the part.",
};
export const linkedTimeTemplate: TemplateMetadata = {
  id: "linked-time-equations",
  version: 1,
  title: "Choose the linked equations for a time-remaining story",
  skillId: "two-step-stories",
  gradeBand: "3–5",
  difficultyOffset: 0.35,
  requiredResponseCapability: "single-choice-v1",
  description:
    "Choose the pair of linked equations, or the one combined equation, that finds the time remaining after two periods have passed, within 100 minutes.",
};

const axes = {
  form: defineAxis("form", ["linked-pair", "single-equation"] as const),
};

type Op = "+" | "-" | "\\times" | "\\div";
/** Two steps: `A op1 B = a`, then `a op2 C = r` (or `C op2 a = r`). */
interface Steps {
  a: number;
  op1: Op;
  b: number;
  op2: Op;
  c: number;
  aFirst: boolean;
}
const render = (
  s: Steps,
  form: "linked-pair" | "single-equation",
  unknown: string,
  mid: string,
) => {
  const first = `${s.a}${s.op1}${s.b}`;
  if (form === "single-equation")
    return s.aFirst
      ? `$(${first})${s.op2}${s.c}=${unknown}$`
      : `$${s.c}${s.op2}(${first})=${unknown}$`;
  return s.aFirst
    ? `$${first}=${mid}$ and $${mid}${s.op2}${s.c}=${unknown}$`
    : `$${first}=${mid}$ and $${s.c}${s.op2}${mid}=${unknown}$`;
};
interface StoryDef {
  correct: Steps;
  wrong: { steps: Steps; feedback: string }[];
  prompt: string;
  unknown: string;
  mid: string;
  hint: string;
  explanation: string[];
}

/* ------------------------------------------------ sharing stories */
interface DivisionModel {
  kind: "half-then-share" | "share-then-multiply";
  total: number;
  groups: number; // teams / vases
  more: number; // halves are 2; vases counted in multiply step
  context: number;
}
const halfStories = [
  {
    whole: "A class",
    people: "students",
    part: "teams",
    unit: "students on each team",
    sep: "split into two equal groups",
  },
  {
    whole: "A club",
    people: "members",
    part: "tables",
    unit: "members at each table",
    sep: "split into two equal groups",
  },
] as const;
const vaseStories = [
  { item: "flowers", holder: "vases", unit: "flowers" },
  { item: "pencils", holder: "cups", unit: "pencils" },
  { item: "stickers", holder: "pages", unit: "stickers" },
] as const;
function divisionModel(r: (lo: number, hi: number) => number): DivisionModel {
  const kind = pick(r, ["half-then-share", "share-then-multiply"] as const);
  if (kind === "half-then-share") {
    const groups = r(2, 6);
    const each = r(2, 9);
    return {
      kind,
      total: 2 * groups * each,
      groups,
      more: each,
      context: r(0, halfStories.length - 1),
    };
  }
  const holders = r(3, 9);
  const per = r(2, 9);
  return {
    kind,
    total: holders * per,
    groups: holders,
    more: r(2, holders - 1),
    context: r(0, vaseStories.length - 1),
  };
}
const divisionDef = (
  m: DivisionModel,
  form: "linked-pair" | "single-equation",
): StoryDef => {
  if (m.kind === "half-then-share") {
    const c = halfStories[m.context]!;
    const half = m.total / 2;
    const correct: Steps = {
      a: m.total,
      op1: "\\div",
      b: 2,
      op2: "\\div",
      c: m.groups,
      aFirst: true,
    };
    return {
      correct,
      wrong: [
        {
          steps: { ...correct, op1: "\\times" },
          feedback:
            "Splitting into two equal groups divides the total by 2. This multiplies instead.",
        },
        {
          steps: { ...correct, op2: "\\times" },
          feedback:
            "Sharing a group equally among teams divides again. This multiplies the group size instead.",
        },
        {
          steps: { ...correct, op1: "-" },
          feedback:
            "Splitting into two equal groups divides the total by 2. Taking 2 away does not split it.",
        },
        {
          steps: { ...correct, op2: "-" },
          feedback:
            "Sharing equally is division. Subtracting the number of teams does not share the group.",
        },
      ],
      prompt: `${c.whole} of ${m.total} ${c.people} is ${c.sep}. Each group is then shared equally among ${m.groups} ${c.part}. How many ${c.unit}? Let $a$ be the number in each group and $t$ the answer.`,
      unknown: "t",
      mid: "a",
      hint: `Start with the first split: the ${m.total} ${c.people} are divided into 2 equal groups. Write a division equation for the size of one group before you use ${m.groups}.`,
      explanation: [
        `Split ${m.total} into 2 equal groups: $${m.total}\\div2=${half}$ in each group, so $a=${half}$.`,
        `Share one group equally among ${m.groups} ${c.part}: $${half}\\div${m.groups}=${half / m.groups}$.`,
        `${form === "linked-pair" ? "The linked equations are" : "The combined equation is"} ${render(correct, form, "t", "a")}, and the answer is ${half / m.groups}.`,
      ],
    };
  }
  const c = vaseStories[m.context]!;
  const per = m.total / m.groups;
  const correct: Steps = {
    a: m.total,
    op1: "\\div",
    b: m.groups,
    op2: "\\times",
    c: m.more,
    aFirst: true,
  };
  return {
    correct,
    wrong: [
      {
        steps: { ...correct, op1: "\\times" },
        feedback: `Sharing ${m.total} ${c.item} equally among ${m.groups} ${c.holder} divides. This multiplies instead.`,
      },
      {
        steps: { ...correct, op2: "\\div" },
        feedback: `Finding the ${c.item} in ${m.more} ${c.holder} multiplies the amount in one by ${m.more}. This divides instead.`,
      },
      {
        steps: {
          a: m.total,
          op1: "\\div",
          b: m.more,
          op2: "\\times",
          c: m.groups,
          aFirst: true,
        },
        feedback: `The total is shared among ${m.groups} ${c.holder}, not ${m.more}. The two numbers are in the wrong steps.`,
      },
      {
        steps: { ...correct, op2: "+" },
        feedback: `The ${m.more} ${c.holder} each hold the same amount, so the total is a multiple, found by multiplying, not adding ${m.more}.`,
      },
    ],
    prompt: `${m.total} ${c.item} are shared equally among ${m.groups} ${c.holder}. How many ${c.item} are in ${m.more} of the ${c.holder}? Let $v$ be the number in one of the ${c.holder} and $f$ the answer.`,
    unknown: "f",
    mid: "v",
    hint: `First find how many ${c.item} go in one of the ${c.holder}: ${m.total} shared equally among ${m.groups}. Write that division before you use ${m.more}.`,
    explanation: [
      `Share equally: $${m.total}\\div${m.groups}=${per}$ in one of the ${c.holder}, so $v=${per}$.`,
      `Multiply by the number of ${c.holder} asked about: $${per}\\times${m.more}=${per * m.more}$.`,
      `${form === "linked-pair" ? "The linked equations are" : "The combined equation is"} ${render(correct, form, "f", "v")}, and the answer is ${per * m.more}.`,
    ],
  };
};

export const linkedDivision = chainFamily({
  template: linkedDivisionTemplate,
  axes,
  model: divisionModel,
  variant: (m) => m.kind,
  render: (m, ax, r) => {
    const def = divisionDef(m, ax.form);
    const options: ChoiceOption[] = [
      {
        label: render(def.correct, ax.form, def.unknown, def.mid),
        correct: true,
      },
      ...def.wrong.map((w) => ({
        label: render(w.steps, ax.form, def.unknown, def.mid),
        feedback: w.feedback,
      })),
    ];
    return choiceSurface(r, {
      prompt: `${def.prompt} Which ${ax.form === "linked-pair" ? "pair of equations" : "equation"} finds the answer?`,
      options,
      hint: def.hint,
      explanation: def.explanation,
    });
  },
});

/* ------------------------------------------------------ time stories */
interface TimeModel {
  total: number;
  first: number;
  second: number;
  context: number;
}
const timeStories = [
  {
    thing: "A movie",
    unit: "minutes",
    first: "The first part lasts",
    second: "the second part lasts",
    what: "minutes of the movie are left",
  },
  {
    thing: "A class period",
    unit: "minutes",
    first: "The teacher talks for",
    second: "then the students work for",
    what: "minutes of the class period are left",
  },
  {
    thing: "A practice session",
    unit: "minutes",
    first: "The team warms up for",
    second: "then plays for",
    what: "minutes of the session are left",
  },
] as const;
function timeModel(r: (lo: number, hi: number) => number): TimeModel {
  const total = 5 * r(10, 20);
  const first = r(10, Math.floor(total / 2) - 2);
  const second = r(8, total - first - 5);
  return { total, first, second, context: r(0, timeStories.length - 1) };
}
export const linkedTime = chainFamily({
  template: linkedTimeTemplate,
  axes,
  model: timeModel,
  variant: () => "time-remaining",
  render: (m, ax, r) => {
    const c = timeStories[m.context]!;
    const correct: Steps = {
      a: m.total,
      op1: "-",
      b: m.first,
      op2: "-",
      c: m.second,
      aFirst: true,
    };
    const remaining = m.total - m.first - m.second;
    const wrongs: { steps: Steps; feedback: string }[] = [
      {
        steps: { ...correct, op1: "+" },
        feedback: `Time that has passed is taken away from the total. This adds ${m.first} to ${m.total}.`,
      },
      {
        steps: { ...correct, op2: "+" },
        feedback: `Both ${m.first} and ${m.second} minutes have passed, so both come off the total. This adds ${m.second} back.`,
      },
      {
        steps: {
          a: m.first,
          op1: "+",
          b: m.second,
          op2: "-",
          c: m.total,
          aFirst: true,
        },
        feedback: `The time left is the total minus the time passed. This subtracts the total from the time passed.`,
      },
      {
        steps: {
          a: m.total,
          op1: "-",
          b: m.first,
          op2: "-",
          c: m.first,
          aFirst: true,
        },
        feedback: `The second subtraction should use ${m.second} minutes. This subtracts ${m.first} twice.`,
      },
    ];
    return choiceSurface(r, {
      prompt: `${c.thing} is ${m.total} minutes long. ${c.first} ${m.first} minutes and ${c.second} ${m.second} minutes. How many ${c.what}? Let $a$ be the minutes left after the first part and $m$ the answer. Which ${ax.form === "linked-pair" ? "pair of equations" : "equation"} finds the answer?`,
      options: [
        { label: render(correct, ax.form, "m", "a"), correct: true },
        ...wrongs.map((w) => ({
          label: render(w.steps, ax.form, "m", "a"),
          feedback: w.feedback,
        })),
      ],
      hint: `Start with the whole ${m.total} minutes. The first ${m.first} minutes have passed, so write the subtraction that gives the minutes left after that part.`,
      explanation: [
        `After the first part, $${m.total}-${m.first}=${m.total - m.first}$ minutes are left, so $a=${m.total - m.first}$.`,
        `The second part uses ${m.second} minutes: $${m.total - m.first}-${m.second}=${remaining}$.`,
        `${ax.form === "linked-pair" ? "The linked equations are" : "The combined equation is"} ${render(correct, ax.form, "m", "a")}, so ${remaining} minutes are left.`,
      ],
    });
  },
});

export const linkedEquationTemplates = [
  linkedDivisionTemplate,
  linkedTimeTemplate,
] as const;
export const linkedEquationGenerate = dispatch(linkedEquationTemplates, {
  "linked-division-equations": (seed) => linkedDivision.generate(seed).problem,
  "linked-time-equations": (seed) => linkedTime.generate(seed).problem,
});
