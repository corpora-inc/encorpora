import type { TemplateMetadata } from "./contracts";
import { defineAxis } from "./variation/axes";
import { chainFamily, choiceSurface, dispatch, pick } from "./chain-kit";
import { an, draw } from "./elementary-gap-kit";

export const reasonableMeasureTemplate: TemplateMetadata = {
  id: "reasonable-measure-choice",
  version: 1,
  requiredResponseCapability: "single-choice-v1",
  title: "The reasonable measure or unit",
  skillId: "unit-conversion",
  gradeBand: "3–5",
  difficultyOffset: -0.2,
  description:
    "Choose the most reasonable length, mass or capacity of an everyday object, or the unit that fits a stated amount, among customary and metric units that are far apart in size.",
};

type Attr = "length" | "mass" | "capacity";
/** Size of each unit in meters, kilograms or liters. */
const size: Record<Attr, Record<string, number>> = {
  length: {
    centimeters: 0.01,
    meters: 1,
    kilometers: 1000,
    inches: 0.0254,
    feet: 0.3048,
    yards: 0.9144,
    miles: 1609,
  },
  mass: {
    grams: 0.001,
    kilograms: 1,
    ounces: 0.02835,
    pounds: 0.4536,
    tons: 907,
  },
  capacity: {
    milliliters: 0.001,
    liters: 1,
    teaspoons: 0.005,
    cups: 0.24,
    quarts: 0.95,
    gallons: 3.785,
  },
};
interface Thing {
  attr: Attr;
  /** "the length of a bed", "the mass of an apple". */
  phrase: string;
  /** The reasonable measures: [number, unit], one metric and one customary. */
  metric: [number, string];
  customary: [number, string];
}
const things: Thing[] = [
  {
    attr: "length",
    phrase: "the length of a bed",
    metric: [2, "meters"],
    customary: [6, "feet"],
  },
  {
    attr: "length",
    phrase: "the length of a pencil",
    metric: [18, "centimeters"],
    customary: [7, "inches"],
  },
  {
    attr: "length",
    phrase: "the length of a basketball court",
    metric: [28, "meters"],
    customary: [90, "feet"],
  },
  {
    attr: "length",
    phrase: "the height of a classroom door",
    metric: [2, "meters"],
    customary: [7, "feet"],
  },
  {
    attr: "length",
    phrase: "the width of a classroom",
    metric: [8, "meters"],
    customary: [25, "feet"],
  },
  {
    attr: "length",
    phrase: "the length of a walk to school",
    metric: [2, "kilometers"],
    customary: [1, "miles"],
  },
  {
    attr: "mass",
    phrase: "the mass of an apple",
    metric: [150, "grams"],
    customary: [6, "ounces"],
  },
  {
    attr: "mass",
    phrase: "the mass of a cat",
    metric: [4, "kilograms"],
    customary: [9, "pounds"],
  },
  {
    attr: "mass",
    phrase: "the mass of a bicycle",
    metric: [12, "kilograms"],
    customary: [25, "pounds"],
  },
  {
    attr: "mass",
    phrase: "the mass of a student",
    metric: [35, "kilograms"],
    customary: [75, "pounds"],
  },
  {
    attr: "mass",
    phrase: "the mass of a small car",
    metric: [1500, "kilograms"],
    customary: [2, "tons"],
  },
  {
    attr: "capacity",
    phrase: "the amount of juice in a bottle",
    metric: [1, "liters"],
    customary: [1, "quarts"],
  },
  {
    attr: "capacity",
    phrase: "the amount of milk in a glass",
    metric: [250, "milliliters"],
    customary: [1, "cups"],
  },
  {
    attr: "capacity",
    phrase: "the amount of water in a bathtub",
    metric: [150, "liters"],
    customary: [40, "gallons"],
  },
  {
    attr: "capacity",
    phrase: "the amount of soup in a pot",
    metric: [2, "liters"],
    customary: [2, "quarts"],
  },
  {
    attr: "capacity",
    phrase: "the amount of medicine in a spoon",
    metric: [5, "milliliters"],
    customary: [1, "teaspoons"],
  },
];

