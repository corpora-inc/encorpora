import { withArticle } from "../agreement";
// Grade-4 fraction contexts. Numbers stay in the caller's model; this file
// only chooses a realistic object, unit, and sentence. Money is never written
// with "$" (that character opens TeX). Names come from ./names.
//
// A denominator is used only with a unit that is really divided that way:
// hours in halves, thirds, quarters, sixths and twelfths; rulers in halves,
// quarters, eighths and sixteenths; hundredths for cents, centimeters,
// hundredths of a second, and hundredths of a liter. Amount stories receive
// fractions already in simplest form. Equivalence and piece-models may show
// the unsimplified count of pieces.

import { storyName } from "./names.js";

type Random = (lo: number, hi: number) => number;

export const learnerName = (r: Random): string => storyName((n) => r(0, n - 1));

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

export const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x || 1;
};

/** Denominators that are real divisions of that unit. */
export const UNIT_DENOMS = {
  hour: [2, 3, 4, 6, 12],
  inch: [2, 4, 8, 16],
  foot: [2, 3, 4, 6, 8, 12, 16],
  cup: [2, 3, 4, 8],
  mile: [2, 4, 5, 8, 10],
  meter: [2, 4, 5, 10, 100],
  liter: [2, 4, 5, 8, 10, 100],
  dollar: [2, 4, 10, 100],
  second: [10, 100],
  pizza: [2, 3, 4, 6, 8, 12],
  chapter: [2, 4, 5, 10],
  garden: [2, 3, 4, 5, 6, 8, 10, 12],
  poster: [2, 3, 4, 6, 8, 12],
  bar: [2, 3, 4, 6, 8],
} as const;

export const denomFits = (
  denominator: number,
  unit: keyof typeof UNIT_DENOMS,
): boolean => (UNIT_DENOMS[unit] as readonly number[]).includes(denominator);

/** "1/2 liter", "3/4 of an inch", "1 foot", or "3/2 miles". */
export function fractionAmount(
  numerator: number,
  denominator: number,
  unit: string,
  article = "a",
): string {
  const many = unit === "foot" ? "feet" : `${unit}s`;
  if (numerator === denominator) return `1 ${unit}`;
  if (unit === "hour" || unit === "inch") {
    if (numerator < denominator)
      return `${numerator}/${denominator} of ${article} ${unit}`;
    return `${numerator}/${denominator} ${many}`;
  }
  if (numerator < denominator) return `${numerator}/${denominator} ${unit}`;
  return `${numerator}/${denominator} ${many}`;
}

/** Cents equal to n/d of a dollar, when that division is exact. */
export function centWords(
  numerator: number,
  denominator: number,
): string | null {
  if (![2, 4, 10, 100].includes(denominator)) return null;
  if ((numerator * 100) % denominator !== 0) return null;
  const cents = (numerator * 100) / denominator;
  return `${cents} cent${cents === 1 ? "" : "s"}`;
}

const inRange = (
  numerator: number,
  denominator: number,
  min: number,
  max: number,
) => {
  const value = numerator / denominator;
  return value >= min - 1e-9 && value <= max + 1e-9;
};

/** Positive numerators below `limit` that are already in simplest form. */
const simplest = (denominator: number, limit: number): number[] => {
  const out: number[] = [];
  for (let n = 1; n < limit; n++) if (gcd(n, denominator) === 1) out.push(n);
  return out;
};

type DiffScene = {
  object: string;
  unit: string;
  article?: string;
  denoms: readonly number[];
  min: number;
  max: number;
  prompt: (who: string, a: number, b: number, d: number) => string;
};

