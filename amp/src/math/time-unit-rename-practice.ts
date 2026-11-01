import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, dispatch, numberSurface, pick } from "./chain-kit";

export const timeUnitRenameTemplate: TemplateMetadata = {
  id: "rename-time-units",
  version: 1,
  title: "Hours, minutes and other time units",
  skillId: "unit-conversion",
  gradeBand: "3–5",
  difficultyOffset: -0.2,
  description:
    "Rename a whole number of hours, days, weeks or years as minutes, hours, days or months, rename minutes as hours or days as weeks, or rename hours and minutes together as minutes.",
};

interface Pair {
  big: string;
  bigOne: string;
  small: string;
  smallOne: string;
  per: number;
  /** Counts of the larger unit used for rename-to-smaller. */
  counts: readonly [number, number];
}
const pairs: readonly Pair[] = [
  {
    big: "hours",
    bigOne: "hour",
    small: "minutes",
    smallOne: "minute",
    per: 60,
    counts: [2, 9],
  },
  {
    big: "minutes",
    bigOne: "minute",
    small: "seconds",
    smallOne: "second",
    per: 60,
    counts: [2, 9],
  },
  {
    big: "days",
    bigOne: "day",
    small: "hours",
    smallOne: "hour",
    per: 24,
    counts: [2, 9],
  },
  {
    big: "weeks",
    bigOne: "week",
    small: "days",
    smallOne: "day",
    per: 7,
    counts: [2, 12],
  },
  {
    big: "years",
    bigOne: "year",
    small: "months",
    smallOne: "month",
    per: 12,
    counts: [2, 9],
  },
];

const axes = {
  ask: defineAxis("ask", [
    "to-smaller",
    "to-larger",
    "hours-and-minutes",
  ] as const),
};
interface Model {
  ask: "to-smaller" | "to-larger" | "hours-and-minutes";
  pair: Pair;
  count: number;
  extra: number;
}
const model = (
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"] },
): Model => {
  if (a.ask === "hours-and-minutes")
    return {
      ask: a.ask,
      pair: pairs[0]!,
      count: r(1, 5),
      extra: 5 * r(1, 11),
    };
  const pair = pick(r, pairs);
  const count = r(pair.counts[0], pair.counts[1]);
  // In the to-larger form the learner divides, so the answer must not equal
  // the number of small units in one large unit that the hint names.
  if (a.ask === "to-larger" && count === pair.per)
    throw new Error("Need three retries");
  return { ask: a.ask, pair, count, extra: 0 };
};

export const timeUnitRenameFamily = chainFamily({
  template: timeUnitRenameTemplate,
  axes,
  model,
  variant: (m) => `${m.ask}-${m.pair.big}`,
  render: (m) => {
    const { pair: p, count: n } = m;
    if (m.ask === "hours-and-minutes") {
      const total = 60 * n + m.extra;
      return numberSurface({
        prompt: `A movie lasts ${n} ${n === 1 ? "hour" : "hours"} and ${m.extra} minutes. How many minutes long is the movie?`,
        answer: String(total),
        hint: `There are 60 minutes in each hour. Rename the ${n} ${n === 1 ? "hour" : "hours"} as minutes first, then add the ${m.extra} minutes.`,
        explanation: [
          `The question asks for minutes, so write the hours as minutes too. Then everything is in one unit.`,
          `One hour is 60 minutes, so ${n} ${n === 1 ? "hour is" : "hours are"} $${n}\\times60=${60 * n}$ minutes.`,
          `The movie also lasts ${m.extra} more minutes, so add them: $${60 * n}+${m.extra}=${total}$.`,
          `The movie is ${total} minutes long.`,
        ],
        label: "Answer (minutes)",
      });
    }
    if (m.ask === "to-smaller") {
      const total = n * p.per;
      return numberSurface({
        prompt: `How many ${p.small} are in ${n} ${p.big}?`,
        answer: String(total),
        hint: `There are ${p.per} ${p.small} in 1 ${p.bigOne}. You have ${n} ${p.big}, which is ${n} groups of ${p.per}.`,
        explanation: [
          `Each ${p.bigOne} is ${p.per} ${p.small}.`,
          `${p.small[0]!.toUpperCase()}${p.small.slice(1)} are the smaller unit, so there are more of them. Multiply.`,
          `${n} ${p.big} is ${n} groups of ${p.per}: $${n}\\times${p.per}=${total}$.`,
          `${n} ${p.big} is ${total} ${p.small}.`,
        ],
        label: `Answer (${p.small})`,
      });
    }
    const total = n * p.per;
    return numberSurface({
      prompt: `How many ${p.big} are in ${total} ${p.small}?`,
      answer: String(n),
      hint: `There are ${p.per} ${p.small} in 1 ${p.bigOne}. Find how many groups of ${p.per} fit into ${total}.`,
      explanation: [
        `Each ${p.bigOne} is ${p.per} ${p.small}.`,
        `${p.big[0]!.toUpperCase()}${p.big.slice(1)} are the bigger unit, so there are fewer of them. Count the groups of ${p.per} in ${total} by dividing.`,
        `$${total}\\div${p.per}=${n}$, because $${n}\\times${p.per}=${total}$.`,
        `${total} ${p.small} is ${n} ${p.big}.`,
      ],
      label: `Answer (${p.big})`,
    });
  },
});

export const timeUnitRenameTemplates = [timeUnitRenameTemplate] as const;
export const timeUnitRenameGenerate = dispatch(timeUnitRenameTemplates, {
  "rename-time-units": (seed) => timeUnitRenameFamily.generate(seed).problem,
});
