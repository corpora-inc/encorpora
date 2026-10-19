import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { CENTS, type MoneyItem } from "./time-money-models";

type Response = "choice" | "number";
// id | title | skill | response | description
const rows = `
read-clock-hour-half|Read hours and half hours|clock-half-hours|choice|Read an analog clock showing a time on the hour or half hour.
clock-hour-read|Name the hour|clock-half-hours|number|Name the hour of an analog clock on the hour or at half past, where the hour hand sits between two numerals.
match-clock-half-hour|Find the clock for a time|clock-half-hours|choice|Pick the analog clock that shows a written time on the hour or half hour.
read-clock-five-minutes|Read a clock to five minutes|clock-five-minutes|choice|Read an analog clock showing a time in five-minute steps.
minutes-past-hour|Count minutes by fives|clock-five-minutes|number|Count the minutes past the hour shown by the minute hand in five-minute steps.
clock-am-pm|Morning or evening time|clock-five-minutes|choice|Read an analog clock to five minutes and choose a.m. or p.m. from a daily activity.
match-clock-five-minutes|Match a written time to a clock|clock-five-minutes|choice|Pick the analog clock that shows a written time in five-minute steps.
coin-total|Count coins|money-values|number|Find the value in cents of up to eight quarters, dimes, nickels and pennies.
money-total-dollars|Count bills and coins|money-values|number|Find the value in dollars of one-dollar and five-dollar bills with coins.
make-a-dollar|Make one dollar|money-values|number|Find how many more cents a group of coins needs to make one dollar.
pay-exact-coins|Pay an exact amount|money-values|choice|Pick the group of coins worth exactly a given price.
money-left-story|Money left after buying|money-values|number|Count a group of coins, then subtract a price in cents.
`;
const definitions = rows
  .trim()
  .split("\n")
  .map((row) => {
    const [id, title, skillId, response, description] = row.split("|") as [
      string,
      string,
      string,
      Response,
      string,
    ];
    return { id, title, skillId, response, description };
  });
