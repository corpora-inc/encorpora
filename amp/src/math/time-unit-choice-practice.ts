import type { TemplateMetadata } from "./contracts";
import { defineAxis, type Random } from "./variation/axes";
import {
  chainFamily,
  choiceSurface,
  dispatch,
  pick,
  type ChoiceOption,
} from "./chain-kit";
import { draw } from "./elementary-gap-kit";
import type { Surface } from "./variation/compose";

/**
 * Time and measurement-unit items answered by choosing:
 * - the end time, the start time, or the elapsed hours and minutes, with the
 *   known time shown on an analog clock or written;
 * - the object whose mass or capacity is closest to a stated measure, in
 *   metric or customary units;
 * - the estimate of a measure in another unit from an approximate conversion
 *   factor with a decimal.
 */
const choice = { requiredResponseCapability: "single-choice-v1" as const };

export const elapsedTimeHmTemplate: TemplateMetadata = {
  id: "elapsed-time-hm",
  version: 1,
  title: "Start, end and elapsed time in hours and minutes",
  skillId: "elapsed-time",
  gradeBand: "3–5",
  difficultyOffset: 0.1,
  description:
    "Choose the end time or the start time when the elapsed hours and minutes are known, or the elapsed hours and minutes between two times, with a known time shown on an analog clock or written, in the morning or afternoon.",
  ...choice,
};
export const objectForMeasureTemplate: TemplateMetadata = {
  id: "object-for-measure",
  version: 1,
  title: "The object that matches a measure",
  skillId: "unit-conversion",
  gradeBand: "3–5",
  difficultyOffset: -0.1,
  description:
    "Choose the everyday object whose mass or capacity is closest to a stated measure in metric or customary units.",
  ...choice,
};
export const approximateUnitFactorTemplate: TemplateMetadata = {
  id: "approximate-unit-factor",
  version: 1,
  title: "Estimate a measure with a decimal conversion factor",
  skillId: "measurement-conversions",
  gradeBand: "6–8",
  difficultyOffset: 0.2,
  description:
    "Choose the measure closest to a quantity converted between two units, given a decimal approximate conversion factor, in either direction.",
  ...choice,
};

/* ------------------------------------------------------------------ */
/* 1. Elapsed time in hours and minutes                                */
/* ------------------------------------------------------------------ */

const timeAxes = {
  ask: defineAxis("ask", ["end-time", "start-time", "elapsed"] as const),
  shown: defineAxis("shown", ["analog-clock", "written"] as const),
};
interface TimeModel {
  ask: "end-time" | "start-time" | "elapsed";
  shown: "analog-clock" | "written";
  /** Minutes after midnight. */
  start: number;
  duration: number;
  afternoon: boolean;
  event: { noun: string; verbStart: string; verbEnd: string };
}
const events = [
  { noun: "movie", verbStart: "starts", verbEnd: "ends" },
  { noun: "soccer game", verbStart: "starts", verbEnd: "ends" },
  { noun: "class trip", verbStart: "leaves", verbEnd: "returns" },
  { noun: "play", verbStart: "begins", verbEnd: "ends" },
];

function timeModel(
  r: Random,
  a: { ask: TimeModel["ask"]; shown: TimeModel["shown"] },
): TimeModel {
  const afternoon = !!r(0, 1);
  // Starts between 7:00 and 11:55 in the morning, or 1:00 and 5:55 in the afternoon.
  const hour = afternoon ? r(1, 5) : r(7, 11),
    minute = 5 * r(0, 11);
  const start = (afternoon ? 12 + hour : hour) * 60 + minute;
  const hours = r(1, 4),
    extra = 5 * r(0, 11);
  const duration = hours * 60 + extra;
  if (a.ask === "elapsed" && extra === 0) throw new Error("Need three retries");
  return {
    ask: a.ask,
    shown: a.shown,
    start,
    duration,
    afternoon,
    event: pick(r, events),
  };
}
const clockText = (minutes: number) => {
  const total = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(total / 60),
    m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
};
const hm = (minutes: number) => {
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  const hw = `${h} ${h === 1 ? "hour" : "hours"}`;
  if (!h) return `${m} ${m === 1 ? "minute" : "minutes"}`;
  return m ? `${hw} ${m} ${m === 1 ? "minute" : "minutes"}` : hw;
};
const period = (minutes: number) =>
  minutes % 1440 < 720 ? "morning" : "afternoon";

