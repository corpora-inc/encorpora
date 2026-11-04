// Grade-4 fraction contexts. Numbers stay in the caller's model; this file
// only chooses a realistic object, unit, and sentence. Money is never written
// with "$" (that character opens TeX). Names come from ./names.

import { storyName } from "./names.js";

type Random = (lo: number, hi: number) => number;

export const learnerName = (r: Random): string => storyName((n) => r(0, n - 1));

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

/** "3/8 of a foot", "1 foot", or "5/4 feet". */
export function fractionAmount(
  numerator: number,
  denominator: number,
  unit: string,
  article = "a",
): string {
  if (numerator === denominator) return `1 ${unit}`;
  if (numerator < denominator)
    return `${numerator}/${denominator} of ${article} ${unit}`;
  return `${numerator}/${denominator} ${unit}s`;
}

type Scene = {
  object: string;
  unit: string;
  article?: string;
  fits: (denominator: number) => boolean;
  prompt: (name: string, a: number, b: number, d: number) => string;
};

const inch = (d: number) => [2, 4, 8, 16].includes(d);
const foot = (d: number) => [2, 3, 4, 6, 8, 12].includes(d);
const cup = (d: number) => [2, 3, 4, 8].includes(d);
const hour = (d: number) => [2, 3, 4, 6, 12].includes(d);
const mile = (d: number) => [2, 4, 5, 8, 10].includes(d);
const meter = (d: number) => [2, 4, 5, 10, 100].includes(d);
const liter = (d: number) => [2, 4, 5, 8, 10, 100].includes(d);

/** Subtraction of like fractions. Both amounts stay in the prompt as n/d. */
export function likeDifferenceStory(
  r: Random,
  a: number,
  b: number,
  d: number,
): { prompt: string; object: string; unit: string } {
  const name = learnerName(r);
  const scenes: Scene[] = [
    {
      object: "ribbon",
      unit: "foot",
      fits: foot,
      prompt: (who, left, cut, den) =>
        `${who} has a ribbon ${left}/${den} of a foot long and cuts off ${cut}/${den} of a foot. How much ribbon is left?`,
    },
    {
      object: "wood",
      unit: "inch",
      article: "an",
      fits: inch,
      prompt: (who, left, cut, den) =>
        `${who} has a strip of wood ${left}/${den} of an inch long and saws off ${cut}/${den} of an inch. How much wood is left?`,
    },
    {
      object: "rope",
      unit: "meter",
      fits: meter,
      prompt: (who, left, cut, den) =>
        `${who} unrolls ${left}/${den} of a meter of rope and coils ${cut}/${den} of a meter back up. How much rope stays out?`,
    },
    {
      object: "juice",
      unit: "liter",
      fits: liter,
      prompt: (who, left, cut, den) =>
        `${who} has ${left}/${den} of a liter of juice and drinks ${cut}/${den} of a liter. How much juice is left?`,
    },
    {
      object: "practice",
      unit: "hour",
      article: "an",
      fits: hour,
      prompt: (who, left, cut, den) =>
        `${who} planned ${left}/${den} of an hour of piano and has practiced ${cut}/${den} of an hour. How much practice time is left?`,
    },
    {
      object: "trail",
      unit: "mile",
      fits: mile,
      prompt: (who, left, cut, den) =>
        `A trail is ${left}/${den} of a mile long. ${who} has walked ${cut}/${den} of a mile. How much of the trail is left?`,
    },
    {
      object: "recipe",
      unit: "cup",
      fits: cup,
      prompt: (who, left, cut, den) =>
        `${who} has ${left}/${den} of a cup of flour and uses ${cut}/${den} of a cup. How much flour is left?`,
    },
    {
      object: "garden",
      unit: "meter",
      fits: meter,
      prompt: (who, left, cut, den) =>
        `${who} is edging a garden bed ${left}/${den} of a meter long and has placed ${cut}/${den} of a meter. How much bed is still bare?`,
    },
    {
      object: "paint",
      unit: "liter",
      fits: liter,
      prompt: (who, left, cut, den) =>
        `${who} opens ${left}/${den} of a liter of paint and uses ${cut}/${den} of a liter. How much paint is left?`,
    },
    {
      object: "chocolate",
      unit: "bar",
      fits: (den) => [2, 3, 4, 6, 8].includes(den) && a < den && b < a,
      prompt: (who, left, cut, den) =>
        `${who} has ${left}/${den} of a bar of chocolate and eats ${cut}/${den} of a bar. How much of the bar is left?`,
    },
    {
      object: "string",
      unit: "meter",
      fits: () => true,
      prompt: (who, left, cut, den) =>
        `${who} has a string ${left}/${den} of a meter long and cuts off ${cut}/${den} of a meter. How much string is left?`,
    },
  ];
  const fitting = scenes.filter((scene) => scene.fits(d));
  const scene = pick(r, fitting.length ? fitting : scenes.slice(0, 1));
  return {
    prompt: scene.prompt(name, a, b, d),
    object: scene.object,
    unit: scene.unit,
  };
}

