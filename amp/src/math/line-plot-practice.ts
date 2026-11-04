import { createHash } from "node:crypto";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts.js";
import { MAX_STACK, mixedText, stackHeights } from "./data-display-models.js";
import { axisRecord, chooseAxes, defineAxis } from "./variation/axes.js";
import { storyNames } from "./story-kit/names.js";

/** Line plots of measurements, from whole units to fraction operations (grades 2–5). */
const charts = { requiredFigureCapability: "data-displays-v1" } as const;
export const linePlotTemplates: readonly TemplateMetadata[] = [
  {
    id: "line-plot-whole",
    version: 1,
    ...charts,
    title: "Read a line plot",
    skillId: "line-plots",
    gradeBand: "K–2",
    description:
      "Read whole-unit length measurements from a line plot: one length, longer than, how many in all, and longest minus shortest.",
  },
  {
    id: "fraction-line-plot",
    version: 1,
    ...charts,
    title: "Line plots with halves and fourths",
    skillId: "fraction-line-plots",
    gradeBand: "3–5",
    description:
      "Count measurements at or beyond a half- or quarter-unit length on a line plot.",
  },
  {
    id: "fraction-plot-difference",
    version: 1,
    ...charts,
    title: "Add and subtract from a line plot",
    skillId: "fraction-plot-arithmetic",
    gradeBand: "3–5",
    description:
      "Add or subtract like fractions read from a line plot. Most plots use fourths or eighths of an inch. Less often, a plot uses thirds of a cup, fifths or tenths of a mile, or sixths or twelfths of a foot.",
  },
  {
    id: "fraction-plot-equal-share",
    version: 1,
    ...charts,
    title: "Share the total equally",
    skillId: "fraction-plot-computation",
    gradeBand: "3–5",
    description:
      "Find the equal share when every amount on a fractional line plot is pooled and redistributed.",
  },
];

