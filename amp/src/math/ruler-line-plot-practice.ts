import { createHash } from "node:crypto";
import { count, plural } from "./agreement";
import type {
  GeneratedProblem,
  SemanticFigure,
  TemplateMetadata,
} from "./contracts";
import { random, shuffle, type Random } from "./distribution-practice";
import {
  CARD,
  problemOf as figureChoiceProblem,
  type Candidate,
} from "./figure-choice-practice";
import {
  serializeMultiPart,
  type MultiPartChoiceResponse,
} from "./multi-part-choice";
import { lineTable, scene } from "./scene/author";
import type { Element, PathOp, Scene } from "./scene/spec";
import { storyNameSet } from "./story-kit/names";

/**
 * Grade-2 measuring and line plots (2.MD.A.4, 2.MD.D.9): how much longer one
 * object is than another, measured on drawn rulers; a length to the nearest
 * whole unit; and the line plot that shows a list of measurements.
 *
 * Rulers and line plots are drawn with scene primitives (scenes-v1). The
 * `ruler` component holds one object whose ends sit on its ticks and numbers
 * every unit up to 15; these items need two objects on one ruler, 30 cm
 * rulers numbered every 2, a measuring tape numbered every 5, and object ends
 * between half-unit ticks. A skipped-scale distractor needs a line plot whose
 * scale is not consecutive, which `dotPlot` cannot draw, so all four plots of
 * one item come from the same builder and only their data differ.
 */

const band = "K–2" as const;
const scenes = { requiredFigureCapability: "scenes-v1" as const };
export const rulerLinePlotTemplates: readonly TemplateMetadata[] = [
  {
    id: "ruler-length-difference",
    version: 1,
    title: "How much longer, measured on a ruler",
    skillId: "ruler-measurement",
    gradeBand: band,
    description:
      "Two objects lie along one ruler or measuring tape, at the same or different start marks. Measure both and find how much longer one is than the other, in the ruler's unit.",
    ...scenes,
  },
  {
    id: "compare-measured-lengths",
    version: 1,
    title: "Which is longer, and by how much",
    skillId: "ruler-measurement",
    gradeBand: band,
    description:
      "Two objects lie on two rulers in the same unit, one starting at 0 and one at a later mark. Choose which is longer, or that they are the same, and how much longer, with the unit.",
    requiredResponseCapability: "multi-part-choice-v1",
    ...scenes,
  },
  {
    id: "ruler-read-nearest-unit",
    version: 1,
    title: "Measure to the nearest whole unit",
    skillId: "line-plots",
    gradeBand: band,
    description:
      "Read the length of an object on a ruler to the nearest whole centimeter or inch. Its end may sit between marks, and it may not start at 0.",
    glossaryNoLink: ["whole"],
    ...scenes,
  },
  {
    id: "line-plot-choose-for-data",
    version: 1,
    title: "Choose the line plot for the measurements",
    skillId: "line-plots",
    gradeBand: band,
    description:
      "Choose the line plot that shows a list or table of whole-unit measurements of several objects, or of one object measured several times, on a scale of consecutive whole numbers.",
    requiredResponseCapability: "figure-choice-v1",
    glossaryNoLink: ["tally"],
    ...scenes,
  },
];
const metaOf = (id: string) => rulerLinePlotTemplates.find((t) => t.id === id)!;

type Unit = "cm" | "in";
const UNIT = {
  cm: { one: "centimeter", many: "centimeters", scale: "cm" },
  in: { one: "inch", many: "inches", scale: "inches" },
} as const;
const unitCount = (n: number, unit: Unit) =>
  count(n, UNIT[unit].one, UNIT[unit].many);
const pick = <T>(r: Random, items: readonly T[]) =>
  items[r(0, items.length - 1)]!;
/** A choice weighted by whole-number shares. */
function weighted<T extends string>(r: Random, shares: [T, number][]): T {
  const total = shares.reduce((sum, [, w]) => sum + w, 0);
  let roll = r(1, total);
  for (const [value, w] of shares) {
    roll -= w;
    if (roll <= 0) return value;
  }
  return shares[shares.length - 1]![0];
}
const sha = (id: string, seed: string) =>
  createHash("sha256")
    .update(JSON.stringify([id, 1, seed]))
    .digest("hex");

/* ------------------------------------------------------------ objects */

/** Realistic lengths, in whole units: [lowest, highest]. Things without a
 * range (ribbon, string…) may be any length. */
type Thing = { name: string; cm?: [number, number]; in?: [number, number] };
const RULER_THINGS: readonly Thing[] = [
  { name: "crayon", cm: [8, 10], in: [3, 4] },
  { name: "paper clip", cm: [3, 4], in: [1, 2] },
  { name: "eraser", cm: [4, 6], in: [2, 2] },
  { name: "marker", cm: [12, 14], in: [5, 5] },
  { name: "pencil", cm: [10, 19], in: [4, 7] },
  { name: "straw", cm: [15, 20], in: [6, 8] },
];
const ANY_LENGTH = ["ribbon", "string", "paper strip", "twig"] as const;
/** "a ribbon", "an eraser". */
const a = (name: string) => `${/^[aeiou]/.test(name) ? "an" : "a"} ${name}`;
/** Things that may be `length` long on this unit's ruler. */
function thingsFor(length: number, unit: Unit): string[] {
  const named = RULER_THINGS.filter((t) => {
    const range = t[unit];
    return range && length >= range[0] && length <= range[1];
  }).map((t) => t.name);
  return [...named, ...ANY_LENGTH];
}
/** Two different names, each realistic at its length. Named things are
 * preferred when one fits; otherwise a ribbon, string, strip or yarn. */
