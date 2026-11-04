import { count, isAre } from "./agreement";
import { storyName } from "./story-kit/names";
import {
  lengthJobs,
  liquidJobs,
  timeJobs,
  weightJobs,
} from "./story-kit/measurement";
import { surfaceStream, type Random } from "./variation/axes";

/** Story surfaces for grade-4 measurement and money.
 * The mathematical model stays on the content stream. Names, settings and
 * sentence frames come from this surface stream, so a plain (legacy) draw
 * is untouched. */

const cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;

export function formatClock(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
}

const hm = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${count(h, "hour")} ${count(m, "minute")}`;
  if (h) return count(h, "hour");
  return count(m, "minute");
};

/** True when `label` appears as its own clock time, not as the tail of
 * another time ("1:05 p.m." inside "11:05 p.m."). */
export function clockTimePresent(text: string, label: string): boolean {
  const escaped = label.replaceAll(".", "\\.");
  return new RegExp(`(?<!\\d)${escaped}`).test(text);
}

function stream(templateId: string, seed: string): Random {
  return surfaceStream(templateId, seed);
}

/* ------------------------------------------------------------------ */
/* Elapsed time                                                        */
/* ------------------------------------------------------------------ */

type Act = string;

/** Two camp blocks. Each can honestly last from about 10 minutes to 2 hours. */
const TWO_BLOCKS: readonly (readonly [Act, Act])[] = [
  ["basketball", "swimming"],
  ["painting", "clay modeling"],
  ["piano practice", "choir"],
  ["the museum visit", "the planetarium show"],
  ["coding club", "robotics"],
  ["reading", "a board game"],
  ["the nature hike", "bird watching"],
  ["art class", "a gallery walk"],
  ["the spelling game", "the math game"],
  ["dance practice", "the music block"],
];

const ONE_BLOCKS: readonly Act[] = [
  "the hike to the overlook",
  "soccer practice",
  "the video game",
  "the movie",
  "piano practice",
  "art class",
  "the bike ride",
  "science club",
  "dance practice",
  "the library visit",
  "the drive to the park",
  "rehearsal",
];

function addMinutes(from: number, minutes: number): string[] {
  const to = formatClock(from + minutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const fromMin = (((from % 1440) + 1440) % 1440) % 60;
  if (mins === 0)
    return [
      `Add ${hm(minutes)} to ${formatClock(from)} The minutes stay put and the hour moves ahead. The time is ${to}`,
    ];
  const sum = fromMin + mins;
  if (sum < 60) {
    const lines = [
      `Start at ${formatClock(from)} Add ${count(mins, "minute")} to ${fromMin} minutes: ${fromMin} + ${mins} = ${sum}.`,
    ];
    if (hours)
      lines.push(`Then add ${count(hours, "hour")}. The time is ${to}`);
    else lines.push(`The time is ${to}`);
    return lines;
  }
  const extra = Math.floor(sum / 60);
  const rem = sum % 60;
  const carry =
    rem === 0
      ? `${sum} minutes is exactly ${count(extra, "hour")}, so the clock crosses into the next hour.`
      : `${sum} minutes is ${count(extra, "hour")} and ${count(rem, "minute")}, so the clock crosses into the next hour.`;
  const lines = [
    `Start at ${formatClock(from)} Add ${count(mins, "minute")} to ${fromMin} minutes. ${carry}`,
  ];
  if (hours) lines.push(`Then add ${count(hours, "hour")}. The time is ${to}`);
  else lines.push(`The time is ${to}`);
  return lines;
}

export function elapsedStory(
  templateId: string,
  seed: string,
  model: { start: number; durations: number[] },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const start = formatClock(model.start);
  const [d1, d2] = model.durations;
  const frame = r(0, 3);
  let prompt: string;
  let focus: string;
  if (d2 === undefined) {
    const act = pick(r, ONE_BLOCKS);
    focus = act;
    const lasts = `${cap(act)} lasts ${hm(d1!)}.`;
    if (frame === 0)
      prompt = `${name} starts ${act} at ${start} ${lasts} What time does ${act} end?`;
    else if (frame === 1)
      prompt = `At ${start} ${name} begins ${act}. It lasts ${hm(d1!)}. What time is ${name} done?`;
    else if (frame === 2)
      prompt = `${name} is busy with ${act} starting at ${start} It takes ${hm(d1!)}. What time does it end?`;
    else
      prompt = `The clock shows ${start} ${name} starts ${act} then. ${lasts} What time does ${name} finish?`;
  } else {
    const [first, second] = pick(r, TWO_BLOCKS);
    focus = second;
    if (frame === 0)
      prompt = `${name} starts ${first} at ${start} ${cap(first)} lasts ${hm(d1!)}. Then ${second} takes ${hm(d2)}. What time does ${second} end?`;
    else if (frame === 1)
      prompt = `At ${start} ${name} begins ${first}. After ${hm(d1!)}, ${name} spends ${hm(d2)} on ${second}. What time is ${name} finished?`;
    else if (frame === 2)
      prompt = `${name}'s camp block starts at ${start} with ${first} for ${hm(d1!)}. Next is ${second}, and that takes ${hm(d2)}. When does ${second} finish?`;
    else
      prompt = `The clock shows ${start} That is when ${name} begins ${first}, which runs for ${hm(d1!)}. ${cap(second)} comes next for ${hm(d2)}. What time does ${name} finish ${second}?`;
  }
  const explanation: string[] = [`The clock shows ${start}`];
  let at = model.start;
  for (const part of model.durations) {
    explanation.push(...addMinutes(at, part));
    at += part;
  }
  explanation.push(
    d2 === undefined
      ? `${cap(focus)} ends at ${formatClock(at)}`
      : `Both parts are done at ${formatClock(at)}`,
  );
  const hint =
    d2 === undefined
      ? `The clock shows ${start} Add ${hm(d1!)}. If the minutes reach 60, cross into the next hour.`
      : `The clock shows ${start} Add ${hm(d1!)}, then add ${hm(d2)}. If the minutes reach 60, cross into the next hour.`;
  return { prompt, hint, explanation };
}

