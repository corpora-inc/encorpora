import { createHash } from "node:crypto";

/** What a problem family is for. An assessment item is a whole, recognizable
 * skill item. A scaffold is a method step inside a skill (a partial product,
 * an intermediate count): it teaches inside lessons, hints and practice, but
 * as a stand-alone placement item it reads as an odd fragment. */
export type TemplateRole = "assessment" | "scaffold";

/** Method-step families. Every family not listed is an assessment item. */
export const scaffoldTemplateIds: ReadonlySet<string> = new Set([
  // "To find 54 × 7, split 54 into 50 + 4. What is the tens partial product?"
  "tens-contribution",
  // "To add 6 + 6, move 4 from 6 to make ten. How much of 6 is left?"
  "make-ten-remainder",
  // "To find 14 − 7, first take away 4 to reach ten. How many more…?"
  "subtract-through-ten",
  // "The array is split into regions A and B. How many squares are in A?"
  "split-array-part",
  // "Remove all complete wholes from 5/2. What fraction of one whole remains?"
  "improper-fractional-part",
  // "Trade ten ones for one ten. How many tens will there be?"
  "exchange-base-ten",
  // "How many cubes are in the bottom layer of this prism?"
  "cube-layer-count",
]);

export const templateRole = (templateId: string): TemplateRole =>
  scaffoldTemplateIds.has(templateId) ? "scaffold" : "assessment";

/** Placement lasts this many answers; it offers assessment items only. */
export const PLACEMENT_ATTEMPTS = 20;
/** The first answers follow a short scripted sequence before adaptive
 * selection takes over from the frontier. */
export const OPENER_COUNT = 4;

/** A grade band's scripted openers: OPENER_COUNT slots, each a small pool
 * of equivalent items. */
export type OpenerSlots = readonly (readonly (readonly string[])[])[];

/** Clean anchor items for the grade a learner of that age is working in
 * (frontier `expected`: K = 0 … 8, and 9 for every high-school age). Each
 * opener is this year's or last year's core material (grade 8, Algebra 1 and
 * Geometry for high school), so the first answers build confidence: short,
 * familiar and whole.
 * Choice items may open: the estimator discounts a correct pick by its guess
 * chance (learning/frontier.ts), so they are used where they bring a strand
 * the typed items cannot (shapes, shares, clocks) rather than as stand-ins
 * for typed items. Each slot is a small pool of equivalent items so
 * siblings do not see identical starts, while every choice stays a good first
 * impression. Each slot keeps to one strand and neighbouring slots differ, so
 * the opening batch is interleaved like the rest of practice.
 *
 * Capabilities: an opener may need a figure family (`scenes-v1`, data
 * displays) or choice responses. The planner only ever sees the templates the
 * client declares it can draw (`clientCanDraw` in math/contracts.ts), so a
 * client that cannot draw the learner's pick gets the next item in the same
 * slot it can draw, and a slot with none falls through to adaptive selection.
 * Either way the answer is a whole assessment item near the learner's age;
 * tests/placement.test.ts proves it for every client. Where a strand has a
 * capability-free item in reach, its slot keeps one, so older clients still
 * open on the scripted strand. */