function timeSurface(m: TimeModel, r: Random): Surface | null {
  const end = m.start + m.duration;
  const h = Math.floor(m.duration / 60),
    extra = m.duration % 60;
  const clock = (minutes: number) => {
    const t = ((minutes % 1440) + 1440) % 1440;
    return {
      kind: "clock" as const,
      hour: Math.floor(t / 60) % 12 || 12,
      minute: t % 60,
    };
  };
  const e = m.event;
  const when = m.afternoon ? "afternoon" : "morning";
  const dur = hm(m.duration);
  const labelOf = (minutes: number) => clockText(minutes);
  const times = (
    correct: number,
    slips: [number, string][],
  ): ChoiceOption[] => {
    const seen = new Set([labelOf(correct)]);
    const out: ChoiceOption[] = [{ label: labelOf(correct), correct: true }];
    for (const [value, feedback] of slips) {
      const label = labelOf(value);
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ label, feedback });
    }
    return out;
  };
  const hourStep = (from: number, hours: number, sign: 1 | -1) =>
    from + sign * hours * 60;
  let figure: Surface["figure"];
  let prompt: string;
  let options: ChoiceOption[];
  let hint: string;
  let explanation: string[];
  let label = "Choose the time";

  if (m.ask === "end-time") {
    const known =
      m.shown === "analog-clock"
        ? `A ${e.noun} ${e.verbStart} at the time shown on the clock, in the ${when}.`
        : `A ${e.noun} ${e.verbStart} at ${labelOf(m.start)}.`;
    if (m.shown === "analog-clock") figure = clock(m.start);
    prompt = `${known} It lasts ${dur}. At what time does it ${e.verbEnd.replace(/s$/, "")}?`;
    options = times(end, [
      [
        m.start - m.duration,
        `That subtracts ${dur} from the start. The ${e.noun} ends later than it ${e.verbStart.replace(/s$/, "")}s, so add.`,
      ],
      [
        hourStep(m.start, h, 1),
        `That adds only the ${h} ${h === 1 ? "hour" : "hours"}. The ${extra} minutes are part of the time too.`,
      ],
      [
        m.start + extra,
        `That adds only the ${extra} minutes. Add the hours as well.`,
      ],
      [
        end + 60,
        "That is one hour too late. Add the hours and minutes exactly, carrying 60 minutes into 1 hour.",
      ],
      [
        end - 60,
        "That is one hour too early. When the minutes reach 60 they carry into the next hour.",
      ],
      [
        end + 10,
        "That is 10 minutes too late. Count the minutes from the start time carefully.",
      ],
    ]);
    hint = `The ${e.noun} lasts ${dur}. ${m.shown === "analog-clock" ? "Read the start time on the clock, then add" : "Add"} the ${h} ${h === 1 ? "hour" : "hours"} first${extra ? `, then the ${extra} minutes` : ""}.`;
    const t1 = hourStep(m.start, h, 1);
    explanation = [
      `${m.shown === "analog-clock" ? `The clock shows the start: ${labelOf(m.start)}.` : `The start time is ${labelOf(m.start)}.`} The ${e.noun} ends later, so add the time it lasts.`,
      `Add the whole hours first, because they move only the hour: ${labelOf(m.start)} + ${h} ${h === 1 ? "hour" : "hours"} = ${labelOf(t1)}.`,
      extra
        ? (t1 % 60) + extra >= 60
          ? `Then add the ${extra} minutes. ${t1 % 60} + ${extra} is ${(t1 % 60) + extra}, ${(t1 % 60) + extra === 60 ? "a full" : "past a full"} 60, and 60 minutes make 1 hour. So the time rolls into the next hour: ${labelOf(end)}.`
          : `Then add the ${extra} minutes: ${labelOf(t1)} + ${extra} minutes = ${labelOf(end)}.`
        : `There are no extra minutes to add.`,
      `The ${e.noun} ends at ${labelOf(end)}.`,
    ];
  } else if (m.ask === "start-time") {
    const known =
      m.shown === "analog-clock"
        ? `A ${e.noun} ${e.verbEnd} at the time shown on the clock, in the ${period(end)}.`
        : `A ${e.noun} ${e.verbEnd} at ${labelOf(end)}.`;
    if (m.shown === "analog-clock") figure = clock(end);
    prompt = `${known} It lasted ${dur}. At what time did it ${e.verbStart.replace(/s$/, "")}?`;
    options = times(m.start, [
      [
        end + m.duration,
        `That adds ${dur} to the end time. The ${e.noun} began before it ${e.verbEnd}, so subtract.`,
      ],
      [
        hourStep(end, h, -1),
        `That subtracts only the ${h} ${h === 1 ? "hour" : "hours"}. Subtract the ${extra} minutes too.`,
      ],
      [
        end - extra,
        `That subtracts only the ${extra} minutes. Subtract the hours as well.`,
      ],
      [
        m.start + 60,
        "That is one hour too late. Subtract the hours and minutes exactly.",
      ],
      [
        m.start - 60,
        "That is one hour too early. When you count back past an hour, borrow 60 minutes.",
      ],
      [
        m.start + 10,
        "That is 10 minutes too late. Count back the minutes carefully.",
      ],
    ]);
    hint = `The ${e.noun} lasted ${dur}, so count back from the end time. ${m.shown === "analog-clock" ? "Read the end time on the clock, then subtract" : "Subtract"} the ${h} ${h === 1 ? "hour" : "hours"} first${extra ? `, then the ${extra} minutes` : ""}.`;
    const t1 = hourStep(end, h, -1);
    explanation = [
      `${m.shown === "analog-clock" ? `The clock shows the end: ${labelOf(end)}.` : `The end time is ${labelOf(end)}.`} The ${e.noun} began earlier, so count back the time it lasted.`,
      `Count back the whole hours first, because they move only the hour: ${labelOf(end)} − ${h} ${h === 1 ? "hour" : "hours"} = ${labelOf(t1)}.`,
      extra
        ? t1 % 60 < extra
          ? t1 % 60 === 0
            ? `Then count back the ${extra} minutes. ${labelOf(t1)} is exactly on the hour, so going back goes into the hour before: ${labelOf(t1)} − ${extra} minutes = ${labelOf(m.start)}.`
            : `Then count back the ${extra} minutes. There are only ${t1 % 60} minutes in this hour, so go back past the hour into the one before: ${labelOf(t1)} − ${extra} minutes = ${labelOf(m.start)}.`
          : `Then count back the ${extra} minutes: ${labelOf(t1)} − ${extra} minutes = ${labelOf(m.start)}.`
        : `There are no extra minutes to count back.`,
      `The ${e.noun} began at ${labelOf(m.start)}.`,
    ];
  } else {
    label = "Choose the elapsed time";
    const known =
      m.shown === "analog-clock"
        ? `A ${e.noun} ${e.verbStart} at the time shown on the clock, in the ${when}, and ${e.verbEnd} at ${labelOf(end)}.`
        : `A ${e.noun} ${e.verbStart} at ${labelOf(m.start)} and ${e.verbEnd} at ${labelOf(end)}.`;
    if (m.shown === "analog-clock") figure = clock(m.start);
    prompt = `${known} How long does it last?`;
    const sh = Math.floor(m.start / 60) % 24,
      sm = m.start % 60,
      eh = Math.floor(end / 60) % 24,
      em = end % 60;
    const cand: [number, string][] = [
      [
        (eh - sh) * 60 + Math.abs(em - sm),
        "That subtracts the minutes without borrowing: when the end minutes are less than the start minutes, an hour must be broken into 60 minutes.",
      ],
      [
        m.duration + 60,
        "That is one hour too long. Count on to the next hour first, then the minutes.",
      ],
      [
        m.duration - 60,
        "That is one hour too short. Count the whole hours and the extra minutes.",
      ],
      [
        m.duration + 30,
        "That is 30 minutes too long. Count the minutes between the two times carefully.",
      ],
      [
        m.duration + 10,
        "That is 10 minutes too long. Count the minutes between the two times carefully.",
      ],
    ];
    const seen = new Set([hm(m.duration)]);
    options = [{ label: hm(m.duration), correct: true }];
    for (const [value, feedback] of cand) {
      if (value <= 0) continue;
      const text = hm(value);
      if (seen.has(text)) continue;
      seen.add(text);
      options.push({ label: text, feedback });
    }
    hint = `${m.shown === "analog-clock" ? "Read the start time on the clock. " : ""}Count on from the start to the next whole hour, then to ${labelOf(end)}, and add the hours and the minutes.`;
    const mid = Math.ceil(m.start / 60) * 60;
    explanation = [
      `Elapsed time is how much time passes from the start to the end.`,
      `${m.shown === "analog-clock" ? `The clock shows the start, ${labelOf(m.start)}` : `The ${e.noun} ${e.verbStart.replace(/s$/, "")}s at ${labelOf(m.start)}`}, and the end time is ${labelOf(end)}.`,
      m.start % 60 === 0
        ? `The start is on the hour, so count whole hours, then the minutes: ${hm(m.duration)}.`
        : `Count on in friendly jumps. First to the next hour: ${labelOf(m.start)} to ${labelOf(mid)} is ${mid - m.start} minutes. Then ${labelOf(mid)} to ${labelOf(end)} is ${hm(end - mid)}.`,
      m.start % 60 === 0
        ? `Check: ${labelOf(m.start)} + ${hm(m.duration)} = ${labelOf(end)}.`
        : `Add the jumps: ${mid - m.start} minutes + ${hm(end - mid)} = ${hm(m.duration)}${mid - m.start + ((end - mid) % 60) >= 60 ? ", because 60 minutes make 1 hour" : ""}.`,
      `The ${e.noun} lasts ${hm(m.duration)}.`,
    ];
  }
  // A time ends in "a.m." or "p.m.": the sentence's own period is not doubled.
  const tidy = (text: string) => text.replace(/([ap]\.m)\.\./g, "$1.");
  const s = choiceSurface(r, {
    prompt: tidy(prompt),
    options,
    hint: tidy(hint),
    explanation: explanation.map(tidy),
    label,
  });
  return s && (figure ? { ...s, figure } : s);
}