/* ------------------------------------------------------------------ */
/* Conversion table and smaller-to-larger rename                       */
/* ------------------------------------------------------------------ */

const commas = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

function distinctWrongs(correct: number, pool: number[]): string[] {
  const seen = new Set([String(correct)]);
  const out: string[] = [];
  for (const n of pool) {
    if (!Number.isInteger(n) || n <= 0 || n > 100_000) continue;
    const label = String(n);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length === 3) return out;
  }
  throw new Error("Need three distinct wrong table values");
}

const jobsFor = (large: string): readonly string[] =>
  large === "feet"
    ? lengthJobs
    : large === "kilograms"
      ? weightJobs
      : large === "hours"
        ? timeJobs
        : liquidJobs;

export function conversionStory(
  templateId: string,
  seed: string,
  model: {
    large: string;
    small: string;
    factor: number;
    large0: number;
    large1: number;
    large2: number;
    small0: number;
    small1: number;
    small2: number;
    shown: string;
  },
): {
  prompt: string;
  hint: string;
  wrongLarge: string[];
  wrongSmall: string[];
} {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const job = pick(r, jobsFor(model.large));
  const core = `matches ${model.large} with ${model.small}. The first row shows ${model.shown}.`;
  const frame = r(0, 3);
  const doing =
    model.large === "hours"
      ? "timing"
      : model.large === "kilograms"
        ? "weighing"
        : model.large === "liters"
          ? "pouring"
          : "measuring";
  const prompt =
    frame === 0
      ? `${name} is ${doing} ${job}. The table ${core} Fill in the two blanks.`
      : frame === 1
        ? `${name} keeps a chart for ${job}. It ${core} Complete the two blanks.`
        : frame === 2
          ? `Look at ${name}'s table for ${job}. The table ${core} Which numbers fill the blanks?`
          : `${name}'s notebook ${core} The chart is for ${job}. Fill in the two blanks.`;
  const hint = `${name} can read the rule from the first row. Divide to fill the ${model.large}. Multiply to fill the ${model.small}.`;
  const wrongLarge = distinctWrongs(model.large1, [
    model.small1,
    model.large1 * 10,
    model.large1 * 100,
    model.large0,
    model.large2,
    model.large1 + 1,
    Math.max(1, Math.round(model.small1 / 10)),
  ]);
  const wrongSmall = distinctWrongs(model.small2, [
    model.large2,
    model.large2 * 10,
    model.large2 * 100,
    model.small0,
    model.small1,
    model.large2 * model.factor + model.large2,
    Math.max(1, model.small2 - model.factor),
  ]);
  return { prompt, hint, wrongLarge, wrongSmall };
}

