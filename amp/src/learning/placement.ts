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

/** Clean anchor items for the grade a learner of that age is working in
 * (frontier `expected`: K = 0 … 8, and 9 for every high-school age). Each
 * opener is this year's or last year's core material (grade 8 for high
 * school), so the first answers build confidence: short, familiar and whole.
 * Choice items may open: the estimator discounts a correct pick by its guess
 * chance (learning/frontier.ts), so they are used where they bring a strand
 * the typed items cannot (comparing, clocks, coins) rather than as stand-ins
 * for typed items. Each slot is a small pool of equivalent items so
 * siblings do not see identical starts, while every choice stays a good first
 * impression. Each slot keeps to one strand and neighbouring slots differ, so
 * the opening batch is interleaved like the rest of practice. */
export const openerSlots: readonly (readonly (readonly string[])[])[] = [
  // K (and younger): count or compare numerals, join, compare lengths,
  // weights or capacity, take away.
  [
    [
      "count-objects",
      "teen-frame-compose",
      "greater-numeral",
      "numeral-for-quantity",
      "count-sequence-missing",
    ],
    ["join-within-10", "facts-to-five"],
    ["compare-lengths", "compare-weights", "compare-capacity"],
    ["take-away-within-10", "ten-frame-complement", "number-bond-missing"],
  ],
  // Grade 1: counting, facts within 10, a missing addend, then a clock or a
  // length.
  [
    ["count-objects", "teen-frame-compose"],
    ["join-within-10", "add-within-20", "count-on-back"],
    ["unknown-addend-story", "balanced-addition"],
    [
      "clock-hour-read",
      "read-clock-hour-half",
      "match-clock-half-hour",
      "measure-with-units",
      "compare-lengths",
    ],
  ],
  // Grade 2: facts within 20 or two-digit sums and differences, place value
  // and comparison, a missing addend, then coins or a clock.
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
      "tens-ones-model",
      "continue-count-to-120",
      "compare-two-digit",
      "compare-three-digit",
    ],
    ["unknown-addend-story", "balanced-addition"],
    [
      "coin-total",
      "pay-exact-coins",
      "minutes-past-hour",
      "read-clock-five-minutes",
      "match-clock-five-minutes",
    ],
  ],
  // Grade 3: regrouping or tens products, three-digit place value, a story,
  // a bar chart.
  [
    [
      "add-with-regrouping",
      "add-two-digit-regroup",
      "add-three-digit",
      "mental-ten-hundred",
      "multiply-by-tens",
    ],
    [
      "place-value-digit",
      "hundreds-model",
      "compare-three-digit",
      "round-to-ten",
      "round-to-hundred",
    ],
    ["two-step-change", "delivery-then-use"],
    ["bar-chart-total", "bar-chart-difference"],
  ],
  // Grade 4: multiplication facts, fractions of a whole, area, division.
  [
    [
      "multiply-facts",
      "add-multidigit",
      "multiply-by-tens",
      "multiply-by-one-digit",
    ],
    [
      "fraction-model",
      "fraction-unit-count",
      "compare-like-denominators",
      "compare-like-numerators",
    ],
    ["rectangle-area"],
    ["divide-facts", "share-or-group", "divide-by-one-digit"],
  ],
  // Grade 5: decimals (grade 4 tenths and hundredths), fractions, factors or
  // place value, multidigit multiplication or division.
  [
    ["compare-decimals-hundredths", "decimal-grid-read"],
    [
      "compare-fractions",
      "compare-unlike-fractions",
      "equivalent-numerator",
      "whole-times-fraction",
    ],
    [
      "factor-partner",
      "multidigit-digit-value",
      "compare-multidigit",
      "multiply-power-of-ten",
    ],
    ["multiply-by-one-digit", "multiply-multidigit", "divide-by-one-digit"],
  ],
  // Grade 6: decimals, expressions and equations, fractions, the mean.
  [
    [
      "decimal-addition",
      "decimal-multiplication",
      "compare-decimals-thousandths",
    ],
    [
      "operation-order",
      "integer-power",
      "one-step-equation",
      "dependent-variable-value",
    ],
    ["multiply-fractions", "fraction-of-quantity", "add-fractions"],
    ["mean-data", "mean-missing-value"],
  ],
  // Grade 7: powers and equations, unit rates, the mean or a sample estimate, distance on a number line.
  [
    ["integer-power", "two-step-equation", "dependent-variable-value"],
    ["unit-price", "fraction-unit-rate", "unit-rate"],
    ["mean-data", "mean-missing-value", "sample-proportion-estimate"],
    ["number-line-distance", "opposite-on-line", "greatest-common-factor"],
  ],
  // Grade 8: signed and real numbers, unit rates, probability and circles.
  [
    ["integer-addition", "root-between-integers", "scientific-to-standard"],
    ["unit-price", "fraction-unit-rate"],
    ["simple-probability"],
    ["circle-area-coefficient", "circle-circumference-coefficient"],
  ],
  // High school: an equation, the Pythagorean theorem, a unit rate, slope.
  [
    ["linear-equation", "both-sides-linear-equation"],
    ["right-triangle"],
    ["unit-price"],
    ["line-slope", "graphed-line-slope"],
  ],
];

/** The opener families for answer `position` (0-based), in preference order:
 * the learner's own pick from the slot pool first, then the rest of that pool.
 * Empty once the scripted sequence is over. Deterministic for a learner. */
export function openerCandidates(options: {
  expectedGrade: number;
  position: number;
  learnerKey: string;
}): string[] {
  if (options.position < 0 || options.position >= OPENER_COUNT) return [];
  const band = Math.max(
    0,
    Math.min(openerSlots.length - 1, Math.round(options.expectedGrade)),
  );
  const pool = openerSlots[band]![options.position] ?? [];
  if (!pool.length) return [];
  const pick =
    createHash("sha256")
      .update(`${options.learnerKey}:opener:${options.position}`)
      .digest()
      .readUInt32BE(0) % pool.length;
  return [...pool.slice(pick), ...pool.slice(0, pick)];
}