const diffScenes: readonly DiffScene[] = [
  {
    object: "ribbon",
    unit: "foot",
    denoms: UNIT_DENOMS.foot,
    min: 0.25,
    max: 6,
    prompt: (who, a, b, d) =>
      `${who} has a ribbon ${fractionAmount(a, d, "foot")} long. ${who} cuts off ${fractionAmount(b, d, "foot")}. How much ribbon is left?`,
  },
  {
    object: "wood",
    unit: "inch",
    article: "an",
    denoms: UNIT_DENOMS.inch,
    min: 0.125,
    max: 8,
    prompt: (who, a, b, d) =>
      `${who} has a wood shim ${fractionAmount(a, d, "inch", "an")} thick. ${who} sands off ${fractionAmount(b, d, "inch", "an")}. How much of the shim is left?`,
  },
  {
    object: "bead",
    unit: "inch",
    article: "an",
    denoms: UNIT_DENOMS.inch,
    min: 1 / 16,
    max: 1 / 8,
    prompt: (who, a, b, d) =>
      `${who} lines up seed beads that measure ${fractionAmount(a, d, "inch", "an")} long. ${who} takes off beads that measure ${fractionAmount(b, d, "inch", "an")}. How long is the row now?`,
  },
  {
    object: "rope",
    unit: "meter",
    denoms: [2, 4, 5, 10],
    min: 0.4,
    max: 1,
    prompt: (who, a, b, d) =>
      `${who} unrolls ${fractionAmount(a, d, "meter")} of rope. ${who} coils ${fractionAmount(b, d, "meter")} back up. How much rope stays out?`,
  },
  {
    object: "tape",
    unit: "meter",
    denoms: [10, 100],
    min: 0.02,
    max: 1.5,
    prompt: (who, a, b, d) =>
      `${who} has ${fractionAmount(a, d, "meter")} of tape. ${who} uses ${fractionAmount(b, d, "meter")} on a label. How much tape is left?`,
  },
  {
    object: "juice",
    unit: "liter",
    denoms: [2, 4, 5, 8, 10],
    min: 0.125,
    max: 2,
    prompt: (who, a, b, d) =>
      `${who} has ${fractionAmount(a, d, "liter")} of juice. ${who} drinks ${fractionAmount(b, d, "liter")}. How much juice is left?`,
  },
  {
    object: "water",
    unit: "liter",
    denoms: [10, 100],
    min: 0.01,
    max: 0.5,
    prompt: (who, a, b, d) =>
      `${who} measures ${fractionAmount(a, d, "liter")} of water into a cup. ${who} pours out ${fractionAmount(b, d, "liter")}. How much water is left in the cup?`,
  },
  {
    object: "practice",
    unit: "hour",
    article: "an",
    denoms: UNIT_DENOMS.hour,
    min: 1 / 6,
    max: 2,
    prompt: (who, a, b, d) =>
      `${who} planned ${fractionAmount(a, d, "hour", "an")} of piano. ${who} has practiced ${fractionAmount(b, d, "hour", "an")}. How much practice time is left?`,
  },
  {
    object: "reading",
    unit: "hour",
    article: "an",
    denoms: UNIT_DENOMS.hour,
    min: 1 / 6,
    max: 2,
    prompt: (who, a, b, d) =>
      `${who} set aside ${fractionAmount(a, d, "hour", "an")} for reading. ${who} has read for ${fractionAmount(b, d, "hour", "an")}. How much reading time is left?`,
  },
  {
    object: "movie",
    unit: "hour",
    article: "an",
    denoms: UNIT_DENOMS.hour,
    min: 2 / 3,
    max: 2,
    prompt: (who, a, b, d) =>
      `A movie lasts ${fractionAmount(a, d, "hour", "an")}. ${who} has watched ${fractionAmount(b, d, "hour", "an")}. How much of the movie is left?`,
  },
  {
    object: "milk",
    unit: "cup",
    denoms: UNIT_DENOMS.cup,
    min: 0.125,
    max: 1,
    prompt: (who, a, b, d) =>
      `${who} has ${fractionAmount(a, d, "cup")} of milk and pours ${fractionAmount(b, d, "cup")} into the pancake batter. How much milk is left?`,
  },
  {
    object: "trail",
    unit: "mile",
    denoms: UNIT_DENOMS.mile,
    min: 0.1,
    max: 1,
    prompt: (who, a, b, d) =>
      `A trail is ${fractionAmount(a, d, "mile")} long. ${who} has walked ${fractionAmount(b, d, "mile")}. How much of the trail is left?`,
  },
  {
    object: "flour",
    unit: "cup",
    denoms: UNIT_DENOMS.cup,
    min: 0.125,
    max: 1,
    prompt: (who, a, b, d) =>
      `${who} has ${fractionAmount(a, d, "cup")} of flour. ${who} uses ${fractionAmount(b, d, "cup")}. How much flour is left?`,
  },
  {
    object: "garden",
    unit: "meter",
    denoms: [2, 4, 5, 10],
    min: 0.5,
    max: 1,
    prompt: (who, a, b, d) =>
      `${who} is edging a garden bed ${fractionAmount(a, d, "meter")} long. ${who} has placed ${fractionAmount(b, d, "meter")}. How much of the bed is still bare?`,
  },
  {
    object: "paint",
    unit: "liter",
    denoms: [2, 4, 8],
    min: 0.25,
    max: 4,
    prompt: (who, a, b, d) =>
      `${who} opens a can with ${fractionAmount(a, d, "liter")} of paint. ${who} uses ${fractionAmount(b, d, "liter")}. How much paint is left in the can?`,
  },
  {
    object: "chocolate",
    unit: "bar",
    denoms: UNIT_DENOMS.bar,
    min: 0,
    max: 1,
    prompt: (who, a, b, d) =>
      `${who} has ${a}/${d} of a chocolate bar left. ${who} eats ${b}/${d} of the bar. How much of the bar is left now?`,
  },
];