const RENAME_OBJECTS: Record<string, readonly string[]> = {
  "inch|foot": [
    "ribbon",
    "picture frame",
    "toy-car track",
    "poster",
    "jump rope",
    "shelf",
  ],
  "foot|yard": [
    "garden fence",
    "hallway",
    "fabric",
    "sideline",
    "kite string",
    "room",
  ],
  "ounce|pound": ["dog food", "flour", "apples", "clay", "potatoes", "rice"],
  "cup|quart": ["lemonade", "soup", "juice", "paint", "milk", "punch"],
  "quart|gallon": [
    "lemonade",
    "paint",
    "milk",
    "soup",
    "punch",
    "flower water",
  ],
  "minute|hour": [
    "soccer practice",
    "movie",
    "hike",
    "rehearsal",
    "reading",
    "piano practice",
  ],
  "centimeter|meter": [
    "ribbon",
    "garden row",
    "classroom rug",
    "paper chain",
    "model bridge",
    "jump rope",
  ],
  "millimeter|centimeter": [
    "beetle trail",
    "bead strand",
    "leaf",
    "paper-clip chain",
    "science card",
    "crayon line",
  ],
  "gram|kilogram": [
    "clay",
    "apples",
    "dog food",
    "flour",
    "rocks",
    "pumpkin seeds",
  ],
  "meter|kilometer": [
    "trail",
    "race",
    "bike path",
    "walk to school",
    "parade",
    "paper route",
  ],
  "milliliter|liter": [
    "juice",
    "paint",
    "soup",
    "lemonade",
    "milk",
    "flower water",
  ],
};

export function renameStory(
  templateId: string,
  seed: string,
  model: {
    small: string;
    large: string;
    factor: number;
    inputText: string;
    resultText: string;
  },
): { prompt: string; hint: string; closing: string } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const object = pick(
    r,
    RENAME_OBJECTS[`${model.small}|${model.large}`] ?? ["measure"],
  );
  const frame = r(0, 3);
  const amount = model.inputText;
  const noun = model.resultText.replace(/^\d[\d,]* /, "");
  const kind =
    model.small === "minute"
      ? "time"
      : model.small === "ounce" || model.small === "gram"
        ? "weight"
        : model.small === "cup" ||
            model.small === "quart" ||
            model.small === "milliliter"
          ? "liquid"
          : "length";
  const prompt =
    kind === "time"
      ? frame % 2 === 0
        ? `${name}'s ${object} takes ${amount}. How many ${noun} is that?`
        : `The schedule lists ${amount} for the ${object}. How many ${noun} should ${name} write down?`
      : kind === "weight"
        ? frame % 2 === 0
          ? `${name} weighs the ${object} at ${amount}. How many ${noun} is that?`
          : `${name} buys ${amount} of ${object}. How many ${noun} is that?`
        : kind === "liquid"
          ? frame % 2 === 0
            ? `${name} fills a pitcher of ${object} with ${amount}. How many ${noun} is that?`
            : `${name} pours ${amount} of ${object}. How many ${noun} is that?`
          : frame === 0
            ? `${name} measured the ${object}: ${amount}. How many ${noun} is that?`
            : frame === 1
              ? `${name} checks the ${object}. It is ${amount} long. How many ${noun} is that?`
              : frame === 2
                ? `${name} needs ${amount} for the ${object}. How many ${noun} is that?`
                : `A note in ${name}'s notebook says ${amount} for the ${object}. How many ${noun} should ${name} record?`;
  const factorText = count(model.factor, model.small).replace(
    /^\d+/,
    commas(model.factor),
  );
  const hint = `1 ${model.large} is ${factorText}. How many groups of ${commas(model.factor)} fit in that measure?`;
  const closing = `${name} records ${model.resultText}.`;
  return { prompt, hint, closing };
}