const axes = {
  ask: defineAxis("ask", ["measure", "unit"] as const),
  system: defineAxis("system", ["metric", "customary"] as const),
};
interface Model {
  ask: "measure" | "unit";
  thing: Thing;
  n: number;
  unit: string;
  wrong: string[];
}
const fmt = (n: number) => n.toLocaleString("en-US");
const one = (u: string) =>
  u === "feet" ? "foot" : u === "inches" ? "inch" : u.replace(/s$/, "");
function model(
  r: (lo: number, hi: number) => number,
  a: { ask: Model["ask"]; system: "metric" | "customary" },
): Model {
  const thing = pick(r, things);
  const [n, unit] = a.system === "metric" ? thing.metric : thing.customary;
  const target = n * size[thing.attr][unit]!;
  // Units at least four times too large or too small for the stated amount.
  const far = Object.keys(size[thing.attr]).filter((u) => {
    if (u === unit) return false;
    const v = n * size[thing.attr][u]!;
    return Math.max(v, target) / Math.min(v, target) >= 4;
  });
  if (far.length < 3) throw new Error("Need three retries");
  return { ask: a.ask, thing, n, unit, wrong: draw(r, far, 3) };
}
const sizeNote = (attr: Attr, u: string) =>
  attr === "length"
    ? u === "miles" || u === "kilometers"
      ? "a distance walked or driven"
      : u === "inches" || u === "centimeters"
        ? "a small object"
        : "a room or a person"
    : attr === "mass"
      ? u === "tons"
        ? "a vehicle"
        : u === "grams" || u === "ounces"
          ? "a very light object"
          : "something you can carry"
      : u === "gallons" || u === "liters"
        ? "a large container"
        : u === "milliliters" || u === "teaspoons"
          ? "a small spoonful or sip"
          : "a drink or a pot";

export const reasonableMeasure = chainFamily({
  template: reasonableMeasureTemplate,
  axes,
  model,
  variant: (m) => `${m.ask}-${m.thing.attr}`,
  render: (m, _a, r) => {
    const { thing, n, unit } = m;
    const measure = (u: string) => `${fmt(n)} ${n === 1 ? one(u) : u}`;
    const label = (u: string) => (m.ask === "measure" ? measure(u) : u);
    const prompt =
      m.ask === "measure"
        ? `Which is the most reasonable estimate for ${thing.phrase}?`
        : `${thing.phrase[0]!.toUpperCase()}${thing.phrase.slice(1)} is about ${fmt(n)}. Which unit makes the measurement reasonable?`;
    return choiceSurface(r, {
      prompt,
      options: [
        { label: label(unit), correct: true as const },
        ...m.wrong.map((u) => ({
          label: label(u),
          feedback: `${measure(u)} is ${n * size[thing.attr][u]! > n * size[thing.attr][unit]! ? "much too large" : "much too small"} for ${thing.phrase}. ${an(one(u))[0]!.toUpperCase()}${an(one(u)).slice(1)} ${one(u)} suits ${sizeNote(thing.attr, u)}.`,
        })),
      ],
      hint: `Picture ${thing.phrase}. Then test the number ${fmt(n)} with the units: could it really be ${measure(m.wrong[0]!)}, or ${measure(m.wrong[1]!)}? Decide which unit gives an amount that fits.`,
      explanation: [
        `Think about how big ${thing.phrase} is: about ${measure(unit)}.`,
        `${an(one(unit))[0]!.toUpperCase()}${an(one(unit)).slice(1)} ${one(unit)} suits ${sizeNote(thing.attr, unit)}, and ${thing.phrase} is of that size.`,
        `The other units are far too large or too small for ${fmt(n)}.`,
      ],
    });
  },
});

export const reasonableMeasureTemplates = [reasonableMeasureTemplate] as const;
export const reasonableMeasureGenerate = dispatch(reasonableMeasureTemplates, {
  "reasonable-measure-choice": (seed) =>
    reasonableMeasure.generate(seed).problem,
});