export const elapsedTimeHmFamily = chainFamily({
  template: elapsedTimeHmTemplate,
  axes: timeAxes,
  model: timeModel,
  variant: (m) => `${m.ask}-${m.shown}`,
  render: (m, _ax, r) => timeSurface(m, r),
});

/* ------------------------------------------------------------------ */
/* 2. The object that matches a measure                                */
/* ------------------------------------------------------------------ */

const objectAxes = {
  quantity: defineAxis("quantity", ["mass", "capacity"] as const),
  system: defineAxis("system", ["metric", "customary"] as const),
};
interface Thing {
  name: string;
  /** In grams or milliliters (metric), ounces or fluid ounces (customary). */
  value: number;
  measure: [number, string, string];
}
// [count, plural unit, singular unit]
const massMetric: Thing[] = [
  { name: "a paper clip", value: 1, measure: [1, "grams", "gram"] },
  { name: "a pencil", value: 10, measure: [10, "grams", "gram"] },
  { name: "an apple", value: 150, measure: [150, "grams", "gram"] },
  {
    name: "a bag of sugar",
    value: 1000,
    measure: [1, "kilograms", "kilogram"],
  },
  {
    name: "a bowling ball",
    value: 7000,
    measure: [7, "kilograms", "kilogram"],
  },
  {
    name: "a ten-year-old child",
    value: 35000,
    measure: [35, "kilograms", "kilogram"],
  },
  {
    name: "a small car",
    value: 1000000,
    measure: [1000, "kilograms", "kilogram"],
  },
];
const capacityMetric: Thing[] = [
  { name: "a teaspoon", value: 5, measure: [5, "milliliters", "milliliter"] },
  {
    name: "a juice box",
    value: 200,
    measure: [200, "milliliters", "milliliter"],
  },
  { name: "a water bottle", value: 1000, measure: [1, "liters", "liter"] },
  { name: "a bucket", value: 10000, measure: [10, "liters", "liter"] },
  { name: "a bathtub", value: 150000, measure: [150, "liters", "liter"] },
];
const massCustomary: Thing[] = [
  { name: "a slice of bread", value: 1, measure: [1, "ounces", "ounce"] },
  { name: "a loaf of bread", value: 16, measure: [1, "pounds", "pound"] },
  { name: "a bowling ball", value: 224, measure: [14, "pounds", "pound"] },
  { name: "a bicycle", value: 480, measure: [30, "pounds", "pound"] },
  { name: "a small car", value: 32000, measure: [1, "tons", "ton"] },
];
const capacityCustomary: Thing[] = [
  { name: "a teaspoon", value: 1, measure: [1, "teaspoons", "teaspoon"] },
  { name: "a coffee mug", value: 8, measure: [1, "cups", "cup"] },
  { name: "a milk carton", value: 32, measure: [1, "quarts", "quart"] },
  { name: "a milk jug", value: 128, measure: [1, "gallons", "gallon"] },
  { name: "a bathtub", value: 5120, measure: [40, "gallons", "gallon"] },
];
interface ObjectModel {
  quantity: "mass" | "capacity";
  system: "metric" | "customary";
  target: Thing;
  others: Thing[];
  pool: Thing[];
}
function objectModel(
  r: Random,
  a: { quantity: ObjectModel["quantity"]; system: ObjectModel["system"] },
): ObjectModel {
  const pool =
    a.quantity === "mass"
      ? a.system === "metric"
        ? massMetric
        : massCustomary
      : a.system === "metric"
        ? capacityMetric
        : capacityCustomary;
  const target = pick(r, pool);
  const far = pool.filter(
    (t) =>
      t !== target &&
      Math.max(t.value, target.value) / Math.min(t.value, target.value) >= 4,
  );
  if (far.length < 3) throw new Error("Need three retries");
  return {
    quantity: a.quantity,
    system: a.system,
    target,
    others: draw(r, far, 3),
    pool,
  };
}
const measureText = (t: Thing) =>
  `${t.measure[0]} ${t.measure[0] === 1 ? t.measure[2] : t.measure[1]}`;