/* ------------------------------------------------------------------ */
/* Measurement line and tool choice                                    */
/* ------------------------------------------------------------------ */

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

const MILE_PLACES: readonly { verb: string; noun: string }[] = [
  { verb: "walks the park trail", noun: "park trail" },
  { verb: "rides the bike path", noun: "bike path" },
  { verb: "runs the cross-country course", noun: "cross-country course" },
  { verb: "hikes the nature trail", noun: "nature trail" },
  { verb: "follows the parade route", noun: "parade route" },
  { verb: "races on the track map", noun: "track map" },
  { verb: "reads the field-trip map", noun: "field-trip map" },
  { verb: "measures the canal path", noun: "canal path" },
];

export function lineStorySurface(
  templateId: string,
  seed: string,
  model: { denominator: number; a: number; b: number; answer: string },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const place = pick(r, MILE_PLACES);
  const frame = r(0, 3);
  const prompt =
    frame === 0
      ? `${name} ${place.verb}. How far is it from $A$ to $B$, in miles?`
      : frame === 1
        ? `${name} looks at the ${place.noun}. $A$ and $B$ are two marks. What is the distance from $A$ to $B$, in miles?`
        : frame === 2
          ? `${name} is on the ${place.noun}. How many miles is the trip from $A$ to $B$?`
          : `${name} uses a map of the ${place.noun}, marked in miles. How far is $A$ from $B$?`;
  const steps = model.b - model.a;
  const shared = gcd(steps, model.denominator);
  const tex = model.answer.includes("/")
    ? `\\frac{${model.answer.split("/")[0]}}{${model.answer.split("/")[1]}}`
    : model.answer;
  const unit = model.answer === "1" ? "mile" : "miles";
  const explanation = [
    `Each mile on the line is split into ${count(model.denominator, "equal step")}.`,
    `$A$ is ${count(model.a, "step")} from 0 and $B$ is ${count(model.b, "step")} from 0.`,
    `The trip is the steps between them: ${count(steps, "step")}.`,
    shared === 1
      ? `Write ${steps} over ${model.denominator}. The distance is $${tex}$ ${unit}.`
      : `${steps} over ${model.denominator} shares a factor of ${shared}, so it simplifies to $${tex}$ ${unit}.`,
  ];
  const hint = `Each mile is split into ${count(model.denominator, "equal step")}. Count the steps from $A$ to $B$. Simplify the fraction if the two numbers share a factor.`;
  return { prompt, hint, explanation };
}

export const toolSituations: Record<
  string,
  readonly { marker: string; ask: string }[]