function random(id: string, seed: string) {
  let counter = 0;
  return (lo: number, hi: number) => {
    const span = hi - lo + 1,
      limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([id, 1, seed, counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
}
type Random = ReturnType<typeof random>;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Exact answer text: a reduced fraction or a whole number. */
function rational(n: number, d: number) {
  const g = gcd(Math.abs(n), d) || 1;
  return d / g === 1 ? `${n / g}` : `${n / g}/${d / g}`;
}
/** "3/4 inch", "1 inch", "2 1/4 inches": singular only up to one unit. */
const measure = (v: number, d: number, one: string, many: string) =>
  `${mixedText(v, d)} ${v <= d ? one : many}`;
/** Improper and mixed forms together, e.g. "9/4 (2 1/4)". */
const both = (v: number, d: number) => {
  const r = rational(v, d);
  return r.includes("/") && v > d ? `${r} (${mixedText(v, d)})` : r;
};

const parts = (d: number) =>
  ({
    2: "halves",
    3: "thirds",
    4: "fourths",
    5: "fifths",
    6: "sixths",
    8: "eighths",
    10: "tenths",
    12: "twelfths",
  })[d] ?? `${d}ths`;
/** Grade-4 denominators besides fourths and eighths, at a lower weight.
 * 100 does not fit a line plot: the axis allows at most 12 steps. */
const plotDenomAxis = {
  denominator: defineAxis(
    "denominator",
    [
      "fourths-eighths",
      "thirds",
      "fifths",
      "sixths",
      "tenths",
      "twelfths",
    ] as const,
    { legacy: "fourths-eighths", weights: [12, 2, 2, 2, 2, 1] },
  ),
  /** Plain keeps the original sentence. Vivid is a varied measurement story. */
  setting: defineAxis("setting", ["plain", "vivid"] as const, {
    legacy: "plain",
    weights: [1, 11],
  }),
};
const EXTRA_DENOM = {
  thirds: 3,
  fifths: 5,
  sixths: 6,
  tenths: 10,
  twelfths: 12,
} as const;
/** Other grade-4 denominators, each in a unit where that fraction is ordinary.
 * Inch rulers stay on halves, quarters, and eighths.
 * Plain is the stable sentence. Sixths and twelfths of a foot say why that
 * mark is the one on the plan. */
const EXTRA_STORY = {
  3: {
    one: "cup",
    many: "cups",
    item: "serving",
    items: "servings",
    precision: "third of a cup",
    noun: "amount",
    pair: "greatest and least",
    intro:
      "The line plot shows the amount of rice in some servings, measured to the nearest third of a cup.",
  },
  5: {
    one: "mile",
    many: "miles",
    item: "walk",
    items: "walks",
    precision: "fifth of a mile",
    noun: "distance",
    pair: "longest and shortest",
    intro:
      "The line plot shows how far some students walked on a trail, measured to the nearest fifth of a mile.",
  },
  6: {
    one: "foot",
    many: "feet",
    item: "board",
    items: "boards",
    precision: "sixth of a foot",
    noun: "length",
    pair: "longest and shortest",
    intro:
      "The bookshelf plan spaces every shelf a sixth of a foot apart. The line plot shows the lengths of some boards, measured to the nearest sixth of a foot.",
  },
  10: {
    one: "mile",
    many: "miles",
    item: "walk",
    items: "walks",
    precision: "tenth of a mile",
    noun: "distance",
    pair: "longest and shortest",
    intro:
      "The line plot shows how far some students walked on a trail, measured to the nearest tenth of a mile.",
  },
  12: {
    one: "foot",
    many: "feet",
    item: "piece",
    items: "pieces",
    precision: "twelfth of a foot",
    noun: "length",
    pair: "longest and shortest",
    intro:
      "The dollhouse plan lists lengths in feet, and the small marks are twelfths of a foot. The line plot shows the lengths of some wall pieces, measured to the nearest twelfth of a foot.",
  },
} as const;
type ExtraVivid = {
  one: string;
  many: string;
  item: string;
  items: string;
  precision: string;
  noun: "amount" | "distance" | "length";
  pair: "greatest and least" | "longest and shortest";
  /** A context the 12-seed sample can tell apart from the others. */
  key: string;
  vivid: (name: string) => string;
};
const cup = {
  one: "cup",
  many: "cups",
  precision: "third of a cup",
  noun: "amount",
  pair: "greatest and least",
} as const;
const mile5 = {
  one: "mile",
  many: "miles",
  precision: "fifth of a mile",
  noun: "distance",
  pair: "longest and shortest",
} as const;
const mile10 = {
  one: "mile",
  many: "miles",
  precision: "tenth of a mile",
  noun: "distance",
  pair: "longest and shortest",
} as const;
const foot6 = {
  one: "foot",
  many: "feet",
  precision: "sixth of a foot",
  noun: "length",
  pair: "longest and shortest",
} as const;
const foot12 = {
  one: "foot",
  many: "feet",
  precision: "twelfth of a foot",
  noun: "length",
  pair: "longest and shortest",
} as const;
/** Several recipes, walks, and runs, so one denominator is not one sentence.
 * Sixths and twelfths of a foot only appear with the reason for that mark. */
const EXTRA_VIVID: Record<keyof typeof EXTRA_STORY, readonly ExtraVivid[]> = {
  3: [
    {
      ...cup,
      item: "bowl",
      items: "bowls",
      key: "rice",
      vivid: (name) =>
        `${name} filled bowls with rice for a class lunch. Each bowl was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "bowl",
      items: "bowls",
      key: "oatmeal",
      vivid: (name) =>
        `${name} served oatmeal at breakfast. Each bowl was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "scoop",
      items: "scoops",
      key: "flour",
      vivid: (name) =>
        `${name} scooped flour for pancake batter. Each scoop was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "mug",
      items: "mugs",
      key: "cocoa",
      vivid: (name) =>
        `${name} poured hot cocoa for the class. Each mug was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "glass",
      items: "glasses",
      key: "lemonade",
      vivid: (name) =>
        `${name} mixed lemonade for the picnic. Each glass was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "serving",
      items: "servings",
      key: "yogurt",
      vivid: (name) =>
        `${name} portioned yogurt for smoothies. Each serving was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "serving",
      items: "servings",
      key: "chili",
      vivid: (name) =>
        `${name} measured beans for chili. Each serving was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
    {
      ...cup,
      item: "bowl",
      items: "bowls",
      key: "soup",
      vivid: (name) =>
        `${name} ladled soup for the potluck. Each bowl was measured to the nearest third of a cup. The line plot shows those amounts.`,
    },
  ],
  5: [
    {
      ...mile5,
      item: "walk",
      items: "walks",
      key: "park-walk",
      vivid: (name) =>
        `${name} walked laps around the park. Each walk was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile5,
      item: "run",
      items: "runs",
      key: "practice-run",
      vivid: (name) =>
        `${name} ran at after-school practice. Each run was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile5,
      item: "walk",
      items: "walks",
      key: "school-walk",
      vivid: (name) =>
        `${name} tried different paths to school. Each walk was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile5,
      item: "hike",
      items: "hikes",
      key: "hike",
      vivid: (name) =>
        `${name} logged short hikes with the club. Each hike was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile5,
      item: "jog",
      items: "jogs",
      key: "jog",
      vivid: (name) =>
        `${name} jogged around the neighborhood. Each jog was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile5,
      item: "walk",
      items: "walks",
      key: "dog-walk",
      vivid: (name) =>
        `${name} walked the dogs on several routes. Each walk was measured to the nearest fifth of a mile. The line plot shows those distances.`,
    },
  ],
  6: [
    {
      ...foot6,
      item: "board",
      items: "boards",
      key: "shelves",
      vivid: (name) =>
        `${name} cut boards for shelves. The plan spaces every shelf a sixth of a foot apart, so each board was measured to the nearest sixth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot6,
      item: "stake",
      items: "stakes",
      key: "trellis",
      vivid: (name) =>
        `${name} cut stakes for a garden trellis. The drawing is marked in feet, and the small marks are sixths of a foot, so each stake was measured to the nearest sixth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot6,
      item: "board",
      items: "boards",
      key: "puppet-stage",
      vivid: (name) =>
        `${name} cut boards for a puppet stage. The diagram uses feet, with a mark at every sixth of a foot so the curtains line up. Each board was measured to the nearest sixth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot6,
      item: "rail",
      items: "rails",
      key: "fence",
      vivid: (name) =>
        `${name} cut rails for a fence. The plan puts a rail every sixth of a foot, so each rail was measured to the nearest sixth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot6,
      item: "board",
      items: "boards",
      key: "step-stool",
      vivid: (name) =>
        `${name} cut boards for step stools. The plan is marked in sixths of a foot, so each board was measured to the nearest sixth of a foot. The line plot shows those lengths.`,
    },
  ],
  10: [
    {
      ...mile10,
      item: "walk",
      items: "walks",
      key: "library-walk",
      vivid: (name) =>
        `${name} walked to the library on different days. Each walk was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile10,
      item: "run",
      items: "runs",
      key: "course-run",
      vivid: (name) =>
        `${name} ran a course marked in tenths of a mile. Each run was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile10,
      item: "leg",
      items: "legs",
      key: "fun-run",
      vivid: (name) =>
        `${name} joined the fun run. Each leg was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile10,
      item: "run",
      items: "runs",
      key: "track-run",
      vivid: (name) =>
        `${name} timed practice runs on the track path. Each run was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile10,
      item: "walk",
      items: "walks",
      key: "family-walk",
      vivid: (name) =>
        `${name} walked with the family on Saturday routes. Each walk was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
    {
      ...mile10,
      item: "trip",
      items: "trips",
      key: "errand",
      vivid: (name) =>
        `${name} ran errands on foot. Each trip was measured to the nearest tenth of a mile. The line plot shows those distances.`,
    },
  ],
  12: [
    {
      ...foot12,
      item: "piece",
      items: "pieces",
      key: "dollhouse",
      vivid: (name) =>
        `${name} cut wall pieces for a dollhouse. The plan lists every length in feet, and the small marks are twelfths of a foot. Each piece was measured to the nearest twelfth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot12,
      item: "strip",
      items: "strips",
      key: "picture-frame",
      vivid: (name) =>
        `${name} cut wood strips for a picture frame. The kit is sized in feet, and the marks between the foot numbers are twelfths. Each strip was measured to the nearest twelfth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot12,
      item: "board",
      items: "boards",
      key: "birdhouse",
      vivid: (name) =>
        `${name} cut boards for a birdhouse. The pattern is printed in feet, and the small marks are twelfths of a foot. Each board was measured to the nearest twelfth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot12,
      item: "beam",
      items: "beams",
      key: "model-bridge",
      vivid: (name) =>
        `${name} cut beams for a model bridge. The plan is drawn in feet, with twelfths of a foot between the whole-foot marks. Each beam was measured to the nearest twelfth of a foot. The line plot shows those lengths.`,
    },
    {
      ...foot12,
      item: "spar",
      items: "spars",
      key: "kite",
      vivid: (name) =>
        `${name} cut spars for a kite. The plan gives lengths in feet, and each small mark is a twelfth of a foot. Each spar was measured to the nearest twelfth of a foot. The line plot shows those lengths.`,
    },
  ],
};
/** "16/8 = 2 inches": the value in parts, its simplest form, and an agreeing unit. */
const result = (v: number, d: number, one: string, many: string) =>
  `${v}/${d}${rational(v, d) !== `${v}/${d}` ? ` = ${both(v, d)}` : ""} ${v <= d ? one : many}`;
/** The simplest answer with its unit: "1 inch", "1 1/4 inches", "3/4 liter". */
const measure2 = (v: number, d: number, one: string, many: string) => {
  const r = rational(v, d);
  const text = r.includes("/") && v > d ? mixedText(v, d) : r;
  return `${text} ${v <= d ? one : many}`;
};
const lengthContexts = [
  { item: "pencil", items: "pencils" },
  { item: "leaf", items: "leaves" },
  { item: "shell", items: "shells" },
  { item: "ribbon", items: "ribbons" },
  { item: "feather", items: "feathers" },
] as const;
/** Inch objects a ruler can measure from about 1 to 6 inches. */
const VIVID_INCH = [
  { item: "crayon", items: "crayons", why: "for a still-life drawing" },
  { item: "pencil stub", items: "pencil stubs", why: "from the pencil cup" },
  { item: "earthworm", items: "earthworms", why: "during a garden dig" },
  { item: "leaf", items: "leaves", why: "on the nature walk" },
  { item: "ribbon", items: "ribbons", why: "for bookmarks" },
  { item: "feather", items: "feathers", why: "found on the playground" },
  { item: "seedling", items: "seedlings", why: "in the garden bed" },
  { item: "screw", items: "screws", why: "from the hardware jar" },
  { item: "chalk piece", items: "chalk pieces", why: "in the art tray" },
  { item: "paper strip", items: "paper strips", why: "for a collage" },
  { item: "twig", items: "twigs", why: "for a nest model" },
  { item: "carrot stick", items: "carrot sticks", why: "for snack bags" },
] as const;
function vividInchIntro(
  index: number,
  precise: string,
): { text: string; name: string } {
  const tale = VIVID_INCH[index]!;
  const name = storyNames[index % storyNames.length]!;
  const near = `to the nearest ${precise} inch`;
  const frames = [
    `${name} measured ${tale.items} ${tale.why} ${near}. The line plot shows those lengths.`,
    `The line plot shows the ${tale.items} ${name} measured ${near} ${tale.why}.`,
    `Each mark is one ${tale.item} ${name} measured ${near} ${tale.why}.`,
    `${name} lined up ${tale.items} ${tale.why} and measured each one ${near}. The line plot shows the lengths.`,
  ];
  return { text: frames[index % frames.length]!, name };
}
const units = {
  in: { one: "inch", many: "inches" },
  cm: { one: "centimeter", many: "centimeters" },
} as const;

function sample(r: Random, count: number, lo: number, hi: number) {
  let values: number[];
  do values = Array.from({ length: count }, () => r(lo, hi));
  while (
    Math.max(...stackHeights(values).values()) > MAX_STACK ||
    new Set(values).size < 3
  );
  return values;
}

type Draft = {
  prompt: string;
  figure: SemanticFigure;
  answer: string;
  fraction: boolean;
  hint: string;
  explanation: string[];
};

function countQuestion(
  r: Random,
  d: 1 | 2 | 4,
  values: number[],
  start: number,
  end: number,
  context: (typeof lengthContexts)[number],
  unit: { one: string; many: string },
  intro: string,
  allowSpread: boolean,
): Draft {
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start,
    end,
    values,
    mark: "x",
    unit: unit.many,
  };
  const heights = stackHeights(values);
  const sorted = [...values].sort((a, b) => a - b);
  const name = (v: number) => measure(v, d, unit.one, unit.many);
  const question = r(0, allowSpread ? 3 : 2);
  if (question === 0) {
    const plotted = [...heights.keys()];
    const v = plotted[r(0, plotted.length - 1)]!,
      n = heights.get(v)!;
    return {
      prompt: `${intro} How many ${context.items} are ${name(v)} long?`,
      figure,
      answer: `${n}`,
      fraction: false,
      hint: `Find ${mixedText(v, d)} on the number line. Each × above it is one ${context.item}.`,
      explanation: [
        `A line plot puts one mark (×) above the number line for each ${context.item}, at its length.`,
        `So the marks above ${mixedText(v, d)} show the ${context.items} of that length. Count only that column.`,
        `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} above ${mixedText(v, d)}.`,
        `${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} ${name(v)} long.`,
      ],
    };
  }
  if (question === 1) {
    let v: number;
    do v = r(sorted[0]!, sorted.at(-1)! - 1);
    while (!values.some((x) => x > v));
    const longer = [...heights]
      .filter(([x]) => x > v)
      .sort((a, b) => a[0] - b[0]);
    const n = longer.reduce((s, [, c]) => s + c, 0);
    return {
      prompt: `${intro} How many ${context.items} are longer than ${name(v)}?`,
      figure,
      answer: `${n}`,
      fraction: false,
      hint: `Look only to the right of ${mixedText(v, d)}, not at ${mixedText(v, d)} itself. Count every mark there.`,
      explanation: [
        `Each mark (×) is one ${context.item}, placed above its length. Lengths grow to the right.`,
        `“Longer than ${mixedText(v, d)}” means to the right of ${mixedText(v, d)}. Marks exactly at ${mixedText(v, d)} do not count, because they are not longer.`,
        `To the right of ${mixedText(v, d)}: ${longer.map(([x, c]) => `${c} at ${mixedText(x, d)}`).join(", ")}.`,
        longer.length > 1
          ? `Add the columns: ${longer.map(([, c]) => c).join(" + ")} = ${n}. So ${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} longer than ${name(v)}.`
          : `So ${n} ${n === 1 ? `${context.item} is` : `${context.items} are`} longer than ${name(v)}.`,
      ],
    };
  }
  if (question === 2) {
    const columns = [...heights].sort((a, b) => a[0] - b[0]);
    return {
      prompt: `${intro} How many ${context.items} were measured?`,
      figure,
      answer: `${values.length}`,
      fraction: false,
      hint: `Every × is one measured ${context.item}. Count the marks in each of the ${columns.length} columns, starting above ${mixedText(columns[0]![0], d)}, then add the columns.`,
      explanation: [
        `Each mark (×) on a line plot is one measured ${context.item}, so count every mark.`,
        `Count each column: ${columns.map(([x, c]) => `${c} at ${mixedText(x, d)}`).join(", ")}.`,
        `Add the columns: ${columns.map(([, c]) => c).join(" + ")} = ${values.length}.`,
        `${values.length} ${context.items} were measured.`,
      ],
    };
  }
  const longest = sorted.at(-1)!,
    shortest = sorted[0]!;
  return {
    prompt: `${intro} How many ${unit.many} longer is the longest ${context.item} than the shortest?`,
    figure,
    answer: `${longest - shortest}`,
    fraction: false,
    hint: `The longest ${context.item} is the rightmost mark and the shortest is the leftmost. Read both lengths and subtract, in ${unit.many}.`,
    explanation: [
      `Lengths grow to the right, so the rightmost mark is the longest ${context.item} and the leftmost is the shortest.`,
      `The longest is ${name(longest)}; the shortest is ${name(shortest)}.`,
      `"How many longer" asks for the difference, so subtract: ${longest} − ${shortest} = ${longest - shortest}.`,
      `The longest ${context.item} is ${longest - shortest} ${longest - shortest === 1 ? unit.one : unit.many} longer than the shortest.`,
    ],
  };
}

function wholePlot(r: Random): Draft {
  const context = lengthContexts[r(0, lengthContexts.length - 1)]!;
  const unit = r(0, 1) ? units.in : units.cm;
  const start = r(2, 8),
    end = start + r(6, 10);
  const values = sample(r, r(8, 14), start + 1, end - 1);
  return countQuestion(
    r,
    1,
    values,
    start,
    end,
    context,
    unit,
    `The line plot shows the lengths of some ${context.items}, measured to the nearest ${unit.one}.`,
    true,
  );
}

function fractionPlot(r: Random): Draft {
  const context = lengthContexts[r(0, lengthContexts.length - 1)]!;
  const d = r(0, 1) ? 4 : 2;
  const wholes = d === 4 ? 2 : 3,
    first = r(0, 3);
  const start = first * d,
    end = (first + wholes) * d;
  const values = sample(r, r(8, 14), Math.max(start, 1), end);
  return countQuestion(
    r,
    d,
    values,
    start,
    end,
    context,
    units.in,
    `The line plot shows the lengths of some ${context.items}, measured to the nearest ${d === 4 ? "quarter" : "half"} inch.`,
    false,
  );
}

function vividExtraStory(
  d: keyof typeof EXTRA_STORY,
  values: readonly number[],
) {
  const pool = EXTRA_VIVID[d];
  const mix = values.reduce(
    (sum, value, index) => sum + value * (index + 3),
    d * 17,
  );
  const tale = pool[mix % pool.length]!;
  const name = storyNames[mix % storyNames.length]!;
  return {
    one: tale.one,
    many: tale.many,
    item: tale.item,
    items: tale.items,
    precision: tale.precision,
    noun: tale.noun,
    pair: tale.pair,
    intro: tale.vivid(name),
    name,
  };
}
/** A reason to add the two extreme amounts, in the situation's own words. */
function combinedAsk(story: {
  noun: string;
  pair: string;
  item: string;
  many: string;
  name?: string;
}): string {
  const name = story.name;
  if (!name)
    return `What is the combined ${story.noun} of the ${story.pair} ${story.item}, in ${story.many}?`;
  if (story.noun === "amount")
    return `If ${name} pours the fullest ${story.item} and the smallest ${story.item} together, how many ${story.many} is that?`;
  if (story.noun === "distance")
    return `If ${name} goes on the longest ${story.item} and the shortest ${story.item}, how many ${story.many} is that altogether?`;
  return `If ${name} places the longest and the shortest ${story.item} end to end, how long is that row, in ${story.many}?`;
}
function extraDifference(
  r: Random,
  d: keyof typeof EXTRA_STORY,
  values: number[],
  setting: "plain" | "vivid",
): Draft {
  const story =
    setting === "vivid" ? vividExtraStory(d, values) : EXTRA_STORY[d];
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start: 0,
    end: d === 5 || d === 10 ? 10 : 12,
    values,
    mark: "x",
    unit: story.many,
  };
  const sorted = [...values].sort((a, b) => a - b);
  const longest = sorted.at(-1)!,
    shortest = sorted[0]!;
  const f = (v: number) => `${v}/${d}`;
  const piece = parts(d);
  const lead = `The rightmost mark is the ${story.pair.startsWith("greatest") ? "greatest" : "longest"} ${story.item} and the leftmost is the ${story.pair.startsWith("greatest") ? "least" : "shortest"}. Write both in ${piece}, so the pieces are the same size.`;
  const read = `The ${story.pair.startsWith("greatest") ? "greatest" : "longest"} is ${mixedText(longest, d)} = ${f(longest)} ${longest > d ? story.many : story.one}; the ${story.pair.startsWith("greatest") ? "least" : "shortest"} is ${mixedText(shortest, d)} = ${f(shortest)} ${shortest > d ? story.many : story.one}.`;
  const held = story.noun === "amount" ? "" : " long";
  const question = r(0, 2);
  if (question === 0)
    return {
      prompt: `${story.intro} What is the difference in ${story.noun} between the ${story.pair} ${story.item}, in ${story.many}?`,
      figure,
      answer: rational(longest - shortest, d),
      fraction: true,
      hint: `Write both amounts as ${piece}. Subtract the numerators; the size of the parts stays ${piece}.`,
      explanation: [
        lead,
        read,
        `The difference is what is left after subtracting. With same-size pieces, subtract the top numbers: ${f(longest)} − ${f(shortest)} = ${result(longest - shortest, d, story.one, story.many)}.`,
        `The difference in ${story.noun} is ${measure2(longest - shortest, d, story.one, story.many)}.`,
      ],
    };
  if (question === 1)
    return {
      prompt: `${story.intro} ${combinedAsk(story)}`,
      figure,
      answer: rational(longest + shortest, d),
      fraction: true,
      hint: `Write both amounts as ${piece} and add the numerators. The parts are still ${piece}.`,
      explanation: [
        lead,
        read,
        `Combined means added together. With same-size pieces, add the top numbers: ${f(longest)} + ${f(shortest)} = ${result(longest + shortest, d, story.one, story.many)}.`,
        `The combined ${story.noun} is ${measure2(longest + shortest, d, story.one, story.many)}.`,
      ],
    };
  const heights = stackHeights(values);
  const stacked = [...heights].filter(([, c]) => c > 1);
  const [v, n] = stacked.length
    ? stacked[r(0, stacked.length - 1)]!
    : [...heights][0]!;
  const total = v * n;
  return {
    prompt: `${story.intro} What is the total ${story.noun} of all the ${story.items} that are ${measure(v, d, story.one, story.many)}${held}, in ${story.many}?`,
    figure,
    answer: rational(total, d),
    fraction: true,
    hint:
      setting === "vivid"
        ? `Count the marks at ${mixedText(v, d)}. Add that amount once for each mark, or multiply.`
        : `Count the marks above ${mixedText(v, d)}. Add that amount once for each mark, or multiply.`,
    explanation: [
      `Each mark (×) is one ${story.item}. The marks ${setting === "vivid" ? "at" : "above"} ${mixedText(v, d)} show the ${story.items} of that ${story.noun}.`,
      `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} at ${mixedText(v, d)}. Each one is ${f(v)}.`,
      `Add that amount once for each mark. That is the same as multiplying: ${n} × ${f(v)} = ${result(total, d, story.one, story.many)}.`,
      `Their total ${story.noun} is ${measure2(total, d, story.one, story.many)}.`,
    ],
  };
}

/** A real use of the repeated length: lay those objects in one row. */
function rowOf(name: string, items: string, v: number, d: number): string {
  if (v % d === 0) {
    const inches = v / d;
    return `If ${name} lays all the ${inches}-inch ${items} end to end, how long is the row, in inches?`;
  }
  return `If ${name} lays all the ${items} that are ${measure(v, d, "inch", "inches")} long end to end, how long is the row, in inches?`;
}
function plotDifference(
  r: Random,
  denomAxis: string,
  setting: "plain" | "vivid",
): Draft {
  const picked = r(
    0,
    (setting === "vivid" ? VIVID_INCH.length : lengthContexts.length) - 1,
  );
  const vivid = setting === "vivid" ? VIVID_INCH[picked] : undefined;
  const context = vivid
    ? { item: vivid.item, items: vivid.items }
    : lengthContexts[picked]!;
  // The legacy value draws the denominator first, exactly as before this axis.
  // A cast would hide "fourths-eighths", so the legacy denominator would type as unreachable.
  const extra =
    denomAxis in EXTRA_DENOM
      ? EXTRA_DENOM[denomAxis as keyof typeof EXTRA_DENOM]
      : undefined;
  const d = extra ?? (r(0, 1) ? 8 : 4);
  const first = extra ? 0 : r(0, d === 8 ? 2 : 3),
    start = extra ? 0 : first * d,
    end = extra ? (d === 5 || d === 10 ? 10 : 12) : start + 8;
  const values = sample(r, r(6, 12), Math.max(start, 1), end);
  if (extra) return extraDifference(r, extra, values, setting);
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start,
    end,
    values,
    mark: "x",
    unit: "inches",
  };
  const precise = d === 8 ? "eighth" : "quarter";
  const told = vivid ? vividInchIntro(picked, precise) : undefined;
  const intro = told
    ? told.text
    : `The line plot shows the lengths of some ${context.items}, measured to the nearest ${precise} inch.`;
  const flip = !!vivid && picked % 2 === 0;
  const who = told?.name ?? "";
  const sorted = [...values].sort((a, b) => a - b);
  const longest = sorted.at(-1)!,
    shortest = sorted[0]!;
  const f = (v: number) => `${v}/${d}`;
  const lead = `The rightmost mark is the longest ${context.item} and the leftmost is the shortest. Write both in ${parts(d)}, so the pieces are the same size.`;
  const read = `The longest is ${mixedText(longest, d)} = ${f(longest)} inches; the shortest is ${mixedText(shortest, d)} = ${f(shortest)} inch${shortest > d ? "es" : ""}.`;
  const question = r(0, 2);
  if (question === 0)
    return {
      prompt: flip
        ? `${intro} How much longer is the longest ${context.item} than the shortest, in inches?`
        : `${intro} What is the difference in length between the longest and shortest ${context.item}, in inches?`,
      figure,
      answer: rational(longest - shortest, d),
      fraction: true,
      hint: `Write both lengths as ${parts(d)}. Subtract the numerators; the size of the parts stays ${parts(d)}.`,
      explanation: [
        lead,
        read,
        `The difference is what is left after subtracting. With same-size pieces, subtract the top numbers: ${f(longest)} − ${f(shortest)} = ${result(longest - shortest, d, "inch", "inches")}.`,
        `The difference in length is ${measure2(longest - shortest, d, "inch", "inches")}.`,
      ],
    };
  if (question === 1)
    return {
      prompt: told
        ? `${intro} If ${who} places the longest and the shortest ${context.item} end to end, how long is that row, in inches?`
        : `${intro} What is the combined length of the longest and shortest ${context.item}, in inches?`,
      figure,
      answer: rational(longest + shortest, d),
      fraction: true,
      hint: `Write both lengths as ${parts(d)} and add the numerators. The parts are still ${parts(d)}.`,
      explanation: [
        lead,
        read,
        `Combined means added together. With same-size pieces, add the top numbers: ${f(longest)} + ${f(shortest)} = ${result(longest + shortest, d, "inch", "inches")}.`,
        `The combined length is ${measure2(longest + shortest, d, "inch", "inches")}.`,
      ],
    };
  const heights = stackHeights(values);
  const stacked = [...heights].filter(([, c]) => c > 1);
  const [v, n] = stacked.length
    ? stacked[r(0, stacked.length - 1)]!
    : [...heights][0]!;
  const total = v * n;
  return {
    prompt: told
      ? `${intro} ${rowOf(who, context.items, v, d)}`
      : `${intro} What is the total length of all the ${context.items} that are ${measure(v, d, "inch", "inches")} long, in inches?`,
    figure,
    answer: rational(total, d),
    fraction: true,
    hint: vivid
      ? `Count the marks at ${mixedText(v, d)}. Add that length once for each mark, or multiply.`
      : `Count the marks above ${mixedText(v, d)}. Add that length once for each mark, or multiply.`,
    explanation: [
      `Each mark (×) is one ${context.item}. The marks ${vivid ? "at" : "above"} ${mixedText(v, d)} show the ${context.items} of that length.`,
      vivid
        ? `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} at ${mixedText(v, d)}. Each one is ${f(v)}.`
        : `There ${n === 1 ? "is 1 mark" : `are ${n} marks`} above ${mixedText(v, d)} = ${f(v)}.`,
      `Add that length once for each mark. That is the same as multiplying: ${n} × ${f(v)} = ${result(total, d, "inch", "inches")}.`,
      `Their total length is ${measure2(total, d, "inch", "inches")}.`,
    ],
  };
}