export const objectForMeasureFamily = chainFamily({
  template: objectForMeasureTemplate,
  axes: objectAxes,
  model: objectModel,
  variant: (m) => `${m.quantity}-${m.system}`,
  render: (m, _ax, r) => {
    const t = m.target;
    const mass = m.quantity === "mass";
    const options: ChoiceOption[] = [
      { label: t.name[0]!.toUpperCase() + t.name.slice(1), correct: true },
      ...m.others.map((o) => ({
        label: o.name[0]!.toUpperCase() + o.name.slice(1),
        feedback: `${o.name[0]!.toUpperCase()}${o.name.slice(1)} ${mass ? "has a mass of" : "holds"} about ${measureText(o)}, ${o.value > t.value ? "much more" : "much less"} than ${measureText(t)}.`,
      })),
    ];
    const relation =
      t.measure[1] === "kilograms"
        ? "1 kilogram is 1000 grams."
        : t.measure[1] === "grams"
          ? "1 kilogram is 1000 grams, so a gram is a small amount."
          : t.measure[1] === "liters"
            ? "1 liter is 1000 milliliters."
            : t.measure[1] === "milliliters"
              ? "1 liter is 1000 milliliters, so a milliliter is a very small amount."
              : t.measure[1] === "pounds"
                ? "1 pound is 16 ounces."
                : t.measure[1] === "ounces"
                  ? "1 pound is 16 ounces, so an ounce is a small amount."
                  : t.measure[1] === "tons"
                    ? "1 ton is 2000 pounds."
                    : t.measure[1] === "gallons"
                      ? "1 gallon is 4 quarts."
                      : t.measure[1] === "quarts"
                        ? "1 quart is a quarter of a gallon."
                        : t.measure[1] === "cups"
                          ? "1 cup is half a pint, and 4 cups make 1 quart."
                          : "3 teaspoons make 1 tablespoon.";
    return choiceSurface(r, {
      prompt: `Which object ${mass ? "has a mass" : "holds an amount of liquid"} closest to ${measureText(t)}?`,
      options,
      hint: `${relation} Picture ${measureText(t)} and compare it with each object, from the smallest to the largest.`,
      explanation: [
        `${relation}`,
        `${measureText(t)[0]!.toUpperCase()}${measureText(t).slice(1)} is about the ${mass ? "mass" : "amount"} of ${t.name}.`,
        ...m.others.map(
          (o) =>
            `${o.name[0]!.toUpperCase()}${o.name.slice(1)} ${mass ? "has a mass of" : "holds"} about ${measureText(o)}, which is ${o.value > t.value ? "much more" : "much less"}.`,
        ),
        `So ${t.name} ${mass ? "has a mass" : "holds an amount"} closest to ${measureText(t)}.`,
      ],
      label: "Choose the object",
    });
  },
});