> = {
  ruler: [
    {
      marker: "length of the gift ribbon",
      ask: "the length of the gift ribbon",
    },
    { marker: "height of the sunflower", ask: "the height of the sunflower" },
    {
      marker: "width of the picture frame",
      ask: "the width of the picture frame",
    },
    { marker: "length of the toy car", ask: "the length of the toy car" },
    { marker: "space on the bookshelf", ask: "the space on the bookshelf" },
    {
      marker: "length of the kite string",
      ask: "the length of the kite string",
    },
  ],
  balance: [
    {
      marker: "mass of a pinecone with known masses",
      ask: "the mass of a pinecone with known masses",
    },
    {
      marker: "mass of a feather with known masses",
      ask: "the mass of a feather with known masses",
    },
    {
      marker: "mass of a rock sample with known masses",
      ask: "the mass of a rock sample with known masses",
    },
    {
      marker: "mass of a clay lump with known masses",
      ask: "the mass of a clay lump with known masses",
    },
  ],
  thermometer: [
    { marker: "temperature of the soup", ask: "the temperature of the soup" },
    {
      marker: "temperature outside before soccer",
      ask: "the temperature outside before soccer",
    },
    {
      marker: "temperature of the fish tank",
      ask: "the temperature of the fish tank",
    },
    {
      marker: "temperature of the classroom",
      ask: "the temperature of the classroom",
    },
  ],
  cup: [
    { marker: "milk for the pancakes", ask: "the milk for the pancakes" },
    { marker: "water for the lemonade", ask: "the water for the lemonade" },
    { marker: "juice for the picnic", ask: "the juice for the picnic" },
    { marker: "paint for the mural", ask: "the paint for the mural" },
  ],
  scale: [
    {
      marker: "weight of the puppy in pounds",
      ask: "the weight of the puppy in pounds",
    },
    {
      marker: "weight of the pumpkin in pounds",
      ask: "the weight of the pumpkin in pounds",
    },
    {
      marker: "weight at the doctor's office in pounds",
      ask: "the weight at the doctor's office in pounds",
    },
    {
      marker: "weight of the apples in pounds",
      ask: "the weight of the apples in pounds",
    },
  ],
};

const TOOL_HINT: Record<string, string> = {
  ruler:
    "The question asks for a length. Choose the tool that measures length.",
  balance:
    "Known masses sit on one side. Choose the tool that compares a mass with those masses.",
  thermometer:
    "The question asks about temperature. Choose the tool that measures temperature.",
  cup: "The question asks about a liquid. Choose the tool that measures liquid.",
  scale:
    "The question asks for pounds. Choose the tool that shows weight as a number.",
};

export function toolStory(
  templateId: string,
  seed: string,
  toolId: string,
): { prompt: string; hint: string } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const situation = pick(r, toolSituations[toolId]!);
  const frame = r(0, 3);
  const ask = situation.ask;
  const prompt =
    frame === 0
      ? `Which tool should you use to measure ${ask}?`
      : frame === 1
        ? `${name} wants to measure ${ask}. Which tool should ${name} pick?`
        : frame === 2
          ? `What is the best tool for measuring ${ask}?`
          : `${name} is measuring ${ask}. Which tool measures that?`;
  return { prompt, hint: TOOL_HINT[toolId]! };
}

/* ------------------------------------------------------------------ */
/* Decimals and money                                                  */
/* ------------------------------------------------------------------ */