function twoNames(
  r: Random,
  lengths: [number, number],
  unit: Unit,
  anyOnly: boolean,
): [string, string] {
  const options = lengths.map((l) => {
    const all = anyOnly ? [...ANY_LENGTH] : thingsFor(l, unit);
    const named = all.filter(
      (n) => !(ANY_LENGTH as readonly string[]).includes(n),
    );
    return named.length && r(0, 3) > 0 ? named : all;
  });
  const first = pick(r, options[0]!);
  const second = options[1]!.filter((n) => n !== first);
  if (!second.length) throw new Error("Need two different objects");
  return [first, pick(r, second)];
}

/* ------------------------------------------------------------ rulers */

const SCENE_WIDTH = 360;
type Bar = { name: string; from: number; to: number; tone: "accent" | "warm" };
type RulerDraw = {
  id: string;
  unit: Unit;
  length: number;
  labelEvery: number;
  half: boolean;
  tape: boolean;
  /** Bars from the ruler's edge upward, one row each. */
  bars: Bar[];
  /** Math-unit height of the ruler's top edge. */
  top: number;
};
/** The figure's approximate pixels per unit, so marks keep pixel sizes. */
const pxPer = (length: number) => (SCENE_WIDTH - 8) / (length + 1.2);
/** Height above a ruler's top edge used by its bars and their names. */
const barSpace = (rows: number, length: number) =>
  (14 + rows * 42) / pxPer(length);
const rulerDepth = (length: number) => 64 / pxPer(length);

function rulerElements(d: RulerDraw): Element[] {
  const px = (p: number) => p / pxPer(d.length);
  const margin = px(d.tape ? 6 : 12),
    height = px(40),
    top = d.top;
  const els: Element[] = [
    {
      type: "rect",
      id: `${d.id}-body`,
      at: [-margin, top - height],
      size: [d.length + 2 * margin, height],
      radius: d.tape ? 1 : 4,
      fill: d.tape ? "gold-fill" : "empty",
      stroke: "ink",
      width: 1.5,
    },
  ];
  const major: PathOp[] = [],
    minor: PathOp[] = [];
  const numbers: Element[] = [];
  for (let k = 0; k <= d.length; k++) {
    const labeled = k % d.labelEvery === 0;
    (labeled ? major : minor).push(
      ["M", k, top],
      ["L", k, top - px(labeled ? 18 : 12)],
    );
    if (d.half && k < d.length)
      minor.push(["M", k + 0.5, top], ["L", k + 0.5, top - px(8)]);
    if (labeled)
      numbers.push({
        type: "text",
        id: `${d.id}-n${k}`,
        at: [k, top - px(20)],
        text: String(k),
        font: "sans",
        size: "sm",
        align: [0, -1],
      });
  }
  els.push({
    type: "path",
    id: `${d.id}-ticks`,
    d: major,
    stroke: "ink",
    width: 1.5,
  });
  if (minor.length >= 2)
    els.push({
      type: "path",
      id: `${d.id}-minor`,
      d: minor,
      stroke: "ink",
      width: 1,
    });
  els.push(...numbers, {
    type: "text",
    id: `${d.id}-unit`,
    at: [d.length + margin, top - height],
    text: UNIT[d.unit].scale,
    font: "sans",
    size: "sm",
    color: "muted",
    align: [1, -1],
    offset: [0, 4],
  });
  const thick = px(16);
  const rowBase = (i: number) => top + px(14) + i * px(42);
  // Guides first, so a lower bar covers the guide of the bar above it.
  for (const [i, bar] of d.bars.entries())
    for (const [end, x] of [
      ["s", bar.from],
      ["e", bar.to],
    ] as const)
      els.push({
        type: "segment",
        id: `${d.id}-g${i}${end}`,
        from: [x, rowBase(i)],
        to: [x, top],
        stroke: "axis",
        width: 1,
        dash: "dash",
      });
  for (const [i, bar] of d.bars.entries())
    els.push(
      {
        type: "rect",
        id: `${d.id}-bar${i}`,
        at: [bar.from, rowBase(i)],
        size: [bar.to - bar.from, thick],
        radius: 4,
        fill: bar.tone === "accent" ? "accent-fill" : "warm-fill",
        stroke: "ink",
        width: 1.5,
      },
      {
        type: "text",
        id: `${d.id}-name${i}`,
        at: [(bar.from + bar.to) / 2, rowBase(i) + thick],
        text: bar.name,
        font: "sans",
        size: "sm",
        align: [0, 1],
        offset: [0, -4],
      },
    );
  return els;
}
/** "3", or "3.7" for an end between marks: positions are exact tenths. */
const at10 = (tenths: number) => tenths / 10;
const where = (x: number) =>
  Number.isInteger(x)
    ? `at the ${x} mark`
    : `${Math.round((x - Math.floor(x)) * 10)} tenths of the way from the ${Math.floor(x)} mark to the ${Math.floor(x) + 1} mark`;
function rulerSentence(d: RulerDraw) {
  return `${d.tape ? "A measuring tape" : "A ruler"} numbered from 0 to ${d.length} ${UNIT[d.unit].many}${d.labelEvery > 1 ? `, with a number at every ${d.labelEvery} ${UNIT[d.unit].many} and a tick at every ${UNIT[d.unit].one}` : ""}.`;
}
const barSentence = (bar: Bar) =>
  `The ${bar.name} starts ${where(bar.from)} and ends ${where(bar.to)}.`;

/* ------------------------------------------- how much longer (number) */