/* ------------------------------------------------------------------ */
/* 3. An approximate conversion factor                                 */
/* ------------------------------------------------------------------ */

interface Factor {
  /** "meter", "foot": the larger unit then the smaller. */
  big: [string, string];
  small: [string, string];
  /** Smaller units in one larger unit, to two or three digits. */
  rate: number;
  rateText: string;
  /** [name, least, greatest]: a believable size of the item in the larger unit. */
  items: [string, number, number][];
}
const factors: Factor[] = [
  {
    big: ["meter", "meters"],
    small: ["foot", "feet"],
    rate: 3.28,
    rateText: "3.28",
    items: [
      ["a tree", 6, 25],
      ["a flagpole", 6, 30],
      ["a climbing wall", 8, 30],
    ],
  },
  {
    big: ["kilogram", "kilograms"],
    small: ["pound", "pounds"],
    rate: 2.2,
    rateText: "2.2",
    items: [
      ["a bag of potatoes", 2, 10],
      ["a suitcase", 8, 23],
      ["a box of books", 5, 20],
    ],
  },
  {
    big: ["inch", "inches"],
    small: ["centimeter", "centimeters"],
    rate: 2.54,
    rateText: "2.54",
    items: [
      ["a ribbon", 6, 36],
      ["a pencil", 5, 8],
      ["a strip of paper", 6, 24],
    ],
  },
  {
    big: ["mile", "miles"],
    small: ["kilometer", "kilometers"],
    rate: 1.6,
    rateText: "1.6",
    items: [
      ["a bike path", 3, 30],
      ["a hiking trail", 2, 20],
      ["a race course", 3, 26],
    ],
  },
];
const factorAxes = {
  direction: defineAxis("direction", [
    "to-bigger-unit",
    "to-smaller-unit",
  ] as const),
};
interface FactorModel {
  direction: "to-bigger-unit" | "to-smaller-unit";
  factor: Factor;
  item: string;
  amount: number;
}
/** Hundredths to avoid float noise: all arithmetic in integers. */
function factorModel(
  r: Random,
  a: { direction: FactorModel["direction"] },
): FactorModel {
  const factor = pick(r, factors);
  const [item, least, greatest] = pick(r, factor.items);
  // The believable size is stated in the larger unit; the smaller unit has more of them.
  const toSmaller = a.direction === "to-bigger-unit";
  return {
    direction: a.direction,
    factor,
    item,
    amount: toSmaller
      ? r(Math.ceil(least * factor.rate), Math.floor(greatest * factor.rate))
      : r(least, greatest),
  };
}
const tenth = (hundredths: number) =>
  (Math.round(hundredths / 10) / 10).toFixed(1);