function equalShare(r: Random): Draft {
  const d = ([2, 4, 8] as const)[r(0, 2)]!;
  const count = [4, 5, 6, 8][r(0, 3)]!;
  let values: number[];
  do values = sample(r, count, 1, d * (d === 8 ? 1 : 2));
  while (values.reduce((a, b) => a + b, 0) % count !== 0);
  const sum = values.reduce((a, b) => a + b, 0),
    share = sum / count;
  const figure: SemanticFigure = {
    kind: "line-plot",
    denominator: d,
    start: 0,
    end: d === 8 ? 8 : 2 * d,
    values,
    mark: "x",
    unit: "liters",
  };
  const columns = [...stackHeights(values)].sort((a, b) => a[0] - b[0]);
  const f = (v: number) => `${v}/${d}`;
  return {
    prompt: `The line plot shows the amount of water in ${count} identical beakers. If all the water were shared equally among the beakers, how many liters would each beaker hold?`,
    figure,
    answer: rational(share, d),
    fraction: true,
    hint: `Two steps: add every amount to find the total water, then divide the total by the ${count} beakers.`,
    explanation: [
      `Sharing equally means: put all the water together, then split it into ${count} equal amounts.`,
      `First find the total. Each mark is one beaker, so add each amount once per mark, in ${parts(d)} of a liter: ${columns.map(([v, c]) => `${c} × ${f(v)}`).join(" + ")} = ${result(sum, d, "liter", "liters")}.`,
      `Then split the total among ${count} beakers: ${f(sum)} ÷ ${count} = ${result(share, d, "liter", "liters")}.`,
      `Check: the equal share lies between the least and greatest amounts.`,
      `Each beaker would hold ${measure2(share, d, "liter", "liters")}.`,
    ],
  };
}