type Phrasing = "longer" | "shorter" | "need";
function askFor(
  phrasing: Phrasing,
  longer: string,
  shorter: string,
  unit: Unit,
) {
  if (phrasing === "longer")
    return `How much longer is the ${longer} than the ${shorter}? Answer in ${UNIT[unit].many}.`;
  if (phrasing === "shorter")
    return `How much shorter is the ${shorter} than the ${longer}? Answer in ${UNIT[unit].many}.`;
  return `How many more ${UNIT[unit].many} does the ${shorter} need to be as long as the ${longer}?`;
}
type Measured = { name: string; start: number; end: number; length: number };
function measureStep(m: Measured, unit: Unit, ordinal: string) {
  return m.start === 0
    ? `Measure the ${ordinal} object. The ${m.name} starts at 0, so its length is the end mark: ${unitCount(m.length, unit)}.`
    : `Measure the ${ordinal} object. The ${m.name} starts at ${m.start} and ends at ${m.end}. Its length is end minus start: $${m.end} - ${m.start} = ${m.length}$ ${UNIT[unit].many}.`;
}

function lengthDifference(seed: string, salt: string): GeneratedProblem {
  const meta = metaOf("ruler-length-difference");
  const r = random(meta.id, salt);
  // Kinds come from the seed alone, so redrawn numbers never tilt the mix.
  const k = random(`${meta.id}#kind`, seed);
  const variant = weighted(k, [
    ["a-start-zero", 25],
    ["b-same-start", 25],
    ["c-different-starts", 35],
    ["d-tape", 15],
  ]);
  const tape = variant === "d-tape";
  const unit: Unit = tape ? "cm" : k(0, 1) ? "cm" : "in";
  const ruler = tape ? 40 : unit === "in" ? 12 : r(0, 1) ? 15 : 30;
  const maxDiff = tape ? 25 : unit === "cm" ? 12 : 8;
  const minLength = tape ? 12 : 2;
  const maxLength = tape ? 38 : ruler;
  let starts: [number, number];
  if (variant === "a-start-zero") starts = [0, 0];
  else if (variant === "b-same-start") {
    const s = r(1, 5);
    starts = [s, s];
  } else if (variant === "c-different-starts") {
    const s1 = r(0, 6);
    let s2 = r(0, 5);
    if (s2 >= s1) s2++;
    starts = [s1, s2];
  } else if (r(0, 1)) starts = [0, 0];
  else {
    const s1 = r(0, 5);
    let s2 = r(1, 5);
    if (s2 === s1) s2 = s1 === 5 ? 1 : s1 + 1;
    starts = r(0, 1) ? [s1, s2] : [s2, s1];
  }
  const longer = r(0, 1);
  const room = Math.min(maxLength, ruler - Math.max(...starts));
  const d = r(1, maxDiff);
  if (room - d < minLength) throw new Error("Need room for both objects");
  const short = r(minLength, room - d);
  const lengths: [number, number] =
    longer === 0 ? [short + d, short] : [short, short + d];
  const ends: [number, number] = [
    starts[0] + lengths[0],
    starts[1] + lengths[1],
  ];
  if (ends[0] > ruler || ends[1] > ruler)
    throw new Error("Need both objects on the ruler");
  if (starts[0] !== starts[1] && Math.abs(ends[0] - ends[1]) === d)
    throw new Error("Need end marks that do not give the difference");
  const names = twoNames(r, lengths, unit, variant === "a-start-zero");
  const measured: Measured[] = [0, 1].map((i) => ({
    name: names[i]!,
    start: starts[i]!,
    end: ends[i]!,
    length: lengths[i]!,
  }));
  const long = measured[longer]!,
    shortObj = measured[1 - longer]!;
  // Row 0 sits on the ruler; the longer object is on top in half the items.
  const onTop = r(0, 1);
  const rows = onTop ? [shortObj, long] : [long, shortObj];
  const draw: RulerDraw = {
    id: "ruler",
    unit,
    length: ruler,
    labelEvery: tape ? 5 : ruler > 15 ? 2 : 1,
    half: ruler <= 15,
    tape,
    top: 0,
    bars: rows.map((m, i) => ({
      name: m.name,
      from: m.start,
      to: m.end,
      tone: i === 0 ? "accent" : "warm",
    })),
  };
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(...rulerElements(draw)).build({
      title: `${draw.tape ? "A measuring tape" : "A ruler"} with ${a(rows[0]!.name)} and ${a(rows[1]!.name)} above it`,
      note: [rulerSentence(draw), ...draw.bars.map(barSentence)].join(" "),
      width: SCENE_WIDTH,
    }),
  };
  const phrasing = pick(r, ["longer", "shorter", "need"] as const);
  const prompt = `${a(rows[1]!.name)[0]!.toUpperCase()}${a(rows[1]!.name).slice(1)} and ${a(rows[0]!.name)} lie along ${tape ? "a measuring tape" : "a ruler"}. ${askFor(phrasing, long.name, shortObj.name, unit)}`;
  return {
    public: {
      id: sha(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt,
      skillId: meta.skillId,
      response: { kind: "number", label: UNIT[unit].many },
      figure,
    },
    answer: String(d),
    hint: `Find the length of the ${measured[0]!.name} and of the ${measured[1]!.name} first: end mark minus start mark. Then subtract the shorter length from the longer one. Your answer is a number of ${UNIT[unit].many}.`,
    explanation: [
      measureStep(measured[0]!, unit, "first"),
      measureStep(measured[1]!, unit, "second"),
      `The ${long.name} is longer. Longer minus shorter: $${long.length} - ${shortObj.length} = ${d}$.`,
      `The ${long.name} is ${unitCount(d, unit)} longer than the ${shortObj.name}. Check: $${shortObj.length} + ${d} = ${long.length}$.`,
      ...(long.start !== shortObj.start
        ? [
            `Subtracting the end marks, $${Math.max(long.end, shortObj.end)} - ${Math.min(long.end, shortObj.end)} = ${Math.abs(long.end - shortObj.end)}$, does not work here, because the two objects start at different marks.`,
          ]
        : []),
    ],
    variant: {
      id: variant,
      axes: {
        unit,
        phrasing,
        "longer-row": onTop ? "top" : "bottom",
      },
    },
  };
}