export const approximateUnitFactorFamily = chainFamily({
  template: approximateUnitFactorTemplate,
  axes: factorAxes,
  model: factorModel,
  variant: (m) => m.direction,
  render: (m, _ax, r) => {
    const f = m.factor;
    const rate100 = Math.round(f.rate * 100);
    // Work in hundredths.
    const toBig = m.direction === "to-bigger-unit";
    // big -> small multiplies by the rate, small -> big divides by it.
    // `toBig` means the given amount is in the smaller unit (e.g. feet) and
    // the answer is in the larger unit (e.g. meters).
    const given = toBig ? f.small : f.big,
      asked = toBig ? f.big : f.small;
    // Unrounded hundredths: rounding twice (to hundredths, then to tenths)
    // would turn 21.646 into 21.65 and then 21.7 instead of 21.6.
    const exact100 = toBig ? (m.amount * 10000) / rate100 : m.amount * rate100;
    const label = (hundredths: number) => `${tenth(hundredths)} ${asked[1]}`;
    const wrongValues: [number, string][] = toBig
      ? [
          [
            m.amount * rate100,
            `That multiplies by ${f.rateText}. ${f.rateText} ${f.small[1]} make 1 ${f.big[0]}, so ${f.small[1]} are the smaller unit and the number of ${f.big[1]} is less than ${m.amount}: divide.`,
          ],
          [
            Math.round((m.amount - f.rate) * 100),
            `That subtracts ${f.rateText}. Converting units is a division, not a subtraction.`,
          ],
          [
            Math.round((m.amount + f.rate) * 100),
            `That adds ${f.rateText}. Converting units is a division, not an addition.`,
          ],
          [
            exact100 * 10,
            "That is ten times too large. Check where the decimal point goes.",
          ],
        ]
      : [
          [
            Math.round((m.amount * 10000) / rate100),
            `That divides by ${f.rateText}. Each ${f.big[0]} is ${f.rateText} ${f.small[1]}, so there are more ${f.small[1]} than ${f.big[1]}: multiply.`,
          ],
          [
            Math.round((m.amount + f.rate) * 100),
            `That adds ${f.rateText}. Converting units is a multiplication, not an addition.`,
          ],
          [
            Math.round((m.amount - f.rate) * 100),
            `That subtracts ${f.rateText}. Converting units is a multiplication, not a subtraction.`,
          ],
          [
            Math.round(exact100 / 10),
            "That is ten times too small. Check where the decimal point goes.",
          ],
        ];
    const options: ChoiceOption[] = [{ label: label(exact100), correct: true }];
    const seen = new Set([label(exact100)]);
    for (const [v, feedback] of wrongValues) {
      const text = label(v);
      if (v <= 0 || seen.has(text)) continue;
      seen.add(text);
      options.push({ label: text, feedback });
    }
    return choiceSurface(r, {
      prompt: `${m.item[0]!.toUpperCase()}${m.item.slice(1)} measures ${m.amount} ${given[1]}. One ${f.big[0]} is about ${f.rateText} ${f.small[1]}. Which is closest to its measure in ${asked[1]}?`,
      options,
      hint: `One ${f.big[0]} is about ${f.rateText} ${f.small[1]}. ${toBig ? `There are fewer ${f.big[1]} than ${f.small[1]}, so divide ${m.amount} by ${f.rateText}` : `There are more ${f.small[1]} than ${f.big[1]}, so multiply ${m.amount} by ${f.rateText}`}.`,
      explanation: [
        `One ${f.big[0]} is about ${f.rateText} ${f.small[1]}, so ${f.small[1]} are the smaller unit.`,
        toBig
          ? `Going to the bigger unit takes fewer of them, so divide by ${f.rateText}.`
          : `Going to the smaller unit takes more of them, so multiply by ${f.rateText}.`,
        toBig
          ? `${m.amount} ÷ ${f.rateText} = ${(m.amount / f.rate).toFixed(3)}…, which rounds to ${tenth(exact100)} to the nearest tenth.`
          : exact100 % 10 === 0
            ? `${m.amount} × ${f.rateText} = ${tenth(exact100)}.`
            : `${m.amount} × ${f.rateText} = ${(exact100 / 100).toFixed(2)}, which rounds to ${tenth(exact100)} to the nearest tenth.`,
        `The measure is about ${tenth(exact100)} ${asked[1]}.`,
      ],
      label: `Choose the measure in ${asked[1]}`,
    });
  },
});

export const timeUnitChoiceTemplates = [
  elapsedTimeHmTemplate,
  objectForMeasureTemplate,
  approximateUnitFactorTemplate,
] as const;
export const timeUnitChoiceGenerate = dispatch(timeUnitChoiceTemplates, {
  "elapsed-time-hm": (seed) => elapsedTimeHmFamily.generate(seed).problem,
  "object-for-measure": (seed) => objectForMeasureFamily.generate(seed).problem,
  "approximate-unit-factor": (seed) =>
    approximateUnitFactorFamily.generate(seed).problem,
});