/** Mixed-number subtraction. Digit order stays whole, numerator, denominator, twice. */
export function mixedDifferenceStory(
  r: Random,
  whole: number,
  a: number,
  d: number,
  other: number,
  b: number,
): { prompt: string; object: string; unit: string } {
  const name = learnerName(r);
  const scenes: {
    object: string;
    unit: string;
    prompt: string;
  }[] = [
    {
      object: "board",
      unit: "feet",
      prompt: `${name}'s board is ${whole} ${a}/${d} feet long. ${name} cuts off ${other} ${b}/${d} feet. How much board is left?`,
    },
    {
      object: "rope",
      unit: "meters",
      prompt: `${name}'s rope is ${whole} ${a}/${d} meters long. ${name} cuts off ${other} ${b}/${d} meters. How much rope is left?`,
    },
    {
      object: "hike",
      unit: "miles",
      prompt: `${name}'s hike is ${whole} ${a}/${d} miles. ${name} has walked ${other} ${b}/${d} miles. How much of the hike is left?`,
    },
    {
      object: "recipe",
      unit: "cups",
      prompt: `A recipe needs ${whole} ${a}/${d} cups of oats. ${name} has poured ${other} ${b}/${d} cups. How many cups are still needed?`,
    },
    {
      object: "practice",
      unit: "hours",
      prompt: `${name} plans ${whole} ${a}/${d} hours of practice. ${name} has practiced ${other} ${b}/${d} hours. How much time is left?`,
    },
    {
      object: "path",
      unit: "meters",
      prompt: `${name}'s garden path is ${whole} ${a}/${d} meters long. ${name} has paved ${other} ${b}/${d} meters. How much path is left?`,
    },
    {
      object: "ribbon",
      unit: "feet",
      prompt: `${name} has ${whole} ${a}/${d} feet of ribbon and uses ${other} ${b}/${d} feet on a gift. How much ribbon is left?`,
    },
    {
      object: "juice",
      unit: "liters",
      prompt: `${name} mixes ${whole} ${a}/${d} liters of juice and pours out ${other} ${b}/${d} liters. How much juice is left?`,
    },
  ];
  return pick(r, scenes);
}

export function groupsStory(
  r: Random,
  groups: number,
  n: number,
  d: number,
): { prompt: string; unit: string; noun: string } {
  const name = learnerName(r);
  const bit = (unit: string, article = "a") =>
    fractionAmount(n, d, unit, article);
  const scenes: { prompt: string; unit: string; noun: string }[] = [
    {
      unit: "liter",
      noun: "bottles",
      prompt: `${name} fills ${groups} bottles, and each bottle holds ${bit("liter")}. How many liters do the bottles hold altogether?`,
    },
    {
      unit: "cup",
      noun: "batches",
      prompt: `One batch of pancakes uses ${bit("cup")} of milk. ${name} makes ${groups} batches. How many cups of milk is that?`,
    },
    {
      unit: "liter",
      noun: "tubes",
      prompt: `Each tube of paint holds ${bit("liter")}. ${name} buys ${groups} tubes. How many liters of paint is that?`,
    },
    {
      unit: "mile",
      noun: "laps",
      prompt: `Each lap ${name} runs is ${bit("mile")}. ${name} runs ${groups} laps. How many miles is that?`,
    },
    {
      unit: "liter",
      noun: "beds",
      prompt: `Each flower bed gets ${bit("liter")} of water. ${name} waters ${groups} beds. How many liters of water is that?`,
    },
    {
      unit: "hour",
      noun: "sessions",
      prompt: `Each practice session lasts ${bit("hour", "an")}. ${name} goes to ${groups} sessions. How many hours is that?`,
    },
    {
      unit: "foot",
      noun: "pieces",
      prompt: `${name} cuts ${groups} pieces of ribbon, each ${bit("foot")} long. How many feet of ribbon is that?`,
    },
    {
      unit: "liter",
      noun: "jars",
      prompt: `Each jar of jam holds ${bit("liter")}. ${name} lines up ${groups} jars. How many liters of jam is that?`,
    },
  ];
  return pick(r, scenes);
}