export const openerSlots: OpenerSlots = [
  // K (and younger): count or compare numerals, join or take away, compare
  // lengths, weights or capacity, then name a shape.
  [
    [
      "count-objects",
      "teen-frame-compose",
      "greater-numeral",
      "numeral-for-quantity",
      "count-sequence-missing",
    ],
    [
      "join-within-10",
      "facts-to-five",
      "take-away-within-10",
      "ten-frame-complement",
      "number-bond-missing",
    ],
    ["compare-lengths", "compare-weights", "compare-capacity"],
    ["name-flat-shape", "name-solid-shape", "find-named-shape"],
  ],
  // Grade 1: facts within 10 or 20, equal shares, sides and shapes, a
  // picture graph.
  [
    ["join-within-10", "add-within-20", "count-on-back"],
    ["find-equal-shares", "name-equal-share", "larger-share"],
    [
      "count-sides-corners",
      "name-flat-shape",
      "name-solid-shape",
      "defining-attribute",
    ],
    ["picture-graph-questions", "sort-shapes-count"],
  ],
  // Grade 2: facts within 20 or two-digit sums and differences, halves,
  // thirds and quarters, polygons and solids, a bar chart or line plot.
  [
    [
      "add-within-20",
      "make-ten-fact",
      "add-two-digit-regroup",
      "subtract-within-20",
      "related-subtraction",
      "subtract-two-digit-regroup",
    ],
    [
      "find-equal-thirds",
      "name-share",
      "same-share-different-shape",
      "name-equal-share",
    ],
    ["name-polygon", "polygon-with-angles", "solid-parts"],
    [
      "bar-chart-total",
      "bar-chart-difference",
      "line-plot-whole",
      "picture-graph-questions",
    ],
  ],
  // Grade 3: regrouping or tens products, unit fractions, area or
  // quadrilaterals, three-digit place value.
  [
    [
      "add-with-regrouping",
      "add-two-digit-regroup",
      "add-three-digit",
      "mental-ten-hundred",
      "multiply-by-tens",
    ],
    [
      "fraction-model",
      "fraction-unit-count",
      "compare-like-denominators",
      "fraction-line-position",
    ],
    [
      "rectangle-area",
      "classify-quadrilateral",
      "find-quadrilateral",
      "name-polygon",
    ],
    [
      "place-value-digit",
      "hundreds-model",
      "compare-three-digit",
      "round-to-ten",
      "round-to-hundred",
    ],
  ],
  // Grade 4: multiplication or division, fractions of a whole, area, angles
  // or quadrilaterals, a scaled graph or line plot.
  [
    [
      "multiply-facts",
      "add-multidigit",
      "multiply-by-tens",
      "multiply-by-one-digit",
      "divide-facts",
      "share-or-group",
      "divide-by-one-digit",
    ],
    [
      "fraction-model",
      "fraction-unit-count",
      "compare-like-denominators",
      "compare-like-numerators",
    ],
    [
      "rectangle-area",
      "classify-quadrilateral",
      "protractor-reading",
      "angle-classify",
    ],
    ["scaled-bar-graph", "scaled-picture-graph", "fraction-line-plot"],
  ],
  // Grade 5: decimals (grade 4 tenths and hundredths), fractions, volume or
  // coordinates, a fraction line plot.
  [
    [
      "compare-decimals-hundredths",
      "decimal-grid-read",
      "compare-decimals-thousandths",
    ],
    [
      "compare-fractions",
      "compare-unlike-fractions",
      "equivalent-numerator",
      "whole-times-fraction",
    ],
    [
      "unit-cube-volume",
      "prism-volume-edges",
      "first-quadrant-coordinates",
      "angle-classify",
    ],
    ["fraction-plot-equal-share"],
  ],
  // Grade 6: fractions, expressions and equations, area or volume, the mean.
  [
    [
      "multiply-fractions",
      "fraction-of-quantity",
      "add-fractions",
      "divide-fractions",
    ],
    [
      "operation-order",
      "integer-power",
      "one-step-equation",
      "dependent-variable-value",
    ],
    ["triangle-area-base-height", "net-surface-area", "prism-volume-edges"],
    ["mean-data", "mean-missing-value", "dot-plot-mean"],
  ],
  // Grade 7: powers and equations, unit rates, circles, angles or area,
  // distance on a number line.
  [
    ["integer-power", "two-step-equation", "dependent-variable-value"],
    ["unit-price", "fraction-unit-rate", "unit-rate"],
    [
      "circle-area-coefficient",
      "circle-circumference-coefficient",
      "angle-pair-measure",
      "triangle-area-base-height",
    ],
    ["number-line-distance", "opposite-on-line", "greatest-common-factor"],
  ],
  // Grade 8: signed and real numbers, linear equations and slope, two-way
  // tables or a median, circles, triangles and solids.
  [
    ["integer-addition", "root-between-integers", "scientific-to-standard"],
    [
      "linear-equation",
      "both-sides-linear-equation",
      "grouped-linear-equation",
      "line-slope",
    ],
    ["two-way-missing", "two-way-row-percent", "median-data", "range-data"],
    [
      "circle-area-coefficient",
      "circle-circumference-coefficient",
      "coordinate-distance",
      "triangle-angle-sum",
      "angle-pair-measure",
      "cylinder-volume",
    ],
  ],
  // High school: a linear or quadratic equation, the Pythagorean theorem or
  // similar triangles and circles, a function's value, vertex or exponential
  // growth, then a two-way table (joint, marginal or conditional relative
  // frequency). No probability item fits yet: `event-set-count` runs past
  // 160 characters on about a third of its variants, and the counting items
  // are grade 12.
  [
    [
      "linear-equation",
      "both-sides-linear-equation",
      "formula-value",
      "quadratic-factored-solutions",
      "quadratic-real-solution-count",
    ],
    [
      "right-triangle",
      "right-triangle-missing-leg",
      "similar-triangle-side",
      "circle-equation",
    ],
    [
      "function-evaluation",
      "average-rate-formula",
      "quadratic-vertex",
      "geometric-sequence",
      "geometric-sequence-rule",
      "exponential-model-rule",
      "parabola-vertex",
    ],
    ["two-way-row-percent", "two-way-missing", "relative-frequency-percent"],
  ],
];

/** The opener families for answer `position` (0-based), in preference order:
 * the learner's own pick from the slot pool first, then the rest of that pool.
 * Empty once the scripted sequence is over. Deterministic for a learner. */
export function openerCandidates(options: {
  expectedGrade: number;
  position: number;
  learnerKey: string;
  /** The opener table; simulations compare alternatives. */
  slots?: OpenerSlots;
}): string[] {
  const slots = options.slots ?? openerSlots;
  if (options.position < 0 || options.position >= OPENER_COUNT) return [];
  if (!slots.length) return [];
  const band = Math.max(
    0,
    Math.min(slots.length - 1, Math.round(options.expectedGrade)),
  );
  const pool = slots[band]![options.position] ?? [];
  if (!pool.length) return [];
  const pick =
    createHash("sha256")
      .update(`${options.learnerKey}:opener:${options.position}`)
      .digest()
      .readUInt32BE(0) % pool.length;
  return [...pool.slice(pick), ...pool.slice(0, pick)];
}