const dollarsOf = (cents: number) => {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${whole}.${frac}`;
};

export function moneyWords(cents: number): string {
  const whole = Math.floor(cents / 100);
  const extra = cents % 100;
  if (whole === 0) return count(extra, "cent");
  if (extra === 0) return count(whole, "dollar");
  return `${dollarsOf(cents)} dollars`;
}

const ENTER = "Enter the amount in dollars and cents, such as 2.35.";
const PLACES = ["hundredths", "tenths", "ones", "tens", "hundreds"];

function digitsOf(cents: number): number[] {
  const out: number[] = [];
  let n = cents;
  for (let i = 0; i < 5; i++) {
    out.push(n % 10);
    n = Math.floor(n / 10);
  }
  return out;
}

function decimalMethod(
  left: number,
  right: number,
  subtract: boolean,
  unlike: boolean,
): string[] {
  const lines = [
    unlike
      ? `Line up the decimal points. A tenth is ten hundredths, so write the shorter number with a 0 in the hundredths place: ${dollarsOf(left)} and ${dollarsOf(right)}.`
      : `Line up the decimal points so the hundredths sit under the hundredths: ${dollarsOf(left)} and ${dollarsOf(right)}.`,
  ];
  if (!subtract) {
    const a = digitsOf(left);
    const b = digitsOf(right);
    let carry = 0;
    const carries: string[] = [];
    for (let i = 0; i < 4; i++) {
      const sum = a[i]! + b[i]! + carry;
      if (sum >= 10) {
        carries.push(
          `${cap(PLACES[i]!)}: ${a[i]} + ${b[i]}${carry ? ` + ${carry}` : ""} = ${sum}. Write ${sum % 10} and carry 1 to the ${PLACES[i + 1]}.`,
        );
        carry = 1;
      } else carry = 0;
    }
    lines.push(
      carries.length
        ? carries.join(" ")
        : "Add the hundredths, the tenths, and the ones. No column reaches 10, so nothing is carried.",
    );
  } else {
    const top = digitsOf(left);
    const bot = digitsOf(right);
    const borrows: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (top[i]! >= bot[i]!) continue;
      let j = i + 1;
      while (top[j] === 0) j++;
      borrows.push(
        j === i + 1
          ? `The ${PLACES[i]} digit ${top[i]} is smaller than ${bot[i]}, so regroup from the ${PLACES[j]}.`
          : `The ${PLACES[i]} digit ${top[i]} is smaller than ${bot[i]}, so regroup from the ${PLACES[j]}. The places between become 9.`,
      );
      top[j]!--;
      for (let k = j - 1; k > i; k--) top[k] = 9;
      top[i]! += 10;
    }
    lines.push(
      borrows.length
        ? borrows.join(" ")
        : "Subtract the hundredths, the tenths, and the ones. No column needs a regroup.",
    );
  }
  const value = subtract ? left - right : left + right;
  lines.push(
    `${dollarsOf(left)} ${subtract ? "-" : "+"} ${dollarsOf(right)} = ${dollarsOf(value)}.`,
  );
  return lines;
}

export function decimalStory(
  templateId: string,
  seed: string,
  model: {
    shownL: string;
    shownR: string;
    leftCents: number;
    rightCents: number;
    subtract: boolean;
    unlike: boolean;
  },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const op = model.subtract ? "-" : "+";
  const bare = [
    `Find $${model.shownL} ${op} ${model.shownR}$.`,
    `Line up the decimal points and compute $${model.shownL} ${op} ${model.shownR}$.`,
    `What is the result of $${model.shownL} ${op} ${model.shownR}$?`,
  ];
  const applied = model.subtract
    ? [
        `The red ribbon is ${model.shownL} centimeters long. The blue ribbon is ${model.shownR} centimeters long. How much longer is the red ribbon?`,
        `${name} has ${moneyWords(model.leftCents)} and spends ${moneyWords(model.rightCents)}. How much is left, in dollars and cents?`,
      ]
    : [
        `One ribbon is ${model.shownL} centimeters and the other is ${model.shownR} centimeters. What is the total length in centimeters?`,
        `A notebook costs ${moneyWords(model.leftCents)} and a pen costs ${moneyWords(model.rightCents)}. What is the total cost, in dollars and cents?`,
      ];
  const appliedPick = r(0, 2) === 0;
  const prompt = appliedPick ? pick(r, applied) : pick(r, bare);
  const hint = model.unlike
    ? `Line up the decimal points in $${model.shownL} ${op} ${model.shownR}$. Write the tenth as hundredths before you ${model.subtract ? "subtract" : "add"}.`
    : `Line up the decimal points in $${model.shownL} ${op} ${model.shownR}$. Work from the hundredths place.`;
  return {
    prompt,
    hint,
    explanation: decimalMethod(
      model.leftCents,
      model.rightCents,
      model.subtract,
      model.unlike,
    ),
  };
}

const PRICE_PAIRS = [
  ["notebook", "marker"],
  ["smoothie", "muffin"],
  ["poster", "cap"],
  ["plant", "pot"],
  ["puzzle", "sticker sheet"],
  ["ticket", "snack"],
] as const;
const GOODS = ["marker", "sticker", "eraser", "pencil", "juice box"] as const;
const COSTS = [
  "lemonade",
  "museum ticket",
  "bus fare",
  "toy car",
  "sandwich",
  "plant",
] as const;

function joinList(parts: string[]): string {
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function fewestBreakdown(cents: number): string {
  const coins = [
    [25, "quarter"],
    [10, "dime"],
    [5, "nickel"],
    [1, "penny"],
  ] as const;
  const parts: string[] = [];
  let pieces = 0;
  let left = cents;
  for (const [value, name] of coins) {
    const n = Math.floor(left / value);
    if (!n) continue;
    parts.push(count(n, name));
    pieces += n;
    left -= n * value;
  }
  return `${cap(joinList(parts))} make ${moneyWords(cents)}. That is ${count(pieces, "coin")}.`;
}

export function moneyAddStory(
  templateId: string,
  seed: string,
  a: number,
  b: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const [first, second] = pick(r, PRICE_PAIRS);
  const frame = r(0, 1);
  const prompt =
    frame === 0
      ? `${name} buys a ${first} that costs ${moneyWords(a)} and a ${second} that costs ${moneyWords(b)}. What is the total cost? ${ENTER}`
      : `At the school fair, a ${first} costs ${moneyWords(a)} and a ${second} costs ${moneyWords(b)}. What is the total cost? ${ENTER}`;
  return {
    prompt,
    hint: `The ${first} costs ${moneyWords(a)} and the ${second} costs ${moneyWords(b)}. Add the dollars, then the cents. Regroup if the cents reach 100.`,
    explanation: [
      `Line up ${dollarsOf(a)} and ${dollarsOf(b)}.`,
      ...decimalMethod(a, b, false, false).slice(1),
      `The total cost is ${moneyWords(a + b)}.`,
    ],
  };
}

export function moneyChangeStory(
  templateId: string,
  seed: string,
  cost: number,
  payPhrase: string,
  paid: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const item = pick(r, COSTS);
  const frame = r(0, 1);
  const prompt =
    frame === 0
      ? `${name} buys ${item} that costs ${moneyWords(cost)}. ${name} pays with ${payPhrase}. How much change does ${name} get back? ${ENTER}`
      : `A ${item} costs ${moneyWords(cost)}. You pay with ${payPhrase}. How much change do you get back? ${ENTER}`;
  return {
    prompt,
    hint: `The ${item} costs ${moneyWords(cost)}. ${cap(payPhrase)} ${payPhrase.startsWith("two") || payPhrase.includes(" and ") ? "are" : "is"} ${moneyWords(paid)}. Change is the payment minus the cost.`,
    explanation: [
      `Change is the payment minus the cost.`,
      ...decimalMethod(paid, cost, true, false).slice(1),
      `You get ${moneyWords(paid - cost)} back.`,
    ],
  };
}

export function moneyShareStory(
  templateId: string,
  seed: string,
  price: number,
  items: number,
  friends: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const item = pick(r, GOODS);
  const one = item;
  const frame = r(0, 1);
  const prompt =
    frame === 0
      ? `${count(friends, "friend")} buy ${count(items, item)} together. Each ${one} costs ${moneyWords(price)}. They split the cost equally. How much does each friend pay? ${ENTER}`
      : `${name} and friends need ${count(items, item)}. Each ${one} costs ${moneyWords(price)}. ${count(friends, "friend")} split the cost equally. How much does each friend pay? ${ENTER}`;
  const total = items * price;
  const share = total / friends;
  return {
    prompt,
    hint: `Each ${one} costs ${moneyWords(price)}. Find the cost of ${count(items, item)}, then split that cost among ${count(friends, "friend")}.`,
    explanation: [
      `${count(items, item)} at ${moneyWords(price)} each cost ${moneyWords(total)}.`,
      `$${dollarsOf(total)} \\div ${friends} = ${dollarsOf(share)}$.`,
      `Each friend pays ${moneyWords(share)}.`,
    ],
  };
}

export function moneyTimesChangeStory(
  templateId: string,
  seed: string,
  price: number,
  n: number,
  payPhrase: string,
  paid: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((nItems) => r(0, nItems - 1));
  const item = pick(r, ["sticker", "pencil", "ticket", "cookie"] as const);
  const frame = r(0, 1);
  const prompt =
    frame === 0
      ? `${name} buys ${count(n, item)}. Each ${item} costs ${moneyWords(price)}. ${name} pays with ${payPhrase}. How much change does ${name} get back? ${ENTER}`
      : `At the fair, each ${item} costs ${moneyWords(price)}. You buy ${count(n, item)} and pay with ${payPhrase}. How much change do you get back? ${ENTER}`;
  const cost = n * price;
  return {
    prompt,
    hint: `Each ${item} costs ${moneyWords(price)}. Find the cost of ${count(n, item)}, then subtract it from ${moneyWords(paid)}.`,
    explanation: [
      `${count(n, item)} at ${moneyWords(price)} each cost ${moneyWords(cost)}.`,
      ...decimalMethod(paid, cost, true, false).slice(1),
      `You get ${moneyWords(paid - cost)} back.`,
    ],
  };
}

export function moneyFewestStory(
  templateId: string,
  seed: string,
  cents: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const frame = r(0, 5);
  const amount = moneyWords(cents);
  const prompt =
    frame === 0
      ? `The vending machine takes coins for juice that costs ${amount}. What is the fewest number of coins that pay for the juice?`
      : frame === 1
        ? `${name}'s lemonade costs ${amount}. What is the fewest number of coins that pay for one cup?`
        : frame === 2
          ? `${name} wants ${amount} from the piggy bank, using the fewest coins. How many coins is that?`
          : frame === 3
            ? `The sticker machine needs ${amount} in coins. What is the fewest number of coins that make that amount?`
            : frame === 4
              ? `The arcade game costs ${amount}. What is the fewest number of coins that pay for one game?`
              : `${name} counts out ${amount} for the bus fare, using the fewest coins. How many coins is that?`;
  return {
    prompt,
    hint: `Start with ${amount}. Take the largest coin that is not more than what is left: quarters, then dimes, nickels, and pennies.`,
    explanation: [`Start with ${amount}.`, fewestBreakdown(cents)],
  };
}