const diffPairs = (scene: DiffScene, d: number): [number, number][] => {
  const pairs: [number, number][] = [];
  for (const a of simplest(d, d * 2)) {
    if (!inRange(a, d, scene.min, scene.max)) continue;
    if (scene.object === "chocolate" && a >= d) continue;
    for (const b of simplest(d, a)) pairs.push([a, b]);
  }
  // Proper fractions are how the amount is said. Halves are the exception:
  // 3/2 and 1/2 is the only simplest pair, and the sentence adds "and a half".
  const proper = pairs.filter(([a]) => a < d);
  return proper.length ? proper : pairs;
};

/** Subtraction of like fractions. Both amounts stay in the prompt as n/d, in simplest form. */
export function likeDifferenceStory(
  r: Random,
  d: number,
): { a: number; b: number; prompt: string; object: string; unit: string } {
  const name = learnerName(r);
  const fitting = diffScenes.filter(
    (scene) => scene.denoms.includes(d) && diffPairs(scene, d).length > 0,
  );
  if (!fitting.length) throw new Error(`No like-difference scene for /${d}`);
  const scene = pick(r, fitting);
  const [a, b] = pick(r, diffPairs(scene, d));
  const said = scene.prompt(name, a, b, d);
  const prompt =
    a === 3 && d === 2 ? said.replace("3/2", "3/2, one and a half,") : said;
  return {
    a,
    b,
    prompt,
    object: scene.object,
    unit: scene.unit,
  };
}

type MixedScene = {
  object: string;
  unit: string;
  denoms: readonly number[];
  prompt: (
    who: string,
    whole: number,
    a: number,
    d: number,
    other: number,
    b: number,
  ) => string;
};

const mixedScenes: readonly MixedScene[] = [
  {
    object: "board",
    unit: "feet",
    denoms: UNIT_DENOMS.foot,
    prompt: (who, whole, a, d, other, b) =>
      `${who}'s board is ${whole} ${a}/${d} feet long. ${who} cuts off ${other} ${b}/${d} feet. How much board is left?`,
  },
  {
    object: "rope",
    unit: "meters",
    denoms: UNIT_DENOMS.meter,
    prompt: (who, whole, a, d, other, b) =>
      `${who}'s rope is ${whole} ${a}/${d} meters long. ${who} cuts off ${other} ${b}/${d} meters. How much rope is left?`,
  },
  {
    object: "hike",
    unit: "miles",
    denoms: UNIT_DENOMS.mile,
    prompt: (who, whole, a, d, other, b) =>
      `${who}'s hike is ${whole} ${a}/${d} miles. ${who} has walked ${other} ${b}/${d} miles. How much of the hike is left?`,
  },
  {
    object: "recipe",
    unit: "cups",
    denoms: UNIT_DENOMS.cup,
    prompt: (who, whole, a, d, other, b) =>
      `A recipe needs ${whole} ${a}/${d} cups of oats. ${who} has poured ${other} ${b}/${d} cups. How many cups are still needed?`,
  },
  {
    object: "practice",
    unit: "hours",
    denoms: UNIT_DENOMS.hour,
    prompt: (who, whole, a, d, other, b) =>
      `${who} plans ${whole} ${a}/${d} hours of practice. ${who} has practiced ${other} ${b}/${d} hours. How much time is left?`,
  },
  {
    object: "path",
    unit: "meters",
    denoms: [2, 4, 5, 10],
    prompt: (who, whole, a, d, other, b) =>
      `${who}'s garden path is ${whole} ${a}/${d} meters long. ${who} has paved ${other} ${b}/${d} meters. How much path is left?`,
  },
  {
    object: "ribbon",
    unit: "feet",
    denoms: UNIT_DENOMS.foot,
    prompt: (who, whole, a, d, other, b) =>
      `${who} has ${whole} ${a}/${d} feet of ribbon and uses ${other} ${b}/${d} feet on a gift. How much ribbon is left?`,
  },
  {
    object: "juice",
    unit: "liters",
    denoms: UNIT_DENOMS.liter,
    prompt: (who, whole, a, d, other, b) =>
      `${who} mixes ${whole} ${a}/${d} liters of juice and pours out ${other} ${b}/${d} liters. How much juice is left?`,
  },
];

