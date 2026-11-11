import { withArticle } from "./agreement";
import { count, isAre } from "./agreement";
import { storyName } from "./story-kit/names";
import { surfaceStream, type Random } from "./variation/axes";

/** Story surfaces for grade-4 measurement and money.
 * The mathematical model stays on the content stream. Names, settings and
 * sentence frames come from this surface stream, so a plain (legacy) draw
 * is untouched. */

const cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);
/** Spread sentence frames across numbered seeds such as book-0…book-11. */
const spread = (seed: string, count: number): number => {
  const parts = seed.match(/\d+/g);
  if (!parts?.length || count < 1) return 0;
  return Number(parts[parts.length - 1]) % count;
};

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

/** Verb phrases that take "for" plus a duration. Each block can last
 * from about 10 minutes to 2 hours. */
const TWO_BLOCKS: readonly (readonly [Act, Act])[] = [
  ["plays basketball", "swims"],
  ["paints", "works with clay"],
  ["practices piano", "sings with the choir"],
  ["walks through the museum", "watches the planetarium show"],
  ["codes", "builds a robot"],
  ["reads", "plays a board game"],
  ["hikes the nature trail", "watches birds"],
  ["draws in art class", "walks the gallery"],
  ["plays the spelling game", "plays the math game"],
  ["practices dance", "plays music"],
];