export const timeMoneyTemplates: readonly TemplateMetadata[] = definitions.map(
  ({ id, title, skillId, response, description }) => ({
    id,
    version: 1,
    title,
    skillId,
    gradeBand: "K–2",
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

// ---- Time --------------------------------------------------------------
const pad = (m: number) => String(m).padStart(2, "0");
export const clockTime = (h: number, m: number) => `${h}:${pad(m)}`;
const next = (h: number) => (h % 12) + 1;
/** The numeral the minute hand points at (12 for zero minutes). */
const numeral = (m: number) => (m === 0 ? 12 : m / 5);

type Misread = { label: string; feedback: string };
/** Wrong readings that real learners give, most diagnostic first. */
function misreadings(h: number, m: number): Misread[] {
  const t = clockTime(h, m);
  const swappedHour = numeral(m),
    swappedMinute = (h % 12) * 5;
  const out: Misread[] = [];
  const nextHour = {
    label: clockTime(next(h), m),
    feedback: `The hour hand has moved past ${h} but has not reached ${next(h)}. Until it reaches ${next(h)}, the hour is still ${h}.`,
  };
  const pointed = {
    label: `${h}:${pad(numeral(m))}`,
    feedback: `The minute hand points at ${numeral(m)}, but each numeral marks 5 minutes. Count by fives from 12: ${m === 0 ? "pointing at 12 means 0 minutes" : `${numeral(m)} × 5 = ${m} minutes`}.`,
  };
  const swapped = {
    label: clockTime(swappedHour, swappedMinute),
    feedback:
      "This reads the hands the other way round. The short hand shows the hour; the long hand shows the minutes.",
  };
  const half = {
    label: clockTime(h, m === 0 ? 30 : 0),
    feedback:
      m === 0
        ? "At half past, the minute hand points at 6. Here it points at 12, so it is exactly on the hour."
        : "On the hour, the minute hand points at 12. Here it points at 6, so it is half past.",
  };
  const offFive = {
    label: clockTime(h, m + 5 < 60 ? m + 5 : m - 5),
    feedback: `Count the minutes by fives from 12 to the minute hand: 5, 10, 15 … ${m}.`,
  };
  if (m >= 30) out.push(nextHour, pointed, swapped, offFive, half);
  else if (m === 0) out.push(swapped, pointed, half, nextHour);
  else out.push(pointed, swapped, offFive, half);
  const seen = new Set([t]);
  return out.filter((x) => !seen.has(x.label) && seen.add(x.label));
}
function readClockSteps(h: number, m: number): string[] {
  return [
    m === 0
      ? "The long minute hand points at 12: 0 minutes past the hour."
      : `The long minute hand points at ${numeral(m)}. Counting by fives from 12, that is ${m} minutes past the hour.`,
    m === 0
      ? `The short hour hand points at ${h}, so the hour is ${h}.`
      : `The short hour hand is past ${h} and not yet at ${next(h)}, so the hour is ${h}.`,
    `The time is ${clockTime(h, m)}${m === 0 ? `, ${h} o'clock` : m === 30 ? `, half past ${h}` : ""}.`,
  ];
}

type Choice = { label: string; correct?: true; feedback?: string };
type Draft = {
  prompt: string;
  hint: string;
  explanation: string[];
  figure?: SemanticFigure;
  answer?: string;
  choices?: Choice[];
  ordered?: boolean;
  responseLabel?: string;
};
const single = (h: number, m: number): SemanticFigure => ({
  kind: "analog-clocks",
  clocks: [{ hour: h, minute: m }],
});

function readClock(h: number, m: number, options: number): Draft {
  return {
    prompt: "What time does the clock show?",
    hint:
      options === 3
        ? m === 0
          ? "The long hand points at 12, so the time is on the hour. Which numeral does the short hand point at?"
          : "The long hand points at 6, so it is half past. Which numeral has the short hand just passed?"
        : `The long hand points at ${numeral(m)}: count by fives from 12 to ${numeral(m)}. Then name the last numeral the short hand has passed.`,
    figure: single(h, m),
    explanation: readClockSteps(h, m),
    choices: [
      { label: clockTime(h, m), correct: true },
      ...misreadings(h, m).slice(0, options - 1),
    ],
  };
}
function matchClock(r: Random, h: number, m: number): Draft {
  const key = (x: [number, number]) => `${x[0]}:${x[1]}`;
  const candidates: [number, number, string][] = [
    m === 0
      ? [h, 30, "shows half past: its minute hand points at 6"]
      : [
          next(h),
          m,
          `has its hour hand past ${next(h)}, so it shows ${clockTime(next(h), m)}`,
        ],
    [numeral(m), (h % 12) * 5, "has the hands the other way round"],
    [h, (m + 30) % 60, `has its minute hand at ${numeral((m + 30) % 60)}`],
    [next(next(h)), m, `shows ${clockTime(next(next(h)), m)}`],
  ];
  const seen = new Set([key([h, m])]);
  const wrong = candidates
    .filter(([a, b]) => {
      const k = key([a, b]);
      return !seen.has(k) && seen.add(k);
    })
    .slice(0, 2);
  const clocks = shuffle(r, [
    { hour: h, minute: m, why: "" },
    ...wrong.map(([hour, minute, why]) => ({ hour, minute, why })),
  ]);
  const labels = ["A", "B", "C"] as const;
  const t = clockTime(h, m);
  return {
    prompt: `Which clock shows ${t}?`,
    hint: `For ${t}, the long hand points at ${numeral(m)} and the short hand is ${m === 0 ? `on ${h}` : `between ${h} and ${next(h)}`}.`,
    figure: {
      kind: "analog-clocks",
      clocks: clocks.map(({ hour, minute }, i) => ({
        hour,
        minute,
        label: labels[i],
      })),
    },
    explanation: [
      m === 0
        ? `${t} is ${h} o'clock: the long minute hand points at 12.`
        : `${t} is ${m} minutes past ${h}: the long minute hand points at ${numeral(m)}, because ${numeral(m)} × 5 = ${m}.`,
      m === 0
        ? `The short hour hand points exactly at ${h}.`
        : `The short hour hand has moved past ${h} toward ${next(h)}.`,
      `Clock ${labels[clocks.findIndex((c) => !c.why)]} shows both.`,
    ],
    ordered: true,
    choices: clocks.map((c, i) =>
      c.why
        ? {
            label: `Clock ${labels[i]}`,
            feedback: `Clock ${labels[i]} ${c.why}. ${t} needs the long hand at ${numeral(m)} and the short hand ${m === 0 ? `on ${h}` : `just past ${h}`}.`,
          }
        : { label: `Clock ${labels[i]}`, correct: true },
    ),
  };
}

const NAMES = ["Maya", "Sam", "Lena", "Omar", "Priya", "Leo", "Ana", "Kofi"];
const ACTIVITIES: [string, number, number, "a.m." | "p.m.", string][] = [
  ["wakes up for school", 6, 7, "a.m.", "morning"],
  ["eats breakfast", 7, 8, "a.m.", "morning"],
  ["walks to school", 7, 8, "a.m.", "morning"],
  ["eats an after-school snack", 3, 4, "p.m.", "afternoon"],
  ["plays at the park after school", 3, 5, "p.m.", "afternoon"],
  ["eats dinner", 5, 6, "p.m.", "evening"],
  ["goes to bed", 7, 8, "p.m.", "evening"],
];
function amPm(r: Random): Draft {
  const [activity, lo, hi, period, part] = pick(r, ACTIVITIES);
  const h = r(lo, hi),
    m = 5 * r(0, 11),
    name = pick(r, NAMES);
  const other = period === "a.m." ? "p.m." : "a.m.";
  const t = clockTime(h, m);
  const wrongs = misreadings(h, m).slice(0, 2);
  return {
    prompt: `${name} ${activity} at the time on the clock. Which time is it?`,
    hint: `Is the time when ${name} ${activity} before noon or after noon? Read the clock too: the long hand is at ${numeral(m)}.`,
    figure: single(h, m),
    explanation: [
      ...readClockSteps(h, m).slice(0, 2),
      `a.m. times run from midnight to noon; p.m. times run from noon to midnight. ${name} ${activity} in the ${part}, so the time is ${t} ${period}.`,
    ],
    choices: [
      { label: `${t} ${period}`, correct: true },
      {
        label: `${t} ${other}`,
        feedback: `${t} ${other} is in the ${other === "a.m." ? "night or early morning, before noon" : "afternoon or evening, after noon"}. ${name} ${activity} in the ${part}.`,
      },
      ...wrongs.map((w) => ({
        label: `${w.label} ${period}`,
        feedback: w.feedback,
      })),
    ],
  };
}

// ---- Money -------------------------------------------------------------
const COIN_NAMES: Record<MoneyItem, [string, string]> = {
  five: ["five-dollar bill", "five-dollar bills"],
  dollar: ["one-dollar bill", "one-dollar bills"],
  quarter: ["quarter", "quarters"],
  dime: ["dime", "dimes"],
  nickel: ["nickel", "nickels"],
  penny: ["penny", "pennies"],
};
const COINS: MoneyItem[] = ["quarter", "dime", "nickel", "penny"];
const ORDER: MoneyItem[] = [
  "five",
  "dollar",
  "quarter",
  "dime",
  "nickel",
  "penny",
];
const total = (items: readonly MoneyItem[]) =>
  items.reduce((sum, item) => sum + CENTS[item], 0);
const named = (n: number, item: MoneyItem) =>
  `${n} ${COIN_NAMES[item][n === 1 ? 0 : 1]}`;
const cents = (n: number) => `${n}¢`;
const count = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
/** "2 quarters (50¢), 1 dime (10¢)" from largest to smallest. */
function groups(items: readonly MoneyItem[]) {
  return ORDER.filter((item) => items.includes(item)).map((item) => {
    const n = items.filter((x) => x === item).length;
    return { item, n, value: n * CENTS[item] };
  });
}
/** Count on from the largest value: 25, 50, 60, 65, 66. */
export function countOn(items: readonly MoneyItem[]): number[] {
  const sorted = [...items].sort((a, b) => CENTS[b] - CENTS[a]);
  let running = 0;
  return sorted.map((item) => (running += CENTS[item]));
}
function coinSteps(items: readonly MoneyItem[]) {
  const g = groups(items);
  return [
    `Start with the coins worth the most: ${g.map(({ item, n }) => (n === 1 ? `${named(n, item)} (${cents(CENTS[item])})` : `${named(n, item)} at ${cents(CENTS[item])} each`)).join(", ")}.`,
    `Count on: ${countOn(items).join(", ")}.`,
  ];
}
function randomCoins(r: Random, count: number, max: number): MoneyItem[] {
  for (;;) {
    const items = Array.from({ length: count }, () => pick(r, COINS));
    if (total(items) <= max && new Set(items).size >= 2) return items;
  }
}
/** A random decomposition of `value` cents into at most `limit` coins. */
function coinsFor(r: Random, value: number, limit = 9): MoneyItem[] {
  for (;;) {
    const items: MoneyItem[] = [];
    let left = value;
    while (left > 0 && items.length < limit) {
      const fits = COINS.filter(
        (c) => CENTS[c] <= left && (c !== "penny" || left % 5 !== 0),
      );
      const item = pick(r, fits);
      items.push(item);
      left -= CENTS[item];
    }
    if (left === 0 && items.length >= 2) return items;
  }
}
const coinFigure = (items: MoneyItem[]): SemanticFigure => ({
  kind: "money-sets",
  sets: [{ items }],
});
const ITEMS = ["pencil", "sticker", "eraser", "bookmark", "pear", "toy car"];

function payExact(r: Random): Draft {
  const price = 5 * r(4, 19) + (r(0, 3) === 0 ? r(1, 4) : 0);
  const thing = pick(r, ITEMS);
  const correct = coinsFor(r, price);
  // A nickel-dime mix-up: the most common coin confusion.
  const swapAt = correct.findIndex((c) => c === "dime" || c === "nickel");
  const confused = [...correct];
  let confusion = "";
  if (swapAt >= 0) {
    const was = confused[swapAt]!;
    confused[swapAt] = was === "dime" ? "nickel" : "dime";
    confusion = `a ${confused[swapAt]} where a ${was} is needed: a dime is 10¢ and a nickel is 5¢`;
  } else {
    const q = correct.indexOf("quarter");
    confused[q >= 0 ? q : 0] = "dime";
    confusion =
      "a dime where a quarter is needed: a quarter is 25¢ and a dime is 10¢";
  }
  let near: MoneyItem[];
  do {
    near = coinsFor(r, price + pick(r, [-10, -5, 5, 10, 15]));
  } while (total(near) === price || total(near) === total(confused));
  const sets = shuffle(r, [
    { items: correct, why: "" },
    { items: confused, why: `uses ${confusion}` },
    { items: near, why: "" },
  ]);
  const labels = ["A", "B", "C"] as const;
  const right = labels[sets.findIndex((s) => s.items === correct)];
  return {
    prompt: `A ${thing} costs ${cents(price)}. Which set of coins is worth exactly ${cents(price)}?`,
    hint: `Count each set on from its largest coin and look for a total of exactly ${cents(price)}.`,
    figure: {
      kind: "money-sets",
      sets: sets.map((s, i) => ({ items: s.items, label: labels[i] })),
    },
    explanation: [
      ...sets.map(
        (s, i) =>
          `Set ${labels[i]}: ${countOn(s.items).join(", ")}. It is worth ${cents(total(s.items))}.`,
      ),
      `Only Set ${right} is worth exactly ${cents(price)}.`,
    ],
    ordered: true,
    choices: sets.map((s, i) =>
      s.items === correct
        ? { label: `Set ${labels[i]}`, correct: true }
        : {
            label: `Set ${labels[i]}`,
            feedback: `Set ${labels[i]} is worth ${cents(total(s.items))}, not ${cents(price)}.${s.why ? ` It ${s.why}.` : ""}`,
          },
    ),
  };
}

function draft(templateId: string, r: Random): Draft {
  switch (templateId) {
    case "read-clock-hour-half":
      return readClock(r(1, 12), pick(r, [0, 30]), 3);
    case "read-clock-five-minutes":
      return readClock(r(1, 12), 5 * r(1, 11), 4);
    case "match-clock-half-hour":
      return matchClock(r, r(1, 12), pick(r, [0, 30]));
    case "match-clock-five-minutes":
      return matchClock(r, r(1, 12), 5 * r(1, 11));
    case "clock-am-pm":
      return amPm(r);
    case "clock-hour-read": {
      const h = r(1, 12),
        m = pick(r, [0, 30]);
      return {
        prompt:
          m === 0
            ? "The clock shows a time on the hour. What hour is it?"
            : "The clock shows half past an hour. Half past what hour?",
        hint:
          m === 0
            ? "The long hand points straight up, so it is exactly on the hour. Read the numeral the short hand points at."
            : "The long hand points straight down: half past. The short hand sits between two numerals; the hour is the one it has passed.",
        figure: single(h, m),
        explanation: [
          m === 0
            ? "The long minute hand points at 12, so the time is on the hour."
            : "The long minute hand points at 6, so the time is half past an hour.",
          m === 0
            ? `The short hour hand points at ${h}.`
            : `The short hour hand is halfway between ${h} and ${next(h)}. It has passed ${h} but not reached ${next(h)}, so it is half past ${h}.`,
        ],
        answer: `${h}`,
        responseLabel: "Hour",
      };
    }
    case "minutes-past-hour": {
      const h = r(1, 12),
        m = 5 * r(1, 11);
      return {
        prompt: "How many minutes past the hour does the clock show?",
        hint: `The long hand points at ${numeral(m)}. Count by fives from 12, one five for each numeral up to ${numeral(m)}.`,
        figure: single(h, m),
        explanation: [
          `The long minute hand points at ${numeral(m)}.`,
          `Each numeral is 5 more minutes: ${Array.from({ length: numeral(m) }, (_, i) => 5 * (i + 1)).join(", ")}.`,
          `The clock shows ${m} minutes past the hour.`,
        ],
        answer: `${m}`,
        responseLabel: "Minutes",
      };
    }
    case "coin-total": {
      const items = randomCoins(r, r(3, 8), 99);
      return {
        prompt: "How many cents are these coins worth in all?",
        hint: `Start with the ${COIN_NAMES[groups(items)[0]!.item][1]}, worth ${cents(CENTS[groups(items)[0]!.item])} each, and count on through the smaller coins.`,
        figure: coinFigure(items),
        explanation: [
          ...coinSteps(items),
          `The coins are worth ${cents(total(items))}.`,
        ],
        answer: `${total(items)}`,
        responseLabel: "Cents",
      };
    }
    case "money-total-dollars": {
      const bills = Array.from({ length: r(1, 3) }, () =>
        pick(r, ["dollar", "five"] as MoneyItem[]),
      );
      const coins = randomCoins(r, r(2, 5), 99);
      const items = shuffle(r, [...bills, ...coins]);
      const dollars = total(bills) / 100,
        c = total(coins);
      return {
        prompt:
          "How much money is shown? Enter the amount in dollars, such as 2.35.",
        hint: `There ${bills.length === 1 ? "is 1 bill" : `are ${bills.length} bills`} and ${count(coins.length, "coin")}. Add the bills in dollars, count the coins in cents, then write the amount like 2.35.`,
        figure: coinFigure(items),
        explanation: [
          `The bills: ${groups(bills)
            .map(({ item, n }) => named(n, item))
            .join(
              " and ",
            )} make ${dollars} ${dollars === 1 ? "dollar" : "dollars"}.`,
          `The coins: ${countOn(coins).join(", ")}, so ${cents(c)}.`,
          `${dollars} ${dollars === 1 ? "dollar" : "dollars"} and ${c} cents is written ${(total(items) / 100).toFixed(2)} dollars.`,
        ],
        answer: (total(items) / 100).toFixed(2),
        responseLabel: "Dollars",
      };
    }
    case "make-a-dollar": {
      const items = randomCoins(r, r(2, 7), 95);
      const t = total(items);
      return {
        prompt:
          "One dollar is 100 cents. How many more cents do these coins need to make one dollar?",
        hint: `Count on from the ${COIN_NAMES[groups(items)[0]!.item][1]} to find the total, then count up from that total to 100.`,
        figure: coinFigure(items),
        explanation: [
          ...coinSteps(items),
          `The coins are worth ${cents(t)}. From ${t} up to 100 is ${100 - t}: ${t} + ${100 - t} = 100.`,
        ],
        answer: `${100 - t}`,
        responseLabel: "Cents",
      };
    }
    case "money-left-story": {
      const items = randomCoins(r, r(3, 7), 99);
      const t = total(items);
      if (t < 20) return draft(templateId, r);
      const price = 5 * r(2, Math.floor((t - 1) / 5));
      const name = pick(r, NAMES),
        thing = pick(r, ITEMS);
      return {
        prompt: `${name} has these coins and buys a ${thing} for ${cents(price)}. How many cents does ${name} have left?`,
        hint: `Count ${name}'s coins first, then take away the ${cents(price)} for the ${thing}.`,
        figure: coinFigure(items),
        explanation: [
          ...coinSteps(items),
          `${name} has ${cents(t)}. Take away ${cents(price)}: ${t} − ${price} = ${t - price}.`,
          `${name} has ${cents(t - price)} left.`,
        ],
        answer: `${t - price}`,
        responseLabel: "Cents",
      };
    }
    case "pay-exact-coins":
      return payExact(r);
  }
  throw new Error(`Unknown time or money template: ${templateId}`);
}

export function generateTimeMoneyProblem(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const meta = timeMoneyTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown time or money template: ${templateId}`);
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
      public: {
        ...base,
        response: { kind: "number", label: d.responseLabel ?? "Answer" },
      },
      answer: d.answer!,
      explanation: d.explanation,
      hint: d.hint,
    };
  const choices = d.ordered ? d.choices : shuffle(r, [...d.choices]);
  let answer = "";
  const choiceFeedback: Record<string, string> = {};
  const options = choices.map((choice, index) => {
    const optionId = `option-${"abcd"[index]}`;
    if (choice.correct) answer = optionId;
    else choiceFeedback[optionId] = choice.feedback!;
    return { id: optionId, label: choice.label };
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