/* --------------------------------- which is longer, by how much (parts) */

const optionsOf = (labels: readonly string[]) =>
  labels.map((label, i) => ({ id: "abcdef"[i]!, label }));
function compareLengths(seed: string, salt: string): GeneratedProblem {
  const meta = metaOf("compare-measured-lengths");
  const r = random(meta.id, salt);
  // Kinds come from the seed alone, so redrawn numbers never tilt the mix.
  const k = random(`${meta.id}#kind`, seed);
  const unit: Unit = k(0, 1) ? "cm" : "in";
  const ruler = unit === "cm" ? 30 : 12;
  const equal = k(1, 100) <= 12;
  const maxDiff = unit === "cm" ? 12 : 8;
  const [lo, hi] = unit === "cm" ? [3, 28] : [2, 11];
  // One object starts at 0 and the other, the shifted one, at s. In about
  // half the unequal items the shorter object is shifted and its end reaches
  // the bigger number, so reading the ends alone gives the wrong object.
  const misleading = !equal && k(0, 1) === 1;
  let s: number, d: number, shiftedIsLonger: boolean;
  if (equal) {
    s = r(1, 5);
    d = 0;
    shiftedIsLonger = false;
  } else if (misleading) {
    s = r(2, 5);
    d = r(1, s - 1);
    shiftedIsLonger = false;
  } else {
    s = r(1, 5);
    d = r(1, maxDiff);
    shiftedIsLonger = d <= s || r(0, 2) > 0;
  }
  // The end marks differ by s + d (longer shifted), |s − d| (shorter
  // shifted) or s (same length); never by the true difference.
  if (!equal && !shiftedIsLonger && s === 2 * d)
    throw new Error("Need end marks that do not give the difference");
  // short + d stays within the realistic top, and the shifted object's end
  // stays on the ruler.
  const room = shiftedIsLonger
    ? Math.min(hi, ruler - s) - d
    : Math.min(hi - d, ruler - s);
  if (room < lo) throw new Error("Need room for both objects");
  const short = r(lo, room);
  const lengths = {
    shifted: shiftedIsLonger ? short + d : short,
    fixed: shiftedIsLonger ? short : short + d,
  };
  if (s + lengths.shifted > ruler || short + d > hi)
    throw new Error("Need both objects on the ruler");
  const shiftedFirst = r(0, 1) === 1;
  const objs: Measured[] = [];
  const names = twoNames(
    r,
    shiftedFirst
      ? [lengths.shifted, lengths.fixed]
      : [lengths.fixed, lengths.shifted],
    unit,
    false,
  );
  for (const [i, shifted] of (shiftedFirst
    ? [true, false]
    : [false, true]
  ).entries()) {
    const start = shifted ? s : 0;
    const length = shifted ? lengths.shifted : lengths.fixed;
    objs.push({ name: names[i]!, start, end: start + length, length });
  }
  const [first, second] = [objs[0]!, objs[1]!];
  const top = 0;
  const lower = -(rulerDepth(ruler) + barSpace(1, ruler) + 10 / pxPer(ruler));
  const draws: RulerDraw[] = [first, second].map((m, i) => ({
    id: `ruler${i}`,
    unit,
    length: ruler,
    labelEvery: ruler > 15 ? 2 : 1,
    half: ruler <= 15,
    tape: false,
    top: i === 0 ? top : lower,
    bars: [
      {
        name: m.name,
        from: m.start,
        to: m.end,
        tone: i === 0 ? "accent" : "warm",
      },
    ],
  }));
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(...draws.flatMap(rulerElements)).build({
      title: `Two rulers: ${a(first.name)} on the top ruler and ${a(second.name)} on the bottom ruler`,
      note: [
        `Each ruler is numbered from 0 to ${ruler} ${UNIT[unit].many}${ruler > 15 ? ", with a number at every 2 centimeters and a tick at every centimeter" : ""}.`,
        ...draws.map((dr) => barSentence(dr.bars[0]!)),
      ].join(" "),
      width: SCENE_WIDTH,
    }),
  };
  const longerObj =
    first.length > second.length
      ? first
      : second.length > first.length
        ? second
        : null;
  const shorterObj =
    longerObj === first ? second : longerObj === second ? first : null;
  const same = "They are the same length";
  const firstOptions = shuffle(r, [first.name, second.name]);
  firstOptions.push(same);
  const amount = (n: number, u: Unit = unit) => unitCount(n, u);
  const other: Unit = unit === "cm" ? "in" : "cm";
  const key = amount(d);
  const endsGap = Math.abs(first.end - second.end);
  const candidates: { label: string; value: number }[] = [];
  const add = (label: string, value: number) => {
    if (value < 0 || value > ruler) return;
    if (label === key || candidates.some((c) => c.label === label)) return;
    candidates.push({ label, value });
  };
  add(amount(endsGap), endsGap);
  if (!equal) add(amount(d, other), d);
  const extras = shuffle(r, [
    { label: amount(d + 1), value: d + 1 },
    ...(d > 1 ? [{ label: amount(d - 1), value: d - 1 }] : []),
    ...(longerObj
      ? [{ label: amount(longerObj.length), value: longerObj.length }]
      : []),
    {
      label: amount(first.length + second.length),
      value: first.length + second.length,
    },
  ]);
  for (const e of extras) if (candidates.length < 3) add(e.label, e.value);
  if (candidates.length < 3) throw new Error("Need three wrong amounts");
  const secondOptions = shuffle(r, [key, ...candidates.map((c) => c.label)]);
  const response: MultiPartChoiceResponse = {
    kind: "multi-part-choice",
    label: "Choose an answer for each part",
    layout: "slots",
    blanks: [
      {
        id: "longer",
        label: "Which is longer?",
        options: optionsOf(firstOptions),
      },
      { id: "by", label: "By how much?", options: optionsOf(secondOptions) },
    ],
  };
  const keyOf = (blank: number, label: string) =>
    response.blanks[blank]!.options.find((o) => o.label === label)!.id;
  const answer = serializeMultiPart(response, {
    longer: keyOf(0, longerObj ? longerObj.name : same),
    by: keyOf(1, key),
  });
  const measure = (m: Measured) =>
    m.start === 0
      ? `The ${m.name} starts at 0 and ends at ${m.end}, so its length is ${amount(m.length)}.`
      : `The ${m.name} starts at ${m.start} and ends at ${m.end}. Its length is $${m.end} - ${m.start} = ${m.length}$ ${UNIT[unit].many}.`;
  const explanation = [
    measure(first),
    measure(second),
    longerObj && shorterObj
      ? `${longerObj.length} is more than ${shorterObj.length}, so the ${longerObj.name} is longer. You cannot tell from where the ends are, because the two objects start at different marks.`
      : `Both are ${amount(first.length)} long, so they are the same length, even though one end reaches a bigger number.`,
    longerObj && shorterObj
      ? `$${longerObj.length} - ${shorterObj.length} = ${d}$, so the ${longerObj.name} is ${amount(d)} longer than the ${shorterObj.name}. The rulers are marked in ${UNIT[unit].many}, so the answer is in ${UNIT[unit].many}.`
      : `$${first.length} - ${second.length} = 0$. The difference is ${amount(0)}.`,
  ];
  const endFarther =
    !equal && longerObj
      ? longerObj.end > (shorterObj as Measured).end
        ? "longer"
        : "shorter"
      : "equal";
  return {
    public: {
      id: sha(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `${a(first.name)[0]!.toUpperCase()}${a(first.name).slice(1)} lies on the top ruler and ${a(second.name)} lies on the bottom ruler. Both rulers are marked in ${UNIT[unit].many}. Measure both objects. Which is longer, and by how much?`,
      skillId: meta.skillId,
      response,
      figure,
    },
    answer,
    hint: `The ${first.name} and the ${second.name} do not start at the same mark, so measure each one: end mark minus start mark. Then compare the two lengths.`,
    explanation,
    variant: {
      id: equal ? "equal" : "unequal",
      axes: { unit, "farther-end": endFarther },
    },
  };
}