const ONE_BLOCKS: readonly Act[] = [
  "hikes to the overlook",
  "practices soccer",
  "plays a video game",
  "watches a movie",
  "practices piano",
  "works in art class",
  "rides a bike",
  "meets with science club",
  "practices dance",
  "visits the library",
  "rides to the park",
  "rehearses the play",
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
  const frame = spread(seed, 4);
  let prompt: string;
  if (d2 === undefined) {
    const act = ONE_BLOCKS[spread(seed, ONE_BLOCKS.length)]!;
    const spent = `${name} ${act} for ${hm(d1!)}`;
    if (frame === 0)
      prompt = `${name} starts at ${start} ${name} ${act} for ${hm(d1!)}. What time does ${name} finish?`;
    else if (frame === 1)
      prompt = `At ${start} ${spent}. What time is ${name} done?`;
    else if (frame === 2)
      prompt = `The clock shows ${start} Starting then, ${spent}. What time does ${name} stop?`;
    else
      prompt = `${name} begins at ${start} For the next ${hm(d1!)}, ${name} ${act}. What time is ${name} finished?`;
  } else {
    const [first, second] = TWO_BLOCKS[spread(seed, TWO_BLOCKS.length)]!;
    if (frame === 0)
      prompt = `${name} starts at ${start} ${name} ${first} for ${hm(d1!)}, then ${second} for ${hm(d2)}. What time is ${name} finished?`;
    else if (frame === 1)
      prompt = `At ${start} ${name} ${first} for ${hm(d1!)}. Then ${name} ${second} for ${hm(d2)}. What time is ${name} done?`;
    else if (frame === 2)
      prompt = `The clock shows ${start} Starting then, ${name} ${first} for ${hm(d1!)} and then ${second} for ${hm(d2)}. What time does ${name} finish?`;
    else
      prompt = `${name} begins at ${start} First ${name} ${first} for ${hm(d1!)}. Next ${name} ${second} for ${hm(d2)}. What time is ${name} finished?`;
  }
  const explanation: string[] = [`The clock shows ${start}`];
  let at = model.start;
  for (const part of model.durations) {
    explanation.push(...addMinutes(at, part));
    at += part;
  }
  explanation.push(
    d2 === undefined
      ? `${name} finishes at ${formatClock(at)}`
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

/** A reason someone needs this conversion table. The figure is that table. */
const TABLE_REASONS: Record<string, readonly ((name: string) => string)[]> = {
  feet: [
    (name) =>
      `${name} is cutting boards for a bookshelf. The plan is in feet, and the tape measure shows inches.`,
    (name) =>
      `${name} is marking a garden bed. The plan says feet, and the tape measure shows inches.`,
    (name) =>
      `${name} is cutting ribbon for a costume. The pattern says feet, and the tape shows inches.`,
    (name) =>
      `${name} is cutting a runner for the hall. The plan says feet, and the tape measure shows inches.`,
    (name) =>
      `${name} is laying out a dog run. The sketch is in feet, and the tape measure shows inches.`,
    (name) =>
      `${name} is cutting a banner for the play. The plan says feet, and the tape shows inches.`,
  ],
  kilograms: [
    (name) =>
      `${name} helps the vet record the puppies' weights. The chart uses kilograms, and the scale shows grams.`,
    (name) =>
      `${name} is baking bread for a party. The recipe lists kilograms of flour, and the kitchen scale shows grams.`,
    (name) =>
      `${name} is scooping dog food. The bag says kilograms, and the feeding chart uses grams.`,
    (name) =>
      `${name} is labeling rocks for science. The class chart uses kilograms, and the balance shows grams.`,
    (name) =>
      `${name} is weighing apples for the bake sale. The order says kilograms, and the scale shows grams.`,
  ],
  hours: [
    (name) =>
      `${name}'s coach is turning hours of practice into minutes for the season log.`,
    (name) =>
      `${name} is writing the rehearsal schedule. The plan says hours, and the clock counts minutes.`,
    (name) =>
      `${name} is planning a hike. The trail guide says hours, and the watch counts minutes.`,
    (name) =>
      `${name} is filling a reading log. The goal is in hours, and the timer shows minutes.`,
    (name) =>
      `${name} is timing a chess tournament. The round list says hours, and the clock counts minutes.`,
    (name) =>
      `${name} is planning the talent-show setup. The schedule says hours, and the crew needs minutes.`,
  ],
  liters: [
    (name) =>
      `${name} is making punch for a class party. The recipe lists liters, and the measuring cup is marked in milliliters.`,
    (name) =>
      `${name} is cooking soup for the family. The pot recipe uses liters, and the cup shows milliliters.`,
    (name) =>
      `${name} is mixing lemonade for the picnic. The card says liters, and the jug lines are milliliters.`,
    (name) =>
      `${name} is filling the fish tank from the care guide. The guide lists liters, and the bucket is marked in milliliters.`,
    (name) =>
      `${name} is mixing paint for a mural. The color recipe lists liters, and the cup is marked in milliliters.`,
    (name) =>
      `${name} is filling water bottles for soccer. The jug says liters, and the bottle lines are milliliters.`,
  ],
};

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
  const reasons = TABLE_REASONS[model.large] ?? TABLE_REASONS.liters!;
  const reason =
    reasons[
      (spread(seed, 97) + model.large0 * 5 + model.large1 * 3) % reasons.length
    ]!(name);
  const rule = `The table matches ${model.large} with ${model.small}. The first row shows ${model.shown}.`;
  const frame = (spread(seed, 4) + model.large1) % 4;
  const ask =
    frame === 0
      ? `Which numbers does ${name} write in the two blanks?`
      : frame === 1
        ? `What should ${name} put in the two blanks?`
        : frame === 2
          ? `Fill in the two numbers ${name} still needs.`
          : `Which numbers complete ${name}'s chart?`;
  const prompt = `${reason} ${rule} ${ask}`;
  const hint = `The first row shows ${model.shown}. Divide to fill the ${model.large}. Multiply to fill the ${model.small}.`;
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

type RenameFit = { min: number; max: number; object: string };

/** Ranges are the smaller-unit amount the generator can actually draw.
 * Every possible amount hits at least one object. */
const RENAME_FITS: Record<string, readonly RenameFit[]> = {
  "inch|foot": [
    { min: 24, max: 60, object: "picture frame" },
    { min: 24, max: 48, object: "poster" },
    { min: 36, max: 132, object: "toy-car track" },
    { min: 84, max: 132, object: "jump rope" },
    { min: 24, max: 96, object: "shelf" },
    { min: 24, max: 132, object: "ribbon for the class play" },
  ],
  "foot|yard": [
    { min: 6, max: 24, object: "garden fence" },
    { min: 12, max: 45, object: "driveway" },
    { min: 15, max: 45, object: "kite string" },
    { min: 20, max: 45, object: "school hallway" },
    { min: 8, max: 20, object: "classroom wall" },
    { min: 6, max: 45, object: "garden path" },
  ],
  "ounce|pound": [
    { min: 32, max: 160, object: "bag of apples" },
    { min: 32, max: 160, object: "bag of dog food" },
    { min: 32, max: 80, object: "bag of flour" },
    { min: 32, max: 160, object: "bag of potatoes" },
    { min: 32, max: 80, object: "bag of rice" },
    { min: 48, max: 160, object: "bucket of clay" },
  ],
  "cup|quart": [
    { min: 8, max: 12, object: "pitcher of lemonade" },
    { min: 8, max: 16, object: "pot of soup" },
    { min: 16, max: 48, object: "punch for the party" },
    { min: 20, max: 48, object: "cooler of juice" },
    { min: 8, max: 16, object: "milk for breakfast" },
    { min: 8, max: 12, object: "paint for a small shelf" },
  ],
  "quart|gallon": [
    { min: 16, max: 32, object: "cooler of lemonade" },
    { min: 8, max: 12, object: "can of paint for the bedroom" },
    { min: 8, max: 12, object: "pot of soup" },
    { min: 24, max: 32, object: "soup for the fundraiser" },
    { min: 8, max: 12, object: "milk for the week" },
    { min: 24, max: 32, object: "punch for the team party" },
  ],
  "minute|hour": [
    { min: 120, max: 120, object: "soccer practice" },
    { min: 180, max: 480, object: "soccer tournament" },
    { min: 120, max: 180, object: "movie" },
    { min: 240, max: 480, object: "movie marathon" },
    { min: 120, max: 360, object: "hike" },
    { min: 120, max: 240, object: "rehearsal" },
    { min: 120, max: 480, object: "read-a-thon" },
    { min: 120, max: 120, object: "piano practice" },
  ],
  "centimeter|meter": [
    { min: 200, max: 500, object: "jump rope" },
    { min: 200, max: 1200, object: "garden row" },
    { min: 200, max: 600, object: "classroom rug" },
    { min: 200, max: 1200, object: "paper chain" },
    { min: 200, max: 250, object: "model bridge" },
    { min: 400, max: 1200, object: "hallway" },
  ],
  "millimeter|centimeter": [
    { min: 20, max: 150, object: "beetle path" },
    { min: 50, max: 200, object: "bead strand" },
    { min: 40, max: 180, object: "leaf" },
    { min: 30, max: 200, object: "paper-clip chain" },
    { min: 80, max: 160, object: "science card" },
    { min: 20, max: 200, object: "crayon line" },
  ],
  "gram|kilogram": [
    { min: 2000, max: 9000, object: "bag of apples" },
    { min: 2000, max: 9000, object: "bag of dog food" },
    { min: 2000, max: 5000, object: "bag of flour" },
    { min: 2000, max: 5000, object: "art clay" },
    { min: 2000, max: 9000, object: "bucket of rocks" },
  ],
  "meter|kilometer": [
    { min: 2000, max: 9000, object: "bike path" },
    { min: 2000, max: 9000, object: "hiking trail" },
    { min: 2000, max: 5000, object: "race course" },
    { min: 2000, max: 3000, object: "walk to school" },
    { min: 2000, max: 4000, object: "parade route" },
    { min: 2000, max: 6000, object: "paper route" },
    { min: 4000, max: 9000, object: "charity walk" },
  ],
  "milliliter|liter": [
    { min: 2000, max: 3000, object: "pitcher of juice" },
    { min: 2000, max: 4000, object: "can of paint" },
    { min: 2000, max: 6000, object: "pot of soup" },
    { min: 4000, max: 6000, object: "cooler of lemonade" },
    { min: 2000, max: 6000, object: "milk for the week" },
    { min: 2000, max: 2000, object: "watering can for the flowers" },
    { min: 4000, max: 6000, object: "bucket of water for the flowers" },
  ],
};

function fittingObject(seed: string, key: string, input: number): string {
  const pool = (RENAME_FITS[key] ?? []).filter(
    (item) => input >= item.min && input <= item.max,
  );
  if (!pool.length) throw new Error(`Need an object that fits ${key} ${input}`);
  return pool[spread(seed, pool.length)]!.object;
}

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
  const amount = model.inputText;
  const input = Number(amount.match(/^[\d,]+/)![0]!.replaceAll(",", ""));
  const object = fittingObject(seed, `${model.small}|${model.large}`, input);
  const frame = r(0, 3);
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
  const ask =
    frame % 2 === 0
      ? `How many ${noun} is that?`
      : `How many ${noun} should ${name} write down?`;
  const prompt =
    kind === "time"
      ? frame < 2
        ? `${name}'s ${object} lasts ${amount}. ${ask}`
        : `${name} reads the schedule: ${amount} for the ${object}. ${ask}`
      : kind === "weight"
        ? frame < 2
          ? `${name} weighs the ${object} at ${amount}. ${ask}`
          : `${name} reads ${amount} on the scale for the ${object}. ${ask}`
        : kind === "liquid"
          ? frame < 2
            ? `${name} checks the ${object}. It has ${amount} in it. ${ask}`
            : `${name} reads a recipe that uses ${amount} for the ${object}. ${ask}`
          : frame === 0
            ? `${name} measures the ${object} at ${amount}. ${ask}`
            : frame === 1
              ? `${name} checks the ${object}. It is ${amount} long. ${ask}`
              : frame === 2
                ? `${name} puts a tape on the ${object} and reads ${amount}. ${ask}`
                : `${name} finds that the ${object} is ${amount} long. ${ask}`;
  const factorText = count(model.factor, model.small).replace(
    /^\d+/,
    commas(model.factor),
  );
  const given = amount.match(/^[\d,]+/)![0]!;
  const hint = `${amount} is the measure. 1 ${model.large} is ${factorText}. How many groups of ${commas(model.factor)} fit in ${given}?`;
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
  { verb: "walks the canal path", noun: "canal path" },
  { verb: "walks the field-trip route", noun: "field-trip route" },
  { verb: "rides the greenway", noun: "greenway" },
];

export function lineStorySurface(
  templateId: string,
  seed: string,
  model: { denominator: number; a: number; b: number; answer: string },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const place = MILE_PLACES[spread(seed, MILE_PLACES.length)]!;
  const frame = (model.a + model.b + model.denominator) % 4;
  const prompt =
    frame === 0
      ? `${name} ${place.verb}. How far is it from $A$ to $B$, in miles?`
      : frame === 1
        ? `${name} looks at a map of the ${place.noun}. How far is $A$ from $B$, in miles?`
        : frame === 2
          ? `${name} is on the ${place.noun}. $A$ and $B$ are two marks. How many miles is it from $A$ to $B$?`
          : `${name} follows the ${place.noun} from $A$ to $B$. What is the distance, in miles?`;
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
      marker: "mass of a pinecone",
      ask: "the mass of a pinecone",
    },
    {
      marker: "mass of a feather",
      ask: "the mass of a feather",
    },
    {
      marker: "mass of a rock sample",
      ask: "the mass of a rock sample",
    },
    {
      marker: "mass of a clay lump",
      ask: "the mass of a clay lump",
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
      marker: "your weight in pounds at the doctor's office",
      ask: "your weight in pounds at the doctor's office",
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
  const situations = toolSituations[toolId]!;
  const situation = situations[spread(seed, situations.length)]!;
  const frame = spread(seed, 4);
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
      const original = top[i]!;
      const chain = [`take 1 from the ${PLACES[j]}`];
      top[j]!--;
      for (let k = j - 1; k > i; k--) {
        top[k] = 9;
        chain.push(`the ${PLACES[k]} become 9`);
      }
      top[i] = original + 10;
      borrows.push(
        `${cap(PLACES[i]!)}: ${original} is smaller than ${bot[i]}. Regroup: ${chain.join(", ")}, so the ${PLACES[i]} become ${top[i]}.`,
      );
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

const DECIMAL_BUYS = [
  ["book", "pen"],
  ["smoothie", "muffin"],
  ["poster", "cap"],
  ["plant", "pot"],
] as const;

/** A length in meters that a child actually meets. Bands stay inside the
 * generator's hundredths (about 0.11 through 15). */
function lengthThing(cents: number): { name: string; band: string } {
  const meters = cents / 100;
  if (meters < 0.2) return { name: "crayon", band: "small" };
  if (meters < 0.4) return { name: "notebook", band: "small" };
  if (meters < 0.8) return { name: "backpack", band: "pack" };
  if (meters < 1.2) return { name: "baseball bat", band: "bat" };
  if (meters < 2) return { name: "desk", band: "desk" };
  if (meters <= 5) return { name: "jump rope", band: "rope" };
  if (meters <= 12) return { name: "hallway", band: "hall" };
  return { name: "driveway", band: "drive" };
}

function decimalApplied(
  seed: string,
  name: string,
  model: {
    shownL: string;
    shownR: string;
    leftCents: number;
    rightCents: number;
    subtract: boolean;
  },
): { prompt: string; closing: string } | null {
  const kinds = ["money", "race", "rain", "length"] as const;
  const preferred = kinds[spread(seed, kinds.length)]!;
  const order = [
    preferred,
    ...(["rain", "length", "race", "money"] as const).filter(
      (kind) => kind !== preferred,
    ),
  ];
  for (const kind of order) {
    const built = decimalKind(seed, name, model, kind);
    if (built) return built;
  }
  return null;
}

function decimalKind(
  seed: string,
  name: string,
  model: {
    shownL: string;
    shownR: string;
    leftCents: number;
    rightCents: number;
    subtract: boolean;
  },
  kind: "money" | "race" | "rain" | "length",
): { prompt: string; closing: string } | null {
  const { shownL, shownR, leftCents, rightCents, subtract } = model;
  const value = subtract ? leftCents - rightCents : leftCents + rightCents;
  const shownValue = dollarsOf(value);
  if (kind === "money") {
    const [bought, extra] = DECIMAL_BUYS[spread(seed, DECIMAL_BUYS.length)]!;
    const frame = spread(`${seed}m`, 2);
    if (subtract) {
      const prompt =
        frame === 0
          ? `${name} has ${moneyWords(leftCents)} and spends ${moneyWords(rightCents)} on ${withArticle(bought)}. How much is left, in dollars and cents?`
          : `${name} had ${moneyWords(leftCents)} and paid ${moneyWords(rightCents)} for ${withArticle(bought)}. How much is left, in dollars and cents?`;
      return { prompt, closing: `That leaves ${moneyWords(value)}.` };
    }
    const prompt =
      frame === 0
        ? `${name} buys ${withArticle(bought)} that costs ${moneyWords(leftCents)} and ${withArticle(extra)} that costs ${moneyWords(rightCents)}. What is the total cost, in dollars and cents?`
        : `${withArticle(bought, true)} costs ${moneyWords(leftCents)} and ${withArticle(extra)} costs ${moneyWords(rightCents)}. What is the total cost, in dollars and cents?`;
    return { prompt, closing: `The total cost is ${moneyWords(value)}.` };
  }
  if (kind === "race") {
    if (
      leftCents < 800 ||
      rightCents < 800 ||
      leftCents > 1500 ||
      rightCents > 1500
    )
      return null;
    if (subtract) {
      return {
        prompt: `${name}'s heat takes ${shownL} seconds and a classmate's heat takes ${shownR} seconds. How much longer is ${name}'s heat?`,
        closing: `${name}'s heat is ${shownValue} seconds longer.`,
      };
    }
    return {
      prompt: `${name}'s relay has two legs. The first leg takes ${shownL} seconds and the second leg takes ${shownR} seconds. What is the total time, in seconds?`,
      closing: `The total time is ${shownValue} seconds.`,
    };
  }
  if (kind === "rain") {
    if (subtract) return null;
    const months = [
      ["March", "April"],
      ["September", "October"],
      ["January", "February"],
      ["June", "July"],
    ] as const;
    const [earlier, later] = months[spread(seed, months.length)]!;
    return {
      prompt: `${name} checks the rain gauge. Rain in ${earlier} came to ${shownL} inches and rain in ${later} came to ${shownR} inches. What is the total rainfall, in inches?`,
      closing: `The total rainfall is ${shownValue} inches.`,
    };
  }
  const big = lengthThing(leftCents);
  const small = lengthThing(rightCents);
  if (big.band !== small.band) return null;
  if (!subtract && (big.band === "hall" || big.band === "drive")) return null;
  if (subtract) {
    const prompt = `One ${big.name} is ${shownL} meters and the other is ${shownR} meters. How much longer is the first ${big.name}?`;
    return {
      prompt,
      closing: `The difference is ${shownValue} meters.`,
    };
  }
  const verb = big.band === "rope" ? "lays" : "lines up";
  return {
    prompt: `${name} ${verb} ${withArticle(big.name)} that is ${shownL} meters with ${withArticle(small.name)} that is ${shownR} meters. What is the total length, in meters?`,
    closing: `The total length is ${shownValue} meters.`,
  };
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
    /** Story draws only. Drill is the bare exercise; applied is the measurement or money surface. */
    surface: "drill" | "applied";
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
  const applied =
    model.surface === "applied" ? decimalApplied(seed, name, model) : null;
  const prompt = applied?.prompt ?? bare[spread(seed, bare.length)]!;
  const hint = model.unlike
    ? `Line up the decimal points in $${model.shownL} ${op} ${model.shownR}$. Write the tenth as hundredths before you ${model.subtract ? "subtract" : "add"}.`
    : `Line up the decimal points in $${model.shownL} ${op} ${model.shownR}$. Work from the hundredths place.`;
  const method = decimalMethod(
    model.leftCents,
    model.rightCents,
    model.subtract,
    model.unlike,
  );
  return {
    prompt,
    hint,
    explanation: applied ? [...method, applied.closing] : method,
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
  "bus ticket",
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
  return `That is ${count(pieces, "coin")}: ${joinList(parts)}.`;
}

export function moneyAddStory(
  templateId: string,
  seed: string,
  a: number,
  b: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const [first, second] = PRICE_PAIRS[spread(seed, PRICE_PAIRS.length)]!;
  const frame = spread(seed, 2);
  const prompt =
    frame === 0
      ? `${name} buys ${withArticle(first)} that costs ${moneyWords(a)} and ${withArticle(second)} that costs ${moneyWords(b)}. What is the total cost? ${ENTER}`
      : `At the school fair, ${withArticle(first)} costs ${moneyWords(a)} and ${withArticle(second)} costs ${moneyWords(b)}. What is the total cost? ${ENTER}`;
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
  const item = COSTS[spread(seed, COSTS.length)]!;
  const frame = spread(seed, 2);
  const prompt =
    frame === 0
      ? `${name} buys ${withArticle(item)} that costs ${moneyWords(cost)}. ${name} pays with ${payPhrase}. How much change does ${name} get back? ${ENTER}`
      : `${withArticle(item, true)} costs ${moneyWords(cost)}. You pay with ${payPhrase}. How much change do you get back? ${ENTER}`;
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
  const item = GOODS[spread(seed, GOODS.length)]!;
  const one = item;
  const frame = spread(seed, 2);
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
  const goods = ["sticker", "pencil", "ticket", "cookie"] as const;
  const item = goods[spread(seed, goods.length)]!;
  const frame = spread(seed, 2);
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

const COIN_BUYS: readonly { min: number; max: number; item: string }[] = [
  { min: 11, max: 40, item: "a pencil" },
  { min: 11, max: 35, item: "an eraser" },
  { min: 11, max: 50, item: "a piece of candy" },
  { min: 25, max: 50, item: "a gumball" },
  { min: 25, max: 75, item: "a cup of lemonade" },
  { min: 25, max: 75, item: "a bouncy ball" },
  { min: 25, max: 50, item: "a bookmark" },
  { min: 25, max: 75, item: "a sticker" },
  { min: 25, max: 99, item: "a cookie" },
  { min: 40, max: 99, item: "a postcard" },
  { min: 50, max: 99, item: "the bus fare" },
  { min: 50, max: 99, item: "a bottle of water" },
  { min: 60, max: 99, item: "juice from the machine" },
];

export function moneyFewestStory(
  templateId: string,
  seed: string,
  cents: number,
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const buys = COIN_BUYS.filter(
    (item) => cents >= item.min && cents <= item.max,
  );
  const item = (buys.length ? buys : COIN_BUYS)[
    spread(seed, buys.length || COIN_BUYS.length)
  ]!.item;
  const frame = r(0, 3);
  const amount = moneyWords(cents);
  const prompt =
    frame === 0
      ? `${name} sees that ${item} costs ${amount}. What is the fewest number of coins that pay for it?`
      : frame === 1
        ? `${name} pays ${amount} for ${item} with the fewest coins. How many coins is that?`
        : frame === 2
          ? `${name} needs ${amount} in coins for ${item}. What is the fewest number of coins?`
          : `${name} counts out ${amount} for ${item}, using the fewest coins. How many coins is that?`;
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
  const places = [
    "piggy bank",
    "coin purse from the garage sale",
    "envelope from the tooth fairy",
    "lemonade-stand cash box",
    "jacket pocket",
    "field-trip envelope",
    "bake-sale box",
    "allowance jar",
    "birthday envelope",
    "car-wash tip jar",
    "savings pouch",
    "class-store drawer",
  ] as const;
  const place = places[spread(seed, places.length)]!;
  const frame = spread(seed, 4);
  const bills = model.billPhrase;
  const prompt =
    frame === 0
      ? `${name}'s ${place} has ${bills} and the coins shown. How much money is in it? ${ENTER}`
      : frame === 1
        ? `${name} counts the money in the ${place}: ${bills}, plus the coins. What is the total? ${ENTER}`
        : frame === 2
          ? `${name} opens the ${place}. It has ${bills} and these coins. How much is there in all? ${ENTER}`
          : `${name} lays out the money from the ${place}: ${bills} and the coins shown. How much is that altogether? ${ENTER}`;
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
    hint: `Start with ${bills}. Then count the quarters, the dimes, the nickels, and the pennies.`,
    explanation: [
      `The bills are worth ${moneyWords(model.billCents)}.`,
      `${cap(joinList(bits))}.`,
      `The coins add up to ${
        coinCents < 100 || coinCents % 100 === 0
          ? moneyWords(coinCents)
          : `${count(Math.floor(coinCents / 100), "dollar")} and ${count(coinCents % 100, "cent")}`
      }.`,
      `The total is ${moneyWords(model.billCents + coinCents)}.`,
    ],
  };
}