/** Mixed-number subtraction. Fraction parts are in simplest form and need a regroup. */
export function mixedDifferenceStory(
  r: Random,
  whole: number,
  other: number,
  d: number,
): {
  a: number;
  b: number;
  prompt: string;
  object: string;
  unit: string;
} {
  const name = learnerName(r);
  const pairs: [number, number][] = [];
  for (const a of simplest(d, d))
    for (const b of simplest(d, d)) if (a < b) pairs.push([a, b]);
  if (!pairs.length) throw new Error(`No regrouping pair for /${d}`);
  const fitting = mixedScenes.filter((scene) => scene.denoms.includes(d));
  if (!fitting.length) throw new Error(`No mixed-difference scene for /${d}`);
  const scene = pick(r, fitting);
  const [a, b] = pick(r, pairs);
  return {
    a,
    b,
    prompt: scene.prompt(name, whole, a, d, other, b),
    object: scene.object,
    unit: scene.unit,
  };
}

type GroupScene = {
  unit: string;
  noun: string;
  denoms: readonly number[];
  min: number;
  max: number;
  prompt: (who: string, groups: number, bit: string) => string;
};

const groupScenes: readonly GroupScene[] = [
  {
    unit: "liter",
    noun: "bottles",
    denoms: [2, 4, 5, 8, 10],
    min: 0.2,
    max: 2,
    prompt: (who, groups, bit) =>
      `${who} fills ${groups} bottles, and each bottle holds ${bit}. How many liters do the bottles hold altogether?`,
  },
  {
    unit: "liter",
    noun: "jars",
    denoms: [2, 4, 8],
    min: 0.125,
    max: 0.75,
    prompt: (who, groups, bit) =>
      `Each jar of jam holds ${bit}. ${who} lines up ${groups} jars. How many liters of jam is that?`,
  },
  {
    unit: "liter",
    noun: "cans",
    denoms: [2, 4, 8, 10],
    min: 0.25,
    max: 4,
    prompt: (who, groups, bit) =>
      `Each can of paint holds ${bit}. ${who} buys ${groups} cans. How many liters of paint is that?`,
  },
  {
    unit: "liter",
    noun: "cups",
    denoms: [10, 100],
    min: 0.01,
    max: 0.2,
    prompt: (who, groups, bit) =>
      `Each medicine cup holds ${bit} of water. ${who} fills ${groups} cups. How many liters of water is that?`,
  },
  {
    unit: "cup",
    noun: "batches",
    denoms: UNIT_DENOMS.cup,
    min: 0.125,
    max: 2,
    prompt: (who, groups, bit) =>
      `One batch of pancakes uses ${bit} of milk. ${who} makes ${groups} batches. How many cups of milk is that?`,
  },
  {
    unit: "mile",
    noun: "laps",
    denoms: [2, 4, 8],
    min: 0.125,
    max: 0.5,
    prompt: (who, groups, bit) =>
      `Each lap ${who} runs is ${bit}. ${who} runs ${groups} laps. How far are the ${groups} laps together?`,
  },
  {
    unit: "mile",
    noun: "blocks",
    denoms: [5, 10],
    min: 0.1,
    max: 0.4,
    prompt: (who, groups, bit) =>
      `Each block ${who} walks is ${bit}. ${who} walks ${groups} blocks. How many miles is that?`,
  },
  {
    unit: "hour",
    noun: "sessions",
    denoms: UNIT_DENOMS.hour,
    min: 1 / 4,
    max: 2,
    prompt: (who, groups, bit) =>
      `Each practice session lasts ${bit}. ${who} goes to ${groups} sessions. How many hours is that?`,
  },
  {
    unit: "hour",
    noun: "drills",
    denoms: UNIT_DENOMS.hour,
    min: 1 / 12,
    max: 1 / 4,
    prompt: (who, groups, bit) =>
      `Each piano drill lasts ${bit}. ${who} does ${groups} drills. How many hours is that?`,
  },
  {
    unit: "foot",
    noun: "pieces",
    denoms: UNIT_DENOMS.foot,
    min: 0.25,
    max: 3,
    prompt: (who, groups, bit) =>
      `${who} cuts ${groups} pieces of ribbon, each ${bit} long. How long are the ${groups} pieces together?`,
  },
  {
    unit: "foot",
    noun: "strips",
    denoms: [6, 12],
    min: 1 / 12,
    max: 0.25,
    prompt: (who, groups, bit) =>
      `${who} cuts ${groups} strips of tape, each ${bit} long. How long are the ${groups} strips together?`,
  },
  {
    unit: "cup",
    noun: "scoops",
    denoms: UNIT_DENOMS.cup,
    min: 0.125,
    max: 0.5,
    prompt: (who, groups, bit) =>
      `Each scoop of flour is ${bit}. ${who} adds ${groups} scoops. How much flour is that altogether?`,
  },
  {
    unit: "inch",
    noun: "beads",
    denoms: UNIT_DENOMS.inch,
    min: 1 / 16,
    max: 1 / 8,
    prompt: (who, groups, bit) =>
      `Each seed bead is ${bit} wide. ${who} lines up ${groups} beads. How long is the row of beads?`,
  },
  {
    unit: "inch",
    noun: "beads",
    denoms: UNIT_DENOMS.inch,
    min: 1 / 8,
    max: 1 / 2,
    prompt: (who, groups, bit) =>
      `Each pony bead is ${bit} wide. ${who} lines up ${groups} beads. How long is the row of beads?`,
  },
  {
    unit: "liter",
    noun: "beds",
    denoms: [2, 4, 5, 8, 10],
    min: 0.25,
    max: 4,
    prompt: (who, groups, bit) =>
      `Each flower bed gets ${bit} of water. ${who} waters ${groups} beds. How many liters of water is that?`,
  },
  {
    unit: "meter",
    noun: "strips",
    denoms: [2, 4, 5, 10, 100],
    min: 0.05,
    max: 2,
    prompt: (who, groups, bit) =>
      `${who} cuts ${groups} strips of tape, each ${bit} long. How long are the ${groups} strips together?`,
  },
];