/* ------------------------------------- nearest whole unit (number) */

/** Lengths in whole units that are realistic for each thing. */
type PlotThing = { one: string; cm: [number, number]; in: [number, number] };
const PLOT_THINGS: readonly PlotThing[] = [
  { one: "crayon", cm: [7, 10], in: [3, 4] },
  { one: "pencil", cm: [8, 19], in: [3, 7] },
  { one: "ribbon", cm: [1, 20], in: [1, 12] },
  { one: "leaf", cm: [3, 12], in: [1, 5] },
  { one: "straw", cm: [12, 20], in: [5, 8] },
  { one: "paper clip chain", cm: [5, 20], in: [2, 12] },
  { one: "shoe", cm: [12, 20], in: [5, 8] },
  { one: "stick", cm: [3, 20], in: [2, 12] },
  { one: "string", cm: [1, 20], in: [1, 12] },
  { one: "feather", cm: [5, 15], in: [2, 6] },
  { one: "block", cm: [2, 8], in: [1, 3] },
  { one: "eraser", cm: [3, 7], in: [1, 3] },
];
const fits = (t: PlotThing, unit: Unit, lo: number, hi: number) =>
  t[unit][0] <= lo && hi <= t[unit][1];

function nearestUnit(seed: string, salt: string): GeneratedProblem {
  const meta = metaOf("ruler-read-nearest-unit");
  const r = random(meta.id, salt);
  // Kinds come from the seed alone, so redrawn numbers never tilt the mix.
  const k = random(`${meta.id}#kind`, seed);
  const variant = weighted(k, [
    ["on-tick", 25],
    ["between-ticks", 45],
    ["nonzero-start", 30],
  ]);
  const unit: Unit = k(0, 1) ? "cm" : "in";
  const most = unit === "cm" ? 15 : 12;
  let start = 0,
    tenths = 0,
    answer: number;
  if (variant === "on-tick") {
    answer = r(2, most - 1);
  } else if (variant === "between-ticks") {
    tenths = pick(r, [2, 3, 7, 8]);
    answer = r(2, most - 1);
    if (tenths > 5 && answer - 1 + tenths / 10 > most - 0.2)
      throw new Error("Need the end on the ruler");
  } else {
    start = r(1, 5);
    tenths = pick(r, [0, 2, 3, 7, 8]);
    answer = r(2, 12);
  }
  // The whole units the end passed: the answer, or one less when it rounds up.
  const passed = tenths > 5 ? answer - 1 : answer;
  const endTenths = 10 * (start + passed) + tenths;
  const end = at10(endTenths);
  if (end > most - 0.2 || passed < 1)
    throw new Error("Need the end on the ruler");
  const things = PLOT_THINGS.filter((t) => fits(t, unit, answer, answer));
  const thing = pick(r, things);
  const length = Math.min(most, Math.ceil(end) + r(1, 3));
  const draw: RulerDraw = {
    id: "ruler",
    unit,
    length: Math.max(length, 6),
    labelEvery: 1,
    half: true,
    tape: false,
    top: 0,
    bars: [{ name: thing.one, from: start, to: end, tone: "accent" }],
  };
  if (draw.length > most) throw new Error("Need a ruler that fits");
  const figure: SemanticFigure = {
    kind: "scene",
    scene: scene(...rulerElements(draw)).build({
      title: `A ruler with ${a(thing.one)} above it`,
      note: `${rulerSentence(draw)} The ruler has a short mark halfway between each pair of numbers. ${barSentence(draw.bars[0]!)}`,
      width: SCENE_WIDTH,
    }),
  };
  const below = Math.floor(end);
  const u = UNIT[unit];
  const explanation = [
    start === 0
      ? `The ${thing.one} starts at 0.`
      : `The ${thing.one} starts at ${start}, not at 0.`,
    tenths === 0
      ? `Its end is exactly at the ${below} mark.`
      : `Its end is past the ${below} mark but before the ${below + 1} mark. The end is ${tenths < 5 ? "before" : "past"} the halfway mark between them, so it is closer to ${tenths < 5 ? below : below + 1}.`,
    start === 0
      ? `It starts at 0, so the mark it reaches gives its length: ${tenths > 5 ? below + 1 : below}.`
      : `Count the units from ${start} to ${start + answer}: $${start + answer} - ${start} = ${answer}$. The number ${start + answer} counts from 0, not from where the ${thing.one} starts, so it is not the length.`,
    `The ${thing.one} is about ${unitCount(answer, unit)} long.`,
  ];
  return {
    public: {
      id: sha(meta.id, seed),
      templateId: meta.id,
      templateVersion: 1,
      seed,
      prompt: `Measure the ${thing.one} to the nearest ${u.one}. How long is it?`,
      skillId: meta.skillId,
      response: { kind: "number", label: u.many },
      figure,
    },
    answer: String(answer),
    hint:
      start === 0
        ? `Find the two numbers the end of the ${thing.one} is between, and check which one it is closer to. The ${thing.one} starts at 0, so the closer mark is its length.`
        : `The ${thing.one} does not start at 0. Find the mark its end is closest to. Then count the ${u.many} from the start mark to that mark, not from 0.`,
    explanation,
    variant: {
      id: variant,
      axes: {
        unit,
        end:
          tenths === 0 ? "on-mark" : tenths < 5 ? "rounds-down" : "rounds-up",
      },
    },
  };
}