export function renameStory(
  r: Random,
  a: number,
  b: number,
  k: number,
): string {
  const name = learnerName(r);
  const target = b * k;
  const frames = [
    `${name} measures ${a}/${b} inch. A finer ruler uses ${target} marks per inch. Rename ${a}/${b} as ?/${target}. What is the missing numerator?`,
    `The shaded part of the bar is ${a}/${b}. Cut each piece into ${k} equal smaller pieces. Rename ${a}/${b} as ?/${target}. What is the missing numerator?`,
    `${name} has ${a}/${b} of a pizza and slices each piece into ${k} smaller bites. Rename ${a}/${b} as ?/${target}. What is the missing numerator?`,
    `A recipe uses ${a}/${b} cup. The cup is also marked in pieces of 1/${target} cup. Rename ${a}/${b} as ?/${target}. What is the missing numerator?`,
  ];
  return pick(r, frames);
}

export function multiplierStory(
  r: Random,
  a: number,
  b: number,
  k: number,
): string {
  const name = learnerName(r);
  const frames = [
    `${name} cuts each piece into ${k} equal smaller pieces. ${a}/${b} × □/□ = ${a * k}/${b * k}. What number goes in both boxes?`,
    `To rename ${a}/${b} without changing the amount, multiply by 1. ${a}/${b} × □/□ = ${a * k}/${b * k}. What number goes in both boxes?`,
    `${name} splits each 1/${b} of a chocolate bar into ${k} equal bites. ${a}/${b} × □/□ = ${a * k}/${b * k}. What number goes in both boxes?`,
    `The same length of ribbon, counted in smaller pieces: ${a}/${b} × □/□ = ${a * k}/${b * k}. What number goes in both boxes?`,
  ];
  return pick(r, frames);
}

/** Same-size wholes. Fractions stay in TeX so the comparison sentence can follow. */
export function sameWholeComparePrompt(
  r: Random,
  first: string,
  second: string,
): string {
  const [name, other] = [learnerName(r), learnerName(r)];
  const frames = [
    `${name} ate ${first} of a granola bar. ${other} ate ${second} of a matching granola bar. Complete the sentence.`,
    `${name} ran ${first} of a lap. ${other} ran ${second} of a lap on the same track. Complete the sentence.`,
    `${name} read ${first} of a chapter. ${other} read ${second} of the same chapter length. Complete the sentence.`,
    `${name} used ${first} of a cup of milk. ${other} used ${second} of a cup. Complete the sentence.`,
    `${name} painted ${first} of a poster. ${other} painted ${second} of a poster the same size. Complete the sentence.`,
    `${name} walked ${first} of a mile. ${other} walked ${second} of a mile on the same path. Complete the sentence.`,
  ];
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
  { small: "fun-size bar", large: "king-size bar", pair: "chocolate bars" },
  { small: "short trail", large: "long trail", pair: "trails" },
  { small: "small sandwich", large: "large sandwich", pair: "sandwiches" },
  { small: "small poster", large: "large poster", pair: "posters" },
];

export const differentWhole = (r: Random): DifferentWhole =>
  pick(r, DIFFERENT_WHOLES);