export function groupsStory(
  r: Random,
  groups: number,
  n: number,
  d: number,
): { prompt: string; unit: string; noun: string } {
  const name = learnerName(r);
  const fitting = groupScenes.filter(
    (scene) => scene.denoms.includes(d) && inRange(n, d, scene.min, scene.max),
  );
  if (!fitting.length)
    throw new Error(`No groups scene for ${groups} × ${n}/${d}`);
  const scene = pick(r, fitting);
  const article = scene.unit === "inch" || scene.unit === "hour" ? "an" : "a";
  const bit = fractionAmount(n, d, scene.unit, article);
  const money = scene.unit === "dollar" ? centWords(n, d) : null;
  const said = money ? `${bit} (${money})` : bit;
  return {
    prompt: scene.prompt(name, groups, said),
    unit: scene.unit,
    noun: scene.noun,
  };
}

const endsWith = (lead: string, equation: string) =>
  lead ? `${lead} ${equation}` : equation;

/** Wholes a child actually cuts into a few equal pieces. */
const SPLIT_WHOLES = [
  "pizza",
  "granola bar",
  "sandwich",
  "tortilla",
  "licorice rope",
  "sheet of paper",
] as const;

export function renameStory(
  r: Random,
  a: number,
  b: number,
  k: number,
): string {
  const name = learnerName(r);
  const target = b * k;
  const equation = `Rename ${a}/${b} as ?/${target}. What is the missing numerator?`;
  const ruler = [2, 4, 8, 16].includes(b) && [2, 4, 8, 16].includes(target);
  const grid = target === 100;
  const pieces = (UNIT_DENOMS.bar as readonly number[]).includes(b) && k <= 4;
  const whole = pick(r, SPLIT_WHOLES);
  const frames = [
    ruler
      ? `${name} reads ${a}/${b} inch on a ruler marked in ${target}ths of an inch.`
      : "",
    grid
      ? `A meter is marked in centimeters. ${name} counts ${a}/${b} meter in hundredths of a meter.`
      : "",
    pieces
      ? `${name} cuts each of the ${b} equal pieces of a chocolate bar into ${k} smaller bites.`
      : "",
    `${name} has ${a}/${b} of ${withArticle(whole)}. ${name} cuts each 1/${b} piece into ${k} equal smaller pieces.`,
    `${name} shades ${a}/${b} of ${withArticle(whole)}, then splits each shaded piece into ${k} equal smaller pieces.`,
  ].filter(Boolean);
  return endsWith(pick(r, frames), equation);
}