/* -------------------------------- choose the line plot (figure choice) */

type Counts = Map<number, number>;
const countsOf = (values: readonly number[]): Counts => {
  const m: Counts = new Map();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
};
type Plot = { scale: number[]; counts: Counts };
const plotKey = (p: Plot) =>
  JSON.stringify([p.scale, p.scale.map((v) => p.counts.get(v) ?? 0)]);
const range = (lo: number, hi: number) =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** A line plot of whole-unit measurements: one × per value, stacked over
 * equally spaced numbers. `scale` lists the numbers in order. */
function plotScene(p: Plot, unit: Unit): Scene {
  const n = p.scale.length;
  const s = (CARD.width - 8) / (n + 0.4);
  const px = (v: number) => v / s;
  const els: Element[] = [
    {
      type: "segment",
      id: "axis",
      from: [-0.5, 0],
      to: [n - 0.5, 0],
      stroke: "ink",
      width: 1.5,
    },
  ];
  const marks: PathOp[] = [];
  const h = px(5.5);
  for (const [i, v] of p.scale.entries()) {
    els.push(
      {
        type: "tick",
        id: `t${i}`,
        at: [i, 0],
        dir: [0, 1],
        length: 10,
        stroke: "ink",
        width: 1.25,
      },
      {
        type: "text",
        id: `n${i}`,
        at: [i, 0],
        text: String(v),
        size: "sm",
        color: "muted",
        offset: [0, 7],
        align: [0, -1],
      },
    );
    for (let level = 0; level < (p.counts.get(v) ?? 0); level++) {
      const y = px(15 + 17 * level);
      marks.push(
        ["M", i - h, y - h],
        ["L", i + h, y + h],
        ["M", i - h, y + h],
        ["L", i + h, y - h],
      );
    }
  }
  if (marks.length)
    els.push({
      type: "path",
      id: "marks",
      d: marks,
      stroke: "accent",
      width: 3,
    });
  els.push({
    type: "text",
    id: "unit",
    at: [n - 0.5, 0],
    text: UNIT[unit].many,
    font: "sans",
    size: "sm",
    color: "muted",
    align: [1, -1],
    offset: [0, 30],
  });
  return scene(...els).build({ width: CARD.width, maxHeight: CARD.maxHeight });
}
function plotDescription(p: Plot, unit: Unit, consecutive: boolean) {
  const marks = p.scale
    .filter((v) => (p.counts.get(v) ?? 0) > 0)
    .map((v) => `${count(p.counts.get(v)!, "mark")} above ${v}`)
    .join(", ");
  const scale = consecutive
    ? `numbered ${p.scale[0]} to ${p.scale[p.scale.length - 1]} ${UNIT[unit].many}`
    : `numbered only ${listed(p.scale)} ${UNIT[unit].many}`;
  return `A line plot ${scale}: ${marks}.`;
}
const listed = (items: readonly (string | number)[]) =>
  items.length <= 2
    ? items.join(" and ")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