export function generateLinePlotProblem(
  templateId: string,
  seed: string,
  force: {
    denominator?: (typeof plotDenomAxis)["denominator"]["values"][number];
    setting?: "plain" | "vivid";
  } = {},
): GeneratedProblem {
  const meta = linePlotTemplates.find((t) => t.id === templateId);
  if (!meta) throw new Error(`Unknown line-plot template ${templateId}`);
  if (typeof seed !== "string" || seed.length < 1 || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  const r = random(templateId, seed);
  const denom =
    templateId === "fraction-plot-difference"
      ? { ...chooseAxes(templateId, seed, plotDenomAxis), ...force }
      : undefined;
  const draft =
    templateId === "line-plot-whole"
      ? wholePlot(r)
      : templateId === "fraction-line-plot"
        ? fractionPlot(r)
        : templateId === "fraction-plot-difference"
          ? plotDifference(r, denom!.denominator, denom!.setting)
          : equalShare(r);
  return {
    public: {
      id: createHash("sha256")
        .update(JSON.stringify([templateId, 1, seed]))
        .digest("hex"),
      templateId,
      templateVersion: 1,
      seed,
      prompt: draft.prompt,
      skillId: meta.skillId,
      response: draft.fraction
        ? {
            kind: "fraction",
            label: "Answer (fraction, decimal, or whole number)",
          }
        : { kind: "number", label: "Answer" },
      figure: draft.figure,
    },
    answer: draft.answer,
    explanation: draft.explanation,
    hint: draft.hint,
    ...(denom
      ? {
          variant: {
            id:
              denom.setting === "plain"
                ? denom.denominator
                : `${denom.denominator}-vivid`,
            axes: axisRecord(denom),
          },
        }
      : {}),
  };
}