export function multiplierStory(
  r: Random,
  a: number,
  b: number,
  k: number,
): string {
  const name = learnerName(r);
  const equation = `${a}/${b} × □/□ = ${a * k}/${b * k}. What number goes in both boxes?`;
  const ruler = [2, 4, 8, 16].includes(b) && [2, 4, 8, 16].includes(b * k);
  const grid = b * k === 100 || k >= 10;
  const pieces = (UNIT_DENOMS.bar as readonly number[]).includes(b) && k <= 6;
  const frames = grid
    ? [
        `A hundred-square grid shows ${a}/${b} shaded. Each small square is one hundredth.`,
        `${name} shades ${a}/${b} of a hundred-square grid.`,
        `${name} counts ${a}/${b} of a meter stick in centimeters.`,
        `${name} marks ${a}/${b} meter, then counts those parts as centimeters.`,
      ]
    : [
        ruler
          ? `${name} reads ${a}/${b} inch on a ruler, then reads that mark in smaller inch parts.`
          : "",
        pieces
          ? `${name} cuts each shaded piece of a chocolate bar into ${k} equal bites.`
          : "",
        ...SPLIT_WHOLES.map(
          (whole) =>
            `${name} has ${a}/${b} of ${withArticle(whole)}. ${name} cuts each piece into ${k} equal smaller pieces.`,
        ),
      ].filter(Boolean);
  return endsWith(pick(r, frames), equation);
}

const texParts = (label: string): { n: number; d: number } => {
  const found = label.match(/\\frac\{(\d+)\}\{(\d+)\}/);
  if (!found) throw new Error(`No fraction in ${label}`);
  return { n: Number(found[1]), d: Number(found[2]) };
};

/** Same-size wholes. Fractions stay as written so the comparison sentence matches. */
export function sameWholeComparePrompt(
  r: Random,
  first: string,
  second: string,
): string {
  const left = texParts(first);
  const right = texParts(second);
  const denoms = [left.d, right.d];
  const both = (unit: keyof typeof UNIT_DENOMS) =>
    denoms.every((d) => denomFits(d, unit));
  const cut = (part: { n: number; d: number }) =>
    gcd(part.n, part.d) === 1 ? "" : ` cut into ${part.d} equal pieces`;
  const [name, other] = [learnerName(r), learnerName(r)];
  const frames: string[] = [];
  if (both("bar") && left.d <= 8 && right.d <= 8)
    frames.push(
      `${name} ate ${first} of a granola bar${cut(left)}. ${other} ate ${second} of a matching granola bar${cut(right)}. Complete the sentence.`,
    );
  if (both("cup"))
    frames.push(
      `${name} used ${first} cup of milk. ${other} used ${second} cup. Complete the sentence.`,
    );
  if (both("hour"))
    frames.push(
      `${name} practiced for ${first} of an hour. ${other} practiced for ${second} of an hour. Complete the sentence.`,
    );
  if (both("mile"))
    frames.push(
      `${name} walked ${first} mile. ${other} walked ${second} mile on the same path. Complete the sentence.`,
    );
  if (both("chapter"))
    frames.push(
      `${name} read ${first} of a chapter. ${other} read ${second} of a chapter the same length. Complete the sentence.`,
    );
  if (both("pizza"))
    frames.push(
      `${name} ate ${first} of a pizza${cut(left)}. ${other} ate ${second} of a same-size pizza${cut(right)}. Complete the sentence.`,
    );
  if (both("meter"))
    frames.push(
      `${name} used ${first} meter of ribbon. ${other} used ${second} meter of ribbon from the same roll. Complete the sentence.`,
    );
  if (!frames.length)
    return `Compare ${first} and ${second}. They are parts of one same-size whole. Complete the sentence.`;
  return pick(r, frames);
}

export type DifferentWhole = {
  small: string;
  large: string;
  pair: string;
};

const DIFFERENT_WHOLES: readonly DifferentWhole[] = [
  { small: "small cracker", large: "large cracker", pair: "crackers" },
  { small: "small pizza", large: "large pizza", pair: "pizzas" },
  { small: "short ribbon", large: "long ribbon", pair: "ribbons" },
  { small: "small cake", large: "large cake", pair: "cakes" },
  { small: "fun size bar", large: "king size bar", pair: "chocolate bars" },
  { small: "short trail", large: "long trail", pair: "trails" },
  { small: "small sandwich", large: "large sandwich", pair: "sandwiches" },
  { small: "small poster", large: "large poster", pair: "posters" },
];

export const differentWhole = (r: Random): DifferentWhole =>
  pick(r, DIFFERENT_WHOLES);