export function moneyModelStory(
  templateId: string,
  seed: string,
  model: {
    billPhrase: string;
    billCents: number;
    quarters: number;
    dimes: number;
    nickels: number;
    pennies: number;
  },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const frame = r(0, 5);
  const bills = model.billPhrase;
  const prompt =
    frame === 0
      ? `${name}'s piggy bank has ${bills} and the coins shown with them. How much money is in the bank? ${ENTER}`
      : frame === 1
        ? `${name} counts the lemonade-stand money: ${bills}, plus the coins in the cup. How much money is there in all? ${ENTER}`
        : frame === 2
          ? `${name} opens the register drawer. It has ${bills} and these coins. What is the total? ${ENTER}`
          : frame === 3
            ? `${name} found ${bills} and the coins beside them. How much money is that altogether? ${ENTER}`
            : frame === 4
              ? `${name}'s allowance jar has ${bills} and the coins shown with them. How much money is in the jar? ${ENTER}`
              : `${name} counts the bake-sale box: ${bills}, plus the coins in the cup. How much money is there in all? ${ENTER}`;
  const coinCents =
    model.quarters * 25 + model.dimes * 10 + model.nickels * 5 + model.pennies;
  const bits = [
    model.quarters
      ? `${count(model.quarters, "quarter")} ${isAre(model.quarters)} ${moneyWords(model.quarters * 25)}`
      : "",
    model.dimes
      ? `${count(model.dimes, "dime")} ${isAre(model.dimes)} ${moneyWords(model.dimes * 10)}`
      : "",
    model.nickels
      ? `${count(model.nickels, "nickel")} ${isAre(model.nickels)} ${moneyWords(model.nickels * 5)}`
      : "",
    model.pennies
      ? `${count(model.pennies, "penny")} ${isAre(model.pennies)} ${moneyWords(model.pennies)}`
      : "",
  ].filter(Boolean);
  return {
    prompt,
    hint: "Start with the bills. Then count the quarters, the dimes, the nickels, and the pennies.",
    explanation: [
      `The bills are worth ${moneyWords(model.billCents)}.`,
      `${cap(joinList(bits))}.`,
      `The coins are ${moneyWords(coinCents)}.`,
      `The total is ${moneyWords(model.billCents + coinCents)}.`,
    ],
  };
}