type DataFamily = "several" | "repeated" | "table";
const COLORS = ["red", "blue", "green", "yellow", "orange", "purple", "pink"];

function chooseLinePlot(seed: string, salt: string): GeneratedProblem {
  const meta = metaOf("line-plot-choose-for-data");
  const r = random(meta.id, salt);
  // Kinds come from the seed alone, so redrawn numbers never tilt the mix.
  const k = random(`${meta.id}#kind`, seed);
  const family = weighted<DataFamily>(k, [
    ["several", 40],
    ["repeated", 35],
    ["table", 25],
  ]);
  const unit: Unit = k(0, 1) ? "cm" : "in";
  const top = unit === "cm" ? 20 : 12;
  let values: number[];
  let scale: number[];
  let thing: PlotThing;
  let center = 0;
  if (family === "repeated") {
    const lo = unit === "cm" ? 5 : 3,
      hi = unit === "cm" ? 18 : 11;
    // The center and both neighbors are realistic lengths for the thing.
    const span = (t: PlotThing) =>
      [Math.max(lo, t[unit][0] + 1), Math.min(hi, t[unit][1] - 1)] as const;
    const things = PLOT_THINGS.filter((t) => span(t)[0] <= span(t)[1]);
    thing = pick(r, things);
    center = r(...span(thing));
    const n = r(5, 8);
    const both = k(1, 10) <= 7;
    const tuples: [number, number, number][] = [];
    for (let below = 0; below <= 4; below++)
      for (let mid = 1; mid <= 4; mid++)
        for (let above = 0; above <= 4; above++) {
          if (below + mid + above !== n || mid <= Math.max(below, above))
            continue;
          if (both ? below < 1 || above < 1 : below > 0 === above > 0) continue;
          tuples.push([below, mid, above]);
        }
    if (!tuples.length) throw new Error("Need a count pattern");
    const [below, mid, above] = pick(r, tuples);
    values = [
      ...Array<number>(below).fill(center - 1),
      ...Array<number>(mid).fill(center),
      ...Array<number>(above).fill(center + 1),
    ];
    scale = range(center - 2, center + 2);
  } else {
    const w = r(4, 6);
    const lowest = r(2, top - w + 1);
    const highest = lowest + w - 1;
    const things = PLOT_THINGS.filter((t) => fits(t, unit, lowest, highest));
    if (!things.length) throw new Error("Need a thing this long");
    thing = pick(r, things);
    const gaps = new Set<number>();
    if (k(1, 10) <= 6) gaps.add(r(lowest + 1, highest - 1));
    const present = range(lowest, highest).filter((v) => !gaps.has(v));
    const maxN = family === "table" ? 7 : 9;
    const minN = Math.max(5, present.length + 1);
    if (minN > maxN) throw new Error("Need room for a repeat");
    const n = r(minN, maxN);
    values = [...present];
    while (values.length < n) {
      const c = countsOf(values);
      const grow = present.filter((v) => c.get(v)! < 4);
      values.push(pick(r, grow));
    }
    scale = range(lowest - 1, highest + 1);
  }
  const key: Plot = { scale, counts: countsOf(values) };
  const distinct = [...key.counts.keys()].sort((x, y) => x - y);
  const lowest = distinct[0]!,
    highest = distinct[distinct.length - 1]!;
  const interiorEmpty = range(lowest + 1, highest - 1).filter(
    (v) => !key.counts.has(v),
  );
  // D1: every mark one number over, staying on the scale.
  const shiftBy = r(0, 1) ? 1 : -1;
  if (
    lowest + shiftBy < scale[0]! ||
    highest + shiftBy > scale[scale.length - 1]!
  )
    throw new Error("Need the shifted marks on the scale");
  const shifted: Plot = {
    scale,
    counts: countsOf(values.map((v) => v + shiftBy)),
  };
  // D2: repeated measurements dropped.
  const deduped: Plot = { scale, counts: countsOf(distinct) };
  // D3: the scale shows only the numbers that occur; or D4, one mark moved.
  let third: Plot, thirdKind: "skipped" | "miscount";
  if (interiorEmpty.length) {
    third = { scale: distinct, counts: key.counts };
    thirdKind = "skipped";
  } else {
    const mode = distinct.reduce((m, v) =>
      key.counts.get(v)! > key.counts.get(m)! ? v : m,
    );
    const to = pick(
      r,
      [mode - 1, mode + 1].filter(
        (v) => v >= scale[0]! && v <= scale[scale.length - 1]!,
      ),
    );
    const moved = new Map(key.counts);
    moved.set(mode, moved.get(mode)! - 1);
    moved.set(to, (moved.get(to) ?? 0) + 1);
    if (moved.get(mode) === 0) moved.delete(mode);
    third = { scale, counts: moved };
    thirdKind = "miscount";
  }
  const plots = [key, shifted, deduped, third];
  if (new Set(plots.map(plotKey)).size !== 4)
    throw new Error("Need four different plots");
  const [who] = storyNameSet((k) => r(0, k - 1), 1);
  const many = plural(thing.one);
  const u = UNIT[unit];
  // Lists are in measurement order, never sorted.
  let order = shuffle(r, [...values]);
  if (order.every((v, i) => i === 0 || order[i - 1]! <= v))
    order = [...order.slice(1), order[0]!];
  const n = values.length;
  let figure: SemanticFigure | undefined;
  let prompt: string;
  if (family === "repeated") {
    prompt = `${who} measured the same ${thing.one} ${n} times to the nearest ${u.one}. The measurements, in ${u.many}, were ${listed(order)}. Which line plot shows all of these measurements?`;
  } else if (family === "several") {
    prompt = `${who} measured ${count(n, thing.one)} to the nearest ${u.one}. The lengths, in ${u.many}, were ${listed(order)}. Which line plot shows these measurements?`;
  } else {
    const colors = shuffle(r, [...COLORS]).slice(0, n);
    const header =
      thing.one === "paper clip chain"
        ? "Chain"
        : `${thing.one[0]!.toUpperCase()}${thing.one.slice(1)}`;
    const rows: string[][] = [
      [header, `Length (${u.many})`],
      ...order.map((v, i) => [
        `${colors[i]![0]!.toUpperCase()}${colors[i]!.slice(1)}`,
        String(v),
      ]),
    ];
    figure = {
      kind: "scene",
      scene: lineTable(rows, { header: "row" }).scene({
        title: `Table of ${n} ${many} and their lengths in ${u.many}`,
        maxHeight: 420,
      }),
    };
    prompt = `${who} measured ${count(n, thing.one)} to the nearest ${u.one}. The table shows each length. Which line plot shows these measurements?`;
  }
  const mode = distinct.reduce((m, v) =>
    key.counts.get(v)! > key.counts.get(m)! ? v : m,
  );
  const tally = distinct
    .map((v) => `${v} appears ${count(key.counts.get(v)!, "time")}`)
    .join(", ");
  const describe = (p: Plot) =>
    plotDescription(
      p,
      unit,
      p.scale.length === p.scale[p.scale.length - 1]! - p.scale[0]! + 1,
    );
  const correct: Candidate = {
    description: describe(key),
    scene: plotScene(key, unit),
  };
  const distractors: Candidate[] = [
    {
      description: describe(shifted),
      scene: plotScene(shifted, unit),
      feedback: (name) =>
        `${name} puts every mark one number too far ${shiftBy === 1 ? "to the right" : "to the left"}. A mark for ${mode} goes right above the ${mode}.`,
    },
    {
      description: describe(deduped),
      scene: plotScene(deduped, unit),
      feedback: (name) =>
        `${name} has only one mark for each number. ${mode} was measured ${count(key.counts.get(mode)!, "time")}, so it needs ${count(key.counts.get(mode)!, "mark")}.`,
    },
    {
      description: describe(third),
      scene: plotScene(third, unit),
      feedback: (name) =>
        thirdKind === "skipped"
          ? `${name} leaves ${listed(interiorEmpty)} off its scale. The scale must show every whole number in order, even a number with no marks.`
          : `${name} moves one mark away from ${mode}. Count the list again: ${mode} appears ${count(key.counts.get(mode)!, "time")}.`,
    },
  ];
  const explanation = (name: string) => [
    `Each measurement gets one mark above its number. There are ${count(n, "measurement")}, so the plot needs ${count(n, "mark")}.`,
    `Count how many times each number appears: ${tally}.`,
    family === "repeated"
      ? `The same ${thing.one} got different numbers because measuring is never perfect, but the marks pile up around ${center}.`
      : `The scale must show every whole number from ${scale[0]} to ${scale[scale.length - 1]}, even ${interiorEmpty.length ? `${listed(interiorEmpty)}, which has no mark` : "a number with no mark"}.`,
    `A plot that moves every mark one number over, keeps only one mark for a repeated number, or ${thirdKind === "skipped" ? "skips a number on its scale" : "moves one mark to a neighboring number"} does not show the list.`,
    `${name} has ${count(key.counts.get(mode)!, "mark")} above ${mode} and one mark for every measurement, on a scale of whole numbers in order.`,
  ];
  const problem = figureChoiceProblem(meta, seed, r, {
    prompt,
    label: "Choose the line plot",
    noun: "Graph",
    ...(figure ? { figure } : {}),
    correct,
    distractors,
    hint: `There are ${count(n, "measurement")}, so the right plot has ${count(n, "mark")}. Tally how many times ${mode} appears, then look for the plot with that many marks above ${mode} and every whole number on its scale.`,
    explanation,
    walkthrough: correct.scene,
  });
  return {
    ...problem,
    variant: {
      id: family,
      axes: { unit, third: thirdKind },
    },
  };
}

/* ---------------------------------------------------------------- engine */

const generators: Record<
  string,
  (seed: string, salt: string) => GeneratedProblem
> = {
  "ruler-length-difference": lengthDifference,
  "compare-measured-lengths": compareLengths,
  "ruler-read-nearest-unit": nearestUnit,
  "line-plot-choose-for-data": chooseLinePlot,
};
export function generateRulerLinePlot(
  templateId: string,
  seed: string,
): GeneratedProblem {
  const generate = generators[templateId];
  if (!generate)
    throw new Error(`Unknown ruler-line-plot template ${templateId}`);
  if (typeof seed !== "string" || !seed.length || seed.length > 128)
    throw new Error("Seed must contain 1–128 characters");
  // A draw that breaks a rule is redrawn from a salted stream; the saved
  // seed never changes.
  for (let attempt = 0; attempt < 200; attempt++)
    try {
      return generate(seed, attempt ? `${seed}#${attempt}` : seed);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Need"))
        throw error;
    }
  throw new Error(`${templateId}: no instance for ${seed}`);
}
